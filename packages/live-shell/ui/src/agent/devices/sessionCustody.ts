// One session's custody as Factory keeps it, read once for every view of the session that needs it (lane W11; manual §19.4 Custody,
// §10.5 the transport's Re-enable): the project's Factory state (`factory development locate`), its custody list (factory_owner
// custody-list), the Position the session's agent holds (AIKit's population) and the session's bound task as its work (its task record's
// request.central.task_ref). The chain's Custody draws it (FactoryDeviceChain.tsx). The Clip view's edits take the hold through it before
// they write (§19.4: "the agent does not overwrite your edit"), and the transport's Re-enable is Hand back over it, as Live's Re-enable
// Automation is (DLW build ruling 2026-11-05). Every read is the window's shared owner reading, keyed as the chain keys it, so the three
// views ask the kernel once.
import {useMemo} from 'react'
import type {KernelOp, KernelTransportStatus} from '../../../../../../desktop/cradle/src/kernel/types'
import {currentIdentity} from '../../../../../../desktop/cradle/src/nara/identity/current'
import type {DesignBinding} from '../../frame/devices/designed'
import {useOwnerOp} from '../../owners/ownerCall'
import {useTaskAnswer} from '../../owners/readers'
import {registerOf, ROOT_REGISTER} from '../worldScope'
import {factoryOwnerWrite, refusalWords} from './ownerRoutes'
import {padsLocation} from './promptPadsBinding'
import {custodyBinding, holdBeforeEdit, type CustodyPorts, type CustodyRead} from './sessionChainBindings'
import {usePopulationAnswer} from './usePopulationAnswer'
import type {WorkcellAnswer} from './workcellBindings'

/** Factory's locate of a register's project (the Prompt pads', Custody's and Retry's Factory state): the root register names none. */
export const factoryLocateOp = (register: string | null): KernelOp => ({op: 'factory_owner' as const, request: register === null ? {kind: 'locate'} : {kind: 'locate', project: register}})

/** Factory's custody list of one Factory state, as the kernel is asked it. */
export const custodyListOp = (statePath: string): KernelOp => ({op: 'factory_owner', request: {kind: 'custody-list', state_path: statePath}})

/** The session whose custody is read: its ref, its register's project and the agent it runs. */
export interface CustodyAt {
  readonly sessionRef: string
  readonly project: string
  readonly agentRef?: string | null
}

/** Factory's custody of the session's work, as the readings answered it. Pure. */
export function custodyReadOf(statePath: string | null, listing: {readonly status: CustodyListStatus; readonly value: {readonly data?: unknown} | null; readonly error: string | null},
  population: WorkcellAnswer, task: unknown, agentRef: string | null | undefined): CustodyRead {
  const positions = population.status === 'answered' && population.value && typeof population.value === 'object'
    && Array.isArray((population.value as {positions?: unknown}).positions) ? (population.value as {positions: {position_ref?: unknown; occupancy?: {agent_ref?: unknown}}[]}).positions : []
  const heldBy = (ref: string | null | undefined) => (ref ? positions.find(row => row.occupancy?.agent_ref === ref && typeof row.position_ref === 'string')?.position_ref as string | undefined ?? null : null)
  const central = (task as {request?: {central?: {task_ref?: unknown}}} | null | undefined)?.request?.central
  return {statePath, listing: statePath ? {status: listing.status, value: listing.value?.data ?? null, error: listing.error ? refusalWords(listing.error) : null} : null,
    agentPosition: heldBy(agentRef), work: typeof central?.task_ref === 'string' && central.task_ref.trim() ? central.task_ref : null}
}
type CustodyListStatus = NonNullable<CustodyRead['listing']>['status']

export interface SessionCustody {
  /** Factory's custody of the session's work as read; null where no session is named. */
  readonly read: CustodyRead | null
  /** The project's Factory state, once located. */
  readonly statePath: string | null
  /** Factory's custody hold through the kernel, the custody list read again after it; absent with no carrier or no session. */
  readonly hold?: CustodyPorts['hold']
  /** The custody list read again. */
  readonly refresh: () => void
  /** The hold an edit of what the agent holds takes first (holdBeforeEdit), as the person current at the edit. */
  readonly holdFirst: (subject: string) => Promise<void>
}

