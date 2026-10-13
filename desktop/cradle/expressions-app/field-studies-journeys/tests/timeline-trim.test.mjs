// E05 (lane 3): trim by dragging a clip's right edge. durationFromEdgeDrag turns
// a pixel drag into the scene's own duration on the layout's one clock; the
// timeline's live preview is that same clock run on the previewed document.
// Run after `npm run build` (this suite imports the bundled build/ modules).
import test from 'node:test';
import assert from 'node:assert/strict';
import {journeyTimelineLayout,sceneAtTime,durationFromEdgeDrag,SCENE_DURATION_MIN,SCENE_DURATION_MAX} from '../build/journeyTimelineLayout.js';
import {expressionTiming} from '../build/propertyTracks.js';
import {fieldStudies,validateJourney} from '../build/model.js';

const journeyOf=durations=>({schema:'oi.journey',version:1,id:'fixture',name:'Fixture',description:'',loop:false,updatedAt:'',
 scenes:durations.map((duration,i)=>({id:`scene_${i}`,name:`Scene ${i}`,duration}))});
const layoutOf=journey=>journeyTimelineLayout(journey.scenes,(index,local)=>expressionTiming(journey,index,local),100);

// 55.5 s across 555 px: 10 px is one second.
const durations=[12,4,30,1.5,8];
const TRACK=555;
const journey=journeyOf(durations);
const base=layoutOf(journey);

test('the clip carries its scene duration, read from the same clock as its edges', ()=>{
 assert.equal(base.total,55.5);
 base.clips.forEach((clip,i)=>{
  assert.equal(clip.duration,durations[i]);
  assert.ok(Math.abs(clip.end-clip.start-durations[i])<1e-9);
 });
});

test('a zero-length drag keeps the duration and reports no limit', ()=>{
 assert.deepEqual(durationFromEdgeDrag(base,'scene_2',0,TRACK),{duration:30,clamped:null});
});

test('a drag converts pixels to seconds on the layout clock, for any scene', ()=>{
 assert.deepEqual(durationFromEdgeDrag(base,'scene_0',100,TRACK),{duration:22,clamped:null});
 assert.deepEqual(durationFromEdgeDrag(base,'scene_2',-30,TRACK),{duration:27,clamped:null});
});

test('the result lands on the .1 s grid the Hold input steps by', ()=>{
 assert.deepEqual(durationFromEdgeDrag(base,'scene_0',3,TRACK),{duration:12.3,clamped:null});
 assert.deepEqual(durationFromEdgeDrag(base,'scene_0',-7,TRACK),{duration:11.3,clamped:null});
 for(let dx=-2000;dx<=2000;dx+=7){
  const {duration}=durationFromEdgeDrag(base,'scene_1',dx,TRACK);
  assert.ok(Math.abs(duration*10-Math.round(duration*10))<1e-9,`grid at dx=${dx}`);
 }
});

test('a move under 0.05 s keeps the original value, even off the grid', ()=>{
 const off=layoutOf(journeyOf([12.345,4]));
 // 16.345 s across 555 px: 1.5 px is 0.044 s (kept), 2 px is 0.059 s (applied and rounded).
 assert.deepEqual(durationFromEdgeDrag(off,'scene_0',1.5,TRACK),{duration:12.345,clamped:null});
 assert.deepEqual(durationFromEdgeDrag(off,'scene_0',2,TRACK),{duration:12.4,clamped:null});
});

test('dragging past one second stops at one second and names the limit', ()=>{
 assert.equal(SCENE_DURATION_MIN,1);
 assert.deepEqual(durationFromEdgeDrag(base,'scene_1',-5000,TRACK),{duration:1,clamped:'min'});
 assert.deepEqual(durationFromEdgeDrag(base,'scene_3',-40,TRACK),{duration:1,clamped:'min'});
});

test('dragging past 3600 s stops at 3600 s and names the limit', ()=>{
 assert.equal(SCENE_DURATION_MAX,3600);
 const long=layoutOf(journeyOf([3500,10]));
 assert.deepEqual(durationFromEdgeDrag(long,'scene_0',5000,TRACK),{duration:3600,clamped:'max'});
});

test('landing exactly on a limit is in range, not a clamp', ()=>{
 // 3510 s across 3510 px: one pixel is one second, so 100 px lands on 3600 s.
 const long=layoutOf(journeyOf([3500,10]));
 assert.deepEqual(durationFromEdgeDrag(long,'scene_0',100,3510),{duration:3600,clamped:null});
 assert.deepEqual(durationFromEdgeDrag(long,'scene_0',101,3510),{duration:3600,clamped:'max'});
});

test('every result stays inside the validated 1–3600 s range', ()=>{
 for(let dx=-6000;dx<=6000;dx+=13){
  const {duration}=durationFromEdgeDrag(base,'scene_0',dx,TRACK);
  assert.ok(duration>=SCENE_DURATION_MIN&&duration<=SCENE_DURATION_MAX,`in range at dx=${dx}`);
 }
});

test('an unknown scene or a track with no width is refused by name', ()=>{
 assert.throws(()=>durationFromEdgeDrag(base,'nope',5,TRACK),/no longer on the timeline/);
 assert.throws(()=>durationFromEdgeDrag(base,'scene_0',5,0),/no width/);
 assert.throws(()=>durationFromEdgeDrag(base,'scene_0',Number.NaN,TRACK),/no width/);
});

test('a previewed trim runs on the same clock: the track still tiles and sceneAtTime round-trips', ()=>{
 const drag=durationFromEdgeDrag(base,'scene_2',100,TRACK);
 assert.equal(drag.duration,40);
 const previewed={...journey,scenes:journey.scenes.map(s=>s.id==='scene_2'?{...s,duration:drag.duration}:s)};
 const layout=layoutOf(previewed);
 assert.equal(layout.total,65.5);
 assert.equal(layout.clips.find(c=>c.sceneId==='scene_2').duration,40);
 assert.deepEqual(layout.clips.filter(c=>c.sceneId!=='scene_2').map(c=>c.duration),[12,4,1.5,8]);
 assert.ok(Math.abs(layout.clips.reduce((n,c)=>n+c.w,0)-100)<1e-9,'clips tile the track');
 for(let k=0;k<200;k++){
  const t=layout.total*k/199;
  const hit=sceneAtTime(layout,t);
  const index=layout.clips.findIndex(c=>c.sceneId===hit.sceneId);
  assert.ok(Math.abs(expressionTiming(previewed,index,hit.local).time-t)<1e-9,`round-trip at t=${t}`);
 }
});

test('the Hold input and the timeline share one range rule: model validation mirrors the trim limits', ()=>{
 const low=fieldStudies();low.scenes[0].duration=SCENE_DURATION_MIN;assert.doesNotThrow(()=>validateJourney(low));
 const high=fieldStudies();high.scenes[0].duration=SCENE_DURATION_MAX;assert.doesNotThrow(()=>validateJourney(high));
 const under=fieldStudies();under.scenes[0].duration=0.9;assert.throws(()=>validateJourney(under),/Invalid or duplicate scene/);
 const over=fieldStudies();over.scenes[0].duration=SCENE_DURATION_MAX+1;assert.throws(()=>validateJourney(over),/Invalid or duplicate scene/);
});
