/**
 * The right panel's Run tab in Factory (11-FACTORY §5): a compact header for
 * the selected run (title, state, next decision, unit segments) and the tape
 * — the shared Tape (src/agent/tape) following the run's live session: the
 * current attempt's session, else the latest one that carried the run. With a
 * Direct conversation in Tasks the tape is that conversation's own. Nothing
 * selected: "No run yet — start one."
 */
import {useMemo} from "react";
import {useEncounterSession} from "../../../encounter/session";
import {useTape} from "../../../agent/tape/journal";
import {Tape} from "../../../agent/tape/Tape";
import {openIntent, openObject, tapeEventObject} from "../../../agent/objects";
import {useCentreView} from "../desk/deskModel";
import {runEntry, useDeskReading, useSelectedRun, type RunEntry} from "../desk/deskStore";
import {RUN_STATE_WORD} from "../desk/runModel";
import "../desk/fdesk.css";

/** The session a run's tape follows: the current (active) attempt's, else the
 * most recent attempt that named one, else an execution's. */
export function liveSessionOf(entry: RunEntry): {ref: string; space?: string} | undefined {
  const attempts = entry.inspection?.attempts ?? [];
  const current = attempts.find(attempt => attempt.currentAttempt && attempt.status === "active" && attempt.body?.agentSessionRef)
    ?? [...attempts].reverse().find(attempt => attempt.body?.agentSessionRef);
  if (current?.body?.agentSessionRef) return {ref: current.body.agentSessionRef, space: current.body.sessionSpaceRef};
  const execution = (entry.run.executions ?? []).find(item => item.agentSessionRef);
  return execution?.agentSessionRef ? {ref: execution.agentSessionRef, space: execution.sessionSpaceRef ?? undefined} : undefined;
}

export function FactoryRunTab({accompanying}: {accompanying?: {ref: string; project: string; space: string}}) {
  useDeskReading();
  const view = useCentreView();
  const selected = useSelectedRun();
  const entry = runEntry(selected);
  const direct = view === "tasks" && accompanying && !entry;
  if (direct) return <div className="frtab" data-run-tab="direct"><p className="frtab-direct">Direct conversation</p><SessionTape project={accompanying.project} session={{ref: accompanying.ref, space: accompanying.space}}/></div>;
  if (!entry) return <div className="frtab" data-run-tab="empty"><p className="frtab-empty">No run yet — start one.</p></div>;
  const session = liveSessionOf(entry);
  return <div className="frtab" data-run-tab={entry.run.runRef}>
    <header className="frtab-head">
      <strong data-run-tab-title>{entry.card.title}</strong>
      <span>{RUN_STATE_WORD[entry.card.state]}{entry.card.next ? ` · next: ${entry.card.next}` : ""}</span>
      {entry.card.units.length > 0 && <span className="frtab-units" aria-hidden="true">{entry.card.units.map(unit => <span key={unit.id} className="fdesk-unit" data-standing={unit.standing}/>)}</span>}
    </header>
    {session
      ? <SessionTape project={entry.card.source.project ?? ""} session={session}/>
      : <p className="frtab-empty">No session is carrying this run yet.</p>}
  </div>;
}

function SessionTape({project, session}: {project: string; session: {ref: string; space?: string}}) {
  const observer = useEncounterSession(session.space ? {project, ref: session.ref, space: session.space} : {project, ref: session.ref});
  const binding = useMemo(() => ({project, ref: session.ref}), [project, session.ref]);
  const {tape, reading} = useTape(binding, observer?.state);
  const live = tape.turns.some(turn => turn.open);
  return <Tape tape={tape} live={live} loading={reading?.loading && !reading.complete} error={reading?.error} label="Run"
    onInspect={(row, _call, event) => openObject(tapeEventObject(row, binding), openIntent(event))}
    empty={<p className="frtab-empty">This session's journal has no events yet.</p>}/>;
}
