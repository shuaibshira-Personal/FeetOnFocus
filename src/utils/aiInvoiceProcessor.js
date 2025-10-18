/**
 * AI-Powered Invoice Processing using Ollama
 * Handles intelligent line item extraction using local LLM
 */

class AIInvoiceProcessor {
    constructor() {
        this.config = {
            ollamaEndpoint: 'http://localhost:11434',
            model: 'llama3.2:3b',
            timeout: 30000, // 30 seconds
            maxRetries: 2
        };
    }

    /**
     * Check if Ollama service is available
     * @returns {Promise<boolean>} True if Ollama is available
     */
    async isOllamaAvailable() {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            
            const response = await fetch(`${this.config.ollamaEndpoint}/api/tags`, {
                signal: controller.signal,
                headers: { 'Content-Type': 'application/json' }
            });
            
            clearTimeout(timeoutId);
            return response.ok;
        } catch (error) {
            console.log('🤖 Ollama not available:', error.message);
            return false;
        }
    }

    /**
     * Extract line items using AI
     * @param {string} text - Invoice text
     * @param {string} supplierCode - Supplier code for context
     * @param {Object} invoiceMetadata - Invoice metadata for validation
     * @returns {Promise<Array>} Array of extracted line items
     */
    async extractLineItemsWithAI(text, supplierCode, invoiceMetadata = {}) {
        console.log('🤖 Starting AI-powered line item extraction...');
        
        // Store metadata for validation
        this.invoiceMetadata = invoiceMetadata;
        
        if (!await this.isOllamaAvailable()) {
            throw new Error('Ollama service not available');
        }

        const prompt = this.buildExtractionPrompt(text, supplierCode, invoiceMetadata);
        
        for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
            try {
                console.log(`🤖 AI extraction attempt ${attempt}/${this.config.maxRetries}`);
                
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);
                
                const response = await fetch(`${this.config.ollamaEndpoint}/api/generate`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    signal: controller.signal,
                    body: JSON.stringify({
                        model: this.config.model,
                        prompt: prompt,
                        stream: false,
                        options: {
                            temperature: 0.01, // Very low temperature to reduce hallucination
                            top_p: 0.1,       // Very focused sampling
                            repeat_penalty: 1.1,
                            num_predict: 2000  // Limit response length
                        }
                    })
                });

                clearTimeout(timeoutId);

                if (!response.ok) {
                    throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
                }

                const result = await response.json();
                console.log('🤖 Raw AI response:', result.response);

                const lineItems = this.parseAIResponse(result.response);
                console.log(`🤖 AI extracted ${lineItems.length} line items:`, lineItems);
                
                return lineItems;

            } catch (error) {
                console.warn(`🤖 AI extraction attempt ${attempt} failed:`, error.message);
                
                if (attempt === this.config.maxRetries) {
                    throw error;
                }
                
                // Wait before retry
                await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
            }
        }
    }

    /**
     * Build extraction prompt for the AI
     * @param {string} text - Invoice text
     * @param {string} supplierCode - Supplier code
     * @param {Object} invoiceMetadata - Invoice metadata for validation
     * @returns {string} Formatted prompt
     */
    buildExtractionPrompt(text, supplierCode, invoiceMetadata = {}) {
        // Use supplier profile system if available
        if (typeof supplierProfileManager !== 'undefined') {
            return supplierProfileManager.buildAIPrompt(text, supplierCode, invoiceMetadata);
        }
        
        // Fallback to enhanced generic prompt
        return this.buildGenericPrompt(text, supplierCode, invoiceMetadata);
    }
    
    /**
     * Build generic prompt when supplier profile is not available
     */
    buildGenericPrompt(text, supplierCode, invoiceMetadata) {
        return `You are a precise invoice data extractor. Extract ONLY the actual line items that appear in this ${supplierCode.toUpperCase()} invoice.

RULES:
1. Extract ONLY lines that contain product codes, descriptions, quantities, and prices
2. Do NOT make up or duplicate any data
3. Do NOT calculate or invent values
4. Extract exactly what you see in the text
5. Skip headers, footers, addresses, totals, and non-product lines

For each line item, extract:
- code: exact product code (string)
- description: exact product description (string)
- quantity: exact quantity shown (number)
- unitPrice: exact unit price shown (number)
- discountPercent: discount percentage if shown (number, default 0)
- totalPrice: exact total price shown (number)

Look carefully for discount percentages in any "Disc%" or discount columns.

IMPORTANT VALIDATION:
${invoiceMetadata.totalAmount ? `The invoice total is ${invoiceMetadata.totalAmount}. Your extracted line items must add up close to this amount.` : ''}
${invoiceMetadata.invoiceNumber ? `The invoice number is ${invoiceMetadata.invoiceNumber}.` : ''}

Return ONLY a valid JSON array with the actual line items found:

Invoice text:
${text}

JSON array:`;
    }
    
    /**
     * Parse AI response and extract line items
     * @param {string} aiResponse - Raw AI response
     * @returns {Array} Parsed line items
     */
    parseAIResponse(aiResponse) {
        try {
            // Clean the response - remove code blocks, extra text
            let cleanResponse = aiResponse.trim();
            
            // Remove markdown code block markers
            cleanResponse = cleanResponse.replace(/```json\s*|\s*```/g, '');
            cleanResponse = cleanResponse.replace(/```\s*|\s*```/g, '');
            
            // Find JSON array in the response
            const jsonMatch = cleanResponse.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                cleanResponse = jsonMatch[0];
            }

            const lineItems = JSON.parse(cleanResponse);
            
            if (!Array.isArray(lineItems)) {
                throw new Error('AI response is not an array');
            }

            // Validate and clean up the extracted items
            let validatedItems = lineItems.map(item => this.validateLineItem(item)).filter(Boolean);
            
            // Remove duplicates and limit to reasonable number
            validatedItems = this.removeDuplicatesAndLimit(validatedItems);
            
            // Validate total reconciliation
            if (this.invoiceMetadata && this.invoiceMetadata.totalAmount) {
                this.validateTotalReconciliation(validatedItems, this.invoiceMetadata.totalAmount);
            }
            
            return validatedItems;

        } catch (error) {
            console.error('🤖 Failed to parse AI response:', error.message);
            console.error('🤖 Raw response was:', aiResponse);
            
            // Try to extract any JSON-like objects from the response
            return this.fallbackParseResponse(aiResponse);
        }
    }

    /**
     * Validate and standardize a line item
     * @param {Object} item - Raw line item from AI
     * @returns {Object|null} Validated line item or null if invalid
     */
    validateLineItem(item) {
        try {
            if (!item || typeof item !== 'object') {
                return null;
            }

            // Required fields validation
            if (!item.description || item.description.trim() === '') {
                return null;
            }

            const baseUnitPrice = this.parseNumber(item.unitPrice) || 0;    // Unit price excl tax from AI
            
            const validatedItem = {
                originalText: `AI Extracted: ${item.code || 'N/A'} ${item.description}`,
                code: item.code || null,
                description: item.description.trim(),
                quantity: this.parseNumber(item.quantity) || 1,
                unitPrice: 0,                                             // Will be set to tax-inclusive (for cost price mapping)
                unitPriceExclTax: baseUnitPrice,                         // Unit price excluding tax (for display)
                totalPrice: this.parseNumber(item.totalPrice) || 0,
                
                // Additional calculated fields
                subtotal: 0,                                              // Subtotal excluding tax
                discountPercent: this.parseNumber(item.discountPercent) || 0,
                discountAmount: 0,                                        // Discount amount excluding tax
                netTotal: 0,                                              // Net total excluding tax
                netTotalInclTax: 0,                                       // Net total including tax
                taxRate: 15, // Default VAT
                taxAmount: 0,                                             // Tax amount on net total
                unitTaxAmount: 0,                                         // Tax amount per unit
                calculatedTotal: 0,                                       // Final total including tax
                currency: 'ZAR',
                isValid: true,
                validationErrors: [],
                source: 'AI',
                rawValues: item
            };

            // Calculate derived values (all tax calculations)
            const taxMultiplier = (validatedItem.taxRate / 100);
            
            // 1. Calculate subtotal (excl tax) using base price
            validatedItem.subtotal = validatedItem.quantity * validatedItem.unitPriceExclTax;
            
            // 2. Calculate discount amount (excl tax)
            validatedItem.discountAmount = validatedItem.subtotal * (validatedItem.discountPercent / 100);
            
            // 3. Calculate net total (excl tax)
            validatedItem.netTotal = validatedItem.subtotal - validatedItem.discountAmount;
            
            // 4. Calculate tax amounts
            validatedItem.unitTaxAmount = validatedItem.unitPriceExclTax * taxMultiplier;
            validatedItem.taxAmount = validatedItem.netTotal * taxMultiplier;
            
            // 5. Calculate tax-inclusive amounts
            validatedItem.unitPrice = validatedItem.unitPriceExclTax + validatedItem.unitTaxAmount;  // Main unitPrice = incl tax
            validatedItem.netTotalInclTax = validatedItem.netTotal + validatedItem.taxAmount;
            validatedItem.calculatedTotal = validatedItem.netTotalInclTax;

            console.log('🤖 Validated AI item:', validatedItem);
            return validatedItem;

        } catch (error) {
            console.warn('🤖 Failed to validate line item:', error.message, item);
            return null;
        }
    }

    /**
     * Remove duplicates and limit items to prevent AI hallucination
     * @param {Array} items - Validated items
     * @returns {Array} Deduplicated and limited items
     */
    removeDuplicatesAndLimit(items) {
        console.log(`🔍 Removing duplicates from ${items.length} AI items...`);
        
        // Create a map to track unique items by code + description
        const uniqueItems = new Map();
        const maxItems = 20; // Reasonable limit for invoice line items
        
        for (const item of items) {
            if (uniqueItems.size >= maxItems) {
                console.log(`⚠️ Reached maximum item limit (${maxItems}), stopping processing`);
                break;
            }
            
            const key = `${item.code || 'no-code'}-${item.description}`;
            
            if (!uniqueItems.has(key)) {
                // First occurrence - add it
                uniqueItems.set(key, item);
                console.log(`✅ Added unique item: ${item.code} - ${item.description}`);
            } else {
                // Duplicate found
                console.log(`🔄 Skipping duplicate: ${item.code} - ${item.description}`);
                
                // Keep the item with better data (higher quantity or total price)
                const existing = uniqueItems.get(key);
                if (item.totalPrice > existing.totalPrice || (item.quantity > 0 && existing.quantity === 0)) {
                    uniqueItems.set(key, item);
                    console.log(`🔄 Replaced with better data: ${item.code}`);
                }
            }
        }
        
        const result = Array.from(uniqueItems.values());
        console.log(`🎯 Deduplication complete: ${items.length} -> ${result.length} items`);
        
        return result;
    }
    
    /**
     * Validate that extracted line items total matches invoice total
     * @param {Array} items - Validated line items
     * @param {number} expectedTotal - Expected invoice total
     */
    validateTotalReconciliation(items, expectedTotal) {
        const lineItemTotal = items.reduce((sum, item) => {
            return sum + (item.netTotalInclTax || item.calculatedTotal || item.totalPrice || 0);
        }, 0);
        
        const difference = Math.abs(lineItemTotal - expectedTotal);
        const tolerance = Math.max(expectedTotal * 0.05, 10); // 5% tolerance or R10
        
        console.log(`\ud83d\udcca Total reconciliation check:`);
        console.log(`  - Line items total: R${lineItemTotal.toFixed(2)}`);
        console.log(`  - Invoice total: R${expectedTotal.toFixed(2)}`);
        console.log(`  - Difference: R${difference.toFixed(2)}`);
        console.log(`  - Tolerance: R${tolerance.toFixed(2)}`);
        
        if (difference > tolerance) {
            console.warn(`\u26a0\ufe0f Warning: Line items total (R${lineItemTotal.toFixed(2)}) does not match invoice total (R${expectedTotal.toFixed(2)})`);
            console.warn(`\u26a0\ufe0f Difference of R${difference.toFixed(2)} exceeds tolerance of R${tolerance.toFixed(2)}`);
            
            // Add validation warning to items
            items.forEach(item => {
                if (!item.validationErrors) item.validationErrors = [];
                item.validationErrors.push(`Total reconciliation warning: Line items sum to R${lineItemTotal.toFixed(2)} but invoice total is R${expectedTotal.toFixed(2)}`);
            });
        } else {
            console.log(`\u2705 Total reconciliation passed within tolerance`);
        }
    }
    
    /**
     * Parse a number from various formats
     * @param {any} value - Value to parse
     * @returns {number} Parsed number or 0
     */
    parseNumber(value) {
        if (typeof value === 'number') return value;
        if (typeof value === 'string') {
            // Remove currency symbols and spaces
            const cleaned = value.replace(/[R$€£,\s]/g, '');
            const parsed = parseFloat(cleaned);
            return isNaN(parsed) ? 0 : parsed;
        }
        return 0;
    }

    /**
     * Fallback parsing when main JSON parsing fails
     * @param {string} response - AI response
     * @returns {Array} Any line items found
     */
    fallbackParseResponse(response) {
        console.log('🤖 Attempting fallback parsing...');
        
        const lineItems = [];
        const lines = response.split('\n');
        
        for (const line of lines) {
            // Look for JSON-like objects in individual lines
            const jsonMatch = line.match(/\{[^}]+\}/);
            if (jsonMatch) {
                try {
                    const item = JSON.parse(jsonMatch[0]);
                    const validated = this.validateLineItem(item);
                    if (validated) {
                        lineItems.push(validated);
                    }
                } catch (e) {
                    // Ignore parsing errors in fallback
                }
            }
        }
        
        console.log(`🤖 Fallback parsing found ${lineItems.length} items`);
        return lineItems;
    }

    /**
     * Get model information
     * @returns {Promise<Object>} Model info
     */
    async getModelInfo() {
        try {
            const response = await fetch(`${this.config.ollamaEndpoint}/api/show`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: this.config.model })
            });

            if (response.ok) {
                return await response.json();
            }
        } catch (error) {
            console.log('🤖 Could not get model info:', error.message);
        }
        return null;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AIInvoiceProcessor;
} else {
    window.AIInvoiceProcessor = AIInvoiceProcessor;
}