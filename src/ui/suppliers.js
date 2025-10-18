/**
 * Suppliers UI Management
 */

class SuppliersManager {
    constructor() {
        this.suppliers = [];
        this.filteredSuppliers = [];
    }

    async init() {
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Manage suppliers button (from settings menu)
        document.getElementById('manageSuppliersBtn').addEventListener('click', () => {
            this.showManageSuppliersModal();
        });

        // Add supplier button (in manage modal)
        document.getElementById('addSupplierModalBtn').addEventListener('click', () => {
            this.showAddSupplierModal();
        });

        // Save supplier button
        document.getElementById('saveSupplierBtn').addEventListener('click', () => {
            this.saveSupplier();
        });

        // Search suppliers in modal
        const searchInput = document.getElementById('supplierModalSearch');
        if (searchInput) {
            const debouncedSearch = debounce(() => this.filterSuppliersModal(), 300);
            searchInput.addEventListener('input', debouncedSearch);
        }

        // Color preview update
        document.getElementById('supplierColor').addEventListener('input', (e) => {
            document.getElementById('colorPreview').style.backgroundColor = e.target.value;
        });

        // Supplier code validation
        document.getElementById('supplierCode').addEventListener('input', (e) => {
            // Convert to lowercase and remove spaces
            e.target.value = e.target.value.toLowerCase().replace(/\s+/g, '');
        });

        // Update supplier button
        document.getElementById('updateSupplierBtn').addEventListener('click', () => {
            this.updateSupplier();
        });

        // Edit supplier color preview
        document.getElementById('editSupplierColor').addEventListener('input', (e) => {
            document.getElementById('editColorPreview').style.backgroundColor = e.target.value;
        });

        // Edit supplier code validation
        document.getElementById('editSupplierCode').addEventListener('input', (e) => {
            // Convert to lowercase and remove spaces
            e.target.value = e.target.value.toLowerCase().replace(/\s+/g, '');
        });
    }

    async showManageSuppliersModal() {
        const modal = new bootstrap.Modal(document.getElementById('manageSuppliersModal'));
        
        // Load suppliers
        await this.loadSuppliers();
        
        modal.show();
    }

    async loadSuppliers() {
        try {
            showLoading('suppliersModalTable');
            this.suppliers = await inventoryDB.getAllSuppliers();
            this.filteredSuppliers = [...this.suppliers];
            this.renderSuppliersModalTable();
        } catch (error) {
            console.error('Error loading suppliers:', error);
            showToast('Error loading suppliers', 'error');
            document.getElementById('suppliersModalTable').innerHTML = 
                '<p class="text-muted">Error loading suppliers</p>';
        }
    }

    filterSuppliers() {
        const searchQuery = document.getElementById('supplierSearch').value.toLowerCase();

        if (!searchQuery) {
            this.filteredSuppliers = [...this.suppliers];
        } else {
            this.filteredSuppliers = this.suppliers.filter(supplier => 
                supplier.name.toLowerCase().includes(searchQuery) ||
                supplier.code.toLowerCase().includes(searchQuery) ||
                (supplier.description && supplier.description.toLowerCase().includes(searchQuery))
            );
        }

        this.renderSuppliersTable();
    }

    filterSuppliersModal() {
        const searchQuery = document.getElementById('supplierModalSearch').value.toLowerCase();

        if (!searchQuery) {
            this.filteredSuppliers = [...this.suppliers];
        } else {
            this.filteredSuppliers = this.suppliers.filter(supplier => 
                supplier.name.toLowerCase().includes(searchQuery) ||
                supplier.code.toLowerCase().includes(searchQuery) ||
                (supplier.description && supplier.description.toLowerCase().includes(searchQuery))
            );
        }

        this.renderSuppliersModalTable();
    }

