// T-PALACES-ONTO-ATLAS: palaces live in the atlas (FOUNDATION §3 N4). M5′ Palace / Integral Whole opens the Earth pane (never the stage's
// retired Palace lens) and stands on the rack as one plate: outside a palace, the world's palaces (the mockup's Palaces) and the doors the
// Earth's selection stands at; inside, the mockup's Rooms, Path (guided · free, the guide) and Portals, with the whole, the composition
// and the Return beside them (world-shell-mockup.html:1461). The palace itself is drawn in the pane at the atlas's palace scale
// (PalaceFloor.tsx) with no control in it; M4′'s Locations kind `palace` lists the palaces. Rendered server-side with production
// modules in memory (the loader of atlas-places-plate.test.mjs), over owners standing in for the live ones.
import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'
import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'

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
const {InstrumentDeviceDetail} = await import('../src/shell/ModeDetail.tsx')
const chain = await import('../src/inhabitants/ql/devices/TechneDevices.tsx')
const {publishSuiteStanding, resetSuiteStanding, IDLE_STANDING} = await import('../src/projections/atlas/provider/suiteStanding.ts')
const session = await import('../src/projections/atlas/palaces/palaceSession.ts')
const {PalaceFloor} = await import('../src/projections/atlas/palaces/PalaceFloor.tsx')
const {PalacePlate} = await import('../src/projections/atlas/palaces/PalacePlate.tsx')
const model = await import('../src/projections/atlas/palaces/palacesModel.ts')
const {setWikiProjectionRegisters} = await import('../../../../desktop/cradle/src/techne/wikiProjectionStore.ts')
const {provingReading} = await import('../../../../desktop/cradle/src/techne/m0m5/journey/proving-reading.ts')
const {createDisclosureSessionStore} = await import('../../../../desktop/cradle/src/techne/session.ts')
const {regionSceneRef} = await import('../../../../desktop/cradle/src/techne/m0m5/palace/composition.ts')
const {resetPalaceCompositions} = await import('../../../../desktop/cradle/src/techne/m0m5/palace/palace-state.ts')
const {instrumentOfPane} = await import('../src/shell/paneInstrument.ts')

door.resetFamilyManifestsForTest()
world.loadWorldShellFamilies()
adoptRows.adoptVerifiedRows()

const transport = {kind: 'unavailable', reason: 'the test carrier is down'}
const html = element => renderToStaticMarkup(element)
const M5 = () => html(createElement(InstrumentDeviceDetail, {transport, instrument: 'techne:m5'}))
const M4 = () => html(createElement(InstrumentDeviceDetail, {transport, instrument: 'techne:m4'}))
/** The plate with every section unfolded (the person's presses on the folded strips). */
const M5open = () => html(createElement(PalacePlate, {held: [], focused: true, startFolded: []}))

