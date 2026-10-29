// The detached construction panel's acts, each at its home in the candidate (O-I #742; manual §17.4 Canvas, §10.3 the browser, §10.9
// acts and menus, §3 "it links to each of them"):
// - the browser's menu on a constellation: New constellation in a space, Rename, Edit question, its time and place, Show in graph;
// - the browser's menu on a member: Open at its passage, its time and place in this constellation, Remove from constellation;
// - the browser's menu on a connection: its meaning, direction and standing, Retract; on a returned Expression: Open;
// - the Canvas's Promote: the line sent to the relation's owner (the constellation's relate act over the line's two occurrences);
// - an Expressions clip's menu: Return to constellation;
// - the reader opened at a member's passage, or on a time-and-place editor (the knowledge open's anchor and facts).
// The owners here are stand-ins answering in the shapes the real ones give (constellationActs.ts over `aikit.constellation.apply`; the
// relate act's receipt, sceneConstellationRelation.ts); the walk drives the real ones (scratchpad b742u/drive/acts.mjs).
import test from 'node:test'
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
  if (u.includes('?raw') || u.includes('.html') || u.endsWith('.svg') || u.endsWith('.png') || u.endsWith('.md')) return {format: 'module', shortCircuit: true, source: 'export default ""'};
  if (u.endsWith('.json')) return {format: 'module', shortCircuit: true, source: 'export default ' + await readFile(new URL(u), 'utf8')};
  if (!u.endsWith('.ts') && !u.endsWith('.tsx')) return n(u, c);
  return {format: 'module', shortCircuit: true, source: ts.transpileModule(await readFile(new URL(u), 'utf8'), {fileName: new URL(u).pathname,
    compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX}}).outputText};
}`)}`, import.meta.url)

const noop = () => {}
globalThis.document ??= {getElementById: () => null, createElement: () => ({style: {}, setAttribute: noop, appendChild: noop}), head: {appendChild: noop},
  addEventListener: noop, removeEventListener: noop, querySelector: () => null, documentElement: {style: {}}}
globalThis.window ??= globalThis; globalThis.addEventListener ??= noop; globalThis.removeEventListener ??= noop
globalThis.localStorage ??= {getItem: () => null, setItem: noop}

const frameB = await import('../src/techne/devices/frameBindings.ts')
const rows = await import('../src/frame/browser/constellationActs.ts')
const {withMadeOf, NOT_AN_EXPRESSION} = await import('../src/frame/detail/clipSource.ts')
const {clipBinding, resetViewHolds} = await import('../src/frame/detail/clipBinding.ts')
const {MADE_OF} = await import('../src/inhabitants/catalogue/clips/design.ts')
const menus = await import('../src/frame/menu/objectActions.ts')
const open = await import('../src/native/knowledgeOpen.ts')
const focus = await import('../src/frame/browser/constellationFocus.ts')
const inFocus = await import('../../../../desktop/cradle/src/knowledge/constellationInFocus.ts')

// ---------------------------------------------------------------------------------------------------------------- the Canvas's Promote

/** The frame as it announces itself on the Canvas: the Scene it presents and its board, one line selected between two occurrences. */
const SCENE = {expression_ref: 'expression:techne-m0.scratch', revision: 7, scene_ref: 'expression:techne-m0.scratch:scene:c1'}
const BOARD = {items: [{id: 'entity:a', kind: 'card', x: 0, y: 0, w: 10, h: 10, name: 'A passage'}, {id: 'entity:b', kind: 'card', x: 40, y: 0, w: 10, h: 10, name: 'Another'}],
  lines: [{id: 'line:1', from: 'entity:a', to: 'entity:b'}], frames: [], selected: [], selectedLine: 'line:1', drawing: false, erasing: false, lasso: false, snap: false}
const canvasFrame = (scene = SCENE) => ({state: {lens: 'canvas', ...(scene ? {nativeScene: scene} : {}), research: {canvas: BOARD}, chrome: {controls: []}}, run: async () => ({ok: true}), window: undefined})

