import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'
import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'

// Central's Clip view reads the document's own Highlights, Notes and Packet from its payload (manual §5; world-shell-mockup.html
// clipDetail() :1663). The pure reading (central/documentPayload.ts) over synthetic payloads shaped as the forms write them
// (desktop/cradle/documents/ql-flow.html :1074-1076, ql-daily-die.html :649-651, and a v0.1 Flow's {at, html} notes and
// {kind, html} packet items), then the Clip view's columns rendered on the server. Production modules in memory (the
// detail-clip-view loader).
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

const {readDocumentPayload, readDayPayload, markedPassages, payloadText, payloadLine, packetHead, bounded, PAYLOAD_ROWS} = await import('../src/central/documentPayload.ts')
const {documentColumns, CentralSubjectClip} = await import('../src/central/CentralClipDetail.tsx')
const {ClipView} = await import('../src/frame/detail/ClipView.tsx')

// A document file as the forms write it: the payload island, `<` escaped the way every ql-doc family serialises it.
const page = doc => `<!doctype html><html><head><title>fixture</title></head><body><main id="app"></main>
<script type="application/json" id="ql-doc">${JSON.stringify(doc).replace(/</g, '\\u003c')}</script><script>/* the form's runtime */</script></body></html>`
const AT = '2026-10-08T09:00:00.000Z'
const flow = (overrides = {}) => ({
  meta: {documentId: 'doc-fixture', created: AT, title: 'On the stone', revision: 7, view: 'dialogue', current: null, journalCurrent: null, exported: null, template: 'ql-dialogue-flow v0.4'},
  entries: [
    {id: 'e1', author: 'F', at: AT, html: '<p>The vessel is <mark>the stone&#39;s other face</mark>, said plainly.</p>', replyTo: null, touched: false},
    {id: 'e2', author: 'Fz', at: AT, html: '<p>No passage of this entry is marked.</p>', replyTo: null, touched: false},
    {id: 'e3', author: 'F', at: AT, html: '<p><mark>a site <mark>where</mark> the inscription happens</mark> and <mark class="x">the&nbsp;inscription<br>makes the stone a vessel</mark></p><p><mark></mark></p>', replyTo: null, touched: false},
  ],
  notes: [
    {id: 'n1', entryId: 'e2', anchor: 'No passage', author: 'F', timing: 'during', text: '<p>Check against <b>Rosarium</b> pl. 10 before admitting.</p>', at: AT, replies: []},
    {id: 'n2', at: AT, html: '<p>A v0.1 note that names no entry.</p>'},
    {id: 'n3', entryId: 'gone', anchor: 'words of a removed entry', text: '', at: AT},
  ],
  packet: [
    {id: 'p1', entryId: 'e1', scope: 'selection', label: 'entry 1 (F)', text: 'the vessel is the stone’s other face', at: AT},
    {id: 'p2', at: AT, kind: 'note', html: '<p>A packet item withheld by default.</p>'},
  ],
  media: [], journal: [],
  ...overrides,
})
// The Day die's payload as the owner's document reading gives it (`template_payload`).
const day = {
  meta: {uuid: 'day-fixture', type: 'daily', date: '2026-10-08', revision: 3, template: 'ql-daily v0.1'},
  fields: {p0_quick_thoughts: 'nothing marked', p1_must: [{id: 't1', text: 'call the printer', done: false}], p3_patterns_noticed: '<p>the stone keeps <mark>returning as a place</mark></p>'},
  body: {p3_observations: '<p><mark>This is the palace room.</mark></p>', p5_tomorrow: ''},
  notes: [{id: 'dn1', field: 'p3_observations', anchor: 'the palace room', text: 'This is the palace room.', author: 'F', timing: 'during', at: AT}],
  packet: [{id: 'dp1', field: 'p3_observations', label: 'Observations', text: 'the stone keeps returning as a place, not an object', at: AT}],
  capture: [], sessions: [], completed: [], media: [], contributions: [],
}
const html = element => renderToStaticMarkup(element)
const columnsOf = state => html(createElement(ClipView, {name: 'Flow', kind: 'probe', rows: [], columns: documentColumns(state)}))
const count = (markup, pattern) => (markup.match(pattern) ?? []).length

