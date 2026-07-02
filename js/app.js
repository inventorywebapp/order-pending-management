// ============================================
// MAIN APPLICATION
// ============================================

class App {
    constructor() {
        this.data = null;
        this.isProcessing = false;
    }

    async init() {
        try {
            uiManager.showLoading(true, 'Connecting', 'Initializing Google Drive...');
            await driveAPI.init();
            uiManager.showStatus('Connected to Google Drive', 'success');

            if (CONFIG.APP.AUTO_REFRESH) {
                await this.processAll();
            }
            this.setupEvents();
        } catch (error) {
            console.error('Init error:', error);
            uiManager.showStatus('Failed to initialize: ' + error.message, 'danger');
            uiManager.showLoading(false);
        }
    }

    async processAll() {
        if (this.isProcessing) {
            uiManager.showStatus('Already processing...', 'warning');
            return;
        }
        this.isProcessing = true;
        uiManager.showLoading(true, 'Processing', 'Loading orders...');

        try {
            this.data = await dataProcessor.processAll((p, msg) => {
                uiManager.updateLoadingProgress(p, msg);
            });
            this.data.lastProcessed = new Date().toISOString();
            uiManager.updateUI(this.data);
            uiManager.showStatus(
                `✅ Complete: ${this.data.completeOrders.length} | Partial: ${this.data.partialOrders.length} | Pending: ${this.data.pendingOrders.length} | Discrepancies: ${this.data.discrepancies.length}`,
                'success'
            );
        } catch (error) {
            console.error('Processing error:', error);
            uiManager.showStatus('❌ Error: ' + error.message, 'danger');
        } finally {
            this.isProcessing = false;
            setTimeout(() => uiManager.showLoading(false), 400);
        }
    }

    setupEvents() {
        document.getElementById('processBtn').addEventListener('click', () => this.processAll());
        document.getElementById('refreshBtn').addEventListener('click', () => this.processAll());
        document.getElementById('filterSupplier').addEventListener('change', () => uiManager.applyFilters());
        document.getElementById('filterSKU').addEventListener('input', () => uiManager.applyFilters());
        document.getElementById('filterDateFrom').addEventListener('change', () => uiManager.applyFilters());
        document.getElementById('filterDateTo').addEventListener('change', () => uiManager.applyFilters());
        document.getElementById('filterStatus').addEventListener('change', () => uiManager.applyFilters());
        document.getElementById('clearFiltersBtn').addEventListener('click', () => uiManager.clearFilters());

        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'Enter') { e.preventDefault(); this.processAll(); }
            if (e.ctrlKey && e.key === 'f') { e.preventDefault(); document.getElementById('filterSKU').focus(); }
        });
    }

    getData() { return this.data; }
}

// Global functions for HTML
function processAll() { app.processAll(); }
function refreshData() { app.processAll(); }
function applyFilters() { uiManager.applyFilters(); }
function clearFilters() { uiManager.clearFilters(); }
function exportData(type) {
    const data = app.getData();
    if (!data) { alert('Please process data first.'); return; }
    exportManager.exportData(type, data);
}
function downloadExport() { exportManager.downloadExport(); }
function showSupplierSelector() {
    const data = app.getData();
    if (!data) { alert('Please process data first.'); return; }
    exportManager.showSupplierSelector(data);
}
window.showSupplierReport = function(supplier) {
    const data = app.getData();
    if (data) exportManager.showSupplierReport(data, supplier);
};

let app;
document.addEventListener('DOMContentLoaded', function() {
    if (typeof gapi !== 'undefined') {
        gapi.load('client', () => { app = new App(); app.init(); });
    } else {
        document.getElementById('statusText').textContent = 'Google API not loaded. Check internet.';
        document.getElementById('statusMessage').style.display = 'block';
        document.getElementById('statusMessage').className = 'alert alert-danger';
    }
});
