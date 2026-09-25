/** Mature Research Canvas instruments mounted inside the running engine. */
import React,{Component,useEffect,useRef,useState,type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import {clone,type Scene} from './model.js';
import {type ResearchMaterialAction,type ResearchStroke} from './researchMaterial.js';
import {createRoot,type Root} from 'react-dom/client';
import {CanvasView,TimelineSurface,PsychogeographicMap,StreetViewSurface,loadBundledGeographyPack,type TimelineViewState} from '../../vendor/research-canvas/components';
import type {KernelConversion} from './kernelDocumentBridge.js';
import {techneConstellationRequest,type TechneSceneReadingRequest,type TechneConstellationRequest} from './kernelExpressions.js';
import {nativeInstrumentCanvas,nativeInstrumentTitles,nativeInstrumentPreviews,nativeInstrumentNodeTags,nativeInstrumentSourceRelations,readingInstruments,CANVAS_UNITS,assertInstrumentReadingScope,expressionTextFromNote,type InstrumentCanvas,type NativeRelationDirectionReading} from './researchInstrumentsData.js';
import {createGestureTransaction,withGesturePreviews,type GestureTransaction} from './canvasGesture.js';
import {
 positioned,nudge,translateSelection,align as alignPositions,distribute as distributePositions,snapToGrid,
 semanticZoomLevel,trackModifiers,type AlignMode,type RepertoireMove,
} from './canvasRepertoire.js';
import {RelationFieldView} from './relationFieldView.js';
import {PlaceFacetsPanel} from './placeFacetsPanel.js';
import {OPEN_PLACE_FILTER,filteredPlacesRepository,subjectEntityRef,type PlaceFilterState} from './placeReading.js';
import type {TechneReading} from '../../../src/techne/contract';
import {blueprintMember,type SceneBlueprint,type BlueprintTransform} from './blueprintGeometry.js';
import {icon} from './icons.js';
import './researchInstrumentStyles.css';
import './researchInstruments.css';

/** D3 — the canvas tool row is icon-led, in the app's existing 24×24
 * thin-stroke icon language (icons.ts), not text-led. Every button below
 * keeps its own aria-label and title carrying the exact prior visible text,
 * so nothing here changes for assistive tech or hover discovery — only the
 * always-visible label becomes a glyph. */
function ToolIcon({name}:{name:string}){return <span className="research-tool-icon" aria-hidden="true" dangerouslySetInnerHTML={{__html:icon(name)}}/>;}

/** Visibility comes from the current native frame binding, not a card title. */
function ConstellationAction({request,onError}:{request:Omit<TechneConstellationRequest,'operation'>;onError:(message:string)=>void}) {
 const [available,setAvailable]=useState(false),[busy,setBusy]=useState(false);
 const key=JSON.stringify(request);
 useEffect(()=>{let live=true;setAvailable(false);void techneConstellationRequest({...request,operation:'inspect'}).then(()=>{if(live)setAvailable(true);}).catch(()=>{});return()=>{live=false;};},[key]);
 if(!available)return null;
 return <button disabled={busy} onClick={()=>{setBusy(true);void techneConstellationRequest({...request,operation:'open'}).catch(error=>onError(error instanceof Error?error.message:String(error))).finally(()=>setBusy(false));}}>Edit constellation</button>;
}

/** Presentation connection ≠ evidence. This offers a deliberate act — record
 * the disclosed O:I connection as a typed knowledge relation through the
 * native constellation operation — never an automatic promotion. */
function RelateKnowledgeAction({sceneId,sourceRef,targetRef,defaultRelation,relate,onError,onResult}:{
 sceneId:string;sourceRef:string;targetRef:string;defaultRelation:string;
 relate:(sceneId:string,input:{sourceEntityRef:string;targetEntityRef:string;relation:string;direction:'directed'|'undirected'})=>Promise<{relation_ref:string;frame_ref:string;frame_revision:number}>;
 onError:(message:string)=>void;onResult:(message:string)=>void;
}){
 const [relation,setRelation]=useState(defaultRelation);
 const [direction,setDirection]=useState<'directed'|'undirected'>('directed');
 const [busy,setBusy]=useState(false);
 return <div className="research-relate-knowledge">
  <label>Relation<input value={relation} onChange={e=>setRelation(e.target.value)} maxLength={160}/></label>
  <label>Direction<select value={direction} onChange={e=>setDirection(e.target.value as 'directed'|'undirected')}><option value="directed">Directed</option><option value="undirected">Undirected</option></select></label>
  <button disabled={busy||!relation.trim()} onClick={()=>{
   setBusy(true);
   relate(sceneId,{sourceEntityRef:sourceRef,targetEntityRef:targetRef,relation:relation.trim(),direction})
    .then(result=>onResult(`Recorded as constellation relationship · ${result.relation_ref}`),error=>onError(error instanceof Error?error.message:String(error)))
    .finally(()=>setBusy(false));
  }}>Record as constellation relationship</button>
 </div>;
}

/** Compact Canvas control group over a bound blueprint whole (owner
 * commission, QL-MEF #214 geometry-closeout): Move/Rotate/Scale are ONE
 * transform act (one `transformBlueprint` call per press, mirroring the
 * native `scene_blueprint_transform` law — never a member-by-member edit);
 * Release and Pin/Unpin are their own distinct labelled acts, never folded
 * into the transform. Shown only while the current selection is an actual
 * blueprint member (`blueprintMember`), never guessed from shape or count. */
function BlueprintWholeControls({binding,pinned,busy,onTransform,onRelease,onPin}:{
 binding:SceneBlueprint;pinned:boolean;busy:boolean;
 onTransform:(transform:BlueprintTransform)=>void;onRelease:()=>void;onPin:(pinned:boolean)=>void;
}){
 const TRANSLATE_STEP=20,ROTATE_STEP=15*Math.PI/180,SCALE_FACTOR=1.1;
 const move=(dx:number,dy:number)=>onTransform({...binding.transform,translation:[binding.transform.translation[0]+dx,binding.transform.translation[1]+dy,binding.transform.translation[2]]});
 const rotate=(delta:number)=>onTransform({...binding.transform,rotation:[binding.transform.rotation[0],binding.transform.rotation[1],binding.transform.rotation[2]+delta]});
 const rescale=(factor:number)=>onTransform({...binding.transform,scale:binding.transform.scale*factor});
 return <div className="research-blueprint-controls" aria-label="Blueprint whole controls">
  <p>{binding.members.length} sixfold roles move together.</p>
  <div className="native-actions" role="group" aria-label="Move whole">
   <button type="button" disabled={busy} aria-label="Move whole left" onClick={()=>move(-TRANSLATE_STEP,0)}>←</button>
   <button type="button" disabled={busy} aria-label="Move whole right" onClick={()=>move(TRANSLATE_STEP,0)}>→</button>
   <button type="button" disabled={busy} aria-label="Move whole up" onClick={()=>move(0,-TRANSLATE_STEP)}>↑</button>
   <button type="button" disabled={busy} aria-label="Move whole down" onClick={()=>move(0,TRANSLATE_STEP)}>↓</button>
  </div>
  <div className="native-actions" role="group" aria-label="Rotate whole">
   <button type="button" disabled={busy} onClick={()=>rotate(-ROTATE_STEP)}>Rotate −</button>
   <button type="button" disabled={busy} onClick={()=>rotate(ROTATE_STEP)}>Rotate +</button>
  </div>
  <div className="native-actions" role="group" aria-label="Scale whole">
   <button type="button" disabled={busy} onClick={()=>rescale(1/SCALE_FACTOR)}>Scale −</button>
   <button type="button" disabled={busy} onClick={()=>rescale(SCALE_FACTOR)}>Scale +</button>
  </div>
  <div className="native-actions">
   <button type="button" disabled={busy} aria-pressed={pinned} onClick={()=>onPin(!pinned)}>{pinned?'Unpin world position':'Pin world position'}</button>
   <button type="button" disabled={busy} onClick={()=>{if(window.confirm('Release this blueprint? Its roles keep their current positions but stop moving as one whole.'))onRelease();}}>Release blueprint</button>
  </div>
 </div>;
}
export type ResearchInstrument='m1'|'m2'|'m4';
function ImageryPanel(props:React.ComponentProps<typeof StreetViewSurface>&{tools:HTMLElement}){
 const [open,setOpen]=useState(false),toggle=useRef<HTMLButtonElement>(null),panel=useRef<HTMLElement>(null);
 useEffect(()=>{if(open)panel.current?.querySelector<HTMLButtonElement>('button')?.focus();},[open]);
 const close=()=>{setOpen(false);toggle.current?.focus();};
 return <>{createPortal(<div className="research-tool-actions"><button ref={toggle} aria-expanded={open} aria-controls="research-imagery" onClick={()=>setOpen(value=>!value)}>Images</button></div>,props.tools)}
  <aside ref={panel} id="research-imagery" className="research-street-view" aria-label="Scene imagery" hidden={!open} onKeyDown={event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close();}}}>
   <header><h3>Scene imagery</h3><button type="button" onClick={close} aria-label="Close scene imagery">Close</button></header>
   <StreetViewSurface {...props}/>
  </aside></>;
}
export interface ResearchInstrumentsHost {
 container:HTMLElement;
 tools:HTMLElement; inspector:HTMLElement;
 sceneMaterial:(sceneId:string)=>Scene;
 material:(sceneId:string,action:ResearchMaterialAction)=>Promise<void>;
 inspectSubject:(ref:string,context?:{node?:unknown;relationField?:unknown})=>void;
 read:(request:TechneSceneReadingRequest)=>Promise<unknown>;
 nativeView:()=>KernelConversion|undefined;
 sceneId:()=>string;
 select:(sceneId:string,entityId:string|null,bindingRef?:string)=>void;
 move:(sceneId:string,entityId:string,position:{x:number;y:number})=>Promise<void>;
 /** OPTIONAL — a multi-select move/align/distribute/nudge is one user
  * gesture and must land as one native write, not one per member. Declared
  * so the host can batch it through its own single `changed()`/commit;
  * undeclared hosts fall back to sequential `move` calls (still one
  * gesture, but N native writes — the host should implement this). */
 moveMany?:(sceneId:string,moves:{entityId:string;position:{x:number;y:number}}[])=>Promise<void>;
 openSubject:(ref:string)=>void;
 /** OPTIONAL — declared for the empty-field creation path (Wayfinder §21:
  * choosing a frame can create an incomplete working draft; creation must
  * not be disabled when no subject/constellation exists yet). Undeclared
  * hosts simply do not offer "New constellation" from an unbound canvas. */
 createScene?:()=>Promise<void>;
 createNote?:(sceneId:string,position:{x:number;y:number})=>Promise<void>;
 duplicateOccurrence?:(sceneId:string,entityId:string)=>Promise<void>;
 deleteOccurrence?:(sceneId:string,entityId:string)=>Promise<void>;
 updateContent?:(sceneId:string,entityId:string,text:string)=>Promise<void>;
 connect?:(sceneId:string,input:{sourceEntityRef:string;targetEntityRef:string;relationKind:string;directionality?:string})=>Promise<void>;
 reconnect?:(sceneId:string,bindingRef:string,input:{sourceEntityRef:string;targetEntityRef:string})=>Promise<void>;
 deleteConnection?:(sceneId:string,bindingRef:string)=>Promise<void>;
 updateConnectionKind?:(sceneId:string,bindingRef:string,kind:string)=>Promise<void>;
 /** OPTIONAL — declared for C3 (onCycleEdgeDirectionality). Cycles an
  * O:I-owned connection's own directionality (forward→backward→bidirectional→
  * none→forward). Undeclared hosts simply do not offer the control — the
  * vendored Canvas hides "Cycle arrow direction" whenever this is absent. */
 updateConnectionDirectionality?:(sceneId:string,bindingRef:string,directionality:'forward'|'backward'|'bidirectional'|'none')=>Promise<void>;
 /** OPTIONAL — declared for C4(a). Opens the existing full Studio object/state
  * editor for this exact native occurrence while the Canvas instrument stays
  * mounted and active (no remount, no camera reset). */
 editObject?:(sceneId:string,entityId:string)=>void;
 /** OPTIONAL — declared for C4(b). Records a deliberate typed knowledge
  * relation through the native constellation operation. Never called
  * implicitly by the presentation connect gesture — only by an explicit
  * "Record as constellation relationship" act in the inspector. */
 relateKnowledge?:(sceneId:string,input:{sourceEntityRef:string;targetEntityRef:string;relation:string;direction:'directed'|'undirected'})=>Promise<{relation_ref:string;frame_ref:string;frame_revision:number}>;
 /** OPTIONAL — declared for the Canvas whole-transform control group (owner
  * commission, QL-MEF #214 geometry-closeout). ONE native
  * `scene_blueprint_transform` edit per call — move/rotate/scale together,
  * never a member-by-member edit. Undeclared hosts simply do not offer the
  * in-canvas controls; the separate Blueprint panel (blueprintHUD) still
  * works either way. */
 transformBlueprint?:(sceneId:string,transform:BlueprintTransform)=>Promise<void>;
 /** OPTIONAL — releases the current Scene's blueprint (`scene_blueprint_release`).
  * A distinct act from `transformBlueprint`: it never runs implicitly from a
  * transform press, only from its own explicit, confirmed control. */
 releaseBlueprint?:(sceneId:string)=>Promise<void>;
 /** OPTIONAL — the world-position pin (`entity_pin`), distinct from both
  * blueprint membership and release: holds or releases one entity's own
  * world position independent of any whole. */
 pinEntity?:(sceneId:string,entityId:string,pinned:boolean)=>Promise<void>;
}
interface ViewState {
 canvas?:{x:number;y:number;zoom:number};timeline?:TimelineViewState;place?:{latitude:number;longitude:number;zoom:number};selectedNode?:string|null;selectedEdge?:string|null;selectedPlace?:string|null;placeFilter?:PlaceFilterState;
 /** M2′: chronology (the vendored TimelineSurface) vs. the relation-field
  * projections (relationFieldView.tsx) — session-local presentation state,
  * never a second store. */
 m2Projection?:'chronology'|'field';
 /** Gesture transactions live on the ViewState, not inside canvasNode's
  * per-render closures, so one gesture survives the many re-renders a drag
  * or resize produces. The `*Adapter` refs are rebound on every canvasNode()
  * call so the transaction always calls through to the current canvas/apply
  * closures without being recreated (and losing in-flight preview state). */
 moveGesture?:GestureTransaction<{x:number;y:number}>;
 moveAdapter?:{commit:(nodeId:string,position:{x:number;y:number})=>Promise<void>;onChange:()=>void};
 resizeGesture?:GestureTransaction<{width:number;height:number}>;
 resizeAdapter?:{commit:(nodeId:string,size:{width:number;height:number})=>Promise<void>;onChange:()=>void};
 /** Session-local sequence-walk membership. Not native material: no reading
  * discloses a "sequence"; this is a personal navigation aid over the
  * already-disclosed connections, cleared on reload like the draw colour. */
 sequencedEdges?:Set<string>;
 /** M1′ direct manipulation (Wayfinder §6, §13): the multi-select set (the
  * shift/ctrl-click extended selection; `selectedNode` above stays the
  * single "focus" the inspector shows). `groupPreview` carries an
  * in-progress group drag's overlay positions — each dragged member's own
  * position is now reported directly by the vendored Canvas (no local
  * drag-origin/delta bookkeeping); `groupMoveGesture` batches the whole
  * selection's move into ONE native write per gesture (keyed by a single
  * synthetic id so the existing per-gesture idle/deferred-flush batching
  * commits exactly once). */
 multiSelect?:Set<string>;
 groupPreview?:Map<string,{x:number;y:number}>;
 groupMoveGesture?:GestureTransaction<RepertoireMove[]>;
 snapToGrid?:boolean;
 lassoOn?:boolean;
 zoomLevel?:'constellation'|'named'|'detailed';
}
class InstrumentBoundary extends Component<{children:ReactNode},{error:string|null}> {
 state={error:null as string|null};
 static getDerivedStateFromError(error:unknown){return {error:error instanceof Error?error.message:String(error)};}
 render(){return this.state.error?<p role="alert" className="research-instrument-message">{this.state.error}</p>:this.props.children;}
}
export function installResearchInstruments(host:ResearchInstrumentsHost){
 let lens:ResearchInstrument|null=null,root:Root|null=null,epoch=0,destroyed=false;
 let captureCanvas:(()=>{x:number;y:number;zoom:number})|null=null,currentKey:string|null=null;
 const views=new Map<string,ViewState>();
 let mutations:Promise<void>=Promise.resolve();
 let materialInFlight=0,deferredRefresh=false;
 let drawing=false,dismissedCard:string|null=null,strokeColour='#808080';let flyToNode:((id:string,viewport?:{x:number;y:number;zoom:number})=>void)|null=null;
 let flyToEdge:((id:string,viewport?:{x:number;y:number;zoom:number})=>void)|null=null;

 const mount=document.createElement('div');mount.className='research-instrument';mount.hidden=true;host.container.append(mount);
 const status=document.createElement('div');status.className='research-instrument-status';status.setAttribute('role','status');
 const body=document.createElement('div');body.className='research-instrument-body';mount.append(body);host.tools.append(status);
 const message=(text:string)=>{status.textContent=text;};
 function retain(){if(currentKey&&captureCanvas){const state=views.get(currentKey);if(state)state.canvas=captureCanvas();}captureCanvas=null;}
 function disposeGestures(){for(const state of views.values()){state.moveGesture?.dispose();state.resizeGesture?.dispose();state.groupMoveGesture?.dispose();}}
 function unmount(){retain();disposeGestures();root?.unmount();root=null;body.replaceChildren();}
 // Multi-select repertoire (R1/R2, Wayfinder §6, §13). The vendored Canvas
 // reports neither modifier keys on a node click nor a batched multi-node
 // drag, so shift/ctrl-extend is tracked independently here, and a group
 // drag is realised by translating every OTHER selected node's preview by
 // the SAME delta the actively-dragged node reports — one coherent commit
 // per gesture either way (see groupContext below).
 const modifiers=trackModifiers();
 let groupContext:{state:ViewState;canvas:InstrumentCanvas;sceneId?:string}|null=null;
 const nudgeStep=(shift:boolean)=>shift?40:10;
 const onWindowKeydown=(event:KeyboardEvent)=>{
  if(destroyed||lens!=='m1'||!groupContext)return;
  const target=event.target as HTMLElement|null;
  if(target?.isContentEditable||target?.tagName==='INPUT'||target?.tagName==='TEXTAREA')return;
  if(!target?.closest?.('.research-canvas'))return;
  const axis=event.key==='ArrowLeft'?'left':event.key==='ArrowRight'?'right':event.key==='ArrowUp'?'up':event.key==='ArrowDown'?'down':null;
  if(!axis)return;
  const {state,canvas,sceneId}=groupContext;
  const selection=state.multiSelect?.size?[...state.multiSelect]:state.selectedNode?[state.selectedNode]:[];
  if(!selection.length||!sceneId)return;
  event.preventDefault();
  const overrides=nudge(canvas.nodes.map(node=>state.groupPreview?.get(node.id)?{...node,position:state.groupPreview.get(node.id)!}:node),selection,axis,nudgeStep(event.shiftKey));
  applyGroupOverrides(state,canvas,sceneId,overrides);
 };
 window.addEventListener('keydown',onWindowKeydown);
 /** Preview every override immediately (one redraw) and batch the whole
  * selection into ONE gesture-transaction id, so N nudges/drags/aligns in a
  * row still land as exactly one native write when the gesture settles. */
 function applyGroupOverrides(state:ViewState,canvas:InstrumentCanvas,sceneId:string,overrides:Record<string,{x:number;y:number}>,held=false){
  if(!Object.keys(overrides).length)return;
  state.groupPreview??=new Map();
  for(const [ref,position] of Object.entries(overrides))state.groupPreview.set(ref,position);
  state.groupMoveGesture??=createGestureTransaction<RepertoireMove[]>({
   commit:async(_key,moves)=>{
    const converted=moves.map(m=>({entityId:m.entityId,position:{x:m.position.x/CANVAS_UNITS,y:-m.position.y/CANVAS_UNITS}}));
    if(host.moveMany)await host.moveMany(sceneId,converted);
    else for(const mv of converted)await host.move(sceneId,mv.entityId,mv.position);
   },
   onChange:()=>{state.groupPreview=undefined;if(currentKey===canvas.key&&lens==='m1'&&!destroyed)render(canvasNode(canvas,state,epoch));},
  });
  const occurrence=(id:string)=>canvas.occurrences.get(id)??id;
  const moves:RepertoireMove[]=[...state.groupPreview.entries()].map(([ref,position])=>({entityId:occurrence(ref),position}));
  state.groupMoveGesture.preview('__group__',moves,held);
  if(currentKey===canvas.key&&lens==='m1'&&!destroyed)render(canvasNode(canvas,state,epoch));
 }
 function stateFor(key:string){let state=views.get(key);if(!state){state={};views.set(key,state);if(views.size>32)views.delete(views.keys().next().value!);}currentKey=key;return state;}
 function render(node:ReactNode){root??=createRoot(body);root.render(<InstrumentBoundary>{node}</InstrumentBoundary>);}
 let relationReadings:NativeRelationDirectionReading[]=[];
 const nativeCanvas=(view:KernelConversion,sceneId:string)=>nativeInstrumentCanvas(view,sceneId,relationReadings);
 function canvasNode(canvas:InstrumentCanvas,state:ViewState,generation:number){
  const editable=!!canvas.sceneId;
  const scene=canvas.sceneId?host.sceneMaterial(canvas.sceneId):undefined;
  const material=scene?.research;
  groupContext=editable?{state,canvas,sceneId:canvas.sceneId}:null;
  const selection=state.multiSelect?.size?state.multiSelect:new Set(state.selectedNode?[state.selectedNode]:[]);
  const apply=(action:()=>Promise<void>,refresh=true)=>{
   const key=canvas.key;message('Saving…');
   mutations=mutations.catch(()=>{}).then(async()=>{
    if(destroyed||!host.nativeView()||nativeCanvas(host.nativeView()!,host.sceneId()).key!==key)throw new Error('The selected native composition changed; the queued edit was not applied');
    materialInFlight++;
    try{await action();}finally{materialInFlight--;}
    if(currentKey===key&&!destroyed){message('Saved');if(lens==='m1'){const view=host.nativeView();if(view&&host.sceneId()===canvas.sceneId){const updated=nativeCanvas(view,host.sceneId());render(canvasNode(updated,state,epoch));}else if(refresh||deferredRefresh)await load('m1');}}
    if(!materialInFlight){const pending=deferredRefresh;deferredRefresh=false;if(pending&&lens&&currentKey!==key)await load(lens);}

   }).catch(error=>{if(currentKey===key&&!destroyed)message(error instanceof Error?error.message:String(error));});
  };
  const occurrence=(id:string)=>{const value=canvas.occurrences.get(id);if(!value)throw new Error('This card has no native occurrence');return value;};
  const ownConnection=(id:string)=>{const relation=host.nativeView()?.document.relations?.[id];if(relation?.native_owner!=='oi')throw new Error('This source relation is read-only; use its native owner to change it');return id;};
  const select=(id:string|null)=>{state.selectedNode=id;state.selectedEdge=null;if(canvas.sceneId)host.select(canvas.sceneId,id?canvas.occurrences.get(id)??null:null);};
  const redraw=()=>{if(epoch===generation&&lens==='m1')render(canvasNode(canvas,state,generation));};
  const act=(action:ResearchMaterialAction,refresh=true)=>{if(canvas.sceneId)apply(()=>host.material(canvas.sceneId!,action),refresh);};
  // C1 — one native write per gesture, not one per pointer move. The
  // GestureTransaction is created once per ViewState and kept across
  // re-renders; only the small adapter (which closes over this render's
  // `canvas`/`apply`) is rebound every call, so an in-flight drag always
  // commits through the *current* composition binding.
  state.moveAdapter={
   commit:async(id,position)=>{
    const entityId=canvas.occurrences.get(id);if(!canvas.sceneId||!entityId)return;
    message('Saving position…');
    apply(()=>host.move(canvas.sceneId!,entityId,{x:position.x/CANVAS_UNITS,y:-position.y/CANVAS_UNITS}));
   },
   onChange:redraw,
  };
  state.moveGesture??=createGestureTransaction<{x:number;y:number}>({
   commit:(id,position)=>state.moveAdapter!.commit(id,position),
   onChange:()=>state.moveAdapter!.onChange(),
  });
  state.resizeAdapter={
   commit:async(id,size)=>{act({type:'resize',id:occurrence(id),width:size.width,height:size.height});},
   onChange:redraw,
  };
  state.resizeGesture??=createGestureTransaction<{width:number;height:number}>({
   commit:(id,size)=>state.resizeAdapter!.commit(id,size),
   onChange:()=>state.resizeAdapter!.onChange(),
  });
  const previewNodes=withGesturePreviews(canvas.nodes,id=>state.groupPreview?.get(id)??state.moveGesture?.previewValue(id),id=>state.resizeGesture?.previewValue(id));
  const previewEdges=canvas.edges.map(edge=>state.sequencedEdges?.has(edge.id)?{...edge,sequencing:true}:edge);
  // R1 — shift/ctrl-click extends the multi-select; a plain click replaces
  // it. The vendored Canvas reports no modifier state itself (trackModifiers
  // reads it independently), so this is the one seam that decides extend
  // vs. replace for every click the Canvas reports.
  const selectMulti=(id:string|null)=>{
   if(id&&(modifiers.state.shift||modifiers.state.extend)){
    state.multiSelect??=new Set(state.selectedNode?[state.selectedNode]:[]);
    if(state.multiSelect.has(id))state.multiSelect.delete(id);else state.multiSelect.add(id);
    select(state.multiSelect.size?[...state.multiSelect][state.multiSelect.size-1]:null);
    return;
   }
   state.multiSelect=id?new Set([id]):new Set();
   select(id);
  };
  // R1 — a group drag: the vendored Canvas now reports every dragged node's
  // own already-correct position directly (host-selection-viewport-gesture.patch
  // multi-node onMoveNodePreview/onMoveNodeEnd), once per selected member —
  // no delta math or drag-origin bookkeeping is needed here any more. Each
  // call still only overlays ONE id→position pair; `applyGroupOverrides`
  // accumulates them into the same batched `groupMoveGesture` so the whole
  // selection still lands as ONE native write per gesture.
  const groupMove=(id:string,position:{x:number;y:number})=>{
   // Pointer drags are held gestures: they commit at drag end, never on an
   // idle pause mid-drag.
   if(!canvas.sceneId||!selection.has(id)||selection.size<2){state.moveGesture!.preview(id,position,true);return;}
   applyGroupOverrides(state,canvas,canvas.sceneId,{[id]:position},true);
  };
  // Gesture end is now disclosed directly by the vendored Canvas
  // (onMoveNodeEnd) instead of being guessed from a global pointerup
  // listener. A multi-node drag end still fires this once per dragged node
  // in the same synchronous pass, so the actual flush is deferred to the
  // next microtask — by then every member's override is already recorded
  // and canvasGesture's own single-commit flush drains exactly once.
  const flushMoveEnd=()=>{queueMicrotask(()=>{void state.moveGesture?.flushNow();void state.groupMoveGesture?.flushNow();});};
  const alignSelection=(mode:AlignMode)=>{if(!canvas.sceneId||selection.size<2)return;applyGroupOverrides(state,canvas,canvas.sceneId,alignPositions(canvas.nodes,[...selection],mode));};
  const distributeSelection=(axis:'h'|'v')=>{if(!canvas.sceneId||selection.size<3)return;applyGroupOverrides(state,canvas,canvas.sceneId,distributePositions(canvas.nodes,[...selection],axis));};
  const frames=material?.frames??{};
  const framesOrdered=Object.entries(frames).sort(([,a],[,b])=>a.z-b.z);
  // A frame's members are selected here, not dragged by a titlebar: the
  // mounted Canvas exposes no viewport transform to this module, so a
  // screen-accurate frame rectangle cannot be drawn over live pan/zoom
  // (same root cause as the R3/R1 gaps below). Selecting its membership and
  // dragging any member still moves the whole frame as ONE gesture, via the
  // same groupMove/applyGroupOverrides path multi-select already uses.
  const saveFrame=()=>{if(selection.size<2)return;act({type:'frame-save',id:crypto.randomUUID(),label:`Frame ${framesOrdered.length+1}`,memberRefs:[...selection].map(occurrence)});};
  const namedViews=material?.namedViews??{};
  const saveView=()=>{if(!canvas.sceneId||!captureCanvas)return;const name=window.prompt('Name this view');if(!name)return;const viewport=captureCanvas();act({type:'view-save',name,viewport:{x:viewport.x,y:viewport.y,zoom:viewport.zoom},selectedRefs:[...selection].map(occurrence),frameOrder:framesOrdered.map(([id])=>id)},false);};
  const applyView=(name:string)=>{const view=namedViews[name];if(!view)return;flyToNode?.('',{x:view.viewport.x,y:view.viewport.y,zoom:view.viewport.zoom});state.multiSelect=new Set(view.selectedRefs.map(ref=>canvas.nodes.find(n=>occurrence(n.id)===ref)?.id).filter((v):v is string=>!!v));select(state.multiSelect.size?[...state.multiSelect][0]:null);message(`View "${name}" applied`);};
  // R1 — box selection is now the vendored Canvas's own xyflow selectionOnDrag
  // (host-selection-viewport-gesture.patch), reported through onSelectionChange
  // with the exact flow-space hit set; no screen-rect DOM query or lasso
  // overlay component is needed any more.
  const boxSelectionComplete=(nodeIds:string[])=>{
   state.multiSelect=new Set(nodeIds);state.lassoOn=false;
   select(nodeIds[0]??null);
   redraw();
  };
  const current=canvas.nodes.find(n=>n.id===state.selectedNode);
  const localId=current?canvas.occurrences.get(current.id):undefined;
  const nativeView=host.nativeView(),nativeScene=canvas.sceneId?nativeView?.bindings[canvas.sceneId]?.scene_ref:undefined;
  const subject=current?nativeView?.document.entities[current.id]?.subject:undefined;
  const constellationRequest=nativeView&&nativeScene&&current&&subject&&Array.isArray(subject.readings)&&subject.readings.length>1?{expression_ref:nativeView.document.expression_ref,revision:nativeView.document.revision,scene_ref:nativeScene,entity_ref:current.id}:undefined;
  const imageImport=()=>{const input=document.createElement('input');input.type='file';input.accept='image/png,image/jpeg,image/webp';input.onchange=async()=>{const file=input.files?.[0];if(!file)return;try{if(file.size>196608)throw new Error('Choose an image smaller than 192 KiB for this native document.');const dataUrl=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(reader.error);reader.readAsDataURL(file);});act({type:'create-card',kind:'image',title:file.name.slice(0,160),dataUrl,position:{x:0,y:0}});}catch(error){message(String(error));}};input.click();};
  const annotations=(material?.strokes??[]).map(stroke=>({id:stroke.id,canvasId:canvas.key,annotationType:'stroke' as const,points:stroke.points,style:{color:stroke.color,width:stroke.width,opacity:stroke.opacity},bounds:{position:{x:Math.min(...stroke.points.map(p=>p.x)),y:Math.min(...stroke.points.map(p=>p.y))},size:{width:Math.max(1,Math.max(...stroke.points.map(p=>p.x))-Math.min(...stroke.points.map(p=>p.x))),height:Math.max(1,Math.max(...stroke.points.map(p=>p.y))-Math.min(...stroke.points.map(p=>p.y)))}},createdAt:stroke.createdAt,updatedAt:stroke.createdAt}));
  // The card follows the selection: selecting a node or connection shows it,
  // closing dismisses it for that selection only.
  const cardFor=state.selectedNode??state.selectedEdge??null;
  const inspecting=!!cardFor&&cardFor!==dismissedCard;
  host.inspector.hidden=!inspecting;
  const closeInspector=()=>{dismissedCard=cardFor;host.inspector.hidden=true;redraw();};
  const controls=<div className="research-tool-actions" aria-label="Canvas tools">
   {editable&&<><button aria-label="Note" title="Note" onClick={()=>act({type:'create-card',kind:'note',position:{x:0,y:0}})}><ToolIcon name="text"/></button><button aria-label="Image" title="Image" onClick={imageImport}><ToolIcon name="camera"/></button>
   <select aria-label="Focus disclosed source" value="" onChange={event=>{const ref=event.target.value;const source=canvas.nodes.find(node=>node.id===ref);if(!source||!canvas.occurrences.has(ref)||!host.nativeView()?.document.entities[ref]?.subject)return;select(ref);flyToNode?.(ref);redraw();}}><option value="">Source…</option>{canvas.nodes.filter(node=>host.nativeView()?.document.entities[node.id]?.subject).map(node=><option key={node.id} value={node.id}>{node.title}</option>)}</select>
   <button aria-label="Draw" title="Draw" aria-pressed={drawing} onClick={()=>{drawing=!drawing;redraw();}}><ToolIcon name="pen"/></button>{drawing&&<input type="color" aria-label="Stroke colour" value={strokeColour} onChange={e=>{strokeColour=e.target.value;redraw();}}/>}
   <button aria-label="Save view" title="Save view" onClick={()=>{if(captureCanvas)act({type:'viewport',key:'canvas',value:captureCanvas()},false);}}><ToolIcon name="save"/></button>
   {selection.size>0&&<span className="research-selection-count" aria-live="polite">{selection.size} selected</span>}
   {selection.size>=2&&<select aria-label="Align selection" value="" onChange={event=>{const mode=event.target.value as AlignMode;if(mode)alignSelection(mode);event.target.value='';}}>
    <option value="">Align…</option><option value="left">Left</option><option value="hcenter">Centre</option><option value="right">Right</option><option value="top">Top</option><option value="vcenter">Middle</option><option value="bottom">Bottom</option></select>}
   {selection.size>=3&&<><button aria-label="Distribute ↔" title="Distribute ↔" onClick={()=>distributeSelection('h')}><ToolIcon name="distributeH"/></button><button aria-label="Distribute ↕" title="Distribute ↕" onClick={()=>distributeSelection('v')}><ToolIcon name="distributeV"/></button></>}
   <button aria-label="Snap" title="Snap" aria-pressed={!!state.snapToGrid} onClick={()=>{state.snapToGrid=!state.snapToGrid;redraw();}}><ToolIcon name="grid"/></button>
   <button aria-label="Lasso" title="Lasso" aria-pressed={!!state.lassoOn} onClick={()=>{state.lassoOn=!state.lassoOn;redraw();}}><ToolIcon name="lasso"/></button>
   {selection.size>=2&&<button aria-label="Frame selection" title="Frame selection" onClick={saveFrame}><ToolIcon name="frame"/></button>}
   {framesOrdered.length>0&&<select aria-label="Frames" value="" onChange={event=>{const [op,id]=event.target.value.split(':');if(op==='select'){const frame=frames[id];if(frame){state.multiSelect=new Set(frame.memberRefs.map(ref=>[...canvas.occurrences.entries()].find(([,v])=>v===ref)?.[0]).filter((v):v is string=>!!v));select([...state.multiSelect][0]??null);}}if(op==='front')act({type:'frame-order',id,direction:'front'},false);if(op==='back')act({type:'frame-order',id,direction:'back'},false);if(op==='remove')act({type:'frame-remove',id},false);event.target.value='';}}>
    <option value="">Frames…</option>{framesOrdered.map(([id,frame])=><optgroup key={id} label={frame.label}><option value={`select:${id}`}>Select members</option><option value={`front:${id}`}>Bring to front</option><option value={`back:${id}`}>Send to back</option><option value={`remove:${id}`}>Remove frame</option></optgroup>)}</select>}
   <button aria-label="Save view as…" title="Save view as…" onClick={saveView}><ToolIcon name="save"/></button>
   {Object.keys(namedViews).length>0&&<select aria-label="Saved views" value="" onChange={event=>{const [op,name]=event.target.value.split('\u0000');if(op==='apply')applyView(name);if(op==='remove')act({type:'view-remove',name},false);event.target.value='';}}>
    <option value="">Views…</option>{Object.keys(namedViews).map(name=><optgroup key={name} label={name}><option value={`apply\u0000${name}`}>Apply</option><option value={`remove\u0000${name}`}>Remove</option></optgroup>)}</select>}</>}
   {constellationRequest&&<ConstellationAction request={constellationRequest} onError={message}/>}
   {editable&&host.editObject&&current&&localId&&<button aria-label="Edit object" title="Edit object" onClick={()=>host.editObject!(canvas.sceneId!,localId)}><ToolIcon name="pen"/></button>}
  </div>;
  const edgeId=!current?state.selectedEdge:null;
  const selectedEdgeObj=edgeId?canvas.edges.find(e=>e.id===edgeId):undefined;
  const relateEndpoints=editable&&host.relateKnowledge&&selectedEdgeObj&&host.nativeView()?.document.relations?.[selectedEdgeObj.id]?.native_owner==='oi'?{
   // The exact native occurrences (not their source subjects): one source
   // can hold two roles, and the constellation owner resolves each
   // occurrence to its own participation.
   from:host.nativeView()?.document.entities[selectedEdgeObj.sourceNodeId]?.subject?selectedEdgeObj.sourceNodeId:undefined,
   to:host.nativeView()?.document.entities[selectedEdgeObj.targetNodeId]?.subject?selectedEdgeObj.targetNodeId:undefined,
  }:undefined;
  const inspector=<div className="research-inspector-content" onKeyDown={event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();closeInspector();}}}><header><h3>{current?.title??(state.selectedEdge?'Connection':'Canvas')}</h3><button onClick={closeInspector} aria-label="Close canvas inspector">Close</button></header>
   {current&&<button onClick={()=>{const ref=current.type==='resource'?current.absolutePath:host.nativeView()?.document.entities[current.id]?.subject?.subject_ref;if(ref)host.inspectSubject(ref);}}>Open source</button>}
   {editable&&current&&localId&&host.editObject&&<button onClick={()=>host.editObject!(canvas.sceneId!,localId)}>Edit object</button>}
   {editable&&localId&&current&&<><label>Width<input type="number" defaultValue={Math.round(current.size.width)} onBlur={e=>act({type:'resize',id:localId,width:Number(e.target.value),height:current.size.height})}/></label><label>Height<input type="number" defaultValue={Math.round(current.size.height)} onBlur={e=>act({type:'resize',id:localId,width:current.size.width,height:Number(e.target.value)})}/></label>
   {<button disabled={!!subject&&!host.duplicateOccurrence} onClick={()=>subject?apply(()=>host.duplicateOccurrence!(canvas.sceneId!,localId)):act({type:'duplicate',id:localId})}>Duplicate</button>}
   {(['dotColour','bgColour','textColour'] as const).map(key=><label key={key}>{key==='dotColour'?'Dot colour':key==='bgColour'?'Background':'Text colour'}<input type="color" value={material?.cards[localId]?.[key]??'#808080'} onChange={e=>act({type:'card-style',id:localId,patch:{[key]:e.target.value}})}/></label>)}
   </>}
   {editable&&current&&host.transformBlueprint&&scene?.composition.blueprint&&blueprintMember(scene,current.id)&&<BlueprintWholeControls
     binding={scene.composition.blueprint}
     pinned={host.nativeView()?.document.entities[current.id]?.pinned===true}
     busy={materialInFlight>0}
     onTransform={transform=>apply(()=>host.transformBlueprint!(canvas.sceneId!,transform))}
     onRelease={()=>host.releaseBlueprint&&apply(()=>host.releaseBlueprint!(canvas.sceneId!))}
     onPin={next=>host.pinEntity&&apply(()=>host.pinEntity!(canvas.sceneId!,current.id,next),false)}
    />}
   {relateEndpoints?.from&&relateEndpoints.to&&<RelateKnowledgeAction sceneId={canvas.sceneId!} sourceRef={relateEndpoints.from} targetRef={relateEndpoints.to} defaultRelation={selectedEdgeObj!.relationKind} relate={host.relateKnowledge!} onError={message} onResult={message}/>}
   {editable&&(material?.strokes??[]).map((stroke,i)=><button key={stroke.id} onClick={()=>act({type:'annotation-remove',id:stroke.id})}>Remove annotation {i+1}</button>)}
  </div>;
  return <>{createPortal(controls,host.tools)}{inspecting&&createPortal(inspector,host.inspector)}<div className={`research-canvas ${editable?'research-canvas-native':'research-canvas-reading'}`} data-zoom={state.zoomLevel}>
   <CanvasView toolbarContainer={host.tools} canvasKey={canvas.key} initialViewport={state.canvas??material?.views.canvas} nodes={previewNodes} edges={previewEdges}
    selectedNodeId={state.selectedNode} selectedEdgeId={state.selectedEdge}
    selectedNodeIds={selection.size?[...selection]:undefined}
    selectionOnDrag={editable&&!!state.lassoOn}
    onSelectionChange={editable&&state.lassoOn?boxSelectionComplete:undefined}
    onViewportChange={viewport=>{
     // R3 — semantic zoom/LOD, driven directly by the vendored Canvas's own
     // viewport reporting instead of a 400ms captureCanvas() poll. Applies
     // to both native (editable) and read-only reading canvases.
     const level=semanticZoomLevel(viewport.zoom);
     if(level!==state.zoomLevel){state.zoomLevel=level;redraw();}
    }}
    readOnly={!editable}
    isEdgeReadOnly={id=>host.nativeView()?.document.relations?.[id]?.native_owner!=='oi'}
    onCreateNote={editable?position=>act({type:'create-card',kind:'note',position:{x:(position?.x??0)/CANVAS_UNITS,y:-(position?.y??0)/CANVAS_UNITS}}):undefined}
    onDuplicateNode={editable?id=>{if(host.nativeView()?.document.entities[id]?.subject){if(host.duplicateOccurrence)apply(()=>host.duplicateOccurrence!(canvas.sceneId!,occurrence(id)));else message('Native occurrence duplication is unavailable.');return;}act({type:'duplicate',id:occurrence(id)});}:undefined}
    onResizeNode={editable?(id,width,height)=>state.resizeGesture!.preview(id,{width,height},true):undefined}
    onUpdateImageCaption={editable?(id,caption)=>act({type:'card-caption',id:occurrence(id),caption},false):undefined}
    annotations={annotations} drawingEnabled={editable&&drawing}
    onCreateStroke={editable?points=>act({type:'annotation-add',stroke:{id:crypto.randomUUID(),points,color:strokeColour,width:3,opacity:1,createdAt:new Date().toISOString()}}):undefined}
    onRegisterFlyToNode={fly=>{flyToNode=fly;}}
    onRegisterFlyToEdge={fly=>{flyToEdge=fly;}}
    onDeleteNode={editable&&host.deleteOccurrence?id=>apply(()=>host.deleteOccurrence!(canvas.sceneId!,occurrence(id))):undefined}
    onUpdateNoteContent={editable?(id,content)=>act({type:'card-content',id:occurrence(id),content},false):undefined}
    onConnectNodes={editable&&host.connect?input=>apply(()=>host.connect!(canvas.sceneId!,{sourceEntityRef:input.sourceNodeId,targetEntityRef:input.targetNodeId,relationKind:input.relationKind,directionality:input.directionality})):undefined}
    onReconnectEdge={editable&&host.reconnect?(id,input)=>apply(()=>host.reconnect!(canvas.sceneId!,ownConnection(id),{sourceEntityRef:input.sourceNodeId,targetEntityRef:input.targetNodeId})):undefined}
    onDeleteEdge={editable&&host.deleteConnection?id=>apply(()=>host.deleteConnection!(canvas.sceneId!,ownConnection(id))):undefined}
    onUpdateEdgeRelationKind={editable&&host.updateConnectionKind?(id,kind)=>apply(()=>host.updateConnectionKind!(canvas.sceneId!,ownConnection(id),kind)):undefined}
    onCycleEdgeDirectionality={editable&&host.updateConnectionDirectionality?id=>{
     // An O:I presentation connection is directed; the control reverses it.
     if(!canvas.edges.some(e=>e.id===id))return;
     apply(()=>host.updateConnectionDirectionality!(canvas.sceneId!,ownConnection(id),'backward'));
    }:undefined}
    onToggleEdgeSequencing={editable?id=>{state.sequencedEdges??=new Set();if(state.sequencedEdges.has(id))state.sequencedEdges.delete(id);else state.sequencedEdges.add(id);redraw();}:undefined}
    onPlaySequence={editable?()=>{
     // Session-local walk over the presentation-only sequencing flags (see
     // ViewState.sequencedEdges): no native "sequence" reading exists to
     // replay, so this is a personal fly-through of the marked path.
     const active=previewEdges.filter(e=>e.sequencing);
     if(!active.length)return;
     const incoming=new Set(active.map(e=>e.targetNodeId));
     const start=active.map(e=>e.sourceNodeId).find(id=>!incoming.has(id))??active[0].sourceNodeId;
     const path=[start];const visited=new Set(path);let at=start;
     for(let step=0;step<active.length;step++){const exit=active.find(e=>e.sourceNodeId===at&&!visited.has(e.targetNodeId));if(!exit)break;path.push(exit.targetNodeId);visited.add(exit.targetNodeId);at=exit.targetNodeId;}
     path.forEach((id,index)=>setTimeout(()=>flyToNode?.(id),index*900));
    }:undefined}
    onSelectNode={id=>{selectMulti(id);redraw();}}
    // CanvasView reports onSelectEdge(null) right after every node click; that
    // clears only an edge selection and never the node just selected.
    onSelectEdge={id=>{if(id===null){if(state.selectedEdge!==null&&state.selectedEdge!==undefined){state.selectedEdge=null;redraw();}return;}state.selectedEdge=id;state.selectedNode=null;if(canvas.sceneId)host.select(canvas.sceneId,null,id??undefined);if(id)flyToEdge?.(id);redraw();}}
    onNodeDoubleClick={id=>{const view=host.nativeView(),node=canvas.nodes.find(n=>n.id===id);const subject=node?.type==='resource'?node.absolutePath:view?.document.entities[id]?.subject?.subject_ref;if(subject)host.inspectSubject(subject);else{select(id);dismissedCard=null;host.inspector.hidden=false;redraw();}}}
    onMoveNodePreview={editable?(id,position)=>{
     groupMove(id,state.snapToGrid?snapToGrid(position,CANVAS_UNITS/4,CANVAS_UNITS/16):position);
    }:undefined}
    onMoveNodeEnd={editable?(id,position)=>{
     groupMove(id,state.snapToGrid?snapToGrid(position,CANVAS_UNITS/4,CANVAS_UNITS/16):position);
     flushMoveEnd();
    }:undefined}
    onRegisterCaptureViewport={capture=>{captureCanvas=capture;}} />
  </div></>;
 }
 async function load(selected:ResearchInstrument){
  const generation=++epoch;unmount();mount.hidden=false;message('Reading…');
  try{
   const view=host.nativeView(),sceneId=host.sceneId();
   const sameBasis=()=>{const now=host.nativeView();return host.sceneId()===sceneId&&now?.document.expression_ref===view?.document.expression_ref&&now?.document.revision===view?.document.revision;};
   if(selected==='m1'&&view){
    relationReadings=[];const canvas=nativeCanvas(view,sceneId);if(epoch!==generation||destroyed)return;
    const state=stateFor(canvas.key),focus=view.document.selection;
    // Native focus seeds the selection; a live local selection of a node still
    // on this Canvas is never discarded by a reload of the same work.
    const focused=focus?.scene_ref===view.bindings[sceneId].scene_ref?focus.entity_ref??null:null;
    state.selectedNode=state.selectedNode&&canvas.nodes.some(node=>node.id===state.selectedNode)?state.selectedNode:focused;
    state.selectedEdge=focus?.scene_ref===view.bindings[sceneId].scene_ref?focus.relation_ref??null:null;
    message(canvas.hiddenCount?`${canvas.title} · ${canvas.hiddenCount} further members on other Scene pages`:canvas.title);
    render(canvasNode(canvas,state,generation));
    // R3 — semantic zoom/LOD is presentational only and never touches
    // entity/card size (interactions.ts semanticZoomLevel/labelsForZoom).
    // The vendored Canvas now reports the live viewport directly
    // (host-selection-viewport-gesture.patch onViewportChange, wired in
    // canvasNode above), so no polling loop is mounted here any more.
    if(canvas.edges.some(edge=>view.document.relations?.[edge.id]?.native_owner!=='oi'))void host.read({expression_ref:view.document.expression_ref,revision:view.document.revision,scene_ref:view.bindings[sceneId].scene_ref,facet:'relation-semantics'}).then(raw=>{
     if(epoch!==generation||destroyed||!sameBasis())return;
     const result=raw as {schema?:string;expression_ref?:string;revision?:number;scene_ref?:string;relation_readings?:NativeRelationDirectionReading[]};
     if(result.schema!=='oi.scene-relation-readings/v1'||result.expression_ref!==view.document.expression_ref||result.revision!==view.document.revision||result.scene_ref!==view.bindings[sceneId].scene_ref||!Array.isArray(result.relation_readings))throw new Error('The source direction reading returned another native Scene');
     relationReadings=result.relation_readings;render(canvasNode(nativeCanvas(view,sceneId),state,generation));
    }).catch(error=>{if(epoch===generation&&!destroyed&&sameBasis())message(error instanceof Error?error.message:String(error));});
    return;
   }
   // R6 (Wayfinder §21) — "choosing a frame can create an incomplete
   // working draft"; creation must not be disabled just because no native
   // Scene is open yet. An unbound m1 canvas offers the one eligible
   // creation act it can reach from here (host.createScene, if the host
   // declares it) instead of only a dead-end refusal message.
   if(selected==='m1'&&!view){
    message('Open a native Scene to disclose its own sources');
    render(<div className="research-instrument-message" role="status">
     <p>No native Scene is open in this composition yet.</p>
     {host.createScene?<button onClick={()=>{message('Creating…');void host.createScene!().then(()=>load('m1'),error=>message(error instanceof Error?error.message:String(error)));}}>New constellation</button>
      :<p>This host does not yet offer construction from an empty canvas.</p>}
    </div>);
    return;
   }
   const binding=view?.bindings[sceneId];
   if(!view||!binding)throw new Error('Open a native Scene to read its dates and places');
   const request={expression_ref:view.document.expression_ref,revision:view.document.revision,scene_ref:binding.scene_ref};
   const optionalReading=(facet:'node-metadata'|'scene-relations')=>host.read({...request,facet}).then(value=>({value,reason:''}),error=>({value:undefined,reason:error instanceof Error?error.message:String(error)}));
   const [raw,metadata,relationMetadata]=await Promise.all([host.read(request),optionalReading('node-metadata'),optionalReading('scene-relations')]);if(epoch!==generation||destroyed)return;
   if(!sameBasis())throw new Error('The selected construction changed while this reading was returning');
   assertInstrumentReadingScope(raw,view,sceneId);
   let tagReason=metadata.reason;let tags:ReadonlyMap<string,readonly string[]>=new Map();
   if(metadata.value!==undefined){try{tags=nativeInstrumentNodeTags(metadata.value,view,sceneId);}catch(error){tagReason=error instanceof Error?error.message:String(error);}}
   let relationReason=relationMetadata.reason;let sourceRelations:ReturnType<typeof nativeInstrumentSourceRelations>=[];
   if(relationMetadata.value!==undefined){try{sourceRelations=nativeInstrumentSourceRelations(relationMetadata.value,view,sceneId);}catch(error){relationReason=error instanceof Error?error.message:String(error);}}
   const data=await readingInstruments(raw,nativeInstrumentTitles(view,sceneId),nativeInstrumentPreviews(view,sceneId),tags,sourceRelations);if(epoch!==generation||destroyed)return;
   const state=stateFor(data.reading.subject.subject_ref);
   if(view){
    const loadTimeline=data.dataSource.loadTimelineView;
    data.dataSource.loadTimelineView=async(range,filters)=>{const returned=await loadTimeline(range,filters),material=host.sceneMaterial(sceneId).research;return {...returned,nodes:returned.nodes.map(node=>{const layout=material?.timeline[node.node.graphNodeId];return layout?{...node,layoutOverride:{lane:layout.lane??'default',offsetY:layout.offsetY,width:layout.width??240,height:layout.height??160,style:{},layoutRevision:layout.layoutRevision??0}}:node;})};};
    data.dataSource.saveTimelineLayout=async(input)=>{
     if(!data.bundle.nodes.some(n=>n.graphNodeId===input.graphNodeId))throw new Error('Timeline node is outside the current reading');
     if(Object.keys(input.style).length)throw new Error('Timeline style has no native material mapping yet; layout was not changed');
     await host.material(sceneId,{type:'timeline-layout',id:input.graphNodeId,expectedRevision:input.expectedRevision,value:{offsetY:input.offsetY,width:input.width,height:input.height,lane:input.lane}});
     const stored=host.sceneMaterial(sceneId).research?.timeline[input.graphNodeId];if(!stored)throw new Error('Native owner did not return the timeline layout');
     return {status:input.expectedRevision===null?'created':'updated',layout:{lane:stored.lane??input.lane,offsetY:stored.offsetY,width:stored.width??input.width,height:stored.height??input.height,style:{},layoutRevision:stored.layoutRevision!}};
    };
   }

   if(selected==='m1'){
    message('Source relations · open a card to inspect');render(canvasNode(data.canvas,state,generation));return;
   }
   if(selected==='m2'){
    const temporal=data.bundle.nodes.filter(n=>n.isTemporal);
    const years=temporal.flatMap(node=>[node.validFrom,node.validTo]).flatMap(value=>{const match=typeof value==='string'?/^(-?\d{1,6})(?:-|$)/.exec(value):null;return match?[Number(match[1])]:[];}).filter(Number.isFinite);
    const first=years.length?Math.min(...years):0,last=years.length?Math.max(...years):first;
    const available=Math.max(240,host.container.clientWidth-320);
    const savedTimeline=view?host.sceneMaterial(sceneId).research?.views.timeline:undefined;
    state.timeline??={centerYear:savedTimeline?.x??(first+last)/2,pixelsPerYear:savedTimeline?.zoom??Math.max(.02,Math.min(4000,available/Math.max(2,(last-first)*1.4))),selectedNodeId:null};
    // Chronology vs. the M2′ relation-field projections is a presentation
    // switch over the SAME reading/repository — never a second app, tab or
    // store (Wayfinder §16). Session-local only, like the timeline camera.
    state.m2Projection??='chronology';
    const setProjection=(next:'chronology'|'field')=>{state.m2Projection=next;render(canvasNode2());};
    const canvasNode2=():ReactNode=>{
     const toggle=<div className="research-tool-actions" role="tablist" aria-label="Timeline projection">
      <button role="tab" aria-selected={state.m2Projection==='chronology'} aria-pressed={state.m2Projection==='chronology'} onClick={()=>setProjection('chronology')}>Chronology</button>
      <button role="tab" aria-selected={state.m2Projection==='field'} aria-pressed={state.m2Projection==='field'} onClick={()=>setProjection('field')}>Relations</button>
      <button onClick={()=>void load('m2')}>Refresh timeline</button>
      {view&&state.m2Projection==='chronology'&&<button onClick={()=>{if(state.timeline)void host.material(sceneId,{type:'viewport',key:'timeline',value:{x:state.timeline.centerYear,y:0,zoom:state.timeline.pixelsPerYear}}).then(()=>message('View saved'),error=>message(String(error)));}}>Save view</button>}
      {(tagReason||relationReason)&&<button onClick={()=>message([tagReason&&`Tags: ${tagReason}`,relationReason&&`Relations: ${relationReason}`].filter(Boolean).join(' · '))}>Reading incomplete</button>}
     </div>;
     if(state.m2Projection==='field'){
      return <>{createPortal(toggle,host.tools)}<RelationFieldView reading={data.reading as unknown as TechneReading} width={available}
       onSelectRelation={edge=>{if(!edge.derived_id)host.select(sceneId,null,edge.id);}}
       onOpenMember={ref=>host.inspectSubject(ref)}/></>;
     }
     return <>{createPortal(toggle,host.tools)}<TimelineSurface timeExtent={years.length?{startYear:first,endYear:last}:undefined} toolbarContainer={host.tools} repository={data.timeline} constellationId={data.reading.subject.subject_ref} dataSource={data.dataSource}
      initialState={state.timeline!} onViewStateChange={value=>{state.timeline=value;}}
      onOpenCanvasNode={ref=>{const node=data.bundle.nodes.find(node=>node.graphNodeId===ref);if(node)host.inspectSubject(ref,{node});}} onOpenNode={(ref,node,relationField)=>host.inspectSubject(ref,{node,relationField})}/></>;
    };
    message(temporal.length||state.m2Projection==='field'?(state.m2Projection==='field'?'Relations':'Timeline'):'No dates disclosed by this source');
    render(canvasNode2());return;
   }
   const places=await data.places.getLocatedNodes(data.reading.subject.subject_ref);if(epoch!==generation||destroyed)return;
   // The shipped basemap is geographic context, never personal graph nodes.
   // Located subject markers come only from the current native reading.
   const pack=loadBundledGeographyPack();
   const tileSource={kind:'geojson' as const,url:'data:application/json,'+encodeURIComponent(JSON.stringify(pack.basemap)),attribution:pack.manifest.tileSource.attribution};
   message(places.length?'Places · offline':'No locations disclosed by this source');
   const scene=view?host.sceneMaterial(sceneId):undefined,assets=new Map<string,string>();
   const images=(scene?.entities??[]).flatMap(entity=>{const card=scene?.research?.cards[entity.id];if(entity.source?.kind!=='image'||!entity.source.image.dataUrl)return [];const artifactPath=`scene-image:${entity.id}`;assets.set(artifactPath,entity.source.image.dataUrl);return [{id:entity.id,profileScope:data.reading.subject.subject_ref,artifactPath,capturedAt:null,latitude:null,longitude:null,headingDegrees:null,redactionStatus:'pending' as const,redactionRegions:[],redactedArtifactPath:null,createdAt:card?.importedAt,updatedAt:card?.importedAt}];});
   const importImagery=scene?()=>{const picker=document.createElement('input');picker.type='file';picker.accept='image/png,image/jpeg,image/webp';picker.onchange=async()=>{const file=picker.files?.[0];if(!file)return;try{if(file.size>196608)throw new Error('Choose an image smaller than 192 KiB for this native document.');const bytes=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(reader.error);reader.readAsDataURL(file);});await host.material(sceneId,{type:'create-card',kind:'image',position:{x:0,y:0},title:file.name.slice(0,160),dataUrl:bytes});if(lens==='m4')await load('m4');}catch(error){message(String(error));}};picker.click();}:undefined;
   const savedPlace=scene?.research?.views.place;state.place??=savedPlace?{latitude:savedPlace.y,longitude:savedPlace.x,zoom:savedPlace.zoom}:undefined;
   // W3 — "Edit place/time" reopens the SAME native constellation route
   // "Edit constellation" already uses, for the Scene entity that carries
   // this reading's own subject; absent when no such entity is bound (an
   // honest absence, never a locally-invented edit path).
   const placeEntityRef=view?subjectEntityRef(view.document.entities,data.reading.subject.subject_ref):null;
   const placeEditRequest=view&&binding&&placeEntityRef?{expression_ref:view.document.expression_ref,revision:view.document.revision,scene_ref:binding.scene_ref,entity_ref:placeEntityRef}:undefined;
   state.placeFilter??=OPEN_PLACE_FILTER;
   // W2 — the SAME filter state drives both the map's own repository
   // (presentation-only: `filteredPlacesRepository` never rewrites the
   // wrapped repository's reads) and the panel's facet list, so the markers
   // and the panel always agree.
   const renderPlaces=():ReactNode=>{
    const filteredRepository=filteredPlacesRepository(data.places,data.reading as unknown as TechneReading,state.placeFilter!);
    return <>{createPortal(<div className="research-tool-actions"><button onClick={()=>void load('m4')}>Refresh geography</button>{scene&&<button onClick={()=>{if(state.place)void host.material(sceneId,{type:'viewport',key:'place',value:{x:state.place.longitude,y:state.place.latitude,zoom:state.place.zoom}}).then(()=>message('View saved'),error=>message(String(error)));}}>Save view</button>}</div>,host.tools)}
    <div className="research-places"><PsychogeographicMap inspectorContainer={host.inspector} toolbarContainer={host.tools} repository={filteredRepository} projectId={data.reading.subject.subject_ref} tileSource={tileSource} offlineOnly
     initialViewState={state.place} initialSelectedGraphNodeId={state.selectedPlace}
     onViewStateChange={value=>{state.place=value;}} onSelectedGraphNodeIdChange={value=>{state.selectedPlace=value;render(renderPlaces());}}
     onOpenCanvasNode={ref=>{const node=data.bundle.nodes.find(node=>node.graphNodeId===ref&&node.place);if(node)host.inspectSubject(ref,{node});}}/>
     <ImageryPanel tools={host.tools} toolbarContainer={host.tools} images={images} offlineOnly imageTitle={image=>scene?.entities.find(entity=>entity.id===image.id)?.name??'Scene image'} resolveAsset={path=>{const value=assets.get(path);if(!value)throw new Error('Image is not bound to this native Scene');return value;}} onImport={importImagery}/>
     <PlaceFacetsPanel reading={data.reading as unknown as TechneReading} selectedRef={state.selectedPlace??null} filter={state.placeFilter!}
      onFilterChange={next=>{state.placeFilter=next;render(renderPlaces());}}
      editRequest={placeEditRequest} onError={message}/>
    </div></>;
   };
   render(renderPlaces());
  }catch(error){if(epoch!==generation||destroyed)return;message(error instanceof Error?error.message:String(error));body.replaceChildren();}
 }
 return {
  async open(selected:ResearchInstrument){if(destroyed)throw new Error('Research instrument workspace is closed');lens=selected;await load(selected);},
  close(){++epoch;lens=null;unmount();mount.hidden=true;},
  async refresh(){
   if(materialInFlight){deferredRefresh=true;return;}
   if(!lens)return;
   // An acknowledged edit or native focus on the SAME composition and Scene
   // updates the Canvas in place: no remount, no camera reset, and the
   // person's selection is kept. Only a changed composition/Scene reloads.
   if(lens==='m1'&&currentKey){
    const view=host.nativeView(),sceneId=host.sceneId();
    if(view&&view.bindings[sceneId]){
     let canvas:InstrumentCanvas|undefined;try{canvas=nativeCanvas(view,sceneId);}catch{canvas=undefined;}
     if(canvas&&canvas.key===currentKey){const state=stateFor(canvas.key);if(state.selectedNode&&!canvas.nodes.some(node=>node.id===state.selectedNode))state.selectedNode=null;render(canvasNode(canvas,state,epoch));return;}
    }
   }
   await load(lens);
  },
  destroy(){++epoch;lens=null;destroyed=true;unmount();mount.remove();status.remove();views.clear();window.removeEventListener('keydown',onWindowKeydown);modifiers.dispose();},
  active(){return lens;},
 };
}
