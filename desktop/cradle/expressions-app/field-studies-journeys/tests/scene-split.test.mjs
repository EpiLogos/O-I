import test from 'node:test';
import assert from 'node:assert/strict';
import {fieldStudies,validateJourney,clone,sceneContentDigest} from '../build/model.js';
import {splitScene,applyTimelineMove} from '../build/sceneWorkflow.js';
import {valueAt} from '../build/propertyTracks.js';
import {DocumentStore} from '../build/store.js';
import {documentToChanges} from '../build/kernelExpressions.js';

// E07: split a scene at the playhead. The left keeps the scene's ref and its content before the
// cut; the right is a new Scene with the rest. Every curve evaluates to the original on both sides
// (E08 interpolation types included), durations sum to the original, other scenes are untouched,
// a refusal leaves the document byte-equal, and the whole split is one composite.

const near=(a,b,message)=>assert.ok(Math.abs(a-b)<1e-9,`${message}: ${a} vs ${b}`);
// Every fixture scene lasts 6 s, so the cut positions used below are inside it; durations are timeline facts, not content.
function fixture(){const j=fieldStudies();j.scenes.forEach((s,i)=>{s.transition=1+(i%3)*.5;s.duration=6;});return clone(j);}
const TRACK_CASES={
 linear:{points:[{time:0,value:2},{time:6,value:10}]},
 hold:{points:[{time:0,value:2,type:'hold'},{time:6,value:10}]},
 smooth:{points:[{time:0,value:2,type:'smooth'},{time:6,value:10}]},
 bezier:{points:[{time:0,value:2,type:'bezier',out:{dt:2,dv:9}},{time:6,value:10,in:{dt:-3,dv:-1}}]},
 bezierDefaultHandles:{points:[{time:0,value:2,type:'bezier'},{time:6,value:10}]},
};
// Golden values at the cut t = 4, computed by hand from the authored curves.
const GOLDEN_AT_CUT={linear:22/3,hold:2,smooth:214/27,bezier:null,bezierDefaultHandles:null};

test('continuity: each interpolation type evaluates as the original on both sides of the cut',()=>{
 for(const [kind,c] of Object.entries(TRACK_CASES)){
  const j=fixture();const s=j.scenes[0];s.duration=10;s.propertyTracks=[{id:'t',bind:'field.params.glow',points:clone(c.points)}];
  const original=clone(s.propertyTracks[0].points);
  splitScene(j,s.id,4,'split-continuity');
  const left=j.scenes[0].propertyTracks[0].points,right=j.scenes[1].propertyTracks[0].points;
  for(let t=0;t<4;t+=.37)near(valueAt(left,t),valueAt(original,t),`${kind} left at ${t}`);
  for(let t=0;t<6;t+=.41)near(valueAt(right,t),valueAt(original,4+t),`${kind} right at ${t}`);
  assert.ok(Math.abs(valueAt(left,4-1e-6)-valueAt(right,1e-6))<1e-5,`${kind} value meets across the cut`);
  if(GOLDEN_AT_CUT[kind]!==null&&GOLDEN_AT_CUT[kind]!==undefined)near(valueAt(right,0),GOLDEN_AT_CUT[kind],`${kind} golden value at the cut`);
  assert.doesNotThrow(()=>validateJourney(clone(j)),`${kind}: the split journey validates`);
 }
});

test('golden: smoothstep and hold values at the cut and past it',()=>{
 const smooth=fixture();smooth.scenes[0].duration=10;smooth.scenes[0].propertyTracks=[{id:'t',bind:'field.params.glow',points:clone(TRACK_CASES.smooth.points)}];
 splitScene(smooth,smooth.scenes[0].id,3,'split-smooth');
 // The original smoothstep at 4.5 (s = 0.75) is 2 + 8 * (3·0.5625 − 2·0.421875) = 8.75; the right is local 1.5.
 near(valueAt(smooth.scenes[1].propertyTracks[0].points,1.5),8.75,'smooth golden at local 1.5 on the right');
 const hold=fixture();hold.scenes[0].duration=10;hold.scenes[0].propertyTracks=[{id:'t',bind:'field.params.glow',points:clone(TRACK_CASES.hold.points)}];
 splitScene(hold,hold.scenes[0].id,4,'split-hold');
 const held=hold.scenes[1].propertyTracks[0].points;
 near(valueAt(held,1.9),2,'hold holds the start value until the next keyframe');
 near(valueAt(held,2),10,'hold reaches the next keyframe at the same global time');
});

test('a cut on an existing keyframe keeps that keyframe on both sides',()=>{
 const j=fixture();const s=j.scenes[0];s.duration=8;s.propertyTracks=[{id:'t',bind:'field.params.glow',points:[{time:0,value:1},{time:4,value:5},{time:8,value:9}]}];
 splitScene(j,s.id,4,'split-keyframe');
 const left=j.scenes[0].propertyTracks[0].points,right=j.scenes[1].propertyTracks[0].points;
 assert.deepEqual(left.map(p=>[p.time,p.value]),[[0,1],[4,5]]);
 assert.deepEqual(right.map(p=>[p.time,p.value]),[[0,5],[4,9]]);
});

