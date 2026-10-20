// T-WORLDS §5 W3, phase A: the World device's Body page — its rows, its design binding, its setters — over the owner's record.
// Owners write, faces read: the record is read from its owner and a change goes back as one BodySet against the revision it was
// read at; a reroll is the owner's write of a new seed; the body choice is the view's own; nothing here holds or invents a body.
// Channels: scripted. The store, the rows and the setters are the shell's own code in memory; the owner is a FAKE standing for the
// kernel's `world_body_read` and the `aikit.wiki.facts.apply` Action (the real owner is ai-kit knowledge_wiki_facts.rs, tested there).
import test, {beforeEach} from 'node:test'
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
  if (u.endsWith('.css')) return {format: 'module', shortCircuit: true, source: 'export {}'};
  if (u.includes('?raw') || u.includes('.html')) return {format: 'module', shortCircuit: true, source: 'export default ""'};
  if (u.endsWith('.json')) return {format: 'module', shortCircuit: true, source: 'export default ' + await readFile(new URL(u), 'utf8')};
  if (!u.endsWith('.ts') && !u.endsWith('.tsx')) return n(u, c);
  const out = ts.transpileModule(await readFile(new URL(u), 'utf8'), {fileName: new URL(u).pathname,
    compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX}}).outputText;
  return {format: 'module', shortCircuit: true, source: out.split('import.meta.env').join('({BASE_URL: "/"})')};
}`)}`, import.meta.url)

const pending = process.env.W3Q_GATE === 'enforce' ? {} : {todo: 'T-PROCEDURAL-BODY: red until the system lane lands'}

globalThis.__CRADLE_WALK__ = false
const door = await import('../src/inhabitants/familyManifest.ts')
const world = await import('../src/inhabitants/worldShellFamilies.ts')
const {inhabitantManifest} = await import('../src/inhabitants/manifest.ts')
const store = await import('../src/projections/atlas/body/worldBody.ts')
const body = await import('../src/projections/atlas/src/globe/body.ts')
const atlasDevs = await import('../src/inhabitants/ql/devices/atlasDevices.ts')
const bridge = await import('../src/agent/shellSetterBridge.ts')
const {shellSetter} = await import('../src/inhabitants/sdk/shellSetters.ts')
const {TimeModel} = await import('../src/projections/atlas/src/state/timeModel.ts')
const {createTimeScale} = await import('../src/projections/atlas/src/data/time.ts')

door.resetFamilyManifestsForTest()
world.loadWorldShellFamilies()
const globeFace = inhabitantManifest('atlas-earth').faces.find(face => face.id === 'globe-engine')

// FIXTURE: the owner's reading of the root register (kernel construction.rs read_body's shape) and a body in the record's shape.
const RECORD = Object.freeze({
  body_ref: 'body:central:wiki:root', seed: 20261018, generator: {id: 'fbm-sphere', version: 1},
  landmass: {sea_level: .5, continents: 1.7, relief: .55, coast: 'smooth'}, climate: {warmth: .58, moisture: .6, ice_caps: .3},
  sky: {atmosphere: .6, clouds: .35, axial_tilt_deg: 18},
})
const readingOf = (record, revision) => ({schema: 'oi.world-body-reading/v1', register: null, space: {ref: 'central:wiki:root', revision, title: 'Central'},
  disclosed_revision: revision, body: record, wiki_source: {path: 'Control/agents/wiki/wiki.json', ref: 'central:source:wiki', revision: 'r'},
  owner_operation: 'aikit wiki-construct facts-inspect'})

/** A fake owner holding one record at a revision: a write lands only on the revision it was read at, as the owner's CAS does. */
function fakeOwner(record = RECORD, revision = 67) {
  const owner = {record, revision, writes: [],
    async read() { return readingOf(owner.record, owner.revision) },
    async write(next, basis) {
      owner.writes.push({body: next, basis})
      if (basis.revision !== owner.revision) throw Error('the exact native target changed; reread before editing its facts')
      owner.record = next
      owner.revision += 1
    }}
  return owner
}
const engine = () => ({drawn: [], setBody(record) { this.drawn.push(record) }})
const settle = () => new Promise(resolve => setTimeout(resolve, 0))
let binding = null
async function bind(owner, globe = engine()) {
  binding?.dispose()
  binding = store.bindWorldBody({engine: globe, owner})
  await settle()
  return globe
}
const set = async (path, value) => shellSetter(path)(value)
const handle = () => ({ctl: {graphControls: null, globeScope: {scope: null, wholeField: false}, subscribeFaces() { return () => {} }},
  time: new TimeModel(), engine: {baseKind: '2k'}, model: {scale: createTimeScale(-1000, 1960)}})

