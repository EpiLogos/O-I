import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {register} from 'node:module'

// O9 (walk #857 r47, LV04; DLW build ruling 2026-11-09, round 48 item 1): Shift-click on a part's head extends the parts chosen to a
// range from the one chosen before, ⌘-click adds or takes away one (manual §10.8: "Group the selected tracks", ⌘G), and ⌘G groups
// every part chosen through live-set's own act, `tracks_group`, in the set's order. Loader as f3-tracks.test.mjs.
const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};
import {readFile} from 'node:fs/promises';
export async function resolve(specifier,context,next){
  try{return await next(specifier,context)}catch(error){
    if(!specifier.startsWith('.'))throw error;
    if(specifier.endsWith('.js')){try{return await next(specifier.slice(0,-3)+'.ts',context)}catch{}}
    for(const suffix of ['.ts','.tsx']){try{return await next(specifier+suffix,context)}catch{}}
    throw error;
  }
}
export async function load(url,context,next){
  if(url.endsWith('.css'))return {format:'module',shortCircuit:true,source:'export default null'};
  if(url.endsWith('.ts')||url.endsWith('.tsx')){
    const source=await readFile(new URL(url).pathname,'utf8');
    const {outputText}=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX},fileName:url});
    return {format:'module',shortCircuit:true,source:outputText};
  }
  return next(url,context);
}`)}`, {parentURL: import.meta.url})

globalThis.document = {getElementById: () => null, createElement: () => ({}), head: {appendChild: () => {}}}
const React = await import('react')
const {renderToStaticMarkup} = await import('react-dom/server')
const acts = await import('../src/frame/menu/objectActions.ts')
const parts = await import('../src/frame/tracks/partChoice.ts')
const sessionModule = await import('../src/frame/tracks/SessionGrid.tsx')
const rulerModule = await import('../src/frame/tracks/ArrangementRuler.tsx')
const {SessionGrid} = sessionModule
const {ArrangementRuler} = rulerModule

const order = ['p0', 'p1', 'p2', 'p3']
const set = (actions = {}) => ({
  columns: [{id: 'r1', name: '1'}],
  tracks: [...order.map((id, i) => ({id, name: ['Estuary', 'Market hall', 'Tide pad', 'Keys'][i], kind: 'audio'})), {id: 'ret', name: 'A-Reverb', kind: 'return', returns: true}],
  clips: [],
  actions: {owner: 'live-set', ...actions},
})
const context = (extra = {}) => ({view: 'session', binding: null, press: (_key, _what, run) => run(), rename: () => {}, writeClip: async () => ({ok: true}), ...extra})
const byId = (items, id) => items.find(item => item.id === id)

test('SCRIPTED — Shift-click extends the parts chosen to a range from the one chosen before; ⌘-click adds or takes away one', () => {
  const {nextPartChoice, partsWith, partHow, NO_PARTS} = parts
  assert.equal(partHow({shiftKey: true}), 'range')
  assert.equal(partHow({metaKey: true}), 'toggle')
  assert.equal(partHow({ctrlKey: true}), 'toggle', 'Ctrl off the Mac')
  assert.equal(partHow({}), 'one')
  const one = nextPartChoice(NO_PARTS, undefined, 'p1', order, 'one')
  assert.deepEqual(one, {anchor: 'p1', parts: ['p1']})
  const range = nextPartChoice(one, 'p1', 'p3', order, 'range')
  assert.deepEqual(range, {anchor: 'p1', parts: ['p1', 'p2', 'p3']}, 'every part between, in the set\'s order')
  assert.deepEqual(nextPartChoice(range, 'p3', 'p0', order, 'range'), {anchor: 'p1', parts: ['p0', 'p1']}, 'the range is drawn again from the same anchor')
  const added = nextPartChoice(one, 'p1', 'p3', order, 'toggle')
  assert.deepEqual(added, {anchor: 'p3', parts: ['p1', 'p3']}, '⌘ adds one, kept in the set\'s order')
  assert.deepEqual(nextPartChoice(added, 'p3', 'p1', order, 'toggle'), {anchor: 'p3', parts: ['p3']}, '⌘ on a chosen part takes it away')
  assert.deepEqual(nextPartChoice(range, 'p3', 'p2', order, 'one'), {anchor: 'p2', parts: ['p2']}, 'a plain click chooses that one alone')
  // THE selection moved elsewhere (a clip, the Main track, a key): what was chosen before no longer stands with it.
  assert.deepEqual(partsWith(range, 'p2'), range)
  assert.deepEqual(partsWith(range, 'clip-9'), {anchor: 'clip-9', parts: ['clip-9']})
  assert.deepEqual(nextPartChoice(range, 'p0-elsewhere', 'p2', order, 'range'), {anchor: 'p2', parts: ['p2']}, 'no anchor in the set: the click chooses one')
  assert.deepEqual(nextPartChoice(range, 'p0', 'p2', order, 'range').parts, ['p0', 'p1', 'p2'], 'a selection outside the choice anchors the range')
})

