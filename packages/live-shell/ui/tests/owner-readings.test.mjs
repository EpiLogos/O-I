import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'

// Lane Q: the shell reads an owner when something tells it the answer may have changed, not on a timer that outruns the
// kernel's caches. These are the shared answers (src/owners/ownerReading.ts, owners/readers.ts), the agency driver
// (owners/agency.ts) and the notices (owners/notices.ts), run for real over a stubbed bridge (fetch) or an injected read, with
// fake timers and a fake visibility. Channel: scripted. The hooks' wiring in the live window is UNVERIFIED on screen.
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
  if (/[.]html([?].*)?$/.test(u)) return {format: 'module', shortCircuit: true, source: 'export default ""'};
  if (!u.endsWith('.ts') && !u.endsWith('.tsx')) return n(u, c);
  return {format: 'module', shortCircuit: true, source: ts.transpileModule(await readFile(new URL(u), 'utf8'), {fileName: new URL(u).pathname,
    compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX}}).outputText};
}`)}`, import.meta.url)

const {createOwnerReadings, useOwnerReading, KEPT_UNREAD} = await import('../src/owners/ownerReading.ts')
const {createElement} = await import('react')
const {renderToStaticMarkup} = await import('react-dom/server')
const {readTaskOf, readRosterOf, readWorkcellOf, taskReadingKey, rosterReadingKey, workcellReadingKey, refreshHeld, composeRoster, TASK_OP} = await import('../src/owners/readers.ts')
const {createAgencyDriver, agencyReadingKey, readAgencyOf, AGENCY_FLOOR_MS, agencyFingerprint} = await import('../src/owners/agency.ts')
const {receiptMovesTemporal, receiptMovesAgency} = await import('../src/owners/notices.ts')

const settle = async () => { for (let i = 0; i < 6; i++) await new Promise(resolve => setImmediate(resolve)) }

/** A stubbed bridge: every POST /op is recorded; `answer(op)` is the body the bridge returns (default: refused by name). */
function bridge(url, answer) {
  const calls = []
  const original = globalThis.fetch
  globalThis.fetch = async (target, init) => {
    if (!String(target).startsWith(url)) return original(target, init)
    const op = JSON.parse(init.body)
    calls.push(op)
    return {json: async () => answer(op)}
  }
  return {calls, restore: () => { globalThis.fetch = original }}
}

const EPOCH = '3|central'

// ---- one answer per key, however many read it ---------------------------------------------------------------------

for (const family of [
  {name: 'encounter_task_read', key: t => taskReadingKey(t, 'O-I', 'session:one'), read: t => readTaskOf(t, 'O-I', 'session:one'),
    answer: {ok: true, outcome: {result: 'encounter_task_reading', data: {turns: {used: 2, cap: 9}}}}},
  {name: 'agent_definition roster', key: t => rosterReadingKey(t, null), read: t => readRosterOf(t, null),
    answer: {ok: true, outcome: {result: 'agent_definition_reading', data: {schema: 'central.agent-profile-roster/v1', profiles: []}}}},
  {name: 'workcell_status_read', key: t => workcellReadingKey(t), read: t => readWorkcellOf(t),
    answer: {ok: true, outcome: {result: 'workcell_status_reading', data: {workcell_ref: 'workcell:mac'}}}},
]) {
  test(`${family.name}: five readers are served by one owner read; they subscribe and all see the one answer`, async () => {
    const transport = {kind: 'bridge', url: `http://bridge.test/${encodeURIComponent(family.name)}`}
    const stub = bridge(transport.url, () => family.answer)
    try {
      const registry = createOwnerReadings()
      const seen = [0, 0, 0, 0, 0]
      // Five views, each asking for the answer as they mount, in the same instant.
      const entries = seen.map((_, index) => registry.entry(family.key(transport), family.read(transport)))
      const offs = entries.map((entry, index) => entry.subscribe(() => { seen[index]++ }))
      await Promise.all(entries.map(entry => entry.ensure(EPOCH)))
      assert.equal(stub.calls.length, 1, 'one owner read for five readers')
      assert.equal(new Set(entries).size, 1, 'one entry per key')
      assert.equal(entries[0].readers, 5)
      assert.equal(entries[0].snapshot().status, 'answered')
      assert.deepEqual(entries[0].snapshot().value, family.answer.outcome.data)
      assert.ok(seen.every(count => count >= 1), 'every reader was told')
      // A reader mounting later reads what stands.
      const late = registry.entry(family.key(transport), family.read(transport))
      await late.ensure(EPOCH)
      assert.equal(stub.calls.length, 1, 'a later reader reads the standing answer, never the owner')
      for (const off of offs) off()
    } finally { stub.restore() }
  })
}

