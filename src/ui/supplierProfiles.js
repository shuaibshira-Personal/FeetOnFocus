/**
 * Supplier Profile Management
 * Handles creation and management of supplier-specific invoice parsing profiles
 */

class SupplierProfilesManager {
    constructor() {
        this.profiles = [];
        this.currentProfile = null;
    }

    async init() {
        this.setupEventListeners();
        await this.loadProfiles();
    }

    setupEventListeners() {
        // Manage Profiles button
        const manageProfilesBtn = document.getElementById('manageSupplierProfilesBtn');
        if (manageProfilesBtn) {
            manageProfilesBtn.addEventListener('click', () => {
                this.showManageProfilesModal();
            });
        }

        // Create profile button
        document.getElementById('createProfileBtn').addEventListener('click', () => {
            this.showCreateProfileModal();
        });

        // Save profile button
        document.getElementById('saveProfileBtn').addEventListener('click', () => {
            this.saveProfile();
        });

        // Edit and delete profile buttons (delegated)
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('edit-profile-btn')) {
                const profileId = e.target.getAttribute('data-profile-id');
                this.editProfile(profileId);
            }
            if (e.target.classList.contains('delete-profile-btn')) {
                const profileId = e.target.getAttribute('data-profile-id');
                this.deleteProfile(profileId);
            }
            if (e.target.classList.contains('test-profile-btn')) {
                const profileId = e.target.getAttribute('data-profile-id');
                this.testProfile(profileId);
            }
        });
    }

    async loadProfiles() {
        try {
            // For now, load from localStorage
            // In a real implementation, this would be from the database
            const stored = localStorage.getItem('supplierProfiles');
            this.profiles = stored ? JSON.parse(stored) : this.getDefaultProfiles();
            
            if (this.profiles.length === 0) {
                this.profiles = this.getDefaultProfiles();
                await this.saveProfiles();
            }
        } catch (error) {
            console.error('Error loading supplier profiles:', error);
            this.profiles = this.getDefaultProfiles();
        }
    }

    async saveProfiles() {
        try {
            localStorage.setItem('supplierProfiles', JSON.stringify(this.profiles));
        } catch (error) {
            console.error('Error saving supplier profiles:', error);
        }
    }

    getDefaultProfiles() {
        return [
            {
                id: 'medis_default',
                name: 'Medis (PTY) LTD - Default',
                supplierCode: 'medis',
                supplierName: 'MEDIS (PTY) LTD',
                identifier: 'MEDIS\\s*\\(PTY\\)\\s*LTD',
                taxRate: 15,
                currency: 'ZAR',
                isDefault: true,
                pattern: '^([A-Z0-9-]+)\\s+(.+?)\\s+(\\d+(?:\\.\\d{2})?)\\s+x\\s*(\\d+)\\s+(\\d+(?:\\.\\d{2})?)\\s+(\\d+(?:\\.\\d{1,2}))\\s+R(\\d+(?:\\.\\d{1,2}))\\s+R(\\d+(?:\\.\\d{2})?)$',
                fields: {
                    code: { group: 1, name: 'Product Code' },
                    description: { group: 2, name: 'Description' },
                    quantity: { group: 3, name: 'Quantity' },
                    unit: { group: 4, name: 'Unit Multiplier' },
                    unitPrice: { group: 5, name: 'Unit Price' },
                    discountPercent: { group: 6, name: 'Discount %' },
                    netUnitPrice: { group: 7, name: 'Net Unit Price' },
                    totalPrice: { group: 8, name: 'Total Price' }
                },
                sampleLine: 'F-00042-47B    Met & Bunion Protector Sleeve Size L    4.00    x 1    300.33    25.0    R225.25    R900.99'
            }
        ];
    }

    showManageProfilesModal() {
        const modal = new bootstrap.Modal(document.getElementById('supplierProfilesModal'));
        this.renderProfilesList();
        modal.show();
    }

    renderProfilesList() {
        const container = document.getElementById('profilesList');
        
        if (this.profiles.length === 0) {
            container.innerHTML = '<p class="text-muted">No profiles configured</p>';
            return;
        }

        const profilesHtml = this.profiles.map(profile => `
            <div class="card mb-3">
                <div class="card-header d-flex justify-content-between align-items-center">
                    <h6 class="mb-0">
                        <i class="fas fa-cog me-2"></i>${profile.name}
                        ${profile.isDefault ? '<span class="badge bg-primary ms-2">Default</span>' : ''}
                    </h6>
                    <div class="btn-group btn-group-sm">
                        <button class="btn btn-outline-info test-profile-btn" data-profile-id="${profile.id}" title="Test Pattern">
                            <i class="fas fa-vial"></i>
                        </button>
                        ${!profile.isDefault ? `
                            <button class="btn btn-outline-warning edit-profile-btn" data-profile-id="${profile.id}" title="Edit">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn btn-outline-danger delete-profile-btn" data-profile-id="${profile.id}" title="Delete">
                                <i class="fas fa-trash"></i>
                            </button>
                        ` : ''}
                    </div>
                </div>
                <div class="card-body">
                    <div class="row">
                        <div class="col-md-6">
                            <small><strong>Supplier:</strong> ${profile.supplierName}</small><br>
                            <small><strong>Currency:</strong> ${profile.currency}</small><br>
                            <small><strong>Tax Rate:</strong> ${profile.taxRate}%</small>
                        </div>
                        <div class="col-md-6">
                            <small><strong>Pattern:</strong></small><br>
                            <code class="small">${profile.pattern.substring(0, 50)}${profile.pattern.length > 50 ? '...' : ''}</code>
                        </div>
                    </div>
                    ${profile.sampleLine ? `
                        <div class="mt-2">
                            <small><strong>Sample Line:</strong></small><br>
                            <code class="small text-muted">${profile.sampleLine}</code>
                        </div>
                    ` : ''}
                </div>
            </div>
        `).join('');

        container.innerHTML = profilesHtml;
    }

    showCreateProfileModal() {
        this.currentProfile = null;
        const form = document.getElementById('profileForm');
        form.reset();
        
        // Populate supplier dropdown
        this.populateSupplierDropdown();
        
        const modal = new bootstrap.Modal(document.getElementById('createProfileModal'));
        modal.show();
    }

    async populateSupplierDropdown() {
        const select = document.getElementById('profileSupplierCode');
        select.innerHTML = '<option value="">Select Supplier</option>';
        
        try {
            const suppliers = await inventoryDB.getAllSuppliers();
            suppliers.forEach(supplier => {
                const option = document.createElement('option');
                option.value = supplier.code;
                option.textContent = supplier.name;
                select.appendChild(option);
            });
        } catch (error) {
            console.error('Error loading suppliers:', error);
        }
    }

    async saveProfile() {
        const form = document.getElementById('profileForm');
        
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        try {
            const formData = new FormData(form);
            const profileData = {
                id: this.currentProfile?.id || 'profile_' + Date.now(),
                name: formData.get('profileName'),
                supplierCode: formData.get('profileSupplierCode'),
                supplierName: formData.get('profileSupplierName'),
                identifier: formData.get('profileIdentifier'),
                taxRate: parseFloat(formData.get('profileTaxRate')) || 15,
                currency: formData.get('profileCurrency'),
                pattern: formData.get('profilePattern'),
                sampleLine: formData.get('profileSampleLine'),
                fields: this.parseFieldMappings(formData.get('profileFields')),
                isDefault: false
            };

            // Validate regex pattern
            try {
                new RegExp(profileData.pattern, 'gm');
            } catch (error) {
                showToast('Invalid regex pattern: ' + error.message, 'error');
                return;
            }

            if (this.currentProfile) {
                // Update existing
                const index = this.profiles.findIndex(p => p.id === this.currentProfile.id);
                if (index !== -1) {
                    this.profiles[index] = profileData;
                }
            } else {
                // Add new
                this.profiles.push(profileData);
            }

            await this.saveProfiles();
            
            // Close modal
            bootstrap.Modal.getInstance(document.getElementById('createProfileModal')).hide();
            
            // Refresh list
            this.renderProfilesList();
            
            showToast('Profile saved successfully', 'success');
            
        } catch (error) {
            console.error('Error saving profile:', error);
            showToast('Error saving profile: ' + error.message, 'error');
        }
    }

    parseFieldMappings(fieldsJson) {
        try {
            return JSON.parse(fieldsJson || '{}');
        } catch (error) {
            console.warn('Invalid field mappings JSON, using default');
            return {};
        }
    }

    editProfile(profileId) {
        const profile = this.profiles.find(p => p.id === profileId);
        if (!profile) {
            showToast('Profile not found', 'error');
            return;
        }

        this.currentProfile = profile;
        
        // Populate form
        document.getElementById('profileName').value = profile.name;
        document.getElementById('profileSupplierCode').value = profile.supplierCode;
        document.getElementById('profileSupplierName').value = profile.supplierName;
        document.getElementById('profileIdentifier').value = profile.identifier;
        document.getElementById('profileTaxRate').value = profile.taxRate;
        document.getElementById('profileCurrency').value = profile.currency;
        document.getElementById('profilePattern').value = profile.pattern;
        document.getElementById('profileSampleLine').value = profile.sampleLine || '';
        document.getElementById('profileFields').value = JSON.stringify(profile.fields, null, 2);

        const modal = new bootstrap.Modal(document.getElementById('createProfileModal'));
        modal.show();
    }

    async deleteProfile(profileId) {
        const profile = this.profiles.find(p => p.id === profileId);
        if (!profile) {
            showToast('Profile not found', 'error');
            return;
        }

        if (profile.isDefault) {
            showToast('Cannot delete default profile', 'warning');
            return;
        }

        if (!confirm(`Are you sure you want to delete the profile "${profile.name}"?`)) {
            return;
        }

        try {
            this.profiles = this.profiles.filter(p => p.id !== profileId);
            await this.saveProfiles();
            this.renderProfilesList();
            showToast('Profile deleted successfully', 'success');
        } catch (error) {
            console.error('Error deleting profile:', error);
            showToast('Error deleting profile: ' + error.message, 'error');
        }
    }

    testProfile(profileId) {
        const profile = this.profiles.find(p => p.id === profileId);
        if (!profile) {
            showToast('Profile not found', 'error');
            return;
        }

        // Show test modal with results
        this.showTestResults(profile);
    }

    showTestResults(profile) {
        const modal = document.getElementById('testProfileModal');
        
        // Update modal content
        document.getElementById('testProfileName').textContent = profile.name;
        
        try {
            const regex = new RegExp(profile.pattern, 'gm');
            const testLine = profile.sampleLine || '';
            
            let resultsHtml = '';
            
            if (!testLine) {
                resultsHtml = '<div class="alert alert-warning">No sample line provided for testing</div>';
            } else {
                const match = regex.exec(testLine);
                
                if (match) {
                    resultsHtml = `
                        <div class="alert alert-success">
                            <i class="fas fa-check-circle me-2"></i>Pattern matches successfully!
                        </div>
                        <h6>Extracted Groups:</h6>
                        <div class="table-responsive">
                            <table class="table table-sm">
                                <thead>
                                    <tr>
                                        <th>Group</th>
                                        <th>Field</th>
                                        <th>Value</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${Object.entries(profile.fields).map(([fieldName, config]) => `
                                        <tr>
                                            <td>${config.group}</td>
                                            <td>${config.name}</td>
                                            <td><code>${match[config.group] || 'N/A'}</code></td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    `;
                } else {
                    resultsHtml = `
                        <div class="alert alert-danger">
                            <i class="fas fa-times-circle me-2"></i>Pattern does not match the sample line
                        </div>
                        <p><strong>Pattern:</strong> <code>${profile.pattern}</code></p>
                        <p><strong>Sample Line:</strong> <code>${testLine}</code></p>
                    `;
                }
            }
            
            document.getElementById('testResults').innerHTML = resultsHtml;
            
        } catch (error) {
            document.getElementById('testResults').innerHTML = `
                <div class="alert alert-danger">
                    <i class="fas fa-exclamation-triangle me-2"></i>
                    Regex Error: ${error.message}
                </div>
            `;
        }
        
        const bsModal = new bootstrap.Modal(modal);
        bsModal.show();
    }

    // Method to get profile for a supplier
    getProfileForSupplier(supplierCode) {
        return this.profiles.find(profile => profile.supplierCode === supplierCode) || null;
    }

    // Method to update invoice processor with current profiles
    updateInvoiceProcessor() {
        if (window.invoiceProcessor) {
            // Update the processor's supplier patterns
            const patterns = {};
            
            this.profiles.forEach(profile => {
                patterns[profile.supplierCode] = {
                    name: profile.supplierName,
                    identifier: new RegExp(profile.identifier, 'i'),
                    code: profile.supplierCode,
                    taxRate: profile.taxRate / 100,
                    currency: profile.currency,
                    patterns: {
                        invoiceNumber: /(?:Document No|Invoice No|Invoice)\s*:?\s*([A-Z0-9-]+)/i,
                        date: /(\d{1,2}\/\d{1,2}\/\d{2,4})/,
                        lineItems: {
                            pattern: new RegExp(profile.pattern, 'gm'),
                            groups: profile.fields,
                            validation: {
                                quantityCheck: (q, u) => q > 0 && q <= 10000 && u > 0,
                                priceCheck: (price) => price > 0 && price < 100000,
                                discountCheck: (discount) => discount >= 0 && discount <= 100,
                                totalCheck: (qty, unitPrice, discount, total) => {
                                    const expectedSubtotal = qty * unitPrice;
                                    const expectedDiscount = expectedSubtotal * (discount / 100);
                                    const expectedTotal = expectedSubtotal - expectedDiscount;
                                    const tolerance = Math.max(expectedTotal * 0.05, 1);
                                    return Math.abs(total - expectedTotal) <= tolerance;
                                }
                            }
                        }
                    }
                };
            });

            invoiceProcessor.supplierPatterns = patterns;
            console.log('Invoice processor updated with profiles:', Object.keys(patterns));
        }
    }
}

// Create global instance
const supplierProfilesManager = new SupplierProfilesManager();