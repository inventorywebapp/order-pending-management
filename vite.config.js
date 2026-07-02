// vite.config.js
import { defineConfig } from 'vite';
import path from 'path';

// Debug: Check environment variables before build
console.log('🔍 === ENVIRONMENT VARIABLES DEBUG ===');
console.log('VITE_GOOGLE_DRIVE_API_KEY exists:', !!process.env.VITE_GOOGLE_DRIVE_API_KEY);
console.log('VITE_GOOGLE_DRIVE_API_KEY length:', process.env.VITE_GOOGLE_DRIVE_API_KEY?.length || 0);
console.log('VITE_GOOGLE_DRIVE_CLIENT_ID exists:', !!process.env.VITE_GOOGLE_DRIVE_CLIENT_ID);
console.log('VITE_GOOGLE_DRIVE_CLIENT_ID length:', process.env.VITE_GOOGLE_DRIVE_CLIENT_ID?.length || 0);
console.log('🔍 === END DEBUG ===');

export default defineConfig({
    base: '/',
    
    define: {
        'import.meta.env.VITE_GOOGLE_DRIVE_API_KEY': JSON.stringify(process.env.VITE_GOOGLE_DRIVE_API_KEY || ''),
        'import.meta.env.VITE_GOOGLE_DRIVE_CLIENT_ID': JSON.stringify(process.env.VITE_GOOGLE_DRIVE_CLIENT_ID || ''),
        // Also define as global variables for non-module scripts
        'window.VITE_GOOGLE_DRIVE_API_KEY': JSON.stringify(process.env.VITE_GOOGLE_DRIVE_API_KEY || ''),
        'window.VITE_GOOGLE_DRIVE_CLIENT_ID': JSON.stringify(process.env.VITE_GOOGLE_DRIVE_CLIENT_ID || ''),
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
                // Ensure all JS files are properly bundled
                entryFileNames: 'assets/[name]-[hash].js',
                chunkFileNames: 'assets/[name]-[hash].js',
                assetFileNames: 'assets/[name]-[hash].[ext]',
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
