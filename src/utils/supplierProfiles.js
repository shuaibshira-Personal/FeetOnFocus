/**
 * Supplier Profile System
 * Manages supplier-specific invoice parsing configurations
 */

class SupplierProfileManager {
    constructor() {
        this.profiles = this.initializeProfiles();
    }

    /**
     * Initialize supplier profiles with specific parsing configurations
     */
    initializeProfiles() {
        return {
            'medis': {
                name: 'MEDIS (PTY) LTD',
                code: 'medis',
                identifier: /MEDIS\s*\(PTY\)\s*LTD/i,
                
                // Invoice metadata extraction patterns
                metadata: {
                    invoiceNumber: {
                        patterns: [
                            /Document\s+No\s*:?\s*(IN\d+)/i,
                            /Invoice\s*(?:Number|No)?\s*:?\s*(IN\d+)/i,
                            /\b(IN\d{5,})\b/i
                        ],
                        location: 'top-right',
                        description: 'Look for "Document No: IN326587" in top-right area'
                    },
                    date: {
                        patterns: [
                            /(\d{1,2}\/\d{1,2}\/\d{2,4})/,
                            /Date\s*:?\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i
                        ],
                        format: 'DD/MM/YY',
                        location: 'header',
                        description: 'Date format is DD/MM/YY, usually near invoice number'
                    },
                    total: {
                        patterns: [
                            /TOTAL\s*:?\s*R\s*(\d+(?:\.\d{2})?)/i,
                            /Total\s+net\s+price\s*:?\s*R\s*(\d+(?:\.\d{2})?)/i,
                            /Total\s+price\s+including\s+tax\s*:?\s*R\s*(\d+(?:\.\d{2})?)/i
                        ],
                        location: 'bottom-right',
                        description: 'Final total including tax at bottom of invoice'
                    }
                },
                
                // Line item extraction configuration
                lineItems: {
                    // Table structure based on the actual Medis invoice
                    tableHeaders: ['Code', 'Description', 'Quantity', 'Unit', 'Unit price', 'Disc%', 'Tax', 'Nett price'],
                    
                    // Enhanced pattern for Medis line items
                    patterns: [
                        {
                            // Standard format: F-00042-47B Met & Bunion Protector Sleeve Size L 4.00 x 1 300.33 25.0 R135.1 R900.99
                            regex: /^([A-Z0-9-]+)\s+(.+?)\s+(\d+(?:\.\d{2})?)\s+x\s+(\d+)\s+(\d+(?:\.\d{2})?)\s+(\d+(?:\.\d{1,2}))\s+R(\d+(?:\.\d{1,2}))\s+R(\d+(?:\.\d{2})?)/gm,
                            groups: {
                                code: 1,
                                description: 2,
                                quantity: 3,
                                unit: 4,
                                unitPrice: 5,
                                discountPercent: 6,
                                netUnitPrice: 7,
                                totalPrice: 8
                            },
                            name: 'standard_x_format'
                        },
                        {
                            // Each format: P-PB Podo Box Size L 10.00 Each 76.35 0 R114.5 R763.50
                            regex: /^([A-Z0-9-]+)\s+(.+?)\s+(\d+(?:\.\d{2})?)\s+Each\s+(\d+(?:\.\d{2})?)\s+(\d+(?:\.\d{1,2}))\s+R(\d+(?:\.\d{1,2}))\s+R(\d+(?:\.\d{2})?)/gm,
                            groups: {
                                code: 1,
                                description: 2,
                                quantity: 3,
                                unit: null, // Each means unit = 1
                                unitPrice: 4,
                                discountPercent: 5,
                                netUnitPrice: 6,
                                totalPrice: 7
                            },
                            name: 'each_format'
                        }
                    ],
                    
                    // Validation rules specific to Medis
                    validation: {
                        quantityRange: [0.01, 10000],
                        priceRange: [0.01, 100000],
                        discountRange: [0, 100],
                        expectedDiscounts: [0, 25], // Common discount percentages for Medis
                        taxRate: 15 // 15% VAT
                    }
                },
                
                // Processing configuration
                processing: {
                    currency: 'ZAR',
                    taxRate: 0.15,
                    decimalPlaces: 2,
                    expectedColumns: 8,
                    
                    // AI prompt customization for Medis
                    aiPromptHints: [
                        'Look for discount percentages in the "Disc%" column (typically 25.0 or 0)',
                        'Medis uses "Each" to indicate single units',
                        'Invoice number format is IN followed by digits (e.g., IN326587)',
                        'Date format is DD/MM/YY'
                    ]
                }
            },
            
            'transpharm': {
                name: 'Transpharm',
                code: 'transpharm',
                identifier: /transpharm/i,
                
                metadata: {
                    invoiceNumber: {
                        patterns: [
                            /(?:Invoice|Inv)\s*:?\s*([A-Z0-9-]+)/i
                        ],
                        location: 'header',
                        description: 'Invoice number in header'
                    },
                    date: {
                        patterns: [
                            /(\d{1,2}\/\d{1,2}\/\d{2,4})/
                        ],
                        format: 'DD/MM/YYYY',
                        location: 'header'
                    },
                    total: {
                        patterns: [
                            /Total\s*:?\s*R\s*(\d+(?:\.\d{2})?)/i
                        ],
                        location: 'bottom'
                    }
                },
                
                lineItems: {
                    patterns: [
                        {
                            regex: /^(.+?)\s+(\d+)\s+(\d+(?:\.\d{2})?)\s+(\d+(?:\.\d{2})?)/gm,
                            groups: {
                                description: 1,
                                quantity: 2,
                                unitPrice: 3,
                                totalPrice: 4
                            },
                            name: 'simple_format'
                        }
                    ],
                    validation: {
                        taxRate: 15
                    }
                },
                
                processing: {
                    currency: 'ZAR',
                    taxRate: 0.15,
                    aiPromptHints: [
                        'Transpharm invoices have simpler format',
                        'Usually no discount columns'
                    ]
                }
            }
        };
    }

