// O-I 846 (lane BD; manual §17.4 "Map a workflow"): the Canvas's Flow page draws the workflow Factory's Notes draw in time, read from
// Factory and kept nowhere here (techne/devices/flowBinding.ts, wired in techneDesigns.ts). The map is Factory's score of the song a
// Factory task's Run performs (`factory workflow score`, factory.workflow-score/v1): each unit a task card, a unit that is a song's clip a
// song card, each agent and agent set its requirements name a circle or a diamond, each join a bar, a solid line where a unit waits on
// another, a dashed one from who takes a unit; the routine that starts it is the AIKit routine whose invocation Factory continued into the
// Run (`factory development run` routineInvocationRefs, AIKit's routine history and list). Relate draws a hand-off or an allocation, amber
// and dashed, held by the view; Promote sends the lines to Factory as one `factory workflow edit` (connect, allocate) at the byte revision
// read, and Factory admits them or refuses in its words; the score read again shows an admitted line solid. Open is the shell's act
// (frame/openWhereItLives.ts): a task in Clip view with its note chosen, a song with its score open, a routine in Settings, Automations.
// Channels: the scores, Factory's edit receipt and its refusals are REAL — Factory's CLI built from dlw/843-score and dlw/844-songs, walked
// headless on scratch projects (tests/fixtures/factory-workflow-score-2026-11-03.json, factory-songs-2026-11-03.json; the scratch paths
// written /walk); the run reading is REAL (tests/fixtures/factory-journey-2026-10-21.json, Central's root Factory state, read-only).
// DERIVED — a join added to the real score; the real run reading with one AIKit invocation named. SCRIPTED — the kernel behind the bridge's
// fetch, recording every op; AIKit's routine history and list shaped as the Automations client reads them (contributions/automations/
// client.ts), never a routine AIKit ran. FIXTURE — the session tracks and their takes, owner-shaped. Not a screen pass: the native window
// with a real workflow is UNVERIFIED (the lead's walk).
import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'
import {readFile} from 'node:fs/promises'

