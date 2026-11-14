import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'
import {readFileSync} from 'node:fs'

// O-I #749 (manual §10.3): "Down the browser's left side stand Live's three groups: Collections, the coloured favourites you make; the
// four kinds above, as Live's categories; and Places, where your ground lies" — You (My World, your Days, the identity you share),
// Agents (the roster, accepted and proposed, with the harnesses and skills they carry), Machines (your machines and the workcells each
// holds), Work (your projects, each a world with its pages; Add folder…). The Places read their real owners (Central's world
// disclosure and day surface, the Nara chain's identities, Central's agent profiles, the census of the agents on this computer with
// AIKit's harness disclosure as detail, Workcell's status and machine list); Central keeps the Collections (ctrl collections.rs: central.collections.read, .add, .remove), whose real answers are the
// fixture. Channels: SCRIPTED (pure rows from real owner answers; the browser rendered on the server). Not a screen pass (#821).
const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};
import {readFile} from 'node:fs/promises';
export async function resolve(specifier,context,next){
  try{return await next(specifier,context)}catch(error){
    if(!specifier.startsWith('.'))throw error;
    if(specifier.endsWith('.js')){try{return await next(specifier.slice(0,-3)+'.ts',context)}catch{}}
    for(const suffix of ['.ts','.tsx','/index.ts','/index.tsx']){try{return await next(specifier+suffix,context)}catch{}}
    throw error;
  }
}
export async function load(url,context,next){
  if(url.endsWith('.css'))return {format:'module',shortCircuit:true,source:'export default null'};
  if(url.endsWith('.json'))return {format:'module',shortCircuit:true,source:'export default '+await readFile(new URL(url).pathname,'utf8')};
  if(['.html','.svg','.png','.md'].some(ext=>url.split('?')[0].endsWith(ext))||url.endsWith('?raw'))return {format:'module',shortCircuit:true,source:'export default ""'};
  if(url.endsWith('.ts')||url.endsWith('.tsx')){
    const source=await readFile(new URL(url).pathname,'utf8');
    const {outputText}=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX},fileName:url});
    return {format:'module',shortCircuit:true,source:outputText};
  }
  return next(url,context);
}`)}`, {parentURL: import.meta.url})

const noop = () => {}
globalThis.document = {getElementById: () => null, createElement: () => ({style: {}, setAttribute: noop, appendChild: noop}), head: {appendChild: noop}, addEventListener: noop, removeEventListener: noop, querySelector: () => null, documentElement: {style: {}}}
globalThis.window ??= globalThis; globalThis.addEventListener ??= noop; globalThis.removeEventListener ??= noop
globalThis.localStorage = {getItem: () => null, setItem: () => {}}
const React = await import('react')
const {renderToStaticMarkup} = await import('react-dom/server')
const {BROWSER_KINDS} = await import('../src/frame/browser/browserKinds.ts')
const {Browser} = await import('../src/frame/browser/Browser.tsx')
const {browserSourcesOf} = await import('../src/shell/modeBrowsers.tsx')
const {SURF_MODES} = await import('../src/shell/modeGrammar.ts')
const places = await import('../src/frame/browser/places.ts')
const collections = await import('../src/frame/browser/collections.ts')
const {COLLECTIONS_SOURCE, CollectStrip} = await import('../src/frame/browser/CollectionRows.tsx')
const {Workspace} = await import('../src/shell/workspaceContext.tsx')

const json = path => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'))
const CENTRAL = json('./fixtures/ap-749/collections-2026-10-30.json')
const HARNESSES = json('../../../../desktop/cradle/kernel/tests/fixtures/owner-routes/aikit-harness-disclose-2026-10-29.json').disclose.data
const MACHINES = json('../../../../desktop/cradle/kernel/tests/fixtures/owner-routes/workcell-machine-list-2026-10-21.json').list

