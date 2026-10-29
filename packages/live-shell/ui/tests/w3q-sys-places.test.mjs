// T-PROCEDURAL-BODY §6 item 4 (Lane B, the system) — the places on a body, audited sentence by sentence against the manual (DLW.md §17.2:
// "The five scales", "Build a planet", "Your system", the Rules, "To use the World"). One test for each sentence that concerns a location.
// Each test says, in the comment above it, what the code did when the audit was made (file:line) and carries one of two marks:
//   MET     the code did what the sentence says; the test goes red if the code stops
//   NOT MET the code did not; the test describes what the manual says and was red until the lane landed it
// One sentence no owner can take (a portal) is carried out of the ticket: its test holds the refusal in words that names the owner. The route
// it carried with it landed with O-I #746 (1c, 18c).
//
// The sentences, and where the code stands (the audit; the lead's return carries the same table):
//    1 "Click the body to place a place, a palace, a portal or a route."        place, palace MET · route MET since O-I #746 (1c) · portal: no owner takes it (1b): refused in words, carried
//    2 "The World suggests a name from the seed. Keep it or type your own."      MET (placeTool.ts:170, body.ts:278 suggestName)
//    3 "Reroll … every location keeps its name and the position you gave it."    MET (worldBody.ts:155 changedBody; bodyLocations.ts rows come from the owners' places)
//    4 "Where that spot is now sea, the World draws the location on the nearest  MET (systemOverlay.ts:42-47 drawnLocations; :158-160 the mark's words)
//       shore and says so; nothing moves until you move it."
//    5 "An exact place gets a street, an approximate place a city, a region the  NOT MET: two framings for three precisions (placesHost.ts:66-68)
//       whole region."
//    6 "The flight ends at a scale that fits the precision of the place."        MET for the two it has (placesModel.ts:183-189 atlasScaleOf)
//    7 "A place with no position does not fly. The World lists it in a separate  MET (placesHost.ts:72-75; placesModel.ts:77-92 placeRows)
//       register."
//    8 "Fly to a place from anywhere."                                           NOT MET from the sky or the Graph (placesHost.ts:93); NOT MET to a place on your body (:73-75: on_body is no position)
//    9 "Click a location to select it."                                          NOT MET on your body: its marks are role=img with no press (systemOverlay.ts:158-162)
//   10 "Enter the place and you are on that world."                              NOT MET: a landed world's mark opens nothing (systemModel.ts:195 landingLocations; no enter)
//   11 "A mythic place looks mythic in every view."                              MET on the Earth (globe/presences.ts:147-148 aLocus; places/PlacesPlate.tsx StandingTag); NOT MET on your body (bodyLocations.ts rows carry no locus)
//   12 "Locations stand on the body at their names" (Body and Region scales)     MET on your body (systemOverlay.ts:233-241)
//   13 "Anchor lines run to real places on Earth. Follow an anchor line to its   NOT MET: no line, no model (PATH W3b: "Earth's places drawn over your body" is open)
//       place on Earth."
//   14 "A place keeps the precision that its source states. An approximate       MET on the Earth (globe/presences.ts, placesModel.ts precision grammar); NOT MET on your body (rows drop precision)
//       place does not look exact."
//   15 "A click on the body makes an approximate place. A drag does not make it   MET (placeTool.ts:167-187 draftAt; placesHost.ts:114-141 the click is a press under 500 ms and 10 px)
//       exact."
//   16 "Only the places that were valid in that window show on the body."         NOT MET on your body (bodyLocations.ts ignores the window); the Earth's follow the window
//   17 "Every world you start lands as a place on your planet."                   NOT MET: a world lands only when the person presses Land (SystemReadings.tsx:61 landWorld; systemModel.ts:195)
//   18 "Every walk you take wears a path between places."                         MET on the Earth (placesModel.ts:151-166 routeRows; globe/arcs.ts); NOT MET on your body (routeRows counts Earth places only);
//      a route's line through its stops in order, on your body and the Earth: MET since O-I #746 (18c)
//
// Channels: scripted. The tools, models and stores are the shell's own code in memory; the owners are recording stubs; the overlay runs in a
// minimal DOM of this file's own with the orbits stubbed and bodyDisc spied by a module shim (as w3q-sys-wiring.test.mjs). Not covered here:
// anything seen on screen (UNVERIFIED: the lead's pass).
import test, {beforeEach} from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'
import {readFileSync} from 'node:fs'

const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
const bodyUrl = new URL('../src/projections/atlas/src/globe/body.ts', import.meta.url).href
const bodyShim = `data:text/javascript,${encodeURIComponent(`
import * as real from ${JSON.stringify(`${bodyUrl}#real`)};
export * from ${JSON.stringify(`${bodyUrl}#real`)};
export const bodyDisc = (...args) => { (globalThis.__bodyDiscCalls ??= []).push(args); return real.bodyDisc(...args) };
`)}`
const orbitsShim = `data:text/javascript,${encodeURIComponent(`
export class PlanetOrbits {
  constructor(parent, onEarth, options) { this.parent = parent; this.options = options; this.root = {style: {setProperty() {}}}; this.key = null; this.satellites = []; (globalThis.__orbits ??= []).push(this) }
  set(key, satellites) { this.key = key; this.satellites = satellites }
  update() {}
  destroy() { this.destroyed = true }
}
export const isWorldOrbitKey = key => typeof key === 'string' && key.startsWith('world:')
`)}`
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};
import {readFile} from 'node:fs/promises';
const BODY_SHIM = ${JSON.stringify(bodyShim)}, ORBITS_SHIM = ${JSON.stringify(orbitsShim)};
export async function resolve(s, c, n) {
  if (s.endsWith('/globe/body') || s.endsWith('/globe/body.ts')) return {url: BODY_SHIM, shortCircuit: true}
  if (s.endsWith('/sky/orbits') || s.endsWith('/sky/orbits.ts')) return {url: ORBITS_SHIM, shortCircuit: true}
  if (s === 'react' || s.startsWith('react/') || s === 'react-dom' || s.startsWith('react-dom/')) return n(s, {...c, parentURL: ${JSON.stringify(import.meta.url)}})
  let r = null
  try { r = await n(s, c) } catch (e) { if (!s.startsWith('.')) throw e }
  if (r) {
    if (r.url.endsWith('.html') || r.url.endsWith('.css')) return {...r, format: 'module'}
    return r
  }
  if (s.endsWith('.js')) { try { return await n(s.slice(0, -3) + '.ts', c) } catch {} }
  for (const x of ['.ts', '.tsx']) { try { return await n(s + x, c) } catch {} }
  for (const x of ['/index.ts', '/index.tsx']) { try { return await n(s + x, c) } catch {} }
  throw new Error('cannot resolve ' + s)
}
export async function load(u0, c, n) {
  const u = u0.replace(/#real$/, '')
  if (u.endsWith('.css')) return {format: 'module', shortCircuit: true, source: 'export {}'};
  if (u.includes('?raw') || u.includes('.html')) return {format: 'module', shortCircuit: true, source: 'export default ""'};
  if (u.endsWith('.json')) return {format: 'module', shortCircuit: true, source: 'export default ' + await readFile(new URL(u), 'utf8')};
  if (!u.endsWith('.ts') && !u.endsWith('.tsx')) return n(u0, c);
  const out = ts.transpileModule(await readFile(new URL(u), 'utf8'), {fileName: new URL(u).pathname,
    compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX}}).outputText;
  return {format: 'module', shortCircuit: true, source: out.split('import.meta.env').join('({BASE_URL: "/"})')};
}`)}`, import.meta.url)

class FakeEl {
  constructor(tag) { this.tagName = tag; this.children = []; this.attrs = {}; this.style = {setProperty: (key, value) => { this.style[key] = value }}; this.dataset = {}; this.className = ''; this.textContent = ''; this.hidden = false; this.parentElement = null; this.title = ''; this.listeners = {}; this.painted = [] }
  setAttribute(key, value) { this.attrs[key] = String(value); if (key === 'class') this.className = String(value); if (key === 'width' || key === 'height') this[key] = Number(value) }
  getAttribute(key) { return key in this.attrs ? this.attrs[key] : null }
  removeAttribute(key) { delete this.attrs[key] }
  append(...nodes) { for (const node of nodes) { if (typeof node === 'string') { this.textContent += node; continue } node.parentElement = this; this.children.push(node) } }
  appendChild(node) { this.append(node); return node }
  remove() { if (this.parentElement) this.parentElement.children = this.parentElement.children.filter(child => child !== this); this.parentElement = null }
  removeChild(node) { node.remove(); return node }
  replaceChildren(...nodes) { this.children = []; this.append(...nodes) }
  get firstChild() { return this.children[0] ?? null }
  addEventListener(type, fn) { (this.listeners[type] ??= []).push(fn) }
  removeEventListener() {}
  querySelector() { return null }
  closest() { return null }
  getBoundingClientRect() { return {left: 0, top: 0, width: 800, height: 600} }
  getContext() { return {clearRect: () => {}, putImageData: image => { this.painted.push(image) }} }
  all() { return this.children.flatMap(child => [child, ...child.all()]) }
  words() { return [this.textContent, ...this.children.map(child => child.words())].filter(Boolean).join(' ') }
}
globalThis.document = {createElement: tag => new FakeEl(tag), createElementNS: (_ns, tag) => new FakeEl(tag), querySelector: () => null, body: new FakeEl('body')}
globalThis.ImageData = class { constructor(data, width, height) { this.data = data; this.width = width; this.height = height } }
globalThis.__CRADLE_WALK__ = false

