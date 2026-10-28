// The Sky's Share page on its owners (DLW §22.1, §24.6): the consented presences SharedField lists to the caller, through the kernel's
// nara_presence `list` (desktop/cradle/kernel/src/nara_presence.rs Request::List; SharedField's `nara-presences`, oi.nara-presences/v1).
// Each presence names its consent's publishing Participant (consent.participant_ref) and its target (consent.target_ref). Which of
// them is the person is SharedField's to say, from the caller's own authority in each field (its `snapshot`, my_authority; the kernel's
// shared_field op). So the list is split as follows:
//   - a presence one of the person's Participants published is a consent they gave. It goes under "You share with"
//     (presence.consents, its target).
//   - a presence whose target is one of the person's Participants was given to them. It goes under "Shared with you"
//     (presence.shared, its publisher).
// Each row carries the other Participant's ref and SharedField's chosen name for it where it gives one, the consent's ref, the day it
// was granted, and whether it permits now (granted and its projection published, not withdrawn).
// With no presences listed, both lists are empty, whoever the person is, so the snapshot is asked only when there are presences to
// split. Read each time the Technē devices open, since a Share or Withdraw elsewhere moves the list. Withdraw (the design's
// `presence.withdraw`, a consent ref of yours) is the person's own consent act: nara_presence `withdraw` {projection_ref, consent_ref, a
// fresh withdrawal_ref} (SharedField's withdraw_nara, oi.nara-presence-withdrawal/v1), then the list is read again; SharedField refuses
// in its words a presence it does not host, one withdrawn already, or another's consent.
// Pure apart from the kernel calls, which take the call they are given, and the small store the views share.
import {useEffect, useSyncExternalStore} from 'react'
import {detectTransport, kernelOp, type KernelOpCall} from '../../../../../../../desktop/cradle/src/kernel/bridge'
import type {KernelOp} from '../../../../../../../desktop/cradle/src/kernel/types'
import type {Standing, Value} from '../../../frame/devices/designed'

/** One row of the design's lists: the other Participant, its name where SharedField gives one, the consent, its grant, and whether it permits now. */
export interface ConsentRow {readonly ref: string; readonly name?: string; readonly consent: string; readonly granted: string; readonly permitted: boolean
  /** The presence's projection, which a withdrawal names (SharedField's projection_ref). */
  readonly projection?: string}
export type SkyPresences = {readonly ok: true; readonly mine: readonly ConsentRow[]; readonly theirs: readonly ConsentRow[]; readonly listed: number}
  | {readonly ok: false; readonly reason: string; readonly busy?: boolean}

const rec = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x)
const str = (x: unknown): x is string => typeof x === 'string' && x.length > 0

interface Presence {readonly state: string; readonly projection_ref?: string; readonly consent: {readonly consent_ref: string; readonly participant_ref: string; readonly target_ref: string; readonly granted_at: string; readonly state: string}}

/** The list as SharedField answered it, or the reason in words. */
export function readPresenceList(answer: KernelOpCall): {ok: true; presences: Presence[]} | {ok: false; reason: string} {
  if (answer.outcome == null) return {ok: false, reason: answer.error ?? 'The kernel did not answer nara_presence `list`.'}
  const outcome = answer.outcome as {result?: string; data?: unknown}
  const data = outcome.data
  if (outcome.result !== 'nara_presence_consent' || !rec(data)) return {ok: false, reason: `The kernel answered \`${outcome.result ?? 'unknown'}\`, not the presence consents.`}
  if (data.state === 'unavailable') return {ok: false, reason: `SharedField is unavailable: ${str(data.detail) ? data.detail : 'no detail'}`}
  if (data.schema !== 'oi.nara-presences/v1' || !Array.isArray(data.presences)) return {ok: false, reason: 'SharedField answered no oi.nara-presences/v1 list.'}
  const presences = data.presences.filter((p): p is Presence => rec(p) && str(p.state) && rec(p.consent) && str(p.consent.consent_ref) && str(p.consent.participant_ref)
    && str(p.consent.target_ref) && str(p.consent.granted_at) && str(p.consent.state))
  if (presences.length !== data.presences.length) return {ok: false, reason: 'SharedField listed a presence without its consent\'s participant, target and grant.'}
  return {ok: true, presences}
}