const EXPR = 'expression:techne-m0.central.abc'
const OVERVIEW = `${EXPR}:scene:overview`, STONE = `${EXPR}:scene:c1`, WALK = regionSceneRef(EXPR, 'Walk')
const DOC = {
  schema: 'oi.expression/v1', expression_ref: EXPR, revision: 4, title: 'Central',
  scenes: [
    {scene_ref: OVERVIEW, revision: 1, title: 'Central', entity_refs: []},
    {scene_ref: STONE, revision: 1, title: 'The Stone', entity_refs: ['e1']},
    {scene_ref: WALK, revision: 1, title: 'Walk', entity_refs: [], body: {carrier: 'expression_ref', subject_ref: 'expression:walk'}, triggers: []},
  ],
  entities: {e1: {entity_ref: 'e1', revision: 1, title: 'the carving', subject: {subject_ref: 'wiki:node:carving'}}},
}
const reading = () => {
  const out = structuredClone(provingReading())
  out.subject = {...out.subject, subject_ref: EXPR}
  out.reading_ref = `ql.techne:reading:${EXPR}@4`
  out.expressions = DOC.scenes.map(scene => ({expression_ref: EXPR, revision: '4', scene_ref: scene.scene_ref}))
  return out
}
const opened = []
const OWNERS = {
  inspect: async () => structuredClone(DOC), readWhole: async () => reading(), list: async () => [{expression_ref: 'expression:gate', title: 'Gate', revision: 1}],
  edit: async () => ({state: 'ready', document: DOC}), invoke: async () => ({state: 'refused', reason: 'not here'}), hold: async () => EXPR,
  projection: () => ({overviewSceneRef: OVERVIEW, constellations: [{sceneRef: STONE}]}), storage: () => null, session: createDisclosureSessionStore(),
  open: {expression: ref => { opened.push(ref); return 'opened' }, scene: () => 'opened', subject: () => 'opened', instrument: () => 'opened', source: () => 'opened'},
}
const ROW = {key: 'central', title: 'Central', project: null, expression_ref: EXPR, revision: 4, held: true, standing: 'open', rooms: []}
const PLACES = [{ref: 'wiki:place:bollingen', name: 'Bollingen', kind: 'declared', owner: 'wiki', source: 'Central wiki', subject_ref: 'wiki:node:carving',
  relation: 'OCCURRED_AT', located: true, precision: 'exact', lat: 47.22, lon: 8.84, reason: null}]

async function enter() {
  session.resetPalaceSession()
  resetPalaceCompositions()
  session.bindPalaceOwners(OWNERS)
  await session.enterPalace(ROW)
  await new Promise(resolve => setImmediate(resolve))
}

test('M5′ Palace opens the Earth pane, never the stage\'s retired Palace lens, and the press holds across the focus it causes', () => {
  assert.deepEqual(chain.instrumentDoorOf('techne:m5'), {kind: 'projection.earth'})
  const earth = instrumentOfPane('projection.earth', null, 'earth')
  assert.equal(chain.focusAfterOpening('techne:m5', 'techne:m1'), earth, 'pressed from the stage: the Earth takes the focus, and M5′ holds')
  assert.equal(chain.focusAfterOpening('techne:m5', 'techne:m4'), 'techne:m4', 'from another atlas instrument the focus stands')
  // while a palace is entered the Earth pane stands as M5′ — the atlas's palace scale is M5′'s
  assert.equal(chain.atlasInstrumentNow(earth, 'inside'), 'techne:m5')
  assert.equal(chain.atlasInstrumentNow(earth, 'outside'), earth)
  assert.equal(chain.atlasInstrumentNow('techne:m2', 'inside'), 'techne:m2', 'a pane that is not the atlas keeps its instrument')
})

test('outside, the focused M5′ is the Palace design, then its plate: the world\'s palaces open, and Portals folded until a palace is entered', async () => {
  session.resetPalaceSession()
  setWikiProjectionRegisters([{key: 'central', title: 'Central'}, {key: 'Archetypal-Earth', title: 'Archetypal-Earth', project: 'Archetypal-Earth'}])
  const out = M5()
  assert.match(out, /data-instrument="techne:m5"[^>]*data-palace-plate="true"/, 'the Palace plate stands open')
  assert.match(out, />Palace \/ Integral Whole</, 'the mockup\'s plate title')
  // W4-Technē: the Palace design (techne:palace) heads M5′'s chain on the palace session and carries Rooms, Path and Board itself
  // (techne-designs-binding.test.mjs); the plate after it keeps the world's palaces, Enter and the portals.
  assert.ok(out.indexOf('data-device-id="techne:palace" data-chain-place="head"') >= 0, 'the Palace design heads the chain')
  assert.ok(out.indexOf('data-device-id="techne:palace"') < out.indexOf('data-palace-plate="true"'), 'the design before the plate')
  const order = ['palaces', 'portals'].map(id => out.indexOf(`data-section="${id}"`))
  assert.ok(order.every(at => at > 0) && [...order].sort((a, b) => a - b).join() === order.join(), 'the sections, in order')
  for (const id of ['rooms', 'path', 'board']) assert.doesNotMatch(out, new RegExp(`data-section="${id}"`), `${id}: the design's, not the plate's`)
  // each palace a row of the kit's rows (lane E): its standing on the status line, never a scroller
  assert.match(out, /data-i="Central\|Central — [^"]*not read yet[^"]*"[^>]*>.*?<span class="dp-row-name">Central<\/span>/s, 'each register is a palace, its reading\'s standing said')
  assert.match(out, /<span class="dp-row-name">Archetypal-Earth<\/span>/)
  assert.match(out, /data-section="portals" data-folded="true"/, 'portals fold to their strip outside a palace')
  for (const id of ['techne:m0', 'techne:m1', 'techne:m2', 'techne:m3', 'techne:m4']) assert.match(out, new RegExp(`data-instrument="${id}" data-expanded="false"`), `${id} folds`)
  assert.doesNotMatch(out, /<svg[^>]*class="atlas-palace__plan"/, 'the plate draws no palace: the pane does')
})

