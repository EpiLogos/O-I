// Technē's recorded walk and kept view, as their owner keeps them (O-I #760). Manual §17.1 Takes: "Press Record and go somewhere new: each
// place, moment or thing you visit becomes a stop, and the walk lies along the ruler. Choose the take that stands"; §17.2 Transport: "Record —
// Records a walk. Each place you visit becomes a stop", "Capture — Keeps the present view as a scene"; §17.6: "A Journey is a walk of stops",
// "Capture — Keeps the present view as a scene and adds a stop that carries it".
//
// Ported, not re-made. The frame's Places map recorded a tour (lane-4 T25) and kept a named view (lane-4 T20) in a Scene's research material,
// and the kernel keeps both closed and bounded (kernel expression_scene.rs validate_research: `placeTours`, `placeViews`). The map retired when
// Places moved onto the atlas (92a7d38d5) and left both without a writer (targets.json G5, "Record a walk on the atlas (the journey owner's
// writer)"). This module writes them again, from the atlas:
//   - the record law is the frame's own: a stop is the frame's tour stop (field-studies-journeys/src/placeTourRecord.ts, its bounds and its
//     refusals), and every write goes through the frame's own material action (researchMaterial.ts applyResearchMaterial `place-tour-save`,
//     `place-view-save`) on the frame's own Scene (model.ts blankScene for a Scene that has none yet), so the frame reads what the World writes;
//   - [§8.4] the camera is the atlas's (globe/controls.ts CameraRig: lat, lon, dist in globe radii), not MapLibre's. viewportOf and cameraOf
//     carry it in the record's viewport (x longitude, y latitude, zoom) and back: zoom 0 stands ZOOM_REF_ALTITUDE globe radii above the
//     ground and each step halves the height, so the atlas's whole globe reads near zoom 1 and its closest view near zoom 7;
//   - the owner is the kernel's Expression (kernel expression.rs): one Expression per world holds the walk. Its first Scene keeps every take as
//     a named tour, and each kept view is a Scene of its own whose material keeps the view: a Scene is what Capture makes. The Expression is
//     saved to the owner's works home (expression_home.rs), so a fresh owner lists it again after a relaunch.
//
// A stop keeps a place, a moment and a thing (part two of #760; manual §17.6, a Journey's stop has "a place, a moment, a scene and a few
// words"): the tour law admits an optional `moment` — a window in the shared window's own shape — and an optional `thing_ref`, the visited
// thing's owner ref (placeTourRecord.ts; the kernel's place_tour_stop admits the same). A stop made while an occasion stands on the time spine
// keeps it as its moment (a point window at the occasion's instant), so the take lies at its moments on the ruler (recordedWalksOf, and
// recordedInstantsOf for a moment that is an instant); a stop of no moment stands at a "no time" slot. A kept view keeps the shared window
// it was taken in and the atlas's filter in force (`filter`, the atlas's own query, src/shell/filter.ts filterQuery; G4).
//
// An event made of a constellation (O-I #768; manual §10.3 "an event in Technē", §17.1 the Clip panel's Constellation, "The event's source")
// is a Scene of the same Expression whose body is the constellation as a knowledge whole (madeEventChanges), the body Expressions' own drop
// sets; the walk's reading lists it among its events, and the ruler lays it on a reading of its own.
//
// Pure TypeScript. No React, no atlas engine.
import {TOUR_CAPTION_MAX, TOUR_LIMIT, TOUR_STOP_LIMIT, placeTourProblem, type PlaceTourMoment, type PlaceTourRecord, type PlaceTourStop} from '../../../../../../../desktop/cradle/expressions-app/field-studies-journeys/src/placeTourRecord'
import {applyResearchMaterial, type PlaceTimeWindowRecord, type PlaceViewRecord} from '../../../../../../../desktop/cradle/expressions-app/field-studies-journeys/src/researchMaterial'
import {blankScene, clone, type Scene as FrameScene} from '../../../../../../../desktop/cradle/expressions-app/field-studies-journeys/src/model'
import type {Change, ExpressionDocument, Scene, SceneBody} from '../../../../../../../desktop/cradle/src/expression/types'
import type {WorldWalk, WorldWalkStop} from '../../../timeline/worldTrackAdapter'
import {KEPT_VIEWS_KIND, RECORDED_WALK_KIND, isRecordedWalk} from '../../../timeline/techneTrackAdapter'
import {wrapLon} from '../src/data/geo'
import {windowYear} from '../sharedClock'
import {parseTimestamp} from '../../../../../../../desktop/cradle/src/techne/m0m5/timeline/scale'

