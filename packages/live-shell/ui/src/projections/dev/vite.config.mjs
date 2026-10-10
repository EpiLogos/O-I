// Vite config for the projection-seam harness (dev/ only). It serves the
// pane engine + module contract + encounter bridge over the reference
// projection module; it is harness config, not the shell's build (the ui
// package's own `tsc --noEmit && vite build` remains the shell build,
// untouched). Same pattern as the atlas port's dev harness.
import {defineConfig} from 'vite';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';

const here = dirname(fileURLToPath(import.meta.url)); // .../src/projections/dev
const projectionsDir = dirname(here);
const uiRoot = join(projectionsDir, '..', '..');

export default defineConfig({
  root: here,
  server: {
    port: 5201,
    strictPort: true,
    host: '127.0.0.1',
    fs: {
      // the harness imports the cradle surface engine and the ui projections;
      // deps resolve from the ui package's node_modules up the ancestor chain
      allow: [projectionsDir, uiRoot, join(uiRoot, '..', '..', 'desktop', 'cradle', 'src')],
    },
  },
  build: {target: 'es2022'},
});
