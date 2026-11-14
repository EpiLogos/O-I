// A Factory task's settings on their owner (AIKit `encounter-session-settings`, kernel `encounter_session_settings`): the Clip view's
// Clip and Launch panels and Envelopes, and the Tasks device's Mode, Then, Effort, Tool calls and style, read from the owner's
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
    effort: [], tool_calls: [], retired: [], set: [], ...overrides},
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
// The register the session was read under (its world-wide agency row's `project`, agent/worldScope.ts). REPLACED (O-I #740 lane B):
// factory.SETTINGS_PROJECT, the shell's one literal project.
const project = 'O-I'
async function readSettings() {
  const entry = settingsReadingEntry(transport, project, 'ses-214')
  await entry.retry('epoch-1')
  return entry
}
const contextOf = entry => ({transport, project, settings: entry.snapshot().value})
// A refusal asks the owner again without waiting (sessionSettings.ts `void entry.refresh(epoch)`): a test that reads what the re-read
// brings waits for the entry to settle, so it holds whatever the send's own timing (O-I #747 round 896, item 0.5).
const settled = entry => new Promise(resolve => {
  const stop = entry.subscribe(() => { if (!entry.snapshot().refreshing) { stop(); resolve() } })
  if (!entry.snapshot().refreshing) { stop(); resolve() }
})

// ---------------------------------------------------------------------------------------------------------------- mapping

test('the owner\'s reading lands on clip:factory\'s keys: Quantize in AIKit\'s words, the envelopes as editor rows', () => {
  const values = settings.clipValuesOfSettings(defaults({name: 'Fixtures', colour: 'var(--fizz)', loop: true, launch: 'gate', then: 'again',
    quantize: 'next-tool', effort: [[0, 'medium'], [28, 'high']], tool_calls: [[0, 'session']]}))
  assert.equal(values.name, 'Fixtures'); assert.equal(values.colour, 'var(--fizz)')
  // REPLACED (#787): #772 read the owner's loop as Loop with no launch mode and its handoff as no follow action, Hand off to beside it.
  // AIKit speaks the manual's words now, Loop its own setting and Hand off to retired: each lands as it is (factory-clip-owner-words.test.mjs).
  assert.equal(values.launch, 'gate'); assert.equal(values.loop, true); assert.equal(values.then, 'again'); assert.equal('handoff' in values, false)
  // REPLACED (O-I 787 round 15): Quantize read through a table, "the owner's next-tool is the design's \"next tool\"". It lands as AIKit
  // states it; the Launch panel labels it Next tool (factory-clip-owner-words.test.mjs).
  assert.equal(values.quantize, 'next-tool', 'the owner\'s next-tool, as it states it')
  assert.deepEqual(JSON.parse(values['env.agent.effort']), [[0, 2], [28, 3]], 'Automation: a level is its row')
  // REPLACED (#787, manual §19.1 Envelopes): the Agent's Autonomy is retired; Scope's Tool calls is the task's other envelope, under Scope.
  assert.deepEqual(JSON.parse(values['env.scope.toolCalls']), [[0, 2]], 'Session is the third of Inherit, Ask, Session, Always')
  assert.equal('env.agent.autonomy' in values, false, 'no Autonomy envelope stands')
  const stepped = settings.clipValuesOfSettings(defaults({envelope_mode: 'modulation', effort: [[0, -1], [30, 2]]}))
  assert.deepEqual(JSON.parse(stepped['env.agent.effort']), [[0, 1], [30, 4]], 'Modulation: −2…+2 on the five rows')
  assert.equal('colour' in settings.clipValuesOfSettings(defaults()), false, 'a null colour takes the track\'s: nothing stands in')
  assert.deepEqual(settings.clipValuesOfSettings(null), {})
  assert.deepEqual(settings.clipValuesOfSettings({...defaults(), task: null}), {}, 'no bound task, no task settings')
})

