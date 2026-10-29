// Factory's session and task acts on their owner, AIKit (O-I #743; manual §10.9 "the acts on every object", §19.1 "a session is a track, a
// task is a clip"), as the Session and Arrangement press them:
// - a task's Delete takes it off its session: AIKit's encounter-task-remove, on the task's revision read at the press (its record stays in
//   AIKit's task history; Central keeps the task's NOW clearing as it stands);
// - a task's Paste copies it onto a session that holds none: AIKit's encounter-task-copy, which makes the copy as AIKit makes any task — from
//   the receiving session's own standing — and carries the task's own settings; Cut then takes it off its first session;
// - Insert makes a blank task on a session that holds none: AIKit's encounter-task-configure with a short request naming its purpose only
//   (AIKit derives the rest, ai-kit encounter_task_derive.rs);
// - a session's Rename is its own name in its settings (encounter-session-settings `track.name`), against the revision that stands;
// - a session's Delete takes it off the set: the SessionSpace's own detach-agent-session on the Project's spaces that hold it (kernel
//   agency.rs session_detach).
// After each act the readings it moved are asked again: the session's task and settings, and the agency's sessions.
import {useMemo} from 'react'
import {kernelOp} from '../../../../../desktop/cradle/src/kernel/bridge'
import type {KernelOp, KernelTransportStatus} from '../../../../../desktop/cradle/src/kernel/types'
import {readTaskOf, settingsReadingEntry, taskReadingEntry, useSettingsAnswers} from '../owners/readers'
import {tellOwnerChanged} from '../owners/notices'
import {FACTORY_BLANK_PURPOSE, withFactoryTaskActs, type FactoryControlReceipt, type FactoryTaskActs} from '../timeline/factoryTrackAdapter'
import type {UseModeTracks} from '../frame/tracks/modeTracks'
import {useAgencySessions} from './useAgencySessions'
import {projectOfSession} from './worldScope'
import {newTaskRef} from './clipBinding'
import {writeSessionSettings} from './sessionSettings'

const text = (cause: unknown) => cause instanceof Error ? cause.message : String(cause)

/** The readings an act on `sessions` moved, asked again: each one's task and settings, and the agency's sessions (its notice). */
function readAgain(transport: KernelTransportStatus, project: string, sessions: readonly string[], cause: string): void {
  for (const session of sessions) {
    for (const entry of [taskReadingEntry(transport, project, session), settingsReadingEntry(transport, project, session)]) {
      const epoch = entry.snapshot().epoch
      if (epoch !== null) void entry.refresh(epoch)
    }
    tellOwnerChanged({topic: 'agency', cause, agentSession: session})
  }
}

/** One encounter act through the kernel: its receipt, or its refusal in the owner's words. */
async function act(transport: KernelTransportStatus, op: KernelOp): Promise<Record<string, unknown>> {
  const call = await kernelOp(transport, op)
  if (call.error || call.outcome?.result !== 'encounter_owner_act') throw new Error(call.error ?? 'AIKit did not answer the act')
  return call.outcome.data as Record<string, unknown>
}

/** The bound task as AIKit's record names it now (its ref and revision), or why there is none. */
async function boundTask(transport: KernelTransportStatus, project: string, session: string): Promise<{taskRef: string; revision: string} | string> {
  const read = await readTaskOf(transport, project, session)()
  if ('error' in read) return `AIKit did not read the session's task: ${read.error}`
  const record = read.value as {revision?: unknown; request?: {central?: {task_ref?: unknown}}} | null
  const taskRef = record?.request?.central?.task_ref
  if (!record || typeof taskRef !== 'string' || typeof record.revision !== 'string') return 'AIKit reads no task on this session now.'
  return {taskRef, revision: record.revision}
}

