import {useCallback,useEffect,useRef,useState,type ReactNode} from "react";
import {useKernel} from "../../kernel/KernelProvider";
import {ReturnedDocument,type ReturnedDocumentReading,type ReturnedEvidence,type ReturnedMaterial,type ReturnedOutstanding} from "../../returns";
import {developmentRead} from "./development";
import {selectFactoryMaterial,type FactoryMaterial,type FactoryMaterialBuildReading,type FactoryMaterialSelection} from "./factory-material-reading";
import type {CandidateView,EvidenceView} from "./types";
import "./factory-material-surface.css";
import {createFactoryMaterialReviewSnapshot,factoryMaterialReview,type FactoryMaterialReviewSnapshot} from "./factory-review-snapshot";

export interface FactoryMaterialSurfaceProps {
  statePath:string;
  runRef:string;
  subjectRef:string;
  /** Factory Build/state revision supplied by the owning Surface binding. */
  expectedRevision?:number;
  snapshot?:FactoryMaterialReviewSnapshot;
  snapshotUnavailable?:string;
  /** Atomically persists an explicit revision choice and its retained owner reading. */
  onReviewAccepted?:(review:{revision:number;snapshot?:FactoryMaterialReviewSnapshot;snapshotUnavailable?:string})=>void|Promise<void>;
}

type ReviewedMaterial=Extract<FactoryMaterialSelection,{kind:"selected"}>&{payload:unknown};
type LatestMaterial=ReviewedMaterial|{kind:"refusal";message:string;reading:FactoryMaterialBuildReading;payload:unknown};
type CandidateMaterial=Extract<FactoryMaterial,{kind:"candidate"}>;
type EvidenceMaterial=Extract<FactoryMaterial,{kind:"evidence"}>;

/** Right-pane reader for one canonical Factory Candidate or Evidence. It reads
 * the owner Build record only; opaque references remain disclosed references. */
