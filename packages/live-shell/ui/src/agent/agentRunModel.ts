/**
 * The agent run model — the pure shape of the run viewer and session grid.
 * No React, no kernel imports: every function takes the native readings as
 * data, so the model is testable without a transport and the views stay
 * renderings of this shape.
 *
 * Sources the readings come from (the provider owns the polling):
 *   - `agency_read`      → AgencyRowLike rows (spaces → sessions; no parent field)
 *   - `agent_definition` roster → RosterEntry (name, accepted)
 *   - `encounter_task_read` → the session's bound task record (fields are
 *     owner-dependent; every absent field is disclosed, never substituted)
 *   - `temporal_events_read` → TemporalEventLike (the thread's activity)
 *
 * Design law this model encodes: tracks are agent sessions; clips are atomic
 * tasks; a group track is a lead plus the sessions it spawned (stepped rails
 * per nesting depth). Running tasks draw no end; queued tasks have no
 * length; a stalled needle freezes at last output.
 */

export type TaskState = 'running' | 'queued' | 'stalled' | 'done' | 'unknown'

export interface TaskClip {
  /** 1-based ordinal over the session's real clips; the soft-stop slot takes the next number. */
  n: number
  title: string | null
  state: TaskState
  startUnixMs: number | null
  lastActivityUnixMs: number | null
  /** The trailing empty slot: its square soft-stops the session after the current task. */
  softStop: boolean
  /** The disclosed absence — what the native sources cannot say. */
  disclosure: string | null
}

export interface NeedleReading {
  atUnixMs: number | null
  state: 'live' | 'stalled' | 'idle'
  axisStartUnixMs: number
  axisEndUnixMs: number
  disclosure: string | null
}

export interface AgentSessionTrack {
  sessionRef: string
  purpose: string | null
  agentRef: string | null
  agentName: string | null
  agentAccepted: boolean | null
  spaceRef: string
  spaceLabel: string | null
  depth: number
  parentRef: string | null
  group: boolean
  memberRefs: string[]
  tasks: TaskClip[]
  needle: NeedleReading | null
  telemetryOn: boolean
  budget: {used: number | null; max: number | null}
  /** Track-level disclosed absence (grouping derivation, undecidable state). */
  disclosure: string | null
}

/** One row of an `agency_read` reading (desktop/cradle agencyTypes.ts:117). */
export interface AgencyRowLike {
  spaceRef: string
  spaceLabel?: string | null
  sessionRef: string
  purpose?: string | null
  agentRef?: string | null
  /** The unparsed space payload, inspected for parent/supervisor linkage. */
  raw?: unknown
}

export interface RosterEntry {
  name: string
  accepted: boolean | null
}

/** One temporal event (desktop/cradle kernel/src/temporal_events.rs:136). */
export interface TemporalEventLike {
  stream?: string
  kind?: string
  subject_ref: string
  instant_unix_ms?: number | null
  summary?: string
}

/**
 * The heartbeat horizon. `harness_status` discloses bindings but no heartbeat
 * age, so liveness falls back to this fixed horizon: a needle is live while
 * its last activity is younger than 90 s, stalled once older (frozen at that
 * instant), idle with no activity in the axis window. Chosen, documented here,
 * not measured — a native heartbeat age replaces it when one is disclosed.
 */
export const HEARTBEAT_HORIZON_MS = 90_000

/** The shared time axis: one hour ending now (the previous arrangement's window). */
export const DEFAULT_AXIS_WINDOW_MS = 60 * 60 * 1000

/** Characters that bound a ref inside a larger ref. `-`, `_` and `.` are NOT
 * boundaries: they occur inside refs themselves, so `abc` does not match
 * `abc-def` but `agency/abc/tool.done` matches for `abc` via `/` edges. */
const REF_SEPARATORS = new Set([':', '/', '#', '|', '@', ',', ';', '?', '=', '&', '%', ' ', '\t'])

