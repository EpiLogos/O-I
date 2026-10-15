import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile, readdir} from 'node:fs/promises'
import {join} from 'node:path'
import {register} from 'node:module'
import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'

// The frame's ONE temporal read (timeline/temporalPoll.ts; R2 objection 13): Factory's run needles
// (agent/useTemporalEvents.ts) and the World cut (projections/useWorldTemporalReading.ts) both ask the kernel's
// `temporal_events_read`, whose own cost is ~70 s of owner time per call (136 owner processes, 15 Oct). They share one read,
// and each keeps its own shape. Lane Q: it is read when told the field may have moved — a receipt, an act, the epoch, the
// window regained — and otherwise at a slow floor while the window is seen; the 90 s poll is gone.
// Channel: scripted over the poll with the bridge's fetch stubbed (the hook effects' wiring is source-pinned here and
// UNVERIFIED on screen).
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

const {createTemporalPoll, temporalPollFor, civilWeekWindow, eventsBetween, eventsOfSubject, nextWindowBoundary, TEMPORAL_FLOOR_MS, TEMPORAL_ATTENTION_MIN_AGE_MS} = await import('../src/timeline/temporalPoll.ts')
const {agentTemporalEvents, useTemporalEvents, AGENT_WINDOW_MS} = await import('../src/agent/useTemporalEvents.ts')

const HOUR = 60 * 60 * 1000
const NOW = Date.UTC(2026, 9, 14, 12, 0, 0)
const settle = async () => { await new Promise(resolve => setImmediate(resolve)); await new Promise(resolve => setImmediate(resolve)) }
const reading = (document) => ({outcome: {result: 'temporal_events_reading', document}})

/** A stubbed bridge: every POST /op is recorded; the answer is the document given. Counts only this transport's calls. */
function bridge(url, document = {events: []}) {
  const calls = []
  const original = globalThis.fetch
  globalThis.fetch = async (target, init) => {
    if (!String(target).startsWith(url)) return original(target, init)
    calls.push(JSON.parse(init.body))
    return {json: async () => ({ok: true, ...reading(document)})}
  }
  return calls
}

const event = (subject_ref, instant_unix_ms, extra = {}) => ({stream: 's', kind: 'k', subject_ref, instant_unix_ms, summary: subject_ref, ...extra})

test('two readers of one transport are served by ONE temporal_events_read, at mount and at the floor — no 90 s poll', async (t) => {
  t.mock.timers.enable({apis: ['setTimeout', 'Date'], now: Date.UTC(2026, 9, 14, 6, 0, 0)})
  const transport = {kind: 'bridge', url: 'http://bridge.test/two-readers'}
  const calls = bridge(transport.url, {events: [event('run:a', Date.now() - HOUR)]})
  // The agent shell's reader and the World cut's reader each take the frame's poll for the transport (useTemporalReading).
  const agentPoll = temporalPollFor(transport)
  const worldPoll = temporalPollFor({...transport})
  assert.equal(agentPoll, worldPoll, 'the same transport is the same poll, whoever asks')
  const agentSeen = []
  const worldSeen = []
  const offAgent = agentPoll.subscribe(() => agentSeen.push(agentPoll.snapshot().revision))
  const offWorld = worldPoll.subscribe(() => worldSeen.push(worldPoll.snapshot().revision))
  await settle()
  assert.equal(calls.length, 1, 'two consumers, one owner call')
  assert.equal(calls[0].op, 'temporal_events_read')
  assert.deepEqual(agentSeen, worldSeen, 'both readers are told of the same execution')
  assert.equal(agentSeen.length, 1)
  assert.equal(agentPoll.snapshot().events.length, 1, 'and both read the same standing reading')

  t.mock.timers.tick(90_000)
  await settle()
  assert.equal(calls.length, 1, 'no 90 s cadence: nothing told the poll the field moved')
  assert.ok(TEMPORAL_FLOOR_MS >= 300_000, 'the floor is slow: the read costs the owner a minute')
  t.mock.timers.tick(TEMPORAL_FLOOR_MS - 90_000 - 1)
  await settle()
  assert.equal(calls.length, 1, 'no read before the floor')
  t.mock.timers.tick(1)
  await settle()
  assert.equal(calls.length, 2, 'one read at the floor, however many readers')
  assert.deepEqual(agentSeen, worldSeen)

  offAgent()
  await settle()
  t.mock.timers.tick(TEMPORAL_FLOOR_MS)
  await settle()
  assert.equal(calls.length, 3, 'a reader remains: the floor runs')
  offWorld()
  await settle()
  t.mock.timers.tick(TEMPORAL_FLOOR_MS * 3)
  await settle()
  assert.equal(calls.length, 3, 'the last reader leaving stops the poll: no timer, no read')
})

