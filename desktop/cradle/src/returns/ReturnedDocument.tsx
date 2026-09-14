import type {ReactNode} from "react";
import type {ReturnedDocumentCallbacks,ReturnedDocumentReading,ReturnedEvidence,ReturnedMaterial,ReturnedOutstanding} from "./types";
import "./returned-document.css";

const variantLabel:Record<ReturnedDocumentReading["variant"],string>={
  code:"Code change",verification:"Verification",report:"Report", "preview-media":"Preview",handoff:"Handoff",
};

/** Shared document projection for structured owner readings. It never creates
 * material, predicts verification, or converts a reference into a host target. */
export function ReturnedDocument({reading,callbacks,body}:{reading:ReturnedDocumentReading;callbacks?:ReturnedDocumentCallbacks;body?:ReactNode}) {
  const material=reading.material??[];
  const evidence=reading.evidence??[];
  const outstanding=reading.outstanding??[];
  const continuations=reading.continuations??[];
  const canCopyContinuation=Boolean(callbacks?.onCopyContinuation)||typeof navigator!=="undefined"&&Boolean(navigator.clipboard);
  const copyContinuation=(continuation:import("./types").ReturnedContinuation)=>callbacks?.onCopyContinuation?.(continuation)??navigator.clipboard?.writeText(continuation.prompt);
  return <article className="returned-document" data-variant={reading.variant} aria-label={`${variantLabel[reading.variant]} document`}>
    <header className="returned-document-header">
      <p className="returned-document-kicker">{variantLabel[reading.variant]}</p>
      <h2>{reading.subject.title}</h2>
      {reading.subject.ref&&<code>{reading.subject.ref}</code>}
      {reading.outcome.summary!==reading.subject.title&&<p className="returned-document-outcome">{reading.outcome.summary}</p>}
      {reading.outcome.standing&&<p className="returned-document-standing">{reading.outcome.standing}</p>}
    </header>
    <DocumentSection title="What changed">{body}{material.length>0?<MaterialList material={material} callbacks={callbacks}/>:!body&&<Missing text="The owner did not disclose changed material for this document."/>}</DocumentSection>
    <DocumentSection title="Verification" required>
      {evidence.length>0?<EvidenceList evidence={evidence}/>:<Missing text="The owner did not disclose verification for this document."/>}
    </DocumentSection>
    {reading.runtime&&reading.runtime.length>0&&<DocumentSection title="Runtime observations"><dl className="returned-document-runtime">{reading.runtime.map(row=><div key={`${row.label}-${row.value}`}><dt>{row.label}</dt><dd>{row.value}{row.standing==="derived"&&row.basis&&<small>Derived from {row.basis}</small>}{row.standing==="observed"&&row.basis&&<small>Source {row.basis}</small>}</dd></div>)}</dl></DocumentSection>}
    {outstanding.length>0&&<DocumentSection title="Remaining work"><OutstandingList items={outstanding}/></DocumentSection>}
    {(continuations.length>0||reading.variant==="handoff")&&<DocumentSection title="Continue" required>
      {continuations.length>0?<ol className="returned-document-continuations">{continuations.slice(0,3).map((continuation,index)=><li key={`${continuation.label??"continue"}-${index}`}><div><small>{continuation.label}</small><code>{continuation.prompt}</code></div>{canCopyContinuation&&<button type="button" onClick={()=>void copyContinuation(continuation)}>Copy</button>}</li>)}</ol>:<Missing text="No continuation is available for this document."/>}
    </DocumentSection>}
    <details className="returned-document-provenance"><summary>Provenance</summary><dl>{reading.provenance.map(row=><div key={`${row.label}-${row.value}`}><dt>{row.label}</dt><dd><code>{row.value}</code></dd></div>)}</dl></details>
  </article>;
}

function DocumentSection({title,required,children}:{title:string;required?:boolean;children:ReactNode}) {
  return <section className="returned-document-section"><h3>{title}{required&&<span aria-label="Required">Required</span>}</h3>{children}</section>;
}

function Missing({text}:{text:string}) { return <p className="returned-document-missing" role="status">{text}</p>; }

function MaterialList({material,callbacks}:{material:ReturnedMaterial[];callbacks?:ReturnedDocumentCallbacks}) {
  return <ul className="returned-document-material">{material.map(item=>{
    const host=item.open?callbacks?.renderMaterial?.(item):undefined;
    return <li key={`${item.kind}-${item.ref??item.label}`}><div><strong>{item.label}</strong>{item.description&&<p>{item.description}</p>}{item.ref&&<code>{item.ref}</code>}{host&&<div className="returned-document-material-host">{host}</div>}</div>{item.open&&callbacks?.onOpenMaterial&&<button type="button" onClick={()=>void callbacks.onOpenMaterial?.(item)}>{item.open.kind==="diff"?"Open diff":item.open.kind==="file"?"Open file":item.open.kind==="preview"||item.open.kind==="media"?"Open preview":"Open artifact"}</button>}</li>;
  })}</ul>;
}

function EvidenceList({evidence}:{evidence:ReturnedEvidence[]}) {
  return <ul className="returned-document-evidence">{evidence.map(item=><li key={`${item.label}-${item.standing}-${item.refs?.join("-")??""}`} data-standing={item.standing}><strong>{item.label}</strong><span>{item.standing}</span>{item.detail&&<p>{item.detail}</p>}{item.refs&&item.refs.length>0&&<ul>{item.refs.map(ref=><li key={ref}><code>{ref}</code></li>)}</ul>}</li>)}</ul>;
}

function OutstandingList({items}:{items:ReturnedOutstanding[]}) {
  return <ul className="returned-document-outstanding">{items.map(item=><li key={`${item.label}-${item.ref??item.detail??""}`}><strong>{item.label}</strong>{item.detail&&<p>{item.detail}</p>}{item.ref&&<code>{item.ref}</code>}</li>)}</ul>;
}
