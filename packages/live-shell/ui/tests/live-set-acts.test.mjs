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
      stopAll: () => { calls.push({stopAll: true}); return {ok: true, note: 'Nothing plays now.'} },
      launchRow: (row, slots) => { calls.push({launchRow: [row, slots]}); return Promise.resolve({ok: true, note: 'Row 1 plays on the torus: Swell.'}) }}})
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
  for (const id of ['rename', 'duplicate', 'move-left', 'move-right', 'switch-off', 'solo', 'arm', 'group']) assert.ok(!byId(items, id)?.disabled, `${id} is enabled`)
  assert.match(byId(items, 'delete').why, /missing op: track\.remove/)
  const row = acts.objectMenu({kind: 'row', id: 'scene:1', name: '2'}, set, context())
  for (const id of ['insert', 'rename', 'duplicate', 'delete', 'stop-all']) assert.ok(!byId(row, id).disabled, `${id} is enabled`)
  // REPLACES "assert.match(byId(row, 'launch').why, /missing op: row\.launch/)": a row launches where the set hands in its player (O-I #743).
  assert.equal(byId(row, 'launch').disabled, undefined, 'a row\'s Launch is enabled')
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

test('a slot whose stop button the set has removed is drawn blank, and still opens its menu', async () => {
  const React = await import('react')
  const {renderToStaticMarkup} = await import('react-dom/server')
  const {SessionGridView} = await import('../src/inhabitants/catalogue/panels/dlw__session-grid.tsx')
  const {set} = liveSet()
  const html = renderToStaticMarkup(React.createElement(SessionGridView, {set, selection: {select: () => {}}, folded: {}, onFold: () => {},
    receipt: null, onPress: () => {}, onDismiss: () => {}}))
  const cell = (track, row) => {
    const at = html.indexOf(`data-slot-track="${ref(track)}" data-slot-row="scene:${row}"`)
    assert.ok(at > 0, `slot ${track}/${row} is drawn with its data-slot-*`)
    const start = html.lastIndexOf('<div', at), end = html.indexOf('</div>', at)
    return html.slice(start, end)
  }
  assert.doesNotMatch(cell(0, 1), /class="sg2"/, 'Live cap 37: a slot whose stop button was removed shows no square')
  assert.match(cell(0, 2), /class="sg2"/, 'every other empty slot keeps its stop square')
})

// Round two (O-I #743): a track's colour and its group read from the set; Group Tracks, Split, Consolidate and the colour as acts; what
// still waits names what it waits for.
const grouped = () => {
  const summary2 = {...summary, tracks: [{kind: 'midi', name: 'Keys', devices: []}, {kind: 'group', name: '2-Group', devices: []},
    {kind: 'midi', name: 'Bass', devices: []}, {kind: 'audio', name: 'Drums', devices: []}, {kind: 'master', name: 'Master', devices: []}]}
  const document2 = {...document, tracks: [track('midi', 'Keys', {trackId: '12', groupId: -1, colourIndex: 9}),
    track('group', '2-Group', {trackId: '17', groupId: -1}), track('midi', 'Bass', {trackId: '13', groupId: 17, arrangementClips: [{name: 'Line', kind: 'midi', start: 0, end: 8}]}),
    track('audio', 'Drums', {trackId: '8', groupId: -1, arrangementClips: [{name: 'Break', kind: 'audio', start: 0, end: 4}]}), track('master', 'Master')]}
  const calls = []
  const set = liveSetTrackAdapter.project({set: summary2, document: document2, colors: ['#111111', '#222222', '#333333', '#444444', '#555555'],
    mixerWrite: async () => ({}), act: act => { calls.push(act); return Promise.resolve({act: act.kind, done: `The owner did ${act.kind}.`, at: null, revision: 'sha256:3'}) }})
  return {set: {...set, actions: {...set.actions, owner: 'kernel · live-set, the open set\'s owner'}}, calls}
}

test('a track wears the set\'s own colour and stands under its group, read from the owner', () => {
  const {set} = grouped()
  assert.equal(set.tracks[0].color, '#5480E4', 'Keys keeps Live\'s colour 9')
  assert.equal(set.tracks[3].color, '#444444', 'a track the set gives no colour wears the shell\'s')
  assert.equal(set.tracks[1].kind, 'group')
  assert.deepEqual([set.tracks[2].parentId, set.tracks[2].depth], [ref(1), 1], 'Bass stands under 2-Group')
  assert.equal(set.tracks[3].parentId, undefined)
})

