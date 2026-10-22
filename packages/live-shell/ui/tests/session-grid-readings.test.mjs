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
const {liveSetTrackAdapter} = await import('../src/timeline/liveSetTrackAdapter.ts')
const {SessionGridView} = await import('../src/frame/tracks/SessionGrid.tsx')
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
const ownTask = {task_ref: 'task:map', launch: 'hold', then: 'handoff', handoff_to: 'tests', quantize: 'next-tool'}
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
  assert.deepEqual(factoryTaskLaunch(ownTask), {mode: 'hold', follow: 'handoff to tests', quantize: 'next tool'})
  assert.deepEqual(factoryTaskLaunch({task_ref: 't', launch: 'once', then: 'next', handoff_to: null, quantize: 'global'}), {mode: 'once', follow: 'next', quantize: 'global'},
    'the defaults AIKit states are its reading, and stand as read')
  const [clip] = project({settings: settingsOf(ownTask)}).clips
  assert.deepEqual([clip.label, clip.status, clip.launch], ['map field → plan', 'running', {mode: 'hold', follow: 'handoff to tests', quantize: 'next tool'}])
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
  assert.match(markup, /<small class="cs-sub"><span class="cs-mode">hold<\/span> · <span class="cs-follow">→ handoff to tests<\/span> · <span class="cs-takes">2 takes<\/span><\/small>/)
  assert.match(markup, /title="map field → plan · Running · plays hold · launches next tool · then handoff to tests · 2 takes"/)
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
