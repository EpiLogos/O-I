#!/usr/bin/env node
/** Actual production app/owned native focus -> ordinary conversation boundary.
 * No configured reply, model call, native mock or new owner process. The caller
 * supplies the same controlled world/current source qualification as the fresh
 * answer gate. Each case runs against its own independently acknowledged native
 * file admission; refused/pending cases must never be reused as a clean case. */
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,readdir,stat,realpath,lstat,open} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
import {qualifyPortableNativeSourceExpectation,requalifyPortableCurrentCustody} from './epi-world-portable-custody.mjs';
const cfg=JSON.parse(await readFile(process.argv[2],'utf8'));
const selectionOnly=cfg.qualification_mode==='source-built-hosted-selection-only';
assert.ok(cfg.qualification_mode===undefined||selectionOnly,'Unknown selection qualification mode');
const hash=b=>createHash('sha256').update(b).digest('hex');
assert.match(cfg.bridge,/^http:\/\/127\.0\.0\.1:\d+$/);assert.match(cfg.app_url,/^http:\/\/127\.0\.0\.1:\d+\//);
assert.equal(resolve(cfg.world),cfg.world);assert.equal(await realpath(cfg.world),cfg.world);
if(selectionOnly){
 const allowed=[process.env.RUNNER_TEMP,process.env.TMPDIR,'/tmp'].filter(Boolean).map(value=>resolve(value));
 assert.ok(cfg.world.endsWith('/world')&&allowed.some(root=>cfg.world.startsWith(root+'/')),'Hosted selection requires the actual owned temporary world');
}else assert.ok(cfg.world.endsWith('/world')&&cfg.world.includes('/T/'),'This refusal gate requires the already qualified controlled T world');
assert.equal(resolve(cfg.output),cfg.output);assert.ok(cfg.output.startsWith(resolve(cfg.world,'..')+'/')&&!cfg.output.startsWith(cfg.world+'/'));
assert.ok(['positive','native-refusal','native-changed','local-changed'].includes(cfg.selection_case));
assert.ok(!('answer' in cfg)&&!('expected_answer' in cfg)&&!('provider' in cfg));
const qstat=await stat(cfg.qualification);assert.ok(qstat.isFile()&&qstat.size<=2*1024*1024);
const qbytes=await readFile(cfg.qualification);assert.equal(hash(qbytes),cfg.qualification_sha256);
const q=JSON.parse(qbytes);assert.equal(q.world,cfg.world);assert.equal(q.expression_ref,cfg.expression_ref);assert.equal(q.identity_source_ref,cfg.identity_source_ref);
if(selectionOnly){
 assert.equal(q.schema,'oi.epi-selected-conversation-source-built-hosted/v1');
 assert.equal(q.scope,'selection-only-no-provider');assert.ok(!('body_route' in q)&&!('provider' in q)&&!('answer' in q));
 assert.equal(q.owned_output_root,resolve(cfg.world,'..'));assert.equal(q.native_process.url,cfg.bridge);
 assert.equal(q.frontend.actual_parent_url,cfg.app_url);assert.equal(q.frontend.application_path,'/__epi_application');
 assert.equal(q.frontend.iframe_id,'world');assert.equal(q.frontend.receiver_path,'/__epi_host_receiver');
 for(const role of ['oi','ql','central','aikit']){
  const row=q.source_cuts[role];assert.match(row.cut,/^[0-9a-f]{40}$/);assert.match(row.tree,/^[0-9a-f]{40}$/);assert.equal(row.tracked_source_dirty,false);
  assert.equal(execFileSync('git',['-C',row.root,'rev-parse','HEAD'],{encoding:'utf8',timeout:30000,maxBuffer:65536}).trim(),row.cut);
  assert.equal(execFileSync('git',['-C',row.root,'rev-parse','HEAD^{tree}'],{encoding:'utf8',timeout:30000,maxBuffer:65536}).trim(),row.tree);
  assert.equal(execFileSync('git',['-C',row.root,'status','--porcelain','--untracked-files=no'],{encoding:'utf8',timeout:30000,maxBuffer:65536}).trim(),'');
 }
 assert.ok(q.native_process&&q.all_five&&q.frontend&&q.aikit&&q.admission_ref&&q.identity_ref);
}else {assert.equal(q.body_route,'actual-native-default-epi-prime-ql');assert.ok(q.native_process&&q.all_five&&q.frontend&&q.aikit);}
await mkdir(cfg.output,{recursive:true});assert.equal((await readdir(cfg.output)).length,0);
const report={schema:'oi.epi-selected-conversation-native-gate/v1',passed:false,selection_case:cfg.selection_case,qualification:{path:cfg.qualification,sha256:cfg.qualification_sha256},checks:[],native:[],requests:[],limitations:['Actual controlled production hook and native HTTP receiving boundary; no provider/model question is sent','A positive selection gate does not qualify full source content, fresh answer, Keep/save/restart or installed/hardware/H','Superseded/invalidated queue outcomes remain separately required actual queue/lifetime cases; this driver does not manufacture these outcomes']};
let browser,page,frame,releaseHeld,captureDOM;
async function responseBytes(response,cap=64*1024*1024){assert.ok(response.ok,'Actual HTTP '+response.status);const reader=response.body.getReader(),parts=[];let size=0;try{for(;;){const r=await reader.read();if(r.done)break;size+=r.value.byteLength;if(size>cap)throw Error('Actual native reply exceeds its receiving bound');parts.push(Buffer.from(r.value));}}catch(e){await reader.cancel();throw e;}finally{reader.releaseLock();}return Buffer.concat(parts);}
async function native(request){const body=JSON.stringify({op:'expression',request});const bytes=await responseBytes(await fetch(cfg.bridge+'/op',{method:'POST',headers:{'Content-Type':'application/json'},body}));const value=JSON.parse(bytes);report.native.push({request,response_bytes:bytes.length,response_sha256:hash(bytes),state:value.outcome?.data?.state,error:value.error??null});assert.equal(value.ok,true,JSON.stringify(value));assert.equal(value.outcome.result,'expression');return value.outcome.data;}
async function inspect(){const v=await native({operation:'inspect',expression_ref:cfg.expression_ref});assert.ok(v.document);return v;}
// This mode qualifies actual source-built receiving, not a body/provider offer.
async function qualifiedFile(ref,label,cap=1024*1024*1024){
 assert.equal(resolve(ref.path),ref.path,label+': absolute qualified path');assert.match(ref.sha256,/^[0-9a-f]{64}$/);
 const info=await lstat(ref.path);assert.ok(info.isFile()&&!info.isSymbolicLink()&&info.size===ref.bytes&&info.size<=cap,label+': bounded regular bytes');
 const fd=await open(ref.path,'r'),digest=createHash('sha256'),buffer=Buffer.alloc(1024*1024);let bytes=0;
 try{for(;;){const part=await fd.read(buffer,0,buffer.length,null);if(part.bytesRead===0)break;bytes+=part.bytesRead;assert.ok(bytes<=cap);digest.update(buffer.subarray(0,part.bytesRead));}}finally{await fd.close();}
 assert.equal(bytes,ref.bytes);assert.equal(digest.digest('hex'),ref.sha256,label+': exact actual qualified bytes');return ref;
}
async function qualifiedJSON(ref,label,cap=24*1024*1024){await qualifiedFile(ref,label,cap);return JSON.parse(await readFile(ref.path,'utf8'));}
async function qualifyHostedOwner(){
 const process=q.native_process;assert.ok(Number.isSafeInteger(process.pid)&&process.pid>0);assert.ok(Number.isSafeInteger(process.starttime)&&process.starttime>0);
 const statBytes=await readFile(`/proc/${process.pid}/stat`,'utf8'),tail=statBytes.slice(statBytes.lastIndexOf(')')+1).trim().split(/\s+/);
 assert.equal(Number(tail[19]),process.starttime,'Exact owned native PID lifetime');assert.notEqual(tail[0],'Z');
 const loaded=await realpath(`/proc/${process.pid}/exe`);assert.equal(loaded,process.bridge.path,'Actual current bridge process image');
 await qualifiedFile(process.bridge,'Actual owned bridge');
 const image=await open(`/proc/${process.pid}/exe`,'r'),digest=createHash('sha256'),chunk=Buffer.alloc(1024*1024);let count=0;try{for(;;){const r=await image.read(chunk,0,chunk.length,null);if(!r.bytesRead)break;count+=r.bytesRead;assert.ok(count<=1024*1024*1024);digest.update(chunk.subarray(0,r.bytesRead));}}finally{await image.close();}assert.equal(count,process.bridge.bytes);assert.equal(digest.digest('hex'),process.bridge.sha256);
 const replay=JSON.parse(await responseBytes(await fetch(cfg.bridge+'/event-replay?cursor=1&limit=1'),2*1024*1024));
 assert.equal(replay.replay.schema,'oi.kernel-event-replay/v1');assert.equal(replay.replay.generation,process.native_generation);
 hostedSourceExpectation=await qualifiedJSON(q.native_source_expectation_ref,'Exact original/current portable native source expectation',4*1024*1024);
 await qualifiedFile(q.original_world_ref,'Exact independently qualified historical original world',24*1024*1024);
 assert.deepEqual(hostedSourceExpectation.current_custody.manifest_ref,q.all_five,'Exact current source-built manifest used by the existing original portable verifier');
 hostedSourceQualification=qualifyPortableNativeSourceExpectation(hostedSourceExpectation,{originalWorldFile:q.original_world_ref.path,currentCut:q.source_cuts.ql.cut});
 const manifest=await qualifiedJSON(q.all_five,'Actual source-built all-five manifest');assert.equal(manifest.schema,'epi.source-built-hosted-native-cut/v1');
 assert.equal(manifest.custody,'source-built-hosted');assert.equal(manifest.source_cut,q.source_cuts.ql.cut);assert.equal(manifest.tree,q.source_cuts.ql.tree);
 assert.deepEqual(manifest.all_five.map(row=>row.name),['ql','ql-field-host','ql-field-worker','ql-focused-host','ql-sky']);
 for(const ref of manifest.all_five)await qualifiedFile(ref,'Actual installer '+ref.name,256*1024*1024);
 assert.equal(manifest.installer.output_root,resolve(manifest.installer.environment.CARGO_TARGET_DIR,'release'));
 assert.equal(manifest.installer.exit,0);assert.equal(manifest.installer.output_directory_was_absent,true);
 for(const ref of manifest.all_five)assert.equal(ref.path,resolve(manifest.installer.output_root,ref.name));
 await qualifiedFile(q.aikit,'Actual AIKit context image');assert.equal(q.aikit.path,q.host_owners.aikit.path);
 for(const [role,ref] of Object.entries(q.host_owners))await qualifiedFile(ref,'Actual source-built '+role);
 const buildInputs={
  'oi-cli-build':{owner:'oi',source:'oi',output:'oi-cli/debug/oi',argv:['cargo','build','--locked','--manifest-path',resolve(q.source_cuts.oi.root,'cli/Cargo.toml'),'--bin','oi']},
  'oi-kernel-build':{owner:'bridge',source:'oi',output:'oi-kernel/debug/walk-bridge',argv:['cargo','build','--locked','--manifest-path',resolve(q.source_cuts.oi.root,'desktop/cradle/kernel/Cargo.toml'),'--bin','walk-bridge']},
  'central-build':{owner:'central',source:'central',output:'central/debug/ctrl',argv:['cargo','build','--locked','--manifest-path',resolve(q.source_cuts.central.root,'Cargo.toml'),'-p','ctrl']},
  'aikit-build':{owner:'aikit',source:'aikit',output:'aikit/debug/aikit',argv:['cargo','build','--locked','--manifest-path',resolve(q.source_cuts.aikit.root,'Cargo.toml'),'--bin','aikit']},
 };
 assert.deepEqual(q.host_build_operations.map(row=>row.name),Object.keys(buildInputs));
 for(const operation of q.host_build_operations){const expected=buildInputs[operation.name];assert.deepEqual(operation.argv,expected.argv);assert.equal(operation.cwd,q.source_cuts[expected.source].root);assert.equal(operation.exit,0);
  assert.equal(q.host_owners[expected.owner].path,resolve(q.owned_output_root,'build',expected.output));await qualifiedFile(operation.stdout_ref,'Actual owner build stdout',32*1024*1024);await qualifiedFile(operation.stderr_ref,'Actual owner build stderr',32*1024*1024);
 }

 for(const row of q.oi_sources){
  assert.equal(row.cut,q.source_cuts.oi.cut);assert.equal(row.working_bytes_equal_cut,true);
  assert.equal(row.physical_path,resolve(q.source_cuts.oi.root,row.path));await qualifiedFile({...row,path:row.physical_path},'Actual source '+row.path,64*1024*1024);
  assert.equal(execFileSync('git',['-C',q.source_cuts.oi.root,'rev-parse',row.cut+':'+row.path],{encoding:'utf8',timeout:30000,maxBuffer:65536}).trim(),
   execFileSync('git',['-C',q.source_cuts.oi.root,'hash-object',row.physical_path],{encoding:'utf8',timeout:30000,maxBuffer:65536}).trim());
 }
 for(const [path,sha256] of Object.entries(q.frontend.host.inputs))await qualifiedFile({path,sha256,bytes:(await stat(path)).size},'Actual receiver source',64*1024*1024);
 for(const [role,ref] of [['application',q.frontend.application],['host',q.frontend.host]])await qualifiedFile({...ref,path:ref.path??ref.file},'Actual emitted '+role,64*1024*1024);
 const origin=new URL(cfg.app_url).origin;
 for(const [path,ref] of [['/__epi_application',q.frontend.application],['/__epi_host_receiver',q.frontend.host]]){
  const bytes=await responseBytes(await fetch(origin+path),64*1024*1024);assert.equal(bytes.length,ref.bytes);assert.equal(hash(bytes),ref.sha256,'Actual served emitted '+path);
 }
 report.hosted_owner_qualification={pid:process.pid,starttime:process.starttime,native_generation:process.native_generation,loaded_image:{path:loaded,sha256:process.bridge.sha256},source_cuts:q.source_cuts,scope:'Actual bridge/context/source/receiver custody; no constituted body or provider readiness'};
}
let hostedAdmission,hostedSourceQualification,hostedSourceExpectation;
async function qualifyHostedAdmission(document){
 hostedAdmission=await qualifiedJSON(q.admission_ref,'Independently acknowledged setup full Document');assert.equal(hostedAdmission.schema,'epi.hosted-native-selected-admission/v1');
 assert.deepEqual(document,hostedAdmission.document,'This case must start from the independently acknowledged complete ordinary-admission Document');
 assert.equal(hostedAdmission.file.location.root,cfg.world);assert.equal(hostedAdmission.expression_ref,cfg.expression_ref);
 const identity=await qualifiedJSON(q.identity_ref,'Actual controlled identity native save/open');assert.equal(identity.source.source_ref,cfg.identity_source_ref);assert.equal(identity.reading.person_ref,cfg.person_ref);
 await qualifyHostedDurable('before case');
}
async function qualifyHostedDurable(label){
 const expected=hostedAdmission;
 const decoded=await native({operation:'inspect_file',location:expected.file.location,expected_file_revision:expected.file.revision});
 assert.equal(decoded.state,'ready');assert.deepEqual(decoded.file,expected.file);assert.deepEqual(decoded.document,expected.document,label+': every durable body/property/source/history remains exact');
 const bytes=await responseBytes(await fetch(cfg.bridge+'/op',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({op:'file_read',location:expected.file.location})}),24*1024*1024);
 const result=JSON.parse(bytes);assert.equal(result.ok,true);assert.equal(result.outcome.result,'file_read');const reading=result.outcome.reading;
 assert.deepEqual({location:reading.location,revision:reading.revision},expected.file);assert.equal(Buffer.byteLength(reading.content),expected.content_bytes);assert.equal(hash(reading.content),expected.content_sha256);
 const physical=resolve(cfg.world,expected.file.location.path);assert.ok(physical.startsWith(cfg.world+'/'));assert.ok(expected.file.location.path.split('/').every(part=>part!=='.'&&part!=='..'));
 await qualifiedFile({path:physical,bytes:expected.content_bytes,sha256:expected.content_sha256},label+': durable actual file',24*1024*1024);
 (report.durable_conservation??=[]).push({label,file:expected.file,document_revision:expected.document.revision,content_sha256:expected.content_sha256,actual_native_file_reply_sha256:hash(bytes)});
}

