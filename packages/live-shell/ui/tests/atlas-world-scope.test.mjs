// The Earth mounts on the World the window is open on (O-I #1009, first repair; walk 739 T1: "Earth could not mount — No workspace is
// bound for the Earth projection"). Technē's World is a pane of the `projection.earth` kind, mounted through the module door
// (registerAtlasHost.ts mountKind), and nothing binds a workspace to it: the World is the one the host names (native/application.ts
// readShellConfig: its Central ground, `world_scope.personal_ground`), and the atlas's memories are that World's. Run here through the
// real door, the real panel and the real host reading (the development page's `/api/config`, answered by a stand-in fetch); the WebGL
// mount and the corpus provider are the stand-ins of atlas-dispose.test.mjs. No book and no encounter bridge stands anywhere here.
import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'

const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
const mountStub = new URL('./fixtures/atlas-mount-stub.mjs', import.meta.url).href
const providerStub = new URL('./fixtures/atlas-provider-stub.mjs', import.meta.url).href

register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};
import {readFile} from 'node:fs/promises';
const STUBS = {'./mount': ${JSON.stringify(mountStub)}, './provider/suiteProvider': ${JSON.stringify(providerStub)}};
export async function resolve(s, c, n) {
  if (c.parentURL && c.parentURL.endsWith('/AtlasProjectionPanel.tsx') && STUBS[s]) return {url: STUBS[s], format: 'module', shortCircuit: true};
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
export async function load(u, c, n) {
  if (u.endsWith('.css')) return {format: 'module', shortCircuit: true, source: 'export {}'};
  if (u.includes('?raw') || u.includes('.html')) return {format: 'module', shortCircuit: true, source: 'export default ""'};
  if (u.endsWith('.json')) return {format: 'module', shortCircuit: true, source: 'export default ' + await readFile(new URL(u), 'utf8')};
  if (!u.endsWith('.ts') && !u.endsWith('.tsx')) return n(u, c);
  const text = (await readFile(new URL(u), 'utf8')).replace(/import\\.meta\\.env/g, '({BASE_URL:"/"})');
  return {format: 'module', shortCircuit: true, source: ts.transpileModule(text, {fileName: new URL(u).pathname,
    compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX}}).outputText};
}`)}`, import.meta.url)

// ── a DOM stand-in (atlas-dispose.test.mjs's), the window's store, and the host's reading ──
class FakeClassList {
  set = new Set()
  add(...names) { names.forEach(n => this.set.add(n)) }
  remove(...names) { names.forEach(n => this.set.delete(n)) }
  toggle(name, force) { const on = force === undefined ? !this.set.has(name) : !!force; if (on) this.set.add(name); else this.set.delete(name); return on }
  contains(name) { return this.set.has(name) }
}
class FakeNode {
  children = []
  attrs = {}
  classList = new FakeClassList()
  dataset = {}
  className = ''
  textContent = ''
  isConnected = true
  constructor(tag) { this.tagName = tag }
  append(...nodes) { this.children.push(...nodes) }
  replaceChildren(...nodes) { this.children = [...nodes] }
  setAttribute(name, value) { this.attrs[name] = String(value) }
  remove() { this.isConnected = false }
  closest() { return null }
}
class FakeObserver { observe() {} disconnect() {} }
globalThis.window = {addEventListener() {}, removeEventListener() {}}
globalThis.document = {createElement: tag => new FakeNode(tag), body: new FakeNode('body'), documentElement: new FakeNode('html'), addEventListener() {}, removeEventListener() {}}
globalThis.MutationObserver = FakeObserver
globalThis.IntersectionObserver = FakeObserver
const area = new Map()
Object.defineProperty(globalThis, 'localStorage', {configurable: true, writable: true, value: {
  get length() { return area.size },
  key: index => [...area.keys()][index] ?? null,
  getItem: key => area.get(key) ?? null,
  setItem: (key, value) => { area.set(key, String(value)) },
  removeItem: key => { area.delete(key) },
  clear: () => area.clear(),
}})
/** What the development page's host reading answers (`/api/config`): the World this window is open on, or none. */
let hostReading = null
globalThis.fetch = async url => {
  if (url !== '/api/config') throw Error(`the World scope test reaches no ${url}`)
  return {ok: true, status: 200, json: async () => hostReading}
}
const opened = ground => ({default_set: 'test', world_scope: {owner: 'central', world: 'control:root', personal_ground: ground, workcell_ref: 'workcell:test'}})

const panel = await import(new URL('../src/projections/atlas/AtlasProjectionPanel.tsx', import.meta.url).href)
const {registerAtlasHost} = await import(new URL('../src/projections/atlas/registerAtlasHost.ts', import.meta.url).href)
const {projectionModule, absentEncounterBridge} = await import(new URL('../../../../desktop/cradle/src/surface/projectionModules.ts', import.meta.url).href)
const {atlasWalkWorld} = await import(new URL('../src/projections/atlas/walks/walksHost.ts', import.meta.url).href)
const {readShellConfig} = await import(new URL('../src/native/application.ts', import.meta.url).href)

