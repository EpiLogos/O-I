import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'

// W4, the real readings reach what the grid and the ruler draw (timeline/worldTrackAdapter.ts ClipLaunch.mode, WorldTrackClip.progress,
// WorldTrackSet.loop):
// - Expressions (frame/tracks/modeTracks.ts nativeTracks → timeline/expressionsTrackAdapter.ts): the playing scene's progress from the
//   owner's playback reading (scene_elapsed_seconds over the length the scene plays), and the saved sequence's loop flag.
// - Factory (timeline/factoryTrackAdapter.ts, agent/agentRunModel.ts): a task's launch mode, follow and quantize from AIKit's
//   encounter-session-settings `task`, and its attempts as takes, each under its task_ref. No expected length: no progress.
// - Live (timeline/liveSetTrackAdapter.ts): its set read carries none of these, and none is drawn.
// Channels: FIXTURE readings in each owner's shape (expressions-boundary/src/scenes.ts, desktop/cradle/src/kernel/types.ts
// EncounterSessionSettingsReading, agent/factoryTakes.ts FactoryTake, the bound task record `aikit.encounter-task/v1`), projected
// through the adapters and SCRIPTED through the shared views to static markup. Not a screen pass.
// Loader as tracks-views.test.mjs.
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
const {nativeTracks} = await import('../src/frame/tracks/modeTracks.ts')
const {factoryTrackAdapter, factoryTaskLaunch} = await import('../src/timeline/factoryTrackAdapter.ts')
const model = await import('../src/agent/agentRunModel.ts')
const {liveSetTrackAdapter, LIVE_ACT_OP} = await import('../src/timeline/liveSetTrackAdapter.ts')
const {mixerCells} = await import('../src/frame/tracks/trackLanes.ts')
const {SessionGridView, emptySlotChoice} = await import('../src/frame/tracks/SessionGrid.tsx')
const {setSelectionOf} = await import('../src/shell/liveSelection.ts')
const {ArrangementRulerView} = await import('../src/frame/tracks/ArrangementRuler.tsx')

const noop = () => {}
const grid = set => renderToStaticMarkup(React.createElement(SessionGridView,
  {set, selection: {select: noop}, folded: {}, onFold: noop, receipt: null, onPress: noop, onDismiss: noop}))
const ruler = set => renderToStaticMarkup(React.createElement(ArrangementRulerView, {set, selection: {select: noop},
  view: {window: null, onWindow: noop, snap: 'free', onSnap: noop, marker: null, onMarker: noop, width: 0}, receipt: null, onPress: noop, onDismiss: noop}))

// ── Expressions ────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** FIXTURE: the open Expression as the native content holds it (shell/nativeContent.ts; expressions-boundary/src/scenes.ts). */
const content = ({playback = {}, loop = false, saved = true} = {}) => ({
  basis: {expression_ref: 'expression:w', scene_ref: 's1'},
  playback: {scene_ref: 's1', scene_playing: true, saved_sequence_playing: false, scene_elapsed_seconds: 3, ...playback},
  scenes: {loop, timing: {working: {available: true}, saved: saved ? {available: true} : {available: false, reason: 'no saved sequence'}},
    scenes: [
      {scene_ref: 's1', title: 'Opening', native_title: 'n1', working: {duration: 12, transition: 0}, snapshot: {duration: 10}, material: {available: true, reason: null}},
      {scene_ref: 's2', title: 'Second', native_title: 'n2', working: {duration: 4, transition: 0}, snapshot: {duration: null}, material: {available: true, reason: null}},
    ]},
})
const visual = set => set.clips.filter(clip => clip.id.endsWith(':visual'))

