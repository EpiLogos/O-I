/** Real ordinary Epi entry: the production application/index HTML, actual
 * desktop host relay, native kernel, QL companions and resident GPU receiver.
 * Run serially against an explicitly supplied bridge. No transport fallback,
 * invented domain data, component mount or replacement material producer.
 * This is candidate browser/native evidence, not an installed Mac claim. */
import assert from 'node:assert/strict';
import {isDeepStrictEqual} from 'node:util';
import {createEpiFirstRestReceivingGate} from './epi-first-rest-receiving.mjs';
import {prepareSavedIdentityUseRefusals} from './epi-saved-identity-use-refusals.mjs';
import {readFileSync,writeFileSync,mkdirSync,openSync,readSync,closeSync,constants,fstatSync,lstatSync,realpathSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {createServer} from 'vite';
import react from '@vitejs/plugin-react';
import {build} from 'esbuild';
import {chromium} from 'playwright';
import {runSceneDampingGate} from './epi-scene-damping-native-proof.mjs';
import {runSceneAxisGate,runSceneAxisRestartGate} from './epi-scene-axis-native-proof.mjs';
import {runPersonalModalConsumerProof,runSavedPersonalReleaseGate,runColdPersonalDraftGate} from './epi-personal-native-proof.mjs';
import {qualifyPortableNativeSourceExpectation,qualifyPortableRuntimeExecution,requalifyPortableCurrentCustody} from './epi-world-portable-custody.mjs';

assert.ok(process.argv[2],'Supply a JSON configuration with bridge, output and two identity_files');
const config=JSON.parse(readFileSync(resolve(process.argv[2]),'utf8'));
if(config.cold_opening_no_motion_preference!==undefined)assert.equal(typeof config.cold_opening_no_motion_preference,'boolean');
const coldOpening=config.cold_opening_no_motion_preference===true;
if(coldOpening)assert.ok(config.reopen_file&&!config.existing_expression_ref&&!config.stage,'The no-preference cold gate runs the original whole workload through an actual saved native file');
const selectionStage=['selected-conversation-setup','selected-conversation-case'].includes(config.stage);
if(selectionStage){
 assert.ok(config.reopen_file&&config.selection_custody_file&&config.selection_custody_sha256,'Selection qualification requires actual file admission and source-built owner custody');
 assert.ok(!config.reopen_acknowledgement_file&&!config.reopen_expected&&!config.existing_expression_ref,'This isolated gate cannot substitute for the original whole/restart continuation');
 if(config.stage==='selected-conversation-case')assert.ok(['positive','native-refusal','native-changed','local-changed','navigation-choose-positive','navigation-return-positive','navigation-native-refusal','navigation-local-changed','required-cosmic-body-disabled'].includes(config.selection_case));
}

if(config.reopen_file!==undefined)assert.equal(typeof config.reopen_file,'string','reopen_file must be the actual Central-relative path accepted by the production app file-opening API');
if(config.reopen_acknowledgement_file)assert.ok(config.reopen_file,'Fresh process arrival requires ordinary file opening through the native file owner');
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const app=resolve(root,'expressions-app/field-studies-journeys');
// Import the production authored-stage conversion owner. QL torus units per
// metre qualify a different mapping and must never project resident bodies.
const scaleSource=resolve(app,'src/nativeParameters.ts'),limitsSource=resolve(root,'expressions-app/src/engine/fieldModel.ts');
const scaleModule=await build({stdin:{contents:`export {WORLD_SCALE} from ${JSON.stringify(scaleSource)};export {MAX_FORMATIONS,MAX_PINS} from ${JSON.stringify(limitsSource)};`,resolveDir:root,loader:'ts'},bundle:true,write:false,format:'esm',platform:'node',logLevel:'silent'});
const {WORLD_SCALE,MAX_FORMATIONS,MAX_PINS}=await import('data:text/javascript,'+encodeURIComponent(scaleModule.outputFiles[0].text));
// Generic source-owned presentation conversion, kept distinct from the
// independently derived native pair/clock expectation in the axis gate.
const geometryOwner=resolve(root,'expressions-app/src/engine/formationGeometryProjection.ts'),poseOwner=resolve(root,'expressions-app/src/engine/entityPose.ts'),bridgeOwner=resolve(app,'src/nativeBridge.ts'),runtimeOwner=resolve(root,'expressions-app/src/engine/entityRuntime.ts');
const baseScaleMatch=readFileSync(runtimeOwner,'utf8').match(/^const BASE_SCALE = ([0-9.]+);$/m);assert.ok(baseScaleMatch,'Exact production local-unit source');
const projectionModule=await build({stdin:{contents:`export {geometryCandidates} from ${JSON.stringify(geometryOwner)};export {resolveEntityPose} from ${JSON.stringify(poseOwner)};export {toNativeEntity,toNativeConfig} from ${JSON.stringify(bridgeOwner)};`,resolveDir:root,loader:'ts'},bundle:true,write:false,format:'esm',platform:'node',logLevel:'silent'});
const projectionOwners={...await import('data:text/javascript,'+encodeURIComponent(projectionModule.outputFiles[0].text)),baseScale:Number(baseScaleMatch[1])};

assert.ok(Number.isFinite(WORLD_SCALE)&&WORLD_SCALE>0,'The actual production stage conversion owner is required');
assert.ok(Number.isSafeInteger(MAX_FORMATIONS)&&MAX_FORMATIONS>0&&Number.isSafeInteger(MAX_PINS)&&MAX_PINS>0,'Use actual renderer limits');
const out=resolve(config.output);mkdirSync(out,{recursive:true});
const entryPath=resolve(config.app_entry??resolve(app,'public/index.html'));
const entry=readFileSync(entryPath,'utf8');
const sha=value=>createHash('sha256').update(value).digest('hex');
const nativeOwnerExpectationPath=config.native_owner_expectation_file?resolve(config.native_owner_expectation_file):null;
const nativeOwnerExpectationBytes=nativeOwnerExpectationPath?readFileSync(nativeOwnerExpectationPath):null;
const nativeOwnerExpectation=nativeOwnerExpectationBytes?JSON.parse(nativeOwnerExpectationBytes.toString('utf8')):null;
const nativeOwnerExpectationSha256=nativeOwnerExpectationBytes?sha(nativeOwnerExpectationBytes):null;
let nativeSourceQualification=null;
if(nativeOwnerExpectation){
 assert.equal(nativeOwnerExpectation.owner_cut,config.binaries?.quaternal_logic?.source_cut,'Current native owner expectations must name the independently qualified managed cut');
 // Freeze and qualify predictions before any native request. Replies never supply expected values.
 if(nativeOwnerExpectation.schema==='epi.native-world-source-expectation/v3')nativeSourceQualification=qualifyPortableNativeSourceExpectation(nativeOwnerExpectation,{originalWorldFile:config.original_owner_world_file,currentCut:config.binaries?.quaternal_logic?.source_cut});
 else if(nativeOwnerExpectation.schema==='epi.native-world-source-expectation/v2')nativeSourceQualification=qualifyNativeSourceExpectation(nativeOwnerExpectation);
 else assert.equal(nativeOwnerExpectation.semantic_metadata_transition,undefined,'Metadata transitions require an independently source-qualified v2 or v3 expectation');
}
const json=(name,value)=>writeFileSync(resolve(out,name),JSON.stringify(value,null,2)+'\n');
const identities=(config.identity_files??[]).map(path=>JSON.parse(readFileSync(resolve(path),'utf8')));
assert.equal(identities.length,2,'Two actual saved controlled identities are required');
for(const identity of identities)assert.ok(identity.source?.source_ref&&identity.source?.revision&&identity.reading?.person_ref,'Use acknowledged native InstrumentIdentity readings');
assert.notEqual(identities[0].reading.person_ref,identities[1].reading.person_ref);
assert.match(config.bridge,/^http:\/\/127\.0\.0\.1:\d+$/,'Use an explicit actual local bridge');
const receipt={schema:'oi.epi-world-production-native-proof/v1',passed:false,
 scope:'Actual ordinary production application and host relay through a controlled native bridge; Chromium resident GPU; no installation or physical audio assertion',
 bridge:config.bridge,verifier:{path:fileURLToPath(import.meta.url),sha256:sha(readFileSync(fileURLToPath(import.meta.url)))},entry:{path:entryPath,sha256:sha(entry)},checks:[],artifacts:[],operations:[],issued_requests:[],request_failures:[],boot_network:[],console:[],navigations:[],errors:[],binaries:config.binaries??{},
 verifier_render_limits:{owner:limitsSource,sha256:sha(readFileSync(limitsSource)),max_formations:MAX_FORMATIONS,max_pins:MAX_PINS},
 axis_verifier:{path:resolve(root,'tests/epi-scene-axis-native-proof.mjs'),sha256:sha(readFileSync(resolve(root,'tests/epi-scene-axis-native-proof.mjs'))),presentation_sources:[geometryOwner,poseOwner,bridgeOwner,runtimeOwner].map(path=>({path,sha256:sha(readFileSync(path))}))},
 personal_verifier:{path:resolve(root,'tests/epi-personal-native-proof.mjs'),sha256:sha(readFileSync(resolve(root,'tests/epi-personal-native-proof.mjs')))},
 verifier_projection_units:{owner:scaleSource,sha256:sha(readFileSync(scaleSource)),world_scale:WORLD_SCALE,meaning:'Resident GPU coordinates divided by the actual authored-stage WORLD_SCALE before production projectNative; QL torus presentation units remain distinct'},
 independent_source_expectations:(config.independent_expectation_files??[]).map(path=>({path:resolve(path),sha256:sha(readFileSync(resolve(path)))})),
 source:Object.fromEntries(['src/expressions/hostedApp.ts','src/expressions/nativeChannel.ts','src/expressions/naraChannel.ts','expressions-app/field-studies-journeys/src/app.ts','expressions-app/field-studies-journeys/src/epiWorldProduction.ts','expressions-app/field-studies-journeys/src/sceneWorkflow.ts','expressions-app/field-studies-journeys/src/sceneCorrespondence.ts','expressions-app/field-studies-journeys/src/native-field/channel.ts','expressions-app/field-studies-journeys/src/epiWorldMaterial.ts','expressions-app/field-studies-journeys/src/nativeWorkspace.ts','expressions-app/field-studies-journeys/src/naraEvidenceField.ts','expressions-app/field-studies-journeys/src/naraInstrument.tsx','expressions-app/field-studies-journeys/src/kernelDocumentBridge.ts','expressions-app/src/engine/fieldModel.ts','expressions-app/src/engine/PointCloudField.ts','expressions-app/src/engine/LocalizedResonanceBank.ts','expressions-app/src/engine/localizedResonanceProjection.ts'].map(p=>[p,sha(readFileSync(resolve(root,p)))]))};
if(selectionStage){receipt.schema='oi.epi-selected-conversation-hosted-stage/v1';receipt.selection_case=config.selection_case??null;receipt.scope=config.selection_case==='required-cosmic-body-disabled'?'Actual isolated source-built native material/body counterproof and original restored receiving; whole/answer/provider/Keep/restart/installed/H remain unaccepted':'Actual isolated source-built ordinary file admission and selected-focus receiving only; whole/answer/provider/Keep/restart/installed/H remain unaccepted';}
let server,browser,page,frame,phase='setup',heartbeat;const nativeComposes=[],nativePrepared=[],nativeFrames=[],nativeInspections=[],nativeM3=[];
const check=(value,label)=>{assert.ok(value,label);receipt.checks.push(label);console.log('PASS',label);json('receipt.json',receipt);};
const artifact=(name,value)=>{json(name,value);receipt.artifacts.push(name);};
const retainStage=label=>{receipt.current_stage=label;(receipt.stage_events??=[]).push({stage:label,phase,at:new Date().toISOString(),completed_checks:receipt.checks.length,issued_requests:receipt.issued_requests.length,response_arrivals:receipt.operations.length,request_failures:receipt.request_failures.length});json('receipt.json',receipt);console.log('STAGE',label);};
const summarizeRequest=q=>({op:q?.op,operation:q?.request?.operation,expression_ref:q?.request?.expression_ref,coordinate_ref:q?.request?.coordinate_ref??q?.request?.request?.coordinate_ref});
// Test custody only: hold the unchanged actual write ACK while qualifying its
// exact private controlled record. Recovery never dispatches the pending edit.
// The original Save/file/readback/reopen/restart predicates remain below.
async function armActualRecoverySaveCustody(expectedExpressionRef){
 const url=config.bridge+'/op',limit=8*1024*1024+2048;
 assert.ok(config.controlled_recovery_home,'The original whole must name its actual controlled native OI_HOME');
 const home=resolve(config.controlled_recovery_home);
 assert.equal(realpathSync(home),home,'Controlled recovery home must be a canonical existing directory');
 const owner=process.getuid(),report={schema:'oi.epi-actual-recovery-save-custody/v1',passed:false,home,expression_ref:expectedExpressionRef,observations:[],records:[],errors:[],scope:'Actual source-built controlled native Save checkpoint; full raw request/ACK/native Read retained in this private test artifact. No installed847 or private owner admission.'};
 const pending=new Set(),deadline=Date.now()+180000;let closed=false;
 const remaining=()=>{const value=deadline-Date.now();assert.ok(value>0,'Actual Save custody stays within the original 180s action bound');return value;};
 const privateBytes=path=>{
  for(const directory of [home,resolve(home,'desktop'),resolve(home,'desktop/expression-recovery'),resolve(home,'desktop/expression-recovery/expressions')]){
   const stat=lstatSync(directory);assert.ok(stat.isDirectory()&&!stat.isSymbolicLink()&&stat.uid===owner);
   if(directory!==home&&directory!==resolve(home,'desktop'))assert.equal(stat.mode&0o777,0o700);
  }
  const fd=openSync(path,constants.O_RDONLY|constants.O_NOFOLLOW);
  try{
   const before=fstatSync(fd);assert.ok(before.isFile()&&before.uid===owner&&before.nlink===1&&(before.mode&0o777)===0o600&&before.size<=limit);
   const bytes=readFileSync(fd),after=fstatSync(fd);assert.equal(bytes.length,before.size);
   assert.equal(after.dev,before.dev);assert.equal(after.ino,before.ino);assert.equal(after.size,before.size);assert.equal(after.mtimeMs,before.mtimeMs);assert.equal(after.ctimeMs,before.ctimeMs);
   return{bytes,physical:{path,bytes:bytes.length,sha256:sha(bytes),uid:before.uid,mode:before.mode&0o777,nlink:before.nlink,device:before.dev,inode:before.ino}};
  }finally{closeSync(fd);}
 };
 const nativeRead=async request=>{
  const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(request),signal:AbortSignal.timeout(remaining())});
  const raw=await response.text();assert.ok(Buffer.byteLength(raw)<=64*1024*1024);assert.equal(response.status,200);
  const body=JSON.parse(raw);assert.equal(body.ok,true);assert.equal(body.outcome.result,'expression_recovery');assert.equal(body.outcome.data.state,'ready');
  return{request,raw,response:body,record:body.outcome.data.record};
 };
 const qualify=async route=>{
  const request=route.request(),raw=request.postData();let sent;
  try{if(request.method()==='POST'&&raw&&Buffer.byteLength(raw)<=64*1024*1024)sent=JSON.parse(raw);}catch{}
  if(sent?.op!=='expression_recovery'||sent.request?.operation!=='write'||sent.request?.kind!=='checkpoint'||sent.request?.scope!=='expressions'||sent.request?.value?.pending?.kind!=='edit')return route.continue();
  if(sent.request.value.view?.document?.expression_ref!==expectedExpressionRef)return route.continue();
  let actual;
  try{
   actual=await route.fetch({timeout:remaining()});const text=await actual.text();assert.ok(Buffer.byteLength(text)<=64*1024*1024);
   const response=JSON.parse(text),row={at:new Date().toISOString(),request_sha256:sha(raw),request_bytes:Buffer.byteLength(raw),http_status:actual.status(),ok:response.ok,id:sent.request.id};
   assert.ok(report.observations.length<32,'Finite original Save checkpoint observation count');report.observations.push(row);
   if(response.ok!==true){artifact('actual-save-recovery-refusal.json',{request:sent,response});return;}
   assert.equal(response.outcome.result,'expression_recovery');assert.equal(response.outcome.data.state,'written');
   const ack=response.outcome.data.record;assert.equal(ack.id,sent.request.id);assert.equal(ack.scope,'expressions');assert.equal(ack.kind,'checkpoint');assert.deepEqual(ack.value,sent.request.value);
   assert.match(ack.id,/^[A-Za-z0-9_.:-]{1,160}$/);assert.equal(ack.value.draft_id,ack.id);assert.equal(ack.value.view.document.expression_ref,expectedExpressionRef);
   for(const keys of [['view','document'],['view','journey'],['pending','request'],['pending','submitted','journey']])assert.ok(keys.reduce((v,k)=>v?.[k],ack.value),'All four actual bases must remain present');
   const path=resolve(home,'desktop/expression-recovery/expressions',sha('Checkpoint:'+ack.id)+'.json');
   const stored=privateBytes(path),envelope=JSON.parse(stored.bytes.toString('utf8'));row.storage_schema=envelope.schema;row.stored_bytes=stored.bytes.length;row.native_revision=ack.revision;
   // Legacy image-only writes are lawful. Require only an actual rescue record,
   // never force every Save into v2 or alter its actual complete request.
   if(envelope.schema!=='oi.expression-recovery-storage/v2'||report.records.length)return;
   assert.ok(Buffer.byteLength(JSON.stringify(ack.value))>limit,'The actual public checkpoint must require a stored rescue');
   assert.ok(Array.isArray(envelope.parts)&&envelope.parts.length>0,'An actual non-image literal dictionary must be used');
   assert.equal(envelope.record.id,ack.id);assert.equal(envelope.record.kind,ack.kind);assert.equal(envelope.record.scope,ack.scope);assert.equal(envelope.record.revision,ack.revision);
   const read=await nativeRead({op:'expression_recovery',request:{operation:'read',scope:'expressions',kind:'checkpoint',id:ack.id}});
   const find=await nativeRead({op:'expression_recovery',request:{operation:'find_checkpoint',scope:'expressions',expression_ref:expectedExpressionRef}});
   assert.deepEqual(read.record,ack);assert.deepEqual(find.record,ack);
   assert.deepEqual(privateBytes(path).bytes,stored.bytes,'Full native receiving reads must not alter actual pending recovery');
   const full='actual-save-recovery-full-request-ack-read-find.json';artifact(full,{request:sent,response,read:{request:read.request,response:read.response},find:{request:find.request,response:find.response},original_public_json_sha256:sha(JSON.stringify(sent.request.value)),public_json_convention:'JSON.stringify of actual transport value; native full digest is independently consumed by actual Read/FindCheckpoint'});
   report.records.push({operation:'write',scope:ack.scope,kind:ack.kind,id:ack.id,native_revision:ack.revision,full_evidence:full,physical:stored.physical,storage_schema:envelope.schema,expanded_value_sha256:envelope.expanded_value_sha256,part_count:envelope.parts.length,image_count:envelope.images.length,public_transport_bytes:Buffer.byteLength(JSON.stringify(ack.value)),request_ack_read_find_full_equality:true,pending_native_edit_unchanged:true});
  }catch(error){report.errors.push(String(error));}
  finally{
   // Diagnostic qualification must never replace the genuine native reply or
   // leave the application awaiting its actual original Save ACK.
   if(actual){try{await route.fulfill({response:actual});}catch(error){report.errors.push('original response release: '+String(error));}}
   else{try{await route.abort('failed');}catch(error){report.errors.push('failed actual transport cleanup: '+String(error));}}
  }
 };
 const handler=route=>{const promise=qualify(route);pending.add(promise);promise.catch(error=>report.errors.push(String(error))).finally(()=>pending.delete(promise));return promise;};
 await page.route(url,handler);
 return{async close(){
  if(closed)return report;closed=true;
  // Stop admitting new controlled observations; existing actual requests still
  // own their original replies until the bounded handler finally releases them.
  try{await page.unroute(url,handler);}catch(error){report.errors.push('owned route cleanup: '+String(error));}
  const settled=await Promise.allSettled([...pending]);for(const result of settled)if(result.status==='rejected')report.errors.push(String(result.reason));
  report.passed=report.records.length===1&&report.errors.length===0;
  artifact('actual-save-recovery-custody.json',report);return report;
 }};
}