/** The window opens on another World: the host's reading is read again (Foundation's resync does the same). */
const openWorld = async reading => { hostReading = reading; await readShellConfig(true).catch(() => null) }
const mountEarth = () => projectionModule('projection.earth').create({kind: 'projection.earth', binding: {id: 'earth-1', title: 'World'},
  element: new FakeNode('div'), encounter: absentEncounterBridge})
registerAtlasHost()

test('a fresh World: the Earth\'s pane mounts through the module door with no workspace bound, and its memories are the World\'s', async () => {
  area.clear()
  await openWorld(opened('/worlds/fresh/Central'))
  const handle = await mountEarth()
  try {
    assert.ok(panel.atlasHandle(), 'the atlas stands in the Earth pane, with no book, workspace or bridge bound')
    assert.deepEqual(panel.atlasWorld(), {ground: '/worlds/fresh/Central', owner: 'central'}, 'the Earth stands in the World the host names')
    const memory = panel.atlasMemoryStorage()
    memory.setItem('forces', '{"v":1}')
    assert.equal(area.get('oi.atlas[/worlds/fresh/Central]::forces'), '{"v":1}', 'the memory is kept under the World\'s Central ground')
    assert.equal(memory.getItem('forces'), '{"v":1}')
    assert.equal(memory.key(0), 'forces', 'the World\'s key is not shown to the atlas')
    // The walk is the World's (walks/walksHost.ts): its owner's, the World the window is open on.
    assert.equal(atlasWalkWorld(panel.atlasHandle()).key, 'central', 'the walk belongs to the World the host names')
  } finally {
    handle.unmount()
  }
  assert.equal(panel.atlasHandle(), null, 'the pane\'s unmount disposes the atlas')
})

test('another World keeps its own memories: what one World\'s Earth kept is not read in another\'s', async () => {
  area.clear()
  area.set('oi.atlas[/worlds/fresh/Central]::forces', '{"v":1}')
  await openWorld(opened('/worlds/other/Central'))
  const handle = await mountEarth()
  try {
    const memory = panel.atlasMemoryStorage()
    assert.equal(memory.getItem('forces'), null, 'the other World does not read the fresh World\'s memory')
    assert.equal(memory.length, 0)
    memory.setItem('forces', '{"v":2}')
    memory.clear()
    assert.equal(area.get('oi.atlas[/worlds/fresh/Central]::forces'), '{"v":1}', 'clear removes only the World\'s own keys')
  } finally {
    handle.unmount()
  }
})

test('a lived-in World: the memories its Earth kept under the book\'s workspace become the World\'s once, and are not moved', async () => {
  area.clear()
  const kept = 'oi.live-shell.candidate.workspace.v2.atlas.'
  area.set(`${kept}root::archetypal-earth.graph`, '{"forces":0.4}')
  area.set(`${kept}root::oi-cradle.techne-journey.presence.v1`, '{"inside":"palace:1"}')
  area.set(`${kept}w2::archetypal-earth.graph`, '{"forces":0.9}')
  area.set(`${kept}w2::aae.practice.v1.coincidences`, '[{"id":"c1"}]')
  area.set('unrelated.key', 'kept')
  await openWorld(opened('/worlds/lived/Central'))
  let handle = await mountEarth()
  const memory = panel.atlasMemoryStorage()
  try {
    assert.equal(memory.getItem('archetypal-earth.graph'), '{"forces":0.4}', 'the root workspace\'s memory is the World\'s first')
    assert.equal(memory.getItem('oi-cradle.techne-journey.presence.v1'), '{"inside":"palace:1"}')
    assert.equal(memory.getItem('aae.practice.v1.coincidences'), '[{"id":"c1"}]', 'a key only another workspace kept is carried too')
    assert.equal(area.get(`${kept}root::archetypal-earth.graph`), '{"forces":0.4}', 'what the workspace kept stays where it was')
    assert.equal(area.get(`${kept}w2::archetypal-earth.graph`), '{"forces":0.9}')
    memory.setItem('archetypal-earth.graph', '{"forces":0.5}')
  } finally {
    handle.unmount()
  }
  // Carried once: the World's memory now stands, and a later mount reads it as it was left.
  area.set(`${kept}root::archetypal-earth.graph`, '{"forces":0.1}')
  handle = await mountEarth()
  try {
    assert.equal(memory.getItem('archetypal-earth.graph'), '{"forces":0.5}', 'the World\'s memory is never overwritten by a workspace\'s')
  } finally {
    handle.unmount()
  }
  assert.equal(area.get('unrelated.key'), 'kept', 'keys outside the atlas are untouched')
})

test('a host that names no World: the Earth still mounts, and keeps nothing nowhere', async () => {
  area.clear()
  await openWorld({default_set: 'test'})
  const handle = await mountEarth()
  try {
    assert.ok(panel.atlasHandle(), 'the Earth mounts on what its owners answer')
    assert.equal(panel.atlasWorld(), null)
    const memory = panel.atlasMemoryStorage()
    assert.equal(memory.getItem('forces'), null, 'nothing is read')
    assert.throws(() => memory.setItem('forces', '{}'), /names no World/, 'a write is refused in words, so the atlas finds no storage')
    assert.equal(area.size, 0, 'nothing was written to the window\'s store')
  } finally {
    handle.unmount()
  }
})