test('a Flow\'s payload: the passages its entries mark, with the entry\'s anchor — outermost marks, html reduced to text', () => {
  const reading = readDocumentPayload(page(flow()))
  assert.equal(reading.state, 'read')
  assert.equal(reading.family, 'flow'); assert.equal(reading.label, 'Flow'); assert.equal(reading.template, 'ql-dialogue-flow v0.4')
  assert.deepEqual(reading.highlights, [
    {anchor: 'F1', where: 'entry 1 (F)', text: 'the stone\'s other face'},
    {anchor: 'F3', where: 'entry 3 (F)', text: 'a site where the inscription happens'},
    {anchor: 'F3', where: 'entry 3 (F)', text: 'the inscription makes the stone a vessel'},
  ], 'an entry without <mark> gives none; a mark inside a mark is one passage; an empty mark marks nothing')
  assert.deepEqual(markedPassages('<p><mark>runs to the end'), ['runs to the end'], 'an unclosed mark runs to the end of the body')
  assert.deepEqual(markedPassages('<p><marker>not a mark</marker></p>'), [])
})

test('a Flow\'s notes and packet: anchor and words, kind and words — both the current and the v0.1 shapes', () => {
  const reading = readDocumentPayload(page(flow()))
  assert.deepEqual(reading.notes, [
    {anchor: 'Fz2', where: 'entry 2 (Fz)', text: 'Check against Rosarium pl. 10 before admitting.', quote: 'No passage', at: AT},
    {anchor: null, where: null, text: 'A v0.1 note that names no entry.', quote: null, at: AT},
    {anchor: null, where: 'an entry no longer in the payload (gone)', text: '', quote: 'words of a removed entry', at: AT},
  ])
  assert.deepEqual(reading.packet, [
    {kind: 'selection', source: 'entry 1 (F)', text: 'the vessel is the stone’s other face', at: AT},
    {kind: 'note', source: null, text: 'A packet item withheld by default.', at: AT},
  ], 'a withheld-by-default item reads as it is: the owner\'s own window, nothing sent')
  assert.equal(packetHead(reading), 'Packet · 2 items · 70 chars')
})

test('the Day die\'s payload: marks in its fields, notes and packet on its fields, anchored by the face', () => {
  const reading = readDayPayload(day)
  assert.equal(reading.state, 'read'); assert.equal(reading.label, 'Day'); assert.equal(reading.template, 'ql-daily v0.1')
  assert.deepEqual(reading.highlights, [
    {anchor: 'p3', where: 'p3_patterns_noticed', text: 'returning as a place'},
    {anchor: 'p3', where: 'p3_observations', text: 'This is the palace room.'},
  ], 'string fields and body are read; a task list (an array) holds no html marks')
  assert.deepEqual(reading.notes, [{anchor: 'p3', where: 'p3_observations', text: 'This is the palace room.', quote: 'the palace room', at: AT}])
  assert.deepEqual(reading.packet, [{kind: null, source: 'Observations', text: 'the stone keeps returning as a place, not an object', at: AT}])
})