test('a read in flight is shared by readers that ask while it runs; a refresh asks once more after it, never a pile (r22)', async () => {
  // r22: the Day's set was written while a ground read ran; the refresh after the write was served by that read, which began before
  // the write, so the grid kept drawing the world the set no longer held.
  const registry = createOwnerReadings()
  let asks = 0
  let owner = 'before the write'
  const releases = []
  const read = () => { asks++; const said = owner; return new Promise(resolve => { releases.push(() => resolve({value: said})) }) }
  const entry = registry.entry('k', read)
  const first = entry.ensure(EPOCH)
  const second = entry.ensure(EPOCH)
  assert.equal(first, second, 'a reader that only needs an answer is served by the read in flight')
  owner = 'after the write'
  const third = entry.refresh(EPOCH)
  const fourth = entry.retry(EPOCH)
  assert.notEqual(first, third, 'a refresh is not served by a read that began before it')
  assert.equal(third, fourth, 'one more read, however many ask while one runs')
  assert.equal(asks, 1)
  releases[0]()
  await first
  assert.equal(entry.snapshot().value, 'before the write')
  await new Promise(resolve => setTimeout(resolve, 0))
  assert.equal(asks, 2, 'the follow-up read starts once the first is done')
  releases[1]()
  await third
  assert.equal(entry.snapshot().value, 'after the write')
  assert.equal(asks, 2)
  // with nothing in flight a refresh simply reads
  owner = 'later'
  const fifth = entry.refresh(EPOCH)
  releases[2]()
  await fifth
  assert.equal(entry.snapshot().value, 'later')
  assert.equal(asks, 3)
})

// ---- a refusal is remembered for its epoch -------------------------------------------------------------------------

test('a refusal is remembered for its epoch: notices do not ask again; the person\'s Retry and a new epoch do', async () => {
  const transport = {kind: 'bridge', url: 'http://bridge.test/refused-workcell'}
  const refusal = 'workcell grants belong to workcell:mac, not workcell:local'
  const stub = bridge(transport.url, () => ({ok: false, error: refusal}))
  try {
    const registry = createOwnerReadings()
    const entry = registry.entry(workcellReadingKey(transport), readWorkcellOf(transport))
    const off = entry.subscribe(() => {})
    await entry.ensure(EPOCH)
    assert.equal(entry.snapshot().status, 'refused')
    assert.equal(entry.snapshot().error, refusal, 'the refusal stays visible in the owner\'s words')
    await entry.ensure(EPOCH)
    await entry.refresh(EPOCH)
    assert.equal(refreshHeld(registry, 'workcell_status_read'), 0, 'a notice reaches no remembered refusal')
    await settle()
    assert.equal(stub.calls.length, 1, 'the same owner is not asked the same read again in the epoch')
    await entry.retry(EPOCH)
    assert.equal(stub.calls.length, 2, 'the person asked: Retry reads again')
    await entry.ensure('4|central')
    assert.equal(stub.calls.length, 3, 'the spine\'s epoch moved: the refusal is retired and the owner asked again')
    off()
    await settle()
    // Nobody reads it now; the refusal is still remembered for its epoch.
    const again = registry.entry(workcellReadingKey(transport), readWorkcellOf(transport))
    assert.equal(again, entry, 'a refusal outlives its last reader')
    await again.ensure('4|central')
    assert.equal(stub.calls.length, 3)
  } finally { stub.restore() }
})

