import test from 'node:test'
import assert from 'node:assert/strict'

// R5, the rail (T-REALIGN §3; DLW §23): the devices born on the rail read their owners and hand each design only what the owner
// reported. The mappings are pure (src/widgets/railBindings.ts); the publisher (railDevices.tsx) reads and publishes them.
const rail = await import('../src/widgets/railBindings.ts')

test('the Trail hands the book\'s stops oldest first, with their time where the book stamped one, and where you stand', () => {
  const stops = [
    {mode: 'base', surfaceKind: 'day', surfaceRef: 'day:2026-10-17', label: 'Saturday 17 Oct', at: 1792200000000},
    {mode: 'factory', surfaceKind: 'session', surfaceRef: 'session:fizz', label: 'Fizz', position: 'turn 3'},
  ]
  const values = rail.trailValues(stops, 'session:fizz')
  assert.deepEqual(JSON.parse(values.stops), [
    {mode: 'base', surfaceKind: 'day', surfaceRef: 'day:2026-10-17', label: 'Saturday 17 Oct', at: 1792200000000},
    {mode: 'factory', surfaceKind: 'session', surfaceRef: 'session:fizz', label: 'Fizz', position: 'turn 3'},
  ])
  assert.equal(values.here, 'session:fizz')
  assert.equal(rail.trailValues([], null).here, undefined, 'standing nowhere leaves `here` absent')
})

test('the Diff reads Central\'s central.git-diff/v1 by its own fields, a count it did not make left out', () => {
  const reading = {schema: 'central.git-diff/v1', repo_root: '/r', head_sha: 'abc1234def', from: 'HEAD', to: 'working-tree', ignore_whitespace: false,
    files: [{status: 'M', old_path: 'a.ts', new_path: 'a.ts', adds: 3, dels: 1, binary: false, patch: '@@ -1 +1 @@\n-x\n+y', truncated: false},
      {status: 'A', old_path: null, new_path: 'b.png', adds: null, dels: null, binary: true, patch: '', truncated: false}],
    omitted_files: 0, truncated: false, observation: 'x'}
  const read = rail.diffFilesOf(reading)
  assert.deepEqual(read.files, [{path: 'a.ts', status: 'M', adds: 3, dels: 1, patch: '@@ -1 +1 @@\n-x\n+y'}, {path: 'b.png', status: 'A', patch: ''}])
  assert.equal(read.head, 'abc1234def')
  assert.equal(rail.diffFilesOf({schema: 'something-else', files: []}), null, 'another schema is not read as a diff')
})

test('the NOWs read the ground once: civil date and time, the policy\'s timezone, the Day\'s lifecycle, the clearings not archived', () => {
  const ground = {schema: 'oi.central-ground/v1', project: null,
    time: {state: 'ready', action: 'central.time.policy', data: {schema: 'central.civil-time-reading/v1', civil_date: '2026-10-18', local_time: '02:30:00', revision: 'r', source_ref: 's',
      policy: {timezone: 'Europe/London', day_boundary_minutes: 0, automatic_day_rollover: false}}},
    day: {state: 'ready', action: 'central.day.read', data: {temporal: {day_ref: 'd', civil_date: '2026-10-13', lifecycle: 'open'}}},
    now: {state: 'ready', action: 'central.now.list', data: {schema: 'central.now-listing/v1', automatic_agent_or_model_invocation: false, records: [
      {now_ref: 'n1', purpose: 'Build', lifecycle: 'active', participant_refs: ['agent:a'], created_at_unix_seconds: 1, source_ref: '', scope_ref: '', task_ref: '', source_refs: [], revision: ''},
      {now_ref: 'n2', purpose: 'Old', lifecycle: 'archived', participant_refs: [], created_at_unix_seconds: 2, source_ref: '', scope_ref: '', task_ref: '', source_refs: [], revision: ''}]}},
    sources: {state: 'unavailable', action: 'x'}}
  const values = rail.nowsValues(ground)
  assert.equal(values.day, '2026-10-18')
  assert.equal(values.time, '2026-10-18T02:30:00')
  assert.equal(values.timezone, 'Europe/London')
  assert.equal(values.dayState, 'open')
  assert.deepEqual(JSON.parse(values.nows).map(row => row.now_ref), ['n1'], 'an archived clearing is closed and does not show')
  assert.equal(values.reason, undefined)
  const refused = rail.nowsValues({...ground, time: {state: 'failed', action: 'central.time.policy', error: {message: 'The ground did not answer'}}, now: {state: 'failed', action: 'central.now.list'}})
  assert.equal(refused.reason, 'The ground did not answer')
  assert.equal(refused.day, undefined)
})

