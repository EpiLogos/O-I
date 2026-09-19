/**
 * The material reading for one produced Factory subject (Candidate or
 * Evidence), ported from the donor cut (PR #292 FactoryMaterialSurface.tsx)
 * into the Desk's design language.
 *
 * The reading is the owner's record and nothing else: production paths read
 * the owner's build view (`factory_build_snapshot`, the op this kernel
 * carries) and admit it only through the owner validators in
 * factory-material-reading.ts; opaque references stay disclosed references.
 * The donor read the same document through a `build` development read — that
 * read spelling is not carried by this kernel cut, so the surface reads
 * through the build snapshot op the Desk already uses, with the project ref
 * the Desk's own source disclosure carries.
 *
 * Retained presentation snapshots (factory-review-snapshot.ts) keep the
 * reviewed basis bounded and restorable: reopening the same subject restores
 * the exact retained reading rather than re-reading over a review, and a
 * moved owner revision never silently replaces it — it is offered, then
 * selected explicitly. The labelled dev scenario renders its fixture view
 * through the same presentation with the fixture disclosure — no native read
 * is claimed or performed behind it.
 */
import {useCallback, useEffect, useRef, useState} from "react";
import {useKernel} from "../../kernel/KernelProvider";
import {buildSnapshot} from "./development";
import {selectFactoryMaterial, type FactoryMaterial, type FactoryMaterialBuildReading} from "./factory-material-reading";
import {
  createFactoryMaterialReviewSnapshot, factoryMaterialReview,
  type FactoryMaterialReviewSnapshot,
} from "./factory-review-snapshot";
import type {FactoryBuildView} from "./types";
import "./factory-material-surface.css";

export interface FactoryMaterialSurfaceProps {
  statePath: string;
  projectRef: string;
  runRef: string;
  subjectRef: string;
  /** The owner build revision the Desk's live observation disclosed — binds
   * this view to the exact reviewed revision when present. */
  expectedRevision?: number;
  /** The labelled dev scenario's fixture view: rendered with the fixture
   * disclosure; never a native read claim. */
  fixtureView?: FactoryBuildView;
  onDismiss: () => void;
}

type Selected = Extract<ReturnType<typeof selectFactoryMaterial>, {kind: "selected"}>;
type Reviewed = Selected & {payload?: unknown; reading: FactoryMaterialBuildReading; material: FactoryMaterial};
type Latest = Reviewed | {kind: "refusal"; message: string; reading: FactoryMaterialBuildReading; payload: unknown};

/** Retained review snapshots, bounded by the snapshot module's own byte law.
 * In-memory per Desk session: the Desk holds no binding store, so retention
 * spans presentation changes (closing/reopening the subject) honestly. */
const reviewStore = new Map<string, {snapshot?: FactoryMaterialReviewSnapshot; snapshotUnavailable?: string}>();
const storeKey = (statePath: string, runRef: string, subjectRef: string) => [statePath, runRef, subjectRef].join("\u0000");

