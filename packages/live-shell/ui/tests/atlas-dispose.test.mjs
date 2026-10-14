// The Earth pane's attach, hold and release (projections/atlas/AtlasProjectionPanel.tsx; T-ATLAS-DISPOSE). The real panel runs
// here, through the attach path: one atlas per session, a second pane told the atlas is open elsewhere (named, not thrown),
// closing the holder disposes the atlas and releases its window listener, and the next pane mounts a fresh atlas. Two
// modules are stood in for by the loader: the WebGL mount (fixtures/atlas-mount-stub.mjs, which keeps the lifetime contract
// the real mountAtlas keeps) and the corpus provider (fixtures/atlas-provider-stub.mjs, the atlas's fixture corpus). What is
// NOT claimed here: that the real globe mounts, draws and disposes its GPU resources. That is verified on screen.
import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'

const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
const mountStub = new URL('./fixtures/atlas-mount-stub.mjs', import.meta.url).href
const providerStub = new URL('./fixtures/atlas-provider-stub.mjs', import.meta.url).href

// The in-memory TypeScript loader of the atlas host suite, with two stand-ins: the panel's mount and provider imports
// resolve to the stub modules above. Every other module is the production module.
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};
import {readFile} from 'node:fs/promises';
const STUBS = {'./mount': ${JSON.stringify(mountStub)}, './provider/archetypalEarthProvider': ${JSON.stringify(providerStub)}};
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
  const text = (await readFile(new URL(u), 'utf8')).replace(/import\.meta\.env/g, '({BASE_URL:"/"})');
  return {format: 'module', shortCircuit: true, source: ts.transpileModule(text, {fileName: new URL(u).pathname,
    compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX}}).outputText};
}`)}`, import.meta.url)