test('Promote sends the selected line to the relation\'s owner: the two occurrences it joins in the Scene, the relation type held for the next line', async () => {
  frameB.resetPromotion()
  const asked = []
  const promoter = {relate: async input => { asked.push(input); return {relation_ref: 'wiki:relation:new', frame_revision: 4} }}
  const binding = frameB.canvasBinding(canvasFrame(), {relation: 'cause'}, promoter)
  assert.equal(binding.standing.promote, undefined, 'Promote stands ready: the owner is reached')
  assert.equal(binding.values.promote, 'ready')
  assert.equal(binding.writes('promote'), true)
  await binding.write([{key: 'promote', value: true}])
  assert.deepEqual(asked, [{operation: 'relate', ...SCENE, from_entity_ref: 'entity:a', to_entity_ref: 'entity:b', relation: 'cause', direction: 'directed'}])
  const after = frameB.canvasBinding(canvasFrame(), {relation: 'cause'}, promoter)
  assert.equal(after.values.promote, 'recorded')
  assert.match(after.values.promoteWhy, /proposed cause \(wiki:relation:new\), at revision 4/)
  // An echo runs both ways.
  await frameB.canvasBinding(canvasFrame(), {}, promoter).write([{key: 'promote', value: true}])
  assert.deepEqual([asked[1].relation, asked[1].direction], ['echo', 'undirected'])
})

test('Promote\'s refusal comes back in the owner\'s words and stands on the line; with no Scene presented, it says so', async () => {
  frameB.resetPromotion()
  const refusing = {relate: async () => { throw Error('These occurrences have no single current constellation in common.') }}
  await assert.rejects(frameB.canvasBinding(canvasFrame(), {}, refusing).write([{key: 'promote', value: true}]), /no single current constellation/)
  const said = frameB.canvasBinding(canvasFrame(), {}, refusing)
  assert.equal(said.values.promote, 'refused')
  assert.match(said.values.refusal, /no single current constellation/)
  await assert.rejects(frameB.canvasBinding(canvasFrame(null), {}, refusing).write([{key: 'promote', value: true}]), /presents no native Scene/)
  assert.match(frameB.canvasBinding(canvasFrame(), {}, null).standing.promote.disabled, /not reached/)
})

// ---------------------------------------------------------------------------------------------------------------- the browser's menus

const SPACE = {ref: 'wiki:node:s', title: 'The inquiry', kind: 'space', space: 'central:wiki:s', register: 'central', registerTitle: 'Central', members: [{ref: 'wiki:node:a', title: 'A', position: null, face: null}]}
const MADE = {ref: 'wiki:anchor:m', title: 'Readings', question: 'Which?', kind: 'frame', register: 'central', registerTitle: 'Central', members: [{ref: 'source:a', title: 'source:a', position: null, face: null}]}
const MEMBER = {participation_ref: 'participation:wiki:1', subject_ref: 'source:a', label: 'the passage', anchor: {revision: 'r1', start_byte: 3, end_byte: 9}, role_ref: null, temporal: [], places: []}
const CONNECTION = {ref: 'wiki:relation:1', revision: 1, from: 'participation:wiki:1', to: 'participation:wiki:2', relation: 'qualifies', direction: 'directed', standing: 'proposed'}
const READING = {whole: MADE.ref, frame_ref: 'wiki:frame:m', revision: 3, title: 'Readings', question: 'Which?', members: [MEMBER, {...MEMBER, participation_ref: 'participation:wiki:2', label: 'another'}],
  connections: [CONNECTION], compositions: [{reference: 'expression:x', revision: '2', kind: 'expression', source: {}}]}
function actsLog() {
  const said = []
  const acts = new Proxy({}, {get: (_, act) => (...args) => { said.push([act, ...args]) }})
  return {said, acts}
}