async function op(request,signal){
 const response=await fetch(config.bridge+'/op',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(request),signal});
 const raw=await response.text(),body=JSON.parse(raw);
 const rows=receipt.direct_operations??=[];const evidence=`direct-native-operation-${rows.length+1}.json`,rawEvidence=`direct-native-operation-${rows.length+1}.raw.json`;
 writeFileSync(resolve(out,rawEvidence),raw);receipt.artifacts.push(rawEvidence);
 artifact(evidence,{request,response:body});rows.push({...summarizeRequest(request),evidence,raw_response:{artifact:rawEvidence,bytes:Buffer.byteLength(raw),sha256:sha(raw)}});json('receipt.json',receipt);
 if(body.ok!==true)throw Error(JSON.stringify(body));return body.outcome;
}
async function nativeDocument(ref,signal){const outcome=await op({op:'expression',request:{operation:'inspect',expression_ref:ref}},signal);assert.ok(outcome.data?.document,'Actual Expression owner inspect must return a document');return outcome.data.document;}
async function clickActualBody(entityRef){
 const choice=await frame.evaluate(({ref,scale})=>{
  const f=window.__FIELD_STUDIES__,state=f.inspect(true),record=f.epiWorld(),partition=state.partitions.find(p=>p.entityId===ref);
  if(!partition||partition.end<=partition.start)throw Error('The required body has no actual resident particle partition.');
  const points=[];
  for(let i=0;i<state.particleCount;i++){const offset=i*4,p=f.nativeProject({x:state.positions[offset]/scale,y:state.positions[offset+1]/scale,z:state.positions[offset+2]/scale});points.push(p);}
  const stage=document.getElementById('stage');if(!stage)throw Error('The ordinary receiving Stage is unavailable.');
  const describe=e=>e?{tag:e.tagName,id:e.id,classes:(e.getAttribute('class')??'').slice(0,200),role:(e.getAttribute('role')??'').slice(0,100)}:null;
  const pathAt=p=>{const top=document.elementFromPoint(p.x,p.y),exclusion=top?.closest('button,.nara-kept-answer')??null;
   return {stage_receives:!!top&&stage.contains(top)&&!exclusion,top:describe(top),production_exclusion:describe(exclusion),stack:document.elementsFromPoint(p.x,p.y).slice(0,8).map(describe)};};
  let best=null;const candidates=[];
  // Select a visible isolated surface point of the actual receiving body, not
  // its shared origin or a synthetic marker. The normal pointer path decides
  // the subject; this driver never calls selectEntity to force the result.
  // A rendered particle behind an ordinary control is not a Stage hit. Use
  // the actual DOM hit path and the production Stage's own early exclusions.
  const stride=Math.max(1,Math.floor((partition.end-partition.start)/64));
  for(let i=partition.start;i<partition.end;i+=stride){const p=points[i];if(!p||p.x<35||p.x>innerWidth-35||p.y<145||p.y>innerHeight-65)continue;
   const hit=pathAt(p),candidate={x:p.x,y:p.y,particle_index:i,hit};candidates.push(candidate);if(!hit.stage_receives)continue;
   let clearance=Infinity;for(let j=0;j<points.length;j++){if(j>=partition.start&&j<partition.end)continue;const q=points[j];if(q)clearance=Math.min(clearance,Math.hypot(p.x-q.x,p.y-q.y));}
   candidate.clearance=clearance;
   if(!best||clearance>best.clearance)best={x:p.x,y:p.y,clearance,particle_index:i,entity_ref:ref,partition,hit};
  }
  return {chosen:best,entity_ref:ref,partition,stride,candidates,standing:'Actual resident particles and current DOM hit path, before the normal pointer operation; not a forced selection'};
 },{ref:entityRef,scale:WORLD_SCALE});
 // Keep the genuine candidate/occluder evidence even if click or exact subject
 // acceptance fails. The prior driver wrote this only after its waiting gate.
 artifact('actual-body-hit-'+entityRef.split(':').at(-1)+'.json',choice);
 if(!choice.chosen||choice.chosen.clearance<1)throw Error('No discriminating visible surface point for '+entityRef);
 const bounds=await frame.locator('#stage').boundingBox();assert.ok(bounds);
 await page.mouse.click(bounds.x+choice.chosen.x,bounds.y+choice.chosen.y);
 await frame.waitForFunction(ref=>window.__FIELD_STUDIES__.getState().selected.includes(ref),entityRef,{timeout:10000});
 check(true,'Actual pointer interaction selects the rendered body '+entityRef.split(':').at(-1));
}
async function snapshot(name,particles=false){
 const data=await frame.evaluate(read=>{const f=window.__FIELD_STUDIES__;return{state:f.getState(),working:f.nativeWorking(),record:f.epiWorld(),current:f.epiCurrent(),native:f.native(),document:f.getDocument(),rendered:f.inspect(read),telemetry:f.telemetry()};},particles);
 artifact(name+'.json',data);await page.screenshot({path:resolve(out,name+'.png')});receipt.artifacts.push(name+'.png');return data;
}
async function readyCurrent(person){await frame.waitForFunction(p=>{const f=window.__FIELD_STUDIES__,r=f.epiWorld(),c=f.epiCurrent(),w=f.nativeWorking();
 return(r?.person_ref===p&&c?.reading?.identity?.person_ref===p&&c.context?.event_ref===r.world.event_ref&&!w?.pending)
  ||(w?.native_ref&&w.failed)||Array.from(document.querySelectorAll('.epi-world-entrance [role="alert"]')).some(e=>e.textContent?.trim());
},person,{timeout:180000});await noAlert();const working=await frame.evaluate(()=>window.__FIELD_STUDIES__.nativeWorking());
 assert.ok(!working?.failed,'The actual native owner refused continuation: '+(working?.notice??'unknown native failure'));}
