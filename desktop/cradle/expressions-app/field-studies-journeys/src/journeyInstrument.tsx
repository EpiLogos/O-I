import type {ReactElement,PointerEvent as ReactPointerEvent} from 'react';
import {useEffect,useState} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import type {KernelConversion,KernelSceneTrigger} from './kernelDocumentBridge';
import type {TechneReading} from '../../../src/techne/contract';
import {draftFromBeats,moveBeat} from '../../../src/techne/m0m5/journey/sequence';
import {beats,sceneTitle} from '../../../src/techne/m0m5/journey/beats';
import type {NativeTimeWindowReply} from '../../../../../packages/expressions-boundary/src/timeWindow';
import {journeyReturnNotice} from './sharedTimeWindow.js';
import {journeyBeatView,reorderSceneRequest,restoredBeatNotice,type JourneyBeatCard,type JourneyBeatView,type JourneyEditRequest} from './journeyBeats';
import type {Journey} from './model';
import {expressionTiming} from './propertyTracks';
import {walkJourney,edgeRows,nativeEdgeRequest,edgeReplyMessage,edgeErrorMessage,type JourneyPath,type EdgeRow,type EdgeEdit} from './journeyPath';
import {SWITCH_MODES,CURVE_TYPES,switchLabel,curveLabel,transitionKindOf,edgeEditRefusal,type SwitchMode,type CurveType,type TransitionSpec} from './transitions';
import {beatLoadKey,settleBounded} from './journeyLoadSchedule';
import {reconcileJourneyPresence,recordJourneyPosition,savedJourneyPosition,paceDraftOf,savePaceDraft} from './journeyPresence';
import {paceViewOf,setPace,newPaceDraft,sequenceOfDraft,draftForPresence,planPaceCommit,type JourneyPaceView} from './journeyPace';
import {SCENE_DURATION_MIN,SCENE_DURATION_MAX} from './model';
import type {SequenceDraft} from '../../../src/techne/m0m5/journey/sequence';
import {journeyInstrumentBasis,sameJourneyInstrumentBasis,readJourneyInstrument,readJourneySceneFrame,prepareJourneyBeatFocus,type JourneyBeatFocus,type JourneyInstrumentBasis} from './journeyInstrumentModel';
import './journeyInstrument.css';

/** T8: the playback clock as the host runs it: the journey as its clock reads it (a saved-sequence run passes the saved
 * durations), and the expression time on that clock. The walked path is derived from this and nothing else. */
export interface JourneyPlaybackClock {journey:Journey;time:number}

/** T12: the labels a beat's source portal carries, by placement. re_dock returns to a scene and is never offered as a source. */
const PORTAL_LABEL:Record<string,string>={preview:'Preview source',overlay:'Overlay source',beside:'Open beside',full:'Open full',detached:'Detach source'};
/** T12: the Scene's own explicit activation portals, the ones a beat can place. A Scene with none offers none. */
export function journeyPortalTriggers(native:KernelConversion,sceneRef:string):KernelSceneTrigger[]{
 const binding=Object.values(native.bindings).find(entry=>entry.scene_ref===sceneRef);
 return (binding?.triggers??[]).filter(trigger=>trigger.occasion==='activate'&&trigger.target.kind==='portal'&&trigger.target.placement!=='re_dock');
}
export function journeyPortalLabel(trigger:KernelSceneTrigger):string{
 return (trigger.target.kind==='portal'&&PORTAL_LABEL[trigger.target.placement])||'Open source';
}

export interface JourneyInstrumentHost {
 nativeView:()=>KernelConversion|undefined;sceneId:()=>string;
 /** T12: place a Scene's own source portal through the host, which opens it in its disclosed placement; the host's
  * "Return to scene" closes it and the journey position is untouched. Absent: no portal affordance is drawn. */
 portal?:(trigger:KernelSceneTrigger,basis:JourneyInstrumentBasis)=>Promise<unknown>;
 /** T8: the live playback clock, or undefined when no journey plays here. Without it the walked path is not shown. */
 playback?:()=>JourneyPlaybackClock|undefined;
 /** T8: seek the playhead to a journey time in seconds; the walked path's scenes are seekable through it. */
 seek?:(seconds:number)=>void;
 /** One native reading. Without `scope` it is the Scene's own reading; with
  * `scope: 'expression'` it is the whole Expression's disclosure (every bound
  * Scene, in document order). */
 read:(basis:JourneyInstrumentBasis,scope?:'expression')=>Promise<unknown>;
 /** The retained native Scene focus operation, with this captured source
  * basis verified again by its receiver. No array-index selection. */
 focusScene:(input:JourneyBeatFocus)=>Promise<unknown>;
 /** The native edit channel the compose form also uses. Resolves with the
  * owner's reply, unchanged; nothing is persisted by the instrument. */
 editExpression:(request:JourneyEditRequest)=>Promise<unknown>;
 /** T3: save a paced draft as one labelled step through the owner's Save path (E15/E16). Each edit names a journey scene and its
  * seconds. Resolves true when the owner acknowledged it, false when it did not (its reason is on the Expression status line).
  * Absent: the pace draft stays local and cannot be saved. */
 commitPace?:(edits:{sceneId:string;seconds:number}[],label:string)=>Promise<boolean>;
 /** T10: enter the presented beat's Scene from the Journey through the owner's crossing (the session's one history). Absent: no crossing affordance. */
 crossing?:(basis:JourneyInstrumentBasis,scene:TechneReading,sceneRef:string)=>Promise<NativeTimeWindowReply>;
 /** T11: return from the Expression reading to the beat the crossing entered, by ref, through the owner's return. */
 returning?:(basis:JourneyInstrumentBasis,scene:TechneReading,crossed:NativeTimeWindowReply)=>Promise<NativeTimeWindowReply>;
 /** T10: the Journey has crossed into the Expression reading; the host presents it. */
 entered?:()=>void;
}

