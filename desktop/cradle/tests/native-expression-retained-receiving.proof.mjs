/** Real retained 5b2 native payload receiving checks.
 * Pure body checks use original native numbers/relations/clock. The cache test
 * uses those same immutable bodies in a controlled protocol envelope and the
 * existing ControlledAudio/renderer port ONLY to exercise the real controller
 * and unchanged adapter's cache seam. It is not a new native reading, numerical
 * model, actual GPU/PCM, AudioContext, browser or installed acceptance.
 * The receiving-backcheck helper separately qualifies the actual compiled
 * controller/domain modules, immutable record bytes and runtime custody.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {isAbsolute} from 'node:path';
import {pathToFileURL} from 'node:url';
const paths={controller:process.env.RETAINED_CONTROLLER_MODULE,domain:process.env.RETAINED_DOMAIN_MODULE,fixture:process.env.RETAINED_PROTOCOL_FIXTURE_MODULE,scene:process.env.RETAINED_SCENE_INSPECT,generic:process.env.RETAINED_GENERIC_INSPECT};
for(const [key,path] of Object.entries(paths))assert.ok(path&&isAbsolute(path),`Explicit ${key} absolute path required; no fixture/source fallback`);
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const sceneBytes=await readFile(paths.scene),genericBytes=await readFile(paths.generic);
assert.equal(sha(sceneBytes),'189ff8bd4b012c563d8736a4872582f501619ebfa08ad5a7e9f92faa3745eb7f','exact original 5b2 Scene record required');
assert.equal(sha(genericBytes),'93cc7397055c8021b28b64945a7a16807a580444deeeca770eca41fd7b76f6dd','exact original 5b2 Supplied record required');
const original=JSON.parse(sceneBytes.toString('utf8')),generic=JSON.parse(genericBytes.toString('utf8'));
const {NativeFieldController,qualifySceneInfluence,copySceneMetadata,SCENE_METADATA_BUDGET,NATIVE_SCENE_VOICES}=await import(pathToFileURL(paths.controller));
const {projectNativeSources}=await import(pathToFileURL(paths.domain));
const {ControlledAudio}=await import(pathToFileURL(paths.fixture));
for(const fn of [NativeFieldController,qualifySceneInfluence,copySceneMetadata,projectNativeSources,ControlledAudio])assert.equal(typeof fn,'function','the actual proposed exports and existing protocol helper are required');
const reading={instance_ref:original.instance_ref,event_ref:original.field.event_ref,subject_ref:original.field.subject_ref,acknowledged:{generation:original.field.generation,samples_elapsed:original.field.samples_elapsed}};
const domain=projectNativeSources(original.sources,{event_ref:reading.event_ref,subject_ref:reading.subject_ref,generation:reading.acknowledged.generation});
const immutableBody=JSON.stringify(original.influence);

test('actual complete native body qualifies without numerical/source/material/clock changes',()=>{
 const current=copySceneMetadata(original.influence,'influence');
 assert.deepEqual(qualifySceneInfluence(current,original.field,reading,domain,original.sources),original.influence);
 assert.deepEqual(current.voices.map(v=>v.planet_ref),NATIVE_SCENE_VOICES);
 assert.equal(current.voices.length,9,'Uranus remains unvoiced');
 assert.equal(original.field.targets.length,current.geometry.longitude_samples*current.geometry.latitude_samples);
 assert.deepEqual(current.native_readback.continuous_clock_native,original.field.clock);
 assert.equal(JSON.stringify(original.influence),immutableBody);
});

test('actual generic Inspect preserves provider-origin numerical basis without declaring a Scene body',()=>{
 assert.equal(generic.sources.current.m2.resonator.provider_ref,'ql.scene-torus-provider/v1');
 assert.equal(Object.hasOwn(generic,'influence'),false);assert.equal(Object.hasOwn(generic,'event'),false);
 const r={instance_ref:generic.instance_ref,event_ref:generic.field.event_ref,subject_ref:generic.field.subject_ref,acknowledged:{generation:generic.field.generation,samples_elapsed:generic.field.samples_elapsed}};
 assert.ok(projectNativeSources(generic.sources,{event_ref:r.event_ref,subject_ref:r.subject_ref,generation:r.acknowledged.generation}));
 assert.throws(()=>qualifySceneInfluence(generic.influence,generic.field,r),/acting influence unavailable/);
});

const negatives=[
 ['missing voices',body=>{delete body.voices;}],
 ['non-array voices',body=>{body.voices={};}],
 ['incomplete nine voices',body=>{body.voices.pop();}],
 ['wrong native order',body=>{[body.voices[0],body.voices[1]]=[body.voices[1],body.voices[0]];}],
 ['same-labelled wrong planet ref',body=>{body.voices[0].planet_ref='#2-5-0';}],
 ['foreign instance',body=>{body.instance_ref='controlled:foreign';}],
 ['wrong current cursor',body=>{body.samples_elapsed=String(BigInt(body.samples_elapsed)+1n);}],
 ['missing geometry',body=>{delete body.geometry;}],
 ['missing material',body=>{delete body.material;}],
 ['missing readback',body=>{delete body.native_readback;}],
 ['wrong actual clock',body=>{body.native_readback.continuous_clock_native.inscription.half_degrees++;}],
 ['wrong freshly inspected M1',body=>{body.m1_revision=String(BigInt(body.m1_revision)+1n);body.native_readback.m1_revision=body.m1_revision;}],
];
for(const [label,change] of negatives)test(`one-variable retained-native receiving negative: ${label}`,()=>{
 const body=structuredClone(original.influence);change(body);
 assert.throws(()=>qualifySceneInfluence(body,original.field,reading,domain,original.sources),/native scene reading:/);
 assert.equal(JSON.stringify(original.influence),immutableBody);
});

test('oversized or unsupported metadata refuses BEFORE clone; it is not an accepted empty body',()=>{
 const oversized=structuredClone(original.influence);oversized.native_readback.form_process.source_error='x'.repeat(SCENE_METADATA_BUDGET.escaped_utf8_bytes);
 const unsupported={...original.influence,unqualified_owner_blob:'extra'};
 let copies=0;const saved=globalThis.structuredClone;
 globalThis.structuredClone=value=>{copies++;return saved(value);};
 try{
  assert.throws(()=>copySceneMetadata(oversized,'influence'),/receiving byte budget/);
  assert.throws(()=>copySceneMetadata(unsupported,'influence'),/unsupported root field/);
  assert.equal(copies,0,'no oversized/unsupported metadata allocation through clone');
 }finally{globalThis.structuredClone=saved;}
});

test('actual-body arrays refuse extra/accessor members and custom prototypes before clone',()=>{
 const extra=structuredClone(original.influence),accessor=structuredClone(original.influence),custom=structuredClone(original.influence);
 extra.voices.extra='x'.repeat(SCENE_METADATA_BUDGET.escaped_utf8_bytes);
 let reads=0;Object.defineProperty(accessor.voices,'extra',{enumerable:true,get(){reads++;throw new Error('unbounded getter must never be called');}});
 Object.setPrototypeOf(custom.voices,Object.create(Array.prototype));
 let copies=0;const saved=globalThis.structuredClone;globalThis.structuredClone=value=>{copies++;return saved(value);};
 try{
  assert.throws(()=>copySceneMetadata(extra,'influence'),/non-index array member/);
  assert.throws(()=>copySceneMetadata(accessor,'influence'),/non-index array member/);
  assert.throws(()=>copySceneMetadata(custom,'influence'),/custom array prototype/);
  assert.equal(copies,0,'unchecked array properties never enter clone');assert.equal(reads,0,'an accessor is refused without invocation');
 }finally{globalThis.structuredClone=saved;}
});

test('nested metadata amplification refuses at the explicit operational depth budget',()=>{
 const deep=structuredClone(original.influence);let value=null;
 for(let i=0;i<SCENE_METADATA_BUDGET.depth+1;i++)value=[value];
 deep.native_readback.form_process.receiving_negative=value;
 assert.throws(()=>copySceneMetadata(deep,'influence'),/receiving depth\/node budget/);
});

/** Protocol-only sequence wrapper. ALL field/voice/source numbers come from the
 * above hash-qualified real record; only request IDs/ready/lease wrappers are
 * controlled to probe the exact current-request receiving law. No `advance`,
 * determinant or fake native effects are implemented. Admission is held.
 */
