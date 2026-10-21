// Lane W1-Factory: the rail's agent devices stand on the rail in every mode (DLW §16.1: a monitor stands "On the rail, and full in a pane";
// §19.24: Messages is "born on the widget rail, and opens full in a pane, in every mode") — so they are published by one mode-independent
// publisher (src/agent/devices/AgentRailDevices.tsx, drawn by the rail's own publisher widgets/railDevices.tsx RailDevices), never by
// Factory's chain.
//
// The instrument: the REAL publisher, mounted by React's own DOM renderer over a small DOM stand-in (the one tests/browser-rows-one-read
// uses, so every effect runs as it does in the window), with NO Factory chain mounted, over a workspace whose kernel carrier stands
// unavailable — every read refuses in its owner's words and nothing reaches a kernel.
// Channel: scripted (headless). What a person sees in the window is the lead's screen pass: UNVERIFIED here.
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {register} from 'node:module'

const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
register('./fixtures/browser-rows-one-read/loader.mjs', {parentURL: import.meta.url, data: {compiler, reactFrom: import.meta.url}})

// ── a small DOM, enough for React to mount a component and run its effects ──────────────────────────────────────────────────
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
})
document_.body = new Element_('body'); document_.documentElement = new Element_('html')
const memory = new Map()
const storage = {getItem: key => memory.get(key) ?? null, setItem: (key, value) => { memory.set(key, String(value)) }, removeItem: key => { memory.delete(key) }}
const window_ = {document: document_, localStorage: storage, HTMLIFrameElement: class {}, location: {href: 'http://localhost/', origin: 'http://localhost', search: '', hash: ''},
  addEventListener() {}, removeEventListener() {}, matchMedia: () => ({matches: false, addEventListener() {}, removeEventListener() {}}),
  requestAnimationFrame: callback => setTimeout(callback, 16), cancelAnimationFrame: id => clearTimeout(id)}
Object.assign(globalThis, {window: window_, document: document_, localStorage: storage})

const {flushSync} = await import('react-dom')
const {createRoot} = await import('react-dom/client')
const {createElement} = await import('react')
const family = await import('../src/inhabitants/familyManifest.ts')
const {loadAgentShellFamilies} = await import('../src/inhabitants/loadAgentShellFamilies.ts')
const {StubWorkspaceProvider} = await import('../src/shell/workspaceContext.tsx')
const door = await import('../src/frame/devices/deviceDoor.ts')
const {designKey} = await import('../src/frame/devices/designs.ts')
const rail = await import('../src/agent/devices/AgentRailDevices.tsx')
const msg = await import('../src/agent/devices/messagesBinding.ts')
const main = await import('../src/agent/devices/mainTrackBindings.ts')
const rec = await import('../src/agent/devices/receiptBindings.ts')
const rack = await import('../src/agent/devices/workcellRackBinding.ts')
const model = await import('../src/agent/devices/agentChainDevices.ts')

family.resetFamilyManifestsForTest()
loadAgentShellFamilies()

const read = path => readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8')
const settle = () => new Promise(resolve => setTimeout(resolve, 0))
const CARRIER = {kind: 'unavailable', reason: 'No kernel carrier in this suite.'}

