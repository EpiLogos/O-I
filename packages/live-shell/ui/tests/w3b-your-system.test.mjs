// T-WORLDS §5 W3, phase B: your system, the bodies' sky, locations and landings on your body, and the World group's Bodies.
// Owners write, faces read: every body is its register's own record (or the body seeded from its ref, said so); a landing is one BodySet
// on the landed world's register at the revision read; a location on your body is a place facet naming your body, which the suite reading
// keeps off the Earth; nothing here is random, and a satellite's place on its ring is its subject's own.
// Channels: scripted. The models, the stores, the tool, the generator and the bindings are the shell's own code in memory; the owners are
// FAKES standing for the kernel's `world_body_read` and the `aikit.wiki.facts.apply` Action (the real owner is ai-kit
// knowledge_wiki_facts.rs and knowledge_facets.rs, tested there). Not covered here: anything drawn on screen (UNVERIFIED: the lead's pass).
import test, {beforeEach} from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'

const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};
import {readFile} from 'node:fs/promises';
export async function resolve(s, c, n) {
  if (s === 'react' || s.startsWith('react/') || s === 'react-dom' || s.startsWith('react-dom/')) return n(s, {...c, parentURL: ${JSON.stringify(import.meta.url)}})
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
const model = await import('../src/projections/atlas/system/systemModel.ts')
const systemStore = await import('../src/projections/atlas/system/systemStore.ts')
const {landWorld, unlandWorld, readBodyOf, yourBodyReading} = await import('../src/projections/atlas/system/SystemReadings.tsx')
const {yourLocations, LOCATIONS_READING} = await import('../src/projections/atlas/system/bodyLocations.ts')
const {drawnLocations, systemWanted, worldPlace, rgbOf} = await import('../src/projections/atlas/system/systemOverlay.ts')
const store = await import('../src/projections/atlas/body/worldBody.ts')
const body = await import('../src/projections/atlas/src/globe/body.ts')
const {renderBody, bodyRenderThread} = await import('../src/projections/atlas/src/globe/bodyRender.ts')
const shaders = await import('../src/projections/atlas/src/globe/shaders.ts')
const {isWorldOrbitKey} = await import('../src/projections/atlas/src/sky/orbits.ts')
const {paletteOfRef, locateFacet, locateOnBody, facetFieldsOf} = await import('../src/projections/atlas/provider/suiteReading.ts')
const placesModel = await import('../src/projections/atlas/places/placesModel.ts')
const tool = await import('../src/projections/atlas/places/placeTool.ts')
const {validatePlaceFacet} = await import('../../../../desktop/cradle/src/techne/contract.ts')
const {applyPlaceDraft} = await import('../../../../desktop/cradle/src/knowledge/WikiFactsEditor.tsx')
const rows = await import('../src/techne/subject/worldRows.ts')
const {browserCategoriesOf} = await import('../src/shell/modeGrammar.ts')
const atlasDevs = await import('../src/inhabitants/ql/devices/atlasDevices.ts')
const {IDLE_STANDING} = await import('../src/projections/atlas/provider/suiteStanding.ts')

// FIXTURES: the worlds Central discloses (central/centralWorlds.ts worldsOf's shape), the body readings the kernel's world_body_read
// answers (kernel construction.rs read_body's shape), and a body in the owner's record shape.
const YOURS = {ref: 'central:wiki:root', name: 'Your world', kind: 'yours', folder: 'Control/user/flows', project: null}
const OI = {ref: 'central:wiki:project:O-I', name: 'O-I', kind: 'project', folder: 'Work/O-I/ProjectCentral/user', project: 'O-I'}
const BOOK = {ref: 'central:wiki:project:Book', name: 'Book', kind: 'project', folder: 'Work/Book/ProjectCentral/user', project: 'Book'}
const RECORD = Object.freeze({
  body_ref: 'body:central:wiki:root', seed: 20261018, generator: {id: 'fbm-sphere', version: 1},
  landmass: {sea_level: .5, continents: 1.7, relief: .55, coast: 'smooth'}, climate: {warmth: .58, moisture: .6, ice_caps: .3},
  sky: {atmosphere: .6, clouds: .35, axial_tilt_deg: 18},
})
const readingOf = (ref, record, revision = 4, register = null) => ({schema: 'oi.world-body-reading/v1', register, space: {ref, revision, title: null},
  disclosed_revision: revision, body: record, wiki_source: {path: 'w.json', ref: 'central:source:wiki', revision: 'r'}, owner_operation: 'aikit wiki-construct facts-inspect'})
const read = (ref, record, revision) => ({state: 'read', reading: readingOf(ref, record, revision), record})
const NO_HAND = {file: null, works: []}
const input = (extra = {}) => ({worlds: [YOURS, OI, BOOK], bodies: new Map([[YOURS.ref, read(YOURS.ref, RECORD, 67)], [OI.ref, read(OI.ref, null, 9)]]),
  playing: [], sessions: [], hand: NO_HAND, ...extra})

beforeEach(() => {
  tool.resetPlaceTool()
  systemStore.bindSystemActs(null)
})

// ── your system: the bodies of today's worlds ─────────────────────────────────────────────────────────────────────

test('today\'s worlds are your world first, then the Day\'s set in its own order; a world Central no longer discloses is left out', () => {
  assert.deepEqual(model.systemWorlds([OI, YOURS, BOOK], [BOOK.ref, 'central:wiki:project:Gone', OI.ref, BOOK.ref]).map(world => world.name), ['Your world', 'Book', 'O-I'])
  assert.deepEqual(model.systemWorlds([YOURS, OI], []).map(world => world.name), ['Your world'], 'with nothing in the set, your world alone')
})

test('each body is its owner\'s record, or the body seeded from its ref and said so, or hollow while it is not read; its colour is its ref\'s', () => {
  const bodies = model.systemOf(input({bodies: new Map([[YOURS.ref, read(YOURS.ref, RECORD, 67)], [OI.ref, read(OI.ref, null, 9)], [BOOK.ref, {state: 'refused', reason: 'The Wiki owner is unavailable'}]])}))
  const [own, oi, book] = bodies
  assert.deepEqual([own.state, oi.state, book.state], ['built', 'seeded', 'refused'])
  assert.deepEqual(own.record, RECORD)
  assert.deepEqual(oi.record, store.firstBody(OI.ref, 9), 'seeded: the very body its first change would build on')
  assert.match(oi.standing, /no body yet: drawn from a body seeded from its ref, and nothing is written until you build it/)
  assert.equal(book.record, null, 'not read: nothing is drawn for it')
  assert.equal(book.standing, 'The Wiki owner is unavailable', 'the owner\'s own words')
  assert.deepEqual(own.colour, paletteOfRef(RECORD.body_ref))
  assert.deepEqual(oi.colour, paletteOfRef(`body:${OI.ref}`))
  assert.equal(own.key, `world:${YOURS.ref}`)
  assert.ok(isWorldOrbitKey(own.key), 'a world body rides the orbits\' own key space, never a widened BodyKey')
  assert.equal(isWorldOrbitKey('terra'), false)
  assert.equal(model.systemOf(input({bodies: new Map()}))[0].state, 'reading')
  assert.deepEqual(model.worldColourOf(bodies, OI.ref), oi.colour, 'the track and its clips wear the body\'s colour')
  assert.deepEqual(model.worldColourOf([], BOOK.ref), paletteOfRef(`body:${BOOK.ref}`), 'unread: the colour of the ref it is seeded with')
})

test('a world lands on your planet through its own record\'s landing; one on another body, or none, says so', () => {
  const landed = {...RECORD, body_ref: 'body:o-i', seed: 11, landing: {on_ref: RECORD.body_ref, lat: 12.5, lon: -40.25}}
  const elsewhere = {...RECORD, body_ref: 'body:book', seed: 12, landing: {on_ref: 'body:mara', lat: 1, lon: 2}}
  const bodies = model.systemOf(input({bodies: new Map([[YOURS.ref, read(YOURS.ref, RECORD, 67)], [OI.ref, read(OI.ref, landed, 9)], [BOOK.ref, read(BOOK.ref, elsewhere, 2)]])}))
  assert.equal(bodies[0].landing, null, 'your own world lands nowhere: it is the planet')
  assert.equal(bodies[0].unlanded, null)
  assert.deepEqual(bodies[1].landing, {lat: 12.5, lon: -40.25})
  assert.equal(bodies[2].landing, null)
  assert.match(bodies[2].unlanded, /lands on another body \(body:mara\)/)
  assert.deepEqual(model.landingLocations(bodies), [{id: `world:${OI.ref}`, name: 'O-I', lat: 12.5, lon: -40.25, kind: 'place'}])
  const seeded = model.systemOf(input())[1]
  assert.match(seeded.unlanded, /no body yet, so no landing/)
})

test('what you hold circles the body it belongs to: pages and agents inside, files and works outside, each at its own place', () => {
  const playing = [
    {pageRef: 'ref:Control/user/flows/morning.html', nowRef: 'now:a', project: null, sinceMs: 1},
    {pageRef: 'ref:Work/O-I/ProjectCentral/user/being.html', nowRef: 'now:b', project: 'O-I', sinceMs: 2},
  ]
  const sessions = [{sessionRef: 'session:1', agentName: 'Kev', purpose: 'build', group: false}, {sessionRef: 'space:group', agentName: null, purpose: null, group: true}]
  const hand = {file: {ref: 'ref:Work/O-I/README.md', path: 'Work/O-I/README.md'}, works: [{expression_ref: 'expr:essay', title: 'The essay'}]}
  const titles = new Map([['ref:Control/user/flows/morning.html', 'Morning']])
  const [own, oi, book] = model.systemOf(input({playing, sessions, hand, titles}))
  assert.deepEqual(own.satellites.map(s => [s.kind, s.name, s.ring]), [['page', 'Morning', 'inner'], ['session', 'Kev', 'inner'], ['work', 'The essay', 'outer']])
  assert.deepEqual(oi.satellites.map(s => [s.kind, s.name, s.ring]), [['page', 'being', 'inner'], ['file', 'README', 'outer']],
    'a page plays in its register\'s NOW; a file in a project\'s folder rides that project\'s world')
  assert.deepEqual(book.satellites, [])
  // the place on the ring is the subject's own: the same ref, the same place, however the list around it changes
  const alone = model.systemOf(input({sessions: [sessions[0]]}))[0].satellites[0]
  assert.equal(alone.phase, own.satellites.find(s => s.id === 'session:1').phase)
  assert.equal(alone.phase, model.ringPhase('session:1'))
  assert.ok(alone.phase >= 0 && alone.phase < Math.PI * 2)
  assert.doesNotMatch(model.ringPhase.toString() + model.systemOf.toString(), /Math\.random/)
  assert.ok(own.satellites.every(s => !/creature|bee|animal/i.test(s.hint)), 'plain satellites: the faces of agent types are the owner\'s to place')
})

test('the store holds the last reading and nothing else; its acts are bound by the readings and released with them', () => {
  assert.equal(systemStore.systemReading().state, 'unbound')
  const bodies = model.systemOf(input())
  systemStore.publishSystem({state: 'read', bodies, set: null})
  assert.equal(systemStore.systemBodies().length, 3)
  let opened = null
  systemStore.bindSystemActs({open: async satellite => { opened = satellite }, land: async () => 'landed'})
  assert.ok(systemStore.systemActs())
  void systemStore.systemActs().open({id: 'x'}, bodies[0])
  assert.deepEqual(opened, {id: 'x'})
  systemStore.bindSystemActs(null)
  assert.equal(systemStore.systemReading().state, 'unbound')
  assert.equal(systemStore.systemActs(), null)
})

test('the overlay stands in the System scale only, places worlds round your planet at their own places, and paints in their colour', () => {
  assert.equal(systemWanted({sky: true, graph: false}, 'system', true, true), true)
  assert.equal(systemWanted({sky: true, graph: false}, undefined, true, true), true)
  assert.equal(systemWanted({sky: true, graph: false}, 'approach', true, true), false, 'a lens holding a planet owns the screen')
  assert.equal(systemWanted({sky: false, graph: false}, 'system', true, true), false, 'not at the Body scale')
  assert.equal(systemWanted({sky: true, graph: true}, 'system', true, true), false)
  assert.equal(systemWanted({sky: true, graph: false}, 'system', false, true), false, 'nothing read, nothing drawn')
  assert.equal(systemWanted({sky: true, graph: false}, 'system', true, false), false, 'the Earth drawn: the planet is the Earth, not your world')
  const a = worldPlace(model.ringPhase(OI.ref), 100), b = worldPlace(model.ringPhase(OI.ref), 100)
  assert.deepEqual(a, b)
  assert.ok(Math.hypot(a.x, a.y) <= 100.0001)
  assert.equal(rgbOf('#ff8000'), '255 128 0')
})

test('a landing is one BodySet on the landed world\'s register at the revision read, with the body as it reads, and it reads back', async () => {
  const owner = {record: null, revision: 9, writes: [],
    async read() { return readingOf(OI.ref, owner.record, owner.revision, 'O-I') },
    async write(next, basis) {
      owner.writes.push({body: next, basis})
      if (basis.revision !== owner.revision) throw Error('the exact native target changed; reread before editing its facts')
      owner.record = next; owner.revision += 1
    }}
  const bodies = model.systemOf(input())
  const reading = await readBodyOf(owner)
  assert.deepEqual(reading, {state: 'read', reading: readingOf(OI.ref, null, 9, 'O-I'), record: null})
  const said = await landWorld(owner, bodies[1], bodies[0], reading, 12.5, -40.25)
  assert.match(said, /O-I lands on your planet at 12\.50, -40\.25: its body is saved at revision 10\./)
  assert.equal(owner.writes.length, 1)
  const {body: sent, basis} = owner.writes[0]
  assert.deepEqual(basis, {space_ref: OI.ref, revision: 9})
  assert.deepEqual(sent, {...store.firstBody(OI.ref, 9), landing: {on_ref: RECORD.body_ref, lat: 12.5, lon: -40.25}}, 'the seeded body is built with its landing')
  await assert.rejects(landWorld(owner, bodies[0], bodies[0], reading, 0, 0), /does not land on itself/)
  await assert.rejects(landWorld(owner, bodies[1], {...bodies[0], state: 'reading'}, reading, 0, 0), /Your planet’s body is not read/)
  await assert.rejects(landWorld(owner, bodies[2], bodies[0], undefined, 0, 0), /Book’s body is not read/)
  // a stale reading: the owner's refusal, verbatim, and nothing is written over it
  await assert.rejects(landWorld(owner, bodies[1], bodies[0], reading, 1, 1), /reread before editing its facts/)
  assert.equal(owner.revision, 10)
  assert.deepEqual(yourBodyReading({state: 'unbound'}), {state: 'reading'})
  assert.deepEqual(yourBodyReading({state: 'refused', reason: 'no'}), {state: 'refused', reason: 'no'})
})

test('a landing comes off as it went on: the body written whole without it, on the revision read, everything else kept', async () => {
  const landed = {...store.firstBody(OI.ref, 9), landing: {on_ref: RECORD.body_ref, lat: 12.5, lon: -40.25}}
  const owner = {record: landed, revision: 10, writes: [],
    async read() { return readingOf(OI.ref, owner.record, owner.revision, 'O-I') },
    async write(next, basis) {
      owner.writes.push({body: next, basis})
      if (basis.revision !== owner.revision) throw Error('the exact native target changed; reread before editing its facts')
      owner.record = next; owner.revision += 1
    }}
  const bodies = model.systemOf(input())
  const reading = await readBodyOf(owner)
  const said = await unlandWorld(owner, bodies[1], reading)
  assert.match(said, /O-I is off your planet: its body is kept, without a landing, at revision 11\./)
  assert.equal(owner.writes.length, 1)
  assert.deepEqual(owner.writes[0].basis, {space_ref: OI.ref, revision: 10})
  const {landing, ...rest} = landed
  assert.deepEqual(owner.writes[0].body, rest, 'the seed and every setting stay; only the landing goes')
  assert.equal('landing' in owner.writes[0].body, false)
  // nothing to take off: said, and nothing written
  assert.match(await unlandWorld(owner, bodies[1], await readBodyOf(owner)), /does not land on your planet; nothing was written/)
  assert.equal(owner.writes.length, 1)
  await assert.rejects(unlandWorld(owner, bodies[0], reading), /lands nowhere, so there is nothing to take off/)
  await assert.rejects(unlandWorld(owner, bodies[2], undefined), /Book’s body is not read/)
  // a stale reading is the owner's refusal, verbatim
  owner.record = landed
  await assert.rejects(unlandWorld(owner, bodies[1], reading), /reread before editing its facts/)
})

test('the plate takes an armed landed world off through its owner, and says the answer', async () => {
  const said = []
  tool.bindPlaceOwner({offer() {}, open() {}, reread() {}, async land() { return '' }, async unland(target) { said.push(target.key); return `${target.name} is off your planet.` }})
  tool.armLanding({key: 'world:central:wiki:project:O-I', name: 'O-I'})
  await tool.unlandArmed()
  assert.deepEqual(said, ['world:central:wiki:project:O-I'])
  assert.deepEqual(tool.placeToolState(), {phase: 'idle', notice: 'O-I is off your planet.', tone: 'saved'})
  tool.bindPlaceOwner({offer() {}, open() {}, reread() {}, async land() { return '' }, async unland() { throw Error('the owner refused') }})
  tool.armLanding({key: 'k', name: 'O-I'})
  await tool.unlandArmed()
  assert.deepEqual(tool.placeToolState(), {phase: 'idle', notice: 'the owner refused', tone: 'refused'})
  tool.bindPlaceOwner(null)
})

// ── the place facet names its body; the Earth draws its own places only ───────────────────────────────────────────────

test('the place facet carries the body it stands on, absent meaning the Earth; a blank one is refused', () => {
  const ok = []; validatePlaceFacet({place_ref: 'wiki:place:a', precision: 'approximate', body_ref: 'body:central:wiki:root'}, 'p', ok)
  assert.deepEqual(ok, [])
  const blank = []; validatePlaceFacet({place_ref: 'wiki:place:a', precision: 'approximate', body_ref: ' '}, 'p', blank)
  assert.deepEqual(blank, ['p.body_ref: must be a ref or null'])
  const earth = []; validatePlaceFacet({place_ref: 'wiki:place:a', precision: 'approximate', body_ref: null}, 'p', earth)
  assert.deepEqual(earth, [])
})

test('a place on another body is never on the Earth; its point on its own body is kept verbatim for the body that draws it', () => {
  const facet = {place_ref: 'wiki:place:study', precision: 'approximate', body_ref: RECORD.body_ref, geometry: {type: 'point', coordinates: [10, 22]}}
  assert.deepEqual(locateFacet(facet), {located: false, reason: `the owner places it on another body (${RECORD.body_ref}), not on the Earth`})
  assert.deepEqual(locateOnBody(facet), {body_ref: RECORD.body_ref, where: {located: true, lat: 22, lon: 10, geoPrecision: 'region'}})
  assert.deepEqual(facetFieldsOf(facet), {body_ref: RECORD.body_ref, on_body: {lat: 22, lon: 10}})
  const onEarth = {place_ref: 'p', precision: 'exact', geometry: {type: 'point', coordinates: [23.7, 37.9]}}
  assert.equal(locateOnBody(onEarth), null)
  assert.equal(locateFacet(onEarth).located, true, 'an Earth place reads exactly as before')
})

test('your body\'s locations are its declared places and the worlds that land on it, or why they are not read', () => {
  const state = {state: 'read', reading: readingOf(YOURS.ref, RECORD, 67), record: RECORD}
  const places = [
    {ref: 'wiki:place:study', name: 'The study', kind: 'declared', owner: 'wiki', source: 's', located: false, precision: 'approximate', reason: 'x', body_ref: RECORD.body_ref, on_body: {lat: 22, lon: 10}},
    {ref: 'wiki:place:athens', name: 'Athens', kind: 'declared', owner: 'wiki', source: 's', located: true, precision: 'exact', lat: 37.9, lon: 23.7, reason: null},
    {ref: 'wiki:place:mara', name: 'Mara', kind: 'declared', owner: 'wiki', source: 's', located: false, precision: 'approximate', reason: 'x', body_ref: 'body:mara', on_body: {lat: 1, lon: 1}},
  ]
  const landed = {...RECORD, body_ref: 'body:o-i', landing: {on_ref: RECORD.body_ref, lat: -8, lon: 34}}
  const system = model.systemOf(input({bodies: new Map([[YOURS.ref, read(YOURS.ref, RECORD, 67)], [OI.ref, read(OI.ref, landed, 9)]])}))
  assert.deepEqual(yourLocations(state, places, true, system), {rows: [
    {id: 'wiki:place:study', name: 'The study', lat: 22, lon: 10, kind: 'place'},
    {id: `world:${OI.ref}`, name: 'O-I', lat: -8, lon: 34, kind: 'place'},
  ]}, 'the Earth\'s places and another body\'s stand elsewhere')
  // a body not built yet is the body seeded from its ref, the one the globe draws: what stands on that ref stands on it
  const seededRef = store.firstBody(YOURS.ref, 3).body_ref
  assert.equal(seededRef, RECORD.body_ref, 'the seeded body keeps the ref its first write keeps')
  assert.deepEqual(yourLocations({state: 'read', reading: readingOf(YOURS.ref, null, 3), record: null}, places, true, null), {rows: [{id: 'wiki:place:study', name: 'The study', lat: 22, lon: 10, kind: 'place'}]})
  assert.deepEqual(yourLocations(state, places, false, null), {unread: LOCATIONS_READING})
  assert.deepEqual(yourLocations({state: 'refused', reason: 'gone'}, places, true, system), {unread: 'gone'})
  // where a location's spot is sea it is drawn on the nearest shore, its coordinate unchanged
  const drawn = drawnLocations(RECORD, [{id: 'a', name: 'A', lat: 22, lon: 10, kind: 'place'}])
  const shore = body.shoreOf(RECORD, 22, 10)
  assert.deepEqual([drawn[0].lat, drawn[0].lon, drawn[0].shore], [shore.lat, shore.lon, shore.shore])
  assert.deepEqual([drawn[0].location.lat, drawn[0].location.lon], [22, 10])
})

test('on your body the Place tool\'s draft stands on it and carries the name the World suggests from its seed; the editor keeps both', () => {
  const subject = {ref: 'wiki:node:a', title: 'A'}
  const on = {body_ref: RECORD.body_ref, seed: RECORD.seed}
  const made = tool.draftAt(subject, 22, 10, on)
  assert.equal(made.ok, true)
  assert.equal(made.draft.body_ref, RECORD.body_ref)
  assert.equal(made.draft.name, body.suggestName(RECORD, 22, 10))
  assert.equal(made.draft.precision, 'approximate', 'a click claims no more than approximate, on any body')
  const earth = tool.draftAt(subject, 22, 10)
  assert.equal(earth.ok, true)
  assert.equal(earth.draft.body_ref, undefined, 'on the Earth the draft is the vendor\'s own, unchanged')
  assert.equal(earth.draft.name, undefined)
  const moving = tool.draftAt({...subject, moving: {place_ref: 'p', name: 'Athens', lat: 37, lon: 23, precision: 'approximate', evidence: 'e'}}, 1, 1, on)
  assert.deepEqual(moving, {ok: false, reason: 'Athens stands on the Earth: choose Earth as the body to move it.'})
  const applied = applyPlaceDraft({temporal: [], places: []}, made.draft)
  assert.equal(applied.values.places[0].body_ref, RECORD.body_ref)
  assert.equal(applied.values.places[0].identity.names[0].name, made.draft.name)
  assert.match(applied.notice, new RegExp(`on ${RECORD.body_ref}`))
  assert.match(tool.draftLine(made.draft), /on your body/)
  const plain = applyPlaceDraft({temporal: [], places: []}, earth.draft)
  assert.equal(plain.values.places[0].body_ref, undefined, 'an Earth place carries no body_ref')
  assert.equal(plain.values.places[0].identity.names[0].name, '')
  // a suggestion is the seed's and the spot's alone
  assert.equal(body.suggestName(RECORD, 22, 10), body.suggestName({seed: RECORD.seed}, 22.04, 10.01))
  assert.notEqual(body.suggestName(RECORD, 22, 10), body.suggestName({seed: 7}, 22, 10))
  assert.match(body.suggestName(RECORD, -5, 140), /^[A-Z][a-z]+$/)
})

test('the place kind is the view\'s own; a portal or a route is not placed by a click, and says why', () => {
  tool.bindPlaceOwner({offer() {}, open() {}, reread() {}})
  assert.equal(tool.placeKindChoice(), 'place')
  tool.choosePlaceKind('portal')
  tool.armPlaceTool({ref: 's', title: 'S'})
  assert.deepEqual(tool.placeToolState(), {phase: 'idle', notice: tool.PLACE_KIND_WAITS.portal, tone: 'refused'})
  tool.choosePlaceKind('palace')
  tool.armPlaceTool({ref: 's', title: 'S'})
  assert.equal(tool.placeToolState().phase, 'armed', 'a palace is placed where its rooms\' subjects are placed')
  tool.choosePlaceKind('nowhere')
  assert.equal(tool.placeKindChoice(), 'palace', 'a kind the World does not know is not chosen')
})

test('a landing is armed for a world, lands only on your planet, and says the owner\'s answer in its words', async () => {
  tool.armLanding({key: 'world:o', name: 'O-I'})
  assert.deepEqual(tool.placeToolState(), {phase: 'idle', notice: tool.NO_LANDING_OWNER, tone: 'refused'}, 'no owner bound: refused by name')
  const landed = []
  tool.bindPlaceOwner({offer() {}, open() {}, reread() {}, async land(target, lat, lon) { landed.push([target.key, lat, lon]); return 'O-I lands on your planet.' }})
  tool.armLanding({key: 'world:o', name: 'O-I'})
  assert.equal(tool.placeToolState().phase, 'landing')
  tool.placeAt({lat: 5, lon: 6}, null)
  assert.deepEqual(tool.placeToolState(), {phase: 'idle', notice: tool.LAND_ON_YOURS, tone: 'refused'}, 'the Earth is not your planet')
  assert.deepEqual(landed, [])
  tool.armLanding({key: 'world:o', name: 'O-I'})
  tool.placeAt({lat: 5, lon: 6}, {body_ref: RECORD.body_ref, seed: RECORD.seed})
  assert.equal(tool.placeToolState().phase, 'saving')
  await new Promise(resolve => setTimeout(resolve, 0))
  assert.deepEqual(tool.placeToolState(), {phase: 'idle', notice: 'O-I lands on your planet.', tone: 'saved'})
  assert.deepEqual(landed, [['world:o', 5, 6]])
  tool.bindPlaceOwner({offer() {}, open() {}, reread() {}, async land() { throw Error('the exact native target changed; reread before editing its facts') }})
  tool.armLanding({key: 'world:o', name: 'O-I'})
  tool.placeAt({lat: 1, lon: 1}, {body_ref: RECORD.body_ref, seed: 1})
  await new Promise(resolve => setTimeout(resolve, 0))
  assert.deepEqual(tool.placeToolState(), {phase: 'idle', notice: 'the exact native target changed; reread before editing its facts', tone: 'refused'})
})

test('the World device reads your body\'s locations and keeps the place kind in the view\'s own hand', () => {
  const reading = {mounted: true, view: 'earth', graph: null, clock: null, globe: {scopeLabel: null, wholeField: false},
    body: {state: {state: 'read', reading: readingOf(YOURS.ref, RECORD, 67), record: RECORD}, choice: 'own'},
    locations: {rows: [{id: 'a', name: 'The study', lat: 22, lon: 10, kind: 'place'}]}, placeKind: 'place'}
  const design = atlasDevs.atlasGlobeBinding(reading)
  assert.deepEqual(JSON.parse(design.values.locations), [{id: 'a', name: 'The study', lat: 22, lon: 10, kind: 'place'}])
  assert.equal(design.values.placeKind, 'place')
  assert.equal(design.standing.locations, undefined, 'a reading: it stands')
  assert.equal(design.standing.placeKind, undefined)
  design.local.placeKind('route')
  assert.equal(tool.placeKindChoice(), 'route')
  const unread = atlasDevs.atlasGlobeBinding({...reading, locations: {unread: LOCATIONS_READING}})
  assert.equal(unread.values.locations, undefined, 'absent, never defaulted')
  assert.equal(unread.standing.locations.disabled, LOCATIONS_READING)
  const earth = atlasDevs.atlasGlobeBinding({...reading, body: {...reading.body, choice: 'earth'}})
  assert.match(earth.standing.locations.disabled, /Earth’s places stand on the Space page/)
  const live = atlasDevs.atlasReading(null, 'earth')
  assert.ok('unread' in live.locations || 'rows' in live.locations)
  assert.equal(live.placeKind, tool.placeKindChoice())
})

test('the atlas\'s declared rows carry your world\'s body with the globe; the body rows are those rows', () => {
  const globeRows = atlasDevs.ATLAS_DECLARED_ROWS.filter(row => row.deviceInstance === 'globe-engine').map(row => row.key)
  assert.deepEqual(globeRows, ['whole-field', ...atlasDevs.WORLD_BODY_ROWS.map(row => row.key)])
  assert.ok(atlasDevs.WORLD_BODY_ROWS.every(row => atlasDevs.ATLAS_DECLARED_ROWS.includes(row)))
})

// ── the body's sky: its clouds, its air, its tilt; the generator off the main thread ──────────────────────────────────

test('the clouds are a layer of their own: a deterministic mask, none at all for a clear sky, and never in the base', () => {
  const a = body.cloudImage(RECORD, 128), b = body.cloudImage(RECORD, 128)
  assert.deepEqual([a.width, a.height], [128, 64])
  assert.deepEqual(a.data, b.data)
  const cover = (image) => { let n = 0; for (let i = 0; i < image.data.length; i += 4) n += image.data[i]; return n / (image.data.length / 4) / 255 }
  assert.equal(cover(body.cloudImage({...RECORD, sky: {...RECORD.sky, clouds: 0}}, 64)), 0)
  assert.ok(cover(body.cloudImage({...RECORD, sky: {...RECORD.sky, clouds: 1}}, 64)) > cover(a), 'more cloud for more cover')
  assert.deepEqual(body.bodyImage(RECORD, 64).data, body.bodyImage({...RECORD, sky: {...RECORD.sky, clouds: 1}}, 64).data,
    'the base carries no cloud: white there would read as land (waterOf)')
  assert.match(shaders.EARTH_FRAG, /uniform sampler2D uCloud;/)
  assert.match(shaders.EARTH_FRAG, /if \(uCloudMix > 0\.0\)/, 'the Earth, at 0, is drawn exactly as before')
  assert.match(shaders.SHELL_FRAG, /c \* cut \* uAir/)
  assert.match(shaders.TILE_FRAG, /vDens, 1\.0\)/, 'the Earth\'s close tiles keep the Earth\'s own air')
  assert.equal(body.airOf(RECORD), 1, 'the device\'s default atmosphere is the Earth\'s air')
  assert.equal(body.airOf({...RECORD, sky: {...RECORD.sky, atmosphere: 0}}), 0)
})

