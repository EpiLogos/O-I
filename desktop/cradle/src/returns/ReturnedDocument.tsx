import {useEffect,useRef,useState,type ReactNode} from "react";
import type {ReturnedContinuation,ReturnedDocumentCallbacks,ReturnedDocumentReading,ReturnedEvidence,ReturnedMaterial,ReturnedOutstanding} from "./types";
import "./returned-document.css";

const variantLabel:Record<ReturnedDocumentReading["variant"],string>={
  code:"Code change",verification:"Verification",report:"Report","preview-media":"Preview",handoff:"Handoff",
};

type ActionState={state:"idle"|"working"|"succeeded"|"failed";message?:string};
const idleAction:ActionState={state:"idle"};

/** Shared document projection for structured owner readings. It never creates
 * material, predicts verification, or converts a reference into a host target. */
export function ReturnedDocument({reading,callbacks,body}:{reading:ReturnedDocumentReading;callbacks?:ReturnedDocumentCallbacks;body?:ReactNode}) {
  const material=reading.material??[];
  const evidence=reading.evidence??[];
  const outstanding=reading.outstanding??[];
  const continuations=reading.continuations??[];
  return <article className="returned-document" data-variant={reading.variant} aria-label={variantLabel[reading.variant]+" document"}>
    <header className="returned-document-header">
      <p className="returned-document-kicker">{variantLabel[reading.variant]}</p>
      <h2>{reading.subject.title}</h2>
      {reading.outcome.summary!==reading.subject.title&&<p className="returned-document-outcome">{reading.outcome.summary}</p>}
      {reading.outcome.standing&&<p className="returned-document-standing">{reading.outcome.standing}</p>}
      {reading.subject.ref&&<ReferenceDisclosure summary="Document identity" reference={reading.subject.ref}/>}
    </header>
    {reading.variant==="verification"?<DocumentSection title="Checks and results" required>
      {body}
      {evidence.length>0?<EvidenceList evidence={evidence}/>:<Missing text="No check results were disclosed for this verification."/>}
    </DocumentSection>:<DocumentSection title={reading.variant==="report"?"Findings":reading.variant==="preview-media"?"Preview":"What changed"}>
      {body}
      {(!body||reading.variant==="preview-media")&&material.length>0&&<MaterialList material={material} callbacks={callbacks}/>}
      {!body&&material.length===0&&<Missing text="The owner did not disclose the material body for this document."/>}
    </DocumentSection>}
    {reading.variant!=="verification"&&(evidence.length>0||reading.variant==="code"||reading.variant==="handoff")&&<DocumentSection title={reading.variant==="report"?"Evidence":"Verification"} required={reading.variant==="code"||reading.variant==="handoff"||evidence.some(item=>item.required)}>
      {evidence.length>0?<EvidenceList evidence={evidence}/>:<Missing text="The owner did not disclose verification for this document."/>}
    </DocumentSection>}
    {material.length>0&&(reading.variant==="verification"||!!body&&reading.variant!=="preview-media")&&<DocumentSection title="Artifacts and attachments"><MaterialList material={material} callbacks={callbacks}/></DocumentSection>}
    {reading.runtime&&reading.runtime.length>0&&<DocumentSection title="Runtime observations"><dl className="returned-document-runtime">{reading.runtime.map(row=><div key={row.label+"-"+row.value}><dt>{row.label}</dt><dd>{row.value}{row.standing==="derived"&&row.basis&&<small>Derived from {row.basis}</small>}{row.standing==="observed"&&row.basis&&<small>Source {row.basis}</small>}</dd></div>)}</dl></DocumentSection>}
    {outstanding.length>0&&<DocumentSection title="Remaining work"><OutstandingList items={outstanding}/></DocumentSection>}
    {(continuations.length>0||reading.variant==="handoff")&&<DocumentSection title="Continue" required>
      {continuations.length>0?<ContinuationList continuations={continuations} callbacks={callbacks}/>:<Missing text="No continuation is available for this document."/>}
    </DocumentSection>}
    <details className="returned-document-provenance"><summary>Provenance and basis</summary><dl>{reading.provenance.map(row=><div key={row.label+"-"+row.value}><dt>{row.label}</dt><dd><code>{row.value}</code></dd></div>)}</dl></details>
  </article>;
}

function DocumentSection({title,required,children}:{title:string;required?:boolean;children:ReactNode}) {
  return <section className="returned-document-section"><h3>{title}{required&&<span aria-label="Required">Required</span>}</h3>{children}</section>;
}

function Missing({text}:{text:string}) { return <p className="returned-document-missing" role="status">{text}</p>; }