/** Beat-card drag: the same grammar as the timeline strip's scene clip drag
 * (4px threshold, grabbing cursor, dimmed source, one insert line at the drop
 * edge, a click suppressed after a move). One drag at a time, module-scoped. */
type BeatDrag={ref:string;from:number;startX:number;startY:number;item:HTMLElement;lane:HTMLElement;moved:boolean;to:number};
let beatDrag:BeatDrag|null=null;
let beatDragGuard=0;
/** The list runs as a row on the instrument and as a column in the home panel;
 * the drag reads whichever axis the list itself flows on. */
function beatAxisOf(lane:HTMLElement):'row'|'column'{
 const list=lane.querySelector<HTMLElement>(':scope > ol');
 return list&&getComputedStyle(list).flexDirection==='column'?'column':'row';
}
function paintBeatDrop(lane:HTMLElement,others:HTMLElement[],to:number,axis:'row'|'column'){
 const line=lane.querySelector<HTMLElement>('.scene-insert-line');if(!line)return;
 const laneRect=lane.getBoundingClientRect();
 line.hidden=false;
 if(axis==='column'){
  const edge=to<others.length?others[to].getBoundingClientRect().top:others.length?others[others.length-1].getBoundingClientRect().bottom:laneRect.top;
  line.style.left='';line.style.top=`${edge-laneRect.top}px`;
 }else{
  const edge=to<others.length?others[to].getBoundingClientRect().left:others.length?others[others.length-1].getBoundingClientRect().right:laneRect.left;
  line.style.top='';line.style.left=`${edge-laneRect.left}px`;
 }
}
function beginBeatDrag(ev:ReactPointerEvent<HTMLLIElement>,from:number,cards:readonly JourneyBeatCard[],onMove:(sceneRef:string,toIndex:number)=>void){
 if(ev.button!==0||beatDrag)return;
 const item=ev.currentTarget,lane=item.closest<HTMLElement>('.journey-beat-lane');
 if(!lane)return;
 const axis=beatAxisOf(lane);
 lane.dataset.axis=axis;
 const drag:BeatDrag={ref:cards[from].scene_ref,from,startX:ev.clientX,startY:ev.clientY,item,lane,moved:false,to:from};
 beatDrag=drag;
 const move=(next:PointerEvent)=>{
  const along=axis==='column'?next.clientY-drag.startY:next.clientX-drag.startX;
  if(!drag.moved&&Math.abs(along)<4)return;
  drag.moved=true;document.body.classList.add('moving-scene');item.dataset.drag='insert';
  const others=[...lane.querySelectorAll<HTMLElement>(':scope > ol > li')].filter(row=>row!==item);
  const pointer=axis==='column'?next.clientY:next.clientX;
  drag.to=others.filter(row=>{const rect=row.getBoundingClientRect();return axis==='column'?rect.top+rect.height/2<pointer:rect.left+rect.width/2<pointer;}).length;
  paintBeatDrop(lane,others,drag.to,axis);
 };
 const finish=(commit:boolean)=>{
  document.removeEventListener('pointermove',move);document.removeEventListener('pointerup',up);document.removeEventListener('pointercancel',cancel);
  document.body.classList.remove('moving-scene');delete item.dataset.drag;
  const line=lane.querySelector<HTMLElement>('.scene-insert-line');if(line)line.hidden=true;
  beatDrag=null;
  if(!drag.moved)return;
  beatDragGuard=performance.now()+400;
  if(commit&&drag.to!==drag.from)onMove(drag.ref,drag.to);
 };
 const up=()=>finish(true),cancel=()=>finish(false);
 document.addEventListener('pointermove',move);document.addEventListener('pointerup',up);document.addEventListener('pointercancel',cancel);
}

/** T8: the walked journey path beneath the beats: the scenes in order with their seams, the scene the clock stands in, the
 * blend in force, and the scene next after it. Each scene seeks the playhead. The clock is polled, so a paused or scrubbed
 * playhead reads the same way a playing one does. */
/** Lane-5 T5 / T8: the path panel's edge controls exist on the native owner's journey. Each change is handed to the instrument, which
 * sends it as one native edit (or shows the named refusal). Off the native owner there is no edit channel, so no controls. */
