import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import path from 'node:path'

// Dev:    `npm run dev` on :5173, /api/* proxied to the axum server on :8787
//         (`cargo run -- <set.als>` in packages/live-shell).
// Build:  `npm run build` → ui-dist/, served by axum at /app (base is /app/
//         so hashed asset URLs resolve under the nested mount).
export default defineConfig({
  base: '/app/',
  plugins: [react()],
  define: { __CRADLE_WALK__: false },
  resolve: { dedupe: ['react', 'react-dom'] },
  server: {
    fs: { allow: [path.resolve(__dirname, '../../..')] },
    proxy: {
      '/api': { target: process.env.VITE_LIVE_SHELL_API ?? 'http://127.0.0.1:8788', changeOrigin: true },
      '/__application/expressions': { target: process.env.VITE_LIVE_SHELL_API ?? 'http://127.0.0.1:8788', changeOrigin: true },
    },
  },
  build: {
    outDir: 'ui-dist',
    emptyOutDir: true,
  },
})
