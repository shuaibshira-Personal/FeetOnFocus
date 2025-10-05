/**
 * FeetOnFocus Main Application
 */

class FeetOnFocusApp {
    constructor() {
        this.currentTab = 'dashboard';
        this.initialized = false;
    }

    async init() {
        try {
            console.log('Starting FeetOnFocus initialization...');
            
            // Show loading
            this.showAppLoading();
            console.log('Loading screen displayed');
            
            // Check if required modules are available
            const requiredModules = {
                inventoryDB,
                dashboard,
                itemsManager,
                suppliersManager,
                categoriesManager,
                dataManager,
                reportsManager,
                purchaseManager,
                stockManager,
                bulkImportManager
            };
            
            console.log('Checking required modules...');
            for (const [name, module] of Object.entries(requiredModules)) {
                if (!module) {
                    throw new Error(`Required module '${name}' is not available`);
                }
                console.log(`✓ Module '${name}' is available`);
            }
            
            // Initialize database
            console.log('Initializing database...');
            await inventoryDB.init();
            console.log('✓ Database initialized successfully');
            
            // Create automatic backup after successful initialization
            try {
                console.log('Creating automatic backup...');
                await inventoryDB.createAutoBackup();
                console.log('✓ Automatic backup created');
            } catch (error) {
                console.log('Auto-backup creation failed (this is normal on first run):', error.message);
            }
            
            // Initialize UI modules
            console.log('Initializing UI modules...');
            
            console.log('Initializing dashboard...');
            await dashboard.init();
            console.log('✓ Dashboard initialized');
            
            console.log('Initializing items manager...');
            await itemsManager.init();
            console.log('✓ Items manager initialized');
            
            console.log('Initializing suppliers manager...');
            await suppliersManager.init();
            console.log('✓ Suppliers manager initialized');
            
            console.log('Initializing categories manager...');
            await categoriesManager.init();
            console.log('✓ Categories manager initialized');
            
            console.log('Initializing data manager...');
            await dataManager.init();
            console.log('✓ Data manager initialized');
            
            console.log('Initializing reports manager...');
            await reportsManager.init();
            console.log('✓ Reports manager initialized');
            
            console.log('Initializing purchase manager...');
            await purchaseManager.init();
            console.log('✓ Purchase manager initialized');
            
            console.log('Initializing stock manager...');
            await stockManager.init();
            console.log('✓ Stock manager initialized');
            
            console.log('Initializing bulk import manager...');
            await bulkImportManager.init();
            console.log('✓ Bulk import manager initialized');
            
            // Setup navigation
            console.log('Setting up navigation...');
            this.setupNavigation();
            console.log('✓ Navigation setup complete');
            
            // Load initial tab
            console.log('Loading initial dashboard tab...');
            this.showTab('dashboard');
            console.log('✓ Dashboard tab loaded');
            
            this.initialized = true;
            this.hideAppLoading();
            
            console.log('✅ FeetOnFocus application initialized successfully');
            
            // Set up periodic auto backup every 15 minutes
            this.setupPeriodicAutoBackup();
            
            // Debug: Check suppliers after initialization
            setTimeout(async () => {
                try {
                    const suppliers = await inventoryDB.getAllSuppliers();
                    console.log('Debug - Suppliers in database after init:', suppliers);
                } catch (error) {
                    console.error('Debug - Error getting suppliers:', error);
                }
            }, 2000);
            
        } catch (error) {
            console.error('Error initializing application:', error);
            this.showError('Failed to initialize application. Please refresh the page.');
        }
    }

