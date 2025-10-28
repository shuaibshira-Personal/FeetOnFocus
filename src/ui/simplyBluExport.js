/**
 * SimplyBlu Export Manager
 * Exports inventory items to SimplyBlu format using their template
 */

class SimplyBluExport {
    constructor() {
        this.setupEventListeners();
    }

    setupEventListeners() {
        document.getElementById('exportSimplyBluBtn')?.addEventListener('click', () => this.showSimplyBluExportModal());
    }

    /**
     * Show SimplyBlu export modal
     */
    async showSimplyBluExportModal() {
        const items = await inventoryDB.getAllItems();
        const resellingItems = items.filter(i => i.itemType === 'reselling');

        const html = `
            <div class="modal fade" id="simplyBluExportModal" tabindex="-1">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title"><i class="fas fa-file-export"></i> Export to SimplyBlu</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="alert alert-info">
                                <strong>Export Summary:</strong>
                                <ul class="mb-0">
                                    <li>Total reselling items: <strong>${resellingItems.length}</strong></li>
                                    <li>Items with SKU: <strong>${resellingItems.filter(i => i.sku).length}</strong></li>
                                    <li>Items with barcode: <strong>${resellingItems.filter(i => i.barcode).length}</strong></li>
                                    <li>Format: SimplyBlu bulk upload template</li>
                                </ul>
                            </div>

                            <div class="form-group">
                                <label class="form-label"><strong>Select fields to include:</strong></label>
                                <div class="form-check">
                                    <input class="form-check-input" type="checkbox" id="includeSKU" checked>
                                    <label class="form-check-label" for="includeSKU">
                                        SKU (Product ID)
                                    </label>
                                </div>
                                <div class="form-check">
                                    <input class="form-check-input" type="checkbox" id="includeBarcode" checked>
                                    <label class="form-check-label" for="includeBarcode">
                                        Barcode (EAN)
                                    </label>
                                </div>
                                <div class="form-check">
                                    <input class="form-check-input" type="checkbox" id="includePrice" checked>
                                    <label class="form-check-label" for="includePrice">
                                        Selling Price
                                    </label>
                                </div>
                                <div class="form-check">
                                    <input class="form-check-input" type="checkbox" id="includeQuantity" checked>
                                    <label class="form-check-label" for="includeQuantity">
                                        Quantity
                                    </label>
                                </div>
                                <div class="form-check">
                                    <input class="form-check-input" type="checkbox" id="includeDescription" checked>
                                    <label class="form-check-label" for="includeDescription">
                                        Description
                                    </label>
                                </div>
                            </div>

                            <div class="alert alert-warning mt-3">
                                <i class="fas fa-info-circle me-2"></i>
                                <strong>Note:</strong> Only reselling items will be exported. Make sure all required fields (SKU, Barcode) are filled for best results.
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                            <button type="button" class="btn btn-primary" id="confirmSimplyBluExportBtn">
                                <i class="fas fa-download me-2"></i>Export
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Remove existing modal if present
        const existing = document.getElementById('simplyBluExportModal');
        if (existing) existing.remove();

        document.body.insertAdjacentHTML('beforeend', html);
        const modal = new bootstrap.Modal(document.getElementById('simplyBluExportModal'));
        
        document.getElementById('confirmSimplyBluExportBtn').addEventListener('click', () => this.performSimplyBluExport());
        
        modal.show();
    }

    /**
     * Perform the SimplyBlu export
     */
    async performSimplyBluExport() {
        try {
            showLoading('body');

            // Get selected options
            const includeSKU = document.getElementById('includeSKU').checked;
            const includeBarcode = document.getElementById('includeBarcode').checked;
            const includePrice = document.getElementById('includePrice').checked;
            const includeQuantity = document.getElementById('includeQuantity').checked;
            const includeDescription = document.getElementById('includeDescription').checked;

            // Get items
            const items = await inventoryDB.getAllItems();
            const resellingItems = items.filter(i => i.itemType === 'reselling');

            if (resellingItems.length === 0) {
                showToast('No reselling items to export', 'warning');
                return;
            }

            // Load the template
            const templateData = await this.loadTemplate();
            
            if (!templateData) {
                showToast('Could not load template file. Please ensure the template exists.', 'error');
                return;
            }

            // Create workbook from template
            const workbook = XLSX.read(templateData, { type: 'array' });
            const worksheet = workbook.Sheets[workbook.SheetNames[0]];

            // Prepare data rows (skip header row)
            let rowIndex = 2; // Start after header
            
            for (const item of resellingItems) {
                const rowData = this.prepareItemRow(item, includeSKU, includeBarcode, includePrice, includeQuantity, includeDescription);
                
                // Map to cells
                if (includeSKU && rowData.sku) {
                    worksheet['A' + rowIndex] = { t: 's', v: rowData.sku };
                }
                if (includeBarcode && rowData.barcode) {
                    worksheet['B' + rowIndex] = { t: 's', v: rowData.barcode };
                }
                if (rowData.name) {
                    const nameCol = includeSKU && includeBarcode ? 'C' : (includeSKU || includeBarcode ? 'B' : 'A');
                    worksheet[nameCol + rowIndex] = { t: 's', v: rowData.name };
                }
                if (includePrice && rowData.price) {
                    worksheet['E' + rowIndex] = { t: 'n', v: rowData.price };
                }
                if (includeQuantity && rowData.quantity !== undefined) {
                    worksheet['F' + rowIndex] = { t: 'n', v: rowData.quantity };
                }
                if (includeDescription && rowData.description) {
                    worksheet['G' + rowIndex] = { t: 's', v: rowData.description };
                }

                rowIndex++;
            }

            // Update worksheet range
            const range = XLSX.utils.decode_range(worksheet['!ref']);
            range.e.r = rowIndex - 1;
            worksheet['!ref'] = XLSX.utils.encode_range(range);

            // Write file
            const fileName = `SimplyBlu_Export_${new Date().toISOString().split('T')[0]}.xlsx`;
            XLSX.writeFile(workbook, fileName);

            // Close modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('simplyBluExportModal'));
            modal?.hide();

            showToast(`Successfully exported ${resellingItems.length} items to ${fileName}`, 'success');

        } catch (error) {
            console.error('Error exporting to SimplyBlu:', error);
            showToast('Error exporting to SimplyBlu: ' + error.message, 'error');
        }
    }

    /**
     * Prepare a single item row for export
     */
    prepareItemRow(item, includeSKU, includeBarcode, includePrice, includeQuantity, includeDescription) {
        return {
            sku: item.sku || '',
            barcode: item.barcode || '',
            name: item.name || '',
            listingName: item.listingName || '',
            price: item.sellingPrice || item.costPrice || 0,
            quantity: item.quantity || 0,
            description: item.description || '',
            category: item.category || '',
            supplier: item.supplier || ''
        };
    }

    /**
     * Load template file
     */
    async loadTemplate() {
        try {
            // Try to load from assets
            const response = await fetch('assets/templates/simplyblu-template.xlsx');
            if (!response.ok) {
                console.warn('Template file not found in assets');
                return null;
            }
            return await response.arrayBuffer();
        } catch (error) {
            console.error('Error loading template:', error);
            return null;
        }
    }
}

// Create global instance
const simplyBluExport = new SimplyBluExport();
