// How each task on Factory's tracks stands, as Factory reads it (DLW §6, §19.1 "A task is drawn by how it stands"). The shell decides
// nothing here: it carries the owners' own readings to Factory and draws Factory's answer.
//
// The evidence, each an owner's reading carried verbatim:
//   - AIKit's encounter `status` for the task's session (aikit-cli encounter_service.rs `EncounterRequest::Status`): its lane state —
//     Resident, TurnInFlight, Opening, Released… — its transport fault, and the permission requests it holds; or AIKit's refusal in its
//     own words;
//   - the session's check-ins: its temporal events, the frame's one temporal read (agentRunModel.ts eventsForSession), counted with
//     the newest instant;
//   - whether AIKit binds a task to the session (`encounter_task_read` answered one) and the task's own ref.
// Factory answers `factory.task-activity/v1` (factory/src/task_activity.rs): for each session the manual's word — queued · running ·
// stalled · stopped · done, or none where no evidence decides — with the evidence in words, whether the track lights a retry, the
// rung that decided, and, when its Factory state is located, the custody of the task's work and the closure a closed one carries.
// A stall is Factory's: no check-in within its bound, or a permission request pending, with the task open. Nothing is guessed here:
// until Factory answers, a task's state is unknown and says why, and a needle stands still.
//
// Ported: the evidence ladder, the three axes and the stall are OpenRig's (packages/daemon/src/domain/activity-taxonomy.ts,
// seat-activity-service.ts, parked-query.ts), ported into Factory, not here.
import {useEffect, useMemo, useState} from 'react'
import {kernelOp} from '../../../../../desktop/cradle/src/kernel/bridge'
import type {KernelTransportStatus} from '../../../../../desktop/cradle/src/kernel/types'
import {encounter} from '../../../../../desktop/cradle/src/encounter/client'
import {eventsForSession, type AgentSessionTrack, type TaskClip, type TaskStanding, type TaskState, type TemporalEventLike} from './agentRunModel'

export const TASK_ACTIVITY_REQUEST = 'factory.task-activity-request/v1'
export const TASK_ACTIVITY_READING = 'factory.task-activity/v1'
/** Where the check-ins were read: the kernel's temporal read the frame holds. */
export const CHECK_IN_SOURCE = 'oi:temporal_events_read'

/** One session's reading in Factory's words (task_activity.rs TaskStateReading); fields the shell draws. */
export interface TaskStateReading {
  readonly agent_session: string
  readonly task_ref?: string
  readonly word: TaskStanding['word']
  readonly why: string
  readonly retry: boolean
  readonly decided_by: string | null
  readonly display?: string
  readonly obligation?: {readonly state?: string; readonly custody?: readonly {readonly custody_ref?: string; readonly state?: string; readonly closure?: {readonly reason?: string; readonly target?: string}}[]}
}

/** The owners' readings for one session, as Factory takes them. */
export interface TaskEvidence {
  agent_session: string
  task_ref?: string
  bound: boolean
  connection?: unknown
  connection_refusal?: string
  connection_read_at_unix_ms?: number
  check_ins?: {source_ref: string; count: number; latest_unix_ms?: number; read_at_unix_ms: number}
}

/** AIKit's status reading for one session, or its refusal, with when it was read. */
export type StatusReading = {readonly connection: unknown; readonly readAtUnixMs: number} | {readonly refusal: string; readonly readAtUnixMs: number}

/** The real task a track carries (its first non-soft-stop clip), or null. Pure. */
export const realTask = (track: AgentSessionTrack): TaskClip | null => track.group ? null : track.tasks.find(clip => !clip.softStop) ?? null

/** One session's evidence from the readings the shell holds. Pure. */
export function taskEvidenceOf(track: AgentSessionTrack, task: TaskClip, status: StatusReading | undefined, events: readonly TemporalEventLike[],
  readAtUnixMs: number): TaskEvidence {
  const instants = eventsForSession([...events], track.sessionRef).map(event => event.instant_unix_ms).filter((at): at is number => typeof at === 'number')
  return {
    agent_session: track.sessionRef,
    ...(task.taskRef ? {task_ref: task.taskRef} : {}),
    // The track carries a task only where AIKit's task reading named one (agentRunModel.ts buildTaskClips).
    bound: true,
    ...(status && 'connection' in status ? {connection: status.connection, connection_read_at_unix_ms: status.readAtUnixMs} : {}),
    ...(status && 'refusal' in status ? {connection_refusal: status.refusal, connection_read_at_unix_ms: status.readAtUnixMs} : {}),
    check_ins: {source_ref: CHECK_IN_SOURCE, count: instants.length, ...(instants.length ? {latest_unix_ms: Math.max(...instants)} : {}), read_at_unix_ms: readAtUnixMs},
  }
}

/** Factory's request for the given sessions. Pure. */
export function taskActivityRequest(evidence: readonly TaskEvidence[]): {schema: string; tasks: TaskEvidence[]} {
  return {schema: TASK_ACTIVITY_REQUEST, tasks: [...evidence]}
}