// MAP, the build lane's loading item (the owner's review, 19 Oct): "a pane draws its last reading at once and refreshes behind
// it". The last answer stands, carried, while the owner is asked again — when access renews in the same world, and when a reader
// comes back after the last one left. Never across worlds: the world is half the spine's key (owners/spine.ts spineEpochKey).
test('a renewed access in the same world keeps the last answer drawn, carried, while the new one is read; a moved world retires it', async () => {
  const registry = createOwnerReadings(() => 1_000)
  let n = 0
  let release
  const entry = registry.entry('k', () => { n++; return n === 1 ? Promise.resolve({value: 'first'}) : n === 2 ? new Promise(resolve => { release = () => resolve({value: 'second'}) }) : Promise.resolve({value: 'elsewhere'}) })
  await entry.ensure('1|central')
  assert.equal(entry.snapshot().value, 'first')
  assert.equal(entry.snapshot().readAtUnixMs, 1_000, 'a reading says when it was read')
  assert.equal(entry.snapshot().carried, false)
  const pending = entry.ensure('2|central')
  assert.equal(entry.snapshot().status, 'answered', 'the last answer is drawn at once')
  assert.equal(entry.snapshot().value, 'first')
  assert.equal(entry.snapshot().carried, true, 'marked as carried from before')
  assert.equal(entry.snapshot().refreshing, true, 'and read again behind it')
  assert.equal(entry.snapshot().readAtUnixMs, 1_000, 'it keeps the instant it was read')
  release()
  await pending
  assert.equal(entry.snapshot().value, 'second')
  assert.equal(entry.snapshot().epoch, '2|central')
  assert.equal(entry.snapshot().carried, false)
  const moved = entry.ensure('2|elsewhere')
  assert.equal(entry.snapshot().status, 'reading', 'another world\'s answer is never drawn')
  assert.equal(entry.snapshot().value, null)
  await moved
  assert.equal(entry.snapshot().value, 'elsewhere')
})

test('when its last reader leaves, the answer stays as the last reading: the next reader draws it at once while the owner is asked again', async () => {
  const registry = createOwnerReadings()
  let asks = 0
  let release = null
  const read = () => { asks++; return asks === 1 ? Promise.resolve({value: asks}) : new Promise(resolve => { release = () => resolve({value: asks}) }) }
  const entry = registry.entry('k', read)
  const off = entry.subscribe(() => {})
  await entry.ensure(EPOCH)
  off()
  await settle()
  const next = registry.entry('k', read)
  assert.equal(next, entry, 'the answer nobody reads stays as the last reading')
  assert.equal(next.snapshot().value, 1, 'drawn at once')
  const offNext = next.subscribe(() => {})
  const pending = next.ensure(EPOCH)
  assert.equal(asks, 2, 'the owner is asked again: nobody was told of what moved meanwhile')
  assert.equal(next.snapshot().carried, true)
  assert.equal(next.snapshot().refreshing, true)
  release()
  await pending
  assert.equal(next.snapshot().value, 2)
  assert.equal(next.snapshot().carried, false)
  // React's replay (unsubscribe, then subscribe, in one task) is not a leaving: nothing is asked again.
  offNext()
  const offB = next.subscribe(() => {})
  await settle()
  await next.ensure(EPOCH)
  assert.equal(asks, 2)
  offB()
})

test('the window keeps a bounded number of answers nobody reads, letting the longest unread go first; an unread key never answered is let go', async () => {
  const registry = createOwnerReadings()
  const read = async () => ({value: 'v'})
  for (let index = 0; index < KEPT_UNREAD + 3; index++) {
    const entry = registry.entry(`k${index}`, read)
    const off = entry.subscribe(() => {})
    await entry.ensure(EPOCH)
    off()
  }
  const never = registry.entry('never', () => new Promise(() => {}))
  never.subscribe(() => {})()
  await settle()
  const keys = registry.entries().map(entry => entry.key)
  assert.equal(keys.length, KEPT_UNREAD, 'bounded')
  assert.ok(!keys.includes('k0') && !keys.includes('k2') && keys.includes('k3') && keys.includes(`k${KEPT_UNREAD + 2}`), 'the longest unread go first')
  assert.ok(!keys.includes('never'), 'nothing to draw, nothing kept')
})

test('a reader in another world never draws an answer kept from this one, not even before its first read', async () => {
  const registry = createOwnerReadings()
  const entry = registry.entry('k', async () => ({value: 'central\'s'}))
  const off = entry.subscribe(() => {})
  await entry.ensure('1|central')
  off()
  await settle()
  const Reader = ({epoch}) => {
    const {reading} = useOwnerReading('k', async () => ({value: 'unused'}), epoch, registry)
    return createElement('p', null, `${reading.status}:${reading.value ?? '-'}`)
  }
  assert.equal(renderToStaticMarkup(createElement(Reader, {epoch: '1|elsewhere'})), '<p>reading:-</p>')
  assert.equal(renderToStaticMarkup(createElement(Reader, {epoch: '2|central'})), '<p>answered:central&#x27;s</p>', 'the same world draws its last reading')
})

