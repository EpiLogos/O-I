// The catalogue gallery: every declared device, drawn by the shell's own device runtime in each of its views, so the DLW
// manual (docs/dlw, Part Three) shows the real components beside their specs. Harness config, not the shell build.
import {defineConfig} from 'vite';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const uiRoot = join(here, '..', '..', '..');
const cradleSrc = join(uiRoot, '..', '..', '..', 'desktop', 'cradle', 'src');

export default defineConfig({
  root: here,
  server: {port: 5208, strictPort: true, host: '127.0.0.1', cors: true, fs: {allow: [uiRoot, cradleSrc]}},
  build: {target: 'es2022'},
});