const body = await import('../src/projections/atlas/src/globe/body.ts')
const tool = await import('../src/projections/atlas/places/placeTool.ts')
const host = await import('../src/projections/atlas/places/placesHost.ts')
const placesModel = await import('../src/projections/atlas/places/placesModel.ts')
const model = await import('../src/projections/atlas/system/systemModel.ts')
const systemStore = await import('../src/projections/atlas/system/systemStore.ts')
const locations = await import('../src/projections/atlas/system/bodyLocations.ts')
const overlay = await import('../src/projections/atlas/system/systemOverlay.ts')
const worldBody = await import('../src/projections/atlas/body/worldBody.ts')
const standing = await import('../src/projections/atlas/provider/suiteStanding.ts')
const {applyPlaceDraft} = await import('../../../../desktop/cradle/src/knowledge/WikiFactsEditor.tsx')
const {createDisclosureSessionStore} = await import('../../../../desktop/cradle/src/techne/session.ts')
const {groundSelection} = await import('../../../../desktop/cradle/src/techne/m0m5/reading.ts')
const {provingReading} = await import('../../../../desktop/cradle/src/techne/m0m5/journey/proving-reading.ts')
const entered = await import('../src/projections/atlas/system/enteredWorld.ts')
const drawMod = await import('../src/projections/atlas/system/bodyDraw.ts')

// ── fixtures ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

const YOURS = {ref: 'central:wiki:root', name: 'Your world', kind: 'yours', folder: 'Control/user/flows', project: null}
const OI = {ref: 'central:wiki:project:O-I', name: 'O-I', kind: 'project', folder: 'Work/O-I/ProjectCentral/user', project: 'O-I'}
const BOOK = {ref: 'central:wiki:project:Book', name: 'Book', kind: 'project', folder: 'Work/Book/ProjectCentral/user', project: 'Book'}
const RECORD = Object.freeze({
  body_ref: 'body:central:wiki:root', seed: 20261018, generator: {id: 'fbm-sphere', version: 1},
  landmass: {sea_level: .5, continents: 1.7, relief: .55, coast: 'smooth'}, climate: {warmth: .58, moisture: .6, ice_caps: .3},
  sky: {atmosphere: .6, clouds: .35, axial_tilt_deg: 18},
})
const readingOf = (ref, record, revision = 4) => ({schema: 'oi.world-body-reading/v1', register: null, space: {ref, revision, title: null}, disclosed_revision: revision,
  body: record, wiki_source: {path: 'w.json', ref: 'central:source:wiki', revision: 'r'}, owner_operation: 'aikit wiki-construct facts-inspect'})
const read = (ref, record, revision) => ({state: 'read', reading: readingOf(ref, record, revision), record})
const NOW = Date.UTC(2026, 9, 20, 12)
const systemOf = (extra = {}) => model.systemOf({worlds: [YOURS, OI, BOOK], bodies: new Map([[YOURS.ref, read(YOURS.ref, RECORD, 67)], [OI.ref, read(OI.ref, null, 9)]]),
  playing: [], sessions: [], hand: {file: null, works: []}, artifacts: [], nowMs: NOW, ...extra})
const settle = () => new Promise(resolve => setTimeout(resolve, 0))
const place = (ref, extra = {}) => ({ref, name: ref.split(':').pop(), kind: 'declared', owner: 'wiki', source: 'wiki facts', located: true, precision: 'exact', lat: 37.9, lon: 23.7, reason: null, ...extra})
/** A place a subject declares on YOUR body: never on the Earth (suiteReading.ts locateOnBody), its point on its own body. */
const onYourBody = (ref, lat, lon, extra = {}) => place(ref, {located: false, precision: 'approximate', reason: 'the owner places it on another body', lat: undefined, lon: undefined, body_ref: RECORD.body_ref, on_body: {lat, lon}, ...extra})
const setBodies = bodies => systemStore.publishSystem({state: 'read', bodies, set: null})
const stateOf = (record = RECORD) => ({state: 'read', reading: readingOf(YOURS.ref, record, 67), record})

let owner, calls, cleanup = []
const later = fn => { cleanup.push(fn) }
beforeEach(() => {
  calls = []
  owner = {offer: (ref, draft) => calls.push(['offer', ref, draft]), open: subject => calls.push(['open', subject.ref]), reread: ref => calls.push(['reread', ref])}
  tool.resetPlaceTool()
  systemStore.bindSystemActs(null)
  standing.resetSuiteStanding()
  worldBody.chooseBody('earth')
  globalThis.__bodyDiscCalls = []; globalThis.__orbits = []
  for (const fn of cleanup.splice(0).reverse()) fn()
})
const SUBJECT = {ref: 'wiki:node:the-study', title: 'The study'}
const ON_YOURS = {body_ref: RECORD.body_ref, seed: RECORD.seed}

// ── 1 · Click the body to place a place, a palace, a portal or a route ─────────────────────────────────────────────────────────

// MET (placeTool.ts:142-148 armPlaceTool, :197-212 placeAt): armed for a subject, a click on your body is a draft offered to the owner's
// editor, never a write; a place and a palace are placed by it (a palace "stands where its rooms' subjects are placed", :115-119).
test('1a · a click on your body places a place or a palace: a draft on your body offered to the owner\'s editor, never written', () => {
  for (const kind of ['place', 'palace']) {
    calls = []
    tool.resetPlaceTool()
    tool.bindPlaceOwner(owner)
    tool.choosePlaceKind(kind)
    tool.armPlaceTool(SUBJECT)
    assert.equal(tool.placeToolState().phase, 'armed', `${kind}: the tool arms`)
    tool.placeAt({lat: 22, lon: 10}, ON_YOURS)
    assert.equal(tool.placeToolState().phase, 'offered', `${kind}: the click is offered`)
    assert.deepEqual(calls.map(call => call[0]), ['offer'], `${kind}: offered to the editor, and nothing else is called (no write)`)
    assert.deepEqual([calls[0][2].lat, calls[0][2].lon, calls[0][2].body_ref], [22, 10, RECORD.body_ref], `${kind}: at the click, on your body`)
  }
})

// A portal: no owner. A portal leads through to another world, and visiting another world belongs to the owner of the shared field's
// federation (the Aperture "Federated", manual §17.2), which does not exist yet (placeTool.ts:126). So choosing Portal refuses the click, says
// why and names what it waits for. CARRIED out of T-PROCEDURAL-BODY: it needs the visiting owner.
test('1b · a portal is not placed by a click: choosing Portal refuses it, says why and names the owner it waits for', () => {
  tool.bindPlaceOwner(owner)
  tool.choosePlaceKind('portal')
  tool.armPlaceTool(SUBJECT)
  const state = tool.placeToolState()
  assert.equal(state.phase, 'idle', 'the tool does not arm')
  assert.equal(state.tone, 'refused')
  assert.match(state.notice, /portal/i, 'it names what it refuses')
  assert.match(state.notice, /another world/i, 'and what a portal is')
  assert.match(state.notice, /visit/i, 'and the owner it waits for: the owner of visiting another world…')
  assert.match(state.notice, /federation|shared field/i, '…the shared field\'s federation')
  assert.match(state.notice, /WORLD-INHABITATION-V1/, '…named by the contract that carries it, which is contracted and not built')
  tool.placeAt({lat: 22, lon: 10}, ON_YOURS)
  assert.deepEqual(calls, [], 'a click offers nothing to anyone: no draft, no write')
})

