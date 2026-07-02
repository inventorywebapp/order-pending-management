// ============================================
// ORDER PENDING MANAGEMENT SYSTEM
// Google Drive Integration with FIFO Logic
// ============================================

// Configuration
const CONFIG = {
    CLIENT_ID: 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com',
    API_KEY: 'YOUR_GOOGLE_API_KEY',
    SCOPES: 'https://www.googleapis.com/auth/drive.readonly',
    FOLDERS: {
        MAIN: '12PxB1WMGrLov54kajAGCHqnEJOjqtJlW',
        ORDER: '13UZpplt52LNel3dXzxF33-CYLxOV03cS',
        DELIVERY: '1RyPAqPIZwygu13TKscW2zzRzpYr8c7Xv',
        ACTUAL: '1AlxxHhueUEuv03WPTPlssQ1fAr4IGoUG'
    }
};

// ============================================
// STATE MANAGEMENT
// ============================================
const state = {
    orders: [],
    deliveries: [],
    actualReceived: [],

    // Processed data
    orderStatus: [],      // Each order with status
    deliveryAllocations: [], // Which orders each delivery fulfilled
    discrepancies: [],
    pendingOrders: [],
    completeOrders: [],
    partialOrders: [],

    // Summary
    summary: {
        totalOrders: 0,
        totalPending: 0,
        totalComplete: 0,
        totalPartial: 0,
        totalDelivered: 0,
        totalDiscrepancies: 0,
        supplierStats: {},
        skuStats: {}
    },

    // Metadata
    lastProcessed: null,
    dataVersion: '2.0',
    exportCache: null
};

// ============================================
// GOOGLE DRIVE API
// ============================================
function initGoogleAPI() {
    gapi.client.init({
        apiKey: CONFIG.API_KEY,
        clientId: CONFIG.CLIENT_ID,
        scope: CONFIG.SCOPES,
        discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest']
    }).then(() => {
        console.log('Google API initialized');
        showStatus('Connected to Google Drive', 'success');
        // Auto-process if enabled
        processAll();
    }).catch(error => {
        console.error('API init error:', error);
        showStatus('Failed to connect to Google Drive. Check credentials.', 'danger');
    });
}

function loadGoogleAPI() {
    if (typeof gapi !== 'undefined') {
        gapi.load('client', initGoogleAPI);
    } else {
        showStatus('Google API not loaded. Please check internet connection.', 'danger');
    }
}

async function getFilesFromFolder(folderId) {
    try {
        const response = await gapi.client.drive.files.list({
            q: `'${folderId}' in parents and trashed = false`,
            fields: 'files(id, name, mimeType, modifiedTime)',
            orderBy: 'name'
        });
        return response.result.files || [];
    } catch (error) {
        console.error('Error getting files:', error);
        throw error;
    }
}

async function downloadAndParseExcel(fileId) {
    try {
        const response = await gapi.client.drive.files.get({
            fileId: fileId,
            alt: 'media'
        });

        const blob = new Blob([new Uint8Array(response.body)], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });

        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = function(e) {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const sheet = workbook.Sheets[workbook.SheetNames[0]];
                    const json = XLSX.utils.sheet_to_json(sheet);
                    resolve(json);
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = reject;
            reader.readAsArrayBuffer(blob);
        });
    } catch (error) {
        console.error('Error downloading file:', error);
        throw error;
    }
}

// ============================================
// DATA LOADING
// ============================================
async function loadOrders() {
    const files = await getFilesFromFolder(CONFIG.FOLDERS.ORDER);
    const excelFiles = files.filter(f => f.name.match(/\.(xlsx|xls)$/i));

    if (excelFiles.length === 0) {
        showStatus('No order files found in Order folder', 'warning');
        return [];
    }

    let allOrders = [];
    let processed = 0;

    for (const file of excelFiles) {
        try {
            updateLoadingProgress(processed / excelFiles.length * 30, `Loading: ${file.name}`);
            const data = await downloadAndParseExcel(file.id);

            const mapped = data.map(row => ({
                SKU: String(row['SKU'] || row['sku'] || row['Sku'] || '').trim(),
                OrderQty: parseInt(row['Order Qty'] || row['Order_Qty'] || row['OrderQty'] || row['Qty'] || 0),
                Supplier: String(row['Supplier'] || row['supplier'] || row['Vendor'] || '').trim(),
                OrderDate: String(row['Order Date'] || row['Order_Date'] || row['OrderDate'] || '').trim(),
                OrderCode: String(row['Order Code'] || row['Order_Code'] || row['OrderCode'] || '').trim(),
                FileName: file.name
            })).filter(d => d.SKU && d.OrderQty > 0);

            allOrders = allOrders.concat(mapped);
            processed++;
        } catch (error) {
            console.error(`Error loading ${file.name}:`, error);
        }
    }

    updateLoadingProgress(30, `Loaded ${allOrders.length} orders`);
    return allOrders;
}

