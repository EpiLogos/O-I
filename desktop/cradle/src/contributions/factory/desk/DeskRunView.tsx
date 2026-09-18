/**
 * The Desk's full SSSF Run view — the operating face of the selected whole
 * Run (FACTORY-UI-INTEGRATION-HANDOFF §10; #375 Factory commission): the
 * Factory-owned readings of one Run composed over the owner's real data —
 * the SSSF semantic reading (frontier, candidates, claims/evidence, human
 * requests), the live working world (agencies, executions), the Run map
 * (factory.run-reading/v1 through the owner's development read), and the
 * full execution-trace composition (sessions, waterfall, phase detail).
 *
 * This supersedes the captured factory-ui BuildSurface demo as the
 * operating face — that component survives only inside the dev-only
 * development console. Every depth binds the owner's own build view or run
 * reading; nothing here synthesises success. Unwired native actions are not
 * rendered: a control appears when a host callback carries it.
 */
import {useEffect, useRef, useState} from "react";
import {useKernel} from "../../../kernel/KernelProvider";
import {developmentRead} from "../development";
import {ExecutionTraceExplorer} from "../components/ExecutionTraceExplorer";
import {RunMapReading} from "../RunMapReading";
import {runReading, type RunReading} from "../run-reading";
import type {FactoryBuildView} from "../types";
import "../styles.css";
import "../build-surface.css";
import "../factory.css";

export type DeskRunDepth = "trajectory" | "reading" | "live" | "map";

const DEPTHS: readonly {id: DeskRunDepth; label: string; hint: string}[] = [
  {id: "trajectory", label: "Trajectory", hint: "The full multi-lane execution monitor — sessions, waterfall, phase detail"},
  {id: "reading", label: "Reading", hint: "The SSSF semantic reading — frontier, candidates, claims and evidence"},
  {id: "live", label: "Live", hint: "The live working world — agencies and executions as the owner reads them"},
  {id: "map", label: "Map", hint: "The Run map — the owner's run-reading of this Run's work"},
];

function Ref({children}: {children: string}) {
  return <code className="desk-run-ref" title={children}>{children}</code>;
}

