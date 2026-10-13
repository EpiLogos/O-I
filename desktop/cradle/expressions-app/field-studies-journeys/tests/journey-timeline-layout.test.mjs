// E01 (lane 3): the journey timeline layout reads the one clock, expressionTiming.
// Widths are proportional to scene durations; sceneAtTime agrees with the clock
// at every sampled instant, and with the playhead's own index walk (app.ts scrub
// handler) that the track's range input drives.
// Run after `npm run build` (this suite imports the bundled build/ modules).
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {journeyTimelineLayout,sceneAtTime} from '../build/journeyTimelineLayout.js';
import {expressionTiming} from '../build/propertyTracks.js';

const durations=[12,4,30,1.5,8];
const journey={schema:'oi.journey',version:1,id:'fixture',name:'Fixture',description:'',loop:false,updatedAt:'',
 scenes:durations.map((duration,i)=>({id:`scene_${i}`,name:`Scene ${i}`,duration}))};
const timing=(index,local)=>expressionTiming(journey,index,local);
const WIDTH=100;
const total=durations.reduce((n,d)=>n+d,0);
const layout=journeyTimelineLayout(journey.scenes,timing,WIDTH);

test('one clip per scene, in order, with the scene ref as its identity', ()=>{
 assert.equal(layout.clips.length,durations.length);
 assert.deepEqual(layout.clips.map(c=>c.sceneId),journey.scenes.map(s=>s.id));
 assert.equal(layout.total,total);
});

test('clip widths are proportional to durations and fill the track exactly', ()=>{
 let sum=0;
 layout.clips.forEach((clip,i)=>{
  assert.ok(Math.abs(clip.w-durations[i]/total*WIDTH)<1e-9,`width of ${clip.sceneId}`);
  assert.ok(Math.abs(clip.x-durations.slice(0,i).reduce((n,d)=>n+d,0)/total*WIDTH)<1e-9,`x of ${clip.sceneId}`);
  sum+=clip.w;
 });
 assert.ok(Math.abs(sum-WIDTH)<1e-9,'clips tile the whole track');
 // Unequal durations must give visibly unequal clip widths (the 30s scene vs the 1.5s scene).
 assert.ok(layout.clips[2].w>layout.clips[3].w*15,'the 30s clip is far wider than the 1.5s clip');
});

test('clip extents are the expressionTiming edges, not a second clock', ()=>{
 layout.clips.forEach((clip,i)=>{
  assert.equal(clip.start,timing(i,0).time);
  assert.equal(clip.end,timing(i,durations[i]).time);
 });
});

test('sceneAtTime agrees with expressionTiming at 200 sampled instants', ()=>{
 for(let k=0;k<200;k++){
  const t=total*k/199;
  const hit=sceneAtTime(layout,t);
  assert.ok(hit,`a scene at t=${t}`);
  const index=layout.clips.findIndex(c=>c.sceneId===hit.sceneId);
  assert.ok(index>=0);
  assert.ok(hit.local>=-1e-12&&hit.local<=durations[index]+1e-12,`local in scene at t=${t}`);
  assert.ok(Math.abs(timing(index,hit.local).time-t)<1e-9,`expressionTiming round-trips t=${t}`);
 }
});

test('sceneAtTime picks the scene the playhead index walk picks (app.ts scrub handler)', ()=>{
 for(let k=0;k<200;k++){
  const t=total*k/199;
  let value=t,index=0;
  while(index<durations.length-1&&value>=durations[index]){value-=durations[index];index++;}
  assert.equal(sceneAtTime(layout,t).sceneId,journey.scenes[index].id,`scene at t=${t}`);
 }
});

test('boundaries belong to the scene they start; the end instant to the last scene', ()=>{
 layout.clips.forEach((clip,i)=>{
  const hit=sceneAtTime(layout,clip.start);
  assert.equal(hit.sceneId,clip.sceneId);
  assert.ok(Math.abs(hit.local)<1e-12);
 });
 const last=sceneAtTime(layout,total);
 assert.equal(last.sceneId,journey.scenes.at(-1).id);
 assert.ok(Math.abs(last.local-durations.at(-1))<1e-9);
});

test('times outside the expression clamp to its first and last instants', ()=>{
 assert.deepEqual(sceneAtTime(layout,-5),{sceneId:'scene_0',local:0});
 const after=sceneAtTime(layout,total+10);
 assert.equal(after.sceneId,'scene_4');
 assert.ok(Math.abs(after.local-8)<1e-9);
});

test('an empty expression has no clips and no scene at any time', ()=>{
 const empty=journeyTimelineLayout([],timing,WIDTH);
 assert.deepEqual(empty,{clips:[],total:0});
 assert.equal(sceneAtTime(empty,0),undefined);
});

test('app.ts renders the track from this layout and keeps the scene-ref addressing', ()=>{
 const src=readFileSync(new URL('../src/app.ts',import.meta.url),'utf8');
 assert.match(src,/import \{journeyTimelineLayout\} from '\.\/journeyTimelineLayout'/);
 assert.match(src,/data-action="choose-scene" data-index="\$\{i\}" data-scene-id="\$\{esc\(v\.id\)\}"/);
 assert.match(src,/id="expression-playhead"/);
});
