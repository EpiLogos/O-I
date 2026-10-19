// The ticket N (PATH §7, the register's S1 + G2): Technē starts from the world. The browser's World groups list the owners' own
// subjects; choosing one opens it through N2's subject door; the instruments keep it — the Graph opens on it.
//
// Channels (each claim below is carried by exactly one):
// - REAL OWNER COMPOSITION: the suite standing is composed by the provider's own code (provider/suiteReading.ts composeSuite,
//   standingOf) over the recorded 14 Oct Graph reading and wiki file (tests/fixtures/atlas-suite-reading.json), with synthetic place
//   declarations where the owners declare none today, exactly as tests/atlas-suite-provider.test.mjs declares them;
// - REAL OWNER DOOR: the World rows' subjects resolve through openWorldSubject over the owner's own projection of that recorded wiki
//   file (techne/wikiExpression.ts projectWikiExpression) and its reverse query (wikiProjectionStore.ts projectedSubjectStandings);
// - SSR: the World rows, the Clip view of a held subject and the Instruments preview rendered to markup over those readings;
// - SCRIPTED: the Graph's open focus with the atlas's own focus rule (registerAtlasHost.ts stateForSubject) over a fake atlas handle;
// - SOURCE TEXT: the one Graph focus call, the World dispatch, no mode branch.
// Not covered: the window on screen — whether the stage shows the asked Scene, the rows' look at 1440px, the Graph turning in the
// native app. Those are UNVERIFIED here and the lead's native pass.
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {register} from 'node:module'
import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'

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
  const source = (await readFile(new URL(u), 'utf8')).replace(/import\\.meta\\.env/g, '({BASE_URL:"/"})');
  return {format: 'module', shortCircuit: true, source: ts.transpileModule(source, {fileName: new URL(u).pathname,
    compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX}}).outputText};
}`)}`, import.meta.url)

const cradle = '../../../../desktop/cradle/src/'
const {composeSuite, standingOf, inputOfReading} = await import('../src/projections/atlas/provider/suiteReading.ts')
const {declarationsFromWiki} = await import('../src/projections/atlas/provider/suiteProvider.ts')
const {IDLE_STANDING, describeProgress} = await import('../src/projections/atlas/provider/suiteStanding.ts')
const rows = await import('../src/techne/subject/worldRows.ts')
const openings = await import('../src/techne/subject/subjectOpenings.ts')
const {openWorldSubject, presentStage, STAGE_KIND, TECHNE_EXAMINE_EVENT} = await import('../src/techne/subject/openSubject.ts')
const {UNSTOOD_WORDS} = await import('../src/techne/subject/subjectScenes.ts')
const {focusGraphOnOpen, noNodeWords} = await import('../src/techne/subject/graphFocus.ts')
const techneClip = await import('../src/techne/clipBinding.ts')
const {projectWikiExpression} = await import(`${cradle}techne/wikiExpression.ts`)
const {projectedSubjectStandings, wikiProjectionOf} = await import(`${cradle}techne/wikiProjectionStore.ts`)
const {parseWiki} = await import(`${cradle}techne/wikiReading.ts`)
const {createPaneSubject} = await import(`${cradle}surface/projectionModules.ts`)
const {WorldGroupBody} = await import('../src/shell/ModeBrowser.tsx')
const {InstrumentPreview} = await import('../src/frame/InstrumentsSection.tsx')
const {heldSubjectWords, instrumentEntries} = await import('../src/frame/instruments.ts')
const {stateForSubject} = await import('../src/projections/atlas/registerAtlasHost.ts')
const {browserCategoriesOf} = await import('../src/shell/modeGrammar.ts')

const html = element => renderToStaticMarkup(element)
const source = path => readFile(new URL(`../src/${path}`, import.meta.url), 'utf8')
const fixture = JSON.parse(await readFile(new URL('./fixtures/atlas-suite-reading.json', import.meta.url), 'utf8'))
const clone = value => JSON.parse(JSON.stringify(value))
const READ_AT = new Date('2026-10-14T15:17:18.000Z')
const WIKI_BASIS = {path: fixture.wikiFile.path, revision: fixture.wikiFile.revision, location: {schema: 'central.path-ref/v1', ref: 'ref:Control/agents/wiki/wiki.json', root: 'Control', path: fixture.wikiFile.path}}
const recordedInputs = () => ({
  central_wiki: inputOfReading('central_wiki', clone(fixture.graph.central_wiki)),
  shared_field: inputOfReading('shared_field', clone(fixture.graph.shared_field)),
  aikit_resolution: inputOfReading('aikit_resolution', clone(fixture.graph.aikit_resolution)),
})