test('a read in flight is awaited, never doubled: refresh and the floor share it; a notice during it asks once more after it', async (t) => {
  t.mock.timers.enable({apis: ['setTimeout']})
  const calls = []
  let release
  const poll = createTemporalPoll({kind: 'bridge', url: 'http://bridge.test/in-flight'}, {
    now: () => NOW,
    kernelOp: (_transport, op) => new Promise(resolve => { calls.push(op); release = () => resolve(reading({events: []})) }),
  })
  const off = poll.subscribe(() => {})
  const first = poll.refresh()
  const second = poll.refresh()
  assert.equal(first, second, 'a refresh while a read stands is the read itself')
  assert.equal(calls.length, 1, 'nothing piles a second read behind the first')
  release()
  await first
  assert.equal(poll.snapshot().status, 'ready')
  void poll.refresh()
  assert.equal(calls.length, 2, 'once settled, a refresh reads again')
  // A notice while this read runs: the read may have started before the change, so one more read follows it — one, however
  // many notices arrive.
  poll.notice('kernel receipt working_surface_driving')
  poll.notice('a told act')
  assert.equal(calls.length, 2)
  release()
  await settle()
  assert.equal(calls.length, 3, 'exactly one read follows the read in flight')
  release()
  await settle()
  assert.equal(calls.length, 3)
  assert.equal(poll.snapshot().cause, 'a told act', 'the reading says what asked for it')
  off()
})

test('the shared read asks the widest window — the civil week through tomorrow at UTC midnights — and each reader narrows it', async () => {
  const week = civilWeekWindow(new Date(NOW))
  assert.equal(week.fromUnixMs, Date.UTC(2026, 9, 7))
  assert.equal(week.toUnixMs, Date.UTC(2026, 9, 15))
  const events = [
    event('run:now', NOW - 2 * HOUR),
    event('run:yesterday', NOW - 30 * HOUR),
    event('run:week', NOW - 6 * 24 * HOUR),
    event('run:soon', NOW + HOUR),
    {stream: 's', kind: 'k', subject_ref: 'run:undated', summary: 'no civil position'},
    event('thread:t', NOW - HOUR, {evidence_refs: ['run:now']}),
  ]
  const absences = [{stream: 'wiki', reason: 'owner-absent', owner_words: 'no owner here'}]
  const calls = []
  const poll = createTemporalPoll({kind: 'bridge', url: 'http://bridge.test/narrowing'}, {
    now: () => NOW,
    kernelOp: async (_transport, op) => { calls.push(op); return reading({events, absences}) },
  })
  const off = poll.subscribe(() => {})
  await settle()
  assert.deepEqual(calls[0].query, {window: {window: 'between', from_unix_ms: week.fromUnixMs, to_unix_ms: week.toUnixMs}})
  const standing = poll.snapshot()
  assert.equal(standing.status, 'ready')
  assert.equal(standing.requestedAtUnixMs, NOW)
  assert.equal(standing.windowFromUnixMs, week.fromUnixMs)
  assert.equal(standing.windowToUnixMs, week.toUnixMs)
  // The World cut's shape: the whole week, as the kernel gave it, with the absences the reading names.
  assert.equal(standing.events.length, events.length)
  assert.deepEqual(standing.absences, absences)
  // The agent shell's shape: the 24 hours before the read was requested — the kernel's `between` rule, so the future and
  // the instant-less are out.
  assert.deepEqual(agentTemporalEvents(standing).map(row => row.subject_ref), ['run:now', 'thread:t'])
  assert.equal(AGENT_WINDOW_MS, 24 * HOUR)
  // The subject rule is the kernel's: the event's subject, or any evidence ref it carries.
  assert.deepEqual(agentTemporalEvents(standing, 'run:now').map(row => row.subject_ref), ['run:now', 'thread:t'])
  assert.deepEqual(agentTemporalEvents(standing, 'run:week'), [], 'a subject outside the 24 h window is not the agent shell\'s')
  off()
})