// A route (O-I #746): the owner's place facet carries the relation a stop is a stop of and its place in the order (AIKit PlaceFacet.relation and
// .sequence; techne/contract.ts TechnePlaceFacet), so a click places a stop. Choosing Route arms the tool for the subject; the click's draft is a
// TRAVELLED_TO stop at the next place in the subject's route as the World reads it (placesModel.ts routeNext), offered to the owner's editor and
// never written; the editor's MapPlaceDraft writes both on the subject's PlaceSet (knowledge/WikiFactsEditor.tsx applyPlaceDraft), after the stops
// the subject's own facts hold. Replaces the refusal T-PROCEDURAL-BODY carried ("a click cannot make a stop of one").
test('1c · a route is placed stop by stop: choosing Route arms the tool, and a click offers the subject\'s next stop to its editor, which writes it in order', () => {
  const held = [onYourBody('wiki:place:a', 1, 1, {relation: 'TRAVELLED_TO', subject_ref: SUBJECT.ref, sequence: 1}),
    onYourBody('wiki:place:b', 2, 2, {relation: 'TRAVELLED_TO', subject_ref: SUBJECT.ref, sequence: 2}),
    place('wiki:place:c', {relation: 'TRAVELLED_TO', subject_ref: 'wiki:node:solon', sequence: 7})]
  assert.equal(placesModel.routeNext(held, SUBJECT.ref), 3, 'the next stop follows the subject\'s own last stop, wherever it stands')
  assert.equal(placesModel.routeNext(held, 'wiki:node:new'), 1, 'a subject with no route begins at stop 1')
  tool.bindPlaceOwner(owner)
  tool.choosePlaceKind('route')
  tool.armPlaceTool({...SUBJECT, routeNext: placesModel.routeNext(held, SUBJECT.ref)})
  assert.equal(tool.placeToolState().phase, 'armed', 'the tool arms for a route')
  tool.placeAt({lat: 22, lon: 10}, ON_YOURS)
  const state = tool.placeToolState()
  assert.equal(state.phase, 'offered', 'the click is offered')
  assert.deepEqual(calls.map(call => call[0]), ['offer'], 'to the editor, and nothing is written')
  const draft = calls[0][2]
  assert.deepEqual([draft.relation, draft.sequence, draft.lat, draft.lon, draft.body_ref], ['TRAVELLED_TO', 3, 22, 10, RECORD.body_ref], 'a stop of the subject\'s route, at the click, on your body')
  assert.match(state.notice, /stop 3 of The study\u2019s route/, 'the plate says which stop it is')
  assert.match(tool.draftLine(draft), /stop 3/)
  const facts = {temporal: [], places: [{place_ref: 'wiki:place:a', precision: 'approximate', relation: 'TRAVELLED_TO', sequence: 1}, {place_ref: 'wiki:place:b', precision: 'approximate', relation: 'TRAVELLED_TO', sequence: 2}]}
  const seeded = applyPlaceDraft(facts, draft).values.places[2]
  assert.deepEqual([seeded.relation, seeded.sequence, seeded.body_ref], ['TRAVELLED_TO', 3, RECORD.body_ref], 'the editor writes the stop in its route, on your body')
  // a place is still no stop: the draft of the Place kind carries neither
  calls = []
  tool.resetPlaceTool()
  tool.bindPlaceOwner(owner)
  tool.armPlaceTool(SUBJECT)
  tool.placeAt({lat: 22, lon: 10}, ON_YOURS)
  assert.ok(!('relation' in calls[0][2]) && !('sequence' in calls[0][2]), `a place is no stop: ${Object.keys(calls[0][2])}`)
})

// ── 2 · The World suggests a name from the seed. Keep it or type your own. ──────────────────────────────────────────────────────

// MET (placeTool.ts:170 draftAt → globe/body.ts suggestName; WikiFactsEditor.tsx:67 applyPlaceDraft writes the draft's name).
test('2 · a click on your body is offered the name its seed gives that spot, the same each time; the person keeps it or types their own', () => {
  tool.bindPlaceOwner(owner)
  tool.armPlaceTool(SUBJECT)
  tool.placeAt({lat: 22, lon: 10}, ON_YOURS)
  const offered = calls[0][2]
  assert.equal(offered.name, body.suggestName(RECORD, 22, 10), 'the suggested name is the seed\'s and the spot\'s')
  assert.match(offered.name, /^[A-Z][a-z]+$/)
  assert.equal(body.suggestName(RECORD, 22, 10), body.suggestName({seed: RECORD.seed}, 22.04, 10.01), 'the same spot, the same name')
  assert.notEqual(body.suggestName(RECORD, 22, 10), body.suggestName({seed: 7}, 22, 10), 'another seed, another name')
  assert.equal(applyPlaceDraft({temporal: [], places: []}, offered).values.places[0].identity.names[0].name, offered.name, 'kept')
  assert.equal(applyPlaceDraft({temporal: [], places: []}, {...offered, name: 'My own'}).values.places[0].identity.names[0].name, 'My own', 'or typed over')
})

// ── 3 · Reroll: every location keeps its name and the position you gave it ────────────────────────────────────────────────────

// MET (worldBody.ts:155-176 changedBody: a reroll is a new seed and nothing else; bodyLocations.ts rows are the owners' places, which no
// reroll touches; systemOverlay.ts:42-47 drawnLocations keeps the location object, and with it its coordinate).
test('3 · a reroll changes the land and never what stands on it: the locations\' names and positions are the same rows after it', () => {
  const places = [onYourBody('wiki:place:study', 22, 10), onYourBody('wiki:place:gate', -35, 120, {precision: 'exact'})]
  const rerolled = worldBody.changedBody(RECORD, 67, {reroll: true})
  assert.notEqual(rerolled.seed, RECORD.seed, 'the land is new')
  for (const key of ['landmass', 'climate', 'sky']) assert.deepEqual(rerolled[key], RECORD[key], `${key}: the settings stay`)
  const before = locations.yourLocations(stateOf(RECORD), places, true, null)
  const after = locations.yourLocations(stateOf(rerolled), places, true, null)
  assert.deepEqual(after, before, 'the same rows, with the same names and the same positions, on the new land')
  assert.deepEqual(after.rows.map(row => [row.name, row.lat, row.lon]), [['study', 22, 10], ['gate', -35, 120]])
  const drawn = overlay.drawnLocations(rerolled, after.rows)
  assert.deepEqual(drawn.map(item => [item.location.name, item.location.lat, item.location.lon]), [['study', 22, 10], ['gate', -35, 120]], 'drawing never changes a coordinate')
})

// ── 4 · Where that spot is now sea, the World draws the location on the nearest shore and says so ────────────────────────────

/** A spot that is land on the body as it was and sea on the body rerolled from it, with a shore within reach: found, never assumed. */
function spotLostToTheSea() {
  const rerolled = worldBody.changedBody(RECORD, 67, {reroll: true})
  for (let lat = -60; lat <= 60; lat += 5) for (let lon = -175; lon <= 175; lon += 5) {
    const was = body.shoreOf(RECORD, lat, lon), now = body.shoreOf(rerolled, lat, lon)
    if (!was.shore && now.shore && now.found) return {rerolled, lat, lon, shore: now}
  }
  throw Error('no spot of the body was land and is now sea: the fixture needs another reroll')
}

// MET (systemOverlay.ts:42-47 drawnLocations: the spot's shore, the location untouched; :158-160 the mark: ` · shore` in its words and
// "drawn on the nearest shore" in its label; globe/body.ts:120 shoreOf).
test('4a · where a location\'s spot is now sea it is drawn at the nearest shore, its own coordinate untouched', () => {
  const {rerolled, lat, lon, shore} = spotLostToTheSea()
  const [drawn] = overlay.drawnLocations(rerolled, [{id: 'p', name: 'The study', lat, lon, kind: 'place'}])
  assert.equal(drawn.shore, true)
  assert.deepEqual([drawn.lat, drawn.lon], [shore.lat, shore.lon], 'drawn at the nearest shore')
  assert.equal(body.shoreOf(rerolled, drawn.lat, drawn.lon).shore, false, 'and the shore is land')
  assert.deepEqual([drawn.location.lat, drawn.location.lon], [lat, lon], 'the location keeps the position it was given: nothing moves until you move it')
  const dry = overlay.drawnLocations(RECORD, [{id: 'p', name: 'The study', lat, lon, kind: 'place'}])[0]
  assert.deepEqual([dry.shore, dry.lat, dry.lon], [false, lat, lon], 'on the body it was placed on, at its own point')
})

function overlayHarness({record, sky = false, press, follow, project} = {}) {
  const parent = new FakeEl('div')
  const frames = []
  const handle = {
    engine: {renderer: {domElement: {parentElement: parent}}, onFrame: fn => frames.push(fn), body: record, sky: null, reduced: true,
      project: project ?? ((_dir, screen) => { screen.x = 100; screen.y = 100; screen.facing = 1 }), globeDisc(disc) { disc.x = 400; disc.y = 300; disc.r = 120 }},
    ctl: {state: {sky, graph: false}},
  }
  const binding = overlay.bindSystemOverlay({handle, said() {}, ...(press ? {press} : {}), ...(follow ? {follow} : {})})
  later(binding.dispose)
  return {handle, parent, frames, frame: () => frames.forEach(fn => fn(0.016))}
}
/** Your body read and drawn, with the places the owners declare on it, and the overlay standing over it. */
async function bodyWithPlaces(record, places, options = {}) {
  const binding = worldBody.bindWorldBody({engine: {}, owner: {async read() { return readingOf(YOURS.ref, record, 67) }, async write() {}}})
  later(binding.dispose)
  await settle()
  standing.publishSuiteStanding({...standing.IDLE_STANDING, phase: 'ready', places})
  const harness = overlayHarness({record, ...options})
  return harness
}
/** The press of each location's mark: a button; the mark's wrapper (its position, its anchor line beside it) is its parent. */
const marks = parent => parent.all().filter(node => node.tagName === 'button' && /^sys-place( |$)/.test(node.className))

