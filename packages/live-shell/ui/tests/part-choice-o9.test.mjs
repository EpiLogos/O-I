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
const {SessionGrid} = await import('../src/frame/tracks/SessionGrid.tsx')
const {ArrangementRuler} = await import('../src/frame/tracks/ArrangementRuler.tsx')

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

test('CODE-READING — a head\'s click chooses through the part choice with its modifiers, and the menu reads what is chosen', async () => {
  const grid = await readFile(new URL('../src/frame/tracks/SessionGrid.tsx', import.meta.url), 'utf8')
  const ruler = await readFile(new URL('../src/frame/tracks/ArrangementRuler.tsx', import.meta.url), 'utf8')
  const menu = await readFile(new URL('../src/frame/menu/TracksMenu.tsx', import.meta.url), 'utf8')
  assert.match(grid, /onClick=\{event => \{ event\.currentTarget\.focus\(\); chooseTrack\(selection, set, track, event\) \}\}/)
  assert.match(ruler, /const selectTrack = \(event\?: ReactMouseEvent<HTMLElement>\) => chooseTrack\(selection, set, track, event\)/)
  // The views stay hook-free (tests call them as functions): the part choice is read by their hosts and handed in.
  for (const source of [grid, ruler]) assert.match(source, /const chosen = usePartChoice\(selection\.ref\)\.parts/)
  assert.match(menu, /chosen: partsWith\(partChoice\(\), latest\.current\.selection\.ref\)\.parts/)
})
