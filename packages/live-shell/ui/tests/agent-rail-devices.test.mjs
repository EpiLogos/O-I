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

test('with no Factory chain mounted, the rail\'s agent devices are published — Messages, Frames (the Gateway\'s widget), the Ledger, the workcell rack with the gateways', async () => {
  const container = new Element_('div')
  document_.body.appendChild(container)
  const root = createRoot(container)
  flushSync(() => root.render(createElement(StubWorkspaceProvider, {transport: CARRIER}, createElement(rail.AgentRailDevices))))
  await settle()
  try {
    for (const id of model.CHAIN_DEVICE_IDS) assert.equal(door.publishedDevice(id), undefined, `${id}: no Factory chain stands`)
    // REPLACED (#725): Gateways and the Agency gateway among them, and Frames drawn by the Frames monitor — the 22 Oct manual rewrite retired
    // the three: the gateways are listed on the Workcells tile (§19.3), the agency gateway is the Gateway's agency build whose mark stands in
    // the head of Messages (§19.10), and the rail's Frames is the Gateway's widget (§19.6).
    // REPLACED (parity D-09): Approvals was Factory's chain's alone while its rail tile was claimed in every mode (the tile read "on no chain
    // now" everywhere else); the rail's publisher holds it now, in every mode.
    assert.deepEqual(rail.RAIL_AGENT_DEVICE_IDS, [msg.MESSAGES_ID, main.FRAMES_ID, rec.LEDGER_ID, rec.APPROVALS_ID, rack.WORKCELL_RACK_ID])
    for (const id of [main.GATEWAYS_RACK_ID, main.AGENCY_GATEWAY_ID]) assert.equal(door.publishedDevice(id), undefined, `${id}: retired, not published`)
    const designs = {[msg.MESSAGES_ID]: 'ai-kit:messages', [main.FRAMES_ID]: 'actuation:gateway', [rec.LEDGER_ID]: 'software-factory:ledger', [rec.APPROVALS_ID]: 'software-factory:approvals', [rack.WORKCELL_RACK_ID]: 'workcell:workcell'}
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
    // REPLACED (#725): the Agency gateway's own light — its mark in the head of Messages (§19.10) is Messages' `gateway` reading.
    assert.equal(messages.values.gateway, undefined, 'no gateway answered: no reading, never a default')
    assert.match(messages.standing.gateway.disabled, /has not answered/, 'the Agency gateway\'s mark says why it is dark')
    // REPLACED (#725): the Gateways monitor's chains — the Workcells tile carries them under `gw.` (§19.3): every registered gateway, by the
    // manual's name; the harness gateways unread, so with no state; the Remote carrier's line Workcell's status, refused in its words.
    const gateways = JSON.parse(door.publishedDevice(rack.WORKCELL_RACK_ID).binding.values['gw.chains'])
    assert.deepEqual(gateways.map(row => row.name), ['Hermes gateway', 'AIKit agency gateway', 'Actuation gateway', 'Remote carrier'])
    assert.ok(gateways.slice(0, 3).every(row => row.state === undefined), 'no gateway read: no state, never a default')
    assert.deepEqual(gateways[3], {id: 'remote-carrier', name: 'Remote carrier', state: 'refused', why: 'No kernel carrier in this suite.'})
  } finally {
    flushSync(() => root.unmount())
    document_.body.removeChild(container)
  }
  for (const id of rail.RAIL_AGENT_DEVICE_IDS) assert.equal(door.publishedDevice(id), undefined, `${id}: withdrawn with its publisher`)
})

