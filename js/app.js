// ============================================
// MAIN APPLICATION
// ============================================

class App {
    constructor() {
        this.data = null;
        this.isProcessing = false;
    }

    // Initialize the application
    async init() {
        try {
            // Show loading
            uiManager.showLoading(true, 'Initializing', 'Connecting to Google Drive...');

            // Initialize Google Drive API
            await driveAPI.init();

            uiManager.showStatus('Connected to Google Drive', 'success');

            // Auto-process if enabled
            if (CONFIG.APP.AUTO_REFRESH) {
                await this.processAll();
            }

            // Setup event listeners
            this.setupEventListeners();

        } catch (error) {
            console.error('Initialization error:', error);
            uiManager.showStatus('Failed to initialize: ' + error.message, 'danger');
            uiManager.showLoading(false);
        }
    }

    // Process all data
    async processAll() {
        if (this.isProcessing) {
            uiManager.showStatus('Already processing...', 'warning');
            return;
        }

        this.isProcessing = true;
        uiManager.showLoading(true, 'Processing Data', 'Loading orders from Google Drive...');

        try {
            // Process data
            this.data = await dataProcessor.processAll((progress, message) => {
                uiManager.updateLoadingProgress(progress, message);
            });

            // Store last processed time
            this.data.lastProcessed = new Date().toISOString();

            // Update UI
            uiManager.updateUI(this.data);

            uiManager.showStatus(
                `✅ Processing complete! ${this.data.pendingOrders.length} pending, ` +
                `${this.data.completeOrders.length} complete, ` +
                `${this.data.partialOrders.length} partial, ` +
                `${this.data.discrepancies.length} discrepancies`,
                'success'
            );

        } catch (error) {
            console.error('Processing error:', error);
            uiManager.showStatus('❌ Error: ' + error.message, 'danger');
        } finally {
            this.isProcessing = false;
            setTimeout(() => uiManager.showLoading(false), 500);
        }
    }

    // Setup event listeners
    setupEventListeners() {
        // Process button
        document.getElementById('processBtn').addEventListener('click', () => {
            this.processAll();
        });

        // Refresh button
        document.getElementById('refreshBtn').addEventListener('click', () => {
            this.processAll();
        });

        // Filter events
        document.getElementById('filterSupplier').addEventListener('change', () => {
            uiManager.applyFilters();
        });

        document.getElementById('filterSKU').addEventListener('keyup', (e) => {
            if (e.key === 'Enter') uiManager.applyFilters();
            else uiManager.applyFilters();
        });

        document.getElementById('filterDateFrom').addEventListener('change', () => {
            uiManager.applyFilters();
        });

        document.getElementById('filterDateTo').addEventListener('change', () => {
            uiManager.applyFilters();
        });

        document.getElementById('filterStatus').addEventListener('change', () => {
            uiManager.applyFilters();
        });

        // Clear filters button
        document.getElementById('clearFiltersBtn').addEventListener('click', () => {
            uiManager.clearFilters();
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'Enter') {
                e.preventDefault();
                this.processAll();
            }
            if (e.ctrlKey && e.key === 'f') {
                e.preventDefault();
                document.getElementById('filterSKU').focus();
            }
        });
    }

    // Get current data
    getData() {
        return this.data;
    }
}

// ============================================
// GLOBAL FUNCTIONS (for HTML onclick)
// ============================================

// Process all data
function processAll() {
    app.processAll();
}

// Refresh data
function refreshData() {
    app.processAll();
}

// Apply filters
function applyFilters() {
    uiManager.applyFilters();
}

// Clear filters
function clearFilters() {
    uiManager.clearFilters();
}

// Export data
function exportData(type) {
    const data = app.getData();
    if (!data) {
        alert('Please process data first');
        return;
    }
    exportManager.exportData(type, data);
}

// Download export
function downloadExport() {
    exportManager.downloadExport();
}

// Show supplier selector
function showSupplierSelector() {
    const data = app.getData();
    if (!data) {
        alert('Please process data first');
        return;
    }
    exportManager.showSupplierSelector(data);
}

// Show supplier report (called from modal)
window.showSupplierReport = function(supplier) {
    const data = app.getData();
    if (!data) return;
    exportManager.showSupplierReport(data, supplier);
};

// ============================================
// INITIALIZE APP
// ============================================

let app;

document.addEventListener('DOMContentLoaded', function() {
    // Load Google API first
    if (typeof gapi !== 'undefined') {
        gapi.load('client', function() {
            app = new App();
            app.init();
        });
    } else {
        console.error('Google API not loaded');
        document.getElementById('statusMessage').style.display = 'block';
        document.getElementById('statusText').textContent =
            'Google API not loaded. Please check internet connection.';
        document.getElementById('statusMessage').className = 'alert alert-danger alert-dismissible fade show';
    }
});