test('the window rules are the kernel\'s own (temporal_events.rs): [from, to), and an event with no instant is never in a window', () => {
  const rows = [event('a', 10), event('b', 20), event('c', 30), {subject_ref: 'd'}, {subject_ref: 'e', instant_unix_ms: null}]
  assert.deepEqual(eventsBetween(rows, 10, 30).map(row => row.subject_ref), ['a', 'b'])
  assert.deepEqual(eventsBetween(rows, 0, 1_000).map(row => row.subject_ref), ['a', 'b', 'c'])
  assert.deepEqual(eventsOfSubject([event('x', 1, {evidence_refs: ['y']}), event('y', 2), event('z', 3)], 'y').map(row => row.subject_ref), ['x', 'y'])
})

test('a refusal, an owner that cannot answer and a transport that cannot serve are named, never silently empty — and cost no call when there is no transport', async () => {
  const refused = createTemporalPoll({kind: 'bridge', url: 'http://bridge.test/refused'}, {
    kernelOp: async () => ({outcome: null, error: 'the owner refused the temporal read'}),
  })
  const offRefused = refused.subscribe(() => {})
  await settle()
  assert.equal(refused.snapshot().status, 'unavailable')
  assert.equal(refused.snapshot().error, 'the owner refused the temporal read')
  assert.deepEqual(refused.snapshot().events, [])
  assert.deepEqual(agentTemporalEvents(refused.snapshot()), [])
  offRefused()

  const wrongAnswer = createTemporalPoll({kind: 'bridge', url: 'http://bridge.test/wrong'}, {kernelOp: async () => ({outcome: {result: 'agency_reading'}})})
  const offWrong = wrongAnswer.subscribe(() => {})
  await settle()
  assert.equal(wrongAnswer.snapshot().error, 'Temporal events reading unavailable')
  offWrong()

  const thrown = createTemporalPoll({kind: 'bridge', url: 'http://bridge.test/thrown'}, {kernelOp: async () => { throw new Error('bridge down') }})
  const offThrown = thrown.subscribe(() => {})
  await settle()
  assert.equal(thrown.snapshot().status, 'unavailable')
  assert.match(thrown.snapshot().error, /bridge down/)
  offThrown()

  let calls = 0
  const none = createTemporalPoll({kind: 'unavailable', reason: 'no kernel transport here'}, {kernelOp: async () => { calls++; return reading({events: []}) }})
  const seen = []
  const offNone = none.subscribe(() => seen.push(none.snapshot().error))
  await settle()
  assert.equal(calls, 0, 'no transport, no owner call')
  assert.deepEqual(seen, ['no kernel transport here'])
  assert.equal(none.snapshot().status, 'unavailable')
  offNone()
})

test('each completed execution moves the revision once, a refusal included; the snapshot is the same object between executions', async () => {
  let answer = reading({events: [event('a', NOW - HOUR)]})
  const poll = createTemporalPoll({kind: 'bridge', url: 'http://bridge.test/revisions'}, {now: () => NOW, kernelOp: async () => answer})
  const first = poll.snapshot()
  assert.equal(first.status, 'reading')
  const seen = []
  const off = poll.subscribe(() => seen.push(poll.snapshot().revision))
  await settle()
  const ready = poll.snapshot()
  assert.equal(ready.status, 'ready')
  assert.ok(ready.revision > first.revision)
  assert.equal(poll.snapshot(), ready, 'no execution, no new snapshot (a store a render can trust)')
  answer = {outcome: null, error: 'refused this time'}
  await poll.refresh()
  assert.equal(poll.snapshot().status, 'unavailable')
  assert.ok(poll.snapshot().revision > ready.revision)
  answer = reading({events: []})
  await poll.refresh()
  assert.equal(poll.snapshot().status, 'ready')
  assert.deepEqual(seen, [...seen].sort((a, b) => a - b), 'the revision never goes back')
  assert.equal(new Set(seen).size, seen.length, 'each execution is announced once')
  off()
})

test('React\'s replay of an effect (unsubscribe, then subscribe, in one task) does not restart the poll; a real stop does', async (t) => {
  t.mock.timers.enable({apis: ['setTimeout']})
  const transport = {kind: 'bridge', url: 'http://bridge.test/replay'}
  const calls = bridge(transport.url)
  const poll = createTemporalPoll(transport)
  let off = poll.subscribe(() => {})
  off()
  off = poll.subscribe(() => {})
  await settle()
  assert.equal(calls.length, 1, 'a replayed mount reads once')
  off()
  await settle()
  t.mock.timers.tick(TEMPORAL_FLOOR_MS * 2)
  await settle()
  assert.equal(calls.length, 1, 'stopped: nothing more is read')
  assert.equal(poll.snapshot().status, 'reading', 'and nothing stale stands for the next reader to take as fresh')
  const again = poll.subscribe(() => {})
  await settle()
  assert.equal(calls.length, 2, 'a new reader starts the poll again, with a fresh read')
  assert.equal(poll.snapshot().status, 'ready')
  again()
})