test('an empty payload says so per column, naming what was read; no payload, or a malformed island, is never read as data', () => {
  const empty = readDocumentPayload(page(flow({entries: [], notes: [], packet: []})))
  assert.equal(payloadLine(empty, 'highlights'), 'This Flow\'s payload holds no highlights.')
  assert.equal(payloadLine(empty, 'notes'), 'This Flow\'s payload holds no notes.')
  assert.equal(payloadLine(empty, 'packet'), 'This Flow\'s payload holds no packet items.')
  assert.equal(packetHead(empty), 'Packet')
  const keyless = readDocumentPayload(page({profile: 'oi.page/v1', meta: {family: 'things', template: 'oi.template/things'}, page: {}}))
  assert.equal(keyless.state, 'read'); assert.equal(payloadLine(keyless, 'notes'), 'This Things\' payload holds no notes.')
  assert.deepEqual(readDocumentPayload('# A note in markdown\n\nNo island here.'), {state: 'absent'})
  assert.equal(payloadLine({state: 'absent'}, 'notes'), null, 'no payload: the caller keeps its own line')
  const malformed = readDocumentPayload('<script type="application/json" id="ql-doc">{"meta": {"title": "half</script>')
  assert.equal(malformed.state, 'malformed'); assert.ok(malformed.reason.length > 0)
  assert.equal(payloadLine(malformed, 'highlights'), 'This document\'s payload does not parse, so its highlights are not read.')
  assert.equal(readDocumentPayload(page([1, 2])).state, 'malformed', 'an island that is not an object is not a payload')
})

test('text only: the payload\'s html is reduced, never carried — scripts, handlers and tags never reach the shell', () => {
  assert.equal(payloadText('<p>one<br>two</p><script>alert(1)</script><style>p{}</style><img src=x onerror="alert(2)">&lt;b&gt; &#8212; &#x2014;'), 'one two <b> — —')
  const hostile = flow({
    entries: [{id: 'h1', author: 'F', at: AT, html: '<p><mark><img src=x onerror="alert(1)">marked <script>alert(2)</script>words</mark></p>', replyTo: null, touched: false}],
    notes: [{id: 'hn', entryId: 'h1', text: '<a href="javascript:alert(3)">a link</a> &lt;script&gt;', at: AT}],
    packet: [{id: 'hp', at: AT, kind: 'note', html: '<iframe src="https://example.invalid"></iframe><p>plain</p>'}],
  })
  const out = columnsOf({phase: 'read', reading: readDocumentPayload(page(hostile))})
  for (const banned of [/<img/, /<script/, /<iframe/, /onerror/, /javascript:/, /<a /]) assert.doesNotMatch(out, banned)
  assert.match(out, /<span class="hl2-text">marked words<\/span>/)
  assert.match(out, /<span class="hl2-text">a link &lt;script&gt;<\/span>/, 'decoded words are escaped text, not markup')
})

