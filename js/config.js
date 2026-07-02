// Configuration - Production Ready
// IMPORTANT: Never hardcode API keys! Use environment variables.

// Check if we're running in a browser or Node environment
const isBrowser = typeof window !== 'undefined';
const isProduction = isBrowser && window.location.hostname !== 'localhost';

// Helper function to get environment variables safely
const getEnv = (key, fallback = '') => {
    // Browser environment
    if (isBrowser) {
        // Check if environment variables were injected via script tags
        if (window.__ENV && window.__ENV[key]) {
            return window.__ENV[key];
        }
        // Check if using Vite's import.meta.env
        if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
            return import.meta.env[key];
        }
        return fallback;
    }
    // Node.js environment
    return process.env[key] || fallback;
};

// Build configuration
const CONFIG = {
    // Google Drive API Configuration - Loaded from environment variables
    GOOGLE_DRIVE: {
        API_KEY: getEnv('VITE_GOOGLE_DRIVE_API_KEY', ''),
        CLIENT_ID: getEnv('VITE_GOOGLE_DRIVE_CLIENT_ID', ''),
        SCOPES: 'https://www.googleapis.com/auth/drive.file',
        DISCOVERY_DOCS: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
    },
    
    // Folder IDs from Google Drive (these are safe to expose as they're just identifiers)
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
        BASE_URL: isBrowser 
            ? (window.location.hostname === 'localhost' 
                ? 'http://localhost:5000/api' 
                : window.location.origin + '/api')
            : 'http://localhost:5000/api',
        ENDPOINTS: {
            PROCESS_ORDER: '/process-order',
            GET_DATA: '/get-data',
            ANALYZE: '/analyze',
            EXPORT: '/export'
        }
    },
    
    // Feature flags
    FEATURES: {
        ENABLE_BACKEND: isProduction, // Use backend in production for security
        ENABLE_CACHE: true,
        DEBUG_MODE: !isProduction,
    }
};

// Security check - Warn if API keys are not configured
(function checkSecurity() {
    const hasApiKey = CONFIG.GOOGLE_DRIVE.API_KEY && CONFIG.GOOGLE_DRIVE.API_KEY !== '';
    const hasClientId = CONFIG.GOOGLE_DRIVE.CLIENT_ID && CONFIG.GOOGLE_DRIVE.CLIENT_ID !== '';
    
    if (!hasApiKey || !hasClientId) {
        console.warn('⚠️ Google Drive API credentials are not configured!');
        console.warn('Please set the following environment variables:');
        console.warn('  - VITE_GOOGLE_DRIVE_API_KEY');
        console.warn('  - VITE_GOOGLE_DRIVE_CLIENT_ID');
        console.warn('Or create a .env file with these variables.');
    } else {
        console.log('✅ Google Drive API credentials configured successfully.');
        console.log(`🔒 Running in ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'} mode`);
    }
    
    // Never log actual API keys
    console.log('🔐 API Key configured:', hasApiKey ? '✅ Yes' : '❌ No');
    console.log('🔐 Client ID configured:', hasClientId ? '✅ Yes' : '❌ No');
})();

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
} else if (typeof window !== 'undefined') {
    window.CONFIG = CONFIG;
}

// ⭐ ADD THIS LINE FOR VITE MODULE EXPORT ⭐
export { CONFIG, getEnv };

// Freeze the config to prevent accidental modifications
Object.freeze(CONFIG);
Object.freeze(CONFIG.GOOGLE_DRIVE);
Object.freeze(CONFIG.FOLDERS);
Object.freeze(CONFIG.COLUMNS);
Object.freeze(CONFIG.API);
Object.freeze(CONFIG.API.ENDPOINTS);
Object.freeze(CONFIG.FEATURES);
