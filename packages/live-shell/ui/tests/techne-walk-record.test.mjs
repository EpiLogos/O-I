// O-I #760: Technē's Record and Capture have an owner (manual §17.1 Takes, "Press Record and go somewhere new: each place, moment or thing you
// visit becomes a stop, and the walk lies along the ruler"; §17.2 Transport, "Record — Records a walk. Each place you visit becomes a stop",
// "Capture — Keeps the present view as a scene"; §17.6, "A recorded walk keeps its takes"; §10.5 Technē column, Arm "Let the instrument write").
// Arm and Record, three visits, Stop: a take lies on the ruler and reads back from its owner; a fresh owner after a relaunch reads it again;
// Capture keeps a Scene that reopens at the view it kept. Part two: a stop keeps a place, a moment (an occasion stood on the time spine) and
// a thing (an occurrence, by its owner's ref); the take lies at its moments and plays them back; a kept view holds the atlas's filter in
// force; the walk's pace is the Tempo the Palace shares.
//
// Channels (each claim is carried by one):
// - FIXTURE, owner-shaped: a kernel Expression owner held in memory. Its answers are the shapes the real kernel gave through walk-bridge on a
//   scratch Central root, 28 Oct 2026 (create, edit, save_as into the works home, save, list with the work as a closed row after the owner
//   restarted, inspect_file, open_file), and it holds a "disk" a second owner shares, as a relaunch does. The take's and the view's material
//   are written by the frame's own law (researchMaterial.ts), and the fixture refuses a tour that law refuses.
// - FIXTURE: the World the walk reads and moves (its camera, the place it stands on, the shared window, the moment in force, the filter in
//   force, the pace), recorded as it is moved; and, for the host, a mounted atlas's handle and a real time spine published as the shell does.
// - SCRIPTED: Technē's tracks projected headless (timeline/techneTrackAdapter.ts); the transport's bindings as pure readings.
// No owner state is written: nothing here touches Control, ~/.aikit or ~/.central. The native walk on the candidate is the lead's.
import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'

const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};
import {readFile} from 'node:fs/promises';
export async function resolve(s, c, n) {
  let r = null
  try { r = await n(s, c) } catch (e) { if (!s.startsWith('.')) throw e }
  if (r) return r
  if (s.endsWith('.js')) { try { return await n(s.slice(0, -3) + '.ts', c) } catch {} }
  for (const x of ['.ts', '.tsx', '/index.ts', '/index.tsx']) { try { return await n(s + x, c) } catch {} }
  throw new Error('cannot resolve ' + s)
}
export async function load(u, c, n) {
  if (u.endsWith('.css')) return {format: 'module', shortCircuit: true, source: 'export {}'};
  if (u.includes('?raw') || u.includes('.html')) return {format: 'module', shortCircuit: true, source: 'export default ""'};
  if (!u.endsWith('.ts') && !u.endsWith('.tsx')) return n(u, c);
  return {format: 'module', shortCircuit: true, source: ts.transpileModule(await readFile(new URL(u), 'utf8'), {fileName: new URL(u).pathname,
    compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX}}).outputText.split('import.meta.env').join('({BASE_URL: "/"})')};
}`)}`, import.meta.url)

const record = await import('../src/projections/atlas/walks/walkRecord.ts')
const {createWalkSession} = await import('../src/projections/atlas/walks/walkSession.ts')
const adapter = await import('../src/timeline/techneTrackAdapter.ts')
const {techneControls} = await import('../src/frame/tracks/useTechneTracks.ts')
const {walkBindings} = await import('../src/projections/atlas/places/placesTransport.ts')
const {placeTourProblem} = await import('../../../../desktop/cradle/expressions-app/field-studies-journeys/src/placeTourRecord.ts')

// ── the owner ──────────────────────────────────────────────────────────────

const HOME = {schema: 'central.path-ref/v1', ref: 'central:path:/scratch/root:Control/user/flows', root: '/scratch/root', path: 'Control/user/flows'}
const copy = value => structuredClone(value)

/** A kernel Expression owner over a shared disk (the works home's files). A second owner over the same disk is a relaunch: nothing is open in
 * it, and the works it lists are the files. Replies are the shapes the real kernel answered (see the header). */
