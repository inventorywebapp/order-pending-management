// ============================================
// EXPORT MANAGER
// ============================================

class ExportManager {
    constructor() { this.cache = null; }

    exportData(type, data) {
        let exportData = [], filename = '', headers = [];
        const map = {
            pending: [data.pendingOrders || [], 'pending_orders', ['SKU', 'Supplier', 'Date', 'Code', 'Ordered', 'Delivered', 'Pending']],
            complete: [data.completeOrders || [], 'complete_orders', ['SKU', 'Supplier', 'Date', 'Code', 'Ordered', 'Delivered']],
            partial: [data.partialOrders || [], 'partial_orders', ['SKU', 'Supplier', 'Date', 'Code', 'Ordered', 'Delivered', 'Pending']],
            all: [data.orderStatus || [], 'all_orders', ['SKU', 'Supplier', 'Date', 'Code', 'Ordered', 'Delivered', 'Pending', 'Status']],
            discrepancies: [data.discrepancies || [], 'discrepancies', ['SKU', 'Supplier', 'Box', 'DeliveryQty', 'ActualQty', 'Diff', 'Status']],
            supplier: [() => {
                const stats = data.summary?.supplierStats || {};
                return Object.keys(stats).map(s => ({ Supplier: s, ...stats[s] }));
            }, 'supplier_summary', ['Supplier', 'Ordered', 'Delivered', 'Pending']]
        };
        const [rows, name, cols] = map[type] || map.all;
        exportData = typeof rows === 'function' ? rows() : rows;
        filename = name;
        headers = cols;

        this.showPreview(exportData, filename, headers);
        this.cache = { data: exportData, filename, headers };
    }

    showPreview(data, filename, headers) {
        const body = document.getElementById('exportModalBody');
        let html = `<h6>📊 ${filename.replace(/_/g, ' ').toUpperCase()}</h6><p>${data.length} records</p>`;
        if (data.length) {
            html += `<div class="table-responsive"><table class="table table-sm"><thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>`;
            data.slice(0, 10).forEach(row => {
                html += `<tr>${headers.map(h => `<td>${row[h] !== undefined ? row[h] : '-'}</td>`).join('')}</tr>`;
            });
            if (data.length > 10) html += `<tr><td colspan="${headers.length}" class="text-muted">... and ${data.length - 10} more</td></tr>`;
            html += `</tbody></table></div>`;
        } else {
            html += `<div class="alert alert-warning">No data</div>`;
        }
        body.innerHTML = html;
        new bootstrap.Modal(document.getElementById('exportModal')).show();
    }

    downloadExport() {
        if (!this.cache || !this.cache.data.length) { alert('No data to export'); return; }
        const { data, filename, headers } = this.cache;
        let csv = headers.join(',') + '\n';
        data.forEach(row => {
            csv += headers.map(h => {
                let val = row[h] !== undefined ? row[h] : '';
                if (typeof val === 'string' && (val.includes(',') || val.includes('"') || val.includes('\n'))) {
                    val = `"${val.replace(/"/g, '""')}"`;
                }
                return val;
            }).join(',') + '\n';
        });
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `${filename}_${new Date().toISOString().slice(0,10)}.csv`;
        link.click();
        URL.revokeObjectURL(link.href);
        bootstrap.Modal.getInstance(document.getElementById('exportModal')).hide();
    }

    showSupplierSelector(data) {
        const suppliers = Object.keys(data.summary?.supplierStats || {});
        if (!suppliers.length) { alert('No suppliers found'); return; }
        const body = document.getElementById('exportModalBody');
        body.innerHTML = `<h5>🏢 Select Supplier</h5><div class="list-group">${suppliers.map(s => `
            <a href="#" class="list-group-item list-group-item-action" onclick="window.showSupplierReport('${s}')">
                <div class="d-flex justify-content-between"><span><strong>${s}</strong></span>
                <span>Pending: ${data.summary.supplierStats[s]?.pending || 0} <span class="badge ${data.summary.supplierStats[s]?.pending === 0 ? 'bg-success' : 'bg-warning'}">${data.summary.supplierStats[s]?.pending === 0 ? '✅' : '⏳'}</span></span></div>
            </a>`).join('')}</div>`;
        new bootstrap.Modal(document.getElementById('exportModal')).show();
    }

    showSupplierReport(data, supplier) {
        const orders = (data.orderStatus || []).filter(o => o.Supplier === supplier && o.status === 'Pending');
        const total = orders.reduce((s, o) => s + (o.remainingQty || 0), 0);
        const ordered = orders.reduce((s, o) => s + (o.originalQty || 0), 0);
        const body = document.getElementById('exportModalBody');
        body.innerHTML = `
            <h5>📊 ${supplier}</h5>
            <div class="row g-2 mb-3">
                <div class="col-4"><div class="card bg-warning"><div class="card-body"><h6>Pending Orders</h6><h3>${orders.length}</h3></div></div></div>
                <div class="col-4"><div class="card bg-danger"><div class="card-body"><h6>Pending Units</h6><h3>${total}</h3></div></div></div>
                <div class="col-4"><div class="card bg-info"><div class="card-body"><h6>Fulfillment</h6><h3>${ordered > 0 ? Math.round(((ordered - total) / ordered) * 100) : 0}%</h3></div></div></div>
            </div>
            ${orders.length ? `<div class="table-responsive"><table class="table table-sm"><thead><tr><th>SKU</th><th>Date</th><th>Code</th><th>Ordered</th><th>Delivered</th><th>Pending</th></tr></thead><tbody>${orders.map(o => `<tr><td>${o.SKU}</td><td>${o.Date}</td><td>${o.Code || '-'}</td><td>${o.originalQty}</td><td>${o.deliveredQty || 0}</td><td class="text-danger fw-bold">${o.remainingQty}</td></tr>`).join('')}</tbody></table></div>` : '<div class="alert alert-success">✅ No pending orders</div>'}`;
    }
}

const exportManager = new ExportManager();
