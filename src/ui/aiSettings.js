/**
 * AI Settings UI Controller
 * Manages configuration for AI vision processing
 */

class AISettingsManager {
    constructor() {
        this.currentMethod = 'text'; // 'text' or 'vision'
        this.initializeEventListeners();
        this.loadSettings();
    }
    
    /**
     * Get aiVisionProcessor safely
     * @returns {Object|null} aiVisionProcessor instance or null
     */
    getVisionProcessor() {
        // Try multiple ways to get the vision processor
        if (typeof aiVisionProcessor !== 'undefined') {
            return aiVisionProcessor;
        }
        if (typeof window !== 'undefined' && window.aiVisionProcessor) {
            return window.aiVisionProcessor;
        }
        
        console.warn('aiVisionProcessor not found. Available globals:', {
            aiVisionProcessor: typeof aiVisionProcessor,
            windowAiVisionProcessor: typeof window?.aiVisionProcessor,
            windowKeys: typeof window !== 'undefined' ? Object.keys(window).filter(k => k.includes('Vision') || k.includes('ai')).slice(0, 10) : []
        });
        
        return null;
    }

    /**
     * Initialize event listeners
     */
    initializeEventListeners() {
        // AI settings button
        document.getElementById('aiSettingsBtn')?.addEventListener('click', () => {
            this.showAISettingsModal();
        });

        // Processing method change
        document.querySelectorAll('input[name="processingMethod"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.handleMethodChange(e.target.value);
            });
        });

        // Test API key button
        document.getElementById('testApiKeyBtn')?.addEventListener('click', () => {
            this.testGeminiApiKey();
        });

        // Save settings button
        document.getElementById('saveAiSettingsBtn')?.addEventListener('click', () => {
            this.saveSettings();
        });
    }

    /**
     * Load saved settings
     */
    loadSettings() {
        try {
            const savedMethod = localStorage.getItem('feetonfocus_ai_processing_method') || 'text';
            this.currentMethod = savedMethod;

            // Update UI
            const methodRadio = document.getElementById(savedMethod === 'vision' ? 'visionMethod' : 'textExtractionMethod');
            if (methodRadio) {
                methodRadio.checked = true;
                this.handleMethodChange(savedMethod);
            }

            // Load API key if exists
            const apiKey = localStorage.getItem('feetonfocus_gemini_api_key');
            if (apiKey) {
                const apiKeyInput = document.getElementById('geminiApiKey');
                if (apiKeyInput) {
                    apiKeyInput.value = apiKey;
                }
            }

            this.updateStatusDisplay();
        } catch (error) {
            console.warn('Could not load AI settings:', error);
        }
    }

    /**
     * Show AI settings modal
     */
    showAISettingsModal() {
        const modal = new bootstrap.Modal(document.getElementById('aiSettingsModal'));
        modal.show();

        // Update current settings in modal
        this.updateModalDisplay();
    }

    /**
     * Update modal display with current settings
     */
    updateModalDisplay() {
        // Check current method
        const methodRadio = document.getElementById(this.currentMethod === 'vision' ? 'visionMethod' : 'textExtractionMethod');
        if (methodRadio) {
            methodRadio.checked = true;
            this.handleMethodChange(this.currentMethod);
        }

        // Load API key
        const apiKey = localStorage.getItem('feetonfocus_gemini_api_key');
        if (apiKey) {
            const apiKeyInput = document.getElementById('geminiApiKey');
            if (apiKeyInput) {
                apiKeyInput.value = apiKey;
            }
        }
    }

    /**
     * Handle processing method change
     * @param {string} method - Selected method ('text' or 'vision')
     */
    handleMethodChange(method) {
        const geminiConfig = document.getElementById('geminiApiConfig');
        
        if (method === 'vision') {
            geminiConfig.style.display = 'block';
            this.currentMethod = 'vision';
        } else {
            geminiConfig.style.display = 'none';
            this.currentMethod = 'text';
        }

        this.updateStatusDisplay();
    }

    /**
     * Test Gemini API key
     */
    async testGeminiApiKey() {
        const apiKeyInput = document.getElementById('geminiApiKey');
        const statusDiv = document.getElementById('apiKeyStatus');
        const testBtn = document.getElementById('testApiKeyBtn');

        const apiKey = apiKeyInput.value.trim();
        if (!apiKey) {
            this.showApiKeyStatus('error', 'Please enter an API key');
            return;
        }

        // Show loading state
        testBtn.disabled = true;
        testBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Testing...';

        try {
            // Save API key temporarily for testing
            console.log('🔍 Testing API key, looking for vision processor...');
            const visionProcessor = this.getVisionProcessor();
            console.log('🔍 Vision processor found:', !!visionProcessor);
            
            if (visionProcessor) {
                visionProcessor.saveApiKey(apiKey);
                
                // Test the API key
                const testResult = await visionProcessor.testApiKey();
                
                if (testResult.success) {
                    this.showApiKeyStatus('success', '✅ API key is valid and working!');
                } else {
                    let errorMsg = '❌ API key test failed';
                    if (testResult.statusCode === 403) {
                        errorMsg = '❌ API key is invalid or Generative AI API is not enabled';
                    } else if (testResult.statusCode === 404) {
                        errorMsg = '❌ Model not found - API endpoint may have changed';
                    } else if (testResult.statusCode === 429) {
                        errorMsg = '❌ Quota exceeded - try again later';
                    } else if (testResult.error) {
                        errorMsg = `❌ ${testResult.error}`;
                    }
                    this.showApiKeyStatus('error', errorMsg);
                }
            } else {
                this.showApiKeyStatus('error', '❌ AI Vision processor not available');
            }

        } catch (error) {
            console.error('API key test failed:', error);
            this.showApiKeyStatus('error', `❌ Test failed: ${error.message}`);
        } finally {
            // Reset button
            testBtn.disabled = false;
            testBtn.innerHTML = '<i class="fas fa-check me-1"></i>Test Key';
        }
    }

    /**
     * Show API key status
     * @param {string} type - 'success' or 'error'
     * @param {string} message - Status message
     */
    showApiKeyStatus(type, message) {
        const statusDiv = document.getElementById('apiKeyStatus');
        const alertClass = type === 'success' ? 'alert-success' : 'alert-danger';
        
        statusDiv.innerHTML = `<div class="alert ${alertClass}">${message}</div>`;
        statusDiv.style.display = 'block';
    }

    /**
     * Save AI settings
     */
    async saveSettings() {
        try {
            // Save processing method
            localStorage.setItem('feetonfocus_ai_processing_method', this.currentMethod);

            // Save API key if vision method is selected
            if (this.currentMethod === 'vision') {
                const apiKey = document.getElementById('geminiApiKey').value.trim();
                
                if (!apiKey) {
                    alert('Please enter a Gemini API key for vision processing');
                    return;
                }

                // Validate API key
                const visionProcessor = this.getVisionProcessor();
                if (visionProcessor) {
                    visionProcessor.saveApiKey(apiKey);
                    
                    // Test the key
                    const testResult = await visionProcessor.testApiKey();
                    if (!testResult.success) {
                        alert('The provided API key appears to be invalid. Settings saved anyway.');
                    }
                }
            }

            // Update status
            this.updateStatusDisplay();

            // Close modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('aiSettingsModal'));
            modal.hide();

            // Show success message
            showToast(`AI processing method updated to: ${this.currentMethod === 'vision' ? 'Vision AI' : 'Text Extraction'}`, 'success');

        } catch (error) {
            console.error('Failed to save AI settings:', error);
            alert(`Failed to save settings: ${error.message}`);
        }
    }

    /**
     * Update status display
     */
    updateStatusDisplay() {
        const statusDiv = document.getElementById('aiMethodStatus');
        
        if (this.currentMethod === 'vision') {
            const visionProcessor = this.getVisionProcessor();
            const hasApiKey = visionProcessor && visionProcessor.hasApiKey();
            
            if (hasApiKey) {
                statusDiv.className = 'alert alert-success';
                statusDiv.innerHTML = '<i class="fas fa-eye me-2"></i>Using Google Gemini Vision AI for direct PDF analysis';
            } else {
                statusDiv.className = 'alert alert-warning';
                statusDiv.innerHTML = '<i class="fas fa-exclamation-triangle me-2"></i>Vision AI selected but API key not configured';
            }
        } else {
            statusDiv.className = 'alert alert-secondary';
            statusDiv.innerHTML = '<i class="fas fa-info-circle me-2"></i>Using text extraction with local AI (Ollama)';
        }
    }

    /**
     * Get current processing method
     * @returns {string} Current method ('text' or 'vision')
     */
    getCurrentMethod() {
        return this.currentMethod;
    }

    /**
     * Check if vision processing is available and configured
     * @returns {boolean} True if vision processing can be used
     */
    isVisionAvailable() {
        const visionProcessor = this.getVisionProcessor();
        return this.currentMethod === 'vision' && 
               visionProcessor && 
               visionProcessor.hasApiKey();
    }

    /**
     * Get the appropriate processor for current settings
     * @returns {Object} Processor instance
     */
    getProcessor() {
        if (this.isVisionAvailable()) {
            return this.getVisionProcessor();
        } else {
            // Return text-based processor
            return (typeof window !== 'undefined' && window.invoiceProcessor) ? window.invoiceProcessor : null;
        }
    }
}

// Create global instance
const aiSettingsManager = new AISettingsManager();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AISettingsManager;
} else {
    window.AISettingsManager = AISettingsManager;
    window.aiSettingsManager = aiSettingsManager;
}