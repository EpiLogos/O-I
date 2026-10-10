import {build} from '../../../desktop/cradle/node_modules/esbuild/lib/main.js';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {pathToFileURL} from 'node:url';
process.env.OI_EDITOR_EVIDENCE_URL=new URL('../evidence/',import.meta.url).href;
const directory=await mkdtemp(join(tmpdir(),'oi-instrument-recovery-'));
try{const result=await build({entryPoints:[new URL('restart.mjs',import.meta.url).pathname],bundle:true,format:'esm',platform:'node',write:false,logLevel:'error'});const path=join(directory,'restart.mjs');await writeFile(path,result.outputFiles[0].text);await import(pathToFileURL(path).href);}finally{await rm(directory,{recursive:true,force:true});}
