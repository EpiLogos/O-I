/** The live K² instrument's controller law against a controlled protocol owner:
 * compose admission, determinant events through the one serial owner, the
 * explicit cadence (serial, skip-not-queue, suspended on hold, stopped on
 * release), restore-opening, and honest refusals. Not numerical evidence. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';
import * as THREE from 'three';
import {ControlledAudio,ControlledK2Owner} from './native-expression-fixture.mjs';
const src=resolve('expressions-app/field-studies-journeys/src');
const temp=await mkdtemp(join(tmpdir(),'native-instrument-tests-'));
await build({entryPoints:[join(src,'native-field/controller.ts'),join(src,'native-field/k2.ts')],bundle:true,platform:'node',format:'esm',outdir:temp,outExtension:{'.js':'.mjs'}});
const {NativeFieldController,INSTRUMENT_PRESENTATION,CADENCES}=await import(pathToFileURL(join(temp,'controller.mjs')));
const {editK2Event,lensLabel}=await import(pathToFileURL(join(temp,'k2.mjs')));
test.after(()=>rm(temp,{recursive:true,force:true}));
function renderer(){
 const texture=()=>new THREE.DataTexture(new Float32Array(16),2,2,THREE.RGBAFormat,THREE.FloatType);
 const port={texWidth:2,texHeight:2,particleCount:4,targetA:texture(),targetB:texture(),sets:0,setTargetTextures(a,b){this.actualA=a;this.actualB=b;this.sets++;}};
 return{port,native:false,retainedTopology(){return{tex_width:2,tex_height:2,particle_count:4,slot_count:4};},retainedTargetPort(){return port;},setNativeDomain(v){this.native=v;},releaseRetainedField(){},onRetainedRecoveryRequired(){return()=>{};},checkpointRetainedField(){throw new Error('no GPU');}};
}
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const ops=(owner,name)=>owner.calls.filter(c=>c.request?.command?.operation===name);
async function open(options={}){
 const owner=new ControlledK2Owner(),audio=new ControlledAudio(),r=renderer(),c=new NativeFieldController(owner,r,()=>audio);
 await c.compose({sky:'none',...options});return{owner,audio,r,c};
}
/** Let presented time follow scheduled time, as a running device would. */
function drain(c,audio){audio.currentTime=c.reading.native.audio.target_context_seconds+1;c.frame(0,false);}

test('compose asks QL for this stage\'s texture at the declared presentation scale and admits a K² owner',async()=>{
 const {owner,c,r}=await open();
 try{
  const compose=owner.calls.find(x=>x.operation==='compose');
  assert.deepEqual(compose.request,{texture:[2,2],units_per_metre:INSTRUMENT_PRESENTATION.units_per_metre,sky:'none'});
  assert.equal(INSTRUMENT_PRESENTATION.units_per_metre,120);
  assert.equal(c.status,'following');assert.equal(r.native,true);
  const instrument=c.reading.instrument;
  assert.equal(instrument.acting.m1.lens,'L5′');assert.equal(instrument.acting.voices.length,8);
  assert.equal(instrument.acting.sky.kind,'none');assert.equal(instrument.opening_event_available,true);
  assert.equal(c.openingEvent.m1.lens12,11);assert.equal(c.openingEvent.m2.resonator,null,'the provider owns the voices');
  assert.equal(ops(owner,'influence').length,1,'the influence reading is read on admission');
  assert.equal(c.reading.causal_trace.schema,'oi.native-causal-trace/v2');
  assert.equal(c.reading.causal_trace.effects.at(-1).declared_policy,true);
 }finally{await c.dispose();}
});

test('the physical form pose is reported not-actuated: nothing reads a rotation',async()=>{
 const {c}=await open();
 try{
  const pose=c.reading.physical_form_actuator;assert.equal(pose.applied,false);
  assert.match(JSON.stringify(c.reading.unavailable_consumers),/physical form pose/);
  assert.equal(c.reading.actuator_standing.physical_form.applied,false);
 }finally{await c.dispose();}
});