test('an Autonomy the owner kept before is named retired, with Tool calls in its place, and what Tool calls did reaches the clip', () => {
  const words = 'Autonomy is retired: Scope\'s Tool calls (tool_calls: inherit, ask, session, always) took its place, the answer to the harness\'s request to use a tool'
  const values = settings.clipValuesOfSettings(defaults({
    retired: [{field: 'autonomy', held: [[0, 'review']], replaced_by: 'tool_calls', words},
      {field: 'repeat_variable', held: {repeat_variable: 'autonomy'}, replaced_by: 'tool_calls', words}],
    tool_calls_play: {waiting: 'permission-1', tool_calls: 'session',
      reason: 'The harness names no answer for this session (it offers Always Allow, Allow, Reject), so the request waits for you'}}))
  assert.equal(values['env.retired'], `Your Autonomy envelope and Repeat over Autonomy were left out: ${words}.`, 'in the owner\'s words, once')
  assert.equal(values['env.toolCalls.play'],
    'A tool\'s request waits for you: The harness names no answer for this session (it offers Always Allow, Allow, Reject), so the request waits for you')
  const answered = settings.clipValuesOfSettings(defaults({tool_calls_play: {answered: 'permission-2', option_id: 'allow_always', tool_calls: 'always'}}))
  assert.equal(answered['env.toolCalls.play'], 'Tool calls (always) answered the harness\'s last request with its own allow_always.')
  const none = settings.clipValuesOfSettings(defaults())
  assert.equal('env.retired' in none, false); assert.equal('env.toolCalls.play' in none, false)
})

test('a control\'s change becomes the owner\'s request: its words, null for a cleared field, the points carried with a mode', () => {
  const reading = defaults({effort: [[0, 'medium'], [28, 'high']], tool_calls: [[0, 'always']]})
  const set = (setting, value) => settings.taskSettingChange(setting, value, reading).change.task.set
  // REPLACED (#787): #772 asked the owner its own word (hold) for the manual's Gate; AIKit's word is Gate. Hand off to (handoff_to) is
  // retired: the Tasks device's To names the drag that replaces it (factory-clip-owner-words.test.mjs).
  assert.deepEqual(set('launch', 'gate'), {launch: 'gate'})
  // REPLACED (O-I 787 round 15): set('quantize', 'next turn') asked the owner next-turn through a table; the clip says AIKit's word.
  assert.deepEqual(set('quantize', 'next-turn'), {quantize: 'next-turn'})
  assert.deepEqual(set('name', '  '), {name: null}, 'an emptied name returns to the task\'s purpose')
  assert.deepEqual(set('effort', JSON.stringify([[0, 1], [40, 4]])), {effort: [[0, 'low'], [40, 'max']]})
  assert.deepEqual(set('toolCalls', JSON.stringify([[0, 1], [30, 2]])), {tool_calls: [[0, 'ask'], [30, 'session']]})
  // Each point keeps its row, read as the new mode reads it; the owner refuses Tool calls under Modulation in its words (it reads no
  // session value of Tool calls to move), so its points go as they are carried.
  assert.deepEqual(set('envelopeMode', 'modulation'), {envelope_mode: 'modulation', effort: [[0, 0], [28, 1]], tool_calls: [[0, 1]]},
    'each point keeps its row, read as the new mode reads it')
  // REPLACED (#772): the launch pressed is a manual's word (Trigger), as the clip sends it.
  assert.equal(settings.taskSettingChange('launch', 'trigger', reading).change.task.task_ref, 'task:correlate', 'bound to the task it was made on')
  assert.equal(settings.taskSettingChange('launch', 'trigger', null).refused, settings.SETTINGS_WHY.reading)
  assert.equal(settings.taskSettingChange('launch', 'trigger', {...reading, task: null}).refused, settings.SETTINGS_WHY.noTask)
  assert.match(settings.taskSettingChange('active', 'yes', reading).refused, /on or off/)
})

