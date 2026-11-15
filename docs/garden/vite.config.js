import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    rollupOptions: { input: { index: resolve(import.meta.dirname, 'index.html'), garden: resolve(import.meta.dirname, 'garden.html') } },
    chunkSizeWarningLimit: 1200,
  },
  server: { host: true },
});
