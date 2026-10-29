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

// O-I #743, round one (manual §10.9 Acts and menus, §21.1 Live: tracks and clips): Live's acts are carried by the open set's owner
// (kernel live_set_act and live_clip_create, packages/live-set/src/acts.rs), so its menus show them enabled; Launch and Stop play
// the clip on the torus through the clip player; an act still dimmed says why on the status bar. SCRIPTED — the adapter and the menus
// over a fixture set with writers that record what they were asked; CODE-READING — the menu's markup and stylesheet.
const {liveSetTrackAdapter} = await import('../src/timeline/liveSetTrackAdapter.ts')
const acts = await import('../src/frame/menu/objectActions.ts')
const PATH = '/sets/Tide Sketch.als'
const ref = i => `als:${PATH}#track/${i}`
const summary = {path: PATH, tempo_bpm: 92, scene_count: 4, arrangement_clips: 1,
  tracks: [{kind: 'audio', name: 'Estuary', devices: []}, {kind: 'audio', name: 'Market hall', devices: []}, {kind: 'midi', name: 'Tide pad', devices: []},
    {kind: 'master', name: 'Master', devices: []}]}
const track = (kind, name, extra = {}) => ({kind, name, devices: [], arrangementClips: [], sessionSlots: {}, mixer: {}, takeLanes: [], automation: [],
  stoplessSlots: [], ...extra})
const document = {path: PATH, tempo: 92, scenes: 4, sceneNames: ['', 'Dawn', '', ''], tracks: [track('audio', 'Estuary', {stoplessSlots: [1]}), track('audio', 'Market hall'),
  track('midi', 'Tide pad', {sessionSlots: {0: 'Swell', 1: null, 2: null, 3: null}, arrangementClips: [{name: 'Ebb', kind: 'midi', start: 0, end: 4}]}),
  track('master', 'Master')]}

/** The set as Live's registration reads it, with writers that record each act and answer as the owner does. */
function liveSet({refuse = null} = {}) {
  const calls = []
  const answer = act => refuse ? Promise.reject(new Error(refuse)) : Promise.resolve({act: act.kind, done: `The owner did ${act.kind}.`, at: null, revision: 'sha256:2'})
  const set = liveSetTrackAdapter.project({set: summary, document, mixerWrite: async () => ({}),
    act: act => { calls.push(act); return answer(act) },
    insertClip: (track, scene) => { calls.push({insert: [track, scene]}); return refuse ? Promise.reject(new Error(refuse)) : Promise.resolve({name: ''}) },
    clipInfo: {read: (track, at) => Promise.resolve(`info of ${track}/${JSON.stringify(at)}`),
      write: (track, at, text) => { calls.push({info: [track, at, text]}); return Promise.resolve({}) }},
    play: {launch: (track, at) => { calls.push({launch: [track, at]}); return Promise.resolve({ok: true, note: 'Swell plays on the torus.'}) },
      stop: track => { calls.push({stop: track}); return {ok: true, note: 'Swell stops.'} },
      stopAll: () => { calls.push({stopAll: true}); return {ok: true, note: 'Nothing plays now.'} }}})
  return {set: {...set, actions: {...set.actions, owner: 'kernel · live-set, the open set\'s owner'}}, calls}
}
const context = (extra = {}) => ({view: 'session', binding: null, press: (_key, _what, run) => run(), rename: () => {}, writeClip: async () => ({ok: true}), ...extra})
const byId = (items, id) => items.find(item => item.id === id)
const slot = (trackIndex, scene, name) => ({kind: 'slot', trackId: ref(trackIndex), rowId: `scene:${scene}`, name})

