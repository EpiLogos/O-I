// T-WORLDS §5 W3, phase A: the World device's Body page — its rows, its design binding, its setters — over the owner's record.
// Owners write, faces read: the record is read from its owner and a change goes back as one BodySet against the revision it was
// read at; a reroll is the owner's write of a new seed; the body choice is the view's own; nothing here holds or invents a body.
// Channels: scripted. The store, the rows and the setters are the shell's own code in memory; the owner is a FAKE standing for the
// kernel's `world_body_read` and the `aikit.wiki.facts.apply` Action (the real owner is ai-kit knowledge_wiki_facts.rs, tested there).
import test, {beforeEach} from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'

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
  for (const key of ['body_ref', 'generator', 'landmass', 'climate', 'sky']) assert.deepEqual(sent[key], RECORD[key], `${key} stays`)
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
  assert.equal(store.shownBody(), null, 'nothing is drawn until the person builds')
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
  assert.equal(design.values.locations, undefined, 'no owner keeps locations on your body yet: absent, never defaulted')
  assert.match(design.standing.locations.disabled, /No owner keeps locations/)
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