async function loadDeliveries() {
    const files = await getFilesFromFolder(CONFIG.FOLDERS.DELIVERY);
    const excelFiles = files.filter(f => f.name.match(/\.(xlsx|xls)$/i));

    if (excelFiles.length === 0) {
        showStatus('No delivery files found', 'warning');
        return [];
    }

    let allDeliveries = [];
    let processed = 0;

    for (const file of excelFiles) {
        try {
            updateLoadingProgress(30 + (processed / excelFiles.length * 30), `Loading delivery: ${file.name}`);
            const data = await downloadAndParseExcel(file.id);

            const mapped = data.map(row => ({
                SKU: String(row['SKU'] || row['sku'] || row['Sku'] || '').trim(),
                DeliveryQty: parseInt(row['Delivery Qty'] || row['Delivery_Qty'] || row['DeliveryQty'] || row['Qty'] || 0),
                Supplier: String(row['Supplier'] || row['supplier'] || row['Vendor'] || '').trim(),
                EstDeliveryDate: String(row['Est. Delivery Date'] || row['Est_Delivery_Date'] || row['EstDeliveryDate'] || '').trim(),
                BoxCode: String(row['Box Code'] || row['Box_Code'] || row['BoxCode'] || row['Box'] || '').trim(),
                FileName: file.name
            })).filter(d => d.SKU && d.DeliveryQty > 0);

            allDeliveries = allDeliveries.concat(mapped);
            processed++;
        } catch (error) {
            console.error(`Error loading ${file.name}:`, error);
        }
    }

    updateLoadingProgress(60, `Loaded ${allDeliveries.length} deliveries`);
    return allDeliveries;
}

async function loadActualReceived() {
    const files = await getFilesFromFolder(CONFIG.FOLDERS.ACTUAL);
    const excelFiles = files.filter(f => f.name.match(/\.(xlsx|xls)$/i));

    if (excelFiles.length === 0) {
        return [];
    }

    let allActual = [];
    let processed = 0;

    for (const file of excelFiles) {
        try {
            updateLoadingProgress(60 + (processed / excelFiles.length * 20), `Loading actual: ${file.name}`);
            const data = await downloadAndParseExcel(file.id);

            const mapped = data.map(row => ({
                SKU: String(row['SKU'] || row['sku'] || row['Sku'] || '').trim(),
                DeliveryQty: parseInt(row['Delivery Qty'] || row['Delivery_Qty'] || row['DeliveryQty'] || row['Qty'] || 0),
                Supplier: String(row['Supplier'] || row['supplier'] || row['Vendor'] || '').trim(),
                ActDeliveryDate: String(row['Act. Delivery Date'] || row['Act_Delivery_Date'] || row['ActDeliveryDate'] || '').trim(),
                BoxCode: String(row['Box Code'] || row['Box_Code'] || row['BoxCode'] || row['Box'] || '').trim(),
                FileName: file.name
            })).filter(d => d.SKU && d.DeliveryQty > 0);

            allActual = allActual.concat(mapped);
            processed++;
        } catch (error) {
            console.error(`Error loading ${file.name}:`, error);
        }
    }

    updateLoadingProgress(80, `Loaded ${allActual.length} actual received records`);
    return allActual;
}

