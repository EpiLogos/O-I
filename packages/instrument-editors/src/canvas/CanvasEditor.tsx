import React,{useEffect,useMemo,useRef,useState} from 'react';
import {nativeInstrumentCanvas,CANVAS_UNITS} from '../../../../desktop/cradle/expressions-app/field-studies-journeys/src/researchInstrumentsData.js';
import type {InstrumentCanvas} from '../../../../desktop/cradle/expressions-app/field-studies-journeys/src/researchInstrumentsData.js';
import type {BlueprintTransform} from '../../../../desktop/cradle/expressions-app/field-studies-journeys/src/blueprintGeometry.js';
import {assertCanvasBasis,bindResearchHost,canvasBasis,CanvasOperations,type CanvasOperation,type CanvasBasis,type ResearchInstrumentsHost} from './adapter.js';
import {bounds,fitBox,snapPosition,zoomBox,type Box,type Guide,type Point} from './geometry.js';
import './canvas.css';

export interface CanvasEditorProps {
 depth:'compact'|'full';
 host:ResearchInstrumentsHost;
 /** Follow changes only when the parent publishes the retained owner's revision. Pin is exact, never a name lookup. */
 target?:{mode:'follow'|'pin';sceneId?:string};
 revision?:number|string;
 visible?:boolean;
 onInspectGraph?:(subjectRef:string)=>void;
 /** Parent supplies the existing owner's checkpoint; absence offers no save success. */
 onCheckpoint?:()=>Promise<void>;
 /** Common frame uses this to prevent a target transfer over a retained Canvas gesture. */
 onDraftChange?:(pending:boolean)=>void;
 /** Exact owner standing, including a refused native commit. */
 ownerPending?:boolean;
 /** Must resolve all supplied exact retained inputs through the native owner. */
 onRetryPending?:(operations:readonly CanvasOperation[])=>Promise<void>;
 onRevertPending?:(operations:readonly CanvasOperation[])=>Promise<void>;
}
export function CanvasEditor({depth,host,target,revision,visible=true,onInspectGraph,onCheckpoint,onDraftChange,ownerPending=false,onRetryPending,onRevertPending}:CanvasEditorProps){
 const sceneId=target?.mode==='pin'?target.sceneId:host.sceneId();
 const source=useRef(host);source.current=host;
 const callback=useRef(onDraftChange);callback.current=onDraftChange;
 const gestureDraft=useRef(false),nativePending=useRef(ownerPending);nativePending.current=ownerPending;
 const [operations,setOperations]=useState<readonly CanvasOperation[]>([]),[resolutionError,setResolutionError]=useState('');
 const tracker=useRef<CanvasOperations>();if(!tracker.current)tracker.current=new CanvasOperations(value=>{callback.current?.(gestureDraft.current||nativePending.current||value.length>0);setOperations(value);});
 const receiving=useMemo(()=>new Proxy(host,{get:(_,key)=>key==='material'?(id:string,action:CanvasOperation['action'])=>tracker.current!.run(id,action,()=>source.current.material(id,action)):Reflect.get(source.current,key)}),[]);
 const draftChanged=(value:boolean)=>{gestureDraft.current=value;callback.current?.(value||ownerPending||tracker.current!.dirty);};
 useEffect(()=>{callback.current?.(gestureDraft.current||ownerPending||tracker.current!.dirty);},[ownerPending]);
 const resolve=async(run:NonNullable<CanvasEditorProps['onRetryPending']>)=>{setResolutionError('');try{await tracker.current!.resolve(run);}catch(error){setResolutionError(String(error));}};
 let canvas:InstrumentCanvas|undefined,error='';
 try{const view=host.nativeView();if(!sceneId||!view)throw Error('Open a native Scene to edit its Canvas.');canvas=nativeInstrumentCanvas(view,sceneId);}catch(reason){error=reason instanceof Error?reason.message:String(reason);}
 const [hasExpanded,setHasExpanded]=useState(depth==='full');
 useEffect(()=>{if(depth==='full')setHasExpanded(true);},[depth]);
 return <section className={`native-canvas-editor native-canvas-editor--${depth}`} aria-label="Canvas editor" hidden={!visible}>
  {(operations.length>0||ownerPending)&&<p role="status">Native Canvas input retained{operations.filter(value=>value.error).map(value=>`: ${value.action.type} · ${value.error}`).join('')}. {onRetryPending&&<button disabled={operations.some(value=>value.pending>0)} onClick={()=>void resolve(onRetryPending)}>Retry native Canvas input</button>}{onRevertPending&&<button disabled={operations.some(value=>value.pending>0)} onClick={()=>void resolve(onRevertPending)}>Revert native Canvas input</button>}</p>}
  {resolutionError&&<p role="alert">{resolutionError}</p>}
  {error?<p role="status">{error}</p>:canvas&&<>
   <div hidden={depth!=='compact'}><CompactCanvas key={canvas.key} canvas={canvas} host={receiving} revision={revision} onInspectGraph={onInspectGraph} onCheckpoint={onCheckpoint} onDraftChange={draftChanged}/></div>
   {hasExpanded&&<FullCanvas key={canvas.key} host={receiving} sceneId={sceneId!} revision={revision} dirty={operations.length>0||ownerPending} visible={visible&&depth==='full'}/>}
  </>}
 </section>;
}