// The synthetic declarations of tests/atlas-suite-provider.test.mjs (the owners declare no place today).
const declaration = spatial => ({'aikit.techne-facet/v1': {contract: 'aikit.techne-facet/v1', spatial}})
const IDENTITY = 'wiki:node:identity'
const PROPOSE = 'wiki:node:staged/propose-not-write'
const RETURN = 'wiki:node:root/ta-onta-and-the-thought-stream'
const PLACE = 'wiki:node:place-provider-reconciles-like-the-floor'
function declarationsWith(patch) {
  const objects = clone(fixture.wikiFile.objects)
  for (const [ref, change] of Object.entries(patch)) Object.assign(objects.find(object => object.ref === ref), change)
  return declarationsFromWiki(JSON.stringify({objects}), WIKI_BASIS)
}
const PLACES = {
  [IDENTITY]: {place: {names: [{name: 'The Chapel'}], geometry: {type: 'point', coordinates: [-4.27, 50.18]}, precision: 'exact'}},
  [PROPOSE]: {place: {geometry: {type: 'point', coordinates: [12.5, 41.9]}}},
  [RETURN]: declaration([{place_ref: 'place:chartres', relation: 'OCCURRED_AT', precision: 'region', identity: {names: [{name: 'Chartres'}]}, geometry: {type: 'point', coordinates: [1.49, 48.45]}}]),
  [PLACE]: {place: {names: [{name: 'Nowhere yet'}]}},
}
/** A ready standing, as the provider publishes it after a reading. */
function readyStanding(declarations = declarationsWith(PLACES)) {
  const sources = {inputs: recordedInputs(), declarations, readAt: READ_AT}
  return standingOf('ready', sources, composeSuite(sources))
}
const LIVE_WORLD = sets => ({state: 'live', sets, eventByClipId: new Map(), todayYear: 2026})
const CARRIER = {available: true}
const readings = (standing, extra = {}) => ({standing, world: LIVE_WORLD([]), carrier: CARRIER, ...extra})
const hintOf = id => browserCategoriesOf('techne').find(category => category.id === id).hint
const categoryOf = id => browserCategoriesOf('techne').find(category => category.id === id)

// The owner's projection of the recorded wiki file, and a door source over its reverse query (as tests/n2-subject.test.mjs builds one).
const wiki = parseWiki(JSON.stringify({objects: fixture.wikiFile.objects}))
const projection = projectWikiExpression({state: 'ready', register: {key: 'central', title: 'Central'}, wiki, wikiBasis: WIKI_BASIS,
  relations: {state: 'unavailable', focusRef: 'central:wiki:root', reason: 'no relations read in this fixture'}})
const standings = {central: {phase: 'projected', reading: null, projection}}
function doorSource() {
  const acts = []
  return {
    acts,
    async loadRegisters() { acts.push('load') },
    unreadRegisters: () => [],
    standingsOf: ref => projectedSubjectStandings(standings, ref),
    projectionOf: key => wikiProjectionOf(standings[key]),
    ask: request => acts.push(['ask', request]),
    present: () => acts.push('present'),
  }
}
const unescape = text => text.replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&')
const cells = markup => [...markup.matchAll(/class="mode-browser-row[^"]*"[^>]*>(?:(?!<\/button>).)*?<span>([^<]*)<\/span><span class="mode-browser-row-meta[^"]*">([^<]*)<\/span>/g)]
  .map(match => [unescape(match[1]), unescape(match[2])])

// ── the groups, from the landed owners ─────────────────────────────────────────────────────────────────────────────────────────

test('Locations are the project spaces the suite reading names on your planet, by the owner\'s own names and refs', () => {
  const group = rows.worldGroupOf('techne-locations', readings(readyStanding()), hintOf('techne-locations'))
  assert.equal(group.state, 'rows')
  assert.equal(group.rows.length, 15, 'each project space Central\'s root names is a Location')
  assert.deepEqual(group.rows.slice(0, 3).map(row => row.name), ['Actuation', 'Archetypal-Earth', 'Central'], 'named in words, as the owner names them')
  for (const row of group.rows) {
    assert.match(row.subject.ref, /^central:wiki:project:/, 'the subject is the owner\'s ref, verbatim')
    assert.equal(row.subject.title, row.name)
    assert.deepEqual([row.kind, row.mark, row.standing, row.opens], ['location', 'location', 'project', 'subject'])
    assert.match(row.hover, /Not on the Earth: no owner declares where this project is\./, 'the provider\'s reason, in the hover')
    assert.doesNotMatch(row.name, /:/, 'never a ref for a name')
  }
})

