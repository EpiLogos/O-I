import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {build} from 'esbuild';
import * as THREE from 'three';
import {controlledFrame,ControlledAudio,ControlledOwner} from './native-expression-fixture.mjs';
const src=resolve('expressions-app/field-studies-journeys/src');
const temp=await mkdtemp(join(tmpdir(),'native-expression-tests-'));
await build({entryPoints:[join(src,'native-field/projection.ts'),join(src,'native-field/controller.ts')],bundle:true,platform:'node',format:'esm',outdir:temp,outExtension:{'.js':'.mjs'}});
const {NativeProjection}=await import(pathToFileURL(join(temp,'projection.mjs')));
const {NativeFieldController,EMBEDDED_NATIVE_PLAYBACK}=await import(pathToFileURL(join(temp,'controller.mjs')));
test.after(()=>rm(temp,{recursive:true,force:true}));
function renderer(){
 const texture=()=>new THREE.DataTexture(new Float32Array([0,0,0,.1,0,0,0,.2,0,0,0,.3,0,0,0,.4]),2,2,THREE.RGBAFormat,THREE.FloatType);
 const value={texWidth:2,texHeight:2,particleCount:4,targetA:texture(),targetB:texture(),sets:0,
  setTargetTextures(a,b){this.actualA=a;this.actualB=b;this.sets++;}};
 return{port:value,native:false,released:0,retainedTopology(){return{tex_width:2,tex_height:2,particle_count:4,slot_count:4};},retainedTargetPort(){return value;},setNativeDomain(v){this.native=v;},releaseRetainedField(){this.released++;},onRetainedRecoveryRequired(cb){this.callback=cb;return()=>{this.callback=null;};},checkpointRetainedField(){throw new Error('no GPU in controlled unit test');}};
}
const spec={units_per_metre:400,slots_a:[0,1,0,1],slots_b:[1,0,1,0]};
const tick=()=>new Promise(r=>setTimeout(r,25));
test('exact native positions and explicit scale affect consumed textures; density and identity survive',()=>{
 const r=renderer(),frame=controlledFrame(),p=new NativeProjection(r.port,frame,spec);
 assert.equal(r.port.actualA.image.data[0],Math.fround(Math.fround(-.3)*400));assert.equal(r.port.actualB.image.data[0],Math.fround(Math.fround(.3)*400));
 const density=[...r.port.actualA.image.data].filter((_,i)=>i%4===3);
 for(let i=1;i<=80;i++){
  const f=structuredClone(frame);f.generation=String(i+1);f.samples_elapsed=String(i*512);f.targets[0].position=[i/100,-i/100,1/8];p.apply(f);
  assert.equal(r.port.actualA.image.data[0],Math.fround(Math.fround(i/100)*400));assert.equal(r.port.actualA.image.data[2],50);
  assert.deepEqual([...r.port.actualA.image.data].filter((_,j)=>j%4===3),density);
 }
 const cursor=p.inspect().native;p.setScale(200);assert.equal(r.port.actualA.image.data[0],160);assert.deepEqual(p.inspect().native,cursor);
 p.dispose();
});
test('producer disconnect, stale cursor, wrong identity and overflow cannot leave a successful consumer',()=>{
 const r=renderer(),frame=controlledFrame(),p=new NativeProjection(r.port,frame,spec);const original=[...r.port.actualA.image.data];
 for(const mutate of [f=>f.subject_ref='foreign',f=>f.presentation_units_per_metre=400,f=>f.targets[0].identity=9,f=>f.targets[0].position[0]=Infinity,f=>f.targets[0].position[0]=3e38,f=>f.generation='01',f=>f.targets[0].position[0]=.7]){
  const f=structuredClone(frame);mutate(f);assert.throws(()=>p.apply(f));assert.deepEqual([...r.port.actualA.image.data],original);
 }
 assert.throws(()=>new NativeProjection(renderer().port,frame,{...spec,slots_a:[0]}),/correspondence/);
 p.dispose();assert.throws(()=>p.apply(frame),/disposed/);
});
test('real driver consumes controlled producer effects, then holds GPU/audio on disconnection rather than demo fallback',async()=>{
 const port=new ControlledOwner(),audio=new ControlledAudio(),r=renderer(),c=new NativeFieldController(port,r,()=>audio);
 try{
  await c.connect('source.json','controlled:r1',48000);assert.equal(c.status,'following');assert.equal(r.native,true);
  await tick();audio.currentTime=.09;c.frame(.016,false);
  assert.ok(c.inspectTargets().target_a[1]>0,'disconnecting delivery would leave this zero');
  await c.operate({operation:'set-axis',axis:0,phase:{turns:'0',half_degrees:180}});
  audio.currentTime=c.reading.native.audio.target_context_seconds;c.frame(0,false);
  assert.equal(c.inspectTargets().target_a[0],100);
  const native=structuredClone(c.reading.native.acknowledged);c.setScale(800);assert.equal(c.inspectTargets().target_a[0],200);assert.deepEqual(c.reading.native.acknowledged,native);
  assert.equal(c.reading.presentation_mode,'manual-presentation-override');c.followDomain();assert.equal(c.reading.presentation_mode,'domain-follow');
  c.hold('test hold');await tick();const held=port.calls.length;c.frame(.02,false);await tick();assert.equal(port.calls.length,held);assert.equal(c.frame(.02,false),0);
  await c.resume();port.lost=true;await tick();c.frame(.02,false);assert.equal(c.status,'unavailable');assert.equal(c.frame(.02,false),0);
  const failed=port.calls.length;await tick();assert.equal(port.calls.length,failed,'unknown request must not replay');
 }finally{await c.dispose();}
 assert.equal(audio.state,'closed');assert.equal(port.closed,true);assert.equal(r.native,false);
});
test('pause/hidden holds one existing driver; inspect returns complete producer sources without new owner',async()=>{
 const port=new ControlledOwner(),audio=new ControlledAudio(),r=renderer(),c=new NativeFieldController(port,r,()=>audio);
 try{await c.connect('source.json','controlled:r1',48000);c.frame(.02,true);assert.equal(c.status,'held');
  await c.resume();const sources=await c.inspectSources();assert.equal(sources.current.m3.transcription.sequence,'ACT');assert.equal(c.status,'held');
  assert.equal(port.calls.filter(x=>x.operation==='open').length,1);assert.equal(c.reading.exact_seek,false);
  await assert.rejects(c.saveCheckpoint(),/no GPU/);
 }finally{await c.dispose();}
});
test('late open after unmount closes its real lease and cannot become a new renderer',async()=>{
 const port=new ControlledOwner(),r=renderer(),audio=new ControlledAudio();const request=port.request.bind(port);let release;
 const delay=new Promise(resolve=>release=resolve);port.request=async packet=>{const result=await request(packet);if(packet.operation==='open')await delay;return result;};
 const c=new NativeFieldController(port,r,()=>audio);const opening=c.connect('source.json','controlled:r1',48000);await tick();await c.dispose();release();await opening;
 assert.equal(port.closed,true);assert.equal(r.native,false);assert.equal(audio.state,'closed');
});
test('vendored clients retain exact accepted QL byte identities, rather than another implementation',async()=>{
 const base=join(src,'native-field/ql'),provenance=JSON.parse(await readFile(join(base,'PROVENANCE.json'),'utf8'));
 for(const [name,sha] of Object.entries(provenance.files)){const bytes=await readFile(join(base,name));assert.equal(createHash('sha256').update(bytes).digest('hex'),sha);
  if(process.env.QL_SOURCE)assert.deepEqual(bytes,await readFile(join(process.env.QL_SOURCE,'adapters/retained-field',name)));
 }
});

