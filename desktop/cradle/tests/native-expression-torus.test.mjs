/** The Torus's M1′ session through the live instrument's controller (O-I #850; DLW manual §21.2): every
 * setting goes to the one serial owner as QL's own `torus-set`, is read back from the owner's reply, and is
 * refused in the owner's words; the session is read (`torus-state`) at human cadence, so the comma the owner
 * gathers reaches the frame; the frame announces the owner's session as `parameters.torus`; a strike at a
 * point names the voices it struck by the owner's own mode refs, whatever the tuning. Against a controlled
 * protocol owner: not numerical evidence (QL-MEF tests/torus_host.rs is). */
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';
import * as THREE from 'three';
import {ControlledAudio,ControlledSceneOwner} from './native-expression-fixture.mjs';
const src=resolve('expressions-app/field-studies-journeys/src');
const temp=await mkdtemp(join(tmpdir(),'native-torus-tests-'));
await build({entryPoints:[join(src,'native-field/controller.ts')],bundle:true,platform:'node',format:'esm',outdir:temp,outExtension:{'.js':'.mjs'}});
const {NativeFieldController}=await import(pathToFileURL(join(temp,'controller.mjs')));
const {announceInstrument}=await import(pathToFileURL(join(src,'native-field/ql/instrumentAnnouncement.mjs')));
test.after(()=>rm(temp,{recursive:true,force:true}));
function renderer(){
 const texture=()=>new THREE.DataTexture(new Float32Array(16),2,2,THREE.RGBAFormat,THREE.FloatType);
 const port={texWidth:2,texHeight:2,particleCount:4,targetA:texture(),targetB:texture(),sets:0,setTargetTextures(a,b){this.actualA=a;this.actualB=b;this.sets++;}};
 return{port,native:false,retainedTopology(){return{tex_width:2,tex_height:2,particle_count:4,slot_count:4};},retainedTargetPort(){return port;},setNativeDomain(v){this.native=v;},releaseRetainedField(){},onRetainedRecoveryRequired(){return()=>{};},checkpointRetainedField(){throw new Error('no GPU');}};
}
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const ops=(owner,name)=>owner.calls.filter(c=>c.request?.command?.operation===name);
const generation=c=>c.reading.native.acknowledged.generation;
async function open(){
 const owner=new ControlledSceneOwner(),audio=new ControlledAudio(),c=new NativeFieldController(owner,renderer(),()=>audio);
 await c.compose({sky:'none'});return{owner,audio,c};
}

test('the Torus session is read from the owner, and each setting reaches QL\'s torus-set and reads back from its reply',async()=>{
 const {owner,c}=await open();
 try{
  assert.equal(c.reading.instrument.torus,null,'no session reading before the owner is asked');
  await c.torusState();
  assert.equal(ops(owner,'torus-state').length,1);
  assert.equal(c.reading.instrument.torus.band,'rhythm');
  assert.equal(c.reading.instrument.torus.settings.tuning,'logic','a new Torus opens under Logic, the manual\'s default');
  const before=generation(c);
  await c.torusSet({rate:{mode:'free',steps_per_second:440}});
  assert.deepEqual(ops(owner,'torus-set')[0].request.command,{operation:'torus-set',edit:{rate:{mode:'free',steps_per_second:440}}},'the owner\'s own op, the edit as given');
  assert.equal(c.reading.instrument.torus.band,'pitch','read back from the owner\'s reply, not set here');
  assert.equal(c.reading.instrument.torus.steps_per_second,440);
  assert.equal(generation(c),before,'a session setting moves no native state');
  assert.equal(c.status,'following','a Torus edit does not hold the field');
  await c.torusSet({rate:{mode:'sync',note:{numerator:1,denominator:4}},tempo_bpm:90,carrier:.25,shape:'spiral',polyphony:3});
  const torus=c.reading.instrument.torus;
  assert.deepEqual([torus.steps_per_second,torus.settings.carrier,torus.figure,torus.polyphony],[1.5,.25,'spiral',3]);
  const influences=ops(owner,'influence').length;
  await c.torusSet({fundamental:{source:'hz',hz:261.6}});
  assert.equal(BigInt(generation(c)),BigInt(before)+1n,'a Fundamental is one modes continuation');
  assert.equal(c.reading.instrument.influence.fundamental_hz,261.6,'the reply\'s influence is taken');
  assert.equal(ops(owner,'influence').length,influences,'without a second exchange');
 }finally{await c.dispose();}
});