test('a notice re-reads a held task record behind its standing answer, only for the session it names', async () => {
  const registry = createOwnerReadings()
  const asks = {a: 0, b: 0}
  const transport = {kind: 'bridge', url: 'http://bridge.test/notice'}
  const a = registry.entry(taskReadingKey(transport, 'O-I', 'a'), async () => { asks.a++; return {value: `a${asks.a}`} })
  const b = registry.entry(taskReadingKey(transport, 'O-I', 'b'), async () => { asks.b++; return {value: `b${asks.b}`} })
  const offs = [a.subscribe(() => {}), b.subscribe(() => {})]
  await a.ensure(EPOCH); await b.ensure(EPOCH)
  assert.equal(refreshHeld(registry, TASK_OP, {agentSession: 'a'}), 1)
  assert.equal(a.snapshot().value, 'a1', 'the standing answer stays shown while the re-read runs')
  assert.equal(a.snapshot().refreshing, true)
  await settle()
  assert.deepEqual(asks, {a: 2, b: 1})
  assert.equal(a.snapshot().value, 'a2')
  // The window regained: only answers older than the minimum age are read again.
  assert.equal(refreshHeld(registry, TASK_OP, {minAgeMs: 60_000, at: Date.now()}), 0, 'both were just read')
  for (const off of offs) off()
})

test('the roster composes root and project exactly as readRoster did, and a refusal is the reading\'s error', () => {
  const profile = (ref, name, accepted = true) => ({profile: {agent_ref: ref, ref: `profile:${ref}`, name}, accepted})
  const answered = (profiles, readAtUnixMs = 5) => ({status: 'answered', value: {schema: 'central.agent-profile-roster/v1', profiles}, error: null, readAtUnixMs, epoch: EPOCH, refreshing: false})
  const root = answered([profile('agent/a', 'Ada'), profile('agent/b', 'Bea')], 7)
  const own = answered([profile('agent/b', 'Bea (O-I)'), profile('agent/c', 'Cy')], 9)
  const composed = composeRoster(root, own, () => {})
  assert.equal(composed.state, 'ready')
  assert.deepEqual(composed.agents.map(agent => agent.ref), ['agent/b', 'agent/c', 'agent/a'], 'the project\'s own first, then the root\'s not already named')
  assert.equal(composed.readAtUnixMs, 7, 'the older of the two answers dates the reading')
  const refused = composeRoster({status: 'refused', value: null, error: 'Central refused the roster', readAtUnixMs: 3, epoch: EPOCH, refreshing: false}, own, () => {})
  assert.equal(refused.state, 'error')
  assert.equal(refused.error, 'Central refused the roster')
})

// ---- the agency driver: told, a floor while seen, nothing while hidden ----------------------------------------------

function agencyHarness(t) {
  t.mock.timers.enable({apis: ['setTimeout', 'Date'], now: 1_000_000})
  const registry = createOwnerReadings()
  let reads = 0
  let rows = [{spaceRef: 'space:1', sessionRef: 'session:1', raw: {}}]
  let hold = null
  const entry = registry.entry('agency', () => {
    reads++
    const answer = {value: {projectRef: 'project:o-i', rows: [...rows]}}
    if (hold) return new Promise(resolve => { const go = hold; hold = null; go(() => resolve(answer)) })
    return Promise.resolve(answer)
  })
  const off = entry.subscribe(() => {})
  let visible = true
  const attention = new Set()
  const told = new Set()
  const settled = []
  const driver = createAgencyDriver(entry, {
    epoch: EPOCH,
    visible: () => visible,
    onAttention: listener => { attention.add(listener); return () => attention.delete(listener) },
    onTold: listener => { told.add(listener); return () => told.delete(listener) },
    onRead: (_reading, cause) => settled.push(cause),
  })
  return {
    entry, driver, settled,
    get reads() { return reads },
    setRows: next => { rows = next },
    setVisible: next => { visible = next },
    regain: () => { for (const listener of attention) listener() },
    tell: cause => { for (const listener of told) listener(cause) },
    holdNext: () => new Promise(resolve => { hold = resolve }),
    stop: () => { driver.stop(); off() },
  }
}