/** The acts, over the kernel carrier: `projectOf` names each session's register, `nameOf` its own name as its settings read it. */
export function factoryTaskActs(transport: KernelTransportStatus, projectOf: (session: string) => string, nameOf: (session: string) => string | null): FactoryTaskActs {
  const receipt = async (run: () => Promise<string>): Promise<FactoryControlReceipt> => {
    try { return {ok: true, note: await run()} } catch (cause) { return {ok: false, error: text(cause)} }
  }
  return {
    projectOf,
    nameOf,
    remove: session => receipt(async () => {
      const project = projectOf(session)
      const task = await boundTask(transport, project, session)
      if (typeof task === 'string') throw new Error(task)
      try {
        await act(transport, {op: 'encounter_task_remove', project, agent_session: session, task_ref: task.taskRef, expected_revision: task.revision})
      } finally { readAgain(transport, project, [session], 'a task was taken off its session') }
      return `${task.taskRef} is off the session; AIKit keeps its record in the task's history, and Central keeps its NOW clearing as it stands.`
    }),
    copy: (from, to) => receipt(async () => {
      const project = projectOf(to)
      let made: Record<string, unknown>
      try {
        made = await act(transport, {op: 'encounter_task_copy', project, agent_session: to, from_session: from})
      } finally { readAgain(transport, project, [to], 'a task was copied onto a session') }
      const refusedSettings = typeof made.settings_refused === 'string' ? ` Its settings were not carried: ${made.settings_refused}` : ''
      return `${String(made.from_task_ref)} is copied onto the session as ${String(made.task_ref)}.${refusedSettings}`
    }),
    blank: session => receipt(async () => {
      const project = projectOf(session)
      const taskRef = newTaskRef(FACTORY_BLANK_PURPOSE)
      try {
        const call = await kernelOp(transport, {op: 'encounter_task_configure', project, agent_session: session, request: {purpose: FACTORY_BLANK_PURPOSE, task_ref: taskRef}})
        if (call.error || call.outcome?.result !== 'encounter_task_reading') throw new Error(call.error ?? 'AIKit gave no task record')
      } finally { readAgain(transport, project, [session], 'a blank task was made on a session') }
      return `The session has a new task (${taskRef}), made by AIKit from the session's standing.`
    }),
    rename: (session, name) => receipt(async () => {
      const project = projectOf(session)
      try {
        await writeSessionSettings(transport, project, session, {track: {name}})
      } finally { tellOwnerChanged({topic: 'agency', cause: 'a session was named', agentSession: session}) }
      return `The session is named ${name} (its own settings, on AIKit).`
    }),
    detach: session => receipt(async () => {
      const project = projectOf(session)
      let detached: Record<string, unknown>
      try {
        detached = await act(transport, {op: 'encounter_session_detach', project, agent_session: session})
      } finally { tellOwnerChanged({topic: 'agency', cause: 'a session was taken off the set', agentSession: session}) }
      const spaces = Array.isArray(detached.spaces) ? detached.spaces.length : 0
      return `The session is off the set (detached from ${spaces === 1 ? 'its space' : `${spaces} spaces`}); the session, its task and settings stay AIKit's.`
    }),
  }
}

/** Factory's tracks with their sessions' and tasks' own acts (withFactoryTaskActs): the mode's own hook, then the acts over the kernel
 * carrier, reading the sessions and their settings from the window's one agency store and held settings (never a second poll). With no
 * carrier, the set stands as the mode's hook drew it, and its acts name what they wait for (FACTORY_WAITING). */
export function withTaskActs(use: UseModeTracks): UseModeTracks {
  return reading => {
    const answer = use(reading)
    const transport = reading.transport ?? {kind: 'unavailable', reason: 'The shell has published no kernel carrier for this reading.'}
    const agency = useAgencySessions(transport)
    const rows = agency.rows
    const sessionRefs = useMemo(() => agency.tracks.filter(track => !track.group).map(track => track.sessionRef), [agency.tracks])
    const projectOf = useMemo(() => (session: string) => projectOfSession(rows, session), [rows])
    const own = useSettingsAnswers(transport, sessionRefs, projectOf)
    const acts = useMemo(() => transport.kind === 'unavailable' ? null
      : factoryTaskActs(transport, projectOf, session => own.get(session)?.track.name?.trim() || null), [transport, projectOf, own])
    return useMemo(() => answer && !('waiting' in answer) && acts ? withFactoryTaskActs(answer, agency.tracks, acts) : answer, [answer, acts, agency.tracks])
  }
}