test('a refused setting is the owner\'s refusal, in its words; the session reading stands as the owner last gave it',async()=>{
 const {owner,c}=await open();
 try{
  await c.torusState();
  owner.refuse=command=>command.operation==='torus-set'&&command.edit.polyphony===40;
  await assert.rejects(c.torusSet({polyphony:40}),/controlled refusal: torus-set/);
  assert.equal(c.reading.instrument.refusal.operation,'Torus');
  assert.match(c.reading.instrument.refusal.reason,/controlled refusal: torus-set/);
  assert.equal(c.reading.instrument.torus.polyphony,16,'unchanged');
  assert.equal(c.status,'following');
  owner.refuse=null;
  await assert.rejects(c.torusSet({}),/names at least one setting/,'an empty edit never reaches the owner');
  assert.equal(ops(owner,'torus-set').length,1);
 }finally{await c.dispose();}
});

test('the session is read again at human cadence while the field follows, so the comma the owner gathers reaches the frame',async()=>{
 const {owner,c}=await open();
 try{
  await c.refreshSources();
  assert.equal(ops(owner,'torus-state').length,1,'the first refresh reads the session');
  await c.refreshSources();
  assert.equal(ops(owner,'torus-state').length,1,'not again within a second');
  owner.comma=23.46;
  await wait(1050);
  await c.refreshSources();
  assert.equal(ops(owner,'torus-state').length,2);
  assert.equal(c.reading.instrument.torus.comma_cents,23.46,'the owner\'s comma, verbatim');
 }finally{await c.dispose();}
});

test('the comma starts from nothing when the Torus reopens: released, its reading goes with its owner; reopened, the new owner\'s comma',async()=>{
 const {owner,c}=await open();
 try{
  owner.comma=46.92;
  await c.torusState();
  assert.equal(c.reading.instrument.torus.comma_cents,46.92,'two returns gathered');
  await c.release();
  assert.equal(c.reading?.instrument?.torus??null,null,'released, no comma stands');
  await c.compose({sky:'none'});
  assert.equal(c.reading.instrument.torus,null,'reopened, nothing stands before the new owner is read');
  assert.equal(announceInstrument(c.reading).parameters.torus,undefined,'and none is announced');
  await c.torusState();
  assert.equal(c.reading.instrument.torus.comma_cents,0,'the reopened Torus gathers from nothing');
 }finally{await c.dispose();}
});

test('the frame announces the owner\'s Torus session as parameters.torus, and none before the owner is read',async()=>{
 const {c}=await open();
 try{
  assert.equal(announceInstrument(c.reading).parameters.torus,undefined,'nothing announced before the owner is read');
  await c.torusSet({fundamental:{source:'hz',hz:220},carrier:.5});
  assert.deepEqual(announceInstrument(c.reading).parameters.torus,{
   settings:{rate:{mode:'free',steps_per_second:2.5},fundamental:{source:'hz',hz:220},carrier:.5,shape:'auto',tuning:'logic',polyphony:16,tempo_bpm:120},
   steps_per_second:2.5,band:'rhythm',fundamental_hz:220,map_hz:130.81,figure:'figure-eight',comma_cents:0,notes:0,
   resident_tunings:['logic','sky'],carrier_drive:'pulse'});
 }finally{await c.dispose();}
});

test('a strike at a point names the voices it struck by the owner\'s mode refs, under Logic as under Sky',async()=>{
 const {c}=await open();
 try{
  assert.equal(c.reading.instrument.acting.voices.length,8,'a new Torus reads the octet in force, eight voices and no planet');
  assert.equal(c.reading.instrument.acting.voices[0].mode_ref,'scene:logic/0');
  await c.playAt([{theta:.5,phi:1}]);
  assert.deepEqual(c.reading.instrument.struck.refs,Array.from({length:8},(_,k)=>`scene:logic/${k}`),'the octet by its own refs, never a planet');
  await c.torusSet({tuning:'sky'});
  await c.playAt([{theta:.5,phi:1}]);
  assert.equal(c.reading.instrument.struck.refs[0],'scene:planet/#2-5-0/1','the sky\'s planets');
 }finally{await c.dispose();}
});

