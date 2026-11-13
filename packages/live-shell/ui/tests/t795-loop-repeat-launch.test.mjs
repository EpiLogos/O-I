// O-I #795: Loop and Repeat run as the manual says (DLW.md, Clip view: The Clip panel and The Launch panel). The shell's half:
// "Gate runs it only while you hold the launch. Toggle starts it with one press and stops it with the next. Repeat launches it again
// … each run a take of its own" — the press and release of a task's launch on the Session grid; a Repeat's takes made through
// Actuation's comparison run (kernel actuation_write comparison-run) with the set started and ended on AIKit, whose settings refuse
// Repeat's fields while the takes run ("Once the first run starts, these do not change"). Channels: FIXTURE readings shaped as the
// owners give them (aikit.encounter-session-settings/v1 with task.takes; the kernel's reading of Actuation's ql-series1-run/0.3
// manifest); a SCRIPTED kernel behind the bridge's fetch; production modules in memory through the TypeScript loader.
import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'

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

globalThis.document = {getElementById: () => null, createElement: () => ({}), head: {appendChild: () => {}}}
const {NOT_FACTORY_WORK} = await import('../src/timeline/factoryTrackAdapter.ts')
const {taskLaunchPort} = await import('../src/agent/factoryTaskActs.ts')
const {clipLaunchPress} = await import('../src/inhabitants/catalogue/panels/dlw__session-grid.tsx')
const settings = await import('../src/agent/sessionSettings.ts')
const factory = await import('../src/agent/clipBinding.ts')
const {settingsReadingEntry} = await import('../src/owners/readers.ts')
const {trackKey} = await import('../src/agent/agentRunModel.ts')

const NOW = Date.UTC(2026, 9, 28, 12, 0, 0)
const session = (state, n = 1) => ({sessionRef: 'ses-795', purpose: 'run the fixtures', agentRef: null, agentName: 'Fizz', agentAccepted: true,
  spaceRef: 'space:795', spaceLabel: null, depth: 0, parentRef: null, group: false, memberRefs: [], needle: null, telemetryOn: true,
  budget: {used: null, max: null}, disclosure: null, tasks: [
    {n, title: 'run the fixtures', state, startUnixMs: NOW - 60_000, lastActivityUnixMs: NOW - 1_000, softStop: false, disclosure: null, taskRef: 'task:fixtures'},
    {n: n + 1, title: null, state: 'unknown', startUnixMs: null, lastActivityUnixMs: null, softStop: true, disclosure: null}]})
// ---------------------------------------------------------------------------------------------------------------- A Factory task's ▶