test('Earth places are the places owners declare, one row each, at the owner\'s own precision or named unlocated', () => {
  const group = rows.worldGroupOf('techne-places', readings(readyStanding()), hintOf('techne-places'))
  assert.equal(group.state, 'rows')
  const by = Object.fromEntries(group.rows.map(row => [row.name, row]))
  assert.deepEqual(Object.keys(by).sort(), ['Chartres', 'Nowhere yet', 'The Chapel', 'You may propose'])
  assert.equal(by['The Chapel'].standing, 'exact')
  assert.equal(by.Chartres.standing, 'region')
  assert.equal(by['Nowhere yet'].standing, 'unlocated')
  assert.match(by['Nowhere yet'].hover, /not on the Earth: the owner declares it unlocated/)
  assert.match(by.Chartres.hover, /on the Earth at 48\.450, 1\.490 \(region\); declared by 1 subject through central\.wiki\.read \(OCCURRED_AT\) \(place:chartres\)/)
  assert.equal(by['You may propose'].subject.ref, PROPOSE, 'a declared place with no name of its own is named as the owner\'s producer names it (its node\'s title)')
  assert.equal(by['You may propose'].standing, 'approximate', 'a declared geometry with no declared precision is approximate')
  assert.equal(rows.tailOfRef('central:wiki:project:O-I'), 'O-I', 'a place named by its ref alone would read as the ref\'s tail')
  assert.equal(by.Chartres.subject.ref, 'place:chartres', 'the place itself is the subject, by the owner\'s ref')
  const none = rows.worldGroupOf('techne-places', readings(readyStanding(declarationsWith({}))), hintOf('techne-places'))
  assert.equal(none.state, 'waiting')
  assert.equal(none.word, 'none')
  assert.equal(none.words, 'No owner declares a place in this reading.')
  assert.match(none.detail, /^Your world: 45 subjects read from their owners, none on the Earth\./, 'and the standing\'s own words under it')
})

test('while the owners are read a group says so in the standing\'s words; with no carrier it says why', () => {
  const idle = rows.worldGroupOf('techne-places', readings(IDLE_STANDING), hintOf('techne-places'))
  assert.deepEqual([idle.state, idle.word], ['waiting', 'reading'])
  assert.match(idle.words, /^Reading your world — the places your owners declare come from the suite reading of your owners\.$/)
  const away = rows.worldGroupOf('techne-locations', readings(IDLE_STANDING, {carrier: {available: false, reason: 'the bridge is not running'}}), hintOf('techne-locations'))
  assert.deepEqual([away.word, away.detail], ['waiting', 'The kernel carrier is unavailable: the bridge is not running.'])
  const partial = {inputs: {central_wiki: recordedInputs().central_wiki}, readAt: READ_AT}
  const reading = standingOf('reading', partial, composeSuite(partial), ['shared_field', 'aikit_resolution'])
  const midway = rows.worldGroupOf('techne-locations', readings(reading), hintOf('techne-locations'))
  assert.equal(midway.state, 'rows', 'the places that have arrived are listed while the rest is read')
  assert.equal(midway.note, describeProgress(reading), 'with the provider\'s own progress words under them')
  assert.match(midway.note, /waiting for the shared field, AIKit knowledge…$/)
})

test('Bodies are your planet\'s body from its owner\'s record and your system\'s worlds (T-WORLDS §5 W3); they wait while it is not read', () => {
  const unread = rows.worldGroupOf('techne-bodies', readings(readyStanding()), hintOf('techne-bodies'))
  assert.deepEqual([unread.state, unread.word], ['waiting', 'waiting'], 'no body reading here: the group waits, naming on what')
  assert.match(unread.detail, /Your planet’s body is read when the Earth stands/)
  const RECORD = {body_ref: 'body:central:wiki:root', seed: 7, generator: {id: 'fbm-sphere', version: 1},
    landmass: {sea_level: .5, continents: 1.7, relief: .55, coast: 'smooth'}, climate: {warmth: .5, moisture: .5, ice_caps: .3}, sky: {atmosphere: .6, clouds: .3, axial_tilt_deg: 18}}
  const space = {ref: 'central:wiki:root', revision: 67, title: 'Central'}
  const built = rows.worldGroupOf('techne-bodies', {...readings(readyStanding()), body: {state: 'read', reading: {space}, record: RECORD}}, hintOf('techne-bodies'))
  assert.equal(built.state, 'rows')
  assert.deepEqual(built.rows.map(row => [row.kind, row.mark, row.name, row.standing, row.opens]), [['body', 'world', 'Central', 'seed 7', 'body']])
  const refused = rows.worldGroupOf('techne-bodies', {...readings(readyStanding()), body: {state: 'refused', reason: 'The Wiki owner is unavailable'}}, hintOf('techne-bodies'))
  assert.equal(refused.detail, 'The Wiki owner is unavailable.', 'the owner\'s words')
  assert.equal(categoryOf('techne-bodies').state, 'cut', 'and the category is cut: the record reads (T-WORLDS §5 W3a, ai-kit#522)')
})

