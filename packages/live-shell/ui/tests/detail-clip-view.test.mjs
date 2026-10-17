import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'
import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'

// The Clip view at the mockup's floor (world-shell-mockup.html clipDetail() :1651-1680): one anatomy — a props column (the clip's
// name on its colour, then key and value rows) beside named columns — that Central's and Factory's clip sides draw through, from
// fixture readings shaped as their owners give them. Production modules in memory (the mode-surface-fidelity loader).
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

const {ClipView, ClipLine, ClipNone, ClipWaiting} = await import('../src/frame/detail/ClipView.tsx')
const {clipBoxRows, selectedClipOf} = await import('../src/frame/detail/ClipBox.tsx')
const {BaseDocumentDetail, FactoryTaskLogDetail} = await import('../src/shell/ModeDetail.tsx')
const {CentralClipDetail, CentralSubjectClip} = await import('../src/central/CentralClipDetail.tsx')
const {factoryTrackAdapter} = await import('../src/timeline/factoryTrackAdapter.ts')

// Fixture readings, shaped as their owners give them: one agency track (agent/agentRunModel.ts AgentSessionTrack) with its one
// real task and the soft-stop slot, the session's temporal events (temporal_events_read rows), and a Central clip selection.
const T = (h, m) => Date.UTC(2026, 9, 8, h, m)
const fixtures = {
  track: {sessionRef: 'ses-214', purpose: 'correlate occurrences', agentRef: 'agent:fizz', agentName: 'Fizz', agentAccepted: true,
    spaceRef: 'space:lead', spaceLabel: 'Fizz · lead', depth: 0, parentRef: null, group: false, memberRefs: [], needle: null, telemetryOn: false,
    budget: {used: 2, max: 12}, disclosure: null, tasks: [
      {n: 1, title: 'correlate occurrences', state: 'running', startUnixMs: T(13, 41), lastActivityUnixMs: T(14, 24), softStop: false, disclosure: 'Running by inference from temporal activity'},
      {n: 2, title: null, state: 'unknown', startUnixMs: null, lastActivityUnixMs: null, softStop: true, disclosure: null}]},
  events: [
    {stream: 'agency', kind: 'run', subject_ref: 'agency/ses-214/turn', instant_unix_ms: T(13, 41), summary: 'attempt 2 started'},
    {stream: 'agency', kind: 'gateway-delta', subject_ref: 'agency/ses-214/read', instant_unix_ms: T(14, 2), summary: 'read vault/cw13/iv.md §IV 3–9'},
    {stream: 'agency', kind: 'gateway-delta', subject_ref: 'agency/ses-214/steer', instant_unix_ms: T(14, 21), summary: 'you: mark the field as a draft'},
  ],
  factorySet: () => factoryTrackAdapter.project({tracks: [fixtures.track], nowUnixMs: T(14, 30)}),
  centralSelection: overrides => ({kind: 'day', returnKind: null, subjectRef: 'central:day:control:root:2026-10-08', stream: 'days', summary: null,
    instantUnixMs: T(8, 30), dayRef: 'central:day:control:root:2026-10-08', civilDate: '2026-10-08', evidenceRefs: [], ...overrides}),
}

const html = element => renderToStaticMarkup(element)
const UNAVAILABLE = {kind: 'unavailable', reason: 'the test carrier is down'}
const count = (markup, pattern) => (markup.match(pattern) ?? []).length

