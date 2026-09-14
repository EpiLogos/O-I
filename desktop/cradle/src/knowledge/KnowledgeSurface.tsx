import {useCallback,useEffect,useMemo,useRef,useState} from "react";
import {useKernel} from "../kernel/KernelProvider";
import type {KnowledgeReading} from "../kernel/types";
import type {SurfaceBinding} from "../surface/types";
import {knowledge} from "./client";
import {graphAddress,readGraph,type GraphNode,type GraphReading} from "./graph";
import {freeGraphRegion,useDetailGeometry} from "./detailGeometry";
import {accommodate,unaccommodate} from "./camera";
import {GraphCanvas} from "./GraphCanvas";
import {useLayout} from "./useLayout";
import {NodeDetails,ReadingBody,type OpenKnowledge} from "./NodeDetails";
import {subjects,neighbourhood,releaseGraph} from "./focus";
import {useFrameSample} from "./useFrameSample";
import {Loading} from "../shared/Loading";
import "./knowledge.css";

type Camera={zoom:number;x:number;y:number};
type Visit={query:string;selected?:string;camera:Camera;overviewCamera?:Camera};
type Travel={visits:Visit[];index:number};
const origin=():Camera=>({zoom:1,x:0,y:0});
function restore(id:string):Travel {
  try {
    const saved=JSON.parse(localStorage.getItem(`oi-cradle.knowledge-travel.v1:${id}`)??"null");
    if(saved&&Array.isArray(saved.visits)&&saved.visits.length>0&&saved.visits.length<=32&&Number.isInteger(saved.index)&&saved.index>=0&&saved.index<saved.visits.length&&saved.visits.every((v:Visit)=>typeof v.query==="string"&&(v.selected===undefined||typeof v.selected==="string")&&v.camera&&[v.camera.zoom,v.camera.x,v.camera.y].every(Number.isFinite)&&v.camera.zoom>=.15&&v.camera.zoom<=4&&(!v.overviewCamera||([v.overviewCamera.zoom,v.overviewCamera.x,v.overviewCamera.y].every(Number.isFinite)&&v.overviewCamera.zoom>=.15&&v.overviewCamera.zoom<=4))))return saved;
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
  const [detailNode,setDetailNode]=useState<GraphNode>();
  const [reading,setReading]=useState<KnowledgeReading>();
  const [model,setModel]=useState<GraphReading>();
  const [error,setError]=useState<string>();
  const [readError,setReadError]=useState<string>();
  const [busy,setBusy]=useState(false);
  const [generation,setGeneration]=useState(0);
  const graph=useRef<HTMLDivElement>(null),content=useRef<HTMLElement>(null);
  useFrameSample(graph);
  const focusContent=useRef(false);
  const [extent,setExtent]=useState({width:800,height:520});
  const detailGeometry=useDetailGeometry(binding.id,extent);
  const isGraph=binding.address?.kind==="wiki"&&binding.view?.knowledgePlane!=="page";
  const grouped=useMemo(()=>subjects(model),[model]);
  const nodes=useMemo(()=>grouped.map(s=>s.node),[grouped]);
  const visibleModel=useMemo(()=>model?{...model,nodes}:undefined,[model,nodes]);
  const focused=useMemo(()=>neighbourhood(model,visit.selected),[model,visit.selected]);
  // Exact-ref grouping is visual only; all owner rows remain in detail disclosures.
  // Missing endpoints remain explicit in each subject’s related list.
  const layout=useLayout(visibleModel);
  const positions=layout.points;
  const region=detailNode?freeGraphRegion(detailGeometry.rect,extent):visit.selected?{x:0,y:0,...extent}:undefined;
  const anchor=positions[nodes.findIndex(node=>node.ref===visit.selected)]??{x:400,y:260};
  const presentation=region?accommodate(camera,anchor,region,extent):camera;
  const setCamera=(change:(camera:Camera)=>Camera)=>setTravel(t=>({...t,visits:t.visits.map((v,i)=>i===t.index?{...v,camera:change(v.camera)}:v)}));
  const push=(next:Visit)=>setTravel(t=>{const visits=[...t.visits.slice(0,t.index+1),next].slice(-32);return {visits,index:visits.length-1};});
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
    let active=true;setReading(undefined);setReadError(undefined);
    try {
      const node=detailNode??nodes.find(n=>n.ref===visit.selected);
      if(visit.selected&&!node)return;
      const address=node?graphAddress(node):binding.address;
      if(!address)return;
      void knowledge<KnowledgeReading>(transport,binding.project,{action:"read",address}).then(r=>{if(active)setReading(r);}).catch(e=>{if(active)setReadError(String(e));});
    }catch(e){setReadError(String(e));}
    return()=>{active=false;};
  },[model,detailNode,visit.selected,travel.index,binding.ref,binding.project,generation,transport]);
  useEffect(()=>{if(focusContent.current&&(reading||readError)){focusContent.current=false;content.current?.focus({preventScroll:true});}},[reading,readError]);
  const open=useCallback((node:GraphNode)=>{setDetailNode(node);setTravel(t=>{const visits=[...t.visits.slice(0,t.index+1),{...t.visits[t.index],selected:node.ref,overviewCamera:t.visits[t.index].overviewCamera??t.visits[t.index].camera,camera:{...t.visits[t.index].camera,zoom:Math.max(.75,t.visits[t.index].camera.zoom),x:0,y:0}}].slice(-32);return {visits,index:visits.length-1};});},[]);
  const release=()=>{if(!visit.selected&&!detailNode)return;setDetailNode(undefined);push({...visit,selected:undefined,camera:visit.overviewCamera??visit.camera,overviewCamera:undefined});};
  const related=detailNode?model?.edges.filter(e=>e.from_ref===detailNode.ref||e.to_ref===detailNode.ref)??[]:[];
  const commitCamera=(next:{zoom:number;x:number;y:number})=>{const camera=region?unaccommodate(next,anchor,region,extent):next;const current=latestTravel.current;const updated={...current,visits:current.visits.map((v,i)=>i===current.index?{...v,camera}:v)};latestTravel.current=updated;setTravel(updated);persist();};

  const fitView=()=>{if(!positions.length)return;const left=Math.min(...positions.map(p=>p.x)),right=Math.max(...positions.map(p=>p.x)),top=Math.min(...positions.map(p=>p.y)),bottom=Math.max(...positions.map(p=>p.y));const zoom=Math.max(.15,Math.min(2,(extent.width-96)/Math.max(1,right-left),(extent.height-96)/Math.max(1,bottom-top)));setDetailNode(undefined);push({...visit,selected:undefined,overviewCamera:undefined,camera:{zoom,x:(400-(left+right)/2)*zoom,y:(260-(top+bottom)/2)*zoom}});};
  return <section className="knowledge-surface" aria-label="Knowledge surface" aria-busy={busy}>
    {busy&&<Loading label="Reading graph inputs…" scope="inline"/>}{error&&<p role="alert">{error}</p>}{layout.error&&<p role="alert">{layout.error}</p>}
    {isGraph&&<div className="knowledge-graph" ref={graph} data-focused={Boolean(visit.selected)} data-detail-open={Boolean(detailNode)} data-dense={nodes.length>80}>
      <GraphCanvas nodes={nodes} positions={positions} model={model} camera={presentation} selected={visit.selected} focused={focused} minZoom={.15} maxZoom={4} onCamera={commitCamera} onOpen={open} onClear={release}/>
      <div className="knowledge-zoom"><button aria-label="Zoom out" onClick={()=>setCamera(c=>({...c,zoom:Math.max(.15,c.zoom/1.2)}))}>−</button><span aria-label="Graph zoom">{Math.round(camera.zoom*100)}%</span><button aria-label="Zoom in" onClick={()=>setCamera(c=>({...c,zoom:Math.min(4,c.zoom*1.2)}))}>+</button><button aria-label="Fit graph to view" title="Fit graph to view" onClick={fitView}>⤢</button><span className="knowledge-control-hint">Pinch to zoom · two fingers to pan</span></div>
      {detailNode&&<NodeDetails node={detailNode} reading={reading?.resource===detailNode.ref?reading:undefined} error={readError} project={binding.project} onClose={release} onPromote={()=>setDetailNode(undefined)} onOpen={(address,title,project,placement)=>onOpen(address,title,project,placement,binding.id)} disclosures={grouped.find(s=>s.node.ref===detailNode.ref)?.disclosures??[detailNode]} related={related.map(edge=>({edge,node:nodes.find(n=>n.ref===(edge.from_ref===detailNode.ref?edge.to_ref:edge.from_ref))}))} onRelated={open} native={transport.kind==="tauri"} rect={detailGeometry.rect} extent={extent} onGeometry={detailGeometry.change} storageError={detailGeometry.storageError} transport={transport} onActionDispatched={()=>setGeneration(n=>n+1)}/>}
    </div>}
    {model&&<div className="knowledge-inputs">{Object.values(model.inputs).filter(input=>input.state!=="available").map((input,i)=><details key={i} open={input.state==="unavailable"}><summary>{input.owner_operation==="shared-field.projection"?"Shared Field":input.owner_operation} · {input.state}</summary><p role="status">{input.owner_operation} — {input.detail}</p></details>)}</div>}
    {!isGraph&&<article className="knowledge-content" ref={content} tabIndex={-1} aria-label="Selected node content"><div className="knowledge-page-heading"><span className="oi-point-cloud" aria-hidden="true"/><h1>{binding.title}</h1>{binding.address?.kind==="wiki"&&<button onClick={()=>void onOpen(binding.address!,binding.title,binding.project,"tab").catch(e=>setReadError(String(e)))}>Show in graph ↗</button>}</div>{readError?<p role="alert">{readError}</p>:reading?<ReadingBody reading={reading}/>:<p role="status">Reading content…</p>}</article>}
    <footer className="knowledge-surface-footer">
      {isGraph&&<nav aria-label="Graph travel"><button aria-label="Back to prior constellation" disabled={travel.index===0} onClick={()=>back(-1)}>←</button><button aria-label="Forward to next constellation" disabled={travel.index===travel.visits.length-1} onClick={()=>back(1)}>→</button></nav>}
      <span className="knowledge-footer-path" title={`${binding.project??"Personal ground"} / ${binding.title}`}>{binding.project??"Personal ground"} / {binding.title}</span>
      {!isGraph&&binding.view?.graphOrigin&&<button aria-label="Release graph focus" title="Release graph focus" onClick={()=>{try{releaseGraph(binding.view!.graphOrigin!);}catch(e){setReadError(String(e));}}}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5M9 12h6m-3-3v6"/></svg></button>}
      <button aria-label="Refresh knowledge" title="Refresh" onClick={()=>setGeneration(n=>n+1)}>↻</button>
    </footer>
  </section>;
}