test('parity D-09, D-30, D-40: with no Factory chain, the rail\'s Approvals tile draws the catalogue design\'s widget on its real binding; its notices say why; an away tile names its device', async () => {
  const {renderToStaticMarkup} = await import('react-dom/server')
  const host = await import('../src/frame/devices/deviceHost.tsx')
  const widgets = await import('../src/frame/widgets/deviceWidgets.tsx')
  await import('../src/agent/agentDockTiles.ts')
  const {design} = await import('../src/inhabitants/catalogue/panels/software-factory__approvals.tsx')
  const container = new Element_('div')
  document_.body.appendChild(container)
  const root = createRoot(container)
  flushSync(() => root.render(createElement(StubWorkspaceProvider, {transport: CARRIER}, createElement(rail.AgentRailDevices))))
  await settle()
  try {
    const entry = door.publishedDevice(rec.APPROVALS_ID)
    assert.ok(entry?.binding, 'Approvals is published, with its binding, by the rail\'s publisher alone')
    assert.equal(designKey(entry.device.family, entry.device.face.id), 'software-factory:approvals')
    // The tile the rail claims draws the device's own widget, never the away words — on the catalogue's design itself (the window's loader
    // resolves it through Vite's glob, which this suite has not, so the very design object is handed to the registry).
    const designs = await import('../src/frame/devices/designs.ts')
    designs.registerDesignedDevice(design)
    const tile = widgets.claimedWidget({id: 'approvals', name: 'Approvals', mark: 'arm', Body: () => null})
    const drawn = renderToStaticMarkup(createElement(tile.Body, {subject: null, pinned: false}))
    assert.doesNotMatch(drawn, /is on no chain now/)
    assert.match(drawn, /data-device-size="widget"/)
    // The design's own draw on the same binding: the tile draws exactly it.
    const own = renderToStaticMarkup(createElement(host.HostedDevice, {designed: design, binding: entry.binding, view: 'widget', nav: {}}))
    const text = html => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    // The rail's tile adds only its ✕ (the tile closes from the rail).
    assert.equal(text(drawn).replace(' ✕', ''), text(own), 'the tile draws the design\'s widget on its binding')
    // Every reading stands with its owner's words: the returns refuse with the carrier's, the notices say why they are empty (D-30).
    assert.match(entry.binding.standing.queue.disabled, /No kernel carrier in this suite|Native transport unavailable/)
    for (const key of ['desktop', 'messages']) {
      assert.ok(key in entry.binding.values || entry.binding.standing[key]?.disabled, `${key}: a value or why there is none`)
    }
    assert.equal(entry.binding.standing.messages.disabled, (await import('../src/widgets/railBindings.ts')).NOTIFICATIONS_ABSENT.waiting)
    assert.match(entry.binding.standing.desktop.disabled, /No kernel carrier in this suite/, 'the desktop\'s notice: the carrier\'s words, never "reading" for ever')
    assert.ok(!(entry.binding.waiting ?? []).includes('desktop'))
  } finally {
    (await import('../src/frame/devices/designs.ts')).unregisterDesignedDevice(design.id)
    flushSync(() => root.unmount())
    document_.body.removeChild(container)
  }
  assert.equal(door.publishedDevice(rec.APPROVALS_ID), undefined, 'withdrawn with its publisher')
  // D-40: a claimed tile whose device stands nowhere says which device by the rail's name for it, never by its raw id.
  const away = renderToStaticMarkup(createElement(widgets.claimedWidget({id: 'approvals', name: 'Approvals', mark: 'arm', Body: () => null}).Body, {subject: null, pinned: false}))
  assert.match(away, /Approvals is on no chain now\. It returns here when its chain does\./)
  assert.doesNotMatch(away, /factory:main:approvals/)
})

