// The rail draws its devices as the catalogue draws them (parity audit D-01, D-02, D-03, D-12, D-13, D-14): the Packet tile is Central's
// Packet device's widget and the Graph tile the Knowledge graph's, each published by the rail's own publisher while its tile is open and no
// chain holds the device (widgets/railChainDevices.tsx); the rail-born devices' tile keys stand at the design's defaults from the start
// (widgets/railDevices.tsx); and the NOWs name each clearing's register and seat (widgets/railBindings.ts nowsValues). Each device is drawn
// through the door's own entry on its real binding, mounted with React as the shell mounts it.
import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'

const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
register('./fixtures/browser-rows-one-read/loader.mjs', {parentURL: import.meta.url, data: {compiler, reactFrom: import.meta.url}})

// ── a small DOM, enough for React to mount a component and run its effects (as tests/agent-rail-devices.test.mjs) ─────────────
const HTML = 'http://www.w3.org/1999/xhtml'
class Node_ {
  constructor(nodeType, nodeName) { this.nodeType = nodeType; this.nodeName = nodeName; this.childNodes = []; this.parentNode = null }
  get ownerDocument() { return document_ }
  get firstChild() { return this.childNodes[0] ?? null }
  get lastChild() { return this.childNodes[this.childNodes.length - 1] ?? null }
  get nextSibling() { const siblings = this.parentNode?.childNodes; return siblings ? siblings[siblings.indexOf(this) + 1] ?? null : null }
  appendChild(child) { return this.insertBefore(child, null) }
  insertBefore(child, before) {
    child.parentNode?.removeChild(child)
    this.childNodes.splice(before ? this.childNodes.indexOf(before) : this.childNodes.length, 0, child)
    child.parentNode = this
    return child
  }
  removeChild(child) { this.childNodes.splice(this.childNodes.indexOf(child), 1); child.parentNode = null; return child }
  addEventListener() {}
  removeEventListener() {}
  get textContent() { return this.childNodes.map(child => child.textContent).join('') }
  set textContent(value) { this.childNodes = []; if (value) this.appendChild(new Text_(String(value))) }
}
class Text_ extends Node_ { constructor(data) { super(3, '#text'); this.data = data } get textContent() { return this.data } }
class Element_ extends Node_ {
  constructor(name, namespace = HTML) { super(1, name.toUpperCase()); this.tagName = this.nodeName; this.namespaceURI = namespace; this.attributes = new Map(); this.style = {setProperty() {}, removeProperty() {}} }
  setAttribute(name, value) { this.attributes.set(name, String(value)) }
  getAttribute(name) { return this.attributes.get(name) ?? null }
  removeAttribute(name) { this.attributes.delete(name) }
}
const document_ = Object.assign(new Node_(9, '#document'), {
  createElement: name => new Element_(name), createElementNS: (namespace, name) => new Element_(name, namespace), createTextNode: data => new Text_(data),
  body: null, activeElement: null, visibilityState: 'visible', hidden: false, getElementById: () => null, addEventListener() {}, removeEventListener() {},
  head: {appendChild() {}}, dispatchEvent() { return true },
})
document_.body = new Element_('body'); document_.documentElement = new Element_('html')
const memory = new Map()
const storage = {getItem: key => memory.get(key) ?? null, setItem: (key, value) => { memory.set(key, String(value)) }, removeItem: key => { memory.delete(key) }}
const window_ = {document: document_, localStorage: storage, HTMLIFrameElement: class {}, location: {href: 'http://localhost/', origin: 'http://localhost', search: '', hash: ''},
  addEventListener() {}, removeEventListener() {}, dispatchEvent() { return true }, matchMedia: () => ({matches: false, addEventListener() {}, removeEventListener() {}}),
  requestAnimationFrame: callback => setTimeout(callback, 16), cancelAnimationFrame: id => clearTimeout(id)}
Object.assign(globalThis, {window: window_, document: document_, localStorage: storage})

const {flushSync} = await import('react-dom')
const {createRoot} = await import('react-dom/client')
const {createElement} = await import('react')
const {renderToStaticMarkup} = await import('react-dom/server')
const family = await import('../src/inhabitants/familyManifest.ts')
const {loadAgentShellFamilies} = await import('../src/inhabitants/loadAgentShellFamilies.ts')
const {loadWorldShellFamilies} = await import('../src/inhabitants/worldShellFamilies.ts')
const {StubWorkspaceProvider} = await import('../src/shell/workspaceContext.tsx')
const {KernelProvider} = await import('../../../../desktop/cradle/src/kernel/KernelProvider.tsx')
const {WidgetReadingProvider} = await import('../src/widgets/widgetReading.tsx')
const door = await import('../src/frame/devices/deviceDoor.ts')
const host = await import('../src/frame/devices/deviceHost.tsx')
const widgets = await import('../src/frame/widgets/deviceWidgets.tsx')
const ids = await import('../src/widgets/railDeviceIds.ts')
const chain = await import('../src/widgets/railChainDevices.tsx')
const rail = await import('../src/widgets/railBindings.ts')
const packetDesign = (await import('../src/inhabitants/catalogue/panels/central__packet.tsx')).design
const graphDesign = (await import('../src/inhabitants/catalogue/panels/knowledge-graph__graph.tsx')).design
const nowsDesign = (await import('../src/inhabitants/catalogue/panels/widgets__nows.tsx')).design

