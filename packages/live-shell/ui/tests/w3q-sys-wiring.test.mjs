// T-PROCEDURAL-BODY §6 item 3 (Lane B, the system) — the wiring: the world's look reaches the globe's body and the system's discs, and the
// shared occasion reaches the body's weather. Ticket: "The system overlay's discs and the globe's body take the world's `look`
// (`bodyDisc(record, size, look)`, `engine.setBody(record, look)`); the shared occasion window drives `engine.setBodyTime` (Now is null),
// through the binding the atlas already has for the shared clock (sharedClock.ts). Choosing Earth gives `setBody(null)`." Manual §17.2:
// "Choose a past occasion and the sky, the shading of day and night on Earth, the weather on every body you built, and the places that
// were valid then all follow it"; "Earth is always as it is".
//
// What these tests hold the code to (names Lane B codes to, in its own zone):
//   system/bodyDraw.ts   bindBodyDraw({engine, store}): the one drawer of the body the globe shows — it calls engine.setBody(record, look) for
//                        your own world's body (or null for the Earth) and engine.setBodyTime(ms | null) for the occasion, and releases both;
//                        occasionMs(window): the instant of a shared window, through the time authority (the midpoint of a bounded window, its
//                        bounded edge when one is open, null for all time and for a window that does not parse)
//   systemOverlay.ts     the disc of a world is bodyDisc(record, size, body.look, occasion): the look it is given, and the shared occasion (the one the
//                        body drawer reads from the window, bodyDraw.ts shownOccasion) in steps of OCCASION_STEP_MS (null is Now); redrawn when the
//                        look or the occasion's step moves though the record does not
//   AtlasProjectionPanel.tsx   binds bindBodyDraw to the mounted engine and the shared session, and gives bindWorldBody no engine to draw
//                        with (it reads; one drawer draws)
// The engine is a recording stub (the real one needs WebGL: UNVERIFIED headless, the lead's screen pass). The overlay runs in a minimal DOM
// of this file's own, with the orbits stubbed (their rings are the atlas's own, tested there) and bodyDisc spied through a module shim, so
// what the overlay hands the generator is read exactly, not guessed from pixels.
import test from 'node:test'
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
  set(key, satellites) { this.key = key; this.satellites = satellites; this.sets = (this.sets ?? 0) + 1 }
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

// ── a minimal DOM: enough for the overlay to build and place its marks ─────────────────────────────────────────────────────────

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
  /** every node below this one, depth first */
  all() { return this.children.flatMap(child => [child, ...child.all()]) }
  /** the text of this node and everything below it */
  words() { return [this.textContent, ...this.children.map(child => child.words())].filter(Boolean).join(' ') }
}
globalThis.document = {createElement: tag => new FakeEl(tag), createElementNS: (_ns, tag) => new FakeEl(tag), querySelector: () => null, body: new FakeEl('body')}
globalThis.ImageData = class { constructor(data, width, height) { this.data = data; this.width = width; this.height = height } }
globalThis.__CRADLE_WALK__ = false

const model = await import('../src/projections/atlas/system/systemModel.ts')
const systemStore = await import('../src/projections/atlas/system/systemStore.ts')
const overlay = await import('../src/projections/atlas/system/systemOverlay.ts')
const worldBody = await import('../src/projections/atlas/body/worldBody.ts')
const {createDisclosureSessionStore} = await import('../../../../desktop/cradle/src/techne/session.ts')
const {groundSelection} = await import('../../../../desktop/cradle/src/techne/m0m5/reading.ts')
const {provingReading} = await import('../../../../desktop/cradle/src/techne/m0m5/journey/proving-reading.ts')
const {parseTimestamp, calendarFields} = await import('../../../../desktop/cradle/src/techne/m0m5/timeline/scale.ts')
const {instantOfYear, windowYear} = await import('../src/projections/atlas/sharedClock.ts')
const {lookOf, maturityOf} = await import('../src/projections/atlas/system/maturity.ts')
const drawMod = await import('../src/projections/atlas/system/bodyDraw.ts')
const lookFor = facts => lookOf(maturityOf(facts))

// ── fixtures ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

