// O-I #747 round 896, item 0.7 (DLW build ruling 2026-11-09): "In one run of four, the field's audio was closed after the return from Live
// while the Sound read On. Find why… Then either reopen it on the return, or have the Sound say it is closed, with one press to open it.
// Red first, on a unit test of a closed or suspended context, or on the reproduction."
// Why, the second way (the first is field-pause-return-896.test.mjs): walk 896h (r896/walk/captures-896h/walk.json) read the field
// "Unavailable — native acknowledgement timed out" after the Live entry, and after the work was opened again on the return, Sound On and
// nothing heard (live 0 of 4 contexts). An opening the owner did not acknowledge leaves the field unavailable, its context closed; an
// opening again (nativeField.ts rebind) lets the field go and opens it only once the authored scene is still, which a playing scene never
// is. In each the Sound read On over a field that was not heard, and nothing said so.
// Now the frame says it: while the person's Sound is On over a field that was opened here and is not heard — let go, unavailable, or
// following with its context suspended or closed — the field's sound is closed, in words (entitySound.ts fieldSoundClosed), the frame
// announces them (`soundClosed`), and its `sound` stage command takes one press to open it (`open: true`: nativeField.ts openSound).
// Channel: the real controller over the controlled owner and audio fixtures (tests/native-expression-fixture.mjs), as
// native-expression.test.mjs drives it, and the frame's own stage reader. No audio device is opened.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';
import * as THREE from 'three';
import {ControlledAudio,ControlledOwner,ControlledSceneOwner} from './native-expression-fixture.mjs';

const src=resolve('expressions-app/field-studies-journeys/src');
const temp=await mkdtemp(join(tmpdir(),'field-sound-closed-896-'));
const entry=join(temp,'entry.ts');
await writeFile(entry,[
 `export {NativeFieldController} from ${JSON.stringify(join(src,'native-field/controller.ts'))};`,
 `export * as sound from ${JSON.stringify(join(src,'native-field/entitySound.ts'))};`,
 `export {readStageRequest} from ${JSON.stringify(join(src,'stageCommands.ts'))};`,
].join('\n'));
await build({entryPoints:[entry],bundle:true,platform:'node',format:'esm',outdir:temp,outExtension:{'.js':'.mjs'},logLevel:'silent'});
const M=await import(pathToFileURL(join(temp,'entry.mjs')));
test.after(()=>rm(temp,{recursive:true,force:true}));
// The renderer stub of native-expression.test.mjs, as it is there.
function renderer(){
 const texture=()=>new THREE.DataTexture(new Float32Array([0,0,0,.1,0,0,0,.2,0,0,0,.3,0,0,0,.4]),2,2,THREE.RGBAFormat,THREE.FloatType);
 const value={texWidth:2,texHeight:2,particleCount:4,targetA:texture(),targetB:texture(),sets:0,
  setTargetTextures(a,b){this.actualA=a;this.actualB=b;this.sets++;}};
 return{port:value,native:false,released:0,retainedTopology(){return{tex_width:2,tex_height:2,particle_count:4,slot_count:4};},retainedTargetPort(){return value;},setNativeDomain(v){this.native=v;},releaseRetainedField(){this.released++;},onRetainedRecoveryRequired(cb){this.callback=cb;return()=>{this.callback=null;};},checkpointRetainedField(){throw new Error('no GPU in controlled unit test');}};
}
const settle=async(c,want)=>{for(let i=0;i<200&&c.status!==want;i++)await new Promise(r=>setImmediate(r));return c.status;};
const closed=(c,asked=true)=>M.sound.fieldSoundClosed(c,asked);
/** Holds the owner's next reply to one operation until released: the controller's own work stands in flight meanwhile. */
function gated(owner){
 const request=owner.request.bind(owner);let want=null,arrived=null,release=null;
 owner.request=async packet=>{
  if(want&&packet.request?.command?.operation===want){want=null;const wait=new Promise(r=>{release=r;});arrived();await wait;}
  return request(packet);
 };
 return{on(operation){want=operation;return new Promise(r=>{arrived=r;});},release(){release();}};
}

