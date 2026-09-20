import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {build} from '../expressions-app/node_modules/esbuild/lib/main.js';
import * as THREE from 'three';
import {controlledFrame,ControlledAudio,ControlledOwner} from './native-expression-fixture.mjs';
const src=resolve('expressions-app/field-studies-journeys/src');
const temp=await mkdtemp(join(tmpdir(),'native-expression-tests-'));
await build({entryPoints:[join(src,'native-field/projection.ts'),join(src,'native-field/controller.ts')],bundle:true,platform:'node',format:'esm',outdir:temp,outExtension:{'.js':'.mjs'}});
const {NativeProjection}=await import(pathToFileURL(join(temp,'projection.mjs')));
const {NativeFieldController}=await import(pathToFileURL(join(temp,'controller.mjs')));
test.after(()=>rm(temp,{recursive:true,force:true}));
function renderer(){
 const texture=()=>new THREE.DataTexture(new Float32Array([0,0,0,.1,0,0,0,.2,0,0,0,.3,0,0,0,.4]),2,2,THREE.RGBAFormat,THREE.FloatType);
 const value={texWidth:2,texHeight:2,particleCount:4,targetA:texture(),targetB:texture(),sets:0,
  setTargetTextures(a,b){this.actualA=a;this.actualB=b;this.sets++;}};
 return{port:value,native:false,released:0,retainedTargetPort(){return value;},setNativeDomain(v){this.native=v;},releaseRetainedField(){this.released++;},onRetainedRecoveryRequired(cb){this.callback=cb;return()=>{this.callback=null;};},checkpointRetainedField(){throw new Error('no GPU in controlled unit test');}};
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
  await c.resume();const sources=await c.inspectSources();assert.deepEqual(Object.keys(sources),['m1','m2','m3']);assert.equal(c.status,'held');
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