export function FactoryMaterialSurface({statePath, projectRef, runRef, subjectRef, expectedRevision, fixtureView, onDismiss}: FactoryMaterialSurfaceProps) {
  const kernel = useKernel();
  const [reviewed, setReviewed] = useState<Reviewed>();
  const [latest, setLatest] = useState<Latest>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const request = useRef(0), mounted = useRef(true), sourceIdentity = useRef(""), reviewedRef = useRef<Reviewed>();
  const identity = [statePath, runRef, subjectRef].join("\u0000");
  const expected = {statePath, runRef, subjectRef};
  const fixture = fixtureView && fixtureView.run.runRef === runRef ? fixtureView : undefined;

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; request.current += 1; }; }, []);
  const current = useCallback((generation: number) => mounted.current && request.current === generation, []);

  const retain = useCallback((selection: Reviewed): string | undefined => {
    const payload = selection.payload ?? selection.reading;
    const captured = createFactoryMaterialReviewSnapshot(payload, expected);
    const held = captured
      ? {snapshot: captured}
      : {snapshotUnavailable: "This Factory material remains visible here, but it cannot be retained across presentation changes. Refresh explicitly to read the current Factory state."};
    reviewStore.set(storeKey(statePath, runRef, subjectRef), held);
    return captured ? undefined : held.snapshotUnavailable;
  }, [expected.statePath, expected.runRef, expected.subjectRef, runRef, statePath, subjectRef]);

  const acceptLatest = useCallback(() => {
    if (!latest || latest.kind !== "selected") return;
    const generation = request.current;
    setAccepting(true);
    const notice = retain(latest);
    if (!current(generation)) return;
    reviewedRef.current = latest;
    setReviewed(latest); setLatest(undefined); setError(notice); setAccepting(false);
  }, [current, latest, retain]);

  const read = useCallback(async () => {
    const generation = ++request.current;
    if (current(generation)) { setBusy(true); setError(undefined); }
    try {
      const payload = await buildSnapshot(kernel.transport, statePath, projectRef, runRef);
      if (!current(generation)) return;
      const result = selectFactoryMaterial(payload, runRef, subjectRef);
      const reading = result.reading;
      if (!reading) { setError(result.kind === "refusal" ? result.message : "Factory did not return a material reading."); return; }
      const retained: Latest = result.kind === "selected" ? {...result, payload} : {kind: "refusal", message: result.message, reading, payload};
      if (expectedRevision !== undefined && reading.revision !== expectedRevision && reviewedRef.current?.reading.revision !== reading.revision) {
        setLatest(retained);
        setError(`Factory returned Build revision ${reading.revision}; this material view is bound to revision ${expectedRevision}.`);
        return;
      }
      if (result.kind === "refusal") {
        if (reviewedRef.current && reviewedRef.current.reading.revision !== reading.revision) setLatest(retained);
        setError(result.message); return;
      }
      const selected = retained as Reviewed;
      if (!reviewedRef.current) {
        reviewedRef.current = selected; setReviewed(selected);
        const notice = retain(selected);
        if (current(generation) && notice) setError(notice);
        return;
      }
      if (reviewedRef.current.reading.revision === reading.revision) { setLatest(undefined); return; }
      setLatest(retained);
    } catch (reason) {
      if (current(generation)) setError(`Factory material read unavailable: ${reason instanceof Error && reason.message ? reason.message : String(reason)}`);
    } finally {
      if (current(generation)) setBusy(false);
    }
  }, [current, expectedRevision, kernel.transport, projectRef, retain, runRef, statePath, subjectRef]);

  useEffect(() => {
    const changed = sourceIdentity.current !== identity;
    sourceIdentity.current = identity;
    if (changed) {
      request.current += 1;
      reviewedRef.current = undefined;
      setReviewed(undefined); setLatest(undefined); setError(undefined); setAccepting(false);
    }
    if (fixture) return; // the labelled scenario view renders directly — no native read, no retained snapshot claim
    const held = reviewStore.get(identity);
    const snapshot = held?.snapshot;
    const restored = snapshot ? factoryMaterialReview(snapshot, expected) : undefined;
    if (snapshot && restored && (expectedRevision === undefined || restored.reading.revision === expectedRevision)) {
      const reviewedSnapshot = {...restored, payload: snapshot.payload};
      reviewedRef.current = reviewedSnapshot;
      setReviewed(reviewedSnapshot); setLatest(undefined); setError(undefined); setBusy(false);
    } else if (held && (held.snapshot || held.snapshotUnavailable)) {
      setError(held.snapshotUnavailable ?? "The retained Factory material cannot be restored for this revision. Refresh explicitly to read current Factory state.");
      setBusy(false);
    } else void read();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identity, expectedRevision, fixture, read]);

  // The labelled dev scenario path: presentation over the fixture view only.
  const fixtureSelection = fixture ? fixtureSelectionOf(fixture, subjectRef) : undefined;

  return <section className="desk-material-surface" aria-label="Factory material" data-fixture={fixture ? "true" : undefined}>
    <header className="desk-material-toolbar">
      <p>Factory material</p>
      <div className="desk-material-toolbar-actions">
        {!fixture && <button type="button" onClick={() => void read()} disabled={busy || accepting}>{busy ? "Reading…" : "Refresh native read"}</button>}
        <button type="button" onClick={onDismiss}>Close</button>
      </div>
    </header>
    <details className="desk-material-basis"><summary>Read basis</summary><dl>
      <div><dt>Run</dt><dd><code>{runRef}</code></dd></div>
      <div><dt>Selected subject</dt><dd><code>{subjectRef}</code></dd></div>
      {expectedRevision !== undefined && !fixture && <div><dt>Bound Build revision</dt><dd>{expectedRevision}</dd></div>}
      {fixture && <div><dt>Basis</dt><dd>labelled dev scenario — no native read behind this view</dd></div>}
    </dl></details>
    {fixture && <p className="desk-material-fixture-note">Dev scenario — this material is the labelled fixture Run's own view; no native Factory read stands behind it.</p>}
    {error && <p className="desk-material-refusal" role="alert">{error}</p>}
    {fixture && (fixtureSelection
      ? (fixtureSelection.kind === "selected"
        ? <article className="desk-material-document">
          <header className="desk-material-document-head">
            <p className="desk-material-kicker">{fixtureSelection.material.kind === "candidate" ? "Candidate" : "Evidence"} · dev scenario</p>
            <h4>{fixtureSelection.material.kind === "candidate" ? fixtureSelection.material.candidate.label : fixtureSelection.material.evidence.label}</h4>
            <p className="desk-material-outcome">{fixtureSelection.material.kind === "candidate"
              ? `Candidate revision ${fixtureSelection.material.candidate.revision} · ${fixtureSelection.material.candidate.status} · labelled fixture view`
              : fixtureSelection.material.evidence.assessment ?? "Factory retained this Evidence without an assessment."}</p>
          </header>
          <MaterialBody material={fixtureSelection.material}/>
        </article>
        : <p className="desk-material-refusal" role="alert">{fixtureSelection.message}</p>)
      : null)}
    {!fixture && latest && <LatestRevision reading={latest} expectedRevision={expectedRevision} accepting={accepting} onSelect={acceptLatest}/>}
    {!fixture && (reviewed
      ? <ReviewedBody reviewed={reviewed}/>
      : !error && !busy && !latest && <p className="desk-material-empty">No Factory material is currently selected.</p>)}
  </section>;
}