const YOURS = {ref: 'central:wiki:root', name: 'Your world', kind: 'yours', folder: 'Control/user/flows', project: null}
const OI = {ref: 'central:wiki:project:O-I', name: 'O-I', kind: 'project', folder: 'Work/O-I/ProjectCentral/user', project: 'O-I'}
const RECORD = Object.freeze({
  body_ref: 'body:central:wiki:root', seed: 20261018, generator: {id: 'fbm-sphere', version: 1},
  landmass: {sea_level: .5, continents: 1.7, relief: .55, coast: 'smooth'}, climate: {warmth: .58, moisture: .6, ice_caps: .3},
  sky: {atmosphere: .6, clouds: .35, axial_tilt_deg: 18},
})
const OI_RECORD = Object.freeze({...RECORD, body_ref: 'body:central:wiki:project:O-I', seed: 777})
const readingOf = (ref, record, revision) => ({schema: 'oi.world-body-reading/v1', register: null, space: {ref, revision, title: null}, disclosed_revision: revision,
  body: record, wiki_source: {path: 'w.json', ref: 'central:source:wiki', revision: 'r'}, owner_operation: 'aikit wiki-construct facts-inspect'})
const read = (ref, record, revision) => ({state: 'read', reading: readingOf(ref, record, revision), record})
const DAY = 86_400_000, YEAR = 365 * DAY
const NOW = Date.UTC(2026, 9, 20, 12)
const facts = (ageMs, held, shaped) => ({ageMs, held, shaped})
const LIVED = facts(YEAR, 120, 30), NEW = facts(2 * DAY, 1, 0)
const systemOf = (readings, extra = {}) => model.systemOf({worlds: [YOURS, OI], bodies: new Map([[YOURS.ref, read(YOURS.ref, RECORD, 67)], [OI.ref, read(OI.ref, OI_RECORD, 9)]]),
  playing: [], sessions: [], hand: {file: null, works: []}, artifacts: [], nowMs: NOW, ...(readings ? {facts: readings} : {}), ...extra})
const settle = () => new Promise(resolve => setTimeout(resolve, 0))
const stubEngine = () => ({calls: [], setBody(...args) { this.calls.push(['setBody', ...args]) }, setBodyTime(...args) { this.calls.push(['setBodyTime', ...args]) }})
const sharedSession = window => {
  const store = createDisclosureSessionStore()
  store.setSelection(groundSelection(provingReading(), 'timeline'))
  if (window !== undefined) store.setTimeWindow(window)
  return store
}
/** Your world's body read from a fake owner, and chosen: what the globe is to draw. */
async function chooseOwn(record = RECORD) {
  const binding = worldBody.bindWorldBody({engine: {}, owner: {async read() { return readingOf(YOURS.ref, record, 67) }, async write() {}}})
  await settle()
  worldBody.chooseBody('own')
  return binding
}
let cleanup = []
const later = fn => { cleanup.push(fn) }
test.afterEach(() => { for (const fn of cleanup.splice(0).reverse()) fn(); worldBody.chooseBody('earth'); systemStore.bindSystemActs(null); globalThis.__bodyDiscCalls = []; globalThis.__orbits = [] })
const setBodies = (bodies) => systemStore.publishSystem({state: 'read', bodies, set: null})
const lastOf = (engine, name) => engine.calls.filter(call => call[0] === name).at(-1)

// ── the globe's body takes the world's look ────────────────────────────────────────────────────────────────────────────────

test('your own world\'s body is drawn with its own look: engine.setBody(record, look), the look read from how lived in the world is', async () => {
  const {bindBodyDraw} = drawMod
  later((await chooseOwn()).dispose)
  setBodies(systemOf(new Map([[YOURS.ref, LIVED], [OI.ref, NEW]])))
  const engine = stubEngine()
  const draw = bindBodyDraw({engine, store: sharedSession()})
  later(draw.dispose)
  const call = lastOf(engine, 'setBody')
  assert.ok(call, 'the body is drawn at bind: engine.setBody was called')
  assert.deepEqual(call[1], RECORD, 'the record is the owner\'s, untouched')
  assert.deepEqual(call[2], lookFor(LIVED), 'with the look a year of work gives your own world (not exempt, not O-I\'s)')
  assert.equal(call[2].barren, 0)
  setBodies(systemOf(new Map([[YOURS.ref, NEW], [OI.ref, LIVED]])))
  assert.deepEqual(lastOf(engine, 'setBody')[2], lookFor(NEW), 'the look follows the readings: a new world is drawn as a moon (barren 1)')
  assert.equal(lastOf(engine, 'setBody')[2].barren, 1)
  assert.deepEqual(lastOf(engine, 'setBody')[1], RECORD, 'and the record has not moved: a look is read, never written into it')
})

