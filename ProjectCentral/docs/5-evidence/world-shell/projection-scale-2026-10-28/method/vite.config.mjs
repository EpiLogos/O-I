import { defineConfig } from '<seat>/packages/live-shell/ui/node_modules/vite/dist/node/index.js'
export default defineConfig({
  root: '<scratch>/harness',
  base: '/app/',
  publicDir: '<seat>/packages/live-shell/ui/public',
  resolve: { alias: { '@cradle': '<seat>/desktop/cradle/src', 'react-dom': '<seat>/desktop/cradle/node_modules/react-dom', 'react': '<seat>/desktop/cradle/node_modules/react', '@atlas': '<seat>/packages/live-shell/ui/src/projections/atlas' } },
  define: { __CRADLE_WALK__: false },
  server: { port: 5773, strictPort: true, host: '127.0.0.1', fs: { strict: false, allow: ['<seat>', '<scratch>'] } },
  optimizeDeps: { noDiscovery: true, include: ['react', 'react/jsx-runtime', 'react/jsx-dev-runtime', 'react-dom/client'] },
  cacheDir: '<scratch>/vite-cache',
})
