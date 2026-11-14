// Lane BF2: Tasks (software-factory:tasks, DLW §19.1) and Runs (software-factory:attempt-review, §19.11) on their owners —
// src/agent/devices/taskBindings.ts, FactoryDeviceChain.tsx. Tasks reads the run model's tasks of the selected session (the
// sessions provider's agency, task-record and temporal reading), the session list the Thread offers, and the task THE selection
// names; its timing is the Agent's; a new task goes the Agent's way; Launch, Retry and Stop after address only the whole bound
// harness, so they stand disabled with that grain, and the per-task settings have no owner. Runs reads no attempts: no reading names
// the session's Factory run; Stands has no owner write.
//
// Channels:
// - FIXTURE: the sessions provider's tracks, shaped as agent/agentRunModel.ts builds them (TaskClip: n, title, state, start, last
//   activity, softStop) — the ports (an Agent write, a new-task queue, the selection) record their calls. No owner state is written.
// - SCRIPTED: the catalogue's two designs rendered through the runtime's host (deviceHost.HostedDevice) to static markup.
import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'
import {readFileSync} from 'node:fs'

const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};
import {readFile} from 'node:fs/promises';
export async function resolve(specifier,context,next){
  try{return await next(specifier,context)}catch(error){
    if(!specifier.startsWith('.'))throw error;
    if(specifier.endsWith('.js')){try{return await next(specifier.slice(0,-3)+'.ts',context)}catch{}}
    for(const suffix of ['.ts','.tsx','/index.ts','/index.tsx']){try{return await next(specifier+suffix,context)}catch{}}
    throw error;
  }
}
export async function load(url,context,next){
  if(url.endsWith('.css'))return {format:'module',shortCircuit:true,source:'export default null'};
  if(url.includes('?raw')||url.endsWith('.html'))return {format:'module',shortCircuit:true,source:'export default ""'};
  if(url.endsWith('.json'))return {format:'module',shortCircuit:true,source:'export default '+await readFile(new URL(url),'utf8')};
  if(url.endsWith('.ts')||url.endsWith('.tsx')){
    const source=await readFile(new URL(url).pathname,'utf8');
    const {outputText}=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX},fileName:url});
    return {format:'module',shortCircuit:true,source:outputText};
  }
  return next(url,context);
}`)}`, {parentURL: import.meta.url})

globalThis.document = {getElementById: () => null, createElement: () => ({}), head: {appendChild: () => {}}, documentElement: {}}
const {createElement} = await import('react')
const {renderToStaticMarkup} = await import('react-dom/server')
const {designKey} = await import('../src/frame/devices/designs.ts')
const host = await import('../src/frame/devices/deviceHost.tsx')
const bind = await import('../src/agent/devices/designBindings.ts')
const tasks = await import('../src/agent/devices/taskBindings.ts')
// The devices are of the families' admitted faces (lane BF3: the thread, tasks and attempt-review faces are admitted).
const familyDoor = await import('../src/inhabitants/familyManifest.ts')
familyDoor.resetFamilyManifestsForTest()
;(await import('../src/inhabitants/loadAgentShellFamilies.ts')).loadAgentShellFamilies()
;(await import('../src/inhabitants/worldShellFamilies.ts')).loadWorldShellFamilies()

const views = ['folded', 'compact', 'whole', 'full', 'widget']
const hosted = (designed, binding) => views.map(view => renderToStaticMarkup(createElement(host.HostedDevice, {designed, binding, view, nav: {}})))
const escaped = text => text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const NOW = 1_800_000_000_000
const clip = (n, over = {}) => ({n, title: null, state: 'unknown', startUnixMs: null, lastActivityUnixMs: null, softStop: false, disclosure: null, ...over})
const SESSION = {sessionRef: 'agent-session/fx-aletheia', purpose: 'Explain run', agentRef: 'agent:aletheia', agentName: 'aletheia', agentAccepted: true, spaceRef: 'session-space/fx',
  spaceLabel: null, depth: 1, parentRef: 'session-space/fx', group: false, memberRefs: [], needle: null, telemetryOn: true, budget: {used: 3, max: 12}, disclosure: null,
  tasks: [
    clip(1, {title: 'Read the act', state: 'done', startUnixMs: NOW - 600_000, lastActivityUnixMs: NOW - 540_000}),
    clip(2, {title: 'Return the correction', state: 'stalled', startUnixMs: NOW - 300_000, lastActivityUnixMs: NOW - 130_000}),
    clip(3, {state: 'unknown'}),
    clip(4, {softStop: true}),
  ]}