test('Group, Split, Consolidate and the colour run as typed acts; an audio part\'s consolidate waits for a render', async () => {
  const {set, calls} = grouped()
  const a = set.actions
  await a.colourTrack.run(ref(3), '#FF94A6')
  assert.match((await a.colourTrack.run(ref(3), '#123456')).error, /not one of Live's 70/)
  await a.groupTracks.run([ref(3)])
  await a.splitClip.run(`${ref(2)}/clip/0`, 2)
  await a.consolidateClips.run(ref(2), {start: 1, end: 5})
  assert.equal(a.consolidateClips.refuses(ref(2)), undefined)
  assert.match(a.consolidateClips.refuses(ref(3)), /render/)
  assert.match((await a.consolidateClips.run(ref(3), {start: 0, end: 4})).error, /render/)
  assert.deepEqual(calls, [{kind: 'track_colour', track: 3, colour: 0}, {kind: 'tracks_group', tracks: [3]},
    {kind: 'clip_split', track: 2, clip: {arrangement: 0}, at: 2}, {kind: 'clips_consolidate', track: 2, from: 1, to: 5}])
})

test('Split stands where the insert marker is inside the clip, Consolidate where a time selection stands; each else says where to set it', () => {
  const {set, calls} = grouped()
  const clip = {kind: 'clip', id: `${ref(2)}/clip/0`, trackId: ref(2), name: 'Line'}
  const arrangement = (extra = {}) => context({view: 'arrangement', ...extra})
  set.clips.find(c => c.id === clip.id).at = {start: 0, end: 8}
  let items = acts.objectMenu(clip, set, arrangement())
  assert.match(byId(items, 'split').why, /Set the insert marker inside Line/)
  assert.match(byId(items, 'consolidate').why, /Select a stretch of the ruler/)
  // Crop is the set's own act (DLW build ruling 2026-11-05): with no selection over the clip, it keeps the clip's loop or its start to its end.
  assert.equal(byId(items, 'crop').disabled, undefined, byId(items, 'crop').why)
  byId(items, 'crop').onSelect('crop')
  assert.deepEqual(calls.at(-1), {kind: 'clip_crop', track: 2, clip: {arrangement: 0}})
  byId(acts.objectMenu(clip, set, arrangement({span: {start: 9, end: 12}})), 'crop').onSelect('crop')
  assert.deepEqual(calls.at(-1), {kind: 'clip_crop', track: 2, clip: {arrangement: 0}}, 'a selection off the clip is not its to keep')
  items = acts.objectMenu(clip, set, arrangement({marker: 8}))
  assert.equal(byId(items, 'split').disabled, true, 'a marker at the clip\'s end is not inside it')
  items = acts.objectMenu(clip, set, arrangement({marker: 3, span: {start: 1, end: 5}}))
  byId(items, 'split').onSelect('split')
  byId(items, 'consolidate').onSelect('consolidate')
  byId(items, 'crop').onSelect('crop')
  assert.deepEqual(calls.slice(-3), [{kind: 'clip_split', track: 2, clip: {arrangement: 0}, at: 3}, {kind: 'clips_consolidate', track: 2, from: 1, to: 5},
    {kind: 'clip_crop', track: 2, clip: {arrangement: 0}, from: 1, to: 5}], 'Crop keeps the selection over the clip')
  const drums = {kind: 'clip', id: `${ref(3)}/clip/0`, trackId: ref(3), name: 'Break'}
  assert.match(byId(acts.objectMenu(drums, set, arrangement({span: {start: 0, end: 4}})), 'consolidate').why, /render/)
  const track = acts.objectMenu({kind: 'track', id: ref(3), name: 'Drums'}, set, context())
  byId(track, 'group').onSelect('group')
  assert.deepEqual(calls.at(-1), {kind: 'tracks_group', tracks: [3]})
})

// REPLACES "row launch, record here and track delete stay dimmed in Live, each naming what it waits for": a row launches (O-I #743).
test('record here and track delete stay dimmed in Live, each naming what it waits for; a row\'s Launch, where no player is handed in, waits for none', () => {
  const {set} = grouped()
  const armed = {...set, tracks: set.tracks.map((t, i) => i === 2 ? {...t, mix: {...t.mix, arm: true}} : t)}
  const row = byId(acts.objectMenu({kind: 'row', id: 'scene:0', name: '1'}, set, context()), 'launch')
  assert.equal(row.disabled, true)
  assert.match(row.why, /missing op: row\.launch \(kernel · live-set, the open set's owner\)\.$/, 'the set read with no player names the op, and no build it waits for')
  assert.match(byId(acts.objectMenu(slot(2, 0, 'Bass'), armed, context()), 'record').why, /slot\.record .* It waits for a recording path/)
  assert.match(byId(acts.objectMenu({kind: 'track', id: ref(3), name: 'Drums'}, set, context()), 'delete').why, /track\.remove .* It waits for the decode of how Live re-routes/)
})

// O-I #743: a row's Launch is Live's scene launch, on a player of each part (live/clipPlayer.ts launchRow). A row launches only what is in
// it (§21.1): each part's clip in the row, and the stop of each empty slot that keeps one; a slot whose stop the set removed is not of it.
test('a row\'s Launch hands the clip player what the row holds on each part: its clips by kind, and the empty slots that keep their stop', async () => {
  const {set, calls} = liveSet()
  const item = byId(acts.objectMenu({kind: 'row', id: 'scene:1', name: 'Dawn'}, set, context()), 'launch')
  assert.equal(item.disabled, undefined, item.why)
  assert.match(set.actions.launchStop.op, /launchRow/)
  calls.length = 0
  await item.onSelect()
  assert.deepEqual(calls, [{launchRow: [1, [{track: 1, kind: 'stop'}, {track: 2, kind: 'stop'}]]}],
    'Estuary\'s slot in Dawn has its stop removed, so the row leaves it; Market hall and Tide pad stop; the Main track has no slot')
  calls.length = 0
  await set.actions.launchStop.run('scene:0')
  assert.deepEqual(calls, [{launchRow: [0, [{track: 0, kind: 'stop'}, {track: 1, kind: 'stop'}, {track: 2, name: 'Swell', kind: 'midi'}]]}])
  assert.match((await set.actions.launchStop.run('scene:9')).error, /not a row of this set/)
  const unread = liveSetTrackAdapter.project({set: summary, document: null, play: {launch: async () => ({ok: true, note: ''}), stop: () => ({ok: true, note: ''}),
    stopAll: () => ({ok: true, note: ''}), launchRow: async () => { throw new Error('not reached') }}})
  assert.deepEqual(await unread.actions.launchStop.run('scene:0'), {ok: false, error: 'The set\'s slots are not read yet, so the row has nothing to launch.'})
})

// O-I #743: Consolidate on an audio part — the engine renders its clips alone across the stretch and the set's owner keeps the sample
// beside the set as the clip that plays it (live/liveWrites.ts writeLiveAudioConsolidate, the host's live_engine_consolidate).
test('an audio part\'s Consolidate is the engine\'s render of its clips kept beside the set, answered in the owner\'s words', async () => {
  const calls = []
  const summary2 = {...summary, tracks: [...summary.tracks.slice(0, 3), {kind: 'audio', name: 'Drums', devices: []}, summary.tracks[3]]}
  const document2 = {...document, tracks: [...document.tracks.slice(0, 3), track('audio', 'Drums', {trackId: '8', arrangementClips: [{name: 'Break', kind: 'audio', start: 0, end: 4}]}), document.tracks[3]]}
  const project = consolidateAudio => liveSetTrackAdapter.project({set: summary2, document: document2, act: async a => { calls.push(a); return {act: a.kind, done: 'ok', at: null, revision: 'r'} },
    consolidateAudio})
  const set = project((track, span) => { calls.push({consolidateAudio: [track, span]}); return Promise.resolve({act: 'clips_consolidate',
    done: 'Consolidated 1 audio clip between beat 0 and beat 4 into one, 2 seconds of sound written beside the set as Samples/Processed/Consolidate/Break [0123456789abcdef].wav.',
    at: {track: 3, arrangement: 0}, revision: 'r2', unplayed: ['Drums: its clip \'Fill\' is warped, and the engine plays unwarped clips first: it is silent']}) })
  const drums = {kind: 'clip', id: `${ref(3)}/clip/0`, trackId: ref(3), name: 'Break'}
  const item = byId(acts.objectMenu(drums, set, context({view: 'arrangement', span: {start: 0, end: 4}})), 'consolidate')
  assert.equal(item.disabled, undefined, item.why)
  const answer = await set.actions.consolidateClips.run(ref(3), {start: 0, end: 4})
  assert.deepEqual(calls, [{consolidateAudio: [3, {start: 0, end: 4}]}], 'the engine\'s render, not the set\'s typed act')
  assert.deepEqual(answer, {ok: true, note: 'Consolidated 1 audio clip between beat 0 and beat 4 into one, 2 seconds of sound written beside the set as Samples/Processed/Consolidate/Break [0123456789abcdef].wav. Drums: its clip \'Fill\' is warped, and the engine plays unwarped clips first: it is silent'})
  const refused = await project(() => Promise.reject(new Error('No clip of Drums sounds between beat 8 and beat 9 in the engine'))).actions.consolidateClips.run(ref(3), {start: 8, end: 9})
  assert.deepEqual(refused, {ok: false, error: 'No clip of Drums sounds between beat 8 and beat 9 in the engine'})
  assert.match(byId(acts.objectMenu(drums, project(undefined), context({view: 'arrangement', span: {start: 0, end: 4}})), 'consolidate').why, /render/,
    'a set read with no engine handed in still waits for its render')
  // O-I #849 round 21: the engine playing the set lays the consolidated sample from the next block; refused, its words follow the owner's
  const stale = 'The set\'s parts are not those the engine opened: Stop, then Play, to hear it as it now stands'
  const kept = engine => project(() => Promise.resolve({act: 'clips_consolidate', done: 'Consolidated 1 audio clip.', at: null, revision: 'r3', engine}))
    .actions.consolidateClips.run(ref(3), {start: 0, end: 4})
  assert.deepEqual(await kept({refused: stale}), {ok: true, note: `Consolidated 1 audio clip. ${stale}`})
  assert.deepEqual(await kept({laid: ['Drums']}), {ok: true, note: 'Consolidated 1 audio clip.'}, 'laid again, the sound says it')
  const {readFile} = await import('node:fs/promises')
  const writes = await readFile(new URL('../src/live/liveWrites.ts', import.meta.url), 'utf8')
  assert.match(writes, /invoke<LiveSetActed>\('live_engine_consolidate', \{path, expectedRevision: expected_revision, track, from: span\.start, to: span\.end\}\)/,
    'the host renders and the kernel\'s owner keeps, against the revision read')
  assert.match(writes, /consolidateAudio: \(track: number, span: \{start: number; end: number\}\) => writeLiveAudioConsolidate\(path, track, span\)/)
})

// DLW build ruling 2026-11-05: Crop on an audio clip is a new sample — the host cuts the stretch of the clip's sample it keeps and the set's
// owner keeps the cut beside the set (live/liveWrites.ts writeLiveAudioCrop, the host's live_engine_crop); with no host handed in, it waits.
test('an audio clip\'s Crop is the host\'s cut of its sample kept beside the set; a MIDI clip\'s is the set\'s own act', async () => {
  const calls = []
  const summary2 = {...summary, tracks: [...summary.tracks.slice(0, 3), {kind: 'audio', name: 'Drums', devices: []}, summary.tracks[3]]}
  const document2 = {...document, tracks: [...document.tracks.slice(0, 3), track('audio', 'Drums', {trackId: '8', arrangementClips: [{name: 'Break', kind: 'audio', start: 0, end: 4}]}), document.tracks[3]]}
  const project = cropAudio => liveSetTrackAdapter.project({set: summary2, document: document2, act: async a => { calls.push(a); return {act: a.kind, done: 'Cropped Ebb to its loop: 4 beats, 0 notes kept.', at: null, revision: 'r'} },
    cropAudio})
  const set = project((track, clip, span) => { calls.push({cropAudio: [track, clip, span]}); return Promise.resolve({act: 'clip_crop',
    done: 'Cropped Break to the selection: 2 beats, 1 second of sound written beside the set as Samples/Processed/Crop/Break [0123456789abcdef].wav.',
    at: {track: 3, arrangement: 0}, revision: 'r2'}) })
  const drums = {kind: 'clip', id: `${ref(3)}/clip/0`, trackId: ref(3), name: 'Break'}
  set.clips.find(c => c.id === drums.id).at = {start: 0, end: 4}
  const item = byId(acts.objectMenu(drums, set, context({view: 'arrangement', span: {start: 1, end: 3}})), 'crop')
  assert.equal(item.disabled, undefined, item.why)
  const answer = await set.actions.cropClip.run(drums.id, {start: 1, end: 3})
  assert.deepEqual(calls, [{cropAudio: [3, {arrangement: 0}, {start: 1, end: 3}]}], 'the host\'s cut, not the set\'s typed act')
  assert.deepEqual(answer, {ok: true, note: 'Cropped Break to the selection: 2 beats, 1 second of sound written beside the set as Samples/Processed/Crop/Break [0123456789abcdef].wav.'})
  await set.actions.cropClip.run(`${ref(2)}/clip/0`, null)
  assert.deepEqual(calls.at(-1), {kind: 'clip_crop', track: 2, clip: {arrangement: 0}}, 'a MIDI clip is cropped by the set\'s own act')
  const refused = await project(() => Promise.reject(new Error('Break names no sample file: there is no sound to crop'))).actions.cropClip.run(drums.id, null)
  assert.deepEqual(refused, {ok: false, error: 'Break names no sample file: there is no sound to crop'})
  // O-I #849 round 21: the engine playing the set lays the cut from the next block; refused, its words follow the owner's
  const stale = 'The set\'s parts are not those the engine opened: Stop, then Play, to hear it as it now stands'
  const kept = engine => project(() => Promise.resolve({act: 'clip_crop', done: 'Cropped Break to its start and end: 4 beats.', at: null, revision: 'r3', engine}))
    .actions.cropClip.run(drums.id, null)
  assert.deepEqual(await kept({refused: stale}), {ok: true, note: `Cropped Break to its start and end: 4 beats. ${stale}`})
  assert.deepEqual(await kept({laid: ['Drums']}), {ok: true, note: 'Cropped Break to its start and end: 4 beats.'}, 'laid again, the sound says it')
  const waits = await project(undefined).actions.cropClip.run(drums.id, null)
  assert.match(waits.error, /Cropping an audio clip writes a new sample of what it keeps: the desktop host cuts it/, 'a set read with no host handed in says so')
  const {readFile} = await import('node:fs/promises')
  const writes = await readFile(new URL('../src/live/liveWrites.ts', import.meta.url), 'utf8')
  assert.match(writes, /invoke<LiveSetActed>\('live_engine_crop', \{path, expectedRevision: expected_revision, track, clip, from: span\?\.start \?\? null, to: span\?\.end \?\? null\}\)/)
  assert.match(writes, /cropAudio: \(track: number, clip: LiveClipAt, span: \{start: number; end: number\} \| null\) => writeLiveAudioCrop\(path, track, clip, span\)/)
})

// O-I #849 round 21: a bar is the set's, read from its time signature, not four beats: the ruler counts bar.beat by it (a beat is the
// signature's note), and Insert clip makes an empty clip one bar of it long.
test('the ruler counts bars and beats by the set\'s time signature, and Insert clip makes a clip one bar of it long', async () => {
  const lengths = []
  const project = signature => liveSetTrackAdapter.project({set: summary, document: {...document, ...(signature ? {signature} : {})},
    act: async a => ({act: a.kind, done: 'ok', at: null, revision: 'r'}),
    insertClip: (track, scene, beats) => { lengths.push(beats); return Promise.resolve({name: ''}) }})
  const label = signature => at => project(signature).ruler.label(at)
  assert.deepEqual([0, 3, 4, 7.5].map(label(undefined)), ['1.1', '1.4', '2.1', '2.4'], 'no signature read: Live\'s 4/4')
  assert.deepEqual([0, 2, 3, 5.99].map(label({numerator: 3, denominator: 4})), ['1.1', '1.3', '2.1', '2.3'])
  assert.deepEqual([0, 0.5, 1.5, 3, 4.5].map(label({numerator: 6, denominator: 8})), ['1.1', '1.2', '1.4', '2.1', '2.4'], 'a beat of 6/8 is an eighth')
  assert.deepEqual([0.3, 0.6, 2.1].map(label({numerator: 7, denominator: 8})), ['1.1', '1.2', '1.5'])
  await project({numerator: 3, denominator: 4}).actions.insertClip.run(ref(2), 'scene:1')
  await project(undefined).actions.insertClip.run(ref(2), 'scene:1')
  assert.deepEqual(lengths, [3, 4], 'one bar of the set')
  const {readFile} = await import('node:fs/promises')
  const writes = await readFile(new URL('../src/live/liveWrites.ts', import.meta.url), 'utf8')
  assert.match(writes, /insertClip: \(track: number, scene: number, beats\?: number\) => writeLiveInsertClip\(path, track, scene, beats\)/)
  assert.match(writes, /length: beats, notes: \[\]/, 'the kernel makes the clip as long as the bar asked')
})

test('the Arrangement draws its time selection over the marks and through the lanes', async () => {
  const React = await import('react')
  const {renderToStaticMarkup} = await import('react-dom/server')
  const {ArrangementRulerView} = await import('../src/frame/tracks/ArrangementRuler.tsx')
  const {set} = grouped()
  const noop = () => {}
  const html = renderToStaticMarkup(React.createElement(ArrangementRulerView, {set, selection: {select: noop}, receipt: null, onPress: noop, onDismiss: noop,
    view: {window: null, onWindow: noop, snap: 'free', onSnap: noop, marker: 1, onMarker: noop, span: {start: 1, end: 5}, onSpan: noop, width: 0}}))
  assert.match(html, /class="tl-span" role="img" aria-label="Selected · /)
  assert.ok((html.match(/class="tl-span"/g) ?? []).length > 1, 'the band runs through the lanes too')
})

// O-I #855 round 6d: a take Record laid exports its audio as it was played (live/liveTake.ts exportTake, the frame's render-take), from the
// clip's own menu in Arrangement view, where the take lies.
test('a take\'s clip exports its audio from its menu in Arrangement view, through the set\'s Export Audio act', async () => {
  const calls = []
  const set = liveSetTrackAdapter.project({set: summary, document, act: async a => ({act: a.kind, done: 'ok', at: null, revision: 'r'}),
    exportTake: (track, at) => { calls.push([track, at]); return Promise.resolve({ok: true, note: 'Exported Ebb as “Ebb.wav”.'}) }})
  const a = set.actions
  assert.ok(a.exportTake, 'carried where the set hands in its Export Audio')
  assert.match(a.exportTake.op, /render-take/)
  const clip = {kind: 'clip', id: `${ref(2)}/clip/0`, trackId: ref(2), name: 'Ebb'}
  const items = acts.objectMenu(clip, set, context({view: 'arrangement'}))
  const item = byId(items, 'export-audio')
  assert.equal(item.label, 'Export Audio')
  assert.equal(item.disabled, undefined)
  await item.onSelect()
  assert.deepEqual(calls, [[2, {arrangement: 0}]])
  assert.equal(byId(acts.objectMenu(clip, set, context({view: 'session'})), 'export-audio'), undefined, 'a take lies in Arrangement view')
  assert.equal(byId(acts.objectMenu(clip, liveSet().set, context({view: 'arrangement'})), 'export-audio'), undefined, 'a set with no Export Audio lists none')
  assert.match((await a.exportTake.run(`als:/sets/other.als#track/2/clip/0`)).error, /another set/)
})

// O-I #855 round 26 ("A Live part placed under an Expression's scenes sounds on its ruler, and the field answers it"): a take's clip is
// placed under the presented Expression's scene from its own menu, in Arrangement view (from its clip's start) and in a slot (from its
// beat 0), through the set's Place Under Scene act (live/liveTake.ts placeLiveTake).
test('a take\'s clip is placed under the scene from its menu, in either view, through the set\'s Place Under Scene act', async () => {
  const calls = []
  const set = liveSetTrackAdapter.project({set: summary, document, act: async a => ({act: a.kind, done: 'ok', at: null, revision: 'r'}),
    placeTake: (track, at) => { calls.push([track, at]); return Promise.resolve({ok: true, note: 'Ebb lies under the scene on its take lane, from sample 0.'}) }})
  const a = set.actions
  assert.ok(a.placeTake, 'carried where the set hands in its Place Under Scene')
  assert.match(a.placeTake.op, /render-take .*record_torus_take/)
  const clip = {kind: 'clip', id: `${ref(2)}/clip/0`, trackId: ref(2), name: 'Ebb'}
  const item = byId(acts.objectMenu(clip, set, context({view: 'arrangement'})), 'place-under-scene')
  assert.equal(item.label, 'Place Under Scene')
  assert.equal(item.disabled, undefined)
  await item.onSelect()
  assert.deepEqual(calls, [[2, {arrangement: 0}]])
  const slot = {kind: 'clip', id: `${ref(2)}/slot/1`, trackId: ref(2), name: 'Ebb'}
  await byId(acts.objectMenu(slot, set, context({view: 'session'})), 'place-under-scene').onSelect()
  assert.deepEqual(calls, [[2, {arrangement: 0}], [2, {slot: 1}]], 'a take in a slot, from its beat 0')
  assert.equal(byId(acts.objectMenu(clip, liveSet().set, context({view: 'arrangement'})), 'place-under-scene'), undefined, 'a set with no Place Under Scene lists none')
  assert.match((await a.placeTake.run(`als:/sets/other.als#track/2/clip/0`)).error, /another set/)
})

// O-I #852 (manual §21.2 "Drag it onto a part to play it"): a kept sound dropped on the empty track plays on a new part — Live's Insert
// MIDI Track (`track_insert`, packages/live-set/src/acts.rs) after the last part, then the sound opened on the Torus and kept by that part.
test('a kept sound dropped on the empty track plays on a new part: the part inserted, then the sound opened on it', async () => {
  const {TORUS_KEPT_MIME} = await import('../src/frame/instruments.ts')
  const SOUND = 'sha256:' + '1'.repeat(64)
  const calls = []
  const DONE = {track_insert: 'Inserted 4-MIDI, an empty MIDI part, right after Tide pad.', rack_place: 'Placed Warm rack on 4-MIDI: an Instrument Rack with 1 macro and 2 variations, its chain holding Live\'s Reverb and Compressor.'}
  const project = (refuse = null, unopened = null, refused = 'track_insert') => liveSetTrackAdapter.project({set: summary, document,
    act: act => { calls.push(act); return refuse && act.kind === refused ? Promise.reject(new Error(refuse)) : Promise.resolve({act: act.kind, done: DONE[act.kind], at: {track: 3}, revision: 'sha256:2'}) },
    openSound: (soundRef, track) => { calls.push({open: [soundRef, track]}); return Promise.resolve(unopened ? {ok: false, error: unopened} : {ok: true, note: '"Low bell" opens as saved; nothing it was tuned from has moved. The part keeps it.'}) }})
  const seat = project().actions.seat
  assert.equal(seat.accepts, TORUS_KEPT_MIME)
  assert.match(seat.op, /live_set_act · track_insert[^]*live_set_act · rack_place/, 'the part, and a rack placed on it')
  assert.deepEqual(await seat.run(JSON.stringify({kind: 'sound', ref: SOUND})),
    {ok: true, note: 'Inserted 4-MIDI, an empty MIDI part, right after Tide pad. "Low bell" opens as saved; nothing it was tuned from has moved. The part keeps it.'})
  assert.deepEqual(calls, [{kind: 'track_insert', after: null}, {open: [SOUND, 3]}], 'after the last part, then opened on the part it made')
  calls.length = 0
  // A sound made on an instrument opens on the form's body it was saved on; an instrument plays the first sound made on it.
  const FOLD = 'sha256:' + '2'.repeat(64)
  assert.equal((await seat.run(JSON.stringify({kind: 'sound', ref: FOLD, instrument_ref: 'instrument:fold'}))).ok, true)
  assert.equal((await seat.run(JSON.stringify({kind: 'instrument', ref: 'instrument:fold', sound: FOLD}))).ok, true)
  assert.deepEqual(calls, [{kind: 'track_insert', after: null}, {open: [FOLD, 3]}, {kind: 'track_insert', after: null}, {open: [FOLD, 3]}])
  calls.length = 0
  // O-I #852 round 9: a rack is placed on the new part in Live's own rack shape (packages/live-set/src/acts.rs `rack_place`): an Instrument
  // Rack under its name with its macros where they stand and its variations, then its Torus opens the sound it opens with. What the shell
  // has no shape for yet is said in words: its chain's note devices and effects (no Live device stands for them) and what its macros turn
  // (Live 12 keeps a macro's mapping in a form not read yet, racks-session-model.md §1.7).
  // Round 10: the rack's chain stands on it as Live's own devices: each of the Torus's effects as Live's device of its kind (manual §21.5),
  // taking the settings the engine reads Live's device by (O-I #849 round 15; packages/live-dynamics/src/params.rs, the corpus's surface), and
  // On as it was kept. A device with no Live surface in the corpus stays off the chain, by name.
  const placing = {name: 'Warm rack', chain: [{device_ref: 'arp', role: 'note', state: {}},
    {device_ref: 'reverb', role: 'effect', state: {on: true, size: 50, decay: 2.4, damping: 40, predelay: 20, mix: 22}},
    {device_ref: 'dynamics', role: 'effect', state: {on: false, threshold: -12, ratio: 4, attack: 1, release: 100, makeup: 2}},
    {device_ref: 'resonator', role: 'effect', state: {on: true, division: 300}}, {device_ref: 'echo', role: 'effect', state: {feedback: 0.4}}],
    macros: [{name: 'Bloom', value: 0.5, targets: [{device_ref: 'torus', parameter: 'damping', min: 0.1, max: 40}]}], variations: [{name: 'Open', values: [1]}, {name: 'Closed', values: [0]}]}
  const rack = await seat.run(JSON.stringify({kind: 'rack', ref: 'rack:warm', sound: SOUND, rack: placing}))
  assert.deepEqual(calls, [{kind: 'track_insert', after: null},
    {kind: 'rack_place', track: 3, name: 'Warm rack', macros: [{name: 'Bloom', value: 0.5}], variations: [{name: 'Open', values: [1]}, {name: 'Closed', values: [0]}],
      chain: [{device: 'Reverb', parameters: [{id: 'On', value: 1}, {id: 'DecayTime', value: 2400}, {id: 'PreDelay', value: 20}]},
        {device: 'Compressor2', parameters: [{id: 'On', value: 0}, {id: 'Threshold', value: 10 ** (-12 / 20)}, {id: 'Ratio', value: 4},
          {id: 'Attack', value: 1 / 3.562350828929603}, {id: 'Release', value: 100}, {id: 'Gain', value: 2}, {id: 'Knee', value: 0}]}]},
    {open: [SOUND, 3]}], 'the part, then the rack on it with its chain, then its sound')
  assert.deepEqual(rack, {ok: true, note: 'Inserted 4-MIDI, an empty MIDI part, right after Tide pad. Placed Warm rack on 4-MIDI: an Instrument Rack with 1 macro and 2 '
    + 'variations, its chain holding Live\'s Reverb and Compressor. "Low bell" opens as saved; nothing it was tuned from has moved. The part keeps it. '
    + 'Its note device arp stays off its chain: the corpus gives Live\'s note devices no parameter surface yet. '
    + 'Its Resonator bank stays off its chain: the corpus gives Live\'s Resonators no parameter surface yet. '
    + 'Its effect echo is none of the Torus\'s, so no Live device stands for it. '
    + 'Live\'s Reverb takes its decay and pre-delay; its size, damping and mix stand at Live\'s own, for the corpus pins no stored setting of Live\'s with their meaning and unit. '
    + 'What its macros turn is not mapped (Bloom turns the Torus\'s damping): Live 12 keeps a macro\'s mapping in a form not read here yet.'})
  calls.length = 0
  // A setting off the range Live's device holds stands at its nearer edge, and says so (round 15, as the engine's host stands it).
  const short = {...placing, chain: [{device_ref: 'reverb', role: 'effect', state: {decay: 2.4, predelay: 0}}], macros: [{...placing.macros[0], targets: []}]}
  const shortNote = (await seat.run(JSON.stringify({kind: 'rack', ref: 'rack:warm', sound: SOUND, rack: short}))).note
  assert.deepEqual(calls[1].chain, [{device: 'Reverb', parameters: [{id: 'DecayTime', value: 2400}, {id: 'PreDelay', value: 0.5}]}])
  assert.match(shortNote, /Live's Reverb takes its decay and pre-delay; its pre-delay of 0 ms is under the 0\.5 ms Live's Reverb holds, and stands there\.$/)
  calls.length = 0
  // O-I #849 round 15: every key the engine maps stands on Live's device as the engine reads it (the host's torus_chain carries the same):
  // the Filter's cutoff as a pitch, its resonance and drive; the Dynamics' threshold as a level, its ratio, its attack over the law, its release
  // and makeup, a hard knee; the Delay's time on both sides, free, linked, not ping-pong, its feedback, its tone through its filter, its mix; the
  // Reverb's decay and pre-delay. What Live's device does not hold stands at its edge; a menu and what the surface keeps no setting for stand at
  // Live's own, each in words.
  const mapped = {...placing, chain: [
    {device_ref: 'filter', role: 'effect', state: {on: true, type: 'notch', cutoff: 20000, resonance: 40, drive: 6, mix: 60}},
    {device_ref: 'dynamics', role: 'effect', state: {on: true, threshold: -30, ratio: 10, attack: 0.02, release: 250, makeup: 8}},
    {device_ref: 'delay', role: 'effect', state: {on: true, sync: true, division: '1', time: 250, feedback: 35, tone: 6000, mix: 25, tempo: 40}},
    {device_ref: 'filter', role: 'effect', state: {on: true, type: 'lowpass', cutoff: 440, resonance: 20, drive: 0, mix: 100}},
  ], macros: [{...placing.macros[0], targets: []}]}
  const mappedNote = (await seat.run(JSON.stringify({kind: 'rack', ref: 'rack:warm', sound: SOUND, rack: mapped}))).note
  assert.deepEqual(calls[1].chain, [
    {device: 'AutoFilter', parameters: [{id: 'On', value: 1}, {id: 'Cutoff', value: 135}, {id: 'Resonance', value: 0.4}, {id: 'Drive', value: 6}]},
    {device: 'Compressor2', parameters: [{id: 'On', value: 1}, {id: 'Threshold', value: 10 ** (-30 / 20)}, {id: 'Ratio', value: 10},
      {id: 'Attack', value: 0.009999999776}, {id: 'Release', value: 250}, {id: 'Gain', value: 8}, {id: 'Knee', value: 0}]},
    {device: 'Delay', parameters: [{id: 'On', value: 1}, {id: 'DelayLine_TimeL', value: 5}, {id: 'DelayLine_TimeR', value: 5}, {id: 'Feedback', value: 0.35},
      {id: 'Filter_Frequency', value: 6000}, {id: 'DryWet', value: 0.25}, {id: 'DelayLine_Link', value: 1}, {id: 'DelayLine_PingPong', value: 0},
      {id: 'DelayLine_SyncL', value: 0}, {id: 'DelayLine_SyncR', value: 0}, {id: 'Filter_On', value: 1}]},
    {device: 'AutoFilter', parameters: [{id: 'On', value: 1}, {id: 'Cutoff', value: 69}, {id: 'Resonance', value: 0.2}, {id: 'Drive', value: 0}]}])
  for (const said of [
    'Live\'s Auto Filter takes its cutoff, resonance and drive; its cutoff of 20000 Hz is over the 19912.1 Hz Live\'s Auto Filter holds, and stands there; '
      + 'its notch type stands at Live\'s own, the low-pass: Live\'s Auto Filter keeps its FilterType as a menu, and a menu\'s stored shape is not written here yet; '
      + 'its mix of 60 % stands at full: the corpus\'s surface of Live\'s Auto Filter keeps no dry/wet.',
    'Live\'s Compressor takes its threshold, ratio, attack, release and makeup; its attack of 0.02 ms is under the 0.0356 ms Live\'s Compressor holds, and stands there.',
    'Live\'s Delay takes its time, feedback, tone and mix; its time of 6 s is over the 5 s Live\'s Delay holds, and stands there.',
  ]) assert.ok(mappedNote.includes(said), `${said}\n in: ${mappedNote}`)
  assert.equal(mappedNote.match(/Live's Auto Filter takes/g).length, 1, 'a low-pass filter at full, within what Live holds, says nothing')
  calls.length = 0
  // a free Delay's time is its own
  const free = {...mapped, chain: [{device_ref: 'delay', role: 'effect', state: {on: false, sync: false, division: '1/8', time: 180, feedback: 70, tone: 2000, mix: 50, tempo: 120}}]}
  const freeNote = (await seat.run(JSON.stringify({kind: 'rack', ref: 'rack:warm', sound: SOUND, rack: free}))).note
  assert.deepEqual(calls[1].chain[0].parameters.slice(0, 3), [{id: 'On', value: 0}, {id: 'DelayLine_TimeL', value: 0.18}, {id: 'DelayLine_TimeR', value: 0.18}])
  assert.doesNotMatch(freeNote, /Live's Delay/, 'all of it stands on Live\'s Delay')
  calls.length = 0
  // A rack with nothing on its chain and macros that turn nothing is placed whole, and the note says nothing more.
  const bare = await seat.run(JSON.stringify({kind: 'rack', ref: 'rack:warm', sound: SOUND, rack: {...placing, chain: [], macros: [{...placing.macros[0], targets: []}]}}))
  assert.deepEqual(calls[1].chain, [], 'an empty chain is placed empty')
  assert.equal(bare.note, 'Inserted 4-MIDI, an empty MIDI part, right after Tide pad. Placed Warm rack on 4-MIDI: an Instrument Rack with 1 macro and 2 variations, '
    + 'its chain holding Live\'s Reverb and Compressor. "Low bell" opens as saved; nothing it was tuned from has moved. The part keeps it.')
  calls.length = 0
  // The rack refused on the part: the part stands, the sound is not opened, and the owner's words follow (packages/live-set/src/acts.rs
  // says them words first, so a part Live names by its place, "4-MIDI", stays in the open line).
  const held = 'A rack is placed on a part with nothing on its chain, as Insert MIDI Track makes one, and 4-MIDI holds a device already'
  assert.deepEqual(await project(held, null, 'rack_place').actions.seat.run(JSON.stringify({kind: 'rack', ref: 'rack:warm', sound: SOUND, rack: placing})),
    {ok: false, error: `Inserted 4-MIDI, an empty MIDI part, right after Tide pad. The rack was not placed on it. ${held}.`})
  assert.deepEqual(calls.map(call => call.kind ?? 'open'), ['track_insert', 'rack_place'], 'nothing opened on a part the rack is not on')
  calls.length = 0
  assert.match((await seat.run(JSON.stringify({kind: 'instrument', ref: 'instrument:fold'}))).error, /no sound made on it/)
  assert.match((await seat.run(JSON.stringify({kind: 'rack', ref: 'rack:warm', rack: placing}))).error, /opens no sound/)
  assert.match((await seat.run(JSON.stringify({kind: 'rack', ref: 'rack:warm', sound: SOUND}))).error, /kept sound/, 'a rack that does not say what it is')
  assert.match((await seat.run('Low bell')).error, /kept sound/)
  assert.deepEqual(calls, [], 'refused before the set\'s owner')
  // A refusal speaks plainly (shared/Refusal.tsx refusalWords): what happened first, then the owner's words when they are words.
  assert.deepEqual(await project('The set changed since it was read').actions.seat.run(JSON.stringify({kind: 'sound', ref: SOUND})),
    {ok: false, error: 'No part was made for the sound. The set changed since it was read.'})
  assert.deepEqual(calls, [{kind: 'track_insert', after: null}], 'no part made, nothing opened')
  calls.length = 0
  assert.deepEqual(await project(null, 'Error: native owner busy; the Torus was not kept').actions.seat.run(JSON.stringify({kind: 'sound', ref: SOUND})),
    {ok: false, error: 'Inserted 4-MIDI, an empty MIDI part, right after Tide pad. The sound did not open on it. Native owner busy; the Torus was not kept.'})
  assert.deepEqual((await project(null, 'TypeError: Cannot read properties of undefined (reading \'restore\')').actions.seat.run(JSON.stringify({kind: 'sound', ref: SOUND}))).error,
    'Inserted 4-MIDI, an empty MIDI part, right after Tide pad. The sound did not open on it.', 'a runtime fault is no reason, and stays out of the line')
  assert.equal(liveSet().set.actions.seat, undefined, 'with no opener handed in, nothing is seated')
})

// O-I #852 (manual §21.2 To use the Torus, 9: the rack "opens with its macros where they stood"): the rack's drop hands the opener the rack
// it placed, so the Torus's Macros page opens with its macros and variations (live/LivePresets.tsx playKeptSoundOn); a sound or an
// instrument hands none.
test('a kept rack dropped on the empty track opens its sound with the rack it placed, so the Torus\'s face opens with its macros', async () => {
  const SOUND = 'sha256:' + '1'.repeat(64), opened = []
  const seat = liveSetTrackAdapter.project({set: summary, document,
    act: act => Promise.resolve({act: act.kind, done: `${act.kind}.`, at: {track: 3}, revision: 'sha256:2'}),
    openSound: (...given) => { opened.push(given); return Promise.resolve({ok: true, note: 'Opened.'}) }}).actions.seat
  const placing = {name: 'Warm rack', chain: [], macros: [{name: 'Bloom', value: 0.5, targets: [{device_ref: 'torus', parameter: 'damping', min: 0.1, max: 40}]}],
    variations: [{name: 'Open', values: [1]}]}
  assert.equal((await seat.run(JSON.stringify({kind: 'rack', ref: 'rack:warm', sound: SOUND, rack: placing}))).ok, true)
  assert.equal((await seat.run(JSON.stringify({kind: 'sound', ref: SOUND}))).ok, true)
  assert.equal((await seat.run(JSON.stringify({kind: 'instrument', ref: 'instrument:fold', sound: SOUND}))).ok, true)
  assert.deepEqual(opened, [[SOUND, 3, placing], [SOUND, 3, undefined], [SOUND, 3, undefined]], 'the rack with its sound; a sound or an instrument alone')
  const writes = await readFile(new URL('../src/live/liveWrites.ts', import.meta.url), 'utf8')
  assert.match(writes, /openSound: \(soundRef: string, track: number, rack\?: TorusRackPlacing\) => import\('\.\/LivePresets'\)\.then\(presets => presets\.playKeptSoundOn\(path, track, soundRef, undefined, rack\)\),/,
    'the candidate opens the rack\'s face with its sound')
})
