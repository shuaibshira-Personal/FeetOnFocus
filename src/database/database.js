/**
 * FeetOnFocus Database Layer
 * Uses IndexedDB for local storage of inventory items
 */

class InventoryDatabase {
    constructor() {
        this.dbName = 'FeetOnFocusDB';
        this.dbVersion = 8; // Incremented to add Courier & Shipping category
        this.db = null;
    }

    /**
     * Initialize the database
     */
    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);
            
            request.onerror = () => {
                reject(new Error('Failed to open database'));
            };
            
            request.onsuccess = async (event) => {
                this.db = event.target.result;
                
                // Initialize default suppliers if they were marked for initialization
                if (this._defaultSuppliersToInit) {
                    await this.initializeDefaultSuppliers(this._defaultSuppliersToInit);
                    delete this._defaultSuppliersToInit;
                }
                
                // Initialize default categories if they were marked for initialization
                if (this._defaultCategoriesToInit) {
                    await this.initializeDefaultCategories(this._defaultCategoriesToInit);
                    delete this._defaultCategoriesToInit;
                }
                
                resolve(this.db);
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // Create Items object store
                if (!db.objectStoreNames.contains('items')) {
                    const itemsStore = db.createObjectStore('items', { 
                        keyPath: 'id', 
                        autoIncrement: true 
                    });
                    
                    // Create indexes for better querying
                    itemsStore.createIndex('name', 'name', { unique: false });
                    itemsStore.createIndex('sku', 'sku', { unique: true });
                    itemsStore.createIndex('barcode', 'barcode', { unique: false });
                    itemsStore.createIndex('supplier', 'supplier', { unique: false });
                    itemsStore.createIndex('category', 'category', { unique: false });
                    itemsStore.createIndex('listingName', 'listingName', { unique: false });
                    itemsStore.createIndex('itemType', 'itemType', { unique: false });
                }
                
                // Create Invoices object store (for Phase 2)
                if (!db.objectStoreNames.contains('invoices')) {
                    const invoicesStore = db.createObjectStore('invoices', { 
                        keyPath: 'id', 
                        autoIncrement: true 
                    });
                    
                    invoicesStore.createIndex('date', 'date', { unique: false });
                    invoicesStore.createIndex('type', 'type', { unique: false }); // 'purchase' or 'sale'
                    invoicesStore.createIndex('supplier', 'supplier', { unique: false });
                    invoicesStore.createIndex('invoiceNumber', 'invoiceNumber', { unique: false });
                    invoicesStore.createIndex('status', 'status', { unique: false });
                }
                
                // Create Invoice Line Items object store
                if (!db.objectStoreNames.contains('invoiceLineItems')) {
                    const lineItemsStore = db.createObjectStore('invoiceLineItems', { 
                        keyPath: 'id', 
                        autoIncrement: true 
                    });
                    
                    lineItemsStore.createIndex('invoiceId', 'invoiceId', { unique: false });
                    lineItemsStore.createIndex('itemId', 'itemId', { unique: false });
                    lineItemsStore.createIndex('status', 'status', { unique: false }); // 'matched', 'pending', 'new'
                }
                
                // Create Activity Log object store
                if (!db.objectStoreNames.contains('activity')) {
                    const activityStore = db.createObjectStore('activity', { 
                        keyPath: 'id', 
                        autoIncrement: true 
                    });
                    
                    activityStore.createIndex('timestamp', 'timestamp', { unique: false });
                    activityStore.createIndex('type', 'type', { unique: false });
                }
                
                // Create Purchase Log object store
                if (!db.objectStoreNames.contains('purchases')) {
                    const purchasesStore = db.createObjectStore('purchases', { 
                        keyPath: 'id', 
                        autoIncrement: true 
                    });
                    
                    purchasesStore.createIndex('orderDate', 'orderDate', { unique: false });
                    purchasesStore.createIndex('supplier', 'supplier', { unique: false });
                    purchasesStore.createIndex('invoiceReference', 'invoiceReference', { unique: false });
                    purchasesStore.createIndex('status', 'status', { unique: false });
                }
                
                // Create Stock History object store
                if (!db.objectStoreNames.contains('stockHistory')) {
                    const stockHistoryStore = db.createObjectStore('stockHistory', { 
                        keyPath: 'id', 
                        autoIncrement: true 
                    });
                    
                    stockHistoryStore.createIndex('itemId', 'itemId', { unique: false });
                    stockHistoryStore.createIndex('date', 'date', { unique: false });
                    stockHistoryStore.createIndex('type', 'type', { unique: false }); // 'purchase', 'sale', 'usage', 'adjustment'
                    stockHistoryStore.createIndex('timestamp', 'timestamp', { unique: false });
                }
                
                // Create Suppliers object store
                if (!db.objectStoreNames.contains('suppliers')) {
                    const suppliersStore = db.createObjectStore('suppliers', { 
                        keyPath: 'id', 
                        autoIncrement: true 
                    });
                    
                    suppliersStore.createIndex('name', 'name', { unique: true });
                    suppliersStore.createIndex('code', 'code', { unique: true });
                    
                    // Add default suppliers
                    const defaultSuppliers = [
                        { name: 'Temu', code: 'temu', color: '#FF6B35', isDefault: true },
                        { name: 'Transpharm', code: 'transpharm', color: '#17a2b8', isDefault: true },
                        { name: 'Medis', code: 'medis', color: '#28a745', isDefault: true },
                        { name: 'Other', code: 'other', color: '#6c757d', isDefault: true }
                    ];
                    
                    // Mark for initialization after database is ready
                    this._defaultSuppliersToInit = defaultSuppliers;
                }
                
                // Create Categories object store
                if (!db.objectStoreNames.contains('categories')) {
                    const categoriesStore = db.createObjectStore('categories', { 
                        keyPath: 'id', 
                        autoIncrement: true 
                    });
                    
                    categoriesStore.createIndex('name', 'name', { unique: true });
                    categoriesStore.createIndex('code', 'code', { unique: true });
                    
                    // Add default categories for podiatry practice with colors
                    const defaultCategories = [
                        { name: 'Orthotic Materials', code: 'orthotic_materials', color: '#E91E63', description: 'Materials for making orthotics', isDefault: true },
                        { name: 'Footwear', code: 'footwear', color: '#9C27B0', description: 'Therapeutic and orthopedic footwear', isDefault: true },
                        { name: 'Instruments', code: 'instruments', color: '#3F51B5', description: 'Medical instruments and tools', isDefault: true },
                        { name: 'Consumables', code: 'consumables', color: '#4CAF50', description: 'Disposable medical supplies', isDefault: true },
                        { name: 'Equipment', code: 'equipment', color: '#FF9800', description: 'Medical equipment and devices', isDefault: true },
                        { name: 'Courier & Shipping', code: 'courier_shipping', color: '#795548', description: 'Delivery fees and shipping costs', isDefault: true },
                        { name: 'Other', code: 'other', color: '#6c757d', description: 'Miscellaneous items', isDefault: true }
                    ];
                    
                    // Mark for initialization after database is ready
                    this._defaultCategoriesToInit = defaultCategories;
                }
                
                // Upgrade existing items for packaging system (v6 -> v7)
                if (event.oldVersion < 7 && db.objectStoreNames.contains('items')) {
                    console.log('🔄 Upgrading items for packaging system...');
                    const itemsStore = event.target.transaction.objectStore('items');
                    const itemsRequest = itemsStore.getAll();
                    
                    itemsRequest.onsuccess = () => {
                        const items = itemsRequest.result;
                        items.forEach(item => {
                            // Add default packaging fields if not present
                            if (item.packSize === undefined) {
                                item.packSize = 1; // Default to single unit
                            }
                            if (item.packType === undefined) {
                                item.packType = 'single'; // single, pack
                            }
                            if (item.sellIndividually === undefined) {
                                item.sellIndividually = true; // Default to selling individually
                            }
                            if (item.individualPrice === undefined) {
                                // Set individual price same as current purchase price
                                item.individualPrice = item.purchasePrice || 0;
                            }
                            if (item.packPrice === undefined) {
                                // Set pack price same as current purchase price
                                item.packPrice = item.purchasePrice || 0;
                            }
                            
                            item.updatedAt = new Date().toISOString();
                            
                            // Save the updated item
                            itemsStore.put(item);
                        });
                    };
                }
                
                // Add new categories for existing databases (v7 -> v8)
                if (event.oldVersion < 8 && db.objectStoreNames.contains('categories')) {
                    console.log('🔄 Adding new categories: Courier & Shipping...');
                    const categoriesStore = event.target.transaction.objectStore('categories');
                    
                    // Check if Courier & Shipping category already exists
                    const courierRequest = categoriesStore.index('code').get('courier_shipping');
                    courierRequest.onsuccess = () => {
                        if (!courierRequest.result) {
                            // Add the new category
                            const newCategory = {
                                name: 'Courier & Shipping',
                                code: 'courier_shipping',
                                color: '#795548',
                                description: 'Delivery fees and shipping costs',
                                isDefault: true,
                                createdAt: new Date().toISOString(),
                                updatedAt: new Date().toISOString()
                            };
                            categoriesStore.add(newCategory);
                            console.log('✅ Added Courier & Shipping category');
                        } else {
                            console.log('ℹ️ Courier & Shipping category already exists');
                        }
                    };
                }
                
            };
        });
    }

    /**
     * Add a new item to the database
     * @param {Object} itemData - Item data object
     */
    async addItem(itemData) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['items', 'activity'], 'readwrite');
            const itemsStore = transaction.objectStore('items');
            const activityStore = transaction.objectStore('activity');
            
            // Debug: Log what data is being stored
            console.log('💾 Debug database.addItem - itemData received:');
            console.log(itemData);
            console.log('  name type:', typeof itemData.name);
            console.log('  name value:', itemData.name);
            
            // Prepare item data with timestamp
            const item = {
                ...itemData,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            
            console.log('💾 Debug database.addItem - final item to store:');
            console.log(item);
            
            const addRequest = itemsStore.add(item);
            
            addRequest.onsuccess = (event) => {
                const itemId = event.target.result;
                
                // Log activity
                activityStore.add({
                    type: 'item_added',
                    description: `Added item: ${item.name}`,
                    timestamp: new Date().toISOString(),
                    itemId: itemId
                });
                
                resolve({ id: itemId, ...item });
            };
            
            addRequest.onerror = () => {
                reject(new Error('Failed to add item'));
            };
        });
    }

    /**
     * Get all items from the database
     */
    async getAllItems() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['items'], 'readonly');
            const store = transaction.objectStore('items');
            const request = store.getAll();
            
            request.onsuccess = () => {
                resolve(request.result);
            };
            
            request.onerror = () => {
                reject(new Error('Failed to get items'));
            };
        });
    }

    /**
     * Get item by ID
     * @param {number} id - Item ID
     */
    async getItemById(id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['items'], 'readonly');
            const store = transaction.objectStore('items');
            const request = store.get(id);
            
            request.onsuccess = () => {
                resolve(request.result);
            };
            
            request.onerror = () => {
                reject(new Error('Failed to get item'));
            };
        });
    }

    /**
     * Get item by SKU
     * @param {string} sku - Item SKU
     */
    async getItemBySKU(sku) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['items'], 'readonly');
            const store = transaction.objectStore('items');
            const index = store.index('sku');
            const request = index.get(sku);
            
            request.onsuccess = () => {
                resolve(request.result);
            };
            
            request.onerror = () => {
                reject(new Error('Failed to get item by SKU'));
            };
        });
    }

    /**
     * Update an existing item
     * @param {number} id - Item ID
     * @param {Object} itemData - Updated item data
     */
    async updateItem(id, itemData) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['items', 'activity'], 'readwrite');
            const itemsStore = transaction.objectStore('items');
            const activityStore = transaction.objectStore('activity');
            
            // First get the existing item
            const getRequest = itemsStore.get(id);
            
            getRequest.onsuccess = () => {
                const existingItem = getRequest.result;
                if (!existingItem) {
                    reject(new Error('Item not found'));
                    return;
                }
                
                // Update item data
                const updatedItem = {
                    ...existingItem,
                    ...itemData,
                    updatedAt: new Date().toISOString()
                };
                
                const updateRequest = itemsStore.put(updatedItem);
                
                updateRequest.onsuccess = () => {
                    // Log activity
                    activityStore.add({
                        type: 'item_updated',
                        description: `Updated item: ${updatedItem.name}`,
                        timestamp: new Date().toISOString(),
                        itemId: id
                    });
                    
                    resolve(updatedItem);
                };
                
                updateRequest.onerror = () => {
                    reject(new Error('Failed to update item'));
                };
            };
        });
    }

    /**
     * Delete an item
     * @param {number} id - Item ID
     */
    async deleteItem(id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['items', 'activity'], 'readwrite');
            const itemsStore = transaction.objectStore('items');
            const activityStore = transaction.objectStore('activity');
            
            // First get the item for logging
            const getRequest = itemsStore.get(id);
            
            getRequest.onsuccess = () => {
                const item = getRequest.result;
                if (!item) {
                    reject(new Error('Item not found'));
                    return;
                }
                
                const deleteRequest = itemsStore.delete(id);
                
                deleteRequest.onsuccess = () => {
                    // Log activity
                    activityStore.add({
                        type: 'item_deleted',
                        description: `Deleted item: ${item.name}`,
                        timestamp: new Date().toISOString(),
                        itemId: id
                    });
                    
                    resolve(true);
                };
                
                deleteRequest.onerror = () => {
                    reject(new Error('Failed to delete item'));
                };
            };
        });
    }

    /**
     * Search items by various criteria
     * @param {string} query - Search query
     * @param {string} supplier - Filter by supplier (optional)
     * @param {string} category - Filter by category (optional)
     */
    async searchItems(query = '', supplier = '', category = '') {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['items'], 'readonly');
            const store = transaction.objectStore('items');
            const request = store.getAll();
            
            request.onsuccess = () => {
                let items = request.result;
                
                // Apply filters
                if (query) {
                    const lowerQuery = query.toLowerCase();
                    items = items.filter(item => 
                        item.name.toLowerCase().includes(lowerQuery) ||
                        item.sku?.toLowerCase().includes(lowerQuery) ||
                        item.description?.toLowerCase().includes(lowerQuery) ||
                        item.listingName?.toLowerCase().includes(lowerQuery) ||
                        (item.alternativeNames && item.alternativeNames.some(alt => 
                            alt.toLowerCase().includes(lowerQuery)
                        ))
                    );
                }
                
                if (supplier) {
                    items = items.filter(item => item.supplier === supplier);
                }
                
                if (category) {
                    items = items.filter(item => item.category === category);
                }
                
                resolve(items);
            };
            
            request.onerror = () => {
                reject(new Error('Failed to search items'));
            };
        });
    }

    /**
     * Get recent activity logs
     * @param {number} limit - Number of activities to return
     */
    async getRecentActivity(limit = 10) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['activity'], 'readonly');
            const store = transaction.objectStore('activity');
            const index = store.index('timestamp');
            const request = index.openCursor(null, 'prev'); // Reverse order (newest first)
            
            const activities = [];
            let count = 0;
            
            request.onsuccess = (event) => {
                const cursor = event.target.result;
                
                if (cursor && count < limit) {
                    activities.push(cursor.value);
                    count++;
                    cursor.continue();
                } else {
                    resolve(activities);
                }
            };
            
            request.onerror = () => {
                reject(new Error('Failed to get activity'));
            };
        });
    }

    /**
     * Get database statistics
     */
    async getStatistics() {
        try {
            // Get items and suppliers in parallel
            const [items, suppliers] = await Promise.all([
                this.getAllItems(),
                this.getAllSuppliers()
            ]);
            
            const stats = {
                totalItems: items.length,
                totalValue: items.reduce((sum, item) => {
                    // Calculate value based on available price fields
                    const price = item.sellingPrice || item.costPrice || 0;
                    const quantity = item.quantity || 1;
                    return sum + (price * quantity);
                }, 0),
                lowStockItems: items.filter(item => {
                    // Only count items that have quantity tracking (reselling and consumables)
                    if (item.itemType === 'office_equipment') return false;
                    
                    const currentQuantity = item.quantity || 0;
                    const threshold = item.lowStockThreshold || 5; // Default to 5 if not set
                    
                    return currentQuantity < threshold;
                }).length,
                pendingOrders: items.filter(item => item.orderStatus === 'ordered').length,
                suppliers: [...new Set(items.map(item => item.supplier).filter(s => s))],
                categories: [...new Set(items.map(item => item.category).filter(c => c))],
                suppliersCount: suppliers.length
            };
            
            return stats;
        } catch (error) {
            throw new Error('Failed to get statistics');
        }
    }

    /**
     * Get items that are low in stock
     */
    async getLowStockItems() {
        try {
            const items = await this.getAllItems();
            
            return items.filter(item => {
                // Only include items that have quantity tracking (reselling and consumables)
                if (item.itemType === 'office_equipment') return false;
                
                const currentQuantity = item.quantity || 0;
                const threshold = item.lowStockThreshold || 5; // Default to 5 if not set
                
                return currentQuantity < threshold;
            });
        } catch (error) {
            throw new Error('Failed to get low stock items');
        }
    }

    /**
     * Get items that have pending orders
     */
    async getPendingOrders() {
        try {
            const items = await this.getAllItems();
            
            return items.filter(item => item.orderStatus === 'ordered');
        } catch (error) {
            throw new Error('Failed to get pending orders');
        }
    }

    /**
     * Update item order status
     * @param {number} itemId - Item ID
     * @param {number} orderedQuantity - Quantity ordered
     * @param {string} orderDate - Order date
     * @param {string} expectedDelivery - Expected delivery date (optional)
     */
    async updateItemOrderStatus(itemId, orderedQuantity, orderDate, expectedDelivery = null) {
        try {
            const item = await this.getItemById(itemId);
            if (!item) {
                throw new Error('Item not found');
            }
            
            const orderData = {
                orderedQuantity: orderedQuantity,
                orderDate: orderDate,
                expectedDelivery: expectedDelivery,
                orderStatus: 'ordered',
                lastOrderedAt: new Date().toISOString()
            };
            
            // Update the item with order information
            const updatedItem = await this.updateItem(itemId, orderData);
            
            return updatedItem;
        } catch (error) {
            throw new Error('Failed to update order status: ' + error.message);
        }
    }

    /**
     * Mark item as received and update stock
     * @param {number} itemId - Item ID
     * @param {number} receivedQuantity - Quantity received
     */
    async markItemAsReceived(itemId, receivedQuantity) {
        try {
            const item = await this.getItemById(itemId);
            if (!item) {
                throw new Error('Item not found');
            }
            
            const newQuantity = (item.quantity || 0) + receivedQuantity;
            
            const updateData = {
                quantity: newQuantity,
                orderStatus: 'received',
                receivedDate: new Date().toISOString(),
                receivedQuantity: receivedQuantity
            };
            
            // Clear order data since item is received
            delete updateData.orderedQuantity;
            delete updateData.orderDate;
            delete updateData.expectedDelivery;
            
            const updatedItem = await this.updateItem(itemId, updateData);
            
            return updatedItem;
        } catch (error) {
            throw new Error('Failed to mark item as received: ' + error.message);
        }
    }

    /**
     * Create a purchase record
     * @param {Object} purchaseData - Purchase data object
     */
    async createPurchase(purchaseData) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['purchases', 'activity'], 'readwrite');
            const purchasesStore = transaction.objectStore('purchases');
            const activityStore = transaction.objectStore('activity');
            
            const purchase = {
                ...purchaseData,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            
            const addRequest = purchasesStore.add(purchase);
            
            addRequest.onsuccess = (event) => {
                const purchaseId = event.target.result;
                
                // Log activity
                activityStore.add({
                    type: 'purchase_created',
                    description: `Created purchase order: ${purchase.invoiceReference || 'No reference'}`,
                    timestamp: new Date().toISOString(),
                    purchaseId: purchaseId
                });
                
                resolve({ id: purchaseId, ...purchase });
            };
            
            addRequest.onerror = () => {
                reject(new Error('Failed to create purchase record'));
            };
        });
    }

    /**
     * Get all purchases
     */
    async getAllPurchases() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['purchases'], 'readonly');
            const store = transaction.objectStore('purchases');
            const request = store.getAll();
            
            request.onsuccess = () => {
                // Sort by order date, newest first
                const purchases = request.result.sort((a, b) => 
                    new Date(b.orderDate) - new Date(a.orderDate)
                );
                resolve(purchases);
            };
            
            request.onerror = () => {
                reject(new Error('Failed to get purchases'));
            };
        });
    }

    /**
     * Get purchases by supplier
     * @param {string} supplierCode - Supplier code
     */
    async getPurchasesBySupplier(supplierCode) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['purchases'], 'readonly');
            const store = transaction.objectStore('purchases');
            const index = store.index('supplier');
            const request = index.getAll(supplierCode);
            
            request.onsuccess = () => {
                const purchases = request.result.sort((a, b) => 
                    new Date(b.orderDate) - new Date(a.orderDate)
                );
                resolve(purchases);
            };
            
            request.onerror = () => {
                reject(new Error('Failed to get purchases by supplier'));
            };
        });
    }

    /**
     * Get purchases by invoice reference
     * @param {string} invoiceReference - Invoice reference
     */
    async getPurchasesByInvoice(invoiceReference) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['purchases'], 'readonly');
            const store = transaction.objectStore('purchases');
            const index = store.index('invoiceReference');
            const request = index.getAll(invoiceReference);
            
            request.onsuccess = () => {
                resolve(request.result);
            };
            
            request.onerror = () => {
                reject(new Error('Failed to get purchases by invoice'));
            };
        });
    }

    /**
     * Update purchase status
     * @param {number} purchaseId - Purchase ID
     * @param {string} status - New status
     * @param {Object} additionalData - Additional data to update
     */
    async updatePurchaseStatus(purchaseId, status, additionalData = {}) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['purchases'], 'readwrite');
            const store = transaction.objectStore('purchases');
            
            const getRequest = store.get(purchaseId);
            
            getRequest.onsuccess = () => {
                const purchase = getRequest.result;
                if (!purchase) {
                    reject(new Error('Purchase not found'));
                    return;
                }
                
                const updatedPurchase = {
                    ...purchase,
                    ...additionalData,
                    status: status,
                    updatedAt: new Date().toISOString()
                };
                
                const updateRequest = store.put(updatedPurchase);
                
                updateRequest.onsuccess = () => {
                    resolve(updatedPurchase);
                };
                
                updateRequest.onerror = () => {
                    reject(new Error('Failed to update purchase'));
                };
            };
        });
    }

    /**
     * Add stock history entry
     * @param {Object} stockEntry - Stock history entry
     */
    async addStockHistory(stockEntry) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['stockHistory'], 'readwrite');
            const store = transaction.objectStore('stockHistory');
            
            const entry = {
                ...stockEntry,
                timestamp: new Date().toISOString()
            };
            
            const addRequest = store.add(entry);
            
            addRequest.onsuccess = (event) => {
                resolve({ id: event.target.result, ...entry });
            };
            
            addRequest.onerror = () => {
                reject(new Error('Failed to add stock history entry'));
            };
        });
    }

    /**
     * Get stock history for an item
     * @param {number} itemId - Item ID
     */
    async getItemStockHistory(itemId) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['stockHistory'], 'readonly');
            const store = transaction.objectStore('stockHistory');
            const index = store.index('itemId');
            const request = index.getAll(itemId);
            
            request.onsuccess = () => {
                // Sort by timestamp, newest first
                const history = request.result.sort((a, b) => 
                    new Date(b.timestamp) - new Date(a.timestamp)
                );
                resolve(history);
            };
            
            request.onerror = () => {
                reject(new Error('Failed to get stock history'));
            };
        });
    }

    /**
     * Record stock sale (for reselling items)
     * @param {number} itemId - Item ID
     * @param {number} quantity - Quantity sold
     * @param {number} salePrice - Price per unit sold
     * @param {string} notes - Optional notes
     */
    async recordStockSale(itemId, quantity, salePrice, notes = null) {
        try {
            const item = await this.getItemById(itemId);
            if (!item) {
                throw new Error('Item not found');
            }
            
            if (item.quantity < quantity) {
                throw new Error('Insufficient stock for sale');
            }
            
            const newQuantity = item.quantity - quantity;
            
            // Update item quantity
            await this.updateItem(itemId, { quantity: newQuantity });
            
            // Add stock history entry
            const stockEntry = {
                itemId: itemId,
                type: 'sale',
                date: new Date().toISOString().split('T')[0],
                quantityChange: -quantity,
                unitPrice: salePrice,
                totalValue: salePrice * quantity,
                newQuantity: newQuantity,
                notes: notes,
                description: `Sold ${quantity} units at ${formatCurrency(salePrice)} each`
            };
            
            await this.addStockHistory(stockEntry);
            
            return { item: await this.getItemById(itemId), stockEntry };
            
        } catch (error) {
            throw new Error('Failed to record sale: ' + error.message);
        }
    }

    /**
     * Record stock usage (for consumables)
     * @param {number} itemId - Item ID
     * @param {number} quantity - Quantity used
     * @param {string} notes - Optional notes
     */
    async recordStockUsage(itemId, quantity, notes = null) {
        try {
            const item = await this.getItemById(itemId);
            if (!item) {
                throw new Error('Item not found');
            }
            
            if (item.quantity < quantity) {
                throw new Error('Insufficient stock for usage');
            }
            
            const newQuantity = item.quantity - quantity;
            
            // Update item quantity
            await this.updateItem(itemId, { quantity: newQuantity });
            
            // Add stock history entry
            const stockEntry = {
                itemId: itemId,
                type: 'usage',
                date: new Date().toISOString().split('T')[0],
                quantityChange: -quantity,
                unitPrice: item.costPrice || 0,
                totalValue: (item.costPrice || 0) * quantity,
                newQuantity: newQuantity,
                notes: notes,
                description: `Used ${quantity} units`
            };
            
            await this.addStockHistory(stockEntry);
            
            return { item: await this.getItemById(itemId), stockEntry };
            
        } catch (error) {
            throw new Error('Failed to record usage: ' + error.message);
        }
    }

    /**
     * Record stock purchase (when order is received)
     * @param {number} itemId - Item ID
     * @param {number} quantity - Quantity received
     * @param {number} unitCost - Cost per unit
     * @param {string} supplier - Supplier code
     * @param {string} invoiceRef - Invoice reference
     */
    async recordStockPurchase(itemId, quantity, unitCost, supplier, invoiceRef = null) {
        try {
            const item = await this.getItemById(itemId);
            if (!item) {
                throw new Error('Item not found');
            }
            
            const newQuantity = (item.quantity || 0) + quantity;
            
            // Update item with new quantity and potentially new cost
            const updateData = {
                quantity: newQuantity,
                orderStatus: 'received',
                receivedDate: new Date().toISOString()
            };
            
            // Update cost price if different
            if (unitCost !== item.costPrice) {
                updateData.costPrice = unitCost;
                updateData.price = unitCost; // Legacy compatibility
            }
            
            await this.updateItem(itemId, updateData);
            
            // Add stock history entry
            const stockEntry = {
                itemId: itemId,
                type: 'purchase',
                date: new Date().toISOString().split('T')[0],
                quantityChange: quantity,
                unitPrice: unitCost,
                totalValue: unitCost * quantity,
                newQuantity: newQuantity,
                supplier: supplier,
                invoiceReference: invoiceRef,
                description: `Purchased ${quantity} units at ${formatCurrency(unitCost)} each from ${supplier}`
            };
            
            await this.addStockHistory(stockEntry);
            
            return { item: await this.getItemById(itemId), stockEntry };
            
        } catch (error) {
            throw new Error('Failed to record purchase: ' + error.message);
        }
    }

    /**
     * Bulk import items
     * @param {Array} items - Array of item objects
     */
    async bulkImportItems(items) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['items', 'activity'], 'readwrite');
            const itemsStore = transaction.objectStore('items');
            const activityStore = transaction.objectStore('activity');
            
            const results = [];
            let completed = 0;
            
            items.forEach((itemData, index) => {
                const item = {
                    ...itemData,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };
                
                const addRequest = itemsStore.add(item);
                
                addRequest.onsuccess = (event) => {
                    results.push({ success: true, id: event.target.result, index });
                    completed++;
                    
                    if (completed === items.length) {
                        // Log bulk import activity
                        activityStore.add({
                            type: 'bulk_import',
                            description: `Bulk imported ${items.length} items`,
                            timestamp: new Date().toISOString()
                        });
                        
                        resolve(results);
                    }
                };
                
                addRequest.onerror = () => {
                    results.push({ success: false, error: 'Failed to add item', index });
                    completed++;
                    
                    if (completed === items.length) {
                        resolve(results);
                    }
                };
            });
        });
    }

    /**
     * Initialize default suppliers
     * @param {Array} suppliers - Array of default supplier objects
     */
    async initializeDefaultSuppliers(suppliers) {
        try {
            const existingSuppliers = await this.getAllSuppliers();
            
            // Only add defaults if no suppliers exist
            if (existingSuppliers.length === 0) {
                for (const supplier of suppliers) {
                    await this.addSupplier({
                        ...supplier,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    });
                }
                console.log('Default suppliers initialized');
            }
        } catch (error) {
            console.error('Error initializing default suppliers:', error);
        }
    }

    /**
     * Get all suppliers
     */
    async getAllSuppliers() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['suppliers'], 'readonly');
            const store = transaction.objectStore('suppliers');
            const request = store.getAll();
            
            request.onsuccess = () => {
                resolve(request.result);
            };
            
            request.onerror = () => {
                reject(new Error('Failed to get suppliers'));
            };
        });
    }

    /**
     * Add a new supplier
     * @param {Object} supplierData - Supplier data object
     */
    async addSupplier(supplierData) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['suppliers', 'activity'], 'readwrite');
            const suppliersStore = transaction.objectStore('suppliers');
            const activityStore = transaction.objectStore('activity');
            
            const supplier = {
                ...supplierData,
                createdAt: supplierData.createdAt || new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            
            const addRequest = suppliersStore.add(supplier);
            
            addRequest.onsuccess = (event) => {
                const supplierId = event.target.result;
                
                // Log activity if not a default supplier initialization
                if (!supplierData.isDefault || supplierData.isDefault === false) {
                    activityStore.add({
                        type: 'supplier_added',
                        description: `Added supplier: ${supplier.name}`,
                        timestamp: new Date().toISOString(),
                        supplierId: supplierId
                    });
                }
                
                resolve({ id: supplierId, ...supplier });
            };
            
            addRequest.onerror = () => {
                reject(new Error('Failed to add supplier - name or code may already exist'));
            };
        });
    }

    /**
     * Update an existing supplier
     * @param {number} id - Supplier ID
     * @param {Object} supplierData - Updated supplier data
     */
    async updateSupplier(id, supplierData) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['suppliers', 'activity'], 'readwrite');
            const suppliersStore = transaction.objectStore('suppliers');
            const activityStore = transaction.objectStore('activity');
            
            const getRequest = suppliersStore.get(id);
            
            getRequest.onsuccess = () => {
                const existingSupplier = getRequest.result;
                if (!existingSupplier) {
                    reject(new Error('Supplier not found'));
                    return;
                }
                
                const updatedSupplier = {
                    ...existingSupplier,
                    ...supplierData,
                    updatedAt: new Date().toISOString()
                };
                
                const updateRequest = suppliersStore.put(updatedSupplier);
                
                updateRequest.onsuccess = () => {
                    activityStore.add({
                        type: 'supplier_updated',
                        description: `Updated supplier: ${updatedSupplier.name}`,
                        timestamp: new Date().toISOString(),
                        supplierId: id
                    });
                    
                    resolve(updatedSupplier);
                };
                
                updateRequest.onerror = () => {
                    reject(new Error('Failed to update supplier'));
                };
            };
        });
    }

    /**
     * Delete a supplier
     * @param {number} id - Supplier ID
     */
    async deleteSupplier(id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['suppliers', 'activity'], 'readwrite');
            const suppliersStore = transaction.objectStore('suppliers');
            const activityStore = transaction.objectStore('activity');
            
            const getRequest = suppliersStore.get(id);
            
            getRequest.onsuccess = () => {
                const supplier = getRequest.result;
                if (!supplier) {
                    reject(new Error('Supplier not found'));
                    return;
                }
                
                // Prevent deletion of default suppliers
                if (supplier.isDefault) {
                    reject(new Error('Cannot delete default supplier'));
                    return;
                }
                
                const deleteRequest = suppliersStore.delete(id);
                
                deleteRequest.onsuccess = () => {
                    activityStore.add({
                        type: 'supplier_deleted',
                        description: `Deleted supplier: ${supplier.name}`,
                        timestamp: new Date().toISOString(),
                        supplierId: id
                    });
                    
                    resolve(true);
                };
                
                deleteRequest.onerror = () => {
                    reject(new Error('Failed to delete supplier'));
                };
            };
        });
    }

    /**
     * Get supplier by code
     * @param {string} code - Supplier code
     */
    async getSupplierByCode(code) {
        return new Promise((resolve, reject) => {
            // Handle null/undefined/empty codes
            if (!code || code === null || code === undefined || code === '') {
                resolve(null);
                return;
            }
            
            const transaction = this.db.transaction(['suppliers'], 'readonly');
            const store = transaction.objectStore('suppliers');
            const index = store.index('code');
            const request = index.get(code);
            
            request.onsuccess = () => {
                resolve(request.result);
            };
            
            request.onerror = () => {
                reject(new Error('Failed to get supplier'));
            };
        });
    }

    // CATEGORY MANAGEMENT METHODS
    
    /**
     * Initialize default categories
     * @param {Array} categories - Array of default category objects
     */
    async initializeDefaultCategories(categories) {
        try {
            const existingCategories = await this.getAllCategories();
            
            // Only add defaults if no categories exist
            if (existingCategories.length === 0) {
                for (const category of categories) {
                    await this.addCategory({
                        ...category,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    });
                }
                console.log('Default categories initialized');
            }
        } catch (error) {
            console.error('Error initializing default categories:', error);
        }
    }

    /**
     * Get all categories
     */
    async getAllCategories() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['categories'], 'readonly');
            const store = transaction.objectStore('categories');
            const request = store.getAll();
            
            request.onsuccess = () => {
                resolve(request.result);
            };
            
            request.onerror = () => {
                reject(new Error('Failed to get categories'));
            };
        });
    }

    /**
     * Add a new category
     * @param {Object} categoryData - Category data object
     */
    async addCategory(categoryData) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['categories', 'activity'], 'readwrite');
            const categoriesStore = transaction.objectStore('categories');
            const activityStore = transaction.objectStore('activity');
            
            const category = {
                ...categoryData,
                createdAt: categoryData.createdAt || new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            
            const addRequest = categoriesStore.add(category);
            
            addRequest.onsuccess = (event) => {
                const categoryId = event.target.result;
                
                // Log activity if not a default category initialization
                if (!categoryData.isDefault || categoryData.isDefault === false) {
                    activityStore.add({
                        type: 'category_added',
                        description: `Added category: ${category.name}`,
                        timestamp: new Date().toISOString(),
                        categoryId: categoryId
                    });
                }
                
                resolve({ id: categoryId, ...category });
            };
            
            addRequest.onerror = () => {
                reject(new Error('Failed to add category - name or code may already exist'));
            };
        });
    }

    /**
     * Update an existing category
     * @param {number} id - Category ID
     * @param {Object} categoryData - Updated category data
     */
    async updateCategory(id, categoryData) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['categories', 'activity'], 'readwrite');
            const categoriesStore = transaction.objectStore('categories');
            const activityStore = transaction.objectStore('activity');
            
            const getRequest = categoriesStore.get(id);
            
            getRequest.onsuccess = () => {
                const existingCategory = getRequest.result;
                if (!existingCategory) {
                    reject(new Error('Category not found'));
                    return;
                }
                
                const updatedCategory = {
                    ...existingCategory,
                    ...categoryData,
                    updatedAt: new Date().toISOString()
                };
                
                const updateRequest = categoriesStore.put(updatedCategory);
                
                updateRequest.onsuccess = () => {
                    activityStore.add({
                        type: 'category_updated',
                        description: `Updated category: ${updatedCategory.name}`,
                        timestamp: new Date().toISOString(),
                        categoryId: id
                    });
                    
                    resolve(updatedCategory);
                };
                
                updateRequest.onerror = () => {
                    reject(new Error('Failed to update category'));
                };
            };
        });
    }

    /**
     * Delete a category
     * @param {number} id - Category ID
     */
    async deleteCategory(id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['categories', 'activity'], 'readwrite');
            const categoriesStore = transaction.objectStore('categories');
            const activityStore = transaction.objectStore('activity');
            
            const getRequest = categoriesStore.get(id);
            
            getRequest.onsuccess = () => {
                const category = getRequest.result;
                if (!category) {
                    reject(new Error('Category not found'));
                    return;
                }
                
                // Prevent deletion of default categories
                if (category.isDefault) {
                    reject(new Error('Cannot delete default category'));
                    return;
                }
                
                const deleteRequest = categoriesStore.delete(id);
                
                deleteRequest.onsuccess = () => {
                    activityStore.add({
                        type: 'category_deleted',
                        description: `Deleted category: ${category.name}`,
                        timestamp: new Date().toISOString(),
                        categoryId: id
                    });
                    
                    resolve(true);
                };
                
                deleteRequest.onerror = () => {
                    reject(new Error('Failed to delete category'));
                };
            };
        });
    }

    /**
     * Get category by code
     * @param {string} code - Category code
     */
    async getCategoryByCode(code) {
        // Validate code parameter to prevent IndexedDB errors
        if (code === null || code === undefined || code === '') {
            return null;
        }
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['categories'], 'readonly');
            const store = transaction.objectStore('categories');
            const index = store.index('code');
            const request = index.get(code);
            
            request.onsuccess = () => {
                resolve(request.result);
            };
            
            request.onerror = () => {
                reject(new Error('Failed to get category'));
            };
        });
    }

    // INVOICE DOCUMENT MANAGEMENT METHODS

    /**
     * Save uploaded invoice document
     * @param {Object} invoiceData - Invoice document data
     * @returns {Promise<Object>} Created invoice document
     */
    async saveInvoiceDocument(invoiceData) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['invoices', 'activity'], 'readwrite');
            const invoicesStore = transaction.objectStore('invoices');
            const activityStore = transaction.objectStore('activity');
            
            const invoice = {
                ...invoiceData,
                status: 'processing', // processing, completed, failed
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            
            const addRequest = invoicesStore.add(invoice);
            
            addRequest.onsuccess = (event) => {
                const invoiceId = event.target.result;
                
                // Log activity
                activityStore.add({
                    type: 'invoice_uploaded',
                    description: `Uploaded invoice: ${invoice.invoiceNumber || 'Unknown'}`,
                    timestamp: new Date().toISOString(),
                    invoiceId: invoiceId
                });
                
                resolve({ id: invoiceId, ...invoice });
            };
            
            addRequest.onerror = () => {
                reject(new Error('Failed to save invoice document'));
            };
        });
    }

    /**
     * Update invoice document
     * @param {number} invoiceId - Invoice ID
     * @param {Object} updateData - Data to update
     * @returns {Promise<Object>} Updated invoice
     */
    async updateInvoiceDocument(invoiceId, updateData) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['invoices'], 'readwrite');
            const store = transaction.objectStore('invoices');
            
            const getRequest = store.get(invoiceId);
            
            getRequest.onsuccess = () => {
                const invoice = getRequest.result;
                if (!invoice) {
                    reject(new Error('Invoice not found'));
                    return;
                }
                
                const updatedInvoice = {
                    ...invoice,
                    ...updateData,
                    updatedAt: new Date().toISOString()
                };
                
                const updateRequest = store.put(updatedInvoice);
                
                updateRequest.onsuccess = () => {
                    resolve(updatedInvoice);
                };
                
                updateRequest.onerror = () => {
                    reject(new Error('Failed to update invoice'));
                };
            };
        });
    }

    /**
     * Get invoice document by ID
     * @param {number} invoiceId - Invoice ID
     * @returns {Promise<Object>} Invoice document
     */
    async getInvoiceDocument(invoiceId) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['invoices'], 'readonly');
            const store = transaction.objectStore('invoices');
            const request = store.get(invoiceId);
            
            request.onsuccess = () => {
                resolve(request.result);
            };
            
            request.onerror = () => {
                reject(new Error('Failed to get invoice document'));
            };
        });
    }

    /**
     * Get all invoice documents
     * @returns {Promise<Array>} Array of invoice documents
     */
    async getAllInvoiceDocuments() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['invoices'], 'readonly');
            const store = transaction.objectStore('invoices');
            const request = store.getAll();
            
            request.onsuccess = () => {
                const invoices = request.result.sort((a, b) => 
                    new Date(b.createdAt) - new Date(a.createdAt)
                );
                resolve(invoices);
            };
            
            request.onerror = () => {
                reject(new Error('Failed to get invoice documents'));
            };
        });
    }

    /**
     * Get invoice documents by supplier
     * @param {string} supplierCode - Supplier code
     * @returns {Promise<Array>} Array of invoice documents for the supplier
     */
    async getInvoiceDocumentsBySupplier(supplierCode) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['invoices'], 'readonly');
            const store = transaction.objectStore('invoices');
            const index = store.index('supplier');
            const request = index.getAll(supplierCode);
            
            request.onsuccess = () => {
                const invoices = request.result.sort((a, b) => 
                    new Date(b.createdAt) - new Date(a.createdAt)
                );
                resolve(invoices);
            };
            
            request.onerror = () => {
                reject(new Error('Failed to get supplier invoices'));
            };
        });
    }

    /**
     * Save invoice line item
     * @param {Object} lineItemData - Line item data
     * @returns {Promise<Object>} Created line item
     */
    async saveInvoiceLineItem(lineItemData) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['invoiceLineItems'], 'readwrite');
            const store = transaction.objectStore('invoiceLineItems');
            
            const lineItem = {
                ...lineItemData,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            
            const addRequest = store.add(lineItem);
            
            addRequest.onsuccess = (event) => {
                const lineItemId = event.target.result;
                resolve({ id: lineItemId, ...lineItem });
            };
            
            addRequest.onerror = () => {
                reject(new Error('Failed to save line item'));
            };
        });
    }

    /**
     * Update invoice line item
     * @param {number} lineItemId - Line item ID
     * @param {Object} updateData - Data to update
     * @returns {Promise<Object>} Updated line item
     */
    async updateInvoiceLineItem(lineItemId, updateData) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['invoiceLineItems'], 'readwrite');
            const store = transaction.objectStore('invoiceLineItems');
            
            const getRequest = store.get(lineItemId);
            
            getRequest.onsuccess = () => {
                const lineItem = getRequest.result;
                if (!lineItem) {
                    reject(new Error('Line item not found'));
                    return;
                }
                
                const updatedLineItem = {
                    ...lineItem,
                    ...updateData,
                    updatedAt: new Date().toISOString()
                };
                
                const updateRequest = store.put(updatedLineItem);
                
                updateRequest.onsuccess = () => {
                    resolve(updatedLineItem);
                };
                
                updateRequest.onerror = () => {
                    reject(new Error('Failed to update line item'));
                };
            };
        });
    }

    /**
     * Get line items for an invoice
     * @param {number} invoiceId - Invoice ID
     * @returns {Promise<Array>} Array of line items
     */
    async getInvoiceLineItems(invoiceId) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['invoiceLineItems'], 'readonly');
            const store = transaction.objectStore('invoiceLineItems');
            const index = store.index('invoiceId');
            const request = index.getAll(invoiceId);
            
            request.onsuccess = () => {
                resolve(request.result);
            };
            
            request.onerror = () => {
                reject(new Error('Failed to get line items'));
            };
        });
    }

    /**
     * Process invoice and create purchase records
     * @param {number} invoiceId - Invoice ID
     * @param {Array} processedLineItems - Array of processed line items
     * @returns {Promise<Object>} Processing result
     */
    async processInvoiceIntoPurchases(invoiceId, processedLineItems) {
        return new Promise(async (resolve, reject) => {
            try {
                const transaction = this.db.transaction([
                    'invoices', 'invoiceLineItems', 'purchases', 'items', 'activity', 'stockHistory'
                ], 'readwrite');
                
                const results = {
                    purchasesCreated: 0,
                    itemsCreated: 0,
                    itemsUpdated: 0,
                    errors: []
                };
                
                // Get the invoice document
                const invoice = await this.getInvoiceDocument(invoiceId);
                if (!invoice) {
                    throw new Error('Invoice document not found');
                }
                
                for (const processedItem of processedLineItems) {
                    try {
                        let itemId = processedItem.itemId;
                        
                        // Create new item if needed
                        if (processedItem.action === 'create_new' && processedItem.newItemData) {
                            const newItem = await this.addItem(processedItem.newItemData);
                            itemId = newItem.id;
                            results.itemsCreated++;
                        }
                        
                        // Update existing item if needed
                        if (processedItem.action === 'update_existing' && processedItem.updateData) {
                            await this.updateItem(itemId, processedItem.updateData);
                            results.itemsUpdated++;
                        }
                        
                        // Create purchase record
                        const purchaseData = {
                            itemId: itemId,
                            itemName: processedItem.description || processedItem.itemName,
                            itemSku: processedItem.code || null,
                            supplier: invoice.supplier,
                            quantity: processedItem.quantity,
                            unitCost: processedItem.unitPrice,
                            subtotal: processedItem.subtotal || (processedItem.unitPrice * processedItem.quantity),
                            discountPercent: processedItem.discountPercent || 0,
                            discountAmount: processedItem.discountAmount || 0,
                            netCost: processedItem.netTotal || processedItem.totalPrice || (processedItem.unitPrice * processedItem.quantity),
                            taxRate: processedItem.taxRate || 15,
                            taxAmount: processedItem.taxAmount || 0,
                            totalCost: processedItem.calculatedTotal || processedItem.totalPrice || (processedItem.unitPrice * processedItem.quantity),
                            currency: processedItem.currency || 'ZAR',
                            orderDate: invoice.date || new Date().toISOString().split('T')[0],
                            invoiceReference: invoice.invoiceNumber,
                            status: 'received', // Mark as received since it's from an invoice
                            receivedDate: new Date().toISOString(),
                            notes: `Imported from invoice ${invoice.invoiceNumber || invoice.fileName}${processedItem.discountPercent ? ` (${processedItem.discountPercent}% discount applied)` : ''}`
                        };
                        
                        await this.createPurchase(purchaseData);
                        results.purchasesCreated++;
                        
                        // Update stock if item exists - using packaging-aware calculation
                        if (itemId && processedItem.quantity > 0) {
                            await this.recordStockPurchaseWithPackaging(
                                itemId,
                                processedItem.quantity,
                                processedItem.unitPrice,
                                invoice.supplier,
                                invoice.invoiceNumber
                            );
                        }
                        
                        // Save line item with final status
                        await this.saveInvoiceLineItem({
                            invoiceId: invoiceId,
                            itemId: itemId,
                            originalText: processedItem.originalText,
                            description: processedItem.description,
                            code: processedItem.code,
                            quantity: processedItem.quantity,
                            unitPrice: processedItem.unitPrice,
                            subtotal: processedItem.subtotal,
                            discountPercent: processedItem.discountPercent || 0,
                            discountAmount: processedItem.discountAmount || 0,
                            netTotal: processedItem.netTotal || processedItem.totalPrice,
                            taxRate: processedItem.taxRate || 15,
                            taxAmount: processedItem.taxAmount || 0,
                            totalPrice: processedItem.totalPrice,
                            calculatedTotal: processedItem.calculatedTotal,
                            currency: processedItem.currency || 'ZAR',
                            isValid: processedItem.isValid !== false,
                            validationErrors: processedItem.validationErrors ? JSON.stringify(processedItem.validationErrors) : null,
                            matchScore: processedItem.matchScore || 0,
                            action: processedItem.action,
                            status: 'processed'
                        });
                        
                    } catch (error) {
                        console.error('Error processing line item:', error);
                        results.errors.push(`Line item "${processedItem.description}": ${error.message}`);
                        
                        // Save line item with error status
                        try {
                            await this.saveInvoiceLineItem({
                                invoiceId: invoiceId,
                                originalText: processedItem.originalText,
                                description: processedItem.description,
                                code: processedItem.code,
                                quantity: processedItem.quantity,
                                unitPrice: processedItem.unitPrice,
                                totalPrice: processedItem.totalPrice,
                                status: 'error',
                                errorMessage: error.message
                            });
                        } catch (lineItemError) {
                            console.error('Failed to save error line item:', lineItemError);
                        }
                    }
                }
                
                // Update invoice status
                await this.updateInvoiceDocument(invoiceId, {
                    status: results.errors.length > 0 ? 'completed_with_errors' : 'completed',
                    processedAt: new Date().toISOString(),
                    processingResults: results
                });
                
                resolve(results);
                
            } catch (error) {
                reject(new Error('Failed to process invoice: ' + error.message));
            }
        });
    }

    // DATA BACKUP AND RESTORE METHODS

    /**
     * Export all data for backup
     */
    async exportAllData() {
        try {
            const data = {
                exportDate: new Date().toISOString(),
                version: this.dbVersion,
                items: await this.getAllItems(),
                suppliers: await this.getAllSuppliers(),
                categories: await this.getAllCategories(),
                activity: await this.getAllActivity()
            };
            
            return data;
        } catch (error) {
            console.error('Error exporting data:', error);
            throw error;
        }
    }

    /**
     * Import data from backup with different merge strategies
     * @param {Object} data - Exported data object
     * @param {Object} options - Import options
     */
    async importData(data, options = { preserveExisting: true }) {
        try {
            let imported = {
                items: 0,
                suppliers: 0,
                categories: 0,
                skipped: 0,
                updated: 0,
                errors: []
            };

            // Handle clear and replace mode
            if (options.replaceExisting && options.clearFirst) {
                console.log('Clearing all existing data before restore...');
                // Clear all existing data first
                await this.clearAllData();
            }

            // Import suppliers first (needed for items)
            if (data.suppliers && data.suppliers.length > 0) {
                for (const supplier of data.suppliers) {
                    try {
                        let existing = null;
                        
                        // Only check for existing if we're not doing a full clear/restore
                        if (!options.clearFirst) {
                            existing = await this.getSupplierByCode(supplier.code);
                        }
                        
                        if (existing) {
                            if (options.preserveExisting) {
                                imported.skipped++;
                                continue;
                            } else if (options.replaceExisting) {
                                // Update existing supplier
                                const { id, ...supplierData } = supplier;
                                await this.updateSupplier(existing.id, supplierData);
                                imported.updated++;
                                continue;
                            }
                        }

                        // Add new supplier
                        const { id, ...supplierData } = supplier;
                        await this.addSupplier(supplierData);
                        imported.suppliers++;
                    } catch (error) {
                        imported.errors.push(`Supplier ${supplier.name}: ${error.message}`);
                    }
                }
            }

            // Import categories
            if (data.categories && data.categories.length > 0) {
                for (const category of data.categories) {
                    try {
                        let existing = null;
                        
                        // Only check for existing if we're not doing a full clear/restore
                        if (!options.clearFirst) {
                            existing = await this.getCategoryByCode(category.code);
                        }
                        
                        if (existing) {
                            if (options.preserveExisting) {
                                imported.skipped++;
                                continue;
                            } else if (options.replaceExisting) {
                                // Update existing category
                                const { id, ...categoryData } = category;
                                await this.updateCategory(existing.id, categoryData);
                                imported.updated++;
                                continue;
                            }
                        }

                        // Add new category
                        const { id, ...categoryData } = category;
                        await this.addCategory(categoryData);
                        imported.categories++;
                    } catch (error) {
                        imported.errors.push(`Category ${category.name}: ${error.message}`);
                    }
                }
            }

            // Import items last
            if (data.items && data.items.length > 0) {
                for (const item of data.items) {
                    try {
                        let existing = null;
                        
                        // Only check for existing if we're not doing a full clear/restore
                        if (!options.clearFirst) {
                            // Check if item already exists (by SKU or name)
                            if (item.sku) {
                                existing = await this.getItemBySKU(item.sku);
                            } else {
                                // If no SKU, try to find by name
                                const allItems = await this.getAllItems();
                                existing = allItems.find(i => i.name.toLowerCase() === item.name.toLowerCase());
                            }
                        }
                        
                        if (existing) {
                            if (options.preserveExisting) {
                                imported.skipped++;
                                continue;
                            } else if (options.replaceExisting) {
                                // Update existing item
                                const { id, ...itemData } = item;
                                await this.updateItem(existing.id, itemData);
                                imported.updated++;
                                continue;
                            }
                        }

                        // Add new item
                        const { id, ...itemData } = item;
                        await this.addItem(itemData);
                        imported.items++;
                    } catch (error) {
                        imported.errors.push(`Item ${item.name}: ${error.message}`);
                        console.error('Error importing item:', item, error);
                    }
                }
            }

            return imported;
        } catch (error) {
            console.error('Error importing data:', error);
            throw error;
        }
    }

    /**
     * Create automatic backup to localStorage with timestamp
     */
    async createAutoBackup() {
        try {
            const data = await this.exportAllData();
            const now = new Date();
            // Create timestamp format: YYYY-MM-DD_HH-MM-SS for more granular backups
            const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}-${String(now.getSeconds()).padStart(2, '0')}`;
            const backupKey = `feetonfocus_backup_${timestamp}`;
            
            // Keep only last 10 auto backups
            const existingBackups = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith('feetonfocus_backup_')) {
                    existingBackups.push(key);
                }
            }
            
            // Sort by timestamp (newest first)
            existingBackups.sort().reverse();
            
            // Remove old backups (keep 9, add 1 new = 10 total)
            for (let i = 9; i < existingBackups.length; i++) {
                localStorage.removeItem(existingBackups[i]);
                console.log('Removed old auto backup:', existingBackups[i]);
            }
            
            localStorage.setItem(backupKey, JSON.stringify(data));
            console.log('Auto-backup created:', backupKey);
            
            return backupKey;
        } catch (error) {
            console.error('Error creating auto-backup:', error);
            throw error; // Re-throw for error handling
        }
    }

    /**
     * Clear all data from the database (use with caution!)
     */
    async clearAllData() {
        try {
            const transaction = this.db.transaction(['items', 'suppliers', 'categories', 'activity'], 'readwrite');
            
            // Clear all object stores
            const itemsStore = transaction.objectStore('items');
            const suppliersStore = transaction.objectStore('suppliers');
            const categoriesStore = transaction.objectStore('categories');
            const activityStore = transaction.objectStore('activity');
            
            await Promise.all([
                new Promise((resolve, reject) => {
                    const request = itemsStore.clear();
                    request.onsuccess = () => resolve();
                    request.onerror = () => reject(request.error);
                }),
                new Promise((resolve, reject) => {
                    const request = suppliersStore.clear();
                    request.onsuccess = () => resolve();
                    request.onerror = () => reject(request.error);
                }),
                new Promise((resolve, reject) => {
                    const request = categoriesStore.clear();
                    request.onsuccess = () => resolve();
                    request.onerror = () => reject(request.error);
                }),
                new Promise((resolve, reject) => {
                    const request = activityStore.clear();
                    request.onsuccess = () => resolve();
                    request.onerror = () => reject(request.error);
                })
            ]);
            
            console.log('All data cleared from database');
        } catch (error) {
            console.error('Error clearing data:', error);
            throw error;
        }
    }

    // PACKAGING SYSTEM METHODS

    /**
     * Calculate stock units based on packaging info
     * @param {Object} item - Item with packaging info
     * @param {number} purchaseQuantity - Quantity purchased (packs or units)
     * @returns {Object} Calculated stock information
     */
    calculateStockFromPurchase(item, purchaseQuantity) {
        const packSize = item.packSize || 1;
        const packType = item.packType || 'single';
        const sellIndividually = item.sellIndividually !== false;
        
        let stockUnits, costPerUnit, totalCost;
        
        if (packType === 'pack' && packSize > 1) {
            // Item is sold in packs (invoice quantity represents packs)
            if (sellIndividually) {
                // But can be sold individually - stock tracks individual units
                stockUnits = purchaseQuantity * packSize; // Convert packs to individual units
                costPerUnit = (item.packPrice || 0) / packSize; // Cost per individual unit
                totalCost = purchaseQuantity * (item.packPrice || 0);
            } else {
                // Only sold by pack - stock tracks packs
                stockUnits = purchaseQuantity;
                costPerUnit = item.packPrice || 0;
                totalCost = purchaseQuantity * costPerUnit;
            }
        } else {
            // Item is sold as individual units
            stockUnits = purchaseQuantity;
            costPerUnit = item.individualPrice || item.purchasePrice || 0;
            totalCost = purchaseQuantity * costPerUnit;
        }
        
        return {
            stockUnits,      // Total units to add to stock (individual units if sold separately)
            costPerUnit,     // Cost per stock unit
            totalCost,       // Total purchase cost
            packsPurchased: packType === 'pack' ? purchaseQuantity : Math.ceil(purchaseQuantity / packSize)
        };
    }

    /**
     * Calculate sale information based on packaging
     * @param {Object} item - Item with packaging info
     * @param {number} saleQuantity - Quantity being sold
     * @param {string} saleUnit - 'individual' or 'pack'
     * @returns {Object} Sale calculation information
     */
    calculateSaleUnits(item, saleQuantity, saleUnit = 'individual') {
        const packSize = item.packSize || 1;
        const sellIndividually = item.sellIndividually !== false;
        
        let stockUnitsToDeduct, salePrice, revenue;
        
        if (saleUnit === 'pack' && packSize > 1) {
            // Selling by pack
            stockUnitsToDeduct = saleQuantity * packSize;
            salePrice = item.packPrice || (item.individualPrice || 0) * packSize;
            revenue = saleQuantity * salePrice;
        } else {
            // Selling individually
            if (!sellIndividually) {
                throw new Error('This item cannot be sold individually');
            }
            stockUnitsToDeduct = saleQuantity;
            salePrice = item.individualPrice || item.purchasePrice || 0;
            revenue = saleQuantity * salePrice;
        }
        
        return {
            stockUnitsToDeduct,  // Units to remove from stock
            salePrice,           // Price per unit/pack
            revenue,             // Total sale revenue
            unitType: saleUnit   // 'individual' or 'pack'
        };
    }

    /**
     * Get packaging display information for an item
     * @param {Object} item - Item with packaging info
     * @returns {Object} Display information
     */
    getPackagingDisplay(item) {
        const packSize = item.packSize || 1;
        const packType = item.packType || 'single';
        const sellIndividually = item.sellIndividually !== false;
        
        let packagingInfo = {
            isPack: packType === 'pack' && packSize > 1,
            packSize,
            packType,
            sellIndividually,
            displayText: '',
            stockDisplayText: '',
            priceDisplayText: ''
        };
        
        if (packagingInfo.isPack) {
            packagingInfo.displayText = `${packSize}-pack`;
            packagingInfo.stockDisplayText = `(${packSize} units per pack)`;
            
            if (sellIndividually) {
                packagingInfo.priceDisplayText = `Pack: ${formatCurrency(item.packPrice || 0)} | Individual: ${formatCurrency(item.individualPrice || 0)}`;
            } else {
                packagingInfo.priceDisplayText = `Pack only: ${formatCurrency(item.packPrice || 0)}`;
            }
        } else {
            packagingInfo.displayText = 'Individual';
            packagingInfo.priceDisplayText = formatCurrency(item.individualPrice || item.purchasePrice || 0);
        }
        
        return packagingInfo;
    }

    /**
     * Update stock with packaging calculations
     * @param {number} itemId - Item ID
     * @param {number} quantity - Purchase quantity
     * @param {number} unitCost - Cost per pack/unit as purchased
     * @param {string} supplier - Supplier code
     * @param {string} reference - Reference (invoice number, etc.)
     */
    async recordStockPurchaseWithPackaging(itemId, quantity, unitCost, supplier, reference) {
        try {
            const item = await this.getItemById(itemId);
            if (!item) {
                throw new Error('Item not found');
            }
            
            // Calculate actual stock units based on packaging
            const stockCalc = this.calculateStockFromPurchase(item, quantity);
            
            // Record the stock movement using calculated units
            await this.recordStockPurchase(
                itemId,
                stockCalc.stockUnits, // Use calculated stock units
                stockCalc.costPerUnit, // Use calculated cost per unit
                supplier,
                reference + (stockCalc.packsPurchased > quantity ? ` (${stockCalc.packsPurchased} packs → ${stockCalc.stockUnits} units)` : '')
            );
            
            return stockCalc;
        } catch (error) {
            console.error('Error recording stock purchase with packaging:', error);
            throw error;
        }
    }

    /**
     * Create manual backup
     */
    async createManualBackup() {
        try {
            const data = await this.exportAllData();
            const now = new Date();
            // Create a simpler timestamp format: YYYY-MM-DD_HH-MM-SS
            const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}-${String(now.getSeconds()).padStart(2, '0')}`;
            const backupKey = `feetonfocus_manual_${timestamp}`;
            
            // Clean up old manual backups (keep only last 10)
            const existingManualBackups = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith('feetonfocus_manual_')) {
                    existingManualBackups.push(key);
                }
            }
            
            existingManualBackups.sort().reverse();
            
            // Remove old manual backups (keep 9, add 1 new = 10 total)
            for (let i = 9; i < existingManualBackups.length; i++) {
                localStorage.removeItem(existingManualBackups[i]);
            }
            
            localStorage.setItem(backupKey, JSON.stringify(data));
            console.log('Manual backup created:', backupKey);
            
            // Also create file system backup for manual backups
            await this.createFileSystemBackup(data, timestamp, 'manual');
            
            return backupKey;
        } catch (error) {
            console.error('Error creating manual backup:', error);
            throw error; // Re-throw for UI error handling
        }
    }

    /**
     * Track backup downloads for reminder system
     */
    trackBackupDownload() {
        try {
            const downloadCount = parseInt(localStorage.getItem('unorganizedBackups') || '0') + 1;
            localStorage.setItem('unorganizedBackups', downloadCount.toString());
            
            // Show reminder every 3 downloads
            if (downloadCount > 0 && downloadCount % 3 === 0) {
                setTimeout(() => {
                    if (typeof showToast === 'function') {
                        showToast(`📁 You have ${downloadCount} unorganized backup files in Downloads. Consider running backups/organize-backups.bat`, 'warning', 10000);
                    }
                }, 2000);
            }
        } catch (error) {
            console.error('Error tracking backup downloads:', error);
        }
    }

    /**
     * Reset backup download counter (call this after organizing)
     */
    resetBackupDownloadCounter() {
        try {
            localStorage.setItem('unorganizedBackups', '0');
        } catch (error) {
            console.error('Error resetting backup counter:', error);
        }
    }

    /**
     * Create file backup (desktop or browser download)
     */
    async createFileSystemBackup(data, timestamp, type = 'auto') {
        try {
            const fileName = `feetonfocus_${type}_${timestamp}.json`;
            
            // Check if we're running in desktop mode (Electron)
            if (typeof DesktopBackupHelper !== 'undefined' && DesktopBackupHelper.isDesktopMode()) {
                console.log('🖥️ Desktop mode: Saving backup directly to file system');
                const filePath = await DesktopBackupHelper.saveBackupFile(fileName, data, type);
                
                // Show success notification
                if (typeof showToast === 'function') {
                    showToast(`✅ Backup saved: ${fileName}`, 'success', 5000);
                }
                
                return filePath;
            } else {
                // Browser mode: Use download approach
                console.log('🌐 Browser mode: Downloading backup file');
                const dataStr = JSON.stringify(data, null, 2);
                
                // Create downloadable blob
                const dataBlob = new Blob([dataStr], { type: 'application/json' });
                const url = URL.createObjectURL(dataBlob);
                
                // Create temporary download link
                const link = document.createElement('a');
                link.href = url;
                link.download = fileName;
                link.style.display = 'none';
                
                // Trigger download
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                
                // Clean up blob URL
                URL.revokeObjectURL(url);
                
                console.log(`File system backup created: ${fileName}`);
                
                // Track backup download and show reminder (browser only)
                this.trackBackupDownload();
                
                // Show immediate organization reminder for manual/daily backups
                if (type === 'manual' || type === 'daily') {
                    setTimeout(() => {
                        if (typeof showToast === 'function') {
                            showToast(`📁 Backup downloaded as ${fileName}. Run backups/organize-backups.bat to organize files.`, 'info', 8000);
                        }
                    }, 1000);
                }
                
                return fileName;
            }
        } catch (error) {
            console.error('Error creating file system backup:', error);
            // Don't throw error - file system backup is optional
            return null;
        }
    }

    /**
     * Create daily file export (for auto backups)
     */
    async createDailyFileExport() {
        try {
            const data = await this.exportAllData();
            const now = new Date();
            const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
            const timestamp = `${dateStr}_daily-export`;
            
            // Check if we already created a daily export today
            const lastDailyExport = localStorage.getItem('lastDailyExport');
            if (lastDailyExport === dateStr) {
                console.log('Daily export already created today');
                return null;
            }
            
            const fileName = await this.createFileSystemBackup(data, timestamp, 'daily');
            if (fileName) {
                localStorage.setItem('lastDailyExport', dateStr);
                console.log('Daily file export completed:', fileName);
            }
            
            return fileName;
        } catch (error) {
            console.error('Error creating daily file export:', error);
            return null;
        }
    }

    /**
     * Export localStorage backup to file
     */
    async exportLocalStorageBackupToFile(backupKey) {
        try {
            const backupData = localStorage.getItem(backupKey);
            if (!backupData) {
                throw new Error('Backup not found in localStorage');
            }
            
            const data = JSON.parse(backupData);
            const timestamp = backupKey.replace(/^feetonfocus_(backup_|manual_)/, '');
            const type = backupKey.includes('manual_') ? 'manual' : 'auto';
            const fileName = `feetonfocus_${type}_${timestamp}.json`;
            
            // Check if we're running in desktop mode (Electron)
            if (typeof DesktopBackupHelper !== 'undefined' && DesktopBackupHelper.isDesktopMode()) {
                console.log('🖥️ Desktop mode: Using save dialog for export');
                const filePath = await DesktopBackupHelper.exportBackupFile(fileName, data);
                return filePath;
            } else {
                // Browser mode: Use existing download method
                const result = await this.createFileSystemBackup(data, timestamp, type);
                return result;
            }
        } catch (error) {
            console.error('Error exporting localStorage backup to file:', error);
            throw error;
        }
    }

    /**
     * Get all activity logs
     */
    async getAllActivity() {
        return new Promise((resolve, reject) => {
            if (!this.db.objectStoreNames.contains('activity')) {
                resolve([]);
                return;
            }
            
            const transaction = this.db.transaction(['activity'], 'readonly');
            const store = transaction.objectStore('activity');
            const request = store.getAll();
            
            request.onsuccess = () => {
                resolve(request.result);
            };
            
            request.onerror = () => {
                reject(new Error('Failed to get activity logs'));
            };
        });
    }
}

// Create global database instance
const inventoryDB = new InventoryDatabase();