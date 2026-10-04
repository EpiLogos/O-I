#!/usr/bin/env node
/** Actual production app/owned native focus -> ordinary conversation boundary.
 * No configured reply, model call, native mock or new owner process. The caller
 * supplies the same controlled world/current source qualification as the fresh
 * answer gate. Each case runs against its own independently acknowledged native
 * file admission; refused/pending cases must never be reused as a clean case. */
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {createEpiFirstRestReceivingGate} from './epi-first-rest-receiving.mjs';
import {readFile,writeFile,mkdir,readdir,stat,realpath,lstat,open} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
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
const navigationCases=['navigation-choose-positive','navigation-return-positive','navigation-native-refusal','navigation-local-changed'];
const navigationCase=navigationCases.includes(cfg.selection_case);
// Test-only correlation travels in the bridge URL, never in the native op.
// walk-bridge dispatches POST /op after stripping its query. The real relay
// reaches fetch synchronously in the same actual iframe message dispatch.
const navigationNonce=randomUUID();
function navigationRequestId(url){
 let actual;try{actual=new URL(url);}catch{return null;}
 if(actual.origin!==cfg.bridge||actual.pathname!=='/op'||actual.hash||actual.searchParams.size!==3
  ||actual.searchParams.get('epi_observation')!==navigationNonce||actual.searchParams.get('kind')!=='kernel-expression')return null;
 const raw=actual.searchParams.get('req');if(!/^[1-9][0-9]*$/.test(raw??''))return null;
 const req=Number(raw);return Number.isSafeInteger(req)?req:null;
}
const observedOpURL=url=>url===cfg.bridge+'/op'||navigationCase&&navigationRequestId(url)!==null;
async function observeNavigationTransport(){
 // The application borrows only actual replies for the expected request IDs.
 // No reply, value, status or callback is manufactured or substituted.
 await frame.evaluate(()=>{
  const expected=new Set(),received=[],replies=new Map(),failures=[];let bytes=0;
  const fail=error=>{if(failures.length<8)failures.push(String(error).slice(0,2048));};
  const listener=event=>{
   const d=event.data;if(event.source!==window.parent||!d||d.v!==1||d.kind!=='kernel-expression-result'||!expected.has(d.req))return;
   try{
    if(received.some(row=>row.req===d.req))throw Error('A navigation request received duplicate actual acknowledgements');
    const raw=JSON.stringify(d),size=new TextEncoder().encode(raw).length;
    if(received.length>=32||size>64*1024*1024||bytes+size>64*1024*1024)throw Error('Actual navigation ACK observation exceeds its existing64MiB receiving aperture');
    replies.set(d.req,raw);received.push({req:d.req,at:Date.now(),bytes:size});bytes+=size;
   }catch(error){fail(error);}
  };
  window.addEventListener('message',listener,true);
  window.__EPI_NAVIGATION_ACK_OBSERVER__={
   expect(req){if(!Number.isSafeInteger(req)||req<1||expected.size>=32||expected.has(req))throw Error('Invalid or duplicate actual navigation request ID');expected.add(req);},
   take(req){const raw=replies.get(req);if(raw===undefined)throw Error('The application has not received this exact navigation ACK');replies.delete(req);bytes-=new TextEncoder().encode(raw).length;return raw;},
   snapshot(){return {expected:[...expected],received:received.map(row=>({...row})),failures:[...failures]};},
   stop(){window.removeEventListener('message',listener,true);replies.clear();bytes=0;}
  };
 });
 await page.evaluate(({bridge,expressionRef,nonce})=>{
  const baseFetch=window.fetch,requests=[],failures=[];let dispatch=null;
  const fail=error=>{if(failures.length<8)failures.push(String(error).slice(0,2048));};
  const exactInspect=request=>request&&typeof request==='object'&&Object.keys(request).sort().join(',')==='expression_ref,operation'
   &&request.operation==='inspect'&&request.expression_ref===expressionRef;
  const invoke=(event,run)=>{
   const world=document.querySelector('#world'),d=event.data;
   if(event.source!==world?.contentWindow||!d||d.v!==1||d.kind!=='kernel-expression'||!Number.isSafeInteger(d.req)||d.req<1||!exactInspect(d.request))return run();
   if(requests.length>=32||dispatch||requests.some(row=>row.req===d.req)){fail('Ambiguous or excessive actual navigation dispatch');return run();}
   const row={kind:d.kind,req:d.req,at:Date.now(),url:null};requests.push(row);dispatch={row};
   try{world.contentWindow.__EPI_NAVIGATION_ACK_OBSERVER__.expect(d.req);}catch(error){fail(error);}
   try{return run();}finally{if(dispatch?.row===row){dispatch=null;fail('Actual kernel relay did not synchronously issue its qualified bridge fetch');}}
  };
  // Bracket the registered real owner instead of relying on DOM listener
  // ordering/currentTarget lifetime. No later/background read may be tagged.
  window.__EPI_NAVIGATION_RELAY_INVOCATION__=invoke;
  const observedFetch=function(input,init){
   if(dispatch&&input===bridge+'/op'&&init?.method==='POST'&&typeof init.body==='string'){
    let op;try{op=JSON.parse(init.body);}catch{}
    if(op&&Object.keys(op).sort().join(',')==='op,request'&&op.op==='expression'&&exactInspect(op.request)){
     const row=dispatch.row;dispatch=null;
     const url=new URL(input);url.searchParams.set('epi_observation',nonce);url.searchParams.set('kind',row.kind);url.searchParams.set('req',String(row.req));row.url=url.href;
     // Same options, body, signal and real Response; only the inert URL query differs.
     return Reflect.apply(baseFetch,this,[row.url,init]);
    }
   }
   return Reflect.apply(baseFetch,this,[input,init]);
  };
  window.fetch=observedFetch;
  window.__EPI_NAVIGATION_REQUEST_OBSERVER__={
   snapshot(){return {requests:requests.map(row=>({...row})),failures:[...failures]};},
   stop(){if(window.__EPI_NAVIGATION_RELAY_INVOCATION__===invoke)delete window.__EPI_NAVIGATION_RELAY_INVOCATION__;if(window.fetch!==observedFetch)throw Error('Navigation fetch observer was replaced');window.fetch=baseFetch;dispatch=null;}
  };
 },{bridge:cfg.bridge,expressionRef:cfg.expression_ref,nonce:navigationNonce});
}

assert.ok(['positive','native-refusal','native-changed','local-changed','required-cosmic-body-disabled',...navigationCases].includes(cfg.selection_case));
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
// Failure-only observations do not read another native body, mutate admission,
// or extend the original cold receiving deadline. HTTP status is not native ACK.
let collectingInitialWitness=selectionOnly;
let initialArrivalWaitStartedAt=null,initialArrivalWaitFailedAt=null;
const initialRequestTimes=new WeakMap(),initialReplies=[],initialPageErrors=[];
let initialReplyBytes=0,initialReplyDrops=0,initialPageErrorDrops=0;
const shortError=value=>String(value).slice(0,2048);
const shortTag=value=>typeof value==='string'?value.slice(0,128):null;
function recordInitialReply(row){
 if(!collectingInitialWitness)return;
 const size=Buffer.byteLength(JSON.stringify(row));initialReplies.push(row);initialReplyBytes+=size;
 while(initialReplies.length>128||initialReplyBytes>24*1024){initialReplyBytes-=Buffer.byteLength(JSON.stringify(initialReplies.shift()));initialReplyDrops++;}
}

