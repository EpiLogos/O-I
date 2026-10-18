import test, {beforeEach} from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'
import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'

// T-DEVICES-TECHNE: the Technē instruments' faces — the QL field/PCM owner and its waiting kin, the atlas's four faces, the knowledge
// graph's three — as devices of the runtime, on TechneInstrumentsDetail and InstrumentDeviceDetail. Each stands compact on the chain
// through DeviceView with its body as its picture; the same device is whole in the pool and full in a pane; a write reaches the owner
// only through its armed setter or the hosted stage channel. Production modules in memory (the loader of live-browser-chain.test.mjs,
// with the json/raw handling the Detail bodies' imports need, as atlas-face-bodies.test.mjs).
const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};
import {readFile} from 'node:fs/promises';
export async function resolve(s, c, n) {
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
  const out = ts.transpileModule(await readFile(new URL(u), 'utf8'), {fileName: new URL(u).pathname,
    compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX}}).outputText;
  return {format: 'module', shortCircuit: true, source: out.split('import.meta.env').join('({BASE_URL: "/"})')};
}`)}`, import.meta.url)

globalThis.__CRADLE_WALK__ = false
const door = await import('../src/inhabitants/familyManifest.ts')
const world = await import('../src/inhabitants/worldShellFamilies.ts')
const adoptRows = await import('../src/inhabitants/sdk/adoptVerifiedRows.ts')
const p0 = await import('../src/inhabitants/agentNativeP0.ts')
const sdkDefine = await import('../src/inhabitants/sdk/define.ts')
const {inhabitantManifest} = await import('../src/inhabitants/manifest.ts')
const {TechneInstrumentsDetail, InstrumentDeviceDetail} = await import('../src/shell/ModeDetail.tsx')
const chain = await import('../src/inhabitants/ql/devices/TechneDevices.tsx')
const atlasDevs = await import('../src/inhabitants/ql/devices/atlasDevices.ts')
const knowledgeDevs = await import('../src/inhabitants/ql/devices/knowledgeDevices.ts')
const qlDevs = await import('../src/inhabitants/ql/devices/qlDevices.ts')
const faces = await import('../src/inhabitants/ql/devices/faces.ts')
const rowSets = await import('../src/inhabitants/ql/devices/rowSets.ts')
const {DeviceView} = await import('../src/frame/devices/DeviceView.tsx')
const {PlacedDevice: WholePlaced} = await import('../src/frame/devices/DeviceView.tsx')
const wholeDoor = await import('../src/frame/devices/deviceDoor.ts')
/** The selected device's Whole, as its band draws it above the chain (W1, manual §16.7: the pool holds no device; DevicePool retired). */
function WholeBand() {
  const held = wholeDoor.useDeviceDoor()
  const entry = held.selected ? held.device(held.selected) : undefined
  return entry ? createElement(WholePlaced, {device: entry.device, view: 'whole', picture: entry.picture, binding: entry.binding}) : null
}
const {DeviceFullPane} = await import('../src/frame/devices/devicePane.tsx')
const {lightOf, compactRows} = await import('../src/frame/devices/deviceRuntime.ts')
const deviceDoor = await import('../src/frame/devices/deviceDoor.ts')
const torus = await import('../src/live/torusInstrument.ts')
const qlReading = await import('../src/inhabitants/ql/qlInstrumentReading.ts')
const {publishAtlasHandle, presentAtlasView} = await import('../src/projections/atlas/AtlasProjectionPanel.tsx')
const {TimeModel} = await import('../src/projections/atlas/src/state/timeModel.ts')
const {createTimeScale} = await import('../src/projections/atlas/src/data/time.ts')
const {DEFAULT_FORCES} = await import('../src/projections/atlas/src/graph/forces.ts')
const {DEFAULT_TIE_BASES} = await import('../src/projections/atlas/src/types/field.ts')
const handleStore = await import('../../../../desktop/cradle/src/knowledge/knowledgeGraphHandle.ts')
const cradleFilters = await import('../../../../desktop/cradle/src/knowledge/filters.ts')

const html = element => renderToStaticMarkup(element)
const transport = {kind: 'unavailable', reason: 'the test carrier is down'}

/** The world as the shell stands it, and the P0 batch beside it — the declared rows the devices are locked to. */
function standWorld() {
  door.resetFamilyManifestsForTest()
  world.loadWorldShellFamilies()
  adoptRows.adoptVerifiedRows()
  p0.loadAgentNativeP0()
}
standWorld()

const manifests = (...ids) => ids.map(id => inhabitantManifest(id))
const INSTRUMENTS = () => manifests('quaternal-logic', 'atlas-earth')
const faceOf = (family, id) => inhabitantManifest(family).faces.find(face => face.id === id)

// ── fixtures: the atlas, the graph, the QL owner — as the owners' own objects report them ──────────────────────────

