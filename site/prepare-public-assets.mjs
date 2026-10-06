/** Stage only declared public edition files and approved editorial media.
 * Vite must never copy the repository's entire development public/data folder. */
import { readFile, cp, mkdir, rm, lstat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('.',import.meta.url));
const target=resolve(root,'.public-edition');
const source=resolve(root,'public');
const json=async path=>JSON.parse(await readFile(resolve(source,path),'utf8'));
await rm(target,{recursive:true,force:true});
await mkdir(target,{recursive:true});
const files=new Set(['data/library/index.json','data/library/public-site.md']);
const index=await json('data/library/index.json');
for(const entry of index.entries){
 if(!/^\.\/data\/library\/[a-z][a-z-]*\.json$/.test(entry.url))throw new Error('Unadmitted site edition path.');
 files.add(entry.url.slice(2));
}
for(const path of files){
 const from=resolve(source,path),to=resolve(target,path);
 if((await lstat(from)).isSymbolicLink())throw new Error('A public edition file cannot be a filesystem alias.');
 await mkdir(dirname(to),{recursive:true});await cp(from,to);
}
const essayShell=resolve(source,'essay-shell');
if(!existsSync(resolve(essayShell,'catalog.json')))throw new Error('Essay browser catalog is missing. Run node build-essay-browser.mjs before preparing the public edition.');
await cp(essayShell,resolve(target,'essay-shell'),{recursive:true});
await cp(resolve(source,'media'),resolve(target,'media'),{recursive:true,filter:async path=>!(await lstat(path)).isSymbolicLink()});
console.log(`Public assets: ${files.size} declared site-edition files; essay shell; approved editorial media. Development demo datasets excluded.`);
