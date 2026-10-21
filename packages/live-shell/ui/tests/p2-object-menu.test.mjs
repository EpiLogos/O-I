import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {register} from 'node:module'
const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};
import {readFile} from 'node:fs/promises';
export async function resolve(s, c, n) {
  if (s === 'react' || s.startsWith('react/')) return n(s, {...c, parentURL: ${JSON.stringify(import.meta.url)}})
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
  return {format: 'module', shortCircuit: true, source: ts.transpileModule(await readFile(new URL(u), 'utf8'), {fileName: new URL(u).pathname,
    compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX}}).outputText};
}`)}`, import.meta.url)

// UI/UX lane, phase 2 (manual §10.9 and each mode's action table): every object's acts after Live's, its menu, Live's keys, the
// menu bar's commands and the undo list. SCRIPTED — pure functions over fixture sets; CODE-READING — the host's menu ids.
const menu = await import('../src/frame/menu/useObjectMenu.ts')
const acts = await import('../src/frame/menu/objectActions.ts')
const undo = await import('../src/frame/menu/undo.ts')
const commands = await import('../src/frame/menu/commandDoor.ts')

const set = (actions = {}) => ({
  columns: [{id: 'r1', name: 'Morning'}, {id: 'r2', name: 'Afternoon'}],
  tracks: [{id: 't1', name: 'Bollingen', kind: 'world', mix: {activator: true, solo: false, arm: false}}, {id: 'ro', name: 'firings', kind: 'spine', readOnly: true}],
  clips: [{id: 'c1', trackId: 't1', columnId: 'r1', label: 'The stone carved'}, {id: 'c2', trackId: 'ro', columnId: 'r1', label: 'a firing'}],
  actions: {owner: 'the test owner', ...actions},
})
const context = (extra = {}) => ({view: 'session', binding: null, press: (_key, _what, run) => run(), rename: () => {}, writeClip: async () => ({ok: true}), ...extra})
const byId = (items, id) => items.find(item => item.id === id)

test('the menu stands beside the point where it fits, and flips at the window\'s edge', () => {
  const view = {width: 1000, height: 700}
  assert.deepEqual(menu.placeMenu(100, 100, {width: 200, height: 300}, view), {left: 100, top: 100, width: 200, maxHeight: 688})
  const flipped = menu.placeMenu(950, 650, {width: 200, height: 300}, view)
  assert.equal(flipped.left, 750, 'it opens to the left of a point near the right edge')
  assert.equal(flipped.top, 350, 'and above a point near the foot')
})

test('the keys step through what can be chosen, and a typed word moves to the next entry it begins', () => {
  const items = [{id: 'a', label: 'Launch'}, {id: 's', type: 'separator'}, {id: 'b', label: 'Rename', disabled: true}, {id: 'c', label: 'Rest'}, {id: 'd', label: 'Delete'}]
  assert.deepEqual(menu.steppable(items), [0, 3, 4], 'separators and disabled entries are passed over')
  assert.equal(menu.typeaheadIndex(items, 'r', -1), 3, 'Rename is disabled, so R lands on Rest')
  assert.equal(menu.typeaheadIndex(items, 'd', 0), 4)
  assert.equal(menu.typeaheadIndex(items, 'x', 0), -1)
  assert.ok(menu.opensMenu({key: 'ContextMenu', shiftKey: false}) && menu.opensMenu({key: 'F10', shiftKey: true}) && !menu.opensMenu({key: 'F10', shiftKey: false}))
})

test('a clip\'s acts run the set\'s owner ops; one no owner carries stands disabled and names the op it waits for', () => {
  const ran = []
  const items = acts.objectMenu({kind: 'clip', id: 'c1', trackId: 't1', name: 'The stone carved'},
    set({launch: {op: 'page.launch', run: id => ran.push(['launch', id])}, duplicateClip: {op: 'scene.duplicate', run: id => ran.push(['duplicate', id])}}), context())
  byId(items, 'launch').onSelect('launch'); byId(items, 'duplicate').onSelect('duplicate')
  assert.deepEqual(ran, [['launch', 'c1'], ['duplicate', 'c1']])
  const del = byId(items, 'delete')
  assert.equal(del.disabled, true)
  assert.equal(del.tone, 'destructive', 'Delete is drawn as destructive, apart from an entry that cannot run')
  assert.equal(del.why, 'No owner operation carries it yet — missing op: clip.delete (the test owner).')
  assert.ok(items.some(item => item.type === 'swatches' && item.colours.length === 70), 'Live\'s 70 colours stand inline')
  assert.equal(byId(items, 'split'), undefined, 'Split is Arrangement view\'s')
  assert.ok(byId(acts.objectMenu({kind: 'clip', id: 'c1', trackId: 't1', name: 'x'}, set(), context({view: 'arrangement'})), 'split'))
})