class FakeGraph {
  constructor({local = false} = {}) {
    this.state = {
      local, depth: 1, dust: true, kinds: {archetype: true, theoretic: true, family: true},
      ties: DEFAULT_TIE_BASES.map(b => b.id), forces: {...DEFAULT_FORCES}, sky: 'off', skyAsOf: '',
    }
  }
  controls() { return {...this.state, kinds: {...this.state.kinds}, ties: [...this.state.ties], forces: {...this.state.forces}, bases: DEFAULT_TIE_BASES} }
  setDepth(d) { this.state.depth = Math.max(1, Math.min(3, d)) }
  setDust(on) { this.state.dust = on }
  setKinds(kinds) { this.state.kinds = {...kinds} }
  setTies(bases) { this.state.ties = [...bases] }
  setForces(forces) { this.state.forces = {...forces} }
  setSkyAnchors(on) { this.state.sky = on ? 'on' : 'off' }
  reframe() {}
}

function atlasHandle({graph = null, time = new TimeModel(), scope = null} = {}) {
  const engine = {baseKind: '2k', whole: false, setWholeField(on) { this.whole = on }}
  const ctl = {graphControls: graph, globeScope: {scope, wholeField: false}, subscribeFaces() { return () => {} }, onUserTime() {}}
  return {ctl, time, engine, model: {scale: createTimeScale(-1000, 1960)}}
}

async function mounted(handle, body) {
  publishAtlasHandle(handle)
  try { return await body() } finally { publishAtlasHandle(null); presentAtlasView('earth') }
}

function fakeKnowledge({filters = {}, zoom = 1, kinds = ['wiki-node', 'file', 'skill'], relations = ['node-source', 'space-node'], loaded = true} = {}) {
  const calls = []
  return {
    calls, filters: cradleFilters.restoreGraphFilters(filters), zoom, domains: loaded ? {kinds, relations} : null, counts: null, selected: null,
    patchFilters(patch) { calls.push(['patch', patch]) }, setZoom(next) { calls.push(['zoom', next]) }, fit() {},
  }
}

const ownerReading = (standing = 'following') => ({
  schema: 'ql.instrument-reading/v1', standing, reason: null,
  identity: {event_ref: 'controlled:occasion', subject_ref: 'controlled:subject', registry_revision: 'controlled:registry', geometry_ref: 'controlled:geometry', material_ref: 'controlled:material', model_ref: 'controlled:model'},
  acknowledged: {generation: '4', samples_elapsed: '245760'}, presented: {generation: '4', samples_elapsed: '245760'},
  audio: {schema: 'ql.native-audio-receipt/v1', device_epoch: 0, device_sample_rate: 48000, native_origin: '0', context_origin_seconds: 0.5, observed_context_seconds: 0.61,
    target_context_seconds: 5.62, status: 'scheduled', muted: true, presentation_gain: 0.1, scheduled_blocks: 30, discarded_blocks: 2, reason: null, interval: null, standing: 'native PCM scheduled'},
  available: true, held: false, in_flight: false, queued_blocks: 3, queued_bytes: 4096, coalesced_presentation_frames: 0, views: 1, disposed: false,
  playback_policy: {blockFrames: 8192, leadSeconds: 0.5, lookaheadSeconds: 0.5, owner: 'test'},
})
const validState = (standing = 'following', parameters = {}) => ({
  ok: true, value: qlReading.parseQlInstrumentReading(ownerReading(standing)), determinants: null,
  parameters: {muted: true, level: 0.5, scale: {unitsPerMetre: 120, mode: 'manual'}, cadence: {rate: 12, playing: true, source: 'scene'}, refusal: null, ...parameters},
})

const readings = (over = {}) => ({atlas: atlasDevs.atlasReading(null, 'earth'), surface: null, torus: null, instrumentReading: torus.qlInstrumentFeed(null), ...over})
const entryOf = (entries, family, id) => entries.find(entry => entry.family === family && entry.face.id === id)
const params = markup => [...markup.matchAll(/data-param="([^"]+)"/g)].map(match => match[1])
const deviceHost = await import('../src/frame/devices/deviceHost.tsx')
/** A whole plate on every one of its pages (DEVICE-UI §1: pages in its head, never a scroller), turned through the host. */
const everyPage = (id, draw) => {
  const pages = []
  for (let at = 1; at <= 8; at++) {
    deviceHost.setHostPage(id, `p${at}`)
    const markup = draw()
    pages.push(markup)
    if ((markup.match(/role="tab"/g) ?? []).length <= at) break
  }
  deviceHost.setHostPage(id, 'p1')
  return pages.join('\n')
}

beforeEach(() => {
  torus.publishLiveTorusState(null)
  torus.setLiveInstrumentCommander(null)
  publishAtlasHandle(null)
})

// ── the rows: the family's declared rows, not a second copy ────────────────────────────────────────────────────────

