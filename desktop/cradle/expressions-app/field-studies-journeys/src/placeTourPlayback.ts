/** Lane-4 T25 — playback of a tour as camera flights. The timings are the pure timeline (placeTourSteps); this only
 * schedules them. Each stop flies, then its caption is announced at arrival, then the tour holds and moves on. Stopping
 * clears every pending step, so a stopped tour never flies again. */
import {placeTourSteps, type PlaceTourRecord} from './placeTours.js';
import type {PlaceViewState} from '../../vendor/research-canvas/packages/canvas/src/psychogeographic/placeNavigation';

export interface PlaceTourPlayback {stop():void}

export interface PlaceTourPlaybackOptions {
 reducedMotion:boolean;
 /** One camera flight for a stop; the map applies it (a jump under reduced motion). */
 fly:(camera:PlaceViewState,durationMs:number)=>void;
 /** Called at each stop's arrival with its caption (null when the stop has none) and its index. */
 onArrive:(caption:string|null,index:number)=>void;
 /** Called once, when the last hold ends, or never if the tour was stopped first. */
 onDone:()=>void;
}

export function playPlaceTour(tour:PlaceTourRecord,options:PlaceTourPlaybackOptions):PlaceTourPlayback{
 const {steps}=placeTourSteps(tour,{reducedMotion:options.reducedMotion});
 const timers:ReturnType<typeof setTimeout>[]=[];
 let stopped=false;
 for(const step of steps){
  timers.push(setTimeout(()=>{if(!stopped)options.fly(step.camera,step.arriveMs-step.startMs);},step.startMs));
  timers.push(setTimeout(()=>{if(!stopped)options.onArrive(step.caption,step.index);},step.arriveMs));
 }
 const last=steps[steps.length-1];
 if(!last){stopped=true;options.onDone();return {stop(){}};}
 timers.push(setTimeout(()=>{if(!stopped){stopped=true;options.onDone();}},last.endMs));
 return {stop(){stopped=true;for(const timer of timers)clearTimeout(timer);}};
}