/** What no session reads through: nothing is asked. */
const NO_SESSION: KernelTransportStatus = {kind: 'unavailable', reason: 'No session is named, so no custody is read.'}

/** One session's custody: Factory's state located, its custody list, the agent's Position and the session's work, each the shared
 * reading. `at` null reads nothing. */
export function useSessionCustody(transport: KernelTransportStatus, at: CustodyAt | null): SessionCustody {
  const carried = at ? transport : NO_SESSION
  const register = at ? registerOf(at.project) : null
  const named = at !== null
  const locateOp = useMemo(() => (named ? factoryLocateOp(register) : null), [named, register])
  const located = useOwnerOp(carried, locateOp, 'factory_development_reading').reading
  const where = located.status === 'answered' ? padsLocation(located.value?.data) : null
  const statePath = where && 'projectRef' in where ? where.statePath : null
  const listOp = useMemo(() => (statePath ? custodyListOp(statePath) : null), [statePath])
  const list = useOwnerOp(carried, listOp, 'factory_development_reading')
  const population = usePopulationAnswer(carried, register)
  const task = useTaskAnswer(carried, at?.sessionRef ?? null, at?.project ?? ROOT_REGISTER).reading
  const agentRef = at?.agentRef ?? null
  const read = useMemo(() => (named ? custodyReadOf(statePath, list.reading, population, task.value, agentRef) : null),
    [named, statePath, list.reading, population, task, agentRef])
  const refresh = list.refresh
  const hold = useMemo((): CustodyPorts['hold'] => (named && transport.kind !== 'unavailable'
    ? request => factoryOwnerWrite(transport, request, '`factory development custody hold`').finally(refresh) : undefined), [named, transport, refresh])
  const holdFirst = useMemo(() => (subject: string) => holdBeforeEdit(read, currentIdentity()?.reading.person_ref ?? null, hold, subject), [read, hold])
  return {read, statePath, ...(hold ? {hold} : {}), refresh, holdFirst}
}

/** Re-enable's Hand back on the selected session: Custody's own binding over the session's custody, written as the current person. Null
 * where no session is selected. */
export function useHandBack(transport: KernelTransportStatus, track: {readonly sessionRef: string; readonly project?: string; readonly agentRef?: string | null} | null | undefined): DesignBinding | null {
  const sessionRef = track?.sessionRef ?? null, project = track?.project ?? ROOT_REGISTER, agentRef = track?.agentRef ?? null
  const at = useMemo(() => (sessionRef ? {sessionRef, project, agentRef} : null), [sessionRef, project, agentRef])
  const custody = useSessionCustody(transport, at)
  const person = currentIdentity()?.reading.person_ref ?? null
  return useMemo(() => (custody.read ? custodyBinding({sessionRef, agent: {}, person, custody: custody.read}, null,
    custody.hold ? {hold: custody.hold, personNow: () => currentIdentity()?.reading.person_ref ?? null} : {}) : null), [sessionRef, person, custody.read, custody.hold])
}

/** Why Re-enable stands dark with no session selected. */
export const HAND_BACK_NO_SESSION = 'No session is selected, so nothing an agent holds is read.'

/** The transport's Re-enable as Hand back (manual §10.5; DLW build ruling 2026-11-05, as Live's Re-enable Automation): its light is the
 * custody listing's hand_back over what the selected session's agent holds, never a shell flag (none while unread); it presses only while
 * lit, giving back each hold through Factory's custody hold (Custody's own handBack), and says Factory's answer or refusal. Pure. */
export function handBackSlot(custody: DesignBinding | null, said: (line: string) => void): {press?: () => void; lit?: boolean; why: string | null} {
  if (!custody) return {why: HAND_BACK_NO_SESSION}
  const lit = custody.values.handBackLit
  const why = custody.standing?.handBack?.disabled ?? custody.standing?.handBackLit?.disabled ?? null
  const press = lit === true && !custody.standing?.handBack?.disabled
    ? () => { void custody.write?.([{key: 'handBack', value: true}]).then(() => said('↳ Given back: the agent may take it up again.'),
      cause => said(`↳ Refused — ${cause instanceof Error ? cause.message : String(cause)}`)) }
    : undefined
  return {...(press ? {press} : {}), ...(typeof lit === 'boolean' ? {lit} : {}), why}
}
