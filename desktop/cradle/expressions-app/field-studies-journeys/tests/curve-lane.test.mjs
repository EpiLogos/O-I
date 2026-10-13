import test from 'node:test';
import assert from 'node:assert/strict';
import {fieldStudies,clone,sceneContentDigest} from '../build/model.js';
import {valueAt,validateCurveEdit,channelRange,channelApplies,evaluateTracks} from '../build/propertyTracks.js';
import {NATIVE_BINDINGS} from '../build/nativeParameters.js';
import {DocumentStore} from '../build/store.js';
import {laneFrame,toPixel,fromPixel,curveHit,shownHandles,handlePosition,moveKey,moveHandle,insertKey,removeKey,setSegmentType,samplePath,channelStateFor,channelPanelHTML,channelName} from '../build/curveLane.js';

// Lane-3 E09/E10. The pure logic lives in curveLane.ts; the curve is read through valueAt (one evaluator). Two native
// parameters with finite hard limits stand in for two channels.
const usable=NATIVE_BINDINGS.filter(b=>Number.isFinite(b.hardMin)&&Number.isFinite(b.hardMax)&&b.hardMax>b.hardMin);
const A=usable[0],B=usable[1];
const bindA='field.params.'+A.key,bindB='field.params.'+B.key;
const inside=(b,f)=>b.hardMin+(b.hardMax-b.hardMin)*f;

function fixture(){const j=fieldStudies();j.scenes.forEach((s,i)=>{s.transition=1+(i%3)*.5;s.duration=6;});return clone(j);}
function sceneWith(tracks,duration=6){const j=fixture();const s=j.scenes[0];s.duration=duration;s.propertyTracks=tracks;return {j,s};}
const frame={width:400,height:200,timeMax:8,valueMin:0,valueMax:10};

test('a time and value map to the lane and back', ()=>{
 const p=toPixel(frame,2,5);
 assert.deepEqual(p,{x:100,y:100});
 const back=fromPixel(frame,p.x,p.y);
 assert.equal(back.time,2);
 assert.equal(back.value,5);
});

test('the lane domain runs from time zero to the scene or its last key, and reaches the channel range', ()=>{
 const f=laneFrame([{time:0,value:2},{time:3,value:6}],6,{min:0,max:10},400,200);
 assert.equal(f.timeMax,6);
 assert.ok(f.valueMin<=2&&f.valueMax>=6);
 const late=laneFrame([{time:0,value:2},{time:9,value:6}],6,undefined,400,200);
 assert.equal(late.timeMax,9);
});

test('a keyframe under the pointer is hit before a handle, and a handle only when its segment is shown', ()=>{
 const points=[{time:0,value:0,type:'bezier'},{time:4,value:8}];
 const k=toPixel(frame,4,8);
 assert.deepEqual(curveHit(points,frame,null,k.x,k.y),{kind:'key',index:1});
 const h=handlePosition(points,0,'out'),hp=toPixel(frame,h.x,h.y);
 assert.equal(curveHit(points,frame,null,hp.x,hp.y),null,'no handle is hit while no key is selected');
 assert.deepEqual(curveHit(points,frame,0,hp.x,hp.y),{kind:'handle',index:0,end:'out'});
 const inH=handlePosition(points,1,'in'),ip=toPixel(frame,inH.x,inH.y);
 assert.deepEqual(curveHit(points,frame,0,ip.x,ip.y),{kind:'handle',index:1,end:'in'});
 assert.equal(curveHit(points,frame,0,399,199),null);
});

test('the handles shown are the bezier segments on either side of the selected key', ()=>{
 const points=[{time:0,value:0,type:'bezier'},{time:2,value:2,type:'linear'},{time:4,value:4,type:'bezier'},{time:6,value:6}];
 assert.deepEqual(shownHandles(points,1),[{index:0,end:'out'},{index:1,end:'in'}]);
 assert.deepEqual(shownHandles(points,2),[{index:2,end:'out'},{index:3,end:'in'}]);
 assert.deepEqual(shownHandles(points,3),[{index:2,end:'out'},{index:3,end:'in'}]);
 assert.deepEqual(shownHandles(points,null),[]);
});

