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
                // Matched by package path: the object form also pulled each entry's
                // dependencies (e.g. clsx) into its chunk, so the app shell had to
                // download the whole chart library just to get a shared helper.
                manualChunks(id) {
                    if (!id.includes('node_modules')) return undefined;
                    // clsx is shared by the shell and recharts; keep it out of the chart chunk.
                    if (/node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler|clsx)[\\/]/.test(id)) return 'vendor-react';
                    if (/node_modules[\\/](@firebase|firebase)[\\/]/.test(id)) return 'vendor-firebase';
                    if (/node_modules[\\/](recharts|d3-[^\\/]+|victory-vendor)[\\/]/.test(id)) return 'vendor-charts';
                    if (/node_modules[\\/](framer-motion|motion-dom|motion-utils)[\\/]/.test(id)) return 'vendor-motion';
                    return undefined;
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