test('Live\'s set carries every act its owner takes, each naming its owner op, and runs them as typed acts on the set', async () => {
  const {set, calls} = liveSet()
  const a = set.actions
  for (const name of ['insertClip', 'pasteClip', 'stopButton', 'launch', 'stopTrack', 'stopAll', 'duplicateClip', 'deleteClip', 'renameTrack', 'moveTrack',
    'duplicateTrack', 'insertRow', 'renameRow', 'duplicateRow', 'deleteRow', 'clipInfo']) assert.ok(a[name], `${name} is carried`)
  assert.equal(await a.clipInfo.read(`${ref(2)}/slot/0`), 'info of 2/{"slot":0}')
  assert.deepEqual(await a.clipInfo.run(`${ref(2)}/clip/0`, 'Keep the swell.'), {ok: true, note: 'The clip\'s info text is kept.'})
  calls.length = 0
  assert.match(a.insertClip.op, /live_clip_create/)
  assert.match(a.pasteClip.op, /live_set_act · clip_paste/)
  assert.match(a.launch.op, /torus/)
  assert.deepEqual(await a.insertClip.run(ref(2), 'scene:1'), {ok: true, note: 'Inserted an empty MIDI clip in row 2 of Tide pad.'})
  await a.pasteClip.run(`${ref(2)}/slot/0`, ref(2), 'scene:2', false)
  await a.pasteClip.run(`${ref(2)}/slot/0`, ref(1), 'scene:3', true)
  await a.stopButton.run(ref(0), 'scene:1', true)
  await a.duplicateClip.run(`${ref(2)}/slot/0`)
  await a.deleteClip.run(`${ref(2)}/clip/0`)
  await a.renameTrack.run(ref(1), 'Harbour')
  await a.moveTrack.run(ref(1), -1)
  await a.duplicateTrack.run(ref(2))
  await a.insertRow.run('scene:1')
  await a.insertRow.run(null)
  await a.renameRow.run('scene:0', 'Dawn')
  await a.duplicateRow.run('scene:0')
  const said = await a.deleteRow.run('scene:3')
  assert.deepEqual(said, {ok: true, note: 'The owner did scene_delete.'}, 'the owner\'s own words come back as the receipt')
  assert.deepEqual(await a.launch.run(`${ref(2)}/slot/0`), {ok: true, note: 'Swell plays on the torus.'})
  assert.deepEqual(a.stopTrack.run(ref(2)), {ok: true, note: 'Swell stops.'})
  a.stopAll.run()
  assert.deepEqual(calls, [
    {insert: [2, 1]},
    {kind: 'clip_paste', from_track: 2, from: {slot: 0}, track: 2, scene: 2, cut: false},
    {kind: 'clip_paste', from_track: 2, from: {slot: 0}, track: 1, scene: 3, cut: true},
    {kind: 'slot_stop_button', track: 0, scene: 1, on: true},
    {kind: 'clip_duplicate', track: 2, clip: {slot: 0}},
    {kind: 'clip_delete', track: 2, clip: {arrangement: 0}},
    {kind: 'track_rename', track: 1, name: 'Harbour'},
    {kind: 'track_move', track: 1, by: -1},
    {kind: 'track_duplicate', track: 2},
    {kind: 'scene_insert', after: 1},
    {kind: 'scene_insert', after: null},
    {kind: 'scene_rename', scene: 0, name: 'Dawn'},
    {kind: 'scene_duplicate', scene: 0},
    {kind: 'scene_delete', scene: 3},
    {launch: [2, {slot: 0}]},
    {stop: 2},
    {stopAll: true},
  ])
})

test('what the set\'s owner refuses comes back in its words, and an object of another set or the Main track is refused here', async () => {
  const {set, calls} = liveSet({refuse: 'The set changed since it was read (Live may have saved it): read it again and make the change on what stands'})
  const a = set.actions
  assert.deepEqual(await a.duplicateRow.run('scene:0'), {ok: false, error: 'The set changed since it was read (Live may have saved it): read it again and make the change on what stands'})
  assert.equal((await a.insertClip.run(ref(2), 'scene:1')).ok, false)
  calls.length = 0
  assert.match((await a.pasteClip.run('als:/sets/Other.als#track/0/slot/0', ref(2), 'scene:1', false)).error, /another set/)
  assert.match((await a.renameTrack.run(ref(3), 'Out')).error, /Main track/)
  assert.match((await a.insertClip.run(ref(3), 'scene:0')).error, /Main track/)
  assert.deepEqual(calls, [], 'nothing reaches the owner')
})

test('the stop buttons a set has removed are read back on its tracks, and each row by its own name', () => {
  const {set} = liveSet()
  assert.deepEqual(set.columns.map(column => column.name), ['1', 'Dawn', '3', '4'])
  assert.deepEqual(set.tracks[0].stopless, ['scene:1'])
  assert.equal(set.tracks[1].stopless, undefined)
})