test('Journeys list the World\'s walks the tracks call journeys, and keep the grammar\'s hint when the World carries none', () => {
  const walk = (id, kind, extra = {}) => ({id, name: `Walk ${id}`, kind, derived: false, stops: [{id: `${id}-1`, label: 'one'}, {id: `${id}-2`, label: 'two'}], ...extra})
  const sets = [{tracks: [], clips: [], columns: [], walks: [walk('a', 'redbook'), walk('b', 'field-thread'), walk('c', 'aion-thread', {layerId: 'L'}), walk('a', 'redbook')]}]
  const group = rows.worldGroupOf('techne-journeys', readings(IDLE_STANDING, {world: LIVE_WORLD(sets)}), hintOf('techne-journeys'))
  assert.equal(group.state, 'rows')
  assert.deepEqual(group.rows.map(row => [row.name, row.standing, row.opens, row.kind]), [['Walk a', '2 stops', 'walk', 'journey']], 'a field thread and a reading\'s walk are not journeys; one row a walk')
  const none = rows.worldGroupOf('techne-journeys', readings(IDLE_STANDING), hintOf('techne-journeys'))
  assert.deepEqual([none.state, none.words], ['waiting', hintOf('techne-journeys')], 'the existing honest hint')
  const unread = rows.worldGroupOf('techne-journeys', readings(IDLE_STANDING, {world: {state: 'unavailable', reason: 'the temporal read refused'}}), hintOf('techne-journeys'))
  assert.equal(unread.detail, 'The World reading is not in: the temporal read refused.')
})

// ── the door ────────────────────────────────────────────────────────────────────────────────────────────────────────────────

test('every Location opens through the door as its own constellation: the Graph op\'s refs are the wiki projection\'s refs', async () => {
  const group = rows.worldGroupOf('techne-locations', readings(readyStanding()), hintOf('techne-locations'))
  for (const row of group.rows) {
    const door = doorSource()
    const answer = await openWorldSubject(row.subject, door)
    assert.equal(answer.state, 'asked', `${row.name} stands in a Scene`)
    assert.equal(answer.scene.whole, true, `${row.name} opens whole: the child space's own constellation`)
    const ask = door.acts.find(act => Array.isArray(act))[1]
    assert.deepEqual([ask.subjectRef, ask.title, ask.lens, ask.origin], [row.subject.ref, row.name, 'canvas', 'external'], 'the owner\'s ask, titled in words')
    assert.equal(door.acts.at(-1), 'present', 'then Technē is presented')
  }
})