test('the rows the atlas and knowledge devices draw are the families\' declared rows — a drift fails here', () => {
  for (const [family, restated] of [['atlas-earth', atlasDevs.ATLAS_DECLARED_ROWS], ['knowledge-graph', knowledgeDevs.KNOWLEDGE_DECLARED_ROWS]]) {
    const registered = sdkDefine.sdkParamRows(family)
    assert.equal(restated.length, registered.length, `${family}: the same number of rows`)
    for (const row of restated) {
      const found = registered.find(r => r.deviceInstance === row.deviceInstance && r.key === row.key)
      assert.ok(found, `${family}/${row.deviceInstance}/${row.key} is declared`)
      for (const field of ['title', 'type', 'writePath']) assert.equal(row[field], found[field], `${row.key}.${field}`)
      assert.deepEqual(row.values, found.values, `${row.key}.values`)
      assert.deepEqual(row.range, found.range, `${row.key}.range`)
    }
  }
})

test('every declared face is a device whose Live semantic, invariant, holders and note are the family\'s own', () => {
  for (const family of ['quaternal-logic', 'atlas-earth', 'knowledge-graph']) {
    for (const face of inhabitantManifest(family).faces) {
      const declaration = faces.techneFaceDeclaration(face)
      assert.equal(declaration.liveSemantic, face.liveSemantic, `${face.id} keeps its semantic`)
      assert.deepEqual(declaration.invariant, face.invariant)
      assert.deepEqual(declaration.heldBy, face.heldBy)
      assert.equal(declaration.note, face.note)
      assert.notEqual(declaration.title, face.id, `${face.id} has a human name`)
    }
  }
})

// ── the atlas ──────────────────────────────────────────────────────────────────────────────────────────────────────

test('the atlas devices read the one mounted atlas; compact shows at most four controls; a set is one switch per member', async () => {
  const graph = new FakeGraph({local: true})
  await mounted(atlasHandle({graph}), () => {
    const entries = chain.techneEntries(INSTRUMENTS(), readings({atlas: atlasDevs.atlasReading(atlasHandle({graph}), 'graph')}))
    const tools = entryOf(entries, 'atlas-earth', 'graph-tools').device
    assert.equal(tools.id, 'atlas-earth:graph-tools')
    assert.equal(lightOf(tools), 'on', 'the graph is open: the owner reports it')
    assert.deepEqual(compactRows(tools.rows).map(row => row.key), ['depth', 'occurrences', 'sky-anchors', 'centre'])
    assert.equal(tools.values.depth, '1', 'the steps stepper shows the graph\'s own steps')
    for (const kind of ['archetype', 'theoretic', 'family']) assert.equal(tools.values[`kinds:${kind}`], true)
    for (const basis of DEFAULT_TIE_BASES) assert.equal(tools.values[`ties:${basis.id}`], true, `a switch per relation basis: ${basis.id}`)
    assert.ok(tools.rows.filter(row => row.key.startsWith('kinds:')).every(row => row.type === 'boolean' && row.writePath === 'shell.setAtlasKinds'), 'a switch writes the row\'s own path')
    for (const entry of entries.filter(e => e.family === 'atlas-earth')) {
      const compact = html(createElement(DeviceView, {device: entry.device, size: 'compact', picture: entry.picture('compact')}))
      assert.ok(params(compact).length <= 4, `${entry.face.id}: at most four controls on the rack`)
      assert.match(compact, new RegExp(`data-atlas-face="${entry.face.id}"`), `${entry.face.id}: its body is its picture`)
    }
  })
})

test('a write to the atlas goes through the owner\'s setter: sets whole, steps as numbers, refusals in the owner\'s words', async () => {
  const graph = new FakeGraph({local: true})
  await mounted(atlasHandle({graph}), async () => {
    const tools = atlasDevs.atlasDevice(faceOf('atlas-earth', 'graph-tools'), atlasDevs.atlasReading(atlasHandle({graph}), 'graph'))
    await tools.submit([{key: 'kinds:family', value: false}])
    assert.deepEqual(graph.state.kinds, {archetype: true, theoretic: true, family: false}, 'one switch writes the whole set, the others as they stood')
    await tools.submit([{key: 'ties:site', value: false}])
    assert.ok(!graph.state.ties.includes('site') && graph.state.ties.includes('jung'))
    await tools.submit([{key: 'depth', value: '3'}])
    assert.equal(graph.state.depth, 3, 'the stepper\'s label reaches the graph as the number it names')
    await tools.submit([{key: 'repel', value: 1.25}])
    assert.equal(graph.state.forces.repel, 1.25)
    await assert.rejects(tools.submit([{key: 'centre', value: 99}]), /refuses/, 'a value outside the domain is refused, not clamped')
    assert.equal(graph.state.forces.centre, DEFAULT_FORCES.centre, 'and nothing moved')
  })
})

test('with no atlas mounted, or no graph opened, a control has no write path and says why; the light is dark', () => {
  const none = atlasDevs.atlasDevice(faceOf('atlas-earth', 'graph-tools'), atlasDevs.atlasReading(null, 'earth'))
  assert.ok(none.rows.every(row => !row.writePath), 'nothing to write to')
  assert.match(none.rows.find(row => row.key === 'occurrences').disclosure, /has not mounted/)
  assert.notEqual(lightOf(none), 'on')
  const unopened = atlasDevs.atlasDevice(faceOf('atlas-earth', 'graph-tools'), atlasDevs.atlasReading(atlasHandle({graph: null}), 'earth'))
  assert.match(unopened.rows.find(row => row.key === 'occurrences').disclosure, /has not been opened/)
  assert.equal(lightOf(unopened), 'off', 'the atlas stands and reports the graph unopened')
  const view = atlasDevs.atlasDevice(faceOf('atlas-earth', 'mode-switch'), atlasDevs.atlasReading(null, 'graph'))
  assert.equal(view.rows[0].writePath, 'shell.setAtlasView', 'the view mirror takes a choice before the Earth has mounted')
  assert.equal(view.values.view, 'graph')
})

