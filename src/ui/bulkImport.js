/**
 * Bulk Import Manager
 * Handles CSV/Excel imports with configurable field mappings and import profiles
 */

class BulkImportManager {
    constructor() {
        this.currentStep = 1;
        this.maxSteps = 4; // Added data validation step
        this.fileData = null;
        this.headers = [];
        this.parsedData = [];
        this.fieldMappings = {};
        this.importProfiles = {};
        this.currentProfile = null;
        this.dataResolutions = {
            suppliers: new Map(), // Maps import name -> resolved supplier
            categories: new Map()  // Maps import name -> resolved category
        };
        this.pendingResolutions = [];
        this.existingSuppliers = [];
        this.existingCategories = [];
        
        // Default Halaxy profile
        this.defaultProfiles = {
            halaxy: {
                name: 'Halaxy Medical Practice',
                fileType: 'csv',
                fieldMappings: {
                    'Name': 'name',
                    'Code': 'sku',
                    'Supplier': 'supplier',
                    'Balance': 'quantity',
                    'Type': 'category',
                    'Unit Cost': 'costPrice',
                    'Tax': null, // Not mapped
                    'Total': null, // Not mapped
                    'Status': null // Not mapped
                },
                itemType: 'consumables',
                description: 'Default profile for importing from Halaxy medical practice software'
            }
        };
    }

    async init() {
        console.log('Initializing bulk import manager');
        
        // Ensure DOM is ready
        if (document.readyState === 'loading') {
            await new Promise(resolve => {
                document.addEventListener('DOMContentLoaded', resolve);
            });
        }
        
        try {
            await this.loadImportProfiles();
            this.setupEventListeners();
            this.setupConflictResolutionListeners();
            console.log('Bulk import manager initialized successfully');
        } catch (error) {
            console.error('Error initializing bulk import manager:', error);
        }
    }

    setupEventListeners() {
        console.log('Setting up bulk import event listeners');
        
        // Helper function to safely add event listeners
        const safeAddEventListener = (elementId, event, handler, required = true) => {
            const element = document.getElementById(elementId);
            if (element) {
                element.addEventListener(event, handler);
            } else if (required) {
                console.error(`Required element not found: ${elementId}`);
            } else {
                console.warn(`Optional element not found: ${elementId}`);
            }
            return element;
        };

        // Modal show event
        safeAddEventListener('bulkImportModal', 'shown.bs.modal', () => {
            console.log('Bulk import modal shown - resetting wizard');
            // Small delay to ensure DOM is fully ready
            setTimeout(() => {
                this.resetImportWizard();
            }, 100);
        });
        
        // Modal hidden event - ensure clean state when modal is closed
        safeAddEventListener('bulkImportModal', 'hidden.bs.modal', () => {
            console.log('Bulk import modal hidden - clearing state');
            this.clearImportState();
        });

        // File input change
        safeAddEventListener('importFile', 'change', (e) => {
            this.handleFileSelection(e);
        });

        // Profile selection change
        safeAddEventListener('importProfile', 'change', (e) => {
            this.handleProfileChange(e.target.value);
        });

        // Navigation buttons
        safeAddEventListener('nextStepBtn', 'click', () => {
            this.nextStep();
        });

        safeAddEventListener('prevStepBtn', 'click', () => {
            this.previousStep();
        });

        // Import button
        safeAddEventListener('importBtn', 'click', () => {
            this.processImport();
        });
        
        // Cancel button
        safeAddEventListener('cancelImportBtn', 'click', () => {
            this.cancelImport();
        });

        // All bulk import buttons - these might not exist depending on the current tab
        safeAddEventListener('bulkImportResellingBtn', 'click', () => {
            this.showBulkImportModal('reselling');
        }, false);

        safeAddEventListener('bulkImportConsumablesBtn', 'click', () => {
            this.showBulkImportModal('consumables');
        }, false);

        safeAddEventListener('bulkImportOfficeEquipmentBtn', 'click', () => {
            this.showBulkImportModal('office_equipment');
        }, false);

        safeAddEventListener('bulkImportBtn', 'click', () => {
            this.showBulkImportModal();
        }, false);
        
        // Download template button (will be added to modal)
        safeAddEventListener('downloadTemplateBtn', 'click', () => {
            this.downloadImportTemplate();
        }, false);
        
        console.log('Bulk import event listeners setup complete');
    }
    
    setupConflictResolutionListeners() {
        // Add event delegation for dynamically created conflict resolution buttons
        document.addEventListener('click', (e) => {
            if (e.target.matches('[data-action="map"]')) {
                const index = parseInt(e.target.dataset.index);
                const targetName = e.target.dataset.target;
                const targetCode = e.target.dataset.targetCode;
                this.resolveConflictByMapping(index, targetName, targetCode);
            } else if (e.target.matches('[data-action="create"]')) {
                const index = parseInt(e.target.dataset.index);
                this.resolveConflictByCreating(index);
            }
        });
    }

    showBulkImportModal(defaultItemType = null) {
        const modalElement = document.getElementById('bulkImportModal');
        if (!modalElement) {
            console.error('Bulk import modal not found in DOM');
            showToast('Import modal not available. Please refresh the page.', 'error');
            return;
        }
        
        if (defaultItemType) {
            // Pre-select the item type if called from a specific tab
            setTimeout(() => {
                const itemTypeSelect = document.getElementById('itemType');
                if (itemTypeSelect) {
                    itemTypeSelect.value = defaultItemType;
                }
            }, 200); // Increased timeout to ensure modal is fully rendered
        }

        try {
            const modal = new bootstrap.Modal(modalElement);
            modal.show();
        } catch (error) {
            console.error('Error showing bulk import modal:', error);
            showToast('Error opening import modal', 'error');
        }
    }

    resetImportWizard() {
        console.log('Resetting import wizard');
        
        this.currentStep = 1;
        this.fileData = null;
        this.headers = [];
        this.parsedData = [];
        this.fieldMappings = {};
        this.currentProfile = null;
        this.dataResolutions = {
            suppliers: new Map(),
            categories: new Map()
        };
        this.pendingResolutions = [];
        this.existingSuppliers = [];
        this.existingCategories = [];

        // Reset UI
        this.updateStepDisplay();
        
        // Check if elements exist before trying to reset them
        const elements = {
            importFile: document.getElementById('importFile'),
            importProfile: document.getElementById('importProfile'),
            profileName: document.getElementById('profileName'),
            itemType: document.getElementById('itemType'),
            importStep1: document.getElementById('importStep1'),
            importStep2: document.getElementById('importStep2'),
            importStep3: document.getElementById('importStep3'),
            importStep4: document.getElementById('importStep4')
        };
        
        Object.entries(elements).forEach(([key, element]) => {
            if (!element) {
                console.error(`Element ${key} not found during reset`);
            }
        });
        
        if (elements.importFile) elements.importFile.value = '';
        if (elements.importProfile) elements.importProfile.value = '';
        if (elements.profileName) elements.profileName.value = '';
        if (elements.itemType) elements.itemType.value = '';
        
        // Show step 1, hide others
        if (elements.importStep1) elements.importStep1.classList.remove('d-none');
        if (elements.importStep2) elements.importStep2.classList.add('d-none');
        if (elements.importStep3) elements.importStep3.classList.add('d-none');
        if (elements.importStep4) elements.importStep4.classList.add('d-none');
        
        console.log('Import wizard reset complete');
    }
    