test('the door\'s answer is held for every face: asked with the Scenes that carry it, or absent in the owner\'s words', async () => {
  openings.resetSubjectOpenings()
  const door = subject => openWorldSubject(subject, doorSource())
  const places = rows.worldGroupOf('techne-places', readings(readyStanding()), hintOf('techne-places')).rows
  const locations = rows.worldGroupOf('techne-locations', readings(readyStanding()), hintOf('techne-locations')).rows
  const oi = locations.find(row => row.name === 'O-I')
  const chapel = places.find(row => row.name === 'The Chapel')
  const chartres = places.find(row => row.name === 'Chartres')
  // The stage's answer is followed per ask (subjectAsks.ts); here a recorder stands in for the live seam, and answers by hand.
  const follows = []
  const follower = (asked, title, onAnswer) => { const row = {asked, title, onAnswer, stopped: false}; follows.push(row); return () => { row.stopped = true } }
  const pending = openings.openHeldSubject(oi.subject, door, follower)
  assert.deepEqual(openings.subjectOpenings().get(oi.subject.ref), {state: 'opening'}, 'opening… while the owner is asked')
  const asked = await pending
  assert.equal(asked.state, 'asked')
  assert.deepEqual(asked.scenes.map(scene => scene.scene_title), ['O I', 'Central — wiki overview'], 'its own constellation first, then the overview that also stands it')
  assert.equal(asked.opened, asked.scenes[0])
  assert.deepEqual(rows.openingWords(asked, 'O-I'), {standing: 'asking for O I…',
    hover: 'Technē was asked to open O I, the Scene that carries O-I; the stage has not answered yet. 1 more Scene carries it, listed under the row.'},
    'asked is not yet open: the row says the stage has not answered')
  assert.deepEqual([follows.length, follows[0].asked, follows[0].title], [1, {registerKey: 'central', sceneRef: asked.opened.scene_ref}, 'O-I'], 'the ask is followed')
  follows[0].onAnswer({state: 'shown', registerKey: 'central', sceneRef: asked.opened.scene_ref, expression_ref: asked.opened.expression_ref})
  const shown = openings.subjectOpenings().get(oi.subject.ref)
  assert.equal(shown.state, 'shown')
  assert.deepEqual(rows.openingWords(shown, 'O-I'), {standing: 'in O I · +1',
    hover: `Technē's stage shows O I, the Scene that carries O-I (${asked.opened.expression_ref}). 1 more Scene carries it, listed under the row.`})
  const one = await openings.openHeldSubject(chapel.subject, door, follower)
  assert.deepEqual([one.state, one.scenes.map(scene => scene.scene_title)], ['asked', ['Central']], 'a declared place that is a wiki node opens in the Scene that stands it')
  assert.equal(rows.openingWords(one, 'The Chapel').standing, 'asking for Central…')
  const absent = await openings.openHeldSubject(chartres.subject, door, follower)
  assert.deepEqual(absent, {state: 'absent', reason: UNSTOOD_WORDS}, 'a place no Scene stands is the owner\'s absence, verbatim')
  assert.deepEqual(rows.openingWords(absent, 'Chartres'), {standing: UNSTOOD_WORDS, hover: UNSTOOD_WORDS})
  const thrown = await openings.openHeldSubject({ref: 'x', title: 'X'}, async () => { throw new Error('the owner refused') })
  assert.deepEqual(thrown, {state: 'absent', reason: 'the owner refused'}, 'a door that throws is held in its own words, never swallowed')
  // another Scene, chosen: the door's own act, and it is held as the one asked for
  const chosen = []
  const other = asked.scenes[1]
  const before = follows.length
  assert.equal(openings.chooseHeldScene(oi.subject.ref, other, 'O-I', (scene, title) => chosen.push([scene.scene_ref, title]), follower), true)
  assert.deepEqual(chosen, [[other.scene_ref, 'O-I']])
  assert.equal(openings.subjectOpenings().get(oi.subject.ref).opened, other)
  assert.equal(openings.subjectOpenings().get(oi.subject.ref).state, 'asked', 'the chosen Scene is asked for, until the stage answers it')
  assert.deepEqual([follows.length - before, follows[before].asked.sceneRef], [1, other.scene_ref], 'the new ask is followed')
  follows[0].onAnswer({state: 'refused', registerKey: 'central', sceneRef: asked.opened.scene_ref, reason: 'late', by: 'stage'})
  assert.equal(openings.subjectOpenings().get(oi.subject.ref).state, 'asked', 'an answer to the superseded ask changes nothing')
  assert.equal(openings.chooseHeldScene('place:chartres', other, 'Chartres', () => chosen.push('no'), follower), false, 'nothing is chosen for a subject the door did not ask')
  const scenes = rows.sceneRowsOf(openings.subjectOpenings().get(oi.subject.ref), 'O-I')
  assert.deepEqual(scenes.map(scene => [scene.name, scene.standing, scene.asked]), [['O I', 'its own constellation', false], ['Central — wiki overview', 'asked', true]])
  openings.resetSubjectOpenings()
})

test('presenting opens the one stage through the instrument door, then hops into Technē; with no pane tree it still hops', () => {
  const opened = []
  const events = new EventTarget()
  const heard = []
  events.addEventListener(TECHNE_EXAMINE_EVENT, event => heard.push(event.type))
  presentStage(payload => opened.push(payload), events)
  assert.deepEqual([opened, heard], [[STAGE_KIND], ['oi:epi-examine']])
  assert.equal(STAGE_KIND, 'projection.expressions')
  presentStage(() => { throw new Error('No pane tree is mounted to open the instrument in') }, events)
  assert.deepEqual(heard, ['oi:epi-examine', 'oi:epi-examine'])
})

// ── drawn ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────