export type {PlaceTourMoment, PlaceTourStop, PlaceViewRecord, PlaceTimeWindowRecord}

/** The atlas's camera: where it looks on the body (degrees) and how far it stands from the centre, in globe radii. */
export interface AtlasCamera {
  readonly lat: number
  readonly lon: number
  readonly dist: number
}

/** The record's viewport (the frame's Places camera: x longitude, y latitude, a map zoom). */
export type WalkViewport = PlaceTourStop['viewport']

/** The height above the ground, in globe radii, that zoom 0 stands at; each zoom step halves it. */
export const ZOOM_REF_ALTITUDE = 8

/** The atlas's camera as the record's viewport. A longitude on the globe is kept as it is and only one past it is wrapped (the frame's own
 * bounding, placeTours.ts boundedCamera at 92a7d38d5^), so the camera comes back exactly. The atlas looks straight down, north up (its rig
 * has no roll and no tilt, globe/controls.ts), so pitch and bearing are 0. */
export function viewportOf(camera: AtlasCamera): WalkViewport {
  const x = camera.lon >= -180 && camera.lon <= 180 ? camera.lon : wrapLon(camera.lon)
  return {x, y: Math.max(-90, Math.min(90, camera.lat)), zoom: Math.log2(ZOOM_REF_ALTITUDE / Math.max(camera.dist - 1, 1e-9)), pitch: 0, bearing: 0}
}

/** The record's viewport as the atlas's camera: the inverse of viewportOf (a view kept elsewhere may carry no pitch or bearing). */
export function cameraOf(viewport: Pick<WalkViewport, 'x' | 'y' | 'zoom'>): AtlasCamera {
  return {lat: viewport.y, lon: viewport.x, dist: 1 + ZOOM_REF_ALTITUDE / 2 ** viewport.zoom}
}

/** How long a recorded walk stays at each stop: the Journey's own default pace (manual §17.6 Parameters, "Pace 2–12 seconds, default 6"). */
export const WALK_PACE_MS = 6000

/** One visit on the World while Record runs: the place it stands on (its owner's ref, when a place the world holds), its name, the camera,
 * the thing it visited (its owner's ref), and the moment it was made at (absent: the moment in force, which the session reads). */
export interface WalkVisit {
  readonly placeRef: string | null
  readonly name: string
  readonly camera: AtlasCamera
  readonly thingRef?: string | null
  readonly moment?: PlaceTourMoment | null
}

/** A visit as a stop of the take: the frame's tour stop, its caption the name of what was visited, its moment and its thing when it has
 * them (absent is none). */
export function stopOfVisit(visit: WalkVisit, holdMs: number = WALK_PACE_MS): PlaceTourStop {
  const caption = visit.name.trim().slice(0, TOUR_CAPTION_MAX)
  return {place_ref: visit.placeRef, viewport: viewportOf(visit.camera), caption: caption || null, hold_ms: holdMs,
    ...(visit.moment ? {moment: {from: visit.moment.from, to: visit.moment.to}} : {}), ...(visit.thingRef ? {thing_ref: visit.thingRef} : {})}
}

/** Two visits in a row that stand on the same place, at the same moment, of the same thing are one stop (the trail's own rule: going to
 * the place you stand on is no move). A new moment or a new thing where the World stands is a move. */
export function visitKey(visit: WalkVisit): string {
  const at = viewportOf(visit.camera)
  const place = visit.placeRef ? `place:${visit.placeRef}` : `at:${at.y.toFixed(4)},${at.x.toFixed(4)},${at.zoom.toFixed(2)}`
  return `${place}|${visit.moment ? `${visit.moment.from ?? ''}..${visit.moment.to ?? ''}` : ''}|${visit.thingRef ?? ''}`
}