test('agency is read on mount, then at a slow floor (>= 15 s) while the window is seen — not every 3 s', async (t) => {
  const h = agencyHarness(t)
  await settle()
  assert.equal(h.reads, 1, 'read on mount')
  assert.ok(AGENCY_FLOOR_MS >= 15_000, 'the floor is slow and honest')
  t.mock.timers.tick(3_000)
  await settle()
  assert.equal(h.reads, 1, 'no 3 s cadence')
  t.mock.timers.tick(AGENCY_FLOOR_MS - 3_000)
  await settle()
  assert.equal(h.reads, 2, 'the floor reads once while the window is seen')
  t.mock.timers.tick(AGENCY_FLOOR_MS)
  await settle()
  assert.equal(h.reads, 3)
  assert.deepEqual(h.settled, ['mount', 'floor', 'floor'])
  h.stop()
})

test('agency is never read while the window is hidden; coming back to it reads at once', async (t) => {
  const h = agencyHarness(t)
  await settle()
  h.setVisible(false)
  t.mock.timers.tick(AGENCY_FLOOR_MS * 10)
  await settle()
  assert.equal(h.reads, 1, 'hidden for five minutes: no read')
  h.setVisible(true)
  h.regain()
  await settle()
  assert.equal(h.reads, 2, 'the window regained is a notice')
  assert.equal(h.settled.at(-1), 'window regained')
  // The floor counts from that read.
  t.mock.timers.tick(AGENCY_FLOOR_MS)
  await settle()
  assert.equal(h.reads, 3)
  h.stop()
})

test('agency is read after the shell\'s own act and on a receipt that can move it; a notice during a read asks once more after it', async (t) => {
  const h = agencyHarness(t)
  await settle()
  h.tell('a harness control: stop')
  await settle()
  assert.equal(h.reads, 2, 'an act\'s receipt reads at once')
  // The kernel's receipts: the first observation is taken as already read; a later one that can move agency reads.
  h.driver.observe([{seq: 1, schema: 'oi.kernel-event/v1', version: 1, event: 'focus_changed'}])
  h.driver.observe([{seq: 1, schema: 'oi.kernel-event/v1', version: 1, event: 'focus_changed'}, {seq: 2, schema: 'oi.kernel-event/v1', version: 1, event: 'surface_changed'}])
  await settle()
  assert.equal(h.reads, 2, 'a receipt that cannot move agency asks nothing')
  h.driver.observe([{seq: 3, schema: 'oi.kernel-event/v1', version: 1, event: 'working_surface_driving', agent_session: 'session:1'}])
  await settle()
  assert.equal(h.reads, 3, 'a working surface driving a session reads')
  h.driver.observe([{seq: 3, schema: 'oi.kernel-event/v1', version: 1, event: 'working_surface_driving', agent_session: 'session:1'}])
  await settle()
  assert.equal(h.reads, 3, 'the same receipt passed again is taken once')
  // A notice while a read is in flight: one more read after it, never a pile.
  const gate = h.holdNext()
  h.tell('a conversation turn was sent')
  await settle()
  assert.equal(h.reads, 4)
  h.tell('a conversation turn was stopped')
  h.tell('a second act')
  await settle()
  assert.equal(h.reads, 4, 'nothing doubled while the read runs')
  ;(await gate)()
  await settle()
  assert.equal(h.reads, 5, 'one read follows the read in flight')
  h.stop()
})

test('the agency fingerprint moves only when the sessions move', () => {
  const reading = rows => ({projectRef: 'p', rows})
  const a = agencyFingerprint(reading([{spaceRef: 's', sessionRef: 'x', raw: {big: 1}}]))
  assert.equal(a, agencyFingerprint(reading([{spaceRef: 's', sessionRef: 'x', raw: {big: 2}}])), 'payload noise is not a move')
  assert.notEqual(a, agencyFingerprint(reading([{spaceRef: 's', sessionRef: 'x', raw: {}}, {spaceRef: 's', sessionRef: 'y', raw: {}}])))
})

