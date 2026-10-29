// Coming in to a place, a facet place as a stop, and a kept view on the transport (O-I #742, round two; walk 739 T1, T3, T4).
// - T1, manual §17.2: "The flight ends at a scale that fits the precision of the place. An exact place gets a street, an approximate place
//   gets a city, and a region gets the whole region"; the Place scale is "one place with its exact position". The one door every flight to a
//   place goes through (places/placesHost.ts turnAtlasTo) comes in to the place's own framing, also when it opens the subject drawn there.
// - A place a facet declares (Chartres, `aikit.techne-facet/v1` on another subject) has a ref of its own that no occurrence carries: the
//   Earth's pane, following the selection (registerAtlasHost.ts turnWithSubject), turns to it through the same door, so it is a stop.
// - T4: a kept view's clip selected, the transport's Play reopens it (places/placesTransport.ts selectedWalkStop).
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


globalThis.window ??= {addEventListener() {}, removeEventListener() {}}
globalThis.document ??= {createElement: () => ({setAttribute() {}, append() {}, classList: {add() {}}}), body: {dataset: {}, classList: {add() {}, remove() {}}}, addEventListener() {}, removeEventListener() {}}
const places = await import('../src/projections/atlas/places/placesHost.ts')
const placesModel = await import('../src/projections/atlas/places/placesModel.ts')
const standing = await import('../src/projections/atlas/provider/suiteStanding.ts')
const {MIN_DIST} = await import('../src/projections/atlas/src/globe/zoom.ts')
const panel = await import('../src/projections/atlas/AtlasProjectionPanel.tsx')
const {turnWithSubject} = await import('../src/projections/atlas/registerAtlasHost.ts')
const {createPaneSubject} = await import('../../../../desktop/cradle/src/surface/projectionModules.ts')
const {walkSession} = await import('../src/projections/atlas/walks/walkSession.ts')
const {selectedWalkStop, walkBindings} = await import('../src/projections/atlas/places/placesTransport.ts')
const record = await import('../src/projections/atlas/walks/walkRecord.ts')

const CHAPEL = {ref: 'wiki:node:identity', name: 'The Chapel', kind: 'declared', owner: 'central', source: 'fixture', subject_ref: 'wiki:node:identity', located: true, precision: 'exact', lat: 50.18, lon: -4.27, reason: null}
const CHARTRES = {ref: 'place:chartres', name: 'Chartres', kind: 'declared', owner: 'central', source: 'fixture', subject_ref: 'wiki:node:root/ta-onta', located: true, precision: 'region', lat: 48.45, lon: 1.49, reason: null}
const OCC = [{id: 'o-chapel', subject_ref: 'wiki:node:identity', label: 'User identity', lat: 50.18, lon: -4.27, geoPrecision: 'exact', familyId: 'f'},
  {id: 'o-taonta', subject_ref: 'wiki:node:root/ta-onta', label: 'The beings', lat: 48.45, lon: 1.49, geoPrecision: 'region', familyId: 'f'}]
function atlas() {
  const flights = [], navigated = []
  const handle = {model: {occ: OCC, occIndex: new Map(OCC.map((occ, i) => [occ.id, i]))},
    ctl: {state: {view: {kind: 'world'}}, skyCam: {busy: false}, navigate(state) { navigated.push(state.view?.occId ?? state.view?.kind); this.state = {...this.state, ...state} }, toggleMode() {}},
    engine: {rig: {dist: 3.8, flyTo: (...args) => flights.push(args)}}}
  return {handle, flights, navigated}
}
const now = run => { run(); return () => {} }