/** An occasion's instant as a stop's moment: the window that stands at that instant and nowhere else (from and to the same). */
export function momentOfInstant(unixMs: number): PlaceTourMoment {
  const at = new Date(unixMs).toISOString()
  return {from: at, to: at}
}

/** The instant a moment stands at when it is one (an occasion's), else null: a moment with an open edge, or two edges, is a span of time. */
export function instantOfMoment(moment: PlaceTourMoment | undefined): number | null {
  if (!moment || moment.from === null || moment.from !== moment.to) return null
  try {
    const ms = parseTimestamp(moment.from)
    return Number.isFinite(ms) ? ms : null
  } catch {
    return null
  }
}

/** The take being recorded with one more stop, or the frame law's refusal of it. */
export function withStop(stops: readonly PlaceTourStop[], stop: PlaceTourStop): {stops: readonly PlaceTourStop[]; problem: string | null} {
  if (stops.length >= TOUR_STOP_LIMIT) return {stops, problem: `A take holds at most ${TOUR_STOP_LIMIT} stops. Stop to keep it, then record another.`}
  const problem = placeTourProblem({stops: [...stops, stop]})
  return problem ? {stops, problem} : {stops: [...stops, stop], problem: null}
}

// ── the owner's Expression ────────────────────────────────────────────────

/** The actor every walk write is made by. */
export const WALK_ACTOR = 'human:techne-walk'

/** The Expression that keeps a world's walk. */
export function walkExpressionRef(world: string): string {
  return `expression:techne-walk-${world.toLowerCase().replace(/[^a-z0-9_.-]+/g, '-').slice(0, 100) || 'world'}`
}

/** Its title, as the works list shows it. */
export function walkExpressionTitle(worldTitle: string): string {
  return `Walks · ${worldTitle}`
}

/** A take's name, in order (the owner keeps tours by name, sorted). */
export function takeName(index: number): string {
  return `Take ${String(index).padStart(2, '0')}`
}

/** The next take's name, or null when the walk keeps as many takes as a Scene holds. */
export function nextTakeName(taken: readonly string[]): string | null {
  for (let index = 1; index <= TOUR_LIMIT; index++) if (!taken.includes(takeName(index))) return takeName(index)
  return null
}

/** One take of the walk, as the owner keeps it. */
export interface WalkTake {
  readonly name: string
  readonly stops: readonly PlaceTourStop[]
}

/** One kept view: the Scene Capture made, and the view its material keeps. */
export interface KeptView {
  readonly sceneRef: string
  readonly title: string
  readonly view: PlaceViewRecord
}

/** One event made of a constellation (O-I #768): a Scene of the walk's Expression whose body is the constellation as a knowledge whole. */
export interface MadeEvent {
  readonly sceneRef: string
  readonly title: string
  /** the constellation it was made of: its whole's ref, as the Scene's body keeps it */
  readonly source: string
}

/** What the owner keeps of a world's walk, read from its Expression. */
export interface WalkReading {
  readonly expressionRef: string
  readonly revision: number
  readonly title: string
  /** the Scene whose material keeps the takes */
  readonly takesSceneRef: string
  readonly takes: readonly WalkTake[]
  readonly views: readonly KeptView[]
  /** the events made of constellations, in Scene order */
  readonly events: readonly MadeEvent[]
}

interface ResearchShape {
  placeTours?: Record<string, PlaceTourRecord>
  placeViews?: Record<string, PlaceViewRecord>
}
const researchOf = (scene: Scene): ResearchShape | null => {
  const research = (scene.presentation?.scene as {research?: ResearchShape} | undefined)?.research
  return research && typeof research === 'object' ? research : null
}

/** The walk as its owner's document holds it: the takes in the first Scene's material, in name order; a kept view in each other Scene whose
 * material keeps one, in Scene order; an event in each other Scene whose body is a knowledge whole, in Scene order. A tour the frame's law
 * refuses is left out rather than drawn wrong. */
