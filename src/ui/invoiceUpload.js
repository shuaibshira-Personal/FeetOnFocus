/**
 * Invoice Upload Management UI
 * Handles invoice file uploads, processing, and line item matching
 */

class InvoiceUploadManager {
    constructor() {
        this.currentInvoice = null;
        this.processedData = null;
        this.suppliers = [];
        this.allItems = [];
        this.currentStep = 1;
    }

    async init() {
        this.setupEventListeners();
        await this.loadSuppliers();
    }

    setupEventListeners() {
        // Upload Invoice button (main trigger)
        const uploadInvoiceBtn = document.getElementById('uploadInvoiceBtn');
        if (uploadInvoiceBtn) {
            uploadInvoiceBtn.addEventListener('click', () => {
                this.showUploadInvoiceModal();
            });
        }

        // File input change handler
        document.getElementById('invoiceFileInput').addEventListener('change', (e) => {
            this.handleFileSelection(e);
        });

        // Supplier selection change
        document.getElementById('invoiceSupplierSelect').addEventListener('change', (e) => {
            this.handleSupplierChange(e);
        });

        // Process invoice button
        document.getElementById('processInvoiceBtn').addEventListener('click', () => {
            this.processInvoiceFile();
        });

        // Review and confirm buttons
        document.getElementById('confirmProcessingBtn').addEventListener('click', () => {
            this.finalizeInvoiceProcessing();
        });

        document.getElementById('backToUploadBtn').addEventListener('click', () => {
            this.backToUploadStep();
        });

        // Line item action buttons
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('match-item-btn')) {
                const lineItemIndex = parseInt(e.target.getAttribute('data-index'));
                this.showProductMatchModal(lineItemIndex);
            }
            if (e.target.classList.contains('create-item-btn')) {
                const lineItemIndex = parseInt(e.target.getAttribute('data-index'));
                this.showCreateProductModal(lineItemIndex);
            }
            if (e.target.classList.contains('select-match-btn')) {
                const lineItemIndex = parseInt(e.target.getAttribute('data-line-index'));
                const productId = parseInt(e.target.getAttribute('data-product-id'));
                this.selectProductMatch(lineItemIndex, productId);
            }
        });

        // Save new product button
        document.getElementById('saveNewProductBtn').addEventListener('click', () => {
            this.saveNewProduct();
        });
    }

    async loadSuppliers() {
        try {
            this.suppliers = await inventoryDB.getAllSuppliers();
            this.populateSupplierSelect();
        } catch (error) {
            console.error('Error loading suppliers:', error);
            showToast('Error loading suppliers', 'error');
        }
    }

    populateSupplierSelect() {
        const select = document.getElementById('invoiceSupplierSelect');
        select.innerHTML = '<option value="">🔍 Auto-detect from invoice</option>';
        
        this.suppliers.forEach(supplier => {
            const option = document.createElement('option');
            option.value = supplier.code;
            option.textContent = supplier.name;
            select.appendChild(option);
        });
    }

    showUploadInvoiceModal() {
        // Reset modal state
        this.currentStep = 1;
        this.currentInvoice = null;
        this.processedData = null;
        
        // Reset form
        document.getElementById('invoiceUploadForm').reset();
        document.getElementById('filePreview').innerHTML = '';
        document.getElementById('processingResults').innerHTML = '';
        
        // Show upload step, hide review step
        document.getElementById('uploadStep').style.display = 'block';
        document.getElementById('reviewStep').style.display = 'none';
        
        // Show modal
        const modal = new bootstrap.Modal(document.getElementById('invoiceUploadModal'));
        modal.show();
    }

    async handleFileSelection(event) {
        const file = event.target.files[0];
        if (!file) return;

        // Validate file type
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'application/pdf'];
        if (!allowedTypes.includes(file.type)) {
            showToast('Please select an image (JPG, PNG, GIF) or PDF file', 'error');
            event.target.value = '';
            return;
        }

        // Validate file size (max 10MB)
        const maxSize = 10 * 1024 * 1024; // 10MB
        if (file.size > maxSize) {
            showToast('File size must be less than 10MB', 'error');
            event.target.value = '';
            return;
        }

        // Show file preview
        this.showFilePreview(file);
        
        // Enable process button
        document.getElementById('processInvoiceBtn').disabled = false;
    }
    
    showProcessingProgress(message, percentage) {
        const btn = document.getElementById('processInvoiceBtn');
        btn.innerHTML = `
            <div class="d-flex align-items-center">
                <div class="spinner-border spinner-border-sm me-2"></div>
                <div class="flex-grow-1">
                    <div class="small">${message}</div>
                    <div class="progress" style="height: 4px; width: 150px;">
                        <div class="progress-bar" style="width: ${percentage}%"></div>
                    </div>
                </div>
            </div>
        `;
    }
    
    hideProcessingProgress() {
        // This will be reset in the finally block
    }

    showFilePreview(file) {
        const preview = document.getElementById('filePreview');
        
        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                preview.innerHTML = `
                    <div class="text-center">
                        <img src="${e.target.result}" 
                             alt="Invoice Preview" 
                             class="img-thumbnail" 
                             style="max-width: 300px; max-height: 200px;">
                        <div class="mt-2">
                            <small class="text-muted">
                                ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)
                            </small>
                        </div>
                    </div>
                `;
            };
            reader.readAsDataURL(file);
        } else if (file.type === 'application/pdf') {
            preview.innerHTML = `
                <div class="text-center">
                    <i class="fas fa-file-pdf fa-4x text-danger mb-3"></i>
                    <div>
                        <strong>${file.name}</strong>
                        <br>
                        <small class="text-muted">
                            PDF Document (${(file.size / 1024 / 1024).toFixed(2)} MB)
                        </small>
                    </div>
                </div>
            `;
        }
    }

    handleSupplierChange(event) {
        const selectedSupplier = event.target.value;
        // Store selected supplier for processing
        this.selectedSupplier = selectedSupplier;
    }

    async processInvoiceFile() {
        const fileInput = document.getElementById('invoiceFileInput');
        const file = fileInput.files[0];
        
        if (!file) {
            showToast('Please select a file to process', 'error');
            return;
        }

        try {
            // Show enhanced processing indicator
            document.getElementById('processInvoiceBtn').disabled = true;
            this.showProcessingProgress('Analyzing file...', 0);
            
            // Add progress tracking for different file types
            let progressText = '';
            if (file.type === 'application/pdf') {
                progressText = 'Extracting text from PDF...';
            } else if (file.type.startsWith('image/')) {
                progressText = 'Performing OCR on image...';
            } else {
                progressText = 'Processing file...';
            }
            
            this.showProcessingProgress(progressText, 20);
            
            // Process the invoice using the invoice processor
            this.processedData = await invoiceProcessor.processInvoice(file, this.selectedSupplier);
            
            this.showProcessingProgress('Processing line items with AI...', 80);
            
            if (this.processedData.success) {
                // Check if training is needed
                if (this.processedData.needsTraining) {
                    console.log('📚 New supplier needs training');
                    this.showTrainingModal();
                    return;
                }
                
                this.showProcessingProgress('Saving invoice data...', 95);
                
                // Save the invoice document to database
                const invoiceDocData = {
                    type: 'purchase',
                    supplier: this.processedData.supplier,
                    fileName: file.name,
                    fileSize: file.size,
                    fileType: file.type,
                    invoiceNumber: this.processedData.invoice?.invoiceNumber || null,
                    date: this.processedData.invoice?.date || null,
                    totalAmount: this.processedData.invoice?.totalAmount || null,
                    rawText: this.processedData.rawText,
                    lineItemsCount: this.processedData.lineItems?.length || 0
                };

                this.currentInvoice = await inventoryDB.saveInvoiceDocument(invoiceDocData);
                
                this.showProcessingProgress('Complete!', 100);
                
                // Move to review step
                setTimeout(() => {
                    this.showReviewStep();
                    showToast(`✅ Invoice processed! Found ${this.processedData.lineItems.length} line items using real text extraction`, 'success');
                }, 500);
                
            } else {
                showToast('Error processing invoice: ' + this.processedData.error, 'error');
            }
            
        } catch (error) {
            console.error('Error processing invoice:', error);
            showToast('Error processing invoice: ' + error.message, 'error');
        } finally {
            // Reset button
            this.hideProcessingProgress();
            document.getElementById('processInvoiceBtn').disabled = false;
            document.getElementById('processInvoiceBtn').innerHTML = 
                '<i class="fas fa-cogs me-2"></i>Process Invoice';
        }
    }

    showReviewStep() {
        // Hide upload step, show review step
        document.getElementById('uploadStep').style.display = 'none';
        document.getElementById('reviewStep').style.display = 'block';
        
        // Switch footer buttons
        document.getElementById('uploadStepFooter').style.display = 'none';
        document.getElementById('reviewStepFooter').style.display = 'flex';
        
        // Update modal title
        document.querySelector('#invoiceUploadModal .modal-title').textContent = 'Review Invoice Line Items';
        
        // Render processing results
        this.renderProcessingResults();
        this.renderLineItemsReview();
        
        this.currentStep = 2;
    }

    renderProcessingResults() {
        const container = document.getElementById('processingResults');
        const data = this.processedData;
        
        const supplierInfo = this.suppliers.find(s => s.code === data.supplier);
        const supplierName = supplierInfo ? supplierInfo.name : data.supplier;
        const supplierColor = supplierInfo ? supplierInfo.color : '#6c757d';
        
        // Calculate line item totals for reconciliation
        // Handle different data structures from Vision AI vs Learned Algorithm
        const lineItemTotalExclTax = data.lineItems.reduce((sum, item) => {
            if (item.source === 'gemini-vision' || item.source === 'Gemini Vision') {
                // For Vision AI items, use netTotal (calculated excluding tax)
                return sum + (item.netTotal || item.totalPrice || 0);
            } else {
                // For learned algorithm items
                return sum + (item.netTotal || 0);
            }
        }, 0);
        
        const lineItemTotalInclTax = data.lineItems.reduce((sum, item) => {
            if (item.source === 'gemini-vision' || item.source === 'Gemini Vision') {
                // For Vision AI items, use netTotalInclTax (calculated including tax)
                return sum + (item.netTotalInclTax || item.calculatedTotal || 0);
            } else {
                // For learned algorithm items
                return sum + (item.netTotalInclTax || item.calculatedTotal || item.totalPrice || 0);
            }
        }, 0);
        
        // Calculate tax amount
        const invoiceTaxAmount = data.invoice?.taxAmount || 0;
        const calculatedTax = lineItemTotalInclTax - lineItemTotalExclTax;
        
        container.innerHTML = `
            <div class="row g-3">
                <div class="col-md-6">
                    <div class="card">
                        <div class="card-body">
                            <h6 class="card-title"><i class="fas fa-file-invoice me-2"></i>Invoice Details</h6>
                            <table class="table table-sm table-borderless">
                                <tr>
                                    <td><strong>Supplier:</strong></td>
                                    <td>
                                        <span class="badge" style="background-color: ${supplierColor}; color: white;">
                                            ${supplierName}
                                        </span>
                                    </td>
                                </tr>
                                <tr>
                                    <td><strong>Invoice #:</strong></td>
                                    <td>${data.invoice.invoiceNumber || 'Not detected'}</td>
                                </tr>
                                <tr>
                                    <td><strong>Date:</strong></td>
                                    <td>${data.invoice.date ? formatDate(data.invoice.date) : 'Not detected'}</td>
                                </tr>
                                <tr>
                                    <td><strong>Invoice Total:</strong></td>
                                    <td>
                                        <div>${data.invoice.totalAmount ? formatCurrency(data.invoice.totalAmount) : 'Not detected'}</div>
                                        <div class="small text-muted">Line Items Total: ${formatCurrency(lineItemTotalInclTax)}</div>
                                        ${Math.abs((data.invoice.totalAmount || 0) - lineItemTotalInclTax) > 10 ? 
                                            `<div class="small text-warning">⚠️ Difference: ${formatCurrency(Math.abs((data.invoice.totalAmount || 0) - lineItemTotalInclTax))}</div>` : 
                                            '<div class="small text-success">✅ Totals match</div>'
                                        }
                                    </td>
                                </tr>
                                <tr>
                                    <td><strong>Excl Tax Total:</strong></td>
                                    <td>
                                        <div>${formatCurrency(data.invoice.totalExcludingTax || lineItemTotalExclTax)}</div>
                                        <div class="small text-muted">Line Items Excl Tax: ${formatCurrency(lineItemTotalExclTax)}</div>
                                    </td>
                                </tr>
                                <tr>
                                    <td><strong>Tax Amount:</strong></td>
                                    <td>
                                        <div>${formatCurrency(invoiceTaxAmount || calculatedTax)}</div>
                                        <div class="small text-muted">${invoiceTaxAmount ? 'From Invoice' : 'Calculated (15%)'}</div>
                                    </td>
                                </tr>
                            </table>
                        </div>
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="card">
                        <div class="card-body">
                            <h6 class="card-title"><i class="fas fa-list me-2"></i>Line Items Summary</h6>
                            <table class="table table-sm table-borderless">
                                <tr>
                                    <td><strong>Total Items:</strong></td>
                                    <td><span class="badge bg-primary">${data.lineItems.length}</span></td>
                                </tr>
                                <tr>
                                    <td><strong>Exact Matches:</strong></td>
                                    <td><span class="badge bg-success">${data.lineItems.filter(item => item.matchScore >= 1.0).length}</span></td>
                                </tr>
                                <tr>
                                    <td><strong>Similar Matches:</strong></td>
                                    <td><span class="badge bg-warning text-dark">${data.lineItems.filter(item => item.matchScore > 0.3 && item.matchScore < 1.0).length}</span></td>
                                </tr>
                                <tr>
                                    <td><strong>New Products:</strong></td>
                                    <td><span class="badge bg-info">${data.lineItems.filter(item => item.isNewProduct).length}</span></td>
                                </tr>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    renderLineItemsReview() {
        const container = document.getElementById('lineItemsReview');
        
        if (!this.processedData.lineItems.length) {
            container.innerHTML = `
                <div class="alert alert-warning">
                    <i class="fas fa-exclamation-triangle me-2"></i>
                    No line items were detected in the invoice. Please check the file quality or try a different format.
                </div>
            `;
            return;
        }

        const itemsHtml = this.processedData.lineItems.map((item, index) => {
            return this.renderLineItemCard(item, index);
        }).join('');

        container.innerHTML = `
            <div class="row">
                ${itemsHtml}
            </div>
        `;
    }

    renderLineItemCard(item, index) {
        let statusBadge, statusClass, actionButtons;

        if (item.matchScore >= 1.0) {
            statusBadge = '<span class="badge bg-success">Exact Match</span>';
            statusClass = 'border-success';
            actionButtons = `
                <button type="button" class="btn btn-outline-primary btn-sm match-item-btn" data-index="${index}">
                    <i class="fas fa-search me-1"></i>Change Match
                </button>
            `;
        } else if (item.matchScore > 0.3) {
            statusBadge = '<span class="badge bg-warning text-dark">Similar Match</span>';
            statusClass = 'border-warning';
            actionButtons = `
                <button type="button" class="btn btn-outline-primary btn-sm match-item-btn" data-index="${index}">
                    <i class="fas fa-search me-1"></i>Review Match
                </button>
                <button type="button" class="btn btn-outline-success btn-sm create-item-btn" data-index="${index}">
                    <i class="fas fa-plus me-1"></i>Create New
                </button>
            `;
        } else {
            statusBadge = '<span class="badge bg-info">New Product</span>';
            statusClass = 'border-info';
            actionButtons = `
                <button type="button" class="btn btn-outline-primary btn-sm match-item-btn" data-index="${index}">
                    <i class="fas fa-search me-1"></i>Find Match
                </button>
                <button type="button" class="btn btn-success btn-sm create-item-btn" data-index="${index}">
                    <i class="fas fa-plus me-1"></i>Create New
                </button>
            `;
        }

        const matchedProduct = item.matchedProduct;

        return `
            <div class="col-md-6 mb-3">
                <div class="card ${statusClass}">
                    <div class="card-header d-flex justify-content-between align-items-center">
                        <small class="text-muted">Line Item ${index + 1}</small>
                        ${statusBadge}
                    </div>
                    <div class="card-body">
                        <div class="mb-2">
                            <strong>From Invoice:</strong>
                            <div class="text-muted small">
                                ${item.code ? `<code>${item.code}</code> - ` : ''}
                                ${item.description}
                            </div>
                            <div class="row mt-1 small">
                                <div class="col-6">
                                    <div>Qty: <strong>${item.quantity}</strong></div>
                                    <div>Unit Price (excl): <strong>${formatCurrency(item.unitPriceExclTax || item.unitPrice)}</strong></div>
                                    <div>Unit Price (incl): <strong>${formatCurrency(item.unitPrice)}</strong></div>
                                </div>
                                <div class="col-6">
                                    <div>Subtotal: <strong>${formatCurrency(item.subtotal || (item.unitPriceExclTax || item.unitPrice) * item.quantity)}</strong></div>
                                    ${item.discountPercent ? `<div class="text-warning">Discount: <strong>${item.discountPercent}%</strong> (-${formatCurrency(item.discountAmount || 0)})</div>` : ''}
                                    <div>Net (excl tax): <strong>${formatCurrency(item.netTotal || 0)}</strong></div>
                                    <div class="fw-bold">Net (incl tax): <strong>${formatCurrency(item.netTotalInclTax || item.calculatedTotal || item.totalPrice)}</strong></div>
                                </div>
                            </div>
                            ${item.taxRate ? `<div class="small text-muted mt-1">Tax (${item.taxRate}%): ${formatCurrency(item.taxAmount || 0)}</div>` : ''}
                            ${item.validationErrors && item.validationErrors.length > 0 ? 
                                `<div class="alert alert-warning alert-sm mt-2 p-1">
                                    <small><i class="fas fa-exclamation-triangle me-1"></i>${item.validationErrors.join(', ')}</small>
                                </div>` : ''
                            }
                        </div>
                        
                        ${matchedProduct ? `
                            <div class="mt-2 pt-2 border-top">
                                <strong>Matched Product:</strong>
                                <div class="text-success small">
                                    ${matchedProduct.name}
                                    ${matchedProduct.sku ? `<br><code>${matchedProduct.sku}</code>` : ''}
                                    ${item.matchScore < 1.0 ? `<br><small class="text-warning">Confidence: ${(item.matchScore * 100).toFixed(1)}%</small>` : ''}
                                </div>
                            </div>
                        ` : ''}
                        
                        <div class="mt-3 d-grid gap-2">
                            ${actionButtons}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    showProductMatchModal(lineItemIndex) {
        const item = this.processedData.lineItems[lineItemIndex];
        const modal = document.getElementById('productMatchModal');
        
        // Set modal data
        modal.setAttribute('data-line-index', lineItemIndex);
        
        // Update modal title
        document.querySelector('#productMatchModal .modal-title').textContent = 
            `Find Match: ${item.description}`;
        
        // Render search results
        this.renderProductMatchResults(item);
        
        // Show modal
        const bsModal = new bootstrap.Modal(modal);
        bsModal.show();
    }

    async renderProductMatchResults(item) {
        const container = document.getElementById('matchResults');
        const searchInput = document.getElementById('productSearchInput');
        
        // Set initial search value
        searchInput.value = item.description || '';
        
        // Load all items if not already loaded
        if (!this.allItems.length) {
            try {
                this.allItems = await inventoryDB.getAllItems();
            } catch (error) {
                console.error('Error loading items:', error);
                container.innerHTML = '<div class="alert alert-danger">Error loading products</div>';
                return;
            }
        }
        
        // Show current suggestions first
        this.displayMatchSuggestions(item, container);
        
        // Setup search functionality
        const debouncedSearch = debounce(() => {
            this.searchProducts(searchInput.value, container, parseInt(document.getElementById('productMatchModal').getAttribute('data-line-index')));
        }, 300);
        
        searchInput.oninput = debouncedSearch;
    }

    displayMatchSuggestions(item, container) {
        const suggestions = item.suggestions || [];
        
        if (suggestions.length === 0) {
            container.innerHTML = `
                <div class="alert alert-info">
                    <i class="fas fa-info-circle me-2"></i>
                    No similar products found. Try searching manually or create a new product.
                </div>
            `;
            return;
        }
        
        const resultsHtml = suggestions.map(suggestion => {
            const product = suggestion.product;
            const score = suggestion.score;
            
            return `
                <div class="card mb-2">
                    <div class="card-body">
                        <div class="d-flex justify-content-between align-items-start">
                            <div class="flex-grow-1">
                                <h6 class="card-title mb-1">${product.name}</h6>
                                ${product.sku ? `<div class="text-muted small mb-1"><code>${product.sku}</code></div>` : ''}
                                ${product.description ? `<p class="card-text small text-muted mb-2">${product.description}</p>` : ''}
                                <div class="small">
                                    <span class="badge bg-secondary me-2">${product.supplier || 'No supplier'}</span>
                                    <span class="badge bg-info me-2">${product.category || 'No category'}</span>
                                    <span class="badge bg-success">Match: ${(score * 100).toFixed(1)}%</span>
                                </div>
                            </div>
                            <div class="ms-3">
                                <button type="button" class="btn btn-primary btn-sm select-match-btn" 
                                        data-line-index="${document.getElementById('productMatchModal').getAttribute('data-line-index')}"
                                        data-product-id="${product.id}">
                                    Select
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
        container.innerHTML = `
            <div class="mb-3">
                <h6>Suggested Matches:</h6>
                ${resultsHtml}
            </div>
        `;
    }

    async searchProducts(query, container, lineItemIndex) {
        if (!query || query.length < 2) {
            const item = this.processedData.lineItems[lineItemIndex];
            this.displayMatchSuggestions(item, container);
            return;
        }
        
        // Filter items based on search query
        const lowerQuery = query.toLowerCase();
        const filteredItems = this.allItems.filter(item => {
            return item.name.toLowerCase().includes(lowerQuery) ||
                   (item.sku && item.sku.toLowerCase().includes(lowerQuery)) ||
                   (item.description && item.description.toLowerCase().includes(lowerQuery)) ||
                   (item.listingName && item.listingName.toLowerCase().includes(lowerQuery));
        });
        
        if (filteredItems.length === 0) {
            container.innerHTML = `
                <div class="alert alert-warning">
                    <i class="fas fa-search me-2"></i>
                    No products found matching "${query}"
                </div>
            `;
            return;
        }
        
        // Sort by relevance (simple text matching)
        filteredItems.sort((a, b) => {
            const aScore = this.calculateSimpleMatchScore(query, a);
            const bScore = this.calculateSimpleMatchScore(query, b);
            return bScore - aScore;
        });
        
        const resultsHtml = filteredItems.slice(0, 10).map(product => {
            const score = this.calculateSimpleMatchScore(query, product);
            
            return `
                <div class="card mb-2">
                    <div class="card-body">
                        <div class="d-flex justify-content-between align-items-start">
                            <div class="flex-grow-1">
                                <h6 class="card-title mb-1">${product.name}</h6>
                                ${product.sku ? `<div class="text-muted small mb-1"><code>${product.sku}</code></div>` : ''}
                                ${product.description ? `<p class="card-text small text-muted mb-2">${product.description}</p>` : ''}
                                <div class="small">
                                    <span class="badge bg-secondary me-2">${product.supplier || 'No supplier'}</span>
                                    <span class="badge bg-info me-2">${product.category || 'No category'}</span>
                                    <span class="badge bg-success">Match: ${(score * 100).toFixed(1)}%</span>
                                </div>
                            </div>
                            <div class="ms-3">
                                <button type="button" class="btn btn-primary btn-sm select-match-btn" 
                                        data-line-index="${lineItemIndex}"
                                        data-product-id="${product.id}">
                                    Select
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
        container.innerHTML = `
            <div class="mb-3">
                <h6>Search Results (${filteredItems.length} found):</h6>
                ${resultsHtml}
            </div>
        `;
    }

    calculateSimpleMatchScore(query, product) {
        const lowerQuery = query.toLowerCase();
        const texts = [
            product.name,
            product.sku || '',
            product.description || '',
            product.listingName || ''
        ].join(' ').toLowerCase();
        
        // Simple scoring based on text inclusion
        const words = lowerQuery.split(/\s+/);
        let matches = 0;
        
        for (const word of words) {
            if (texts.includes(word)) {
                matches++;
            }
        }
        
        return matches / words.length;
    }

    selectProductMatch(lineItemIndex, productId) {
        const item = this.processedData.lineItems[lineItemIndex];
        const product = this.allItems.find(p => p.id === productId);
        
        if (!product) {
            showToast('Product not found', 'error');
            return;
        }
        
        // Update the line item with selected match
        item.matchedProduct = product;
        item.matchScore = 1.0; // User confirmed match
        item.isNewProduct = false;
        
        // Close modal
        bootstrap.Modal.getInstance(document.getElementById('productMatchModal')).hide();
        
        // Re-render the line items review
        this.renderLineItemsReview();
        
        showToast('Product matched successfully', 'success');
    }

    showCreateProductModal(lineItemIndex) {
        const item = this.processedData.lineItems[lineItemIndex];
        const modal = document.getElementById('createProductModal');
        
        // Set modal data
        modal.setAttribute('data-line-index', lineItemIndex);
        
        // Pre-populate form with invoice data
        document.getElementById('newProductName').value = item.description || '';
        document.getElementById('newProductSku').value = item.code || '';
        document.getElementById('newProductCostPrice').value = item.unitPrice || '';
        
        // Set supplier
        const supplierSelect = document.getElementById('newProductSupplier');
        if (this.processedData.supplier) {
            supplierSelect.value = this.processedData.supplier;
        }
        
        // Show modal
        const bsModal = new bootstrap.Modal(modal);
        bsModal.show();
    }

    async saveNewProduct() {
        const form = document.getElementById('createProductForm');
        
        if (!validateForm(form)) {
            showToast('Please fill in all required fields', 'error');
            return;
        }
        
        try {
            const lineItemIndex = parseInt(document.getElementById('createProductModal').getAttribute('data-line-index'));
            const item = this.processedData.lineItems[lineItemIndex];
            
            const productData = {
                name: document.getElementById('newProductName').value.trim(),
                sku: document.getElementById('newProductSku').value.trim() || null,
                description: document.getElementById('newProductDescription').value.trim() || null,
                supplier: document.getElementById('newProductSupplier').value,
                category: document.getElementById('newProductCategory').value,
                itemType: document.getElementById('newProductItemType').value,
                costPrice: parseFloat(document.getElementById('newProductCostPrice').value) || 0,
                sellingPrice: parseFloat(document.getElementById('newProductSellingPrice').value) || 0,
                quantity: 0, // Will be updated when processing the purchase
                lowStockThreshold: parseInt(document.getElementById('newProductLowStockThreshold').value) || 5
            };
            
            // Update the line item to indicate a new product will be created
            item.newProductData = productData;
            item.isNewProduct = true;
            item.matchedProduct = null;
            item.action = 'create_new';
            
            // Close modal
            bootstrap.Modal.getInstance(document.getElementById('createProductModal')).hide();
            
            // Re-render the line items review
            this.renderLineItemsReview();
            
            showToast('New product will be created during processing', 'success');
            
        } catch (error) {
            console.error('Error preparing new product:', error);
            showToast('Error preparing new product: ' + error.message, 'error');
        }
    }

    async finalizeInvoiceProcessing() {
        try {
            // Prepare line items for processing
            const processedLineItems = this.processedData.lineItems.map((item, index) => {
                const processedItem = {
                    originalText: item.originalText,
                    description: item.description,
                    code: item.code,
                    quantity: item.quantity,
                    unitPrice: item.unitPrice,
                    subtotal: item.subtotal,
                    discountPercent: item.discountPercent || 0,
                    discountAmount: item.discountAmount || 0,
                    netTotal: item.netTotal,
                    taxRate: item.taxRate || 15,
                    taxAmount: item.taxAmount || 0,
                    totalPrice: item.totalPrice || (item.unitPrice * item.quantity),
                    calculatedTotal: item.calculatedTotal,
                    currency: item.currency || 'ZAR',
                    isValid: item.isValid,
                    validationErrors: item.validationErrors,
                    matchScore: item.matchScore,
                    isNewProduct: item.isNewProduct,
                    action: item.action || (item.matchedProduct ? 'use_existing' : 'create_new')
                };
                
                if (item.matchedProduct) {
                    processedItem.itemId = item.matchedProduct.id;
                    processedItem.itemName = item.matchedProduct.name;
                }
                
                if (item.newProductData) {
                    processedItem.newItemData = item.newProductData;
                }
                
                return processedItem;
            });
            
            // Show processing indicator
            document.getElementById('confirmProcessingBtn').disabled = true;
            document.getElementById('confirmProcessingBtn').innerHTML = 
                '<span class="spinner-border spinner-border-sm me-2"></span>Processing...';
            
            // Process the invoice into purchases and items
            const results = await inventoryDB.processInvoiceIntoPurchases(
                this.currentInvoice.id, 
                processedLineItems
            );
            
            // Show results
            this.showProcessingResults(results);
            
        } catch (error) {
            console.error('Error finalizing invoice processing:', error);
            showToast('Error processing invoice: ' + error.message, 'error');
        } finally {
            // Reset button
            document.getElementById('confirmProcessingBtn').disabled = false;
            document.getElementById('confirmProcessingBtn').innerHTML = 
                '<i class="fas fa-check me-2"></i>Confirm & Process';
        }
    }

    showProcessingResults(results) {
        const modalBody = document.querySelector('#invoiceUploadModal .modal-body');
        
        modalBody.innerHTML = `
            <div class="text-center">
                <div class="mb-4">
                    <i class="fas fa-check-circle fa-4x text-success mb-3"></i>
                    <h4>Invoice Processing Complete!</h4>
                </div>
                
                <div class="row g-3 mb-4">
                    <div class="col-md-3">
                        <div class="card bg-success text-white">
                            <div class="card-body text-center">
                                <i class="fas fa-shopping-cart fa-2x mb-2"></i>
                                <h5>${results.purchasesCreated}</h5>
                                <small>Purchases Created</small>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="card bg-primary text-white">
                            <div class="card-body text-center">
                                <i class="fas fa-plus-circle fa-2x mb-2"></i>
                                <h5>${results.itemsCreated}</h5>
                                <small>Items Created</small>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="card bg-info text-white">
                            <div class="card-body text-center">
                                <i class="fas fa-edit fa-2x mb-2"></i>
                                <h5>${results.itemsUpdated}</h5>
                                <small>Items Updated</small>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="card bg-${results.errors.length > 0 ? 'warning' : 'secondary'} text-white">
                            <div class="card-body text-center">
                                <i class="fas fa-exclamation-triangle fa-2x mb-2"></i>
                                <h5>${results.errors.length}</h5>
                                <small>Errors</small>
                            </div>
                        </div>
                    </div>
                </div>
                
                ${results.errors.length > 0 ? `
                    <div class="alert alert-warning text-start">
                        <h6><i class="fas fa-exclamation-triangle me-2"></i>Processing Errors:</h6>
                        <ul class="mb-0">
                            ${results.errors.map(error => `<li>${error}</li>`).join('')}
                        </ul>
                    </div>
                ` : ''}
                
                <div class="d-grid gap-2">
                    <button type="button" class="btn btn-success" onclick="invoiceUploadManager.closeModalAndRefresh()">
                        <i class="fas fa-check me-2"></i>Done
                    </button>
                </div>
            </div>
        `;
    }

    closeModalAndRefresh() {
        // Close modal
        bootstrap.Modal.getInstance(document.getElementById('invoiceUploadModal')).hide();
        
        // Refresh relevant components
        if (window.dashboard) {
            dashboard.refreshStats();
        }
        if (window.purchaseManager) {
            purchaseManager.loadPurchases();
        }
        if (window.itemsManager) {
            itemsManager.loadItems();
        }
        
        showToast('Invoice processing completed successfully!', 'success');
    }

    backToUploadStep() {
        // Show upload step, hide review step
        document.getElementById('uploadStep').style.display = 'block';
        document.getElementById('reviewStep').style.display = 'none';
        
        // Switch footer buttons back
        document.getElementById('uploadStepFooter').style.display = 'flex';
        document.getElementById('reviewStepFooter').style.display = 'none';
        
        // Reset modal title
        document.querySelector('#invoiceUploadModal .modal-title').textContent = 'Upload Invoice';
        
        this.currentStep = 1;
        // Update modal title
        document.querySelector('#invoiceUploadModal .modal-title').textContent = 'Upload Invoice';
        
        this.currentStep = 1;
    }

    /**
     * Show training modal for new supplier
     */
    showTrainingModal() {
        // Hide the upload modal temporarily
        const uploadModal = bootstrap.Modal.getInstance(document.getElementById('invoiceUploadModal'));
        uploadModal.hide();
        
        // Show the training modal using the training UI
        if (typeof invoiceTrainingUI !== 'undefined') {
            invoiceTrainingUI.initialize(invoiceProcessor.getLearningManager());
            invoiceTrainingUI.showTrainingModal(
                this.processedData.supplier,
                this.processedData.rawText
            );
            
            // Store current upload data for after training
            this.pendingTrainingData = {
                supplier: this.processedData.supplier,
                invoiceText: this.processedData.rawText,
                file: {
                    name: this.processedData.file.name,
                    size: this.processedData.file.size,
                    type: this.processedData.file.type
                }
            };
            
            // Listen for training completion
            this.attachTrainingCompletionHandler();
        } else {
            console.error('Invoice training UI not available');
            showToast('Training interface not available', 'error');
        }
    }

    /**
     * Attach event handler for training completion
     */
    attachTrainingCompletionHandler() {
        // Listen for training modal hide event
        document.getElementById('trainingProgressModal').addEventListener('hidden.bs.modal', () => {
            // Check if training was completed
            if (this.pendingTrainingData) {
                this.handleTrainingCompletion();
            }
        }, { once: true });
    }

    /**
     * Handle completion of training and continue processing
     */
    async handleTrainingCompletion() {
        console.log('🎓 Training completed, continuing with invoice processing...');
        
        try {
            // Show processing indicator
            showToast('Training completed! Re-processing invoice with learned algorithm...', 'info');
            
            // Re-process the invoice with the newly trained algorithm
            const fileInput = document.getElementById('invoiceFileInput');
            const file = fileInput.files[0];
            
            if (file) {
                this.processedData = await invoiceProcessor.processInvoice(file, this.pendingTrainingData.supplier);
                
                if (this.processedData.success && !this.processedData.needsTraining) {
                    // Save the invoice document to database
                    const invoiceDocData = {
                        type: 'purchase',
                        supplier: this.processedData.supplier,
                        fileName: file.name,
                        fileSize: file.size,
                        fileType: file.type,
                        invoiceNumber: this.processedData.invoice?.invoiceNumber || null,
                        date: this.processedData.invoice?.date || null,
                        totalAmount: this.processedData.invoice?.totalAmount || null,
                        rawText: this.processedData.rawText,
                        lineItemsCount: this.processedData.lineItems?.length || 0
                    };

                    this.currentInvoice = await inventoryDB.saveInvoiceDocument(invoiceDocData);
                    
                    // Show upload modal again and move to review step
                    const uploadModal = new bootstrap.Modal(document.getElementById('invoiceUploadModal'));
                    uploadModal.show();
                    
                    this.showReviewStep();
                    showToast(`✅ Invoice processed using learned algorithm! Found ${this.processedData.lineItems.length} line items`, 'success');
                } else {
                    showToast('Failed to process invoice after training', 'error');
                }
            }
            
        } catch (error) {
            console.error('Error processing invoice after training:', error);
            showToast('Error processing invoice after training: ' + error.message, 'error');
        } finally {
            // Clear pending data
            this.pendingTrainingData = null;
        }
    }
}

// Create global instance
const invoiceUploadManager = new InvoiceUploadManager();