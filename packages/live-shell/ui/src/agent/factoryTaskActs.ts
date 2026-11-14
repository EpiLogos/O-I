// The Agent rack's acts on its chains' owners (manual §19.15): Factory's Set — its sessions, tasks and their own acts — is the kernel's
// (kernel mode_set.rs, O-I ticket 1004; a session's start and end, a task's run and stop are Factory's own Actions, O-I ticket 1006).
// A group's Model and Effort macros (§19.15) read and select each chain's session's model through AIKit's encounter model-read and
// model-select (the cradle's route: encounter/nativeModel.ts), and the rack reads every chain again once one is selected. Its Budget
// reads each chain's task (encounter_task_read) and sets the task's Budget through AIKit's encounter-task-budget (encounter_task_budget,
// O-I #743). Where each rack's macros stand is Software Factory's (factory_owner rack-macros-read, O-I #842), read for the rack and every
// set it holds, and read again after each write to them.
// The Agent rack's Launch, Stop after and Retry on a chain (sessionSetAct) are its session's own acts in Factory's Set, run as the Session
// grid runs them: the first task written on the session that has not run (its clip's launch, factory.task.run), its track's Stop
// (factory.task.stop) and its track's Retry (factory.attempt.retry), each Factory's own Action by `act` (O-I ticket 1006).
import {useEffect, useState} from 'react'
import {kernelOp} from '../../../../../desktop/cradle/src/kernel/bridge'
import {encounter} from '../../../../../desktop/cradle/src/encounter/client'
import {readNativeModel, type NativeModelReading} from '../../../../../desktop/cradle/src/encounter/nativeModel'
import type {KernelOp, KernelTransportStatus, ModeSet, ModeSetAct} from '../../../../../desktop/cradle/src/kernel/types'
import {readTaskOf, settingsReadingEntry, taskReadingEntry} from '../owners/readers'
import {onOwnerChanged, tellOwnerChanged} from '../owners/notices'
import {windowSets, type ModeSetStore} from '../owners/modeSets'
import {runAct, setActRunner} from '../frame/tracks/kernelSet'
import type {ChainModelReading, RackMacrosAnswer, SessionModelSelect, TaskBudgetWrite} from './devices/sessionChainBindings'
import {rackMacrosReadingOf} from '../inhabitants/sdk/chains'

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

/** A session's own acts in Factory's Set that the Agent rack presses on its chain (§19.15): Launch, its first written task that has not
 * run (that clip's `launch`); Stop after, its track's Stop (`stopTrack`); Retry, its track's retry (`retry`). */
export type SessionSetActKey = 'launch' | 'stopTrack' | 'retry'

const ACT_NAME: Readonly<Record<SessionSetActKey, string>> = {launch: 'Launch', stopTrack: 'Stop after', retry: 'Retry'}

/** Why a session's track carries no such act now, in words: Factory's Set lays an act only where it stands. */
export const SESSION_ACT_ABSENT: Readonly<Record<SessionSetActKey, (session: string) => string>> = {
  launch: session => `Launch: no task written on ${session} waits to run (Factory's Set lays none on its track that has not run): drop a message on its track to write one; one that ran runs again from its track's retry.`,
  stopTrack: session => `Stop after: no task of ${session} is running (Factory's Set gives its track no Stop), so nothing is stopped.`,
  retry: session => `Retry: no task of ${session} has stalled (Factory's Set lights no retry on its track), so nothing runs again.`,
}

/** A session's act in Factory's Set: on the session's track (`<space>:<session>`, kernel mode_set.rs session_track), or for Launch on the
 * first clip of that track that carries one (the tasks lie in the order they were written); null where none stands. Pure. */
export function sessionActOf(set: ModeSet, session: string, key: SessionSetActKey): ModeSetAct | null {
  const track = set.tracks.find(track => track.id.endsWith(`:${session}`))
  if (!track) return null
  if (key !== 'launch') return track.acts?.[key] ?? null
  return set.clips.find(clip => clip.track === track.id && clip.acts?.launch)?.acts?.launch ?? null
}

/** A session's act in Factory's Set pressed from the Agent rack (§19.15: a chain's task row is its session's track's): the Set as the
 * window holds it now (asked again when a newer one is named), the act on the session's track, run as the Session grid runs it (kernelSet.ts
 * runAct, by `act`). Its words when Factory answered; Factory's refusal, the kernel's, or why the track carries no such act, thrown in words. */
export async function sessionSetAct(transport: KernelTransportStatus, session: string, key: SessionSetActKey, store: ModeSetStore = windowSets): Promise<string> {
  const reading = await store.read(transport, 'factory')
  if (reading.state !== 'held') throw new Error(`${ACT_NAME[key]}: Factory's Set is unread, so no act of ${session} is found: ${reading.state === 'unavailable' ? reading.reason : 'the kernel has not answered yet'}.`)
  const act = sessionActOf(reading.answer.set, session, key)
  if (!act) throw new Error(SESSION_ACT_ABSENT[key](session))
  const receipt = await runAct(setActRunner(transport), act)
  if (!receipt.ok) throw new Error(receipt.error)
  return receipt.note ?? `${ACT_NAME[key]}: Factory answered.`
}
