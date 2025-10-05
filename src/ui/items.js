/**
 * Items UI Management
 */

class ItemsManager {
    constructor() {
        this.items = [];
        this.filteredItems = [];
        this.currentImageData = null;
        this.editImageData = null;
    }

    async init() {
        console.log('Initializing items manager...');
        this.setupEventListeners();
        await this.loadItems();
        // Add a small delay to ensure suppliers and categories are initialized
        setTimeout(async () => {
            await this.loadSupplierOptions();
            await this.loadCategoryOptions();
        }, 500);
        
        // Set current view type
        this.currentViewType = null; // null means all items
        
        // Re-initialize event listeners after a delay to catch any late-loading elements
        setTimeout(() => {
            this.reinitializeEventListeners();
        }, 1000);
    }

    reinitializeEventListeners() {
        console.log('Re-initializing event listeners for items manager...');
        
        // Re-attach type-specific add buttons if they weren't found initially
        const buttons = [
            { id: 'addResellingItemBtn', type: 'reselling' },
            { id: 'addConsumableBtn', type: 'consumable' }, 
            { id: 'addOfficeEquipmentBtn', type: 'office_equipment' }
        ];
        
        buttons.forEach(({ id, type }) => {
            const element = document.getElementById(id);
            if (element && !element.hasEventListener) {
                console.log(`⚙️ Re-attaching event listener for ${id}`);
                element.addEventListener('click', () => {
                    console.log(`${id} clicked - showing modal for ${type}`);
                    this.showAddItemModal(type);
                });
                element.hasEventListener = true; // Mark to avoid duplicate listeners
            }
        });
    }

    // Global function to clean up any modal backdrop issues
    cleanupAllModals() {
        console.log('🧹 Emergency modal cleanup initiated');
        
        // Remove all modal backdrops
        const backdrops = document.querySelectorAll('.modal-backdrop');
        backdrops.forEach((backdrop, index) => {
            backdrop.remove();
            console.log(`🗑️ Removed backdrop ${index + 1}`);
        });
        
        // Restore body state
        document.body.classList.remove('modal-open');
        document.body.style.overflow = '';
        document.body.style.paddingRight = '';
        
        // Hide any visible modals
        const modals = document.querySelectorAll('.modal.show');
        modals.forEach((modal, index) => {
            const modalInstance = bootstrap.Modal.getInstance(modal);
            if (modalInstance) {
                modalInstance.hide();
                console.log(`🔒 Closed modal ${index + 1}`);
            }
        });
        
        console.log('✅ Modal cleanup completed');
        showToast('Modal cleanup completed', 'success');
    }

