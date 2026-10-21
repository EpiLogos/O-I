// Lane W4-Technē (T-COVERAGE §1.4): the unbound designs of Technē and the knowledge graph on their owners (src/techne/devices/**) —
// techne:palace on the palace session, knowledge-graph:graph on the open graph's handle and the kernel graph op, techne:journey,
// techne:timeline and techne:canvas on the research frame as it announces itself (and the session's shared window), techne:light and
// techne:lens on no reachable owner — and where they stand: the head of the open instrument's chain, then its effects (manual §16.2).
//
// Channels:
// - REAL (tests/fixtures/knowledge-graph-reading-2026-10-21.json): the kernel graph op's answer for the root register's wiki, read
//   read-only on workcell:mac through the seat's walk bridge (POST /op {op: graph, …}).
// - FIXTURE, owner-shaped: the palace session over owners standing in for the live ones (the documents of atlas-palaces-session.test.mjs,
//   the shapes the kernel's expression op and the owner's reading return); the frame's announced state, chrome and research reading
//   (HostedAppState; FrameChromeReading in the frame's own control words, researchInstruments.tsx :885-892, :1359-1361; the research
//   reading built by the frame's own builders, researchReading.ts journeyReadingOf · canvasReadingOf · timelineReadingOf, and read back by
//   the boundary's reader readFrameResearch); the open graph's handle.
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
const research = await import('../../../../desktop/cradle/expressions-app/field-studies-journeys/src/researchReading.ts')
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
  control('t-sticky', 'canvas:tools', 'button', 'Add sticky'),
  control('l-zoom', 'canvas:look', 'reading', '84%'), control('v-save', 'canvas:views', 'reading', 'saved'),
  control('l-overview', 'canvas:look', 'toggle', 'Hide overview', {pressed: true}),
])
const TIMELINE_CHROME = chromeFor('timeline', [
  control('m-chron', 'timeline:lens', 'toggle', 'Chronology', {pressed: false}), control('m-field', 'timeline:lens', 'toggle', 'Relations', {pressed: true}),
  control('m-refresh', 'timeline:lens', 'button', 'Refresh timeline'), control('m-mode', 'timeline:lens', 'select', 'Relation field mode'),
])
// The research reading, as the frame's own builders make it from its own state (researchReading.ts) and as the boundary reads it back.
const WALK = research.journeyReadingOf({name: 'Field studies of the frame', loop: true, scenes: [
  {name: 'Ink', character: 'Fine, irregular stippling.', duration: 14, transition: 1.5},
  {name: 'Print', character: 'An imperfect lattice.', duration: 6, transition: 0, transitionSpec: {kind: 'cut'}},
  {name: 'Gather', character: 'Rounded grains find a shared current.', duration: 30, transition: 4, transitionSpec: {kind: 'dip-to-colour', at: 0.35, curve: {type: 'hold'}, switchMode: 'sync'}},
  {name: 'Weather', character: 'No centre, no logo.', duration: 20, transition: 2.5, transitionSpec: {kind: 'wipe', direction: 'right'}, breakAtEnd: true},
]}, {index: 2, local: 1.1, playing: true, entered: false})
const BOARD = research.canvasReadingOf({nodes: [
  {id: 'e:root', title: 'Root of the board', position: {x: 60, y: 240}, size: {width: 94, height: 94}},
  {id: 'e:q', title: 'A question of the frame', position: {x: -250, y: 20}, size: {width: 220, height: 180}},
  {id: 'e:sacral', title: 'Second card', position: {x: 230, y: 160}, size: {width: 94, height: 94}},
], edges: [{id: 'b:1', sourceNodeId: 'e:root', targetNodeId: 'e:sacral', directionality: 'forward'}, {id: 'b:2', sourceNodeId: 'e:q', targetNodeId: 'e:root'}]},
{frames: {f: {label: 'f', title: 'A frame of the board', memberRefs: ['e:root', 'e:sacral'], z: 0}}, connectors: {'b:2': {kind: 'elbow', label: 'asks', fromSide: 'right', toSide: 'left'}}},
{viewport: {x: 380, y: 210, zoom: 0.84}, pane: {width: 760, height: 420}, selected: ['e:q'], selectedLine: 'b:2', drawing: false, erasing: false, lasso: false, snap: true}, id => (id === 'e:q' ? 'sticky' : undefined))
const RULER = research.timelineReadingOf({nodes: [
  {graphNodeId: 't:1', title: 'An event of the frame', isTemporal: true, validFrom: '1595-01-01T00:00:00Z', validTo: '1625-01-01T00:00:00Z', entityType: 'event'},
  {graphNodeId: 't:2', title: 'A later event', isTemporal: true, validFrom: '1677'},
], relationships: [{id: 'r:1', sourceGraphNodeId: 't:1', targetGraphNodeId: 't:2', relType: 'echo', properties: {standing: 'derived'}}]},
{projection: 'field', camera: {centerYear: 1640, pixelsPerYear: 3}, views: ['A view of the frame']})
const RESEARCH = research.readFrameResearch({journey: WALK, canvas: BOARD, timeline: RULER})
function frameOf(lens, {chrome = null, journey = {}, window, runs = [], research: held = RESEARCH} = {}) {
  const state = {lens, document: {name: 'Field studies of the frame'}, ...journey, ...(chrome ? {chrome} : {}),
    ...(held ? {research: {...(held.journey ? {journey: held.journey} : {}), ...(lens === 'canvas' && held.canvas ? {canvas: held.canvas} : {}), ...(lens === 'timeline' && held.timeline ? {timeline: held.timeline} : {})}} : {})}
  return {state, run: async command => { runs.push(command); return {ok: true} }, window}
}
const LAW = written => ({yearOf: windowEdgeYear, instantOf: instantOfYear, write: window => { written.push(window); return null }})

// ---------------------------------------------------------------------------------------------------------------- the open graph

