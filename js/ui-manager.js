// ============================================
// UI MANAGER
// ============================================

class UIManager {
    constructor() {
        this.currentData = null;
        this.filters = {
            supplier: '',
            sku: '',
            dateFrom: '',
            dateTo: '',
            status: ''
        };
    }

    // Update all UI components
    updateUI(data) {
        this.currentData = data;

        this.updateStats(data);
        this.updatePendingTable(data.pendingOrders);
        this.updateCompleteTable(data.completeOrders);
        this.updatePartialTable(data.partialOrders);
        this.updateDeliveryTable(data.deliveries, data.allocations);
        this.updateDiscrepancyTable(data.discrepancies);
        this.updateSummary(data);
        this.updateBadges(data);
        this.populateFilters(data);

        // Update last processed time
        document.getElementById('lastUpdate').textContent =
            `Last updated: ${new Date().toLocaleString()}`;
    }

    // Update stats cards
    updateStats(data) {
        document.getElementById('statPending').textContent = data.pendingOrders.length;
        document.getElementById('statComplete').textContent = data.completeOrders.length;
        document.getElementById('statPartial').textContent = data.partialOrders.length;
        document.getElementById('statDiscrepancy').textContent = data.discrepancies.length;
        document.getElementById('statSuppliers').textContent =
            Object.keys(data.summary.supplierStats || {}).length;
        document.getElementById('statFIFO').textContent = '✓ FIFO';
    }

    // Update badges on tabs
    updateBadges(data) {
        document.getElementById('pendingBadge').textContent = data.pendingOrders.length;
        document.getElementById('completeBadge').textContent = data.completeOrders.length;
        document.getElementById('partialBadge').textContent = data.partialOrders.length;
        document.getElementById('deliveryBadge').textContent = data.deliveries.length;
        document.getElementById('discrepancyBadge').textContent = data.discrepancies.length;
    }

    // Update pending orders table
    updatePendingTable(pendingOrders) {
        const tbody = document.getElementById('pendingTableBody');

        if (!pendingOrders || pendingOrders.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" class="text-center text-muted">No pending orders 🎉</td></tr>';
            return;
        }

        tbody.innerHTML = pendingOrders.map(order => `
            <tr class="pending-highlight">
                <td><strong>${order.SKU}</strong></td>
                <td>${order.Supplier}</td>
                <td>${order.OrderDate}</td>
                <td>${order.OrderCode || '-'}</td>
                <td>${order.originalQty}</td>
                <td>${order.deliveredQty || 0}</td>
                <td><strong class="text-danger">${order.remainingQty}</strong></td>
                <td><span class="status-badge pending">Pending</span></td>
                <td>${this.getDeliveryInfo(order)}</td>
            </tr>
        `).join('');
    }