/** Factory's reading, by session; null when the document is not Factory's reading. Pure. */
export function readingsBySession(data: unknown): Map<string, TaskStateReading> | null {
  const doc = data && typeof data === 'object' ? data as {schema?: unknown; tasks?: unknown} : null
  if (!doc || doc.schema !== TASK_ACTIVITY_READING || !Array.isArray(doc.tasks)) return null
  const out = new Map<string, TaskStateReading>()
  for (const row of doc.tasks) {
    if (row && typeof row === 'object' && typeof (row as TaskStateReading).agent_session === 'string' && typeof (row as TaskStateReading).why === 'string') {
      out.set((row as TaskStateReading).agent_session, row as TaskStateReading)
    }
  }
  return out
}

/** The closure a done task's custody carries, in Factory's words: `completed no-follow-on`, `released superseded → task:2`. Pure. */
export function closureWords(reading: TaskStateReading): string | null {
  const closed = (reading.obligation?.custody ?? []).filter(row => row.closure?.reason)
  if (!closed.length) return null
  return closed.map(row => `${row.state ?? 'closed'} ${row.closure!.reason}${row.closure!.target ? ` → ${row.closure!.target}` : ''}`).join('; ')
}

/** The track's drawing state for Factory's word: each of the manual's five words draws as itself. Pure. */
const DRAWN: Readonly<Record<NonNullable<TaskStanding['word']>, TaskState>> = {queued: 'queued', running: 'running', stalled: 'stalled', stopped: 'stopped', done: 'done'}

/** What the tasks stand on: Factory's readings, or why there are none (being read, or refused, in Factory's words), and the check-in
 * bound each register's reading was decided against (`bound_ms`, by session). */
export type TaskActivityAnswer = {readonly bySession: ReadonlyMap<string, TaskStateReading>; readonly unread: ReadonlyMap<string, string>;
  readonly boundMs?: ReadonlyMap<string, number>}

export const TASK_ACTIVITY_PENDING = 'Factory has not read how this task stands yet: its reading arrives with the next agency read.'

/** The tracks with each real task standing as Factory reads it, and each needle stalled only where Factory says the task stalled. A task
 * Factory did not read stands unknown, with the reason. Pure. */
export function withTaskActivity(tracks: readonly AgentSessionTrack[], answer: TaskActivityAnswer): AgentSessionTrack[] {
  return tracks.map(track => {
    if (track.group) return track
    const task = realTask(track)
    if (!task) return track
    const reading = answer.bySession.get(track.sessionRef)
    const bound = answer.boundMs?.get(track.sessionRef)
    const standing: TaskStanding | undefined = reading ? {word: reading.word ?? null, why: reading.why, retry: reading.retry === true,
      decidedBy: reading.decided_by ?? null, closure: closureWords(reading), ...(bound !== undefined ? {boundMs: bound} : {})} : undefined
    const state: TaskState = standing?.word ? DRAWN[standing.word] : 'unknown'
    const disclosure = standing ? standing.why : answer.unread.get(track.sessionRef) ?? TASK_ACTIVITY_PENDING
    const tasks = track.tasks.map(clip => clip !== task ? clip : {...clip, state, disclosure, ...(state === 'queued' ? {startUnixMs: null} : {}),
      ...(standing ? {standing} : {})})
    const needle = track.needle ? {...track.needle, state: standing?.word === 'stalled' ? 'stalled' as const : standing?.word === 'running' ? 'live' as const : 'idle' as const,
      disclosure} : track.needle
    return {...track, tasks, needle}
  })
}

/** The kernel op as the read calls it. */
export type ActivityCall = (op: Record<string, unknown>) => Promise<{error?: string; outcome?: {result: string; data?: unknown} | null}>

const carried = (transport: KernelTransportStatus): ActivityCall => op =>
  kernelOp(transport, op as Parameters<typeof kernelOp>[1]) as unknown as ReturnType<ActivityCall>

/** AIKit's status of each session, each read in its own register; a refusal is kept in AIKit's words. */
export async function readStatuses(transport: KernelTransportStatus, sessions: readonly {sessionRef: string; project: string}[],
  now: () => number = Date.now): Promise<Map<string, StatusReading>> {
  const out = new Map<string, StatusReading>()
  for (const {sessionRef, project} of sessions) {
    try {
      const connection = await encounter<unknown>(transport, project, {action: 'status', agent_session: sessionRef})
      out.set(sessionRef, {connection, readAtUnixMs: now()})
    } catch (cause) {
      out.set(sessionRef, {refusal: cause instanceof Error ? cause.message : String(cause), readAtUnixMs: now()})
    }
  }
  return out
}

/** The state path Factory's locate names for the register (`oi.factory-source-discovery/v1`: its first row, `located`), else null — the
 * same row devices/promptPadsBinding.ts padsLocation reads, read here without the device bindings it carries into the first load. Pure. */