export function FactoryMaterialSurface({statePath,runRef,subjectRef,expectedRevision,snapshot,snapshotUnavailable,onReviewAccepted}:FactoryMaterialSurfaceProps) {
  const kernel=useKernel();
  const [reviewed,setReviewed]=useState<ReviewedMaterial>();
  const [latest,setLatest]=useState<LatestMaterial>();
  const [error,setError]=useState<string>();
  const [busy,setBusy]=useState(false);
  const [accepting,setAccepting]=useState(false);
  const request=useRef(0),mounted=useRef(true),sourceIdentity=useRef(""),reviewedRef=useRef<ReviewedMaterial>();
  const identity=[statePath,runRef,subjectRef].join("\u0000");
  const expected={statePath,runRef,subjectRef};
  const inputs=useRef({expectedRevision,snapshot,snapshotUnavailable});
  inputs.current={expectedRevision,snapshot,snapshotUnavailable};

  useEffect(()=>{mounted.current=true;return ()=>{mounted.current=false;request.current+=1;};},[]);
  const current=useCallback((generation:number)=>mounted.current&&request.current===generation,[]);
  const onReviewAcceptedRef=useRef(onReviewAccepted);
  onReviewAcceptedRef.current=onReviewAccepted;
  const persistReview=useCallback(async(selection:ReviewedMaterial):Promise<string|undefined>=>{
    const captured=createFactoryMaterialReviewSnapshot(selection.payload,expected);
    const retained=captured?{revision:selection.reading.revision,snapshot:captured}:{revision:selection.reading.revision,snapshotUnavailable:"This Factory material remains visible here, but it cannot be retained across presentation changes. Refresh explicitly to read the current Factory state."};
    try { await onReviewAcceptedRef.current?.(retained); }
    catch(reason) { return `This Factory material remains visible here, but its presentation snapshot could not be retained: ${message(reason)}`; }
    return captured?undefined:retained.snapshotUnavailable;
  },[expected.statePath,expected.runRef,expected.subjectRef]);
  const acceptLatest=useCallback(async()=>{
    if(!latest||latest.kind!=="selected") return;
    const generation=request.current;
    setAccepting(true);
    try {
      const notice=await persistReview(latest);
      if(!current(generation)) return;
      reviewedRef.current=latest;
      setReviewed(latest);setLatest(undefined);setError(notice);
    } catch(reason) {
      if(current(generation)) setError(`Factory revision ${latest.reading.revision} could not be selected: ${message(reason)}`);
    } finally {
      if(current(generation)) setAccepting(false);
    }
  },[current,latest,persistReview]);

  const read=useCallback(async()=>{
    const generation=++request.current;
    if(current(generation)) { setBusy(true);setError(undefined); }
    try {
      const payload=await developmentRead<unknown>(kernel.transport,statePath,"build",runRef);
      if(!current(generation)) return;
      const result=selectFactoryMaterial(payload,runRef,subjectRef);
      const reading=result.reading;
      if(!reading) { setError(result.kind==="refusal"?result.message:"Factory did not return a material reading.");return; }
      const retained:LatestMaterial=result.kind==="selected"?{...result,payload}:{kind:"refusal",message:result.message,reading,payload};
      const boundRevision=inputs.current.expectedRevision;
      if(boundRevision!==undefined&&reading.revision!==boundRevision&&reviewedRef.current?.reading.revision!==reading.revision) {
        setLatest(retained);
        setError(`Factory returned Build revision ${reading.revision}; this material view is bound to revision ${boundRevision}.`);
        return;
      }
      if(result.kind==="refusal") {
        if(reviewedRef.current&&reviewedRef.current.reading.revision!==reading.revision) setLatest(retained);
        setError(result.message);return;
      }
      const selected=retained as ReviewedMaterial;
      if(!reviewedRef.current) { reviewedRef.current=selected;setReviewed(selected);const notice=await persistReview(selected);if(current(generation)&&notice)setError(notice);return; }
      if(reviewedRef.current.reading.revision===reading.revision) { setLatest(undefined);return; }
      setLatest(retained);
    } catch(reason) {
      if(current(generation)) setError(`Factory material read unavailable: ${message(reason)}`);
    } finally {
      if(current(generation)) setBusy(false);
    }
  },[current,kernel.transport,persistReview,runRef,statePath,subjectRef]);

  useEffect(()=>{
    const changed=sourceIdentity.current!==identity;
    sourceIdentity.current=identity;
    if(changed) {
      request.current+=1;
      reviewedRef.current=undefined;
      setReviewed(undefined);setLatest(undefined);setError(undefined);setAccepting(false);
    }
    const held=inputs.current;
    const retained=held.snapshot?factoryMaterialReview(held.snapshot,expected):undefined;
    if(retained&&(held.expectedRevision===undefined||retained.reading.revision===held.expectedRevision)) {
      const reviewedSnapshot={...retained,payload:held.snapshot!.payload};
      reviewedRef.current=reviewedSnapshot;
      setReviewed(reviewedSnapshot);setLatest(undefined);setError(undefined);setBusy(false);
    } else if(held.snapshot||held.snapshotUnavailable) {
      setError(held.snapshotUnavailable??"The retained Factory material cannot be restored for this revision. Refresh explicitly to read current Factory state.");setBusy(false);
    } else void read();
  },[identity,expected.statePath,expected.runRef,expected.subjectRef,read]);

  const document=reviewed?materialDocument(reviewed):undefined;
  return <section className="factory-material-surface" aria-label="Factory material">
    <header className="factory-material-toolbar">
      <p>Factory material</p>
      <button type="button" onClick={()=>void read()} disabled={busy||accepting}>{busy?"Reading…":"Refresh native read"}</button>
    </header>
    <details className="factory-material-basis"><summary>Read basis</summary><dl><div><dt>Run</dt><dd><code>{runRef}</code></dd></div><div><dt>Selected subject</dt><dd><code>{subjectRef}</code></dd></div>{expectedRevision!==undefined&&<div><dt>Bound Build revision</dt><dd>{expectedRevision}</dd></div>}</dl></details>
    {error&&<p className="factory-material-refusal" role="alert">{error}</p>}
    {latest&&<LatestRevision reading={latest} expectedRevision={expectedRevision} accepting={accepting} onSelect={()=>void acceptLatest()}/>}
    {document&&reviewed?<ReturnedDocument reading={document} body={<MaterialBody material={reviewed.material}/>}/>:!error&&!busy&&<p className="factory-material-empty">No Factory material is currently selected.</p>}
  </section>;
}

