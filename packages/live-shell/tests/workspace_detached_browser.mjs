import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';

// Replay the real original useWorkspaces hook and engine in Chromium.
// Storage is isolated; there are no substituted native owner routes.
const root=resolve(fileURLToPath(new URL('../../../',import.meta.url)));
const require=createRequire(root+'/packages/live-shell/ui/package.json');
const {build}=require('esbuild');
const {chromium}=require(process.env.OI_BROWSER_RUNTIME||'playwright');
const entry=`import React,{useEffect} from 'react';import {createRoot} from 'react-dom/client';
import {useWorkspaces} from ${JSON.stringify(root+'/desktop/cradle/src/workspace/store.ts')};
import {openBinding,detachBinding} from ${JSON.stringify(root+'/desktop/cradle/src/surface/engine.ts')};
window.engine={openBinding,detachBinding};
function Book(){const value=useWorkspaces({storageKey:'oi.live-shell.candidate.workspace.v2',legacyLayoutKey:'oi.live-shell.candidate.layout.v1'});useEffect(()=>{window.book=value;},[value]);return null;}
createRoot(document.getElementById('root')).render(React.createElement(Book));`;
const result=await build({stdin:{contents:entry,resolveDir:root+'/packages/live-shell/ui',sourcefile:'actual-workspace-replay.tsx',loader:'tsx'},bundle:true,write:false,format:'esm',platform:'browser',target:'es2022',alias:{react:root+'/packages/live-shell/ui/node_modules/react','react-dom':root+'/packages/live-shell/ui/node_modules/react-dom','@tauri-apps/api':root+'/packages/live-shell/ui/node_modules/@tauri-apps/api'}});
const server=createServer((request,response)=>{response.setHeader('Content-Type',request.url==='/book.mjs'?'text/javascript':'text/html');response.end(request.url==='/book.mjs'?result.outputFiles[0].text:'<html><body><div id="root"></div><script type="module" src="/book.mjs"></script></body></html>');});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const profile=await mkdtemp(join(tmpdir(),'oi-workspace-detached-'));
const options={headless:true,...(process.env.OI_BROWSER_EXECUTABLE?{executablePath:process.env.OI_BROWSER_EXECUTABLE}:{})};
let context;
try{
 context=await chromium.launchPersistentContext(profile,options);let page=await context.newPage();page.on('pageerror',error=>console.error(error));await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>window.book);
 const ownerId=await page.evaluate(()=>window.book.current.id);
 await page.evaluate(()=>window.book.setLayout(layout=>window.engine.detachBinding(window.engine.openBinding(layout,{id:'7a4d5a3b-d41d-446c-92bd-b436146c43f0',kind:'sources',title:'Sources'}),'7a4d5a3b-d41d-446c-92bd-b436146c43f0')));
 await page.waitForFunction(()=>window.book.current.layout.detached?.some(entry=>entry.surfaceId==='7a4d5a3b-d41d-446c-92bd-b436146c43f0'));
 await page.evaluate(()=>window.book.switchMode('techne'));await page.waitForFunction(()=>window.book.current.layout.mode==='techne');
 await page.evaluate(()=>window.book.create('Other workspace'));await page.waitForFunction(ownerId=>window.book.current.id!==ownerId,ownerId);
 const before=await page.evaluate(ownerId=>({active:JSON.stringify(window.book.current),ownerActive:JSON.stringify(window.book.workspaces.find(value=>value.id===ownerId).layout)}),ownerId);
 const bounds={x:31,y:47,width:720,height:480};await page.evaluate(({ownerId,bounds})=>window.book.windowBounds(ownerId,'7a4d5a3b-d41d-446c-92bd-b436146c43f0',bounds),{ownerId,bounds});
 await page.waitForFunction(ownerId=>window.book.workspaces.find(value=>value.id===ownerId).modeLayouts.base.windowBounds?.['7a4d5a3b-d41d-446c-92bd-b436146c43f0']?.width===720,ownerId);
 const moved=await page.evaluate(ownerId=>({active:JSON.stringify(window.book.current),ownerActive:JSON.stringify(window.book.workspaces.find(value=>value.id===ownerId).layout),bounds:window.book.workspaces.find(value=>value.id===ownerId).modeLayouts.base.windowBounds['7a4d5a3b-d41d-446c-92bd-b436146c43f0']}),ownerId);
 assert.equal(moved.active,before.active);assert.equal(moved.ownerActive,before.ownerActive);assert.deepEqual(moved.bounds,bounds);
 await page.evaluate(ownerId=>window.book.redock(ownerId,'7a4d5a3b-d41d-446c-92bd-b436146c43f0'),ownerId);
 await page.waitForFunction(ownerId=>!window.book.workspaces.find(value=>value.id===ownerId).modeLayouts.base.detached?.some(entry=>entry.surfaceId==='7a4d5a3b-d41d-446c-92bd-b436146c43f0'),ownerId);
 const redocked=await page.evaluate(ownerId=>({active:JSON.stringify(window.book.current),ownerActive:JSON.stringify(window.book.workspaces.find(value=>value.id===ownerId).layout),layout:window.book.workspaces.find(value=>value.id===ownerId).modeLayouts.base,durable:window.book.flushCheckpoint()}),ownerId);
 assert.equal(redocked.active,before.active);assert.equal(redocked.ownerActive,before.ownerActive);assert.equal(redocked.durable,true);assert.ok(redocked.layout.root);assert.equal(redocked.layout.surfaces['7a4d5a3b-d41d-446c-92bd-b436146c43f0'].id,'7a4d5a3b-d41d-446c-92bd-b436146c43f0');
 await context.close();context=await chromium.launchPersistentContext(profile,options);page=await context.newPage();await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>window.book);
 const restored=await page.evaluate(ownerId=>window.book.workspaces.find(value=>value.id===ownerId).modeLayouts.base,ownerId);
 assert.deepEqual(restored.windowBounds['7a4d5a3b-d41d-446c-92bd-b436146c43f0'],bounds);assert.ok(!restored.detached?.some(entry=>entry.surfaceId==='7a4d5a3b-d41d-446c-92bd-b436146c43f0'));assert.equal(restored.surfaces['7a4d5a3b-d41d-446c-92bd-b436146c43f0'].id,'7a4d5a3b-d41d-446c-92bd-b436146c43f0');
 console.log(JSON.stringify({checks:10,actual_hook:'desktop/cradle/src/workspace/store.ts useWorkspaces',inactive_workspace_and_mode:true,storage:'Chromium persistent WebStorage, isolated profile',native_owner_acceptance:false},null,2));
}finally{if(context)await context.close();await new Promise(done=>server.close(done));await rm(profile,{recursive:true,force:true});}