beforeEach(() => {
  binding?.dispose()
  binding = null
  store.chooseBody('earth')
  bridge.registerAtlasShellSetters()
})

test('the record reads from its owner; the globe draws your body only while your world is chosen, and the Earth stays given', async () => {
  const globe = await bind(fakeOwner())
  const state = store.worldBodyState()
  assert.equal(state.state, 'read')
  assert.deepEqual(state.record, RECORD)
  assert.equal(globe.drawn.at(-1), null, 'the Earth by default: the atlas exactly as it was')
  assert.equal((await set('shell.setWorldBodyChoice', 'own')).kind, 'fired')
  assert.deepEqual(globe.drawn.at(-1), RECORD, 'your own body in the Earth\'s place')
  await set('shell.setWorldBodyChoice', 'earth')
  assert.equal(globe.drawn.at(-1), null)
  const refused = await set('shell.setWorldBodySeaLevel', .3)
  assert.equal(refused.kind, 'refused')
  assert.match(refused.reason, /Earth is given/)
})

test('a change is one BodySet of the whole body at the revision it was read at; nothing else moves', async () => {
  const owner = fakeOwner()
  await bind(owner)
  store.chooseBody('own')
  const receipt = await set('shell.setWorldBody', {seaLevel: .4, coast: 'fjord'})
  assert.equal(receipt.kind, 'fired', receipt.reason)
  assert.match(receipt.note, /saved at revision 68/)
  assert.equal(owner.writes.length, 1, 'two changes of one gesture are one write')
  const {body: sent, basis} = owner.writes[0]
  assert.deepEqual(basis, {space_ref: 'central:wiki:root', revision: 67})
  assert.equal(sent.landmass.sea_level, .4)
  assert.equal(sent.landmass.coast, 'fjord')
  assert.equal(sent.seed, RECORD.seed, 'the seed stays')
  assert.deepEqual(sent.climate, RECORD.climate)
  assert.deepEqual(sent.sky, RECORD.sky)
  assert.deepEqual(Object.keys(sent).sort(), Object.keys(RECORD).sort(), 'the body carries no location: a write never touches one')
  assert.deepEqual(store.worldBodyState().record, sent, 'read back from the owner')
})

test('a reroll is a BodySet with a new seed named from the record; the settings stay; nothing is random', async () => {
  const owner = fakeOwner()
  await bind(owner)
  store.chooseBody('own')
  const receipt = await set('shell.rerollWorldBody', true)
  assert.equal(receipt.kind, 'fired', receipt.reason)
  const sent = owner.writes[0].body
  assert.equal(sent.seed, body.nextSeed(RECORD, 67))
  assert.notEqual(sent.seed, RECORD.seed)
  for (const key of ['body_ref', 'landmass', 'climate', 'sky']) assert.deepEqual(sent[key], RECORD[key], `${key} stays`)
  // [T-PROCEDURAL-BODY §2: "a body built by version 1 keeps drawing as version 1, byte for byte; its next change (any dial, a reroll) rebuilds it as
  // version 2"] the fixture's body was built by generator 1: the change that writes it again names the current generator
  assert.deepEqual(sent.generator, {id: 'fbm-sphere', version: body.WORLD_BODY_GENERATOR_VERSION}, 'the generator is the current one: the change rebuilds an older body')
})

