// A Factory task's settings on their owner (AIKit `encounter-session-settings`, kernel `encounter_session_settings`): the Clip view's
// Clip and Launch panels and Envelopes, and the Tasks device's Mode, Then, Effort, Autonomy and style, read from the owner's
// reading and written to it against the revision that stands. Channels: FIXTURE readings shaped as the owner gives them
// (aikit.encounter-session-settings/v1); a SCRIPTED owner behind the kernel bridge's fetch that keeps the revision, refuses a stale
// one in its words and answers each change with its reading; production modules in memory through r2-clip-bindings' loader.
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

const settings = await import('../src/agent/sessionSettings.ts')
const factory = await import('../src/agent/clipBinding.ts')
const tasks = await import('../src/agent/devices/taskBindings.ts')
const {settingsReadingEntry} = await import('../src/owners/readers.ts')
const {trackKey} = await import('../src/agent/agentRunModel.ts')

// ---------------------------------------------------------------------------------------------------------------- fixtures

const T = (h, m) => Date.UTC(2026, 9, 8, h, m)
const track = {sessionRef: 'ses-214', purpose: 'correlate occurrences', agentRef: 'agent:fizz', agentName: 'Fizz', agentAccepted: true,
  spaceRef: 'space:lead', spaceLabel: null, depth: 0, parentRef: null, group: false, memberRefs: [], needle: null, telemetryOn: true,
  budget: {used: 2, max: 12}, disclosure: null, tasks: [
    {n: 1, title: 'correlate occurrences', state: 'running', startUnixMs: T(13, 41), lastActivityUnixMs: T(14, 24), softStop: false, disclosure: null},
    {n: 2, title: null, state: 'unknown', startUnixMs: null, lastActivityUnixMs: null, softStop: true, disclosure: null}]}
const taskRef = `${trackKey(track)}#task/1`

/** The owner's reading, every default stated (encounter_task_settings.rs `reading`). */
const defaults = (overrides = {}, revision = null) => ({
  schema: 'aikit.encounter-session-settings/v1', agent_session: 'ses-214', revision,
  track: {telemetry: true, solo: false, set: []},
  task: {task_ref: 'task:correlate', name: 'correlate occurrences', colour: null, active: true, register: 'plain', form: 'technical',
    loop: false, loop_until: 'done', loop_cap: null, launch: 'trigger', then: 'next', quantize: 'global', repeat_variable: 'condition',
    repeat_levels: [], repeat_repeats: 3, repeat_stop: 'done', envelope_mode: 'automation', envelope_linked: true,
    effort: [], autonomy: [], set: [], ...overrides},
  previous_task: null, standing: 'intent',
})

// A scripted owner behind the bridge: it keeps one session's settings, a revision per change, and refuses a stale one.
function scriptedOwner(start = defaults()) {
  const owner = {reading: start, sent: [], revisions: 0}
  globalThis.fetch = async (_url, init) => {
    const op = JSON.parse(init.body)
    owner.sent.push(op)
    const answer = data => ({json: async () => ({ok: true, outcome: {result: 'encounter_session_settings_reading', data, receipts: []}})})
    if (op.op !== 'encounter_session_settings') return {json: async () => ({ok: false, error: `unexpected ${op.op}`})}
    if (!op.request) return answer(owner.reading)
    if ((op.expected_revision ?? null) !== owner.reading.revision)
      return {json: async () => ({ok: false, error: 'encounter.runtime: Session settings revision conflict; read the current settings and write again'})}
    const task = {...owner.reading.task}
    for (const [key, value] of Object.entries(op.request.task?.set ?? {})) task[key] = value ?? defaults().task[key]
    const track = {...owner.reading.track, ...op.request.track}
    owner.reading = {...owner.reading, revision: `session-settings/${++owner.revisions}`, task, track}
    return answer(owner.reading)
  }
  return owner
}
const transport = {kind: 'bridge', url: 'http://owner.test'}
const project = factory.SETTINGS_PROJECT
async function readSettings() {
  const entry = settingsReadingEntry(transport, project, 'ses-214')
  await entry.retry('epoch-1')
  return entry
}
const contextOf = entry => ({transport, project, settings: entry.snapshot().value})

// ---------------------------------------------------------------------------------------------------------------- mapping

