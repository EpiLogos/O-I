// O-I #747 round 896, item 0.7 (DLW build ruling 2026-11-09): "In one run of four, the field's audio was closed after the return from Live
// while the Sound read On. Find why… Then either reopen it on the return, or have the Sound say it is closed, with one press to open it."
// Why: the field's owner held itself whenever the application's frame reported a pause (native-field/controller.ts `frame`: the field
// paused, the Library open, a native Scene edit awaiting its owner, a research instrument shown), and nothing released that hold when the
// pause ended. Walk 896a (r896/walk/captures-896a/walk.json, sound-after-live-entry) read Sound On after the return from Live with the
// scene playing and nothing heard (heard 0 of 28 steps, its context running): the owner stood held. Reopening the work opened a new owner,
// and only then was it heard.
// Now the pause's hold is the pause's own: when the pause ends and nothing else has held the owner since, the owner resumes (the context
// resumed and the field following again). Any other hold made meanwhile, a person's or an owner's, stands. A pause leaves no suspension
// behind, so opening another work while paused is not refused.
// Channel: the real controller over the controlled owner and audio fixtures (tests/native-expression-fixture.mjs), as
// native-expression.test.mjs drives it. No audio device is opened.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';
import * as THREE from 'three';
import {ControlledAudio,ControlledOwner} from './native-expression-fixture.mjs';

const src=resolve('expressions-app/field-studies-journeys/src');
const temp=await mkdtemp(join(tmpdir(),'field-pause-return-896-'));
await build({entryPoints:[join(src,'native-field/controller.ts')],bundle:true,platform:'node',format:'esm',outdir:temp,outExtension:{'.js':'.mjs'}});
const {NativeFieldController}=await import(pathToFileURL(join(temp,'controller.mjs')));
test.after(()=>rm(temp,{recursive:true,force:true}));
// The renderer stub of native-expression.test.mjs, as it is there.
function renderer(){
 const texture=()=>new THREE.DataTexture(new Float32Array([0,0,0,.1,0,0,0,.2,0,0,0,.3,0,0,0,.4]),2,2,THREE.RGBAFormat,THREE.FloatType);
 const value={texWidth:2,texHeight:2,particleCount:4,targetA:texture(),targetB:texture(),sets:0,
  setTargetTextures(a,b){this.actualA=a;this.actualB=b;this.sets++;}};
 return{port:value,native:false,released:0,retainedTopology(){return{tex_width:2,tex_height:2,particle_count:4,slot_count:4};},retainedTargetPort(){return value;},setNativeDomain(v){this.native=v;},releaseRetainedField(){this.released++;},onRetainedRecoveryRequired(cb){this.callback=cb;return()=>{this.callback=null;};},checkpointRetainedField(){throw new Error('no GPU in controlled unit test');}};
}
// The serial owner settles over a few turns of the event loop; a logical wait of turns, never a wall-clock assertion.
const settle=async(c,want)=>{for(let i=0;i<200&&c.status!==want;i++)await new Promise(r=>setImmediate(r));return c.status;};
const advances=owner=>owner.calls.filter(packet=>packet.request?.command?.operation==='advance').length;

test('the return from a pause reopens the field: held while paused, following again once the pause ends',async()=>{
 const owner=new ControlledOwner(),audio=new ControlledAudio(),c=new NativeFieldController(owner,renderer(),()=>audio);
 try{
  await c.connect('source.json','controlled:r1',48000);assert.equal(c.status,'following');
  // Live is entered (the field's frame paused, its context suspended by the page): the owner holds, and nothing is pumped.
  assert.equal(c.frame(.02,true),0);assert.equal(c.status,'held');assert.equal(c.reason,'application paused or hidden');
  audio.state='suspended';
  const held=advances(owner);c.frame(.02,true);await settle(c,'following');assert.equal(advances(owner),held,'no pump while paused');
  // The return: the first frame that is not paused reopens it.
  c.frame(.02,false);
  assert.equal(await settle(c,'following'),'following','the owner follows again on the return');
  assert.equal(c.reason,null);
  assert.equal(audio.state,'running','its context is running again');
  assert.ok(c.frame(.02,false)>0,'and the field moves');
 }finally{await c.dispose();}
});

test('a hold made while paused stands after the return: only the pause\'s own hold is let go',async()=>{
 const owner=new ControlledOwner(),audio=new ControlledAudio(),c=new NativeFieldController(owner,renderer(),()=>audio);
 try{
  await c.connect('source.json','controlled:r1',48000);
  c.frame(.02,true);assert.equal(c.status,'held');
  c.hold('the person held it');
  c.frame(.02,false);await settle(c,'following');
  assert.equal(c.status,'held');assert.equal(c.reason,'the person held it');
 }finally{await c.dispose();}
});

test('paused while the owner is admitted (the Library open, say): it admits held, and the return lets it follow',async()=>{
 const owner=new ControlledOwner(),audio=new ControlledAudio(),c=new NativeFieldController(owner,renderer(),()=>audio);
 try{
  const opening=c.connect('source.json','controlled:r1',48000);c.frame(0,true);await opening;
  assert.equal(c.status,'held');assert.match(c.reason,/paused/);
  c.frame(.02,false);
  assert.equal(await settle(c,'following'),'following');
 }finally{await c.dispose();}
});