test('values outside their ranges are refused by name and never sent; a stale reading is the owner\'s refusal, verbatim', async () => {
  const owner = fakeOwner()
  await bind(owner)
  store.chooseBody('own')
  for (const [path, value, words] of [
    ['shell.setWorldBodySeaLevel', 1.4, /Sea level is 1.4; the atlas takes 0 to 1/],
    ['shell.setWorldBodyContinents', .2, /Continents is 0.2; the atlas takes 0.6 to 3.6/],
    ['shell.setWorldBodyTilt', 50, /Tilt is 50; the atlas takes 0 to 45/],
    ['shell.setWorldBodyCoast', 'jagged', /the coast is smooth, fjord or archipelago/],
    ['shell.setWorldBodySeed', 1.5, /the seed is a whole number/],
    ['shell.setWorldBody', {mood: 'stormy'}, /mood is not a setting of the body/],
    ['shell.setWorldBodyChoice', 'mars', /the body is own, earth or other/],
  ]) {
    const receipt = await set(path, value)
    assert.equal(receipt.kind, 'refused', path)
    assert.match(receipt.reason, words)
  }
  assert.equal(owner.writes.length, 0, 'nothing was sent')
  owner.revision = 70 // another hand wrote since this reading
  const stale = await set('shell.setWorldBodyRelief', .9)
  assert.equal(stale.kind, 'refused')
  assert.match(stale.reason, /reread before editing its facts/)
})

test('with no body yet, the first change builds one on the device\'s own defaults, named for its space', async () => {
  const owner = fakeOwner(null, 3)
  await bind(owner)
  store.chooseBody('own')
  assert.equal(store.worldBodyState().record, null)
  // [phase B] a world with no body yet is drawn from the body seeded from its ref, and says so: nothing is written until the person acts
  assert.deepEqual(store.shownBody(), store.firstBody('central:wiki:root', 3), 'the seeded body is drawn, the very one the first change builds on')
  assert.equal(owner.writes.length, 0, 'and nothing is written for it')
  const receipt = await set('shell.setWorldBodyWarmth', .7)
  assert.equal(receipt.kind, 'fired', receipt.reason)
  const sent = owner.writes[0].body
  assert.equal(sent.body_ref, 'body:central:wiki:root')
  assert.equal(sent.climate.warmth, .7)
  assert.deepEqual(sent.landmass, {...store.FIRST_BODY_SETTINGS.landmass})
  assert.equal(sent.seed, store.firstBody('central:wiki:root', 3).seed)
  assert.equal(body.isWorldBody(body.parseWorldBody(sent)), true)
})

test('an owner that cannot read a body leaves every body control disabled with its own words', async () => {
  const reason = 'facts target must be an existing Wiki node or whole frame'
  await bind({async read() { throw Error(reason) }, async write() { throw Error('unreachable') }})
  store.chooseBody('own')
  assert.equal(store.worldBodyState().state, 'refused')
  const device = atlasDevs.atlasDevice(globeFace, atlasDevs.atlasReading(handle(), 'earth'))
  for (const key of ['seaLevel', 'continents', 'coast', 'seed', 'tilt']) {
    const row = device.rows.find(candidate => candidate.key === key)
    assert.equal(row.writePath, undefined, `${key} is a reading`)
    assert.equal(row.disclosure, reason)
  }
  const design = atlasDevs.atlasGlobeBinding(atlasDevs.atlasReading(handle(), 'earth'))
  assert.equal(design.standing.reroll.disabled, reason)
  assert.equal(design.writes('seaLevel'), false)
  const receipt = await set('shell.rerollWorldBody', true)
  assert.match(receipt.reason, new RegExp(reason))
})

