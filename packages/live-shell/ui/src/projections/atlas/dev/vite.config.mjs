// Vite config for the Earth-projection render harness (dev/ only). It serves
// the ported atlas over the fixture corpus from the ui package's own vite;
// it is harness config, not the shell's build (the ui package's own
// `tsc --noEmit && vite build` remains the shell build, untouched).
import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url)); // .../src/projections/atlas/dev
const atlasDir = dirname(here);
const uiDir = join(atlasDir, '..', '..', '..'); // packages/live-shell/ui

export default defineConfig({
  root: here,
  // The harness serves the shell's own public/ (its textures: earth-2k/4k/8k, the pinned vendored assets), never a copy: the
  // globe loads the textures the candidate ships, so what paints here is what paints in the shell.
  publicDir: join(uiDir, 'public'),
  server: {
    port: 5199,
    strictPort: true,
    host: '127.0.0.1',
    fs: {
      // the harness imports ../mount.ts — allow the atlas tree (deps resolve
      // from the ui package's node_modules up the ancestor chain)
      allow: [atlasDir, join(uiDir, '..')],
    },
  },
  build: { target: 'es2022' },
});
