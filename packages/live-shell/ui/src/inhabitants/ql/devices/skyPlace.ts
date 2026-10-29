// The places the Sky's hours are counted at (manual §22.1: "The hours are counted at a place: the world's place when Observer is Shared,
// yours when it is Private. With no place, the Sky reads no rulers"; "A shared view does not show a private observer's place"; QL-MEF
// #254 D12). Two owners keep them, and the Sky reads each as its owner keeps it. Nothing here writes a place: declaring one is its owner's
// act (Central's central.world.place; QL's identity, saved through nara_identity save).
// - The world's declared place is Central's (`central.world.place`, O-I #745). Your world keeps it on its root world record (`control:root`,
//   `central.world-relations/v1` `place`), which `central.world-relations.read` {scope: root, ref: control:root} reads through the kernel's
//   invoke_action. A project's world keeps its own in its ProjectCentral manifest (the world browse's `world_place`); the Sky stands over
//   your world.
// - Your saved place is QL's Nara identity's (`ql.nara-identity-profile/v1` `observer_place`, crates/ql-mef/src/nara/intake.rs
//   ObserverPlace), in the identity you hold (desktop/cradle/src/nara/identity/current.ts currentIdentity: your explicit selection).
// Both are kept in the shape QL's sky provider counts a day at (`ql.sky-day-request/v1` place: reference, label, latitude, longitude,
// altitude, IANA timezone), so the Sky passes them on as they are kept. Pure apart from the one kernel read.
import type {KernelOpCall} from '../../../../../../../desktop/cradle/src/kernel/bridge'
import type {KernelOp} from '../../../../../../../desktop/cradle/src/kernel/types'
import {currentIdentity} from '../../../../../../../desktop/cradle/src/nara/identity/current'
import {actionAnswerOf, centralActionOp} from '../../../central/devices/centralActions'

/** A place as its owner keeps it. */
export interface KeptPlace {
  readonly reference: string
  readonly label: string
  readonly latitude_degrees: number
  readonly longitude_degrees: number
  readonly altitude_metres: number
  readonly timezone: string
}

export type PlaceReading = {readonly ok: true; readonly place: KeptPlace} | {readonly ok: false; readonly reason: string}
/** Your world's place with the record revision a declaration is made against (absent when the record is not read). */
export type WorldPlaceReading = PlaceReading & {readonly revision?: string}

/** The places the Sky can count its hours at, each read from its owner or with the owner's (or the channel's) words for why not. */
export interface SkyPlaces {
  readonly world: WorldPlaceReading
  readonly mine: PlaceReading
}

/** Central's read of your world's record, the one that keeps its place. */
export const WORLD_PLACE_READ = 'central.world-relations.read'
export const YOUR_WORLD_RECORD: Readonly<Record<string, unknown>> = {scope: 'root', ref: 'control:root'}
/** Central's act that declares a world's place. */
export const WORLD_PLACE_ACT = 'central.world.place'

export const NO_WORLD_PLACE = 'Your world declares no place: Central keeps none on your world\'s record (central.world.place declares it).'
export const NO_SAVED_PLACE = 'You have saved no place: your Nara identity keeps none (its saved place, observer_place).'
export const NO_IDENTITY = 'No identity of yours is held: open your identity in the Studio\'s Nara chain, and the Sky reads your saved place from it.'

const isRecord = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x)
const within = (x: unknown, low: number, high: number): x is number => typeof x === 'number' && Number.isFinite(x) && x >= low && x <= high
const words = (x: unknown, most: number): x is string => typeof x === 'string' && x.trim().length > 0 && x.length <= most

/** A place as its owner keeps it, or null for anything else: the six fields and nothing more, within the provider's bounds. Pure. */
export function keptPlaceOf(value: unknown): KeptPlace | null {
  if (!isRecord(value)) return null
  const keys = Object.keys(value).sort().join(',')
  if (keys !== 'altitude_metres,label,latitude_degrees,longitude_degrees,reference,timezone') return null
  const {reference, label, latitude_degrees, longitude_degrees, altitude_metres, timezone} = value
  if (!words(reference, 512) || !words(label, 256) || !words(timezone, 512) || !within(latitude_degrees, -90, 90)
    || !within(longitude_degrees, -180, 180) || !within(altitude_metres, -500, 10_000)) return null
  return {reference, label, latitude_degrees, longitude_degrees, altitude_metres, timezone}
}

