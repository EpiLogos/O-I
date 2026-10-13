// Lane-5 T6–T8 (journey path): the seam's blend as the strip draws it, its live state on the one expression clock, the walked
// journey path, and the overlap a blend drag authors. Run after `npm run build` (this suite imports the bundled build/ modules).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {
 seamLabel,seamBlends,blendLimit,blendLimitMessage,seamStates,seamCaption,seamBlendHTML,walkJourney,formatSeconds,
} from '../build/journeyPath.js';
import {journeyTimelineLayout,overlapFromDrag} from '../build/journeyTimelineLayout.js';
import {expressionTiming} from '../build/propertyTracks.js';
import {SCENE_TRANSITION_MAX} from '../build/model.js';
import {fieldStudies} from '../build/model.js';
import {DocumentStore} from '../build/store.js';
import {applyTimelineMove} from '../build/sceneWorkflow.js';
import {writeSeamTransition} from '../build/transitions.js';

// Clock: 12 s, 4 s, 30 s, 1.5 s, 8 s → starts 0, 12, 16, 46, 47.5; total 55.5.
// Seams: scene 1 crossfade 1.5 s (default, absent spec); scene 2 dip-to-colour 2 s; scene 3 a cut of 1 s (no blend);
// scene 4 wipe of 3 s into its 8 s head. Scene 0 has no seam.
const journey={schema:'oi.journey',version:1,id:'fixture',name:'Fixture',description:'',loop:false,updatedAt:'',
 scenes:[
  {id:'s0',name:'Scene 0',duration:12,transition:0},
  {id:'s1',name:'Scene 1',duration:4,transition:1.5},
  {id:'s2',name:'Scene 2',duration:30,transition:2,transitionSpec:{kind:'dip-to-colour',at:.5}},
  {id:'s3',name:'Scene 3',duration:1.5,transition:1,transitionSpec:{kind:'cut'}},
  {id:'s4',name:'Scene 4',duration:8,transition:3,transitionSpec:{kind:'wipe',direction:'left'}},
 ]};
const timing=(index,local)=>expressionTiming(journey,index,local);
const TOTAL=55.5;

test('a seam caption is its kind and seconds, or "Cut" for a cut kind or zero seconds', ()=>{
 assert.equal(seamLabel(undefined,1.5),'Crossfade · 1.5 s');
 assert.equal(seamLabel({kind:'dip-to-colour',at:.5},2),'Dip to colour · 2.0 s');
 assert.equal(seamLabel({kind:'wipe',direction:'left'},.8),'Wipe · 0.8 s');
 assert.equal(seamLabel({kind:'cut'},3),'Cut');
 assert.equal(seamLabel(undefined,0),'Cut');
 assert.equal(formatSeconds(3),'3.0 s');
});

test('a seam blends only when its kind is a blend and it lasts time', ()=>{
 assert.equal(seamBlends(undefined,1.5),true);
 assert.equal(seamBlends({kind:'wipe',direction:'up'},.1),true);
 assert.equal(seamBlends({kind:'cut'},1.5),false);
 assert.equal(seamBlends(undefined,0),false);
});

test('the blend limit is the incoming scene\'s length, bounded by the transition maximum, and the limit is named', ()=>{
 assert.equal(blendLimit(12),12);
 assert.equal(blendLimit(45),SCENE_TRANSITION_MAX);
 assert.match(blendLimitMessage(3),/^A blend stops at 3\.0 s, the length of the scene it enters\.$/);
 assert.match(blendLimitMessage(SCENE_TRANSITION_MAX),/^A blend stops at 30 seconds, the longest a transition lasts\.$/);
});

test('an overlap drag authors seconds on the layout clock: a 10 px move is 1 s here, on the .1 s grid', ()=>{
 const layout=journeyTimelineLayout(journey.scenes,timing,100);
 assert.ok(Math.abs(layout.total-TOTAL)<1e-9);
 const track=555;
 assert.deepEqual(overlapFromDrag(1.5,12,layout,10,track),{seconds:2.5,clamped:null});
 assert.deepEqual(overlapFromDrag(1.5,12,layout,-10,track),{seconds:.5,clamped:null});
 assert.deepEqual(overlapFromDrag(1.5,12,layout,1,track),{seconds:1.6,clamped:null});
});