export type JourneyPathEdit=(edit:EdgeEdit)=>void;
function JourneyPlaybackPath({read,seek,edit}:{read:()=>JourneyPlaybackClock|undefined;seek:(seconds:number)=>void;edit?:JourneyPathEdit}):ReactElement|null{
 const [clock,setClock]=useState<JourneyPlaybackClock|undefined>(()=>read());
 useEffect(()=>{const id=window.setInterval(()=>setClock(read()),200);return ()=>window.clearInterval(id);},[read]);
 if(!clock||!clock.journey.scenes.length)return null;
 const journey=clock.journey;
 const path:JourneyPath=walkJourney(journey,(index,local)=>expressionTiming(journey,index,local),clock.time);
 const rows=edgeRows(journey);
 const send=(next:EdgeEdit)=>{if(edit)edit(next);};
 const edgeControls=(enterSceneId:string,name:string,row:EdgeRow)=>{
  // T5: a cut has no curve, so its path row offers none.
  const takesCurve=transitionKindOf(journey.scenes.find(v=>v.id===enterSceneId)?.transitionSpec)!=='cut';
  return edit?<span className="journey-path-controls">
  <select aria-label={`Switch into ${name}`} title="When the switch lands" value={row.switchMode} onChange={ev=>send({kind:'switch',enterSceneId,mode:ev.target.value as SwitchMode})}>{SWITCH_MODES.map(m=><option key={m} value={m}>{switchLabel(m)}</option>)}</select>
  {takesCurve?<select aria-label={`Curve into ${name}`} title="The blend's curve" value={row.curve} onChange={ev=>send({kind:'curve',enterSceneId,type:ev.target.value as CurveType})}>{CURVE_TYPES.map(t=><option key={t} value={t}>{curveLabel(t)}</option>)}</select>:null}
 </span>:null;
 };
 const seamRow=(id:string)=>rows.find(row=>row.kind==='seam'&&row.enterSceneId===id);
 const loopRow=rows.find(row=>row.kind==='loop');
 return <section className="journey-playback-path" aria-label="Journey playback path">
  <header><h3>Playback</h3>{path.position?<span className="journey-path-clock">Scene {path.position.index+1} of {path.steps.length} · {path.position.time.toFixed(1)} / {path.total.toFixed(1)} s</span>:null}</header>
  <ol className="journey-path-steps">{path.steps.map(step=>{const current=path.position?.index===step.index;return <li key={step.sceneId} className="journey-path-step" data-current={current}>
   <button type="button" className="journey-path-scene" aria-current={current?'step':undefined} title={`Play from ${step.start.toFixed(1)} s`} onClick={()=>seek(step.start)}>
    <span aria-hidden="true">{step.index+1}</span> {step.name}</button>
   <span className={`journey-path-seam${step.seam?step.seam.blends?'':' is-cut':' is-start'}`}>{step.seam?step.seam.label:'Start'}</span>
   {step.index>0&&seamRow(step.sceneId)?edgeControls(step.sceneId,step.name,seamRow(step.sceneId)!):null}
  </li>;})}</ol>
  {path.edge?<p className="journey-path-edge">{path.edge.from} → {path.edge.to} · {path.edge.label} · {Math.round(path.edge.fraction*100)}%</p>:null}
  {path.stop?<p className="journey-path-stop">Playback stops at the end of {path.stop.name}, instead of looping.</p>:null}
  {loopRow?<div className="journey-path-loop" data-loop-row>
   <span className="journey-path-seam">{loopRow.label}</span>
   {edgeControls(loopRow.enterSceneId,journey.scenes[0].name,loopRow)}
   {edit&&loopRow.exitSceneId?<label className="journey-path-stop-toggle"><input type="checkbox" checked={loopRow.breakAtEnd} onChange={ev=>send({kind:'loop',exitSceneId:loopRow.exitSceneId!,on:ev.target.checked})}/> Stop at the end instead of looping</label>:null}
  </div>:null}
  <p className="journey-path-next">{path.next?`Next: ${path.next.name}${path.next.wraps?' (loops to the start)':''}`:path.position?'The journey ends here.':'The playhead is outside the journey.'}</p>
 </section>;
}

