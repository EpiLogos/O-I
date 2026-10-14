// Central's documents open as panes (DLW §5; the mockup's `modes.base`: the Day on the left, a Flow on the right; manual
// §10.2 panes, §10.3 "To preview something, select it once. To open it, double-click it or drag it into a pane").
// Channels: SCRIPTED — the layout operations (open, seed) over the cradle's own pane engine; the subject grammar; the owner
// readings against a FAKE OWNER (a stubbed kernel bridge that answers `central` open-day and `files_list` as the owner's wire
// does, and records what was asked); the pane's drawn states (SSR over the production components); the browser rows' open
// gesture and the open route for plain files (a fake workspace, the sequence the world browser's `selectFile` runs).
// CODE-READING — the rows' handlers in shell/ModeBrowser.tsx. NOT a screen pass: every UI leg (the hosted forms drawn at pane
// size, the rows' double-click, the focus of the seeded tree) is owed the lead's computer-use pass.
// Loader as central-devices-chain.test.mjs (it also resolves the document forms' `?raw`/.json imports, and gives the cradle's
// hooks and the shell's renderer one React, as the app's bundler does).
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {register} from 'node:module'
import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'

const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};
import {readFile} from 'node:fs/promises';
export async function resolve(s, c, n) {
  if (s === 'react' || s.startsWith('react/')) return n(s, {...c, parentURL: ${JSON.stringify(import.meta.url)}})
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

const docs = await import('../src/central/documents/centralDocuments.ts')
const readings = await import('../src/central/documents/documentReadings.ts')
const pane = await import('../src/central/documents/CentralDocumentPane.tsx')
const opening = await import('../src/central/documents/useOpenCentralDocument.ts')
const vertical = await import('../src/central/centralVertical.ts')
const {groupsOf} = await import('../../../../desktop/cradle/src/surface/engine.ts')
const modules = await import('../../../../desktop/cradle/src/surface/projectionModules.ts')

const html = element => renderToStaticMarkup(element)
const KIND = 'projection.central-document'
const group = (id, tabs) => ({type: 'group', id, tabs, pinned: [], active: tabs[0] ?? null})
const empty = () => ({root: group('g1', []), surfaces: {}, closedStack: [], focusedGroupId: 'g1', agencyDepth: 'panel', rightDepth: 'collapsed', leftWidth: 260, rightWidth: 320})
/** The tree as `[[kind:subject…], …]`, one list per pane, in reading order. */
const tree = layout => groupsOf(layout.root).map(g => g.tabs.map(id => `${layout.surfaces[id].kind}:${layout.surfaces[id].projection?.subject_ref ?? ''}`))
const location = (path, root = '/ground') => ({schema: 'central.path-ref/v1', ref: `central:path:${root}:${path}`, root, path})
const FLOW = location('Control/user/flows/flow-2026-10-14-2050.html')
const entry = (path, extra = {}) => ({name: path.split('/').pop(), location: location(path), kind: 'file', byte_len: 10, retrieval_allowed: true, ...extra})

// ── the subject grammar ──────────────────────────────────────────────────

test('a pane\'s subject names a Day or a Flow, and a ref that names neither is no document', () => {
  assert.deepEqual(docs.parseDocumentSubject(undefined), {form: 'flow', location: null}, 'a pane with no subject holds the most recent Flow')
  assert.deepEqual(docs.parseDocumentSubject(docs.LATEST_FLOW_REF), {form: 'flow', location: null})
  assert.deepEqual(docs.parseDocumentSubject(docs.TODAY_REF), {form: 'day', dayRef: null}, 'today is the owner\'s current Day, asked for with no day ref')
  assert.deepEqual(docs.parseDocumentSubject(docs.dayRefOfDate('2026-10-08')), {form: 'day', dayRef: 'central:day:control:root:2026-10-08'})
  assert.deepEqual(docs.parseDocumentSubject(FLOW.ref), {form: 'flow', location: FLOW}, 'a Flow by the owner\'s own path ref')
  assert.equal(docs.parseDocumentSubject(location('Work/O-I/notes.md').ref), null, 'a note is not a document this pane holds')
  assert.equal(docs.parseDocumentSubject(location('Work/x/Control/user/flowsish/a.html').ref), null)
  assert.equal(docs.parseDocumentSubject('wiki:node:stone'), null)
})

test('a Days row opens its Day, a Flow instance in the Files rows opens its Flow, and every other file is a plain file', () => {
  const day = entry('Control/agents/now/day/2026-10-08.md')
  assert.deepEqual(docs.dayOfEntry(day), {form: 'day', date: '2026-10-08'})
  assert.deepEqual(docs.dayOfEntry({...day, location: undefined, name: '2026-10-08.md'}, 'Control/agents/now/day/2026-10-08.md'), {form: 'day', date: '2026-10-08'}, 'a path the row carries when its location lacks one')
  assert.equal(docs.dayOfEntry(entry('Control/user/intent.md')), null, 'a note is no day record')
  assert.equal(docs.dayOfEntry(entry('Control/agents/now/day/2026-10-08.md', {kind: 'directory'})), null, 'a folder is no document')
  assert.equal(docs.flowOfEntry(day), null, 'in the Files rows a day record is a file like any other: it opens as itself; the Days rows open the Day')
  assert.deepEqual(docs.flowOfEntry(entry(FLOW.path)), {form: 'flow', location: entry(FLOW.path).location})
  assert.equal(docs.flowOfEntry(entry('Control/user/intent.md')), null, 'a note opens through the Workbench\'s file route')
  assert.equal(docs.flowOfEntry(entry('Control/user/flows/notes.md')), null, 'a Flow is an html instance')
  assert.equal(docs.flowOfEntry(entry('Work/O-I/docs/flow-2026-10-14-2050.html')), null, 'a Flow-shaped name outside the flows folder is a file')
  assert.equal(docs.flowOfEntry(entry(FLOW.path, {kind: 'directory'})), null)
  assert.equal(docs.dayDateOfPath('Control/agents/now/day/2026-10-08.md'), '2026-10-08')
  assert.equal(docs.dayDateOfPath('Control/user/day/2026-09-25/day.md'), null)
  assert.deepEqual(docs.subjectOf({form: 'day', date: '2026-10-08'}), {ref: 'central:day:control:root:2026-10-08', title: 'Day · 2026-10-08'})
  assert.deepEqual(docs.subjectOf({form: 'day', date: null}), {ref: docs.TODAY_REF, title: 'Day'})
  assert.deepEqual(docs.subjectOf({form: 'flow', location: FLOW}), {ref: FLOW.ref, title: 'Flow · flow-2026-10-14-2050'})
  assert.deepEqual(docs.subjectOf({form: 'flow', location: null}), {ref: docs.LATEST_FLOW_REF, title: 'Flow'})
})

// ── opening: the focused pane, one document one pane ─────────────────────

test('a document opens in the focused pane; opening it again is the same pane, not a second', () => {
  const once = docs.openCentralDocumentAt(empty(), {form: 'day', date: '2026-10-08'})
  assert.deepEqual(tree(once), [[`${KIND}:central:day:control:root:2026-10-08`]])
  assert.equal(Object.values(once.surfaces)[0].title, 'Day · 2026-10-08')
  const twice = docs.openCentralDocumentAt(once, {form: 'day', date: '2026-10-08'})
  assert.equal(Object.keys(twice.surfaces).length, 1)
  const other = docs.openCentralDocumentAt(once, {form: 'flow', location: FLOW})
  assert.deepEqual(tree(other), [[`${KIND}:central:day:control:root:2026-10-08`, `${KIND}:${FLOW.ref}`]], 'a second document opens as a tab beside the first, in the focused pane')
})

test('a document opens where it is asked for: beside a pane, or moved into one — and is never in two panes', () => {
  const day = docs.openCentralDocumentAt(empty(), {form: 'day', date: null})
  const beside = docs.openCentralDocumentAt(day, {form: 'flow', location: FLOW}, {groupId: 'g1', edge: 'right'})
  assert.deepEqual(tree(beside), [[`${KIND}:${docs.TODAY_REF}`], [`${KIND}:${FLOW.ref}`]])
  const [, right] = groupsOf(beside.root)
  const moved = docs.openCentralDocumentAt(beside, {form: 'day', date: null}, {groupId: right.id, edge: null})
  assert.equal(groupsOf(moved.root).length, 1, 'the emptied pane closes; one document is never in two panes')
  assert.equal(Object.keys(moved.surfaces).length, 2)
})

// ── Central's first tree ─────────────────────────────────────────────────

test('Central\'s first tree is the Day on the left and the most recent Flow on the right, with the focus on the Day', () => {
  const seeded = docs.seedCentralDocuments(empty())
  assert.deepEqual(tree(seeded), [[`${KIND}:${docs.TODAY_REF}`], [`${KIND}:${docs.LATEST_FLOW_REF}`]], 'the mockup\'s `[doc day] | [doc flow]`')
  const [left] = groupsOf(seeded.root)
  assert.equal(seeded.focusedGroupId, left.id, 'the mockup\'s `focus: 0`')
  assert.equal(seeded.surfaces[left.active].title, 'Day')
  assert.equal(seeded.surfaces[left.active].projection.subject_ref, docs.TODAY_REF, 'the Day is the owner\'s current Day, resolved by the pane')
  assert.equal(docs.seedCentralDocuments(seeded), seeded, 'a seed never touches a tree that already holds a tab')
})

test('the seed keeps the panes Central\'s first tree held before: they open as tabs behind the Flow, which stays in front', () => {
  const seeded = docs.seedCentralDocuments(empty(), {alongside: ['projection.timeline']})
  assert.deepEqual(tree(seeded), [[`${KIND}:${docs.TODAY_REF}`], [`${KIND}:${docs.LATEST_FLOW_REF}`, 'projection.timeline:']])
  const [, right] = groupsOf(seeded.root)
  assert.equal(seeded.surfaces[right.active].kind, KIND, 'the Flow is the front tab of the right pane')
})

test('the right pane opens the selected subject when the browser has one, else the most recent Flow', () => {
  const chosen = docs.seedCentralDocuments(empty(), {subject: {form: 'flow', location: FLOW}})
  assert.deepEqual(tree(chosen), [[`${KIND}:${docs.TODAY_REF}`], [`${KIND}:${FLOW.ref}`]])
  const dated = docs.seedCentralDocuments(empty(), {subject: {form: 'day', date: '2026-10-08'}})
  assert.deepEqual(tree(dated)[1], [`${KIND}:central:day:control:root:2026-10-08`])
})

// ── the owners' words ────────────────────────────────────────────────────

/** A fake owner on the kernel bridge: it records each op it is sent and answers by op. */
function fakeOwner(answer) {
  const asked = []
  const real = globalThis.fetch
  globalThis.fetch = async (url, init) => {
    const op = JSON.parse(init.body)
    asked.push(op)
    const reply = answer(op)
    return {json: async () => reply}
  }
  return {asked, restore: () => { globalThis.fetch = real }}
}
const bridge = {kind: 'bridge', url: 'http://owner.test'}
const dayOpen = (dayRef) => ({ok: true, outcome: {result: 'central_reading', data: {schema: 'oi.central-day-open/v1', project: null, day: {
  day_ref: dayRef, document_state: 'ready', source: {ref: `central:source:control:root:${dayRef}`}, document: {document_id: `document:${dayRef}`}, revision: {revision: 'rev:7'}}}}})

test('today\'s Day is asked of the owner with no day ref, and the owner\'s answer — its date, its refusal — is the pane\'s', async () => {
  const owner = fakeOwner(() => dayOpen('central:day:control:root:2026-10-14'))
  try {
    const ready = await readings.readDayStanding(bridge, null)
    assert.equal(ready.state, 'ready')
    assert.equal(ready.dayRef, 'central:day:control:root:2026-10-14', 'the date is the owner\'s, read from its answer')
    assert.equal(ready.civilDate, '2026-10-14')
    assert.deepEqual(owner.asked[0], {op: 'central', project: null, request: {kind: 'open-day'}}, 'the current Day: open-day with no day_ref')
    await readings.readDayStanding(bridge, 'central:day:control:root:2026-10-08')
    assert.deepEqual(owner.asked[1].request, {kind: 'open-day', day_ref: 'central:day:control:root:2026-10-08'}, 'a dated Day asks for its day ref')
  } finally { owner.restore() }
  const absent = fakeOwner(() => ({ok: false, error: 'Current Day has no native document yet.'}))
  try {
    const uninitialised = await readings.readDayStanding(bridge, null)
    assert.equal(uninitialised.state, 'uninitialised')
    assert.equal(uninitialised.message, 'Current Day has no native document yet.', 'the owner\'s own sentence, verbatim')
    assert.equal(uninitialised.op, 'central · initialise-day', 'and the op that would admit the Day')
  } finally { absent.restore() }
  const refused = fakeOwner(() => ({ok: false, error: 'The Day source is outside the ground.'}))
  try {
    const refusal = await readings.readDayStanding(bridge, 'central:day:control:root:2026-01-01')
    assert.equal(refusal.state, 'refused')
    assert.equal(refusal.message, 'The Day source is outside the ground.')
  } finally { refused.restore() }
  const down = await readings.readDayStanding({kind: 'unavailable', reason: 'no kernel transport'}, null)
  assert.equal(down.state, 'refused', 'no carrier is a named refusal, never a blank')
  assert.match(down.message, /no kernel transport/)
})

test('the most recent Flow is the newest the owner\'s minting named: by its minute, then its collision suffix; a hand-named Flow ranks behind', () => {
  const row = name => ({name, location: location(`Control/user/flows/${name}`)})
  const rows = [row('flow-2026-10-14-2050.html'), row('flow-2026-10-14-2050-2.html'), row('flow-2026-10-13-2359.html'), row('zebra.html'), row('flow-2026-10-14-0900.html')]
  assert.equal(readings.latestFlowOf(rows).name, 'flow-2026-10-14-2050-2.html', 'a same-minute collision takes a suffix and is the newer')
  assert.equal(readings.latestFlowOf(rows.filter(r => r.name !== 'flow-2026-10-14-2050-2.html')).name, 'flow-2026-10-14-2050.html')
  assert.equal(readings.latestFlowOf([row('zebra.html'), row('apple.html')]).name, 'zebra.html', 'unstamped names rank by name, behind every stamped one')
  assert.equal(readings.latestFlowOf([row('zebra.html'), row('flow-2020-01-01-0000.html')]).name, 'flow-2020-01-01-0000.html')
  assert.equal(readings.latestFlowOf([]), null)
})

test('the Flow reading is the owner\'s listing: found, none (an empty or missing folder), or refused in the owner\'s words', async () => {
  const listing = entries => ({ok: true, outcome: {result: 'directory_read', directory: {schema: 'central.directory-reading/v1', location: location('Control/user/flows'), entries}}})
  const file = name => ({name, location: location(`Control/user/flows/${name}`), kind: 'file', byte_len: 4, retrieval_allowed: true})
  const found = fakeOwner(() => listing([file('flow-2026-10-13-2359.html'), file('flow-2026-10-14-2050.html'), {...file('sub'), kind: 'directory'}, file('notes.md')]))
  try {
    const reading = await readings.readLatestFlow(bridge)
    assert.equal(reading.state, 'found')
    assert.equal(reading.row.name, 'flow-2026-10-14-2050.html')
    assert.equal(reading.count, 2, 'html files only: a folder and a note are no Flow')
    assert.deepEqual(found.asked[0], {op: 'files_list', path: 'Control/user/flows'}, 'the flows folder, through the file owner')
  } finally { found.restore() }
  const none = fakeOwner(() => listing([]))
  try { assert.deepEqual(await readings.readLatestFlow(bridge), {state: 'none'}) } finally { none.restore() }
  const missing = fakeOwner(() => ({ok: false, error: 'No such file or directory (os error 2)'}))
  try { assert.deepEqual(await readings.readLatestFlow(bridge), {state: 'none'}, 'nothing written yet is what a missing folder means (flow/instances.ts)') } finally { missing.restore() }
  const refused = fakeOwner(() => ({ok: false, error: 'Central denies this listing.'}))
  try {
    const reading = await readings.readLatestFlow(bridge)
    assert.deepEqual(reading, {state: 'refused', message: 'Central denies this listing.'})
  } finally { refused.restore() }
})

// ── the pane, drawn ──────────────────────────────────────────────────────

const transport = {kind: 'unavailable', reason: 'the test carrier is down'}
const ready = vertical.interpretDayOpen('central:day:control:root:2026-10-14', {data: {schema: 'oi.central-day-open/v1', project: null, day: {
  document_state: 'ready', source: {ref: 'central:source:control:root:Control/agents/now/day/2026-10-14.day.html'},
  document: {document_id: 'day-document:2026-10-14'}, revision: {revision: 'rev:1'}}}})
const uninitialised = vertical.interpretDayOpen('today', {error: 'Current Day has no native document yet.'})
const refused = vertical.interpretDayOpen('central:day:control:root:2026-01-01', {error: 'The Day source is outside the ground.'})

test('the Day pane draws the Day die\'s own hosted form when the owner has stood the Day up, and the owner\'s sentence when it has not', () => {
  const day = html(createElement(pane.DayView, {transport, standing: ready}))
  assert.match(day, /data-document-device="ql-daily-die"/, 'the face the Day die opens full size, ported — not a second Day')
  assert.doesNotMatch(day, /central-document-absence/)
  const waiting = html(createElement(pane.DayView, {transport, standing: null}))
  assert.match(waiting, /data-central-absence="reading"/)
  const none = html(createElement(pane.DayView, {transport, standing: uninitialised}))
  assert.match(none, /data-central-absence="uninitialised"/)
  assert.match(none, /The owner says: “Current Day has no native document yet\.”/, 'the owner\'s words, verbatim')
  assert.match(none, /data-owner-op="central · initialise-day"/, 'with the owner op that would admit the Day')
  assert.doesNotMatch(none, /ql-daily-die/, 'no die is drawn for a Day that has no document')
  const no = html(createElement(pane.DayView, {transport, standing: refused}))
  assert.match(no, /data-central-absence="refused"/)
  assert.match(no, /The Day source is outside the ground\./)
})

test('the Flow pane draws the Flow\'s own hosted form, or says what the owner said of there being none', () => {
  const found = html(createElement(pane.LatestFlowView, {transport, reading: {state: 'found', row: {name: FLOW.path.split('/').pop(), location: FLOW, byte_len: 4}, count: 1}}))
  assert.match(found, /data-document-device="ql-flow"/, 'the Flow face, ported')
  assert.match(html(createElement(pane.LatestFlowView, {transport, reading: null})), /data-central-absence="reading"/)
  const none = html(createElement(pane.LatestFlowView, {transport, reading: {state: 'none'}}))
  assert.match(none, /Control\/user\/flows holds no Flow document/)
  assert.match(none, /files_list/, 'the owner op the listing came from')
  assert.doesNotMatch(none, /ql-flow/, 'no Flow is drawn where there is none')
  const refused = html(createElement(pane.LatestFlowView, {transport, reading: {state: 'refused', message: 'Central denies this listing.'}}))
  assert.match(refused, /Central denies this listing\./)
  assert.match(refused, /role="alert"/)
})

test('a pane whose subject is no Day or Flow says so, and draws nothing in its place', () => {
  const unknown = html(createElement(pane.CentralDocumentPane, {transport, subjectRef: 'wiki:node:stone'}))
  assert.match(unknown, /data-central-document="unknown"/)
  assert.match(unknown, /<span class="mono">wiki:node:stone<\/span>, is no Day or Flow/)
  assert.doesNotMatch(unknown, /data-document-device/)
  const flow = html(createElement(pane.CentralDocumentPane, {transport, subjectRef: FLOW.ref}))
  assert.match(flow, /data-central-document="flow"[^>]*data-subject="central:path:\/ground:Control\/user\/flows\/flow-2026-10-14-2050\.html"/)
  assert.match(flow, /data-document-device="ql-flow"/, 'a Flow named by its owner path ref draws that Flow')
  assert.match(html(createElement(pane.CentralDocumentPane, {transport, subjectRef: docs.TODAY_REF})), /data-central-document="day"[\s\S]*data-central-absence="reading"/, 'today\'s Day reads the owner first; nothing is drawn before it answers')
})

test('the document pane is admitted through the cradle\'s projection module door, as an opened thing: no follow or pin it cannot honour', () => {
  modules.resetProjectionModulesForTest()
  pane.registerCentralDocumentPane()
  pane.registerCentralDocumentPane() // idempotent
  const admitted = modules.projectionModule(KIND)
  assert.equal(admitted.id, 'central-document')
  assert.equal(modules.followsSelection(KIND), false, 'a document is opened, held, and does not follow the selection')
  assert.deepEqual(modules.admittedProjectionKinds(), [KIND])
  modules.resetProjectionModulesForTest()
})

// ── opening a plain file: the Workbench's own file route ─────────────────

function fakeWorkspace(extra = {}) {
  const calls = []
  const current = {
    workspaceId: 'w1', accessEpoch: 3, accessReady: true, transport: bridge, nativeAccessCurrent: epoch => epoch === 3,
    prepareSource: location => { calls.push(['prepare', location.ref]); return 'view-1' },
    resources: {read: async (location, intent) => { calls.push(['read', intent.viewId, intent.generation > 0, intent.isCurrent()]); return {location, revision: 'r1'} }},
    publishSource: (source, intent) => { calls.push(['publish', source.location.ref, intent.viewId]) },
    ...extra,
  }
  return {held: {current}, calls}
}

test('a plain file opens as the world browser opens one: its binding opens, the owner reads it, the reading qualifies the binding', async () => {
  const {held, calls} = fakeWorkspace()
  const note = entry('Control/user/intent.md')
  await opening.openGroundFile(held, note)
  assert.deepEqual(calls, [['prepare', note.location.ref], ['read', 'view-1', true, true], ['publish', note.location.ref, 'view-1']])
})

test('opening refuses in the owner\'s words, and a reading of another subject never qualifies the binding', async () => {
  const {held, calls} = fakeWorkspace()
  await assert.rejects(opening.openGroundFile(held, entry('Control/x.md', {retrieval_allowed: false})), /withheld by its owner \(retrieval not allowed\)/)
  await assert.rejects(opening.openGroundFile(held, entry('Control/x.md', {kind: 'directory'})), /is a directory, not a file/)
  assert.deepEqual(calls, [], 'a refused open touches nothing')
  await assert.rejects(opening.openGroundFile(fakeWorkspace({transport}).held, entry('Control/x.md')), /the test carrier is down/)
  await assert.rejects(opening.openGroundFile(fakeWorkspace({accessReady: false}).held, entry('Control/x.md')), /not ready yet/)
  const other = fakeWorkspace({resources: {read: async () => ({location: location('Control/elsewhere.md'), revision: 'r'})}})
  await assert.rejects(opening.openGroundFile(other.held, entry('Control/x.md')), /another subject/)
  assert.deepEqual(other.calls.filter(call => call[0] === 'publish'), [])
})

test('a newer open retires an older one that is still reading', async () => {
  let release
  const slow = fakeWorkspace({resources: {read: async (location, intent) => { await new Promise(resolve => { release = resolve }); return intent.isCurrent() ? {location, revision: 'r'} : Promise.reject(new Error('The resource result belongs to a retired access or view intent')) }}})
  const first = opening.openGroundFile(slow.held, entry('Control/a.md'))
  await new Promise(resolve => setTimeout(resolve, 0))
  const fast = fakeWorkspace()
  await opening.openGroundFile(fast.held, entry('Control/b.md'))
  release()
  await assert.rejects(first, /retired/, 'the first open sees it is no longer the current one')
})

test('the gestures open into the book\'s layout: a Days row its Day, a Flow row its Flow, any other file through the file route', async () => {
  const {held, calls} = fakeWorkspace()
  const layouts = []
  const book = {current: {setLayout: update => layouts.push(update(empty()))}}
  const opener = opening.centralDocumentOpener({workspace: held, book})
  await opener.openDay(entry('Control/agents/now/day/2026-10-08.md'))
  assert.deepEqual(tree(layouts[0]), [[`${KIND}:central:day:control:root:2026-10-08`]], 'the Day opens in the focused pane')
  await assert.rejects(opener.openDay(entry('Control/user/intent.md')), /is not a day record/)
  await opener.openFile(entry(FLOW.path))
  assert.deepEqual(tree(layouts[1]), [[`${KIND}:${FLOW.ref}`]], 'a Flow instance opens as its Flow')
  assert.deepEqual(calls, [], 'neither touched the file route')
  await opener.openFile(entry('Control/agents/now/day/2026-10-08.md'))
  assert.equal(layouts.length, 2, 'in the Files rows a day record is a file: it opens as itself, through the file route')
  assert.deepEqual(calls.map(call => call[0]), ['prepare', 'read', 'publish'])
  const none = opening.centralDocumentOpener({workspace: held, book: {current: null}})
  await assert.rejects(none.openDay(entry('Control/agents/now/day/2026-10-08.md')), /No pane tree is mounted/)
})

// ── the browser's rows (code-reading) ────────────────────────────────────

test('the browser\'s Central rows preview on select and open on double-click or Enter; Technē\'s Files take the file to hand as they did', async () => {
  const source = await readFile(new URL('../src/shell/ModeBrowser.tsx', import.meta.url), 'utf8')
  const days = source.slice(source.indexOf('function DaysRows'), source.indexOf('function GroundRows'))
  assert.match(days, /onClick=\{\(\) => onSelectSubject\(\{kind: 'day', path, location: entry\.location \?\? undefined\}\)\}/, 'select still previews, carrying the owner\'s own location for the day (no machine root in the shell)')
  assert.match(days, /onDoubleClick=\{\(\) => openDay\(entry, path\)\}/)
  assert.match(days, /event\.key === 'Enter'\) openDay\(entry, path\)/)
  assert.match(days, /Double-click or Enter opens the Day in the focused pane/, 'the row states what it does (the F2 law)')
  const ground = source.slice(source.indexOf('function GroundRows'), source.indexOf('/** The Technē Sources rows'))
  assert.match(source, /<GroundRows [^>]*opens=\{category\.id === 'central-files'\}/, 'the gesture is the Central Files category\'s, by its id — the rows hold no mode branch')
  assert.match(ground, /onDoubleClick=\{opens && !isDirectory \? \(\) => openFile\(entry, entryPath\) : undefined\}/)
  assert.match(ground, /event\.key === 'Enter'\) openFile\(entry, entryPath\)/)
  assert.match(ground, /onClick=\{\(\) => isDirectory \? navigateFiles\(entryPath\) : onSelectSubject\(/, 'a folder still walks on a click and a file still selects')
  assert.match(source, /openFault && <p className="native-error" role="alert" data-open-fault>/, 'a refusal is said by the rows, in the owner\'s words')
})

test('the browser rows draw without a pane tree or a workspace book mounted (the gesture reads them optionally)', async () => {
  const {ModeBrowser} = await import('../src/shell/ModeBrowser.tsx')
  const {StubWorkspaceProvider} = await import('../src/shell/workspaceContext.tsx')
  const out = html(createElement(StubWorkspaceProvider, {transport}, createElement(ModeBrowser, {mode: 'base', onSelectSubject: () => {}, selectedSubject: null})))
  assert.match(out, /data-mode-browser="base"/)
})

// Seen on screen (computer-use, native b9a0a8048, 14 Oct): the Flow pane carried "Save to native source" and "Re-read current
// document" on its face — options inside a pane. In a pane the document's head reads its revision and save standing; the
// actions stand in the browser's aperture for the document the hand reached (central/documents/documentDoor.ts).
test('in a pane a document carries a head reading and no buttons; as a device it keeps its own row', async () => {
  const {FlowFace} = await import('../src/inhabitants/DocumentFlowFace.tsx')
  const transport = {kind: 'unavailable', reason: 'test'}
  const inPane = html(createElement(FlowFace, {transport, location: FLOW, presentation: 'pane'}))
  assert.match(inPane, /data-document-head="flow"/)
  assert.match(inPane, /class="document-pane-state"[^>]*>as read</, 'the standing is a reading: nothing read, nothing saved')
  assert.doesNotMatch(inPane, /<button/, 'no control on the document\'s face')
  const asDevice = html(createElement(FlowFace, {transport, location: FLOW}))
  assert.match(asDevice, /Save to native source/, 'the device keeps its action row')
  assert.doesNotMatch(asDevice, /data-document-head/)
  const pane = await readFile(new URL('../src/central/documents/CentralDocumentPane.tsx', import.meta.url), 'utf8')
  assert.equal((pane.match(/presentation="pane"/g) ?? []).length, 2, 'the Day and the Flow both stand in a pane as documents')
})

test('the aperture follows the document the hand reached, and lets it go when the pane closes', async () => {
  const door = await import('../src/central/documents/documentDoor.ts')
  const day = {key: 'day:1', form: 'Day', title: 'today', state: 'as read', save: () => {}}
  const flow = {key: 'flow:1', form: 'Flow', title: 'flow', state: 'edited since save'}
  door.publishDocument(day, true)
  assert.equal(door.reachedDocument()?.key, 'day:1')
  door.publishDocument({...flow}, false)
  assert.equal(door.reachedDocument()?.key, 'day:1', 'a standing change of a document not reached moves nothing')
  door.publishDocument(flow, true)
  assert.equal(door.reachedDocument()?.key, 'flow:1', 'reaching the Flow moves the aperture to it')
  door.publishDocument({...flow, state: 'saved'}, false)
  assert.equal(door.reachedDocument()?.state, 'saved', 'the reached one\'s standing is followed')
  door.withdrawDocument('day:1')
  assert.equal(door.reachedDocument()?.key, 'flow:1', 'closing another pane leaves the reached one')
  door.withdrawDocument('flow:1')
  assert.equal(door.reachedDocument(), null)
  assert.equal(door.documentStateWords({pending: true, dirty: true}), 'waiting for the owner')
  assert.equal(door.documentStateWords({pending: false, dirty: true}), 'edited since save')
  assert.equal(door.documentStateWords({pending: false, dirty: false, blocked: 'moved'}), 'blocked — moved')
})

test('a document reached in a pane names its pane, and the aperture matches the focused pane by it (lane F)', async () => {
  const door = await import('../src/central/documents/documentDoor.ts')
  door.publishDocument({key: 'day:p', paneId: 'pane-a', form: 'Day', title: 'today', state: 'as read'}, true)
  assert.equal(door.reachedDocument()?.paneId, 'pane-a')
  door.withdrawDocument('day:p')
  const views = await readFile(new URL('../src/frame/browser/apertureViews.tsx', import.meta.url), 'utf8')
  assert.match(views, /reached\.paneId \? reached\.paneId === pane\.id/)
  const pane = await readFile(new URL('../src/central/documents/CentralDocumentPane.tsx', import.meta.url), 'utf8')
  assert.match(pane, /<DocumentPaneContext\.Provider value=\{binding\.id\}>/)
})
