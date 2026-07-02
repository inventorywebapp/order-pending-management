// ============================================
// CONFIGURATION
// ============================================

const CONFIG = {
    // Google API Credentials
    CLIENT_ID: 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com',
    API_KEY: 'YOUR_GOOGLE_API_KEY',
    SCOPES: 'https://www.googleapis.com/auth/drive.readonly',

    // Google Drive Folder IDs
    FOLDERS: {
        MAIN: '12PxB1WMGrLov54kajAGCHqnEJOjqtJlW',
        ORDER: '13UZpplt52LNel3dXzxF33-CYLxOV03cS',
        DELIVERY: '1RyPAqPIZwygu13TKscW2zzRzpYr8c7Xv',
        ACTUAL: '1AlxxHhueUEuv03WPTPlssQ1fAr4IGoUG'
    },

    // Column Name Mappings (for future-proofing)
    COLUMN_MAPPINGS: {
        order: {
            sku: ['SKU', 'sku', 'Sku', 'Item Code', 'Item_Code'],
            qty: ['Order Qty', 'Order_Qty', 'OrderQty', 'Qty', 'qty', 'Quantity'],
            supplier: ['Supplier', 'supplier', 'Vendor', 'vendor', 'Vendor Name'],
            date: ['Order Date', 'Order_Date', 'OrderDate', 'Date', 'date'],
            code: ['Order Code', 'Order_Code', 'OrderCode', 'Code', 'code']
        },
        delivery: {
            sku: ['SKU', 'sku', 'Sku', 'Item Code', 'Item_Code'],
            qty: ['Delivery Qty', 'Delivery_Qty', 'DeliveryQty', 'Qty', 'qty'],
            supplier: ['Supplier', 'supplier', 'Vendor', 'vendor'],
            date: ['Est. Delivery Date', 'Est_Delivery_Date', 'EstDeliveryDate', 'Date', 'date'],
            box: ['Box Code', 'Box_Code', 'BoxCode', 'Box', 'box']
        },
        actual: {
            sku: ['SKU', 'sku', 'Sku', 'Item Code', 'Item_Code'],
            qty: ['Delivery Qty', 'Delivery_Qty', 'DeliveryQty', 'Qty', 'qty'],
            supplier: ['Supplier', 'supplier', 'Vendor', 'vendor'],
            date: ['Act. Delivery Date', 'Act_Delivery_Date', 'ActDeliveryDate', 'Date', 'date'],
            box: ['Box Code', 'Box_Code', 'BoxCode', 'Box', 'box']
        }
    },

    // App Settings
    APP: {
        VERSION: '2.0.0',
        NAME: 'Order Pending Management System',
        AUTO_REFRESH: true,
        MAX_TABLE_ROWS: 1000
    }
};

// Freeze config to prevent modification
Object.freeze(CONFIG);