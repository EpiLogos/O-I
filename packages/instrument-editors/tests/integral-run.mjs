import {build} from '../../../desktop/cradle/node_modules/esbuild/lib/main.js';
import {writeFile,unlink} from 'node:fs/promises';
const compiled=new URL(`integral-runtime-${process.pid}.mjs`,import.meta.url);
try{const result=await build({entryPoints:[new URL('integral-state.test.mjs',import.meta.url).pathname],bundle:true,format:'esm',platform:'node',write:false,logLevel:'error'});await writeFile(compiled,result.outputFiles[0].text);await import(compiled.href);}finally{await unlink(compiled).catch(()=>{});}
await import('./entry-context-run.mjs');
