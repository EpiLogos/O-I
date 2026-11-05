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
// A group's Model and Effort macros (§19.15) read and select each chain's session's model through AIKit's encounter model-read and
// model-select (the cradle's route: encounter/nativeModel.ts), and the rack reads every chain again once one is selected. Its Budget
// reads each chain's task (encounter_task_read) and sets the task's Budget through AIKit's encounter-task-budget (encounter_task_budget,
// O-I #743). Where each rack's macros stand is Software Factory's (factory_owner rack-macros-read, O-I #842), read for the rack and every
// set it holds, and read again after each write to them.
// A task's Launch is one act wherever it is pressed, the Agent rack's Launch on its chain's bound task and the Session grid's ▶ on its
// clip's task (launchSessionTask, O-I 804 round 24): the unit Factory names for the task started on the model AIKit realises on its
// session. The grid's carrier (taskLaunchPort) locates the session's register in Factory first, as the rack does, and stops a task
// through Factory's Stop after of its unit.
import {useEffect, useMemo, useState} from 'react'
import {kernelOp} from '../../../../../desktop/cradle/src/kernel/bridge'
import {encounter} from '../../../../../desktop/cradle/src/encounter/client'
import {readNativeModel, type NativeModelReading} from '../../../../../desktop/cradle/src/encounter/nativeModel'
import type {KernelOp, KernelTransportStatus} from '../../../../../desktop/cradle/src/kernel/types'
import {readTaskOf, settingsReadingEntry, taskReadingEntry, useSettingsAnswers} from '../owners/readers'
import {onOwnerChanged, tellOwnerChanged} from '../owners/notices'
import {FACTORY_BLANK_PURPOSE, withFactoryTaskActs, type FactoryControlReceipt, type FactoryTaskActs} from '../timeline/factoryTrackAdapter'
import type {UseModeTracks} from '../frame/tracks/modeTracks'
import {useAgencySessions} from './useAgencySessions'
import {projectOfSession} from './worldScope'
import {newTaskRef} from './clipBinding'
import {writeSessionSettings} from './sessionSettings'
import type {ChainModelReading, RackMacrosAnswer, SessionModelSelect, TaskBudgetWrite} from './devices/sessionChainBindings'
import {rackMacrosReadingOf} from '../inhabitants/sdk/chains'
import {LAUNCH_REFUSE, STOP_NONE_CURRENT, launchTask, stopAfterTask, type LaunchAt, type Launched} from './devices/taskBindings'
import {ROUTE_WORDS, aikitWriteOp, factoryOwnerWrite, ownerRouteWrite} from './devices/ownerRoutes'
import {catalogueRead} from './devices/useModelCatalogue'
import {padsLocation} from './devices/promptPadsBinding'
import {registerOf} from './worldScope'
import {NOT_FACTORY_WORK, type FactoryTaskLaunchPort} from '../timeline/factoryTrackAdapter'

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

/** One act of the Agent rack's chain list on a session's space (§19.15): AIKit's bench, attach, drag out, hot-swap or detach (Delete, as
 * the session track's own) of a chain's session, or its Decision helper of the space, through the kernel. Its receipt, or AIKit's refusal
 * in its words; either way the agency readers are told, so the rack reads the spaces again. */
export async function chainListAct(transport: KernelTransportStatus,
  op: Extract<KernelOp, {op: 'encounter_session_bench' | 'encounter_session_attach' | 'encounter_session_drag_out' | 'encounter_session_hot_swap'
    | 'encounter_session_decision_helper' | 'encounter_session_detach' | 'encounter_session_group'}>, cause: string): Promise<Record<string, unknown>> {
  try { return await act(transport, op) } finally {
    tellOwnerChanged({topic: 'agency', cause, ...('agent_session' in op ? {agentSession: op.agent_session} : {})})
  }
}

/** A session's model as its harness reports it: AIKit's encounter model-read, bound to the native session it names. */
export async function sessionModelRead(transport: KernelTransportStatus, project: string, session: string): Promise<NativeModelReading> {
  const value = await encounter<unknown>(transport, project, {action: 'model-read', agent_session: session})
  const native = (value as {native_session_id?: unknown} | null)?.native_session_id
  if (typeof native !== 'string' || !native) throw new Error('AIKit\'s model reading names no native session: the session is not open on its harness.')
  return readNativeModel(value, session, native)
}

