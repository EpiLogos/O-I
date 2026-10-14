// The occurrence seam's refresh (projections/atlas/src: T-ATLAS-SEAM) and the controller's dispose guard (T-ATLAS-DISPOSE).
// A placed occurrence is searchable at once and a removed one is not, by one entry's update of the search index (equal to a
// full rebuild); the graph is stale after a change and is built again at its next opening; the reveal stays open when an
// unrelated occurrence is removed; a controller disposed with a view still loading writes nothing and mounts nothing. The
// model is the founding FIXTURE of occurrence-seam.test.mjs; the graph and controller are driven through their own methods
// on objects built from their prototypes (no canvas, no page), so what is checked is the atlas's own code.
import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'

const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};
import {readFile} from 'node:fs/promises';
export async function resolve(s, c, n) {
  try { return await n(s, c) } catch (e) {
    if (!s.startsWith('.')) throw e;
    if (s.endsWith('.js')) { try { return await n(s.slice(0, -3) + '.ts', c) } catch {} }
    for (const x of ['.ts', '.tsx']) { try { return await n(s + x, c) } catch {} }
    throw e;
  }
}
export async function load(u, c, n) {
  if (u.endsWith('.css')) return {format: 'module', shortCircuit: true, source: 'export {}'};
  if (!u.endsWith('.ts') && !u.endsWith('.tsx')) return n(u, c);
  const source = (await readFile(new URL(u), 'utf8')).replace(/import\\.meta\\.env/g, '({BASE_URL:"/"})');
  return {format: 'module', shortCircuit: true, source: ts.transpileModule(source, {fileName: new URL(u).pathname,
    compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX}}).outputText};
}`)}`, import.meta.url)

const {adaptFoundingFixture} = await import('./support/foundingFieldFixture.mjs')
const {buildModel} = await import('../src/projections/atlas/src/data/model.ts')
const {replaceModelOccurrence} = await import('../src/projections/atlas/src/data/occurrenceSeam.ts')
const {buildSearchIndex, refreshOccurrenceEntry, search} = await import('../src/projections/atlas/src/data/search.ts')
const {buildGraph} = await import('../src/projections/atlas/src/graph/build.ts')
const {GraphView} = await import('../src/projections/atlas/src/graph/view.ts')
const {Controller} = await import('../src/projections/atlas/src/app/controller.ts')
const {beginLifetime, listen} = await import('../src/projections/atlas/src/ui/lifetime.ts')
const qlSky = await import('../src/inhabitants/qlSkyEarthAdapter.ts')
const {checkOccurrence} = await import('../src/projections/occurrence.ts')

const founded = () => ({
  meta: {generatedAt: '2026-10-13T00:46:34.423Z', vaultPath: '/vault/jung-archetypal-field', vaultLedgerLine: 'LEDGER LINE',
    counts: {archetypes: 1, theoretics: 0, families: 1, occurrences: 1, cultures: 0, images: 0}, yearMin: 1698, yearMax: 1698},
  archetypes: [{id: 'wayfinding', name: 'Wayfinding', oneLine: 'A course held.', prime: false, spectrum: {position: 0.8}, palette: {core: '#fff', glow: '#eee', fog: '#111', deep: '#000'}, body: [], familyIds: ['lighthouse'], occurrenceCount: 1, archetypes: []}],
  theoretics: [],
  families: [{id: 'lighthouse', name: 'Lighthouse', subtype: 'object', aliases: [], oneLine: '', archetypes: [{id: 'wayfinding', basis: 'jung'}], spectrum: {position: 0.5}, palette: {core: '#fff', glow: '#eee', fog: '#111', deep: '#000'}, body: [], occurrenceIds: ['eddystone'], synthesised: false}],
  occurrences: [
    {id: 'eddystone', title: 'Eddystone', label: 'Eddystone', familyId: 'lighthouse', coFamilyIds: [], locusType: 'artifact', subject: 'jung', cultureIds: [], place: 'Channel', lat: 50.18, lon: -4.27, geoPrecision: 'place', year: 1698, yearDisplay: '1698', jung: [{work: 'cw12', workTitle: 'Psychology and Alchemy', year: '1936/44', locator: '¶357 (pdf p268)'}], body: [], parallelIds: []},
  ],
  cultures: [],
  joins: [],
})
const snapshot = (epochUtc, lat, lon) => ({
  schema: 'ql.sky-snapshot/v1', snapshot_ref: `sha256:${epochUtc.replace(/\D/g, '').padEnd(64, '0')}`, epoch_utc: epochUtc,
  epoch_unix_ms: Date.parse(epochUtc), receipt_unix_ms: Date.parse(epochUtc) + 1000,
  subsolar: {latitude_degrees: lat, longitude_degrees: lon},
})
const sunOccurrence = (epochUtc, lat, lon) => {
  const checked = qlSky.subsolarOccurrence(snapshot(epochUtc, lat, lon))
  assert.equal(checked.ok, true, 'the stated point is admitted by the contract')
  return checked.value
}
const PLAIN = {...qlSky.QL_SKY_FAMILY, id: 'plain-family', name: 'Plain', oneLine: '', archetypes: [], occurrenceIds: []}
const fresh = () => buildModel(adaptFoundingFixture(founded()))

