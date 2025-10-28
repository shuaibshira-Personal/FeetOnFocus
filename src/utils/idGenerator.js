/**
 * ID Generation Utilities for SKU and Barcode
 */

class IDGenerator {
    /**
     * Generate a SKU in format: YYYYMMDD-XXXXX (date + 5-digit sequential)
     * @param {number} itemId - The item ID to incorporate
     * @returns {string} Generated SKU
     */
    static generateSKU(itemId) {
        const now = new Date();
        const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
        const sequence = String(itemId).padStart(5, '0');
        return `SKU-${dateStr}-${sequence}`;
    }

    /**
     * Generate a barcode as a numeric string (Code39 compatible)
     * Using format: 978 (ISBN-ish prefix) + date + item ID
     * @param {number} itemId - The item ID
     * @returns {string} Generated barcode number
     */
    static generateBarcode(itemId) {
        const now = new Date();
        const dateNum = parseInt(`${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`);
        const itemIdStr = String(itemId).padStart(8, '0');
        const barcode = `978${dateNum}${itemIdStr}`;
        return barcode;
    }

    /**
     * Generate SKU based on category and item ID
     * Format: [CATEGORY_CODE]-[YYYYMMDD]-[ID]
     * @param {number} itemId - The item ID
     * @param {string} categoryCode - The category code
     * @returns {string} Generated SKU
     */
    static generateSKUWithCategory(itemId, categoryCode = '') {
        const now = new Date();
        const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
        const sequence = String(itemId).padStart(5, '0');
        const catPrefix = categoryCode ? categoryCode.substring(0, 3).toUpperCase() : 'GEN';
        return `${catPrefix}-${dateStr}-${sequence}`;
    }

    /**
     * Check if a string is a valid Code39 barcode (numeric)
     * @param {string} barcode - The barcode to validate
     * @returns {boolean} True if valid
     */
    static isValidCode39Barcode(barcode) {
        // Code39 allows 0-9, A-Z, and special characters, but we're using numeric only
        return /^\d+$/.test(barcode) && barcode.length >= 10 && barcode.length <= 20;
    }

    /**
     * Check if a string is a valid SKU format
     * @param {string} sku - The SKU to validate
     * @returns {boolean} True if valid
     */
    static isValidSKU(sku) {
        return sku && sku.length >= 5;
    }
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = IDGenerator;
}
