import {useCallback,useEffect,useMemo,useRef,useState} from "react";
import {useKernel} from "../kernel/KernelProvider";
import type {KnowledgeReading} from "../kernel/types";
import type {SurfaceBinding} from "../surface/types";
import {knowledge} from "./client";
import {graphAddress,isHostedNode,readGraph,type GraphNode,type GraphReading} from "./graph";
import {sharedField,type SharedFieldReading} from "./shared-field";
import {freeGraphRegion,useDetailGeometry} from "./detailGeometry";
import {accommodate,unaccommodate} from "./camera";
import {GraphFilters} from "./GraphFilters";
import {filterGraph,restoreGraphFilters,restoreSavedGraphViews,type GraphFilters as GraphFilterState,type SavedGraphView} from "./filters";
import {GraphCanvas} from "./GraphCanvas";
import {useLayout} from "./useLayout";
import {NodeDetails,ReadingBody,type OpenKnowledge} from "./NodeDetails";
import {subjects,neighbourhood,releaseGraph} from "./focus";
import {useFrameSample} from "./useFrameSample";
import {KnowledgeExpression} from "./KnowledgeExpression";
import {Loading} from "../shared/Loading";
import "./knowledge.css";
import "./filters.css";
import {Glyph} from "../workspace/Glyph";