/** The index entries and their posting lists, as comparable values (keys and the entries' keys, in posting order). */
function shapeOf(idx) {
  const postings = {}
  for (const [key, list] of idx.candidates) postings[key] = list.map(e => e.key).sort()
  return {entries: idx.entries.map(e => e.key).sort(), postings}
}
// the occurrence's own hits: the family the Sun belongs to also answers to its name
const sunHits = idx => search(idx, 'subsolar').filter(r => r.kind === 'occurrence').map(r => r.key)

test('a Sun placed after the index is built is found by search, at once', () => {
  const model = fresh()
  const idx = buildSearchIndex(model)
  assert.deepEqual(sunHits(idx), [], 'no Sun before it is placed')
  const sun = sunOccurrence('2026-03-20T12:00:00Z', -0.05, 1.9)
  replaceModelOccurrence(model, sun, 'sky-subsolar', qlSky.QL_SKY_FAMILY)
  refreshOccurrenceEntry(idx, 'sky-subsolar')
  assert.deepEqual(sunHits(idx), ['o:sky-subsolar'], 'the placed Sun is the search result for its label')
})

test('a Sun removed from the field is no longer listed by search', () => {
  const model = fresh()
  replaceModelOccurrence(model, sunOccurrence('2026-03-20T12:00:00Z', -0.05, 1.9), 'sky-subsolar', qlSky.QL_SKY_FAMILY)
  const idx = buildSearchIndex(model)
  assert.deepEqual(sunHits(idx), ['o:sky-subsolar'])
  const change = replaceModelOccurrence(model, null, 'sky-subsolar')
  assert.equal(change.removed, true)
  refreshOccurrenceEntry(idx, 'sky-subsolar')
  assert.deepEqual(sunHits(idx), [], 'the removed Sun is not listed')
  assert.equal(idx.entries.some(e => e.key === 'o:sky-subsolar'), false, 'its entry is gone, not just hidden')
})

test('a replaced Sun is searched under its new reading; the patched index equals a full rebuild of the same model', () => {
  const model = fresh()
  const idx = buildSearchIndex(model)
  const sun = sunOccurrence('2026-03-20T12:00:00Z', -0.05, 1.9)
  replaceModelOccurrence(model, sun, 'sky-subsolar', qlSky.QL_SKY_FAMILY)
  refreshOccurrenceEntry(idx, 'sky-subsolar')
  const moved = {...sunOccurrence('1931-01-01T00:00:00Z', 23.4, -120.0), label: 'Solstice point'}
  replaceModelOccurrence(model, moved, 'sky-subsolar', qlSky.QL_SKY_FAMILY)
  refreshOccurrenceEntry(idx, 'sky-subsolar')
  assert.deepEqual(search(idx, 'solstice').filter(r => r.kind === 'occurrence').map(r => r.key), ['o:sky-subsolar'], 'the replaced Sun answers to its new label')
  assert.equal(idx.entries.find(e => e.key === 'o:sky-subsolar').label, 'Solstice point', 'its entry carries the new label')
  const rebuilt = buildSearchIndex(model)
  assert.deepEqual(shapeOf(idx), shapeOf(rebuilt), 'the patched entries and postings equal a full rebuild')
  for (const q of ['solstice', 'lighthouse', 'eddystone', 'w', 'wayfinding']) {
    assert.deepEqual(search(idx, q), search(rebuilt, q), `the query "${q}" answers as a rebuild would`)
  }
})

