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
import {kindLabel,transitionKindOf,switchModeOf,switchLabel,curveLabel,seamEdgeSpec,writeLoopExit,edgeEditLabel,type TransitionSpec,type SwitchMode,type CurveType,type CurveHandle} from './transitions';
import type {JourneyEditRequest} from './journeyBeats';
import {journeyTimelineLayout,sceneAtTime,type TimelineTimingFn} from './journeyTimelineLayout';

/** One decimal place, with its unit: "1.5 s". */
export function formatSeconds(seconds:number):string{return `${(Math.round(seconds*10)/10).toFixed(1)} s`;}

/** A seam blends only when its kind is a blend and it lasts time. A cut kind, or zero seconds, is a cut: the engine plays no
 * transition there, so the timeline draws none. */
export function seamBlends(spec:TransitionSpec|undefined|null,seconds:number):boolean{return transitionKindOf(spec)!=='cut'&&seconds>0;}

/** The seam's caption: "Cut", or the kind and its seconds ("Crossfade · 1.5 s"). */
export function seamLabel(spec:TransitionSpec|undefined|null,seconds:number):string{
 // Lane-5 T5: a non-default switch mode and curve are named after the kind, so the seam's whole meaning reads on the edge.
 const mode=switchModeOf(spec),edge=[mode!=='immediate'?switchLabel(mode):null,spec?.curve?curveLabel(spec.curve.type):null].filter((part):part is string=>part!==null);
 const tail=edge.length?` · ${edge.join(' · ')}`:'';
 return seamBlends(spec,seconds)?`${kindLabel(transitionKindOf(spec))} · ${formatSeconds(seconds)}${tail}`:`Cut${tail}`;
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
 /** T8: where playback stops instead of wrapping: the last Scene, when the journey loops and that Scene's exit is a loop exit. */
 stop:{index:number;name:string}|null;
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
 // T8: a loop exit on the last Scene is where the loop stops; the journey does not wrap from it.
 const exit=journey.loop&&n>0&&journey.scenes[n-1].breakAtEnd===true;
 let next:JourneyPath['next']=null;
 if(position){
  if(position.index+1<n)next={index:position.index+1,name:journey.scenes[position.index+1].name,wraps:false};
  else if(journey.loop&&n>0&&!exit)next={index:0,name:journey.scenes[0].name,wraps:true};
 }
 const stop=exit?{index:n-1,name:journey.scenes[n-1].name}:null;
 return {steps,total:layout.total,loop:journey.loop,position,edge,next,stop};
}

/** Lane-5 T5 / T8: the edges the path panel edits, each with the parameters it moves. A seam row is a Scene's entering seam: its
 * switch mode and curve. The loop row is the wrap from the last Scene to the first: the first Scene's entering seam (the wrap blend
 * a loop plays) and the last Scene's loop exit. The loop row exists only when the journey loops. */
export interface EdgeRow {
 kind:'seam'|'loop';enterSceneId:string;exitSceneId:string|null;from:string;to:string;
 switchMode:SwitchMode;curve:CurveType;breakAtEnd:boolean;label:string;
}
export function edgeRows(journey:Pick<Journey,'scenes'|'loop'>):EdgeRow[]{
 const s=journey.scenes,rows:EdgeRow[]=[];
 for(let i=1;i<s.length;i++){
  const spec=s[i].transitionSpec;
  rows.push({kind:'seam',enterSceneId:s[i].id,exitSceneId:null,from:s[i-1].name,to:s[i].name,switchMode:switchModeOf(spec),curve:spec?.curve?.type??'linear',breakAtEnd:false,label:seamLabel(spec,s[i].transition)});
 }
 if(journey.loop&&s.length){
  const first=s[0],last=s[s.length-1],spec=first.transitionSpec,exit=last.breakAtEnd===true;
  rows.push({kind:'loop',enterSceneId:first.id,exitSceneId:last.id,from:last.name,to:first.name,switchMode:switchModeOf(spec),curve:spec?.curve?.type??'linear',breakAtEnd:exit,
   label:`${last.name} → ${first.name} · ${exit?'Stops at end':'Loops'}`});
 }
 return rows;
}

/** Lane-5 T5 / T8: one edit the path panel asks for. A switch or curve edit names the Scene it enters; a loop edit names the last
 * Scene, whose exit it is. A curve edit carries the whole curve: its type and, for a bezier, its handles (out and in). Absent handles
 * are the type alone, so a bezier with none takes E08's seed, as the path panel's own select always has. */
export type EdgeEdit={kind:'switch';enterSceneId:string;mode:SwitchMode}|{kind:'curve';enterSceneId:string;type:CurveType;out?:CurveHandle;in?:CurveHandle}|{kind:'loop';exitSceneId:string;on:boolean};
/** The write an accepted edit makes to one Scene: its seam spec (undefined = the default) or its loop exit. */
export type EdgeWrite={sceneId:string;field:'transitionSpec';spec:TransitionSpec|undefined}|{sceneId:string;field:'breakAtEnd';on:boolean};
export type EdgePlan={ok:true;write:EdgeWrite;label:string}|{ok:false;reason:string};

/** Lane-5 T5 / T8: the curve a curve edit carries, whole. Linear is the absent curve. Handles are present only when the edit has them. */
function curveOfEdit(edit:Extract<EdgeEdit,{kind:'curve'}>):TransitionSpec['curve']{
 if(edit.type==='linear')return undefined;
 return {type:edit.type,...(edit.out?{out:edit.out}:{}),...(edit.in?{in:edit.in}:{})};
}