async function waitCurrent(entityRef){const end=Date.now()+30000;for(;;){const working=await frame.evaluate(()=>window.__FIELD_STUDIES__.nativeWorking()),r=await inspect();if(!working.busy&&!working.pending&&working.revision===r.document.revision&&r.document.selection.entity_ref===entityRef)return r;if(Date.now()>end)throw Error('Original native focus did not become current in30s');await new Promise(r=>setTimeout(r,100));}}
function exactFocusOnly(before,after,sceneRef,entityRef){const expected=structuredClone(before);assert.ok(after.revision===before.revision||after.revision===before.revision+1);expected.revision=after.revision;expected.selection={scene_ref:sceneRef,entity_ref:entityRef};assert.deepEqual(after,expected,'Native focus must preserve complete source/person/occasion/material/body history');}
try{
 if(selectionOnly)await qualifyHostedOwner();
 browser=selectionOnly?await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']}):await chromium.launch({headless:true});page=selectionOnly?await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'reduce'}):await browser.newPage({viewport:{width:1440,height:900}});
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 page.on('request',request=>{if(request.url()!==cfg.bridge+'/op'||request.method()!=='POST')return;const text=request.postData();if(!text||Buffer.byteLength(text)>32*1024*1024)return;try{const v=JSON.parse(text);report.requests.push({op:v.op,operation:v.request?.operation,action:v.request?.action,sha256:hash(text),bytes:Buffer.byteLength(text)});}catch{report.requests.push({unreadable:true});}});
 await page.goto(cfg.app_url);await page.waitForSelector('iframe',{timeout:30000});
 if(selectionOnly){
  const host=page.locator('#world');assert.equal(await host.count(),1);
  await page.waitForFunction(()=>document.querySelector('#world')?.getAttribute('src')?.startsWith('/__epi_application'),null,{timeout:30000});
  frame=await host.elementHandle().then(element=>element.contentFrame());assert.ok(frame);
  assert.equal(new URL(frame.url()).pathname,q.frontend.application_path);assert.equal(new URL(frame.url()).origin,new URL(cfg.app_url).origin);
  assert.equal(new URL(frame.url()).searchParams.get('expression'),cfg.expression_ref,'Actual production host must admit this exact instance');
 }else {const candidates=page.frames().filter(f=>f.url().includes('field-studies'));assert.equal(candidates.length,1);frame=candidates[0];}
 await frame.waitForFunction(()=>!!window.__FIELD_STUDIES__?.nativeWorking(),null,{timeout:30000});
 if(selectionOnly)await frame.waitForFunction(basis=>{
  const f=window.__FIELD_STUDIES__,w=f?.nativeWorking(),r=f?.epiWorld(),c=f?.epiCurrent();
  return w?.native_ref===basis.expression_ref&&!w.busy&&!w.pending&&!w.failed&&w.file?.location?.root===basis.world
   &&r?.world?.instance_ref===basis.expression_ref&&r.person_ref===basis.person_ref&&r.identity_source?.source_ref===basis.identity_source_ref
   &&r.world.event_ref===basis.event_ref&&c?.reading?.identity?.person_ref===basis.person_ref&&c.context?.event_ref===basis.event_ref;
 },{expression_ref:cfg.expression_ref,person_ref:cfg.person_ref,identity_source_ref:cfg.identity_source_ref,world:cfg.world,event_ref:q.event_ref},{timeout:30000});
 const original=await inspect(),document=original.document;assert.equal(document.expression_ref,cfg.expression_ref);assert.equal(original.dirty,false);assert.ok(original.file);assert.equal(original.file.location.root,cfg.world);
 const carrier=document.scenes.find(s=>s.presentation?.scene?.epiWorld)?.presentation.scene.epiWorld;assert.ok(carrier);assert.equal(carrier.person_ref,cfg.person_ref);assert.equal(carrier.identity_source.source_ref,cfg.identity_source_ref);
 if(selectionOnly){assert.equal(carrier.person_ref,q.person_ref);assert.equal(carrier.world.event_ref,q.event_ref);assert.equal(carrier.world.snapshot_ref,q.snapshot_ref);assert.equal(carrier.world.instance_ref,q.instance_ref);await qualifyHostedAdmission(document);}
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
 assert.ok(!report.requests.slice(requestStart).some(v=>(v.op==='encounter'&&['prompt','draft'].includes(v.action))||['send','epii_delegate'].includes(v.operation)),'Selection qualification must not send a model question');assert.deepEqual(errors,[]);if(selectionOnly){await qualifyHostedDurable('after actual selection outcome');await qualifyHostedOwner();report.portable_custody_after=requalifyPortableCurrentCustody(hostedSourceExpectation,hostedSourceQualification);}report.passed=true;
}catch(error){report.failure=String(error);if(captureDOM)try{report.failed_current_dom=await captureDOM('failed-current');}catch(diagnostic){report.failed_dom_diagnostic_error=String(diagnostic);}throw error;}finally{
 releaseHeld?.();if(frame)try{await frame.locator('#nara-instrument').press('Escape');}catch{}if(browser)await browser.close();await writeFile(resolve(cfg.output,'receipt.json'),JSON.stringify(report,null,2)+'\n');
}