test('parity D-08: with no Factory chain, AIKit\'s instrument is published beside the rail\'s agent devices and its tile draws the design\'s widget', async () => {
  const {renderToStaticMarkup} = await import('react-dom/server')
  const host = await import('../src/frame/devices/deviceHost.tsx')
  const widgets = await import('../src/frame/widgets/deviceWidgets.tsx')
  const designs = await import('../src/frame/devices/designs.ts')
  await import('../src/agent/agentDockTiles.ts')
  const ai = await import('../src/agent/devices/aikitInstrumentBinding.ts')
  const {design} = await import('../src/inhabitants/catalogue/panels/ai-kit__ai-kit.tsx')
  designs.registerDesignedDevice(design)
  const container = new Element_('div')
  document_.body.appendChild(container)
  const root = createRoot(container)
  flushSync(() => root.render(createElement(StubWorkspaceProvider, {transport: CARRIER}, createElement(rail.AgentRailDevices))))
  await settle()
  try {
    const entry = door.publishedDevice(ai.AIKIT_ID)
    assert.ok(entry?.binding, 'AIKit\'s instrument is published with its binding')
    assert.equal(designKey(entry.device.family, entry.device.face.id), 'ai-kit:ai-kit')
    // Nothing selected and no carrier: every reading stands in words, none a sample.
    assert.equal(entry.binding.standing.run.disabled, ai.AIKIT_ABSENT.run)
    assert.equal(entry.binding.values.agents, undefined)
    const tile = widgets.claimedWidget({id: 'aikit', name: 'AIKit', mark: 'lib', Body: () => null})
    const drawn = renderToStaticMarkup(createElement(tile.Body, {subject: null, pinned: false}))
    const own = renderToStaticMarkup(createElement(host.HostedDevice, {designed: design, binding: entry.binding, view: 'widget', nav: {}}))
    const text = html => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    assert.doesNotMatch(drawn, /is on no chain now/)
    assert.equal(text(drawn).replace(' ✕', ''), text(own), 'the tile draws the design\'s widget on its binding')
  } finally {
    designs.unregisterDesignedDevice(design.id)
    flushSync(() => root.unmount())
    document_.body.removeChild(container)
  }
  assert.equal(door.publishedDevice(ai.AIKIT_ID), undefined, 'withdrawn with the rail\'s agent devices')
})