function FullCanvas({host,sceneId,revision,visible,dirty}:{host:ResearchInstrumentsHost;sceneId:string;revision?:number|string;visible:boolean;dirty:boolean}){
 const container=useRef<HTMLDivElement>(null),tools=useRef<HTMLDivElement>(null),inspector=useRef<HTMLElement>(null),canvasHome=useRef<HTMLElement>(null);
 const installed=useRef<ReturnType<typeof import('../../../../desktop/cradle/expressions-app/field-studies-journeys/src/researchInstruments.js')['installResearchInstruments']>>();
 const [failure,setFailure]=useState('');
 useEffect(()=>{
  let disposed=false;
  void import('../../../../desktop/cradle/expressions-app/field-studies-journeys/src/researchInstruments.js').then(({installResearchInstruments})=>{
   if(disposed)return;
   const bound=bindResearchHost(host,sceneId,{container:container.current!,tools:tools.current!,inspector:inspector.current!,canvasHome:canvasHome.current!});
   installed.current=installResearchInstruments(bound);return installed.current.open('m1');
  }).catch(error=>{if(!disposed)setFailure(error instanceof Error?error.message:String(error));});
  return()=>{disposed=true;installed.current?.destroy();installed.current=undefined;};
 },[host,sceneId]);
 useEffect(()=>{if(visible&&!dirty)void installed.current?.refresh().catch(error=>setFailure(String(error)));},[revision,visible,dirty]);
 return <div className="native-canvas-full" hidden={!visible}>
  <div className="native-canvas-full-tools" ref={tools}/>
  {failure&&<p role="alert">{failure}</p>}
  <div className="native-canvas-full-workspace"><div className="native-canvas-full-stage" ref={container}/><aside className="native-canvas-full-inspector" ref={inspector}/><aside className="native-canvas-full-studio" ref={canvasHome}/></div>
 </div>;
}