// (BD r24, O-I 804) A task AIKit names a task_ref for is Factory's work, so its Launch is the task's own, the one the Agent rack presses
// (agent/factoryTaskActs.ts launchSessionTask, taskBindings.ts launchTask), and its stop Factory's Stop after of its unit
// (stopAfterTask); a task that is not Factory's work (no Factory state, no unit Factory names, no attempt of it current) says so before
// anything of Factory's moves. The grid's ▶ on Factory's Set waits for that Launch to be the Set's own Action (O-I #1006): Factory's Set
// is the kernel's since O-I #1004, and its acts are Actions of the registry, so the carrier is proved here as the rack presses it.
test('(BD r24) the ▶\'s carrier: Factory locates the session\'s register, and the rack\'s own Launch and Stop after run there in their owners\' words', async () => {
  const sent = []
  const answers = {
    locate: {locations: [{state: 'located', project: 'O-I', location: {statePath: '/state/o-i', projectRef: 'project:o-i'}}]},
    'custody-list': {schema: 'factory.work-custody-listing/v1', project_ref: 'project:o-i', count: 1, custody: [{schema: 'factory.work-custody/v1',
      custody_ref: 'custody:c1', position_ref: 'central:position:o-i:builder', work_ref: 'task:fixtures', state: 'in-progress', run_ref: 'run:r1', workflow_unit_ref: 'unit:build'}]},
    'attempt-launch': {contract: 'oi.factory-attempt-launch/v1', runRef: 'run:r1', workflowUnitRef: 'unit:build', status: 'launched', changed: true,
      attemptRef: 'attempt:01', taskRef: 'task:fixtures', refusal: null},
    'attempt-task-units': {contract: 'factory.attempt-task-units-reading/v1', taskRef: 'task:fixtures', units: [{runRef: 'run:r1', workflowUnitRef: 'unit:build',
      currentAttemptRef: 'attempt:01', status: 'running', attempts: 1, runRevision: 2, required: true}]},
    'attempt-request-cancellation': {status: 'cancel-requested', refusal: null},
  }
  globalThis.fetch = async (_url, init) => {
    const op = JSON.parse(init.body)
    sent.push(op)
    const ok = (result, data, extra = {}) => ({json: async () => ({ok: true, outcome: {result, data, receipts: [], ...extra}})})
    if (op.op === 'factory_owner') return ok('factory_development_reading', answers[op.request.kind])
    if (op.op === 'encounter' && op.request.action === 'model-read') return ok('encounter_reading', {agent_session: 'ses-795', native_session_id: 'native-1',
      standing: 'observed', model_observation: {current_model_id: 'claude-opus-5', available_models: [{modelId: 'claude-opus-5', name: 'Claude Opus 5'}], standing: 'observed'}})
    if (op.op === 'model_catalogue') return ok('model_catalogue_reading', {entries: [{model: 'model:claude-opus-5',
      declared_routes: [{kind: 'provider-native', provider: 'provider:anthropic', provider_native_ids: ['claude-opus-5']}]}]})
    if (op.op === 'aikit_write') return ok('owner_route_reading', {realisation: {schema: 'aikit.model-realisation/v2', selected: true}}, {route: 'aikit compose --realise'})
    return {json: async () => ({ok: false, error: `unexpected ${op.op}`})}
  }
  const asked = () => sent.splice(0).map(op => op.op === 'factory_owner' ? op.request.kind : op.op === 'encounter' ? op.request.action : op.op)
  const carrier = taskLaunchPort(transport, () => project)
  const launched = await carrier.launch('ses-795', 'task:fixtures')
  assert.deepEqual(launched, {ok: true, note: 'Software Factory launched unit:build of run:r1 for task:fixtures as attempt:01, on model:claude-opus-5 as AIKit realised it on ses-795.',
    document: {status: 'launched', attemptRef: 'attempt:01'}})
  const launchedOps = [...sent]
  assert.deepEqual(asked(), ['locate', 'custody-list', 'model-read', 'model_catalogue', 'aikit_write', 'attempt-launch'])
  assert.deepEqual(launchedOps[0].request, {kind: 'locate', project: 'O-I'}, 'located in the register the session was read under')
  assert.equal(launchedOps[5].request.state_path, '/state/o-i')
  assert.deepEqual(await carrier.stop('ses-795', 'task:fixtures'), {ok: true, note: 'Software Factory was asked to stop unit:build of run:r1, the unit task:fixtures stands current on.'})
  assert.deepEqual(asked(), ['locate', 'attempt-task-units', 'attempt-request-cancellation'])
  // Factory's own refusal comes back in its words; a register Factory keeps no state for asks nothing more.
  answers['attempt-launch'] = {...answers['attempt-launch'], status: 'refused', attemptRef: null, refusal: {source: 'owner', step: 'launch', message: 'Factory links run:r1 to no Journey'}}
  assert.deepEqual(await carrier.launch('ses-795', 'task:fixtures'), {ok: false, error: 'Factory links run:r1 to no Journey'})
  // Not Factory's work, said so before anything of Factory's moves: no unit named for the task, no attempt of it current, no Factory state.
  sent.length = 0
  answers['custody-list'] = {...answers['custody-list'], count: 0, custody: []}
  answers['attempt-task-units'] = {...answers['attempt-task-units'], units: []}
  const noUnit = await carrier.launch('ses-795', 'task:fixtures')
  assert.equal(noUnit.document.status, NOT_FACTORY_WORK); assert.match(noUnit.error, /^Launch: Factory names no unit for task:fixtures/)
  assert.deepEqual(asked(), ['locate', 'custody-list', 'attempt-task-units'], 'nothing realised, nothing launched')
  const noneCurrent = await carrier.stop('ses-795', 'task:fixtures')
  assert.equal(noneCurrent.document.status, NOT_FACTORY_WORK); assert.match(noneCurrent.error, /^Stop after: no attempt of task:fixtures is current/)
  assert.deepEqual(asked(), ['locate', 'attempt-task-units'])
  answers.locate = {locations: [{state: 'absent', project: 'O-I'}]}
  const absent = await carrier.launch('ses-795', 'task:fixtures')
  assert.equal(absent.ok, false); assert.equal(absent.document.status, NOT_FACTORY_WORK); assert.match(absent.error, /^Launch: Factory keeps no state for O-I/)
  assert.deepEqual(asked(), ['locate'])
})

