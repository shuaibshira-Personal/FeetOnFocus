/**
 * AI Vision Invoice Processor
 * Uses Google Gemini Vision API to directly analyze PDF invoices without text extraction
 */

console.log('📄 Loading aiVisionInvoiceProcessor.js...');

class AIVisionInvoiceProcessor {
    constructor() {
        this.apiKey = null; // Will be set by user
        // Will be discovered dynamically
        this.apiEndpoint = null;
        this.testEndpoint = null;
        this.maxFileSize = 20 * 1024 * 1024; // 20MB limit for Gemini
        
        // Load API key from localStorage
        this.loadApiKey();
    }

    /**
     * Load API key from localStorage
     */
    loadApiKey() {
        try {
            this.apiKey = localStorage.getItem('feetonfocus_gemini_api_key');
        } catch (error) {
            console.warn('Could not load Gemini API key:', error.message);
        }
    }

    /**
     * Save API key to localStorage
     * @param {string} apiKey - Gemini API key
     */
    saveApiKey(apiKey) {
        try {
            this.apiKey = apiKey;
            localStorage.setItem('feetonfocus_gemini_api_key', apiKey);
            console.log('✅ Gemini API key saved');
        } catch (error) {
            console.error('Failed to save Gemini API key:', error);
        }
    }

    /**
     * Check if API key is configured
     * @returns {boolean} True if API key is available
     */
    hasApiKey() {
        return !!this.apiKey;
    }