const GROUP = {...SESSION, sessionRef: 'session-space/fx', group: true, tasks: []}
const input = (over = {}) => ({session: SESSION, tracks: [GROUP, SESSION], nowUnixMs: NOW, selectedTask: 2, agent: {light: 'lit', quantize: 'next turn'}, ...over})

// Tasks' and Runs' designs (software-factory:tasks, software-factory:attempt-review) were retired as devices of their own in the
// 22 Oct manual rewrite; their bindings stay for the devices that carry them, and are checked here on their own.
test('Tasks reads the session\'s clips as the run model holds them — a state nobody said is left out — and the task THE selection names', () => {
  const values = tasks.tasksValues(input())
  assert.deepEqual(JSON.parse(values.tasks), [
    {n: 1, name: 'Read the act', state: 'done'},
    {n: 2, name: 'Return the correction', state: 'stalled', idle: 130},
    {n: 3},
  ], 'the soft-stop slot is no task; an unknown state is no reading')
  assert.equal(values.task, 2)
  assert.equal(values.elapsed, 170, 'from its start to its last output')
  assert.equal(values.session, 'agent-session/fx-aletheia')
  assert.deepEqual([values.light, values.quantize], ['lit', 'next turn'], 'the Agent\'s light and timing (one binding feeds both)')
  assert.deepEqual(JSON.parse(values.sessions), [{id: 'agent-session/fx-aletheia', name: 'Explain run', agent: 'aletheia', used: 3, cap: 12}])
  for (const key of ['log', 'color', 'mode', 'then', 'effort', 'toolCalls', 'register', 'form']) assert.equal(values[key], undefined, `${key}: no owner reports it`)
  assert.deepEqual(tasks.tasksValues(input({session: null})), {}, 'no session: nothing')
  assert.deepEqual(tasks.tasksValues(input({session: GROUP})), {}, 'a group is not a session')
  assert.equal(tasks.tasksValues(input({selectedTask: 9})).task, undefined, 'a task this session does not hold is not its selection')
})