test('SSR: the World rows as drawn — mark · name in words · standing, the door\'s answer in the standing, the Scenes under the row', async () => {
  const group = rows.worldGroupOf('techne-locations', readings(readyStanding()), hintOf('techne-locations'))
  const ref = 'central:wiki:project:O-I'
  const asked = openings.openingOf(await openWorldSubject({ref, title: 'O-I'}, doorSource()))
  const held = new Map([[ref, asked], ['central:wiki:project:Actuation', {state: 'absent', reason: UNSTOOD_WORDS}]])
  const markup = html(createElement(WorldGroupBody, {category: categoryOf('techne-locations'), group, needle: '', openings: held, stood: new Map(),
    selected: {ref, kind: 'location'}, onSelect() {}, onOpen() {}, onChoose() {}}))
  const drawn = cells(markup)
  assert.deepEqual(drawn.slice(0, 3), [['Actuation', UNSTOOD_WORDS], ['Archetypal-Earth', 'project'], ['Central', 'project']], 'the owner\'s standing, or the door\'s absence in its place')
  const at = drawn.findIndex(([name]) => name === 'O-I')
  assert.deepEqual(drawn.slice(at, at + 3), [['O-I', 'asking for O I…'], ['O I', 'asked'], ['Central — wiki overview', 'the register’s overview']],
    'the asked subject stands on the Scene asked for, its Scenes under it, one step in')
  const answered = opening => cells(html(createElement(WorldGroupBody, {category: categoryOf('techne-locations'), group, needle: '',
    openings: new Map([[ref, opening]]), stood: new Map(), selected: null, onSelect() {}, onOpen() {}, onChoose() {}}))).filter(([name]) => ['O-I', 'O I'].includes(name))
  assert.deepEqual(answered({...asked, state: 'shown', expression_ref: asked.opened.expression_ref}), [['O-I', 'in O I · +1'], ['O I', 'open']], 'shown: the stage shows it')
  assert.deepEqual(answered({...asked, state: 'refused', reason: 'The stage refused it.'}), [['O-I', 'The stage refused it.'], ['O I', 'not open']],
    'refused: the stage\'s own words stand in the row, the Scenes stay listed')
  assert.match(markup, new RegExp(`data-i="Actuation\\|${UNSTOOD_WORDS.replace(/[.?*+^$()|[\]\\]/g, '\\$&').replace(/'/g, '&#x27;')}`), 'an absence is the row\'s Info words too')
  assert.match(markup, /class="mode-browser-row selected"[^>]*aria-current="true"[^>]*data-world-subject="central:wiki:project:O-I"/, 'THE selection\'s row is marked')
  assert.match(markup, /class="mode-browser-row ind1 selected"[^>]*data-subject-scene="[^"]+"[^>]*>(?:(?!<\/button>).)*O I</, 'the asked Scene is marked under it')
  assert.doesNotMatch(markup, /mode-browser-sep/, 'the mockup\'s World rows stand under no separator')
  assert.equal((markup.match(/<svg/g) ?? []).length, group.rows.length + asked.scenes.length, 'every row wears a cut mark')
  assert.doesNotMatch(markup, /toast/i)
  const waiting = html(createElement(WorldGroupBody, {category: categoryOf('techne-bodies'), group: rows.worldGroupOf('techne-bodies', readings(readyStanding()), hintOf('techne-bodies')),
    needle: '', openings: new Map(), stood: new Map(), selected: null, onSelect() {}, onOpen() {}, onChoose() {}}))
  assert.match(waiting, /data-waiting="techne-bodies"/)
  assert.match(waiting, /<span class="mode-browser-empty-state">waiting<\/span>/)
  assert.match(waiting, /Your planet’s body is read when the Earth stands/, 'on what it waits, in the owner\'s terms')
  const places = rows.worldGroupOf('techne-places', readings(readyStanding()), hintOf('techne-places'))
  const searched = html(createElement(WorldGroupBody, {category: categoryOf('techne-places'), group: places, needle: 'chart', openings: new Map(), stood: new Map(),
    selected: null, onSelect() {}, onOpen() {}, onChoose() {}}))
  assert.deepEqual(cells(searched).map(([name]) => name), ['Chartres'], 'the search filters the rows by name')
})

