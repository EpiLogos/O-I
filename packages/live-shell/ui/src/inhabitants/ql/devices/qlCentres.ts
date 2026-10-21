// Today's centres on their owner, for the Chakra and the Sitting (DLW §22.5, §24.3). The owner is Quaternal Logic's scene
// (`ql.scene/v1` `centres[7]`, crates/ql-mef/src/scene.rs compose), reached through the kernel's ql_read {kind: 'scene-compose'}
// (desktop/cradle/kernel/src/owner_routes.rs:1308-1314, `ql scene compose - --json`) for the sky the Sky shows: its `ql.sky-snapshot/v1`,
// passed verbatim (qlSky.ts SkySnapshotReading.snapshot), so the centres are of that same sky.
// A centre names, since QL-MEF #345: its ordinal and reference; its name, mantra signature and yantra, in the M2-5 map's own words; its
// tattva from the retained M2 tables (none for Ājñā and Sahasrāra); the planets it receives (`receiving`, the design's own route); the
// bodies whose decan ruler reaches it (`decan`, the Nara decan-ruler reception's route). The map holds no petal count, so none is read.
// A ql without #345 names no centre: the centres then stand absent with that reason, and so does a sky the Sky has not read.
// The request's tick12 and cycle are the scene's opening recipe (scene.rs StartRecipe::default: 0 and 0); the centres do not depend on
// them (compose reads them from the placed bodies alone). A read, never a write. Pure apart from the one kernel call, which takes the
// call it is given, and the small store the views share.
import {useEffect, useSyncExternalStore} from 'react'
import {detectTransport, kernelOp, type KernelOpCall} from '../../../../../../../desktop/cradle/src/kernel/bridge'
import type {KernelOp} from '../../../../../../../desktop/cradle/src/kernel/types'
import type {QlSkyState, SkySnapshotReading} from './qlSky'

export const NO_SKY_FOR_CENTRES = 'Today\'s centres follow the Sky\'s date, and the Sky has no reading yet.'
export const NO_NAMED_CENTRES = 'This ql\'s scene names no centre: `ql scene compose` answers each centre\'s reference, anatomy and the planets it receives; its name, mantra, yantra, tattva and decan route come with QL-MEF #345 (scene centres).'

/** A centre as the designs read it (the Chakra's `centres`, the Sitting's ordinal and name), every field the owner's. */
export interface SceneCentre {
  readonly ordinal: number
  readonly ref: string
  readonly name: string
  /** The tattva's registry name ("Prithvi Tattva"), or null where QL's tables carry none. */
  readonly element: string | null
  readonly element_ref: string | null
  readonly mantra: string | null
  readonly yantra: string | null
  readonly own: readonly string[]
  readonly decan: readonly string[]
}

export type CentresReading =
  | {readonly ok: true; readonly centres: readonly SceneCentre[]; readonly snapshotRef: string; readonly epochUtc: string | null}
  | {readonly ok: false; readonly reason: string}

const isRecord = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x)
const text = (x: unknown): string | null => (typeof x === 'string' ? x : null)
const names = (x: unknown): string[] | null => (Array.isArray(x) && x.every(n => typeof n === 'string') ? x as string[] : null)

/** The request for the scene of this sky: the snapshot verbatim, the opening recipe's tick and cycle. */
export function centresRequest(snapshot: Readonly<Record<string, unknown>>) {
  return {schema: 'ql.scene-request/v1', tick12: 0, cycle: 0, sky_snapshot: snapshot}
}