test('choosing Earth draws no body and gives no look: engine.setBody(null); choosing your own again draws it with its look', async () => {
  const {bindBodyDraw} = drawMod
  later((await chooseOwn()).dispose)
  setBodies(systemOf(new Map([[YOURS.ref, LIVED]])))
  const engine = stubEngine()
  later(bindBodyDraw({engine, store: sharedSession()}).dispose)
  worldBody.chooseBody('earth')
  const earth = lastOf(engine, 'setBody')
  assert.equal(earth[1], null, 'the Earth is drawn by the globe itself: no body')
  assert.equal(earth[2], undefined, 'Earth is always as it is: no look is given for it')
  worldBody.chooseBody('own')
  const own = lastOf(engine, 'setBody')
  assert.deepEqual([own[1], own[2]], [RECORD, lookFor(LIVED)])
})

test('a body is redrawn only when its record or its look moved: a redraw is the generator\'s whole cost, so nothing else asks for one', async () => {
  const {bindBodyDraw} = drawMod
  later((await chooseOwn()).dispose)
  const readings = new Map([[YOURS.ref, facts(100 * DAY, 10, 3)]])
  setBodies(systemOf(readings))
  const engine = stubEngine()
  later(bindBodyDraw({engine, store: sharedSession()}).dispose)
  const drawn = () => engine.calls.filter(call => call[0] === 'setBody').length
  const first = drawn()
  assert.equal(first, 1, 'drawn once at bind')
  setBodies(systemOf(new Map(readings)))
  setBodies(systemOf(new Map(readings), {sessions: [{sessionRef: 'agent-session/kev', agentName: 'Kev', purpose: null, group: false}]}))
  worldBody.chooseBody('own')
  assert.equal(drawn(), first, 'the same record and the same look again: not drawn again (a system reading that moved for another reason, a notice with nothing new)')
  setBodies(systemOf(new Map([[YOURS.ref, facts(100 * DAY, 90, 3)]])))
  assert.equal(drawn(), first + 1, 'more held, a different look: drawn once more')
  assert.notDeepEqual(lastOf(engine, 'setBody')[2], lookFor(facts(100 * DAY, 10, 3)))
})

test('with no system reading yet the body is drawn as the generator draws by default, no moon and no planet claimed; released, it stops', async () => {
  const {bindBodyDraw} = drawMod
  later((await chooseOwn()).dispose)
  systemStore.publishSystem({state: 'unbound'})
  const engine = stubEngine()
  const draw = bindBodyDraw({engine, store: sharedSession()})
  const call = lastOf(engine, 'setBody')
  assert.ok(call && call[1] === RECORD || call?.[1]?.body_ref === RECORD.body_ref, 'the owner\'s body is drawn as soon as it reads')
  assert.deepEqual(call[2] ?? {}, {}, 'no readings of the world yet: no look is claimed')
  draw.dispose()
  const calls = engine.calls.length
  setBodies(systemOf(new Map([[YOURS.ref, NEW]])))
  worldBody.chooseBody('earth')
  assert.equal(engine.calls.length, calls, 'after dispose the engine is not touched again')
})

// ── the occasion drives the body's weather ─────────────────────────────────────────────────────────────────────────────────────