test('with no Factory chain mounted, the rail\'s agent devices are published — Messages, Gateways, the Agency gateway, Frames, the Ledger, the workcell rack', async () => {
  const container = new Element_('div')
  document_.body.appendChild(container)
  const root = createRoot(container)
  flushSync(() => root.render(createElement(StubWorkspaceProvider, {transport: CARRIER}, createElement(rail.AgentRailDevices))))
  await settle()
  try {
    for (const id of model.CHAIN_DEVICE_IDS) assert.equal(door.publishedDevice(id), undefined, `${id}: no Factory chain stands`)
    assert.deepEqual(rail.RAIL_AGENT_DEVICE_IDS, [msg.MESSAGES_ID, main.GATEWAYS_RACK_ID, main.AGENCY_GATEWAY_ID, main.FRAMES_ID, rec.LEDGER_ID, rack.WORKCELL_RACK_ID])
    const designs = {[msg.MESSAGES_ID]: 'ai-kit:messages', [main.GATEWAYS_RACK_ID]: 'actuation:gateways-rack', [main.AGENCY_GATEWAY_ID]: 'ai-kit:agency-gateway',
      [main.FRAMES_ID]: 'actuation:frames-monitor', [rec.LEDGER_ID]: 'software-factory:ledger', [rack.WORKCELL_RACK_ID]: 'workcell:workcell'}
    for (const id of rail.RAIL_AGENT_DEVICE_IDS) {
      const entry = door.publishedDevice(id)
      assert.ok(entry, `${id} is published`)
      assert.ok(entry.binding, `${id} carries its binding`)
      assert.equal(designKey(entry.device.family, entry.device.face.id), designs[id], `${id}: drawn by its catalogue design, by its family's own face`)
    }
    // Each reads its owner — here every owner is out of reach, and each says so in the owner's words, never a default.
    const messages = door.publishedDevice(msg.MESSAGES_ID).binding
    assert.equal(messages.values.agents, undefined)
    assert.match(messages.standing.agents.disabled, /No kernel carrier in this suite/)
    assert.equal(door.publishedDevice(rack.WORKCELL_RACK_ID).binding.standing.seats?.disabled ?? door.publishedDevice(rack.WORKCELL_RACK_ID).binding.standing.name?.disabled,
      'No workcell is selected: select a workcell\'s return track (⌥⌘R) to read its chain.', 'no workcell selected: the rack says so')
    assert.equal(door.publishedDevice(main.AGENCY_GATEWAY_ID).binding.values.light, undefined, 'no gateway answered: no light, never a default')
    assert.match(messages.standing.gateway.disabled, /has not answered/, 'the Agency gateway\'s mark says why it is dark')
  } finally {
    flushSync(() => root.unmount())
    document_.body.removeChild(container)
  }
  for (const id of rail.RAIL_AGENT_DEVICE_IDS) assert.equal(door.publishedDevice(id), undefined, `${id}: withdrawn with its publisher`)
})

test('one publisher: the rail\'s own publisher draws it in every mode; Factory\'s chain publishes none of them, and reads no owner for them', () => {
  const railDevices = read('widgets/railDevices.tsx')
  assert.match(railDevices, /const AgentRailDevices = loadWhenDrawn\('The rail\\'s agent devices', \(\) => import\('\.\.\/agent\/devices\/AgentRailDevices'\)/)
  assert.match(railDevices, /return <AgentRailDevices \/>/, 'drawn by RailDevices, which App mounts with the rail in every mode')
  const chain = read('agent/devices/FactoryDeviceChain.tsx')
  for (const id of ['MESSAGES_ID', 'GATEWAYS_RACK_ID', 'AGENCY_GATEWAY_ID', 'LEDGER_ID']) assert.doesNotMatch(chain, new RegExp(`\\b${id}\\b`), `${id}: not the chain's`)
  assert.doesNotMatch(chain, /publishDevice\(FRAMES_ID/, 'the Frames monitor: not the chain\'s to publish (its Gateway\'s ⤢ still opens it)')
  assert.doesNotMatch(chain, /publishDevice\(WORKCELL_RACK_ID|\[WORKCELL_RACK_ID, /, 'the workcell rack is drawn from the door, not published by the chain')
  assert.match(chain, /useSyncExternalStore\(subscribeDeviceDoor, \(\) => publishedDevice\(WORKCELL_RACK_ID\)/)
  for (const reader of ['usePopulationAnswer', 'useConversationAnswer', 'useCentralGroundAnswer', 'ledgerBinding', 'messagesBinding']) {
    assert.doesNotMatch(chain, new RegExp(`\\b${reader}\\(`), `${reader}: read once, by the rail's publisher`)
  }
  // The reads are the window's shared ones: the chain's gateway read goes through the kernel's held-read holder, the rest are held answers.
  const publisher = read('agent/devices/AgentRailDevices.tsx')
  for (const shared of ['useAgentChainReading(null)', 'useWorkcellAnswer(transport)', 'useCentralGroundAnswer(transport)', 'usePopulationAnswer(transport, RACK_PROJECT)',
    'useSeatStatusAnswer(transport, asked)']) assert.ok(publisher.includes(shared), shared)
  assert.match(read('owners/ownerCall.ts'), /installKernelReadHolder\(/, 'a kernelRead from an effect is the same held answer')
  assert.match(read('agent/devices/useAgentChainReading.ts'), /kernelRead\(transport, \{op: 'harness_agent_read', binding\}\)/)
  assert.doesNotMatch(publisher, /APPROVALS_ID/, 'Approvals stays Factory\'s Main track effect')
})