test('Technē\'s Clip side for a held World subject (R2: clip:techne on its binding) names it and lists the Scenes that carry it', async () => {
  const asked = openings.openingOf(await openWorldSubject({ref: 'central:wiki:project:O-I', title: 'O-I'}, doorSource()))
  const subject = {kind: 'location', ref: 'central:wiki:project:O-I', title: 'O-I'}
  const values = techneClip.worldSubjectValues(subject, asked)
  assert.equal(values.name, 'O-I', 'the subject in words heads it')
  assert.equal(values['event.kind'], 'Location · a project space on your planet')
  const material = JSON.parse(values.material)
  assert.equal(material[0].at, 'asked', 'the Scene asked for first')
  assert.ok(material.some(row => row.text === 'Central — wiki overview'), 'the other Scene that carries it, listed')
  assert.equal(material.length, asked.scenes.length)
  const refused = techneClip.worldSubjectValues(subject, {...asked, state: 'refused', reason: 'The stage refused it.'})
  assert.equal(refused['source.admitted'], 'The stage refused it.', 'the refusal, in its words, on the Clip side')
  const binding = techneClip.techneClipBinding({worldCut: false, world: null, worldSubject: subject, opening: asked, selected: {ref: null, clip: null, track: null, set: null}})
  assert.equal(binding.writes('material.open'), true, 'another Scene is the subject door\'s act (chooseHeldScene), ready for the row\'s press')
  await assert.rejects(binding.write([{key: 'material.open', value: 99}]), /holds no such Scene/)
  const absent = techneClip.worldSubjectValues({kind: 'place', ref: 'place:chartres', title: 'Chartres'}, {state: 'absent', reason: UNSTOOD_WORDS})
  assert.equal(absent['source.admitted'], UNSTOOD_WORDS, 'the owner\'s words, said')
  assert.equal('material' in techneClip.worldSubjectValues(subject, undefined), false, 'unasked: nothing is claimed it gathers')
  assert.deepEqual(rows.worldSubjectOf({kind: 'location', ref: 'central:wiki:project:O-I', title: 'O-I', mode: 'techne'}), subject)
  assert.equal(rows.worldSubjectOf({kind: 'journey', ref: 'w', title: 'W'}), null, 'a walk is not the door\'s subject')
  assert.equal(rows.worldSubjectOf({kind: 'day', ref: 'Control/user/day/2026-10-08/day.md', title: 'Thu 08 Oct'}), null)
})

// ── G2: the instruments keep the subject ───────────────────────────────────────────────────────────────────────────────────

test('the Graph opens on the held subject through the atlas\'s own focus, and says plainly when it draws no node for it', () => {
  const list = [{id: 'occ-1', familyId: 'fam-a', subject_ref: 'central:wiki:project:O-I'}]
  const model = {occ: list, occIndex: new Map([['occ-1', 0]])}
  const navigated = []
  const atlas = {model, ctl: {state: {graph: true}, navigate: next => navigated.push(next)}}
  const encounter = ref => ({snapshot: () => ({mode: 'techne', accessEpoch: 1, presented: true, selection: {mode: 'techne', kind: 'location', ref, title: 'O-I'}})})
  const said = []
  const say = words => said.push(words)
  const following = createPaneSubject({followed: 'central:wiki:project:O-I'})
  assert.equal(focusGraphOnOpen({subject: following, encounter: encounter('central:wiki:project:O-I'), held: null, atlas, stateFor: stateForSubject}, say), 'focused')
  assert.deepEqual(navigated, [{view: {kind: 'manifest', occId: 'occ-1', context: {type: 'family', id: 'fam-a'}}, deep: false, graph: true}], 'the manifestation, in the graph')
  const elsewhere = createPaneSubject({followed: 'place:chartres'})
  const chartres = {snapshot: () => ({mode: 'techne', accessEpoch: 1, presented: true, selection: {mode: 'techne', kind: 'place', ref: 'place:chartres', title: 'Chartres'}})}
  assert.equal(focusGraphOnOpen({subject: elsewhere, encounter: chartres, held: null, atlas, stateFor: stateForSubject}, say), 'no-node')
  assert.deepEqual(said, [noNodeWords('Chartres')])
  assert.match(said[0], /^The Graph draws no node for Chartres: /, 'named in words, never by its ref')
  assert.equal(navigated.length, 1, 'and it is not turned')
  assert.equal(focusGraphOnOpen({subject: createPaneSubject({pinned: 'central:wiki:project:O-I'}), encounter: encounter('x'), held: null, atlas, stateFor: stateForSubject}, say), 'none', 'a pinned pane is the atlas\'s own rule')
  assert.equal(focusGraphOnOpen({subject: following, encounter: encounter('x'), held: 'The Earth atlas is already open in another pane of this session.', atlas, stateFor: stateForSubject}, say), 'none', 'a held pane turns nothing')
  assert.equal(focusGraphOnOpen({subject: elsewhere, encounter: chartres, held: null, atlas: {...atlas, ctl: {...atlas.ctl, state: {sky: {}}}}, stateFor: stateForSubject}, say), 'none', 'a sky the person went into is left, unsaid')
  assert.equal(focusGraphOnOpen({subject: createPaneSubject({}), encounter: encounter('x'), held: null, atlas, stateFor: stateForSubject}, say), 'none', 'nothing held, nothing turned')
  assert.equal(said.length, 1)
})