test('a clip\'s own facts follow its Clip view: the owner\'s refusal is said in its words, a write goes through it and is undoable', async () => {
  undo.clearUndo()
  const binding = {ref: 'c1', values: {colour: '#FF94A6', active: true}, standing: {name: {disabled: 'Only a Flow keeps a title of its own.'}}, writes: key => key !== 'source', write: async () => {}}
  const writes = []
  const items = acts.objectMenu({kind: 'clip', id: 'c1', trackId: 't1', name: 'The stone carved'}, set(),
    context({binding, record: undo.recordStep, writeClip: async (id, key, value) => { writes.push([id, key, value]); return {ok: true} }}))
  assert.equal(byId(items, 'rename').why, 'Only a Flow keeps a title of its own.')
  const off = byId(items, 'switch-off')
  assert.equal(off.label, 'Switch off')
  off.onSelect('switch-off')
  await new Promise(resolve => setTimeout(resolve, 0))
  assert.deepEqual(writes, [['c1', 'active', false]])
  assert.equal(undo.undoState().undo, 'Switch off The stone carved')
  await undo.undoStep()
  assert.deepEqual(writes.at(-1), ['c1', 'active', true], 'Undo writes it back through the same owner')
  await undo.redoStep()
  assert.deepEqual(writes.at(-1), ['c1', 'active', false])
})

test('a refused change is not recorded: Undo never claims a reversal the owner did not make', async () => {
  undo.clearUndo()
  const run = acts.undoable({record: undo.recordStep}, 'Rename x', async () => ({ok: false, error: 'stale revision'}), () => {})
  await run()
  assert.equal(undo.undoState().undo, null)
})

test('on a track read from another reading, every act says so rather than naming an op to build', () => {
  const clip = acts.objectMenu({kind: 'clip', id: 'c2', trackId: 'ro', name: 'a firing'}, set({launch: {op: 'x', run: () => {}}}), context())
  for (const id of ['launch', 'duplicate', 'delete', 'rename']) assert.equal(byId(clip, id).why, acts.READ_ONLY, id)
  const track = acts.objectMenu({kind: 'track', id: 'ro', name: 'firings'}, set({removeTrack: {op: 'x', run: () => {}}}), context())
  assert.equal(byId(track, 'delete').why, acts.READ_ONLY)
})

test('a track\'s switches run its mixer\'s owner ops and record their way back; its colour waits for track.colour', async () => {
  undo.clearUndo()
  const calls = []
  const items = acts.objectMenu({kind: 'track', id: 't1', name: 'Bollingen'},
    set({mixer: {solo: {op: 'solo', run: (id, on) => { calls.push(['solo', id, on]); return {ok: true} }}}}), context({record: undo.recordStep}))
  byId(items, 'solo').onSelect('solo')
  await new Promise(resolve => setTimeout(resolve, 0))
  assert.deepEqual(calls, [['solo', 't1', true]])
  await undo.undoStep()
  assert.deepEqual(calls.at(-1), ['solo', 't1', false])
  assert.equal(items.find(item => item.type === 'swatches').why, 'No owner operation carries it yet — missing op: track.colour (the test owner).')
})

test('Live\'s keys name their acts; the macro and playing keys stay the instrument\'s', () => {
  const key = (k, extra = {}) => acts.objectKeyAct({key: k, metaKey: false, shiftKey: false, altKey: false, ctrlKey: false, ...extra})
  assert.equal(key('r', {metaKey: true}), 'rename')
  assert.equal(key('d', {metaKey: true}), 'duplicate')
  assert.equal(key('Backspace'), 'delete')
  assert.equal(key('0'), 'switch-off')
  assert.equal(key('u'), 'fold')
  assert.equal(key('i', {metaKey: true}), 'insert')
  assert.equal(key('j', {metaKey: true, shiftKey: true}), 'crop')
  assert.equal(key('c'), null, 'C turns a macro (frame/keys/keyMap.ts)')
  assert.equal(key('s'), null, 'S is a note of the Jankó surface')
})

test('the menu bar\'s ids are the frame\'s: every command the host lists, the frame routes', async () => {
  const host = await readFile(new URL('../../../../desktop/cradle/src-tauri/src/menus.rs', import.meta.url), 'utf8')
  const ids = [...host.matchAll(/item\("((?:edit|create|view|app)\.[a-z-]+)"/g)].map(match => match[1])
  assert.ok(ids.length >= 19, `the host lists the shell's commands (${ids.length})`)
  for (const id of ids) assert.ok(id in commands.MENU_COMMANDS, `${id} is routed`)
  assert.match(host, /window\.emit\("oi:command", id\)/)
  assert.match(host, /item\("app\.settings", "Settings…", Some\("CmdOrCtrl\+,"\)\)/, 'Settings… on ⌘, in the application menu')
  const app = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8')
  assert.match(app, /listen<string>\('oi:command'/)
})