function kernel(disk = new Map()) {
  const documents = new Map(), dirty = new Map(), bound = new Map(), calls = []
  let revisions = disk.size
  const fileOf = path => ({location: {...HOME, ref: `${HOME.ref}/${path.split('/').pop()}`, path}})
  const inspect = ref => ({state: 'ready', document: copy(documents.get(ref)), dirty: dirty.get(ref) ?? true, file: bound.get(ref) ?? null, dynamic_state: 'not_restored'})
  const write = (ref, path) => {
    const revision = `central.content-fnv1a64/v1:${++revisions}`
    disk.set(path, {document: copy(documents.get(ref)), revision})
    const file = {...fileOf(path), revision}
    bound.set(ref, file)
    dirty.set(ref, false)
    return {state: 'saved', persisted: true, readback_verified: true, owner_operation: 'central.files.create', expression_revision: documents.get(ref).revision, file}
  }
  const apply = (doc, change) => {
    if (change.change === 'scene_create') {
      if (doc.scenes.some(scene => scene.scene_ref === change.scene_ref)) throw Error('Scene already exists')
      doc.scenes.push({scene_ref: change.scene_ref, revision: doc.revision + 1, title: change.title, entity_refs: []})
    } else if (change.change === 'scene_material_set') {
      const scene = doc.scenes.find(row => row.scene_ref === change.scene_ref)
      if (!scene) throw Error('Unknown Scene')
      const material = change.presentation.scene
      if (change.presentation.schema !== 'oi.journey-scene/v1') throw Error('Unsupported native Scene presentation')
      if (material.id !== scene.scene_ref) throw Error('Scene presentation addresses a different native Scene')
      if (material.name !== scene.title) throw Error('Scene name and native title disagree; rename through the native Scene operation')
      for (const tour of Object.values(material.research?.placeTours ?? {})) if (placeTourProblem(tour)) throw Error('Invalid place tour')
      scene.presentation = copy(change.presentation)
    } else throw Error(`the fixture keeps no ${change.change}`)
  }
  return {
    calls, disk, documents,
    async expression(request) {
      calls.push(request.operation)
      switch (request.operation) {
        case 'list': {
          const open = [...documents.values()].map(doc => ({expression_ref: doc.expression_ref, revision: doc.revision, title: doc.title, dirty: dirty.get(doc.expression_ref) ?? true, open: true}))
          const closed = [...disk.entries()].filter(([, file]) => !documents.has(file.document.expression_ref))
            .map(([path, file]) => ({expression_ref: file.document.expression_ref, revision: file.document.revision, title: file.document.title, open: false, ...fileOf(path), file_revision: file.revision}))
          return {schema: 'oi.expression-list/v1', expressions: [...open, ...closed], unreadable: [], home: {location: HOME, path: HOME.path, state: 'listed', truncated: false}}
        }
        case 'inspect': {
          if (!documents.has(request.expression_ref)) throw Error('Expression is not open')
          return inspect(request.expression_ref)
        }
        case 'create': {
          const ref = request.expression_ref
          documents.set(ref, {schema: 'oi.expression/v1', expression_ref: ref, revision: 1, title: request.title, scenes: [{scene_ref: `${ref}:scene:main`, revision: 1, title: 'Main', entity_refs: []}],
            entities: {}, relations: {}, selection: {scene_ref: `${ref}:scene:main`, entity_ref: null}, provenance: [], representations: [], refinements: [], collections: [], profiles: []})
          return inspect(ref)
        }
        case 'edit': {
          const doc = documents.get(request.expression_ref)
          if (doc.revision !== request.expected_revision) return {state: 'revision_conflict', expression_ref: request.expression_ref, expected_revision: request.expected_revision, current_revision: doc.revision}
          const next = copy(doc)
          for (const change of request.changes) apply(next, change)
          next.revision += 1
          documents.set(request.expression_ref, next)
          dirty.set(request.expression_ref, true)
          return inspect(request.expression_ref)
        }
        case 'save_as': {
          const doc = documents.get(request.expression_ref)
          if (doc.revision !== request.expected_revision) return {state: 'revision_conflict'}
          const path = `${request.parent.path}/${request.name}`
          if (disk.has(path)) return {state: 'save_refused', data: {outcome: 'exists'}}
          return write(request.expression_ref, path)
        }
        case 'save': {
          const doc = documents.get(request.expression_ref), held = disk.get(request.location.path)
          if (doc.revision !== request.expected_revision) return {state: 'revision_conflict'}
          if (held.revision !== request.expected_file_revision) return {state: 'file_revision_conflict', expected_revision: request.expected_file_revision, current_revision: held.revision}
          return write(request.expression_ref, request.location.path)
        }
        case 'inspect_file': {
          const held = disk.get(request.location.path)
          if (held.revision !== request.expected_file_revision) return {state: 'file_revision_conflict'}
          return {state: 'ready', document: copy(held.document), file: {location: request.location, revision: held.revision}}
        }
        case 'open_file': {
          const held = disk.get(request.location.path)
          const ref = held.document.expression_ref
          documents.set(ref, copy(held.document))
          dirty.set(ref, false)
          bound.set(ref, {location: request.location, revision: held.revision})
          return inspect(ref)
        }
        default: throw Error(`the fixture answers no ${request.operation}`)
      }
    },
  }
}

// ── the World ──────────────────────────────────────────────────────────────

const BOLLINGEN = {ref: 'place:bollingen', name: 'Bollingen', lat: 47.21, lon: 8.98}
const KUSNACHT = {ref: 'place:kusnacht', name: 'Küsnacht', lat: 47.31, lon: 8.58}
const DELPHI = {ref: 'place:delphi', name: 'Delphi', lat: 38.48, lon: 22.5}
const WINDOW = {from: '1900-01-01T00:00:00Z', to: '1961-06-06T00:00:00Z'}

function world() {
  const log = {went: [], windows: [], selected: [], filters: []}
  const state = {camera: {lat: BOLLINGEN.lat, lon: BOLLINGEN.lon, dist: 2.25}, place: {ref: BOLLINGEN.ref, name: BOLLINGEN.name}, window: WINDOW, open: true,
    moment: null, filter: '', pace: record.WALK_PACE_MS}
  const places = new Map([BOLLINGEN, KUSNACHT, DELPHI].map(place => [place.ref, place.name]))
  return {log, state, port: {
    key: 'central', title: 'Central',
    here: () => state.open ? {camera: {...state.camera}, place: state.place} : null,
    window: () => state.window,
    moment: () => state.moment,
    filter: () => state.filter,
    pace: () => state.pace,
    go: (target, ms) => { log.went.push({...target, ms}); state.camera = {...target.camera} },
    select: thing => { log.selected.push(thing); return null },
    setWindow: window => { log.windows.push(window); state.window = window; return null },
    setFilter: filter => { log.filters.push(filter); state.filter = filter; return null },
    placeName: ref => places.get(ref) ?? null,
  }}
}
const visit = (place, dist = 2.25) => ({placeRef: place.ref, name: place.name, camera: {lat: place.lat, lon: place.lon, dist}})

/** A clock the test turns by hand: what the session waits for is run when the test says so. */
function clock() {
  const queue = []
  return {queue, later: (run, ms) => { const entry = {run, ms, cancelled: false}; queue.push(entry); return () => { entry.cancelled = true } },
    tick() { const entry = queue.shift(); if (entry && !entry.cancelled) entry.run(); return entry }}
}

const WALK = record.walkExpressionRef('central')
const recordedTracks = (session, extra = {}) => adapter.projectTechneTracks({world: {state: 'unavailable', reason: 'no civil read in this test'},
  recorded: {walks: session.get().reading.phase === 'read' ? record.recordedWalksOf(session.get().reading.walk) : [], armed: session.get().armed}, ...extra})

/** Arm, Record, the visits, Stop: the take kept. */
async function recordTake(session, places) {
  session.arm(true)
  session.record()
  for (const place of places) session.visit(visit(place))
  await session.stop()
}

// ── (a) Arm and Record over three visits ───────────────────────────────────

