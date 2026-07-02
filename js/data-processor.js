// ============================================
// DATA PROCESSOR - FIFO Logic
// ============================================

class DataProcessor {
    constructor() {
        this.orders = [];
        this.deliveries = [];
        this.actualReceived = [];
        this.processedData = null;
    }

    // Load and process all data
    async processAll(progressCallback) {
        try {
            // Load orders
            if (progressCallback) progressCallback(10, 'Loading orders...');
            this.orders = await this.loadOrders();

            if (this.orders.length === 0) {
                throw new Error('No orders found. Please upload order files.');
            }

            // Load deliveries
            if (progressCallback) progressCallback(40, 'Loading deliveries...');
            this.deliveries = await this.loadDeliveries();

            // Load actual received
            if (progressCallback) progressCallback(60, 'Loading actual received...');
            this.actualReceived = await this.loadActualReceived();

            // Process FIFO
            if (progressCallback) progressCallback(80, 'Processing FIFO logic...');
            const result = this.processFIFO();

            // Find discrepancies
            if (progressCallback) progressCallback(90, 'Finding discrepancies...');
            const discrepancies = this.findDiscrepancies();

            // Generate summary
            if (progressCallback) progressCallback(95, 'Generating summary...');
            const summary = this.generateSummary();

            this.processedData = {
                orders: this.orders,
                deliveries: this.deliveries,
                actualReceived: this.actualReceived,
                ...result,
                discrepancies,
                summary
            };

            if (progressCallback) progressCallback(100, 'Complete!');
            return this.processedData;

        } catch (error) {
            console.error('Processing error:', error);
            throw error;
        }
    }

    // Load orders from Google Drive
    async loadOrders() {
        const files = await driveAPI.getFiles(CONFIG.FOLDERS.ORDER);
        let allOrders = [];

        for (const file of files) {
            try {
                const data = await driveAPI.downloadExcel(file.id);
                const mapped = this.mapOrderData(data, file.name);
                allOrders = allOrders.concat(mapped);
            } catch (error) {
                console.error(`Error loading ${file.name}:`, error);
            }
        }

        return allOrders;
    }

    // Load deliveries from Google Drive
    async loadDeliveries() {
        const files = await driveAPI.getFiles(CONFIG.FOLDERS.DELIVERY);
        let allDeliveries = [];

        for (const file of files) {
            try {
                const data = await driveAPI.downloadExcel(file.id);
                const mapped = this.mapDeliveryData(data, file.name);
                allDeliveries = allDeliveries.concat(mapped);
            } catch (error) {
                console.error(`Error loading ${file.name}:`, error);
            }
        }

        return allDeliveries;
    }

    // Load actual received from Google Drive
    async loadActualReceived() {
        const files = await driveAPI.getFiles(CONFIG.FOLDERS.ACTUAL);
        let allActual = [];

        for (const file of files) {
            try {
                const data = await driveAPI.downloadExcel(file.id);
                const mapped = this.mapActualData(data, file.name);
                allActual = allActual.concat(mapped);
            } catch (error) {
                console.error(`Error loading ${file.name}:`, error);
            }
        }

        return allActual;
    }

    // Map order data with flexible column names
    mapOrderData(data, fileName) {
        const mappings = CONFIG.COLUMN_MAPPINGS.order;

        return data.map(row => {
            const sku = this.findValue(row, mappings.sku);
            const qty = parseInt(this.findValue(row, mappings.qty)) || 0;
            const supplier = this.findValue(row, mappings.supplier);
            const date = this.findValue(row, mappings.date);
            const code = this.findValue(row, mappings.code);

            return {
                SKU: String(sku).trim(),
                OrderQty: qty,
                Supplier: String(supplier).trim(),
                OrderDate: String(date).trim(),
                OrderCode: String(code).trim(),
                FileName: fileName
            };
        }).filter(d => d.SKU && d.OrderQty > 0);
    }

    // Map delivery data with flexible column names
    mapDeliveryData(data, fileName) {
        const mappings = CONFIG.COLUMN_MAPPINGS.delivery;

        return data.map(row => {
            const sku = this.findValue(row, mappings.sku);
            const qty = parseInt(this.findValue(row, mappings.qty)) || 0;
            const supplier = this.findValue(row, mappings.supplier);
            const date = this.findValue(row, mappings.date);
            const box = this.findValue(row, mappings.box);

            return {
                SKU: String(sku).trim(),
                DeliveryQty: qty,
                Supplier: String(supplier).trim(),
                EstDeliveryDate: String(date).trim(),
                BoxCode: String(box).trim(),
                FileName: fileName
            };
        }).filter(d => d.SKU && d.DeliveryQty > 0);
    }