test('down the left side: Collections first, the four kinds, then Places', () => {
  assert.deepEqual(BROWSER_KINDS.map(k => k.kind), ['collection', 'material', 'instruments', 'devices', 'running', 'place'])
  assert.deepEqual(BROWSER_KINDS.map(k => k.label), ['Collections', 'Material', 'Instruments', 'Devices', 'Running', 'Places'])
  const Body = () => null
  const sources = [{id: 'p', categories: [{id: 'you', label: 'You', kind: 'place'}], Body},
    {id: 'm', categories: [{id: 'one', label: 'One', kind: 'material'}], Body},
    {id: 'c', categories: [{id: 'favourites', label: 'Favourites', kind: 'collection'}], Body}]
  const markup = renderToStaticMarkup(React.createElement(Browser, {sources}))
  assert.match(markup, /data-browser-kind="collection".*data-browser-kind="material".*data-browser-kind="place"/s, 'Collections lead, Places close the column')
})

// REPLACED (O-I #844): the four places — the manual's Places table now ends on Packs ("What you installed together: racks with their
// agents on their chains, songs, and the practice they carry"), which no owner lists yet (tests/factory-songs-844.test.mjs).
test('every mode stands on your Collections and on the five Places, each reading its owner', () => {
  for (const mode of SURF_MODES) {
    const categories = browserSourcesOf(mode).flatMap(source => source.categories.map(category => ({...category, source: source.id})))
    assert.deepEqual(categories.filter(c => c.kind === 'place').map(c => [c.source, c.id, c.label]),
      [['places', 'you', 'You'], ['places', 'agents', 'Agents'], ['places', 'machines', 'Machines'], ['places', 'work', 'Work'], ['places', 'packs', 'Packs']],
      `${mode}: the five places`)
    assert.ok(categories.some(c => c.kind === 'collection' && c.id === 'favourites' && c.source === 'collections'), `${mode}: Favourites`)
  }
  assert.match(places.PLACES.find(place => place.id === 'work').hint, /Add folder…/)
})

test('You: My World from Central\'s root, your Days newest first, the identity you share', () => {
  const root = {schema: 'central.world-map/v1', root: '/w/Central', ground_state: 'ready',
    control: {agent_wiki: {wiki: {space_ref: 'central:wiki:root'}}}, work: {path: '/w/Central/Work', exists: true, projects: [{name: 'Album'}]}}
  const world = places.yourWorldRow(root)
  assert.equal(world.ref, 'control:root'); assert.equal(world.label, 'My World'); assert.deepEqual(world.seat, {ref: 'central:wiki:root', name: 'Your world'})
  assert.match(world.words, /\/w\/Central; 1 project in its Work/)
  const day = date => ({name: `${date}.md`, kind: 'file', location: {path: `Control/user/day/${date}/day.md`}})
  const days = places.dayRows([day('2026-10-28'), day('2026-10-30'), {name: 'notes.md', kind: 'file'}])
  assert.deepEqual(days.map(row => [row.meta, row.ref, row.group]), [['2026-10-30', 'central:day:control:root:2026-10-30', 'Days'], ['2026-10-28', 'central:day:control:root:2026-10-28', 'Days']])
  assert.ok(days[0].day, 'a Day row opens its Day')
  const identities = places.identityRows({schema: 'oi.nara-identity/v1', profiles: [{name: 'Frank', person_ref: 'person:f', source_ref: 'Control/user/identity/nara.json', revision: 'r1'}, {name: ''}]})
  assert.deepEqual(identities.map(row => [row.label, row.ref, row.kind]), [['Frank', 'Control/user/identity/nara.json', 'identity']])
})

