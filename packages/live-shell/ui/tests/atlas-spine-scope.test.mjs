// The Earth mounts in Technē (O-I #742; walk 739 T1: "Earth could not mount — No workspace is bound for the Earth projection").
// Technē's World is a pane of the `projection.earth` kind, mounted through the module door (registerAtlasHost.ts mountKind), and the
// centre panel that used to bind the atlas's workspace scope (AtlasProjectionPanel.tsx AtlasEarthPane) is never mounted in the frame
// (App.tsx: the centre is always the native Workbench). The scope is the workspace the spine stands in (projections/encounterBridge.ts
// spineWorkspace): the book the native Workbench made its bridge over before any pane's module mounts. Run here through the real door,
// the real panel and the real bridge; the WebGL mount and the corpus provider are the stand-ins of atlas-dispose.test.mjs.
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

// ── a DOM stand-in (atlas-dispose.test.mjs's) and a storage area ──
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

const panel = await import(new URL('../src/projections/atlas/AtlasProjectionPanel.tsx', import.meta.url).href)
const {registerAtlasHost} = await import(new URL('../src/projections/atlas/registerAtlasHost.ts', import.meta.url).href)
const {createSpineEncounterBridge} = await import(new URL('../src/projections/encounterBridge.ts', import.meta.url).href)
const {projectionModule, absentEncounterBridge} = await import(new URL('../../../../desktop/cradle/src/surface/projectionModules.ts', import.meta.url).href)
const {atlasWalkWorld} = await import(new URL('../src/projections/atlas/walks/walksHost.ts', import.meta.url).href)

/** The book as the continuity holds it (continuity/workspace.tsx useCandidateWorkspace): its storage namespace and the workspace standing. */
const book = {storageNamespace: {key: 'oi.test.book'}, current: {id: 'W1', context: {world: 'central'}, layout: {mode: 'techne'}}}
const spine = {current: {book, workspace: {mode: 'techne', accessEpoch: 1}}}
const mountEarth = () => projectionModule('projection.earth').create({kind: 'projection.earth', binding: {id: 'earth-1', title: 'World'},
  element: new FakeNode('div'), encounter: absentEncounterBridge})

test('the Earth\'s pane mounts through the module door with no centre pane: its memories are the workspace the spine stands in', async () => {
  registerAtlasHost()
  // The native Workbench makes its bridge over the book as it first renders (native/Workbench.tsx), before any pane's module mounts.
  const bridge = createSpineEncounterBridge(spine)
  const handle = await mountEarth()
  try {
    assert.ok(panel.atlasHandle(), 'the atlas stands in the Earth pane')
    const memory = panel.atlasMemoryStorage()
    memory.setItem('forces', '{"v":1}')
    assert.equal(area.get('oi.test.book.atlas.W1::forces'), '{"v":1}', 'the memory is kept under the book\'s namespace and the workspace standing')

    // Another workspace of the book: the memories move with it, and the first workspace's stay where they were.
    book.current = {id: 'W2', context: {world: 'epi-logos'}, layout: {mode: 'techne'}}
    bridge.publish()
    assert.equal(memory.getItem('forces'), null, 'workspace W2 does not read W1\'s memory')
    memory.setItem('forces', '{"v":2}')
    assert.equal(area.get('oi.test.book.atlas.W2::forces'), '{"v":2}')
    assert.equal(area.get('oi.test.book.atlas.W1::forces'), '{"v":1}')
    // The walk is the book's world's (walks/walksHost.ts), as the centre pane once set it from its own book.
    assert.equal(atlasWalkWorld(panel.atlasHandle()).key, 'epi-logos', 'the walk belongs to the world the spine stands in')
  } finally {
    handle.unmount()
  }
  assert.equal(panel.atlasHandle(), null, 'the pane\'s unmount disposes the atlas')
})