function LatestRevision({reading,expectedRevision,accepting,onSelect}:{reading:LatestMaterial;expectedRevision?:number;accepting:boolean;onSelect:()=>void}) {
  const revision=reading.reading.revision;
  const identity=reading.kind==="selected"?(reading.material.kind==="candidate"?reading.material.candidate.label:reading.material.evidence.label):undefined;
  return <aside className="factory-material-latest" aria-label="Different Factory Build reading">
    <div><strong>A different native Build revision is available</strong><p>Revision {revision}{identity?` contains ${identity}.`:" was returned for this material."} It has not replaced the revision under review.</p>{expectedRevision!==undefined&&expectedRevision!==revision&&<small>Bound revision: {expectedRevision}</small>}</div>
    {reading.kind==="selected"?<button type="button" onClick={onSelect} disabled={accepting}>{accepting?"Selecting…":`Review revision ${revision}`}</button>:<p className="factory-material-latest-refusal">The returned revision cannot be selected: {reading.message}</p>}
  </aside>;
}

function materialDocument(selection:ReviewedMaterial):ReturnedDocumentReading {
  const {reading,material}=selection;
  const common={provenance:[
    {label:"Factory Build contract",value:reading.contract},{label:"Build revision",value:String(reading.revision)},
    {label:"Factory state revision",value:String(reading.factoryStateRevision)},{label:"Run revision",value:String(reading.runRevision)},
    {label:"Run Map revision",value:String(reading.runMapRevision)},{label:"Factory source",value:reading.provenanceSource},
    {label:"Project",value:reading.project.projectRef},{label:"Run",value:reading.run.runRef},{label:"Run Map",value:reading.run.runMapRef},
  ]};
  if(material.kind==="evidence") return {
    variant:"verification",subject:{title:material.evidence.label,ref:material.evidence.evidenceRef},
    outcome:{summary:material.evidence.assessment??"Factory retained this Evidence without an assessment."},
    material:evidenceMaterial(material.evidence),evidence:[evidenceDocument(material.evidence)],
    outstanding:material.evidence.assessment?undefined:[{label:"Evidence assessment",detail:"Factory did not disclose an assessment for this Evidence.",ref:material.evidence.evidenceRef}],...common,
  };
  return {
    variant:"report",subject:{title:material.candidate.label,ref:material.candidate.candidateRef},
    outcome:{summary:`Candidate revision ${material.candidate.revision} · ${material.candidate.status}`},
    material:candidateMaterial(material.candidate),evidence:material.evidence.filter(item=>item.evidence).map(item=>evidenceDocument(item.evidence!)),
    outstanding:unresolvedRelations(material),...common,
  };
}
function candidateMaterial(candidate:CandidateView):ReturnedMaterial[] { return [...(candidate.artifactRefs??[]).map((ref,index)=>({kind:"artifact" as const,label:`Candidate artifact ${index+1}`,ref})),...(candidate.previewRef?[{kind:"preview" as const,label:"Candidate preview",ref:candidate.previewRef}]:[])]; }
function evidenceMaterial(evidence:EvidenceView):ReturnedMaterial[] { return evidence.nativeRef?[{kind:"evidence",label:"Native evidence reference",ref:evidence.nativeRef}]:[]; }
function evidenceDocument(evidence:EvidenceView):ReturnedEvidence { return {label:evidence.label,standing:"recorded",detail:evidence.assessment??"Factory retained this Evidence without an assessment.",refs:[evidence.evidenceRef,...(evidence.nativeRef?[evidence.nativeRef]:[]),...(evidence.producingExecutionRef?[evidence.producingExecutionRef]:[])]}; }
function unresolvedRelations(material:CandidateMaterial):ReturnedOutstanding[] { return [...material.claims.filter(item=>!item.claim).map(item=>({label:"Candidate claim unavailable",detail:"Factory retained this claim reference but did not disclose its claim reading in the Build record.",ref:item.ref})),...material.evidence.filter(item=>!item.evidence).map(item=>({label:"Linked Evidence unavailable",detail:"Factory retained this Evidence reference but did not disclose its Evidence reading in the Build record.",ref:item.ref}))]; }

