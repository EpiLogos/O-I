import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'
import {modeSetOf, setClip, setTrack} from './support/modeSetFixture.mjs'

// Factory's Set as the window draws it (O-I #1004): the kernel builds it from the World Model's sessions, factory and workcells slices
// (kernel mode_set.rs, whose own tests lay out what each slice gives) and the one projection draws it (frame/tracks/kernelSet.ts), so the
// Session and Arrangement show the Agent sessions under their space, Factory's task on the session that executes it, a task no session
// executes on its Run's track, the attempts as takes, and each workcell as a return track. The Set below is the one the kernel's
// `factory_lays_sessions_as_tracks_tasks_on_the_session_that_runs_them_and_attempts_as_takes` builds, as data (FIXTURE: its shape is
// the kernel's; the reading is not). Loader as f3-tracks.test.mjs.
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
const {factoryTaskRef, parseFactoryTaskRef} = await import('../src/timeline/factoryTrackAdapter.ts')
const {kernelSetTracks} = await import('../src/frame/tracks/kernelSet.ts')
const {SessionGrid} = await import('../src/inhabitants/catalogue/panels/dlw__session-grid.tsx')
const {placeClips} = {...await import('../src/frame/tracks/ArrangementRuler.tsx'), ...await import('../src/inhabitants/catalogue/panels/dlw__arrangement-ruler.tsx')}

const at = text => Date.parse(text)
const SELECT = {select() {}}
const span = (start, end) => ({start_unix_ms: at(start), ...(end ? {end_unix_ms: at(end)} : {})})
const kernelSet = modeSetOf({
  owner: 'Factory and AIKit · the Agent sessions, Factory\'s tasks and their attempts',
  ruler: {kind: 'clock', unit: 'seconds', origin_unix_ms: at('2026-11-13T09:00:00Z')},
  rows: [1, 2, 3, 4].map(n => ({id: `batch:${n}`, name: String(n)})),
  tracks: [
    setTrack('space:a:space:a', 'Chat', {kind: 'a SessionSpace of the root register', color: '#79b6ce'}),
    setTrack('space:a:session:1', 'Answer', {kind: 'an Agent session · its agent agent:x', depth: 1, parent: 'space:a:space:a', color: '#779dcc'}),
    setTrack('factory:run:run:01', 'Run 01', {kind: 'a Factory Run · active'}),
    setTrack('workcell:env-1', 'env-1', {kind: 'workcell', returns: true, read_only: true}),
  ],
  clips: [
    setClip('space:a:session:1#task/1', 'space:a:session:1', 'batch:1', 'inspect-source', {subject: 'task:t', status: 'done',
      at: span('2026-11-13T10:00:00Z', '2026-11-13T10:20:00Z')}),
    setClip('factory:run:run:01#task/1', 'factory:run:run:01', 'batch:1', 'Task u', {subject: 'task:u', status: 'waiting', at: span('2026-11-13T09:00:00Z')}),
  ],
  takes: [
    {id: 'factory:attempt:attempt:1', clip: 'space:a:session:1#task/1', track: 'space:a:session:1', name: 'inspect-source · take 1', state: 'failed',
      at: span('2026-11-13T10:00:00Z', '2026-11-13T10:05:00Z'), words: 'failed', run: 'run:01', unit: 'workflow-unit:inspect-source'},
    {id: 'factory:attempt:attempt:2', clip: 'space:a:session:1#task/1', track: 'space:a:session:1', name: 'inspect-source · take 2', state: 'returned', standing: true,
      at: span('2026-11-13T10:10:00Z', '2026-11-13T10:20:00Z'), words: 'returned: Done', run: 'run:01', unit: 'workflow-unit:inspect-source'},
  ],
  main: {name: 'Main', chain: ['Gateways', 'Experiment', 'Approvals', 'Ledger', 'Link']},
})
const NOW = at('2026-11-13T11:00:00Z')
const set = kernelSetTracks(kernelSet, {nowMs: NOW})

test('the sessions are tracks under their space, a Run\'s own task on its track, each workcell a return track; the ids are the kernel\'s', () => {
  assert.deepEqual(set.tracks.map(track => [track.id, track.name, track.depth ?? 0, track.parentId ?? null, track.returns ?? false]), [
    ['space:a:space:a', 'Chat', 0, null, false], ['space:a:session:1', 'Answer', 1, 'space:a:space:a', false],
    ['factory:run:run:01', 'Run 01', 0, null, false], ['workcell:env-1', 'env-1', 0, null, true]])
  assert.deepEqual(set.columns.map(column => column.id), ['batch:1', 'batch:2', 'batch:3', 'batch:4'], 'never fewer than four batch rows')
  assert.deepEqual(set.main, {name: 'Main', chain: ['Gateways', 'Experiment', 'Approvals', 'Ledger', 'Link']})
  const markup = renderToStaticMarkup(React.createElement(SessionGrid, {set, selection: SELECT}))
  for (const name of ['Chat', 'Answer', 'Run 01', 'inspect-source', 'Task u']) assert.match(markup, new RegExp(name), `${name} is drawn`)
})