/** True when `needle` occurs in `hay` only at separator boundaries — a
 * structural subject_ref match, stronger than summary containment. */
export function refContained(hay: string, needle: string): boolean {
  if (!hay || !needle) return false
  let from = 0
  for (;;) {
    const at = hay.indexOf(needle, from)
    if (at < 0) return false
    const before = at === 0 ? '' : hay[at - 1]
    const after = at + needle.length === hay.length ? '' : hay[at + needle.length]
    if ((before === '' || REF_SEPARATORS.has(before)) && (after === '' || REF_SEPARATORS.has(after))) return true
    from = at + 1
  }
}

/** Events for one session: prefer structural subject_ref matches; fall back
 * to the historical summary containment only when no structural match exists. */
export function eventsForSession(events: TemporalEventLike[], sessionRef: string): TemporalEventLike[] {
  if (!sessionRef) return []
  const structural = events.filter(event => event.subject_ref === sessionRef || refContained(event.subject_ref ?? '', sessionRef))
  if (structural.length) return structural
  return events.filter(event => typeof event.summary === 'string' && event.summary.includes(sessionRef))
}

const instanted = (events: TemporalEventLike[]): number[] =>
  events.map(event => event.instant_unix_ms).filter((value): value is number => typeof value === 'number')

const OWNER_STATE_FIELDS = ['state', 'status', 'task_state'] as const

function ownerState(reading: Record<string, unknown>): string | null {
  for (const field of OWNER_STATE_FIELDS) {
    const value = reading[field]
    if (typeof value === 'string' && value.trim()) return value.trim().toLowerCase()
  }
  return null
}

const DONE_WORDS = new Set(['done', 'complete', 'completed', 'finished'])
const QUEUED_WORDS = new Set(['queued', 'pending', 'waiting'])
const STALLED_WORDS = new Set(['stalled', 'stuck', 'frozen'])
const RUNNING_WORDS = new Set(['running', 'active', 'in_progress', 'live'])

function stateFromOwner(word: string): TaskState | null {
  if (DONE_WORDS.has(word)) return 'done'
  if (QUEUED_WORDS.has(word)) return 'queued'
  if (STALLED_WORDS.has(word)) return 'stalled'
  if (RUNNING_WORDS.has(word)) return 'running'
  return null
}

interface TaskRecordLike {
  title: string | null
  state: TaskState
  /** True when the state came from the owner's own field, not an inference. */
  ownerDeclared: boolean
}

/** Read one bound task record (`aikit.encounter-task/v1`). The reading holds
 * ONE task (`request.central`); its state field is owner-dependent — when the
 * owner discloses none, the temporal stream decides between running/stalled
 * and the rest is disclosed as unknown. */
function readTaskRecord(reading: unknown, nowUnixMs: number, sessionEvents: TemporalEventLike[]): TaskRecordLike | null {
  if (!reading || typeof reading !== 'object') return null
  const record = reading as Record<string, unknown>
  const request = record.request as Record<string, unknown> | undefined
  const central = request?.central as Record<string, unknown> | undefined
  const purpose = typeof central?.purpose === 'string' && central.purpose.trim() ? central.purpose : null
  const taskRef = typeof central?.task_ref === 'string' && central.task_ref.trim() ? central.task_ref : null
  if (!purpose && !taskRef) return null
  const instants = instanted(sessionEvents)
  const latest = instants.length ? Math.max(...instants) : null
  const ownerWord = ownerState(record)
  const declared = ownerWord ? stateFromOwner(ownerWord) : null
  let state: TaskState
  let ownerDeclared = false
  if (declared) {
    state = declared
    ownerDeclared = true
  } else if (latest !== null && nowUnixMs - latest <= HEARTBEAT_HORIZON_MS) {
    state = 'running'
  } else if (latest !== null) {
    state = 'stalled'
  } else {
    state = 'unknown'
  }
  return {title: purpose ?? taskRef, state, ownerDeclared}
}