test('the deep-time cursor shows what moves it while the clock plays, and the hand-back light stops the clock', async () => {
  const time = new TimeModel()
  const handle = atlasHandle({time})
  await mounted(handle, async () => {
    assert.equal(time.play(), null)
    const device = atlasDevs.atlasDevice(faceOf('atlas-earth', 'time-control'), atlasDevs.atlasReading(handle, 'earth'))
    assert.deepEqual(device.heldBy, {cursor: 'the clock, playing'})
    assert.deepEqual(compactRows(device.rows).map(row => row.key), ['cursor', 'all-time', 'play', 'cumulative'])
    const markup = html(createElement(DeviceView, {device, size: 'compact'}))
    assert.match(markup, /data-held-by="the clock, playing"/)
    await device.handBack('cursor')
    assert.equal(time.playing, false, 'the hand-back gives the cursor back by stopping the clock')
    const still = atlasDevs.atlasDevice(faceOf('atlas-earth', 'time-control'), atlasDevs.atlasReading(handle, 'earth'))
    assert.equal(still.heldBy, undefined)
  })
})

test('the globe\'s whole-field choice is a write only while a mode\'s set stands aside', async () => {
  const none = atlasDevs.atlasDevice(faceOf('atlas-earth', 'globe-engine'), atlasDevs.atlasReading(atlasHandle(), 'earth'))
  assert.equal(none.rows[0].writePath, undefined)
  assert.match(none.rows[0].disclosure, /no whole-field choice/)
  const handle = atlasHandle({scope: {label: 'Jung\'s archetypes'}})
  await mounted(handle, async () => {
    const aside = atlasDevs.atlasDevice(faceOf('atlas-earth', 'globe-engine'), atlasDevs.atlasReading(handle, 'earth'))
    assert.equal(aside.rows[0].writePath, 'shell.setAtlasWholeField')
    await aside.submit([{key: 'whole-field', value: true}])
    assert.equal(handle.engine.whole, true)
  })
})

// ── the knowledge graph ────────────────────────────────────────────────────────────────────────────────────────────

test('the knowledge devices read the open graph; named choices go back as the ids the owner takes; sets write whole', async () => {
  const graph = fakeKnowledge({filters: {scope: 'local', depth: 2, kinds: []}})
  const scope = knowledgeDevs.knowledgeDevice(faceOf('knowledge-graph', 'knowledge-scope'), graph)
  assert.equal(scope.values.scope, 'Selected subject')
  assert.equal(scope.values.depth, '2')
  assert.equal(lightOf(scope), 'on')
  await handleStoreWrite(graph, () => scope.submit([{key: 'scope', value: 'Available field'}]))
  assert.deepEqual(graph.calls.pop(), ['patch', {scope: 'field'}])
  await handleStoreWrite(graph, () => scope.submit([{key: 'direction', value: 'Incoming / backlinks'}]))
  assert.deepEqual(graph.calls.pop(), ['patch', {direction: 'incoming'}], 'the panel\'s name goes back as the id the owner takes')
  await handleStoreWrite(graph, () => scope.submit([{key: 'depth', value: '3'}]))
  assert.deepEqual(graph.calls.pop(), ['patch', {depth: 3}], 'the depth stepper\'s label reaches the graph as the number it names')
  const filters = knowledgeDevs.knowledgeDevice(faceOf('knowledge-graph', 'knowledge-filters'), graph)
  assert.deepEqual(filters.rows.filter(row => row.key.startsWith('kinds:')).map(row => row.key), ['kinds:wiki-node', 'kinds:file', 'kinds:skill'], 'the kinds the open reading holds')
  assert.ok(filters.rows.filter(row => row.key.startsWith('kinds:')).every(row => filters.values[row.key] === true), 'an empty set shows every kind: every switch stands on')
  await handleStoreWrite(graph, async () => filters.submit([{key: 'kinds:file', value: false}]))
  assert.deepEqual(graph.calls.pop(), ['patch', {kinds: ['wiki-node', 'skill']}])
  const text = filters.rows.find(row => row.key === 'text')
  assert.equal(text.writePath, undefined, 'the runtime draws no text field: Find is a reading here and typed in the body')
  const display = knowledgeDevs.knowledgeDevice(faceOf('knowledge-graph', 'knowledge-display'), graph)
  assert.deepEqual(compactRows(display.rows).map(row => row.key), ['labels', 'arrows', 'zoom'])
})

