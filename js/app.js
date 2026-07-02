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
                    orderCode: value.orders[0].orderCode
                });
            }
        });
        
        // Sort pending orders by date (oldest first)
        pending.sort((a, b) => new Date(a.orderDate) - new Date(b.orderDate));
        
        this.data.pending = pending;
    }

    // Rendering methods
    renderDashboard() {
        this.updateStats();
        this.updateActivity();
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
        const selects = ['orderSupplierFilter', 'pendingSupplierFilter', 'filterSupplier'];
        
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
                <i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i>
                <span>${message}</span>
            </div>
            <button class="notification-close">&times;</button>
        `;
        
        document.body.appendChild(notification);
        
        // Add styles
        const style = document.createElement('style');
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
            
            .notification-success {
                border-left-color: #10B981;
            }
            
            .notification-error {
                border-left-color: #EF4444;
            }
            
            .notification-content {
                display: flex;
                align-items: center;
                gap: 12px;
            }
            
            .notification-content i {
                font-size: 20px;
            }
            
            .notification-success i {
                color: #10B981;
            }
            
            .notification-error i {
                color: #EF4444;
            }
            
            .notification-close {
                background: none;
                border: none;
                font-size: 20px;
                color: #9CA3AF;
                cursor: pointer;
                padding: 0 4px;
            }
            
            @keyframes slideIn {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
            
            @keyframes slideOut {
                from {
                    transform: translateX(0);
                    opacity: 1;
                }
                to {
                    transform: translateX(100%);
                    opacity: 0;
                }
            }
        `;
        document.head.appendChild(style);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease forwards';
            setTimeout(() => notification.remove(), 300);
        }, 5000);
        
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
