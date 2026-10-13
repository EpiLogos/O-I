import test from 'node:test';
import assert from 'node:assert/strict';
import {fieldStudies,validateJourney,clone,sceneContentDigest} from '../build/model.js';
import {insertScene,overwriteScene,stillScene,rollSceneSeam,seamRollRange,slipScene,splitScene,initialiseSceneSaves,sceneSaveState} from '../build/sceneWorkflow.js';
import {evaluateTracks} from '../build/propertyTracks.js';
import {secondsFromDrag,slipOffsetFromDrag,insertBeforeFor} from '../build/journeyTimelineLayout.js';
import {DocumentStore} from '../build/store.js';
import {documentToChanges} from '../build/kernelExpressions.js';

// E04 insert / overwrite / still scene, E06 roll / slip, and the split interaction (a slipped scene's cut).
// Run after the bundle is emitted: this suite imports the build/ modules.

// Eight scenes of 14 s, with varied transitions and saved copies, so every move meets the fields a document carries.
function fixture(){const j=fieldStudies();j.scenes.forEach((s,i)=>{s.transition=1+(i%3)*.5;s.duration=14;});return initialiseSceneSaves(clone(j));}
function prng(seed){let a=seed>>>0;return()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};}
const E='expression:scene-moves';
const kernelDoc=j=>({schema:'oi.expression/v1',expression_ref:E,revision:1,title:j.name,
 scenes:j.scenes.map(s=>({scene_ref:`${E}:scene:${s.id}`,revision:1,title:s.name,entity_refs:[],presentation:{schema:'oi.journey-scene/v1',scene:clone(s),saved:null}})),
 entities:{},relations:{},selection:{scene_ref:`${E}:scene:${j.scenes[0].id}`,entity_ref:null},provenance:[],representations:[],refinements:[]});
const sum=j=>j.scenes.reduce((n,s)=>n+s.duration,0);
const digests=j=>Object.fromEntries(j.scenes.map(s=>[s.id,sceneContentDigest(s)]));
const TRACK=[{time:0,value:.2},{time:8,value:.9,type:'smooth'},{time:14,value:.4}];
const contrastAt=(scene,t)=>evaluateTracks(scene,t).field.params.contrast;

test('insert 1-2-A-3-4: A ripples in before 3, Σ durations is identical, and the kernel receipt is one scene_reorder listing every ref',()=>{
 const j=fixture();j.scenes=j.scenes.slice(0,5);
 const [one,two,three,four,A]=j.scenes;
 const pre=kernelDoc(clone(j)),sumBefore=sum(j);
 insertScene(j,A.id,three.id);
 assert.deepEqual(j.scenes.map(s=>s.id),[one.id,two.id,A.id,three.id,four.id]);
 assert.equal(sum(j),sumBefore,'Σ durations identical');
 const diff=documentToChanges(pre,kernelDoc(j));
 assert.equal(diff.error,undefined,'the insert is expressible');
 assert.deepEqual(diff.changes.map(c=>c.change),['scene_reorder']);
 assert.deepEqual(diff.changes[0].scene_refs,j.scenes.map(s=>`${E}:scene:${s.id}`));
});

test('insert boundaries: before itself or where it already stands changes nothing; to the end moves it last',()=>{
 const j=fixture();const [s0,s1,s2]=j.scenes;
 const start=JSON.stringify(j);
 insertScene(j,s1.id,s1.id);insertScene(j,s1.id,s2.id);
 assert.equal(JSON.stringify(j),start,'no-op');
 insertScene(j,s0.id,null);
 assert.equal(j.scenes.at(-1).id,s0.id);assert.equal(j.scenes.length,8);
});

test('overwrite: the target leaves and the source takes its slot, the source closes its old place, the saved copy goes, Σ falls by the target',()=>{
 const j=fixture();j.scenes=j.scenes.slice(0,5);const [s0,s1,s2,s3,s4]=j.scenes;
 const digestBefore=digests(j),sumBefore=sum(j),lost=s1.duration;
 overwriteScene(j,s4.id,s1.id);
 assert.deepEqual(j.scenes.map(s=>s.id),[s0.id,s4.id,s2.id,s3.id]);
 assert.equal(sum(j),sumBefore-lost,'Σ falls by the target duration');
 assert.equal(j.savedScenes[s1.id],undefined,'the target saved copy goes');
 const after=digests(j);
 for(const id of [s0.id,s2.id,s3.id,s4.id])assert.equal(after[id],digestBefore[id],`content of ${id} unchanged`);
 assert.throws(()=>overwriteScene(j,s2.id,s2.id),/itself/);
});