/** Build the clips for one session: the data's own clips, then exactly one
 * soft-stop empty slot. Absent fields carry disclosure strings, never
 * substitutes. */
export function buildTaskClips(
  taskReading: unknown,
  temporal: TemporalEventLike[],
  sessionRef: string,
  nowUnixMs: number,
): TaskClip[] {
  const sessionEvents = eventsForSession(temporal, sessionRef)
  const instants = instanted(sessionEvents)
  const latest = instants.length ? Math.max(...instants) : null
  const earliest = instants.length ? Math.min(...instants) : null
  const record = readTaskRecord(taskReading, nowUnixMs, sessionEvents)
  const clips: TaskClip[] = []
  if (record) {
    let disclosure: string | null = null
    if (record.state === 'unknown') {
      disclosure = 'encounter_task_read discloses no state field and no temporal event matches this session — the task state is unknown.'
    } else if (!record.ownerDeclared && record.state === 'stalled') {
      disclosure = `Stalled by inference: the last temporal activity is older than the ${Math.round(HEARTBEAT_HORIZON_MS / 1000)} s heartbeat horizon.`
    } else if (!record.ownerDeclared && record.state === 'running') {
      disclosure = 'Running by inference from temporal activity; encounter_task_read discloses no state field.'
    } else if (record.state === 'queued') {
      disclosure = 'Known pending with no start: no length is drawn.'
    }
    if (record.state !== 'queued' && earliest === null && record.state !== 'unknown' && record.state !== 'done') {
      disclosure = (disclosure ? disclosure + ' ' : '') + 'No start instant is disclosed; the bar draws from the axis edge.'
    }
    clips.push({
      n: 1,
      title: record.title,
      state: record.state,
      // Queued = known pending with no start: no start instant is drawn.
      startUnixMs: record.state === 'queued' ? null : earliest,
      lastActivityUnixMs: latest,
      softStop: false,
      disclosure,
    })
  }
  clips.push({
    n: clips.length + 1,
    title: null,
    state: 'unknown',
    startUnixMs: null,
    lastActivityUnixMs: null,
    softStop: true,
    disclosure: null,
  })
  return clips
}

/** The needle for one session on the shared axis: at its last activity,
 * absolutely placed — never a share of the window, never a predicted end. */
export function needleFor(
  events: TemporalEventLike[],
  sessionRef: string,
  axis: {startUnixMs: number; endUnixMs: number},
): NeedleReading | null {
  const sessionEvents = eventsForSession(events, sessionRef)
  const inWindow = instanted(sessionEvents)
    .filter(at => at <= axis.endUnixMs)
  if (!inWindow.length || Math.max(...inWindow) < axis.startUnixMs) {
    const allInstants = instanted(sessionEvents)
    const before = allInstants.length ? Math.max(...allInstants) : null
    const disclosure = before !== null
      ? `Last activity lies before the axis window (axis starts ${new Date(axis.startUnixMs).toISOString()}).`
      : 'No temporal event matches this session in the axis window.'
    return {atUnixMs: null, state: 'idle', axisStartUnixMs: axis.startUnixMs, axisEndUnixMs: axis.endUnixMs, disclosure}
  }
  const at = Math.max(...inWindow)
  const age = axis.endUnixMs - at
  if (age <= HEARTBEAT_HORIZON_MS) {
    return {atUnixMs: at, state: 'live', axisStartUnixMs: axis.startUnixMs, axisEndUnixMs: axis.endUnixMs, disclosure: null}
  }
  return {
    atUnixMs: at,
    state: 'stalled',
    axisStartUnixMs: axis.startUnixMs,
    axisEndUnixMs: axis.endUnixMs,
    disclosure: `Needle frozen at last output ${Math.floor(age / 1000)} s ago (past the ${Math.round(HEARTBEAT_HORIZON_MS / 1000)} s heartbeat horizon).`,
  }
}

