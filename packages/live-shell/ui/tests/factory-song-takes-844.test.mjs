// O-I #844's open line (lane BD; manual §19.1 Songs: "It comes round again by Loop, by Repeat, or by a routine's schedule. The schedule
// is the routine's, and the song keeps none"; §19.1 The Launch panel: "Repeat … each run a take of its own"; §10.9 File › Export Song…:
// "the song, or the tracks and the range you select"). A song dropped on a track stands as a canon note in the session's score; with
// that note chosen in Clip view, Repeat's press makes the song's takes through #795's take path — the set started on AIKit
// (encounter-session-settings takes start), each take a Run Software Factory starts from the note's clip (`factory workflow perform`,
// factory.song-take/v1, the kernel's factory_owner `workflow-perform`), and the set ended on AIKit with what Factory made, or failed in
// Factory's words. Loop is AIKit's task executor's: Loop turned on with a song's note chosen names the song (task.loop_song), and the
// executor makes each pass a take through Factory's perform. A routine is Automations': AIKit runs each run of a Method whose native
// body is factory-song-take as a take; Routine… on a song, with its note chosen in a task's Clip view, has AIKit prepare the schedule
// (`aikit routine prepare-schedule`) and then file the take's Method (`aikit capture --from-song --take-…`) for the person to accept.
// Export Song… with a session's track selected renders that track's row, and with a stretch selected on the Arrangement's ruler, the
// units that ran in it.
// Channels: REAL — Factory's score with the dropped canon unit (tests/fixtures/factory-songs-2026-11-03.json score_after); AIKit's
// capture of the song's take from the aikit-3 build and its refusal of a schedule with no civil-time policy, both in a scratch world
// (tests/fixtures/aikit-song-routine-2026-11-04.json). FAKE — AIKit's prepared schedule, in its shape (aikit.prepared-schedule/v1). DERIVED —
// Factory's take receipt, in the shape factory/tests/song_take.rs pins (contract, take, unit, of, clipRef, commission's runRef), and its
// refusal in the owner envelope. SCRIPTED — the kernel behind the bridge's fetch, AIKit's settings kept as AIKit keeps them (as
// tests/t795-loop-repeat-launch.test.mjs scripts them), recording every op. FIXTURE — the session's attempt readings, owner-shaped, as
// tests/factory-songs-844.test.mjs has them. Not a screen pass: choosing the note and pressing Repeat or Routine… in the native window
// are UNVERIFIED (the lead's walk).
//
// Each test loads what it reads itself, so each one fails on its own reason against a tree without the change.
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
  addEventListener: noop, removeEventListener: noop, querySelector: () => null, documentElement: {style: {}}, body: {}}
const bus = new EventTarget()
globalThis.window ??= globalThis
globalThis.addEventListener = bus.addEventListener.bind(bus); globalThis.removeEventListener = bus.removeEventListener.bind(bus)
globalThis.dispatchEvent = bus.dispatchEvent.bind(bus)
globalThis.localStorage ??= {getItem: () => null, setItem: noop}

const {createElement} = await import('react')
const {renderToStaticMarkup} = await import('react-dom/server')
const source = path => readFile(new URL(path, import.meta.url), 'utf8')

const REAL = JSON.parse(await readFile(new URL('./fixtures/factory-songs-2026-11-03.json', import.meta.url), 'utf8'))
const TAKER = '/walk/taker/.factory/development-state.json'
const RUN = REAL.score_after.runRef
const TARGET = {statePath: TAKER, runRef: RUN, unitRef: REAL.score_after.units.find(unit => unit.key === 'eros-verify').unitRef}

// FIXTURE (owner-shaped, as factory-songs-844.test.mjs): the session's task serves one attempt of the taker's Run, on eros-verify.
const TASK = 'task:01M6SONGTAKER0000000000'
const ATTEMPTS = {schema: 'aikit.encounter-task-attempts-list/v1', readings: [{schema: 'aikit.encounter-task-attempts/v1', agent_session: 'ses-eros',
  revision: 'task-attempts/ONE', task_ref: TASK, earlier: [], attempts: [{task_ref: TASK, attempt_ref: 'attempt:A1', run_ref: RUN,
    state_path: TAKER, workflow_unit: TARGET.unitRef, execution_ref: 'execution:A1', delivery_ref: 'delivery:A1', recorded_by: 'factory', recorded_at_unix_ms: 1_000}]}]}
const RUN_READING = {contract: 'factory.attempt-reading/v1', revision: 3, runRef: RUN, attempts: [{attemptRef: 'attempt:A1', taskRef: TASK,
  workflowUnitRef: TARGET.unitRef, reservedExecutionRef: 'reserved:A1', failureEvidenceRefs: [], observations: [], verifications: [],
  attemptRecordedAt: '2026-11-03T20:00:00Z', executionRef: 'execution:A1'}]}