/** Your world's place from Central's answer to central.world-relations.read, or Central's words for why there is none. Pure. */
export function worldPlaceOf(answer: KernelOpCall): WorldPlaceReading {
  const read = actionAnswerOf({status: answer.error ? 'refused' : 'answered', value: answer.outcome?.result === 'action_dispatched' ? answer.outcome : null,
    error: answer.error ?? null}, WORLD_PLACE_READ)
  if (read.status === 'refused') return {ok: false, reason: `Your world's record is not read, so its place is not: ${read.error}`}
  if (read.status !== 'answered') return {ok: false, reason: 'Central did not answer your world\'s record.'}
  const record = isRecord(read.value) && isRecord(read.value.record) ? read.value.record : null
  if (record?.schema !== 'central.world-relations/v1') return {ok: false, reason: 'Central answered something other than your world\'s record.'}
  const revision = typeof record.revision === 'string' ? {revision: record.revision} : {}
  if (record.place === undefined || record.place === null) return {ok: false, reason: NO_WORLD_PLACE, ...revision}
  const place = keptPlaceOf(record.place)
  return place ? {ok: true, place, ...revision} : {ok: false, reason: 'Your world\'s record keeps a place the Sky cannot count hours at.', ...revision}
}

/** Your saved place from the identity profile you hold, or why there is none. Pure. */
export function savedPlaceOf(profile: unknown): PlaceReading {
  if (!isRecord(profile) || profile.schema !== 'ql.nara-identity-profile/v1') return {ok: false, reason: NO_IDENTITY}
  if (profile.observer_place === undefined || profile.observer_place === null) return {ok: false, reason: NO_SAVED_PLACE}
  const place = keptPlaceOf(profile.observer_place)
  return place ? {ok: true, place} : {ok: false, reason: 'Your identity keeps a place the Sky cannot count hours at.'}
}

/** Your world's place, read through the kernel. Every refusal is named; nothing is retried or filled in. */
export async function readWorldPlace(call: (op: KernelOp) => Promise<KernelOpCall>): Promise<WorldPlaceReading> {
  try {
    return worldPlaceOf(await call(centralActionOp(WORLD_PLACE_READ, YOUR_WORLD_RECORD)))
  } catch (cause) {
    return {ok: false, reason: `The kernel could not be asked for your world's record: ${cause instanceof Error ? cause.message : String(cause)}.`}
  }
}

/** Your saved place, from the identity you hold now. */
export function readSavedPlace(held: {readonly reading: {readonly profile: unknown}} | null = currentIdentity()): PlaceReading {
  return held ? savedPlaceOf(held.reading.profile) : {ok: false, reason: NO_IDENTITY}
}

/** Central's receipt for a world's declared place (central.world.place). */
export interface WorldPlaced {
  readonly schema: 'central.world-place/v1'
  readonly outcome: 'placed' | 'cleared' | 'unchanged' | 'conflict'
  readonly world_ref: string
  readonly place: KeptPlace | null
  readonly previous_revision: string
  readonly revision: string
}

/** Declare your world's place (null takes it away) on the record revision it was read at: Central's act, the person's own press (the
 * kernel carries their authority for it, action.rs PERSON_ACTS). A refusal or a record moved since it was read is thrown in words; the
 * caller reads the places again after (readQlSkyPlaces). No control of the manual names this act yet. */
export async function declareWorldPlace(call: (op: KernelOp) => Promise<KernelOpCall>, place: KeptPlace | null, expectedRevision: string): Promise<WorldPlaced> {
  const answer = await call(centralActionOp(WORLD_PLACE_ACT, {place, expected_revision: expectedRevision}))
  const act = actionAnswerOf({status: answer.error ? 'refused' : 'answered', value: answer.outcome?.result === 'action_dispatched' ? answer.outcome : null,
    error: answer.error ?? null}, WORLD_PLACE_ACT)
  if (act.status === 'refused') throw new Error(act.error)
  if (act.status !== 'answered') throw new Error('Central did not answer your world\'s place.')
  const placed = act.value as WorldPlaced
  if (placed?.schema !== 'central.world-place/v1') throw new Error('Central answered something other than your world\'s place.')
  if (placed.outcome === 'conflict') throw new Error('Your world\'s record moved since it was read: read it again and declare the place on that.')
  return placed
}