    // Map actual received data with flexible column names
    mapActualData(data, fileName) {
        const mappings = CONFIG.COLUMN_MAPPINGS.actual;

        return data.map(row => {
            const sku = this.findValue(row, mappings.sku);
            const qty = parseInt(this.findValue(row, mappings.qty)) || 0;
            const supplier = this.findValue(row, mappings.supplier);
            const date = this.findValue(row, mappings.date);
            const box = this.findValue(row, mappings.box);

            return {
                SKU: String(sku).trim(),
                DeliveryQty: qty,
                Supplier: String(supplier).trim(),
                ActDeliveryDate: String(date).trim(),
                BoxCode: String(box).trim(),
                FileName: fileName
            };
        }).filter(d => d.SKU && d.DeliveryQty > 0);
    }

    // Helper: Find value from multiple possible column names
    findValue(row, possibleNames) {
        for (const name of possibleNames) {
            if (row[name] !== undefined && row[name] !== null) {
                return row[name];
            }
        }
        return '';
    }

    // Core FIFO Processing Logic
    processFIFO() {
        const orderGroups = this.groupOrders();
        const deliveryGroups = this.groupDeliveries();

        const allocations = [];
        const orderStatus = [];
        const pendingOrders = [];
        const completeOrders = [];
        const partialOrders = [];

        Object.keys(orderGroups).forEach(key => {
            const [sku, supplier] = key.split('|');
            const orderList = orderGroups[key];
            const deliveryList = deliveryGroups[key] || [];

            let deliveryIndex = 0;

            orderList.forEach(order => {
                let orderRemaining = order.remainingQty;

                // FIFO: Fulfill oldest orders first
                while (orderRemaining > 0 && deliveryIndex < deliveryList.length) {
                    const delivery = deliveryList[deliveryIndex];
                    const available = delivery.remainingQty;

                    if (available > 0) {
                        const allocated = Math.min(orderRemaining, available);
                        order.remainingQty -= allocated;
                        order.deliveredQty += allocated;
                        delivery.remainingQty -= allocated;
                        orderRemaining -= allocated;

                        allocations.push({
                            orderCode: order.OrderCode,
                            orderDate: order.OrderDate,
                            sku: sku,
                            supplier: supplier,
                            boxCode: delivery.BoxCode,
                            deliveryDate: delivery.EstDeliveryDate,
                            allocated: allocated
                        });
                    }

                    if (delivery.remainingQty === 0) {
                        deliveryIndex++;
                    }
                }

                // Determine status
                if (order.deliveredQty === 0) {
                    order.status = 'Pending';
                    pendingOrders.push(order);
                } else if (order.deliveredQty < order.originalQty) {
                    order.status = 'Partial';
                    partialOrders.push(order);
                } else {
                    order.status = 'Complete';
                    completeOrders.push(order);
                }

                orderStatus.push(order);
            });
        });

        return {
            orderStatus,
            pendingOrders,
            completeOrders,
            partialOrders,
            allocations
        };
    }

    // Group orders by SKU|Supplier
    groupOrders() {
        const groups = {};

        this.orders.forEach(order => {
            const key = `${order.SKU}|${order.Supplier}`;
            if (!groups[key]) groups[key] = [];

            const date = new Date(order.OrderDate);
            groups[key].push({
                ...order,
                originalQty: order.OrderQty,
                remainingQty: order.OrderQty,
                deliveredQty: 0,
                orderDateObj: isNaN(date.getTime()) ? new Date(0) : date
            });
        });

        // Sort by date (FIFO)
        Object.keys(groups).forEach(key => {
            groups[key].sort((a, b) => a.orderDateObj - b.orderDateObj);
        });

        return groups;
    }