test('one publisher: the rail\'s own publisher draws it in every mode; Factory\'s chain publishes none of them, and reads no owner for them', () => {
  const railDevices = read('widgets/railDevices.tsx')
  assert.match(railDevices, /const AgentRailDevices = loadWhenDrawn\('The rail\\'s agent devices', \(\) => import\('\.\.\/agent\/devices\/AgentRailDevices'\)/)
  // REPLACED (round 890, XS01): RailDevices also draws the rail's Sky while its tile is open (rail-sky-xs01-890.test.mjs).
  assert.match(railDevices, /return <><AgentRailDevices \/>\{sky && <RailSky \/>\}<\/>/, 'drawn by RailDevices, which App mounts with the rail in every mode')
  const chain = read('agent/devices/FactoryDeviceChain.tsx')
  for (const id of ['MESSAGES_ID', 'GATEWAYS_RACK_ID', 'AGENCY_GATEWAY_ID', 'LEDGER_ID']) assert.doesNotMatch(chain, new RegExp(`\\b${id}\\b`), `${id}: not the chain's`)
  assert.doesNotMatch(chain, /publishDevice\(FRAMES_ID/, 'the Frames tile: not the chain\'s to publish (its Gateway\'s ⤢ still opens it)')
  assert.doesNotMatch(chain, /publishDevice\(WORKCELL_RACK_ID|\[WORKCELL_RACK_ID, /, 'Workcell\'s instrument is not published by the chain')
  // REPLACED (§19.23 "It stands on no chain"; §16.3 "Its window holds its Full"): the chain drew the workcell rack from the door; it draws
  // Workcell's instrument nowhere, so it watches no published entry of it.
  assert.doesNotMatch(chain, /publishedDevice\(WORKCELL_RACK_ID\)/, 'the chain draws no entry of Workcell\'s instrument')
  // REPLACED (lane W11): the chain reads the same held population answer for Custody's Positions (one keyed read for the window).
  // REPLACED (O-I ticket 1003, the one send): Messages' conversation is the session its occupant works, which the rail observes itself.
  for (const reader of ['useCentralGroundAnswer', 'ledgerBinding', 'messagesBinding']) {
    assert.doesNotMatch(chain, new RegExp(`\\b${reader}\\(`), `${reader}: read once, by the rail's publisher`)
  }
  // The reads are the window's shared ones: the chain's gateway read goes through the kernel's held-read holder, the rest are held answers.
  const publisher = read('agent/devices/AgentRailDevices.tsx')
  for (const shared of ['useAgentChainReading(null)', 'useWorkcellAnswer(transport)', 'useCentralGroundAnswer(transport)', // REPLACED (O-I #740 lane B): Messages read the population of RACK_PROJECT ('O-I'); they read the world's whole population now,
    // the root register named by no project world (agent/worldScope.ts).
    'usePopulationAnswer(transport, registerOf(ROOT_REGISTER))',
    'useSeatStatusAnswer(transport, asked)']) assert.ok(publisher.includes(shared), shared)
  assert.match(read('owners/ownerCall.ts'), /installKernelReadHolder\(/, 'a kernelRead from an effect is the same held answer')
  assert.match(read('agent/devices/useAgentChainReading.ts'), /kernelRead\(transport, \{op: 'harness_agent_read', binding\}, gatewayAt \? \{fresh: true\} : \{\}\)/)
  // REPLACED (parity D-09): "Approvals stays Factory's Main track effect" — its rail tile is claimed in every mode, so the rail's publisher
  // publishes it in every mode, and the Main track draws the same door entry.
  assert.match(publisher, /publish\(APPROVALS_ID, approvals\)/, 'Approvals: published by the rail\'s publisher')
  assert.ok(publisher.includes('useEncounterSessions(observed)'), 'the open agent\'s conversation: the one encounter session, observed by the rail')
})

const HARNESS_CAPTURE = JSON.parse(readFileSync(new URL('./fixtures/aikit-harness-binding-2026-11-13.json', import.meta.url), 'utf8'))

test('the harness binding is read from the gateway\'s ecology, and lists no agents: the agents here are the census\'s (O-I ticket 1003)', async () => {
  const harness = await import('../src/agent/useHarnessBinding.ts')
  assert.equal('foundHarnesses' in harness, false, 'no list of the harnesses found here stands beside the census')
  assert.doesNotMatch(read('agent/useHarnessBinding.ts'), /harness_status/, 'AIKit\'s client status is not read for the binding')
  const {gatewayBindingOf} = harness
  // Client status names harnesses and no binding (the shape `harnesses[{id,binding}]` was never AIKit's).
  assert.equal(gatewayBindingOf(HARNESS_CAPTURE.client_status), null, 'client status names no gateway binding')
  assert.equal(gatewayBindingOf(HARNESS_CAPTURE.gateway_ecology), 'gateway-binding/lanea', 'the gateway names its binding in its ecology')
  assert.equal(gatewayBindingOf({type: 'ecology', ecology: {agencies: []}}), null, 'a gateway with no conversation names none')
})

// The census as the kernel answers the World Model's agents slice (census.rs): claude-code and prime start, gemini does not. AIKit's client
// status below marks gemini detected (its binary is found, though it fails its start) and has no client for prime: a list made from it
// would offer gemini and miss prime.
const AGENTS_SLICE = {schema: 'oi.world-model-slice/v1', slice: 'agents', owner: 'kernel', scopes: ['machine'], version: 1, state: 'read', error: null, read_at_unix_ms: 1,
  value: {agents: [
    {slug: 'claude-code', harness_ref: 'harness/claude-code', executable: '/x/claude', starts: true, talks: true, version: '2.1.323', aikit: {client: 'claude', harness: 'claude-code'}},
    {slug: 'prime', harness_ref: 'harness/prime', executable: '/x/prime', starts: true, talks: false, why: 'AIKit names no client for prime, so it opens no conversation with it', aikit: null},
    {slug: 'gemini', harness_ref: 'harness/gemini', executable: '/x/gemini', starts: false, talks: false, why: '/x/gemini --version exited exit status: 1', aikit: null}]}}
const AIKIT_CLIENTS = {clients: [{client: 'claude', harness: 'claude-code', detection: 'detected'}, {client: 'gemini', harness: 'gemini', detection: 'detected'}]}

test('the harness binding is read once for the window: the chain and the rail\'s publisher share the held answers (the census, harness_agent_read); the Harness chooser offers the census\'s agents that start', async () => {
  const {useAgentChainReading} = await import('../src/agent/devices/useAgentChainReading.ts')
  // A counting stand-in for the kernel bridge: each op asked is recorded; the owners answer in their own shapes, every other read refuses.
  const asked = []
  const realFetch = globalThis.fetch
  globalThis.fetch = async (url, init) => {
    const op = JSON.parse(init.body)
    asked.push(op.binding ? `${op.op}:${op.binding}` : op.op === 'model_subscribe' ? `${op.op}:${op.slice}` : op.op)
    // The owners' own shapes, captured from the real AIKit (fixtures/aikit-harness-binding-2026-11-13.json): the gateway's bindings are its
    // ecology's surfaces. The agents are the World Model's agents slice.
    const outcome = op.op === 'model_subscribe' && op.slice === 'agents' ? {result: 'model_slice', data: AGENTS_SLICE}
      : op.op === 'harness_status' ? {result: 'harness_status_reading', data: AIKIT_CLIENTS}
      : op.op === 'aikit_read' && op.request?.kind === 'gateway-ecology' ? {result: 'owner_route_reading', route: 'aikit gateway ecology', data: HARNESS_CAPTURE.gateway_ecology}
      : op.op === 'harness_agent_read' ? {result: 'harness_agent_reading', binding: op.binding, document: {state: 'ready'}} : null
    return {json: async () => (outcome ? {ok: true, outcome} : {ok: false, error: `${op.op} is not answered in this suite`})}
  }
  const bridge = {kind: 'bridge', url: 'http://kernel.test/harness-shared'}
  /** What the chain reads (FactoryDeviceChain.tsx: useAgentChainReading for its session), and the harnesses it hands the Agent's chooser. */
  let harnesses
  function ChainReads() { harnesses = useAgentChainReading('agent-session/one').harnesses; return null }
  const container = new Element_('div')
  document_.body.appendChild(container)
  const root = createRoot(container)
  try {
    flushSync(() => root.render(createElement(StubWorkspaceProvider, {transport: bridge}, createElement(ChainReads), createElement(rail.AgentRailDevices))))
    for (let tick = 0; tick < 20 && (!asked.includes('harness_agent_read:gateway-binding/lanea') || !harnesses); tick++) await new Promise(resolve => setTimeout(resolve, 10))
    await settle()
    assert.deepEqual(harnesses, ['claude-code', 'prime'], 'the census\'s agents that start, by slug: not gemini, which does not start, and prime, which AIKit has no client for')
    assert.equal(asked.filter(op => op === 'harness_status').length, 0, 'AIKit\'s client status is not read for a list of agents')
    assert.equal(asked.filter(op => op === 'model_subscribe:agents').length, 1, 'the census: one ask for both readers')
    // Each binding is one ask for both readers: the shell's default before the owner names one, then the binding the owner named.
    assert.equal(asked.filter(op => op === 'harness_agent_read:gateway-binding/lanea').length, 1, 'harness_agent_read on the binding the gateway names: one ask for both readers')
    assert.ok(asked.filter(op => op === 'harness_agent_read:cursor').length <= 1, 'and on the default, at most one')
  } finally {
    flushSync(() => root.unmount())
    document_.body.removeChild(container)
    globalThis.fetch = realFetch
  }
})

