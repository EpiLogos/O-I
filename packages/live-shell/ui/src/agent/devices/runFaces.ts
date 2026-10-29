// The run state a session's agent stands in, and the run its stage plays, from what the owners report (lane W5; manual §19.4 "its posture
// is the agent's state", §25.6; face-rig CREATURE-SPEC.md 25). The creatures of the Agent, the Agentset rack, Messages and the Agents tile
// take their posture from it; the stage plays the kernel's own run events. Nothing here scripts a run: "No action without an event".
//
// The readings, each the shell's own of its owner:
//   - the task's state (agent/agentRunModel.ts TaskClip: queued · running · stalled · stopped · done, Factory's reading of the owners'
//     evidence, agent/taskActivity.ts; unknown where Factory decided no word);
//   - the needle: the session's last check-in (agentRunModel.ts NeedleReading), its age against the check-in bound Factory read the task
//     against (`bound_ms`, TaskStanding.boundMs) — older is a stall. With no bound of Factory's, the faces decide no stall by their own clock;
//   - the thread's last row (agent/devices/threadBinding.ts threadRowsOf over AIKit's encounter view): a proposal waits on you, a tool that
//     reads is thinking, any other tool acting (inhabitants/catalogue/faces/runs.ts stateOfThread, the faces' own rule), a provider failure
//     with no turn running has failed;
//   - the kernel's temporal events (desktop/cradle/kernel/src/temporal_events.rs, `oi.temporal-events/v1`: run, return, curation, generation,
//     gateway-delta, thought, now, kernel, knowledge), the sessions provider's one read: the stage's events, each at its own instant.
// Pure.
import type {RunState} from '../../inhabitants/catalogue/faces/agency'
import {BEAT_MS, STALL_BEATS, stateOfThread, type Recording, type RunEvent, type ThreadRow} from '../../inhabitants/catalogue/faces/runs'
import {eventsForSession, type TaskClip, type TemporalEventLike} from '../agentRunModel'

/** The check-in bound, in seconds, Factory read the session's current task against (TaskStanding.boundMs), or undefined where it named
 * none. The faces keep no bound of their own. Pure. */
export function boundOf(tasks: readonly TaskClip[]): number | undefined {
  const bound = tasks.find(clip => !clip.softStop && typeof clip.standing?.boundMs === 'number')?.standing?.boundMs
  return bound !== undefined && bound > 0 ? bound / 1000 : undefined
}

/** What a session's run state is read from: its task clips and its needle (agentRunModel.ts AgentSessionTrack). */
export interface SessionRun {
  readonly tasks: readonly TaskClip[]
  readonly needle: {readonly atUnixMs: number | null; readonly state?: 'live' | 'stalled' | 'idle'} | null
}

/** The seconds since the session's last check-in: -1 when the needle was read and there is none, undefined when it was not read. */
export function needleAge(track: Pick<SessionRun, 'needle'>, nowUnixMs: number): number | undefined {
  if (!track.needle) return undefined
  return track.needle.atUnixMs == null ? -1 : Math.max(0, Math.round((nowUnixMs - track.needle.atUnixMs) / 1000))
}

/** A thread's rows as the faces read them (runs.ts ThreadRow), from the `thread` value key (JSON of threadBinding.ts ThreadRow). */
export function threadRowsFrom(thread: unknown): ThreadRow[] | null {
  if (typeof thread !== 'string') return null
  try {
    const rows = JSON.parse(thread) as unknown
    if (!Array.isArray(rows)) return null
    return rows.flatMap(row => row && typeof row === 'object' && typeof (row as {kind?: unknown}).kind === 'string'
      ? [{who: String((row as {who?: unknown}).who ?? ''), kind: String((row as {kind: string}).kind), text: String((row as {text?: unknown}).text ?? ''),
        ...(typeof (row as {tool?: unknown}).tool === 'string' ? {tool: (row as {tool: string}).tool} : {}),
        ...(typeof (row as {state?: unknown}).state === 'string' ? {state: (row as {state: string}).state} : {})}] : [])
  } catch { return null }
}

/** A provider failure is the thread's last row: threadBinding.ts writes it `{who: 'error', kind: 'text'}` in the owner's words. */
const failedLast = (rows: readonly ThreadRow[] | null) => !!rows?.length && rows[rows.length - 1]!.who === 'error'

/** The state of the task the session is on: a running task, else a stalled one, else a queued one, else done when every task whose state
 * is said is done; unknown otherwise (the soft-stop slot and the tasks nobody states are not counted). */
export function currentTaskState(tasks: readonly TaskClip[]): TaskClip['state'] {
  const said = tasks.filter(clip => !clip.softStop && clip.state !== 'unknown')
  for (const state of ['running', 'stalled', 'queued'] as const) if (said.some(clip => clip.state === state)) return state
  return said.length && said.every(clip => clip.state === 'done') ? 'done' : 'unknown'
}

/** The needle's word for a lane that is moving (agentRunModel.ts NeedleReading `state`). Named, so a needle's state is never read as a mode. */
const NEEDLE_MOVING = 'live'

