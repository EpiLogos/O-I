// Vite config for the device-SDK harness (sdk/dev only). It serves the face
// kit's demo family — declared through the kit itself — with a labelled
// fixture aperture. Harness config, not the shell build.
import {defineConfig} from 'vite';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';

const here = dirname(fileURLToPath(import.meta.url)); // .../src/inhabitants/sdk/dev
const sdkDir = dirname(here);
const inhabitantsDir = dirname(sdkDir);
const uiRoot = join(inhabitantsDir, '..', '..');
const cradleSrc = join(uiRoot, '..', '..', '..', 'desktop', 'cradle', 'src');

export default defineConfig({
  root: here,
  server: {
    port: 5207,
    strictPort: true,
    host: '127.0.0.1',
    fs: {
      allow: [sdkDir, inhabitantsDir, uiRoot, cradleSrc],
    },
  },
  build: {target: 'es2022'},
});