// ============================================
// CORE PROCESSING - FIFO LOGIC
// ============================================
function processOrders(orders, deliveries) {
    // Group orders by SKU|Supplier
    const orderGroups = {};
    orders.forEach(order => {
        const key = `${order.SKU}|${order.Supplier}`;
        if (!orderGroups[key]) orderGroups[key] = [];
        orderGroups[key].push({
            ...order,
            originalQty: order.OrderQty,
            remainingQty: order.OrderQty,
            deliveredQty: 0,
            allocations: [],
            status: 'Pending'
        });
    });

    // Sort each group by Order Date (FIFO)
    Object.keys(orderGroups).forEach(key => {
        orderGroups[key].sort((a, b) => {
            const dateA = new Date(a.OrderDate) || new Date(0);
            const dateB = new Date(b.OrderDate) || new Date(0);
            return dateA - dateB;
        });
    });

    // Group deliveries by SKU|Supplier
    const deliveryGroups = {};
    deliveries.forEach(delivery => {
        const key = `${delivery.SKU}|${delivery.Supplier}`;
        if (!deliveryGroups[key]) deliveryGroups[key] = [];
        deliveryGroups[key].push({
            ...delivery,
            remainingQty: delivery.DeliveryQty,
            fulfilledOrders: []
        });
    });

    // Sort deliveries by estimated date
    Object.keys(deliveryGroups).forEach(key => {
        deliveryGroups[key].sort((a, b) => {
            const dateA = new Date(a.EstDeliveryDate) || new Date(0);
            const dateB = new Date(b.EstDeliveryDate) || new Date(0);
            return dateA - dateB;
        });
    });

    const allocations = [];
    const pendingOrders = [];
    const completeOrders = [];
    const partialOrders = [];

    // Process each group
    Object.keys(orderGroups).forEach(key => {
        const [sku, supplier] = key.split('|');
        const orderList = orderGroups[key];
        const deliveryList = deliveryGroups[key] || [];

        let deliveryIndex = 0;
        let totalDelivered = 0;

        orderList.forEach(order => {
            let orderRemaining = order.remainingQty;

            // Try to fulfill this order with deliveries (FIFO)
            while (orderRemaining > 0 && deliveryIndex < deliveryList.length) {
                const delivery = deliveryList[deliveryIndex];
                const available = delivery.remainingQty;

                if (available > 0) {
                    const allocated = Math.min(orderRemaining, available);
                    order.remainingQty -= allocated;
                    order.deliveredQty += allocated;
                    delivery.remainingQty -= allocated;
                    orderRemaining -= allocated;
                    totalDelivered += allocated;

                    allocations.push({
                        orderCode: order.OrderCode,
                        orderDate: order.OrderDate,
                        sku: sku,
                        supplier: supplier,
                        boxCode: delivery.BoxCode,
                        deliveryDate: delivery.EstDeliveryDate,
                        allocated: allocated,
                        deliveryRemaining: delivery.remainingQty
                    });

                    // Store allocation in order
                    order.allocations.push({
                        boxCode: delivery.BoxCode,
                        qty: allocated,
                        date: delivery.EstDeliveryDate
                    });
                }

                if (delivery.remainingQty === 0) {
                    deliveryIndex++;
                }
            }

            // Determine order status
            const delivered = order.deliveredQty;
            const ordered = order.originalQty;

            if (delivered === 0) {
                order.status = 'Pending';
                pendingOrders.push(order);
            } else if (delivered < ordered) {
                order.status = 'Partial';
                partialOrders.push(order);
            } else {
                order.status = 'Complete';
                completeOrders.push(order);
            }
        });
    });

    // Any remaining deliveries that weren't fully allocated
    const unallocatedDeliveries = [];
    Object.keys(deliveryGroups).forEach(key => {
        deliveryGroups[key].forEach(delivery => {
            if (delivery.remainingQty > 0) {
                unallocatedDeliveries.push({
                    ...delivery,
                    unallocatedQty: delivery.remainingQty
                });
            }
        });
    });

    return {
        orderStatus: [...pendingOrders, ...partialOrders, ...completeOrders],
        pendingOrders,
        completeOrders,
        partialOrders,
        allocations,
        unallocatedDeliveries
    };
}

function findDiscrepancies(deliveries, actualReceived) {
    const discrepancies = [];

    // Group actual by Box Code
    const actualByBox = {};
    actualReceived.forEach(actual => {
        const key = actual.BoxCode || 'unknown';
        if (!actualByBox[key]) actualByBox[key] = [];
        actualByBox[key].push(actual);
    });

    // Compare each delivery
    deliveries.forEach(delivery => {
        const actualItems = actualByBox[delivery.BoxCode] || [];

        if (actualItems.length === 0) {
            discrepancies.push({
                SKU: delivery.SKU,
                Supplier: delivery.Supplier,
                BoxCode: delivery.BoxCode,
                DeliveryQty: delivery.DeliveryQty,
                ActualQty: 0,
                Difference: -delivery.DeliveryQty,
                Status: 'MISSING',
                Explanation: `Delivery record exists but no actual received record for Box ${delivery.BoxCode}`
            });
        } else {
            const totalActual = actualItems.reduce((sum, item) => sum + item.DeliveryQty, 0);
            const diff = totalActual - delivery.DeliveryQty;

            if (diff !== 0) {
                // Check for SKU mismatch
                const actualSKUs = [...new Set(actualItems.map(a => a.SKU))];
                const skuMismatch = actualSKUs.length > 1 || (actualSKUs.length === 1 && actualSKUs[0] !== delivery.SKU);

                let status = '';
                let explanation = '';

                if (skuMismatch) {
                    status = 'SKU_MISMATCH';
                    explanation = `Delivered: ${delivery.SKU}, Actual: ${actualSKUs.join(', ')}`;
                } else if (diff > 0) {
                    status = 'OVER_RECEIVED';
                    explanation = `Received ${diff} more than delivered`;
                } else {
                    status = 'UNDER_RECEIVED';
                    explanation = `Received ${Math.abs(diff)} less than delivered`;
                }

                discrepancies.push({
                    SKU: delivery.SKU,
                    Supplier: delivery.Supplier,
                    BoxCode: delivery.BoxCode,
                    DeliveryQty: delivery.DeliveryQty,
                    ActualQty: totalActual,
                    Difference: diff,
                    Status: status,
                    Explanation: explanation,
                    Severity: skuMismatch ? 'CRITICAL' : (Math.abs(diff) > delivery.DeliveryQty * 0.5 ? 'HIGH' : 'MEDIUM')
                });
            }
        }
    });

    // Check for actual received with no delivery
    const deliveryBoxes = new Set(deliveries.map(d => d.BoxCode));
    actualReceived.forEach(actual => {
        if (!deliveryBoxes.has(actual.BoxCode)) {
            discrepancies.push({
                SKU: actual.SKU,
                Supplier: actual.Supplier,
                BoxCode: actual.BoxCode,
                DeliveryQty: 0,
                ActualQty: actual.DeliveryQty,
                Difference: actual.DeliveryQty,
                Status: 'UNMATCHED',
                Explanation: `Received ${actual.DeliveryQty} but no delivery record for Box ${actual.BoxCode}`,
                Severity: 'HIGH'
            });
        }
    });

    return discrepancies;
}