test('the graph is stale after an occurrence changes, and is built again from the model at its next opening', async () => {
  const model = fresh()
  const life = beginLifetime()
  try {
    const view = Object.create(GraphView.prototype)
    const setTargets = []
    Object.assign(view, {
      model, visible: false, stale: false, touches: new Set(), coast: {stop() {}},
      root: {classList: {add() {}, remove() {}}, setAttribute() {}, inert: false},
      sky: {on: false, status: 'off', asOf: '', source: null}, target: {subject: null, selected: null, emphasis: null},
      active: new Map(), activeEdges: [], simNodes: [], emph: null, subject: -1, selected: -1, hover: -1, press: null, dragging: -1,
      lastClick: null, lastTargetKey: '', qt: null, qtStale: true, rebuilds: 0, h_: {onControls() {}},
    })
    view.resize = () => {}
    view.wake = () => {}
    view.rebuild = function rebuild() { this.rebuilds++; this.active = new Map([[0, 0]]) }
    view.setTarget = function setTarget(t) { setTargets.push(t); }
    view.pushTools = () => {}
    const nodeCount = () => view.nodes.length

    // the graph as the constructor leaves it: the field's nodes, built from the model
    view.gBase = view.g = buildGraph(model)
    view.nodes = view.g.nodes.map(n => view.makeNode(n))
    view.live = new Float32Array(view.g.nodes.length).fill(1)
    view.show(false)
    assert.equal(view.rebuilds, 1, 'the first opening builds the graph')
    const before = nodeCount()
    view.visible = false
    view.active = new Map()

    // the Sun is placed while the graph is shut: nothing is rebuilt yet, the graph is only marked stale
    replaceModelOccurrence(model, sunOccurrence('2026-03-20T12:00:00Z', -0.05, 1.9), 'sky-subsolar', qlSky.QL_SKY_FAMILY)
    GraphView.prototype.markStale.call(view)
    assert.equal(nodeCount(), before, 'a stale graph is not rebuilt until it opens')

    setTargets.length = 0
    view.show(false)
    assert.equal(nodeCount(), buildGraph(model).nodes.length, 'the next opening builds the graph from the model, Sun included')
    assert.ok(view.g.byKey.has('o:sky-subsolar'), 'the placed Sun is a node of the rebuilt graph')
    assert.equal(view.stale, false, 'the graph is fresh again once built')
    assert.deepEqual(setTargets.at(-1), {subject: null, selected: null, emphasis: null}, 'the target is re-applied by key, with no stale emphasis')

    // a second opening with no change does not rebuild the nodes again
    view.visible = false
    const built = view.nodes
    view.show(false)
    assert.equal(view.nodes, built, 'an opening with no change keeps the built graph')
  } finally {
    life.dispose()
  }
})

test('refreshOccurrences hides the reveal only when it shows the removed occurrence', () => {
  const model = fresh()
  replaceModelOccurrence(model, sunOccurrence('2026-03-20T12:00:00Z', -0.05, 1.9), 'sky-subsolar', qlSky.QL_SKY_FAMILY)
  const ctl = Object.create(Controller.prototype)
  const log = {reveal: [], search: 0, graph: 0, applied: 0}
  Object.assign(ctl, {
    m: model, rel: new Float32Array(0), filter: {}, searchIndex: buildSearchIndex(model), graph: null,
    hover: {hide() {}},
    reveal: {shown: 'eddystone', shows(id) { return this.shown === id }, hide() { log.reveal.push('hide') }},
  })
  ctl.applyFilter = () => { log.applied++ }
  // an unrelated occurrence leaves: the reveal of 'eddystone' stays up
  replaceModelOccurrence(model, null, 'sky-subsolar')
  ctl.refreshOccurrences({id: 'sky-subsolar', removed: true})
  assert.deepEqual(log.reveal, [], 'an unrelated removal leaves the reveal open')
  assert.equal(log.applied, 1, 'the filter still follows the new count')
  // the reveal shows the occurrence that leaves: it is hidden
  ctl.reveal.shown = 'sky-subsolar'
  ctl.refreshOccurrences({id: 'sky-subsolar', removed: true})
  assert.deepEqual(log.reveal, ['hide'], 'a removal of the shown occurrence hides the reveal')
})

