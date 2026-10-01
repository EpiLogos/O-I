/** Real ordinary Epi entry: the production application/index HTML, actual
 * desktop host relay, native kernel, QL companions and resident GPU receiver.
 * Run serially against an explicitly supplied bridge. No transport fallback,
 * invented domain data, component mount or replacement material producer.
 * This is candidate browser/native evidence, not an installed Mac claim. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {createServer} from 'vite';
import react from '@vitejs/plugin-react';
import {build} from 'esbuild';
import {chromium} from 'playwright';
import {runPersonalModalConsumerProof,runSavedPersonalReleaseGate,runColdPersonalDraftGate} from './epi-personal-native-proof.mjs';

assert.ok(process.argv[2],'Supply a JSON configuration with bridge, output and two identity_files');
const config=JSON.parse(readFileSync(resolve(process.argv[2]),'utf8'));
if(config.reopen_file!==undefined)assert.equal(typeof config.reopen_file,'string','reopen_file must be the actual Central-relative path accepted by the production app file-opening API');
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const app=resolve(root,'expressions-app/field-studies-journeys');
// Import the production authored-stage conversion owner. QL torus units per
// metre qualify a different mapping and must never project resident bodies.
const scaleSource=resolve(app,'src/nativeParameters.ts'),limitsSource=resolve(root,'expressions-app/src/engine/fieldModel.ts');
const scaleModule=await build({stdin:{contents:`export {WORLD_SCALE} from ${JSON.stringify(scaleSource)};export {MAX_FORMATIONS,MAX_PINS} from ${JSON.stringify(limitsSource)};`,resolveDir:root,loader:'ts'},bundle:true,write:false,format:'esm',platform:'node',logLevel:'silent'});
const {WORLD_SCALE,MAX_FORMATIONS,MAX_PINS}=await import('data:text/javascript,'+encodeURIComponent(scaleModule.outputFiles[0].text));
assert.ok(Number.isFinite(WORLD_SCALE)&&WORLD_SCALE>0,'The actual production stage conversion owner is required');
assert.ok(Number.isSafeInteger(MAX_FORMATIONS)&&MAX_FORMATIONS>0&&Number.isSafeInteger(MAX_PINS)&&MAX_PINS>0,'Use actual renderer limits');
const out=resolve(config.output);mkdirSync(out,{recursive:true});
const entryPath=resolve(config.app_entry??resolve(app,'public/index.html'));
const entry=readFileSync(entryPath,'utf8');
const sha=value=>createHash('sha256').update(value).digest('hex');
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
 personal_verifier:{path:resolve(root,'tests/epi-personal-native-proof.mjs'),sha256:sha(readFileSync(resolve(root,'tests/epi-personal-native-proof.mjs')))},
 verifier_projection_units:{owner:scaleSource,sha256:sha(readFileSync(scaleSource)),world_scale:WORLD_SCALE,meaning:'Resident GPU coordinates divided by the actual authored-stage WORLD_SCALE before production projectNative; QL torus presentation units remain distinct'},
 independent_source_expectations:(config.independent_expectation_files??[]).map(path=>({path:resolve(path),sha256:sha(readFileSync(resolve(path)))})),
 source:Object.fromEntries(['src/expressions/hostedApp.ts','src/expressions/nativeChannel.ts','src/expressions/naraChannel.ts','expressions-app/field-studies-journeys/src/app.ts','expressions-app/field-studies-journeys/src/epiWorldProduction.ts','expressions-app/field-studies-journeys/src/sceneWorkflow.ts','expressions-app/field-studies-journeys/src/sceneCorrespondence.ts','expressions-app/field-studies-journeys/src/native-field/channel.ts','expressions-app/field-studies-journeys/src/epiWorldMaterial.ts','expressions-app/field-studies-journeys/src/nativeWorkspace.ts','expressions-app/field-studies-journeys/src/naraEvidenceField.ts','expressions-app/field-studies-journeys/src/naraInstrument.tsx','expressions-app/field-studies-journeys/src/kernelDocumentBridge.ts','expressions-app/src/engine/fieldModel.ts','expressions-app/src/engine/PointCloudField.ts','expressions-app/src/engine/LocalizedResonanceBank.ts','expressions-app/src/engine/localizedResonanceProjection.ts'].map(p=>[p,sha(readFileSync(resolve(root,p)))]))};
let server,browser,page,frame,phase='setup',heartbeat;const nativeComposes=[],nativePrepared=[],nativeFrames=[];
const check=(value,label)=>{assert.ok(value,label);receipt.checks.push(label);console.log('PASS',label);json('receipt.json',receipt);};
const artifact=(name,value)=>{json(name,value);receipt.artifacts.push(name);};
const summarizeRequest=q=>({op:q?.op,operation:q?.request?.operation,expression_ref:q?.request?.expression_ref,coordinate_ref:q?.request?.coordinate_ref??q?.request?.request?.coordinate_ref});
async function op(request){
 const response=await fetch(config.bridge+'/op',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(request)});
 const raw=await response.text(),body=JSON.parse(raw);
 const rows=receipt.direct_operations??=[];const evidence=`direct-native-operation-${rows.length+1}.json`,rawEvidence=`direct-native-operation-${rows.length+1}.raw.json`;
 writeFileSync(resolve(out,rawEvidence),raw);receipt.artifacts.push(rawEvidence);
 artifact(evidence,{request,response:body});rows.push({...summarizeRequest(request),evidence,raw_response:{artifact:rawEvidence,bytes:Buffer.byteLength(raw),sha256:sha(raw)}});json('receipt.json',receipt);
 if(body.ok!==true)throw Error(JSON.stringify(body));return body.outcome;
}
async function nativeDocument(ref){const outcome=await op({op:'expression',request:{operation:'inspect',expression_ref:ref}});assert.ok(outcome.data?.document,'Actual Expression owner inspect must return a document');return outcome.data.document;}
async function clickActualBody(entityRef){
 const choice=await frame.evaluate(({ref,scale})=>{
  const f=window.__FIELD_STUDIES__,state=f.inspect(true),record=f.epiWorld(),partition=state.partitions.find(p=>p.entityId===ref);
  if(!partition||partition.end<=partition.start)throw Error('The required body has no actual resident particle partition.');
  const points=[];
  for(let i=0;i<state.particleCount;i++){const offset=i*4,p=f.nativeProject({x:state.positions[offset]/scale,y:state.positions[offset+1]/scale,z:state.positions[offset+2]/scale});points.push(p);}
  let best=null;
  // Select a visible isolated surface point of the actual receiving body, not
  // its shared origin or a synthetic marker. The normal pointer path decides
  // the subject; this driver never calls selectEntity to force the result.
  const stride=Math.max(1,Math.floor((partition.end-partition.start)/64));
  for(let i=partition.start;i<partition.end;i+=stride){const p=points[i];if(!p||p.x<35||p.x>innerWidth-35||p.y<145||p.y>innerHeight-65)continue;
   let clearance=Infinity;for(let j=0;j<points.length;j++){if(j>=partition.start&&j<partition.end)continue;const q=points[j];if(q)clearance=Math.min(clearance,Math.hypot(p.x-q.x,p.y-q.y));}
   if(!best||clearance>best.clearance)best={x:p.x,y:p.y,clearance,particle_index:i,entity_ref:ref,partition};
  }
  if(!best||best.clearance<1)throw Error('No discriminating visible surface point for '+ref);return best;
 },{ref:entityRef,scale:WORLD_SCALE});
 const bounds=await frame.locator('#stage').boundingBox();assert.ok(bounds);
 await page.mouse.click(bounds.x+choice.x,bounds.y+choice.y);
 await frame.waitForFunction(ref=>window.__FIELD_STUDIES__.getState().selected.includes(ref),entityRef,{timeout:10000});
 artifact('actual-body-hit-'+entityRef.split(':').at(-1)+'.json',choice);
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
function requirePartitions(reading,entities,label){
 const parts=reading.rendered?.partitions??[];
 for(const entity of entities){const part=parts.find(p=>p.entityId===entity);assert.ok(part&&part.end>part.start,`${label}: actual renderer partition for ${entity}`);}
 check(parts.length===entities.length,`${label}: every required native occurrence has a nonempty resident render partition (${entities.length})`);
}
function requireInitialRestTargets(reading,entities,label){
 const resident=reading.rendered,positions=resident?.positions,targets=resident?.targets;
 assert.ok(reading.state.fieldPaused&&reading.state.simTime===0&&resident?.simTime===0&&resident.steps===0,
  label+': compare only the actual unplayed first rest');
 assert.ok(Array.isArray(positions)&&Array.isArray(targets)&&positions.length===resident.particleCount*4&&targets.length===positions.length,
  label+': paired real GPU positions and actual owner target readbacks are required');
 const statuses=reading.telemetry.sourceStatus,maskRoles=['degree','governor','decan','codon','skin','aperture'];
 const maskReadings=maskRoles.map(role=>{const entity=reading.working.native_ref+':entity:world-register-'+role;
  const rows=Object.entries(statuses).filter(([key])=>JSON.parse(key)[0]===entity);
  assert.equal(rows.length,1,label+': one actual decoded mask source for '+role);
  assert.ok(rows[0][1].includes('source active'),label+': the actual '+role+' source decoded successfully');
  return{role,entity_ref:entity,status:rows[0][1]};});
 const deltas=new Float64Array(resident.particleCount);let max=0,mismatches=0;
 for(let i=0;i<positions.length;i++)assert.ok(Number.isFinite(positions[i])&&Number.isFinite(targets[i]),label+': finite actual paired readback at '+i);
 for(let particle=0;particle<resident.particleCount;particle++){let squared=0;for(let axis=0;axis<3;axis++){const offset=particle*4+axis;squared+=(positions[offset]-targets[offset])**2;}
  const gap=Math.sqrt(squared);deltas[particle]=gap;max=Math.max(max,gap);if(gap!==0)mismatches++;}
 const byPartition=entities.map(entity=>{const p=resident.partitions.find(row=>row.entityId===entity);assert.ok(p&&p.end>p.start);
  let max_gap=0,mismatched=0;for(let i=p.start;i<p.end;i++){max_gap=Math.max(max_gap,deltas[i]);if(deltas[i]!==0)mismatched++;}
  return{entity_ref:entity,count:p.end-p.start,max_gap,mismatched};});
 artifact(label+'-resident-target-admission.json',{scope:'Actual first-rest receiving comparison only; source semantic expectations and visual composition remain separate',
  simTime:resident.simTime,steps:resident.steps,seeds:resident.seeds,bakes:resident.bakes,particle_count:resident.particleCount,
  positions_sha256:sha(JSON.stringify(positions)),actual_owner_targets_sha256:sha(JSON.stringify(targets)),max_gap:max,mismatches,maskReadings,byPartition});
 check(max===0&&mismatches===0&&byPartition.length===32&&byPartition.every(row=>row.mismatched===0),
  label+': all actual resident particles receive the decoded authored targets for every32 required bodies before play or manual reseeding');
}
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
 const keys=['instance_ref','subject_ref','event_ref','snapshot_ref','sky','event','basis','starting_recipe','current_form','native_readback','registers','scene','native_owner_sources','binding'];
 const sourceCopy=structuredClone(world);
 for(const key of ['slots_a','slots_b'])delete sourceCopy.binding.presentation[key];
 const nativeNegativeZeroPaths=[],storedNegativeZeroPaths=[];
 for(const key of keys)assert.deepEqual(storedJsonNumbers(sourceCopy[key],nativeNegativeZeroPaths,key),storedJsonNumbers(expected[key],storedNegativeZeroPaths,key),'Actual original source recovery preserves complete JSON numerical value of '+key);
 const buffers=reading.record.runtime_buffers.buffers.map(buffer=>{
  const values=world.binding.presentation[buffer.key];assert.ok(Array.isArray(values));
  assert.equal(values.length,buffer.values);assert.equal(sha(JSON.stringify(values)),buffer.json_sha256);
  assert.equal(values.length,request.request.request.texture[0]*request.request.request.texture[1]);
  for(let i=0;i<values.length;i++)assert.equal(values[i],i%4096,'Original complete native sample correspondence');
  return{key:buffer.key,count:values.length,sha256:sha(JSON.stringify(values))};
 });
 const after=await op({op:'expression',request:{operation:'inspect',expression_ref:reading.working.native_ref}});
 assert.equal(before.result,'expression');assert.equal(after.result,'expression');assert.ok(before.data?.document&&before.data?.file);assert.deepEqual(after.data,before.data,'Complete native inspection including document, registration and saved revision remains unchanged');
 artifact('original-runtime-recovery.json',{request,buffers,complete_semantic_locks:keys,json_signed_zero:{native_negative_zero_paths:nativeNegativeZeroPaths,stored_negative_zero_paths:storedNegativeZeroPaths,policy:'Normalize only -0 to0 at JSON storage boundary; every nonzero value and every field remains exact; raw native HTTP retained'},document_unchanged:true,file_unchanged:true,worker_lease_created:false,scope:'Immutable original source recovery; current topology and GPU reception are separately tested'});
 check(true,'Actual quiet native recovery recreates both original qualified buffers and every semantic basis without changing the document, file or continuation');
}
function captureNativeFrames(value,lease,request){
 if(!value||typeof value!=='object')return;
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
 p.on('response',async response=>{if(response.request().method()!=='POST'||!response.url().endsWith('/op'))return;const request=response.request().postDataJSON();const row={phase,...summarizeRequest(request),at:new Date().toISOString(),http_status:response.status()};receipt.operations.push(row);const operationIndex=receipt.operations.length;try{let body;if(request.op==='native_expression'){const raw=await response.text(),name=`native-owner-raw-response-${operationIndex}.json`;writeFileSync(resolve(out,name),raw);receipt.artifacts.push(name);row.raw_native_response={artifact:name,bytes:Buffer.byteLength(raw),sha256:sha(raw)};body=JSON.parse(raw);}else body=await response.json();row.ok=body.ok;row.result=body.outcome?.result;if(request.op==='expression'&&['save_as','save','open_file','open'].includes(request.request?.operation)){row.native_state=body.outcome?.data?.state;artifact(`native-expression-owner-response-${operationIndex}.json`,{request,response:body});if(['save_refused','saved_readback_failed','file_revision_conflict'].includes(row.native_state))row.error=body.outcome.data.error??body.outcome.data.failure??row.native_state;}if(/^(file_|files_)/.test(request.op))artifact(`native-file-response-${operationIndex}.json`,{request,response:body});if(request.op==='expression'&&request.request?.operation==='edit')artifact(`native-expression-edit-response-${operationIndex}.json`,{request,response:body});if(request.op==='native_expression'&&request.request?.operation==='prepare_world'){artifact(`native-world-prepared-${operationIndex}.json`,{request,response:body});if(body.ok===true)nativePrepared.push({world:body.outcome.data.source.world,request,response:body});}if(request.op==='native_expression'&&request.request?.operation==='compose'&&body.ok===true){const composed=body.outcome?.data;row.runtime_buffers=Object.fromEntries(['slots_a','slots_b'].map(key=>{const values=composed?.presentation?.[key];assert.ok(Array.isArray(values),'Actual native compose must return complete receiving correspondence');return[key,{count:values.length,sha256:sha(JSON.stringify(values))}];}));nativeComposes.push({source:composed.source,lease:composed.lease,request,presentation:composed.presentation,buffers:row.runtime_buffers});captureNativeFrames(composed,composed.lease,request);artifact(`native-world-recomposed-${operationIndex}.json`,{request,response:body,runtime_buffers:row.runtime_buffers});}if(request.op==='native_expression'&&request.request?.operation==='exchange'&&body.ok===true)captureNativeFrames(body.outcome?.data,request.request.lease,request);if(body.ok!==true){row.error=body.error;artifact(`native-refusal-${operationIndex}.json`,{request,response:body});}}catch(e){row.error=String(e);}});
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
 receipt.browser={version:browser.version(),headless:true,reduced_motion:'reduce',requested_angle:'swiftshader'};
 page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});page.setDefaultTimeout(40000);page.setDefaultNavigationTimeout(60000);
 observePage(page);
 // The ordinary PointCloudHost supplies mode. The native recovery owner is
 // selected by this hosted query; omitting it would test browser IndexedDB
 // instead and could not establish a native checkpoint/restart claim.
 const url=`http://127.0.0.1:${server.httpServer.address().port}/__epi_parent?mode=expressions&host=expressions&world=epi-logos&still`+(config.existing_expression_ref?'&expression='+encodeURIComponent(config.existing_expression_ref):'');
 phase='actual production host relay launch';await page.goto(url);await page.waitForFunction(()=>document.querySelector('#world')?.getAttribute('src')?.startsWith('/__epi_application'),null,{timeout:90000});frame=await page.locator('#world').elementHandle().then(el=>el.contentFrame());phase='actual production application launch';
 await frame.waitForFunction(()=>window.__FIELD_STUDIES__?.enterEpiWorld&&window.__OI_KERNEL_EXPRESSIONS__?.kernelExpressionsAvailable(),null,{timeout:90000});
 receipt.browser.actual_gpu=await frame.evaluate(()=>{for(const c of document.querySelectorAll('canvas')){const g=c.getContext('webgl2')??c.getContext('webgl');if(!g)continue;const e=g.getExtension('WEBGL_debug_renderer_info');return{canvas:c.id,version:g.getParameter(g.VERSION),vendor:e?g.getParameter(e.UNMASKED_VENDOR_WEBGL):g.getParameter(g.VENDOR),renderer:e?g.getParameter(e.UNMASKED_RENDERER_WEBGL):g.getParameter(g.RENDERER)};}return{unavailable:true};});
 check(receipt.browser.actual_gpu.canvas==='field-canvas'&&receipt.browser.actual_gpu.version?.includes('WebGL 2'),'The ordinary production field has an actual WebGL 2 receiving context');
 check(await frame.locator('[data-epi="identity"]').isVisible(),'Ordinary production Epi entrance is visible before construction');
 check(await frame.locator('[data-epi="identity"]').evaluate(button=>{const r=button.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('[data-epi="identity"]')===button;}),'The ordinary Epi identity entrance is actually reachable above every application gate');
 check(await frame.evaluate(()=>window.__FIELD_STUDIES__.capabilities.kind)==='production','The actual production resident particle engine is loaded');
 await snapshot('00-ordinary-entry-at-rest');
 const expressionCapabilities=(await op({op:'expression',request:{operation:'capabilities'}})).data;
 artifact('actual-native-expression-capabilities.json',expressionCapabilities);
 check(expressionCapabilities.schema==='oi.expression-capabilities/v1'&&expressionCapabilities.composition_budget?.render_formations===MAX_FORMATIONS&&expressionCapabilities.composition_budget?.render_pins===MAX_PINS,'Actual native Expression capabilities match the imported production renderer formation/pin limits');
 heartbeat=setInterval(async()=>{try{console.log('PROGRESS',phase,(await frame.locator('.epi-world-entrance [role="status"]').allTextContents()).join(' '));}catch{}},10000);

 phase='controlled person A ordinary construction';
 if(config.reopen_file){const opened=await frame.evaluate(path=>window.__FIELD_STUDIES__.openNativeFile(path),config.reopen_file);assert.equal(opened,true,'The actual native file open must be acknowledged before the world replay: '+JSON.stringify(await frame.evaluate(()=>window.__FIELD_STUDIES__.nativeWorking())));}else if(config.existing_expression_ref){await readyCurrent(identities[0].reading.person_ref);await action('save');}else await frame.evaluate(identity=>window.__FIELD_STUDIES__.enterEpiWorld(identity),identities[0]);
 await noAlert();await readyCurrent(identities[0].reading.person_ref);
 await frame.waitForFunction(()=>{const values=Object.values(window.__FIELD_STUDIES__.telemetry().sourceStatus);return values.length>=6&&values.every(value=>value.includes('source active'));},null,{timeout:30000});
 const a=await snapshot('01-person-a-cosmic-at-rest',true);
 check(a.record.world.subject_ref===identities[0].reading.person_ref&&a.record.receiving.personal.canonical_locus==='ql:m-coordinate:bimba:M4.4.4.4','The actual person is bound to the Personal Pratibimba locus in one native world instance');
 check(a.record.world.event_ref===a.record.world.snapshot_ref&&a.current.context.event_ref===a.record.world.event_ref,'Cosmic event and protected PersonalCurrent encounter one admitted native sky occasion');
 check(a.record.inventory.length===2141,'Production construction consumes the complete admitted 2,141-subject Bimba inventory');
 const aDoc=await nativeDocument(a.working.native_ref);artifact('person-a-native-owner-document.json',aDoc);
 const actualCosmic=a.document.scenes[a.state.sceneIndex],nativeCosmic=aDoc.scenes.find(scene=>scene.scene_ref===a.record.receiving.scene_ref),budget=expressionCapabilities.composition_budget;
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

 check(aDoc.scenes.length===3,'The native owner stores the three connected cosmic, personal and branch scenes');
 check(aDoc.scenes.map(s=>s.entity_refs.length).join(',')==='32,9,7','The native owner retains all 32 cosmic, 9 personal and 7 branch occurrences');
 const cosmic=aDoc.scenes.find(s=>s.scene_ref===a.record.receiving.scene_ref),personal=aDoc.scenes.find(s=>s.scene_ref===`${a.working.native_ref}:scene:personal`),branches=aDoc.scenes.find(s=>s.scene_ref===`${a.working.native_ref}:scene:branches`);
 assert.ok(cosmic&&personal&&branches);const openingScene=aDoc.scenes.find(s=>s.scene_ref===a.document.scenes[a.state.sceneIndex]?.id);assert.ok(openingScene);requirePartitions(a,openingScene.entity_refs,'Native opening rest');requireInitialRestTargets(a,openingScene.entity_refs,'Native opening rest');await savedFile(a.working,'person-a-opening');
 receipt.opening_world={expression_ref:a.working.native_ref,file:a.working.file,person_ref:a.record.person_ref,nara_ref:a.record.nara_ref,identity_source:a.record.identity_source,current_context:a.current.context,event_ref:a.record.world.event_ref,scene_ref:openingScene.scene_ref};json('receipt.json',receipt);
 console.log('VISUAL_REVIEW',resolve(out,'01-person-a-cosmic-at-rest.png'),a.working.native_ref,'native field lease not yet opened');
 phase='actual native cosmic rest visual review';await new Promise(resolve=>setTimeout(resolve,config.pause_for_review_ms??45000));

 if(config.reopen_expected){const expected=config.reopen_expected;check(a.working.native_ref===expected.expression_ref&&a.record.world.event_ref===expected.event_ref&&a.record.person_ref===expected.person_ref&&openingScene.scene_ref===expected.scene_ref&&a.state.selected.includes(expected.entity_ref),'The restarted native file recovers its exact saved person, occasion, scene and selected subject');receipt.reopen_expected=expected;}
 if(config.stage==='entry'){receipt.passed=true;throw Object.assign(new Error('entry-only complete'),{intentionalStop:true});}

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

 phase='native one-tick receiving';
 const opening=await snapshot('05-before-native-play',true);assert.ok(opening.state.fieldPaused&&opening.rendered.steps===0&&opening.rendered.simTime===0,'The ordinary quiet receiving test starts with genuine reduced-motion hold before any simulated or verifier probe step');
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

 phase='save and production continuation';await action('save');const saved=await snapshot('08-saved-personal-world');await savedFile(saved.working,'person-a-saved');
 await sceneNavigate(personal.scene_ref);await frame.evaluate(ref=>window.__FIELD_STUDIES__.selectEntity(ref),locus);await action('save');
 const continuation=await snapshot('09-before-browser-reopen');
 await page.goto(url+'&expression='+encodeURIComponent(a.working.native_ref));
 await page.waitForFunction(()=>document.querySelector('#world')?.getAttribute('src')?.startsWith('/__epi_application'),null,{timeout:90000});
 frame=await page.locator('#world').elementHandle().then(el=>el.contentFrame());
 await frame.waitForFunction(()=>window.__FIELD_STUDIES__?.epiWorld(),null,{timeout:90000});await readyCurrent(identities[0].reading.person_ref);await noAlert();
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
 await frame.locator('[data-action="save-scene"]').click();await action('save');
 const beforeRestore=await snapshot('10b-before-authored-restore'),originalDuration=beforeRestore.document.scenes[beforeRestore.state.sceneIndex].duration;
 await openSceneWorkflow();await frame.locator('#timeline-panel [data-bind="duration"]').fill(String(originalDuration+1));await frame.locator('#scene-save-name').click();
 check(await frame.evaluate(()=>{const f=window.__FIELD_STUDIES__,j=f.getDocument();return j.scenes[f.getState().sceneIndex].duration;})===originalDuration+1,'A real scene-control edit changes the authored duration before Restore');
 await frame.locator('[data-action="restore-scene"]').click();await action('save');
 const restored=await snapshot('10c-after-authored-restore'),restoreDoc=await nativeDocument(a.working.native_ref);artifact('authored-restore-native-owner-document.json',restoreDoc);
 check(restored.record.world.event_ref===a.record.world.event_ref&&restored.document.scenes[restored.state.sceneIndex].duration===originalDuration,'Actual authored Restore recovers the saved scene and preserves its exact personal occasion');requireOneWorld(restoreDoc,a.working.native_ref,'Authored Restore');
 await openSceneWorkflow();await frame.locator('#timeline-panel .scene-save-row [data-action="save-next"]').click();await action('save');
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
 receipt.passed=true;
}catch(error){
 if(!error.intentionalStop){receipt.failure={phase,message:error.stack??String(error)};console.error('FAIL',phase,error.stack??String(error));if(page)try{artifact('failure-launch-context.json',{host:await page.evaluate(()=>({url:location.href,ready:document.readyState,frame_src:document.querySelector('#world')?.getAttribute('src'),host_api:!!window.__EPI_REAL_HOST__,body:document.body.innerText})),app:frame?await frame.evaluate(()=>({url:location.href,ready:document.readyState,field_api:!!window.__FIELD_STUDIES__,kernel_api:!!window.__OI_KERNEL_EXPRESSIONS__,body:document.body.innerText.slice(0,32000)})):null});await page.screenshot({path:resolve(out,'failure-independent-screen.png')});receipt.artifacts.push('failure-independent-screen.png');}catch(e){receipt.failure.boot_context_error=String(e);}if(frame)try{await snapshot('failure-'+receipt.checks.length,true);}catch(e){receipt.failure.snapshot_error=String(e);} process.exitCode=1;}
}finally{
 clearInterval(heartbeat);receipt.entry.final_on_disk_sha256=sha(readFileSync(entryPath));receipt.entry.changed_on_disk=receipt.entry.final_on_disk_sha256!==receipt.entry.sha256;json('receipt.json',receipt);await browser?.close();await server?.close();console.log('RECEIPT',resolve(out,'receipt.json'));
}
