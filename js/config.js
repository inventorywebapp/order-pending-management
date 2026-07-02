// Configuration
const CONFIG = {
    // Google Drive API Configuration
    GOOGLE_DRIVE: {
        API_KEY: 'YOUR_GOOGLE_DRIVE_API_KEY', // Replace with your API key
        CLIENT_ID: 'YOUR_GOOGLE_DRIVE_CLIENT_ID', // Replace with your Client ID
        SCOPES: 'https://www.googleapis.com/auth/drive.file',
        DISCOVERY_DOCS: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
    },
    
    // Folder IDs from Google Drive
    FOLDERS: {
        MAIN: '12PxB1WMGrLov54kajAGCHqnEJOjqtJlW',
        ORDER: '13UZpplt52LNel3dXzxF33-CYLxOV03cS',
        DELIVERY: '1RyPAqPIZwygu13TKscW2zzRzpYr8c7Xv',
        ACTUAL: '1AlxxHhueUEuv03WPTPlssQ1fAr4IGoUG'
    },
    
    // Column mappings for Excel files
    COLUMNS: {
        ORDER: {
            SKU: 'SKU',
            QTY: 'Order Qty',
            SUPPLIER: 'Supplier',
            ORDER_DATE: 'Order Date',
            ORDER_CODE: 'Order Code'
        },
        DELIVERY: {
            SKU: 'SKU',
            QTY: 'Delivery Qty',
            SUPPLIER: 'Supplier',
            DELIVERY_DATE: 'Est. Delivery Date',
            BOX_CODE: 'Box Code'
        },
        ACTUAL: {
            SKU: 'SKU',
            QTY: 'Delivery Qty',
            SUPPLIER: 'Supplier',
            ACTUAL_DATE: 'Act. Delivery Date',
            BOX_CODE: 'Box Code'
        }
    },
    
    // API Endpoints (for backend)
    API: {
        BASE_URL: window.location.hostname === 'localhost' 
            ? 'http://localhost:5000/api' 
            : 'https://your-backend-url.com/api',
        ENDPOINTS: {
            PROCESS_ORDER: '/process-order',
            GET_DATA: '/get-data',
            ANALYZE: '/analyze',
            EXPORT: '/export'
        }
    }
};

// Security: Don't expose API keys in production - use environment variables
// This is a placeholder - in production, these should be loaded from environment variables
if (typeof CONFIG.GOOGLE_DRIVE.API_KEY === 'YOUR_GOOGLE_DRIVE_API_KEY') {
    console.warn('⚠️ Please configure your Google Drive API credentials in config.js');
}
