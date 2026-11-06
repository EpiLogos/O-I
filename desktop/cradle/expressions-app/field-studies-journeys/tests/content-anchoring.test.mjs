import test from 'node:test';
import assert from 'node:assert/strict';
import {fieldStudies,validateJourney,clone} from '../build/model.js';
import * as workflow from '../build/sceneWorkflow.js';
const {retimeScene,rollSceneSeam,slideScene,slipScene,splitScene,trimSceneStart,initialiseSceneSaves}=workflow;

// DLW build ruling 2026-11-06 (O-I #747, round 883; manual §20.1 "you cut on it as a video editor does", §16.6's table): any cut that
// moves a scene's start edge moves its entry into its own content with it, so what plays at each second on the ruler stays where it was
// — a start-edge trim, the later side of a roll, the scene after a slide. Only Slip moves the content under fixed edges; an end edge never
// moves it. A scene has no content before its own start: a roll or a slide that would ask for some stops at that limit and says why.
// Run after the bundle is emitted: this suite imports the build/ modules.

/** Eight scenes of 14 s, as scene-moves.test.mjs builds them. */
function fixture(){const j=fieldStudies();j.scenes.forEach(s=>{s.transition=1;s.duration=14;});return initialiseSceneSaves(clone(j));}
/** What plays at ruler second x, the scenes laid end to end: the scene there and the second of its own content it shows. */
function playsAt(j,x){let start=0;for(const s of j.scenes){if(x<start+s.duration)return {id:s.id,content:Math.round((x-start+(s.entryOffset??0))*1e6)/1e6};start+=s.duration;}return null;}
const total=j=>j.scenes.reduce((n,s)=>n+s.duration,0);
/** A roll, a slide or a split keeps every edge but the ones it moves: each quarter second a scene still covers shows the second of its
 * content it showed (a slide's own scene excepted, whose content goes with it). */
function anchored(before,after,label,except=null){
 let compared=0;
 for(let x=.125;x<total(before);x+=.25){const a=playsAt(before,x),b=playsAt(after,x);if(a&&b&&a.id===b.id&&a.id!==except){compared++;assert.equal(b.content,a.content,`${label}: at ${x} s ${a.id} shows its ${a.content} s`);}}
 assert.ok(compared>100,`${label}: compared ${compared} points`);
}
/** A trim takes `seconds` off the ruler at ruler second `at` and what follows closes up (scenes lie end to end): every second before the
 * cut plays what it played, and every second after it plays what played `seconds` later. Nothing else moves. */
function rippled(before,after,at,seconds,label){
 assert.equal(total(after),total(before)-seconds,`${label}: the ruler is ${seconds} s shorter`);
 for(let x=.125;x<total(after);x+=.25)assert.deepEqual(playsAt(after,x),playsAt(before,x<at?x:x+seconds),`${label}: at ${x} s`);
}
const ids=j=>j.scenes.map(s=>s.id);
const LASTS='The cut stops here: a scene lasts 1 to 3600 seconds.';

test('a roll later: the scene after starts as much later in its own content, so every second shows what it showed',()=>{
 const j=fixture(),before=clone(j),[a,b]=ids(j);
 const rolled=rollSceneSeam(j,a,3);
 anchored(before,j,'roll later');
 assert.deepEqual(rolled,{seconds:3,clamped:null,why:null});
 assert.deepEqual([j.scenes[0].duration,j.scenes[1].duration,j.scenes[1].entryOffset],[17,11,3]);
 assert.equal(j.scenes[0].entryOffset,undefined,'the scene before keeps its entry: only its end moved');
 assert.equal(b,j.scenes[1].id);
});

test('a roll earlier stops where the scene after has no content before its own start, and says so in plain words',()=>{
 const j=fixture(),[a,b]=ids(j);
 const none=rollSceneSeam(j,a,-2);
 assert.deepEqual([none.seconds,none.clamped],[0,'min']);
 assert.equal(none.why,`The cut stops here: ${j.scenes[1].name} has no content before its own start.`);
 assert.deepEqual([j.scenes[0].duration,j.scenes[1].duration],[14,14],'nothing moved');
 trimSceneStart(j,b,5);
 const before=clone(j),some=rollSceneSeam(j,a,-8);
 assert.deepEqual([some.seconds,some.clamped,some.why],[-5,'min',none.why],'it reaches back as far as the content trimmed off its start, and no further');
 anchored(before,j,'roll earlier');
 assert.deepEqual([j.scenes[0].duration,j.scenes[1].duration,j.scenes[1].entryOffset],[9,14,undefined],'entry back at its content\'s start: absent again');
 assert.deepEqual(workflow.rollLimits(fixture(),a),{min:0,max:13,minWhy:none.why,maxWhy:LASTS});
});

