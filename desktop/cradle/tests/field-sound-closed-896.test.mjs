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
import {ControlledAudio,ControlledOwner} from './native-expression-fixture.mjs';

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

test('the frame\'s sound command takes one press to open the field\'s sound, and refuses anything else',()=>{
 const read=command=>M.readStageRequest({v:1,kind:'host-command',req:1,...command});
 assert.deepEqual(read({command:'sound',open:true})?.command,{command:'sound',open:true});
 assert.equal(read({command:'sound',open:false}),null,'open is a press: only true');
 assert.equal(read({command:'sound',open:'yes'}),null);
 assert.deepEqual(read({command:'sound',muted:true})?.command,{command:'sound',muted:true},'the mute is as it was');
 assert.deepEqual(read({command:'sound',open:true,muted:false})?.command,{command:'sound',muted:false,open:true},'one press may carry the Sound On with it');
});

function NativeFieldControllerOf(owner,audio){return new M.NativeFieldController(owner,renderer(),()=>audio);}
