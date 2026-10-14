import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'

// FOUNDATION F3, Factory's adapter: the agent sessions as tracks, helpers railed beneath their lead, tasks as clips drawn by
// state, the batch rows, the needles, and an actions port that exists only where the owner's path does. Loader as
// f3-tracks.test.mjs.
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
const {readFile} = await import('node:fs/promises')
const model = await import('../src/agent/agentRunModel.ts')
const {factoryTrackAdapter, factoryTaskRef, parseFactoryTaskRef, FACTORY_TRACK_PALETTE, FACTORY_MIN_BATCH_ROWS, FACTORY_STOP_OP, FACTORY_LAUNCH_OP, FACTORY_BATCH_OP, FACTORY_RETRY_OP, FACTORY_SEAT_OP, FACTORY_GRAIN}
  = await import('../src/timeline/factoryTrackAdapter.ts')
const {SessionGrid} = await import('../src/frame/tracks/SessionGrid.tsx')
const {ArrangementRuler, placeClips} = await import('../src/frame/tracks/ArrangementRuler.tsx')
const {useFactoryTracks} = await import('../src/frame/tracks/useFactoryTracks.ts')

const NOW = Date.UTC(2026, 9, 14, 12, 0, 0)
const AXIS_START = NOW - model.DEFAULT_AXIS_WINDOW_MS
const SELECT = {select() {}}

// The agency reading, through the run model's own builders: a group of two sessions, and a lone one.
const rows = [
  {spaceRef: 'space:port', spaceLabel: 'Port bridge-2', sessionRef: 'sess-lead', purpose: 'lead', agentRef: 'agent:fizz'},
  {spaceRef: 'space:port', spaceLabel: 'Port bridge-2', sessionRef: 'sess-test', purpose: null, agentRef: 'agent:tester'},
  {spaceRef: 'space:solo', spaceLabel: null, sessionRef: 'sess-solo-abcdefghijkl', purpose: null, agentRef: null},
]
const roster = new Map([['agent:fizz', {name: 'Fizz', accepted: true}], ['agent:tester', {name: 'Tester', accepted: true}]])
const reading = (purpose, state) => ({request: {central: {purpose, task_ref: `task:${purpose}`}}, state})
const activity = (sessionRef, ...agoSeconds) => agoSeconds.map(ago => ({subject_ref: `agency/${sessionRef}/tool.done`, instant_unix_ms: NOW - ago * 1000}))
const temporal = [...activity('sess-lead', 600, 20), ...activity('sess-test', 1500, 400)]
const axis = model.sharedAxis([], NOW)
const readings = {'sess-lead': reading('map field', 'running'), 'sess-test': reading('widget tests', 'stalled')}
const agencyTracks = () => model.buildTracks(rows, roster).map(track => track.group ? track : {
  ...track,
  tasks: model.buildTaskClips(readings[track.sessionRef] ?? null, temporal, track.sessionRef, NOW),
  needle: model.needleFor(temporal, track.sessionRef, axis),
})
const project = (tracks = agencyTracks(), controls) => factoryTrackAdapter.project({tracks, nowUnixMs: NOW, controls})
const blank = over => ({sessionRef: 'x', purpose: null, agentRef: null, agentName: null, agentAccepted: null, spaceRef: 's', spaceLabel: null,
  depth: 0, parentRef: null, group: false, memberRefs: [], tasks: [], needle: null, telemetryOn: true, budget: {used: null, max: null}, disclosure: null, ...over})
const task = (n, title, state, start = null, last = null) => ({n, title, state, startUnixMs: start, lastActivityUnixMs: last, softStop: false, disclosure: null})
const soft = n => ({n, title: null, state: 'unknown', startUnixMs: null, lastActivityUnixMs: null, softStop: true, disclosure: null})
const secs = unixMs => (unixMs - AXIS_START) / 1000
const sessionKey = ref => model.trackKey({spaceRef: rows.find(r => r.sessionRef === ref).spaceRef, sessionRef: ref})