test('the grid\'s launch button: a Gate clip launches on press and stops on release; every other clip launches on a click', () => {
  const pressed = []
  const onPress = (key, what, run) => pressed.push([key, what, run()])
  const launch = {op: 'op', run: id => `run ${id}`, release: id => `release ${id}`}
  const event = {button: 0, stopPropagation() {}, preventDefault() {}, currentTarget: {setPointerCapture() {}, hasPointerCapture: () => true, releasePointerCapture() {}}, pointerId: 1}
  const gate = clipLaunchPress({id: 'c1', label: 'One', launch: {mode: 'gate'}}, launch, onPress, 'clip:c1')
  assert.equal(gate.onClick !== undefined && gate.onPointerDown !== undefined && gate.onPointerUp !== undefined, true)
  gate.onPointerDown(event); gate.onPointerUp(event)
  assert.deepEqual(pressed.splice(0), [['clip:c1', 'Launch One', 'run c1'], ['clip:c1', 'Release One', 'release c1']])
  gate.onClick(event)
  assert.deepEqual(pressed, [], 'the click after a release is not a second launch')
  gate.onKeyDown({...event, key: ' ', repeat: false}); gate.onKeyDown({...event, key: ' ', repeat: true}); gate.onKeyUp({...event, key: ' '})
  assert.deepEqual(pressed.splice(0), [['clip:c1', 'Launch One', 'run c1'], ['clip:c1', 'Release One', 'release c1']], 'the keyboard holds the launch too')
  const toggle = clipLaunchPress({id: 'c2', label: 'Two', launch: {mode: 'toggle'}}, launch, onPress, 'clip:c2')
  assert.equal(toggle.onPointerDown, undefined)
  toggle.onClick(event)
  assert.deepEqual(pressed.splice(0), [['clip:c2', 'Launch Two', 'run c2']])
})

// ---------------------------------------------------------------------------------------------------------------- Repeat's takes

/** The owner's reading, every default stated (encounter_task_settings.rs `reading`). */
const reading = (overrides = {}, revision = 'session-settings/0') => ({
  schema: 'aikit.encounter-session-settings/v1', agent_session: 'ses-795', revision,
  track: {telemetry: true, solo: false, set: []},
  task: {task_ref: 'task:fixtures', name: 'run the fixtures', colour: null, active: true, register: 'plain', form: 'technical',
    loop: false, loop_until: 'done', loop_cap: null, launch: 'repeat', then: 'next', quantize: 'global', repeat_variable: 'condition',
    repeat_levels: [], repeat_repeats: 3, repeat_stop: 'done', envelope_mode: 'automation', envelope_linked: true,
    effort: [], tool_calls: [], set: ['launch'], takes: null, ...overrides},
  previous_task: null, standing: 'intent',
})
/** The kernel's reading of a comparison run (owner_routes.rs takes_of over Actuation's REAL manifest, 28 Oct 2026). */
const takesOf = (trace, n) => ({schema: 'ql-series1-run/0.3', trace_ref: trace, root: `/oi/desktop/takes/${trace}`, manifest_path: `/oi/desktop/takes/${trace}/manifest.json`,
  takes: n, records: [], held_constants_valid: true, determination: 'pending-human-review', provider_mode: 'fixture', human_acceptance: false})

