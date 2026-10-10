import {build} from '../../../desktop/cradle/node_modules/esbuild/lib/main.js';
import {writeFile,unlink} from 'node:fs/promises';
const result=await build({entryPoints:[new URL('./canvas-geometry.test.mjs',import.meta.url).pathname],bundle:true,format:'esm',platform:'node',write:false,logLevel:'error'});
// Real TS source is compiled with the same type-import erasure as the app. No substitute owner is installed.
const compiled=new URL('./canvas-compiled-runtime.mjs',import.meta.url);
try{await writeFile(compiled,result.outputFiles[0].text);await import(compiled.href);}finally{await unlink(compiled);}
await import('./canvas-adapter.test.mjs');
