/**
 * The Factory sidebar's Run plane (FACTORY-UI-INTEGRATION-HANDOFF §4): the
 * selected work at a glance and its live log. The run's state IS the streamed
 * trajectory — never a form to fill. The full multi-lane map stays in the
 * centre; this plane's only chrome is the way there and the panel's full
 * depth. A control with no native operation yet is one quiet line, not an
 * explanation.
 */
import {useState} from "react";
import {Glyph} from "../../../workspace/Glyph";
import {handToPanelInspect} from "../../../agent/planes/panelInspect";
import {TrajectoryPlane} from "../../../agent/desk/TrajectoryPlane";
import type {DeskPlaneProps} from "../../../agent/desk/deskTypes";
import {SessionCards} from "../components/SessionCards";
import {SpanDetail} from "../components/SpanDetail";
import {TraceWaterfall} from "../components/TraceWaterfall";
import {factoryBuildFixture} from "../fixtures/factory-build";
import {
  markArrivalsSeen, refusePermission, resolvePermission, retryStep,
  useFactoryFixture, useFactorySelection, type FactoryPanelHost, type FixtureStep,
} from "./sidebarModel";
import {ScenarioBar} from "./ScenarioBar";
import {SideSection} from "../../../shared/SideSection";
import "./sidebar.css";

const STATUS_GLYPH: Record<string, Parameters<typeof Glyph>[0]["name"]> = {
  queued: "dot", running: "activity", success: "check", fail: "warning", blocked: "stop", cancelled: "stop",
};

