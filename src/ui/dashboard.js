/**
 * Dashboard UI Management
 */

class Dashboard {
    constructor() {
        this.stats = null;
        this.lowStockItems = [];
        this.pendingOrders = [];
    }

    async init() {
        this.setupEventListeners();
        await this.loadDashboard();
        setInterval(() => this.refreshStats(), 30000); // Refresh every 30 seconds
    }

    setupEventListeners() {
        // Make low stock card clickable
        const lowStockCard = document.getElementById('lowStockItems')?.closest('.card');
        if (lowStockCard) {
            lowStockCard.style.cursor = 'pointer';
            lowStockCard.addEventListener('click', () => {
                this.showLowStockModal();
            });
        }

        // Make pending orders card clickable
        const pendingOrdersCard = document.getElementById('pendingOrdersCard');
        if (pendingOrdersCard) {
            pendingOrdersCard.addEventListener('click', () => {
                this.showPendingOrdersModal();
            });
        }

        // Order item button in low stock modal
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('order-item-btn')) {
                const itemId = e.target.getAttribute('data-item-id');
                this.showOrderItemModal(itemId);
            }
            // Mark received button in low stock modal
            if (e.target.classList.contains('mark-received-btn')) {
                const itemId = e.target.getAttribute('data-item-id');
                this.markItemReceivedFromDashboard(itemId);
            }
        });

        // Confirm order button
        const confirmOrderBtn = document.getElementById('confirmOrderBtn');
        if (confirmOrderBtn) {
            confirmOrderBtn.addEventListener('click', () => {
                this.confirmOrder();
            });
        }
    }

    async loadDashboard() {
        try {
            // Show loading only in the activity section
            showLoading('recentActivity');
            
            // Load statistics
            this.stats = await inventoryDB.getStatistics();
            
            // Update dashboard cards
            this.updateStatsCards();
            
            // Load recent activity
            await this.loadRecentActivity();
            
        } catch (error) {
            console.error('Error loading dashboard:', error);
            showToast('Error loading dashboard data', 'error');
            
            // Clear loading state on error
            const activityEl = document.getElementById('recentActivity');
            if (activityEl) {
                activityEl.innerHTML = '<p class="text-muted">Error loading recent activity</p>';
            }
        }
    }

    updateStatsCards() {
        if (!this.stats) return;
        
        // Update total items
        const totalItemsEl = document.getElementById('totalItems');
        if (totalItemsEl) {
            totalItemsEl.textContent = this.stats.totalItems.toLocaleString();
        }
        
        // Update stock value
        const stockValueEl = document.getElementById('stockValue');
        if (stockValueEl) {
            stockValueEl.textContent = formatCurrency(this.stats.totalValue);
        }
        
        // Update low stock items
        const lowStockEl = document.getElementById('lowStockItems');
        if (lowStockEl) {
            lowStockEl.textContent = this.stats.lowStockItems.toLocaleString();
        }
        
        // Update pending orders count
        const pendingOrdersEl = document.getElementById('pendingOrders');
        if (pendingOrdersEl) {
            pendingOrdersEl.textContent = this.stats.pendingOrders.toLocaleString();
        }
    }

    async loadRecentActivity() {
        try {
            const activities = await inventoryDB.getRecentActivity(5);
            const activityEl = document.getElementById('recentActivity');
            
            if (!activities.length) {
                activityEl.innerHTML = '<p class="text-muted">No recent activity</p>';
                return;
            }
            
            const activityHtml = activities.map(activity => `
                <div class="d-flex justify-content-between align-items-center mb-2 pb-2 border-bottom">
                    <div>
                        <small class="text-muted">${formatDate(activity.timestamp)}</small>
                        <div>${activity.description}</div>
                    </div>
                    <div>
                        <span class="badge bg-${this.getActivityBadgeColor(activity.type)}">
                            ${activity.type.replace('_', ' ')}
                        </span>
                    </div>
                </div>
            `).join('');
            
            activityEl.innerHTML = activityHtml;
            
        } catch (error) {
            console.error('Error loading recent activity:', error);
            document.getElementById('recentActivity').innerHTML = 
                '<p class="text-muted">Error loading activity</p>';
        }
    }

    getActivityBadgeColor(type) {
        const colorMap = {
            'item_added': 'success',
            'item_updated': 'warning',
            'item_deleted': 'danger',
            'bulk_import': 'info'
        };
        return colorMap[type] || 'secondary';
    }

    async refreshStats() {
        try {
            this.stats = await inventoryDB.getStatistics();
            this.updateStatsCards();
        } catch (error) {
            console.error('Error refreshing stats:', error);
        }
    }

    async showLowStockModal() {
        try {
            // Load low stock items
            this.lowStockItems = await inventoryDB.getLowStockItems();
            
            if (this.lowStockItems.length === 0) {
                showToast('No items are currently low in stock', 'success');
                return;
            }

            // Show the modal
            const modal = new bootstrap.Modal(document.getElementById('lowStockItemsModal'));
            modal.show();

            // Render the low stock items table
            await this.renderLowStockTable();

        } catch (error) {
            console.error('Error loading low stock items:', error);
            showToast('Error loading low stock items', 'error');
        }
    }

    async showPendingOrdersModal() {
        try {
            // Load pending orders
            this.pendingOrders = await inventoryDB.getPendingOrders();
            
            if (this.pendingOrders.length === 0) {
                showToast('No orders are currently pending', 'success');
                return;
            }

            // Show the modal
            const modal = new bootstrap.Modal(document.getElementById('pendingOrdersModal'));
            modal.show();

            // Render the pending orders table
            await this.renderPendingOrdersTable();

        } catch (error) {
            console.error('Error loading pending orders:', error);
            showToast('Error loading pending orders', 'error');
        }
    }

    async renderLowStockTable() {
        const container = document.getElementById('lowStockItemsTable');
        
        if (!this.lowStockItems.length) {
            container.innerHTML = '<p class="text-muted text-center">No low stock items found.</p>';
            return;
        }

        const tableHtml = `
            <div class="table-responsive">
                <table class="table table-striped table-hover">
                    <thead class="table-dark">
                        <tr>
                            <th>Item</th>
                            <th>Type</th>
                            <th>Current Stock</th>
                            <th>Threshold</th>
                            <th>Supplier</th>
                            <th>Order Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${await Promise.all(this.lowStockItems.map(item => this.renderLowStockRow(item)))}
                    </tbody>
                </table>
            </div>
        `;

        container.innerHTML = tableHtml;
    }

    async renderLowStockRow(item) {
        const supplierName = await this.getSupplierDisplayName(item.supplier);
        const supplierColor = await this.getSupplierBadgeColor(item.supplier);
        
        const orderStatus = item.orderStatus === 'ordered' 
            ? `<span class="badge bg-info">Ordered (${item.orderedQuantity || 0})</span>`
            : `<span class="badge bg-secondary">Not Ordered</span>`;

        const urgencyClass = item.quantity === 0 ? 'table-danger' : 
                           item.quantity <= Math.floor(item.lowStockThreshold / 2) ? 'table-warning' : '';

        return `
            <tr class="${urgencyClass}">
                <td>
                    <div class="d-flex align-items-center">
                        ${item.imageData ? 
                            `<img src="${item.imageData}" alt="${item.name}" class="rounded me-2" style="width: 40px; height: 40px; object-fit: cover;">` :
                            `<div class="bg-light rounded me-2 d-flex align-items-center justify-content-center" style="width: 40px; height: 40px; font-size: 12px;">No Img</div>`
                        }
                        <div>
                            <strong>${item.name}</strong>
                            ${item.sku ? `<br><small class="text-muted">SKU: ${item.sku}</small>` : ''}
                        </div>
                    </div>
                </td>
                <td>
                    <span class="badge ${item.itemType === 'reselling' ? 'bg-primary' : 'bg-success'}">
                        ${item.itemType === 'reselling' ? 'Reselling' : item.itemType === 'consumable' ? 'Consumable' : 'Equipment'}
                    </span>
                </td>
                <td>
                    <span class="badge ${item.quantity === 0 ? 'bg-danger' : item.quantity <= item.lowStockThreshold ? 'bg-warning' : 'bg-success'}">
                        ${item.quantity || 0}
                    </span>
                </td>
                <td>
                    <span class="badge bg-secondary">${item.lowStockThreshold || 5}</span>
                </td>
                <td>
                    ${supplierName !== 'Unknown' ? 
                        `<span class="badge" style="background-color: ${supplierColor}; color: white;">${supplierName}</span>` :
                        '<span class="badge bg-secondary">No Supplier</span>'
                    }
                </td>
                <td>${orderStatus}</td>
                <td>
                    ${item.orderStatus === 'ordered' ? 
                        `<button class="btn btn-sm btn-info mark-received-btn" data-item-id="${item.id}">
                            <i class="fas fa-box-open"></i> Mark Received
                        </button>` :
                        `<button class="btn btn-sm btn-success order-item-btn" data-item-id="${item.id}">
                            <i class="fas fa-shopping-cart"></i> Order
                        </button>`
                    }
                </td>
            </tr>
        `;
    }

    async showOrderItemModal(itemId) {
        try {
            const item = this.lowStockItems.find(i => i.id === parseInt(itemId));
            if (!item) {
                showToast('Item not found', 'error');
                return;
            }

            // Populate order form
            document.getElementById('orderItemName').textContent = item.name;
            document.getElementById('orderCurrentStock').textContent = item.quantity || 0;
            document.getElementById('orderLowStockThreshold').textContent = item.lowStockThreshold || 5;
            document.getElementById('orderItemId').value = item.id;
            
            // Set default order date to today
            document.getElementById('orderDate').value = new Date().toISOString().split('T')[0];
            
            // Clear other fields
            document.getElementById('orderQuantity').value = '';
            document.getElementById('expectedDelivery').value = '';
            document.getElementById('orderInvoiceReference').value = '';
            
            // Set unit cost from item's current cost price
            document.getElementById('orderUnitCost').value = item.costPrice || item.price || 0;

            // Populate supplier dropdown
            await this.populateSupplierDropdown(item.supplier);

            // Show modal
            const modal = new bootstrap.Modal(document.getElementById('orderItemModal'));
            modal.show();

        } catch (error) {
            console.error('Error showing order modal:', error);
            showToast('Error loading order form', 'error');
        }
    }

    async populateSupplierDropdown(defaultSupplierCode = null) {
        try {
            const suppliers = await inventoryDB.getAllSuppliers();
            const dropdown = document.getElementById('orderSupplier');
            
            dropdown.innerHTML = '<option value="">Select Supplier</option>';
            
            suppliers.forEach(supplier => {
                const option = document.createElement('option');
                option.value = supplier.code;
                option.textContent = supplier.name;
                option.style.color = supplier.color;
                
                // Select the default supplier (item's current supplier)
                if (supplier.code === defaultSupplierCode) {
                    option.selected = true;
                }
                
                dropdown.appendChild(option);
            });
        } catch (error) {
            console.error('Error loading suppliers for order:', error);
        }
    }

    async confirmOrder() {
        try {
            const form = document.getElementById('orderItemForm');
            if (!validateForm(form)) {
                showToast('Please fill in all required fields', 'error');
                return;
            }

            const itemId = parseInt(document.getElementById('orderItemId').value);
            const quantity = parseInt(document.getElementById('orderQuantity').value);
            const orderDate = document.getElementById('orderDate').value;
            const expectedDelivery = document.getElementById('expectedDelivery').value || null;
            const supplier = document.getElementById('orderSupplier').value;
            const invoiceReference = document.getElementById('orderInvoiceReference').value.trim() || null;
            const unitCost = parseFloat(document.getElementById('orderUnitCost').value) || 0;

            // Get the item details for the purchase record
            const item = this.lowStockItems.find(i => i.id === itemId);
            if (!item) {
                throw new Error('Item not found');
            }

            // Create purchase record
            const purchaseData = {
                itemId: itemId,
                itemName: item.name,
                itemSku: item.sku,
                supplier: supplier,
                quantity: quantity,
                unitCost: unitCost,
                totalCost: unitCost * quantity,
                orderDate: orderDate,
                expectedDelivery: expectedDelivery,
                invoiceReference: invoiceReference,
                status: 'ordered'
            };

            await inventoryDB.createPurchase(purchaseData);

            // Update item order status (with selected supplier)
            const orderUpdateData = {
                orderedQuantity: quantity,
                orderDate: orderDate,
                expectedDelivery: expectedDelivery,
                orderStatus: 'ordered',
                lastOrderedAt: new Date().toISOString(),
                supplier: supplier // Update supplier if different from default
            };

            await inventoryDB.updateItem(itemId, orderUpdateData);

            // Close modal
            bootstrap.Modal.getInstance(document.getElementById('orderItemModal')).hide();

            // Refresh low stock table and dashboard stats
            await this.showLowStockModal(); // Refresh the low stock modal
            await this.refreshStats();

            const supplierName = await this.getSupplierDisplayName(supplier);
            showToast(`Order placed for ${quantity} units from ${supplierName}`, 'success');

        } catch (error) {
            console.error('Error confirming order:', error);
            showToast('Error placing order: ' + error.message, 'error');
        }
    }

    async getSupplierDisplayName(supplierCode) {
        try {
            if (!supplierCode) return 'Unknown';
            const supplier = await inventoryDB.getSupplierByCode(supplierCode);
            return supplier ? supplier.name : supplierCode;
        } catch (error) {
            return supplierCode || 'Unknown';
        }
    }

    async getSupplierBadgeColor(supplierCode) {
        try {
            if (!supplierCode) return '#6c757d';
            const supplier = await inventoryDB.getSupplierByCode(supplierCode);
            return supplier ? supplier.color : '#6c757d';
        } catch (error) {
            return '#6c757d';
        }
    }

    async markItemReceivedFromDashboard(itemId) {
        try {
            const item = this.lowStockItems.find(i => i.id === parseInt(itemId));
            if (!item) {
                showToast('Item not found', 'error');
                return;
            }

            // Close the low stock modal temporarily
            const lowStockModal = bootstrap.Modal.getInstance(document.getElementById('lowStockItemsModal'));
            if (lowStockModal) {
                lowStockModal.hide();
            }

            // Show enhanced item details with the mark received functionality
            if (window.stockManager) {
                await stockManager.showEnhancedItemDetails(itemId);
                // The stock manager will show the appropriate Mark Received button
            } else {
                // Fallback: show a simple confirmation
                if (confirm(`Mark ${item.orderedQuantity || 0} units of "${item.name}" as received?`)) {
                    await inventoryDB.recordStockPurchase(
                        itemId,
                        item.orderedQuantity || 0,
                        item.costPrice || 0,
                        item.supplier
                    );
                    
                    await this.refreshStats();
                    showToast(`${item.name} marked as received`, 'success');
                }
            }

        } catch (error) {
            console.error('Error marking item as received:', error);
            showToast('Error marking item as received', 'error');
        }
    }

    async renderPendingOrdersTable() {
        const container = document.getElementById('pendingOrdersTable');
        
        if (!this.pendingOrders.length) {
            container.innerHTML = '<p class="text-muted text-center">No pending orders found.</p>';
            return;
        }

        // Load suppliers for display
        const suppliers = await inventoryDB.getAllSuppliers();

        const tableHtml = `
            <div class="table-responsive">
                <table class="table table-striped table-hover">
                    <thead class="table-dark">
                        <tr>
                            <th>Item</th>
                            <th>Type</th>
                            <th>Supplier</th>
                            <th>Ordered Qty</th>
                            <th>Unit Cost</th>
                            <th>Total Cost</th>
                            <th>Order Date</th>
                            <th>Expected Delivery</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${this.pendingOrders.map(item => this.renderPendingOrderRow(item, suppliers)).join('')}
                    </tbody>
                </table>
            </div>
        `;

        container.innerHTML = tableHtml;
    }

    renderPendingOrderRow(item, suppliers) {
        const supplier = suppliers.find(s => s.code === item.supplier);
        const supplierName = supplier ? supplier.name : item.supplier || 'Unknown';
        const supplierColor = supplier ? supplier.color : '#6c757d';

        return `
            <tr>
                <td>
                    <strong>${item.name}</strong>
                    ${item.sku ? `<br><small class="text-muted">SKU: ${item.sku}</small>` : ''}
                </td>
                <td>${this.getItemTypeDisplay(item.itemType || 'reselling')}</td>
                <td>
                    ${supplierName !== 'Unknown' ? 
                        `<span class="badge" style="background-color: ${supplierColor}; color: white;">${supplierName}</span>` :
                        '<span class="badge bg-secondary">No Supplier</span>'
                    }
                </td>
                <td>
                    <span class="badge bg-warning">${item.orderedQuantity || 0}</span>
                </td>
                <td>${formatCurrency(item.costPrice || 0)}</td>
                <td>${formatCurrency((item.costPrice || 0) * (item.orderedQuantity || 0))}</td>
                <td>${item.orderDate ? formatDate(item.orderDate) : 'N/A'}</td>
                <td>${item.expectedDelivery ? formatDate(item.expectedDelivery) : 'N/A'}</td>
                <td>
                    <button class="btn btn-sm btn-info mark-received-btn" data-item-id="${item.id}">
                        <i class="fas fa-box-open"></i> Mark Received
                    </button>
                </td>
            </tr>
        `;
    }

    getItemTypeDisplay(itemType) {
        const typeMap = {
            'reselling': '<span class="badge bg-success">Reselling</span>',
            'consumables': '<span class="badge bg-warning">Consumables</span>',
            'office_equipment': '<span class="badge bg-info">Office Equipment</span>'
        };
        return typeMap[itemType] || '<span class="badge bg-secondary">Unknown</span>';
    }
}

// Create dashboard instance
const dashboard = new Dashboard();