// ── a DOM stand-in: the attach path creates, appends and empties elements, and binds one window listener through the stub ──
class FakeClassList {
  set = new Set()
  add(...names) { names.forEach(n => this.set.add(n)) }
  remove(...names) { names.forEach(n => this.set.delete(n)) }
  toggle(name, force) {
    const on = force === undefined ? !this.set.has(name) : !!force
    if (on) this.set.add(name)
    else this.set.delete(name)
    return on
  }
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
/** A window-like target counting what is added and removed. */
class CountingTarget {
  added = []
  removed = []
  addEventListener(type, listener, options) { this.added.push({type, listener, options}) }
  removeEventListener(type, listener) { this.removed.push({type, listener}) }
  live() { return this.added.filter(a => !this.removed.some(r => r.type === a.type && r.listener === a.listener)) }
}
class FakeObserver {
  observe() {}
  disconnect() {}
}

const win = new CountingTarget()
globalThis.window = win
globalThis.document = {
  createElement: tag => new FakeNode(tag),
  body: new FakeNode('body'),
  documentElement: new FakeNode('html'),
  addEventListener() {},
  removeEventListener() {},
}
globalThis.MutationObserver = FakeObserver
globalThis.IntersectionObserver = FakeObserver

const transport = {kind: 'unavailable', reason: 'the attach test has no kernel'}
const pane = () => new FakeNode('div')
const stub = await import(mountStub)
const panel = await import(new URL('../src/projections/atlas/AtlasProjectionPanel.tsx', import.meta.url).href)
const {lifetimeLive} = await import(new URL('../src/projections/atlas/src/ui/lifetime.ts', import.meta.url).href)
panel.bindAtlasScope({namespace: 'test.atlas-dispose', workspaceId: 'w1'})

const heldText = element => element.children.map(child => child.textContent)

test('the first pane mounts and holds the atlas; a second pane is told it is open elsewhere, and mounts nothing', async () => {
  const mounts = stub.stubState().mounts
  const first = await panel.attachAtlas({element: pane(), transport, follow: true})
  assert.equal(first.held, null, 'the first pane holds the atlas')
  assert.equal(stub.stubState().mounts, mounts + 1)
  const body = pane()
  const second = await panel.attachAtlas({element: body, transport, follow: false, view: 'graph'})
  assert.equal(second.held, panel.ATLAS_HELD_MESSAGE, 'the second pane is given the named held state, not a throw')
  assert.deepEqual(heldText(body), [panel.ATLAS_HELD_MESSAGE], 'the second pane says so in its own body')
  assert.equal(body.children[0].attrs.role, 'status')
  assert.equal(stub.stubState().mounts, mounts + 1, 'the second pane mounts nothing')
  first.unmount()
})

test('closing the holder disposes the atlas and releases its window listener; the next pane mounts a fresh one', async () => {
  const before = {...stub.stubState()}
  const holder = await panel.attachAtlas({element: pane(), transport, follow: true})
  assert.equal(lifetimeLive(), true, 'the atlas lifetime is live while the atlas is mounted')
  assert.equal(win.live().length, 1, 'the mounted atlas holds its window listener')
  holder.unmount()
  assert.equal(stub.stubState().disposals, before.disposals + 1, 'closing the pane disposes the atlas')
  assert.deepEqual(win.live(), [], 'no window listener remains after the pane is closed')
  assert.equal(win.removed.length, win.added.length, 'each window listener added is removed')
  assert.equal(win.added.every(a => a.options.signal.aborted), true, 'their signals are aborted')
  assert.equal(lifetimeLive(), false, 'no atlas lifetime is live after the pane is closed')
  holder.unmount()
  assert.equal(stub.stubState().disposals, before.disposals + 1, 'a second unmount disposes nothing more')

  const reopened = await panel.attachAtlas({element: pane(), transport, follow: true})
  assert.equal(reopened.held, null, 'closing then reopening the Earth mounts a fresh atlas')
  assert.equal(stub.stubState().mounts, before.mounts + 2)
  reopened.unmount()
})

test('a constellation pane reopened after the Earth closes mounts the atlas in its own kind (the graph view)', async () => {
  const earth = await panel.attachAtlas({element: pane(), transport, follow: true})
  earth.unmount()
  const constellation = await panel.attachAtlas({element: pane(), transport, follow: false, view: 'graph'})
  assert.equal(constellation.held, null, 'the constellation pane holds the atlas once the Earth is gone')
  constellation.unmount()
})

test('a mount that fails releases the claim, so the next pane may mount', async () => {
  stub.failNextMount()
  await assert.rejects(panel.attachAtlas({element: pane(), transport, follow: true}), /stub mount refused/)
  assert.equal(lifetimeLive(), false, 'a refused mount leaves no lifetime behind')
  const later = await panel.attachAtlas({element: pane(), transport, follow: true})
  assert.equal(later.held, null, 'the claim was released, so a later pane mounts')
  later.unmount()
})

test('the one atlas per session is held by name: while a pane holds it, another attach is held, never mounted twice', async () => {
  const mounts = stub.stubState().mounts
  const holder = await panel.attachAtlas({element: pane(), transport, follow: true})
  const a = await panel.attachAtlas({element: pane(), transport, follow: true})
  const b = await panel.attachAtlas({element: pane(), transport, follow: false, view: 'graph'})
  assert.equal(a.held, panel.ATLAS_HELD_MESSAGE)
  assert.equal(b.held, panel.ATLAS_HELD_MESSAGE)
  assert.equal(stub.stubState().mounts, mounts + 1, 'one mount for three panes')
  a.unmount()
  b.unmount()
  assert.equal(lifetimeLive(), true, 'a held pane closing does not dispose the holder')
  holder.unmount()
  assert.equal(lifetimeLive(), false)
})

test('the mount completes without any Sun reply: a dated read that never answers does not hold the Earth', async () => {
  const realFetch = globalThis.fetch
  globalThis.fetch = () => new Promise(() => {}) // the kernel's dated sky read never answers
  let timer
  try {
    const bridge = {kind: 'bridge', url: 'http://127.0.0.1:9'}
    const mounts = stub.stubState().mounts
    const attached = await Promise.race([
      panel.attachAtlas({element: pane(), transport: bridge, follow: true}),
      new Promise((_, reject) => { timer = setTimeout(() => reject(Error('the mount waited on the Sun reply')), 2000) }),
    ])
    assert.equal(attached.held, null, 'the Earth mounted')
    assert.equal(stub.stubState().mounts, mounts + 1)
    attached.unmount()
  } finally {
    clearTimeout(timer)
    globalThis.fetch = realFetch
  }
})

test('the present sky is keyed to its ten-minute bucket, and a dated year is one reading', () => {
  const at = new Date('2026-10-14T14:23:00Z')
  assert.equal(panel.sunInstantKey({present: true, at}), panel.sunInstantKey({present: true, at: new Date('2026-10-14T14:29:59Z')}),
    'within one bucket the present sky is one reading')
  assert.notEqual(panel.sunInstantKey({present: true, at}), panel.sunInstantKey({present: true, at: new Date('2026-10-14T14:30:00Z')}),
    'the next bucket is read again')
  assert.equal(panel.sunInstantKey({present: false, year: 1800}), 'year:1800')
})

test('the Sun status names the read time of the present sky and that it is read again; a Sun not yet read names none', () => {
  const at = new Date('2026-10-14T14:23:00Z')
  const placed = {field: {}, placed: true, instant: {present: true, at}}
  const text = panel.sunStatusText(placed, null, false)
  assert.match(text, /read for 2026-10-14 14:23 UTC/)
  assert.match(text, /read again every ten minutes/)
  const notRead = {field: {}, placed: false, reason: panel.NOT_READ_REASON, instant: {present: true, at}}
  const pending = panel.sunStatusText(notRead, null, true)
  assert.match(pending, /has not been read yet/)
  assert.doesNotMatch(pending, /read for 2026-10-14/, 'a Sun not yet read names no read time')
})

test('the Sun is a sky occurrence: the sky locus is admitted by the contract and named Sky in the kind filter', async () => {
  const {QL_SKY_LOCUS} = await import(new URL('../src/inhabitants/qlSkyEarthAdapter.ts', import.meta.url).href)
  const {LOCUS_TYPES} = await import(new URL('../src/projections/occurrence.ts', import.meta.url).href)
  const {KIND_LABELS} = await import(new URL('../src/projections/atlas/src/shell/filter.ts', import.meta.url).href)
  assert.equal(QL_SKY_LOCUS, 'sky', 'the Sun is not filed under historical events')
  assert.ok(LOCUS_TYPES.includes('sky'), 'the contract admits the sky locus')
  assert.equal(KIND_LABELS.sky, 'Sky')
})
