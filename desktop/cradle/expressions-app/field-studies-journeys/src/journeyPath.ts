/**
 * Lane-5 T6–T8, pure: the seam's blend as the strip draws it, its live state while composing, and the walked journey path.
 *
 * One clock: every time here comes from `expressionTiming` (propertyTracks.ts), passed in as `timing(index, local)`. Nothing
 * here sums durations itself. A blend is a fact of the scene it enters (its `transition` seconds and typed kind, E11) and the
 * engine plays it over that scene's head, from the scene's start. So the blend band is drawn there, and the expression clock
 * does not change: an overlap authors the transition, it does not shorten the journey.
 */
import type {Journey,Scene} from './model';
import {SCENE_TRANSITION_MAX} from './model';
import {esc} from './icons';
import {kindLabel,transitionKindOf,type TransitionSpec} from './transitions';
import {journeyTimelineLayout,sceneAtTime,type TimelineTimingFn} from './journeyTimelineLayout';

/** One decimal place, with its unit: "1.5 s". */
export function formatSeconds(seconds:number):string{return `${(Math.round(seconds*10)/10).toFixed(1)} s`;}

/** A seam blends only when its kind is a blend and it lasts time. A cut kind, or zero seconds, is a cut: the engine plays no
 * transition there, so the timeline draws none. */
export function seamBlends(spec:TransitionSpec|undefined|null,seconds:number):boolean{return transitionKindOf(spec)!=='cut'&&seconds>0;}

/** The seam's caption: "Cut", or the kind and its seconds ("Crossfade · 1.5 s"). */
export function seamLabel(spec:TransitionSpec|undefined|null,seconds:number):string{
 return seamBlends(spec,seconds)?`${kindLabel(transitionKindOf(spec))} · ${formatSeconds(seconds)}`:'Cut';
}

/** The most a blend can last into a scene: the scene's own length, and the journey's transition bound. */
export function blendLimit(incomingDuration:number):number{return Math.min(SCENE_TRANSITION_MAX,incomingDuration);}

/** The named limit a blend drag stops at, in the app's voice. */
export function blendLimitMessage(limit:number):string{
 return limit<SCENE_TRANSITION_MAX
  ?`A blend stops at ${formatSeconds(limit)}, the length of the scene it enters.`
  :`A blend stops at ${SCENE_TRANSITION_MAX} seconds, the longest a transition lasts.`;
}

/** The live state of one seam at journey time `time`. `seconds` is the authored blend; `fraction` is how far the blend is in
 * force (null when no blend is in force there). The first scene has no seam. A blend runs from the incoming scene's start for
 * its seconds, capped at that scene's length, half-open like the clock: the end instant belongs to the next scene. */
export interface SeamState {sceneId:string;index:number;start:number;seconds:number;blends:boolean;fraction:number|null}
export function seamStates(scenes:ReadonlyArray<Scene>,timing:TimelineTimingFn,time:number):SeamState[]{
 return scenes.map((scene,index)=>{
  const start=timing(index,0).time;
  const blends=index>0&&seamBlends(scene.transitionSpec,scene.transition);
  const span=Math.min(scene.transition,scene.duration);
  const inForce=blends&&time>=start&&time<start+span;
  return {sceneId:scene.id,index,start,seconds:scene.transition,blends,fraction:inForce?(time-start)/span:null};
 });
}

/** The seam's caption while it composes: the two scene names and the blend's percentage while it is in force, else its label. */
export function seamCaption(previousName:string|undefined,scene:Pick<Scene,'name'|'transition'|'transitionSpec'>,fraction:number|null):string{
 return fraction!==null&&previousName!==undefined?`${previousName} → ${scene.name} · ${Math.round(fraction*100)}%`:seamLabel(scene.transitionSpec,scene.transition);
}

/** The blend band and its caption for the seam into `scene`, placed in percent of the track. The band runs from the seam over
 * the incoming scene's head for its seconds (capped at the scene's length) and fills with `--blend-progress` while in force. */
export function seamBlendHTML(previous:Pick<Scene,'name'>|undefined,scene:Scene,leftPercent:number,widthPercent:number,fraction:number|null):string{
 const blends=seamBlends(scene.transitionSpec,scene.transition),id=esc(scene.id),live=fraction!==null;
 const band=blends?`<span class="seam-blend" data-seam-band data-scene-id="${id}" data-blending="${live}" style="left:${leftPercent.toFixed(3)}%;width:${Math.max(0,widthPercent).toFixed(3)}%;--blend-progress:${(fraction??0).toFixed(4)}" aria-hidden="true"></span>`:'';
 const caption=`<span class="seam-caption" data-seam-caption data-scene-id="${id}" data-blending="${live}" style="left:calc(${leftPercent.toFixed(3)}% + 14px)">${esc(seamCaption(previous?.name,scene,fraction))}</span>`;
 return band+caption;
}

/** One walked scene: its span on the expression clock, and the seam into it (null for the first scene). */
export interface JourneyStep {index:number;sceneId:string;name:string;start:number;end:number;seam:{label:string;blends:boolean}|null}
/** The journey path at one instant: the walk, where playback stands, the blend in force, and the scene next after it. */
export interface JourneyPath {
 steps:JourneyStep[];total:number;loop:boolean;
 position:{index:number;name:string;local:number;time:number}|null;
 edge:{from:string;to:string;fraction:number;label:string}|null;
 next:{index:number;name:string;wraps:boolean}|null;
}

/** T8, pure: the journey's walked path at journey time `time`. The steps are the authored sequence with their seams; the
 * position is the scene the clock stands in (the same half-open rule as the strip's playhead); the edge is the blend in force
 * there, from the scene before to the scene at the position; `next` wraps to the first scene only when the journey loops. */
export function walkJourney(journey:Pick<Journey,'scenes'|'loop'>,timing:TimelineTimingFn,time:number):JourneyPath{
 const layout=journeyTimelineLayout(journey.scenes,timing,100);
 const steps:JourneyStep[]=journey.scenes.map((scene,index)=>({
  index,sceneId:scene.id,name:scene.name,start:layout.clips[index].start,end:layout.clips[index].end,
  seam:index>0?{label:seamLabel(scene.transitionSpec,scene.transition),blends:seamBlends(scene.transitionSpec,scene.transition)}:null,
 }));
 const hit=sceneAtTime(layout,time),index=hit?journey.scenes.findIndex(s=>s.id===hit.sceneId):-1;
 const position=hit&&index>=0?{index,name:journey.scenes[index].name,local:hit.local,time:Math.min(Math.max(time,0),layout.total)}:null;
 const seams=seamStates(journey.scenes,timing,time);
 const fraction=position?seams[position.index].fraction:null;
 const edge=position&&fraction!==null&&position.index>0
  ?{from:journey.scenes[position.index-1].name,to:journey.scenes[position.index].name,fraction,label:seamLabel(journey.scenes[position.index].transitionSpec,journey.scenes[position.index].transition)}
  :null;
 const n=journey.scenes.length;
 let next:JourneyPath['next']=null;
 if(position){
  if(position.index+1<n)next={index:position.index+1,name:journey.scenes[position.index+1].name,wraps:false};
  else if(journey.loop&&n>0)next={index:0,name:journey.scenes[0].name,wraps:true};
 }
 return {steps,total:layout.total,loop:journey.loop,position,edge,next};
}
