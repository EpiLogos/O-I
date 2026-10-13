import test from 'node:test';import assert from 'node:assert/strict';
import {valueAt,validateTracks} from '../build/propertyTracks.js';

// The legacy expression, copied verbatim from propertyTracks.ts before E08 landed.
function legacyValueAt(points,time){if(!points.length||time<points[0].time)return undefined;let i=points.findIndex(p=>p.time>time);if(i<0)return points.at(-1).value;const a=points[i-1],b=points[i];return a.value+(b.value-a.value)*(time-a.time)/(b.time-a.time);}

// Seeded generator so the random legacy data is the same on every run.
function rng(seed){let s=seed>>>0;return()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};}
function legacyTrack(r,n){const points=[];let time=r()*2;for(let k=0;k<n;k++){points.push({time,value:(r()-.5)*200});time+=0.001+r()*3;}return points;}

test('linear (absent type) equals the legacy valueAt bit-for-bit on random legacy data',()=>{
 const r=rng(20261013);
 for(let track=0;track<400;track++){
  const points=legacyTrack(r,1+Math.floor(r()*12));
  const samples=[points[0].time-1,points[0].time,...points.map(p=>p.time),...points.map(p=>p.time+1e-7),points.at(-1).time+5];
  for(let k=0;k<30;k++)samples.push(points[0].time+r()*(points.at(-1).time-points[0].time+1));
  for(const t of samples)assert.equal(valueAt(points,t),legacyValueAt(points,t),`track ${track} t=${t}`);
 }
});

test('an explicit type linear is the same curve as an absent type',()=>{
 const legacy=[{time:0,value:-3},{time:1.5,value:4},{time:4,value:0.25}];
 const typed=legacy.map(p=>({...p,type:'linear'}));
 for(let t=-0.5;t<=4.5;t+=0.0625)assert.equal(valueAt(typed,t),legacyValueAt(legacy,t));
});

test('hold keeps the earlier value across its segment and jumps at the next key',()=>{
 const points=[{time:0,value:1,type:'hold'},{time:2,value:5}];
 assert.equal(valueAt(points,0),1);
 assert.equal(valueAt(points,1.999),1);
 assert.equal(valueAt(points,2),5);
 assert.equal(valueAt(points,3),5);
});

test('smooth is smoothstep: fixed samples on a 0→10 segment over two seconds',()=>{
 const points=[{time:0,value:0,type:'smooth'},{time:2,value:10}];
 assert.equal(valueAt(points,0.5),1.5625);
 assert.equal(valueAt(points,1),5);
 assert.equal(valueAt(points,1.5),8.4375);
});

test('segment types apply per segment, each to the point it leaves from',()=>{
 const points=[{time:0,value:0,type:'hold'},{time:1,value:2,type:'smooth'},{time:3,value:6}];
 assert.equal(valueAt(points,0.9),0);
 assert.equal(valueAt(points,1),2);
 assert.equal(valueAt(points,2),4);      // smooth from (1,2) to (3,6), s=0.5 → 2 + 4*0.5
 assert.equal(valueAt(points,2.5),5.375); // s=0.75 → 2 + 4*0.84375
 assert.equal(valueAt(points,3),6);
});

test('canonical bezier (0,0)→(1,1) with out (0.25,0) and in (-0.25,0): fixed samples',()=>{
 // Closed form: x(u)=0.75u+0.75u²-0.5u³, y(u)=3u²-2u³. Golden values from an independent Newton solve.
 const points=[{time:0,value:0,type:'bezier',out:{dt:0.25,dv:0}},{time:1,value:1,in:{dt:-0.25,dv:0}}];
 const golden=[[0.1,0.039788648708339404],[0.25,0.182356136835285],[0.5,0.5],[0.75,0.817643863164715],[0.9,0.960211351291661]];
 for(const [t,v] of golden)assert.ok(Math.abs(valueAt(points,t)-v)<1e-9,`t=${t} got ${valueAt(points,t)}`);
 assert.equal(valueAt(points,0),0);
 assert.equal(valueAt(points,1),1);
});

test('a bezier with no handles is linear at the thirds',()=>{
 const points=[{time:1,value:2,type:'bezier'},{time:4,value:-1}];
 for(let t=1;t<=4;t+=0.125)assert.ok(Math.abs(valueAt(points,t)-legacyValueAt([{time:1,value:2},{time:4,value:-1}],t))<1e-9,`t=${t}`);
});

test('bezier handles are clamped inside their segment (time offsets)',()=>{
 const base=[{time:0,value:0,type:'bezier',out:{dt:2,dv:0.5}},{time:2,value:3,in:{dt:-2,dv:-0.5}}];
 const over=[{time:0,value:0,type:'bezier',out:{dt:9,dv:0.5}},{time:2,value:3,in:{dt:-9,dv:-0.5}}];
 for(let t=0;t<=2;t+=0.1)assert.equal(valueAt(over,t),valueAt(base,t));
});

test('bezier with crossing time handles stays monotone in time and inside the value range',()=>{
 const points=[{time:0,value:0,type:'bezier',out:{dt:0.9,dv:0}},{time:1,value:1,in:{dt:-0.9,dv:0}}];
 let prev=-Infinity;
 for(let t=0;t<=1;t+=0.01){const v=valueAt(points,t);assert.ok(Number.isFinite(v));assert.ok(v>=prev-1e-12,`non-decreasing at t=${t}`);assert.ok(v>=-1e-12&&v<=1+1e-12);prev=v;}
});

test('validateTracks keeps legacy documents unchanged and accepts typed points',()=>{
 const legacy=[{id:'a',bind:'field.params.recovery',points:[{time:0,value:1},{time:1,value:2}]}];
 const out=validateTracks(legacy);
 assert.deepEqual(out,legacy);
 assert.equal('type' in out[0].points[0],false);
 const typed=[{id:'b',bind:'field.params.recovery',points:[{time:0,value:1,type:'hold'},{time:1,value:2,type:'smooth'},{time:2,value:0,type:'bezier',out:{dt:0.3,dv:0.1}},{time:3,value:4,in:{dt:-0.3,dv:-0.1}}]}];
 assert.deepEqual(validateTracks(typed),typed);
});

test('validateTracks refuses unknown interpolation types',()=>{
 for(const type of ['spline','step','Linear',null,7,{}])assert.throws(()=>validateTracks([{id:'x',bind:'field.params.recovery',points:[{time:0,value:1,type},{time:1,value:2}]}]),/Invalid property keyframe interpolation/,String(type));
});

test('validateTracks refuses non-finite or missing handle numbers',()=>{
 const bad=[{out:{dt:NaN,dv:0}},{out:{dt:0,dv:Infinity}},{out:{dt:0}},{in:{dv:1}},{out:null},{in:'0,0'}];
 for(const h of bad){const [k,v]=Object.entries(h)[0];assert.throws(()=>validateTracks([{id:'x',bind:'field.params.recovery',points:[{time:0,value:1,type:'bezier',[k]:v},{time:1,value:2}]}]),/Invalid property keyframe handle/,JSON.stringify(h));}
});

test('validateTracks keeps the monotonic-time law for typed points',()=>{
 assert.throws(()=>validateTracks([{id:'x',bind:'field.params.recovery',points:[{time:1,value:1,type:'hold'},{time:0,value:2,type:'linear'}]}]),/Invalid property keyframe/);
});