test('the Sound says the field\'s sound is closed while its context is suspended or closed under a following field, and not once it runs again',async()=>{
 const owner=new ControlledOwner(),audio=new ControlledAudio(),c=new NativeFieldControllerOf(owner,audio);
 try{
  M.sound.setFieldSound(c,false);
  await c.connect('source.json','controlled:r1',48000);assert.equal(c.status,'following');
  assert.equal(closed(c),null,'following, its context running: heard');
  audio.state='suspended';
  assert.equal(c.status,'following','the owner still follows: nothing else says the field is not heard');
  assert.equal(closed(c),'The field\'s sound is closed: its audio is suspended.');
  audio.state='closed';
  assert.equal(closed(c),'The field\'s sound is closed: its audio is closed.');
  audio.state='suspended';await c.resume();
  assert.equal(audio.state,'running');assert.equal(closed(c),null,'resumed: heard again');
  // The Sound Off says nothing is closed: nothing is meant to be heard.
  M.sound.setFieldSound(c,true);audio.state='suspended';
  assert.equal(closed(c),null);
  M.sound.setFieldSound(c,false);
 }finally{await c.dispose();}
});

test('let go (an opening again waiting for the scene to be still) or unavailable (an opening not acknowledged), the Sound says it is closed and why',async()=>{
 const owner=new ControlledOwner(),c=new NativeFieldControllerOf(owner,new ControlledAudio());
 try{
  M.sound.setFieldSound(c,false);
  assert.equal(closed(c,false),null,'never opened here: the frame claims nothing');
  await c.connect('source.json','controlled:r1',48000);
  await c.release(true);
  c.reason='Opened another Expression: the live field let go of the scene so the change could stand, and opens again on it once the change settles.';
  assert.equal(closed(c),'The field\'s sound is closed: Opened another Expression: the live field let go of the scene so the change could stand, and opens again on it once the change settles.');
  // The owner does not acknowledge the opening.
  owner.request=async()=>{throw new Error('native acknowledgement timed out');};
  await assert.rejects(c.connect('source.json','controlled:r2',48000));
  assert.equal(c.status,'unavailable');
  assert.equal(closed(c),'The field\'s sound is closed: native acknowledgement timed out.','in the owner\'s words, without the error\'s own name');
  assert.equal(closed(c,false),null);
 }finally{await c.dispose();}
});

