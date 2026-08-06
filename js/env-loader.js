// js/env-loader.js
// Load environment variables safely into the browser

(function loadEnvironment() {
    try {
        // Check if we have environment variables from the build process
        // In Vite, import.meta.env is available during build time
        const apiKey = typeof import.meta !== 'undefined' && import.meta.env 
            ? import.meta.env.VITE_GOOGLE_DRIVE_API_KEY 
            : null;
        const clientId = typeof import.meta !== 'undefined' && import.meta.env 
            ? import.meta.env.VITE_GOOGLE_DRIVE_CLIENT_ID 
            : null;
        
        // Also check window.__ENV as fallback (for non-module scripts)
        const windowApiKey = window.__ENV?.VITE_GOOGLE_DRIVE_API_KEY || null;
        const windowClientId = window.__ENV?.VITE_GOOGLE_DRIVE_CLIENT_ID || null;
        
        // Use the first available value
        const finalApiKey = apiKey || windowApiKey || '';
        const finalClientId = clientId || windowClientId || '';
        
        // Inject into window for the app to use (fallback for non-module scripts)
        window.__ENV = {
            VITE_GOOGLE_DRIVE_API_KEY: finalApiKey,
            VITE_GOOGLE_DRIVE_CLIENT_ID: finalClientId,
        };
        
        // Also set as global variables for config.js to access
        window.VITE_GOOGLE_DRIVE_API_KEY = finalApiKey;
        window.VITE_GOOGLE_DRIVE_CLIENT_ID = finalClientId;
        
        // Check if we're in production and configured
        const isProduction = import.meta?.env?.PROD || window.location.hostname !== 'localhost';
        
        if (isProduction) {
            if (!finalApiKey || !finalClientId) {
                console.warn('⚠️ Missing environment variables in production!');
                console.warn('Please configure environment variables in Netlify dashboard.');
                console.warn('Variables needed: VITE_GOOGLE_DRIVE_API_KEY, VITE_GOOGLE_DRIVE_CLIENT_ID');
            } else {
                console.log('✅ Production environment variables loaded successfully.');
            }
        } else {
            console.log('🔧 Development environment: Using .env file if available.');
        }
        
        // Don't log actual values for security - just show if they exist
        console.log('🔐 API Key configured:', finalApiKey ? '✅ Yes' : '❌ No');
        console.log('🔐 Client ID configured:', finalClientId ? '✅ Yes' : '❌ No');
        
        // Debug: Show if variables are available (only in development)
        if (!isProduction) {
            console.log('📝 API Key length:', finalApiKey?.length || 0);
            console.log('📝 Client ID length:', finalClientId?.length || 0);
        }
        
    } catch (error) {
        console.warn('⚠️ Failed to load environment variables:', error.message);
        // Set empty values as fallback
        window.__ENV = {
            VITE_GOOGLE_DRIVE_API_KEY: '',
            VITE_GOOGLE_DRIVE_CLIENT_ID: '',
        };
        window.VITE_GOOGLE_DRIVE_API_KEY = '';
        window.VITE_GOOGLE_DRIVE_CLIENT_ID = '';
    }
})();

// Export for module usage
export const ENV = window.__ENV;