test('native transcription and material controls modify the existing producer, not an overlay-only imitation',async()=>{
 const owner=new ControlledOwner(),audio=new ControlledAudio(),r=renderer(),c=new NativeFieldController(owner,r,()=>audio);
 try{
  await c.connect('source.json','controlled:r1',48000);assert.equal(c.reading.domain.m3.sequence,'ACT');
  await c.editBasis({kind:'transcription',rna:true});assert.equal(c.reading.domain.m3.sequence,'ACU');
  await c.editBasis({kind:'harmonic-row',row12:4});assert.equal(c.reading.domain.m1.revision,'1');assert.deepEqual(c.reading.domain.m1.quadrature,[0,1]);
  await c.editBasis({kind:'carrier-tick',tick12:3});assert.equal(c.reading.domain.m1.tick12,3);assert.equal(c.reading.domain.m1.revision,'2');
  await c.editBasis({kind:'damping',mode_ref:'controlled:mode',per_second:.75});
  audio.currentTime=c.reading.native.audio.target_context_seconds;c.frame(0,false);
  assert.equal(c.inspectTargets().target_b[2],300);assert.equal(c.reading.domain.m2.modes[0].damping_per_second,.75);
  assert.equal(owner.calls.filter(x=>x.operation==='open').length,1);
  assert.equal(owner.calls.filter(x=>x.request?.command?.operation==='replace').length,4);
  assert.equal(owner.sources.current.input.m2.stamp.identity.profile_generation,5);
  assert.equal(owner.sources.original.input.m2.stamp.identity.profile_generation,1);
 }finally{await c.dispose();}
});
test('missing or foreign complete producer readings fail admission even when attractive targets remain available',async()=>{
 for(const mutate of [s=>delete s.current.m3,s=>s.current.m3.subject_ref='foreign',s=>s.current.m1.carrier.quadrature=[NaN,0]]){
  const owner=new ControlledOwner(),request=owner.request.bind(owner),r=renderer(),audio=new ControlledAudio();
  owner.request=async command=>{const reply=await request(command);if(reply.sources)mutate(reply.sources);return reply;};
  const c=new NativeFieldController(owner,r,()=>audio);
  try{await assert.rejects(c.connect('source.json','controlled:r1',48000),/source admission/);assert.equal(c.status,'unavailable');assert.equal(c.frame(.05,false),0);assert.equal(r.native,false);assert.equal(owner.closed,true);}
  finally{await c.dispose();}
 }
});
test('visibility hold during an asynchronous open never starts an unseen native driver',async()=>{
 const owner=new ControlledOwner(),request=owner.request.bind(owner),audio=new ControlledAudio(),r=renderer();let complete;
 const wait=new Promise(resolve=>complete=resolve);owner.request=async command=>{const reply=await request(command);if(command.operation==='open')await wait;return reply;};
 const c=new NativeFieldController(owner,r,()=>audio),opening=c.connect('source.json','controlled:r1',48000);
 await tick();c.hold('hidden during source admission');complete();await opening;
 try{assert.equal(c.status,'held');await tick();assert.equal(owner.calls.filter(x=>x.request?.command.operation==='advance').length,0);}
 finally{await c.dispose();}
});
test('late failed open from a released epoch cannot destroy a later successful connection',async()=>{
 const owner=new ControlledOwner(),request=owner.request.bind(owner),r=renderer();let fail;let first=true;
 const wait=new Promise((_,reject)=>fail=reject);
 owner.request=async command=>{if(command.operation==='open'&&first){first=false;return wait;}return request(command);};
 const c=new NativeFieldController(owner,r,()=>new ControlledAudio()),opening=c.connect('first.json','r1',48000);
 await tick();await c.release();await c.connect('second.json','r2',48000);fail(new Error('old transport failed'));await opening;
 try{assert.equal(c.status,'following');assert.equal(r.native,true);assert.equal(owner.closed,false);}
 finally{await c.dispose();}
});
test('unknown producer failure closes once and cannot automatically replay a write or keep native sound',async()=>{
 const owner=new ControlledOwner(),audio=new ControlledAudio(),r=renderer(),c=new NativeFieldController(owner,r,()=>audio);
 try{await c.connect('source.json','controlled:r1',48000);owner.lost=true;await tick();c.frame(.02,false);assert.equal(c.status,'unavailable');await tick();assert.equal(owner.closed,true);}
 finally{await c.dispose();}
 assert.equal(owner.calls.filter(x=>x.operation==='close').length,1);
});
test('native edits preserve a deliberate hold and cannot restart work hidden during a pending edit',async()=>{
 const owner=new ControlledOwner(),audio=new ControlledAudio(),r=renderer(),c=new NativeFieldController(owner,r,()=>audio);
 try{
  await c.connect('source.json','controlled:r1',48000);c.hold('human pause');
  await c.editBasis({kind:'transcription',rna:true});assert.equal(c.status,'held');
  assert.equal(c.reading.domain.m3.rna,true);const count=owner.calls.length;await tick();assert.equal(owner.calls.length,count);
  await c.resume();let complete;const wait=new Promise(resolve=>complete=resolve),request=owner.request.bind(owner);let first=true;
  owner.request=async command=>{const reply=await request(command);if(command.request?.command.operation==='inspect'&&first){first=false;await wait;}return reply;};
  const editing=c.editBasis({kind:'damping',mode_ref:'controlled:mode',per_second:.5});await tick();c.hold('hidden during edit');complete();await editing;
  assert.equal(c.status,'held');assert.equal(c.frame(.1,false),0);const held=owner.calls.length;await tick();assert.equal(owner.calls.length,held);
 }finally{await c.dispose();}
});
test('slow complete-source inspection rebases the device without advancing the native clock',async()=>{
 const owner=new ControlledOwner(),audio=new ControlledAudio(),r=renderer(),request=owner.request.bind(owner);
 owner.request=async command=>{const reply=await request(command);if(command.request?.command.operation==='inspect')audio.currentTime+=2;return reply;};
 const c=new NativeFieldController(owner,r,()=>audio);
 try{await c.connect('source.json','controlled:r1',48000);assert.equal(c.status,'following');assert.equal(c.reading.native.acknowledged.samples_elapsed,'0');
  assert.ok(c.reading.native.audio.target_context_seconds>=2);
 }finally{await c.dispose();}
});