/** AIKit's reading of the session's settings, every default stated (encounter_task_settings.rs `reading`). */
const reading = (overrides = {}, revision = 'session-settings/0') => ({
  schema: 'aikit.encounter-session-settings/v1', agent_session: 'ses-eros', revision,
  track: {telemetry: true, solo: false, set: []},
  task: {task_ref: TASK, name: 'verify the change', colour: null, active: true, register: 'plain', form: 'technical',
    loop: false, loop_until: 'done', loop_cap: null, launch: 'repeat', then: 'next', quantize: 'global', repeat_variable: 'condition',
    repeat_levels: [], repeat_repeats: 2, repeat_stop: 'done', envelope_mode: 'automation', envelope_linked: true,
    effort: [], tool_calls: [], set: ['launch'], takes: null, ...overrides},
  previous_task: null, standing: 'intent',
})
/** DERIVED: Factory's take receipt, in the shape factory/tests/song_take.rs pins. */
const takeReceipt = take => ({contract: 'factory.song-take/v1', take, unit: 'release-check', of: RUN, clipRef: 'factory-song:song-taker/release-check',
  clip: 'release-check', set: REAL.score_after.units.find(unit => unit.key === 'release-check').song?.set ?? null,
  commission: {commission: {runRef: `run:TAKE${take}`}}, attempts: {runRef: `run:TAKE${take}`}, execution: 'not-requested', nextCommand: 'factory attempt action'})
const factoryRefusal = message => ({ok: false, error: JSON.stringify({kind: 'owner-refused-or-failed', message, operation_may_have_run: false})})

/** A scripted kernel: AIKit's settings (a revision per change, takes kept as AIKit keeps them), the session's attempts, Factory's score
 * and Factory's perform (`perform(op, n)` answers the n-th). Every op kept. */
function scriptedKernel(start, perform = (_op, n) => ({ok: true, outcome: {result: 'factory_development_reading', data: takeReceipt(n), receipts: []}})) {
  const kernel = {reading: start, sent: [], revisions: 0, performs: 0}
  const answer = (result, data) => ({json: async () => ({ok: true, outcome: {result, data, receipts: []}})})
  globalThis.fetch = async (_url, init) => {
    const op = JSON.parse(init.body)
    kernel.sent.push(op)
    if (op.op === 'encounter_task_attempts_list') return answer('encounter_task_attempts_list_reading', ATTEMPTS)
    if (op.op === 'factory_attempt_read') return answer('factory_attempt_reading', RUN_READING)
    if (op.op === 'factory_owner' && op.request.kind === 'workflow-score-read') return answer('factory_development_reading', REAL.score_after)
    if (op.op === 'factory_owner' && op.request.kind === 'workflow-perform') return {json: async () => perform(op, ++kernel.performs)}
    if (op.op !== 'encounter_session_settings') return {json: async () => ({ok: false, error: `unexpected ${op.op}`})}
    if (!op.request) return answer('encounter_session_settings_reading', kernel.reading)
    if ((op.expected_revision ?? null) !== kernel.reading.revision)
      return {json: async () => ({ok: false, error: 'encounter.runtime: Session settings revision conflict; read the current settings and write again'})}
    const task = {...kernel.reading.task}
    const act = op.request.takes
    if (act?.start) task.takes = {trace_ref: act.start.trace_ref, started_at_unix_ms: 1, running: true, variable: task.repeat_variable,
      levels: task.repeat_levels, repeats: task.repeat_repeats, stop: task.repeat_stop, ended: null}
    if (act?.end) task.takes = {...task.takes, running: false, ended: {at_unix_ms: 2, outcome: act.end.outcome,
      ...(act.end.takes !== undefined ? {takes: act.end.takes} : {}), ...(act.end.root ? {root: act.end.root} : {}), ...(act.end.reason ? {reason: act.end.reason} : {})}}
    kernel.reading = {...kernel.reading, revision: `session-settings/${++kernel.revisions}`, task}
    return answer('encounter_session_settings_reading', kernel.reading)
  }
  return kernel
}
const transport = {kind: 'bridge', url: 'http://takes.test'}
const project = 'song-taker'
async function readSettings() {
  const {settingsReadingEntry} = await import('../src/owners/readers.ts')
  const entry = settingsReadingEntry(transport, project, 'ses-eros')
  await entry.retry(`epoch-${Math.random()}`)
  return entry
}
const SONG = {target: TARGET, unit: 'release-check', name: 'release-check'}

