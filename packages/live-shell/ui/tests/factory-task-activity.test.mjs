// O-I #741 (lane G, OpenRig's behaviours into Factory): a task on Factory's tracks stands as Factory reads it. The shell carries the
// owners' readings to Factory verbatim — AIKit's encounter status of the session, its check-ins, the task binding — and draws Factory's
// answer (`factory development task-activity`, factory.task-activity/v1): the manual's word, the evidence in words, the retry a stall
// lights, and the closure a closed custody carries. Nothing is guessed: until Factory answers, a task is unknown and says why, and no
// needle stalls.
// Channels: SCRIPTED — Factory's and AIKit's answers are their documented shapes, served by a recording call, never the owners. Not a
// screen pass.
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

const activity = await import('../src/agent/taskActivity.ts')
const model = await import('../src/agent/agentRunModel.ts')
const clip = await import('../src/agent/clipBinding.ts')
const tracks = await import('../src/timeline/factoryTrackAdapter.ts')

const NOW = 1_800_000_000_000
const S = 'agency/session-a'
const TASK = {request: {central: {task_ref: 'task:fixtures', purpose: 'Write the fixtures'}}}
const EVENTS = [{subject_ref: S, kind: 'tool.done', instant_unix_ms: NOW - 400_000}, {subject_ref: S, kind: 'tool.done', instant_unix_ms: NOW - 412_000}]

const track = () => {
  const members = model.buildTracks([{spaceRef: 'space/a', sessionRef: S, purpose: 'p'}], new Map()).filter(t => !t.group)
  return members.map(t => ({...t, tasks: model.buildTaskClips(TASK, EVENTS, S, NOW), needle: model.needleFor(EVENTS, S, model.sharedAxis([], NOW))}))
}

const reading = word => ({schema: 'factory.task-activity/v1', read_at_unix_ms: NOW, bound_ms: 90000, bound_from: 'factory', custody_scope: 'x',
  tasks: [{agent_session: S, task_ref: 'task:fixtures', word, retry: word === 'stalled', decided_by: 'window-sampling',
    why: word === 'stalled' ? 'No check-in within the 90 s bound: the last was 400 s ago, with its task open.' : word === 'done' ? 'Closed: completed no-follow-on.' : `Read ${word}.`,
    obligation: word === 'done' ? {state: 'closed', custody: [{custody_ref: 'factory:custody:1', state: 'completed', closure: {reason: 'no-follow-on'}}]} : {state: 'open', custody: []}}]})

test('the evidence Factory takes is the owners\' readings, carried verbatim', () => {
  const [t] = track()
  const task = activity.realTask(t)
  const status = {connection: {agent_session: S, state: 'TurnInFlight', error: null, permissions: []}, readAtUnixMs: NOW}
  const evidence = activity.taskEvidenceOf(t, task, status, EVENTS, NOW)
  assert.deepEqual(evidence, {agent_session: S, task_ref: 'task:fixtures', bound: true, connection: status.connection, connection_read_at_unix_ms: NOW,
    check_ins: {source_ref: activity.CHECK_IN_SOURCE, count: 2, latest_unix_ms: NOW - 400_000, read_at_unix_ms: NOW}})
  const refused = activity.taskEvidenceOf(t, task, {refusal: 'no resident native session', readAtUnixMs: NOW}, [], NOW)
  assert.equal(refused.connection_refusal, 'no resident native session')
  assert.equal('connection' in refused, false)
  assert.deepEqual(refused.check_ins, {source_ref: activity.CHECK_IN_SOURCE, count: 0, read_at_unix_ms: NOW}, 'no check-in is said, never invented')
  assert.equal(activity.taskActivityRequest([evidence]).schema, 'factory.task-activity-request/v1')
})

test('until Factory answers, a task is unknown and says why, and no needle stalls', () => {
  // The run model's own 90 s horizon would call this task stalled; that guess never reaches the person.
  const [before] = track()
  assert.equal(activity.realTask(before).state, 'stalled', 'the provisional model guesses')
  const [t] = activity.withTaskActivity(track(), {bySession: new Map(), unread: new Map()})
  const task = activity.realTask(t)
  assert.equal(task.state, 'unknown')
  assert.equal(task.disclosure, activity.TASK_ACTIVITY_PENDING)
  assert.equal(task.standing, undefined)
  assert.equal(t.needle.state, 'idle', 'no stall drawn without Factory\'s reading')
  assert.equal(t.needle.atUnixMs, NOW - 400_000, 'the needle still stands at the last check-in')
  const [refused] = activity.withTaskActivity(track(), {bySession: new Map(), unread: new Map([[S, 'Factory did not read how this task stands: boom']])})
  assert.equal(activity.realTask(refused).disclosure, 'Factory did not read how this task stands: boom')
})

