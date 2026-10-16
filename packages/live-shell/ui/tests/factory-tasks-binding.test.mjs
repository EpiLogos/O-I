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
const {design: tasksDesign} = await import('../src/inhabitants/catalogue/panels/software-factory__tasks.tsx')
const {design: runsDesign} = await import('../src/inhabitants/catalogue/panels/software-factory__attempt-review.tsx')

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

test('Tasks and Runs are keyed to their designs exactly', () => {
  assert.equal(designKey(tasks.tasksDevice().family, tasks.tasksDevice().face.id), tasksDesign.id)
  assert.equal(designKey(tasks.runsDevice().family, tasks.runsDevice().face.id), runsDesign.id)
})

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
  for (const key of ['log', 'color', 'mode', 'then', 'effort', 'autonomy', 'register', 'form']) assert.equal(values[key], undefined, `${key}: no owner reports it`)
  assert.deepEqual(tasks.tasksValues(input({session: null})), {}, 'no session: nothing')
  assert.deepEqual(tasks.tasksValues(input({session: GROUP})), {}, 'a group is not a session')
  assert.equal(tasks.tasksValues(input({selectedTask: 9})).task, undefined, 'a task this session does not hold is not its selection')
  for (const [key, value] of Object.entries(tasksDesign.defaults)) {
    if (key === 'light' || key === 'task') continue // the light is the Agent's reading; the task is THE selection's ordinal (2 here, as in the design)
    assert.notDeepEqual([key, values[key]], [key, value], `${key} carries the design's default`)
  }
})

test('Tasks writes the owners\' way: the timing through the Agent, a new task the Agent\'s new-task row; the harness-grained acts and per-task settings refused by name', async () => {
  const calls = []
  const binding = tasks.tasksBinding(input(), {write: async changes => { calls.push(['agent', ...changes.map(change => [change.key, change.value])]) }},
    {selectTask: n => calls.push(['select', n]), queue: async text => { calls.push(['queue', text]) }})
  await binding.write([{key: 'quantize', value: 'now'}])
  await binding.write([{key: 'newTask', value: '  Land the correction  '}])
  binding.local.task(3)
  assert.deepEqual(calls, [['agent', ['quantize', 'now']], ['queue', 'Land the correction'], ['select', 3]])
  for (const key of ['launch', 'retry', 'stopAfter']) {
    assert.match(binding.standing[key].disabled, /harness_agent_control addresses the whole bound harness; the owner takes no task/, key)
    await assert.rejects(() => binding.write([{key, value: true}]), /missing op/)
  }
  for (const key of ['mode', 'then', 'to', 'effort', 'autonomy', 'register', 'form']) assert.match(binding.standing[key].disabled, /missing op/, key)
  assert.equal(calls.length, 3, 'no refusal dispatched anything')
  const none = tasks.tasksBinding(input({session: null}), null, {selectTask() {}, queue: async () => {}})
  await assert.rejects(() => none.write([{key: 'newTask', value: 'x'}]), /No session is selected/)
})

test('Runs reads no attempts — no reading names the session\'s run — and holds its view; Stands has no owner write', async () => {
  bind.resetHolds()
  assert.deepEqual(tasks.runsValues('agent-session/fx-aletheia', bind.chainHolds()), {show: 'all', group: 'attempt', view: 'tree', compare: 'none', session: 'agent-session/fx-aletheia'})
  const binding = tasks.runsBinding('agent-session/fx-aletheia', bind.chainHolds())
  binding.local.view('ruler')
  binding.local.standsPending('2')
  assert.equal(tasks.runsValues('s', bind.chainHolds()).view, 'ruler')
  assert.equal(tasks.runsValues('s', bind.chainHolds()).standsPending, '2', 'the attempt you chose waits for Confirm')
  await assert.rejects(() => binding.write([{key: 'stands', value: '2'}]), /missing op: an attempt's acceptance/)
  assert.equal(tasks.runsValues('s', bind.chainHolds()).standsPending, undefined, 'Confirm ends the wait, refused or not')
  assert.match(binding.standing.stands.disabled, /factory_attempt_read only reads/)
  bind.resetHolds()
})

test('Tasks and Runs draw their designs on their bindings in all five views — no NaN, no undefined, never their fixtures — each refusal drawn as why', () => {
  bind.resetHolds()
  host.resetHost()
  const cases = [
    [tasksDesign, tasks.tasksBinding(input(), null, {selectTask() {}, queue: async () => {}}), /generate fixtures|pnpm test bridge2|lead session|#5cc6b4/, [tasks.TASKS_REFUSE.retry, tasks.TASKS_REFUSE.effort]],
    [runsDesign, tasks.runsBinding('agent-session/fx-aletheia', bind.chainHolds()), /01ARZ3NDEKTSV4RRFFQ69G5FAA|3\.4\.2/, []],
  ]
  for (const [design, binding, fixture, reasons] of cases) {
    const drawn = hosted(design, binding)
    drawn.forEach((markup, index) => {
      assert.match(markup, new RegExp(`data-device-view="${views[index]}"`), `${design.id} ${views[index]} draws`)
      assert.doesNotMatch(markup, /\bNaN\b|undefined/, `${design.id} ${views[index]}: no absent key drawn as text`)
      assert.doesNotMatch(markup, /data-device-fault/, `${design.id} ${views[index]}: its own view drew`)
      assert.doesNotMatch(markup, fixture, `${design.id} ${views[index]}: its fixture never stands in`)
    })
    const all = drawn.join('\n')
    for (const why of reasons) assert.ok(all.includes(escaped(why)), `${design.id}: a refused control says why (${why})`)
  }
  assert.match(hosted(tasksDesign, cases[0][1]).join('\n'), /Return the correction/, 'the session\'s own task is drawn')
  assert.match(hosted(runsDesign, cases[1][1]).join('\n'), /No reading of the attempts/, 'Runs says what it cannot read')
  host.resetHost()
})

test('the chain publishes Tasks and Runs with their bindings, on the selected session and the task THE selection names', () => {
  const view = readFileSync(new URL('../src/agent/devices/FactoryDeviceChain.tsx', import.meta.url), 'utf8')
  assert.match(view, /publishDevice\(TASKS_ID, tasks \? \{device: tasks, binding: tasksDesignBinding\} : null\)/)
  assert.match(view, /publishDevice\(RUNS_ID, runs \? \{device: runs, binding: runsDesignBinding\} : null\)/)
  assert.match(view, /parseFactoryTaskRef\(selection\.ref\)/, 'the selected task is THE selection\'s clip')
  assert.match(view, /queue: async text => \{ const receipt = await write\(AGENT_P0_ROWS\.newTask, text\)/, 'a new task goes the Agent\'s new-task row')
  assert.deepEqual(readFileSync(new URL('../src/agent/devices/taskBindings.ts', import.meta.url), 'utf8').match(/#[0-9a-fA-F]{3,8}\b/g) ?? [], [], 'shell tokens only')
})