test('sessions are tracks under their group: the ids are the selection\'s session keys, helpers step in with depth and parentId', () => {
  const tracks = agencyTracks()
  const set = project(tracks)
  assert.deepEqual(set.tracks.map(t => t.id), tracks.map(model.trackKey), 'a track id is trackKey(track): the ref THE selection holds for a session')
  const [group, lead, tester, soloGroup, solo] = set.tracks
  assert.deepEqual([group.kind, group.depth, group.parentId, group.name], ['group', 0, undefined, 'Port bridge-2'])
  assert.deepEqual([lead.kind, lead.depth, lead.parentId, lead.name], ['session', 1, group.id, 'lead'])
  assert.deepEqual([tester.depth, tester.parentId, tester.name], [1, group.id, 'Tester · sess-test'], 'no purpose: the agent and its session, as the grid names it')
  assert.deepEqual([soloGroup.name, solo.name, solo.parentId], ['space:solo', 'sess-solo-ab', soloGroup.id], 'no label and no agent: the space ref and the session ref\'s head')
  assert.deepEqual(set.tracks.map(t => t.color), set.tracks.map((_, i) => FACTORY_TRACK_PALETTE[i % FACTORY_TRACK_PALETTE.length]), 'the grid\'s palette, by position')
})

test('three layers of delegation: depth is the groups above a track, walked up the parent links; a cycle or a missing parent ends the walk', () => {
  const lead = blank({sessionRef: 'S1', spaceRef: 'S1', group: true, purpose: 'Programme'})
  const mid = blank({sessionRef: 'S2', spaceRef: 'S2', group: true, parentRef: 'S1', depth: 1, purpose: 'Crew'})
  const leaf = blank({sessionRef: 'leaf', spaceRef: 'S2', parentRef: 'S2', depth: 2, purpose: 'Helper'})
  const deep = project([lead, mid, leaf])
  assert.deepEqual(deep.tracks.map(t => [t.name, t.depth, t.parentId]), [['Programme', 0, undefined], ['Crew', 1, 'S1:S1'], ['Helper', 2, 'S2:S2']])
  const a = blank({sessionRef: 'A', spaceRef: 'A', group: true, parentRef: 'B'}), b = blank({sessionRef: 'B', spaceRef: 'B', group: true, parentRef: 'A'})
  assert.ok(project([a, b]).tracks.every(t => Number.isFinite(t.depth) && t.depth <= 2), 'a parent cycle terminates')
  const orphan = project([blank({sessionRef: 'o', spaceRef: 'o', parentRef: 'nowhere', depth: 1})]).tracks[0]
  assert.deepEqual([orphan.depth, orphan.parentId], [0, undefined], 'a parent the reading does not hold is no rail')
  const markup = renderToStaticMarkup(React.createElement(SessionGrid, {set: deep, selection: SELECT}))
  assert.equal((markup.match(/class="trk sub"/g) ?? []).length, 2, 'the shared grid draws the helpers railed beneath their lead')
  assert.match(markup, /data-track="S2:S2" data-depth="1"/); assert.match(markup, /data-track="S2:leaf" data-depth="2"/)
})

test('tasks are clips drawn by state: queued waits, running runs, done stops, stalled is striped, and an undisclosed state is not guessed', () => {
  const states = [task(1, 'plan', 'done', NOW - 900_000, NOW - 600_000), task(2, 'port', 'running', NOW - 500_000, NOW - 20_000),
    task(3, 'review', 'queued'), task(4, 'fixtures', 'stalled', NOW - 400_000, NOW - 300_000), task(5, 'mystery', 'unknown'), soft(6)]
  const set = project([blank({sessionRef: 'a', spaceRef: 'sp', purpose: 'Agent', tasks: states})])
  assert.deepEqual(set.clips.map(c => [c.label, c.state, c.status ?? null]),
    [['plan', 'done', 'stopped'], ['port', 'running', 'running'], ['review', 'queued', 'waiting'], ['fixtures', 'stalled', 'stalled'], ['mystery', 'unknown', null]])
  assert.equal(set.clips.length, 5, 'the trailing soft-stop slot is not a task')
  assert.equal('status' in set.clips[4], false, 'no owner state, no status')
  const grid = renderToStaticMarkup(React.createElement(SessionGrid, {set, selection: SELECT}))
  assert.match(grid, /data-clip-status="stalled"/); assert.match(grid, /class="cs clip stalled"/, 'the shared grid stripes the stalled clip')
  assert.match(grid, /class="cs clip waiting"/); assert.match(grid, /class="cs clip running"/); assert.match(grid, /class="cs clip stopped"/)
  assert.match(grid, /data-clip-status="undisclosed"/)
  assert.match(renderToStaticMarkup(React.createElement(ArrangementRuler, {set, selection: SELECT})), /class="tl-clip stalled"/, 'and the ruler stripes it too')
  const unlabelled = project([blank({sessionRef: 'b', spaceRef: 'sp', tasks: [task(1, null, 'running'), soft(2)]})])
  assert.equal(unlabelled.clips[0].label, 'task 1', 'a task with no title is named by its ordinal, as the grid names it')
})