test('the occasion is the shared window\'s instant, read through the time authority: the midpoint of a bounded window, its edge when one is open, Now otherwise', () => {
  const {occasionMs} = drawMod
  const A = '2020-03-01T00:00:00Z', B = '2020-03-05T00:00:00Z'
  assert.equal(occasionMs({from: A, to: B}), (parseTimestamp(A) + parseTimestamp(B)) / 2, 'a bounded window: its midpoint (the rule the Earth\'s day and night already follow, sharedClock.ts windowYear)')
  assert.equal(occasionMs({from: A, to: null}), parseTimestamp(A), 'only a start: the start')
  assert.equal(occasionMs({from: null, to: instantOfYear(1700)}), parseTimestamp(instantOfYear(1700)), 'only an end: the end (what the clock\'s own scrub writes)')
  assert.equal(occasionMs({from: null, to: instantOfYear(-500)}), parseTimestamp(instantOfYear(-500)), 'a deep year reads through the same authority')
  for (const resting of [null, undefined, {from: null, to: null}, {from: 'sometime', to: null}, {from: 'sometime', to: 'never'}]) assert.equal(occasionMs(resting), null, `Now (null): ${JSON.stringify(resting)}`)
  for (const window of [{from: A, to: B}, {from: A, to: null}, {from: null, to: instantOfYear(1700)}]) {
    assert.equal(calendarFields(occasionMs(window)).year, Math.floor(windowYear(window)), 'the body\'s weather and the Earth\'s day and night stand at one year of one window')
  }
  const source = readFileSync(new URL('../src/projections/atlas/system/bodyDraw.ts', import.meta.url), 'utf8').split('\n').filter(line => !/^\s*(\/\/|\*|\/\*)/.test(line)).join('\n')
  assert.doesNotMatch(source, /Date\.parse|new Date\(|Date\.now|Math\.random/, 'instants are read only through the time authority, never the platform parser, and never from a clock')
})

test('the occasion a disc is drawn at is told in steps, so a played occasion does not redraw a disc on every frame: occasionStep floors it, Now stays null', () => {
  const {OCCASION_STEP_MS, occasionStep} = drawMod
  assert.equal(typeof OCCASION_STEP_MS, 'number', 'systemOverlay\'s step is a named constant, bodyDraw.ts OCCASION_STEP_MS')
  assert.ok(OCCASION_STEP_MS >= 60 * 60 * 1000 && OCCASION_STEP_MS <= 24 * 60 * 60 * 1000, 'weather is carried over days: a step between an hour and a day is below what a 52 px disc shows')
  assert.equal(occasionStep(null), null, 'Now is null')
  const at = 5 * OCCASION_STEP_MS
  assert.equal(occasionStep(at), at)
  assert.equal(occasionStep(at + OCCASION_STEP_MS - 1), at, 'the same step to its last millisecond')
  assert.equal(occasionStep(at + OCCASION_STEP_MS), at + OCCASION_STEP_MS, 'the next step')
  assert.equal(occasionStep(-1), -OCCASION_STEP_MS, 'before the epoch it floors downward, a deep year steps as any other')
  assert.equal(occasionStep(-3 * OCCASION_STEP_MS), -3 * OCCASION_STEP_MS)
})

test('engine.setBodyTime follows the shared window: null at Now, the occasion while a window stands, null again when it is cleared; the bind writes nothing', async () => {
  const {bindBodyDraw, occasionMs} = drawMod
  const store = sharedSession()
  const before = JSON.stringify(store.get())
  const engine = stubEngine()
  const draw = bindBodyDraw({engine, store})
  later(draw.dispose)
  assert.equal(JSON.stringify(store.get()), before, 'binding reads the window and writes nothing')
  assert.deepEqual(engine.calls.filter(call => call[0] === 'setBodyTime'), [['setBodyTime', null]], 'no window: Now, once')
  const past = {from: '2020-03-01T00:00:00Z', to: '2020-03-05T00:00:00Z'}
  store.setTimeWindow(past)
  assert.deepEqual(lastOf(engine, 'setBodyTime'), ['setBodyTime', occasionMs(past)], 'a past occasion: the body\'s weather is the weather of that moment')
  const times = () => engine.calls.filter(call => call[0] === 'setBodyTime').length
  const n = times()
  store.setTimeWindow({...past})
  assert.equal(times(), n, 'the same window again: not told again')
  store.setTimeWindow({from: null, to: instantOfYear(1700)})
  assert.deepEqual(lastOf(engine, 'setBodyTime'), ['setBodyTime', parseTimestamp(instantOfYear(1700))])
  store.setTimeWindow(null)
  assert.deepEqual(lastOf(engine, 'setBodyTime'), ['setBodyTime', null], 'Tap returns the occasion to Now')
  draw.dispose()
  const after = engine.calls.length
  store.setTimeWindow(past)
  assert.equal(engine.calls.length, after, 'released with the atlas: the window no longer moves the engine')
})

test('a window already standing when the atlas binds is the occasion at once, and with no shared session standing the body is at Now', () => {
  const {bindBodyDraw, occasionMs} = drawMod
  const past = {from: '1500-01-01T00:00:00Z', to: null}
  const standing = stubEngine()
  later(bindBodyDraw({engine: standing, store: sharedSession(past)}).dispose)
  assert.deepEqual(lastOf(standing, 'setBodyTime'), ['setBodyTime', occasionMs(past)])
  const none = stubEngine()
  later(bindBodyDraw({engine: none, store: createDisclosureSessionStore()}).dispose)
  assert.deepEqual(none.calls.filter(call => call[0] === 'setBodyTime'), [['setBodyTime', null]], 'no session, no window: Now')
})

// ── the system overlay's discs ──────────────────────────────────────────────────────────────────────────────────────────────────

function overlayHarness({body = null, sky = true} = {}) {
  const parent = new FakeEl('div')
  const frames = []
  const handle = {
    engine: {renderer: {domElement: {parentElement: parent}}, onFrame: fn => frames.push(fn), body, sky: null, reduced: true,
      project(_dir, screen) { screen.x = 100; screen.y = 100; screen.facing = 1 }, globeDisc(disc) { disc.x = 400; disc.y = 300; disc.r = 120 }},
    ctl: {state: {sky, graph: false}},
  }
  globalThis.__bodyDiscCalls = []; globalThis.__orbits = []
  const binding = overlay.bindSystemOverlay({handle, said() {}})
  later(binding.dispose)
  return {handle, parent, frames, binding, frame: () => frames.forEach(fn => fn(0.016))}
}
const discsOf = () => (globalThis.__bodyDiscCalls ?? []).filter(([record]) => record.body_ref === OI_RECORD.body_ref)

test('a world\'s disc beside your planet is drawn from its record and its look: bodyDisc(record, size, look, occasion), and redrawn when only the look moved', () => {
  setBodies(systemOf(new Map([[YOURS.ref, LIVED], [OI.ref, NEW]])))
  const {parent} = overlayHarness()
  const [oi] = systemStore.systemBodies().filter(body => !body.yours)
  assert.ok(oi.look && oi.look.barren === 1, 'the model gives the young world a moon\'s look (SystemBody.look)')
  const first = discsOf()
  assert.equal(first.length, 1, 'O-I\'s disc is drawn once')
  assert.deepEqual(first[0][0], OI_RECORD)
  assert.equal(first[0][1], 52, 'at its disc size')
  assert.deepEqual(first[0][2], lookFor(NEW), 'with the look its own readings give it: the overlay hands the generator the look, not the record alone')
  assert.equal(first[0][3], null, 'and no occasion: Now')
  setBodies(systemOf(new Map([[YOURS.ref, LIVED], [OI.ref, NEW]])))
  assert.equal(discsOf().length, 1, 'the same record and look: not drawn again')
  setBodies(systemOf(new Map([[YOURS.ref, LIVED], [OI.ref, LIVED]])))
  const second = discsOf()
  assert.equal(second.length, 2, 'the record did not move but the look did: the disc is drawn again')
  assert.deepEqual(second[1][2], lookFor(LIVED), 'with the new look')
  assert.equal(second[1][2].barren, 0)
  const canvas = parent.all().find(node => node.tagName === 'canvas')
  assert.ok(canvas && canvas.painted.length === 2, 'and each drawing is what the canvas shows')
})

test('a world\'s disc carries the weather of the shared occasion, drawn again only when the occasion moves to another step', () => {
  const {OCCASION_STEP_MS, occasionStep, occasionMs} = drawMod
  setBodies(systemOf(new Map([[YOURS.ref, LIVED], [OI.ref, LIVED]])))
  const store = sharedSession()
  later(drawMod.bindBodyDraw({engine: stubEngine(), store}).dispose)
  overlayHarness()
  assert.equal(discsOf().length, 1)
  assert.equal(discsOf()[0][3], null, 'no window: Now')
  const from = '2020-03-01T00:00:00Z', to = '2020-03-05T00:00:00Z'
  store.setTimeWindow({from, to})
  const past = discsOf()
  assert.equal(past.length, 2, 'a past occasion: the disc is drawn again')
  assert.equal(past[1][3], occasionStep(occasionMs({from, to})), 'at the occasion\'s step: the weather it had')
  assert.deepEqual([past[1][0], past[1][1], past[1][2]], [past[0][0], past[0][1], past[0][2]], 'the record and the look are the same')
  const step = occasionStep(occasionMs({from, to}))
  const within = new Date(step + OCCASION_STEP_MS / 2).toISOString()
  store.setTimeWindow({from: within, to: within})
  assert.equal(discsOf().length, 2, 'the window moved within the step: not drawn again')
  const next = new Date(step + OCCASION_STEP_MS + 1000).toISOString()
  store.setTimeWindow({from: next, to: next})
  assert.equal(discsOf().length, 3, 'to the next step: drawn again')
  assert.equal(discsOf()[2][3], step + OCCASION_STEP_MS)
  store.setTimeWindow(null)
  assert.equal(discsOf().length, 4, 'Tap returns the occasion to Now')
  assert.equal(discsOf()[3][3], null)
})

test('a reading that moved only the ages leaves the rings standing and ages their satellites in place; one that moved what rides them sets them again', () => {
  const artifact = (name, agoMs) => ({ref: `central:source:control:root:Control/user/flows/${name}.html`, name, path: `Control/user/flows/${name}.html`, atMs: NOW - agoMs, project: null, sessionRef: null, actor: 'agent:kev'})
  const read = (artifacts, nowMs = NOW) => setBodies(systemOf(new Map([[YOURS.ref, LIVED]]), {artifacts, nowMs}))
  read([artifact('a', 60_000)])
  overlayHarness()
  const ringsOf = () => globalThis.__orbits.find(rings => rings.key === `world:${YOURS.ref}`)
  const rings = ringsOf()
  assert.equal(rings.sets, 1)
  const [held] = rings.satellites
  const before = held.age
  read([artifact('a', 60_000)], NOW + 60_000)
  assert.equal(ringsOf().sets, 1, 'a minute on: the rings were not set again (the orbits rebuild their controls on a set)')
  assert.equal(held.age > before, true, 'but the satellite is older')
  assert.ok(Math.abs(held.age - 120_000 / (24 * 60 * 60 * 1000)) < 1e-12, 'by the instant of the reading')
  read([artifact('a', 60_000), artifact('b', 120_000)])
  assert.equal(ringsOf().sets, 2, 'an artefact more: the rings are set again')
  assert.deepEqual(ringsOf().satellites.map(s => s.name), ['a', 'b'])
})

test('what the overlay hands the rings is your system\'s satellites only: agents inner, artefacts outer, each with its kind', () => {
  const sessions = [{sessionRef: 'agent-session/kev', agentName: 'Kev', purpose: null, group: false}]
  const artifacts = [{ref: 'central:source:control:root:Control/user/flows/a.html', name: 'a', path: 'Control/user/flows/a.html', atMs: NOW - 60_000, project: null, sessionRef: 'agent-session/kev', actor: 'agent:kev'}]
  const playing = [{pageRef: 'ref:Control/user/flows/morning.html', nowRef: 'now:a', project: null, sinceMs: 1}]
  setBodies(systemOf(new Map([[YOURS.ref, LIVED]]), {sessions, artifacts, playing, hand: {file: {ref: 'ref:Control/user/flows/m.html', path: 'Control/user/flows/m.html'}, works: [{expression_ref: 'expr:essay', title: 'The essay'}]}}))
  overlayHarness()
  const yours = globalThis.__orbits.find(rings => rings.key === `world:${YOURS.ref}`)
  assert.ok(yours, 'your planet\'s rings are set')
  assert.deepEqual(yours.satellites.map(s => [s.kind, s.inner, s.id]), [['session', true, 'agent-session/kev'], ['artifact', false, artifacts[0].ref]],
    'an agent on the inner ring, what it made on the outer, and no page, no file and no work')
  assert.ok(yours.satellites.every(s => typeof s.open === 'function' && typeof s.phase === 'number'), 'each opens and keeps its keyed place')
})

// ── the attach binds one drawer ────────────────────────────────────────────────────────────────────────────────────────────────

test('the attach binds the body drawer to the mounted engine and the shared window, and gives bindWorldBody no engine to draw with', () => {
  const source = readFileSync(new URL('../src/projections/atlas/AtlasProjectionPanel.tsx', import.meta.url), 'utf8').split('\n').filter(line => !/^\s*\/\//.test(line)).join('\n')
  assert.match(source, /bindBodyDraw\(\{[^}]*engine:\s*mounted\.engine[^}]*store:\s*disclosureSession/, 'bindBodyDraw({engine: mounted.engine, store: disclosureSession}) — the body\'s look and its occasion are drawn from one place')
  assert.match(source, /body = bindWorldBody\(\{engine:\s*\{\}/, 'bindWorldBody only reads (engine: {}): a second drawer without the look would overdraw the first')
  assert.doesNotMatch(source, /bindWorldBody\(\{engine:\s*mounted\.engine/, 'it is no longer handed the globe')
  assert.match(source, /bodyDraw\?\.dispose\(\)|draw\?\.dispose\(\)/, 'the drawer is released with the atlas (the one teardown)')
})