test('(a) Arm and Record over three visits, then Stop: a take lies on the ruler, kept by its owner and read back from it', async () => {
  const owner = kernel(), here = world(), session = createWalkSession({later: clock().later})
  session.bind(owner, here.port)
  await session.read()
  assert.equal(session.get().reading.phase, 'none', 'no walk is kept yet: the owner lists none')
  session.record()
  assert.equal(session.get().recording, null, 'Record writes nothing unarmed')
  assert.match(session.get().line, /Arm/, 'and says Arm lets it write')
  session.arm(true)
  session.record()
  assert.ok(session.get().recording, 'armed, Record runs')
  session.visit(visit(BOLLINGEN))
  session.visit(visit(BOLLINGEN))
  session.visit(visit(KUSNACHT))
  session.visit(visit(DELPHI))
  assert.equal(session.get().recording.stops.length, 3, 'three places, three stops: going again to the place you stand on is no move')
  await session.stop()
  const after = session.get()
  assert.equal(after.recording, null, 'Stop ends the recording')
  assert.equal(after.reading.phase, 'read', after.line)
  assert.deepEqual(after.reading.walk.takes.map(take => [take.name, take.stops.map(stop => stop.caption)]), [['Take 01', ['Bollingen', 'Küsnacht', 'Delphi']]])
  assert.equal(after.reading.saved, true, 'saved to its file in the works home')
  assert.deepEqual(owner.calls, ['list', 'list', 'create', 'edit', 'save_as', 'inspect'], 'read, then: held, created, one edit, saved into the works home, read back')
  // The owner's own document holds the take: read it there, not from the session.
  const kept = record.walkReadingOf(owner.documents.get(WALK))
  assert.deepEqual(kept.takes, after.reading.walk.takes, 'the take reads back from its owner')
  assert.deepEqual(kept.takes[0].stops.map(stop => stop.place_ref), [BOLLINGEN.ref, KUSNACHT.ref, DELPHI.ref])
  // On the ruler: a Journeys track of three stops, each a clip with its place on the ruler.
  const set = recordedTracks(session)
  const track = set.tracks.find(row => row.name === 'Take 01 · stands')
  assert.ok(track, set.tracks.map(row => row.name).join(', '))
  const clips = set.clips.filter(clip => clip.trackId === track.id)
  assert.deepEqual(clips.map(clip => set.columns.find(column => column.id === clip.columnId).name), ['1/3 · Bollingen', '2/3 · Küsnacht', '3/3 · Delphi'])
  assert.ok(clips.every(clip => Number.isFinite(clip.at?.start)), 'every stop has its place on the ruler')
  assert.match(track.kind, /recorded/, track.kind)
  assert.equal(set.tracks.some(row => row.id === adapter.techneStreamTrackId('journeys')), false, 'the Journeys stream holds the take, not its empty name')
})

test('(a) the take plays: launching its first stop walks every stop in order on the World, each held for its pace', async () => {
  const owner = kernel(), here = world(), time = clock(), session = createWalkSession({later: time.later})
  session.bind(owner, here.port)
  await session.read()
  await recordTake(session, [BOLLINGEN, KUSNACHT, DELPHI])
  here.state.camera = {lat: 0, lon: 0, dist: 4}
  const set = adapter.projectTechneTracks({world: {state: 'reading'}, recorded: {walks: record.recordedWalksOf(session.get().reading.walk), armed: true},
    controls: techneControls(() => ({view: undefined, door: undefined}), undefined, session)})
  const first = set.columns.find(column => column.name === '1/3 · Bollingen')
  const receipt = await set.actions.launchStop.run(first.id)
  assert.equal(receipt.ok, true, receipt.error)
  assert.deepEqual(here.log.went.map(went => went.placeRef), [BOLLINGEN.ref], 'the first stop stands at once')
  assert.deepEqual(session.get().playing, {walkId: record.takeWalkId('Take 01'), index: 0, total: 3})
  while (time.queue.length) time.tick()
  assert.deepEqual(here.log.went.map(went => went.placeRef), [BOLLINGEN.ref, KUSNACHT.ref, DELPHI.ref], 'then the next, and the next')
  assert.equal(session.get().playing, null, 'and the walk ends at its last stop')
  assert.ok(Math.abs(here.log.went[2].camera.lat - DELPHI.lat) < 1e-9 && Math.abs(here.log.went[2].camera.dist - 2.25) < 1e-9, 'each stop at the camera it was recorded at')
})

// ── (b) the take survives a relaunch ───────────────────────────────────────

test('(b) the take survives a relaunch: a fresh owner over the same works home and a fresh host read it from the owner', async () => {
  const first = kernel(), here = world()
  const before = createWalkSession({later: clock().later})
  before.bind(first, here.port)
  await before.read()
  await recordTake(before, [BOLLINGEN, KUSNACHT, DELPHI])
  // Relaunch: a new owner holds nothing open; the work lives only as its file.
  const owner = kernel(first.disk), session = createWalkSession({later: clock().later})
  session.bind(owner, world().port)
  await session.read()
  assert.equal(session.get().reading.phase, 'read', session.get().line)
  assert.deepEqual(session.get().reading.walk.takes.map(take => [take.name, take.stops.length]), [['Take 01', 3]])
  assert.deepEqual(owner.calls, ['list', 'inspect_file'], 'read from its file, and nothing opened to read it')
  assert.ok(recordedTracks(session).tracks.some(track => track.name === 'Take 01 · stands'), 'it lies on the ruler again')
  // A second take after the relaunch: the work is opened from its file and saved back to it; the first take is kept, the new one stands.
  await recordTake(session, [DELPHI, BOLLINGEN])
  assert.deepEqual(owner.calls.slice(2), ['list', 'open_file', 'edit', 'save', 'inspect'])
  assert.deepEqual(session.get().reading.walk.takes.map(take => take.name), ['Take 01', 'Take 02'])
  assert.deepEqual(recordedTracks(session).tracks.filter(track => /^Take/.test(track.name)).map(track => track.name), ['Take 01', 'Take 02 · stands'])
  // And a third relaunch reads both.
  const third = createWalkSession({later: clock().later})
  third.bind(kernel(first.disk), world().port)
  await third.read()
  assert.deepEqual(third.get().reading.walk.takes.map(take => take.stops.map(stop => stop.caption)), [['Bollingen', 'Küsnacht', 'Delphi'], ['Delphi', 'Bollingen']])
})

// ── (c) Capture ────────────────────────────────────────────────────────────

