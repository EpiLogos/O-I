import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'
import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'

const root = new URL('../../../../', import.meta.url)
const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};
import {readFile} from 'node:fs/promises';
export async function resolve(s, c, n) {
  try { return await n(s, c) } catch (e) {
    if (!s.startsWith('.')) throw e;
    if (s.endsWith('.js')) { try { return await n(s.slice(0, -3) + '.ts', c) } catch {} }
    for (const x of ['.ts', '.tsx']) { try { return await n(s + x, c) } catch {} }
    throw e;
  }
}
export async function load(u, c, n) {
  if (u.endsWith('.css')) return {format: 'module', shortCircuit: true, source: 'export {}'};
  if (!u.endsWith('.ts') && !u.endsWith('.tsx')) return n(u, c);
  return {format: 'module', shortCircuit: true, source: ts.transpileModule(await readFile(new URL(u), 'utf8'), {fileName: new URL(u).pathname,
    compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX}}).outputText};
}`)}`, import.meta.url)

const {
  buildTracks,
  buildTaskClips,
  eventsForSession,
  needleFor,
  sharedAxis,
  HEARTBEAT_HORIZON_MS,
} = await import('../src/agent/agentRunModel.ts')
const {AgentShellProvider} = await import('../src/agent/AgentShellContext.tsx')
const {AgentSessionGrid} = await import('../src/agent/AgentSessionGrid.tsx')

const NOW = 1_800_000_000_000

const ROWS = [
  {spaceRef: 'space/alpha', spaceLabel: 'Alpha crew', sessionRef: 'sess-a1', purpose: 'Lead the port', agentRef: 'agent/fizz', raw: {}},
  {spaceRef: 'space/alpha', spaceLabel: 'Alpha crew', sessionRef: 'sess-a2', purpose: 'Scout widgets', agentRef: 'agent/scout', raw: {}},
  {spaceRef: 'space/beta', spaceLabel: 'Beta', sessionRef: 'sess-b1', purpose: 'Solo repair', agentRef: undefined, raw: {}},
]

const ROSTER = new Map([
  ['agent/fizz', {name: 'Fizz', accepted: true}],
  ['agent/scout', {name: 'Scout', accepted: false}],
])

test('buildTracks derives a group per space with members at depth 1 and roster identity', () => {
  const tracks = buildTracks(ROWS, ROSTER, {nowUnixMs: NOW})
  assert.equal(tracks.length, 5, 'two space groups + three member sessions')
  const alpha = tracks[0]
  assert.equal(alpha.group, true)
  assert.equal(alpha.depth, 0)
  assert.equal(alpha.spaceRef, 'space/alpha')
  assert.deepEqual(alpha.memberRefs, ['sess-a1', 'sess-a2'])
  assert.equal(alpha.parentRef, null)
  assert.match(alpha.disclosure, /parent linkage/, 'the absent parent field is disclosed, not simulated')
  const a1 = tracks[1]
  assert.equal(a1.group, false)
  assert.equal(a1.depth, 1)
  assert.equal(a1.parentRef, 'space/alpha')
  assert.equal(a1.agentName, 'Fizz', 'roster name replaces the dead undefined-stub')
  assert.equal(a1.agentAccepted, true)
  const a2 = tracks[2]
  assert.equal(a2.agentName, 'Scout')
  assert.equal(a2.agentAccepted, false, 'roster acceptance carried, not assumed')
  const b1 = tracks[4]
  assert.equal(b1.agentRef, null)
  assert.equal(b1.agentName, null)
  assert.equal(b1.agentAccepted, null, 'no roster entry is a disclosed absence, not a guess')
  for (const track of tracks) {
    assert.equal(track.telemetryOn, true, 'telemetry defaults on')
    assert.deepEqual(track.budget, {used: null, max: null})
    assert.equal(track.tasks.length, 0)
    assert.equal(track.needle, null)
  }
})

const READING = purpose => ({request: {central: {task_ref: 'task/1', project: 'O-I', purpose}}})

