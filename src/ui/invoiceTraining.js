/**
 * Invoice Training UI Controller
 * Handles the interactive training interface for new suppliers
 */

class InvoiceTrainingUI {
    constructor() {
        this.learningManager = null;
        this.currentLineItemIndex = 0;
        this.maxLineItems = 50;
        
        this.initializeEventListeners();
    }

    /**
     * Initialize training manager
     * @param {SupplierLearningManager} learningManager - Learning manager instance
     */
    initialize(learningManager) {
        this.learningManager = learningManager;
    }

    /**
     * Show training modal for new supplier
     * @param {string} supplierName - Supplier name
     * @param {string} invoiceText - Raw invoice text
     */
    showTrainingModal(supplierName, invoiceText) {
        console.log('📚 Showing training modal for:', supplierName);

        // Set supplier name and invoice text
        document.getElementById('trainingSupplierName').textContent = supplierName;
        document.getElementById('trainingInvoiceText').value = invoiceText;

        // Reset form
        this.resetTrainingForm();
        
        // Add initial line item
        this.currentLineItemIndex = 0;
        this.addLineItem();

        // Show modal
        const modal = new bootstrap.Modal(document.getElementById('invoiceTrainingModal'));
        modal.show();
    }

    /**
     * Initialize event listeners
     */
    initializeEventListeners() {
        // Line item count change
        document.getElementById('trainingLineItemCount')?.addEventListener('change', (e) => {
            this.updateLineItemCount(parseInt(e.target.value) || 1);
        });

        // Add line item button
        document.getElementById('addLineItemBtn')?.addEventListener('click', () => {
            this.addLineItem();
        });

        // Start training button
        document.getElementById('startTrainingBtn')?.addEventListener('click', () => {
            this.startTraining();
        });

        // Training complete button
        document.getElementById('trainingCompleteBtn')?.addEventListener('click', () => {
            this.completeTraining();
        });

        // Training cancel button
        document.getElementById('trainingCancelBtn')?.addEventListener('click', () => {
            this.cancelTraining();
        });
        
        // Discount checkbox change
        document.getElementById('trainingHasDiscounts')?.addEventListener('change', () => {
            this.toggleDiscountFields();
        });
        
        // AI Auto-fill button
        document.getElementById('aiAutoFillBtn')?.addEventListener('click', () => {
            this.triggerAIAutoFill();
        });
    }

    /**
     * Reset training form to defaults
     */
    resetTrainingForm() {
        // Reset basic fields
        document.getElementById('trainingInvoiceNumber').value = '';
        document.getElementById('trainingInvoiceDate').value = '';
        document.getElementById('trainingDateFormat').value = 'DD/MM/YY';
        document.getElementById('trainingCurrency').value = 'ZAR';
        document.getElementById('trainingTaxRate').value = '15';
        document.getElementById('trainingTotalExcludingTax').value = '';
        document.getElementById('trainingTotalIncludingTax').value = '';
        document.getElementById('trainingHasDiscounts').checked = false;
        document.getElementById('trainingLineItemCount').value = '1';

        // Reset price include tax radio buttons
        document.getElementById('pricesIncludeTaxYes').checked = false;
        document.getElementById('pricesIncludeTaxNo').checked = false;

        // Clear line items
        document.getElementById('trainingLineItemsList').innerHTML = '';
        this.currentLineItemIndex = 0;
    }

    /**
     * Update line item count and add/remove items accordingly
     * @param {number} count - Target number of line items
     */
    updateLineItemCount(count) {
        const container = document.getElementById('trainingLineItemsList');
        const currentItems = container.children.length;

        if (count > currentItems) {
            // Add more items
            for (let i = currentItems; i < count; i++) {
                this.addLineItem();
            }
        } else if (count < currentItems) {
            // Remove excess items
            for (let i = currentItems - 1; i >= count; i--) {
                container.children[i].remove();
            }
            this.currentLineItemIndex = count;
        }
    }