test('(c) Capture keeps the present view as a Scene of the walk, read back from its owner, and launching it reopens at that view', async () => {
  const owner = kernel(), here = world(), session = createWalkSession({later: clock().later})
  session.bind(owner, here.port)
  await session.read()
  here.state.camera = {lat: 47.21, lon: 8.98, dist: 1.6}
  await session.capture()
  const reading = session.get().reading
  assert.equal(reading.phase, 'read', session.get().line)
  assert.deepEqual(reading.walk.views.map(view => view.title), ['Bollingen'])
  const scene = owner.documents.get(WALK).scenes.find(row => row.scene_ref === reading.walk.views[0].sceneRef)
  assert.ok(scene, 'Capture made a Scene of the walk\'s Expression')
  assert.equal(scene.title, 'Bollingen')
  assert.deepEqual(scene.presentation.scene.research.placeViews.Bollingen.window, WINDOW, 'the Scene keeps the window the World stood in')
  assert.deepEqual(record.walkReadingOf(owner.documents.get(WALK)).views, reading.walk.views, 'read back from the owner')
  // Move the World away, then reopen the kept view from the ruler.
  here.state.camera = {lat: -33, lon: 151, dist: 4.5}
  here.state.window = null
  const set = adapter.projectTechneTracks({world: {state: 'reading'}, recorded: {walks: record.recordedWalksOf(reading.walk), armed: false},
    controls: techneControls(() => ({view: undefined, door: undefined}), undefined, session)})
  const row = set.columns.find(column => column.name === '1/1 · Bollingen')
  assert.ok(row, set.columns.map(column => column.name).join(', '))
  const receipt = await set.actions.launchStop.run(row.id)
  assert.equal(receipt.ok, true, receipt.error)
  const went = here.log.went.at(-1)
  for (const key of ['lat', 'lon', 'dist']) assert.ok(Math.abs(went.camera[key] - {lat: 47.21, lon: 8.98, dist: 1.6}[key]) < 1e-9, `${key}: ${went.camera[key]}`)
  assert.deepEqual(here.log.windows.at(-1), WINDOW, 'and the shared window it was kept in')
  assert.equal(session.get().playing, null, 'a kept view reopens; it does not walk on')
})

test('(c) Capture while Record runs keeps the Scene and adds a stop that carries it; Capture refuses where the World frames no body', async () => {
  const owner = kernel(), here = world(), session = createWalkSession({later: clock().later})
  session.bind(owner, here.port)
  await session.read()
  session.arm(true)
  session.record()
  session.visit(visit(KUSNACHT))
  here.state.place = {ref: DELPHI.ref, name: DELPHI.name}
  here.state.camera = {lat: DELPHI.lat, lon: DELPHI.lon, dist: 2.25}
  await session.capture()
  assert.equal(session.get().recording.stops.length, 2, 'the capture is a stop of the take being recorded')
  const carried = session.get().recording.stops[1]
  assert.deepEqual(carried.binding, {expression_ref: WALK, scene_ref: session.get().reading.walk.views[0].sceneRef}, 'the stop carries the kept Scene')
  await session.stop()
  assert.deepEqual(session.get().reading.walk.takes[0].stops.map(stop => stop.caption), ['Küsnacht', 'Delphi'])
  here.state.open = false
  const lines = session.get().reading.walk.views.length
  await session.capture()
  assert.equal(session.get().reading.walk.views.length, lines, 'nothing kept')
  assert.match(session.get().line, /sky|graph|body/i, session.get().line)
})

// ── the record's law ───────────────────────────────────────────────────────

test('the atlas camera rides the record\'s viewport and comes back exactly; a stop is the frame\'s tour stop', () => {
  for (const camera of [{lat: 47.21, lon: 8.98, dist: 2.25}, {lat: -80, lon: -179.5, dist: 1.07}, {lat: 0, lon: 180, dist: 5.4}]) {
    const back = record.cameraOf(record.viewportOf(camera))
    for (const key of ['lat', 'lon', 'dist']) assert.ok(Math.abs(back[key] - camera[key]) < 1e-9, `${key} ${camera[key]} → ${back[key]}`)
    assert.equal(record.viewportOf(camera).x, camera.lon, 'a longitude on the globe is kept as it is')
  }
  assert.ok(record.viewportOf({lat: 0, lon: 0, dist: 5.4}).zoom < record.viewportOf({lat: 0, lon: 0, dist: 1.07}).zoom, 'nearer is a greater zoom')
  const stop = record.stopOfVisit(visit(BOLLINGEN))
  assert.equal(placeTourProblem({stops: [stop]}), null)
  assert.deepEqual(Object.keys(stop).sort(), ['caption', 'hold_ms', 'place_ref', 'viewport'], 'a place visited at no moment, of no thing: no moment and no thing field (absent is none)')
  assert.equal(stop.hold_ms, record.WALK_PACE_MS)
  assert.equal(record.nextTakeName([]), 'Take 01')
  assert.equal(record.nextTakeName(['Take 01', 'Take 02']), 'Take 03')
  assert.equal(record.nextTakeName(Array.from({length: 16}, (_, index) => record.takeName(index + 1))), null, 'a walk keeps at most sixteen takes')
})

// ── the transport ──────────────────────────────────────────────────────────

