import {build} from 'esbuild';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
export async function modules(){
 const root=fileURLToPath(new URL('../',import.meta.url)),dir=await mkdtemp(join(tmpdir(),'nara-personal-module-'));
 const entry=`export * from './src/nara/personal/client.ts';export * from './src/nara/personal/operations.ts';export * from './src/nara/personal/ground.ts';export * from './src/nara/personal/flowReturn.ts';export * from './src/nara/identityPresentation.ts';export * from './expressions-app/field-studies-journeys/src/privateIdentity.ts';`;
 await build({stdin:{contents:entry,resolveDir:root,loader:'ts'},bundle:true,platform:'node',format:'esm',target:'es2022',outfile:join(dir,'bundle.mjs'),plugins:[{name:'retained-raw-document',setup(b){b.onResolve({filter:/\?raw$/},a=>({path:resolve(a.resolveDir,a.path.slice(0,-4)),namespace:'raw'}));b.onLoad({filter:/.*/,namespace:'raw'},async a=>({contents:`export default ${JSON.stringify(await readFile(a.path,'utf8'))}`,loader:'js'}));}}],logLevel:'silent'});
 const mod=await import(pathToFileURL(join(dir,'bundle.mjs')).href);return {mod,dispose:()=>rm(dir,{recursive:true,force:true})};
}
