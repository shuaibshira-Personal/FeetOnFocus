/**
 * Stock Management UI
 * Handles detailed item views, stock history, and stock adjustments
 */

class StockManager {
    constructor() {
        this.currentItem = null;
        this.stockHistory = [];
    }

    async init() {
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Stock sale confirmation
        document.getElementById('confirmSaleBtn').addEventListener('click', () => {
            this.confirmStockSale();
        });

        // Stock usage confirmation
        document.getElementById('confirmUsageBtn').addEventListener('click', () => {
            this.confirmStockUsage();
        });

        // Record sale button from item details
        document.getElementById('recordSaleBtn').addEventListener('click', () => {
            this.showStockSaleModal();
        });

        // Record usage button from item details
        document.getElementById('recordUsageBtn').addEventListener('click', () => {
            this.showStockUsageModal();
        });

        // Edit item from details modal
        document.getElementById('editItemFromDetailsBtn').addEventListener('click', () => {
            this.editItemFromDetails();
        });

        // Mark as received button from item details
        document.getElementById('markReceivedFromItemBtn').addEventListener('click', () => {
            this.showMarkReceivedModal();
        });

        // Confirm received button
        document.getElementById('confirmReceivedBtn').addEventListener('click', () => {
            this.confirmItemReceived();
        });

        // Item name click handlers (will be added dynamically to inventory tables)
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('item-name-link')) {
                e.preventDefault();
                const itemId = e.target.getAttribute('data-item-id');
                this.showEnhancedItemDetails(itemId);
            }
        });
    }

    async showEnhancedItemDetails(itemId) {
        try {
            // Load item data and stock history
            const [item, stockHistory] = await Promise.all([
                inventoryDB.getItemById(parseInt(itemId)),
                inventoryDB.getItemStockHistory(parseInt(itemId))
            ]);

            if (!item) {
                showToast('Item not found', 'error');
                return;
            }

            this.currentItem = item;
            this.stockHistory = stockHistory;

            // Set modal title
            document.getElementById('itemDetailsTitle').textContent = item.name;

            // Render item details
            await this.renderItemDetails();

            // Show appropriate action buttons
            this.setupActionButtons();

            // Show modal
            const modal = new bootstrap.Modal(document.getElementById('enhancedItemDetailsModal'));
            modal.show();

        } catch (error) {
            console.error('Error showing item details:', error);
            showToast('Error loading item details', 'error');
        }
    }

    async renderItemDetails() {
        const item = this.currentItem;
        const itemType = item.itemType || 'reselling';

        // Get additional data
        const supplier = await this.getSupplierInfo(item.supplier);
        const category = await this.getCategoryInfo(item.category);

        const detailsHtml = `
            <div class="row">
                <!-- Item Information -->
                <div class="col-lg-4 mb-4">
                    <div class="card h-100">
                        <div class="card-header">
                            <h6 class="mb-0"><i class="fas fa-info-circle"></i> Item Information</h6>
                        </div>
                        <div class="card-body">
                            ${item.imageData ? 
                                `<div class="text-center mb-3">
                                    <img src="${item.imageData}" alt="${item.name}" 
                                         class="img-thumbnail" style="max-width: 200px; max-height: 200px;">
                                </div>` : ''
                            }
                            <table class="table table-sm table-borderless">
                                <tr><th>Name:</th><td>${item.name}</td></tr>
                                <tr><th>SKU:</th><td>${item.sku || 'N/A'}</td></tr>
                                <tr><th>Type:</th><td>${this.getItemTypeBadge(itemType)}</td></tr>
                                <tr><th>Category:</th><td>${category ? category.name : 'N/A'}</td></tr>
                                <tr><th>Supplier:</th><td>
                                    ${supplier ? 
                                        `<span class="badge" style="background-color: ${supplier.color}; color: white;">${supplier.name}</span>` :
                                        'N/A'
                                    }
                                </td></tr>
                                <tr><th>Description:</th><td>${item.description || 'N/A'}</td></tr>
                            </table>
                        </div>
                    </div>
                </div>

                <!-- Current Status -->
                <div class="col-lg-4 mb-4">
                    <div class="card h-100">
                        <div class="card-header">
                            <h6 class="mb-0"><i class="fas fa-chart-line"></i> Current Status</h6>
                        </div>
                        <div class="card-body">
                            ${this.renderCurrentStatus(item, itemType)}
                        </div>
                    </div>
                </div>

                <!-- Quick Stats -->
                <div class="col-lg-4 mb-4">
                    <div class="card h-100">
                        <div class="card-header">
                            <h6 class="mb-0"><i class="fas fa-chart-bar"></i> Quick Stats</h6>
                        </div>
                        <div class="card-body">
                            ${this.renderQuickStats(item, itemType)}
                        </div>
                    </div>
                </div>
            </div>

            <!-- Stock History -->
            <div class="row">
                <div class="col-12">
                    <div class="card">
                        <div class="card-header">
                            <h6 class="mb-0"><i class="fas fa-history"></i> Stock History</h6>
                        </div>
                        <div class="card-body">
                            ${await this.renderStockHistory()}
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('itemDetailsContent').innerHTML = detailsHtml;
    }

    renderCurrentStatus(item, itemType) {
        const orderStatus = item.orderStatus === 'ordered' ? 
            `<span class="badge bg-warning text-dark">On Order (${item.orderedQuantity || 0} units)</span>` :
            `<span class="badge bg-success">In Stock</span>`;

        let statusHtml = `
            <table class="table table-sm table-borderless">
                <tr><th>Current Stock:</th><td><span class="badge ${this.getStockBadgeClass(item)}">${item.quantity || 0}</span></td></tr>
        `;

        if (itemType !== 'office_equipment') {
            statusHtml += `
                <tr><th>Low Stock Alert:</th><td>${item.lowStockThreshold || 5}</td></tr>
                <tr><th>Status:</th><td>${orderStatus}</td></tr>
            `;
        }

        statusHtml += `
                <tr><th>Cost Price:</th><td>${formatCurrency(item.costPrice || item.price || 0)}</td></tr>
        `;

        if (itemType === 'reselling') {
            const sellingPrice = item.sellingPrice || 0;
            const profit = sellingPrice - (item.costPrice || 0);
            const margin = sellingPrice > 0 ? ((profit / sellingPrice) * 100).toFixed(1) : 0;

            statusHtml += `
                <tr><th>Selling Price:</th><td>${formatCurrency(sellingPrice)}</td></tr>
                <tr><th>Profit Margin:</th><td class="${profit >= 0 ? 'text-success' : 'text-danger'}">${margin}%</td></tr>
            `;
        }

        if (itemType === 'office_equipment' && item.purchaseDate) {
            const purchaseDate = new Date(item.purchaseDate);
            const ageMonths = Math.floor((new Date() - purchaseDate) / (1000 * 60 * 60 * 24 * 30.44));
            statusHtml += `<tr><th>Age:</th><td>${ageMonths} months</td></tr>`;
        }

        statusHtml += `
                <tr><th>Last Updated:</th><td>${formatDate(item.updatedAt)}</td></tr>
                <tr><th>Created:</th><td>${formatDate(item.createdAt)}</td></tr>
            </table>
        `;

        return statusHtml;
    }

    renderQuickStats(item, itemType) {
        // Calculate stats from stock history
        let totalPurchased = 0;
        let totalSold = 0;
        let totalUsed = 0;
        let totalPurchaseValue = 0;
        let totalSaleValue = 0;

        this.stockHistory.forEach(entry => {
            if (entry.type === 'purchase') {
                totalPurchased += entry.quantityChange;
                totalPurchaseValue += entry.totalValue || 0;
            } else if (entry.type === 'sale') {
                totalSold += Math.abs(entry.quantityChange);
                totalSaleValue += entry.totalValue || 0;
            } else if (entry.type === 'usage') {
                totalUsed += Math.abs(entry.quantityChange);
            }
        });

        let statsHtml = `
            <table class="table table-sm table-borderless">
                <tr><th>Total Purchased:</th><td>${totalPurchased}</td></tr>
        `;

        if (itemType === 'reselling') {
            statsHtml += `
                <tr><th>Total Sold:</th><td>${totalSold}</td></tr>
                <tr><th>Purchase Value:</th><td>${formatCurrency(totalPurchaseValue)}</td></tr>
                <tr><th>Sales Revenue:</th><td class="text-success">${formatCurrency(totalSaleValue)}</td></tr>
                <tr><th>Gross Profit:</th><td class="${totalSaleValue - totalPurchaseValue >= 0 ? 'text-success' : 'text-danger'}">
                    ${formatCurrency(totalSaleValue - totalPurchaseValue)}
                </td></tr>
            `;
        } else if (itemType === 'consumable') {
            statsHtml += `
                <tr><th>Total Used:</th><td>${totalUsed}</td></tr>
                <tr><th>Purchase Value:</th><td>${formatCurrency(totalPurchaseValue)}</td></tr>
                <tr><th>Remaining Value:</th><td>${formatCurrency((item.quantity || 0) * (item.costPrice || 0))}</td></tr>
            `;
        }

        const currentValue = itemType === 'reselling' ? 
            (item.quantity || 0) * (item.sellingPrice || 0) :
            (item.quantity || 0) * (item.costPrice || 0);

        statsHtml += `
                <tr><th>Current Value:</th><td><strong>${formatCurrency(currentValue)}</strong></td></tr>
            </table>
        `;

        return statsHtml;
    }

    async renderStockHistory() {
        if (!this.stockHistory.length) {
            return '<p class="text-muted">No stock history available.</p>';
        }

        const historyHtml = `
            <div class="table-responsive">
                <table class="table table-sm">
                    <thead class="table-dark">
                        <tr>
                            <th>Date</th>
                            <th>Type</th>
                            <th>Description</th>
                            <th>Quantity</th>
                            <th>Unit Price</th>
                            <th>Total Value</th>
                            <th>New Stock</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${this.stockHistory.map(entry => this.renderHistoryRow(entry)).join('')}
                    </tbody>
                </table>
            </div>
        `;

        return historyHtml;
    }

    renderHistoryRow(entry) {
        const typeClass = {
            'purchase': 'bg-success',
            'sale': 'bg-primary', 
            'usage': 'bg-warning text-dark',
            'adjustment': 'bg-info'
        }[entry.type] || 'bg-secondary';

        const quantityClass = entry.quantityChange > 0 ? 'text-success' : 'text-danger';

        return `
            <tr>
                <td>${formatDate(entry.timestamp)}</td>
                <td><span class="badge ${typeClass}">${entry.type.charAt(0).toUpperCase() + entry.type.slice(1)}</span></td>
                <td>
                    ${entry.description}
                    ${entry.notes ? `<br><small class="text-muted">${entry.notes}</small>` : ''}
                </td>
                <td class="${quantityClass}">
                    ${entry.quantityChange > 0 ? '+' : ''}${entry.quantityChange}
                </td>
                <td>${formatCurrency(entry.unitPrice || 0)}</td>
                <td>${formatCurrency(entry.totalValue || 0)}</td>
                <td><span class="badge bg-info">${entry.newQuantity}</span></td>
            </tr>
        `;
    }

    setupActionButtons() {
        const markReceivedBtn = document.getElementById('markReceivedFromItemBtn');
        const recordSaleBtn = document.getElementById('recordSaleBtn');
        const recordUsageBtn = document.getElementById('recordUsageBtn');

        // Hide all buttons first
        markReceivedBtn.style.display = 'none';
        recordSaleBtn.style.display = 'none';
        recordUsageBtn.style.display = 'none';

        if (!this.currentItem) return;

        const itemType = this.currentItem.itemType || 'reselling';
        
        // Show Mark as Received button if item is on order
        if (this.currentItem.orderStatus === 'ordered' && this.currentItem.orderedQuantity > 0) {
            markReceivedBtn.style.display = 'inline-block';
        }
        // Show sale/usage buttons only if item has stock and is not on order
        else if (itemType === 'reselling' && (this.currentItem.quantity || 0) > 0) {
            recordSaleBtn.style.display = 'inline-block';
        } else if (itemType === 'consumable' && (this.currentItem.quantity || 0) > 0) {
            recordUsageBtn.style.display = 'inline-block';
        }
    }

    showStockSaleModal() {
        if (!this.currentItem) return;

        // Populate sale modal
        document.getElementById('saleItemName').textContent = this.currentItem.name;
        document.getElementById('saleCurrentStock').textContent = this.currentItem.quantity || 0;
        document.getElementById('saleCostPrice').textContent = formatCurrency(this.currentItem.costPrice || 0);
        document.getElementById('saleItemId').value = this.currentItem.id;
        
        // Set default sale price to selling price
        document.getElementById('salePrice').value = this.currentItem.sellingPrice || 0;
        
        // Clear other fields
        document.getElementById('saleQuantity').value = '';
        document.getElementById('saleNotes').value = '';

        const modal = new bootstrap.Modal(document.getElementById('stockSaleModal'));
        modal.show();
    }

    showStockUsageModal() {
        if (!this.currentItem) return;

        // Populate usage modal
        document.getElementById('usageItemName').textContent = this.currentItem.name;
        document.getElementById('usageCurrentStock').textContent = this.currentItem.quantity || 0;
        document.getElementById('usageCostPrice').textContent = formatCurrency(this.currentItem.costPrice || 0);
        document.getElementById('usageItemId').value = this.currentItem.id;
        
        // Clear fields
        document.getElementById('usageQuantity').value = '';
        document.getElementById('usageNotes').value = '';

        const modal = new bootstrap.Modal(document.getElementById('stockUsageModal'));
        modal.show();
    }

    async confirmStockSale() {
        try {
            const form = document.getElementById('stockSaleForm');
            if (!validateForm(form)) {
                showToast('Please fill in all required fields', 'error');
                return;
            }

            const itemId = parseInt(document.getElementById('saleItemId').value);
            const quantity = parseInt(document.getElementById('saleQuantity').value);
            const salePrice = parseFloat(document.getElementById('salePrice').value);
            const notes = document.getElementById('saleNotes').value.trim() || null;

            await inventoryDB.recordStockSale(itemId, quantity, salePrice, notes);

            // Close modal
            bootstrap.Modal.getInstance(document.getElementById('stockSaleModal')).hide();

            // Refresh item details
            await this.showEnhancedItemDetails(itemId);

            // Update dashboard if available
            if (window.dashboard) {
                await dashboard.refreshStats();
            }

            showToast(`Sale recorded: ${quantity} units sold for ${formatCurrency(salePrice * quantity)}`, 'success');

        } catch (error) {
            console.error('Error recording sale:', error);
            showToast('Error recording sale: ' + error.message, 'error');
        }
    }

    async confirmStockUsage() {
        try {
            const form = document.getElementById('stockUsageForm');
            if (!validateForm(form)) {
                showToast('Please fill in all required fields', 'error');
                return;
            }

            const itemId = parseInt(document.getElementById('usageItemId').value);
            const quantity = parseInt(document.getElementById('usageQuantity').value);
            const notes = document.getElementById('usageNotes').value.trim() || null;

            await inventoryDB.recordStockUsage(itemId, quantity, notes);

            // Close modal
            bootstrap.Modal.getInstance(document.getElementById('stockUsageModal')).hide();

            // Refresh item details
            await this.showEnhancedItemDetails(itemId);

            // Update dashboard if available
            if (window.dashboard) {
                await dashboard.refreshStats();
            }

            showToast(`Usage recorded: ${quantity} units consumed`, 'success');

        } catch (error) {
            console.error('Error recording usage:', error);
            showToast('Error recording usage: ' + error.message, 'error');
        }
    }

    showMarkReceivedModal() {
        if (!this.currentItem) return;

        // Populate received modal
        document.getElementById('receivedItemName').textContent = this.currentItem.name;
        document.getElementById('receivedCurrentStock').textContent = this.currentItem.quantity || 0;
        document.getElementById('receivedOrderedQuantity').textContent = this.currentItem.orderedQuantity || 0;
        document.getElementById('receivedItemId').value = this.currentItem.id;
        
        // Set default received quantity to ordered quantity
        document.getElementById('receivedQuantity').value = this.currentItem.orderedQuantity || 0;
        
        // Set default unit cost (user can change if actual cost was different)
        document.getElementById('actualUnitCost').value = this.currentItem.costPrice || 0;
        
        // Clear notes
        document.getElementById('receivedNotes').value = '';

        const modal = new bootstrap.Modal(document.getElementById('markItemReceivedModal'));
        modal.show();
    }

    async confirmItemReceived() {
        try {
            const form = document.getElementById('markReceivedForm');
            if (!validateForm(form)) {
                showToast('Please fill in all required fields', 'error');
                return;
            }

            const itemId = parseInt(document.getElementById('receivedItemId').value);
            const receivedQuantity = parseInt(document.getElementById('receivedQuantity').value);
            const actualUnitCost = parseFloat(document.getElementById('actualUnitCost').value) || this.currentItem.costPrice || 0;
            const notes = document.getElementById('receivedNotes').value.trim() || null;

            // Find the related purchase record to get supplier info
            let supplierCode = this.currentItem.supplier;
            let invoiceRef = null;

            // Try to find the most recent purchase order for this item
            try {
                const purchases = await inventoryDB.getAllPurchases();
                const relatedPurchase = purchases.find(p => 
                    p.itemId === itemId && 
                    p.status === 'ordered' &&
                    p.quantity === this.currentItem.orderedQuantity
                );
                
                if (relatedPurchase) {
                    supplierCode = relatedPurchase.supplier;
                    invoiceRef = relatedPurchase.invoiceReference;
                    
                    // Update purchase status to received
                    await inventoryDB.updatePurchaseStatus(relatedPurchase.id, 'received', {
                        receivedDate: new Date().toISOString(),
                        actualQuantityReceived: receivedQuantity,
                        actualUnitCost: actualUnitCost
                    });
                }
            } catch (error) {
                console.warn('Could not find related purchase record:', error);
            }

            // Record the stock receipt with full tracking
            await inventoryDB.recordStockPurchase(
                itemId, 
                receivedQuantity, 
                actualUnitCost, 
                supplierCode,
                invoiceRef
            );

            // Add a note to the stock history if provided
            if (notes) {
                const noteEntry = {
                    itemId: itemId,
                    type: 'adjustment',
                    date: new Date().toISOString().split('T')[0],
                    quantityChange: 0, // No quantity change, just a note
                    unitPrice: actualUnitCost,
                    totalValue: 0,
                    newQuantity: (this.currentItem.quantity || 0) + receivedQuantity,
                    notes: notes,
                    description: 'Delivery notes: ' + notes
                };
                
                await inventoryDB.addStockHistory(noteEntry);
            }

            // Close modal
            bootstrap.Modal.getInstance(document.getElementById('markItemReceivedModal')).hide();

            // Refresh item details
            await this.showEnhancedItemDetails(itemId);

            // Update dashboard if available
            if (window.dashboard) {
                await dashboard.refreshStats();
            }

            showToast(`Order received: ${receivedQuantity} units added to stock`, 'success');

        } catch (error) {
            console.error('Error marking item as received:', error);
            showToast('Error processing receipt: ' + error.message, 'error');
        }
    }

    editItemFromDetails() {
        if (!this.currentItem) return;

        // Close the details modal
        bootstrap.Modal.getInstance(document.getElementById('enhancedItemDetailsModal')).hide();

        // Trigger edit item in items manager
        if (window.itemsManager) {
            itemsManager.editItem(this.currentItem.id);
        }
    }

    // Utility methods
    getItemTypeBadge(itemType) {
        const badges = {
            'reselling': '<span class="badge bg-primary">Reselling</span>',
            'consumable': '<span class="badge bg-success">Consumable</span>',
            'office_equipment': '<span class="badge bg-info">Office Equipment</span>'
        };
        return badges[itemType] || '<span class="badge bg-secondary">Unknown</span>';
    }

    getStockBadgeClass(item) {
        const quantity = item.quantity || 0;
        const threshold = item.lowStockThreshold || 5;
        
        if (quantity === 0) return 'bg-danger';
        if (quantity <= threshold) return 'bg-warning text-dark';
        return 'bg-success';
    }

    async getSupplierInfo(supplierCode) {
        if (!supplierCode) return null;
        try {
            return await inventoryDB.getSupplierByCode(supplierCode);
        } catch (error) {
            return null;
        }
    }

    async getCategoryInfo(categoryCode) {
        if (!categoryCode) return null;
        try {
            return await inventoryDB.getCategoryByCode(categoryCode);
        } catch (error) {
            return null;
        }
    }

    // Method to make item names clickable in inventory tables
    makeItemNamesClickable(tableId) {
        const table = document.getElementById(tableId);
        if (!table) return;

        const itemNameCells = table.querySelectorAll('[data-item-id]');
        itemNameCells.forEach(cell => {
            const itemName = cell.textContent;
            const itemId = cell.getAttribute('data-item-id');
            
            cell.innerHTML = `<a href="#" class="item-name-link text-decoration-none" data-item-id="${itemId}">${itemName}</a>`;
        });
    }
}

// Create global instance
const stockManager = new StockManager();