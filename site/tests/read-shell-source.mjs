import {build} from 'esbuild';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const result=await build({entryPoints:['src/shell/content.ts'],bundle:true,write:false,platform:'node',format:'esm',plugins:[{name:'public-source',setup(b){b.onResolve({filter:/\.md\?raw$/},args=>({path:resolve(args.resolveDir,args.path.slice(0,-4)),namespace:'source'}));b.onLoad({filter:/.*/,namespace:'source'},async args=>({contents:await readFile(args.path,'utf8'),loader:'text'}));}}]});
const content=await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));
console.log(JSON.stringify(content.ENTRANCE));