test('a read that lands after the poll stopped lands nowhere', async () => {
  const seen = []
  let release
  const poll = createTemporalPoll({kind: 'bridge', url: 'http://bridge.test/late'}, {
    kernelOp: () => new Promise(resolve => { release = () => resolve(reading({events: [event('late', NOW)]})) }),
  })
  const off = poll.subscribe(() => seen.push(poll.snapshot().status))
  off()
  await settle()
  release()
  await settle()
  assert.deepEqual(seen, [], 'no reader, no announcement')
  assert.equal(poll.snapshot().status, 'reading')
})

test('the agent shell\'s hook reads the poll: rendered before any read it is empty and quiet', () => {
  function Probe({transport}) {
    const {events, error} = useTemporalEvents(transport)
    return createElement('p', null, `${events.length}|${error ?? 'none'}`)
  }
  assert.match(renderToStaticMarkup(createElement(Probe, {transport: {kind: 'bridge', url: 'http://bridge.test/ssr'}})), /0\|none/)
})

/** A poll over a counted owner with a fake window: visibility, the window's return and the shell's told acts are the harness's. */
function toldPoll(t, start = Date.UTC(2026, 9, 14, 6, 0, 0)) {
  t.mock.timers.enable({apis: ['setTimeout', 'Date'], now: start})
  const calls = []
  let visible = true
  const attention = new Set()
  const told = new Set()
  const poll = createTemporalPoll({kind: 'bridge', url: 'http://bridge.test/told'}, {
    kernelOp: async (_transport, op) => { calls.push(op); return reading({events: []}) },
    visible: () => visible,
    onAttention: listener => { attention.add(listener); return () => attention.delete(listener) },
    onTold: listener => { told.add(listener); return () => told.delete(listener) },
  })
  return {
    poll, calls,
    setVisible: next => { visible = next },
    regain: () => { for (const listener of attention) listener() },
    tell: cause => { for (const listener of told) listener(cause) },
    listeners: () => attention.size + told.size,
  }
}

test('hidden, the floor reads nothing; coming back reads when the standing reading is older than a minute', async (t) => {
  const h = toldPoll(t)
  const off = h.poll.subscribe(() => {})
  await settle()
  assert.equal(h.calls.length, 1)
  h.setVisible(false)
  t.mock.timers.tick(TEMPORAL_FLOOR_MS * 4)
  await settle()
  assert.equal(h.calls.length, 1, 'twenty minutes hidden: not one read')
  h.setVisible(true)
  h.regain()
  await settle()
  assert.equal(h.calls.length, 2, 'the window regained, the reading twenty minutes old: read')
  assert.equal(h.poll.snapshot().cause, 'window regained')
  t.mock.timers.tick(TEMPORAL_ATTENTION_MIN_AGE_MS - 1_000)
  h.regain()
  await settle()
  assert.equal(h.calls.length, 2, 'a return within the minute reads nothing: the reading is that fresh')
  off()
  await settle()
  assert.equal(h.listeners(), 0, 'the last reader leaving lets go of the window\'s notices')
})