    // Debug function to test buttons manually
    debugButtons() {
        console.log('=== BUTTON DEBUG INFO ===');
        
        const buttons = [
            'addResellingItemBtn',
            'addConsumableBtn', 
            'addOfficeEquipmentBtn',
            'addItemBtn'
        ];
        
        buttons.forEach(id => {
            const element = document.getElementById(id);
            console.log(`${id}: ${element ? '✅ Found' : '❌ Not Found'}`);
            if (element) {
                console.log(`  - Visible: ${element.offsetWidth > 0 && element.offsetHeight > 0}`);
                console.log(`  - Has click listener: ${element.hasEventListener || 'Unknown'}`);
            }
        });
        
        console.log('Current tab content classes:');
        ['resellingContent', 'consumablesContent', 'officeEquipmentContent', 'allItemsContent'].forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                console.log(`${id}: ${element.classList.contains('d-none') ? 'Hidden' : 'Visible'}`);
            }
        });
        
        console.log('=== END DEBUG INFO ===');
    }

    setupEventListeners() {
        console.log('Setting up items manager event listeners...');
        
        // Helper function to safely add event listeners
        const safeAddEventListener = (elementId, event, handler, required = true) => {
            const element = document.getElementById(elementId);
            if (element) {
                element.addEventListener(event, handler);
                console.log(`✅ Event listener added for ${elementId}`);
            } else {
                const message = `❌ Element not found: ${elementId}`;
                if (required) {
                    console.error(message);
                } else {
                    console.warn(message);
                }
            }
            return element;
        };

        // Add item button (in all items view)
        safeAddEventListener('addItemBtn', 'click', () => {
            console.log('Add item button clicked');
            this.showAddItemModal();
        }, false);

        // Save item button
        safeAddEventListener('saveItemBtn', 'click', () => {
            this.saveItem();
        });

        // Update item button
        safeAddEventListener('updateItemBtn', 'click', () => {
            this.updateItem();
        });

        // Item type change (add item)
        safeAddEventListener('itemType', 'change', (e) => {
            this.handleItemTypeChange(e.target.value, false);
        });

        // Item type change (edit item)
        safeAddEventListener('editItemType', 'change', (e) => {
            this.handleItemTypeChange(e.target.value, true);
        });

        // Type-specific add item buttons
        safeAddEventListener('addResellingItemBtn', 'click', () => {
            console.log('Add reselling item button clicked');
            this.showAddItemModal('reselling');
        });
        
        safeAddEventListener('addConsumableBtn', 'click', () => {
            console.log('Add consumable button clicked');
            this.showAddItemModal('consumable');
        });
        
        safeAddEventListener('addOfficeEquipmentBtn', 'click', () => {
            console.log('Add office equipment button clicked');
            this.showAddItemModal('office_equipment');
        });

        // Type-specific search handlers
        const searchInputs = [
            { id: 'resellingSearch', type: 'reselling' },
            { id: 'consumablesSearch', type: 'consumable' },
            { id: 'officeEquipmentSearch', type: 'office_equipment' },
            { id: 'itemSearch', type: null } // All items
        ];
        
        searchInputs.forEach(({ id, type }) => {
            const element = safeAddEventListener(id, 'input', 
                debounce(() => this.filterItemsByType(type), 300), false
            );
        });

        // Type-specific supplier filter handlers
        const supplierFilters = [
            { id: 'resellingSupplierFilter', type: 'reselling' },
            { id: 'consumablesSupplierFilter', type: 'consumable' },
            { id: 'officeEquipmentSupplierFilter', type: 'office_equipment' },
            { id: 'supplierFilter', type: null }, // All items
            { id: 'itemTypeFilter', type: 'typeFilter' } // Item type filter for all items
        ];
        
        supplierFilters.forEach(({ id, type }) => {
            safeAddEventListener(id, 'change', () => {
                if (type === 'typeFilter') {
                    this.filterItems();
                } else {
                    this.filterItemsByType(type);
                }
            }, false);
        });

        // Search items (fallback if not caught above)
        safeAddEventListener('itemSearch', 'input', debounce(() => this.filterItems(), 300), false);

        // Image upload
        safeAddEventListener('itemImage', 'change', (e) => {
            handleImageUpload(e.target, 'imagePreview', (fileData) => {
                this.currentImageData = fileData;
            });
        });

        // Edit image upload
        safeAddEventListener('editItemImage', 'change', (e) => {
            handleImageUpload(e.target, 'editImagePreview', (fileData) => {
                this.editImageData = fileData;
            });
        });

        // Bulk import button
        safeAddEventListener('bulkImportBtn', 'click', () => {
            this.showBulkImportModal();
        }, false);
        
        console.log('Items manager event listeners setup complete');
    }

    async loadItems() {
        try {
            showLoading('itemsTable');
            this.items = await inventoryDB.getAllItems();
            this.filteredItems = [...this.items];
            this.renderItemsTable();
        } catch (error) {
            console.error('Error loading items:', error);
            showToast('Error loading items', 'error');
            document.getElementById('itemsTable').innerHTML = 
                '<p class="text-muted">Error loading items</p>';
        }
    }


    async renderItemsTable() {
        const container = document.getElementById('itemsTable');

        if (!this.filteredItems.length) {
            container.innerHTML = '<p class="text-muted">No items found</p>';
            return;
        }

        // Render table structure first
        container.innerHTML = `
            <div class="table-responsive">
                <table class="table table-striped">
                    <thead>
                        <tr>
                            <th>Image</th>
                            <th>Name</th>
                            <th>Type</th>
                            <th>SKU</th>
                            <th>Category</th>
                            <th>Supplier</th>
                            <th>Pricing</th>
                            <th>Quantity</th>
                            <th>Value</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody id="itemsTableBody">
                        <tr><td colspan="10" class="text-center">Loading items...</td></tr>
                    </tbody>
                </table>
            </div>
        `;

        // Render rows asynchronously
        const tbody = document.getElementById('itemsTableBody');
        const rows = await Promise.all(
            this.filteredItems.map(item => this.renderItemRow(item))
        );
        
        tbody.innerHTML = rows.join('');
    }

    async renderItemRow(item) {
        const imageHtml = item.imageData ? 
            `<img src="${item.imageData}" alt="${item.name}" class="img-thumbnail" style="width: 50px; height: 50px; object-fit: cover;">` :
            `<div class="bg-light text-center" style="width: 50px; height: 50px; line-height: 50px; font-size: 12px;">No Image</div>`;

        const supplierColor = await this.getSupplierBadgeColor(item.supplier);
        const supplierName = await this.getSupplierDisplayName(item.supplier);
        
        // Determine item type and pricing info
        const itemType = item.itemType || 'reselling'; // Default to reselling for legacy items
        const itemTypeBadge = this.getItemTypeBadge(itemType);
        const pricingInfo = this.getPricingDisplay(item, itemType);
        const totalValue = this.calculateItemValue(item, itemType);
        const quantityDisplay = this.getQuantityDisplay(item, itemType);

        return `
            <tr>
                <td>${imageHtml}</td>
                <td>
                    <div class="fw-bold">
                        <a href="#" class="item-name-link text-decoration-none" data-item-id="${item.id}">
                            ${item.name || ''}
                        </a>
                    </div>
                    <small class="text-muted">${item.listingName || ''}</small>
                </td>
                <td>${itemTypeBadge}</td>
                <td>${item.sku || ''}</td>
                <td>${item.category || ''}</td>
                <td>
                    <span class="badge" style="background-color: ${supplierColor}; color: white;">
                        ${supplierName}
                    </span>
                </td>
                <td>${pricingInfo}</td>
                <td>${quantityDisplay}</td>
                <td>${formatCurrency(totalValue)}</td>
                <td>
                    <div class="btn-group btn-group-sm" role="group">
                        <button type="button" class="btn btn-outline-primary" onclick="stockManager.showEnhancedItemDetails(${item.id})">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button type="button" class="btn btn-outline-warning" onclick="itemsManager.editItem(${item.id})">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button type="button" class="btn btn-outline-danger" onclick="itemsManager.deleteItem(${item.id})">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }
    
    getItemTypeBadge(itemType) {
        const badges = {
            'reselling': '<span class="badge bg-success">Reselling</span>',
            'consumable': '<span class="badge bg-info">Consumable</span>',
            'office_equipment': '<span class="badge bg-secondary">Office Equipment</span>'
        };
        return badges[itemType] || '<span class="badge bg-warning">Unknown</span>';
    }
    
    getPricingDisplay(item, itemType) {
        const costPrice = item.costPrice || item.price || 0;
        
        switch (itemType) {
            case 'reselling':
                const sellingPrice = item.sellingPrice || 0;
                const profit = sellingPrice - costPrice;
                const margin = sellingPrice > 0 ? ((profit / sellingPrice) * 100).toFixed(1) : 0;
                return `
                    <div>
                        <small class="text-muted">Cost:</small> ${formatCurrency(costPrice)}<br>
                        <small class="text-muted">Sell:</small> ${formatCurrency(sellingPrice)}<br>
                        <small class="text-success">Margin: ${margin}%</small>
                    </div>
                `;
            case 'consumable':
            case 'office_equipment':
                return `
                    <div>
                        <small class="text-muted">Cost:</small> ${formatCurrency(costPrice)}
                    </div>
                `;
            default:
                return formatCurrency(costPrice);
        }
    }
    
    calculateItemValue(item, itemType) {
        const costPrice = item.costPrice || item.price || 0;
        const quantity = item.quantity || 0;
        
        switch (itemType) {
            case 'reselling':
                // Use selling price for reselling items value calculation
                return (item.sellingPrice || 0) * quantity;
            case 'consumable':
            case 'office_equipment':
                // Use cost price for consumables and office equipment
                return costPrice * quantity;
            default:
                return costPrice * quantity;
        }
    }
    
    getQuantityDisplay(item, itemType) {
        const quantity = item.quantity || 0;
        
        switch (itemType) {
            case 'reselling':
            case 'consumable':
                return `<span class="badge ${quantity < 5 ? 'bg-warning' : 'bg-success'}">${quantity}</span>`;
            case 'office_equipment':
                return `<span class="badge bg-secondary">${quantity}</span>`;
            default:
                return `<span class="badge bg-info">${quantity}</span>`;
        }
    }
    
    getDetailedPricingInfo(item, itemType) {
        const costPrice = item.costPrice || item.price || 0;
        
        switch (itemType) {
            case 'reselling':
                const sellingPrice = item.sellingPrice || 0;
                const profit = sellingPrice - costPrice;
                const margin = sellingPrice > 0 ? ((profit / sellingPrice) * 100).toFixed(1) : 0;
                const markup = costPrice > 0 ? ((profit / costPrice) * 100).toFixed(1) : 0;
                return `
                    <tr><th>Cost Price:</th><td>${formatCurrency(costPrice)}</td></tr>
                    <tr><th>Selling Price:</th><td>${formatCurrency(sellingPrice)}</td></tr>
                    <tr><th>Profit per Unit:</th><td class="${profit >= 0 ? 'text-success' : 'text-danger'}">${formatCurrency(profit)}</td></tr>
                    <tr><th>Profit Margin:</th><td class="text-info">${margin}%</td></tr>
                    <tr><th>Markup:</th><td class="text-info">${markup}%</td></tr>
                `;
            case 'consumable':
                return `<tr><th>Cost Price:</th><td>${formatCurrency(costPrice)}</td></tr>`;
            case 'office_equipment':
                const purchaseDate = item.purchaseDate ? new Date(item.purchaseDate) : null;
                const ageInMonths = purchaseDate ? Math.floor((new Date() - purchaseDate) / (1000 * 60 * 60 * 24 * 30.44)) : 0;
                return `
                    <tr><th>Cost Price:</th><td>${formatCurrency(costPrice)}</td></tr>
                    ${ageInMonths > 0 ? `<tr><th>Age:</th><td>${ageInMonths} months</td></tr>` : ''}
                `;
            default:
                return `<tr><th>Price:</th><td>${formatCurrency(costPrice)}</td></tr>`;
        }
    }

    getSupplierBadgeColor(supplier) {
        const colorMap = {
            'temu': 'temu',
            'transpharm': 'transpharm',
            'medis': 'medis',
            'other': 'secondary'
        };
        return colorMap[supplier] || 'secondary';
    }

    getSupplierDisplayName(supplier) {
        const nameMap = {
            'temu': 'Temu',
            'transpharm': 'Transpharm',
            'medis': 'Medis',
            'other': 'Other'
        };
        return nameMap[supplier] || supplier || 'Unknown';
    }


    async saveItem() {
        const form = document.getElementById('addItemForm');
        
        if (!validateForm(form)) {
            showToast('Please fill in all required fields', 'error');
            return;
        }

        try {
            const itemType = document.getElementById('itemType').value;
            
            const itemData = {
                name: document.getElementById('itemName').value.trim(),
                sku: document.getElementById('itemSKU').value.trim() || null,
                itemType: itemType,
                category: document.getElementById('itemCategory').value || null,
                costPrice: parseFloat(document.getElementById('itemCostPrice').value) || 0,
                // Legacy price field (for backward compatibility)
                price: parseFloat(document.getElementById('itemCostPrice').value) || 0,
                supplier: document.getElementById('itemSupplier').value || null,
                seller: document.getElementById('itemSeller').value.trim() || null,
                listingName: document.getElementById('itemListingName').value.trim() || null,
                description: document.getElementById('itemDescription').value.trim() || null,
                alternativeNames: parseAlternativeNames(document.getElementById('itemAltNames').value),
                imageData: this.currentImageData ? this.currentImageData.data : null
            };
            
            // Add type-specific fields
            if (itemType === 'reselling') {
                itemData.sellingPrice = parseFloat(document.getElementById('itemSellingPrice').value) || 0;
                itemData.quantity = parseInt(document.getElementById('itemQuantity').value) || 0;
                itemData.lowStockThreshold = parseInt(document.getElementById('itemLowStockThreshold').value) || 5;
            } else if (itemType === 'consumable') {
                itemData.quantity = parseInt(document.getElementById('itemQuantity').value) || 0;
                itemData.lowStockThreshold = parseInt(document.getElementById('itemLowStockThreshold').value) || 5;
            } else if (itemType === 'office_equipment') {
                itemData.purchaseDate = document.getElementById('itemPurchaseDate').value || null;
                itemData.quantity = 1; // Office equipment typically has quantity of 1
                // Office equipment doesn't use low stock threshold
            }

            await inventoryDB.addItem(itemData);
            
            // Close modal
            bootstrap.Modal.getInstance(document.getElementById('addItemModal')).hide();
            
            // Refresh items list
            await this.loadItems();
            
            // Check current active tab and refresh appropriate view
            // Look for both nav-link.active and dropdown-item.active
            const activeNavTab = document.querySelector('.nav-link.active');
            const activeDropdownTab = document.querySelector('.dropdown-item.active');
            const activeTab = activeDropdownTab || activeNavTab;
            
            if (activeTab) {
                const activeTabId = activeTab.id;
                console.log(`🔄 Active tab: ${activeTabId}`);
                
                // Refresh the appropriate type-specific view based on current tab
                if (activeTabId === 'resellingTab' && itemType === 'reselling') {
                    console.log(`🔄 Refreshing reselling table after adding ${itemType} item`);
                    await this.loadItemsByType('reselling');
                } else if (activeTabId === 'consumablesTab' && itemType === 'consumable') {
                    console.log(`🔄 Refreshing consumables table after adding ${itemType} item`);
                    await this.loadItemsByType('consumable');
                } else if (activeTabId === 'officeEquipmentTab' && itemType === 'office_equipment') {
                    console.log(`🔄 Refreshing office equipment table after adding ${itemType} item`);
                    await this.loadItemsByType('office_equipment');
                } else if (activeTabId === 'allItemsTab') {
                    console.log(`🔄 Refreshing all items table after adding ${itemType} item`);
                    // All items table is already refreshed by loadItems() above
                }
            } else {
                console.log(`⚠️ No active tab found, unable to refresh specific view`);
            }
            
            // Update dashboard
            if (window.dashboard) {
                await dashboard.refreshStats();
            }
            
            showToast('Item added successfully', 'success');
            
        } catch (error) {
            console.error('Error saving item:', error);
            showToast('Error saving item', 'error');
        }
    }

    async viewItem(itemId) {
        try {
            const item = await inventoryDB.getItemById(itemId);
            if (!item) {
                showToast('Item not found', 'error');
                return;
            }

            // Create and show item details modal
            this.showItemDetailsModal(item);
            
        } catch (error) {
            console.error('Error viewing item:', error);
            showToast('Error loading item details', 'error');
        }
    }

    showItemDetailsModal(item) {
        const itemType = item.itemType || 'reselling';
        const itemTypeBadge = this.getItemTypeBadge(itemType);
        const pricingDetails = this.getDetailedPricingInfo(item, itemType);
        
        const modalHtml = `
            <div class="modal fade" id="itemDetailsModal" tabindex="-1">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">
                                ${item.name}
                                <span class="ms-2">${itemTypeBadge}</span>
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="row">
                                <div class="col-md-4">
                                    ${item.imageData ? 
                                        `<img src="${item.imageData}" alt="${item.name}" class="img-fluid rounded">` :
                                        `<div class="bg-light text-center p-5 rounded">No Image</div>`
                                    }
                                </div>
                                <div class="col-md-8">
                                    <table class="table table-borderless">
                                        <tr><th>Item Type:</th><td>${itemTypeBadge}</td></tr>
                                        <tr><th>SKU:</th><td>${item.sku || 'N/A'}</td></tr>
                                        <tr><th>Category:</th><td>${item.category || 'N/A'}</td></tr>
                                        ${pricingDetails}
                                        ${itemType !== 'office_equipment' ? `<tr><th>Quantity:</th><td>${item.quantity || 0}</td></tr>` : ''}
                                        ${itemType === 'office_equipment' && item.purchaseDate ? 
                                            `<tr><th>Purchase Date:</th><td>${formatDate(item.purchaseDate)}</td></tr>` : ''}
                                        <tr><th>Total Value:</th><td>${formatCurrency(this.calculateItemValue(item, itemType))}</td></tr>
                                        <tr><th>Supplier:</th><td>${this.getSupplierDisplayName(item.supplier)}</td></tr>
                                        <tr><th>Seller:</th><td>${item.seller || 'N/A'}</td></tr>
                                        <tr><th>Listing Name:</th><td>${item.listingName || 'N/A'}</td></tr>
                                        <tr><th>Alternative Names:</th><td>${formatAlternativeNames(item.alternativeNames) || 'N/A'}</td></tr>
                                        <tr><th>Created:</th><td>${formatDate(item.createdAt)}</td></tr>
                                        <tr><th>Updated:</th><td>${formatDate(item.updatedAt)}</td></tr>
                                    </table>
                                </div>
                            </div>
                            ${item.description ? `
                                <div class="row mt-3">
                                    <div class="col-12">
                                        <h6>Description:</h6>
                                        <p>${item.description}</p>
                                    </div>
                                </div>
                            ` : ''}
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                            <button type="button" class="btn btn-warning" onclick="itemsManager.editItem(${item.id}); bootstrap.Modal.getInstance(document.getElementById('itemDetailsModal')).hide();">Edit</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Remove existing modal if any
        const existingModal = document.getElementById('itemDetailsModal');
        if (existingModal) {
            existingModal.remove();
        }

        // Add modal to page
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        // Show modal
        const modal = new bootstrap.Modal(document.getElementById('itemDetailsModal'));
        modal.show();

        // Remove modal from DOM after it's hidden
        document.getElementById('itemDetailsModal').addEventListener('hidden.bs.modal', function() {
            this.remove();
        });
    }

    async deleteItem(itemId) {
        if (!confirm('Are you sure you want to delete this item?')) {
            return;
        }

        try {
            // Get item info before deleting for refresh logic
            const item = this.items.find(i => i.id === itemId);
            const itemType = item ? item.itemType : null;
            
            await inventoryDB.deleteItem(itemId);
            await this.loadItems();
            
            // Check current active tab and refresh appropriate view
            // Look for both nav-link.active and dropdown-item.active
            const activeNavTab = document.querySelector('.nav-link.active');
            const activeDropdownTab = document.querySelector('.dropdown-item.active');
            const activeTab = activeDropdownTab || activeNavTab;
            
            if (activeTab && itemType) {
                const activeTabId = activeTab.id;
                console.log(`🔄 Active tab after delete: ${activeTabId}`);
                
                // Refresh the appropriate type-specific view based on current tab
                if (activeTabId === 'resellingTab' && itemType === 'reselling') {
                    console.log(`🔄 Refreshing reselling table after deleting ${itemType} item`);
                    await this.loadItemsByType('reselling');
                } else if (activeTabId === 'consumablesTab' && itemType === 'consumable') {
                    console.log(`🔄 Refreshing consumables table after deleting ${itemType} item`);
                    await this.loadItemsByType('consumable');
                } else if (activeTabId === 'officeEquipmentTab' && itemType === 'office_equipment') {
                    console.log(`🔄 Refreshing office equipment table after deleting ${itemType} item`);
                    await this.loadItemsByType('office_equipment');
                } else if (activeTabId === 'allItemsTab') {
                    console.log(`🔄 Refreshing all items table after deleting ${itemType} item`);
                    // All items table is already refreshed by loadItems() above
                }
            } else {
                console.log(`⚠️ No active tab found after delete, unable to refresh specific view`);
            }
            
            // Update dashboard
            if (window.dashboard) {
                await dashboard.refreshStats();
            }
            
            showToast('Item deleted successfully', 'success');
            
        } catch (error) {
            console.error('Error deleting item:', error);
            showToast('Error deleting item', 'error');
        }
    }

    async editItem(itemId) {
        try {
            const item = this.items.find(i => i.id === itemId);
            if (!item) {
                showToast('Item not found', 'error');
                return;
            }

            this.showEditItemModal(item);
            
        } catch (error) {
            console.error('Error editing item:', error);
            showToast('Error loading item for editing', 'error');
        }
    }

    async showEditItemModal(item) {
        const modalElement = document.getElementById('editItemModal');
        const form = document.getElementById('editItemForm');
        
        // Clean up any existing modal instances
        const existingModal = bootstrap.Modal.getInstance(modalElement);
        if (existingModal) {
            existingModal.dispose();
            console.log('🧹 Disposed existing edit modal instance');
        }
        
        const modal = new bootstrap.Modal(modalElement, {
            backdrop: true,
            keyboard: true,
            focus: true
        });
        
        // Reset form validation
        clearFormValidation(form);
        
        // Reset edit image data
        this.editImageData = null;
        
        // Populate form with current item data
        document.getElementById('editItemId').value = item.id;
        document.getElementById('editItemName').value = item.name || '';
        document.getElementById('editItemSKU').value = item.sku || '';
        document.getElementById('editItemType').value = item.itemType || 'reselling'; // Default to reselling for legacy items
        document.getElementById('editItemCostPrice').value = item.costPrice || item.price || '';
        document.getElementById('editItemSellingPrice').value = item.sellingPrice || '';
        document.getElementById('editItemQuantity').value = item.quantity || 0;
        document.getElementById('editItemPurchaseDate').value = item.purchaseDate || '';
        document.getElementById('editItemSeller').value = item.seller || '';
        document.getElementById('editItemListingName').value = item.listingName || '';
        document.getElementById('editItemAltNames').value = item.alternativeNames ? item.alternativeNames.join(', ') : '';
        document.getElementById('editItemDescription').value = item.description || '';
        
        // Set low stock threshold if available
        const lowStockThresholdInput = document.getElementById('editItemLowStockThreshold');
        if (lowStockThresholdInput) {
            lowStockThresholdInput.value = item.lowStockThreshold || 5;
        }
        
        // Handle item type-specific field visibility
        this.handleItemTypeChange(item.itemType || 'reselling', true);
        
        // Show current image if exists
        if (item.imageData) {
            document.getElementById('editCurrentImagePreview').style.display = 'block';
            document.getElementById('editCurrentImage').src = item.imageData;
        } else {
            document.getElementById('editCurrentImagePreview').style.display = 'none';
        }
        
        // Load and populate dropdowns
        await this.populateEditDropdowns(item);
        
        // Add cleanup event listeners
        const cleanupModal = () => {
            console.log('🧹 Cleaning up edit modal and backdrop');
            // Remove any lingering backdrops
            const backdrops = document.querySelectorAll('.modal-backdrop');
            backdrops.forEach(backdrop => {
                backdrop.remove();
                console.log('🗑️ Removed modal backdrop');
            });
            // Restore body classes
            document.body.classList.remove('modal-open');
            document.body.style.overflow = '';
            document.body.style.paddingRight = '';
        };
        
        // Clean up when modal is hidden
        modalElement.addEventListener('hidden.bs.modal', cleanupModal, { once: true });
        
        // Also clean up on dispose
        modalElement.addEventListener('disposed.bs.modal', cleanupModal, { once: true });
        
        modal.show();
    }

    async populateEditDropdowns(item) {
        // Populate suppliers dropdown
        try {
            const suppliers = await inventoryDB.getAllSuppliers();
            const supplierSelect = document.getElementById('editItemSupplier');
            supplierSelect.innerHTML = '<option value="">Select Supplier</option>';
            
            suppliers.forEach(supplier => {
                const option = document.createElement('option');
                option.value = supplier.code;
                option.textContent = supplier.name;
                option.selected = supplier.code === item.supplier;
                supplierSelect.appendChild(option);
            });
        } catch (error) {
            console.error('Error loading suppliers for edit:', error);
        }

        // Populate categories dropdown
        try {
            const categories = await inventoryDB.getAllCategories();
            const categorySelect = document.getElementById('editItemCategory');
            categorySelect.innerHTML = '<option value="">Select Category</option>';
            
            categories.forEach(category => {
                const option = document.createElement('option');
                option.value = category.code;
                option.textContent = category.name;
                option.selected = category.code === item.category;
                categorySelect.appendChild(option);
            });
        } catch (error) {
            console.error('Error loading categories for edit:', error);
        }
    }

    async updateItem() {
        const form = document.getElementById('editItemForm');
        
        if (!validateForm(form)) {
            showToast('Please fill in all required fields', 'error');
            return;
        }

        const itemId = parseInt(document.getElementById('editItemId').value);
        const itemName = document.getElementById('editItemName').value.trim();
        const itemSKU = document.getElementById('editItemSKU').value.trim();
        
        // Get the current item
        const currentItem = this.items.find(i => i.id === itemId);
        if (!currentItem) {
            showToast('Item not found', 'error');
            return;
        }
        
        // Check for SKU uniqueness (if SKU is provided and different from current)
        if (itemSKU && itemSKU !== currentItem.sku) {
            const existingItem = this.items.find(i => i.id !== itemId && i.sku === itemSKU);
            if (existingItem) {
                showToast('SKU already exists for another item', 'error');
                return;
            }
        }

        try {
            // Prepare update data
            const altNames = document.getElementById('editItemAltNames').value.trim();
            const itemType = document.getElementById('editItemType').value;
            
            const itemData = {
                name: itemName,
                sku: itemSKU || null,
                itemType: itemType,
                category: document.getElementById('editItemCategory').value || null,
                costPrice: parseFloat(document.getElementById('editItemCostPrice').value) || 0,
                // Legacy price field (for backward compatibility)
                price: parseFloat(document.getElementById('editItemCostPrice').value) || 0,
                supplier: document.getElementById('editItemSupplier').value || null,
                seller: document.getElementById('editItemSeller').value.trim() || null,
                listingName: document.getElementById('editItemListingName').value.trim() || null,
                alternativeNames: altNames ? altNames.split(',').map(name => name.trim()).filter(name => name) : null,
                description: document.getElementById('editItemDescription').value.trim() || null,
                // Keep existing image if no new image was uploaded
                imageData: this.editImageData !== null ? this.editImageData : currentItem.imageData
            };
            
            // Add type-specific fields
            if (itemType === 'reselling') {
                itemData.sellingPrice = parseFloat(document.getElementById('editItemSellingPrice').value) || 0;
                itemData.quantity = parseInt(document.getElementById('editItemQuantity').value) || 0;
                itemData.lowStockThreshold = parseInt(document.getElementById('editItemLowStockThreshold').value) || 5;
            } else if (itemType === 'consumable') {
                itemData.quantity = parseInt(document.getElementById('editItemQuantity').value) || 0;
                itemData.lowStockThreshold = parseInt(document.getElementById('editItemLowStockThreshold').value) || 5;
            } else if (itemType === 'office_equipment') {
                itemData.purchaseDate = document.getElementById('editItemPurchaseDate').value || null;
                itemData.quantity = currentItem.quantity || 1; // Keep existing quantity for office equipment
                // Office equipment doesn't use low stock threshold
            }

            await inventoryDB.updateItem(itemId, itemData);
            
            // Close modal
            bootstrap.Modal.getInstance(document.getElementById('editItemModal')).hide();
            
            // Refresh items list
            await this.loadItems();
            
            // Check current active tab and refresh appropriate view
            // Look for both nav-link.active and dropdown-item.active
            const activeNavTab = document.querySelector('.nav-link.active');
            const activeDropdownTab = document.querySelector('.dropdown-item.active');
            const activeTab = activeDropdownTab || activeNavTab;
            
            if (activeTab) {
                const activeTabId = activeTab.id;
                console.log(`🔄 Active tab after update: ${activeTabId}`);
                
                // Refresh the appropriate type-specific view based on current tab
                if (activeTabId === 'resellingTab' && itemType === 'reselling') {
                    console.log(`🔄 Refreshing reselling table after updating ${itemType} item`);
                    await this.loadItemsByType('reselling');
                } else if (activeTabId === 'consumablesTab' && itemType === 'consumable') {
                    console.log(`🔄 Refreshing consumables table after updating ${itemType} item`);
                    await this.loadItemsByType('consumable');
                } else if (activeTabId === 'officeEquipmentTab' && itemType === 'office_equipment') {
                    console.log(`🔄 Refreshing office equipment table after updating ${itemType} item`);
                    await this.loadItemsByType('office_equipment');
                } else if (activeTabId === 'allItemsTab') {
                    console.log(`🔄 Refreshing all items table after updating ${itemType} item`);
                    // All items table is already refreshed by loadItems() above
                }
            } else {
                console.log(`⚠️ No active tab found after update, unable to refresh specific view`);
            }
            
            // Update dashboard
            if (window.dashboard) {
                await dashboard.refreshStats();
            }
            
            showToast('Item updated successfully', 'success');
            
        } catch (error) {
            console.error('Error updating item:', error);
            showToast('Error updating item: ' + error.message, 'error');
        }
    }

    showBulkImportModal() {
        // Implementation for bulk import
        showToast('Bulk import functionality will be implemented soon', 'info');
    }

    handleItemTypeChange(itemType, isEdit = false) {
        console.log(`🔧 handleItemTypeChange called with itemType: ${itemType}, isEdit: ${isEdit}`);

        const prefix = isEdit ? 'edit' : '';
        const sellingPriceGroup = document.getElementById(`${prefix}SellingPriceGroup`);
        const purchaseDateGroup = document.getElementById(`${prefix}PurchaseDateGroup`);
        const quantityGroup = document.getElementById(`${prefix}QuantityGroup`);
        const lowStockThresholdGroup = document.getElementById(`${prefix}LowStockThresholdGroup`);

        // Inputs have different IDs for add vs edit forms
        const sellingPriceInput = document.getElementById(isEdit ? 'editItemSellingPrice' : 'itemSellingPrice');
        const purchaseDateInput = document.getElementById(isEdit ? 'editItemPurchaseDate' : 'itemPurchaseDate');

        // Debug: Log which elements were found
        console.log('🔍 Element search results:');
        console.log(`  sellingPriceGroup (${prefix}SellingPriceGroup): ${sellingPriceGroup ? '✅' : '❌'}`);
        console.log(`  purchaseDateGroup (${prefix}PurchaseDateGroup): ${purchaseDateGroup ? '✅' : '❌'}`);
        console.log(`  quantityGroup (${prefix}QuantityGroup): ${quantityGroup ? '✅' : '❌'}`);
        console.log(`  lowStockThresholdGroup (${prefix}LowStockThresholdGroup): ${lowStockThresholdGroup ? '✅' : '❌'}`);
        console.log(`  sellingPriceInput (${isEdit ? 'editItemSellingPrice' : 'itemSellingPrice'}): ${sellingPriceInput ? '✅' : '❌'}`);
        console.log(`  purchaseDateInput (${isEdit ? 'editItemPurchaseDate' : 'itemPurchaseDate'}): ${purchaseDateInput ? '✅' : '❌'}`);

        // Hide all conditional fields first (with null checks)
        if (sellingPriceGroup) sellingPriceGroup.style.display = 'none';
        if (purchaseDateGroup) purchaseDateGroup.style.display = 'none';
        if (quantityGroup) quantityGroup.style.display = 'none';
        if (lowStockThresholdGroup) lowStockThresholdGroup.style.display = 'none';

        // Clear required attributes (with null checks)
        if (sellingPriceInput) sellingPriceInput.removeAttribute('required');
        if (purchaseDateInput) purchaseDateInput.removeAttribute('required');
        
        switch (itemType) {
            case 'reselling':
                if (sellingPriceGroup) sellingPriceGroup.style.display = 'block';
                if (quantityGroup) quantityGroup.style.display = 'block';
                if (lowStockThresholdGroup) lowStockThresholdGroup.style.display = 'block';
                if (sellingPriceInput) sellingPriceInput.setAttribute('required', 'required');
                console.log('✅ Configured fields for reselling item');
                break;
            case 'consumable':
                if (quantityGroup) quantityGroup.style.display = 'block';
                if (lowStockThresholdGroup) lowStockThresholdGroup.style.display = 'block';
                console.log('✅ Configured fields for consumable item');
                break;
            case 'office_equipment':
                if (purchaseDateGroup) purchaseDateGroup.style.display = 'block';
                if (purchaseDateInput) purchaseDateInput.setAttribute('required', 'required');
                console.log('✅ Configured fields for office equipment');
                // Office equipment doesn't use quantity tracking or low stock alerts
                break;
            default:
                console.log(`⚠️ Unknown item type: ${itemType}`);
        }
    }

    async loadSupplierOptions(retryCount = 0) {
        try {
            const suppliers = await inventoryDB.getAllSuppliers();
            
            if (suppliers.length === 0 && retryCount < 3) {
                // Retry after a short delay if no suppliers found (database might still be initializing)
                setTimeout(() => {
                    this.loadSupplierOptions(retryCount + 1);
                }, 1000);
                return;
            }
            
            this.updateSupplierDropdowns(suppliers);
        } catch (error) {
            console.error('Error loading supplier options:', error);
            if (retryCount < 3) {
                setTimeout(() => {
                    this.loadSupplierOptions(retryCount + 1);
                }, 1000);
            } else {
                showToast('Error loading suppliers after multiple attempts', 'error');
            }
        }
    }

    updateSupplierDropdowns(suppliers) {
        // All supplier dropdowns to update
        const supplierDropdowns = [
            { id: 'itemSupplier', type: 'add', label: 'Select Supplier' },
            { id: 'editItemSupplier', type: 'edit', label: 'Select Supplier' },
            { id: 'supplierFilter', type: 'filter', label: 'All Suppliers' },
            { id: 'resellingSupplierFilter', type: 'filter', label: 'All Suppliers' },
            { id: 'consumablesSupplierFilter', type: 'filter', label: 'All Suppliers' },
            { id: 'officeEquipmentSupplierFilter', type: 'filter', label: 'All Suppliers' }
        ];
        
        supplierDropdowns.forEach(dropdown => {
            const element = document.getElementById(dropdown.id);
            if (element) {
                const currentValue = element.value;
                element.innerHTML = `<option value="">${dropdown.label}</option>`;
                
                suppliers.forEach(supplier => {
                    const option = document.createElement('option');
                    option.value = supplier.code;
                    option.textContent = supplier.name;
                    if (dropdown.type === 'add' || dropdown.type === 'edit') {
                        option.style.color = supplier.color;
                    }
                    if (supplier.code === currentValue) {
                        option.selected = true;
                    }
                    element.appendChild(option);
                });
            }
        });
    }

    async refreshSupplierOptions() {
        await this.loadSupplierOptions();
        // Also refresh the items table to update badge colors
        this.renderItemsTable();
    }

    async getSupplierByCode(code) {
        try {
            return await inventoryDB.getSupplierByCode(code);
        } catch (error) {
            console.error('Error getting supplier:', error);
            return null;
        }
    }

    async getSupplierBadgeColor(supplierCode) {
        try {
            const supplier = await this.getSupplierByCode(supplierCode);
            return supplier ? supplier.color : '#6c757d';
        } catch (error) {
            return '#6c757d'; // Default gray
        }
    }

    async getSupplierDisplayName(supplierCode) {
        try {
            const supplier = await this.getSupplierByCode(supplierCode);
            return supplier ? supplier.name : supplierCode || 'Unknown';
        } catch (error) {
            return supplierCode || 'Unknown';
        }
    }

    // CATEGORY MANAGEMENT METHODS

    async loadCategoryOptions(retryCount = 0) {
        try {
            const categories = await inventoryDB.getAllCategories();
            
            if (categories.length === 0 && retryCount < 3) {
                // Retry after a short delay if no categories found (database might still be initializing)
                setTimeout(() => {
                    this.loadCategoryOptions(retryCount + 1);
                }, 1000);
                return;
            }
            
            this.updateCategoryDropdowns(categories);
        } catch (error) {
            console.error('Error loading category options:', error);
            if (retryCount < 3) {
                setTimeout(() => {
                    this.loadCategoryOptions(retryCount + 1);
                }, 1000);
            } else {
                showToast('Error loading categories after multiple attempts', 'error');
            }
        }
    }

    updateCategoryDropdowns(categories) {
        const categorySelect = document.getElementById('itemCategory');
        const editCategorySelect = document.getElementById('editItemCategory');
        
        // Update main add item dropdown
        if (categorySelect) {
            // Clear existing options except the first one
            categorySelect.innerHTML = '<option value="">Select Category</option>';
            
            // Add category options
            categories.forEach(category => {
                const option = document.createElement('option');
                option.value = category.code;
                option.textContent = category.name;
                option.title = category.description || category.name;
                categorySelect.appendChild(option);
            });
        }
        
        // Update edit item dropdown
        if (editCategorySelect) {
            const currentValue = editCategorySelect.value;
            editCategorySelect.innerHTML = '<option value="">Select Category</option>';
            
            categories.forEach(category => {
                const option = document.createElement('option');
                option.value = category.code;
                option.textContent = category.name;
                option.title = category.description || category.name;
                if (category.code === currentValue) {
                    option.selected = true;
                }
                editCategorySelect.appendChild(option);
            });
        }
    }

    async refreshCategoryOptions() {
        await this.loadCategoryOptions();
        // Also refresh the items table if needed
        this.renderItemsTable();
    }

    async getCategoryByCode(code) {
        try {
            return await inventoryDB.getCategoryByCode(code);
        } catch (error) {
            console.error('Error getting category:', error);
            return null;
        }
    }

    async getCategoryDisplayName(categoryCode) {
        try {
            const category = await this.getCategoryByCode(categoryCode);
            return category ? category.name : categoryCode || 'Uncategorized';
        } catch (error) {
            return categoryCode || 'Uncategorized';
        }
    }
    
    // TYPE-SPECIFIC METHODS
    
    async loadItemsByType(itemType) {
        try {
            console.log(`Loading items by type: ${itemType}`);
            this.currentViewType = itemType;
            showLoading(this.getTableId(itemType));
            this.items = await inventoryDB.getAllItems();
            
            // Filter items by type
            this.filteredItems = this.items.filter(item => {
                const type = item.itemType || 'reselling'; // Default to reselling for legacy items
                return type === itemType;
            });
            
            await this.renderItemsByType(itemType);
            
            // Reinitialize event listeners for this tab
            setTimeout(() => {
                this.reinitializeEventListeners();
            }, 100);
        } catch (error) {
            console.error('Error loading items by type:', error);
            showToast('Error loading items', 'error');
            const tableId = this.getTableId(itemType);
            document.getElementById(tableId).innerHTML = 
                '<p class="text-muted">Error loading items</p>';
        }
    }
    
    async filterItemsByType(itemType) {
        if (itemType === null) {
            // All items view - use existing filter logic with type filter
            return this.filterItems();
        }
        
        const searchQuery = document.getElementById(this.getSearchId(itemType)).value;
        const supplierFilter = document.getElementById(this.getSupplierFilterId(itemType)).value;
        
        // Start with all items of this type
        const typeItems = this.items.filter(item => {
            const type = item.itemType || 'reselling';
            return type === itemType;
        });
        
        if (!searchQuery && !supplierFilter) {
            this.filteredItems = typeItems;
        } else {
            this.filteredItems = typeItems.filter(item => {
                const matchesSearch = !searchQuery || 
                    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    (item.sku && item.sku.toLowerCase().includes(searchQuery.toLowerCase())) ||
                    (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()));

                const matchesSupplier = !supplierFilter || item.supplier === supplierFilter;

                return matchesSearch && matchesSupplier;
            });
        }
        
        await this.renderItemsByType(itemType);
    }
    
    async filterItems() {
        const searchQuery = document.getElementById('itemSearch').value;
        const supplierFilter = document.getElementById('supplierFilter').value;
        const itemTypeFilter = document.getElementById('itemTypeFilter').value;

        if (!searchQuery && !supplierFilter && !itemTypeFilter) {
            this.filteredItems = [...this.items];
        } else {
            this.filteredItems = this.items.filter(item => {
                const matchesSearch = !searchQuery || 
                    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    (item.sku && item.sku.toLowerCase().includes(searchQuery.toLowerCase())) ||
                    (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()));

                const matchesSupplier = !supplierFilter || item.supplier === supplierFilter;
                
                const itemType = item.itemType || 'reselling';
                const matchesType = !itemTypeFilter || itemType === itemTypeFilter;

                return matchesSearch && matchesSupplier && matchesType;
            });
        }

        await this.renderItemsTable();
    }
    
    async renderItemsByType(itemType) {
        const tableId = this.getTableId(itemType);
        const container = document.getElementById(tableId);

        if (!this.filteredItems.length) {
            container.innerHTML = `<p class="text-muted">No ${this.getTypeDisplayName(itemType)} found.</p>`;
            return;
        }

        // Render type-specific table structure
        container.innerHTML = this.getTypeSpecificTableHTML(itemType);

        // Render rows asynchronously
        const tbody = document.getElementById(`${tableId}Body`);
        const rows = await Promise.all(
            this.filteredItems.map(item => this.renderTypeSpecificRow(item, itemType))
        );
        
        tbody.innerHTML = rows.join('');
    }
    
    getTypeSpecificTableHTML(itemType) {
        const colSpan = this.getColumnCount(itemType);
        const headers = this.getTypeSpecificHeaders(itemType);
        
        return `
            <div class="table-responsive">
                <table class="table table-striped">
                    <thead>
                        <tr>
                            ${headers}
                        </tr>
                    </thead>
                    <tbody id="${this.getTableId(itemType)}Body">
                        <tr><td colspan="${colSpan}" class="text-center">Loading items...</td></tr>
                    </tbody>
                </table>
            </div>
        `;
    }
    
    getTypeSpecificHeaders(itemType) {
        switch (itemType) {
            case 'reselling':
                return `
                    <th>Image</th>
                    <th>Name</th>
                    <th>SKU</th>
                    <th>Category</th>
                    <th>Supplier</th>
                    <th>Cost Price</th>
                    <th>Selling Price</th>
                    <th>Margin</th>
                    <th>Quantity</th>
                    <th>Total Value</th>
                    <th>Actions</th>
                `;
            case 'consumable':
                return `
                    <th>Image</th>
                    <th>Name</th>
                    <th>SKU</th>
                    <th>Category</th>
                    <th>Supplier</th>
                    <th>Cost Price</th>
                    <th>Quantity</th>
                    <th>Total Value</th>
                    <th>Actions</th>
                `;
            case 'office_equipment':
                return `
                    <th>Image</th>
                    <th>Name</th>
                    <th>SKU</th>
                    <th>Category</th>
                    <th>Supplier</th>
                    <th>Cost Price</th>
                    <th>Purchase Date</th>
                    <th>Age</th>
                    <th>Actions</th>
                `;
            default:
                return `
                    <th>Image</th>
                    <th>Name</th>
                    <th>Type</th>
                    <th>SKU</th>
                    <th>Category</th>
                    <th>Supplier</th>
                    <th>Pricing</th>
                    <th>Quantity</th>
                    <th>Value</th>
                    <th>Actions</th>
                `;
        }
    }
    
    getColumnCount(itemType) {
        switch (itemType) {
            case 'reselling': return 11;
            case 'consumable': return 9;
            case 'office_equipment': return 9;
            default: return 10;
        }
    }
    
    getTableId(itemType) {
        switch (itemType) {
            case 'reselling': return 'resellingTable';
            case 'consumable': return 'consumablesTable';
            case 'office_equipment': return 'officeEquipmentTable';
            default: return 'itemsTable';
        }
    }
    
    getSearchId(itemType) {
        switch (itemType) {
            case 'reselling': return 'resellingSearch';
            case 'consumable': return 'consumablesSearch';
            case 'office_equipment': return 'officeEquipmentSearch';
            default: return 'itemSearch';
        }
    }
    
    getSupplierFilterId(itemType) {
        switch (itemType) {
            case 'reselling': return 'resellingSupplierFilter';
            case 'consumable': return 'consumablesSupplierFilter';
            case 'office_equipment': return 'officeEquipmentSupplierFilter';
            default: return 'supplierFilter';
        }
    }
    
    getTypeDisplayName(itemType) {
        switch (itemType) {
            case 'reselling': return 'reselling items';
            case 'consumable': return 'consumables';
            case 'office_equipment': return 'office equipment';
            default: return 'items';
        }
    }
    
    showAddItemModal(itemType = null) {
        console.log('🚀 showAddItemModal called with itemType:', itemType);
        
        const modalElement = document.getElementById('addItemModal');
        const form = document.getElementById('addItemForm');
        
        if (!modalElement) {
            console.error('❌ addItemModal element not found!');
            showToast('Modal not found. Please refresh the page.', 'error');
            return;
        }
        
        if (!form) {
            console.error('❌ addItemForm element not found!');
            showToast('Form not found. Please refresh the page.', 'error');
            return;
        }
        
        console.log('✅ Modal and form elements found');
        
        // Clean up any existing modal instances
        const existingModal = bootstrap.Modal.getInstance(modalElement);
        if (existingModal) {
            existingModal.dispose();
            console.log('🧹 Disposed existing modal instance');
        }
        
        const modal = new bootstrap.Modal(modalElement, {
            backdrop: true,
            keyboard: true,
            focus: true
        });
        
        // Reset form
        resetForm(form);
        this.currentImageData = null;
        console.log('✅ Form reset completed');
        
        // Pre-select item type if specified
        if (itemType) {
            const itemTypeElement = document.getElementById('itemType');
            if (itemTypeElement) {
                itemTypeElement.value = itemType;
                console.log('✅ Item type pre-selected:', itemType);
                this.handleItemTypeChange(itemType, false);
            } else {
                console.error('❌ itemType select element not found!');
            }
        }
        
        // Add cleanup event listeners
        const cleanupModal = () => {
            console.log('🧹 Cleaning up modal and backdrop');
            // Remove any lingering backdrops
            const backdrops = document.querySelectorAll('.modal-backdrop');
            backdrops.forEach(backdrop => {
                backdrop.remove();
                console.log('🗑️ Removed modal backdrop');
            });
            // Restore body classes
            document.body.classList.remove('modal-open');
            document.body.style.overflow = '';
            document.body.style.paddingRight = '';
        };
        
        // Clean up when modal is hidden
        modalElement.addEventListener('hidden.bs.modal', cleanupModal, { once: true });
        
        // Also clean up on dispose
        modalElement.addEventListener('disposed.bs.modal', cleanupModal, { once: true });
        
        // Refresh supplier and category options before showing modal
        this.loadSupplierOptions();
        this.loadCategoryOptions();
        console.log('✅ Loading supplier and category options');
        
        modal.show();
        console.log('✅ Modal shown successfully');
    }
    
    async renderTypeSpecificRow(item, itemType) {
        // Add debugging for null/undefined items
        if (!item || item === null || item === undefined) {
            console.error('❌ renderTypeSpecificRow: item is null or undefined:', item);
            return '<tr><td colspan="9" class="text-danger text-center">Error: Invalid item data</td></tr>';
        }
        
        if (!item.id) {
            console.error('❌ renderTypeSpecificRow: item missing ID:', item);
            return '<tr><td colspan="9" class="text-danger text-center">Error: Item missing ID</td></tr>';
        }
        
        console.log(`📝 Rendering ${itemType} item:`, item.name || '[NO NAME]', 'ID:', item.id);
        
        const imageHtml = item.imageData ? 
            `<img src="${item.imageData}" alt="${item.name || 'Item'}" class="img-thumbnail" style="width: 50px; height: 50px; object-fit: cover;">` :
            `<div class="bg-light text-center" style="width: 50px; height: 50px; line-height: 50px; font-size: 12px;">No Image</div>`;

        const supplierColor = await this.getSupplierBadgeColor(item.supplier);
        const supplierName = await this.getSupplierDisplayName(item.supplier);
        const costPrice = item.costPrice || item.price || 0;
        
        const itemName = item.name || '[Unnamed Item]';
        const listingName = item.listingName || '';
        
        const baseColumns = `
            <td>${imageHtml}</td>
            <td>
                <div class="fw-bold">
                    <a href="#" class="item-name-link text-decoration-none" data-item-id="${item.id}">
                        ${itemName}
                    </a>
                </div>
                <small class="text-muted">${listingName}</small>
            </td>
            <td>${item.sku || ''}</td>
            <td>${item.category || ''}</td>
            <td>
                <span class="badge" style="background-color: ${supplierColor}; color: white;">
                    ${supplierName}
                </span>
            </td>
        `;
        
        const actionsColumn = `
            <td>
                <div class="btn-group btn-group-sm" role="group">
                    <button type="button" class="btn btn-outline-primary" onclick="stockManager.showEnhancedItemDetails(${item.id})">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button type="button" class="btn btn-outline-warning" onclick="itemsManager.editItem(${item.id})">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button type="button" class="btn btn-outline-danger" onclick="itemsManager.deleteItem(${item.id})">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        `;
        
        switch (itemType) {
            case 'reselling':
                const sellingPrice = item.sellingPrice || 0;
                const profit = sellingPrice - costPrice;
                const margin = sellingPrice > 0 ? ((profit / sellingPrice) * 100).toFixed(1) : 0;
                const totalValue = sellingPrice * (item.quantity || 0);
                
                return `
                    <tr>
                        ${baseColumns}
                        <td>${formatCurrency(costPrice)}</td>
                        <td>${formatCurrency(sellingPrice)}</td>
                        <td class="${profit >= 0 ? 'text-success' : 'text-danger'}">${margin}%</td>
                        <td><span class="badge ${(item.quantity || 0) < 5 ? 'bg-warning' : 'bg-success'}">${item.quantity || 0}</span></td>
                        <td>${formatCurrency(totalValue)}</td>
                        ${actionsColumn}
                    </tr>
                `;
                
            case 'consumable':
                const consumableValue = costPrice * (item.quantity || 0);
                return `
                    <tr>
                        ${baseColumns}
                        <td>${formatCurrency(costPrice)}</td>
                        <td><span class="badge ${(item.quantity || 0) < 5 ? 'bg-warning' : 'bg-success'}">${item.quantity || 0}</span></td>
                        <td>${formatCurrency(consumableValue)}</td>
                        ${actionsColumn}
                    </tr>
                `;
                
            case 'office_equipment':
                const purchaseDate = item.purchaseDate ? new Date(item.purchaseDate) : null;
                const ageInMonths = purchaseDate ? Math.floor((new Date() - purchaseDate) / (1000 * 60 * 60 * 24 * 30.44)) : 0;
                return `
                    <tr>
                        ${baseColumns}
                        <td>${formatCurrency(costPrice)}</td>
                        <td>${purchaseDate ? formatDate(item.purchaseDate) : 'N/A'}</td>
                        <td>${ageInMonths > 0 ? `${ageInMonths} months` : 'N/A'}</td>
                        ${actionsColumn}
                    </tr>
                `;
                
            default:
                // For "All Items" view - use the existing renderItemRow method
                return this.renderItemRow(item);
        }
    }
}

// Create global items manager instance
const itemsManager = new ItemsManager();

// Debug helper - make available in global scope for console testing
window.testAddButtons = function() {
    console.log('=== TESTING ADD BUTTONS ===');
    
    const buttons = [
        { id: 'addResellingItemBtn', type: 'reselling' },
        { id: 'addConsumableBtn', type: 'consumable' },
        { id: 'addOfficeEquipmentBtn', type: 'office_equipment' }
    ];
    
    buttons.forEach(({ id, type }) => {
        const element = document.getElementById(id);
        console.log(`${id}: ${element ? '✅ Found' : '❌ Not Found'}`);
        if (element) {
            console.log(`  - Testing click for ${type}...`);
            try {
                itemsManager.showAddItemModal(type);
                console.log(`  ✅ Successfully called showAddItemModal for ${type}`);
            } catch (error) {
                console.error(`  ❌ Error calling showAddItemModal for ${type}:`, error);
            }
        }
    });
    
    console.log('=== END BUTTON TEST ===');
};

// Also make itemsManager available globally for debugging
window.itemsManager = itemsManager;
window.debugButtons = () => itemsManager.debugButtons();

// Make cleanup function available globally for emergency use
window.cleanupModals = () => itemsManager.cleanupAllModals();
