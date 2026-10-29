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
import type {TechnePlaceFacet, TechnePlacePrecision} from '../../../../../../../desktop/cradle/src/techne/contract'
import {MOVEMENT_RELATION, routeModel} from '../../../../../../../desktop/cradle/src/techne/m0m5/place/world'
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

/** The ref of your own body: the one its record keeps, else the body seeded from its world's ref (body/worldBody.ts firstBody) that the globe draws
 * until a first write. Null while your world's body is not read. A globe drawing another world's body has a different ref. */
export function yourBodyRef(state: WorldBodyState): string | null {
  if (state.state !== 'read') return null
  return state.record ? state.record.body_ref : firstBody(state.reading.space.ref, state.reading.space.revision).body_ref
}

/** The locations on your own body: every place an owner declares on it that was valid in the window, at its own point, then every world of
 * today's set at its place on your planet. While neither owner has answered, the reason, never a list. Pure. */
export function yourLocations(state: WorldBodyState, places: readonly SuitePlace[], placesRead: boolean, system: readonly SystemBody[] | null, window: PlaceWindow | null = null): BodyLocations {
  if (state.state !== 'read') return {unread: state.state === 'refused' ? state.reason : LOCATIONS_READING}
  if (!placesRead && !system) return {unread: LOCATIONS_READING}
  // a body not built yet is the body seeded from its ref, the one the globe draws: what stands on it stands on that ref, which is the ref its
  // first write keeps
  const bodyRef = yourBodyRef(state)
  const own = places.flatMap((place): BodyLocation[] => place.body_ref === bodyRef && place.on_body && validIn(place, window)
    ? [{id: place.ref, name: place.name, lat: place.on_body.lat, lon: place.on_body.lon, kind: 'place', locus: locusOfRelation(place.relation), precision: place.precision}] : [])
  const landed = system ? landingLocations(system) : []
  return {rows: [...own.filter((row, index) => own.findIndex(other => other.id === row.id) === index), ...landed]}
}

/** [O-I #746] A route as the globe draws it on one body: a subject's stops there, in the route's order, each at its point on that body. */
export interface DrawnRoute {
  readonly subject_ref: string
  readonly stops: readonly {readonly ref: string; readonly name: string; readonly lat: number; readonly lon: number}[]
}

/** The routes on the body the globe draws (manual §17.2: a route's stops "joined in order"): each subject's TRAVELLED_TO places valid in the window
 * that stand on that body (`bodyRef`, its point on it) or, with none named, on the Earth (a located place naming no body), walked in the order the
 * route model gives them (techne/m0m5/place/world.ts routeModel: the place each stop holds in the order, a stop with none first by its dates). A
 * subject with fewer than two stops there has no route to draw. Nothing is stored; every point is the owner's. Pure. */
export function routesOn(places: readonly SuitePlace[], bodyRef: string | null, window: PlaceWindow | null = null): DrawnRoute[] {
  const bySubject = new Map<string, {readonly place: SuitePlace; readonly lat: number; readonly lon: number}[]>()
  for (const place of places) {
    if (place.relation !== MOVEMENT_RELATION || !place.subject_ref || !validIn(place, window)) continue
    const at = bodyRef === null
      ? (!place.body_ref && place.located && place.lat !== undefined && place.lon !== undefined ? {lat: place.lat, lon: place.lon} : null)
      : (place.body_ref === bodyRef ? place.on_body ?? null : null)
    if (!at) continue
    const list = bySubject.get(place.subject_ref) ?? []
    if (!list.some(entry => entry.place.ref === place.ref)) list.push({place, lat: at.lat, lon: at.lon})
    bySubject.set(place.subject_ref, list)
  }
  return [...bySubject].flatMap(([subject_ref, stops]): DrawnRoute[] => {
    const facets = stops.map(({place, lat, lon}): TechnePlaceFacet => ({place_ref: place.ref, relation: place.relation, precision: place.precision,
      geometry: {type: 'point', coordinates: [lon, lat]}, ...(place.valid_from ? {valid_from: place.valid_from} : {}), ...(place.sequence !== undefined ? {sequence: place.sequence} : {})}))
    const route = routeModel(facets, null)
    if (!route) return []
    return [{subject_ref, stops: route.stops.map(stop => {
      const {place, lat, lon} = stops.find(entry => entry.place.ref === stop.place_ref)!
      return {ref: place.ref, name: place.name, lat, lon}
    })}]
  })
}

/** [O-I #746] A followed route draws once: as its route, through its stops in their order (the overlay's line, routesOn), and not also as the
 * ported chronology through the same stops in date order (src/globe/chronology.ts, which the controller builds for the focused thread). Given the
 * chronology the controller asks the globe to draw (its steps' directions and slider positions, in its order), the routes on the Earth, and the
 * subject the thread follows (null when the thread spans several subjects, or none), the steps kept are those that are no stop of that subject's
 * route; the rest of the chronology stands as the port drew it. A chronology left with fewer than two steps is none. Pure. */
export function chronologyBesideRoutes(dirs: readonly (readonly number[])[], nodeU: readonly number[], routes: readonly DrawnRoute[], subject: string | null): {dirs: number[][]; nodeU: number[]} {
  const route = subject ? routes.find(entry => entry.subject_ref === subject) : undefined
  const stops = (route?.stops ?? []).map(stop => {
    const la = (stop.lat * Math.PI) / 180, lo = (stop.lon * Math.PI) / 180
    return [Math.cos(la) * Math.cos(lo), Math.sin(la), -Math.cos(la) * Math.sin(lo)]
  })
  const isStop = (dir: readonly number[]) => stops.some(stop => stop[0] * dir[0] + stop[1] * dir[1] + stop[2] * dir[2] > 1 - 1e-9)
  const kept = dirs.map((dir, index) => ({dir: [...dir], u: nodeU[index]})).filter(step => !isStop(step.dir))
  return kept.length >= 2 ? {dirs: kept.map(step => step.dir), nodeU: kept.map(step => step.u)} : {dirs: [], nodeU: []}
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
