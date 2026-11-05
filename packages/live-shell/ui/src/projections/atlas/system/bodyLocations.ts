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
import {dirFromLatLon, latLonFromDir} from '../src/data/geo'
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
  // the first of each ref, read once each (O-I #746: a body may hold thousands, and a pairwise search grows with their square)
  const seen = new Set<string>()
  return {rows: [...own.filter(row => !seen.has(row.id) && !!seen.add(row.id)), ...landed]}
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

// ── [O-I #746] The scale: the locations on a body and its routes adopt the globe's thresholds ─────────────────────────────────────
// From PROJECTION-SCALE-2026-10-28.md (O-I ticket 773), "World globe (§17.2)", carried to this ticket: each presence is drawn up to 6,000 located
// in the pane; above that one presence stands per occupied sphere cell, carrying its count, from an index built once per change and never per
// frame; members return inside a cell once its drawn area admits them; picking reads the same index. A cell never makes an approximate place
// look exact, and a mythic place keeps its look (manual §17.2 Rules), so a cell holds one look and is drawn as a region is, never as a point.

/** How many located presences the pane draws one by one (the measure: 4,028 drew in 7.9 ms a frame, 11,260 in 17.5 ms). */
export const PRESENCE_LIMIT = 6000

/** The size of a cell, degrees of latitude; each band of latitude holds as many cells as keeps them about equal in area. The reading against
 * §17.2's five scales: at the Body scale the body whole stands about 600 px across a pane the size of the measure's, so a cell is about 50 px
 * from the next at the disc's centre, and one mark per cell with its count stands clear of its neighbours (a mark's ring is MARK_PX). The
 * sphere holds about 410 cells of each look. Coming down to the Region and the Place scales, a cell is drawn larger than its members need and
 * they return at their names. At the System and Field scales no location is drawn (systemOverlay.ts: the ground views only). */
export const CELL_DEG = 10

/** The room one location's mark takes on screen, px: its ring of uncertainty (systemOverlay.css `.sys-place-dot::before`, 24 px). A cell
 * admits its members once the area it is drawn at gives each of them this much square. */
export const MARK_PX = 24

/** A point the index holds: where it is drawn, and whether its look is mythic. */
export interface CellPoint {
  readonly lat: number
  readonly lon: number
  readonly mythic?: boolean
}

/** One occupied cell, of one look. `lat`/`lon` are its centre and `spanLat`/`spanLon` its size, degrees; `at` is where its mark stands (the
 * mean of its members' directions, so it stands among them) and `dir` that direction. */
export interface SphereCell {
  readonly band: number
  readonly col: number
  readonly mythic: boolean
  readonly members: readonly number[]
  readonly lat: number
  readonly lon: number
  readonly spanLat: number
  readonly spanLon: number
  readonly at: {readonly lat: number; readonly lon: number}
  readonly dir: readonly [number, number, number]
}

/** The cells of a set of points, and the cell of each point (`of`, an index into `cells`). Built once for each change of what is drawn. */
export interface CellIndex {
  readonly cellDeg: number
  readonly cells: readonly SphereCell[]
  readonly of: readonly number[]
  /** the cells at each band and column, of either look (`band:col`) */
  readonly grid: ReadonlyMap<string, readonly number[]>
  /** each point's direction, three numbers a point */
  readonly dirs: Float64Array
}

const bandsOf = (cellDeg: number) => Math.max(1, Math.round(180 / cellDeg))
const colsOf = (band: number, cellDeg: number) => {
  const spanLat = 180 / bandsOf(cellDeg)
  return Math.max(1, Math.round((360 / cellDeg) * Math.cos(((-90 + (band + 0.5) * spanLat) * Math.PI) / 180)))
}
const wrapLon = (lon: number) => ((((lon + 180) % 360) + 360) % 360)