test('a space\'s menu makes a new constellation in it; Rename and Edit question wait for one you made, saying why', () => {
  const {said, acts} = actsLog()
  const items = rows.constellationMenu(SPACE, {state: 'none'}, acts)
  assert.deepEqual(items.filter(item => item.type !== 'separator').map(item => item.label), ['New constellation in The inquiry', 'Rename', 'Edit question', 'Time and place…', 'Show in graph'])
  items[0].onSelect()
  assert.deepEqual(said[0], ['edit', {kind: 'new', row: SPACE}])
  const rename = items.find(item => item.id === 'rename')
  assert.equal(rename.disabled, true)
  assert.match(rename.why, /is not a constellation you made/)
  items.find(item => item.id === 'facts').onSelect()
  assert.deepEqual(said[1], ['facts', SPACE.ref, SPACE, SPACE.title], 'a space\'s time and place are its whole\'s')
})

test('a constellation you made renames, takes a question, and opens its own time and place', () => {
  const {said, acts} = actsLog()
  const items = rows.constellationMenu(MADE, {state: 'read', reading: READING}, acts)
  assert.equal(items.some(item => item.id === 'new'), false, 'a frame is no space: nothing is made in it')
  for (const id of ['rename', 'question']) { const item = items.find(entry => entry.id === id); assert.equal(item.disabled, undefined); item.onSelect() }
  assert.deepEqual(said.map(row => row[1].kind), ['title', 'question'])
  items.find(item => item.id === 'facts').onSelect()
  assert.deepEqual(said[2].slice(0, 2), ['facts', 'wiki:frame:m'], 'the whole frame\'s time and place')
})

test('a member opens at its passage, takes its time and place in this constellation, and is removed with the source left as it is', () => {
  const {said, acts} = actsLog()
  const items = rows.memberMenu(MEMBER, MADE, {state: 'read', reading: READING}, acts)
  assert.deepEqual(items.filter(item => item.type !== 'separator').map(item => [item.label, item.tone ?? null, item.disabled ?? null]),
    [['Open', null, null], ['Time and place in this constellation…', null, null], ['Remove from constellation', 'destructive', null]])
  for (const item of items.filter(entry => entry.type !== 'separator')) item.onSelect()
  assert.deepEqual(said.map(row => row[0]), ['open', 'facts', 'remove'])
  assert.deepEqual(said[1][1], {frame_ref: 'wiki:frame:m', participation_ref: MEMBER.participation_ref})
  const space = rows.memberMenu(SPACE.members[0], SPACE, {state: 'none'}, acts)
  assert.equal(space.find(item => item.id === 'remove').disabled, true, 'a space\'s own member is the space\'s: nothing is removed here')
  assert.deepEqual(rows.memberWords(MEMBER), {name: 'the passage', meta: 'a · bytes 3–9'})
})

test('a connection\'s menu renames its meaning, chooses its direction and standing (the one standing checked), and retracts it', () => {
  const {said, acts} = actsLog()
  const items = rows.connectionMenu(CONNECTION, MADE, acts)
  assert.deepEqual(items.filter(item => item.checked).map(item => item.label), ['From → to', 'Proposed'])
  items.find(item => item.id === 'direction:undirected').onSelect()
  items.find(item => item.id === 'standing:asserted').onSelect()
  items.find(item => item.id === 'retract').onSelect()
  items.find(item => item.id === 'meaning').onSelect()
  assert.deepEqual(said.slice(0, 3).map(row => row[3]), [{direction: 'undirected'}, {standing: 'asserted'}, null])
  assert.equal(said[3][1].kind, 'meaning')
  assert.equal(rows.connectionWords(CONNECTION, READING), 'the passage → qualifies → another')
})

// ---------------------------------------------------------------------------------------------------------------- Return to constellation