/** Lane-5 T5 / T8, pure: plans one edge edit. Validation is the transition's own, and each refusal is named. The plan is applied by
 * applyEdgeWrite, or sent as one native edit by nativeEdgeRequest. */
export function planEdgeEdit(journey:Pick<Journey,'scenes'>,edit:EdgeEdit):EdgePlan{
 try{
  if(edit.kind==='loop'){
   const scene=journey.scenes.find(s=>s.id===edit.exitSceneId);
   if(!scene)return {ok:false,reason:'That scene is no longer in this expression.'};
   return {ok:true,write:{sceneId:scene.id,field:'breakAtEnd',on:edit.on},label:edgeEditLabel({kind:'loop',on:edit.on})};
  }
  const scene=journey.scenes.find(s=>s.id===edit.enterSceneId);
  if(!scene)return {ok:false,reason:'That scene is no longer in this expression.'};
  const spec=edit.kind==='switch'
   ?seamEdgeSpec(scene.transitionSpec,{switchMode:edit.mode})
   :seamEdgeSpec(scene.transitionSpec,{curve:curveOfEdit(edit)});
  return {ok:true,write:{sceneId:scene.id,field:'transitionSpec',spec},label:edgeEditLabel(edit.kind==='switch'?{kind:'switch',mode:edit.mode}:{kind:'curve',type:edit.type})};
 }catch(cause){return {ok:false,reason:cause instanceof Error?cause.message:String(cause)};}
}

/** Lane-5 T5 / T8: applies one planned write to the Scenes of an expression. The caller runs it inside the labelled edit. */
export function applyEdgeWrite(scenes:Array<{id:string;transitionSpec?:TransitionSpec;breakAtEnd?:boolean}>,write:EdgeWrite):void{
 if(write.field==='breakAtEnd'){writeLoopExit(scenes,write.sceneId,write.on);return;}
 const scene=scenes.find(s=>s.id===write.sceneId);
 if(!scene)throw new Error('That scene is no longer in this expression.');
 if(write.spec)scene.transitionSpec=JSON.parse(JSON.stringify(write.spec));else delete scene.transitionSpec;
}

/** The native view an edge edit reads: the owner's Expression with each Scene's authored material, and the binding of each frame
 * Scene to its native reference. These are the instrument's own read shapes; the owner answers them for the open Expression. */
export interface NativeEdgeView {
 expression:{expression_ref:string;revision:number;scenes:ReadonlyArray<{scene_ref:string;presentation?:{schema:string;scene:unknown;saved?:unknown}|null}>};
 bindings:Readonly<Record<string,{scene_ref:string}>>;
}
/** Lane-5 T5 / T8, pure: one hosted edge edit as the instrument's existing native edit. The Scene's authored material is read from
 * the owner, the edit is applied to a copy of it through the same write the local path uses, and the result is one
 * `scene_material_set` on the captured revision: one request, one owner revision, one labelled composite. */
export function nativeEdgeRequest(view:NativeEdgeView,edit:EdgeEdit,actor='human:expressions-app'):{ok:true;request:JourneyEditRequest;label:string}|{ok:false;reason:string}{
 const sceneId=edit.kind==='loop'?edit.exitSceneId:edit.enterSceneId;
 const ref=view.bindings[sceneId]?.scene_ref;
 if(!ref)return {ok:false,reason:'That scene has no native reference in this Expression.'};
 const record=view.expression.scenes.find(s=>s.scene_ref===ref);
 const presentation=record?.presentation;
 if(!record||!presentation||presentation.schema!=='oi.journey-scene/v1'||!presentation.scene||typeof presentation.scene!=='object')
  return {ok:false,reason:'That scene has no authored native material to change.'};
 const material=JSON.parse(JSON.stringify(presentation.scene)) as Scene;
 if(material.id!==sceneId)return {ok:false,reason:'That scene is not the native material bound to it.'};
 const plan=planEdgeEdit({scenes:[material]},edit);
 if(!plan.ok)return plan;
 applyEdgeWrite([material],plan.write);
 return {ok:true,label:plan.label,request:{
  operation:'edit',expression_ref:view.expression.expression_ref,expected_revision:view.expression.revision,actor,
  changes:[{change:'scene_material_set',scene_ref:ref,presentation:{schema:'oi.journey-scene/v1',scene:material,saved:presentation.saved??null}}],
 }};
}
/** Lane-5 T5 / T8: the words an edge edit's owner reply is shown in. Saved names the edit; a revision conflict says nothing was
 * written; any other refusal passes the owner's own reason through by name. */
export function edgeReplyMessage(reply:unknown,label:string):{ok:boolean;text:string}{
 const r=(reply??{}) as {state?:string;current_revision?:number;error?:string;reason?:string};
 if(r.state==='ready')return {ok:true,text:`${label}: saved.`};
 if(r.state==='revision_conflict')return {ok:false,text:`${label} was not written: this Expression changed elsewhere (now revision ${r.current_revision}). Refresh and try again.`};
 const named=r.error??r.reason;
 return {ok:false,text:named?`${label} was refused by the native owner: ${named}`:`${label} was refused by the native owner (state ${String(r.state)}).`};
}
/** Lane-5 T5 / T8: the words for an edge edit the owner rejected outright, with the owner's own message. */
export function edgeErrorMessage(label:string,cause:string):string{return `${label} was refused by the native owner: ${cause}`;}