test('the Tasks device reads one level at the task\'s time and sets one for the whole task', () => {
  const reading = defaults({effort: [[0, 'low'], [30, 'high']], tool_calls: [[0, 'session']], launch: 'toggle', loop: true})
  assert.equal(settings.levelAt([[0, 'low'], [30, 'high']], 10, false), 'low')
  assert.equal(settings.levelAt([[0, 'low'], [30, 'high']], 45, false), 'high')
  assert.equal(settings.levelAt([], 45, false), 'inherit', 'an empty envelope inherits')
  assert.equal(settings.levelAt([[0, 1]], 5, true), null, 'a step is not a level')
  // REPLACED (#787): Mode read the owner's loop and To its handoff_to; Mode is AIKit's launch mode now and Hand off to is retired.
  assert.deepEqual(settings.tasksDeviceValues(reading, 45), {mode: 'toggle', then: 'next', register: 'plain', form: 'technical', effort: 'high', toolCalls: 'session'})
  const stepped = {...reading, task: {...reading.task, envelope_mode: 'modulation', effort: [[0, 1]], tool_calls: []}}
  assert.equal('effort' in settings.tasksDeviceValues(stepped, 5), false, 'under Modulation the device draws no level')
  const change = settings.tasksDeviceChange('effort', 'max', stepped).change.task.set
  assert.deepEqual(change, {envelope_mode: 'automation', effort: [[0, 'max']], tool_calls: []}, 'the other envelope carried into Automation')
  assert.deepEqual(settings.tasksDeviceChange('toolCalls', 'inherit', reading).change.task.set.tool_calls, [], 'Inherit clears the envelope')
  assert.deepEqual(settings.tasksDeviceChange('toolCalls', 'always', reading).change.task.set,
    {envelope_mode: 'automation', tool_calls: [[0, 'always']], effort: [[0, 'low'], [30, 'high']]})
  assert.match(settings.tasksDeviceChange('toolCalls', 'auto', reading).refused, /Tool calls takes one of inherit, ask, session, always/)
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
  await settled(entry)
  assert.equal(entry.snapshot().value.revision, 'session-settings/elsewhere', 'the refusal reads the settings again')
})