test('an Expressions clip made of a constellation returns its Expression to it; another mode\'s clip lists no Return', async () => {
  resetViewHolds()
  const base = {reads: {}, acts: {}, view: {}, refused: {}}
  const returned = []
  const made = clipBinding({mode: 'expressions', ref: 'scene:a', values: {}, wiring: withMadeOf(base, {made: 'of', ref: MADE.ref, by: 'the scene\'s body'}, async ref => { returned.push(ref) })})
  const set = {columns: [{id: 'r1', name: '1'}], tracks: [{id: 't1', name: 'E', kind: 'world'}], clips: [{id: 'scene:a', trackId: 't1', columnId: 'r1', label: 'Readings'}], actions: {owner: 'Expressions'}}
  const written = []
  const context = binding => ({view: 'session', binding, press: (_key, _what, run) => run(), rename: noop, writeClip: async (id, key, value) => { written.push([id, key]); await binding.write([{key, value}]); return {ok: true} }})
  const item = menus.objectMenu({kind: 'clip', id: 'scene:a', trackId: 't1', name: 'Readings'}, set, context(made)).find(entry => entry.id === 'return-to-constellation')
  assert.ok(item, 'the clip\'s menu lists Return to constellation')
  await item.onSelect()
  assert.deepEqual([written, returned], [[['scene:a', MADE_OF.ret]], [MADE.ref]], 'through the clip\'s binding, to the constellation it was made of')
  const page = clipBinding({mode: 'central', ref: 'page:a', values: {}, wiring: withMadeOf(base, {made: 'of', ref: MADE.ref, by: 'the page'})})
  assert.equal(page.standing[MADE_OF.ret].disabled, NOT_AN_EXPRESSION)
  const set2 = {...set, clips: [{...set.clips[0], id: 'page:a'}]}
  assert.equal(menus.objectMenu({kind: 'clip', id: 'page:a', trackId: 't1', name: 'A page'}, set2, context(page)).some(entry => entry.id === 'return-to-constellation'), false)
  const none = clipBinding({mode: 'expressions', ref: 'scene:b', values: {}, wiring: withMadeOf(base, {made: 'none', by: 'the scene\'s body'}, async () => {})})
  assert.match(none.standing[MADE_OF.ret].disabled, /made of no constellation/)
})

// ---------------------------------------------------------------------------------------------------------------- the reader's doors

test('the reader opens at a member\'s passage, and on the time-and-place editor of the subject it is asked for', () => {
  const at = open.createKnowledgeBinding({title: 'the passage', project: 'Scratch', address: {kind: 'source', value: 'source:a'}, plane: 'page', anchor: MEMBER.anchor}, 'b1')
  assert.deepEqual(at.view.pageAnchor, MEMBER.anchor)
  const facts = open.createKnowledgeBinding({title: 'the passage', address: {kind: 'source', value: 'source:a'}, plane: 'page', facts: {frame_ref: 'wiki:frame:m', participation_ref: MEMBER.participation_ref}}, 'b2')
  assert.deepEqual(facts.view.facts, {subject: {frame_ref: 'wiki:frame:m', participation_ref: MEMBER.participation_ref}, requestId: 'b2'})
  assert.throws(() => open.validateKnowledgeOpen({title: 'x', address: {kind: 'source', value: 'a'}, plane: 'page', anchor: {revision: 'r', start_byte: 9, end_byte: 3}}), /Invalid/)
  assert.throws(() => open.validateKnowledgeOpen({title: 'x', address: {kind: 'source', value: 'a'}, facts: {frame_ref: 'f'}}), /Invalid/)
})

test('the browser\'s selection is the reader\'s constellation in focus, and the reader\'s graph opens a constellation in the browser', () => {
  focus.resetConstellationFocus()
  focus.selectConstellation(MADE.ref)
  const shown = []
  focus.publishBrowserDoor(category => { shown.push(category) })
  inFocus.focusConstellation('wiki:anchor:other')
  assert.equal(focus.constellationFocus().ref, 'wiki:anchor:other')
  assert.deepEqual(shown, [focus.CONSTELLATIONS_CATEGORY])
  focus.resetConstellationFocus()
  assert.throws(() => inFocus.focusConstellation('wiki:anchor:other'), /No browser is mounted/)
})
