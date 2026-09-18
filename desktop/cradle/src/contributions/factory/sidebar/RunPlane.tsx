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
import {
  markArrivalsSeen, refusePermission, resolvePermission, retryStep,
  useFactoryFixture, useFactorySelection, type FactoryPanelHost, type FixtureStep,
} from "./sidebarModel";
import {ScenarioBar} from "./ScenarioBar";
import "./sidebar.css";

const STATUS_GLYPH: Record<string, Parameters<typeof Glyph>[0]["name"]> = {
  queued: "dot", running: "activity", success: "check", fail: "warning", blocked: "stop", cancelled: "stop",
};

export function RunPlane({subject, accompanying, onMessage, host}: DeskPlaneProps & {host?: FactoryPanelHost}) {
  const fixture = useFactoryFixture();
  const selection = useFactorySelection();
  const fixtureRun = fixture?.run;
  const view = !fixtureRun ? selection?.view : undefined;
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

  return <div className="desk-plane factory-side" data-plane="Run" data-fixture={fixtureRun ? fixture.scenario : undefined}>
    <ScenarioBar />

    {/* --- the run: what this work is, where it stands ---------------------- */}
    <div className="factory-side-run" data-run-state={state}>
      {runLabel
        ? <div className="factory-side-run-head">
          <span className="factory-side-run-state"><Glyph name={STATUS_GLYPH[state ?? "queued"] ?? "dot"} size={13} />{state ?? "unknown"}</span>
          <strong>{runLabel}</strong>
        </div>
        : <div className="factory-side-run-head" data-state="none"><strong>No run selected.</strong></div>}
      {fixtureRun && <p className="factory-side-run-purpose">{fixtureRun.purpose}</p>}
      {nextDecision && <p className="factory-side-decision" role="status"><Glyph name="verify" size={12} />{nextDecision}</p>}
      <div className="oi-action-group factory-side-run-actions">
        {host?.onExpandPanel && <button className="oi-action" onClick={host.onExpandPanel}><Glyph name="maximise" size={12} />Expand</button>}
        {host?.onOpenFullRun && <button className="oi-action" onClick={host.onOpenFullRun}><Glyph name="columns" size={12} />Full run</button>}
        {host?.onOpenPlane && hasCandidates && <button className="oi-action" onClick={() => host.onOpenPlane?.("factory-context")}>Compare</button>}
      </div>
    </div>

    {/* --- decisions: the genuine human attention ---------------------------- */}
    {!!decisions.length && <section className="factory-side-group" aria-label="Decisions">
      <h4>Decisions</h4>
      {decisions.map(decision => <div key={decision.ref} className="factory-side-decision-row" data-decision={decision.ref}>
        <p>{decision.question}</p>
        <div className="oi-action-group">
          {fixtureRun
            ? <>
              <button className="oi-action" onClick={() => resolvePermission(decision.stepRef ?? decision.ref)}>Permit</button>
              <button className="oi-action" onClick={() => refusePermission(decision.stepRef ?? decision.ref)}>Refuse</button>
            </>
            : <small className="factory-side-gap">Not exposed at the desktop seam yet.</small>}
        </div>
      </div>)}
    </section>}

    {/* --- steps --------------------------------------------------------------- */}
    <section className="factory-side-group" aria-label="Steps">
      <h4>Steps</h4>
      {steps && (steps.length
        ? <ul className="factory-side-steps">
          {steps.map(step => <li key={step.ref} data-step-status={step.status}>
            <Glyph name={STATUS_GLYPH[step.status] ?? "dot"} size={12} />
            <span className="factory-side-step-label">{step.label}</span>
            <span className="factory-side-step-meta">{[step.lane, step.assignee, step.attempt && step.attempt > 1 ? `attempt ${step.attempt}` : undefined].filter(Boolean).join(" · ")}</span>
            {(step.blockedBy || step.failedVerification) && <small className="factory-side-barrier" role="status">{step.blockedBy ?? step.failedVerification}</small>}
            <div className="oi-action-group">
              {(step.status === "fail" || step.status === "cancelled") && <button className="oi-action" onClick={() => retryStep(step.ref)}>Retry</button>}
              <button className="oi-action" aria-label={`Inspect ${step.label}`} onClick={() => handToPanelInspect({kind: "factory-step", ref: step.ref, title: step.label, payload: step, source: "Run"})}>Inspect</button>
            </div>
          </li>)}
        </ul>
        : <p className="oi-empty">No steps yet.</p>)}
      {!steps && (view?.executions.length
        ? <ul className="factory-side-steps">
          {view.executions.map(execution => <li key={execution.executionRef} data-step-status={execution.status}>
            <Glyph name={STATUS_GLYPH[execution.status] ?? "dot"} size={12} />
            <span className="factory-side-step-label">{execution.agencyRef ?? "Execution"}</span>
            <span className="factory-side-step-meta">{[execution.status, execution.harnessRef].filter(Boolean).join(" · ")}</span>
            <div className="oi-action-group">
              <button className="oi-action" onClick={() => handToPanelInspect({kind: "factory-execution", ref: execution.executionRef, title: `execution ${execution.executionRef}`, payload: execution, source: "Run"})}>Inspect</button>
            </div>
          </li>)}
        </ul>
        : <p className="oi-empty">{view ? "No executions." : "No steps yet."}</p>)}
    </section>

    {/* --- the live log: the run's state, streamed ------------------------------ */}
    <section className="factory-side-group factory-side-trajectory" aria-label="Activity">
      <h4>Activity</h4>
      {fixtureRun
        ? <FixtureTrajectory rows={fixtureRun.trajectory} arrivals={fixtureRun.arrivals ?? 0} />
        : accompanying
          ? <div className="factory-side-embed"><TrajectoryPlane subject={subject} accompanying={accompanying} onMessage={onMessage} /></div>
          : <p className="oi-empty">No conversation bound.</p>}
    </section>

    {/* --- checks attached to the work ------------------------------------------- */}
    {!!checks.length && <section className="factory-side-group" aria-label="Checks">
      <h4>Checks</h4>
      <ul className="factory-side-checks">
        {checks.map(check => <li key={check.ref} data-check-state={check.state}>
          <Glyph name={check.state === "supported" ? "check" : check.state === "challenged" ? "warning" : "report"} size={12} />
          <span>{check.statement}</span>
          <small>{[check.state, ...check.evidence].join(" · ")}</small>
        </li>)}
      </ul>
    </section>}

    {/* --- metrics: one quiet line ------------------------------------------------- */}
    {tokens > 0 && <section className="factory-side-group" aria-label="Metrics">
      <p className="factory-side-metrics">Tokens (reported): {tokens.toLocaleString()}</p>
    </section>}
  </div>;
}