test('the Clip view: the clip\'s name on its colour, key and value rows ("—" where nothing is disclosed), named columns', () => {
  const out = html(createElement(ClipView, {name: 'correlate occurrences', colour: '#79b6ce', kind: 'probe',
    rows: [{key: 'session', value: 'Fizz · lead'}, {key: 'attempt', value: null, title: 'no owner names it'}],
    columns: [{name: 'Log', body: createElement(ClipLine, {lead: '13:41', chip: 'turn'}, 'attempt 2 started')}, {name: 'Notes', body: createElement(ClipNone, null, 'none')}]}))
  assert.match(out, /^<div class="clipv" data-clip-view="probe"><div class="cprops"/)
  assert.match(out, /<div class="cph" style="--cph:#79b6ce;--cph-ink:var\(--bg-0\)"[^>]*>correlate occurrences<\/div>/, 'the head carries the clip\'s colour')
  assert.match(out, /<div class="kvs"[^>]*data-row="session"><span>session<\/span><span>Fizz · lead<\/span><\/div>/)
  assert.match(out, /data-row="attempt"><span>attempt<\/span><span data-undisclosed="true">—<\/span>/, 'an undisclosed value is "—", never filled in')
  assert.equal(count(out, /<section class="ccol"/g), 2); assert.match(out, /<h5>Log<\/h5>/); assert.match(out, /<h5>Notes<\/h5>/)
  assert.match(out, /<span class="hl2-lead">13:41<\/span><span class="hl2-chip">turn<\/span><span class="hl2-text">attempt 2 started<\/span>/, 'a log row: time · tool · argument')
  assert.equal(html(createElement(ClipWaiting, {line: 'Select a task.'})), '<p class="clip-empty" role="status">Select a task.</p>')
})

test('the clip box\'s facts stand in the props column: where it ran, when a launch lands, what follows — undisclosed as "—"', () => {
  const set = fixtures.factorySet()
  const rows = clipBoxRows(selectedClipOf(set.clips[0].id, set))
  assert.deepEqual(rows.map(row => row.key), ['track', 'state', 'span', 'launch', 'then'])
  assert.equal(rows.find(row => row.key === 'launch').value, null)
  assert.equal(rows.find(row => row.key === 'then').value, null)
  assert.deepEqual(clipBoxRows(selectedClipOf('Control/user/notes/a.md', set)), [], 'a selection that is not a shown clip carries no clip box')
})

test('Factory\'s clip: the task — session, agent, status, attempt, workcell, budget — and its Log, time · tool · argument', () => {
  const set = fixtures.factorySet()
  const out = html(createElement(FactoryTaskLogDetail, {track: fixtures.track, n: 1, name: 'Fizz · lead', colour: '#79b6ce',
    box: clipBoxRows(selectedClipOf(set.clips[0].id, set)), events: fixtures.events}))
  assert.match(out, /data-clip-view="factory-task"/)
  assert.match(out, /class="cph"[^>]*>correlate occurrences</, 'the task\'s name on the session\'s colour')
  for (const [key, value] of [['session', 'Fizz · lead'], ['agent', 'Fizz'], ['status', 'running'], ['budget', '2 / 12 turns']]) {
    assert.match(out, new RegExp(`data-row="${key}"><span>${key}</span><span>${value}</span>`), `${key} reads ${value}`)
  }
  for (const key of ['attempt', 'workcell', 'launch', 'then']) assert.match(out, new RegExp(`data-row="${key}"><span>${key}</span><span data-undisclosed="true">—</span>`), `${key} is undisclosed`)
  assert.match(out, /<h5>Log<\/h5>/)
  assert.equal(count(out, /class="hl2"/g), fixtures.events.length, 'a log row per owner event — none invented')
  assert.match(out, /<span class="hl2-chip">gateway-delta<\/span><span class="hl2-text">read vault\/cw13\/iv\.md §IV 3–9<\/span>/)
  assert.ok(out.indexOf('attempt 2 started') < out.indexOf('mark the field as a draft'), 'rows run along the task\'s time')
  assert.doesNotMatch(out, /declared, waiting/, 'no prose rows for what is not disclosed')
  assert.doesNotMatch(out, /Desk/, 'no Desk leftover')
})

