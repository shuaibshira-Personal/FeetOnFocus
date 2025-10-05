/**
 * Bulk Import Manager
 * Handles CSV/Excel imports with configurable field mappings and import profiles
 */

class BulkImportManager {
    constructor() {
        this.currentStep = 1;
        this.maxSteps = 3;
        this.fileData = null;
        this.headers = [];
        this.parsedData = [];
        this.fieldMappings = {};
        this.importProfiles = {};
        this.currentProfile = null;
        
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
            this.resetImportWizard();
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
        
        console.log('Bulk import event listeners setup complete');
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
            importStep3: document.getElementById('importStep3')
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
        
        console.log('Import wizard reset complete');
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
        if (!file) return;

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
                console.log('Moving to step 3 - preview');
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
            'location': { label: 'Location', required: false, description: 'Storage location' },
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

        // Add event listeners for mapping changes
        if (container) {
            container.querySelectorAll('.field-mapping').forEach(select => {
                if (select) {
                    select.addEventListener('change', (e) => {
                        const field = e.target.dataset ? e.target.dataset.field : null;
                        const column = e.target.value;
                        
                        if (field && column) {
                            this.fieldMappings[field] = column;
                        } else if (field) {
                            delete this.fieldMappings[field];
                        }
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
            'location': ['location', 'warehouse', 'bin', 'shelf'],
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
        return this.fieldMappings.name && this.headers.includes(this.fieldMappings.name);
    }

    async showPreview() {
        const container = document.getElementById('previewContainer');
        const itemType = document.getElementById('itemType').value;
        
        if (!itemType) {
            showToast('Please select a default item type', 'warning');
            this.currentStep--; // Go back
            this.updateStepDisplay();
            this.showCurrentStep();
            return;
        }

        // Process the data with field mappings
        const previewData = this.parsedData.slice(0, 10).map(row => {
            const mappedRow = { itemType };
            
            Object.entries(this.fieldMappings).forEach(([field, column]) => {
                let value = row[column] || '';
                
                // Process specific field types
                if (field === 'quantity' || field === 'costPrice' || field === 'sellingPrice' || field === 'lowStockThreshold') {
                    value = parseFloat(value) || 0;
                }
                
                mappedRow[field] = value;
            });
            
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
    }

    getItemTypeLabel(itemType) {
        const labels = {
            'reselling': 'Reselling',
            'consumables': 'Consumables',
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

    async processImport() {
        try {
            const itemTypeElement = document.getElementById('itemType');
            const updateExistingElement = document.getElementById('updateExisting');
            const profileNameElement = document.getElementById('profileName');
            
            if (!itemTypeElement) {
                throw new Error('Item type selection not found');
            }
            
            const itemType = itemTypeElement.value;
            const updateExisting = updateExistingElement ? updateExistingElement.checked : false;
            const profileName = profileNameElement ? profileNameElement.value.trim() : '';

            if (!itemType) {
                throw new Error('Please select an item type');
            }

            this.showLoading('importStep3');
            
            let imported = 0;
            let updated = 0;
            let errors = 0;

            for (const row of this.parsedData) {
                try {
                    const itemData = { itemType };
                    
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

                    // Skip rows without names
                    if (!itemData.name || itemData.name.trim() === '') {
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
                }
            }

            // Save profile if requested
            if (profileName) {
                await this.saveImportProfile(profileName, itemType);
            }

            // Close modal
            bootstrap.Modal.getInstance(document.getElementById('bulkImportModal')).hide();

            // Show success message
            showToast(`Import completed! ${imported} items imported, ${updated} items updated${errors > 0 ? `, ${errors} errors` : ''}`, 'success');

            // Refresh the UI
            if (window.dashboard) {
                await dashboard.refreshStats();
            }
            
            if (window.itemsManager) {
                await itemsManager.loadItems();
            }

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
}

// Create global instance
const bulkImportManager = new BulkImportManager();