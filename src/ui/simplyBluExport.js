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

                            <div class="alert alert-info">
                                <strong>Export Fields:</strong>
                                <ul class="mb-0">
                                    <li>Name - Product name</li>
                                    <li>Category - From item category</li>
                                    <li>Description - From item description</li>
                                    <li>SalesChannel - Set to "instore"</li>
                                    <li>SellingPrice - From item selling price</li>
                                    <li>CostPrice - From item cost price</li>
                                    <li>IsStockTrackable - Set to "TRUE"</li>
                                    <li>SKU - Product ID/SKU</li>
                                    <li>Barcode - Product barcode</li>
                                    <li>StockCount - Current quantity</li>
                                    <li>LowStock - Low stock threshold</li>
                                </ul>
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

            // Get items
            const items = await inventoryDB.getAllItems();
            const resellingItems = items.filter(i => i.itemType === 'reselling');

            if (resellingItems.length === 0) {
                showToast('No reselling items to export', 'warning');
                return;
            }

            // Create new workbook with SimplyBlu headers
            const headers = ['Name', 'Category', 'Description', 'SalesChannel', 'SellingPrice', 'CostPrice', 'IsStockTrackable', 'SKU', 'Barcode', 'StockCount', 'LowStock'];
            const data = [headers];

            // Add items to data
            for (const item of resellingItems) {
                const row = [
                    item.name || '',                               // Name
                    item.category || '',                           // Category
                    item.description || '',                        // Description
                    'instore',                                     // SalesChannel (always instore)
                    item.sellingPrice || item.costPrice || 0,      // SellingPrice
                    item.costPrice || item.price || 0,             // CostPrice
                    'TRUE',                                        // IsStockTrackable (always TRUE)
                    item.sku || '',                                // SKU
                    item.barcode || '',                            // Barcode
                    item.quantity || 0,                            // StockCount
                    item.lowStockThreshold || 5                    // LowStock
                ];
                data.push(row);
            }

            // Create worksheet
            const worksheet = XLSX.utils.aoa_to_sheet(data);
            
            // Set column widths for better readability
            worksheet['!cols'] = [
                { wch: 25 }, // Name
                { wch: 20 }, // Category
                { wch: 30 }, // Description
                { wch: 15 }, // SalesChannel
                { wch: 15 }, // SellingPrice
                { wch: 15 }, // CostPrice
                { wch: 15 }, // IsStockTrackable
                { wch: 15 }, // SKU
                { wch: 20 }, // Barcode
                { wch: 12 }, // StockCount
                { wch: 12 }  // LowStock
            ];

            // Create workbook
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Products');

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

}

// Create global instance
const simplyBluExport = new SimplyBluExport();
