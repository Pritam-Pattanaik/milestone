import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
    plugins: [react()],
    server: {
        port: 5173,
        proxy: {
            '/api': {
                target: 'http://localhost:5000',
                changeOrigin: true
            }
        }
    },
    build: {
        outDir: 'dist',
        sourcemap: true,
        rollupOptions: {
            output: {
                manualChunks: {
                    // React core
                    'vendor-react': ['react', 'react-dom', 'react-router-dom'],
                    // Charting library (largest dependency)
                    'vendor-recharts': ['recharts'],
                    // Animation library
                    'vendor-framer': ['framer-motion'],
                    // Data fetching & utilities
                    'vendor-utils': ['@tanstack/react-query', 'axios', 'date-fns']
                }
            }
        }
    }
})