test('the globe device carries the body rows after its own choice; the design binding reads the record and writes one BodySet', async () => {
  const unmounted = atlasDevs.atlasDevice(globeFace, atlasDevs.atlasReading(null, 'earth'))
  assert.equal(unmounted.rows[0].key, 'whole-field', 'the globe\'s own choice stays first')
  assert.deepEqual(unmounted.rows.map(row => row.key).slice(1), atlasDevs.WORLD_BODY_ROWS.map(row => row.key))
  assert.ok(unmounted.rows.slice(1).every(row => row.writePath === undefined && /has not mounted/.test(row.disclosure)), 'not mounted: readings')
  const owner = fakeOwner()
  await bind(owner)
  store.chooseBody('own')
  const reading = atlasDevs.atlasReading(handle(), 'earth')
  const device = atlasDevs.atlasDevice(globeFace, reading)
  assert.equal(device.values.seaLevel, .5)
  assert.equal(device.values.body, 'own')
  assert.equal(device.rows.find(row => row.key === 'continents').writePath, 'shell.setWorldBodyContinents')
  await device.submit([{key: 'relief', value: .8}])
  assert.equal(owner.writes.at(-1).body.landmass.relief, .8)
  const design = atlasDevs.atlasGlobeBinding(atlasDevs.atlasReading(handle(), 'earth'))
  assert.equal(design.values.bodyName, 'Central')
  assert.equal(design.values.tilt, 18)
  // [phase B] the locations on your body are read with the owners' places and your system's worlds; neither has answered here
  assert.equal(design.values.locations, undefined, 'not read yet: absent, never defaulted')
  assert.match(design.standing.locations.disabled, /read with your owners’ places and your system’s worlds/)
  assert.equal(design.values.placeKind, 'place', 'the place kind is the view\'s own, and stands')
  assert.equal(design.writes('seaLevel'), true)
  await design.write([{key: 'clouds', value: .1}, {key: 'reroll', value: 1760000000000}])
  const last = owner.writes.at(-1)
  assert.equal(owner.writes.length, 2, 'clouds and the reroll of one gesture are one BodySet')
  assert.equal(last.body.sky.clouds, .1)
  assert.notEqual(last.body.seed, RECORD.seed)
  design.local.body('earth')
  assert.equal(store.bodyChoice(), 'earth', 'the body choice is the view\'s own hand')
  const earth = atlasDevs.atlasGlobeBinding(atlasDevs.atlasReading(handle(), 'earth'))
  assert.match(earth.standing.seaLevel.disabled, /Earth is given/)
})

test('every body setter the rows name is registered, and none is an atlas setter', () => {
  for (const path of bridge.WORLD_BODY_SHELL_SETTERS) assert.equal(typeof shellSetter(path), 'function', path)
  for (const row of atlasDevs.WORLD_BODY_ROWS) assert.ok(bridge.WORLD_BODY_SHELL_SETTERS.includes(row.writePath), row.key)
  assert.ok(bridge.WORLD_BODY_SHELL_SETTERS.every(path => !path.startsWith('shell.setAtlas')))
})

// ── [T-PROCEDURAL-BODY §6 item 5] the device ontology ──────────────────────────────────────────────────────────────────────────
// "The World's Whole already has Body, Landmass, Climate, Sky and Locations (atlasDevices.ts). The lane checks each row's write lands through
// the owner and reads back (not just compiles), that the rows say when a body is older than the current generator ('its next change rebuilds
// it'), and that the device's Compact and Widget pictures are the globe's own body (the same bodyDisc), not a second drawing."

const FIELD = {
  seed: r => r.seed, seaLevel: r => r.landmass.sea_level, continents: r => r.landmass.continents, relief: r => r.landmass.relief, coast: r => r.landmass.coast,
  warmth: r => r.climate.warmth, moisture: r => r.climate.moisture, iceCaps: r => r.climate.ice_caps, atmosphere: r => r.sky.atmosphere, clouds: r => r.sky.clouds, tilt: r => r.sky.axial_tilt_deg,
}
const CHANGE = {seed: 42, seaLevel: .3, continents: 2.4, relief: .2, coast: 'fjord', warmth: .7, moisture: .1, iceCaps: .9, atmosphere: .25, clouds: .8, tilt: 30}

