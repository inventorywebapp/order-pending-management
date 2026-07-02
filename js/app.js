// Main Application
class OrderManagementApp {
    constructor() {
        this.data = {
            orders: [],
            deliveries: [],
            actual: [],
            pending: [],
            processed: false
        };
        this.filters = {
            supplier: '',
            dateFrom: '',
            dateTo: '',
            sku: '',
            status: ''
        };
        this.currentView = 'dashboard';
        
        this.init();
    }

    async init() {
        // Initialize Google Drive
        try {
            await driveManager.init();
            console.log('Google Drive initialized successfully');
        } catch (error) {
            console.error('Failed to initialize Google Drive:', error);
            this.showNotification('Failed to initialize Google Drive. Please check your configuration.', 'error');
        }

        // Setup event listeners
        this.setupEventListeners();
        
        // Load data from Google Drive
        await this.loadData();
        
        // Render initial view
        this.renderDashboard();
        this.renderOrders();
        this.renderDeliveries();
        this.renderActual();
        this.renderPending();
        
        // Update supplier filters
        this.updateSupplierFilters();
        
        // Add new features
        this.addMismatchChecker();
        this.addBossExport();
        
        console.log('App initialized successfully');
    }

    setupEventListeners() {
        // Navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const view = item.dataset.view;
                this.switchView(view);
            });
        });

        // Menu toggle (mobile)
        document.getElementById('menuToggle').addEventListener('click', () => {
            document.getElementById('sidebar').classList.toggle('open');
        });

        // Refresh button
        document.getElementById('refreshData').addEventListener('click', async () => {
            await this.loadData();
            this.renderAll();
            this.showNotification('Data refreshed successfully!', 'success');
        });

        // Upload button
        document.getElementById('uploadBtn').addEventListener('click', () => {
            this.openUploadModal();
        });

        // Filter button
        document.getElementById('filterBtn').addEventListener('click', () => {
            this.openFilterModal();
        });

        // Close modals
        document.querySelectorAll('.close-modal').forEach(btn => {
            btn.addEventListener('click', () => {
                btn.closest('.modal').classList.remove('active');
            });
        });

        // Modal close on outside click
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.remove('active');
                }
            });
        });

        // Upload modal
        document.getElementById('cancelUpload').addEventListener('click', () => {
            document.getElementById('uploadModal').classList.remove('active');
        });

        document.getElementById('processUpload').addEventListener('click', () => {
            this.processUploads();
        });

        // Filter modal
        document.getElementById('applyFilters').addEventListener('click', () => {
            this.applyFilters();
        });

        document.getElementById('clearFilters').addEventListener('click', () => {
            this.clearFilters();
        });

        // Search inputs
        document.getElementById('orderSearch').addEventListener('input', (e) => {
            this.filterOrders(e.target.value);
        });

        document.getElementById('deliverySearch').addEventListener('input', (e) => {
            this.filterDeliveries(e.target.value);
        });

        document.getElementById('actualSearch').addEventListener('input', (e) => {
            this.filterActual(e.target.value);
        });

        document.getElementById('pendingSearch').addEventListener('input', (e) => {
            this.filterPending(e.target.value);
        });

        // Supplier filters
        document.getElementById('orderSupplierFilter').addEventListener('change', (e) => {
            this.filterOrdersBySupplier(e.target.value);
        });

        document.getElementById('pendingSupplierFilter').addEventListener('change', (e) => {
            this.filterPendingBySupplier(e.target.value);
        });

        // Analysis
        document.getElementById('analysisType').addEventListener('change', () => {
            this.renderAnalysis();
        });

        document.getElementById('exportBtn').addEventListener('click', () => {
            this.exportData();
        });

        // Drop zones
        this.setupDropZones();
    }

    async loadData() {
        try {
            this.showLoading(true);
            
            // Load files from all folders
            const orderFiles = await driveManager.listFiles(CONFIG.FOLDERS.ORDER);
            const deliveryFiles = await driveManager.listFiles(CONFIG.FOLDERS.DELIVERY);
            const actualFiles = await driveManager.listFiles(CONFIG.FOLDERS.ACTUAL);
            
            // Process Excel files
            const orders = await this.processExcelFiles(orderFiles, 'order');
            const deliveries = await this.processExcelFiles(deliveryFiles, 'delivery');
            const actual = await this.processExcelFiles(actualFiles, 'actual');
            
            // Update data
            this.data.orders = orders;
            this.data.deliveries = deliveries;
            this.data.actual = actual;
            
            // Process pending orders
            this.processPendingOrders();
            
            this.data.processed = true;
            this.showLoading(false);
            
            // Update UI
            this.updateStats();
            this.updateActivity();
            
        } catch (error) {
            console.error('Error loading data:', error);
            this.showNotification('Failed to load data from Google Drive', 'error');
            this.showLoading(false);
        }
    }

    async processExcelFiles(files, type) {
        const data = [];
        
        for (const file of files) {
            if (file.mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
                file.mimeType === 'application/vnd.ms-excel') {
                try {
                    const content = await driveManager.downloadFile(file.id);
                    // Parse Excel content
                    const parsedData = this.parseExcelData(content, type);
                    data.push(...parsedData);
                } catch (error) {
                    console.error(`Error processing file ${file.name}:`, error);
                }
            }
        }
        
        return data;
    }

    parseExcelData(content, type) {
        // This is a placeholder - implement actual Excel parsing
        // For now, return mock data
        console.log(`Parsing ${type} data`);
        return [];
    }

    processPendingOrders() {
        const pending = [];
        const orderMap = new Map();
        const deliveryMap = new Map();
        
        // Aggregate orders by SKU and supplier
        this.data.orders.forEach(order => {
            const key = `${order.sku}-${order.supplier}`;
            if (!orderMap.has(key)) {
                orderMap.set(key, {
                    sku: order.sku,
                    supplier: order.supplier,
                    totalOrder: 0,
                    delivered: 0,
                    orders: []
                });
            }
            const entry = orderMap.get(key);
            entry.totalOrder += order.qty;
            entry.orders.push(order);
        });
        
        // Aggregate deliveries by SKU and supplier
        this.data.deliveries.forEach(delivery => {
            const key = `${delivery.sku}-${delivery.supplier}`;
            if (!deliveryMap.has(key)) {
                deliveryMap.set(key, 0);
            }
            deliveryMap.set(key, deliveryMap.get(key) + delivery.qty);
        });
        
        // Calculate pending
        orderMap.forEach((value, key) => {
            const delivered = deliveryMap.get(key) || 0;
            const remaining = value.totalOrder - delivered;
            
            if (remaining > 0 || delivered > 0) {
                pending.push({
                    sku: value.sku,
                    supplier: value.supplier,
                    totalOrder: value.totalOrder,
                    delivered: delivered,
                    remaining: Math.max(0, remaining),
                    status: remaining === 0 ? 'completed' : delivered > 0 ? 'partial' : 'pending',
                    orderDate: value.orders[0].orderDate,
                    orderCode: value.orders[0].orderCode,
                    note: '' // Add note field for manual corrections
                });
            }
        });
        
        // Sort pending orders by date (oldest first)
        pending.sort((a, b) => new Date(a.orderDate) - new Date(b.orderDate));
        
        this.data.pending = pending;
    }

    // ============ NEW FEATURES ============

    // Feature 1: Export Pending Orders with Details
    exportPendingOrders(format = 'csv') {
        const pendingData = this.data.pending.map(p => ({
            'SKU': p.sku,
            'Supplier': p.supplier,
            'Total Order': p.totalOrder,
            'Delivered': p.delivered,
            'Remaining': p.remaining,
            'Status': p.status,
            'Order Date': p.orderDate,
            'Order Code': p.orderCode,
            'Note': p.note || ''
        }));

        if (format === 'csv') {
            this.exportToCSV(pendingData, 'pending_orders');
        } else if (format === 'excel') {
            this.exportToExcel(pendingData, 'pending_orders');
        } else if (format === 'pdf') {
            this.exportToPDF(pendingData);
        }
    }

    exportToCSV(data, filename) {
        if (!data || data.length === 0) {
            this.showNotification('No data to export', 'warning');
            return;
        }
        
        const headers = Object.keys(data[0]);
        let csv = headers.join(',') + '\n';
        data.forEach(row => {
            csv += headers.map(h => `"${row[h] || ''}"`).join(',') + '\n';
        });
        
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        
        this.showNotification(`✅ Exported ${data.length} records to CSV`, 'success');
    }

    exportToExcel(data, filename) {
        if (!data || data.length === 0) {
            this.showNotification('No data to export', 'warning');
            return;
        }
        
        // Simple HTML table export (can be opened in Excel)
        let html = `<html><head><meta charset="UTF-8"><title>${filename}</title>`;
        html += `<style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            h1 { color: #4F46E5; }
            table { border-collapse: collapse; width: 100%; margin-top: 20px; }
            th { background: #4F46E5; color: white; padding: 10px; text-align: left; }
            td { padding: 8px; border: 1px solid #ddd; }
            tr:nth-child(even) { background: #f9f9f9; }
            .summary { margin: 20px 0; padding: 15px; background: #f0f4ff; border-radius: 8px; }
        </style></head><body>`;
        html += `<h1>📊 Pending Orders Report</h1>`;
        html += `<div class="summary">
            <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
            <p><strong>Total Records:</strong> ${data.length}</p>
            <p><strong>Total Pending Quantity:</strong> ${data.reduce((sum, row) => sum + (row.Remaining || 0), 0)}</p>
        </div>`;
        html += `<table>`;
        
        // Headers
        const headers = Object.keys(data[0]);
        html += '<thead><tr>';
        headers.forEach(h => html += `<th>${h}</th>`);
        html += '</tr></thead><tbody>';
        
        // Data
        data.forEach(row => {
            html += '<tr>';
            headers.forEach(h => html += `<td>${row[h] || ''}</td>`);
            html += '</tr>';
        });
        
        html += '</tbody></table>';
        html += `<p style="margin-top: 20px; color: #666; font-size: 12px;">Generated by Order Pending Management System</p>`;
        html += '</body></html>';
        
        const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${filename}_${new Date().toISOString().split('T')[0]}.xls`;
        a.click();
        URL.revokeObjectURL(url);
        
        this.showNotification(`✅ Exported ${data.length} records to Excel`, 'success');
    }

    exportToPDF(data) {
        if (!data || data.length === 0) {
            this.showNotification('No data to export', 'warning');
            return;
        }
        
        // Simple text-based PDF (using window.print)
        const printWindow = window.open('', '_blank', 'width=800,height=600');
        let content = '<html><head><title>Pending Orders Report</title>';
        content += `<style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            h1 { color: #4F46E5; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th { background: #4F46E5; color: white; padding: 10px; text-align: left; }
            td { padding: 8px; border: 1px solid #ddd; }
            tr:nth-child(even) { background: #f9f9f9; }
            .summary { margin: 20px 0; padding: 15px; background: #f0f4ff; border-radius: 8px; }
            @media print { .no-print { display: none; } }
        </style>`;
        content += '</head><body>';
        content += `<h1>📊 Pending Orders Report</h1>`;
        content += `<div class="summary">
            <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
            <p><strong>Total Records:</strong> ${data.length}</p>
            <p><strong>Total Pending Quantity:</strong> ${data.reduce((sum, row) => sum + (row.Remaining || 0), 0)}</p>
        </div>`;
        content += `<table>`;
        
        const headers = Object.keys(data[0]);
        content += '<thead><tr>';
        headers.forEach(h => content += `<th>${h}</th>`);
        content += '</tr></thead><tbody>';
        
        data.forEach(row => {
            content += '<tr>';
            headers.forEach(h => content += `<td>${row[h] || ''}</td>`);
            content += '</tr>';
        });
        
        content += '</tbody></table>';
        content += `<p style="margin-top: 20px; color: #666; font-size: 12px;">Generated by Order Pending Management System</p>`;
        content += `<button class="no-print" onclick="window.print()" style="margin-top:20px; padding:10px 20px; background:#4F46E5; color:white; border:none; border-radius:4px; cursor:pointer;">🖨️ Print / Save as PDF</button>`;
        content += '</body></html>';
        
        printWindow.document.write(content);
        printWindow.document.close();
    }

    // Feature 2: Find SKUs Not in Order
    findSKUsNotInOrder() {
        const orderSKUs = new Set(this.data.orders.map(o => o.sku));
        const deliverySKUs = new Set(this.data.deliveries.map(d => d.sku));
        const actualSKUs = new Set(this.data.actual.map(a => a.sku));
        
        const allSKUs = new Set([...deliverySKUs, ...actualSKUs]);
        const notInOrder = [...allSKUs].filter(sku => !orderSKUs.has(sku));
        
        // Get details for flagged SKUs
        const flaggedItems = [];
        this.data.deliveries.forEach(d => {
            if (notInOrder.includes(d.sku)) {
                flaggedItems.push({
                    sku: d.sku,
                    supplier: d.supplier,
                    qty: d.qty,
                    source: 'Delivery',
                    boxCode: d.boxCode,
                    deliveryDate: d.deliveryDate
                });
            }
        });
        this.data.actual.forEach(a => {
            if (notInOrder.includes(a.sku)) {
                flaggedItems.push({
                    sku: a.sku,
                    supplier: a.supplier,
                    qty: a.qty,
                    source: 'Actual Received',
                    boxCode: a.boxCode,
                    deliveryDate: a.actualDate
                });
            }
        });
        
        return flaggedItems;
    }

    renderFlaggedSKUs() {
        const flagged = this.findSKUsNotInOrder();
        if (flagged.length === 0) {
            this.showNotification('✅ All SKUs in deliveries match orders!', 'success');
            return;
        }
        
        // Create modal to display flagged items
        const modal = document.createElement('div');
        modal.className = 'modal active';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 800px;">
                <div class="modal-header">
                    <h2>⚠️ SKUs Not Found in Orders</h2>
                    <button class="close-modal">&times;</button>
                </div>
                <div class="modal-body">
                    <p style="margin-bottom: 16px; color: #DC2626;">
                        <strong>${flagged.length}</strong> SKU(s) appear in deliveries but are not in any order file:
                    </p>
                    <div class="table-wrapper">
                        <table>
                            <thead>
                                <tr>
                                    <th>SKU</th>
                                    <th>Supplier</th>
                                    <th>Qty</th>
                                    <th>Source</th>
                                    <th>Box Code</th>
                                    <th>Date</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${flagged.map(item => `
                                    <tr>
                                        <td><strong>${item.sku}</strong></td>
                                        <td>${item.supplier}</td>
                                        <td>${item.qty}</td>
                                        <td><span class="status-badge status-mismatch">${item.source}</span></td>
                                        <td>${item.boxCode || '-'}</td>
                                        <td>${this.formatDate(item.deliveryDate)}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                    <div class="flag-actions" style="margin-top: 20px; padding: 16px; background: #FEF3C7; border-radius: 8px;">
                        <p style="font-weight: 600; margin-bottom: 12px;">What would you like to do?</p>
                        <div style="display: flex; gap: 12px; flex-wrap: wrap;">
                            <button class="btn-primary" onclick="app.flagSKUCorrection()">
                                <i class="fas fa-edit"></i> Correct SKU in Order
                            </button>
                            <button class="btn-secondary" onclick="app.flagAddNewOrder()">
                                <i class="fas fa-plus"></i> Create New Order
                            </button>
                            <button class="btn-secondary" onclick="app.exportMismatches()">
                                <i class="fas fa-file-export"></i> Export Mismatches
                            </button>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn-secondary" onclick="this.closest('.modal').remove()">Close</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        
        // Close button
        modal.querySelector('.close-modal').addEventListener('click', () => modal.remove());
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });
    }

    // Feature 3: Correct SKU in Order (Manual Edit)
    flagSKUCorrection() {
        const flagged = this.findSKUsNotInOrder();
        if (flagged.length === 0) {
            this.showNotification('No mismatches to correct', 'info');
            return;
        }
        
        const modal = document.createElement('div');
        modal.className = 'modal active';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 700px;">
                <div class="modal-header">
                    <h2>✏️ Correct SKU in Order</h2>
                    <button class="close-modal">&times;</button>
                </div>
                <div class="modal-body">
                    <p style="margin-bottom: 16px; color: #666;">Update the SKU in the order file to match the delivery:</p>
                    <div class="correction-form">
                        ${flagged.map((item, index) => `
                            <div class="correction-item" style="margin-bottom: 16px; padding: 16px; background: #F9FAFB; border-radius: 8px; border-left: 4px solid #F59E0B;">
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                                    <div>
                                        <label style="font-size: 12px; font-weight: 600; color: #6B7280;">Delivery SKU:</label>
                                        <p style="font-weight: 600; color: #DC2626;">${item.sku}</p>
                                    </div>
                                    <div>
                                        <label style="font-size: 12px; font-weight: 600; color: #6B7280;">Supplier:</label>
                                        <p>${item.supplier}</p>
                                    </div>
                                </div>
                                <div style="margin-top: 12px;">
                                    <label style="font-size: 14px; font-weight: 500;">Correct SKU for Order:</label>
                                    <input type="text" id="correct_sku_${index}" value="${item.sku}" 
                                        style="width: 100%; padding: 8px; margin-top: 4px; border: 2px solid #E5E7EB; border-radius: 4px; font-size: 14px;">
                                    <small style="color: #6B7280;">Enter the correct SKU as it should appear in the order file</small>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                    <div style="margin-top: 16px; padding: 12px; background: #EBF5FF; border-radius: 8px;">
                        <p style="font-size: 14px; color: #1E40AF;">
                            <i class="fas fa-info-circle"></i> 
                            <strong>Note:</strong> You'll need to update the actual Excel file in Google Drive after making this change.
                            The system will help you locate the file.
                        </p>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn-secondary" onclick="this.closest('.modal').remove()">Cancel</button>
                    <button class="btn-primary" id="applyCorrection">
                        <i class="fas fa-save"></i> Apply Corrections
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        
        modal.querySelector('#applyCorrection').addEventListener('click', () => {
            const corrections = [];
            flagged.forEach((item, index) => {
                const input = document.getElementById(`correct_sku_${index}`);
                const newSku = input.value.trim();
                if (newSku && newSku !== item.sku) {
                    corrections.push({
                        oldSku: item.sku,
                        newSku: newSku,
                        supplier: item.supplier
                    });
                }
            });
            
            if (corrections.length > 0) {
                this.applySKUCorrections(corrections);
                modal.remove();
            } else {
                this.showNotification('No changes made', 'info');
                modal.remove();
            }
        });
        
        modal.querySelector('.close-modal').addEventListener('click', () => modal.remove());
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });
    }

    async applySKUCorrections(corrections) {
        try {
            this.showLoading(true);
            
            // Show which files need updating
            let message = '📝 Please update these SKUs in your order files:\n\n';
            corrections.forEach(c => {
                message += `• Change "${c.oldSku}" to "${c.newSku}" (Supplier: ${c.supplier})\n`;
            });
            message += '\n📍 Go to: Google Drive > Order folder > Find the Excel file with these SKUs';
            
            this.showLoading(false);
            this.showNotification(message, 'info');
            
            // Ask if user wants to open Google Drive
            if (confirm('Would you like to open Google Drive to update the files?')) {
                window.open('https://drive.google.com/drive/folders/' + CONFIG.FOLDERS.ORDER, '_blank');
            }
            
            // Wait for user to confirm they've updated
            if (confirm('After updating the files in Google Drive, click OK to refresh the data.')) {
                await this.loadData();
                this.renderAll();
                this.showNotification('✅ Data refreshed with updated SKUs!', 'success');
            }
            
        } catch (error) {
            console.error('Error applying corrections:', error);
            this.showLoading(false);
            this.showNotification('❌ Failed to apply corrections. Please try again.', 'error');
        }
    }

    flagAddNewOrder() {
        const flagged = this.findSKUsNotInOrder();
        if (flagged.length === 0) return;
        
        // Create a template for new order
        let csvContent = 'SKU,Order Qty,Supplier,Order Date,Order Code\n';
        flagged.forEach(item => {
            const today = new Date().toISOString().split('T')[0];
            csvContent += `${item.sku},${item.qty},${item.supplier},${today},NEW-ORDER-${Date.now()}\n`;
        });
        
        // Download template
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `new_orders_template_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        
        this.showNotification('📄 New order template downloaded! Upload it to Google Drive.', 'success');
    }

    exportMismatches() {
        const flagged = this.findSKUsNotInOrder();
        if (flagged.length === 0) {
            this.showNotification('No mismatches to export', 'info');
            return;
        }
        
        const data = flagged.map(item => ({
            'SKU': item.sku,
            'Supplier': item.supplier,
            'Quantity': item.qty,
            'Source': item.source,
            'Box Code': item.boxCode || '',
            'Date': item.deliveryDate
        }));
        
        this.exportToCSV(data, 'sku_mismatches');
    }

    // Feature 4: Boss Export with detailed view
    addBossExport() {
        // Add to Analysis view
        const analysisContainer = document.getElementById('analysisContent');
        const existingExport = document.querySelector('.boss-export');
        if (existingExport) {
            existingExport.remove();
        }
        
        const exportContainer = document.createElement('div');
        exportContainer.className = 'boss-export';
        exportContainer.style.cssText = `
            margin: 20px 0;
            padding: 20px;
            background: white;
            border-radius: 12px;
            box-shadow: var(--shadow);
        `;
        
        const suppliers = [...new Set(this.data.orders.map(o => o.supplier))];
        
        exportContainer.innerHTML = `
            <h3 style="display: flex; align-items: center; gap: 8px; margin-bottom: 16px;">
                <i class="fas fa-file-export" style="color: var(--primary);"></i> 
                Export Reports for Boss
            </h3>
            <div style="display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 12px;">
                <button class="btn-primary" id="exportPendingCSV">
                    <i class="fas fa-file-csv"></i> Export Pending (CSV)
                </button>
                <button class="btn-primary" id="exportDetailedExcel">
                    <i class="fas fa-file-excel"></i> Export Detailed (Excel)
                </button>
                <button class="btn-primary" id="exportPDF">
                    <i class="fas fa-file-pdf"></i> Export Summary (PDF)
                </button>
                <button class="btn-secondary" id="exportBySupplier">
                    <i class="fas fa-filter"></i> Export by Supplier
                </button>
                <button class="btn-secondary" id="checkMismatchesBtn">
                    <i class="fas fa-exclamation-triangle"></i> Check SKU Mismatches
                </button>
            </div>
            <div style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap;">
                <label style="font-weight: 500;">Filter by Supplier:</label>
                <select id="supplierExportSelect" style="padding: 8px 12px; border: 1px solid var(--gray-200); border-radius: 4px; min-width: 150px;">
                    <option value="">All Suppliers</option>
                    ${suppliers.map(s => `<option value="${s}">${s}</option>`).join('')}
                </select>
                <span style="color: var(--gray-500); font-size: 14px;">
                    <i class="fas fa-info-circle"></i> 
                    ${this.data.pending.length} pending orders, 
                    ${this.data.orders.length} total orders
                </span>
            </div>
        `;
        
        // Insert at the top of analysis content
        if (analysisContainer) {
            analysisContainer.parentNode.insertBefore(exportContainer, analysisContainer);
        }
        
        // Event listeners
        document.getElementById('exportPendingCSV')?.addEventListener('click', () => {
            this.exportPendingOrders('csv');
        });
        
        document.getElementById('exportDetailedExcel')?.addEventListener('click', () => {
            this.exportPendingOrders('excel');
        });
        
        document.getElementById('exportPDF')?.addEventListener('click', () => {
            this.exportPendingOrders('pdf');
        });
        
        document.getElementById('exportBySupplier')?.addEventListener('click', () => {
            const supplier = document.getElementById('supplierExportSelect').value;
            if (supplier) {
                this.exportBySupplier(supplier);
            } else {
                this.showNotification('Please select a supplier first', 'warning');
            }
        });
        
        document.getElementById('checkMismatchesBtn')?.addEventListener('click', () => {
            this.renderFlaggedSKUs();
        });
    }

    exportBySupplier(supplier) {
        const supplierData = this.data.pending.filter(p => p.supplier === supplier);
        if (supplierData.length === 0) {
            this.showNotification(`No data found for supplier: ${supplier}`, 'info');
            return;
        }
        
        const data = supplierData.map(p => ({
            'SKU': p.sku,
            'Total Order': p.totalOrder,
            'Delivered': p.delivered,
            'Remaining': p.remaining,
            'Status': p.status,
            'Order Date': p.orderDate,
            'Order Code': p.orderCode
        }));
        
        this.exportToCSV(data, `${supplier}_orders`);
        this.showNotification(`✅ Exported ${data.length} records for ${supplier}`, 'success');
    }

    // Feature 5: Add mismatch checker button to dashboard
    addMismatchChecker() {
        const dashboard = document.getElementById('view-dashboard');
        const existingChecker = document.querySelector('.mismatch-checker');
        if (existingChecker) {
            existingChecker.remove();
        }
        
        const container = document.createElement('div');
        container.className = 'mismatch-checker';
        container.style.cssText = `
            margin: 20px 0;
            padding: 16px 20px;
            background: white;
            border-radius: 12px;
            box-shadow: var(--shadow);
            display: flex;
            align-items: center;
            justify-content: space-between;
            flex-wrap: wrap;
            gap: 12px;
        `;
        
        const mismatchCount = this.findSKUsNotInOrder().length;
        
        container.innerHTML = `
            <div style="display: flex; align-items: center; gap: 12px;">
                <i class="fas fa-exclamation-triangle" style="color: ${mismatchCount > 0 ? '#F59E0B' : '#10B981'}; font-size: 24px;"></i>
                <div>
                    <h4 style="font-weight: 600; margin: 0;">SKU Mismatch Checker</h4>
                    <p style="margin: 0; color: var(--gray-500); font-size: 14px;">
                        ${mismatchCount === 0 ? '✅ All SKUs match! No mismatches found.' : `⚠️ ${mismatchCount} SKU(s) found in deliveries not in orders`}
                    </p>
                </div>
            </div>
            <button class="btn-${mismatchCount > 0 ? 'primary' : 'secondary'}" id="checkMismatches">
                <i class="fas fa-search"></i> ${mismatchCount > 0 ? 'View Mismatches' : 'Check SKUs'}
            </button>
        `;
        
        // Insert after stats grid
        const statsGrid = dashboard.querySelector('.stats-grid');
        if (statsGrid) {
            statsGrid.parentNode.insertBefore(container, statsGrid.nextSibling);
        } else {
            dashboard.prepend(container);
        }
        
        document.getElementById('checkMismatches')?.addEventListener('click', () => {
            this.renderFlaggedSKUs();
        });
    }

    // ============ END OF NEW FEATURES ============

    // Rendering methods
    renderDashboard() {
        this.updateStats();
        this.updateActivity();
        this.addMismatchChecker(); // Refresh mismatch checker
    }

    updateStats() {
        const totalOrders = this.data.orders.reduce((sum, o) => sum + o.qty, 0);
        const totalDeliveries = this.data.deliveries.reduce((sum, d) => sum + d.qty, 0);
        const completed = this.data.pending.filter(p => p.status === 'completed').length;
        const pending = this.data.pending.filter(p => p.status === 'pending' || p.status === 'partial').length;
        
        document.getElementById('totalOrders').textContent = totalOrders;
        document.getElementById('totalDeliveries').textContent = totalDeliveries;
        document.getElementById('completedOrders').textContent = this.data.pending.filter(p => p.status === 'completed').length;
        document.getElementById('pendingOrders').textContent = pending;
    }

    updateActivity() {
        const activityList = document.getElementById('activityList');
        const activities = [];
        
        // Add recent orders
        this.data.orders.slice(0, 5).forEach(order => {
            activities.push({
                type: 'order',
                message: `Order ${order.orderCode}: ${order.sku} x${order.qty} from ${order.supplier}`,
                date: order.orderDate
            });
        });
        
        // Add recent deliveries
        this.data.deliveries.slice(0, 5).forEach(delivery => {
            activities.push({
                type: 'delivery',
                message: `Delivery: ${delivery.sku} x${delivery.qty} from ${delivery.supplier}`,
                date: delivery.deliveryDate
            });
        });
        
        // Sort by date (newest first)
        activities.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        activityList.innerHTML = activities.slice(0, 10).map(activity => `
            <div class="activity-item">
                <div class="activity-icon ${activity.type}">
                    <i class="fas ${activity.type === 'order' ? 'fa-shopping-cart' : 'fa-truck'}"></i>
                </div>
                <div class="activity-content">
                    <p>${activity.message}</p>
                    <small>${this.formatDate(activity.date)}</small>
                </div>
            </div>
        `).join('');
    }

    renderOrders() {
        const tbody = document.getElementById('ordersBody');
        tbody.innerHTML = this.data.orders.map(order => `
            <tr>
                <td><strong>${order.sku}</strong></td>
                <td>${order.qty}</td>
                <td>${order.supplier}</td>
                <td>${this.formatDate(order.orderDate)}</td>
                <td>${order.orderCode}</td>
                <td><span class="status-badge status-pending">Pending</span></td>
                <td>${order.qty}</td>
            </tr>
        `).join('');
    }

    renderDeliveries() {
        const tbody = document.getElementById('deliveriesBody');
        tbody.innerHTML = this.data.deliveries.map(delivery => `
            <tr>
                <td><strong>${delivery.sku}</strong></td>
                <td>${delivery.qty}</td>
                <td>${delivery.supplier}</td>
                <td>${this.formatDate(delivery.deliveryDate)}</td>
                <td>${delivery.boxCode || '-'}</td>
                <td><span class="status-badge status-partial">In Transit</span></td>
            </tr>
        `).join('');
    }

    renderActual() {
        const tbody = document.getElementById('actualBody');
        tbody.innerHTML = this.data.actual.map(actual => `
            <tr>
                <td><strong>${actual.sku}</strong></td>
                <td>${actual.qty}</td>
                <td>${actual.supplier}</td>
                <td>${this.formatDate(actual.actualDate)}</td>
                <td>${actual.boxCode || '-'}</td>
                <td><span class="status-badge status-completed">Received</span></td>
            </tr>
        `).join('');
    }

    renderPending() {
        const tbody = document.getElementById('pendingBody');
        tbody.innerHTML = this.data.pending.map(pending => `
            <tr>
                <td><strong>${pending.sku}</strong></td>
                <td>${pending.totalOrder}</td>
                <td>${pending.delivered}</td>
                <td>${pending.remaining}</td>
                <td>${pending.supplier}</td>
                <td>${this.formatDate(pending.orderDate)}</td>
                <td><span class="status-badge status-${pending.status}">${pending.status}</span></td>
            </tr>
        `).join('');
    }

    renderAnalysis() {
        const type = document.getElementById('analysisType').value;
        const container = document.getElementById('analysisContent');
        
        let analysisData = [];
        
        if (type === 'supplier') {
            // Group by supplier
            const supplierMap = new Map();
            this.data.pending.forEach(p => {
                if (!supplierMap.has(p.supplier)) {
                    supplierMap.set(p.supplier, { total: 0, pending: 0, completed: 0 });
                }
                const entry = supplierMap.get(p.supplier);
                entry.total += p.totalOrder;
                if (p.status === 'completed') {
                    entry.completed += p.totalOrder;
                } else {
                    entry.pending += p.remaining;
                }
            });
            
            analysisData = Array.from(supplierMap.entries()).map(([supplier, data]) => ({
                name: supplier,
                total: data.total,
                pending: data.pending,
                completed: data.completed,
                completionRate: data.total > 0 ? (data.completed / data.total * 100).toFixed(1) : 0
            }));
        } else if (type === 'sku') {
            // Group by SKU
            const skuMap = new Map();
            this.data.pending.forEach(p => {
                if (!skuMap.has(p.sku)) {
                    skuMap.set(p.sku, { total: 0, pending: 0, completed: 0 });
                }
                const entry = skuMap.get(p.sku);
                entry.total += p.totalOrder;
                if (p.status === 'completed') {
                    entry.completed += p.totalOrder;
                } else {
                    entry.pending += p.remaining;
                }
            });
            
            analysisData = Array.from(skuMap.entries()).map(([sku, data]) => ({
                name: sku,
                total: data.total,
                pending: data.pending,
                completed: data.completed,
                completionRate: data.total > 0 ? (data.completed / data.total * 100).toFixed(1) : 0
            }));
        } else {
            // Date analysis
            const dateMap = new Map();
            this.data.pending.forEach(p => {
                const date = p.orderDate.split('T')[0];
                if (!dateMap.has(date)) {
                    dateMap.set(date, { total: 0, pending: 0, completed: 0 });
                }
                const entry = dateMap.get(date);
                entry.total += p.totalOrder;
                if (p.status === 'completed') {
                    entry.completed += p.totalOrder;
                } else {
                    entry.pending += p.remaining;
                }
            });
            
            analysisData = Array.from(dateMap.entries()).map(([date, data]) => ({
                name: date,
                total: data.total,
                pending: data.pending,
                completed: data.completed,
                completionRate: data.total > 0 ? (data.completed / data.total * 100).toFixed(1) : 0
            }));
        }
        
        // Render analysis
        container.innerHTML = `
            <div class="analysis-table-wrapper">
                <table>
                    <thead>
                        <tr>
                            <th>${type === 'date' ? 'Date' : type === 'supplier' ? 'Supplier' : 'SKU'}</th>
                            <th>Total</th>
                            <th>Completed</th>
                            <th>Pending</th>
                            <th>Completion Rate</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${analysisData.map(item => `
                            <tr>
                                <td><strong>${item.name}</strong></td>
                                <td>${item.total}</td>
                                <td>${item.completed}</td>
                                <td>${item.pending}</td>
                                <td>
                                    <div class="progress-bar">
                                        <div class="progress-fill" style="width: ${item.completionRate}%"></div>
                                        <span>${item.completionRate}%</span>
                                    </div>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    // Utility methods
    switchView(view) {
        // Update navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.toggle('active', item.dataset.view === view);
        });
        
        // Update views
        document.querySelectorAll('.view').forEach(v => {
            v.classList.toggle('active', v.id === `view-${view}`);
        });
        
        // Update header
        const titles = {
            dashboard: ['Dashboard', 'Overview of your order management'],
            orders: ['Orders', 'Manage and track all orders'],
            deliveries: ['Deliveries', 'Track all deliveries'],
            actual: ['Actual Received', 'View actual received items'],
            pending: ['Pending Orders', 'View and manage pending orders'],
            analysis: ['Analysis', 'Analyze order data and generate reports']
        };
        
        const [title, subtitle] = titles[view] || ['Dashboard', ''];
        document.getElementById('pageTitle').textContent = title;
        document.getElementById('pageSubtitle').textContent = subtitle;
        
        this.currentView = view;
        
        // Render specific view content if needed
        if (view === 'analysis') {
            this.renderAnalysis();
            this.addBossExport(); // Re-add boss export when switching to analysis
        }
        
        // Close sidebar on mobile
        if (window.innerWidth <= 768) {
            document.getElementById('sidebar').classList.remove('open');
        }
    }

    openUploadModal() {
        document.getElementById('uploadModal').classList.add('active');
        // Reset file inputs
        document.getElementById('orderFiles').value = '';
        document.getElementById('deliveryFiles').value = '';
        document.getElementById('actualFiles').value = '';
    }

    openFilterModal() {
        document.getElementById('filterModal').classList.add('active');
        // Load current filter values
        document.getElementById('filterSupplier').value = this.filters.supplier;
        document.getElementById('filterDateFrom').value = this.filters.dateFrom;
        document.getElementById('filterDateTo').value = this.filters.dateTo;
        document.getElementById('filterSKU').value = this.filters.sku;
        document.getElementById('filterStatus').value = this.filters.status;
    }

    applyFilters() {
        this.filters.supplier = document.getElementById('filterSupplier').value;
        this.filters.dateFrom = document.getElementById('filterDateFrom').value;
        this.filters.dateTo = document.getElementById('filterDateTo').value;
        this.filters.sku = document.getElementById('filterSKU').value;
        this.filters.status = document.getElementById('filterStatus').value;
        
        document.getElementById('filterModal').classList.remove('active');
        this.renderAll();
        this.showNotification('Filters applied successfully!', 'success');
    }

    clearFilters() {
        this.filters = {
            supplier: '',
            dateFrom: '',
            dateTo: '',
            sku: '',
            status: ''
        };
        
        document.getElementById('filterSupplier').value = '';
        document.getElementById('filterDateFrom').value = '';
        document.getElementById('filterDateTo').value = '';
        document.getElementById('filterSKU').value = '';
        document.getElementById('filterStatus').value = '';
        
        document.getElementById('filterModal').classList.remove('active');
        this.renderAll();
        this.showNotification('Filters cleared!', 'info');
    }

    updateSupplierFilters() {
        const suppliers = [...new Set(this.data.orders.map(o => o.supplier))];
        const selects = ['orderSupplierFilter', 'pendingSupplierFilter', 'filterSupplier', 'supplierExportSelect'];
        
        selects.forEach(id => {
            const select = document.getElementById(id);
            if (select) {
                const currentValue = select.value;
                select.innerHTML = '<option value="">All Suppliers</option>';
                suppliers.forEach(supplier => {
                    select.innerHTML += `<option value="${supplier}">${supplier}</option>`;
                });
                select.value = currentValue;
            }
        });
    }

    filterOrders(searchTerm) {
        const filtered = this.data.orders.filter(order => 
            order.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
            order.supplier.toLowerCase().includes(searchTerm.toLowerCase()) ||
            order.orderCode.toLowerCase().includes(searchTerm.toLowerCase())
        );
        
        const tbody = document.getElementById('ordersBody');
        tbody.innerHTML = filtered.map(order => `
            <tr>
                <td><strong>${order.sku}</strong></td>
                <td>${order.qty}</td>
                <td>${order.supplier}</td>
                <td>${this.formatDate(order.orderDate)}</td>
                <td>${order.orderCode}</td>
                <td><span class="status-badge status-pending">Pending</span></td>
                <td>${order.qty}</td>
            </tr>
        `).join('');
    }

    filterOrdersBySupplier(supplier) {
        const filtered = supplier ? 
            this.data.orders.filter(o => o.supplier === supplier) : 
            this.data.orders;
        
        const tbody = document.getElementById('ordersBody');
        tbody.innerHTML = filtered.map(order => `
            <tr>
                <td><strong>${order.sku}</strong></td>
                <td>${order.qty}</td>
                <td>${order.supplier}</td>
                <td>${this.formatDate(order.orderDate)}</td>
                <td>${order.orderCode}</td>
                <td><span class="status-badge status-pending">Pending</span></td>
                <td>${order.qty}</td>
            </tr>
        `).join('');
    }

    filterDeliveries(searchTerm) {
        const filtered = this.data.deliveries.filter(delivery => 
            delivery.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
            delivery.supplier.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (delivery.boxCode && delivery.boxCode.toLowerCase().includes(searchTerm.toLowerCase()))
        );
        
        const tbody = document.getElementById('deliveriesBody');
        tbody.innerHTML = filtered.map(delivery => `
            <tr>
                <td><strong>${delivery.sku}</strong></td>
                <td>${delivery.qty}</td>
                <td>${delivery.supplier}</td>
                <td>${this.formatDate(delivery.deliveryDate)}</td>
                <td>${delivery.boxCode || '-'}</td>
                <td><span class="status-badge status-partial">In Transit</span></td>
            </tr>
        `).join('');
    }

    filterActual(searchTerm) {
        const filtered = this.data.actual.filter(actual => 
            actual.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
            actual.supplier.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (actual.boxCode && actual.boxCode.toLowerCase().includes(searchTerm.toLowerCase()))
        );
        
        const tbody = document.getElementById('actualBody');
        tbody.innerHTML = filtered.map(actual => `
            <tr>
                <td><strong>${actual.sku}</strong></td>
                <td>${actual.qty}</td>
                <td>${actual.supplier}</td>
                <td>${this.formatDate(actual.actualDate)}</td>
                <td>${actual.boxCode || '-'}</td>
                <td><span class="status-badge status-completed">Received</span></td>
            </tr>
        `).join('');
    }

    filterPending(searchTerm) {
        const filtered = this.data.pending.filter(pending => 
            pending.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
            pending.supplier.toLowerCase().includes(searchTerm.toLowerCase()) ||
            pending.orderCode.toLowerCase().includes(searchTerm.toLowerCase())
        );
        
        const tbody = document.getElementById('pendingBody');
        tbody.innerHTML = filtered.map(pending => `
            <tr>
                <td><strong>${pending.sku}</strong></td>
                <td>${pending.totalOrder}</td>
                <td>${pending.delivered}</td>
                <td>${pending.remaining}</td>
                <td>${pending.supplier}</td>
                <td>${this.formatDate(pending.orderDate)}</td>
                <td><span class="status-badge status-${pending.status}">${pending.status}</span></td>
            </tr>
        `).join('');
    }

    filterPendingBySupplier(supplier) {
        const filtered = supplier ? 
            this.data.pending.filter(p => p.supplier === supplier) : 
            this.data.pending;
        
        const tbody = document.getElementById('pendingBody');
        tbody.innerHTML = filtered.map(pending => `
            <tr>
                <td><strong>${pending.sku}</strong></td>
                <td>${pending.totalOrder}</td>
                <td>${pending.delivered}</td>
                <td>${pending.remaining}</td>
                <td>${pending.supplier}</td>
                <td>${this.formatDate(pending.orderDate)}</td>
                <td><span class="status-badge status-${pending.status}">${pending.status}</span></td>
            </tr>
        `).join('');
    }

    setupDropZones() {
        const dropZones = [
            { id: 'orderDropZone', input: 'orderFiles', type: 'order' },
            { id: 'deliveryDropZone', input: 'deliveryFiles', type: 'delivery' },
            { id: 'actualDropZone', input: 'actualFiles', type: 'actual' }
        ];
        
        dropZones.forEach(({ id, input, type }) => {
            const zone = document.getElementById(id);
            const fileInput = document.getElementById(input);
            
            if (!zone || !fileInput) return;
            
            // Click to browse
            zone.addEventListener('click', () => fileInput.click());
            
            // Drag and drop
            zone.addEventListener('dragover', (e) => {
                e.preventDefault();
                zone.classList.add('dragover');
            });
            
            zone.addEventListener('dragleave', () => {
                zone.classList.remove('dragover');
            });
            
            zone.addEventListener('drop', (e) => {
                e.preventDefault();
                zone.classList.remove('dragover');
                const files = e.dataTransfer.files;
                fileInput.files = files;
                this.updateDropZoneText(zone, files.length, type);
            });
            
            fileInput.addEventListener('change', (e) => {
                this.updateDropZoneText(zone, e.target.files.length, type);
            });
        });
    }

    updateDropZoneText(zone, count, type) {
        const p = zone.querySelector('p');
        if (count > 0) {
            p.textContent = `${count} ${type} file(s) selected`;
            zone.style.borderColor = '#4F46E5';
            zone.style.background = 'rgba(79, 70, 229, 0.05)';
        } else {
            p.textContent = `Drop ${type} Excel files here or click to browse`;
            zone.style.borderColor = '';
            zone.style.background = '';
        }
    }

    async processUploads() {
        try {
            this.showLoading(true);
            
            const orderFiles = document.getElementById('orderFiles').files;
            const deliveryFiles = document.getElementById('deliveryFiles').files;
            const actualFiles = document.getElementById('actualFiles').files;
            
            let uploadCount = 0;
            
            // Upload order files
            for (const file of orderFiles) {
                await driveManager.uploadFile(CONFIG.FOLDERS.ORDER, file);
                uploadCount++;
            }
            
            // Upload delivery files
            for (const file of deliveryFiles) {
                await driveManager.uploadFile(CONFIG.FOLDERS.DELIVERY, file);
                uploadCount++;
            }
            
            // Upload actual files
            for (const file of actualFiles) {
                await driveManager.uploadFile(CONFIG.FOLDERS.ACTUAL, file);
                uploadCount++;
            }
            
            document.getElementById('uploadModal').classList.remove('active');
            
            // Reload data
            await this.loadData();
            this.renderAll();
            
            this.showNotification(`Successfully uploaded ${uploadCount} files!`, 'success');
            this.showLoading(false);
            
        } catch (error) {
            console.error('Error uploading files:', error);
            this.showNotification('Failed to upload files. Please try again.', 'error');
            this.showLoading(false);
        }
    }

    async exportData() {
        try {
            const type = document.getElementById('analysisType').value;
            const data = this.data.pending;
            
            // Create CSV data
            let csv = 'SKU,Total Order,Delivered,Remaining,Supplier,Order Date,Status\n';
            data.forEach(p => {
                csv += `${p.sku},${p.totalOrder},${p.delivered},${p.remaining},${p.supplier},${p.orderDate},${p.status}\n`;
            });
            
            // Download CSV
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `order_analysis_${type}_${new Date().toISOString().split('T')[0]}.csv`;
            a.click();
            URL.revokeObjectURL(url);
            
            this.showNotification('Export completed successfully!', 'success');
        } catch (error) {
            console.error('Error exporting data:', error);
            this.showNotification('Failed to export data.', 'error');
        }
    }

    renderAll() {
        this.renderDashboard();
        this.renderOrders();
        this.renderDeliveries();
        this.renderActual();
        this.renderPending();
        this.updateSupplierFilters();
        this.addMismatchChecker();
        if (this.currentView === 'analysis') {
            this.addBossExport();
        }
    }

    formatDate(dateString) {
        if (!dateString) return '-';
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
        } catch {
            return dateString;
        }
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : type === 'warning' ? 'fa-exclamation-triangle' : 'fa-info-circle'}"></i>
                <span>${message}</span>
            </div>
            <button class="notification-close">&times;</button>
        `;
        
        document.body.appendChild(notification);
        
        // Add styles if not already added
        if (!document.getElementById('notificationStyles')) {
            const style = document.createElement('style');
            style.id = 'notificationStyles';
            style.textContent = `
                .notification {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    background: white;
                    padding: 16px 24px;
                    border-radius: 12px;
                    box-shadow: 0 10px 25px rgba(0,0,0,0.15);
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 16px;
                    min-width: 300px;
                    max-width: 500px;
                    z-index: 9999;
                    animation: slideIn 0.3s ease;
                    border-left: 4px solid #4F46E5;
                }
                
                .notification-success { border-left-color: #10B981; }
                .notification-error { border-left-color: #EF4444; }
                .notification-warning { border-left-color: #F59E0B; }
                
                .notification-content {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }
                
                .notification-content i {
                    font-size: 20px;
                }
                
                .notification-success i { color: #10B981; }
                .notification-error i { color: #EF4444; }
                .notification-warning i { color: #F59E0B; }
                
                .notification-close {
                    background: none;
                    border: none;
                    font-size: 20px;
                    color: #9CA3AF;
                    cursor: pointer;
                    padding: 0 4px;
                }
                
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                
                @keyframes slideOut {
                    from { transform: translateX(0); opacity: 1; }
                    to { transform: translateX(100%); opacity: 0; }
                }
            `;
            document.head.appendChild(style);
        }
        
        // Auto remove after 5 seconds (or longer for warnings)
        const duration = type === 'warning' ? 8000 : 5000;
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease forwards';
            setTimeout(() => notification.remove(), 300);
        }, duration);
        
        // Close button
        notification.querySelector('.notification-close').addEventListener('click', () => {
            notification.style.animation = 'slideOut 0.3s ease forwards';
            setTimeout(() => notification.remove(), 300);
        });
    }

    showLoading(show) {
        const overlay = document.getElementById('loadingOverlay');
        if (show) {
            overlay.style.display = 'flex';
        } else {
            overlay.style.display = 'none';
        }
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Load Google API scripts
    const loadGoogleAPI = () => {
        return new Promise((resolve) => {
            if (typeof gapi !== 'undefined' && typeof google !== 'undefined') {
                resolve();
                return;
            }
            
            const script = document.createElement('script');
            script.src = 'https://apis.google.com/js/api.js';
            script.onload = () => {
                const oauthScript = document.createElement('script');
                oauthScript.src = 'https://accounts.google.com/gsi/client';
                oauthScript.onload = resolve;
                document.head.appendChild(oauthScript);
            };
            document.head.appendChild(script);
        });
    };
    
    loadGoogleAPI().then(() => {
        window.app = new OrderManagementApp();
    });
});
