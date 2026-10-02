import {WikiFactsButton} from './WikiFactsEditor';
import {useEffect,useRef,useState,type PointerEvent,type KeyboardEvent} from "react";
import type {KnowledgeAddress,KnowledgeReading,KernelTransportStatus} from "../kernel/types";
import type {GraphNode,GraphEdge} from "./graph";
import {WikiReader} from "./WikiReader";
import type {ComponentProps} from "react";
import {OwnerActions} from "./OwnerActions";
import {graphAddress,isHostedNode} from "./graph";
import type {SharedFieldReading} from "./shared-field";
import {constrainDetail,resizeDetail,type ResizeHandle,type DetailRect,type Extent} from "./detailGeometry";
// @ts-ignore -- one renderer-neutral presentation policy, owned by SharedField.
import {entryLabel,isInternalReference,subjectLabel,subjectKind,relationLabel} from "../../../../shared-field/presentation-text.mjs";

export type OpenKnowledge=(address:KnowledgeAddress,title:string,project?:string,placement?:"tab"|"page"|"window",graphOrigin?:string)=>Promise<void>;

/** Render recognised written content. Transport records are not document footers. */
export function ReadingBody({reading,...options}:ComponentProps<typeof WikiReader>) {
  const [visibleItems,setVisibleItems]=useState(50);
  useEffect(()=>setVisibleItems(50),[reading.resource,reading.revision,reading.content]);
  if(reading.document)return <WikiReader reading={reading} {...options}/>;
  let value:unknown,structured=false;
  try{value=JSON.parse(reading.content??"");structured=true;}catch{/* Authored prose and code remain verbatim. */}
  const exact=<details className="knowledge-provenance oi-disclosure"><summary>Inspect exact owner reading</summary><dl className="oi-kv"><dt>Source</dt><dd>{reading.resource}</dd><dt>Revision</dt><dd>{reading.revision??"Not supplied"}</dd></dl><pre>{reading.content}</pre></details>;
  if(!structured)return isInternalReference(reading.content)?<><p className="knowledge-muted">This source contains a reference without a written description.</p>{exact}</>:<div className="knowledge-prose">{reading.content||"The owner returned no content body."}</div>;
  if(value===null||typeof value!=="object")return <><div className="knowledge-prose">{typeof value==="string"?isInternalReference(value)?"This source contains a reference without a written description.":value: value===null?"This source has no value.":`This source contains the value ${String(value)}.`}</div>{exact}</>;
  const written=(record:Record<string,unknown>)=>[record.description,record.summary,record.content,record.body].filter((text):text is string=>typeof text==="string"&&text.trim().length>0&&!isInternalReference(text));
  const items=Array.isArray(value)?value:null;
  const paragraphs=items?[]:written(value as Record<string,unknown>);
  return <>
    {paragraphs.map((text,i)=><div className="knowledge-prose" key={i}>{text}</div>)}
    {items&&<><p className="knowledge-muted">{items.length===1?"1 item":`${items.length} items`} in this source{items.length>visibleItems?` · showing ${visibleItems}`:""}.</p><ol className="knowledge-reading-items">{items.slice(0,visibleItems).map((item,index)=>{
      const record=item&&typeof item==="object"&&!Array.isArray(item)?item as Record<string,unknown>:undefined;
      const text=record?written(record):typeof item==="string"&&!isInternalReference(item)?[item]:typeof item==="number"||typeof item==="boolean"?[String(item)]:Array.isArray(item)?[`Nested collection · ${item.length} items.`]:[];
      return <li key={index}><strong>{subjectLabel(record,`Unnamed item ${index+1}`)}</strong>{text.length?text.map((paragraph,i)=><p className="knowledge-prose" key={i}>{paragraph}</p>):<p className="knowledge-muted">No description is available for this item.</p>}</li>;
    })}</ol>{items.length>visibleItems&&<button type="button" className="oi-action" onClick={()=>setVisibleItems(count=>count+50)}>Show more items</button>}</>}
    {!items&&!paragraphs.length&&<p className="knowledge-muted">This owner record has no written description.</p>}
    {exact}
  </>;
}
/** A hosted ref's Projection reading, as the Shared Field client read it:
 * the Explore entry, every Projection of the entry or its world (ref,
 * projection revision, source revision), the relations that touch it and
 * the bounded neighbourhood — presented, never re-indexed. */
