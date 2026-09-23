/**
 * Trajectory — what happened, in time (11-FACTORY §3.3). The session selector
 * names one entry per attempt or execution of the run (`agent · unit ·
 * attempt n`); the rows are the selected session's encounter journal through
 * the shared tape model (src/agent/tape/model.ts).
 */
import {useMemo, useState} from "react";
import type {RunEntry} from "./deskStore";
import type {RunPageHost} from "./RunPage";
import {refTail, unitOf} from "./runModel";

export interface TrajectorySession { sessionRef: string; label: string; attemptRef?: string; executionRef?: string }

/** One session per attempt (agent · unit · attempt n), then any execution
 * session no attempt names. */
export function trajectorySessions(entry: RunEntry): TrajectorySession[] {
  const out: TrajectorySession[] = [];
  const perUnit = new Map<string, number>();
  for (const attempt of entry.inspection?.attempts ?? []) {
    const session = attempt.body?.agentSessionRef;
    if (!session) continue;
    const n = (perUnit.get(attempt.workflowUnitRef) ?? 0) + 1;
    perUnit.set(attempt.workflowUnitRef, n);
    const unit = unitOf(entry.inspection, attempt.workflowUnitRef);
    const agent = refTail(attempt.participant?.agentRef) ?? "Agent";
    out.push({sessionRef: session, attemptRef: attempt.attemptRef, executionRef: attempt.executionRef ?? undefined,
      label: `${agent[0].toUpperCase()}${agent.slice(1)} · ${unit?.key?.replace(/-/g, " ") ?? unit?.developmentalConcern ?? "unit"} · attempt ${n}`});
  }
  for (const execution of entry.run.executions ?? []) {
    if (!execution.agentSessionRef || out.some(session => session.sessionRef === execution.agentSessionRef)) continue;
    out.push({sessionRef: execution.agentSessionRef, executionRef: execution.executionRef, label: `${refTail(execution.agentRef) ?? "Agent"} · execution`});
  }
  return out;
}

export function RunTrajectory({entry, host}: {entry: RunEntry; host: RunPageHost}) {
  const sessions = useMemo(() => trajectorySessions(entry), [entry]);
  const [chosen, setChosen] = useState<string>();
  const session = sessions.find(entry => entry.sessionRef === chosen) ?? sessions[0];
  void host;
  if (!session) return <div className="frun-empty" data-trajectory-empty><p>No session has carried this run yet.</p></div>;
  return <div className="ftraj">
    <div className="ftraj-bar">
      <label className="ftraj-session">
        <span className="visually-hidden">Session</span>
        <select aria-label="Session" value={session.sessionRef} onChange={event => setChosen(event.target.value)}>
          {sessions.map(item => <option key={item.sessionRef + (item.attemptRef ?? "")} value={item.sessionRef}>{item.label}</option>)}
        </select>
      </label>
    </div>
  </div>;
}