// O-I #747 round 896, 1R-surface.6 (review 4): a field held by no hold of the person's, with the Sound On, is not heard: the Sound says it
// is held and why, with the press to open it. The person's own hold says nothing: they held it.
// 1S (DLW build ruling 2026-11-09, F1 of review c99c): only a hold that waits on a person reads as "sound closed". The controller holds
// itself while its own work runs (a native operation, a determinant event, the readings, the Torus checkpoint) and while the application
// is paused or hidden; those let the field go themselves, so they say nothing, announce nothing and offer no Open sound. The reviewer's
// probe, made a test: "before op: following null", "mid op: held native operation" said the sound was closed, "after op: following null".
test('the controller\'s own holds say nothing while its work runs, nor the application\'s pause; a hold that waits on the person says the field is held and why; the person\'s own hold says nothing',async()=>{
 const owner=new ControlledSceneOwner(),c=new NativeFieldControllerOf(owner,new ControlledAudio()),gate=gated(owner);
 const said=[];
 try{
  M.sound.setFieldSound(c,false);
  await c.compose({sky:'none'});assert.equal(c.status,'following');
  // Every change the frame announces once the field is open (nativeField.ts update: soundClosed on each change).
  c.onChange=()=>{said.push(closed(c));};
  assert.equal(closed(c),null,'before the operation: following, heard');
  // An owner operation in flight, with the Sound On.
  let arrived=gate.on('m1-advance');const op=c.operate({operation:'m1-advance',ticks:1});await arrived;
  assert.equal(c.status,'held');assert.equal(c.reason,'native operation');
  assert.equal(closed(c),null,'mid operation: the controller\'s own hold says nothing');
  assert.equal(c.holdStands,false,'its own operation holds the field');
  gate.release();await op;
  assert.equal(c.status,'following');assert.equal(closed(c),null,'after the operation: following');
  // The application paused or hidden, and back.
  c.frame(.02,true);assert.equal(c.status,'held');assert.equal(c.reason,'application paused or hidden');
  assert.equal(closed(c),null,'paused or hidden: the application\'s own hold says nothing');
  c.frame(.02,false);assert.equal(await settle(c,'following'),'following');
  // A suspension (app.ts researchSuspension) holds it while it stands, and lets it go itself.
  const token=c.suspend('research reading open');assert.equal(c.status,'held');
  assert.equal(closed(c),null,'suspended: nothing said');
  await c.releaseSuspension(token);assert.equal(c.status,'following');
  // The person's own hold, and the controller's work on the field it holds: a determinant event, an operation.
  c.hold('held by you');assert.equal(closed(c),null,'the person held it');
  arrived=gate.on('m1-advance');const event=c.m1Advance(1);await arrived;
  assert.equal(c.reason,'native determinant event');assert.equal(closed(c),null,'mid determinant event: nothing said');
  gate.release();await event;
  assert.equal(c.reason,'held by you');assert.equal(closed(c),null,'the determinant event leaves the person\'s hold as it stood');
  arrived=gate.on('m1-advance');const held=c.operate({operation:'m1-advance',ticks:1});await arrived;
  assert.equal(closed(c),null,'mid operation on the held field: nothing said');
  gate.release();await held;
  assert.equal(c.status,'held');assert.equal(c.reason,'held by you','the operation leaves the person\'s hold as it stood, not its own');
  assert.equal(closed(c),null);
  assert.deepEqual(said.filter(Boolean),[],'nothing announced the sound closed while the controller worked or the application paused');
  // A reading on the held field: in flight it says nothing; complete, its hold stands until someone resumes, and says so.
  arrived=gate.on('influence');const reading=c.influence();await arrived;
  assert.equal(c.reason,'native influence reading');assert.equal(closed(c),null,'mid reading: nothing said');
  gate.release();await reading;
  assert.equal(c.reason,'influence reading complete; resume explicitly');
  const words='The field\'s sound is closed: the field is held (influence reading complete; resume explicitly).';
  assert.equal(closed(c),words,'and offers Open sound');assert.equal(c.holdStands,true,'the hold waits on the person');
  assert.equal(said.at(-1),words,'announced once the reading let the field go');
  c.frame(.02,true);c.frame(.02,false);assert.equal(closed(c),words,'a pause after it does not lift a hold that waits on the person');
  // Another reading on it: its hold, too, waits on the person.
  await c.torusState();assert.equal(c.reason,'Torus session reading complete; resume explicitly');
  assert.equal(closed(c),'The field\'s sound is closed: the field is held (Torus session reading complete; resume explicitly).');
  await c.resume();assert.equal(c.status,'following');assert.equal(closed(c),null,'resumed: heard');
  c.hold();assert.equal(closed(c),null,'the person\'s hold by the host command');
 }finally{await c.dispose();}
});

test('the frame\'s sound command takes one press to open the field\'s sound, and refuses anything else',()=>{
 const read=command=>M.readStageRequest({v:1,kind:'host-command',req:1,...command});
 assert.deepEqual(read({command:'sound',open:true})?.command,{command:'sound',open:true});
 assert.equal(read({command:'sound',open:false}),null,'open is a press: only true');
 assert.equal(read({command:'sound',open:'yes'}),null);
 assert.deepEqual(read({command:'sound',muted:true})?.command,{command:'sound',muted:true},'the mute is as it was');
 assert.deepEqual(read({command:'sound',open:true,muted:false})?.command,{command:'sound',muted:false,open:true},'one press may carry the Sound On with it');
});

function NativeFieldControllerOf(owner,audio){return new M.NativeFieldController(owner,renderer(),()=>audio);}