/** The band and column a point of the sphere falls in. */
function cellAt(lat: number, lon: number, cellDeg: number): {band: number; col: number} {
  const bands = bandsOf(cellDeg)
  const band = Math.min(bands - 1, Math.max(0, Math.floor(((lat + 90) / 180) * bands)))
  const cols = colsOf(band, cellDeg)
  return {band, col: Math.min(cols - 1, Math.floor((wrapLon(lon) / 360) * cols))}
}

/** The sphere cell index of `points`: each point in the cell of its band and column and of its look. Pure. */
export function cellIndex(points: readonly CellPoint[], cellDeg: number = CELL_DEG): CellIndex {
  const bands = bandsOf(cellDeg), spanLat = 180 / bands
  const byKey = new Map<string, number>()
  const cells: {band: number; col: number; mythic: boolean; members: number[]; sum: [number, number, number]}[] = []
  const of: number[] = []
  const dirs = new Float64Array(points.length * 3)
  const d: [number, number, number] = [0, 0, 0]
  points.forEach((point, i) => {
    const {band, col} = cellAt(point.lat, point.lon, cellDeg)
    const mythic = !!point.mythic
    const key = `${band}:${col}:${mythic ? 'm' : 'f'}`
    let at = byKey.get(key)
    if (at === undefined) { at = cells.length; byKey.set(key, at); cells.push({band, col, mythic, members: [], sum: [0, 0, 0]}) }
    const cell = cells[at]!
    cell.members.push(i)
    dirFromLatLon(point.lat, point.lon, d)
    dirs[i * 3] = d[0]; dirs[i * 3 + 1] = d[1]; dirs[i * 3 + 2] = d[2]
    cell.sum[0] += d[0]; cell.sum[1] += d[1]; cell.sum[2] += d[2]
    of.push(at)
  })
  const grid = new Map<string, number[]>()
  const out: SphereCell[] = cells.map((cell, index) => {
    const cols = colsOf(cell.band, cellDeg), spanLon = 360 / cols
    const n = Math.hypot(...cell.sum) || 1
    const dir: [number, number, number] = [cell.sum[0] / n, cell.sum[1] / n, cell.sum[2] / n]
    const key = `${cell.band}:${cell.col}`
    grid.set(key, [...(grid.get(key) ?? []), index])
    return {band: cell.band, col: cell.col, mythic: cell.mythic, members: cell.members, lat: -90 + (cell.band + 0.5) * spanLat, lon: -180 + (cell.col + 0.5) * spanLon,
      spanLat, spanLon, at: latLonFromDir(dir), dir}
  })
  return {cellDeg, cells: out, of, grid, dirs}
}

/** The point nearest `dir` within `maxRad` of it, or -1: the pick through the index, reading only the cells the reach meets (today's globe scans
 * every presence: 1.6 ms a pointer move at 16k, 5.8 ms at 64k). Equal nearness goes to the later point, as a scan in order keeps the last. Pure. */
export function pickNear(index: CellIndex, points: readonly CellPoint[], dir: readonly number[], maxRad: number): number {
  if (!points.length) return -1
  const {lat, lon} = latLonFromDir(dir as [number, number, number])
  const reach = (maxRad * 180) / Math.PI
  const bands = bandsOf(index.cellDeg), spanLat = 180 / bands
  const first = Math.max(0, Math.floor((lat - reach + 90) / spanLat)), last = Math.min(bands - 1, Math.floor((lat + reach + 90) / spanLat))
  const polar = lat + reach >= 90 || lat - reach <= -90
  const dLon = polar ? 180 : (Math.asin(Math.min(1, Math.sin(maxRad) / Math.cos((lat * Math.PI) / 180))) * 180) / Math.PI
  const least = Math.cos(maxRad)
  let best = -1, bestDot = -Infinity
  for (let band = first; band <= last; band++) {
    const cols = colsOf(band, index.cellDeg), width = 360 / cols
    const all = polar || 2 * dLon + width >= 360
    const from = all ? 0 : Math.floor(wrapLon(lon - dLon) / width), count = all ? cols : Math.floor(wrapLon(lon + dLon) / width) - from + (wrapLon(lon + dLon) < wrapLon(lon - dLon) ? cols : 0) + 1
    for (let k = 0; k < Math.min(count, cols); k++) {
      for (const at of index.grid.get(`${band}:${(from + k) % cols}`) ?? []) {
        for (const member of index.cells[at]!.members) {
          const dot = index.dirs[member * 3]! * dir[0]! + index.dirs[member * 3 + 1]! * dir[1]! + index.dirs[member * 3 + 2]! * dir[2]!
          if (dot >= least && (dot > bestDot || (dot === bestDot && member > best))) { bestDot = dot; best = member }
        }
      }
    }
  }
  return best
}

