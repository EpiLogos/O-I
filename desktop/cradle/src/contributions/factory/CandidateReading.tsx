/**
 * The produced-material subject browser, ported from the donor cut (PR #292
 * CandidateReading.tsx) into the Desk's design language. Selection only
 * follows Factory's exact claim/evidence relations; it never turns an opaque
 * artifact ref into an O:I file, Surface or recognition. Opening a subject
 * hands the Desk the owner's own ref — the material reading that follows is
 * the owner's record, or the labelled scenario view in the dev fixture.
 */
import {useRef, useState} from "react";
import type {ClaimView, EvidenceView, FactoryBuildView, FactoryMaterialSelection} from "./types";

export function CandidateReading({view, onOpenMaterial, openError}: {
  view: FactoryBuildView;
  /** Opens one produced subject in the material reading. */
  onOpenMaterial?: (selection: FactoryMaterialSelection) => void | Promise<void>;
  openError?: string;
}) {
  const [selectedRef, setSelectedRef] = useState<string>();
  const selected = view.candidates.find(candidate => candidate.candidateRef === selectedRef);
  const claims = selected
    ? selected.claimRefs.map(ref => ({ref, reading: view.claims.find(claim => claim.claimRef === ref)}))
    : view.claims.map(reading => ({ref: reading.claimRef, reading}));
  const evidenceRefs = selected
    ? [...new Set([...selected.evidenceRefs, ...claims.flatMap(claim => claim.reading?.evidenceRefs ?? [])])]
    : view.evidence.map(evidence => evidence.evidenceRef);
  const [focusedEvidence, setFocusedEvidence] = useState<string>();
  const evidence = evidenceRefs.map(ref => ({ref, reading: view.evidence.find(item => item.evidenceRef === ref)}));
  const openGeneration = useRef(0);
  const open = async (selection: FactoryMaterialSelection) => {
    if (!onOpenMaterial) return;
    const generation = ++openGeneration.current;
    try { await onOpenMaterial(selection); }
    catch { if (generation === openGeneration.current) setSelectedRef(undefined); /* the caller discloses its own failure */ }
  };
  const choose = (ref?: string) => {
    setSelectedRef(ref); setFocusedEvidence(undefined);
    const candidate = view.candidates.find(item => item.candidateRef === ref);
    if (candidate) void open({subjectRef: candidate.candidateRef, label: candidate.label});
  };
  const chooseEvidence = (ref: string) => {
    setFocusedEvidence(ref);
    const reading = view.evidence.find(item => item.evidenceRef === ref);
    if (reading) void open({subjectRef: ref, label: reading.label});
  };
  return <section className="desk-material-browser" aria-label="Candidates and evidence">
    {openError && <p className="desk-material-note" role="alert">{openError}</p>}
    <div className="desk-material-section-head"><h3>Candidates</h3><span>{view.candidates.length} retained</span></div>
    {view.candidates.length > 0 ? <div className="desk-material-candidate-list" aria-label="Select candidate">
      <button type="button" aria-pressed={!selected} onClick={() => choose()}>All claims and evidence</button>
      {view.candidates.map(candidate => <button key={candidate.candidateRef} type="button" aria-pressed={selected?.candidateRef === candidate.candidateRef} onClick={() => choose(candidate.candidateRef)}>
        <strong>{candidate.label}</strong><span className="desk-material-status">{candidate.status}</span>
        <small>Revision {candidate.revision} · {candidate.claimRefs.length} claims · {candidate.evidenceRefs.length} evidence</small>
      </button>)}
    </div> : <p className="desk-material-muted">No candidate has been retained for this Run.</p>}
    {selected && <article className="desk-material-selected" aria-label="Selected candidate">
      <div className="desk-material-card-top"><h4>{selected.label}</h4><span className="desk-material-status">{selected.status}</span></div>
      {!!selected.tradeoffs?.length && <><h5>Tradeoffs</h5><ul>{selected.tradeoffs.map(tradeoff => <li key={tradeoff}>{tradeoff}</li>)}</ul></>}
      <details className="desk-material-provenance"><summary>Candidate details · revision {selected.revision}</summary>
        <dl><dt>Candidate</dt><dd><code>{selected.candidateRef}</code></dd><dt>Producing executions</dt><dd>{selected.producingExecutionRefs.join("\n") || "None recorded"}</dd>
          {!!selected.artifactRefs?.length && <><dt>Artifacts</dt><dd>{selected.artifactRefs.join("\n")}</dd></>}
          {selected.previewRef && <><dt>Preview reference</dt><dd><code>{selected.previewRef}</code></dd></>}</dl>
      </details>
    </article>}
    <div className="desk-material-columns">
      <section aria-label="Candidate claims"><h5>Claims</h5>
        {claims.length ? claims.map(({ref, reading}) => reading
          ? <Claim key={ref} claim={reading} evidence={view.evidence} onSelectEvidence={chooseEvidence}/>
          : <Unresolved key={ref} kind="Claim" reference={ref}/>)
          : <p className="desk-material-muted">No claims recorded{selected ? " for this candidate" : ""}.</p>}
      </section>
      <section aria-label="Candidate evidence"><div className="desk-material-card-top"><h5>Evidence</h5>{focusedEvidence && <button type="button" className="desk-material-showall" onClick={() => setFocusedEvidence(undefined)}>Show all</button>}</div>
        {evidence.length ? evidence.filter(item => !focusedEvidence || item.ref === focusedEvidence).map(({ref, reading}) => reading
          ? <Evidence key={ref} evidence={reading} onOpen={onOpenMaterial ? () => void open({subjectRef: ref, label: reading.label}) : undefined}/>
          : <Unresolved key={ref} kind="Evidence" reference={ref}/>)
          : <p className="desk-material-muted">No evidence recorded{selected ? " for this candidate" : ""}.</p>}
        {focusedEvidence && !evidenceRefs.includes(focusedEvidence) && <Unresolved kind="Evidence" reference={focusedEvidence}/>}
      </section>
    </div>
  </section>;
}