/** T3: the pace actions the panel offers. Each is one local step; only `save` reaches the Expression, and only as one labelled step. */
export interface JourneyPaceActions {set:(sceneRef:string,seconds:number)=>void;save:()=>void;discard:()=>void;reapply:()=>void}
/** T3: the pace status line, in the journey's notice voice. A draft says it is unsaved; a stale draft says why it is not applied. */
function JourneyPaceStatus({pace,busy,actions}:{pace:JourneyPaceView;busy:boolean;actions:JourneyPaceActions}):ReactElement|null{
 if(pace.standing==='none')return null;
 if(pace.standing==='stale')return <div className="journey-pace-status" data-pace-standing="stale" role="status">
  <p>This pace draft was taken at revision {pace.basisRevision ?? 'an earlier one'}, or on another reading. The Expression has moved on, so the draft is not applied. Re-apply it to this revision, or discard it.</p>
  <span className="journey-pace-actions"><button type="button" disabled={busy} onClick={actions.reapply}>Re-apply draft</button><button type="button" disabled={busy} onClick={actions.discard}>Discard draft</button></span>
 </div>;
 return <div className="journey-pace-status" data-pace-standing="draft" role="status">
  <p>Pace draft: {pace.count} {pace.count===1?'beat':'beats'} not saved. Nothing reaches the Expression until you save the pace.</p>
  <span className="journey-pace-actions"><button type="button" disabled={busy||!pace.canSave} title={pace.canSave?undefined:'Saving the pace needs the native Expression open'} onClick={actions.save}>Save pace</button><button type="button" disabled={busy} onClick={actions.discard}>Discard draft</button></span>
 </div>;
}
export function JourneyBeatPanel({reading,beatView,native,basis,busy,onFocus,onMove,onRefresh,playback,notice,onPortal,onEnter,pace,paceActions}:{
 reading:TechneReading;beatView:JourneyBeatView;native:KernelConversion;basis:JourneyInstrumentBasis;busy:boolean;
 onFocus:(card:JourneyBeatCard)=>void;onMove:(sceneRef:string,toIndex:number)=>void;onRefresh:()=>void;
 playback?:{read:()=>JourneyPlaybackClock|undefined;seek:(seconds:number)=>void;edit?:()=>JourneyPathEdit|undefined};
 /** T12: place one of a beat's own source portals. Absent: no portal affordance. */
 onPortal?:(trigger:KernelSceneTrigger,card:JourneyBeatCard)=>void;
 /** T9: the presence disclosure for this load (field moved / stale), one plain sentence. */
 notice?:string;
 /** T10: enter this beat's Scene in the Expression reading. Absent: no crossing affordance. */
 onEnter?:(card:JourneyBeatCard)=>void;
 /** T3: the pace of each beat and its local draft. Absent: no pace affordance. */
 pace?:JourneyPaceView;paceActions?:JourneyPaceActions;
}):ReactElement{
 const cards=beatView.cards;
 return <section className="journey-beat-panel" aria-label="Reading-derived Journey">
  <header><h3>Journey</h3><button type="button" disabled={busy} onClick={onRefresh}>Refresh reading</button></header>
  {notice?<p className="journey-presence-notice" role="status">{notice}</p>:null}
  {pace&&paceActions?<JourneyPaceStatus pace={pace} busy={busy} actions={paceActions}/>:null}
  {!cards.length?<p role="status">{beatView.unavailableReason}</p>:<div className="journey-beat-lane">
   <ol className="journey-reading-beats">{cards.map((card,index)=>{
    const scene=native.document.scenes.find(item=>item.scene_ref===card.scene_ref);
    const saved=pace?.saved[card.scene_ref]??null,drafted=pace?.drafted[card.scene_ref],shown=drafted??saved;
    // T3: a beat's pace is editable while the draft stands on this basis, the beat is open here, and it has authored material to retime.
    const editable=!!pace&&!!paceActions&&pace.standing!=='stale'&&pace.paceable&&!busy&&card.onBasis&&saved!==null;
    return <li key={`${card.expression_ref}\0${card.scene_ref}\0${index}`} className="journey-beat-item" data-expression-ref={card.expression_ref} data-scene-ref={card.scene_ref}
     onPointerDown={ev=>{if(!busy)beginBeatDrag(ev,index,cards,onMove);}}>
     <button type="button" className="journey-beat-card" disabled={busy||!card.onBasis} aria-current={basis.scene_ref===card.scene_ref?'step':undefined}
      onClick={()=>{if(performance.now()>=beatDragGuard)onFocus(card);}}
      title={card.onBasis?'Open this native Scene':'Open the bound native Expression at its disclosed revision first'}>
      <span aria-hidden="true" className="journey-beat-number">{index+1}</span>
      <strong>{scene?.title||card.title}</strong>
      <span className="journey-beat-chips">{card.chips.map((chip,i)=><span key={`${chip.kind}:${i}`} className={`journey-beat-chip journey-beat-chip-${chip.kind}`} data-facet={chip.kind} title={chip.ref??undefined}>{chip.label}</span>)}</span>
      {card.chipsReason?<span className="journey-beat-reason">{card.chipsReason}</span>:null}
     </button>
     {pace&&paceActions?<label className="journey-beat-pace" data-pace-state={drafted!==undefined?'draft':'saved'} onPointerDown={ev=>ev.stopPropagation()}>
      <span className="journey-beat-pace-state">{saved===null?'No saved length':drafted!==undefined?'Draft · not saved':'Saved'}</span>
      {/* The key carries the saved length and the epoch, never the typed value, so typing keeps focus; a save, discard or re-apply remounts it. */}
      <input key={`${card.scene_ref}\0${saved}\0${pace.epoch}`} type="number" inputMode="decimal" min={SCENE_DURATION_MIN} max={SCENE_DURATION_MAX} step="0.1"
       aria-label={`Hold ${scene?.title||card.title} for seconds`} defaultValue={shown??undefined} disabled={!editable}
       onChange={ev=>{const seconds=ev.currentTarget.valueAsNumber;if(Number.isFinite(seconds))paceActions.set(card.scene_ref,seconds);}}/>
      <span aria-hidden="true">s</span>
     </label>:null}
     {onEnter?<button type="button" className="journey-beat-enter" data-journey-enter={card.scene_ref} disabled={busy||!card.onBasis||basis.scene_ref!==card.scene_ref}
      title={card.onBasis&&basis.scene_ref===card.scene_ref?'Enter this Scene in the Expression reading; Return to journey brings you back to this beat':'Open this Scene first to enter it'}
      onClick={()=>onEnter(card)}>Enter in Expression</button>:null}
     {onPortal?journeyPortalTriggers(native,card.scene_ref).map(trigger=>{
      const current=card.onBasis&&basis.scene_ref===card.scene_ref;
      return <button key={trigger.trigger_ref} type="button" className="journey-beat-portal" data-journey-portal={trigger.trigger_ref} disabled={!current}
       title={current?'Place this Scene\'s source; Return to scene closes it':'Open this Scene first to place its source'}
       onClick={()=>onPortal(trigger,card)}>{journeyPortalLabel(trigger)}</button>;
     }):null}
    </li>;
   })}</ol>
   <span className="scene-insert-line" aria-hidden="true" hidden/>
  </div>}
  {playback?<JourneyPlaybackPath read={playback.read} seek={playback.seek} edit={playback.edit?.()}/>:null}
  <p className="journey-reading-source">{reading.subject.subject_ref}</p>
 </section>;
}