test('task clip ids name their session track, and only that', () => {
  for (const clip of set.clips) {
    assert.deepEqual(parseFactoryTaskRef(clip.id), {trackId: clip.trackId, n: 1})
    assert.ok(set.tracks.some(track => track.id === clip.trackId))
  }
  assert.deepEqual(parseFactoryTaskRef(factoryTaskRef('a#b:c', 12)), {trackId: 'a#b:c', n: 12}, 'a ref with its own # still parses')
  for (const bad of ['', 'plain', '#task/1', 's:x#task/0', 's:x#task/1.5', 's:x#task/']) assert.equal(parseFactoryTaskRef(bad), null, bad)
})

test('on the clock ruler a task lies from its first attempt to its last return, its attempts as takes under it and on its track\'s take lane', () => {
  const task = set.clips.find(clip => clip.id === 'space:a:session:1#task/1')
  assert.deepEqual(task.at, {start: 3600, end: 4800}, 'seconds from the earliest instant, 09:00')
  assert.equal(task.status, 'done')
  assert.deepEqual(task.takes, [{id: 'factory:attempt:attempt:1', name: 'inspect-source · take 1'}, {id: 'factory:attempt:attempt:2', name: 'inspect-source · take 2', standing: true}])
  assert.deepEqual(set.lanes.takes.map(lane => [lane.id, lane.trackId, lane.spans[0].start, lane.spans[0].end, lane.of]), [
    ['factory:attempt:attempt:1', 'space:a:session:1', 3600, 3900, {runRef: 'run:01', unitRef: 'workflow-unit:inspect-source'}],
    ['factory:attempt:attempt:2', 'space:a:session:1', 4200, 4800, {runRef: 'run:01', unitRef: 'workflow-unit:inspect-source'}]])
  const waiting = set.clips.find(clip => clip.id === 'factory:run:run:01#task/1')
  assert.deepEqual(waiting.at, {start: 0}, 'a task with no attempt returned has no length')
  assert.equal(set.ruler.unit, 'seconds')
  assert.equal(set.ruler.end, 7200, 'the ruler reaches now, and no further')
  assert.equal(set.ruler.label(0), new Date(at('2026-11-13T09:00:00Z')).toTimeString().slice(0, 8), 'the ruler is labelled with the clock')
  assert.deepEqual(placeClips(set).placed.find(placed => placed.clip.id === task.id), {clip: task, start: 3600, end: 4800}, 'the shared ruler lays it where it ran')
})

test('a slice the Set could not read stands as its track, saying why in its owner\'s words; nothing reads as an empty success', () => {
  const unread = kernelSetTracks(modeSetOf({tracks: [setTrack('factory:runs', 'Factory', {kind: 'Factory\'s runs, tasks and attempts',
    absent: 'Factory\'s runs are unread: no Factory state in scope'})]}), {nowMs: NOW})
  assert.equal(unread.tracks[0].kind, 'Factory\'s runs, tasks and attempts · Factory\'s runs are unread: no Factory state in scope')
  assert.deepEqual(unread.clips, [])
})