/** Publish the graph as the open surface does while the write runs (the owner's setter reads the published handle). */
async function handleStoreWrite(graph, write) {
  const token = {}
  handleStore.publishKnowledgeGraphHandle(token, graph)
  try { await write() } finally { handleStore.publishKnowledgeGraphHandle(token, null) }
}

test('a full set is written as the empty set, the owner\'s encoding of "every member shows"', async () => {
  const graph = fakeKnowledge({filters: {kinds: ['wiki-node', 'skill']}})
  const filters = knowledgeDevs.knowledgeDevice(faceOf('knowledge-graph', 'knowledge-filters'), graph)
  assert.equal(filters.values['kinds:file'], false)
  await handleStoreWrite(graph, () => filters.submit([{key: 'kinds:file', value: true}]))
  assert.deepEqual(graph.calls.pop(), ['patch', {kinds: []}])
})

test('depth is a write only in a local view; with no graph open every control is a reading that says so', () => {
  const field = knowledgeDevs.knowledgeDevice(faceOf('knowledge-graph', 'knowledge-scope'), fakeKnowledge({filters: {scope: 'field'}}))
  assert.equal(field.rows.find(row => row.key === 'depth').writePath, undefined)
  assert.match(field.rows.find(row => row.key === 'depth').disclosure, /local view/)
  const closed = knowledgeDevs.knowledgeDevice(faceOf('knowledge-graph', 'knowledge-scope'), null)
  assert.ok(closed.rows.every(row => !row.writePath))
  assert.match(closed.rows[0].disclosure, /not open in this session/)
  const unloaded = knowledgeDevs.knowledgeDevice(faceOf('knowledge-graph', 'knowledge-filters'), fakeKnowledge({loaded: false}))
  assert.match(unloaded.rows.find(row => row.key === 'kinds').disclosure, /still reading its subjects/)
  assert.ok(unloaded.rows.every(row => !row.key.includes(':')), 'no switches until the reading holds the kinds')
})

// ── the QL owner and its waiting kin ───────────────────────────────────────────────────────────────────────────────

test('the QL field/PCM owner is a device: its light is the owner\'s availability, its writes the hosted stage channel\'s edits', async () => {
  const face = faceOf('quaternal-logic', 'ql-instrument')
  const absent = qlDevs.qlInstrumentDevice(face, null)
  assert.equal(lightOf(absent), 'unknown')
  assert.ok(absent.rows.every(row => !row.writePath), 'no owner, no write')
  const held = qlDevs.qlInstrumentDevice(face, validState('manual'))
  assert.ok(held.rows.filter(row => ['sound', 'level', 'cadence', 'scale'].includes(row.key)).every(row => !row.writePath && /follows or is held/.test(row.disclosure)))
  const state = validState('following')
  const device = qlDevs.qlInstrumentDevice(face, state)
  assert.equal(lightOf(device), 'on')
  assert.deepEqual(compactRows(device.rows).map(row => row.key), ['sound', 'level', 'cadence', 'scale'])
  assert.ok(compactRows(device.rows).every(row => row.writePath === qlDevs.QL_WRITE_PATH))
  assert.equal(device.values.sound, false, 'the owner is muted: sound is off')
  assert.equal(device.values.cadence, '12 ticks/s')
  assert.equal(device.values.scheduled, 30)
  const sent = []
  torus.setLiveInstrumentCommander(async command => { sent.push(command); return {ok: true} })
  await device.submit([{key: 'sound', value: true}, {key: 'level', value: 2}, {key: 'cadence', value: 'Hold'}, {key: 'scale', value: 200}])
  assert.deepEqual(sent.map(command => command.edit), [
    {kind: 'muted', muted: false}, {kind: 'level', value: 2}, {kind: 'cadence', rate: 'hold'}, {kind: 'scale', units_per_metre: 200},
  ], 'each is the owner\'s own instrument edit')
  torus.setLiveInstrumentCommander(async () => ({ok: false, error: 'the owner refused level 9'}))
  await assert.rejects(device.submit([{key: 'level', value: 3}]), /the owner refused level 9/)
})

test('a face declared waiting is a dark device with no control: its standing and the owner it waits for', () => {
  // The sky is admitted (lane BL): it reads the kernel's nara_identity transit and draws the catalogue's Sky design.
  assert.notEqual(faceOf('quaternal-logic', 'sky').admission, 'waiting', 'the sky draws on its owner')
  assert.notEqual(faceOf('quaternal-logic', 'm3-clock').admission, 'waiting', 'the M3 clock draws on its owner (m3_reception)')
  // T-WORLDS W4: the Deck reads the open journey (nara_journey), the Chakra your elements (nara_elemental).
  assert.notEqual(faceOf('quaternal-logic', 'deck').admission, 'waiting', 'the Deck draws on its owner (nara_journey)')
  assert.notEqual(faceOf('quaternal-logic', 'chakra').admission, 'waiting', 'the Chakra draws on its owner (nara_elemental)')
  for (const id of ['torus', 'm-prime-matrices']) {
    const face = faceOf('quaternal-logic', id)
    assert.equal(face.admission, 'waiting')
    const device = chain.techneEntries(manifests('quaternal-logic'), readings()).find(entry => entry.face.id === id).device
    assert.equal(lightOf(device), 'unknown', `${id}: nothing is illuminated`)
    assert.ok(device.rows.every(row => !row.writePath), `${id}: no control`)
    assert.equal(device.values.standing, 'waiting')
    assert.equal(device.rows.find(row => row.key === 'waits-for').disclosure, face.note, `${id}: the family\'s own note names the owner`)
  }
})