test('every helper edit keeps M2/M3 seed generations coupled and refuses retained command-history rewriting',async()=>{
 const owner=new ControlledOwner(),audio=new ControlledAudio(),c=new NativeFieldController(owner,renderer(),()=>audio);
 try{await c.connect('source.json','r1',48000);c.hold();
  for(const edit of [{kind:'carrier-tick',tick12:1},{kind:'transcription',rna:true},{kind:'damping',mode_ref:'controlled:mode',per_second:.3}]){
   await c.editBasis(edit);const input=owner.sources.current.input;
   assert.equal(input.m3.stamp.identity.profile_generation,input.m2.stamp.identity.profile_generation);
   assert.deepEqual(input.m3.m2_basis.identity,input.m3.stamp.identity);
  }
  owner.sources.current.input.m3_commands=[{expected_generation:1}];const before=owner.calls.filter(x=>x.request?.command?.operation==='replace').length;
  await assert.rejects(c.editBasis({kind:'carrier-tick',tick12:2}),/retained M3 commands/);
  assert.equal(owner.calls.filter(x=>x.request?.command?.operation==='replace').length,before);
 }finally{await c.dispose();}
});
test('declared embedded buffering pays for a 65ms delivery without resampling or silently dropping native PCM',async()=>{
 const owner=new ControlledOwner(),audio=new ControlledAudio(),request=owner.request.bind(owner);
 owner.request=async packet=>{const reply=await request(packet);if(packet.request?.command?.operation==='advance')audio.currentTime+=.065;return reply;};
 const c=new NativeFieldController(owner,renderer(),()=>audio,EMBEDDED_NATIVE_PLAYBACK);
 try{await c.connect('source.json','r1',48000);await tick();c.frame(.016,false);
  assert.equal(c.status,'following');assert.equal(c.reading.native.acknowledged.samples_elapsed,'8192');
  assert.equal(c.reading.playback_policy.leadSeconds,.25);assert.equal(audio.nodes[0].buffer.data.length,8192);
  assert.equal(audio.nodes[0].time,.25);assert.equal(audio.sampleRate,48000);
 }finally{await c.dispose();}
});

