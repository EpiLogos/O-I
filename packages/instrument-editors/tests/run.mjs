import {build} from '../../../desktop/cradle/node_modules/esbuild/lib/main.js';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {pathToFileURL,fileURLToPath} from 'node:url';
process.env.OI_EDITOR_EVIDENCE_DIR=fileURLToPath(new URL('../evidence/',import.meta.url));
const directory=await mkdtemp(join(tmpdir(),'oi-instrument-tests-'));
try{const compiled=[];for(const file of ['presentation.test.mjs','palace-native.test.mjs','modulation.test.mjs','modulation-native.test.mjs','recovery-native.test.mjs','workbench-native.test.mjs']){const result=await build({entryPoints:[new URL(file,import.meta.url).pathname],bundle:true,format:'esm',platform:'node',write:false,logLevel:'error'});const path=join(directory,file);await writeFile(path,result.outputFiles[0].text);compiled.push(path);}for(const path of compiled)await import(pathToFileURL(path).href);}finally{await rm(directory,{recursive:true,force:true});}