// ── the chain: compact devices, no text-only card ──────────────────────────────────────────────────────────────────

test('the focused 0 instrument stands open as one plate of the faces it holds, the other five fold by the runtime\'s fold, in rack order', () => {
  const out = html(createElement(TechneInstrumentsDetail, {transport, focusInstrument: 'techne:m0'}))
  assert.match(out, /data-focus-instrument="techne:m0"/)
  assert.match(out, /data-open-instrument="techne:m0"/)
  assert.match(out, /class="inst-plate" data-instrument="techne:m0" data-expanded="true" data-project-plate="true"/, 'the open instrument is one plate')
  assert.match(out, /<header class="dp-head dp-head--plate"[^>]*>.*?<span class="dp-title">Project<\/span>/, 'the kit\'s head, its plain name, never its M′ address (lock §9.4)')
  assert.doesNotMatch(out, /aria-label="Fold Project"/, 'a double-click on its head folds it to its title, as in Live (manual §16.4); the head has no fold button')
  assert.match(out, /data-section="display"[^>]*><div class="dp-display"/, 'its well stands first, in a section of its own (DEVICE-UI §4.2, §7)')
  // lane E: the globe, Graph tools, Earth ⇄ Graph and Deep time are its sections' controls, not three boxed sub-devices
  const sections = ['view', 'graph', 'forces', 'time'].map(id => out.indexOf(`data-section="${id}"`))
  assert.ok(sections.every((at, index) => at > 0 && (index === 0 || at > sections[index - 1])), 'View, Graph, Forces, Deep time, in order')
  for (const id of ['globe-engine', 'graph-tools', 'mode-switch', 'time-control']) {
    assert.match(out, new RegExp(`class="plate-held-mark" data-device="atlas-earth:${id}"`), `${id} stands as its mark: every setting above the chain, full size in a pane`)
  }
  assert.doesNotMatch(out, /data-device-size="compact"/, 'no device plate is boxed inside the instrument')
  const order = ['techne:m0', 'techne:m1', 'techne:m2', 'techne:m3', 'techne:m4', 'techne:m5'].map(id => out.indexOf(`data-instrument="${id}"`))
  assert.ok(order.every((at, index) => at >= 0 && (index === 0 || at > order[index - 1])), 'the six stand in their order')
  for (const id of ['techne:m1', 'techne:m2', 'techne:m3', 'techne:m4', 'techne:m5']) {
    assert.match(out, new RegExp(`data-instrument="${id}" data-expanded="false"`), `${id} folds`)
  }
  assert.equal((out.match(/data-rack="strip"[^>]*><section class="dp-folded"/g) ?? []).length, 5, 'each fold is the kit\'s own (panel.tsx Folded), not a private strip')
  assert.doesNotMatch(out, /techne-device-unfold/, 'no private fold is drawn')
  assert.doesNotMatch(out, /data-face-id="sky"/, 'a face another instrument holds stands inside that instrument\'s fold')
  assert.doesNotMatch(out, /inhabitant-card|data-inhabitant-rack|docks when its material is selected/, 'no rack card is drawn')
})

test('with no focus the six fold and the faces no instrument holds stand after them: the QL owner open, the waiting faces folded', () => {
  const out = html(createElement(TechneInstrumentsDetail, {transport}))
  assert.doesNotMatch(out, /data-focus-instrument/)
  assert.equal((out.match(/data-instrument="techne:m\d" data-expanded="false"/g) ?? []).length, 6, 'all six instruments fold')
  assert.match(out, /data-face-id="ql-instrument"[^>]*data-expanded="true"/)
  assert.match(out, /data-device="quaternal-logic:ql-instrument" data-device-size="compact"/)
  assert.match(out, /data-ql-instrument/, 'the owner\'s body is its picture')
  assert.match(out, /data-face-id="m-prime-matrices"[^>]*data-expanded="false"/)
  assert.match(out, /class="dp-folded-title"[^>]*aria-label="Unfold M′ matrices"/, 'a folded device opens from its title, by the kit\'s fold')
  assert.doesNotMatch(out, /data-face-id="deck"/, 'the Deck is the Journey\'s, inside its fold (T-WORLDS W4)')
  assert.doesNotMatch(out, /data-face-id="graph-tools"/)
  assert.doesNotMatch(out, /data-face-id="sky"/, 'the sky is the Timeline\'s and the World\'s, inside their folds')
})

