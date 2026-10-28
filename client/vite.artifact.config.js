import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Builds the single-file preview bundle (dist-preview/preview.js and style.css).
// Run through scripts/build-preview.mjs, which inlines both into one HTML file.
export default defineConfig({
  plugins: [react()],
  define: { 'process.env.NODE_ENV': '"production"' },
  build: {
    outDir: 'dist-preview',
    emptyOutDir: true,
    cssCodeSplit: false,
    assetsInlineLimit: 1000000,
    lib: { entry: 'src/artifact/main.jsx', formats: ['iife'], name: 'WaPreview', fileName: () => 'preview.js' },
  },
});
