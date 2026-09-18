/**
 * The Factory sidebar's Context plane (FACTORY-UI-INTEGRATION-HANDOFF §5):
 * the scoped material field beside the run — Sources going in, Produced
 * material coming back, and the small "Needs you" subset of genuine
 * human-directed returns with their actual native state.
 *
 * Real seams used where they exist: Central's receiving operations are read
 * directly for Needs you (same native reference the Inbox shows); produced
 * candidates of the centre's real build view open verbatim through the
 * panel-inspect hand-off. Everything else in dev comes from the labelled
 * fixture, whose controls mutate only the fixture.
 */
import {useEffect, useState} from "react";
import {Glyph} from "../../../workspace/Glyph";
import {useKernel} from "../../../kernel/KernelProvider";
import {receiving, type ReceivingPage, type ReturnRow} from "../../../receiving/client";
import {handToPanelInspect} from "../../../agent/planes/panelInspect";
import type {DeskPlaneProps} from "../../../agent/desk/deskTypes";
import {
  acceptReturn, addSource, reuseAsInput, setSourceIncluded,
  useFactoryFixture, useFactorySelection, type FactoryPanelHost, type FixtureCandidate,
} from "./sidebarModel";
import "./sidebar.css";
import {ScenarioBar} from "./ScenarioBar";