/** The fixture view selection — resolves the subject inside the scenario's
 * own view, or refuses honestly that the scenario did not retain it. */
function fixtureSelectionOf(view: FactoryBuildView, subjectRef: string): {kind: "selected"; material: FactoryMaterial} | {kind: "refusal"; message: string} | undefined {
  const candidate = view.candidates.find(item => item.candidateRef === subjectRef);
  if (candidate) return {kind: "selected", material: {kind: "candidate", candidate, claims: candidate.claimRefs.map(ref => ({ref, claim: view.claims.find(item => item.claimRef === ref)})), evidence: [...new Set([...candidate.evidenceRefs, ...candidate.claimRefs.flatMap(ref => view.claims.find(item => item.claimRef === ref)?.evidenceRefs ?? [])])].map(ref => ({ref, evidence: view.evidence.find(item => item.evidenceRef === ref)}))}};
  const evidence = view.evidence.find(item => item.evidenceRef === subjectRef);
  if (evidence) return {kind: "selected", material: {kind: "evidence", evidence}};
  return {kind: "refusal", message: `The dev scenario Run does not retain Candidate or Evidence ${subjectRef}.`};
}

function ReviewedBody({reviewed}:{reviewed:Reviewed}) {
  const {reading, material} = reviewed;
  return <article className="desk-material-document">
    <header className="desk-material-document-head">
      <p className="desk-material-kicker">{material.kind === "candidate" ? "Candidate" : "Evidence"}</p>
      <h4>{material.kind === "candidate" ? material.candidate.label : material.evidence.label}</h4>
      <p className="desk-material-outcome">{material.kind === "candidate" ? `Candidate revision ${material.candidate.revision} · ${material.candidate.status}` : material.evidence.assessment ?? "Factory retained this Evidence without an assessment."}</p>
    </header>
    <MaterialBody material={material}/>
    <details className="desk-material-provenance"><summary>Provenance and basis</summary><dl>
      <div><dt>Build contract</dt><dd><code>{reading.contract}</code></dd></div>
      <div><dt>Build revision</dt><dd>{reading.revision}</dd></div>
      <div><dt>Factory state revision</dt><dd>{reading.factoryStateRevision}</dd></div>
      <div><dt>Run revision</dt><dd>{reading.runRevision}</dd></div>
      <div><dt>Run Map revision</dt><dd>{reading.runMapRevision}</dd></div>
      <div><dt>Factory source</dt><dd><code>{reading.provenanceSource}</code></dd></div>
      <div><dt>Project</dt><dd><code>{reading.project.projectRef}</code></dd></div>
      <div><dt>Run Map</dt><dd><code>{reading.run.runMapRef}</code></dd></div>
    </dl></details>
  </article>;
}

