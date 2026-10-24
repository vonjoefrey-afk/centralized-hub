import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
    server: {
        port: 3000,
        open: true,
    },
    build: {
        outDir: 'build', // match Create React App output for Firebase hosting compatibility
        rollupOptions: {
            output: {
                // Split heavy vendors into their own chunks so the main bundle
                // stays lean and each vendor caches independently.
                manualChunks: {
                    'vendor-react': ['react', 'react-dom', 'react-router-dom'],
                    'vendor-firebase': ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/functions'],
                    'vendor-charts': ['recharts'],
                    'vendor-motion': ['framer-motion'],
                },
            },
        },
    },
    test: {
        globals: true,
        environment: 'jsdom',
    },
    esbuild: {
        loader: "jsx",
        include: /src\/.*\.jsx?$/,
        exclude: [],
    },
    optimizeDeps: {
        esbuildOptions: {
            loader: {
                '.js': 'jsx',
            },
        },
    },
    envPrefix: 'REACT_APP_',
});