test('a cut after the last keyframe holds that value on both sides',()=>{
 const j=fixture();const s=j.scenes[0];s.duration=10;s.propertyTracks=[{id:'t',bind:'field.params.glow',points:[{time:0,value:1},{time:2,value:3}]}];
 splitScene(j,s.id,5,'split-hold-tail');
 const left=j.scenes[0].propertyTracks[0].points,right=j.scenes[1].propertyTracks[0].points;
 for(let t=0;t<5;t+=.7)near(valueAt(left,t),valueAt(clone(s.propertyTracks[0].points),t),`left at ${t}`);
 for(let t=0;t<5;t+=.7)near(valueAt(right,t),3,`right holds the last value at ${t}`);
});

test('a track that starts after the cut moves whole to the right, re-based',()=>{
 const j=fixture();const s=j.scenes[0];s.duration=10;s.propertyTracks=[{id:'t',bind:'field.params.glow',points:[{time:6,value:1},{time:8,value:3}]}];
 splitScene(j,s.id,4,'split-late-track');
 assert.equal(j.scenes[0].propertyTracks,undefined,'the left has no point to carry');
 assert.deepEqual(j.scenes[1].propertyTracks[0].points.map(p=>[p.time,p.value]),[[2,1],[4,3]]);
});

test('durations sum to the original, the right is named, and the right starts with no transition',()=>{
 const j=fixture();const before=clone(j);const original=j.scenes[1];const total=j.scenes.reduce((n,v)=>n+v.duration,0);
 splitScene(j,original.id,1.5,'split-durations');
 const [left,right]=[j.scenes[1],j.scenes[2]];
 assert.equal(left.id,original.id,'the left keeps the scene ref');
 assert.equal(left.duration,1.5);
 assert.equal(right.id,'split-durations');
 assert.equal(right.name,`${original.name} / split`);
 assert.equal(right.transition,0,'a true cut: no transition into the right');
 assert.equal(left.transition,before.scenes[1].transition,'the left keeps the transition into it');
 near(j.scenes.reduce((n,v)=>n+v.duration,0),total,'durations sum to the original');
 assert.equal(right.duration,original.duration-1.5);
 assert.doesNotThrow(()=>validateJourney(clone(j)));
});

test('every other scene keeps its content digest',()=>{
 const j=fixture();const before=new Map(j.scenes.map(s=>[s.id,sceneContentDigest(s)]));const target=j.scenes[2].id;
 splitScene(j,target,2,'split-identity');
 for(const s of j.scenes){if(s.id===target||s.id==='split-identity')continue;assert.equal(sceneContentDigest(s),before.get(s.id),`scene ${s.id}`);}
});

test('a cut within one second of an edge, or outside the scene, is refused and the document is unchanged',()=>{
 const j=fixture();const s=j.scenes[0];s.duration=6;const before=JSON.stringify(j);
 for(const at of [0,.5,.999,5.001,6,7,-1,NaN,Infinity]){
  assert.throws(()=>splitScene(j,s.id,at,'split-refused'),/edge|inside the scene|at least/,`cut at ${at}`);
  assert.equal(JSON.stringify(j),before,`cut at ${at} left the document untouched`);
 }
 assert.doesNotThrow(()=>splitScene(clone(j),s.id,1,'split-min-left'),'exactly 1 s on the left is allowed');
 assert.doesNotThrow(()=>splitScene(clone(j),s.id,5,'split-min-right'),'exactly 1 s on the right is allowed');
});

test('a new scene id that another scene uses is refused',()=>{
 const j=fixture();const before=JSON.stringify(j);
 assert.throws(()=>splitScene(j,j.scenes[0].id,2,j.scenes[1].id),/no other scene uses/);
 assert.equal(JSON.stringify(j),before);
});

test('sequence: the left keeps its steps; the looping right starts its cycle at the step the clock is in at the cut',()=>{
 const j=fixture();const s=j.scenes.find(v=>v.entities.length>0);assert.ok(s,'a fixture scene with an entity');
 s.duration=12;
 const template=clone(s.entities[0].sequence.steps[0]);
 const step=(id)=>({...clone(template),id,hold:1,transition:1});
 s.entities[0].sequence={...clone(s.entities[0].sequence),enabled:true,manual:false,clock:'seconds',order:'loop',jitter:0,rateMul:1,phaseOffset:0,steps:[step('A'),step('B'),step('C')]};
 splitScene(j,s.id,5,'split-sequence');
 const left=j.scenes.find(v=>v.id===s.id),right=j.scenes.find(v=>v.id==='split-sequence');
 const leftEntity=left.entities.find(e=>e.id===s.entities[0].id),rightEntity=right.entities.find(e=>e.id===s.entities[0].id);
 assert.deepEqual(leftEntity.sequence.steps.map(k=>k.id),['A','B','C'],'the left plays the sequence as before');
 // Period 2 s per step, cut at 5 s: 5 falls in step C (4–6 s), so the right cycle starts at C.
 assert.deepEqual(rightEntity.sequence.steps.map(k=>k.id),['C','A','B']);
 assert.equal(rightEntity.sequence.phaseOffset,0);
});