class RetainedRecordPort{
 sequence=0n;available=true;calls=[];omitCurrentInspect=false;oversizeCurrentInfluence=false;closes=0;
 async request(request){
  this.calls.push(structuredClone(request));
  if(request.operation==='close'){this.closes++;return{schema:'oi.native-expression-closed/v1',lease:request.lease,closed:true};}
  if(request.operation==='compose')return{schema:'oi.native-expression-open/v1',lease:'controlled:retained-body-law',source:{schema:'oi.native-expression-composed-source/v1',sky:null},presentation:{units_per_metre:request.request.units_per_metre,slots_a:[0,1,2,3],slots_b:[0,1,2,3]},receipt:{schema:original.schema,status:'ready',available:true,instance_ref:original.instance_ref,last_request_id:'0',request_id:null,field:structuredClone(original.field)}};
  assert.equal(request.operation,'exchange');const packet=request.request,operation=packet.command.operation;
  assert.equal(packet.request_id,String(++this.sequence));assert.equal(packet.expected_generation,original.field.generation);assert.equal(packet.expected_samples_elapsed,original.field.samples_elapsed);
  assert.ok(['read','inspect','influence'].includes(operation),'held receiving-law record replay cannot synthesize native operation effects');
  const reply={schema:original.schema,status:'ok',available:true,instance_ref:original.instance_ref,request_id:packet.request_id,last_request_id:packet.request_id,field:structuredClone(original.field)};
  if(operation==='inspect')Object.assign(reply,{sources:structuredClone(original.sources),event:structuredClone(original.event)});
  if(operation==='influence'||(operation==='inspect'&&!this.omitCurrentInspect)){
   reply.influence=structuredClone(original.influence);
   if(this.oversizeCurrentInfluence)reply.influence.native_readback.form_process.source_error='x'.repeat(SCENE_METADATA_BUDGET.escaped_utf8_bytes);
  }
  return reply;
 }
 dispose(){this.available=false;}
}
function protocolRenderer(){
 const texture=()=>({image:{data:new Float32Array(16),width:2,height:2}});
 const port={texWidth:2,texHeight:2,particleCount:4,targetA:texture(),targetB:texture(),setTargetTextures(){}};
 return{retainedTopology(){return{tex_width:2,tex_height:2,particle_count:4,slot_count:4};},retainedTargetPort(){return port;},setNativeDomain(){},releaseRetainedField(){},onRetainedRecoveryRequired(){return()=>{};},checkpointRetainedField(){throw new Error('not a GPU acceptance renderer');}};
}
async function heldRecord(){
 const port=new RetainedRecordPort(),controller=new NativeFieldController(port,protocolRenderer(),()=>new ControlledAudio());
 const admitted=controller.compose({sky:'none'});controller.hold('retained body protocol receiving study; no pump');await admitted;
 assert.equal(controller.status,'held');assert.equal(controller.reading.instrument.acting.voices.length,9);
 return{port,controller};
}