function ContinuationList({continuations,callbacks}:{continuations:ReturnedContinuation[];callbacks?:ReturnedDocumentCallbacks}) {
  const [actions,setActions]=useState<Record<number,ActionState>>({});
  const generation=useRef(0);
  const identity=continuations.slice(0,3).map(item=>(item.label??"")+"\\u0000"+item.prompt).join("\\u0001");
  useEffect(()=>{generation.current+=1;setActions({});return ()=>{generation.current+=1;};},[identity]);
  const canCopy=Boolean(callbacks?.onCopyContinuation)||typeof navigator!=="undefined"&&typeof navigator.clipboard?.writeText==="function";
  const copy=async(continuation:ReturnedContinuation,index:number)=>{
    const request=generation.current;
    setActions(current=>({...current,[index]:{state:"working"}}));
    try {
      if(callbacks?.onCopyContinuation) await callbacks.onCopyContinuation(continuation);
      else if(typeof navigator!=="undefined"&&typeof navigator.clipboard?.writeText==="function") await navigator.clipboard.writeText(continuation.prompt);
      else throw new Error("Copy is unavailable in this surface.");
      if(generation.current===request) setActions(current=>({...current,[index]:{state:"succeeded",message:"Copied."}}));
    } catch(error) {
      if(generation.current===request) setActions(current=>({...current,[index]:{state:"failed",message:actionError(error,"Copy did not complete.")}}));
    }
  };
  return <ol className="returned-document-continuations">{continuations.slice(0,3).map((continuation,index)=>{
    const action=actions[index]??idleAction;
    return <li key={(continuation.label??"continue")+"-"+index}><div><small>{continuation.label}</small><code>{continuation.prompt}</code></div>{canCopy&&<div className="returned-document-action"><button type="button" disabled={action.state==="working"} onClick={()=>void copy(continuation,index)}>{action.state==="working"?"Copying...":action.state==="succeeded"?"Copied":action.state==="failed"?"Retry copy":"Copy"}</button><ActionStateNotice action={action}/></div>}</li>;
  })}</ol>;
}

function MaterialList({material,callbacks}:{material:ReturnedMaterial[];callbacks?:ReturnedDocumentCallbacks}) {
  const [actions,setActions]=useState<Record<number,ActionState>>({});
  const generation=useRef(0);
  const identity=material.map(item=>item.kind+"\\u0000"+item.label+"\\u0000"+(item.ref??"")+"\\u0000"+JSON.stringify(item.open??null)).join("\\u0001");
  useEffect(()=>{generation.current+=1;setActions({});return ()=>{generation.current+=1;};},[identity]);
  const open=async(item:ReturnedMaterial,index:number)=>{
    if(!callbacks?.onOpenMaterial) return;
    const request=generation.current;
    setActions(current=>({...current,[index]:{state:"working"}}));
    try {
      await callbacks.onOpenMaterial(item);
      if(generation.current===request) setActions(current=>({...current,[index]:{state:"succeeded",message:"Open request completed."}}));
    } catch(error) {
      if(generation.current===request) setActions(current=>({...current,[index]:{state:"failed",message:actionError(error,"Open request did not complete.")}}));
    }
  };
  return <ul className="returned-document-material">{material.map((item,index)=>{
    const host=item.open?callbacks?.renderMaterial?.(item):undefined;
    const action=actions[index]??idleAction;
    const canOpen=Boolean(item.open&&callbacks?.onOpenMaterial);
    return <li key={item.kind+"-"+(item.ref??item.label)+"-"+index}><div className="returned-document-material-copy"><strong>{item.label}</strong>{item.description&&<p>{item.description}</p>}{host&&<div className="returned-document-material-host">{host}</div>}{item.ref&&<ReferenceDisclosure summary="Material reference" reference={item.ref}/>} {!item.open&&<p className="returned-document-unresolved">No native opening target was disclosed for this material.</p>}</div>{canOpen&&<div className="returned-document-action"><button type="button" disabled={action.state==="working"} onClick={()=>void open(item,index)}>{action.state==="working"?"Opening...":action.state==="succeeded"?"Opened":action.state==="failed"?"Retry open":openLabel(item)}</button><ActionStateNotice action={action}/></div>}</li>;
  })}</ul>;
}

function openLabel(item:ReturnedMaterial) {
  return item.open?.kind==="diff"?"Open diff":item.open?.kind==="file"?"Open file":item.open?.kind==="preview"||item.open?.kind==="media"?"Open preview":"Open artifact";
}

function ActionStateNotice({action}:{action:ActionState}) {
  if(action.state==="idle"||action.state==="working") return null;
  return <p className="returned-document-action-state" data-state={action.state} role={action.state==="failed"?"alert":"status"}>{action.message}</p>;
}

function ReferenceDisclosure({summary,reference}:{summary:string;reference:string}) {
  return <details className="returned-document-reference"><summary>{summary}</summary><code>{reference}</code></details>;
}

function EvidenceList({evidence}:{evidence:ReturnedEvidence[]}) {
  return <ul className="returned-document-evidence">{evidence.map(item=><li key={item.label+"-"+item.standing+"-"+(item.refs?.join("-")??"")} data-standing={item.standing}><strong>{item.label}</strong><span>{item.standing}</span>{item.detail&&<p>{item.detail}</p>}{item.refs&&item.refs.length>0&&<details className="returned-document-evidence-refs"><summary>Evidence references ({item.refs.length})</summary><ul>{item.refs.map(ref=><li key={ref}><code>{ref}</code></li>)}</ul></details>}</li>)}</ul>;
}

function OutstandingList({items}:{items:ReturnedOutstanding[]}) {
  return <ul className="returned-document-outstanding">{items.map(item=><li key={item.label+"-"+(item.ref??item.detail??"")}><strong>{item.label}</strong>{item.detail&&<p>{item.detail}</p>}{item.ref&&<ReferenceDisclosure summary="Outstanding reference" reference={item.ref}/>}</li>)}</ul>;
}

function actionError(error:unknown,fallback:string) {
  return error instanceof Error&&error.message?error.message:fallback;
}