export function RunPlane({subject, accompanying, onMessage, host, full, withScenarioBar=true}: DeskPlaneProps & {host?: FactoryPanelHost; full?: boolean; withScenarioBar?: boolean}) {
  const fixture = useFactoryFixture();
  const selection = useFactorySelection();
  const fixtureRun = fixture?.run;
  const view = !fixtureRun ? selection?.view : undefined;
  // The fuller multi-lane monitor (expanded Run): the SSSF optic over the
  // same run the compact view reads — fixture traces in a labelled scenario,
  // the owner's own trajectories when the centre has served a real read.
  const [monitorExecutionRef, setMonitorExecutionRef] = useState<string>();
  const [monitorSpanRef, setMonitorSpanRef] = useState<string>();
  const monitorTraces = fixtureRun ? factoryBuildFixture.trajectories : selection?.view?.trajectories;
  const monitorTrace = monitorTraces?.find(item => item.executionRef === monitorExecutionRef) ?? monitorTraces?.[0];
  const monitorSpan = monitorTrace?.spans.find(span => span.spanRef === monitorSpanRef);
  const runLabel = fixtureRun?.label ?? view?.run.label;
  const state = fixtureRun?.state ?? view?.run.status;
  const nextDecision = fixtureRun?.nextDecision ?? view?.humanRequests[0]?.question;
  const steps: FixtureStep[] | undefined = fixtureRun?.steps;
  const tokens = fixtureRun
    ? fixtureRun.steps.reduce((sum, step) => sum + (step.tokens ?? 0), 0)
    : view?.trajectories.reduce((sum, trace) => sum + (trace.totalTokens ?? 0), 0) ?? 0;
  const decisions = fixtureRun
    ? fixtureRun.steps.filter(step => step.status === "blocked" && step.blockedBy?.startsWith("Permission"))
      .map(step => ({ref: step.ref, question: step.blockedBy!, stepRef: step.ref}))
    : (view?.humanRequests ?? []).map(request => ({ref: request.humanRequestRef, question: request.question, stepRef: undefined}));
  const checks = fixtureRun?.checks ?? (view?.claims ?? []).map(claim => ({
    ref: claim.claimRef, attachedTo: view!.run.runRef, statement: claim.statement,
    state: claim.status as "standing" | "challenged" | "supported" | "superseded", evidence: claim.evidenceRefs,
  }));
  const hasCandidates = (fixtureRun?.candidates.length ?? 0) > 0 || (view?.candidates.length ?? 0) > 0;

  return <div className="desk-plane oi-side-plane" data-plane="Run" data-fixture={fixtureRun ? fixture.scenario : undefined}>
    {withScenarioBar && <ScenarioBar />}

    {/* --- the run: what this work is, where it stands ---------------------- */}
    <div className="oi-side-run" data-run-state={state}>
      {runLabel
        ? <div className="oi-side-run-head">
          <span className="oi-side-run-state"><Glyph name={STATUS_GLYPH[state ?? "queued"] ?? "dot"} size={13} />{state ?? "unknown"}</span>
          <strong>{runLabel}</strong>
        </div>
        : <div className="oi-side-run-head" data-state="none"><strong>No run selected.</strong></div>}
      {fixtureRun && <p className="oi-side-run-purpose">{fixtureRun.purpose}</p>}
      {nextDecision && <p className="oi-side-decision" role="status"><Glyph name="verify" size={12} />{nextDecision}</p>}
      <div className="oi-action-group oi-side-run-actions">
        {host?.onExpandPanel && <button className="oi-action" onClick={host.onExpandPanel} aria-label="Full right region"><Glyph name="expand" size={12} />Expand</button>}
        {host?.onOpenFullRun && <button className="oi-action" onClick={host.onOpenFullRun}><Glyph name="columns" size={12} />Full run</button>}
        {host?.onOpenPlane && hasCandidates && <button className="oi-action" onClick={() => host.onOpenPlane?.("factory-context")}>Compare</button>}
      </div>
    </div>

    {/* --- the fuller multi-lane monitor, only when Run is expanded ----------- */}
    {full && !!(monitorTraces?.length) && <SideSection className="oi-side-monitor" label="Execution monitor">
      {/* The captured optic's styles are scoped under .fb-build-surface — the
        monitor mounts inside that scope so the components render as designed. */}
      <div className="fb-build-surface oi-side-monitor-host">
        <SessionCards traces={monitorTraces!} selectedExecutionRef={monitorTrace?.executionRef} onSelect={ref => {setMonitorExecutionRef(ref); setMonitorSpanRef(undefined);}}/>
        {monitorTrace && <div className="oi-side-monitor-track">
          <TraceWaterfall trace={monitorTrace} selectedSpanRef={monitorSpanRef} onSelectSpan={setMonitorSpanRef}/>
          {monitorSpan && <SpanDetail span={monitorSpan} onClose={() => setMonitorSpanRef(undefined)}/>}
        </div>}
      </div>
    </SideSection>}

    {/* --- decisions: the genuine human attention ---------------------------- */}
    {!!decisions.length && <SideSection label="Decisions">
      {decisions.map(decision => <div key={decision.ref} className="oi-side-decision-row" data-decision={decision.ref}>
        <p>{decision.question}</p>
        <div className="oi-action-group">
          {fixtureRun
            ? <>
              <button className="oi-action" onClick={() => resolvePermission(decision.stepRef ?? decision.ref)}>Permit</button>
              <button className="oi-action" onClick={() => refusePermission(decision.stepRef ?? decision.ref)}>Refuse</button>
            </>
            : <small className="oi-side-gap">Not exposed at the desktop seam yet.</small>}
        </div>
      </div>)}
    </SideSection>}

    {/* --- steps --------------------------------------------------------------- */}
    <SideSection label="Steps">
      {steps && (steps.length
        ? <ul className="oi-side-steps">
          {steps.map(step => <li key={step.ref} data-step-status={step.status}>
            <Glyph name={STATUS_GLYPH[step.status] ?? "dot"} size={12} />
            <span className="oi-side-step-label">{step.label}</span>
            <span className="oi-side-step-meta">{[step.lane, step.assignee, step.attempt && step.attempt > 1 ? `attempt ${step.attempt}` : undefined].filter(Boolean).join(" · ")}</span>
            {(step.blockedBy || step.failedVerification) && <small className="oi-side-barrier" role="status">{step.blockedBy ?? step.failedVerification}</small>}
            <div className="oi-action-group">
              {(step.status === "fail" || step.status === "cancelled") && <button className="oi-action" onClick={() => retryStep(step.ref)}>Retry</button>}
              <button className="oi-action" aria-label={`Inspect ${step.label}`} onClick={() => handToPanelInspect({kind: "factory-step", ref: step.ref, title: step.label, payload: step, source: "Run"})}>Inspect</button>
            </div>
          </li>)}
        </ul>
        : <p className="oi-empty">No steps yet.</p>)}
      {!steps && (view?.executions.length
        ? <ul className="oi-side-steps">
          {view.executions.map(execution => <li key={execution.executionRef} data-step-status={execution.status}>
            <Glyph name={STATUS_GLYPH[execution.status] ?? "dot"} size={12} />
            <span className="oi-side-step-label">{execution.agencyRef ?? "Execution"}</span>
            <span className="oi-side-step-meta">{[execution.status, execution.harnessRef].filter(Boolean).join(" · ")}</span>
            <div className="oi-action-group">
              <button className="oi-action" onClick={() => handToPanelInspect({kind: "factory-execution", ref: execution.executionRef, title: `execution ${execution.executionRef}`, payload: execution, source: "Run"})}>Inspect</button>
            </div>
          </li>)}
        </ul>
        : <p className="oi-empty">{view ? "No executions." : "No steps yet."}</p>)}
    </SideSection>

    {/* --- the live log: the run's state, streamed ------------------------------ */}
    <SideSection className="oi-side-trajectory" label="Activity">
      {fixtureRun
        ? <FixtureTrajectory rows={fixtureRun.trajectory} arrivals={fixtureRun.arrivals ?? 0} />
        : accompanying
          ? <div className="oi-side-embed"><TrajectoryPlane subject={subject} accompanying={accompanying} onMessage={onMessage} /></div>
          : <p className="oi-empty">No conversation bound.</p>}
    </SideSection>

    {/* --- checks attached to the work ------------------------------------------- */}
    {!!checks.length && <SideSection label="Checks">
      <ul className="oi-side-checks">
        {checks.map(check => <li key={check.ref} data-check-state={check.state}>
          <Glyph name={check.state === "supported" ? "check" : check.state === "challenged" ? "warning" : "report"} size={12} />
          <span>{check.statement}</span>
          <small>{[check.state, ...check.evidence].join(" · ")}</small>
        </li>)}
      </ul>
    </SideSection>}

    {/* --- metrics: one quiet line ------------------------------------------------- */}
    {tokens > 0 && <section className="oi-side-section" aria-label="Metrics">
      <p className="oi-side-metrics">Tokens (reported): {tokens.toLocaleString()}</p>
    </section>}
  </div>;
}