test('T1: a flight to a place comes in to its own framing — a street for an exact place, a city, the whole region — and the Place scale holds it', () => {
  const exact = places.framingDistance('exact'), approximate = places.framingDistance('approximate'), region = places.framingDistance('region')
  assert.ok(Math.abs(exact - (MIN_DIST + 0.02)) < 1e-9, `an exact place: as near as the atlas's camera flies (got ${exact})`)
  assert.ok(exact < approximate && approximate < region, `${exact} < ${approximate} < ${region}`)
  const scale = (dist, placeHeld = true) => placesModel.atlasScaleOf({sky: false, graph: false, dist, placeHeld})
  assert.equal(scale(exact), 'place'); assert.equal(scale(approximate), 'place')
  assert.equal(scale(region), 'region', 'a region is the whole region, not one place')
  assert.equal(scale(2.25), 'region', 'the atlas\'s own continental framing of an opened subject is no single place')
  // The one door: an exact place drawn there is opened, and the World comes in to it.
  const {handle, flights, navigated} = atlas()
  standing.publishSuiteStanding({...standing.IDLE_STANDING, phase: 'ready', places: [CHAPEL, CHARTRES]})
  try {
    assert.equal(places.turnAtlasTo(handle, CHAPEL, now), true)
    assert.deepEqual(navigated, ['o-chapel'], 'the subject drawn there is opened')
    assert.deepEqual(flights.at(-1), [CHAPEL.lat, CHAPEL.lon, exact], 'and the World comes in to it')
  } finally { standing.resetSuiteStanding() }
})

test('a facet place (Chartres) selected turns the Earth through the one door, and while Record runs it is a stop of the walk', async () => {
  const {handle, flights, navigated} = atlas()
  standing.publishSuiteStanding({...standing.IDLE_STANDING, phase: 'ready', places: [CHAPEL, CHARTRES]})
  panel.publishAtlasHandle(handle)
  const owners = {async expression(request) { if (request.operation === 'list') return {schema: 'oi.expression-list/v1', expressions: [], unreadable: []}; throw Error('no owner in this test') }}
  const port = {key: 'central', title: 'Central', here: () => ({camera: {lat: 0, lon: 0, dist: 3.8}, place: null}), window: () => null, moment: () => null, filter: () => '', pace: () => 6000,
    go() {}, select: () => null, setWindow: () => null, setFilter: () => null, placeName: () => null}
  const release = walkSession.bind(owners, port)
  const subject = createPaneSubject()
  const turning = turnWithSubject(subject, {held: null})
  try {
    walkSession.arm(true)
    walkSession.record()
    subject.follow('place:chartres')
    assert.deepEqual(navigated, ['o-taonta'], 'the subject the facet declares the place on is opened there')
    assert.deepEqual(flights.at(-1), [CHARTRES.lat, CHARTRES.lon, places.framingDistance('region')], 'and the World comes in to the whole region')
    assert.deepEqual(walkSession.get().recording.stops.map(stop => [stop.place_ref, stop.caption]), [['place:chartres', 'Chartres']], 'Chartres is a stop')
    subject.follow('wiki:node:identity')
    assert.deepEqual(walkSession.get().recording.stops.map(stop => stop.caption), ['Chartres', 'The Chapel'])
  } finally {
    turning.stop()
    release()
    panel.publishAtlasHandle(null)
    standing.resetSuiteStanding()
  }
})

test('T4: a kept view\'s clip selected, Play reopens it — the World returns to the view it keeps', () => {
  const view = {sceneRef: 'walk:central:scene:view-1', title: 'You may propose', view: {viewport: {lat: 41.9, lon: 12.5, dist: 2.6}, window: null}}
  const state = {bound: true, armed: false, recording: null, reading: {phase: 'read', walk: {takes: [], views: [view], events: []}, saved: true}, busy: false, playing: null, line: null}
  const clip = {kind: 'clip', ref: `techne:stop:${record.KEPT_VIEWS_WALK_ID}:1`}
  const selected = selectedWalkStop(state, clip)
  assert.deepEqual(selected, {walkId: record.KEPT_VIEWS_WALK_ID, index: 0, name: 'You may propose'})
  const played = []
  const bindings = walkBindings(state, {arm() {}, record() {}, stop() {}, capture() {}, tempo() {}, halt() {}, play: (walkId, from) => { played.push([walkId, from]); return null }}, selected, 6000)
  assert.match(bindings.play.title, /^Reopen — You may propose: the World returns to the view it keeps/)
  bindings.play.press()
  assert.deepEqual(played, [[record.KEPT_VIEWS_WALK_ID, 0]])
  assert.equal(selectedWalkStop(state, {kind: 'clip', ref: `techne:stop:${record.KEPT_VIEWS_WALK_ID}:2`}), null, 'no second view is kept')
})