test('a fold\'s press holds across the focus change it causes: M4′ pressed from another pane stays open once the Earth takes focus (lane T, 15 Oct)', () => {
  // Pressing M4′ while the stage (M1) is focused opens the Earth pane; the focus then stands the Earth's own instrument (M0). The press
  // is recorded against that focus, so M4′ is the open plate when it arrives — not folded again behind M0.
  assert.equal(chain.focusAfterOpening('techne:m4', 'techne:m1'), 'techne:m0')
  assert.equal(chain.focusAfterOpening('techne:m4', null), 'techne:m0', 'from no focused instrument, too')
  assert.equal(chain.focusAfterOpening('techne:m4', 'techne:m0'), 'techne:m0', 'the Earth already focused keeps its focus')
  assert.equal(chain.focusAfterOpening('techne:m2', 'techne:m0'), 'techne:m2', 'a stage lens stands itself once the stage takes it')
  assert.equal(chain.focusAfterOpening('knowledge-graph', 'techne:m1'), 'techne:m1', 'an instrument with no door leaves the focus as it is')
})

test('a fold opens its instrument: the door each instrument opens through is the pane that holds it', () => {
  assert.deepEqual(chain.instrumentDoorOf('techne:m0'), {kind: 'projection.earth'}, 'the Earth pane is the 0 instrument')
  assert.deepEqual(chain.instrumentDoorOf('techne:m1'), {kind: 'projection.expressions', lens: 'canvas'})
  // T-PLACES-ONTO-ATLAS: M4′ World / Places is the atlas, alone (FOUNDATION §4) — it opens the Earth pane, never the stage's lens
  assert.deepEqual(chain.instrumentDoorOf('techne:m4'), {kind: 'projection.earth'}, 'Places is the atlas')
  // T-PALACES-ONTO-ATLAS: palaces live in the atlas (FOUNDATION §3 N4) — M5′ opens the Earth pane too, never the stage's retired lens
  // (atlas-palaces-plate.test.mjs pins the press holding across the focus it causes)
  assert.deepEqual(chain.instrumentDoorOf('techne:m5'), {kind: 'projection.earth'}, 'a palace is a place on the world you enter')
  assert.equal(chain.instrumentDoorOf('knowledge-graph'), null)
  assert.deepEqual(chain.rackInstruments('knowledge-graph').map(holder => holder.id), ['knowledge-graph'], 'the knowledge graph stands alone')
  assert.deepEqual(chain.rackInstruments(null).map(holder => holder.id), ['techne:m0', 'techne:m1', 'techne:m2', 'techne:m3', 'techne:m4', 'techne:m5'])
})

test('a focused Timeline stands the sky and the M3 clock open beside the clock, dark until their owners read', () => {
  const out = html(createElement(InstrumentDeviceDetail, {transport, instrument: 'techne:m2'}))
  for (const id of ['sky', 'm3-clock']) {
    assert.match(out, new RegExp(`data-face-id="${id}"[^>]*data-expanded="true"`))
    assert.match(out, new RegExp(`data-device="quaternal-logic:${id}"[^>]*data-device-light="unknown"`), `${id}: dark`)
  }
  // Both now draw on their owners (the sky's transit, the M3 form's m3_reception): neither stands as a waiting face.
  assert.doesNotMatch(out, /data-face-id="m3-clock"[^>]*data-waiting="true"/)
})

test('the knowledge graph\'s devices stand open on its own chain, each with its body, and Central\'s lead them', () => {
  const out = html(createElement(InstrumentDeviceDetail, {transport, instrument: 'knowledge-graph'}))
  for (const [id, title] of [['knowledge-scope', 'Scope'], ['knowledge-filters', 'Filters'], ['knowledge-display', 'Display']]) {
    assert.match(out, new RegExp(`data-face-id="${id}"[^>]*data-expanded="true"`))
    assert.match(out, new RegExp(`data-device="knowledge-graph:${id}" data-device-size="compact"`))
    assert.match(out, new RegExp(`data-knowledge-face="${id}"`))
    assert.match(out, new RegExp(`<span class="dp-title">${title}</span>`))
  }
  assert.doesNotMatch(out, /graph-tools|data-mode-detail="techne-instruments"/)
  const led = html(createElement(InstrumentDeviceDetail, {transport, instrument: 'techne:m2', centralDevices: true}))
  assert.match(led, /data-central-devices="true"/)
  assert.ok(led.indexOf('data-family="central"') < led.indexOf('data-device="atlas-earth:time-control"'), 'Central\'s devices lead, the instrument follows')
})