test('inside, the Palace design heads M5′ with the palace\'s controls (Rooms, Path, Board, Return); the plate keeps the rooms\' Open, the walk by locus, the bookmarks\' Rename and Delete, the portals (the ground first), the whole and the composition', async () => {
  await enter()
  const folded = M5()
  // W4-Technē: the Palace design (techne:palace) carries Room, Start, Back, Next, Path, Order, Guide, Floor, Audience, Snap, Lines, Keep,
  // Propose, Accept, Refuse and Leave on the palace session, with the floor in its display (techne-designs-binding.test.mjs); the plate
  // after it keeps what the design does not carry, and no second well.
  assert.ok(folded.indexOf('data-device-id="techne:palace" data-chain-place="head"') >= 0 && folded.indexOf('data-device-id="techne:palace"') < folded.indexOf('data-palace-plate="true"'), 'the design heads the chain')
  const order = ['rooms', 'walk', 'bookmarks', 'portals', 'whole', 'compose'].map(id => folded.indexOf(`data-section="${id}"`))
  assert.ok(order.every(at => at > 0) && [...order].sort((a, b) => a - b).join() === order.join(), 'every section, in order')
  for (const id of ['display', 'path', 'board']) assert.doesNotMatch(folded.slice(folded.indexOf('data-palace-plate="true"')), new RegExp(`data-section="${id}"`), `${id}: the design's`)
  assert.doesNotMatch(folded, /data-section="return"/, 'nothing proposed yet: the Return says nothing here (the design carries Propose)')
  for (const id of ['whole', 'compose']) assert.match(folded, new RegExp(`data-section="${id}" data-folded="true"`), `${id} folds to its strip until pressed`)
  for (const id of ['rooms', 'walk', 'portals']) assert.doesNotMatch(folded, new RegExp(`data-section="${id}" data-folded`), `${id} stands open`)
  assert.match(folded, /\|Technē · Central r4 · open on the focused pane/, 'the head names the palace and its revision')
  assert.doesNotMatch(folded, /M[0-5]′|M′[0-5]/, 'and no M′ number names a Technē instrument (#753)')
  assert.doesNotMatch(folded, /inst-head-reading/, 'no reading in the head')
  assert.match(folded, /class="plate-line palace-plate-line" role="status" data-i="Palace\|Browser storage is unavailable/, 'the palace\'s line stands under the sections')
  const out = M5open()
  assert.match(out.slice(out.indexOf('data-section="portals"')), /data-row="ground"[^>]*data-i="↩ the Earth\|Return to the ground: the Earth \(Escape\)"/, 'the ground is the first door out')
  const rooms = out.slice(out.indexOf('data-section="rooms"'), out.indexOf('data-section="walk"'))
  assert.ok(rooms.indexOf('>Central<') < rooms.indexOf('>The Stone<') && rooms.indexOf('>The Stone<') < rooms.indexOf('>Walk<'), 'the rooms, in path order')
  assert.match(rooms, /→ expression:walk/, 'a region says the Expression it holds')
  assert.match(rooms, /aria-label="Remove Walk"/, 'a hand-made region can be removed (on Save)')
  assert.doesNotMatch(rooms, /aria-label="Guide"/, 'Guide is the design\'s')
  assert.match(rooms, /class="plate-line" role="status" data-tone="guide"/, 'the guide says why the room stands where it does')
  const walk = out.slice(out.indexOf('data-section="walk"'), out.indexOf('data-section="bookmarks"'))
  assert.match(walk, /Locus 1 of \d+ · Project \/ ground · /, 'the walk stands at the named start, locus by locus')
  assert.doesNotMatch(walk, /aria-label="Path"|Order|>Start</, 'Path, Order and Start are the design\'s')
  assert.match(out.slice(out.indexOf('data-section="bookmarks"')), /No bookmarks yet\. Keep one on the Palace device/)
  const whole = out.slice(out.indexOf('data-section="whole"'), out.indexOf('data-section="compose"'))
  assert.match(whole, /data-standing="warranted"/, 'a warranted region says so')
  assert.match(whole, /data-standing="free"/, 'free composition says so')
  assert.match(out, /Save composition/)
  assert.match(out.slice(out.indexOf('data-section="portals"'), out.indexOf('data-section="whole"')), /→ expression:walk/, 'a region\'s Expression is a portal out')
  assert.doesNotMatch(out, /Propose Return/, 'Propose is the design\'s')
  assert.doesNotMatch(out, /places-list|overflow: ?auto/, 'no list scrolls inside the plate: rows page')
})

test('the palace is drawn in the pane: its rooms along the guided path, their objects, the walk\'s focus — and no control', async () => {
  await enter()
  const out = html(createElement(PalaceFloor))
  assert.match(out, /class="atlas-palace" data-palace-phase="inside" data-palace="central"/)
  assert.equal((out.match(/class="palace-room"/g) ?? []).length, 3, 'one room per Scene')
  assert.match(out, /data-room="[^"]*c1"[^>]*data-kind="constellation"/)
  assert.match(out, /data-room="[^"]*region-Walk"[^>]*data-kind="region"/)
  assert.match(out, /<text[^>]*>the carving<\/text>/, 'a room draws the subjects it holds')
  assert.match(out, /→ <!-- -->expression:walk|→ expression:walk/, 'a region draws its portal')
  assert.match(out, /data-i="The Stone\|A constellation of the register: one of its curated sections[^"]*Its form: free mnemonic composition/, 'each room says why it is there (the guide, T18)')
  assert.equal((out.match(/<line /g) ?? []).length, 2, 'the path runs through the rooms')
  assert.doesNotMatch(out, /<button\b|<input\b|<select\b/, 'no control stands in the pane')
  session.setPath('free')
  assert.doesNotMatch(html(createElement(PalaceFloor)), /class="palace-path"/, 'free exploration draws no path')
  session.leavePalace()
  assert.equal(html(createElement(PalaceFloor)), '', 'outside, the pane is the Earth')
})

