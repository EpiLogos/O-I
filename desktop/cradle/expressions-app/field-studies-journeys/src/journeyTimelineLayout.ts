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

/** The scene duration rule, mirrored from model.ts validateJourney (`finite(s.duration,1,3600)`). */
export const SCENE_DURATION_MIN=1;
export const SCENE_DURATION_MAX=3600;

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