test('the body is lit at its own season: the Sun at the declination its tilt gives, its hour kept', () => {
  const lon = 90, earthDecl = Math.asin(Math.sin(body.EARTH_OBLIQUITY_DEG * Math.PI / 180))
  const sun = {x: Math.cos(earthDecl) * Math.cos(.4), y: Math.sin(earthDecl), z: Math.cos(earthDecl) * Math.sin(.4)}
  const same = body.bodySunDir(sun, lon, body.EARTH_OBLIQUITY_DEG)
  for (const axis of ['x', 'y', 'z']) assert.ok(Math.abs(same[axis] - sun[axis]) < 1e-9, `tilted as the Earth, lit as the Earth (${axis})`)
  const upright = body.bodySunDir(sun, lon, 0)
  assert.ok(Math.abs(upright.y) < 1e-12, 'an upright body has the Sun over its equator')
  assert.ok(Math.abs(Math.atan2(upright.z, upright.x) - .4) < 1e-9, 'the hour is kept')
  const deep = body.bodySunDir(sun, lon, 45)
  assert.ok(Math.abs(deep.y - Math.sin(Math.PI / 4)) < 1e-9)
  assert.ok(Math.abs(Math.hypot(deep.x, deep.y, deep.z) - 1) < 1e-9, 'a unit direction')
})