export function ContextPlane({subject}: DeskPlaneProps & {host?: FactoryPanelHost}) {
  const kernel = useKernel();
  const fixture = useFactoryFixture();
  const selection = useFactorySelection();
  const [returns, setReturns] = useState<ReturnRow[]>();
  const [returnsError, setReturnsError] = useState<string>();
  const project = subject.project;

  // The real receiving read — the same native reference the Inbox shows.
  // Failure is quiet absence here (the tray law), spoken once, never empty-success.
  useEffect(() => {
    if (!project || fixture?.returns.length) return;
    let live = true;
    receiving<ReceivingPage>(kernel.transport, project, {kind: "list", limit: 20})
      .then(page => { if (live) { setReturns(page.returns); setReturnsError(undefined); } })
      .catch(reason => { if (live) { setReturns([]); setReturnsError(String(reason)); } });
    return () => { live = false; };
  }, [project, kernel.transport, fixture?.returns.length]);

  const fixtureCandidates = fixture?.run?.candidates;
  const realCandidates = !fixtureCandidates && selection?.view ? selection.view.candidates : [];
  const sources = fixture?.sources;
  const realView = !fixture && selection?.view;

  return <div className="desk-plane factory-side" data-plane="Context" data-fixture={fixture ? fixture.scenario : undefined}>
    <ScenarioBar />
    {fixture && <p className="factory-side-fixture" role="note">{`Fixture — not native data · scenario “${fixture.scenario}”`}</p>}

    {/* --- Needs you: genuine human-directed returns ------------------------*/}
    <section className="factory-side-group" aria-label="Needs you">
      <h4><Glyph name="verify" size={12} /> Needs you</h4>
      {fixture?.returns.length
        ? fixture.returns.map(entry => <div key={entry.ref} className="factory-side-return" data-return-state={entry.state}>
          <p><strong>{entry.subject}</strong></p>
          <small>from {entry.from} · native {entry.native}{entry.runRef ? ` · ${entry.runRef}` : ""} · {entry.state}</small>
          <details className="oi-disclosure"><summary>Open the body</summary><pre>{entry.body}</pre></details>
          {entry.state === "pending review" && <div className="oi-action-group">
            <button className="oi-action" onClick={() => acceptReturn(entry.ref)}>Mark included (fixture)</button>
            <small className="factory-side-gap">Real receiving acts stay in Central's native receiving — arrival never auto-accepts.</small>
          </div>}
        </div>)
        : returns && returns.length
          ? returns.map(entry => <div key={entry.return_ref} className="factory-side-return" data-return-state={entry.status}>
            <p><strong>{entry.document_id}</strong></p>
            <small>rev {entry.revision} · {entry.status} · received {new Date(entry.received_at_unix_seconds * 1000).toLocaleString()}</small>
            <div className="oi-action-group">
              <button className="oi-action" onClick={() => void openReturn(kernel.transport, project!, entry, setReturnsError)}>Open reading</button>
            </div>
          </div>)
          : <p className="oi-note">{returnsError ? "Central receiving is not reachable from this project — the tray stays quiet rather than pretending." : returns ? "Nothing is waiting on you. Ordinary progress never becomes an Inbox item." : "Reading the project's receiving state…"}</p>}
    </section>

    {/* --- Sources: what goes in --------------------------------------------*/}
    <section className="factory-side-group" aria-label="Sources">
      <h4>Sources</h4>
      {sources && (sources.length
        ? <ul className="factory-side-rows">
          {sources.map(source => <li key={source.ref} data-source-included={source.included}>
            <button className="factory-side-row" onClick={() => handToPanelInspect({kind: `source-${source.kind}`, ref: source.ref, title: source.title, payload: source.body ?? source.detail ?? "No body was carried for this reference.", source: "Context"})}>
              <Glyph name={source.kind === "link" ? "link" : source.kind === "pool" ? "material" : "file"} size={12} />
              <span className="factory-side-row-title">{source.title}</span>
              <span className="factory-side-step-meta">{[source.detail, source.included ? "included" : "excluded", source.loadedFor.length ? `loaded for ${source.loadedFor.length}` : "not loaded"].filter(Boolean).join(" · ")}</span>
            </button>
            <div className="oi-action-group">
              <button className="oi-action" onClick={() => setSourceIncluded(source.ref, !source.included)}>{source.included ? "Exclude" : "Include"}</button>
              <button className="oi-action" onClick={() => setSourceIncluded(source.ref, false) /* unlink = selection only */}>Unlink</button>
            </div>
          </li>)}
        </ul>
        : <p className="oi-empty">No sources yet. Add one below — inclusion is per-run here, never a grant to every member.</p>)}
      {!sources && (realView
        ? <p className="oi-note">The centre's build view carries {realView.project.label}; per-act source disclosure appears with the run's own events.</p>
        : <p className="oi-empty">No run selected. Sources appear when the work names what it draws on.</p>)}
      {fixture && <AddSourceForm />}
      <p className="oi-note">Unlinking removes the reference, never the file; availability, selection and what actually loaded stay distinct.</p>
    </section>

    {/* --- Produced: what came back ------------------------------------------*/}
    <section className="factory-side-group" aria-label="Produced">
      <h4>Produced</h4>
      {fixtureCandidates && (fixtureCandidates.length
        ? <CandidateList candidates={fixtureCandidates} onReuse={ref => reuseAsInput(ref)} />
        : <p className="oi-empty">Nothing produced yet. The scenario's “Produce artifact” control adds a partial here, as live work would.</p>)}
      {!fixtureCandidates && (realCandidates.length
        ? <ul className="factory-side-rows">
          {realCandidates.map(candidate => <li key={candidate.candidateRef}>
            <button className="factory-side-row" onClick={() => handToPanelInspect({kind: "factory-candidate", ref: candidate.candidateRef, title: candidate.label, payload: candidate, source: "Context"})}>
              <Glyph name="graph" size={12} />
              <span className="factory-side-row-title">{candidate.label}</span>
              <span className="factory-side-step-meta">{[candidate.status, `rev ${candidate.revision}`].join(" · ")}</span>
            </button>
          </li>)}
        </ul>
        : <p className="oi-empty">{realView ? "The owner's run retains no candidates yet." : "No run selected — produced material appears once the run retains it."}</p>)}
    </section>
  </div>;
}

async function openReturn(transport: Parameters<typeof receiving>[0], project: string, row: ReturnRow, onError: (message: string) => void) {
  try {
    const reading = await receiving<unknown>(transport, project, {kind: "read", return_ref: row.return_ref});
    handToPanelInspect({kind: "central-return", ref: row.return_ref, title: `Return · ${row.document_id}`, payload: reading, source: "Context"});
  } catch (error) { onError(String(error)); }
}

/** Fixture candidates: the actual body opens here; two can be compared
 * side-by-side; reuse-as-input adds a reference, never a copy. */
function CandidateList({candidates, onReuse}: {candidates: FixtureCandidate[]; onReuse?: (ref: string) => void}) {
  const [compare, setCompare] = useState<string[]>([]);
  const toggle = (ref: string) => setCompare(prev => prev.includes(ref) ? prev.filter(existing => existing !== ref) : [...prev, ref].slice(-2));
  const compared = candidates.filter(entry => compare.includes(entry.ref));
  return <>
    <ul className="factory-side-rows">
      {candidates.map(candidate => <li key={candidate.ref} data-candidate-status={candidate.status}>
        <button className="factory-side-row" onClick={() => handToPanelInspect({kind: "fixture-candidate", ref: candidate.ref, title: candidate.label, payload: candidate, source: "Context"})}>
          <Glyph name="diff" size={12} />
          <span className="factory-side-row-title">{candidate.label}</span>
          <span className="factory-side-step-meta">{[candidate.status, candidate.revision, candidate.checkStale ? "check stale" : candidate.check ? "checked" : undefined].filter(Boolean).join(" · ")}</span>
        </button>
        {candidate.git && <small className="factory-side-step-meta">git: {candidate.git.basis} → {candidate.git.target} ({candidate.git.state})</small>}
        <div className="oi-action-group">
          <button className="oi-action" onClick={() => toggle(candidate.ref)}>{compare.includes(candidate.ref) ? "Unselect" : "Select to compare"}</button>
          {onReuse && <button className="oi-action" onClick={() => onReuse(candidate.ref)}>Reuse as input</button>}
        </div>
      </li>)}
    </ul>
    {compared.length === 2 && <div className="factory-side-compare">
      {compared.map(candidate => <div key={candidate.ref} className="factory-side-compare-col">
        <h5>{candidate.label} <small>{candidate.revision}</small></h5>
        <pre>{candidate.body}</pre>
        {candidate.diff && <><h6>Diff</h6><pre>{candidate.diff}</pre></>}
        <small>{candidate.checkStale ? `Check stale — ${candidate.check}` : candidate.check ?? "No check carries"}</small>
      </div>)}
    </div>}
  </>;
}

function AddSourceForm() {
  const [ref, setRef] = useState("");
  const [title, setTitle] = useState("");
  return <form className="factory-side-addsource" onSubmit={event => event.preventDefault()}>
    <div className="factory-side-assign">
      <input className="oi-input" value={ref} onChange={event => setRef(event.target.value)} placeholder="path, link or pool ref…" aria-label="Source reference" />
      <input className="oi-input" value={title} onChange={event => setTitle(event.target.value)} placeholder="title" aria-label="Source title" />
      <button className="oi-action" disabled={!ref.trim()} onClick={() => {
        addSource({ref: ref.trim(), kind: ref.includes("://") ? "link" : "file", title: title.trim() || ref.trim()});
        setRef(""); setTitle("");
      }}>Add source</button>
    </div>
    <small className="oi-note">Held as this view's selection in the fixture — a native source-pool join is a named gap; drag/drop keeps the same seam when it lands.</small>
  </form>;
}
