#!/usr/bin/env node
/** Actual production app/owned native focus -> ordinary conversation boundary.
 * No configured reply, model call, native mock or new owner process. The caller
 * supplies the same controlled world/current source qualification as the fresh
 * answer gate. Each case runs against its own independently acknowledged native
 * file admission; refused/pending cases must never be reused as a clean case. */
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,readdir,stat,realpath} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
const cfg=JSON.parse(await readFile(process.argv[2],'utf8'));
const hash=b=>createHash('sha256').update(b).digest('hex');
assert.match(cfg.bridge,/^http:\/\/127\.0\.0\.1:\d+$/);assert.match(cfg.app_url,/^http:\/\/127\.0\.0\.1:\d+\//);
assert.equal(resolve(cfg.world),cfg.world);assert.equal(await realpath(cfg.world),cfg.world);
assert.ok(cfg.world.endsWith('/world')&&cfg.world.includes('/T/'),'This refusal gate requires the already qualified controlled T world');
assert.equal(resolve(cfg.output),cfg.output);assert.ok(cfg.output.startsWith(resolve(cfg.world,'..')+'/')&&!cfg.output.startsWith(cfg.world+'/'));
assert.ok(['positive','native-refusal','native-changed','local-changed'].includes(cfg.selection_case));
assert.ok(!('answer' in cfg)&&!('expected_answer' in cfg)&&!('provider' in cfg));
const qstat=await stat(cfg.qualification);assert.ok(qstat.isFile()&&qstat.size<=2*1024*1024);
const qbytes=await readFile(cfg.qualification);assert.equal(hash(qbytes),cfg.qualification_sha256);
const q=JSON.parse(qbytes);assert.equal(q.world,cfg.world);assert.equal(q.expression_ref,cfg.expression_ref);assert.equal(q.identity_source_ref,cfg.identity_source_ref);
assert.equal(q.body_route,'actual-native-default-epi-prime-ql');assert.ok(q.native_process&&q.all_five&&q.frontend&&q.aikit);
await mkdir(cfg.output,{recursive:true});assert.equal((await readdir(cfg.output)).length,0);
const report={schema:'oi.epi-selected-conversation-native-gate/v1',passed:false,selection_case:cfg.selection_case,qualification:{path:cfg.qualification,sha256:cfg.qualification_sha256},checks:[],native:[],requests:[],limitations:['Actual controlled production hook and native HTTP receiving boundary; no provider/model question is sent','A positive selection gate does not qualify full source content, fresh answer, Keep/save/restart or installed/hardware/H','Superseded/invalidated queue outcomes remain separately required actual queue/lifetime cases; this driver does not manufacture these outcomes']};
let browser,page,frame,releaseHeld,captureDOM;
async function responseBytes(response,cap=64*1024*1024){assert.ok(response.ok,'Actual HTTP '+response.status);const reader=response.body.getReader(),parts=[];let size=0;try{for(;;){const r=await reader.read();if(r.done)break;size+=r.value.byteLength;if(size>cap)throw Error('Actual native reply exceeds its receiving bound');parts.push(Buffer.from(r.value));}}catch(e){await reader.cancel();throw e;}finally{reader.releaseLock();}return Buffer.concat(parts);}
async function native(request){const body=JSON.stringify({op:'expression',request});const bytes=await responseBytes(await fetch(cfg.bridge+'/op',{method:'POST',headers:{'Content-Type':'application/json'},body}));const value=JSON.parse(bytes);report.native.push({request,response_bytes:bytes.length,response_sha256:hash(bytes),state:value.outcome?.data?.state,error:value.error??null});assert.equal(value.ok,true,JSON.stringify(value));assert.equal(value.outcome.result,'expression');return value.outcome.data;}
async function inspect(){const v=await native({operation:'inspect',expression_ref:cfg.expression_ref});assert.ok(v.document);return v;}
async function waitCurrent(entityRef){const end=Date.now()+30000;for(;;){const working=await frame.evaluate(()=>window.__FIELD_STUDIES__.nativeWorking()),r=await inspect();if(!working.busy&&!working.pending&&working.revision===r.document.revision&&r.document.selection.entity_ref===entityRef)return r;if(Date.now()>end)throw Error('Original native focus did not become current in30s');await new Promise(r=>setTimeout(r,100));}}
function exactFocusOnly(before,after,sceneRef,entityRef){const expected=structuredClone(before);assert.ok(after.revision===before.revision||after.revision===before.revision+1);expected.revision=after.revision;expected.selection={scene_ref:sceneRef,entity_ref:entityRef};assert.deepEqual(after,expected,'Native focus must preserve complete source/person/occasion/material/body history');}
try{
 browser=await chromium.launch({headless:true});page=await browser.newPage({viewport:{width:1440,height:900}});
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 page.on('request',request=>{if(request.url()!==cfg.bridge+'/op'||request.method()!=='POST')return;const text=request.postData();if(!text||Buffer.byteLength(text)>32*1024*1024)return;try{const v=JSON.parse(text);report.requests.push({op:v.op,operation:v.request?.operation,action:v.request?.action,sha256:hash(text),bytes:Buffer.byteLength(text)});}catch{report.requests.push({unreadable:true});}});
 await page.goto(cfg.app_url);await page.waitForSelector('iframe',{timeout:30000});
 const candidates=page.frames().filter(f=>f.url().includes('field-studies'));assert.equal(candidates.length,1);frame=candidates[0];
 await frame.waitForFunction(()=>!!window.__FIELD_STUDIES__?.nativeWorking(),null,{timeout:30000});
 const original=await inspect(),document=original.document;assert.equal(document.expression_ref,cfg.expression_ref);assert.equal(original.dirty,false);assert.ok(original.file);assert.equal(original.file.location.root,cfg.world);
 const carrier=document.scenes.find(s=>s.presentation?.scene?.epiWorld)?.presentation.scene.epiWorld;assert.ok(carrier);assert.equal(carrier.person_ref,cfg.person_ref);assert.equal(carrier.identity_source.source_ref,cfg.identity_source_ref);
 const target=carrier.receiving.personal.locus_entity_ref;assert.equal(document.entities[target].subject.subject_ref,'ql:m-coordinate:bimba:M4.4.4.4');
 const sceneRef=document.selection.scene_ref,scene=document.scenes.find(s=>s.scene_ref===sceneRef);assert.ok(scene?.entity_refs.includes(target),'Caller must admit the original personal hub Scene');
 const other=scene.entity_refs.find(ref=>ref!==target&&document.entities[ref]?.subject);assert.ok(other);
 const instrument=frame.getByRole('region',{name:'Nara Expression instrument'});assert.equal(await instrument.isVisible(),false,'Conversation must start closed');
 const choose=async ref=>{await frame.locator('[data-epi-body]').selectOption(ref);return waitCurrent(ref);};
 const local=async ref=>{const work=await frame.evaluate(()=>window.__FIELD_STUDIES__.nativeWorking());const entry=Object.entries(work.bindings).find(([,b])=>b.scene_ref===sceneRef);assert.ok(entry);const occurrence=entry[1].occurrences.find(o=>o.entity_ref===ref);assert.ok(occurrence);await frame.evaluate(id=>window.__FIELD_STUDIES__.selectEntity(id),occurrence.view_entity_id);};
 const initial=await choose(cfg.selection_case==='native-changed'?target:other);exactFocusOnly(document,initial.document,sceneRef,cfg.selection_case==='native-changed'?target:other);
 let expected=initial.document;
 if(cfg.selection_case==='native-refusal'||cfg.selection_case==='native-changed'){
  const externallySelected=cfg.selection_case==='native-refusal'?target:other;
  const changed=await native({operation:'edit',expression_ref:cfg.expression_ref,expected_revision:expected.revision,actor:'human:controlled-selection-refusal',changes:[{change:'focus',scene_ref:sceneRef,entity_ref:externallySelected}]});assert.ok(changed.document);exactFocusOnly(expected,changed.document,sceneRef,externallySelected);expected=changed.document;
 }
 await local(target);
 let heldObserved;
 if(cfg.selection_case==='local-changed'){
  let observed;heldObserved=new Promise(resolve=>{observed=resolve;});let release;const released=new Promise(resolve=>{release=resolve;});releaseHeld=release;let claimed=false;
  await page.route(cfg.bridge+'/op',async route=>{
   const raw=route.request().postData();let request;try{request=raw&&JSON.parse(raw);}catch{}
   if(claimed||request?.op!=='expression'||request.request?.operation!=='inspect'||request.request.expression_ref!==cfg.expression_ref){await route.continue();return;}
   claimed=true;const response=await route.fetch();const headers=response.headers(),declared=headers['content-length'];assert.ok(response.ok());assert.match(declared??'',/^(0|[1-9][0-9]*)$/);assert.ok(Number(declared)<=64*1024*1024);
   const bytes=await response.body();assert.equal(bytes.length,Number(declared));const real=JSON.parse(bytes);assert.equal(real.ok,true);assert.equal(real.outcome.data.document.selection.entity_ref,target);
   report.held_actual_inspect={request_sha256:hash(raw),response_sha256:hash(bytes),response_bytes:bytes.length,unchanged_actual_response:true};observed();await released;await route.fulfill({response});
  });
 }
 const refusedExpectedRevision=initial.document.revision,refusedCurrentRevision=expected.revision;
 const actualAppFocusResponses=[];
 if(cfg.selection_case==='native-refusal')page.on('response',response=>{
  const request=response.request();if(request.url()!==cfg.bridge+'/op'||request.method()!=='POST')return;
  const raw=request.postData();if(!raw||Buffer.byteLength(raw)>32*1024*1024)return;
  let sent;try{sent=JSON.parse(raw);}catch{return;}
  const change=sent?.request?.changes?.[0];
  if(sent.op!=='expression'||sent.request?.operation!=='edit'||sent.request.expression_ref!==cfg.expression_ref
    ||sent.request.actor!=='human:expressions-app'||change?.change!=='focus'||change.scene_ref!==sceneRef||change.entity_ref!==target)return;
  const received=(async()=>{
   const ordinal=actualAppFocusResponses.length,requestFile=`app-focus-refusal-${ordinal}.request.json`,responseFile=`app-focus-refusal-${ordinal}.response.json`;
   const record={request_sha256:hash(raw),request_bytes:Buffer.byteLength(raw),request_file:requestFile,response_file:responseFile};
   await writeFile(resolve(cfg.output,requestFile),raw);
   assert.deepEqual(sent,{op:'expression',request:{operation:'edit',expression_ref:cfg.expression_ref,expected_revision:refusedExpectedRevision,actor:'human:expressions-app',changes:[{change:'focus',scene_ref:sceneRef,entity_ref:target}]}},'The refused request must be the actual original app focus on its captured old revision');
   assert.equal(response.ok(),true,'Native CAS refusal is an acknowledged owner protocol result');
   const declared=response.headers()['content-length'];assert.match(declared??'',/^(0|[1-9][0-9]*)$/);assert.ok(Number(declared)<=64*1024,'The actual focus refusal receipt must fit its declared receiving aperture');
   const bytes=await response.body();assert.equal(bytes.length,Number(declared));assert.ok(bytes.length<=64*1024);
   await writeFile(resolve(cfg.output,responseFile),bytes);
   record.response_bytes=bytes.length;record.response_sha256=hash(bytes);
   const value=JSON.parse(bytes);assert.equal(value.ok,true);assert.equal(value.outcome?.result,'expression');
   assert.deepEqual(value.outcome.data,{state:'revision_conflict',expression_ref:cfg.expression_ref,expected_revision:refusedExpectedRevision,current_revision:refusedCurrentRevision},'Only the actual native owner stale-CAS result qualifies this refusal case');
   record.actual_native_result=value.outcome.data;record.unchanged_actual_response=true;return record;
  })().catch(error=>({failure:String(error)}));
  actualAppFocusResponses.push(received);
 });
 const expectedRefusal={
  'native-refusal':'The native owner did not accept this selection. Inspect the retained operation, then select the body again.',
  'native-changed':'The current native selection differs from the selected body. Reopen its current basis before conversation.',
  'local-changed':'The selected body, person or occasion changed before conversation opened. Select the body and try again.',
 }[cfg.selection_case];
 captureDOM=async label=>{
  const actual=await frame.evaluate(()=>{
   const bar=document.querySelector('.epi-world-entrance'),alert=bar?.querySelector('[role="alert"]'),ask=bar?.querySelector('[data-epi="ask"]');
   const visible=!!alert&&alert.getClientRects().length>0&&getComputedStyle(alert).visibility!=='hidden'&&getComputedStyle(alert).display!=='none';
   const work=window.__FIELD_STUDIES__?.nativeWorking();
   return {entrance_text:bar?.textContent??null,alert_text:alert?.textContent??null,alert_visible:visible,ask_disabled:ask?.disabled??null,native_working:{native_ref:work?.native_ref,revision:work?.revision,pending:work?.pending,busy:work?.busy,failed:work?.failed,notice:work?.notice}};
  });
  const bytes=JSON.stringify(actual,null,2)+'\n';assert.ok(Buffer.byteLength(bytes)<=64*1024,'Raw controlled refusal DOM must fit its evidence bound');
  const file=label+'.dom.json';await writeFile(resolve(cfg.output,file),bytes);return{...actual,file,bytes:Buffer.byteLength(bytes),sha256:hash(bytes)};
 };
 report.before_ask_dom=await captureDOM('before-ask');
 if(expectedRefusal)assert.ok(!report.before_ask_dom.alert_visible||report.before_ask_dom.alert_text!==expectedRefusal,'The expected new refusal must not already be visible before Ask');
 assert.equal(report.before_ask_dom.ask_disabled,false,'Ordinary Ask must be available before this operation starts');
 assert.equal(report.before_ask_dom.native_working.busy,false,'Original native selection must be terminal before Ask starts');
 assert.equal(await instrument.isVisible(),false,'Conversation must still be closed immediately before Ask');
 const requestStart=report.requests.length;await frame.locator('[data-epi="ask"]').click();
 if(heldObserved){let timer;try{await Promise.race([heldObserved,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('The original current native inspect was not held in30s')),30000);})]);}finally{clearTimeout(timer);}await local(other);releaseHeld();releaseHeld=null;}
 if(cfg.selection_case==='positive'){
  await instrument.waitFor({state:'visible',timeout:30000});const after=await inspect();exactFocusOnly(expected,after.document,sceneRef,target);assert.equal(after.document.selection.relation_ref,undefined);report.checks.push('Actual ordinary With Nara/Epii opened only on exact acknowledged local/native personal hub focus');
 }else{
  await frame.waitForFunction(message=>{
   const bar=document.querySelector('.epi-world-entrance'),alert=bar?.querySelector('[role="alert"]'),ask=bar?.querySelector('[data-epi="ask"]');
   const work=window.__FIELD_STUDIES__?.nativeWorking();
   return !!alert&&alert.textContent===message&&alert.getClientRects().length>0&&getComputedStyle(alert).visibility!=='hidden'
    &&getComputedStyle(alert).display!=='none'&&!!ask&&!ask.disabled&&work?.busy===false;
  },expectedRefusal,{timeout:30000});
  report.terminal_refusal_dom=await captureDOM('terminal-refusal');
  assert.equal(report.terminal_refusal_dom.alert_text,expectedRefusal);
  assert.equal(report.terminal_refusal_dom.ask_disabled,false);
  assert.equal(report.terminal_refusal_dom.native_working.busy,false);
  assert.equal(await instrument.isVisible(),false,'Refused or changed basis must leave ordinary conversation unopened');
  const after=await inspect();
  if(cfg.selection_case==='local-changed')exactFocusOnly(expected,after.document,sceneRef,target);else assert.deepEqual(after.document,expected);
  const work=await frame.evaluate(()=>window.__FIELD_STUDIES__.nativeWorking());if(cfg.selection_case==='native-refusal'){
   assert.equal(work.pending,'selection','Original native refusal must retain pending focus evidence');
   assert.equal(actualAppFocusResponses.length,1,'One unchanged actual app focus reply must prove native stale-CAS refusal');
   report.actual_app_focus_refusal=await actualAppFocusResponses[0];
   assert.ok(!report.actual_app_focus_refusal.failure,report.actual_app_focus_refusal.failure);
  }
  report.after_conservation_dom=await captureDOM('after-native-conservation');
  assert.equal(report.after_conservation_dom.alert_text,expectedRefusal,'The exact newly completed app refusal must remain current after native response and conservation checks');
  assert.equal(report.after_conservation_dom.ask_disabled,false);
  assert.equal(report.after_conservation_dom.native_working.busy,false);
  assert.equal(await instrument.isVisible(),false,'Conversation must remain unopened after actual native reply, pending focus and complete-document conservation');
  report.checks.push('Actual '+cfg.selection_case+' preserved native source/person/occasion/material and refused ordinary conversation');
 }
 assert.ok(!report.requests.slice(requestStart).some(v=>(v.op==='encounter'&&['prompt','draft'].includes(v.action))||['send','epii_delegate'].includes(v.operation)),'Selection qualification must not send a model question');assert.deepEqual(errors,[]);report.passed=true;
}catch(error){report.failure=String(error);if(captureDOM)try{report.failed_current_dom=await captureDOM('failed-current');}catch(diagnostic){report.failed_dom_diagnostic_error=String(diagnostic);}throw error;}finally{
 releaseHeld?.();if(frame)try{await frame.locator('#nara-instrument').press('Escape');}catch{}if(browser)await browser.close();await writeFile(resolve(cfg.output,'receipt.json'),JSON.stringify(report,null,2)+'\n');
}
