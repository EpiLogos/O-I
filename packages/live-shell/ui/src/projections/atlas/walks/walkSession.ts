// The World's walk while Technē works (O-I #760): one store the transport (places/placesTransport.ts), Technē's tracks
// (frame/tracks/useTechneTracks.ts) and the atlas host (walksHost.ts) read, and every act on the walk, each through its owner.
//
// Manual §10.5, Technē's column: Arm "Let the instrument write", Record "Record a walk", Stop "Stop the walk", Capture "Keep the view as a
// scene". §17.1 Takes: "Press Record and go somewhere new: each place, moment or thing you visit becomes a stop, and the walk lies along the
// ruler"; §17.6: "Capture — Keeps the present view as a scene and adds a stop that carries it"; "If the Expression changed since you opened
// it, the change is refused and your draft stays".
//
// Ported from the frame's Places tour session (field-studies-journeys/src/placeTourSession.ts and placeTourPanel.tsx at 92a7d38d5^: a tour
// being recorded is held for the session only, as presentation, until it is saved into the Scene's own record), with what the atlas changes:
// a stop is added by the visit itself (manual: "each place you visit becomes a stop"), where the frame added one by a press, and the save is
// Stop's. The owner is the kernel's Expression and nothing else holds the walk (walkRecord.ts): a take, or a view, is one CAS-gated `edit` of
// the world's walk Expression, then a save to its file in the owner's works home (the `save_as` the shell's New already makes,
// components/nativeExpressionCommands.ts, then `save` to the file it bound), then an `inspect` whose document is what the store shows. A read
// lists the owner's works and reads the walk from the open document, or from its file when the owner holds it only as a file (`inspect_file`,
// so a read opens nothing); a write opens a filed work first (`open_file`). Every refusal is said in the owner's words.
//
// Playing ports the frame's tour playback (placeTours.ts placeTourSteps: each stop flies, then holds for its own hold), on the World.
//
// Pure TypeScript, no React. The host binds the owners and the World while the Earth stands (walksHost.ts).
import {TOUR_FLIGHT_MS} from '../../../../../../../desktop/cradle/expressions-app/field-studies-journeys/src/placeTourRecord'
import {materialFileName} from '../../../../../../../desktop/cradle/expressions-app/field-studies-journeys/src/reuse'
import {requireExpressionOutcome} from '../../../../../../../desktop/cradle/src/knowledge/expressionOutcome'
import {requireSavedExpression} from '../../../../../../../desktop/cradle/src/knowledge/expressionSaveReceipt'
import type {CentralLocation} from '../../../../../../../desktop/cradle/src/kernel/types'
import type {Change, ExpressionDocument, ExpressionRequest, ExpressionResult} from '../../../../../../../desktop/cradle/src/expression/types'
import {
  KEPT_VIEWS_WALK_ID, WALK_ACTOR, cameraOf, keptViewChanges, keptViewSceneRef, nextTakeName, stopOfVisit, takeChanges, takeWalkId, viewRecordOf, visitKey,
  walkExpressionRef, walkExpressionTitle, walkReadingOf, withStop,
  type AtlasCamera, type PlaceTimeWindowRecord, type PlaceTourStop, type WalkReading, type WalkVisit,
} from './walkRecord'

/** The owners a walk reads and writes through: the kernel's `expression` op. Its answer, or its refusal thrown in its words. */
export interface WalkOwners {
  expression(request: ExpressionRequest): Promise<unknown>
}

/** Where the World stands: its camera, and what it stands on, by name, with the place's ref when it is a place the world holds. */
export interface WalkHere {
  readonly camera: AtlasCamera
  readonly place: {readonly ref: string | null; readonly name: string} | null
}

/** The World as the walk reads and moves it (the host binds the mounted atlas, walksHost.ts). */
export interface WalkWorld {
  /** the world the walk belongs to (the book's world) and its title */
  readonly key: string
  readonly title: string
  /** where the World stands; null where it frames no body (the sky, the graph) */
  here(): WalkHere | null
  /** the shared window the World stands in (null: all time) */
  window(): PlaceTimeWindowRecord | null
  /** stand a stop: its place where the world holds it, else its camera; `ms` the flight's length */
  go(target: {readonly placeRef: string | null; readonly camera: AtlasCamera}, ms: number): void
  /** set the shared window a kept view keeps; the writer's refusal, or null */
  setWindow(window: PlaceTimeWindowRecord | null): string | null
}