test('Repeat on a song: the set starts on AIKit, Factory starts each take as a Run of the song, and the set ends with what it made', async () => {
  const songs = await import('../src/agent/songClips.ts')
  const {onOwnerChanged} = await import('../src/owners/notices.ts')
  const {writesOwner} = await import('../../../../desktop/cradle/src/kernel/bridge.ts')
  assert.deepEqual(songs.performRequest(TARGET, 'release-check'), {kind: 'workflow-perform', state_path: TAKER, run_ref: RUN, unit: 'release-check'})
  assert.equal(songs.SONG_TAKE, 'factory.song-take/v1')
  assert.equal(writesOwner({op: 'factory_owner', request: songs.performRequest(TARGET, 'release-check')}), true, 'a take is a write: Factory commissions a Run')
  const kernel = scriptedKernel(reading())
  await readSettings()
  const moved = []
  const stop = onOwnerChanged('temporal', change => moved.push(change.cause))
  const made = await songs.songTakes(transport, project, 'ses-eros', SONG, () => 1_793_000_000_000)
  stop()
  assert.equal(made.ok, true, made.error)
  const writes = kernel.sent.filter(op => op.request)
  assert.deepEqual(writes.map(op => op.op === 'factory_owner' ? op.request.kind : op.op),
    ['encounter_session_settings', 'workflow-perform', 'workflow-perform', 'encounter_session_settings'], 'Repeats are the takes: one Run each')
  const trace = writes[0].request.takes.start.trace_ref
  assert.equal(trace, 'takes:ses-eros:1793000000000')
  assert.deepEqual(writes[0].request, {takes: {start: {task_ref: TASK, trace_ref: trace}}})
  assert.deepEqual(writes[1].request, {kind: 'workflow-perform', state_path: TAKER, run_ref: RUN, unit: 'release-check'})
  assert.deepEqual(writes[3].request, {takes: {end: {task_ref: TASK, trace_ref: trace, outcome: 'made', takes: 2, root: TAKER}}},
    'AIKit keeps how many Factory made and where: the project\'s developmental state, which holds each take\'s Run')
  assert.equal(kernel.reading.task.takes.ended.outcome, 'made')
  assert.match(made.note, /^Factory started 2 Runs of the song release-check \(takes 1–2 of release-check: run:TAKE1, run:TAKE2\)/)
  assert.ok(moved.length >= 1, 'the score\'s readers are told: the canon unit lists its takes')
})

test('a song\'s takes are refused in words before any write: not launched with Repeat, Repeat varying a level, a note that is no song; Factory\'s refusal ends the set failed', async () => {
  const songs = await import('../src/agent/songClips.ts')
  const settings = await import('../src/agent/sessionSettings.ts')
  let kernel = scriptedKernel(reading({launch: 'trigger'}))
  await readSettings()
  let made = await songs.songTakes(transport, project, 'ses-eros', SONG)
  assert.deepEqual(made, {ok: false, error: settings.TAKES_WHY.notRepeat})
  assert.equal(kernel.sent.filter(op => op.request).length, 0)
  kernel = scriptedKernel(reading({repeat_variable: 'effort', repeat_levels: ['low', 'high']}))
  await readSettings()
  made = await songs.songTakes(transport, project, 'ses-eros', SONG)
  assert.deepEqual(made, {ok: false, error: songs.CANON_VARIES})
  assert.match(songs.CANON_VARIES, /each the song as its clip renders it/)
  assert.equal(kernel.sent.filter(op => op.request).length, 0)
  // Factory refuses the second take (the set moved since the render): the set ends failed with Factory's words, and the first take stands.
  const words = 'The set release-check names has moved since it was rendered (it is blake3:b now, the clip was made at blake3:a), and a take performs the song as the clip renders it. Remake it in the project that made it, then drop it here again. Nothing is performed.'
  kernel = scriptedKernel(reading(), (_op, n) => n === 1 ? {ok: true, outcome: {result: 'factory_development_reading', data: takeReceipt(1), receipts: []}} : factoryRefusal(words))
  await readSettings()
  made = await songs.songTakes(transport, project, 'ses-eros', SONG)
  assert.equal(made.ok, false)
  assert.ok(made.error.startsWith('Factory made 1 take of release-check (run:TAKE1), then refused: The set release-check names has moved'), made.error)
  const end = kernel.sent.filter(op => op.request).at(-1).request.takes.end
  assert.deepEqual([end.outcome, end.takes, end.root], ['failed', 1, TAKER])
  assert.ok(end.reason.includes('has moved since it was rendered'), end.reason)
  // The note chosen in the score: a canon unit is a song; any other unit is none.
  assert.equal(songs.canonNoteOf(REAL.score_after, 'release-check')?.songClip, 'factory-song:song-taker/release-check')
  assert.equal(songs.canonNoteOf(REAL.score_after, 'eros-verify'), null)
  assert.equal(songs.canonNoteOf(REAL.score_after, undefined), null)
})

