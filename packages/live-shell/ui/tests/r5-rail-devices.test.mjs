import test from 'node:test'
import assert from 'node:assert/strict'

// R5, the rail (T-REALIGN §3; DLW §23): the devices born on the rail read their owners and hand each design only what the owner
// reported. The mappings are pure (src/widgets/railBindings.ts); the publisher (railDevices.tsx) reads and publishes them.
const rail = await import('../src/widgets/railBindings.ts')

test('the Trail hands the book\'s stops oldest first, each keyed by its place on the trail, with its time where the book stamped one, and the stop you stand on', () => {
  // One place can stand at several stops (the same document in Central, then Technē): the design keys a stop by its ref, so the
  // binding keys each by its place on the trail, and `here` is the stop the book stands on (#764), not a ref several stops share.
  const stops = [
    {mode: 'base', surfaceKind: 'day', surfaceRef: 'day:2026-10-17', label: 'Saturday 17 Oct', at: 1792200000000},
    {mode: 'factory', surfaceKind: 'session', surfaceRef: 'session:fizz', label: 'Fizz', position: 'turn 3'},
    {mode: 'techne', surfaceKind: 'day', surfaceRef: 'day:2026-10-17', label: 'Saturday 17 Oct', at: 1792200060000},
  ]
  const values = rail.trailValues(stops, 1)
  assert.deepEqual(JSON.parse(values.stops), [
    {mode: 'base', surfaceKind: 'day', surfaceRef: '0', label: 'Saturday 17 Oct', at: 1792200000000},
    {mode: 'factory', surfaceKind: 'session', surfaceRef: '1', label: 'Fizz', position: 'turn 3'},
    {mode: 'techne', surfaceKind: 'day', surfaceRef: '2', label: 'Saturday 17 Oct', at: 1792200060000},
  ])
  assert.equal(values.here, '1')
  assert.equal(rail.trailValues([], null).here, undefined, 'standing nowhere leaves `here` absent')
  assert.equal(rail.trailIndexOf('2'), 2, 'a stop pressed on the design names its place on the trail')
  for (const ref of [undefined, '', 'day:2026-10-17', '-1', '1.5']) assert.equal(rail.trailIndexOf(ref), null, `${ref} names no stop`)
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

// O-I #749 (§23.2: "Press a file to open it in Full … the tree stands beside the file you opened"): the walk found Full's file empty — no
// owner read the opened file. Its text is Central's file reading of the same file (the files seam: the folder listed, its entry read),
// placed in Central's ground from the seat's root; a file outside the ground, or one Central does not let be read, says why.
test('Files opens the file you press: its path in the seat, placed in Central\'s ground, its parent and its name; outside the ground, said', () => {
  assert.equal(rail.openFileOf('src/a.ts', '/ground/Work/O-I'), '/ground/Work/O-I/src/a.ts', 'a path the tree holds relative to the seat\'s root')
  assert.equal(rail.openFileOf('/ground/Work/O-I/b.ts', null), '/ground/Work/O-I/b.ts', 'a path the tape named whole')
  assert.equal(rail.openFileOf('src/a.ts', null), null, 'relative, with no root read yet: nothing to open')
  assert.equal(rail.openFileOf(undefined, '/ground'), null)
  assert.deepEqual(rail.groundPlaceOf('/ground/Work/O-I/src/a.ts', '/ground'), {relative: 'Work/O-I/src/a.ts', parent: 'Work/O-I/src', name: 'a.ts'})
  assert.deepEqual(rail.groundPlaceOf('/ground/top.md', '/ground/'), {relative: 'top.md', parent: '', name: 'top.md'})
  assert.match(rail.groundPlaceOf('/elsewhere/a.ts', '/ground').words, /^\/elsewhere\/a\.ts stands outside Central's ground \(\/ground\)/)
  assert.match(rail.groundPlaceOf('/groundless/a.ts', '/ground').words, /outside Central's ground/, 'a sibling whose name starts the same is outside')
})

// O-I #749 (§23.2, §23.3 Follow: "Keeps the tree on the selected agent"; Off keeps the one it had): Follow was a hold nothing read.
test('Files and Web follow the selected agent, or keep the one they had when Follow is off; a kept agent that left is said', () => {
  const tracks = [{sessionRef: 's1', agentName: 'Fizz', purpose: 'lead', project: ''}, {sessionRef: 's2', agentName: 'Flint', purpose: null, project: 'O-I'}]
  assert.equal(rail.keptTrackOf(tracks, null, tracks[1]).track, tracks[1], 'Follow on: the selected agent')
  assert.equal(rail.keptTrackOf(tracks, 's1', tracks[1]).track, tracks[0], 'Follow off: the agent it kept')
  const gone = rail.keptTrackOf(tracks, 's9', tracks[1])
  assert.equal(gone.track, null)
  assert.match(gone.words, /The agent Follow kept \(s9\) no longer stands in the agency reading/)
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