test('Tasks device: Mode, To and a single Effort go to the owner; Launch, Retry and Stop after still name what they need', async () => {
  const owner = scriptedOwner(defaults({}, null))
  const entry = await readSettings()
  const input = {session: track, tracks: [track], nowUnixMs: T(14, 30), selectedTask: 1, agent: {}, settings: contextOf(entry)}
  const binding = tasks.tasksBinding(input, null, {selectTask() {}, queue: async () => {}})
  // REPLACED (#787): the Tasks device read the owner's once and wrote its loop; AIKit's words are the manual's.
  assert.equal(binding.values.mode, 'trigger'); assert.equal(binding.values.effort, 'inherit')
  for (const key of ['mode', 'then', 'to', 'effort', 'toolCalls', 'register', 'form']) assert.equal(binding.standing[key], undefined, key)
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

// REPLACED (O-I #1004): "the mixer row: each session's Telemetry reads its own setting, and a press writes that session's alone" and "a
// track's Stop is that session's own", both through the window's Factory adapter's ports onto AIKit's settings and the encounter owner.
// Factory's Set is the kernel's now (kernel mode_set.rs factory_mixer, factory_waiting): a session's Telemetry and its own Stop are acts
// on AIKit's session, whose settings are no slice of the World Model yet, so the Set carries each as disabled in its words until O-I #1006
// composes them. Solo stays what you attend to, never AIKit's launch gate (round 858, §16.1, §16.6; tests/solo-attention.test.mjs).
test('the mixer row and a track\'s Stop are the kernel\'s Set: what waits says so in its words, and nothing reaches AIKit from them', async () => {
  const {kernelSetTracks} = await import('../src/frame/tracks/kernelSet.ts')
  const {modeSetOf, setTrack} = await import('./support/modeSetFixture.mjs')
  const telemetry = 'Telemetry: no owner operation carries it yet — missing op: the session\'s own Telemetry on AIKit (encounter-session-settings), whose settings are no slice of the World Model yet (O-I #1006).'
  const stop = 'a session\'s stop on its own encounter owner, or the bound harness\'s (aikit.gateway.agent on the harness binding, which is no slice of the World Model yet) (O-I #1006)'
  const set = kernelSetTracks(modeSetOf({owner: 'Factory', tracks: [setTrack(trackKey(track), 'correlate occurrences', {kind: 'session'})],
    mixer: {
      activator: {meaning: 'Telemetry: on, the session feeds the widgets', disabled: telemetry},
      solo: {meaning: 'You attend to the soloed sessions alone', disabled: 'Solo: what you attend to is the shell\'s, and the kernel\'s Set carries none of it yet (O-I #1006).'},
      monitor: {meaning: 'Watch', disabled: 'Watch: no owner operation carries it yet — missing op: shell.setSessionWatch(sessionRef, "in" | "auto" | "off"), a per-session watch the widgets read (shell).'},
    },
    waiting: {'track.stop': stop, 'set.stop-all': stop}}), {nowMs: T(14, 30)})
  assert.equal(set.mixer.activator.disabled, telemetry, 'Telemetry says what it lacks')
  assert.match(set.mixer.solo.disabled, /what you attend to/, 'no attention handed here')
  assert.match(set.mixer.monitor.disabled, /missing op/, 'Watch still names the op it lacks')
  assert.equal(set.actions.mixer, undefined, 'no mixer write the Set does not carry')
  assert.equal(set.actions.stopTrack, undefined)
  assert.equal(set.actions.stopAll, undefined)
  assert.equal(set.actions.waiting['track.stop'], stop, 'a track\'s Stop waits in the Set\'s words')
  // The write a Telemetry press will make: the track's own setting, no task in it.
  assert.deepEqual(settings.trackSettingChange('telemetry', false), {track: {telemetry: false}})
  const source = await (await import('node:fs/promises')).readFile(new URL('../src/inhabitants/catalogue/panels/dlw__session-grid.tsx', import.meta.url), 'utf8')
  assert.match(source, /trackStop\.grain !== undefined \? \(trackStop\.grain \?/, 'the grid says a stop\'s own grain, or none')
})

test('a read the owner refused says so in its words, not that it is still being read', () => {
  const refused = factory.factoryClipBinding({ref: taskRef, tracks: [track], events: null,
    settings: {transport, project, settings: null, refused: "unrecognized subcommand 'encounter-session-settings'"}})
  assert.equal(refused.standing.launch?.disabled, "The session's settings are unread — the owner refused: unrecognized subcommand 'encounter-session-settings'")
})

// ---------------------------------------------------------------------------------------------------------------- drawn

test('Envelopes: the Device chooser holds the Agent and Scope, the Control chooser Effort and Tool calls, and Repeat varies Tool calls', async () => {
  const {createElement} = await import('react')
  const {renderToStaticMarkup} = await import('react-dom/server')
  const {loadClip} = await import('../src/inhabitants/catalogue/clips/index.ts')
  const design = await loadClip('factory')
  const tab = id => design.editor.find(entry => entry.id === id) ?? design.panel.find(entry => entry.id === id)
  const draw = (id, v) => renderToStaticMarkup(createElement(tab(id).draw, {v, set() {}, standing: {}, size: 'detail', room: {w: 900, h: 360}}))
    .replaceAll('&#x27;', "'")
  assert.match(tab('envelopes').does, /Effort and Scope's Tool calls/)
  const agent = draw('envelopes', {'env.agent.effort': JSON.stringify([[0, 2]])})
  for (const word of ['Agent', 'Scope', 'Effort']) assert.match(agent, new RegExp(`>${word}<`), word)
  assert.doesNotMatch(agent, /Autonomy|Suggest|Review/, 'Autonomy is retired')
  const scope = draw('envelopes', {'env.control': 'toolCalls', 'env.scope.toolCalls': JSON.stringify([[0, 2]]),
    'env.toolCalls.play': 'A tool\'s request waits for you: the harness names no answer for this session'})
  for (const word of ['Tool calls', 'Inherit', 'Ask', 'Session', 'Always']) assert.match(scope, new RegExp(word), word)
  assert.match(scope, /A tool's request waits for you: the harness names no answer for this session/, 'what Tool calls did, in words')
  // A breakpoint at the clip's start sits on the lane's left edge: the level words stand clear of its square (7 wide, 1.5 stroke), not under it.
  const start = Number(scope.match(/<rect x="([\d.]+)" y="[\d.]+" width="7" height="7" class="dp-handle-mark"/)?.[1])
  for (const [, x, word] of scope.matchAll(/<text x="([\d.]+)" y="[\d.]+" class="clv-axis" text-anchor="end">(Inherit|Ask|Session|Always)<\/text>/g))
    assert.ok(Number(x) + 2 <= start - 0.75, `"${word}" ends ${x}, clear of the start breakpoint at ${start}`)
  const retired = draw('envelopes', {'env.retired': 'Your Autonomy envelope was left out: Autonomy is retired.'})
  assert.match(retired, /Your Autonomy envelope was left out: Autonomy is retired\./)
  const launch = draw('launch', {launch: 'repeat'})
  assert.match(launch, /Tool calls/, 'Repeat\'s Variable offers Tool calls')
  assert.doesNotMatch(launch, />Autonomy</)
})