test('a dragged keyframe moves its time and value, and its handles travel with it', ()=>{
 const points=[{time:0,value:0,type:'bezier',out:{dt:1,dv:2}},{time:4,value:8,in:{dt:-1,dv:-2}}];
 const moved=moveKey(points,0,1,3);
 assert.deepEqual(moved[0],{time:1,value:3,type:'bezier',out:{dt:1,dv:2}});
 assert.deepEqual(points[0],{time:0,value:0,type:'bezier',out:{dt:1,dv:2}},'the drag never writes the base');
});

test('a dragged handle is stored relative to the point it belongs to', ()=>{
 const points=[{time:0,value:0,type:'bezier'},{time:4,value:8}];
 const out=moveHandle(points,0,'out',2,3);
 assert.deepEqual(out[0].out,{dt:2,dv:3});
 const inn=moveHandle(points,1,'in',3,5);
 assert.deepEqual(inn[1].in,{dt:-1,dv:-3});
});

test('a keyframe dragged across its neighbour is refused by name', ()=>{
 const points=[{time:0,value:0},{time:4,value:8}];
 assert.throws(()=>validateCurveEdit(moveKey(points,1,0,8)),/Invalid property keyframe/);
 assert.throws(()=>validateCurveEdit(moveKey(points,1,-1,8)),/Invalid property keyframe/);
});

test('a handle dragged outside its segment in time is refused by name', ()=>{
 const points=[{time:0,value:0,type:'bezier'},{time:4,value:8}];
 assert.throws(()=>validateCurveEdit(moveHandle(points,0,'out',5,3)),/Handle time must stay inside its segment/);
 assert.throws(()=>validateCurveEdit(moveHandle(points,1,'in',-1,5)),/Handle time must stay inside its segment/);
 assert.doesNotThrow(()=>validateCurveEdit(moveHandle(points,0,'out',4,3)));
 assert.doesNotThrow(()=>validateCurveEdit(moveHandle(points,1,'in',0,5)));
});

test('a value or handle outside the channel range is refused by name', ()=>{
 const range={min:A.hardMin,max:A.hardMax};
 const points=[{time:0,value:inside(A,.2)},{time:4,value:inside(A,.8)}];
 assert.throws(()=>validateCurveEdit(moveKey(points,1,4,A.hardMax+1),range),/outside the channel range/);
 assert.doesNotThrow(()=>validateCurveEdit(moveKey(points,1,4,inside(A,.9)),range));
 const bez=[{time:0,value:inside(A,.5),type:'bezier'},{time:4,value:inside(A,.5)}];
 assert.throws(()=>validateCurveEdit(moveHandle(bez,0,'out',2,A.hardMax+1),range),/Handle value is outside the channel range/);
 assert.doesNotThrow(()=>validateCurveEdit(moveHandle(bez,0,'out',2,inside(A,.5)),range));
});

test('a valid curve edit passes validation and its name is the channel label', ()=>{
 const {s}=sceneWith([{id:'a',bind:bindA,points:[{time:0,value:inside(A,.1)},{time:6,value:inside(A,.9)}]}]);
 const track=s.propertyTracks[0];
 assert.equal(channelName(s,track),A.label);
 assert.deepEqual(channelRange(s,track),{label:A.label,min:A.hardMin,max:A.hardMax});
 assert.doesNotThrow(()=>validateCurveEdit(track.points,channelRange(s,track)));
});