// ============================================
// MAIN PROCESS
// ============================================
async function processAll() {
    showLoading(true, 'Processing Data', 'Loading orders from Google Drive...');

    try {
        // 1. Load data
        state.orders = await loadOrders();
        state.deliveries = await loadDeliveries();
        state.actualReceived = await loadActualReceived();

        if (state.orders.length === 0) {
            showStatus('No orders found. Please upload order files.', 'warning');
            showLoading(false);
            return;
        }

        // 2. Process orders with FIFO
        updateLoadingProgress(85, 'Processing FIFO allocations...');
        const result = processOrders(state.orders, state.deliveries);

        state.orderStatus = result.orderStatus;
        state.pendingOrders = result.pendingOrders;
        state.completeOrders = result.completeOrders;
        state.partialOrders = result.partialOrders;
        state.deliveryAllocations = result.allocations;
        state.unallocatedDeliveries = result.unallocatedDeliveries;

        // 3. Find discrepancies
        updateLoadingProgress(92, 'Checking discrepancies...');
        state.discrepancies = findDiscrepancies(state.deliveries, state.actualReceived);

        // 4. Generate summary
        updateLoadingProgress(96, 'Generating summary...');
        generateSummary();

        // 5. Update UI
        updateUI();

        state.lastProcessed = new Date().toISOString();
        document.getElementById('lastUpdate').textContent = `Last updated: ${new Date(state.lastProcessed).toLocaleString()}`;

        updateLoadingProgress(100, 'Complete!');
        showStatus(`✅ Processing complete! ${state.pendingOrders.length} pending, ${state.completeOrders.length} complete, ${state.partialOrders.length} partial, ${state.discrepancies.length} discrepancies`, 'success');

        // Populate filters
        populateFilters();

    } catch (error) {
        console.error('Processing error:', error);
        showStatus(`❌ Error: ${error.message}`, 'danger');
    } finally {
        setTimeout(() => showLoading(false), 500);
    }
}

// ============================================
// SUMMARY GENERATION
// ============================================
function generateSummary() {
    const summary = {
        totalOrders: state.orders.length,
        totalPending: state.pendingOrders.length,
        totalComplete: state.completeOrders.length,
        totalPartial: state.partialOrders.length,
        totalDelivered: state.deliveries.length,
        totalDiscrepancies: state.discrepancies.length,
        supplierStats: {},
        skuStats: {}
    };

    // Supplier stats
    state.orders.forEach(order => {
        if (!summary.supplierStats[order.Supplier]) {
            summary.supplierStats[order.Supplier] = { ordered: 0, delivered: 0, pending: 0, complete: 0 };
        }
        summary.supplierStats[order.Supplier].ordered += order.OrderQty;
    });

    state.orderStatus.forEach(order => {
        if (summary.supplierStats[order.Supplier]) {
            summary.supplierStats[order.Supplier].delivered += order.deliveredQty || 0;
            summary.supplierStats[order.Supplier].pending += order.remainingQty || 0;
            if (order.status === 'Complete') {
                summary.supplierStats[order.Supplier].complete += order.originalQty;
            }
        }
    });

    // SKU stats
    state.orders.forEach(order => {
        if (!summary.skuStats[order.SKU]) {
            summary.skuStats[order.SKU] = { ordered: 0, delivered: 0, pending: 0 };
        }
        summary.skuStats[order.SKU].ordered += order.OrderQty;
    });

    state.orderStatus.forEach(order => {
        if (summary.skuStats[order.SKU]) {
            summary.skuStats[order.SKU].delivered += order.deliveredQty || 0;
            summary.skuStats[order.SKU].pending += order.remainingQty || 0;
        }
    });

    state.summary = summary;
}

// ============================================
// UI UPDATE FUNCTIONS
// ============================================
function updateUI() {
    // Update stats
    document.getElementById('statPending').textContent = state.pendingOrders.length;
    document.getElementById('statComplete').textContent = state.completeOrders.length;
    document.getElementById('statPartial').textContent = state.partialOrders.length;
    document.getElementById('statDiscrepancy').textContent = state.discrepancies.length;
    document.getElementById('statSuppliers').textContent = Object.keys(state.summary.supplierStats || {}).length;
    document.getElementById('statFIFO').textContent = '✓ FIFO';

    // Update badges
    document.getElementById('pendingBadge').textContent = state.pendingOrders.length;
    document.getElementById('completeBadge').textContent = state.completeOrders.length;
    document.getElementById('partialBadge').textContent = state.partialOrders.length;
    document.getElementById('deliveryBadge').textContent = state.deliveries.length;
    document.getElementById('discrepancyBadge').textContent = state.discrepancies.length;

    // Update tables
    updatePendingTable();
    updateCompleteTable();
    updatePartialTable();
    updateDeliveryTable();
    updateDiscrepancyTable();
    updateSummary();
}

