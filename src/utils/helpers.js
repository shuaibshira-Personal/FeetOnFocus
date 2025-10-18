/**
 * FeetOnFocus Utility Functions
 */

/**
 * Format currency values
 * @param {number} amount - Amount to format
 * @param {string} currency - Currency code (default: ZAR)
 * @returns {string} Formatted currency string
 */
function formatCurrency(amount, currency = 'ZAR') {
    return new Intl.NumberFormat('en-ZA', {
        style: 'currency',
        currency: currency
    }).format(amount || 0);
}

/**
 * Parse date from various formats including DD/MM/YY
 * @param {string} dateStr - Date string to parse
 * @returns {Date|null} Parsed date or null if invalid
 */
function parseDate(dateStr) {
    if (!dateStr) return null;
    
    // Handle DD/MM/YY format (e.g., "17/02/25")
    const ddmmyyMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (ddmmyyMatch) {
        let [, day, month, year] = ddmmyyMatch;
        
        // Convert 2-digit year to 4-digit (assume 20xx for years < 50, 19xx for >= 50)
        if (year.length === 2) {
            const yearNum = parseInt(year);
            year = yearNum < 50 ? `20${year}` : `19${year}`;
        }
        
        // Create date (month is 0-indexed)
        return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    }
    
    // Try standard JavaScript date parsing
    const standardDate = new Date(dateStr);
    return isNaN(standardDate.getTime()) ? null : standardDate;
}

/**
 * Format date for display
 * @param {string|Date} date - Date to format
 * @returns {string} Formatted date string
 */
function formatDate(date) {
    if (!date) return '';
    
    let d;
    if (typeof date === 'string') {
        d = parseDate(date);
        if (!d) return date; // Return original string if can't parse
    } else {
        d = date;
    }
    
    if (isNaN(d.getTime())) return date; // Return original if invalid date
    
    return d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

/**
 * Debounce function for search inputs
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Show toast notification
 * @param {string} message - Message to display
 * @param {string} type - Type of toast (success, error, warning, info)
 */
function showToast(message, type = 'info') {
    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast align-items-center text-white bg-${type === 'error' ? 'danger' : type} border-0`;
    toast.setAttribute('role', 'alert');
    toast.innerHTML = `
        <div class="d-flex">
            <div class="toast-body">
                ${message}
            </div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
        </div>
    `;

    // Add to toast container or create one
    let toastContainer = document.getElementById('toastContainer');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toastContainer';
        toastContainer.className = 'toast-container position-fixed bottom-0 end-0 p-3';
        document.body.appendChild(toastContainer);
    }

    toastContainer.appendChild(toast);

    // Show toast
    const bsToast = new bootstrap.Toast(toast);
    bsToast.show();

    // Remove toast element after it's hidden
    toast.addEventListener('hidden.bs.toast', () => {
        toast.remove();
    });
}

/**
 * Show loading spinner
 * @param {string} elementId - ID of element to show spinner in
 */
function showLoading(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        element.innerHTML = `
            <div class="d-flex justify-content-center">
                <div class="spinner-border" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
            </div>
        `;
    }
}

/**
 * Hide loading spinner and restore content
 * @param {string} elementId - ID of element to restore
 * @param {string} content - Content to restore
 */
function hideLoading(elementId, content) {
    const element = document.getElementById(elementId);
    if (element) {
        element.innerHTML = content;
    }
}

/**
 * Validate required form fields
 * @param {HTMLFormElement} form - Form element to validate
 * @returns {boolean} Whether form is valid
 */
function validateForm(form) {
    let isValid = true;
    const requiredFields = form.querySelectorAll('[required]');
    
    requiredFields.forEach(field => {
        if (!field.value.trim()) {
            field.classList.add('is-invalid');
            isValid = false;
        } else {
            field.classList.remove('is-invalid');
        }
    });
    
    return isValid;
}

/**
 * Clear form validation states
 * @param {HTMLFormElement} form - Form element to clear
 */
function clearFormValidation(form) {
    const fields = form.querySelectorAll('.is-invalid, .is-valid');
    fields.forEach(field => {
        field.classList.remove('is-invalid', 'is-valid');
    });
}

/**
 * Reset form to initial state
 * @param {HTMLFormElement} form - Form element to reset
 */
function resetForm(form) {
    form.reset();
    clearFormValidation(form);
    
    // Reset file input preview if exists
    const fileInputs = form.querySelectorAll('input[type="file"]');
    fileInputs.forEach(input => {
        const previewId = input.getAttribute('data-preview');
        if (previewId) {
            const preview = document.getElementById(previewId);
            if (preview) {
                preview.innerHTML = '';
            }
        }
    });
}

/**
 * Handle image file selection and preview
 * @param {HTMLInputElement} fileInput - File input element
 * @param {string} previewElementId - ID of preview element
 * @param {Function} callback - Callback function with file data
 */
function handleImageUpload(fileInput, previewElementId, callback) {
    const file = fileInput.files[0];
    if (!file) return;
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
        showToast('Please select a valid image file', 'error');
        fileInput.value = '';
        return;
    }
    
    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
        showToast('Image size must be less than 5MB', 'error');
        fileInput.value = '';
        return;
    }
    
    const reader = new FileReader();
    
    reader.onload = function(e) {
        // Show preview
        if (previewElementId) {
            const preview = document.getElementById(previewElementId);
            if (preview) {
                preview.innerHTML = `
                    <img src="${e.target.result}" 
                         alt="Preview" 
                         class="img-thumbnail" 
                         style="max-width: 200px; max-height: 200px;">
                `;
            }
        }
        
        // Call callback with file data
        if (callback) {
            callback({
                name: file.name,
                size: file.size,
                type: file.type,
                data: e.target.result
            });
        }
    };
    
    reader.readAsDataURL(file);
}

/**
 * Generate unique ID
 * @returns {string} Unique ID
 */
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

/**
 * Sanitize string for use as filename or ID
 * @param {string} str - String to sanitize
 * @returns {string} Sanitized string
 */
function sanitizeString(str) {
    return str.replace(/[^a-z0-9]/gi, '_').toLowerCase();
}

/**
 * Parse alternative names from comma-separated string
 * @param {string} altNamesStr - Comma-separated string
 * @returns {Array} Array of alternative names
 */
function parseAlternativeNames(altNamesStr) {
    if (!altNamesStr) return [];
    return altNamesStr.split(',')
        .map(name => name.trim())
        .filter(name => name.length > 0);
}

/**
 * Format alternative names for display
 * @param {Array} altNames - Array of alternative names
 * @returns {string} Formatted string
 */
function formatAlternativeNames(altNames) {
    if (!altNames || !Array.isArray(altNames) || altNames.length === 0) {
        return '';
    }
    return altNames.join(', ');
}

/**
 * Copy text to clipboard
 * @param {string} text - Text to copy
 */
async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        showToast('Copied to clipboard', 'success');
    } catch (err) {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        showToast('Copied to clipboard', 'success');
    }
}

/**
 * Download data as file
 * @param {string} data - Data to download
 * @param {string} filename - Filename
 * @param {string} mimeType - MIME type
 */
function downloadFile(data, filename, mimeType = 'text/plain') {
    const blob = new Blob([data], { type: mimeType });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
}