/**
 * ID Generation Settings Manager
 * Handles SKU and Barcode generation for items
 */

class IDGenerationSettings {
    constructor() {
        this.setupEventListeners();
    }

    setupEventListeners() {
        document.getElementById('generateSKUBtn')?.addEventListener('click', () => this.showSKUGenerationModal());
        document.getElementById('generateBarcodeBtn')?.addEventListener('click', () => this.showBarcodeGenerationModal());
    }

    /**
     * Show SKU generation modal
     */
    async showSKUGenerationModal() {
        const items = await inventoryDB.getAllItems();
        const resellingConsumables = items.filter(i => i.itemType === 'reselling' || i.itemType === 'consumable');
        const withoutSKU = resellingConsumables.filter(i => !i.sku);

        const html = `
            <div class="modal fade" id="generateSKUModal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title"><i class="fas fa-barcode"></i> Generate SKU for Items</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="alert alert-info">
                                <strong>Summary:</strong>
                                <ul class="mb-0">
                                    <li>Total reselling/consumable items: <strong>${resellingConsumables.length}</strong></li>
                                    <li>Items without SKU: <strong>${withoutSKU.length}</strong></li>
                                    <li>Items with existing SKU: <strong>${resellingConsumables.length - withoutSKU.length}</strong></li>
                                </ul>
                            </div>
                            <div class="form-group">
                                <label class="form-label"><strong>What would you like to do?</strong></label>
                                <div class="btn-group-vertical w-100" role="group">
                                    <input type="radio" class="btn-check" name="skuOption" id="skuOnlyMissing" value="missing" checked>
                                    <label class="btn btn-outline-primary text-start" for="skuOnlyMissing">
                                        <div><strong>Generate SKU only for items without SKU</strong></div>
                                        <small class="text-muted">Will generate ${withoutSKU.length} SKU(s)</small>
                                    </label>
                                    
                                    <input type="radio" class="btn-check" name="skuOption" id="skuRecreateAll" value="all">
                                    <label class="btn btn-outline-warning text-start" for="skuRecreateAll">
                                        <div><strong>Recreate SKU for ALL items</strong></div>
                                        <small class="text-muted">Will regenerate ${resellingConsumables.length} SKU(s) - <span class="text-danger">This may affect other systems!</span></small>
                                    </label>
                                </div>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                            <button type="button" class="btn btn-primary" id="confirmSKUBtn">Continue</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Remove existing modal if present
        const existing = document.getElementById('generateSKUModal');
        if (existing) existing.remove();

        document.body.insertAdjacentHTML('beforeend', html);
        const modal = new bootstrap.Modal(document.getElementById('generateSKUModal'));
        
        document.getElementById('confirmSKUBtn').addEventListener('click', () => this.confirmSKUGeneration());
        
        modal.show();
    }

    /**
     * Confirm and process SKU generation
     */
    async confirmSKUGeneration() {
        const option = document.querySelector('input[name="skuOption"]:checked').value;
        
        if (option === 'all') {
            // Show warning for recreating all SKUs
            const confirmed = confirm(
                '⚠️ WARNING ⚠️\n\n' +
                'You are about to RECREATE SKU for ALL items.\n\n' +
                'This will change existing SKU values and may affect:\n' +
                '• Other applications using these SKUs\n' +
                '• Existing orders or references\n' +
                '• System integrations\n\n' +
                'This action CANNOT be easily undone.\n\n' +
                'Are you absolutely sure you want to continue?'
            );
            
            if (!confirmed) {
                showToast('SKU generation cancelled', 'info');
                return;
            }
        }

        try {
            showLoading('body');
            const items = await inventoryDB.getAllItems();
            const resellingConsumables = items.filter(i => i.itemType === 'reselling' || i.itemType === 'consumable');
            
            let count = 0;
            for (const item of resellingConsumables) {
                if (option === 'missing' && item.sku) {
                    continue; // Skip items that already have SKU
                }

                const newSKU = IDGenerator.generateSKUWithCategory(item.id, item.category);
                await inventoryDB.updateItem(item.id, { sku: newSKU });
                count++;
            }

            // Close modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('generateSKUModal'));
            modal?.hide();

            showToast(`Successfully generated ${count} SKU(s)!`, 'success');
            
            // Refresh items display based on current view
            if (window.itemsManager) {
                // Check current active tab and refresh appropriate view
                const activeNavTab = document.querySelector('.nav-link.active');
                const activeDropdownTab = document.querySelector('.dropdown-item.active');
                const activeTab = activeDropdownTab || activeNavTab;
                
                if (activeTab) {
                    const activeTabId = activeTab.id;
                    console.log(`🔄 Refreshing view for active tab: ${activeTabId}`);
                    
                    // Refresh the appropriate type-specific view based on current tab
                    if (activeTabId === 'resellingTab') {
                        await itemsManager.loadItemsByType('reselling');
                    } else if (activeTabId === 'consumablesTab') {
                        await itemsManager.loadItemsByType('consumable');
                    } else if (activeTabId === 'officeEquipmentTab') {
                        await itemsManager.loadItemsByType('office_equipment');
                    } else if (activeTabId === 'allItemsTab') {
                        await itemsManager.loadItems();
                    }
                } else {
                    // Fallback: just load all items
                    await itemsManager.loadItems();
                }
            }
        } catch (error) {
            console.error('Error generating SKU:', error);
            showToast('Error generating SKU: ' + error.message, 'error');
        }
    }

    /**
     * Show Barcode generation modal
     */
    async showBarcodeGenerationModal() {
        const items = await inventoryDB.getAllItems();
        const resellingConsumables = items.filter(i => i.itemType === 'reselling' || i.itemType === 'consumable');
        const withoutBarcode = resellingConsumables.filter(i => !i.barcode);

        const html = `
            <div class="modal fade" id="generateBarcodeModal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title"><i class="fas fa-qrcode"></i> Generate Barcode for Items</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="alert alert-info">
                                <strong>Summary:</strong>
                                <ul class="mb-0">
                                    <li>Total reselling/consumable items: <strong>${resellingConsumables.length}</strong></li>
                                    <li>Items without barcode: <strong>${withoutBarcode.length}</strong></li>
                                    <li>Items with existing barcode: <strong>${resellingConsumables.length - withoutBarcode.length}</strong></li>
                                    <li>Format: Code39 (numeric)</li>
                                </ul>
                            </div>
                            <div class="form-group">
                                <label class="form-label"><strong>What would you like to do?</strong></label>
                                <div class="btn-group-vertical w-100" role="group">
                                    <input type="radio" class="btn-check" name="barcodeOption" id="barcodeOnlyMissing" value="missing" checked>
                                    <label class="btn btn-outline-primary text-start" for="barcodeOnlyMissing">
                                        <div><strong>Generate barcode only for items without barcode</strong></div>
                                        <small class="text-muted">Will generate ${withoutBarcode.length} barcode(s)</small>
                                    </label>
                                    
                                    <input type="radio" class="btn-check" name="barcodeOption" id="barcodeRecreateAll" value="all">
                                    <label class="btn btn-outline-warning text-start" for="barcodeRecreateAll">
                                        <div><strong>Recreate barcode for ALL items</strong></div>
                                        <small class="text-muted">Will regenerate ${resellingConsumables.length} barcode(s) - <span class="text-danger">This may affect other systems!</span></small>
                                    </label>
                                </div>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                            <button type="button" class="btn btn-primary" id="confirmBarcodeBtn">Continue</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Remove existing modal if present
        const existing = document.getElementById('generateBarcodeModal');
        if (existing) existing.remove();

        document.body.insertAdjacentHTML('beforeend', html);
        const modal = new bootstrap.Modal(document.getElementById('generateBarcodeModal'));
        
        document.getElementById('confirmBarcodeBtn').addEventListener('click', () => this.confirmBarcodeGeneration());
        
        modal.show();
    }