function CompactCanvas({canvas,host,revision,onInspectGraph,onCheckpoint,onDraftChange}:{canvas:InstrumentCanvas;host:ResearchInstrumentsHost;revision?:number|string;onInspectGraph?:CanvasEditorProps['onInspectGraph'];onCheckpoint?:CanvasEditorProps['onCheckpoint'];onDraftChange?:CanvasEditorProps['onDraftChange']}){
 const svg=useRef<SVGSVGElement>(null),frame=useRef<HTMLDivElement>(null);
 const [camera,setCamera]=useState<Box>(()=>fitBox(bounds(canvas.nodes),500,220));
 const [selection,setSelection]=useState<Set<string>>(()=>new Set(host.nativeView()?.document.selection?.entity_ref?[host.nativeView()!.document.selection!.entity_ref!]:[]));
 const [draft,setDraft]=useState<Map<string,Point>>(new Map()),[guides,setGuides]=useState<Guide[]>([]),[grid,setGrid]=useState(false),[status,setStatus]=useState(''),[busy,setBusy]=useState(false),[query,setQuery]=useState(''),[searchOpen,setSearchOpen]=useState(false),[minimap,setMinimap]=useState(true),[present,setPresent]=useState<number|null>(null);
 const gesture=useRef<{id:string;start:Point;screenStart?:Point;positions:Map<string,Point>;basis:CanvasBasis;camera:Box}|null>(null);
 const [coordinates,setCoordinates]=useState<{id:string;basis:CanvasBasis;x?:string;y?:string}|null>(null);
 const draftRef=useRef(draft);draftRef.current=draft;
 const presentationReturn=useRef<Box|null>(null);
 const draftCallback=useRef(onDraftChange);draftCallback.current=onDraftChange;
 useEffect(()=>{draftCallback.current?.(draft.size>0||busy||coordinates!==null);},[draft.size,busy,coordinates]);
 const selectionRef=useRef(selection);selectionRef.current=selection;
 const scene=host.sceneMaterial(canvas.sceneId!),blueprint=scene.composition.blueprint;
 const selectedNodes=canvas.nodes.filter(n=>selection.has(n.id));
 const frames=Object.entries(scene.research?.frames??{}).sort(([,a],[,b])=>a.z-b.z);
 const withDraft=canvas.nodes.map(node=>({...node,position:draft.get(node.id)??node.position}));
 const fit=(nodes=canvas.nodes)=>{const size=svg.current?.getBoundingClientRect();setCamera(fitBox(bounds(nodes),size?.width??500,size?.height??220));};
 useEffect(()=>{const observer=new ResizeObserver(()=>{const size=svg.current?.getBoundingClientRect();if(size&&size.width&&size.height)setCamera(current=>fitBox(current,size.width,size.height,0));});if(svg.current)observer.observe(svg.current);return()=>observer.disconnect();},[]);
 useEffect(()=>{if(coordinates||draft.size||busy)return;const focus=host.nativeView()?.document.selection;if(focus&&focus.scene_ref===host.nativeView()?.bindings[canvas.sceneId!]?.scene_ref&&focus.entity_ref){const entityRef=focus.entity_ref;setSelection(current=>current.has(entityRef)?current:new Set([entityRef]));}},[revision,host,canvas.sceneId,coordinates,draft.size,busy]);
 const point=(event:{clientX:number;clientY:number}):Point=>{const rect=svg.current!.getBoundingClientRect();return {x:camera.x+(event.clientX-rect.left)*camera.width/rect.width,y:camera.y+(event.clientY-rect.top)*camera.height/rect.height};};
 const select=(id:string,extend=false)=>{if((coordinates&&coordinates.id!==id)||(draft.size&&!draft.has(id))){setStatus('Finish or cancel the retained position input before selecting another occurrence.');return false;}const next=extend?new Set(selection):new Set<string>();if(extend&&next.has(id))next.delete(id);else next.add(id);selectionRef.current=next;setSelection(next);host.select(canvas.sceneId!,canvas.occurrences.get(id)??null);return true;};
 const run=async(operation:()=>Promise<void>,label='Native edit acknowledged')=>{setBusy(true);setStatus('Applying…');try{await operation();setStatus(label);return true;}catch(error){setStatus(error instanceof Error?error.message:String(error));return false;}finally{setBusy(false);}};
 const move=async(positions:Map<string,Point>,basis:CanvasBasis)=>{
  assertCanvasBasis(host,basis);
  const moves=[...positions].map(([id,position])=>{const entityId=canvas.occurrences.get(id);if(!entityId)throw Error('Canvas occurrence is no longer available.');return {entityId,position:{x:position.x/CANVAS_UNITS,y:-position.y/CANVAS_UNITS}};});
  if(moves.length>1&&!host.moveMany)throw Error('This native owner does not offer an atomic selection move.');
  if(host.moveMany)await host.moveMany(canvas.sceneId!,moves);else if(moves[0])await host.move(canvas.sceneId!,moves[0].entityId,moves[0].position);
 };
 const finish=async()=>{const active=gesture.current;if(!active)return;gesture.current=null;setGuides([]);if(active.id==='__pan__')return;const intended=draftRef.current;if(!intended.size)return;const ok=await run(()=>move(intended,active.basis));if(ok)setDraft(new Map());};
 const cancel=()=>{gesture.current=null;setDraft(new Map());setCoordinates(null);setGuides([]);setStatus('Canvas gesture input cancelled');};
 const nudge=(dx:number,dy:number)=>{if(coordinates){setStatus('Finish or cancel the retained position input before nudging.');return;}const positions=new Map(selectedNodes.map(node=>[node.id,{x:(draftRef.current.get(node.id)??node.position).x+dx,y:(draftRef.current.get(node.id)??node.position).y+dy}]));setDraft(positions);draftCallback.current?.(true);void run(()=>move(positions,canvasBasis(host,canvas.sceneId!))).then(ok=>{if(ok)setDraft(new Map());});};
 const coordinate=(node:InstrumentCanvas['nodes'][number],axis:'x'|'y',value:string)=>{draftCallback.current?.(true);setCoordinates(current=>({...((current?.id===node.id)?current:{id:node.id,basis:canvasBasis(host,canvas.sceneId!)}),[axis]:value}));};
 const commitCoordinate=(node:InstrumentCanvas['nodes'][number],axis:'x'|'y',text:string)=>{
  const value=Number(text);if(!text.trim()||!Number.isFinite(value)){setStatus('Enter a finite native position. The input is retained.');return;}
  const held=coordinates,position={...(draftRef.current.get(node.id)??node.position),[axis]:(axis==='x'?1:-1)*value*CANVAS_UNITS};
  const positions=new Map([[node.id,position]]),basis=held?.id===node.id?held.basis:canvasBasis(host,canvas.sceneId!);
  setDraft(positions);draftCallback.current?.(true);
  void run(()=>move(positions,basis)).then(ok=>{if(ok){setDraft(new Map());setCoordinates(current=>current===held?null:current);}});
 };
 const jump=(node:InstrumentCanvas['nodes'][number])=>{select(node.id);const size=svg.current?.getBoundingClientRect();setCamera(fitBox(bounds([node]),size?.width??500,size?.height??220,60));};
 const matches=canvas.nodes.filter(node=>query.trim()&&`${node.title} ${'content' in node?node.content:''} ${node.summary??''}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
 const [matchIndex,setMatchIndex]=useState(0);
 const presentFrame=(index:number)=>{const entry=frames[index];if(!entry)return;const nodes=canvas.nodes.filter(node=>entry[1].memberRefs.includes(canvas.occurrences.get(node.id)??''));fit(nodes);setPresent(index);};
 useEffect(()=>{const changed=()=>{if(!document.fullscreenElement){setPresent(null);if(presentationReturn.current){setCamera(presentationReturn.current);presentationReturn.current=null;}}};document.addEventListener('fullscreenchange',changed);return()=>document.removeEventListener('fullscreenchange',changed);},[]);
 const transform=(patch:Partial<BlueprintTransform>)=>{if(blueprint&&host.transformBlueprint)void run(()=>host.transformBlueprint!(canvas.sceneId!,{...blueprint.transform,...patch}));};
 return <div className="native-canvas-compact" ref={frame} onKeyDown={event=>{
  if((event.target as HTMLElement).matches('input,textarea,select'))return;
  if(event.key==='Escape'){cancel();setSearchOpen(false);if(document.fullscreenElement)void document.exitFullscreen();setPresent(null);}
  if(present!==null&&['ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();presentFrame(Math.max(0,Math.min(frames.length-1,present+(event.key==='ArrowRight'?1:-1))));return;}
  const step=event.shiftKey?40:10;
  if(selection.size&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)){event.preventDefault();nudge(event.key==='ArrowLeft'?-step:event.key==='ArrowRight'?step:0,event.key==='ArrowUp'?-step:event.key==='ArrowDown'?step:0);}
  if(event.key==='+'||event.key==='='){event.preventDefault();setCamera(value=>zoomBox(value,1.25));}if(event.key==='-'){event.preventDefault();setCamera(value=>zoomBox(value,.8));}if(event.key==='0'){event.preventDefault();fit();}
  if(event.key.toLowerCase()==='f'&&(event.ctrlKey||event.metaKey)){event.preventDefault();setSearchOpen(true);}
 }}>
  <div className="native-canvas-compact-toolbar" hidden={present!==null}>
   <button aria-label="Fit all" title="Fit all · 0" onClick={()=>fit()}>⌖</button><button aria-label="Fit selection" disabled={!selection.size} onClick={()=>fit(selectedNodes)}>□</button>
   <button aria-label="Zoom out" onClick={()=>setCamera(value=>zoomBox(value,.8))}>−</button><button aria-label="Zoom in" onClick={()=>setCamera(value=>zoomBox(value,1.25))}>+</button>
   <button aria-label="Snap to grid" aria-pressed={grid} onClick={()=>setGrid(value=>!value)}>▦</button><button aria-label="Minimap" aria-pressed={minimap} onClick={()=>setMinimap(value=>!value)}>▧</button><button aria-label="Find on Canvas" aria-expanded={searchOpen} onClick={()=>setSearchOpen(value=>!value)}>⌕</button>
   <span className="native-canvas-toolbar-gap"/>
   <button aria-label="Create note" disabled={busy} onClick={()=>void run(()=>host.material(canvas.sceneId!,{type:'create-card',kind:'note',position:{x:(camera.x+camera.width/2)/CANVAS_UNITS,y:-(camera.y+camera.height/2)/CANVAS_UNITS}}))}>T</button>
   {frames.length>0&&<button aria-label="Present frames" onClick={()=>{presentationReturn.current={...camera};void frame.current?.requestFullscreen().then(()=>presentFrame(0)).catch(error=>{presentationReturn.current=null;setStatus(String(error));});}}>▷</button>}
   {onCheckpoint&&<button aria-label="Checkpoint through native owner" disabled={busy} onClick={()=>void run(onCheckpoint,'Native checkpoint acknowledged')}>↓</button>}
  </div>
  {searchOpen&&<div className="native-canvas-search"><input aria-label="Find Canvas content" autoFocus value={query} onChange={event=>{setQuery(event.target.value);setMatchIndex(0);}} onKeyDown={event=>{if(event.key==='Escape')setSearchOpen(false);if(event.key==='Enter'&&matches.length){event.preventDefault();jump(matches[matchIndex%matches.length]);setMatchIndex(index=>index+1);}}}/><button disabled={!matches.length} onClick={()=>{jump(matches[matchIndex%matches.length]);setMatchIndex(index=>index+1);}}>Next</button><span role="status">{query?`${matches.length} matches`:''}</span></div>}
  <div className="native-canvas-mini-stage">
   <svg ref={svg} className="native-canvas-construction" role="group" aria-label="Native Canvas construction" tabIndex={0} viewBox={`${camera.x} ${camera.y} ${camera.width} ${camera.height}`} onWheel={event=>{event.preventDefault();setCamera(value=>zoomBox(value,event.deltaY<0?1.1:1/1.1,point(event)));}} onPointerDown={event=>{if(event.target!==event.currentTarget)return;event.currentTarget.setPointerCapture(event.pointerId);gesture.current={id:'__pan__',start:point(event),positions:new Map(),basis:canvasBasis(host,canvas.sceneId!),camera};}} onPointerMove={event=>{
    const active=gesture.current;if(!active)return;const current=point(event),dx=current.x-active.start.x,dy=current.y-active.start.y;
    if(active.id==='__pan__'){const rect=svg.current!.getBoundingClientRect();active.screenStart??={x:event.clientX-event.movementX,y:event.clientY-event.movementY};setCamera({...active.camera,x:active.camera.x-(event.clientX-active.screenStart.x)*active.camera.width/rect.width,y:active.camera.y-(event.clientY-active.screenStart.y)*active.camera.height/rect.height});return;}
    const node=canvas.nodes.find(node=>node.id===active.id)!,origin=active.positions.get(active.id)!;
    const snapped=snapPosition(node,{x:origin.x+dx,y:origin.y+dy},canvas.nodes.filter(node=>!active.positions.has(node.id)),camera.width/svg.current!.clientWidth,grid),delta={x:snapped.position.x-origin.x,y:snapped.position.y-origin.y};
    setDraft(new Map([...active.positions].map(([id,start])=>[id,{x:start.x+delta.x,y:start.y+delta.y}])));setGuides(snapped.guides);
   }} onPointerUp={()=>void finish()} onPointerCancel={cancel}>
    {canvas.edges.map(edge=>{const from=withDraft.find(node=>node.id===edge.sourceNodeId),to=withDraft.find(node=>node.id===edge.targetNodeId);return from&&to?<line key={edge.id} x1={from.position.x+from.size.width/2} y1={from.position.y+from.size.height/2} x2={to.position.x+to.size.width/2} y2={to.position.y+to.size.height/2} className="native-canvas-edge" vectorEffect="non-scaling-stroke"/>:null;})}
    {frames.map(([id,value])=>{const members=withDraft.filter(node=>value.memberRefs.includes(canvas.occurrences.get(node.id)??''));if(!members.length)return null;const box=bounds(members);return <g key={id}><rect x={box.x-12} y={box.y-12} width={box.width+24} height={box.height+24} className="native-canvas-frame" vectorEffect="non-scaling-stroke"/>{value.label&&<text x={box.x} y={box.y-18} fontSize={12*camera.width/(svg.current?.clientWidth||500)} className="native-canvas-frame-title">{value.label}</text>}</g>;})}
    {withDraft.map(node=><g key={node.id} role="button" aria-label={node.title} aria-pressed={selection.has(node.id)} tabIndex={0} transform={`translate(${node.position.x} ${node.position.y})`} className={`native-canvas-node ${selection.has(node.id)?'is-selected':''} ${draft.has(node.id)?'is-draft':''}`} onFocus={()=>{if(!coordinates&&!draft.size)host.select(canvas.sceneId!,canvas.occurrences.get(node.id)??null);}} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();select(node.id,event.shiftKey);}}} onDoubleClick={()=>{const subject=host.nativeView()?.document.entities[node.id]?.subject?.subject_ref;if(subject)host.openSubject(subject);else host.editObject?.(canvas.sceneId!,canvas.occurrences.get(node.id)!);}} onPointerDown={event=>{event.stopPropagation();if(busy||coordinates)return;if((!selectionRef.current.has(node.id)||event.shiftKey)&&!select(node.id,event.shiftKey))return;if(scene.entities.find(entity=>entity.id===canvas.occurrences.get(node.id))?.locked){setStatus('This occurrence is locked.');return;}svg.current!.setPointerCapture(event.pointerId);gesture.current={id:node.id,start:point(event),positions:new Map(withDraft.filter(node=>selectionRef.current.has(node.id)).map(node=>[node.id,node.position])),basis:canvasBasis(host,canvas.sceneId!),camera};}}>
     <rect width={node.size.width} height={node.size.height} rx={node.type==='resource'?Math.min(node.size.width,node.size.height)/2:8} vectorEffect="non-scaling-stroke"/>
     {node.type==='image'&&'src' in node?<image href={String(node.src)} width={node.size.width} height={node.size.height} preserveAspectRatio="xMidYMid meet"/>:node.type==='resource'?<circle cx={node.size.width/2} cy={node.size.height/2} r={4} className="native-canvas-source-dot"/>:<text x={12} y={24} fontSize={14} className="native-canvas-note-title">{node.title.slice(0,35)}</text>}
    </g>)}
    {guides.map((guide,index)=><line key={index} x1={guide.axis==='x'?guide.value:guide.start} y1={guide.axis==='y'?guide.value:guide.start} x2={guide.axis==='x'?guide.value:guide.end} y2={guide.axis==='y'?guide.value:guide.end} className="native-canvas-snap-guide" vectorEffect="non-scaling-stroke"/>)}
   </svg>
   {minimap&&<CanvasMinimap nodes={withDraft} camera={camera} onJump={point=>setCamera(value=>({...value,x:point.x-value.width/2,y:point.y-value.height/2}))}/>}
  </div>
  <div className="native-canvas-selection-tools" hidden={present!==null}>
   {selectedNodes.length===1&&<><span className="native-canvas-selected-title">{selectedNodes[0].title}</span>{(['x','y'] as const).map(axis=><label key={axis}>{axis.toUpperCase()}<input aria-label={`Occurrence ${axis.toUpperCase()}`} type="number" step="0.025" value={coordinates?.id===selectedNodes[0].id&&coordinates[axis]!==undefined?coordinates[axis]!:String((axis==='x'?1:-1)*(draft.get(selectedNodes[0].id)??selectedNodes[0].position)[axis]/CANVAS_UNITS)} disabled={busy} onChange={event=>coordinate(selectedNodes[0],axis,event.target.value)} onKeyDown={event=>{if(event.key==='Enter')commitCoordinate(selectedNodes[0],axis,event.currentTarget.value);if(event.key==='Escape')cancel();}}/></label>)}
    {onInspectGraph&&host.nativeView()?.document.entities[selectedNodes[0].id]?.subject?.subject_ref&&<button onClick={()=>onInspectGraph(host.nativeView()!.document.entities[selectedNodes[0].id].subject!.subject_ref)}>Graph</button>}
    {host.pinEntity&&<button disabled={busy} aria-pressed={!!host.nativeView()?.document.entities[selectedNodes[0].id]?.pinned===true} onClick={()=>void run(()=>host.pinEntity!(canvas.sceneId!,selectedNodes[0].id,host.nativeView()?.document.entities[selectedNodes[0].id]?.pinned!==true))}>Pin</button>}
   </>}
   {selection.size>=2&&<button disabled={busy} onClick={()=>void run(()=>host.material(canvas.sceneId!,{type:'frame-save',id:crypto.randomUUID(),label:`Frame ${frames.length+1}`,memberRefs:[...selection].map(id=>canvas.occurrences.get(id)!)}))}>Frame</button>}
   {blueprint&&host.transformBlueprint&&<><button aria-label="Move blueprint whole left" disabled={busy} onClick={()=>transform({translation:[blueprint.transform.translation[0]-20,blueprint.transform.translation[1],blueprint.transform.translation[2]]})}>←</button><button aria-label="Move blueprint whole right" disabled={busy} onClick={()=>transform({translation:[blueprint.transform.translation[0]+20,blueprint.transform.translation[1],blueprint.transform.translation[2]]})}>→</button><button aria-label="Move blueprint whole up" disabled={busy} onClick={()=>transform({translation:[blueprint.transform.translation[0],blueprint.transform.translation[1]+20,blueprint.transform.translation[2]]})}>↑</button><button aria-label="Move blueprint whole down" disabled={busy} onClick={()=>transform({translation:[blueprint.transform.translation[0],blueprint.transform.translation[1]-20,blueprint.transform.translation[2]]})}>↓</button><button aria-label="Rotate blueprint whole counterclockwise" disabled={busy} onClick={()=>transform({rotation:[blueprint.transform.rotation[0],blueprint.transform.rotation[1],blueprint.transform.rotation[2]-Math.PI/12]})}>↶</button><button aria-label="Rotate blueprint whole clockwise" disabled={busy} onClick={()=>transform({rotation:[blueprint.transform.rotation[0],blueprint.transform.rotation[1],blueprint.transform.rotation[2]+Math.PI/12]})}>↷</button><button aria-label="Scale blueprint whole down" disabled={busy} onClick={()=>transform({scale:blueprint.transform.scale/1.1})}>− Whole</button><button aria-label="Scale blueprint whole up" disabled={busy} onClick={()=>transform({scale:blueprint.transform.scale*1.1})}>+ Whole</button></>}
   {draft.size>0&&!gesture.current&&<button onClick={cancel}>Discard retained draft</button>}
  </div>
  {status&&<output className="native-canvas-status" role="status">{status}</output>}
 </div>;
}

export function CanvasMinimap({nodes,camera,onJump}:{nodes:readonly InstrumentCanvas['nodes'][number][];camera:Box;onJump:(point:Point)=>void}){
 const all=bounds(nodes),extent=fitBox(bounds([{id:'content',position:{x:all.x,y:all.y},size:all},{id:'viewport',position:{x:camera.x,y:camera.y},size:camera}]),128,72,10);
 const navigate=(event:React.PointerEvent<SVGSVGElement>)=>{const rect=event.currentTarget.getBoundingClientRect();onJump({x:extent.x+(event.clientX-rect.left)*extent.width/rect.width,y:extent.y+(event.clientY-rect.top)*extent.height/rect.height});};
 return <svg className="native-canvas-minimap" viewBox={`${extent.x} ${extent.y} ${extent.width} ${extent.height}`} role="group" aria-label="Canvas minimap" onPointerDown={event=>{event.currentTarget.setPointerCapture(event.pointerId);navigate(event);}} onPointerMove={event=>{if(event.buttons===1)navigate(event);}}>{nodes.map(node=><rect key={node.id} x={node.position.x} y={node.position.y} width={node.size.width} height={node.size.height} className="native-canvas-minimap-node"/>)}<rect x={camera.x} y={camera.y} width={camera.width} height={camera.height} className="native-canvas-minimap-viewport" vectorEffect="non-scaling-stroke"/></svg>;
}