    /**
     * Test API key validity by making a simple request
     * @returns {Promise<Object>} Test result
     */
    async testApiKey() {
        if (!this.hasApiKey()) {
            return {
                success: false,
                error: 'No API key configured'
            };
        }

        // First, discover available models
        try {
            console.log('🔍 Discovering available models...');
            const modelsResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${this.apiKey}`);
            
            if (!modelsResponse.ok) {
                if (modelsResponse.status === 403) {
                    return {
                        success: false,
                        statusCode: 403,
                        error: 'API key is invalid or Generative Language API is not enabled in your Google Cloud project'
                    };
                }
                throw new Error(`Models list failed: ${modelsResponse.status} ${modelsResponse.statusText}`);
            }
            
            const modelsData = await modelsResponse.json();
            console.log('📋 Available models:', modelsData.models?.length || 0);
            
            // Find suitable models for vision tasks (prioritize models good at document analysis)
            const preferredModels = [
                'models/gemini-2.5-pro',        // Best for complex document analysis
                'models/gemini-2.5-flash',      // Fast and good for vision
                'models/gemini-2.0-flash',      // Newer generation
                'models/gemini-flash-latest',   // Latest stable
                'models/gemini-pro-latest'      // Fallback
            ];
            
            let workingModel = null;
            
            // First try preferred models
            for (const preferredModel of preferredModels) {
                const model = modelsData.models?.find(m => 
                    m.name === preferredModel && 
                    m.supportedGenerationMethods?.includes('generateContent')
                );
                if (model) {
                    workingModel = model;
                    break;
                }
            }
            
            // If no preferred model found, use any available model that supports generateContent
            if (!workingModel) {
                workingModel = modelsData.models?.find(m => 
                    m.supportedGenerationMethods?.includes('generateContent') &&
                    m.name.includes('gemini')
                );
            }
            
            if (!workingModel) {
                return {
                    success: false,
                    error: 'No suitable Gemini models found that support generateContent'
                };
            }
            
            console.log('🎯 Using model:', workingModel.name);
            
            // Test the model
            const testEndpoint = `https://generativelanguage.googleapis.com/v1beta/${workingModel.name}:generateContent`;
            console.log('🧪 Testing endpoint:', testEndpoint);
            
            const testResponse = await fetch(`${testEndpoint}?key=${this.apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: 'Hello, respond with: API test successful' }] }],
                    generationConfig: { 
                        maxOutputTokens: 20,
                        temperature: 0.1
                    }
                })
            });
            
            if (testResponse.ok) {
                const result = await testResponse.json();
                const responseText = result.candidates?.[0]?.content?.parts?.[0]?.text;
                
                // Save working endpoints
                this.testEndpoint = testEndpoint;
                this.apiEndpoint = testEndpoint;
                
                console.log('✅ API key test successful!', responseText);
                
                return {
                    success: true,
                    message: `API key is working with ${workingModel.name}`,
                    workingEndpoint: testEndpoint,
                    modelName: workingModel.name,
                    response: responseText
                };
            } else {
                const errorText = await testResponse.text();
                console.log('❌ Model test failed:', testResponse.status, errorText);
                
                return {
                    success: false,
                    statusCode: testResponse.status,
                    error: `Model test failed: ${testResponse.status} ${testResponse.statusText}`
                };
            }
            
        } catch (error) {
            console.error('❌ API test failed:', error.message);
            return {
                success: false,
                error: `API test failed: ${error.message}`
            };
        }
    }

    /**
     * Convert PDF file to base64 for Gemini API
     * @param {File} file - PDF file
     * @returns {Promise<string>} Base64 encoded file
     */
    async convertFileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                // Remove data URL prefix to get pure base64
                const base64 = reader.result.split(',')[1];
                resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    /**
     * Process invoice using Google Gemini Vision
     * @param {File} file - Invoice file (PDF or image)
     * @param {string} supplierName - Optional supplier name hint
     * @param {Object} trainingData - Optional training data for new suppliers
     * @returns {Promise<Object>} Processed invoice data
     */
    async processInvoiceWithVision(file, supplierName = null, trainingData = null) {
        if (!this.hasApiKey()) {
            throw new Error('Gemini API key not configured. Please set your API key first.');
        }

        if (file.size > this.maxFileSize) {
            throw new Error(`File size ${(file.size / 1024 / 1024).toFixed(1)}MB exceeds limit of ${this.maxFileSize / 1024 / 1024}MB`);
        }

        console.log('🔍 Processing invoice with Gemini Vision:', file.name);
        
        // Ensure we have a working endpoint
        if (!this.apiEndpoint) {
            console.log('🔍 No endpoint configured, discovering models...');
            const testResult = await this.testApiKey();
            if (!testResult.success) {
                throw new Error(`API key test failed: ${testResult.error}`);
            }
        }

        try {
            // Convert file to base64
            const base64Data = await this.convertFileToBase64(file);
            
            // Determine MIME type
            const mimeType = file.type || 'application/pdf';

            // Build the prompt based on whether we have training data
            let prompt;
            if (trainingData) {
                prompt = this.buildTrainingPrompt(trainingData, supplierName);
            } else {
                prompt = this.buildExtractionPrompt(supplierName);
            }

            // Make API request to Gemini
            const response = await fetch(`${this.apiEndpoint}?key=${this.apiKey}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [
                            {
                                text: prompt
                            },
                            {
                                inline_data: {
                                    mime_type: mimeType,
                                    data: base64Data
                                }
                            }
                        ]
                    }],
                    generationConfig: {
                        temperature: 0.1, // Low temperature for consistent extraction
                        topK: 1,
                        topP: 0.1,
                        maxOutputTokens: 4096, // Increased from 2048 to handle larger responses
                    },
                    safetySettings: [
                        {
                            category: "HARM_CATEGORY_HARASSMENT",
                            threshold: "BLOCK_NONE"
                        },
                        {
                            category: "HARM_CATEGORY_HATE_SPEECH",
                            threshold: "BLOCK_NONE"
                        },
                        {
                            category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                            threshold: "BLOCK_NONE"
                        },
                        {
                            category: "HARM_CATEGORY_DANGEROUS_CONTENT",
                            threshold: "BLOCK_NONE"
                        }
                    ]
                })
            });

            if (!response.ok) {
                let errorMessage = `HTTP ${response.status}`;
                try {
                    const errorData = await response.json();
                    if (errorData.error) {
                        errorMessage = errorData.error.message || errorData.error.code || JSON.stringify(errorData.error);
                    }
                } catch (e) {
                    errorMessage = `${response.status} ${response.statusText}`;
                }
                
                // Provide specific guidance based on error type
                if (response.status === 403) {
                    throw new Error(`API key error: ${errorMessage}. Please check that your API key is valid and has Generative AI API enabled.`);
                } else if (response.status === 404) {
                    throw new Error(`Model not found: ${errorMessage}. The Gemini model endpoint may have changed.`);
                } else if (response.status === 429) {
                    throw new Error(`Quota exceeded: ${errorMessage}. You've hit the API rate limit. Try again in a few minutes.`);
                } else {
                    throw new Error(`Gemini API error: ${errorMessage}`);
                }
            }

            const result = await response.json();
            console.log('🤖 Gemini Vision raw response:', result);
            console.log('🔍 Response structure check:');
            console.log('- result.candidates:', !!result.candidates, result.candidates?.length);
            console.log('- result.candidates[0]:', !!result.candidates?.[0]);
            console.log('- result.candidates[0].content:', !!result.candidates?.[0]?.content);
            console.log('- result.candidates[0].content.parts:', !!result.candidates?.[0]?.content?.parts);
            
            // Check for safety ratings that might have blocked content
            if (result.candidates?.[0]?.safetyRatings) {
                console.log('🛡️ Safety ratings:', result.candidates[0].safetyRatings);
            }
            
            // Check for finish reason
            if (result.candidates?.[0]?.finishReason) {
                console.log('🏁 Finish reason:', result.candidates[0].finishReason);
                if (result.candidates[0].finishReason !== 'STOP') {
                    console.warn('⚠️ Content generation did not finish normally. Reason:', result.candidates[0].finishReason);
                }
            }
            
            // Log full candidate structure for debugging
            if (result.candidates?.[0]) {
                console.log('📋 Full candidate structure:', JSON.stringify(result.candidates[0], null, 2));
            }

            // Extract the generated text with proper error checking
            if (!result.candidates) {
                throw new Error('No candidates in Gemini API response. Response: ' + JSON.stringify(result, null, 2));
            }
            if (!result.candidates[0]) {
                throw new Error('No first candidate in Gemini API response. Candidates: ' + JSON.stringify(result.candidates, null, 2));
            }
            if (!result.candidates[0].content) {
                throw new Error('No content in first candidate. Candidate: ' + JSON.stringify(result.candidates[0], null, 2));
            }
            if (!result.candidates[0].content.parts || !result.candidates[0].content.parts[0]) {
                // Check if content was blocked due to safety filters or token limit
                const finishReason = result.candidates[0].finishReason;
                if (finishReason === 'SAFETY' || finishReason === 'BLOCKED_REASON_UNSPECIFIED') {
                    console.warn('⚠️ Content blocked by safety filters, trying with simpler prompt...');
                    return this.retryWithSimplePrompt(file, supplierName);
                } else if (finishReason === 'MAX_TOKENS') {
                    console.warn('⚠️ Response truncated due to token limit, trying with simpler prompt...');
                    return this.retryWithSimplePrompt(file, supplierName);
                }
                throw new Error(`No parts in candidate content. Finish reason: ${finishReason}. Content: ` + JSON.stringify(result.candidates[0].content, null, 2));
            }

            const generatedText = result.candidates[0].content.parts[0].text;
            console.log('🤖 Gemini generated text (RAW):');
            console.log('================================');
            console.log(generatedText);
            console.log('================================');

            // Check if response was truncated due to MAX_TOKENS
            const finishReason = result.candidates[0].finishReason;
            if (finishReason === 'MAX_TOKENS') {
                console.warn('⚠️ Response was truncated due to token limit. Trying to parse anyway...');
            }

            // Parse the JSON response
            const extractedData = this.parseVisionResponse(generatedText);
            
            // If we got truncated but have some valid data, use it instead of retrying
            if (finishReason === 'MAX_TOKENS' && extractedData.lineItems && extractedData.lineItems.length > 0) {
                console.warn(`⚠️ Response truncated but extracted ${extractedData.lineItems.length} line item(s). Using partial data.`);
                // Continue with partial data - don't retry
            }
            
            // Only retry if we got no line items at all
            if (finishReason === 'MAX_TOKENS' && (!extractedData.lineItems || extractedData.lineItems.length === 0)) {
                console.warn('⚠️ Truncated response with no line items, retrying with simple prompt...');
                return this.retryWithSimplePrompt(file, supplierName);
            }

            return {
                success: true,
                method: 'gemini-vision',
                supplier: extractedData.supplier || supplierName,
                invoice: {
                    invoiceNumber: extractedData.invoiceNumber,
                    date: extractedData.invoiceDate,
                    totalAmount: extractedData.totalAmount,
                    totalExcludingTax: extractedData.totalExcludingTax,
                    taxAmount: extractedData.taxAmount,
                    currency: extractedData.currency || 'ZAR'
                },
                lineItems: extractedData.lineItems || [],
                rawResponse: generatedText,
                processingInfo: {
                    fileSize: file.size,
                    fileName: file.name,
                    processingTime: Date.now()
                }
            };

        } catch (error) {
            console.error('❌ Gemini Vision processing failed:', error);
            throw error;
        }
    }

    /**
     * Build prompt for training new suppliers
     * @param {Object} trainingData - User-provided training data
     * @param {string} supplierName - Supplier name
     * @returns {string} Training prompt
     */
    buildTrainingPrompt(trainingData, supplierName) {
        const lineItemExamples = trainingData.lineItems.map((item, i) => 
            `${i+1}. "${item.name}" - Quantity: ${item.quantity}, Unit Price: ${item.unitPrice}, Net Price: ${item.netPrice}${item.discount ? `, Discount: ${item.discount}%` : ''}`
        ).join('\n');

        return `You are an expert invoice data extraction system. I need you to analyze this ${supplierName} invoice and extract data in the EXACT format I specify.

TRAINING INFORMATION:
The user has told me this invoice contains:
- Invoice Number: "${trainingData.invoiceNumber}"
- Invoice Date: "${trainingData.invoiceDate}" (format: ${trainingData.dateFormat})
- Total Including Tax: ${trainingData.totalIncludingTax}
- Total Excluding Tax: ${trainingData.totalExcludingTax}
- Tax Rate: ${trainingData.taxRate}%
- Currency: ${trainingData.currency}
- Prices Include Tax: ${trainingData.pricesIncludeTax ? 'Yes' : 'No'}
- Has Discounts: ${trainingData.hasDiscounts ? 'Yes' : 'No'}

Expected Line Items:
${lineItemExamples}

TASK: Look at this invoice image/PDF and extract the data. Focus on finding the line items that match the training examples above.

Return your response as a JSON object in this EXACT format:
{
  "supplier": "${supplierName}",
  "invoiceNumber": "exact_invoice_number_from_document",
  "invoiceDate": "exact_date_from_document", 
  "totalAmount": number,
  "totalExcludingTax": number,
  "taxAmount": number,
  "currency": "${trainingData.currency}",
  "lineItems": [
    {
      "code": "product_code_if_visible",
      "description": "exact_product_description",
      "quantity": number,
      "unitPrice": number,
      "discountPercent": number_or_0,
      "netPrice": number,
      "totalPrice": number
    }
  ]
}

Be very precise and only extract what you actually see in the document.`;
    }

    /**
     * Retry processing with a simpler prompt to avoid safety blocks
     * @param {File} file - Invoice file
     * @param {string} supplierName - Optional supplier name hint
     * @returns {Promise<Object>} Processed invoice data
     */
    async retryWithSimplePrompt(file, supplierName = null) {
        console.log('🔄 Retrying with simplified prompt...');
        
        try {
            // Convert file to base64
            const base64Data = await this.convertFileToBase64(file);
            const mimeType = file.type || 'application/pdf';

            // Use a very simple, safe prompt
            const simplePrompt = this.buildSimplePrompt();

            // Make API request with more permissive safety settings
            const response = await fetch(`${this.apiEndpoint}?key=${this.apiKey}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [
                            { text: simplePrompt },
                            {
                                inline_data: {
                                    mime_type: mimeType,
                                    data: base64Data
                                }
                            }
                        ]
                    }],
                    generationConfig: {
                        temperature: 0.1,
                        topK: 1,
                        topP: 0.1,
                        maxOutputTokens: 2048, // Increased for simple prompt
                    },
                    safetySettings: [
                        {
                            category: "HARM_CATEGORY_HARASSMENT",
                            threshold: "BLOCK_ONLY_HIGH"
                        },
                        {
                            category: "HARM_CATEGORY_HATE_SPEECH",
                            threshold: "BLOCK_ONLY_HIGH"
                        },
                        {
                            category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                            threshold: "BLOCK_ONLY_HIGH"
                        },
                        {
                            category: "HARM_CATEGORY_DANGEROUS_CONTENT",
                            threshold: "BLOCK_ONLY_HIGH"
                        }
                    ]
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();
            console.log('🔄 Retry response:', result);

            // Extract the generated text
            if (result.candidates?.[0]?.content?.parts?.[0]?.text) {
                const generatedText = result.candidates[0].content.parts[0].text;
                console.log('🔄 Retry successful, parsing response...');
                
                const extractedData = this.parseVisionResponse(generatedText);
                
                return {
                    success: true,
                    method: 'gemini-vision-simple',
                    supplier: extractedData.supplier || supplierName,
                    invoice: {
                        invoiceNumber: extractedData.invoiceNumber,
                        date: extractedData.invoiceDate,
                        totalAmount: extractedData.totalAmount,
                        totalExcludingTax: extractedData.totalExcludingTax,
                        taxAmount: extractedData.taxAmount,
                        currency: extractedData.currency || 'ZAR'
                    },
                    lineItems: extractedData.lineItems || [],
                    rawResponse: generatedText,
                    processingInfo: {
                        fileSize: file.size,
                        fileName: file.name,
                        processingTime: Date.now(),
                        fallbackUsed: true
                    }
                };
            } else {
                // Check for finish reason to provide better error info
                const finishReason = result.candidates?.[0]?.finishReason;
                console.error(`❌ Simple prompt failed. Finish reason: ${finishReason}`);
                throw new Error(`Simple prompt failed to generate content. Reason: ${finishReason || 'Unknown'}`);
            }
            
        } catch (error) {
            console.error('❌ Simple prompt retry failed:', error);
            throw error;
        }
    }

    /**
     * Build a simple, safe prompt that's less likely to trigger safety filters
     * @returns {string} Simple extraction prompt
     */
    buildSimplePrompt() {
        return `Extract invoice data. Find date in DD/MM/YY format. Line prices are excluding tax. Return JSON:
{
  "supplier": "company_name",
  "invoiceNumber": "number", 
  "invoiceDate": "DD/MM/YY_date_from_document",
  "totalAmount": final_total,
  "totalExcludingTax": subtotal_before_tax,
  "taxAmount": tax_amount,
  "lineItems": [{
    "code": "product_code",
    "description": "item_name",
    "quantity": number,
    "unitPrice": price_excluding_tax,
    "totalPrice": line_total_excluding_tax
  }]
}`;
    }

    /**
     * Build prompt for extracting from known supplier invoices
     * @param {string} supplierName - Supplier name hint
     * @returns {string} Extraction prompt
     */
    buildExtractionPrompt(supplierName) {
        const supplierHint = supplierName ? ` This appears to be from ${supplierName}.` : '';

        return `You are an expert invoice data extraction system. I need you to analyze this invoice document and extract the itemized products/services.${supplierHint}

I'm looking at an invoice document. Please help me extract the following:

**STEP 1**: Find the supplier name (usually at the top)
**STEP 2**: Find the invoice number (looks like "IN326587" or similar) 
**STEP 3**: Find the invoice date (may appear as DD/MM/YY format like "17/02/25")
**STEP 4**: Find the main table with products/items

**CRITICAL - READ THE ITEMS TABLE**: 
Look for a table with columns that contain:
- Product codes (like "F-12345-67B", "F-98765-43B", etc.)
- Product descriptions (the main product names)
- Quantities (numbers like 4.5, 2.0, 1.5)
- Unit prices (individual item prices)
- Discount percentages (if any)
- Net prices (final price per line)

**EXAMPLE of what I expect to see**:
If the table shows:
\`\`\`
Code → F-12345-67B | Description → Met & Bunion Protector Sleeve Size L | Qty → 4 units | Unit Price → 300.33 | Net → 900.99
Code → F-98765-43B | Description → Met & Bunion Protector Sleeve Size S | Qty → 2 units | Unit Price → 248.83 | Net → 373.25
\`\`\`

Then extract exactly those 2 items with those exact values.

**STEP 5**: Find the totals (usually bottom right):
- Total before tax (excluding VAT)
- Tax amount (VAT) 
- Final total (including VAT)

**IMPORTANT FOR MEDIS INVOICES**:
- Line item prices are EXCLUDING tax (before VAT)
- The "Net" column shows the line total excluding tax
- VAT is added separately at the bottom

**IMPORTANT RULES**:
✅ Extract ONLY what you can clearly see in the table
✅ Use EXACT quantities and prices as shown
✅ Each table row = one lineItem in your response
✅ Don't make up or calculate values
✅ Look for South African Rand (ZAR/R) currency

Return ONLY a JSON object in this format:
{
  "supplier": "exact_company_name_from_document",
  "invoiceNumber": "exact_invoice_number",
  "invoiceDate": "date_as_written",
  "totalAmount": final_total_including_tax,
  "totalExcludingTax": subtotal_before_tax,
  "taxAmount": tax_amount,
  "currency": "ZAR",
  "lineItems": [
    {
      "code": "product_code_from_table",
      "description": "exact_product_name_from_table", 
      "quantity": exact_quantity_number,
      "unitPrice": exact_unit_price,
      "discountPercent": discount_percent_or_0,
      "netPrice": exact_unit_price,
      "totalPrice": exact_total_for_this_line
    }
  ]
}

Focus on accuracy over speed. Take your time to read each table row carefully.`;
    }

    /**
     * Attempt to fix truncated JSON by closing incomplete structures
     * @param {string} truncatedJson - Truncated JSON string
     * @param {Error} parseError - Original parse error
     * @returns {Object} Parsed data from fixed JSON
     */
    fixTruncatedJson(truncatedJson, parseError) {
        console.log('🔧 Attempting to fix truncated JSON...');
        console.log('Original error:', parseError.message);
        console.log('Truncated JSON length:', truncatedJson.length);
        
        let fixedJson = truncatedJson;
        
        // Common fixes for truncated JSON
        // 1. Fix incomplete string values
        if (fixedJson.endsWith('"')) {
            // Remove trailing incomplete quote
            fixedJson = fixedJson.slice(0, -1);
        }
        
        // 2. Remove incomplete property at the end
        // Look for pattern like: "code": "
        const incompletePropertyMatch = fixedJson.match(/,\s*"[^"]*":\s*"[^"]*$/)
        if (incompletePropertyMatch) {
            fixedJson = fixedJson.substring(0, fixedJson.lastIndexOf(','));
        }
        
        // 3. Close incomplete objects and arrays
        let openBraces = 0;
        let openBrackets = 0;
        let inString = false;
        let escaped = false;
        
        for (let i = 0; i < fixedJson.length; i++) {
            const char = fixedJson[i];
            
            if (escaped) {
                escaped = false;
                continue;
            }
            
            if (char === '\\') {
                escaped = true;
                continue;
            }
            
            if (char === '"') {
                inString = !inString;
                continue;
            }
            
            if (!inString) {
                if (char === '{') openBraces++;
                else if (char === '}') openBraces--;
                else if (char === '[') openBrackets++;
                else if (char === ']') openBrackets--;
            }
        }
        
        // Close open structures
        while (openBrackets > 0) {
            fixedJson += ']';
            openBrackets--;
        }
        while (openBraces > 0) {
            fixedJson += '}';
            openBraces--;
        }
        
        console.log('🔧 Fixed JSON length:', fixedJson.length);
        
        try {
            const parsed = JSON.parse(fixedJson);
            console.log('✅ Successfully fixed truncated JSON!');
            return parsed;
        } catch (error) {
            console.error('❌ Could not fix truncated JSON:', error.message);
            // Return partial data structure that we can work with
            return this.extractPartialData(truncatedJson);
        }
    }
    
    /**
     * Extract whatever data we can from a completely broken JSON
     * @param {string} brokenJson - Unparseable JSON string
     * @returns {Object} Partial data structure
     */
    extractPartialData(brokenJson) {
        console.log('🔍 Extracting partial data from broken JSON...');
        
        const partial = {
            supplier: 'unknown',
            invoiceNumber: null,
            invoiceDate: null,
            totalAmount: 0,
            totalExcludingTax: 0,
            taxAmount: 0,
            currency: 'ZAR',
            lineItems: []
        };
        
        // Extract basic fields using regex
        const supplierMatch = brokenJson.match(/"supplier":\s*"([^"]+)"/);
        if (supplierMatch) partial.supplier = supplierMatch[1];
        
        const invoiceNumberMatch = brokenJson.match(/"invoiceNumber":\s*"([^"]+)"/);
        if (invoiceNumberMatch) partial.invoiceNumber = invoiceNumberMatch[1];
        
        const dateMatch = brokenJson.match(/"invoiceDate":\s*"([^"]+)"/);
        if (dateMatch) partial.invoiceDate = dateMatch[1];
        
        const totalMatch = brokenJson.match(/"totalAmount":\s*([\d.]+)/);
        if (totalMatch) partial.totalAmount = parseFloat(totalMatch[1]);
        
        const totalExclMatch = brokenJson.match(/"totalExcludingTax":\s*([\d.]+)/);
        if (totalExclMatch) partial.totalExcludingTax = parseFloat(totalExclMatch[1]);
        
        const taxMatch = brokenJson.match(/"taxAmount":\s*([\d.]+)/);
        if (taxMatch) partial.taxAmount = parseFloat(taxMatch[1]);
        
        // Try to extract at least the first complete line item
        const lineItemPattern = /\{\s*"code":\s*"([^"]+)",\s*"description":\s*"([^"]+)",\s*"quantity":\s*([\d.]+),\s*"unitPrice":\s*([\d.]+),\s*"discountPercent":\s*([\d.]+),\s*"netPrice":\s*([\d.]+),\s*"totalPrice":\s*([\d.]+)\s*\}/g;
        let match;
        while ((match = lineItemPattern.exec(brokenJson)) !== null) {
            partial.lineItems.push({
                code: match[1],
                description: match[2],
                quantity: parseFloat(match[3]),
                unitPrice: parseFloat(match[4]),
                discountPercent: parseFloat(match[5]),
                netPrice: parseFloat(match[6]),
                totalPrice: parseFloat(match[7]),
                source: 'gemini-vision'
            });
        }
        
        console.log(`🔍 Extracted partial data: ${partial.lineItems.length} line items`);
        return partial;
    }

    /**
     * Parse Gemini Vision API response
     * @param {string} responseText - Raw response text
     * @returns {Object} Parsed invoice data
     */
    parseVisionResponse(responseText) {
        try {
            // Clean the response text
            let cleanText = responseText.trim();
            
            // Remove markdown code block markers
            cleanText = cleanText.replace(/```json\s*|\s*```/g, '');
            cleanText = cleanText.replace(/```\s*|\s*```/g, '');
            
            // Find JSON object in the response
            const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                cleanText = jsonMatch[0];
            }

            // Try to parse the JSON - if it fails due to truncation, attempt to fix it
            let parsed;
            try {
                parsed = JSON.parse(cleanText);
            } catch (parseError) {
                console.warn('⚠️ JSON parsing failed, attempting to fix truncated response...');
                parsed = this.fixTruncatedJson(cleanText, parseError);
            }
            
            // Validate and clean up the response
            if (!parsed.lineItems) {
                parsed.lineItems = [];
            }
            
            // Ensure line items have required fields
            parsed.lineItems = parsed.lineItems.map(item => ({
                code: item.code || null,
                description: item.description || '',
                quantity: parseFloat(item.quantity) || 1,
                unitPrice: parseFloat(item.unitPrice) || 0,
                discountPercent: parseFloat(item.discountPercent) || 0,
                netPrice: parseFloat(item.netPrice) || parseFloat(item.unitPrice) || 0,
                totalPrice: parseFloat(item.totalPrice) || 0,
                source: 'gemini-vision'
            }));

            console.log('✅ Gemini response parsed successfully:', parsed);
            return parsed;

        } catch (error) {
            console.error('❌ Failed to parse Gemini response:', error);
            console.error('Raw response was:', responseText);
            
            // Return minimal fallback data
            return {
                supplier: 'unknown',
                invoiceNumber: null,
                invoiceDate: null,
                totalAmount: 0,
                lineItems: [],
                error: `Parse error: ${error.message}`
            };
        }
    }


    /**
     * Auto-fill training data using AI Vision (for training assistance)
     * @param {File} file - Invoice file
     * @param {string} supplierName - Detected supplier name
     * @returns {Promise<Object>} Pre-filled training data
     */
    async autoFillTrainingData(file, supplierName) {
        if (!this.hasApiKey()) {
            throw new Error('Gemini API key not configured');
        }

        // Ensure we have a working endpoint
        if (!this.apiEndpoint) {
            console.log('🔍 No endpoint configured, discovering models...');
            const testResult = await this.testApiKey();
            if (!testResult.success) {
                throw new Error(`API key test failed: ${testResult.error}`);
            }
        }
        
        try {
            console.log('🤖 Auto-filling training data with AI Vision for:', supplierName);
            
            // Convert file to base64
            const base64Data = await this.convertFileToBase64(file);
            const mimeType = file.type;
            
            // Build training assistance prompt
            const prompt = this.buildTrainingAssistancePrompt(supplierName);
            
            // Make API request
            const response = await fetch(`${this.apiEndpoint}?key=${this.apiKey}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [
                            { text: prompt },
                            {
                                inline_data: {
                                    mime_type: mimeType,
                                    data: base64Data
                                }
                            }
                        ]
                    }],
                    generationConfig: {
                        temperature: 0.1,
                        topK: 1,
                        topP: 0.1,
                        maxOutputTokens: 1500,
                    }
                })
            });
            
            if (!response.ok) {
                throw new Error(`Gemini API error: ${response.status}`);
            }
            
            const result = await response.json();
            const generatedText = result.candidates[0].content.parts[0].text;
            
            // Parse the response
            const trainingData = this.parseTrainingAssistanceResponse(generatedText);
            
            console.log('✨ AI auto-fill completed:', trainingData);
            return trainingData;
            
        } catch (error) {
            console.error('❌ AI training auto-fill failed:', error);
            throw error;
        }
    }

    /**
     * Build prompt for training assistance (auto-fill)
     * @param {string} supplierName - Supplier name
     * @returns {string} Training assistance prompt
     */
    buildTrainingAssistancePrompt(supplierName) {
        return `You are an AI assistant helping to pre-fill invoice training data. Analyze this ${supplierName} invoice and suggest training values that a user can review and correct.

EXTRACT the following information to help pre-fill a training form:

1. Invoice metadata (number, date, totals)
2. First 3-5 line items as examples
3. Invoice format details (currency, tax rate, date format)
4. Price structure (whether prices include tax, if discounts are present)

Return ONLY a JSON object in this format:
{
  "invoiceNumber": "exact_invoice_number",
  "invoiceDate": "exact_date_as_shown",
  "dateFormat": "detected_format_like_DD/MM/YY",
  "totalIncludingTax": number,
  "totalExcludingTax": number,
  "taxRate": number_as_percentage,
  "currency": "currency_code",
  "pricesIncludeTax": true_or_false,
  "hasDiscounts": true_or_false,
  "lineItems": [
    {
      "name": "product_description",
      "quantity": number,
      "unitPrice": number,
      "netPrice": number,
      "discount": number_if_any
    }
  ]
}

IMPORTANT:
- Extract only what you can clearly see
- Include 3-5 representative line items
- Be precise with numbers and formats
- This will be reviewed/corrected by the user`;
    }

    /**
     * Parse training assistance response
     * @param {string} responseText - AI response
     * @returns {Object} Parsed training data
     */
    parseTrainingAssistanceResponse(responseText) {
        try {
            // Clean and parse JSON response
            let cleaned = responseText.trim();
            cleaned = cleaned.replace(/```json\s*|\s*```json|```\s*|\s*```/g, '');
            cleaned = cleaned.replace(/^[^{]*/, ''); // Remove text before first {
            
            // Find JSON object
            const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                cleaned = jsonMatch[0];
            }
            
            const parsed = JSON.parse(cleaned);
            
            // Validate and set defaults
            return {
                invoiceNumber: parsed.invoiceNumber || '',
                invoiceDate: parsed.invoiceDate || '',
                dateFormat: parsed.dateFormat || 'DD/MM/YY',
                totalIncludingTax: parseFloat(parsed.totalIncludingTax) || 0,
                totalExcludingTax: parseFloat(parsed.totalExcludingTax) || 0,
                taxRate: parseFloat(parsed.taxRate) || 15,
                currency: parsed.currency || 'ZAR',
                pricesIncludeTax: parsed.pricesIncludeTax !== false,
                hasDiscounts: parsed.hasDiscounts === true,
                lineItems: (parsed.lineItems || []).map(item => ({
                    name: item.name || '',
                    quantity: parseFloat(item.quantity) || 1,
                    unitPrice: parseFloat(item.unitPrice) || 0,
                    netPrice: parseFloat(item.netPrice) || parseFloat(item.unitPrice) || 0,
                    discount: parseFloat(item.discount) || 0
                }))
            };
            
        } catch (error) {
            console.error('❌ Failed to parse training assistance response:', error);
            // Return empty structure on parse failure
            return {
                invoiceNumber: '',
                invoiceDate: '',
                dateFormat: 'DD/MM/YY',
                totalIncludingTax: 0,
                totalExcludingTax: 0,
                taxRate: 15,
                currency: 'ZAR',
                pricesIncludeTax: true,
                hasDiscounts: false,
                lineItems: []
            };
        }
    }

    /**
     * Get API key setup instructions
     * @returns {Object} Setup instructions
     */
    getApiKeyInstructions() {
        return {
            service: 'Google Gemini',
            steps: [
                '1. Go to https://makersuite.google.com/app/apikey',
                '2. Click "Create API Key"', 
                '3. Copy the API key',
                '4. Paste it in the settings below'
            ],
            limits: 'Free tier: 60 requests per minute, 1000 requests per day',
            cost: 'Free for personal use'
        };
    }
}

// Create global instance
console.log('🚀 Creating aiVisionProcessor instance...');
try {
    const aiVisionProcessor = new AIVisionInvoiceProcessor();
    console.log('✅ aiVisionProcessor instance created successfully');
    
    // Export for use in other modules
    if (typeof module !== 'undefined' && module.exports) {
        console.log('📦 Exporting as module');
        module.exports = AIVisionInvoiceProcessor;
    } else {
        console.log('🌐 Adding to window globals');
        window.AIVisionInvoiceProcessor = AIVisionInvoiceProcessor;
        window.aiVisionProcessor = aiVisionProcessor;
        console.log('✅ aiVisionProcessor added to window:', !!window.aiVisionProcessor);
    }
} catch (error) {
    console.error('❌ Failed to create aiVisionProcessor:', error);
}
