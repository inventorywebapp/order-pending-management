// ============================================
// DATA PROCESSOR - FIFO Logic
// ============================================

class DataProcessor {
    constructor() {
        this.orders = [];
        this.deliveries = [];
        this.actual = [];
        this.processed = null;
    }

    async processAll(progress) {
        try {
            if (progress) progress(10, 'Loading orders...');
            this.orders = await this.loadOrders();
            if (!this.orders.length) throw new Error('No orders found. Please upload order files.');

            if (progress) progress(40, 'Loading deliveries...');
            this.deliveries = await this.loadDeliveries();

            if (progress) progress(60, 'Loading actual received...');
            this.actual = await this.loadActual();

            if (progress) progress(80, 'Applying FIFO...');
            const result = this.runFIFO();

            if (progress) progress(90, 'Finding discrepancies...');
            const discrepancies = this.findDiscrepancies();

            if (progress) progress(95, 'Generating summary...');
            const summary = this.generateSummary();

            this.processed = { orders: this.orders, deliveries: this.deliveries, actual: this.actual, ...result, discrepancies, summary };
            if (progress) progress(100, 'Done!');
            return this.processed;
        } catch (error) {
            console.error('Processing error:', error);
            throw error;
        }
    }

    async loadOrders() {
        const files = await driveAPI.getFiles(CONFIG.FOLDERS.ORDER);
        let all = [];
        for (const f of files) {
            try {
                const data = await driveAPI.downloadExcel(f.id);
                const mapped = this.mapData(data, CONFIG.COLUMN_MAPPINGS.order, 'OrderQty');
                all = all.concat(mapped);
            } catch (e) { console.warn('Skipping file:', f.name, e); }
        }
        return all;
    }

    async loadDeliveries() {
        const files = await driveAPI.getFiles(CONFIG.FOLDERS.DELIVERY);
        let all = [];
        for (const f of files) {
            try {
                const data = await driveAPI.downloadExcel(f.id);
                const mapped = this.mapData(data, CONFIG.COLUMN_MAPPINGS.delivery, 'DeliveryQty');
                all = all.concat(mapped);
            } catch (e) { console.warn('Skipping file:', f.name, e); }
        }
        return all;
    }

    async loadActual() {
        const files = await driveAPI.getFiles(CONFIG.FOLDERS.ACTUAL);
        let all = [];
        for (const f of files) {
            try {
                const data = await driveAPI.downloadExcel(f.id);
                const mapped = this.mapData(data, CONFIG.COLUMN_MAPPINGS.actual, 'DeliveryQty');
                all = all.concat(mapped);
            } catch (e) { console.warn('Skipping file:', f.name, e); }
        }
        return all;
    }

    mapData(data, mappings, qtyKey) {
        return data.map(row => {
            const sku = this.find(row, mappings.sku);
            const qty = parseInt(this.find(row, mappings.qty)) || 0;
            const supplier = this.find(row, mappings.supplier);
            const date = this.find(row, mappings.date);
            const code = this.find(row, mappings.code) || '';
            const box = this.find(row, mappings.box) || '';
            return { SKU: String(sku).trim(), [qtyKey]: qty, Supplier: String(supplier).trim(), Date: String(date).trim(), Code: String(code).trim(), Box: String(box).trim() };
        }).filter(d => d.SKU && d[qtyKey] > 0);
    }

    find(row, keys) {
        for (const k of keys) {
            if (row[k] !== undefined && row[k] !== null && row[k] !== '') return row[k];
        }
        return '';
    }