function fakeSurface(filters = {}, over = {}) {
  const calls = []
  return {filters: cradleFilters.restoreGraphFilters({scope: 'local', depth: 2, emphasis: [{id: 'g1', label: 'Sources', color: '#88aa66', text: '', kinds: ['file'], tags: [], enabled: true}], ...filters}),
    zoom: 1.5, domains: {kinds: ['wiki-node'], relations: ['node-source']}, counts: null, selected: 'wiki:node:identity',
    reading: REAL.outcome.reading, loading: false, project: 'O-I', query: '', minimap: true, calls,
    patchFilters() {}, setZoom() {}, fit() {}, select(ref) { calls.push(['select', ref]); if (!REAL.outcome.reading.nodes.some(node => node.ref === ref)) throw Error(`${ref} is not in this graph's reading`) },
    setMinimap(on) { calls.push(['minimap', on]) }, ...over}
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

test('the Knowledge graph on the open graph (its handle: view state, its own reading — REAL — its selection and overview) and, with none open, the root register\'s reading', async () => {
  const surface = fakeSurface()
  const sent = []
  const writes = {setter: async (path, value) => { sent.push([path, value]) }, patch: (_surface, patch) => { sent.push(['patch', patch]) }}
  const binding = graphB.graphBinding(surface, graphB.surfaceRead(surface), writes)
  const v = binding.values
  assert.deepEqual([v.light, v.selected, v.scope, v.depth, v.direction, v.ghosts, v.orphans, v.mode, v.labels, v.zoom, v.minimap], ['lit', 'wiki:node:identity', 'local', 2, 'both', true, true, 'structure', 'automatic', 1.5, true])
  assert.deepEqual(JSON.parse(v.reading).nodes.map(node => node.ref), REAL.outcome.reading.nodes.map(node => node.ref), 'the open surface\'s own reading, whole')
  assert.equal(v.budget, 4096, 'the surface reads at graphProgress\'s own bound')
  assert.match(binding.standing.budget.disabled, /missing op: a node bound on the open graph/)
  assert.deepEqual(JSON.parse(v.groups)[0], {id: 'g1', label: 'Sources', color: '#88aa66', text: '', kinds: ['file'], tags: [], enabled: true})
  for (const key of ['aperture.mode', 'aperture.admitted', 'aperture.depth']) assert.equal(v[key], undefined, `${key}: no reading`)
  await binding.write([{key: 'scope', value: 'field'}, {key: 'depth', value: 3}, {key: 'kinds', value: 'wiki-node|file'}, {key: 'orphans', value: false}, {key: 'mode', value: 'matches'}, {key: 'zoom', value: 2}])
  await binding.write([{key: 'g:g1', value: false}])
  assert.deepEqual(sent.slice(0, 6), [['shell.setKnowledgeScope', 'field'], ['shell.setKnowledgeDepth', 3], ['shell.setKnowledgeKinds', ['wiki-node', 'file']],
    ['shell.setKnowledgeIsolated', false], ['shell.setKnowledgeContext', 'matches'], ['shell.setKnowledgeZoom', 2]])
  assert.equal(sent[6][1].emphasis[0].enabled, false, 'a coloured group\'s switch is the panel\'s own filter change')
  // B: a press on a node selects through the handle's own act; the overview toggle is the canvas's own
  await binding.write([{key: 'selected', value: 'wiki:node:delivered-lane-loses-install'}, {key: 'minimap', value: false}])
  assert.deepEqual(surface.calls, [['select', 'wiki:node:delivered-lane-loses-install'], ['minimap', false]])
  await assert.rejects(() => binding.write([{key: 'selected', value: 'wiki:node:nowhere'}]), /not in this graph's reading/, 'the handle\'s refusal, in its words')
  // The Aperture page: the request is the view's own; QL's plan is asked for it (livingPlan.ts), and with no mode chosen says so.
  for (const key of ['aperture.mode', 'aperture.positions', 'aperture.context', 'aperture.full', 'aperture.budget']) assert.equal(typeof binding.local[key], 'function', key)
  assert.match(binding.standing['aperture.admitted'].disabled, /Choose a mode/)
  const loading = graphB.graphBinding(fakeSurface({}, {reading: null, loading: true}), graphB.surfaceRead(fakeSurface({}, {reading: null, loading: true})), writes)
  assert.equal(loading.values.reading, undefined)
  assert.deepEqual(loading.waiting, ['reading'], 'the surface\'s first part has not come: the reading waits')
  const field = graphB.graphBinding(fakeSurface({scope: 'field'}), answered, writes)
  assert.equal(field.standing.depth.disabled, graphB.NOT_LOCAL)
  await assert.rejects(() => field.write([{key: 'depth', value: 2}]), /local view/)
  const closed = graphB.graphBinding(null, answered, writes)
  assert.deepEqual(Object.keys(closed.values).sort(), ['budget', 'light', 'reading'], 'with no graph open: the root register\'s reading and the light alone')
  assert.equal(closed.values.light, 'dark')
  for (const key of ['scope', 'depth', 'text', 'labels', 'zoom', 'clear', 'selected', 'minimap']) assert.equal(closed.standing[key].disabled, graphB.NOT_OPEN, key)
  await assert.rejects(() => closed.write([{key: 'scope', value: 'local'}]), /not open/)
  const refused = graphB.graphBinding(null, {status: 'refused', reading: null, error: 'central.wiki.read: the ground is locked', pending: [], nodes: 4096}, writes)
  assert.match(refused.standing.reading.disabled, /the ground is locked/, 'a refused read keeps the owner\'s words')
  assert.deepEqual(graphB.graphBinding(null, null, writes).waiting, ['reading'], 'unread: the reading waits')
  assert.match(read('techne/devices/techneDesigns.ts'), /useGraphRead\(graph && !surface,/, 'the root register is read only while no graph is open')
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

test('the Journey on the frame\'s research reading: the walk as its Journey document holds it, where it stands; stand, play, stop, enter and return as the frame\'s own acts', async () => {
  const runs = []
  const binding = frameB.journeyBinding(frameOf('journey', {runs}))
  const v = binding.values
  assert.deepEqual(JSON.parse(v.stops), [['Ink', 'Fine, irregular stippling.'], ['Print', 'An imperfect lattice.'], ['Gather', 'Rounded grains find a shared current.'], ['Weather', 'No centre, no logo.']])
  assert.deepEqual([v.light, v.walk, v.docLoops, v.stopAtEnd, v.at, v.local, v.playing, v.entered], ['lit', 'Field studies of the frame', true, true, 2, 1.1, true, false])
  assert.deepEqual([v['hold:2'], v['tr:2'], v['kind:2'], v['curve:2'], v['sw:2'], v['atc:2'], v['dir:2']], [30, 4, 'dip-to-colour', 'hold', 'sync', 0.35, undefined])
  assert.deepEqual([v['kind:0'], v['curve:0'], v['sw:0']], ['crossfade', 'linear', 'immediate'], 'an absent spec is the frame\'s own default seam')
  assert.equal(v['dir:3'], 'right')
  for (const key of ['takes', 'take', 'snap']) assert.equal(v[key], undefined, `${key}: the frame holds none`)
  await binding.write([{key: 'at', value: 3}])
  await binding.write([{key: 'local', value: 5.5}])
  await binding.write([{key: 'playing', value: false}, {key: 'entered', value: true}, {key: 'entered', value: false}])
  assert.deepEqual(runs, [{command: 'journey', action: 'stand', index: 3}, {command: 'journey', action: 'stand', index: 2, seconds: 5.5},
    {command: 'journey', action: 'stop'}, {command: 'journey', action: 'enter'}, {command: 'journey', action: 'return'}])
  await assert.rejects(() => binding.write([{key: 'at', value: 9}]), /there is no stop 10/)
  // The walk's pace and seams, each the frame's own edit (stageCommands.ts journey pace · seam · switch · curve · loop).
  runs.length = 0
  await binding.write([{key: 'hold:2', value: 24}, {key: 'tr:1', value: 2.5}, {key: 'kind:0', value: 'wipe'}, {key: 'sw:2', value: 'at-end'},
    {key: 'curve:2', value: 'smooth'}, {key: 'atc:2', value: 0.5}, {key: 'dir:3', value: 'up'}, {key: 'stopAtEnd', value: false}])
  assert.deepEqual(runs, [{command: 'journey', action: 'pace', index: 2, seconds: 24}, {command: 'journey', action: 'seam', index: 1, seconds: 2.5},
    {command: 'journey', action: 'seam', index: 0, transition: 'wipe'}, {command: 'journey', action: 'switch', index: 2, mode: 'at-end'},
    {command: 'journey', action: 'curve', index: 2, type: 'smooth'}, {command: 'journey', action: 'seam', index: 2, at: 0.5},
    {command: 'journey', action: 'seam', index: 3, direction: 'up'}, {command: 'journey', action: 'loop', on: false}])
  await assert.rejects(() => binding.write([{key: 'dir:2', value: 'up'}]), /Only a wipe has a direction/, 'a dip takes no direction: refused before anything is sent')
  await assert.rejects(() => binding.write([{key: 'hold:9', value: 3}]), /there is no stop 10/)
  assert.match(binding.standing['words:2'].disabled, /missing op: a stage command for a Scene's character/)
  await assert.rejects(() => binding.write([{key: 'words:2', value: 'x'}]), /missing op/)
  const refusing = {...frameOf('journey'), run: async () => ({ok: false, error: 'Save your first scene before playing the scene strip.'})}
  await assert.rejects(() => frameB.journeyBinding(refusing).write([{key: 'playing', value: true}]), /Save your first scene/, 'the frame\'s refusal, in its words')
  const older = frameB.journeyBinding(frameOf('journey', {research: null}))
  assert.deepEqual(older.values, {light: 'lit'}, 'a frame that announces no research reading: nothing of the walk')
  assert.match(older.standing.at.disabled, /missing op: the research announcement/)
  assert.deepEqual(frameB.journeyBinding({state: null, run: null, window: undefined}).values, {}, 'no frame: nothing')
})

test('the Timeline on the frame\'s research reading: its dated events, relations, span, projection, camera and views; its lens pressed on the frame\'s own tabs; the shared window through the session', async () => {
  const runs = [], written = []
  const frame = frameOf('timeline', {chrome: TIMELINE_CHROME, window: {from: instantOfYear(800), to: instantOfYear(1700)}, runs})
  const binding = frameB.timelineBinding(frame, LAW(written))
  const v = binding.values
  assert.deepEqual([v.light, v.lens, v.dated, v.domFrom, v.domTo, v.centre, v.zoom], ['lit', 'relations', true, 1595, 1677, 1640, 3])
  assert.deepEqual(JSON.parse(v.events), [{id: 't:1', name: 'An event of the frame', from: 1595, to: 1625, family: 'event'}, {id: 't:2', name: 'A later event', from: 1677, to: 1677}])
  assert.deepEqual(JSON.parse(v.edges), [{id: 'r:1', from: 't:1', to: 't:2', kind: 'echo', st: 'derived'}])
  assert.deepEqual(JSON.parse(v.views), [{id: 'A view of the frame', label: 'A view of the frame'}])
  assert.deepEqual([v.readOn, v.readFrom, v.readTo, v.winFrom, v.winTo], [true, 800, 1700, 800, 1700])
  await binding.write([{key: 'lens', value: 'chronology'}, {key: 'refresh', value: true}])
  assert.deepEqual(runs, [{command: 'chrome', id: 'm-chron'}, {command: 'chrome', id: 'm-refresh'}], 'the frame\'s own tabs, pressed')
  await binding.write([{key: 'lens', value: 'relations'}])
  assert.equal(runs.length, 2, 'the projection already standing is not pressed again')
  await assert.rejects(() => binding.write([{key: 'lens', value: 'relative'}]), /does not show this control/, 'Relative stands only where the reading has a zero')
  const held = frameB.timelineBinding(frame, LAW(written), {winFrom: 1200, winTo: 1400})
  await held.write([{key: 'readOver', value: true}])
  await held.write([{key: 'clearWindow', value: true}])
  assert.deepEqual(written, [{from: instantOfYear(1200), to: instantOfYear(1400)}, null], 'Read over and Clear write the session\'s one window')
  // The camera, a saved view and the relation links are the Timeline's own acts (stageCommands.ts timeline camera · view · links).
  runs.length = 0
  await binding.write([{key: 'centre', value: 1650}, {key: 'zoom', value: 6}])
  await binding.write([{key: 'view', value: 'A view of the frame'}, {key: 'view', value: 'none'}, {key: 'links', value: false}])
  assert.deepEqual(runs, [{command: 'timeline', action: 'camera', centre: 1650, zoom: 6}, {command: 'timeline', action: 'view', name: 'A view of the frame'},
    {command: 'timeline', action: 'links', on: false}], 'one camera for the two keys; None goes nowhere')
  await assert.rejects(() => binding.write([{key: 'view', value: 'Another'}]), /keeps no view named "Another"/)
  await assert.rejects(() => binding.write([{key: 'cat_myth', value: false}]), /card categories are read only while it is drawn/, 'a category is set on what the chronology announces it hides')
  for (const key of ['mode', 'st_sourced']) assert.match(binding.standing[key].disabled, /missing op: stage commands for the Timeline's relation mode/, key)
  assert.match(binding.standing.saveView.disabled, /a name for the view/)
  const elsewhere = frameB.timelineBinding(frameOf('canvas', {chrome: CANVAS_CHROME}), LAW(written))
  assert.equal(elsewhere.values.events, undefined, 'the frame presents no Timeline: no ruler')
  assert.match(frameB.timelineAbsent(frameOf('canvas', {chrome: CANVAS_CHROME}), 'events'), /presents no Timeline now/)
  const none = frameB.timelineBinding(frameOf('timeline', {chrome: TIMELINE_CHROME, window: undefined}), LAW(written))
  assert.equal(none.values.readOn, undefined)
  assert.match(none.standing.readOver.disabled, /No shared session/)
})

test('the Canvas on the frame\'s research reading: its cards, lines (the selected one first, with its connector), frames, camera, selection and pointer flags; the camera through the frame\'s own fly; mode, grid and overview pressed', async () => {
  const runs = []
  const binding = frameB.canvasBinding(frameOf('canvas', {chrome: CANVAS_CHROME, runs}))
  const v = binding.values
  assert.deepEqual(JSON.parse(v.items).map(item => [item.id, item.kind, item.name]), [['e:root', 'card', 'Root of the board'], ['e:q', 'sticky', 'A question of the frame'], ['e:sacral', 'card', 'Second card']])
  assert.deepEqual(JSON.parse(v.lines), [['e:q', 'e:root'], ['e:root', 'e:sacral']], 'the selected line first, as the design reads it')
  assert.deepEqual(JSON.parse(v.frames), [{title: 'A frame of the board', members: ['e:root', 'e:sacral']}])
  assert.deepEqual([v.cx, v.cy, v.zoom], [0, 0, 84], 'the board point at the pane\'s centre and the zoom in percent')
  assert.deepEqual([v.sel, v.mode, v.grid, v.minimap, v.save, v.light], ['e:q', 'select', true, true, 'saved', 'lit'])
  assert.deepEqual([v.lineKind, v.fromSide, v.toSide, v.label, v.direction], ['elbow', 'right', 'left', 'asks', undefined])
  await binding.write([{key: 'cx', value: 120}, {key: 'cy', value: -40}, {key: 'zoom', value: 50}])
  assert.deepEqual(runs, [{command: 'canvas', action: 'camera', cx: 120, cy: -40, zoom: 50}], 'one camera command for the three, through the frame\'s own fly')
  await binding.write([{key: 'zoom', value: 120}])
  assert.deepEqual(runs.at(-1), {command: 'canvas', action: 'camera', cx: 0, cy: 0, zoom: 120}, 'a zoom alone keeps the centre the frame reports')
  await assert.rejects(() => binding.write([{key: 'zoom', value: 400}]), /5 % to 200 %/)
  runs.length = 0
  await binding.write([{key: 'grid', value: false}, {key: 'mode', value: 'draw'}, {key: 'minimap', value: false}])
  assert.deepEqual(runs, [{command: 'chrome', id: 't-snap'}, {command: 'chrome', id: 't-draw'}, {command: 'chrome', id: 'l-overview'}], 'the frame\'s own toggles, pressed')
  await binding.write([{key: 'grid', value: true}, {key: 'minimap', value: true}])
  assert.equal(runs.length, 3, 'a toggle already standing is not pressed')
  for (const key of ['add', 'promote', 'declare', 'suggest', 'direction']) assert.match(binding.standing[key].disabled, /missing op/, key)
  // The selected line's connector, as the frame's connector controls write it (stageCommands.ts canvas connector).
  runs.length = 0
  await binding.write([{key: 'lineKind', value: 'straight'}, {key: 'toSide', value: 'auto'}])
  assert.deepEqual(runs, [{command: 'canvas', action: 'connector', line: 'b:2', lineKind: 'straight', toSide: 'auto'}], 'one connector write, on the selected line')
  await assert.rejects(() => binding.write([{key: 'fromSide', value: 'middle'}]), /auto, top, right, bottom or left/)
  binding.local.view('everything')
  assert.equal(frameB.canvasBinding(frameOf('canvas', {chrome: CANVAS_CHROME}), devices.heldFor(frameB.CANVAS_ID)).values.view, 'everything', 'the View chooser is the view\'s own; its camera moves through cx, cy and zoom')
  devices.resetHolds()
  assert.match(binding.standing.declare.disabled, /wiki-shape validate · declare · compress/)
  const elsewhere = frameB.canvasBinding(frameOf('timeline', {chrome: TIMELINE_CHROME}))
  assert.equal(elsewhere.values.items, undefined, 'the frame presents no Canvas: no board')
  assert.match(elsewhere.standing.mode.disabled, /timeline lens/, 'another lens: its controls say why')
})

test('Light: no reachable owner, so no reading and every control refused naming the operation', async () => {
  const binding = effects.lightBinding()
  assert.deepEqual(binding.values, {})
  for (const key of Object.keys(effects.LIGHT_REFUSE)) {
    assert.match(binding.standing[key].disabled, /LightBox \(optics\/raytracer\.ts traceRays\)/, key)
    await assert.rejects(() => binding.write([{key, value: 1}]), /missing op/)
  }
})

// REAL (desktop/cradle/kernel/tests/fixtures/owner-routes/ql-registry-reads-2026-10-21.json): the installed ql's answers, 21 Oct.
const QL_REGISTRY = JSON.parse(readFileSync(new URL('../../../../desktop/cradle/kernel/tests/fixtures/owner-routes/ql-registry-reads-2026-10-21.json', import.meta.url), 'utf8'))
const registryCall = (answers = {'mef-lenses': QL_REGISTRY.mef_lenses, 'context-frame-list': QL_REGISTRY.context_frame_list, 'service-capabilities': QL_REGISTRY.service_capabilities}, asked = []) => async op => {
  asked.push(op)
  const answer = answers[op.request.kind]
  return answer?.answer ? {outcome: {result: 'owner_route_reading', route: answer.command.slice(0, 3).join(' '), data: answer.answer}} : {outcome: null, error: answer ?? 'no answer'}
}

test('the Lens reads QL\'s lens registry, frames and provider operations through ql_read, verbatim (REAL answers); its reading and frame reading name what they wait for; its mode, operation and probe say what is lacking', async () => {
  const lenses = await import('../src/techne/devices/lensRegistry.ts')
  const asked = []
  lenses.resetLensRegistry({call: registryCall(undefined, asked)})
  assert.equal(effects.lensBinding(lenses.lensRegistry()).standing.lenses.disabled, "Reading QL's `ql mef lenses`…", 'asking: said so')
  await lenses.ensureLensRegistry()
  assert.deepEqual(asked.map(op => op.request), [{kind: 'mef-lenses'}, {kind: 'context-frame-list'}, {kind: 'service-capabilities'}], 'one read each')
  await lenses.ensureLensRegistry()
  assert.equal(asked.length, 3, 'the registry does not move under a running shell: read once')
  const binding = effects.lensBinding(lenses.lensRegistry())
  assert.deepEqual(JSON.parse(binding.values.lenses), QL_REGISTRY.mef_lenses.answer.lenses, 'the lenses as QL gives them')
  assert.deepEqual(JSON.parse(binding.values.frames), QL_REGISTRY.context_frame_list.answer.frames)
  assert.deepEqual(JSON.parse(binding.values.service), QL_REGISTRY.service_capabilities.answer.operations)
  assert.match(binding.standing.lenses.disabled, /registry 1\.0\.0-q2\), its 12 lenses .* QL names no sublenses/)
  assert.match(binding.standing.frames.disabled, /grammar 1\.0\.0\), its 7 frames/)
  assert.match(binding.standing.service.disabled, /`ql service capabilities`, available\)/)
  const keys = classify(DESIGNS.lens, binding, effects.lensAbsent)
  assert.deepEqual(keys.reading.sort(), ['frames', 'lenses', 'service'], 'what QL answers here, and nothing of the design\'s sample')
  assert.deepEqual(keys.local.sort(), ['lens.lens', 'lens.sublens'], 'the aperture is the view\'s own hold')
  for (const key of ['reading.subject', 'reading.members', 'reading.lens', 'reading.instruments', 'reading.degraded']) assert.match(binding.standing[key].disabled, /QL reads the target its caller supplies .*WikiSubjectSource/, key)
  for (const key of ['frame.mapping', 'frame.status', 'frame.frames', 'frame.missing']) assert.match(binding.standing[key].disabled, /sixfold mapping its caller names .*QL-MEF pull 344/, key)
  assert.match(binding.standing.proposals.disabled, /refraction\.rs:787-788/, 'the proposals keep QL\'s own gap')
  assert.match(binding.standing['lens.mode'].disabled, /`ql wiki refract -`, QL-MEF pull 350.*no refraction runs here/)
  for (const key of ['lens.lens', 'lens.sublens']) assert.equal(binding.standing[key], undefined, `${key}: a hold, not refused`)
  assert.match(binding.standing['lens.operation'].disabled, /`ql service negotiate` only reports/)
  for (const key of ['frame.position', 'frame.face', 'frame.grain']) assert.match(binding.standing[key].disabled, /sixfold mapping/, key)
  for (const key of Object.keys(effects.LENS_REFUSE)) await assert.rejects(() => binding.write([{key, value: 1}]), new RegExp(effects.LENS_REFUSE[key].slice(0, 20).replace(/[.*+?^${}()|[\]\\`]/g, '\\$&')), key)
  const drawn = hostedAll(DESIGNS.lens, binding)
  for (const [view, markup] of drawn) {
    assert.doesNotMatch(markup, /\bNaN\b|undefined/, `${view}: no absent key drawn as text`)
    assert.doesNotMatch(markup, /data-device-fault/, `${view}: its own view drew`)
    assert.doesNotMatch(markup, /l5-techne-instrument-constellation|registry-disclosure|L0′/, `${view}: the design's sample never stands in`)
  }
  const all = drawn.map(([, markup]) => markup).join('\n')
  assert.ok(all.includes('Archetypal-Numerical') && all.includes(escaped("L5' Divine Logos")), 'the lens chooser lists QL\'s own lenses, by QL\'s codes')
  assert.ok(all.includes(escaped(effects.LENS_REFUSE['lens.mode'])), 'a refused control says why')
  // A refusal is drawn in QL's words, and asked again when a view next opens.
  lenses.resetLensRegistry({call: registryCall({'mef-lenses': 'ql: the registry is unavailable', 'context-frame-list': QL_REGISTRY.context_frame_list, 'service-capabilities': QL_REGISTRY.service_capabilities}, asked)})
  await lenses.ensureLensRegistry()
  const refused = effects.lensBinding(lenses.lensRegistry())
  assert.equal(refused.values.lenses, undefined)
  assert.equal(refused.standing.lenses.disabled, 'ql: the registry is unavailable')
  assert.ok(refused.values.frames, 'each list stands on its own answer')
  asked.length = 0
  await lenses.ensureLensRegistry()
  assert.deepEqual(asked.map(op => op.request.kind), ['mef-lenses'], 'only the refused list is asked again')
  lenses.resetLensRegistry()
})

// REAL (tests/fixtures/ql-mef-lenses-sublenses-2026-10-21.json): `ql mef lenses` with each lens's six sublenses (QL-MEF pull 349).
const QL_SUBLENSES = JSON.parse(readFileSync(new URL('./fixtures/ql-mef-lenses-sublenses-2026-10-21.json', import.meta.url), 'utf8'))

test('the Lens draws each lens\'s six sublenses where QL carries them, and holds the lens and sublens you choose (REAL answer)', async () => {
  const lenses = await import('../src/techne/devices/lensRegistry.ts')
  lenses.resetLensRegistry({call: registryCall({'mef-lenses': QL_SUBLENSES, 'context-frame-list': QL_REGISTRY.context_frame_list, 'service-capabilities': QL_REGISTRY.service_capabilities})})
  await lenses.ensureLensRegistry()
  devices.resetHolds()
  const empty = effects.lensBinding(lenses.lensRegistry(), devices.heldFor(effects.LENS_ID))
  const drawn = JSON.parse(empty.values.lenses)
  assert.deepEqual(drawn.map(l => l.code), QL_SUBLENSES.answer.lenses.map(l => l.code), 'QL\'s lenses, by QL\'s codes')
  assert.deepEqual(drawn[10].sublenses, ['Anuttara/Asambhava', 'Para Vāk', 'Paśyantī', 'Madhyamā', 'Vaikharī', 'Mātṛkā'], 'L5\'s labels in position order, from QL')
  assert.equal(drawn[10].lensRef, 'mef:lens:L5@1', 'the rest of the entry as QL gives it')
  assert.match(empty.standing.lenses.disabled, /each with its six sublenses/)
  assert.equal(empty.values['lens.lens'], undefined, 'no lens is held until you choose one: never the design\'s L5')
  // The lens and sublens are the view's own: set through the binding's hands, never written to an owner.
  empty.local['lens.lens']('L5'); empty.local['lens.sublens']('2')
  const held = effects.lensBinding(lenses.lensRegistry(), devices.heldFor(effects.LENS_ID))
  assert.deepEqual([held.values['lens.lens'], held.values['lens.sublens']], ['L5', '2'])
  const all = hostedAll(DESIGNS.lens, held).map(([, markup]) => markup).join('\n')
  assert.ok(all.includes('Paśyantī') && all.includes('Mātṛkā'), 'the ring and the chooser draw QL\'s sublenses of the lens you hold')
  assert.doesNotMatch(all, /\bNaN\b|undefined|data-device-fault/)
  // A lens entry whose sublenses are not QL's six is drawn without them.
  assert.equal(lenses.sublensLabels({sublenses: [{position: 0, label: 'x'}]}), undefined)
  assert.equal(lenses.sublensLabels({sublenses: Array.from({length: 6}, (_, i) => ({position: 5 - i, label: 'x'}))}), undefined)
  devices.resetHolds()
  lenses.resetLensRegistry()
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
    ['graph', 'knowledge-graph__graph.tsx', graphB.graphBinding(surface, graphB.surfaceRead(surface), writes), key => graphB.graphAbsent(surface, graphB.surfaceRead(surface), key)],
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
  assert.ok(summary.palace.reading >= 20 && summary.graph.reading >= 17 && summary.timeline.reading >= 13 && summary.canvas.reading >= 16 && summary.journey.reading >= 30, JSON.stringify(summary))
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
    [DESIGNS.graph, graphB.graphBinding(fakeSurface(), graphB.surfaceRead(fakeSurface()), writes), /Quaternal-Tarot|Point-Cloud-Demo|face-rig/, [], []],
    [DESIGNS.graph, graphB.graphBinding(null, null, writes), /Quaternal-Tarot|Point-Cloud-Demo|face-rig/, [], [graphB.NOT_OPEN]],
    [DESIGNS.journey, frameB.journeyBinding(frameOf('journey')), /Nocturne|Fine, irregular stippling\. Form|Language/, ['Gather', 'Rounded grains find a shared current.'], [frameB.JOURNEY_REFUSE.snap]],
    [DESIGNS.journey, frameB.journeyBinding(frameOf('journey', {research: null})), /Nocturne|Fine, irregular stippling|Language/, [], []],
    [DESIGNS.timeline, frameB.timelineBinding(timelineFrame, LAW([])), /Naassene|Kabbala|Late antiquity/, ['An event of the frame', '1700'], [frameB.TIMELINE_REFUSE.mode]],
    [DESIGNS.canvas, frameB.canvasBinding(frameOf('canvas', {chrome: CANVAS_CHROME})), /Which centre speaks first|Sacral|Lower three/, ['A frame of the board', '84'], [frameB.CANVAS_REFUSE.promote]],
    [DESIGNS.light, effects.lightBinding(), /The river dream|Grief, unsaid|Change jobs/, [], [effects.LIGHT_REFUSE['light.bounces']]],
    [DESIGNS.lens, effects.lensBinding(), /l5-techne-instrument-constellation|registry-disclosure|Fourfold-Zero/, [], [effects.LENS_REFUSE['lens.mode']]],
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
  for (const file of ['palaceBinding.ts', 'graphBinding.ts', 'graphRead.ts', 'frameBindings.ts', 'effectBindings.ts', 'lensRegistry.ts', 'techneDesigns.ts', 'designDevices.ts']) {
    const source = read(`techne/devices/${file}`)
    assert.doesNotMatch(source, /\.defaults\b|\.fixtures\b|catalogue\/panels\//, `${file}: no design default or fixture`)
    assert.deepEqual(source.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [], [], `${file}: shell tokens only`)
  }
  assert.match(read('techne/devices/palaceBinding.ts'), /palaceSession\.ts/)
  assert.match(read('techne/devices/graphBinding.ts'), /the kernel `graph` op/)
  assert.match(read('techne/devices/graphBinding.ts'), /knowledgeGraphHandle\.ts reading, project, query/)
  assert.match(read('techne/devices/frameBindings.ts'), /HostedAppState\.research/)
})

test('B: the open graph publishes its own reading, register, query, selection act and overview toggle on its handle (source reading)', () => {
  const surface = readFileSync(new URL('../../../../desktop/cradle/src/knowledge/KnowledgeSurface.tsx', import.meta.url), 'utf8')
  const handle = readFileSync(new URL('../../../../desktop/cradle/src/knowledge/knowledgeGraphHandle.ts', import.meta.url), 'utf8')
  const canvas = readFileSync(new URL('../../../../desktop/cradle/src/knowledge/GraphCanvas.tsx', import.meta.url), 'utf8')
  for (const member of ['readonly reading: GraphReading | null', 'readonly loading: boolean', 'readonly project: string | undefined', 'readonly query: string', 'readonly minimap: boolean', 'select(ref: string): void', 'setMinimap(on: boolean): void'])
    assert.ok(handle.includes(member), `the handle declares ${member}`)
  assert.match(surface, /reading:model\?\?null,loading:busy,project:binding\.project,query:visit\.query,minimap,/, 'the surface publishes the reading it draws, with its register and query')
  assert.match(surface, /select:selectRef,setMinimap/, 'its own acts: the canvas press and the overview toggle')
  assert.match(surface, /pressRef\.current=\(ref:string\)=>\{[\s\S]*?select\(node\);/, 'a select by ref is the canvas\'s own press (select)')
  assert.match(surface, /<GraphCanvas minimap=\{minimap\} onMinimap=\{setMinimap\}/, 'the canvas draws the overview the surface holds')
  assert.match(canvas, /const minimap=props\.minimap\?\?ownMinimap;/, 'a canvas no surface holds keeps its own overview')
})

test('A: the frame announces its research reading and runs the walk\'s and the camera\'s acts as its own (source reading)', () => {
  const app = readFileSync(new URL('../../../../desktop/cradle/expressions-app/field-studies-journeys/src/app.ts', import.meta.url), 'utf8')
  const instruments = readFileSync(new URL('../../../../desktop/cradle/expressions-app/field-studies-journeys/src/researchInstruments.tsx', import.meta.url), 'utf8')
  const boundary = readFileSync(new URL('../../../expressions-boundary/src/protocol.ts', import.meta.url), 'utf8')
  assert.match(app, /journeyReadingOf\(store\.document,\{index:sceneIndex,local:sceneElapsed,playing:journeyPlaying,entered:crossingStands\}\),\.\.\.\(researchInstruments\?\.reading\(\)\?\?\{\}\)/, 'the walk from the Journey document, the board and ruler from the instruments')
  assert.match(app, /\.\.\.researchState\(\),\.\.\.chromeState\(\)\};/, 'announced with the state')
  assert.match(app, /jumpToJourneyTime\(expressionTiming\(store\.document,command\.index,command\.seconds\?\?0\)\.time\)/, 'stand: the transport\'s own jump')
  assert.match(app, /setSavedScenePlay\(true\)/, 'play: the scene strip\'s own Play')
  assert.match(app, /journeyInstrument\.enter\(\)/, 'enter: the presented beat\'s own Enter')
  assert.match(app, /returnToJourney\(\);break;/, 'return: the crossing\'s own return')
  assert.match(app, /researchInstruments\.setCamera\(command\)/, 'the camera: the canvas\'s own fly')
  assert.match(instruments, /flyToNode\('',viewportOf\(camera,pane\)\)/, 'the overview\'s own path')
  assert.match(boundary, /const research = readFrameResearch\(raw\.research\);/, 'the boundary reads it exactly or refuses the reading')
})

test('the Torus\'s Stage page on the stage the frame announced: its slots, bindings, the procedures the frame holds and the last act; Evaluate, Bind, Unbind and Retire as the stage\'s own operations', async () => {
  const torusDevice = await import('../src/live/torusDevice.ts')
  const {torus} = await import('../src/inhabitants/catalogue/panels/torus.tsx')
  const {readFrameStage, stageReadingOf, STUDIO_PROCEDURE} = await import('../../../../desktop/cradle/expressions-app/field-studies-journeys/src/stageReading.ts')
  // The frame's announcement from a disclosure it read, the procedure it holds and its last act (stageReading.ts stageReadingOf).
  const disclosure = {schema: 'ql.stage-state/v1', subject_ref: 'ql:subject:live', generation: 7,
    slots: {form: {owner: 'ta-onta:stage:cli-fold', revision: 1}, 'material.damping': {}, 'clock.inscription': {}, 'clock.lensing': {}},
    bindings: [{procedure_ref: 'ta-onta:stage:cli-bound', revision: 2, determinant: 'm1-advance', evaluations: 5, max_evaluations: 16, standing: 'active'}]}
  const announced = stageReadingOf(disclosure, false, {standing: 'refused', why: 'no binding names ta-onta:stage:other'})
  const stage = readFrameStage(JSON.parse(JSON.stringify(announced)))
  assert.ok(stage, 'the boundary admits the announcement exactly')
  const runs = []
  const run = async command => { runs.push(command); return {ok: true} }
  const binding = torusDevice.torusDesignBinding(null, undefined, {}, stage, undefined, run, {'stage.budget': 32})
  assert.deepEqual(JSON.parse(binding.values['stage.slots'])[0], {slot: 'form', owner: 'ta-onta:stage:cli-fold', revision: 1})
  assert.deepEqual(JSON.parse(binding.values['stage.bindings']), [{procedure: 'ta-onta:stage:cli-bound', trigger: 'm1-advance', evaluations: 5, max: 16, standing: 'active'}])
  assert.deepEqual(JSON.parse(binding.values['stage.procedures']), [{ref: STUDIO_PROCEDURE.ref, revision: 1, trigger: 'invocation', selector: ['material.damping']}], 'the procedure the frame holds')
  assert.deepEqual([binding.values['stage.last'], binding.values['stage.why']], ['refused', 'no binding names ta-onta:stage:other'], 'the last act\'s standing, the owner\'s words')
  assert.equal(binding.values['stage.budget'], 32, 'the budget is the view\'s own')
  for (const key of ['stage.procedure', 'stage.budget']) assert.equal(typeof binding.local[key], 'function', `${key}: the view\'s own`)
  for (const key of ['stage.evaluate', 'stage.bind', 'stage.unbind', 'stage.retire']) { assert.equal(binding.writes(key), true, key); assert.equal(binding.standing[key], undefined, key) }
  await binding.write([{key: 'stage.evaluate', value: STUDIO_PROCEDURE.ref}, {key: 'stage.bind', value: 'ta-onta:stage:cli-bound'}, {key: 'stage.unbind', value: 'ta-onta:stage:cli-bound'}, {key: 'stage.retire', value: 'ta-onta:stage:cli-fold'}])
  assert.deepEqual(runs, [
    {command: 'procedural-stage', action: 'evaluate', procedure_ref: STUDIO_PROCEDURE.ref},
    {command: 'procedural-stage', action: 'bind', procedure_ref: 'ta-onta:stage:cli-bound', max_evaluations: 32},
    {command: 'procedural-stage', action: 'unbind', procedure_ref: 'ta-onta:stage:cli-bound'},
    {command: 'procedural-stage', action: 'retire', procedure_ref: 'ta-onta:stage:cli-fold'}], 'each act the stage\'s own operation, the bind with the budget held')
  const refusing = torusDevice.torusDesignBinding(null, undefined, {}, stage, undefined, async () => ({ok: false, error: 'the owner refused'}))
  await assert.rejects(refusing.write([{key: 'stage.retire', value: 'x'}]), /the owner refused/)
  // No frame: the acts are named; no stage disclosed: every stage reading and act is named.
  const unmounted = torusDevice.torusDesignBinding(null, undefined, {}, stage, undefined, null)
  assert.match(unmounted.standing['stage.bind'].disabled, /No Expressions application is mounted/)
  const none = torusDevice.torusDesignBinding(null, undefined, {}, null, undefined, run)
  assert.equal(none.values['stage.slots'], undefined)
  for (const key of ['stage.slots', 'stage.procedures', 'stage.evaluate']) assert.match(none.standing[key].disabled, /has disclosed no stage yet/, key)
  // the design draws the stage on that binding, on its Stage page, with nothing absent drawn as text
  host.setHostPage(binding.id, 'stage')
  const markup = renderToStaticMarkup(createElement(host.HostedDevice, {designed: torus, binding, view: 'whole', nav: {}}))
  host.resetHost(binding.id)
  assert.doesNotMatch(markup, /\bNaN\b|undefined|data-device-fault/)
  assert.ok(markup.includes('refused'), 'the last act\'s standing is drawn')
})

test('the graph\'s Aperture page asks QL\'s living-wiki plan for the request it holds: admitted and omitted positions, the depth, and QL\'s own refusal of Formal', async () => {
  const plan = await import('../src/techne/devices/livingPlan.ts')
  const graphB = await import('../src/techne/devices/graphBinding.ts')
  // REAL: `ql wiki living-plan` at QL-MEF #346 (tests/fixtures/ql-wiki-living-plan-2026-10-21.json); the kernel's envelope around each.
  const real = JSON.parse(readFileSync(new URL('./fixtures/ql-wiki-living-plan-2026-10-21.json', import.meta.url), 'utf8')).cases
  const answers = new Map(real.map(c => [JSON.stringify(c.input), c.exit === 0 ? {outcome: {result: 'owner_route_reading', data: c.answer}} : {outcome: null, error: c.stderr.replace(/^ql: /, '')}]))
  const asked = []
  plan.resetLivingPlan({call: async op => { asked.push(op); return answers.get(JSON.stringify(op.request.request)) ?? {outcome: null, error: 'no capture'} }})
  assert.deepEqual(plan.livingPlanRequest({}), {ok: false, reason: plan.NO_MODE}, 'no mode: nothing is asked')
  await plan.syncLivingPlan({'aperture.mode': 'explain', 'aperture.positions': JSON.stringify([2])})
  assert.deepEqual(asked.at(-1), {op: 'ql_read', request: {kind: 'wiki-living-plan', request: real[0].input}}, 'the request in QL\'s own fields; the library\'s budget of six')
  const writes = {setter: async () => {}, patch: () => {}}
  const held = {'aperture.mode': 'explain', 'aperture.positions': JSON.stringify([2])}
  const binding = graphB.graphBinding(null, null, writes, held, plan.livingPlanState())
  assert.deepEqual([binding.values['aperture.admitted'], binding.values['aperture.omitted'], binding.values['aperture.depth'], binding.values['aperture.refraction']],
    [JSON.stringify([5, 0, 1, 2]), JSON.stringify([]), 'partial', false], 'QL\'s plan: the entry, then 2')
  assert.equal(binding.values['aperture.mode'], 'explain', 'the request is the view\'s own')
  await plan.syncLivingPlan({'aperture.mode': 'explain', 'aperture.positions': JSON.stringify([2, 3]), 'aperture.context': true, 'aperture.budget': 4})
  assert.deepEqual(JSON.parse(plan.livingPlanValues(plan.livingPlanState())['aperture.omitted']), [3, 4], 'the budget left 3 and 4 out')
  await plan.syncLivingPlan({'aperture.mode': 'formal'})
  assert.equal(plan.livingPlanState().reading.reason, 'formal Living Wiki depth requires an existing WikiRefractionRequest', 'QL\'s refusal, in its words')
  const formal = graphB.graphBinding(null, null, writes, {'aperture.mode': 'formal'}, plan.livingPlanState())
  assert.equal(formal.standing['aperture.depth'].disabled, 'formal Living Wiki depth requires an existing WikiRefractionRequest')
  const calls = asked.length
  await plan.syncLivingPlan({'aperture.mode': 'formal'})
  assert.equal(asked.length, calls, 'one ask per request')
  // the design draws the plan on its Aperture page, its fixture never standing in
  const {design} = await import('../src/inhabitants/catalogue/panels/knowledge-graph__graph.tsx')
  await plan.syncLivingPlan(held)
  host.setHostPage(binding.id, 'aperture')
  const markup = renderToStaticMarkup(createElement(host.HostedDevice, {designed: design, binding: graphB.graphBinding(null, null, writes, held, plan.livingPlanState()), view: 'whole', nav: {}}))
  host.resetHost(binding.id)
  assert.doesNotMatch(markup, /\bNaN\b|undefined|data-device-fault/)
  plan.resetLivingPlan()
})
