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
import './researchInstrumentStyles.css';
import './researchInstruments.css';

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
 openSubject:(ref:string)=>void;
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
}
interface ViewState {
 canvas?:{x:number;y:number;zoom:number};timeline?:TimelineViewState;place?:{latitude:number;longitude:number;zoom:number};selectedNode?:string|null;selectedEdge?:string|null;selectedPlace?:string|null;
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
 let drawing=false,inspecting=false,strokeColour='#808080';let flyToNode:((id:string,viewport?:{x:number;y:number;zoom:number})=>void)|null=null;
 let flyToEdge:((id:string,viewport?:{x:number;y:number;zoom:number})=>void)|null=null;

 const mount=document.createElement('div');mount.className='research-instrument';mount.hidden=true;host.container.append(mount);
 const status=document.createElement('div');status.className='research-instrument-status';status.setAttribute('role','status');
 const body=document.createElement('div');body.className='research-instrument-body';mount.append(body);host.tools.append(status);
 const message=(text:string)=>{status.textContent=text;};
 function retain(){if(currentKey&&captureCanvas){const state=views.get(currentKey);if(state)state.canvas=captureCanvas();}captureCanvas=null;}
 function disposeGestures(){for(const state of views.values()){state.moveGesture?.dispose();state.resizeGesture?.dispose();}}
 function unmount(){retain();disposeGestures();root?.unmount();root=null;body.replaceChildren();}
 function stateFor(key:string){let state=views.get(key);if(!state){state={};views.set(key,state);if(views.size>32)views.delete(views.keys().next().value!);}currentKey=key;return state;}
 function render(node:ReactNode){root??=createRoot(body);root.render(<InstrumentBoundary>{node}</InstrumentBoundary>);}
 let relationReadings:NativeRelationDirectionReading[]=[];
 const nativeCanvas=(view:KernelConversion,sceneId:string)=>nativeInstrumentCanvas(view,sceneId,relationReadings);
 function canvasNode(canvas:InstrumentCanvas,state:ViewState,generation:number){
  const editable=!!canvas.sceneId;
  const scene=canvas.sceneId?host.sceneMaterial(canvas.sceneId):undefined;
  const material=scene?.research;
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
  const previewNodes=withGesturePreviews(canvas.nodes,id=>state.moveGesture?.previewValue(id),id=>state.resizeGesture?.previewValue(id));
  const previewEdges=canvas.edges.map(edge=>state.sequencedEdges?.has(edge.id)?{...edge,sequencing:true}:edge);
  const current=canvas.nodes.find(n=>n.id===state.selectedNode);
  const localId=current?canvas.occurrences.get(current.id):undefined;
  const nativeView=host.nativeView(),nativeScene=canvas.sceneId?nativeView?.bindings[canvas.sceneId]?.scene_ref:undefined;
  const subject=current?nativeView?.document.entities[current.id]?.subject:undefined;
  const constellationRequest=nativeView&&nativeScene&&current&&subject&&Array.isArray(subject.readings)&&subject.readings.length>1?{expression_ref:nativeView.document.expression_ref,revision:nativeView.document.revision,scene_ref:nativeScene,entity_ref:current.id}:undefined;
  const imageImport=()=>{const input=document.createElement('input');input.type='file';input.accept='image/png,image/jpeg,image/webp';input.onchange=async()=>{const file=input.files?.[0];if(!file)return;try{if(file.size>196608)throw new Error('Choose an image smaller than 192 KiB for this native document.');const dataUrl=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(reader.error);reader.readAsDataURL(file);});act({type:'create-card',kind:'image',title:file.name.slice(0,160),dataUrl,position:{x:0,y:0}});}catch(error){message(String(error));}};input.click();};
  const annotations=(material?.strokes??[]).map(stroke=>({id:stroke.id,canvasId:canvas.key,annotationType:'stroke' as const,points:stroke.points,style:{color:stroke.color,width:stroke.width,opacity:stroke.opacity},bounds:{position:{x:Math.min(...stroke.points.map(p=>p.x)),y:Math.min(...stroke.points.map(p=>p.y))},size:{width:Math.max(1,Math.max(...stroke.points.map(p=>p.x))-Math.min(...stroke.points.map(p=>p.x))),height:Math.max(1,Math.max(...stroke.points.map(p=>p.y))-Math.min(...stroke.points.map(p=>p.y)))}},createdAt:stroke.createdAt,updatedAt:stroke.createdAt}));
  const closeInspector=()=>{inspecting=false;host.inspector.hidden=true;redraw();host.tools.querySelector<HTMLButtonElement>('[aria-label="Toggle canvas inspector"]')?.focus();};
  const controls=<div className="research-tool-actions" aria-label="Canvas tools">
   {editable&&<><button onClick={()=>act({type:'create-card',kind:'note',position:{x:0,y:0}})}>Note</button><button onClick={imageImport}>Image</button>
   <select aria-label="Focus disclosed source" value="" onChange={event=>{const ref=event.target.value;const source=canvas.nodes.find(node=>node.id===ref);if(!source||!canvas.occurrences.has(ref)||!host.nativeView()?.document.entities[ref]?.subject)return;select(ref);flyToNode?.(ref);redraw();}}><option value="">Source…</option>{canvas.nodes.filter(node=>host.nativeView()?.document.entities[node.id]?.subject).map(node=><option key={node.id} value={node.id}>{node.title}</option>)}</select>
   <button aria-pressed={drawing} onClick={()=>{drawing=!drawing;redraw();}}>Draw</button>{drawing&&<input type="color" aria-label="Stroke colour" value={strokeColour} onChange={e=>{strokeColour=e.target.value;redraw();}}/>}
   <button onClick={()=>{if(captureCanvas)act({type:'viewport',key:'canvas',value:captureCanvas()},false);}}>Save view</button></>}
   {constellationRequest&&<ConstellationAction request={constellationRequest} onError={message}/>}
   {editable&&host.editObject&&current&&localId&&<button aria-label="Edit object" title="Edit object" onClick={()=>host.editObject!(canvas.sceneId!,localId)}>✎</button>}
   <button aria-label="Toggle canvas inspector" aria-pressed={inspecting} onClick={()=>{inspecting=!inspecting;host.inspector.hidden=!inspecting;redraw();}}>Inspector</button>
  </div>;
  const edgeId=!current?state.selectedEdge:null;
  const selectedEdgeObj=edgeId?canvas.edges.find(e=>e.id===edgeId):undefined;
  const relateEndpoints=editable&&host.relateKnowledge&&selectedEdgeObj&&host.nativeView()?.document.relations?.[selectedEdgeObj.id]?.native_owner==='oi'?{
   from:host.nativeView()?.document.entities[selectedEdgeObj.sourceNodeId]?.subject?.subject_ref,
   to:host.nativeView()?.document.entities[selectedEdgeObj.targetNodeId]?.subject?.subject_ref,
  }:undefined;
  const inspector=<div className="research-inspector-content" onKeyDown={event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();closeInspector();}}}><header><h3>{current?.title??(state.selectedEdge?'Connection':'Canvas')}</h3><button onClick={closeInspector} aria-label="Close canvas inspector">Close</button></header>
   {current&&<button onClick={()=>{const ref=current.type==='resource'?current.absolutePath:host.nativeView()?.document.entities[current.id]?.subject?.subject_ref;if(ref)host.inspectSubject(ref);else{inspecting=true;host.inspector.hidden=false;redraw();}}}>Open source</button>}
   {editable&&current&&localId&&host.editObject&&<button onClick={()=>host.editObject!(canvas.sceneId!,localId)}>Edit object</button>}
   {editable&&localId&&current&&<><label>Width<input type="number" defaultValue={Math.round(current.size.width)} onBlur={e=>act({type:'resize',id:localId,width:Number(e.target.value),height:current.size.height})}/></label><label>Height<input type="number" defaultValue={Math.round(current.size.height)} onBlur={e=>act({type:'resize',id:localId,width:current.size.width,height:Number(e.target.value)})}/></label>
   {<button disabled={!!subject&&!host.duplicateOccurrence} onClick={()=>subject?apply(()=>host.duplicateOccurrence!(canvas.sceneId!,localId)):act({type:'duplicate',id:localId})}>Duplicate</button>}
   {(['dotColour','bgColour','textColour'] as const).map(key=><label key={key}>{key==='dotColour'?'Dot colour':key==='bgColour'?'Background':'Text colour'}<input type="color" value={material?.cards[localId]?.[key]??'#808080'} onChange={e=>act({type:'card-style',id:localId,patch:{[key]:e.target.value}})}/></label>)}
   </>}
   {relateEndpoints?.from&&relateEndpoints.to&&<RelateKnowledgeAction sceneId={canvas.sceneId!} sourceRef={relateEndpoints.from} targetRef={relateEndpoints.to} defaultRelation={selectedEdgeObj!.relationKind} relate={host.relateKnowledge!} onError={message} onResult={message}/>}
   {editable&&(material?.strokes??[]).map((stroke,i)=><button key={stroke.id} onClick={()=>act({type:'annotation-remove',id:stroke.id})}>Remove annotation {i+1}</button>)}
  </div>;
  return <>{createPortal(controls,host.tools)}{inspecting&&createPortal(inspector,host.inspector)}<div className={`research-canvas ${editable?'research-canvas-native':'research-canvas-reading'}`}>
   <CanvasView toolbarContainer={host.tools} canvasKey={canvas.key} initialViewport={state.canvas??material?.views.canvas} nodes={previewNodes} edges={previewEdges}
    selectedNodeId={state.selectedNode} selectedEdgeId={state.selectedEdge}
    readOnly={!editable}
    isEdgeReadOnly={id=>host.nativeView()?.document.relations?.[id]?.native_owner!=='oi'}
    onCreateNote={editable?position=>act({type:'create-card',kind:'note',position:{x:(position?.x??0)/CANVAS_UNITS,y:-(position?.y??0)/CANVAS_UNITS}}):undefined}
    onDuplicateNode={editable?id=>{if(host.nativeView()?.document.entities[id]?.subject){if(host.duplicateOccurrence)apply(()=>host.duplicateOccurrence!(canvas.sceneId!,occurrence(id)));else message('Native occurrence duplication is unavailable.');return;}act({type:'duplicate',id:occurrence(id)});}:undefined}
    onResizeNode={editable?(id,width,height)=>state.resizeGesture!.preview(id,{width,height}):undefined}
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
    onSelectNode={id=>{select(id);redraw();}}
    onSelectEdge={id=>{state.selectedEdge=id;state.selectedNode=null;if(canvas.sceneId)host.select(canvas.sceneId,null,id??undefined);if(id)flyToEdge?.(id);redraw();}}
    onNodeDoubleClick={id=>{const view=host.nativeView(),node=canvas.nodes.find(n=>n.id===id);const subject=node?.type==='resource'?node.absolutePath:view?.document.entities[id]?.subject?.subject_ref;if(subject)host.inspectSubject(subject);else{select(id);inspecting=true;host.inspector.hidden=false;redraw();}}}
    onMoveNode={editable?(id,position)=>state.moveGesture!.preview(id,position):undefined}
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
    state.selectedNode=focus?.scene_ref===view.bindings[sceneId].scene_ref?focus.entity_ref:null;
    state.selectedEdge=focus?.scene_ref===view.bindings[sceneId].scene_ref?focus.relation_ref??null:null;
    message(canvas.hiddenCount?`${canvas.title} · ${canvas.hiddenCount} further members on other Scene pages`:canvas.title);
    render(canvasNode(canvas,state,generation));
    if(canvas.edges.some(edge=>view.document.relations?.[edge.id]?.native_owner!=='oi'))void host.read({expression_ref:view.document.expression_ref,revision:view.document.revision,scene_ref:view.bindings[sceneId].scene_ref,facet:'relation-semantics'}).then(raw=>{
     if(epoch!==generation||destroyed||!sameBasis())return;
     const result=raw as {schema?:string;expression_ref?:string;revision?:number;scene_ref?:string;relation_readings?:NativeRelationDirectionReading[]};
     if(result.schema!=='oi.scene-relation-readings/v1'||result.expression_ref!==view.document.expression_ref||result.revision!==view.document.revision||result.scene_ref!==view.bindings[sceneId].scene_ref||!Array.isArray(result.relation_readings))throw new Error('The source direction reading returned another native Scene');
     relationReadings=result.relation_readings;render(canvasNode(nativeCanvas(view,sceneId),state,generation));
    }).catch(error=>{if(epoch===generation&&!destroyed&&sameBasis())message(error instanceof Error?error.message:String(error));});
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
    message(temporal.length?'Timeline':'No dates disclosed by this source');
    render(<>{createPortal(<div className="research-tool-actions"><button onClick={()=>void load('m2')}>Refresh timeline</button>{view&&<button onClick={()=>{if(state.timeline)void host.material(sceneId,{type:'viewport',key:'timeline',value:{x:state.timeline.centerYear,y:0,zoom:state.timeline.pixelsPerYear}}).then(()=>message('View saved'),error=>message(String(error)));}}>Save view</button>}{(tagReason||relationReason)&&<button onClick={()=>message([tagReason&&`Tags: ${tagReason}`,relationReason&&`Relations: ${relationReason}`].filter(Boolean).join(' · '))}>Reading incomplete</button>}</div>,host.tools)}<TimelineSurface timeExtent={years.length?{startYear:first,endYear:last}:undefined} toolbarContainer={host.tools} repository={data.timeline} constellationId={data.reading.subject.subject_ref} dataSource={data.dataSource}
     initialState={state.timeline} onViewStateChange={value=>{state.timeline=value;}}
     onOpenCanvasNode={ref=>{const node=data.bundle.nodes.find(node=>node.graphNodeId===ref);if(node)host.inspectSubject(ref,{node});}} onOpenNode={(ref,node,relationField)=>host.inspectSubject(ref,{node,relationField})}/></>);return;
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
   render(<>{createPortal(<div className="research-tool-actions"><button onClick={()=>void load('m4')}>Refresh geography</button>{scene&&<button onClick={()=>{if(state.place)void host.material(sceneId,{type:'viewport',key:'place',value:{x:state.place.longitude,y:state.place.latitude,zoom:state.place.zoom}}).then(()=>message('View saved'),error=>message(String(error)));}}>Save view</button>}</div>,host.tools)}
   <div className="research-places"><PsychogeographicMap inspectorContainer={host.inspector} toolbarContainer={host.tools} repository={data.places} projectId={data.reading.subject.subject_ref} tileSource={tileSource} offlineOnly
    initialViewState={state.place} initialSelectedGraphNodeId={state.selectedPlace}
    onViewStateChange={value=>{state.place=value;}} onSelectedGraphNodeIdChange={value=>{state.selectedPlace=value;}}
    onOpenCanvasNode={ref=>{const node=data.bundle.nodes.find(node=>node.graphNodeId===ref&&node.place);if(node)host.inspectSubject(ref,{node});}}/>
    <ImageryPanel tools={host.tools} toolbarContainer={host.tools} images={images} offlineOnly imageTitle={image=>scene?.entities.find(entity=>entity.id===image.id)?.name??'Scene image'} resolveAsset={path=>{const value=assets.get(path);if(!value)throw new Error('Image is not bound to this native Scene');return value;}} onImport={importImagery}/></div></>);
  }catch(error){if(epoch!==generation||destroyed)return;message(error instanceof Error?error.message:String(error));body.replaceChildren();}
 }
 return {
  async open(selected:ResearchInstrument){if(destroyed)throw new Error('Research instrument workspace is closed');lens=selected;await load(selected);},
  close(){++epoch;lens=null;unmount();mount.hidden=true;},
  async refresh(){if(materialInFlight){deferredRefresh=true;return;}if(lens)await load(lens);},
  destroy(){++epoch;lens=null;destroyed=true;unmount();mount.remove();status.remove();views.clear();},
  active(){return lens;},
 };
}
