import type {ReactElement,PointerEvent as ReactPointerEvent} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import type {KernelConversion} from './kernelDocumentBridge';
import type {TechneReading} from '../../../src/techne/contract';
import {draftFromBeats,moveBeat} from '../../../src/techne/m0m5/journey/sequence';
import {beats} from '../../../src/techne/m0m5/journey/beats';
import {journeyBeatView,reorderSceneRequest,type JourneyBeatCard,type JourneyBeatView,type JourneyEditRequest} from './journeyBeats';
import {journeyInstrumentBasis,sameJourneyInstrumentBasis,readJourneyInstrument,readJourneySceneFrame,prepareJourneyBeatFocus,type JourneyBeatFocus,type JourneyInstrumentBasis} from './journeyInstrumentModel';
import './journeyInstrument.css';

export interface JourneyInstrumentHost {
 nativeView:()=>KernelConversion|undefined;sceneId:()=>string;
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

export function JourneyBeatPanel({reading,beatView,native,basis,busy,onFocus,onMove,onRefresh}:{
 reading:TechneReading;beatView:JourneyBeatView;native:KernelConversion;basis:JourneyInstrumentBasis;busy:boolean;
 onFocus:(card:JourneyBeatCard)=>void;onMove:(sceneRef:string,toIndex:number)=>void;onRefresh:()=>void;
}):ReactElement{
 const cards=beatView.cards;
 return <section className="journey-beat-panel" aria-label="Reading-derived Journey">
  <header><h3>Journey</h3><button type="button" disabled={busy} onClick={onRefresh}>Refresh reading</button></header>
  {!cards.length?<p role="status">{beatView.unavailableReason}</p>:<div className="journey-beat-lane">
   <ol className="journey-reading-beats">{cards.map((card,index)=>{
    const scene=native.document.scenes.find(item=>item.scene_ref===card.scene_ref);
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
    </li>;
   })}</ol>
   <span className="scene-insert-line" aria-hidden="true" hidden/>
  </div>}
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
 const current=(basis:JourneyInstrumentBasis,generation:number)=>!destroyed&&open&&epoch===generation&&sameJourneyInstrumentBasis(basis,host.nativeView(),host.sceneId());
 const message=(text:string)=>{status.textContent=text;};
 const failure=(cause:unknown)=>cause instanceof Error?cause.message:String(cause);
 async function load(){
  const generation=++epoch;
  try{
   const view=host.nativeView(),sceneId=host.sceneId(),basis=journeyInstrumentBasis(view,sceneId);
   message('Reading Journey…');
   // The Expression-wide disclosure: the cards and their order.
   const raw=await host.read(basis,'expression');
   if(destroyed||!open||generation!==epoch)return;
   if(!current(basis,generation))throw Error('The selected native Journey changed while its reading was returning');
   const {reading}=readJourneyInstrument(raw,view!,sceneId);
   // Each card's facets come from its own Scene's reading, never the whole's.
   const cards=journeyBeatView(reading,view!.document).cards;
   const frames=new Map<string,TechneReading|string>();
   const settled=await Promise.allSettled(cards.map(card=>{
    if(card.expression_ref!==basis.expression_ref||card.revision!==String(basis.revision))
     return Promise.reject(Error('This beat belongs to another bound Expression or revision; open that native work first'));
    return host.read({expression_ref:card.expression_ref,revision:basis.revision,scene_ref:card.scene_ref})
     .then(sceneRaw=>readJourneySceneFrame(sceneRaw,card.expression_ref,basis.revision,card.scene_ref));
   }));
   if(destroyed||!open||generation!==epoch)return;
   settled.forEach((row,i)=>frames.set(cards[i].scene_ref,row.status==='fulfilled'?row.value:failure(row.reason)));
   const beatView=journeyBeatView(reading,view!.document,frames);
   root??=createRoot(mount);
   let busy=false;
   const draw=()=>{if(!current(basis,generation))return;root!.render(<JourneyBeatPanel reading={reading} beatView={beatView} native={view!} basis={basis} busy={busy} onRefresh={()=>void load()}
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
  }catch(error){if(!destroyed&&open&&generation===epoch){root?.unmount();root=null;message(failure(error));}}
 }
 return {
  async open(){if(destroyed)throw Error('Journey instrument is closed');open=true;mount.hidden=false;status.hidden=false;await load();},
  close(){epoch++;open=false;mount.hidden=true;status.hidden=true;root?.unmount();root=null;},
  async refresh(){if(open)await load();},
  destroy(){epoch++;open=false;destroyed=true;root?.unmount();root=null;mount.remove();status.remove();},
  active(){return open;},
 };
}
