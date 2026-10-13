/**
 * Time-proportional layout of an Expression's scenes (E01, lane 3).
 *
 * One clock only: every edge comes from `expressionTiming` (propertyTracks.ts),
 * passed in as `timing(index, local)`. This module never sums durations itself,
 * so Σ durations stays the law and no second time base can drift from it.
 *
 * A clip is its Scene: `sceneId` is the scene's ref, stable under every view.
 * Positions are in the units of `widthPx`; the app passes 100 so `x` and `w`
 * read as percent of the track and the track stays fluid under resize.
 */
import type {Scene} from './model';
import {SCENE_DURATION_MIN,SCENE_DURATION_MAX} from './model';
export {SCENE_DURATION_MIN,SCENE_DURATION_MAX};

export interface TimelineTiming {start:number;total:number;time:number}
/** `expressionTiming` bound to a journey, e.g. `(i,l)=>expressionTiming(journey,i,l)`. */
export type TimelineTimingFn=(index:number,local:number)=>TimelineTiming;

export interface TimelineClip {sceneId:string;x:number;w:number;start:number;end:number;duration:number}
export interface TimelineLayout {clips:TimelineClip[];total:number}

/** Clip extents on the global Expression clock, scaled so the whole track is `widthPx` wide. */
export function journeyTimelineLayout(scenes:ReadonlyArray<Pick<Scene,'id'|'duration'>>,timing:TimelineTimingFn,widthPx:number):TimelineLayout{
 if(!scenes.length)return {clips:[],total:0};
 const total=timing(0,0).total;
 const clips=scenes.map((scene,index)=>{
  const start=timing(index,0).time,end=timing(index,scene.duration).time;
  return {sceneId:scene.id,x:total?start/total*widthPx:0,w:total?(end-start)/total*widthPx:0,start,end,duration:scene.duration};
 });
 return {clips,total};
}

/**
 * E05: the duration a right-edge drag of `dxPx` gives its scene. The scale is
 * the layout's own clock: `layout.total` seconds across `trackPx` pixels, read
 * from the layout the drag began on, so the scale cannot shift under the pointer.
 * A move under 0.05 s keeps the original value. Otherwise the result lands on
 * the .1 s grid and stops at the limit it reached (`clamped`), never a silent snap.
 */
export function durationFromEdgeDrag(layout:TimelineLayout,sceneId:string,dxPx:number,trackPx:number):{duration:number;clamped:'min'|'max'|null}{
 const clip=layout.clips.find(c=>c.sceneId===sceneId);
 if(!clip)throw new Error('This scene is no longer on the timeline.');
 if(!(trackPx>0)||!(layout.total>0)||!Number.isFinite(dxPx))throw new Error('The timeline has no width to trim against.');
 const delta=dxPx/trackPx*layout.total;
 if(Math.abs(delta)<.05)return {duration:clip.duration,clamped:null};
 const snapped=Math.round((clip.duration+delta)*10)/10;
 if(snapped<SCENE_DURATION_MIN)return {duration:SCENE_DURATION_MIN,clamped:'min'};
 if(snapped>SCENE_DURATION_MAX)return {duration:SCENE_DURATION_MAX,clamped:'max'};
 return {duration:snapped,clamped:null};
}

/**
 * E04/E06: the seconds a horizontal drag of `dxPx` moves along the layout's own clock (`total` seconds
 * across `trackPx`), on the .1 s grid. A move under 0.05 s is no move (0).
 */
export function secondsFromDrag(dxPx:number,trackPx:number,total:number):number{
 if(!(trackPx>0)||!(total>0)||!Number.isFinite(dxPx))return 0;
 const raw=dxPx/trackPx*total;
 if(Math.abs(raw)<.05)return 0;
 return Math.round(raw*10)/10;
}

/**
 * Lane-5 T6: the overlap a drag of `dxPx` authors on a seam, in seconds. The blend moves by the drag on the layout's own
 * clock (`layout.total` seconds across the track), on the .1 s grid, and stops at both ends with a named `clamped`: 'min' at
 * a cut (0 s), 'max' at `limit`, the incoming scene's blend limit. A move under 0.05 s keeps the value.
 */
export function overlapFromDrag(from:number,limit:number,layout:TimelineLayout,dxPx:number,trackPx:number):{seconds:number;clamped:'min'|'max'|null}{
 if(!(limit>=0))throw new Error('This seam has no blend limit to drag against.');
 const delta=secondsFromDrag(dxPx,trackPx,layout.total);
 if(delta===0)return {seconds:from,clamped:null};
 const want=Math.round((from+delta)*10)/10;
 if(want<0)return {seconds:0,clamped:'min'};
 if(want>limit)return {seconds:limit,clamped:'max'};
 return {seconds:want,clamped:null};
}

/**
 * E06 slip: the entry offset a drag of `dxPx` gives. Dragging right shows earlier content, so the offset
 * falls by the drag. It stays on [0, duration), on the .1 grid once the drag moved it. An unmoved drag keeps the offset.
 */
export function slipOffsetFromDrag(from:number,dxPx:number,trackPx:number,total:number,duration:number):number{
 const moved=secondsFromDrag(dxPx,trackPx,total);
 const max=Math.max(0,Math.round((duration-.1)*10)/10);
 const next=moved===0?from:Math.round((from-moved)*10)/10;
 return Math.min(max,Math.max(0,next));
}

/**
 * E04: where a drop on clip `targetId` inserts. Its left half inserts before it; its right half inserts
 * before the Scene after it (null = at the end of the Expression).
 */
export function insertBeforeFor(scenes:ReadonlyArray<{id:string}>,targetId:string,rightHalf:boolean):string|null{
 const at=scenes.findIndex(s=>s.id===targetId);
 if(at<0)throw new Error('This scene is no longer on the timeline.');
 if(!rightHalf)return targetId;
 return at+1<scenes.length?scenes[at+1].id:null;
}

/**
 * The scene under global time `t`, with its local time. Intervals are half-open
 * [start, end) so a boundary belongs to the scene it starts, matching
 * `expressionTiming(j, index, local).time`. The final instant `t = total`
 * belongs to the last scene with positive length, at its full duration.
 */
export function sceneAtTime(layout:TimelineLayout,t:number):{sceneId:string;local:number}|undefined{
 const {clips,total}=layout;
 if(!clips.length)return undefined;
 const time=Math.min(Math.max(t,0),total);
 const hit=clips.find(c=>time>=c.start&&time<c.end)??[...clips].reverse().find(c=>c.end>c.start)??clips[clips.length-1];
 return {sceneId:hit.sceneId,local:time-hit.start};
}

/**
 * E09c: one step of a curve drag's preview, on the timeline's curve lane. A refused candidate (null) keeps the last valid
 * preview, so the field does not snap back mid-drag. `changed` is true only when the preview itself moves; the caller
 * advances the drag revision on that alone, so the engine rebuilds once per change instead of every tick.
 */
export function dragPreviewStep<T>(preview:T|null,candidate:T|null,same:(a:T,b:T)=>boolean):{preview:T|null;changed:boolean}{
 if(candidate===null)return {preview,changed:false};
 if(preview!==null&&same(preview,candidate))return {preview,changed:false};
 return {preview:candidate,changed:true};
}