/** The trajectory: coalesced rows, expandable detail, held view with a
 * visible arrivals count and an explicit resume — the paused-follow law. */
function FixtureTrajectory({rows, arrivals}: {rows: {id: number; kind: string; label: string; detail: string; agent?: string}[]; arrivals: number}) {
  const [expanded, setExpanded] = useState<number[]>([]);
  const [held, setHeld] = useState(false);
  const shown = held && arrivals > 0 ? rows.slice(0, rows.length - arrivals) : rows;
  return <div className="oi-side-traj">
    <div className="oi-side-traj-strip" data-paused={held || arrivals > 0 ? "true" : "false"}>
      <span>{arrivals > 0 ? `${arrivals} new` : "Live"}</span>
      {arrivals > 0 && <button className="oi-action" onClick={() => { markArrivalsSeen(); setHeld(false); }}>Resume</button>}
      {!held && arrivals === 0 && <button className="oi-action" onClick={() => setHeld(true)}>Hold</button>}
    </div>
    <ul className="oi-side-traj-list">
      {shown.map(row => <li key={row.id} data-row-kind={row.kind}>
        <button className="oi-side-traj-row" aria-expanded={expanded.includes(row.id)} onClick={() => setExpanded(prev => prev.includes(row.id) ? prev.filter(id => id !== row.id) : [...prev, row.id])}>
          <span className="oi-side-traj-label">{row.label}</span>
          <span className="oi-side-step-meta">{[row.kind, row.agent].filter(Boolean).join(" · ")}</span>
        </button>
        {expanded.includes(row.id) && <pre className="oi-side-traj-detail">{row.detail}</pre>}
      </li>)}
    </ul>
  </div>;
}