/** The scene's centres, admitted only for the sky asked and only when QL names each of the seven; else the reason in words. */
export function readCentresAnswer(answer: KernelOpCall, snapshotRef: string): CentresReading {
  if (answer.outcome == null) return {ok: false, reason: answer.error ?? 'Quaternal Logic did not answer `ql scene compose`.'}
  const outcome = answer.outcome as {result?: string; data?: unknown}
  const data = isRecord(outcome.data) ? outcome.data : null
  if (outcome.result !== 'owner_route_reading' || data?.schema !== 'ql.scene/v1') return {ok: false, reason: `The kernel answered \`${outcome.result ?? 'unknown'}\`, not QL's scene.`}
  if (data.snapshot_ref !== snapshotRef) return {ok: false, reason: 'QL composed the scene of another sky than the Sky\'s.'}
  const raw = Array.isArray(data.centres) ? data.centres : []
  if (raw.length !== 7 || !raw.every(isRecord)) return {ok: false, reason: 'QL\'s scene does not carry the seven centres.'}
  if (raw.some(c => typeof c.name !== 'string')) return {ok: false, reason: NO_NAMED_CENTRES}
  const centres: SceneCentre[] = []
  for (const c of raw) {
    const own = names(c.receiving), decan = names(c.decan)
    if (!Number.isInteger(c.ordinal) || (c.ordinal as number) < 1 || (c.ordinal as number) > 7 || typeof c.centre_ref !== 'string' || !own || !decan)
      return {ok: false, reason: 'A centre of QL\'s scene lacks its ordinal, reference, receiving planets or decan route.'}
    centres.push({ordinal: c.ordinal as number, ref: c.centre_ref, name: c.name as string, element: text(c.element), element_ref: text(c.element_ref),
      mantra: text(c.mantra), yantra: text(c.yantra), own, decan})
  }
  return {ok: true, centres: centres.sort((a, b) => a.ordinal - b.ordinal), snapshotRef, epochUtc: text(data.epoch_utc)}
}

/** The centres as the designs' `centres` key carries them: the owner's fields, no petal count (none is held). */
export function centresValue(centres: readonly SceneCentre[]): string {
  return JSON.stringify(centres.map(c => ({ordinal: c.ordinal, ref: c.ref, name: c.name, element: c.element, element_ref: c.element_ref,
    mantra: c.mantra, yantra: c.yantra, own: c.own, decan: c.decan})))
}

// ── the store the views share ───────────────────────────────────────────────

export interface QlCentresState {
  /** The snapshot the reading is for, or null before any sky. */
  readonly key: string | null
  readonly reading: CentresReading
  readonly busy: boolean
}

export type CentresCall = (op: KernelOp) => Promise<KernelOpCall>
const INITIAL: QlCentresState = {key: null, reading: {ok: false, reason: NO_SKY_FOR_CENTRES}, busy: false}
let state: QlCentresState = INITIAL
let sequence = 0
let call: CentresCall = op => kernelOp(detectTransport(), op)
const listeners = new Set<() => void>()
const setState = (next: QlCentresState) => { state = next; for (const listener of [...listeners]) listener() }

export function qlCentresState(): QlCentresState { return state }

/** Follow the Sky: a new sky is composed once; none says why. Only the newest answer stands. */
export async function syncQlCentres(sky: SkySnapshotReading | null, why: string | null = null): Promise<void> {
  if (!sky?.snapshot) {
    const reason = why ?? NO_SKY_FOR_CENTRES
    if (state.key !== null || state.busy || state.reading.ok || state.reading.reason !== reason) setState({key: null, reading: {ok: false, reason}, busy: false})
    return
  }
  if (sky.snapshotRef === state.key) return
  const ticket = ++sequence
  setState({key: sky.snapshotRef, reading: state.reading, busy: true})
  let reading: CentresReading
  try {
    reading = readCentresAnswer(await call({op: 'ql_read', request: {kind: 'scene-compose', request: centresRequest(sky.snapshot)}}), sky.snapshotRef)
  } catch (error) {
    reading = {ok: false, reason: `The kernel could not be asked for the scene: ${error instanceof Error ? error.message : String(error)}`}
  }
  if (ticket !== sequence) return
  setState({key: sky.snapshotRef, reading, busy: false})
}

/** Tests: start again, with another call. */
export function resetQlCentres(next: {call?: CentresCall} = {}): void {
  sequence++; state = INITIAL; call = next.call ?? (op => kernelOp(detectTransport(), op))
  for (const listener of [...listeners]) listener()
}

const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } }

/** The centres of the sky the Sky shows, as the views share them. */
export function useQlCentres(sky: QlSkyState): QlCentresState {
  const reading = sky.reading
  const snapshot = reading?.ok ? reading.sky : null
  const why = reading && !reading.ok ? `Today's centres follow the Sky's date: ${reading.reason}` : null
  useEffect(() => { void syncQlCentres(snapshot, why) }, [snapshot?.snapshotRef, why])
  return useSyncExternalStore(subscribe, qlCentresState, qlCentresState)
}
