import {channelRange,valueAt,segmentControls,type ChannelRange,type ChannelState,type CurvePoint,type Interpolation,type PropertyTrack} from './propertyTracks';
import type {Scene} from './model';
import {esc} from './icons';

/** Lane-3 E09/E10, pure logic: hit-testing, drag-to-point math, handle geometry, sampling to an SVG path, the
 * channel-state filter, and the lane's HTML. The DOM wiring lives in app.ts. Every value on the curve is read through
 * valueAt and segmentControls in propertyTracks.ts: there is one evaluator, never a copy of the maths here. */

export type Points=PropertyTrack['points'];
export type KeyPoint=Points[number];
export type HandleEnd='out'|'in';
export type CurveHit={kind:'key';index:number}|{kind:'handle';index:number;end:HandleEnd};
/** A lane's frame: its size in CSS pixels, and the time and value domain it shows. Values rise upward. */
export interface LaneFrame {width:number;height:number;timeMax:number;valueMin:number;valueMax:number}
/** Working view state for one channel. Presentation only: it is never written into the document. */
export interface ChannelView {solo:boolean;mute:boolean;shown:boolean}

/** The SVG path is drawn in a fixed square, so it needs no re-sampling when the lane is resized. */
export const PATH_SPACE=1000;
/** Pointer tolerance for keyframes and handles, in CSS pixels. */
export const HIT_RADIUS=8;
const SAMPLES_PER_SEGMENT=32;
export const INTERPOLATIONS:Interpolation[]=['hold','linear','smooth','bezier'];
const INTERPOLATION_LABEL:Record<Interpolation,string>={hold:'Hold',linear:'Linear',smooth:'Smooth',bezier:'Bezier'};
const EYE='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>';
const fmt=(n:number)=>String(Number(n.toPrecision(4)));

/** A keyframe's own fields, copied so no edit ever aliases the document or the preview it came from. */
function copyKey(p:KeyPoint):KeyPoint{const q:KeyPoint={time:p.time,value:p.value};if(p.type!==undefined)q.type=p.type;if(p.out)q.out={...p.out};if(p.in)q.in={...p.in};return q;}

/** The channel's name in the app's voice: the parameter or entity target it drives, else its bind path. */
export function channelName(scene:Scene,track:Pick<PropertyTrack,'bind'|'entityId'>):string{return channelRange(scene,track)?.label??track.bind;}

/** The lane's domain. Time runs from 0 to the scene's length or its last keyframe, whichever is later. Values fit the
 * keyframes with a margin, and reach the channel's own range where the keyframes allow it. */
export function laneFrame(points:Points,duration:number,range:Pick<ChannelRange,'min'|'max'>|undefined,width:number,height:number):LaneFrame{
 const timeMax=Math.max(1,duration,points.at(-1)?.time??0);
 let lo=0,hi=1;
 if(points.length){lo=hi=points[0].value;for(const p of points){if(p.value<lo)lo=p.value;if(p.value>hi)hi=p.value;}}
 const span=hi-lo,pad=span>0?span*.15:Math.max(1,Math.abs(hi)*.25);
 let valueMin=lo-pad,valueMax=hi+pad;
 if(range&&Number.isFinite(range.min)&&range.min<=lo&&range.min>valueMin)valueMin=range.min;
 if(range&&Number.isFinite(range.max)&&range.max>=hi&&range.max<valueMax)valueMax=range.max;
 return {width,height,timeMax,valueMin,valueMax};
}

/** Time and value to the lane's pixels, and back. */
export function toPixel(frame:LaneFrame,time:number,value:number):{x:number;y:number}{
 return {x:time/frame.timeMax*frame.width,y:(frame.valueMax-value)/(frame.valueMax-frame.valueMin)*frame.height};
}
export function fromPixel(frame:LaneFrame,x:number,y:number):{time:number;value:number}{
 return {time:x/frame.width*frame.timeMax,value:frame.valueMax-y/frame.height*(frame.valueMax-frame.valueMin)};
}

/** The handles a selected keyframe shows: the bezier segments on either side of it. A bezier segment from point s has
 * its out handle on s and its in handle on s+1. */
export function shownHandles(points:Points,selected:number|null):Array<{index:number;end:HandleEnd}>{
 if(selected===null||selected<0||selected>=points.length)return [];
 const shown:Array<{index:number;end:HandleEnd}>=[];
 if(selected<points.length-1&&points[selected].type==='bezier')shown.push({index:selected,end:'out'},{index:selected+1,end:'in'});
 if(selected>0&&points[selected-1].type==='bezier')shown.push({index:selected-1,end:'out'},{index:selected,end:'in'});
 return shown;
}

/** Where a handle sits, in (time, value). A handle is stored relative to the point it is kept on, and the segment's own
 * control points (segmentControls) place it, so the drawn handle is exactly the one evaluation uses. */
export function handlePosition(points:Points,index:number,end:HandleEnd):CurvePoint{
 if(end==='out'){const c=segmentControls(points[index],points[index+1]);return c[1];}
 const c=segmentControls(points[index-1],points[index]);return c[2];
}