/** What the store holds of the owner's walk. */
export type WalkOwnerReading =
  | {readonly phase: 'unread'}
  | {readonly phase: 'reading'}
  | {readonly phase: 'none'}
  | {readonly phase: 'read'; readonly walk: WalkReading; readonly saved: boolean}
  | {readonly phase: 'unavailable'; readonly reason: string}

export interface WalkState {
  /** the owners and the World are bound: the Earth stands */
  readonly bound: boolean
  /** the instrument may write (the transport's Arm) */
  readonly armed: boolean
  /** the take being recorded: its stops so far and the place it stands on (a second visit there is no stop) */
  readonly recording: {readonly stops: readonly PlaceTourStop[]; readonly last: string | null} | null
  readonly reading: WalkOwnerReading
  /** an owner is answering a write */
  readonly busy: boolean
  /** a recorded walk walking: its walk, the stop it stands on, how many */
  readonly playing: {readonly walkId: string; readonly index: number; readonly total: number} | null
  /** the last thing an act said: its outcome or its refusal */
  readonly line: string | null
}

export interface WalkSession {
  get(): WalkState
  subscribe(listener: () => void): () => void
  /** bind the owners and the World (the host, while the Earth stands); returns the release */
  bind(owners: WalkOwners, world: WalkWorld): () => void
  arm(on: boolean): void
  record(): void
  /** a place visited on the World: a stop of the take while Record runs; nothing otherwise */
  visit(visit: WalkVisit): void
  /** Stop: end the recording and keep the take, or stop the walk that walks */
  stop(): Promise<void>
  capture(): Promise<void>
  read(): Promise<void>
  /** walk a recorded take from stop `from`, or reopen a kept view; the refusal, or null once it stands */
  play(walkId: string, from: number): string | null
  halt(): void
}

export type Later = (run: () => void, ms: number) => () => void
const timer: Later = (run, ms) => { const id = setTimeout(run, ms); return () => clearTimeout(id) }

export const WALK_NOT_OPEN = 'The World is not open in this session, so there is nothing to record or keep. Open Earth from the browser\'s Instruments.'
export const WALK_NOT_ARMED = 'Arm lets the World write: arm it, then Record.'
const BUSY = 'The walk\'s owner is still answering the last act.'

const INITIAL: WalkState = {bound: false, armed: false, recording: null, reading: {phase: 'unread'}, busy: false, playing: null, line: null}

const said = (cause: unknown): string => cause instanceof Error ? cause.message : String(cause)
const plural = (count: number, one: string, many: string): string => `${count} ${count === 1 ? one : many}`

interface Listed {expressions?: {expression_ref: string; open?: boolean; location?: CentralLocation; file_revision?: string}[]; home?: {location?: CentralLocation; path?: string; error?: string}}
interface Held {document: ExpressionDocument; file: {location: CentralLocation; revision: string} | null}

/** The owner's answer as a ready document, or its refusal in its words. */
function ready(reply: unknown, what: string): ExpressionResult & {document: ExpressionDocument} {
  const result = reply as ExpressionResult
  requireExpressionOutcome(result, what)
  if (result.state !== 'ready' || !result.document) throw Error(`${what}: the owner answered ${result.state ?? 'nothing'}.`)
  return result as ExpressionResult & {document: ExpressionDocument}
}