function delayedPacket(owner,predicate){
 const request=owner.request.bind(owner);let release,arrive,used=false;
 const arrived=new Promise(resolve=>arrive=resolve),blocked=new Promise(resolve=>release=resolve);
 owner.request=async packet=>{const reply=await request(packet);if(!used&&predicate(packet)){used=true;arrive();await blocked;}return reply;};
 return {arrived,release:()=>release()};
}
const advances=owner=>owner.calls.filter(packet=>packet.request?.command?.operation==='advance').length;
test('instrument suspension survives delayed admission and resumes only after its final token returns',async()=>{
 const owner=new ControlledOwner(),audio=new ControlledAudio(),c=new NativeFieldController(owner,renderer(),()=>audio);
 const gate=delayedPacket(owner,packet=>packet.operation==='open');
 const opening=c.connect('source.json','r1',48000);
 try{
  await gate.arrived;const first=c.suspend('research instrument'),second=c.suspend('another inactive view');
  c.frame(0,true);c.frame(0,true);gate.release();await opening;
  assert.equal(c.status,'held');assert.equal(c.reason,'research instrument');
  await tick();assert.equal(advances(owner),0);
  await c.releaseSuspension(first);assert.equal(c.status,'held');
  await c.releaseSuspension(second);assert.equal(c.status,'following');
  await tick();assert.ok(advances(owner)>0);assert.equal(owner.calls.filter(p=>p.operation==='open').length,1);
 }finally{gate.release();await opening;await c.dispose();}
});
test('leaving research before admission completes clears only its own opening hold',async()=>{
 for(const manual of [false,true]){
  const owner=new ControlledOwner(),c=new NativeFieldController(owner,renderer(),()=>new ControlledAudio());
  const gate=delayedPacket(owner,packet=>packet.operation==='open'),opening=c.connect('source.json','r1',48000);
  try{
   await gate.arrived;const token=c.suspend('research instrument');c.frame(0,true);
   if(manual)c.hold('document hidden');
   await c.releaseSuspension(token);gate.release();await opening;
   assert.equal(c.status,manual?'held':'following');
   if(manual){assert.equal(c.reason,'document hidden');await tick();assert.equal(advances(owner),0);}
  }finally{gate.release();await opening;await c.dispose();}
 }
});
test('rapid research re-entry cancels queued restoration without losing its eventual playback intent',async()=>{
 const owner=new ControlledOwner(),c=new NativeFieldController(owner,renderer(),()=>new ControlledAudio());
 try{
  await c.connect('source.json','r1',48000);
  const first=c.suspend('research instrument'),resuming=c.releaseSuspension(first);
  const second=c.suspend('research instrument');await resuming;
  assert.equal(c.status,'held');assert.equal(c.reason,'research instrument');
  const count=advances(owner);await tick();assert.equal(advances(owner),count);
  await c.releaseSuspension(second);assert.equal(c.status,'following');
 }finally{await c.dispose();}
});
test('research re-entry during native recovery cannot start the recovered driver',async()=>{
 const owner=new ControlledOwner(),c=new NativeFieldController(owner,renderer(),()=>new ControlledAudio());
 try{
  await c.connect('source.json','r1',48000);const first=c.suspend('research instrument');
  const gate=delayedPacket(owner,packet=>packet.request?.command?.operation==='read');
  const resuming=c.releaseSuspension(first);await gate.arrived;
  const second=c.suspend('research instrument');gate.release();await resuming;
  assert.equal(c.status,'held');assert.equal(c.reason,'research instrument');
  const count=advances(owner);await tick();assert.equal(advances(owner),count);
  await c.releaseSuspension(second);assert.equal(c.status,'following');
 }finally{await c.dispose();}
});
test('suspension tokens never release a manual hold or a replacement native lifetime',async()=>{
 const owner=new ControlledOwner(),c=new NativeFieldController(owner,renderer(),()=>new ControlledAudio());
 try{
  await c.connect('source.json','r1',48000);c.hold('human pause');
  const held=c.suspend('research instrument');await c.releaseSuspension(held);
  assert.equal(c.status,'held');assert.equal(c.reason,'human pause');
  await c.resume();const token=c.suspend('research instrument');c.hold('document hidden');
  await c.releaseSuspension(token);assert.equal(c.status,'held');assert.equal(c.reason,'document hidden');
  await c.resume();const old=c.suspend('research instrument');await c.release();
  await c.connect('replacement.json','r2',48000);c.hold('new owner pause');
  await c.releaseSuspension(old);assert.equal(c.status,'held');assert.equal(c.reason,'new owner pause');
  const count=advances(owner);await tick();assert.equal(advances(owner),count);
 }finally{await c.dispose();}
});
