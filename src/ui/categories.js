/**
 * Categories UI Management
 */

class CategoriesManager {
    constructor() {
        this.categories = [];
        this.filteredCategories = [];
    }

    async init() {
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Manage categories button (from settings menu)
        document.getElementById('manageCategoriesBtn').addEventListener('click', () => {
            this.showManageCategoriesModal();
        });

        // Add category button (in manage modal)
        document.getElementById('addCategoryModalBtn').addEventListener('click', () => {
            this.showAddCategoryModal();
        });

        // Save category button
        document.getElementById('saveCategoryBtn').addEventListener('click', () => {
            this.saveCategory();
        });

        // Update category button
        document.getElementById('updateCategoryBtn').addEventListener('click', () => {
            this.updateCategory();
        });

        // Search categories in modal
        const searchInput = document.getElementById('categoryModalSearch');
        if (searchInput) {
            const debouncedSearch = debounce(() => this.filterCategoriesModal(), 300);
            searchInput.addEventListener('input', debouncedSearch);
        }

        // Color preview update
        document.getElementById('categoryColor').addEventListener('input', (e) => {
            document.getElementById('categoryColorPreview').style.backgroundColor = e.target.value;
        });

        // Category code validation
        document.getElementById('categoryCode').addEventListener('input', (e) => {
            // Convert to lowercase and replace spaces with underscores
            e.target.value = e.target.value.toLowerCase().replace(/\s+/g, '_');
        });

        // Edit category color preview
        document.getElementById('editCategoryColor').addEventListener('input', (e) => {
            document.getElementById('editCategoryColorPreview').style.backgroundColor = e.target.value;
        });

        // Edit category code validation
        document.getElementById('editCategoryCode').addEventListener('input', (e) => {
            // Convert to lowercase and replace spaces with underscores
            e.target.value = e.target.value.toLowerCase().replace(/\s+/g, '_');
        });
    }

    async showManageCategoriesModal() {
        const modal = new bootstrap.Modal(document.getElementById('manageCategoriesModal'));
        
        // Load categories
        await this.loadCategories();
        
        modal.show();
    }

    async loadCategories() {
        try {
            showLoading('categoriesModalTable');
            this.categories = await inventoryDB.getAllCategories();
            this.filteredCategories = [...this.categories];
            this.renderCategoriesModalTable();
        } catch (error) {
            console.error('Error loading categories:', error);
            showToast('Error loading categories', 'error');
            document.getElementById('categoriesModalTable').innerHTML = 
                '<p class="text-muted">Error loading categories</p>';
        }
    }

    filterCategoriesModal() {
        const searchQuery = document.getElementById('categoryModalSearch').value.toLowerCase();

        if (!searchQuery) {
            this.filteredCategories = [...this.categories];
        } else {
            this.filteredCategories = this.categories.filter(category => 
                category.name.toLowerCase().includes(searchQuery) ||
                category.code.toLowerCase().includes(searchQuery) ||
                (category.description && category.description.toLowerCase().includes(searchQuery))
            );
        }

        this.renderCategoriesModalTable();
    }