    /**
     * Get profile for supplier
     * @param {string} supplierCode - Supplier code
     * @returns {Object|null} Supplier profile
     */
    getProfile(supplierCode) {
        return this.profiles[supplierCode] || null;
    }

    /**
     * Detect supplier from text using all profiles
     * @param {string} text - Invoice text
     * @returns {string|null} Detected supplier code
     */
    detectSupplier(text) {
        for (const [code, profile] of Object.entries(this.profiles)) {
            if (profile.identifier.test(text)) {
                console.log(`🏢 Detected supplier: ${profile.name} (${code})`);
                return code;
            }
        }
        console.log('🏢 No supplier detected, using default');
        return null;
    }

    /**
     * Get all available profiles
     * @returns {Object} All profiles
     */
    getAllProfiles() {
        return this.profiles;
    }

    /**
     * Extract metadata using supplier profile
     * @param {string} text - Invoice text
     * @param {string} supplierCode - Supplier code
     * @returns {Object} Extracted metadata
     */
    extractMetadata(text, supplierCode) {
        const profile = this.getProfile(supplierCode);
        if (!profile) {
            console.warn(`No profile found for supplier: ${supplierCode}`);
            return {};
        }

        const metadata = {
            supplierCode: supplierCode,
            invoiceNumber: null,
            date: null,
            totalAmount: null
        };

        console.log(`📋 Extracting metadata using ${profile.name} profile`);

        // Extract invoice number
        if (profile.metadata.invoiceNumber) {
            for (const pattern of profile.metadata.invoiceNumber.patterns) {
                const match = text.match(pattern);
                if (match && match[1]) {
                    metadata.invoiceNumber = match[1];
                    console.log(`📝 Invoice number found: ${match[1]} (${profile.metadata.invoiceNumber.description})`);
                    break;
                }
            }
        }

        // Extract date
        if (profile.metadata.date) {
            for (const pattern of profile.metadata.date.patterns) {
                const match = text.match(pattern);
                if (match && match[1]) {
                    metadata.date = this.parseDate(match[1], profile.metadata.date.format);
                    console.log(`📅 Date found: ${match[1]} -> ${metadata.date} (${profile.metadata.date.description})`);
                    break;
                }
            }
        }

        // Extract total
        if (profile.metadata.total) {
            for (const pattern of profile.metadata.total.patterns) {
                const matches = text.match(new RegExp(pattern.source, 'gi'));
                if (matches && matches.length > 0) {
                    // Take the last/largest amount found
                    const amounts = matches
                        .map(m => m.match(/R?\s*(\d+(?:\.\d{2})?)/i))
                        .filter(m => m)
                        .map(m => parseFloat(m[1]))
                        .filter(amount => amount > 100); // Filter out small amounts
                    
                    if (amounts.length > 0) {
                        metadata.totalAmount = Math.max(...amounts);
                        console.log(`💰 Total found: R${metadata.totalAmount} (${profile.metadata.total.description})`);
                        break;
                    }
                }
            }
        }

        return metadata;
    }