function updatePendingTable() {
    const tbody = document.getElementById('pendingTableBody');
    if (state.pendingOrders.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="text-center text-muted">No pending orders 🎉</td></tr>';
        return;
    }

    tbody.innerHTML = state.pendingOrders.map(order => `
        <tr class="pending-highlight">
            <td><strong>${order.SKU}</strong></td>
            <td>${order.Supplier}</td>
            <td>${order.OrderDate}</td>
            <td>${order.OrderCode || '-'}</td>
            <td>${order.originalQty}</td>
            <td>${order.deliveredQty || 0}</td>
            <td><strong class="text-danger">${order.remainingQty}</strong></td>
            <td><span class="status-badge pending">Pending</span></td>
            <td>${order.allocations.length > 0 ? `Box ${order.allocations[0].boxCode} (${order.allocations[0].qty} units)` : 'No delivery yet'}</td>
        </tr>
    `).join('');
}

function updateCompleteTable() {
    const tbody = document.getElementById('completeTableBody');
    if (state.completeOrders.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted">No complete orders yet</td></tr>';
        return;
    }

    tbody.innerHTML = state.completeOrders.map(order => {
        const lastDelivery = order.allocations.length > 0 ? order.allocations[order.allocations.length - 1] : null;
        return `
            <tr class="complete-highlight">
                <td><strong>${order.SKU}</strong></td>
                <td>${order.Supplier}</td>
                <td>${order.OrderDate}</td>
                <td>${order.OrderCode || '-'}</td>
                <td>${order.originalQty}</td>
                <td>${order.deliveredQty}</td>
                <td>${lastDelivery ? lastDelivery.date : '-'}</td>
                <td>${lastDelivery ? `Box ${lastDelivery.boxCode}` : '-'}</td>
            </tr>
        `;
    }).join('');
}

function updatePartialTable() {
    const tbody = document.getElementById('partialTableBody');
    if (state.partialOrders.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted">No partial orders</td></tr>';
        return;
    }

    tbody.innerHTML = state.partialOrders.map(order => {
        const nextDelivery = order.allocations.length > 0 ? order.allocations[order.allocations.length - 1] : null;
        return `
            <tr class="partial-highlight">
                <td><strong>${order.SKU}</strong></td>
                <td>${order.Supplier}</td>
                <td>${order.OrderDate}</td>
                <td>${order.OrderCode || '-'}</td>
                <td>${order.originalQty}</td>
                <td>${order.deliveredQty}</td>
                <td><strong class="text-warning">${order.remainingQty}</strong></td>
                <td>${nextDelivery ? `Box ${nextDelivery.boxCode} (${nextDelivery.qty} units)` : 'Awaiting delivery'}</td>
            </tr>
        `;
    }).join('');
}

function updateDeliveryTable() {
    const tbody = document.getElementById('deliveryTableBody');
    if (state.deliveries.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted">No deliveries</td></tr>';
        return;
    }

    tbody.innerHTML = state.deliveries.map(delivery => {
        const allocation = state.deliveryAllocations.filter(a => a.boxCode === delivery.BoxCode);
        const totalAllocated = allocation.reduce((sum, a) => sum + a.allocated, 0);
        const isFullyAllocated = totalAllocated >= delivery.DeliveryQty;

        // Check actual received
        const actualItems = state.actualReceived.filter(a => a.BoxCode === delivery.BoxCode);
        const actualTotal = actualItems.reduce((sum, a) => sum + a.DeliveryQty, 0);
        const actualMatch = actualTotal === delivery.DeliveryQty;

        const statusIcon = isFullyAllocated ? '✅' : '⚠️';
        const actualStatus = actualMatch ? '✅ Match' : (actualTotal > 0 ? `⚠️ ${actualTotal} units` : '❌ Missing');

        return `
            <tr>
                <td><strong>${delivery.SKU}</strong></td>
                <td>${delivery.Supplier}</td>
                <td>${delivery.BoxCode || '-'}</td>
                <td>${delivery.DeliveryQty}</td>
                <td>${delivery.EstDeliveryDate}</td>
                <td>${allocation.map(a => `${a.orderCode}: ${a.allocated}`).join('<br>') || 'Unallocated'}</td>
                <td>${statusIcon} ${isFullyAllocated ? 'Allocated' : `${delivery.DeliveryQty - totalAllocated} pending`}</td>
                <td>${actualStatus}</td>
            </tr>
        `;
    }).join('');
}