/** AIKit's model select of one session (its harness's model and reasoning effort), its receipt or AIKit's refusal; the rack reads again. */
export async function sessionModelSelect(transport: KernelTransportStatus, project: string, request: SessionModelSelect): Promise<unknown> {
  try { return await encounter<unknown>(transport, project, request) } finally {
    tellOwnerChanged({topic: 'agency', cause: 'a chain\'s model was selected', agentSession: request.agent_session})
  }
}

/** Each chain's session's model as its harness reports it, by session, while `chains` stand (a group's rack): read again whenever the
 * agency readers are told something moved. Null while none is asked. */
export function useChainModelReadings(transport: KernelTransportStatus, chains: readonly {project: string; session: string}[] | null): ReadonlyMap<string, ChainModelReading> | null {
  const key = chains ? chains.map(chain => `${chain.project}\u0000${chain.session}`).join('\u0001') : null
  const [readings, setReadings] = useState<ReadonlyMap<string, ChainModelReading> | null>(null)
  const [asked, ask] = useState(0)
  useEffect(() => onOwnerChanged('agency', () => ask(n => n + 1)), [])
  useEffect(() => {
    if (!chains?.length || transport.kind === 'unavailable') { setReadings(null); return }
    let live = true
    void Promise.all(chains.map(async ({project, session}): Promise<[string, ChainModelReading]> => {
      try { return [session, {status: 'answered', reading: await sessionModelRead(transport, project, session)}] } catch (error) {
        return [session, {status: 'refused', error: text(error)}]
      }
    })).then(rows => { if (live) setReadings(new Map(rows)) })
    return () => { live = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` names the chains
  }, [transport, key, asked])
  return readings
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

/** A chain's task as AIKit reads it now (encounter_task_read: the record, its revision, and `turns`, the Budget's own), or AIKit's refusal. */
export async function chainTaskRead(transport: KernelTransportStatus, project: string, session: string): Promise<unknown> {
  const read = await readTaskOf(transport, project, session)()
  if ('error' in read) throw new Error(read.error)
  return read.value
}

/** A chain's task Budget set through AIKit (encounter_task_budget), the person's; its receipt or AIKit's refusal; the chain's task is read again. */
export async function chainTaskBudget(transport: KernelTransportStatus, input: TaskBudgetWrite): Promise<Record<string, unknown>> {
  try { return await act(transport, {op: 'encounter_task_budget', ...input}) } finally {
    readAgain(transport, input.project, [input.agent_session], 'a chain\'s Budget was set')
  }
}

/** Where each rack's macros stand, Software Factory's reading (factory_owner rack-macros-read), by the rack's session space, for the rack and
 * every set it holds, in Factory's state for the project; read again when `refresh` is called (after each write to them) and when the
 * agency readers are told something moved. Null while none is asked (no Factory state is located). */
export function useRackMacrosReadings(transport: KernelTransportStatus, where: {statePath: string; projectRef: string} | null,
  spaces: readonly string[] | null): {readings: ReadonlyMap<string, RackMacrosAnswer> | null; refresh: () => void} {
  const key = where && spaces?.length ? JSON.stringify([where.statePath, where.projectRef, ...spaces]) : null
  const [readings, setReadings] = useState<ReadonlyMap<string, RackMacrosAnswer> | null>(null)
  const [asked, ask] = useState(0)
  useEffect(() => onOwnerChanged('agency', () => ask(n => n + 1)), [])
  useEffect(() => {
    if (!where || !spaces?.length || transport.kind === 'unavailable') { setReadings(null); return }
    let live = true
    setReadings(previous => previous ?? new Map(spaces.map(space => [space, {status: 'reading'} as const])))
    void Promise.all(spaces.map(async (space): Promise<[string, RackMacrosAnswer]> => {
      const call = await kernelOp(transport, {op: 'factory_owner', request: {kind: 'rack-macros-read', state_path: where.statePath, project_ref: where.projectRef, space_ref: space}})
      const reading = call.error || call.outcome?.result !== 'factory_development_reading' ? null : rackMacrosReadingOf(call.outcome.data)
      return [space, reading ? {status: 'answered', reading} : {status: 'refused', error: call.error ?? 'Software Factory answered without the rack\'s macros.'}]
    })).then(rows => { if (live) setReadings(new Map(rows)) })
    return () => { live = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` names the racks
  }, [transport, key, asked])
  return {readings: key ? readings : null, refresh: () => ask(n => n + 1)}
}

/** A task's Launch wherever it is pressed (§19.1 Trigger: "starts the task when you press its launch"): the unit Factory names for the task,
 * started on the model AIKit realises on its session (devices/taskBindings.ts launchTask: aikit_write realise, then factory_owner
 * attempt-launch, under the project's factory.attempt.launch grant, which the kernel resolves and the owner gives). Factory's answer, or the
 * owners' refusals thrown in their words. */
export function launchSessionTask(transport: KernelTransportStatus, at: LaunchAt): Promise<Launched> {
  return launchTask({
    owner: request => factoryOwnerWrite(transport, request, `factory_owner ${request.kind}`),
    model: () => sessionModelRead(transport, at.project, at.session),
    catalogue: () => catalogueRead(transport),
    realise: request => ownerRouteWrite(transport, aikitWriteOp(request), ROUTE_WORDS.realise).then(answer => answer.data),
  }, at)
}

/** The Factory state of a session's register, as the Agent rack locates it (`factory development locate`, devices/sessionCustody.ts
 * factoryLocateOp): its state path, or Factory's words for why none stands, after `what`. */
async function factoryStateOf(transport: KernelTransportStatus, project: string, what: string): Promise<{statePath: string} | {none: string}> {
  const register = registerOf(project)
  const where = padsLocation(await factoryOwnerWrite(transport, register === null ? {kind: 'locate'} : {kind: 'locate', project: register}, '`factory development locate`'))
  return where && 'statePath' in where ? {statePath: where.statePath} : {none: `${what}: ${where?.why ?? 'Factory answered its locate with no row.'}`}
}

/** A receipt saying the task is not Factory's work (its register keeps no Factory state, Factory names no unit for it, or no attempt of it
 * is current), in Factory's words: nothing of Factory's moved, and the grid acts as it did before Factory's (NOT_FACTORY_WORK). */
const notFactoryWork = (error: string) => ({ok: false as const, error, document: {status: NOT_FACTORY_WORK}})

/** The Session grid's carrier for a Factory task's ▶ (timeline/factoryTrackAdapter.ts FactoryTaskLaunchPort, O-I 804 round 24): in the
 * Factory state of the register its session was read under, Launch is the rack's own (launchSessionTask), its receipt's `document` saying
 * whether Factory launched the unit or had launched it already, and Stop is Factory's Stop after of the unit the task's current attempt
 * stands on (stopAfterTask). A task that is not Factory's work says so (notFactoryWork) before anything of Factory's moves; every other
 * refusal comes back in its owner's words. */
export function taskLaunchPort(transport: KernelTransportStatus, projectOf: (session: string) => string): FactoryTaskLaunchPort {
  return {
    launch: async (session, taskRef) => {
      try {
        const project = projectOf(session)
        const state = await factoryStateOf(transport, project, 'Launch')
        if ('none' in state) return notFactoryWork(state.none)
        const launched = await launchSessionTask(transport, {statePath: state.statePath, taskRef, session, project})
        tellOwnerChanged({topic: 'agency', cause: 'a task was launched from its clip', agentSession: session})
        return {ok: true, note: launched.said, document: {status: launched.status, attemptRef: launched.attemptRef}}
      } catch (cause) {
        const words = text(cause)
        return words === LAUNCH_REFUSE.noUnit(taskRef) ? notFactoryWork(words) : {ok: false, error: words}
      }
    },
    stop: async (session, taskRef) => {
      try {
        const state = await factoryStateOf(transport, projectOf(session), 'Stop after')
        if ('none' in state) return notFactoryWork(state.none)
        const unit = await stopAfterTask(request => factoryOwnerWrite(transport, request, `factory_owner ${request.kind}`), state.statePath, taskRef)
        tellOwnerChanged({topic: 'agency', cause: 'a task was asked to stop from its clip', agentSession: session})
        return {ok: true, note: `Software Factory was asked to stop ${unit.workflowUnitRef} of ${unit.runRef}, the unit ${taskRef} stands current on.`}
      } catch (cause) {
        const words = text(cause)
        return words === STOP_NONE_CURRENT(taskRef) ? notFactoryWork(words) : {ok: false, error: words}
      }
    },
  }
}