test('the sampled path follows the curve through valueAt, and a hold is drawn as a step', ()=>{
 const linear=[{time:0,value:0},{time:4,value:8}];
 const path=samplePath(linear,frame).split(' ');
 assert.equal(path[0],'M0.00');
 assert.equal(path[1],'1000.00');
 const mid=samplePath(linear,frame);
 const sampled=valueAt(linear,2);
 assert.ok(mid.includes(`${(2/8*1000).toFixed(2)} ${((10-sampled)/10*1000).toFixed(2)}`),'the midpoint sample is valueAt(2)');
 const hold=[{time:0,value:2,type:'hold'},{time:4,value:6}];
 assert.ok(samplePath(hold,frame).includes('L500.00 800.00 L500.00 400.00'));
});

test('a keyframe added holds the curve value at its time and splits the segment it falls in', ()=>{
 const points=[{time:0,value:0},{time:4,value:8}];
 const next=insertKey(points,2);
 assert.equal(next.length,3);
 assert.deepEqual(next[1],{time:2,value:valueAt(points,2)});
 assert.throws(()=>insertKey(points,4),/already sits at this time/);
});

test('an inserted key takes the interpolation of the segment it splits, and the split handles reset', ()=>{
 const points=[{time:0,value:0,type:'smooth'},{time:4,value:8}];
 assert.equal(insertKey(points,2)[1].type,'smooth');
 const bez=[{time:0,value:0,type:'bezier',out:{dt:1,dv:2}},{time:4,value:8,in:{dt:-1,dv:-2}}];
 const split=insertKey(bez,2);
 assert.equal(split[1].type,'bezier');
 assert.equal(split[0].out,undefined);
 assert.equal(split[2].in,undefined);
});

test('a keyframe removed merges its segments, and a channel keeps at least two keyframes', ()=>{
 const points=[{time:0,value:0},{time:2,value:4},{time:4,value:8}];
 const next=removeKey(points,1);
 assert.deepEqual(next,[{time:0,value:0},{time:4,value:8}]);
 assert.throws(()=>removeKey(next,0),/at least two keyframes/);
});

test('an interpolation is set per segment; linear is an absent type, and leaving bezier drops its handles', ()=>{
 const points=[{time:0,value:0,type:'smooth'},{time:4,value:8,type:'bezier',out:{dt:1,dv:1}},{time:6,value:9,in:{dt:-1,dv:0}}];
 const linear=setSegmentType(points,0,'linear');
 assert.equal('type' in linear[0],false);
 const hold=setSegmentType(points,1,'hold');
 assert.equal(hold[1].type,'hold');
 assert.equal(hold[1].out,undefined);
 assert.equal(hold[2].in,undefined);
 assert.throws(()=>setSegmentType(points,2,'linear'),/no segment after it/);
});

test('a muted channel is not applied, and while any channel is soloed only soloed channels apply', ()=>{
 const pointsA=[{time:0,value:inside(A,.9)},{time:6,value:inside(A,.9)}];
 const pointsB=[{time:0,value:inside(B,.9)},{time:6,value:inside(B,.9)}];
 const {s}=sceneWith([{id:'a',bind:bindA,points:pointsA},{id:'b',bind:bindB,points:pointsB}]);
 const expectA=Math.max(A.hardMin,Math.min(A.hardMax,inside(A,.9))),expectB=Math.max(B.hardMin,Math.min(B.hardMax,inside(B,.9)));
 const both=evaluateTracks(s,2);
 assert.equal(both.field.params[A.key],expectA);
 assert.equal(both.field.params[B.key],expectB);
 const unfiltered=evaluateTracks(s,2,undefined);
 assert.deepEqual(unfiltered,both,'no channel state is the unfiltered evaluation');
 const muted=evaluateTracks(s,2,{solo:new Set(),mute:new Set(['a'])});
 assert.notEqual(muted.field.params[A.key],expectA,'muted A is not applied');
 assert.equal(muted.field.params[B.key],expectB);
 const soloB=evaluateTracks(s,2,{solo:new Set(['b']),mute:new Set()});
 assert.notEqual(soloB.field.params[A.key],expectA,'with B soloed, A is not applied');
 assert.equal(soloB.field.params[B.key],expectB);
 const both2=evaluateTracks(s,2,{solo:new Set(['b']),mute:new Set(['b'])});
 assert.notEqual(both2.field.params[B.key],expectB,'mute wins over solo');
});