test('on the ruler a stalled task is frozen where its output stopped, a running one reaches its needle, a queued one has no length, an undisclosed one no place', () => {
  const set = project()
  const [, lead, tester] = set.tracks
  const running = set.clips.find(c => c.trackId === lead.id), stalled = set.clips.find(c => c.trackId === tester.id)
  assert.deepEqual(running.at, {start: secs(NOW - 600_000), end: secs(NOW - 20_000)})
  assert.equal(running.at.end, lead.needle, 'a running task has no end of its own: its needle is its live edge')
  assert.deepEqual(stalled.at, {start: secs(NOW - 1_500_000), end: secs(NOW - 400_000)})
  assert.equal(stalled.at.end, tester.needle, 'a stalled task stops where its needle stopped')
  const odd = project([blank({sessionRef: 'a', spaceRef: 'sp', tasks: [task(1, 'q', 'queued'), task(2, 'no start', 'running', null, NOW - 30_000), task(3, 'u', 'unknown'), soft(4)]})])
  const [queued, noStart, unknown] = odd.clips
  assert.deepEqual(queued.at, {start: model.DEFAULT_AXIS_WINDOW_MS / 1000}, 'a queued task is a point at the live edge')
  assert.equal('end' in queued.at, false, 'no length at all')
  assert.deepEqual(noStart.at, {start: 0, end: secs(NOW - 30_000)}, 'no start disclosed: it draws from the axis edge, as the run viewer does')
  assert.equal(unknown.at, undefined)
  const placed = placeClips(set).placed
  assert.deepEqual(placed.find(p => p.clip.id === stalled.id), {clip: stalled, start: stalled.at.start, end: stalled.at.end}, 'the shared ruler lays a task where it ran')
  assert.ok(placeClips(set).end >= lead.needle, 'and its ruler reaches the live needle')
  assert.equal(set.ruler.unit, 'seconds')
  assert.equal(set.ruler.label(0), new Date(AXIS_START).toTimeString().slice(0, 8), 'the ruler is labelled with the clock')
})

test('a needle per thread at its last activity: a live one at the edge, a stalled one left behind, none for a group or a thread idle in the window', () => {
  const set = project()
  const needled = set.tracks.filter(t => t.needle !== undefined)
  assert.deepEqual(needled.map(t => t.name), ['lead', 'Tester · sess-test'])
  const [, lead, tester] = set.tracks
  assert.equal(lead.needle, secs(NOW - 20_000)); assert.equal(tester.needle, secs(NOW - 400_000))
  assert.ok(tester.needle < lead.needle, 'a needle that stopped moving sits behind the live one')
  assert.equal(set.tracks[0].needle, undefined, 'a group has no thread of its own'); assert.equal(set.tracks[4].needle, undefined, 'idle in the window: no needle')
  const markup = renderToStaticMarkup(React.createElement(ArrangementRuler, {set, selection: SELECT}))
  assert.equal((markup.match(/class="tl-needle"/g) ?? []).length, 2, 'the shared ruler draws one needle per thread that has one')
  // The axis is the provider's: a needle carries the window it was read in, and the set keeps to it whatever clock it is handed.
  const later = factoryTrackAdapter.project({tracks: agencyTracks(), nowUnixMs: NOW + 3_600_000})
  assert.deepEqual(later.tracks.map(t => t.needle), set.tracks.map(t => t.needle))
})