/** A scripted kernel: AIKit's settings (a revision per change, takes kept as AIKit keeps them) and Actuation's comparison run. */
function scriptedKernel(start, comparison = request => ({ok: true, outcome: {result: 'owner_route_reading', route: 'actuation-research comparison.run', data: takesOf(request.trace_ref, 9), receipts: []}})) {
  const kernel = {reading: start, sent: [], revisions: 0}
  globalThis.fetch = async (_url, init) => {
    const op = JSON.parse(init.body)
    kernel.sent.push(op)
    const answer = data => ({json: async () => ({ok: true, outcome: {result: 'encounter_session_settings_reading', data, receipts: []}})})
    if (op.op === 'actuation_write') return {json: async () => comparison(op.request.request)}
    if (op.op !== 'encounter_session_settings') return {json: async () => ({ok: false, error: `unexpected ${op.op}`})}
    if (!op.request) return answer(kernel.reading)
    if ((op.expected_revision ?? null) !== kernel.reading.revision)
      return {json: async () => ({ok: false, error: 'encounter.runtime: Session settings revision conflict; read the current settings and write again'})}
    const task = {...kernel.reading.task}
    const act = op.request.takes
    if (act?.start) task.takes = {trace_ref: act.start.trace_ref, started_at_unix_ms: 1, running: true, variable: task.repeat_variable,
      levels: task.repeat_levels, repeats: task.repeat_repeats, stop: task.repeat_stop, ended: null}
    if (act?.end) task.takes = {...task.takes, running: false, ended: {at_unix_ms: 2, outcome: act.end.outcome,
      ...(act.end.takes !== undefined ? {takes: act.end.takes} : {}), ...(act.end.root ? {root: act.end.root} : {}), ...(act.end.reason ? {reason: act.end.reason} : {})}}
    kernel.reading = {...kernel.reading, revision: `session-settings/${++kernel.revisions}`, task}
    return answer(kernel.reading)
  }
  return kernel
}
const transport = {kind: 'bridge', url: 'http://owner.test'}
// The register the session was read under (agent/worldScope.ts). REPLACED (O-I #740 lane B): factory.SETTINGS_PROJECT, one literal project.
const project = 'O-I'
async function readSettings() {
  const entry = settingsReadingEntry(transport, project, 'ses-795')
  await entry.retry(`epoch-${Math.random()}`)
  return entry
}
/** The run every take shares, in Actuation's own words: the session's own task (a provided task, here with the test a Test pass reads)
 * and its agent as the body (an agent-jsonl process that reads back the level it is given). Its carrier is AIKit's; this is what one
 * hands the shell. */
const research = {run: {task: {id: 'task:fixtures', prompt: 'Run the fixtures.', successConditions: ['the fixtures pass'],
    test: {program: '/usr/bin/grep', args: ['-qx', 'pass', 'fixtures.out'], timeout_ms: 10000, output_limit: 65536}},
  max_steps: 4, max_calls: 16, body: {protocol: 'agent-jsonl', fixture_provider: false, session_timeout_ms: 600000,
    configuration: {provider: 'anthropic', model: 'claude-x', agent: 'agent:ses-795'}, process: {program: '/opt/aikit', args: [], cwd: '/',
      environment: {}, timeout_ms: 600000, output_limit: 1048576}}}, basis: {host_id: 'ordinary'}}

test('Repeat\'s takes: the set starts on AIKit, Actuation\'s comparison run makes the takes, and the set ends with what it made', async () => {
  const kernel = scriptedKernel(reading())
  await readSettings()
  const made = await settings.makeTakes(transport, project, 'ses-795', research, () => 1_793_000_000_000)
  assert.equal(made.ok, true, made.error); assert.match(made.note, /9 takes/)
  const writes = kernel.sent.filter(op => op.request)
  const trace = writes[0].request.takes.start.trace_ref
  assert.match(trace, /^takes:ses-795:/)
  assert.deepEqual(writes.map(op => op.op), ['encounter_session_settings', 'actuation_write', 'encounter_session_settings'])
  assert.deepEqual(writes[0].request, {takes: {start: {task_ref: 'task:fixtures', trace_ref: trace}}})
  assert.equal(writes[0].expected_revision, 'session-settings/0', 'started against the revision that stands')
  assert.deepEqual(writes[1].request, {kind: 'comparison-run', request: {trace_ref: trace, repetitions: 3, variable: 'condition',
    stop: {when: 'done'}, run: research.run, basis: research.basis}},
    'Repeats are the comparison\'s repetitions, Stop when its stop; no levels chosen, so Actuation runs its own default three conditions')
  assert.deepEqual(writes[2].request, {takes: {end: {task_ref: 'task:fixtures', trace_ref: trace, outcome: 'made', takes: 9, root: `/oi/desktop/takes/${trace}`}}})
  assert.equal(writes[2].expected_revision, 'session-settings/1')
  assert.equal(kernel.reading.task.takes.ended.outcome, 'made')
})