function MaterialBody({material}:{material:FactoryMaterial}):ReactNode {
  if(material.kind==="evidence") return <EvidenceBody material={material}/>;
  return <section className="factory-material-body">
    {material.candidate.tradeoffs&&material.candidate.tradeoffs.length>0&&<section><h4>Tradeoffs</h4><ul>{material.candidate.tradeoffs.map((tradeoff,index)=><li key={tradeoff+index}>{tradeoff}</li>)}</ul></section>}
    <section><h4>Claims</h4>{material.claims.length>0?<div className="factory-material-claims">{material.claims.map(item=>item.claim?<article key={item.ref}><header><span>{item.claim.status}</span></header><p>{item.claim.statement}</p><Reference summary="Claim identity" value={item.claim.claimRef}/>{item.claim.evidenceRefs.length>0&&<ReferenceList summary={`Linked Evidence references (${item.claim.evidenceRefs.length})`} values={item.claim.evidenceRefs}/>}</article>:<Unavailable key={item.ref} kind="Claim" value={item.ref}/>)}</div>:<p>Factory retained no claims for this Candidate.</p>}</section>
    <section><h4>Linked Evidence</h4>{material.evidence.length>0?<div className="factory-material-evidence">{material.evidence.map(item=>item.evidence?<article key={item.ref}><h5>{item.evidence.label}</h5><p>{item.evidence.assessment??"Factory retained this Evidence without an assessment."}</p><Reference summary="Evidence identity" value={item.evidence.evidenceRef}/>{item.evidence.producingExecutionRef&&<Reference summary="Producing execution" value={item.evidence.producingExecutionRef}/>}</article>:<Unavailable key={item.ref} kind="Evidence" value={item.ref}/>)}</div>:<p>Factory retained no linked Evidence for this Candidate.</p>}</section>
    <details className="factory-material-details"><summary>Candidate basis</summary><dl><div><dt>Candidate revision</dt><dd>{material.candidate.revision}</dd></div><div><dt>Status</dt><dd>{material.candidate.status}</dd></div><div><dt>Candidate</dt><dd><code>{material.candidate.candidateRef}</code></dd></div></dl>{material.candidate.producingExecutionRefs.length>0&&<ReferenceList summary={`Producing executions (${material.candidate.producingExecutionRefs.length})`} values={material.candidate.producingExecutionRefs}/>}</details>
  </section>;
}
function EvidenceBody({material}:{material:EvidenceMaterial}) { return <section className="factory-material-body"><p>{material.evidence.assessment??"Factory retained this Evidence without an assessment."}</p><Reference summary="Evidence identity" value={material.evidence.evidenceRef}/>{material.evidence.producingExecutionRef&&<Reference summary="Producing execution" value={material.evidence.producingExecutionRef}/>}</section>; }
function Unavailable({kind,value}:{kind:string;value:string}) { return <article className="factory-material-unavailable"><p>{kind} is referenced but unavailable in this Factory Build reading.</p><Reference summary={`${kind} reference`} value={value}/></article>; }
function Reference({summary,value}:{summary:string;value:string}) { return <details className="factory-material-reference"><summary>{summary}</summary><code>{value}</code></details>; }
function ReferenceList({summary,values}:{summary:string;values:string[]}) { return <details className="factory-material-reference"><summary>{summary}</summary><ul>{values.map(value=><li key={value}><code>{value}</code></li>)}</ul></details>; }
function message(reason:unknown) { return reason instanceof Error&&reason.message?reason.message:String(reason); }