    /**
     * Add a line item input group
     */
    addLineItem() {
        if (this.currentLineItemIndex >= this.maxLineItems) {
            alert(`Maximum ${this.maxLineItems} line items allowed`);
            return;
        }

        const index = this.currentLineItemIndex++;
        const hasDiscounts = document.getElementById('trainingHasDiscounts').checked;

        const lineItemHtml = `
            <div class="card mb-2 line-item-card" data-index="${index}">
                <div class="card-header bg-light py-2">
                    <div class="d-flex justify-content-between align-items-center">
                        <small class="fw-bold">Item ${index + 1}</small>
                        <button type="button" class="btn btn-sm btn-outline-danger remove-line-item" onclick="invoiceTrainingUI.removeLineItem(${index})">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
                <div class="card-body py-2">
                    <div class="mb-2">
                        <label class="form-label small">Product Name/Description</label>
                        <input type="text" class="form-control form-control-sm" id="lineItem${index}Name" 
                               placeholder="e.g., Podo Box Size L">
                    </div>
                    <div class="row">
                        <div class="col-md-6">
                            <div class="mb-2">
                                <label class="form-label small">Quantity</label>
                                <input type="number" class="form-control form-control-sm" id="lineItem${index}Quantity" 
                                       step="0.01" min="0.01" placeholder="e.g., 10.00">
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="mb-2">
                                <label class="form-label small">Unit Price</label>
                                <input type="number" class="form-control form-control-sm" id="lineItem${index}UnitPrice" 
                                       step="0.01" min="0" placeholder="e.g., 76.35">
                            </div>
                        </div>
                    </div>
                    <div class="row">
                        ${hasDiscounts ? `
                        <div class="col-md-6">
                            <div class="mb-2">
                                <label class="form-label small">Discount %</label>
                                <input type="number" class="form-control form-control-sm" id="lineItem${index}Discount" 
                                       step="0.1" min="0" max="100" placeholder="e.g., 25.0">
                            </div>
                        </div>
                        <div class="col-md-6">
                        ` : `
                        <div class="col-md-12">
                        `}
                            <div class="mb-2">
                                <label class="form-label small">Net Price (after discount)</label>
                                <input type="number" class="form-control form-control-sm" id="lineItem${index}NetPrice" 
                                       step="0.01" min="0" placeholder="e.g., 763.50">
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('trainingLineItemsList').insertAdjacentHTML('beforeend', lineItemHtml);

        // Update line item count
        document.getElementById('trainingLineItemCount').value = this.currentLineItemIndex;
    }

    /**
     * Remove a specific line item
     * @param {number} index - Index of line item to remove
     */
    removeLineItem(index) {
        const item = document.querySelector(`.line-item-card[data-index="${index}"]`);
        if (item) {
            item.remove();
            this.currentLineItemIndex--;
            document.getElementById('trainingLineItemCount').value = this.currentLineItemIndex;
            this.reindexLineItems();
        }
    }

    /**
     * Re-index line items after removal
     */
    reindexLineItems() {
        const items = document.querySelectorAll('.line-item-card');
        items.forEach((item, newIndex) => {
            item.setAttribute('data-index', newIndex);
            item.querySelector('small').textContent = `Item ${newIndex + 1}`;
            
            // Update remove button
            const removeBtn = item.querySelector('.remove-line-item');
            removeBtn.setAttribute('onclick', `invoiceTrainingUI.removeLineItem(${newIndex})`);
        });
        this.currentLineItemIndex = items.length;
    }

    /**
     * Toggle discount fields based on checkbox
     */
    toggleDiscountFields() {
        const hasDiscounts = document.getElementById('trainingHasDiscounts').checked;
        
        // Rebuild line items with/without discount fields
        const count = this.currentLineItemIndex;
        document.getElementById('trainingLineItemsList').innerHTML = '';
        this.currentLineItemIndex = 0;
        
        for (let i = 0; i < count; i++) {
            this.addLineItem();
        }
    }

    /**
     * Start the training process
     */
    async startTraining() {
        console.log('🎓 Starting training process...');

        try {
            // Validate form
            const annotations = this.collectAnnotations();
            if (!this.validateAnnotations(annotations)) {
                return;
            }

            // Hide training modal and show progress modal
            const trainingModal = bootstrap.Modal.getInstance(document.getElementById('invoiceTrainingModal'));
            trainingModal.hide();

            this.showProgressModal();
            this.updateProgress(10, 'Collecting training data...', 'Processing your annotations...');

            // Process annotations with learning manager
            const result = await this.learningManager.processAnnotations(annotations);

            if (result.success) {
                this.updateProgress(100, 'Training completed successfully!', 
                    `Algorithm trained for ${result.supplier}. Validation accuracy: ${result.validation.accuracy.toFixed(1)}%`);
                
                this.showTrainingResults(result);
            } else {
                this.showTrainingError(result.error || result.errors);
            }

        } catch (error) {
            console.error('❌ Training failed:', error);
            this.showTrainingError(error.message);
        }
    }

    /**
     * Collect all annotations from the form
     * @returns {Object} Training annotations
     */
    collectAnnotations() {
        const lineItems = [];
        const items = document.querySelectorAll('.line-item-card');

        items.forEach((item, index) => {
            const name = document.getElementById(`lineItem${index}Name`)?.value.trim();
            const quantity = parseFloat(document.getElementById(`lineItem${index}Quantity`)?.value) || 0;
            const unitPrice = parseFloat(document.getElementById(`lineItem${index}UnitPrice`)?.value) || 0;
            const discount = parseFloat(document.getElementById(`lineItem${index}Discount`)?.value) || 0;
            const netPrice = parseFloat(document.getElementById(`lineItem${index}NetPrice`)?.value) || 0;

            if (name) {
                lineItems.push({
                    name,
                    quantity,
                    unitPrice,
                    discount,
                    netPrice
                });
            }
        });

        const pricesIncludeTax = document.querySelector('input[name="pricesIncludeTax"]:checked')?.value === 'true';

        return {
            supplier: document.getElementById('trainingSupplierName').textContent,
            lineItems: lineItems,
            invoiceNumber: document.getElementById('trainingInvoiceNumber').value.trim() || null,
            invoiceDate: document.getElementById('trainingInvoiceDate').value.trim() || null,
            dateFormat: document.getElementById('trainingDateFormat').value,
            totalExcludingTax: parseFloat(document.getElementById('trainingTotalExcludingTax').value) || null,
            totalIncludingTax: parseFloat(document.getElementById('trainingTotalIncludingTax').value) || null,
            taxRate: parseFloat(document.getElementById('trainingTaxRate').value) || 15,
            pricesIncludeTax: pricesIncludeTax,
            hasDiscounts: document.getElementById('trainingHasDiscounts').checked,
            currency: document.getElementById('trainingCurrency').value
        };
    }

    /**
     * Validate training annotations
     * @param {Object} annotations - Training annotations
     * @returns {boolean} True if valid
     */
    validateAnnotations(annotations) {
        const errors = [];

        // Check line items
        if (!annotations.lineItems.length) {
            errors.push('At least one line item is required');
        }

        // Check required fields for each line item
        annotations.lineItems.forEach((item, index) => {
            if (!item.name) {
                errors.push(`Line item ${index + 1}: Product name is required`);
            }
            if (!item.quantity || item.quantity <= 0) {
                errors.push(`Line item ${index + 1}: Valid quantity is required`);
            }
            if (!item.unitPrice || item.unitPrice <= 0) {
                errors.push(`Line item ${index + 1}: Valid unit price is required`);
            }
        });

        // Check tax inclusion setting
        if (annotations.pricesIncludeTax === null) {
            errors.push('Please specify whether prices include tax');
        }

        // Check totals
        if (!annotations.totalIncludingTax && !annotations.totalExcludingTax) {
            errors.push('At least one total amount is required');
        }

        if (errors.length > 0) {
            alert('Please fix the following issues:\n\n' + errors.join('\n'));
            return false;
        }

        return true;
    }

    /**
     * Show progress modal with training updates
     */
    showProgressModal() {
        const modal = new bootstrap.Modal(document.getElementById('trainingProgressModal'));
        modal.show();

        // Reset progress
        document.getElementById('trainingProgressBar').style.width = '0%';
        document.getElementById('trainingProgressTitle').textContent = 'Initializing training...';
        document.getElementById('trainingProgressText').textContent = 'Please wait while the AI learns from your annotations...';
        document.getElementById('trainingResults').style.display = 'none';
        document.getElementById('trainingProgressFooter').style.display = 'none';
    }

    /**
     * Update training progress
     * @param {number} percent - Progress percentage (0-100)
     * @param {string} title - Progress title
     * @param {string} text - Progress description
     */
    updateProgress(percent, title, text) {
        document.getElementById('trainingProgressBar').style.width = `${percent}%`;
        document.getElementById('trainingProgressTitle').textContent = title;
        document.getElementById('trainingProgressText').textContent = text;

        // Simulate progress steps
        if (percent < 100) {
            setTimeout(() => {
                if (percent < 30) {
                    this.updateProgress(30, 'Analyzing invoice structure...', 'AI is examining the text patterns...');
                } else if (percent < 60) {
                    this.updateProgress(60, 'Generating extraction patterns...', 'Creating regex patterns for data extraction...');
                } else if (percent < 90) {
                    this.updateProgress(90, 'Validating algorithm...', 'Testing patterns against training data...');
                }
            }, 1000);
        }
    }

    /**
     * Show training results
     * @param {Object} result - Training result
     */
    showTrainingResults(result) {
        console.log('📊 Training result structure:', result);
        
        // Safely access nested properties with fallbacks
        const supplier = result?.supplier || result?.algorithm?.supplier || 'Unknown';
        const accuracy = result?.validation?.accuracy || result?.accuracy || 0;
        const lineItems = result?.validation?.extractedData?.lineItems || 
                         result?.extractedData?.lineItems || 
                         result?.lineItems || 'N/A';
        const version = result?.algorithm?.version || result?.version || '1.0';
        
        const resultsHtml = `
            <div class="alert alert-success">
                <h6><i class="fas fa-check-circle me-2"></i>Training Successful!</h6>
                <p class="mb-2">Algorithm created for <strong>${supplier}</strong></p>
                <ul class="mb-0">
                    <li>Validation accuracy: <strong>${accuracy.toFixed ? accuracy.toFixed(1) : accuracy}%</strong></li>
                    <li>Line items detected: <strong>${lineItems}</strong></li>
                    <li>Algorithm version: <strong>${version}</strong></li>
                    <li>Training method: <strong>${result?.method || 'Standard'}</strong></li>
                </ul>
            </div>
        `;

        document.getElementById('trainingResults').innerHTML = resultsHtml;
        document.getElementById('trainingResults').style.display = 'block';
        document.getElementById('trainingProgressFooter').style.display = 'flex';
        document.getElementById('trainingCompleteBtn').style.display = 'inline-block';

        // Hide spinner
        const spinner = document.querySelector('#trainingProgressModal .spinner-border');
        if (spinner) spinner.style.display = 'none';
    }

    /**
     * Show training error
     * @param {string|Array} error - Error message(s)
     */
    showTrainingError(error) {
        const errorMsg = Array.isArray(error) ? error.join('<br>') : error;
        const resultsHtml = `
            <div class="alert alert-danger">
                <h6><i class="fas fa-exclamation-triangle me-2"></i>Training Failed</h6>
                <p class="mb-0">${errorMsg}</p>
            </div>
        `;

        document.getElementById('trainingResults').innerHTML = resultsHtml;
        document.getElementById('trainingResults').style.display = 'block';
        document.getElementById('trainingProgressFooter').style.display = 'flex';

        // Hide spinner
        const spinner = document.querySelector('#trainingProgressModal .spinner-border');
        if (spinner) spinner.style.display = 'none';
    }

    /**
     * Complete training and close modals
     */
    completeTraining() {
        const modal = bootstrap.Modal.getInstance(document.getElementById('trainingProgressModal'));
        modal.hide();

        // Show success message
        showToast('Training completed successfully! Future invoices from this supplier will be processed automatically.', 'success');
    }

    /**
     * Cancel training process
     */
    cancelTraining() {
        const modal = bootstrap.Modal.getInstance(document.getElementById('trainingProgressModal'));
        modal.hide();
    }

    /**
     * Trigger AI auto-fill for training form
     */
    async triggerAIAutoFill() {
        try {
            // Check if Vision AI is available and configured
            if (typeof aiVisionProcessor === 'undefined') {
                showToast('AI Vision processor not available', 'error');
                return;
            }
            
            if (!aiVisionProcessor.hasApiKey()) {
                showToast('Please configure your Gemini API key in AI Settings first', 'warning');
                return;
            }
            
            // Get the current invoice file from the upload
            const fileInput = document.getElementById('invoiceFileInput');
            if (!fileInput || !fileInput.files[0]) {
                showToast('No invoice file available for AI analysis', 'error');
                return;
            }
            
            const file = fileInput.files[0];
            const supplierName = document.getElementById('trainingSupplierName').textContent;
            
            // Show loading state
            const autoFillBtn = document.getElementById('aiAutoFillBtn');
            const originalText = autoFillBtn.innerHTML;
            autoFillBtn.disabled = true;
            autoFillBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>AI Analyzing...';
            
            showToast('🤖 AI is analyzing the invoice to pre-fill training data...', 'info');
            
            // Call AI Vision auto-fill
            const autoFillData = await aiVisionProcessor.autoFillTrainingData(file, supplierName);
            
            // Apply the auto-filled data to the form
            this.applyAutoFillData(autoFillData);
            
            showToast('✨ AI auto-fill completed! Please review and correct any fields as needed.', 'success');
            
        } catch (error) {
            console.error('❌ AI auto-fill failed:', error);
            showToast('AI auto-fill failed: ' + error.message + '. Please fill manually.', 'error');
        } finally {
            // Reset button
            const autoFillBtn = document.getElementById('aiAutoFillBtn');
            autoFillBtn.disabled = false;
            autoFillBtn.innerHTML = '<i class="fas fa-magic me-1"></i>AI Auto-Fill';
        }
    }

    /**
     * Apply auto-filled data to the training form
     * @param {Object} data - Auto-filled training data
     */
    applyAutoFillData(data) {
        console.log('🔄 Applying AI auto-fill data:', data);
        
        // Fill basic invoice information
        if (data.invoiceNumber) {
            document.getElementById('trainingInvoiceNumber').value = data.invoiceNumber;
        }
        
        if (data.invoiceDate) {
            document.getElementById('trainingInvoiceDate').value = data.invoiceDate;
        }
        
        if (data.dateFormat) {
            document.getElementById('trainingDateFormat').value = data.dateFormat;
        }
        
        if (data.currency) {
            document.getElementById('trainingCurrency').value = data.currency;
        }
        
        if (data.taxRate) {
            document.getElementById('trainingTaxRate').value = data.taxRate.toString();
        }
        
        if (data.totalExcludingTax) {
            document.getElementById('trainingTotalExcludingTax').value = data.totalExcludingTax.toString();
        }
        
        if (data.totalIncludingTax) {
            document.getElementById('trainingTotalIncludingTax').value = data.totalIncludingTax.toString();
        }
        
        // Set price inclusion radio buttons
        if (data.pricesIncludeTax !== undefined) {
            document.getElementById('pricesIncludeTaxYes').checked = data.pricesIncludeTax;
            document.getElementById('pricesIncludeTaxNo').checked = !data.pricesIncludeTax;
        }
        
        // Set discounts checkbox
        document.getElementById('trainingHasDiscounts').checked = data.hasDiscounts;
        this.toggleDiscountFields();
        
        // Fill line items
        if (data.lineItems && data.lineItems.length > 0) {
            // Clear existing line items
            document.getElementById('trainingLineItemsList').innerHTML = '';
            this.currentLineItemIndex = 0;
            
            // Set line item count
            document.getElementById('trainingLineItemCount').value = data.lineItems.length.toString();
            
            // Add line items with data
            data.lineItems.forEach((item, index) => {
                this.addLineItem();
                
                // Fill the line item data
                if (item.name) {
                    document.getElementById(`lineItem${index}Name`).value = item.name;
                }
                if (item.quantity) {
                    document.getElementById(`lineItem${index}Quantity`).value = item.quantity.toString();
                }
                if (item.unitPrice) {
                    document.getElementById(`lineItem${index}UnitPrice`).value = item.unitPrice.toString();
                }
                if (item.netPrice) {
                    document.getElementById(`lineItem${index}NetPrice`).value = item.netPrice.toString();
                }
                if (item.discount && data.hasDiscounts) {
                    const discountField = document.getElementById(`lineItem${index}Discount`);
                    if (discountField) {
                        discountField.value = item.discount.toString();
                    }
                }
            });
        }
        
        console.log('✅ Auto-fill data applied to form');
    }
}

// Create global instance
const invoiceTrainingUI = new InvoiceTrainingUI();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = InvoiceTrainingUI;
} else {
    window.InvoiceTrainingUI = InvoiceTrainingUI;
    window.invoiceTrainingUI = invoiceTrainingUI;
}