export function HostedReadingBody({reading}:{reading:SharedFieldReading}) {
  if(reading.state==="unavailable")return <div data-hosted-state="unavailable"><p role="status">This shared reading is unavailable. Refresh to try again.</p><details className="oi-disclosure"><summary>Inspect reading failure</summary><p>{reading.owner_operation} — {reading.detail}</p></details></div>;
  if(reading.state==="absent")return <div data-hosted-state="absent"><p role="status">This subject is absent from the available shared field.</p><details className="oi-disclosure"><summary>Inspect source location</summary><p>{reading.target.uri}/{reading.target.database}</p></details></div>;
  const {entry,projections,relations}=reading;
  return <div data-hosted-state="hosted" data-hosted-ref={entry.ref}>
    {entry.summary&&!isInternalReference(entry.summary)?<div className="knowledge-prose">{entry.summary}</div>:<p className="knowledge-muted">No description is available for this shared subject.</p>}
    <p className="knowledge-muted">{projections.some(p=>p.state==="published")?"A shared presentation is available.":projections.length?"The shared presentation has been withdrawn.":"No shared presentation is published for this subject."}</p>
    <details className="knowledge-provenance oi-disclosure"><summary>Inspect shared source and publication</summary><dl className="oi-kv"><dt>Subject</dt><dd>{entry.ref}</dd><dt>World</dt><dd>{entry.world_ref}</dd><dt>Revision</dt><dd>{entry.revision??"Not supplied"}</dd><dt>Hosted at</dt><dd>{reading.target.uri}/{reading.target.database}</dd></dl><ul>{projections.map(p=><li key={`${p.projection_ref}@${p.projection_revision}`} data-projection-ref={p.projection_ref} data-projection-revision={p.projection_revision} data-source-revision={p.source.revision}><code>{p.projection_ref}</code> · projection revision {p.projection_revision} · source revision <code>{p.source.revision}</code> · {p.state} · published by {p.publisher_participant_ref}</li>)}</ul>{!projections.length&&<p>No Projection names this entry or its world.</p>}</details>
    <details className="knowledge-related oi-disclosure"><summary>Inspect exact relation references · {relations.length}</summary><ul>{relations.map((r,i)=><li key={i}><span>{r.from===entry.ref?r.to:r.from}</span><small>{r.relation} · {r.origin}</small></li>)}</ul></details>
  </div>;
}
export function NodeDetails({node,reading,hosted,error,project,onClose,onPromote,onOpen,onTechne,technePending,techneFailure,native,rect,extent,onGeometry,storageError,disclosures,related,onRelated,transport,onActionDispatched,readingProps}:{readingProps?:Omit<ComponentProps<typeof WikiReader>,"reading">;disclosures:GraphNode[];related:{edge:GraphEdge;node?:GraphNode}[];onRelated:(node:GraphNode)=>void;node:GraphNode;reading?:KnowledgeReading;hosted?:SharedFieldReading;error?:string;project?:string;onClose:()=>void;onPromote:()=>void;onOpen:OpenKnowledge;onTechne?:(node:GraphNode)=>Promise<void>;technePending?:boolean;techneFailure?:string;native:boolean;rect:DetailRect;extent:Extent;onGeometry:(rect:DetailRect)=>void;storageError?:string;transport:KernelTransportStatus;onActionDispatched:()=>void}) {
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
  const isHosted=isHostedNode(node);
  const hostedTarget=isHosted?node.provenance.detail?.[0]:undefined;
  const noLocalAddress="This subject belongs to the shared field. Its local source is not available on this device.";
  const title=hosted?.state==="hosted"?entryLabel(hosted.entry,hosted.projections,subjectLabel(node,"Unnamed knowledge subject")):subjectLabel(node,"Unnamed knowledge subject");
  const promote=async(placement:"page"|"window")=>{const address=graphAddress(node);if(!address){setFailure(noLocalAddress);return;}setPending(true);setFailure(undefined);try{await onOpen(address,title,project,placement);onPromote();}catch(e){setFailure(String(e));}finally{setPending(false);}};
  return <section className="knowledge-detail-dialog" role="dialog" aria-modal="false" aria-label={`Details: ${title}`} style={{left:rect.x,top:rect.y,width:rect.width,height:rect.height}} onKeyDown={e=>{if(e.key==="Escape"){e.preventDefault();e.stopPropagation();onClose();}}}>
    <header className="knowledge-detail-bar"><button className="knowledge-detail-move" aria-label="Move node details" title="Drag to move · arrow keys to adjust" onPointerDown={e=>begin(e,"move")} onPointerMove={move} onPointerUp={finish} onPointerCancel={finish} onLostPointerCapture={()=>{gesture.current=undefined;}} onKeyDown={e=>key(e,"move")}><span>{project??"Personal ground"} / {subjectKind(node.kind.replace(/^hosted-/,""))}</span><span aria-hidden="true">⠿</span></button><button className="oi-tool" ref={close} aria-label="Close node details" onClick={onClose}>×</button></header>
    <article className="knowledge-detail-body oi-sidecar" aria-busy={!reading&&!hosted&&!error}>
      <h1>{title}</h1>
      <p className="knowledge-owner">{isHosted?"Shared knowledge":"Knowledge source"}</p>
      {!isHosted&&graphAddress(node)?.kind==="wiki"&&<WikiFactsButton reference={graphAddress(node)!.value} onSaved={onActionDispatched}/>}
      {disclosures.map((disclosure,i)=><OwnerActions key={i} node={disclosure} transport={transport} project={project} onDispatched={onActionDispatched}/>)}
      {error?<><p role="alert">This source could not be read. Refresh to try again.</p><details className="oi-disclosure"><summary>Inspect reading failure</summary><p>{error}</p></details></>:hosted?<HostedReadingBody reading={hosted}/>:reading?<ReadingBody reading={reading} {...readingProps}/>:<p role="status">{isHosted?"Reading the hosted field…":"Reading content…"}</p>}
      {failure&&<><p role="alert">This subject could not be opened. Try again.</p><details className="oi-disclosure"><summary>Inspect opening failure</summary><p>{failure}</p></details></>}{techneFailure&&<><p role="alert">This subject could not be opened in Technè. Try again.</p><details className="oi-disclosure"><summary>Inspect Technè failure</summary><p>{techneFailure}</p></details></>}{storageError&&<><p role="status">The panel's position could not be saved.</p><details className="oi-disclosure"><summary>Inspect position storage failure</summary><p>{storageError}</p></details></>}
      <details className="knowledge-provenance oi-disclosure"><summary>Provenance & identity</summary><dl className="oi-kv"><dt>Reference</dt><dd>{node.ref}</dd><dt>Recorded name</dt><dd>{node.label}</dd><dt>Kind</dt><dd>{node.kind}</dd><dt>Native owner</dt><dd>{node.native_owner}</dd><dt>Source</dt><dd>{node.provenance.source}</dd>{isHosted?<>{hostedTarget&&<><dt>Hosted at</dt><dd data-hosted-target={hostedTarget}>{hostedTarget}</dd></>}{node.provenance.revision&&<><dt>Projection revision</dt><dd data-projection-revision={node.provenance.revision}>{node.provenance.revision}</dd></>}{node.provenance.detail?.[1]&&<><dt>Entry revision</dt><dd data-entry-revision={node.provenance.detail[1]}>{node.provenance.detail[1]}</dd></>}</>:node.provenance.revision&&<><dt>Revision</dt><dd>{node.provenance.revision}</dd></>}</dl>{!isHosted&&node.provenance.detail?.map((text,i)=><p key={i}>{text}</p>)}</details>
      <details className="knowledge-related oi-disclosure"><summary>Related subjects · {relatedSubjects.size}</summary><ul>{[...relatedSubjects].map(([ref,{node:other,relations}],index)=><li key={ref} data-related-ref={ref}>{other?<button className="oi-action" onClick={()=>onRelated(other)}>{subjectLabel(other,`Unnamed related subject ${index+1}`)}</button>:<span>Unavailable related subject {index+1} · not in this reading</span>}<small>{relations.map(relationLabel).join(" · ")}</small></li>)}</ul>{!relatedSubjects.size&&<p>No relations disclosed for this subject.</p>}</details>
    </article>
    <footer className="knowledge-detail-footer oi-action-group"><button className="oi-action" disabled={pending||!reading||isHosted} title={isHosted?noLocalAddress:undefined} onClick={()=>void promote("page")}>Open in tab <span aria-hidden="true">↗</span></button><button className="oi-action" disabled={pending||!reading||!native||isHosted} title={isHosted?noLocalAddress:native?"Open this same subject in a native window":"Native popout is available in the desktop app"} onClick={()=>void promote("window")}>Pop out <span aria-hidden="true">↗</span></button>{onTechne&&<button className="oi-action" disabled={technePending||isHosted} title={isHosted?noLocalAddress:"Open this same subject or constellation in the Technè instrument"} onClick={()=>void onTechne(node)}>{technePending?"Opening in Technè…":"Open in Technè"} <span aria-hidden="true">↗</span></button>}</footer>
    {(["nw","n","ne","e","se","s","sw","w"] as ResizeHandle[]).map(handle=><button key={handle} className={`knowledge-detail-edge knowledge-detail-edge-${handle}`} aria-label={`Resize node details ${handle}`} title="Drag to resize · arrow keys to adjust" onPointerDown={e=>begin(e,handle)} onPointerMove={move} onPointerUp={finish} onPointerCancel={finish} onLostPointerCapture={()=>{gesture.current=undefined;}} onKeyDown={e=>key(e,handle)}/>)}
  </section>;
}
