// The stack's dev server: the seat's packages/live-shell/ui exactly as vite.config.ts serves it, with its own cache dir.
// LANE_S_PATCH (seat path → scratch path) are served from their proposed scratch copies. Nothing in the seat is written.
import react from '/Users/admin/Central/worktrees/env-1/o-i/packages/live-shell/ui/node_modules/@vitejs/plugin-react/dist/index.js'
import {defineConfig} from '/Users/admin/Central/worktrees/env-1/o-i/packages/live-shell/ui/node_modules/vite/dist/node/index.js'
import {readFileSync} from 'node:fs'
import path from 'node:path'
const UI = '/Users/admin/Central/worktrees/env-1/o-i/packages/live-shell/ui'
const PATCH = Object.fromEntries((process.env.LANE_S_PATCH ?? '').split(',').filter(Boolean).map(pair => pair.split('=')))
export default defineConfig({
  root: UI,
  // Its own dependency cache: the seat's node_modules/.vite is the lead's dev server's.
  cacheDir: process.env.LEAD_KIT_VITE_CACHE ?? '/tmp/oi-lead-kit-vite-cache',
  base: '/app/',
  plugins: [{
    name: 'lead-kit-patch', enforce: 'pre',
    load(id) {
      const file = id.split('?')[0]
      const scratch = PATCH[file]
      if (scratch) { console.log(`[lead-kit] serving proposed ${path.basename(file)} from ${scratch}`); return readFileSync(scratch, 'utf8') }
    },
  }, react()],
  define: {__CRADLE_WALK__: false},
  resolve: {dedupe: ['react', 'react-dom']},
  server: {
    fs: {allow: [path.resolve(UI, '../../..'), '/private/tmp']},
    proxy: {
      '/api': {target: process.env.VITE_LIVE_SHELL_API, changeOrigin: true},
      '/__application/expressions': {target: process.env.VITE_LIVE_SHELL_API, changeOrigin: true},
    },
  },
})
