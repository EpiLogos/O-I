import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const siteRoot = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  base: './',
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(siteRoot, 'index.html'),
        oi: resolve(siteRoot, 'oi.html'),
        products: resolve(siteRoot, 'products.html'),
        sharedField: resolve(siteRoot, 'shared-field.html'),
        research: resolve(siteRoot, 'research.html'),
        build: resolve(siteRoot, 'build.html'),
        explore: resolve(siteRoot, 'explore.html'),
      },
    },
  },
});
