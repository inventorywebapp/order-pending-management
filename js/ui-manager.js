// ============================================
// UI MANAGER
// ============================================

class UIManager {
    constructor() { this.data = null; }

    updateUI(data) {
        this.data = data;
        this.updateStats(data);
        this.updateTable('pendingTableBody', data.pendingOrders, ['SKU', 'Supplier', 'Date', 'Code', 'originalQty', 'deliveredQty', 'remainingQty', 'status']);
        this.updateTable('completeTableBody', data.completeOrders, ['SKU', 'Supplier', 'Date', 'Code', 'originalQty', 'deliveredQty']);
        this.updateTable('partialTableBody', data.partialOrders, ['SKU', 'Supplier', 'Date', 'Code', 'originalQty', 'deliveredQty', 'remainingQty']);
        this.updateDeliveryTable(data.deliveries, data.allocations);
        this.updateDiscrepancyTable(data.discrepancies);
        this.updateSummary(data);
        this.updateBadges(data);
        this.populateFilters(data);
        document.getElementById('lastUpdate').textContent = `Last updated: ${new Date().toLocaleString()}`;
    }

    updateStats(data) {
        document.getElementById('statPending').textContent = data.pendingOrders.length;
        document.getElementById('statComplete').textContent = data.completeOrders.length;
        document.getElementById('statPartial').textContent = data.partialOrders.length;
        document.getElementById('statDiscrepancy').textContent = data.discrepancies.length;
        document.getElementById('statSuppliers').textContent = Object.keys(data.summary.supplierStats || {}).length;
        document.getElementById('statFIFO').textContent = '✓';
    }

    updateBadges(data) {
        document.getElementById('pendingBadge').textContent = data.pendingOrders.length;
        document.getElementById('completeBadge').textContent = data.completeOrders.length;
        document.getElementById('partialBadge').textContent = data.partialOrders.length;
        document.getElementById('deliveryBadge').textContent = data.deliveries.length;
        document.getElementById('discrepancyBadge').textContent = data.discrepancies.length;
    }

    updateTable(id, rows, fields) {
        const tbody = document.getElementById(id);
        if (!rows || !rows.length) {
            tbody.innerHTML = `<tr><td colspan="${fields.length}" class="text-center text-muted">No data</td></tr>`;
            return;
        }
        tbody.innerHTML = rows.map(row => `
            <tr>
                ${fields.map(f => `<td>${row[f] !== undefined && row[f] !== null ? row[f] : '-'}</td>`).join('')}
            </tr>
        `).join('');
    }