family.resetFamilyManifestsForTest()
loadAgentShellFamilies()
loadWorldShellFamilies()

const settle = () => new Promise(resolve => setTimeout(resolve, 0))
const CARRIER = {kind: 'unavailable', reason: 'No kernel carrier in this suite.'}
const reading = {mode: 'base', world: null, transport: CARRIER, subject: null}
const draw = (designed, binding, view) => renderToStaticMarkup(createElement(host.HostedDevice, {designed, binding, view, nav: {}}))

async function mounted(Component, check, kernel = false) {
  const container = new Element_('div')
  document_.body.appendChild(container)
  const root = createRoot(container)
  const tree = createElement(StubWorkspaceProvider, {transport: CARRIER}, createElement(WidgetReadingProvider, {value: reading}, createElement(Component)))
  flushSync(() => root.render(kernel ? createElement(KernelProvider, {transport: CARRIER}, tree) : tree))
  await settle()
  try { await check() } finally { flushSync(() => root.unmount()); document_.body.removeChild(container) }
}

test('the rail\'s Packet and Graph tiles are their devices\' widgets, never an old body', () => {
  assert.equal(ids.RAIL_PACKET_DEVICE_ID, 'central:packet')
  assert.equal(ids.RAIL_GRAPH_DEVICE_ID, 'knowledge-graph:graph')
  for (const id of ['packet', 'graph']) {
    const own = {id, name: id, mark: 'form', Body: () => null}
    const claimed = widgets.claimedWidget(own)
    assert.notEqual(claimed.Body, own.Body, `${id}: the rail draws the device's widget`)
    assert.equal(claimed.bare, true, `${id}: bare, as a device's widget is`)
  }
})

test('Packet: with no chain, the rail publishes Central\'s Packet on Central\'s binding and its widget draws the design', async () => {
  door.publishDevice('central:packet', null)
  await mounted(chain.RailPacket, () => {
    const entry = door.publishedDevice('central:packet')
    assert.ok(entry?.binding, 'published with its binding')
    assert.equal(entry.device.family, 'central')
    assert.equal(entry.device.face.id, 'packet')
    const tile = draw(packetDesign, entry.binding, 'widget')
    assert.match(tile, /data-device-view="widget"/)
    assert.match(tile, /Answer this/, 'the design\'s own widget: its Answer this')
    assert.doesNotMatch(tile, /Reading the packet…|widget-packet/, 'not the old PacketWidget body')
    assert.doesNotMatch(tile, /\bNaN\b|undefined/)
    assert.equal(entry.binding.values.light, 'dark', 'the owner\'s refusal lights it dark, in its words')
    // A chain that publishes its own Packet keeps it: the rail gives way, and does not withdraw it on leaving.
    const chainPacket = {...entry, device: {...entry.device}}
    door.publishDevice('central:packet', chainPacket)
  })
  assert.equal(door.publishedDevice('central:packet')?.device.id, 'central:packet', 'the chain\'s Packet stays after the rail leaves')
  door.publishDevice('central:packet', null)
  await mounted(chain.RailPacket, () => assert.ok(door.publishedDevice('central:packet')))
  assert.equal(door.publishedDevice('central:packet'), undefined, 'the rail withdraws its own Packet')
})

test('Graph: with no chain, the rail publishes the Knowledge graph on Technē\'s binding; its widget is the neighbourhood well, not the stub', async () => {
  door.publishDevice('knowledge-graph:graph', null)
  await mounted(chain.RailGraph, () => {
    const entry = door.publishedDevice('knowledge-graph:graph')
    assert.ok(entry?.binding, 'published with its binding')
    const tile = draw(graphDesign, entry.binding, 'widget')
    assert.match(tile, /data-device-view="widget"/)
    assert.doesNotMatch(tile, /no kernel graph_read in this shell yet/, 'not the old stub')
    assert.doesNotMatch(tile, /\bNaN\b|undefined/)
  })
  assert.equal(door.publishedDevice('knowledge-graph:graph'), undefined, 'withdrawn with its publisher')
})

