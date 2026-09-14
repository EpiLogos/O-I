import {useEffect,useRef,useState,type PointerEvent,type KeyboardEvent} from "react";
import type {KnowledgeAddress,KnowledgeReading,KernelTransportStatus} from "../kernel/types";
import type {GraphNode,GraphEdge} from "./graph";
import {OwnerActions} from "./OwnerActions";
import {graphAddress} from "./graph";
import {constrainDetail,resizeDetail,type ResizeHandle,type DetailRect,type Extent} from "./detailGeometry";

export type OpenKnowledge=(address:KnowledgeAddress,title:string,project?:string,placement?:"tab"|"page"|"window",graphOrigin?:string)=>Promise<void>;

/** Render only owner fields we can recognise, keeping the complete body one
 * disclosure away. Unknown bodies remain exact text, never summarised by a model. */
export function ReadingBody({reading}:{reading:KnowledgeReading}) {
  let document:Record<string,unknown>|undefined;
  try{const parsed=JSON.parse(reading.content??"");if(parsed&&typeof parsed==="object"&&!Array.isArray(parsed))document=parsed;}catch{/* An ordinary text body needs no schema inference. */}
  if(!document)return <div className="knowledge-prose">{reading.content??"The owner returned no content body."}</div>;
  const paragraphs=[document.description,document.summary,document.content,document.body].filter((value):value is string=>typeof value==="string"&&value.length>0);
  return <>
    {paragraphs.map((text,i)=><div className="knowledge-prose" key={i}>{text}</div>)}
    {!paragraphs.length&&<p className="knowledge-muted">This owner record has no written description.</p>}
    {typeof document.revision==="number"&&<p className="knowledge-revision">Revision {document.revision}</p>}
    <details className="knowledge-raw"><summary>Full owner record</summary><pre>{reading.content}</pre></details>
  </>;
}
export function NodeDetails({node,reading,error,project,onClose,onPromote,onOpen,native,rect,extent,onGeometry,storageError,disclosures,related,onRelated,transport,onActionDispatched}:{disclosures:GraphNode[];related:{edge:GraphEdge;node?:GraphNode}[];onRelated:(node:GraphNode)=>void;node:GraphNode;reading?:KnowledgeReading;error?:string;project?:string;onClose:()=>void;onPromote:()=>void;onOpen:OpenKnowledge;native:boolean;rect:DetailRect;extent:Extent;onGeometry:(rect:DetailRect)=>void;storageError?:string;transport:KernelTransportStatus;onActionDispatched:()=>void}) {
  const close=useRef<HTMLButtonElement>(null);
  const gesture=useRef<{kind:"move"|ResizeHandle;x:number;y:number;rect:DetailRect}>();
  const [pending,setPending]=useState(false),[failure,setFailure]=useState<string>();
  useEffect(()=>{const previous=document.activeElement as HTMLElement|null;close.current?.focus({preventScroll:true});return()=>{if(previous?.isConnected)previous.focus({preventScroll:true});};},[]);
  const begin=(e:PointerEvent<HTMLButtonElement>,kind:"move"|ResizeHandle)=>{if(e.button!==0)return;e.preventDefault();e.currentTarget.focus({preventScroll:true});e.currentTarget.setPointerCapture(e.pointerId);gesture.current={kind,x:e.clientX,y:e.clientY,rect};};
  const move=(e:PointerEvent<HTMLButtonElement>)=>{const g=gesture.current;if(!g||!e.currentTarget.hasPointerCapture(e.pointerId))return;const dx=e.clientX-g.x,dy=e.clientY-g.y;onGeometry(g.kind==="move"?constrainDetail({...g.rect,x:g.rect.x+dx,y:g.rect.y+dy},extent):resizeDetail(g.rect,g.kind,dx,dy,extent));};
  const finish=(e:PointerEvent<HTMLButtonElement>)=>{gesture.current=undefined;if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);};
  const key=(e:KeyboardEvent<HTMLButtonElement>,kind:"move"|ResizeHandle)=>{const delta={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];if(!delta)return;e.preventDefault();e.stopPropagation();const step=e.shiftKey?32:8;onGeometry(kind==="move"?constrainDetail({...rect,x:rect.x+delta[0]*step,y:rect.y+delta[1]*step},extent):resizeDetail(rect,kind,delta[0]*step,delta[1]*step,extent));};
  const relatedSubjects=new Map<string,{node?:GraphNode;relations:string[]}>();
  for(const item of related){const ref=item.edge.from_ref===node.ref?item.edge.to_ref:item.edge.from_ref;const row=relatedSubjects.get(ref)??{node:item.node,relations:[]};if(!row.relations.includes(item.edge.relation))row.relations.push(item.edge.relation);relatedSubjects.set(ref,row);}
  const promote=async(placement:"page"|"window")=>{setPending(true);setFailure(undefined);try{await onOpen(graphAddress(node),node.label,project,placement);onPromote();}catch(e){setFailure(String(e));}finally{setPending(false);}};
  return <section className="knowledge-detail-dialog" role="dialog" aria-modal="false" aria-label={`Details: ${node.label}`} style={{left:rect.x,top:rect.y,width:rect.width,height:rect.height}} onKeyDown={e=>{if(e.key==="Escape"){e.preventDefault();e.stopPropagation();onClose();}}}>
    <header className="knowledge-detail-bar"><button className="knowledge-detail-move" aria-label="Move node details" title="Drag to move · arrow keys to adjust" onPointerDown={e=>begin(e,"move")} onPointerMove={move} onPointerUp={finish} onPointerCancel={finish} onLostPointerCapture={()=>{gesture.current=undefined;}} onKeyDown={e=>key(e,"move")}><span>{project??"Personal ground"} / {node.kind.replaceAll("-"," ")}</span><span aria-hidden="true">⠿</span></button><button ref={close} aria-label="Close node details" onClick={onClose}>×</button></header>
    <article className="knowledge-detail-body" aria-busy={!reading&&!error}>
      <span className="oi-point-cloud" aria-hidden="true"/>
      <h1>{node.label}</h1>
      <p className="knowledge-owner">{node.native_owner} · {node.kind.replaceAll("-"," ")}</p>
      {error?<p role="alert">{error}</p>:reading?<ReadingBody reading={reading}/>:<p role="status">Reading content…</p>}
      {failure&&<p role="alert">{failure}</p>}{storageError&&<p role="status">{storageError}</p>}
      <details className="knowledge-provenance"><summary>Provenance & identity</summary><dl><dt>Reference</dt><dd>{node.ref}</dd><dt>Source</dt><dd>{node.provenance.source}</dd>{node.provenance.revision&&<><dt>Revision</dt><dd>{node.provenance.revision}</dd></>}</dl>{node.provenance.detail?.map((text,i)=><p key={i}>{text}</p>)}</details>
      <details className="knowledge-related"><summary>Related subjects · {relatedSubjects.size}</summary><ul>{[...relatedSubjects].map(([ref,{node:other,relations}])=><li key={ref}>{other?<button onClick={()=>onRelated(other)}>{other.label}</button>:<span>{ref} · not in this reading</span>}<small>{relations.join(" · ")}</small></li>)}</ul>{!relatedSubjects.size&&<p>No relations disclosed for this subject.</p>}</details>
      <details className="knowledge-provenance"><summary>Owner disclosures · {disclosures.length}</summary>{disclosures.map((disclosure,i)=><section key={i}><p>{disclosure.native_owner} · {disclosure.kind} · {disclosure.label}</p><pre>{JSON.stringify(disclosure.provenance,null,2)}</pre><OwnerActions node={disclosure} transport={transport} project={project} onDispatched={onActionDispatched}/></section>)}</details>
    </article>
    <footer className="knowledge-detail-footer"><button disabled={pending||!reading} onClick={()=>void promote("page")}>Open in tab <span aria-hidden="true">↗</span></button><button disabled={pending||!reading||!native} title={native?"Open this same subject in a native window":"Native popout is available in the desktop app"} onClick={()=>void promote("window")}>Pop out <span aria-hidden="true">↗</span></button></footer>
    {(["nw","n","ne","e","se","s","sw","w"] as ResizeHandle[]).map(handle=><button key={handle} className={`knowledge-detail-edge knowledge-detail-edge-${handle}`} aria-label={`Resize node details ${handle}`} title="Drag to resize · arrow keys to adjust" onPointerDown={e=>begin(e,handle)} onPointerMove={move} onPointerUp={finish} onPointerCancel={finish} onLostPointerCapture={()=>{gesture.current=undefined;}} onKeyDown={e=>key(e,handle)}/>)}
  </section>;
}
