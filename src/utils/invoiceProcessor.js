/**
 * Invoice Processing Utilities
 * Handles text extraction, line item parsing, and product matching for invoice uploads
 */

class InvoiceProcessor {
    constructor() {
        // Initialize AI processor for intelligent line item extraction
        this.aiProcessor = new AIInvoiceProcessor();
        
        // Initialize supplier learning manager
        this.learningManager = new SupplierLearningManager();
        this.learningManager.initialize(this.aiProcessor);
        // Known supplier patterns for different invoice formats
        this.supplierPatterns = {
            'medis': {
                name: 'MEDIS (PTY) LTD',
                identifier: /MEDIS\s*\(PTY\)\s*LTD/i,
                code: 'medis',
                taxRate: 0.15, // 15% VAT
                currency: 'ZAR',
                patterns: {
                    invoiceNumber: /(?:Document No|Invoice\s*Number|IN)\s*:?\s*([A-Z0-9]+)/i,
                    date: /(\d{1,2}\/\d{1,2}\/\d{2,4})/,
                    lineItems: {
                        // Medis format variations:
                        // F-00042-47B    Met & Bunion Protector Sleeve Size L    4.00    x 1    300.33    25.0    R135.1    R900.99
                        // P-PB           Podo Box Size L                          10.00    Each   76.35    0       R114.5   R763.50
                        // Updated pattern to handle variable spacing and 'Each' format better
                        pattern: /^([A-Z0-9-]+)\s+(.+?)\s+(\d+(?:\.\d{2})?)\s+(?:x\s+(\d+)|Each)\s+(\d+(?:\.\d{2})?)\s+(\d+(?:\.\d{0,2}))\s+(?:R(\d+(?:\.\d{1,2})))?\s*R(\d+(?:\.\d{2})?)$/gm,
                        groups: {
                            code: 1,
                            description: 2,
                            quantity: 3,      // 4.00 (actual quantity)
                            unit: 4,          // 1 (unit multiplier) or null for 'Each'
                            unitPrice: 5,     // 300.33 (price per unit)
                            discountPercent: 6, // 25.0 (discount %)
                            netUnitPrice: 7,  // R135.1 (unit price after discount) - optional
                            totalPrice: 8     // R900.99 (total line price)
                        },
                        validation: {
                            // Validation rules to check if parsing makes sense
                            quantityCheck: (q, u) => q > 0 && q <= 10000 && u > 0,
                            priceCheck: (price) => price > 0 && price < 100000,
                            discountCheck: (discount) => discount >= 0 && discount <= 100,
                            totalCheck: (qty, unitPrice, discount, total) => {
                                const expectedSubtotal = qty * unitPrice;
                                const expectedDiscount = expectedSubtotal * (discount / 100);
                                const expectedTotal = expectedSubtotal - expectedDiscount;
                                const tolerance = Math.max(expectedTotal * 0.05, 1); // 5% tolerance or R1
                                return Math.abs(total - expectedTotal) <= tolerance;
                            }
                        }
                    }
                }
            },
            'transpharm': {
                name: 'Transpharm',
                identifier: /transpharm/i,
                code: 'transpharm',
                patterns: {
                    invoiceNumber: /(?:Invoice|Inv)\s*:?\s*([A-Z0-9-]+)/i,
                    date: /(\d{1,2}\/\d{1,2}\/\d{2,4})/,
                    lineItems: {
                        pattern: /^(.+?)\s+(\d+)\s+(\d+(?:\.\d{2})?)\s+(\d+(?:\.\d{2})?)/gm,
                        groups: {
                            description: 1,
                            quantity: 2,
                            unitPrice: 3,
                            totalPrice: 4
                        }
                    }
                }
            }
        };

        // Common product name variations and mappings
        this.productVariations = {
            'bunion': ['hallux valgus', 'bunion pad', 'bunion protector'],
            'orthotic': ['insole', 'arch support', 'foot support'],
            'gel': ['silicone', 'soft gel'],
            'protector': ['pad', 'cushion', 'shield']
        };
    }

    /**
     * Process uploaded invoice file (legacy method - calls processFile)
     * @param {File} file - Invoice file (image or PDF)
     * @param {string} supplierCode - Selected supplier code
     * @returns {Promise<Object>} Processed invoice data
     */
    async processInvoice(file, supplierCode = null) {
        return await this.processFile(file, supplierCode);
    }

    /**
     * Process uploaded invoice file
     * @param {File} file - Invoice file (image or PDF)
     * @param {string} supplierCode - Selected supplier code
     * @returns {Promise<Object>} Processed invoice data
     */
    async processFile(file, supplierCode = null) {
        try {
            // Check which processing method is configured
            const visionAvailable = typeof aiSettingsManager !== 'undefined' && aiSettingsManager.isVisionAvailable();
            
            // Choose processing method
            if (visionAvailable) {
                console.log('🎯 Using Gemini Vision AI processing');
                return await this.processWithVision(file, supplierCode);
            } else {
                console.log('📄 Using text extraction processing');
                return await this.processWithTextExtraction(file, supplierCode);
            }
        } catch (error) {
            console.error('Error processing invoice:', error);
            return {
                success: false,
                error: error.message,
                file: {
                    name: file.name,
                    size: file.size,
                    type: file.type
                }
            };
        }
    }

    /**
     * Process invoice using AI Vision
     * @param {File} file - Invoice file (PDF or image)
     * @param {string} supplierCode - Selected supplier code
     * @returns {Promise<Object>} Processed invoice data
     */
    async processWithVision(file, supplierCode = null) {
        try {
            console.log('🔍 Processing invoice with AI Vision:', file.name);
            
            // Get the vision processor
            const visionProcessor = aiSettingsManager.getProcessor();
            if (!visionProcessor) {
                throw new Error('AI Vision processor not available');
            }
            
            // Process with vision
            const result = await visionProcessor.processInvoiceWithVision(file, supplierCode);
            
            console.log('✅ AI Vision processing complete:', result);
            return result;
            
        } catch (error) {
            console.error('❌ AI Vision processing failed:', error);
            // Fallback to text extraction
            console.log('🔄 Falling back to text extraction...');
            return await this.processWithTextExtraction(file, supplierCode);
        }
    }

    /**
     * Legacy text extraction method
     * @param {File} file - Invoice file (image or PDF)
     * @param {string} supplierCode - Selected supplier code
     * @returns {Promise<Object>} Processed invoice data
     */
    async processInvoiceWithTextExtraction(file, supplierCode = null) {
        try {
            console.log('📝 Processing invoice with text extraction for:', file.name);
            return await this.processWithTextExtraction(file, supplierCode);
            
        } catch (error) {
            console.error('Error processing invoice:', error);
            return {
                success: false,
                error: error.message,
                file: {
                    name: file.name,
                    size: file.size,
                    type: file.type
                }
            };
        }
    }