test('the Instruments preview says what the Graph does with the subject held; the lenses keep the stage\'s Scene', () => {
  const graph = {holds: 'It opens on {subject}, where the Graph draws it.'}
  assert.equal(heldSubjectWords(graph, {title: 'O-I'}), 'It opens on O-I, where the Graph draws it.')
  assert.equal(heldSubjectWords(graph, null), null)
  assert.equal(heldSubjectWords({}, {title: 'O-I'}), null)
  const entry = {kind: 'projection.constellation', label: 'Graph', mark: 'orbit', note: 'The same material laid out by connection, coloured by what each thing is', holds: graph.holds}
  assert.equal(html(createElement(InstrumentPreview, {entry, held: {title: 'O-I'}})),
    '<p class="browser-instruments-preview" role="status">The same material laid out by connection, coloured by what each thing is. It opens on O-I, where the Graph draws it. Double-click or drag it into a pane.</p>')
  assert.ok(Array.isArray(instrumentEntries()), 'the entries table stands')
})

// ── where it is wired ───────────────────────────────────────────────────────────────────────────────────────────────────────

test('source: the World dispatch, the one Graph focus call, no mode branch, and the grammar\'s states', async () => {
  const browser = await source('shell/ModeBrowser.tsx')
  assert.match(browser, /if \(isWorldGroup\(category\.id\)\) return <WorldGroupRows category=\{category\} id=\{category\.id\} mode=\{mode\} needle=\{needle\} \/>/)
  assert.match(browser, /continuity\?\.select\(\{mode, kind: row\.kind, ref: row\.subject\.ref, title: row\.subject\.title\}\)/, 'a row selects through the book\'s one writer')
  assert.match(browser, /void openHeldSubject\(row\.subject\)/, 'and opens through the door')
  assert.match(browser, /provider\.ensureSuiteStanding\(transport\)/, 'the suite is read once per session, the read the atlas shares')
  const host = await source('projections/atlas/registerAtlasHost.ts')
  assert.equal((host.match(/focusGraphOnOpen\(/g) ?? []).length, 1, 'one Graph focus call')
  assert.match(host, /if \(view === 'graph'\) focusGraphOnOpen\(\{subject: context\.subject, encounter: context\.encounter, held: attachment\.held, atlas: atlasHandle\(\), stateFor: stateForSubject\}\)/)
  const MODE = /[!=]==\s*'(?:live|base|central|factory|expressions|techne|audio)'|'(?:live|base|central|factory|expressions|techne|audio)'\s*[!=]==|\bis[A-Z]\w*Mode\(/
  for (const file of ['techne/subject/worldRows.ts', 'techne/subject/subjectOpenings.ts', 'techne/subject/graphFocus.ts', 'techne/clipBinding.ts',
    'techne/subject/openSubject.ts', 'shell/ModeBrowser.tsx', 'frame/InstrumentsSection.tsx', 'frame/instruments.ts']) {
    assert.doesNotMatch(await source(file), MODE, `${file} adds no mode branch`)
  }
  const states = Object.fromEntries(browserCategoriesOf('techne').filter(category => category.group === 'World').map(category => [category.id, category.state]))
  assert.deepEqual(states, {'techne-bodies': 'cut', 'techne-locations': 'cut', 'techne-places': 'cut', 'techne-palaces': 'cut', 'techne-journeys': 'waiting'},
    'Locations and Places compose from the suite reading; Bodies from the world body records (T-WORLDS §5 W3); Journeys draws when its owners carry it; Palaces are the atlas\'s (N4, b5a935661)')
})

test('World › Palaces lists the atlas\'s palaces and enters one on the Earth; with none, it says what the palace list says (N4)', async () => {
  const rows = await import('../src/techne/subject/worldRows.ts')
  const none = rows.palaceWorldGroup([], 'Reading the palaces of your world…')
  assert.deepEqual([none.state, none.word, none.words], ['waiting', 'reading', 'Reading the palaces of your world…'])
  const group = rows.palaceWorldGroup([{key: 'central', title: 'Central', standing: 'open', expression_ref: 'expression:techne-m0.central'}], null)
  assert.equal(group.state, 'rows')
  const [row] = group.rows
  assert.deepEqual([row.key, row.kind, row.mark, row.name, row.standing, row.opens, row.subject.ref], ['palace:central', 'palace', 'palace', 'Central', 'open', 'palace', 'expression:techne-m0.central'])
  assert.match(row.hover, /a palace on the Earth/)
})

test('a palace entered from outside the Earth opens the Earth, waits for its owners, and says so when they never bind', async () => {
  const world = await import('../src/projections/atlas/palaces/palacesWorld.ts')
  const session = await import('../src/projections/atlas/palaces/palaceSession.ts')
  session.bindPalaceOwners(null)
  let opened = 0
  const said = await world.enterFromOutside({key: 'central', title: 'Central'}, () => { opened++ }, 30)
  assert.equal(opened, 1, 'the Earth is asked to open through the one door')
  assert.match(said, /The Earth did not open within 0 s, so Central was not entered/, 'a wait that ends says why, never silence')
})