test('a pause leaves no suspension: another work opens while paused, and a research suspension still owns its own return',async()=>{
 const owner=new ControlledOwner(),audio=new ControlledAudio(),c=new NativeFieldController(owner,renderer(),()=>new ControlledAudio());
 try{
  await c.connect('source.json','controlled:r1',48000);
  c.frame(.02,true);
  await c.release();
  await c.connect('source.json','controlled:r2',48000);
  assert.notEqual(c.status,'unavailable','opening another owner while paused is not refused');
  // A research instrument's suspension and a pause together: the pause's end does not release the instrument's hold.
  c.frame(.02,false);await settle(c,'following');
  const token=c.suspend('research instrument');c.frame(.02,true);c.frame(.02,false);await settle(c,'following');
  assert.equal(c.status,'held');assert.equal(c.reason,'research instrument');
  await c.releaseSuspension(token);assert.equal(await settle(c,'following'),'following');
 }finally{await c.dispose();void audio;}
});

// O-I #747 round 896, 1R (#940's CI, the embedded backcheck native-expression-scene-browser.mjs: "admission under reduced motion holds before
// any pump", "the determinant commits while held"): under reduced motion the field opens held, and nothing sets it moving by itself. The
// application reports a pause from its start (app.ts fieldPaused), and the opening itself lets the application go (nativeField.ts
// onResumeApplication): that is not a pause the field returns from. It stands held until the person resumes it.
test('under reduced motion the field opens held and stays held when the application goes on, until the person resumes it',async()=>{
 const owner=new ControlledOwner(),audio=new ControlledAudio(),c=new NativeFieldController(owner,renderer(),()=>audio);
 const had=globalThis.matchMedia;
 globalThis.matchMedia=query=>({matches:query==='(prefers-reduced-motion: reduce)'});
 try{
  const opening=c.connect('source.json','controlled:r1',48000);c.frame(0,true);await opening;
  assert.equal(c.status,'held');assert.match(c.reason,/paused/);
  c.frame(.02,false);c.frame(.02,false);
  assert.equal(await settle(c,'following'),'held','the application going on sets nothing moving');
  assert.match(c.reason,/reduced motion/,'and the hold says why');
  assert.equal(advances(owner),0,'and nothing is pumped');
  await c.resume();
  assert.equal(c.status,'following','the person\'s resume sets it moving');
 }finally{globalThis.matchMedia=had;await c.dispose();}
});

// O-I #747 round 896, 1R-surface.6 (review 4): a suspension taken while the pause holds the field (restore:false, for the field was held)
// left the field held for good once both ended, with the Sound On and no words. The pause's hold now stands until the suspension ends, and
// the suspension's release returns from the pause.
test('a suspension taken during a pause: the pause\'s hold stands until the suspension ends, and its release resumes the field',async()=>{
 const owner=new ControlledOwner(),audio=new ControlledAudio(),c=new NativeFieldController(owner,renderer(),()=>audio);
 try{
  await c.connect('source.json','controlled:r1',48000);assert.equal(c.status,'following');
  c.frame(.02,true);assert.equal(c.status,'held');
  const token=c.suspend('research instrument');
  c.frame(.02,false);await settle(c,'following');
  assert.equal(c.status,'held','the suspension still stands: the return waits for it');
  await c.releaseSuspension(token);
  assert.equal(await settle(c,'following'),'following','the suspension ends: the pause is returned from');
  c.frame(.02,false);assert.equal(c.status,'following','and it stays following on later frames');
 }finally{await c.dispose();}
});

// O-I #747 round 896, 1T item 15 (DLW build ruling 2026-11-09; review c99d F-2): the controller's own work on a field the application's
// pause holds (an operation, a basis edit, a source inspection) put the pause's words back and left its mark at the revision before the
// work, so the pause's end found the hold changed and left the field held for good, said as the sound closed. The work now puts the pause's
// mark back with its words, at the hold's revision after it: nothing is said meanwhile, and the pause's end resumes the field. A suspension's
// hold is put back the same way, and its release resumes the field.
test('a pause, then the controller\'s own work, then the pause ends: the field follows, and nothing was said meanwhile',async()=>{
 const owner=new ControlledOwner(),audio=new ControlledAudio(),c=new NativeFieldController(owner,renderer(),()=>audio);
 try{
  await c.connect('source.json','controlled:r1',48000);assert.equal(c.status,'following');
  const works=[['an operation',()=>c.operate({operation:'set-axis',axis:0,phase:{turns:'0',half_degrees:180}})],
   ['a basis edit',()=>c.editBasis({kind:'carrier-tick',tick12:3})],['a source inspection',()=>c.inspectSources()]];
  for(const [name,work] of works){
   c.frame(.02,true);assert.equal(c.status,'held');assert.equal(c.reason,'application paused or hidden');
   await work();
   assert.deepEqual([c.status,c.reason],['held','application paused or hidden'],`${name}: the pause's hold, put back`);
   assert.equal(c.holdStands,false,`${name}: and its mark, so it is the pause's own and says nothing`);
   c.frame(.02,false);
   assert.equal(await settle(c,'following'),'following',`${name}: the pause ends, and the field follows`);
  }
 }finally{await c.dispose();}
});

test('a suspension, then the controller\'s own work, then the suspension ends: the field follows',async()=>{
 const owner=new ControlledOwner(),audio=new ControlledAudio(),c=new NativeFieldController(owner,renderer(),()=>audio);
 try{
  await c.connect('source.json','controlled:r1',48000);assert.equal(c.status,'following');
  const token=c.suspend('research instrument');assert.equal(c.status,'held');
  await c.operate({operation:'set-axis',axis:0,phase:{turns:'0',half_degrees:180}});
  assert.deepEqual([c.status,c.reason],['held','research instrument'],'the suspension\'s hold, put back');
  await c.releaseSuspension(token);
  assert.equal(await settle(c,'following'),'following','the suspension ends, and the field follows');
 }finally{await c.dispose();}
});