    updateDeliveryTable(deliveries, allocations) {
        const tbody = document.getElementById('deliveryTableBody');
        if (!deliveries || !deliveries.length) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No deliveries</td></tr>';
            return;
        }
        tbody.innerHTML = deliveries.map(d => {
            const allocs = allocations.filter(a => a.box === d.Box);
            const total = allocs.reduce((s, a) => s + a.allocated, 0);
            const status = total >= d.DeliveryQty ? '✅ Allocated' : `⚠️ ${d.DeliveryQty - total} pending`;
            return `<tr><td>${d.SKU}</td><td>${d.Supplier}</td><td>${d.Box || '-'}</td><td>${d.DeliveryQty}</td><td>${d.Date}</td><td>${status}</td></tr>`;
        }).join('');
    }

    updateDiscrepancyTable(discrepancies) {
        const tbody = document.getElementById('discrepancyTableBody');
        if (!discrepancies || !discrepancies.length) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center text-success">✅ No discrepancies</td></tr>';
            return;
        }
        tbody.innerHTML = discrepancies.map(d => {
            const badge = d.Status === 'SKU_MISMATCH' ? '<span class="badge bg-warning text-dark">SKU Mismatch</span>' :
                          `<span class="badge ${d.Severity === 'CRITICAL' || d.Severity === 'HIGH' ? 'bg-danger' : 'bg-warning'}">${d.Status}</span>`;
            return `<tr><td>${d.SKU}</td><td>${d.Supplier}</td><td>${d.Box || '-'}</td><td>${d.DeliveryQty}</td><td>${d.ActualQty}</td><td>${d.Diff > 0 ? '+' : ''}${d.Diff}</td><td>${badge}</td></tr>`;
        }).join('');
    }

    updateSummary(data) {
        const container = document.getElementById('summaryContent');
        const s = data.summary;
        let supplierHTML = '';
        if (s.supplierStats) {
            Object.keys(s.supplierStats).forEach(sup => {
                const st = s.supplierStats[sup];
                const pct = st.ordered > 0 ? Math.round((st.delivered / st.ordered) * 100) : 0;
                const color = pct === 100 ? 'success' : (pct > 50 ? 'warning' : 'danger');
                supplierHTML += `<div class="supplier-progress"><span class="supplier-name">${sup}</span><div class="progress"><div class="progress-bar bg-${color}" style="width:${pct}%">${pct}%</div></div><span class="percentage">${st.delivered}/${st.ordered}</span></div>`;
            });
        }
        container.innerHTML = `
            <div class="row">
                <div class="col-md-6">
                    <h5>📊 Overview</h5>
                    <div class="row g-2 mb-3">
                        <div class="col-6"><div class="card bg-light"><div class="card-body"><h6>Total Orders</h6><h3>${s.totalOrders}</h3></div></div></div>
                        <div class="col-6"><div class="card bg-light"><div class="card-body"><h6>Fulfillment</h6><h3>${s.totalOrders > 0 ? Math.round((s.statusCounts.complete / s.totalOrders) * 100) : 0}%</h3></div></div></div>
                    </div>
                    <div class="card bg-light"><div class="card-body"><h6>Status</h6>
                        <div class="d-flex justify-content-between"><span>✅ Complete: <strong>${s.statusCounts.complete}</strong></span><span>🟡 Partial: <strong>${s.statusCounts.partial}</strong></span><span>⏳ Pending: <strong>${s.statusCounts.pending}</strong></span></div>
                        <div class="progress mt-2" style="height:20px;">
                            <div class="progress-bar bg-success" style="width:${s.totalOrders > 0 ? (s.statusCounts.complete / s.totalOrders) * 100 : 0}%">Complete</div>
                            <div class="progress-bar bg-warning" style="width:${s.totalOrders > 0 ? (s.statusCounts.partial / s.totalOrders) * 100 : 0}%">Partial</div>
                            <div class="progress-bar bg-danger" style="width:${s.totalOrders > 0 ? (s.statusCounts.pending / s.totalOrders) * 100 : 0}%">Pending</div>
                        </div>
                    </div></div>
                </div>
                <div class="col-md-6"><h5>🏢 Suppliers</h5>${supplierHTML || '<p class="text-muted">No supplier data</p>'}</div>
            </div>
            ${data.discrepancies.some(d => d.Status === 'SKU_MISMATCH') ?
            `<div class="alert alert-warning mt-3"><strong>💡 Note:</strong> SKU mismatches (e.g., Gen3 vs Gen4) mean the delivery document said one SKU, but actual received was different. The order was still deducted because delivery happened.</div>` : ''}
            ${data.lastProcessed ? `<div class="text-muted mt-3"><small>📅 Last processed: ${new Date(data.lastProcessed).toLocaleString()}</small></div>` : ''}
        `;
    }

    populateFilters(data) {
        const suppliers = new Set(data.orders.map(o => o.Supplier).filter(Boolean));
        const sel = document.getElementById('filterSupplier');
        const val = sel.value;
        sel.innerHTML = '<option value="">All</option>';
        [...suppliers].sort().forEach(s => sel.innerHTML += `<option value="${s}">${s}</option>`);
        if (val) sel.value = val;
    }

    applyFilters() {
        const supplier = document.getElementById('filterSupplier').value;
        const sku = document.getElementById('filterSKU').value.toLowerCase();
        const from = document.getElementById('filterDateFrom').value;
        const to = document.getElementById('filterDateTo').value;
        const status = document.getElementById('filterStatus').value;
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
            const cells = row.cells;
            if (cells.length < 3) return;
            const rowSupplier = cells[1]?.textContent || '';
            const rowSKU = cells[0]?.textContent || '';
            const rowDate = cells[2]?.textContent || '';
            const rowStatus = cells[cells.length - 2]?.textContent || '';
            let show = true;
            if (supplier && !rowSupplier.includes(supplier)) show = false;
            if (sku && !rowSKU.toLowerCase().includes(sku)) show = false;
            if (from && rowDate < from) show = false;
            if (to && rowDate > to) show = false;
            if (status && !rowStatus.includes(status)) show = false;
            row.style.display = show ? '' : 'none';
            if (show) visible++;
        });
        document.getElementById('filterCount').textContent = visible;
        document.getElementById('filterSummary').textContent = supplier ? `Supplier: ${supplier}` : 'All';
    }

    clearFilters() {
        document.getElementById('filterSupplier').value = '';
        document.getElementById('filterSKU').value = '';
        document.getElementById('filterDateFrom').value = '';
        document.getElementById('filterDateTo').value = '';
        document.getElementById('filterStatus').value = '';
        this.applyFilters();
    }

    showLoading(show, title = 'Processing', msg = 'Loading...') {
        const overlay = document.getElementById('loadingOverlay');
        if (show) {
            document.getElementById('loadingTitle').textContent = title;
            document.getElementById('loadingMessage').textContent = msg;
            document.getElementById('loadingProgress').style.width = '0%';
            document.getElementById('loadingDetail').textContent = 'Starting...';
            overlay.classList.add('active');
        } else {
            overlay.classList.remove('active');
        }
    }

    updateLoadingProgress(pct, msg, detail = '') {
        document.getElementById('loadingProgress').style.width = `${pct}%`;
        if (msg) document.getElementById('loadingMessage').textContent = msg;
        if (detail) document.getElementById('loadingDetail').textContent = detail;
    }

    showStatus(msg, type = 'info') {
        const el = document.getElementById('statusMessage');
        document.getElementById('statusText').textContent = msg;
        el.className = `alert alert-${type} alert-dismissible fade show`;
        el.style.display = 'block';
        if (type === 'success') setTimeout(() => el.style.display = 'none', 5000);
    }
}

const uiManager = new UIManager();