    renderSuppliersTable() {
        const container = document.getElementById('suppliersTable');

        if (!this.filteredSuppliers.length) {
            container.innerHTML = '<p class="text-muted">No suppliers found</p>';
            return;
        }

        const tableHtml = `
            <div class="table-responsive">
                <table class="table table-striped">
                    <thead>
                        <tr>
                            <th>Badge</th>
                            <th>Name</th>
                            <th>Code</th>
                            <th>Description</th>
                            <th>Website</th>
                            <th>Items</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${this.filteredSuppliers.map(supplier => this.renderSupplierRow(supplier)).join('')}
                    </tbody>
                </table>
            </div>
        `;

        container.innerHTML = tableHtml;
    }

    renderSuppliersModalTable() {
        const container = document.getElementById('suppliersModalTable');

        if (!this.filteredSuppliers.length) {
            container.innerHTML = '<p class="text-muted">No suppliers found</p>';
            return;
        }

        const tableHtml = `
            <div class="table-responsive">
                <table class="table table-striped">
                    <thead>
                        <tr>
                            <th>Badge</th>
                            <th>Name</th>
                            <th>Code</th>
                            <th>Description</th>
                            <th>Website</th>
                            <th>Items</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody id="suppliersModalTableBody">
                        ${this.filteredSuppliers.map(supplier => this.renderSupplierModalRow(supplier)).join('')}
                    </tbody>
                </table>
            </div>
        `;

        container.innerHTML = tableHtml;
    }

    renderSupplierModalRow(supplier) {
        const itemCount = this.getSupplierItemCount(supplier.code);
        
        return `
            <tr>
                <td>
                    <span class="badge" style="background-color: ${supplier.color}; color: white;">
                        ${supplier.name}
                    </span>
                </td>
                <td>
                    <div class="fw-bold">
                        ${supplier.name}
                        ${supplier.isDefault ? '<i class="fas fa-shield-alt text-warning ms-1" title="Default Supplier"></i>' : ''}
                    </div>
                    ${supplier.isDefault ? '<small class="text-warning">Default Supplier</small>' : ''}
                </td>
                <td><code>${supplier.code}</code></td>
                <td>${supplier.description || '<span class="text-muted">No description</span>'}</td>
                <td>
                    ${supplier.website ? 
                        `<a href="${supplier.website}" target="_blank" rel="noopener">
                            <i class="fas fa-external-link-alt"></i> Visit
                        </a>` : 
                        '<span class="text-muted">Not provided</span>'
                    }
                </td>
                <td>
                    <span class="badge bg-info">${itemCount} items</span>
                </td>
                <td>
                    <div class="btn-group btn-group-sm" role="group">
                        <button type="button" class="btn btn-outline-primary" onclick="suppliersManager.viewSupplier(${supplier.id})" title="View Details">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button type="button" class="btn btn-outline-warning" onclick="suppliersManager.editSupplier(${supplier.id})" title="Edit Supplier">
                            <i class="fas fa-edit"></i>
                        </button>
                        ${!supplier.isDefault ? 
                            `<button type="button" class="btn btn-outline-danger" onclick="suppliersManager.deleteSupplier(${supplier.id})" title="Delete Supplier">
                                <i class="fas fa-trash"></i>
                            </button>` : 
                            `<button type="button" class="btn btn-outline-secondary" disabled title="Cannot delete default supplier">
                                <i class="fas fa-shield-alt"></i>
                            </button>`
                        }
                    </div>
                </td>
            </tr>
        `;
    }