test('4b · the mark of a location drawn on a shore says so, in its words and its label', async () => {
  const {rerolled, lat, lon} = spotLostToTheSea()
  const {parent} = await bodyWithPlaces(rerolled, [onYourBody('wiki:place:study', lat, lon, {name: 'The study'})])
  const [mark] = marks(parent)
  assert.ok(mark, 'the location has its mark')
  assert.match(mark.className, /\bis-shore\b/)
  assert.match(mark.words(), /The study · shore/, 'its name, and that it is drawn on the shore')
  assert.match(mark.getAttribute('aria-label'), /drawn on the nearest shore/, 'and its label says why')
  const dry = marks((await bodyWithPlaces(RECORD, [onYourBody('wiki:place:study', lat, lon, {name: 'The study'})])).parent)
  assert.ok(dry.length >= 1 && !/is-shore|· shore/.test(dry.at(-1).className + dry.at(-1).words()), 'where the spot is land it says nothing of a shore')
})

// ── 5 · An exact place gets a street, an approximate place a city, a region the whole region ───────────────────────────────────

// MET (O-I #742: placesHost.ts framingDistance, a street as near as the camera flies, a city 1.15, the whole region 1.4). The manual has
// three: a street, a city, the whole region.
test('5 · the flight to a place ends nearer for a more exact one: exact (a street) < approximate (a city) < region (the whole region)', () => {
  const exact = host.framingDistance('exact'), approximate = host.framingDistance('approximate'), region = host.framingDistance('region')
  assert.ok(exact < approximate && approximate < region, `three precisions, three framings, nearest for the most exact (got ${exact}, ${approximate}, ${region})`)
  assert.ok(Math.max(exact, approximate, region) <= placesModel.REGION_DISTANCE, 'a flight to a place never ends further than the Region scale')
})

// ── 6 · The flight ends at a scale that fits the precision of the place ────────────────────────────────────────────────────────

// MET for what exists (placesModel.ts:179-189 atlasScaleOf: at or inside 2.3 radii, holding a place, is the Place scale; at or inside
// 2.6 a Region).
test('6 · an exact place is flown to and held at the Place scale; a region and an approximate place end in the Region scale', () => {
  const at = precision => placesModel.atlasScaleOf({sky: false, graph: false, dist: host.framingDistance(precision), placeHeld: true})
  assert.equal(at('exact'), 'place', 'an exact place ends at the Place scale')
  for (const precision of ['approximate', 'region']) assert.notEqual(at(precision), 'system', `${precision}: a scale of the ground`)
  assert.equal(placesModel.atlasScaleOf({sky: false, graph: false, dist: host.framingDistance('region')}), 'region', 'a region, with no place held, is the Region scale')
})

// ── 7 · A place with no position does not fly. The World lists it in a separate register. ───────────────────────────────────────

// MET (placesHost.ts:72-75 turnToPlace → null without a position; placesModel.ts:77-92 placeRows lists it after the located, with its reason).
test('7 · a place with no position does not fly, and is listed after the located ones with the reason it has none', () => {
  const nowhere = place('wiki:place:lost', {located: false, precision: 'unlocated', lat: undefined, lon: undefined, reason: 'no coordinate disclosed'})
  assert.equal(host.turnToPlace(nowhere, []), null, 'no position, no flight')
  assert.equal(host.turnToPlace(undefined, []), null, 'a place the world does not hold turns nothing')
  const rows = placesModel.placeRows([nowhere, place('wiki:place:athens', {name: 'Athens'}), place('wiki:place:giza', {name: 'Giza', lat: 30, lon: 31})])
  assert.deepEqual(rows.map(row => row.located), [true, true, false], 'the register of the unlocated stands after the located')
  assert.equal(rows.at(-1).reason, 'no coordinate disclosed', 'and says why')
  const flies = host.turnToPlace(place('wiki:place:athens'), [])
  assert.equal(flies?.kind, 'fly')
})

// ── 8 · Fly to a place from anywhere ────────────────────────────────────────────────────────────────────────────────────────────

// `skyCam` is the controller's sky camera: `busy` is "true from the first frame of a request to its last callback" (sky/camera.ts), the one thing
// that owns the rig while the atlas lands on the Earth. `descent` is how many polls the fake descent lasts; leaving the sky starts it.
const atlasHandle = ({sky = false, graph = false, descent = 0} = {}) => {
  const log = []
  const skyCam = {busy: false, left: 0}
  const ctl = new Proxy({state: {sky, graph, view: {kind: 'field'}}, skyCam, navigate: arg => { log.push(['navigate', arg]); if (sky && descent) { skyCam.busy = true; skyCam.left = descent } }},
    {get: (target, key) => key in target ? target[key] : (...args) => { log.push([String(key), ...args]) }})
  return {log, model: {occ: [], occIndex: new Map()}, ctl, engine: {rig: {flyTo: (...args) => log.push(['flyTo', ...args])}}}
}

// From the ground view the atlas flies at once. From the sky or the Graph it returns to the Earth first (the controller's own way: navigate to
// the plain world view, controller.ts descendFromSky; toggleMode out of the Graph). Leaving the Graph does not take the camera, so the flight goes
// in the same breath (measured in the real atlas: the globe wakes and a flight issued with the switch moves from the first frame, and the 2.5 s
// this once waited was only delay). Leaving the sky starts the sky camera's descent, which owns the camera while it runs (controller.ts:2165;
// 3.2 s drop and 1.9 s landing, sky/camera.ts T), and the flight follows the camera's own `busy` signal: not a guessed time.
test('8a · a place is flown to from the ground, the sky lens and the Graph alike: the Graph and the ground fly at once, the sky once its descent has landed', () => {
  const spot = place('wiki:place:athens', {lat: 37.9, lon: 23.7})
  const timers = []
  const later = (run, ms) => { timers.push({run, ms}); return () => {} }
  const flights = handle => handle.log.filter(entry => entry[0] === 'flyTo')
  const flown = [['flyTo', 37.9, 23.7, host.framingDistance('exact')]]
  const ground = atlasHandle()
  assert.equal(host.turnAtlasTo(ground, spot, later), true)
  assert.deepEqual(flights(ground), flown, 'from the ground it flies at once')
  assert.deepEqual(timers, [], 'with nothing to wait for')
  const graph = atlasHandle({graph: true})
  assert.equal(host.turnAtlasTo(graph, spot, later), true, 'from the Graph')
  assert.ok(graph.log.some(entry => entry[0] === 'toggleMode'), 'the atlas returns to the Earth by the controller\'s own switch')
  assert.deepEqual(flights(graph), flown, 'the switch does not take the camera: the flight goes with it')
  assert.deepEqual(timers, [], 'and waits for nothing')
  const sky = atlasHandle({sky: true, descent: 3})
  assert.equal(host.turnAtlasTo(sky, spot, later), true, 'from the sky: "fly to a place from anywhere" - it said it could not')
  assert.deepEqual(sky.log.filter(entry => entry[0] === 'navigate').map(entry => entry[1]), [{view: {kind: 'world'}, deep: false}], 'the atlas returns to the Earth, the controller\'s plain world view')
  assert.deepEqual(flights(sky), [], 'the descent owns the camera while it runs: no flight yet')
  assert.equal(timers.length, 1, 'the flight asks again, under the atlas lifetime')
  for (let poll = 0; poll < 3; poll++) {
    assert.deepEqual(flights(sky), [], 'still descending: it keeps waiting, whatever the clock says')
    if (--sky.ctl.skyCam.left === 0) sky.ctl.skyCam.busy = false
    timers.shift().run()
  }
  assert.deepEqual(flights(sky), flown, 'the descent reports done, and then it flies to the point')
  assert.deepEqual(timers, [], 'once')
})

test('8a2 · a flight waiting on a descent that never reports done goes after a bound; a newer turn replaces the one still waiting', () => {
  const spot = place('wiki:place:athens', {lat: 37.9, lon: 23.7})
  const timers = []
  const later = (run, ms) => { const timer = {run, ms, live: true}; timers.push(timer); return () => { timer.live = false } }
  const flights = handle => handle.log.filter(entry => entry[0] === 'flyTo')
  const stuck = atlasHandle({sky: true, descent: 1e9})
  assert.equal(host.turnAtlasTo(stuck, spot, later), true)
  let waited = 0
  while (timers.some(timer => timer.live) && waited < 1e6) { const timer = timers.find(entry => entry.live); timer.live = false; waited += timer.ms; timer.run() }
  assert.equal(flights(stuck).length, 1, 'a camera held forever does not hold the flight forever')
  assert.ok(waited <= host.LANDING_LIMIT_MS + host.LANDING_POLL_MS, 'it waited no longer than the limit: ' + waited)
  const first = atlasHandle({sky: true, descent: 1e9})
  const second = atlasHandle({sky: true, descent: 1e9})
  const other = place('wiki:place:delphi', {lat: 38.5, lon: 22.5})
  timers.length = 0
  host.turnAtlasTo(first, spot, later)
  host.turnAtlasTo(second, other, later)
  assert.equal(timers.filter(timer => timer.live).length, 1, 'the first turn was cancelled when the second began')
  second.ctl.skyCam.busy = false
  timers.find(timer => timer.live).run()
  assert.deepEqual(flights(first), [], 'the older turn never flies')
  assert.equal(flights(second).length, 1, 'the newer one does')
})