test('a still scene is a normal scene for a timed void: one held frame, no automation, no entities, and the document validates',()=>{
 const j=fixture();const st=stillScene();
 assert.deepEqual(st.entities,[]);assert.deepEqual(st.automation,[]);assert.equal(st.field.params.count,4000);
 j.scenes.splice(2,0,st);
 assert.equal(validateJourney(clone(j)).scenes[2].id,st.id);
});

test('roll conserves Σ exactly and keeps both sides in the timing bounds (200 seeded cases)',()=>{
 const rnd=prng(7);
 for(let seed=0;seed<200;seed++){
  const j=fixture();const i=Math.floor(rnd()*7);
  const pick=()=>{const u=rnd();return u<.15?1:u<.3?3600:1+Math.floor(rnd()*400);};
  j.scenes[i].duration=pick();j.scenes[i+1].duration=pick();
  const left=j.scenes[i].duration,right=j.scenes[i+1].duration,total=sum(j),dBefore=digests(j);
  const seconds=Math.round(rnd()*8000-4000);
  const r=rollSceneSeam(j,j.scenes[i].id,seconds);
  const L=j.scenes[i].duration,R=j.scenes[i+1].duration;
  assert.equal(L+R,left+right,`seed ${seed}: the two sides keep their sum`);
  assert.equal(sum(j),total,`seed ${seed}: Σ of the Expression conserved`);
  assert.ok(L>=1&&L<=3600&&R>=1&&R<=3600,`seed ${seed}: both sides within the bounds`);
  assert.equal(L-left,r.seconds,`seed ${seed}: left moved by the applied seconds`);
  assert.equal(right-R,r.seconds,`seed ${seed}: right moved by the negative`);
  if(r.clamped===null)assert.equal(r.seconds,seconds,`seed ${seed}: an unclamped roll applies in full`);
  assert.deepEqual(digests(j),dBefore,`seed ${seed}: no content changes`);
 }
});

test('roll on the .1 s grid stops at the limit it reaches and reports which limit',()=>{
 const j=fixture();j.scenes[1].duration=12.3;j.scenes[2].duration=7.4;
 const r=rollSceneSeam(j,j.scenes[1].id,0.7);
 assert.ok(Math.abs(j.scenes[1].duration+j.scenes[2].duration-(12.3+7.4))<1e-9,'sum conserved to float precision');
 assert.equal(r.seconds,0.7);assert.equal(r.clamped,null);
 const low=rollSceneSeam(j,j.scenes[1].id,-100);
 assert.equal(low.clamped,'min');
 assert.ok(Math.abs(j.scenes[1].duration-1)<1e-9,'the left stops at one second');
 assert.throws(()=>rollSceneSeam(j,j.scenes.at(-1).id,1),/no scene after/);
 assert.deepEqual(seamRollRange(1,1),{min:0,max:0});
});

test('slip renders the same evaluated values at the same evolution point: after a slip of e, local t reads the original at t + e',()=>{
 const j=fixture();const s=j.scenes[2];
 s.propertyTracks=[{id:'trk-contrast',bind:'field.params.contrast',points:clone(TRACK)}];
 const orig=clone(j),e=3;
 slipScene(j,s.id,e);
 assert.equal(j.scenes[2].entryOffset,e);
 const origScene=orig.scenes[2],slipped=j.scenes[2];
 assert.notEqual(contrastAt(origScene,1),contrastAt(origScene,6),'the track moves, so the check is not vacuous');
 for(let t=0;t<14;t+=.5)assert.equal(contrastAt(slipped,t),contrastAt(origScene,t+e),`local ${t}`);
 assert.equal(sceneContentDigest(slipped),sceneContentDigest(origScene),'a slip is a timeline fact: no content changes');
});

test('slip is refused outside the scene; 0 removes the field; the document accepts 0 to the scene maximum and nothing more',()=>{
 const j=fixture();const s=j.scenes[0];
 assert.throws(()=>slipScene(j,s.id,14),/0 up to 14/);
 assert.throws(()=>slipScene(j,s.id,-0.1));
 slipScene(j,s.id,5);slipScene(j,s.id,0);
 assert.equal('entryOffset' in j.scenes[0],false);
 const v=clone(j);
 v.scenes[0].entryOffset=3600;validateJourney(clone(v));
 v.scenes[0].entryOffset=3601;assert.throws(()=>validateJourney(clone(v)),/entry offset/);
 v.scenes[0].entryOffset=-1;assert.throws(()=>validateJourney(clone(v)),/entry offset/);
});

