import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'
import {readFileSync} from 'node:fs'

// O-I #749 follow-up, lane AX (manual §10.3, §10.9, §16.7). Lane AP's Collections and Places, with what they lacked:
//   - a collection is renamed and shown or hidden as Live's are: Rename (⌘R) in its menu renames it in place; Hide takes it out of the
//     column; Edit on the Collections heading lists all seven, each ticked where the column shows it. Central keeps both
//     (ctrl collections.rs: central.collections.rename and .show, Central dlw/749-collections-acts), whose real answers are the fixture;
//   - a collected thing opens from its row the way its place's row opens it: a world comes into today, a Day opens;
//   - a place's row drags as the browser's other rows do, onto the targets the manual names (§16.7): a world onto the empty track (it
//     joins today), an agent onto an empty track or the agent chain (it takes the seat), a Day into a pane (it opens there), a machine or a
//     workcell onto the rail (its tile opens there). The identity you share and a harness name no target, so they do not drag.
// Channels: REAL (Central's answers, captured by ctrl on a scratch ground), SCRIPTED (pure rows, payloads and handlers; the browser
// rendered on the server). Not a screen pass (#821).
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
const {Browser} = await import('../src/frame/browser/Browser.tsx')
const collections = await import('../src/frame/browser/collections.ts')
const {COLLECTIONS_SOURCE} = await import('../src/frame/browser/CollectionRows.tsx')
const places = await import('../src/frame/browser/places.ts')
const acts = await import('../src/frame/browser/placeActs.ts')
const {CENTRAL_WORLD_DRAG} = await import('../src/timeline/centralTrackAdapter.ts')
const {AGENT_CHAIN_MIME, decodeChainDrag} = await import('../src/agent/agentChainDrag.ts')
const documents = await import('../src/central/documents/centralDocuments.ts')

const json = path => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'))
const CENTRAL = json('./fixtures/ax-749/collections-acts-2026-10-30.json')
const source = path => readFileSync(new URL(path, import.meta.url), 'utf8')

test('Central\'s reading names each collection as you named it and says whether you chose to show it', () => {
  const after = collections.collectionsReadingOf(CENTRAL.read_after.data)
  assert.deepEqual(after.collections.map(c => [c.id, c.name, c.shown]), [['favourites', 'Favourites', false], ['orange', 'Orange', null],
    ['yellow', 'Yellow', null], ['green', 'Machines I use', null], ['blue', 'Blue', true], ['purple', 'Purple', null], ['grey', 'Grey', null]])
  // The column: what you chose, else Favourites and each collection that holds something.
  assert.deepEqual(collections.shownCollections(after).map(c => c.id), ['green', 'blue'], 'Favourites hidden; Blue shown though empty')
  const before = collections.collectionsReadingOf(CENTRAL.add_green.data.reading)
  assert.deepEqual(collections.shownCollections(before).map(c => c.id), ['favourites', 'green'])
  // A reading from before Central kept choices (lane AP's) is read as unchosen.
  const ap = json('./fixtures/ap-749/collections-2026-10-30.json')
  assert.ok(collections.collectionsReadingOf(ap.add_blue.data.reading).collections.every(c => c.shown === null))
})

test('Rename and Show reach Central as its own actions and answer with the reading after; a refusal is thrown in its words', async () => {
  const asked = []
  const answering = data => async op => { asked.push(op); return {outcome: {result: 'action_dispatched', dispatch: {state: 'invoked', owner_operation: op.invocation.action, data}}} }
  const renamed = await collections.renameCollection(answering(CENTRAL.rename_green.data), 'green', 'Machines I use')
  assert.equal(renamed.collections[3].name, 'Machines I use')
  const hidden = await collections.showCollection(answering(CENTRAL.hide_favourites.data), 'favourites', false)
  assert.equal(hidden.collections[0].shown, false)
  assert.deepEqual(asked.map(op => [op.invocation.action, op.invocation.input]), [
    ['central.collections.rename', {world: 'control:root', collection: 'green', name: 'Machines I use'}],
    ['central.collections.show', {world: 'control:root', collection: 'favourites', shown: false}],
  ])
  const refusing = async () => ({outcome: {result: 'action_dispatched', dispatch: {state: 'owner_refused', message: CENTRAL.refused_rename.error.message}}})
  await assert.rejects(collections.renameCollection(refusing, 'green', 'two\nlines'), /one line of at most 64 characters/)
})

