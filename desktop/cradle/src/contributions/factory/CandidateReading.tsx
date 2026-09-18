import { useRef, useState, type ReactNode } from "react";
import type { CandidateView, ClaimView, EvidenceView, FactoryBuildView, FactoryMaterialSelection } from "./types";

/** The review desk. Every retained Candidate renders as one review card:
 * what changed, each claim with its evidence directly beneath it, the
 * verdict actions attached to the card, and the exact refs as one quiet
 * secondary line. Selection only follows Factory's exact claim/evidence
 * relations; it never turns an opaque artifact ref into an O:I file,
 * Surface or recognition. */
export function CandidateReading({view,actions,onOpenMaterial,impliedEmpty=false}:{view:FactoryBuildView;actions:(candidate:CandidateView)=>ReactNode;onOpenMaterial?:(selection:FactoryMaterialSelection)=>Promise<void>;impliedEmpty?:boolean}) {
  const [openError,setOpenError]=useState<string>();
  const openGeneration=useRef(0);
  async function open(selection:FactoryMaterialSelection) {
    if(!onOpenMaterial)return;
    const generation=++openGeneration.current;
    setOpenError(undefined);
    try {await onOpenMaterial(selection);}
    catch(error){if(generation===openGeneration.current)setOpenError(String(error));}
  }
  const openEvidence=(ref:string)=>{const reading=view.evidence.find(item=>item.evidenceRef===ref);if(reading)void open({subjectRef:ref,label:reading.label});};
  if(!view.candidates.length) {
    if(impliedEmpty) return null;
    return <section className="fb-review" aria-label="Review">
      <div className="fb-section-head"><h2>Review</h2><span>0 retained</span></div>
      {openError&&<p className="fb-empty" role="alert">{openError}</p>}
      <p className="fb-empty">No candidate has been retained for this Run.</p>
      {(view.claims.length>0||view.evidence.length>0)&&<div className="fb-claims fb-unattached">
        <h3>Run claims and evidence</h3>
        {view.claims.map(claim=><Claim key={claim.claimRef} claim={claim} evidence={view.evidence} onOpenEvidence={openEvidence}/>)}
        {view.evidence.filter(evidence=>!view.claims.some(claim=>claim.evidenceRefs.includes(evidence.evidenceRef))).map(evidence=><Evidence key={evidence.evidenceRef} evidence={evidence} onOpen={()=>openEvidence(evidence.evidenceRef)}/>)}
      </div>}
    </section>;
  }
  return <section className="fb-review" aria-label="Review">
    <div className="fb-section-head"><h2>Review</h2><span>{view.candidates.length} retained</span></div>
    {openError&&<p className="fb-empty" role="alert">{openError}</p>}
    {view.candidates.map(candidate=>{
      const claims=candidate.claimRefs.map(ref=>({ref,reading:view.claims.find(claim=>claim.claimRef===ref)}));
      const claimEvidenceRefs=new Set(claims.flatMap(({reading})=>reading?.evidenceRefs??[]));
      const otherEvidence=[...new Set(candidate.evidenceRefs)].filter(ref=>!claimEvidenceRefs.has(ref)).map(ref=>({ref,reading:view.evidence.find(item=>item.evidenceRef===ref)}));
      return <article key={candidate.candidateRef} className="fb-review-card" aria-label={"Candidate: "+candidate.label}>
        <div className="fb-card-top"><h3>{candidate.label}</h3><span className="fb-status">{candidate.status}</span><span className="fb-review-meta">Revision {candidate.revision}</span></div>
        {!!candidate.tradeoffs?.length&&<ul className="fb-tradeoffs">{candidate.tradeoffs.map((tradeoff,index)=><li key={tradeoff+index}>{tradeoff}</li>)}</ul>}
        <div className="fb-actions">{actions(candidate)}</div>
        <div className="fb-claims">
          {claims.length?claims.map(({ref,reading})=>reading?<Claim key={ref} claim={reading} evidence={view.evidence} onOpenEvidence={openEvidence}/>:<Unresolved key={ref} kind="Claim" reference={ref}/>):<p className="fb-muted">No claims are attached to this candidate.</p>}
        </div>
        {otherEvidence.length>0&&<div className="fb-claims">
          <h4>Other evidence</h4>
          {otherEvidence.map(({ref,reading})=>reading?<Evidence key={ref} evidence={reading} onOpen={()=>openEvidence(ref)}/>:<Unresolved key={ref} kind="Evidence" reference={ref}/>)}
        </div>}
        <p className="fb-ref-line"><code>{candidate.candidateRef}</code>{candidate.producingExecutionRefs.map(ref=><code key={ref}>{ref}</code>)}{candidate.artifactRefs?.map(ref=><code key={"artifact-"+ref}>artifact {ref}</code>)}{candidate.previewRef&&<code>preview {candidate.previewRef}</code>}</p>
        {onOpenMaterial&&<button type="button" className="fb-evidence-open" onClick={()=>void open({subjectRef:candidate.candidateRef,label:candidate.label})}>Open native material</button>}
      </article>;
    })}
  </section>;
}
/** One claim with its evidence directly beneath it — the claim/evidence
 * relation is the only one that matters in review, so it is never broken
 * across columns. */
function Claim({claim,evidence,onOpenEvidence}:{claim:ClaimView;evidence:EvidenceView[];onOpenEvidence?:(ref:string)=>void}) {
  return <article className="fb-claim-reading"><span className={`fb-status fb-claim-${claim.status}`}>{claim.status}</span><p>{claim.statement}</p>
    {claim.evidenceRefs.length?<div className="fb-claim-evidence">{claim.evidenceRefs.map(ref=>{const reading=evidence.find(item=>item.evidenceRef===ref);return reading?<Evidence key={ref} evidence={reading} onOpen={onOpenEvidence?()=>onOpenEvidence(ref):undefined}/>:<Unresolved key={ref} kind="Evidence" reference={ref}/>})}</div>:<p className="fb-muted fb-claim-unsupported">No evidence supports this claim yet.</p>}
    <p className="fb-ref-line"><code>{claim.claimRef}</code></p>
  </article>;
}
function Evidence({evidence,onOpen}:{evidence:EvidenceView;onOpen?:()=>void}) {
  return <div className="fb-evidence-inline"><h4>{onOpen?<button className="fb-evidence-open" type="button" onClick={onOpen}>{evidence.label}</button>:evidence.label}</h4><p>{evidence.assessment??"No assessment recorded."}</p></div>;
}
function Unresolved({kind,reference}:{kind:string;reference:string}) {return <article className="fb-evidence-inline fb-unresolved"><p>{kind} is referenced, but its reading is unavailable.</p><p className="fb-ref-line"><code>{reference}</code></p></article>;}
