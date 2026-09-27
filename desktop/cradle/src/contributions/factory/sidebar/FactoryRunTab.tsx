/**
 * The right panel's Run tab in Factory (11-FACTORY §5): a compact header for
 * the selected run (title, state, next decision, unit segments) and the tape
 * — the shared Tape (src/agent/tape) following the session carrying the run
 * NOW: the current, active attempt's session — never a past attempt or an
 * execution standing in for it. None is said ("No session is carrying this
 * run now."), and the sessions its attempts ran in are offered to open;
 * several current sessions are shown as a choice the person
 * makes, never the first. With a Direct conversation in Tasks the tape is
 * that conversation's own. Nothing selected: "No run yet — start one."
 */
import {useMemo, useState} from "react";
import {useEncounterSession} from "../../../encounter/session";
import {useTape} from "../../../agent/tape/journal";
import {Tape} from "../../../agent/tape/Tape";
import {openIntent, openObject, tapeEventObject} from "../../../agent/objects";
import {useCentreView} from "../desk/deskModel";
import {runEntry, useDeskReading, useSelectedRun, type RunEntry} from "../desk/deskStore";
import {RUN_STATE_WORD, refTail} from "../desk/runModel";
import {currentSessions, type Join, type LiveSession} from "../inhabitation/model";
import "../desk/fdesk.css";

/** The sessions carrying a run now (inhabitation/model currentSessions). */
export function liveSessionOf(entry: RunEntry): Join<LiveSession> {
  return currentSessions(entry.inspection?.attempts);
}

export function FactoryRunTab({accompanying}: {accompanying?: {ref: string; project: string; space: string}}) {
  useDeskReading();
  const view = useCentreView();
  const selected = useSelectedRun();
  const entry = runEntry(selected);
  const direct = view === "tasks" && accompanying && !entry;
  if (direct) return <div className="frtab" data-run-tab="direct"><p className="frtab-direct">Direct conversation</p><SessionTape project={accompanying.project} session={{ref: accompanying.ref, space: accompanying.space}}/></div>;
  if (!entry) return <div className="frtab" data-run-tab="empty"><p className="frtab-empty">No run yet — start one.</p></div>;
  return <div className="frtab" data-run-tab={entry.run.runRef}>
    <header className="frtab-head">
      <strong data-run-tab-title>{entry.card.title}</strong>
      <span>{RUN_STATE_WORD[entry.card.state]}{entry.card.next ? ` · next: ${entry.card.next}` : ""}</span>
      {entry.card.units.length > 0 && <span className="frtab-units" aria-hidden="true">{entry.card.units.map(unit => <span key={unit.id} className="fdesk-unit" data-standing={unit.standing}/>)}</span>}
    </header>
    <LiveTape entry={entry}/>
  </div>;
}

function LiveTape({entry}: {entry: RunEntry}) {
  const live = liveSessionOf(entry);
  const [chosen, setChosen] = useState<string>();
  if (live.outcome === "none") {
    // Nobody carries it now; a run whose attempts ran still has their
    // sessions — offered to open (the person chooses; never the first).
    const past = pastSessionsOf(entry);
    const pick = past.find(item => item.ref === chosen);
    return <>
      <p className="frtab-empty" data-run-session="none">{entry.inspection ? (past.length ? "No session is carrying this run now — its attempts ran in:" : "No session is carrying this run now.") : entry.inspectionError ? `Who is carrying this run couldn't be read — ${entry.inspectionError}` : "Open the run to read who is carrying it."}</p>
      {past.length > 0 && <label className="frtab-direct" data-run-session="past">
        <select className="oi-input" aria-label="Attempt session to open" value={chosen ?? ""} onChange={event => setChosen(event.target.value || undefined)}>
          <option value="">choose a session…</option>
          {past.map(item => <option key={item.ref} value={item.ref}>{item.label}</option>)}
        </select>
      </label>}
      {pick && <SessionTape project={entry.card.source.project ?? ""} session={pick}/>}
    </>;
  }
  const session = live.outcome === "one" ? live.entries[0] : live.entries.find(item => item.ref === chosen);
  return <>
    {live.outcome === "ambiguous" && <label className="frtab-direct" data-run-session="ambiguous">{live.entries.length} sessions carry this run now —{" "}
      <select className="oi-input" aria-label="Session to follow" value={chosen ?? ""} onChange={event => setChosen(event.target.value || undefined)}>
        <option value="">choose one…</option>
        {live.entries.map(item => <option key={item.ref} value={item.ref}>{refTail(item.ref)}</option>)}
      </select>
    </label>}
    {session && <SessionTape project={entry.card.source.project ?? ""} session={session}/>}
  </>;
}

/** Every session the run's attempts ran in, newest attempt first, named by
 * its agent and unit. */
export function pastSessionsOf(entry: RunEntry): {ref: string; space?: string; label: string}[] {
  const seen = new Set<string>();
  const rows: {ref: string; space?: string; label: string}[] = [];
  for (const attempt of [...(entry.inspection?.attempts ?? [])].reverse()) {
    const ref = attempt.body?.agentSessionRef;
    if (!ref || seen.has(ref)) continue;
    seen.add(ref);
    rows.push({ref, ...(attempt.body?.sessionSpaceRef ? {space: attempt.body.sessionSpaceRef} : {}),
      label: `${refTail(attempt.participant?.agentRef) ?? "agent"} · ${refTail(attempt.taskRef) ?? refTail(attempt.workflowUnitRef) ?? ""}${attempt.status ? ` · ${attempt.status.replace(/_/g, " ")}` : ""}`});
  }
  return rows;
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
