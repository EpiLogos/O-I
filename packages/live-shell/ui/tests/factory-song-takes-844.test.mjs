// O-I #844's open line (lane BD; manual §19.1 Songs: "It comes round again by Loop, by Repeat, or by a routine's schedule. The schedule
// is the routine's, and the song keeps none"; §19.1 The Launch panel: "Repeat … each run a take of its own"; §10.9 File › Export Song…:
// "the song, or the tracks and the range you select"). A song dropped on a track stands as a canon note in the session's score; with
// that note chosen in Clip view, Repeat's press makes the song's takes through #795's take path — the set started on AIKit
// (encounter-session-settings takes start), each take a Run Software Factory starts from the note's clip (`factory workflow perform`,
// factory.song-take/v1, the kernel's factory_owner `workflow-perform`), and the set ended on AIKit with what Factory made, or failed in
// Factory's words. Loop is AIKit's task executor's, which gives the agent its turn again and starts no Run of a song: Loop on a song
// stands refused, naming that. A routine is Automations' (AIKit runs a proven Method on its schedule; Factory continues a Journey from
// a routine's invocation into a Run that performs no song): Routine… on a song stands refused, naming what it waits for. Export Song…
// with a session's track selected renders that track's row; THE selection holds one object, and no face selects a stretch of a song's
// units, so a range stays the whole song.
// Channels: REAL — Factory's score with the dropped canon unit (tests/fixtures/factory-songs-2026-11-03.json score_after). DERIVED —
// Factory's take receipt, in the shape factory/tests/song_take.rs pins (contract, take, unit, of, clipRef, commission's runRef), and its
// refusal in the owner envelope. SCRIPTED — the kernel behind the bridge's fetch, AIKit's settings kept as AIKit keeps them (as
// tests/t795-loop-repeat-launch.test.mjs scripts them), recording every op. FIXTURE — the session's attempt readings, owner-shaped, as
// tests/factory-songs-844.test.mjs has them. Not a screen pass: choosing the note and pressing Repeat in the native window are
// UNVERIFIED (the lead's walk).
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
    effort: [], autonomy: [], set: ['launch'], takes: null, ...overrides},
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

test('Loop on a song stands refused: AIKit\'s executor gives the agent its turn again and starts no Run of the song', async () => {
  const songs = await import('../src/agent/songClips.ts')
  const clip = await import('../src/agent/clipBinding.ts')
  assert.match(songs.LOOP_SONG, /^Loop on a song: AIKit's task executor runs Loop by giving the agent its turn again; it starts no Run of the song — missing op: /)
  assert.match(songs.LOOP_SONG, /factory workflow perform/)
  const sent = []
  const context = {transport, project, settings: reading({launch: 'trigger'}), refused: null}
  const score = {reading: {state: 'read', reading: REAL.score_after, target: TARGET}, rack: [], edit: async () => {}, fill: async () => {}, picks: null, dismiss: noop}
  for (const [unit, refused] of [['release-check', true], ['eros-verify', false]]) {
    const wiring = clip.factoryWiring({sessionRef: 'ses-eros', n: 1}, context, null, null, score, key => key === 'unit' ? unit : undefined)
    assert.equal(typeof wiring.acts.loop, 'function')
    const was = globalThis.fetch
    globalThis.fetch = async (_url, init) => { sent.push(JSON.parse(init.body)); return {json: async () => ({ok: false, error: 'not here'})} }
    try {
      if (refused) await assert.rejects(wiring.acts.loop(true), error => error.message === songs.LOOP_SONG)
      else await wiring.acts.loop(true).catch(() => {})
    } finally { globalThis.fetch = was }
  }
  assert.equal(sent.filter(op => op.op === 'encounter_session_settings' && op.request).length, 1, 'only the task\'s own Loop is written; the song\'s is refused before any write')
})

test('Routine… on a song stands refused naming what it waits for; Export Song… with a track selected renders that track\'s row', async () => {
  const songs = await import('../src/agent/songClips.ts')
  const rows = await import('../src/agent/SongRows.tsx')
  assert.match(songs.ROUTINE_SONG, /^A routine runs a song: no owner starts one — /)
  assert.match(songs.ROUTINE_SONG, /admit-routine-continuation/)
  assert.match(songs.ROUTINE_SONG, /\(AIKit · Software Factory\)\.$/)
  const row = {key: 'song-maker/release-check', name: 'release-check', clipRef: 'factory-song:song-maker/release-check', path: '/walk/maker/.factory/songs/release-check.song.json',
    statePath: '/walk/maker/.factory/development-state.json', standing: 'current', units: 6, rows: 6, entry: 'development-and-knowledge.workflow.ts', importedFrom: null, why: '', clip: {}}
  // The preview (portalled into the browser's preview host) holds Remake and Routine…, the latter refused in its words.
  const markup = renderToStaticMarkup(rows.songPreview(row, noop))
  assert.match(markup, /data-action="remake-song"/)
  assert.match(markup, /<button[^>]*data-action="song-routine"[^>]*disabled=""/)
  assert.ok(markup.includes(songs.ROUTINE_SONG.replace(/'/g, '&#x27;')), markup)
  // Export Song…: a session's track selected renders its row; a task selected renders the whole song.
  const clip = await import('../src/agent/clipBinding.ts')
  const track = {sessionRef: 'ses-eros', agentRef: 'agent/anima-eros', group: false}
  assert.deepEqual(clip.exportChoiceOf('space:anima:ses-eros', {track}), {rows: ['agent/anima-eros']})
  assert.deepEqual(clip.exportChoiceOf('space:anima:ses-eros#task/1', {track}), {})
  assert.deepEqual(clip.exportChoiceOf('space:anima:ses-eros', {track: {...track, agentRef: null}}), {})
  assert.deepEqual(clip.exportChoiceOf(null, null), {})
  assert.ok(/exportSong\(transport, sessions && sessionRef \? scored\.reading : null, exportChoiceOf\(selected\.ref, chosen\)\)/.test(await source('../src/agent/clipBinding.ts')),
    'File › Export Song… hands Factory the choice the selection makes')
})