test('in Live every slot act and every clip act stands enabled; Paste takes the clip Copy or Cut held', () => {
  const {set, calls} = liveSet()
  const empty = acts.objectMenu(slot(2, 1, 'Tide pad'), set, context())
  for (const id of ['insert', 'stop', 'stop-button']) assert.ok(!byId(empty, id).disabled, `${id} is enabled`)
  assert.equal(byId(empty, 'stop-button').label, 'Remove stop button')
  assert.equal(byId(acts.objectMenu(slot(0, 1, 'Estuary'), set, context()), 'stop-button').label, 'Add stop button', 'a removed button is given back')
  const paste = byId(empty, 'paste')
  assert.equal(paste.disabled, true)
  assert.match(paste.why, /Nothing is held/, 'with nothing held, Paste says so rather than naming an op to build')
  const clip = {kind: 'clip', id: `${ref(2)}/slot/0`, trackId: ref(2), name: 'Swell'}
  const clipItems = acts.objectMenu(clip, set, context())
  for (const id of ['launch', 'stop', 'cut', 'copy', 'duplicate', 'delete']) assert.ok(!byId(clipItems, id).disabled, `${id} is enabled`)
  byId(clipItems, 'copy').onSelect('copy')
  const held = byId(acts.objectMenu(slot(2, 1, 'Tide pad'), set, context()), 'paste')
  assert.ok(!held.disabled)
  held.onSelect('paste')
  byId(acts.objectMenu(clip, set, context()), 'cut').onSelect('cut')
  byId(acts.objectMenu(slot(1, 3, 'Market hall'), set, context()), 'paste').onSelect('paste')
  assert.deepEqual(calls.filter(call => call.kind === 'clip_paste').map(call => [call.track, call.scene, call.cut]), [[2, 1, false], [1, 3, true]])
  assert.equal(byId(acts.objectMenu(slot(2, 2, 'Tide pad'), set, context()), 'paste').disabled, true, 'a cut is pasted once')
  const stop = byId(acts.objectMenu(slot(2, 1, 'Tide pad'), set, context()), 'stop-button')
  stop.onSelect('stop-button')
  assert.deepEqual(calls.at(-1), {kind: 'slot_stop_button', track: 2, scene: 1, on: false})
})

test('Edit info text asks for the owner\'s text where the clip stands, writes what is kept, and records its way back', async () => {
  const {set, calls} = liveSet()
  const clip = {kind: 'clip', id: `${ref(2)}/slot/0`, trackId: ref(2), name: 'Swell'}
  assert.match(byId(acts.objectMenu(clip, set, context()), 'info').why, /missing op: clip\.info/, 'a view that can ask for no text leaves it waiting')
  const asked = [], steps = []
  const items = acts.objectMenu(clip, set, context({ask: (target, field, done) => { asked.push([target.id, field]); done('Keep the swell.') },
    record: step => steps.push(step)}))
  const info = byId(items, 'info')
  assert.ok(!info.disabled)
  info.onSelect('info')
  await new Promise(resolve => setTimeout(resolve, 0))
  assert.deepEqual(asked, [[clip.id, {label: 'Info text of Swell', value: 'info of 2/{"slot":0}'}]])
  await new Promise(resolve => setTimeout(resolve, 0))
  assert.deepEqual(calls, [{info: [2, {slot: 0}, 'Keep the swell.']}])
  assert.equal(steps[0]?.label, 'Edit info text of Swell')
})

test('in Live a track\'s and a row\'s acts stand enabled where its owner takes them; what waits names its op', () => {
  const {set} = liveSet()
  const items = acts.objectMenu({kind: 'track', id: ref(1), name: 'Market hall'}, set, context())
  for (const id of ['rename', 'duplicate', 'move-left', 'move-right', 'switch-off', 'solo', 'arm']) assert.ok(!byId(items, id)?.disabled, `${id} is enabled`)
  assert.match(byId(items, 'group').why, /missing op: tracks\.group/)
  const row = acts.objectMenu({kind: 'row', id: 'scene:1', name: '2'}, set, context())
  for (const id of ['insert', 'rename', 'duplicate', 'delete', 'stop-all']) assert.ok(!byId(row, id).disabled, `${id} is enabled`)
  assert.match(byId(row, 'launch').why, /missing op: row\.launch/)
})

test('a dimmed act says why on the status bar: its entry takes the pointer, carries its reason in data-i, and is never a disabled control', async () => {
  const {readFile} = await import('node:fs/promises')
  const menu = await import('../src/frame/menu/ObjectMenu.tsx')
  const props = menu.objectMenuItemProps({id: 'paste', label: 'Paste', disabled: true, why: 'Nothing is held: Copy or Cut a clip first.'})
  assert.equal(props['data-i'], 'Paste|Nothing is held: Copy or Cut a clip first.')
  assert.equal(props['aria-disabled'], true)
  assert.equal('disabled' in props, false, 'WebKit sends no mouseover to a disabled control, so the Info line would never hear it')
  assert.equal(menu.objectMenuItemProps({id: 'copy', label: 'Copy'})['aria-disabled'], undefined)
  const css = await readFile(new URL('../src/frame/menu/objectMenu.css', import.meta.url), 'utf8')
  const rule = css.split('\n').find(line => line.startsWith('.object-menu-item[aria-disabled=true]'))
  assert.ok(rule && !/pointer-events:\s*none/.test(rule), 'a dimmed entry still takes the pointer, so the status bar reads it')
})
