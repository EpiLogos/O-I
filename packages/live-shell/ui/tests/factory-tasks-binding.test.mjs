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
  // carrier as Retry does; Launch waits on Software Factory itself, which has no way yet to start a unit from its owners' readings.
  assert.match(tasks.TASKS_REFUSE.launch, /^Launch: Software Factory has no way yet to start a unit from its owners' readings/)
  assert.doesNotMatch(tasks.TASKS_REFUSE.launch, /kernel route/)
  assert.match(tasks.TASKS_REFUSE.stopAfter, /no carrier to Factory's attempt-task-units and attempt-request-cancellation stands here/)
  assert.match(tasks.TASKS_REFUSE.retry, /no carrier to Factory's attempt-task-units and attempt-retry stands here/)
  const retried = [], stopped = []
  const carried = tasks.tasksBinding(input(), null, {selectTask() {}, queue: async () => {}, retry: async session => { retried.push(session) },
    stopAfter: async session => { stopped.push(session) }})
  assert.equal(carried.standing.retry, undefined, 'Retry stands with its carrier')
  assert.equal(carried.standing.stopAfter, undefined, 'Stop after stands with its carrier')
  assert.equal(carried.standing.launch.disabled, tasks.TASKS_REFUSE.launch, 'Launch waits on Software Factory')
  await carried.write([{key: 'retry', value: true}])
  await carried.write([{key: 'stopAfter', value: true}])
  assert.deepEqual(retried, [input().session.sessionRef])
  assert.deepEqual(stopped, [input().session.sessionRef])
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
  // REPLACED (T-COVERAGE §1.3): Stands writes through Factory's AttemptReceiving once the takes are handed in (stale-refusals-binding.test.mjs).
  await assert.rejects(() => binding.write([{key: 'stands', value: '2'}]), /not handed the session's takes/)
  assert.equal(tasks.runsValues('s', bind.chainHolds()).standsPending, undefined, 'Confirm ends the wait, refused or not')
  assert.match(binding.standing.stands.disabled, /AttemptReceiving is the write/)
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

test('(BD r19) a task\'s Retry: Factory\'s units of the task read (attempt-task-units), then its unit retried (attempt-retry); a refusal is Factory\'s words', async () => {
  const UNITS = {contract: 'factory.attempt-task-units-reading/v1', projectRef: 'project:o-i', taskRef: 'central:task:t1', runsRead: 2, totalUnits: 2, units: [
    {runRef: 'run:r1', workflowUnitRef: 'unit:build', currentAttemptRef: 'attempt:a2', status: 'returned', attempts: 2, runRevision: 4, required: true},
    {runRef: 'run:r2', workflowUnitRef: 'unit:check', currentAttemptRef: 'attempt:b1', status: 'failed', attempts: 1, runRevision: 7, required: true}]}
  assert.deepEqual(tasks.taskUnitsOf(UNITS).map(unit => unit.workflowUnitRef), ['unit:build', 'unit:check'])
  assert.equal(tasks.taskUnitsOf({contract: 'other'}), null)
  const asked = []
  const owner = answers => async request => { asked.push(request); return answers[request.kind] }
  await tasks.retryTask(owner({'attempt-task-units': UNITS, 'attempt-retry': {status: 'retried'}}), '/state', 'central:task:t1')
  assert.deepEqual(asked, [{kind: 'attempt-task-units', state_path: '/state', task_ref: 'central:task:t1'},
    {kind: 'attempt-retry', state_path: '/state', run_ref: 'run:r2', workflow_unit_ref: 'unit:check'}], 'the failed unit is the one retried')
  // Two units neither failed: Factory retries one unit at a time, so the press names them and asks nothing more.
  asked.length = 0
  const both = {...UNITS, units: UNITS.units.map(unit => ({...unit, status: 'returned'}))}
  await assert.rejects(() => tasks.retryTask(owner({'attempt-task-units': both}), '/state', 'central:task:t1'), /stands on 2 units \(run:r1 · unit:build, run:r2 · unit:check\).*Run map/)
  assert.equal(asked.length, 1)
  await assert.rejects(() => tasks.retryTask(owner({'attempt-task-units': {...UNITS, units: [], totalUnits: 0}}), '/state', 'central:task:t1'), /Factory retains no attempt of central:task:t1/)
  await assert.rejects(() => tasks.retryTask(owner({'attempt-task-units': UNITS, 'attempt-retry': {status: 'refused', refusal: {message: 'The unit has no retry grant.'}}}), '/state', 'central:task:t1'),
    {message: 'The unit has no retry grant.'})
  await assert.rejects(() => tasks.retryTask(owner({}), '/state', 'central:task:t1'), /answered something other than its units/)
})

// BD round 20 PORT (round 869): Stop after through Factory (kernel factory_retry.rs attempt_request_cancellation): the task's units read as
// Retry reads them (attempt-task-units), the unit whose current attempt is the task's taken, and its cancellation asked
// (attempt-request-cancellation). The answer is the kernel's oi.factory-attempt-cancellation/v1 (types.ts FactoryAttemptCancellation).
test('(BD r20) a task\'s Stop after: its units read, the unit its current attempt stands on asked to stop; refused or uncertain, Factory\'s words', async () => {
  const UNITS = {contract: 'factory.attempt-task-units-reading/v1', projectRef: 'project:o-i', taskRef: 'central:task:t1', runsRead: 2, totalUnits: 2, units: [
    {runRef: 'run:r1', workflowUnitRef: 'unit:build', currentAttemptRef: null, status: null, attempts: 1, runRevision: 4, required: true},
    {runRef: 'run:r2', workflowUnitRef: 'unit:check', currentAttemptRef: 'attempt:b1', status: 'running', attempts: 1, runRevision: 7, required: true}]}
  const answer = (status, message) => ({contract: 'oi.factory-attempt-cancellation/v1', runRef: 'run:r2', workflowUnitRef: 'unit:check', status,
    changed: status === 'cancel-requested', attemptRef: 'attempt:b1', authorityRef: null, receipt: null, refusal: message ? {source: 'factory', step: 'admission', message} : null})
  const asked = []
  const owner = answers => async request => { asked.push(request); return answers[request.kind] }
  await tasks.stopAfterTask(owner({'attempt-task-units': UNITS, 'attempt-request-cancellation': answer('cancel-requested')}), '/state', 'central:task:t1')
  assert.deepEqual(asked, [{kind: 'attempt-task-units', state_path: '/state', task_ref: 'central:task:t1'},
    {kind: 'attempt-request-cancellation', state_path: '/state', run_ref: 'run:r2', workflow_unit_ref: 'unit:check'}], 'the unit the task\'s current attempt stands on')
  await tasks.stopAfterTask(owner({'attempt-task-units': UNITS, 'attempt-request-cancellation': answer('already-requested')}), '/state', 'central:task:t1')
  // Refused or uncertain: Factory's words (until the round-20 Factory is installed, the kernel's refusal of the action it does not name).
  const REFUSED = 'Factory names no attempt-request-cancellation action, only attempt-receiving, attempt-retry'
  await assert.rejects(() => tasks.stopAfterTask(owner({'attempt-task-units': UNITS, 'attempt-request-cancellation': answer('refused', REFUSED)}), '/state', 'central:task:t1'), {message: REFUSED})
  await assert.rejects(() => tasks.stopAfterTask(owner({'attempt-task-units': UNITS, 'attempt-request-cancellation': answer('uncertain', 'Factory did not answer in time')}), '/state', 'central:task:t1'),
    {message: 'Factory did not answer in time'})
  await assert.rejects(() => tasks.stopAfterTask(owner({'attempt-task-units': UNITS, 'attempt-request-cancellation': {status: 'stopped'}}), '/state', 'central:task:t1'),
    /^Error: Stop after: Factory answered without its cancellation of run:r2 · unit:check\.$/)
  // No current attempt of the task, or several: nothing is asked to stop, and the press says which.
  asked.length = 0
  const idle = {...UNITS, units: UNITS.units.map(unit => ({...unit, currentAttemptRef: null}))}
  await assert.rejects(() => tasks.stopAfterTask(owner({'attempt-task-units': idle}), '/state', 'central:task:t1'), /^Error: Stop after: no attempt of central:task:t1 is current on any unit/)
  const both = {...UNITS, units: UNITS.units.map(unit => ({...unit, currentAttemptRef: `attempt:${unit.workflowUnitRef}`}))}
  await assert.rejects(() => tasks.stopAfterTask(owner({'attempt-task-units': both}), '/state', 'central:task:t1'), /stands current on 2 units \(run:r1 · unit:build, run:r2 · unit:check\).*Run map/)
  await assert.rejects(() => tasks.stopAfterTask(owner({}), '/state', 'central:task:t1'), /^Error: Stop after: `factory attempt units` answered something other than its units/)
  assert.equal(asked.filter(request => request.kind === 'attempt-request-cancellation').length, 0, 'nothing was asked to stop')
})