test('the transport: Arm lets the World write, Record runs only armed, Stop keeps the take, Capture keeps the view; closed, each says why', () => {
  const acts = {arm: on => calls.push(['arm', on]), record: () => calls.push(['record']), stop: () => calls.push(['stop']), capture: () => calls.push(['capture']),
    play: (walk, from) => { calls.push(['play', walk, from]); return null }, halt: () => calls.push(['halt'])}
  let calls = []
  const base = {bound: true, armed: false, recording: null, reading: {phase: 'none'}, busy: false, playing: null, line: null}
  const closed = walkBindings({...base, bound: false}, acts, null)
  for (const slot of ['arm', 'record', 'capture']) assert.match(closed[slot].refused ?? '', /World is not open/, slot)
  const unarmed = walkBindings(base, acts, null)
  assert.equal(unarmed.arm.lit, false)
  assert.match(unarmed.record.refused, /Arm/, 'Record waits for Arm')
  unarmed.arm.press()
  unarmed.capture.press()
  assert.deepEqual(calls, [['arm', true], ['capture']])
  calls = []
  const armed = walkBindings({...base, armed: true}, acts, null)
  assert.equal(armed.arm.lit, true)
  armed.record.press()
  assert.deepEqual(calls, [['record']])
  assert.equal(armed.stop, undefined, 'nothing records or plays: Stop is the atlas\'s own')
  calls = []
  const recording = walkBindings({...base, armed: true, recording: {stops: [{}, {}], last: null}}, acts, null)
  assert.equal(recording.record.lit, true)
  assert.match(recording.record.title, /2 stops/)
  recording.stop.press()
  assert.deepEqual(calls, [['stop']])
  assert.match(recording.arm.refused, /Stop/, 'Arm holds while the take records')
  calls = []
  const selected = walkBindings({...base, reading: {phase: 'read'}}, acts, {walkId: 'walk:take-01', index: 1, name: 'Take 01'})
  selected.play.press()
  assert.deepEqual(calls, [['play', 'walk:take-01', 1]], 'with a stop of a take selected, Play walks the take from it')
  calls = []
  const playing = walkBindings({...base, playing: {walkId: 'walk:take-01', index: 1, total: 3}}, acts, null)
  assert.equal(playing.play.lit, true)
  assert.equal(playing.signature.readout.value, '2/3', 'which stop of how many')
  playing.stop.press()
  assert.deepEqual(calls, [['halt']])
})

test('the mixer row\'s Arm on a recorded walk is the World\'s one arm; a reading\'s track takes no writes', async () => {
  let armed = false
  const walks = [{id: 'walk:take-01', name: 'Take 01 · stands', kind: record.RECORDED_WALK_KIND, derived: false, stops: [{id: 'a', label: 'Bollingen', also: []}]}]
  const set = adapter.projectTechneTracks({world: {state: 'reading'}, recorded: {walks, armed, arm: on => { armed = on; return {ok: true, note: 'armed'} }}})
  const track = set.tracks.find(row => row.name === 'Take 01 · stands')
  assert.equal(track.mix?.arm, false, 'the arm\'s reading on the walk\'s own track')
  assert.equal(set.mixer.arm.disabled, undefined, 'Arm is written by the World\'s arm while the World is open')
  assert.equal((await set.actions.mixer.arm.run(track.id, true)).ok, true)
  assert.equal(armed, true)
  const reading = await set.actions.mixer.arm.run(adapter.techneStreamTrackId('readings'), true)
  assert.equal(reading.ok, false)
  assert.match(reading.error, /sources/)
  const closed = adapter.projectTechneTracks({world: {state: 'reading'}})
  assert.match(closed.mixer.arm.disabled, /World/, 'with the World closed, Arm says where the writer is')
  assert.doesNotMatch(closed.mixer.arm.disabled, /missing op/, 'the op exists now')
})

// ── the visits ─────────────────────────────────────────────────────────────

test('a place the World turns to is a visit: while Record runs the one door adds a stop, and so does an occurrence the atlas opens itself', async () => {
  const {walkSession, lastWalkVisit} = await import('../src/projections/atlas/walks/walkSession.ts')
  const places = await import('../src/projections/atlas/places/placesHost.ts')
  const {visitOfManifest} = await import('../src/projections/atlas/walks/walksHost.ts')
  const standing = await import('../src/projections/atlas/provider/suiteStanding.ts')
  const located = (place, subject) => ({ref: place.ref, name: place.name, kind: 'declared', owner: 'central', source: 'fixture', subject_ref: subject, located: true, precision: 'exact', lat: place.lat, lon: place.lon, reason: null})
  standing.publishSuiteStanding({...standing.IDLE_STANDING, phase: 'ready', places: [located(BOLLINGEN, 'wiki:node:tower'), located(DELPHI, 'wiki:node:oracle')]})
  const flights = []
  const handle = {model: {occ: [{id: 'o-tower', subject_ref: 'wiki:node:tower', label: 'The tower', lat: BOLLINGEN.lat, lon: BOLLINGEN.lon, geoPrecision: 'exact', familyId: 'f'}], occIndex: new Map([['o-tower', 0]])},
    ctl: {state: {view: {kind: 'world'}}, skyCam: {busy: false}, navigate(state) { this.state = {...this.state, ...state} }, toggleMode() {}},
    engine: {rig: {flyTo: (...args) => flights.push(args)}}}
  const release = walkSession.bind(kernel(), world().port)
  try {
    walkSession.arm(true)
    walkSession.record()
    assert.equal(places.turnAtlasTo(handle, standing.suitePlaces().find(place => place.ref === DELPHI.ref)), true)
    assert.deepEqual(flights.at(-1), [DELPHI.lat, DELPHI.lon, places.framingDistance('exact')], 'the World flies there')
    handle.ctl.state = {view: {kind: 'manifest', occId: 'o-tower'}}
    const opened = visitOfManifest(handle)
    assert.deepEqual(opened, {placeRef: BOLLINGEN.ref, name: BOLLINGEN.name, camera: {lat: BOLLINGEN.lat, lon: BOLLINGEN.lon, dist: places.framingDistance('exact')}, thingRef: 'wiki:node:tower'},
      'named by the world\'s place there, and the thing it is by its subject\'s ref')
    const {noteWalkVisit} = await import('../src/projections/atlas/walks/walkSession.ts')
    noteWalkVisit(opened)
    assert.deepEqual(walkSession.get().recording.stops.map(stop => [stop.place_ref, stop.caption]), [[DELPHI.ref, 'Delphi'], [BOLLINGEN.ref, 'Bollingen']])
    assert.equal(lastWalkVisit().placeRef, BOLLINGEN.ref, 'the World stands on the last place visited')
    handle.ctl.state = {view: {kind: 'manifest', occId: 'nowhere'}}
    assert.equal(visitOfManifest(handle), null, 'an occurrence the field does not hold is no visit')
  } finally {
    release()
    standing.resetSuiteStanding()
  }
  assert.equal(walkSession.get().bound, false)
  assert.match(walkSession.get().line, /not kept/, 'a recording the World\'s closing cut short says so')
})

// ── (d) moments and things (part two) ──────────────────────────────────────