    clearImportState() {
        // Clear all data when modal is closed
        this.fileData = null;
        this.headers = [];
        this.parsedData = [];
        this.fieldMappings = {};
        this.currentProfile = null;
        this.dataResolutions = {
            suppliers: new Map(),
            categories: new Map()
        };
        this.pendingResolutions = [];
        this.existingSuppliers = [];
        this.existingCategories = [];
        
        // Clear file input
        const fileInput = document.getElementById('importFile');
        if (fileInput) {
            fileInput.value = '';
            // Trigger change event to ensure proper cleanup
            fileInput.dispatchEvent(new Event('change'));
        }
        
        console.log('Import state cleared completely');
    }
    
    async cancelImport() {
        const confirmCancel = confirm('Are you sure you want to cancel the import? All progress will be lost.');
        if (confirmCancel) {
            this.closeModal();
            await this.refreshAllPages();
        }
    }
    
    closeModal() {
        const modalElement = document.getElementById('bulkImportModal');
        if (modalElement) {
            const modal = bootstrap.Modal.getInstance(modalElement);
            if (modal) {
                modal.hide();
            }
        }
        // Clear all state when modal is manually closed
        this.clearImportState();
    }
    
    async refreshAllPages() {
        console.log('🔄 Refreshing all relevant pages after import completion/cancellation...');
        
        try {
            // Refresh items manager and all type-specific views
            if (window.itemsManager) {
                console.log('🔄 Refreshing items manager and all item views...');
                await itemsManager.loadItems();
                await itemsManager.refreshSupplierOptions();
                await itemsManager.refreshCategoryOptions();
                
                // Refresh type-specific tables if they're currently visible
                const activeTab = document.querySelector('.nav-link.active, .dropdown-item.active');
                if (activeTab) {
                    const tabText = activeTab.textContent.trim().toLowerCase();
                    if (tabText.includes('reselling')) {
                        await itemsManager.loadItemsByType('reselling');
                    } else if (tabText.includes('consumables')) {
                        await itemsManager.loadItemsByType('consumable');
                    } else if (tabText.includes('office equipment')) {
                        await itemsManager.loadItemsByType('office_equipment');
                    }
                }
            }
            
            // Refresh suppliers manager
            if (window.suppliersManager) {
                console.log('🔄 Refreshing suppliers...');
                await suppliersManager.loadSuppliers();
            }
            
            // Refresh categories manager
            if (window.categoriesManager) {
                console.log('🔄 Refreshing categories...');
                await categoriesManager.loadCategories();
            }
            
            // Refresh dashboard statistics
            if (window.dashboard) {
                console.log('🔄 Refreshing dashboard stats...');
                await dashboard.refreshStats();
            }
            
            // Refresh any reports if active
            if (window.reportsManager) {
                console.log('🔄 Refreshing reports...');
                // Reports typically refresh when viewed
            }
            
            console.log('✅ All pages refreshed successfully');
            showToast('All views have been refreshed', 'info');
            
        } catch (error) {
            console.error('❌ Error refreshing pages:', error);
            showToast('Some views may need manual refresh', 'warning');
        }
    }

    updateStepDisplay() {
        document.getElementById('currentStep').textContent = `Step ${this.currentStep} of ${this.maxSteps}`;
        
        // Update button visibility
        document.getElementById('prevStepBtn').style.display = this.currentStep > 1 ? 'inline-block' : 'none';
        document.getElementById('nextStepBtn').style.display = this.currentStep < this.maxSteps ? 'inline-block' : 'none';
        document.getElementById('importBtn').style.display = this.currentStep === this.maxSteps ? 'inline-block' : 'none';
    }

    async handleFileSelection(event) {
        const file = event.target.files[0];
        console.log('File selection event:', file ? file.name : 'No file selected');
        
        if (!file) {
            // File was cleared - reset headers and data
            this.headers = [];
            this.parsedData = [];
            console.log('File input cleared - data reset');
            return;
        }

        try {
            this.showLoading('importStep1');
            
            const fileType = this.getFileType(file);
            this.setFileType(fileType);
            
            if (fileType === 'csv') {
                await this.parseCSV(file);
            } else if (fileType === 'excel') {
                await this.parseExcel(file);
            } else {
                throw new Error('Unsupported file type');
            }

            console.log('File parsed successfully:', {
                headers: this.headers,
                rowCount: this.parsedData.length,
                sampleRow: this.parsedData[0]
            });
            
            showToast(`File parsed successfully: ${this.headers.length} columns, ${this.parsedData.length} rows`, 'success');
            
        } catch (error) {
            console.error('Error parsing file:', error);
            showToast('Error parsing file: ' + error.message, 'error');
            
            // Reset file input on error
            event.target.value = '';
            this.headers = [];
            this.parsedData = [];
        } finally {
            this.hideLoading('importStep1');
        }
    }

    getFileType(file) {
        const extension = file.name.split('.').pop().toLowerCase();
        if (extension === 'csv') return 'csv';
        if (['xlsx', 'xls'].includes(extension)) return 'excel';
        throw new Error('Unsupported file format. Please use CSV or Excel files.');
    }

    setFileType(fileType) {
        const csvRadio = document.getElementById('csvFileType');
        const excelRadio = document.getElementById('excelFileType');
        
        if (csvRadio && excelRadio) {
            if (fileType === 'csv') {
                csvRadio.checked = true;
                excelRadio.checked = false;
            } else {
                excelRadio.checked = true;
                csvRadio.checked = false;
            }
        } else {
            console.error('File type radio buttons not found');
        }
    }

