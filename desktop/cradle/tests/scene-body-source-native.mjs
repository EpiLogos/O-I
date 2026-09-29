#!/usr/bin/env node
/** Actual Central file → hosted relay → source-qualified native Scene body.
 * Controlled authored input files; every reading/mutation comes from the real
 * native World. Does not claim the separate detached-window portal acceptance. */
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,rm} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import {closeControlledExpression} from './nara-native-cleanup.mjs';
const config=JSON.parse(await readFile(process.argv[2],'utf8')),world=config.worlds[1];
assert.ok(world.root.includes('/T/ta5-native-worlds/'));
const id=randomUUID(),output=path.join(path.dirname(process.argv[2]),'source-body-'+id),ref='expression:controlled-act-'+id;
await mkdir(output);const sourcePath='Work/controlled/source-body-'+id+'.md';
await writeFile(path.join(world.root,sourcePath),'# Native source body\n\nEarth 🜁 water — a controlled authored passage.\n');
const transport={kind:'bridge',url:world.bridge};let server,browser,created=false;
const receipts=[],browserErrors=[];
async function op(request){const r=await fetch(world.bridge+'/op',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(request),signal:AbortSignal.timeout(90000)}).then(r=>r.json());if(r.error)throw Error(r.error);receipts.push({op:request.op,operation:request.request?.operation??request.request?.action,result:r.outcome.result});return r.outcome.data??r.outcome;}
try{
 server=await createServer({configFile:false,appType:'custom',root:process.cwd(),cacheDir:output+'/vite-cache',server:{host:'127.0.0.1',port:0,hmr:false}});
 server.middlewares.use((req,res,next)=>{
  if(req.url==='/__body_parent'){res.setHeader('Content-Type','text/html');res.end(`<iframe id="body" src="/__body_child"></iframe><script type="module">import {relayKernelChannel} from '/src/expressions/hostedApp.ts';import {resolveHostedSource} from '/src/expressions/sourceHandoff.ts';window.openSource=async detail=>window.openedSource=await resolveHostedSource(${JSON.stringify(transport)},detail);window.dispose=relayKernelChannel(document.getElementById('body'),${JSON.stringify(transport)});</script>`);return;}
  if(req.url==='/__body_child'){res.setHeader('Content-Type','text/html');res.end(`<script type="module">import {installKernelExpressions,kernelExpressionsAvailable} from '/expressions-app/field-studies-journeys/src/kernelExpressions.ts';import {prepareNativeSceneBody} from '/expressions-app/field-studies-journeys/src/nativeSceneBody.ts';import {kernelDocumentToJourney} from '/expressions-app/field-studies-journeys/src/kernelDocumentBridge.ts';import {installSceneBodies} from '/expressions-app/field-studies-journeys/src/sceneBodies.ts';installKernelExpressions();let view;window.proof={ready:kernelExpressionsAvailable,prepare:prepareNativeSceneBody,show(doc){view=kernelDocumentToJourney(doc);window.controller??=installSceneBodies({nativeView:()=>view,sceneId:()=>view.journey.scenes[0].id,open:ref=>{void parent.openSource({ref,subject:{ref:view.document.expression_ref,revision:view.document.revision,sceneRef:view.document.selection.scene_ref}});},jumpToScene:sceneRef=>{throw Error('Unexpected navigation to '+sceneRef);}});window.controller.refresh();}};</script>`);return;}
  next();
 });await server.listen();browser=await chromium.launch({headless:true});const page=await browser.newPage();page.on('pageerror',e=>browserErrors.push(String(e)));page.on('console',m=>{if(m.type()==='error')browserErrors.push(m.text());});await page.goto('http://127.0.0.1:'+server.httpServer.address().port+'/__body_parent',{waitUntil:'domcontentloaded',timeout:90000});
 await page.waitForFunction(()=>document.querySelector('iframe')?.contentWindow?.proof?.ready?.(),null,{timeout:90000});
 const frame=page.frames().find(f=>f.url().endsWith('/__body_child'));assert.ok(frame);
 const body=await frame.evaluate(p=>window.proof.prepare('text_source',p),sourcePath);
 assert.ok(body.subject_ref.startsWith('central:'));assert.notEqual(body.reading.revision,'1');assert.equal(body.native_owner,'central');
 const canonical=await frame.evaluate(p=>window.proof.prepare('text_source',p),body.subject_ref);assert.deepEqual(canonical,body);
 const initial=await op({op:'expression',request:{operation:'create',expression_ref:ref,title:'Controlled native scene body',actor:'agent:native-carrier-proof'}});created=true;
 const scene=initial.document.scenes[0].scene_ref;
 const adopted=await op({op:'expression',request:{operation:'edit',expression_ref:ref,expected_revision:initial.document.revision,actor:'agent:native-carrier-proof',changes:[{change:'scene_body_set',scene_ref:scene,body}]}});
 assert.equal(Object.keys(adopted.document.entities).length,0);await frame.evaluate(doc=>window.proof.show(doc),adopted.document);
 await frame.locator('.scene-body-text').waitFor();assert.match(await frame.locator('.scene-body-text').innerText(),/Earth 🜁 water/);
 await frame.getByRole('button',{name:'Open source',exact:true}).click();await page.waitForFunction(()=>window.openedSource?.location,null,{timeout:90000});assert.equal(await page.evaluate(()=>window.openedSource.location.ref),body.subject_ref);
 const {resolveHostedSource}=await server.ssrLoadModule('/src/expressions/sourceHandoff.ts');
 const request={ref:body.subject_ref,subject:{ref,revision:adopted.document.revision,sceneRef:scene}};
 const target=await resolveHostedSource(transport,request);assert.equal(target.location.ref,body.subject_ref);assert.equal(target.returnTo.passageId,scene);
 const changed=await op({op:'file_operation',location:target.location,request:{action:'write',expected_revision:body.reading.revision,content:'# Native source body\n\nThe real owner changed this source.\n'}});assert.ok(['written','unchanged'].includes(changed.outcome));
 await frame.getByRole('button',{name:'Check source',exact:true}).click();await frame.getByText(/scene body source has changed/i).waitFor();
 await assert.rejects(resolveHostedSource(transport,request),/scene body source changed/);
 const refreshed=await frame.evaluate(p=>window.proof.prepare('text_source',p),body.subject_ref);assert.notEqual(refreshed.reading.revision,body.reading.revision);
 const final=await op({op:'expression',request:{operation:'inspect',expression_ref:ref}});assert.deepEqual(final.document,adopted.document,'Source change must not silently adopt or rewrite the authored scene');
 await writeFile(output+'/receipt.json',JSON.stringify({status:'passed',checks:['Actual human path and canonical ref resolve through Central to identical source-qualified body','Native SceneBodySet retains actual revision with zero entity members','Real hosted iframe renders actual Unicode source bytes','Existing source handoff returns same native source and scene','Native source write invalidates old body; no silent scene mutation'],source:target.location,adopted_revision:body.reading.revision,current_revision:refreshed.reading.revision,receipts,limits:['Native source/carrier browser proof, not full Wiki corpus or detached-window acceptance.']},null,2));console.log(output+'/receipt.json');
}catch(error){await writeFile(output+'/failure.json',JSON.stringify({error:String(error),browserErrors,receipts},null,2));throw error;}finally{if(created&&server)await closeControlledExpression(server,world.bridge,ref,output,'Native source carrier proof');if(browser){let timer;try{await Promise.race([browser.close(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Owned browser did not close')),10000);})]);}finally{clearTimeout(timer);}}if(server)await server.close();await rm(output+'/vite-cache',{recursive:true,force:true});}