// Passive phase observations are retained only when the original arrival
// fails. The app/host still own every request, reply and admission decision.
const initialCriticalRequests=[],initialCriticalByRequest=new WeakMap();let initialCriticalDrops=0;
function observeInitialCriticalRequest(request,value,metadata,text){
 if(!collectingInitialWitness||!(value.op==='nara_current'||value.op==='expression'&&['save','save_as'].includes(value.request?.operation)||value.op==='expression_recovery'&&value.request?.operation==='write'))return;
 const row={ordinal:metadata.ordinal,op:shortTag(value.op),operation:shortTag(value.request?.operation),
  issued_at:metadata.started,request_bytes:Buffer.byteLength(text),request_sha256:hash(text),
  binding:{expression_ref:shortTag(value.request?.binding?.expression_ref),person_ref:shortTag(value.request?.binding?.person_ref),
   nara_ref:shortTag(value.request?.binding?.nara_ref),role:shortTag(value.request?.binding?.role)},
  expression_ref:shortTag(value.request?.expression_ref),expected_revision:Number.isSafeInteger(value.request?.expected_revision)?value.request.expected_revision:null,
  file_location:{ref:shortTag(value.request?.location?.ref),root:typeof value.request?.location?.root==='string'?value.request.location.root.slice(0,512):null,path:typeof value.request?.location?.path==='string'?value.request.location.path.slice(0,512):null},
  expected_file_revision:typeof value.request?.expected_file_revision==='string'?value.request.expected_file_revision.slice(0,512):null,response:null};
 initialCriticalRequests.push(row);while(initialCriticalRequests.length>16){initialCriticalRequests.shift();initialCriticalDrops++;}initialCriticalByRequest.set(request,row);
}
function installInitialChannelPhaseObserver(){
 const rows=[];let bytes=0,dropped=0;
 const tag=value=>typeof value==='string'?value.slice(0,512):null;
 const add=row=>{const size=new TextEncoder().encode(JSON.stringify(row)).length;rows.push(row);bytes+=size;
  while(rows.length>32||bytes>8192){bytes-=new TextEncoder().encode(JSON.stringify(rows.shift())).length;dropped++;}};
 Object.defineProperty(window,'__EPI_INITIAL_CHANNEL_PHASES__',{value:()=>({captured_at:Date.now(),rows:rows.map(row=>({...row})),dropped}),configurable:false});
 window.addEventListener('message',event=>{
  const d=event.data;if(!d||typeof d!=='object'||d.v!==1)return;
  const fromParent=window.parent!==window&&event.source===window.parent;
  const fromWorld=window.parent===window&&event.source===document.querySelector('#world')?.contentWindow;
  if(!fromParent&&!fromWorld)return;
  const base={at:Date.now(),monotonic_ms:performance.now(),side:fromParent?'application':'host',kind:tag(d.kind)};
  if(fromWorld&&d.kind==='nara-instrument'&&Number.isSafeInteger(d.req)&&d.req>0&&['identity','read'].includes(d.request?.operation)){
   add({...base,phase:'identity-or-conversation-request-received-by-host',req:d.req,operation:d.request.operation,
    identity_operation:tag(d.request.request?.operation),expression_ref:tag(d.request.basis?.expression_ref),
    source_ref:tag(d.request.request?.source_ref??d.request.basis?.source?.source_ref),source_revision:tag(d.request.basis?.source?.revision)});
  }else if(fromWorld&&d.kind==='nara-instrument'&&Number.isSafeInteger(d.req)&&d.req>0&&
   ['select_identity','release_identity','current_restore','current_read','current_pin'].includes(d.request?.operation)){
   add({...base,phase:'request-received-by-host',req:d.req,operation:d.request.operation,
    expression_ref:tag(d.request.basis?.expression_ref),source_ref:tag(d.request.basis?.source?.source_ref??d.request.source?.source_ref)});
  }else if(fromWorld&&d.kind==='expression-file'&&Number.isSafeInteger(d.req)&&d.req>0&&['prepare','perform'].includes(d.request?.operation)){
   const doc=d.request.document??d.request.intent?.document,destination=d.request.destination??d.request.intent?.destination;
   add({...base,phase:'file-request-received-by-host',req:d.req,operation:d.request.operation,expression_ref:tag(doc?.expression_ref),document_revision:Number.isSafeInteger(doc?.revision)?doc.revision:null,file_revision:tag(destination?.revision),location_ref:tag(destination?.location?.ref)});
  }else if(fromParent&&d.kind==='expression-file-result'&&Number.isSafeInteger(d.req)&&d.req>0){
   const data=d.data,doc=data?.document??data?.artifact?.document,file=data?.file??data?.artifact?.file;
   add({...base,phase:'file-reply-received-by-application',req:d.req,ok:d.ok===true,error:typeof d.error==='string'?d.error.slice(0,2048):null,
    expression_ref:tag(doc?.expression_ref),document_revision:Number.isSafeInteger(doc?.revision)?doc.revision:null,location_ref:tag(file?.location?.ref),file_revision:tag(file?.revision)});
  }else if(fromParent&&d.kind==='nara-instrument-result'&&Number.isSafeInteger(d.req)&&d.req>0&&d.data?.schema==='oi.nara-identity/v1'){
   const data=d.data;
   add({...base,phase:'identity-reply-received-by-application',req:d.req,ok:d.ok===true,
    source_ref:tag(data.source?.source_ref),source_revision:tag(data.source?.revision),
    input_revision:tag(data.reading?.input_revision),person_ref:tag(data.reading?.person_ref),nara_ref:tag(data.reading?.nara_ref)});
  }else if(fromParent&&d.kind==='nara-instrument-result'&&Number.isSafeInteger(d.req)&&d.req>0){
   const data=d.data;
   if(d.ok===false||['oi.nara-instrument-state/v1','oi.nara-personal-current-context/v1'].includes(data?.schema))
    add({...base,phase:'reply-received-by-application',req:d.req,ok:d.ok===true,schema:tag(data?.schema),status:tag(data?.status),
     error:typeof d.error==='string'?d.error.slice(0,2048):null,person_ref:tag(data?.reading?.identity?.person_ref??data?.identity?.reading?.person_ref),
     identity_source_ref:tag(data?.identity?.source?.source_ref),identity_source_revision:tag(data?.identity?.source?.revision),
     identity_input_revision:tag(data?.identity?.reading?.input_revision),nara_ref:tag(data?.identity?.reading?.nara_ref),
     expression_ref:tag(data?.expression?.expression_ref),document_revision:Number.isSafeInteger(data?.expression?.revision)?data.expression.revision:null,
     scene_ref:tag(data?.expression?.selection?.scene_ref),entity_ref:tag(data?.expression?.selection?.entity_ref),relation_ref:tag(data?.expression?.selection?.relation_ref),
     event_ref:tag(data?.context?.event_ref),reading_ref:tag(data?.context?.reading_ref),reading_revision:tag(data?.context?.reading_revision),
     snapshot_ref:tag(data?.reading?.transit?.sky?.snapshot_ref)});
  }else if(fromParent&&d.kind==='oi-nara-identity-released')add({...base,phase:'identity-release-received-by-application'});
 });
}