test('each collection in the column carries Rename and Hide; the Collections heading carries Edit, listing all seven', async () => {
  const reading = collections.collectionsReadingOf(CENTRAL.read_after.data)
  collections.collectionsHeld.hold({status: 'read', reading})
  const asked = []
  collections.collectionsReach(async op => { asked.push(op.invocation); return {outcome: {result: 'action_dispatched', dispatch: {state: 'invoked',
    owner_operation: op.invocation.action, data: op.invocation.action === 'central.collections.rename' ? CENTRAL.rename_green.data : CENTRAL.show_blue.data}}} })
  const [green] = COLLECTIONS_SOURCE.categories
  assert.equal(green.label, 'Machines I use')
  assert.ok(green.acts?.rename && green.acts?.hide, 'its menu holds Rename and Hide')
  await green.acts.rename('Machines I use')
  await green.acts.hide()
  assert.deepEqual(asked.map(a => [a.action, a.input.collection, a.input.name ?? a.input.shown]), [
    ['central.collections.rename', 'green', 'Machines I use'], ['central.collections.show', 'green', false]])
  // Edit: the seven, each ticked where the column shows it; a tick keeps the choice.
  collections.collectionsHeld.hold({status: 'read', reading})
  assert.equal(COLLECTIONS_SOURCE.edit.kind, 'collection')
  const entries = COLLECTIONS_SOURCE.edit.entries()
  assert.deepEqual(entries.map(e => [e.id, e.label, e.shown]), [['favourites', 'Favourites', false], ['orange', 'Orange', false], ['yellow', 'Yellow', false],
    ['green', 'Machines I use', true], ['blue', 'Blue', true], ['purple', 'Purple', false], ['grey', 'Grey', false]])
  asked.length = 0
  await entries[0].show(true)
  assert.deepEqual(asked.map(a => [a.action, a.input]), [['central.collections.show', {world: 'control:root', collection: 'favourites', shown: true}]])
  collections.collectionsReach(null)
  await assert.rejects(green.acts.hide(), /cannot reach/, 'with no way to Central, it says so')
  collections.collectionsHeld.hold({status: 'unread'})
})

test('the browser draws Edit on a group\'s heading, even when every category of it is hidden', () => {
  const Body = () => null
  const sources = [{id: 'c', categories: [], Body, edit: {kind: 'collection', entries: () => []}}, {id: 'p', categories: [{id: 'you', label: 'You', kind: 'place'}], Body}]
  const markup = renderToStaticMarkup(React.createElement(Browser, {sources}))
  assert.match(markup, /data-browser-kind="collection"[^>]*><h3[^>]*>Collections<\/h3><button[^>]*data-browser-edit="collection"[^>]*>Edit<\/button>/)
  const named = renderToStaticMarkup(React.createElement(Browser, {sources: [{id: 'c', categories: [{id: 'green', label: 'Green', kind: 'collection', acts: {rename: async () => {}, hide: async () => {}}}], Body}]}))
  assert.match(named, /aria-keyshortcuts="Meta\+R ContextMenu Shift\+F10"/, 'a category with acts names its keys')
})

test('a collected thing opens as its place\'s row opens it: read again from its owner, then the same act', async () => {
  const root = {root: '/w/Central', control: {agent_wiki: {wiki: {space_ref: 'central:wiki:root'}}}, work: {projects: [
    {name: 'Album', path: '/w/Central/Work/Album', projectcentral: {user: {exists: true, path: 'Work/Album/ProjectCentral/user'}, agent_wiki: {wiki: {space_ref: 'central:wiki:project:Album'}}}}]}}
  const day = date => ({name: `${date}.md`, kind: 'file', retrieval_allowed: true, location: {path: `Control/user/day/${date}/day.md`}})
  const reads = {root: async () => root, days: async () => [day('2026-10-30')]}
  assert.equal((await acts.placeRowOf({ref: 'control:root', kind: 'world'}, reads)).seat.ref, 'central:wiki:root')
  assert.equal((await acts.placeRowOf({ref: 'project:Album', kind: 'project'}, reads)).seat.ref, 'central:wiki:project:Album')
  assert.equal((await acts.placeRowOf({ref: 'central:day:control:root:2026-10-30', kind: 'day'}, reads)).day.name, '2026-10-30.md')
  assert.equal(await acts.placeRowOf({ref: 'agent/scout', kind: 'agent'}, reads), null, 'an agent opens nowhere from its row')
  await assert.rejects(acts.placeRowOf({ref: 'project:Gone', kind: 'project'}, reads), /Gone is no longer among your Work/)
  // The act: a world seats, a Day opens — the rows' own.
  const seated = [], opened = []
  const ports = {seat: async world => { seated.push(world); return {ok: true, note: `${world.name} is in today's set.`} }, openDay: async (entry, path) => { opened.push(path) }}
  assert.deepEqual(await acts.openPlaceRow(await acts.placeRowOf({ref: 'project:Album', kind: 'project'}, reads), ports), {ok: true, words: 'Album is in today\'s set.'})
  assert.equal(await acts.openPlaceRow(await acts.placeRowOf({ref: 'central:day:control:root:2026-10-30', kind: 'day'}, reads), ports), null)
  assert.deepEqual([seated.map(w => w.ref), opened], [['central:wiki:project:Album'], ['Control/user/day/2026-10-30/day.md']])
  // The collection's rows open this way: double-click and Enter.
  const rows = source('../src/frame/browser/CollectionRows.tsx')
  assert.match(rows, /onDoubleClick=\{\(\) => open\(item\)\}/)
  assert.match(rows, /event\.key === 'Enter'[^\n]*open\(item\)/)
})