test('an overlap drag keeps its value under 0.05 s, and stops at a cut and at its limit with a named clamp', ()=>{
 const layout=journeyTimelineLayout(journey.scenes,timing,100);
 const track=555;
 assert.deepEqual(overlapFromDrag(.37,12,layout,.01,track),{seconds:.37,clamped:null});
 assert.deepEqual(overlapFromDrag(1.5,12,layout,-30,track),{seconds:0,clamped:'min'});
 assert.deepEqual(overlapFromDrag(1.5,12,layout,200,track),{seconds:12,clamped:'max'});
 assert.throws(()=>overlapFromDrag(1,Number.NaN,layout,5,track),/no blend limit/);
});

test('a seam\'s live state is the fraction of its blend in force on the expression clock, half-open at its end', ()=>{
 const at=t=>seamStates(journey.scenes,timing,t);
 assert.equal(at(12)[1].fraction,0);
 assert.equal(at(12.75)[1].fraction,.5);
 assert.equal(at(13.5)[1].fraction,null);
 assert.equal(at(17)[2].fraction,.5);
 assert.equal(at(46.5)[3].fraction,null);
 assert.equal(at(3)[0].blends,false);
 assert.equal(at(0)[0].fraction,null);
 assert.ok(Math.abs(at(49.5)[4].fraction-2/3)<1e-9);
 assert.equal(at(50.5)[4].fraction,null);
});

test('a blend is capped at the length of the scene it enters, on the live edge as well as the band', ()=>{
 const short={schema:'oi.journey',version:1,id:'short',name:'Short',description:'',loop:false,updatedAt:'',scenes:[
  {id:'a',name:'A',duration:4,transition:0},
  {id:'b',name:'B',duration:1.5,transition:3},
 ]};
 const t=(i,l)=>expressionTiming(short,i,l);
 assert.ok(Math.abs(seamStates(short.scenes,t,5)[1].fraction-1/1.5)<1e-9);
 assert.equal(seamStates(short.scenes,t,5.5)[1].fraction,null);
});

test('the walked path lists every scene with its seam, the position, the blend in force, and the next scene', ()=>{
 const start=walkJourney(journey,timing,0);
 assert.equal(start.steps.length,5);
 assert.equal(start.total,TOTAL);
 assert.equal(start.steps[0].seam,null);
 assert.equal(start.steps[1].seam.label,'Crossfade · 1.5 s');
 assert.equal(start.steps[3].seam.blends,false);
 assert.equal(start.steps[3].seam.label,'Cut');
 assert.deepEqual(start.steps.map(s=>s.start),[0,12,16,46,47.5]);
 assert.deepEqual({index:start.position.index,local:start.position.local},{index:0,local:0});
 assert.equal(start.edge,null);
 assert.deepEqual(start.next,{index:1,name:'Scene 1',wraps:false});
});

test('the walked path names the blend in force from the scene before to the scene at the position', ()=>{
 const mid=walkJourney(journey,timing,12.75);
 assert.equal(mid.position.index,1);
 assert.ok(Math.abs(mid.position.local-.75)<1e-9);
 assert.deepEqual(mid.edge,{from:'Scene 0',to:'Scene 1',fraction:.5,label:'Crossfade · 1.5 s'});
 assert.equal(walkJourney(journey,timing,13.5).edge,null);
});

test('the walk ends at the journey end, and loops back to the first scene only when the journey loops', ()=>{
 const end=walkJourney(journey,timing,TOTAL);
 assert.equal(end.position.index,4);
 assert.equal(end.next,null);
 const looped=walkJourney({...journey,loop:true},timing,TOTAL);
 assert.deepEqual(looped.next,{index:0,name:'Scene 0',wraps:true});
 assert.equal(looped.loop,true);
});

test('a time past the journey stands at its end, and every seek lands on a scene start on the clock', ()=>{
 const past=walkJourney(journey,timing,100);
 assert.equal(past.position.time,TOTAL);
 assert.equal(past.position.index,4);
 const path=walkJourney(journey,timing,0);
 path.steps.forEach((step,index)=>assert.equal(step.start,timing(index,0).time));
});

test('an empty journey has no path and no position', ()=>{
 const empty={...journey,scenes:[]};
 const path=walkJourney(empty,(i,l)=>expressionTiming(empty,i,l),0);
 assert.equal(path.position,null);
 assert.equal(path.next,null);
 assert.deepEqual(path.steps,[]);
});

