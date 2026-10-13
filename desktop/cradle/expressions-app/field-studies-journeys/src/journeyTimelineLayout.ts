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

export interface TimelineClip {sceneId:string;x:number;w:number;start:number;end:number}
export interface TimelineLayout {clips:TimelineClip[];total:number}

/** Clip extents on the global Expression clock, scaled so the whole track is `widthPx` wide. */
export function journeyTimelineLayout(scenes:ReadonlyArray<Pick<Scene,'id'|'duration'>>,timing:TimelineTimingFn,widthPx:number):TimelineLayout{
 if(!scenes.length)return {clips:[],total:0};
 const total=timing(0,0).total;
 const clips=scenes.map((scene,index)=>{
  const start=timing(index,0).time,end=timing(index,scene.duration).time;
  return {sceneId:scene.id,x:total?start/total*widthPx:0,w:total?(end-start)/total*widthPx:0,start,end};
 });
 return {clips,total};
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