function updateDiscrepancyTable() {
    const tbody = document.getElementById('discrepancyTableBody');
    if (state.discrepancies.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center text-success">✅ No discrepancies found!</td></tr>';
        return;
    }

    tbody.innerHTML = state.discrepancies.map(disp => {
        const severityClass = disp.Severity === 'CRITICAL' ? 'table-danger' :
                            disp.Severity === 'HIGH' ? 'table-warning' : 'table-info';
        const statusBadge = disp.Status === 'SKU_MISMATCH' ?
            '<span class="badge bg-warning text-dark">SKU Mismatch</span>' :
            `<span class="badge bg-${disp.Status === 'MISSING' || disp.Status === 'UNMATCHED' ? 'danger' : 'warning'}">${disp.Status}</span>`;

        return `
            <tr class="${severityClass}">
                <td><strong>${disp.SKU}</strong></td>
                <td>${disp.Supplier}</td>
                <td>${disp.BoxCode || '-'}</td>
                <td>${disp.DeliveryQty}</td>
                <td>${disp.ActualQty}</td>
                <td>${disp.Difference > 0 ? '+' : ''}${disp.Difference}</td>
                <td>${statusBadge}</td>
                <td><small>${disp.Explanation}</small></td>
            </tr>
        `;
    }).join('');
}

function updateSummary() {
    const container = document.getElementById('summaryContent');
    const s = state.summary;

    // Supplier progress bars
    let supplierHTML = '';
    if (s.supplierStats) {
        Object.keys(s.supplierStats).forEach(supplier => {
            const stats = s.supplierStats[supplier];
            const pct = stats.ordered > 0 ? Math.round((stats.delivered / stats.ordered) * 100) : 0;
            const color = pct === 100 ? 'success' : (pct > 50 ? 'warning' : 'danger');
            supplierHTML += `
                <div class="supplier-progress">
                    <span class="supplier-name">${supplier}</span>
                    <div class="progress">
                        <div class="progress-bar bg-${color}" style="width: ${pct}%">${pct}%</div>
                    </div>
                    <span class="percentage">${stats.delivered}/${stats.ordered}</span>
                </div>
            `;
        });
    }

    // Top SKUs with pending
    let skuPendingHTML = '';
    if (s.skuStats) {
        const skuList = Object.keys(s.skuStats)
            .map(sku => ({ sku, ...s.skuStats[sku] }))
            .filter(item => item.pending > 0)
            .sort((a, b) => b.pending - a.pending)
            .slice(0, 10);

        skuPendingHTML = skuList.map(item => `
            <tr>
                <td><strong>${item.sku}</strong></td>
                <td>${item.ordered}</td>
                <td>${item.delivered}</td>
                <td class="text-danger fw-bold">${item.pending}</td>
                <td>
                    <div class="progress" style="height: 15px;">
                        <div class="progress-bar bg-${item.pending === 0 ? 'success' : 'warning'}"
                             style="width: ${item.ordered > 0 ? Math.round((item.delivered / item.ordered) * 100) : 0}%">
                            ${item.ordered > 0 ? Math.round((item.delivered / item.ordered) * 100) : 0}%
                        </div>
                    </div>
                </td>
            </tr>
        `).join('');
    }

    container.innerHTML = `
        <div class="row">
            <div class="col-md-6">
                <h5>📊 Order Status Overview</h5>
                <div class="row g-2 mb-3">
                    <div class="col-6">
                        <div class="card bg-light">
                            <div class="card-body">
                                <h6>Total Orders</h6>
                                <h3 class="mb-0">${s.totalOrders}</h3>
                                <small>${s.totalDelivered} deliveries</small>
                            </div>
                        </div>
                    </div>
                    <div class="col-6">
                        <div class="card bg-light">
                            <div class="card-body">
                                <h6>Fulfillment Rate</h6>
                                <h3 class="mb-0">${s.totalOrders > 0 ? Math.round((s.totalComplete / s.totalOrders) * 100) : 0}%</h3>
                                <small>${s.totalComplete} complete</small>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="card bg-light">
                    <div class="card-body">
                        <h6>Status Breakdown</h6>
                        <div class="d-flex justify-content-between">
                            <span>✅ Complete: <strong>${s.totalComplete}</strong></span>
                            <span>🟡 Partial: <strong>${s.totalPartial}</strong></span>
                            <span>⏳ Pending: <strong>${s.totalPending}</strong></span>
                            <span>⚠️ Discrepancies: <strong>${s.totalDiscrepancies}</strong></span>
                        </div>
                        <div class="progress mt-2" style="height: 25px;">
                            <div class="progress-bar bg-success" style="width: ${s.totalOrders > 0 ? (s.totalComplete / s.totalOrders) * 100 : 0}%">Complete</div>
                            <div class="progress-bar bg-warning" style="width: ${s.totalOrders > 0 ? (s.totalPartial / s.totalOrders) * 100 : 0}%">Partial</div>
                            <div class="progress-bar bg-danger" style="width: ${s.totalOrders > 0 ? (s.totalPending / s.totalOrders) * 100 : 0}%">Pending</div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="col-md-6">
                <h5>🏢 Supplier Fulfillment</h5>
                ${supplierHTML || '<p class="text-muted">No supplier data</p>'}
            </div>
        </div>

        <div class="row mt-3">
            <div class="col-md-6">
                <h5>📦 Top SKUs with Pending</h5>
                <div class="table-responsive">
                    <table class="table table-sm">
                        <thead>
                            <tr><th>SKU</th><th>Ordered</th><th>Delivered</th><th>Pending</th><th>Progress</th></tr>
                        </thead>
                        <tbody>
                            ${skuPendingHTML || '<tr><td colspan="5" class="text-muted">No pending SKUs</td></tr>'}
                        </tbody>
                    </table>
                </div>
            </div>

            <div class="col-md-6">
                <h5>⚠️ Discrepancy Summary</h5>
                <ul class="list-group">
                    ${state.discrepancies.length === 0 ?
                        '<li class="list-group-item list-group-item-success">✅ No discrepancies found</li>' :
                        `
                        <li class="list-group-item d-flex justify-content-between align-items-center list-group-item-danger">
                            Critical (SKU Mismatch)
                            <span class="badge bg-danger rounded-pill">${state.discrepancies.filter(d => d.Severity === 'CRITICAL').length}</span>
                        </li>
                        <li class="list-group-item d-flex justify-content-between align-items-center list-group-item-warning">
                            High Priority
                            <span class="badge bg-warning rounded-pill">${state.discrepancies.filter(d => d.Severity === 'HIGH').length}</span>
                        </li>
                        <li class="list-group-item d-flex justify-content-between align-items-center list-group-item-info">
                            Medium Priority
                            <span class="badge bg-info rounded-pill">${state.discrepancies.filter(d => d.Severity === 'MEDIUM').length}</span>
                        </li>
                        `
                    }
                </ul>

                ${state.discrepancies.some(d => d.Status === 'SKU_MISMATCH') ? `
                    <div class="alert alert-warning mt-2">
                        <strong>💡 Note:</strong> SKU mismatches (e.g., Gen3 vs Gen4) mean the delivery document said Gen3,
                        but actual received was Gen4. The order was still deducted because delivery happened,
                        but inventory records should be updated to reflect the actual SKU received.
                    </div>
                ` : ''}
            </div>
        </div>

        ${state.lastProcessed ? `
            <div class="text-muted mt-3">
                <small>📅 Last processed: ${new Date(state.lastProcessed).toLocaleString()}</small>
            </div>
        ` : ''}
    `;
}