/** What the pane draws this frame: how many located points are in it, whether the cells stand for them, and for each cell whether its members
 * are drawn one by one (`open`). */
export interface ShownCells {
  readonly inPane: number
  readonly aggregated: boolean
  readonly open: readonly boolean[]
}

/** The point on screen a direction projects to, as the globe's engine gives it (engine.ts project). */
export type CellProjector = (dir: readonly [number, number, number], out: {x: number; y: number; facing: number}) => void

/** Which cells are drawn as their members this frame: every one while the points in the pane are at most `limit`; above it, a cell whose drawn
 * area gives each of its members `markPx` square, and no other. A cell is in the pane where it faces you and the box it is drawn over meets the
 * pane. Three projections a cell, never one a point. Pure but for the projector. */
export function shownCells(index: CellIndex, project: CellProjector, pane: {readonly w: number; readonly h: number}, limit: number = PRESENCE_LIMIT, markPx: number = MARK_PX): ShownCells {
  const c = {x: 0, y: 0, facing: 0}, a = {x: 0, y: 0, facing: 0}, b = {x: 0, y: 0, facing: 0}
  const centre: [number, number, number] = [0, 0, 0], up: [number, number, number] = [0, 0, 0], east: [number, number, number] = [0, 0, 0]
  let inPane = 0
  const areas = index.cells.map(cell => {
    dirFromLatLon(cell.lat, cell.lon, centre)
    project(centre, c)
    if (c.facing <= 0.02) return -1
    project(dirFromLatLon(Math.min(90, cell.lat + cell.spanLat / 2), cell.lon, up), a)
    project(dirFromLatLon(cell.lat, cell.lon + cell.spanLon / 2, east), b)
    const ax = a.x - c.x, ay = a.y - c.y, bx = b.x - c.x, by = b.y - c.y
    const ex = Math.abs(ax) + Math.abs(bx), ey = Math.abs(ay) + Math.abs(by)
    if (c.x + ex < 0 || c.x - ex > pane.w || c.y + ey < 0 || c.y - ey > pane.h) return -1
    inPane += cell.members.length
    return 4 * Math.abs(ax * by - ay * bx)
  })
  if (inPane <= limit) return {inPane, aggregated: false, open: index.cells.map(() => true)}
  return {inPane, aggregated: true, open: index.cells.map((cell, i) => areas[i]! >= 0 && areas[i]! >= cell.members.length * markPx * markPx)}
}

/** A route's points as the line is drawn above the threshold: each stop at its own point where its cell is open, else at its cell's mark, a run
 * of stops in one closed cell one point. `index` is the cell index of `stops`. A route inside one closed cell draws no line: the cell's count
 * holds it. Pure. */
export function routeThroughCells(stops: readonly {readonly lat: number; readonly lon: number}[], index: Pick<CellIndex, 'cells' | 'of'>, open: readonly boolean[]): {lat: number; lon: number}[] {
  const out: {lat: number; lon: number}[] = []
  let held = -1
  stops.forEach((stop, i) => {
    const at = index.of[i]!
    if (open[at]) { out.push({lat: stop.lat, lon: stop.lon}); held = -1; return }
    if (at === held) return
    held = at
    const cell = index.cells[at]!
    out.push({lat: cell.at.lat, lon: cell.at.lon})
  })
  return out.length >= 2 ? out : []
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