    /**
     * Extract text from image using Tesseract.js OCR
     * @param {File} file - Image file
     * @returns {Promise<string>} Extracted text
     */
    async extractTextFromImage(file) {
        console.log('🎨 Processing image file:', file.name);
        
        try {
            // Perform OCR using Tesseract.js
            console.log('🔍 Starting OCR recognition...');
            
            const result = await Tesseract.recognize(file, 'eng', {
                logger: (m) => {
                    if (m.status === 'recognizing text') {
                        console.log(`📝 OCR Progress: ${Math.round(m.progress * 100)}%`);
                    }
                }
            });
            
            const extractedText = result.data.text;
            console.log(`✅ OCR complete: ${extractedText.length} characters extracted`);
            console.log('📝 First 200 characters:', extractedText.substring(0, 200));
            
            if (!extractedText.trim()) {
                throw new Error('No text detected in image. Please ensure the image is clear and contains readable text.');
            }
            
            return extractedText.trim();
            
        } catch (error) {
            console.error('❌ Image OCR failed:', error);
            throw new Error(`OCR failed: ${error.message}. Please try a clearer image or different format.`);
        }
    }

    /**
     * Extract text from PDF using PDF.js
     * @param {File} file - PDF file
     * @returns {Promise<string>} Extracted text
     */
    async extractTextFromPDF(file) {
        console.log('📄 Processing PDF file:', file.name);
        
        try {
            // Configure PDF.js worker
            if (typeof pdfjsLib !== 'undefined') {
                pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
            }
            
            // Convert file to ArrayBuffer
            const arrayBuffer = await file.arrayBuffer();
            
            // Load PDF document
            console.log('📖 Loading PDF document...');
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            console.log(`📄 PDF loaded: ${pdf.numPages} pages`);
            
            let fullText = '';
            
            // Extract text from each page
            for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
                console.log(`📝 Extracting text from page ${pageNum}/${pdf.numPages}...`);
                
                const page = await pdf.getPage(pageNum);
                const textContent = await page.getTextContent();
                
                // Combine text items into readable text
                const pageText = textContent.items
                    .map(item => item.str)
                    .join(' ')
                    .replace(/\s+/g, ' ')  // Normalize whitespace
                    .trim();
                
                if (pageText) {
                    fullText += pageText + '\n';
                }
            }
            
            console.log(`✅ PDF text extraction complete: ${fullText.length} characters extracted`);
            console.log('📝 First 200 characters:', fullText.substring(0, 200));
            
            if (!fullText.trim()) {
                throw new Error('No text found in PDF. The PDF might be image-based or encrypted.');
            }
            
            return fullText.trim();
            
        } catch (error) {
            console.error('❌ PDF text extraction failed:', error);
            
            // Fallback: Try to treat as image-based PDF by converting to canvas and using OCR
            console.log('🔄 Attempting OCR fallback for image-based PDF...');
            return await this.extractTextFromImageBasedPDF(file);
        }
    }

    /**
     * Extract text from image-based PDF using OCR fallback
     * @param {File} file - PDF file
     * @returns {Promise<string>} Extracted text
     */
    async extractTextFromImageBasedPDF(file) {
        try {
            console.log('📏 Attempting OCR extraction from image-based PDF...');
            
            // Configure PDF.js worker if not already done
            if (typeof pdfjsLib !== 'undefined') {
                pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
            }
            
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            
            console.log(`📏 Processing ${pdf.numPages} pages for OCR...`);
            let fullText = '';
            
            // Process first page only for now (can be extended for multi-page)
            for (let pageNum = 1; pageNum <= Math.min(pdf.numPages, 3); pageNum++) {
                console.log(`🖼️ Converting PDF page ${pageNum} to image for OCR...`);
                
                const page = await pdf.getPage(pageNum);
                const viewport = page.getViewport({ scale: 2.0 }); // Higher scale for better OCR
                
                // Create canvas
                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');
                canvas.height = viewport.height;
                canvas.width = viewport.width;
                
                // Render PDF page to canvas
                await page.render({ canvasContext: context, viewport: viewport }).promise;
                
                // Convert canvas to blob for Tesseract
                const canvasBlob = await new Promise(resolve => {
                    canvas.toBlob(resolve, 'image/png');
                });
                
                console.log(`🔍 Running OCR on page ${pageNum}...`);
                const result = await Tesseract.recognize(canvasBlob, 'eng', {
                    logger: (m) => {
                        if (m.status === 'recognizing text') {
                            console.log(`📝 OCR Progress (Page ${pageNum}): ${Math.round(m.progress * 100)}%`);
                        }
                    }
                });
                
                const pageText = result.data.text.trim();
                if (pageText) {
                    fullText += pageText + '\n';
                }
            }
            
            console.log(`✅ OCR fallback complete: ${fullText.length} characters extracted`);
            
            if (!fullText.trim()) {
                throw new Error('No text could be extracted from this PDF using OCR.');
            }
            
            return fullText.trim();
            
        } catch (error) {
            console.error('❌ OCR fallback failed:', error);
            throw new Error(`PDF processing failed: ${error.message}. Please try a different file or format.`);
        }
    }

    // Simulated OCR methods removed - now using real PDF.js and Tesseract.js extraction
    
    /**
     * Get Medis invoice simulated OCR text
     * @returns {string} Medis invoice text
     */
    getMedisInvoiceText() {
        return `MEDIS (PTY) LTD
P O BOX 1515
SANLAMHOF
7532

Tax Invoice
Document No: IN326587
Date: 17/02/25

F-00042-47B    Met & Bunion Protector Sleeve Size L    4.00    x 1    300.33    25.0    R135.1    R900.99
F-00042-46B    Met & Bunion Protector Sleeve Size S    2.00    x 1    248.83    25.0    R55.99    R373.25
F-00033-03     Pure Gel Digital Cap 2cm Diameter Size L    1.00    x 6    247.56    25.0    R27.85    R185.67
P-PB           Podo Box Size L                          10.00    Each   76.35    0       R114.5   R763.50

Courier Cost for the delivery of the Podoboxes    R4.50    R30.00

THANK YOU FOR CHOOSING MEDIS
NO 2
Manufacturing flaws - return within 7 days of purchase
Other: Reason for return to be notified
Goods returned for credit to be in

Banking details: Nedbank,
Account number: 1186041056,
Branch code: 118602

Time: 09:30:00    17/02/25    Total nett price: R2223.41
                              Discount: 0.00%
                              Amount excl tax: R1933.31
                              Tax: R290.10
                              TOTAL: R2223.41`;
    }
    
    /**
     * Get Medis invoice test version specifically for Podo Box testing
     * @returns {string} Medis test invoice text
     */
    getMedisInvoiceWithPodoBoxTest() {
        return `MEDIS (PTY) LTD
P O BOX 1515
SANLAMHOF
7532

Tax Invoice
Document No: IN326588-TEST
Date: 18/02/25

P-PB           Podo Box Size L                          10.00    Each   76.35    0       R114.5   R763.50
F-00042-47B    Met & Bunion Protector Sleeve Size L    4.00    x 1    300.33    25.0    R135.1    R900.99

Courier Cost for the delivery of the Podoboxes    R4.50    R30.00

THANK YOU FOR CHOOSING MEDIS
Time: 09:30:00    18/02/25    Total nett price: R1693.49
                              Discount: 0.00%
                              Amount excl tax: R1472.60
                              Tax: R220.89
                              TOTAL: R1693.49`;
    }
    
    /**
     * Get Transpharm invoice simulated OCR text
     * @returns {string} Transpharm invoice text
     */
    getTranspharmInvoiceText() {
        return `TRANSPHARM
123 Medical Street
Johannesburg

Invoice: TP-2025-001
Date: 15/02/25

Orthotics Kit Professional    2    R450.00    R900.00
Silicone Toe Separators      5    R35.00     R175.00
Anti-Fungal Cream 50ml       3    R89.50     R268.50

Subtotal: R1343.50
VAT: R201.53
Total: R1545.03`;
    }
    
    /**
     * Get Temu invoice simulated OCR text
     * @returns {string} Temu invoice text
     */
    getTemuInvoiceText() {
        return `TEMU ORDER
Order #: TM789456123
Date: 12/02/25

Foot Care Kit Bundle         1    $25.99     $25.99
Silicone Insoles Pair        2    $12.50     $25.00
Toe Straightener Set         1    $18.75     $18.75

Subtotal: $69.74
Shipping: $5.99
Total: $75.73`;
    }

    /**
     * Detect supplier from invoice text
     * @param {string} text - Invoice text
     * @returns {string} Detected supplier code
     */
    detectSupplier(text) {
        for (const [code, config] of Object.entries(this.supplierPatterns)) {
            if (config.identifier.test(text)) {
                return code;
            }
        }
        return 'other'; // Default to 'other' if no supplier detected
    }

    /**
     * Parse invoice metadata from text
     * @param {string} text - Invoice text
     * @param {string} supplierCode - Supplier code
     * @returns {Object} Invoice metadata
     */
    async parseInvoiceText(text, supplierCode) {
        // Use supplier profile system if available
        if (typeof supplierProfileManager !== 'undefined') {
            console.log('📋 Using supplier profile system for metadata extraction');
            return supplierProfileManager.extractMetadata(text, supplierCode);
        }
        
        // Fallback to original method
        console.log('📋 Using legacy metadata extraction');
        const config = this.supplierPatterns[supplierCode];
        const invoice = {
            supplierCode: supplierCode,
            invoiceNumber: null,
            date: null,
            totalAmount: null
        };

        if (config) {
            // Extract invoice number - try multiple patterns
            const invoicePatterns = [
                /(?:Document No|Invoice\s*Number|IN)\s*:?\s*([A-Z0-9]+)/i,
                /IN(\d+)/i,  // For patterns like IN326587
                /\b([A-Z]{2}\d{5,})/,  // General pattern for invoice codes
            ];
            
            for (const pattern of invoicePatterns) {
                const match = text.match(pattern);
                if (match && match[1]) {
                    invoice.invoiceNumber = match[1];
                    console.log('\ud83d\udcdd Invoice number extracted:', match[1]);
                    break;
                }
            }
            
            // Extract date - try multiple patterns
            const datePatterns = [
                /(\d{1,2}\/\d{1,2}\/\d{2,4})/,
                /(\d{2}-\d{2}-\d{4})/,
                /(\d{4}-\d{2}-\d{2})/
            ];
            
            for (const pattern of datePatterns) {
                const match = text.match(pattern);
                if (match && match[1]) {
                    invoice.date = this.parseDate(match[1]);
                    console.log('\ud83d\udcc5 Date extracted:', match[1], '-> parsed as:', invoice.date);
                    break;
                }
            }
            
            // Extract total - try multiple patterns
            const totalPatterns = [
                /TOTAL\s*:?\s*R?\s*(\d+(?:\.\d{2})?)/i,
                /Total\s+net\s+price\s*:?\s*R\s*(\d+(?:\.\d{2})?)/i,
                /Total\s+price\s+including\s+tax\s*:?\s*R\s*(\d+(?:\.\d{2})?)/i,
                /Total\s*R\s*(\d+(?:\.\d{2})?)/i,
                /R\s*(\d+(?:\.\d{2})?)\s*$/, // Last R amount in document
            ];
            
            console.log('\ud83d\udcca Looking for total in text...');
            for (const pattern of totalPatterns) {
                const matches = text.match(new RegExp(pattern.source, 'gi'));
                if (matches) {
                    console.log(`\ud83d\udcca Pattern ${pattern.source} found:`, matches);
                    const lastMatch = matches[matches.length - 1];
                    const amountMatch = lastMatch.match(/R?\s*(\d+(?:\.\d{2})?)/i);
                    if (amountMatch) {
                        const amount = this.parseAmount(amountMatch[1]);
                        if (amount > 100) { // Filter out small amounts that aren't likely to be totals
                            invoice.totalAmount = amount;
                            console.log('\ud83d\udcb0 Total amount extracted:', amountMatch[1], '-> parsed as:', amount);
                            break;
                        }
                    }
                }
            }
            
            // If still no total found, try to extract from the end of the document
            if (!invoice.totalAmount) {
                console.log('\ud83d\udd0d Trying to find total at end of document...');
                const endText = text.slice(-500); // Last 500 characters
                const endAmounts = endText.match(/R\s*(\d+(?:\.\d{2})?)/gi);
                if (endAmounts && endAmounts.length > 0) {
                    const largestAmount = endAmounts
                        .map(amt => this.parseAmount(amt.replace(/R\s*/i, '')))
                        .filter(amt => amt > 100)
                        .sort((a, b) => b - a)[0];
                    
                    if (largestAmount) {
                        invoice.totalAmount = largestAmount;
                        console.log('\ud83d\udcb0 Total found from end amounts:', largestAmount);
                    }
                }
            }
        }

        return invoice;
    }

    /**
     * Extract line items from invoice text using AI-first approach
     * @param {string} text - Invoice text
     * @param {string} supplierCode - Supplier code
     * @param {Object} invoiceMetadata - Invoice metadata for AI context
     * @returns {Array} Array of line items
     */
    async extractLineItems(text, supplierCode, invoiceMetadata = null) {
        console.log('🚀 Starting intelligent line item extraction...');
        
        // Try AI extraction first with metadata context
        try {
            console.log('🤖 Attempting AI-powered extraction...');
            const aiItems = await this.aiProcessor.extractLineItemsWithAI(text, supplierCode, invoiceMetadata);
            
            if (aiItems && aiItems.length > 0) {
                console.log(`✅ AI successfully extracted ${aiItems.length} line items`);
                return aiItems;
            } else {
                console.log('⚠️ AI returned no items, falling back to regex...');
            }
        } catch (error) {
            console.log('🚨 AI extraction failed, falling back to regex:', error.message);
        }
        
        // Fallback to original regex-based extraction
        console.log('🔄 Using regex-based extraction as fallback...');
        return this.extractLineItemsWithRegex(text, supplierCode);
    }
    
    /**
     * Extract line items using regex patterns (original method)
     * @param {string} text - Invoice text
     * @param {string} supplierCode - Supplier code
     * @returns {Array} Array of line items
     */
    extractLineItemsWithRegex(text, supplierCode) {
        const config = this.supplierPatterns[supplierCode];
        const lineItems = [];
        
        console.log('🔍 Extracting line items for supplier:', supplierCode);
        console.log('📄 Invoice text length:', text.length);
        console.log('📝 First 500 characters:', text.substring(0, 500));
        console.log('📝 Full text for debugging:', text);
        
        // Look specifically for the Podo Box line
        const podoBoxMatch = text.match(/P-PB.*$/gm);
        if (podoBoxMatch) {
            console.log('🎯 Found Podo Box line(s):', podoBoxMatch);
            podoBoxMatch.forEach((line, index) => {
                console.log(`📏 Podo Box line ${index + 1} length:`, line.length);
                console.log(`📝 Podo Box line ${index + 1} content:`, JSON.stringify(line));
            });
        } else {
            console.log('❌ No Podo Box line found in text');
        }

        if (config && config.patterns.lineItems) {
            const pattern = config.patterns.lineItems.pattern;
            const groups = config.patterns.lineItems.groups;
            console.log('🎯 Using pattern:', pattern.toString());
            
            // Test if our pattern matches the Podo Box line specifically
            if (podoBoxMatch && podoBoxMatch.length > 0) {
                console.log('🧪 Testing regex against Podo Box line...');
                const testPattern = new RegExp(pattern.source, 'gm');
                const podoBoxLine = podoBoxMatch[0];
                const testMatch = testPattern.exec(podoBoxLine);
                if (testMatch) {
                    console.log('✅ Regex matches Podo Box line:', testMatch);
                } else {
                    console.log('❌ Regex does NOT match Podo Box line');
                    console.log('🔍 Trying to debug why...');
                    // Break down the line to see what each part looks like
                    const parts = podoBoxLine.split(/\s+/);
                    console.log('📊 Line parts:', parts);
                }
            }
            
            let matchCount = 0;

            // Reset regex
            pattern.lastIndex = 0;
            
            // Debug: Show what we're looking for
            console.log('🔎 Debugging regex pattern:', pattern.toString());
            
            // Split text into lines to see structure
            const textLines = text.split('\n');
            console.log('📋 Total lines in text:', textLines.length);
            console.log('📋 Lines containing product codes:');
            textLines.forEach((line, index) => {
                if (line.match(/^[A-Z0-9-]+\s/)) {
                    console.log(`  Line ${index + 1}: ${JSON.stringify(line)}`);
                }
            });
            
            // Try the main pattern first
            let matches = [];
            let match;
            while ((match = pattern.exec(text)) !== null) {
                matches.push({ match, source: 'main' });
            }
            
            console.log(`📊 Main pattern matched ${matches.length} items`);
            matches.forEach((m, i) => {
                console.log(`  Match ${i + 1}:`, JSON.stringify(m.match[0]));
            });
            
            // If we didn't catch the Podo Box line, try a fallback pattern for 'Each' format
            if (!matches.some(m => m.match[0].includes('P-PB'))) {
                console.log('🔄 Podo Box not found with main pattern, trying fallback...');
                console.log('📝 Podo Box line to match:', JSON.stringify(podoBoxMatch[0]));
                
                // More flexible patterns for Medis format based on actual console logs
                const fallbackPatterns = [
                    // Pattern 1: Handle 'x 1' format (F-00042-47B Met & Bunion... 4.00 x 1 300.33 25.0 0 R135.1 5 R900.99)
                    /^([A-Z0-9-]+)\s+(.+?)\s+(\d+(?:\.\d{2})?)\s+x\s+(\d+)\s+(\d+(?:\.\d{2})?)\s+(\d+(?:\.\d{0,2}))\s+\d+\s+R(\d+(?:\.\d{1,2}))\s+\d+\s+R(\d+(?:\.\d{2})?)$/gm,
                    // Pattern 2: Handle 'Each' format (P-PB Podo Box 10.00 Each 76.35 R114.5 3 R763.50)
                    /^([A-Z0-9-]+)\s+(.+?)\s+(\d+(?:\.\d{2})?)\s+Each\s+(\d+(?:\.\d{2})?)\s+R(\d+(?:\.\d{1,2}))\s+\d+\s+R(\d+(?:\.\d{2})?)$/gm,
                    // Pattern 3: More flexible spacing for 'Each'
                    /^([A-Z0-9-]+)\s+(.+?)\s+(\d+(?:\.\d{2})?)\s+Each\s+(\d+(?:\.\d{2})?)\s+(?:R)?(\d+(?:\.\d{1,2}))\s*(?:\d+\s+)?R(\d+(?:\.\d{2})?)$/gm,
                    // Pattern 4: Generic pattern as last resort
                    /^([A-Z0-9-]+)\s+(.+?)\s+(\d+(?:\.\d{2})?)\s+(?:x\s*\d+|Each)\s+(.+?)R(\d+(?:\.\d{2})?)$/gm
                ];
                
                // Test the fallback pattern step by step
                console.log('🧪 Testing fallback pattern...');
                const testLine = podoBoxMatch[0];
                console.log('📊 Step 1 - Code match:', testLine.match(/^([A-Z0-9-]+)/));
                console.log('📊 Step 2 - Each position:', testLine.indexOf('Each'));
                console.log('📊 Step 3 - R positions:', testLine.match(/R\d+/g));
                
                // Try each fallback pattern
                let fallbackFound = false;
                for (let i = 0; i < fallbackPatterns.length && !fallbackFound; i++) {
                    console.log(`🔄 Trying fallback pattern ${i + 1}...`);
                    const currentPattern = fallbackPatterns[i];
                    currentPattern.lastIndex = 0; // Reset pattern
                    
                    let fallbackMatch;
                    while ((fallbackMatch = currentPattern.exec(text)) !== null) {
                        console.log(`✅ Fallback pattern ${i + 1} matched:`, fallbackMatch[0]);
                        
                        // Adjust match groups based on pattern type
                        let adjustedMatch;
                        if (i === 0) { // Pattern 1: x format with unit multiplier
                            adjustedMatch = [fallbackMatch[0], fallbackMatch[1], fallbackMatch[2], fallbackMatch[3], fallbackMatch[4], fallbackMatch[5], fallbackMatch[6], fallbackMatch[7], fallbackMatch[8]];
                        } else if (i === 1 || i === 2) { // Pattern 2 & 3: Each format
                            // Insert null/1 for unit group since 'Each' means unit = 1
                            adjustedMatch = [fallbackMatch[0], fallbackMatch[1], fallbackMatch[2], fallbackMatch[3], '1', fallbackMatch[4], '0', fallbackMatch[5], fallbackMatch[6]];
                        } else { // Pattern 4: Generic
                            adjustedMatch = [fallbackMatch[0], fallbackMatch[1], fallbackMatch[2], fallbackMatch[3], '1', '0', '0', '0', fallbackMatch[5]];
                        }
                        
                        adjustedMatch.index = fallbackMatch.index;
                        adjustedMatch.input = fallbackMatch.input;
                        matches.push({ match: adjustedMatch, source: `fallback-${i + 1}` });
                        fallbackFound = true;
                    }
                }
                
                if (!fallbackFound) {
                    console.log('❌ All fallback patterns failed. Trying manual parsing...');
                    // Manual parsing as last resort
                    if (podoBoxMatch && podoBoxMatch.length > 0) {
                        const line = podoBoxMatch[0];
                        const parts = line.split(/\s+/);
                        console.log('🔧 Manual parse parts:', parts);
                        
                        if (parts.length >= 8 && parts.includes('Each')) {
                            const eachIndex = parts.indexOf('Each');
                            const code = parts[0]; // P-PB
                            const description = parts.slice(1, eachIndex - 1).join(' '); // Podo Box Size L
                            const quantity = parts[eachIndex - 1]; // 10.00
                            const unitPrice = parts[eachIndex + 1]; // 76.35
                            const discount = parts[eachIndex + 2]; // 0
                            const netPrice = parts[eachIndex + 3]?.replace('R', ''); // 114.5
                            const total = parts[eachIndex + 4]?.replace('R', ''); // 763.50
                            
                            if (code && description && quantity && unitPrice && total) {
                                const manualMatch = [line, code, description, quantity, null, unitPrice, discount, netPrice, total];
                                matches.push({ match: manualMatch, source: 'manual' });
                                console.log('✅ Manual parsing successful:', manualMatch);
                            }
                        }
                    }
                }
            }
            
            // Process all matches
            for (const { match, source } of matches) {
                console.log(`\u2705 Processing ${source} match:`, match[0]);
                matchCount++;
                console.log('\ud83d\udcca Raw match groups:', match);
                
                // Extract raw values
                const rawValues = {
                    code: groups.code ? match[groups.code]?.trim() : null,
                    description: groups.description ? match[groups.description]?.trim() : '',
                    quantity: groups.quantity ? parseFloat(match[groups.quantity]) : 1,
                    // Handle 'Each' format: if unit group is undefined/null, it means 'Each' was matched, so unit = 1
                    unit: groups.unit && match[groups.unit] ? parseInt(match[groups.unit]) : 1,
                    unitPrice: groups.unitPrice ? this.parseAmount(match[groups.unitPrice]) : 0,
                    discountPercent: groups.discountPercent ? parseFloat(match[groups.discountPercent]) : 0,
                    netUnitPrice: groups.netUnitPrice ? this.parseAmount(match[groups.netUnitPrice]) : 0,
                    totalPrice: groups.totalPrice ? this.parseAmount(match[groups.totalPrice]) : 0
                };
                
                // Debug the unit extraction
                console.log('🔧 Unit extraction debug:', {
                    'groups.unit': groups.unit,
                    'match[groups.unit]': match[groups.unit],
                    'full match': match[0],
                    'calculated unit': rawValues.unit
                });
                
                console.log('📋 Raw extracted values:', rawValues);
                
                // Apply validation if available
                const validation = config.patterns.lineItems.validation;
                let isValid = true;
                const validationErrors = [];
                
                if (validation) {
                    // Check quantity and unit
                    if (validation.quantityCheck && !validation.quantityCheck(rawValues.quantity, rawValues.unit)) {
                        validationErrors.push('Invalid quantity or unit values');
                        isValid = false;
                    }
                    
                    // Check price reasonableness
                    if (validation.priceCheck && !validation.priceCheck(rawValues.unitPrice)) {
                        validationErrors.push('Unit price seems unreasonable');
                        isValid = false;
                    }
                    
                    // Check discount
                    if (validation.discountCheck && !validation.discountCheck(rawValues.discountPercent)) {
                        validationErrors.push('Discount percentage seems invalid');
                        isValid = false;
                    }
                    
                    // Check total calculation
                    if (validation.totalCheck && !validation.totalCheck(
                        rawValues.quantity, rawValues.unitPrice, rawValues.discountPercent, rawValues.totalPrice
                    )) {
                        validationErrors.push('Total price doesn\'t match expected calculation');
                        // Don't mark as invalid for total mismatch, just warn
                        console.warn('⚠️ Total validation failed but continuing');
                    }
                }
                
                // Calculate derived values
                const actualQuantity = rawValues.quantity * rawValues.unit;
                const subtotal = actualQuantity * rawValues.unitPrice;
                const discountAmount = subtotal * (rawValues.discountPercent / 100);
                const netTotal = subtotal - discountAmount;
                const taxAmount = netTotal * (config.taxRate || 0.15);
                
                const item = {
                    originalText: match[0],
                    code: rawValues.code,
                    description: rawValues.description,
                    quantity: actualQuantity, // Total quantity (qty * unit)
                    unitPrice: rawValues.unitPrice,
                    subtotal: subtotal,
                    discountPercent: rawValues.discountPercent,
                    discountAmount: discountAmount,
                    netTotal: netTotal,
                    taxRate: (config.taxRate || 0.15) * 100, // Convert to percentage
                    taxAmount: taxAmount,
                    totalPrice: rawValues.totalPrice, // As reported on invoice
                    calculatedTotal: netTotal, // Our calculated total
                    currency: config.currency || 'ZAR',
                    isValid: isValid,
                    validationErrors: validationErrors,
                    rawValues: rawValues // Keep raw values for debugging
                };
                
                console.log('📦 Final processed item:', item);
                
                if (validationErrors.length > 0) {
                    console.warn('⚠️ Validation warnings for item:', validationErrors);
                }
                
                lineItems.push(item);
            }
            
            console.log(`🔢 Found ${lineItems.length} structured line items`);
        }

        // If no structured parsing worked, try generic line item extraction
        if (lineItems.length === 0) {
            console.log('⚠️ No structured matches, trying generic extraction');
            return this.extractGenericLineItems(text);
        }

        return lineItems;
    }

    /**
     * Extract line items using generic patterns
     * @param {string} text - Invoice text
     * @returns {Array} Array of line items
     */
    extractGenericLineItems(text) {
        const lines = text.split('\n');
        const lineItems = [];
        
        console.log('🔍 Generic extraction from', lines.length, 'lines');
        
        // Look for lines that contain price patterns
        const pricePattern = /\bR?\d+(?:\.\d{2})?\b/g;
        const medisLinePattern = /^([A-Z0-9-]+)\s+(.+?)\s+(\d+(?:\.\d{2})?)\s+(?:x\s*)?(\d+)\s+(.+)$/i;
        
        for (let i = 0; i < lines.length; i++) {
            const trimmedLine = lines[i].trim();
            
            // Skip empty lines and short lines
            if (!trimmedLine || trimmedLine.length < 15) continue;
            
            console.log(`🔎 Line ${i + 1}:`, trimmedLine);
            
            // Try Medis-specific pattern first
            const medisMatch = trimmedLine.match(medisLinePattern);
            if (medisMatch) {
                console.log('✅ Medis pattern match:', medisMatch);
                
                const prices = medisMatch[5].match(pricePattern) || [];
                const lastPrice = prices.length > 0 ? prices[prices.length - 1] : '0';
                
                const item = {
                    originalText: trimmedLine,
                    code: medisMatch[1],
                    description: medisMatch[2].trim(),
                    unitPrice: this.parseAmount(medisMatch[3]),
                    quantity: parseInt(medisMatch[4]) || 1,
                    totalPrice: this.parseAmount(lastPrice)
                };
                
                // Calculate total if not found
                if (!item.totalPrice && item.unitPrice && item.quantity) {
                    item.totalPrice = item.unitPrice * item.quantity;
                }
                
                console.log('📦 Medis item extracted:', item);
                lineItems.push(item);
                continue;
            }
            
            // Look for lines with multiple prices (general pattern)
            const prices = trimmedLine.match(pricePattern);
            if (prices && prices.length >= 2) {
                console.log('💰 Found line with prices:', prices);
                
                const quantityMatch = trimmedLine.match(/(\d+)\s*(?:x\s*\d+|Each)/i);
                const description = this.extractDescription(trimmedLine);
                const code = this.extractProductCode(trimmedLine);
                
                if (description && description.length > 3) {
                    const item = {
                        originalText: trimmedLine,
                        code: code,
                        description: description,
                        quantity: quantityMatch ? parseInt(quantityMatch[1]) : 1,
                        unitPrice: this.parseAmount(prices[0]),
                        totalPrice: this.parseAmount(prices[prices.length - 1])
                    };
                    
                    console.log('📦 Generic item extracted:', item);
                    lineItems.push(item);
                }
            }
        }
        
        console.log(`🔢 Generic extraction found ${lineItems.length} items`);
        return lineItems;
    }

    /**
     * Extract product description from line
     * @param {string} line - Text line
     * @returns {string} Product description
     */
    extractDescription(line) {
        // Remove price patterns and codes to get description
        let description = line
            .replace(/^[A-Z0-9-]+\s+/, '') // Remove leading product code
            .replace(/\bR?\d+(?:\.\d{2})?\b/g, '') // Remove prices (including R prefix)
            .replace(/\b\d+\s*(?:x\s*\d+|Each)\b/gi, '') // Remove quantity patterns
            .replace(/\s+(?:25\.0|0)\s+/g, ' ') // Remove discount percentages
            .replace(/\s+/g, ' ') // Normalize spaces
            .trim();

        return description;
    }

    /**
     * Extract product code from line
     * @param {string} line - Text line
     * @returns {string|null} Product code
     */
    extractProductCode(line) {
        const codeMatch = line.match(/\b([A-Z0-9-]{3,15})\b/);
        return codeMatch ? codeMatch[1] : null;
    }

    /**
     * Match line items with existing products in database
     * @param {Array} lineItems - Array of line items
     * @returns {Promise<Array>} Array of matched items
     */
    async matchProductsWithDatabase(lineItems) {
        const matchedItems = [];

        for (const item of lineItems) {
            const matchedItem = {
                ...item,
                matchedProduct: null,
                matchScore: 0,
                suggestions: [],
                isNewProduct: false
            };

            // Try to find exact match by code/SKU
            if (item.code) {
                try {
                    const exactMatch = await inventoryDB.getItemBySKU(item.code);
                    if (exactMatch) {
                        matchedItem.matchedProduct = exactMatch;
                        matchedItem.matchScore = 1.0;
                        matchedItems.push(matchedItem);
                        continue;
                    }
                } catch (error) {
                    console.error('Error searching by SKU:', error);
                }
            }

            // Try to find matches by description
            try {
                const suggestions = await this.searchProductsByDescription(item.description);
                matchedItem.suggestions = suggestions;
                
                if (suggestions.length > 0) {
                    // Use the best match as the matched product
                    matchedItem.matchedProduct = suggestions[0].product;
                    matchedItem.matchScore = suggestions[0].score;
                } else {
                    // No matches found - mark as new product
                    matchedItem.isNewProduct = true;
                }
            } catch (error) {
                console.error('Error searching products:', error);
                matchedItem.isNewProduct = true;
            }

            matchedItems.push(matchedItem);
        }

        return matchedItems;
    }

    /**
     * Search products by description using fuzzy matching
     * @param {string} description - Product description
     * @returns {Promise<Array>} Array of matching products with scores
     */
    async searchProductsByDescription(description) {
        try {
            const allItems = await inventoryDB.getAllItems();
            const suggestions = [];

            const searchTerms = this.extractSearchTerms(description);

            for (const item of allItems) {
                const score = this.calculateMatchScore(searchTerms, item);
                
                if (score > 0.3) { // Only include items with reasonable match
                    suggestions.push({
                        product: item,
                        score: score
                    });
                }
            }

            // Sort by score descending
            suggestions.sort((a, b) => b.score - a.score);
            
            // Return top 5 suggestions
            return suggestions.slice(0, 5);
        } catch (error) {
            console.error('Error searching products by description:', error);
            return [];
        }
    }

    /**
     * Extract search terms from description
     * @param {string} description - Product description
     * @returns {Array} Array of search terms
     */
    extractSearchTerms(description) {
        if (!description) return [];
        
        return description
            .toLowerCase()
            .replace(/[^\w\s]/g, ' ') // Remove punctuation
            .split(/\s+/)
            .filter(term => term.length > 2) // Remove short terms
            .filter(term => !['the', 'and', 'for', 'with', 'size'].includes(term)); // Remove common words
    }

    /**
     * Calculate match score between search terms and product
     * @param {Array} searchTerms - Array of search terms
     * @param {Object} product - Product object
     * @returns {number} Match score between 0 and 1
     */
    calculateMatchScore(searchTerms, product) {
        if (!searchTerms.length) return 0;

        const productText = [
            product.name,
            product.description || '',
            product.listingName || '',
            ...(product.alternativeNames || [])
        ].join(' ').toLowerCase();

        let matchCount = 0;
        let totalTerms = searchTerms.length;

        for (const term of searchTerms) {
            if (productText.includes(term)) {
                matchCount++;
            } else {
                // Check for variations
                for (const [key, variations] of Object.entries(this.productVariations)) {
                    if (term.includes(key) || variations.some(v => term.includes(v))) {
                        if (productText.includes(key) || variations.some(v => productText.includes(v))) {
                            matchCount += 0.8; // Partial match for variations
                            break;
                        }
                    }
                }
            }
        }

        return Math.min(matchCount / totalTerms, 1.0);
    }

    /**
     * Parse amount string to number
     * @param {string} amountStr - Amount string
     * @returns {number} Parsed amount
     */
    parseAmount(amountStr) {
        if (!amountStr) return 0;
        
        // Remove currency symbols and whitespace
        const cleanStr = amountStr.toString()
            .replace(/[R$€£¥₹]/g, '')
            .replace(/\s/g, '')
            .replace(/,/g, '');
            
        const amount = parseFloat(cleanStr);
        return isNaN(amount) ? 0 : amount;
    }

    /**
     * Parse date string
     * @param {string} dateStr - Date string
     * @returns {string} ISO date string
     */
    parseDate(dateStr) {
        try {
            // Handle different date formats
            const parts = dateStr.split('/');
            if (parts.length === 3) {
                let day, month, year;
                
                // Assume DD/MM/YY or DD/MM/YYYY format
                day = parts[0];
                month = parts[1];
                year = parts[2];
                
                // Convert 2-digit year to 4-digit
                if (year.length === 2) {
                    year = '20' + year;
                }
                
                const date = new Date(year, month - 1, day);
                return date.toISOString().split('T')[0]; // Return YYYY-MM-DD format
            }
        } catch (error) {
            console.error('Error parsing date:', error);
        }
        
        return new Date().toISOString().split('T')[0]; // Return today's date as fallback
    }

    /**
     * Handle new supplier training workflow
     * @param {string} supplierName - Supplier name
     * @param {string} invoiceText - Invoice text
     * @param {File} file - Original file
     * @returns {Object} Training initiation response
     */
    async handleNewSupplierTraining(supplierName, invoiceText, file) {
        console.log(`🎓 Initiating training for new supplier: ${supplierName}`);
        
        // Start training session
        const trainingSession = this.learningManager.startTraining(supplierName, invoiceText);
        
        return {
            success: true,
            needsTraining: true,
            supplier: supplierName,
            trainingSession: trainingSession,
            file: {
                name: file.name,
                size: file.size,
                type: file.type
            },
            rawText: invoiceText,
            message: `New supplier "${supplierName}" detected. Please provide training data to enable automatic processing.`
        };
    }

    /**
     * Complete supplier training and process the invoice
     * @param {string} supplierName - Supplier name
     * @param {Object} annotations - User training annotations
     * @param {string} invoiceText - Invoice text
     * @param {File} file - Original file
     * @returns {Object} Processing result
     */
    async completeTraining(supplierName, annotations, invoiceText, file) {
        console.log(`🎓 Completing training for: ${supplierName}`);
        
        try {
            // Process the training
            const trainingResult = await this.learningManager.processAnnotations(annotations);
            
            if (!trainingResult.success) {
                return {
                    success: false,
                    error: trainingResult.error || 'Training failed',
                    trainingErrors: trainingResult.errors
                };
            }

            // Now process the invoice using the new algorithm
            const extractedData = await this.learningManager.applyAlgorithm(supplierName, invoiceText);
            
            // Match products with existing database
            const matchedItems = await this.matchProductsWithDatabase(extractedData.lineItems);
            
            return {
                success: true,
                trainingCompleted: true,
                file: {
                    name: file.name,
                    size: file.size,
                    type: file.type
                },
                supplier: supplierName,
                invoice: {
                    ...extractedData.metadata,
                    supplier: supplierName,
                    processingMethod: 'Learned Algorithm',
                    algorithmVersion: extractedData.algorithmVersion
                },
                lineItems: matchedItems,
                rawText: invoiceText,
                trainingResult: trainingResult
            };
            
        } catch (error) {
            console.error('❌ Training completion failed:', error);
            return {
                success: false,
                error: `Training completion failed: ${error.message}`
            };
        }
    }

    /**
     * Prompt user for supplier name if not detected
     * @param {string} text - Invoice text
     * @returns {string} Supplier name
     */
    promptForSupplierName(text) {
        // Extract potential supplier names from text
        const lines = text.split('\n').slice(0, 10); // Look in first 10 lines
        const potentialSuppliers = [];
        
        lines.forEach(line => {
            const trimmed = line.trim();
            if (trimmed.length > 3 && trimmed.length < 50 && 
                /^[A-Za-z]/.test(trimmed) && 
                !/^(Invoice|Date|Total|Amount|Quantity|Description)/i.test(trimmed)) {
                potentialSuppliers.push(trimmed);
            }
        });

        // Return the first potential supplier or ask user to provide
        if (potentialSuppliers.length > 0) {
            console.log('🔍 Potential supplier names found:', potentialSuppliers);
            return potentialSuppliers[0]; // Use first found
        }
        
        // Fallback to asking the user (this would be handled in UI)
        return 'Unknown Supplier';
    }

    /**
     * Get learning manager instance (for UI access)
     * @returns {SupplierLearningManager} Learning manager
     */
    getLearningManager() {
        return this.learningManager;
    }

    /**
     * Get trained suppliers list
     * @returns {Array} List of trained suppliers
     */
    getTrainedSuppliers() {
        return this.learningManager.getTrainedSuppliers();
    }

    /**
     * Process invoice using Vision AI
     * @param {File} file - Invoice file
     * @param {string} supplierCode - Selected supplier code
     * @returns {Promise<Object>} Processed invoice data
     */
    async processWithVision(file, supplierCode = null) {
        try {
            console.log('👁️ Processing with Gemini Vision AI:', file.name);
            
            // Use vision processor to analyze the file directly
            const visionResult = await aiVisionProcessor.processInvoiceWithVision(file, supplierCode);
            
            if (visionResult.success) {
                // Convert vision result to standard format
                const standardResult = {
                    success: true,
                    method: 'gemini-vision',
                    file: {
                        name: file.name,
                        size: file.size,
                        type: file.type
                    },
                    supplier: visionResult.supplier,
                    invoice: visionResult.invoice,
                    lineItems: visionResult.lineItems.map(item => {
                        // Vision AI extracts prices as excluding tax
                        const unitPriceExclTax = item.unitPrice || 0;
                        const quantity = item.quantity || 1;
                        const discountPercent = item.discountPercent || 0;
                        
                        // Calculate discounted price
                        const unitPriceAfterDiscount = unitPriceExclTax * (1 - discountPercent / 100);
                        
                        // Calculate tax (15% VAT for South Africa)
                        const taxRate = 15;
                        const unitPriceInclTax = unitPriceAfterDiscount * (1 + taxRate / 100);
                        
                        // Calculate line totals
                        const netTotalExclTax = unitPriceAfterDiscount * quantity;
                        const taxAmount = netTotalExclTax * (taxRate / 100);
                        const netTotalInclTax = netTotalExclTax + taxAmount;
                        
                        return {
                            ...item,
                            // Properly mapped fields for UI
                            unitPriceExclTax: unitPriceExclTax,
                            unitPriceInclTax: unitPriceInclTax,
                            unitPrice: unitPriceInclTax, // UI expects this as including tax
                            netTotal: netTotalExclTax,
                            netTotalInclTax: netTotalInclTax,
                            calculatedTotal: netTotalInclTax,
                            taxRate: taxRate,
                            taxAmount: taxAmount,
                            discountAmount: (unitPriceExclTax - unitPriceAfterDiscount) * quantity,
                            subtotal: unitPriceExclTax * quantity,
                            // Fields expected by the UI
                            matchScore: 1.0, // Vision AI items are considered perfect matches
                            isNewProduct: true, // Will be determined later during product matching
                            source: 'Gemini Vision',
                            validationErrors: [],
                            isValid: true
                        };
                    }),
                    rawResponse: visionResult.rawResponse,
                    rawText: `Vision AI Analysis:\n${visionResult.rawResponse}` // For compatibility
                };
                
                // Match products with existing database
                standardResult.lineItems = await this.matchProductsWithDatabase(standardResult.lineItems);
                
                console.log('✅ Vision AI processing complete:', standardResult.lineItems.length, 'items found');
                return standardResult;
            } else {
                throw new Error('Vision AI processing failed');
            }
            
        } catch (error) {
            console.error('❌ Vision AI processing failed:', error);
            
            // If Vision AI fails, fall back to text extraction
            console.log('🔄 Falling back to text extraction...');
            return await this.processWithTextExtraction(file, supplierCode);
        }
    }

    /**
     * Process invoice using text extraction (original method)
     * @param {File} file - Invoice file
     * @param {string} supplierCode - Selected supplier code
     * @returns {Promise<Object>} Processed invoice data
     */
    async processWithTextExtraction(file, supplierCode = null) {
        let text = '';
        
        if (file.type.startsWith('image/')) {
            text = await this.extractTextFromImage(file);
        } else if (file.type === 'application/pdf') {
            text = await this.extractTextFromPDF(file);
        } else {
            throw new Error('Unsupported file type. Please upload an image or PDF file.');
        }

        // Detect supplier using profile system if available
        const detectedSupplier = supplierCode || 
            (typeof supplierProfileManager !== 'undefined' ? 
                supplierProfileManager.detectSupplier(text) : 
                this.detectSupplier(text)) || this.promptForSupplierName(text);
        
        // Check if supplier needs training
        if (this.learningManager.needsTraining(detectedSupplier)) {
            console.log(`🎓 New supplier detected: ${detectedSupplier}. Training required.`);
            return this.handleNewSupplierTraining(detectedSupplier, text, file);
        }
        
        // Use learned algorithm or fallback to profiles
        let invoiceData, lineItems;
        try {
            // Try using learned algorithm first
            const extractedData = await this.learningManager.applyAlgorithm(detectedSupplier, text);
            invoiceData = extractedData.metadata;
            lineItems = extractedData.lineItems.map(item => ({
                ...item,
                description: item.description || item.name,
                source: 'Learned Algorithm'
            }));
            console.log(`✅ Used learned algorithm for ${detectedSupplier}`);
        } catch (error) {
            console.log(`⚠️ Learned algorithm failed for ${detectedSupplier}, falling back to profiles:`, error.message);
            // Fallback to traditional parsing
            invoiceData = await this.parseInvoiceText(text, detectedSupplier);
            lineItems = await this.extractLineItems(text, detectedSupplier, invoiceData);
        }
        
        // Match products with existing database
        const matchedItems = await this.matchProductsWithDatabase(lineItems);
        
        return {
            success: true,
            method: 'text-extraction',
            file: {
                name: file.name,
                size: file.size,
                type: file.type
            },
            supplier: detectedSupplier,
            invoice: invoiceData,
            lineItems: matchedItems,
            rawText: text
        };
    }
}

// Create global instance
const invoiceProcessor = new InvoiceProcessor();