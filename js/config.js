// ============================================
// CONFIGURATION
// ============================================

const CONFIG = {
    // Google API Credentials
    CLIENT_ID: '16032621441-uiqg2dr6biekknpemrkgf6h9k1f1u4eh.apps.googleusercontent.com',
    // ⚠️ IMPORTANT: Replace YOUR_API_KEY with your actual key below
    API_KEY: 'AIzaSyD_AX-uoXZuxwiNDfZMNapjwMgcYjOVZPs', // ← REPLACE WITH: AIzaSyD_AX-uoXZuxwiNDfZMNapjwMgcYjOVZPs
    SCOPES: 'https://www.googleapis.com/auth/drive.readonly',

    // Google Drive Folder IDs
    FOLDERS: {
        MAIN: '12PxB1WMGrLov54kajAGCHqnEJOjqtJlW',
        ORDER: '13UZpplt52LNel3dXzxF33-CYLxOV03cS',
        DELIVERY: '1RyPAqPIZwygu13TKscW2zzRzpYr8c7Xv',
        ACTUAL: '1AlxxHhueUEuv03WPTPlssQ1fAr4IGoUG'
    },

    // Column Name Mappings (Future-Proof)
    COLUMN_MAPPINGS: {
        order: {
            sku: ['SKU', 'sku', 'Sku', 'Item Code'],
            qty: ['Order Qty', 'Order_Qty', 'OrderQty', 'Qty'],
            supplier: ['Supplier', 'supplier', 'Vendor'],
            date: ['Order Date', 'Order_Date', 'OrderDate', 'Date'],
            code: ['Order Code', 'Order_Code', 'OrderCode']
        },
        delivery: {
            sku: ['SKU', 'sku', 'Sku'],
            qty: ['Delivery Qty', 'Delivery_Qty', 'DeliveryQty'],
            supplier: ['Supplier', 'supplier'],
            date: ['Est. Delivery Date', 'Est_Delivery_Date', 'EstDeliveryDate'],
            box: ['Box Code', 'Box_Code', 'BoxCode', 'Box']
        },
        actual: {
            sku: ['SKU', 'sku', 'Sku'],
            qty: ['Delivery Qty', 'Delivery_Qty', 'DeliveryQty'],
            supplier: ['Supplier', 'supplier'],
            date: ['Act. Delivery Date', 'Act_Delivery_Date', 'ActDeliveryDate'],
            box: ['Box Code', 'Box_Code', 'BoxCode', 'Box']
        }
    },

    APP: {
        VERSION: '3.0.0',
        NAME: 'Order Pending Management',
        AUTO_REFRESH: true
    }
};

Object.freeze(CONFIG);