    renderSupplierRow(supplier) {
        const itemCount = this.getSupplierItemCount(supplier.code);
        
        return `
            <tr>
                <td>
                    <span class="badge" style="background-color: ${supplier.color}; color: white;">
                        ${supplier.name}
                    </span>
                </td>
                <td>
                    <div class="fw-bold">
                        ${supplier.name}
                        ${supplier.isDefault ? '<i class="fas fa-shield-alt text-warning ms-1" title="Default Supplier"></i>' : ''}
                    </div>
                    ${supplier.isDefault ? '<small class="text-warning">Default Supplier</small>' : ''}
                </td>
                <td><code>${supplier.code}</code></td>
                <td>${supplier.description || '<span class="text-muted">No description</span>'}</td>
                <td>
                    ${supplier.website ? 
                        `<a href="${supplier.website}" target="_blank" rel="noopener">
                            <i class="fas fa-external-link-alt"></i> Visit
                        </a>` : 
                        '<span class="text-muted">Not provided</span>'
                    }
                </td>
                <td>
                    <span class="badge bg-info">${itemCount} items</span>
                </td>
                <td>
                    <div class="btn-group btn-group-sm" role="group">
                        <button type="button" class="btn btn-outline-primary" onclick="suppliersManager.viewSupplier(${supplier.id})" title="View Details">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button type="button" class="btn btn-outline-warning" onclick="suppliersManager.editSupplier(${supplier.id})" title="Edit Supplier">
                            <i class="fas fa-edit"></i>
                        </button>
                        ${!supplier.isDefault ? 
                            `<button type="button" class="btn btn-outline-danger" onclick="suppliersManager.deleteSupplier(${supplier.id})" title="Delete Supplier">
                                <i class="fas fa-trash"></i>
                            </button>` : 
                            `<button type="button" class="btn btn-outline-secondary" disabled title="Cannot delete default supplier">
                                <i class="fas fa-shield-alt"></i>
                            </button>`
                        }
                    </div>
                </td>
            </tr>
        `;
    }

    getSupplierItemCount(supplierCode) {
        // This will be updated when items are loaded
        if (window.itemsManager && itemsManager.items) {
            return itemsManager.items.filter(item => item.supplier === supplierCode).length;
        }
        return 0;
    }

    showAddSupplierModal() {
        const modal = new bootstrap.Modal(document.getElementById('addSupplierModal'));
        const form = document.getElementById('addSupplierForm');
        
        // Reset form
        resetForm(form);
        
        // Generate random color
        document.getElementById('supplierColor').value = this.generateRandomColor();
        document.getElementById('colorPreview').style.backgroundColor = document.getElementById('supplierColor').value;
        
        modal.show();
    }