// O-I ticket 1003 (one census): the agents on this computer are the census, the World Model's agents slice (kernel census.rs), and AIKit
// adds detail to a row, never a row. AIKit's real disclosure (HARNESSES) declares profiles for claude-code and codex, installed or not;
// the census, as the kernel answers the slice, lists claude-code, an agent AIKit has no profile for (prime) and one that does not start
// (gemini) — and not codex, which nothing detects here.
const CENSUS_SLICE = {schema: 'oi.world-model-slice/v1', slice: 'agents', owner: 'kernel', scopes: ['machine'], version: 2, state: 'read', error: null, read_at_unix_ms: 1,
  value: {agents: [
    {slug: 'claude-code', harness_ref: 'harness/claude-code', executable: '/x/claude', starts: true, talks: true, version: '2.1.323 (Claude Code)', aikit: {client: 'claude', harness: 'claude-code'}},
    {slug: 'prime', harness_ref: 'harness/prime', executable: '/x/prime', starts: true, talks: false, version: '0.10.0', why: 'AIKit names no client for prime, so it opens no conversation with it', aikit: null},
    {slug: 'gemini', harness_ref: 'harness/gemini', executable: '/x/gemini', starts: false, talks: false, why: '/x/gemini --version exited exit status: 1: its node runtime could not load a library.', aikit: null}]}}