test('the owner\'s reading lands on clip:factory\'s keys: Quantize in the design\'s words, the envelopes as editor rows', () => {
  const values = settings.clipValuesOfSettings(defaults({name: 'Fixtures', colour: 'var(--fizz)', loop: true, launch: 'gate', then: 'again',
    quantize: 'next-tool', effort: [[0, 'medium'], [28, 'high']], autonomy: [[0, 'review']]}))
  assert.equal(values.name, 'Fixtures'); assert.equal(values.colour, 'var(--fizz)')
  // REPLACED (#787): #772 read the owner's loop as Loop with no launch mode and its handoff as no follow action, Hand off to beside it.
  // AIKit speaks the manual's words now, Loop its own setting and Hand off to retired: each lands as it is (factory-clip-owner-words.test.mjs).
  assert.equal(values.launch, 'gate'); assert.equal(values.loop, true); assert.equal(values.then, 'again'); assert.equal('handoff' in values, false)
  assert.equal(values.quantize, 'next tool', 'the owner\'s next-tool is the design\'s "next tool"')
  assert.deepEqual(JSON.parse(values['env.agent.effort']), [[0, 2], [28, 3]], 'Automation: a level is its row')
  assert.deepEqual(JSON.parse(values['env.agent.autonomy']), [[0, 2]])
  const stepped = settings.clipValuesOfSettings(defaults({envelope_mode: 'modulation', effort: [[0, -1], [30, 2]]}))
  assert.deepEqual(JSON.parse(stepped['env.agent.effort']), [[0, 1], [30, 4]], 'Modulation: −2…+2 on the five rows')
  assert.equal('colour' in settings.clipValuesOfSettings(defaults()), false, 'a null colour takes the track\'s: nothing stands in')
  assert.deepEqual(settings.clipValuesOfSettings(null), {})
  assert.deepEqual(settings.clipValuesOfSettings({...defaults(), task: null}), {}, 'no bound task, no task settings')
})

test('a control\'s change becomes the owner\'s request: its words, null for a cleared field, the points carried with a mode', () => {
  const reading = defaults({effort: [[0, 'medium'], [28, 'high']], autonomy: [[0, 'auto']]})
  const set = (setting, value) => settings.taskSettingChange(setting, value, reading).change.task.set
  // REPLACED (#787): #772 asked the owner its own word (hold) for the manual's Gate; AIKit's word is Gate. Hand off to (handoff_to) is
  // retired: the Tasks device's To names the drag that replaces it (factory-clip-owner-words.test.mjs).
  assert.deepEqual(set('launch', 'gate'), {launch: 'gate'})
  assert.deepEqual(set('quantize', 'next turn'), {quantize: 'next-turn'})
  assert.deepEqual(set('name', '  '), {name: null}, 'an emptied name returns to the task\'s purpose')
  assert.deepEqual(set('effort', JSON.stringify([[0, 1], [40, 4]])), {effort: [[0, 'low'], [40, 'max']]})
  assert.deepEqual(set('envelopeMode', 'modulation'), {envelope_mode: 'modulation', effort: [[0, 0], [28, 1]], autonomy: [[0, 1]]},
    'each point keeps its row, read as the new mode reads it')
  // REPLACED (#772): the launch pressed is a manual's word (Trigger), as the clip sends it.
  assert.equal(settings.taskSettingChange('launch', 'trigger', reading).change.task.task_ref, 'task:correlate', 'bound to the task it was made on')
  assert.equal(settings.taskSettingChange('launch', 'trigger', null).refused, settings.SETTINGS_WHY.reading)
  assert.equal(settings.taskSettingChange('launch', 'trigger', {...reading, task: null}).refused, settings.SETTINGS_WHY.noTask)
  assert.match(settings.taskSettingChange('active', 'yes', reading).refused, /on or off/)
})