    // Update complete orders table
    updateCompleteTable(completeOrders) {
        const tbody = document.getElementById('completeTableBody');

        if (!completeOrders || completeOrders.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted">No complete orders yet</td></tr>';
            return;
        }

        tbody.innerHTML = completeOrders.map(order => {
            const lastDelivery = order.allocations && order.allocations.length > 0
                ? order.allocations[order.allocations.length - 1]
                : null;
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

    // Update partial orders table
    updatePartialTable(partialOrders) {
        const tbody = document.getElementById('partialTableBody');

        if (!partialOrders || partialOrders.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted">No partial orders</td></tr>';
            return;
        }

        tbody.innerHTML = partialOrders.map(order => {
            const nextDelivery = order.allocations && order.allocations.length > 0
                ? order.allocations[order.allocations.length - 1]
                : null;
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

    // Update delivery table
    updateDeliveryTable(deliveries, allocations) {
        const tbody = document.getElementById('deliveryTableBody');

        if (!deliveries || deliveries.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted">No deliveries</td></tr>';
            return;
        }

        tbody.innerHTML = deliveries.map(delivery => {
            const allocs = allocations.filter(a => a.boxCode === delivery.BoxCode);
            const totalAllocated = allocs.reduce((sum, a) => sum + a.allocated, 0);
            const isFullyAllocated = totalAllocated >= delivery.DeliveryQty;

            return `
                <tr>
                    <td><strong>${delivery.SKU}</strong></td>
                    <td>${delivery.Supplier}</td>
                    <td>${delivery.BoxCode || '-'}</td>
                    <td>${delivery.DeliveryQty}</td>
                    <td>${delivery.EstDeliveryDate}</td>
                    <td>${allocs.map(a => `${a.orderCode}: ${a.allocated}`).join('<br>') || 'Unallocated'}</td>
                    <td>${isFullyAllocated ? '✅ Allocated' : `⚠️ ${delivery.DeliveryQty - totalAllocated} pending`}</td>
                    <td>${this.getActualStatus(delivery)}</td>
                </tr>
            `;
        }).join('');
    }

    // Update discrepancies table
    updateDiscrepancyTable(discrepancies) {
        const tbody = document.getElementById('discrepancyTableBody');

        if (!discrepancies || discrepancies.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="text-center text-success">✅ No discrepancies found!</td></tr>';
            return;
        }

        tbody.innerHTML = discrepancies.map(disp => {
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

    // Update summary
    updateSummary(data) {
        const container = document.getElementById('summaryContent');
        const s = data.summary;

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
                                    <small>${s.totalDeliveries} deliveries</small>
                                </div>
                            </div>
                        </div>
                        <div class="col-6">
                            <div class="card bg-light">
                                <div class="card-body">
                                    <h6>Fulfillment Rate</h6>
                                    <h3 class="mb-0">${s.totalOrders > 0 ? Math.round((s.statusCounts.complete / s.totalOrders) * 100) : 0}%</h3>
                                    <small>${s.statusCounts.complete} complete</small>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="card bg-light">
                        <div class="card-body">
                            <h6>Status Breakdown</h6>
                            <div class="d-flex justify-content-between">
                                <span>✅ Complete: <strong>${s.statusCounts.complete}</strong></span>
                                <span>🟡 Partial: <strong>${s.statusCounts.partial}</strong></span>
                                <span>⏳ Pending: <strong>${s.statusCounts.pending}</strong></span>
                                <span>⚠️ Discrepancies: <strong>${data.discrepancies.length}</strong></span>
                            </div>
                            <div class="progress mt-2" style="height: 25px;">
                                <div class="progress-bar bg-success" style="width: ${s.totalOrders > 0 ? (s.statusCounts.complete / s.totalOrders) * 100 : 0}%">Complete</div>
                                <div class="progress-bar bg-warning" style="width: ${s.totalOrders > 0 ? (s.statusCounts.partial / s.totalOrders) * 100 : 0}%">Partial</div>
                                <div class="progress-bar bg-danger" style="width: ${s.totalOrders > 0 ? (s.statusCounts.pending / s.totalOrders) * 100 : 0}%">Pending</div>
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
                    ${this.getSKUPendingTable(data)}
                </div>
                <div class="col-md-6">
                    <h5>⚠️ Discrepancy Summary</h5>
                    ${this.getDiscrepancySummary(data)}
                </div>
            </div>

            ${data.lastProcessed ? `
                <div class="text-muted mt-3">
                    <small>📅 Last processed: ${new Date(data.lastProcessed).toLocaleString()}</small>
                </div>
            ` : ''}
        `;
    }

    // Helper: Get delivery info for order
    getDeliveryInfo(order) {
        if (!order.allocations || order.allocations.length === 0) {
            return 'No delivery yet';
        }
        return order.allocations.map(a =>
            `Box ${a.boxCode} (${a.qty} units)`
        ).join('<br>');
    }

    // Helper: Get actual status for delivery
    getActualStatus(delivery) {
        const actualItems = this.currentData?.actualReceived?.filter(
            a => a.BoxCode === delivery.BoxCode
        ) || [];

        if (actualItems.length === 0) {
            return '<span class="text-danger">❌ Missing</span>';
        }

        const totalActual = actualItems.reduce((sum, a) => sum + a.DeliveryQty, 0);
        if (totalActual === delivery.DeliveryQty) {
            return '<span class="text-success">✅ Match</span>';
        }
        return `<span class="text-warning">⚠️ ${totalActual} units</span>`;
    }

    // Helper: Get SKU pending table
    getSKUPendingTable(data) {
        const skuStats = data.summary.skuStats || {};
        const skuList = Object.keys(skuStats)
            .map(sku => ({ sku, ...skuStats[sku] }))
            .filter(item => item.pending > 0)
            .sort((a, b) => b.pending - a.pending)
            .slice(0, 10);

        if (skuList.length === 0) {
            return '<p class="text-muted">No pending SKUs</p>';
        }

        return `
            <div class="table-responsive">
                <table class="table table-sm">
                    <thead>
                        <tr><th>SKU</th><th>Ordered</th><th>Delivered</th><th>Pending</th><th>Progress</th></tr>
                    </thead>
                    <tbody>
                        ${skuList.map(item => `
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
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    // Helper: Get discrepancy summary
    getDiscrepancySummary(data) {
        const discrepancies = data.discrepancies || [];

        if (discrepancies.length === 0) {
            return '<div class="alert alert-success">✅ No discrepancies found</div>';
        }

        const critical = discrepancies.filter(d => d.Severity === 'CRITICAL').length;
        const high = discrepancies.filter(d => d.Severity === 'HIGH').length;
        const medium = discrepancies.filter(d => d.Severity === 'MEDIUM').length;

        let html = `
            <ul class="list-group">
                <li class="list-group-item d-flex justify-content-between align-items-center list-group-item-danger">
                    Critical (SKU Mismatch)
                    <span class="badge bg-danger rounded-pill">${critical}</span>
                </li>
                <li class="list-group-item d-flex justify-content-between align-items-center list-group-item-warning">
                    High Priority
                    <span class="badge bg-warning rounded-pill">${high}</span>
                </li>
                <li class="list-group-item d-flex justify-content-between align-items-center list-group-item-info">
                    Medium Priority
                    <span class="badge bg-info rounded-pill">${medium}</span>
                </li>
            </ul>
        `;

        // Add note about SKU mismatches
        if (discrepancies.some(d => d.Status === 'SKU_MISMATCH')) {
            html += `
                <div class="alert alert-warning mt-2">
                    <strong>💡 Note:</strong> SKU mismatches (e.g., Gen3 vs Gen4) mean the delivery document said Gen3,
                    but actual received was Gen4. The order was still deducted because delivery happened,
                    but inventory records should be updated to reflect the actual SKU received.
                </div>
            `;
        }

        return html;
    }

    // Populate filter dropdowns
    populateFilters(data) {
        const suppliers = new Set();
        data.orders.forEach(o => { if (o.Supplier) suppliers.add(o.Supplier); });

        const select = document.getElementById('filterSupplier');
        const currentValue = select.value;
        select.innerHTML = '<option value="">All Suppliers</option>';
        [...suppliers].sort().forEach(s => {
            select.innerHTML += `<option value="${s}">${s}</option>`;
        });
        if (currentValue) select.value = currentValue;

        // Initialize Select2 if available
        if (typeof $ !== 'undefined' && $.fn.select2) {
            $('.select2').select2({
                placeholder: 'Search supplier...',
                allowClear: true
            });
        }
    }

    // Apply filters to tables
    applyFilters() {
        const supplier = document.getElementById('filterSupplier').value;
        const sku = document.getElementById('filterSKU').value.toLowerCase();
        const dateFrom = document.getElementById('filterDateFrom').value;
        const dateTo = document.getElementById('filterDateTo').value;
        const status = document.getElementById('filterStatus').value;

        // Find active tab
        const activeTab = document.querySelector('#mainTabs .nav-link.active');
        let tableId = 'pendingTable';
        if (activeTab) {
            const target = activeTab.getAttribute('data-bs-target');
            if (target === '#complete') tableId = 'completeTable';
            else if (target === '#partial') tableId = 'partialTable';
            else if (target === '#pending') tableId = 'pendingTable';
            else if (target === '#deliveries') tableId = 'deliveryTable';
            else if (target === '#discrepancies') tableId = 'discrepancyTable';
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
        document.getElementById('filterSummary').textContent =
            supplier ? `Supplier: ${supplier}` : 'All suppliers';
        document.getElementById('filterDateRange').textContent =
            dateFrom || dateTo ? `${dateFrom || 'Any'} to ${dateTo || 'Any'}` : 'All dates';
    }

    // Clear all filters
    clearFilters() {
        document.getElementById('filterSupplier').value = '';
        document.getElementById('filterSKU').value = '';
        document.getElementById('filterDateFrom').value = '';
        document.getElementById('filterDateTo').value = '';
        document.getElementById('filterStatus').value = '';
        if (typeof $ !== 'undefined' && $.fn.select2) {
            $('.select2').val('').trigger('change');
        }
        this.applyFilters();
    }

    // Show/hide loading
    showLoading(show, title = 'Processing', message = 'Loading...') {
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

    // Update loading progress
    updateLoadingProgress(pct, message, detail = '') {
        document.getElementById('loadingProgress').style.width = `${pct}%`;
        if (message) document.getElementById('loadingMessage').textContent = message;
        if (detail) document.getElementById('loadingDetail').textContent = detail;
    }

    // Show status message
    showStatus(message, type = 'info') {
        const el = document.getElementById('statusMessage');
        const text = document.getElementById('statusText');
        el.className = `alert alert-${type} alert-dismissible fade show`;
        text.textContent = message;
        el.style.display = 'block';

        // Auto-hide after 5 seconds for success messages
        if (type === 'success') {
            setTimeout(() => {
                el.style.display = 'none';
            }, 5000);
        }
    }
}

// Create singleton instance
const uiManager = new UIManager();