/** The keyframe or handle under a pointer. Keyframes win over handles; the nearest in its class wins. */
export function curveHit(points:Points,frame:LaneFrame,selected:number|null,x:number,y:number,radius=HIT_RADIUS):CurveHit|null{
 let key:{d:number;index:number}|null=null;
 for(let i=0;i<points.length;i++){const q=toPixel(frame,points[i].time,points[i].value),d=Math.hypot(x-q.x,y-q.y);if(d<=radius&&(!key||d<key.d))key={d,index:i};}
 if(key)return {kind:'key',index:key.index};
 let handle:{d:number;hit:CurveHit}|null=null;
 for(const h of shownHandles(points,selected)){const c=handlePosition(points,h.index,h.end),q=toPixel(frame,c.x,c.y),d=Math.hypot(x-q.x,y-q.y);if(d<=radius&&(!handle||d<handle.d))handle={d,hit:{kind:'handle',index:h.index,end:h.end}};}
 return handle?handle.hit:null;
}

/** A keyframe dragged to (time, value). Its segments keep their shape: a handle is relative to its point. */
export function moveKey(points:Points,index:number,time:number,value:number):Points{
 return points.map((p,i)=>{const q=copyKey(p);if(i===index){q.time=time;q.value=value;}return q;});
}

/** A handle dragged to (time, value). It is stored on the point it belongs to (out on the segment's start, in on its
 * end), relative to that point, so the point and its handle move together. Refusal is left to validateCurveEdit. */
export function moveHandle(points:Points,index:number,end:HandleEnd,time:number,value:number):Points{
 const out=points.map(copyKey),anchor=points[index];
 out[index][end]={dt:time-anchor.time,dv:value-anchor.value};
 return out;
}

/** The interpolation of the segment that starts at a keyframe. Linear is stored as an absent type (E08's law). Leaving
 * bezier drops the handles that shaped the segment. */
export function setSegmentType(points:Points,index:number,type:Interpolation):Points{
 if(index<0||index>=points.length-1)throw new Error('This keyframe has no segment after it');
 const out=points.map(copyKey),p=out[index];
 if(type==='linear')delete p.type;else p.type=type;
 if(type!=='bezier'){delete out[index].out;delete out[index+1].in;}
 return out;
}

/** A keyframe added at a time, holding the value the curve already has there. It splits the segment it falls in: the
 * new point takes that segment's interpolation, and the split segment's handles reset to the defaults. A time that is
 * already a keyframe is refused, since time must be strictly increasing. */
export function insertKey(points:Points,time:number):Points{
 if(points.some(p=>p.time===time))throw new Error('A keyframe already sits at this time');
 const out=points.map(copyKey);
 const at=out.findIndex(p=>p.time>time),k=at<0?out.length:at;
 const value=points.length?(valueAt(points,time)??points[0].value):0;
 const fresh:KeyPoint={time,value};
 if(k>0&&k<out.length){const left=out[k-1];if(left.type!==undefined)fresh.type=left.type;delete left.out;delete out[k].in;}
 out.splice(k,0,fresh);
 return out;
}

/** A keyframe removed. The segments either side of it merge; the left point keeps its interpolation and loses the
 * handles that shaped the removed segment. A channel keeps at least two keyframes. */
export function removeKey(points:Points,index:number):Points{
 if(points.length<=2)throw new Error('A channel keeps at least two keyframes');
 if(index<0||index>=points.length)throw new Error('No keyframe is selected');
 const out=points.map(copyKey);
 if(index>0)delete out[index-1].out;
 if(index<out.length-1)delete out[index+1].in;
 out.splice(index,1);
 return out;
}

/** The curve across the lane, in PATH_SPACE units. Each segment is sampled through valueAt, the one evaluator. A hold
 * segment is drawn as a step, so its jump falls exactly on the next keyframe. */
export function samplePath(points:Points,frame:LaneFrame):string{
 if(!points.length)return '';
 const sx=(t:number)=>t/frame.timeMax*PATH_SPACE,sy=(v:number)=>(frame.valueMax-v)/(frame.valueMax-frame.valueMin)*PATH_SPACE;
 const parts:string[]=[];
 const put=(cmd:string,t:number,v:number)=>parts.push(`${cmd}${sx(t).toFixed(2)} ${sy(v).toFixed(2)}`);
 put('M',points[0].time,points[0].value);
 for(let j=0;j<points.length-1;j++){
  const a=points[j],b=points[j+1];
  if(a.type==='hold'){put('L',b.time,a.value);put('L',b.time,b.value);continue;}
  for(let k=1;k<=SAMPLES_PER_SEGMENT;k++){const t=k===SAMPLES_PER_SEGMENT?b.time:a.time+(b.time-a.time)*k/SAMPLES_PER_SEGMENT;put('L',t,valueAt(points,t)??b.value);}
 }
 const last=points.at(-1)!;
 if(last.time<frame.timeMax)put('L',frame.timeMax,last.value);
 return parts.join(' ');
}

