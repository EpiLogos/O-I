import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Dev:    `npm run dev` on :5173, /api/* proxied to the axum server on :8787
//         (`cargo run -- <set.als>` in packages/live-shell).
// Build:  `npm run build` → ui-dist/, served by axum at /app (base is /app/
//         so hashed asset URLs resolve under the nested mount).
export default defineConfig({
  base: '/app/',
  plugins: [react()],
  server: {
    proxy: {
      '/api': { target: 'http://127.0.0.1:8787', changeOrigin: true },
    },
  },
  build: {
    outDir: 'ui-dist',
    emptyOutDir: true,
  },
})