    setupNavigation() {
        // Navbar brand (logo and name) - return to dashboard
        const navbarBrand = document.querySelector('.navbar-brand');
        if (navbarBrand) {
            navbarBrand.style.cursor = 'pointer';
            navbarBrand.addEventListener('click', (e) => {
                e.preventDefault();
                this.showTab('dashboard');
            });
        }
        
        // Main navigation tabs
        const tabButtons = document.querySelectorAll('.nav-link:not(.dropdown-toggle)');
        tabButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                const tabId = button.id.replace('Tab', '');
                this.showTab(tabId);
            });
        });
        
        // Inventory dropdown items
        const inventoryTabs = ['resellingTab', 'consumablesTab', 'officeEquipmentTab', 'allItemsTab'];
        inventoryTabs.forEach(tabId => {
            document.getElementById(tabId).addEventListener('click', (e) => {
                e.preventDefault();
                
                // Remove active class from all inventory dropdown items
                inventoryTabs.forEach(id => {
                    document.getElementById(id).classList.remove('active');
                });
                
                // Add active class to clicked item
                document.getElementById(tabId).classList.add('active');
                
                const contentId = tabId.replace('Tab', '');
                this.showTab(contentId);
            });
        });
    }

    showTab(tabId) {
        // Update active tab
        this.currentTab = tabId;
        
        // Update navigation
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
        });
        document.getElementById(tabId + 'Tab').classList.add('active');
        
        // Update content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.add('d-none');
        });
        document.getElementById(tabId + 'Content').classList.remove('d-none');
        
        // Load tab-specific content
        this.loadTabContent(tabId);
    }

    async loadTabContent(tabId) {
        try {
            switch (tabId) {
                case 'dashboard':
                    await dashboard.loadDashboard();
                    break;
                case 'reselling':
                    await itemsManager.loadItemsByType('reselling');
                    break;
                case 'consumables':
                    await itemsManager.loadItemsByType('consumable');
                    break;
                case 'officeEquipment':
                    await itemsManager.loadItemsByType('office_equipment');
                    break;
                case 'allItems':
                    await itemsManager.loadItems();
                    break;
                case 'invoices':
                    // Future implementation for Phase 2
                    break;
                case 'reports':
                    // Reports are initialized when the manager is created
                    break;
            }
        } catch (error) {
            console.error(`Error loading ${tabId} content:`, error);
            showToast(`Error loading ${tabId} content`, 'error');
        }
    }

    showAppLoading() {
        const loadingHtml = `
            <div id="appLoading" class="d-flex justify-content-center align-items-center position-fixed w-100 h-100" 
                 style="top: 0; left: 0; background: rgba(255,255,255,0.9); z-index: 9999;">
                <div class="text-center">
                    <div class="spinner-border spinner-border-lg text-primary" role="status">
                        <span class="visually-hidden">Loading...</span>
                    </div>
                    <div class="mt-3">
                        <h5>Initializing FeetOnFocus...</h5>
                        <p class="text-muted">Setting up your inventory management system</p>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', loadingHtml);
    }

    hideAppLoading() {
        const loading = document.getElementById('appLoading');
        if (loading) {
            loading.remove();
        }
    }

    showError(message) {
        this.hideAppLoading();
        
        const errorHtml = `
            <div class="container mt-5">
                <div class="row justify-content-center">
                    <div class="col-md-6">
                        <div class="alert alert-danger text-center">
                            <h4><i class="fas fa-exclamation-triangle"></i> Application Error</h4>
                            <p>${message}</p>
                            <button class="btn btn-primary" onclick="location.reload()">
                                <i class="fas fa-refresh"></i> Reload Application
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.innerHTML = errorHtml;
    }

    // Utility methods for other parts of the application
    getCurrentTab() {
        return this.currentTab;
    }

    isInitialized() {
        return this.initialized;
    }

    async refreshCurrentTab() {
        if (this.initialized) {
            await this.loadTabContent(this.currentTab);
        }
    }

    /**
     * Set up periodic auto backup every 15 minutes
     */
    setupPeriodicAutoBackup() {
        // Create auto backup every 15 minutes (15 * 60 * 1000 = 900000 ms)
        this.autoBackupInterval = setInterval(async () => {
            if (this.initialized) {
                try {
                    console.log('🔄 Running scheduled auto backup...');
                    const backupKey = await inventoryDB.createAutoBackup();
                    console.log('✅ Scheduled auto backup completed:', backupKey);
                    
                    // Show a very subtle notification only in console - no toast to avoid interruption
                } catch (error) {
                    console.error('❌ Scheduled auto backup failed:', error);
                    // Don't show error toast to avoid interrupting user workflow
                }
            }
        }, 15 * 60 * 1000); // 15 minutes
        
        // Set up daily file export (every 4 hours, but only creates one per day)
        this.dailyExportInterval = setInterval(async () => {
            if (this.initialized) {
                try {
                    console.log('📁 Checking for daily file export...');
                    const fileName = await inventoryDB.createDailyFileExport();
                    if (fileName) {
                        console.log('✅ Daily file export completed:', fileName);
                    }
                } catch (error) {
                    console.error('❌ Daily file export failed:', error);
                }
            }
        }, 4 * 60 * 60 * 1000); // Every 4 hours (but only exports once per day)
        
        console.log('⏰ Periodic auto backup set up (every 15 minutes)');
        console.log('📁 Daily file export set up (checked every 4 hours)');
        
        // Also run first backup after 1 minute (to avoid overwhelming on startup)
        setTimeout(async () => {
            if (this.initialized) {
                try {
                    console.log('🔄 Running initial scheduled auto backup...');
                    await inventoryDB.createAutoBackup();
                    console.log('✅ Initial scheduled auto backup completed');
                } catch (error) {
                    console.error('❌ Initial scheduled auto backup failed:', error);
                }
            }
        }, 60 * 1000); // 1 minute after startup
        
        // Run initial daily export check after 2 minutes
        setTimeout(async () => {
            if (this.initialized) {
                try {
                    console.log('📁 Running initial daily export check...');
                    const fileName = await inventoryDB.createDailyFileExport();
                    if (fileName) {
                        console.log('✅ Initial daily file export completed:', fileName);
                    }
                } catch (error) {
                    console.error('❌ Initial daily file export failed:', error);
                }
            }
        }, 2 * 60 * 1000); // 2 minutes after startup
    }

    /**
     * Clean up intervals when app is destroyed
     */
    destroy() {
        if (this.autoBackupInterval) {
            clearInterval(this.autoBackupInterval);
            console.log('🛑 Periodic auto backup stopped');
        }
        if (this.dailyExportInterval) {
            clearInterval(this.dailyExportInterval);
            console.log('🛑 Daily file export stopped');
        }
    }
}

// Global app instance
const app = new FeetOnFocusApp();

// Initialize application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    app.init();
});

// Handle page visibility changes (refresh data when user returns to tab)
document.addEventListener('visibilitychange', () => {
    if (!document.hidden && app.isInitialized()) {
        setTimeout(() => {
            app.refreshCurrentTab();
        }, 1000);
    }
});

// Global error handler
window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
    
    if (event.error && event.error.message && event.error.message.includes('Failed to open database')) {
        showToast('Database error. Your browser may not support IndexedDB or storage may be full.', 'error');
    }
});

// Handle unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    
    if (event.reason && typeof event.reason === 'string' && event.reason.includes('database')) {
        showToast('Database operation failed. Please try again.', 'error');
    }
    
    // Prevent the default browser error handling
    event.preventDefault();
});

// Clean up intervals when page is unloaded
window.addEventListener('beforeunload', () => {
    if (app && typeof app.destroy === 'function') {
        app.destroy();
    }
});