    /**
     * Parse date according to supplier-specific format
     * @param {string} dateStr - Date string
     * @param {string} format - Expected format
     * @returns {string} ISO date string
     */
    parseDate(dateStr, format) {
        try {
            if (format === 'DD/MM/YY' || format === 'DD/MM/YYYY') {
                const parts = dateStr.split('/');
                if (parts.length === 3) {
                    let [day, month, year] = parts;
                    
                    // Convert 2-digit year to 4-digit
                    if (year.length === 2) {
                        year = parseInt(year) < 50 ? `20${year}` : `19${year}`;
                    }
                    
                    const date = new Date(year, month - 1, day);
                    if (!isNaN(date.getTime())) {
                        return date.toISOString().split('T')[0];
                    }
                }
            }
            
            // Fallback to standard parsing
            const date = new Date(dateStr);
            return !isNaN(date.getTime()) ? date.toISOString().split('T')[0] : dateStr;
            
        } catch (error) {
            console.warn('Date parsing failed:', error);
            return dateStr;
        }
    }

    /**
     * Build enhanced AI prompt using supplier profile
     * @param {string} text - Invoice text
     * @param {string} supplierCode - Supplier code
     * @param {Object} metadata - Invoice metadata
     * @returns {string} Enhanced AI prompt
     */
    buildAIPrompt(text, supplierCode, metadata) {
        const profile = this.getProfile(supplierCode);
        if (!profile) return this.buildBasicPrompt(text, supplierCode, metadata);

        const hints = profile.processing.aiPromptHints || [];
        const expectedColumns = profile.lineItems.tableHeaders || [];

        return `You are an expert at extracting line items from ${profile.name} invoices.

SUPPLIER: ${profile.name}
${expectedColumns.length > 0 ? `TABLE COLUMNS: ${expectedColumns.join(' | ')}` : ''}

SPECIFIC INSTRUCTIONS FOR ${profile.name.toUpperCase()}:
${hints.map(hint => `- ${hint}`).join('\n')}

Extract ALL line items and return as JSON array with these fields:
- code: product/item code (string)
- description: product description (string) 
- quantity: total quantity (number)
- unitPrice: price per unit excluding tax (number)
- discountPercent: discount percentage if shown (number, default 0)
- totalPrice: total line price (number)

IMPORTANT VALIDATION:
${metadata.totalAmount ? `The invoice total is R${metadata.totalAmount}. Your extracted line items must add up close to this amount.` : ''}
${metadata.invoiceNumber ? `The invoice number is ${metadata.invoiceNumber}.` : ''}

Look carefully for discount percentages in any "Disc%" or discount columns.

Invoice text:
${text}

Return ONLY a valid JSON array:`;
    }

    /**
     * Build basic AI prompt for unknown suppliers
     */
    buildBasicPrompt(text, supplierCode, metadata) {
        return `Extract line items from this ${supplierCode} invoice text and return as JSON array.

Each item should have: code, description, quantity, unitPrice, discountPercent, totalPrice

${metadata.totalAmount ? `Invoice total: R${metadata.totalAmount}` : ''}

Invoice text:
${text}

JSON array:`;
    }
}

// Create global instance
const supplierProfileManager = new SupplierProfileManager();