test('the body as a small disc: transparent outside it, deterministic, leaned by its tilt', () => {
  const a = body.bodyDisc(RECORD, 32), b = body.bodyDisc(RECORD, 32)
  assert.deepEqual(a.data, b.data)
  assert.equal(a.data[3], 0, 'the corner is outside the disc and its air')
  assert.equal(a.data[(16 * 32 + 16) * 4 + 3], 255, 'the centre is the body')
  assert.notDeepEqual(body.bodyDisc({...RECORD, sky: {...RECORD.sky, axial_tilt_deg: 40}}, 32).data, a.data, 'another tilt leans the land')
  assert.doesNotMatch(body.bodyDisc.toString() + body.cloudImage.toString() + body.suggestName.toString(), /Math\.random/)
})

test('the generator runs off the main thread where a worker can start; here it runs on the main thread, byte for byte the same', async () => {
  assert.equal(bodyRenderThread(), 'main', 'no Worker in this runtime')
  const pictures = await renderBody(RECORD, 64, 32)
  assert.deepEqual(pictures.image.data, body.bodyImage(RECORD, 64).data)
  assert.deepEqual(pictures.clouds.data, body.cloudImage(RECORD, 32).data)
})

// ── the World group's Bodies, and the scales ──────────────────────────────────────────────────────────────────────