test('Expressions: the playing scene carries its progress as the owner reads it, on the length the scene plays', () => {
  const working = nativeTracks(content(), 'Work')
  assert.deepEqual(visual(working).map(clip => [clip.label, clip.status, clip.progress ?? null]),
    [['Opening', 'running', {elapsed: 3, expected: 12}], ['Second', 'stopped', null]], 'the working scene plays: its working length')
  assert.deepEqual(working.clips.find(clip => clip.id.endsWith('s1:audio')).progress, {elapsed: 3, expected: 12}, 'its sound lane carries the same reading')
  const saved = nativeTracks(content({playback: {saved_sequence_playing: true}}), 'Work')
  assert.deepEqual(visual(saved)[0].progress, {elapsed: 3, expected: 10}, 'the saved sequence plays: the saved snapshot\'s length')
  const unread = content({playback: {saved_sequence_playing: true, scene_ref: 's2'}})
  assert.equal(visual(nativeTracks(unread, 'Work'))[1].progress, undefined, 'a saved snapshot with no length read: no progress, none estimated')
  assert.equal(visual(nativeTracks(content({playback: {scene_playing: false}}), 'Work'))[0].progress, undefined, 'nothing plays: no progress')
  const noElapsed = content(); delete noElapsed.playback.scene_elapsed_seconds
  assert.equal(visual(nativeTracks(noElapsed, 'Work'))[0].progress, undefined, 'no elapsed read: no progress')
})

test('Expressions: the progress reaches the grid as the design\'s fill', () => {
  const markup = grid(nativeTracks(content(), 'Work'))
  assert.match(markup, /data-clip="scene:expression:w:s1:visual" data-clip-status="running" data-progress="25" title="Opening · Running · 25% through, as its owner reads it" style="--p:25"/)
  assert.doesNotMatch(markup, /data-clip="scene:expression:w:s2:visual"[^>]*data-progress/)
})

test('Expressions: the saved sequence\'s loop flag is the loop, whole, where a saved sequence stands; the ruler draws its brace', () => {
  const looped = nativeTracks(content({loop: true}), 'Work')
  assert.deepEqual(looped.loop, {start: 0}, 'the whole sequence, to the end of what the Arrangement lays')
  assert.match(ruler(looped), /<i class="tl-brace" data-loop="ruler" style="left:0%;width:100%" role="img" aria-label="Loop · 0 – 16 · its owner&#x27;s; set it where its owner sets it"><\/i>/)
  assert.equal(nativeTracks(content({loop: false}), 'Work').loop, undefined, 'the flag off: no loop')
  assert.equal(nativeTracks(content({loop: true, saved: false}), 'Work').loop, undefined, 'no saved sequence stands to loop: no loop')
  assert.doesNotMatch(ruler(nativeTracks(content(), 'Work')), /tl-brace/)
})

// ── Factory ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

const NOW = Date.parse('2026-10-22T14:00:00Z')
/** FIXTURE: one session whose bound task is running (the run model's own builder over the `aikit.encounter-task/v1` record). */
const sessionWith = taskReading => ({sessionRef: 'sess-lead', purpose: 'lead', agentRef: null, agentName: null, agentAccepted: null, spaceRef: 'space:port',
  spaceLabel: 'Port', depth: 1, parentRef: null, group: false, memberRefs: [], needle: null, telemetryOn: true, budget: {used: null, max: null}, disclosure: null,
  tasks: model.buildTaskClips(taskReading, [{subject_ref: 'sess-lead', instant_unix_ms: NOW - 30_000}, {subject_ref: 'sess-lead', instant_unix_ms: NOW - 300_000}], 'sess-lead', NOW)})
const bound = {state: 'running', request: {central: {purpose: 'map field → plan', task_ref: 'task:map'}}}
/** FIXTURE: AIKit's encounter-session-settings reading for the session (desktop/cradle/src/kernel/types.ts EncounterSessionSettingsReading). */
const settingsOf = task => ({of: () => ({telemetry: true, solo: false, task}), set: async () => ({ok: true})})
// REPLACED (#787): the task launched with hold and handed off to `tests`; AIKit speaks the manual's words and Hand off to is retired.
const ownTask = {task_ref: 'task:map', launch: 'gate', then: 'again', quantize: 'next-tool'}
/** FIXTURE: the attempts the session's tasks serve (agent/factoryTakes.ts FactoryTake). */
const attempt = (attemptRef, taskRef, receivingRef = null) => ({sessionRef: 'sess-lead', attemptRef, runRef: 'run:1', statePath: 's', taskRef, unit: 'inspect',
  state: receivingRef ? 'returned' : 'running', startUnixMs: NOW - 200_000, endUnixMs: null, summary: null, receivingRef})