test('the agency read is the op the provider always read, through the shared answer', async () => {
  const transport = {kind: 'bridge', url: 'http://bridge.test/agency'}
  const stub = bridge(transport.url, () => ({ok: true, outcome: {result: 'agency_reading', project_ref: 'project:o-i', observed_at_unix_ms: 1,
    spaces: [{definition: {id: 'space:1'}, label: 'One', agent_sessions: {'session:1': {purpose: 'p'}}}]}}))
  try {
    const registry = createOwnerReadings()
    const entry = registry.entry(agencyReadingKey(transport, 'O-I'), readAgencyOf(transport, 'O-I'))
    await entry.ensure(EPOCH)
    assert.deepEqual(stub.calls, [{op: 'agency_read', project: 'O-I'}])
    assert.deepEqual(entry.snapshot().value.rows.map(row => row.sessionRef), ['session:1'])
  } finally { stub.restore() }
})

// ---- which receipts are notices ------------------------------------------------------------------------------------

test('a receipt moves the temporal field only when it can: an instant-bearing kernel event, a routine, a write under a ground it reads', () => {
  const r = (event, extra = {}) => ({seq: 1, schema: 'oi.kernel-event/v1', version: 1, event, ...extra})
  assert.equal(receiptMovesTemporal(r('working_surface_driving')), true)
  assert.equal(receiptMovesTemporal(r('routine_action_returned')), true)
  assert.equal(receiptMovesTemporal(r('file_changed', {path: 'Control/agents/now/clearings/abc/T/x.json'})), true)
  assert.equal(receiptMovesTemporal(r('file_changed', {path: 'Work/O-I/ProjectCentral/agents/now/clearings/abc/now.json'})), true)
  assert.equal(receiptMovesTemporal(r('file_changed', {path: 'Control/agents/wiki/returns/r.json'})), true)
  assert.equal(receiptMovesTemporal(r('file_changed', {path: 'Control/user/civil-time-policy.json'})), true)
  assert.equal(receiptMovesTemporal(r('source_changed', {source: {ref: 'central:source:control:root:Control/agents/now/clearings/abc/now.json'}})), true)
  assert.equal(receiptMovesTemporal(r('file_changed', {path: 'Work/O-I/docs/notes.md'})), false, 'a write the field does not read')
  for (const event of ['focus_changed', 'surface_changed', 'world_changed', 'expression_changed', 'buffer_dirty', 'source_opened', 'presentation_changed']) {
    assert.equal(receiptMovesTemporal(r(event)), false, `${event} carries no instant the field reads`)
  }
  assert.equal(receiptMovesAgency(r('working_surface_driving')), true)
  assert.equal(receiptMovesAgency(r('file_changed', {path: 'Control/agents/now/x'})), false)
})

// ---- the Day's standing: an answer is re-read on return, a refusal is remembered ------------------------------------

const {readDayOf, dayStandingKey} = await import('../src/owners/day.ts')

test('Central open-day: a refused Day (the stale-today pointer) is remembered for its epoch; an uninitialised Day is an answer', async () => {
  const transport = {kind: 'bridge', url: 'http://bridge.test/open-day'}
  let answer = {ok: false, error: 'the today pointer is stale: day 2026-10-13 was never closed'}
  const stub = bridge(transport.url, () => answer)
  try {
    const registry = createOwnerReadings()
    const today = registry.entry(dayStandingKey(transport, null), readDayOf(transport, null))
    const off = today.subscribe(() => {})
    await today.ensure(EPOCH)
    assert.equal(today.snapshot().status, 'refused')
    assert.match(today.snapshot().error, /today pointer is stale/)
    await today.refresh(EPOCH)
    await today.ensure(EPOCH)
    assert.equal(stub.calls.length, 1, 'the window regained and every reader mounting ask nothing more in the epoch')
    assert.deepEqual(stub.calls[0], {op: 'central', project: null, request: {kind: 'open-day'}}, 'the owner\'s own open-day read, unchanged')
    answer = {ok: false, error: 'Day central:day:2026-10-15 has no native document yet'}
    await today.retry(EPOCH)
    assert.equal(today.snapshot().status, 'answered', 'no native document yet is the owner\'s answer about the Day, not a refusal')
    assert.equal(today.snapshot().value.state, 'uninitialised')
    off()
  } finally { stub.restore() }
})

// ---- the encounter loop and the acts that tell: pinned on source (cradle; its loop needs a DOM) ---------------------