export function walkReadingOf(document: ExpressionDocument): WalkReading {
  const [first, ...rest] = document.scenes
  const tours = (first ? researchOf(first)?.placeTours : undefined) ?? {}
  const takes = Object.entries(tours).filter(([, tour]) => placeTourProblem(tour) === null).sort(([a], [b]) => a.localeCompare(b))
    .map(([name, tour]) => ({name, stops: tour.stops}))
  const views = rest.flatMap((scene): KeptView[] => {
    const kept = researchOf(scene)?.placeViews ?? {}
    const view = kept[scene.title] ?? Object.values(kept)[0]
    return view ? [{sceneRef: scene.scene_ref, title: scene.title, view}] : []
  })
  const events = rest.flatMap((scene): MadeEvent[] => scene.body?.carrier === 'knowledge_whole' && scene.body.subject_ref
    ? [{sceneRef: scene.scene_ref, title: scene.title, source: scene.body.subject_ref}] : [])
  return {expressionRef: document.expression_ref, revision: document.revision, title: document.title, takesSceneRef: first?.scene_ref ?? '', takes, views, events}
}

/** The frame's Scene a native Scene presents: its own material, or the frame's blank Scene under the native Scene's ref and title. */
function frameSceneOf(scene: Pick<Scene, 'scene_ref' | 'title' | 'presentation'>): FrameScene {
  if (scene.presentation?.scene) return clone(scene.presentation.scene) as unknown as FrameScene
  const blank = blankScene(scene.title)
  blank.id = scene.scene_ref
  return blank
}

const material = (sceneRef: string, scene: FrameScene, saved: Scene['presentation'] | undefined): Change =>
  ({change: 'scene_material_set', scene_ref: sceneRef, presentation: {schema: 'oi.journey-scene/v1', scene: scene as unknown as Record<string, unknown>,
    ...(saved?.saved ? {saved: saved.saved} : {})}})

/** The one change that keeps a take: the first Scene's material with the take saved under its name (the frame's `place-tour-save`). Throws the
 * frame law's refusal. */
export function takeChanges(document: ExpressionDocument, name: string, stops: readonly PlaceTourStop[]): Change[] {
  const first = document.scenes[0]
  if (!first) throw Error('The walk\'s Expression holds no Scene to keep a take in.')
  const scene = frameSceneOf(first)
  applyResearchMaterial(scene, {type: 'place-tour-save', name, tour: {stops: [...stops]}})
  return [material(first.scene_ref, scene, first.presentation)]
}

/** A new Scene's ref in the walk's Expression, not yet held. */
export function keptViewSceneRef(document: ExpressionDocument): string {
  const taken = new Set(document.scenes.map(scene => scene.scene_ref))
  for (let index = 1; ; index++) {
    const ref = `${document.expression_ref}:scene:view-${index}`
    if (!taken.has(ref)) return ref
  }
}

/** The changes that keep a view as a Scene: the Scene, and its material keeping the view under its title (the frame's `place-view-save`). */
export function keptViewChanges(document: ExpressionDocument, sceneRef: string, title: string, view: PlaceViewRecord): Change[] {
  if (document.scenes.length >= 64) throw Error('The walk\'s Expression holds 64 Scenes, as many as an Expression may: no view can be kept as another.')
  const scene = frameSceneOf({scene_ref: sceneRef, title, presentation: null})
  applyResearchMaterial(scene, {type: 'place-view-save', name: title, place: view})
  return [{change: 'scene_create', scene_ref: sceneRef, title}, material(sceneRef, scene, null)]
}

/** A new event Scene's ref in the walk's Expression, not yet held. */
export function madeEventSceneRef(document: ExpressionDocument): string {
  const taken = new Set(document.scenes.map(scene => scene.scene_ref))
  for (let index = 1; ; index++) {
    const ref = `${document.expression_ref}:scene:event-${index}`
    if (!taken.has(ref)) return ref
  }
}

/** The changes that make an event of a constellation (O-I #768; manual §10.3 "Drag it onto a track and this mode makes its own clip of it,
 * with the constellation as its source: … an event in Technē"): a Scene named for it whose body is the constellation as a knowledge whole —
 * the body the Expression owner keeps for a scene made of a constellation (expressions-app nativeSceneBody.ts bodyFromKnowledgeWhole, the
 * one Expressions' drop sets). The event states no date and no place, so it keeps none (§17.1: "An empty place stays empty"). */