    async parseCSV(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const csv = e.target.result;
                    if (!csv || csv.trim().length === 0) {
                        throw new Error('File is empty or could not be read');
                    }
                    
                    const lines = csv.split('\n')
                        .map(line => line.trim())
                        .filter(line => line.length > 0);
                    
                    if (lines.length === 0) {
                        throw new Error('No data found in file');
                    }

                    // Parse CSV headers
                    this.headers = this.parseCSVLine(lines[0])
                        .map(header => String(header || '').trim())
                        .filter(header => header.length > 0);
                    
                    if (this.headers.length === 0) {
                        throw new Error('No valid headers found in CSV file');
                    }
                    
                    // Parse data rows
                    this.parsedData = lines.slice(1)
                        .map(line => this.parseCSVLine(line))
                        .filter(row => row.some(cell => cell && cell.trim().length > 0)) // Filter empty rows
                        .map(row => {
                            const rowObj = {};
                            this.headers.forEach((header, index) => {
                                const value = (row[index] !== undefined) ? String(row[index]).trim() : '';
                                rowObj[header] = value;
                            });
                            return rowObj;
                        })
                        .filter(rowObj => Object.values(rowObj).some(val => val.length > 0)); // Remove completely empty rows

                    if (this.parsedData.length === 0) {
                        throw new Error('No data rows found in CSV file');
                    }

                    console.log('CSV parsed successfully:', { 
                        headers: this.headers, 
                        rows: this.parsedData.length,
                        sampleHeaders: this.headers.slice(0, 5),
                        sampleRow: this.parsedData[0]
                    });
                    resolve();
                } catch (error) {
                    console.error('CSV parsing error:', error);
                    reject(new Error(`CSV parsing failed: ${error.message}`));
                }
            };
            reader.onerror = () => reject(new Error('Could not read the selected file'));
            reader.readAsText(file, 'UTF-8');
        });
    }

    parseCSVLine(line) {
        if (!line || typeof line !== 'string') {
            return [];
        }
        
        const result = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            if (char === '"') {
                // Handle escaped quotes
                if (inQuotes && line[i + 1] === '"') {
                    current += '"';
                    i++; // Skip the next quote
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (char === ',' && !inQuotes) {
                result.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        
        result.push(current.trim());
        
        // Clean up fields - remove surrounding quotes and handle empty fields
        return result.map(field => {
            if (field === undefined || field === null) {
                return '';
            }
            field = String(field).trim();
            // Remove surrounding quotes if they exist
            if (field.length >= 2 && field.startsWith('"') && field.endsWith('"')) {
                field = field.slice(1, -1);
            }
            return field;
        });
    }

    async parseExcel(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    
                    // Get the first worksheet
                    const sheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[sheetName];
                    
                    // Convert to JSON
                    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                    
                    if (jsonData.length === 0) {
                        throw new Error('Excel file is empty');
                    }

                    // Extract headers and data
                    this.headers = jsonData[0].map(header => String(header || '').trim()).filter(h => h);
                    this.parsedData = jsonData.slice(1)
                        .filter(row => row.some(cell => cell !== undefined && cell !== ''))
                        .map(row => {
                            const rowObj = {};
                            this.headers.forEach((header, index) => {
                                rowObj[header] = String(row[index] || '').trim();
                            });
                            return rowObj;
                        });

                    console.log('Excel parsed:', { headers: this.headers, rows: this.parsedData.length });
                    resolve();
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = () => reject(new Error('Error reading Excel file'));
            reader.readAsArrayBuffer(file);
        });
    }

    handleProfileChange(profileKey) {
        if (!profileKey) {
            this.currentProfile = null;
            return;
        }

        const profile = this.defaultProfiles[profileKey] || this.importProfiles[profileKey];
        if (profile) {
            this.currentProfile = profile;
            this.setFileType(profile.fileType);
            
            const itemTypeSelect = document.getElementById('itemType');
            if (profile.itemType && itemTypeSelect) {
                itemTypeSelect.value = profile.itemType;
            }
            
            showToast(`Applied profile: ${profile.name}`, 'success');
        }
    }

    async nextStep() {
        try {
            if (this.currentStep === 1) {
                if (!this.headers.length || !this.parsedData.length) {
                    showToast('Please upload a valid file first', 'warning');
                    return;
                }
                console.log('Moving to step 2 - field mapping');
                await this.showFieldMapping();
            } else if (this.currentStep === 2) {
                if (!this.validateFieldMappings()) {
                    showToast('Please map at least the Name field', 'warning');
                    return;
                }
                console.log('Moving to step 3 - data validation');
                await this.showDataValidation();
            } else if (this.currentStep === 3) {
                if (this.pendingResolutions.length > 0) {
                    showToast(`Please resolve ${this.pendingResolutions.length} pending data mappings first`, 'warning');
                    return;
                }
                console.log('Moving to step 4 - preview');
                await this.showPreview();
            }

            this.currentStep++;
            this.updateStepDisplay();
            this.showCurrentStep();
        } catch (error) {
            console.error('Error in nextStep:', error);
            showToast('Error proceeding to next step: ' + error.message, 'error');
        }
    }

    previousStep() {
        this.currentStep--;
        this.updateStepDisplay();
        this.showCurrentStep();
    }

    showCurrentStep() {
        console.log(`Showing step ${this.currentStep}`);
        
        // Hide all steps
        for (let i = 1; i <= this.maxSteps; i++) {
            const stepElement = document.getElementById(`importStep${i}`);
            if (stepElement) {
                stepElement.classList.add('d-none');
            } else {
                console.error(`Step element importStep${i} not found`);
            }
        }
        
        // Show current step
        const currentStepElement = document.getElementById(`importStep${this.currentStep}`);
        if (currentStepElement) {
            currentStepElement.classList.remove('d-none');
        } else {
            console.error(`Current step element importStep${this.currentStep} not found`);
            // Show error in modal
            const modalBody = document.querySelector('#bulkImportModal .modal-body');
            if (modalBody) {
                modalBody.innerHTML = `
                    <div class="alert alert-danger">
                        <h6>Error: Modal Step Not Found</h6>
                        <p>There was an error displaying step ${this.currentStep}. Please close this dialog and try again.</p>
                        <button class="btn btn-secondary" onclick="location.reload();">Reload Page</button>
                    </div>
                `;
            }
        }
    }

    async showFieldMapping() {
        const container = document.getElementById('fieldMappingContainer');
        
        console.log('Setting up field mapping with headers:', this.headers);
        console.log('Sample parsed data:', this.parsedData[0]);
        
        if (!this.headers || this.headers.length === 0) {
            container.innerHTML = '<div class="alert alert-danger">No valid headers found in the file. Please check your CSV format.</div>';
            return;
        }
        
        // Available item fields for mapping
        const itemFields = {
            'name': { label: 'Item Name', required: true, description: 'The name of the item' },
            'sku': { label: 'SKU/Code', required: false, description: 'Stock keeping unit or item code' },
            'description': { label: 'Description', required: false, description: 'Item description' },
            'category': { label: 'Category', required: false, description: 'Item category' },
            'supplier': { label: 'Supplier', required: false, description: 'Default supplier' },
            'quantity': { label: 'Current Stock', required: false, description: 'Current quantity in stock' },
            'costPrice': { label: 'Cost Price', required: false, description: 'Cost price per unit' },
            'sellingPrice': { label: 'Selling Price', required: false, description: 'Selling price per unit' },
            'lowStockThreshold': { label: 'Low Stock Threshold', required: false, description: 'Alert when stock falls below this number' },
            'notes': { label: 'Notes', required: false, description: 'Additional notes' }
        };

        let mappingHtml = '<div class="row">';
        
        // Create mapping dropdowns
        Object.entries(itemFields).forEach(([fieldKey, fieldInfo]) => {
            const preselectedColumn = this.getPreselectedColumn(fieldKey);
            
            mappingHtml += `
                <div class="col-md-6 mb-3">
                    <label class="form-label">
                        ${fieldInfo.label} ${fieldInfo.required ? '<span class="text-danger">*</span>' : ''}
                    </label>
                    <select class="form-select field-mapping" data-field="${fieldKey}">
                        <option value="">-- Do not import --</option>
                        ${this.headers.map(header => 
                            `<option value="${header}" ${header === preselectedColumn ? 'selected' : ''}>${header}</option>`
                        ).join('')}
                    </select>
                    <div class="form-text">${fieldInfo.description}</div>
                </div>
            `;
        });
        
        mappingHtml += '</div>';
        container.innerHTML = mappingHtml;

        // Add event listeners for mapping changes and initialize preselected mappings
        if (container) {
            container.querySelectorAll('.field-mapping').forEach(select => {
                if (select) {
                    const field = select.dataset.field;
                    const selectedValue = select.value;
                    
                    // Initialize mapping if a value is already selected (preselected)
                    if (field && selectedValue) {
                        this.fieldMappings[field] = selectedValue;
                    }
                    
                    select.addEventListener('change', (e) => {
                        const field = e.target.dataset ? e.target.dataset.field : null;
                        const column = e.target.value;
                        
                        if (field && column) {
                            this.fieldMappings[field] = column;
                        } else if (field) {
                            delete this.fieldMappings[field];
                        }
                        
                        // Debug logging
                        console.log('Field mapping updated:', field, '→', column);
                        console.log('Current fieldMappings:', this.fieldMappings);
                    });
                }
            });
        } else {
            console.error('Field mapping container not found');
        }

        // Initialize mappings from current profile if exists
        if (this.currentProfile && this.currentProfile.fieldMappings && container) {
            Object.entries(this.currentProfile.fieldMappings).forEach(([column, field]) => {
                if (field && this.headers.includes(column)) {
                    this.fieldMappings[field] = column;
                    const select = container.querySelector(`[data-field="${field}"]`);
                    if (select) {
                        select.value = column;
                    }
                }
            });
        }
    }

    getPreselectedColumn(fieldKey) {
        // Smart matching of field names to column headers
        const fieldMatches = {
            'name': ['name', 'item name', 'product name', 'title'],
            'sku': ['sku', 'code', 'item code', 'product code', 'barcode'],
            'description': ['description', 'desc', 'details', 'notes'],
            'category': ['category', 'type', 'class', 'group'],
            'supplier': ['supplier', 'vendor', 'manufacturer'],
            'quantity': ['quantity', 'qty', 'stock', 'balance', 'amount'],
            'costPrice': ['cost', 'cost price', 'unit cost', 'price'],
            'sellingPrice': ['selling price', 'sale price', 'retail price'],
            'lowStockThreshold': ['threshold', 'min stock', 'minimum'],
            'notes': ['notes', 'comments', 'remarks']
        };

        const possibleMatches = fieldMatches[fieldKey] || [];
        
        for (const match of possibleMatches) {
            const foundHeader = this.headers.find(header => 
                header.toLowerCase().includes(match.toLowerCase()) ||
                match.toLowerCase().includes(header.toLowerCase())
            );
            if (foundHeader) {
                return foundHeader;
            }
        }

        return '';
    }

    validateFieldMappings() {
        // At minimum, we need a name field
        console.log('Validating field mappings...');
        console.log('Current fieldMappings:', this.fieldMappings);
        console.log('Available headers:', this.headers);
        
        const hasNameField = this.fieldMappings.name && this.headers.includes(this.fieldMappings.name);
        console.log('Name field mapped:', this.fieldMappings.name);
        console.log('Name field valid:', hasNameField);
        
        if (!hasNameField) {
            console.warn('Validation failed: Name field is not properly mapped');
            console.warn('Expected: name field mapped to one of:', this.headers);
            console.warn('Actual: name field mapped to:', this.fieldMappings.name);
        }
        
        return hasNameField;
    }
    
    async showDataValidation() {
        console.log('Starting data validation phase...');
        
        // Load existing data from database
        await this.loadExistingData();
        
        // Analyze import data for suppliers and categories
        const conflicts = await this.analyzeDataConflicts();
        
        const container = document.getElementById('dataValidationContainer');
        if (conflicts.length === 0) {
            // No conflicts, show success message
            container.innerHTML = `
                <div class="alert alert-success">
                    <i class="fas fa-check-circle"></i>
                    <strong>Data Validation Complete!</strong>
                    <p class="mb-0 mt-2">All suppliers and categories in your import file match existing data. No conflicts found.</p>
                </div>
            `;
        } else {
            // Show conflicts for resolution
            container.innerHTML = this.renderDataConflicts(conflicts);
        }
    }
    
    async loadExistingData() {
        try {
            this.existingSuppliers = await inventoryDB.getAllSuppliers();
            this.existingCategories = await inventoryDB.getAllCategories();
            console.log(`Loaded ${this.existingSuppliers.length} suppliers and ${this.existingCategories.length} categories`);
        } catch (error) {
            console.error('Error loading existing data:', error);
            this.existingSuppliers = [];
            this.existingCategories = [];
        }
    }
    
    async analyzeDataConflicts() {
        const conflicts = [];
        const uniqueSuppliers = new Set();
        const uniqueCategories = new Set();
        
        // Collect unique values from import data
        this.parsedData.forEach(row => {
            if (this.fieldMappings.supplier && row[this.fieldMappings.supplier]) {
                uniqueSuppliers.add(row[this.fieldMappings.supplier].trim());
            }
            if (this.fieldMappings.category && row[this.fieldMappings.category]) {
                uniqueCategories.add(row[this.fieldMappings.category].trim());
            }
        });
        
        // Check suppliers
        uniqueSuppliers.forEach(supplierName => {
            const exactMatch = this.existingSuppliers.find(s => 
                s.name.toLowerCase() === supplierName.toLowerCase()
            );
            
            if (!exactMatch) {
                const suggestions = this.findSuggestions(supplierName, this.existingSuppliers, 'name');
                conflicts.push({
                    type: 'supplier',
                    importValue: supplierName,
                    suggestions: suggestions.slice(0, 3), // Top 3 suggestions
                    status: 'pending'
                });
            } else {
                // Exact match found - auto-resolve
                this.dataResolutions.suppliers.set(supplierName, exactMatch);
            }
        });
        
        // Check categories
        uniqueCategories.forEach(categoryName => {
            const exactMatch = this.existingCategories.find(c => 
                c.name.toLowerCase() === categoryName.toLowerCase()
            );
            
            if (!exactMatch) {
                const suggestions = this.findSuggestions(categoryName, this.existingCategories, 'name');
                conflicts.push({
                    type: 'category',
                    importValue: categoryName,
                    suggestions: suggestions.slice(0, 3), // Top 3 suggestions
                    status: 'pending'
                });
            } else {
                // Exact match found - auto-resolve
                this.dataResolutions.categories.set(categoryName, exactMatch);
            }
        });
        
        this.pendingResolutions = conflicts;
        console.log(`Found ${conflicts.length} data conflicts to resolve`);
        return conflicts;
    }
    
    findSuggestions(importValue, existingData, field) {
        if (!importValue || !existingData.length) return [];
        
        const suggestions = existingData
            .map(item => ({
                item: item,
                similarity: this.calculateSimilarity(importValue.toLowerCase(), item[field].toLowerCase())
            }))
            .filter(s => s.similarity > 0.3) // Minimum similarity threshold
            .sort((a, b) => b.similarity - a.similarity)
            .map(s => s.item);
            
        return suggestions;
    }
    
    calculateSimilarity(str1, str2) {
        // Simple string similarity using Levenshtein distance
        const maxLength = Math.max(str1.length, str2.length);
        if (maxLength === 0) return 1;
        
        const distance = this.levenshteinDistance(str1, str2);
        return 1 - (distance / maxLength);
    }
    
    levenshteinDistance(str1, str2) {
        const matrix = [];
        
        for (let i = 0; i <= str2.length; i++) {
            matrix[i] = [i];
        }
        
        for (let j = 0; j <= str1.length; j++) {
            matrix[0][j] = j;
        }
        
        for (let i = 1; i <= str2.length; i++) {
            for (let j = 1; j <= str1.length; j++) {
                if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    );
                }
            }
        }
        
        return matrix[str2.length][str1.length];
    }
    
    renderDataConflicts(conflicts) {
        const supplierConflicts = conflicts.filter(c => c.type === 'supplier');
        const categoryConflicts = conflicts.filter(c => c.type === 'category');
        
        let html = `
            <div class="alert alert-warning">
                <i class="fas fa-exclamation-triangle"></i>
                <strong>Data Validation Required</strong>
                <p class="mb-0 mt-2">Found ${conflicts.length} data conflicts that need your attention. Please resolve each one below:</p>
            </div>
        `;
        
        if (supplierConflicts.length > 0) {
            html += `
                <div class="mb-4">
                    <h6><i class="fas fa-truck"></i> Supplier Conflicts (${supplierConflicts.length})</h6>
                    <div class="row">
            `;
            
            supplierConflicts.forEach((conflict, index) => {
                html += this.renderConflictCard(conflict, index);
            });
            
            html += `
                    </div>
                </div>
            `;
        }
        
        if (categoryConflicts.length > 0) {
            html += `
                <div class="mb-4">
                    <h6><i class="fas fa-tags"></i> Category Conflicts (${categoryConflicts.length})</h6>
                    <div class="row">
            `;
            
            categoryConflicts.forEach((conflict, index) => {
                html += this.renderConflictCard(conflict, index + supplierConflicts.length);
            });
            
            html += `
                    </div>
                </div>
            `;
        }
        
        return html;
    }
    
    async resolveConflictByMapping(index, targetName, targetCode) {
        const conflict = this.pendingResolutions[index];
        if (!conflict) return;
        
        // Find the target item
        const targetData = conflict.type === 'supplier' 
            ? this.existingSuppliers.find(s => s.name === targetName)
            : this.existingCategories.find(c => c.name === targetName);
            
        if (!targetData) {
            showToast('Target data not found', 'error');
            return;
        }
        
        // Store the resolution
        if (conflict.type === 'supplier') {
            this.dataResolutions.suppliers.set(conflict.importValue, targetData);
        } else {
            this.dataResolutions.categories.set(conflict.importValue, targetData);
        }
        
        // Mark as resolved and remove from pending
        this.pendingResolutions.splice(index, 1);
        
        // Update UI
        this.markConflictResolved(index, `Mapped to "${targetName}"`);
        
        showToast(`"${conflict.importValue}" mapped to existing ${conflict.type} "${targetName}"`, 'success');
    }
    
    async resolveConflictByCreating(index) {
        const conflict = this.pendingResolutions[index];
        if (!conflict) return;
        
        try {
            let newData;
            
            if (conflict.type === 'supplier') {
                // Create new supplier
                const supplierData = {
                    name: conflict.importValue,
                    code: this.generateSupplierCode(conflict.importValue),
                    color: this.generateRandomColor(),
                    contactEmail: '',
                    contactPhone: '',
                    address: ''
                };
                
                newData = await inventoryDB.addSupplier(supplierData);
                this.existingSuppliers.push(newData);
                this.dataResolutions.suppliers.set(conflict.importValue, newData);
                
            } else {
                // Create new category
                const categoryData = {
                    name: conflict.importValue,
                    code: this.generateCategoryCode(conflict.importValue),
                    description: `Auto-created during bulk import`,
                    isDefault: false
                };
                
                newData = await inventoryDB.addCategory(categoryData);
                this.existingCategories.push(newData);
                this.dataResolutions.categories.set(conflict.importValue, newData);
            }
            
            // Mark as resolved and remove from pending
            this.pendingResolutions.splice(index, 1);
            
            // Update UI
            this.markConflictResolved(index, `Created new ${conflict.type}`);
            
            showToast(`Created new ${conflict.type} "${conflict.importValue}"`, 'success');
            
        } catch (error) {
            console.error('Error creating new data:', error);
            showToast(`Error creating new ${conflict.type}: ${error.message}`, 'error');
        }
    }
    
    markConflictResolved(index, resolution) {
        const conflictCard = document.getElementById(`conflict-${index}`);
        if (conflictCard) {
            conflictCard.innerHTML = `
                <div class="card-body text-center">
                    <div class="text-success mb-2">
                        <i class="fas fa-check-circle fa-2x"></i>
                    </div>
                    <h6 class="card-title text-success">Resolved</h6>
                    <p class="card-text small text-muted">${resolution}</p>
                </div>
            `;
            conflictCard.classList.add('border-success');
        }
    }
    
    generateSupplierCode(name) {
        // Generate a simple code from the supplier name
        const code = name.replace(/[^a-zA-Z0-9]/g, '').substr(0, 8).toUpperCase();
        return code || 'SUP' + Date.now().toString().substr(-5);
    }
    
    generateCategoryCode(name) {
        // Generate a simple code from the category name
        const code = name.replace(/[^a-zA-Z0-9]/g, '').substr(0, 8).toUpperCase();
        return code || 'CAT' + Date.now().toString().substr(-5);
    }
    
    generateRandomColor() {
        const colors = [
            '#007bff', '#28a745', '#17a2b8', '#ffc107', 
            '#dc3545', '#6f42c1', '#e83e8c', '#fd7e14'
        ];
        return colors[Math.floor(Math.random() * colors.length)];
    }
    
    renderConflictCard(conflict, index) {
        const suggestionsHtml = conflict.suggestions.map(suggestion => 
            `<button class="btn btn-sm btn-outline-primary me-1 mb-1 suggestion-btn" 
                     data-index="${index}" 
                     data-action="map" 
                     data-target="${suggestion.name}" 
                     data-target-code="${suggestion.code || suggestion.id}">
                ${suggestion.name}
            </button>`
        ).join('');
        
        return `
            <div class="col-md-6 mb-3">
                <div class="card" id="conflict-${index}">
                    <div class="card-body">
                        <h6 class="card-title text-warning">
                            <i class="fas fa-question-circle"></i> 
                            "${conflict.importValue}"
                        </h6>
                        <p class="card-text small text-muted">
                            This ${conflict.type} doesn't exist in your system. What would you like to do?
                        </p>
                        
                        ${conflict.suggestions.length > 0 ? `
                            <div class="mb-2">
                                <small class="fw-bold">Similar existing ${conflict.type}s:</small><br>
                                ${suggestionsHtml}
                            </div>
                        ` : ''}
                        
                        <div class="d-grid gap-2">
                            <button class="btn btn-success btn-sm" 
                                    data-index="${index}" 
                                    data-action="create">
                                <i class="fas fa-plus"></i> Create New ${conflict.type}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    async showPreview() {
        const container = document.getElementById('previewContainer');
        const defaultItemType = document.getElementById('itemType').value || 'reselling'; // Default to reselling
        
        // Process the data with field mappings and smart type detection
        const previewData = this.parsedData.slice(0, 10).map(row => {
            const mappedRow = {};
            
            Object.entries(this.fieldMappings).forEach(([field, column]) => {
                let value = row[column] || '';
                
                // Process specific field types
                if (field === 'quantity' || field === 'costPrice' || field === 'sellingPrice' || field === 'lowStockThreshold') {
                    value = parseFloat(value) || 0;
                }
                
                mappedRow[field] = value;
            });
            
            // Smart item type detection based on category
            mappedRow.itemType = this.detectItemType(mappedRow.category, defaultItemType);
            
            return mappedRow;
        });

        console.log('Preview data prepared:', previewData);
        
        // Create preview table
        const tableHtml = `
            <table class="table table-striped table-sm">
                <thead class="table-dark">
                    <tr>
                        <th>Name</th>
                        <th>SKU</th>
                        <th>Type</th>
                        <th>Category</th>
                        <th>Supplier</th>
                        <th>Stock</th>
                        <th>Cost Price</th>
                        <th>Description</th>
                    </tr>
                </thead>
                <tbody>
                    ${previewData.map(item => {
                        const name = String(item.name || '').trim() || '<em>No name</em>';
                        const sku = String(item.sku || '').trim();
                        const category = String(item.category || '').trim();
                        const supplier = String(item.supplier || '').trim();
                        const quantity = Number(item.quantity) || 0;
                        const costPrice = Number(item.costPrice) || 0;
                        const description = String(item.description || '').trim();
                        const itemType = String(item.itemType || 'reselling');
                        
                        return `
                            <tr>
                                <td>${name}</td>
                                <td>${sku}</td>
                                <td><span class="badge bg-info">${this.getItemTypeLabel(itemType)}</span></td>
                                <td>${category}</td>
                                <td>${supplier}</td>
                                <td>${quantity}</td>
                                <td>$${costPrice.toFixed(2)}</td>
                                <td>${description.length > 50 ? description.substring(0, 50) + '...' : description}</td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        `;

        container.innerHTML = tableHtml;
        document.getElementById('previewCount').textContent = this.parsedData.length;
        
        // Show detection summary
        const detectedTypes = {};
        previewData.forEach(item => {
            detectedTypes[item.itemType] = (detectedTypes[item.itemType] || 0) + 1;
        });
        
        const typesSummary = Object.entries(detectedTypes)
            .map(([type, count]) => `${count} ${this.getItemTypeLabel(type)}`)
            .join(', ');
        
        console.log('Smart type detection summary (first 10 items):', detectedTypes);
    }

    detectItemType(category, defaultType = 'reselling') {
        if (!category || typeof category !== 'string') {
            return defaultType;
        }
        
        const categoryLower = category.toLowerCase().trim();
        
        // Keywords that indicate consumables
        const consumableKeywords = [
            'consumable', 'consumables', 'supplies', 'office supplies', 'medical supplies',
            'cleaning', 'sanitizer', 'paper', 'ink', 'toner', 'cartridge', 'refill',
            'disposable', 'single use', 'medical', 'health', 'hygiene', 'maintenance',
            'stationery', 'pen', 'pencil', 'marker', 'glue', 'tape', 'staple'
        ];
        
        // Keywords that indicate office equipment  
        const officeEquipmentKeywords = [
            'office equipment', 'equipment', 'furniture', 'desk', 'chair', 'table',
            'computer', 'laptop', 'monitor', 'printer', 'scanner', 'phone', 'telephone',
            'projector', 'whiteboard', 'cabinet', 'shelf', 'filing', 'safe',
            'air conditioner', 'heater', 'fan', 'lamp', 'lighting', 'machine'
        ];
        
        // Check for consumable matches
        for (const keyword of consumableKeywords) {
            if (categoryLower.includes(keyword)) {
                return 'consumable';
            }
        }
        
        // Check for office equipment matches
        for (const keyword of officeEquipmentKeywords) {
            if (categoryLower.includes(keyword)) {
                return 'office_equipment';
            }
        }
        
        // Default to reselling or provided default
        return defaultType;
    }
    
    getItemTypeLabel(itemType) {
        const labels = {
            'reselling': 'Reselling',
            'consumable': 'Consumables', // Fixed: was 'consumables' but should be 'consumable'
            'office_equipment': 'Office Equipment'
        };
        return labels[itemType] || itemType;
    }

    formatCurrency(amount) {
        // Use the global formatCurrency function if available, otherwise provide fallback
        if (typeof window.formatCurrency === 'function') {
            return window.formatCurrency(amount);
        }
        
        const num = Number(amount) || 0;
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(num);
    }

    showLoading(elementId) {
        const element = document.getElementById(elementId);
        if (element) {
            const originalContent = element.innerHTML;
            element.setAttribute('data-original-content', originalContent);
            element.innerHTML = `
                <div class="d-flex justify-content-center align-items-center" style="min-height: 200px;">
                    <div class="text-center">
                        <div class="spinner-border text-primary" role="status">
                            <span class="visually-hidden">Loading...</span>
                        </div>
                        <div class="mt-2">Processing...</div>
                    </div>
                </div>
            `;
        }
    }

    hideLoading(elementId) {
        const element = document.getElementById(elementId);
        if (element && element.hasAttribute('data-original-content')) {
            element.innerHTML = element.getAttribute('data-original-content');
            element.removeAttribute('data-original-content');
        }
    }
    
    showProgressUI(elementId, totalItems) {
        const element = document.getElementById(elementId);
        if (element) {
            const originalContent = element.innerHTML;
            element.setAttribute('data-original-content', originalContent);
            
            element.innerHTML = `
                <div class="d-flex justify-content-center align-items-center" style="min-height: 300px;">
                    <div class="text-center" style="width: 100%; max-width: 500px;">
                        <h5 class="mb-3"><i class="fas fa-upload"></i> Importing Items...</h5>
                        
                        <div class="progress mb-3" style="height: 20px;">
                            <div class="progress-bar progress-bar-striped progress-bar-animated" 
                                 role="progressbar" 
                                 style="width: 0%" 
                                 aria-valuenow="0" 
                                 aria-valuemin="0" 
                                 aria-valuemax="100" id="importProgressBar">
                                0%
                            </div>
                        </div>
                        
                        <div class="row text-center mb-3">
                            <div class="col-3">
                                <div class="card bg-light">
                                    <div class="card-body py-2">
                                        <h6 class="card-title text-success mb-0">Imported</h6>
                                        <span class="h5" id="importedCount">0</span>
                                    </div>
                                </div>
                            </div>
                            <div class="col-3">
                                <div class="card bg-light">
                                    <div class="card-body py-2">
                                        <h6 class="card-title text-info mb-0">Updated</h6>
                                        <span class="h5" id="updatedCount">0</span>
                                    </div>
                                </div>
                            </div>
                            <div class="col-3">
                                <div class="card bg-light">
                                    <div class="card-body py-2">
                                        <h6 class="card-title text-danger mb-0">Errors</h6>
                                        <span class="h5" id="errorCount">0</span>
                                    </div>
                                </div>
                            </div>
                            <div class="col-3">
                                <div class="card bg-light">
                                    <div class="card-body py-2">
                                        <h6 class="card-title text-muted mb-0">Progress</h6>
                                        <span class="h5" id="progressText">0/${totalItems}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="text-muted">
                            <small>Processing items... This may take a moment for large imports.</small>
                        </div>
                    </div>
                </div>
            `;
        }
    }
    
    updateProgress(processed, total, stats) {
        const percentage = Math.round((processed / total) * 100);
        
        // Update progress bar
        const progressBar = document.getElementById('importProgressBar');
        if (progressBar) {
            progressBar.style.width = `${percentage}%`;
            progressBar.setAttribute('aria-valuenow', percentage);
            progressBar.textContent = `${percentage}%`;
        }
        
        // Update counters
        const importedEl = document.getElementById('importedCount');
        const updatedEl = document.getElementById('updatedCount');
        const errorEl = document.getElementById('errorCount');
        const progressEl = document.getElementById('progressText');
        
        if (importedEl) importedEl.textContent = stats.imported;
        if (updatedEl) updatedEl.textContent = stats.updated;
        if (errorEl) errorEl.textContent = stats.errors;
        if (progressEl) progressEl.textContent = `${processed}/${total}`;
    }
    
    validateItemData(itemData) {
        const errors = [];
        
        // Validate name
        if (!itemData.name || typeof itemData.name !== 'string' || itemData.name.trim().length === 0) {
            errors.push('Item name is required');
        } else if (itemData.name.length > 255) {
            errors.push('Item name must be less than 255 characters');
        }
        
        // Validate SKU if provided
        if (itemData.sku && (typeof itemData.sku !== 'string' || itemData.sku.length > 50)) {
            errors.push('SKU must be a string with less than 50 characters');
        }
        
        // Validate numeric fields
        const numericFields = ['quantity', 'costPrice', 'sellingPrice', 'lowStockThreshold'];
        numericFields.forEach(field => {
            if (itemData[field] !== undefined && itemData[field] !== null) {
                const value = Number(itemData[field]);
                if (isNaN(value) || value < 0) {
                    errors.push(`${field} must be a valid positive number`);
                }
            }
        });
        
        // Validate item type
        const validItemTypes = ['reselling', 'consumable', 'office_equipment'];
        if (itemData.itemType && !validItemTypes.includes(itemData.itemType)) {
            errors.push(`Invalid item type. Must be one of: ${validItemTypes.join(', ')}`);
        }
        
        // Validate description length
        if (itemData.description && itemData.description.length > 1000) {
            errors.push('Description must be less than 1000 characters');
        }
        
        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }

    async processImport() {
        try {
            const itemTypeElement = document.getElementById('itemType');
            const updateExistingElement = document.getElementById('updateExisting');
            const profileNameElement = document.getElementById('profileName');
            
            if (!itemTypeElement) {
                throw new Error('Item type selection not found');
            }
            
            const defaultItemType = itemTypeElement.value || 'reselling'; // Default to reselling if none selected
            const updateExisting = updateExistingElement ? updateExistingElement.checked : false;
            const profileName = profileNameElement ? profileNameElement.value.trim() : '';

            // Show progress UI instead of loading
            this.showProgressUI('importStep3', this.parsedData.length);
            
            let imported = 0;
            let updated = 0;
            let errors = 0;
            const errorDetails = [];
            let processed = 0;

            for (let i = 0; i < this.parsedData.length; i++) {
                const row = this.parsedData[i];
                try {
                    const itemData = {};
                    
                    // Map fields
                    Object.entries(this.fieldMappings).forEach(([field, column]) => {
                        let value = row[column] || '';
                        
                        // Process specific field types
                        if (field === 'quantity' || field === 'costPrice' || field === 'sellingPrice' || field === 'lowStockThreshold') {
                            value = parseFloat(value) || 0;
                        }
                        
                        if (value !== '' && value !== 0 && value !== null) {
                            itemData[field] = value;
                        }
                    });
                    
                    // Smart item type detection based on category
                    itemData.itemType = this.detectItemType(itemData.category, defaultItemType);

                    // Skip rows without names
                    if (!itemData.name || itemData.name.trim() === '') {
                        errors++;
                        errorDetails.push({
                            row: i + 1,
                            itemName: 'No name provided',
                            error: 'Item name is required and cannot be empty'
                        });
                        continue;
                    }
                    
                    // Validate data quality
                    const validation = this.validateItemData(itemData);
                    if (!validation.isValid) {
                        errors++;
                        errorDetails.push({
                            row: i + 1,
                            itemName: itemData.name,
                            error: validation.errors.join('; ')
                        });
                        continue;
                    }

                    // Check if item exists (by name or SKU)
                    let existingItem = null;
                    if (updateExisting) {
                        const allItems = await inventoryDB.getAllItems();
                        existingItem = allItems.find(item => 
                            (item.name && item.name.toLowerCase() === itemData.name.toLowerCase()) ||
                            (item.sku && itemData.sku && item.sku.toLowerCase() === itemData.sku.toLowerCase())
                        );
                    }

                    if (existingItem) {
                        // Update existing item
                        await inventoryDB.updateItem(existingItem.id, itemData);
                        updated++;
                    } else {
                        // Create new item
                        await inventoryDB.addItem(itemData);
                        imported++;
                    }

                } catch (itemError) {
                    console.error('Error processing item:', itemError, row);
                    errors++;
                    errorDetails.push({
                        row: i + 1,
                        itemName: itemData.name || 'Unknown',
                        error: itemError.message
                    });
                }
                
                // Update progress
                processed++;
                this.updateProgress(processed, this.parsedData.length, { imported, updated, errors });
                
                // Allow UI to update
                if (processed % 10 === 0) {
                    await new Promise(resolve => setTimeout(resolve, 1));
                }
            }

            // Save profile if requested
            if (profileName) {
                await this.saveImportProfile(profileName, itemType);
            }

            // Show detailed results message
            let message = `Import completed! ${imported} items imported, ${updated} items updated`;
            if (errors > 0) {
                message += `, ${errors} errors`;
                console.log('Import errors:', errorDetails);
                
                // Show detailed error summary
                const errorSummary = errorDetails.slice(0, 5).map(err => 
                    `Row ${err.row} (${err.itemName}): ${err.error}`
                ).join('\n');
                
                if (errorDetails.length > 5) {
                    message += `\n\nFirst 5 errors:\n${errorSummary}\n\n...and ${errorDetails.length - 5} more. Check console for full details.`;
                } else if (errorDetails.length > 0) {
                    message += `\n\nErrors:\n${errorSummary}`;
                }
            }
            
            showToast(message, errors > 0 ? 'warning' : 'success');

            // Close modal and refresh all pages
            this.closeModal();
            await this.refreshAllPages();

        } catch (error) {
            console.error('Import error:', error);
            showToast('Error during import: ' + error.message, 'error');
        } finally {
            this.hideLoading('importStep3');
        }
    }

    async saveImportProfile(name, itemType) {
        const fileTypeRadio = document.querySelector('input[name="fileType"]:checked');
        if (!fileTypeRadio) {
            console.error('No file type selected');
            return;
        }
        
        const profile = {
            name: name,
            fileType: fileTypeRadio.value,
            fieldMappings: { ...this.fieldMappings },
            itemType: itemType,
            description: `Custom import profile created from ${name}`,
            created: new Date().toISOString()
        };

        this.importProfiles[name.toLowerCase().replace(/\s+/g, '_')] = profile;
        await this.saveImportProfiles();
        
        showToast(`Import profile "${name}" saved successfully`, 'success');
    }

    async loadImportProfiles() {
        try {
            const stored = localStorage.getItem('feetonfocus_import_profiles');
            if (stored) {
                this.importProfiles = JSON.parse(stored);
                this.updateProfileDropdown();
            }
        } catch (error) {
            console.error('Error loading import profiles:', error);
        }
    }

    async saveImportProfiles() {
        try {
            localStorage.setItem('feetonfocus_import_profiles', JSON.stringify(this.importProfiles));
            this.updateProfileDropdown();
        } catch (error) {
            console.error('Error saving import profiles:', error);
        }
    }

    updateProfileDropdown() {
        const dropdown = document.getElementById('importProfile');
        const currentValue = dropdown.value;
        
        dropdown.innerHTML = '<option value="">Create New Profile...</option>';
        
        // Add default profiles
        Object.entries(this.defaultProfiles).forEach(([key, profile]) => {
            const option = document.createElement('option');
            option.value = key;
            option.textContent = profile.name;
            dropdown.appendChild(option);
        });
        
        // Add custom profiles
        Object.entries(this.importProfiles).forEach(([key, profile]) => {
            const option = document.createElement('option');
            option.value = key;
            option.textContent = profile.name + ' (Custom)';
            dropdown.appendChild(option);
        });
        
        // Restore selection
        if (currentValue) {
            dropdown.value = currentValue;
        }
    }
    
    downloadImportTemplate(itemType = 'reselling') {
        console.log('Downloading import template for:', itemType);
        
        // Template headers and sample data based on item type
        const templates = {
            reselling: {
                headers: ['Name', 'SKU', 'Description', 'Category', 'Supplier', 'Cost Price', 'Selling Price', 'Quantity', 'Low Stock Threshold'],
                sampleData: [
                    ['Sample Item 1', 'SKU001', 'Description for sample item 1', 'Electronics', 'Supplier A', '10.50', '15.99', '25', '5'],
                    ['Sample Item 2', 'SKU002', 'Description for sample item 2', 'Clothing', 'Supplier B', '8.25', '12.50', '15', '3'],
                    ['Sample Item 3', 'SKU003', 'Description for sample item 3', 'Books', 'Supplier C', '5.00', '9.99', '50', '10']
                ]
            },
            consumables: {
                headers: ['Name', 'SKU', 'Description', 'Category', 'Supplier', 'Cost Price', 'Quantity', 'Low Stock Threshold'],
                sampleData: [
                    ['Office Paper A4', 'PAPER001', '80gsm white office paper', 'Office Supplies', 'Office Depot', '2.50', '100', '20'],
                    ['Printer Ink Cartridge', 'INK001', 'Black ink cartridge HP compatible', 'Printing', 'Ink Supplier', '15.99', '10', '2'],
                    ['Sanitizer Gel', 'SANI001', 'Hand sanitizer gel 500ml', 'Health', 'Medical Supply Co', '3.25', '25', '5']
                ]
            },
            office_equipment: {
                headers: ['Name', 'SKU', 'Description', 'Category', 'Supplier', 'Cost Price', 'Purchase Date'],
                sampleData: [
                    ['Office Desk', 'DESK001', 'Wooden office desk 120x80cm', 'Furniture', 'Office Furniture Ltd', '250.00', '2024-01-15'],
                    ['Laptop Computer', 'LAPTOP001', 'Business laptop 15.6 inch', 'IT Equipment', 'Tech Supplier', '899.99', '2024-02-01'],
                    ['Office Chair', 'CHAIR001', 'Ergonomic office chair with lumbar support', 'Furniture', 'Office Furniture Ltd', '180.50', '2024-01-20']
                ]
            }
        };
        
        const template = templates[itemType] || templates.reselling;
        const csvContent = this.generateCSVContent(template.headers, template.sampleData);
        
        // Download the file
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        
        link.setAttribute('href', url);
        link.setAttribute('download', `feetonfocus-import-template-${itemType}.csv`);
        link.style.visibility = 'hidden';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        URL.revokeObjectURL(url);
        showToast(`Download started: Import template for ${itemType} items`, 'success');
    }
    
    generateCSVContent(headers, sampleData) {
        const csvRows = [];
        
        // Add headers
        csvRows.push(headers.join(','));
        
        // Add sample data
        sampleData.forEach(row => {
            const escapedRow = row.map(cell => {
                // Escape quotes and wrap in quotes if necessary
                if (typeof cell === 'string' && (cell.includes(',') || cell.includes('"') || cell.includes('\n'))) {
                    return `"${cell.replace(/"/g, '""')}"`;
                }
                return cell;
            });
            csvRows.push(escapedRow.join(','));
        });
        
        return csvRows.join('\n');
    }
}

// Create global instance
const bulkImportManager = new BulkImportManager();