const WORLD_READINGS = {standing: IDLE_STANDING, world: {reason: 'not read'}, carrier: {available: true}}

test('World › Bodies lists your planet from its owner\'s record and the worlds of today\'s set; it waits only while the record is not read', () => {
  const hint = browserCategoriesOf('techne').find(category => category.id === 'techne-bodies').hint
  assert.equal(browserCategoriesOf('techne').find(category => category.id === 'techne-bodies').state, 'cut')
  const unbound = rows.worldGroupOf('techne-bodies', {...WORLD_READINGS, body: {state: 'unbound'}}, hint)
  assert.deepEqual([unbound.state, unbound.word], ['waiting', 'waiting'])
  assert.match(unbound.detail, /read when the Earth stands/)
  assert.equal(rows.worldGroupOf('techne-bodies', {...WORLD_READINGS, body: {state: 'reading'}}, hint).word, 'reading')
  assert.equal(rows.worldGroupOf('techne-bodies', {...WORLD_READINGS, body: {state: 'refused', reason: 'The Wiki owner is unavailable'}}, hint).detail, 'The Wiki owner is unavailable.')
  const system = {state: 'read', bodies: model.systemOf(input()), set: null}
  const group = rows.worldGroupOf('techne-bodies', {...WORLD_READINGS, body: {state: 'read', reading: readingOf(YOURS.ref, RECORD, 67), record: RECORD}, system}, hint)
  assert.equal(group.state, 'rows')
  assert.deepEqual(group.rows.map(row => [row.kind, row.name, row.standing, row.opens]),
    [['body', 'Your world', `seed ${RECORD.seed}`, 'body'], ['body', 'O-I', 'seeded', 'subject'], ['body', 'Book', 'reading', 'subject']])
  const none = rows.worldGroupOf('techne-bodies', {...WORLD_READINGS, body: {state: 'read', reading: readingOf(YOURS.ref, null, 3), record: null}}, hint)
  assert.equal(none.rows[0].standing, 'no body yet')
})

test('the scales follow the manual: Field · System · Body · Region · Place; a palace entered is a place you are in', () => {
  assert.deepEqual([...placesModel.ATLAS_SCALES], ['field', 'system', 'body', 'region', 'place'])
  assert.equal(placesModel.atlasScaleOf({sky: false, graph: false, dist: 2.25, placeHeld: true}), 'place')
  assert.equal(placesModel.atlasScaleOf({sky: false, graph: false, dist: 2.25}), 'region', 'no place held: a region')
  assert.equal(placesModel.atlasScaleOf({sky: false, graph: false, dist: 5, palace: true}), 'place')
  assert.equal(placesModel.atlasScaleOf({sky: true, graph: false, dist: 3000}), 'system')
})