export function locatedState(located: unknown): string | null {
  const rows = located && typeof located === 'object' ? (located as {locations?: unknown}).locations : null
  const row = Array.isArray(rows) ? rows.find(item => item && typeof item === 'object') as {state?: unknown; location?: {statePath?: unknown}} | undefined : undefined
  return row?.state === 'located' && typeof row.location?.statePath === 'string' && row.location.statePath ? row.location.statePath : null
}

/** Factory's reading for one register's sessions: its state located (`factory project locate`), then the reading asked against it, or
 * without one where Factory keeps none there (custody is then not read, and the reading says so). */
export async function readTaskActivity(call: ActivityCall, project: string, evidence: readonly TaskEvidence[]): Promise<TaskActivityAnswer> {
  const sessions = evidence.map(item => item.agent_session)
  const refusedAll = (why: string): TaskActivityAnswer => ({bySession: new Map(), unread: new Map(sessions.map(session => [session, why]))})
  if (!evidence.length) return {bySession: new Map(), unread: new Map()}
  const located = await call({op: 'factory_owner', request: project ? {kind: 'locate', project} : {kind: 'locate'}})
  const statePath = !located.error && located.outcome?.result === 'factory_development_reading' ? locatedState(located.outcome.data) : null
  const read = await call({op: 'factory_owner', request: {kind: 'task-activity-read', ...(statePath ? {state_path: statePath} : {}), request: taskActivityRequest(evidence)}})
  if (read.error) return refusedAll(`Factory did not read how this task stands: ${read.error}`)
  const data = read.outcome?.result === 'factory_development_reading' ? read.outcome.data : null
  const bySession = readingsBySession(data)
  if (!bySession) return refusedAll('Factory answered no task-activity reading (factory.task-activity/v1): the Factory installed here may predate it.')
  const bound = (data as {bound_ms?: unknown}).bound_ms
  return {bySession, unread: new Map(sessions.filter(session => !bySession.has(session)).map(session => [session, 'Factory\'s reading names no state for this session.'])),
    ...(typeof bound === 'number' && bound > 0 ? {boundMs: new Map([...bySession.keys()].map(session => [session, bound]))} : {})}
}

/** How each task stands, read again whenever the tracks are read again (the agency reading's instant), a check-in arrives, or a task
 * changes. One status per session with a task, one locate and one Factory reading per register. */
export function useTaskActivity(transport: KernelTransportStatus, tracks: readonly AgentSessionTrack[], events: readonly TemporalEventLike[],
  projectOf: (sessionRef: string) => string, readAtUnixMs: number): TaskActivityAnswer {
  const [answer, setAnswer] = useState<{key: string; value: TaskActivityAnswer} | null>(null)
  const wanted = useMemo(() => tracks.flatMap(track => {
    const task = realTask(track)
    if (!task) return []
    const instants = eventsForSession([...events], track.sessionRef).map(event => event.instant_unix_ms).filter((at): at is number => typeof at === 'number')
    return [{track, task, project: projectOf(track.sessionRef), latest: instants.length ? Math.max(...instants) : null, count: instants.length}]
  }), [tracks, events, projectOf])
  const key = JSON.stringify([transport, readAtUnixMs, wanted.map(item => [item.track.sessionRef, item.project, item.task.taskRef ?? null, item.latest, item.count])])
  useEffect(() => {
    if (transport.kind === 'unavailable' || !wanted.length) return
    let live = true
    void (async () => {
      const statuses = await readStatuses(transport, wanted.map(item => ({sessionRef: item.track.sessionRef, project: item.project})))
      const byProject = new Map<string, TaskEvidence[]>()
      const now = Date.now()
      for (const item of wanted) {
        byProject.set(item.project, [...(byProject.get(item.project) ?? []), taskEvidenceOf(item.track, item.task, statuses.get(item.track.sessionRef), events, now)])
      }
      const bySession = new Map<string, TaskStateReading>()
      const unread = new Map<string, string>()
      const boundMs = new Map<string, number>()
      for (const [project, evidence] of byProject) {
        const read = await readTaskActivity(carried(transport), project, evidence)
        for (const [session, reading] of read.bySession) bySession.set(session, reading)
        for (const [session, why] of read.unread) unread.set(session, why)
        for (const [session, bound] of read.boundMs ?? []) boundMs.set(session, bound)
      }
      if (live) setAnswer({key, value: {bySession, unread, boundMs}})
    })()
    return () => { live = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  const reason = transport.kind === 'unavailable' ? transport.reason ?? 'the shell has no kernel carrier' : null
  const unreached = useMemo<TaskActivityAnswer | null>(() => reason === null ? null
    : {bySession: new Map(), unread: new Map(wanted.map(item => [item.track.sessionRef, `Factory is not reached: ${reason}.`]))}, [reason, wanted])
  // The last answer stands until the next arrives, so a task never flickers to unknown between reads.
  return unreached ?? answer?.value ?? NOTHING_READ
}

const NOTHING_READ: TaskActivityAnswer = {bySession: new Map(), unread: new Map()}