test('Repeat\'s variable, levels and stop when are the comparison\'s: a setting of the session\'s agent varies over its levels', async () => {
  for (const [variable, levels, stop] of [['effort', ['low', 'high'], 'pass'], ['model', ['claude-x', 'claude-y'], 'turns'],
    ['tool_calls', ['session'], 'time'], ['skillset', ['a', 'b', 'c'], 'done'], ['budget', ['10'], 'done']]) {
    const kernel = scriptedKernel(reading({repeat_variable: variable, repeat_levels: levels, repeat_repeats: 2, repeat_stop: stop}))
    await readSettings()
    const made = await settings.makeTakes(transport, project, 'ses-795', research)
    assert.equal(made.ok, true, `${variable}: ${made.error}`)
    const writes = kernel.sent.filter(op => op.request)
    assert.deepEqual(writes[1].request.request, {trace_ref: writes[0].request.takes.start.trace_ref, repetitions: 2, variable, levels,
      stop: {when: stop}, run: research.run, basis: research.basis}, variable)
  }
})

test('Repeat\'s levels are the comparison\'s conditions; a run that fails ends the set failed, in Actuation\'s words', async () => {
  const kernel = scriptedKernel(reading({repeat_levels: ['classic', 'ql-deep'], repeat_repeats: 2}),
    () => ({ok: false, error: 'owner-refused-or-failed: comparison requires an empty dedicated root'}))
  await readSettings()
  const made = await settings.makeTakes(transport, project, 'ses-795', research)
  assert.equal(made.ok, false); assert.match(made.error, /comparison requires an empty dedicated root/)
  const writes = kernel.sent.filter(op => op.request)
  assert.equal(writes[1].request.request.variable, 'condition')
  assert.deepEqual(writes[1].request.request.levels, ['classic', 'ql-deep']); assert.equal(writes[1].request.request.repetitions, 2)
  assert.equal(writes[2].request.takes.end.outcome, 'failed')
  assert.match(writes[2].request.takes.end.reason, /comparison requires an empty dedicated root/)
})