test('a native M1 advance goes to the same owner while following; its acknowledgement carries the influence, sources refresh at human cadence',async()=>{
 const {owner,audio,c}=await open();
 try{
  const before=c.reading.instrument.acting.voices[0].frequency_hz;
  await c.m1Advance(1);
  assert.equal(ops(owner,'m1-advance').length,1);assert.deepEqual(ops(owner,'m1-advance')[0].request.command,{operation:'m1-advance',ticks:1});
  assert.equal(c.status,'following','a live determinant event does not hold the field');
  // One exchange per tick: no second influence read while the audio waits.
  assert.equal(ops(owner,'influence').length,1);assert.notEqual(c.reading.instrument.acting.voices[0].frequency_hz,before);
  assert.equal(c.reading.instrument.sources_stale,true);
  drain(c,audio);assert.equal(c.inspectTargets().target_a[2],Math.fround(Math.fround(8/12)*120),'re-read targets present behind scheduled sound');
  await wait(1600);assert.equal(await c.refreshSources(),true);
  assert.equal(c.reading.instrument.acting.m1.tick12,8);assert.equal(c.reading.instrument.sources_stale,false);
 }finally{await c.dispose();}
});

test('a determinant edit carries the whole current event with one field changed and M1 revised',async()=>{
 const {owner,c}=await open();
 try{
  await c.edit({kind:'lens',lens12:4});
  const sent=ops(owner,'replace-event')[0].request.command;
  assert.equal(sent.event.m1.lens12,4);assert.equal(sent.event.m1.revision,'1');assert.equal(sent.strike,true,'owner strike_on_event policy');
  assert.equal(sent.event.m2.resonator,null);assert.equal(sent.event.m1.tick12,7);assert.equal(sent.event.m3.rna,false);
  await c.edit({kind:'context-frame',context_frame:3});
  assert.equal(ops(owner,'replace-event')[1].request.command.event.m1.lens12,4,'a stale event is re-read before the next edit');
  await c.edit({kind:'harmonic',source:{selection:'canonical-basis',index:0}});
  assert.equal(ops(owner,'replace-event')[2].request.command.event.m1.revision,'2','a harmonic source is not an M1 revision');
  await c.edit({kind:'transcription',rna:true});
  assert.equal(ops(owner,'replace-event')[3].request.command.event.m3.rna,true);
  assert.equal(owner.state.lens12,4);assert.equal(owner.state.context_frame,3);assert.equal(owner.state.rna,true);
  assert.equal(c.status,'following');
 }finally{await c.dispose();}
});

test('refusals are shown, not simulated: nothing is sent for an acting value; an owner refusal leaves the field following',async()=>{
 const {owner,c}=await open();
 try{
  await assert.rejects(c.edit({kind:'lens',lens12:11}),/already acting/);
  assert.equal(ops(owner,'replace-event').length,0);assert.match(c.reading.instrument.refusal.reason,/already acting/);
  owner.refuse=command=>command.operation==='m1-advance';
  await assert.rejects(c.m1Advance(1),/controlled refusal/);
  assert.equal(c.status,'following');assert.match(c.reading.instrument.refusal.reason,/controlled refusal/);
  assert.equal(c.reading.native.available,true);
  owner.refuse=null;await c.m1Advance(1);assert.equal(c.reading.instrument.refusal,null);
 }finally{await c.dispose();}
 assert.throws(()=>editK2Event({m1:{lens12:0,revision:'0'},m3:{}},{kind:'lens',lens12:12}),/twelve/);
 assert.throws(()=>editK2Event({m1:{context_frame:1,revision:'0'},m3:{}},{kind:'context-frame',context_frame:8}),/1–7/);
 assert.equal(lensLabel(0),'L0');assert.equal(lensLabel(11),'L5′');
});

