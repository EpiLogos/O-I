/** Stage only declared public edition files and approved editorial media.
 * Vite must never copy the repository's entire development public/data folder. */
import { readFile, writeFile, cp, mkdir, rm, lstat } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('.',import.meta.url));
const target=resolve(root,'.public-edition');
const source=resolve(root,'public');
const json=async path=>JSON.parse(await readFile(resolve(source,path),'utf8'));
await rm(target,{recursive:true,force:true});
await mkdir(target,{recursive:true});
const files=new Set(['data/library/index.json','data/library/public-site.md','data/library/published.json','data/library/edition-manifests.json']);
const index=await json('data/library/index.json');
for(const entry of index.entries){
 if(!/^\.\/data\/library\/[a-z][a-z-]*\.json$/.test(entry.url))throw new Error('Unadmitted site edition path.');
 files.add(entry.url.slice(2));
}
const manifests=await json('data/library/edition-manifests.json');
for(const manifest of manifests){
 for(const path of [manifest.page,manifest.projection_file]){
  if(!/^\.\/data\/library\/editions\/[a-f0-9]{64}\/(?:index\.html|projection\.json)$/.test(path))throw new Error('Unadmitted native edition path.');
  files.add(path.slice(2));
 }
 if(manifest.native_body){
  const path=manifest.native_body.path;
  if(!/^\.\/data\/library\/editions\/[a-f0-9]{64}\/native-body\.journey\.json$/.test(path))throw new Error('Unadmitted native Expression body path.');
  if(dirname(path.slice(2))!==dirname(manifest.page.slice(2)))throw new Error('The native Expression body must belong to the same exact edition.');
  files.add(path.slice(2));
 }
 files.add(dirname(manifest.page.slice(2))+'/manifest.json');
}
for(const path of files){
 const from=resolve(source,path),to=resolve(target,path);
 if((await lstat(from)).isSymbolicLink())throw new Error('A publication file cannot be a filesystem alias.');
 await mkdir(dirname(to),{recursive:true});await cp(from,to);
}
await cp(resolve(source,'media'),resolve(target,'media'),{recursive:true,filter:async path=>!(await lstat(path)).isSymbolicLink()});
// A static, public-only input for compatible Explore readers. Never the raw owner seed.
await writeFile(resolve(target,'data/explore-public.json'),JSON.stringify(await json('data/library/published.json')));
console.log(`Public assets: ${files.size} declared edition files; approved editorial media. Development demo datasets excluded.`);