test('Repeat refuses, before any write, what Actuation\'s comparison run cannot make', async () => {
  for (const [over, said] of [
    [{launch: 'trigger'}, /Launch mode to Repeat/],
    [{repeat_variable: 'model', repeat_levels: []}, /Repeat's levels[\s\S]*model/],
  ]) {
    const kernel = scriptedKernel(reading(over))
    await readSettings()
    const made = await settings.makeTakes(transport, project, 'ses-795', research)
    assert.equal(made.ok, false); assert.match(made.error, said)
    assert.deepEqual(kernel.sent.filter(op => op.request), [], 'nothing is written')
  }
  // An AIKit before O-I 795's take body hands no run with the settings: the press names what is missing — AIKit's carrier of the
  // session's task and agent — and not Actuation, which runs a session's own task with its agent as the body over any variable.
  const kernel = scriptedKernel(reading({repeat_variable: 'effort', repeat_levels: ['low', 'high']}))
  await readSettings()
  const bare = await settings.makeTakes(transport, project, 'ses-795', null)
  assert.equal(bare.ok, false); assert.match(bare.error, /missing op: [^.]*\(AIKit\)/)
  assert.doesNotMatch(bare.error, /varies the condition only|research catalogue|\(Actuation/)
  // AIKit hands its refusal instead of a run (a session whose agent never opened): the press says AIKit's words and writes nothing.
  const never = 'The session\'s agent has never opened: a take runs a fresh resident of the agent the session opened on.'
  const refused = await settings.makeTakes(transport, project, 'ses-795', {refused: never})
  assert.equal(refused.ok, false); assert.match(refused.error, /AIKit has no run for this session's takes/)
  assert.ok(refused.error.includes(never), refused.error)
  assert.deepEqual(kernel.sent.filter(op => op.request), [])
})

/** The run AIKit hands with the session's settings (ai-kit encounter_take_body.rs take_run, as `aikit session-space
 * encounter-session-settings` reads it on a scratch home, 28 Oct 2026): the bound task as Actuation's provided task and the session's
 * own agent as an agent-jsonl body — AIKit itself, `encounter-take-body`. */
const handed = {run: {task: {id: 'task:fixtures', prompt: 'run the fixtures', successConditions: []},
  body: {protocol: 'agent-jsonl', fixture_provider: false, session_timeout_ms: 1800000,
    configuration: {provider: 'take-peer', model: 'test/a', agent: 'ses-795'},
    process: {program: '/opt/aikit/bin/aikit', args: ['session-space', 'encounter-take-body', '--session', 'ses-795', '--socket', '/tmp/aikit-0/owner.sock'],
      cwd: '/', environment: {AIKIT_HOME: '/home/me/.aikit'}, timeout_ms: 1800000, output_limit: 16777216}},
  max_steps: 8, max_calls: 64},
  basis: {host_id: 'aikit-encounter-take-body', host_revision: '0.1.0', benchmark_revision: 'own-task', runner_revision: '0.1.0',
    review_contract_revision: null, network_policy_digest: null}}

test('AIKit\'s run for the takes reads off the session\'s settings: a run, AIKit\'s refusal, or nothing from an AIKit before it', () => {
  assert.deepEqual(settings.takeRunOf(reading({take_run: handed}).task), handed)
  assert.deepEqual(settings.takeRunOf(reading({take_run: {refused: 'never opened'}}).task), {refused: 'never opened'})
  assert.equal(settings.takeRunOf(reading().task), null, 'an AIKit before the take body hands nothing')
  assert.equal(settings.takeRunOf(null), null)
})

test('Repeat\'s press runs the takes over the run AIKit hands with the session\'s settings', async () => {
  const start = reading({repeat_variable: 'effort', repeat_levels: ['low', 'high'], repeat_repeats: 1, repeat_stop: 'turns', take_run: handed})
  const kernel = scriptedKernel(start)
  await readSettings()
  // The run AIKit hands with the session's settings (takeRunOf), in the session's own register (agent/worldScope.ts).
  const made = await settings.makeTakes(transport, project, 'ses-795', settings.takeRunOf(start.task))
  assert.equal(made.ok, true, made.error)
  const writes = kernel.sent.filter(op => op.request)
  assert.deepEqual(writes.map(op => op.op), ['encounter_session_settings', 'actuation_write', 'encounter_session_settings'])
  assert.deepEqual(writes[1].request.request, {trace_ref: writes[0].request.takes.start.trace_ref, repetitions: 1, variable: 'effort',
    levels: ['low', 'high'], stop: {when: 'turns'}, run: handed.run, basis: handed.basis})
  // Test pass reads the task's own test, and AIKit's run carries none: refused before any write, not after AIKit starts a set.
  const passing = reading({repeat_variable: 'effort', repeat_levels: ['low'], repeat_stop: 'pass', take_run: handed})
  const untested = scriptedKernel(passing)
  await readSettings()
  const pass = await settings.makeTakes(transport, project, 'ses-795', settings.takeRunOf(passing.task))
  assert.equal(pass.ok, false); assert.match(pass.error, /Test pass[\s\S]*test/)
  assert.deepEqual(untested.sent.filter(op => op.request), [])
  // Settings that hand AIKit's refusal: the press says it, before any write.
  const refusing = reading({take_run: {refused: 'The session\'s agent has never opened.'}})
  const quiet = scriptedKernel(refusing)
  await readSettings()
  const said = await settings.makeTakes(transport, project, 'ses-795', settings.takeRunOf(refusing.task))
  assert.equal(said.ok, false); assert.match(said.error, /never opened/)
  assert.deepEqual(quiet.sent.filter(op => op.request), [])
})

test('Clip view: while the takes run, Repeat\'s fields stand disabled with the manual\'s words, and the takes made stand read', async () => {
  const track = session('running')
  const ref = `${trackKey(track)}#task/1`
  scriptedKernel(reading({takes: {trace_ref: 'takes:t1', started_at_unix_ms: 1, running: true, variable: 'condition', levels: [], repeats: 3, stop: 'done', ended: null}}))
  const entry = await readSettings()
  const running = factory.factoryClipBinding({ref, tracks: [track], events: null, settings: {transport, project, settings: entry.snapshot().value}})
  for (const key of ['repeat.variable', 'repeat.levels', 'repeat.repeats', 'repeat.stop'])
    assert.match(running.standing[key]?.disabled ?? '', /Once the first run starts, these do not change/, key)
  assert.equal(running.standing.launch, undefined, 'the launch mode is not one of them')
  scriptedKernel(reading({takes: {trace_ref: 'takes:t1', started_at_unix_ms: 1, running: false, variable: 'condition', levels: [], repeats: 3, stop: 'done',
    ended: {at_unix_ms: 2, outcome: 'made', takes: 9, root: '/oi/desktop/takes/t1'}}}))
  const ended = await readSettings()
  const after = factory.factoryClipBinding({ref, tracks: [track], events: null, settings: {transport, project, settings: ended.snapshot().value}})
  assert.equal(after.values.takes, 9, 'the takes the set made')
  for (const key of ['repeat.variable', 'repeat.levels', 'repeat.repeats', 'repeat.stop']) assert.equal(after.standing[key], undefined, `${key}: a change starts a new set`)
})
