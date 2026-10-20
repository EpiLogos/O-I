// The locations on your own body (T-WORLDS §5 W3 phase B; manual §17.2 "Build a planet": "Click the body to place a place … Every world
// you start lands as a place on your planet"): what stands on the body you build, read from what its owners returned. Pure: no DOM, no
// transport. The World device's Locations read it (inhabitants/ql/devices/atlasDevices.ts), and the globe draws it on your body
// (system/systemOverlay.ts), each where it stands, or on the nearest shore where its spot is sea (globe/body.ts shoreOf: drawing only,
// its coordinate never changes), named, in the look its precision and its standing give it.
//
// Two owners place things on your body, and nothing else does:
//   - a place an owner declares on it: a place facet whose body_ref is your body's (AIKit PlaceFacet.body_ref; the suite reading carries
//     it as SuitePlace.body_ref and its point as on_body, provider/suiteReading.ts locateOnBody), written by its subject's PlaceSet;
//   - a world of today's set: at the landing its own body record writes, or, until it is landed, at the spot its ref names, said so
//     (system/systemModel.ts landingLocations), written by that world's BodySet when its person lands it.
import {parseTimestamp} from '../../../../../../../desktop/cradle/src/techne/m0m5/timeline/scale'
import type {TechnePlacePrecision} from '../../../../../../../desktop/cradle/src/techne/contract'
import {firstBody, type WorldBodyState} from '../body/worldBody'
import {locusOfRelation} from '../provider/suiteReading'
import type {SuitePlace} from '../provider/suiteStanding'
import type {LocusType} from '../src/types/field'
import {framingDistance} from '../places/placesHost'
import {landingLocations, type SystemBody} from './systemModel'

/** One location on your body, as the World design's Locations read it (atlas-earth__globe-engine.tsx `locations`: {id, name, lat, lon, kind}),
 * with what draws it as it is: for a place its owner declares, the locus the atlas reads its relation as (a mythic place looks mythic in every
 * view) and the precision its source states (an approximate place does not look exact); for a world, whether its landing is written. */
export interface BodyLocation {
  readonly id: string
  readonly name: string
  readonly lat: number
  readonly lon: number
  readonly kind: string
  readonly locus?: LocusType
  readonly precision?: TechnePlacePrecision
  /** a world's place on your planet only: false while it stands where its ref puts it, not yet landed */
  readonly written?: boolean
}

export type BodyLocations = {readonly rows: readonly BodyLocation[]} | {readonly unread: string}

export const LOCATIONS_READING = 'Your body’s locations are read with your owners’ places and your system’s worlds.'

/** The shared window, as the session carries it (techne/contract.ts DisclosureSession.time_window): edges as the time authority reads them, either open. */
export interface PlaceWindow {
  readonly from: string | null
  readonly to: string | null
}

/** One edge as the time authority reads it (scale.ts parseTimestamp); null for an edge that is open or that no instant names (historical
 * validity can be "across periods no RFC 3339 instant can name": such an edge is open, never a guess). */
function edgeMs(edge: string | null | undefined): number | null {
  if (!edge) return null
  try {
    const ms = parseTimestamp(edge)
    return Number.isFinite(ms) ? ms : null
  } catch {
    return null
  }
}

/** Whether a place was valid in the window (manual §17.2: "Only the places that were valid in that window show on the body"): its validity,
 * from and to either open, overlaps the window; a place that declares none is always valid, and no window is all time. */
function validIn(place: Pick<SuitePlace, 'valid_from' | 'valid_to'>, window: PlaceWindow | null): boolean {
  if (!window) return true
  const [from, to, start, end] = [edgeMs(place.valid_from), edgeMs(place.valid_to), edgeMs(window.from), edgeMs(window.to)]
  if (from !== null && end !== null && from > end) return false
  if (to !== null && start !== null && to < start) return false
  return true
}