/** The person's Participants and the chosen names SharedField gives, from its snapshot; or the reason in words. */
export function readAuthority(answer: KernelOpCall): {ok: true; mine: Set<string>; names: Map<string, string>} | {ok: false; reason: string} {
  if (answer.outcome == null) return {ok: false, reason: answer.error ?? 'The kernel did not answer SharedField\'s snapshot.'}
  const outcome = answer.outcome as {result?: string; data?: unknown}
  const data = outcome.data
  if (outcome.result !== 'shared_field_reading' || !rec(data)) return {ok: false, reason: `The kernel answered \`${outcome.result ?? 'unknown'}\`, not SharedField's snapshot.`}
  if (data.state === 'unavailable') return {ok: false, reason: `SharedField is unavailable: ${str(data.detail) ? data.detail : 'no detail'}`}
  if (data.schema !== 'oi.shared-field.snapshot/v1' || !Array.isArray(data.my_authority)) return {ok: false, reason: 'SharedField\'s snapshot carries no authority of yours.'}
  const mine = new Set(data.my_authority.flatMap(row => (rec(row) && str(row.participant_ref) && row.revoked !== true ? [row.participant_ref] : [])))
  const names = new Map((Array.isArray(data.participants) ? data.participants : []).flatMap((row): [string, string][] =>
    (rec(row) && str(row.participant_ref) && rec(row.presentation) && str(row.presentation.chosen_name) ? [[row.participant_ref, row.presentation.chosen_name]] : [])))
  return {ok: true, mine, names}
}

/** The two lists from SharedField's presences and the person's Participants. */
export function splitPresences(presences: readonly Presence[], mine: ReadonlySet<string>, names: ReadonlyMap<string, string>): {mine: ConsentRow[]; theirs: ConsentRow[]} {
  const row = (other: string, p: Presence): ConsentRow => ({ref: other, ...(names.has(other) ? {name: names.get(other)!} : {}), consent: p.consent.consent_ref,
    granted: p.consent.granted_at, permitted: p.consent.state === 'granted' && p.state === 'published', ...(str(p.projection_ref) ? {projection: p.projection_ref} : {})})
  return {mine: presences.filter(p => mine.has(p.consent.participant_ref)).map(p => row(p.consent.target_ref, p)),
    theirs: presences.filter(p => mine.has(p.consent.target_ref)).map(p => row(p.consent.participant_ref, p))}
}

export type PresenceCall = (op: KernelOp) => Promise<KernelOpCall>
const INITIAL: SkyPresences = {ok: false, reason: 'Reading the presence consents SharedField lists…', busy: true}
let state: SkyPresences = INITIAL
let sequence = 0
let call: PresenceCall = op => kernelOp(detectTransport(), op)
const listeners = new Set<() => void>()
const setState = (next: SkyPresences) => { state = next; for (const listener of [...listeners]) listener() }

export function skyPresences(): SkyPresences { return state }

async function ask(op: KernelOp): Promise<KernelOpCall> {
  try { return await call(op) } catch (error) { return {outcome: null, error: `The kernel could not be asked: ${error instanceof Error ? error.message : String(error)}`} as KernelOpCall }
}

/** Read the list, and the person's Participants where there are presences to split; only the newest read stands. */
export async function readSkyPresences(): Promise<void> {
  const ticket = ++sequence
  if (!state.ok) setState(INITIAL)
  const listed = readPresenceList(await ask({op: 'nara_presence', project: 'O-I', request: {operation: 'list'}}))
  if (ticket !== sequence) return
  if (!listed.ok) { setState({ok: false, reason: listed.reason}); return }
  if (!listed.presences.length) { setState({ok: true, mine: [], theirs: [], listed: 0}); return }
  const authority = readAuthority(await ask({op: 'shared_field', request: {kind: 'snapshot'}}))
  if (ticket !== sequence) return
  if (!authority.ok) { setState({ok: false, reason: `SharedField lists ${listed.presences.length} presence(s), but which are yours it cannot say here: ${authority.reason}`}); return }
  setState({ok: true, ...splitPresences(listed.presences, authority.mine, authority.names), listed: listed.presences.length})
}