/** The run state of a session's agent (spec 25.1), or null when no owner says enough to stand it in one:
 * - its task queued, done or stalled: that state (the task's own state, the owner's word or the run model's inference from activity);
 * - its task running, or no task state but a live needle: the thread's last row decides thinking, acting or waiting (stateOfThread, on the
 *   needle's age, so a needle past the horizon is stalled); with no thread read, a running task is acting (spec 25.1, as the rack maps
 *   Working) and a needle past the horizon stalled;
 * - its thread ending on a provider failure, with no turn running: failed.
 * Producing — a return being made — has no owner signal, so it is never read. */
export function runStateOfSession(track: SessionRun, thread: readonly ThreadRow[] | null, nowUnixMs: number): RunState | null {
  const task = {state: currentTaskState(track.tasks)}
  const age = needleAge(track, nowUnixMs)
  if (task.state === 'queued') return 'queued'
  if (task.state === 'done') return 'done'
  if (task.state === 'stalled') return 'stalled'
  if (task.state !== 'running' && failedLast(thread)) return 'failed'
  const live = task.state === 'running' || track.needle?.state === NEEDLE_MOVING
  if (!live) return track.needle?.state === 'stalled' ? 'stalled' : null
  // Factory's bound, never one of the faces' own: with none named, no stall is read from the clock (the task's own word says it).
  const bound = boundOf(track.tasks)
  if (bound !== undefined && age !== undefined && age >= bound) return 'stalled'
  // A running task with no check-in yet (the needle read none) stands at the start of its bound.
  if (thread && thread.length) return stateOfThread(thread, {age: age !== undefined && age >= 0 ? age : 0, lit: true, horizon: bound ?? Number.POSITIVE_INFINITY})
  return task.state === 'running' ? 'acting' : null
}

/** The Agentset rack's member state (software-factory__agentset-rack.tsx State) for a run state: thinking, acting, waiting and producing
 * are Working; queued is Idle; the rest are themselves. */
export function rackStateOf(run: RunState | null): 'working' | 'idle' | 'stalled' | 'done' | 'failed' | undefined {
  if (run === null) return undefined
  if (run === 'queued') return 'idle'
  if (run === 'stalled' || run === 'done' || run === 'failed') return run
  return 'working'
}

/** Messages' state of an occupied agent (ai-kit__messages.tsx State): waiting on you, stalled, or working. An occupant whose run is queued,
 * done or failed is neither at rest (§19.24: at rest is no occupant now) nor any of these, so it stands absent. */
export function messagesStateOf(run: RunState | null): 'working' | 'waiting' | 'stalled' | undefined {
  if (run === 'waiting' || run === 'stalled') return run
  if (run === 'thinking' || run === 'acting' || run === 'producing') return 'working'
  return undefined
}

/** The temporal event kinds the stage plays, and what each is to it (face-rig environ-kit's kinds, runs.ts RunEvent): a run's start and its
 * end, a source read, a thing made, a thought, a return. Curation, gateway frames, NOW lifecycle and kernel state are no part of a run's
 * tree, so they are not played. */
const STAGE_KIND: Readonly<Record<string, string>> = {run: 'run', knowledge: 'knowledge', generation: 'generation', thought: 'thought', return: 'return'}

/** The session's run as the stage plays it: the kernel's temporal events for the session, else for its session space (agentRunModel.ts
 * eventsForSession, the first of `refs` that names any), the run kinds only, each at its own instant from the first, its subject and the owner's summary carried; an event with no instant has no place on the
 * run's time and is left out. Null when the session has no such event. The stall is read from the clock, as the stage reads it (BEAT_MS ×
 * STALL_BEATS), never written as an event. */
export function stageRecordingOf(events: readonly TemporalEventLike[], refs: string | readonly string[], what?: string): Recording | null {
  const named = (typeof refs === 'string' ? [refs] : refs).filter(Boolean)
  const sessionRef = named[0] ?? ''
  // The session's own events, else its session space's (a direct session's run is recorded on its space: aikit-history).
  const mine = (named.map(ref => eventsForSession([...events], ref)).find(found => found.length) ?? [])
    .filter((event): event is TemporalEventLike & {instant_unix_ms: number; kind: string} => typeof event.instant_unix_ms === 'number' && typeof event.kind === 'string' && event.kind in STAGE_KIND)
    .sort((a, b) => a.instant_unix_ms - b.instant_unix_ms)
  if (!mine.length) return null
  const origin = mine[0]!.instant_unix_ms
  const played: RunEvent[] = mine.map(event => ({at: event.instant_unix_ms - origin, kind: STAGE_KIND[event.kind]!, subject_ref: event.subject_ref,
    ...(event.summary ? {output: event.summary} : {}), ...(event.stream ? {stream: event.stream} : {})}))
  const counts: Record<string, number> = {}
  for (const event of played) counts[event.kind] = (counts[event.kind] ?? 0) + 1
  return {schema: 'face-rig.recorded-run/v1', what: what ?? `the session ${sessionRef}, as the kernel's temporal events`,
    source: {transcript: 'oi.temporal-events/v1', lines: [0, played.length], from: new Date(origin).toISOString(), to: new Date(mine[mine.length - 1]!.instant_unix_ms).toISOString()},
    beat: BEAT_MS, stallBeats: STALL_BEATS, length: played[played.length - 1]!.at + 2000, counts, events: played}
}