test('the Clip view\'s columns: Highlights (mark · words · anchor), Notes (anchor · words), Packet (size · kind · source — words) under its count', () => {
  const out = columnsOf({phase: 'read', reading: readDocumentPayload(page(flow()))})
  assert.equal(count(out, /<section class="ccol"/g), 3)
  assert.match(out, /<section class="ccol" aria-label="Highlights" data-column="Highlights" style="width:320px;flex:none"><h5>Highlights<\/h5><div data-payload-column="highlights" data-rows="3">/)
  assert.match(out, /<div class="hl2" title="Marked in entry 1 \(F\)"><span class="hl2-lead"><i class="hl2-dot" aria-hidden="true"><\/i><\/span><span class="hl2-text">the stone&#x27;s other face<\/span><span class="r">F1<\/span><\/div>/)
  assert.match(out, /aria-label="Notes" data-column="Notes" style="width:300px;flex:none"><h5>Notes<\/h5><div data-payload-column="notes" data-rows="3">/)
  assert.match(out, /<span class="hl2-lead">Fz2<\/span><span class="hl2-text">Check against Rosarium pl\. 10 before admitting\.<\/span>/)
  assert.match(out, /<span class="hl2-lead">—<\/span><span class="hl2-text">A v0\.1 note that names no entry\.<\/span>/, 'a note naming no entry: "—", never an invented anchor')
  assert.match(out, /<span class="hl2-text">“words of a removed entry”<\/span>/, 'an empty note shows the passage it was made on')
  assert.match(out, /<h5>Packet · 2 items · 70 chars<\/h5><div data-payload-column="packet" data-rows="2">/)
  assert.match(out, /<span class="hl2-lead">36<\/span><span class="hl2-chip">selection<\/span><span class="hl2-text">entry 1 \(F\) — the vessel is the stone’s other face<\/span>/)
  assert.match(out, /<span class="hl2-lead">34<\/span><span class="hl2-chip">note<\/span><span class="hl2-text">A packet item withheld by default\.<\/span>/)
})

test('each column is bounded: the first rows, then how many more the payload holds', () => {
  const many = n => Array.from({length: n}, (_, i) => ({id: `n${i}`, entryId: 'e1', text: `note ${i + 1}`, at: AT}))
  assert.deepEqual(bounded([1, 2, 3], 2), {shown: [1, 2], more: 1})
  const out = columnsOf({phase: 'read', reading: readDocumentPayload(page(flow({notes: many(PAYLOAD_ROWS + 5)})))})
  assert.match(out, /data-payload-column="notes" data-rows="17">/)
  assert.equal(count(out.slice(out.indexOf('data-payload-column="notes"'), out.indexOf('aria-label="Packet')), /class="hl2"/g), PAYLOAD_ROWS)
  assert.match(out, /<span class="hl2-text">note 12<\/span>/); assert.doesNotMatch(out, /note 13</)
  assert.match(out, /<p class="ccol-none">… 5 more in the payload<\/p>/)
})

test('one line per column: an empty payload names what was read; no payload keeps today\'s line; waiting and refused say so', () => {
  const empty = columnsOf({phase: 'read', reading: readDocumentPayload(page(flow({entries: [], notes: [], packet: []})))})
  assert.match(empty, /<h5>Highlights<\/h5><p class="ccol-none">This Flow&#x27;s payload holds no highlights\.<\/p>/)
  assert.match(empty, /<h5>Notes<\/h5><p class="ccol-none">This Flow&#x27;s payload holds no notes\.<\/p>/)
  assert.match(empty, /<h5>Packet<\/h5><p class="ccol-none">This Flow&#x27;s payload holds no packet items\.<\/p>/)
  for (const state of [{phase: 'none'}, {phase: 'read', reading: {state: 'absent'}}]) {
    const none = columnsOf(state)
    assert.match(none, /<h5>Highlights<\/h5><p class="ccol-none">No highlights reading: the document&#x27;s owner discloses none\.<\/p>/)
    assert.match(none, /<h5>Notes<\/h5><p class="ccol-none">No notes reading: the document&#x27;s owner discloses none\.<\/p>/)
    assert.match(none, /<h5>Packet<\/h5><p class="ccol-none">No packet reading: the document&#x27;s owner discloses none\.<\/p>/)
  }
  const malformed = columnsOf({phase: 'read', reading: readDocumentPayload('<script type="application/json" id="ql-doc">{</script>')})
  assert.match(malformed, /<p class="ccol-none">This document&#x27;s payload does not parse, so its notes are not read\.<\/p>/)
  assert.equal(count(columnsOf({phase: 'reading'}), /<p class="ccol-none">Waiting for the owner&#x27;s reading\.<\/p>/g), 3)
  assert.equal(count(columnsOf({phase: 'refused', message: 'denied'}), /<p class="ccol-none">Not read: the owner refused the document reading\.<\/p>/g), 3)
})

test('a browser subject before the owner answers: its three columns wait, and nothing is claimed of its payload', () => {
  const out = html(createElement(CentralSubjectClip, {transport: {kind: 'unavailable', reason: 'the test carrier is down'}, subject: {kind: 'note', path: 'Control/user/flows/flow-fixture.html'}}))
  assert.match(out, /data-row="template"[^>]*><span>template<\/span><span data-undisclosed="true">—<\/span>/)
  assert.equal(count(out, /<p class="ccol-none">Waiting for the owner&#x27;s reading\.<\/p>/g), 3)
  assert.match(out, /<h5>Packet<\/h5>/)
})