test('Factory\'s word draws the task, its stall lights the track\'s retry, and a closed task carries its closure', () => {
  const stalled = activity.readingsBySession(reading('stalled'))
  const [t] = activity.withTaskActivity(track(), {bySession: stalled, unread: new Map()})
  const task = activity.realTask(t)
  assert.equal(task.state, 'stalled')
  assert.equal(t.needle.state, 'stalled', 'the track lights a retry from the stalled needle (timeline/factoryTrackAdapter.ts)')
  assert.deepEqual(task.standing, {word: 'stalled', why: 'No check-in within the 90 s bound: the last was 400 s ago, with its task open.', retry: true,
    decidedBy: 'window-sampling', closure: null})
  const [queued] = activity.withTaskActivity(track(), {bySession: activity.readingsBySession(reading('queued')), unread: new Map()})
  assert.equal(activity.realTask(queued).state, 'queued')
  assert.equal(activity.realTask(queued).startUnixMs, null, 'a queued task has no length')
  const [stopped] = activity.withTaskActivity(track(), {bySession: activity.readingsBySession(reading('stopped')), unread: new Map()})
  assert.equal(activity.realTask(stopped).standing.word, 'stopped')
  assert.equal(activity.realTask(stopped).state, 'stopped', 'Stopped draws as itself on the track (round two)')
  assert.equal(stopped.needle.state, 'idle')
  // On the track: Stopped is the grid's own status, "ready, in full colour", standing where it ran.
  const set = tracks.factoryTrackAdapter.project({tracks: [stopped], nowUnixMs: NOW})
  const drawn = set.clips.find(c => c.trackId === model.trackKey(stopped))
  assert.equal(drawn.status, 'stopped')
  assert.ok(drawn.at && typeof drawn.at.start === 'number', 'a stopped task keeps its place on the ruler')
  // Factory's check-in bound rides each task's standing (bound_ms), for the faces (runFaces.ts boundOf).
  const [bounded] = activity.withTaskActivity(track(), {bySession: activity.readingsBySession(reading('running')), unread: new Map(), boundMs: new Map([[S, 90_000]])})
  assert.equal(activity.realTask(bounded).standing.boundMs, 90_000)
  const [done] = activity.withTaskActivity(track(), {bySession: activity.readingsBySession(reading('done')), unread: new Map()})
  assert.equal(activity.realTask(done).standing.closure, 'completed no-follow-on')
  assert.equal(activity.readingsBySession({schema: 'other', tasks: []}), null, 'only Factory\'s reading is drawn')
})

test('the Clip panel reads Factory\'s word, its evidence, the retry and the closure', () => {
  const values = standing => {
    const [t] = activity.withTaskActivity(track(), {bySession: activity.readingsBySession(reading(standing)), unread: new Map()})
    return clip.factoryClipValues(t, activity.realTask(t), {tracks: [t], events: null})
  }
  const stalled = values('stalled')
  assert.deepEqual([stalled.state, stalled['state.retry'], stalled['state.why']], ['stalled', true, 'No check-in within the 90 s bound: the last was 400 s ago, with its task open.'])
  assert.equal('closure' in stalled, false)
  const stopped = values('stopped')
  assert.equal(stopped.state, 'stopped', 'Stopped is the manual\'s word, drawn in the Clip panel')
  const done = values('done')
  assert.deepEqual([done.state, done.closure], ['done', 'completed no-follow-on'])
  const [unread] = activity.withTaskActivity(track(), {bySession: new Map(), unread: new Map()})
  const none = clip.factoryClipValues(unread, activity.realTask(unread), {tracks: [unread], events: null})
  assert.equal('state' in none, false, 'nothing is drawn where no evidence stands')
  assert.equal(none['state.why'], activity.TASK_ACTIVITY_PENDING)
  const wiring = clip.factoryWiring(null)
  for (const key of ['state', 'state.why', 'state.retry', 'closure']) assert.match(wiring.reads[key], /Factory/, key)
})

test('a register\'s tasks are read against its located Factory state, and a refusal is named per session', async () => {
  const asked = []
  const call = async op => {
    asked.push(op)
    if (op.request.kind === 'locate') return {outcome: {result: 'factory_development_reading', data: {locations: [{state: 'located', location: {statePath: '/w/O-I/.factory/state.json', projectRef: 'project:1'}}]}}}
    return {outcome: {result: 'factory_development_reading', data: reading('running')}}
  }
  const evidence = [{agent_session: S, task_ref: 'task:fixtures', bound: true}]
  const answer = await activity.readTaskActivity(call, 'O-I', evidence)
  assert.deepEqual(asked.map(op => op.request.kind), ['locate', 'task-activity-read'], 'its kind ends in read: the bridge hears a read, never a write')
  assert.equal(asked[1].request.state_path, '/w/O-I/.factory/state.json')
  assert.equal(answer.bySession.get(S).word, 'running')
  assert.equal(answer.boundMs.get(S), 90000, 'the bound Factory read the register against')
  const refusing = async op => (op.request.kind === 'locate' ? {outcome: {result: 'factory_development_reading', data: {locations: [{state: 'absent', project: 'O-I'}]}}}
    : {error: 'factory: unknown command `task-activity`'})
  const refused = await activity.readTaskActivity(refusing, 'O-I', evidence)
  assert.match(refused.unread.get(S), /Factory did not read how this task stands: factory: unknown command/)
})