    // Group deliveries by SKU|Supplier
    groupDeliveries() {
        const groups = {};

        this.deliveries.forEach(delivery => {
            const key = `${delivery.SKU}|${delivery.Supplier}`;
            if (!groups[key]) groups[key] = [];

            const date = new Date(delivery.EstDeliveryDate);
            groups[key].push({
                ...delivery,
                remainingQty: delivery.DeliveryQty,
                deliveryDateObj: isNaN(date.getTime()) ? new Date(0) : date
            });
        });

        // Sort by date
        Object.keys(groups).forEach(key => {
            groups[key].sort((a, b) => a.deliveryDateObj - b.deliveryDateObj);
        });

        return groups;
    }

    // Find discrepancies between delivery and actual received
    findDiscrepancies() {
        const discrepancies = [];

        // Group actual by Box Code
        const actualByBox = {};
        this.actualReceived.forEach(actual => {
            const key = actual.BoxCode || 'unknown';
            if (!actualByBox[key]) actualByBox[key] = [];
            actualByBox[key].push(actual);
        });

        // Compare each delivery
        this.deliveries.forEach(delivery => {
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
                    Explanation: `No actual received record for Box ${delivery.BoxCode}`,
                    Severity: 'HIGH'
                });
            } else {
                const totalActual = actualItems.reduce((sum, item) => sum + item.DeliveryQty, 0);
                const diff = totalActual - delivery.DeliveryQty;

                if (diff !== 0) {
                    const actualSKUs = [...new Set(actualItems.map(a => a.SKU))];
                    const skuMismatch = actualSKUs.length > 1 ||
                                       (actualSKUs.length === 1 && actualSKUs[0] !== delivery.SKU);

                    let status, explanation, severity;

                    if (skuMismatch) {
                        status = 'SKU_MISMATCH';
                        explanation = `Delivered: ${delivery.SKU}, Actual: ${actualSKUs.join(', ')}`;
                        severity = 'CRITICAL';
                    } else if (diff > 0) {
                        status = 'OVER_RECEIVED';
                        explanation = `Received ${diff} more than delivered`;
                        severity = 'LOW';
                    } else {
                        status = 'UNDER_RECEIVED';
                        explanation = `Received ${Math.abs(diff)} less than delivered`;
                        severity = 'HIGH';
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
                        Severity: severity
                    });
                }
            }
        });

        // Check for unmatched actual received
        const deliveryBoxes = new Set(this.deliveries.map(d => d.BoxCode));
        this.actualReceived.forEach(actual => {
            if (!deliveryBoxes.has(actual.BoxCode)) {
                discrepancies.push({
                    SKU: actual.SKU,
                    Supplier: actual.Supplier,
                    BoxCode: actual.BoxCode,
                    DeliveryQty: 0,
                    ActualQty: actual.DeliveryQty,
                    Difference: actual.DeliveryQty,
                    Status: 'UNMATCHED',
                    Explanation: `Received ${actual.DeliveryQty} with no delivery record`,
                    Severity: 'HIGH'
                });
            }
        });

        return discrepancies;
    }

    // Generate summary statistics
    generateSummary() {
        const summary = {
            totalOrders: this.orders.length,
            totalDeliveries: this.deliveries.length,
            totalActual: this.actualReceived.length,
            supplierStats: {},
            skuStats: {},
            statusCounts: { pending: 0, partial: 0, complete: 0 }
        };

        // Supplier stats
        this.orders.forEach(order => {
            if (!summary.supplierStats[order.Supplier]) {
                summary.supplierStats[order.Supplier] = {
                    ordered: 0, delivered: 0, pending: 0, complete: 0
                };
            }
            summary.supplierStats[order.Supplier].ordered += order.OrderQty;
        });

        // Update from processed data
        if (this.processedData) {
            this.processedData.orderStatus.forEach(order => {
                if (summary.supplierStats[order.Supplier]) {
                    summary.supplierStats[order.Supplier].delivered += order.deliveredQty || 0;
                    summary.supplierStats[order.Supplier].pending += order.remainingQty || 0;
                    if (order.status === 'Complete') {
                        summary.supplierStats[order.Supplier].complete += order.originalQty;
                    }
                }
            });

            summary.statusCounts = {
                pending: this.processedData.pendingOrders.length,
                partial: this.processedData.partialOrders.length,
                complete: this.processedData.completeOrders.length
            };
        }

        return summary;
    }

    // Get processed data
    getData() {
        return this.processedData;
    }
}

// Create singleton instance
const dataProcessor = new DataProcessor();