// Passive receiving witness. Borrow only scalar native references and existing
// channel/DOM state; no private reading, profile/draft body or native request.
async function captureNaraReceiving(label){
 const sampledAt=Date.now(),deadline=sampledAt+1000;
 const observe=async operation=>{const remaining=deadline-Date.now();if(remaining<=0)throw Error('Nara receiving observation budget reached');let timer;
  try{return await Promise.race([operation(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Nara receiving observation budget reached')),remaining);})]);}finally{clearTimeout(timer);}};
 const witness={schema:'epi.actual-nara-receiving-witness/v1',sampled_at_unix_ms:sampledAt,observation_budget_ms:1000};
 try{witness.application=await observe(()=>frame.evaluate(()=>{
  const tag=value=>typeof value==='string'?value.slice(0,512):null;
  const f=window.__FIELD_STUDIES__,w=f?.nativeWorking(),record=f?.epiWorld(),current=f?.epiCurrent();
  const instrument=document.querySelector('.nara-personal'),conversation=instrument?.querySelector('.nara-conversation-layout'),content=instrument?.querySelector('.nara-personal-content');
  const send=conversation?.querySelector('form button'),question=conversation?.querySelector('textarea');
  const workDocument=window.__FIELD_STUDIES__?.getState(),selection=Array.isArray(workDocument?.selected)?workDocument.selected.slice(0,16):[];
  return {captured_at_unix_ms:Date.now(),channel:window.__EPI_INITIAL_CHANNEL_PHASES__?.()??null,
   working:{native_ref:tag(w?.native_ref),revision:Number.isSafeInteger(w?.revision)?w.revision:null,busy:!!w?.busy,pending:tag(w?.pending),failed:!!w?.failed},
   world:{instance_ref:tag(record?.world?.instance_ref),person_ref:tag(record?.person_ref),nara_ref:tag(record?.nara_ref),source_ref:tag(record?.identity_source?.source_ref),source_revision:tag(record?.identity_source?.revision),input_revision:tag(record?.identity_input_revision),event_ref:tag(record?.world?.event_ref),snapshot_ref:tag(record?.world?.snapshot_ref),saved_current_ref:tag(record?.receiving?.personal?.current?.ref)},
   current:{present:!!current,person_ref:tag(current?.reading?.identity?.person_ref),event_ref:tag(current?.context?.event_ref),reading_ref:tag(current?.context?.reading_ref),reading_revision:tag(current?.context?.reading_revision)},
   dom:{instrument_visible:!!instrument?.getClientRects().length,busy:content?.getAttribute('aria-busy')??null,
    identity_heading:tag(instrument?.querySelector('h1')?.textContent),source_ref:tag(instrument?.querySelector('select[aria-label="Saved profiles"]')?.value),
    conversation_heading:tag(conversation?.querySelector('aside h2')?.textContent),subject_caption:tag(conversation?.querySelector('aside h2+p')?.textContent),
    alerts:Array.from(instrument?.querySelectorAll('[role="alert"]')??[]).slice(0,8).map(node=>tag(node.textContent)),
    question_present:!!question,question_characters:question?.value.length??0,send_disabled:send?.disabled??null,
    actual_local_selection:selection.filter(value=>typeof value==='string').map(tag),chosen_body:tag(document.querySelector('[data-epi-body]')?.value)}};
 }));}catch(error){witness.application_observation_error=shortError(error);}
 try{witness.host_channel=await observe(()=>page.evaluate(()=>window.__EPI_INITIAL_CHANNEL_PHASES__?.()??null));}catch(error){witness.host_observation_error=shortError(error);}
 witness.finished_at_unix_ms=Date.now();witness.limit='Exact observed channel/DOM scalars only; release reason, React draftDirty/restored/released refs and unobserved native reply values remain unknown. Ring drops are explicit. No provider question, voice or private payload is captured.';
 const raw=JSON.stringify(witness,null,2)+'\n';assert.ok(Buffer.byteLength(raw)<=64*1024,'Nara receiving witness must fit its scalar evidence aperture');
 const file=label+'.nara-receiving.json';await writeFile(resolve(cfg.output,file),raw);
 return {path:file,bytes:Buffer.byteLength(raw),sha256:hash(raw)};
}

async function retainInitialResponsePhases(){
 const sampledAt=Date.now(),diagnosticDeadline=sampledAt+1000,rows=[];
 const observe=async operation=>{const remaining=diagnosticDeadline-Date.now();if(remaining<=0)throw Error('Failure-only phase observation budget reached');let timer;
  try{return await Promise.race([operation(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Failure-only phase observation budget reached')),remaining);})]);}finally{clearTimeout(timer);}};
 for(const observation of initialCriticalRequests){
  const {response,...row}=observation;row.sampled_at=Date.now();
  // Do not wait for an unfinished response or issue another native operation.
  // Read already completed actual HTTP bytes only after the failed30s gate.
  if(response&&observation.finished_at&&observation.completion_error===null){
   const declared=observation.declared_bytes;
   if(Number.isSafeInteger(declared)&&declared>=0&&declared<=16*1024*1024){
    try{
     const raw=await observe(()=>response.body());row.actual_response_bytes=raw.length;row.actual_response_sha256=hash(raw);
     if(raw.length!==declared||raw.length>16*1024*1024)row.response_observation_refused='Actual bytes differ from the bounded declared response';
     else{
      const value=JSON.parse(raw),data=value.outcome?.data;
      row.native_reply={ok:value.ok===true,result:shortTag(value.outcome?.result),error:typeof value.error==='string'?shortError(value.error):null,
       schema:shortTag(data?.schema),status:shortTag(data?.status),state:shortTag(data?.state),
       expression_ref:shortTag(data?.document?.expression_ref),document_revision:Number.isSafeInteger(data?.document?.revision)?data.document.revision:null,
       file_revision:typeof data?.file?.revision==='string'?data.file.revision.slice(0,512):null,location_ref:typeof data?.file?.location?.ref==='string'?data.file.location.ref.slice(0,512):null,person_ref:shortTag(data?.reading?.identity?.person_ref),
       event_ref:shortTag(data?.context?.event_ref),reading_ref:shortTag(data?.context?.reading_ref),reading_revision:shortTag(data?.context?.reading_revision),
       snapshot_ref:shortTag(data?.reading?.transit?.sky?.snapshot_ref)};
     }
    }catch(error){row.response_observation_error=shortError(error);}
   }else row.response_observation_refused='No bounded declared completed response; native value remains unobserved';
  }else row.response_value_unobserved='No successful HTTP completion observed at the failure sample';
  rows.push(row);
 }
 const channel=async target=>{try{return await observe(()=>target.evaluate(()=>window.__EPI_INITIAL_CHANNEL_PHASES__?.()??null));}catch(error){return{read_error:shortError(error)};}};
 const witness={schema:'epi.actual-cold-current-response-phases/v1',started_at:new Date(sampledAt).toISOString(),arrival_wait_started_unix_ms:initialArrivalWaitStartedAt,arrival_wait_failed_unix_ms:initialArrivalWaitFailedAt,arrival_wait_timeout_ms:30000,native_requests:rows,native_requests_dropped:initialCriticalDrops,
  host_channel:await channel(page),application_channel:await channel(frame),
  observation_budget_ms:1000,scope:'Failure-only actual current/Save/recovery request issue, HTTP completion/native reply scalar and passive same-window personal/file channel phases; full native bytes are hashed, not retained or admitted; no extra owner request, provider, mutation or receiving-deadline change; post-failure observation has one1000ms total budget'};
 const bytes=JSON.stringify(witness,null,2)+'\n';assert.ok(Buffer.byteLength(bytes)<=64*1024,'Cold response-phase witness is bounded');
 const name='initial-current-response-phases.json';await writeFile(resolve(cfg.output,name),bytes);
 report.initial_current_response_phases={path:name,bytes:Buffer.byteLength(bytes),sha256:hash(bytes)};
}

async function retainInitialReceivingFailure(basis){
 const started=Date.now();
 let actual;
 try{actual=await frame.evaluate(basis=>{
  const f=window.__FIELD_STUDIES__,readErrors={};
  const read=(name,fn)=>{try{return fn();}catch(error){readErrors[name]=String(error).slice(0,1024);return null;}};
  const w=read('nativeWorking',()=>f?.nativeWorking()),r=read('epiWorld',()=>f?.epiWorld()),c=read('epiCurrent',()=>f?.epiCurrent());
  const scalar=value=>typeof value==='string'?value.slice(0,2048):typeof value==='boolean'||typeof value==='number'&&Number.isFinite(value)?value:null;
  const notice=document.querySelector('.epi-world-entrance [role="alert"]');
  const predicates={native_ref:w?.native_ref===basis.expression_ref,not_busy:!w?.busy,not_pending:!w?.pending,not_failed:!w?.failed,
   file_root:w?.file?.location?.root===basis.world,instance:r?.world?.instance_ref===basis.expression_ref,
   person:r?.person_ref===basis.person_ref,identity_source:r?.identity_source?.source_ref===basis.identity_source_ref,
   occasion:r?.world?.event_ref===basis.event_ref,current_person:c?.reading?.identity?.person_ref===basis.person_ref,current_occasion:c?.context?.event_ref===basis.event_ref};
  return {captured_at:new Date().toISOString(),read_errors:readErrors,predicates,
   working:{present:!!w,native_ref:scalar(w?.native_ref),revision:scalar(w?.revision),busy:scalar(w?.busy),pending:scalar(w?.pending),failed:scalar(w?.failed),
    file_root:scalar(w?.file?.location?.root),file_revision:scalar(w?.file?.revision)},
   world:{present:!!r,instance_ref:scalar(r?.world?.instance_ref),person_ref:scalar(r?.person_ref),identity_source_ref:scalar(r?.identity_source?.source_ref),event_ref:scalar(r?.world?.event_ref)},
   current:{present:!!c,person_ref:scalar(c?.reading?.identity?.person_ref),event_ref:scalar(c?.context?.event_ref),reading_ref:scalar(c?.context?.reading_ref),reading_revision:scalar(c?.context?.reading_revision)},
   dom:{ready_state:document.readyState,entrance_present:!!document.querySelector('.epi-world-entrance'),notice_text:notice?.textContent?.slice(0,2048)??null,
    notice_visible:!!notice&&notice.getClientRects().length>0,conversation_visible:!!document.querySelector('#nara-instrument')?.getClientRects().length}};
 },basis);}catch(error){actual={read_failed:shortError(error)};}
 collectingInitialWitness=false;
 const witness={schema:'epi.actual-cold-receiving-failure-witness/v1',started_at:new Date(started).toISOString(),finished_at:new Date().toISOString(),arrival_wait_started_unix_ms:initialArrivalWaitStartedAt,arrival_wait_failed_unix_ms:initialArrivalWaitFailedAt,arrival_wait_timeout_ms:30000,basis,actual,
  page_errors:[...initialPageErrors],page_errors_dropped:initialPageErrorDrops,native_replies:initialReplies.map(row=>({...row})),native_replies_dropped:initialReplyDrops,
  native_protocol_body_read:false,scope:'Passive actual loaded scalar/DOM and HTTP completion/error observations after the unchanged30s fence fails; no native acquisition, body copy, mutation or ACK substitution'};
 const bytes=JSON.stringify(witness,null,2)+'\n';assert.ok(Buffer.byteLength(bytes)<=64*1024,'Cold receiving failure witness is bounded');
 const name='initial-receiving-failure.json';await writeFile(resolve(cfg.output,name),bytes);
 report.initial_receiving_failure={path:name,bytes:Buffer.byteLength(bytes),sha256:hash(bytes)};
 try{await retainInitialResponsePhases();}catch(error){report.initial_current_response_phase_diagnostic_error=shortError(error);}
}
async function responseBytes(response,cap=64*1024*1024){assert.ok(response.ok,'Actual HTTP '+response.status);const reader=response.body.getReader(),parts=[];let size=0;try{for(;;){const r=await reader.read();if(r.done)break;size+=r.value.byteLength;if(size>cap)throw Error('Actual native reply exceeds its receiving bound');parts.push(Buffer.from(r.value));}}catch(e){await reader.cancel();throw e;}finally{reader.releaseLock();}return Buffer.concat(parts);}
async function native(request){
 const body=JSON.stringify({op:'expression',request});const bytes=await responseBytes(await fetch(cfg.bridge+'/op',{method:'POST',headers:{'Content-Type':'application/json'},body}));const value=JSON.parse(bytes);
 let evidence={request,response_bytes:bytes.length,response_sha256:hash(bytes),state:value.outcome?.data?.state,error:value.error??null};
 if(cfg.selection_case==='required-cosmic-body-disabled'&&request.operation==='edit'){
  // Full actual owner operands/bytes stay reachable as artifacts. Only their
  // refs enter the unchanged bounded2MiB summary-receipt consumer aperture.
  assert.ok(Buffer.byteLength(body)<=64*1024*1024);const ordinal=report.native.length,request_file=`body-native-edit-${ordinal}.request.json`,response_file=`body-native-edit-${ordinal}.response.json`;
  await writeFile(resolve(cfg.output,request_file),body);await writeFile(resolve(cfg.output,response_file),bytes);
  evidence={request:{operation:request.operation,expression_ref:request.expression_ref,expected_revision:request.expected_revision,actor:request.actor,changes:request.changes.map(change=>({change:change.change,scene_ref:change.scene_ref}))},
   full_request_ref:{path:request_file,bytes:Buffer.byteLength(body),sha256:hash(body)},full_response_ref:{path:response_file,bytes:bytes.length,sha256:hash(bytes)},state:value.outcome?.data?.state,error:value.error??null};
 }
 report.native.push(evidence);assert.equal(value.ok,true,JSON.stringify(value));assert.equal(value.outcome.result,'expression');return value.outcome.data;
}
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
 assert.equal(decoded.state,'ready');
 assert.deepEqual(decoded.file,{location:expected.file.location,revision:expected.file.revision},label+': actual native InspectFile location/revision contract');
 assert.deepEqual({...decoded.file,expression_ref:decoded.document.expression_ref,document_revision:decoded.document.revision},expected.file,label+': canonical file identity/revision comes from the complete native decoded Document');
 assert.deepEqual(decoded.document,expected.document,label+': every durable body/property/source/history remains exact');
 const bytes=await responseBytes(await fetch(cfg.bridge+'/op',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({op:'file_read',location:expected.file.location})}),24*1024*1024);
 const result=JSON.parse(bytes);assert.equal(result.ok,true);assert.equal(result.outcome.result,'file_read');const reading=result.outcome.reading;
 assert.deepEqual({location:reading.location,revision:reading.revision},{location:expected.file.location,revision:expected.file.revision});assert.equal(Buffer.byteLength(reading.content),expected.content_bytes);assert.equal(hash(reading.content),expected.content_sha256);
 const physical=resolve(cfg.world,expected.file.location.path);assert.ok(physical.startsWith(cfg.world+'/'));assert.ok(expected.file.location.path.split('/').every(part=>part!=='.'&&part!=='..'));
 await qualifiedFile({path:physical,bytes:expected.content_bytes,sha256:expected.content_sha256},label+': durable actual file',24*1024*1024);
 (report.durable_conservation??=[]).push({label,file:expected.file,document_revision:expected.document.revision,content_sha256:expected.content_sha256,actual_native_file_reply_sha256:hash(bytes)});
}

async function waitCurrent(entityRef){const end=Date.now()+30000;for(;;){const working=await frame.evaluate(()=>window.__FIELD_STUDIES__.nativeWorking()),r=await inspect();if(!working.busy&&!working.pending&&working.revision===r.document.revision&&r.document.selection.entity_ref===entityRef)return r;if(Date.now()>end)throw Error('Original native focus did not become current in30s');await new Promise(r=>setTimeout(r,100));}}
function exactFocusOnly(before,after,sceneRef,entityRef){const expected=structuredClone(before);assert.ok(after.revision===before.revision||after.revision===before.revision+1);expected.revision=after.revision;expected.selection={scene_ref:sceneRef,entity_ref:entityRef};assert.deepEqual(after,expected,'Native focus must preserve complete source/person/occasion/material/body history');}
try{
 if(selectionOnly)await qualifyHostedOwner();
 browser=selectionOnly?await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']}):await chromium.launch({headless:true});page=selectionOnly?await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'reduce'}):await browser.newPage({viewport:{width:1440,height:900}});
 if(selectionOnly)await page.addInitScript(installInitialChannelPhaseObserver);
 if(!selectionOnly)await page.addInitScript(installInitialChannelPhaseObserver);
 const errors=[];page.on('pageerror',e=>{errors.push(String(e));if(collectingInitialWitness){if(initialPageErrors.length<8)initialPageErrors.push(shortError(e));else initialPageErrorDrops++;}});
 page.on('request',request=>{if(!observedOpURL(request.url())||request.method()!=='POST')return;const text=request.postData();if(!text||Buffer.byteLength(text)>32*1024*1024)return;try{const v=JSON.parse(text);report.requests.push({op:v.op,operation:v.request?.operation,action:v.request?.action,...(v.op==='nara_coordinate'?{coordinate_ref:v.request?.coordinate_ref,face:v.request?.face,source_only:v.request?.source_only}:{}),sha256:hash(text),bytes:Buffer.byteLength(text)});if(collectingInitialWitness){const metadata={ordinal:report.requests.length-1,op:shortTag(v.op),operation:shortTag(v.request?.operation),started:Date.now()};initialRequestTimes.set(request,metadata);observeInitialCriticalRequest(request,v,metadata,text);}}catch{report.requests.push({unreadable:true});}});
 page.on('response',response=>{
  const metadata=initialRequestTimes.get(response.request());if(!metadata||!collectingInitialWitness)return;
  const arrived=Date.now(),headers=response.headers(),length=headers['content-length'];
  const critical=initialCriticalByRequest.get(response.request());if(critical){critical.response=response;critical.headers_at=arrived;critical.http_status=response.status();critical.declared_bytes=/^\d+$/.test(length??'')?Number(length):null;}
  recordInitialReply({...metadata,phase:'headers',at:arrived,elapsed_ms:arrived-metadata.started,http_status:response.status(),declared_bytes:typeof length==='string'?length.slice(0,32):null});
  void response.finished().then(error=>{const at=Date.now();if(critical){critical.finished_at=at;critical.completion_error=error?shortError(error):null;}recordInitialReply({...metadata,phase:'finished',at,elapsed_ms:at-metadata.started,http_status:response.status(),error:error?shortError(error):null});}).catch(error=>{if(critical){critical.finished_at=Date.now();critical.completion_error=shortError(error);}recordInitialReply({...metadata,phase:'completion-error',at:Date.now(),error:shortError(error)});});
 });
 page.on('requestfailed',request=>{const metadata=initialRequestTimes.get(request);if(metadata)recordInitialReply({...metadata,phase:'request-failed',at:Date.now(),error:shortError(request.failure()?.errorText??'Unknown HTTP request failure')});});
 await page.goto(cfg.app_url);await page.waitForSelector('iframe',{timeout:30000});
 if(selectionOnly){
  const host=page.locator('#world');assert.equal(await host.count(),1);
  await page.waitForFunction(()=>document.querySelector('#world')?.getAttribute('src')?.startsWith('/__epi_application'),null,{timeout:30000});
  frame=await host.elementHandle().then(element=>element.contentFrame());assert.ok(frame);
  assert.equal(new URL(frame.url()).pathname,q.frontend.application_path);assert.equal(new URL(frame.url()).origin,new URL(cfg.app_url).origin);
  assert.equal(new URL(frame.url()).searchParams.get('expression'),cfg.expression_ref,'Actual production host must admit this exact instance');
 }else {const candidates=page.frames().filter(f=>f.url().includes('field-studies'));assert.equal(candidates.length,1);frame=candidates[0];}
 await frame.waitForFunction(()=>!!window.__FIELD_STUDIES__?.nativeWorking(),null,{timeout:30000});
 if(selectionOnly){try{
  initialArrivalWaitStartedAt=Date.now();
  await frame.waitForFunction(basis=>{
  const f=window.__FIELD_STUDIES__,w=f?.nativeWorking(),r=f?.epiWorld(),c=f?.epiCurrent();
  return w?.native_ref===basis.expression_ref&&!w.busy&&!w.pending&&!w.failed&&w.file?.location?.root===basis.world
   &&r?.world?.instance_ref===basis.expression_ref&&r.person_ref===basis.person_ref&&r.identity_source?.source_ref===basis.identity_source_ref
   &&r.world.event_ref===basis.event_ref&&c?.reading?.identity?.person_ref===basis.person_ref&&c.context?.event_ref===basis.event_ref;
 },{expression_ref:cfg.expression_ref,person_ref:cfg.person_ref,identity_source_ref:cfg.identity_source_ref,world:cfg.world,event_ref:q.event_ref},{timeout:30000});
 }catch(error){initialArrivalWaitFailedAt=Date.now();try{await retainInitialReceivingFailure({expression_ref:cfg.expression_ref,person_ref:cfg.person_ref,identity_source_ref:cfg.identity_source_ref,world:cfg.world,event_ref:q.event_ref});}catch(diagnostic){report.initial_receiving_diagnostic_error=shortError(diagnostic);}throw error;}finally{collectingInitialWitness=false;}}
 const original=await inspect(),document=original.document;assert.equal(document.expression_ref,cfg.expression_ref);assert.equal(original.dirty,false);assert.ok(original.file);assert.equal(original.file.location.root,cfg.world);
 const carrier=document.scenes.find(s=>s.presentation?.scene?.epiWorld)?.presentation.scene.epiWorld;assert.ok(carrier);assert.equal(carrier.person_ref,cfg.person_ref);assert.equal(carrier.identity_source.source_ref,cfg.identity_source_ref);
 if(selectionOnly){assert.equal(carrier.person_ref,q.person_ref);assert.equal(carrier.world.event_ref,q.event_ref);assert.equal(carrier.world.snapshot_ref,q.snapshot_ref);assert.equal(carrier.world.instance_ref,q.instance_ref);await qualifyHostedAdmission(document);}
 const target=carrier.receiving.personal.locus_entity_ref;assert.equal(document.entities[target].subject.subject_ref,'ql:m-coordinate:bimba:M4.4.4.4');
 const sceneRef=document.selection.scene_ref,scene=document.scenes.find(s=>s.scene_ref===sceneRef);assert.ok(scene?.entity_refs.includes(target),'Caller must admit the original personal hub Scene');
 const other=scene.entity_refs.find(ref=>ref!==target&&document.entities[ref]?.subject);assert.ok(other);
 const instrument=frame.getByRole('region',{name:'Nara Expression instrument'});assert.equal(await instrument.isVisible(),false,'Conversation must start closed');
 const choose=async ref=>{await frame.locator('[data-epi-body]').selectOption(ref);return waitCurrent(ref);};
 const local=async ref=>{const work=await frame.evaluate(()=>window.__FIELD_STUDIES__.nativeWorking());const entry=Object.entries(work.bindings).find(([,b])=>b.scene_ref===sceneRef);assert.ok(entry);const occurrence=entry[1].occurrences.find(o=>o.entity_ref===ref);assert.ok(occurrence);await frame.evaluate(id=>window.__FIELD_STUDIES__.selectEntity(id),occurrence.view_entity_id);};
 if(cfg.selection_case==='required-cosmic-body-disabled'){
 assert.equal(selectionOnly,true,'The counterproof requires actual isolated source-built process/file/module custody');
 const cosmicRef=carrier.receiving.scene_ref,cosmic=document.scenes.find(s=>s.scene_ref===cosmicRef),earth=cfg.expression_ref+':entity:world-earth';
 assert.ok(cosmic&&cosmic.entity_refs.length===32&&cosmic.entity_refs.includes(earth));
 assert.equal(document.entities[earth].subject.subject_ref,'ql:m-coordinate:bimba:M2-5-0/1-0');
 const required=[...cosmic.entity_refs],otherBodies=required.filter(ref=>ref!==earth),maskRoles=['degree','governor','decan','codon','skin','aperture'];
 assert.equal(otherBodies.length,31);
 const actualImage=async(label,reading)=>{
  const bytes=JSON.stringify(reading,null,2)+'\n';assert.ok(Buffer.byteLength(bytes)<=64*1024*1024,'Actual controlled body readback must fit its retained aperture');
  const file=label+'.json';await writeFile(resolve(cfg.output,file),bytes);
  const png=await page.screenshot({path:resolve(cfg.output,label+'.png')});
  return{readback:{path:resolve(cfg.output,file),bytes:Buffer.byteLength(bytes),sha256:hash(bytes)},image:{path:resolve(cfg.output,label+'.png'),bytes:png.length,sha256:hash(png)},
   expression_ref:reading.working.native_ref,revision:reading.working.revision,scene_ref:reading.document.scenes[reading.state.sceneIndex].id,
   source_cut:q.source_cuts.oi.cut,loaded_application:q.frontend.application,loaded_receiver:q.frontend.host,
   actual_native_document_sha256:hash(JSON.stringify(reading.native_document)),standing:'Same browser/native current readback and screenshot; pixels do not prove shape/readability'};
 };
 const readActual=async()=>{
  const reading=await frame.evaluate(()=>{const f=window.__FIELD_STUDIES__;return{state:f.getState(),working:f.nativeWorking(),record:f.epiWorld(),current:f.epiCurrent(),native:f.native(),document:f.getDocument(),rendered:f.inspect(true),telemetry:f.telemetry()};});
  const current=await inspect();reading.native_document=current.document;
  assert.equal(reading.working.native_ref,cfg.expression_ref);assert.equal(reading.working.revision,current.document.revision);
  assert.equal(reading.document.scenes[reading.state.sceneIndex].id,cosmicRef);assert.equal(current.document.selection.scene_ref,cosmicRef);
  assert.deepEqual(reading.record,carrier,'Disable/restore cannot rebind the native world, source, clocks, person, occasion or profile');
  assert.equal(reading.state.fieldPaused,true);assert.equal(reading.state.simTime,0);assert.equal(reading.rendered.simTime,0);assert.equal(reading.rendered.steps,0);
  return reading;
 };
 const awaitActualPartition=async(disabled,revision)=>frame.waitForFunction(basis=>{
  const f=window.__FIELD_STUDIES__,journey=f?.getDocument(),state=f?.getState(),work=f?.nativeWorking(),reading=f?.inspect(),telemetry=f?.telemetry();
  const scene=journey?.scenes[state.sceneIndex],earth=scene?.entities.find(e=>e.id===basis.earth);
  if(work?.native_ref!==basis.expression_ref||work.revision!==basis.revision||work.busy||work.pending||work.failed||scene?.id!==basis.cosmic||scene.entities.length!==32||earth?.enabled!==!basis.disabled)return false;
  const parts=reading?.partitions??[],expected=basis.disabled?basis.others:basis.required;
  if(parts.length!==expected.length||!expected.every(ref=>parts.some(p=>p.entityId===ref&&p.end>p.start))||basis.disabled&&parts.some(p=>p.entityId===basis.earth))return false;
  const statuses=telemetry?.sourceStatus??{};
  return basis.masks.every(role=>{const entries=Object.entries(statuses).filter(([key])=>{try{return JSON.parse(key)[0]===basis.expression_ref+':entity:world-register-'+role;}catch{return false;}});return entries.length===1&&typeof entries[0][1]==='string'&&entries[0][1].includes('source active');});
 },{expression_ref:cfg.expression_ref,cosmic:cosmicRef,earth,required,others:otherBodies,disabled,revision,masks:maskRoles},{timeout:30000});
 const exactMaterialOnly=(before,after,presentation)=>{
  const expected=structuredClone(before);expected.revision=before.revision+1;
  const changed=expected.scenes.find(scene=>scene.scene_ref===cosmicRef);changed.revision=expected.revision;changed.presentation=structuredClone(presentation);
  assert.deepEqual(after,expected,'Only exact cosmic Earth live/saved enabled bit and lawful native document/scene revision may change');
 };
 const controls=async()=>{
  const reading=await frame.evaluate(()=>({scenes:Array.from(document.querySelectorAll('[data-epi-scene]')).map(e=>({ref:e.dataset.epiScene,text:e.textContent,current:e.getAttribute('aria-current')})),
   actions:Array.from(document.querySelectorAll('[data-epi]')).map(e=>({action:e.dataset.epi,text:e.textContent})),
   body_refs:Array.from(document.querySelector('[data-epi-body]')?.options??[]).map(e=>e.value).filter(Boolean),axis_controls:document.querySelectorAll('[data-epi-axis-controls]').length}));
  assert.equal(reading.scenes.length,3);assert.deepEqual(reading.body_refs,required);assert.equal(reading.axis_controls,1);
  for(const action of ['source','ask','step','reset','save','set-damping','set-axis'])assert.ok(reading.actions.some(row=>row.action===action),'Ordinary '+action+' remains present while the body is disabled');
  return reading;
 };
 const artifacts=[];
 const receiving=createEpiFirstRestReceivingGate({check:(value,label)=>{assert.ok(value,label);report.checks.push(label);},sha:hash,
  artifact:(name,value)=>{const bytes=JSON.stringify(value,null,2)+'\n';assert.ok(Buffer.byteLength(bytes)<=4*1024*1024);writeFileSync(resolve(cfg.output,name),bytes);artifacts.push({path:name,bytes:Buffer.byteLength(bytes),sha256:hash(bytes)});}});
 const requestStart=report.requests.length;
 await frame.locator('[data-epi-scene='+JSON.stringify(cosmicRef)+']').click();
 await frame.waitForFunction(ref=>{const f=window.__FIELD_STUDIES__,w=f?.nativeWorking(),d=f?.getDocument();return !w?.busy&&!w?.pending&&!w?.failed&&d.scenes[f.getState().sceneIndex].id===ref;},cosmicRef,{timeout:30000});
 const focused=await inspect();exactFocusOnly(document,focused.document,cosmicRef,null);
 await awaitActualPartition(false,focused.document.revision);
 const opening=await readActual(),openingControls=await controls();receiving.requirePartitions(opening,required,'Required-body original first rest');receiving.requireInitialRestTargets(opening,required,'Required-body original first rest');
 const openingEvidence=await actualImage('required-body-before-native-disable',opening),originalPresentation=structuredClone(focused.document.scenes.find(scene=>scene.scene_ref===cosmicRef).presentation);
 const disabledPresentation=structuredClone(originalPresentation);
 for(const material of [disabledPresentation.scene,disabledPresentation.saved].filter(Boolean)){
  const rows=material.entities.filter(e=>e.id===earth);assert.equal(rows.length,1);assert.equal(rows[0].enabled,true);rows[0].enabled=false;
 }
 const disabled=await native({operation:'edit',expression_ref:cfg.expression_ref,expected_revision:focused.document.revision,actor:'human:controlled-required-body-counterproof',changes:[{change:'scene_material_set',scene_ref:cosmicRef,presentation:disabledPresentation}]});
 assert.equal(disabled.state,'ready');assert.ok(disabled.document);exactMaterialOnly(focused.document,disabled.document,disabledPresentation);
 // The frame-local openNative(ref) intentionally retains an already open
 // draft. Use the ordinary parent's existing ref-only open-expression contract
 // so nativeWorkspace.follow actually inspects and adopts this owner revision.
 await page.evaluate(ref=>{const frame=document.querySelector('#world');if(!frame?.contentWindow)throw Error('The qualified actual parent frame is absent');frame.contentWindow.postMessage({v:1,kind:'host-command',command:'open-expression',ref},'*');},cfg.expression_ref);
 (report.body_ordinary_reopen_commands??=[]).push({command:'open-expression',ref:cfg.expression_ref,expected_native_revision:disabled.document.revision,source_contract:'src/expressions/hostedApp.ts::postOpenExpression → app.ts::openHostExpression → nativeWorkspace.follow',payload_contains_only_reference:true});
 await awaitActualPartition(true,disabled.document.revision);
 const absent=await readActual(),absentControls=await controls();assert.deepEqual(absent.native_document,disabled.document);assert.deepEqual(absentControls,openingControls,'Controls, body choices and exact Scene routes must remain present');
 const expectedFailure='Required-body disabled first rest: actual renderer partition for '+earth;
 let partitionFailure;try{receiving.requirePartitions(absent,required,'Required-body disabled first rest');}catch(error){partitionFailure=String(error);assert.equal(error.message,expectedFailure);}assert.ok(partitionFailure,'The unchanged complete32 world gate must refuse the disabled actual Earth body');
 let targetFailure;try{receiving.requireInitialRestTargets(absent,required,'Required-body disabled first rest');}catch(error){assert.equal(error.code,'ERR_ASSERTION');assert.match(error.message,/p\s*&&\s*p\.end\s*>\s*p\.start/,'Failure must be the unchanged actual required partition assertion, not an unrelated receiving precondition');targetFailure=String(error);}assert.ok(targetFailure,'The unchanged full32 actual first-rest target gate must also refuse this body omission');
 assert.equal(absent.rendered.partitions.length,31);assert.ok(!absent.rendered.partitions.some(row=>row.entityId===earth));for(const ref of otherBodies)assert.ok(absent.rendered.partitions.some(row=>row.entityId===ref&&row.end>row.start));
 const disabledEvidence=await actualImage('required-body-disabled-native-and-actual-renderer',absent);
 const restore=await native({operation:'edit',expression_ref:cfg.expression_ref,expected_revision:disabled.document.revision,actor:'human:controlled-required-body-restore',changes:[{change:'scene_material_set',scene_ref:cosmicRef,presentation:originalPresentation}]});
 assert.equal(restore.state,'ready');assert.ok(restore.document);exactMaterialOnly(disabled.document,restore.document,originalPresentation);
 const exactRestored=structuredClone(focused.document);exactRestored.revision=restore.document.revision;exactRestored.scenes.find(scene=>scene.scene_ref===cosmicRef).revision=restore.document.revision;assert.deepEqual(restore.document,exactRestored,'Native restoration returns the exact original full world except lawful revision history');
 await page.evaluate(ref=>{const frame=document.querySelector('#world');if(!frame?.contentWindow)throw Error('The qualified actual parent frame is absent');frame.contentWindow.postMessage({v:1,kind:'host-command',command:'open-expression',ref},'*');},cfg.expression_ref);
 report.body_ordinary_reopen_commands.push({command:'open-expression',ref:cfg.expression_ref,expected_native_revision:restore.document.revision,source_contract:'src/expressions/hostedApp.ts::postOpenExpression → app.ts::openHostExpression → nativeWorkspace.follow',payload_contains_only_reference:true});
 await awaitActualPartition(false,restore.document.revision);
 const restored=await readActual();assert.deepEqual(restored.native_document,restore.document);assert.deepEqual(await controls(),openingControls);
 receiving.requirePartitions(restored,required,'Required-body restored original first rest');receiving.requireInitialRestTargets(restored,required,'Required-body restored original first rest');
 const restoredEvidence=await actualImage('required-body-native-restored-ordinary-load',restored);
 assert.equal(await instrument.isVisible(),false);assert.ok(!report.requests.slice(requestStart).some(v=>(v.op==='encounter'&&['prompt','draft'].includes(v.action))||['send','epii_delegate'].includes(v.operation)));
 report.required_body_counterproof={passed:true,entity_ref:earth,native_subject_ref:document.entities[earth].subject.subject_ref,
  mutation:'Only current/saved cosmic material Earth.enabled true→false via actual native CAS; no semantic entity/source/profile/control deletion',
  retained_authored_clock_basis:carrier.native_readback??carrier.world.native_readback,opening:openingEvidence,disabled:disabledEvidence,restored:restoredEvidence,
  partition_gate_expected_failure:expectedFailure,actual_partition_failure:partitionFailure,actual_target_failure:targetFailure,
  unchanged_original_receiving_predicates:true,other_actual_partitions:31,original_required_partitions:32,artifacts,
  durable:'The existing before/after native inspect_file/file_read/physical-byte full Document gates remain mandatory',
  scope:'Actual source-built native/browser original-gate counterproof and restored receiving; product refusal, shape/readability, personal causal, installed and H unclaimed'};
 }else if(navigationCase){
 const requestStart=report.requests.length;
 // These are ordinary navigation cases over the same real owner and full
 // independently acknowledged file. No selection result is substituted.
 await local(target);
 const beforeJourney=await frame.evaluate(()=>window.__FIELD_STUDIES__.getDocument());
 const before=await inspect();assert.deepEqual(before.document,document);
 const localFocus=async()=>frame.evaluate(()=>{
  const f=window.__FIELD_STUDIES__,state=f.getState(),journey=f.getDocument(),work=f.nativeWorking();
  const sceneId=journey.scenes[state.sceneIndex].id,binding=work.bindings[sceneId];
  return {scene_id:sceneId,scene_ref:binding?.scene_ref??null,view_ids:state.selected,
   entity_refs:state.selected.map(id=>binding?.occurrences.find(o=>o.view_entity_id===id)?.entity_ref??null),
   revision:work.revision,pending:work.pending,busy:work.busy};
 });
 const requireLocal=async entityRef=>{const focus=await localFocus();assert.equal(focus.scene_ref,sceneRef);assert.deepEqual(focus.entity_refs,[entityRef]);assert.equal(focus.view_ids.length,1);return focus;};
 await requireLocal(target);
 captureDOM=async label=>{
  const value=await frame.evaluate(()=>{
   const bar=document.querySelector('.epi-world-entrance'),alert=bar?.querySelector('[role="alert"]'),choose=bar?.querySelector('[data-epi-body]');
   const work=window.__FIELD_STUDIES__?.nativeWorking();
   return {alert_text:alert?.textContent??null,alert_visible:!!alert&&alert.getClientRects().length>0&&getComputedStyle(alert).visibility!=='hidden'&&getComputedStyle(alert).display!=='none',
    choose_disabled:choose?.disabled??null,choose_value:choose?.value??null,source_open:!!document.querySelector('.epi-source-dialog')?.open,
    native_working:{native_ref:work?.native_ref,revision:work?.revision,pending:work?.pending,busy:work?.busy,failed:work?.failed,notice:work?.notice}};
  });
  const bytes=JSON.stringify(value,null,2)+'\n';assert.ok(Buffer.byteLength(bytes)<=64*1024);const file=label+'.dom.json';await writeFile(resolve(cfg.output,file),bytes);
  return {...value,file,bytes:Buffer.byteLength(bytes),sha256:hash(bytes)};
 };
 const errorText={
  'navigation-native-refusal':'The native owner did not accept this navigation. Inspect the retained operation, then choose the body again.',
  'navigation-local-changed':'The selected Scene, body, person or occasion changed before navigation completed. Choose the body again.',
 }[cfg.selection_case];
 const requireTerminal=async(message,entityRef)=>{
  await frame.waitForFunction(({message,entityRef})=>{
   const f=window.__FIELD_STUDIES__,bar=document.querySelector('.epi-world-entrance'),alert=bar?.querySelector('[role="alert"]'),choose=bar?.querySelector('[data-epi-body]');
   const state=f.getState(),journey=f.getDocument(),work=f.nativeWorking(),binding=work.bindings[journey.scenes[state.sceneIndex].id];
   const local=state.selected.map(id=>binding?.occurrences.find(o=>o.view_entity_id===id)?.entity_ref??null);
   return work.busy===false&&!!choose&&!choose.disabled&&local.length===1&&local[0]===entityRef
    &&(message?!!alert&&alert.textContent===message&&alert.getClientRects().length>0&&getComputedStyle(alert).visibility!=='hidden'&&getComputedStyle(alert).display!=='none':!alert);
  },{message,entityRef},{timeout:30000});
  await requireLocal(entityRef);assert.equal(await instrument.isVisible(),false,'Navigation must not open a conversation');
 };
 const openActualSource=async()=>{
  const at=report.requests.length;await frame.locator('[data-epi="source"]').click();
  await frame.waitForFunction(()=>{
   const dialog=document.querySelector('.epi-source-dialog');return !!dialog?.open&&dialog.textContent.includes('dcb274c1-fbbc-5914-b27d-dea979c78558')
    &&dialog.textContent.includes('M4.4.4.4')&&dialog.querySelectorAll('dl dt').length===64
    &&dialog.textContent.includes('Typed relations · 23')
    &&dialog.textContent.includes('907c46bc8a65b47e12f14aa4d8b444263dc956a1a7b4b6d038e57223d6073288')
    &&!document.querySelector('[data-epi="source"]').disabled;
  },null,{timeout:30000});
  const sourceRequests=report.requests.slice(at).filter(row=>row.op==='nara_coordinate'&&row.coordinate_ref==='ql:m-coordinate:bimba:M4.4.4.4'&&row.face==='bimba'&&row.source_only===true);
  assert.equal(sourceRequests.length,1,'Ordinary disclosure must issue exactly one actual selected-coordinate source-only native request');
  report.actual_navigation_source_request=sourceRequests[0];
  report.navigation_source_disclosure={coordinate:'M4.4.4.4',uuid:'dcb274c1-fbbc-5914-b27d-dea979c78558',properties:64,incident_relations:23,
   source_revision:'907c46bc8a65b47e12f14aa4d8b444263dc956a1a7b4b6d038e57223d6073288',standing:'Actual selected-source DOM and issued native request; no fresh-model answer'};
 };
 await observeNavigationTransport();
 const ordinaryInspectReplies=[];
 // Count only the native HTTP read issued synchronously by this actual
 // iframe kind/req. Personal-current host reads stay active and uncounted.
 // An actual matching application ACK is additionally required below.
 page.on('response',response=>{
  const request=response.request(),channelReq=navigationRequestId(request.url());if(channelReq===null||request.method()!=='POST')return;
  const raw=request.postData();if(!raw||Buffer.byteLength(raw)>64*1024)return;let sent;try{sent=JSON.parse(raw);}catch{return;}
  if(sent.op!=='expression'||sent.request?.operation!=='inspect'||sent.request.expression_ref!==cfg.expression_ref)return;
  const observed=(async()=>{
   const ordinal=ordinaryInspectReplies.length,request_file=`navigation-owner-inspect-${ordinal}.request.json`,response_file=`navigation-owner-inspect-${ordinal}.response.json`;
   assert.deepEqual(sent,{op:'expression',request:{operation:'inspect',expression_ref:cfg.expression_ref}});
   assert.equal(raw,JSON.stringify({op:'expression',request:{operation:'inspect',expression_ref:cfg.expression_ref}}),'Diagnostic URL preserves the exact production native request bytes');
   assert.equal(response.ok(),true);const declared=response.headers()['content-length'];assert.match(declared??'',/^(0|[1-9][0-9]*)$/);assert.ok(Number(declared)<=64*1024*1024);
   const bytes=await response.body();assert.equal(bytes.length,Number(declared));const value=JSON.parse(bytes);assert.equal(value.ok,true);assert.equal(value.outcome?.result,'expression');assert.ok(value.outcome.data.document);
   await writeFile(resolve(cfg.output,request_file),raw);await writeFile(resolve(cfg.output,response_file),bytes);
   return {kind:'kernel-expression',req:channelReq,url:request.url(),request_file,response_file,request_sha256:hash(raw),response_sha256:hash(bytes),response_bytes:bytes.length,native_data:value.outcome.data,document:value.outcome.data.document,unchanged_actual_response:true};
  })().catch(error=>({failure:String(error)}));ordinaryInspectReplies.push(observed);
 });
 const actualAppFocusResponses=[];
 let expected=before.document,expectedLocal=target;
 if(cfg.selection_case==='navigation-native-refusal'){
  const changed=await native({operation:'edit',expression_ref:cfg.expression_ref,expected_revision:before.document.revision,actor:'human:controlled-navigation-refusal',changes:[{change:'focus',scene_ref:sceneRef,entity_ref:other}]});
  assert.ok(changed.document);exactFocusOnly(before.document,changed.document,sceneRef,other);expected=changed.document;
  assert.equal((await localFocus()).revision,before.document.revision,'Do not silently refresh the app old-CAS basis');
  page.on('response',response=>{
   const request=response.request();if(request.url()!==cfg.bridge+'/op'||request.method()!=='POST')return;
   const raw=request.postData();if(!raw||Buffer.byteLength(raw)>32*1024*1024)return;let sent;try{sent=JSON.parse(raw);}catch{return;}
   const change=sent.request?.changes?.[0];if(sent.op!=='expression'||sent.request?.operation!=='edit'||sent.request.expression_ref!==cfg.expression_ref
    ||sent.request.actor!=='human:expressions-app'||change?.change!=='focus'||change.scene_ref!==sceneRef||change.entity_ref!==other)return;
   const observed=(async()=>{
    const ordinal=actualAppFocusResponses.length,request_file=`navigation-focus-refusal-${ordinal}.request.json`,response_file=`navigation-focus-refusal-${ordinal}.response.json`;
    await writeFile(resolve(cfg.output,request_file),raw);
    assert.deepEqual(sent,{op:'expression',request:{operation:'edit',expression_ref:cfg.expression_ref,expected_revision:before.document.revision,actor:'human:expressions-app',changes:[{change:'focus',scene_ref:sceneRef,entity_ref:other}]}});
    assert.equal(response.ok(),true);const declared=response.headers()['content-length'];assert.match(declared??'',/^(0|[1-9][0-9]*)$/);assert.ok(Number(declared)<=64*1024);
    const bytes=await response.body();assert.equal(bytes.length,Number(declared));await writeFile(resolve(cfg.output,response_file),bytes);const value=JSON.parse(bytes);
    assert.equal(value.ok,true);assert.equal(value.outcome?.result,'expression');
    assert.deepEqual(value.outcome.data,{state:'revision_conflict',expression_ref:cfg.expression_ref,expected_revision:before.document.revision,current_revision:expected.revision});
    return {request_file,response_file,request_sha256:hash(raw),request_bytes:Buffer.byteLength(raw),response_sha256:hash(bytes),response_bytes:bytes.length,actual_native_result:value.outcome.data,unchanged_actual_response:true};
   })().catch(error=>({failure:String(error)}));actualAppFocusResponses.push(observed);
  });
 }
 if(cfg.selection_case==='navigation-return-positive'||cfg.selection_case==='navigation-local-changed')await openActualSource();
 report.before_navigation_dom=await captureDOM('before-navigation');
 assert.ok(!errorText||!report.before_navigation_dom.alert_visible||report.before_navigation_dom.alert_text!==errorText,'New refusal cannot be pre-existing');
 assert.equal(report.before_navigation_dom.choose_disabled,false);assert.equal(report.before_navigation_dom.native_working.busy,false);
 if(cfg.selection_case==='navigation-local-changed'){
  let observed,release,claimed=false;const heldObserved=new Promise(resolve=>{observed=resolve;}),released=new Promise(resolve=>{release=resolve;});releaseHeld=release;
  await page.route(url=>navigationRequestId(url.href)!==null,async route=>{
   const raw=route.request().postData();let request;try{request=raw&&JSON.parse(raw);}catch{}
   if(claimed||request?.op!=='expression'||request.request?.operation!=='inspect'||request.request.expression_ref!==cfg.expression_ref){await route.continue();return;}
   const channelReq=navigationRequestId(route.request().url());assert.ok(channelReq!==null);
   assert.deepEqual(request,{op:'expression',request:{operation:'inspect',expression_ref:cfg.expression_ref}});
   claimed=true;const response=await route.fetch();assert.ok(response.ok());const declared=response.headers()['content-length'];assert.match(declared??'',/^(0|[1-9][0-9]*)$/);assert.ok(Number(declared)<=64*1024*1024);
   const bytes=await response.body();assert.equal(bytes.length,Number(declared));const real=JSON.parse(bytes);assert.equal(real.ok,true);assert.equal(real.outcome?.result,'expression');assert.deepEqual(real.outcome.data.document,before.document);
   await writeFile(resolve(cfg.output,'navigation-held-inspect.request.json'),raw);await writeFile(resolve(cfg.output,'navigation-held-inspect.response.json'),bytes);
   report.held_actual_navigation_inspect={kind:'kernel-expression',req:channelReq,url:route.request().url(),request_sha256:hash(raw),response_sha256:hash(bytes),response_bytes:bytes.length,request_file:'navigation-held-inspect.request.json',response_file:'navigation-held-inspect.response.json',unchanged_actual_response:true};
   observed();await released;await route.fulfill({response});
  });
  await frame.locator('[data-epi-source="return"]').click();
  let timer;try{await Promise.race([heldObserved,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('The ordinary navigation independent native inspect was not held in30s')),30000);})]);}finally{clearTimeout(timer);}
  assert.equal(await frame.locator('.epi-source-dialog').evaluate(dialog=>dialog.open),false,'Source Return must close disclosure before its held navigation read');
  await local(other);await requireLocal(other);
  const changed=await native({operation:'edit',expression_ref:cfg.expression_ref,expected_revision:before.document.revision,actor:'human:controlled-navigation-current-basis',changes:[{change:'focus',scene_ref:sceneRef,entity_ref:other}]});
  assert.ok(changed.document);exactFocusOnly(before.document,changed.document,sceneRef,other);expected=changed.document;expectedLocal=other;
  releaseHeld();releaseHeld=null;
 }else if(cfg.selection_case==='navigation-return-positive')await frame.locator('[data-epi-source="return"]').click();
 else await frame.locator('[data-epi-body]').selectOption(other);
 if(cfg.selection_case==='navigation-choose-positive'){
  const after=await waitCurrent(other);exactFocusOnly(before.document,after.document,sceneRef,other);expected=after.document;expectedLocal=other;
 }
 await requireTerminal(errorText,expectedLocal);
 const after=await inspect();if(cfg.selection_case==='navigation-return-positive')exactFocusOnly(before.document,after.document,sceneRef,target);else assert.deepEqual(after.document,expected);
 assert.deepEqual(await frame.evaluate(()=>window.__FIELD_STUDIES__.getDocument()),beforeJourney,'Navigation must preserve every authored body/layout/source/private/occasion field');
 if(cfg.selection_case==='navigation-native-refusal'){
  assert.equal(actualAppFocusResponses.length,1,'One actual app stale-CAS response is mandatory');report.actual_app_navigation_refusal=await actualAppFocusResponses[0];assert.ok(!report.actual_app_navigation_refusal.failure,report.actual_app_navigation_refusal.failure);
  const work=await frame.evaluate(()=>window.__FIELD_STUDIES__.nativeWorking());assert.equal(work.pending,'selection','Retain the actual refused focus for Inspect');
 }
 if(cfg.selection_case==='navigation-native-refusal')assert.equal(ordinaryInspectReplies.length,0,'Refused navigation must stop before independent readback');
 else {
  assert.equal(ordinaryInspectReplies.length,1,'One actual production navigation owner inspection is mandatory; test-side reads cannot stand in');
  const observed=await ordinaryInspectReplies[0];assert.ok(!observed.failure,observed.failure);
  assert.deepEqual(observed.document,cfg.selection_case==='navigation-local-changed'?before.document:after.document,'Qualify the actual production owner reply against independent pre-action or post-action basis');
  const ackRaw=await frame.evaluate(req=>window.__EPI_NAVIGATION_ACK_OBSERVER__.take(req),observed.req);
  assert.ok(Buffer.byteLength(ackRaw)<=64*1024*1024);const ack=JSON.parse(ackRaw);
  assert.equal(ack.v,1);assert.equal(ack.kind,observed.kind+'-result');assert.equal(ack.req,observed.req);assert.equal(ack.ok,true);
  assert.deepEqual(ack.data,observed.native_data,'The actual application ACK must carry this exact real native owner reply');
  const ack_file='navigation-owner-inspect.application-ack.json';await writeFile(resolve(cfg.output,ack_file),ackRaw);
  const {document:observedDocument,native_data:observedData,...ref}=observed;
  report.actual_ordinary_navigation_inspect={...ref,application_ack:{file:ack_file,bytes:Buffer.byteLength(ackRaw),sha256:hash(ackRaw),kind:ack.kind,req:ack.req,unchanged_actual_reply:true}};
 }
 const requestChannel=await page.evaluate(()=>window.__EPI_NAVIGATION_REQUEST_OBSERVER__.snapshot()),ackChannel=await frame.evaluate(()=>window.__EPI_NAVIGATION_ACK_OBSERVER__.snapshot());
 assert.deepEqual(requestChannel.failures,[]);assert.deepEqual(ackChannel.failures,[]);
 const expectedReads=cfg.selection_case==='navigation-native-refusal'?0:1;
 assert.equal(requestChannel.requests.length,expectedReads,'Exact actual iframe navigation Inspect request count');
 assert.equal(ackChannel.expected.length,expectedReads);assert.equal(ackChannel.received.length,expectedReads,'Exact genuine navigation application ACK count');
 if(expectedReads){
  const observed=await ordinaryInspectReplies[0];assert.equal(requestChannel.requests[0].kind,observed.kind);assert.equal(requestChannel.requests[0].req,observed.req);assert.equal(requestChannel.requests[0].url,observed.url);
  assert.equal(ackChannel.expected[0],observed.req);assert.equal(ackChannel.received[0].req,observed.req);
 }
 report.actual_navigation_channel={requestChannel,ackChannel,scope:'Actual iframe request → unchanged native POST body → genuine HTTP reply → same req application ACK; diagnostic URL only; periodic personal current reads remain active'};
 await page.evaluate(()=>window.__EPI_NAVIGATION_REQUEST_OBSERVER__.stop());await frame.evaluate(()=>window.__EPI_NAVIGATION_ACK_OBSERVER__.stop());
 report.after_navigation_dom=await captureDOM('after-navigation');
 assert.equal(report.after_navigation_dom.source_open,false);assert.equal(report.after_navigation_dom.choose_disabled,false);
 if(errorText){assert.equal(report.after_navigation_dom.alert_text,errorText);assert.equal(report.after_navigation_dom.alert_visible,true);}
 report.navigation={case:cfg.selection_case,passed:true,before_revision:before.document.revision,after_revision:after.document.revision,
  local_focus:await requireLocal(expectedLocal),native_focus:after.document.selection,complete_journey_sha256:hash(JSON.stringify(beforeJourney)),
  whole_document_conservation:'Exact complete Document; only an acknowledged focus/revision or the recorded external focus is allowed',
  saved_file_conservation:'The existing independent before/after native inspect_file/file_read/physical hash gates remain mandatory'};
 report.checks.push('Actual '+cfg.selection_case+' retained exact local/native focus and complete source/person/occasion/material on acknowledged or refused ordinary navigation');
 assert.ok(!report.requests.slice(requestStart).some(v=>(v.op==='encounter'&&['prompt','draft'].includes(v.action))||['send','epii_delegate'].includes(v.operation)),'Selection qualification must not send a model question');
 }else{
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
 report.nara_receiving_before_ask=await captureNaraReceiving('before-ask');
 if(expectedRefusal)assert.ok(!report.before_ask_dom.alert_visible||report.before_ask_dom.alert_text!==expectedRefusal,'The expected new refusal must not already be visible before Ask');
 assert.equal(report.before_ask_dom.ask_disabled,false,'Ordinary Ask must be available before this operation starts');
 assert.equal(report.before_ask_dom.native_working.busy,false,'Original native selection must be terminal before Ask starts');
 assert.equal(await instrument.isVisible(),false,'Conversation must still be closed immediately before Ask');
 const requestStart=report.requests.length;await frame.locator('[data-epi="ask"]').click();
 if(heldObserved){let timer;try{await Promise.race([heldObserved,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('The original current native inspect was not held in30s')),30000);})]);}finally{clearTimeout(timer);}await local(other);releaseHeld();releaseHeld=null;}
 if(cfg.selection_case==='positive'){
  const naraWaitStarted=Date.now();report.nara_receiving_wait={started_at_unix_ms:naraWaitStarted,timeout_ms:30000};
  try{
  await instrument.waitFor({state:'visible',timeout:30000});const after=await inspect();exactFocusOnly(expected,after.document,sceneRef,target);assert.equal(after.document.selection.relation_ref,undefined);report.checks.push('Actual ordinary With Nara/Epii opened only on exact acknowledged local/native personal hub focus');
  const remaining=30000-(Date.now()-naraWaitStarted);assert.ok(remaining>0,'The conversation read must fit the original30s header receiving aperture');
  await frame.waitForFunction(basis=>{
   const panel=document.querySelector('.nara-personal'),conversation=panel?.querySelector('.nara-conversation-layout');
   const rows=window.__EPI_INITIAL_CHANNEL_PHASES__?.().rows??[];
   const ackIndex=rows.findLastIndex(row=>row.phase==='reply-received-by-application'&&row.schema==='oi.nara-instrument-state/v1'&&row.ok&&row.at>=basis.started
    &&row.identity_source_ref===basis.source_ref&&row.identity_source_revision===basis.source_revision&&row.identity_input_revision===basis.input_revision
    &&row.person_ref===basis.person_ref&&row.nara_ref===basis.nara_ref&&row.expression_ref===basis.expression_ref&&row.document_revision===basis.revision
    &&row.scene_ref===basis.scene_ref&&row.entity_ref===basis.entity_ref&&!row.relation_ref);
   return ackIndex>=0&&!rows.slice(ackIndex+1).some(row=>row.phase==='identity-release-received-by-application')&&panel?.getClientRects().length>0&&panel.querySelector('.nara-personal-content')?.getAttribute('aria-busy')==='false'
    &&panel.querySelector('select[aria-label="Saved profiles"]')?.value===basis.source_ref
    &&conversation?.querySelector('aside h2')?.textContent===panel.querySelector('h1')?.textContent
    &&!!conversation&&conversation.querySelector('aside h2')?.textContent!=='Choose your identity'
    &&conversation.querySelector('aside h2+p')?.textContent==='Selected: '+basis.title;
  },{started:naraWaitStarted,source_ref:carrier.identity_source.source_ref,source_revision:carrier.identity_source.revision,input_revision:carrier.identity_input_revision,
   person_ref:carrier.person_ref,nara_ref:carrier.nara_ref,expression_ref:cfg.expression_ref,revision:after.document.revision,scene_ref:sceneRef,entity_ref:target,title:document.entities[target].title},{timeout:remaining});
  assert.ok(Date.now()-naraWaitStarted<30000,'A late channel or DOM reply cannot qualify the original header receiving aperture');
  report.nara_receiving_wait.completed_at_unix_ms=Date.now();report.nara_receiving_after_ask=await captureNaraReceiving('after-ask');
  report.checks.push('The same header aperture receives its actual saved-person and selected-body conversation read without sending a provider question');
  }catch(error){report.nara_receiving_wait.failed_at_unix_ms=Date.now();throw error;}
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
 assert.ok(!report.requests.slice(requestStart).some(v=>(v.op==='encounter'&&['prompt','draft'].includes(v.action))||['send','epii_delegate'].includes(v.operation)),'Selection qualification must not send a model question'); }
 assert.deepEqual(errors,[]);if(selectionOnly){await qualifyHostedDurable('after actual selection outcome');await qualifyHostedOwner();report.portable_custody_after=requalifyPortableCurrentCustody(hostedSourceExpectation,hostedSourceQualification);}report.passed=true;
}catch(error){report.failure=String(error);
 if(frame)try{report.failed_nara_receiving=await captureNaraReceiving('failed');}catch(diagnostic){report.failed_nara_receiving_diagnostic=shortError(diagnostic);}
 if(navigationCase){
  try{report.failed_navigation_request_channel=await page.evaluate(()=>window.__EPI_NAVIGATION_REQUEST_OBSERVER__?.snapshot()??null);}catch(diagnostic){report.failed_navigation_request_diagnostic=String(diagnostic);}
  try{report.failed_navigation_ack_channel=await frame.evaluate(()=>window.__EPI_NAVIGATION_ACK_OBSERVER__?.snapshot()??null);}catch(diagnostic){report.failed_navigation_ack_diagnostic=String(diagnostic);}
 }
 if(captureDOM)try{report.failed_current_dom=await captureDOM('failed-current');}catch(diagnostic){report.failed_dom_diagnostic_error=String(diagnostic);}throw error;}finally{
 releaseHeld?.();if(frame)try{await frame.locator('#nara-instrument').press('Escape');}catch{}if(browser)await browser.close();await writeFile(resolve(cfg.output,'receipt.json'),JSON.stringify(report,null,2)+'\n');
}