    /**
     * Confirm and process Barcode generation
     */
    async confirmBarcodeGeneration() {
        const option = document.querySelector('input[name="barcodeOption"]:checked').value;
        
        if (option === 'all') {
            // Show warning for recreating all barcodes
            const confirmed = confirm(
                '⚠️ WARNING ⚠️\n\n' +
                'You are about to RECREATE barcode for ALL items.\n\n' +
                'This will change existing barcode values and may affect:\n' +
                '• Other applications using these barcodes\n' +
                '• Existing orders or references\n' +
                '• System integrations\n' +
                '• Barcode scanners or POS systems\n\n' +
                'This action CANNOT be easily undone.\n\n' +
                'Are you absolutely sure you want to continue?'
            );
            
            if (!confirmed) {
                showToast('Barcode generation cancelled', 'info');
                return;
            }
        }

        try {
            showLoading('body');
            const items = await inventoryDB.getAllItems();
            const resellingConsumables = items.filter(i => i.itemType === 'reselling' || i.itemType === 'consumable');
            
            let count = 0;
            for (const item of resellingConsumables) {
                if (option === 'missing' && item.barcode) {
                    continue; // Skip items that already have barcode
                }

                const newBarcode = IDGenerator.generateBarcode(item.id);
                await inventoryDB.updateItem(item.id, { barcode: newBarcode });
                count++;
            }

            // Close modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('generateBarcodeModal'));
            modal?.hide();

            showToast(`Successfully generated ${count} barcode(s)!`, 'success');
            
            // Refresh items display based on current view
            if (window.itemsManager) {
                // Check current active tab and refresh appropriate view
                const activeNavTab = document.querySelector('.nav-link.active');
                const activeDropdownTab = document.querySelector('.dropdown-item.active');
                const activeTab = activeDropdownTab || activeNavTab;
                
                if (activeTab) {
                    const activeTabId = activeTab.id;
                    console.log(`🔄 Refreshing view for active tab: ${activeTabId}`);
                    
                    // Refresh the appropriate type-specific view based on current tab
                    if (activeTabId === 'resellingTab') {
                        await itemsManager.loadItemsByType('reselling');
                    } else if (activeTabId === 'consumablesTab') {
                        await itemsManager.loadItemsByType('consumable');
                    } else if (activeTabId === 'officeEquipmentTab') {
                        await itemsManager.loadItemsByType('office_equipment');
                    } else if (activeTabId === 'allItemsTab') {
                        await itemsManager.loadItems();
                    }
                } else {
                    // Fallback: just load all items
                    await itemsManager.loadItems();
                }
            }
        } catch (error) {
            console.error('Error generating barcode:', error);
            showToast('Error generating barcode: ' + error.message, 'error');
        }
    }
}

// Create global instance
const idGenerationSettings = new IDGenerationSettings();
