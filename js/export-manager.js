// ============================================
// EXPORT MANAGER
// ============================================

class ExportManager {
    constructor() {
        this.exportCache = null;
    }

    // Export data based on type
    exportData(type, data) {
        let exportData = [];
        let filename = '';
        let headers = [];

        switch(type) {
            case 'pending':
                exportData = data.pendingOrders || [];
                filename = 'pending_orders';
                headers = ['SKU', 'Supplier', 'Order Date', 'Order Code', 'Ordered', 'Delivered', 'Pending'];
                break;
            case 'complete':
                exportData = data.completeOrders || [];
                filename = 'complete_orders';
                headers = ['SKU', 'Supplier', 'Order Date', 'Order Code', 'Ordered', 'Delivered'];
                break;
            case 'partial':
                exportData = data.partialOrders || [];
                filename = 'partial_orders';
                headers = ['SKU', 'Supplier', 'Order Date', 'Order Code', 'Ordered', 'Delivered', 'Pending'];
                break;
            case 'all':
                exportData = data.orderStatus || [];
                filename = 'all_orders';
                headers = ['SKU', 'Supplier', 'Order Date', 'Order Code', 'Ordered', 'Delivered', 'Pending', 'Status'];
                break;
            case 'supplier':
                const supplierStats = data.summary?.supplierStats || {};
                exportData = Object.keys(supplierStats).map(s => ({
                    Supplier: s,
                    ...supplierStats[s]
                }));
                filename = 'supplier_summary';
                headers = ['Supplier', 'Ordered', 'Delivered', 'Pending', 'Complete'];
                break;
            case 'discrepancies':
                exportData = data.discrepancies || [];
                filename = 'discrepancies';
                headers = ['SKU', 'Supplier', 'Box Code', 'Delivery Qty', 'Actual Qty', 'Difference', 'Status', 'Explanation'];
                break;
            default:
                exportData = data.orderStatus || [];
                filename = 'orders_export';
                headers = ['SKU', 'Supplier', 'Order Date', 'Order Code', 'Ordered', 'Delivered', 'Pending', 'Status'];
        }

        this.showExportPreview(exportData, filename, headers);
        this.exportCache = { data: exportData, filename, headers };
    }

    // Show export preview in modal
    showExportPreview(data, filename, headers) {
        const modalBody = document.getElementById('exportModalBody');

        let html = `
            <h6>📊 Export: ${filename.replace(/_/g, ' ').toUpperCase()}</h6>
            <p>${data.length} records will be exported</p>
        `;

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
                html += `<tr><td colspan="${headers.length}" class="text-muted">... and ${data.length - 10} more records</td></tr>`;
            }

            html += `</tbody></table></div>`;
        } else {
            html += `<div class="alert alert-warning">No data to export</div>`;
        }

        modalBody.innerHTML = html;
        new bootstrap.Modal(document.getElementById('exportModal')).show();
    }

    // Download export as CSV
    downloadExport() {
        if (!this.exportCache || this.exportCache.data.length === 0) {
            alert('No data to export');
            return;
        }

        const { data, filename, headers } = this.exportCache;

        // Build CSV
        let csv = headers.join(',') + '\n';
        data.forEach(row => {
            const values = headers.map(h => {
                let val = row[h] || row[h.toLowerCase()] || '';
                if (typeof val === 'string' && (val.includes(',') || val.includes('"') || val.includes('\n'))) {
                    val = `"${val.replace(/"/g, '""')}"`;
                }
                return val;
            });
            csv += values.join(',') + '\n';
        });

        // Add BOM for UTF-8
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `${filename}_${new Date().toISOString().slice(0,10)}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);

        bootstrap.Modal.getInstance(document.getElementById('exportModal')).hide();
    }

    // Show supplier selector
    showSupplierSelector(data) {
        const suppliers = Object.keys(data.summary?.supplierStats || {});

        if (suppliers.length === 0) {
            alert('No suppliers found');
            return;
        }

        let html = `
            <h5>🏢 Select Supplier to View Dashboard</h5>
            <div class="list-group">
                ${suppliers.map(s => `
                    <a href="#" class="list-group-item list-group-item-action"
                       onclick="window.showSupplierReport('${s}')">
                        <div class="d-flex justify-content-between align-items-center">
                            <span><strong>${s}</strong></span>
                            <span>
                                Pending: ${data.summary.supplierStats[s]?.pending || 0} units
                                <span class="badge ${data.summary.supplierStats[s]?.pending === 0 ? 'bg-success' : 'bg-warning'}">
                                    ${data.summary.supplierStats[s]?.pending === 0 ? '✅ Complete' : '⏳ Pending'}
                                </span>
                            </span>
                        </div>
                    </a>
                `).join('')}
            </div>
        `;

        const modalBody = document.getElementById('exportModalBody');
        modalBody.innerHTML = html;
        new bootstrap.Modal(document.getElementById('exportModal')).show();
    }

    // Show supplier report
    showSupplierReport(data, supplierName) {
        const supplierOrders = data.orderStatus?.filter(o =>
            o.Supplier === supplierName && o.status === 'Pending'
        ) || [];

        const totalPending = supplierOrders.reduce((sum, o) => sum + o.remainingQty, 0);
        const totalOrdered = supplierOrders.reduce((sum, o) => sum + o.originalQty, 0);

        let html = `
            <h5>📊 Supplier: ${supplierName}</h5>
            <div class="row g-2 mb-3">
                <div class="col-md-4">
                    <div class="card bg-warning">
                        <div class="card-body">
                            <h6>Pending Orders</h6>
                            <h3>${supplierOrders.length}</h3>
                        </div>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="card bg-danger">
                        <div class="card-body">
                            <h6>Pending Units</h6>
                            <h3>${totalPending}</h3>
                        </div>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="card bg-info">
                        <div class="card-body">
                            <h6>Fulfillment Rate</h6>
                            <h3>${totalOrdered > 0 ? Math.round(((totalOrdered - totalPending) / totalOrdered) * 100) : 0}%</h3>
                        </div>
                    </div>
                </div>
            </div>
            ${supplierOrders.length > 0 ? `
                <div class="table-responsive">
                    <table class="table table-sm">
                        <thead>
                            <tr>
                                <th>SKU</th>
                                <th>Order Date</th>
                                <th>Order Code</th>
                                <th>Ordered</th>
                                <th>Delivered</th>
                                <th>Pending</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${supplierOrders.map(order => `
                                <tr>
                                    <td><strong>${order.SKU}</strong></td>
                                    <td>${order.OrderDate}</td>
                                    <td>${order.OrderCode || '-'}</td>
                                    <td>${order.originalQty}</td>
                                    <td>${order.deliveredQty || 0}</td>
                                    <td class="text-danger fw-bold">${order.remainingQty}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            ` : `
                <div class="alert alert-success">✅ No pending orders for ${supplierName}</div>
            `}
        `;

        const modalBody = document.getElementById('exportModalBody');
        modalBody.innerHTML = html;
    }
}

// Create singleton instance
const exportManager = new ExportManager();