/** The locations on your own body: every place an owner declares on it that was valid in the window, at its own point, then every world of
 * today's set at its place on your planet. While neither owner has answered, the reason, never a list. Pure. */
export function yourLocations(state: WorldBodyState, places: readonly SuitePlace[], placesRead: boolean, system: readonly SystemBody[] | null, window: PlaceWindow | null = null): BodyLocations {
  if (state.state !== 'read') return {unread: state.state === 'refused' ? state.reason : LOCATIONS_READING}
  if (!placesRead && !system) return {unread: LOCATIONS_READING}
  // a body not built yet is the body seeded from its ref (body/worldBody.ts firstBody), the one the globe draws: what stands on it stands
  // on that ref, which is the ref its first write keeps
  const bodyRef = state.record ? state.record.body_ref : firstBody(state.reading.space.ref, state.reading.space.revision).body_ref
  const own = places.flatMap((place): BodyLocation[] => place.body_ref === bodyRef && place.on_body && validIn(place, window)
    ? [{id: place.ref, name: place.name, lat: place.on_body.lat, lon: place.on_body.lon, kind: 'place', locus: locusOfRelation(place.relation), precision: place.precision}] : [])
  const landed = system ? landingLocations(system) : []
  return {rows: [...own.filter((row, index) => own.findIndex(other => other.id === row.id) === index), ...landed]}
}

/** A location on your body anchored to a real place on Earth (manual §17.2: "Anchor lines run to real places on Earth"). Read, never written. */
export interface Anchor {
  /** the location's ref (its place facet's place_ref) */
  readonly location: string
  /** where the location stands on your body */
  readonly from: {readonly lat: number; readonly lon: number}
  /** the real place on Earth: its ref, name, point and the precision its source states */
  readonly to: {readonly ref: string; readonly name: string; readonly lat: number; readonly lon: number; readonly precision: TechnePlacePrecision}
}

/** The anchors of your body's locations. A location is anchored to Earth where the subject that declares it also declares a place on the Earth:
 * two place facets of one subject, the one naming your body (PlaceFacet.body_ref, techne/contract.ts, with its point on that body) and the other
 * naming none and standing at a point of the Earth (a located place); SuitePlace.subject_ref is the subject that declares each
 * (provider/suiteStanding.ts). Both are fields the owners' place facets already carry: nothing is stored or invented. Pure. */
export function anchorsOf(places: readonly SuitePlace[], bodyRef: string): Anchor[] {
  return places.flatMap((place): Anchor[] => {
    if (place.body_ref !== bodyRef || !place.on_body || !place.subject_ref) return []
    const real = places.find(other => !other.body_ref && other.located && other.subject_ref === place.subject_ref && other.lat !== undefined && other.lon !== undefined)
    return real ? [{location: place.ref, from: {lat: place.on_body.lat, lon: place.on_body.lon}, to: {ref: real.ref, name: real.name, lat: real.lat!, lon: real.lon!, precision: real.precision}}] : []
  })
}

/** Follow an anchor line to its place on Earth: the Earth is chosen as the body the World shows, then the globe flies to the place, framed for the
 * precision its source states. The ports are the shell's own (body/worldBody.ts chooseBody, the rig's flyTo). */
export function followAnchor(anchor: Anchor, ports: {readonly chooseBody: (choice: 'earth') => void; readonly flyTo: (lat: number, lon: number, dist: number) => void}): void {
  ports.chooseBody('earth')
  ports.flyTo(anchor.to.lat, anchor.to.lon, framingDistance(anchor.to.precision))
}

/** What a press on a location's mark does: a world's place on your planet (its landing is written or not: only these rows say) enters that world;
 * a place an owner declares is selected, the shared focus. The refusal of either in its words, or null. */
export function pressLocation(location: BodyLocation, ports: {readonly select: (location: BodyLocation) => string | null; readonly enter: (key: string) => string | null}): string | null {
  return location.written === undefined ? ports.select(location) : ports.enter(location.id)
}
