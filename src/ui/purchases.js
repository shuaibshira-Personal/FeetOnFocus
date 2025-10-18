/**
 * Purchase Management UI
 */

class PurchaseManager {
    constructor() {
        this.purchases = [];
        this.filteredPurchases = [];
        this.suppliers = [];
    }

    async init() {
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Purchase History button
        const purchaseHistoryBtn = document.getElementById('purchaseHistoryBtn');
        if (purchaseHistoryBtn) {
            purchaseHistoryBtn.addEventListener('click', () => {
                this.showPurchaseHistoryModal();
            });
        }

        // Filter and search
        document.getElementById('filterPurchasesBtn').addEventListener('click', () => {
            this.filterPurchases();
        });

        document.getElementById('clearPurchaseFiltersBtn').addEventListener('click', () => {
            this.clearFilters();
        });

        // Export button
        document.getElementById('exportPurchasesBtn').addEventListener('click', () => {
            this.exportPurchases();
        });

        // Upload Invoice button
        const uploadInvoiceBtn = document.getElementById('uploadInvoiceBtn');
        if (uploadInvoiceBtn) {
            uploadInvoiceBtn.addEventListener('click', () => {
                if (window.invoiceUploadManager) {
                    invoiceUploadManager.showUploadInvoiceModal();
                } else {
                    showToast('Invoice upload feature not available', 'warning');
                }
            });
        }

        // Purchase details and edit click handlers
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('view-purchase-btn')) {
                const purchaseId = e.target.getAttribute('data-purchase-id');
                this.showPurchaseDetails(purchaseId);
            }
            if (e.target.classList.contains('edit-purchase-btn')) {
                const purchaseId = e.target.getAttribute('data-purchase-id');
                this.showEditOrderModal(purchaseId);
            }
        });

        // Mark received button
        document.getElementById('markReceivedBtn').addEventListener('click', () => {
            this.markPurchaseReceived();
        });

        // Update order button
        document.getElementById('updateOrderBtn').addEventListener('click', () => {
            this.updateOrder();
        });

        // Cancel order button
        document.getElementById('cancelOrderBtn').addEventListener('click', () => {
            this.cancelOrder();
        });

        // Update total when quantity or unit cost changes in edit order modal
        document.getElementById('editOrderQuantity').addEventListener('input', () => {
            this.updateOrderTotal();
        });
        document.getElementById('editOrderUnitCost').addEventListener('input', () => {
            this.updateOrderTotal();
        });
    }

    async showPurchaseHistoryModal() {
        try {
            // Load purchases and suppliers
            await Promise.all([
                this.loadPurchases(),
                this.loadSuppliers()
            ]);

            // Show modal
            const modal = new bootstrap.Modal(document.getElementById('purchaseHistoryModal'));
            modal.show();

            // Populate supplier filter
            this.populateSupplierFilter();

            // Render purchases table
            await this.renderPurchasesTable();

        } catch (error) {
            console.error('Error showing purchase history:', error);
            showToast('Error loading purchase history', 'error');
        }
    }

    async loadPurchases() {
        try {
            this.purchases = await inventoryDB.getAllPurchases();
            this.filteredPurchases = [...this.purchases];
        } catch (error) {
            console.error('Error loading purchases:', error);
            throw error;
        }
    }

    async loadSuppliers() {
        try {
            this.suppliers = await inventoryDB.getAllSuppliers();
        } catch (error) {
            console.error('Error loading suppliers:', error);
            this.suppliers = [];
        }
    }

    populateSupplierFilter() {
        const supplierFilter = document.getElementById('purchaseSupplierFilter');
        supplierFilter.innerHTML = '<option value="">All Suppliers</option>';
        
        this.suppliers.forEach(supplier => {
            const option = document.createElement('option');
            option.value = supplier.code;
            option.textContent = supplier.name;
            supplierFilter.appendChild(option);
        });
    }

    filterPurchases() {
        const supplierFilter = document.getElementById('purchaseSupplierFilter').value;
        const invoiceFilter = document.getElementById('purchaseInvoiceFilter').value.toLowerCase();
        const statusFilter = document.getElementById('purchaseStatusFilter').value;

        this.filteredPurchases = this.purchases.filter(purchase => {
            const matchesSupplier = !supplierFilter || purchase.supplier === supplierFilter;
            const matchesInvoice = !invoiceFilter || 
                (purchase.invoiceReference && purchase.invoiceReference.toLowerCase().includes(invoiceFilter));
            const matchesStatus = !statusFilter || purchase.status === statusFilter;

            return matchesSupplier && matchesInvoice && matchesStatus;
        });

        this.renderPurchasesTable();
    }

    clearFilters() {
        document.getElementById('purchaseSupplierFilter').value = '';
        document.getElementById('purchaseInvoiceFilter').value = '';
        document.getElementById('purchaseStatusFilter').value = '';
        
        this.filteredPurchases = [...this.purchases];
        this.renderPurchasesTable();
    }

    async renderPurchasesTable() {
        const container = document.getElementById('purchaseHistoryTable');

        if (!this.filteredPurchases.length) {
            container.innerHTML = `
                <div class="text-center py-5">
                    <i class="fas fa-receipt fa-3x text-muted mb-3"></i>
                    <h5>No Purchase Records Found</h5>
                    <p class="text-muted">No purchases match your current filters or no purchases have been recorded yet.</p>
                </div>
            `;
            return;
        }

        const tableHtml = `
            <div class="table-responsive">
                <table class="table table-hover">
                    <thead class="table-dark">
                        <tr>
                            <th>Order Date</th>
                            <th>Item</th>
                            <th>Supplier</th>
                            <th>Quantity</th>
                            <th>Unit Cost</th>
                            <th>Total</th>
                            <th>Invoice Ref</th>
                            <th>Status</th>
                            <th>Expected</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${await Promise.all(this.filteredPurchases.map(purchase => this.renderPurchaseRow(purchase)))}
                    </tbody>
                </table>
            </div>
            
            <div class="mt-3">
                <div class="row">
                    <div class="col-md-6">
                        <p class="text-muted mb-0">Showing ${this.filteredPurchases.length} of ${this.purchases.length} purchases</p>
                    </div>
                    <div class="col-md-6 text-end">
                        <p class="mb-0"><strong>Total Value: ${this.calculateTotalValue()}</strong></p>
                    </div>
                </div>
            </div>
        `;

        container.innerHTML = tableHtml;
    }

    async renderPurchaseRow(purchase) {
        const supplier = this.suppliers.find(s => s.code === purchase.supplier);
        const supplierName = supplier ? supplier.name : purchase.supplier || 'Unknown';
        const supplierColor = supplier ? supplier.color : '#6c757d';

        const statusBadgeClass = {
            'ordered': 'bg-warning text-dark',
            'received': 'bg-success',
            'cancelled': 'bg-danger'
        }[purchase.status] || 'bg-secondary';

        const isOverdue = purchase.expectedDelivery && 
            new Date(purchase.expectedDelivery) < new Date() && 
            purchase.status === 'ordered';

        return `
            <tr class="${isOverdue ? 'table-warning' : ''}">
                <td>
                    ${formatDate(purchase.orderDate)}
                    ${isOverdue ? '<br><small class="text-danger"><i class="fas fa-exclamation-triangle"></i> Overdue</small>' : ''}
                </td>
                <td>
                    <div>
                        <strong>${purchase.itemName}</strong>
                        ${purchase.itemSku ? `<br><small class="text-muted">SKU: ${purchase.itemSku}</small>` : ''}
                    </div>
                </td>
                <td>
                    <span class="badge" style="background-color: ${supplierColor}; color: white;">
                        ${supplierName}
                    </span>
                </td>
                <td>
                    <span class="badge bg-info">${purchase.quantity}</span>
                </td>
                <td>${formatCurrency(purchase.unitCost || 0)}</td>
                <td><strong>${formatCurrency(purchase.totalCost || 0)}</strong></td>
                <td>
                    ${purchase.invoiceReference ? 
                        `<code>${purchase.invoiceReference}</code>` : 
                        '<span class="text-muted">None</span>'
                    }
                </td>
                <td>
                    <span class="badge ${statusBadgeClass}">
                        ${purchase.status.charAt(0).toUpperCase() + purchase.status.slice(1)}
                    </span>
                </td>
                <td>
                    ${purchase.expectedDelivery ? 
                        formatDate(purchase.expectedDelivery) : 
                        '<span class="text-muted">Not set</span>'
                    }
                </td>
                <td>
                    <div class="btn-group btn-group-sm" role="group">
                        <button class="btn btn-outline-primary view-purchase-btn" 
                                data-purchase-id="${purchase.id}">
                            <i class="fas fa-eye"></i>
                        </button>
                        ${purchase.status === 'ordered' ? 
                            `<button class="btn btn-outline-warning edit-purchase-btn" 
                                    data-purchase-id="${purchase.id}">
                                <i class="fas fa-edit"></i>
                            </button>` : ''
                        }
                    </div>
                </td>
            </tr>
        `;
    }

    calculateTotalValue() {
        const total = this.filteredPurchases.reduce((sum, purchase) => 
            sum + (purchase.totalCost || 0), 0
        );
        return formatCurrency(total);
    }

    async showPurchaseDetails(purchaseId) {
        try {
            const purchase = this.purchases.find(p => p.id === parseInt(purchaseId));
            if (!purchase) {
                showToast('Purchase not found', 'error');
                return;
            }

            const supplier = this.suppliers.find(s => s.code === purchase.supplier);
            const item = await inventoryDB.getItemById(purchase.itemId);

            const detailsHtml = `
                <div class="row">
                    <div class="col-md-6">
                        <table class="table table-borderless">
                            <tr><th>Purchase ID:</th><td>#${purchase.id}</td></tr>
                            <tr><th>Order Date:</th><td>${formatDate(purchase.orderDate)}</td></tr>
                            <tr><th>Status:</th><td>
                                <span class="badge ${purchase.status === 'received' ? 'bg-success' : 
                                    purchase.status === 'ordered' ? 'bg-warning text-dark' : 'bg-danger'}">
                                    ${purchase.status.charAt(0).toUpperCase() + purchase.status.slice(1)}
                                </span>
                            </td></tr>
                            <tr><th>Invoice Reference:</th><td>
                                ${purchase.invoiceReference ? `<code>${purchase.invoiceReference}</code>` : 'Not provided'}
                            </td></tr>
                            <tr><th>Expected Delivery:</th><td>
                                ${purchase.expectedDelivery ? formatDate(purchase.expectedDelivery) : 'Not set'}
                            </td></tr>
                        </table>
                    </div>
                    <div class="col-md-6">
                        <table class="table table-borderless">
                            <tr><th>Item:</th><td>${purchase.itemName}</td></tr>
                            <tr><th>SKU:</th><td>${purchase.itemSku || 'N/A'}</td></tr>
                            <tr><th>Supplier:</th><td>
                                <span class="badge" style="background-color: ${supplier ? supplier.color : '#6c757d'}; color: white;">
                                    ${supplier ? supplier.name : purchase.supplier || 'Unknown'}
                                </span>
                            </td></tr>
                            <tr><th>Quantity:</th><td><span class="badge bg-info">${purchase.quantity}</span></td></tr>
                            <tr><th>Unit Cost:</th><td>${formatCurrency(purchase.unitCost || 0)}</td></tr>
                            <tr><th>Total Cost:</th><td><strong>${formatCurrency(purchase.totalCost || 0)}</strong></td></tr>
                        </table>
                    </div>
                </div>
                
                ${item ? `
                    <div class="row mt-3">
                        <div class="col-12">
                            <h6>Current Item Status:</h6>
                            <div class="alert alert-info">
                                <div class="row">
                                    <div class="col-md-4">
                                        <strong>Current Stock:</strong> ${item.quantity || 0}
                                    </div>
                                    <div class="col-md-4">
                                        <strong>Low Stock Threshold:</strong> ${item.lowStockThreshold || 5}
                                    </div>
                                    <div class="col-md-4">
                                        <strong>Item Status:</strong> 
                                        <span class="badge ${item.orderStatus === 'ordered' ? 'bg-warning text-dark' : 'bg-success'}">
                                            ${item.orderStatus === 'ordered' ? 'On Order' : 'In Stock'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ` : ''}
                
                <div class="row mt-3">
                    <div class="col-12">
                        <small class="text-muted">
                            Created: ${formatDate(purchase.createdAt)} | 
                            Last Updated: ${formatDate(purchase.updatedAt)}
                        </small>
                    </div>
                </div>
            `;

            document.getElementById('purchaseDetailsContent').innerHTML = detailsHtml;
            
            // Show/hide mark received button
            const markReceivedBtn = document.getElementById('markReceivedBtn');
            if (purchase.status === 'ordered') {
                markReceivedBtn.style.display = 'inline-block';
                markReceivedBtn.setAttribute('data-purchase-id', purchase.id);
                markReceivedBtn.setAttribute('data-item-id', purchase.itemId);
                markReceivedBtn.setAttribute('data-quantity', purchase.quantity);
            } else {
                markReceivedBtn.style.display = 'none';
            }

            const modal = new bootstrap.Modal(document.getElementById('purchaseDetailsModal'));
            modal.show();

        } catch (error) {
            console.error('Error showing purchase details:', error);
            showToast('Error loading purchase details', 'error');
        }
    }

    async markPurchaseReceived() {
        try {
            const btn = document.getElementById('markReceivedBtn');
            const purchaseId = parseInt(btn.getAttribute('data-purchase-id'));
            const itemId = parseInt(btn.getAttribute('data-item-id'));
            const quantity = parseInt(btn.getAttribute('data-quantity'));

            // Update purchase status
            await inventoryDB.updatePurchaseStatus(purchaseId, 'received', {
                receivedDate: new Date().toISOString()
            });

            // Record stock purchase with history tracking
            const purchase = this.purchases.find(p => p.id === purchaseId);
            if (purchase) {
                await inventoryDB.recordStockPurchase(
                    itemId, 
                    quantity, 
                    purchase.unitCost || 0, 
                    purchase.supplier,
                    purchase.invoiceReference
                );
            } else {
                // Fallback to old method
                await inventoryDB.markItemAsReceived(itemId, quantity);
            }

            // Close modal
            bootstrap.Modal.getInstance(document.getElementById('purchaseDetailsModal')).hide();

            // Refresh the purchase history
            await this.loadPurchases();
            this.filterPurchases();

            // Update dashboard if available
            if (window.dashboard) {
                await dashboard.refreshStats();
            }

            showToast('Purchase marked as received and stock updated', 'success');

        } catch (error) {
            console.error('Error marking purchase received:', error);
            showToast('Error updating purchase: ' + error.message, 'error');
        }
    }

    async showEditOrderModal(purchaseId) {
        try {
            const purchase = this.purchases.find(p => p.id === parseInt(purchaseId));
            if (!purchase) {
                showToast('Purchase order not found', 'error');
                return;
            }

            if (purchase.status !== 'ordered') {
                showToast('Only pending orders can be edited', 'warning');
                return;
            }

            // Populate the edit order form
            document.getElementById('editOrderId').value = purchase.id;
            document.getElementById('editOrderItemId').value = purchase.itemId;
            document.getElementById('editOrderItemName').textContent = purchase.itemName;
            document.getElementById('editOrderQuantity').value = purchase.quantity;
            document.getElementById('editOrderUnitCost').value = purchase.unitCost || 0;
            document.getElementById('editOrderDate').value = purchase.orderDate;
            document.getElementById('editOrderExpectedDelivery').value = purchase.expectedDelivery || '';
            document.getElementById('editOrderInvoiceReference').value = purchase.invoiceReference || '';

            // Populate supplier dropdown
            await this.populateEditOrderSupplierDropdown(purchase.supplier);

            // Update totals
            document.getElementById('editOrderCurrentTotal').textContent = formatCurrency(purchase.totalCost || 0);
            this.updateOrderTotal();

            // Show cancel order button
            document.getElementById('cancelOrderBtn').style.display = 'inline-block';

            // Show modal
            const modal = new bootstrap.Modal(document.getElementById('editOrderModal'));
            modal.show();

        } catch (error) {
            console.error('Error showing edit order modal:', error);
            showToast('Error loading order for editing', 'error');
        }
    }

    async populateEditOrderSupplierDropdown(selectedSupplier) {
        try {
            const dropdown = document.getElementById('editOrderSupplier');
            dropdown.innerHTML = '<option value="">Select Supplier</option>';

            this.suppliers.forEach(supplier => {
                const option = document.createElement('option');
                option.value = supplier.code;
                option.textContent = supplier.name;
                option.style.color = supplier.color;
                
                if (supplier.code === selectedSupplier) {
                    option.selected = true;
                }
                
                dropdown.appendChild(option);
            });
        } catch (error) {
            console.error('Error populating supplier dropdown:', error);
        }
    }

    updateOrderTotal() {
        const quantity = parseInt(document.getElementById('editOrderQuantity').value) || 0;
        const unitCost = parseFloat(document.getElementById('editOrderUnitCost').value) || 0;
        const newTotal = quantity * unitCost;
        
        document.getElementById('editOrderNewTotal').textContent = formatCurrency(newTotal);
    }

    async updateOrder() {
        try {
            const form = document.getElementById('editOrderForm');
            if (!validateForm(form)) {
                showToast('Please fill in all required fields', 'error');
                return;
            }

            const purchaseId = parseInt(document.getElementById('editOrderId').value);
            const itemId = parseInt(document.getElementById('editOrderItemId').value);
            const quantity = parseInt(document.getElementById('editOrderQuantity').value);
            const unitCost = parseFloat(document.getElementById('editOrderUnitCost').value);
            const supplier = document.getElementById('editOrderSupplier').value;
            const orderDate = document.getElementById('editOrderDate').value;
            const expectedDelivery = document.getElementById('editOrderExpectedDelivery').value || null;
            const invoiceReference = document.getElementById('editOrderInvoiceReference').value.trim() || null;

            // Update purchase record
            const updatedPurchaseData = {
                quantity: quantity,
                unitCost: unitCost,
                totalCost: quantity * unitCost,
                supplier: supplier,
                orderDate: orderDate,
                expectedDelivery: expectedDelivery,
                invoiceReference: invoiceReference
            };

            await inventoryDB.updatePurchaseStatus(purchaseId, 'ordered', updatedPurchaseData);

            // Update the related item's order information
            const orderUpdateData = {
                orderedQuantity: quantity,
                orderDate: orderDate,
                expectedDelivery: expectedDelivery,
                orderStatus: 'ordered',
                supplier: supplier, // Update supplier if changed
                lastOrderedAt: new Date().toISOString()
            };

            await inventoryDB.updateItem(itemId, orderUpdateData);

            // Close modal
            bootstrap.Modal.getInstance(document.getElementById('editOrderModal')).hide();

            // Refresh purchase history
            await this.loadPurchases();
            this.filterPurchases();

            // Update dashboard if available
            if (window.dashboard) {
                await dashboard.refreshStats();
            }

            showToast('Order updated successfully', 'success');

        } catch (error) {
            console.error('Error updating order:', error);
            showToast('Error updating order: ' + error.message, 'error');
        }
    }

    async cancelOrder() {
        try {
            if (!confirm('Are you sure you want to cancel this order? This action cannot be undone.')) {
                return;
            }

            const purchaseId = parseInt(document.getElementById('editOrderId').value);
            const itemId = parseInt(document.getElementById('editOrderItemId').value);

            // Update purchase status to cancelled
            await inventoryDB.updatePurchaseStatus(purchaseId, 'cancelled', {
                cancelledDate: new Date().toISOString()
            });

            // Clear item order status
            const orderUpdateData = {
                orderedQuantity: 0,
                orderDate: null,
                expectedDelivery: null,
                orderStatus: null,
                lastOrderedAt: null
            };

            await inventoryDB.updateItem(itemId, orderUpdateData);

            // Close modal
            bootstrap.Modal.getInstance(document.getElementById('editOrderModal')).hide();

            // Refresh purchase history
            await this.loadPurchases();
            this.filterPurchases();

            // Update dashboard if available
            if (window.dashboard) {
                await dashboard.refreshStats();
            }

            showToast('Order cancelled successfully', 'warning');

        } catch (error) {
            console.error('Error cancelling order:', error);
            showToast('Error cancelling order: ' + error.message, 'error');
        }
    }

    exportPurchases() {
        try {
            if (!this.filteredPurchases.length) {
                showToast('No purchases to export', 'warning');
                return;
            }

            // Prepare CSV data
            const headers = [
                'Purchase ID', 'Order Date', 'Item Name', 'Item SKU', 'Supplier', 
                'Quantity', 'Unit Cost', 'Total Cost', 'Invoice Reference', 
                'Status', 'Expected Delivery', 'Created At'
            ];

            const csvData = this.filteredPurchases.map(purchase => [
                purchase.id,
                purchase.orderDate,
                purchase.itemName,
                purchase.itemSku || '',
                this.suppliers.find(s => s.code === purchase.supplier)?.name || purchase.supplier || '',
                purchase.quantity,
                purchase.unitCost || 0,
                purchase.totalCost || 0,
                purchase.invoiceReference || '',
                purchase.status,
                purchase.expectedDelivery || '',
                purchase.createdAt
            ]);

            const csvContent = [headers, ...csvData]
                .map(row => row.map(field => `"${field}"`).join(','))
                .join('\n');

            const filename = `purchase-history-${new Date().toISOString().split('T')[0]}.csv`;
            downloadFile(csvContent, filename, 'text/csv');

            showToast('Purchase history exported successfully', 'success');

        } catch (error) {
            console.error('Error exporting purchases:', error);
            showToast('Error exporting purchase history', 'error');
        }
    }
}

// Create global instance
const purchaseManager = new PurchaseManager();