const row = (verb, object, extra = {}) => ({id: `c${object}`, turn: 1, verb, object, count: 1, status: 'done', cursors: [1], calls: [], events: [], ...extra})

test('Files keeps each path the agent read or edited once, an edit over a read, with the seat\'s counts for an edit', () => {
  const rows = [row('read', 'a.ts', {detail: '/seat/a.ts'}), row('edit', 'a.ts', {detail: '/seat/a.ts'}), row('read', 'b.ts', {detail: '/seat/b.ts'}),
    row('run', 'npm test'), row('read', 'https://example.org', {calls: [{name: 'web_fetch', error: false, status: 'done', firstCursor: 1, lastCursor: 1}]})]
  const files = rail.filesOf(rows, [{path: 'a.ts', status: 'M', adds: 4, dels: 2}], '/seat')
  assert.deepEqual(files, [{path: 'a.ts', verb: 'edit', adds: 4, dels: 2}, {path: 'b.ts', verb: 'read'}])
})

test('Web lists the pages the agent fetched, newest first, with the text it got and no passages it did not report', () => {
  const fetchCall = output => ({name: 'web_fetch', output, error: false, status: 'done', firstCursor: 1, lastCursor: 1})
  const rows = [row('read', 'Old page', {detail: 'https://a.example', calls: [fetchCall('one\ntwo')]}),
    row('read', 'local.ts', {detail: '/seat/local.ts'}),
    row('read', 'New page', {detail: 'https://b.example', calls: [fetchCall({content: [{type: 'text', text: 'hello'}]})]})]
  const pages = rail.pagesOf(rows)
  assert.deepEqual(pages.map(page => page.url), ['https://b.example', 'https://a.example'])
  assert.deepEqual(pages[0].lines, ['hello'])
  assert.deepEqual(pages[1].lines, ['one', 'two'])
  assert.equal('used' in pages[0], false)
  assert.deepEqual(rail.outputLines({unknown: true}), [], 'an output with no text says nothing, never a dump')
})

test('the Wiki hands each node\'s ref, title and type in the wiki\'s order; the Calendar names its absent owner; the NOWs\' Close writes', async () => {
  assert.deepEqual(rail.wikiPagesOf([{object: 'node', ref: 'wiki:node:a', title: 'A', type: 'intent'}, {object: 'node', ref: 'wiki:node:b'}]),
    [{ref: 'wiki:node:a', title: 'A', type: 'intent'}, {ref: 'wiki:node:b'}])
  assert.match(rail.CALENDAR_ABSENT, /No calendar provider is installed/)
  // REPLACED (W2): Close is Central's central.now.lifecycle (railBindings.ts nowsCloseWrites; the chain through the kernel is
  // tests/w2-hookups-binding.test.mjs). Here, the close it hands is given the listing's rows and the policy's reading as the ground read them.
  const calls = []
  const ground = {now: {state: 'ready', data: {records: [{now_ref: 'n1'}]}}, placement: {state: 'ready', data: {revision: 'p1'}}}
  await rail.nowsCloseWrites({kind: 'bridge', url: 'x'}, ground, async (...args) => { calls.push(args) }).write([{key: 'close', value: 'n1'}])
  assert.deepEqual(calls, [[{kind: 'bridge', url: 'x'}, 'n1', [{now_ref: 'n1'}], {revision: 'p1'}]])
})