/** Reading-derived beats beside the existing saved Scene strip. This is a
 * presentation of the source's own bindings, with no second Journey store,
 * proposed timing, playback clock or undisclosed native operations. */
export function installJourneyInstrument(host:JourneyInstrumentHost,home:HTMLElement){
 const mount=document.createElement('section'),status=document.createElement('p');
 mount.className='journey-reading-workspace';mount.hidden=true;status.setAttribute('role','status');status.hidden=true;home.append(status,mount);
 let root:Root|null=null,epoch=0,open=false,destroyed=false;
 /** T-REVIEW-4 #6: the load in flight, by the basis it reads. A refresh for the same basis joins it instead of starting a second. */
 let inFlight:{key:string;done:Promise<void>}|undefined;
 /** T9: the Expression-wide reading last held, by its native basis. The strip records a Scene change against it without a read. */
 let held:{expression_ref:string;revision:number;reading:TechneReading}|undefined;
 let restoring:Promise<boolean>|undefined;
 /** T10: the crossing this instrument made and has not yet returned from: the owner's acknowledged reply is the compare-and-set of its return. */
 let crossed:NativeTimeWindowReply|undefined;
 // T8/T5: the path's edge controls send through submitEdge, on the native owner's journey only.
 const playback=host.playback&&host.seek?{read:host.playback,seek:host.seek,edit:()=>host.nativeView()?submitEdge:undefined}:undefined;
 const current=(basis:JourneyInstrumentBasis,generation:number)=>!destroyed&&open&&epoch===generation&&sameJourneyInstrumentBasis(basis,host.nativeView(),host.sceneId());
 const message=(text:string)=>{status.textContent=text;};
 const failure=(cause:unknown)=>cause instanceof Error?cause.message:String(cause);
 // Lane-5 T5 / T8: a hosted edge edit is one native edit through the instrument's own edit channel: one scene_material_set on the
 // captured revision, labelled by its composite. The owner's reply names the outcome; a refusal passes the owner's reason through.
 // An edit made outside the instrument (the timeline's seam chooser) also reports through `notify`, so its outcome — a refusal
 // above all — is seen where it was made, even while this instrument's status line is hidden.
 const submitEdge=(edit:EdgeEdit,notify?:(text:string)=>void)=>{
  const say=(text:string)=>{message(text);notify?.(text);};
  const view=host.nativeView();
  if(!view){say('The native Expression is not open, so nothing was written.');return;}
  let routed:ReturnType<typeof nativeEdgeRequest>;
  try{routed=nativeEdgeRequest({expression:view.document,bindings:view.bindings},edit);}catch(error){say(failure(error));return;}
  if(!routed.ok){say(routed.reason);return;}
  // T5: a cut has no curve, and an edit the edge already has is named rather than sent as a no-op revision.
  const sceneId=edit.kind==='loop'?edit.exitSceneId:edit.enterSceneId,ref=view.bindings[sceneId]?.scene_ref;
  const before=(view.document.scenes as unknown as ReadonlyArray<{scene_ref:string;presentation?:{scene?:unknown}|null}>).find(s=>s.scene_ref===ref)?.presentation?.scene;
  const refusal=edit.kind!=='loop'?edgeEditRefusal((before as {transitionSpec?:TransitionSpec}|undefined)?.transitionSpec,edit):undefined;
  if(refusal){say(refusal);return;}
  const after=(routed.request.changes[0] as unknown as {presentation:{scene:unknown}}).presentation.scene;
  if(JSON.stringify(before)===JSON.stringify(after)){say(`${routed.label} changed nothing: this edge already has it.`);return;}
  const label=routed.label;
  void host.editExpression(routed.request).then(reply=>{
   const outcome=edgeReplyMessage(reply,label);
   if(!outcome.ok){say(outcome.text);return;}
   void load().then(()=>say(outcome.text));
  }).catch(error=>say(edgeErrorMessage(label,failure(error))));
 };
 const basisKey=():string|undefined=>{try{return beatLoadKey(journeyInstrumentBasis(host.nativeView(),host.sceneId()));}catch{return undefined;}};
 function load():Promise<void>{
  const key=basisKey(),done=loadBeats();
  if(key!==undefined){const entry={key,done};inFlight=entry;const clear=()=>{if(inFlight===entry)inFlight=undefined;};void done.then(clear,clear);}
  return done;
 }
 function reuseOrLoad():Promise<void>{
  const key=basisKey();
  if(key!==undefined&&inFlight?.key===key)return inFlight.done;
  return load();
 }
 async function loadBeats(){
  const generation=++epoch;
  try{
   const view=host.nativeView(),sceneId=host.sceneId(),basis=journeyInstrumentBasis(view,sceneId);
   message('Reading Journey…');
   // The Expression-wide disclosure: the cards and their order.
   const raw=await host.read(basis,'expression');
   if(destroyed||!open||generation!==epoch)return;
   if(!current(basis,generation))throw Error('The selected native Journey changed while its reading was returning');
   const {reading}=readJourneyInstrument(raw,view!,sceneId);
   held={expression_ref:basis.expression_ref,revision:basis.revision,reading};
   // T9: disclose the author's saved position against this reading, and record the position this load stands on.
   const presence=reconcileJourneyPresence({reading,expression_ref:basis.expression_ref,scene_ref:basis.scene_ref});
   // The cards draw from the whole read at once; each card's facets are filled in as its own Scene's reading settles.
   const frames=new Map<string,TechneReading|string>();
   let beatView=journeyBeatView(reading,view!.document);
   root??=createRoot(mount);
   let busy=false;
   const portal=host.portal;
   /** T10: enter the presented beat's Scene. Only the beat the native Scene already presents can be entered, so the owner's basis is this one. */
   const enter=(card:JourneyBeatCard)=>{
    const cross=host.crossing;
    if(!cross||busy||!current(basis,generation)||!card.onBasis||card.scene_ref!==basis.scene_ref)return;
    busy=true;draw();
    let scene:TechneReading|undefined;
    void host.read(basis).then(raw=>{
     if(!current(basis,generation))throw Error('The presented Scene changed while it was entered');
     scene=raw as TechneReading;
     return cross(basis,scene,card.scene_ref);
    }).then(reply=>{
     if(destroyed||!open||generation!==epoch)return;
     crossed=reply;busy=false;
     host.entered?.();
    }).catch(error=>{if(!destroyed&&open&&generation===epoch){busy=false;draw();message(failure(error));}});
   };
   // T3: the pace draft is local. Every change is saved to the presence entry (T9) with its basis; only `save` reaches the Expression,
   // as one labelled step through the host's Save path. A draft the browser would not keep is refused by name, never held twice.
   let paceEpoch=0;
   const paceStored=()=>paceDraftOf({reading,revision:basis.revision});
   const keepPace=(next:SequenceDraft|null):boolean=>savePaceDraft({reading,expression_ref:basis.expression_ref,scene_ref:basis.scene_ref,draft:next?draftForPresence(next,reading.reading_ref):null});
   const beatRefs=()=>beatView.cards.map(card=>card.scene_ref);
   const paceView=():JourneyPaceView=>paceViewOf({view:view!,sceneRefs:beatRefs(),stored:paceStored(),canSave:!!host.commitPace,epoch:paceEpoch});
   const paceActions:JourneyPaceActions={
    set:(sceneRef,seconds)=>{
     if(busy||!current(basis,generation))return;
     const stored=paceStored();
     if(stored?.standing==='stale'){message('This pace draft was taken at an earlier revision, so it is not applied. Re-apply it or discard it first.');return;}
     const base=stored?sequenceOfDraft(stored.draft,basis.expression_ref):newPaceDraft(basis.expression_ref,String(basis.revision),beatRefs());
     const next=setPace(base,sceneRef,seconds);
     if(!next.ok){message(next.reason);return;}
     if(!keepPace(next.draft)){message('This browser would not keep the pace draft, so the pace is unchanged. Nothing was saved to the Expression.');return;}
     draw();
    },
    save:()=>{
     const commit=host.commitPace;
     if(busy||!current(basis,generation)||!commit)return;
     const stored=paceStored();
     if(stored?.standing!=='current')return;
     const plan=planPaceCommit(view!,sequenceOfDraft(stored.draft,basis.expression_ref));
     if(!plan.ok){message(plan.reason);return;}
     if(!plan.edits.length){keepPace(null);paceEpoch++;message('Nothing to save: every beat already holds this pace.');draw();return;}
     const label=plan.label;
     busy=true;draw();
     void commit(plan.edits.map(edit=>({sceneId:edit.sceneId,seconds:edit.seconds})),label).then(acknowledged=>{
      if(destroyed)return;
      if(!acknowledged){busy=false;draw();message(`${label} was not accepted by the native owner. The draft is kept, and the change is in your working copy as its own step: undo it, or save again.`);return;}
      keepPace(null);paceEpoch++;busy=false;
      if(open)void load().then(()=>message(`${label}: saved.`));
     }).catch(error=>{if(destroyed)return;busy=false;draw();message(`${label} was refused: ${failure(error)}. The draft is kept.`);});
    },
    discard:()=>{
     if(busy||!current(basis,generation))return;
     keepPace(null);paceEpoch++;message('Pace draft discarded. Nothing was saved to the Expression.');draw();
    },
    reapply:()=>{
     if(busy||!current(basis,generation))return;
     const stored=paceStored();
     if(stored?.standing!=='stale')return;
     // Re-applying takes the draft onto this revision as a draft again: the paced beats still in the Journey, nothing saved.
     const refs=beatRefs(),paced=stored.draft.pace.filter(entry=>refs.includes(entry.scene_ref));
     if(!paced.length){keepPace(null);paceEpoch++;message('The stale pace draft paced no beat of this Journey, so it was discarded.');draw();return;}
     if(!keepPace({...newPaceDraft(basis.expression_ref,String(basis.revision),refs),pace:paced})){message('This browser would not keep the pace draft, so it was not re-applied.');return;}
     paceEpoch++;message('Pace draft re-applied to this revision. Nothing is saved yet.');draw();
    },
   };
   const draw=()=>{if(!current(basis,generation))return;root!.render(<JourneyBeatPanel reading={reading} beatView={beatView} native={view!} basis={basis} busy={busy} onRefresh={()=>void reuseOrLoad()} playback={playback} notice={presence.notice} pace={paceView()} paceActions={paceActions} onEnter={host.crossing?enter:undefined}
    onPortal={portal?(trigger,card)=>{
     // T12: the source is placed by the host; its own return closes it, and this journey position is not changed.
     void portal(trigger,{expression_ref:basis.expression_ref,revision:basis.revision,scene_ref:card.scene_ref}).then(()=>{
      if(!destroyed&&open&&generation===epoch)message(`${card.title}: its source is placed. Return to scene closes it.`);
     }).catch(error=>{if(!destroyed&&open&&generation===epoch)message(failure(error));});
    }:undefined}
    onFocus={card=>{
     if(busy)return;
     try{
      const input=prepareJourneyBeatFocus(card,basis,host.nativeView(),host.sceneId());busy=true;draw();
      void host.focusScene(input).then(()=>{
       if(destroyed||!open||generation!==epoch)return;
       const adopted=host.nativeView();
       if(!adopted||adopted.document.expression_ref!==input.expression_ref||adopted.bindings[host.sceneId()]?.scene_ref!==input.target_scene_ref)throw Error('The native owner did not adopt the requested Journey Scene');
       void load();
      }).catch(error=>{if(!destroyed&&open&&generation===epoch){message(failure(error));busy=false;draw();}});
     }catch(error){message(failure(error));}
    }}
    onMove={(sceneRef,toIndex)=>{
     if(busy)return;
     // The draft is local and carries the disclosed order; the floor routes one scene_reorder or refuses with its reason.
     let routed:ReturnType<typeof reorderSceneRequest>;
     try{routed=reorderSceneRequest({reading,doc:view!.document,draft:moveBeat(draftFromBeats(beats(reading).beats,view!.document.expression_ref),sceneRef,toIndex)});}
     catch(error){message(failure(error));return;}
     if(!routed.ok){message(routed.reason);return;}
     busy=true;draw();
     void host.editExpression(routed.request).then(reply=>{
      if(destroyed||!open||generation!==epoch)return;
      const state=(reply as {state?:string;current_revision?:number}|null)?.state;
      if(state==='ready'){void load();return;}
      busy=false;draw();
      message(state==='revision_conflict'
       ?`This Expression changed elsewhere (now revision ${(reply as {current_revision?:number}).current_revision}). Nothing was reordered; refresh and try again.`
       :`The Expression owner did not accept the reorder (${String(state)}).`);
     }).catch(error=>{if(!destroyed&&open&&generation===epoch){busy=false;draw();message(failure(error));}});
    }}/>);};
   draw();message(beatView.unavailableReason??`${beatView.cards.length} native Scene bindings`);
   // Bounded fill (four reads in flight). A stale load, one whose basis or generation moved, schedules no further reads.
   const cards=beatView.cards;
   await settleBounded(cards,4,card=>{
    if(card.expression_ref!==basis.expression_ref||card.revision!==String(basis.revision))
     return Promise.reject(Error('This beat belongs to another bound Expression or revision; open that native work first'));
    // Each card's facets come from its own Scene's reading, never the whole's.
    return host.read({expression_ref:card.expression_ref,revision:basis.revision,scene_ref:card.scene_ref})
     .then(sceneRaw=>readJourneySceneFrame(sceneRaw,card.expression_ref,basis.revision,card.scene_ref));
   },(index,row)=>{
    frames.set(cards[index].scene_ref,row.status==='fulfilled'?row.value:failure(row.reason));
    beatView=journeyBeatView(reading,view!.document,frames);
    draw();
   },()=>current(basis,generation));
  }catch(error){if(!destroyed&&open&&generation===epoch){root?.unmount();root=null;message(failure(error));}}
 }
 /** T9: the presence of this Expression is read against its reading, and the Scene it was saved on is reopened when that position
  * is current. Settled (true) once it has restored, found nothing, or refused by name; false while the native view is not ready. */
 function restoreOnce():Promise<boolean>{
  if(destroyed)return Promise.resolve(true);
  let view:KernelConversion|undefined,basis:JourneyInstrumentBasis;
  try{view=host.nativeView();basis=journeyInstrumentBasis(view,host.sceneId());}catch{return Promise.resolve(false);}
  const native=view!;
  return host.read(basis,'expression').then(async raw=>{
   const {reading}=readJourneyInstrument(raw,native,host.sceneId());
   held={expression_ref:basis.expression_ref,revision:basis.revision,reading};
   const saved=savedJourneyPosition({reading});
   const target=saved.presence&&beats(reading).beats.find(beat=>beat.scene_ref===saved.presence!.scene_ref);
   if(!target||target.scene_ref===basis.scene_ref)return true;
   let focus:JourneyBeatFocus;
   try{focus=prepareJourneyBeatFocus(target,basis,host.nativeView(),host.sceneId());}catch(error){message(failure(error));return true;}
   await host.focusScene(focus);
   recordJourneyPosition({reading,expression_ref:basis.expression_ref,scene_ref:target.scene_ref});
   return true;
  }).catch(error=>{
   // A refused restore is said once, by name; a transport that is not ready yet is retried by the next native load.
   if(/not ready|unavailable/.test(failure(error)))return false;
   message(failure(error));return true;
  });
 }
 return {
  /** T5: an edge preset from the seam chooser takes the path panel's own native edit (one scene_material_set). False when no native
   * Expression is open, so the caller writes the local document instead. */
  editEdge(edit:EdgeEdit,notify?:(text:string)=>void):boolean{if(!host.nativeView())return false;submitEdge(edit,notify);return true;},
  /** T9: restore the author's saved Scene once per page, from the first native load that can read it. */
  restorePosition(){restoring??=restoreOnce().finally(()=>{restoring=undefined;});return restoring;},
  /** T9: the strip moved to a Scene; record it as the position, through the same presence owner the instrument reads from. */
  recordPosition(sceneId:string){
   let view:KernelConversion|undefined,basis:JourneyInstrumentBasis;
   try{view=host.nativeView();basis=journeyInstrumentBasis(view,sceneId);}catch{return;}
   if(held&&held.expression_ref===basis.expression_ref&&held.revision===basis.revision){
    recordJourneyPosition({reading:held.reading,expression_ref:basis.expression_ref,scene_ref:basis.scene_ref});return;
   }
   const native=view!;
   void host.read(basis,'expression').then(raw=>{
    if(destroyed)return;
    const {reading}=readJourneyInstrument(raw,native,sceneId);
    held={expression_ref:basis.expression_ref,revision:basis.revision,reading};
    recordJourneyPosition({reading,expression_ref:basis.expression_ref,scene_ref:basis.scene_ref});
   }).catch(()=>{});
  },
  async open(){if(destroyed)throw Error('Journey instrument is closed');open=true;mount.hidden=false;status.hidden=false;await load();},
  close(){epoch++;open=false;inFlight=undefined;mount.hidden=true;status.hidden=true;root?.unmount();root=null;},
  /** T11: the journey re-opened after a crossing. The crossed beat is restored by ref through the owner; a beat no longer in the Journey
  * is named in one status line, and no neighbour is restored in its place. */
  async returnFromCrossing(){
   const state=crossed;
   const returning=host.returning;
   if(!state||destroyed||!returning)return;
   crossed=undefined;
   let view:KernelConversion|undefined,basis:JourneyInstrumentBasis;
   try{view=host.nativeView();basis=journeyInstrumentBasis(view,host.sceneId());}catch(error){message(failure(error));return;}
   try{
    const scene=await host.read(basis) as TechneReading;
    const reply=await returning(basis,scene,state);
    if(destroyed||!open)return;
    const restoredRef=reply.crossing?.operation==='return'?reply.crossing.scene_ref:null;
    let moved=false,notice=journeyReturnNotice(reply);
    if(restoredRef!==null){
     // T11: the restored beat moves the native Scene only when this Journey can present it on the native basis as it stands.
     // A beat the basis no longer holds (the Expression moved on, or the beat left the reading) is named as a miss, never shown as restored.
     const card=held?journeyBeatView(held.reading,view!.document).cards.find(card=>card.scene_ref===restoredRef):undefined;
     const outcome=restoredBeatNotice(restoredRef,basis.scene_ref,!!card?.onBasis);
     notice=outcome.notice;
     if(outcome.moves&&card){await host.focusScene(prepareJourneyBeatFocus(card,basis,view!,host.sceneId()));moved=true;}
    }
    if(moved)await load();
    message(notice??`Back in this Journey at "${sceneTitle(basis.scene_ref)}".`);
   }catch(error){if(!destroyed&&open)message(failure(error));}
  },
 /** Seam B: a carried beat ref is focused through the owner's scene focus (focusScene), the same path the beat's own focus uses. A ref
  * that is not a beat of this Journey is named in the status line and nothing moves. */
 async focusBeat(ref:string){
  if(destroyed||!open)return;
  let view:KernelConversion|undefined,basis:JourneyInstrumentBasis;
  try{view=host.nativeView();basis=journeyInstrumentBasis(view,host.sceneId());}catch(error){message(failure(error));return;}
  try{
   const raw=await host.read(basis,'expression');
   const {reading}=readJourneyInstrument(raw,view!,host.sceneId());
   const target=beats(reading).beats.find(beat=>beat.scene_ref===ref);
   if(!target){message(`Not focused: ${ref} is not a beat of this Journey.`);return;}
   await host.focusScene(prepareJourneyBeatFocus(target,basis,view!,host.sceneId()));
   if(destroyed||!open)return;
   await load();
  }catch(error){if(!destroyed&&open)message(failure(error));}
 },
 async refresh(){if(open)await reuseOrLoad();},
  destroy(){epoch++;open=false;destroyed=true;inFlight=undefined;root?.unmount();root=null;mount.remove();status.remove();},
  active(){return open;},
 };
}