test('a place\'s row drags what the manual\'s target for it takes; the identity and a harness drag nothing', () => {
  const root = {root: '/w/Central', control: {agent_wiki: {wiki: {space_ref: 'central:wiki:root'}}}, work: {projects: []}}
  const world = acts.placeRowDrag(places.yourWorldRow(root))
  assert.deepEqual(world, {type: CENTRAL_WORLD_DRAG, data: 'central:wiki:root', words: 'My World'}, 'a world onto the empty track')
  const [agent] = places.agentRows([{ref: 'agent/scout', profileRef: 'p', name: 'Scout', accepted: true, skillRefs: [], governanceRefs: []}])
  const dragged = acts.placeRowDrag(agent)
  assert.equal(dragged.type, AGENT_CHAIN_MIME)
  assert.deepEqual(decodeChainDrag(dragged.data), {kind: 'chain-item', drag: {family: 'agent', ref: 'agent/scout', label: 'Scout'}}, 'an agent onto an empty track')
  const [day] = places.dayRows([{name: '2026-10-30.md', kind: 'file', location: {path: 'Control/user/day/2026-10-30/day.md'}}])
  assert.deepEqual(acts.placeRowDrag(day), {type: documents.CENTRAL_DOCUMENT_DRAG, data: 'central:day:control:root:2026-10-30', words: day.label}, 'a Day into a pane')
  const [machine] = places.thisMachineRows({workcell_ref: 'workcell:mac'})
  assert.deepEqual(JSON.parse(acts.placeRowDrag(machine).data), {kind: 'workcell', ref: 'workcell:mac', label: 'This machine'})
  assert.equal(acts.placeRowDrag(machine).type, acts.RUNNING_DRAG, 'a running thing onto the rail')
  assert.equal(acts.placeRowDrag(places.identityRows({profiles: [{name: 'Frank', source_ref: 'Control/user/identity/nara.json'}]})[0]), null)
  assert.equal(acts.placeRowDrag(places.harnessRows({profiles: [{disclosure: {slug: 'codex'}}]})[0]), null)
  assert.equal(acts.placeRowDrag(places.workRows({work: {projects: [{name: 'Loose', path: '/w/Loose', projectcentral: {}}]}})[0]), null, 'a folder that is no world')
  const rows = source('../src/frame/browser/PlaceRows.tsx')
  assert.match(rows, /draggable=\{drag !== null\}/)
  assert.match(rows, /onDragStart=\{drag \? event => startPlaceDrag\(event, drag, row\)/)
})

test('a Day dropped into a pane opens there: the drop carries its subject, which names the Day and nothing else', () => {
  assert.deepEqual(documents.documentTargetOf('central:day:control:root:2026-10-30'), {form: 'day', date: '2026-10-30'})
  assert.equal(documents.documentTargetOf('document:today'), null, 'a drop names one Day, not whichever is today')
  assert.equal(documents.documentTargetOf('central:day:control:root:yesterday'), null)
  assert.equal(documents.documentTargetOf('central:path:root:Control/user/notes.md'), null)
  const workbench = source('../../../../desktop/cradle/src/surface/Workbench.tsx')
  assert.match(workbench, /const material = props\.paneGrammar\?\.material && e\.dataTransfer\.types\.includes\(props\.paneGrammar\.material\.type\)/)
  assert.match(workbench, /props\.paneGrammar!\.material!\.open\(dropped, group\.id, edge\)/)
  const native = source('../src/native/Workbench.tsx')
  assert.match(native, /material: \{type: CENTRAL_DOCUMENT_DRAG, open: \(ref, groupId, edge\) =>/)
})

test('a machine or a workcell dropped on the rail opens the Workcells tile there; a chat still takes its own drop', () => {
  const open = [], said = []
  const book = {rail: {open: ['agent']}, toggle: id => open.push(id)}
  const handlers = acts.runningRailHandlers({book, said: words => said.push(words)})
  const event = (types, data = {}) => ({dataTransfer: {types, getData: type => data[type] ?? '', dropEffect: 'none'}, preventDefault() { this.prevented = true }})
  const over = event([acts.RUNNING_DRAG])
  handlers.onDragOver(over)
  assert.equal(over.prevented, true); assert.equal(over.dataTransfer.dropEffect, 'copy')
  const chat = event([AGENT_CHAIN_MIME])
  handlers.onDragOver(chat)
  assert.equal(chat.prevented, undefined, 'not a running thing: left to the chat\'s own drop')
  handlers.onDrop(event([acts.RUNNING_DRAG], {[acts.RUNNING_DRAG]: JSON.stringify({kind: 'machine', ref: 'machine:omarchy', label: 'omarchy'})}))
  assert.deepEqual(open, ['workcells'])
  assert.match(said[0], /omarchy is at hand: the Workcells tile stands on the rail/)
  handlers.onDrop(event([acts.RUNNING_DRAG], {[acts.RUNNING_DRAG]: '{"kind":"agent"}'}))
  assert.deepEqual(open, ['workcells'], 'what is no running thing opens nothing')
  const app = source('../src/App.tsx')
  assert.match(app, /useRunningRailDrop\(widgetBook, chatRailDrop\)/)
})
