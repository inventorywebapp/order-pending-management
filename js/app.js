// Main Application
// Import required modules
import { CONFIG } from './config.js';
import { driveManager } from './gdrive.js';
import * as XLSX from 'xlsx';

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
        console.log('🔧 App initializing...');
        
        // Setup event listeners FIRST (before authentication)
        console.log('🔧 Setting up event listeners...');
        this.setupEventListeners();
        console.log('✅ Event listeners attached');
        
        // Initialize Google Drive
        try {
            console.log('🔧 Initializing Google Drive...');
            await driveManager.init();
            console.log('✅ Google Drive initialized successfully');
            
            // Try to authenticate - this will trigger the popup
            try {
                console.log('🔧 Attempting to authenticate...');
                await driveManager.authenticate();
                console.log('✅ Authenticated successfully');
                
                // Load data after successful authentication
                await this.loadData();
                console.log('✅ Data loaded successfully');
                
            } catch (authError) {
                console.warn('⚠️ Authentication not completed:', authError.message);
                this.showNotification('Please sign in to load data', 'info');
                // Still render UI, user can click refresh after signing in
            }
        } catch (error) {
            console.error('❌ Failed to initialize Google Drive:', error);
            this.showNotification('Failed to initialize Google Drive. Please check your configuration.', 'error');
        }
        
        // Render initial view (even if not authenticated yet)
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
        this.addSignInButton();
        
        console.log('✅ App initialized successfully');
    }

    // Add Sign-In Button to Dashboard
    addSignInButton() {
        const dashboard = document.getElementById('view-dashboard');
        const existingSignIn = document.querySelector('.sign-in-button');
        if (existingSignIn) {
            existingSignIn.remove();
        }
        
        // Only show if not authenticated
        if (driveManager.isAuthenticated) return;
        
        const container = document.createElement('div');
        container.className = 'sign-in-button';
        container.style.cssText = `
            margin: 20px 0;
            padding: 20px;
            background: #FEF3C7;
            border-radius: 12px;
            text-align: center;
            border: 2px solid #F59E0B;
        `;
        
        container.innerHTML = `
            <i class="fas fa-sign-in-alt" style="font-size: 32px; color: #F59E0B; margin-bottom: 12px;"></i>
            <h3 style="margin: 0; color: #92400E;">Sign in to Google Drive</h3>
            <p style="color: #78350F; margin: 8px 0;">Please sign in to access your data</p>
            <button class="btn-primary" id="signInBtn" style="margin-top: 12px;">
                <i class="fas fa-google"></i> Sign in with Google
            </button>
        `;
        
        // Insert after stats grid
        const statsGrid = dashboard.querySelector('.stats-grid');
        if (statsGrid) {
            statsGrid.parentNode.insertBefore(container, statsGrid.nextSibling);
        }
        
        document.getElementById('signInBtn')?.addEventListener('click', async () => {
            try {
                this.showNotification('Signing in...', 'info');
                await driveManager.authenticate();
                container.remove();
                await this.loadData();
                this.renderAll();
                this.showNotification('✅ Signed in successfully!', 'success');
            } catch (error) {
                console.error('Sign in failed:', error);
                this.showNotification('❌ Sign in failed. Please try again.', 'error');
            }
        });
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

        // Refresh button - Updated with authentication check
        document.getElementById('refreshData').addEventListener('click', async () => {
            console.log('🔄 Refresh button clicked');
            try {
                // Check if we need to authenticate
                if (!driveManager.isAuthenticated) {
                    console.log('🔧 Not authenticated, showing sign-in...');
                    this.showNotification('Please sign in to continue', 'info');
                    await driveManager.authenticate();
                    console.log('✅ Authenticated successfully');
                }
                await this.loadData();
                this.renderAll();
                this.showNotification('Data refreshed successfully!', 'success');
            } catch (error) {
                console.error('❌ Refresh failed:', error);
                this.showNotification('Please sign in to refresh data', 'warning');
            }
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
            console.log('📊 Loading data from Google Drive...');
            
            // Check authentication first
            if (!driveManager.isAuthenticated) {
                console.warn('⚠️ Not authenticated, attempting to authenticate...');
                await driveManager.authenticate();
            }
            
            // Load files from all folders
            console.log('📁 Loading order files...');
            const orderFiles = await driveManager.listFiles(CONFIG.FOLDERS.ORDER);
            console.log(`📁 Found ${orderFiles.length} order files`);
            
            console.log('📁 Loading delivery files...');
            const deliveryFiles = await driveManager.listFiles(CONFIG.FOLDERS.DELIVERY);
            console.log(`📁 Found ${deliveryFiles.length} delivery files`);
            
            console.log('📁 Loading actual received files...');
            const actualFiles = await driveManager.listFiles(CONFIG.FOLDERS.ACTUAL);
            console.log(`📁 Found ${actualFiles.length} actual received files`);
            
            // Process Excel files
            console.log('📊 Processing Excel files...');
            const orders = await this.processExcelFiles(orderFiles, 'order');
            const deliveries = await this.processExcelFiles(deliveryFiles, 'delivery');
            const actual = await this.processExcelFiles(actualFiles, 'actual');
            
            console.log(`📊 Orders: ${orders.length}, Deliveries: ${deliveries.length}, Actual: ${actual.length}`);
            
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
            this.addMismatchChecker();
            this.addBossExport();
            
            console.log('✅ Data loaded successfully');
            
        } catch (error) {
            console.error('❌ Error loading data:', error);
            this.showNotification('Failed to load data from Google Drive: ' + error.message, 'error');
            this.showLoading(false);
        }
    }

    async processExcelFiles(files, type) {
        const data = [];
        
        for (const file of files) {
            if (file.mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
                file.mimeType === 'application/vnd.ms-excel') {
                try {
                    console.log(`📄 Processing ${type} file: ${file.name}`);
                    const arrayBuffer = await driveManager.downloadFile(file.id);
                    
                    // Check if we got valid data
                    if (!arrayBuffer || arrayBuffer.byteLength === 0) {
                        console.error(`❌ Empty data for ${file.name}`);
                        continue;
                    }
                    
                    console.log(`📊 ArrayBuffer size: ${arrayBuffer.byteLength} bytes`);
                    
                    // Parse Excel using XLSX library
                    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
                    console.log(`📊 Sheets: ${workbook.SheetNames.join(', ')}`);
                    
                    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                    const jsonData = XLSX.utils.sheet_to_json(firstSheet);
                    
                    console.log(`📊 Found ${jsonData.length} rows in ${file.name}`);
                    
                    if (jsonData.length > 0) {
                        console.log(`📋 First row sample:`, jsonData[0]);
                    }
                    
                    const parsedData = jsonData
                        .map(row => this.mapExcelRow(row, type))
                        .filter(row => row !== null);
                    data.push(...parsedData);
                    
                } catch (error) {
                    console.error(`❌ Error processing file ${file.name}:`, error);
                }
            }
        }
        
        return data;
    }

    async parseExcelData(content, type) {
        console.log(`📝 Parsing ${type} data - content length: ${content?.length || 0}`);
        
        // If content is empty, return mock data
        if (!content || content.length === 0) {
            console.warn(`⚠️ Empty content for ${type}, returning mock data`);
            return this.getMockData(type);
        }
        
        try {
            // Try to parse as CSV or plain text
            const lines = content.split('\n').filter(line => line.trim());
            if (lines.length < 2) {
                console.warn(`⚠️ Not enough lines for ${type}, returning mock data`);
                return this.getMockData(type);
            }
            
            console.log(`📄 Found ${lines.length} lines in ${type} file`);
            
            // DEBUG: Log first 3 lines to see the format
            console.log(`📄 First 3 lines:`, lines.slice(0, 3));
            
            // Try to find the header line - sometimes it's not the first line
            let headerLine = lines[0];
            let startRow = 1;
            
            // If first line doesn't contain expected headers, look for them
            const expectedHeaders = type === 'order' 
                ? ['SKU', 'Order Qty', 'Supplier', 'Order Date', 'Order Code']
                : type === 'delivery'
                ? ['SKU', 'Delivery Qty', 'Supplier', 'Est. Delivery Date', 'Box Code']
                : ['SKU', 'Delivery Qty', 'Supplier', 'Act. Delivery Date', 'Box Code'];
            
            // Check if first line has headers
            let hasHeaders = false;
            expectedHeaders.forEach(h => {
                if (headerLine.toLowerCase().includes(h.toLowerCase())) {
                    hasHeaders = true;
                }
            });
            
            // If no headers found, try to find them in other lines
            if (!hasHeaders) {
                for (let i = 0; i < Math.min(lines.length, 5); i++) {
                    let found = 0;
                    expectedHeaders.forEach(h => {
                        if (lines[i].toLowerCase().includes(h.toLowerCase())) {
                            found++;
                        }
                    });
                    if (found >= 3) {
                        headerLine = lines[i];
                        startRow = i + 1;
                        console.log(`📋 Found headers at line ${i+1}: ${headerLine}`);
                        break;
                    }
                }
            }
            
            // Parse headers - try different delimiters
            let headers = this.parseHeaderLine(headerLine);
            console.log(`📋 Headers found:`, headers);
            
            // If still no headers, use the expected ones
            if (headers.length < 3) {
                console.warn(`⚠️ Could not find proper headers, using defaults`);
                headers = expectedHeaders;
            }
            
            const result = [];
            
            // Process each row
            for (let i = startRow; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;
                
                // Parse CSV line with proper delimiter detection
                const values = this.parseCSVLineAdvanced(line);
                
                // Skip if not enough values
                if (values.length < 2) continue;
                
                // Create row object
                const row = {};
                headers.forEach((header, index) => {
                    row[header] = values[index] || '';
                });
                
                // Map to our expected format
                const mappedRow = this.mapExcelRow(row, type);
                if (mappedRow) {
                    result.push(mappedRow);
                }
            }
            
            console.log(`✅ Parsed ${result.length} rows for ${type}`);
            return result;
            
        } catch (error) {
            console.error(`❌ Error parsing ${type} data:`, error);
            return this.getMockData(type);
        }
    }

    // Helper method to parse header line with multiple delimiter support
    parseHeaderLine(line) {
        // Try different delimiters
        let delimiters = ['\t', ',', ';', '|'];
        let bestDelimiter = ',';
        let maxParts = 0;
        
        delimiters.forEach(delim => {
            const parts = line.split(delim);
            if (parts.length > maxParts) {
                maxParts = parts.length;
                bestDelimiter = delim;
            }
        });
        
        return line.split(bestDelimiter).map(h => h.trim().replace(/^"|"$/g, ''));
    }

    // Advanced CSV line parser
    parseCSVLineAdvanced(line) {
        // Try to detect the delimiter by counting occurrences
        const commaCount = (line.match(/,/g) || []).length;
        const tabCount = (line.match(/\t/g) || []).length;
        const semicolonCount = (line.match(/;/g) || []).length;
        
        let delimiter = ',';
        if (tabCount > commaCount && tabCount > semicolonCount) delimiter = '\t';
        else if (semicolonCount > commaCount && semicolonCount > tabCount) delimiter = ';';
        
        // Handle quoted strings
        const result = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === delimiter && !inQuotes) {
                result.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        result.push(current.trim());
        
        // Clean up quotes
        return result.map(v => v.replace(/^"|"$/g, ''));
    }

    mapExcelRow(row, type) {
        try {
            if (type === 'order') {
                // Get values with proper date conversion
                const sku = this.findValue(row, ['SKU', 'sku', 'Item', 'item']);
                const qty = parseFloat(this.findValue(row, ['Order Qty', 'order_qty', 'Qty', 'qty', 'Quantity', 'quantity']) || 0);
                const supplier = this.findValue(row, ['Supplier', 'supplier', 'Vendor', 'vendor']);
                const orderDate = this.convertExcelDate(this.findValue(row, ['Order Date', 'order_date', 'Date', 'date']));
                const orderCode = this.findValue(row, ['Order Code', 'order_code', 'Code', 'code']);
                
                if (!sku || qty === 0) return null;
                
                return {
                    sku: sku,
                    qty: qty,
                    supplier: supplier || 'Unknown',
                    orderDate: orderDate || new Date().toISOString().split('T')[0],
                    orderCode: orderCode || ''
                };
            } else if (type === 'delivery') {
                const sku = this.findValue(row, ['SKU', 'sku', 'Item', 'item']);
                const qty = parseFloat(this.findValue(row, ['Delivery Qty', 'delivery_qty', 'Qty', 'qty']) || 0);
                const supplier = this.findValue(row, ['Supplier', 'supplier', 'Vendor', 'vendor']);
                const deliveryDate = this.convertExcelDate(this.findValue(row, ['Est. Delivery Date', 'est_delivery_date', 'Delivery Date', 'delivery_date', 'Date', 'date']));
                const boxCode = this.findValue(row, ['Box Code', 'box_code', 'Box', 'box']);
                
                if (!sku || qty === 0) return null;
                
                return {
                    sku: sku,
                    qty: qty,
                    supplier: supplier || 'Unknown',
                    deliveryDate: deliveryDate || new Date().toISOString().split('T')[0],
                    boxCode: boxCode || ''
                };
            } else if (type === 'actual') {
                const sku = this.findValue(row, ['SKU', 'sku', 'Item', 'item']);
                const qty = parseFloat(this.findValue(row, ['Delivery Qty', 'delivery_qty', 'Qty', 'qty']) || 0);
                const supplier = this.findValue(row, ['Supplier', 'supplier', 'Vendor', 'vendor']);
                const actualDate = this.convertExcelDate(this.findValue(row, ['Act. Delivery Date', 'act_delivery_date', 'Actual Date', 'actual_date', 'Date', 'date']));
                const boxCode = this.findValue(row, ['Box Code', 'box_code', 'Box', 'box']);
                
                if (!sku || qty === 0) return null;
                
                return {
                    sku: sku,
                    qty: qty,
                    supplier: supplier || 'Unknown',
                    actualDate: actualDate || new Date().toISOString().split('T')[0],
                    boxCode: boxCode || ''
                };
            }
        } catch (error) {
            console.error('❌ Error mapping row:', error);
            return null;
        }
        return null;
    }

    convertExcelDate(value) {
        if (!value) return '';
        
        // If it's already a string like "3/1/2026", parse it directly
        if (typeof value === 'string') {
            // Check if it's a date string
            const dateRegex = /^\d{1,2}\/\d{1,2}\/\d{2,4}$/;
            if (dateRegex.test(value)) {
                try {
                    const parts = value.split('/');
                    const month = parseInt(parts[0]);
                    const day = parseInt(parts[1]);
                    let year = parseInt(parts[2]);
                    
                    // Handle 2-digit year
                    if (year < 100) {
                        year = year > 50 ? 1900 + year : 2000 + year;
                    }
                    
                    // Create date WITHOUT timezone conversion
                    const date = new Date(year, month - 1, day);
                    
                    // ✅ FIX: Use local date, not UTC
                    // Return as YYYY-MM-DD without timezone offset
                    const yearStr = date.getFullYear();
                    const monthStr = String(date.getMonth() + 1).padStart(2, '0');
                    const dayStr = String(date.getDate()).padStart(2, '0');
                    return `${yearStr}-${monthStr}-${dayStr}`;
                } catch (e) {
                    console.warn('⚠️ Could not parse date string:', value);
                    return value;
                }
            }
            return value;
        }
        
        // If it's a number (Excel serial date)
        if (typeof value === 'number') {
            // Excel serial date: 1 = Jan 1, 1900
            // We need to adjust for the Excel 1900 leap year bug
            const excelEpoch = new Date(1899, 11, 30); // Dec 30, 1899
            
            // ✅ FIX: Use local date without timezone conversion
            const date = new Date(excelEpoch.getTime() + (value * 24 * 60 * 60 * 1000));
            
            // Check if date is valid
            if (isNaN(date.getTime())) {
                return '';
            }
            
            // ✅ FIX: Return local date, not UTC
            const yearStr = date.getFullYear();
            const monthStr = String(date.getMonth() + 1).padStart(2, '0');
            const dayStr = String(date.getDate()).padStart(2, '0');
            return `${yearStr}-${monthStr}-${dayStr}`;
        }
        
        // If it's a Date object
        if (value instanceof Date) {
            const yearStr = value.getFullYear();
            const monthStr = String(value.getMonth() + 1).padStart(2, '0');
            const dayStr = String(value.getDate()).padStart(2, '0');
            return `${yearStr}-${monthStr}-${dayStr}`;
        }
        
        return value || '';
    }

    // Helper method to find value by multiple possible keys
    findValue(row, possibleKeys) {
        for (const key of possibleKeys) {
            if (row[key] !== undefined && row[key] !== null && row[key] !== '') {
                return row[key];
            }
        }
        return '';
    }

    getMockData(type) {
        // Return mock data for testing
        console.log(`📊 Generating mock data for ${type}`);
        const mockData = [];
        const suppliers = ['Supplier A', 'Supplier B', 'Supplier C'];
        const skus = ['SKU-001', 'SKU-002', 'SKU-003', 'SKU-004', 'SKU-005'];
        
        for (let i = 0; i < 5; i++) {
            const mockItem = {
                sku: skus[i % skus.length],
                qty: Math.floor(Math.random() * 100) + 10,
                supplier: suppliers[i % suppliers.length],
            };
            
            if (type === 'order') {
                mockItem.orderDate = new Date(Date.now() - i * 86400000).toISOString().split('T')[0];
                mockItem.orderCode = `ORD-${String(i + 1).padStart(3, '0')}`;
            } else if (type === 'delivery') {
                mockItem.deliveryDate = new Date(Date.now() - i * 86400000).toISOString().split('T')[0];
                mockItem.boxCode = `BOX-${String(i + 1).padStart(3, '0')}`;
            } else if (type === 'actual') {
                mockItem.actualDate = new Date(Date.now() - i * 86400000).toISOString().split('T')[0];
                mockItem.boxCode = `BOX-${String(i + 1).padStart(3, '0')}`;
            }
            
            mockData.push(mockItem);
        }
        
        return mockData;
    }

    // Updated processPendingOrders with Over-Delivery Status
    processPendingOrders() {
        console.log('📊 Processing pending orders with FIFO...');
        
        // Group orders by SKU and supplier, but keep individual orders
        const orderGroups = new Map();
        
        // Sort orders by date (oldest first)
        const sortedOrders = [...this.data.orders].sort((a, b) => 
            new Date(a.orderDate) - new Date(b.orderDate)
        );
        
        // Group orders by SKU and supplier
        sortedOrders.forEach(order => {
            const key = `${order.sku}-${order.supplier}`;
            if (!orderGroups.has(key)) {
                orderGroups.set(key, {
                    sku: order.sku,
                    supplier: order.supplier,
                    orders: [],
                    totalOrder: 0
                });
            }
            const group = orderGroups.get(key);
            group.orders.push({ ...order, remaining: order.qty });
            group.totalOrder += order.qty;
        });
        
        // Aggregate deliveries by SKU and supplier
        const deliveryMap = new Map();
        this.data.deliveries.forEach(delivery => {
            const key = `${delivery.sku}-${delivery.supplier}`;
            if (!deliveryMap.has(key)) {
                deliveryMap.set(key, 0);
            }
            deliveryMap.set(key, deliveryMap.get(key) + delivery.qty);
        });
        
        // Process each group with FIFO
        const pending = [];
        
        orderGroups.forEach((group, key) => {
            let totalDelivered = deliveryMap.get(key) || 0;
            let remainingToDeliver = totalDelivered;
            
            console.log(`📦 Processing ${group.sku} (${group.supplier}): ${group.totalOrder} ordered, ${totalDelivered} delivered`);
            
            // Track which orders got delivered
            const orderStatus = [];
            let deliveredCount = 0;
            
            // FIFO: Deduct from oldest orders first
            for (const order of group.orders) {
                let orderRemaining = order.qty;
                
                if (remainingToDeliver > 0) {
                    const deducted = Math.min(orderRemaining, remainingToDeliver);
                    orderRemaining -= deducted;
                    remainingToDeliver -= deducted;
                    deliveredCount += deducted;
                    
                    orderStatus.push({
                        orderCode: order.orderCode || '',
                        orderDate: order.orderDate,
                        qty: order.qty,
                        delivered: deducted,
                        remaining: orderRemaining,
                        status: orderRemaining === 0 ? 'completed' : 'partial'
                    });
                } else {
                    orderStatus.push({
                        orderCode: order.orderCode || '',
                        orderDate: order.orderDate,
                        qty: order.qty,
                        delivered: 0,
                        remaining: order.qty,
                        status: 'pending'
                    });
                }
            }
            
            const remaining = group.totalOrder - totalDelivered;
            const excess = totalDelivered > group.totalOrder ? totalDelivered - group.totalOrder : 0;
            
            // Determine status with over-delivery support
            let status = 'pending';
            let statusNote = '';
            
            if (excess > 0) {
                status = 'over-delivery';
                statusNote = `⚠️ Over-Delivery: ${excess} units excess`;
            } else if (remaining === 0 && totalDelivered > 0) {
                status = 'completed';
            } else if (totalDelivered > 0 && remaining > 0) {
                status = 'partial';
            } else {
                status = 'pending';
            }
            
            // Only show if there's activity (some delivered or pending or over-delivery)
            if (totalDelivered > 0 || remaining > 0 || excess > 0) {
                pending.push({
                    sku: group.sku,
                    supplier: group.supplier,
                    totalOrder: group.totalOrder,
                    delivered: totalDelivered,
                    remaining: Math.max(0, remaining),
                    excess: excess,
                    status: status,
                    statusNote: statusNote,
                    orderDate: group.orders[0]?.orderDate || new Date().toISOString().split('T')[0],
                    orderCode: group.orders[0]?.orderCode || '',
                    note: statusNote,
                    orderStatus: orderStatus
                });
            }
        });
        
        // Sort pending orders by date (oldest first)
        pending.sort((a, b) => new Date(a.orderDate) - new Date(b.orderDate));
        
        this.data.pending = pending;
        console.log(`✅ Processed ${pending.length} pending groups with FIFO`);
    }

    // ============ NEW MISMATCH DETECTION FEATURES ============

    // Find Quantity Mismatches (Over-Deliveries)
    findQuantityMismatches() {
        const mismatches = [];
        
        // Group orders by SKU and supplier
        const orderMap = new Map();
        this.data.orders.forEach(order => {
            const key = `${order.sku}-${order.supplier}`;
            if (!orderMap.has(key)) {
                orderMap.set(key, { sku: order.sku, supplier: order.supplier, totalOrder: 0 });
            }
            orderMap.get(key).totalOrder += order.qty;
        });
        
        // Group deliveries by SKU and supplier
        const deliveryMap = new Map();
        this.data.deliveries.forEach(delivery => {
            const key = `${delivery.sku}-${delivery.supplier}`;
            if (!deliveryMap.has(key)) {
                deliveryMap.set(key, { sku: delivery.sku, supplier: delivery.supplier, totalDelivery: 0 });
            }
            deliveryMap.get(key).totalDelivery += delivery.qty;
        });
        
        // Check for quantity mismatches
        deliveryMap.forEach((delivery, key) => {
            const order = orderMap.get(key);
            if (order) {
                const difference = delivery.totalDelivery - order.totalOrder;
                if (difference > 0) {
                    // Over-delivery detected
                    mismatches.push({
                        sku: delivery.sku,
                        supplier: delivery.supplier,
                        ordered: order.totalOrder,
                        delivered: delivery.totalDelivery,
                        excess: difference,
                        type: 'over-delivery',
                        severity: 'high'
                    });
                } else if (difference < 0) {
                    // Under-delivery detected
                    mismatches.push({
                        sku: delivery.sku,
                        supplier: delivery.supplier,
                        ordered: order.totalOrder,
                        delivered: delivery.totalDelivery,
                        shortage: Math.abs(difference),
                        type: 'under-delivery',
                        severity: 'medium'
                    });
                }
            } else {
                // Delivery with no matching order
                mismatches.push({
                    sku: delivery.sku,
                    supplier: delivery.supplier,
                    ordered: 0,
                    delivered: delivery.totalDelivery,
                    excess: delivery.totalDelivery,
                    type: 'no-order',
                    severity: 'high'
                });
            }
        });
        
        // Check for orders with no deliveries
        orderMap.forEach((order, key) => {
            const delivery = deliveryMap.get(key);
            if (!delivery) {
                mismatches.push({
                    sku: order.sku,
                    supplier: order.supplier,
                    ordered: order.totalOrder,
                    delivered: 0,
                    shortage: order.totalOrder,
                    type: 'no-delivery',
                    severity: 'medium'
                });
            }
        });
        
        return mismatches;
    }

    // Render detailed mismatch view
    renderMismatchDetails() {
        const skuMismatches = this.findSKUsNotInOrder();
        const quantityMismatches = this.findQuantityMismatches();
        const totalIssues = skuMismatches.length + quantityMismatches.length;
        
        if (totalIssues === 0) {
            this.showNotification('✅ All SKUs and quantities match!', 'success');
            return;
        }
        
        const modal = document.createElement('div');
        modal.className = 'modal active';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 900px; max-height: 90vh; overflow-y: auto;">
                <div class="modal-header">
                    <h2>📋 Mismatch Details</h2>
                    <button class="close-modal">&times;</button>
                </div>
                <div class="modal-body">
                    ${quantityMismatches.length > 0 ? `
                        <h3 style="color: #EF4444; margin-top: 16px;">
                            <i class="fas fa-calculator"></i> Quantity Mismatches (${quantityMismatches.length})
                        </h3>
                        <div class="table-wrapper">
                            <table>
                                <thead>
                                    <tr>
                                        <th>SKU</th>
                                        <th>Supplier</th>
                                        <th>Ordered</th>
                                        <th>Delivered</th>
                                        <th>Difference</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${quantityMismatches.map(m => {
                                        let badgeClass = 'status-mismatch';
                                        let badgeText = 'Mismatch';
                                        if (m.type === 'over-delivery') {
                                            badgeClass = 'status-over-delivery';
                                            badgeText = `⚠️ +${m.excess} Over`;
                                        } else if (m.type === 'under-delivery') {
                                            badgeClass = 'status-warning';
                                            badgeText = `⚠️ -${m.shortage} Short`;
                                        } else if (m.type === 'no-order') {
                                            badgeClass = 'status-error';
                                            badgeText = 'No Order';
                                        } else if (m.type === 'no-delivery') {
                                            badgeClass = 'status-pending';
                                            badgeText = 'No Delivery';
                                        }
                                        return `
                                            <tr>
                                                <td><strong>${m.sku}</strong></td>
                                                <td>${m.supplier}</td>
                                                <td>${m.ordered || 0}</td>
                                                <td>${m.delivered || 0}</td>
                                                <td style="color: ${m.excess ? '#EF4444' : '#F59E0B'}; font-weight: 600;">
                                                    ${m.excess ? `+${m.excess}` : m.shortage ? `-${m.shortage}` : '0'}
                                                </td>
                                                <td><span class="status-badge ${badgeClass}">${badgeText}</span></td>
                                            </tr>
                                        `;
                                    }).join('')}
                                </tbody>
                            </table>
                        </div>
                        <div style="margin: 12px 0; padding: 12px; background: #FEF2F2; border-radius: 8px; border-left: 4px solid #EF4444;">
                            <p style="margin: 0; font-size: 14px; color: #991B1B;">
                                <strong>⚠️ Note:</strong> ${quantityMismatches.filter(m => m.type === 'over-delivery').length} over-delivery(s) detected. 
                                Review these items to reconcile quantities.
                            </p>
                        </div>
                    ` : ''}
                    
                    ${skuMismatches.length > 0 ? `
                        <h3 style="color: #F59E0B; margin-top: 16px;">
                            <i class="fas fa-tag"></i> SKU Mismatches (${skuMismatches.length})
                        </h3>
                        <div class="table-wrapper">
                            <table>
                                <thead>
                                    <tr>
                                        <th>SKU</th>
                                        <th>Supplier</th>
                                        <th>Qty</th>
                                        <th>Source</th>
                                        <th>Box Code</th>
                                        <th>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${skuMismatches.map(item => `
                                        <tr>
                                            <td><strong>${item.sku}</strong></td>
                                            <td>${item.supplier}</td>
                                            <td>${item.qty}</td>
                                            <td><span class="status-badge status-mismatch">${item.source}</span></td>
                                            <td>${item.boxCode || '-'}</td>
                                            <td>
                                                <button class="btn-secondary" onclick="window.app.flagSKUCorrection()" style="padding: 4px 12px; font-size: 12px;">
                                                    Fix
                                                </button>
                                            </td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    ` : ''}
                    
                    <div class="flag-actions" style="margin-top: 20px; padding: 16px; background: #F3F4F6; border-radius: 8px;">
                        <p style="font-weight: 600; margin-bottom: 12px;">What would you like to do?</p>
                        <div style="display: flex; gap: 12px; flex-wrap: wrap;">
                            <button class="btn-primary" onclick="window.app.flagSKUCorrection()">
                                <i class="fas fa-edit"></i> Correct SKU
                            </button>
                            <button class="btn-secondary" onclick="window.app.flagAddNewOrder()">
                                <i class="fas fa-plus"></i> Create Order
                            </button>
                            <button class="btn-secondary" onclick="window.app.exportMismatches()">
                                <i class="fas fa-file-export"></i> Export
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
        
        modal.querySelector('.close-modal').addEventListener('click', () => modal.remove());
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });
    }

    // Enhanced Mismatch Checker for Dashboard
    addMismatchChecker() {
        const dashboard = document.getElementById('view-dashboard');
        const existingChecker = document.querySelector('.mismatch-checker');
        if (existingChecker) {
            existingChecker.remove();
        }
        
        // Get both SKU and Quantity mismatches
        const skuMismatches = this.findSKUsNotInOrder();
        const quantityMismatches = this.findQuantityMismatches();
        const hasOverDelivery = quantityMismatches.some(m => m.type === 'over-delivery' || m.type === 'no-order');
        const totalIssues = skuMismatches.length + quantityMismatches.length;
        
        const container = document.createElement('div');
        container.className = 'mismatch-checker';
        container.style.cssText = `
            margin: 20px 0;
            padding: 16px 20px;
            background: white;
            border-radius: 12px;
            box-shadow: var(--shadow);
            border-left: 4px solid ${totalIssues > 0 ? '#EF4444' : '#10B981'};
        `;
        
        container.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px;">
                <div style="display: flex; align-items: center; gap: 12px;">
                    <i class="fas fa-exclamation-triangle" style="color: ${totalIssues > 0 ? '#EF4444' : '#10B981'}; font-size: 24px;"></i>
                    <div>
                        <h4 style="font-weight: 600; margin: 0;">Mismatch Checker</h4>
                        <p style="margin: 0; color: var(--gray-500); font-size: 14px;">
                            ${totalIssues === 0 ? '✅ All SKUs and quantities match!' : `⚠️ ${totalIssues} issue(s) found`}
                        </p>
                    </div>
                </div>
                ${totalIssues > 0 ? `
                    <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                        ${hasOverDelivery ? '<span class="status-badge status-over-delivery">⚠️ Over-Delivery</span>' : ''}
                        ${skuMismatches.length > 0 ? `<span class="status-badge status-mismatch">🔄 ${skuMismatches.length} SKU Mismatch</span>` : ''}
                        ${quantityMismatches.filter(m => m.type !== 'over-delivery').length > 0 ? `<span class="status-badge status-partial">📊 Quantity Issues</span>` : ''}
                    </div>
                ` : ''}
            </div>
            ${totalIssues > 0 ? `
                <div style="margin-top: 12px; display: flex; gap: 8px;">
                    <button class="btn-primary" id="checkMismatches">
                        <i class="fas fa-search"></i> View Details
                    </button>
                </div>
            ` : `
                <div style="margin-top: 8px;">
                    <button class="btn-secondary" id="checkMismatches">
                        <i class="fas fa-check"></i> Check Again
                    </button>
                </div>
            `}
        `;
        
        // Insert after stats grid
        const statsGrid = dashboard.querySelector('.stats-grid');
        if (statsGrid) {
            statsGrid.parentNode.insertBefore(container, statsGrid.nextSibling);
        } else {
            dashboard.prepend(container);
        }
        
        document.getElementById('checkMismatches')?.addEventListener('click', () => {
            this.renderMismatchDetails();
        });
    }

    // ============ END OF NEW MISMATCH FEATURES ============

    // ============ EXISTING FEATURES ============

    // Feature 1: Export Pending Orders with Details
    exportPendingOrders(format = 'csv') {
        const pendingData = this.data.pending.map(p => ({
            'SKU': p.sku,
            'Supplier': p.supplier,
            'Total Order': p.totalOrder,
            'Delivered': p.delivered,
            'Remaining': p.remaining,
            'Excess': p.excess || 0,
            'Status': p.status,
            'Status Note': p.statusNote || '',
            'Order Date': p.orderDate,
            'Order Code': p.orderCode
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
        
        const headers = Object.keys(data[0]);
        html += '<thead><tr>';
        headers.forEach(h => html += `<th>${h}</th>`);
        html += '</tr></thead><tbody>';
        
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
                            <button class="btn-primary" onclick="window.app.flagSKUCorrection()">
                                <i class="fas fa-edit"></i> Correct SKU in Order
                            </button>
                            <button class="btn-secondary" onclick="window.app.flagAddNewOrder()">
                                <i class="fas fa-plus"></i> Create New Order
                            </button>
                            <button class="btn-secondary" onclick="window.app.exportMismatches()">
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
            
            let message = '📝 Please update these SKUs in your order files:\n\n';
            corrections.forEach(c => {
                message += `• Change "${c.oldSku}" to "${c.newSku}" (Supplier: ${c.supplier})\n`;
            });
            message += '\n📍 Go to: Google Drive > Order folder > Find the Excel file with these SKUs';
            
            this.showLoading(false);
            this.showNotification(message, 'info');
            
            if (confirm('Would you like to open Google Drive to update the files?')) {
                window.open('https://drive.google.com/drive/folders/' + CONFIG.FOLDERS.ORDER, '_blank');
            }
            
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
        
        let csvContent = 'SKU,Order Qty,Supplier,Order Date,Order Code\n';
        flagged.forEach(item => {
            const today = new Date().toISOString().split('T')[0];
            csvContent += `${item.sku},${item.qty},${item.supplier},${today},NEW-ORDER-${Date.now()}\n`;
        });
        
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
                Export Reports
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
                    <i class="fas fa-exclamation-triangle"></i> Check Mismatches
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
        
        if (analysisContainer) {
            analysisContainer.parentNode.insertBefore(exportContainer, analysisContainer);
        }
        
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
            this.renderMismatchDetails();
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
            'Excess': p.excess || 0,
            'Status': p.status,
            'Order Date': p.orderDate,
            'Order Code': p.orderCode
        }));
        
        this.exportToCSV(data, `${supplier}_orders`);
        this.showNotification(`✅ Exported ${data.length} records for ${supplier}`, 'success');
    }

    // ============ END OF NEW FEATURES ============

    // Rendering methods
    renderDashboard() {
        this.updateStats();
        this.updateActivity();
        this.addMismatchChecker();
        this.addSignInButton();
    }

    updateStats() {
        const totalOrders = this.data.orders.reduce((sum, o) => sum + o.qty, 0);
        const totalDeliveries = this.data.deliveries.reduce((sum, d) => sum + d.qty, 0);
        const completed = this.data.pending.filter(p => p.status === 'completed').length;
        const pending = this.data.pending.filter(p => p.status === 'pending' || p.status === 'partial').length;
        const overDelivery = this.data.pending.filter(p => p.status === 'over-delivery').length;
        
        document.getElementById('totalOrders').textContent = totalOrders;
        document.getElementById('totalDeliveries').textContent = totalDeliveries;
        document.getElementById('completedOrders').textContent = completed;
        document.getElementById('pendingOrders').textContent = pending + overDelivery;
    }

    updateActivity() {
        const activityList = document.getElementById('activityList');
        const activities = [];
        
        this.data.orders.slice(0, 5).forEach(order => {
            activities.push({
                type: 'order',
                message: `Order ${order.orderCode}: ${order.sku} x${order.qty} from ${order.supplier}`,
                date: order.orderDate
            });
        });
        
        this.data.deliveries.slice(0, 5).forEach(delivery => {
            activities.push({
                type: 'delivery',
                message: `Delivery: ${delivery.sku} x${delivery.qty} from ${delivery.supplier}`,
                date: delivery.deliveryDate
            });
        });
        
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
        
        if (this.data.pending.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 20px;">No pending orders</td></tr>`;
            return;
        }
        
        tbody.innerHTML = this.data.pending.map(pending => {
            // Build FIFO breakdown
            let fifoBreakdown = '';
            if (pending.orderStatus && pending.orderStatus.length > 0) {
                fifoBreakdown = pending.orderStatus.map(os => 
                    `<div style="font-size: 11px; color: #666;">
                        ${os.orderDate}: ${os.delivered}/${os.qty} delivered
                        ${os.remaining > 0 ? `(Remaining: ${os.remaining})` : '✅'}
                    </div>`
                ).join('');
            }
            
            // Status badge mapping with over-delivery
            const statusMap = {
                'completed': 'status-completed',
                'pending': 'status-pending',
                'partial': 'status-partial',
                'over-delivery': 'status-over-delivery'
            };
            
            const statusTextMap = {
                'completed': '✅ Completed',
                'pending': '⏳ Pending',
                'partial': '⏳ Partial',
                'over-delivery': '⚠️ Over-Delivery'
            };
            
            const statusClass = statusMap[pending.status] || 'status-pending';
            const statusText = statusTextMap[pending.status] || pending.status;
            
            // Show excess if over-delivery
            const excessDisplay = pending.excess > 0 ? ` (+${pending.excess} excess)` : '';
            
            return `
                <tr>
                    <td><strong>${pending.sku}</strong></td>
                    <td>${pending.totalOrder}</td>
                    <td>${pending.delivered}</td>
                    <td>${pending.remaining}${excessDisplay}</td>
                    <td>${pending.supplier}</td>
                    <td>${this.formatDate(pending.orderDate)}</td>
                    <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                </tr>
                ${fifoBreakdown ? `<tr><td colspan="7" style="padding: 4px 16px; background: #f9fafb;">
                    <details>
                        <summary style="cursor: pointer; font-size: 12px; color: #6B7280;">
                            📋 FIFO Breakdown
                        </summary>
                        <div style="margin-top: 4px;">${fifoBreakdown}</div>
                    </details>
                </td></tr>` : ''}
                ${pending.statusNote ? `<tr><td colspan="7" style="padding: 2px 16px 8px 16px; background: #f9fafb;">
                    <span style="font-size: 12px; color: #DC2626;">${pending.statusNote}</span>
                </td></tr>` : ''}
            `;
        }).join('');
    }

    // js/app.js - Replace the entire renderAnalysis method

renderAnalysis() {
    const type = document.getElementById('analysisType').value;
    const container = document.getElementById('analysisContent');
    
    let analysisData = [];
    
    if (type === 'supplier') {
        const supplierMap = new Map();
        this.data.pending.forEach(p => {
            if (!supplierMap.has(p.supplier)) {
                supplierMap.set(p.supplier, { 
                    total: 0, 
                    pending: 0, 
                    completed: 0, 
                    overDelivery: 0,
                    fulfilled: 0
                });
            }
            const entry = supplierMap.get(p.supplier);
            entry.total += p.totalOrder;
            
            if (p.status === 'completed') {
                // ✅ Completed: count as fulfilled
                entry.completed += p.totalOrder;
                entry.fulfilled += p.totalOrder;
            } else if (p.status === 'over-delivery') {
                // ✅ Over-Delivery: count the order as fulfilled, track excess separately
                entry.overDelivery += p.excess || 0;
                entry.fulfilled += p.totalOrder;  // The order is fulfilled
                entry.completed += p.totalOrder;  // Also count as completed
            } else if (p.status === 'partial') {
                // ✅ Partial: delivered portion is fulfilled, remaining is pending
                entry.fulfilled += p.delivered;
                entry.pending += p.remaining;
            } else {
                // ✅ Pending: nothing fulfilled
                entry.pending += p.remaining || p.totalOrder;
            }
        });
        
        analysisData = Array.from(supplierMap.entries()).map(([supplier, data]) => ({
            name: supplier,
            total: data.total,
            pending: data.pending,
            completed: data.completed,
            overDelivery: data.overDelivery,
            fulfilled: data.fulfilled,
            // ✅ Fulfillment rate: what % of ordered items were delivered (including over-delivery)
            fulfillmentRate: data.total > 0 ? (data.fulfilled / data.total * 100).toFixed(1) : 0,
            // ✅ Excess rate: what % of ordered items were extra
            excessRate: data.total > 0 ? (data.overDelivery / data.total * 100).toFixed(1) : 0,
            hasOverDelivery: data.overDelivery > 0
        }));
    } else if (type === 'sku') {
        const skuMap = new Map();
        this.data.pending.forEach(p => {
            if (!skuMap.has(p.sku)) {
                skuMap.set(p.sku, { 
                    total: 0, 
                    pending: 0, 
                    completed: 0, 
                    overDelivery: 0,
                    fulfilled: 0
                });
            }
            const entry = skuMap.get(p.sku);
            entry.total += p.totalOrder;
            
            if (p.status === 'completed') {
                entry.completed += p.totalOrder;
                entry.fulfilled += p.totalOrder;
            } else if (p.status === 'over-delivery') {
                entry.overDelivery += p.excess || 0;
                entry.fulfilled += p.totalOrder;
                entry.completed += p.totalOrder;
            } else if (p.status === 'partial') {
                entry.fulfilled += p.delivered;
                entry.pending += p.remaining;
            } else {
                entry.pending += p.remaining || p.totalOrder;
            }
        });
        
        analysisData = Array.from(skuMap.entries()).map(([sku, data]) => ({
            name: sku,
            total: data.total,
            pending: data.pending,
            completed: data.completed,
            overDelivery: data.overDelivery,
            fulfilled: data.fulfilled,
            fulfillmentRate: data.total > 0 ? (data.fulfilled / data.total * 100).toFixed(1) : 0,
            excessRate: data.total > 0 ? (data.overDelivery / data.total * 100).toFixed(1) : 0,
            hasOverDelivery: data.overDelivery > 0
        }));
    } else {
        const dateMap = new Map();
        this.data.pending.forEach(p => {
            const date = p.orderDate.split('T')[0];
            if (!dateMap.has(date)) {
                dateMap.set(date, { 
                    total: 0, 
                    pending: 0, 
                    completed: 0, 
                    overDelivery: 0,
                    fulfilled: 0
                });
            }
            const entry = dateMap.get(date);
            entry.total += p.totalOrder;
            
            if (p.status === 'completed') {
                entry.completed += p.totalOrder;
                entry.fulfilled += p.totalOrder;
            } else if (p.status === 'over-delivery') {
                entry.overDelivery += p.excess || 0;
                entry.fulfilled += p.totalOrder;
                entry.completed += p.totalOrder;
            } else if (p.status === 'partial') {
                entry.fulfilled += p.delivered;
                entry.pending += p.remaining;
            } else {
                entry.pending += p.remaining || p.totalOrder;
            }
        });
        
        analysisData = Array.from(dateMap.entries()).map(([date, data]) => ({
            name: date,
            total: data.total,
            pending: data.pending,
            completed: data.completed,
            overDelivery: data.overDelivery,
            fulfilled: data.fulfilled,
            fulfillmentRate: data.total > 0 ? (data.fulfilled / data.total * 100).toFixed(1) : 0,
            excessRate: data.total > 0 ? (data.overDelivery / data.total * 100).toFixed(1) : 0,
            hasOverDelivery: data.overDelivery > 0
        }));
    }
    
    // Render analysis with accurate metrics
    container.innerHTML = `
        <div class="analysis-table-wrapper">
            <table>
                <thead>
                    <tr>
                        <th>${type === 'date' ? 'Date' : type === 'supplier' ? 'Supplier' : 'SKU'}</th>
                        <th>Total Ordered</th>
                        <th>Fulfilled</th>
                        <th>Pending</th>
                        <th>Excess Delivered</th>
                        <th>Fulfillment Rate</th>
                        <th>Excess Rate</th>
                    </tr>
                </thead>
                <tbody>
                    ${analysisData.map(item => `
                        <tr>
                            <td><strong>${item.name}</strong></td>
                            <td>${item.total}</td>
                            <td>${item.fulfilled}</td>
                            <td>${item.pending}</td>
                            <td style="color: ${item.overDelivery > 0 ? '#EF4444' : '#6B7280'}; font-weight: ${item.overDelivery > 0 ? '600' : 'normal'};">
                                ${item.overDelivery > 0 ? `⚠️ ${item.overDelivery}` : '0'}
                            </td>
                            <td>
                                <div class="progress-bar">
                                    <div class="progress-fill" style="width: ${item.fulfillmentRate}%; background: ${item.fulfillmentRate >= 100 ? '#10B981' : item.fulfillmentRate >= 50 ? '#F59E0B' : '#EF4444'};"></div>
                                    <span>${item.fulfillmentRate}%</span>
                                </div>
                            </td>
                            <td style="color: ${item.excessRate > 0 ? '#EF4444' : '#6B7280'};">
                                ${item.excessRate > 0 ? `${item.excessRate}%` : '0%'}
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        <div style="margin-top: 16px; padding: 16px; background: ${analysisData.some(item => item.hasOverDelivery) ? '#FEF2F2' : '#ECFDF5'}; border-radius: 8px; border-left: 4px solid ${analysisData.some(item => item.hasOverDelivery) ? '#EF4444' : '#10B981'};">
            <p style="margin: 0; font-size: 14px; color: ${analysisData.some(item => item.hasOverDelivery) ? '#991B1B' : '#065F46'};">
                <strong>📊 Understanding the Metrics:</strong>
            </p>
            <ul style="margin: 8px 0 0 20px; font-size: 13px; color: ${analysisData.some(item => item.hasOverDelivery) ? '#991B1B' : '#065F46'};">
                <li><strong>Fulfilled:</strong> Units delivered (including over-delivery)</li>
                <li><strong>Fulfillment Rate:</strong> Percentage of ordered units that were delivered</li>
                ${analysisData.some(item => item.hasOverDelivery) ? `
                    <li><strong>Excess Delivered:</strong> Units delivered beyond what was ordered</li>
                    <li><strong>Excess Rate:</strong> Percentage of ordered units delivered in excess</li>
                ` : ''}
                <li><strong>Pending:</strong> Units still waiting to be delivered</li>
            </ul>
            ${analysisData.some(item => item.hasOverDelivery) ? `
                <div style="margin-top: 8px; padding: 8px; background: #FEE2E2; border-radius: 4px; font-size: 13px; color: #991B1B;">
                    <strong>⚠️ Note:</strong> Over-delivery means you received more than ordered. 
                    The fulfillment rate includes these units, and excess rate shows the overage.
                </div>
            ` : ''}
        </div>
    `;
}

    // Utility methods
    switchView(view) {
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.toggle('active', item.dataset.view === view);
        });
        
        document.querySelectorAll('.view').forEach(v => {
            v.classList.toggle('active', v.id === `view-${view}`);
        });
        
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
        
        if (view === 'analysis') {
            this.renderAnalysis();
            this.addBossExport();
        }
        
        if (window.innerWidth <= 768) {
            document.getElementById('sidebar').classList.remove('open');
        }
    }

    openUploadModal() {
        document.getElementById('uploadModal').classList.add('active');
        document.getElementById('orderFiles').value = '';
        document.getElementById('deliveryFiles').value = '';
        document.getElementById('actualFiles').value = '';
    }

    openFilterModal() {
        document.getElementById('filterModal').classList.add('active');
        document.getElementById('filterSupplier').value = this.filters.supplier;
        document.getElementById('filterDateFrom').value = this.filters.dateFrom;
        document.getElementById('filterDateTo').value = this.filters.dateTo;
        document.getElementById('filterSKU').value = this.filters.sku;
        document.getElementById('filterStatus').value = this.filters.status;
    }

    // js/app.js - Replace the applyFilters method

applyFilters() {
    // Get filter values from modal
    this.filters.supplier = document.getElementById('filterSupplier').value;
    this.filters.dateFrom = document.getElementById('filterDateFrom').value;
    this.filters.dateTo = document.getElementById('filterDateTo').value;
    this.filters.sku = document.getElementById('filterSKU').value;
    this.filters.status = document.getElementById('filterStatus').value;
    
    document.getElementById('filterModal').classList.remove('active');
    
    // Apply filters to all views
    this.applyFiltersToAllViews();
    
    this.showNotification('Filters applied successfully!', 'success');
}

// Add this new method to apply filters to all views
applyFiltersToAllViews() {
    // Filter Orders
    const filteredOrders = this.data.orders.filter(order => {
        let match = true;
        
        if (this.filters.supplier && order.supplier !== this.filters.supplier) {
            match = false;
        }
        if (this.filters.sku && !order.sku.toLowerCase().includes(this.filters.sku.toLowerCase())) {
            match = false;
        }
        if (this.filters.dateFrom && order.orderDate < this.filters.dateFrom) {
            match = false;
        }
        if (this.filters.dateTo && order.orderDate > this.filters.dateTo) {
            match = false;
        }
        
        return match;
    });
    
    // Filter Deliveries
    const filteredDeliveries = this.data.deliveries.filter(delivery => {
        let match = true;
        
        if (this.filters.supplier && delivery.supplier !== this.filters.supplier) {
            match = false;
        }
        if (this.filters.sku && !delivery.sku.toLowerCase().includes(this.filters.sku.toLowerCase())) {
            match = false;
        }
        if (this.filters.dateFrom && delivery.deliveryDate < this.filters.dateFrom) {
            match = false;
        }
        if (this.filters.dateTo && delivery.deliveryDate > this.filters.dateTo) {
            match = false;
        }
        
        return match;
    });
    
    // Filter Actual Received
    const filteredActual = this.data.actual.filter(actual => {
        let match = true;
        
        if (this.filters.supplier && actual.supplier !== this.filters.supplier) {
            match = false;
        }
        if (this.filters.sku && !actual.sku.toLowerCase().includes(this.filters.sku.toLowerCase())) {
            match = false;
        }
        if (this.filters.dateFrom && actual.actualDate < this.filters.dateFrom) {
            match = false;
        }
        if (this.filters.dateTo && actual.actualDate > this.filters.dateTo) {
            match = false;
        }
        
        return match;
    });
    
    // Filter Pending Orders
    const filteredPending = this.data.pending.filter(pending => {
        let match = true;
        
        if (this.filters.supplier && pending.supplier !== this.filters.supplier) {
            match = false;
        }
        if (this.filters.sku && !pending.sku.toLowerCase().includes(this.filters.sku.toLowerCase())) {
            match = false;
        }
        if (this.filters.dateFrom && pending.orderDate < this.filters.dateFrom) {
            match = false;
        }
        if (this.filters.dateTo && pending.orderDate > this.filters.dateTo) {
            match = false;
        }
        if (this.filters.status && pending.status !== this.filters.status) {
            match = false;
        }
        
        return match;
    });
    
    // Render filtered views
    this.renderFilteredOrders(filteredOrders);
    this.renderFilteredDeliveries(filteredDeliveries);
    this.renderFilteredActual(filteredActual);
    this.renderFilteredPending(filteredPending);
}

// Add these helper methods for rendering filtered data

renderFilteredOrders(orders) {
    const tbody = document.getElementById('ordersBody');
    if (orders.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 20px; color: var(--gray-500);">No orders match the filters</td></tr>`;
        return;
    }
    tbody.innerHTML = orders.map(order => `
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

renderFilteredDeliveries(deliveries) {
    const tbody = document.getElementById('deliveriesBody');
    if (deliveries.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 20px; color: var(--gray-500);">No deliveries match the filters</td></tr>`;
        return;
    }
    tbody.innerHTML = deliveries.map(delivery => `
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

renderFilteredActual(actual) {
    const tbody = document.getElementById('actualBody');
    if (actual.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 20px; color: var(--gray-500);">No actual received items match the filters</td></tr>`;
        return;
    }
    tbody.innerHTML = actual.map(item => `
        <tr>
            <td><strong>${item.sku}</strong></td>
            <td>${item.qty}</td>
            <td>${item.supplier}</td>
            <td>${this.formatDate(item.actualDate)}</td>
            <td>${item.boxCode || '-'}</td>
            <td><span class="status-badge status-completed">Received</span></td>
        </tr>
    `).join('');
}

renderFilteredPending(pending) {
    const tbody = document.getElementById('pendingBody');
    if (pending.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 20px; color: var(--gray-500);">No pending orders match the filters</td></tr>`;
        return;
    }
    
    const statusMap = {
        'completed': 'status-completed',
        'pending': 'status-pending',
        'partial': 'status-partial',
        'over-delivery': 'status-over-delivery'
    };
    
    const statusTextMap = {
        'completed': '✅ Completed',
        'pending': '⏳ Pending',
        'partial': '⏳ Partial',
        'over-delivery': '⚠️ Over-Delivery'
    };
    
    tbody.innerHTML = pending.map(item => {
        const statusClass = statusMap[item.status] || 'status-pending';
        const statusText = statusTextMap[item.status] || item.status;
        const excessDisplay = item.excess > 0 ? ` (+${item.excess} excess)` : '';
        
        return `
            <tr>
                <td><strong>${item.sku}</strong></td>
                <td>${item.totalOrder}</td>
                <td>${item.delivered}</td>
                <td>${item.remaining}${excessDisplay}</td>
                <td>${item.supplier}</td>
                <td>${this.formatDate(item.orderDate)}</td>
                <td><span class="status-badge ${statusClass}">${statusText}</span></td>
            </tr>
        `;
    }).join('');
}

// Also update clearFilters method
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
    
    // Reset all views to show all data
    this.renderOrders();
    this.renderDeliveries();
    this.renderActual();
    this.renderPending();
    
    this.showNotification('Filters cleared!', 'info');
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
                <td>${pending.remaining}${pending.excess > 0 ? ` (+${pending.excess} excess)` : ''}</td>
                <td>${pending.supplier}</td>
                <td>${this.formatDate(pending.orderDate)}</td>
                <td><span class="status-badge status-${pending.status}">${pending.status === 'over-delivery' ? '⚠️ Over-Delivery' : pending.status}</span></td>
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
                <td>${pending.remaining}${pending.excess > 0 ? ` (+${pending.excess} excess)` : ''}</td>
                <td>${pending.supplier}</td>
                <td>${this.formatDate(pending.orderDate)}</td>
                <td><span class="status-badge status-${pending.status}">${pending.status === 'over-delivery' ? '⚠️ Over-Delivery' : pending.status}</span></td>
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
            
            zone.addEventListener('click', () => fileInput.click());
            
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
            
            if (!driveManager.isAuthenticated) {
                await driveManager.authenticate();
            }
            
            const orderFiles = document.getElementById('orderFiles').files;
            const deliveryFiles = document.getElementById('deliveryFiles').files;
            const actualFiles = document.getElementById('actualFiles').files;
            
            let uploadCount = 0;
            
            for (const file of orderFiles) {
                await driveManager.uploadFile(CONFIG.FOLDERS.ORDER, file);
                uploadCount++;
            }
            
            for (const file of deliveryFiles) {
                await driveManager.uploadFile(CONFIG.FOLDERS.DELIVERY, file);
                uploadCount++;
            }
            
            for (const file of actualFiles) {
                await driveManager.uploadFile(CONFIG.FOLDERS.ACTUAL, file);
                uploadCount++;
            }
            
            document.getElementById('uploadModal').classList.remove('active');
            
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
            
            let csv = 'SKU,Total Order,Delivered,Remaining,Excess,Supplier,Order Date,Status\n';
            data.forEach(p => {
                csv += `${p.sku},${p.totalOrder},${p.delivered},${p.remaining},${p.excess || 0},${p.supplier},${p.orderDate},${p.status}\n`;
            });
            
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
        
        const duration = type === 'warning' ? 8000 : 5000;
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease forwards';
            setTimeout(() => notification.remove(), 300);
        }, duration);
        
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
        if (typeof window.driveManager === 'undefined' && typeof driveManager !== 'undefined') {
            window.driveManager = driveManager;
        }
        window.app = new OrderManagementApp();
    });
});