test('Factory\'s Log says in one line when no event names the session, or when no sessions reading stands', () => {
  const none = html(createElement(FactoryTaskLogDetail, {track: fixtures.track, n: 1, events: []}))
  assert.equal(count(none, /class="hl2"/g), 0)
  assert.match(none, /<p class="ccol-none">No temporal event names this session/)
  const unread = html(createElement(FactoryTaskLogDetail, {track: fixtures.track, events: null}))
  assert.match(unread, /<p class="ccol-none">The thread&#x27;s activity is not read here/)
})

test('Central\'s clip with nothing selected is one line and no body — no device cards stand in the pane', () => {
  const out = html(createElement(BaseDocumentDetail, {transport: UNAVAILABLE, subject: null, waits: 'Select a document.'}))
  assert.equal(out, '<p class="clip-empty" role="status">Select a document.</p>')
})

test('Central\'s subject as data: form on the head, file · template · revision · state · bindings, Highlights · Notes · Packet waiting in one line each', () => {
  const out = html(createElement(CentralSubjectClip, {transport: UNAVAILABLE, subject: {kind: 'note', path: 'Control/user/notes/the-stone.md'}}))
  assert.match(out, /data-clip-view="subject:note"/)
  assert.match(out, /class="cph"[^>]*>Note</, 'the document\'s form on the head')
  assert.match(out, /data-row="file"><span>file<\/span><span>the-stone\.md<\/span>/)
  assert.match(out, /data-row="path"><span>path<\/span><span>Control\/user\/notes\/the-stone\.md<\/span>/)
  for (const key of ['template', 'revision', 'state', 'world', 'subject', 'office', 'sources']) {
    assert.match(out, new RegExp(`data-row="${key}"><span>${key}</span><span data-undisclosed="true">—</span>`), `${key}: nothing disclosed before the owner answers`)
  }
  assert.match(out, /Reading the owner…/, 'the read in flight is said once, under the rows')
  // Moved (ticket H): the columns read the file's own payload once the owner answers (tests/central-clip-payload.test.mjs), so
  // before it answers they wait instead of saying the owner discloses none.
  for (const column of ['Highlights', 'Notes', 'Packet']) {
    assert.match(out, new RegExp(`<h5>${column}</h5><p class="ccol-none">Waiting for the owner&#x27;s reading\\.</p>`), `${column} waits for the owner`)
  }
})

test('Central\'s Timeline clips: a conversation names its binding gap; material Central does not own is one line', () => {
  const conversation = html(createElement(CentralClipDetail, {transport: UNAVAILABLE, selection: fixtures.centralSelection({kind: 'conversation', subjectRef: 'space:fizz', stream: 'conversations', summary: 'Fizz'})}))
  assert.match(conversation, /data-clip-view="conversation"/)
  assert.match(conversation, /data-row="space"><span>space<\/span><span>space:fizz<\/span>/)
  assert.match(conversation, /data-row="expression"[^>]*><span>expression<\/span><span data-undisclosed="true">—<\/span>/)
  assert.match(conversation, /<h5>Binding<\/h5><p class="ccol-none">The conversation space:fizz stands in the temporal reading/)
  const other = html(createElement(CentralClipDetail, {transport: UNAVAILABLE, selection: fixtures.centralSelection({kind: 'other', stream: 'kernel'})}))
  assert.match(other, /^<p class="clip-empty" role="status">This clip stands for material Central does not own \(kernel\)/)
  const day = html(createElement(CentralClipDetail, {transport: UNAVAILABLE, selection: fixtures.centralSelection({kind: 'day', dayRef: null, civilDate: null})}))
  assert.match(day, /data-clip-view="day"/); assert.match(day, /Undated: the reading gives this clip no civil day/)
  for (const key of ['face', 'closes']) assert.match(day, new RegExp(`data-row="${key}"><span>${key}</span><span data-undisclosed="true">—</span>`), `a Day's ${key}, as the mockup's Day carries it`)
  assert.doesNotMatch(day, /data-row="world"/, 'a Day carries its own rows, not a Thing\'s bindings')
})
