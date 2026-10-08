import {defineConfig} from '../../../desktop/cradle/node_modules/vite/dist/node/index.js';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const root=fileURLToPath(new URL('../../../',import.meta.url));
const vendor=root+'desktop/cradle/expressions-app/vendor/research-canvas/';
const aliases=['schema','domain','desktop-api','geography','viewers','node-document'].map(name=>({find:'@research-canvas/'+name,replacement:vendor+'packages/'+name+'/src/index.ts'}));
aliases.push({find:'@research-canvas/exporter',replacement:vendor+'browserExporter.ts'});
for(const name of ['react','react-dom','@tauri-apps/api'])aliases.push({find:name,replacement:root+'desktop/cradle/node_modules/'+name});
const dependency=createRequire(import.meta.url);
const {build:bundleWorker}=dependency(root+'desktop/cradle/node_modules/esbuild/lib/main.js');
for(const name of ['d3-force','d3-selection','d3-zoom'])aliases.push({find:name,replacement:dependency.resolve(name,{paths:[root+'desktop/cradle',root+'desktop/cradle/expressions-app',root+'packages/live-shell/ui']})});
aliases.push({find:'maplibre-gl',replacement:root+'desktop/cradle/expressions-app/node_modules/maplibre-gl'});
// Adopted from the native Expressions vite.config.ts: the complete offline
// MapLibre worker, rather than a copied module missing its shared imports.
const researchWorker={name:'oi-research-worker',enforce:'pre',resolveId(id){return id==='maplibre-gl/dist/maplibre-gl-worker.mjs?url'?'\0oi-research-worker':undefined;},async load(id){if(id!=='\0oi-research-worker')return;const result=await bundleWorker({entryPoints:[root+'desktop/cradle/expressions-app/node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs'],bundle:true,write:false,platform:'browser',format:'iife',target:'es2022',minify:true});return `export default URL.createObjectURL(new Blob([${JSON.stringify(result.outputFiles[0].text)}],{type:'text/javascript'}));`;}};
export default defineConfig({root:fileURLToPath(new URL('./',import.meta.url)),plugins:[researchWorker],resolve:{alias:aliases,dedupe:['react','react-dom']},optimizeDeps:{entries:['main.tsx',root+'desktop/cradle/expressions-app/field-studies-journeys/src/researchInstruments.tsx'],exclude:['maplibre-gl','maplibre-gl/dist/maplibre-gl-worker.mjs?url']},server:{host:'127.0.0.1',port:4298,strictPort:true,fs:{allow:[root]},watch:{ignored:path=>path.startsWith(root+'desktop/')||path.startsWith(root+'packages/live-shell/')||path.startsWith(root+'packages/expressions-boundary/')}},define:{'import.meta.env.VITE_KERNEL_BRIDGE':JSON.stringify(process.env.OI_EDITOR_BRIDGE??'http://127.0.0.1:4180')}});