test('M4′\'s Locations kind `palace` goes live: the palaces of the world, each at its door', () => {
  session.resetPalaceSession()
  const out = M4()
  assert.match(out, /role="radio" aria-checked="false">palace</, 'the kind is offered, not disabled')
  assert.doesNotMatch(out, /title="A palace is a place you enter \(N4\): no owner builds one on the atlas yet\."/, 'the old waiting words are gone')
  // the door: the first room on the path whose subjects are placed
  const rooms = model.roomsOf(DOC, {overviewSceneRef: OVERVIEW, constellations: [{sceneRef: STONE}]})
  const [row] = model.palaceLocationRows([{...ROW, rooms}], PLACES)
  assert.equal(row.door.place.name, 'Bollingen')
  assert.equal(row.door.room, 'The Stone')
  assert.equal(row.line, 'door at Bollingen (The Stone) · 1 of 3 rooms on the Earth')
  const [none] = model.palaceLocationRows([{...ROW, rooms}], [])
  assert.equal(none.door, null)
  assert.match(none.line, /none placed on the Earth: no subject it holds declares a place/, 'never drawn at a made-up point')
  assert.deepEqual(model.palacesHolding('wiki:node:carving', [{...ROW, rooms}]).map(({room}) => room.name), ['The Stone'], 'the doors a selection stands at')
})

