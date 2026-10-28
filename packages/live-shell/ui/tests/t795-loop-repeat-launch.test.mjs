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
const {factoryTrackAdapter} = await import('../src/timeline/factoryTrackAdapter.ts')
const {clipLaunchPress} = await import('../src/frame/tracks/SessionGrid.tsx')
const settings = await import('../src/agent/sessionSettings.ts')
const factory = await import('../src/agent/clipBinding.ts')
const {settingsReadingEntry} = await import('../src/owners/readers.ts')
const {trackKey} = await import('../src/agent/agentRunModel.ts')
const {repeatPress} = await import('../src/frame/tracks/useFactoryTracks.ts')

const NOW = Date.UTC(2026, 9, 28, 12, 0, 0)
const session = (state, n = 1) => ({sessionRef: 'ses-795', purpose: 'run the fixtures', agentRef: null, agentName: 'Fizz', agentAccepted: true,
  spaceRef: 'space:795', spaceLabel: null, depth: 0, parentRef: null, group: false, memberRefs: [], needle: null, telemetryOn: true,
  budget: {used: null, max: null}, disclosure: null, tasks: [
    {n, title: 'run the fixtures', state, startUnixMs: NOW - 60_000, lastActivityUnixMs: NOW - 1_000, softStop: false, disclosure: null, taskRef: 'task:fixtures'},
    {n: n + 1, title: null, state: 'unknown', startUnixMs: null, lastActivityUnixMs: null, softStop: true, disclosure: null}]})
const port = launch => ({of: () => ({telemetry: true, solo: false, task: {task_ref: 'task:fixtures', launch, then: 'next', quantize: 'global'}}),
  set: async () => ({ok: true, note: 'set'})})
/** The set as the grid gets it, with the harness's control, the session's own stop and (where handed) the Repeat's takes. */
function projected(state, launch, repeat) {
  const calls = [], stops = []
  const set = factoryTrackAdapter.project({tracks: [session(state)], nowUnixMs: NOW, settings: port(launch),
    controls: {control: async word => { calls.push(word); return {ok: true, note: word} }},
    sessionStop: async ref => { stops.push(ref); return {ok: true, note: 'stopped'} },
    ...(repeat ? {repeat} : {})})
  return {set, calls, stops, clip: set.clips[0]}
}

// ---------------------------------------------------------------------------------------------------------------- Gate, Toggle

test('Gate runs the task only while the launch is held: the press launches it, the release stops that session', async () => {
  const {set, calls, stops, clip} = projected('stalled', 'gate')
  assert.equal(clip.launch.mode, 'gate')
  assert.equal(typeof set.actions.launch.release, 'function', 'a launch the grid can release')
  const pressed = await set.actions.launch.run(clip.id)
  assert.equal(pressed.ok, true); assert.deepEqual(calls, ['restart'], 'the press launches as Trigger does')
  const released = await set.actions.launch.release(clip.id)
  assert.equal(released.ok, true); assert.match(released.note, /Gate/)
  assert.deepEqual(stops, ['ses-795'], 'the release stops the session it launched')
  // A press the owner refused launched nothing: its release stops nothing.
  const done = projected('done', 'gate')
  assert.equal((await done.set.actions.launch.run(done.clip.id)).ok, false)
  await done.set.actions.launch.release(done.clip.id)
  assert.deepEqual(done.stops, [], 'nothing was launched, so nothing is stopped')
  // The grid draws a new set on every render, the press's own receipt among the causes: the release reaches the set drawn then.
  const pressedOn = projected('stalled', 'gate'), releasedOn = projected('stalled', 'gate')
  assert.equal((await pressedOn.set.actions.launch.run(pressedOn.clip.id)).ok, true)
  assert.equal((await releasedOn.set.actions.launch.release(releasedOn.clip.id)).ok, true)
  assert.deepEqual(releasedOn.stops, ['ses-795'], 'what the press launched is released from the next render\'s set')
  // Another mode's release does nothing.
  const trigger = projected('stalled', 'trigger')
  await trigger.set.actions.launch.run(trigger.clip.id)
  assert.equal(await trigger.set.actions.launch.release(trigger.clip.id), undefined)
  assert.deepEqual(trigger.stops, [])
})