test('Agents: the roster accepted then proposed, with the skills each carries; then the agents on this computer, which are the census', async () => {
  const agents = places.agentRows([
    {ref: 'agent:expressed-1', profileRef: 'p2', name: 'Scout', accepted: false, skillRefs: [], governanceRefs: []},
    {ref: 'agent/central-guardian', profileRef: 'p1', name: 'Central guardian', purpose: 'Keeps the ground', role: 'central-guardian', accepted: true, skillRefs: ['s1', 's2'], governanceRefs: []},
  ])
  assert.deepEqual(agents.map(row => [row.label, row.meta]), [['Central guardian', 'accepted'], ['Scout', 'proposed']])
  assert.match(agents[0].words, /Keeps the ground; its role central-guardian; it carries 2 skills/)
  assert.match(agents[1].words, /proposed to your roster, not yet accepted/)
  const {censusOf} = await import('../../../../desktop/cradle/src/agency/census.ts')
  const census = censusOf({state: 'held', answer: CENSUS_SLICE})
  const harnesses = places.harnessRows(census.agents, HARNESSES)
  assert.deepEqual(harnesses.map(row => [row.label, row.ref, row.meta, row.group]), [
    ['Claude Code', 'harness:claude-code', 'you can talk to it', 'Harnesses'],
    ['Prime', 'harness:prime', 'you cannot talk to it', 'Harnesses'],
    ['Gemini CLI', 'harness:gemini', 'does not start', 'Harnesses'],
  ], 'the census\'s agents in its order: codex, a profile AIKit declares, is no agent here, and prime, which AIKit has no profile for, is one')
  assert.equal(harnesses[0].words, 'Claude Code — an agent on this computer. It starts, at version 2.1.323 (Claude Code), and you can talk to it. AIKit reads its skills, guidance, hooks, tools, models, sessions, settings.',
    'what AIKit reads of it is detail on the census\'s row')
  assert.equal(harnesses[1].words, 'Prime — an agent on this computer. It starts, at version 0.10.0, but you cannot talk to it: AIKit names no client for prime, so it opens no conversation with it.')
  assert.equal(harnesses[2].words, 'Gemini CLI — an agent on this computer. It does not start: /x/gemini --version exited exit status: 1: its node runtime could not load a library.')
  assert.deepEqual(places.harnessRows(census.agents, {context: {}, data: HARNESSES}).map(row => row.words), harnesses.map(row => row.words), 'the disclosure\'s envelope read through')
  assert.equal(places.harnessRows(census.agents)[0].words, 'Claude Code — an agent on this computer. It starts, at version 2.1.323 (Claude Code), and you can talk to it.', 'without AIKit\'s disclosure the rows stand, without its detail')
  assert.deepEqual(places.harnessRows([], HARNESSES), [], 'a census of no agent lists none, whatever profiles AIKit declares (a fresh world)')
  assert.match(places.harnessRows([{slug: 'pi', harnessRef: 'harness/pi', executable: null, starts: false, talks: false, aikit: null}])[0].words, /It does not start, and the census does not say why\.$/)
  assert.match(places.PLACES.find(place => place.id === 'agents').info, /then the agents on this computer, each saying whether it starts and whether you can talk to it, or why not/)
  // The place reads the census through the World Model's door (model_subscribe), and AIKit's disclosure only as detail on its rows.
  const source = readFileSync(new URL('../src/frame/browser/PlaceRows.tsx', import.meta.url), 'utf8')
  assert.match(source, /const census = censusOf\(useModelSlice\(transport, 'agents'\)\)/)
  assert.match(source, /harnessRows\(census\.agents, disclosure\.status === 'answered' \? disclosure\.value : null\)/)
  assert.doesNotMatch(source, /partOf\([^\n]*harnessRows/, 'no list of agents built from AIKit\'s disclosure')
})

test('Machines: this machine and its workcell from Workcell\'s status, then the machines Workcell declares', () => {
  const status = {ok: true, workcell_ref: 'workcell:mac', workcell_ref_source: 'declared', health: 'healthy', providers: 5, connections: [{}, {}]}
  assert.deepEqual(places.thisMachineRows(status).map(row => [row.label, row.ref, row.kind]), [['This machine', 'workcell:mac', 'workcell']])
  assert.match(places.thisMachineRows(status)[0].words, /holds the workcell workcell:mac: it stands healthy; 5 providers; 2 connections/)
  assert.deepEqual(places.thisMachineRows({ok: true}), [], 'no workcell named: no row invented')
  const declared = places.declaredMachineRows(MACHINES)
  assert.deepEqual(declared.map(row => [row.label, row.meta]), [['omarchy', '100.92.62.101:7777'], ['omarchy-improvement-lanes', '100.92.62.101:7777']], 'Workcell\'s real list')
  assert.match(declared[0].words, /may be asked to status, discover, observe, inspect/)
  assert.match(declared[1].words, /may be asked nothing yet/)
})

test('Work: your projects, a world with its pages where it keeps a ProjectCentral, a folder where it does not; search finds by words', () => {
  const root = {root: '/w/Central', control: {}, work: {projects: [
    {name: 'Album', path: '/w/Central/Work/Album', world_name: 'The Album', projectcentral: {user: {exists: true, path: 'Work/Album/ProjectCentral/user'}, agent_wiki: {wiki: {space_ref: 'central:wiki:project:Album'}}}},
    {name: 'Loose', path: '/w/Central/Work/Loose', projectcentral: {state: 'absent'}},
  ]}}
  const rows = places.workRows(root)
  assert.deepEqual(rows.map(row => [row.label, row.ref, row.meta, row.seat?.ref ?? null]),
    [['The Album', 'project:Album', 'world', 'central:wiki:project:Album'], ['Loose', 'project:Loose', 'folder', null]])
  assert.deepEqual(places.matching(rows, 'loo').map(row => row.label), ['Loose'])
  assert.equal(places.matching(rows, ' ').length, 2)
})

test('Collections: Central\'s real reading; Favourites always, each other colour once it holds something', () => {
  const empty = collections.collectionsReadingOf(CENTRAL.read_empty.data)
  assert.equal(empty.kept, false)
  assert.deepEqual(empty.collections.map(c => [c.id, c.colour]), [['favourites', 'red'], ['orange', 'orange'], ['yellow', 'yellow'], ['green', 'green'], ['blue', 'blue'], ['purple', 'purple'], ['grey', 'grey']])
  assert.deepEqual(collections.shownCollections(empty).map(c => c.id), ['favourites'])
  assert.deepEqual(collections.shownCollections(null).map(c => c.id), ['favourites'], 'before Central answers, Favourites stands')
  const after = collections.collectionsReadingOf(CENTRAL.add_blue.data.reading)
  assert.deepEqual(collections.shownCollections(after).map(c => c.id), ['favourites', 'blue'])
  assert.deepEqual([...collections.collectionsHolding(after, 'project:Album')], ['blue'])
  assert.equal(collections.collectionsReadingOf({schema: 'other'}), null)
  // The column follows the held reading: the source's categories move with it, each counted.
  collections.collectionsHeld.hold({status: 'read', reading: after})
  assert.deepEqual(COLLECTIONS_SOURCE.categories.map(c => [c.id, c.kind, c.count]), [['favourites', 'collection', 1], ['blue', 'collection', 1]])
  const version = COLLECTIONS_SOURCE.moves.version()
  collections.collectionsHeld.hold({status: 'read', reading: collections.collectionsReadingOf(CENTRAL.remove_favourite.data.reading)})
  assert.ok(COLLECTIONS_SOURCE.moves.version() > version, 'a move is said')
  assert.deepEqual(COLLECTIONS_SOURCE.categories.map(c => [c.id, c.count]), [['favourites', 0], ['blue', 1]])
  collections.collectionsHeld.hold({status: 'unread'})
})

test('the acts reach Central as its own actions and answer with the reading after; a refusal is thrown in Central\'s words', async () => {
  const asked = []
  const answering = data => async op => { asked.push(op); return {outcome: {result: 'action_dispatched', dispatch: {state: 'invoked', owner_operation: op.invocation.action, data}}} }
  const read = await collections.readCollections(answering(CENTRAL.read_empty.data))
  assert.equal(read.world, 'control:root')
  await collections.addToCollection(answering(CENTRAL.add_blue.data), 'blue', {ref: 'project:Album', label: 'Album', kind: 'project'})
  await collections.removeFromCollection(answering(CENTRAL.remove_favourite.data), 'favourites', 'agent/central-guardian')
  assert.deepEqual(asked.map(op => [op.op, op.invocation.action, op.invocation.input]), [
    ['invoke_action', 'central.collections.read', {world: 'control:root'}],
    ['invoke_action', 'central.collections.add', {world: 'control:root', collection: 'blue', item: {ref: 'project:Album', label: 'Album', kind: 'project'}}],
    ['invoke_action', 'central.collections.remove', {world: 'control:root', collection: 'favourites', ref: 'agent/central-guardian'}],
  ])
  const refusing = async () => ({outcome: {result: 'action_dispatched', dispatch: {state: 'owner_refused', message: CENTRAL.refused_no_collection.error.message}}})
  await assert.rejects(collections.addToCollection(refusing, 'crimson', {ref: 'x', label: 'x'}), /"crimson" is no collection/)
})

test('a row\'s preview carries Live\'s seven colours, each pressed where its collection holds the row', () => {
  const transport = {kind: 'bridge', url: 'http://127.0.0.1:1'}
  const draw = () => renderToStaticMarkup(React.createElement(Workspace.Provider, {value: {transport}},
    React.createElement(CollectStrip, {item: {ref: 'project:Album', label: 'Album', kind: 'project'}})))
  assert.match(draw(), /Reading your collections…/, 'before Central answers, it says so')
  collections.collectionsHeld.hold({status: 'read', reading: collections.collectionsReadingOf(CENTRAL.add_blue.data.reading)})
  const markup = draw()
  assert.equal((markup.match(/class="collect-strip-colour"/g) ?? []).length, 7)
  assert.match(markup, /aria-pressed="true"[^>]*data-collection="blue"[^>]*aria-label="Album is in Blue: press to take it out\."/)
  assert.match(markup, /aria-pressed="false"[^>]*data-collection="favourites"[^>]*aria-label="Put Album in Favourites\."/)
  collections.collectionsHeld.hold({status: 'refused', error: 'Error: Unknown Action: central.collections.read'})
  assert.match(draw(), /role="alert">Your collections are not read, so nothing can be put in one\./, 'a refusal in plain words')
  assert.doesNotMatch(draw(), /Error:/)
  collections.collectionsHeld.hold({status: 'unread'})
})

test('the swatches paint with the shell\'s tokens', () => {
  const css = readFileSync(new URL('../src/frame/browser/browser.css', import.meta.url), 'utf8')
  for (const colour of ['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'grey']) assert.match(css, new RegExp(`\\[data-collection-colour="${colour}"\\]\\s*\\{\\s*background:\\s*var\\(--`), colour)
})