test('channel toggles do not change the document: the digest is the same before and after', ()=>{
 const {j,s}=sceneWith([{id:'a',bind:bindA,points:[{time:0,value:inside(A,.2)},{time:6,value:inside(A,.8)}]}]);
 const digestBefore=sceneContentDigest(s),jsonBefore=JSON.stringify(j);
 const views=new Map([['a',{solo:true,mute:false,shown:false}]]);
 const state=channelStateFor(s,id=>views.get(id));
 evaluateTracks(s,3,state);
 views.set('a',{solo:false,mute:true,shown:true});
 evaluateTracks(s,3,channelStateFor(s,id=>views.get(id)));
 assert.equal(sceneContentDigest(s),digestBefore,'the scene digest is unchanged');
 assert.equal(JSON.stringify(j),jsonBefore,'the journey is byte-identical after toggling');
});

test('the channel state is built only when a channel is soloed or muted', ()=>{
 const {s}=sceneWith([{id:'a',bind:bindA,points:[{time:0,value:1},{time:6,value:2}]}]);
 assert.equal(channelStateFor(s,()=>undefined),undefined);
 assert.equal(channelStateFor(s,()=>({solo:false,mute:false,shown:false})),undefined);
 const state=channelStateFor(s,()=>({solo:false,mute:true,shown:true}));
 assert.deepEqual([...state.mute],['a']);
 assert.equal(channelApplies('a',state),false);
});

test('one finished curve drag is one labelled undo step', ()=>{
 const {j}=sceneWith([{id:'a',bind:bindA,points:[{time:0,value:inside(A,.2)},{time:6,value:inside(A,.8)}]}]);
 const store=new DocumentStore(j);
 const dragged=moveKey(store.document.scenes[0].propertyTracks[0].points,1,5,inside(A,.5));
 store.change('Edit curve '+A.label,d=>{d.scenes[0].propertyTracks[0].points=dragged;});
 assert.equal(store.undoStack.length,1);
 assert.equal(store.undoLabel(),'Edit curve '+A.label);
 assert.equal(store.undo(),true);
 assert.deepEqual(store.document.scenes[0].propertyTracks[0].points,j.scenes[0].propertyTracks[0].points);
});

test('the channel panel carries the solo, mute and show toggles, and a lane only for the selected channel', ()=>{
 const {s}=sceneWith([{id:'a',bind:bindA,points:[{time:0,value:inside(A,.2)},{time:6,value:inside(A,.8)}]},{id:'b',bind:bindB,points:[{time:0,value:1},{time:6,value:2}]}]);
 const views=new Map([['b',{solo:true,mute:false,shown:true}]]);
 const html=channelPanelHTML({scene:s,selected:{trackId:'a',index:0},views:id=>views.get(id)});
 assert.match(html,/data-action="curve-solo" data-track-id="a" aria-pressed="false"/);
 assert.match(html,/data-action="curve-solo" data-track-id="b" aria-pressed="true"/);
 assert.match(html,/data-action="curve-show" data-track-id="a"/);
 assert.equal((html.match(/class="curve-lane"/g)??[]).length,1);
 assert.match(html,/data-action="curve-segment" data-track-id="a" data-index="0" data-type="bezier"/);
 assert.equal(/#[0-9a-fA-F]{3,6}\b|rgb\(/.test(html),false,'the lane uses tokens only, no raw colour');
 const hidden=channelPanelHTML({scene:s,selected:{trackId:'a',index:null},views:id=>id==='a'?{solo:false,mute:false,shown:false}:undefined});
 assert.equal(hidden.includes('class="curve-lane"'),false,'a hidden channel draws no lane');
});