test('a slide keeps what the scenes either side show; the slid scene takes its own content with it',()=>{
 const j=fixture(),before=clone(j),[,b,c]=ids(j);
 const slid=slideScene(j,b,3);
 anchored(before,j,'slide later',b);
 assert.deepEqual(slid,{seconds:3,clamped:null,why:null});
 assert.deepEqual([j.scenes[0].duration,j.scenes[1].duration,j.scenes[2].duration,j.scenes[2].entryOffset],[17,14,11,3]);
 assert.equal(j.scenes[1].entryOffset,undefined,'the slid scene\'s own entry is unchanged: its content moves with it');
 const back=slideScene(j,b,-5);
 assert.deepEqual([back.seconds,back.clamped],[-3,'min'],'back as far as the scene after has content before its start');
 assert.equal(back.why,`The cut stops here: ${j.scenes[2].name} has no content before its own start.`);
 assert.deepEqual([j.scenes[0].duration,j.scenes[2].duration,j.scenes[2].entryOffset],[14,14,undefined]);
 assert.equal(c,j.scenes[2].id);
 assert.deepEqual(workflow.slideLimits(fixture(),b),{min:0,max:13,minWhy:back.why,maxWhy:LASTS});
});

test('an end edge never moves the content: a trim or a roll that ends a slipped scene before its entry keeps the entry',()=>{
 const j=fixture(),[a]=ids(j);
 slipScene(j,a,10);
 const before=clone(j);
 retimeScene(j,a,{duration:6});
 rippled(before,j,6,8,'end trim');
 assert.equal(j.scenes[0].entryOffset,10,'the entry stays: what plays in the six seconds left is what played there');
 assert.doesNotThrow(()=>validateJourney(clone(j)),'the document admits an entry past the scene\'s end');
 const k=fixture();slipScene(k,ids(k)[0],10);trimSceneStart(k,ids(k)[1],8);
 const rolled=clone(k);rollSceneSeam(k,ids(k)[0],-8);
 anchored(rolled,k,'roll earlier past the entry');
 assert.deepEqual([k.scenes[0].duration,k.scenes[0].entryOffset],[6,10]);
});

test('a start trim past half the scene keeps its content; past the document\'s bound it is refused in plain words',()=>{
 const j=fixture(),before=clone(j),[a]=ids(j);
 trimSceneStart(j,a,10);
 assert.deepEqual([j.scenes[0].duration,j.scenes[0].entryOffset],[4,10]);
 rippled(before,j,0,10,'start trim');
 assert.doesNotThrow(()=>validateJourney(clone(j)));
 const k=fixture();k.scenes[0].duration=3600;slipScene(k,ids(k)[0],3590);
 assert.throws(()=>trimSceneStart(k,ids(k)[0],20),/can start at most 3600 seconds into its own content/);
});

test('a split keeps what each half shows: the left keeps its entry, and the right\'s sequences start where the scene was in them',()=>{
 const seeded=()=>{const j=fixture(),e=j.scenes[2].entities[0],step=e.sequence.steps[0];
  e.sequence={...e.sequence,enabled:true,clock:'seconds',order:'loop',steps:['a','b','c','d'].map(id=>({...clone(step),id:`step-${id}`,hold:1.5,transition:.5}))};return j;};
 const slipped=seeded(),plain6=seeded(),plain2=seeded(),c=ids(slipped)[2];
 slipScene(slipped,c,4);
 const before=clone(slipped);
 splitScene(slipped,c,2,'cut-slipped');splitScene(plain6,c,6,'cut-6');splitScene(plain2,c,2,'cut-2');
 anchored(before,slipped,'split');
 assert.equal(slipped.scenes[2].entryOffset,4,'the left keeps its entry: it is shorter than its entry and still shows what it showed');
 const sequences=j=>j.scenes[3].entities.map(e=>e.sequence);
 assert.deepEqual(sequences(slipped),sequences(plain6),'the right of a scene slipped 4 s and cut at 2 s starts its sequences 6 s in');
 assert.notDeepEqual(sequences(plain6),sequences(plain2),'which differs from a cut 2 s in');
});