test('buildTaskClips maps running/stalled/done/queued/unknown and always appends exactly one soft-stop slot', () => {
  const running = buildTaskClips(READING('Map the field'), [{subject_ref: 'agency/sess-a1/hb', instant_unix_ms: NOW - 10_000, summary: 'heartbeat'}], 'sess-a1', NOW)
  assert.equal(running.length, 2, 'the data has one task, so one real clip plus the soft-stop slot — never a constant 8')
  assert.equal(running[0].state, 'running')
  assert.equal(running[0].title, 'Map the field')
  assert.equal(running[0].lastActivityUnixMs, NOW - 10_000)
  assert.equal(running[0].softStop, false)
  assert.match(running[0].disclosure, /Running by inference/, 'encounter_task_read has no state field — the inference is disclosed')
  assert.equal(running[1].softStop, true)
  assert.equal(running[1].n, 2)
  assert.equal(running[1].startUnixMs, null)

  const stalled = buildTaskClips(READING('generate fixtures'), [{subject_ref: 'sess-a2', instant_unix_ms: NOW - 10 * 60_000}], 'sess-a2', NOW)
  assert.equal(stalled[0].state, 'stalled')
  assert.equal(stalled[0].lastActivityUnixMs, NOW - 10 * 60_000, 'frozen at last output')
  assert.match(stalled[0].disclosure, /Stalled by inference/)

  const done = buildTaskClips({state: 'done', ...READING('tune physics')}, [], 'sess-x', NOW)
  assert.equal(done[0].state, 'done', 'the owner’s own state field wins')
  assert.equal(done[0].disclosure, null)
  assert.equal(done[0].lastActivityUnixMs, null, 'no events, no invented activity')

  const queued = buildTaskClips({status: 'queued', ...READING('drop old captures')}, [], 'sess-y', NOW)
  assert.equal(queued[0].state, 'queued')
  assert.equal(queued[0].startUnixMs, null, 'queued = known pending with no start; no length is drawn')
  assert.match(queued[0].disclosure, /Known pending with no start/)

  const unknown = buildTaskClips(READING('mystery'), [], 'sess-z', NOW)
  assert.equal(unknown[0].state, 'unknown')
  assert.match(unknown[0].disclosure, /unknown/, 'the source cannot say — disclosed, never substituted')

  const empty = buildTaskClips(null, [], 'sess-none', NOW)
  assert.deepEqual(empty.map(clip => clip.softStop), [true], 'no bound task means only the soft-stop slot')

  // No constant slot count anywhere: length is exactly the data's clips + 1.
  assert.equal(unknown.length, 2)
  assert.equal(empty.length, 1)
})

test('event matching prefers a structural subject_ref match over summary containment', () => {
  const events = [
    {subject_ref: 'unrelated/session', instant_unix_ms: NOW - 5_000, summary: 'mentions sess-a1 in prose'},
    {subject_ref: 'agency/sess-a1/turn-2', instant_unix_ms: NOW - 60_000, summary: 'a turn'},
  ]
  const matched = eventsForSession(events, 'sess-a1')
  assert.equal(matched.length, 1)
  assert.equal(matched[0].subject_ref, 'agency/sess-a1/turn-2', 'separator-boundary subject match wins')
  const clips = buildTaskClips(READING('work'), events, 'sess-a1', NOW)
  assert.equal(clips[0].lastActivityUnixMs, NOW - 60_000, 'the summary-only decoy did not become activity')
})

test('the rendered grid carries the oracle data-i strings and no constant slot rows', () => {
  const tracks = buildTracks(ROWS, ROSTER, {nowUnixMs: NOW}).map(track => {
    if (track.group) return track
    return {
      ...track,
      tasks: buildTaskClips(
        track.sessionRef === 'sess-a1' ? READING('Lead the port') : null,
        [{subject_ref: `agency/${track.sessionRef}/hb`, instant_unix_ms: track.sessionRef === 'sess-a1' ? NOW - 5_000 : Date.now() - 5 * 60_000}],
        track.sessionRef,
        Date.now(),
      ),
      needle: needleFor([{subject_ref: `agency/${track.sessionRef}/hb`, instant_unix_ms: Date.now() - 5_000}], track.sessionRef, {startUnixMs: Date.now() - 3_600_000, endUnixMs: Date.now()}),
    }
  })
  const html = renderToStaticMarkup(createElement(AgentShellProvider, null, createElement(AgentSessionGrid, {tracks})))
  assert.ok(html.includes('data-i="Hard stop|Stops this session now — mid-tool if needed — and keeps what was written as a draft."'), 'session hard stop')
  assert.ok(html.includes('data-i="Hard stop|Stops the group and every session in it'), 'group hard stop names the group')
  assert.ok(html.includes('data-i="Retry|Restarts a stalled or failed task from its last good step, same basis."'), 'unlit retry')
  assert.ok(html.includes('data-i="Empty slot|Its square stops the session after the current task (soft stop). Double-click to write a task; arm and press ● to speak one."'), 'soft-stop slot')
  assert.ok(html.includes('data-i="Task · 1|Click: its log below. Double-click or ↗: open the thread in the main space.'), 'task clip oracle')
  assert.ok(html.includes('data-i="Row · 1|Launch the row: fires every task in it across sessions — a batch."'), 'main row launch')
  assert.ok(html.includes('data-i="Telemetry · context source|Live’s track activator.'), 'session telemetry')
  assert.ok(html.includes('data-i="Telemetry|Live’s track activator, on the number: the whole group as a context source.'), 'group telemetry')
  assert.ok(html.includes('data-i="Solo|Only soloed sessions may run."'))
  assert.ok(html.includes('data-i="Arm|Who you are talking to: voice and the composer send here."'))
  assert.ok(html.includes('data-i="Watch|Live’s monitor.'), 'watch strip')
  assert.ok(html.includes('data-i="Model|This session’s model.'), 'model strip')
  assert.ok(html.includes('data-i="Main|The whole work: Ledger and Approvals live on its chain."'), 'main row')
  assert.ok(!html.includes('<span>Task</span>'), 'no literal-only "Task" placeholder slots')
  const emptySlots = html.split('data-i="Empty slot|').length - 1
  const sessions = tracks.filter(track => !track.group).length
  assert.equal(emptySlots, sessions, 'exactly one soft-stop slot per session — the data’s count, not 8')
  assert.ok(!html.includes('>8</'), 'no constant slot count rendered')
})