const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};
import {readFile} from 'node:fs/promises';
export async function resolve(s, c, n) {
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

const noop = () => {}
globalThis.document ??= {getElementById: () => null, createElement: () => ({style: {}, setAttribute: noop, appendChild: noop}), head: {appendChild: noop},
  addEventListener: noop, removeEventListener: noop, querySelector: () => null, documentElement: {style: {}}}
// The window's events, so the owners' notices (owners/notices.ts tellOwnerChanged) reach their listeners here.
const bus = new EventTarget()
globalThis.window ??= globalThis
globalThis.addEventListener = bus.addEventListener.bind(bus); globalThis.removeEventListener = bus.removeEventListener.bind(bus)
globalThis.dispatchEvent = bus.dispatchEvent.bind(bus)
globalThis.localStorage ??= {getItem: () => null, setItem: noop}

const source = path => readFile(new URL(path, import.meta.url), 'utf8')
const unescape = text => text.replace(/&#x27;/g, '\'').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
const SCORE = JSON.parse(await readFile(new URL('./fixtures/factory-workflow-score-2026-11-03.json', import.meta.url), 'utf8'))
const SONGS = JSON.parse(await readFile(new URL('./fixtures/factory-songs-2026-11-03.json', import.meta.url), 'utf8'))
const JOURNEY = JSON.parse(await readFile(new URL('./fixtures/factory-journey-2026-10-21.json', import.meta.url), 'utf8'))
const STATE = '/walk/song/.factory/development-state.json'
const RUN = SCORE.score.runRef
const unitRefOf = (reading, key) => reading.units.find(unit => unit.key === key).unitRef

/** A scripted kernel behind the bridge's fetch: `answer(op)` is the outcome, or an Error for the owner's refusal. It keeps every op. */
function kernel(answer) {
  const ops = []
  const was = globalThis.fetch
  globalThis.fetch = async (_url, init) => {
    const op = JSON.parse(init.body)
    ops.push(op)
    const outcome = answer(op)
    return {json: async () => (outcome instanceof Error ? {ok: false, error: outcome.message} : {ok: true, outcome})}
  }
  return {transport: {kind: 'bridge', url: 'http://flow.test'}, ops, restore: () => { globalThis.fetch = was }}
}
const factoryAnswer = data => ({result: 'factory_development_reading', data, receipts: []})
const factoryRefusal = diagnostic => new Error(JSON.stringify({kind: 'owner-refused-or-failed', message: diagnostic.error.message, operation_may_have_run: false}))

// FIXTURE: the Anima space's group track and two of its sessions, each task's latest attempt naming its unit of the same Run.
const group = {sessionRef: 'space:anima', purpose: 'Anima', agentRef: null, agentName: null, agentAccepted: null, spaceRef: 'space:anima', spaceLabel: 'Anima',
  depth: 0, parentRef: null, group: true, memberRefs: ['ses-eros', 'ses-mythos'], tasks: [], needle: null, telemetryOn: true, budget: {used: null, max: null},
  disclosure: null, agentSet: {ref: 'agent-set/anima', revision: 'r1'}}
const member = (sessionRef, agentRef, agentName, title) => ({sessionRef, purpose: null, agentRef, agentName, agentAccepted: true, spaceRef: 'space:anima',
  spaceLabel: 'Anima', depth: 1, parentRef: 'space:anima', group: false, memberRefs: [], needle: null, telemetryOn: true, budget: {used: 2, max: 12}, disclosure: null,
  project: 'song-maker', tasks: [{n: 1, title, state: 'done', startUnixMs: 1_000, lastActivityUnixMs: 61_000, softStop: false, disclosure: null}]})
const eros = member('ses-eros', 'agent/anima-eros', 'Eros', 'verify the change'), mythos = member('ses-mythos', 'agent/anima-mythos', 'Mythos', 'debug what failed')
const TRACKS = [group, eros, mythos]
const take = (sessionRef, key, reading = SCORE.score) => ({sessionRef, statePath: STATE, runRef: RUN, unitRef: unitRefOf(reading, key), attemptRef: `attempt:${key}`})
const TAKES = {'ses-eros': [take('ses-eros', 'eros-verify')], 'ses-mythos': [take('ses-mythos', 'mythos-debug')]}

/** A Flow port over a reading, its edits and opens recorded. */
async function portOf(reading, over = {}) {
  const flow = await import('../src/techne/devices/flowBinding.ts')
  const {rackRowsOf} = await import('../src/agent/scoreBinding.ts')
  const found = flow.workflowsOf(TRACKS, session => TAKES[session] ?? null)
  const asked = {edits: [], opened: []}
  const port = {workflows: found.workflows, chosen: found.workflows[0], score: {state: 'read', reading, target: {statePath: STATE, runRef: RUN, unitRef: unitRefOf(SCORE.score, 'eros-verify')}},
    rack: rackRowsOf(eros, TRACKS), starts: {state: 'read', routines: []}, units: found.units,
    edit: async request => { asked.edits.push(request); return SCORE.allocate }, open: home => { asked.opened.push(home) }, ...over}
  return {flow, port, asked}
}
/** The Canvas binding as the rack hosts it, with its Flow page on the port. */
async function bindingOf(port, said = null) {
  const {canvasBinding} = await import('../src/techne/devices/frameBindings.ts')
  const {heldFor, handsFor, CANVAS_DESIGN} = await import('../src/techne/devices/designDevices.ts')
  const flow = await import('../src/techne/devices/flowBinding.ts')
  const held = heldFor(CANVAS_DESIGN)
  return flow.canvasCarryingFlow(canvasBinding({state: null, run: null, window: undefined}, held), port, held, handsFor(CANVAS_DESIGN, flow.FLOW_LOCAL), said)
}
const mapIn = binding => JSON.parse(binding.values.flow)
const lineKeys = (map, kind) => map.lines.filter(line => line.kind === kind && !line.proposed).map(line => `${line.from}>${line.to}`).sort()

test('the Flow page draws Factory\'s score: each unit a task card, who takes it a circle or a diamond, its waits as hand-offs — the same workflow Notes draws', async () => {
  const flow = await import('../src/techne/devices/flowBinding.ts')
  const score = await import('../src/agent/scoreBinding.ts')
  const rack = score.rackRowsOf(eros, TRACKS)
  const map = flow.flowOfScore(SCORE.score, rack, [])
  assert.equal(map.name, 'development-and-knowledge', 'the workflow by Factory\'s name')
  const units = SCORE.score.units
  assert.deepEqual(map.nodes.filter(node => node.kind === 'task').map(node => node.id), units.map(unit => unit.key), 'every unit a task card, in Factory\'s order')
  assert.deepEqual(map.nodes.filter(node => node.kind === 'agent').map(node => node.id).sort(),
    SCORE.score.rows.filter(row => row.kind === 'agent').map(row => row.ref).sort(), 'each agent a unit names a circle')
  assert.deepEqual(map.nodes.filter(node => node.kind === 'set').map(node => node.id).sort(), ['agent-set/aletheia', 'agent-set/anima'], 'each agent set a diamond')
  assert.equal(map.nodes.find(node => node.id === 'agent/anima-eros').name, 'Eros', 'the track\'s Agent rack names its rows, as Notes names them')
  assert.equal(map.nodes.find(node => node.id === 'agent-set/anima').name, 'Anima')
  assert.equal(map.nodes.find(node => node.id === 'agent/aletheia').name, 'aletheia', 'off the rack, the ref\'s own last word')
  // The hand-offs are the units' waits; the allocations each unit's row and requirements; both as Notes draws the song.
  const notes = JSON.parse(score.scoreValuesOf({state: 'read', reading: SCORE.score, target: {statePath: STATE, runRef: RUN, unitRef: ''}}, rack, null).score)
  assert.deepEqual(lineKeys(map, 'handoff'), notes.units.flatMap(unit => unit.deps.map(dep => `${dep}>${unit.key}`)).sort(), 'a solid line for each tie Notes draws')
  for (const unit of notes.units) assert.ok(map.lines.some(line => line.kind === 'allocation' && line.from === unit.row && line.to === unit.key), `${unit.key} is taken by its row`)
  assert.deepEqual(lineKeys(map, 'allocation').filter(key => key.startsWith('agent-set/anima>')).length, 5, 'the Anima set takes the five units that name it')
  assert.equal(map.lines.filter(line => line.kind === 'start').length, 0, 'no routine continued this Run: no tag, no start line')
  // The order of the work, left to right: the chain logos → techne → eros → mythos → sophia → aletheia.
  assert.deepEqual(units.map(unit => map.nodes.find(node => node.id === unit.key).col), [0, 1, 2, 3, 4, 5])
  const under = map.nodes.filter(node => node.kind === 'agent' || node.kind === 'set')
  assert.ok(under.every(node => node.row > Math.max(...map.nodes.filter(item => item.kind === 'task').map(item => item.row))), 'who takes a part stands under the work')
  // A song's clip standing as one unit (Factory's form: canon) is a song card; Factory's check is its word.
  const taken = flow.flowOfScore(SONGS.score_after, rack, [])
  assert.equal(taken.nodes.find(node => node.id === 'release-check').kind, 'song')
  assert.deepEqual(flow.checkOfScore(SCORE.score), {check: 'admitted', why: 'factory workflow check admits the song\'s file'})
  assert.match(flow.checkOfScore(SCORE.score_allocated).why, /the Run performs the edition it was commissioned with/)
  // DERIVED: a join where eros-verify meets the work before it — the units it releases wait on it, and it on what it waits for.
  const joined = {...SCORE.score, joins: [{key: 'checked', waitsFor: ['techne-implement'], releases: ['eros-verify'], join: 'all', complete: false}]}
  const barred = flow.flowOfScore(joined, rack, [])
  assert.equal(barred.nodes.find(node => node.id === 'join:checked').kind, 'join')
  assert.deepEqual(lineKeys(barred, 'handoff').filter(key => key.includes('join:') || key.endsWith('>eros-verify')), ['join:checked>eros-verify', 'techne-implement>join:checked'],
    'the wait runs through the bar, never round it')
  assert.ok(barred.nodes.find(node => node.id === 'eros-verify').col > barred.nodes.find(node => node.id === 'join:checked').col)
})

test('the binding draws the chosen workflow on the Flow page, names the workflows the Factory tasks hold, and says Factory\'s word; nothing is read while the page is shut', async () => {
  // The frame's binding refuses no Flow act any more: the Flow page is Factory's, bound on its own (flowBinding.ts).
  const {canvasBinding, CANVAS_REFUSE} = await import('../src/techne/devices/frameBindings.ts')
  assert.equal(canvasBinding({state: null, run: null, window: undefined}).standing['flow.promote'], undefined, 'Promote waits for no missing Factory write')
  assert.ok(!('flow.open' in CANVAS_REFUSE), 'Open waits for no missing shell act')
  const {flow, port} = await portOf(SCORE.score)
  assert.equal(port.workflows.length, 1, 'two tasks of one Run: one workflow')
  assert.equal(port.chosen.run, RUN)
  assert.deepEqual(port.chosen.clip, {ref: 'space:anima:ses-eros#task/1', title: 'verify the change', track: 'space:anima:ses-eros'}, 'its home is the first task that names it')
  assert.deepEqual(port.units.get(unitRefOf(SCORE.score, 'mythos-debug')), {ref: 'space:anima:ses-mythos#task/1', title: 'debug what failed', track: 'space:anima:ses-mythos'},
    'a unit another task names lives on that task')
  assert.equal(port.chosen.label, 'Eros · verify the change', 'before its score is read, a workflow is named by the task that holds it')
  const binding = await bindingOf(port)
  assert.deepEqual(mapIn(binding).nodes.map(node => node.id), flow.flowOfScore(SCORE.score, port.rack, []).nodes.map(node => node.id))
  assert.deepEqual(JSON.parse(binding.values['flow.workflows']), [{value: RUN, label: 'development-and-knowledge'}], 'the workflow read stands by Factory\'s name')
  assert.equal(binding.values['flow.workflow'], RUN)
  assert.equal(binding.values['flow.check'], 'admitted')
  assert.equal(binding.values['flow.starts'], 0)
  for (const key of ['flow.draw', 'flow.promote', 'flow.open']) assert.equal(binding.writes(key), true, `${key} is the Flow page's act`)
  assert.equal(binding.standing?.['flow.promote'], undefined, 'Promote is no longer refused for want of a Factory write')
  assert.ok(binding.local['flow.workflow'] && binding.local['flow.to'], 'the workflow chosen and the node a line goes To are the view\'s')
  // Not on the Flow page: no port, nothing read, and every Flow key says so.
  const shut = await bindingOf(null)
  assert.equal(shut.values.flow, undefined)
  assert.equal(shut.standing.flow.disabled, flow.FLOW_CLOSED)
  await assert.rejects(shut.write([{key: 'flow.promote', value: true}]), {message: flow.FLOW_CLOSED})
  // Factory's refusal of the read stands in its words where the map would be (REAL: what a Factory before `factory workflow score` answers).
  const refused = await bindingOf({...port, score: {state: 'absent', why: 'Factory did not read the song\'s score: workflow.operation: Unknown workflow operation score; use factory workflow help'}})
  assert.equal(refused.values.flow, undefined)
  assert.match(refused.standing.flow.disabled, /Unknown workflow operation score/)
  assert.match(refused.standing['flow.check'].disabled, /Unknown workflow operation score/)
  // No task names a Run: no workflow, and why.
  const none = await bindingOf({...port, workflows: [], chosen: null, score: {state: 'absent', why: flow.NO_WORKFLOW}})
  assert.equal(none.standing['flow.workflows'].disabled, flow.NO_WORKFLOW)
})

test('Relate draws a hand-off or an allocation, amber and dashed, held by the view; a line that is no line of the workflow is refused in words', async () => {
  const {resetHolds, heldFor, CANVAS_DESIGN} = await import('../src/techne/devices/designDevices.ts')
  resetHolds()
  const {flow, port} = await portOf(SCORE.score)
  const draw = async line => (await bindingOf(port)).write([{key: 'flow.draw', value: JSON.stringify(line)}])
  await draw({from: 'agent/anima-mythos', to: 'eros-verify', kind: 'allocation'})
  await draw({from: 'logos-scope-plan', to: 'sophia-finish', kind: 'handoff'})
  assert.deepEqual(JSON.parse(heldFor(CANVAS_DESIGN)[flow.DRAWN]), {run: RUN, lines: [{from: 'agent/anima-mythos', to: 'eros-verify', kind: 'allocation'},
    {from: 'logos-scope-plan', to: 'sophia-finish', kind: 'handoff'}]}, 'held by the view for the workflow it was drawn on')
  const map = mapIn(await bindingOf(port))
  assert.deepEqual(map.lines.filter(line => line.proposed), [{from: 'agent/anima-mythos', to: 'eros-verify', kind: 'allocation', proposed: true},
    {from: 'logos-scope-plan', to: 'sophia-finish', kind: 'handoff', proposed: true}])
  // An allocation drawn from the task to the agent is the same allocation; drawn again, it is taken back.
  await draw({from: 'logos-scope-plan', to: 'sophia-finish', kind: 'handoff'})
  assert.equal(mapIn(await bindingOf(port)).lines.filter(line => line.proposed).length, 1, 'a waiting line drawn again is taken back')
  await assert.rejects(draw({from: 'agent/anima-eros', to: 'eros-verify', kind: 'handoff'}), /A hand-off runs from a task to a task/)
  await assert.rejects(draw({from: 'eros-verify', to: 'agent/anima-eros', kind: 'allocation'}), /Eros already takes eros-verify/)
  await assert.rejects(draw({from: 'techne-implement', to: 'eros-verify', kind: 'handoff'}), /eros-verify already waits on techne-implement/)
  await assert.rejects(draw({from: 'eros-verify', to: 'eros-verify', kind: 'handoff'}), /cannot hand on to itself/)
  await assert.rejects(draw({from: 'eros-verify', to: 'mythos-debug', kind: 'allocation'}), /An allocation runs from an agent or an agent set to a task/)
  await assert.rejects(draw({from: 'nowhere', to: 'eros-verify', kind: 'handoff'}), /Relate joins two nodes of the workflow/)
  const joined = {...SCORE.score, joins: [{key: 'checked', waitsFor: ['techne-implement'], releases: ['eros-verify'], join: 'all'}]}
  await assert.rejects((await bindingOf({...port, score: {...port.score, reading: joined}})).write([{key: 'flow.draw', value: JSON.stringify({from: 'join:checked', to: 'sophia-finish', kind: 'handoff'})}]),
    /A join is the agent set's/)
  // Another workflow chosen: these lines are not drawn on it.
  assert.deepEqual(flow.proposalsOf(heldFor(CANVAS_DESIGN), 'run:another'), [])
  resetHolds()
})

test('Promote sends the lines to Factory as one workflow edit at the byte revision read; admitted, they stand solid in the score read again; refused, Factory says why', async () => {
  const {resetHolds, heldFor, CANVAS_DESIGN} = await import('../src/techne/devices/designDevices.ts')
  const {factoryOwnerWrite} = await import('../src/agent/devices/ownerRoutes.ts')
  const {scoreEditOp} = await import('../src/agent/scoreBinding.ts')
  resetHolds()
  const {flow, port} = await portOf(SCORE.score)
  flow.resetFlowSaid()
  await assert.rejects((await bindingOf(port)).write([{key: 'flow.promote', value: true}]), /No line you drew waits/)
  // Factory through the kernel: the edit the binding sends is factory_owner workflow-edit, Factory's receipt the answer (REAL: allocate).
  const target = port.score.target
  const k = kernel(op => (op.op === 'factory_owner' && op.request.kind === 'workflow-edit' ? factoryAnswer(SCORE.allocate) : new Error('unexpected')))
  try {
    const real = {...port, edit: request => factoryOwnerWrite(k.transport, scoreEditOp(target, request).request, '`factory workflow edit`')}
    await (await bindingOf(real)).write([{key: 'flow.draw', value: JSON.stringify({from: 'eros-verify', to: 'agent/anima-mythos', kind: 'allocation'})}])
    await (await bindingOf(real, flow.flowSaidState())).write([{key: 'flow.promote', value: true}])
    assert.deepEqual(k.ops, [{op: 'factory_owner', request: {kind: 'workflow-edit', state_path: STATE, run_ref: RUN, request: {contract: 'factory.workflow-edit/v1',
      expectedRevision: SCORE.score.song.file.byteRevision, edits: [{op: 'allocate', units: ['eros-verify'], to: {kind: 'agent', ref: 'agent/anima-mythos'}}]}}}])
  } finally { k.restore() }
  assert.equal(heldFor(CANVAS_DESIGN)[flow.DRAWN], undefined, 'admitted: nothing waits')
  const said = flow.flowSaidState()
  assert.equal(said.check, 'admitted')
  assert.match(said.why, /Factory admits the line you drew into the song's file at blake3:0078afb4/)
  assert.match(said.why, /The Run performs the edition it was commissioned with/)
  // The score read again (REAL: Factory's score after that edit): the line stands solid, Mythos taking eros-verify.
  const after = await bindingOf({...port, score: {...port.score, reading: SCORE.score_allocated}}, said)
  assert.ok(mapIn(after).lines.some(line => line.kind === 'allocation' && line.from === 'agent/anima-mythos' && line.to === 'eros-verify' && !line.proposed))
  assert.equal(after.values['flow.check'], 'admitted')
  // A hand-off that closes a loop: Factory compiles the song with it and refuses (REAL: its cycle diagnostic), in its words; the line waits.
  const refusing = kernel(() => factoryRefusal(SCORE.cycle))
  try {
    const real = {...port, edit: request => factoryOwnerWrite(refusing.transport, scoreEditOp(target, request).request, '`factory workflow edit`')}
    await (await bindingOf(real)).write([{key: 'flow.draw', value: JSON.stringify({from: 'sophia-finish', to: 'logos-scope-plan', kind: 'handoff'})}])
    await assert.rejects((await bindingOf(real)).write([{key: 'flow.promote', value: true}]), {message: SCORE.cycle.error.message})
    assert.deepEqual(refusing.ops[0].request.request.edits, [{op: 'connect', unit: 'logos-scope-plan', waitsOn: 'sophia-finish'}])
  } finally { refusing.restore() }
  const refused = await bindingOf(port, flow.flowSaidState())
  assert.equal(refused.values['flow.check'], 'refused')
  assert.equal(refused.values['flow.checkWhy'], SCORE.cycle.error.message, 'Factory\'s words, nothing added')
  assert.equal(mapIn(refused).lines.filter(line => line.proposed).length, 1, 'the refused line still waits, amber')
  // A song no file under the project root holds: Factory writes no edit, and Promote says why before asking.
  const unfiled = {...SCORE.score, song: {...SCORE.score.song, file: null, why: 'the song\'s file left the project root'}}
  await assert.rejects((await bindingOf({...port, score: {...port.score, reading: unfiled}})).write([{key: 'flow.promote', value: true}]),
    /Factory writes no edit of this song: the song's file left the project root/)
  flow.resetFlowSaid()
  resetHolds()
})

test('the routine that starts the workflow is the AIKit routine whose invocation Factory continued into the Run; a Run none continued has none', async () => {
  const flow = await import('../src/techne/devices/flowBinding.ts')
  const {workflows} = flow.workflowsOf(TRACKS, session => TAKES[session] ?? null)
  // REAL: Central's root run reading names no routine invocation; only Factory is asked.
  const quiet = kernel(op => (op.op === 'factory_development_read' ? factoryAnswer(JOURNEY.run) : new Error('unexpected')))
  try {
    assert.deepEqual(await flow.readStarts(quiet.transport, workflows[0]), {state: 'read', routines: []})
    assert.deepEqual(quiet.ops, [{op: 'factory_development_read', state_path: STATE, read: 'run', subject: RUN}])
  } finally { quiet.restore() }
  // DERIVED: the same run reading naming one AIKit invocation (another Run's state, so the window holds no answer for it); SCRIPTED: AIKit's
  // history and list in the session's project.
  const invoked = {...JOURNEY.run, routineInvocationRefs: ['invocation:weekday-1']}
  const other = {...workflows[0], statePath: '/walk/invoked/.factory/development-state.json'}
  const history = [{invocation_ref: 'invocation:weekday-1', routine_ref: 'routine:weekdays', method_ref: 'method:release', trigger_observed_at: '2026-11-03T08:00:00Z'}]
  const listed = {routines: [{routine: 'routine:weekdays', name: 'Weekdays 08:00', method: 'method:release', method_revision: 'r1', state: 'enabled', trigger: {kind: 'schedule'}}],
    foreign_reconciliation: {providers: []}}
  const asked = kernel(op => (op.op === 'factory_development_read' ? factoryAnswer(invoked) : op.op === 'routine'
    ? {result: 'routine', data: op.request.action === 'history' ? history : listed} : new Error('unexpected')))
  let starts
  try {
    starts = await flow.readStarts(asked.transport, other)
    assert.deepEqual(asked.ops, [{op: 'factory_development_read', state_path: other.statePath, read: 'run', subject: RUN}, {op: 'routine', project: 'song-maker', request: {action: 'history'}}, {op: 'routine', project: 'song-maker', request: {action: 'list'}}])
  } finally { asked.restore() }
  assert.deepEqual(starts, {state: 'read', routines: [{ref: 'routine:weekdays', name: 'Weekdays 08:00', when: 'schedule'}]})
  const map = flow.flowOfScore(SCORE.score, [], starts.routines)
  assert.deepEqual(map.nodes.find(node => node.kind === 'trigger'), {id: 'routine:weekdays', kind: 'trigger', name: 'Weekdays 08:00 · schedule', col: 0, row: 0,
    says: 'A routine in Settings, Automations'})
  assert.deepEqual(map.lines.filter(line => line.kind === 'start'), [{from: 'routine:weekdays', to: 'logos-scope-plan', kind: 'start'}], 'it starts the unit that waits on none')
  assert.equal(map.nodes.find(node => node.id === 'logos-scope-plan').col, 1, 'the work begins after the tag')
  // An invocation AIKit's history does not hold: the starts stand absent, saying which.
  const lost = kernel(op => (op.op === 'factory_development_read' ? factoryAnswer(invoked) : op.op === 'routine'
    ? {result: 'routine', data: op.request.action === 'history' ? [] : listed} : new Error('unexpected')))
  try {
    const absent = await flow.readStarts(lost.transport, other)
    assert.equal(absent.state, 'absent')
    assert.match(absent.why, /names AIKit invocation invocation:weekday-1, which AIKit's routine history in song-maker does not hold/)
  } finally { lost.restore() }
  const {port} = await portOf(SCORE.score, {starts: {state: 'absent', why: 'AIKit is not reached.'}})
  assert.equal((await bindingOf(port)).standing['flow.starts'].disabled, 'AIKit is not reached.', 'unread starts are never a zero')
})

test('Open is the shell\'s act: a task in Clip view with its note chosen, a song with its score open, a routine in Settings, Automations', async () => {
  const home = await import('../src/frame/openWhereItLives.ts')
  const {viewHoldsOf, clipHostId, resetViewHolds} = await import('../src/frame/detail/clipBinding.ts')
  const {getSettingsHostSnapshot, openSettings} = await import('../src/settings/host.ts')
  resetViewHolds()
  const doors = []
  home.publishClipHomeDoor(asked => { doors.push(asked) })
  try {
    const {port} = await portOf(SCORE.score, {open: home.openWhereItLives})
    const open = async id => (await bindingOf(port)).write([{key: 'flow.open', value: id}])
    // A unit another task names opens on that task's clip; one no task names opens on the workflow's home clip; its note is chosen.
    await open('mythos-debug')
    const mythosClip = port.units.get(unitRefOf(SCORE.score, 'mythos-debug'))
    assert.deepEqual(doors.pop(), {kind: 'clip', mode: 'factory', clip: mythosClip.ref, title: 'debug what failed', track: mythosClip.track,
      view: {id: clipHostId('factory', mythosClip.ref), holds: {'view.editor': 'notes', unit: 'mythos-debug', 'score.open': undefined}}})
    assert.deepEqual(viewHoldsOf(clipHostId('factory', mythosClip.ref)), {'view.editor': 'notes', unit: 'mythos-debug'}, 'Clip view shows Notes with the note chosen')
    await open('logos-scope-plan')
    assert.equal(doors.pop().clip, port.chosen.clip.ref)
    // A song standing as one unit opens with its score open inside its note.
    const {port: songs} = await portOf(SONGS.score_after, {open: home.openWhereItLives})
    await (await bindingOf(songs)).write([{key: 'flow.open', value: 'release-check'}])
    const song = doors.pop()
    assert.deepEqual(viewHoldsOf(song.view.id), {'view.editor': 'notes', unit: 'release-check', 'score.open': 'release-check'})
    await assert.rejects(open('agent/anima-eros'), /Open takes a task, a song or a routine/)
    // A routine opens on Automations in its work context, the routine chosen.
    const {port: started} = await portOf(SCORE.score, {open: home.openWhereItLives, starts: {state: 'read', routines: [{ref: 'routine:weekdays', name: 'Weekdays 08:00', when: 'schedule'}]}})
    await (await bindingOf(started)).write([{key: 'flow.open', value: 'routine:weekdays'}])
    const request = getSettingsHostSnapshot().request
    assert.equal(request.page, 'automations')
    assert.equal(request.routine, 'routine:weekdays')
    assert.deepEqual(request.scope, {scope_kind: 'project', scope_ref: 'song-maker'})
    openSettings(null)
  } finally { home.publishClipHomeDoor(null); resetViewHolds() }
  // With no frame's door, opening a clip says so.
  const {port} = await portOf(SCORE.score, {open: home.openWhereItLives})
  await assert.rejects((await bindingOf(port)).write([{key: 'flow.open', value: 'eros-verify'}]), {message: home.NO_CLIP_HOME})
  // The frame's half: App hands its mode switch and its selection to the door; Settings takes the routine a request names.
  const app = await source('../src/App.tsx'), settings = await source('../src/settings/SettingsWorkspace.tsx')
  assert.match(app, /useClipHomeDoor\(frameMode, chooseMode, selectTrackItem\)/)
  assert.match(settings, /request\.page==='automations'&&request\.routine\)\{[^}]*hold\('routine',request\.routine\)/)
})

test('the Flow page says agent set, never team; the design draws the map, the workflows to choose, To, Relate and Promote', async () => {
  const {renderToStaticMarkup} = await import('react-dom/server')
  const {design} = await import('../src/inhabitants/catalogue/panels/techne__canvas.tsx')
  for (const path of ['../src/inhabitants/catalogue/panels/techne__canvas.tsx', '../src/techne/devices/flowBinding.ts', '../src/techne/devices/frameBindings.ts']) {
    assert.doesNotMatch(await source(path), /\bteams?\b/i, `${path} says agent set`)
  }
  const nav = {fold() {}, full() {}, unfold() {}, select() {}}
  const {port} = await portOf(SCORE.score)
  const binding = await bindingOf(port)
  const values = {...binding.values, 'flow.node': 'eros-verify', 'flow.to': 'mythos-debug'}
  const markup = unescape(renderToStaticMarkup(design.whole({v: values, set() {}, nav, page: 'flow', setPage() {}, standing: binding.standing})))
  for (const words of ['development-and-knowledge', 'Workflow', 'To', 'Relate', 'Promote', 'eros-verify · task', 'Anima · agent set', 'Eros · agent']) assert.ok(markup.includes(words), words)
  // The sample: the hand-off its fixture names, its sets drawn as diamonds.
  const sample = unescape(renderToStaticMarkup(design.whole({v: design.defaults, set() {}, nav, page: 'flow', setPage() {}})))
  assert.ok(sample.includes('Reviewers · agent set'))
})