// MET: atlasDevices.ts:177-216 atlasGlobeBinding.write and :242 atlasDevice.submit both reach worldBody.ts writeWorldBody (one BodySet on the
// revision read, read back); the setter route is agent/shellSetterBridge.ts registerWorldBodyShellSetters. Every row, by every route.
test('every body row writes through the owner by every route — the design, the device, the setter — as one BodySet of that change alone, reads back equal, and shows on the device', async () => {
  const rows = atlasDevs.WORLD_BODY_ROWS.filter(row => row.key !== 'body')
  assert.deepEqual(rows.map(row => row.key).sort(), Object.keys(FIELD).sort(), 'the rows are the body\'s settings and the seed')
  for (const row of rows) {
    for (const route of ['design', 'device', 'setter']) {
      const owner = fakeOwner()
      await bind(owner)
      store.chooseBody('own')
      const reading = atlasDevs.atlasReading(handle(), 'earth')
      const value = CHANGE[row.key]
      if (route === 'design') await atlasDevs.atlasGlobeBinding(reading).write([{key: row.key, value}])
      else if (route === 'device') await atlasDevs.atlasDevice(globeFace, reading).submit([{key: row.key, value}])
      else assert.equal((await set(row.writePath, value)).kind, 'fired', `${row.key} by its setter ${row.writePath}`)
      const where = `${row.key} by the ${route}`
      assert.equal(owner.writes.length, 1, `${where}: one BodySet`)
      assert.deepEqual(owner.writes[0].basis, {space_ref: 'central:wiki:root', revision: 67}, `${where}: on the revision it was read at`)
      const sent = owner.writes[0].body
      assert.equal(FIELD[row.key](sent), value, `${where}: the owner is sent the change`)
      for (const other of Object.keys(FIELD)) if (other !== row.key) assert.equal(FIELD[other](sent), FIELD[other](RECORD), `${where}: ${other} stays`)
      assert.deepEqual(store.worldBodyState().record, sent, `${where}: the record read again is the record written`)
      const shown = atlasDevs.atlasDevice(globeFace, atlasDevs.atlasReading(handle(), 'earth')).values[row.key]
      assert.equal(shown, value, `${where}: the device shows what the owner holds`)
    }
  }
  const owner = fakeOwner()
  await bind(owner)
  store.chooseBody('own')
  await atlasDevs.atlasGlobeBinding(atlasDevs.atlasReading(handle(), 'earth')).write([{key: 'reroll', value: 1760000000000}])
  assert.equal(owner.writes.at(-1).body.seed, body.nextSeed(RECORD, 67), 'the reroll is a BodySet of the new seed')
  assert.equal(store.worldBodyState().record.seed, body.nextSeed(RECORD, 67), 'and reads back')
})

// NOT MET: nothing in the rows or the binding says a body was built by an older generator (atlasDevices.ts bodyValues reads the record's
// settings and its seed; its generator is never named). The manual (M7 of tests/w3q-manual-17-2.test.mjs): "A body built by an older
// generator draws as it always did, until you next change it."
test('the device says when a body was built by an older generator, and that its next change rebuilds it; a current, an unread and the Earth\'s say nothing', () => {
  const version = body.WORLD_BODY_GENERATOR_VERSION
  const reading = (record, choice = 'own', state = 'read') => ({mounted: true, view: 'earth', graph: null, clock: null, globe: {scopeLabel: null, wholeField: false},
    body: {state: state === 'read' ? {state: 'read', reading: readingOf(record, 67), record} : {state}, choice}, locations: {rows: []}, placeKind: 'place'})
  const older = {...RECORD, generator: {...RECORD.generator, version: version - 1}}, current = {...RECORD, generator: {...RECORD.generator, version}}
  const note = atlasDevs.atlasGlobeBinding(reading(older)).values.generationNote
  assert.equal(typeof note, 'string', 'the binding hands the design a generationNote for a body built by an older generator')
  assert.match(note, /generator/i, 'it speaks of the generator')
  assert.match(note, new RegExp(`\\b${version - 1}\\b`), 'it names the version the body was built by')
  assert.match(note, new RegExp(`\\b${version}\\b`), 'and the current one')
  assert.match(note, /next change rebuilds it/, 'and what happens')
  assert.equal(atlasDevs.atlasGlobeBinding(reading(current)).values.generationNote, undefined, 'a body of the current generator has nothing to say')
  assert.equal(atlasDevs.atlasGlobeBinding(reading(older, 'earth')).values.generationNote, undefined, 'the Earth is given: no body, no note')
  assert.equal(atlasDevs.atlasGlobeBinding(reading(older, 'own', 'reading')).values.generationNote, undefined, 'unread: no claim')
  assert.equal(atlasDevs.atlasGlobeBinding(reading(null)).values.generationNote, undefined, 'no body yet: nothing built, nothing older')
})