test('Repeat\'s press on a task whose Clip view holds a song\'s note makes the song\'s takes; with no song chosen it makes the task\'s own', async () => {
  const tracks = await import('../src/frame/tracks/useFactoryTracks.ts')
  const {clipHostId, setViewHold} = await import('../src/frame/detail/clipBinding.ts')
  const adapter = await source('../src/timeline/factoryTrackAdapter.ts')
  assert.ok(/return repeat\(session, clip\.label, clip\.id\)/.test(adapter), 'the press names the clip it was made on')
  const clip = 'space:anima:ses-eros#task/1'
  let kernel = scriptedKernel(reading())
  await readSettings()
  setViewHold(clipHostId('factory', clip), 'unit', 'release-check')
  const press = tracks.repeatPress(transport, () => reading(), () => project)
  let made = await press('ses-eros', 'verify the change', clip)
  assert.equal(made.ok, true, made.error)
  assert.deepEqual(kernel.sent.filter(op => op.op === 'factory_owner').map(op => op.request.kind), ['workflow-score-read', 'workflow-perform', 'workflow-perform'],
    'the session\'s Run is read, its score names the note a song, and each take is Factory\'s')
  // The note chosen is no song: the task's own takes, through Actuation as #795 makes them (here AIKit hands no run, so in its words).
  setViewHold(clipHostId('factory', clip), 'unit', 'eros-verify')
  kernel = scriptedKernel(reading())
  await readSettings()
  made = await press('ses-eros', 'verify the change', clip)
  const {TAKES_WHY} = await import('../src/agent/sessionSettings.ts')
  assert.deepEqual(made, {ok: false, error: TAKES_WHY.noRun})
  assert.equal(kernel.sent.some(op => op.op === 'factory_owner' && op.request.kind === 'workflow-perform'), false)
  setViewHold(clipHostId('factory', clip), 'unit', undefined)
})

test('Repeat\'s press with a note chosen whose Run or score is not read says so and makes nothing: it never guesses the note is a task', async () => {
  const tracks = await import('../src/frame/tracks/useFactoryTracks.ts')
  const {clipHostId, setViewHold} = await import('../src/frame/detail/clipBinding.ts')
  const clip = 'space:anima:ses-eros#task/1'
  const kernel = scriptedKernel(reading())
  await readSettings()
  const scripted = globalThis.fetch
  globalThis.fetch = async (url, init) => {
    const op = JSON.parse(init.body)
    if (op.op === 'factory_owner' && op.request.kind === 'workflow-score-read') { kernel.sent.push(op); return {json: async () => factoryRefusal('the workflow state is locked by another writer')} }
    return scripted(url, init)
  }
  setViewHold(clipHostId('factory', clip), 'unit', 'release-check')
  const made = await tracks.repeatPress(transport, () => reading(), () => project)('ses-eros', 'verify the change', clip)
  assert.equal(made.ok, false)
  assert.match(made.error, /release-check is chosen in the Clip view, but Factory's score of the session's Run is not read .*Nothing is made\./)
  assert.equal(kernel.sent.some(op => op.op === 'factory_owner' && op.request.kind === 'workflow-perform'), false, 'no take is performed')
  assert.equal(kernel.sent.some(op => op.op === 'encounter_session_settings' && op.request), false, 'no set of takes is started')
  setViewHold(clipHostId('factory', clip), 'unit', undefined)
})

test('Loop on a song makes each pass a take: Loop turned on with a song\'s note chosen names the song for AIKit\'s executor; with the task\'s own note it loops the task', async () => {
  const songs = await import('../src/agent/songClips.ts')
  const clip = await import('../src/agent/clipBinding.ts')
  assert.equal(songs.LOOP_SONG, undefined, 'Loop on a song no longer stands refused: AIKit\'s executor takes the song each pass')
  const score = {reading: {state: 'read', reading: REAL.score_after, target: TARGET}, rack: [], edit: async () => {}, fill: async () => {}, picks: null, dismiss: noop}
  const SONG_LOOP = {state_path: TAKER, run_ref: RUN, unit: 'release-check'}
  const loopWith = async (start, unit, value) => {
    const kernel = scriptedKernel(start)
    await readSettings()
    const wiring = clip.factoryWiring({sessionRef: 'ses-eros', n: 1}, {transport, project, settings: start, refused: null}, null, null, score,
      key => key === 'unit' ? unit : undefined)
    await wiring.acts.loop(value)
    return kernel.sent.filter(op => op.op === 'encounter_session_settings' && op.request).map(op => op.request)
  }
  assert.deepEqual(await loopWith(reading({launch: 'trigger'}), 'release-check', true), [{task: {task_ref: TASK, set: {loop: true, loop_song: SONG_LOOP}}}],
    'the song\'s note names the canon unit each pass takes again, in the Run it stands in')
  assert.deepEqual(await loopWith(reading({launch: 'trigger', loop_song: SONG_LOOP}), 'eros-verify', true), [{task: {task_ref: TASK, set: {loop: true, loop_song: null}}}],
    'the task\'s own note loops the task: the song named before is taken away')
  assert.deepEqual(await loopWith(reading({launch: 'trigger', loop_song: SONG_LOOP}), 'release-check', false), [{task: {task_ref: TASK, set: {loop: false, loop_song: null}}}],
    'Loop off ends the song\'s loop with it')
  assert.deepEqual(await loopWith(reading({launch: 'trigger'}), 'eros-verify', true), [{task: {task_ref: TASK, set: {loop: true}}}],
    'with no song named before or now, Loop writes Loop alone (an AIKit before loop_song takes it)')
})