/** The channel state evaluateTracks takes for one scene, built from the working views. Undefined when no channel is
 * soloed or muted, so evaluation is the unfiltered one. */
export function channelStateFor(scene:Scene,views:(trackId:string)=>ChannelView|undefined):ChannelState|undefined{
 const solo=new Set<string>(),mute=new Set<string>();
 for(const t of scene.propertyTracks??[]){const v=views(t.id);if(v?.solo)solo.add(t.id);if(v?.mute)mute.add(t.id);}
 return solo.size||mute.size?{solo,mute}:undefined;
}

export interface ChannelPanel {scene:Scene;selected:{trackId:string;index:number|null}|null;views:(trackId:string)=>ChannelView|undefined}

/** The channel rows and the selected channel's lane, as HTML. Lanes are sized in percent so the one markup serves
 * every width; the SVG path uses PATH_SPACE. */
export function channelPanelHTML(panel:ChannelPanel):string{
 const {scene,selected,views}=panel,tracks=scene.propertyTracks??[];
 if(!tracks.length)return '';
 const rows=tracks.map(t=>{
  const v=views(t.id)??{solo:false,mute:false,shown:true},name=esc(channelName(scene,t)),id=esc(t.id),on=selected?.trackId===t.id;
  return `<div class="curve-channel${on?' is-selected':''}"><button type="button" class="curve-name" data-action="curve-select" data-track-id="${id}" aria-pressed="${on}">${name}<small>${t.points.length} keys</small></button><button type="button" class="curve-toggle" data-action="curve-solo" data-track-id="${id}" aria-pressed="${v.solo}" aria-label="Solo ${name}" title="Solo: only soloed channels play">S</button><button type="button" class="curve-toggle" data-action="curve-mute" data-track-id="${id}" aria-pressed="${v.mute}" aria-label="Mute ${name}" title="Mute: this channel does not play">M</button><button type="button" class="curve-toggle curve-eye" data-action="curve-show" data-track-id="${id}" aria-pressed="${v.shown}" aria-label="${v.shown?'Hide':'Show'} curve ${name}" title="${v.shown?'Hide the curve':'Show the curve'}">${EYE}</button></div>`;
 }).join('');
 const track=selected?tracks.find(t=>t.id===selected.trackId):undefined;
 const lane=track&&track.points.length&&(views(track.id)?.shown??true)?curveLaneHTML(scene,track,selected!.index):'';
 return `<div class="curve-channels" aria-label="Channels">${rows}</div>${lane}`;
}

function curveLaneHTML(scene:Scene,track:PropertyTrack,selectedIndex:number|null):string{
 const id=esc(track.id),name=esc(channelName(scene,track)),frame=laneFrame(track.points,scene.duration,channelRange(scene,track),100,100);
 const keys=track.points.map((p,i)=>{const q=toPixel(frame,p.time,p.value);return `<span class="curve-key${i===selectedIndex?' is-selected':''}" data-key="${i}" style="left:${q.x.toFixed(3)}%;top:${q.y.toFixed(3)}%" role="img" aria-label="Keyframe ${i+1} at ${fmt(p.time)} seconds, value ${fmt(p.value)}"></span>`;}).join('');
 const handles=shownHandles(track.points,selectedIndex).map(h=>{const c=handlePosition(track.points,h.index,h.end),q=toPixel(frame,c.x,c.y);return `<span class="curve-handle curve-handle-${h.end}" data-key="${h.index}" data-end="${h.end}" style="left:${q.x.toFixed(3)}%;top:${q.y.toFixed(3)}%"></span>`;}).join('');
 const point=selectedIndex!==null?track.points[selectedIndex]:undefined;
 const hasSegment=selectedIndex!==null&&selectedIndex<track.points.length-1;
 const current=point&&hasSegment?(point.type??'linear'):'';
 const controls=point?`<div class="curve-tools" role="group" aria-label="Segment after keyframe ${selectedIndex!+1}">${INTERPOLATIONS.map(type=>`<button type="button" data-action="curve-segment" data-track-id="${id}" data-index="${selectedIndex}" data-type="${type}" aria-pressed="${current===type}"${hasSegment?'':' disabled'}>${INTERPOLATION_LABEL[type]}</button>`).join('')}<button type="button" data-action="curve-delete-key" data-track-id="${id}" data-index="${selectedIndex}" aria-label="Delete keyframe"${track.points.length<=2?' disabled':''}>Delete</button></div><p class="curve-readout">${fmt(point.time)} s · ${fmt(point.value)}</p>`:'';
 return `<div class="curve-lane-wrap"><div class="curve-lane" data-track-id="${id}" data-scene-id="${esc(scene.id)}" role="group" aria-label="Curve for ${name}"><svg class="curve-svg" viewBox="0 0 ${PATH_SPACE} ${PATH_SPACE}" preserveAspectRatio="none" aria-hidden="true"><path d="${samplePath(track.points,frame)}"/></svg>${handles}${keys}</div>${controls}</div>`;
}