const takesOf = list => ({of: () => list, choose: async () => ({ok: true})})
const project = extra => factoryTrackAdapter.project({tracks: [sessionWith(bound)], nowUnixMs: NOW, ...extra})

test('the run model keeps the bound task\'s own ref; a record that names only a purpose, and the soft-stop slot, carry none', () => {
  const clips = model.buildTaskClips(bound, [], 'sess-lead', NOW)
  assert.deepEqual(clips.map(clip => [clip.softStop, clip.taskRef ?? null]), [[false, 'task:map'], [true, null]])
  assert.equal(model.buildTaskClips({request: {central: {purpose: 'only a purpose'}}}, [], 'x', NOW)[0].taskRef, undefined)
})

test('Factory: a task\'s launch is its own settings on AIKit, in the owner\'s words, and only on the task they name', () => {
  assert.deepEqual(factoryTaskLaunch(ownTask), {mode: 'gate', follow: 'again', quantize: 'next tool'})
  assert.deepEqual(factoryTaskLaunch({task_ref: 't', launch: 'trigger', then: 'next', quantize: 'global'}), {mode: 'trigger', follow: 'next', quantize: 'global'},
    'the defaults AIKit states are its reading, and stand as read')
  const [clip] = project({settings: settingsOf(ownTask)}).clips
  assert.deepEqual([clip.label, clip.status, clip.launch], ['map field → plan', 'running', {mode: 'gate', follow: 'again', quantize: 'next tool'}])
  assert.equal(project({settings: settingsOf({...ownTask, task_ref: 'task:other'})}).clips[0].launch, undefined, 'settings for another task: none on this one')
  assert.equal(project({settings: settingsOf(null)}).clips[0].launch, undefined, 'the reading names no task: none')
  assert.equal(project({}).clips[0].launch, undefined, 'the settings unread: none')
})

test('Factory: the attempts a task serves stack under its clip, named as their lanes, the received one standing; no progress is drawn', () => {
  const set = project({settings: settingsOf(ownTask), takes: takesOf([attempt('a1', 'task:map'), attempt('a2', 'task:map', 'recv:1'), attempt('a3', 'task:other')])})
  const [clip] = set.clips, trackId = set.tracks[0].id
  assert.deepEqual(clip.takes, [{id: `${trackId}#take/a1`, name: 'inspect · take 1'}, {id: `${trackId}#take/a2`, name: 'inspect · take 2', standing: true}])
  assert.deepEqual(set.lanes.takes.filter(lane => lane.trackId === trackId).map(lane => lane.id).slice(0, 2), clip.takes.map(take => take.id), 'the same takes as its lanes')
  assert.equal(clip.progress, undefined, 'Factory reads no expected length for a task: no progress')
  const markup = grid(set)
  assert.match(markup, /<small class="cs-sub"><span class="cs-mode">gate<\/span> · <span class="cs-follow">→ again<\/span> · <span class="cs-takes">2 takes<\/span><\/small>/)
  assert.match(markup, /title="map field → plan · Running · plays gate · launches next tool · then again · 2 takes"/)
  assert.doesNotMatch(markup, /data-progress/)
  assert.equal(project({takes: takesOf([attempt('a3', 'task:other')])}).clips[0].takes, undefined, 'attempts for another task: none on this one')
})

// ── Live ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