type Camera={zoom:number;x:number;y:number};
type Visit={query:string;selected?:string;camera:Camera;overviewCamera?:Camera;filters?:GraphFilterState};
type Travel={visits:Visit[];index:number;saved?:SavedGraphView[]};
const origin=():Camera=>({zoom:1,x:0,y:0});
function restore(id:string):Travel {
  try {
    const saved=JSON.parse(localStorage.getItem(`oi-cradle.knowledge-travel.v1:${id}`)??"null");
    if(saved&&Array.isArray(saved.visits)&&saved.visits.length>0&&saved.visits.length<=32&&Number.isInteger(saved.index)&&saved.index>=0&&saved.index<saved.visits.length&&saved.visits.every((v:Visit)=>typeof v.query==="string"&&(v.selected===undefined||typeof v.selected==="string")&&v.camera&&[v.camera.zoom,v.camera.x,v.camera.y].every(Number.isFinite)&&v.camera.zoom>=.15&&v.camera.zoom<=4&&(!v.overviewCamera||([v.overviewCamera.zoom,v.overviewCamera.x,v.overviewCamera.y].every(Number.isFinite)&&v.overviewCamera.zoom>=.15&&v.overviewCamera.zoom<=4))))return {...saved,saved:restoreSavedGraphViews(saved.saved)};
    const camera=JSON.parse(localStorage.getItem(`oi-cradle.knowledge-view.v1:${id}`)??"null");
    if(camera&&[camera.zoom,camera.x,camera.y].every(Number.isFinite)&&camera.zoom>=.15&&camera.zoom<=4)return {visits:[{query:"",camera}],index:0};
  }catch{/* Invalid view state never alters an owner reading. */}
  return {visits:[{query:"",camera:origin()}],index:0};
}
export function KnowledgeSurface({binding,onOpen}: {binding:SurfaceBinding;onOpen:OpenKnowledge}) {
  const {transport}=useKernel();
  const [travel,setTravel]=useState(()=>restore(binding.id));
  const visit=travel.visits[travel.index];
  const {camera}=visit;
  const filters=useMemo(()=>restoreGraphFilters(visit.filters),[visit.filters]);
  const [detailNode,setDetailNode]=useState<GraphNode>();
  const [reading,setReading]=useState<KnowledgeReading>();
  // A hosted node (Shared Field) reads through the kernel's shared_field op
  // as a Projection reading — no local address, no second store.
  const [hosted,setHosted]=useState<SharedFieldReading>();
  const [model,setModel]=useState<GraphReading>();
  const [error,setError]=useState<string>();
  const [readError,setReadError]=useState<string>();
  const [busy,setBusy]=useState(false);
  const [generation,setGeneration]=useState(0);
  const [pins,setPins]=useState<string[]>([]);const [follow,setFollow]=useState(true);
  const graph=useRef<HTMLDivElement>(null),content=useRef<HTMLElement>(null);
  useFrameSample(graph);
  const focusContent=useRef(false);
  const [extent,setExtent]=useState({width:800,height:520});
  const detailGeometry=useDetailGeometry(binding.id,extent);
  const isGraph=binding.address?.kind==="wiki"&&binding.view?.knowledgePlane!=="page";
  const grouped=useMemo(()=>subjects(model),[model]);
  const nodes=useMemo(()=>grouped.map(s=>s.node),[grouped]);
  const visibleModel=useMemo(()=>model?{...model,nodes}:undefined,[model,nodes]);
  const filtered=useMemo(()=>visibleModel?filterGraph(visibleModel,filters,visit.selected):undefined,[visibleModel,filters,visit.selected]);
  const displayedModel=useMemo(()=>visibleModel&&filtered?{...visibleModel,nodes:filtered.nodes,edges:filtered.edges}:undefined,[visibleModel,filtered]);
  const focused=useMemo(()=>neighbourhood(displayedModel,visit.selected),[displayedModel,visit.selected]);
  // Exact-ref grouping is visual only; all owner rows remain in detail disclosures.
  // Missing endpoints remain explicit in each subject’s related list.
  const layout=useLayout(visibleModel);
  const positions=layout.points;
  const displayedPositions=useMemo(()=>{const byRef=new Map(nodes.map((node,i)=>[node.ref,positions[i]]));return filtered?.nodes.map(node=>byRef.get(node.ref)!)??[];},[nodes,positions,filtered]);
  const changeFilters=(value:GraphFilterState)=>setTravel(t=>({...t,visits:t.visits.map((v,i)=>i===t.index?{...v,filters:restoreGraphFilters(value)}:v)}));
  const saveViews=(saved:SavedGraphView[])=>setTravel(t=>({...t,saved:restoreSavedGraphViews(saved)}));
  const region=detailNode?freeGraphRegion(detailGeometry.rect,extent):visit.selected?{x:0,y:0,...extent}:undefined;
  const anchor=positions[nodes.findIndex(node=>node.ref===visit.selected)]??{x:400,y:260};
  const presentation=region?accommodate(camera,anchor,region,extent):camera;
  const setCamera=(change:(camera:Camera)=>Camera)=>setTravel(t=>({...t,visits:t.visits.map((v,i)=>i===t.index?{...v,camera:change(v.camera)}:v)}));
  const push=(next:Visit)=>setTravel(t=>{const visits=[...t.visits.slice(0,t.index+1),next].slice(-32);return {...t,visits,index:visits.length-1};});
  const back=(delta:number)=>{setDetailNode(undefined);focusContent.current=true;setTravel(t=>({...t,index:Math.max(0,Math.min(t.visits.length-1,t.index+delta))}));};
  useEffect(()=>{const release=(event:Event)=>{if(event instanceof StorageEvent?event.key!==`oi-cradle.knowledge-travel.v1:${binding.id}`:(event as CustomEvent).detail!==binding.id)return;setDetailNode(undefined);setTravel(restore(binding.id));};window.addEventListener("oi:graph-release",release);window.addEventListener("storage",release);return()=>{window.removeEventListener("oi:graph-release",release);window.removeEventListener("storage",release);};},[binding.id]);
  const latestTravel=useRef(travel);latestTravel.current=travel;
  const persist=useCallback(()=>{try{const current=latestTravel.current;localStorage.setItem(`oi-cradle.knowledge-travel.v1:${binding.id}`,JSON.stringify(current));localStorage.setItem(`oi-cradle.knowledge-view.v1:${binding.id}`,JSON.stringify(current.visits[current.index].camera));}catch{setError("Graph view state could not be saved on this device.");}},[binding.id]);
  useEffect(()=>{const timer=setTimeout(persist,200);return()=>clearTimeout(timer);},[travel,persist]);
  useEffect(()=>()=>persist(),[persist]);

  useEffect(()=>{if(!graph.current)return;const observer=new ResizeObserver(entries=>{const {width,height}=entries[0].contentRect;if(width>0&&height>0)setExtent({width,height});});observer.observe(graph.current);return()=>observer.disconnect();},[isGraph]);
  useEffect(()=>{
    if(!isGraph)return;
    let active=true;setBusy(true);setError(undefined);
    void readGraph(transport,binding.project,visit.query).then(r=>{if(active)setModel(r);}).catch(e=>{if(active)setError(String(e));}).finally(()=>{if(active)setBusy(false);});
    return()=>{active=false;};
  },[isGraph,binding.project,visit.query,generation,transport]);
  useEffect(()=>{
    let active=true;setReading(undefined);setHosted(undefined);setReadError(undefined);
    try {
      const node=detailNode??nodes.find(n=>n.ref===visit.selected);
      if(visit.selected&&!node)return;
      if(node&&isHostedNode(node)){
        void sharedField<SharedFieldReading>(transport,{kind:"read",ref:node.ref}).then(r=>{if(active)setHosted(r);}).catch(e=>{if(active)setReadError(String(e));});
        return()=>{active=false;};
      }
      const address=node?graphAddress(node):binding.address;
      if(!address)return;
      void knowledge<KnowledgeReading>(transport,binding.project,{action:"read",address}).then(r=>{if(active)setReading(r);}).catch(e=>{if(active)setReadError(String(e));});
    }catch(e){setReadError(String(e));}
    return()=>{active=false;};
  },[model,detailNode,visit.selected,travel.index,binding.ref,binding.project,generation,transport]);
  useEffect(()=>{if(focusContent.current&&(reading||readError)){focusContent.current=false;content.current?.focus({preventScroll:true});}},[reading,readError]);
  const open=useCallback((node:GraphNode)=>{setDetailNode(node);setTravel(t=>{const visits=[...t.visits.slice(0,t.index+1),{...t.visits[t.index],selected:node.ref,overviewCamera:t.visits[t.index].overviewCamera??t.visits[t.index].camera,camera:{...t.visits[t.index].camera,zoom:Math.max(.75,t.visits[t.index].camera.zoom),x:0,y:0}}].slice(-32);return {...t,visits,index:visits.length-1};});},[]);
  const release=()=>{if(!visit.selected&&!detailNode)return;setDetailNode(undefined);push({...visit,selected:undefined,camera:visit.overviewCamera??visit.camera,overviewCamera:undefined});};
  const related=detailNode?model?.edges.filter(e=>e.from_ref===detailNode.ref||e.to_ref===detailNode.ref)??[]:[];
  const commitCamera=(next:{zoom:number;x:number;y:number})=>{const camera=region?unaccommodate(next,anchor,region,extent):next;const current=latestTravel.current;const updated={...current,visits:current.visits.map((v,i)=>i===current.index?{...v,camera}:v)};latestTravel.current=updated;setTravel(updated);persist();};

  const fitView=()=>{
    if(!displayedPositions.length)return;
    let left=Infinity,right=-Infinity,top=Infinity,bottom=-Infinity;
    for(const point of displayedPositions){left=Math.min(left,point.x);right=Math.max(right,point.x);top=Math.min(top,point.y);bottom=Math.max(bottom,point.y);}
    const zoom=Math.max(.15,Math.min(2,(extent.width-96)/Math.max(1,right-left),(extent.height-96)/Math.max(1,bottom-top)));
    const fitted={zoom,x:(400-(left+right)/2)*zoom,y:(260-(top+bottom)/2)*zoom};
    setDetailNode(undefined);
    setCamera(()=>visit.selected?unaccommodate(fitted,anchor,{x:0,y:0,...extent},extent):fitted);
  };
  return <section className="knowledge-surface" aria-label="Knowledge surface" aria-busy={busy}>
    {busy&&<Loading label="Reading graph inputs…" scope="inline"/>}{error&&<p role="alert">{error}</p>}{layout.error&&<p role="alert">{layout.error}</p>}
    {isGraph&&<div className="knowledge-graph" ref={graph} data-focused={Boolean(visit.selected)} data-detail-open={Boolean(detailNode)} data-dense={nodes.length>80}>
      <GraphCanvas nodes={filtered?.nodes??nodes} positions={displayedPositions} model={displayedModel} camera={presentation} selected={visit.selected} focused={focused} contextual={filtered?.contextual} labels={filters.labels} arrows={filters.arrows} minZoom={.15} maxZoom={4} onCamera={commitCamera} onOpen={open} onClear={release}/>
      {visibleModel&&filtered&&<GraphFilters reading={visibleModel} result={filtered} filters={filters} selected={visit.selected} onChange={changeFilters} saved={travel.saved??[]} onSave={saveViews}/>}
      {filtered?.nodes.length===0&&<p className="knowledge-graph-empty" role="status">{filtered.localFocusMissing?"Select a subject before using the local view.":"No subjects match these filters."}</p>}
      <div className="knowledge-zoom" role="group" aria-label="Graph view"><button className="oi-tool" aria-label="Zoom out" onClick={()=>setCamera(c=>({...c,zoom:Math.max(.15,c.zoom/1.2)}))}><Glyph name="minus" size={13}/></button><span aria-label="Graph zoom">{Math.round(camera.zoom*100)}%</span><button className="oi-tool" aria-label="Zoom in" onClick={()=>setCamera(c=>({...c,zoom:Math.min(4,c.zoom*1.2)}))}><Glyph name="plus" size={13}/></button><button className="oi-tool" aria-label="Fit graph to view" title="Fit graph to view" onClick={fitView}><Glyph name="expand" size={13}/></button><span className="knowledge-control-hint">Pinch to zoom · two fingers to pan</span></div>
      {model&&visit.selected&&nodes.find(node=>node.ref===visit.selected)&&<div className="knowledge-expression-bar" style={detailNode&&region?{left:region.x+8,top:region.y+8,right:extent.width-region.x-region.width+8,bottom:extent.height-region.y-region.height+8}:undefined}><div className="knowledge-expression-selection oi-action-group"><button className="oi-action" aria-pressed={pins.includes(visit.selected)} onClick={()=>setPins(current=>current.includes(visit.selected!)?current.filter(ref=>ref!==visit.selected):[...current,visit.selected!])}>{pins.includes(visit.selected)?"Unpin subject":"Pin subject"}</button><button className="oi-action" aria-pressed={follow} onClick={()=>setFollow(value=>!value)}>{follow?"Following locus":"Follow locus"}</button></div><KnowledgeExpression surface={binding.id} project={binding.project} address={graphAddress(nodes.find(node=>node.ref===visit.selected)!)} locus={nodes.find(node=>node.ref===visit.selected)!} pins={pins.flatMap(ref=>nodes.find(node=>node.ref===ref)??[])} follow={follow}/></div>}
      {detailNode&&<NodeDetails node={detailNode} reading={reading?.resource===detailNode.ref?reading:undefined} hosted={hosted&&isHostedNode(detailNode)&&(hosted.state==="unavailable"||hosted.ref===detailNode.ref)?hosted:undefined} error={readError} project={binding.project} onClose={release} onPromote={()=>setDetailNode(undefined)} onOpen={(address,title,project,placement)=>onOpen(address,title,project,placement,binding.id)} disclosures={grouped.find(s=>s.node.ref===detailNode.ref)?.disclosures??[detailNode]} related={related.map(edge=>({edge,node:nodes.find(n=>n.ref===(edge.from_ref===detailNode.ref?edge.to_ref:edge.from_ref))}))} onRelated={open} native={transport.kind==="tauri"} rect={detailGeometry.rect} extent={extent} onGeometry={detailGeometry.change} storageError={detailGeometry.storageError} transport={transport} onActionDispatched={()=>setGeneration(n=>n+1)}/>}
    </div>}
    {model&&<div className="knowledge-inputs">{Object.values(model.inputs).filter(input=>input.state!=="available").map((input,i)=><details key={i} open={input.state==="unavailable"}><summary>{input.owner_operation==="shared-field.projection"?"Shared Field":input.owner_operation} · {input.state}</summary><p role="status">{input.owner_operation} — {input.detail}</p></details>)}</div>}
    {!isGraph&&<article className="knowledge-content" ref={content} tabIndex={-1} aria-label="Selected node content"><div className="knowledge-page-heading"><h1>{binding.title}</h1>{binding.address&&reading&&<KnowledgeExpression surface={binding.id} project={binding.project} address={binding.address} locus={{ref:reading.resource,label:binding.title,kind:"knowledge-subject",native_owner:reading.provider,provenance:{source:reading.authority,revision:reading.revision},actions:[]}} pins={[]} follow={false}/>} {binding.address?.kind==="wiki"&&<button className="oi-action" onClick={()=>void onOpen(binding.address!,binding.title,binding.project,"tab").catch(e=>setReadError(String(e)))}>Show in graph ↗</button>}</div>{readError?<p role="alert">{readError}</p>:reading?<ReadingBody reading={reading}/>:<p role="status">Reading content…</p>}</article>}
    <footer className="knowledge-surface-footer">
      {isGraph&&<nav aria-label="Graph travel"><button className="oi-tool" aria-label="Back to prior constellation" disabled={travel.index===0} onClick={()=>back(-1)}><Glyph name="back" size={13}/></button><button className="oi-tool" aria-label="Forward to next constellation" disabled={travel.index===travel.visits.length-1} onClick={()=>back(1)}><Glyph name="arrow" size={13}/></button></nav>}
      <span className="knowledge-footer-path" title={`${binding.project??"Personal ground"} / ${binding.title}`}>{binding.project??"Personal ground"} / {binding.title}</span>
      {!isGraph&&binding.view?.graphOrigin&&<button className="oi-tool" aria-label="Release graph focus" title="Release graph focus" onClick={()=>{try{releaseGraph(binding.view!.graphOrigin!);}catch(e){setReadError(String(e));}}}><Glyph name="release" size={13}/></button>}
      <button className="oi-tool" aria-label="Refresh knowledge" title="Refresh" onClick={()=>setGeneration(n=>n+1)}><Glyph name="refresh" size={13}/></button>
    </footer>
  </section>;
}