    renderCategoriesModalTable() {
        const container = document.getElementById('categoriesModalTable');

        if (!this.filteredCategories.length) {
            container.innerHTML = '<p class="text-muted">No categories found</p>';
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
                            <th>Items</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${this.filteredCategories.map(category => this.renderCategoryRow(category)).join('')}
                    </tbody>
                </table>
            </div>
        `;

        container.innerHTML = tableHtml;
    }

    renderCategoryRow(category) {
        const itemCount = this.getCategoryItemCount(category.code);
        const categoryColor = category.color || '#6c757d';
        
        return `
            <tr>
                <td>
                    <span class="badge" style="background-color: ${categoryColor}; color: white;">
                        ${category.name}
                    </span>
                </td>
                <td>
                    <div class="fw-bold">${category.name}</div>
                    ${category.isDefault ? '<small class="text-muted">Default Category</small>' : ''}
                </td>
                <td><code>${category.code}</code></td>
                <td>${category.description || '<span class="text-muted">No description</span>'}</td>
                <td>
                    <span class="badge bg-info">${itemCount} items</span>
                </td>
                <td>
                    <div class="btn-group btn-group-sm" role="group">
                        <button type="button" class="btn btn-outline-primary" onclick="categoriesManager.viewCategory(${category.id})" title="View Details">
                            <i class="fas fa-eye"></i>
                        </button>
                        ${!category.isDefault ? 
                            `<button type="button" class="btn btn-outline-warning" onclick="categoriesManager.editCategory(${category.id})" title="Edit Category">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button type="button" class="btn btn-outline-danger" onclick="categoriesManager.deleteCategory(${category.id})" title="Delete Category">
                                <i class="fas fa-trash"></i>
                            </button>` : 
                            `<span class="text-muted small">Default category</span>`
                        }
                    </div>
                </td>
            </tr>
        `;
    }

    getCategoryItemCount(categoryCode) {
        // This will be updated when items are loaded
        if (window.itemsManager && itemsManager.items) {
            return itemsManager.items.filter(item => item.category === categoryCode).length;
        }
        return 0;
    }

    showAddCategoryModal() {
        const modal = new bootstrap.Modal(document.getElementById('addCategoryModal'));
        const form = document.getElementById('addCategoryForm');
        
        // Reset form
        resetForm(form);
        
        // Generate random color
        document.getElementById('categoryColor').value = this.generateRandomColor();
        document.getElementById('categoryColorPreview').style.backgroundColor = document.getElementById('categoryColor').value;
        
        modal.show();
    }

    generateRandomColor() {
        const colors = ['#E91E63', '#9C27B0', '#673AB7', '#3F51B5', '#2196F3', '#03A9F4', '#00BCD4', '#009688', '#4CAF50', '#8BC34A', '#CDDC39', '#FFC107', '#FF9800', '#FF5722', '#795548', '#607D8B'];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    async saveCategory() {
        const form = document.getElementById('addCategoryForm');
        
        if (!validateForm(form)) {
            showToast('Please fill in all required fields', 'error');
            return;
        }

        const categoryName = document.getElementById('categoryName').value.trim();
        const categoryCode = document.getElementById('categoryCode').value.trim();
        
        // Validate unique name and code
        const existingCategory = this.categories.find(c => 
            c.name.toLowerCase() === categoryName.toLowerCase() || 
            c.code.toLowerCase() === categoryCode.toLowerCase()
        );
        
        if (existingCategory) {
            showToast('Category name or code already exists', 'error');
            return;
        }

        try {
            const categoryData = {
                name: categoryName,
                code: categoryCode,
                color: document.getElementById('categoryColor').value,
                description: document.getElementById('categoryDescription').value.trim() || null,
                isDefault: false
            };

            await inventoryDB.addCategory(categoryData);
            
            // Close modal
            bootstrap.Modal.getInstance(document.getElementById('addCategoryModal')).hide();
            
            // Refresh categories list
            await this.loadCategories();
            
            // Update items UI category options
            if (window.itemsManager) {
                await itemsManager.refreshCategoryOptions();
            }
            
            // Update dashboard
            if (window.dashboard) {
                await dashboard.refreshStats();
            }
            
            showToast('Category added successfully', 'success');
            
        } catch (error) {
            console.error('Error saving category:', error);
            showToast('Error saving category: ' + error.message, 'error');
        }
    }

    async viewCategory(categoryId) {
        try {
            const category = this.categories.find(c => c.id === categoryId);
            if (!category) {
                showToast('Category not found', 'error');
                return;
            }

            const itemCount = this.getCategoryItemCount(category.code);
            
            // Create and show category details modal
            this.showCategoryDetailsModal(category, itemCount);
            
        } catch (error) {
            console.error('Error viewing category:', error);
            showToast('Error loading category details', 'error');
        }
    }

    showCategoryDetailsModal(category, itemCount) {
        const modalHtml = `
            <div class="modal fade" id="categoryDetailsModal" tabindex="-1">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">
                                <span class="badge me-2" style="background-color: ${category.color || '#6c757d'}; color: white;">
                                    ${category.name}
                                </span>
                                Category Details
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="row">
                                <div class="col-12">
                                    <table class="table table-borderless">
                                        <tr><th>Name:</th><td>${category.name}</td></tr>
                                        <tr><th>Code:</th><td><code>${category.code}</code></td></tr>
                                        <tr><th>Type:</th><td>${category.isDefault ? 
                                            '<span class="badge bg-secondary">Default Category</span>' : 
                                            '<span class="badge bg-primary">Custom Category</span>'}</td></tr>
                                        <tr><th>Badge Color:</th><td>
                                            <span class="badge me-2" style="background-color: ${category.color || '#6c757d'}; color: white;">
                                                ${category.name}
                                            </span>
                                            <code>${category.color || '#6c757d'}</code>
                                        </td></tr>
                                        <tr><th>Items Using:</th><td><span class="badge bg-info">${itemCount} items</span></td></tr>
                                        <tr><th>Description:</th><td>${category.description || 'No description provided'}</td></tr>
                                        <tr><th>Created:</th><td>${formatDate(category.createdAt)}</td></tr>
                                        <tr><th>Updated:</th><td>${formatDate(category.updatedAt)}</td></tr>
                                    </table>
                                </div>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                            ${!category.isDefault ? 
                                `<button type="button" class="btn btn-warning" onclick="categoriesManager.editCategory(${category.id}); bootstrap.Modal.getInstance(document.getElementById('categoryDetailsModal')).hide();">Edit</button>` : 
                                ''}
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Remove existing modal if any
        const existingModal = document.getElementById('categoryDetailsModal');
        if (existingModal) {
            existingModal.remove();
        }

        // Add modal to page
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        // Show modal
        const modal = new bootstrap.Modal(document.getElementById('categoryDetailsModal'));
        modal.show();

        // Remove modal from DOM after it's hidden
        document.getElementById('categoryDetailsModal').addEventListener('hidden.bs.modal', function() {
            this.remove();
        });
    }

    async editCategory(categoryId) {
        try {
            const category = this.categories.find(c => c.id === categoryId);
            if (!category) {
                showToast('Category not found', 'error');
                return;
            }

            if (category.isDefault) {
                showToast('Cannot edit default categories', 'warning');
                return;
            }

            this.showEditCategoryModal(category);
            
        } catch (error) {
            console.error('Error editing category:', error);
            showToast('Error loading category for editing', 'error');
        }
    }

    showEditCategoryModal(category) {
        const modal = new bootstrap.Modal(document.getElementById('editCategoryModal'));
        const form = document.getElementById('editCategoryForm');
        
        // Reset form validation
        clearFormValidation(form);
        
        // Populate form with current category data
        document.getElementById('editCategoryId').value = category.id;
        document.getElementById('editCategoryName').value = category.name;
        document.getElementById('editCategoryCode').value = category.code;
        document.getElementById('editCategoryColor').value = category.color || '#6c757d';
        document.getElementById('editCategoryColorPreview').style.backgroundColor = category.color || '#6c757d';
        document.getElementById('editCategoryDescription').value = category.description || '';
        
        modal.show();
    }

    async updateCategory() {
        const form = document.getElementById('editCategoryForm');
        
        if (!validateForm(form)) {
            showToast('Please fill in all required fields', 'error');
            return;
        }

        const categoryId = parseInt(document.getElementById('editCategoryId').value);
        const categoryName = document.getElementById('editCategoryName').value.trim();
        const categoryCode = document.getElementById('editCategoryCode').value.trim();
        
        // Get the current category
        const currentCategory = this.categories.find(c => c.id === categoryId);
        if (!currentCategory) {
            showToast('Category not found', 'error');
            return;
        }
        
        // Validate unique name and code (excluding current category)
        const existingCategory = this.categories.find(c => 
            c.id !== categoryId && (
                c.name.toLowerCase() === categoryName.toLowerCase() || 
                c.code.toLowerCase() === categoryCode.toLowerCase()
            )
        );
        
        if (existingCategory) {
            showToast('Category name or code already exists', 'error');
            return;
        }

        try {
            const categoryData = {
                name: categoryName,
                code: categoryCode,
                color: document.getElementById('editCategoryColor').value,
                description: document.getElementById('editCategoryDescription').value.trim() || null
            };

            await inventoryDB.updateCategory(categoryId, categoryData);
            
            // Close modal
            bootstrap.Modal.getInstance(document.getElementById('editCategoryModal')).hide();
            
            // Refresh categories list
            await this.loadCategories();
            
            // Update items UI category options
            if (window.itemsManager) {
                await itemsManager.refreshCategoryOptions();
            }
            
            // Update dashboard
            if (window.dashboard) {
                await dashboard.refreshStats();
            }
            
            showToast('Category updated successfully', 'success');
            
        } catch (error) {
            console.error('Error updating category:', error);
            showToast('Error updating category: ' + error.message, 'error');
        }
    }

    async deleteCategory(categoryId) {
        const category = this.categories.find(c => c.id === categoryId);
        if (!category) {
            showToast('Category not found', 'error');
            return;
        }

        if (category.isDefault) {
            showToast('Cannot delete default categories', 'error');
            return;
        }

        const itemCount = this.getCategoryItemCount(category.code);
        if (itemCount > 0) {
            if (!confirm(`This category is used by ${itemCount} item(s). Deleting it will remove the category reference from those items. Continue?`)) {
                return;
            }
        } else {
            if (!confirm(`Are you sure you want to delete the category "${category.name}"?`)) {
                return;
            }
        }

        try {
            await inventoryDB.deleteCategory(categoryId);
            await this.loadCategories();
            
            // Update items UI category options
            if (window.itemsManager) {
                await itemsManager.refreshCategoryOptions();
            }
            
            // Update dashboard
            if (window.dashboard) {
                await dashboard.refreshStats();
            }
            
            showToast('Category deleted successfully', 'success');
            
        } catch (error) {
            console.error('Error deleting category:', error);
            showToast('Error deleting category: ' + error.message, 'error');
        }
    }

    // Method to get categories for dropdowns in other components
    async getCategoriesForDropdown() {
        try {
            const categories = await inventoryDB.getAllCategories();
            return categories.map(category => ({
                value: category.code,
                text: category.name,
                color: category.color || '#6c757d' // Default color if none specified
            }));
        } catch (error) {
            console.error('Error getting categories for dropdown:', error);
            return [];
        }
    }

    // Method to refresh category data (called from other components)
    async refresh() {
        await this.loadCategories();
    }
}

// Create global categories manager instance
const categoriesManager = new CategoriesManager();