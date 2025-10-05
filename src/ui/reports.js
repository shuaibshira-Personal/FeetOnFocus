/**
 * Reports and Export Management
 */

class ReportsManager {
    constructor() {
        this.items = [];
    }

    async init() {
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Export for SimplyBlu
        document.getElementById('exportSimplyBluBtn').addEventListener('click', () => {
            this.exportForSimplyBlu();
        });

        // Export full inventory
        document.getElementById('exportFullInventoryBtn').addEventListener('click', () => {
            this.exportFullInventory();
        });
    }

    async exportForSimplyBlu() {
        try {
            showToast('Preparing SimplyBlu export...', 'info');
            
            // Get all items
            this.items = await inventoryDB.getAllItems();
            
            if (!this.items.length) {
                showToast('No items to export', 'warning');
                return;
            }

            // Prepare data in SimplyBlu format
            const exportData = this.items.map(item => {
                return {
                    'Product Name': item.name || '',
                    'SKU': item.sku || '',
                    'Description': item.description || '',
                    'Category': item.category || '',
                    'Price': item.price || 0,
                    'Stock Quantity': item.quantity || 0,
                    'Supplier': this.getSupplierDisplayName(item.supplier),
                    'Seller': item.seller || '',
                    'Listing Name': item.listingName || '',
                    'Alternative Names': this.formatAlternativeNames(item.alternativeNames),
                    'Total Value': (item.price || 0) * (item.quantity || 0),
                    'Last Updated': new Date(item.updatedAt).toLocaleDateString()
                };
            });

            // Create Excel file
            const worksheet = XLSX.utils.json_to_sheet(exportData);
            const workbook = XLSX.utils.book_new();
            
            // Auto-size columns
            const colWidths = [];
            const headerRow = Object.keys(exportData[0]);
            headerRow.forEach((header, index) => {
                const maxLength = Math.max(
                    header.length,
                    ...exportData.map(row => String(row[header] || '').length)
                );
                colWidths.push({ wch: Math.min(maxLength + 2, 30) });
            });
            worksheet['!cols'] = colWidths;

            XLSX.utils.book_append_sheet(workbook, worksheet, 'SimplyBlu Import');
            
            // Generate filename with timestamp
            const timestamp = new Date().toISOString().split('T')[0];
            const filename = `SimplyBlu_Import_${timestamp}.xlsx`;
            
            // Download file
            XLSX.writeFile(workbook, filename);
            
            showToast(`Export completed: ${filename}`, 'success');
            
        } catch (error) {
            console.error('Error exporting for SimplyBlu:', error);
            showToast('Error creating export file', 'error');
        }
    }

    async exportFullInventory() {
        try {
            showToast('Preparing full inventory export...', 'info');
            
            // Get all items
            this.items = await inventoryDB.getAllItems();
            
            if (!this.items.length) {
                showToast('No items to export', 'warning');
                return;
            }

            // Get statistics
            const stats = await inventoryDB.getStatistics();
            
            // Prepare detailed inventory data
            const inventoryData = this.items.map(item => {
                return {
                    'ID': item.id,
                    'Name': item.name || '',
                    'SKU': item.sku || '',
                    'Category': item.category || '',
                    'Description': item.description || '',
                    'Price': item.price || 0,
                    'Quantity': item.quantity || 0,
                    'Total Value': (item.price || 0) * (item.quantity || 0),
                    'Supplier': this.getSupplierDisplayName(item.supplier),
                    'Seller': item.seller || '',
                    'Listing Name': item.listingName || '',
                    'Alternative Names': this.formatAlternativeNames(item.alternativeNames),
                    'Has Image': item.imageData ? 'Yes' : 'No',
                    'Created Date': new Date(item.createdAt).toLocaleDateString(),
                    'Last Updated': new Date(item.updatedAt).toLocaleDateString(),
                    'Low Stock': (item.quantity || 0) < 5 ? 'Yes' : 'No'
                };
            });

            // Create summary data
            const summaryData = [
                ['Total Items', stats.totalItems],
                ['Total Inventory Value', stats.totalValue],
                ['Low Stock Items', stats.lowStockItems],
                ['Suppliers Count', stats.suppliers.length],
                ['Categories Count', stats.categories.length],
                ['Export Date', new Date().toLocaleDateString()],
                ['Export Time', new Date().toLocaleTimeString()]
            ];

            // Create workbook with multiple sheets
            const workbook = XLSX.utils.book_new();
            
            // Summary sheet
            const summaryWS = XLSX.utils.aoa_to_sheet(summaryData);
            summaryWS['!cols'] = [{ wch: 20 }, { wch: 15 }];
            XLSX.utils.book_append_sheet(workbook, summaryWS, 'Summary');
            
            // Inventory sheet
            const inventoryWS = XLSX.utils.json_to_sheet(inventoryData);
            
            // Auto-size columns for inventory sheet
            const colWidths = [];
            const headerRow = Object.keys(inventoryData[0]);
            headerRow.forEach((header, index) => {
                const maxLength = Math.max(
                    header.length,
                    ...inventoryData.map(row => String(row[header] || '').length)
                );
                colWidths.push({ wch: Math.min(maxLength + 2, 30) });
            });
            inventoryWS['!cols'] = colWidths;
            
            XLSX.utils.book_append_sheet(workbook, inventoryWS, 'Inventory');
            
            // Low Stock sheet
            const lowStockItems = inventoryData.filter(item => item['Low Stock'] === 'Yes');
            if (lowStockItems.length > 0) {
                const lowStockWS = XLSX.utils.json_to_sheet(lowStockItems);
                lowStockWS['!cols'] = colWidths;
                XLSX.utils.book_append_sheet(workbook, lowStockWS, 'Low Stock');
            }
            
            // Suppliers sheet
            const supplierSummary = stats.suppliers.map(supplier => {
                const supplierItems = this.items.filter(item => item.supplier === supplier);
                const totalValue = supplierItems.reduce((sum, item) => sum + ((item.price || 0) * (item.quantity || 0)), 0);
                
                return {
                    'Supplier': this.getSupplierDisplayName(supplier),
                    'Item Count': supplierItems.length,
                    'Total Value': totalValue,
                    'Average Value per Item': supplierItems.length > 0 ? totalValue / supplierItems.length : 0
                };
            });
            
            if (supplierSummary.length > 0) {
                const supplierWS = XLSX.utils.json_to_sheet(supplierSummary);
                supplierWS['!cols'] = [{ wch: 15 }, { wch: 12 }, { wch: 15 }, { wch: 20 }];
                XLSX.utils.book_append_sheet(workbook, supplierWS, 'Suppliers');
            }
            
            // Generate filename with timestamp
            const timestamp = new Date().toISOString().split('T')[0];
            const filename = `FeetOnFocus_Full_Inventory_${timestamp}.xlsx`;
            
            // Download file
            XLSX.writeFile(workbook, filename);
            
            showToast(`Export completed: ${filename}`, 'success');
            
        } catch (error) {
            console.error('Error exporting full inventory:', error);
            showToast('Error creating export file', 'error');
        }
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

    formatAlternativeNames(altNames) {
        if (!altNames || !Array.isArray(altNames) || altNames.length === 0) {
            return '';
        }
        return altNames.join(', ');
    }
}

// Create global reports manager instance
const reportsManager = new ReportsManager();