test('Tasks writes the owners\' way: the timing through the Agent, a new task the Agent\'s new-task row; the harness-grained acts refused by name, the per-task settings saying where they are read', async () => {
  const calls = []
  const binding = tasks.tasksBinding(input(), {write: async changes => { calls.push(['agent', ...changes.map(change => [change.key, change.value])]) }},
    {selectTask: n => calls.push(['select', n]), queue: async text => { calls.push(['queue', text]) }})
  await binding.write([{key: 'quantize', value: 'now'}])
  await binding.write([{key: 'newTask', value: '  Land the correction  '}])
  binding.local.task(3)
  assert.deepEqual(calls, [['agent', ['quantize', 'now']], ['queue', 'Land the correction'], ['select', 3]])
  // REPLACED (lane K0): the task's lifecycle is Software Factory's (an attempt Action on a Run's unit), and a clip names no Run or unit.
  // REPLACED (BD r19, C26 6311e404c): Factory names a task's units (factory_owner attempt-task-units), so Retry reads them and retries the
  // unit through attempt-retry; Launch and Stop after still have no kernel route to start-serial or request-cancellation of that unit.
  for (const key of ['launch', 'retry', 'stopAfter']) {
    assert.equal(binding.standing[key].disabled, tasks.TASKS_REFUSE[key], key)
    await assert.rejects(() => binding.write([{key, value: true}]), {message: tasks.TASKS_REFUSE[key]})
  }
  // REPLACED (BD r20 PORT, round 869): Stop after has its kernel route (factory_owner attempt-request-cancellation) and stands with its
  // carrier as Retry does.
  // REPLACED (BD r23): was "Launch waits on Software Factory itself, which has no way yet to start a unit from its owners' readings"
  // (/^Launch: Software Factory has no way yet to start a unit/). Factory starts one (attempt-launch, round 21) on AIKit's realisation
  // (round 22), so without its carrier Launch names the carrier, as Retry and Stop after do (the r23 test below presses it).
  // REPLACED (BD r24, O-I 804): was /^Launch: no carrier to AIKit's realisation and Factory's attempt-launch stands here/. The Tasks
  // device's launch port is retired: Launch names where a task is launched instead.
  assert.match(tasks.TASKS_REFUSE.launch, /^Launch: a task launches where it stands: its clip's ▶ in the Session grid, or the Agent rack's Launch on its chain, each Software Factory's factory\.task\.run/)
  // REPLACED (O-I ticket 1006): were /no carrier to Factory's attempt-task-units and attempt-request-cancellation stands here/ and
  // /no carrier to Factory's attempt-task-units and attempt-retry stands here/, with their carriers taken here. Retry and Stop after are
  // the task's track's in Factory's Set (factory.attempt.retry, factory.task.stop), as Launch is its clip's: their ports here are retired.
  assert.match(tasks.TASKS_REFUSE.retry, /^Retry: a stalled task runs again from its track's retry in the Session grid, or the Agent rack's Retry on its chain, each Software Factory's factory\.attempt\.retry/)
  assert.match(tasks.TASKS_REFUSE.stopAfter, /^Stop after: a running task stops from its track's Stop in the Session grid, or the Agent rack's Stop after on its chain, each Software Factory's factory\.task\.stop/)
  // The per-task settings are the session's settings on their owner (factory-session-settings.test.mjs): not read here, they say so.
  for (const key of ['mode', 'then', 'to', 'effort', 'toolCalls', 'register', 'form']) assert.equal(binding.standing[key].disabled, 'The session\'s settings are not read here.', key)
  assert.equal(calls.length, 3, 'no refusal dispatched anything')
  const none = tasks.tasksBinding(input({session: null}), null, {selectTask() {}, queue: async () => {}})
  await assert.rejects(() => none.write([{key: 'newTask', value: 'x'}]), /No session is selected/)
})

test('Runs without the take lanes\' reading handed in reads no attempts and holds its view; Stands stands disabled saying so', async () => {
  bind.resetHolds()
  assert.deepEqual(tasks.runsValues('agent-session/fx-aletheia', bind.chainHolds()), {show: 'all', group: 'attempt', view: 'tree', compare: 'none', session: 'agent-session/fx-aletheia'})
  const binding = tasks.runsBinding('agent-session/fx-aletheia', bind.chainHolds())
  binding.local.view('ruler')
  binding.local.standsPending('2')
  assert.equal(tasks.runsValues('s', bind.chainHolds()).view, 'ruler')
  assert.equal(tasks.runsValues('s', bind.chainHolds()).standsPending, '2', 'the attempt you chose waits for Confirm')
  // REPLACED (T-COVERAGE §1.3): Stands writes through Factory's factory.attempt.choose once the takes are handed in (stale-refusals-binding.test.mjs).
  await assert.rejects(() => binding.write([{key: 'stands', value: '2'}]), /not handed the session's takes/)
  assert.equal(tasks.runsValues('s', bind.chainHolds()).standsPending, undefined, 'Confirm ends the wait, refused or not')
  assert.match(binding.standing.stands.disabled, /factory\.attempt\.choose is the write/)
  bind.resetHolds()
})

test('REPLACED (ticket 772) — the chain publishes no Tasks and no Runs: a task is a clip and its attempts the track\'s takes (§16.1, §19.1)', () => {
  // Was "the chain publishes Tasks and Runs with their bindings, on the selected session and the task THE selection names". Since ticket
  // 725 their constructors answered null (Software Factory admits no tasks or attempt-review face), so the door held nothing; ticket 772
  // removed the constructors and the chain's wiring of their bindings. A task's settings are its Clip view's (agent/clipBinding.ts
  // useFactoryClip, which reads the selected task THE selection names); a new task goes the Agent's new-task row (designBindings.ts
  // AGENT_P0_ROWS, the Agent's own composer). The bindings stay, with their tests above.
  const view = readFileSync(new URL('../src/agent/devices/FactoryDeviceChain.tsx', import.meta.url), 'utf8')
  assert.doesNotMatch(view, /tasksDevice|runsDevice|tasksDesignBinding|runsDesignBinding/, 'no Tasks or Runs device, and no binding wired for one')
  const own = readFileSync(new URL('../src/agent/devices/taskBindings.ts', import.meta.url), 'utf8')
  assert.doesNotMatch(own, /export const (tasksDevice|runsDevice)\b/, 'no constructor stands')
  assert.match(readFileSync(new URL('../src/agent/clipBinding.ts', import.meta.url), 'utf8'), /parseFactoryTaskRef/, 'the selected task is THE selection\'s clip, in Clip view')
  assert.deepEqual(readFileSync(new URL('../src/agent/devices/taskBindings.ts', import.meta.url), 'utf8').match(/#[0-9a-fA-F]{3,8}\b/g) ?? [], [], 'shell tokens only')
})

// REPLACED (O-I ticket 1006): the tests "(BD r19) a task's Retry", "(BD r20) a task's Stop after" and "(BD r23) a task's Launch" pressed the
// kernel's compositions (factory_owner attempt-task-units, then attempt-retry, attempt-request-cancellation, or AIKit's realise and
// attempt-launch). Those compositions are deleted: a session's task runs, stops and runs again by Factory's own Actions, laid on its clip and
// track in Factory's Set (kernel mode_set.rs) and run by `act` wherever they are pressed. Channels: FIXTURE a Set in the kernel's shape
// (oi.mode-set/v1, its acts as mode_set.rs lays them); SCRIPTED a kernel behind the bridge's fetch answering `act` as the kernel does.
test('(O-I 1006) a session\'s Launch, Stop after and Retry are its own acts in Factory\'s Set, run by act as the Session grid runs them; absent, the words say why', async () => {
  const acts = await import('../src/agent/factoryTaskActs.ts')
  const SPACE = 'session-space/fx', S = SESSION.sessionRef, TRACK = `${SPACE}:${S}`, OTHER = 'agent-session/fx-other'
  const act = (action, input) => ({action, input, words: `Factory's ${action}: its act`, done: `Factory answered ${action}.`})
  const RUN = act('factory.task.run', {state: '/s', run_ref: 'run:2', session: S})
  const SET = {owner: 'Software Factory', sources: [], rows: [], mixer: {}, lanes_absent: {}, acts: {}, waiting: {}, takes: [],
    tracks: [
      {id: TRACK, name: 'codex', kind: 'an Agent session seated in notes', acts: {stopTrack: act('factory.task.stop', {state: '/s', run_ref: 'run:1', attempt_ref: 'attempt:1'}),
        retry: act('factory.attempt.retry', {state: '/s', run_ref: 'run:0', unit_ref: 'unit:a'})}},
      {id: `${SPACE}:${OTHER}`, name: 'claude', kind: 'an Agent session seated in notes', acts: {}}],
    clips: [
      {id: `${TRACK}#task/1`, track: TRACK, row: 'batch:1', label: 'ran', acts: {}},
      {id: `${TRACK}#task/2`, track: TRACK, row: 'batch:2', label: 'written', acts: {launch: RUN}},
      {id: `${TRACK}#task/3`, track: TRACK, row: 'batch:3', label: 'written later', acts: {launch: act('factory.task.run', {state: '/s', run_ref: 'run:3', session: S})}}]}
  assert.equal(acts.sessionActOf(SET, S, 'launch'), RUN, 'Launch runs the first task written on the session that has not run')
  assert.equal(acts.sessionActOf(SET, S, 'stopTrack').action, 'factory.task.stop')
  assert.equal(acts.sessionActOf(SET, S, 'retry').action, 'factory.attempt.retry')
  assert.equal(acts.sessionActOf(SET, OTHER, 'retry'), null, 'a track with no stalled task lights no retry')
  assert.equal(acts.sessionActOf(SET, 'agent-session/none', 'launch'), null, 'a session with no track in the Set has no act')
  const store = set => ({read: async () => ({state: 'held', answer: {schema: 'oi.mode-set/v1', mode: 'factory', version: 3, set}})})
  const sent = []
  const real = globalThis.fetch
  const answer = dispatch => { globalThis.fetch = async (_url, init) => { sent.push(JSON.parse(init.body)); return {json: async () => ({ok: true, outcome: {result: 'action_dispatched', dispatch, receipts: []}})} } }
  const transport = {kind: 'bridge', url: 'http://set.fixture'}
  try {
    answer({state: 'invoked', data: {contract: 'factory.session-task/v1', state: 'running'}})
    assert.equal(await acts.sessionSetAct(transport, S, 'launch', store(SET)), 'Factory answered factory.task.run.')
    assert.equal(await acts.sessionSetAct(transport, S, 'stopTrack', store(SET)), 'Factory answered factory.task.stop.')
    assert.equal(await acts.sessionSetAct(transport, S, 'retry', store(SET)), 'Factory answered factory.attempt.retry.')
    assert.deepEqual(sent, [
      {op: 'act', action: 'factory.task.run', input: {state: '/s', run_ref: 'run:2', session: S}},
      {op: 'act', action: 'factory.task.stop', input: {state: '/s', run_ref: 'run:1', attempt_ref: 'attempt:1'}},
      {op: 'act', action: 'factory.attempt.retry', input: {state: '/s', run_ref: 'run:0', unit_ref: 'unit:a'}}], 'each the Action the Set lays, by act')
    // Where the Set lays no such act, nothing is asked and the words say why.
    for (const key of ['launch', 'stopTrack', 'retry']) {
      await assert.rejects(() => acts.sessionSetAct(transport, OTHER, key, store(SET)), {message: acts.SESSION_ACT_ABSENT[key](OTHER)})
    }
    assert.equal(sent.length, 3)
    assert.match(acts.SESSION_ACT_ABSENT.launch(OTHER), /^Launch: no task written on agent-session\/fx-other waits to run/)
    // Factory's refusal comes back in its words; a Set the kernel did not answer says why.
    const REFUSED = 'Factory refused factory.attempt.retry: unit:a has no current attempt to retry'
    answer({state: 'owner_refused', message: REFUSED})
    await assert.rejects(() => acts.sessionSetAct(transport, S, 'retry', store(SET)), {message: REFUSED})
    await assert.rejects(() => acts.sessionSetAct(transport, S, 'launch', {read: async () => ({state: 'unavailable', reason: 'the kernel is not running'})}),
      {message: 'Launch: Factory\'s Set is unread, so no act of agent-session/fx-aletheia is found: the kernel is not running.'})
  } finally { globalThis.fetch = real }
  // The Tasks device takes none of them: a launch, retry or stop handed in is not taken (its ports are retired).
  const handed = []
  const offered = tasks.tasksBinding(input(), null, {selectTask() {}, queue: async () => {}, launch: async session => { handed.push(session) },
    retry: async session => { handed.push(session) }, stopAfter: async session => { handed.push(session) }})
  for (const key of ['launch', 'retry', 'stopAfter']) {
    assert.equal(offered.standing[key].disabled, tasks.TASKS_REFUSE[key], `a ${key} handed in is not taken`)
    await assert.rejects(() => offered.write([{key, value: true}]), {message: tasks.TASKS_REFUSE[key]})
  }
  assert.deepEqual(handed, [], 'nothing is launched, retried or stopped from the Tasks device')
})

// ---------------------------------------------------------------------------------------------------------------- Results (BD r25)
// The Results tile (DLW §19.1 On the rail): "The takes of the selected run: each result with its author and its diff. Open a diff to read
// it. Press Accept to send a result to review in Approvals. Beside them, the outputs Workcell collected from the world the run stood in,
// each with where it lies, and what it left out; Collect gathers them again." Settings: Run (the selected run), Show (Results · Diffs ·
// Both). Channels: FIXTURE takes in factoryTakes.ts's own shape, a FIXTURE `workcell worlds` listing and a FIXTURE `workcell collect`.
const take = (attemptRef, runRef, state, extra = {}) => ({sessionRef: SESSION.sessionRef, attemptRef, runRef, statePath: '/fx/factory/state.json', taskRef: 'task:fx',
  unit: 'build', unitRef: 'workflow-unit:build', state, startUnixMs: NOW - 600_000, endUnixMs: state === 'returned' ? NOW - 60_000 : null,
  summary: state === 'returned' ? 'Built the fixtures.' : null, receivingRef: null, materialWorldRef: null, ...extra})
const RESULT_TAKES = [
  take('attempt:01', 'run:r1', 'returned', {startUnixMs: NOW - 900_000, receivingRef: 'receiving:01'}),
  take('attempt:02', 'run:r2', 'returned', {materialWorldRef: 'world:w2'}),
  take('attempt:03', 'run:r2', 'running', {startUnixMs: NOW - 30_000}),
  take('attempt:04', 'run:r2', 'failed'),
]
const LISTED = [{receipt: '/fx/workcell/w2.json', worldRef: 'world:w2', subjects: {}}]
const COLLECTED = {world_ref: 'world:w2', outputs: [{logical_ref: 'out:report', material_locator: '/fx/w2/report.md', provenance: 'workcell'}],
  omissions: [{requirement: 'out:coverage', reason: 'the world wrote no coverage'}]}

test('(BD r25) Results: the selected run\'s takes, each with its author, its standing and why Accept stands or not; the diffs absent in words', () => {
  const read = tasks.resultsOf({session: SESSION, takes: RESULT_TAKES, worlds: LISTED})
  assert.equal(read.why, null)
  assert.deepEqual(read.runs.map(run => run.ref), ['run:r1', 'run:r2'])
  assert.equal(read.run, 'run:r2', 'the selected run is the newest take\'s')
  assert.deepEqual(read.results.map(row => [row.attempt, row.author, row.stands, row.accept.ok]),
    [['attempt:02', 'aletheia', false, true], ['attempt:03', 'aletheia', false, false], ['attempt:04', 'aletheia', false, false]])
  assert.equal(read.results[0].summary, 'Built the fixtures.')
  assert.match(read.results[1].accept.why, /still running/)
  assert.match(read.results[2].accept.why, /failed/)
  // The first run, chosen: its one take was received already, so Accept says where it went.
  const first = tasks.resultsOf({session: SESSION, takes: RESULT_TAKES, run: 'run:r1', worlds: LISTED})
  assert.equal(first.run, 'run:r1'); assert.equal(first.results[0].stands, true)
  assert.match(first.results[0].accept.why, /receiving:01/)
  // Factory's Return names no diff of its own, so the diffs stand absent and say why.
  assert.match(read.diffs, /^Diffs: /); assert.match(read.diffs, /ReadableReturn/)
  // A run the session's takes do not name is no run of its: the newest stands.
  assert.equal(tasks.resultsOf({session: SESSION, takes: RESULT_TAKES, run: 'run:gone'}).run, 'run:r2')
})

test('(BD r25) Results: the outputs Workcell collected from each take\'s world, where each lies and what it left out, and why Collect cannot', () => {
  const read = tasks.resultsOf({session: SESSION, takes: RESULT_TAKES, worlds: LISTED, collected: {'attempt:02': {value: COLLECTED}}})
  const outputs = Object.fromEntries(read.outputs.map(row => [row.attempt, row]))
  assert.equal(outputs['attempt:02'].receipt, '/fx/workcell/w2.json')
  assert.deepEqual(outputs['attempt:02'].collected, {attempt: 'attempt:02', world: 'world:w2', outputs: [{ref: 'out:report', locator: '/fx/w2/report.md', provenance: 'workcell'}],
    omitted: [{requirement: 'out:coverage', reason: 'the world wrote no coverage'}]})
  assert.match(outputs['attempt:03'].why, /names no world/)
  // Workcell's refusal of a collect is said in its words; an unread listing says what it waits for.
  const refused = tasks.resultsOf({session: SESSION, takes: RESULT_TAKES, worlds: LISTED, collected: {'attempt:02': {error: 'Workcell: the receipt is gone'}}})
  assert.equal(refused.outputs.find(row => row.attempt === 'attempt:02').why, 'Workcell: the receipt is gone')
  const unlisted = tasks.resultsOf({session: SESSION, takes: RESULT_TAKES, worlds: null, worldsWhy: 'Workcell has not answered `workcell worlds` yet.'})
  assert.equal(unlisted.outputs.find(row => row.attempt === 'attempt:02').why, 'Workcell has not answered `workcell worlds` yet.')
  const elsewhere = tasks.resultsOf({session: SESSION, takes: RESULT_TAKES, worlds: []})
  assert.match(elsewhere.outputs.find(row => row.attempt === 'attempt:02').why, /lists no receipt of world:w2/)
})

test('(BD r25) Results: no session, no takes read and no run each say why nothing is listed', () => {
  assert.match(tasks.resultsOf({session: null, takes: undefined}).why, /no session is selected/)
  assert.match(tasks.resultsOf({session: SESSION, takes: undefined}).why, /kernel carrier/)
  assert.match(tasks.resultsOf({session: SESSION, takes: null}).why, /has not answered/)
  assert.match(tasks.resultsOf({session: SESSION, takes: []}).why, /AIKit names no Factory attempt/)
  assert.deepEqual(tasks.RESULTS_SHOW, ['results', 'diffs', 'both'])
})

test('(BD r25) the rail\'s Results draws its own body over the selected session: Run and Show, Accept through Factory, Collect through Workcell', () => {
  // Source assertions: the tile body's module chain applies the window's theme when it loads (desktop/cradle/src/visuals), and the rail's
  // registry needs a window too, so both are read as source here; the reading they draw is resultsOf's, tested above.
  const rail = readFileSync(new URL('../src/shell/widgets.tsx', import.meta.url), 'utf8')
  assert.match(rail, /RAIL_BODIES[^=]*= \{\.\.\.OWN_BODIES, results: ResultsWidget\}/)
  assert.match(rail, /Body: RAIL_BODIES\[id\] \?\? modeTile\(id\)/, 'the rail draws it in the Results tile')
  assert.match(rail, /import\('\.\.\/agent\/AgentDockTileBody'\)\.then\(module => module\.ResultsTile\)/)
  assert.match(rail, /tracks\.find\(item => item\.id === shell\.selectedTrackId && !item\.group\) \?\? null/, 'never another session\'s results')
  const body = readFileSync(new URL('../src/agent/AgentDockTileBody.tsx', import.meta.url), 'utf8')
  const tile = body.slice(body.indexOf('export function ResultsTile'))
  for (const said of [/resultsOf\(\{session: track, takes: sessionTakes, run, worlds: listed, worldsWhy, collected\}\)/, /takes\.choose\(take\)/,
    /collectWorld\(transport, receipt\)/, /aria-label="Run"/, /aria-label="Show"/, /RESULTS_SHOW\.map/, /disabled=\{!row\.accept\.ok\}/, /reading\.diffs/])
    assert.match(tile, said)
  const reads = readFileSync(new URL('../src/agent/devices/workcellReads.ts', import.meta.url), 'utf8')
  assert.match(reads, /workcellReadOp\(\{kind: 'collect', receipt\}\), \{fresh: true\}/, 'Collect gathers them again: asked fresh')
})