// NOT MET to a place on your own body: such a place is `located: false` on the Earth with its point in `on_body` (suiteReading.ts
// locateOnBody), and turnToPlace reads only the Earth's point (placesHost.ts:72-75).
test('8b · a place on your own body is flown to on your body, at the framing its precision gives; it is not on the Earth', () => {
  const study = onYourBody('wiki:place:study', 22, 10)
  assert.deepEqual(host.turnToPlace(study, [], ON_YOURS), {kind: 'fly', lat: 22, lon: 10, dist: host.framingDistance('approximate')}, 'with your body shown, its place is a position')
  assert.equal(host.turnToPlace(study, []), null, 'with the Earth shown it has no point to fly to: it stands on another body')
  assert.equal(host.turnToPlace(study, [], {body_ref: 'body:someone-else', seed: 1}), null, 'and not on a third body')
})

// ── 9 · Click a location to select it ──────────────────────────────────────────────────────────────────────────────────────────────

// NOT MET on your body. On the Earth a place is selected as the subject the Earth draws there (placesHost.ts:73-79 turnToPlace 'select'); the
// marks of your own body are role=img with no press (systemOverlay.ts:158-162). Selecting is the shared spatial focus every instrument
// follows (techne/session.ts:219 setSpatialFocus; Follow keeps other panes with the place you select).
test('9 · selecting a location of your body makes it the shared focus; with no session standing it says so and throws nothing', () => {
  assert.equal(typeof host.selectLocation, 'function', 'places/placesHost.ts exports selectLocation(session, location) — not written yet')
  const session = createDisclosureSessionStore()
  session.setSelection(groundSelection(provingReading(), 'timeline'))
  assert.equal(host.selectLocation(session, {id: 'wiki:place:study'}), null, 'selected')
  assert.equal(session.get().spatial_focus_ref, 'wiki:place:study', 'the place is the focus Follow keeps the other panes with')
  const empty = createDisclosureSessionStore()
  const refusal = host.selectLocation(empty, {id: 'wiki:place:study'})
  assert.equal(typeof refusal, 'string', 'no session: the reason, in words')
  assert.match(refusal, /session|selected|open/i)
})

// NOT MET: the marks of your body are role=img with no press (systemOverlay.ts:158-162). A press on a location's mark is the person's act: the
// overlay hands the location to what the atlas binds (selecting a declared place, entering a landed world).
test('9b · pressing a location\'s mark on your body hands that location to the press, a landed world\'s mark too', async () => {
  const landed = {...RECORD, body_ref: 'body:central:wiki:project:O-I', seed: 11, landing: {on_ref: RECORD.body_ref, lat: -20, lon: 100}}
  setBodies(systemOf({bodies: new Map([[YOURS.ref, read(YOURS.ref, RECORD, 67)], [OI.ref, read(OI.ref, landed, 9)]])}))
  const pressed = []
  const {parent} = await bodyWithPlaces(RECORD, [onYourBody('wiki:place:study', 22, 10, {name: 'The study'})], {press: location => pressed.push(location.id)})
  const [study, oi] = marks(parent)
  assert.ok(study && oi, 'the place and the landed world both have a mark')
  assert.equal(typeof study.listeners.click?.[0], 'function', 'a mark is pressed')
  study.listeners.click[0]()
  oi.listeners.click[0]()
  assert.deepEqual(pressed, ['wiki:place:study', `world:${OI.ref}`])
})

test('9c · a press selects a declared place and enters a landed world, and says the refusal of either in its words', () => {
  assert.equal(typeof locations.pressLocation, 'function', 'system/bodyLocations.ts exports pressLocation(location, ports)')
  const log = []
  const ports = {select: location => { log.push(['select', location.id]); return null }, enter: key => { log.push(['enter', key]); return null }}
  assert.equal(locations.pressLocation({id: 'wiki:place:study', name: 'The study', lat: 22, lon: 10, kind: 'place', precision: 'approximate'}, ports), null)
  assert.equal(locations.pressLocation({id: `world:${OI.ref}`, name: 'O-I', lat: 1, lon: 2, kind: 'place', written: true}, ports), null)
  assert.deepEqual(log, [['select', 'wiki:place:study'], ['enter', `world:${OI.ref}`]])
  assert.equal(locations.pressLocation({id: 'wiki:place:study', name: 'The study', lat: 22, lon: 10, kind: 'place'}, {...ports, select: () => 'No session is open.'}), 'No session is open.')
  assert.equal(locations.pressLocation({id: `world:${OI.ref}`, name: 'O-I', lat: 1, lon: 2, kind: 'place', written: false}, {...ports, enter: () => 'O-I’s body is not read.'}), 'O-I’s body is not read.')
})

// ── 10 · Enter the place and you are on that world ────────────────────────────────────────────────────────────────────────────────

const enteredLib = () => entered

// NOT MET: a landed world is a location on your planet (systemModel.ts:195 landingLocations) and a disc in the sky, and pressing either
// opens nothing. "Enter the place and you are on that world": the body the World shows becomes that world's (the Body choice "another
// world", worldBody.ts:21 BodyChoice 'other'), read-only (worldBody.ts:44 READ_ONLY). The view's own choice, held in system/enteredWorld.ts,
// and drawn by the body drawer (system/bodyDraw.ts) from the system's reading of that world.
test('10 · entering a landed world makes its body the one the World shows, read-only; a world not read or not in today\'s set is refused in words; leaving returns to yours', async () => {
  const {enterWorld, leaveWorld, enteredWorld} = enteredLib()
  assert.equal(typeof drawMod.bindBodyDraw, 'function', 'system/bodyDraw.ts exports bindBodyDraw (see w3q-sys-wiring)')
  const oiRecord = {...RECORD, body_ref: 'body:central:wiki:project:O-I', seed: 777, landing: {on_ref: RECORD.body_ref, lat: 12.5, lon: -40.25}}
  const bodies = systemOf({bodies: new Map([[YOURS.ref, read(YOURS.ref, RECORD, 67)], [OI.ref, read(OI.ref, oiRecord, 9)]])})
  const [, oi, book] = bodies
  systemStore.publishSystem({state: 'read', bodies, set: null})
  later(() => systemStore.publishSystem({state: 'unbound'}))
  later(worldBody.bindWorldBody({engine: {}, owner: {async read() { return readingOf(YOURS.ref, RECORD, 67) }, async write() {}}}).dispose)
  await settle()
  const drawn = []
  later(drawMod.bindBodyDraw({engine: {setBody: (...args) => drawn.push(args), setBodyTime() {}}, store: createDisclosureSessionStore()}).dispose)
  assert.equal(enterWorld(oi.key), null, 'entered')
  assert.equal(enteredWorld(), oi.key)
  assert.equal(worldBody.bodyChoice(), 'other', 'the Body choice is another world')
  assert.deepEqual(drawn.at(-1)?.[0], oiRecord, 'its body is the one drawn: you are on that world')
  assert.equal(worldBody.bodyWriteRefusal(), worldBody.READ_ONLY, 'and it is read-only: another world\'s body is its owner\'s')
  assert.match(enterWorld(book.key) ?? '', /not read|being read|reading/i, 'a world whose body is not read cannot be entered, and says so')
  assert.equal(enteredWorld(), oi.key, 'a refused entry changes nothing')
  assert.match(enterWorld('world:central:wiki:project:Gone') ?? '', /today|set|no longer/i, 'a world that is not in today\'s set is refused in words')
  leaveWorld()
  assert.equal(enteredWorld(), null)
  assert.equal(worldBody.bodyChoice(), 'own', 'leaving returns to your own world')
  assert.deepEqual(drawn.at(-1)?.[0], RECORD)
})

// ── 11 · A mythic place looks mythic in every view ───────────────────────────────────────────────────────────────────────────────

