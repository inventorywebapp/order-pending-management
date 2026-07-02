// js/env-loader.js
// Load environment variables safely into the browser

(function loadEnvironment() {
    try {
        // Check if we have environment variables from build process
        const apiKey = typeof import.meta !== 'undefined' && import.meta.env 
            ? import.meta.env.VITE_GOOGLE_DRIVE_API_KEY 
            : null;
        const clientId = typeof import.meta !== 'undefined' && import.meta.env 
            ? import.meta.env.VITE_GOOGLE_DRIVE_CLIENT_ID 
            : null;
        
        // Inject into window for the app to use
        window.__ENV = {
            VITE_GOOGLE_DRIVE_API_KEY: apiKey || '',
            VITE_GOOGLE_DRIVE_CLIENT_ID: clientId || '',
        };
        
        // Check if we're in production and configured
        if (import.meta?.env?.PROD) {
            if (!apiKey || !clientId) {
                console.warn('⚠️ Missing environment variables in production!');
                console.warn('Please configure GitHub Secrets and Actions.');
            } else {
                console.log('✅ Production environment variables loaded successfully.');
            }
        } else {
            console.log('🔧 Development environment: Using .env file if available.');
        }
        
        // Don't log actual values for security
        console.log('🔐 API Key configured:', apiKey ? '✅ Yes' : '❌ No');
        console.log('🔐 Client ID configured:', clientId ? '✅ Yes' : '❌ No');
        
    } catch (error) {
        console.warn('⚠️ Failed to load environment variables:', error.message);
        // Set empty values as fallback
        window.__ENV = {
            VITE_GOOGLE_DRIVE_API_KEY: '',
            VITE_GOOGLE_DRIVE_CLIENT_ID: '',
        };
    }
})();
