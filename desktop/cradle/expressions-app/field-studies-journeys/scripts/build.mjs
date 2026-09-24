import fs from 'node:fs';import path from 'node:path';import {createRequire} from 'node:module';
import {build} from 'esbuild';
const require=createRequire(import.meta.url),ts=require('typescript');
const root=path.resolve(import.meta.dirname,'..');process.chdir(root);fs.mkdirSync('public',{recursive:true});fs.mkdirSync('build',{recursive:true});
const config=ts.readConfigFile('tsconfig.json',ts.sys.readFile),parsed=ts.parseJsonConfigFileContent(config.config,ts.sys,root);
const diagnostics=ts.getPreEmitDiagnostics(ts.createProgram(parsed.fileNames,parsed.options));
if(diagnostics.length){console.error(ts.formatDiagnosticsWithColorAndContext(diagnostics,{getCanonicalFileName:x=>x,getCurrentDirectory:()=>root,getNewLine:()=> '\n'}));process.exit(1);}
const rcRoot=path.resolve(root,'../vendor/research-canvas');
const aliases=Object.fromEntries(['schema','domain','desktop-api','geography','viewers','node-document'].map(name=>[`@research-canvas/${name}`,path.join(rcRoot,`packages/${name}/src/index.ts`)]));
// Shared chrome lives outside this package; bind it to this application's
// existing React runtime, including JSX/client/server subpaths.
aliases.react=path.resolve(root,'../node_modules/react');
aliases['react-dom']=path.resolve(root,'../node_modules/react-dom');
aliases['@research-canvas/exporter']=path.join(rcRoot,'browserExporter.ts');
const assets={'.woff':'dataurl','.woff2':'dataurl','.ttf':'dataurl','.svg':'dataurl','.png':'dataurl','.jpg':'dataurl','.webp':'dataurl'};
const sourceAssets={name:'research-canvas-source-assets',setup(builder){
 builder.onResolve({filter:/\?(raw|url)$/},args=>{
  const [file,kind]=args.path.split('?');
  const resolved=file.startsWith('.')?path.resolve(args.resolveDir,file):require.resolve(file);
  return {path:resolved,namespace:kind==='raw'?'oi-raw-source':'oi-worker-source'};
 });
 builder.onLoad({filter:/.*/,namespace:'oi-raw-source'},args=>({contents:fs.readFileSync(args.path,'utf8'),loader:'text'}));
 builder.onLoad({filter:/.*/,namespace:'oi-worker-source'},async args=>{
  // MapLibre's module worker imports a shared module. A raw source Blob loses
  // that relative module base in the native protocol; bundle the real worker
  // and its dependencies before giving it an offline Blob URL.
  const worker=await build({entryPoints:[args.path],bundle:true,write:false,platform:'browser',format:'iife',target:'es2022',minify:true});
  return {contents:`export default URL.createObjectURL(new Blob([${JSON.stringify(worker.outputFiles[0].text)}],{type:'text/javascript'}));`,loader:'js'};
 });
}};

// A real dependency-aware bundle includes the existing engine and Three.js, offline.
const result=await build({absWorkingDir:root,nodePaths:[path.resolve(root,'../node_modules')],entryPoints:['src/app.ts'],bundle:true,alias:aliases,loader:assets,plugins:[sourceAssets],jsx:'automatic',format:'iife',target:'es2022',write:false,outdir:'build/standalone',minify:true,legalComments:'inline',metafile:true});
const bundle=result.outputFiles.find(file=>file.path.endsWith('.js')).text;
const componentCSS=result.outputFiles.filter(file=>file.path.endsWith('.css')).map(file=>file.text).join('\n');
// Pure module fixtures remain independently importable by Node tests.
for(const file of fs.readdirSync('src').filter(f=>f.endsWith('.ts')&&!f.startsWith('researchInstruments'))){await build({absWorkingDir:root,nodePaths:[path.resolve(root,'../node_modules')],entryPoints:['src/'+file],bundle:true,alias:aliases,loader:assets,plugins:[sourceAssets],jsx:'automatic',format:'esm',platform:'node',target:'es2022',outfile:'build/'+file.replace('.ts','.js')});}
const css=componentCSS+fs.readFileSync('src/styles.css','utf8')+fs.readFileSync('src/workspace.css','utf8');
const html=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#f4f2eb"><meta name="description" content="A native particle-field instrument for composing scenes and living expressions."><title>O:I — Expressions</title><style id="shell-style">${css}</style></head><body><div id="app"></div><script id="app-bundle">${bundle.replace(/<\/script/gi,'<\\/script')}</script></body></html>`;
fs.mkdirSync(path.resolve(root,'../public'),{recursive:true});fs.writeFileSync(path.resolve(root,'../public/field-studies.html'),html);
fs.writeFileSync('public/index.html',html);fs.writeFileSync('field-studies.html',html);fs.writeFileSync('build/bundle-metafile.json',JSON.stringify(result.metafile,null,2));
fs.writeFileSync('public/_headers','/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: no-referrer\n');
console.log(`Native standalone built: ${(html.length/1024/1024).toFixed(2)} MB; no runtime requests, external fonts or preview renderer.`);

await build({absWorkingDir:root,nodePaths:[path.resolve(root,'../node_modules')],entryPoints:['tests/nativeHarness.ts'],bundle:true,alias:aliases,loader:assets,plugins:[sourceAssets],jsx:'automatic',format:'iife',target:'es2022',outfile:'build/native-harness.js'});