test('SCRIPTED — ⌘G groups every part chosen, in the set\'s order, through live-set\'s one act; one part alone as before', () => {
  const ran = []
  const groupTracks = {op: 'tracks_group', run: ids => { ran.push(ids); return {ok: true} }}
  const pressed = []
  const ctx = context({press: (key, what, run) => { pressed.push([key, what]); return run() }, chosen: ['p3', 'p1', 'p2']})
  const items = acts.objectMenu({kind: 'track', id: 'p2', name: 'Tide pad'}, set({groupTracks}), ctx)
  const group = byId(items, 'group')
  assert.equal(group.label, 'Group 3 parts')
  group.onSelect('group')
  assert.deepEqual(ran.at(-1), ['p1', 'p2', 'p3'])
  assert.deepEqual(pressed.at(-1), ['group:p1,p2,p3', 'Group Market hall, Tide pad and Keys'])
  // The menu of a part not among those chosen groups that part alone.
  byId(acts.objectMenu({kind: 'track', id: 'p0', name: 'Estuary'}, set({groupTracks}), ctx), 'group').onSelect('group')
  assert.deepEqual(ran.at(-1), ['p0'])
  const alone = byId(acts.objectMenu({kind: 'track', id: 'p0', name: 'Estuary'}, set({groupTracks}), context()), 'group')
  assert.equal(alone.label, 'Group')
})