test('the Tasks device reads one level at the task\'s time and sets one for the whole task', () => {
  const reading = defaults({effort: [[0, 'low'], [30, 'high']], autonomy: [[0, 'review']], launch: 'toggle', loop: true})
  assert.equal(settings.levelAt([[0, 'low'], [30, 'high']], 10, false), 'low')
  assert.equal(settings.levelAt([[0, 'low'], [30, 'high']], 45, false), 'high')
  assert.equal(settings.levelAt([], 45, false), 'inherit', 'an empty envelope inherits')
  assert.equal(settings.levelAt([[0, 1]], 5, true), null, 'a step is not a level')
  // REPLACED (#787): Mode read the owner's loop and To its handoff_to; Mode is AIKit's launch mode now and Hand off to is retired.
  assert.deepEqual(settings.tasksDeviceValues(reading, 45), {mode: 'toggle', then: 'next', register: 'plain', form: 'technical', effort: 'high', autonomy: 'review'})
  const stepped = {...reading, task: {...reading.task, envelope_mode: 'modulation', effort: [[0, 1]], autonomy: [[0, -1]]}}
  assert.equal('effort' in settings.tasksDeviceValues(stepped, 5), false, 'under Modulation the device draws no level')
  const change = settings.tasksDeviceChange('effort', 'max', stepped).change.task.set
  assert.deepEqual(change, {envelope_mode: 'automation', effort: [[0, 'max']], autonomy: [[0, 'suggest']]}, 'the other envelope carried into Automation')
  assert.deepEqual(settings.tasksDeviceChange('autonomy', 'inherit', reading).change.task.set.autonomy, [], 'Inherit clears the envelope')
  assert.deepEqual(settings.tasksDeviceChange('mode', 'gate', reading).change.task.set, {launch: 'gate'})
  assert.match(settings.tasksDeviceChange('to', 'ses-400', reading).refused, /drag the task onto that session's track/)
  assert.match(settings.tasksDeviceChange('effort', 'turbo', reading).refused, /Effort takes one of inherit, low, medium, high, max/)
})

// ---------------------------------------------------------------------------------------------------------------- on the owner

test('Clip view: every setting stands disabled saying why until the session\'s settings are read', () => {
  const unread = factory.factoryClipBinding({ref: taskRef, tracks: [track], events: null})
  // REPLACED (#787): Hand off to is retired; Loop and what a Repeat varies are the session's settings too.
  for (const key of ['name', 'launch', 'then', 'loop', 'loop.cap', 'repeat.levels', 'quantize', 'env.agent.effort', 'env.mode', 'active'])
    assert.equal(unread.standing[key]?.disabled, settings.SETTINGS_WHY.notHere, key)
  const reading = factory.factoryClipBinding({ref: taskRef, tracks: [track], events: null, settings: {transport, project, settings: null}})
  assert.equal(reading.standing.launch?.disabled, settings.SETTINGS_WHY.reading)
  const untasked = factory.factoryClipBinding({ref: taskRef, tracks: [track], events: null, settings: {transport, project, settings: {...defaults(), task: null}}})
  assert.equal(untasked.standing.launch?.disabled, settings.SETTINGS_WHY.noTask)
})

test('Clip view: the owner\'s values stand on the clip, and each change is written to the owner against the revision that stands', async () => {
  const owner = scriptedOwner(defaults({name: 'Fixtures', loop: true, launch: 'toggle', quantize: 'now'}, 'session-settings/0'))
  const entry = await readSettings()
  const binding = factory.factoryClipBinding({ref: taskRef, tracks: [track], events: null, settings: contextOf(entry)})
  assert.equal(binding.values.name, 'Fixtures', 'the name as set wins over the task\'s title')
  // REPLACED (#787): #772 read the owner's loop as Loop and no launch mode; AIKit keeps Loop and the launch mode apart.
  assert.equal(binding.values.loop, true); assert.equal(binding.values.launch, 'toggle'); assert.equal(binding.values.quantize, 'now')
  for (const key of ['launch', 'then', 'loop', 'loop.until', 'loop.cap', 'repeat.variable', 'repeat.levels', 'repeat.repeats', 'repeat.stop'])
    assert.equal(binding.standing[key], undefined, `${key}: enabled on its owner`)
  await binding.write([{key: 'then', value: 'stop'}])
  const write = owner.sent.find(op => op.request)
  assert.deepEqual(write, {op: 'encounter_session_settings', project: 'O-I', agent_session: 'ses-214', expected_revision: 'session-settings/0',
    request: {task: {task_ref: 'task:correlate', set: {then: 'stop'}}}})
  assert.equal(entry.snapshot().value.revision, 'session-settings/1', 'the standing reading is read again: every reader sees the change')
  assert.equal(entry.snapshot().value.task.then, 'stop')
  const next = factory.factoryClipBinding({ref: taskRef, tracks: [track], events: null, settings: contextOf(entry)})
  await next.write([{key: 'env.agent.effort', value: JSON.stringify([[0, 3]])}])
  assert.equal(owner.sent.filter(op => op.request).at(-1).expected_revision, 'session-settings/1', 'the next change is made on the new revision')
  assert.deepEqual(entry.snapshot().value.task.effort, [[0, 'high']])
})

test('Clip view: Loop and what a Repeat varies are written to AIKit in its words, against the revision that stands', async () => {
  const owner = scriptedOwner(defaults({}, 'session-settings/0'))
  const entry = await readSettings()
  const write = async (key, value) => factory.factoryClipBinding({ref: taskRef, tracks: [track], events: null, settings: contextOf(entry)}).write([{key, value}])
  await write('loop', true)
  await write('loop.cap', 5)
  await write('launch', 'repeat')
  await write('repeat.levels', 'opus, sonnet')
  await write('then', 'again')
  assert.deepEqual(owner.sent.filter(op => op.request).map(op => [op.expected_revision, op.request.task.set]), [
    ['session-settings/0', {loop: true}], ['session-settings/1', {loop_cap: 5}], ['session-settings/2', {launch: 'repeat'}],
    ['session-settings/3', {repeat_levels: ['opus', 'sonnet']}], ['session-settings/4', {then: 'again'}]])
  const read = factory.factoryClipBinding({ref: taskRef, tracks: [track], events: null, settings: contextOf(entry)}).values
  assert.deepEqual([read.loop, read['loop.cap'], read.launch, read['repeat.levels'], read.then], [true, 5, 'repeat', 'opus, sonnet', 'again'])
})

test('Clip view: a change made on a revision that moved is refused in the owner\'s words', async () => {
  const owner = scriptedOwner(defaults({}, 'session-settings/0'))
  const entry = await readSettings()
  const binding = factory.factoryClipBinding({ref: taskRef, tracks: [track], events: null, settings: contextOf(entry)})
  owner.reading = {...owner.reading, revision: 'session-settings/elsewhere'}
  // REPLACED (#772): the clip presses the manual's Gate (the owner's hold).
  await assert.rejects(binding.write([{key: 'launch', value: 'gate'}]), /Session settings revision conflict; read the current settings and write again/)
  assert.equal(entry.snapshot().value.revision, 'session-settings/elsewhere', 'the refusal reads the settings again')
})

test('Tasks device: Mode, To and a single Effort go to the owner; Launch, Retry and Stop after still name what they need', async () => {
  const owner = scriptedOwner(defaults({}, null))
  const entry = await readSettings()
  const input = {session: track, tracks: [track], nowUnixMs: T(14, 30), selectedTask: 1, agent: {}, settings: contextOf(entry)}
  const binding = tasks.tasksBinding(input, null, {selectTask() {}, queue: async () => {}})
  // REPLACED (#787): the Tasks device read the owner's once and wrote its loop; AIKit's words are the manual's.
  assert.equal(binding.values.mode, 'trigger'); assert.equal(binding.values.effort, 'inherit')
  for (const key of ['mode', 'then', 'to', 'effort', 'autonomy', 'register', 'form']) assert.equal(binding.standing[key], undefined, key)
  await binding.write([{key: 'mode', value: 'toggle'}])
  assert.equal(owner.sent.filter(op => op.request)[0].expected_revision, undefined, 'a session with no settings yet is written without a revision')
  const after = tasks.tasksBinding({...input, settings: contextOf(entry)}, null, {selectTask() {}, queue: async () => {}})
  await after.write([{key: 'effort', value: 'high'}])
  assert.deepEqual(entry.snapshot().value.task.effort, [[0, 'high']])
  assert.equal(entry.snapshot().value.task.launch, 'toggle')
  // REPLACED (lane K0): the three are Software Factory's, and each names what it needs (a task clip names no Run or unit).
  for (const key of ['launch', 'retry', 'stopAfter']) assert.equal(after.standing[key].disabled, tasks.TASKS_REFUSE[key], key)
  const unread = tasks.tasksBinding({...input, settings: null}, null, {selectTask() {}, queue: async () => {}})
  assert.equal(unread.standing.mode.disabled, settings.SETTINGS_WHY.notHere)
  await assert.rejects(() => unread.write([{key: 'mode', value: 'gate'}]), {message: settings.SETTINGS_WHY.notHere})
})

test('the mixer row: each session\'s Telemetry and Solo read its own settings, and a press writes that session\'s alone', async () => {
  const {factoryTrackAdapter, FACTORY_TELEMETRY_OP} = await import('../src/timeline/factoryTrackAdapter.ts')
  const quiet = {...track, sessionRef: 'ses-300', purpose: 'widget tests', tasks: []}
  const pressed = []
  const port = {
    of: session => session === 'ses-214' ? {telemetry: false, solo: true} : null,
    set: async (session, setting, on) => { pressed.push([session, setting, on]); return {ok: true, note: `${setting} ${on}`} },
  }
  const set = factoryTrackAdapter.project({tracks: [track, quiet], nowUnixMs: T(14, 30), settings: port})
  const mine = set.tracks.find(item => item.id === trackKey(track)), theirs = set.tracks.find(item => item.id === trackKey(quiet))
  assert.equal(mine.mix.activator, false, 'muted: it keeps working, in silence'); assert.equal(mine.mix.solo, true)
  assert.equal(theirs.mix?.activator, undefined, 'a session unread draws its settings unread')
  assert.equal(set.mixer.activator.disabled, undefined); assert.equal(set.mixer.solo.disabled, undefined)
  assert.equal(set.mixer.monitor.disabled !== undefined, true, 'Watch still names the op it lacks')
  assert.equal(set.actions.mixer.activator.op, FACTORY_TELEMETRY_OP)
  await set.actions.mixer.activator.run(mine.id, true)
  await set.actions.mixer.solo.run(theirs.id, true)
  assert.deepEqual(pressed, [['ses-214', 'telemetry', true], ['ses-300', 'solo', true]])
  assert.deepEqual(await set.actions.mixer.solo.run('space:none:nobody', true), {ok: false, error: '"space:none:nobody" is not a session of this work.'})
  const unported = factoryTrackAdapter.project({tracks: [track], nowUnixMs: T(14, 30)})
  assert.match(unported.mixer.activator.disabled, /missing op/, 'no settings read here: Telemetry says what it lacks')
  // The write a press makes: the track's own setting, no task in it.
  assert.deepEqual(settings.trackSettingChange('telemetry', false), {track: {telemetry: false}})
})

test('a track\'s Stop is that session\'s own: its running turn cancelled on its encounter owner, said without the harness\'s grain', async () => {
  const {factoryTrackAdapter, FACTORY_SESSION_STOP_OP, FACTORY_STOP_ALL_OP} = await import('../src/timeline/factoryTrackAdapter.ts')
  const stopped = [], harness = []
  const set = factoryTrackAdapter.project({tracks: [track], nowUnixMs: T(14, 30),
    controls: {control: async word => { harness.push(word); return {ok: true, note: word} }},
    sessionStop: async session => { stopped.push(session); return {ok: true, note: 'stopped'} }})
  assert.equal(set.actions.stopTrack.op, FACTORY_SESSION_STOP_OP)
  assert.equal(set.actions.stopTrack.grain, null, 'it acts on the one track pressed')
  assert.deepEqual(await set.actions.stopTrack.run(trackKey(track)), {ok: true, note: 'stopped'})
  assert.deepEqual(stopped, ['ses-214']); assert.deepEqual(harness, [], 'the harness is not stopped')
  assert.equal(set.actions.stopAll.op, FACTORY_STOP_ALL_OP, 'Stop All stays the harness\'s')
  assert.deepEqual(await set.actions.stopTrack.run('space:none:nobody'), {ok: false, error: '"space:none:nobody" is not a session of this work.'})
  const source = await (await import('node:fs/promises')).readFile(new URL('../src/frame/tracks/SessionGrid.tsx', import.meta.url), 'utf8')
  assert.match(source, /trackStop\.grain !== undefined \? \(trackStop\.grain \?/, 'the grid says a stop\'s own grain, or none')
})

test('a read the owner refused says so in its words, not that it is still being read', () => {
  const refused = factory.factoryClipBinding({ref: taskRef, tracks: [track], events: null,
    settings: {transport, project, settings: null, refused: "unrecognized subcommand 'encounter-session-settings'"}})
  assert.equal(refused.standing.launch?.disabled, "The session's settings are unread — the owner refused: unrecognized subcommand 'encounter-session-settings'")
})