test('the kernel\'s receipts and the spine\'s epoch tell the poll; a receipt that cannot move the field does not', async (t) => {
  const h = toldPoll(t)
  const off = h.poll.subscribe(() => {})
  await settle()
  const receipt = (seq, event, extra = {}) => ({seq, schema: 'oi.kernel-event/v1', version: 1, event, ...extra})
  const standing = [receipt(1, 'focus_changed'), receipt(2, 'working_surface_driving')]
  h.poll.observe(standing, '1|central')
  await settle()
  assert.equal(h.calls.length, 1, 'the receipts already standing when the reader arrived are not news')
  h.poll.observe([...standing, receipt(3, 'surface_changed'), receipt(4, 'file_changed', {path: 'Work/O-I/docs/x.md'})], '1|central')
  await settle()
  assert.equal(h.calls.length, 1, 'receipts that cannot move the field ask nothing')
  h.poll.observe([...standing, receipt(5, 'file_changed', {path: 'Control/agents/now/clearings/abc/T/thought.json'})], '1|central')
  await settle()
  assert.equal(h.calls.length, 2, 'a write under the NOW field reads')
  assert.equal(h.poll.snapshot().cause, 'kernel receipt file_changed')
  h.poll.observe([...standing, receipt(5, 'file_changed', {path: 'Control/agents/now/clearings/abc/T/thought.json'})], '1|central')
  await settle()
  assert.equal(h.calls.length, 2, 'every reader passes the same receipts: each is taken once')
  h.poll.observe([], '2|central')
  await settle()
  assert.equal(h.calls.length, 3, 'the spine\'s epoch moved: read')
  h.tell('the agency reading moved (window regained)')
  await settle()
  assert.equal(h.calls.length, 4, 'a told act reads')
  off()
})

test('the floor counts from the last completed read, and a reading is never held past the window\'s own boundary', async (t) => {
  // 23:58 UTC: the floor would fall after midnight, when the civil week's window has already moved.
  const h = toldPoll(t, Date.UTC(2026, 9, 14, 23, 58, 0))
  const off = h.poll.subscribe(() => {})
  await settle()
  assert.equal(h.calls.length, 1)
  t.mock.timers.tick(2 * 60_000 - 1)
  await settle()
  assert.equal(h.calls.length, 1)
  t.mock.timers.tick(1)
  await settle()
  assert.equal(h.calls.length, 2, 'read at the UTC midnight the window moves at')
  assert.equal(h.calls[1].query.window.from_unix_ms, Date.UTC(2026, 9, 8), 'and it asks the new day\'s window')
  assert.equal(nextWindowBoundary(Date.UTC(2026, 9, 14, 23, 58)), Date.UTC(2026, 9, 15))
  // A told read resets the floor: it counts from that read.
  t.mock.timers.tick(TEMPORAL_FLOOR_MS - 60_000)
  h.tell('a told act')
  await settle()
  assert.equal(h.calls.length, 3)
  t.mock.timers.tick(TEMPORAL_FLOOR_MS - 1)
  await settle()
  assert.equal(h.calls.length, 3, 'the floor waits a whole floor after the told read')
  t.mock.timers.tick(1)
  await settle()
  assert.equal(h.calls.length, 4)
  off()
})

// The wiring, pinned on source (the hooks' effects need a DOM this suite does not have).
const src = new URL('../src/', import.meta.url).pathname
async function sourceFiles(dir) {
  const out = []
  for (const entry of await readdir(dir, {withFileTypes: true})) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...await sourceFiles(path))
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(path)
  }
  return out
}

test('both readers consume the poll and run no timer or kernel read of their own', async () => {
  const agent = await readFile(new URL('../src/agent/useTemporalEvents.ts', import.meta.url), 'utf8')
  const world = await readFile(new URL('../src/projections/useWorldTemporalReading.ts', import.meta.url), 'utf8')
  assert.match(agent, /useTemporalReading\(transport\)/, 'the agent shell takes the frame\'s reading')
  assert.match(world, /useTemporalReading\(transport\)/, 'the World cut takes the frame\'s reading')
  for (const [name, source] of [['useTemporalEvents.ts', agent], ['useWorldTemporalReading.ts', world]]) {
    assert.doesNotMatch(source, /setInterval|setTimeout/, `${name} runs no cadence of its own`)
    assert.doesNotMatch(source, /op: 'temporal_events_read'/, `${name} does not read the op itself`)
  }
  assert.doesNotMatch(agent, /kernelOp/, 'the agent shell\'s reader makes no kernel call')
  assert.doesNotMatch(world, /kernelOp/, 'the World cut makes no kernel call of its own')
  assert.match(world, /agencyEntry\(transport, 'O-I'\)/, 'its run lanes are the window\'s one agency answer (owners/agency.ts), never an agency read of its own')
})

test('the op is read in one place: the poll. A third call site is a third poller', async () => {
  const callers = []
  for (const file of await sourceFiles(src)) {
    if (/op: 'temporal_events_read'/.test(await readFile(file, 'utf8'))) callers.push(file.slice(src.length))
  }
  assert.deepEqual(callers.sort(), [
    'inhabitants/CentralDayNowDevice.tsx', // one read per selected day, on demand — not a poller
    'timeline/temporalPoll.ts',
  ])
})
