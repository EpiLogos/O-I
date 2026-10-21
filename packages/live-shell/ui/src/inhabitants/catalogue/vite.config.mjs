// The catalogue gallery: every declared device, drawn by the shell's own device runtime in each of its views, so the DLW
// manual (docs/dlw, Part Three) shows the real components beside their specs. Harness config, not the shell build.
import {defineConfig} from 'vite';
import {fileURLToPath} from 'node:url';
import {dirname, join, sep} from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const uiRoot = join(here, '..', '..', '..');
const cradleSrc = join(uiRoot, '..', '..', '..', 'desktop', 'cradle', 'src');
// The Day's Full view draws its real template page (desktop/cradle/documents).
const cradleDocuments = join(uiRoot, '..', '..', '..', 'desktop', 'cradle', 'documents');
// The faces (faces/vendor) are the face rig's plain-JS kit: each file runs the moment it is imported, and some take 300 ms. The
// manual carries the gallery as one script (docs/dlw/gallery.mjs), where an import does not defer a file, so each vendored file
// becomes a function that the faces' loader (faces/vendor.ts) calls when a face needs it. The files themselves are not changed.
const faceVendor = () => ({
  name: 'catalogue-face-vendor',
  enforce: 'pre',
  transform(code, id) {
    const path = id.split('?')[0];
    if (!path.endsWith('.js') || !path.includes(`${sep}faces${sep}vendor${sep}`)) return null;
    return {code: `export default function runFaceVendor() {\n${code}\n}\n`, map: null};
  },
});

export default defineConfig({
  root: here,
  plugins: [faceVendor()],
  // The shell's own served files (ui/public: the agent's face at /face/, scripts/sync-face.mjs), as the hosted frame serves them.
  publicDir: join(uiRoot, 'public'),
  server: {port: 5208, strictPort: true, host: '127.0.0.1', cors: true, hmr: {overlay: false}, fs: {allow: [uiRoot, cradleSrc, cradleDocuments]}},
  define: {__CRADLE_DOCUMENTS__: JSON.stringify(`/@fs${cradleDocuments}`)},
  build: {target: 'es2022'},
});
