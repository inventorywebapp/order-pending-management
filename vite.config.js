// vite.config.js
import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
    // Base path for GitHub Pages
    base: '/order-pending-management/',
    
    define: {
        // Inject environment variables
        'import.meta.env.VITE_GOOGLE_DRIVE_API_KEY': JSON.stringify(process.env.VITE_GOOGLE_DRIVE_API_KEY || ''),
        'import.meta.env.VITE_GOOGLE_DRIVE_CLIENT_ID': JSON.stringify(process.env.VITE_GOOGLE_DRIVE_CLIENT_ID || ''),
    },
    
    build: {
        outDir: 'dist',
        assetsDir: 'assets',
        minify: 'terser',
        rollupOptions: {
            input: {
                main: path.resolve(__dirname, 'index.html'),
            },
            output: {
                manualChunks: {
                    vendor: ['js/config.js', 'js/gdrive.js'],
                },
            },
        },
    },
    
    server: {
        port: 3000,
        open: true,
        host: true,
    },
    
    preview: {
        port: 3001,
        open: true,
    },
    
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './'),
        },
    },
});
