import {defineConfig} from '../../desktop/cradle/node_modules/vite/dist/node/index.js';
import {fileURLToPath} from 'node:url';
import {instrumentEditorBundler} from './src/receiving/vite.mjs';
export default defineConfig({
 root:fileURLToPath(new URL('./',import.meta.url)),
 plugins:[instrumentEditorBundler({reactRoot:fileURLToPath(new URL('../../desktop/cradle/',import.meta.url))})],
 define:{__CRADLE_WALK__:false},
 build:{lib:{entry:fileURLToPath(new URL('./src/index.ts',import.meta.url)),formats:['es'],fileName:'instrument-editors'},minify:false,rollupOptions:{external:id=>/^react(?:-dom)?(?:\/|$)/.test(id)}},
});