const RUN_AT = Date.UTC(2026, 9, 28, 10, 15)
const RUN = {from: new Date(RUN_AT).toISOString(), to: new Date(RUN_AT).toISOString()}
const DEEP = {from: null, to: '1600-01-01T00:00:00Z'}
const TOWER = 'wiki:node:tower'
const LIVE = {state: 'live', sets: [], eventByClipId: new Map(), todayYear: 2026}
const stand = stop => [stop.place_ref, stop.moment ?? null, stop.thing_ref ?? null]

test('(d) Record catches moments and things beside places: each stop keeps the moment in force and the thing it visited, read back from its owner', async () => {
  const owner = kernel(), here = world(), session = createWalkSession({later: clock().later})
  session.bind(owner, here.port)
  await session.read()
  session.arm(true)
  session.record()
  session.visit(visit(BOLLINGEN))
  // An occasion stood on the time spine is a moment: a stop where the World stands, and the moment in force from then on.
  here.state.moment = RUN
  session.visit({...visit(BOLLINGEN), name: 'Run 214 landed', moment: RUN})
  session.visit(visit(BOLLINGEN))
  session.visit(visit(KUSNACHT))
  // A thing the World selects is a stop that keeps it by its owner's ref; selecting it again is no move.
  session.visit({...visit(KUSNACHT), name: 'The tower', thingRef: TOWER})
  session.visit({...visit(KUSNACHT), name: 'The tower', thingRef: TOWER})
  here.state.moment = DEEP
  session.visit({placeRef: null, name: 'The Red Book', camera: {lat: 0, lon: 0, dist: 3}, thingRef: 'wiki:node:red-book'})
  const stops = session.get().recording.stops
  assert.deepEqual(stops.map(stand), [[BOLLINGEN.ref, null, null], [BOLLINGEN.ref, RUN, null], [KUSNACHT.ref, RUN, null], [KUSNACHT.ref, RUN, TOWER], [null, DEEP, 'wiki:node:red-book']],
    'a place at no moment; the occasion; a place at the moment in force; a thing there; a thing at a deep moment')
  assert.deepEqual(stops.map(stop => stop.caption), ['Bollingen', 'Run 214 landed', 'Küsnacht', 'The tower', 'The Red Book'])
  await session.stop()
  assert.equal(session.get().reading.phase, 'read', session.get().line)
  const kept = record.walkReadingOf(owner.documents.get(WALK)).takes[0].stops
  assert.deepEqual(kept.map(stand), stops.map(stand), 'the owner keeps each stop\'s moment and thing')
  assert.equal(placeTourProblem({stops: kept}), null, 'under the frame\'s tour law')
  // On the ruler: a stop of no moment stands at a no-time slot; the rest lie at their moments.
  const walk = session.get().reading.walk
  assert.deepEqual(record.recordedWalksOf(walk)[0].stops.map(stop => stop.year), [undefined, 2026, 2026, 2026, 1600], 'each stop names the year its moment stands in, whole')
  const set = adapter.projectTechneTracks({world: LIVE, recorded: {walks: record.recordedWalksOf(walk), instants: record.recordedInstantsOf(walk), armed: true}})
  const track = set.tracks.find(row => row.name === 'Take 01 · stands')
  const at = set.clips.filter(clip => clip.trackId === track.id).map(clip => clip.at.start)
  assert.equal(set.ruler.label(at[0]), 'no time · 1', 'a stop kept at no moment')
  assert.equal(at[1], set.ruler.instant(RUN_AT), 'the occasion lies at its instant among the covered day\'s hours')
  assert.deepEqual([at[2], at[3]], [at[1], at[1]], 'and the stops made at that moment beside it')
  assert.equal(set.ruler.label(at[4]), '1600', 'a deep moment lies at its year')
  assert.match(set.ruler.unit, /no-time slots, then deep-time years .*, then UTC hours/)
})

test('(d) playing a take turns the window to each stop\'s moment and selects the thing each stop visited', async () => {
  const owner = kernel(), here = world(), time = clock(), session = createWalkSession({later: time.later})
  session.bind(owner, here.port)
  await session.read()
  session.arm(true)
  session.record()
  here.state.moment = RUN
  session.visit({...visit(BOLLINGEN), name: 'Run 214 landed', moment: RUN})
  session.visit({...visit(KUSNACHT), name: 'The tower', thingRef: TOWER})
  here.state.moment = null
  session.visit(visit(DELPHI))
  await session.stop()
  here.state.window = null
  here.log.windows.length = 0
  assert.equal(session.play(record.takeWalkId('Take 01'), 0), null)
  while (time.queue.length) time.tick()
  assert.deepEqual(here.log.went.map(went => went.placeRef), [BOLLINGEN.ref, KUSNACHT.ref, DELPHI.ref], 'the World stands each stop')
  assert.deepEqual(here.log.windows, [RUN, RUN], 'the window turns to each stop\'s moment; a stop kept at no moment leaves it as it stands')
  assert.deepEqual(here.log.selected, [TOWER], 'the World selects the thing a stop visited')
  assert.match(session.get().line, /walked its 3 stops/)
})