test('Live: its set read carries no launch mode, no follow, no progress and no set loop, and none is drawn', () => {
  const summary = {path: '/sets/demo.als', tempo_bpm: 120, scene_count: 2, arrangement_clips: 1, tracks: [{kind: 'midi', name: 'Pad', devices: []}]}
  const document = {path: '/sets/demo.als', tempo: 120, scenes: 2, tracks: [
    {kind: 'midi', name: 'Pad', devices: [], arrangementClips: [{name: 'Intro', kind: 'midi', start: 0, end: 16}], sessionSlots: {'0': 'A'}}]}
  const set = liveSetTrackAdapter.project({set: summary, document})
  assert.ok(set.clips.length > 0)
  assert.ok(set.clips.every(clip => clip.launch === undefined && clip.progress === undefined && clip.takes === undefined))
  assert.equal(set.loop, undefined)
  assert.doesNotMatch(grid(set), /cs-sub|data-progress/)
})

// The walk of O-I 857, round 47 item 4 (DLW build ruling 2026-11-08): Live's small rules. A click on an empty slot chooses that slot, as THE
// selection names a Session slot; a return track draws no clip slots (O8).
test('Live: a click on an empty slot chooses it, and a return track draws no clip slots', () => {
  const summary = {path: '/sets/demo.als', tempo_bpm: 120, scene_count: 2, arrangement_clips: 0,
    tracks: [{kind: 'midi', name: 'Pad', devices: []}, {kind: 'return', name: 'A-Reverb', devices: []}]}
  const document = {path: '/sets/demo.als', tempo: 120, scenes: 2, tracks: [
    {kind: 'midi', name: 'Pad', devices: [], arrangementClips: [], sessionSlots: {'0': 'A'}},
    {kind: 'return', name: 'A-Reverb', devices: [], arrangementClips: [], sessionSlots: {}}]}
  const set = liveSetTrackAdapter.project({set: summary, document})
  const pad = set.tracks[0], reverb = set.tracks[1]
  assert.equal(reverb.returns, true, 'Live\'s return track is a return track of the views')
  const chosen = emptySlotChoice(set, pad, set.columns[1])
  assert.deepEqual(chosen, {kind: 'clip', ref: 'als:/sets/demo.als#track/0/slot/1', title: 'Pad · slot 2', track: 'als:/sets/demo.als#track/0'})
  assert.deepEqual(setSelectionOf({mode: 'live', kind: chosen.kind, ref: chosen.ref, title: chosen.title}, '/sets/demo.als'), {track: 0, scene: 1},
    'the choice is Live\'s own selection of that slot: the browser\'s and Insert clip\'s target')
  assert.equal(emptySlotChoice({}, pad, set.columns[1]), null, 'a set whose slots are no places of their own chooses none')
  const drawn = grid(set)
  assert.match(drawn, /data-slot-ref="als:\/sets\/demo.als#track\/0\/slot\/1"/, 'the empty slot carries what a click on it chooses')
  const returnCells = [...drawn.matchAll(/<div class="cs[^"]*" role="gridcell"[^>]*data-slot-track="als:\/sets\/demo.als#track\/1"[^>]*>(.*?)<\/div>/g)]
  assert.equal(returnCells.length, 2, 'one blank cell per row, so the rows stay in line')
  assert.ok(returnCells.every(cell => cell[1] === '' && !/data-slot-row|data-slot-ref/.test(cell[0])), 'no slot, no stop square, nothing chosen on a return')
  const selected = renderToStaticMarkup(React.createElement(SessionGridView,
    {set, selection: {ref: chosen.ref, select: noop}, folded: {}, onFold: noop, receipt: null, onPress: noop, onDismiss: noop}))
  assert.match(selected, /class="cs sel"[^>]*data-slot-ref="als:\/sets\/demo.als#track\/0\/slot\/1"/, 'the chosen slot is drawn selected')
})

// The walk of O-I 857, G18 (round 47 item 3): a part's Output is chosen from Main and the group it stands in, through the set's own act
// (live-set acts.rs track_output, the routing Group Tracks writes). Another part is offered as Live offers it, and refused in the owner's
// words.
test('Live: Output chooses Main or the part\'s group through the set\'s act, and another part is refused in the owner\'s words', async () => {
  const summary = {path: '/sets/demo.als', tempo_bpm: 120, scene_count: 1, arrangement_clips: 0, tracks: [{kind: 'group', name: 'Band', devices: []},
    {kind: 'audio', name: 'Drums', devices: []}, {kind: 'midi', name: 'Pad', devices: []}, {kind: 'master', name: 'Main', devices: []}]}
  const part = (kind, name, trackId, groupId, output) => ({kind, name, trackId, groupId, devices: [], arrangementClips: [], sessionSlots: {},
    takeLanes: [], automation: [], mixer: {output}})
  const document = {path: '/sets/demo.als', tempo: 120, scenes: 1, tracks: [part('group', 'Band', '20', -1, 'Main'),
    part('audio', 'Drums', '8', 20, 'Group'), part('midi', 'Pad', '9', -1, 'Main'), {...part('master', 'Main', '1', -1, undefined), mixer: undefined}]}
  const acted = []
  const act = async made => {
    acted.push(made)
    if (typeof made.to === 'object') throw new Error('Drums cannot be sent to Pad here: only Main and the part\'s own group are routings the set itself holds.')
    return {act: made.kind, done: made.to === 'main' ? 'Drums goes to Main.' : 'Drums goes to its group, Band.', at: {track: made.track}, revision: 'r2'}
  }
  const set = liveSetTrackAdapter.project({set: summary, document, act, mixerWrite: async () => {}})
  const drums = set.tracks[1], pad = set.tracks[2]
  assert.equal(set.mixer.output.disabled, undefined, 'Output is written by the set\'s act')
  assert.match(set.mixer.input.disabled, /routing is read from the set/, 'the input is still read')
  assert.equal(set.actions.mixer.output.op, LIVE_ACT_OP('track_output'))
  assert.deepEqual(set.actions.mixer.output.choices(drums.id), [{value: 'main', label: 'Main'}, {value: 'group', label: 'Group · Band', standing: true},
    {value: 'track:2', label: 'Pad'}])
  assert.deepEqual(set.actions.mixer.output.choices(pad.id).map(choice => choice.value), ['main', 'track:0', 'track:1'], 'a part in no group has no group to go to')
  assert.deepEqual(set.actions.mixer.output.choices(set.tracks[3].id), [], 'the Main track has no Output to choose')
  const out = mixerCells(set, drums, 1).find(cell => cell.id === 'output')
  assert.equal(out.choose.value, 'group'); assert.equal(out.choose.what('main'), 'Output Main for Drums')
  assert.deepEqual(await out.choose.run('main'), {ok: true, note: 'Drums goes to Main.'})
  assert.deepEqual(await out.choose.run('group'), {ok: true, note: 'Drums goes to its group, Band.'})
  assert.deepEqual(await out.choose.run('track:2'), {ok: false, error: 'Drums cannot be sent to Pad here: only Main and the part\'s own group are routings the set itself holds.'})
  assert.deepEqual(acted, [{kind: 'track_output', track: 1, to: 'main'}, {kind: 'track_output', track: 1, to: 'group'}, {kind: 'track_output', track: 1, to: {track: 2}}])
  assert.match((await out.choose.run('elsewhere')).error, /elsewhere is no Output of this part/)
  const drawn = grid(set)
  assert.match(drawn, /<select class="mx-choose" aria-label="Output: Group"><option value="main">Main<\/option><option value="group" selected="">Group · Band<\/option><option value="track:2">Pad<\/option><\/select>/,
    'the row draws Output as a chooser standing at the part\'s group')
  const read = liveSetTrackAdapter.project({set: summary, document, mixerWrite: async () => {}})
  assert.match(read.mixer.output.disabled, /routing is read from the set/, 'without the set\'s acts, Output is read')
  assert.doesNotMatch(grid(read), /mx-choose/)
})