    runFIFO() {
        const orderGroups = {};
        this.orders.forEach(o => {
            const key = `${o.SKU}|${o.Supplier}`;
            if (!orderGroups[key]) orderGroups[key] = [];
            orderGroups[key].push({ ...o, originalQty: o.OrderQty, remainingQty: o.OrderQty, deliveredQty: 0, dateObj: new Date(o.Date) || new Date(0) });
        });
        Object.values(orderGroups).forEach(g => g.sort((a, b) => a.dateObj - b.dateObj));

        const deliveryGroups = {};
        this.deliveries.forEach(d => {
            const key = `${d.SKU}|${d.Supplier}`;
            if (!deliveryGroups[key]) deliveryGroups[key] = [];
            deliveryGroups[key].push({ ...d, remainingQty: d.DeliveryQty, dateObj: new Date(d.Date) || new Date(0) });
        });
        Object.values(deliveryGroups).forEach(g => g.sort((a, b) => a.dateObj - b.dateObj));

        const pending = [], complete = [], partial = [], allocations = [];

        Object.keys(orderGroups).forEach(key => {
            const orders = orderGroups[key];
            const deliveries = deliveryGroups[key] || [];
            let di = 0;

            orders.forEach(order => {
                let rem = order.remainingQty;
                while (rem > 0 && di < deliveries.length) {
                    const d = deliveries[di];
                    if (d.remainingQty > 0) {
                        const allocated = Math.min(rem, d.remainingQty);
                        order.remainingQty -= allocated;
                        order.deliveredQty += allocated;
                        d.remainingQty -= allocated;
                        rem -= allocated;
                        allocations.push({ orderCode: order.Code, sku: order.SKU, supplier: order.Supplier, box: d.Box, allocated });
                    }
                    if (d.remainingQty === 0) di++;
                }
                if (order.deliveredQty === 0) { order.status = 'Pending'; pending.push(order); }
                else if (order.deliveredQty < order.originalQty) { order.status = 'Partial'; partial.push(order); }
                else { order.status = 'Complete'; complete.push(order); }
            });
        });

        return { pendingOrders: pending, completeOrders: complete, partialOrders: partial, allocations, orderStatus: [...pending, ...partial, ...complete] };
    }

    findDiscrepancies() {
        const disc = [];
        const actualByBox = {};
        this.actual.forEach(a => {
            const key = a.Box || 'unknown';
            if (!actualByBox[key]) actualByBox[key] = [];
            actualByBox[key].push(a);
        });

        this.deliveries.forEach(d => {
            const actuals = actualByBox[d.Box] || [];
            if (!actuals.length) {
                disc.push({ SKU: d.SKU, Supplier: d.Supplier, Box: d.Box, DeliveryQty: d.DeliveryQty, ActualQty: 0, Diff: -d.DeliveryQty, Status: 'MISSING', Severity: 'HIGH' });
            } else {
                const totalActual = actuals.reduce((s, a) => s + a.DeliveryQty, 0);
                const diff = totalActual - d.DeliveryQty;
                if (diff !== 0) {
                    const actualSKUs = [...new Set(actuals.map(a => a.SKU))];
                    const skuMismatch = actualSKUs.length > 1 || (actualSKUs.length === 1 && actualSKUs[0] !== d.SKU);
                    disc.push({
                        SKU: d.SKU, Supplier: d.Supplier, Box: d.Box,
                        DeliveryQty: d.DeliveryQty, ActualQty: totalActual, Diff: diff,
                        Status: skuMismatch ? 'SKU_MISMATCH' : (diff > 0 ? 'OVER_RECEIVED' : 'UNDER_RECEIVED'),
                        Severity: skuMismatch ? 'CRITICAL' : (Math.abs(diff) > d.DeliveryQty * 0.5 ? 'HIGH' : 'MEDIUM'),
                        Explanation: skuMismatch ? `Delivered: ${d.SKU}, Actual: ${actualSKUs.join(', ')}` :
                                    (diff > 0 ? `Received ${diff} extra` : `Missing ${Math.abs(diff)} units`)
                    });
                }
            }
        });

        const deliveryBoxes = new Set(this.deliveries.map(d => d.Box));
        this.actual.forEach(a => {
            if (!deliveryBoxes.has(a.Box)) {
                disc.push({ SKU: a.SKU, Supplier: a.Supplier, Box: a.Box, DeliveryQty: 0, ActualQty: a.DeliveryQty, Diff: a.DeliveryQty, Status: 'UNMATCHED_RECEIVED', Severity: 'HIGH', Explanation: `Received ${a.DeliveryQty} with no delivery record` });
            }
        });
        return disc;
    }

    generateSummary() {
        const s = { totalOrders: this.orders.length, totalDeliveries: this.deliveries.length, supplierStats: {}, statusCounts: { pending: 0, partial: 0, complete: 0 } };
        this.orders.forEach(o => {
            if (!s.supplierStats[o.Supplier]) s.supplierStats[o.Supplier] = { ordered: 0, delivered: 0, pending: 0 };
            s.supplierStats[o.Supplier].ordered += o.OrderQty;
        });
        if (this.processed) {
            this.processed.orderStatus.forEach(o => {
                if (s.supplierStats[o.Supplier]) {
                    s.supplierStats[o.Supplier].delivered += o.deliveredQty || 0;
                    s.supplierStats[o.Supplier].pending += o.remainingQty || 0;
                }
            });
            s.statusCounts = { pending: this.processed.pendingOrders.length, partial: this.processed.partialOrders.length, complete: this.processed.completeOrders.length };
        }
        return s;
    }

    getData() { return this.processed; }
}

const dataProcessor = new DataProcessor();