/** The trajectory: coalesced rows, expandable detail, held view with a
 * visible arrivals count and an explicit resume — the paused-follow law. */
function FixtureTrajectory({rows, arrivals}: {rows: {id: number; kind: string; label: string; detail: string; agent?: string}[]; arrivals: number}) {
  const [expanded, setExpanded] = useState<number[]>([]);
  const [held, setHeld] = useState(false);
  const shown = held && arrivals > 0 ? rows.slice(0, rows.length - arrivals) : rows;
  return <div className="factory-side-traj">
    <div className="factory-side-traj-strip" data-paused={held || arrivals > 0 ? "true" : "false"}>
      <span>{arrivals > 0 ? `${arrivals} new` : "Live"}</span>
      {arrivals > 0 && <button className="oi-action" onClick={() => { markArrivalsSeen(); setHeld(false); }}>Resume</button>}
      {!held && arrivals === 0 && <button className="oi-action" onClick={() => setHeld(true)}>Hold</button>}
    </div>
    <ul className="factory-side-traj-list">
      {shown.map(row => <li key={row.id} data-row-kind={row.kind}>
        <button className="factory-side-traj-row" aria-expanded={expanded.includes(row.id)} onClick={() => setExpanded(prev => prev.includes(row.id) ? prev.filter(id => id !== row.id) : [...prev, row.id])}>
          <span className="factory-side-traj-label">{row.label}</span>
          <span className="factory-side-step-meta">{[row.kind, row.agent].filter(Boolean).join(" · ")}</span>
        </button>
        {expanded.includes(row.id) && <pre className="factory-side-traj-detail">{row.detail}</pre>}
      </li>)}
    </ul>
  </div>;
}