// NOT MET: the Compact and the Widget draw `SpaceArt`, the Earth's picture, whatever body is chosen, and the Body page draws a preview with
// the design's own value noise (inhabitants/catalogue/panels/atlas-earth__globe-engine.tsx:480 SpaceDisplay, :512-542 hash3/noise3/fbm/
// heightAt/isLand, :562 BodyArt). One body, one drawing: the binding hands the design the record the globe shows and the look it is drawn
// with (values.bodyRecord, values.bodyLook), and the design draws them with the globe's bodyDisc. The binding is the system lane's, the
// drawing the generator lane's (it takes SpaceArt and BodyArt in the design file): two tests, one for each.
test('the binding hands the design the record the globe shows and the look it is drawn with, for your own body only', () => {
  const record = {...RECORD, seed: 5}
  const reading = (choice, look) => ({mounted: true, view: 'earth', graph: null, clock: null, globe: {scopeLabel: null, wholeField: false},
    body: {state: {state: 'read', reading: readingOf(record, 67), record}, choice}, locations: {rows: []}, placeKind: 'place', ...(look ? {look} : {})})
  const own = atlasDevs.atlasGlobeBinding(reading('own', {barren: .4}))
  assert.deepEqual(JSON.parse(own.values.bodyRecord ?? 'null'), record, 'values.bodyRecord: the record the globe draws, the owner\'s own')
  assert.deepEqual(JSON.parse(own.values.bodyLook ?? 'null'), {barren: .4}, 'values.bodyLook: the look the globe draws it with')
  assert.equal(atlasDevs.atlasGlobeBinding(reading('own')).values.bodyLook, undefined, 'no look read: none claimed')
  const earth = atlasDevs.atlasGlobeBinding(reading('earth', {barren: .4}))
  assert.equal(earth.values.bodyRecord, undefined, 'the Earth is drawn as the Earth: no body record is handed')
  assert.equal(earth.values.bodyLook, undefined)
  assert.equal(atlasDevs.atlasGlobeBinding(reading('other', {barren: .4})).values.bodyRecord, undefined, 'and another world\'s body is not read here')
})

// Waits on the generator lane (Lane A): the design file is theirs to draw from the values above. Red until they land SpaceArt and BodyArt on bodyDisc.
test('the design draws a body only with the globe\'s bodyDisc, from the record and look the binding hands it: it carries no value noise of its own', pending, () => {
  const panel = readFileSync(new URL('../src/inhabitants/catalogue/panels/atlas-earth__globe-engine.tsx', import.meta.url), 'utf8')
  assert.match(panel, /from '[^']*projections\/atlas\/src\/globe\/body'/, 'the design imports the globe\'s body module')
  assert.match(panel, /\bbodyDisc\(/, 'and draws the body with its bodyDisc')
  assert.match(panel, /bodyRecord/, 'from the record the binding hands it')
  assert.match(panel, /bodyLook/, 'with the look the binding hands it')
  assert.doesNotMatch(panel, /function (hash3|noise3|fbm|heightAt|drawnAt)\b|const isLand\b/, 'the design carries no value noise or land test of its own: the preview was a second drawing of the body')
})

test('the device reading carries the look of your own world from your system\'s reading, so the device and the globe agree', () => {
  const bodies = [{key: 'world:central:wiki:root', yours: true, look: {barren: .25}, world: {ref: 'central:wiki:root', name: 'Your world', kind: 'yours', folder: '', project: null}, state: 'built', record: RECORD,
    bodyRef: RECORD.body_ref, colour: {}, standing: '', landing: null, unlanded: null, phase: 0, satellites: []}]
  // the system reading the globe's drawer reads (system/systemStore.ts) is the one the device reads
  return import('../src/projections/atlas/system/systemStore.ts').then(systemStore => {
    systemStore.publishSystem({state: 'read', bodies, set: null})
    try { assert.deepEqual(atlasDevs.atlasReading(null, 'earth').look, {barren: .25}, 'AtlasReading.look: your own world\'s look, as your system reads it') } finally { systemStore.publishSystem({state: 'unbound'}) }
    assert.equal(atlasDevs.atlasReading(null, 'earth').look, undefined, 'no system reading: no look is claimed')
  })
})
