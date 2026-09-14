import { useState, type ReactNode } from "react";
import type { CandidateView, ClaimView, EvidenceView, FactoryBuildView } from "./types";

/** Selection only follows Factory's exact claim/evidence relations. It never
 * turns an opaque artifact ref into an O:I file, Surface or recognition. */
export function CandidateReading({view,actions}:{view:FactoryBuildView;actions:(candidate:CandidateView)=>ReactNode}) {
  const [selectedRef,setSelectedRef]=useState<string>();
  const selected=view.candidates.find(candidate=>candidate.candidateRef===selectedRef);
  const claims=selected?selected.claimRefs.map(ref=>({ref,reading:view.claims.find(claim=>claim.claimRef===ref)})):view.claims.map(reading=>({ref:reading.claimRef,reading}));
  const evidenceRefs=selected?[...new Set([...selected.evidenceRefs,...claims.flatMap(claim=>claim.reading?.evidenceRefs??[])])]:view.evidence.map(evidence=>evidence.evidenceRef);
  const [focusedEvidence,setFocusedEvidence]=useState<string>();
  const evidence=evidenceRefs.map(ref=>({ref,reading:view.evidence.find(item=>item.evidenceRef===ref)}));
  function choose(ref?:string) { setSelectedRef(ref);setFocusedEvidence(undefined); }
  return <section className="fb-candidate-reading" aria-label="Candidates and evidence">
    <div className="fb-section-head"><h3>Candidates</h3><span>{view.candidates.length} retained</span></div>
    {view.candidates.length>0?<div className="fb-candidate-list" aria-label="Select candidate">
      <button type="button" aria-pressed={!selected} onClick={()=>choose()}>All claims and evidence</button>
      {view.candidates.map(candidate=><button key={candidate.candidateRef} type="button" aria-pressed={selected?.candidateRef===candidate.candidateRef} onClick={()=>choose(candidate.candidateRef)}>
        <strong>{candidate.label}</strong><span className="fb-status">{candidate.status}</span><small>Revision {candidate.revision} · {candidate.claimRefs.length} claims · {candidate.evidenceRefs.length} evidence</small>
      </button>)}
    </div>:<p className="fb-empty">No candidate has been retained for this Run.</p>}
    {selected&&<article className="fb-selected-candidate" aria-label="Selected candidate">
      <div className="fb-card-top"><h3>{selected.label}</h3><span className="fb-status">{selected.status}</span></div>
      {!!selected.tradeoffs?.length&&<><h4>Tradeoffs</h4><ul>{selected.tradeoffs.map(tradeoff=><li key={tradeoff}>{tradeoff}</li>)}</ul></>}
      {actions(selected)}
      <details className="fb-provenance"><summary>Candidate details · revision {selected.revision}</summary>
        <dl><dt>Candidate</dt><dd>{selected.candidateRef}</dd><dt>Producing executions</dt><dd>{selected.producingExecutionRefs.join("\n")||"None recorded"}</dd>
        {!!selected.artifactRefs?.length&&<><dt>Artifacts</dt><dd>{selected.artifactRefs.join("\n")}</dd></>}
        {selected.previewRef&&<><dt>Preview reference</dt><dd>{selected.previewRef}</dd></>}</dl>
      </details>
    </article>}
    <div className="fb-evidence-columns">
      <section aria-label="Candidate claims"><h3>Claims</h3>
        {claims.length?claims.map(({ref,reading})=>reading?<Claim key={ref} claim={reading} evidence={view.evidence} onSelectEvidence={setFocusedEvidence}/>:<Unresolved key={ref} kind="Claim" reference={ref}/>):<p className="fb-muted">No claims recorded{selected?" for this candidate":""}.</p>}
      </section>
      <section aria-label="Candidate evidence"><div className="fb-card-top"><h3>Evidence</h3>{focusedEvidence&&<button type="button" onClick={()=>setFocusedEvidence(undefined)}>Show all</button>}</div>
        {evidence.length?evidence.filter(item=>!focusedEvidence||item.ref===focusedEvidence).map(({ref,reading})=>reading?<Evidence key={ref} evidence={reading}/>:<Unresolved key={ref} kind="Evidence" reference={ref}/>):<p className="fb-muted">No evidence recorded{selected?" for this candidate":""}.</p>}
        {focusedEvidence&&!evidenceRefs.includes(focusedEvidence)&&<Unresolved kind="Evidence" reference={focusedEvidence}/>}
      </section>
    </div>
  </section>;
}
function Claim({claim,evidence,onSelectEvidence}:{claim:ClaimView;evidence:EvidenceView[];onSelectEvidence:(ref:string)=>void}) {
  return <article className="fb-claim-reading"><span className={`fb-status fb-claim-${claim.status}`}>{claim.status}</span><p>{claim.statement}</p>
    {!!claim.evidenceRefs.length&&<div className="fb-evidence-links">{claim.evidenceRefs.map((ref,index)=><button key={ref} type="button" onClick={()=>onSelectEvidence(ref)}>{evidence.find(item=>item.evidenceRef===ref)?.label??`Evidence ${index+1} (reading unavailable)`}</button>)}</div>}
    <details className="fb-provenance"><summary>Claim details</summary><code>{claim.claimRef}</code></details>
  </article>;
}
function Evidence({evidence}:{evidence:EvidenceView}) {
  return <article className="fb-evidence-reading"><h4>{evidence.label}</h4>{evidence.assessment?<p>{evidence.assessment}</p>:<p className="fb-muted">No assessment recorded.</p>}
    <details className="fb-provenance"><summary>Evidence details</summary><dl><dt>Evidence</dt><dd>{evidence.evidenceRef}</dd>{evidence.nativeRef&&<><dt>Native source</dt><dd>{evidence.nativeRef}</dd></>}{evidence.producingExecutionRef&&<><dt>Producing execution</dt><dd>{evidence.producingExecutionRef}</dd></>}</dl></details>
  </article>;
}
function Unresolved({kind,reference}:{kind:string;reference:string}) {return <article className="fb-evidence-reading"><p>{kind} is referenced, but its reading is unavailable.</p><details className="fb-provenance"><summary>Reference</summary><code>{reference}</code></details></article>;}