test('the seam caption names both scenes and the percentage while a blend is in force', ()=>{
 assert.equal(seamCaption('Scene 0',journey.scenes[1],.25),'Scene 0 → Scene 1 · 25%');
 assert.equal(seamCaption('Scene 0',journey.scenes[1],null),'Crossfade · 1.5 s');
 assert.equal(seamCaption(undefined,journey.scenes[1],.25),'Crossfade · 1.5 s');
});

test('the strip\'s blend band exists only for a blend, its fraction is on the band, and names are escaped', ()=>{
 const blending=seamBlendHTML(journey.scenes[0],journey.scenes[1],12,1.5/TOTAL*100,.5);
 assert.match(blending,/data-seam-band data-scene-id="s1" data-blending="true"/);
 assert.match(blending,/--blend-progress:0\.5000/);
 assert.match(blending,/Scene 0 → Scene 1 · 50%/);
 const cut=seamBlendHTML(journey.scenes[0],journey.scenes[3],46,1/TOTAL*100,null);
 assert.doesNotMatch(cut,/data-seam-band/);
 assert.match(cut,/>Cut</);
 const hostile={...journey.scenes[1],name:'<img src=x>'};
 const escaped=seamBlendHTML({name:'<b>'},hostile,12,1,.5);
 assert.doesNotMatch(escaped,/<img/);
 assert.match(escaped,/&lt;img/);
 assert.match(escaped,/&lt;b&gt;/);
});

test('a blend commit is one labelled undo step through the guarded seam write, and undo restores the seam', ()=>{
 const store=new DocumentStore(fieldStudies());
 const target=store.document.scenes[1];
 const before={transition:target.transition,spec:target.transitionSpec};
 store.change(`Set blend into ${target.name}`,d=>applyTimelineMove(d,scenes=>writeSeamTransition(scenes,target.id,undefined,2.5)));
 assert.equal(store.undoStack.length,1);
 assert.equal(store.undoLabel(),`Set blend into ${target.name}`);
 assert.equal(store.document.scenes[1].transition,2.5);
 assert.equal(store.undo(),true);
 assert.equal(store.document.scenes[1].transition,before.transition);
 assert.deepEqual(store.document.scenes[1].transitionSpec,before.spec);
});

const appSource=fs.readFileSync(new URL('../src/app.ts',import.meta.url),'utf8');
const pathSource=fs.readFileSync(new URL('../src/journeyPath.ts',import.meta.url),'utf8');
const require=createRequire(import.meta.url);
const ts=require('../../node_modules/typescript');
const sf=ts.createSourceFile('app.ts',appSource,ts.ScriptTarget.ES2022,true,ts.ScriptKind.TS);
const calleeName=call=>ts.isPropertyAccessExpression(call.expression)?call.expression.name.text:ts.isIdentifier(call.expression)?call.expression.text:null;
const enclosingCall=(node,name)=>{for(let p=node.parent;p;p=p.parent)if(ts.isCallExpression(p)&&calleeName(p)===name)return p;return null;};
const walk=(node,visit)=>{visit(node);ts.forEachChild(node,child=>walk(child,visit));};
const callsNamed=name=>{const found=[];walk(sf,n=>{if(ts.isCallExpression(n)&&calleeName(n)===name)found.push(n);});return found;};

test('journeyPath is pure: it touches no DOM global, so the node suite can load it', ()=>{
 assert.doesNotMatch(pathSource,/\b(document|window|HTMLElement|requestAnimationFrame)\b/);
});

test('every seam write in app.ts goes through the guarded timeline op inside one labelled change', ()=>{
 const writes=callsNamed('writeSeamTransition');
 assert.ok(writes.length>=2,'the seam chooser and the blend drag both write a seam');
 for(const call of writes){
  assert.ok(enclosingCall(call,'applyTimelineMove'),'writeSeamTransition must run inside applyTimelineMove');
  assert.ok(enclosingCall(call,'changed'),'writeSeamTransition must run inside a labelled change');
 }
});

test('the blend drag is wired: the seam glyph starts it, it authors through overlapFromDrag, and its edit is labelled', ()=>{
 assert.ok(callsNamed('overlapFromDrag').length>=1);
 assert.match(appSource,/closest<HTMLElement>\('\.seam-glyph'\)/);
 assert.match(appSource,/`Set blend into \$\{target\.name\}`/);
 assert.ok(callsNamed('paintSeamBlends').length>=1,'the live edge follows the playback clock');
 assert.match(appSource,/paintSeamBlends\(expressionTiming\(store\.document,sceneIndex,sceneElapsed,journeyPlaying\)\.time\)/);
});