test('the cadence is serial and skips rather than queues while the owner is busy',async()=>{
 const {owner,audio,c}=await open();
 let release;owner.delay=()=>new Promise(r=>{release=r;setTimeout(r,180);});
 try{
  assert.equal(CADENCES[1].ticks_per_second,12);
  c.play(12);
  for(let i=0;i<8;i++){await wait(60);drain(c,audio);}
  c.pause('test done');
  const cadence=c.reading.instrument.cadence;
  assert.equal(owner.maxInFlight,1,'never two native operations at once');
  assert.ok(cadence.applied>=1,'ticks were applied');assert.ok(cadence.skipped>0,'busy beats were skipped');
  assert.ok(cadence.applied<cadence.beats,'skipped beats are not replayed');
  const sent=ops(owner,'m1-advance').length;await wait(400);release?.();await wait(50);
  assert.ok(ops(owner,'m1-advance').length<=sent+1,'no queued burst after the cadence stops');
  assert.equal(cadence.playing,false);
 }finally{await c.dispose();}
});

test('the cadence is suspended while held and resumes with the field; release stops it',async()=>{
 const {owner,audio,c}=await open();
 try{
  c.play(12);await wait(150);drain(c,audio);
  c.hold('person held the field');const held=ops(owner,'m1-advance').length;
  await wait(250);
  assert.equal(ops(owner,'m1-advance').length,held,'no determinant event while held');
  assert.ok(c.reading.instrument.cadence.suspended>0);assert.equal(c.reading.instrument.cadence.playing,true);
  await c.resume();await wait(200);drain(c,audio);
  assert.ok(ops(owner,'m1-advance').length>held,'resumes with the field');
  await c.release();const after=owner.calls.length;await wait(250);
  assert.equal(owner.calls.length,after,'release stops the cadence');
  assert.equal(c.reading.instrument,null);
 }finally{await c.dispose();}
});

test('return to opening event restores the first admitted event under the next M1 revision',async()=>{
 const {owner,c}=await open();
 try{
  await c.edit({kind:'lens',lens12:2});await c.m1Advance(3);
  assert.equal(owner.state.lens12,2);assert.equal(owner.state.tick12,10);
  await c.restoreOpening();
  const sent=ops(owner,'replace-event').at(-1).request.command;
  assert.equal(sent.strike,true);assert.equal(sent.event.m1.lens12,11);assert.equal(sent.event.m1.tick12,7);
  assert.equal(sent.event.m1.revision,'3','M1 revision never runs backwards');
  assert.equal(owner.state.lens12,11);assert.equal(owner.state.tick12,7);
 }finally{await c.dispose();}
});

test('a determinant event while held commits and stays held; no pump runs',async()=>{
 const {owner,c}=await open();
 try{
  c.hold('person held the field');
  await c.edit({kind:'context-frame',context_frame:2});
  assert.equal(c.status,'held');assert.equal(owner.state.context_frame,2);
  assert.equal(c.reading.instrument.acting.m1.context_frame,2,'held edits read back complete sources');
  const count=owner.calls.length;await wait(100);assert.equal(owner.calls.length,count);
 }finally{await c.dispose();}
});

test('presentation level is a gain stage after the native receiver, never a source value',async()=>{
 const {c}=await open();
 try{
  c.setLevel(2.5);assert.equal(c.reading.presentation_level.value,2.5);
  assert.throws(()=>c.setLevel(5),/level/);
  assert.match(c.reading.presentation_level.standing,/not a source value/);
 }finally{await c.dispose();}
});

test('a paused application during admission (reduced motion) still admits, then holds without pumping',async()=>{
 const owner=new ControlledK2Owner(),audio=new ControlledAudio(),c=new NativeFieldController(owner,renderer(),()=>audio),request=owner.request.bind(owner);
 // The app frame reports "paused" on every frame, including between the owner's
 // construction and its source reads.
 owner.request=async packet=>{if(packet.request?.command?.operation==='inspect')c.frame(0,true);return request(packet);};
 try{
  c.frame(0,true);await c.compose({sky:'none'});
  assert.equal(c.status,'held');assert.match(c.reason,/paused/);
  assert.ok(c.reading.instrument.influence,'sources and influence were read');
  assert.equal(ops(owner,'advance').length,0,'no pump while held');
 }finally{await c.dispose();}
});