function LatestRevision({reading, expectedRevision, accepting, onSelect}:{reading:Latest; expectedRevision?:number; accepting:boolean; onSelect:()=>void}) {
  const revision = reading.reading.revision;
  const identity = reading.kind === "selected" ? (reading.material.kind === "candidate" ? reading.material.candidate.label : reading.material.evidence.label) : undefined;
  return <aside className="desk-material-latest" aria-label="Different Factory Build reading">
    <div>
      <strong>A different native Build revision is available</strong>
      <p>Revision {revision}{identity ? ` contains ${identity}.` : " was returned for this material."} It has not replaced the revision under review.</p>
      {expectedRevision !== undefined && expectedRevision !== revision && <small>Bound revision: {expectedRevision}</small>}
    </div>
    {reading.kind === "selected"
      ? <button type="button" onClick={onSelect} disabled={accepting}>{accepting ? "Selecting…" : `Review revision ${revision}`}</button>
      : <p className="desk-material-latest-refusal">The returned revision cannot be selected: {reading.message}</p>}
  </aside>;
}

/** The disclosed body of one material subject — claims with their standing,
 * linked evidence with their assessments or their honest absence. Opaque
 * references remain references. */
function MaterialBody({material}:{material:FactoryMaterial}) {
  if (material.kind === "evidence") return <div className="desk-material-body">
    <p>{material.evidence.assessment ?? "Factory retained this Evidence without an assessment."}</p>
    <Reference summary="Evidence identity" value={material.evidence.evidenceRef}/>
    {material.evidence.producingExecutionRef && <Reference summary="Producing execution" value={material.evidence.producingExecutionRef}/>}
    {material.evidence.nativeRef && <Reference summary="Native source" value={material.evidence.nativeRef}/>}
  </div>;
  return <div className="desk-material-body">
    {!!material.candidate.tradeoffs?.length && <section><h5>Tradeoffs</h5><ul>{material.candidate.tradeoffs.map((tradeoff, index) => <li key={tradeoff + index}>{tradeoff}</li>)}</ul></section>}
    <section><h5>Claims</h5>{material.claims.length > 0 ? <div className="desk-material-claims">{material.claims.map(item => item.claim
      ? <article key={item.ref}><header><span>{item.claim.status}</span></header><p>{item.claim.statement}</p><Reference summary="Claim identity" value={item.claim.claimRef}/>{item.claim.evidenceRefs.length > 0 && <ReferenceList summary={`Linked Evidence references (${item.claim.evidenceRefs.length})`} values={item.claim.evidenceRefs}/>}</article>
      : <Unavailable key={item.ref} kind="Claim" value={item.ref}/>)}</div> : <p>Factory retained no claims for this Candidate.</p>}</section>
    <section><h5>Linked Evidence</h5>{material.evidence.length > 0 ? <div className="desk-material-evidence">{material.evidence.map(item => item.evidence
      ? <article key={item.ref}><h6>{item.evidence.label}</h6><p>{item.evidence.assessment ?? "Factory retained this Evidence without an assessment."}</p><Reference summary="Evidence identity" value={item.evidence.evidenceRef}/>{item.evidence.producingExecutionRef && <Reference summary="Producing execution" value={item.evidence.producingExecutionRef}/>}</article>
      : <Unavailable key={item.ref} kind="Evidence" value={item.ref}/>)}</div> : <p>Factory retained no linked Evidence for this Candidate.</p>}</section>
    <details className="desk-material-provenance"><summary>Candidate basis</summary><dl>
      <div><dt>Candidate revision</dt><dd>{material.candidate.revision}</dd></div>
      <div><dt>Status</dt><dd>{material.candidate.status}</dd></div>
      <div><dt>Candidate</dt><dd><code>{material.candidate.candidateRef}</code></dd></div>
    </dl>{material.candidate.producingExecutionRefs.length > 0 && <ReferenceList summary={`Producing executions (${material.candidate.producingExecutionRefs.length})`} values={material.candidate.producingExecutionRefs}/>}</details>
  </div>;
}

function Unavailable({kind, value}:{kind:string; value:string}) {
  return <article className="desk-material-unavailable"><p>{kind} is referenced but unavailable in this Factory Build reading.</p><Reference summary={`${kind} reference`} value={value}/></article>;
}
function Reference({summary, value}:{summary:string; value:string}) {
  return <details className="desk-material-reference"><summary>{summary}</summary><code>{value}</code></details>;
}
function ReferenceList({summary, values}:{summary:string; values:string[]}) {
  return <details className="desk-material-reference"><summary>{summary}</summary><ul>{values.map(value => <li key={value}><code>{value}</code></li>)}</ul></details>;
}
