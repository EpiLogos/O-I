/** Mature Research Canvas instruments mounted inside the running engine. */
import React,{Component,type ReactNode} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {CanvasView,TimelineSurface,PsychogeographicMap,loadBundledGeographyPack,createLiveServicePolicy,type TimelineViewState} from '../../vendor/research-canvas/components';
import type {KernelConversion} from './kernelDocumentBridge.js';
import {nativeInstrumentCanvas,readingInstruments,CANVAS_UNITS,assertInstrumentReadingScope,expressionTextFromNote,type InstrumentCanvas} from './researchInstrumentsData.js';
import './researchInstrumentStyles.css';
import './researchInstruments.css';

export type ResearchInstrument='m1'|'m2'|'m4';
export interface ResearchInstrumentsHost {
 container:HTMLElement;
 read:()=>Promise<unknown>;
 nativeView:()=>KernelConversion|undefined;
 sceneId:()=>string;
 select:(sceneId:string,entityId:string|null,bindingRef?:string)=>void;
 move:(sceneId:string,entityId:string,position:{x:number;y:number})=>Promise<void>;
 openSubject:(ref:string)=>void;
 createNote?:(sceneId:string,position:{x:number;y:number})=>Promise<void>;
 deleteOccurrence?:(sceneId:string,entityId:string)=>Promise<void>;
 updateContent?:(sceneId:string,entityId:string,text:string)=>Promise<void>;
 connect?:(sceneId:string,input:{sourceEntityRef:string;targetEntityRef:string;relationKind:string;directionality?:string})=>Promise<void>;
 reconnect?:(sceneId:string,bindingRef:string,input:{sourceEntityRef:string;targetEntityRef:string})=>Promise<void>;
 deleteConnection?:(sceneId:string,bindingRef:string)=>Promise<void>;
 updateConnectionKind?:(sceneId:string,bindingRef:string,kind:string)=>Promise<void>;
}
interface ViewState {canvas?:{x:number;y:number;zoom:number};timeline?:TimelineViewState;place?:{latitude:number;longitude:number;zoom:number};selectedNode?:string|null;selectedEdge?:string|null;selectedPlace?:string|null}
class InstrumentBoundary extends Component<{children:ReactNode},{error:string|null}> {
 state={error:null as string|null};
 static getDerivedStateFromError(error:unknown){return {error:error instanceof Error?error.message:String(error)};}
 render(){return this.state.error?<p role="alert" className="research-instrument-message">{this.state.error}</p>:this.props.children;}
}
export function installResearchInstruments(host:ResearchInstrumentsHost){
 let lens:ResearchInstrument|null=null,root:Root|null=null,epoch=0,destroyed=false;
 let captureCanvas:(()=>{x:number;y:number;zoom:number})|null=null,currentKey:string|null=null;
 const views=new Map<string,ViewState>();
 const policy=createLiveServicePolicy();
 let mutations:Promise<void>=Promise.resolve();
 const mount=document.createElement('div');mount.className='research-instrument';mount.hidden=true;host.container.append(mount);
 const status=document.createElement('div');status.className='research-instrument-status';status.setAttribute('role','status');
 const body=document.createElement('div');body.className='research-instrument-body';mount.append(status,body);
 const message=(text:string)=>{status.textContent=text;};
 function retain(){if(currentKey&&captureCanvas){const state=views.get(currentKey);if(state)state.canvas=captureCanvas();}captureCanvas=null;}
 function unmount(){retain();root?.unmount();root=null;body.replaceChildren();}
 function stateFor(key:string){let state=views.get(key);if(!state){state={};views.set(key,state);if(views.size>32)views.delete(views.keys().next().value!);}currentKey=key;return state;}
 function render(node:ReactNode){root??=createRoot(body);root.render(<InstrumentBoundary>{node}</InstrumentBoundary>);}
 function canvasNode(canvas:InstrumentCanvas,state:ViewState,generation:number){
  const editable=!!canvas.sceneId;
  const apply=(action:()=>Promise<void>,refresh=true)=>{
   const key=canvas.key;message('Saving…');
   mutations=mutations.catch(()=>{}).then(async()=>{
    if(destroyed||!host.nativeView()||nativeInstrumentCanvas(host.nativeView()!,host.sceneId()).key!==key)throw new Error('The selected native composition changed; the queued edit was not applied');
    await action();
    if(currentKey===key&&!destroyed){message('Saved');if(refresh&&lens==='m1')await load('m1');}
   }).catch(error=>{if(currentKey===key&&!destroyed)message(error instanceof Error?error.message:String(error));});
  };
  const occurrence=(id:string)=>{const value=canvas.occurrences.get(id);if(!value)throw new Error('This card has no native occurrence');return value;};
  const ownConnection=(id:string)=>{const relation=host.nativeView()?.document.relations?.[id];if(relation?.native_owner!=='oi')throw new Error('This source relation is read-only; use its native owner to change it');return id;};
  const select=(id:string|null)=>{state.selectedNode=id;state.selectedEdge=null;if(canvas.sceneId)host.select(canvas.sceneId,id?canvas.occurrences.get(id)??null:null);};
  const redraw=()=>{if(epoch===generation&&lens==='m1')render(canvasNode(canvas,state,generation));};
  return <div className={`research-canvas ${editable?'research-canvas-native':'research-canvas-reading'}`}>
   <CanvasView canvasKey={canvas.key} initialViewport={state.canvas} nodes={canvas.nodes} edges={canvas.edges}
    selectedNodeId={state.selectedNode} selectedEdgeId={state.selectedEdge}
    readOnly={!editable}
    isEdgeReadOnly={id=>host.nativeView()?.document.relations?.[id]?.native_owner!=='oi'}
    onCreateNote={editable&&host.createNote?position=>apply(()=>host.createNote!(canvas.sceneId!,{x:(position?.x??0)/CANVAS_UNITS,y:-(position?.y??0)/CANVAS_UNITS})):undefined}
    onDeleteNode={editable&&host.deleteOccurrence?id=>apply(()=>host.deleteOccurrence!(canvas.sceneId!,occurrence(id))):undefined}
    onUpdateNoteContent={editable&&host.updateContent?(id,content)=>{
     try{const text=expressionTextFromNote(content);apply(()=>host.updateContent!(canvas.sceneId!,occurrence(id),text),false);}
     catch(error){message(error instanceof Error?error.message:String(error));}
    }:undefined}
    onConnectNodes={editable&&host.connect?input=>apply(()=>host.connect!(canvas.sceneId!,{sourceEntityRef:input.sourceNodeId,targetEntityRef:input.targetNodeId,relationKind:input.relationKind,directionality:input.directionality})):undefined}
    onReconnectEdge={editable&&host.reconnect?(id,input)=>apply(()=>host.reconnect!(canvas.sceneId!,ownConnection(id),{sourceEntityRef:input.sourceNodeId,targetEntityRef:input.targetNodeId})):undefined}
    onDeleteEdge={editable&&host.deleteConnection?id=>apply(()=>host.deleteConnection!(canvas.sceneId!,ownConnection(id))):undefined}
    onUpdateEdgeRelationKind={editable&&host.updateConnectionKind?(id,kind)=>apply(()=>host.updateConnectionKind!(canvas.sceneId!,ownConnection(id),kind)):undefined}
    onSelectNode={id=>{select(id);redraw();}}
    onSelectEdge={id=>{state.selectedEdge=id;state.selectedNode=null;if(canvas.sceneId)host.select(canvas.sceneId,null,id??undefined);redraw();}}
    onNodeDoubleClick={id=>{const view=host.nativeView();const subject=view?.document.entities[id]?.subject?.subject_ref;host.openSubject(subject??id);}}
    onMoveNode={editable?(id,position)=>{
     const entityId=canvas.occurrences.get(id);if(!canvas.sceneId||!entityId)return;
     // UI follows the same exact occurrence; success is reported only after
     // the native workspace has acknowledged its CAS commit.
     message('Saving position…');
     apply(()=>host.move(canvas.sceneId!,entityId,{x:position.x/CANVAS_UNITS,y:-position.y/CANVAS_UNITS}));
    }:undefined}
    onRegisterCaptureViewport={capture=>{captureCanvas=capture;}} />
  </div>;
 }
 async function load(selected:ResearchInstrument){
  const generation=++epoch;unmount();mount.hidden=false;message('Reading…');
  try{
   const view=host.nativeView(),sceneId=host.sceneId();
   const sameBasis=()=>{const now=host.nativeView();return host.sceneId()===sceneId&&now?.document.expression_ref===view?.document.expression_ref&&now?.document.revision===view?.document.revision;};
   if(selected==='m1'&&view){
    const canvas=nativeInstrumentCanvas(view,sceneId);if(epoch!==generation||destroyed)return;
    const state=stateFor(canvas.key),focus=view.document.selection;
    state.selectedNode=focus?.scene_ref===view.bindings[sceneId].scene_ref?focus.entity_ref:null;
    state.selectedEdge=focus?.scene_ref===view.bindings[sceneId].scene_ref?focus.relation_ref??null:null;
    message(canvas.hiddenCount?`${canvas.title} · ${canvas.hiddenCount} further members on other Scene pages`:canvas.title);
    render(canvasNode(canvas,state,generation));return;
   }
   const raw=await host.read();if(epoch!==generation||destroyed)return;
   if(!sameBasis())throw new Error('The selected construction changed while this reading was returning');
   assertInstrumentReadingScope(raw,view,sceneId);
   const data=await readingInstruments(raw);if(epoch!==generation||destroyed)return;
   const state=stateFor(data.reading.subject.subject_ref);
   if(selected==='m1'){
    message('Source relations · open a card to inspect');render(canvasNode(data.canvas,state,generation));return;
   }
   if(selected==='m2'){
    const temporal=data.bundle.nodes.filter(n=>n.isTemporal),first=temporal.find(n=>n.validFrom)?.validFrom;
    const year=first?Number(/^(-?\d+)/.exec(first)?.[1]):0;
    state.timeline??={centerYear:Number.isFinite(year)?year:0,pixelsPerYear:60,selectedNodeId:null};
    message(temporal.length?'Timeline':'No dates disclosed by this source');
    render(<TimelineSurface repository={data.timeline} constellationId={data.reading.subject.subject_ref} dataSource={data.dataSource}
     initialState={state.timeline} onViewStateChange={value=>{state.timeline=value;}}
     onOpenCanvasNode={host.openSubject} onOpenNode={host.openSubject}/>);return;
   }
   const places=await data.places.getLocatedNodes(data.reading.subject.subject_ref);if(epoch!==generation||destroyed)return;
   // The shipped basemap is geographic context, never personal graph nodes.
   // Located subject markers come only from the current native reading.
   const pack=loadBundledGeographyPack();
   const tileSource={kind:'geojson' as const,url:'data:application/json,'+encodeURIComponent(JSON.stringify(pack.basemap)),attribution:pack.manifest.tileSource.attribution};
   message(places.length?'Places · offline':'No locations disclosed by this source');
   render(<PsychogeographicMap repository={data.places} projectId={data.reading.subject.subject_ref} tileSource={tileSource} policy={policy}
    initialViewState={state.place} initialSelectedGraphNodeId={state.selectedPlace}
    onViewStateChange={value=>{state.place=value;}} onSelectedGraphNodeIdChange={value=>{state.selectedPlace=value;}}
    onOpenCanvasNode={host.openSubject}/>);
  }catch(error){if(epoch!==generation||destroyed)return;message(error instanceof Error?error.message:String(error));body.replaceChildren();}
 }
 return {
  async open(selected:ResearchInstrument){if(destroyed)throw new Error('Research instrument workspace is closed');lens=selected;await load(selected);},
  close(){++epoch;lens=null;unmount();mount.hidden=true;},
  async refresh(){if(lens)await load(lens);},
  destroy(){++epoch;lens=null;destroyed=true;unmount();mount.remove();views.clear();},
  active(){return lens;},
 };
}