test('a session Factory ran a task on carries Run, Stop and End session, and the empty track seats an agent of the census by its slug', async () => {
  // FIXTURE: the acts as the kernel's Set carries them (kernel mode_set.rs
  // `a_session_factory_ran_a_task_on_is_its_track_with_its_end_stop_and_run_and_the_set_seats_an_agent`): each Action by its id and input.
  const state = '/w/Central/Work/atelier/.factory/development-state.json'
  const track = 'session-space/atelier-chat-1:agent-session/atelier-chat-1'
  const act = (action, input, words, done, takes) => ({action, input, words, done, ...(takes ? {takes} : {})})
  const sessionSet = modeSetOf({owner: 'Factory and AIKit · the Agent sessions, Factory\'s tasks and their attempts',
    tracks: [setTrack(track, 'codex · atelier', {kind: 'an Agent session · its agent codex', acts: {
      stopTrack: act('factory.task.stop', {state, run_ref: 'run:b', attempt_ref: 'attempt:b'},
        'Factory\'s factory.task.stop: the running task paused (AIKit cancels the turn); pressed again, its attempt cancelled',
        'codex · atelier\'s task is stopped: paused, or cancelled when it was paused already.'),
      endSession: act('factory.session.end', {world: '/w/Central', project: 'atelier', session: 'agent-session/atelier-chat-1'},
        'Factory\'s factory.session.end: the session ended — a running turn stopped, its record closed, its body released',
        'codex · atelier\'s session has ended: its record is closed.')}})],
    clips: [setClip(`${track}#task/1`, track, 'batch:1', 'Keep notes', {subject: 'task:a', acts: {
      launch: act('factory.task.run', {state, run_ref: 'run:a', session: 'agent-session/atelier-chat-1'},
        'Factory\'s factory.task.run: the task run on its session under your grant, its log streaming, its end an attempt with its diff',
        'Task task:a is running on its session.')}}),
    setClip(`${track}#task/2`, track, 'batch:2', 'Keep more notes', {subject: 'task:b', status: 'running'})],
    acts: {seat: act('factory.session.start', {world: '/w/Central', project: 'atelier'},
      'Factory\'s factory.session.start: the agent seated on a new track in atelier, its session opened in the checkout atelier\'s workcell seat holds and its record opened',
      'The agent is seated on a new track in atelier: its session is open.', 'agent')},
  })
  const asked = []
  const runner = {act: async (action, input, project) => { asked.push([action, input, project]); return {state: 'open'} }, shell: async () => ({ok: false, error: 'no setter'})}
  const a = kernelSetTracks(sessionSet, {nowMs: NOW, runner}).actions
  assert.match(a.launch.op, /^Factory's factory\.task\.run/)
  assert.deepEqual(await a.launch.run(`${track}#task/1`), {ok: true, note: 'Task task:a is running on its session.'})
  assert.match((await a.launch.run(`${track}#task/2`)).error, /its owner gives it none/, 'a running task does not launch again')
  assert.deepEqual(await a.stopTrack.run(track), {ok: true, note: 'codex · atelier\'s task is stopped: paused, or cancelled when it was paused already.'})
  assert.deepEqual(await a.endSession.run(track), {ok: true, note: 'codex · atelier\'s session has ended: its record is closed.'})
  // The seat: an agent dropped from the browser (the chain's agent payload); a census row's ref gives the census slug.
  const drop = (family, ref) => JSON.stringify({family, ref, label: ref})
  assert.equal(a.seat.accepts, 'application/x-oi-agent-chain-item')
  assert.deepEqual(await a.seat.run(drop('agent', 'harness:codex')), {ok: true, note: 'The agent is seated on a new track in atelier: its session is open.'})
  await a.seat.run(drop('agent', 'agent:roster-nara'))
  assert.match((await a.seat.run(drop('skillset', 'skill-set:foundation'))).error, /Only an agent takes a seat here/)
  assert.match((await a.seat.run('not json')).error, /Only an agent takes a seat here/, 'a drop that is no agent is refused before Factory is asked')
  assert.deepEqual(asked, [
    ['factory.task.run', {state, run_ref: 'run:a', session: 'agent-session/atelier-chat-1'}, undefined],
    ['factory.task.stop', {state, run_ref: 'run:b', attempt_ref: 'attempt:b'}, undefined],
    ['factory.session.end', {world: '/w/Central', project: 'atelier', session: 'agent-session/atelier-chat-1'}, undefined],
    ['factory.session.start', {world: '/w/Central', project: 'atelier', agent: 'codex'}, undefined],
    ['factory.session.start', {world: '/w/Central', project: 'atelier', agent: 'agent:roster-nara'}, undefined],
  ], 'each the Set\'s Action with its input; the seat\'s with the agent the drop named')
  // A seat that takes something other than an agent is no agent drop; a Set with no seat act seats nothing.
  const worldSeat = modeSetOf({acts: {seat: act('central.today.seat', {}, 'a world into today', 'In today.', 'world')}})
  assert.equal(kernelSetTracks(worldSeat, {nowMs: NOW, runner}).actions.seat, undefined)
  assert.equal(kernelSetTracks(modeSetOf(), {nowMs: NOW, runner}).actions.seat, undefined)

  // End session on the track's menu (manual §19.1 "End session, on the track's menu, ends it"), where the Set seats a session on it.
  globalThis.document.documentElement ??= {}
  const menus = await import('../src/frame/menu/objectActions.ts')
  const presses = []
  const context = {view: 'session', binding: null, press: (key, what, run) => { presses.push([key, what]); return run() }, rename: () => {}, writeClip: async () => ({ok: true})}
  const drawn = kernelSetTracks(sessionSet, {nowMs: NOW, runner})
  const menu = menus.objectMenu({kind: 'track', id: track, name: 'codex · atelier'}, drawn, context)
  const end = menu.find(item => item.id === 'end-session')
  assert.ok(end && !end.disabled, 'End session is on the track\'s menu')
  await end.onSelect()
  assert.deepEqual(presses.at(-1), [`end:${track}`, 'End codex · atelier\'s session'])
  assert.deepEqual(asked.at(-1)[0], 'factory.session.end')
  const bare = menus.objectMenu({kind: 'track', id: 'space:a:session:1', name: 'Answer'}, set, context)
  assert.equal(bare.find(item => item.id === 'end-session'), undefined, 'a track the Set seats no session on lists no End session')
})