/** Withdraw a consent you gave (the design's `presence.withdraw`): SharedField's withdraw_nara through the kernel's nara_presence, with a fresh
 * withdrawal ref, then the list read again. Throws in SharedField's words, or why it cannot be asked. */
export async function withdrawSkyPresence(consentRef: string, now: () => number = Date.now): Promise<void> {
  if (!state.ok) throw new Error(`The consents are not read, so none can be withdrawn: ${state.reason}`)
  const row = state.mine.find(item => item.consent === consentRef)
  if (!row) throw new Error('That consent is not one your Participants gave, as SharedField lists them.')
  if (!row.permitted) throw new Error('That consent no longer permits: SharedField lists it withdrawn or unpublished.')
  if (!row.projection) throw new Error('SharedField listed that presence without its projection, which a withdrawal names.')
  const answer = await ask({op: 'nara_presence', project: 'O-I', request: {operation: 'withdraw', projection_ref: row.projection, consent_ref: row.consent,
    withdrawal_ref: `withdrawal:${row.consent}:${now()}`}})
  if (answer.outcome == null) throw new Error(answer.error ?? 'The kernel did not answer nara_presence `withdraw`.')
  const outcome = answer.outcome as {result?: string; data?: unknown}
  const data = outcome.data
  if (outcome.result !== 'nara_presence_consent' || !rec(data)) throw new Error(`The kernel answered \`${outcome.result ?? 'unknown'}\`, not the withdrawal.`)
  if (data.state === 'unavailable') throw new Error(`SharedField is unavailable: ${str(data.detail) ? data.detail : 'no detail'}`)
  if (data.schema !== 'oi.nara-presence-withdrawal/v1') throw new Error('SharedField answered no oi.nara-presence-withdrawal/v1.')
  await readSkyPresences()
}

/** Tests: start again, with another call. */
export function resetSkyPresences(next: {call?: PresenceCall} = {}): void {
  sequence++; state = INITIAL; call = next.call ?? (op => kernelOp(detectTransport(), op))
  for (const listener of [...listeners]) listener()
}

const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } }

/** The Share page's consents, read when the Technē devices open. */
export function useSkyPresences(): SkyPresences {
  useEffect(() => { void readSkyPresences() }, [])
  return useSyncExternalStore(subscribe, skyPresences, skyPresences)
}

export const CONSENTS_READ = 'A reading: each consent your Participants gave, as SharedField lists it (nara_presence `list`), lit while it permits.'
export const SHARED_READ = 'A reading: each consent given to your Participants, as SharedField lists it (nara_presence `list`), lit while it permits.'

/** The design's keys from the reading: presence.consents [{target, name, consent, granted, permitted}] and presence.shared [{subject, …}]. */
export function presenceKeys(presences: SkyPresences): {values: Record<string, Value>; standing: Record<string, Standing>} {
  if (!presences.ok) return {values: {}, standing: {'presence.consents': {disabled: presences.reason}, 'presence.shared': {disabled: presences.reason}}}
  const rows = (list: readonly ConsentRow[], who: 'target' | 'subject') => JSON.stringify(list.map(r => ({[who]: r.ref, ...(r.name ? {name: r.name} : {}), consent: r.consent, granted: r.granted, permitted: r.permitted})))
  return {values: {'presence.consents': rows(presences.mine, 'target'), 'presence.shared': rows(presences.theirs, 'subject')},
    standing: {'presence.consents': {disabled: CONSENTS_READ}, 'presence.shared': {disabled: SHARED_READ}}}
}