test('the palaces of the world are the registers\' Expressions, each with its rooms and its standing', () => {
  const doc = {...DOC}
  const rows = model.palaceRows({
    registers: [{key: 'central', title: 'Central'}, {key: 'x', title: 'X', project: 'X'}, {key: 'y', title: 'Y', project: 'Y'}],
    standings: {
      central: {phase: 'ready', projection: {document: doc, overviewSceneRef: OVERVIEW, constellations: [{sceneRef: STONE}]}, document: doc},
      x: {phase: 'unavailable', reason: 'the wiki file is missing'},
      y: {phase: 'projected', projection: {document: doc, overviewSceneRef: OVERVIEW, constellations: []}},
    },
  })
  assert.deepEqual(rows.map(row => [row.key, row.held, row.rooms.length, row.revision]), [['central', true, 3, 4], ['x', false, 0, null], ['y', false, 3, null]])
  assert.equal(rows[1].standing, 'could not be read: the wiki file is missing', 'a refused register says why, in the owner\'s words')
  assert.equal(rows[2].standing, 'read; its Expression is not open in the kernel yet')
})

test('publishing a standing does not disturb a palace: the suite\'s places only name its doors', async () => {
  publishSuiteStanding({...IDLE_STANDING, phase: 'ready', places: PLACES})
  try {
    await enter()
    assert.doesNotMatch(M5open(), /→ Bollingen/, 'at the named start the walk stands in no room')
    session.moveWalk(session.walkOf(session.inside()).steps.findIndex(step => step.ref === STONE))
    assert.match(M5open(), /→ Bollingen/, 'the room the walk stands in: its placed subject is a portal to its place')
  } finally {
    resetSuiteStanding()
    session.resetPalaceSession()
  }
})

test('inside a palace the floor is the pane\'s whole picture: it stands above every overlay the atlas places in the pane (seen through, 15 Oct)', async () => {
  const {readFile, readdir} = await import('node:fs/promises')
  const styleDir = new URL('../src/projections/atlas/src/style/', import.meta.url)
  // The atlas's own dialogs stand over everything in the pane on purpose — its search (⌘K, z 60) and its loading veil (z 100) — and
  // stay above a palace too. Every other overlay reads the field (labels, sky, Aion, the header and its menu): all below 50.
  const DIALOGS = 50
  let highest = 0
  for (const name of (await readdir(styleDir)).filter(file => file.endsWith('.css'))) {
    for (const match of (await readFile(new URL(name, styleDir), 'utf8')).matchAll(/z-index:\s*(\d+)/g)) if (Number(match[1]) < DIALOGS) highest = Math.max(highest, Number(match[1]))
  }
  const palaces = await readFile(new URL('../src/projections/atlas/palaces/palaces.css', import.meta.url), 'utf8')
  const layer = /\.atlas-palace-layer \{[^}]*z-index:\s*(\d+)/.exec(palaces)
  assert.ok(layer, 'the palace layer names its height')
  assert.ok(Number(layer[1]) > highest, `the palace layer (${layer[1]}) stands above the atlas's highest field overlay (${highest}): no focus label, sky or header shows through the floor`)
  assert.ok(Number(layer[1]) < DIALOGS, 'the atlas\'s search and loading veil still stand over a palace')
  const floor = await readFile(new URL('../src/projections/atlas/palaces/PalaceFloor.tsx', import.meta.url), 'utf8')
  assert.match(floor, /if \(state\.phase !== 'inside'\) return null/, 'outside a palace the layer draws nothing, so its height covers nothing of the Earth')
})
