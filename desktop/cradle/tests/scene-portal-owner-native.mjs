#!/usr/bin/env node
/** Real native trigger/source admission -> production Cradle Surface placements.
 * Explicit authored input only; no mocked native response or document fixture. */
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,rm} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import {closeControlledExpression} from './nara-native-cleanup.mjs';
const config=JSON.parse(await readFile(process.argv[2],'utf8')),world=config.worlds[1],bridge=process.env.PORTAL_BRIDGE??world.bridge;
assert.ok(world.root.includes('/T/ta5-native-worlds/'));
const id=randomUUID(),output=path.join(path.dirname(process.argv[2]),'portal-owner-'+id),ref='expression:controlled-act-'+id;
await mkdir(output);const sourcePath='Work/controlled/portal-source-'+id+'.md';
await writeFile(path.join(world.root,sourcePath),'# Portal owner source\n\nActual Central bytes remain the same across placements.\n');
const transport={kind:'bridge',url:bridge},receipts=[],browserErrors=[];let server,browser,page,created=false,sourceRef;
async function op(request){const data=await fetch(bridge+'/op',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(request),signal:AbortSignal.timeout(90000)}).then(r=>r.json());if(data.error)throw Error(data.error);receipts.push({op:request.op,operation:request.request?.operation,result:data.outcome.result});return data.outcome.data??data.outcome;}
try{
 server=await createServer({root:process.cwd(),cacheDir:output+'/vite-cache',server:{host:'127.0.0.1',port:0,hmr:false}});await server.listen();
 const files=await server.ssrLoadModule('/src/files/client.ts'),bodyModule=await server.ssrLoadModule('/expressions-app/field-studies-journeys/src/nativeSceneBody.ts');
 const listing=await files.listFiles(transport,'Work/controlled',true),location=listing.entries.find(row=>row.name===path.basename(sourcePath)).location,reading=await files.readFile(transport,location);
 sourceRef=location.ref;const body=bodyModule.bodyFromNativeReading('text_source',{...reading,ref:location.ref,requested_ref:location.ref,native_owner:'central'},null);
 const initial=await op({op:'expression',request:{operation:'create',expression_ref:ref,title:'Native source portal owner proof',actor:'agent:portal-proof'}});created=true;const scene=initial.document.scenes[0].scene_ref;
 const placements=['preview','overlay','beside','full','detached','re_dock'];
 const authored=await op({op:'expression',request:{operation:'edit',expression_ref:ref,expected_revision:initial.document.revision,actor:'agent:portal-proof',changes:[{change:'scene_body_set',scene_ref:scene,body},...placements.map(placement=>({change:'scene_trigger_attach',scene_ref:scene,trigger:{trigger_ref:ref+':trigger:'+placement,occasion:'activate',target:{kind:'portal',placement,subject_ref:location.ref}}}))]}});
 browser=await chromium.launch({headless:true});page=await browser.newPage({viewport:{width:1360,height:900}});page.on('pageerror',error=>browserErrors.push(String(error)));await page.goto('http://127.0.0.1:'+server.httpServer.address().port+'/tests/scene-portal-native-page.html?bridge='+encodeURIComponent(bridge),{waitUntil:'domcontentloaded',timeout:90000});
 await page.locator('.desktop-shell').waitFor({timeout:120000});
 const pointer=placement=>({trigger_ref:ref+':trigger:'+placement,subject:{ref,revision:authored.document.revision,sceneRef:scene}});
 const activate=placement=>page.evaluate(p=>window.__SCENE_PORTAL_OWNER_PROOF__.activate(p),pointer(placement));
 const portals=async()=> (await op({op:'expression_world',request:{operation:'portal_inspect'}})).portals;
 for(const placement of ['preview','overlay']){
  const beforeMode=await page.locator('.desktop-shell').getAttribute('data-mode');await activate(placement);
  const slot=page.locator('.scene-source-portal.'+placement);await slot.waitFor();const surfaceId=await slot.getAttribute('data-surface-id');
  assert.equal(await slot.getAttribute('data-source-ref'),location.ref);assert.equal(await page.locator('.desktop-shell').getAttribute('data-mode'),beforeMode);
  const native=(await portals()).find(row=>row.target_ref===location.ref);assert.equal(native.surface_id,surfaceId);assert.equal(native.placement,placement);
  await slot.frameLocator('iframe').getByText('Actual Central bytes remain the same across placements.').first().waitFor({timeout:60000});
  await slot.getByRole('button',{name:'Return to scene'}).click();await slot.waitFor({state:'detached'});assert.ok(!(await portals()).some(row=>row.surface_id===surfaceId));
 }
 await page.evaluate(()=>window.dispatchEvent(new CustomEvent('oi:enter-mode',{detail:{mode:'expressions'}})));await page.locator('.desktop-shell[data-mode="expressions"]').waitFor();
 await activate('beside');assert.equal(await page.locator('.desktop-shell').getAttribute('data-mode'),'expressions');const beside=(await portals()).find(row=>row.target_ref===location.ref);assert.equal(beside.placement,'beside');
 await page.waitForFunction(id=>!!document.querySelector(`[data-surface-id="${CSS.escape(id)}"]`),beside.surface_id);
 await activate('full');const full=(await portals()).find(row=>row.target_ref===location.ref);assert.equal(full.surface_id,beside.surface_id);assert.equal(full.placement,'full');assert.equal(await page.locator('.desktop-shell').getAttribute('data-mode'),'base');
 await page.evaluate(()=>window.dispatchEvent(new Event('oi:context-return')));await page.locator('.desktop-shell[data-mode="expressions"]').waitFor();
 await activate('beside');const returned=(await portals()).find(row=>row.target_ref===location.ref);assert.equal(returned.surface_id,full.surface_id);assert.equal(returned.placement,'beside');
 await assert.rejects(activate('detached'),/native desktop window/);
 const after=await op({op:'expression',request:{operation:'inspect',expression_ref:ref}});assert.deepEqual(after.document,authored.document);
 await page.screenshot({path:output+'/full-source.png'});
 await writeFile(output+'/receipt.json',JSON.stringify({status:'passed',bridge,source:location,checks:['Actual authored native triggers admit current native source','Preview and overlay mount production SurfaceBody and preserve mode','Visible Surface ID equals native portal ID; Return closes actual portal','Beside and full use same native Surface; explicit full reaches Base','Browser refuses native detached action; Scene is unchanged'],limits:['Cradle native owner/visible placements; detached/re-dock require actual Tauri window replay.','Pointer admission here calls production resolver directly; full iframe chip/ACK path is a separate joined test.'],receipts,browserErrors},null,2));console.log(output+'/receipt.json');
}catch(error){if(page){await page.screenshot({path:output+'/failure.png'}).catch(()=>{});await writeFile(output+'/failure.html',await page.content()).catch(()=>{});}await writeFile(output+'/failure.json',JSON.stringify({error:String(error),browserErrors,receipts},null,2));throw error;}finally{
 if(sourceRef){const held=await op({op:'expression_world',request:{operation:'portal_inspect'}});for(const portal of held.portals??[])if(portal.target_ref===sourceRef)await op({op:'expression_world',request:{operation:'portal_close',portal_ref:portal.portal_ref,actor:'agent:portal-proof-cleanup'}});}
 if(browser)await browser.close();
 if(created&&server)await closeControlledExpression(server,bridge,ref,output,'Native source portal proof');
 await writeFile(output+'/cleanup.json',JSON.stringify({receipts},null,2));
 if(server)await server.close();
 await rm(output+'/vite-cache',{recursive:true,force:true});
}