test('(d) the host: an occasion stood on the time spine is a moment while Record runs; an occurrence the World or the graph opens is a thing by its owner\'s ref', async () => {
  const {walkSession} = await import('../src/projections/atlas/walks/walkSession.ts')
  const {bindWalks, atlasWalkWorld} = await import('../src/projections/atlas/walks/walksHost.ts')
  const {publishTimelineReading} = await import('../src/projections/timelinePaneHost.ts')
  const {createTimeSpine} = await import('../src/timeline/timeSpine.ts')
  const faces = new Set()
  const handle = {
    model: {occ: [{id: 'o-dream', subject_ref: 'wiki:node:dream', label: 'A dream', lat: 0, lon: 0, geoPrecision: 'none', familyId: 'f'},
      {id: 'o-tower', subject_ref: TOWER, label: 'The tower', lat: 30, lon: 30, geoPrecision: 'exact', familyId: 'f'}],
    occIndex: new Map([['o-dream', 0], ['o-tower', 1]])},
    ctl: {state: {view: {kind: 'world'}}, fieldFilter: {kinds: ['dream']}, filters: [], skyCam: {busy: false},
      subscribeFaces: listener => { faces.add(listener); return () => faces.delete(listener) },
      navigate(next) { this.state = {...this.state, ...next}; for (const listener of [...faces]) listener() },
      setFilter(filter) { this.filters.push(filter); this.fieldFilter = filter }, toggleMode() {}},
    engine: {rig: {lat: 10, lon: 10, dist: 2.4, flyTo() {}}},
  }
  const spine = createTimeSpine()
  publishTimelineReading({spine})
  const binding = bindWalks({handle, transport: {kind: 'unavailable', reason: 'no kernel in this test'}})
  try {
    walkSession.arm(true)
    walkSession.record()
    spine.selectOccasion({subject_ref: 'run:214', instant_unix_ms: RUN_AT, summary: 'Run 214 landed'}, RUN_AT)
    spine.setTransportPosition(null)
    handle.ctl.navigate({view: {kind: 'manifest', occId: 'o-dream'}, graph: true})
    const stops = walkSession.get().recording.stops
    assert.deepEqual(stops.map(stop => [stop.caption, stop.moment ?? null, stop.thing_ref ?? null]), [['Run 214 landed', RUN, null], ['A dream', RUN, 'wiki:node:dream']],
      'the occasion is a stop at its moment (a spine change that moves no occasion is none); the graph\'s node is a thing at the moment in force')
    const camera = record.cameraOf(stops[1].viewport)
    for (const key of ['lat', 'lon', 'dist']) assert.ok(Math.abs(camera[key] - handle.engine.rig[key]) < 1e-9, `a thing with no place keeps where the World stood: ${key}`)
    handle.ctl.navigate({view: {kind: 'manifest', occId: 'o-tower'}, graph: undefined})
    assert.deepEqual(stand(walkSession.get().recording.stops[2]), [null, RUN, TOWER], 'an occurrence opened on the Earth is a thing at its place')
    const port = atlasWalkWorld(handle)
    assert.deepEqual(port.moment(), RUN, 'the moment in force is the occasion the spine stands on')
    spine.returnToNow()
    assert.equal(port.moment(), null, 'back at Now there is none')
    assert.equal(port.select('wiki:node:dream'), null)
    assert.equal(handle.ctl.state.view.occId, 'o-dream', 'selecting a thing opens its occurrence')
    assert.match(port.select('wiki:node:nowhere'), /holds no occurrence/)
  } finally {
    binding.dispose()
    publishTimelineReading(null)
  }
})

// ── (e) a kept view holds the filter in force ──────────────────────────────

test('(e) Capture keeps the atlas\'s filter in force with the view, read back from its owner, and reopening the view restores it', async () => {
  const owner = kernel(), here = world(), session = createWalkSession({later: clock().later})
  session.bind(owner, here.port)
  await session.read()
  here.state.filter = 'k=dream,vision&e=1900..1961'
  await session.capture()
  here.state.filter = ''
  here.state.place = {ref: KUSNACHT.ref, name: KUSNACHT.name}
  await session.capture()
  here.state.filter = null
  here.state.place = {ref: DELPHI.ref, name: DELPHI.name}
  await session.capture()
  const views = session.get().reading.walk.views
  assert.deepEqual(views.map(view => [view.title, view.view.filter]), [['Bollingen', 'k=dream,vision&e=1900..1961'], ['Küsnacht', ''], ['Delphi', undefined]],
    'the filter in force, none in force, and none to read (the atlas closed)')
  const scene = owner.documents.get(WALK).scenes.find(row => row.scene_ref === views[0].sceneRef)
  assert.equal(scene.presentation.scene.research.placeViews.Bollingen.filter, 'k=dream,vision&e=1900..1961', 'the Scene keeps it')
  here.state.filter = 'c=gnostic'
  assert.equal(session.play(record.KEPT_VIEWS_WALK_ID, 0), null)
  assert.deepEqual(here.log.filters, ['k=dream,vision&e=1900..1961'], 'reopening restores the filter it kept')
  session.play(record.KEPT_VIEWS_WALK_ID, 1)
  assert.deepEqual(here.log.filters.at(-1), '', 'a view kept with no filter in force clears the filter')
  here.log.filters.length = 0
  session.play(record.KEPT_VIEWS_WALK_ID, 2)
  assert.deepEqual(here.log.filters, [], 'a view kept without a filter leaves the filter in force as it stands')
})

test('(e) the host: the World\'s filter is the atlas\'s own query, and setting one narrows the atlas through its own filter', async () => {
  const {atlasWalkWorld} = await import('../src/projections/atlas/walks/walksHost.ts')
  const handle = {model: {occ: [], occIndex: new Map()}, engine: {rig: {lat: 0, lon: 0, dist: 3}},
    ctl: {state: {view: {kind: 'world'}}, fieldFilter: {kinds: ['dream'], era: [1900, 1961]}, filters: [], setFilter(filter) { this.filters.push(filter); this.fieldFilter = filter }}}
  const port = atlasWalkWorld(handle)
  assert.equal(port.filter(), 'e=1900..1961&k=dream')
  assert.equal(port.setFilter('c=gnostic&e=-200..400'), null)
  assert.deepEqual(handle.ctl.filters.at(-1), {cultures: ['gnostic'], era: [-200, 400]})
  port.setFilter('')
  assert.deepEqual(handle.ctl.filters.at(-1), {}, 'an empty filter is no filter')
})

// ── (f) the walk's pace is the transport's Tempo ───────────────────────────

