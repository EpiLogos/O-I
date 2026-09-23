/**
 * Trajectory — what happened, in time (11-FACTORY §3.3), over the real
 * encounter journal through the shared tape (src/agent/tape: model.ts,
 * journal.ts, Tape.tsx — one model, no fork).
 *
 * - Session selector: one entry per attempt (agent · unit · attempt n), then
 *   any execution session no attempt names.
 * - Execution waterfall above it when several executions carry telemetry
 *   times; picking a bar selects that session.
 * - Lane strip Input / Model / Tools; Duration · Turns · Calls change the
 *   x-axis. Only owner timestamps place a mark in time; a journal with none
 *   (every non-Pi harness today) shows the axis as "Order" and no durations.
 *   Clicking a mark opens the tape at its row.
 * - Rows: the Tape (call and result joined by call id, turn markers, expand
 *   to input/output, Show raw last; tail-follow with "Resume live · n new").
 * - Footer: turns · steps · tokens · cache hit · cost from the journal's own
 *   usage; without timing only turns and steps. Nothing is invented.
 * The session observer (encounter/session.ts) is the one poll that moves the
 * journal; this page adds none.
 */
import {useEffect, useMemo, useState} from "react";
import {useKernel} from "../../../kernel/KernelProvider";
import {IconChoiceStrip} from "../../../workspace/primitives/IconTabStrip";
import {Glyph} from "../../../workspace/Glyph";
import {useEncounterSession} from "../../../encounter/session";
import {useTape} from "../../../agent/tape/journal";
import {Tape, type TapeFocus} from "../../../agent/tape/Tape";
import {journalUsage, laneMarks, type LaneKind, type LaneMark} from "../../../agent/tape/model";
import {openIntent, openObject, tapeEventObject} from "../../../agent/objects";
import type {RunEntry} from "./deskStore";
import {inspectTelemetry} from "./factoryReads";
import type {RunPageHost} from "./RunPage";
import {refTail, unitOf} from "./runModel";

export interface TrajectorySession { sessionRef: string; label: string; spaceRef?: string; attemptRef?: string; executionRef?: string; agent?: string }

/** One session per attempt (agent · unit · attempt n), then any execution
 * session no attempt names. */
export function trajectorySessions(entry: RunEntry): TrajectorySession[] {
  const out: TrajectorySession[] = [];
  const perUnit = new Map<string, number>();
  for (const attempt of entry.inspection?.attempts ?? []) {
    const session = attempt.body?.agentSessionRef;
    const n = (perUnit.get(attempt.workflowUnitRef) ?? 0) + 1;
    perUnit.set(attempt.workflowUnitRef, n);
    if (!session) continue;
    const unit = unitOf(entry.inspection, attempt.workflowUnitRef);
    const agent = refTail(attempt.participant?.agentRef) ?? "agent";
    const agentWord = agent.replace(/^specimen-/, "").replace(/-/g, " ");
    out.push({sessionRef: session, spaceRef: attempt.body?.sessionSpaceRef, attemptRef: attempt.attemptRef, executionRef: attempt.executionRef ?? undefined, agent,
      label: `${agentWord[0].toUpperCase()}${agentWord.slice(1)} · ${(unit?.key ?? unit?.developmentalConcern ?? "unit").replace(/-/g, " ")} · attempt ${n}`});
  }
  for (const execution of entry.run.executions ?? []) {
    if (!execution.agentSessionRef || out.some(session => session.sessionRef === execution.agentSessionRef)) continue;
    out.push({sessionRef: execution.agentSessionRef, spaceRef: execution.sessionSpaceRef ?? undefined, executionRef: execution.executionRef, label: `${refTail(execution.agentRef) ?? "Agent"} · execution`});
  }
  return out;
}

type Axis = "duration" | "turns" | "calls";
const LANES: {kind: LaneKind; label: string}[] = [{kind: "input", label: "Input"}, {kind: "model", label: "Model"}, {kind: "tools", label: "Tools"}];

export function formatTokens(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)}M`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}K`;
  return String(value);
}

/** x ∈ [0,1] for each mark on an axis; undefined = not placeable on it. */
export function markPositions(marks: LaneMark[], axis: Axis): (number | undefined)[] {
  if (!marks.length) return [];
  if (axis === "duration") {
    const times = marks.map(mark => mark.at).filter((at): at is number => at !== undefined);
    if (!times.length) return marks.map(() => undefined);
    const min = Math.min(...times), max = Math.max(...times);
    return marks.map(mark => mark.at === undefined ? undefined : max === min ? 0.5 : (mark.at - min) / (max - min));
  }
  if (axis === "turns") {
    const turns = [...new Set(marks.map(mark => mark.turn))].sort((a, b) => a - b);
    return marks.map(mark => {
      const index = turns.indexOf(mark.turn);
      const inTurn = marks.filter(other => other.turn === mark.turn);
      const within = inTurn.indexOf(mark) / Math.max(1, inTurn.length);
      return (index + within * 0.9) / Math.max(1, turns.length);
    });
  }
  return marks.map((_, index) => marks.length === 1 ? 0.5 : index / (marks.length - 1));
}