// MET on the Earth: the presence shader's per-instance locus (globe/presences.ts:147-148 `locus[i] = o.locusType === 'myth-episode' ? 1 : 0`,
// "a mythic locus looks mythic in every view (manual §17.2 rules)") and the plate's mythic tag (places/PlacesPlate.tsx StandingTag).
test('11a · on the Earth a mythic place is drawn with its own ring (aLocus) and tagged mythic on the plate; a factual one is not', () => {
  const presences = readFileSync(new URL('../src/projections/atlas/src/globe/presences.ts', import.meta.url), 'utf8')
  assert.match(presences, /locus\[i\]\s*=\s*o\.locusType === 'myth-episode' \? 1 : 0/, 'a myth-episode occurrence sets its aLocus')
  assert.match(presences, /setAttribute\('aLocus'/, 'and the attribute reaches the shader')
  const shaders = readFileSync(new URL('../src/projections/atlas/src/globe/shaders.ts', import.meta.url), 'utf8')
  assert.match(shaders, /aLocus/, 'the presence shader reads it')
  const rows = placesModel.placeRows([place('wiki:place:eleusis', {relation: 'MYTH_LOCATED_AT'}), place('wiki:place:athens', {relation: 'OCCURRED_AT'})])
  const standingOf = ref => rows.find(row => row.ref === ref).standing
  assert.deepEqual([standingOf('wiki:place:eleusis'), standingOf('wiki:place:athens')], ['mythic', 'factual'], 'the plate tags the mythic place by its relation and never upgrades it to a factual one')
})

// NOT MET on your own body: yourLocations drops the relation (bodyLocations.ts:31-32 rows are {id, name, lat, lon, kind}), and the mark is
// a plain dot like any other (systemOverlay.ts:158-160).
test('11b · on your body a mythic place carries its locus and its mark looks mythic; a factual place does not take that look', async () => {
  const places = [onYourBody('wiki:place:eleusis', 22, 10, {name: 'Eleusis', relation: 'MYTH_LOCATED_AT'}), onYourBody('wiki:place:athens', -20, 100, {name: 'Athens', relation: 'OCCURRED_AT'})]
  const {rows} = locations.yourLocations(stateOf(), places, true, null)
  assert.deepEqual(rows.map(row => [row.name, row.locus]), [['Eleusis', 'myth-episode'], ['Athens', 'historical-event']], 'each row carries the locus the atlas reads its relation as (provider/suiteReading.ts locusOfRelation)')
  const {parent} = await bodyWithPlaces(RECORD, places)
  const [eleusis, athens] = marks(parent)
  assert.ok(eleusis && athens, 'both places have their marks')
  assert.match(eleusis.className, /\bis-mythic\b/, 'the mythic place looks mythic on your body')
  assert.doesNotMatch(athens.className, /\bis-mythic\b/, 'a factual place does not take the mythic look')
})

// ── 12 · Locations stand on the body at their names (Body and Region scales) ──────────────────────────────────────────────────

// MET on your body (systemOverlay.ts:233-241: while the sky lens and the Graph are off and your body is drawn, the locations layer shows,
// each mark at its point with its name; the same layer serves the Body and the Region scales).
test('12 · your body\'s locations stand at their names on the ground views and are away in the sky lens', async () => {
  const places = [onYourBody('wiki:place:study', 22, 10, {name: 'The study'})]
  const ground = await bodyWithPlaces(RECORD, places)
  ground.frame()
  const layer = ground.parent.all().find(node => /\bsys-places\b/.test(node.className))
  assert.ok(layer, 'the locations have a layer of their own')
  assert.equal(layer.hidden, false, 'shown on the ground views (Body and Region)')
  const [mark] = marks(ground.parent)
  assert.match(mark.words(), /The study/, 'at its name')
  assert.match(String(mark.parentElement.style.transform), /translate\(/, 'at its point')
  const sky = await bodyWithPlaces(RECORD, places, {sky: true})
  sky.frame()
  assert.equal(sky.parent.all().find(node => /\bsys-places\b/.test(node.className)).hidden, true, 'away while the sky lens draws the System')
})

// ── 13 · Anchor lines run to real places on Earth; follow an anchor line to its place on Earth ───────────────────────────────

// NOT MET: no line, no model (PATH W3b "Open: Earth's places drawn over your body"). A location on your body is anchored to Earth where
// the subject that declares it also declares a place on the Earth (the same subject_ref, a located place with no body_ref): the one pair
// the owners' places already give. The anchor is read, never written; following it chooses the Earth and flies to its place.
test('13a · a location on your body is anchored to the real place its subject also stands at on Earth: an anchor line from the one to the other', () => {
  assert.equal(typeof locations.anchorsOf, 'function', 'system/bodyLocations.ts exports anchorsOf(places, bodyRef) — not written yet')
  const places = [
    onYourBody('wiki:place:study-here', 22, 10, {name: 'The study', subject_ref: 'wiki:node:plato'}),
    place('wiki:place:athens', {name: 'Athens', lat: 37.9, lon: 23.7, subject_ref: 'wiki:node:plato', precision: 'exact'}),
    onYourBody('wiki:place:orphan', 5, 5, {name: 'Orphan', subject_ref: 'wiki:node:nobody'}),
    place('wiki:place:elsewhere', {name: 'Elsewhere', subject_ref: 'wiki:node:other'}),
  ]
  assert.deepEqual(locations.anchorsOf(places, RECORD.body_ref), [{
    location: 'wiki:place:study-here', from: {lat: 22, lon: 10}, to: {ref: 'wiki:place:athens', name: 'Athens', lat: 37.9, lon: 23.7, precision: 'exact'},
  }], 'one line: the location\'s point on your body to Athens on Earth; a location with no real place has none, and an Earth place with no location on your body draws none')
  assert.deepEqual(locations.anchorsOf(places, 'body:someone-else'), [], 'a line is for the body it stands on')
})

test('13b · following an anchor line chooses the Earth and flies to its place, framed for that place\'s precision', () => {
  assert.equal(typeof locations.followAnchor, 'function', 'system/bodyLocations.ts exports followAnchor(anchor, ports) — not written yet')
  const done = []
  const anchor = {location: 'wiki:place:study-here', from: {lat: 22, lon: 10}, to: {ref: 'wiki:place:athens', name: 'Athens', lat: 37.9, lon: 23.7, precision: 'exact'}}
  locations.followAnchor(anchor, {chooseBody: choice => done.push(['choose', choice]), flyTo: (lat, lon, dist) => done.push(['fly', lat, lon, dist])})
  assert.deepEqual(done, [['choose', 'earth'], ['fly', 37.9, 23.7, host.framingDistance('exact')]], 'the Earth first, then the flight')
})

// The anchor line stands by its location: a short dashed stub to the Earth's place it is anchored to, named, and pressing it follows it.
// Found on screen: pressing a world's mark enters that world, the globe then draws ITS body (engine.body), and the overlay went on drawing the
// marks of YOUR body over it ("Eleusis", "The study" over another world's globe). The marks are those of the body they stand on.
test('12b · a globe drawing another world\'s body carries none of your body\'s marks; they return with your own body', async () => {
  const places = [onYourBody('wiki:place:study', 22, 10, {name: 'The study'})]
  const harness = await bodyWithPlaces(RECORD, places)
  harness.frame()
  assert.equal(marks(harness.parent).length >= 1, true, 'on your own body they stand')
  const entered = {...RECORD, body_ref: 'body:someone-else', seed: RECORD.seed + 1}
  harness.handle.engine.body = entered
  harness.frame()
  assert.deepEqual(marks(harness.parent).map(mark => mark.words()), [], 'another world\'s body: none of yours, not even a landed world\'s mark')
  harness.handle.engine.body = RECORD
  harness.frame()
  assert.match(marks(harness.parent).map(mark => mark.words()).join(' '), /The study/, 'your own body again: they are back')
})

test('13c · a location anchored to Earth shows its anchor line, named by the real place, and pressing it follows the anchor', async () => {
  const followed = []
  const places = [
    onYourBody('wiki:place:study-here', 22, 10, {name: 'The study', subject_ref: 'wiki:node:plato'}),
    place('wiki:place:athens', {name: 'Athens', lat: 37.9, lon: 23.7, subject_ref: 'wiki:node:plato'}),
    onYourBody('wiki:place:orphan', 5, 5, {name: 'Orphan', subject_ref: 'wiki:node:nobody'}),
  ]
  const {parent} = await bodyWithPlaces(RECORD, places, {follow: anchor => followed.push(anchor)})
  const [study, orphan] = marks(parent)
  const lineOf = mark => mark.parentElement.all().find(node => /\bsys-anchor\b/.test(node.className))
  assert.ok(lineOf(study), 'the anchored location has its line')
  assert.equal(lineOf(study).parentElement, study.parentElement, 'beside its mark, not inside it: a press holds no press')
  assert.deepEqual(study.all().filter(node => node.tagName === 'button'), [], 'the mark\'s own button holds no button')
  assert.equal(lineOf(study).tagName, 'button', 'and the line is a button of its own, reached by the keyboard as any button is')
  assert.match(lineOf(study).words(), /Athens/, 'named by the real place it runs to')
  assert.equal(lineOf(orphan), undefined, 'a location with no real place has none')
  lineOf(study).listeners.click[0]({stopPropagation() {}})
  assert.deepEqual(followed.map(anchor => anchor.to.ref), ['wiki:place:athens'])
})

// ── 14 · A place keeps the precision that its source states; an approximate place does not look exact ───────────────────────────

// MET on the Earth (placesModel.ts:77-92 placeRows: precision verbatim with the grammar's marker; globe/presences.ts draws solid, halo and
// outline apart). NOT MET on your body: the row is {id, name, lat, lon, kind} (bodyLocations.ts:31-32) and every mark is the same dot.
test('14a · on the Earth each place keeps the precision its owner states and the grammar\'s own marker, never upgraded', () => {
  const rows = placesModel.placeRows([place('wiki:place:a', {precision: 'exact'}), place('wiki:place:b', {precision: 'approximate'}), place('wiki:place:c', {precision: 'region'})])
  assert.deepEqual(rows.map(row => [row.precision, row.marker]), [['exact', 'solid'], ['approximate', 'halo'], ['region', 'outline']])
})

test('14b · on your body a place keeps its stated precision and its mark is the grammar\'s: an approximate place is a halo, not a solid fix', async () => {
  const places = [onYourBody('wiki:place:study', 22, 10, {name: 'The study', precision: 'approximate'}), onYourBody('wiki:place:gate', -35, 120, {name: 'The gate', precision: 'exact'})]
  const {rows} = locations.yourLocations(stateOf(), places, true, null)
  assert.deepEqual(rows.map(row => row.precision), ['approximate', 'exact'], 'each row carries the precision its owner states, verbatim')
  const {parent} = await bodyWithPlaces(RECORD, places)
  const [study, gate] = marks(parent)
  assert.ok(study && gate, 'both places have marks')
  assert.equal(study.getAttribute('data-marker'), 'halo', 'approximate: a halo (the Earth\'s own grammar, placesModel.ts / project.ts:75 precisionMarker)')
  assert.equal(gate.getAttribute('data-marker'), 'solid', 'exact: solid')
})

// ── 15 · A click makes an approximate place; a drag does not make it exact ───────────────────────────────────────────────────

// MET (placeTool.ts:167-187 draftAt through vendor placeAuthoring prefillFromClick: "approximate"; :173-182 a move keeps the place's own
// precision; placesHost.ts:114-141 only a press under 500 ms and 10 px is a click, so a drag of the globe places nothing). The press
// classification needs real pointer events: UNVERIFIED headless.
test('15 · a click claims no more than approximate; a move keeps the precision its place has, never raises it, and goes to the owner as a proposal', () => {
  for (const [lat, lon] of [[22, 10], [-35, 120], [0, 0]]) assert.equal(tool.draftAt(SUBJECT, lat, lon, ON_YOURS).draft.precision, 'approximate', `a click at ${lat}, ${lon}`)
  const moved = tool.draftAt({...SUBJECT, moving: {place_ref: 'wiki:place:giza', name: 'Giza', lat: 30, lon: 31, precision: 'region', evidence: 'source:strabo'}}, 31, 32)
  assert.equal(moved.ok, true)
  assert.equal(moved.draft.precision, 'region', 'a region moved is still a region')
  assert.notEqual(moved.draft.precision, 'exact')
  tool.bindPlaceOwner(owner)
  tool.armPlaceTool({...SUBJECT, moving: {place_ref: 'wiki:place:giza', name: 'Giza', lat: 30, lon: 31, precision: 'region', evidence: 'source:strabo'}})
  tool.placeAt({lat: 31, lon: 32}, null)
  assert.deepEqual(calls.map(call => call[0]), ['offer'], 'the change is offered to the owner\'s editor as a proposal; the atlas writes nothing')
})

// ── 16 · Only the places that were valid in that window show on the body ─────────────────────────────────────────────────────

// NOT MET on your body (bodyLocations.ts:25 yourLocations takes no window; the plate's WindowLine and the Earth's presences follow it). A
// place is valid in a window where its validity (valid_from … valid_to, either edge open) overlaps it; one that declares none is always valid.
test('16 · your body shows only the places valid in the window of the occasion; a place with no validity is always valid; no window shows all', () => {
  const places = [
    onYourBody('wiki:place:old', 1, 1, {name: 'Old', valid_from: '1800-01-01T00:00:00Z', valid_to: '1850-01-01T00:00:00Z'}),
    onYourBody('wiki:place:then', 2, 2, {name: 'Then', valid_from: '1900-01-01T00:00:00Z', valid_to: '1950-01-01T00:00:00Z'}),
    onYourBody('wiki:place:since', 3, 3, {name: 'Since', valid_from: '1930-01-01T00:00:00Z'}),
    onYourBody('wiki:place:always', 4, 4, {name: 'Always'}),
  ]
  const names = window => locations.yourLocations(stateOf(), places, true, null, window).rows.map(row => row.name)
  assert.deepEqual(names(null), ['Old', 'Then', 'Since', 'Always'], 'no window: all time, every place')
  assert.deepEqual(names({from: '1920-01-01T00:00:00Z', to: '1925-01-01T00:00:00Z'}), ['Then', 'Always'], 'a window in 1920–25: what was valid then')
  assert.deepEqual(names({from: '1940-01-01T00:00:00Z', to: '1945-01-01T00:00:00Z'}), ['Then', 'Since', 'Always'], 'an open-ended validity runs on')
  assert.deepEqual(names({from: '1810-01-01T00:00:00Z', to: null}), ['Old', 'Then', 'Since', 'Always'], 'an open window reaches everything after its start')
  assert.deepEqual(names({from: null, to: '1820-01-01T00:00:00Z'}), ['Old', 'Always'], 'and everything before its end')
})

test('16b · the marks on your body follow the shared window: a place not valid in it loses its mark, and returns with all time', async () => {
  const store = createDisclosureSessionStore()
  store.setSelection(groundSelection(provingReading(), 'timeline'))
  later(drawMod.bindBodyDraw({engine: {}, store}).dispose)
  const places = [onYourBody('wiki:place:old', 1, 1, {name: 'Old', valid_from: '1800-01-01T00:00:00Z', valid_to: '1850-01-01T00:00:00Z'}), onYourBody('wiki:place:always', 4, 4, {name: 'Always'})]
  const {parent} = await bodyWithPlaces(RECORD, places)
  const names = () => marks(parent).map(mark => mark.words().split(' · ')[0])
  assert.deepEqual(names(), ['Old', 'Always'], 'all time: every place')
  store.setTimeWindow({from: '1920-01-01T00:00:00Z', to: '1925-01-01T00:00:00Z'})
  assert.deepEqual(names(), ['Always'], 'a window in 1920–25: only what was valid then')
  store.setTimeWindow(null)
  assert.deepEqual(names(), ['Old', 'Always'], 'Tap returns the occasion to now: all of them again')
})

// ── 17 · Every world you start lands as a place on your planet ────────────────────────────────────────────────────────────────────

// NOT MET: a world lands only when the person presses Land and clicks (SystemReadings.tsx:61 landWorld one BodySet; places/PlacesPlate.tsx
// WorldsSection), and until then `unlanded` says "land it on your planet" (systemModel.ts:179-184). The manual says it happens without
// notice. The reading that gives it is the model's own and the same shape as the body seeded from its ref (body/worldBody.ts firstBody):
// a world whose body is read but carries no landing is drawn at a point its ref gives, said not to be written; a written landing is the
// owner's and stands verbatim; a world whose body is not read claims no place (no reading, no claim).
test('17 · every world of today\'s set lands as a place on your planet: at its owner\'s landing where one is written, else at a point its ref gives, said unwritten; a world not read claims none', () => {
  const MARA = {ref: 'central:wiki:project:Mara', name: 'Mara', kind: 'project', folder: 'Work/Mara/ProjectCentral/user', project: 'Mara'}
  const landed = {...RECORD, body_ref: 'body:central:wiki:project:O-I', seed: 11, landing: {on_ref: RECORD.body_ref, lat: 12.5, lon: -40.25}}
  const ELSEWHERE = {ref: 'central:wiki:project:Elsewhere', name: 'Elsewhere', kind: 'project', folder: 'Work/Elsewhere/ProjectCentral/user', project: 'Elsewhere'}
  const away = {...RECORD, body_ref: 'body:central:wiki:project:Elsewhere', seed: 12, landing: {on_ref: 'body:mara', lat: 1, lon: 2}}
  const bodies = systemOf({worlds: [YOURS, OI, BOOK, MARA, ELSEWHERE], bodies: new Map([[YOURS.ref, read(YOURS.ref, RECORD, 67)], [OI.ref, read(OI.ref, landed, 9)], [BOOK.ref, read(BOOK.ref, null, 2)], [ELSEWHERE.ref, read(ELSEWHERE.ref, away, 3)]])})
  const rows = model.landingLocations(bodies)
  assert.deepEqual(rows.map(row => row.name), ['O-I', 'Book'], 'the worlds whose bodies are read are places on your planet; your own world is the planet, Mara\'s body is not read, and Elsewhere lands on another body')
  const [oi, book] = rows
  assert.deepEqual([oi.lat, oi.lon, oi.written], [12.5, -40.25, true], 'a written landing is the owner\'s, verbatim')
  assert.equal(book.written, false, 'a world with none is drawn where its ref puts it, and says it is not written')
  assert.ok(Number.isFinite(book.lat) && Number.isFinite(book.lon) && Math.abs(book.lat) <= 60 && Math.abs(book.lon) <= 180, 'at a real point of the planet, short of the poles')
  assert.deepEqual(model.landingLocations(bodies), rows, 'the same twice: nothing is random')
  assert.notDeepEqual([book.lat, book.lon], [oi.lat, oi.lon])
  assert.deepEqual(rows.map(row => row.kind), ['place', 'place'])
})

test('17b · a world that stands where its ref puts it says so on its mark: it is not landed until you land it', async () => {
  setBodies(systemOf({bodies: new Map([[YOURS.ref, read(YOURS.ref, RECORD, 67)], [BOOK.ref, read(BOOK.ref, null, 2)]])}))
  const {parent} = await bodyWithPlaces(RECORD, [])
  const book = marks(parent).find(mark => /Book/.test(mark.words()))
  assert.ok(book, 'the world has its mark on your planet')
  assert.match(book.words(), /Book · not landed yet/, 'and says it is not landed yet')
  assert.match(book.getAttribute('aria-label'), /until you land it/, 'its label says it stands where its ref puts it until the person lands it')
  assert.match(book.className, /\bis-unwritten\b/)
})

// ── 18 · Every walk you take wears a path between places ──────────────────────────────────────────────────────────────────────────

// MET on the Earth (placesModel.ts:159-166 routeRows: a subject's TRAVELLED_TO places the Earth can place, a walk needing two; globe/arcs.ts
// draws the walk). NOT MET on your body: routeRows counts only places located on the Earth.
test('18a · on the Earth a subject\'s walk is its TRAVELLED_TO places the Earth can place, and needs two', () => {
  const stops = [place('wiki:place:a', {relation: 'TRAVELLED_TO', subject_ref: 'wiki:node:plato'}), place('wiki:place:b', {relation: 'TRAVELLED_TO', subject_ref: 'wiki:node:plato'}), place('wiki:place:c', {relation: 'TRAVELLED_TO', subject_ref: 'wiki:node:solon'})]
  assert.deepEqual(placesModel.routeRows(stops), [{subject_ref: 'wiki:node:plato', stops: 2, walkable: true}, {subject_ref: 'wiki:node:solon', stops: 1, walkable: false}])
})

test('18b · on your body a subject\'s walk is its TRAVELLED_TO places on that body, and needs two, as on the Earth', () => {
  const stops = [
    onYourBody('wiki:place:a', 1, 1, {relation: 'TRAVELLED_TO', subject_ref: 'wiki:node:plato'}), onYourBody('wiki:place:b', 2, 2, {relation: 'TRAVELLED_TO', subject_ref: 'wiki:node:plato'}),
    onYourBody('wiki:place:c', 3, 3, {relation: 'TRAVELLED_TO', subject_ref: 'wiki:node:solon'}),
    place('wiki:place:d', {relation: 'TRAVELLED_TO', subject_ref: 'wiki:node:plato'}),
  ]
  assert.deepEqual(placesModel.routeRows(stops, RECORD.body_ref), [{subject_ref: 'wiki:node:plato', stops: 2, walkable: true}, {subject_ref: 'wiki:node:solon', stops: 1, walkable: false}],
    'the walk on your body: its stops there, not the Earth\'s')
  assert.deepEqual(placesModel.routeRows(stops), [{subject_ref: 'wiki:node:plato', stops: 1, walkable: false}], 'with no body named, the Earth\'s walks as before')
})

// MET since O-I #746 (bodyLocations.ts routesOn; systemOverlay.ts the route layer): a subject's route on the body the globe draws runs through its
// stops in their order (techne/m0m5/place/world.ts routeModel: the place each stop holds in the order), drawn as one line; on the Earth, through
// its stops on the Earth. The suite reading carries each stop's place in the order from its facet (provider/suiteReading.ts facetFieldsOf).
test('18c · a route draws through its stops in their order, on your body and on the Earth', async () => {
  const {facetFieldsOf} = await import('../src/projections/atlas/provider/suiteReading.ts')
  assert.equal(facetFieldsOf({place_ref: 'p', precision: 'approximate', relation: 'TRAVELLED_TO', sequence: 2}).sequence, 2, 'the reading carries a stop\'s place in the order')
  const plato = 'wiki:node:plato'
  const stops = [
    onYourBody('wiki:place:c', 30, 30, {relation: 'TRAVELLED_TO', subject_ref: plato, sequence: 3}),
    onYourBody('wiki:place:a', 10, -20, {relation: 'TRAVELLED_TO', subject_ref: plato, sequence: 1}),
    onYourBody('wiki:place:b', -15, 5, {relation: 'TRAVELLED_TO', subject_ref: plato, sequence: 2}),
    onYourBody('wiki:place:x', 5, 5, {relation: 'TRAVELLED_TO', subject_ref: 'wiki:node:solon', sequence: 1}),
    place('wiki:place:e1', {relation: 'TRAVELLED_TO', subject_ref: plato, sequence: 5, lat: 40, lon: 20}),
    place('wiki:place:e2', {relation: 'TRAVELLED_TO', subject_ref: plato, sequence: 4, lat: 38, lon: 24}),
  ]
  const order = routes => routes.map(route => [route.subject_ref, route.stops.map(entry => entry.ref)])
  assert.deepEqual(order(locations.routesOn(stops, RECORD.body_ref)), [[plato, ['wiki:place:a', 'wiki:place:b', 'wiki:place:c']]],
    'on your body: the subject\'s stops there, in their order; a subject with one stop there has no route to draw')
  assert.deepEqual(order(locations.routesOn(stops, null)), [[plato, ['wiki:place:e2', 'wiki:place:e1']]], 'on the Earth: its stops on the Earth, in their order')
  // the overlay draws each as one line through its stops' points, in that order
  const {dirFromLatLon} = await import('../src/projections/atlas/src/data/geo.ts')
  const project = (dir, screen) => { screen.x = 400 + dir[0] * 100; screen.y = 300 - dir[1] * 100; screen.facing = 1 }
  const pointOf = ([lat, lon]) => { const at = {}; project(dirFromLatLon(lat, lon), at); return `${at.x.toFixed(1)} ${at.y.toFixed(1)}` }
  // the line's points, in order, and where in them each stop's own point stands (the line runs the great circle between stops: more points)
  const through = (d, points) => { const steps = d.split(' L').map(step => step.replace(/^M/, '')); return points.map(point => steps.indexOf(pointOf(point))) }
  const lines = parent => parent.all().filter(node => node.tagName === 'path' && /\bsys-route\b/.test(node.className))
  const yours = await bodyWithPlaces(RECORD, stops, {project})
  yours.frame()
  const [drawn] = lines(yours.parent)
  assert.ok(drawn, 'your body draws the route')
  const shore = ([lat, lon]) => { const at = body.shoreOf(RECORD, lat, lon); return [at.lat, at.lon] }
  const atStops = through(drawn.getAttribute('d'), [[10, -20], [-15, 5], [30, 30]].map(shore))
  assert.ok(atStops.every(index => index >= 0) && atStops.every((index, i) => i === 0 || index > atStops[i - 1]),
    `through stop 1, stop 2 and stop 3, in that order, each where its mark is drawn: ${atStops}`)
  assert.equal(atStops[0], 0, 'it begins at stop 1')
  assert.equal(atStops[2], drawn.getAttribute('d').split(' L').length - 1, 'and ends at the last stop')
  assert.equal(lines(yours.parent).length, 1, 'one line for the one route there')
  const earth = overlayHarness({record: null, project})
  earth.frame()
  const earthLine = lines(earth.parent)[0]?.getAttribute('d') ?? ''
  assert.deepEqual(through(earthLine, [[38, 24], [40, 20]]), [0, earthLine.split(' L').length - 1], 'the Earth draws its own stops\' route, from stop 4 to stop 5')
  // a part of the line on the far side is not drawn: the line breaks there and begins again where it faces you
  const far = overlayHarness({record: null, project: (dir, screen) => { project(dir, screen); screen.facing = dir[1] > Math.sin(38.5 * Math.PI / 180) && dir[1] < Math.sin(39.5 * Math.PI / 180) ? 0 : 1 }})
  far.frame()
  const broken = lines(far.parent)[0]?.getAttribute('d') ?? ''
  assert.ok(broken.split('M').length - 1 >= 2, `the line is broken where it faces away: ${broken.slice(0, 80)}`)
  // the line lies on the body: every point it passes is on the sphere, a few degrees apart at most
  const dirs = overlay.routeDirs([{lat: 0, lon: 0}, {lat: 0, lon: 90}])
  assert.ok(dirs.length >= 30 && dirs.every(dir => Math.abs(Math.hypot(...dir) - 1) < 1e-9), 'a quarter turn is drawn in steps along the great circle')
})