test('the encounter loop reads fast only while a run is live and seen; at rest it is read on its receipts and a slow floor', async () => {
  const {readFile} = await import('node:fs/promises')
  const session = await readFile(new URL('../../../../desktop/cradle/src/encounter/session.ts', import.meta.url), 'utf8')
  const rest = Number(session.match(/export const ENCOUNTER_REST_MS=(\d+);/)?.[1])
  assert.ok(rest >= 15_000, 'a session at rest is read at most every 15 s')
  assert.match(session, /inFlight\?300:this\.quietReads===0\?750:this\.quietReads===1\?1500:ENCOUNTER_REST_MS/, 'live turns stream; a settled session rests')
  assert.match(session, /if\(hidden\(\)\)return;/, 'hidden: no read and no timer; becoming visible restarts the chain')
  assert.doesNotMatch(session, /setTimeout\(\(\)=>void this\.poll\(chain\),1000\)/, 'the 1 s hidden wake-up is gone')
  assert.match(session, /window\.addEventListener\("focus",this\.onVisible\)/, 'the window regained wakes it')
  for (const act of ['a conversation turn was sent', 'a conversation was connected', 'a conversation was reconnected', 'a conversation turn was stopped', 'a permission was decided']) {
    assert.ok(session.includes(`this.wake("${act}")`), `the act "${act}" wakes the session on its receipt`)
  }
  const {OWNER_CHANGED_EVENT} = await import('../src/owners/notices.ts')
  assert.ok(session.includes(`new CustomEvent("${OWNER_CHANGED_EVENT}"`), 'the cradle tells the shell by the notices\' own event name')
  const control = await readFile(new URL('../src/agent/harnessAgentControl.ts', import.meta.url), 'utf8')
  assert.match(control, /tellOwnerChanged\(\{topic: 'agency'/, 'a harness control tells the agency readers on its receipt')
})

test('one agency source: the provider drives it, every other reader subscribes; no 3 s cadence remains', async () => {
  const {readFile} = await import('node:fs/promises')
  const provider = await readFile(new URL('../src/agent/AgentSessionsProvider.tsx', import.meta.url), 'utf8')
  const legacy = await readFile(new URL('../src/agent/useAgencySessions.ts', import.meta.url), 'utf8')
  assert.match(provider, /createAgencyDriver\(entry, \{/, 'the provider drives the agency answer')
  for (const [name, source] of [['AgentSessionsProvider.tsx', provider], ['useAgencySessions.ts', legacy]]) {
    assert.doesNotMatch(source, /setInterval|POLL_MS|readAgency\(/, `${name} keeps no cadence and asks the owner nothing itself`)
  }
  for (const file of ['../src/agent/devices/useAgentChainReading.ts', '../src/agent/AgentShellBrowser.tsx', '../src/agent/AgentDockTileBody.tsx', '../src/central/devices/useCentralReadings.ts']) {
    const source = await readFile(new URL(file, import.meta.url), 'utf8')
    assert.doesNotMatch(source, /op: 'encounter_task_read'|op: 'agent_definition'|op: 'workcell_status_read'/, `${file} reads the shared answers, never the op itself`)
  }
})

test('a transient bridge failure of the roster is asked again inside the one read; a named refusal is final (the provider\'s old rule)', async () => {
  const transport = {kind: 'bridge', url: 'http://bridge.test/roster-retry'}
  let failures = 2
  const stub = bridge(transport.url, () => failures-- > 0 ? {ok: false, error: 'TypeError: Failed to fetch'} : {ok: true, outcome: {result: 'agent_definition_reading', data: {schema: 'central.agent-profile-roster/v1', profiles: []}}})
  try {
    const answered = await readRosterOf(transport, null, 1)()
    assert.deepEqual(answered, {value: {schema: 'central.agent-profile-roster/v1', profiles: []}})
    assert.equal(stub.calls.length, 3, 'two transient failures, then the answer — one read for its readers')
  } finally { stub.restore() }
  const refusing = bridge('http://bridge.test/roster-refused', () => ({ok: false, error: 'Central refused the roster: no profiles register'}))
  try {
    const refused = await readRosterOf({kind: 'bridge', url: 'http://bridge.test/roster-refused'}, null, 1)()
    assert.deepEqual(refused, {error: 'Central refused the roster: no profiles register'})
    assert.equal(refusing.calls.length, 1, 'an owner refusal is not asked again')
  } finally { refusing.restore() }
})