test('refreshOccurrences marks the graph stale for the occurrence that changed, and updates its search entry', () => {
  const model = fresh()
  const ctl = Object.create(Controller.prototype)
  let stale = 0
  Object.assign(ctl, {
    m: model, rel: new Float32Array(0), filter: {}, searchIndex: buildSearchIndex(model),
    graph: {markStale() { stale++ }}, hover: {hide() {}}, reveal: {shows() { return false }, hide() {}},
  })
  ctl.applyFilter = () => {}
  replaceModelOccurrence(model, sunOccurrence('2026-03-20T12:00:00Z', -0.05, 1.9), 'sky-subsolar', qlSky.QL_SKY_FAMILY)
  ctl.refreshOccurrences({id: 'sky-subsolar', removed: false})
  assert.equal(stale, 1, 'a change marks the graph stale')
  assert.deepEqual(sunHits(ctl.searchIndex), ['o:sky-subsolar'])
})

test('a disposed controller starts nothing late: a pending view load resolves into no navigation, page write or mount', async () => {
  const model = fresh()
  const ctl = Object.create(Controller.prototype)
  ctl.navTok = 0
  ctl.disposed = false
  const pending = {}
  const waiting = new Promise(resolve => { pending.resolve = resolve })
  ctl.needs = () => waiting
  let went = 0
  let mountedInNewLifetime = 0
  const classes = new Set()
  globalThis.document = {body: {classList: {add: c => classes.add(c), remove: (...cs) => cs.forEach(c => classes.delete(c))}, dataset: {}}}
  const hashes = []
  globalThis.location = {hash: '#/'}
  globalThis.history = {replaceState: (_a, _b, h) => hashes.push(h)}
  Object.assign(ctl, {m: model})
  const go = () => {
    went++
    // a late mount would attach to whichever lifetime is live now
    listen(globalThis.window, 'resize', () => {})
    mountedInNewLifetime++
  }
  const started = Controller.prototype.whenReady.call(ctl, {view: {kind: 'world'}, deep: false}, go)
  assert.equal(started, true, 'the navigation waits for its view')
  Controller.prototype.dispose.call(ctl)
  // a new atlas is mounted in the same session before the old view's load resolves
  const newer = beginLifetime()
  const bodyBefore = [...classes]
  try {
    pending.resolve()
    await new Promise(resolve => setTimeout(resolve, 5))
    assert.equal(went, 0, 'the navigation the disposed controller waited for does not run')
    assert.equal(mountedInNewLifetime, 0)
    assert.deepEqual([...classes], bodyBefore, 'nothing is written to the page body after dispose')
    assert.equal(hashes.length, 0, 'no hash is written')
  } finally {
    newer.dispose()
  }
})

test('a disposed controller writes no hash and runs no navigation', () => {
  const ctl = Object.create(Controller.prototype)
  Object.assign(ctl, {navTok: 0, disposed: false, state: {view: {kind: 'world'}, deep: false}})
  globalThis.location = {hash: '#/'}
  let applied = 0
  ctl.apply = () => { applied++ }
  Controller.prototype.dispose.call(ctl)
  Controller.prototype.navigate.call(ctl, {view: {kind: 'world'}, deep: true})
  Controller.prototype.syncHash.call(ctl, {view: {kind: 'world'}, deep: true})
  assert.equal(applied, 0, 'no state is applied')
  assert.equal(location.hash, '#/', 'the hash is not written')
  Controller.prototype.dispose.call(ctl)
  assert.equal(ctl.disposed, true, 'dispose is idempotent')
})