test('SSR — every part chosen draws as chosen on its head in Session and Arrangement view; the remove button stays THE selection\'s', () => {
  parts.setPartChoice({anchor: 'p1', parts: ['p1', 'p2']})
  try {
    const session = renderToStaticMarkup(React.createElement(SessionGrid, {set: set(), selection: {ref: 'p2', select() {}}}))
    const pressed = [...session.matchAll(/<button type="button" class="thd( sel)?"[^>]*aria-pressed="(true|false)"[^>]*>(?:<[^>]+>)*([^<]+)/g)].map(m => [m[3], m[2]])
    assert.deepEqual(pressed.filter(([, on]) => on === 'true').map(([name]) => name), ['Market hall', 'Tide pad'])
    const ruler = renderToStaticMarkup(React.createElement(ArrangementRuler, {set: set(), selection: {ref: 'p2', select() {}}}))
    assert.equal((ruler.match(/class="tl-head[^"]* sel"/g) ?? []).length, 2, 'two heads chosen on the ruler')
  } finally { parts.setPartChoice(parts.NO_PARTS) }
})

test('CODE-READING — the hosts read the part choice with THE selection and their set, and the menu reads what is chosen', async () => {
  const grid = await readFile(new URL('../src/frame/tracks/SessionGrid.tsx', import.meta.url), 'utf8')
  const ruler = await readFile(new URL('../src/frame/tracks/ArrangementRuler.tsx', import.meta.url), 'utf8')
  const menu = await readFile(new URL('../src/frame/menu/TracksMenu.tsx', import.meta.url), 'utf8')
  // The views stay hook-free (tests call them as functions): the part choice is read by their hosts and handed in. (How a head's click
  // chooses is driven through the views' own heads below, 0D item 9.)
  for (const source of [grid, ruler]) assert.match(source, /const chosen = usePartChoice\(selection\.ref, set\)\.parts/)
  assert.match(menu, /chosen: partsWith\(partChoice\(\), latest\.current\.selection\.ref\)\.parts/)
})

// 0D item 9 (review of O-I #943, findings 9 and 10; DLW build ruling 2026-11-09). A range is the parts the view draws, in its order: a
// Shift-click across a folded group chose its hidden members, and one to a return chose it with the parts (⌘G then refused in words).
// Driven through the views' own heads: Session with the group folded, Arrangement with it open (the ruler folds no group).
const GROUPED = {
  columns: [{id: 'r1', name: '1'}],
  tracks: [{id: 'p0', name: 'Estuary', kind: 'audio'}, {id: 'g', name: 'Strings', kind: 'group'},
    {id: 'p1', name: 'Violin', kind: 'audio', parentId: 'g', depth: 1}, {id: 'p2', name: 'Cello', kind: 'audio', parentId: 'g', depth: 1},
    {id: 'p3', name: 'Keys', kind: 'midi'}, {id: 'ret', name: 'A-Reverb', kind: 'return', returns: true}, {id: 'main', name: 'Main', kind: 'main', main: true}],
  clips: [],
  actions: {owner: 'live-set'},
}
function find(tree, pred, out = []) {
  if (Array.isArray(tree)) { for (const child of tree) find(child, pred, out); return out }
  if (!tree || typeof tree !== 'object' || !tree.props) return out
  if (pred(tree)) out.push(tree)
  return find(tree.props.children, pred, out)
}
const headText = node => Array.isArray(node) ? node.map(headText).join('') : node == null || typeof node === 'boolean' ? '' : typeof node !== 'object' ? String(node) : headText(node.props?.children)

test('SCRIPTED — a head\'s Shift-click chooses the parts the view draws between, never a folded group\'s members or a return; THE selection is the part clicked', () => {
  const noop = () => {}
  const selection = {ref: undefined, select(target) { this.ref = target.ref }}
  const click = (tree, className, name, event = {}) => {
    const head = find(tree, el => el.type === 'button' && String(el.props.className ?? '').split(' ').includes(className) && headText(el.props.children).includes(name))[0]
    assert.ok(head, `${name}'s head is drawn`)
    head.props.onClick({shiftKey: false, metaKey: false, ctrlKey: false, ...event, currentTarget: {focus: noop}})
  }
  const {SessionGridView} = sessionModule, {ArrangementRulerView} = rulerModule
  const session = () => SessionGridView({set: GROUPED, selection, folded: {g: true}, onFold: noop, receipt: null, onPress: noop, onDismiss: noop})
  const arrangement = () => ArrangementRulerView({set: GROUPED, selection, receipt: null, onDismiss: noop, onPress: noop,
    view: {window: null, onWindow: noop, snap: 'grid', onSnap: noop, marker: null, onMarker: noop, width: 360}})
  try {
    click(session(), 'thd', 'Estuary')
    click(session(), 'thd', 'Keys', {shiftKey: true})
    assert.deepEqual(parts.partChoice(), {anchor: 'p0', parts: ['p0', 'g', 'p3']}, 'Session: the folded group\'s members are not chosen')
    assert.equal(selection.ref, 'p3', 'THE selection is the part clicked')
    click(session(), 'thd', 'A-Reverb', {shiftKey: true})
    assert.deepEqual(parts.partChoice(), {anchor: 'ret', parts: ['ret']}, 'a return is never in a range: the click chooses it alone')
    assert.equal(selection.ref, 'ret')
    click(arrangement(), 'tl-head', 'Estuary')
    click(arrangement(), 'tl-head', 'Keys', {shiftKey: true})
    assert.deepEqual(parts.partChoice(), {anchor: 'p0', parts: ['p0', 'g', 'p1', 'p2', 'p3']}, 'Arrangement: every part its heads draw between')
    assert.equal(selection.ref, 'p3')
    click(arrangement(), 'tl-head', 'A-Reverb', {metaKey: true})
    assert.deepEqual(parts.partChoice().parts, ['ret'], '⌘ on a return chooses it alone, never with the parts')
  } finally { parts.setPartChoice(parts.NO_PARTS) }
})

// 0D item 9 (review of O-I #943, finding 9). What was chosen stood hidden while THE selection was elsewhere and came back when a
// right-click or the device button selected one of its parts: p1 to p3 chosen, a clip clicked, p2 right-clicked, and the menu said
// "Group 3 parts". The choice is let go once THE selection leaves it, and when the set is another. Driven through the hosts' own hook,
// mounted on a small DOM so its effects run (device-runtime-host.test.mjs's).
// 0E item 6 (delta review of O-I #943, finding 8; DLW build ruling 2026-11-09): the choice was let go on any change of the set's parts, a
// part another hand added or a return shown or hidden, though a re-read kept every part chosen. It is let go only when one of its parts
// leaves the set, the set's owner changes, or THE selection leaves it.
test('SCRIPTED — 0E: the parts chosen stand through a re-read that keeps them, and go when one of them leaves or the owner changes', () => {
  const added = {...GROUPED, tracks: [...GROUPED.tracks.slice(0, 5), {id: 'p4', name: 'Bass', kind: 'audio'}, ...GROUPED.tracks.slice(5)]}
  const noReturn = {...GROUPED, tracks: GROUPED.tracks.filter(track => track.id !== 'ret')}
  const chosen = {anchor: 'p1', parts: ['p1', 'p2', 'p3']}
  try {
    for (const [reread, what] of [[{...GROUPED}, 'the same parts'], [added, 'a part added'], [noReturn, 'the return hidden']]) {
      parts.setPartChoice(chosen, GROUPED)
      parts.selectionMoved('p2', reread)
      assert.deepEqual(parts.partChoice(), chosen, `${what}: the choice stands`)
    }
    // A Shift-click after a re-read draws its range from the choice's anchor.
    parts.setPartChoice({anchor: 'p1', parts: ['p1']}, GROUPED)
    parts.chooseTrack({ref: 'p1', select() {}}, added, {id: 'p4', name: 'Bass'}, ['p0', 'g', 'p1', 'p2', 'p3', 'p4'], {shiftKey: true})
    assert.deepEqual(parts.partChoice().parts, ['p1', 'p2', 'p3', 'p4'], 'the range runs from p1 in the re-read set')
    parts.setPartChoice(chosen, GROUPED)
    parts.selectionMoved('p2', {...GROUPED, tracks: GROUPED.tracks.filter(track => track.id !== 'p3')})
    assert.deepEqual(parts.partChoice(), parts.NO_PARTS, 'p3 left the set: the choice is let go')
    parts.setPartChoice(chosen, GROUPED)
    parts.selectionMoved('p2', {...GROUPED, actions: {owner: 'factory'}})
    assert.deepEqual(parts.partChoice(), parts.NO_PARTS, 'the set\'s owner changed: the choice is let go')
  } finally {
    parts.setPartChoice(parts.NO_PARTS)
  }
})

test('MOUNTED — the parts chosen are let go when THE selection leaves them, and when one of them leaves the set', async () => {
  const {createRoot} = await import('react-dom/client')
  const {flushSync} = await import('react-dom')
  class Node_ {
    constructor(nodeType, nodeName) { this.nodeType = nodeType; this.nodeName = nodeName; this.childNodes = []; this.parentNode = null }
    get ownerDocument() { return page }
    appendChild(child) { this.childNodes.push(child); child.parentNode = this; return child }
    removeChild(child) { this.childNodes.splice(this.childNodes.indexOf(child), 1); child.parentNode = null; return child }
    addEventListener() {}
    removeEventListener() {}
  }
  class Element_ extends Node_ {
    constructor(name) { super(1, name.toUpperCase()); this.tagName = this.nodeName; this.namespaceURI = 'http://www.w3.org/1999/xhtml'; this.attributes = new Map(); this.style = {} }
    setAttribute(name, value) { this.attributes.set(name, String(value)) }
    getAttribute(name) { return this.attributes.get(name) ?? null }
    removeAttribute(name) { this.attributes.delete(name) }
  }
  const page = Object.assign(new Node_(9, '#document'), {createElement: name => new Element_(name)})
  const shown = []
  const Probe = ({selected, set}) => { shown.push(parts.usePartChoice(selected, set).parts); return null }
  const settle = () => new Promise(resolve => setTimeout(resolve, 0))
  const was = globalThis.window
  globalThis.window = {document: page, HTMLIFrameElement: class {}, addEventListener() {}, removeEventListener() {}}
  const root = createRoot(new Element_('div'))
  const draw = async (selected, set = GROUPED) => { flushSync(() => root.render(React.createElement(Probe, {selected, set}))); await settle(); return shown.at(-1) }
  const menuReads = selected => parts.partsWith(parts.partChoice(), selected).parts
  try {
    parts.setPartChoice({anchor: 'p1', parts: ['p1', 'p2', 'p3']}, GROUPED)
    assert.deepEqual(await draw('p3'), ['p1', 'p2', 'p3'])
    assert.deepEqual(await draw('clip-9'), ['clip-9'], 'a clip selected: the choice is not drawn')
    assert.deepEqual(await draw('p2'), ['p2'], 'p2 selected again without a head\'s click: the old choice does not come back')
    assert.deepEqual(menuReads('p2'), ['p2'], 'and the menu groups p2 alone')
    // A re-read that keeps the parts chosen keeps the choice (0E item 6); one without a part chosen lets it go, and it does not come back.
    parts.setPartChoice({anchor: 'p1', parts: ['p1', 'p2', 'p3']}, GROUPED)
    assert.deepEqual(await draw('p2'), ['p1', 'p2', 'p3'])
    const reread = {...GROUPED, tracks: GROUPED.tracks.filter(track => track.id !== 'p0')}
    assert.deepEqual(await draw('p2', reread), ['p1', 'p2', 'p3'], 'p0 gone, the parts chosen stand: the choice is drawn')
    const left = {...GROUPED, tracks: GROUPED.tracks.filter(track => track.id !== 'p3')}
    assert.deepEqual(await draw('p2', left), ['p2'], 'p3 gone: the choice is let go')
    assert.deepEqual(await draw('p2'), ['p2'], 'and it does not come back when p3 does')
    assert.deepEqual(menuReads('p2'), ['p2'])
  } finally {
    flushSync(() => root.unmount()); parts.setPartChoice(parts.NO_PARTS)
    if (was === undefined) delete globalThis.window; else globalThis.window = was
  }
})