test('Loop on a song shows its last pass in the Clip view: the take Factory started and its Run, or why the loop stopped (AIKit task.loop_pass)', async () => {
  const settings = await import('../src/agent/sessionSettings.ts')
  const clip = await import('../src/agent/clipBinding.ts')
  const SONG_LOOP = {state_path: TAKER, run_ref: RUN, unit: 'release-check'}
  // AIKit's reading (encounter_task_executor.rs loop_pass): {take, run_ref}, {refused}, or null — no song's pass yet.
  const pass = loop_pass => settings.clipValuesOfSettings(reading({launch: 'trigger', loop: true, loop_song: SONG_LOOP, loop_pass}))['loop.pass']
  assert.equal(pass({take: 3, run_ref: 'run:TAKE3'}), 'Take 3 of release-check · Run run:TAKE3')
  const words = 'Factory did not perform take 4 of the song release-check: the set release-check names has moved since it was rendered.'
  assert.equal(pass({refused: words}), `The loop stopped: ${words}`)
  assert.equal(pass(null), undefined, 'no pass yet: nothing drawn')
  assert.equal(settings.clipValuesOfSettings(reading())['loop.pass'], undefined, 'an AIKit before loop_pass: nothing drawn')
  assert.equal(settings.clipValuesOfSettings(reading({loop_pass: {take: 2, run_ref: 'run:TAKE2'}}))['loop.pass'], 'Take 2 · Run run:TAKE2',
    'a pass kept after the song was taken away names no unit')
  const wiring = clip.factoryWiring({sessionRef: 'ses-eros', n: 1}, {transport, project, settings: reading(), refused: null})
  assert.match(wiring.reads['loop.pass'], /task\.loop_pass/)
  const design = await source('../src/inhabitants/catalogue/clips/factory.tsx')
  assert.ok(/<Row label="Last pass"><Fact label="Last pass"[^\n]*'loop\.pass'/.test(design), 'the Clip panel draws it under Loop')
})

test('a song\'s note draws how many takes Factory started from it', async () => {
  const {scoreValuesOf} = await import('../src/agent/scoreBinding.ts')
  const reading = JSON.parse(JSON.stringify(REAL.score_after))
  const canon = reading.units.find(unit => unit.key === 'release-check')
  canon.takes = [{take: 1, runRef: 'run:TAKE1'}, {take: 2, runRef: 'run:TAKE2'}]
  const drawn = JSON.parse(scoreValuesOf({state: 'read', reading, target: TARGET}, [], null).score)
  assert.equal(drawn.units.find(unit => unit.key === 'release-check').takes, 2, 'the canon note carries Factory\'s count of its takes')
  assert.equal(drawn.units.find(unit => unit.key === 'eros-verify').takes, undefined, 'a task\'s note has no takes of a song')
  delete canon.takes
  assert.equal(JSON.parse(scoreValuesOf({state: 'read', reading, target: TARGET}, [], null).score).units.find(unit => unit.key === 'release-check').takes, 0,
    'a canon note Factory lists no take of reads none')
  const design = await source('../src/inhabitants/catalogue/clips/factory.tsx')
  assert.ok(/u\.takes/.test(design), 'the design draws the count on the note')
})