test('(f) the walk keeps the Palace\'s Tempo: stops are recorded at the pace, a take walks at it, and Tempo steps it outside a palace', async () => {
  const {TOUR_FLIGHT_MS} = await import('../../../../desktop/cradle/expressions-app/field-studies-journeys/src/placeTourRecord.ts')
  const palace = await import('../src/projections/atlas/palaces/palaceSession.ts')
  const owner = kernel(), here = world(), time = clock(), session = createWalkSession({later: time.later})
  here.state.pace = 3000
  session.bind(owner, here.port)
  await session.read()
  await recordTake(session, [BOLLINGEN, KUSNACHT])
  assert.deepEqual(session.get().reading.walk.takes[0].stops.map(stop => stop.hold_ms), [3000, 3000], 'each stop keeps the pace it was recorded at')
  here.state.pace = 12000
  session.play(record.takeWalkId('Take 01'), 0)
  assert.equal(time.queue.at(-1).ms, TOUR_FLIGHT_MS + 12000, 'a take walks at the walk\'s pace as Tempo sets it now')
  session.halt()
  // The transport's Tempo outside a palace: the walk's pace, stepped as the Palace steps it.
  palace.resetPalaceSession()
  const pace = palace.walkPace()
  assert.equal(pace, palace.PALACE_WALK_DWELL_MS)
  const stepped = []
  const acts = {arm() {}, record() {}, stop() {}, capture() {}, play: () => null, halt() {}, tempo: direction => stepped.push(direction)}
  const bindings = walkBindings({bound: true, armed: false, recording: null, reading: {phase: 'none'}, busy: false, playing: null, line: null}, acts, null, pace)
  assert.equal(bindings.tempo.readout.value, `${pace / 1000} s`)
  bindings.tempo.step(1)
  assert.deepEqual(stepped, [1])
  let heard = 0
  const off = palace.subscribeWalkPace(() => heard++)
  palace.stepTempo(1)
  assert.ok(palace.walkPace() < pace, 'outside a palace, › quickens the walk\'s pace')
  palace.stepTempo(-1)
  assert.equal(palace.walkPace(), pace, '‹ slows it again')
  assert.equal(heard, 2, 'and each step is heard')
  off()
  palace.resetPalaceSession()
})

// ── the real owner ─────────────────────────────────────────────────────────

// SCRIPTED against the real kernel: the walk-bridge binary (OI_KERNEL_WALK_BRIDGE) over a scratch Central root (OI_CENTRAL_CTRL_BIN), with
// HOME, OI_HOME and AIKIT_HOME in the scratch folder, through the product's own owner (walksHost.ts kernelWalkOwners over a bridge
// transport). The bridge is stopped and started again between the take and its reading: a relaunch of the owner. Skipped without both.
const bridgeBin = process.env.OI_KERNEL_WALK_BRIDGE, ctrlBin = process.env.OI_CENTRAL_CTRL_BIN
test('the real owner keeps the take and the view, and a relaunched owner reads them from the works home', {skip: !(bridgeBin && ctrlBin) && 'set OI_KERNEL_WALK_BRIDGE and OI_CENTRAL_CTRL_BIN'}, async () => {
  const {mkdtemp, mkdir, rm} = await import('node:fs/promises')
  const {tmpdir} = await import('node:os')
  const {join} = await import('node:path')
  const {spawn, execFileSync} = await import('node:child_process')
  const {kernelWalkOwners} = await import('../src/projections/atlas/walks/walksHost.ts')
  const scratch = await mkdtemp(join(tmpdir(), 'oi-walk-760-'))
  const env = {...process.env, HOME: join(scratch, 'home'), OI_HOME: join(scratch, 'oi'), AIKIT_HOME: join(scratch, 'aikit'), OI_CENTRAL_ROOT: join(scratch, 'root')}
  for (const dir of ['home', 'oi', 'aikit', 'root']) await mkdir(join(scratch, dir))
  execFileSync(ctrlBin, ['--json', '--root', env.OI_CENTRAL_ROOT, 'action', 'run', 'central.init', '{}'], {env})
  await mkdir(join(env.OI_CENTRAL_ROOT, 'Control/user/flows'), {recursive: true})
  const port = 4700 + Math.floor(Math.random() * 50)
  let child = null
  const start = async () => {
    child = spawn(bridgeBin, [`127.0.0.1:${port}`], {env, stdio: 'ignore'})
    for (let i = 0; i < 100; i++) { try { await fetch(`http://127.0.0.1:${port}/state`); return } catch { await new Promise(resolve => setTimeout(resolve, 100)) } }
    throw Error('the walk bridge did not start')
  }
  const stop = async () => { const exited = new Promise(resolve => child.once('exit', resolve)); child.kill('SIGTERM'); await exited }
  try {
    await start()
    const owners = kernelWalkOwners({kind: 'bridge', url: `http://127.0.0.1:${port}`})
    const here = world(), session = createWalkSession({later: clock().later})
    session.bind(owners, here.port)
    await session.read()
    // Part two: a place, a moment (an occasion's instant, then in force) and a thing, kept by the real owner's law.
    session.arm(true)
    session.record()
    session.visit(visit(BOLLINGEN))
    here.state.moment = RUN
    session.visit({...visit(KUSNACHT), moment: RUN})
    session.visit({...visit(DELPHI), thingRef: TOWER})
    await session.stop()
    assert.equal(session.get().reading.phase, 'read', session.get().line)
    assert.equal(session.get().reading.saved, true, session.get().line)
    here.state.filter = 'k=dream&e=1900..1961'
    await session.capture()
    assert.deepEqual(session.get().reading.walk.views.map(view => view.title), ['Bollingen'], session.get().line)
    await stop()
    await start()
    const fresh = createWalkSession({later: clock().later})
    fresh.bind(kernelWalkOwners({kind: 'bridge', url: `http://127.0.0.1:${port}`}), world().port)
    await fresh.read()
    const reading = fresh.get().reading
    assert.equal(reading.phase, 'read', fresh.get().line ?? JSON.stringify(reading))
    assert.deepEqual(reading.walk.takes.map(take => [take.name, take.stops.map(stop => stop.caption)]), [['Take 01', ['Bollingen', 'Küsnacht', 'Delphi']]])
    assert.deepEqual(reading.walk.takes[0].stops.map(stand), [[BOLLINGEN.ref, null, null], [KUSNACHT.ref, RUN, null], [DELPHI.ref, RUN, TOWER]], 'each stop\'s moment and thing, read back after the relaunch')
    assert.deepEqual(reading.walk.views[0].view.window, WINDOW)
    assert.equal(reading.walk.views[0].view.filter, 'k=dream&e=1900..1961', 'the view\'s filter in force, read back after the relaunch')
    const camera = record.cameraOf(reading.walk.views[0].view.viewport)
    for (const key of ['lat', 'lon', 'dist']) assert.ok(Math.abs(camera[key] - {lat: BOLLINGEN.lat, lon: BOLLINGEN.lon, dist: 2.25}[key]) < 1e-9, key)
  } finally {
    if (child && child.exitCode === null) await stop()
    await rm(scratch, {recursive: true, force: true})
  }
})