test('the set\'s tempo moves the pulse under Sync: the frame\'s tempo edit reaches torus-set and the rate reads back from the owner',async()=>{
 const {owner,c}=await open();
 try{
  await c.torusSet({rate:{mode:'sync',note:{numerator:1,denominator:4}}});
  assert.equal(c.reading.instrument.torus.steps_per_second,2,'a quarter note at 120 BPM: two steps a second');
  await c.torusSet({tempo_bpm:96});
  assert.deepEqual(ops(owner,'torus-set').at(-1).request.command,{operation:'torus-set',edit:{tempo_bpm:96}},'the set\'s tempo, as the owner\'s own edit');
  assert.deepEqual([c.reading.instrument.torus.settings.tempo_bpm,c.reading.instrument.torus.steps_per_second],[96,1.6],'read back from the owner\'s reply');
 }finally{await c.dispose();}
});

// O-I 851: the Torus as an object of the scene (DLW §21.2 "The Torus in the pane"). The object's law is proved on the pure module
// (expressions-app field-studies-journeys/tests/torus-object-851.test.mjs); here, that the controller keeps it, feeds it the owner's
// readings and offers what the pane needs.

test('a determinant reads the Torus session again at once, so a tritone\'s Klein bottle reaches the pane on its step',async()=>{
 const {owner,c}=await open();
 try{
  await c.torusState();
  assert.equal(ops(owner,'torus-state').length,1);
  await c.m1Advance(1);
  await c.refreshSources();
  assert.equal(ops(owner,'torus-state').length,2,'not a second later: the session the determinant moved is read on the next refresh');
  await c.refreshSources();
  assert.equal(ops(owner,'torus-state').length,2,'and then at human cadence again');
 }finally{await c.dispose();}
});

test('while the plate studies the modes under Manual, Focus or Automation the pulse is tuned to the drive, and given back after',async()=>{
 const {owner,c}=await open();
 try{
  await c.torusState();
  const before=structuredClone(c.reading.instrument.torus.settings.rate);
  await c.tunePulse(40);
  // §20.14 "the pulse is tuned to the drive and rings the plate", with §21.2's Carrier at its default 0 % ("the body sounds only when
  // something strikes it"): the tuned pulse is given the full share while it rings the plate (BA's round-893 finding; DLW build ruling
  // 2026-11-07; the share is a derivation), and the person's Carrier comes back with the rate.
  assert.deepEqual(ops(owner,'torus-set').at(-1).request.command.edit,{rate:{mode:'free',steps_per_second:40},carrier:1},'the drive, as the owner\'s own rate, and a carrier to ring the plate with');
  assert.equal(c.reading.instrument.torus.steps_per_second,40,'read back from the owner');
  assert.equal(c.reading.instrument.torus.carrier.value,1,'the carrier read back from the owner');
  const asked=ops(owner,'torus-set').length;
  await c.tunePulse(40.1);
  assert.equal(ops(owner,'torus-set').length,asked,'a drive that has not moved is not asked again');
  await c.tunePulse(null);
  assert.deepEqual(ops(owner,'torus-set').at(-1).request.command.edit,{rate:before,carrier:0},'the torus\'s own rate and carrier, given back');
  await c.tunePulse(null);
  assert.equal(ops(owner,'torus-set').length,asked+1,'once');
  // A Carrier the person set already drives the body: it is theirs, kept while the pulse is tuned and never written back.
  await c.torusSet({carrier:0.3});
  await c.tunePulse(80);
  assert.deepEqual(ops(owner,'torus-set').at(-1).request.command.edit,{rate:{mode:'free',steps_per_second:80}},'the rate alone');
  await c.tunePulse(null);
  assert.deepEqual(ops(owner,'torus-set').at(-1).request.command.edit,{rate:before},'the rate alone, given back');
  assert.equal(c.reading.instrument.torus.carrier.value,0.3);
 }finally{await c.dispose();}
});

test('the reading names the torus object: its shape by the law, its two helices, its voices and its four boundaries',async()=>{
 const {c}=await open();
 try{
  await c.torusState();
  const object=c.reading.instrument.torus_object;
  assert.equal(object.schema,'oi.torus-object/v1');
  assert.equal(object.standing,'read');
  assert.deepEqual(object.layers,['bimba','pratibimba']);
  assert.equal(object.voices.length,8);assert.equal(object.boundaries.length,4);
  assert.deepEqual(c.torusVoicePoints(),[],'a quiet body pulls nothing');
  c.layFlat(true);
  assert.equal(c.reading.instrument.torus_object.shape.flat,true,'laid flat while the scene\'s Resonance studies the modes');
 }finally{await c.dispose();}
});