    generateRandomColor() {
        const colors = ['#E91E63', '#9C27B0', '#673AB7', '#3F51B5', '#2196F3', '#03A9F4', '#00BCD4', '#009688', '#4CAF50', '#8BC34A', '#CDDC39', '#FFC107', '#FF9800', '#FF5722', '#795548', '#607D8B'];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    async saveSupplier() {
        const form = document.getElementById('addSupplierForm');
        
        if (!validateForm(form)) {
            showToast('Please fill in all required fields', 'error');
            return;
        }

        const supplierName = document.getElementById('supplierName').value.trim();
        const supplierCode = document.getElementById('supplierCode').value.trim();
        
        // Validate unique name and code
        const existingSupplier = this.suppliers.find(s => 
            s.name.toLowerCase() === supplierName.toLowerCase() || 
            s.code.toLowerCase() === supplierCode.toLowerCase()
        );
        
        if (existingSupplier) {
            showToast('Supplier name or code already exists', 'error');
            return;
        }

        try {
            const supplierData = {
                name: supplierName,
                code: supplierCode,
                color: document.getElementById('supplierColor').value,
                description: document.getElementById('supplierDescription').value.trim() || null,
                website: document.getElementById('supplierWebsite').value.trim() || null,
                isDefault: false
            };

            await inventoryDB.addSupplier(supplierData);
            
            // Close modal
            bootstrap.Modal.getInstance(document.getElementById('addSupplierModal')).hide();
            
            // Refresh suppliers list
            await this.loadSuppliers();
            
            // Update items UI supplier options
            if (window.itemsManager) {
                await itemsManager.refreshSupplierOptions();
            }
            
            // Update dashboard
            if (window.dashboard) {
                await dashboard.refreshStats();
            }
            
            showToast('Supplier added successfully', 'success');
            
        } catch (error) {
            console.error('Error saving supplier:', error);
            showToast('Error saving supplier: ' + error.message, 'error');
        }
    }

    async viewSupplier(supplierId) {
        try {
            const supplier = this.suppliers.find(s => s.id === supplierId);
            if (!supplier) {
                showToast('Supplier not found', 'error');
                return;
            }

            const itemCount = this.getSupplierItemCount(supplier.code);
            
            // Create and show supplier details modal
            this.showSupplierDetailsModal(supplier, itemCount);
            
        } catch (error) {
            console.error('Error viewing supplier:', error);
            showToast('Error loading supplier details', 'error');
        }
    }

    showSupplierDetailsModal(supplier, itemCount) {
        const modalHtml = `
            <div class="modal fade" id="supplierDetailsModal" tabindex="-1">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">
                                <span class="badge me-2" style="background-color: ${supplier.color}; color: white;">
                                    ${supplier.name}
                                </span>
                                Supplier Details
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="row">
                                <div class="col-12">
                                    <table class="table table-borderless">
                                        <tr><th>Name:</th><td>${supplier.name}</td></tr>
                                        <tr><th>Code:</th><td><code>${supplier.code}</code></td></tr>
                                        <tr><th>Type:</th><td>${supplier.isDefault ? 
                                            '<span class="badge bg-secondary">Default Supplier</span>' : 
                                            '<span class="badge bg-primary">Custom Supplier</span>'}</td></tr>
                                        <tr><th>Badge Color:</th><td>
                                            <span class="badge me-2" style="background-color: ${supplier.color}; color: white;">
                                                ${supplier.name}
                                            </span>
                                            <code>${supplier.color}</code>
                                        </td></tr>
                                        <tr><th>Items Using:</th><td><span class="badge bg-info">${itemCount} items</span></td></tr>
                                        <tr><th>Website:</th><td>${supplier.website ? 
                                            `<a href="${supplier.website}" target="_blank" rel="noopener">${supplier.website} <i class="fas fa-external-link-alt"></i></a>` : 
                                            'Not provided'}</td></tr>
                                        <tr><th>Description:</th><td>${supplier.description || 'No description provided'}</td></tr>
                                        <tr><th>Created:</th><td>${formatDate(supplier.createdAt)}</td></tr>
                                        <tr><th>Updated:</th><td>${formatDate(supplier.updatedAt)}</td></tr>
                                    </table>
                                </div>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                            <button type="button" class="btn btn-warning" onclick="suppliersManager.editSupplier(${supplier.id}); bootstrap.Modal.getInstance(document.getElementById('supplierDetailsModal')).hide();">
                                <i class="fas fa-edit me-1"></i>Edit Supplier
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Remove existing modal if any
        const existingModal = document.getElementById('supplierDetailsModal');
        if (existingModal) {
            existingModal.remove();
        }

        // Add modal to page
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        // Show modal
        const modal = new bootstrap.Modal(document.getElementById('supplierDetailsModal'));
        modal.show();

        // Remove modal from DOM after it's hidden
        document.getElementById('supplierDetailsModal').addEventListener('hidden.bs.modal', function() {
            this.remove();
        });
    }

    async deleteSupplier(supplierId) {
        const supplier = this.suppliers.find(s => s.id === supplierId);
        if (!supplier) {
            showToast('Supplier not found', 'error');
            return;
        }

        if (supplier.isDefault) {
            showToast('Cannot delete default suppliers', 'error');
            return;
        }

        const itemCount = this.getSupplierItemCount(supplier.code);
        if (itemCount > 0) {
            if (!confirm(`This supplier is used by ${itemCount} item(s). Deleting it will remove the supplier reference from those items. Continue?`)) {
                return;
            }
        } else {
            if (!confirm(`Are you sure you want to delete the supplier "${supplier.name}"?`)) {
                return;
            }
        }

        try {
            await inventoryDB.deleteSupplier(supplierId);
            await this.loadSuppliers();
            
            // Update items UI supplier options
            if (window.itemsManager) {
                await itemsManager.refreshSupplierOptions();
            }
            
            // Update dashboard
            if (window.dashboard) {
                await dashboard.refreshStats();
            }
            
            showToast('Supplier deleted successfully', 'success');
            
        } catch (error) {
            console.error('Error deleting supplier:', error);
            showToast('Error deleting supplier: ' + error.message, 'error');
        }
    }

    async editSupplier(supplierId) {
        try {
            const supplier = this.suppliers.find(s => s.id === supplierId);
            if (!supplier) {
                showToast('Supplier not found', 'error');
                return;
            }

            // Default suppliers can now be edited (but not deleted)

            this.showEditSupplierModal(supplier);
            
        } catch (error) {
            console.error('Error editing supplier:', error);
            showToast('Error loading supplier for editing', 'error');
        }
    }

    showEditSupplierModal(supplier) {
        const modalElement = document.getElementById('editSupplierModal');
        const modal = new bootstrap.Modal(modalElement);
        const form = document.getElementById('editSupplierForm');
        
        // Find and hide any currently open modals to avoid z-index issues
        const openModals = document.querySelectorAll('.modal.show');
        const hiddenModals = [];
        
        openModals.forEach(openModal => {
            const modalInstance = bootstrap.Modal.getInstance(openModal);
            if (modalInstance && openModal.id !== 'editSupplierModal') {
                modalInstance.hide();
                hiddenModals.push(openModal.id);
            }
        });
        
        // Store reference to hidden modals for restoration
        modalElement.setAttribute('data-hidden-modals', JSON.stringify(hiddenModals));
        
        // Reset form validation
        clearFormValidation(form);
        
        // Update modal title to indicate if this is a default supplier
        const modalTitle = document.querySelector('#editSupplierModal .modal-title');
        if (supplier.isDefault) {
            modalTitle.innerHTML = `<i class="fas fa-shield-alt me-2 text-warning"></i>Edit Default Supplier`;
        } else {
            modalTitle.innerHTML = 'Edit Supplier';
        }
        
        // Populate form with current supplier data
        document.getElementById('editSupplierId').value = supplier.id;
        document.getElementById('editSupplierName').value = supplier.name;
        document.getElementById('editSupplierCode').value = supplier.code;
        document.getElementById('editSupplierColor').value = supplier.color;
        document.getElementById('editColorPreview').style.backgroundColor = supplier.color;
        document.getElementById('editSupplierDescription').value = supplier.description || '';
        document.getElementById('editSupplierWebsite').value = supplier.website || '';
        
        // For default suppliers, disable code editing and add warning
        const codeInput = document.getElementById('editSupplierCode');
        const codeContainer = codeInput.closest('.mb-3');
        
        if (supplier.isDefault) {
            codeInput.disabled = true;
            codeInput.title = 'Supplier code cannot be changed for default suppliers';
            
            // Add warning if not already present
            let warning = codeContainer.querySelector('.default-supplier-warning');
            if (!warning) {
                warning = document.createElement('small');
                warning.className = 'text-warning default-supplier-warning';
                warning.innerHTML = '<i class="fas fa-exclamation-triangle me-1"></i>Supplier code cannot be changed for default suppliers';
                codeContainer.appendChild(warning);
            }
        } else {
            codeInput.disabled = false;
            codeInput.title = '';
            
            // Remove warning if present
            const warning = codeContainer.querySelector('.default-supplier-warning');
            if (warning) {
                warning.remove();
            }
        }
        
        // Handle restoring previously hidden modals when edit modal is closed
        modalElement.addEventListener('hidden.bs.modal', function() {
            const hiddenModalsData = modalElement.getAttribute('data-hidden-modals');
            if (hiddenModalsData) {
                const hiddenModalIds = JSON.parse(hiddenModalsData);
                
                // Restore the first hidden modal (usually manageSuppliersModal)
                setTimeout(() => {
                    hiddenModalIds.forEach(modalId => {
                        const modalElement = document.getElementById(modalId);
                        if (modalElement) {
                            const modalInstance = bootstrap.Modal.getInstance(modalElement);
                            if (modalInstance) {
                                modalInstance.show();
                            } else {
                                // Create new instance if needed
                                const newModal = new bootstrap.Modal(modalElement);
                                newModal.show();
                            }
                        }
                    });
                    
                    // Clear the stored data
                    modalElement.removeAttribute('data-hidden-modals');
                }, 150); // Small delay to ensure smooth transition
            }
        }, { once: true }); // Only run once per modal hide
        
        modal.show();
    }

    async updateSupplier() {
        const form = document.getElementById('editSupplierForm');
        
        if (!validateForm(form)) {
            showToast('Please fill in all required fields', 'error');
            return;
        }

        const supplierId = parseInt(document.getElementById('editSupplierId').value);
        const supplierName = document.getElementById('editSupplierName').value.trim();
        const supplierCode = document.getElementById('editSupplierCode').value.trim();
        
        // Get the current supplier
        const currentSupplier = this.suppliers.find(s => s.id === supplierId);
        if (!currentSupplier) {
            showToast('Supplier not found', 'error');
            return;
        }
        
        // For default suppliers, preserve the original code
        const finalSupplierCode = currentSupplier.isDefault ? currentSupplier.code : supplierCode;
        
        // Validate unique name and code (excluding current supplier)
        const existingSupplier = this.suppliers.find(s => 
            s.id !== supplierId && (
                s.name.toLowerCase() === supplierName.toLowerCase() || 
                (finalSupplierCode !== currentSupplier.code && s.code.toLowerCase() === finalSupplierCode.toLowerCase())
            )
        );
        
        if (existingSupplier) {
            showToast('Supplier name or code already exists', 'error');
            return;
        }

        try {
            const supplierData = {
                name: supplierName,
                code: finalSupplierCode,
                color: document.getElementById('editSupplierColor').value,
                description: document.getElementById('editSupplierDescription').value.trim() || null,
                website: document.getElementById('editSupplierWebsite').value.trim() || null
            };
            
            // Add success message context for default suppliers
            const successMessage = currentSupplier.isDefault ? 
                'Default supplier updated successfully' : 
                'Supplier updated successfully';

            await inventoryDB.updateSupplier(supplierId, supplierData);
            
            // Close modal and refresh data
            const editModal = bootstrap.Modal.getInstance(document.getElementById('editSupplierModal'));
            editModal.hide();
            
            // Refresh suppliers list
            await this.loadSuppliers();
            
            // The manage suppliers modal will be automatically restored by the hidden.bs.modal event
            
            // Update items UI supplier options
            if (window.itemsManager) {
                await itemsManager.refreshSupplierOptions();
            }
            
            // Update dashboard
            if (window.dashboard) {
                await dashboard.refreshStats();
            }
            
            showToast(successMessage, 'success');
            
        } catch (error) {
            console.error('Error updating supplier:', error);
            showToast('Error updating supplier: ' + error.message, 'error');
        }
    }

    // Method to get suppliers for dropdowns in other components
    async getSuppliersForDropdown() {
        try {
            const suppliers = await inventoryDB.getAllSuppliers();
            return suppliers.map(supplier => ({
                value: supplier.code,
                text: supplier.name,
                color: supplier.color
            }));
        } catch (error) {
            console.error('Error getting suppliers for dropdown:', error);
            return [];
        }
    }

    // Method to refresh supplier data (called from other components)
    async refresh() {
        await this.loadSuppliers();
    }
}

// Create global suppliers manager instance
const suppliersManager = new SuppliersManager();