test('NOWs: each clearing names its register and seat; a project\'s clearings are read in its own register and listed under Where', () => {
  const row = (now_ref, scope_ref, purpose, extra = {}) => ({now_ref, scope_ref, purpose, lifecycle: 'active', participant_refs: ['agent:fizz'], created_at_unix_seconds: 1794300000,
    source_ref: '', task_ref: '', source_refs: [], revision: 'r', ...extra})
  const ground = {time: {state: 'ready', data: {civil_date: '2026-11-13', local_time: '11:02:00+00:00', policy: {timezone: 'Europe/London'}}},
    day: {state: 'ready', data: {temporal: {lifecycle: 'open'}}}, now: {state: 'ready', data: {records: [row('n-root', 'control:root', 'Parity audit')]}},
    placement: {state: 'ready', data: {revision: 'p'}}}
  const projects = [{project: 'O-I', records: [row('n-oi', 'project:O-I', 'Land catalogue', {work_refs: [{repo: 'o-i', branch: 'dlw/x', worktree_path: '/Users/admin/Central/worktrees/env-3/o-i'}]}),
    row('n-root', 'control:root', 'Parity audit')]}]
  const values = rail.nowsValues(ground, projects)
  const nows = JSON.parse(values.nows)
  assert.deepEqual(nows.map(n => [n.now_ref, n.register, n.seat]), [['n-root', 'root', undefined], ['n-oi', 'O-I', 'env-3']], 'each once, with where it stands')
  const binding = {id: 'widgets:nows', values, local: {machine() {}, where() {}, open() {}}}
  const tile = draw(nowsDesign, binding, 'widget')
  assert.match(tile, /your ground · fizz/)
  assert.match(tile, /env-3 · fizz/, 'the seat it was opened in')
  assert.doesNotMatch(tile, /· — ·/, 'no moment reads "—" for where it stands')
  const full = draw(nowsDesign, binding, 'full')
  assert.match(full, /Your ground/); assert.match(full, /Workcell env-3/)
  assert.equal(rail.nowRegisterOf('project:Archetypal-Earth'), 'Archetypal-Earth')
  assert.equal(rail.nowSeatOf([{repo: 'x', branch: 'y', worktree_path: null}]), undefined)
})

test('NOWs: a project\'s clearing closes in its own register, on its own listing', async () => {
  const calls = []
  const ground = {now: {state: 'ready', data: {records: [{now_ref: 'n1'}]}}, placement: {state: 'ready', data: {revision: 'p1'}}}
  const projects = [{project: 'O-I', records: [{now_ref: 'n2', revision: 'r2'}]}]
  await rail.nowsCloseWrites({kind: 'bridge', url: 'x'}, ground, async (...args) => { calls.push(args) }, projects).write([{key: 'close', value: 'n2'}])
  assert.deepEqual(calls, [[{kind: 'bridge', url: 'x'}, 'n2', [{now_ref: 'n2', revision: 'r2'}], {revision: 'p1'}, 'O-I']])
})

test('Wiki: the page the agent read last is the newest tape read of one of a page\'s sources', () => {
  const nodes = [{object: 'node', ref: 'wiki:node:identity', source_refs: ['Control/user/identity.md']},
    {object: 'node', ref: 'wiki:node:ta-onta', source_refs: ['central:source:control:root:Control/agents/wiki/returns/ta-onta.md']}]
  const read = (detail, verb = 'read') => ({id: detail, turn: 1, verb, object: detail.split('/').pop(), detail, count: 1, status: 'done', cursors: [1], calls: [], events: []})
  assert.equal(rail.wikiReadLastOf([read('/Users/a/Central/Control/user/identity.md'), read('/Users/a/Central/Control/agents/wiki/returns/ta-onta.md'), read('/x/other.md')], nodes), 'wiki:node:ta-onta')
  assert.equal(rail.wikiReadLastOf([read('/Users/a/Central/Control/user/identity.md', 'edit')], nodes), undefined, 'an edit is no read')
  assert.equal(rail.wikiReadLastOf([read('/Users/a/NotControl/user/identity.mdx')], nodes), undefined)
})

test('the rail-born devices\' own keys stand at their designs\' defaults from the start: Trail\'s Limit, Files\' Show and Diff choices, Wiki\'s Follow', async () => {
  const {RailDevices} = await import('../src/widgets/railDevices.tsx')
  const trailDesign = (await import('../src/inhabitants/catalogue/panels/widgets__trail.tsx')).design
  const filesDesign = (await import('../src/inhabitants/catalogue/panels/widgets__files.tsx')).design
  const wikiDesign = (await import('../src/inhabitants/catalogue/panels/widgets__wiki.tsx')).design
  await mounted(RailDevices, () => {
    const trail = door.publishedDevice('widgets:trail').binding, files = door.publishedDevice('widgets:files').binding, wiki = door.publishedDevice('widgets:wiki').binding
    assert.equal(trail.values.limit, 8)
    assert.deepEqual([files.values.show, files.values['diff.show'], files.values['diff.session'], files.values['diff.layout']], ['touched', 'both', 'selected', 'unified'])
    assert.equal(wiki.values.follow, true)
    assert.match(draw(trailDesign, trail, 'full'), /Limit[\s\S]*?value="8"|Limit[\s\S]*?>8</, 'Full\'s Limit box reads 8, not "—"')
    const filesFull = draw(filesDesign, files, 'full')
    assert.match(filesFull, /aria-checked="true"[^>]*>[\s\S]{0,200}?Read · changed|Read · changed[\s\S]{0,200}?aria-checked="true"/, 'Show draws its choice')
    assert.match(draw(wikiDesign, wiki, 'full'), /Follow/)
  }, true)
})
