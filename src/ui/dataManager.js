/**
 * Data Management UI
 */

class DataManager {
    constructor() {
        this.importData = null;
    }

    async init() {
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Data Management button (from settings menu)
        document.getElementById('dataManagementBtn').addEventListener('click', () => {
            this.showDataManagementModal();
        });

        // Export data button
        document.getElementById('exportDataBtn').addEventListener('click', () => {
            this.exportData();
        });

        // Import file selection
        document.getElementById('importDataFile').addEventListener('change', (e) => {
            this.handleFileSelection(e);
        });

        // Import data button
        document.getElementById('importDataBtn').addEventListener('click', () => {
            this.importDataFromFile();
        });

        // Manual backup button
        document.getElementById('createManualBackupBtn').addEventListener('click', () => {
            this.createManualBackup();
        });

        // Copy organizer path button
        document.getElementById('copyOrganizerPathBtn').addEventListener('click', () => {
            this.copyOrganizerPath();
        });

        // Open backups folder button  
        document.getElementById('openBackupsFolderBtn').addEventListener('click', () => {
            this.showBackupsFolderInstructions();
        });
    }

    async showDataManagementModal() {
        const modal = new bootstrap.Modal(document.getElementById('dataManagementModal'));
        
        // Load data statistics and backup list
        await this.loadDataStats();
        await this.loadAutoBackups();
        
        modal.show();
    }

    async loadDataStats() {
        try {
            const stats = {
                items: 0,
                suppliers: 0,
                categories: 0,
                totalValue: 0
            };

            // Get current data counts
            const items = await inventoryDB.getAllItems();
            const suppliers = await inventoryDB.getAllSuppliers();
            const categories = await inventoryDB.getAllCategories();

            stats.items = items.length;
            stats.suppliers = suppliers.length;
            stats.categories = categories.length;
            stats.totalValue = items.reduce((sum, item) => sum + ((item.price || 0) * (item.quantity || 0)), 0);

            const lastBackup = this.getLastBackupDate();

            const statsHtml = `
                <div class="row">
                    <div class="col-6">
                        <strong>Items:</strong> ${stats.items}<br>
                        <strong>Suppliers:</strong> ${stats.suppliers}<br>
                        <strong>Categories:</strong> ${stats.categories}
                    </div>
                    <div class="col-6">
                        <strong>Total Value:</strong> ${formatCurrency(stats.totalValue)}<br>
                        <strong>Last Backup:</strong> ${lastBackup ? formatDate(lastBackup) : 'Never'}<br>
                        <strong>Database:</strong> IndexedDB
                    </div>
                </div>
            `;

            document.getElementById('dataStats').innerHTML = statsHtml;
        } catch (error) {
            console.error('Error loading data stats:', error);
            document.getElementById('dataStats').innerHTML = '<p class="text-danger">Error loading statistics</p>';
        }
    }

    async loadAutoBackups() {
        try {
            const allBackups = [];
            
            // Find all backup keys in localStorage (both auto and manual)
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith('feetonfocus_backup_')) {
                    const timestamp = key.replace('feetonfocus_backup_', '');
                    allBackups.push({ 
                        key, 
                        date: timestamp, 
                        type: 'auto',
                        displayDate: this.formatAutoTimestamp(timestamp)
                    });
                } else if (key && key.startsWith('feetonfocus_manual_')) {
                    const timestamp = key.replace('feetonfocus_manual_', '');
                    allBackups.push({ 
                        key, 
                        date: timestamp, 
                        type: 'manual',
                        displayDate: this.formatManualTimestamp(timestamp)
                    });
                }
            }

            // Sort by date (newest first)
            allBackups.sort((a, b) => {
                try {
                    let dateA, dateB;
                    
                    // Both auto and manual now use the same format: 2024-10-05_19-30-15
                    const parseTimestamp = (timestamp) => {
                        const parts = timestamp.split('_');
                        if (parts.length === 2) {
                            return new Date(`${parts[0]}T${parts[1].replace(/-/g, ':')}`);
                        } else {
                            // Fallback for old date-only format
                            return new Date(timestamp);
                        }
                    };
                    
                    dateA = parseTimestamp(a.date);
                    dateB = parseTimestamp(b.date);
                    
                    return dateB - dateA;
                } catch (error) {
                    console.error('Error sorting backups:', error);
                    return 0;
                }
            });

