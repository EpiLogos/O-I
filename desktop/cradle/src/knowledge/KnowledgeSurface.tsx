import { useEffect, useRef, useState } from "react";
import { useKernel } from "../kernel/KernelProvider";
import type { KnowledgeAddress, KnowledgeReading, KnowledgeRelations } from "../kernel/types";
import type { SurfaceBinding } from "../surface/types";
import { knowledge } from "./client";
import { Loading } from "../shared/Loading";
import "./knowledge.css";

export function KnowledgeSurface({binding, onOpen}: {binding: SurfaceBinding; onOpen: (address: KnowledgeAddress, title: string, project?: string) => Promise<void>}) {
  const {transport} = useKernel();
  const [reading,setReading] = useState<KnowledgeReading>();
  const [relations,setRelations] = useState<KnowledgeRelations>();
  const [error,setError] = useState<string>();
  const [busy,setBusy] = useState(false);
  const [generation,setGeneration] = useState(0);
  const graph = useRef<HTMLDivElement>(null);
  const [extent,setExtent] = useState({width:800,height:520});
  const [camera,setCamera] = useState(() => {
    try {
      const value=JSON.parse(localStorage.getItem(`oi-cradle.knowledge-view.v1:${binding.id}`) ?? "null");
      if (value && [value.zoom,value.x,value.y].every(Number.isFinite) && value.zoom>=.4 && value.zoom<=2) return value as {zoom:number;x:number;y:number};
    } catch { /* An invalid presentation request cannot change the owner reading. */ }
    return {zoom:1,x:0,y:0};
  });
  const {zoom}=camera;
  const setZoom=(change:(zoom:number)=>number)=>setCamera(c=>({...c,zoom:change(c.zoom)}));
  useEffect(()=>{
    try { localStorage.setItem(`oi-cradle.knowledge-view.v1:${binding.id}`,JSON.stringify(camera)); }
    catch { setError("The graph camera could not be saved on this device."); }
  },[camera,binding.id]);
  useEffect(()=>{
    if(!graph.current) return;
    const observer=new ResizeObserver(entries=>{const {width,height}=entries[0].contentRect;if(width>0&&height>0)setExtent({width,height});});
    observer.observe(graph.current);return()=>observer.disconnect();
  },[!!relations]);
  useEffect(() => {
    let active = true;
    if (!binding.address) return;
    setBusy(true); setError(undefined);
    void Promise.all([knowledge<KnowledgeReading>(transport,binding.project,{action:"read",address:binding.address}), knowledge<KnowledgeRelations>(transport,binding.project,{action:"relations",address:binding.address})]).then(([read,rel])=>{if(active){setReading(read);setRelations(rel);}}).catch(e=>{if(active)setError(String(e));}).finally(()=>{if(active)setBusy(false);});
    return ()=>{active=false;};
  },[binding.ref,binding.project,generation,transport]);
  const nodes = relations?.nodes ?? [];
  // Coordinates are disposable view geometry. Every node and edge is an
  // unmodified owner disclosure; no inferred relations enter the field.
  const points = new Map(nodes.map((node,i)=>[node.resource, i===0 ? {x:400,y:260} : {x:400+235*Math.cos((i-1)*Math.PI*2/Math.max(nodes.length-1,1)),y:260+170*Math.sin((i-1)*Math.PI*2/Math.max(nodes.length-1,1))}]));
  const open = (ref: string, title: string) => { void onOpen({kind:"wiki",value:ref},title,binding.project).catch(e=>setError(String(e))); };
  return <section className="knowledge-surface" aria-label="Knowledge surface" aria-busy={busy}>
    <header className="knowledge-breadcrumb"><span>Central / {binding.project ?? "Personal ground"} / {binding.title}</span><button onClick={()=>setGeneration(n=>n+1)}>Refresh</button></header>
    {busy && <Loading label={reading ? "Refreshing the last observed reading…" : "Reading AIKit knowledge…"} scope="surface" />}
    {error && <p role="alert">{error}</p>}
    {binding.address?.kind === "wiki" && relations && <div className="knowledge-graph" ref={graph}>

      <svg viewBox={`${400-extent.width/2} ${260-extent.height/2} ${extent.width} ${extent.height}`} aria-label="Native wiki neighbourhood" tabIndex={0}
        onPointerDown={e=>{if(!(e.target as Element).closest('[role="button"]'))e.currentTarget.setPointerCapture(e.pointerId);}}
        onPointerMove={e=>{if(e.currentTarget.hasPointerCapture(e.pointerId))setCamera(c=>({...c,x:c.x+e.movementX,y:c.y+e.movementY}));}}
        onPointerUp={e=>{if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);}}
        onKeyDown={e=>{if(e.target!==e.currentTarget||e.altKey||e.metaKey||e.ctrlKey)return;const delta={ArrowLeft:[24,0],ArrowRight:[-24,0],ArrowUp:[0,24],ArrowDown:[0,-24]}[e.key];if(delta){e.preventDefault();setCamera(c=>({...c,x:c.x+delta[0],y:c.y+delta[1]}));}}}
        ><g data-graph-camera={`${camera.x},${camera.y},${zoom}`} transform={`translate(${400+camera.x} ${260+camera.y}) scale(${zoom}) translate(-400 -260)`}>
        {relations.edges.map((edge,i)=>{const a=points.get(edge.from),b=points.get(edge.to);return a&&b?<line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y}><title>{edge.relation}</title></line>:null;})}
        {nodes.map(node=>{const p=points.get(node.resource)!;return <g key={node.resource} role="button" tabIndex={0} aria-label={`Open ${node.label}`} data-knowledge-ref={node.resource} onClick={()=>open(node.resource,node.label)} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();open(node.resource,node.label);}}} transform={`translate(${p.x} ${p.y})`}><circle r={node.resource===binding.ref?7:4}/><text y="25" textAnchor="middle">{node.label}</text><text y="41" textAnchor="middle" className="kind">{node.kind}</text></g>;})}
      </g></svg>{relations.truncated && <span className="knowledge-scope">More relations available</span>}<div className="knowledge-zoom"><button aria-label="Zoom out" onClick={()=>setZoom(z=>Math.max(.4,z-.2))}>−</button><button aria-label="Reset graph zoom" onClick={()=>setCamera({zoom:1,x:0,y:0})}>{Math.round(zoom*100)}%</button><button aria-label="Zoom in" onClick={()=>setZoom(z=>Math.min(2,z+.2))}>+</button></div>
    </div>}
    {relations?.warnings.map(w=><p role="status" key={w}>{w}</p>)}
    {reading && binding.address?.kind !== "wiki" && <article className="knowledge-content"><pre>{reading.content}</pre></article>}
  </section>;
}
