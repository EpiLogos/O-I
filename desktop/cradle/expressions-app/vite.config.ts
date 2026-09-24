import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import {build as bundleWorker} from 'esbuild';

export default defineConfig(() => {
  return {
    plugins: [{
      name: 'oi-research-worker', enforce: 'pre',
      resolveId(id) { return id === 'maplibre-gl/dist/maplibre-gl-worker.mjs?url' ? '\0oi-research-worker' : undefined; },
      async load(id) {
        if (id !== '\0oi-research-worker') return;
        // ?url copies the worker alone, losing MapLibre's shared module. The
        // native hosted build needs the same complete offline worker as the
        // portable Expressions artifact.
        const result = await bundleWorker({entryPoints: [path.resolve(__dirname, 'node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs')], bundle: true, write: false, platform: 'browser', format: 'iife', target: 'es2022', minify: true});
        return `export default URL.createObjectURL(new Blob([${JSON.stringify(result.outputFiles[0].text)}],{type:'text/javascript'}));`;
      },
    }, react(), tailwindcss()],
    // Relative base so the build serves from any directory prefix — the
    // cradle hosts this bundle through the owner's oi-material:// file seam,
    // where the app's URL is the served dist directory itself, never a site
    // root.
    base: './',
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
        ...Object.fromEntries(['schema','domain','desktop-api','geography','viewers','node-document'].map(name => [`@research-canvas/${name}`, path.resolve(__dirname, `vendor/research-canvas/packages/${name}/src/index.ts`)])),
        '@research-canvas/exporter': path.resolve(__dirname, 'vendor/research-canvas/browserExporter.ts'),
        // O:I-owned correspondence modules share this app's actual Three instance.
        'three': path.resolve(__dirname, 'node_modules/three'),
      },
    },
    build: {rollupOptions: {input: {main:path.resolve(__dirname,'index.html'),legacy:path.resolve(__dirname,'legacy.html'),render:path.resolve(__dirname,'render.html')}}},
    server: {
      // HMR can be disabled via DISABLE_HMR (the retired AI Studio hosting
      // path); file watching is disabled with it to prevent flicker during
      // agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