// ============================================
// FILTER FUNCTIONS
// ============================================
function populateFilters() {
    const suppliers = new Set();
    state.orders.forEach(o => { if (o.Supplier) suppliers.add(o.Supplier); });

    const select = document.getElementById('filterSupplier');
    select.innerHTML = '<option value="">All Suppliers</option>';
    [...suppliers].sort().forEach(s => {
        select.innerHTML += `<option value="${s}">${s}</option>`;
    });
}

function applyFilters() {
    const supplier = document.getElementById('filterSupplier').value;
    const sku = document.getElementById('filterSKU').value.toLowerCase();
    const dateFrom = document.getElementById('filterDateFrom').value;
    const dateTo = document.getElementById('filterDateTo').value;
    const status = document.getElementById('filterStatus').value;

    // Get the current active tab
    const activeTab = document.querySelector('#mainTabs .nav-link.active');
    let tableId = 'pendingTable';
    if (activeTab) {
        const tabTarget = activeTab.getAttribute('data-bs-target');
        if (tabTarget === '#complete') tableId = 'completeTable';
        else if (tabTarget === '#partial') tableId = 'partialTable';
        else if (tabTarget === '#pending') tableId = 'pendingTable';
        else if (tabTarget === '#deliveries') tableId = 'deliveryTable';
        else if (tabTarget === '#discrepancies') tableId = 'discrepancyTable';
    }

    const table = document.getElementById(tableId);
    if (!table) return;

    const rows = table.querySelectorAll('tbody tr');
    let visible = 0;

    rows.forEach(row => {
        if (row.cells.length < 3) return;

        const rowSupplier = row.cells[1]?.textContent || '';
        const rowSKU = row.cells[0]?.textContent || '';
        const rowDate = row.cells[2]?.textContent || '';
        const rowStatus = row.cells[7]?.textContent || row.cells[6]?.textContent || '';

        let show = true;
        if (supplier && !rowSupplier.includes(supplier)) show = false;
        if (sku && !rowSKU.toLowerCase().includes(sku)) show = false;
        if (dateFrom && rowDate < dateFrom) show = false;
        if (dateTo && rowDate > dateTo) show = false;
        if (status && !rowStatus.includes(status)) show = false;

        row.style.display = show ? '' : 'none';
        if (show) visible++;
    });

    document.getElementById('filterCount').textContent = visible;
    document.getElementById('filterSummary').textContent = supplier ? `Supplier: ${supplier}` : 'All suppliers';
    document.getElementById('filterDateRange').textContent =
        dateFrom || dateTo ? `${dateFrom || 'Any'} to ${dateTo || 'Any'}` : 'All dates';
}

function clearFilters() {
    document.getElementById('filterSupplier').value = '';
    document.getElementById('filterSKU').value = '';
    document.getElementById('filterDateFrom').value = '';
    document.getElementById('filterDateTo').value = '';
    document.getElementById('filterStatus').value = '';
    applyFilters();
}