async function noAlert(){const alerts=await frame.locator('.epi-world-entrance [role="alert"]').allTextContents();assert.equal(alerts.filter(Boolean).length,0,'Ordinary Epi operation must not conceal a native failure: '+alerts.join(' / '));}
async function action(name){
 const details=frame.locator('.epi-play');if(await details.count()&&!await details.evaluate(e=>e.open))await details.locator('summary').click();
 await frame.locator(`[data-epi="${name}"]`).click();
 await frame.waitForFunction(()=>!document.querySelector('.epi-world-entrance [role="status"]')?.textContent?.includes('Receiving the native operation'),null,{timeout:180000});await noAlert();
}
async function sceneNavigate(ref){
 await frame.locator(`[data-epi-scene="${ref}"]`).click();
 await frame.waitForFunction(r=>document.querySelector(`[data-epi-scene="${r}"]`)?.getAttribute('aria-current')==='page',ref);await noAlert();
 // Navigation must receive the normal held scene without a verifier physics
 // intervention. Wait for its actual resident partitions and paint frames.
 await frame.waitForFunction(r=>{const f=window.__FIELD_STUDIES__,scene=f.getDocument().scenes[f.getState().sceneIndex],actual=f.inspect();return scene?.id===r&&scene.entities.every(e=>actual.partitions.some(p=>p.entityId===e.id&&p.end>p.start));},ref,{timeout:30000});
 await frame.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
}
const {requirePartitions,requireInitialRestTargets}=createEpiFirstRestReceivingGate({check,artifact,sha});
async function savedFile(working,label){
 assert.ok(working.file?.location?.ref&&working.file?.revision,'Actual material owner file save/readback is required');
 const o=await op({op:'file_read',location:working.file.location});assert.equal(o.result,'file_read');
 const reading=o.reading;assert.equal(reading.revision,working.file.revision);
 const stored=JSON.parse(reading.content);
 // The machine-native file owner expands and validates its image dictionary,
 // including the canonical-document digest. This verifier never reconstructs
 // that codec or substitutes its own expansion/digest for native admission.
 const decodedOutcome=await op({op:'expression',request:{operation:'inspect_file',location:reading.location,expected_file_revision:reading.revision}});
 assert.equal(decodedOutcome.result,'expression');const decoded=decodedOutcome.data;
 assert.equal(decoded.state,'ready','The native file owner must admit the exact saved file revision');
 assert.deepEqual(decoded.file,{location:reading.location,revision:reading.revision});
 const document=decoded.document;assert.equal(document.schema,'oi.expression/v1');
 assert.equal(document.expression_ref,working.native_ref);assert.equal(document.revision,working.revision);
 if(stored.schema!=='oi.expression-storage/v1')assert.deepEqual(stored,document,'A legacy raw file must equal the actual native decoded document');
 artifact(label+'-file.json',{location:reading.location,revision:reading.revision,content_sha256:sha(reading.content),content_bytes:Buffer.byteLength(reading.content),stored_schema:stored.schema,owner_decode:'expression.inspect_file',document});
 check(true,label+': exact native file revision is decoded and validated by its owner, with the committed Expression identity and revision');return document;
}
function nativeReadback(reading){return reading?.native?.instrument?.influence?.native_readback??reading?.record?.native_readback??reading?.record?.world?.native_readback;}
// JavaScript JSON serialization represents negative zero as zero. Normalize
// that exact storage distinction only; no rounding, tolerance, omitted key or
// numerical substitution is permitted. The raw native response is retained.
function storedJsonNumbers(value,negativeZeroPaths=[],path='$'){
 if(typeof value==='number'){assert.ok(Number.isFinite(value));if(Object.is(value,-0)){negativeZeroPaths.push(path);return 0;}return value;}
 if(Array.isArray(value))return value.map((v,i)=>storedJsonNumbers(v,negativeZeroPaths,path+'['+i+']'));
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>{assert.notEqual(v,undefined,'Missing JSON value at '+path+'.'+k);return[k,storedJsonNumbers(v,negativeZeroPaths,path+'.'+k)];}));
 assert.notEqual(value,undefined,'Missing JSON value at '+path);return value;
}
// Hash actual qualified files in bounded chunks rather than allocating every companion image.
function hashFileReadOnly(path){
 const fd=openSync(path,'r'),hash=createHash('sha256'),chunk=Buffer.alloc(1024*1024);let bytes=0;
 try{let n;while((n=readSync(fd,chunk,0,chunk.length,null))>0){hash.update(chunk.subarray(0,n));bytes+=n;}}finally{closeSync(fd);}
 return{bytes,sha256:hash.digest('hex')};
}
function qualifiedJson(ref,label){
 assert.ok(ref&&typeof ref.path==='string'&&resolve(ref.path)===ref.path,label+': exact absolute source path');
 assert.match(ref.sha256,/^[0-9a-f]{64}$/,label+': exact content digest');
 const bytes=readFileSync(ref.path);assert.equal(sha(bytes),ref.sha256,label+': qualified bytes remain unchanged');
 if(ref.bytes!==undefined)assert.equal(bytes.length,ref.bytes,label+': exact byte count');
 return JSON.parse(bytes.toString('utf8'));
}
function qualifyNativeSourceExpectation(expectation){
 const names=['ql','ql-field-host','ql-field-worker','ql-focused-host','ql-sky'].sort();
 const gate=qualifiedJson(expectation.managed_gate_ref,'Current managed build gate');
 const managed=qualifiedJson(expectation.managed_manifest_ref,'Current all-five manifest');
 const original=qualifiedJson(expectation.original_manifest_ref,'Original all-five manifest');
 assert.equal(gate.schema,'oi.managed-update-gate/v1');assert.equal(gate.product,'quaternal-logic');
 assert.equal(gate.provenance,'built');assert.equal(gate.result,'passed');assert.equal(gate.source_dirty,false);
 assert.equal(gate.revision,expectation.owner_cut);assert.equal(gate.revision,expectation.managed_gate_ref.revision);
 assert.match(gate.tree,/^[0-9a-f]{40}$/);assert.equal(gate.tree,expectation.managed_gate_ref.tree);
 assert.equal(managed.schema,'epi.qualified-managed-native-cut/v1');assert.equal(managed.source_cut,expectation.owner_cut);
 assert.equal(managed.gate,expectation.managed_gate_ref.path);assert.equal(managed.gate_sha256,expectation.managed_gate_ref.sha256);
 assert.equal(original.schema,'ql.same-source-five-companion-cut/v1');assert.equal(original.source_head,expectation.original_owner_cut);
 const allFive={};
 for(const [label,declared,manifest,key] of [['current',expectation.managed_all_five,managed.all_five,'name'],['original',expectation.original_all_five,original.components,'role']]){
  assert.ok(Array.isArray(declared)&&Array.isArray(manifest));
  assert.deepEqual(declared.map(b=>b[key]).sort(),names,label+': exactly all five companions');
  assert.deepEqual(manifest.map(b=>b[key]).sort(),names,label+': manifest covers the same five companions');
  allFive[label]=declared.map(binary=>{
   assert.equal(binary.read_only_bytes_verified,true,label+': independently qualified original bytes');
   const row=manifest.find(b=>b[key]===binary[key]);
   for(const field of ['path','sha256','bytes'])assert.equal(binary[field],row[field],label+': declaration/manifest '+field);
   assert.equal(resolve(binary.path),binary.path);assert.match(binary.sha256,/^[0-9a-f]{64}$/);
   const actual=hashFileReadOnly(binary.path);assert.deepEqual(actual,{bytes:binary.bytes,sha256:binary.sha256},label+': actual companion bytes');
   if(label==='current'){
    assert.equal(binary.sha256,binary.name==='ql'?gate.sha256:gate.companions[binary.name],binary.name+': same actual managed gate');
    if(binary.name==='ql')assert.equal(binary.path,gate.managed);
   }
   return{name:binary[key],path:binary.path,...actual};
  });
 }
 assert.equal(resolve(config.original_owner_world_file),expectation.original_world_ref.path,'Prediction retains the exact original native receipt');
 assert.equal(hashFileReadOnly(expectation.original_world_ref.path).sha256,expectation.original_world_ref.sha256,'Original native receipt remains immutable');
 const delta=expectation.semantic_metadata_transition;
 assert.equal(delta?.schema,'epi.native-world-m2-ledger-transition/v1');
 assert.deepEqual(delta.paths,['/basis/m2/ledger_revision','/binding/native_basis/m2/ledger_revision'],'Only two exact native world leaves are eligible');
 assert.equal(delta.current_ledger.cut,expectation.owner_cut,'The ledger is qualified to the actual build cut, not an equivalent branch label');
 const oldLedger=qualifiedJson(delta.original_ledger,'Original embedded ledger source');
 const currentLedger=qualifiedJson(delta.current_ledger,'Current embedded ledger source');
 assert.equal(oldLedger.schema,'ql.m-ledger/v1');assert.equal(currentLedger.schema,'ql.m-ledger/v1');
 assert.equal(oldLedger.ledger_revision,delta.original_value);assert.equal(currentLedger.ledger_revision,delta.current_value);
 assert.match(delta.original_value,/^[0-9a-f]{64}$/);assert.match(delta.current_value,/^[0-9a-f]{64}$/);assert.notEqual(delta.original_value,delta.current_value);
 const requiredSources=['fixtures/kernel/m-ledger-v1.json','crates/ql-mef/src/m_ledger.rs','crates/ql-mef/src/m2_engine.rs','crates/ql-mef/src/scene.rs','crates/ql-mef/src/continuous/coupled.rs','crates/ql-mef/src/continuous/scene_field.rs'];
 assert.deepEqual(delta.derivation_sources.map(s=>s.path).sort(),requiredSources.slice().sort(),'Complete ledger/embed/M2/world and implementation source chain');
 const sources=delta.derivation_sources.map(source=>{
  const candidates=expectation.source_qualification.filter(s=>s.cut===expectation.owner_cut&&s.path===source.path);assert.equal(candidates.length,1,source.path+': one exact committed source qualification');
  const qualified=candidates[0];assert.equal(qualified.working_bytes_equal_cut,true);assert.equal(qualified.sha256,source.sha256);
  const sourcePath=qualified.snapshot_path??resolve(qualified.repository,qualified.path);
  const actual=hashFileReadOnly(sourcePath);assert.equal(actual.sha256,source.sha256,source.path+': actual qualified source bytes');
  const buildRows=managed.source.filter(s=>s.path===source.path);assert.equal(buildRows.length,1,source.path+': actual managed source manifest includes the compiled dependency');assert.equal(buildRows[0].sha256,source.sha256);
  if(source.path==='fixtures/kernel/m-ledger-v1.json')assert.equal(source.sha256,delta.current_ledger.sha256);
  return{path:source.path,qualified_path:sourcePath,cut:qualified.cut,...actual};
 });
 return{all_five:allFive,gate:expectation.managed_gate_ref,manifest:expectation.managed_manifest_ref,sources,semantic_metadata_transition:delta,predictions_qualified_before_native_requests:true};
}
async function recoverOriginalRuntimeBuffers(reading,original){
 const before=await op({op:'expression',request:{operation:'inspect',expression_ref:reading.working.native_ref}});
 const request=structuredClone(original.request);
 assert.equal(request.op,'native_expression');assert.equal(request.request.operation,'prepare_world');
 assert.equal(request.request.request.world.instance_ref,reading.working.native_ref);
 delete request.request.request.sky;request.request.request.sky_snapshot=structuredClone(reading.record.world.sky);
 request.request.request.snapshot_purpose='retained-occasion';
 const actualOutcome=await op(request);assert.equal(actualOutcome.result,'native_expression');const actual=actualOutcome.data,world=actual.source.world;
 assert.ok(!actual.lease&&!actual.receipt,'Original quiet source recovery must create no playback lease or worker');
 const expected=structuredClone(reading.record.world);
 expected.schema='ql.scene-world/v1';expected.native_owner_sources=Object.fromEntries(expected.native_owner_sources.map(s=>[s.role,s.reading]));
 assert.ok(nativeOwnerExpectation,'Retained occasion recovery requires independently source-derived original and current expectations');
 const completeKeys=['basis','binding','current_form','event','event_ref','instance_ref','native_owner_sources','native_readback','registers','scene','schema','sky','sky_admission','snapshot_ref','starting_recipe','subject_ref'];
 const keys=completeKeys.filter(key=>!['native_owner_sources','sky_admission'].includes(key));
 assert.deepEqual(nativeOwnerExpectation.complete_world_keys,completeKeys,'Source qualification covers the complete world field set');
 assert.deepEqual(nativeOwnerExpectation.semantic_world_keys,keys,'Every semantic field, including schema, is qualified');
 const originalWorld=original.response?.outcome?.data?.source?.world;
 assert.ok(originalWorld,'Original actual native response must accompany its request');
 let executionQualification;
 if(nativeOwnerExpectation.schema==='epi.native-world-source-expectation/v3'){
  executionQualification=qualifyPortableRuntimeExecution(nativeOwnerExpectation,original.response.outcome.data.source,actual.source);
 }else{
 const currentExecutable=nativeOwnerExpectation.managed_all_five?.find(b=>b.name==='ql');
 const originalExecutable=nativeOwnerExpectation.original_all_five?.find(b=>b.role==='ql');
 assert.ok(currentExecutable?.read_only_bytes_verified&&originalExecutable?.read_only_bytes_verified,'Both actual executable expectations must be independently byte qualified');
 executionQualification={};
 for(const [label,source,binary] of [['original',original.response.outcome.data.source,originalExecutable],['current',actual.source,currentExecutable]]){
  assert.equal(source.ql_executable,binary.path,label+': actual native execution names the exact qualified executable path');
  assert.equal(source.ql_executable_sha256,binary.sha256,label+': actual native execution names the exact qualified executable bytes');
  assert.equal(hashFileReadOnly(binary.path).sha256,binary.sha256,label+': executable bytes still agree with the independent qualification');
  executionQualification[label]={path:source.ql_executable,sha256:source.ql_executable_sha256,selection:source.ql_selection,reported_revision:source.ql_revision};
 }
 }
 for(const [label,value] of [['current',world],['saved',expected],['original',originalWorld]])assert.deepEqual(Object.keys(value).sort(),completeKeys,label+': no world field may disappear or evade qualification');
 const sourceCopy=structuredClone(world);
 for(const key of ['slots_a','slots_b'])delete sourceCopy.binding.presentation[key];
 const originalCopy=structuredClone(originalWorld);
 for(const key of ['slots_a','slots_b'])delete originalCopy.binding.presentation[key];
 const currentExpected=structuredClone(expected);
 let semanticMetadataQualification=null;
 if(nativeOwnerExpectation?.semantic_metadata_transition){
  assert.ok(nativeSourceQualification?.predictions_qualified_before_native_requests,'Source-derived metadata must be qualified before native replies');
  const delta=nativeOwnerExpectation.semantic_metadata_transition;
  for(const parts of [['basis','m2','ledger_revision'],['binding','native_basis','m2','ledger_revision']]){
   const get=value=>parts.reduce((parent,key)=>{assert.ok(parent&&Object.hasOwn(parent,key),'Required exact metadata leaf /'+parts.join('/'));return parent[key];},value);
   assert.equal(get(originalCopy),delta.original_value,'Original native receipt retains its original compiled ledger');
   assert.equal(get(expected),delta.original_value,'Saved129/131 provenance remains historical and unchanged');
   assert.equal(get(sourceCopy),delta.current_value,'Actual successor returns the independently predicted compiled ledger');
   const parent=parts.slice(0,-1).reduce((value,key)=>value[key],currentExpected);parent[parts.at(-1)]=delta.current_value;
  }
  assert.deepEqual(actual.binding,world.binding,'Outer prepared binding retains the entire actual qualified native world binding');
  assert.deepEqual(world.basis,world.binding.native_basis,'Both complete actual native basis copies agree');
  semanticMetadataQualification={paths:delta.paths,original_value:delta.original_value,current_value:delta.current_value,source_qualification:nativeSourceQualification,policy:'Compare all14 complete semantic fields to original saved values with only these two separately asserted source-derived expectation leaves; no actual or saved value is rewritten'};
 }
 const nativeNegativeZeroPaths=[],storedNegativeZeroPaths=[];
 for(const key of keys){
  const saved=storedJsonNumbers(expected[key],storedNegativeZeroPaths,key);
  assert.deepEqual(storedJsonNumbers(originalCopy[key],[],key),saved,'Saved material preserves the complete original native semantic '+key);
  assert.deepEqual(storedJsonNumbers(sourceCopy[key],nativeNegativeZeroPaths,key),storedJsonNumbers(currentExpected[key],[],key),'Actual current source recovery preserves the complete source-qualified JSON semantic/numerical expectation of '+key);
 }
 // Original material keeps the original implementation receipt. Recomposition
 // runs the current qualified owner; that owner must truthfully name its own
 // exact source bytes. Never overwrite either receipt to force hash equality.
 let ownerQualification;
 if(nativeOwnerExpectation){
  assert.deepEqual(originalWorld.native_owner_sources,nativeOwnerExpectation.expected_original_native_owner_sources,'Original implementation readings retain independently qualified original source bytes');
  assert.deepEqual(expected.native_owner_sources,nativeOwnerExpectation.expected_original_native_owner_sources,'Saved implementation readings retain the original source cut');
  assert.deepEqual(world.native_owner_sources,nativeOwnerExpectation.expected_native_owner_sources,'Every current native implementation reading must match independently qualified Git/build source');
  assert.deepEqual(Object.keys(world.native_owner_sources).sort(),Object.keys(expected.native_owner_sources).sort(),'No original native source role may disappear');
  for(const role of Object.keys(expected.native_owner_sources)){
   assert.equal(world.native_owner_sources[role].ref,expected.native_owner_sources[role].ref,'Native source role preserves its source address');
   assert.equal(world.native_owner_sources[role].availability,expected.native_owner_sources[role].availability,'Native source role preserves availability');
  }
  ownerQualification={original:expected.native_owner_sources,current:world.native_owner_sources,expected_source:{path:nativeOwnerExpectationPath,sha256:nativeOwnerExpectationSha256,owner_cut:nativeOwnerExpectation.owner_cut},policy:'All14 complete semantic fields and both buffers remain exact against source-derived expectations; only two independently asserted embedded-ledger metadata leaves may change, with original/current source receipts separately retained'};
 }else{
  assert.deepEqual(world.native_owner_sources,expected.native_owner_sources,'Same-cut original source recovery preserves every native implementation reading');
  ownerQualification={original:expected.native_owner_sources,current:world.native_owner_sources,policy:'Same-cut exact source equality'};
 }
 assert.deepEqual(originalWorld.sky_admission,nativeOwnerExpectation.expected_original_sky_admission,'Original request admission retains exact original epoch, provider and freshness receipt');
 assert.deepEqual(expected.sky_admission,nativeOwnerExpectation.expected_original_sky_admission,'Saved occasion retains original admission as historical provenance');
 assert.deepEqual(world.sky_admission,nativeOwnerExpectation.expected_retained_sky_admission,'Current retained admission must match the exact source-derived validator, historical qualification and directed native Sun route');
 assert.deepEqual(world.sky.source_binding,nativeOwnerExpectation.expected_exact_legacy_source_binding,'The immutable original snapshot retains its exact historical source binding');
 assert.deepEqual(reading.record.runtime_buffers.buffers.map(b=>b.key).sort(),['slots_a','slots_b'],'Both complete runtime buffers are required');
 const buffers=reading.record.runtime_buffers.buffers.map(buffer=>{
  const values=world.binding.presentation[buffer.key];assert.ok(Array.isArray(values));
  assert.deepEqual(values,originalWorld.binding.presentation[buffer.key],'Every runtime buffer value agrees with the actual original native output');
  assert.equal(values.length,buffer.values);assert.equal(sha(JSON.stringify(values)),buffer.json_sha256);
  assert.equal(values.length,request.request.request.texture[0]*request.request.request.texture[1]);
  for(let i=0;i<values.length;i++)assert.equal(values[i],i%4096,'Original complete native sample correspondence');
  return{key:buffer.key,count:values.length,sha256:sha(JSON.stringify(values))};
 });
 const after=await op({op:'expression',request:{operation:'inspect',expression_ref:reading.working.native_ref}});
 assert.equal(before.result,'expression');assert.equal(after.result,'expression');assert.ok(before.data?.document&&before.data?.file);assert.deepEqual(after.data,before.data,'Complete native inspection including document, registration and saved revision remains unchanged');
 artifact('original-runtime-recovery.json',{request,buffers,complete_world_keys:completeKeys,complete_semantic_locks:keys,semantic_metadata_qualification:semanticMetadataQualification,owner_qualification:ownerQualification,execution_qualification:executionQualification,sky_admission_qualification:{original:originalWorld.sky_admission,current:world.sky_admission,expected_source_sha256:nativeOwnerExpectationSha256,policy:'Immutable original sky and original admission retained; exact current source validates the dated occasion without fresh-current attestation'},json_signed_zero:{native_negative_zero_paths:nativeNegativeZeroPaths,stored_negative_zero_paths:storedNegativeZeroPaths,policy:'Normalize only -0 to0 at JSON storage boundary; every nonzero value and every field remains exact; raw native HTTP retained'},document_unchanged:true,file_unchanged:true,worker_lease_created:false,scope:'Current qualified owner reproduces retained semantic state and original buffers; original/current source and execution receipts remain distinct; current topology and GPU reception are separately tested'});
 check(true,'Actual quiet current-qualified native recovery reproduces both original buffers and all14 complete semantic fields '+(semanticMetadataQualification?'against source-derived expectations with only two separately asserted ledger metadata leaves and qualified all-five/source/execution/admission':'with exact historical semantic values and separately qualified QL/source/admission')+', without changing the document, file or continuation');
}
function captureNativeFrames(value,lease,request){
 if(!value||typeof value!=='object')return;
 if(value.schema==='ql.field-host-receipt/v1'&&value.sources)nativeInspections.push({sources:value.sources,field:value.field,lease,request});
 if(value.schema==='ql.continuous-field/v1'){nativeFrames.push({field:value,lease,request});return;}
 for(const child of Object.values(value))if(child&&typeof child==='object'&&!Array.isArray(child))captureNativeFrames(child,lease,request);
}
async function requireCurrentRuntime(reading,label){
 const record=reading.record,source=reading.native.source,lease=reading.native.lease;
 const candidates=nativeComposes.filter(c=>c.source.request_sha256===source.request_sha256&&c.lease===lease);
 assert.equal(candidates.length,1,label+': exact current native source request and lease select one actual compose');
 const actual=candidates[0],world=actual.source.world,request=actual.request.request.request;
 assert.deepEqual(request.world.start,record.continuation_start,label+': actual issued continuation, rather than opening or first-arriving state');
 assert.equal(world.instance_ref,record.world.instance_ref);assert.equal(world.subject_ref,record.person_ref);
 assert.equal(world.event_ref,record.world.event_ref);assert.equal(world.snapshot_ref,record.world.snapshot_ref);
 assert.deepEqual(world.sky,record.world.sky);assert.deepEqual(world.event,world.basis.input);
 assert.deepEqual(world.binding.native_basis,world.basis);assert.deepEqual(world.binding.scene,world.scene);
 assert.deepEqual(world.binding.native_readback,world.native_readback);
 const semantic=['schema','clock_semantics','event_ref','subject_ref','continuation_start','continuous_clock','m1_carrier','m1_clock','m3_clock','selected_aperture','form','form_process'];
 const preparedNegativeZeroPaths=[],retainedNegativeZeroPaths=[];
 for(const key of semantic)assert.deepEqual(storedJsonNumbers(world.native_readback[key],preparedNegativeZeroPaths,key),storedJsonNumbers(nativeReadback(reading)[key],retainedNegativeZeroPaths,key),label+': current native JSON numerical semantic '+key);
 const targets=await frame.evaluate(()=>{const t=window.__FIELD_STUDIES__.nativeTargets();return t?{native:t.native,scale:t.presentation_units_per_metre,target_a:Array.from(t.target_a),target_b:Array.from(t.target_b),admitted_a:Array.from(t.admitted_a)}:null;});
 assert.ok(targets?.native);assert.equal(targets.scale,request.units_per_metre);
 const size=request.texture[0]*request.texture[1];assert.equal(targets.target_a.length,size*4);assert.equal(targets.target_b.length,size*4);
 const topology=reading.native.renderer_requirements;assert.ok(topology);assert.deepEqual(request.texture,[topology.tex_width,topology.tex_height]);assert.equal(size,topology.slot_count);assert.equal(reading.rendered.particleCount,topology.particle_count);
 for(const key of ['slots_a','slots_b']){
  const values=actual.presentation[key];assert.equal(values.length,size);
  for(let i=0;i<values.length;i++)assert.equal(values[i],i%4096,label+': current dense qualification retains the complete native domain');
 }
 const identity=['event_ref','subject_ref','registry_revision','geometry_ref','material_ref','model_ref','generation','samples_elapsed','clock','m2_identity','standing'];
 const frames=nativeFrames.filter(c=>c.lease===lease&&identity.every(k=>JSON.stringify(c.field[k])===JSON.stringify(targets.native[k])));
 assert.ok(frames.length,label+': actual native frame matching the presented source identity and cursor is required');
 const current=frames.at(-1).field;assert.equal(current.targets.length,4096);
 for(let i=0;i<4096;i++){assert.equal(current.targets[i].identity,i);assert.equal(current.targets[i].constituent,'#1-5-1');}
 const torus=reading.rendered.partitions.find(p=>p.entityId===record.receiving.torus.entity_ref);assert.ok(torus&&torus.end-torus.start>=4096);
 const mapped=new Set(),length=torus.end-torus.start;
 for(let slot=torus.start;slot<torus.end;slot++){
  const sample=Math.floor((slot-torus.start)*4096/length);mapped.add(sample);
  for(let axis=0;axis<3;axis++){
   const native=Math.fround(current.targets[sample].position[axis]),offset=slot*4+axis;
   assert.equal(targets.admitted_a[offset],native,label+': actual admitted native sample at sparse torus slot');
   const projected=Math.fround(native*targets.scale);
   assert.equal(targets.target_a[offset],projected);assert.equal(targets.target_b[offset],projected);
  }
  assert.equal(targets.target_a[slot*4+3],reading.rendered.targets[slot*4+3],label+': authored torus density remains intact');
  assert.equal(targets.target_b[slot*4+3],targets.target_a[slot*4+3]);
 }
 assert.equal(mapped.size,4096);
 for(const array of [targets.target_a,targets.target_b])for(const value of array)assert.ok(Number.isFinite(value));
 artifact(label+'-current-runtime-reception.json',{request:actual.request,source_request_sha256:source.request_sha256,lease,semantic_fields:semantic,
  original_immutable_qualification:record.runtime_buffers,current_dense_buffers:actual.buffers,particle_count:reading.rendered.particleCount,texture:request.texture,
  torus_partition:torus,native_sample_count:4096,sparse_samples_reached:mapped.size,
  actual_target_a_sha256:sha(JSON.stringify(targets.target_a)),actual_target_b_sha256:sha(JSON.stringify(targets.target_b)),native_presented:targets.native,
  lifetime_qualifications:{prepared:world.native_readback,presented:nativeReadback(reading)},json_signed_zero:{prepared_negative_zero_paths:preparedNegativeZeroPaths,retained_negative_zero_paths:retainedNegativeZeroPaths,policy:'JSON storage comparison copies only; canonical native values/source identities and GPU targets remain untouched'},
  scope:'Exact current source and torus-domain GPU-bound target reception; outside-bank, connection and padding invariance, actual resident effect and connected/disconnected consumer tests remain separate'});
 check(true,label+': current request, source basis and complete native sample domain reach the qualified torus target mapping at the exact current renderer texture size');
}
function requireOneWorld(document,ref,label){check(document.expression_ref===ref&&document.scenes.filter(s=>s.presentation?.scene?.epiWorld).length===1&&document.scenes.every(s=>!s.presentation?.saved?.epiWorld),label+': exactly one world continuation remains in the same native Expression');}
async function requireAuthoredNativeHealth(label){
 await frame.waitForFunction(()=>{const f=window.__FIELD_STUDIES__,n=f.native(),l=n.lifetime;return n.status==='manual'&&!n.lease&&!n.domain&&f.nativeTargets()===null&&!l.admission_pending&&!l.close_pending&&!l.operation_pending&&!l.close_error;},null,{timeout:30000});
 await frame.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 const reading=await frame.evaluate(()=>({native:window.__FIELD_STUDIES__.native(),targets:window.__FIELD_STUDIES__.nativeTargets(),rendered:window.__FIELD_STUDIES__.inspect(),working:window.__FIELD_STUDIES__.nativeWorking(),scene:window.__FIELD_STUDIES__.getDocument().scenes[window.__FIELD_STUDIES__.getState().sceneIndex]}));
 artifact(label+'-native-health.json',reading);
 assert.ok(!reading.native.reason?.startsWith('native surface render failed:'),label+': the actual post-authoring scene must render without a retained native partition refusal');
 assert.ok(!reading.working.failed,label+': the actual native owner must remain available');
 requirePartitions(reading,reading.scene.entities.map(e=>e.id),label+' post-authoring');
 assert.deepEqual(receipt.console.filter(row=>row.phase==='ordinary authored save/restore/save-next'&&row.type==='error'),[],label+': scene authoring must not conceal a real native render/close error');
 check(true,label+': actual native departure is acknowledged and the authored scene remains rendered');
}
async function openSceneWorkflow(){if(!await frame.locator('#timeline-panel').isVisible())await frame.locator('#scene-picker').click();await frame.locator('#scene-save-name').waitFor();}
function requirePersonalDrivers(reading,label){
 const rows=reading.current.reading.identity.natal_composition.planetary_contributions,denominator=rows.reduce((sum,row)=>sum+row.weighted_contribution,0),frames=reading.rendered.localizedResonance;
 // Independent live907c PLANETARY_RESONANCE / qualified
 // HAS_CHAKRAL_ANCHOR edges and native header enumeration, not an ordinal
 // mapping recovered from the application producer. Uranus is unrouted.
 const centres=[6,5,4,3,2,1,0,null,5,6],frequencies=[126,210,141,221,145,184,148,207,211,140];
 assert.equal(rows.length,10,'The actual owner retains all ten natal planetary contributions');
 check(frames?.length===9&&new Set(frames.map(f=>f.driverRef)).size===9&&new Set(frames.map(f=>f.entityId)).size===7,label+': nine distinct qualified planetary modal drivers reach all seven actual centre formations');
 const base=reading.telemetry.config.cymatics?.driveStrength??1;
 for(const row of rows){
  assert.equal(row.receiving_centre_ordinal,centres[row.native_planet_id],`${label}: original qualified centre relation ${row.body}`);
  assert.equal(row.native_cousto_frequency_hz,frequencies[row.native_planet_id],`${label}: original native Cousto frequency ${row.body}`);
  if(row.receiving_centre_ordinal===null){assert.equal(row.body,'Uranus');continue;}
  const frame=frames.find(f=>f.driverRef===JSON.stringify([reading.record.identity_source.source_ref,row.native_planet_id]));
  assert.ok(frame,`${label}: source planetary driver ${row.body}`);
  assert.equal(frame.entityId,reading.record.receiving.personal.centre_entity_refs[row.receiving_centre_ordinal]);
  assert.equal(frame.frequencyHz,row.native_cousto_frequency_hz);
  assert.ok(Math.abs(frame.params.driveStrength-base*row.weighted_contribution/denominator)<1e-10,`${label}: qualified weighted drive share ${row.body}`);
 }
 check(true,label+': each receiver uses the actual protected native planetary frequency and weighted contribution, including the unallocated Uranus denominator');
}
function partitionDelta(before,after,entity){
 const part=after.rendered.partitions.find(p=>p.entityId===entity);assert.ok(part);
 let max=0,sum=0,n=0;
 for(let i=part.start;i<part.end;i++){let d=0;for(let a=0;a<3;a++)d+=(after.rendered.positions[i*4+a]-before.rendered.positions[i*4+a])**2;d=Math.sqrt(d);max=Math.max(max,d);sum+=d;n++;}
 return{entity_ref:entity,count:n,max_displacement:max,mean_displacement:sum/n};
}
function observePage(p){
 p.on('pageerror',e=>receipt.errors.push({phase,error:String(e)}));
 p.on('framenavigated',f=>receipt.navigations.push({phase,at:new Date().toISOString(),url:f.url(),main:f===p.mainFrame()}));
 p.on('console',message=>receipt.console.push({phase,type:message.type(),text:message.text()}));
 p.on('response',response=>{if(!response.url().endsWith('/op'))receipt.boot_network.push({phase,url:response.url(),status:response.status()});});
 p.on('request',request=>{if(request.method()==='POST'&&request.url().endsWith('/op')){const data=request.postDataJSON();receipt.issued_requests.push({phase,...summarizeRequest(data),at:new Date().toISOString()});if(data.op==='native_expression'&&['prepare_world','compose'].includes(data.request?.operation))artifact(`native-world-issued-${receipt.issued_requests.length}.json`,data);if(data.op==='expression'&&data.request?.operation==='edit')artifact(`native-expression-edit-issued-${receipt.issued_requests.length}.json`,data);if(data.op==='expression'&&['save_as','save','open_file','open'].includes(data.request?.operation))artifact(`native-expression-owner-issued-${receipt.issued_requests.length}.json`,data);if(/^(file_|files_)/.test(data.op))artifact(`native-file-issued-${receipt.issued_requests.length}.json`,data);}});
 p.on('requestfailed',request=>{if(request.method()==='POST'&&request.url().endsWith('/op'))receipt.request_failures.push({phase,...summarizeRequest(request.postDataJSON()),failure:request.failure(),at:new Date().toISOString()});});
 p.on('response',async response=>{if(response.request().method()!=='POST'||!response.url().endsWith('/op'))return;const request=response.request().postDataJSON();const row={phase,...summarizeRequest(request),at:new Date().toISOString(),http_status:response.status()};receipt.operations.push(row);const operationIndex=receipt.operations.length;try{let body;if(request.op==='native_expression'||request.op==='nara_current'){const raw=await response.text(),name=`native-owner-raw-response-${operationIndex}.json`;writeFileSync(resolve(out,name),raw);receipt.artifacts.push(name);row.raw_native_response={artifact:name,bytes:Buffer.byteLength(raw),sha256:sha(raw)};body=JSON.parse(raw);}else body=await response.json();row.ok=body.ok;row.result=body.outcome?.result;if(request.op==='expression'&&['save_as','save','open_file','open'].includes(request.request?.operation)){row.native_state=body.outcome?.data?.state;artifact(`native-expression-owner-response-${operationIndex}.json`,{request,response:body});if(['save_refused','saved_readback_failed','file_revision_conflict'].includes(row.native_state))row.error=body.outcome.data.error??body.outcome.data.failure??row.native_state;}if(/^(file_|files_)/.test(request.op))artifact(`native-file-response-${operationIndex}.json`,{request,response:body});if(request.op==='expression'&&request.request?.operation==='edit')artifact(`native-expression-edit-response-${operationIndex}.json`,{request,response:body});if(request.op==='native_expression'&&request.request?.operation==='prepare_world'){artifact(`native-world-prepared-${operationIndex}.json`,{request,response:body});if(body.ok===true)nativePrepared.push({world:body.outcome.data.source.world,request,response:body});}if(request.op==='native_expression'&&request.request?.operation==='compose'&&body.ok===true){const composed=body.outcome?.data;row.runtime_buffers=Object.fromEntries(['slots_a','slots_b'].map(key=>{const values=composed?.presentation?.[key];assert.ok(Array.isArray(values),'Actual native compose must return complete receiving correspondence');return[key,{count:values.length,sha256:sha(JSON.stringify(values))}];}));nativeComposes.push({source:composed.source,lease:composed.lease,request,presentation:composed.presentation,buffers:row.runtime_buffers});captureNativeFrames(composed,composed.lease,request);artifact(`native-world-recomposed-${operationIndex}.json`,{request,response:body,runtime_buffers:row.runtime_buffers});}if(request.op==='native_expression'&&request.request?.operation==='exchange'&&body.ok===true)captureNativeFrames(body.outcome?.data,request.request.lease,request);if(request.op==='nara_current'){artifact(`actual-native-personal-current-${operationIndex}.json`,{request,response:body});row.actual_current={context:body.outcome?.data?.context??null,status:body.outcome?.data?.status??null,artifact:`actual-native-personal-current-${operationIndex}.json`};}if(request.op==='m3_reception'){artifact(`actual-native-m3-${operationIndex}.json`,{request,response:body});if(body.ok===true&&body.outcome?.data?.schema==='oi.m3-reception-context/v1')nativeM3.push({request,response:body,reading:body.outcome.data});}if(body.ok!==true){row.error=body.error;artifact(`native-refusal-${operationIndex}.json`,{request,response:body});}}catch(e){row.error=String(e);}});
}
async function exposeNativePanel(){
 const toggle=frame.locator('.workspace-cluster>.header-menu-toggle');
 if(await toggle.isVisible())await toggle.click();
 await frame.locator('[data-action="studio"]').click();
 await frame.locator('[data-action="studio-section"][data-value="native"]').click();
 await frame.locator('.native-field-panel [data-ni="step"]').waitFor();
}
async function actualGpuConsumerReplays(url,opening,cosmicRef){
 const main={page,frame},results=[];
 await exposeNativePanel();
 if(['held','following'].includes((await frame.evaluate(()=>window.__FIELD_STUDIES__.native())).status)){
  await frame.locator('.native-field-panel [data-ni="close"]').click();
  await frame.waitForFunction(()=>window.__FIELD_STUDIES__.native().status==='manual');
 }
 for(const variant of [{name:'control',advance:false,cut:false},{name:'connected',advance:true,cut:false},{name:'disconnected',advance:true,cut:true}]){
  const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});let releaseIssued=false;
  // Hold the renderer's ordinary jitter input fixed. The native event, clock,
  // physics, producer, transport, target projection and shader are unchanged.
  await context.addInitScript(()=>{let seed=0x13579bdf;Math.random=()=>{seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/4294967296;};});
  try{
   page=await context.newPage();page.setDefaultTimeout(40000);observePage(page);
   phase='same-file GPU consumer '+variant.name;
   await page.goto(url+'&expression='+encodeURIComponent(opening.working.native_ref));
   await page.waitForFunction(()=>document.querySelector('#world')?.getAttribute('src')?.startsWith('/__epi_application'),null,{timeout:90000});
   frame=await page.locator('#world').elementHandle().then(el=>el.contentFrame());
   await frame.waitForFunction(()=>window.__FIELD_STUDIES__?.epiWorld(),null,{timeout:90000});
   await readyCurrent(opening.record.person_ref);await noAlert();
   await sceneNavigate(cosmicRef);await frame.evaluate(()=>window.__FIELD_STUDIES__.pause());
   await action('step');await action('reset');
   await exposeNativePanel();await frame.locator('.native-field-panel [data-ni="hold"]').click();
   await frame.waitForFunction(()=>window.__FIELD_STUDIES__.native().status==='held');
   const initial=await snapshot('consumer-'+variant.name+'-before',true);
   const readTargets=()=>frame.evaluate(()=>{const t=window.__FIELD_STUDIES__.nativeTargets();return{target_a:Array.from(t.target_a),target_b:Array.from(t.target_b),admitted_a:Array.from(t.admitted_a),native:t.native,scale:t.presentation_units_per_metre};});
   const beforeTargets=await readTargets();
   assert.equal(initial.state.simTime,initial.rendered.simTime,'The actual resident renderer discloses the held simulation time');
   assert.equal(initial.rendered.partitions.length,32,'All authored world bodies remain resident in the consumer challenge');
   check(initial.record.world.event_ref===opening.record.world.event_ref&&initial.record.person_ref===opening.record.person_ref&&initial.state.fieldPaused&&initial.native.status==='held','GPU '+variant.name+': the same saved world, person, occasion and quiet native lease are held');
   if(variant.cut)await frame.evaluate(()=>{window.__OI_TEST_DISCONNECT_NATIVE_TARGETS__=true;});
   if(variant.advance){
    const revision=initial.native.instrument.influence.m1_revision;
    await frame.locator('.native-field-panel [data-ni="step"]').click();
    await frame.waitForFunction(previous=>window.__FIELD_STUDIES__.native().instrument?.influence?.m1_revision!==previous,revision,{timeout:30000});
   }
   const afterTargets=await readTargets();
   await frame.evaluate(()=>window.__FIELD_STUDIES__.probeSteps(60,1/60));
   const final=await snapshot('consumer-'+variant.name+'-after',true);
   const pixels=await frame.evaluate(()=>{const canvas=window.__FIELD_STUDIES__.capture(360,250);return Array.from(canvas.getContext('2d').getImageData(0,0,360,250).data);});
   artifact('consumer-'+variant.name+'-targets.json',{before:beforeTargets,after:afterTargets});
   artifact('consumer-'+variant.name+'-pixels.json',{width:360,height:250,rgba:pixels});
   results.push({variant,initial,final,beforeTargets,afterTargets,pixels});
   await frame.evaluate(()=>{window.__OI_TEST_DISCONNECT_NATIVE_TARGETS__=false;});
   await action('reset');
   releaseIssued=true;await frame.locator('.native-field-panel [data-ni="close"]').click();
   await frame.waitForFunction(()=>window.__FIELD_STUDIES__.native().status==='manual');
  }finally{
   // Close only this actual application's held lease before closing its
   // browser context. No failed owner operation is automatically replayed.
   try{if(frame){await frame.evaluate(()=>{window.__OI_TEST_DISCONNECT_NATIVE_TARGETS__=false;});if(!releaseIssued&&['held','following'].includes(await frame.evaluate(()=>window.__FIELD_STUDIES__?.native()?.status))){releaseIssued=true;await frame.locator('.native-field-panel [data-ni="close"]').click();await frame.waitForFunction(()=>window.__FIELD_STUDIES__.native().status==='manual',null,{timeout:20000});}}}catch(error){receipt.errors.push({phase,cleanup:'actual native lease release',release_issued:releaseIssued,error:String(error)});}
   await context.close();page=main.page;frame=main.frame;
  }
 }
 const [control,connected,cut]=results,torus=opening.record.receiving.torus.entity_ref;
 for(const result of [connected,cut]){
  assert.deepEqual(result.initial.state.camera,control.initial.state.camera,'The actual production camera is identical across receiving replays');
  assert.equal(result.initial.state.simTime,control.initial.state.simTime,'The actual renderer is held at the same simulation time');
  assert.equal(result.initial.native.native.acknowledged.samples_elapsed,control.initial.native.native.acknowledged.samples_elapsed,'The actual native receiving cursor is held at the same elapsed sample');
  assert.deepEqual(result.initial.rendered.positions,control.initial.rendered.positions,'Actual initial resident positions are identical with renderer jitter held');
  assert.deepEqual(result.beforeTargets.target_a,control.beforeTargets.target_a,'Actual initial GPU-bound targets are identical');
  assert.deepEqual(result.initial.current.reading.q_identity_transit,control.initial.current.reading.q_identity_transit);
  assert.deepEqual(result.initial.record.world,control.initial.record.world,'The full original semantic world is held');
  const first=result.initial.native.instrument.influence.native_readback,last=result.final.native.instrument.influence.native_readback;
  assert.ok(first&&last,'The consumer discriminator compares the actual acknowledged held native process, independently of the unchanged authored world receipt');
  assert.equal(last.m1_clock.tick12,(first.m1_clock.tick12+1)%12);
  assert.notDeepEqual(result.afterTargets.admitted_a,result.beforeTargets.admitted_a,'The actual native owner produced a changed source target field');
 }
 assert.notDeepEqual(connected.afterTargets.target_a,connected.beforeTargets.target_a,'Connected native source targets reach the actual GPU-bound texture');
 assert.deepEqual(cut.afterTargets.target_a,cut.beforeTargets.target_a,'The test cut freezes GPU-bound targets while owner admission remains successful');
 // Clock/form bodies consume the same determinant independently of the
 // sparse torus target port. The disconnected run shares that actual act;
 // only its torus consumer should match the non-advancing control.
 for(const result of [connected,cut])assert.deepEqual(result.final.native.instrument.influence.native_readback.continuous_clock,connected.final.native.instrument.influence.native_readback.continuous_clock);
 assert.deepEqual(cut.final.native.instrument.influence.native_readback.form,connected.final.native.instrument.influence.native_readback.form);
 const byPartition=control.final.rendered.partitions.map(p=>({entity_ref:p.entityId,connected:partitionDelta(control.final,connected.final,p.entityId),cut:partitionDelta(control.final,cut.final,p.entityId),same_act_consumer_cut:partitionDelta(connected.final,cut.final,p.entityId)}));
 artifact('same-file-gpu-consumer-discriminator.json',{replays:results.map(r=>({variant:r.variant,instance:r.final.working.native_ref,native:r.final.native.instrument.influence.native_readback,simTime:r.final.rendered.simTime,position_sha256:sha(JSON.stringify(r.final.rendered.positions)),pixel_sha256:sha(JSON.stringify(r.pixels))})),byPartition});
 check(byPartition.find(p=>p.entity_ref===torus).connected.max_displacement>1e-5,'The connected native source determinant changes the actual resident torus body against the held control');
 check(byPartition.find(p=>p.entity_ref===torus).cut.max_displacement<1e-7,'Disconnecting native torus target consumption loses its predicted rendered effect while all32 bodies and controls remain');
 const otherBodies=byPartition.filter(p=>p.entity_ref!==torus);
 check(otherBodies.length===31&&otherBodies.every(p=>p.same_act_consumer_cut.max_displacement<1e-7),'The same actual native act preserves all31 non-torus consumers across the selective torus disconnect');
 const clockA=byPartition.find(p=>p.entity_ref===opening.working.native_ref+':entity:world-clock-a-hand');
 check(clockA.connected.max_displacement>1&&clockA.cut.max_displacement>1,'Clock A receives the same independent native phase consequence in both actual-act runs');
 assert.notDeepEqual(connected.pixels,cut.pixels,'With identical native acts and non-torus consumers, rendered pixels distinguish connected from disconnected torus consumption');
 check(true,'Native admission, actual GPU-bound texture, resident body effect and rendered pixels are independently discriminated');
 return results.map(r=>({variant:r.variant,instance:r.final.working.native_ref,pixel_sha256:sha(JSON.stringify(r.pixels)),position_sha256:sha(JSON.stringify(r.final.rendered.positions))}));
}