test('the QL owner\'s standing and the reader\'s named reason reach the device\'s picture, verbatim', () => {
  torus.publishLiveTorusState(null)
  const absent = html(createElement(TechneInstrumentsDetail, {transport}))
  assert.match(absent, /data-ql-standing="refusing"/)
  assert.match(absent, /data-named-reason="absent"/)
  torus.publishLiveTorusState(validState('following'))
  const following = html(createElement(TechneInstrumentsDetail, {transport}))
  assert.match(following, /data-ql-standing="following"/)
  assert.match(following, /data-ql-instrument[^>]*data-state="following"[^>]*data-available="yes"/)
  assert.match(following, /data-device-light="on"/)
  assert.match(following, /data-ql-control="muted"/, 'the one control the stage carries is on the body')
  assert.doesNotMatch(following, /data-ql-control="hold"|data-ql-control="recover"/, 'hold and recover have no path in this host and are not drawn')
  // The owner stands where its holder is (Body · 3:3): focused on that holder, the rack reads the same reader; a Technē instrument
  // that does not hold it does not draw it.
  torus.publishLiveTorusState(validState('held'))
  const held = html(createElement(TechneInstrumentsDetail, {transport, focusInstrument: 'studio:body'}))
  assert.match(held, /data-face-id="ql-instrument"[^>]*data-expanded="true"/)
  assert.match(held, /data-ql-standing="held"/)
  assert.doesNotMatch(html(createElement(InstrumentDeviceDetail, {transport, instrument: 'techne:m0', centralDevices: true})), /data-face-id="ql-instrument"/)
})

// ── one device, three sizes, one door ──────────────────────────────────────────────────────────────────────────────

test('a device is published by id: chosen, it is whole in its band; opened, it is full in a pane — the same device, the same settings', async () => {
  const graph = new FakeGraph({local: true})
  await mounted(atlasHandle({graph}), () => {
    const entries = chain.techneEntries(INSTRUMENTS(), readings({atlas: atlasDevs.atlasReading(atlasHandle({graph}), 'graph')}))
    const mine = new Map()
    chain.publishTechneEntries(entries, mine)
    const id = 'atlas-earth:graph-tools'
    const entry = entryOf(entries, 'atlas-earth', 'graph-tools')
    assert.equal(deviceDoor.publishedDevice(id).device, entry.device, 'the door holds the very device the chain draws')
    deviceDoor.selectDevice(id)
    const pool = everyPage(id, () => html(createElement(WholeBand)))
    assert.match(pool, new RegExp(`data-device-frame="flip"[\\s\\S]*data-device="${id}"`))
    assert.match(pool, /data-device-size="whole"/)
    assert.match(pool, /data-atlas-face="graph-tools"/, 'the body is the picture in the band')
    assert.deepEqual(params(pool), entry.device.rows.filter(row => row.key !== entry.device.enabledKey).map(row => row.key), 'the pool shows every setting, grouped, on its pages')
    const pane = html(createElement(DeviceFullPane, {id}))
    assert.match(pane, /data-device-size="full"/)
    assert.match(pane, /data-atlas-face="graph-tools"/, 'the pane is the device\'s own body')
    assert.deepEqual(params(pane), [], 'and holds no controls: they stay in Device view (DLW §16.1)')
    const compact = params(html(createElement(DeviceView, {device: entry.device, size: 'compact'})))
    assert.ok(compact.every(key => params(pool).includes(key)), 'every compact control is a setting of the whole device')
    for (const group of ['Steps', 'Kinds', 'Relations', 'Sky', 'Forces']) assert.match(pool, new RegExp(`class="dp-sec-label">${group}<`))
    chain.withdrawTechneEntries(mine)
    assert.equal(deviceDoor.publishedDevice(id), undefined, 'withdrawn with the chain')
    deviceDoor.selectDevice(null)
  })
})

test('a chain withdraws only what it published: a newer chain of the same device keeps its own', () => {
  const entries = chain.techneEntries(INSTRUMENTS(), readings())
  const first = new Map(), second = new Map()
  chain.publishTechneEntries(entries, first)
  const newer = chain.techneEntries(INSTRUMENTS(), readings())
  chain.publishTechneEntries(newer, second)
  chain.withdrawTechneEntries(first)
  assert.ok(deviceDoor.publishedDevice('quaternal-logic:ql-instrument'), 'the newer chain\'s device stands')
  chain.withdrawTechneEntries(second)
  assert.equal(deviceDoor.publishedDevice('quaternal-logic:ql-instrument'), undefined)
})

test('the chain publishes through the door and opens a pane through the instrument door, in source', async () => {
  const {readFile} = await import('node:fs/promises')
  const source = await readFile(new URL('../src/inhabitants/ql/devices/TechneDevices.tsx', import.meta.url), 'utf8')
  assert.match(source, /usePublished\(entries\)/, 'the chain publishes while it stands')
  assert.match(source, /selectDevice\(device\.id\)/, 'choosing a device selects it (its Whole stands in its band)')
  assert.match(source, /openInstrument\(DEVICE_PANE_KIND, undefined, \{ref: device\.id, title\}\)/, 'opening a device puts it in a pane')
})

test('a set row\'s switches round-trip: the key names the row and the member', () => {
  assert.deepEqual(rowSets.memberOf(rowSets.memberKey('kinds', 'wiki-node')), {row: 'kinds', member: 'wiki-node'})
  assert.equal(rowSets.memberOf('depth'), null)
  assert.deepEqual(rowSets.changedSet(['a', 'b', 'c'], ['c', 'a'], [{member: 'b', on: true}, {member: 'a', on: false}]), ['b', 'c'], 'the declared order, with each change applied')
})
