import fs from 'node:fs';import path from 'node:path';import {createRequire} from 'node:module';
import {build} from 'esbuild';
const require=createRequire(import.meta.url),ts=require('typescript');
const root=path.resolve(import.meta.dirname,'..');process.chdir(root);fs.mkdirSync('public',{recursive:true});fs.mkdirSync('build',{recursive:true});
const config=ts.readConfigFile('tsconfig.json',ts.sys.readFile),parsed=ts.parseJsonConfigFileContent(config.config,ts.sys,root);
const diagnostics=ts.getPreEmitDiagnostics(ts.createProgram(parsed.fileNames,parsed.options));
if(diagnostics.length){console.error(ts.formatDiagnosticsWithColorAndContext(diagnostics,{getCanonicalFileName:x=>x,getCurrentDirectory:()=>root,getNewLine:()=> '\n'}));process.exit(1);}
// A real dependency-aware bundle includes the existing engine and Three.js, offline.
const result=await build({absWorkingDir:root,entryPoints:['src/app.ts'],bundle:true,format:'iife',target:'es2022',write:false,minify:true,legalComments:'inline',metafile:true});
const bundle=result.outputFiles[0].text;
// Pure module fixtures remain independently importable by Node tests.
for(const file of fs.readdirSync('src').filter(f=>f.endsWith('.ts'))){await build({absWorkingDir:root,entryPoints:['src/'+file],bundle:true,format:'esm',platform:'node',target:'es2022',outfile:'build/'+file.replace('.ts','.js')});}
const css=fs.readFileSync('src/styles.css','utf8')+fs.readFileSync('src/workspace.css','utf8');
const html=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#f4f2eb"><meta name="description" content="A native particle-field instrument for composing scenes and living expressions."><title>O:I — Expressions</title><style id="shell-style">${css}</style></head><body><div id="app"></div><script id="app-bundle">${bundle.replace(/<\/script/gi,'<\\/script')}</script></body></html>`;
fs.mkdirSync(path.resolve(root,'../public'),{recursive:true});fs.writeFileSync(path.resolve(root,'../public/field-studies.html'),html);
fs.writeFileSync('public/index.html',html);fs.writeFileSync('field-studies.html',html);fs.writeFileSync('build/bundle-metafile.json',JSON.stringify(result.metafile,null,2));
fs.writeFileSync('public/_headers','/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: no-referrer\n');
console.log(`Native standalone built: ${(html.length/1024/1024).toFixed(2)} MB; no runtime requests, external fonts or preview renderer.`);

await build({absWorkingDir:root,entryPoints:['tests/nativeHarness.ts'],bundle:true,format:'iife',target:'es2022',outfile:'build/native-harness.js'});