export function madeEventChanges(document: ExpressionDocument, sceneRef: string, title: string, body: SceneBody): Change[] {
  if (document.scenes.length >= 64) throw Error('The walk\'s Expression holds 64 Scenes, as many as an Expression may: no event can be made in it.')
  if (body.carrier !== 'knowledge_whole') throw Error('An event made of a constellation keeps the constellation as a knowledge whole.')
  return [{change: 'scene_create', scene_ref: sceneRef, title}, {change: 'scene_body_set', scene_ref: sceneRef, body}]
}

/** The present view as the record keeps it: the camera, the shared window the World stands in (null: all time), and the atlas's filter in
 * force in its own query (empty: none in force; null: no atlas to read it from, so the view keeps none). */
export function viewRecordOf(camera: AtlasCamera, window: PlaceTimeWindowRecord | null, filter: string | null = null): PlaceViewRecord {
  return {viewport: viewportOf(camera), window: window ? {from: window.from, to: window.to} : null, ...(filter !== null ? {filter} : {})}
}

// ── the walks on the ruler ────────────────────────────────────────────────

// The kinds the recorded walks carry are the tracks' own (the adapter reads by them and lays them in the Journeys stream).
export {KEPT_VIEWS_KIND, RECORDED_WALK_KIND, isRecordedWalk}

export const takeWalkId = (name: string): string => `walk:${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
export const KEPT_VIEWS_WALK_ID = 'walk:kept-views'

const placeOf = (viewport: Pick<WalkViewport, 'x' | 'y'>, label: string): WorldWalkStop['place'] => ({label, lat: viewport.y, lon: viewport.x})

const stopId = (walkId: string, index: number): string => `${walkId}:${index + 1}`

/** The walk's takes and its kept views as walks of stops, for the ruler: each take a walk (the latest is the one that stands), and the kept
 * views a walk through the Expression's Scenes, in the order they were kept. `placeName` names a stop's place from the world's places when the
 * stop's own caption is empty. Nothing is invented: a stop with no caption and no place reads as its number. A stop kept at a moment carries
 * the year it stands in (the shared clock's own reading of a window, sharedClock.ts windowYear), so it lies at its moment; the thing it visited rides
 * with the material it reaches (`also`). */
export function recordedWalksOf(walk: WalkReading, placeName: (ref: string) => string | null = () => null): WorldWalk[] {
  const latest = walk.takes[walk.takes.length - 1]?.name
  const takes = walk.takes.map((take): WorldWalk => {
    const id = takeWalkId(take.name)
    return {id, name: take.name === latest ? `${take.name} · stands` : take.name, kind: RECORDED_WALK_KIND, derived: false,
      stops: take.stops.map((stop, index): WorldWalkStop => {
        const label = stop.caption ?? (stop.place_ref ? placeName(stop.place_ref) : null) ?? `Stop ${index + 1}`
        const at = stop.moment ? windowYear(stop.moment) : null
        // The year the moment stands in, whole (the rail says it, formatYear rounds): an instant late in a year is still that year.
        const year = at === null ? null : Math.floor(at)
        return {id: stopId(id, index), label, place: placeOf(stop.viewport, label), ...(year !== null ? {year} : {}),
          also: [...(stop.binding ? [stop.binding.scene_ref] : []), ...(stop.thing_ref ? [stop.thing_ref] : [])]}
      })}
  })
  if (!walk.views.length) return takes
  return [...takes, {id: KEPT_VIEWS_WALK_ID, name: 'Kept views', kind: KEPT_VIEWS_KIND, derived: false,
    stops: walk.views.map((view, index): WorldWalkStop => ({id: stopId(KEPT_VIEWS_WALK_ID, index), label: view.title, place: placeOf(view.view.viewport, view.title), also: [view.sceneRef]}))}]
}

/** The stops of the takes kept at an instant (an occasion's), by the stop's id in recordedWalksOf: the ruler lays each among the hours of
 * its civil day rather than on the deep-time scale (timeline/techneTrackAdapter.ts `recorded.instants`). */
export function recordedInstantsOf(walk: WalkReading): ReadonlyMap<string, number> {
  const instants = new Map<string, number>()
  for (const take of walk.takes) take.stops.forEach((stop, index) => {
    const ms = instantOfMoment(stop.moment)
    if (ms !== null) instants.set(stopId(takeWalkId(take.name), index), ms)
  })
  return instants
}