function Claim({claim, evidence, onSelectEvidence}:{claim:ClaimView;evidence:EvidenceView[];onSelectEvidence:(ref:string)=>void}) {
  return <article className="desk-material-claim"><span className={`desk-material-status desk-claim-${claim.status}`}>{claim.status}</span><p>{claim.statement}</p>
    {!!claim.evidenceRefs.length && <div className="desk-material-evidence-links">{claim.evidenceRefs.map((ref, index) =>
      <button key={ref} type="button" onClick={() => onSelectEvidence(ref)}>{evidence.find(item => item.evidenceRef === ref)?.label ?? `Evidence ${index + 1} (reading unavailable)`}</button>)}</div>}
    <details className="desk-material-provenance"><summary>Claim details</summary><code>{claim.claimRef}</code></details>
  </article>;
}

function Evidence({evidence,onOpen}:{evidence:EvidenceView;onOpen?:()=>void}) {
  return <article className="desk-material-evidence"><h6>{onOpen ? <button className="desk-material-evidence-open" type="button" onClick={onOpen}>{evidence.label}</button> : evidence.label}</h6>
    {evidence.assessment ? <p>{evidence.assessment}</p> : <p className="desk-material-muted">No assessment recorded.</p>}
    <details className="desk-material-provenance"><summary>Evidence details</summary><dl>
      <dt>Evidence</dt><dd><code>{evidence.evidenceRef}</code></dd>
      {evidence.nativeRef && <><dt>Native source</dt><dd><code>{evidence.nativeRef}</code></dd></>}
      {evidence.producingExecutionRef && <><dt>Producing execution</dt><dd><code>{evidence.producingExecutionRef}</code></dd></>}
    </dl></details>
  </article>;
}

function Unresolved({kind,reference}:{kind:string;reference:string}) {
  return <article className="desk-material-evidence"><p>{kind} is referenced, but its reading is unavailable.</p>
    <details className="desk-material-provenance"><summary>Reference</summary><code>{reference}</code></details></article>;
}