try{
 phase='actual production launch';
 const receiverModule=`import {relayKernelChannel,trackHostedAppState} from './src/expressions/hostedApp.ts';import {relayNaraChannel} from './src/expressions/naraChannel.ts';import {readScope,scopeProject} from './src/workspace/scope.ts';import {chatProvisionTarget} from './src/agent/chat/firstSend.ts';const frame=document.getElementById('world'),transport={kind:'bridge',url:${JSON.stringify(config.bridge)}};let hostedState=null;const stops=[trackHostedAppState(frame,value=>{hostedState=value;}),relayKernelChannel(frame,transport),relayNaraChannel(frame,transport,{project:()=>chatProvisionTarget(scopeProject(readScope())),expression:()=>hostedState?.nativeScene??null})];window.__EPI_REAL_HOST__={relay:'relayKernelChannel+relayNaraChannel+trackHostedAppState',bridge:${JSON.stringify(config.bridge)},state:()=>hostedState};frame.src='/__epi_application'+location.search;window.addEventListener('pagehide',()=>stops.forEach(stop=>stop()));`;
 const compiledHost=await build({stdin:{contents:receiverModule,resolveDir:root,sourcefile:'actual-production-host-relay-entry.mjs',loader:'js'},bundle:true,write:false,format:'esm',platform:'browser',metafile:true,define:{__CRADLE_WALK__:'false','process.env.NODE_ENV':'"production"'},plugins:[{name:'existing-vite-raw-assets',setup(b){b.onResolve({filter:/\?raw$/},args=>({path:resolve(dirname(args.importer),args.path.slice(0,-4)),namespace:'actual-raw-asset'}));b.onLoad({filter:/.*/,namespace:'actual-raw-asset'},args=>({contents:readFileSync(args.path,'utf8'),loader:'text'}));}}]});
 const receiver=compiledHost.outputFiles[0].text;
 writeFileSync(resolve(out,'actual-production-host-relay.mjs'),receiver);writeFileSync(resolve(out,'actual-production-application.html'),entry);
 receipt.immutable_assets={host:{file:resolve(out,'actual-production-host-relay.mjs'),sha256:sha(receiver),assembly_sha256:sha(receiverModule),inputs:Object.fromEntries(Object.keys(compiledHost.metafile.inputs).filter(p=>!p.startsWith('<')&&p!=='actual-production-host-relay-entry.mjs').map(p=>{const path=resolve(root,p.replace(/^actual-raw-asset:/,''));return[path,sha(readFileSync(path))];}))},application:{file:resolve(out,'actual-production-application.html'),sha256:sha(entry)},method:'Existing production relay functions bundled once with the same raw-asset loading; unchanged production application HTML copied once; neither receiver is loaded from a mutable Vite source module.'};
 const hostHtml=`<!doctype html><html><head><title>Actual Epi production entry</title><style>html,body,iframe{margin:0;width:100%;height:100%;border:0;background:#090b15}iframe{display:block}</style></head><body><iframe id="world"></iframe><script type="module" src="/__epi_host_receiver"></script></body></html>`;
 server=await createServer({root,configFile:false,plugins:[react(),{name:'actual-epi-production-entry',configureServer(s){s.middlewares.use((req,res,next)=>{const path=req.url?.split('?')[0];if(path==='/__epi_host_receiver'){res.setHeader('Content-Type','text/javascript');res.end(receiver);return;}if(path!=='/__epi_parent'&&path!=='/__epi_application')return next();res.setHeader('Content-Type','text/html');res.end(path==='/__epi_parent'?hostHtml:entry);});}}],resolve:{alias:{three:resolve(root,'node_modules/three')}},define:{__CRADLE_WALK__:'false'},server:{host:'127.0.0.1',port:0,fs:{allow:[root,resolve(root,'../../packages/oi-design-system')]}}});await server.listen();
 browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 receipt.browser={version:browser.version(),headless:true,reduced_motion:coldOpening?'no-preference':'reduce',requested_angle:'swiftshader'};
 page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:coldOpening?'no-preference':'reduce'});page.setDefaultTimeout(40000);page.setDefaultNavigationTimeout(60000);
 observePage(page);
 // The ordinary PointCloudHost supplies mode. The native recovery owner is
 // selected by this hosted query; omitting it would test browser IndexedDB
 // instead and could not establish a native checkpoint/restart claim.
 const url=`http://127.0.0.1:${server.httpServer.address().port}/__epi_parent?mode=expressions&host=expressions&world=epi-logos${coldOpening?'':'&still'}`+(config.existing_expression_ref?'&expression='+encodeURIComponent(config.existing_expression_ref):'');
 phase='actual production host relay launch';await page.goto(url);await page.waitForFunction(()=>document.querySelector('#world')?.getAttribute('src')?.startsWith('/__epi_application'),null,{timeout:90000});frame=await page.locator('#world').elementHandle().then(el=>el.contentFrame());phase='actual production application launch';
 await frame.waitForFunction(()=>window.__FIELD_STUDIES__?.enterEpiWorld&&window.__OI_KERNEL_EXPRESSIONS__?.kernelExpressionsAvailable(),null,{timeout:90000});
 receipt.browser.actual_gpu=await frame.evaluate(()=>{for(const c of document.querySelectorAll('canvas')){const g=c.getContext('webgl2')??c.getContext('webgl');if(!g)continue;const e=g.getExtension('WEBGL_debug_renderer_info');return{canvas:c.id,version:g.getParameter(g.VERSION),vendor:e?g.getParameter(e.UNMASKED_VENDOR_WEBGL):g.getParameter(g.VENDOR),renderer:e?g.getParameter(e.UNMASKED_RENDERER_WEBGL):g.getParameter(g.RENDERER)};}return{unavailable:true};});
 check(receipt.browser.actual_gpu.canvas==='field-canvas'&&receipt.browser.actual_gpu.version?.includes('WebGL 2'),'The ordinary production field has an actual WebGL 2 receiving context');
 check(await frame.locator('[data-epi="identity"]').isVisible(),'Ordinary production Epi entrance is visible before construction');
 const ordinaryEntranceHit=await frame.locator('[data-epi="identity"]').evaluate(button=>{
  // Retain the original acquired-button centre-hit predicate. This witness
  // distinguishes a replaced node from an actual current obstructing surface.
  const r=button.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2,hit=document.elementFromPoint(x,y);
  const describe=node=>node instanceof Element?{tag:node.tagName,id:node.id,classes:[...node.classList].slice(0,8),epi:node.getAttribute('data-epi')}:null;
  const hitPath=[];for(let node=hit;node&&hitPath.length<8;node=node.parentElement)hitPath.push(describe(node));
  return{connected:button.isConnected,current_node_matches:document.querySelector('[data-epi="identity"]')===button,disabled:button instanceof HTMLButtonElement?button.disabled:null,bounds:{x:r.x,y:r.y,width:r.width,height:r.height},point:{x,y},button:describe(button),hit:describe(hit),hit_path:hitPath,passes:hit?.closest('[data-epi="identity"]')===button};
 });
 artifact('ordinary-epi-entrance-hit.json',ordinaryEntranceHit);
 check(ordinaryEntranceHit.passes,'The ordinary Epi identity entrance is actually reachable above every application gate');
 check(await frame.evaluate(()=>window.__FIELD_STUDIES__.capabilities.kind)==='production','The actual production resident particle engine is loaded');
 await snapshot('00-ordinary-entry-at-rest');
 if(coldOpening){
  const cold=await snapshot('00-no-preference-cold-entry',true);
  const entryIntent=await frame.evaluate(()=>({world:new URL(location.href).searchParams.get('world'),still:new URL(location.href).searchParams.has('still'),reduced:matchMedia('(prefers-reduced-motion: reduce)').matches}));
  artifact('cold-entry-intent.json',entryIntent);
  assert.deepEqual(entryIntent,{world:'epi-logos',still:false,reduced:false});
  assert.equal(cold.state.fieldPaused,true);assert.equal(cold.state.simTime,0);assert.equal(cold.rendered.simTime,0);assert.equal(cold.rendered.steps,0);
  check(true,'An actual no-preference Epi entry begins held without a still or reduced-motion override');
 }
 const expressionCapabilities=(await op({op:'expression',request:{operation:'capabilities'}})).data;
 artifact('actual-native-expression-capabilities.json',expressionCapabilities);
 check(expressionCapabilities.schema==='oi.expression-capabilities/v1'&&expressionCapabilities.composition_budget?.render_formations===MAX_FORMATIONS&&expressionCapabilities.composition_budget?.render_pins===MAX_PINS,'Actual native Expression capabilities match the imported production renderer formation/pin limits');
 heartbeat=setInterval(async()=>{try{console.log('PROGRESS',phase,(await frame.locator('.epi-world-entrance [role="status"]').allTextContents()).join(' '));}catch{}},10000);

 phase='controlled person A ordinary construction';
 if(config.reopen_file){const opened=await frame.evaluate(path=>window.__FIELD_STUDIES__.openNativeFile(path),config.reopen_file);assert.equal(opened,true,'The actual native file open must be acknowledged before the world replay: '+JSON.stringify(await frame.evaluate(()=>window.__FIELD_STUDIES__.nativeWorking())));}else if(config.existing_expression_ref){await readyCurrent(identities[0].reading.person_ref);await action('save');}else await frame.evaluate(identity=>window.__FIELD_STUDIES__.enterEpiWorld(identity),identities[0]);
 if(config.stage==='selected-conversation-setup'){
  // Imported historical material contains a current reference without its
  // private native body. Ordinary Restore must first refuse missing custody;
  // only an explicit ordinary saved-identity Use acquires a reviewed new baseline.
  phase='historical current missing-custody refusal before explicit identity use';
  const missing='The saved native personal current has no protected checkpoint; explicitly use this saved identity to admit a new current';
  await frame.waitForFunction(message=>Array.from(document.querySelectorAll('.epi-world-entrance [data-native-personal-current-refusal] pre')).some(e=>e.textContent===message||e.textContent==='Error: '+message),missing,{timeout:180000});
  assert.match(await frame.locator('.epi-world-entrance [role="alert"]').innerText(),/Open Your identity.*Use saved identity/,'The native refusal has an executable ordinary recovery route; its exact raw cause remains in Inspect');
  const savedUseRefusals=await prepareSavedIdentityUseRefusals({page,frame,bridge:config.bridge,identity:identities[0],op,nativeDocument,selectActualBody:clickActualBody,receipt,output:out,artifact,onPhase:label=>{phase=label;}});
  const before=await snapshot('selection-historical-missing-private-current');
  assert.equal(before.current,null,'A missing private historical checkpoint cannot be reconstructed or silently recalculated');
  const oldReference=before.record.receiving.personal.current;
  const beforeNativeDocument=await nativeDocument(before.working.native_ref);
  assert.ok(oldReference?.ref?.startsWith('personal:nara-current:'));
  assert.ok(receipt.operations.some(row=>row.op==='nara_current'&&row.operation==='restore'&&row.ok===false&&row.error?.includes(missing)),'The actual native Restore refusal, not only a UI message, must be retained');
  check(true,'Historical saved current without protected custody refuses before any implicit acquisition');
  // Deliberately acquire through the real saved-profile UI. Its native Open
  // and select_identity receipts retain the actual saved source; no profile
  // draft is saved or unavailable old private body fabricated.
  const identityBefore=(await op({op:'nara_identity',request:{operation:'open',source_ref:identities[0].source.source_ref}})).data;
  assert.deepEqual(identityBefore.source,identities[0].source);
  const sourceSavesBefore=receipt.issued_requests.filter(row=>row.op==='nara_identity'&&row.operation==='save').length;
  await frame.locator('[data-epi="identity"]').click();
  await frame.locator('.nara-personal select[aria-label="Saved profiles"]').selectOption(identities[0].source.source_ref);
  const useSaved=frame.getByRole('button',{name:'Use saved identity',exact:true});
  await useSaved.waitFor({state:'visible',timeout:40000});
  await frame.waitForFunction(()=>Array.from(document.querySelectorAll('.nara-personal button')).some(button=>button.textContent==='Use saved identity'&&!button.disabled),null,{timeout:180000});
  // Genuine draft interaction cannot select the earlier saved input. No
  // owner fixture or synthetic reply is substituted for this UI guard.
  await frame.getByRole('button',{name:/^Birth details/}).click();
  const nameInput=frame.getByLabel('Your name',{exact:true}),savedName=await nameInput.inputValue();
  await nameInput.fill(savedName+' · controlled unsaved edit');
  assert.equal(await useSaved.isDisabled(),true,'An authored draft edit cannot be admitted as the earlier saved identity');
  const unchangedDraftSource=(await op({op:'nara_identity',request:{operation:'open',source_ref:identities[0].source.source_ref}})).data;
  assert.deepEqual(unchangedDraftSource.source,identityBefore.source);
  assert.deepEqual(unchangedDraftSource.reading.profile,identityBefore.reading.profile,'The pending UI draft is not written to the native identity Source');
  // Explicitly discard this controlled draft via the existing selector and
  // reopen the exact saved Source before the deliberate Use action.
  await frame.locator('.nara-personal select[aria-label="Saved profiles"]').selectOption('');
  await frame.locator('.nara-personal select[aria-label="Saved profiles"]').selectOption(identities[0].source.source_ref);
  await frame.waitForFunction(()=>Array.from(document.querySelectorAll('.nara-personal button')).some(button=>button.textContent==='Use saved identity'&&!button.disabled),null,{timeout:180000});
  const savedUseAdmission=await savedUseRefusals.armAcknowledgementRefusal();
  await useSaved.focus();await useSaved.press('Enter');
  receipt.saved_identity_use_refusals=await savedUseAdmission.finish();
  // The historical Restore alert remains until this actual Use is acknowledged.
  // Wait for its own mounted action to settle, rather than treating that earlier
  // alert as the outcome of a still-pending native selection/acquisition.
  await frame.waitForFunction(()=>{
   const instrument=document.querySelector('.nara-personal');
   return instrument?.querySelector('.nara-personal-content')?.getAttribute('aria-busy')==='false'
    &&(Array.from(instrument.querySelectorAll('[role="status"]')).some(e=>e.textContent==='Your saved identity is used in this Expression.')
      ||Array.from(instrument.querySelectorAll('[role="alert"]')).some(e=>e.textContent?.trim()));
  },null,{timeout:180000});
  const useErrors=await frame.locator('.nara-personal [role="alert"]').allTextContents();
  assert.equal(useErrors.filter(Boolean).length,0,'The actual ordinary saved-identity Use refused: '+useErrors.join(' / '));
  assert.ok((await frame.locator('.nara-personal [role="status"]').allTextContents()).includes('Your saved identity is used in this Expression.'),'Ordinary Use must complete its native rebind/Save/admission before the existing continuation predicates');
  await readyCurrent(identities[0].reading.person_ref);await noAlert();
  const identityAfter=(await op({op:'nara_identity',request:{operation:'open',source_ref:identities[0].source.source_ref}})).data;
  assert.deepEqual(identityAfter.source,identityBefore.source,'Ordinary Use saved identity preserves the native Central source and exact revision');
  assert.deepEqual(identityAfter.reading.profile,identityBefore.reading.profile,'Ordinary Use saved identity preserves the full actual authored input');
  assert.equal(receipt.issued_requests.filter(row=>row.op==='nara_identity'&&row.operation==='save').length,sourceSavesBefore,'Ordinary Use saved identity must not send any profile Save');
  const admitted=await snapshot('selection-explicit-new-private-current-admitted');
  assert.equal(admitted.record.person_ref,before.record.person_ref);
  assert.equal(admitted.record.nara_ref,before.record.nara_ref);
  assert.deepEqual(admitted.record.identity_source,before.record.identity_source);
  assert.equal(admitted.record.identity_input_revision,before.record.identity_input_revision);
  assert.deepEqual(admitted.record.world,before.record.world,'Explicit use preserves the complete original dated cosmic occasion and instance');
  assert.equal(admitted.current.context.event_ref,before.record.world.event_ref);
  const acceptedPin=receipt.operations.findLast(row=>row.op==='nara_current'&&row.operation==='pin'&&row.ok===true);
  assert.ok(acceptedPin?.actual_current?.artifact,'Explicit use must consume an actual acknowledged native Pin, not fabricate or retag the unavailable historical body');
  const pinReceipt=JSON.parse(readFileSync(resolve(out,acceptedPin.actual_current.artifact),'utf8'));
  assert.deepEqual(pinReceipt.response.outcome.data.context,admitted.current.context);
  assert.deepEqual(pinReceipt.response.outcome.data.reading,admitted.current.reading,'The full actual newly acquired native body reaches this ordinary personal receiver');
  check(true,'An explicit production entry using the actual saved native identity admits and retains a genuinely new current at the original person/occasion');
  const afterNativeDocument=await nativeDocument(admitted.working.native_ref),expectedNativeDocument=structuredClone(beforeNativeDocument);
  const beforeCarrier=beforeNativeDocument.scenes.find(scene=>scene.presentation?.scene?.epiWorld);
  const expectedCarrier=expectedNativeDocument.scenes.find(scene=>scene.scene_ref===beforeCarrier.scene_ref);
  const previousCurrent=beforeCarrier.presentation.scene.epiWorld.receiving.personal.current;
  const nextCurrent={ref:admitted.current.context.reading_ref,revision:admitted.current.context.reading_revision,availability:'available'};
  if(previousCurrent.ref!==nextCurrent.ref||previousCurrent.revision!==nextCurrent.revision){
   expectedNativeDocument.revision++;
   const personal=expectedCarrier.presentation.scene.epiWorld.receiving.personal;
   assert.equal(personal.participant_entity_refs.length,15,'Explicit current read retains all15 source-bound personal participants');
   const priorPersonal={person:structuredClone(personal.person),identity:structuredClone(personal.identity),current:structuredClone(previousCurrent)};
   const oldRefs=new Set([priorPersonal.person.ref,priorPersonal.identity.ref,priorPersonal.current.ref]);
   // Independent prediction of the exact subject operation: remove prior
   // personal bindings then append the unchanged source/person and new current;
   // redirect only actions targeting those exact prior references.
   const append=(retained,added)=>[...retained,...added.filter(value=>!retained.some(old=>isDeepStrictEqual(old,value)))].map(value=>structuredClone(value));
   for(const ref of personal.participant_entity_refs){
    const entity=expectedNativeDocument.entities[ref],subject=entity.subject;
    const matches=subject.readings.filter(value=>value.ref===previousCurrent.ref);
    assert.equal(matches.length,1,'Each actual participant has exactly one original current binding');
    assert.deepEqual(matches[0],previousCurrent);
    subject.sources=append(subject.sources.filter(value=>!oldRefs.has(value.ref)),[priorPersonal.person,priorPersonal.identity]);
    subject.readings=append(subject.readings.filter(value=>!oldRefs.has(value.ref)),[nextCurrent]);
    subject.actions=subject.actions.map(action=>({...action,...(action.target_ref===priorPersonal.identity.ref?{target_ref:priorPersonal.identity.ref}:action.target_ref===previousCurrent.ref?{target_ref:nextCurrent.ref}:{})}));
    // expression::Document::edited assigns each changed native member the
    // single successor Document revision, regardless of its prior revision.
    assert.notDeepEqual(subject,beforeNativeDocument.entities[ref].subject);
    entity.revision=expectedNativeDocument.revision;
   }
   personal.current=structuredClone(nextCurrent);personal.standing='qualified-native-current';
   const reset=structuredClone(expectedCarrier.presentation.scene);delete reset.epiWorld;
   assert.deepEqual(reset,beforeCarrier.presentation.saved,'Current rebinding must preserve the complete authored reset material');
   expectedCarrier.presentation.saved=reset;expectedCarrier.revision=expectedNativeDocument.revision;
  }
  assert.deepEqual(afterNativeDocument,expectedNativeDocument,'Explicit acquisition may change only the exact current reference and lawful native document/scene/participant revisions; all full material/private references/history/layout/source/body values are conserved');
  artifact('selection-explicit-new-current-admission.json',{operation:'actual ordinary Open saved profile -> Use saved identity -> native select_identity -> existing host.enterWorld -> native Pin; no identity resave',
   unavailable_historical_reference:oldReference,before_document:beforeNativeDocument,
   new_current:admitted.current,after_document:afterNativeDocument,
   standing:'Historical private payload unavailable; explicit new native acquisition, not restored f119 or silently normalized Document'});
 }
 await noAlert();await readyCurrent(identities[0].reading.person_ref);
 // Separate selection-only cases stop before any original cosmic/tick/whole
 // gate. The acknowledged ordinary producer may first repair its known stale
 // caption/current pointer; that setup is retained, not erased or relabelled.
 if(selectionStage){
  phase='isolated actual selected-conversation admission';
  const ownerRef={path:resolve(config.selection_custody_file),sha256:config.selection_custody_sha256};
  const ownerBytes=hashFileReadOnly(ownerRef.path);assert.ok(ownerBytes.bytes<=2*1024*1024);assert.equal(ownerBytes.sha256,ownerRef.sha256);
  const custody=JSON.parse(readFileSync(ownerRef.path,'utf8'));assert.equal(custody.schema,'epi.hosted-native-selection-owner-custody/v1');
  assert.equal(custody.world,resolve(custody.owned_output_root,'world'));assert.equal(custody.native_process.url,config.bridge);
  assert.equal(custody.source_cuts.oi.cut,config.binaries.oi.source_cut);assert.equal(custody.source_cuts.ql.cut,config.binaries.quaternal_logic.source_cut);
  assert.equal(custody.all_five.sha256,config.binaries.quaternal_logic.manifest.sha256);assert.deepEqual(custody.identity_ref,{path:resolve(config.identity_files[0]),...hashFileReadOnly(resolve(config.identity_files[0]))});
  let working=await frame.evaluate(()=>window.__FIELD_STUDIES__.nativeWorking());
  assert.ok(!working.busy&&!working.pending&&!working.failed&&working.file,'The actual ordinary admitted file must be clean/current');
  let document=await nativeDocument(working.native_ref);const saved=await savedFile(working,'selection-ordinary-admitted');
  assert.deepEqual(document,saved,'Selection starts only on a complete actual native save/file admission');
  assert.equal(document.expression_ref,custody.expression_ref);assert.equal(document.selection.scene_ref,document.expression_ref+':scene:personal');
  const records=document.scenes.filter(scene=>scene.presentation?.scene?.epiWorld);assert.equal(records.length,1);
  const carrier=records[0].presentation.scene.epiWorld,target=carrier.receiving.personal.locus_entity_ref;
  let admissionFile='selection-ordinary-admitted-file.json';
  if(config.stage==='selected-conversation-setup'){
   // Ordinary file admission preserves its saved body selection. Explicitly
   // choose this inquiry's canonical hub; do not rewrite a saved centre's
   // subject or silently turn file loading into a focus operation.
   phase='ordinary canonical personal hub focus and same-file save';
   const before=structuredClone(document),beforeFile=structuredClone(working.file);
   artifact('selection-preserved-saved-arrival.json',{document:before,file:beforeFile,source_file:'selection-ordinary-admitted-file.json'});
   await frame.locator('[data-epi-body]').selectOption(target);
   const deadline=Date.now()+30000;let focused;
   for(;;){
    const current=await frame.evaluate(()=>window.__FIELD_STUDIES__.nativeWorking());
    const remaining=deadline-Date.now();
    assert.ok(remaining>0,'The ordinary canonical hub choice must receive its actual native focus acknowledgement in30s');
    const readback=await nativeDocument(document.expression_ref,AbortSignal.timeout(remaining));
    assert.ok(Date.now()<deadline,'A late native reply cannot qualify the original30s focus admission');
    if(!current.busy&&!current.pending&&!current.failed&&current.revision===readback.revision&&readback.selection.entity_ref===target){focused=readback;break;}
    await new Promise(resolve=>setTimeout(resolve,100));
   }
   const expected=structuredClone(before);
   assert.ok(focused.revision===before.revision||focused.revision===before.revision+1,'Only the ordinary native focus revision may advance');
   expected.revision=focused.revision;expected.selection={scene_ref:before.selection.scene_ref,entity_ref:target};
   assert.deepEqual(focused,expected,'Canonical hub focus preserves every other actual body/source/person/occasion/material/history value');
   artifact('selection-explicit-native-focus.json',{before,after:focused,allowed_delta:['revision','selection'],operation:'ordinary Choose a body control'});
   await action('save');await readyCurrent(identities[0].reading.person_ref);
   working=await frame.evaluate(()=>window.__FIELD_STUDIES__.nativeWorking());
   assert.ok(!working.busy&&!working.pending&&!working.failed&&working.file,'The ordinary hub focus save must be acknowledged/current');
   assert.deepEqual(working.file.location,beforeFile.location,'Hub focus saves the same actual file');
   if(before.selection.entity_ref!==target)assert.notEqual(working.file.revision,beforeFile.revision,'Changed hub focus must advance the actual same-file CAS');
   document=await nativeDocument(working.native_ref);
   assert.deepEqual(document,focused,'Ordinary Save preserves the complete acknowledged focus document');
   assert.deepEqual(await savedFile(working,'selection-ordinary-focused'),document,'The saved hub basis is admitted by the actual native file decoder');
   admissionFile='selection-ordinary-focused-file.json';
  }
  assert.equal(document.selection.entity_ref,target);assert.equal(document.entities[target].subject.subject_ref,'ql:m-coordinate:bimba:M4.4.4.4');
  assert.equal(carrier.person_ref,identities[0].reading.person_ref);assert.equal(carrier.identity_source.source_ref,identities[0].source.source_ref);
  assert.deepEqual(document.scenes.map(scene=>scene.entity_refs.length),[32,9,7],'Selection setup cannot omit any original cosmic/personal/branch members');
  const file=JSON.parse(readFileSync(resolve(out,admissionFile),'utf8'));
  const admission={schema:'epi.hosted-native-selected-admission/v1',expression_ref:document.expression_ref,file:working.file,document,
   content_sha256:file.content_sha256,content_bytes:file.content_bytes,owner_decode:file.owner_decode,
   source_evidence_ref:{path:resolve(out,admissionFile),...hashFileReadOnly(resolve(out,admissionFile))},
   standing:'Actual ordinary producer admission/native save/file decoder; no model body/provider/whole proof'};
  json('selection-native-admission.json',admission);
  const admissionRef={path:resolve(out,'selection-native-admission.json'),...hashFileReadOnly(resolve(out,'selection-native-admission.json'))};
  if(config.stage==='selected-conversation-case'){
   assert.ok(custody.admission_ref,'Each case needs the independently acknowledged preceding setup basis');
   const previous=qualifiedJson(custody.admission_ref,'Prior complete ordinary selection setup');assert.equal(previous.schema,admission.schema);
   assert.deepEqual(admission.document,previous.document,'A fresh isolated owner must admit every same native document value without normalisation');
   assert.ok(custody.protected_current_custody_ref,'Each isolated owner needs the exact native-admitted private current custody');
   const checkpointCustody=qualifiedJson(custody.protected_current_custody_ref,'Actual native protected current custody');
   assert.equal(checkpointCustody.schema,'epi.hosted-native-protected-current-custody/v1');
   const nativeCurrent=(await op({op:'nara_current',project:'',request:{operation:'read',binding:{operation:'context',role:'nara',
    source_ref:carrier.identity_source.source_ref,expected_revision:carrier.identity_source.revision,
    person_ref:carrier.person_ref,nara_ref:carrier.nara_ref,expression_ref:document.expression_ref}}})).data;
   assert.equal(nativeCurrent.status,'available');assert.equal(nativeCurrent.private,true);assert.equal(nativeCurrent.public_export,false);
   assert.equal(nativeCurrent.expression_revision,document.revision);assert.equal(nativeCurrent.expression_ref,document.expression_ref);
   assert.deepEqual(nativeCurrent.context,checkpointCustody.current.context,'Cold native restore preserves the complete current context/digest/source/occasion');
   assert.deepEqual(nativeCurrent.reading,checkpointCustody.current.reading,'Cold native restore consumes the complete actual previously admitted private body with all original receipts');
   assert.equal(receipt.issued_requests.filter(row=>row.op==='nara_current'&&row.operation==='pin').length,0,'Cold ordinary admission cannot silently acquire a new current');
   assert.ok(receipt.operations.some(row=>row.op==='nara_current'&&row.operation==='restore'&&row.ok===true),'Actual cold native Restore acknowledgement is mandatory');
   artifact('selection-cold-native-current-receiving.json',{native_current:nativeCurrent,source_custody_ref:custody.protected_current_custody_ref,
    standing:'Actual fresh native owner and ordinary producer Restore consume full previously admitted native body; no new astronomy calculation/provider/model proof'});
   check(true,'Fresh native owner restores the exact previously admitted full private current while complete saved Document/file/CAS remain unchanged');
   assert.deepEqual(admission.file,previous.file);assert.equal(admission.content_sha256,previous.content_sha256);assert.equal(admission.content_bytes,previous.content_bytes);
  }
  receipt.selection_admission_ref=admissionRef;
  receipt.selection_owner_custody={...ownerRef,bytes:ownerBytes.bytes};
  if(config.stage==='selected-conversation-case'){
   const actualParentUrl=url+'&expression='+encodeURIComponent(document.expression_ref);
   const host={...receipt.immutable_assets.host,path:receipt.immutable_assets.host.file,bytes:hashFileReadOnly(receipt.immutable_assets.host.file).bytes};
   const application={...receipt.immutable_assets.application,path:receipt.immutable_assets.application.file,bytes:hashFileReadOnly(receipt.immutable_assets.application.file).bytes};
   const qualification={...custody,schema:'oi.epi-selected-conversation-source-built-hosted/v1',scope:'selection-only-no-provider',
    expression_ref:document.expression_ref,person_ref:carrier.person_ref,identity_source_ref:carrier.identity_source.source_ref,
    event_ref:carrier.world.event_ref,snapshot_ref:carrier.world.snapshot_ref,instance_ref:carrier.world.instance_ref,
    admission_ref:custody.admission_ref,aikit:custody.host_owners.aikit,
    frontend:{actual_parent_url:actualParentUrl,iframe_id:'world',application_path:'/__epi_application',receiver_path:'/__epi_host_receiver',host,application}};
   delete qualification.selection_case;
   json('selection-current-qualification.json',qualification);
   const qualificationRef={path:resolve(out,'selection-current-qualification.json'),...hashFileReadOnly(resolve(out,'selection-current-qualification.json'))};
   assert.ok(qualificationRef.bytes<=2*1024*1024);
   const selectedConfig={bridge:config.bridge,app_url:actualParentUrl,world:custody.world,output:resolve(out,'actual-case'),
    expression_ref:document.expression_ref,person_ref:carrier.person_ref,identity_source_ref:carrier.identity_source.source_ref,
    selection_case:config.selection_case,qualification_mode:'source-built-hosted-selection-only',qualification:qualificationRef.path,qualification_sha256:qualificationRef.sha256};
   json('selected-case-config.json',selectedConfig);
   // Close the initial admission frame before the unchanged four-case driver
   // opens its own real production host. The immutable receiver/server remain.
   clearInterval(heartbeat);heartbeat=null;await browser.close();browser=null;frame=null;page=null;
   const stdout=openSync(resolve(out,'selected-case.stdout'),'wx'),stderr=openSync(resolve(out,'selected-case.stderr'),'wx');
   const child=spawn(process.execPath,[resolve(root,'tests/epi-selected-conversation-native.mjs'),resolve(out,'selected-case-config.json')],{cwd:root,env:process.env,stdio:['ignore',stdout,stderr]});
   receipt.selected_child={pid:child.pid,argv:[process.execPath,resolve(root,'tests/epi-selected-conversation-native.mjs'),resolve(out,'selected-case-config.json')],cwd:root,qualification:qualificationRef};json('receipt.json',receipt);
   let exit;try{exit=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',(code,signal)=>resolve({code,signal}));});}finally{closeSync(stdout);closeSync(stderr);}
   receipt.selected_child.exit=exit;assert.equal(exit.code,0,'The actual selected-case child failed; retain its stdout/stderr and owned family');assert.equal(exit.signal,null);
   const selectedReceiptPath=resolve(out,'actual-case/receipt.json'),selected=qualifiedJson({path:selectedReceiptPath,...hashFileReadOnly(selectedReceiptPath)},'Actual selected-case proof');
   assert.equal(selected.schema,'oi.epi-selected-conversation-native-gate/v1');assert.equal(selected.passed,true);assert.equal(selected.failure,undefined);assert.equal(selected.selection_case,config.selection_case);
   receipt.selected_case_ref={path:selectedReceiptPath,...hashFileReadOnly(selectedReceiptPath)};
   const durable=await op({op:'expression',request:{operation:'inspect_file',location:admission.file.location,expected_file_revision:admission.file.revision}});
   assert.equal(durable.data.state,'ready');assert.deepEqual(durable.data.document,admission.document);assert.deepEqual(durable.data.file,admission.file);
  }
  check(true,'Isolated selection-only ordinary native admission and outcome preserved the complete durable controlled personal world');
  receipt.passed=true;const stop=Error('Selection-only stage complete; original whole/restart not executed in this lifetime');stop.intentionalStop=true;throw stop;
 }
 // A saved Expression reopens its actual selected scene, including a reviewed
 // personal coordinate adoption. Preserve that arrival, then use the ordinary
 // world navigation before requiring the cosmic field's source consumers.
 // Opening a different scene is not a native failure or a missing cosmic body.
 let savedProcessArrival=null;
 if(config.reopen_file){
  const arrival=await snapshot('00-reopened-saved-scene');
  if(config.reopen_acknowledgement_file){
   // Qualify the actual saved personal arrival before intentional navigation.
   // Later cosmic receiving is a distinct encounter, not the saved selection.
   await frame.waitForFunction(()=>{const f=window.__FIELD_STUDIES__,s=f.getState(),scene=f.getDocument().scenes[s.sceneIndex],actual=f.inspect();return scene?.entities.every(e=>actual.partitions.some(p=>p.entityId===e.id&&p.end>p.start));},null,{timeout:30000});
   await frame.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   const a=await snapshot('00-fresh-process-saved-personal-arrival',true),aDoc=await nativeDocument(a.working.native_ref);
   savedProcessArrival=a;
   assert.equal(config.stage,'entry','A prior native save acknowledgement applies only to the separate fresh-process entry gate');
   assert.ok(config.reopen_expected,'Restart entry requires exact prior acknowledged person/instance/occasion/selection');
   const acknowledgedPath=resolve(config.reopen_acknowledgement_file),acknowledgedHash=hashFileReadOnly(acknowledgedPath);
   assert.ok(acknowledgedHash.bytes<=24*1024*1024,'Bounded prior full native Document acknowledgement');
   assert.equal(acknowledgedHash.sha256,config.reopen_acknowledgement_sha256,'Exact frozen prior save/inspect/file read acknowledgement');
   const acknowledged=JSON.parse(readFileSync(acknowledgedPath,'utf8'));
   assert.equal(acknowledged.schema,'epi.hosted-native-saved-continuation/v1');
   assert.equal(acknowledged.prior_native_generation,config.reopen_prior_native_generation);
   const prior=qualifiedJson(acknowledged.prior_full_receipt_ref,'Prior complete production proof');
   assert.equal(prior.schema,'oi.epi-world-production-native-proof/v1');assert.equal(prior.passed,true);assert.equal(prior.failure,undefined);
   assert.deepEqual(prior.continuation.file,acknowledged.file,'Only the independently acknowledged latest A save supplies the current restart fence');
   for(const key of ['expression_ref','person_ref','event_ref','scene_ref','entity_ref'])assert.equal(prior.continuation[key],config.reopen_expected[key],'Prior completed encounter supplies restart '+key);
   const priorSavedFile=qualifiedJson(acknowledged.prior_saved_file_ref,'Prior actual native save/file read/inspect');
   assert.equal(priorSavedFile.owner_decode,'expression.inspect_file');
   assert.deepEqual(priorSavedFile.document,acknowledged.document,'The restart expectation comes from prior complete native file admission, not a restarted reply');
   assert.deepEqual({location:priorSavedFile.location,revision:priorSavedFile.revision},acknowledged.file);
   assert.deepEqual(aDoc,acknowledged.document,'A fresh native/browser body recovers the complete exact previously acknowledged saved Document');
   assert.deepEqual(a.working.file,acknowledged.file,'Opening must retain the actual prior acknowledged file location and CAS fence');
   assert.equal(a.working.revision,acknowledged.document.revision);assert.ok(!a.working.pending,'No current pending edit may masquerade as durable restart');
   assert.deepEqual(aDoc.selection,acknowledged.document.selection);
   const canonical=['cosmic','personal','branches'].map(role=>`${a.working.native_ref}:scene:${role}`);
   assert.equal(aDoc.scenes.length,4,'The preceding actual Save & next acknowledged exactly one deliberate fourth presentation');
   const base=canonical.map(ref=>{const scene=aDoc.scenes.find(s=>s.scene_ref===ref);assert.ok(scene,'The exact canonical '+ref+' is still required');return scene;});
   assert.deepEqual(base.map(s=>s.entity_refs.length),[32,9,7],'Restart keeps complete original cosmic/personal/branch membership');
   const additional=aDoc.scenes.filter(s=>!canonical.includes(s.scene_ref));assert.equal(additional.length,1);
   assert.deepEqual(additional[0].entity_refs,base[0].entity_refs,'The acknowledged fourth scene deliberately presents the same cosmic members');
   assert.ok(!additional[0].presentation.scene.epiWorld,'The fourth presentation cannot duplicate the machine world receipt');
   artifact('fresh-process-prior-save-qualification.json',{path:acknowledgedPath,...acknowledgedHash,prior_full_receipt_ref:acknowledged.prior_full_receipt_ref,file:acknowledged.file,document_revision:acknowledged.document.revision,scenes:aDoc.scenes.map(s=>({scene_ref:s.scene_ref,entity_refs:s.entity_refs})),selection:aDoc.selection});
   check(true,'Fresh process entry retains the exact acknowledged four-scene Document, canonical 32/9/7 members, deliberate cosmic continuation, person/occasion/selection and current native file fence');

   assert.deepEqual(await savedFile(a.working,'fresh-process-saved-personal-arrival'),acknowledged.document,'The ordinary restarted file decoder receives the exact full previously acknowledged saved Document');
   const arrivedScene=aDoc.scenes.find(scene=>scene.scene_ref===config.reopen_expected.scene_ref);assert.ok(arrivedScene);
   assert.equal(arrivedScene.scene_ref,`${a.working.native_ref}:scene:personal`,'Restart receives the acknowledged personal presentation before cosmic navigation');
   assert.equal(aDoc.entities[config.reopen_expected.entity_ref]?.subject?.subject_ref,'ql:m-coordinate:bimba:M4.4.4.4','Saved selected subject retains the canonical shared personal locus');
   assert.equal(a.record.world.instance_ref,config.reopen_expected.expression_ref);assert.equal(a.record.person_ref,config.reopen_expected.person_ref);assert.equal(a.record.world.event_ref,config.reopen_expected.event_ref);
   assert.equal(a.current.reading.identity.person_ref,config.reopen_expected.person_ref);assert.equal(a.current.context.event_ref,config.reopen_expected.event_ref);
   assert.equal(a.document.scenes[a.state.sceneIndex]?.id,config.reopen_expected.scene_ref,'The actual arrival view receives the frozen saved personal scene');assert.ok(a.state.selected.includes(config.reopen_expected.entity_ref),'The actual arrival selection receives the frozen saved personal subject');
   requirePartitions(a,arrivedScene.entity_refs,'Saved personal arrival');requirePersonalDrivers(a,'Saved personal arrival');
  }
  const cosmicRef=arrival.record.receiving.scene_ref;
  if(arrival.document.scenes[arrival.state.sceneIndex]?.id!==cosmicRef)await sceneNavigate(cosmicRef);
  // Focus is an acknowledged Document edit. The first whole trial must save
  // its deliberate cosmic selection before calling that file current below.
  // Restart preserves its separately qualified durable personal arrival.
  if(!config.reopen_acknowledgement_file)await action('save');
 }
 await frame.waitForFunction(()=>{const values=Object.values(window.__FIELD_STUDIES__.telemetry().sourceStatus);return values.length>=6&&values.every(value=>value.includes('source active'));},null,{timeout:30000});
 // A semantic Save opens the normal controls. Close that actual disclosure
 // before the commissioned rest view; preserve the complete current world.
 const restBeforeControls=await nativeDocument((await frame.evaluate(()=>window.__FIELD_STUDIES__.nativeWorking())).native_ref);
 const restWorkingBefore=await frame.evaluate(()=>window.__FIELD_STUDIES__.nativeWorking());
 const restBasis=()=>frame.evaluate(()=>{const f=window.__FIELD_STUDIES__,s=f.getState(),n=f.native();return{sceneIndex:s.sceneIndex,selected:s.selected,scenePlaying:s.scenePlaying,journeyPlaying:s.journeyPlaying,fieldPaused:s.fieldPaused,camera:s.camera,native:{status:n.status,lease:n.lease,lifetime:n.lifetime}};});
 const restStateBefore=await restBasis();assert.equal(restStateBefore.native.status,'manual');assert.equal(restStateBefore.native.lease,null);
 assert.equal(restStateBefore.native.lifetime.admission_pending,false);assert.equal(restStateBefore.native.lifetime.close_pending,false);assert.equal(restStateBefore.native.lifetime.operation_pending,0);assert.equal(restStateBefore.native.lifetime.close_error,null);
 const restDisclosure=frame.locator('.epi-world-entrance details.epi-play');assert.equal(await restDisclosure.count(),1);
 if(await restDisclosure.evaluate(details=>details.open))await restDisclosure.locator('summary').click();
 assert.equal(await restDisclosure.evaluate(details=>details.open),false,'The ordinary Shape & play disclosure is closed before the first rest capture');
 assert.deepEqual(await nativeDocument(restWorkingBefore.native_ref),restBeforeControls,'Closing ordinary controls preserves the complete authored/native Document');
 assert.deepEqual(await frame.evaluate(()=>window.__FIELD_STUDIES__.nativeWorking()),restWorkingBefore,'Closing ordinary controls preserves current native admission');
 assert.deepEqual(await restBasis(),restStateBefore,'Closing ordinary controls preserves current manual scene/selection');
 const a=await snapshot('01-person-a-cosmic-at-rest',true);
 if(coldOpening){
  await frame.waitForFunction(()=>!window.__FIELD_STUDIES__.nativeWorking().busy,null,{timeout:180000});
  const nativeBefore=await nativeDocument(a.working.native_ref);
  const panes=await frame.evaluate(()=>['live-workspace','toolbelt-panel','context-panel','inspector','belt-picker'].map(id=>{const node=document.getElementById(id);if(!node)throw Error('Missing actual authoring pane '+id);return{id,hidden:node.hidden||getComputedStyle(node).display==='none'};}));
  artifact('cold-opening-authoring-panes.json',panes);
  assert.ok(panes.every(p=>p.hidden),'Actual new-world rest does not inherit generic authoring panes');
  assert.equal(await frame.locator('[data-epi="quiet"]').getAttribute('aria-pressed'),'true');
  assert.equal((await frame.locator('[data-epi="quiet"]').innerText()).trim(),'Resume motion');
  await frame.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const cold=await snapshot('01a-no-preference-native-reception',true);
  assert.equal(cold.state.fieldPaused,true);assert.equal(cold.state.simTime,0);assert.equal(cold.rendered.simTime,0);assert.equal(cold.rendered.steps,0);
  assert.equal(cold.native.status,'manual');assert.equal(cold.native.lease,null);assert.equal(cold.native.lifetime.admission_pending,false);assert.equal(cold.native.lifetime.close_pending,false);assert.equal(cold.native.lifetime.operation_pending,0);assert.equal(cold.native.lifetime.close_error,null);
  assert.deepEqual(cold.document,a.document);assert.deepEqual(cold.record,a.record);assert.deepEqual(cold.current,a.current);
  assert.deepEqual(await nativeDocument(a.working.native_ref),nativeBefore,'Held cold reception preserves the complete actual native Document after its acknowledged correction/current/file operations');
  check(true,'Actual saved-file reception remains at rest, with truthful quiet controls and no generic panes, before every original native/whole/consumer gate');
 }
 check(a.record.world.subject_ref===identities[0].reading.person_ref&&a.record.receiving.personal.canonical_locus==='ql:m-coordinate:bimba:M4.4.4.4','The actual person is bound to the Personal Pratibimba locus in one native world instance');
 check(a.record.world.event_ref===a.record.world.snapshot_ref&&a.current.context.event_ref===a.record.world.event_ref,'Cosmic event and protected PersonalCurrent encounter one admitted native sky occasion');
 check(a.record.inventory.length===2141,'Production construction consumes the complete admitted 2,141-subject Bimba inventory');
 const aDoc=await nativeDocument(a.working.native_ref);artifact('person-a-native-owner-document.json',aDoc);
 const actualCosmic=a.document.scenes[a.state.sceneIndex],nativeCosmic=aDoc.scenes.find(scene=>scene.scene_ref===a.record.receiving.scene_ref),budget=expressionCapabilities.composition_budget;
 const expectedClockCaption='Gold circle and diamond. Advance one tick moves the M1/M3 source clocks by 30° and aligns Clock A with their new position.';
 for(const material of [nativeCosmic?.presentation?.scene,nativeCosmic?.presentation?.saved,actualCosmic]){
  const labels=material?.text?.filter(label=>label.id===`${a.record.receiving.scene_ref}:label-clock-a`);
  assert.equal(labels?.length,1,'The actual native live/saved and loaded cosmic material each retain one Clock A caption');
  assert.equal(labels[0].body,expectedClockCaption,'Ordinary new or retained-world admission receives the source-qualified Clock A caption');
 }
 check(true,'The corrected Clock A meaning reaches actual native live/saved material and the loaded ordinary receiving scene');
 // Typography is consumed by the ordinary app, not inferred from text presence.
 // The installed1280px window leaves a1020px Expression iframe beside Central.
 // Width/height changes exercise layout only; the complete current Document
 // and its native subject/occasion stay unchanged. Narrow/short measurements
 // are retained as limitations, not promoted to a universal responsive pass.
 const captionDocumentBefore=await frame.evaluate(()=>window.__FIELD_STUDIES__.getDocument());
 const captionNativeBefore=await nativeDocument(a.working.native_ref),captionViewport=page.viewportSize();
 const captionMeasurements=[];
 try{
  for(const size of [{width:1020,height:819,required:true},{width:1440,height:1000,required:true},{width:760,height:900,required:false},{width:360,height:900,required:false},{width:1020,height:600,required:false}]){
   await page.setViewportSize({width:size.width,height:size.height});
   await frame.waitForFunction(({width,height})=>innerWidth===width&&innerHeight===height,size,{timeout:10000});
   await frame.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   const measured=await frame.evaluate(()=>{const api=window.__FIELD_STUDIES__,d=api.getDocument(),s=d.scenes[api.getState().sceneIndex],rect=element=>{const r=element.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,top:r.top,right:r.right,bottom:r.bottom,left:r.left};};
    return{width:innerWidth,height:innerHeight,scene:s.id,total_duration:d.scenes.reduce((sum,scene)=>sum+scene.duration,0),duration:s.duration,entities:s.entities.map(e=>e.id),layers:s.text.filter(t=>t.visible).map(t=>{const article=document.querySelector('[data-text-id='+JSON.stringify(t.id)+']'),h1=article?.querySelector('h1'),p=article?.querySelector('p');if(!article||!h1||!p)throw Error('A required authored caption is absent from the ordinary receiving DOM');return{id:t.id,title:t.title,body:t.body,kicker:t.kicker,authored_size:t.size,inline_size:h1.style.fontSize,computed_size:getComputedStyle(h1).fontSize,actual_title:h1.textContent,actual_body:p.textContent,kicker_count:article.querySelectorAll('.kicker').length,box:rect(article),heading_box:rect(h1),body_box:rect(p)};})};});
   // Preserve actual operands even if an exact size/body assertion refuses.
   artifact('ordinary-caption-layout-current-'+size.width+'x'+size.height+'.json',{standing:'Unasserted actual DOM measurement; no receiving acceptance',requested:size,measurement:measured});
   const ref=a.record.receiving.scene_ref;
   assert.deepEqual(measured.layers.map(t=>t.id),[ref+':caption',ref+':label-earth',ref+':label-clock-a',ref+':label-clock-b',ref+':label-register'],'The complete authored five-caption cohort remains ordinary material');
   assert.equal(measured.scene,actualCosmic.id);assert.equal(measured.duration,3600);
   if(!config.reopen_acknowledgement_file)assert.equal(measured.total_duration,10800);
   else assert.equal(measured.total_duration,captionDocumentBefore.scenes.reduce((sum,scene)=>sum+scene.duration,0),'The later saved continuation retains its acknowledged complete Journey duration, including any native Save & next scene');
   assert.deepEqual(measured.entities,actualCosmic.entities.map(e=>e.id),'The layout repair preserves all32 cosmic bodies, including the seven centres');
   for(const layer of measured.layers){const expected=size.width<761?Math.min(36,layer.authored_size):size.width<1051?Math.min(38,layer.authored_size):layer.authored_size;
    assert.equal(layer.inline_size,expected+'px');assert.equal(layer.computed_size,expected+'px','Responsive CSS must not overrule the shared authored heading size');
    assert.equal(layer.actual_title,layer.title);assert.equal(layer.actual_body,layer.body);assert.equal(layer.kicker_count,layer.kicker?1:0,'An empty kicker has no ordinary rule, label or gap');
    for(const box of [layer.box,layer.heading_box,layer.body_box])for(const value of Object.values(box))assert.ok(Number.isFinite(value),'Caption geometry must be finite');
   }
   measured.visible_bounds=measured.layers.every(t=>t.box.left>=0&&t.box.top>=0&&t.box.right<=measured.width&&t.box.bottom<=measured.height);
   measured.overlaps=measured.layers.flatMap((left,index)=>measured.layers.slice(index+1).filter(right=>left.box.left<right.box.right&&right.box.left<left.box.right&&left.box.top<right.box.bottom&&right.box.top<left.box.bottom).map(right=>[left.id,right.id]));
   measured.required=size.required;captionMeasurements.push(measured);artifact('ordinary-caption-layout-measurements.json',{standing:'Actual ordinary DOM receiving; literal text/geometry only, no shape/contrast/human legibility acceptance',measurements:captionMeasurements});
   if(size.required){assert.equal(measured.visible_bounds,true,'Every generated caption must remain within the actual original/wide reading viewport');assert.deepEqual(measured.overlaps,[],'The actual generated caption boxes must not overlap at installed1020x819 and wide rest');}
  }
 }finally{if(captionViewport)await page.setViewportSize(captionViewport);}
 assert.deepEqual(await frame.evaluate(()=>window.__FIELD_STUDIES__.getDocument()),captionDocumentBefore,'Layout measurements preserve the complete authored Document');
 assert.deepEqual(await nativeDocument(a.working.native_ref),captionNativeBefore,'Layout measurements preserve the complete native Document/person/occasion basis');
 check(true,'Ordinary generated captions retain exact text and authored heading sizes without overlap at the installed iframe and wide rest; narrow/short geometry is independently retained');
 check(nativeCosmic?.entity_refs.length===32&&actualCosmic.entities.length===32&&actualCosmic.entities.filter(e=>e.kind==='formation'&&e.enabled!==false).length<=budget.render_formations&&actualCosmic.entities.filter(e=>e.kind==='pin'&&e.enabled!==false).length<=budget.render_pins&&nativeCosmic.entity_refs.length<=budget.scene_members,'All32 required cosmic bodies fit actual native/renderer budgets before the existing no-body-drop receiving gates');
 check(aDoc.scenes.filter(s=>s.presentation?.scene?.epiWorld).length===1&&aDoc.scenes.every(s=>!s.presentation?.saved?.epiWorld)&&!a.record.native_source.world,'One complete machine world receipt is retained once, independently of authored saved material');
 check(a.record.world.basis&&a.record.world.binding&&a.record.world.event&&JSON.stringify(a.record.world.basis)===JSON.stringify(a.record.world.binding.native_basis)&&JSON.stringify(a.record.world.event)===JSON.stringify(a.record.world.basis.input),'The retained complete world preserves its exact admitted coupled input and receiving native basis');
 check(a.record.runtime_buffers?.schema==='oi.epi-native-runtime-buffers/v1'&&a.record.runtime_buffers.policy==='native-owner-recompose'&&a.record.runtime_buffers.buffers.length===2&&!a.record.world.binding.presentation.slots_a&&!a.record.world.binding.presentation.slots_b,'Portable scene material retains exact runtime-buffer qualification instead of copying native texture arrays');
 const actualOriginalPreparation=nativePrepared.find(p=>p.world.instance_ref===a.working.native_ref);
 let rawOwnerWorld=actualOriginalPreparation?.world;
 if(!rawOwnerWorld&&config.original_owner_world_file){const original=JSON.parse(readFileSync(resolve(config.original_owner_world_file),'utf8'));rawOwnerWorld=original.response?.outcome?.data?.source?.world;assert.equal(rawOwnerWorld?.instance_ref,a.working.native_ref,'The restart comparator uses the retained original actual native owner world');receipt.original_owner_world={path:resolve(config.original_owner_world_file),sha256:sha(readFileSync(resolve(config.original_owner_world_file)))};}
 assert.ok(rawOwnerWorld,'Actual original native prepare output is required for portable source equality');
 const decoded=structuredClone(a.record.world);assert.equal(decoded.schema,'oi.epi-portable-world/v1');assert.equal(decoded.native_owner_sources.length,3);
 decoded.schema='ql.scene-world/v1';decoded.native_owner_sources=Object.fromEntries(decoded.native_owner_sources.map(source=>[source.role,source.reading]));
 for(const key of ['slots_a','slots_b'])decoded.binding.presentation[key]=rawOwnerWorld.binding.presentation[key];
 assert.deepEqual(decoded,rawOwnerWorld);
 check(true,'Portable storage preserves every exact original native world semantic field and constructor/coupled/field ReadingRef through the explicit source-role codec');
 const originalRecovery=actualOriginalPreparation??(config.original_owner_world_file?JSON.parse(readFileSync(resolve(config.original_owner_world_file),'utf8')):null);
 assert.ok(originalRecovery,'Original actual preparation request is required for separate immutable buffer recovery');
 await recoverOriginalRuntimeBuffers(a,originalRecovery);

 if(!config.reopen_acknowledgement_file){
  check(aDoc.scenes.length===3,'The native owner stores the three connected cosmic, personal and branch scenes');
  check(aDoc.scenes.map(s=>s.entity_refs.length).join(',')==='32,9,7','The native owner retains all 32 cosmic, 9 personal and 7 branch occurrences');
 }
 const cosmic=aDoc.scenes.find(s=>s.scene_ref===a.record.receiving.scene_ref),personal=aDoc.scenes.find(s=>s.scene_ref===`${a.working.native_ref}:scene:personal`),branches=aDoc.scenes.find(s=>s.scene_ref===`${a.working.native_ref}:scene:branches`);
 assert.ok(cosmic&&personal&&branches);const openingScene=aDoc.scenes.find(s=>s.scene_ref===a.document.scenes[a.state.sceneIndex]?.id);assert.ok(openingScene);requirePartitions(a,openingScene.entity_refs,'Native opening rest');requireInitialRestTargets(a,openingScene.entity_refs,'Native opening rest');
 if(!config.reopen_acknowledgement_file)await savedFile(a.working,'person-a-opening');
 else artifact('fresh-process-cosmic-after-saved-arrival.json',{standing:'Newer live cosmic selection after exact durable personal arrival; this view is not the prior saved personal file',saved_arrival_artifact:'00-fresh-process-saved-personal-arrival.json',saved_file_artifact:'fresh-process-saved-personal-arrival-file.json',live_revision:a.working.revision,live_scene_ref:openingScene.scene_ref,prior_file_fence:savedProcessArrival.working.file});
 receipt.opening_world={expression_ref:a.working.native_ref,file:a.working.file,person_ref:a.record.person_ref,nara_ref:a.record.nara_ref,identity_source:a.record.identity_source,current_context:a.current.context,event_ref:a.record.world.event_ref,scene_ref:openingScene.scene_ref};json('receipt.json',receipt);
 console.log('VISUAL_REVIEW',resolve(out,'01-person-a-cosmic-at-rest.png'),a.working.native_ref,'native field lease not yet opened');
 phase='actual native cosmic rest visual review';await new Promise(resolve=>setTimeout(resolve,config.pause_for_review_ms??45000));

 if(config.reopen_expected){const expected=config.reopen_expected,received=savedProcessArrival??a,receivedScene=received.document.scenes[received.state.sceneIndex];check(received.working.native_ref===expected.expression_ref&&received.record.world.event_ref===expected.event_ref&&received.record.person_ref===expected.person_ref&&receivedScene?.id===expected.scene_ref&&received.state.selected.includes(expected.entity_ref),'The restarted native file recovers its exact saved person, occasion, scene and selected subject');receipt.reopen_expected=expected;}
 if(config.stage==='entry'){
  if(config.reopen_acknowledgement_file){
   const acknowledged=JSON.parse(readFileSync(resolve(config.reopen_acknowledgement_file),'utf8'));
   const retained=acknowledged.document.scenes.find(scene=>scene.presentation?.scene?.epiWorld)?.presentation.scene.epiWorld;
   const priorFull=qualifiedJson(acknowledged.prior_full_receipt_ref,'Prior complete production proof');
   assert.equal(priorFull.scene_axes?.passed,true,'The mandatory prior full independent-axis/private-form gate cannot be omitted');
   receipt.scene_axes_restart=await runSceneAxisRestartGate({frame,snapshot,retained,prior:priorFull.scene_axes,nativeComposes,nativeFrames,nativeInspections,exposeNativePanel,artifact,check});
   if(retained?.current_material_policy){
    assert.deepEqual(a.record.current_material_policy,retained.current_material_policy,'Fresh owner reads the exact prior acknowledged D30 policy');
    await action('step');const dampingArrival=await snapshot('fresh-process-current-material-reception',true);
    assert.deepEqual(dampingArrival.native.instrument.influence.material,retained.current_material_policy.material,'The ordinary fresh Scene owner consumes the durable native policy');
    assert.equal(dampingArrival.native.instrument.influence.material_standing,retained.current_material_policy.standing);
    await requireCurrentRuntime(dampingArrival,'fresh-process-material');
    receipt.scene_damping_restart={passed:true,policy:retained.current_material_policy,prior_document_revision:acknowledged.document.revision,current_lease:dampingArrival.native.lease};
    check(true,'A separate native process and fresh ordinary browser entry consume the exact previously saved D30 material policy');
   }
  }
  receipt.passed=true;throw Object.assign(new Error('entry-only complete'),{intentionalStop:true});
 }

 phase='complete register source disclosure through actual body selection';
 for(const [role,count] of Object.entries({degree:360,governor:24,decan:36,codon:64,skin:72,aperture:18})){
  const entityRef=`${a.working.native_ref}:entity:world-register-${role}`,subject=(await nativeDocument(a.working.native_ref)).entities[entityRef].subject;
  await clickActualBody(entityRef);await frame.locator('[data-epi="source"]').click();await frame.locator('.epi-source-dialog[open] .epi-register-members').waitFor();
  assert.equal(await frame.locator('.epi-register-members [data-epi-member]').count(),count);
  await frame.locator('.epi-register-members [data-epi-member="0"]').click();
  await frame.waitForFunction(title=>document.querySelector('.epi-register-reading h3')?.textContent===title,a.record.register_members[role][0].title);
  const member=a.record.register_members[role][0];let text=await frame.locator('.epi-source-dialog').innerText();assert.ok(text.includes(member.reading.ref));
  if(role==='aperture')for(const [index,row] of a.record.register_members.aperture.entries())if(row.ground){await frame.locator(`[data-epi-member="${index}"]`).click();await frame.waitForFunction(title=>document.querySelector('.epi-register-reading h3')?.textContent===title,row.title);text=await frame.locator('.epi-source-dialog').innerText();assert.ok(text.includes(row.reading.ref));}
  artifact('actual-'+role+'-register-source-disclosure.json',{text,expected_members:count,first_member:member,selected_entity_ref:entityRef});
  await frame.locator('[data-epi-source="return"]').click();await frame.locator('.epi-source-dialog').waitFor({state:'hidden'});
  assert.deepEqual((await nativeDocument(a.working.native_ref)).entities[entityRef].subject,subject,'A disclosed member must never replace the containing ring subject');
  check(true,`The actual ${role} ring exposes all${count} native members, qualified source routes and unchanged containing subject`);
 }
 phase='keyboard body selection and unvoiced sky source';
 const uranusRef=`${a.working.native_ref}:entity:world-planet-uranus`;
 await frame.locator('[data-epi-body]').selectOption(uranusRef);
 await frame.waitForFunction(ref=>window.__FIELD_STUDIES__.getState().selected.includes(ref),uranusRef);
 await frame.locator('[data-epi="source"]').click();await frame.locator('.epi-source-dialog[open]').waitFor();
 const uranusText=await frame.locator('.epi-source-dialog').innerText();assert.ok(uranusText.includes(a.record.world.snapshot_ref)&&uranusText.includes('no dedicated planetary Bimba coordinate')&&uranusText.includes('No voice is allocated'));
 artifact('actual-keyboard-uranus-native-sky-source.json',{selected_entity_ref:uranusRef,text:uranusText,source_body:a.record.world.scene.bodies.find(body=>body.body==='Uranus')});
 await frame.locator('[data-epi-source="return"]').click();await frame.locator('.epi-source-dialog').waitFor({state:'hidden'});
 check(true,'Keyboard selection opens the actual unvoiced Uranus sky occurrence and returns without inventing a Bimba coordinate');

 phase='personal/source/return encounter';
 await sceneNavigate(personal.scene_ref);const pa=await snapshot('02-person-a-personal-at-rest',true);requirePartitions(pa,personal.entity_refs,'Personal rest');
 check(a.record.receiving.personal.centre_entity_refs.length===7&&a.record.receiving.personal.centre_entity_refs.every((ref,i)=>{const subject=aDoc.entities[ref]?.subject;return subject?.subject_ref===`ql:m-coordinate:bimba:M2-5-0/1-${i+1}`&&subject.sources.some(s=>s.ref===a.record.person_ref)&&subject.readings.some(s=>s.ref===a.current.context.reading_ref);})&&a.current.reading.transit.sky.snapshot_ref===a.record.world.snapshot_ref,'All seven exact canonical centres participate in the same protected personal current and cosmic occasion');
 requirePersonalDrivers(pa,'Person A');
 const locus=a.record.receiving.personal.locus_entity_ref;
 await clickActualBody(locus);
 await frame.locator('[data-epi="source"]').click();await frame.locator('.epi-source-dialog[open] h2').waitFor();
 await frame.waitForFunction(()=>document.querySelector('.epi-source-dialog')?.textContent?.includes('dcb274c1-fbbc-5914-b27d-dea979c78558'));
 check((await frame.locator('.epi-source-dialog').innerText()).includes('M4.4.4.4'),'The selected personal object opens its exact full-source UUID and coordinate through the native source owner');
 artifact('personal-source-ui.json',{text:await frame.locator('.epi-source-dialog').innerText()});await page.screenshot({path:resolve(out,'03-personal-source.png')});receipt.artifacts.push('03-personal-source.png');
 await frame.locator('[data-epi-source="return"]').click();await frame.locator('.epi-source-dialog').waitFor({state:'hidden'});
 const returned=await frame.evaluate(()=>({s:window.__FIELD_STUDIES__.getState(),r:window.__FIELD_STUDIES__.epiWorld(),w:window.__FIELD_STUDIES__.nativeWorking()}));
 check(returned.s.selected.includes(locus)&&returned.r.world.event_ref===a.record.world.event_ref&&returned.w.native_ref===a.working.native_ref,'Source Return preserves the selected Personal Pratibimba, instance and occasion');
 await sceneNavigate(branches.scene_ref);const ba=await snapshot('04-personal-branch-routes');requirePartitions(ba,branches.entity_refs,'Branches');
 await sceneNavigate(cosmic.scene_ref);

 phase='saved independent phase admission and ordinary original Return';
 const savedPhase=await snapshot('04a-saved-independent-phase-before-return',true),composeCountBeforeReturn=nativeComposes.length;
 // A retained independent inscription phase is genuine continuation. M1 advance
 // deliberately aligns it with the new M3 source position (#254 D5, no separate
 // trajectory). Prove its admission, then use ordinary Return before predicting
 // the relative tick from the immutable source-aligned opening. Never replace
 // the saved fixture, native arithmetic or the original one-tick predicates.
 await action('reset');const firstReturn=await snapshot('04b-ordinary-original-return-before-tick',true);
 const firstReturnComposes=nativeComposes.slice(composeCountBeforeReturn);
 assert.equal(firstReturnComposes.length,3,'Ordinary first Return admits the saved continuation, recomposes the immutable opening and resumes its native CAS-retained receipt');
 const admittedSaved=firstReturnComposes[0],originalRecomposition=firstReturnComposes[1],returnedOpening=firstReturnComposes[2];
 assert.deepEqual(admittedSaved.request.request.request.world.start,savedPhase.record.continuation_start,'The actual first native compose receives the complete saved continuation');
 assert.deepEqual(admittedSaved.source.world.native_readback.continuous_clock,nativeReadback(savedPhase).continuous_clock,'Both independent saved clock phases are genuinely admitted before Return');
 assert.deepEqual(originalRecomposition.request.request.request.world.start,savedPhase.record.world.native_readback.continuation_start,'The second actual native compose receives the complete immutable original continuation');
 assert.deepEqual(returnedOpening.request.request.request.world.start,firstReturn.record.continuation_start,'The final actual native compose resumes the complete CAS-retained original continuation');
 assert.deepEqual(originalRecomposition.source.world.native_readback.continuous_clock,returnedOpening.source.world.native_readback.continuous_clock,'Original recomposition and retained receiving preserve both complete original clock axes');
 assert.notEqual(originalRecomposition.lease,returnedOpening.lease,'Retaining the native original receipt closes its intermediate lease before resumed receiving');
 check(true,'First ordinary Return genuinely admits the complete saved independent clock continuation before recomposing the original opening');
 const originalBeforeTick=savedPhase.record.world.native_readback,returnedBeforeTick=nativeReadback(firstReturn);
 for(const key of ['schema','clock_semantics','event_ref','subject_ref','continuation_start','continuous_clock','m1_carrier','m1_clock','m3_clock','selected_aperture','form','form_process'])assert.deepEqual(storedJsonNumbers(returnedBeforeTick[key]),storedJsonNumbers(originalBeforeTick[key]),'First Return restores complete original '+key);
 assert.deepEqual(firstReturn.record.world,savedPhase.record.world,'First Return preserves all immutable original source material');
 assert.deepEqual(firstReturn.current,savedPhase.current,'First Return preserves actual personal reception');
 assert.notEqual(returnedOpening.lease,admittedSaved.lease,'First Return closes the admitted saved lifetime and acknowledges a fresh original lifetime');
 assert.equal(firstReturn.native.lease,returnedOpening.lease);assert.equal(firstReturn.native.native.acknowledged.samples_elapsed,'0');
 await requireCurrentRuntime(firstReturn,'First ordinary original Return');
 check(true,'The first ordinary Return restores both full original clock axes, source form and continuation through actual native receiving, preserving the person, occasion and Expression');
 artifact('first-original-return-admission.json',{saved:savedPhase.record.native_readback,original:originalBeforeTick,returned:returnedBeforeTick,admitted_saved_lease:admittedSaved.lease,original_recomposition_lease:originalRecomposition.lease,returned_opening_lease:returnedOpening.lease,scope:'Complete clock/source semantics and current receiving; process-local revision/generation counters are not immutable original byte identities'});

 phase='native one-tick receiving';
 const opening=await snapshot('05-before-native-play',true);assert.ok(opening.state.fieldPaused&&opening.rendered.steps===0&&opening.rendered.simTime===0,'The ordinary quiet receiving test starts with the disclosed held entry mode before any simulated or verifier probe step');
 await action('step');
 const quietStep=await snapshot('06-after-quiet-native-tick-before-simulation',true),quietNative=nativeReadback(quietStep);
 assert.ok(quietStep.state.fieldPaused&&quietStep.rendered.steps===opening.rendered.steps&&quietStep.rendered.simTime===opening.rendered.simTime,'The quiet control consequence must be visible before any simulation, probeSteps, manual reseed or resumed motion');
 const markerRef=`${a.working.native_ref}:entity:world-clock-a-hand`,markerPartition=quietStep.rendered.partitions.find(p=>p.entityId===markerRef);assert.ok(markerPartition&&markerPartition.end>markerPartition.start);
 let markerGap=0,markerDisplacement=0;
 for(let i=markerPartition.start;i<markerPartition.end;i++)for(let axis=0;axis<3;axis++){const offset=i*4+axis;markerGap=Math.max(markerGap,Math.abs(quietStep.rendered.positions[offset]-quietStep.rendered.targets[offset]));markerDisplacement=Math.max(markerDisplacement,Math.abs(quietStep.rendered.positions[offset]-opening.rendered.positions[offset]));}
 artifact('quiet-clock-marker-receiving.json',{entity_ref:markerRef,partition:markerPartition,actual_native_readback:quietNative,before_steps:opening.rendered.steps,after_steps:quietStep.rendered.steps,before_simTime:opening.rendered.simTime,after_simTime:quietStep.rendered.simTime,max_gpu_to_current_authored_target_gap:markerGap,max_actual_gpu_displacement:markerDisplacement,before_image:'05-before-native-play.png',after_image:'06-after-quiet-native-tick-before-simulation.png',scope:'Actual quiet native control/body receiving; exact source phase/form and visual interpretation remain independently checked'});
 check(markerGap===0&&markerDisplacement>1,'The actual rendered ClockA marker receives the native tick consequence while held, before simulation or manual reseeding');
 const admittedStatic=new Set(['clock-a-hand','clock-b-hand','current-form','current-form-hinge'].map(role=>`${a.working.native_ref}:entity:world-${role}`));
 assert.deepEqual(quietStep.rendered.velocities,opening.rendered.velocities,'Every resident velocity is invariant under quiet stationary-body admission');
 assert.equal(quietStep.rendered.seeds,opening.rendered.seeds,'Quiet admission never reseeds the field');
 for(const partition of quietStep.rendered.partitions){
  assert.deepEqual(partition,opening.rendered.partitions.find(p=>p.entityId===partition.entityId),'The actual resident partition is unchanged');
  if(!admittedStatic.has(partition.entityId))assert.deepEqual(quietStep.rendered.positions.slice(partition.start*4,partition.end*4),opening.rendered.positions.slice(partition.start*4,partition.end*4),'Every unselected body, including the played torus, is invariant under the zero-step admission');
 }
 const selectedParticles=new Set(quietStep.rendered.partitions.filter(p=>admittedStatic.has(p.entityId)).flatMap(p=>Array.from({length:p.end-p.start},(_,i)=>p.start+i)));
 for(let particle=0;particle<quietStep.rendered.particleCount;particle++)if(!selectedParticles.has(particle))for(let channel=0;channel<4;channel++)assert.equal(quietStep.rendered.positions[particle*4+channel],opening.rendered.positions[particle*4+channel],'All unselected and connection particle channels remain byte-equal');
 check(true,'Quiet native receiving preserves every velocity, unselected body/connection/torus particle, seed and simulation clock');
 await frame.evaluate(()=>{window.__FIELD_STUDIES__.pause();window.__FIELD_STUDIES__.probeSteps(60,1/60);});
 const step=await snapshot('06-after-one-native-tick',true),beforeNative=nativeReadback(opening),afterNative=nativeReadback(step);
 assert.ok(beforeNative&&afterNative,'Both native source readings must be present');
 check(afterNative.m1_clock.tick12===(beforeNative.m1_clock.tick12+1)%12,'One ordinary UI step advances the actual source M1 tick');
 const unwrapped=p=>BigInt(p.turns)*720n+BigInt(p.half_degrees);
 check(unwrapped(afterNative.continuous_clock.inscription)-unwrapped(beforeNative.continuous_clock.inscription)===60n,'The same native source tick advances geometric Clock A by 30 degrees');
 // The selected static aperture is invariant. Its Fibonacci ground phase
 // follows the independent native M3 clock: 60 positions at 6 degrees, so a
 // 30-degree M1 tick advances five ground positions (deep M3 matrix §11;
 // m3_state.rs FoldState construction). Whole-object equality would wrongly
 // demand that this source-defined dynamical phase remain fixed.
 const apertureFields=['index','reciprocal_index','static_lenses','total_lenses','division_deg10','reciprocal_division_deg10','void_ring_orientation_deg10'];
 for(const field of apertureFields)assert.equal(afterNative.selected_aperture[field],beforeNative.selected_aperture[field],'The selected aperture preserves '+field);
 assert.equal(afterNative.m3_clock.degree360,(beforeNative.m3_clock.degree360+30)%360,'The native M3 clock follows the independently expected geometric increment');
 assert.equal(beforeNative.selected_aperture.fibonacci_phase60,Math.floor(beforeNative.m3_clock.degree360/6),'The opening Fibonacci ground phase has its native six-degree basis');
 assert.equal(afterNative.selected_aperture.fibonacci_phase60,Math.floor(afterNative.m3_clock.degree360/6),'The receiving Fibonacci ground phase has its native six-degree basis');
 assert.equal(afterNative.selected_aperture.fibonacci_phase60,(beforeNative.selected_aperture.fibonacci_phase60+5)%60,'One M1 tick advances five Fibonacci ground positions');
 check(afterNative.event_ref===beforeNative.event_ref&&afterNative.subject_ref===beforeNative.subject_ref&&step.record.world.snapshot_ref===opening.record.world.snapshot_ref&&JSON.stringify(step.record.world.sky)===JSON.stringify(opening.record.world.sky),'One M1 tick preserves the selected static aperture, person and full sky while its native Fibonacci ground phase advances five positions');
 check(['held','following'].includes(step.native.status)&&step.native.instrument.influence.native_readback.event_ref===a.record.world.event_ref,'The acknowledged source effect returns through the actual native process and production controller, including its quiet hold');
 await requireCurrentRuntime(step,'First real native receiving');
 check(step.current.context.reading_ref===opening.current.context.reading_ref&&JSON.stringify(step.current.reading.q_identity_transit)===JSON.stringify(opening.current.reading.q_identity_transit)&&JSON.stringify(step.current.reading.q_activity)===JSON.stringify(opening.current.reading.q_activity)&&JSON.stringify(step.current.reading.q_composed)===JSON.stringify(opening.current.reading.q_composed),'The M1 source act preserves protected natal/transit reception and unavailable lived activity at the held person and occasion');
 // The independently admitted 30-degree source increment must reach the
 // actual formation owner. 1.375 stage units and 400 px/stage unit are this
 // world's disclosed authored placement and the existing engine unit law.
 const hand=step.telemetry.config.entities.find(e=>e.id===`${a.working.native_ref}:entity:world-clock-a-hand`),angle=afterNative.continuous_clock.inscription.half_degrees/2*Math.PI/180;
 check(hand&&Math.abs(hand.x-550*Math.sin(angle))<1e-6&&Math.abs(hand.y-550*Math.cos(angle))<1e-6,'The actual receiving formation owner positions Clock A from the changed native geometric reading');
 const target=await frame.evaluate(()=>{const t=window.__FIELD_STUDIES__.nativeTargets();return t?{native:t.native,scale:t.presentation_units_per_metre,target_a:Array.from(t.target_a??[]),target_b:Array.from(t.target_b??[]),admitted_a:Array.from(t.admitted_a??[])}:null;});artifact('native-target-receiving.json',target);assert.ok(target?.native);
 const deltas=cosmic.entity_refs.map(ref=>partitionDelta(opening,step,ref));artifact('actual-gpu-partition-displacements.json',deltas);
 check(deltas.find(d=>d.entity_ref===a.record.receiving.torus.entity_ref).max_displacement>1e-5,'The actual retained torus body moves after native target consumption');
 if(beforeNative.m1_clock.tick12===0){
  check(afterNative.form.address===0&&afterNative.form.codon.ref===beforeNative.form.codon.ref,'The independent source prediction holds: default M1 tick zero to one preserves codon zero');
  await action('step');const differentiated=await snapshot('06b-after-second-native-tick');
  const secondNative=nativeReadback(differentiated),secondDoc=await nativeDocument(a.working.native_ref);artifact('second-tick-native-owner-document.json',secondDoc);
  check(secondNative.m1_clock.tick12===2&&secondNative.form.address===1&&secondNative.form.codon.ref==='#3-2-1-1-2'&&secondNative.form_process.triplet==='AAT'&&secondNative.form.hexagram.ref==='#3-1-2-1'&&secondNative.form_process.hexagram_glyph==='䷗','The independently recovered original AAT / Fu source, typed trigrams and glyph appear at the second ordinary M1 tick');
  const process=secondNative.form_process,formRef=`${a.working.native_ref}:entity:world-current-form`,body=secondDoc.scenes.find(s=>s.scene_ref===cosmic.scene_ref).presentation.scene.entities.find(e=>e.id===formRef),parameter=secondDoc.entities[formRef].parameters.glyph.value;
  const glyph=process.hexagram_glyph||process.triplet;
  check(parameter===glyph&&body.text===glyph&&body.sequence.steps.every(s=>s.text===glyph),'The changed source form reaches both the native glyph parameter and the actual retained scene text/sequence carrier');
 }
 await action('reset');const reset=await snapshot('07-return-to-native-opening');
 const originalNative=opening.record.world.native_readback,returnedNative=nativeReadback(reset);
 for(const key of ['schema','clock_semantics','event_ref','subject_ref','continuation_start','continuous_clock','m1_carrier','m1_clock','m3_clock','selected_aperture','form','form_process'])assert.deepEqual(storedJsonNumbers(returnedNative[key]),storedJsonNumbers(originalNative[key]),'Return restores complete original '+key);
 for(const key of ['inscription','lensing','grid_origins','rate_denominator','rate_numerators','rate_remainders'])assert.deepEqual(returnedNative.continuous_clock[key],originalNative.continuous_clock[key],'Return restores original continuous clock '+key);
 assert.deepEqual(reset.record.world,opening.record.world,'Return preserves every immutable original world source field');
 assert.deepEqual(reset.current,opening.current,'Return preserves exact private identity/transit/current reception');
 assert.notEqual(reset.native.lease,step.native.lease,'Return uses a fresh qualified native owner');
 assert.equal(reset.native.native.acknowledged.samples_elapsed,'0');
 check(true,'Return to opening restores the original complete M1/form/aperture and both continuous clock axes through native recomposition while preserving the person and occasion');

 phase='original reset idempotence through the actual native owner';
 await action('reset');const resetAgain=await snapshot('07a-idempotent-original-opening');
 const repeatedNative=nativeReadback(resetAgain);
 for(const key of ['schema','clock_semantics','event_ref','subject_ref','continuation_start','continuous_clock','m1_carrier','m1_clock','m3_clock','selected_aperture','form','form_process'])assert.deepEqual(storedJsonNumbers(repeatedNative[key]),storedJsonNumbers(originalNative[key]),'Repeated Return preserves complete original '+key);
 assert.notEqual(resetAgain.native.lease,reset.native.lease,'Repeated Return uses a new acknowledged native lifetime');
 assert.deepEqual(resetAgain.record.world,reset.record.world);assert.deepEqual(resetAgain.current,reset.current);
 check(true,'Repeated Return recomposes the same complete original opening with a fresh exact lease and invariant person and occasion');

 phase='held cosmic departure after actual native playback';
 const departedLease=resetAgain.native.lease;
 await sceneNavigate(personal.scene_ref);const postPlayPersonal=await snapshot('07b-post-play-personal',true);
 requirePartitions(postPlayPersonal,personal.entity_refs,'Post-play personal');requirePersonalDrivers(postPlayPersonal,'Post-play personal');
 assert.equal(postPlayPersonal.native.lease,null);assert.equal(postPlayPersonal.native.source,null);assert.equal(postPlayPersonal.native.domain,null);
 assert.deepEqual(postPlayPersonal.current,resetAgain.current);assert.deepEqual(postPlayPersonal.record.continuation_start,repeatedNative.continuation_start);
 assert.deepEqual(postPlayPersonal.native.lifetime.last_close,{schema:'oi.native-expression-closed/v1',lease:departedLease,closed:true});
 assert.equal(postPlayPersonal.native.lifetime.admission_pending,false);assert.equal(postPlayPersonal.native.lifetime.close_pending,false);assert.equal(postPlayPersonal.native.lifetime.operation_pending,0);assert.equal(postPlayPersonal.native.lifetime.close_error,null);
 assert.equal(await frame.evaluate(()=>window.__FIELD_STUDIES__.nativeTargets()),null);
 check(true,'Leaving a played held cosmic scene retains the acknowledged continuation, closes its exact lease, clears native domain and targets, and receives all nine personal bodies and drivers');
 await sceneNavigate(branches.scene_ref);const postPlayBranches=await snapshot('07c-post-play-branches',true);
 requirePartitions(postPlayBranches,branches.entity_refs,'Post-play branches');assert.equal(postPlayBranches.native.lease,null);assert.equal(postPlayBranches.native.domain,null);
 assert.deepEqual(postPlayBranches.record.continuation_start,postPlayPersonal.record.continuation_start);assert.deepEqual(postPlayBranches.current,postPlayPersonal.current);
 check(true,'The same released world continues into all seven branch bodies with its exact protected personal reading and continuation');
 await sceneNavigate(cosmic.scene_ref);await action('step');const returnedCosmic=await snapshot('07d-returned-cosmic-next-tick',true);
 requirePartitions(returnedCosmic,cosmic.entity_refs,'Returned cosmic');await requireCurrentRuntime(returnedCosmic,'Returned cosmic native receiving');
 assert.notEqual(returnedCosmic.native.lease,departedLease);assert.equal(nativeReadback(returnedCosmic).m1_clock.tick12,1);assert.equal(nativeReadback(returnedCosmic).continuous_clock.inscription.half_degrees,60);
 assert.deepEqual(returnedCosmic.current,postPlayPersonal.current);assert.deepEqual(returnedCosmic.record.world.sky,postPlayPersonal.record.world.sky);
 check(true,'Returning from personal and branches recomposes a new complete cosmic receiving lifetime and advances the retained original opening to tick one and Clock A thirty degrees');
 await action('reset');

 phase='save and production continuation';
 const nativeRecoverySave=await armActualRecoverySaveCustody(a.working.native_ref);let saved;
 try{await action('save');saved=await snapshot('08-saved-personal-world');await savedFile(saved.working,'person-a-saved');}
 finally{receipt.recovery_save=await nativeRecoverySave.close();}
 check(receipt.recovery_save.passed,'Ordinary actual Save consumes one lossless native v2 pending checkpoint, with unchanged full request/ACK/Read/FindCheckpoint, bounded exact private bytes and actual native file readback');
 await sceneNavigate(personal.scene_ref);await frame.evaluate(ref=>window.__FIELD_STUDIES__.selectEntity(ref),locus);await action('save');
 const continuation=await snapshot('09-before-browser-reopen');
 retainStage('browser production reopen: before navigation');
 await page.goto(url+'&expression='+encodeURIComponent(a.working.native_ref));
 retainStage('browser production reopen: navigation completed; awaiting host');
 await page.waitForFunction(()=>document.querySelector('#world')?.getAttribute('src')?.startsWith('/__epi_application'),null,{timeout:90000});
 retainStage('browser production reopen: host ready; awaiting frame');
 frame=await page.locator('#world').elementHandle().then(el=>el.contentFrame());
 retainStage('browser production reopen: frame acquired; awaiting application API');
 await frame.waitForFunction(()=>window.__FIELD_STUDIES__?.epiWorld(),null,{timeout:90000});
 retainStage('browser production reopen: application API ready; awaiting exact current');
 await readyCurrent(identities[0].reading.person_ref);await noAlert();
 retainStage('browser production reopen: exact current acknowledged');
 const reopened=await snapshot('10-production-owner-reopen');
 const checkpoint=await op({op:'expression_recovery',request:{operation:'find_checkpoint',scope:'expressions',expression_ref:a.working.native_ref}});
 assert.equal(checkpoint.result,'expression_recovery');assert.equal(checkpoint.data.state,'ready');
 assert.ok(checkpoint.data.record?.value?.view?.document,'The actual native recovery owner must return this saved checkpoint.');
 const checkpointDocument=checkpoint.data.record.value.view.document;
 assert.equal(checkpointDocument.expression_ref,a.working.native_ref);
 assert.equal(checkpointDocument.selection.scene_ref,personal.scene_ref);
 assert.equal(checkpointDocument.selection.entity_ref,locus);
 check(receipt.operations.some(row=>row.op==='expression_recovery'&&row.operation==='write'&&row.ok===true),
  'The ordinary hosted producer actually writes acknowledged native recovery material, separately from browser storage');
 artifact('native-recovery-selected-personal-checkpoint.json',checkpoint.data);
 check(reopened.working.native_ref===a.working.native_ref&&reopened.record.world.event_ref===a.record.world.event_ref,'A fresh production iframe recovers the exact native Expression and original occasion');
 check(reopened.state.selected.includes(locus)&&reopened.document.scenes[reopened.state.sceneIndex]?.id===personal.scene_ref,'The acknowledged native owner checkpoint reopens the selected personal scene and subject in a fresh iframe; full process restart is separate');
 receipt.continuation={file:reopened.working.file,expression_ref:reopened.working.native_ref,person_ref:reopened.record.person_ref,event_ref:reopened.record.world.event_ref,scene_ref:personal.scene_ref,entity_ref:locus};
 await action('step');await frame.evaluate(()=>window.__FIELD_STUDIES__.pause());const reopenedNative=await snapshot('10a-production-reopen-native-receiving',true);await requireCurrentRuntime(reopenedNative,'Production reopen native receiving');await action('reset');

 phase='ordinary authored save/restore/save-next';
  await sceneNavigate(cosmic.scene_ref);await openSceneWorkflow();
  const directOpening=await snapshot('10aa-before-direct-duration'),directOriginal=directOpening.document.scenes[directOpening.state.sceneIndex].duration,directEdited=directOriginal<=3599?directOriginal+1:directOriginal-1;
  assert.ok(directOpening.native.lease,'A direct scene-duration edit must begin with the real retained native field still attached');
  assert.ok(await frame.evaluate(()=>window.__FIELD_STUDIES__.nativeTargets()),'The direct-duration gate must exercise the actual retained target partition');
  await frame.locator('#timeline-panel [data-bind="duration"]').fill(String(directEdited));await frame.locator('#scene-save-name').click();
  await frame.waitForFunction(value=>{const f=window.__FIELD_STUDIES__;return f.getDocument().scenes[f.getState().sceneIndex].duration===value;},directEdited,{timeout:30000});
  await requireAuthoredNativeHealth('direct-duration');
  const directAfter=await snapshot('10ab-after-direct-duration');
  assert.equal(directAfter.working.native_ref,directOpening.working.native_ref);assert.equal(directAfter.record.world.instance_ref,directOpening.record.world.instance_ref);assert.equal(directAfter.record.person_ref,directOpening.record.person_ref);assert.equal(directAfter.record.world.event_ref,directOpening.record.world.event_ref);assert.equal(directAfter.record.world.snapshot_ref,directOpening.record.world.snapshot_ref);assert.deepEqual(directAfter.record.source_basis,directOpening.record.source_basis);
  assert.equal(directAfter.document.scenes[directAfter.state.sceneIndex].id,cosmic.scene_ref);assert.deepEqual(directAfter.native.lifetime.last_close,{schema:'oi.native-expression-closed/v1',lease:directOpening.native.lease,closed:true});
  assert.deepEqual(directAfter.record.native_readback??directAfter.record.world.native_readback,directOpening.native.instrument.influence.native_readback,'The direct duration departure must retain the exact acknowledged native clocks, form and continuation');
  await frame.locator('[data-action="restore-scene"]').click();
  await frame.waitForFunction(value=>{const f=window.__FIELD_STUDIES__;return f.getDocument().scenes[f.getState().sceneIndex].duration===value;},directOriginal,{timeout:30000});
  await requireAuthoredNativeHealth('direct-duration-restore');await action('reset');await openSceneWorkflow();
  const beforeSameKeySave=await snapshot('10ac-before-native-file-save');assert.ok(beforeSameKeySave.native.lease,'Epi Save must begin with the actual retained owner after its current readback was already saved');
  await action('save');await requireAuthoredNativeHealth('epi-file-save');
  const afterSameKeySave=await snapshot('10ad-after-native-file-save');assert.equal(afterSameKeySave.working.native_ref,beforeSameKeySave.working.native_ref);assert.equal(afterSameKeySave.record.world.event_ref,beforeSameKeySave.record.world.event_ref);assert.deepEqual(afterSameKeySave.record.native_readback??afterSameKeySave.record.world.native_readback,beforeSameKeySave.native.instrument.influence.native_readback);await savedFile(afterSameKeySave.working,'same-current-authored-file-save');
  await action('reset');await openSceneWorkflow();
  const beforeSceneSave=await snapshot('10ae-before-authored-scene-save');assert.ok(beforeSceneSave.native.lease,'Save scene must also begin with an actual retained native owner');
  await frame.locator('[data-action="save-scene"]').click();await requireAuthoredNativeHealth('save-scene');await action('save');
 const beforeRestore=await snapshot('10b-before-authored-restore'),originalDuration=beforeRestore.document.scenes[beforeRestore.state.sceneIndex].duration;
  const editedDuration=originalDuration<=3599?originalDuration+1:originalDuration-1;
  await openSceneWorkflow();await frame.locator('#timeline-panel [data-bind="duration"]').fill(String(editedDuration));await frame.locator('#scene-save-name').click();
  await frame.waitForFunction(value=>{const f=window.__FIELD_STUDIES__;return f.getDocument().scenes[f.getState().sceneIndex].duration===value;},editedDuration,{timeout:30000});
  check(await frame.evaluate(()=>{const f=window.__FIELD_STUDIES__,j=f.getDocument();return j.scenes[f.getState().sceneIndex].duration;})===editedDuration,'A real scene-control edit changes the authored duration before Restore');
  await frame.locator('[data-action="restore-scene"]').click();await requireAuthoredNativeHealth('restore-scene');await action('save');
 const restored=await snapshot('10c-after-authored-restore'),restoreDoc=await nativeDocument(a.working.native_ref);artifact('authored-restore-native-owner-document.json',restoreDoc);
 check(restored.record.world.event_ref===a.record.world.event_ref&&restored.document.scenes[restored.state.sceneIndex].duration===originalDuration,'Actual authored Restore recovers the saved scene and preserves its exact personal occasion');requireOneWorld(restoreDoc,a.working.native_ref,'Authored Restore');
  await action('reset');const beforeToolbarSave=await snapshot('10ca-before-toolbar-native-save');assert.ok(beforeToolbarSave.native.lease,'The normal native Save control must begin with the actual retained native owner');
  await frame.locator('#native-save').click();await requireAuthoredNativeHealth('toolbar-native-save');
  await frame.waitForFunction(()=>{const w=window.__FIELD_STUDIES__.nativeWorking();return !w.busy&&!w.pending&&!w.failed;},null,{timeout:180000});
  const toolbarSaved=await snapshot('10cb-after-toolbar-native-save');assert.equal(toolbarSaved.working.native_ref,beforeToolbarSave.working.native_ref);assert.equal(toolbarSaved.record.world.event_ref,beforeToolbarSave.record.world.event_ref);assert.deepEqual(toolbarSaved.record.native_readback??toolbarSaved.record.world.native_readback,beforeToolbarSave.native.instrument.influence.native_readback);await savedFile(toolbarSaved.working,'same-current-toolbar-native-save');
  await action('reset');await openSceneWorkflow();await frame.locator('#timeline-panel .scene-save-row [data-action="save-next"]').click();await requireAuthoredNativeHealth('save-next');await action('save');
 const next=await snapshot('10d-authored-next-native-owner'),nextDoc=await nativeDocument(a.working.native_ref);artifact('authored-next-native-owner-document.json',nextDoc);
 const nextScene=nextDoc.scenes.find(s=>s.scene_ref===next.document.scenes[next.state.sceneIndex]?.id);
 assert.ok(nextScene&&nextScene.scene_ref!==cosmic.scene_ref,'The next authored presentation has its own native Scene identity');
 check(nextDoc.scenes.length===restoreDoc.scenes.length+1&&JSON.stringify(nextScene.entity_refs)===JSON.stringify(cosmic.entity_refs)&&!nextScene.presentation.scene.epiWorld,'Save & next creates a purposeful new presentation of the same native cosmic members');requireOneWorld(nextDoc,a.working.native_ref,'Save & next');
 await sceneNavigate(personal.scene_ref);await frame.evaluate(ref=>window.__FIELD_STUDIES__.selectEntity(ref),locus);await action('save');
 const afterNext=await snapshot('10e-personal-return-after-next');await savedFile(afterNext.working,'person-a-after-save-next');receipt.continuation={...receipt.continuation,file:afterNext.working.file,scene_count:nextDoc.scenes.length};

 if(config.consumer_replays!==false){phase='same-file actual GPU consumer discrimination';receipt.consumer_replays=await actualGpuConsumerReplays(url,afterNext,cosmic.scene_ref);json('receipt.json',receipt);}

 phase='second controlled person at same occasion';
 await frame.evaluate(identity=>window.__FIELD_STUDIES__.enterEpiWorld(identity),identities[1]);await noAlert();await readyCurrent(identities[1].reading.person_ref);
 const b=await snapshot('11-person-b-cosmic-at-same-occasion');
 check(b.record.world.snapshot_ref===a.record.world.snapshot_ref&&b.record.world.event_ref===a.record.world.event_ref,'The second actual person encounters the exact same admitted cosmic occasion');
 check(b.record.person_ref!==a.record.person_ref&&b.record.world.instance_ref!==a.record.world.instance_ref&&b.current.reading.identity.person_ref!==a.current.reading.identity.person_ref&&b.current.context.reading_ref!==a.current.context.reading_ref,'Shared locus and occasion preserve distinct native person identities, current readings and Expression instances');
 const bDoc=await nativeDocument(b.working.native_ref);artifact('person-b-native-owner-document.json',bDoc);await savedFile(b.working,'person-b-opening');
 await sceneNavigate(`${b.working.native_ref}:scene:personal`);const pb=await snapshot('12-person-b-personal-at-same-occasion',true);
 requirePersonalDrivers(pb,'Person B');
 check(JSON.stringify(pa.current.reading.q_identity_transit)!==JSON.stringify(pb.current.reading.q_identity_transit)&&JSON.stringify(pa.rendered.localizedResonance.map(f=>({frequencyHz:f.frequencyHz,re:f.re,im:f.im})))!==JSON.stringify(pb.rendered.localizedResonance.map(f=>({frequencyHz:f.frequencyHz,re:f.re,im:f.im}))),'At the same cosmic occasion, actual person-dependent native orientation reaches distinct seven-centre resonance inputs');
 for(const current of [pa.current,pb.current])if(current.reading.activity_status==='unavailable')check(current.reading.q_activity===null&&current.reading.q_composed===null,'Unavailable lived activity remains absent rather than a fabricated three-factor personal composition');
 artifact('two-person-reception.json',{a:{person_ref:a.record.person_ref,current:pa.current,resonance:pa.rendered.localizedResonance},b:{person_ref:b.record.person_ref,current:pb.current,resonance:pb.rendered.localizedResonance},same_event:a.record.world.event_ref});
 phase='actual personal positive/live-zero receiving and history';
 receipt.personal_modal=await runPersonalModalConsumerProof({browser,url,worldA:afterNext,worldB:b,output:resolve(out,'personal-modal'),readOwner:nativeDocument,qualification:config.binaries,observePage,onPhase:label=>{phase=label;}});
 json('receipt.json',receipt);
 phase='actual saved-person release and branch return';
 receipt.personal_release=await runSavedPersonalReleaseGate({page,frame,snapshot,sceneNavigate,world:pb,onPhase:label=>{phase=label;}});
 artifact('actual-saved-person-release-gate.json',receipt.personal_release);
 phase='actual cold personal admission versus pending draft';
 receipt.personal_cold_draft=await runColdPersonalDraftGate({browser,url,world:b,output:resolve(out,'personal-cold-draft'),qualification:config.binaries,observePage,onPhase:label=>{phase=label;}});
 json('receipt.json',receipt);
 phase='D30 ordinary Scene material damping and saved continuation';
 receipt.scene_damping=await runSceneDampingGate({frame,worldA:afterNext,snapshot,action,sceneNavigate,exposeNativePanel,nativeFrames,nativeInspections,nativeDocument,savedFile,artifact,check});
 receipt.continuation={...receipt.continuation,file:receipt.scene_damping.saved_acknowledgement.working.file,scene_count:receipt.scene_damping.saved_acknowledgement.document.scenes.length};
 phase='M3 ordinary independent axes, exact private hinge, native current file continuation';
 receipt.scene_axes=await runSceneAxisGate({frame,worldA:receipt.scene_damping,worldB:b,op,snapshot,action,sceneNavigate,exposeNativePanel,nativeFrames,nativeInspections,nativeM3,nativeDocument,savedFile,artifact,check,owners:projectionOwners});
 receipt.continuation={...receipt.continuation,file:receipt.scene_axes.saved_acknowledgement.working.file,scene_count:receipt.scene_axes.saved_acknowledgement.scene_count};
 receipt.passed=true;
}catch(error){
 retainStage('failure: '+phase);
 if(!error.intentionalStop){receipt.failure={phase,message:error.stack??String(error)};console.error('FAIL',phase,error.stack??String(error));if(page)try{artifact('failure-launch-context.json',{host:await page.evaluate(()=>({url:location.href,ready:document.readyState,frame_src:document.querySelector('#world')?.getAttribute('src'),host_api:!!window.__EPI_REAL_HOST__,body:document.body.innerText})),app:frame?await frame.evaluate(()=>({url:location.href,ready:document.readyState,field_api:!!window.__FIELD_STUDIES__,kernel_api:!!window.__OI_KERNEL_EXPRESSIONS__,body:document.body.innerText.slice(0,32000)})):null});await page.screenshot({path:resolve(out,'failure-independent-screen.png')});receipt.artifacts.push('failure-independent-screen.png');}catch(e){receipt.failure.boot_context_error=String(e);}if(frame)try{await snapshot('failure-'+receipt.checks.length,true);}catch(e){receipt.failure.snapshot_error=String(e);} process.exitCode=1;}
}finally{
 clearInterval(heartbeat);
 if(nativeOwnerExpectation?.schema==='epi.native-world-source-expectation/v3')try{receipt.portable_custody_after=requalifyPortableCurrentCustody(nativeOwnerExpectation,nativeSourceQualification);}catch(error){receipt.passed=false;receipt.custody_after_failure={message:error.stack??String(error)};if(!receipt.failure)receipt.failure={phase:'Current physical custody after the original whole encounter',message:error.stack??String(error)};process.exitCode=1;}
 receipt.entry.final_on_disk_sha256=sha(readFileSync(entryPath));receipt.entry.changed_on_disk=receipt.entry.final_on_disk_sha256!==receipt.entry.sha256;json('receipt.json',receipt);await browser?.close();await server?.close();console.log('RECEIPT',resolve(out,'receipt.json'));
}