test('a split of a slipped scene: the left keeps its evolution, and the right continues from the cut with no offset',()=>{
 const j=fixture();const s=j.scenes[2];
 s.propertyTracks=[{id:'trk-contrast',bind:'field.params.contrast',points:clone(TRACK)}];
 const e=3,cutAt=5;
 const orig=clone(j).scenes[2];   // the unslipped reference: the scene's own evolution
 slipScene(j,s.id,e);
 splitScene(j,s.id,cutAt,'slip-split');
 const left=j.scenes[2],right=j.scenes[3];
 assert.equal(left.entryOffset,e);
 assert.equal('entryOffset' in right,false,'the right starts its evolution at the cut');
 for(let u=0;u<cutAt;u+=.5)assert.ok(Math.abs(contrastAt(left,u)-contrastAt(orig,u+e))<1e-9,`left local ${u}`);
 for(let u=0;u<14-cutAt;u+=.5)assert.ok(Math.abs(contrastAt(right,u)-contrastAt(orig,cutAt+e+u))<1e-9,`right local ${u}`);
});

test('each gesture is one labelled undo entry; a refused roll records none; undo restores the document byte-equal',()=>{
 const j=fixture();const store=new DocumentStore(j);
 const start=JSON.stringify(store.document);
 const ids=store.document.scenes.map(s=>s.id);
 const gestures=[
  ['Insert scene a',d=>insertScene(d,ids[7],ids[2])],
  ['Overwrite scene b',d=>overwriteScene(d,ids[6],ids[3])],
  ['Roll seam after c',d=>rollSceneSeam(d,ids[0],2)],
  ['Slip scene d',d=>slipScene(d,ids[4],4)],
 ];
 let n=0;
 for(const [label,fn] of gestures){
  const before=JSON.stringify(store.document);
  store.composite(label,fn);n++;
  assert.equal(store.undoStack.length,n,`${label}: one entry`);
  assert.equal(store.undoStack.at(-1).label,label);
  assert.notEqual(JSON.stringify(store.document),before,`${label}: changed the document`);
 }
 assert.throws(()=>store.composite('Roll seam x',d=>rollSceneSeam(d,store.document.scenes.at(-1).id,1)));
 assert.equal(store.undoStack.length,n,'a refused roll records no entry');
 for(let k=0;k<n;k++)assert.equal(store.undo(),true);
 assert.equal(JSON.stringify(store.document),start,'undo restores byte-equal');
});

test('kernel receipts: a slip is one scene_material_set on that scene; a roll touches exactly its two scenes',()=>{
 const j=fixture();const ids=j.scenes.map(s=>s.id);
 const pre=kernelDoc(clone(j));
 slipScene(j,ids[4],4);
 const slipDiff=documentToChanges(pre,kernelDoc(j));
 assert.equal(slipDiff.error,undefined);
 assert.deepEqual(slipDiff.changes.filter(c=>c.change==='scene_material_set').map(c=>c.scene_ref),[`${E}:scene:${ids[4]}`]);
 const pre2=kernelDoc(clone(j));
 rollSceneSeam(j,ids[1],2);
 const rollDiff=documentToChanges(pre2,kernelDoc(j));
 assert.equal(rollDiff.error,undefined);
 assert.deepEqual(rollDiff.changes.filter(c=>c.change==='scene_material_set').map(c=>c.scene_ref).sort(),[`${E}:scene:${ids[1]}`,`${E}:scene:${ids[2]}`].sort());
});

test('entryOffset is a timeline fact: a slipped scene keeps its save, and a content edit still shows',()=>{
 const j=fixture();
 assert.equal(sceneSaveState(j,j.scenes[1]),'Saved');
 slipScene(j,j.scenes[1].id,4);
 assert.equal(sceneSaveState(j,j.scenes[1]),'Saved');
 j.scenes[1].name+='!';
 assert.equal(sceneSaveState(j,j.scenes[1]),'Edited since save');
});

test('the drag helpers: seconds on the layout clock, the slip offset on [0, duration), and the insert side of a drop',()=>{
 assert.equal(secondsFromDrag(2,100,50),1);
 assert.equal(secondsFromDrag(0.02,100,50),0,'under 0.05 s is no move');
 assert.equal(secondsFromDrag(0.5,100,50),0.3,'a quarter second rounds to the .1 grid');
 assert.equal(slipOffsetFromDrag(3,-100,100,10,14),13,'dragging left shows later content: the offset rises');
 assert.equal(slipOffsetFromDrag(3,1000,100,10,14),0,'a drag past the start stops at 0');
 assert.equal(slipOffsetFromDrag(3,1000000,100,10,14),0);
 assert.equal(slipOffsetFromDrag(20,0,100,10,14),13.9,'an unmoved offset is kept, within the duration');
 const scenes=[{id:'a'},{id:'b'},{id:'c'}];
 assert.equal(insertBeforeFor(scenes,'b',false),'b','left half: before the clip');
 assert.equal(insertBeforeFor(scenes,'b',true),'c','right half: before the next clip');
 assert.equal(insertBeforeFor(scenes,'c',true),null,'right half of the last: at the end');
});
