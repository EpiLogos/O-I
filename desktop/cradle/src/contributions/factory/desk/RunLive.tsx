/**
 * Live — who is carrying it right now (11-FACTORY §3.4), from the workflow
 * inspection's legs and attempts (`factory workflow inspect`) and telemetry.
 *
 * One row per leg: agent, unit, harness · model (from the attempt body), leg
 * status, then where it runs (workcell or host) and its Git basis. Actions are
 * only real routes: Open conversation (Tasks), Open activity. Interrupt,
 * cancel and retry appear only where the owner exposes them — this cut
 * exposes them only through the attempt lifecycle's authority-bearing
 * requests, so they are not offered here. NOW: the run's return address.
 * Empty: "Nothing is running." (+ the primary action when one applies).
 */
import type {RunEntry} from "./deskStore";
import type {TelemetryInspection} from "./factoryReads";
import {gitBasisOf, type FactoryObjectRef, type RunPageHost} from "./RunPage";
import {attemptsFor, firstSentence, initials, legStanding, refTail, unitOf, type RunAction, type RunMapNode} from "./runModel";
import {useNowRecord} from "./nowRecord";

const LEG_WORD: Record<string, string> = {
  active: "running", detached: "detached", cancel_requested: "cancel requested", cancellation_accepted: "cancelling",
  process_terminated: "process ended", quiescent: "quiescent", returned: "returned", failed: "failed", late_result: "late result",
};

export function RunLive({entry, runKey, host, primary, onPrimary, telemetry}: {entry: RunEntry; runKey: string; host: RunPageHost; primary?: RunAction; onPrimary?: () => void; telemetry?: TelemetryInspection}) {
  const {run, inspection} = entry;
  const units = Object.values(run.runMap?.nodes ?? {}).filter((node): node is RunMapNode => node.kind === "work");
  const basis = gitBasisOf(telemetry);
  const rows = units.map(node => {
    const unitRef = node.semanticRef ?? undefined;
    const unit = unitOf(inspection, unitRef);
    const attempts = attemptsFor(inspection, unitRef);
    const current = attempts.find(attempt => attempt.currentAttempt) ?? attempts[attempts.length - 1];
    const leg = unitRef ? inspection?.legs?.[unitRef] : undefined;
    return {node, unitRef, unit, current, leg, standing: legStanding(node, leg)};
  });
  const carried = rows.filter(row => row.current || row.leg?.status);
  const returnAddress = rows.map(row => row.unit?.requiredReturn?.address).find(address => address?.startsWith("central:now:"));

  if (!carried.length) {
    return <div className="frun-empty" data-live-empty>
      <p>Nothing is running.</p>
      {primary && onPrimary && <button type="button" className="oi-action oi-action-primary" onClick={onPrimary}>{primary.label}</button>}
      {returnAddress && <NowLine address={returnAddress} host={host}/>}
    </div>;
  }
  return <div className="flive">
    <div className="flive-rows">
      {rows.map(row => {
        const body = row.current?.body;
        const agent = refTail(row.current?.participant?.agentRef) ?? refTail(row.unit?.agentRequirements?.agentRefs?.[0]) ?? "Agent";
        const status = row.leg?.status ?? row.current?.status ?? undefined;
        const session = body?.agentSessionRef;
        const harnessModel = [refTail(body?.harnessRef), refTail(body?.modelRef)].filter(Boolean).join(" · ");
        const where = body?.workcellRef ? `workcell ${refTail(body.workcellRef)}` : body ? "this host" : undefined;
        const open = (object: FactoryObjectRef) => host.onOpenObject?.(object);
        return <div key={row.node.id} className="flive-row" data-leg={row.unitRef ?? row.node.id} data-leg-status={status ?? "not-started"}>
          <span className="fdesk-avatar flive-avatar" aria-hidden="true">{initials(agent)}</span>
          <div className="flive-who">
            <strong>{agent}</strong>
            <button type="button" className="flive-unit" onClick={() => row.unitRef && open({kind: "work-unit", runKey, unitRef: row.unitRef})}>{row.unit?.developmentalConcern ?? row.node.label}</button>
          </div>
          <div className="flive-body">
            <span>{harnessModel || "–"}</span>
            {(where || basis?.branch) && <small>{[where, basis?.branch ? `branch ${basis.branch}${basis.clean === undefined ? "" : basis.clean ? " (clean)" : " (dirty)"}` : undefined].filter(Boolean).join(" · ")}</small>}
            {!row.current && <small>{row.standing === "not-started" ? "waiting" : ""}</small>}
          </div>
          <div className="flive-state">
            <span data-status={status ?? "not-started"}><span aria-hidden="true">{status === "active" ? "● " : status === "returned" ? "✓ " : status === "failed" ? "× " : "○ "}</span>{status ? LEG_WORD[status] ?? status.replace(/_/g, " ") : "not started"}</span>
            <span className="flive-actions">
              {session && host.onOpenConversation && <button type="button" className="fdesk-link" onClick={() => host.onOpenConversation?.(session)}>Open conversation</button>}
              {session && host.onOpenActivity && <button type="button" className="fdesk-link" onClick={() => host.onOpenActivity?.({sessionRef: session})}>Open activity</button>}
              {row.current && <button type="button" className="fdesk-link" onClick={() => open({kind: "attempt", runKey, attemptRef: row.current!.attemptRef})}>Open attempt</button>}
            </span>
          </div>
        </div>;
      })}
    </div>
    {returnAddress && <NowLine address={returnAddress} host={host}/>}
  </div>;
}

function NowLine({address, host}: {address: string; host: RunPageHost}) {
  const now = useNowRecord(address);
  const words = now.reading?.record.purpose ? firstSentence(now.reading.record.purpose) : now.state === "reading" ? "reading…" : "the run's return record";
  return <p className="flive-now" data-now-line>NOW · <button type="button" className="fdesk-link" onClick={() => host.onOpenObject?.({kind: "now-record", ref: address})}>{words}</button></p>;
}