test('Toggle starts the task with one press and stops it with the next', async () => {
  const running = projected('running', 'toggle')
  const second = await running.set.actions.launch.run(running.clip.id)
  assert.equal(second.ok, true); assert.match(second.note, /Toggle/)
  assert.deepEqual(running.stops, ['ses-795'], 'a running task\'s press stops its session'); assert.deepEqual(running.calls, [])
  const stalled = projected('stalled', 'toggle')
  assert.equal((await stalled.set.actions.launch.run(stalled.clip.id)).ok, true)
  assert.deepEqual(stalled.calls, ['restart'], 'a task that is not running starts'); assert.deepEqual(stalled.stops, [])
  // Trigger is as it was: a running task's press is refused, before any owner call.
  const trigger = projected('running', 'trigger')
  assert.match((await trigger.set.actions.launch.run(trigger.clip.id)).error, /no op that launches a task in that state/)
  assert.deepEqual([trigger.calls, trigger.stops], [[], []])
})

test('Repeat makes the task\'s takes through the port the shell hands, or says what it waits for', async () => {
  const asked = []
  const repeat = async (sessionRef, label) => { asked.push([sessionRef, label]); return {ok: true, note: 'takes made'} }
  const handed = projected('done', 'repeat', repeat)
  assert.deepEqual(await handed.set.actions.launch.run(handed.clip.id), {ok: true, note: 'takes made'})
  assert.deepEqual(asked, [['ses-795', 'run the fixtures']]); assert.deepEqual(handed.calls, [], 'not the harness\'s launch')
  const bare = projected('done', 'repeat')
  const refused = await bare.set.actions.launch.run(bare.clip.id)
  assert.equal(refused.ok, false); assert.match(refused.error, /comparison run/)
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
    effort: [], autonomy: [], set: ['launch'], takes: null, ...overrides},
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
const project = factory.SETTINGS_PROJECT
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
    ['autonomy', ['review'], 'time'], ['skillset', ['a', 'b', 'c'], 'done'], ['budget', ['10'], 'done']]) {
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
  // The grid's press, as useFactoryTracks wires it: the settings the tracks read hand the run.
  const press = repeatPress(transport, ref => ref === 'ses-795' ? start : undefined)
  const made = await press('ses-795')
  assert.equal(made.ok, true, made.error)
  const writes = kernel.sent.filter(op => op.request)
  assert.deepEqual(writes.map(op => op.op), ['encounter_session_settings', 'actuation_write', 'encounter_session_settings'])
  assert.deepEqual(writes[1].request.request, {trace_ref: writes[0].request.takes.start.trace_ref, repetitions: 1, variable: 'effort',
    levels: ['low', 'high'], stop: {when: 'turns'}, run: handed.run, basis: handed.basis})
  // Test pass reads the task's own test, and AIKit's run carries none: refused before any write, not after AIKit starts a set.
  const passing = reading({repeat_variable: 'effort', repeat_levels: ['low'], repeat_stop: 'pass', take_run: handed})
  const untested = scriptedKernel(passing)
  await readSettings()
  const pass = await repeatPress(transport, () => passing)('ses-795')
  assert.equal(pass.ok, false); assert.match(pass.error, /Test pass[\s\S]*test/)
  assert.deepEqual(untested.sent.filter(op => op.request), [])
  // Settings that hand AIKit's refusal: the press says it, before any write.
  const refusing = reading({take_run: {refused: 'The session\'s agent has never opened.'}})
  const quiet = scriptedKernel(refusing)
  await readSettings()
  const said = await repeatPress(transport, () => refusing)('ses-795')
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
