import {defineConfig} from '../../../desktop/cradle/node_modules/vite/dist/node/index.js';
import {fileURLToPath} from 'node:url';
import {instrumentEditorBundler} from '../src/receiving/vite.mjs';
const root=fileURLToPath(new URL('../../../',import.meta.url));
export default defineConfig({root:fileURLToPath(new URL('./',import.meta.url)),plugins:[instrumentEditorBundler({reactRoot:root+'desktop/cradle'})],optimizeDeps:{entries:['main.tsx',root+'desktop/cradle/expressions-app/field-studies-journeys/src/researchInstruments.tsx']},server:{host:'127.0.0.1',port:4298,strictPort:true,fs:{allow:[root]},watch:{ignored:path=>path.startsWith(root+'desktop/')||path.startsWith(root+'packages/live-shell/')||path.startsWith(root+'packages/expressions-boundary/')}},define:{'import.meta.env.VITE_KERNEL_BRIDGE':JSON.stringify(process.env.OI_EDITOR_BRIDGE??'http://127.0.0.1:4180')}});
