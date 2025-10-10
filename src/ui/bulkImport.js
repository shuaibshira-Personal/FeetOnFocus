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
        this.modalEventListenersSetup = false; // Flag to prevent duplicate setup
        this.currentFileInput = null; // Reference to current file input element
        this.profileEventListenersSetup = false; // Flag for profile event listeners
        
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
                console.log(`✅ Event listener added: ${elementId} -> ${event}`);
            } else if (required) {
                console.error(`❌ Required element not found: ${elementId}`);
            } else {
                console.warn(`⚠️ Optional element not found: ${elementId}`);
            }
            return element;
        };

        // Modal show event
        safeAddEventListener('bulkImportModal', 'shown.bs.modal', () => {
            console.log('🔥 BULK IMPORT MODAL SHOWN EVENT FIRED 🔥');
            console.log('Bulk import modal shown - resetting wizard');
            // Small delay to ensure DOM is fully ready
            setTimeout(() => {
                console.log('🔥 MODAL SETUP TIMEOUT EXECUTING 🔥');
                this.debugFileInput('before-reset-wizard');
                this.resetImportWizard();
                this.setupModalEventListeners(); // Set up modal-specific events after modal is shown
                this.debugFileInput('after-reset-wizard');
            }, 100);
        });
        
        // Modal hidden event - ensure clean state when modal is closed
        safeAddEventListener('bulkImportModal', 'hidden.bs.modal', () => {
            console.log('Bulk import modal hidden - clearing state');
            this.debugFileInput('before-clear-state');
            this.clearImportState();
            this.modalEventListenersSetup = false; // Reset flag for next modal open
            this.profileEventListenersSetup = false; // Reset profile flag for next modal open
            
            // Clean up DOM observer
            if (this.domObserver) {
                this.domObserver.disconnect();
                this.domObserver = null;
                console.log('🔍 DOM watcher disconnected');
            }
            
            this.debugFileInput('after-clear-state');
        });

        // Note: File input and profile event listeners will be set up when modal is shown
        // to ensure DOM elements are accessible

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
    
    setupModalEventListeners() {
        if (this.modalEventListenersSetup) {
            console.log('Modal event listeners already set up, skipping...');
            return;
        }
        
        console.log('Setting up modal-specific event listeners...');
        
        // Set up file input event listeners
        this.setupFileInputEventListeners();
        
        // Set up profile selection event listener
        this.setupProfileEventListener();
        
        // Set pending file type if there is one
        if (this.pendingFileType) {
            console.log('Setting pending file type:', this.pendingFileType);
            this.setFileType(this.pendingFileType);
            this.pendingFileType = null;
        }
        
        this.modalEventListenersSetup = true;
        console.log('Modal event listeners setup complete');
    }
    
    setupFileInputEventListeners() {
        console.log('Setting up file input event listeners...');
        
        const fileInput = document.getElementById('importFile');
        if (!fileInput) {
            console.error('File input element not found during setup');
            return;
        }
        
        // Don't replace the element - just add event listeners
        // Store reference to the existing file input
        this.currentFileInput = fileInput;
        console.log('Stored reference to existing file input element (no replacement)');
        
        // File input change event
        fileInput.addEventListener('change', (e) => {
            this.handleFileSelection(e);
        });
        
        // File input click event - clear value to allow reselection
        fileInput.addEventListener('click', (e) => {
            console.log('=== FILE INPUT CLICKED ===');
            console.log('Current value before reset:', e.target.value);
            console.log('Input element exists:', !!e.target);
            console.log('Input element type:', e.target.type);
            // Reset the input value before showing dialog to allow same file selection
            e.target.value = '';
            console.log('Value after reset:', e.target.value);
            console.log('File input clicked - value cleared for reselection');
            // Also call our debug function for comprehensive info
            this.debugFileInput('file-input-clicked');
        });
        
        console.log('File input event listeners set up successfully');
    }
    
    setupProfileEventListener() {
        if (this.profileEventListenersSetup) {
            console.log('Profile event listeners already set up, skipping...');
            return;
        }
        
        console.log('Setting up profile selection event listener...');
        
        const profileSelect = document.getElementById('importProfile');
        if (!profileSelect) {
            console.error('Profile select element not found during setup');
            return;
        }
        
        // Set up DOM mutation observer to watch for profile dropdown removal
        this.setupDOMWatcher(profileSelect);
        
        // Don't clone/replace - just add event listener to existing element
        console.log('Adding event listener to existing profile dropdown (preserving any selection)');
        
        // Profile selection change event
        profileSelect.addEventListener('change', (e) => {
            console.log('=== PROFILE CHANGED ===');
            console.log('Selected profile:', e.target.value);
            console.log('Event triggered by:', e.isTrusted ? 'User interaction' : 'Programmatic change');
            console.log('Stack trace:', new Error().stack);
            this.handleProfileChange(e.target.value);
        });
        
        this.profileEventListenersSetup = true;
        console.log('Profile event listener set up successfully');
    }
    
    setupDOMWatcher(profileElement) {
        console.log('🔍 Setting up DOM mutation observer for profile dropdown...');
        
        // Create a MutationObserver to watch for profile dropdown removal
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList') {
                    // Check if any removed nodes contain our profile dropdown
                    mutation.removedNodes.forEach((node) => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            if (node.id === 'importProfile' || node.contains(profileElement)) {
                                console.log('🚨 PROFILE DROPDOWN REMOVED FROM DOM! 🚨');
                                console.log('Removed by mutation:', mutation);
                                console.log('Parent that removed it:', mutation.target);
                                console.log('Stack trace:', new Error().stack);
                            }
                        }
                    });
                }
                
                if (mutation.type === 'attributes' && mutation.target === profileElement) {
                    console.log('🔧 Profile dropdown attributes changed:', mutation.attributeName);
                }
            });
        });
        
        // Start observing the modal body for changes
        const modalBody = document.querySelector('#bulkImportModal .modal-body');
        if (modalBody) {
            observer.observe(modalBody, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeOldValue: true
            });
            console.log('🔍 DOM watcher active - monitoring modal body for changes');
        }
        
        // Store observer reference for cleanup
        this.domObserver = observer;
    }
    
    setupConflictResolutionListeners() {
        console.log('Setting up conflict resolution listeners...');
        // Add event delegation for dynamically created conflict resolution buttons
        document.addEventListener('click', (e) => {
            // Check if the conflict is already resolved
            const conflictCard = e.target.closest('.conflict-resolution-card');
            if (conflictCard && conflictCard.dataset.resolved === 'true') {
                console.log('Conflict already resolved, ignoring interaction');
                e.preventDefault();
                e.stopPropagation();
                return;
            }
            
            if (e.target.matches('[data-action="map"]') || e.target.closest('[data-action="map"]')) {
                const button = e.target.matches('[data-action="map"]') ? e.target : e.target.closest('[data-action="map"]');
                const index = parseInt(button.dataset.index);
                const targetName = button.dataset.target;
                const targetCode = button.dataset.targetCode;
                
                // Double-check the conflict hasn't been resolved already
                if (this.pendingResolutions[index]) {
                    this.resolveConflictByMapping(index, targetName, targetCode);
                } else {
                    console.warn(`Conflict at index ${index} no longer exists`);
                }
            } else if (e.target.matches('[data-action="create"]') || e.target.closest('[data-action="create"]')) {
                const button = e.target.matches('[data-action="create"]') ? e.target : e.target.closest('[data-action="create"]');
                const index = parseInt(button.dataset.index);
                if (this.pendingResolutions[index]) {
                    this.resolveConflictByCreating(index);
                } else {
                    console.warn(`Conflict at index ${index} no longer exists`);
                }
            } else if (e.target.matches('[data-action="map-selected"]') || e.target.closest('[data-action="map-selected"]')) {
                const button = e.target.matches('[data-action="map-selected"]') ? e.target : e.target.closest('[data-action="map-selected"]');
                const index = parseInt(button.dataset.index);
                if (this.pendingResolutions[index]) {
                    this.resolveConflictByMappingFromInput(index);
                } else {
                    console.warn(`Conflict at index ${index} no longer exists`);
                }
            } else if (e.target.matches('[data-action="create-from-input"]') || e.target.closest('[data-action="create-from-input"]')) {
                const button = e.target.matches('[data-action="create-from-input"]') ? e.target : e.target.closest('[data-action="create-from-input"]');
                const index = parseInt(button.dataset.index);
                if (this.pendingResolutions[index]) {
                    this.resolveConflictByCreatingFromInput(index);
                } else {
                    console.warn(`Conflict at index ${index} no longer exists`);
                }
            } else if (e.target.matches('[data-action="edit-create"]') || e.target.closest('[data-action="edit-create"]')) {
                const button = e.target.matches('[data-action="edit-create"]') ? e.target : e.target.closest('[data-action="edit-create"]');
                const index = parseInt(button.dataset.index);
                if (this.pendingResolutions[index]) {
                    this.showEditCreateModal(index);
                } else {
                    console.warn(`Conflict at index ${index} no longer exists`);
                }
            }
            // Handle split group action
            else if (e.target.matches('[data-action="split-group"]') || e.target.closest('[data-action="split-group"]')) {
                const button = e.target.matches('[data-action="split-group"]') ? e.target : e.target.closest('[data-action="split-group"]');
                const index = parseInt(button.dataset.index);
                this.splitConflictGroup(index);
            }
            // Handle autocomplete suggestion clicks
            else if (e.target.matches('.autocomplete-suggestion-item')) {
                e.preventDefault();
                e.stopPropagation();
                console.log('Autocomplete suggestion item clicked');
                this.handleAutocompleteSuggestionClick(e.target);
            } else if (e.target.closest('.autocomplete-suggestion-item')) {
                e.preventDefault();
                e.stopPropagation();
                console.log('Click inside autocomplete suggestion item (using closest)');
                this.handleAutocompleteSuggestionClick(e.target.closest('.autocomplete-suggestion-item'));
            }
        });
        
        // Add event delegation for autocomplete inputs
        document.addEventListener('input', (e) => {
            if (e.target.matches('.autocomplete-input')) {
                this.handleAutocompleteInput(e.target);
            }
        });
        
        // Hide autocomplete on focus out
        document.addEventListener('focusout', (e) => {
            if (e.target.matches('.autocomplete-input')) {
                setTimeout(() => {
                    const suggestionsContainer = e.target.parentElement.querySelector('.autocomplete-suggestions');
                    if (suggestionsContainer) {
                        suggestionsContainer.style.display = 'none';
                    }
                }, 300); // Longer delay to allow clicking on suggestions
            }
        });
    }
    
    handleAutocompleteInput(input) {
        const query = input.value.trim();
        const type = input.dataset.type;
        const index = parseInt(input.dataset.index);
        const suggestionsContainer = input.parentElement.querySelector('.autocomplete-suggestions');
        
        console.log('Autocomplete triggered:', { query, type, dataLoaded: this.existingSuppliers.length, categories: this.existingCategories.length });
        
        if (!query || query.length < 1) { // Allow single character search
            suggestionsContainer.style.display = 'none';
            return;
        }
        
        // Get the appropriate data source
        const dataSource = type === 'supplier' ? this.existingSuppliers : this.existingCategories;
        
        console.log('Data source:', dataSource.length, 'items');
        
        if (!dataSource || dataSource.length === 0) {
            console.warn('No data source available for autocomplete');
            suggestionsContainer.style.display = 'none';
            return;
        }
        
        // Find matching items with improved search
        const queryLower = query.toLowerCase();
        const matches = dataSource
            .filter(item => {
                const name = item.name.toLowerCase();
                const code = (item.code || '').toLowerCase();
                return name.includes(queryLower) || 
                       name.startsWith(queryLower) || 
                       code.includes(queryLower) ||
                       code.startsWith(queryLower);
            })
            .sort((a, b) => {
                // Prioritize exact matches and starts-with matches
                const aName = a.name.toLowerCase();
                const bName = b.name.toLowerCase();
                
                if (aName.startsWith(queryLower) && !bName.startsWith(queryLower)) return -1;
                if (!aName.startsWith(queryLower) && bName.startsWith(queryLower)) return 1;
                if (aName.includes(queryLower) && !bName.includes(queryLower)) return -1;
                if (!aName.includes(queryLower) && bName.includes(queryLower)) return 1;
                
                return a.name.localeCompare(b.name);
            })
            .slice(0, 10); // Limit to 10 suggestions
        
        console.log('Found matches:', matches.length);
        
        if (matches.length === 0) {
            suggestionsContainer.innerHTML = '<div class="p-2 text-muted">No matches found</div>';
            suggestionsContainer.style.display = 'block';
            return;
        }
        
        // Render suggestions
        const suggestionsHtml = matches
            .map(item => `
                <div class="autocomplete-suggestion-item p-2 border-bottom" 
                     data-index="${index}" 
                     data-name="${item.name}" 
                     data-code="${item.code || item.id}" 
                     data-type="${type}">
                    <strong>${this.highlightMatch(item.name, query)}</strong>
                    ${item.code ? `<span class="text-muted ms-2">(${item.code})</span>` : ''}
                </div>
            `)
            .join('');
        
        suggestionsContainer.innerHTML = suggestionsHtml;
        suggestionsContainer.style.display = 'block';
        
        // Enable create button with current input value
        const createButton = input.closest('.conflict-resolution-card').querySelector('[data-action="create-from-input"]');
        if (createButton && query.length >= 2) {
            createButton.disabled = false;
            createButton.classList.remove('btn-outline-secondary');
            createButton.classList.add('btn-primary');
            createButton.innerHTML = `<i class="fas fa-plus"></i> Create "${query}"`;
        }
        
        // Check if input matches an existing item exactly to enable map button
        const exactMatch = matches.find(item => item.name.toLowerCase() === query.toLowerCase());
        const mapButton = input.closest('.conflict-resolution-card').querySelector('[data-action="map-selected"]');
        if (mapButton) {
            if (exactMatch) {
                input.dataset.selectedName = exactMatch.name;
                input.dataset.selectedCode = exactMatch.code || exactMatch.id;
                mapButton.disabled = false;
                mapButton.classList.remove('btn-outline-secondary');
                mapButton.classList.add('btn-success');
                mapButton.innerHTML = `<i class="fas fa-link"></i> Map to "${exactMatch.name}"`;
            } else {
                mapButton.disabled = true;
                mapButton.classList.remove('btn-success');
                mapButton.classList.add('btn-outline-secondary');
                mapButton.innerHTML = `<i class="fas fa-link"></i> Map to Selected`;
            }
        }
    }
    
    highlightMatch(text, query) {
        const regex = new RegExp(`(${query})`, 'gi');
        return text.replace(regex, '<mark>$1</mark>');
    }
    
    handleAutocompleteSuggestionClick(suggestionElement) {
        console.log('Autocomplete suggestion clicked:', suggestionElement);
        
        const index = parseInt(suggestionElement.dataset.index);
        const name = suggestionElement.dataset.name;
        const code = suggestionElement.dataset.code;
        
        console.log('Suggestion data:', { index, name, code });
        
        // Hide suggestions
        const suggestionsContainer = suggestionElement.parentElement;
        suggestionsContainer.style.display = 'none';
        
        // Fill the input with the selected value
        const input = suggestionsContainer.parentElement.querySelector('.autocomplete-input');
        console.log('Found input element:', input);
        if (input) {
            console.log('Setting input value to:', name);
            input.value = name;
            
            // Store the selected item data for potential mapping
            input.dataset.selectedName = name;
            input.dataset.selectedCode = code;
            
            console.log('Looking for buttons in conflict card...');
            const conflictCard = input.closest('.conflict-resolution-card');
            console.log('Conflict card found:', conflictCard);
            
            // Enable any "Map to Selected" button for this conflict
            const mapButton = conflictCard?.querySelector('[data-action="map-selected"]');
            console.log('Map button found:', mapButton);
            if (mapButton) {
                mapButton.disabled = false;
                mapButton.classList.remove('btn-outline-secondary');
                mapButton.classList.add('btn-success');
                mapButton.innerHTML = `<i class="fas fa-link"></i> Map to "${name}"`;
                console.log('Map button updated');
            }
            
            // Enable any "Create New" button to use this value
            const createButton = conflictCard?.querySelector('[data-action="create-from-input"]');
            console.log('Create button found:', createButton);
            if (createButton) {
                createButton.disabled = false;
                createButton.classList.remove('btn-outline-secondary');
                createButton.classList.add('btn-primary');
                createButton.innerHTML = `<i class="fas fa-plus"></i> Create "${name}"`;
                console.log('Create button updated');
            }
        } else {
            console.error('Input element not found!');
        }
    }
    
    async resolveConflictByMappingFromInput(index) {
        const conflict = this.pendingResolutions[index];
        if (!conflict) return;
        
        // Get the autocomplete input for this conflict
        const conflictCard = document.getElementById(`conflict-${index}`);
        const input = conflictCard?.querySelector('.autocomplete-input');
        
        if (!input || !input.dataset.selectedName) {
            showToast('Please select a valid item from the suggestions first', 'warning');
            return;
        }
        
        const targetName = input.dataset.selectedName;
        const targetCode = input.dataset.selectedCode;
        
        this.resolveConflictByMapping(index, targetName, targetCode);
    }
    
    async resolveConflictByCreatingFromInput(index) {
        const conflict = this.pendingResolutions[index];
        if (!conflict) return;
        
        // Get the autocomplete input for this conflict
        const conflictCard = document.getElementById(`conflict-${index}`);
        const input = conflictCard?.querySelector('.autocomplete-input');
        
        if (!input || !input.value.trim()) {
            showToast('Please enter a name for the new item', 'warning');
            return;
        }
        
        const nameToCreate = input.value.trim();
        
        // Check if this name already exists
        const existingItems = conflict.type === 'supplier' ? this.existingSuppliers : this.existingCategories;
        const exactMatch = existingItems.find(item => 
            item.name.toLowerCase() === nameToCreate.toLowerCase()
        );
        
        if (exactMatch) {
            // If it already exists, just map to it instead
            this.resolveConflictByMapping(index, exactMatch.name, exactMatch.code || exactMatch.id);
            return;
        }
        
        // Create the new item using the input value
        try {
            let newData;
            
            if (conflict.type === 'supplier') {
                const supplierCode = await this.generateUniqueSupplierCode(nameToCreate);
                const supplierData = {
                    name: nameToCreate,
                    code: supplierCode,
                    color: this.generateRandomColor(),
                    contactEmail: '',
                    contactPhone: '',
                    address: ''
                };
                
                newData = await inventoryDB.addSupplier(supplierData);
                this.existingSuppliers.push(newData);
                
                // Map all variants to the new supplier if grouped
                if (conflict.isGroup && conflict.variants) {
                    conflict.variants.forEach(variant => {
                        this.dataResolutions.suppliers.set(variant.value, newData);
                    });
                } else {
                    this.dataResolutions.suppliers.set(conflict.importValue, newData);
                }
                
            } else {
                const categoryCode = await this.generateUniqueCategoryCode(nameToCreate);
                const categoryData = {
                    name: nameToCreate,
                    code: categoryCode,
                    description: `Created during bulk import`,
                    isDefault: false
                };
                
                newData = await inventoryDB.addCategory(categoryData);
                this.existingCategories.push(newData);
                
                // Map all variants to the new category if grouped
                if (conflict.isGroup && conflict.variants) {
                    conflict.variants.forEach(variant => {
                        this.dataResolutions.categories.set(variant.value, newData);
                    });
                } else {
                    this.dataResolutions.categories.set(conflict.importValue, newData);
                }
            }
            
            // Mark as resolved and remove from pending
            this.pendingResolutions.splice(index, 1);
            
            // Update UI
            this.markConflictResolved(index, `Created new ${conflict.type}`, conflict.itemCount);
            
            const itemCountText = conflict.itemCount ? ` (${conflict.itemCount} items affected)` : '';
            showToast(`Created new ${conflict.type} "${nameToCreate}"${itemCountText}`, 'success');
            
            // Check if all conflicts are resolved
            this.checkIfAllConflictsResolved();
            
        } catch (error) {
            console.error('Error creating new data from input:', error);
            
            let errorMessage = error.message;
            if (error.message.includes('already exist')) {
                errorMessage = `A ${conflict.type} with this name or code already exists.`;
            }
            
            showToast(`Error creating new ${conflict.type}: ${errorMessage}`, 'error');
        }
    }
    
    async showEditCreateModal(index) {
        const conflict = this.pendingResolutions[index];
        if (!conflict) return;
        
        const isSupplier = conflict.type === 'supplier';
        const nameToCreate = conflict.importValue;
        
        // Generate default values
        const defaultCode = isSupplier ? 
            await this.generateUniqueSupplierCode(nameToCreate) :
            await this.generateUniqueCategoryCode(nameToCreate);
        const defaultColor = this.generateRandomColor();
        
        // Create and show the edit modal
        const modalId = `editCreate${conflict.type}Modal${index}`;
        const modalHtml = `
            <div class="modal fade" id="${modalId}" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">
                                <i class="fas fa-${isSupplier ? 'building' : 'tags'}"></i>
                                Create New ${isSupplier ? 'Supplier' : 'Category'}
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <form id="editCreate${conflict.type}Form${index}">
                                <div class="mb-3">
                                    <label class="form-label">Name <span class="text-danger">*</span></label>
                                    <input type="text" class="form-control" id="editCreateName${index}" value="${nameToCreate}" required>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">Code <span class="text-danger">*</span></label>
                                    <input type="text" class="form-control" id="editCreateCode${index}" value="${defaultCode}" required>
                                    <div class="form-text">Must be unique</div>
                                </div>
                                ${isSupplier ? `
                                    <div class="mb-3">
                                        <label class="form-label">Badge Color</label>
                                        <div class="d-flex align-items-center">
                                            <input type="color" class="form-control form-control-color" id="editCreateColor${index}" value="${defaultColor}" style="width: 60px; height: 38px;">
                                            <div class="ms-3">
                                                <span class="badge" id="colorPreview${index}" style="background-color: ${defaultColor}; color: white;">${nameToCreate}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div class="mb-3">
                                        <label class="form-label">Contact Email</label>
                                        <input type="email" class="form-control" id="editCreateEmail${index}" placeholder="contact@supplier.com">
                                    </div>
                                    <div class="mb-3">
                                        <label class="form-label">Contact Phone</label>
                                        <input type="tel" class="form-control" id="editCreatePhone${index}" placeholder="+1 234 567 8900">
                                    </div>
                                    <div class="mb-3">
                                        <label class="form-label">Website</label>
                                        <input type="url" class="form-control" id="editCreateWebsite${index}" placeholder="https://supplier.com">
                                    </div>
                                    <div class="mb-3">
                                        <label class="form-label">Address</label>
                                        <textarea class="form-control" id="editCreateAddress${index}" rows="2" placeholder="Street address, City, State, ZIP"></textarea>
                                    </div>
                                ` : `
                                    <div class="mb-3">
                                        <label class="form-label">Description</label>
                                        <textarea class="form-control" id="editCreateDescription${index}" rows="2" placeholder="Category description">Created during bulk import</textarea>
                                    </div>
                                    <div class="mb-3">
                                        <label class="form-label">Color</label>
                                        <div class="d-flex align-items-center">
                                            <input type="color" class="form-control form-control-color" id="editCreateColor${index}" value="${defaultColor}" style="width: 60px; height: 38px;">
                                            <div class="ms-3">
                                                <span class="badge" id="colorPreview${index}" style="background-color: ${defaultColor}; color: white;">${nameToCreate}</span>
                                            </div>
                                        </div>
                                    </div>
                                `}
                            </form>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                            <button type="button" class="btn btn-success" id="confirmCreateBtn${index}">
                                <i class="fas fa-plus me-2"></i>Create ${isSupplier ? 'Supplier' : 'Category'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Remove any existing modal
        const existingModal = document.getElementById(modalId);
        if (existingModal) {
            existingModal.remove();
        }
        
        // Add modal to body
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        // Set up event listeners
        const modal = new bootstrap.Modal(document.getElementById(modalId));
        const colorInput = document.getElementById(`editCreateColor${index}`);
        const colorPreview = document.getElementById(`colorPreview${index}`);
        const nameInput = document.getElementById(`editCreateName${index}`);
        const confirmBtn = document.getElementById(`confirmCreateBtn${index}`);
        
        // Color preview updates
        colorInput.addEventListener('input', () => {
            const color = colorInput.value;
            colorPreview.style.backgroundColor = color;
            // Calculate if we need light or dark text
            const rgb = this.hexToRgb(color);
            const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
            colorPreview.style.color = brightness > 155 ? 'black' : 'white';
        });
        
        // Name updates preview
        nameInput.addEventListener('input', () => {
            colorPreview.textContent = nameInput.value || 'Preview';
        });
        
        // Confirm button
        confirmBtn.addEventListener('click', async () => {
            const name = document.getElementById(`editCreateName${index}`).value.trim();
            const code = document.getElementById(`editCreateCode${index}`).value.trim();
            const color = document.getElementById(`editCreateColor${index}`).value;
            
            if (!name || !code) {
                showToast('Name and code are required', 'error');
                return;
            }
            
            // Check for existing items with same name or code
            const existingItems = isSupplier ? this.existingSuppliers : this.existingCategories;
            const nameExists = existingItems.find(item => item.name.toLowerCase() === name.toLowerCase());
            const codeExists = existingItems.find(item => item.code.toLowerCase() === code.toLowerCase());
            
            if (nameExists) {
                showToast(`A ${conflict.type} with the name "${name}" already exists`, 'error');
                return;
            }
            
            if (codeExists) {
                showToast(`A ${conflict.type} with the code "${code}" already exists`, 'error');
                return;
            }
            
            try {
                let newData;
                
                if (isSupplier) {
                    const supplierData = {
                        name: name,
                        code: code,
                        color: color,
                        contactEmail: document.getElementById(`editCreateEmail${index}`).value.trim(),
                        contactPhone: document.getElementById(`editCreatePhone${index}`).value.trim(),
                        website: document.getElementById(`editCreateWebsite${index}`).value.trim(),
                        address: document.getElementById(`editCreateAddress${index}`).value.trim()
                    };
                    
                    newData = await inventoryDB.addSupplier(supplierData);
                    this.existingSuppliers.push(newData);
                    
                    // Map all variants to the new supplier if grouped
                    if (conflict.isGroup && conflict.variants) {
                        conflict.variants.forEach(variant => {
                            this.dataResolutions.suppliers.set(variant.value, newData);
                        });
                    } else {
                        this.dataResolutions.suppliers.set(conflict.importValue, newData);
                    }
                    
                } else {
                    const categoryData = {
                        name: name,
                        code: code,
                        color: color,
                        description: document.getElementById(`editCreateDescription${index}`).value.trim(),
                        isDefault: false
                    };
                    
                    newData = await inventoryDB.addCategory(categoryData);
                    this.existingCategories.push(newData);
                    
                    // Map all variants to the new category if grouped
                    if (conflict.isGroup && conflict.variants) {
                        conflict.variants.forEach(variant => {
                            this.dataResolutions.categories.set(variant.value, newData);
                        });
                    } else {
                        this.dataResolutions.categories.set(conflict.importValue, newData);
                    }
                }
                
                // Mark as resolved and remove from pending
                this.pendingResolutions.splice(index, 1);
                
                // Update UI
                this.markConflictResolved(index, `Created new ${conflict.type}`, conflict.itemCount);
                
                modal.hide();
                
                const itemCountText = conflict.itemCount ? ` (${conflict.itemCount} items affected)` : '';
                showToast(`Created new ${conflict.type} "${name}"${itemCountText}`, 'success');
                
                // Check if all conflicts are resolved
                this.checkIfAllConflictsResolved();
                
            } catch (error) {
                console.error('Error creating new data from edit modal:', error);
                showToast(`Error creating ${conflict.type}: ${error.message}`, 'error');
            }
        });
        
        // Clean up modal when hidden
        document.getElementById(modalId).addEventListener('hidden.bs.modal', () => {
            document.getElementById(modalId).remove();
        });
        
        // Show the modal
        modal.show();
    }
    
    // Method to refresh conflict display if UI gets out of sync
    refreshConflictDisplay() {
        try {
            console.log('Refreshing conflict display...');
            const container = document.getElementById('dataValidationContainer');
            if (container && this.pendingResolutions.length > 0) {
                container.innerHTML = this.renderDataConflicts(this.pendingResolutions);
                console.log(`Refreshed ${this.pendingResolutions.length} conflicts`);
            } else if (container && this.pendingResolutions.length === 0) {
                // All conflicts resolved
                container.innerHTML = `
                    <div class="alert alert-success">
                        <i class="fas fa-check-circle"></i>
                        <strong>All Conflicts Resolved!</strong>
                        <p class="mb-0 mt-2">Great! All data conflicts have been resolved. You can now proceed to import your items.</p>
                    </div>
                `;
            }
        } catch (error) {
            console.error('Error refreshing conflict display:', error);
        }
    }
    
    // Test method for debugging autocomplete functionality
    testAutocomplete() {
        console.log('Testing autocomplete functionality...');
        
        // Check if conflict resolution cards exist
        const conflictCards = document.querySelectorAll('.conflict-resolution-card');
        console.log('Found conflict cards:', conflictCards.length);
        
        // Check for autocomplete inputs
        const autocompleteInputs = document.querySelectorAll('.autocomplete-input');
        console.log('Found autocomplete inputs:', autocompleteInputs.length);
        
        // Check for action buttons
        const mapButtons = document.querySelectorAll('[data-action="map-selected"]');
        const createButtons = document.querySelectorAll('[data-action="create-from-input"]');
        console.log('Found map-selected buttons:', mapButtons.length);
        console.log('Found create-from-input buttons:', createButtons.length);
        
        // Test clicking on first autocomplete input if it exists
        if (autocompleteInputs.length > 0) {
            const input = autocompleteInputs[0];
            console.log('Testing first autocomplete input:', input);
            
            // Simulate typing
            input.value = 'test';
            input.dispatchEvent(new Event('input', { bubbles: true }));
            
            setTimeout(() => {
                const suggestions = input.parentElement.querySelector('.autocomplete-suggestions');
                console.log('Suggestions container:', suggestions);
                if (suggestions) {
                    console.log('Suggestions HTML:', suggestions.innerHTML);
                }
            }, 100);
        }
        
        return {
            conflictCards: conflictCards.length,
            inputs: autocompleteInputs.length,
            mapButtons: mapButtons.length,
            createButtons: createButtons.length
        };
    }
    
    // Comprehensive debugging method for troubleshooting stuck UI
    debugBulkImportState() {
        console.log('=== BULK IMPORT DEBUG STATE ===');
        console.log('Pending resolutions:', this.pendingResolutions.length);
        console.log('Resolved suppliers:', this.dataResolutions.suppliers.size);
        console.log('Resolved categories:', this.dataResolutions.categories.size);
        
        // Check for conflicts marked as resolved but still in pending list
        const stuckConflicts = this.pendingResolutions.filter(c => c.status === 'resolved');
        console.log('Stuck resolved conflicts:', stuckConflicts.length);
        
        // Check conflict card states
        const conflictCards = document.querySelectorAll('.conflict-resolution-card');
        const resolvedCards = document.querySelectorAll('.conflict-resolution-card[data-resolved="true"]');
        console.log('Total conflict cards:', conflictCards.length);
        console.log('Resolved cards:', resolvedCards.length);
        
        // Check button states
        const allButtons = document.querySelectorAll('[data-action]');
        const disabledButtons = document.querySelectorAll('[data-action]:disabled');
        console.log('Total action buttons:', allButtons.length);
        console.log('Disabled buttons:', disabledButtons.length);
        
        // List pending conflict details
        this.pendingResolutions.forEach((conflict, index) => {
            console.log(`Conflict ${index}: ${conflict.type} "${conflict.importValue}" - Status: ${conflict.status || 'pending'}`);
        });
        
        return {
            pendingCount: this.pendingResolutions.length,
            resolvedSuppliers: this.dataResolutions.suppliers.size,
            resolvedCategories: this.dataResolutions.categories.size,
            stuckCount: stuckConflicts.length,
            totalCards: conflictCards.length,
            resolvedCards: resolvedCards.length,
            actionButtons: allButtons.length,
            disabledButtons: disabledButtons.length
        };
    }
    
    // Method to fix stuck state
    fixStuckState() {
        console.log('Attempting to fix stuck state...');
        
        // Remove resolved conflicts from pending list
        const originalLength = this.pendingResolutions.length;
        this.pendingResolutions = this.pendingResolutions.filter(c => c.status !== 'resolved');
        const removedCount = originalLength - this.pendingResolutions.length;
        
        console.log(`Removed ${removedCount} resolved conflicts from pending list`);
        
        // Refresh the display
        this.refreshConflictDisplay();
        
        // Check if all are now resolved
        this.checkIfAllConflictsResolved();
        
        return {
            removedConflicts: removedCount,
            remainingConflicts: this.pendingResolutions.length
        };
    }
    
    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : { r: 0, g: 0, b: 0 };
    }
    
    splitConflictGroup(index) {
        const groupedConflict = this.pendingResolutions[index];
        if (!groupedConflict || !groupedConflict.isGroup) {
            console.error('Cannot split non-grouped conflict');
            return;
        }
        
        // Convert variants back to individual conflicts
        const individualConflicts = groupedConflict.variants.map(variant => ({
            type: groupedConflict.type,
            importValue: variant.value,
            itemCount: variant.itemCount,
            affectedRows: variant.affectedRows,
            sampleItems: variant.sampleItems,
            suggestions: groupedConflict.suggestions, // Share suggestions
            status: 'pending',
            isGroup: false
        }));
        
        // Replace the grouped conflict with individual conflicts
        this.pendingResolutions.splice(index, 1, ...individualConflicts);
        
        // Re-render the conflicts UI
        const container = document.getElementById('dataValidationContainer');
        if (container) {
            container.innerHTML = this.renderDataConflicts(this.pendingResolutions);
        }
        
        showToast(`Split into ${individualConflicts.length} separate conflicts for individual resolution`, 'info');
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
        // Note: Don't clear currentProfile - user might want to reuse the same profile
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
        
        if (elements.importFile) {
            console.log('=== RESETTING FILE INPUT IN WIZARD ===');
            console.log('File input current value before reset:', elements.importFile.value);
            console.log('File input current type before reset:', elements.importFile.type);
            elements.importFile.value = '';
            elements.importFile.type = 'text';
            elements.importFile.type = 'file';
            console.log('File input value after reset:', elements.importFile.value);
            console.log('File input type after reset:', elements.importFile.type);
            console.log('File input cleared in resetImportWizard');
            this.updateFileDisplay('No file selected');
        } else {
            console.warn('File input element not found during resetImportWizard');
        }
        // Note: Don't clear importProfile value - preserve user's profile selection
        if (elements.profileName) elements.profileName.value = '';
        // Note: Don't clear itemType - will be set by profile selection
        
        // Show step 1, hide others
        if (elements.importStep1) elements.importStep1.classList.remove('d-none');
        if (elements.importStep2) elements.importStep2.classList.add('d-none');
        if (elements.importStep3) elements.importStep3.classList.add('d-none');
        if (elements.importStep4) elements.importStep4.classList.add('d-none');
        
        console.log('Import wizard reset complete');
    }
    
    debugFileInput(context = 'unknown') {
        const fileInput = document.getElementById('importFile');
        console.log(`=== FILE INPUT DEBUG [${context}] ===`);
        if (fileInput) {
            console.log('File input exists:', true);
            console.log('File input value:', fileInput.value);
            console.log('File input type:', fileInput.type);
            console.log('Files length:', fileInput.files.length);
            console.log('Element id:', fileInput.id);
            console.log('Element disabled:', fileInput.disabled);
            console.log('Element readonly:', fileInput.readOnly);
        } else {
            console.log('File input exists:', false);
        }
        console.log('=== END FILE INPUT DEBUG ===');
    }
    
    debugProfileDropdown(context = 'unknown') {
        const profileDropdown = document.getElementById('importProfile');
        console.log(`=== PROFILE DROPDOWN DEBUG [${context}] ===`);
        if (profileDropdown) {
            console.log('Profile dropdown exists:', true);
            console.log('Profile dropdown value:', profileDropdown.value);
            console.log('Profile dropdown selectedIndex:', profileDropdown.selectedIndex);
            console.log('Profile dropdown options length:', profileDropdown.options.length);
            console.log('Profile dropdown innerHTML:', profileDropdown.innerHTML);
        } else {
            console.log('Profile dropdown exists:', false);
        }
        console.log('=== END PROFILE DROPDOWN DEBUG ===');
    }
    
    clearImportState() {
        // Clear all data when modal is closed
        this.fileData = null;
        this.headers = [];
        this.parsedData = [];
        this.fieldMappings = {};
        // Note: Don't clear currentProfile - preserve for next import session
        this.dataResolutions = {
            suppliers: new Map(),
            categories: new Map()
        };
        this.pendingResolutions = [];
        this.existingSuppliers = [];
        this.existingCategories = [];
        
        // Clear file input completely
        const fileInput = document.getElementById('importFile');
        if (fileInput) {
            console.log('=== CLEARING FILE INPUT STATE ===');
            console.log('File input current value before reset:', fileInput.value);
            console.log('File input current type before reset:', fileInput.type);
            fileInput.value = '';
            fileInput.type = 'text';
            fileInput.type = 'file';
            console.log('File input value after reset:', fileInput.value);
            console.log('File input type after reset:', fileInput.type);
            console.log('File input reset completely');
            this.updateFileDisplay('No file selected');
        } else {
            console.warn('File input element not found during clearImportState');
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
        console.log(`🔄 UPDATE STEP DISPLAY - Step ${this.currentStep} of ${this.maxSteps}`);
        document.getElementById('currentStep').textContent = `Step ${this.currentStep} of ${this.maxSteps}`;
        
        // Update button visibility
        document.getElementById('prevStepBtn').style.display = this.currentStep > 1 ? 'inline-block' : 'none';
        document.getElementById('nextStepBtn').style.display = this.currentStep < this.maxSteps ? 'inline-block' : 'none';
        document.getElementById('importBtn').style.display = this.currentStep === this.maxSteps ? 'inline-block' : 'none';
    }

    async handleFileSelection(event) {
        const file = event.target.files[0];
        console.log('=== FILE SELECTION EVENT ===');
        console.log('File:', file ? file.name : 'No file selected');
        console.log('File size:', file ? file.size : 'N/A');
        console.log('File type:', file ? file.type : 'N/A');
        console.log('Input element:', event.target);
        console.log('Files length:', event.target.files.length);
        
        // Debug profile state before file processing
        this.debugProfileDropdown('before-file-processing');
        
        if (!file) {
            // File was cleared - reset headers and data
            this.headers = [];
            this.parsedData = [];
            this.updateFileDisplay('No file selected');
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
            
            this.updateFileDisplay(`${file.name} (${this.headers.length} columns, ${this.parsedData.length} rows)`);
            showToast(`File parsed successfully: ${this.headers.length} columns, ${this.parsedData.length} rows`, 'success');
            
            // Debug profile state after file processing
            this.debugProfileDropdown('after-file-processing');
            
        } catch (error) {
            console.error('Error parsing file:', error);
            showToast('Error parsing file: ' + error.message, 'error');
            
            // Reset file input on error
            event.target.value = '';
            this.headers = [];
            this.parsedData = [];
            this.updateFileDisplay('No file selected');
        } finally {
            this.hideLoading('importStep1');
        }
    }

    updateFileDisplay(text) {
        console.log('=== UPDATE FILE DISPLAY ===');
        console.log('Display text:', text);
        
        // Update file display text near the file input - use stored reference or fallback
        const fileInput = this.currentFileInput || document.getElementById('importFile');
        const fileText = fileInput ? fileInput.nextElementSibling : null;
        console.log('File input found (stored):', !!this.currentFileInput);
        console.log('File input found (fallback):', !!document.getElementById('importFile'));
        console.log('File input used:', !!fileInput);
        console.log('File text element found:', !!fileText);
        console.log('File text element class:', fileText ? fileText.className : 'none');
        
        if (fileText) {
            if (text === 'No file selected') {
                fileText.textContent = 'Select your CSV or Excel file to import, or download a template to get started';
                fileText.className = 'form-text';
                console.log('Set to default message');
            } else {
                fileText.textContent = text;
                fileText.className = 'form-text text-success';
                console.log('Set to success message:', text);
            }
        } else {
            console.warn('File text element not found - cannot update display');
        }
        console.log('=== END UPDATE FILE DISPLAY ===');
    }
    
    getFileType(file) {
        const extension = file.name.split('.').pop().toLowerCase();
        if (extension === 'csv') return 'csv';
        if (['xlsx', 'xls'].includes(extension)) return 'excel';
        throw new Error('Unsupported file format. Please use CSV or Excel files.');
    }

    setFileType(fileType) {
        console.log('Setting file type to:', fileType);
        const csvRadio = document.getElementById('csvFileType');
        const excelRadio = document.getElementById('excelFileType');
        
        if (csvRadio && excelRadio) {
            if (fileType === 'csv') {
                csvRadio.checked = true;
                excelRadio.checked = false;
                console.log('CSV radio button checked');
            } else {
                excelRadio.checked = true;
                csvRadio.checked = false;
                console.log('Excel radio button checked');
            }
        } else {
            // Only warn if we don't already have modal elements set up
            if (!this.modalEventListenersSetup) {
                console.warn('File type radio buttons not found - will be set when modal elements are ready');
                // Store the file type to set it later when DOM is ready
                this.pendingFileType = fileType;
            } else {
                console.warn('File type radio buttons not found even after modal setup - this might be an issue');
            }
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
        console.log('=== HANDLE PROFILE CHANGE ===');
        console.log('Profile key:', profileKey);
        
        if (!profileKey) {
            console.log('No profile selected, clearing current profile');
            this.currentProfile = null;
            return;
        }

        const profile = this.defaultProfiles[profileKey] || this.importProfiles[profileKey];
        console.log('Found profile:', profile ? profile.name : 'Not found');
        
        if (profile) {
            this.currentProfile = profile;
            console.log('Setting file type to:', profile.fileType);
            this.setFileType(profile.fileType);
            
            const itemTypeSelect = document.getElementById('itemType');
            if (profile.itemType && itemTypeSelect) {
                console.log('Setting item type to:', profile.itemType);
                itemTypeSelect.value = profile.itemType;
            }
            
            console.log('Profile applied successfully:', profile.name);
            showToast(`Applied profile: ${profile.name}`, 'success');
        } else {
            console.warn('Profile not found for key:', profileKey);
            console.log('Available default profiles:', Object.keys(this.defaultProfiles));
            console.log('Available custom profiles:', Object.keys(this.importProfiles));
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
        console.log(`🎬 SHOW CURRENT STEP CALLED - Step ${this.currentStep} 🎬`);
        console.log('Stack trace:', new Error().stack);
        
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
        // Clear previous resolutions
        this.dataResolutions.suppliers.clear();
        this.dataResolutions.categories.clear();
        this.pendingResolutions = [];
        
        const conflicts = [];
        const uniqueSuppliers = new Map(); // Changed to Map to track counts and affected rows
        const uniqueCategories = new Map(); // Changed to Map to track counts and affected rows
        
        // Collect unique values from import data with item counts and row references
        this.parsedData.forEach((row, rowIndex) => {
            if (this.fieldMappings.supplier && row[this.fieldMappings.supplier]) {
                const supplierName = row[this.fieldMappings.supplier].trim();
                if (!uniqueSuppliers.has(supplierName)) {
                    uniqueSuppliers.set(supplierName, {
                        name: supplierName,
                        itemCount: 0,
                        affectedRows: [],
                        sampleItems: []
                    });
                }
                const supplierData = uniqueSuppliers.get(supplierName);
                supplierData.itemCount++;
                supplierData.affectedRows.push(rowIndex + 1); // 1-based row numbers
                if (supplierData.sampleItems.length < 3) {
                    supplierData.sampleItems.push(row[this.fieldMappings.name] || `Item ${rowIndex + 1}`);
                }
            }
            
            if (this.fieldMappings.category && row[this.fieldMappings.category]) {
                const categoryName = row[this.fieldMappings.category].trim();
                if (!uniqueCategories.has(categoryName)) {
                    uniqueCategories.set(categoryName, {
                        name: categoryName,
                        itemCount: 0,
                        affectedRows: [],
                        sampleItems: []
                    });
                }
                const categoryData = uniqueCategories.get(categoryName);
                categoryData.itemCount++;
                categoryData.affectedRows.push(rowIndex + 1);
                if (categoryData.sampleItems.length < 3) {
                    categoryData.sampleItems.push(row[this.fieldMappings.name] || `Item ${rowIndex + 1}`);
                }
            }
        });
        
        // Check suppliers
        uniqueSuppliers.forEach((supplierData, supplierName) => {
            // First check for exact case-insensitive match
            const exactMatch = this.existingSuppliers.find(s => 
                s.name.toLowerCase().trim() === supplierName.toLowerCase().trim()
            );
            
            if (!exactMatch) {
                // Check if already resolved (might have been resolved in a previous operation)
                if (!this.dataResolutions.suppliers.has(supplierName)) {
                    const suggestions = this.findSuggestions(supplierName, this.existingSuppliers, 'name');
                    conflicts.push({
                        type: 'supplier',
                        importValue: supplierName,
                        itemCount: supplierData.itemCount,
                        affectedRows: supplierData.affectedRows,
                        sampleItems: supplierData.sampleItems,
                        suggestions: suggestions.slice(0, 5), // Increased to top 5 suggestions
                        status: 'pending'
                    });
                } else {
                    console.log(`Supplier "${supplierName}" already resolved, skipping conflict`);
                }
            } else {
                // Exact match found - auto-resolve
                this.dataResolutions.suppliers.set(supplierName, exactMatch);
                console.log(`Auto-resolved supplier "${supplierName}" to existing supplier "${exactMatch.name}" (${supplierData.itemCount} items affected)`);
            }
        });
        
        // Check categories
        uniqueCategories.forEach((categoryData, categoryName) => {
            // First check for exact case-insensitive match
            const exactMatch = this.existingCategories.find(c => 
                c.name.toLowerCase().trim() === categoryName.toLowerCase().trim()
            );
            
            if (!exactMatch) {
                // Check if already resolved (might have been resolved in a previous operation)
                if (!this.dataResolutions.categories.has(categoryName)) {
                    const suggestions = this.findSuggestions(categoryName, this.existingCategories, 'name');
                    conflicts.push({
                        type: 'category',
                        importValue: categoryName,
                        itemCount: categoryData.itemCount,
                        affectedRows: categoryData.affectedRows,
                        sampleItems: categoryData.sampleItems,
                        suggestions: suggestions.slice(0, 5), // Increased to top 5 suggestions
                        status: 'pending'
                    });
                } else {
                    console.log(`Category "${categoryName}" already resolved, skipping conflict`);
                }
            } else {
                // Exact match found - auto-resolve
                this.dataResolutions.categories.set(categoryName, exactMatch);
                console.log(`Auto-resolved category "${categoryName}" to existing category "${exactMatch.name}" (${categoryData.itemCount} items affected)`);
            }
        });
        
        // Group similar conflicts together
        const groupedConflicts = this.groupSimilarConflicts(conflicts);
        
        this.pendingResolutions = groupedConflicts;
        console.log(`Found ${conflicts.length} individual conflicts, grouped into ${groupedConflicts.length} conflict groups`);
        console.log('Auto-resolved suppliers:', Array.from(this.dataResolutions.suppliers.keys()));
        console.log('Auto-resolved categories:', Array.from(this.dataResolutions.categories.keys()));
        console.log('Grouped conflicts:', groupedConflicts.map(c => {
            if (c.variants) {
                return `${c.type}: "${c.importValue}" (${c.variants.length} variants, ${c.itemCount} total items)`;
            }
            return `${c.type}: "${c.importValue}" (${c.itemCount} items)`;
        }));
        return groupedConflicts;
    }
    
    groupSimilarConflicts(conflicts) {
        const groupedConflicts = [];
        const processedIndices = new Set();
        
        for (let i = 0; i < conflicts.length; i++) {
            if (processedIndices.has(i)) continue;
            
            const currentConflict = conflicts[i];
            const similarConflicts = [];
            
            // Find all conflicts similar to current one (same type)
            for (let j = i + 1; j < conflicts.length; j++) {
                if (processedIndices.has(j)) continue;
                if (conflicts[j].type !== currentConflict.type) continue;
                
                const similarity = this.calculateSimilarity(
                    currentConflict.importValue.toLowerCase(),
                    conflicts[j].importValue.toLowerCase()
                );
                
                // Group if similarity is above 80%
                if (similarity >= 0.8) {
                    similarConflicts.push(conflicts[j]);
                    processedIndices.add(j);
                }
            }
            
            if (similarConflicts.length > 0) {
                // Create a grouped conflict
                const allConflicts = [currentConflict, ...similarConflicts];
                const groupedConflict = {
                    type: currentConflict.type,
                    importValue: currentConflict.importValue, // Use first variant as primary
                    isGroup: true,
                    variants: allConflicts.map(c => ({
                        value: c.importValue,
                        itemCount: c.itemCount,
                        affectedRows: c.affectedRows,
                        sampleItems: c.sampleItems
                    })),
                    itemCount: allConflicts.reduce((sum, c) => sum + c.itemCount, 0),
                    affectedRows: allConflicts.reduce((all, c) => [...all, ...c.affectedRows], []),
                    sampleItems: allConflicts.reduce((all, c) => {
                        const newItems = c.sampleItems.filter(item => !all.includes(item));
                        return [...all, ...newItems].slice(0, 5); // Limit to 5 samples
                    }, []),
                    suggestions: currentConflict.suggestions, // Use suggestions from primary variant
                    status: 'pending'
                };
                
                groupedConflicts.push(groupedConflict);
            } else {
                // Single conflict, no grouping needed
                groupedConflicts.push(currentConflict);
            }
            
            processedIndices.add(i);
        }
        
        return groupedConflicts;
    }
    
    findSuggestions(importValue, existingData, field) {
        if (!importValue || !existingData.length) return [];
        
        const importLower = importValue.toLowerCase().trim();
        const suggestions = existingData
            .map(item => {
                const itemValue = item[field].toLowerCase().trim();
                let similarity = this.calculateSimilarity(importLower, itemValue);
                
                // Boost similarity for exact substring matches
                if (itemValue.includes(importLower) || importLower.includes(itemValue)) {
                    similarity += 0.3;
                }
                
                // Boost similarity for word matches
                const importWords = importLower.split(/\s+/);
                const itemWords = itemValue.split(/\s+/);
                let wordMatches = 0;
                importWords.forEach(importWord => {
                    itemWords.forEach(itemWord => {
                        if (importWord === itemWord || 
                            importWord.includes(itemWord) || 
                            itemWord.includes(importWord)) {
                            wordMatches++;
                        }
                    });
                });
                
                if (wordMatches > 0) {
                    similarity += (wordMatches / Math.max(importWords.length, itemWords.length)) * 0.4;
                }
                
                // Cap similarity at 1.0
                similarity = Math.min(similarity, 1.0);
                
                return {
                    item: item,
                    similarity: similarity
                };
            })
            .filter(s => s.similarity > 0.2) // Lower threshold to catch more potential matches
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
        
        // Calculate total affected items
        const totalAffectedItems = conflicts.reduce((sum, conflict) => sum + (conflict.itemCount || 1), 0);
        
        let html = `
            <div class="alert alert-warning">
                <div class="d-flex justify-content-between align-items-center">
                    <div>
                        <i class="fas fa-exclamation-triangle"></i>
                        <strong>Data Validation Required</strong>
                    </div>
                    <div class="text-end">
                        <small class="text-muted">
                            <i class="fas fa-boxes"></i> ${totalAffectedItems} items affected
                        </small>
                    </div>
                </div>
                <p class="mb-0 mt-2">
                    Found ${conflicts.length} data conflicts affecting ${totalAffectedItems} items. 
                    Resolving these conflicts will apply to all affected items in bulk.
                </p>
            </div>
            
            <div class="progress mb-3" style="height: 8px;">
                <div class="progress-bar bg-success" role="progressbar" style="width: 0%" id="conflictProgressBar"></div>
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
        try {
            const conflict = this.pendingResolutions[index];
            if (!conflict) {
                console.warn(`Conflict at index ${index} not found or already resolved`);
                return;
            }
            
            // Check if conflict is already resolved
            if (conflict.status === 'resolved') {
                console.log(`Conflict at index ${index} already resolved, skipping`);
                return;
            }
            
            console.log(`Resolving conflict at index ${index}: mapping "${conflict.importValue}" to "${targetName}"`);
            
            // Find the target item
            const targetData = conflict.type === 'supplier' 
                ? this.existingSuppliers.find(s => s.name === targetName)
                : this.existingCategories.find(c => c.name === targetName);
                
            if (!targetData) {
                showToast(`Target ${conflict.type} "${targetName}" not found`, 'error');
                console.error(`Target data not found for ${targetName}`);
                return;
            }
            
            // Mark as resolving to prevent duplicate processing
            conflict.status = 'resolving';
            
            // Handle grouped conflicts - store resolution for all variants
            if (conflict.isGroup && conflict.variants) {
                conflict.variants.forEach(variant => {
                    if (conflict.type === 'supplier') {
                        this.dataResolutions.suppliers.set(variant.value, targetData);
                    } else {
                        this.dataResolutions.categories.set(variant.value, targetData);
                    }
                });
            } else {
                // Single conflict resolution
                if (conflict.type === 'supplier') {
                    this.dataResolutions.suppliers.set(conflict.importValue, targetData);
                } else {
                    this.dataResolutions.categories.set(conflict.importValue, targetData);
                }
            }
            
            // Mark as resolved
            conflict.status = 'resolved';
            
            // Update UI first
            this.markConflictResolved(index, `Mapped to "${targetName}"`, conflict.itemCount);
            
            const itemCountText = conflict.itemCount ? ` (${conflict.itemCount} items)` : '';
            const conflictText = conflict.isGroup ? 
                `${conflict.variants.length} similar ${conflict.type}s` : 
                `"${conflict.importValue}"`;
            showToast(`${conflictText} mapped to existing ${conflict.type} "${targetName}"${itemCountText}`, 'success');
            
            // Remove from pending (do this after UI update with a small delay to avoid index issues)
            setTimeout(() => {
                const conflictIndex = this.pendingResolutions.findIndex(c => c === conflict);
                if (conflictIndex !== -1) {
                    this.pendingResolutions.splice(conflictIndex, 1);
                    console.log(`Removed conflict from pending list, ${this.pendingResolutions.length} conflicts remaining`);
                }
                
                // Check if all conflicts are resolved
                this.checkIfAllConflictsResolved();
            }, 100);
            
        } catch (error) {
            console.error('Error resolving conflict by mapping:', error);
            showToast('Error resolving conflict. Please try again.', 'error');
        }
    }
    
    async resolveConflictByCreating(index) {
        const conflict = this.pendingResolutions[index];
        if (!conflict) return;
        
        try {
            // Before creating, check if the item was already resolved or if it actually exists
            const existingResolution = conflict.type === 'supplier' 
                ? this.dataResolutions.suppliers.get(conflict.importValue)
                : this.dataResolutions.categories.get(conflict.importValue);
                
            if (existingResolution) {
                console.log(`Conflict "${conflict.importValue}" already resolved, using existing resolution`);
                // Mark as resolved and remove from pending
                this.pendingResolutions.splice(index, 1);
                this.markConflictResolved(index, `Already resolved to "${existingResolution.name}"`, conflict.itemCount);
                this.checkIfAllConflictsResolved();
                return;
            }
            
            // Double-check if the item actually exists (case-insensitive)
            const existingItems = conflict.type === 'supplier' ? this.existingSuppliers : this.existingCategories;
            const exactMatch = existingItems.find(item => 
                item.name.toLowerCase() === conflict.importValue.toLowerCase()
            );
            
            if (exactMatch) {
                console.log(`Found existing ${conflict.type} "${exactMatch.name}" for import value "${conflict.importValue}" - auto-resolving`);
                // Store the resolution
                if (conflict.type === 'supplier') {
                    this.dataResolutions.suppliers.set(conflict.importValue, exactMatch);
                } else {
                    this.dataResolutions.categories.set(conflict.importValue, exactMatch);
                }
                
                // Mark as resolved and remove from pending
                this.pendingResolutions.splice(index, 1);
                this.markConflictResolved(index, `Mapped to existing "${exactMatch.name}"`, conflict.itemCount);
                this.checkIfAllConflictsResolved();
                return;
            }
            
            let newData;
            
            // Handle grouped conflicts - create new item using primary variant name
            const nameToCreate = conflict.isGroup ? conflict.importValue : conflict.importValue;
            
            if (conflict.type === 'supplier') {
                // Generate unique code for supplier
                const supplierCode = await this.generateUniqueSupplierCode(nameToCreate);
                const supplierData = {
                    name: nameToCreate,
                    code: supplierCode,
                    color: this.generateRandomColor(),
                    contactEmail: '',
                    contactPhone: '',
                    address: ''
                };
                
                newData = await inventoryDB.addSupplier(supplierData);
                this.existingSuppliers.push(newData);
                
                // Map all variants to the new supplier if grouped
                if (conflict.isGroup && conflict.variants) {
                    conflict.variants.forEach(variant => {
                        this.dataResolutions.suppliers.set(variant.value, newData);
                    });
                } else {
                    this.dataResolutions.suppliers.set(conflict.importValue, newData);
                }
                
            } else {
                // Generate unique code for category
                const categoryCode = await this.generateUniqueCategoryCode(nameToCreate);
                const categoryData = {
                    name: nameToCreate,
                    code: categoryCode,
                    description: `Auto-created during bulk import`,
                    isDefault: false
                };
                
                newData = await inventoryDB.addCategory(categoryData);
                this.existingCategories.push(newData);
                
                // Map all variants to the new category if grouped
                if (conflict.isGroup && conflict.variants) {
                    conflict.variants.forEach(variant => {
                        this.dataResolutions.categories.set(variant.value, newData);
                    });
                } else {
                    this.dataResolutions.categories.set(conflict.importValue, newData);
                }
            }
            
            // Mark as resolved and remove from pending
            this.pendingResolutions.splice(index, 1);
            
            // Update UI
            this.markConflictResolved(index, `Created new ${conflict.type}`, conflict.itemCount);
            
            const itemCountText = conflict.itemCount ? ` (${conflict.itemCount} items affected)` : '';
            const conflictText = conflict.isGroup ? 
                `new ${conflict.type} "${nameToCreate}" for ${conflict.variants.length} similar variants` : 
                `new ${conflict.type} "${conflict.importValue}"`;
            showToast(`Created ${conflictText}${itemCountText}`, 'success');
            
            // Check if all conflicts are resolved
            this.checkIfAllConflictsResolved();
            
        } catch (error) {
            console.error('Error creating new data:', error);
            
            // Handle specific database errors
            let errorMessage = error.message;
            if (error.message.includes('already exist')) {
                errorMessage = `A ${conflict.type} with this name or code already exists. Please try mapping to an existing ${conflict.type} instead.`;
            }
            
            showToast(`Error creating new ${conflict.type}: ${errorMessage}`, 'error');
        }
    }
    
    markConflictResolved(index, resolution, itemCount = null) {
        try {
            const conflictCard = document.getElementById(`conflict-${index}`);
            if (conflictCard) {
                const itemCountText = itemCount ? ` (${itemCount} items affected)` : '';
                conflictCard.innerHTML = `
                    <div class="card-body text-center">
                        <div class="text-success mb-2">
                            <i class="fas fa-check-circle fa-2x"></i>
                        </div>
                        <h6 class="card-title text-success">Resolved</h6>
                        <p class="card-text small text-muted">${resolution}${itemCountText}</p>
                    </div>
                `;
                conflictCard.classList.add('border-success');
                
                // Mark the card as resolved to prevent further interaction
                conflictCard.dataset.resolved = 'true';
                
                // Disable all buttons in this card
                const buttons = conflictCard.querySelectorAll('button');
                buttons.forEach(btn => {
                    btn.disabled = true;
                    btn.style.pointerEvents = 'none';
                });
                
                // Disable all inputs in this card
                const inputs = conflictCard.querySelectorAll('input');
                inputs.forEach(input => {
                    input.disabled = true;
                    input.style.pointerEvents = 'none';
                });
            } else {
                console.warn(`Conflict card with ID conflict-${index} not found`);
            }
            
            // Update progress bar
            this.updateConflictProgress();
            
        } catch (error) {
            console.error('Error marking conflict as resolved:', error);
        }
    }
    
    updateConflictProgress() {
        const progressBar = document.getElementById('conflictProgressBar');
        if (!progressBar || !this.pendingResolutions) return;
        
        const totalConflicts = this.pendingResolutions.length + this.getResolvedConflictCount();
        const resolvedConflicts = this.getResolvedConflictCount();
        const progressPercentage = totalConflicts > 0 ? Math.round((resolvedConflicts / totalConflicts) * 100) : 0;
        
        progressBar.style.width = `${progressPercentage}%`;
        progressBar.setAttribute('aria-valuenow', progressPercentage);
        progressBar.textContent = `${progressPercentage}%`;
        
        // If all conflicts are resolved, show completion state
        if (progressPercentage === 100) {
            progressBar.classList.remove('bg-success');
            progressBar.classList.add('bg-primary');
        }
    }
    
    getResolvedConflictCount() {
        // Count resolved conflicts based on data resolution maps
        return (this.dataResolutions?.suppliers?.size || 0) + (this.dataResolutions?.categories?.size || 0);
    }
    
    checkIfAllConflictsResolved() {
        if (this.pendingResolutions.length === 0) {
            // All conflicts resolved - show success message and enable final import
            const conflictsContainer = document.getElementById('dataConflicts');
            if (conflictsContainer) {
                const successAlert = document.createElement('div');
                successAlert.className = 'alert alert-success mt-3';
                successAlert.innerHTML = `
                    <i class="fas fa-check-circle"></i>
                    <strong>All Conflicts Resolved!</strong>
                    <p class="mb-0 mt-2">
                        Great! All data conflicts have been resolved. You can now proceed to import your items.
                    </p>
                `;
                conflictsContainer.appendChild(successAlert);
            }
            
            // Enable the final import button
            const finalImportBtn = document.getElementById('finalImportBtn');
            if (finalImportBtn) {
                finalImportBtn.disabled = false;
                finalImportBtn.classList.remove('btn-secondary');
                finalImportBtn.classList.add('btn-primary');
            }
            
            // Update step indicator if available
            this.updateStepIndicator(3, 'completed');
            
            return true;
        }
        return false;
    }
    
    generateSupplierCode(name) {
        // Generate a simple code from the supplier name
        const code = name.replace(/[^a-zA-Z0-9]/g, '').substr(0, 8).toUpperCase();
        return code || 'SUP' + Date.now().toString().substr(-5);
    }
    
    async generateUniqueSupplierCode(name) {
        let baseCode = name.replace(/[^a-zA-Z0-9]/g, '').substr(0, 6).toUpperCase();
        if (!baseCode) {
            baseCode = 'SUP';
        }
        
        // Check if the base code already exists
        let code = baseCode;
        let counter = 1;
        
        while (this.existingSuppliers.some(s => s.code === code)) {
            code = baseCode + counter.toString().padStart(2, '0');
            counter++;
            if (counter > 99) {
                // Fallback to timestamp if we somehow exceed 99
                code = baseCode + Date.now().toString().substr(-3);
                break;
            }
        }
        
        return code;
    }
    
    generateCategoryCode(name) {
        // Generate a simple code from the category name
        const code = name.replace(/[^a-zA-Z0-9]/g, '').substr(0, 8).toUpperCase();
        return code || 'CAT' + Date.now().toString().substr(-5);
    }
    
    async generateUniqueCategoryCode(name) {
        let baseCode = name.replace(/[^a-zA-Z0-9]/g, '').substr(0, 6).toUpperCase();
        if (!baseCode) {
            baseCode = 'CAT';
        }
        
        // Check if the base code already exists
        let code = baseCode;
        let counter = 1;
        
        while (this.existingCategories.some(c => c.code === code)) {
            code = baseCode + counter.toString().padStart(2, '0');
            counter++;
            if (counter > 99) {
                // Fallback to timestamp if we somehow exceed 99
                code = baseCode + Date.now().toString().substr(-3);
                break;
            }
        }
        
        return code;
    }
    
    generateRandomColor() {
        const colors = [
            '#007bff', '#28a745', '#17a2b8', '#ffc107', 
            '#dc3545', '#6f42c1', '#e83e8c', '#fd7e14'
        ];
        return colors[Math.floor(Math.random() * colors.length)];
    }
    
    renderConflictCard(conflict, index) {
        const itemCountBadge = conflict.itemCount ? `<span class="badge bg-secondary ms-2">${conflict.itemCount} items</span>` : '';
        const affectedRowsText = conflict.affectedRows ? conflict.affectedRows.slice(0, 5).join(', ') + (conflict.affectedRows.length > 5 ? '...' : '') : '';
        const sampleItemsText = conflict.sampleItems ? conflict.sampleItems.slice(0, 3).join(', ') + (conflict.sampleItems.length > 3 ? '...' : '') : '';
        
        // Show best suggestion as default option
        const bestSuggestion = conflict.suggestions.length > 0 ? conflict.suggestions[0] : null;
        
        // Handle grouped conflicts
        const isGrouped = conflict.isGroup && conflict.variants;
        const variantsDisplay = isGrouped ? 
            conflict.variants.map(v => `"${v.value}" (${v.itemCount} items)`).join(', ') : '';
        
        return `
            <div class="col-md-6 mb-3">
                <div class="card conflict-resolution-card" id="conflict-${index}">
                    <div class="card-body">
                        <h6 class="card-title text-warning d-flex align-items-center">
                            <i class="fas fa-${isGrouped ? 'layer-group' : 'question-circle'} me-2"></i> 
                            ${isGrouped ? `Similar ${conflict.type}s grouped` : `"${conflict.importValue}"`}
                            ${itemCountBadge}
                            ${isGrouped ? `<span class="badge bg-info ms-2">${conflict.variants.length} variants</span>` : ''}
                        </h6>
                        
                        ${isGrouped ? `
                            <div class="alert alert-warning py-2 mb-2">
                                <small>
                                    <strong>Grouped Similar Items:</strong><br>
                                    ${conflict.variants.map(v => `• "${v.value}" (${v.itemCount} items)`).join('<br>')}
                                </small>
                                <div class="mt-2">
                                    <button class="btn btn-sm btn-outline-secondary" data-index="${index}" data-action="split-group">
                                        <i class="fas fa-unlink me-1"></i>Split & Resolve Separately
                                    </button>
                                </div>
                            </div>
                        ` : `
                            ${conflict.itemCount && conflict.itemCount > 1 ? `
                                <div class="alert alert-info py-2 mb-2">
                                    <small>
                                        <strong>Bulk Resolution:</strong> This will affect ${conflict.itemCount} items
                                        ${affectedRowsText ? ` (rows: ${affectedRowsText})` : ''}
                                    </small>
                                    ${sampleItemsText ? `<br><small class="text-muted">Sample items: ${sampleItemsText}</small>` : ''}
                                </div>
                            ` : ''}
                        `}
                        
                        <p class="card-text small text-muted mb-3">
                            ${isGrouped ? 
                                `These similar ${conflict.type}s don't exist. Choose how to resolve all ${conflict.itemCount} affected items:` :
                                `This ${conflict.type} doesn't exist. Choose how to resolve ${conflict.itemCount ? `all ${conflict.itemCount} affected items` : 'this item'}:`
                            }
                        </p>
                        
                        <!-- Resolution Options -->
                        <div class="resolution-options">
                            ${bestSuggestion ? `
                                <!-- Best Match Option -->
                                <div class="resolution-option mb-3">
                                    <div class="d-flex justify-content-between align-items-center mb-2">
                                        <span class="fw-bold text-primary">Best Match Found:</span>
                                        <span class="badge bg-primary">Recommended</span>
                                    </div>
                                    <button class="btn btn-outline-primary w-100 text-start best-match-btn" 
                                            data-index="${index}" 
                                            data-action="map" 
                                            data-target="${bestSuggestion.name}" 
                                            data-target-code="${bestSuggestion.code || bestSuggestion.id}">
                                        <i class="fas fa-link me-2"></i>
                                        Map to "${bestSuggestion.name}"
                                    </button>
                                </div>
                            ` : ''}
                            
                            <!-- Custom Search Option -->
                            <div class="resolution-option mb-3">
                                <div class="mb-2">
                                    <span class="fw-bold">Search & Map to Existing:</span>
                                </div>
                                <div class="autocomplete-container position-relative">
                                    <input type="text" 
                                           class="form-control autocomplete-input" 
                                           placeholder="Type to search existing ${conflict.type}s..." 
                                           data-index="${index}" 
                                           data-type="${conflict.type}" 
                                           autocomplete="off">
                                    <div class="autocomplete-suggestions position-absolute w-100 bg-white border border-top-0 rounded-bottom" 
                                         style="display: none; max-height: 200px; overflow-y: auto; z-index: 1000;"></div>
                                </div>
                                <div class="row mt-2">
                                    <div class="col-6">
                                        <button class="btn btn-outline-secondary w-100" 
                                                data-index="${index}" 
                                                data-action="map-selected" 
                                                disabled>
                                            <i class="fas fa-link"></i> Map to Selected
                                        </button>
                                    </div>
                                    <div class="col-6">
                                        <button class="btn btn-outline-secondary w-100" 
                                                data-index="${index}" 
                                                data-action="create-from-input" 
                                                disabled>
                                            <i class="fas fa-plus"></i> Create New
                                        </button>
                                    </div>
                                </div>
                            </div>
                            
                            <!-- Create New Option -->
                            <div class="resolution-option">
                                <div class="mb-2">
                                    <span class="fw-bold">Create New ${conflict.type}:</span>
                                </div>
                                <div class="row">
                                    <div class="col-8">
                                        <button class="btn btn-success w-100" 
                                                data-index="${index}" 
                                                data-action="create">
                                            <i class="fas fa-plus me-2"></i>
                                            Quick Create "${conflict.importValue}"
                                        </button>
                                    </div>
                                    <div class="col-4">
                                        <button class="btn btn-outline-success w-100" 
                                                data-index="${index}" 
                                                data-action="edit-create">
                                            <i class="fas fa-edit me-1"></i>Edit
                                        </button>
                                    </div>
                                </div>
                                <small class="text-muted">Quick create uses auto-generated details. Use Edit to customize before creating.</small>
                            </div>
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
            // Don't replace innerHTML - add overlay instead
            if (!element.querySelector('.loading-overlay')) {
                const loadingOverlay = document.createElement('div');
                loadingOverlay.className = 'loading-overlay';
                loadingOverlay.style.cssText = `
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(255, 255, 255, 0.9);
                    z-index: 1000;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    min-height: 200px;
                `;
                
                loadingOverlay.innerHTML = `
                    <div class="text-center">
                        <div class="spinner-border text-primary" role="status">
                            <span class="visually-hidden">Loading...</span>
                        </div>
                        <div class="mt-2">Processing...</div>
                    </div>
                `;
                
                // Make sure parent has relative positioning
                if (element.style.position !== 'relative') {
                    element.style.position = 'relative';
                }
                
                element.appendChild(loadingOverlay);
                console.log('🔄 Loading overlay added to', elementId);
            }
        }
    }

    hideLoading(elementId) {
        const element = document.getElementById(elementId);
        if (element) {
            const loadingOverlay = element.querySelector('.loading-overlay');
            if (loadingOverlay) {
                loadingOverlay.remove();
                console.log('🔄 Loading overlay removed from', elementId);
            }
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
                console.log('Import profiles loaded:', Object.keys(this.importProfiles));
                // Note: Profile dropdown will be updated when modal is shown
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

    updateProfileDropdown(targetDropdown = null) {
        console.log('🚨 UPDATE PROFILE DROPDOWN CALLED 🚨');
        console.log('Stack trace:', new Error().stack);
        
        const dropdown = targetDropdown || document.getElementById('importProfile');
        if (!dropdown) {
            console.warn('Profile dropdown not found, cannot update');
            return;
        }
        
        const currentValue = dropdown.value;
        console.log('🎯 BEFORE UPDATE: Profile dropdown current value:', currentValue);
        
        // Clear and rebuild options
        dropdown.innerHTML = '<option value="">Create New Profile...</option>';
        console.log('🔥 Profile dropdown innerHTML reset - selection will be lost!');
        
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
        
        // Restore selection - try current value first, then check if profile is still valid
        if (currentValue) {
            dropdown.value = currentValue;
            // Verify the selection was successful (option exists)
            if (dropdown.value === currentValue) {
                console.log('Successfully restored profile selection:', currentValue);
            } else {
                console.warn('Could not restore profile selection - option no longer exists:', currentValue);
                dropdown.value = '';
            }
        }
        
        const totalProfiles = Object.keys(this.defaultProfiles).length + Object.keys(this.importProfiles).length;
        console.log(`Profile dropdown updated with ${totalProfiles} profiles, selected: "${dropdown.value}"`);
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