import {build} from 'esbuild';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
import {mkdtemp,rm} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const app=path.resolve(root,'../..');
const dir=await mkdtemp(path.join(app,'node_modules/.research-canvas-check-'));
try{
 const output=path.join(dir,'test.mjs');
 const alias=Object.fromEntries(['schema','domain','desktop-api','geography','viewers','node-document'].map(name=>[`@research-canvas/${name}`,path.join(root,`packages/${name}/src/index.ts`)]));
 alias['@research-canvas/exporter']=path.join(root,'browserExporter.ts');
 await build({entryPoints:[path.join(root,'tests/readOnly.tsx')],outfile:output,bundle:true,platform:'node',format:'esm',packages:'external',jsx:'automatic',alias,loader:{'.css':'empty'},plugins:[{name:'server-styles',setup(builder){builder.onResolve({filter:/\.css$/},args=>({path:require.resolve(args.path),external:false}));}}]});
 const result=spawnSync(process.execPath,[output],{stdio:'inherit',cwd:app});
 if(result.status!==0)throw new Error(`Actual component render failed: ${result.status}`);
}finally{await rm(dir,{recursive:true,force:true});}