            if (allBackups.length === 0) {
                document.getElementById('autoBackupsList').innerHTML = '<p class="text-muted">No backups found</p>';
                return;
            }

            const backupsHtml = allBackups.map(backup => {
                const badgeClass = backup.type === 'manual' ? 'bg-warning' : 'bg-info';
                const badgeText = backup.type === 'manual' ? 'Manual' : 'Auto';
                
                return `
                    <div class="mb-3 p-3 border rounded">
                        <div class="d-flex justify-content-between align-items-start mb-2">
                            <div class="flex-grow-1">
                                <div class="d-flex align-items-center gap-2 mb-1">
                                    <span class="badge ${badgeClass}">${badgeText}</span>
                                    <strong>${backup.displayDate}</strong>
                                </div>
                                <small class="text-muted">${backup.key}</small>
                            </div>
                        </div>
                        <div class="d-flex flex-wrap gap-1 mt-2">
                            <button class="btn btn-sm btn-outline-primary" onclick="dataManager.restoreFromBackup('${backup.key}')" title="Restore this backup">
                                <i class="fas fa-undo"></i> Restore
                            </button>
                            <button class="btn btn-sm btn-outline-success" onclick="dataManager.exportBackupToFile('${backup.key}')" title="Download this backup as a file">
                                <i class="fas fa-download"></i> Export
                            </button>
                            <button class="btn btn-sm btn-outline-info" onclick="dataManager.inspectBackup('${backup.key}')" title="Inspect backup contents">
                                <i class="fas fa-search"></i> Inspect
                            </button>
                            <button class="btn btn-sm btn-outline-warning" onclick="dataManager.emergencyRestore('${backup.key}')" title="Force restore all items">
                                <i class="fas fa-exclamation-triangle"></i> Emergency
                            </button>
                            ${backup.type === 'manual' ? `
                                <button class="btn btn-sm btn-outline-danger" onclick="dataManager.deleteBackup('${backup.key}')" title="Delete this backup">
                                    <i class="fas fa-trash"></i> Delete
                                </button>
                            ` : ''}
                        </div>
                    </div>
                `;
            }).join('');