/** The one shared time axis for the run viewer: a fixed window ending now.
 * Takes tracks or events for signature symmetry; the axis is time-windowed,
 * not data-fitted, so needles land at absolute instants on a stable ruler. */
export function sharedAxis(
  _tracksOrEvents: readonly AgentSessionTrack[] | readonly TemporalEventLike[],
  nowUnixMs: number,
  windowMs?: number,
): {startUnixMs: number; endUnixMs: number} {
  const window = typeof windowMs === 'number' && windowMs > 0 ? windowMs : DEFAULT_AXIS_WINDOW_MS
  return {startUnixMs: nowUnixMs - window, endUnixMs: nowUnixMs}
}

/** The stable UI key for a track — the same `${spaceRef}:${sessionRef}` shape
 * the shell's selectedTrackId / threadTrackId state has always held. */
export function trackKey(track: Pick<AgentSessionTrack, 'spaceRef' | 'sessionRef'>): string {
  return `${track.spaceRef}:${track.sessionRef}`
}

const GROUP_DISCLOSURE =
  'agency_read discloses no parent linkage: this SessionSpace is the group and every session in it sits at depth 1 beneath it. Deeper subagent nesting awaits parent linkage in the native reading.'

/** Build the session tracks from an `agency_read` row set. Each space becomes
 * one group track (the closest disclosed thing to a lead); its sessions are
 * members at depth 1. Roster entries name the agent and carry acceptance.
 * Tasks and needles are readings the caller enriches with. */
export function buildTracks(
  rows: readonly AgencyRowLike[],
  roster: Map<string, RosterEntry>,
  _opts?: {nowUnixMs?: number},
): AgentSessionTrack[] {
  const bySpace = new Map<string, {label: string | null; rows: AgencyRowLike[]}>()
  for (const row of rows) {
    if (!row || typeof row.sessionRef !== 'string' || !row.sessionRef) continue
    const spaceRef = typeof row.spaceRef === 'string' && row.spaceRef ? row.spaceRef : '(no space)'
    let space = bySpace.get(spaceRef)
    if (!space) {
      space = {label: typeof row.spaceLabel === 'string' && row.spaceLabel ? row.spaceLabel : null, rows: []}
      bySpace.set(spaceRef, space)
    } else if (!space.label && typeof row.spaceLabel === 'string' && row.spaceLabel) {
      space.label = row.spaceLabel
    }
    space.rows.push(row)
  }

  const tracks: AgentSessionTrack[] = []
  for (const [spaceRef, space] of bySpace) {
    const memberRefs = space.rows.map(row => row.sessionRef)
    tracks.push({
      sessionRef: spaceRef,
      purpose: space.label,
      agentRef: null,
      agentName: null,
      agentAccepted: null,
      spaceRef,
      spaceLabel: space.label,
      depth: 0,
      parentRef: null,
      group: true,
      memberRefs,
      tasks: [],
      needle: null,
      telemetryOn: true,
      budget: {used: null, max: null},
      disclosure: GROUP_DISCLOSURE,
    })
    for (const row of space.rows) {
      const agentRef = typeof row.agentRef === 'string' && row.agentRef ? row.agentRef : null
      const entry = agentRef ? roster.get(agentRef) : undefined
      tracks.push({
        sessionRef: row.sessionRef,
        purpose: typeof row.purpose === 'string' && row.purpose ? row.purpose : null,
        agentRef,
        agentName: entry?.name ?? null,
        agentAccepted: entry ? entry.accepted : null,
        spaceRef,
        spaceLabel: space.label,
        depth: 1,
        parentRef: spaceRef,
        group: false,
        memberRefs: [],
        tasks: [],
        needle: null,
        telemetryOn: true,
        budget: {used: null, max: null},
        disclosure: null,
      })
    }
  }
  return tracks
}