export function createWalkSession({later = timer}: {later?: Later} = {}): WalkSession {
  let state: WalkState = INITIAL
  let owners: WalkOwners | null = null
  let world: WalkWorld | null = null
  /** each binding's lifetime: an answer that lands after its binding was released is not shown */
  let generation = 0
  let cancelPlay: (() => void) | null = null
  const listeners = new Set<() => void>()
  const set = (patch: Partial<WalkState>) => {
    state = {...state, ...patch}
    for (const listener of [...listeners]) listener()
  }

  const call = (request: ExpressionRequest) => owners!.expression(request)

  /** The walk's Expression as the owner lists it: open, as a file in its works home, or not at all. */
  async function located(ref: string): Promise<{listed: Listed; row: NonNullable<Listed['expressions']>[number] | undefined}> {
    const listed = (await call({operation: 'list'})) as Listed | null
    if (!listed || !Array.isArray(listed.expressions)) throw Error('The Expression owner lists no works here.')
    return {listed, row: listed.expressions.find(row => row.expression_ref === ref)}
  }

  /** Hold the walk's Expression to write it: the open document, the filed work opened from its file, or a new one. */
  async function hold(ref: string, title: string): Promise<{held: Held; listed: Listed}> {
    const {listed, row} = await located(ref)
    if (!row) {
      const created = ready(await call({operation: 'create', expression_ref: ref, title, actor: WALK_ACTOR}), 'The walk\'s Expression')
      return {listed, held: {document: created.document, file: null}}
    }
    if (row.open === false) {
      if (!row.location) throw Error('The owner lists the walk\'s file without its location.')
      const opened = ready(await call({operation: 'open_file', location: row.location, ...(row.file_revision ? {expected_file_revision: row.file_revision} : {}), actor: WALK_ACTOR}), 'The walk\'s file')
      return {listed, held: {document: opened.document, file: opened.file ?? null}}
    }
    const inspected = ready(await call({operation: 'inspect', expression_ref: ref}), 'The walk\'s Expression')
    return {listed, held: {document: inspected.document, file: inspected.file ?? null}}
  }

  /** One write of the walk: held, edited once (gated on the revision held), saved to its file, and read back. The save's refusal is said
   * beside the kept work: the owner holds it, but a relaunch will not find it until it is saved. */
  async function keep(build: (document: ExpressionDocument) => Change[]): Promise<{walk: WalkReading; saved: boolean; saveRefusal: string | null}> {
    const here = world!
    const ref = walkExpressionRef(here.key), title = walkExpressionTitle(here.title)
    const {held, listed} = await hold(ref, title)
    const reply = (await call({operation: 'edit', expression_ref: ref, expected_revision: held.document.revision, actor: WALK_ACTOR, changes: build(held.document)})) as ExpressionResult
    if (reply?.state === 'revision_conflict') throw Error('The walk\'s Expression changed while this was being kept, so nothing was written')
    const edited = ready(reply, 'The walk\'s edit')
    let saveRefusal: string | null = null
    try {
      const file = edited.file ?? held.file
      const parent = listed.home?.location
      if (!file && !parent) throw Error(listed.home?.error ?? 'the owner disclosed no works home')
      const saved = file
        ? await call({operation: 'save', expression_ref: ref, expected_revision: edited.document.revision, location: file.location, expected_file_revision: file.revision, actor: WALK_ACTOR, actor_kind: 'human'})
        : await call({operation: 'save_as', expression_ref: ref, expected_revision: edited.document.revision, parent: parent!, name: materialFileName(title),
          operation_ref: `operation:techne-walk:${globalThis.crypto.randomUUID()}`, actor: WALK_ACTOR, actor_kind: 'human'})
      requireSavedExpression(saved as ExpressionResult)
    } catch (cause) {
      saveRefusal = said(cause)
    }
    const back = ready(await call({operation: 'inspect', expression_ref: ref}), 'The walk\'s readback')
    return {walk: walkReadingOf(back.document), saved: back.dirty === false, saveRefusal}
  }

  const unsaved = (refusal: string | null): string => refusal ? ` It could not be saved to its file (${refusal}), so a relaunch will not find it until it is.` : ''

  async function read(): Promise<void> {
    if (!owners || !world) return
    const mine = generation, ref = walkExpressionRef(world.key)
    if (state.reading.phase !== 'read') set({reading: {phase: 'reading'}})
    try {
      const {row} = await located(ref)
      if (mine !== generation) return
      if (!row) { set({reading: {phase: 'none'}}); return }
      let document: ExpressionDocument, saved: boolean
      if (row.open === false) {
        if (!row.location || !row.file_revision) throw Error('The owner lists the walk\'s file without its location or revision.')
        document = ready(await call({operation: 'inspect_file', location: row.location, expected_file_revision: row.file_revision}), 'The walk\'s file').document
        saved = true
      } else {
        const inspected = ready(await call({operation: 'inspect', expression_ref: ref}), 'The walk\'s Expression')
        document = inspected.document
        saved = inspected.dirty === false
      }
      if (mine !== generation) return
      set({reading: {phase: 'read', walk: walkReadingOf(document), saved}})
    } catch (cause) {
      if (mine === generation) set({reading: {phase: 'unavailable', reason: said(cause)}})
    }
  }

  function halt(): void {
    cancelPlay?.()
    cancelPlay = null
    if (state.playing) set({playing: null})
  }

  function play(walkId: string, from: number): string | null {
    const here = world
    if (!here) return WALK_NOT_OPEN
    const reading = state.reading
    if (reading.phase !== 'read') return 'The walk has not been read from its owner yet.'
    if (state.recording) return 'Record runs: Stop keeps the take first, then the walk can walk.'
    halt()
    if (walkId === KEPT_VIEWS_WALK_ID) {
      const view = reading.walk.views[from]
      if (!view) return `No view ${from + 1} is kept.`
      here.go({placeRef: null, camera: cameraOf(view.view.viewport)}, TOUR_FLIGHT_MS)
      const refusal = here.setWindow(view.view.window)
      set({line: refusal ? `Reopened ${view.title} at the view it keeps; its window was not set: ${refusal}` : `Reopened ${view.title} at the view it keeps.`})
      return null
    }
    const take = reading.walk.takes.find(row => takeWalkId(row.name) === walkId)
    if (!take) return `No take ${walkId} is kept.`
    if (!take.stops[from]) return `${take.name} has no stop ${from + 1}.`
    const step = (index: number) => {
      const stop = take.stops[index]
      here.go({placeRef: stop.place_ref, camera: cameraOf(stop.viewport)}, TOUR_FLIGHT_MS)
      set({playing: {walkId, index, total: take.stops.length}, line: `Walking ${take.name}: stop ${index + 1} of ${take.stops.length}, ${stop.caption ?? 'a place with no name'}.`})
      cancelPlay = later(() => {
        cancelPlay = null
        if (index + 1 < take.stops.length) step(index + 1)
        else set({playing: null, line: `${take.name} has walked its ${plural(take.stops.length, 'stop', 'stops')}.`})
      }, TOUR_FLIGHT_MS + stop.hold_ms)
    }
    step(from)
    return null
  }

  return {
    get: () => state,
    subscribe(listener) {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    bind(nextOwners, nextWorld) {
      const mine = ++generation
      owners = nextOwners
      world = nextWorld
      set({bound: true})
      return () => {
        if (mine !== generation) return
        generation++
        cancelPlay?.()
        cancelPlay = null
        owners = null
        world = null
        // The reading stays as it was last read: the ruler keeps the walk while the World is closed.
        set({bound: false, busy: false, playing: null, recording: null,
          line: state.recording?.stops.length ? 'The World closed while Record ran, so the take was not kept.' : state.line})
      }
    },
    arm(on) {
      if (!state.bound) { set({line: WALK_NOT_OPEN}); return }
      if (!on && state.recording) { set({line: 'Stop the recording first: the take is kept when it stops.'}); return }
      set({armed: on, line: on ? 'Armed: Record now writes a walk into its Expression.' : 'Disarmed: the World writes nothing.'})
    },
    record() {
      if (!state.bound) { set({line: WALK_NOT_OPEN}); return }
      if (!state.armed) { set({line: WALK_NOT_ARMED}); return }
      if (state.busy) { set({line: BUSY}); return }
      if (state.recording) return
      halt()
      set({recording: {stops: [], last: null}, line: 'Recording: each place you visit on the World becomes a stop. Stop keeps the take.'})
    },
    visit(visit) {
      const recording = state.recording
      if (!recording) return
      const key = visitKey(visit)
      if (key === recording.last) return
      const next = withStop(recording.stops, stopOfVisit(visit))
      if (next.problem) { set({line: next.problem}); return }
      set({recording: {stops: next.stops, last: key}, line: `Recording: ${plural(next.stops.length, 'stop', 'stops')}, the last at ${visit.name}.`})
    },
    async stop() {
      if (state.playing) { halt(); set({line: 'The walk stopped where it stood.'}); return }
      const recording = state.recording
      if (!recording) return
      if (!owners || !world) { set({recording: null, line: WALK_NOT_OPEN}); return }
      if (!recording.stops.length) { set({recording: null, line: 'Nothing was visited while Record ran, so no take was kept.'}); return }
      if (state.busy) { set({line: BUSY}); return }
      const mine = generation
      let name = ''
      set({busy: true, recording: null, line: 'Keeping the take…'})
      try {
        const kept = await keep(document => {
          const next = nextTakeName(walkReadingOf(document).takes.map(take => take.name))
          if (!next) throw Error('The walk keeps sixteen takes, as many as its Scene holds')
          name = next
          return takeChanges(document, next, recording.stops)
        })
        if (mine !== generation) return
        set({busy: false, reading: {phase: 'read', walk: kept.walk, saved: kept.saved},
          line: `Kept ${name}: ${plural(recording.stops.length, 'stop', 'stops')}, read back from ${kept.walk.title}. It stands.${unsaved(kept.saveRefusal)}`})
      } catch (cause) {
        // The draft stays (manual §17.6: "the change is refused and your draft stays"): the stops are held again, and Stop keeps them.
        if (mine === generation) set({busy: false, recording, line: `The take was not kept: ${said(cause)}. Its stops are held; press Stop to keep them.`})
      }
    },
    async capture() {
      if (!owners || !world) { set({line: WALK_NOT_OPEN}); return }
      if (state.busy) { set({line: BUSY}); return }
      const here = world.here()
      if (!here) { set({line: 'The World shows the sky or the graph, which frame no body: come down to a body to keep its view.'}); return }
      const view = viewRecordOf(here.camera, world.window())
      const mine = generation
      let title = '', sceneRef = ''
      set({busy: true, line: 'Keeping the view…'})
      try {
        const kept = await keep(document => {
          title = (here.place?.name ?? `View ${walkReadingOf(document).views.length + 1}`).trim().slice(0, 160)
          sceneRef = keptViewSceneRef(document)
          return keptViewChanges(document, sceneRef, title, view)
        })
        if (mine !== generation) return
        // While Record runs, the view is a stop of the take that carries its Scene (manual §17.6 Capture).
        const recording = state.recording
        let carried = ''
        let next = recording
        if (recording) {
          const stop = {...stopOfVisit({placeRef: here.place?.ref ?? null, name: title, camera: here.camera}), binding: {expression_ref: kept.walk.expressionRef, scene_ref: sceneRef}}
          const added = withStop(recording.stops, stop)
          next = added.problem ? recording : {stops: added.stops, last: visitKey({placeRef: here.place?.ref ?? null, name: title, camera: here.camera})}
          carried = added.problem ? ` It is not a stop of the take: ${added.problem}` : ', and a stop of the take carries it'
        }
        set({busy: false, recording: next, reading: {phase: 'read', walk: kept.walk, saved: kept.saved},
          line: `Kept the view as the Scene ${title} of ${kept.walk.title}${carried}.${unsaved(kept.saveRefusal)}`})
      } catch (cause) {
        if (mine === generation) set({busy: false, line: `The view was not kept: ${said(cause)}.`})
      }
    },
    read,
    play,
    halt,
  }
}

/** The session's one walk (the candidate's): the transport, the tracks and the host read it. */
export const walkSession: WalkSession = createWalkSession()

let lastVisit: WalkVisit | null = null

/** A place visited on the World (places/placesHost.ts turnAtlasTo, the atlas's own navigation, walksHost.ts): a stop while Record runs. */
export function noteWalkVisit(visit: WalkVisit): void {
  lastVisit = visit
  walkSession.visit(visit)
}

/** The last place visited on the World, recorded or not: what the World stands on while its camera has not left it (walksHost.ts). */
export function lastWalkVisit(): WalkVisit | null {
  return lastVisit
}