test('Routine… on a song: with its note chosen in a task\'s Clip view, AIKit prepares the schedule, then files the take\'s Method for you to accept; refused in words before any write otherwise', async () => {
  const songs = await import('../src/agent/songClips.ts')
  const rows = await import('../src/agent/SongRows.tsx')
  const clip = await import('../src/agent/clipBinding.ts')
  const {clipHostId, setViewHold} = await import('../src/frame/detail/clipBinding.ts')
  const ROUTINE = JSON.parse(await readFile(new URL('./fixtures/aikit-song-routine-2026-11-04.json', import.meta.url), 'utf8'))
  assert.match(songs.ROUTINE_SONG, /^Each run of a routine is a take of this song/)
  assert.doesNotMatch(songs.ROUTINE_SONG, /missing op/, 'Routine… on a song no longer stands refused')
  const row = {key: 'song-maker/release-check', name: 'release-check', clipRef: 'factory-song:song-maker/release-check', path: '/walk/maker/.factory/songs/release-check.song.json',
    statePath: '/walk/maker/.factory/development-state.json', standing: 'current', units: 6, rows: 6, entry: 'development-and-knowledge.workflow.ts', importedFrom: null, why: '',
    clip: {contract: 'factory.song-clip/v1', name: 'release-check'}}
  const daily = {kind: 'daily', time: '07:30'}
  // The note chosen in the selected task's Clip view, as its binding publishes it: the session, its project and the note's key.
  const tracks = [{spaceRef: 'space:anima', sessionRef: 'ses-eros', group: false, tasks: [{n: 1}]}]
  setViewHold(clipHostId('factory', 'space:anima:ses-eros#task/1'), 'unit', 'release-check')
  assert.deepEqual(clip.chosenNoteOf('space:anima:ses-eros#task/1', tracks, project), {project, session: 'ses-eros', key: 'release-check'})
  assert.deepEqual(clip.chosenNoteOf('space:anima:ses-eros', tracks, project), {project, session: 'ses-eros', key: 'release-check'},
    'a session\'s track selected opens its first task\'s Clip view, and names its note')
  assert.equal(clip.chosenNoteOf('space:anima:ses-logos#task/1', tracks, project), null, 'no session of the reading')
  setViewHold(clipHostId('factory', 'space:anima:ses-eros#task/1'), 'unit', undefined)
  assert.equal(clip.chosenNoteOf('space:anima:ses-eros#task/1', tracks, project), null)
  assert.ok(/publishChosenNote\(/.test(await source('../src/agent/clipBinding.ts')), 'the selected task\'s binding publishes the note it holds')
  // A scripted kernel that also answers AIKit's routine op (FAKE prepared schedule in AIKit's shape, or its REAL refusal) and the capture
  // route (REAL: the aikit-3 build's answer for this song's take).
  const prepared = {schema: 'aikit.prepared-schedule/v1', trigger: {schema: 'aikit.time-schedule/v1', schedule_ref: 'schedule/daily-0f3c', schedule: daily},
    time_policy: {ref: 'control:root/civil-time-policy', revision: 'rev-1'}, window: {from_unix_ms: 1, to_unix_ms: 2},
    next_occurrences: [{occurrence_ref: 'occurrence/1', due_unix_ms: Date.UTC(2026, 10, 5, 7, 30)}], kept: false, note: 'prepared and not kept: create the Routine with this trigger, then enable it'}
  const withRoutine = (schedule = {ok: true, outcome: {result: 'routine', data: prepared, receipts: []}}) => {
    const kernel = scriptedKernel(reading())
    const scripted = globalThis.fetch
    globalThis.fetch = async (url, init) => {
      const op = JSON.parse(init.body)
      if (op.op === 'routine') { kernel.sent.push(op); return {json: async () => schedule} }
      if (op.op === 'aikit_write') { kernel.sent.push(op); return {json: async () => ({ok: true, outcome: {result: 'owner_route_reading', route: 'aikit capture', data: ROUTINE.capture, warnings: [], receipts: []}})} }
      return scripted(url, init)
    }
    return kernel
  }
  const writes = kernel => kernel.sent.filter(op => op.op === 'routine' || op.op === 'aikit_write')
  const note = key => ({project, session: 'ses-eros', key})
  // Refused before any write: no note chosen, a note that is no song, another song's note.
  let kernel = withRoutine()
  assert.deepEqual(await songs.routineOfSong(transport, row, null, daily), {ok: false, error: songs.routineNoNote('release-check')})
  assert.match(songs.routineNoNote('release-check'), /choose release-check's note in that task's Clip view/)
  assert.deepEqual(await songs.routineOfSong(transport, row, note('eros-verify'), daily), {ok: false, error: songs.routineNoSong('eros-verify')})
  assert.deepEqual(await songs.routineOfSong(transport, {...row, name: 'verify-part'}, note('release-check'), daily),
    {ok: false, error: songs.routineOtherSong('release-check', 'release-check', 'verify-part')})
  assert.deepEqual(writes(kernel), [], 'nothing is prepared or captured')
  // AIKit refuses the schedule (REAL words): nothing is captured.
  kernel = withRoutine({ok: false, error: ROUTINE.prepare_refused})
  let made = await songs.routineOfSong(transport, row, note('release-check'), daily)
  assert.equal(made.ok, false)
  assert.ok(made.error.endsWith(ROUTINE.prepare_refused), made.error)
  assert.deepEqual(writes(kernel).map(op => op.op), ['routine'], 'no Method is filed for a schedule AIKit refuses')
  // The schedule prepared (kept nowhere), then the take's Method filed in your inbox: the clip, and the canon unit in the Run it stands in.
  kernel = withRoutine()
  made = await songs.routineOfSong(transport, row, note('release-check'), daily)
  assert.equal(made.ok, true, made.error)
  assert.deepEqual(writes(kernel), [
    {op: 'routine', project, request: {action: 'prepare_schedule', schedule: daily}},
    {op: 'aikit_write', request: {kind: 'capture', project, title: 'release-check', body: JSON.stringify(row.clip), scope: 'home',
      source_ref: 'factory-song:song-maker/release-check', by: 'human', from_song: true, take: {state_path: TAKER, run_ref: RUN, unit: 'release-check'}}}])
  assert.ok(made.note.includes(ROUTINE.capture.candidate) && made.note.includes(ROUTINE.capture.proposed_id), made.note)
  assert.match(made.note, /waits for you to accept it on the Capture page/)
  assert.match(made.note, /Settings › Automations/)
  assert.match(made.note, /daily at 07:30/)
  // Make routine… (O-I #758): the receipt carries the new routine Settings › Automations opens on — what opened it, the song's name, the
  // take's Method and the schedule's Repeat and When as you gave them (Create prepares it again: AIKit keeps a prepared schedule nowhere).
  assert.deepEqual(made.routine, {from: 'Songs · release-check', name: 'release-check', method: ROUTINE.capture.proposed_id, repeat: 'daily', schedule: '07:30'})
  assert.match(renderToStaticMarkup(rows.songPreview(row, noop, noop, made, noop)), /<button[^>]*data-action="song-make-routine"[^>]*>Make routine…<\/button>/)
  assert.doesNotMatch(renderToStaticMarkup(rows.songPreview(row, noop, noop, null, noop)), /song-make-routine/, 'nothing to make before AIKit files the Method')
  const opening = songs.songRoutineRequest(row, made.routine)
  assert.deepEqual({...opening, requestId: typeof opening.requestId}, {requestId: 'string', page: 'automations', scope: {scope_kind: 'world', scope_ref: null},
    returnLabel: 'Back to Songs · release-check', newRoutine: made.routine}, 'the take\'s Method is your AIKit home\'s, so the routine is made in that context')
  assert.match(await source('../src/agent/SongRows.tsx'), /openSettings\(songRoutineRequest\(/)
  const {scheduleFromInput, scheduleInputOf} = await import('../src/settings/routines.ts')
  for (const [kind, raw] of [['daily', '07:30'], ['every', '3600'], ['every', '1.5'], ['once', '2026-11-05T07:30:00Z'], ['cron', '0 8 * * 1-5']])
    assert.equal(scheduleInputOf(scheduleFromInput(kind, raw)), raw, `${kind} ${raw}: the When the form takes is the one given`)
  // The preview: Routine… stands enabled beside its schedule (Repeat and when, parsed by Settings' scheduleFromInput at the press).
  const markup = renderToStaticMarkup(rows.songPreview(row, noop, noop))
  assert.match(markup, /data-action="remake-song"/)
  assert.doesNotMatch(markup, /<button[^>]*data-action="song-routine"[^>]*disabled/)
  assert.match(markup, /<select[^>]*data-song-routine-repeat/)
  assert.ok(markup.includes(songs.ROUTINE_SONG.replace(/'/g, '&#x27;')), markup)
  // Export Song…: a session's track selected renders its row; a task selected renders the whole song.
  const track = {sessionRef: 'ses-eros', agentRef: 'agent/anima-eros', group: false}
  assert.deepEqual(clip.exportChoiceOf('space:anima:ses-eros', {track}), {rows: ['agent/anima-eros']})
  assert.deepEqual(clip.exportChoiceOf('space:anima:ses-eros#task/1', {track}), {})
  assert.deepEqual(clip.exportChoiceOf('space:anima:ses-eros', {track: {...track, agentRef: null}}), {})
  assert.deepEqual(clip.exportChoiceOf(null, null), {})
  assert.ok(/exportChoiceOf\(selected\.ref, chosen, ranged\?\.units\)/.test(await source('../src/agent/clipBinding.ts')),
    'File › Export Song… hands Factory the choice the selection makes')
})

test('Export Song… of a range: the stretch the Arrangement\'s ruler selects, shared, gives the units of the song that ran in it', async () => {
  const songs = await import('../src/agent/songClips.ts')
  const door = await import('../src/frame/tracks/tracksDoor.ts')
  const clip = await import('../src/agent/clipBinding.ts')
  const score = {state: 'read', reading: REAL.score_after, target: TARGET}
  const unit = key => REAL.score_after.units.find(item => item.key === key)
  // The take lanes as Factory's Arrangement lays them: each attempt's stretch, with the Run and the unit it works; one on another
  // session's track, one a take of the song (another Run), one whose owner disclosed no admission time.
  const lane = (id, trackId, runRef, unitRef, spans) => ({id, trackId, name: id, spans: spans.map(([start, end]) => ({start, end, label: id})), of: {runRef, unitRef}})
  const set = {tracks: [], clips: [], columns: [], lanes: {takes: [
    lane('a', 'space:anima:ses-eros', RUN, unit('eros-verify').unitRef, [[10, 20]]),
    lane('b', 'space:anima:ses-logos', RUN, unit('logos-scope-plan').unitRef, [[2, 8]]),
    lane('c', 'space:anima:ses-sophia', RUN, unit('sophia-finish').unitRef, [[40, 50]]),
    lane('d', 'space:anima:ses-eros', 'run:TAKE1', unit('mythos-debug').unitRef, [[12, 18]]),
    lane('e', 'space:anima:ses-eros', RUN, unit('aletheia-knowledge-return').unitRef, []),
  ]}}
  assert.equal(songs.unitsInSpan(null, score), null, 'no stretch selected: the whole song, or the rows')
  assert.deepEqual(songs.unitsInSpan({set, range: {start: 5, end: 25}}, score), {units: ['logos-scope-plan', 'eros-verify']},
    'every track\'s units of the scored Run that ran in the stretch, in the song\'s order; a take of the song is another Run')
  assert.deepEqual(songs.unitsInSpan({set, range: {start: 0, end: 60}}, score), {units: ['logos-scope-plan', 'eros-verify', 'sophia-finish']})
  const none = songs.unitsInSpan({set, range: {start: 25, end: 35}}, score)
  assert.match(none.refused, /^Export Song…: no unit of the song this task's Run performs ran in the selected stretch /)
  assert.match(none.refused, /clear it \(Esc\)/)
  assert.deepEqual(songs.unitsInSpan({set, range: {start: 5, end: 25}}, {state: 'absent', why: 'unread'}), null, 'an unread score: Export says so itself')
  // The choice: the units in the range, with the selected track's row when a track is selected.
  const track = {sessionRef: 'ses-eros', agentRef: 'agent/anima-eros', group: false}
  assert.deepEqual(clip.exportChoiceOf('space:anima:ses-eros', {track}, ['eros-verify']), {rows: ['agent/anima-eros'], units: ['eros-verify']})
  assert.deepEqual(clip.exportChoiceOf('space:anima:ses-eros#task/1', {track}, ['eros-verify']), {units: ['eros-verify']})
  assert.deepEqual(clip.exportChoiceOf('space:anima:ses-eros#task/1', {track}, undefined), {})
  // The shared stretch: what the ruler publishes, read at the press.
  door.publishShownSpan({set, range: {start: 1, end: 2}})
  assert.deepEqual(door.shownSpanNow()?.range, {start: 1, end: 2})
  door.publishShownSpan(null)
  assert.equal(door.shownSpanNow(), null)
  // Factory hears the units: the export request carries them.
  let sent = null
  globalThis.fetch = async (_url, init) => {
    sent = JSON.parse(init.body)
    return {json: async () => ({ok: false, error: JSON.stringify({kind: 'owner-refused-or-failed', message: 'scripted', operation_may_have_run: false})})}
  }
  const scoreWithFile = {...score, reading: {...REAL.score_after, song: {...REAL.score_after.song, file: {...REAL.score_after.song?.file, entry: 'development-and-knowledge.workflow.ts'}}}}
  await songs.exportSong(transport, scoreWithFile, {units: ['eros-verify']})
  assert.deepEqual(sent?.request?.units, ['eros-verify'], JSON.stringify(sent))
  // The ruler feeds the stretch with the set it was drawn on, and the take lanes carry what each take works.
  assert.match(await source('../src/frame/tracks/ArrangementRuler.tsx'), /publishShownSpan\(span \? \{set, range: span\} : null\)/)
  assert.match(await source('../src/timeline/factoryTrackAdapter.ts'), /of: \{runRef: take\.runRef, unitRef: take\.unitRef \?\? null\}/)
  const binding = await source('../src/agent/clipBinding.ts')
  assert.match(binding, /unitsInSpan\(shownSpanNow\(\), sessions && sessionRef \? scored\.reading : null\)/)
})