export function DeskRunView({view, statePath, runRef}: {
  view: FactoryBuildView;
  /** The owner's developmental state path the Desk read this Run through. */
  statePath: string;
  runRef: string;
}) {
  const kernel = useKernel();
  const [depth, setDepth] = useState<DeskRunDepth>("trajectory");
  const [map, setMap] = useState<RunReading | undefined>();
  const [mapState, setMapState] = useState<"unread" | "reading" | "refused">("unread");
  const [mapError, setMapError] = useState<string | undefined>();
  const generation = useRef(0);

  // The map is read on first entry to its depth — one honest read per Run,
  // never a poll. The owner's validators carry the compatibility law.
  useEffect(() => {
    if (depth !== "map" || map || mapState === "reading") return;
    const gen = ++generation.current;
    setMapState("reading");
    void (async () => {
      try {
        const reading = await developmentRead(kernel.transport, statePath, "run", runRef);
        if (generation.current !== gen) return;
        if (!runReading(reading) || reading.runRef !== runRef) throw new Error("Factory returned an incompatible Run reading");
        setMap(reading); setMapState("unread");
      } catch (reason) {
        if (generation.current !== gen) return;
        setMapState("refused"); setMapError(String(reason instanceof Error ? reason.message : reason));
      }
    })();
    return () => { generation.current += 1; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depth, statePath, runRef, map]);

  return <div className="desk-run-view" aria-label="Run view">
    <nav className="desk-run-depths" aria-label="Run view depth">
      {DEPTHS.map(item => <button key={item.id} type="button" className={depth === item.id ? "is-selected" : ""} title={item.hint} onClick={() => setDepth(item.id)}>{item.label}</button>)}
    </nav>

    {depth === "trajectory" && <div className="desk-run-depth">
      <ExecutionTraceExplorer traces={view.trajectories}/>
    </div>}

    {depth === "reading" && <div className="desk-run-depth desk-run-reading">
      <section className="desk-run-frontier" aria-label="Current frontier">
        <span className="desk-run-kicker">current frontier · {view.frontier.mode}</span>
        <h2>{view.frontier.title}</h2>
        <p>{view.frontier.summary}</p>
        <div className="desk-run-frontier-meta"><Ref>{view.frontier.subjectRef}</Ref><span>closure {view.frontier.closureState ?? "open"}</span><span>gate {view.frontier.gateState ?? "—"}</span></div>
      </section>

      <section aria-label="Candidates">
        <header className="desk-run-section-head"><h3>Candidates</h3><span>{view.candidates.length} possible realities</span></header>
        {view.candidates.length ? <div className="desk-run-candidates">{view.candidates.map(candidate => <article key={candidate.candidateRef}>
          <div className="desk-run-card-top"><strong>{candidate.label}</strong><span className="desk-run-state">{candidate.status}</span></div>
          <Ref>{candidate.candidateRef}</Ref>
          <dl><dt>Executions</dt><dd>{candidate.producingExecutionRefs.map(ref => <Ref key={ref}>{ref}</Ref>)}</dd><dt>Claims</dt><dd>{candidate.claimRefs.length}</dd><dt>Evidence</dt><dd>{candidate.evidenceRefs.length}</dd></dl>
          {candidate.tradeoffs?.length ? <ul>{candidate.tradeoffs.map(item => <li key={item}>{item}</li>)}</ul> : null}
        </article>)}</div> : <p className="oi-note">No candidate is open for this Run.</p>}
      </section>

      <div className="desk-run-two-col">
        <section aria-label="Claims and evidence">
          <header className="desk-run-section-head"><h3>Claims / Evidence</h3><span>contradictions remain visible</span></header>
          {view.claims.length ? view.claims.map(claim => <article key={claim.claimRef} className="desk-run-claim">
            <span className="desk-run-state" data-claim={claim.status}>{claim.status}</span>
            <p>{claim.statement}</p>
            <Ref>{claim.claimRef}</Ref>
            <div>{claim.evidenceRefs.map(ref => <Ref key={ref}>{ref}</Ref>)}</div>
          </article>) : <p className="oi-note">No claim is recorded for this Run.</p>}
        </section>
        <section aria-label="Human requests">
          <header className="desk-run-section-head"><h3>Human requests</h3><span>authorial, not protocol prompts</span></header>
          {view.humanRequests.length ? view.humanRequests.map(request => <article key={request.humanRequestRef} className="desk-run-request">
            <strong>{request.question}</strong>
            <p>{request.whyHuman}</p>
            <Ref>{request.decisionRef}</Ref>
          </article>) : <p className="oi-note">No durable human authorship request is open.</p>}
        </section>
      </div>
    </div>}

    {depth === "live" && <div className="desk-run-depth desk-run-live">
      <header className="desk-run-section-head"><h3>Live working world</h3><span>read-only projection of external owners</span></header>
      <div className="desk-run-live-grid">
        {view.agencies.map(agency => <article key={agency.agencyRef}>
          <span className="desk-run-kicker">{agency.position ?? "local"} agency</span>
          <h4>{agency.label}</h4>
          <Ref>{agency.agencyRef}</Ref>
          <p>Agent <Ref>{agency.agentRef}</Ref></p>
          {agency.rootScopeRef ? <p>Root scope <Ref>{agency.rootScopeRef}</Ref></p> : null}
          {agency.actuationRef ? <p>Actuation <Ref>{agency.actuationRef}</Ref></p> : null}
          {agency.returnRef ? <p>Return <Ref>{agency.returnRef}</Ref> · {agency.returnState}</p> : null}
        </article>)}
        {view.executions.map(execution => <article key={execution.executionRef}>
          <span className="desk-run-kicker">execution</span>
          <div className="desk-run-card-top"><Ref>{execution.executionRef}</Ref><span className="desk-run-state" data-status={execution.status}>{execution.status}</span></div>
          <p>Harness <Ref>{execution.harnessRef ?? "unavailable"}</Ref></p>
          {execution.harnessCompositionRef ? <p>Body <Ref>{execution.harnessCompositionRef}</Ref></p> : <p className="desk-run-muted">No rich harness composition supplied.</p>}
          {execution.agentSessionRef ? <p>Session <Ref>{execution.agentSessionRef}</Ref></p> : null}
          {execution.sessionSpaceRef ? <p>SessionSpace <Ref>{execution.sessionSpaceRef}</Ref></p> : <p className="desk-run-muted">SessionSpace unavailable / not yet bound.</p>}
        </article>)}
        {view.agencies.length + view.executions.length === 0 ? <p className="oi-note">The owner's live reading disclosed no agency or execution for this Run.</p> : null}
      </div>
    </div>}

    {depth === "map" && <div className="desk-run-depth desk-run-map">
      {mapState === "reading" && <p className="oi-note" role="status">Reading the owner's Run map…</p>}
      {mapState === "refused" && <p className="oi-note" role="alert">The owner refused this Run's map reading: {mapError}</p>}
      {map && <RunMapReading reading={map}/>}
      {!map && mapState === "unread" && <p className="oi-note">The Run map has not been read.</p>}
    </div>}
  </div>;
}
