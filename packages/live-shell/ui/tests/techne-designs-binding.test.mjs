// Lane W4-Technē (T-COVERAGE §1.4): the unbound designs of Technē and the knowledge graph on their owners (src/techne/devices/**) —
// techne:palace on the palace session, knowledge-graph:graph on the open graph's handle and the kernel graph op, techne:journey,
// techne:timeline and techne:canvas on the research frame as it announces itself (and the session's shared window), techne:light and
// techne:lens on no reachable owner — and where they stand: the head of the open instrument's chain, then its effects (manual §16.2).
//
// Channels:
// - REAL (tests/fixtures/knowledge-graph-reading-2026-10-21.json): the kernel graph op's answer for the root register's wiki, read
//   read-only on workcell:mac through the seat's walk bridge (POST /op {op: graph, …}).
// - FIXTURE, owner-shaped: the palace session over owners standing in for the live ones (the documents of atlas-palaces-session.test.mjs,
//   the shapes the kernel's expression op and the owner's reading return); the frame's announced state and chrome (HostedAppState,
//   FrameChromeReading in the frame's own control words, researchInstruments.tsx :882-889, :1355-1357); the open graph's handle.
// - SCRIPTED: each catalogue design rendered through the runtime's host (deviceHost.HostedDevice) to static markup, on its binding.
// No owner state is written: every write here goes to a stand-in act, a stand-in runner or a stand-in setter, or is refused.
import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'
import {readFileSync} from 'node:fs'

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
  if (u.endsWith('.css')) return {format: 'module', shortCircuit: true, source: 'export default null'};
  if (u.includes('?raw') || u.includes('.html')) return {format: 'module', shortCircuit: true, source: 'export default ""'};
  if (u.endsWith('.json')) return {format: 'module', shortCircuit: true, source: 'export default ' + await readFile(new URL(u), 'utf8')};
  if (!u.endsWith('.ts') && !u.endsWith('.tsx')) return n(u, c);
  const out = ts.transpileModule(await readFile(new URL(u), 'utf8'), {fileName: new URL(u).pathname,
    compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX}}).outputText;
  return {format: 'module', shortCircuit: true, source: out.split('import.meta.env').join('({BASE_URL: "/"})')};
}`)}`, import.meta.url)

globalThis.__CRADLE_WALK__ = false
const {createElement} = await import('react')
const {renderToStaticMarkup} = await import('react-dom/server')
const door = await import('../src/inhabitants/familyManifest.ts')
const world = await import('../src/inhabitants/worldShellFamilies.ts')
const {designKey, isRegisteredDesign} = await import('../src/frame/devices/designs.ts')
const host = await import('../src/frame/devices/deviceHost.tsx')
const devices = await import('../src/techne/devices/designDevices.ts')
const designs = await import('../src/techne/devices/techneDesigns.ts')
const palaceB = await import('../src/techne/devices/palaceBinding.ts')
const graphB = await import('../src/techne/devices/graphBinding.ts')
const graphRead = await import('../src/techne/devices/graphRead.ts')
const frameB = await import('../src/techne/devices/frameBindings.ts')
const effects = await import('../src/techne/devices/effectBindings.ts')
const chain = await import('../src/inhabitants/ql/devices/TechneDevices.tsx')
const {InstrumentDeviceDetail} = await import('../src/shell/ModeDetail.tsx')
const session = await import('../src/projections/atlas/palaces/palaceSession.ts')
const {provingReading} = await import('../../../../desktop/cradle/src/techne/m0m5/journey/proving-reading.ts')
const {createDisclosureSessionStore} = await import('../../../../desktop/cradle/src/techne/session.ts')
const {resetPalaceCompositions} = await import('../../../../desktop/cradle/src/techne/m0m5/palace/palace-state.ts')
const {regionSceneRef} = await import('../../../../desktop/cradle/src/techne/m0m5/palace/composition.ts')
const cradleFilters = await import('../../../../desktop/cradle/src/knowledge/filters.ts')
const {instantOfYear, windowEdgeYear} = await import('../src/projections/atlas/sharedClock.ts')
const DESIGNS = {
  palace: (await import('../src/inhabitants/catalogue/panels/techne__palace.tsx')).design,
  journey: (await import('../src/inhabitants/catalogue/panels/techne__journey.tsx')).design,
  timeline: (await import('../src/inhabitants/catalogue/panels/techne__timeline.tsx')).design,
  canvas: (await import('../src/inhabitants/catalogue/panels/techne__canvas.tsx')).design,
  light: (await import('../src/inhabitants/catalogue/panels/techne__light.tsx')).design,
  lens: (await import('../src/inhabitants/catalogue/panels/techne__lens.tsx')).design,
  graph: (await import('../src/inhabitants/catalogue/panels/knowledge-graph__graph.tsx')).design,
}

door.resetFamilyManifestsForTest()
world.loadWorldShellFamilies()

const REAL = JSON.parse(readFileSync(new URL('./fixtures/knowledge-graph-reading-2026-10-21.json', import.meta.url), 'utf8'))
const read = path => readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8')
const views = ['folded', 'compact', 'whole', 'full', 'widget']
const escaped = text => text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const transport = {kind: 'unavailable', reason: 'the test carrier is down'}

/** The pages each design's Whole declares (its `pages`), by design. */
const PAGES = {'techne:journey': ['walk', 'seams'], 'techne:timeline': ['lens', 'filters'], 'techne:canvas': ['board', 'lines', 'form'], 'techne:lens': ['lens', 'frame'],
  'knowledge-graph:graph': ['reach', 'filters', 'display', 'aperture']}