test('sequence: a non-looping order keeps every step in its order on the right',()=>{
 const j=fixture();const s=j.scenes.find(v=>v.entities.length>0);s.duration=12;
 const template=clone(s.entities[0].sequence.steps[0]);
 const step=(id)=>({...clone(template),id,hold:1,transition:1});
 s.entities[0].sequence={...clone(s.entities[0].sequence),enabled:true,manual:false,clock:'seconds',order:'pingpong',jitter:0,steps:[step('A'),step('B'),step('C')]};
 splitScene(j,s.id,5,'split-pingpong');
 const right=j.scenes.find(v=>v.id==='split-pingpong');
 assert.deepEqual(right.entities.find(e=>e.id===s.entities[0].id).sequence.steps.map(k=>k.id),['A','B','C']);
});

test('documentToChanges of the split: one change list with scene_create, material sets and scene_reorder',()=>{
 const E='expression:scene-split';
 const kernelDoc=(j)=>({schema:'oi.expression/v1',expression_ref:E,revision:1,title:j.name,
  scenes:j.scenes.map(s=>({scene_ref:`${E}:scene:${s.id}`,revision:1,title:s.name,entity_refs:[],presentation:{schema:'oi.journey-scene/v1',scene:clone(s),saved:null}})),
  entities:{},relations:{},selection:{scene_ref:`${E}:scene:${j.scenes[0].id}`,entity_ref:null},provenance:[],representations:[],refinements:[]});
 const j=fixture();const pre=kernelDoc(j);
 const cut=clone(j);const target=cut.scenes[0];splitScene(cut,target.id,2,'split-kernel');
 const post=kernelDoc(cut);
 const diff=documentToChanges(pre,post);
 assert.equal(diff.error,undefined,'the split is expressible');
 const kinds=diff.changes.map(c=>c.change);
 assert.equal(kinds.filter(k=>k==='scene_create').length,1);
 assert.ok(diff.changes.some(c=>c.change==='scene_create'&&c.scene_ref===`${E}:scene:split-kernel`));
 const sets=diff.changes.filter(c=>c.change==='scene_material_set').map(c=>c.scene_ref).sort();
 assert.deepEqual(sets,[`${E}:scene:${target.id}`,`${E}:scene:split-kernel`].sort(),'material for the left and the new right, and no other scene');
 const reorder=diff.changes.find(c=>c.change==='scene_reorder');
 assert.ok(reorder,'the right sits between the left and the next scene: a reorder');
 assert.deepEqual(reorder.scene_refs,post.scenes.map(s=>s.scene_ref));
});

test('a split is one labelled undo entry; undo restores the document byte-equal',()=>{
 const j=fixture();const store=new DocumentStore(j);const before=JSON.stringify(store.document);const target=store.document.scenes[0];
 store.composite(`Split scene ${target.name}`,d=>{splitScene(d,target.id,2,'split-undo');});
 assert.equal(store.undoStack.length,1,'one entry');
 assert.equal(store.undoStack[0].label,`Split scene ${target.name}`);
 assert.equal(store.document.scenes.length,j.scenes.length+1);
 assert.equal(store.undo(),true);
 assert.equal(JSON.stringify(store.document),before,'undo restores the unsplit scene and its ref disappears');
 assert.equal(store.document.scenes.some(s=>s.id==='split-undo'),false);
});

test('a refused split inside a composite restores the document and records no entry',()=>{
 const j=fixture();const store=new DocumentStore(j);const before=JSON.stringify(store.document);const target=store.document.scenes[0];
 assert.throws(()=>store.composite('Split scene x',d=>{splitScene(d,target.id,0.5,'split-refused-composite');}),/edge/);
 assert.equal(store.undoStack.length,0);
 assert.equal(JSON.stringify(store.document),before);
});

test('the content guard exempts only the edited scene',()=>{
 const j=fixture();const [a,b]=[j.scenes[0].id,j.scenes[1].id];
 assert.throws(()=>applyTimelineMove(clone(j),scenes=>{scenes[1].name+='!';},a),/content of scene/,'another scene may not change');
 assert.doesNotThrow(()=>applyTimelineMove(clone(j),scenes=>{scenes[1].name+='!';},b),'the named scene may');
});