test('THIS same-cursor Inspect omission refuses despite the actual unchanged adapter having a matching prior cache',async()=>{
 const {port,controller}=await heldRecord();
 try{
  const cached=controller.session.lastInfluence,cursor={...controller.reading.native.acknowledged};assert.deepEqual(cached,original.influence);
  port.omitCurrentInspect=true;
  await assert.rejects(controller.inspectSources(),/THIS scene-owner Inspect omitted/);
  assert.deepEqual(controller.session.lastInfluence,cached,'the old cache trap is genuinely present in the unchanged adapter');
  assert.deepEqual(controller.reading.native.acknowledged,cursor,'the read did not advance/reset the native cursor');
  assert.equal(controller.reading.native.available,true,'receipt body refusal does not invent a native transport failure');
  assert.equal(controller.reading.instrument.influence,null);assert.equal(controller.reading.instrument.acting,null);assert.equal(controller.reading.domain,null);assert.equal(controller.currentEvent,null);
  assert.equal(controller.reading.instrument.influence_stale,true);assert.equal(controller.reading.instrument.sources_stale,true);
  await assert.rejects(controller.m1Advance(),/complete current Scene influence/);assert.throws(()=>controller.play(1),/complete current Scene influence/);
  port.omitCurrentInspect=false;await controller.inspectSources();assert.deepEqual(controller.reading.instrument.influence,original.influence);assert.equal(controller.reading.instrument.sources_stale,false);
 }finally{await controller.dispose();assert.equal(port.closes,1);}
});

test('metadata refusal preserves the actual adapter ACK/field, withholds oversized cache input and never admits old body',async()=>{
 const {port,controller}=await heldRecord();
 try{
  const cached=controller.session.lastInfluence,cursor={...controller.reading.native.acknowledged};port.oversizeCurrentInfluence=true;
  await assert.rejects(controller.influence(),/metadata refused.*receiving byte budget/);
  assert.deepEqual(cached,original.influence,'a real previously admitted body existed');
  assert.equal(controller.session.lastInfluence,undefined,'unchanged adapter direct influence() overwrites its cache with the withheld reply member; no old/current body is fabricated');assert.deepEqual(controller.reading.native.acknowledged,cursor);assert.equal(controller.reading.native.available,true);
  assert.equal(controller.reading.instrument.influence,null);assert.equal(controller.reading.domain,null);assert.equal(controller.reading.instrument.influence_stale,true);
  assert.match(controller.reading.instrument.reading_error,/receiving byte budget/);
 }finally{await controller.dispose();assert.equal(port.closes,1);}
});

test('original actual artifact bytes remain unchanged after all receiving checks',async()=>{
 assert.equal(sha(await readFile(paths.scene)),sha(sceneBytes));assert.equal(sha(await readFile(paths.generic)),sha(genericBytes));
});