            document.getElementById('autoBackupsList').innerHTML = backupsHtml;
        } catch (error) {
            console.error('Error loading backups:', error);
            document.getElementById('autoBackupsList').innerHTML = '<p class="text-danger">Error loading backups</p>';
        }
    }

    async exportData() {
        try {
            showLoading('exportDataBtn');
            
            const data = await inventoryDB.exportAllData();
            
            // Create downloadable file
            const dataStr = JSON.stringify(data, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            
            const url = URL.createObjectURL(dataBlob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `feetonfocus_backup_${new Date().toISOString().split('T')[0]}.json`;
            
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            URL.revokeObjectURL(url);
            
            showToast('Data exported successfully', 'success');
        } catch (error) {
            console.error('Error exporting data:', error);
            showToast('Error exporting data: ' + error.message, 'error');
        } finally {
            hideLoading('exportDataBtn', '<i class="fas fa-download"></i> Export All Data');
        }
    }

    handleFileSelection(event) {
        const file = event.target.files[0];
        if (!file) {
            document.getElementById('importDataBtn').disabled = true;
            this.importData = null;
            return;
        }

        if (!file.name.endsWith('.json')) {
            showToast('Please select a JSON file', 'error');
            document.getElementById('importDataBtn').disabled = true;
            this.importData = null;
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                this.importData = JSON.parse(e.target.result);
                
                // Validate the data structure
                if (!this.validateImportData(this.importData)) {
                    showToast('Invalid data format. Please select a valid FeetOnFocus backup file.', 'error');
                    document.getElementById('importDataBtn').disabled = true;
                    this.importData = null;
                    return;
                }
                
                document.getElementById('importDataBtn').disabled = false;
                showToast('File loaded successfully. Click Import to proceed.', 'info');
            } catch (error) {
                showToast('Error reading file: ' + error.message, 'error');
                document.getElementById('importDataBtn').disabled = true;
                this.importData = null;
            }
        };
        
        reader.readAsText(file);
    }

    validateImportData(data) {
        // Check if the data has the expected structure
        return data && 
               typeof data === 'object' && 
               data.exportDate && 
               data.version && 
               Array.isArray(data.items) && 
               Array.isArray(data.suppliers) && 
               Array.isArray(data.categories);
    }

    async importDataFromFile() {
        if (!this.importData) {
            showToast('Please select a file first', 'error');
            return;
        }

        const confirmMessage = `This will import:\n` +
                              `• ${this.importData.items.length} items\n` +
                              `• ${this.importData.suppliers.length} suppliers\n` +
                              `• ${this.importData.categories.length} categories\n\n` +
                              `Existing data with the same codes will be preserved.\nProceed with import?`;

        if (!confirm(confirmMessage)) {
            return;
        }

        try {
            showLoading('importDataBtn');
            
            const result = await inventoryDB.importData(this.importData, { preserveExisting: true });
            
            let message = `Import completed:\n`;
            message += `• Added ${result.suppliers} suppliers\n`;
            message += `• Added ${result.categories} categories\n`;
            message += `• Added ${result.items} items\n`;
            if (result.skipped > 0) {
                message += `• Skipped ${result.skipped} existing records\n`;
            }
            if (result.errors.length > 0) {
                message += `\nErrors:\n${result.errors.join('\n')}`;
            }

            alert(message);
            
            // Refresh UI
            if (window.itemsManager) {
                await itemsManager.loadItems();
                await itemsManager.refreshSupplierOptions();
                await itemsManager.refreshCategoryOptions();
            }
            
            if (window.dashboard) {
                await dashboard.refreshStats();
            }

            // Update stats in modal
            await this.loadDataStats();
            
            showToast('Data imported successfully', 'success');
            
        } catch (error) {
            console.error('Error importing data:', error);
            showToast('Error importing data: ' + error.message, 'error');
        } finally {
            hideLoading('importDataBtn', '<i class="fas fa-upload"></i> Import Data');
        }
    }

    async restoreFromBackup(backupKey) {
        const backupData = localStorage.getItem(backupKey);
        if (!backupData) {
            showToast('Backup not found', 'error');
            return;
        }

        const data = JSON.parse(backupData);
        if (!this.validateImportData(data)) {
            showToast('Invalid backup data', 'error');
            return;
        }

        // Show restore options
        const restoreOption = await this.showRestoreOptionsDialog(backupKey, data);
        if (!restoreOption) {
            return; // User cancelled
        }

        try {
            const result = await inventoryDB.importData(data, { 
                preserveExisting: restoreOption === 'merge',
                replaceExisting: restoreOption === 'replace' || restoreOption === 'clear',
                clearFirst: restoreOption === 'clear'
            });
            
            let message = `Restore completed:\n`;
            message += `• Added ${result.suppliers} suppliers\n`;
            message += `• Added ${result.categories} categories\n`;
            message += `• Added ${result.items} items\n`;
            if (result.skipped > 0) {
                message += `• Skipped ${result.skipped} existing records\n`;
            }
            if (result.updated > 0) {
                message += `• Updated ${result.updated} existing records\n`;
            }

            alert(message);
            
            // Refresh UI
            if (window.itemsManager) {
                await itemsManager.loadItems();
                await itemsManager.refreshSupplierOptions();
                await itemsManager.refreshCategoryOptions();
            }
            
            if (window.dashboard) {
                await dashboard.refreshStats();
            }

            await this.loadDataStats();
            showToast('Backup restored successfully', 'success');
            
        } catch (error) {
            console.error('Error restoring backup:', error);
            showToast('Error restoring backup: ' + error.message, 'error');
        }
    }

    showRestoreOptionsDialog(backupKey, data) {
        return new Promise((resolve) => {
            const modal = document.createElement('div');
            modal.className = 'modal fade';
            modal.innerHTML = `
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title"><i class="fas fa-undo"></i> Restore Options</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="alert alert-info">
                                <strong>Backup contains:</strong><br>
                                • ${data.items ? data.items.length : 0} items<br>
                                • ${data.suppliers ? data.suppliers.length : 0} suppliers<br>
                                • ${data.categories ? data.categories.length : 0} categories
                            </div>
                            
                            <p><strong>Choose how to handle existing data:</strong></p>
                            
                            <div class="form-check mb-3">
                                <input class="form-check-input" type="radio" name="restoreOption" id="mergeOption" value="merge" checked>
                                <label class="form-check-label" for="mergeOption">
                                    <strong>Merge (Recommended)</strong><br>
                                    <small class="text-muted">Add new data from backup, keep existing data unchanged. Safe option that won't lose current data.</small>
                                </label>
                            </div>
                            
                            <div class="form-check mb-3">
                                <input class="form-check-input" type="radio" name="restoreOption" id="replaceOption" value="replace">
                                <label class="form-check-label" for="replaceOption">
                                    <strong>Replace Existing</strong><br>
                                    <small class="text-muted">Update existing records with backup data. This will overwrite current data where conflicts exist.</small>
                                </label>
                            </div>
                            
                            <div class="form-check mb-3">
                                <input class="form-check-input" type="radio" name="restoreOption" id="clearOption" value="clear">
                                <label class="form-check-label" for="clearOption">
                                    <strong>Full Restore (Clear & Replace)</strong><br>
                                    <small class="text-danger">⚠️ This will delete all current data and restore only the backup data. Use with caution!</small>
                                </label>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                            <button type="button" class="btn btn-primary" id="confirmRestoreBtn">Restore Backup</button>
                        </div>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            const bsModal = new bootstrap.Modal(modal);
            
            modal.querySelector('#confirmRestoreBtn').addEventListener('click', () => {
                const selectedOption = modal.querySelector('input[name="restoreOption"]:checked').value;
                bsModal.hide();
                resolve(selectedOption);
            });
            
            modal.addEventListener('hidden.bs.modal', () => {
                document.body.removeChild(modal);
            });
            
            bsModal.show();
        });
    }

    async createManualBackup() {
        try {
            const button = document.getElementById('createManualBackupBtn');
            const originalText = button.innerHTML;
            
            // Show loading state
            button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating Backup...';
            button.disabled = true;
            
            // Create the backup using the existing database method
            await inventoryDB.createManualBackup();
            
            // Show success feedback
            button.innerHTML = '<i class="fas fa-check"></i> Backup Created!';
            button.classList.remove('btn-warning');
            button.classList.add('btn-success');
            
            showToast('Manual backup created successfully', 'success');
            
            // Refresh the backups list and data stats
            await this.loadAutoBackups();
            await this.loadDataStats();
            
            // Reset button after 2 seconds
            setTimeout(() => {
                button.innerHTML = originalText;
                button.classList.remove('btn-success');
                button.classList.add('btn-warning');
                button.disabled = false;
            }, 2000);
            
        } catch (error) {
            console.error('Error creating manual backup:', error);
            showToast('Error creating backup: ' + error.message, 'error');
            
            // Reset button on error
            const button = document.getElementById('createManualBackupBtn');
            button.innerHTML = '<i class="fas fa-save"></i> Create Manual Backup';
            button.disabled = false;
        }
    }

    formatTimestamp(timestamp) {
        try {
            // Legacy method - kept for compatibility
            // Manual backup timestamps are in format: 2025-10-05T19-40-572Z
            // Need to convert back to proper ISO format
            let isoString = timestamp;
            
            // Replace the dashes in the time portion back to colons and dots
            // Format: 2025-10-05T19-40-572Z -> 2025-10-05T19:40:57.2Z
            isoString = isoString.replace(/T(\d{2})-(\d{2})-(\d+)Z$/, 'T$1:$2:$3Z');
            
            // Handle the milliseconds part if it exists
            isoString = isoString.replace(/(\d{2}:\d{2}:\d{2})(\d+)Z$/, '$1.$2Z');
            
            const date = new Date(isoString);
            
            if (isNaN(date.getTime())) {
                // If parsing fails, try a simpler approach
                return timestamp.replace('T', ' ').replace(/-/g, ':').replace('Z', '');
            }
            
            return date.toLocaleString();
        } catch (error) {
            console.error('Error parsing timestamp:', timestamp, error);
            return timestamp; // Fallback to original timestamp
        }
    }

    formatAutoTimestamp(timestamp) {
        try {
            // Handle new format: 2024-10-05_19-30-15 (same as manual backups now)
            if (timestamp.includes('_')) {
                const parts = timestamp.split('_');
                if (parts.length === 2) {
                    const datePart = parts[0]; // 2024-10-05
                    const timePart = parts[1].replace(/-/g, ':'); // 19:30:15
                    
                    const dateObj = new Date(`${datePart}T${timePart}`);
                    if (!isNaN(dateObj.getTime())) {
                        // Format as DD/MM/YYYY at HH:MM:SS
                        const day = String(dateObj.getDate()).padStart(2, '0');
                        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
                        const year = dateObj.getFullYear();
                        const time = dateObj.toLocaleTimeString('en-GB', { hour12: false });
                        return `${day}/${month}/${year} at ${time}`;
                    }
                }
                
                // Fallback for underscore format
                return timestamp.replace('_', ' at ').replace(/-/g, ':');
            }
            
            // Handle legacy date-only format: 2024-10-05
            if (timestamp.match(/^\d{4}-\d{2}-\d{2}$/)) {
                const date = new Date(timestamp);
                if (!isNaN(date.getTime())) {
                    const day = String(date.getDate()).padStart(2, '0');
                    const month = String(date.getMonth() + 1).padStart(2, '0');
                    const year = date.getFullYear();
                    return `${day}/${month}/${year}`;
                }
            }
            
            // Final fallback
            return timestamp.replace(/-/g, ':').replace('_', ' at ');
        } catch (error) {
            console.error('Error parsing auto timestamp:', timestamp, error);
            return timestamp;
        }
    }

    formatManualTimestamp(timestamp) {
        try {
            // Handle new format: 2024-10-05_19-30-15
            if (timestamp.includes('_')) {
                const parts = timestamp.split('_');
                if (parts.length === 2) {
                    const datePart = parts[0]; // 2024-10-05
                    const timePart = parts[1].replace(/-/g, ':'); // 19:30:15
                    
                    const dateObj = new Date(`${datePart}T${timePart}`);
                    if (!isNaN(dateObj.getTime())) {
                        // Format as DD/MM/YYYY at HH:MM:SS
                        const day = String(dateObj.getDate()).padStart(2, '0');
                        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
                        const year = dateObj.getFullYear();
                        const time = dateObj.toLocaleTimeString('en-GB', { hour12: false });
                        return `${day}/${month}/${year} at ${time}`;
                    }
                }
                
                // Fallback for underscore format
                return timestamp.replace('_', ' at ').replace(/-/g, ':');
            }
            
            // Handle legacy format: 2025-10-05T19-40-572Z
            if (timestamp.includes('T') && timestamp.includes('Z')) {
                let isoString = timestamp;
                
                // Fix the format: 2025-10-05T19-40-572Z -> 2025-10-05T19:40:57.2Z
                isoString = isoString.replace(/T(\d{2})-(\d{2})-(\d+)Z$/, 'T$1:$2:$3Z');
                isoString = isoString.replace(/(\d{2}:\d{2}:\d{2})(\d+)Z$/, '$1.$2Z');
                
                const date = new Date(isoString);
                if (!isNaN(date.getTime())) {
                    const day = String(date.getDate()).padStart(2, '0');
                    const month = String(date.getMonth() + 1).padStart(2, '0');
                    const year = date.getFullYear();
                    const time = date.toLocaleTimeString('en-GB', { hour12: false });
                    return `${day}/${month}/${year} at ${time}`;
                }
            }
            
            // Final fallback
            return timestamp.replace(/-/g, ':').replace('T', ' at ').replace('Z', '');
        } catch (error) {
            console.error('Error parsing manual timestamp:', timestamp, error);
            return timestamp;
        }
    }

    async exportBackupToFile(backupKey) {
        try {
            console.log('Exporting backup to file:', backupKey);
            const fileName = await inventoryDB.exportLocalStorageBackupToFile(backupKey);
            if (fileName) {
                showToast(`Backup exported as ${fileName}`, 'success');
            } else {
                showToast('Export failed - please check console for details', 'error');
            }
        } catch (error) {
            console.error('Error exporting backup to file:', error);
            showToast('Error exporting backup: ' + error.message, 'error');
        }
    }

    async deleteBackup(backupKey) {
        try {
            if (confirm('Are you sure you want to delete this backup? This action cannot be undone.')) {
                localStorage.removeItem(backupKey);
                showToast('Backup deleted successfully', 'success');
                
                // Refresh the backups list
                await this.loadAutoBackups();
                await this.loadDataStats();
            }
        } catch (error) {
            console.error('Error deleting backup:', error);
            showToast('Error deleting backup: ' + error.message, 'error');
        }
    }

    async inspectBackup(backupKey) {
        try {
            const backupData = localStorage.getItem(backupKey);
            if (!backupData) {
                showToast('Backup not found', 'error');
                return;
            }

            const data = JSON.parse(backupData);
            console.log('Backup inspection for:', backupKey);
            console.log('Backup data:', data);
            console.log('Items in backup:', data.items?.length || 0);
            console.log('Suppliers in backup:', data.suppliers?.length || 0);
            console.log('Categories in backup:', data.categories?.length || 0);
            
            if (data.items && data.items.length > 0) {
                console.log('Sample items:', data.items.slice(0, 3));
            }
            
            alert(`Backup Analysis:\n\nItems: ${data.items?.length || 0}\nSuppliers: ${data.suppliers?.length || 0}\nCategories: ${data.categories?.length || 0}\n\nCheck console for detailed data.`);
            
        } catch (error) {
            console.error('Error inspecting backup:', error);
            showToast('Error inspecting backup: ' + error.message, 'error');
        }
    }

    async emergencyRestore(backupKey) {
        try {
            const backupData = localStorage.getItem(backupKey);
            if (!backupData) {
                showToast('Backup not found', 'error');
                return;
            }

            const data = JSON.parse(backupData);
            
            if (confirm(`Emergency Restore:\n\nThis will force-add all items from the backup without checking for duplicates.\n\nBackup contains ${data.items?.length || 0} items.\n\nProceed?`)) {
                let restored = 0;
                let errors = 0;
                
                // Force add all items
                if (data.items && data.items.length > 0) {
                    for (const item of data.items) {
                        try {
                            const { id, ...itemData } = item;
                            await inventoryDB.addItem(itemData);
                            restored++;
                        } catch (error) {
                            console.error('Error restoring item:', item.name, error);
                            errors++;
                        }
                    }
                }
                
                // Force add suppliers
                if (data.suppliers && data.suppliers.length > 0) {
                    for (const supplier of data.suppliers) {
                        try {
                            const { id, ...supplierData } = supplier;
                            await inventoryDB.addSupplier(supplierData);
                        } catch (error) {
                            console.error('Error restoring supplier:', supplier.name, error);
                        }
                    }
                }
                
                // Force add categories
                if (data.categories && data.categories.length > 0) {
                    for (const category of data.categories) {
                        try {
                            const { id, ...categoryData } = category;
                            await inventoryDB.addCategory(categoryData);
                        } catch (error) {
                            console.error('Error restoring category:', category.name, error);
                        }
                    }
                }
                
                showToast(`Emergency restore completed: ${restored} items restored, ${errors} errors`, restored > 0 ? 'success' : 'warning');
                
                // Refresh UI
                if (window.itemsManager) {
                    await itemsManager.loadItems();
                }
                if (window.dashboard) {
                    await dashboard.refreshStats();
                }
                await this.loadDataStats();
            }
        } catch (error) {
            console.error('Emergency restore error:', error);
            showToast('Emergency restore failed: ' + error.message, 'error');
        }
    }

    async copyOrganizerPath() {
        try {
            const path = 'backups/organize-backups.bat';
            await navigator.clipboard.writeText(path);
            showToast('📋 Path copied to clipboard: ' + path, 'success');
        } catch (error) {
            console.error('Error copying to clipboard:', error);
            // Fallback: show the path in an alert
            alert('Copy this path: backups/organize-backups.bat');
        }
    }

    showBackupsFolderInstructions() {
        const instructions = `To open the backups folder:\n\n` +
            `1. Open File Explorer (Windows + E)\n` +
            `2. Navigate to: ${window.location.origin}\n` +
            `3. Go to: backups/\n\n` +
            `Or run this in Command Prompt:\n` +
            `explorer "${window.location.pathname.replace('/index.html', '')}/backups"`;
        
        alert(instructions);
    }

    getLastBackupDate() {
        try {
            const backupKeys = [];
            // Check both auto and manual backups
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && (key.startsWith('feetonfocus_backup_') || key.startsWith('feetonfocus_manual_'))) {
                    if (key.startsWith('feetonfocus_backup_')) {
                        backupKeys.push(key.replace('feetonfocus_backup_', ''));
                    } else {
                        const timestamp = key.replace('feetonfocus_manual_', '');
                        backupKeys.push(timestamp);
                    }
                }
            }
            
            if (backupKeys.length === 0) return null;
            
            backupKeys.sort();
            return backupKeys[backupKeys.length - 1]; // Most recent
        } catch (error) {
            return null;
        }
    }
}

// Create global data manager instance
const dataManager = new DataManager();