export function RunTrajectory({entry}: {entry: RunEntry; host?: RunPageHost}) {
  const sessions = useMemo(() => trajectorySessions(entry), [entry]);
  const [chosen, setChosen] = useState<string>();
  const session = sessions.find(item => item.sessionRef === chosen) ?? sessions[0];
  // The attempts (and so the sessions' names) come from the workflow
  // inspection the Run page reads on open; wait for it rather than show a
  // provisional list that changes under the pointer.
  if (!entry.inspection && !entry.inspectionError) return <p className="frun-note" role="status">Reading this run's sessions…</p>;
  if (!session) return <div className="frun-empty" data-trajectory-empty><p>No session has carried this run yet.</p></div>;
  return <div className="ftraj">
    <Waterfall entry={entry} sessions={sessions} current={session.sessionRef} onPick={setChosen}/>
    <SessionTrajectory key={session.sessionRef} entry={entry} session={session} sessions={sessions} onChoose={setChosen}/>
  </div>;
}

function SessionTrajectory({entry, session, sessions, onChoose}: {entry: RunEntry; session: TrajectorySession; sessions: TrajectorySession[]; onChoose: (ref: string) => void}) {
  const project = entry.card.source.project ?? "";
  // The shared session observer is the poll that moves the journal (no loop
  // of our own); its reading is the journal's trigger.
  const observer = useEncounterSession(session.spaceRef ? {project, ref: session.sessionRef, space: session.spaceRef} : {project, ref: session.sessionRef});
  const {tape, reading} = useTape({project, ref: session.sessionRef}, observer?.state);
  const events = reading?.events ?? [];
  const usage = useMemo(() => journalUsage(events, tape), [events, tape]);
  const marks = useMemo(() => laneMarks(events, tape), [events, tape]);
  const timed = usage.firstAt !== undefined;
  const [axis, setAxis] = useState<Axis>("duration");
  const effectiveAxis: Axis = timed ? axis : "calls";
  const positions = useMemo(() => markPositions(marks, effectiveAxis), [marks, effectiveAxis]);
  const [focus, setFocus] = useState<TapeFocus>();
  const [query, setQuery] = useState("");
  const live = !!tape.turns.some(turn => turn.open) || observer?.state?.status?.state === "Running";
  const find = () => {
    const q = query.trim().toLowerCase();
    if (!q) return;
    const row = tape.rows.find(item => `${item.object} ${item.detail ?? ""} ${item.text ?? ""}`.toLowerCase().includes(q));
    if (row) setFocus({rowId: row.id, token: Date.now()});
  };
  const stats: string[] = [`${usage.turns} turn${usage.turns === 1 ? "" : "s"}`, `${usage.steps || tape.rows.filter(row => row.verb !== "you").length} steps`];
  if (timed) {
    const tokens = usage.totalTokens ?? (usage.input !== undefined && usage.output !== undefined ? usage.input + usage.output + (usage.cacheRead ?? 0) + (usage.cacheWrite ?? 0) : undefined);
    if (tokens !== undefined) stats.push(`${formatTokens(tokens)} tok`);
    if (usage.cacheHit !== undefined) stats.push(`cache hit ${Math.round(usage.cacheHit * 100)}%`);
    if (usage.cost !== undefined) stats.push(`$${usage.cost.toFixed(3)}`);
  }
  return <>
    <div className="ftraj-card">
      <div className="ftraj-bar">
        <label className="ftraj-session">
          <select aria-label="Session" value={session.sessionRef} onChange={event => onChoose(event.target.value)}>
            {sessions.map(item => <option key={item.sessionRef} value={item.sessionRef}>{item.label}</option>)}
          </select>
        </label>
        {timed
          ? <IconChoiceStrip aria-label="Axis" current={axis} onSelect={value=>setAxis(value as Axis)} items={[
            {id:"duration",label:"Duration",icon:"history"},{id:"turns",label:"Turns",icon:"chat"},{id:"calls",label:"Calls",icon:"terminal"},
          ]}/>

          : <span className="ftraj-axis" data-axis="order">Order</span>}
        <form className="fdesk-search ftraj-search" role="search" onSubmit={event => { event.preventDefault(); find(); }}>
          <Glyph name="search" size={13}/>
          <input aria-label="Search the trajectory" placeholder="Search" value={query} onChange={event => setQuery(event.target.value)} spellCheck={false}/>
        </form>
      </div>
      <svg className="ftraj-strip" role="img" aria-label={`Lane strip on ${timed ? effectiveAxis : "order"} axis: ${marks.length} marks`} data-axis={timed ? effectiveAxis : "order"} viewBox="0 0 1000 66" preserveAspectRatio="none">
        {LANES.map((lane, laneIndex) => <g key={lane.kind} data-lane={lane.kind}>
          <text x="4" y={14 + laneIndex * 20} className="ftraj-lane-label">{lane.label}</text>
          {marks.map((mark, index) => mark.lane !== lane.kind || positions[index] === undefined ? null : <rect key={mark.cursor} data-mark={mark.cursor}
            x={70 + positions[index]! * 920} y={6 + laneIndex * 20} width={lane.kind === "model" ? 22 : 12} height={lane.kind === "input" ? 5 : 7} rx="1.5"
            className="ftraj-mark" data-lane-kind={lane.kind}
            onClick={() => mark.rowId && setFocus({rowId: mark.rowId, token: Date.now()})}><title>{lane.label}{mark.at ? ` · ${new Date(mark.at).toLocaleTimeString()}` : ""}</title></rect>)}
        </g>)}
      </svg>
      <Tape tape={tape} live={live} focus={focus} loading={reading?.loading && !reading.complete} error={reading?.error} label="Trajectory"
        onInspect={(row, _call, event) => openObject(tapeEventObject(row, {project, ref: session.sessionRef}), openIntent(event))}
        empty={<p className="frun-note">This session's journal has no events yet.</p>}/>
      <p className="ftraj-foot" data-trajectory-stats={timed ? "timed" : "order"}>{stats.join(" · ")}</p>
    </div>
  </>;
}

/** The compact execution waterfall (ported SSSF TraceWaterfall idea): rows =
 * agents, bars = each execution's telemetry started→completed (or last
 * update while running). Only shown when two or more executions carry times. */
function Waterfall({entry, sessions, current, onPick}: {entry: RunEntry; sessions: TrajectorySession[]; current: string; onPick: (ref: string) => void}) {
  const kernel = useKernel();
  const [spans, setSpans] = useState<{session: TrajectorySession; start: number; end: number; running: boolean}[]>([]);
  useEffect(() => {
    let live = true;
    const telemetry = entry.inspection?.telemetry ?? [];
    void Promise.all(sessions.map(async session => {
      const ref = telemetry.find(item => item.executionRef && item.executionRef === session.executionRef)?.telemetryRef;
      if (!ref) return undefined;
      const reading = await inspectTelemetry(kernel.transport, entry.card.source.statePath, ref).catch(() => undefined) as Record<string, unknown> | undefined;
      // `factory telemetry inspect`: {reading: {temporal: {started: {value}, …}}}
      // (or {correlation: …} while owner records are pending).
      const record = ((reading?.reading ?? reading?.correlation ?? reading) ?? {}) as Record<string, unknown>;
      const temporal = (record.temporal ?? {}) as Record<string, {value?: string} | undefined>;
      const time = (fact?: {value?: string}) => { const value = Date.parse(fact?.value ?? ""); return Number.isFinite(value) ? value : undefined; };
      const start = time(temporal.started);
      // A still-running execution's bar is open-ended: it reaches now.
      const running = entry.inspection?.attempts?.some(attempt => attempt.attemptRef === session.attemptRef && attempt.status === "active");
      const end = time(temporal.completed) ?? time(temporal.updated) ?? (running ? Date.now() : undefined);
      return start !== undefined && end !== undefined ? {session, start, end, running: !!running && !time(temporal.completed)} : undefined;
    })).then(rows => { if (live) setSpans(rows.filter((row): row is {session: TrajectorySession; start: number; end: number; running: boolean} => !!row)); });
    return () => { live = false; };
  }, [entry.inspection?.telemetry, entry.card.source.statePath, kernel.transport, sessions]);
  if (spans.length < 2) return null;
  const min = Math.min(...spans.map(span => span.start)), max = Math.max(...spans.map(span => span.end));
  const width = Math.max(1, max - min);
  return <div className="ftraj-waterfall" aria-label="Executions">
    {spans.map(span => <button key={span.session.sessionRef} type="button" className="ftraj-fall-row" aria-pressed={span.session.sessionRef === current} onClick={() => onPick(span.session.sessionRef)}>
      <span className="ftraj-fall-label">{span.session.agent?.replace(/^specimen-/, "") ?? span.session.label}</span>
      <span className="ftraj-fall-track"><span className="ftraj-fall-bar" data-running={span.running ? "true" : undefined} data-start={span.start} data-end={span.running ? undefined : span.end} style={{left: `${((span.start - min) / width) * 100}%`, width: `${Math.max(1, ((span.end - span.start) / width) * 100)}%`}}/></span>
    </button>)}
  </div>;
}