const pagesOf = design => PAGES[design.id] ?? []
function hostedAll(design, binding) {
  const out = views.filter(view => view !== 'whole').map(view => [view, renderToStaticMarkup(createElement(host.HostedDevice, {designed: design, binding, view, nav: {}}))])
  const pages = pagesOf(design)
  for (const page of pages.length ? pages : ['']) {
    host.setHostPage(binding.id, page)
    out.push(['whole', renderToStaticMarkup(createElement(host.HostedDevice, {designed: design, binding, view: 'whole', nav: {}}))])
  }
  host.resetHost(binding.id)
  return out
}

/** The keys a design reads: its defaults and every fixture's keys. */
const keysOf = design => [...new Set([...Object.keys(design.defaults), ...Object.values(design.fixtures ?? {}).flatMap(fixture => Object.keys(fixture))])]
/** The keys a design's controls set, read from its source (`p.set('key'` and `p.set(\`key:${…}\``). */
function setKeysOf(file) {
  const source = read(`inhabitants/catalogue/panels/${file}`)
  return [...new Set([...source.matchAll(/\bp\.set\('([^']+)'/g)].map(m => m[1]).concat([...source.matchAll(/\bp\.set\(`([a-z.]+):\$\{/g)].map(m => `${m[1]}:0`)))]
}

/** (b): each key is an owner reading, absent with a reason, or a local hold. Returns the classification. */
function classify(design, binding, absentWhy) {
  const out = {reading: [], absent: [], local: []}
  for (const key of keysOf(design)) {
    if (key in binding.values) { out.reading.push(key); continue }
    if (binding.local && key in binding.local) { out.local.push(key); continue }
    const why = binding.standing?.[key]?.disabled ?? binding.standing?.[key]?.refused ?? absentWhy?.(key)
    assert.ok(typeof why === 'string' && why.length > 8, `${design.id} ${key}: absent with no reason`)
    assert.doesNotMatch(why, /undefined|NaN/, `${design.id} ${key}: the reason is words`)
    out.absent.push(key)
  }
  return out
}

// ---------------------------------------------------------------------------------------------------------------- the palace session

const EXPR = 'expression:techne-m0.central.abc'
const OVERVIEW = `${EXPR}:scene:overview`, STONE = `${EXPR}:scene:c1`, TOWER = `${EXPR}:scene:c2`
const PROJECTION = {overviewSceneRef: OVERVIEW, constellations: [{sceneRef: STONE}, {sceneRef: TOWER}]}
function documentAt(revision, regions = [{name: 'Walk', member: 'expression:walk'}]) {
  return {
    schema: 'oi.expression/v1', expression_ref: EXPR, revision, title: 'Central',
    scenes: [
      {scene_ref: OVERVIEW, revision: 1, title: 'Central', entity_refs: []},
      {scene_ref: STONE, revision: 1, title: 'The Stone', entity_refs: ['e1', 'e2']},
      {scene_ref: TOWER, revision: 1, title: 'The Tower', entity_refs: ['e3']},
      ...regions.map(region => ({scene_ref: regionSceneRef(EXPR, region.name), revision: 1, title: region.name, entity_refs: [],
        body: region.member ? {carrier: 'expression_ref', subject_ref: region.member} : null,
        triggers: region.member ? [{trigger_ref: `${EXPR}:trigger:region-${region.name}-portal`, occasion: 'activate', target: {kind: 'portal', subject_ref: region.member}}] : []})),
    ],
    entities: {
      e1: {entity_ref: 'e1', revision: 1, title: 'the carving', subject: {subject_ref: 'wiki:node:carving'}},
      e2: {entity_ref: 'e2', revision: 1, title: 'Mercurius', subject: {subject_ref: 'wiki:node:mercurius'}},
      e3: {entity_ref: 'e3', revision: 1, title: 'the tower, 1923', subject: {subject_ref: 'wiki:node:tower'}},
    },
  }
}
function readingAt(doc) {
  const reading = structuredClone(provingReading())
  reading.subject = {...reading.subject, subject_ref: EXPR}
  reading.reading_ref = `ql.techne:reading:${EXPR}@${doc.revision}`
  reading.expressions = doc.scenes.map(scene => ({expression_ref: EXPR, revision: String(doc.revision), scene_ref: scene.scene_ref}))
  return reading
}
const ROW = {key: 'central', title: 'Central', project: null, expression_ref: EXPR, revision: 4, held: true, standing: 'open', rooms: []}
function bindOwners() {
  const calls = {invoked: []}
  const doc = documentAt(4)
  const storage = {map: new Map(), getItem(key) { return this.map.get(key) ?? null }, setItem(key, value) { this.map.set(key, String(value)) }}
  session.bindPalaceOwners({
    inspect: async () => structuredClone(doc), readWhole: async () => readingAt(doc),
    list: async () => [{expression_ref: 'expression:walk', title: 'Walk', revision: 2}, {expression_ref: EXPR, title: 'Central', revision: 4}],
    edit: async () => ({state: 'refused'}), invoke: async request => { calls.invoked.push(request); return {state: 'dispatched', dispatch: {state: 'invoked', owner_operation: 'aikit.wiki.stage'}} },
    hold: async () => EXPR, projection: () => PROJECTION, storage: () => storage, session: createDisclosureSessionStore(),
    open: {expression: ref => `Opened ${ref}.`, scene: () => 'scene', subject: () => 'subject', instrument: () => 'instrument', source: () => 'source'},
  })
  return calls
}
async function enter() {
  session.resetPalaceSession()
  resetPalaceCompositions()
  devices.resetHolds()
  bindOwners()
  await session.enterPalace(ROW)
  await new Promise(resolve => setImmediate(resolve))
  return session.palaceState()
}

// ---------------------------------------------------------------------------------------------------------------- the frame

const control = (id, home, kind, label, extra = {}) => ({id, home, kind, label, ...extra})
const chromeFor = (lens, controls) => ({lens, controls})
const CANVAS_CHROME = chromeFor('canvas', [
  control('t-draw', 'canvas:tools', 'toggle', 'Draw', {pressed: false}), control('t-erase', 'canvas:tools', 'toggle', 'Erase', {pressed: false}),
  control('t-snap', 'canvas:tools', 'toggle', 'Snap', {pressed: true}), control('t-lasso', 'canvas:tools', 'toggle', 'Lasso', {pressed: false}),
  control('l-zoom', 'canvas:look', 'reading', '84%'), control('v-save', 'canvas:views', 'reading', 'saved'),
  control('l-overview', 'canvas:look', 'toggle', 'Hide overview', {pressed: true}),
])
const TIMELINE_CHROME = chromeFor('timeline', [
  control('m-chron', 'timeline:lens', 'toggle', 'Chronology', {pressed: false}), control('m-field', 'timeline:lens', 'toggle', 'Relations', {pressed: true}),
  control('m-refresh', 'timeline:lens', 'button', 'Refresh timeline'),
])
function frameOf(lens, {chrome = null, journey = {}, window, runs = []} = {}) {
  const state = {lens, document: {name: 'Field studies of the frame'}, ...journey, ...(chrome ? {chrome} : {})}
  return {state, run: async command => { runs.push(command); return {ok: true} }, window}
}
const LAW = written => ({yearOf: windowEdgeYear, instantOf: instantOfYear, write: window => { written.push(window); return null }})

// ---------------------------------------------------------------------------------------------------------------- the open graph

function fakeSurface(filters = {}) {
  return {filters: cradleFilters.restoreGraphFilters({scope: 'local', depth: 2, emphasis: [{id: 'g1', label: 'Sources', color: '#88aa66', text: '', kinds: ['file'], tags: [], enabled: true}], ...filters}),
    zoom: 1.5, domains: {kinds: ['wiki-node'], relations: ['node-source']}, counts: null, selected: 'wiki:node:identity',
    patchFilters() {}, setZoom() {}, fit() {}}
}
const answered = {status: 'answered', reading: REAL.outcome.reading, error: null, pending: [], nodes: 4096}

// ================================================================================================================ the tests

test('each design is keyed to the catalogue\'s exactly; none is registered over it; each has the views of its places (all six) and its kind', () => {
  const kinds = {palace: 'instrument', journey: 'instrument', timeline: 'instrument', canvas: 'instrument', graph: 'instrument', light: 'effect', lens: 'effect'}
  for (const [name, design] of Object.entries(DESIGNS)) {
    const device = designs.DESIGN_DEVICES.get(design.id)
    assert.ok(device, `${design.id} has its device`)
    assert.equal(designKey(device.family, device.face.id), design.id, `${design.id}: keyed to its design`)
    assert.equal(device.id, design.id, 'its id on the door is its design key')
    assert.deepEqual(device.rows, [], 'no rows: the design draws on the binding\'s keys')
    assert.equal(design.kind, kinds[name])
    assert.equal(design.views, undefined, `${design.id}: on a chain, in a pane and on the rail — all six views (manual §16.3)`)
    assert.equal(isRegisteredDesign(design.id), false, `${design.id}: the catalogue's design draws, never one the shell registers`)
  }
  for (const file of ['techne/devices/techneDesigns.ts', 'inhabitants/ql/devices/TechneDevices.tsx']) assert.doesNotMatch(read(file), /registerDesignedDevice/, `${file}: no override`)
})

test('the Palace on the palace session: every reading the session\'s own; the board, the walk, the bookmarks and the Return; outside, only the light', async () => {
  const state = await enter()
  assert.equal(state.phase, 'inside')
  const values = palaceB.palaceValues(state)
  const rooms = JSON.parse(values.rooms)
  assert.deepEqual(rooms.map(room => [room.name, room.kind]), [['Central', 'overview'], ['The Stone', 'constellation'], ['The Tower', 'constellation'], ['Walk', 'region']])
  assert.deepEqual(rooms[1].members, ['the carving', 'Mercurius'], 'a room\'s members are its Scene\'s subjects, by the owner\'s titles')
  assert.equal(rooms[3].holds, 'expression:walk', 'a region holds its one Expression, named as the owner\'s document names it')
  assert.deepEqual([values.palace, values.light, values.floor, values.path, values.lines, values.guide, values.snap], ['Central', 'lit', 'board', 'guided', true, true, false])
  assert.deepEqual([values.x0, values.y0, values.x3, values.y3], [100, 100, 100, 400], 'each room where the owner\'s floor stands it (board.ts defaultBoardPoint)')
  assert.equal(values.proposal, 'none')
  assert.equal(values.gone, false, 'the kernel lists Walk: its door is whole')
  // The proving reading's walk steps through entries no room of this palace holds (atlas-palaces-plate.test.mjs reads it the same way):
  // the walk stands on no room, so Room is absent, and says why.
  const focus = session.focusedRoom(state)
  assert.equal(values.at, focus === null ? undefined : rooms.findIndex(room => room.key === focus), 'the room the walk stands in, or absent')
  if (values.at === undefined) assert.match(palaceB.palaceAbsent(state, 'at'), /stands on no room/)
  assert.equal(values.order, undefined, 'no owner holds a spatial order')
  assert.equal(values.audience, undefined, 'no owner discloses an audience')
  assert.match(palaceB.palaceBinding(state).standing.order.disabled, /missing op/)
  assert.match(palaceB.palaceBinding(state).standing.audience.disabled, /missing op/)
  assert.match(palaceB.palaceBinding(state).standing.floor.disabled, /missing op/)
  // outside
  session.leavePalace()
  const outside = palaceB.palaceBinding(session.palaceState())
  assert.deepEqual(outside.values, {light: 'dark'})
  for (const key of ['path', 'guide', 'snap', 'at', 'keep', 'propose', 'accept', 'refuse', 'leave']) assert.equal(outside.standing[key].disabled, palaceB.NOT_INSIDE, key)
  await assert.rejects(() => outside.write([{key: 'path', value: 'free'}]), new RegExp(palaceB.NOT_INSIDE.slice(0, 30)))
})

test('the Palace writes through the session\'s acts: path, guide, snap, the walk to a room, a room\'s place, Keep, the Return and Leave; refusals in words', async () => {
  const state = await enter()
  const acts = {calls: [], line: () => 'Not bookmarked: a test refusal.'}
  for (const name of ['setPath', 'setGuide', 'setSnap', 'moveWalk', 'moveRooms', 'proposeReturn', 'acceptReturn', 'refuseReturn', 'leavePalace']) acts[name] = (...args) => { acts.calls.push([name, ...args]) }
  acts.bookmarkHere = name => { acts.calls.push(['bookmarkHere', name]); return name !== 'refuse me' }
  const binding = palaceB.palaceBinding(state, {draft: 'Stone first'}, acts)
  await binding.write([{key: 'path', value: 'free'}, {key: 'guide', value: false}, {key: 'snap', value: true}])
  await binding.write([{key: 'x1', value: 500}, {key: 'y1', value: 120}])
  await binding.write([{key: 'keep', value: true}, {key: 'propose', value: true}, {key: 'refuse', value: true}, {key: 'accept', value: true}, {key: 'leave', value: true}])
  assert.deepEqual(acts.calls.slice(0, 4), [['setPath', 'free'], ['setGuide', false], ['setSnap', true], ['moveRooms', {[STONE]: {x: 500, y: 120}}]])
  assert.deepEqual(acts.calls.slice(4).map(call => call[0]), ['bookmarkHere', 'proposeReturn', 'refuseReturn', 'acceptReturn', 'leavePalace'])
  assert.equal(acts.calls[4][1], 'Stone first', 'Keep saves the name the hand typed')
  await assert.rejects(() => binding.write([{key: 'path', value: 'spiral'}]), /guided or free/)
  await assert.rejects(() => palaceB.palaceBinding(state, {draft: 'refuse me'}, acts).write([{key: 'keep', value: true}]), /a test refusal/, 'the session\'s own words')
  await assert.rejects(() => palaceB.palaceBinding(state, {}, acts).write([{key: 'keep', value: true}]), /Type a name first/)
  for (const key of ['order', 'floor', 'audience', 'lines']) await assert.rejects(() => binding.write([{key, value: 'x'}]), /missing op|Path/)
  // the real session: the walk moves to the room asked, and the path and the guide are its own
  const live = palaceB.palaceBinding(session.palaceState())
  const rooms = JSON.parse(live.values.rooms)
  const stone = rooms.findIndex(room => room.name === 'The Stone')
  await live.write([{key: 'at', value: stone}]).catch(() => {})
  // (it moved, or the whole has no step in it and the write said so — the next line pins which)
  const steps = session.walkOf(session.inside()).steps
  if (steps.some(step => step.ref === STONE)) assert.equal(palaceB.palaceValues(session.palaceState()).at, stone, 'the walk stands in the room asked')
  else await assert.rejects(() => palaceB.palaceBinding(session.palaceState()).write([{key: 'at', value: stone}]), /No step of the walk stands in The Stone/)
  await palaceB.palaceBinding(session.palaceState()).write([{key: 'path', value: 'free'}, {key: 'guide', value: false}])
  assert.deepEqual([session.inside().path, session.inside().guide], ['free', false])
  assert.equal(palaceB.palaceValues(session.palaceState()).lines, false, 'a free path draws no line')
  session.resetPalaceSession()
})

test('the Knowledge graph on the open graph and the kernel\'s reading (REAL): view state from the handle, the reading whole; writes through the armed setters', async () => {
  const surface = fakeSurface()
  const sent = []
  const writes = {setter: async (path, value) => { sent.push([path, value]) }, patch: (_surface, patch) => { sent.push(['patch', patch]) }}
  const binding = graphB.graphBinding(surface, answered, writes)
  const v = binding.values
  assert.deepEqual([v.light, v.selected, v.scope, v.depth, v.direction, v.ghosts, v.orphans, v.mode, v.labels, v.zoom], ['lit', 'wiki:node:identity', 'local', 2, 'both', true, true, 'structure', 'automatic', 1.5])
  assert.deepEqual(JSON.parse(v.reading).nodes.map(node => node.ref), REAL.outcome.reading.nodes.map(node => node.ref), 'the kernel\'s reading, whole')
  assert.equal(v.budget, 4096, 'the read\'s own bound')
  assert.deepEqual(JSON.parse(v.groups)[0], {id: 'g1', label: 'Sources', color: '#88aa66', text: '', kinds: ['file'], tags: [], enabled: true})
  for (const key of ['minimap', 'aperture.mode', 'aperture.admitted', 'aperture.depth']) assert.equal(v[key], undefined, `${key}: no reading`)
  await binding.write([{key: 'scope', value: 'field'}, {key: 'depth', value: 3}, {key: 'kinds', value: 'wiki-node|file'}, {key: 'orphans', value: false}, {key: 'mode', value: 'matches'}, {key: 'zoom', value: 2}])
  await binding.write([{key: 'g:g1', value: false}])
  assert.deepEqual(sent.slice(0, 6), [['shell.setKnowledgeScope', 'field'], ['shell.setKnowledgeDepth', 3], ['shell.setKnowledgeKinds', ['wiki-node', 'file']],
    ['shell.setKnowledgeIsolated', false], ['shell.setKnowledgeContext', 'matches'], ['shell.setKnowledgeZoom', 2]])
  assert.equal(sent[6][1].emphasis[0].enabled, false, 'a coloured group\'s switch is the panel\'s own filter change')
  for (const key of ['selected', 'minimap', 'aperture.mode', 'aperture.positions', 'aperture.budget']) {
    assert.match(binding.standing[key].disabled, /missing op/, key)
    await assert.rejects(() => binding.write([{key, value: 'x'}]), /missing op/)
  }
  assert.match(binding.standing['aperture.mode'].disabled, /plan_living_wiki_refraction/)
  const field = graphB.graphBinding(fakeSurface({scope: 'field'}), answered, writes)
  assert.equal(field.standing.depth.disabled, graphB.NOT_LOCAL)
  await assert.rejects(() => field.write([{key: 'depth', value: 2}]), /local view/)
  const closed = graphB.graphBinding(null, answered, writes)
  assert.deepEqual(Object.keys(closed.values).sort(), ['budget', 'light', 'reading'], 'with no graph open: the reading and the light alone')
  assert.equal(closed.values.light, 'dark')
  for (const key of ['scope', 'depth', 'text', 'labels', 'zoom', 'clear']) assert.equal(closed.standing[key].disabled, graphB.NOT_OPEN, key)
  await assert.rejects(() => closed.write([{key: 'scope', value: 'local'}]), /not open/)
  const refused = graphB.graphBinding(null, {status: 'refused', reading: null, error: 'central.wiki.read: the ground is locked', pending: [], nodes: 4096}, writes)
  assert.match(refused.standing.reading.disabled, /the ground is locked/, 'a refused read keeps the owner\'s words')
  assert.deepEqual(graphB.graphBinding(null, null, writes).waiting, ['reading'], 'unread: the reading waits')
})

test('the kernel graph op is read only while the Knowledge graph stands, once per bound, and progressively', async () => {
  const asked = []
  graphRead.setGraphLoaderForTest(async (publish, options) => {
    asked.push([options.maxNodes, options.shared])
    publish({reading: REAL.outcome.reading, pending: ['aikit_resolution']})
    publish({reading: REAL.outcome.reading, pending: []})
  })
  graphRead.requestGraphRead(4096, false)
  graphRead.requestGraphRead(4096, false)
  await new Promise(resolve => setImmediate(resolve))
  assert.deepEqual(asked, [[4096, false]], 'one read per bound')
  assert.equal(graphRead.graphRead().status, 'answered')
  graphRead.requestGraphRead(512, true)
  await new Promise(resolve => setImmediate(resolve))
  assert.deepEqual(asked[1], [512, true], 'a new bound, or Shared, reads again')
  graphRead.setGraphLoaderForTest(async () => { throw Error('graph: the kernel refused') })
  graphRead.requestGraphRead(64, false)
  await new Promise(resolve => setImmediate(resolve))
  assert.deepEqual([graphRead.graphRead().status, graphRead.graphRead().error], ['refused', 'graph: the kernel refused'])
  graphRead.setGraphLoaderForTest(null)
  assert.match(read('techne/devices/graphRead.ts'), /loadGraph\(detectTransport\(\), undefined, '', publish, options\)/, 'the read the open surface itself makes (graphProgress.ts)')
})

test('the Journey on the frame\'s announcement: the stop it stands on, the count, that stop\'s name, whether it walks; everything else refused naming the missing op', async () => {
  const frame = frameOf('journey', {journey: {sceneIndex: 2, sceneCount: 5, sceneName: 'Gather', journeyPlaying: true}})
  const binding = frameB.journeyBinding(frame)
  assert.deepEqual(binding.values, {light: 'lit', walk: 'Field studies of the frame', stops: JSON.stringify([null, null, null, null, null]), at: 2, 'name:2': 'Gather', playing: true})
  for (const key of ['at', 'playing', 'entered', 'take', 'snap', 'hold:2', 'tr:4', 'kind:0', 'words:2']) assert.match(binding.standing[key].disabled, /missing op/, key)
  await assert.rejects(() => binding.write([{key: 'hold:9', value: 3}]), /missing op: a journey reading/)
  await assert.rejects(() => binding.write([{key: 'playing', value: false}]), /missing op: a stage command that walks/)
  assert.deepEqual(frameB.journeyBinding(frameOf('canvas', {journey: {sceneIndex: 0, sceneCount: 1}})).values.light, 'dark', 'another lens: dark')
  assert.deepEqual(frameB.journeyBinding({state: null, run: null, window: undefined}).values, {}, 'no frame: nothing')
})

test('the Timeline: its lens from the frame\'s own tabs, written by pressing them; the shared window read and written through the session', async () => {
  const runs = [], written = []
  const frame = frameOf('timeline', {chrome: TIMELINE_CHROME, window: {from: instantOfYear(800), to: instantOfYear(1700)}, runs})
  const binding = frameB.timelineBinding(frame, LAW(written))
  assert.deepEqual([binding.values.light, binding.values.lens, binding.values.readOn, binding.values.readFrom, binding.values.readTo], ['lit', 'relations', true, 800, 1700])
  assert.deepEqual([binding.values.winFrom, binding.values.winTo], [800, 1700], 'the hand\'s window starts where the shared window stands')
  for (const key of ['events', 'edges', 'views', 'domFrom']) assert.equal(binding.values[key], undefined, `${key}: not published`)
  await binding.write([{key: 'lens', value: 'chronology'}, {key: 'refresh', value: true}])
  assert.deepEqual(runs, [{command: 'chrome', id: 'm-chron'}, {command: 'chrome', id: 'm-refresh'}], 'the frame\'s own tabs, pressed')
  await binding.write([{key: 'lens', value: 'relations'}])
  assert.equal(runs.length, 2, 'a lens already pressed is not pressed again')
  await assert.rejects(() => binding.write([{key: 'lens', value: 'relative'}]), /does not show this control/, 'Relative stands only where the reading has a zero')
  const held = frameB.timelineBinding(frame, LAW(written), {winFrom: 1200, winTo: 1400})
  await held.write([{key: 'readOver', value: true}])
  await held.write([{key: 'clearWindow', value: true}])
  assert.deepEqual(written, [{from: instantOfYear(1200), to: instantOfYear(1400)}, null], 'Read over and Clear write the session\'s one window')
  const none = frameB.timelineBinding(frameOf('timeline', {chrome: TIMELINE_CHROME, window: undefined}), LAW(written))
  assert.equal(none.values.readOn, undefined)
  assert.match(none.standing.readOver.disabled, /No shared session/)
  for (const key of ['mode', 'zoom', 'saveView', 'st_sourced', 'cat_myth']) assert.match(binding.standing[key].disabled, /missing op/, key)
})

test('the Canvas: its pointer mode, grid, zoom, save and selection from the frame\'s own controls; mode and grid written by pressing them; the board refused', async () => {
  const runs = []
  const frame = frameOf('canvas', {chrome: CANVAS_CHROME, runs})
  const binding = frameB.canvasBinding(frame)
  assert.deepEqual([binding.values.light, binding.values.mode, binding.values.grid, binding.values.zoom, binding.values.save, binding.values.minimap], ['lit', 'select', true, 84, 'saved', true])
  for (const key of ['items', 'lines', 'frames', 'sel', 'form', 'roles']) assert.equal(binding.values[key], undefined, `${key}: not published`)
  await binding.write([{key: 'grid', value: false}, {key: 'mode', value: 'draw'}])
  assert.deepEqual(runs, [{command: 'chrome', id: 't-snap'}, {command: 'chrome', id: 't-draw'}])
  await binding.write([{key: 'grid', value: true}])
  assert.equal(runs.length, 2, 'Snap already on is not pressed')
  await binding.write([{key: 'minimap', value: true}])
  assert.equal(runs.length, 2, 'the overview already shown is not pressed')
  await binding.write([{key: 'minimap', value: false}])
  assert.deepEqual(runs.at(-1), {command: 'chrome', id: 'l-overview'}, 'the frame\'s own overview toggle, pressed')
  runs.length = 2
  const drawing = frameB.canvasBinding(frameOf('canvas', {chrome: chromeFor('canvas', CANVAS_CHROME.controls.map(c => c.label === 'Draw' ? {...c, pressed: true} : c)), runs}))
  assert.equal(drawing.values.mode, 'draw')
  await drawing.write([{key: 'mode', value: 'select'}])
  assert.deepEqual(runs.at(-1), {command: 'chrome', id: 't-draw'}, 'back to select: Draw pressed off')
  for (const key of ['zoom', 'promote', 'declare', 'suggest', 'checkAsk']) assert.match(binding.standing[key].disabled, /missing op/, key)
  assert.match(binding.standing.declare.disabled, /wiki-shape validate · declare · compress/)
  assert.match(binding.standing.suggest.disabled, /Decision helper/)
  assert.match(frameB.canvasBinding(frameOf('timeline', {chrome: TIMELINE_CHROME})).standing.mode.disabled, /timeline lens/, 'another lens: its controls say why')
})

test('Light and the Lens: no reachable owner, so no reading and every control refused naming the operation', async () => {
  for (const [binding, refuse, words] of [[effects.lightBinding(), effects.LIGHT_REFUSE, /LightBox \(optics\/raytracer\.ts traceRays\)/], [effects.lensBinding(), effects.LENS_REFUSE, /ql techne reading.*ql mef lenses/]]) {
    assert.deepEqual(binding.values, {})
    for (const key of Object.keys(refuse)) {
      assert.match(binding.standing[key].disabled, words, key)
      await assert.rejects(() => binding.write([{key, value: 1}]), /missing op/)
    }
  }
})

test('(b) every key each design reads is an owner reading, absent with a reason, or the hand\'s own; (c) every control writes through an owner act or stands refused', async () => {
  const state = await enter()
  const surface = fakeSurface()
  const writes = {setter: async () => {}, patch: () => {}}
  const frame = name => frameOf(name, {chrome: name === 'canvas' ? CANVAS_CHROME : name === 'timeline' ? TIMELINE_CHROME : null, journey: {sceneIndex: 1, sceneCount: 3, sceneName: 'Print', journeyPlaying: false},
    window: {from: instantOfYear(800), to: null}})
  const cases = [
    ['palace', 'techne__palace.tsx', palaceB.palaceBinding(state), key => palaceB.palaceAbsent(state, key)],
    ['palace (outside)', 'techne__palace.tsx', palaceB.palaceBinding({phase: 'outside'}), key => palaceB.palaceAbsent({phase: 'outside'}, key)],
    ['graph', 'knowledge-graph__graph.tsx', graphB.graphBinding(surface, answered, writes), key => graphB.graphAbsent(surface, answered, key)],
    ['graph (closed)', 'knowledge-graph__graph.tsx', graphB.graphBinding(null, null, writes), key => graphB.graphAbsent(null, null, key)],
    ['journey', 'techne__journey.tsx', frameB.journeyBinding(frame('journey')), key => frameB.journeyAbsent(frame('journey'), key)],
    ['timeline', 'techne__timeline.tsx', frameB.timelineBinding(frame('timeline'), LAW([])), key => frameB.timelineAbsent(frame('timeline'), key)],
    ['canvas', 'techne__canvas.tsx', frameB.canvasBinding(frame('canvas')), key => frameB.canvasAbsent(frame('canvas'), key)],
    ['light', 'techne__light.tsx', effects.lightBinding(), effects.lightAbsent],
    ['lens', 'techne__lens.tsx', effects.lensBinding(), effects.lensAbsent],
  ]
  const summary = {}
  for (const [name, file, binding, absent] of cases) {
    const design = DESIGNS[name.split(' ')[0]]
    const sorted = classify(design, binding, absent)
    summary[name] = {reading: sorted.reading.length, absent: sorted.absent.length, local: sorted.local.length}
    for (const key of Object.keys(binding.values)) assert.ok(!(key in (binding.local ?? {})) || binding.values[key] !== undefined, `${name} ${key}`)
    for (const key of setKeysOf(file)) {
      const local = binding.local && key in binding.local
      const goes = binding.writes?.(key) === true
      const refused = binding.standing?.[key]?.disabled
      assert.ok(local || goes || refused, `${name}: the control ${key} neither writes, nor holds, nor says why it cannot`)
      if (!local && goes && refused) await assert.rejects(() => binding.write([{key, value: true}]), undefined, `${name} ${key}: a refused control refuses its write too`)
    }
  }
  // The classification as it stands (the RECEIPT's summary): nothing of a design's sample is a reading.
  assert.ok(summary.palace.reading >= 20 && summary.graph.reading >= 16 && summary.timeline.reading >= 5 && summary.canvas.reading >= 5, JSON.stringify(summary))
  assert.equal(summary.light.reading + summary.lens.reading, 0)
  console.log('key classification', JSON.stringify(summary))
  session.resetPalaceSession()
})

test('the designs draw on their bindings in every view and page — no NaN, no undefined, never their fixtures — and each refusal is drawn as its reason', async () => {
  const state = await enter()
  host.resetHost()
  const writes = {setter: async () => {}, patch: () => {}}
  const timelineFrame = frameOf('timeline', {chrome: TIMELINE_CHROME, window: {from: instantOfYear(800), to: instantOfYear(1700)}})
  const cases = [
    [DESIGNS.palace, palaceB.palaceBinding(state), /Archetypal-Earth — wiki local whole|Start of the argument|ai-kit/, ['The Stone', 'Mercurius'], [palaceB.PALACE_REFUSE.audience]],
    [DESIGNS.palace, palaceB.palaceBinding({phase: 'outside'}), /Archetypal-Earth|Start of the argument|Actuation/, [], [palaceB.NOT_INSIDE]],
    [DESIGNS.graph, graphB.graphBinding(fakeSurface(), answered, writes), /Quaternal-Tarot|Point-Cloud-Demo|face-rig/, [], [graphB.GRAPH_REFUSE['aperture.mode']]],
    [DESIGNS.graph, graphB.graphBinding(null, null, writes), /Quaternal-Tarot|Point-Cloud-Demo|face-rig/, [], [graphB.NOT_OPEN]],
    [DESIGNS.journey, frameB.journeyBinding(frameOf('journey', {journey: {sceneIndex: 1, sceneCount: 3, sceneName: 'Print', journeyPlaying: false}})), /Nocturne|Weather|Fine, irregular stippling/, ['Print'], [frameB.JOURNEY_REFUSE.playing]],
    [DESIGNS.timeline, frameB.timelineBinding(timelineFrame, LAW([])), /Naassene|Kabbala|Late antiquity/, ['1700'], [frameB.TIMELINE_REFUSE.mode]],
    [DESIGNS.canvas, frameB.canvasBinding(frameOf('canvas', {chrome: CANVAS_CHROME})), /Which centre speaks first|Sacral|Lower three/, ['84'], [frameB.CANVAS_REFUSE.promote]],
    [DESIGNS.light, effects.lightBinding(), /The river dream|Grief, unsaid|Change jobs/, [], [effects.LIGHT_REFUSE['light.bounces']]],
    [DESIGNS.lens, effects.lensBinding(), /l5-techne-instrument-constellation|registry-disclosure|Fourfold-Zero/, [], [effects.LENS_REFUSE['lens.lens']]],
  ]
  for (const [design, binding, fixture, shows, reasons] of cases) {
    const drawn = hostedAll(design, binding)
    for (const [view, markup] of drawn) {
      assert.match(markup, new RegExp(`data-device-view="${view}"`), `${design.id} ${view} draws`)
      assert.doesNotMatch(markup, /\bNaN\b|undefined/, `${design.id} ${view}: no absent key drawn as text`)
      assert.doesNotMatch(markup, /data-device-fault/, `${design.id} ${view}: its own view drew`)
      assert.doesNotMatch(markup, fixture, `${design.id} ${view}: its fixture never stands in`)
    }
    const all = drawn.map(([, markup]) => markup).join('\n')
    for (const text of shows) assert.ok(all.includes(text), `${design.id}: draws the owner's ${text}`)
    for (const why of reasons) assert.ok(all.includes(escaped(why)), `${design.id}: a refused control says why (${why.slice(0, 60)}…)`)
  }
  host.resetHost()
  session.resetPalaceSession()
})

test('(d) each design stands where the manual puts it: the instrument at the head of its open chain, then its effects — Light after the Canvas, the Lens after every instrument', () => {
  session.resetPalaceSession()
  assert.deepEqual(designs.TECHNE_CHAINS['techne:m1'], {head: 'techne:canvas', effects: ['techne:light', 'techne:lens']})
  assert.deepEqual(designs.TECHNE_CHAINS['techne:m2'], {head: 'techne:timeline', effects: ['techne:lens']})
  assert.deepEqual(designs.TECHNE_CHAINS['techne:m3'], {head: 'techne:journey', effects: ['techne:lens']})
  assert.deepEqual(designs.TECHNE_CHAINS['techne:m5'], {head: 'techne:palace', effects: ['techne:lens']})
  assert.deepEqual(designs.TECHNE_CHAINS['knowledge-graph'], {head: 'knowledge-graph:graph', effects: ['techne:lens']})
  for (const holder of ['techne:m0', 'techne:m4']) assert.deepEqual(designs.TECHNE_CHAINS[holder], {effects: ['techne:lens']}, `${holder}: the World is its own plate; the Lens after it`)
  assert.deepEqual(designs.holdersOf('techne:light'), ['techne:m1'], 'Light stands only over the Canvas (§17.10)')
  // Rendered: the focused instrument's chain, in order — head, then its plate, then its effects.
  for (const [instrument, head, plate, effectIds] of [
    ['techne:m5', 'techne:palace', 'data-palace-plate="true"', ['techne:lens']],
    ['techne:m1', 'techne:canvas', 'data-stage-plate="canvas"', ['techne:light', 'techne:lens']],
    ['techne:m2', 'techne:timeline', 'data-stage-plate="timeline"', ['techne:lens']],
    ['techne:m3', 'techne:journey', 'data-stage-plate="journey"', ['techne:lens']],
    ['techne:m0', null, 'data-project-plate="true"', ['techne:lens']],
  ]) {
    const out = renderToStaticMarkup(createElement(InstrumentDeviceDetail, {transport, instrument}))
    const at = id => out.indexOf(`data-device-id="${id}"`)
    const plateAt = out.indexOf(plate)
    assert.ok(plateAt > 0, `${instrument}: its plate stands`)
    if (head) {
      assert.match(out, new RegExp(`data-device-id="${head}" data-chain-place="head"`), `${instrument}: ${head} heads the chain`)
      assert.ok(at(head) < plateAt, `${instrument}: the design before the plate`)
    }
    let last = plateAt
    for (const id of effectIds) {
      assert.match(out, new RegExp(`data-device-id="${id}" data-chain-place="effect"`), `${instrument}: ${id} is an effect on its chain`)
      assert.ok(at(id) > last, `${instrument}: ${id} after what stands before it`)
      last = at(id)
    }
  }
  const graph = renderToStaticMarkup(createElement(InstrumentDeviceDetail, {transport, instrument: 'knowledge-graph'}))
  assert.match(graph, /data-device-id="knowledge-graph:graph" data-chain-place="head"/, 'the Knowledge graph heads its own chain')
  assert.ok(graph.indexOf('data-device-id="knowledge-graph:graph"') < graph.indexOf('data-device-id="techne:lens"'))
  for (const face of chain.KNOWLEDGE_FACES_CARRIED) assert.doesNotMatch(graph, new RegExp(`data-face-id="${face}"`), `${face}: carried by the design, on no chain`)
  assert.doesNotMatch(graph, /No family declares a device this instrument holds yet/, 'no empty plate after the design')
  // A design stands on no chain whose instrument is not its own.
  const timeline = renderToStaticMarkup(createElement(InstrumentDeviceDetail, {transport, instrument: 'techne:m2'}))
  for (const id of ['techne:palace', 'techne:canvas', 'techne:light', 'knowledge-graph:graph']) assert.doesNotMatch(timeline, new RegExp(`data-device-id="${id}" data-chain-place`), `${id} is not on the Timeline's chain`)
})

test('the bindings name their owners and copy no design: no default, no fixture, no catalogue import, shell tokens only', () => {
  for (const file of ['palaceBinding.ts', 'graphBinding.ts', 'graphRead.ts', 'frameBindings.ts', 'effectBindings.ts', 'techneDesigns.ts', 'designDevices.ts']) {
    const source = read(`techne/devices/${file}`)
    assert.doesNotMatch(source, /\.defaults\b|\.fixtures\b|catalogue\/panels\//, `${file}: no design default or fixture`)
    assert.deepEqual(source.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [], [], `${file}: shell tokens only`)
  }
  assert.match(read('techne/devices/palaceBinding.ts'), /palaceSession\.ts/)
  assert.match(read('techne/devices/graphBinding.ts'), /kernel\/src\/graph\.rs/)
  assert.match(read('techne/devices/frameBindings.ts'), /HostedAppState/)
})