test('the batch rows: the n-th task of every session, one trailing row for the soft-stop slot, never fewer than the shipped four', () => {
  const set = project()
  assert.deepEqual(set.columns.map(c => c.id), ['batch:1', 'batch:2', 'batch:3', 'batch:4'])
  assert.equal(set.columns.length, FACTORY_MIN_BATCH_ROWS)
  assert.deepEqual(set.clips.map(c => c.columnId), ['batch:1', 'batch:1'], 'each session\'s one bound task is its first row')
  const long = project([blank({sessionRef: 'a', spaceRef: 'sp', tasks: [1, 2, 3, 4, 5].map(n => task(n, `t${n}`, 'done', NOW - 1000, NOW - 500)).concat([soft(6)])})])
  assert.deepEqual(long.columns.map(c => c.name), ['1', '2', '3', '4', '5', '6'], 'five tasks: five rows and the empty slot after them')
  assert.equal(long.clips.every(c => c.columnId === `batch:${parseFactoryTaskRef(c.id).n}`), true)
  const markup = renderToStaticMarkup(React.createElement(SessionGrid, {set: long, selection: SELECT}))
  assert.equal((markup.match(/class="stop-launch"/g) ?? []).length, 6, 'a launcher per batch row on the Main column')
  assert.equal((markup.match(/data-clip="/g) ?? []).length, 5)
})

test('task clip ids name their session track, and only that', () => {
  const set = project()
  for (const clip of set.clips) {
    assert.deepEqual(parseFactoryTaskRef(clip.id), {trackId: clip.trackId, n: 1})
    assert.ok(set.tracks.some(t => t.id === clip.trackId))
  }
  assert.equal(new Set(set.clips.map(c => c.id)).size, set.clips.length)
  assert.equal(set.clips[0].trackId, sessionKey('sess-lead'))
  assert.deepEqual(parseFactoryTaskRef(factoryTaskRef('a#b:c', 12)), {trackId: 'a#b:c', n: 12}, 'a ref with its own # still parses')
  for (const bad of ['', 'plain', '#task/1', 's:x#task/0', 's:x#task/1.5', 's:x#task/']) assert.equal(parseFactoryTaskRef(bad), null, bad)
})

test('no controls handed in, no action: the grid is read-only and says so; no group clip, take or record either', () => {
  const set = project()
  assert.equal(set.actions, undefined)
  assert.equal(set.clips.some(c => 'takes' in c || 'launch' in c), false, 'no attempts and no launch timing are disclosed by the sessions reading')
  assert.equal(set.clips.some(c => c.trackId === set.tracks[0].id), false, 'a group carries no clips of its own')
  const markup = renderToStaticMarkup(React.createElement(SessionGrid, {set, selection: SELECT}))
  assert.match(markup, /aria-label="Launch map field" disabled=""/)
  assert.match(markup, /No launch: the owner discloses no launch for this clip/)
  assert.equal((markup.match(/class="stop-launch" disabled=""/g) ?? []).length, 4)
  assert.match(markup, /aria-label="Stop lead" disabled=""/)
})

test('with the owner\'s path, five actions name their ops and reach only harness_agent_control, and only for ids the set holds', async () => {
  const calls = []
  const answer = {ok: true, note: 'stop → state stopped'}
  const set = project(agencyTracks().concat([blank({sessionRef: 'many', spaceRef: 'sp-many', purpose: 'Many', tasks: [
    task(1, 'done one', 'done', NOW - 900_000, NOW - 800_000), task(2, 'live one', 'running', NOW - 90_000, NOW - 5_000),
    task(3, 'queued one', 'queued'), task(4, 'unread one', 'unknown'), soft(5)]})]), {control: async control => { calls.push(control); return answer }})
  assert.deepEqual(Object.keys(set.actions).filter(key => key !== 'grain').sort(), ['launch', 'launchStop', 'retry', 'seat', 'stopTrack'], 'no record: the owner has no capture path')
  assert.equal(set.actions.grain, 'whole harness', 'the grid says the grain on every control it applies to')
  const {AGENT_CHAIN_MIME, encodeChainDrag} = await import('../src/agent/agentChainDrag.ts')
  assert.equal(set.actions.seat.accepts, AGENT_CHAIN_MIME, 'the empty track takes what the agent browser drags')
  // The owner takes a binding and a control word, never an agent: the drop starts a NEW agent on the bound harness, and the
  // receipt names the one dragged without claiming it was seated.
  const seated = await set.actions.seat.run(encodeChainDrag({family: 'agent', ref: 'agent:codex', label: 'codex'}))
  assert.equal(seated.ok, true)
  assert.match(seated.note, /Dragged “codex” \(agent:codex\): started a NEW agent on the bound harness/, 'the dragged agent is named, and what happened is said')
  assert.match(seated.note, /not told which agent[\s\S]*carries no agent ref/, 'and that the harness was not told which')
  assert.ok(seated.note.endsWith(answer.note), 'the owner\'s own words close the receipt')
  assert.doesNotMatch(seated.note, /seated on|is seated|was seated/, 'nothing claims the dragged agent took the seat')
  assert.match(set.actions.seat.op, /starts a NEW agent/, 'the seat\'s op says what it does')
  assert.doesNotMatch(set.actions.seat.op, /the agent dropped, on the bound harness/, 'and no longer claims to carry the agent dropped')
  assert.equal((await set.actions.seat.run(encodeChainDrag({family: 'skillset', ref: 's', label: 's'}))).ok, false, 'anything else is refused, named')
  assert.equal((await set.actions.seat.run('not a drag')).ok, false)
  assert.deepEqual(calls.splice(0), ['new'], 'seating reached the owner once, as new')
  assert.match(set.actions.retry.op, /^whole harness · harness_agent_control:restart/)
  const retried = await set.actions.retry.run(sessionKey('sess-test'))
  assert.equal(retried.ok, true, 'a stalled lane restarts through the owner')
  assert.match(retried.note, /^Whole harness: Retry on “[^”]+” reached the bound harness, because the owner takes no session, task or row\./, 'its receipt says the harness, not the session, was reached')
  assert.ok(retried.note.endsWith(answer.note), 'then the owner\'s own words')
  assert.equal((await set.actions.retry.run('nope')).ok, false, 'an id the set does not hold is refused')
  assert.deepEqual(calls.splice(0), ['restart'], 'the retry reached the owner once, as restart; the counts below are the other actions\'')
  assert.deepEqual([set.actions.stopTrack.op, set.actions.launch.op, set.actions.launchStop.op, set.actions.retry.op, set.actions.seat.op], [FACTORY_STOP_OP, FACTORY_LAUNCH_OP, FACTORY_BATCH_OP, FACTORY_RETRY_OP, FACTORY_SEAT_OP])
  assert.equal(FACTORY_GRAIN, 'whole harness')
  for (const op of [FACTORY_STOP_OP, FACTORY_LAUNCH_OP, FACTORY_BATCH_OP, FACTORY_RETRY_OP]) {
    assert.ok(op.startsWith(`${FACTORY_GRAIN} · harness_agent_control:`), `${op}: leads with its grain, then the one owner op`)
    assert.match(op, /the owner takes no (session|task|row)/, `${op}: and says what the owner does not take`)
  }
  const byLabel = label => set.clips.find(c => c.label === label).id
  const { stopTrack, launch, launchStop } = set.actions

  const stopped = await stopTrack.run(sessionKey('sess-test'))
  assert.equal(stopped.ok, true)
  assert.match(stopped.note, /^Whole harness: Stop on “[^”]+” reached the bound harness, because the owner takes no session, task or row\. stop → state stopped$/, 'the owner\'s answer comes back in full, the grain said first')
  const groupStop = await stopTrack.run(set.tracks[0].id)
  assert.equal(groupStop.ok, true); assert.match(groupStop.note, /^Whole harness: Stop on “/, 'a group stops through the same owner op')
  assert.deepEqual(calls, ['stop', 'stop'])
  calls.length = 0
  const relaunched = await launch.run(byLabel('widget tests')); const resumed = await launch.run(byLabel('queued one'))
  assert.match(relaunched.note, /^Whole harness: Launch of “widget tests” reached the bound harness/); assert.match(resumed.note, /^Whole harness: Launch of “queued one” reached the bound harness/)
  assert.deepEqual(calls, ['restart', 'resume'], 'a stalled task retries, a queued one runs')
  calls.length = 0
  for (const label of ['done one', 'live one', 'unread one']) {
    const refusal = await launch.run(byLabel(label))
    assert.equal(refusal.ok, false); assert.match(refusal.error, /no op that launches a task in that state/)
  }
  assert.match((await launch.run(byLabel('unread one'))).error, /does not disclose/)
  assert.match((await launch.run(byLabel('done one'))).error, /finished/)
  assert.deepEqual(calls, [], 'a task with no owner op is refused before any owner call')
  const row = await launchStop.run('batch:1')
  assert.equal(row.ok, true); assert.match(row.note, /^Whole harness: Launch of row 1 reached the bound harness/); assert.deepEqual(calls, ['resume'])
  calls.length = 0
  for (const run of [() => stopTrack.run('not:a-track'), () => launch.run('not:a-clip'), () => launchStop.run('batch:99')]) {
    const refusal = await run(); assert.equal(refusal.ok, false)
  }
  assert.deepEqual(calls, [], 'an id the set does not hold reaches no owner')
  const markup = renderToStaticMarkup(React.createElement(SessionGrid, {set, selection: SELECT}))
  assert.doesNotMatch(markup, /aria-label="Launch [^"]*" disabled=""/); assert.doesNotMatch(markup, /class="stop-launch" disabled=""/)
  assert.match(markup, /Stop lead \(whole harness · harness_agent_control:stop/, 'the grid prints the grain in the control\'s title')
  assert.match(markup, /Retry lead \(whole harness · harness_agent_control:restart/)
  assert.match(markup, /Drop here to seat it on a new track \(harness_agent_control:new — starts a NEW agent/, 'and the seat says it starts a new agent')
})

test('a refusal by the owner keeps its grain too: the receipt names the harness, then the owner\'s words; a refused seat says no agent was seated', async () => {
  const refuse = {ok: false, error: 'the harness is not running'}
  const set = project(agencyTracks(), {control: async () => refuse})
  const { encodeChainDrag } = await import('../src/agent/agentChainDrag.ts')
  const stop = await set.actions.stopTrack.run(sessionKey('sess-test'))
  assert.equal(stop.ok, false); assert.match(stop.error, /^Whole harness: Stop on “[^”]+” reached the bound harness[\s\S]*the harness is not running$/)
  const seat = await set.actions.seat.run(encodeChainDrag({family: 'agent', ref: 'agent:codex', label: 'codex'}))
  assert.equal(seat.ok, false)
  assert.match(seat.error, /Dragged “codex” \(agent:codex\): the owner did not start a new agent on the bound harness \(no agent was seated\)\. the harness is not running$/)
})

test('no sessions, no tracks', () => {
  assert.deepEqual(project([]), {columns: [], tracks: [], clips: []})
})

test('the hook reads the one agency store and only the owner\'s control path; with no carrier it is waiting, never an empty claim', async () => {
  const out = {}
  const Probe = ({reading: published}) => { out.set = useFactoryTracks(published); return null }
  renderToStaticMarkup(React.createElement(Probe, {reading: {set: null, document: null, transport: {kind: 'unavailable', reason: 'no carrier'}}}))
  assert.match(out.set?.waiting ?? '', /agent sessions/, 'sessions unread: the pane says it is waiting')
  renderToStaticMarkup(React.createElement(Probe, {reading: {set: null, document: null}}))
  assert.match(out.set?.waiting ?? '', /agent sessions/, 'a reading with no carrier does not throw')
  const hook = await readFile(new URL('../src/frame/tracks/useFactoryTracks.ts', import.meta.url), 'utf8')
  assert.match(hook, /useAgencySessions\(transport\)/); assert.match(hook, /harnessAgentControl\(transport, harness\.binding, control\)/)
  assert.doesNotMatch(hook, /readAgency|readRoster|kernelOp|setInterval|fetch\(/, 'no second store and no owner call of its own beyond harness_agent_control')
  const adapter = await readFile(new URL('../src/timeline/factoryTrackAdapter.ts', import.meta.url), 'utf8')
  assert.doesNotMatch(adapter, /^import .*from '(react|[^']*kernel[^']*|[^']*harnessAgentControl[^']*)'/m, 'the adapter is pure: the owner call is handed in')
})