// ============================================
// EXPORT FUNCTIONS
// ============================================
function exportData(type) {
    let data = [];
    let filename = '';
    let headers = [];

    switch(type) {
        case 'pending':
            data = state.pendingOrders;
            filename = 'pending_orders';
            headers = ['SKU', 'Supplier', 'Order Date', 'Order Code', 'Ordered', 'Delivered', 'Pending'];
            break;
        case 'complete':
            data = state.completeOrders;
            filename = 'complete_orders';
            headers = ['SKU', 'Supplier', 'Order Date', 'Order Code', 'Ordered', 'Delivered'];
            break;
        case 'partial':
            data = state.partialOrders;
            filename = 'partial_orders';
            headers = ['SKU', 'Supplier', 'Order Date', 'Order Code', 'Ordered', 'Delivered', 'Pending'];
            break;
        case 'all':
            data = state.orderStatus;
            filename = 'all_orders';
            headers = ['SKU', 'Supplier', 'Order Date', 'Order Code', 'Ordered', 'Delivered', 'Pending', 'Status'];
            break;
        case 'supplier':
            data = Object.keys(state.summary.supplierStats || {}).map(s => ({
                Supplier: s,
                ...state.summary.supplierStats[s]
            }));
            filename = 'supplier_summary';
            headers = ['Supplier', 'Ordered', 'Delivered', 'Pending', 'Complete'];
            break;
        default:
            data = state.orderStatus;
            filename = 'orders_export';
            headers = ['SKU', 'Supplier', 'Order Date', 'Order Code', 'Ordered', 'Delivered', 'Pending', 'Status'];
    }

    // Show preview
    const modalBody = document.getElementById('exportModalBody');
    let html = `<h6>Exporting ${type.toUpperCase()}</h6>`;
    html += `<p>${data.length} records</p>`;

    if (data.length > 0) {
        html += `<div class="table-responsive"><table class="table table-sm">`;
        html += `<thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>`;
        html += `<tbody>`;
        data.slice(0, 10).forEach(row => {
            html += `<tr>`;
            headers.forEach(h => {
                const val = row[h] || row[h.toLowerCase()] || '-';
                html += `<td>${val}</td>`;
            });
            html += `</tr>`;
        });
        if (data.length > 10) {
            html += `<tr><td colspan="${headers.length}" class="text-muted">... and ${data.length - 10} more</td></tr>`;
        }
        html += `</tbody></table></div>`;
    } else {
        html += `<div class="alert alert-warning">No data to export</div>`;
    }

    modalBody.innerHTML = html;
    state.exportCache = { data, filename, headers };

    new bootstrap.Modal(document.getElementById('exportModal')).show();
}

function downloadExport() {
    if (!state.exportCache || state.exportCache.data.length === 0) {
        alert('No data to export');
        return;
    }

    const { data, filename, headers } = state.exportCache;

    let csv = headers.join(',') + '\n';
    data.forEach(row => {
        const values = headers.map(h => {
            let val = row[h] || row[h.toLowerCase()] || '';
            if (typeof val === 'string' && val.includes(',')) {
                val = `"${val}"`;
            }
            return val;
        });
        csv += values.join(',') + '\n';
    });

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}_${new Date().toISOString().slice(0,10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);

    bootstrap.Modal.getInstance(document.getElementById('exportModal')).hide();
}

// ============================================
// UI UTILITY FUNCTIONS
// ============================================
function showStatus(message, type = 'info') {
    const el = document.getElementById('statusMessage');
    const text = document.getElementById('statusText');
    el.className = `alert alert-${type} alert-dismissible fade show`;
    text.textContent = message;
    el.style.display = 'block';
}

function showLoading(show, title = 'Processing', message = 'Loading...') {
    const overlay = document.getElementById('loadingOverlay');
    if (show) {
        document.getElementById('loadingTitle').textContent = title;
        document.getElementById('loadingMessage').textContent = message;
        document.getElementById('loadingProgress').style.width = '0%';
        document.getElementById('loadingDetail').textContent = 'Starting...';
        overlay.classList.add('active');
    } else {
        overlay.classList.remove('active');
    }
}

function updateLoadingProgress(pct, message, detail = '') {
    document.getElementById('loadingProgress').style.width = `${pct}%`;
    if (message) document.getElementById('loadingMessage').textContent = message;
    if (detail) document.getElementById('loadingDetail').textContent = detail;
}

function refreshData() {
    processAll();
}

// ============================================
// INITIALIZATION
// ============================================
document.addEventListener('DOMContentLoaded', function() {
    loadGoogleAPI();

    // Keyboard shortcuts
    document.addEventListener('keydown', function(e) {
        if (e.ctrlKey && e.key === 'Enter') {
            e.preventDefault();
            processAll();
        }
        if (e.ctrlKey && e.key === 'f') {
            e.preventDefault();
            document.getElementById('filterSKU').focus();
        }
    });

    // Auto-apply filters on Enter key for SKU filter
    document.getElementById('filterSKU').addEventListener('keyup', function(e) {
        if (e.key === 'Enter') applyFilters();
    });
});

// Export functions for global access
window.processAll = processAll;
window.refreshData = refreshData;
window.applyFilters = applyFilters;
window.clearFilters = clearFilters;
window.exportData = exportData;
window.downloadExport = downloadExport;