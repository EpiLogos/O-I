// Lane BC2: Central's page family on Central's readings and writes — the catalogue's Document, Flow, Text, Highlight, Notes, Beings,
// Things and Workspace designs (inhabitants/catalogue/panels/central__*.tsx) bound by central/devices/pageBindings.ts over the
// owners the hosted faces already read (central/devices/pageReadings.ts), placed on Central's chain by CentralDevices.tsx.
// Channels: SCRIPTED (pure bindings over a fixture Flow island shaped as the real one, flow-2026-10-03-1432.html; the real file read
// READ-ONLY where this machine holds it); SCRIPTED against a FAKE OWNER (a stubbed kernel bridge holding one Flow file and checking
// the CAS as central.files.write does) for the Flow's next entry; SSR of each design's views on the binding's values. Not a screen
// pass: the native legs are the lead's.
import test from 'node:test'
import assert from 'node:assert/strict'
import {existsSync} from 'node:fs'
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

const bindings = await import('../src/central/devices/pageBindings.ts')
const readings = await import('../src/central/devices/pageReadings.ts')
const pageDevices = await import('../src/central/devices/pageDevices.ts')
const model = await import('../src/central/devices/centralDeviceModel.ts')
const chain = await import('../src/central/devices/CentralDevices.tsx')
const writes = await import('../src/central/devices/centralDeviceWrites.ts')
const {designKey} = await import('../src/frame/devices/designs.ts')
const {parseInstance} = await import('../../../../desktop/cradle/src/flow/instance.ts')
const {inhabitantManifest} = await import('../src/inhabitants/manifest.ts')
const {loadWorldShellFamilies} = await import('../src/inhabitants/worldShellFamilies.ts')
loadWorldShellFamilies()
const central = inhabitantManifest('central')
const panel = name => import(`../src/inhabitants/catalogue/panels/central__${name}.tsx`).then(module => module.design)
const DESIGNS = {
  [bindings.DOCUMENT_DESIGN]: await panel('document'), [bindings.FLOW_DESIGN]: await panel('flow-document'), [bindings.TEXT_DESIGN]: await panel('text'),
  [bindings.HIGHLIGHT_DESIGN]: await panel('highlight'), [bindings.NOTES_DESIGN]: await panel('notes'), [bindings.BEINGS_DESIGN]: await panel('beings'),
  [bindings.THINGS_DESIGN]: await panel('things'), [bindings.WORKSPACE_DESIGN]: await panel('workspace'),
}

// ── a Flow, shaped as the real one (Control/user/flows/flow-2026-10-03-1432.html: format v4, an agent participant whose entries name
// sources and artifacts) with the person, a reply, a branch, a highlight, an emphasis, a heading, a quote, a note and a packet item ──
const LOCATION = {schema: 'central.path-ref/v1', ref: 'central:path:/ground:Control/user/flows/flow-2026-10-03-1432.html', root: '/ground', path: 'Control/user/flows/flow-2026-10-03-1432.html'}
const DOC = {
  meta: {documentId: '769005e3-9bf0-491b-afcd-db10706ab8da', created: '2026-10-03T13:32:32.123Z', title: 'Factory original development Run — execution and continuation',
    revision: 8, view: 'dialogue', current: 'e3', journalCurrent: null, exported: null, template: 'ql-dialogue-flow v0.4', format: {version: 4, minReader: 4},
    participants: [
      {initial: 'C', key: 'p-c', kind: 'agent', name: 'Factory coordinator', ref: 'codex:01a0', role: 'contributor', binding: {owner: 'document', basis: 'declared', ref: 'codex:01a0'}},
      {initial: 'F', key: 'p-f', kind: 'person', name: 'You', role: 'contributor', binding: {owner: 'document', basis: 'unknown', ref: ''}},
    ]},
  entries: [
    {id: 'e1', author: 'C', authorKey: 'p-c', at: '2026-10-03T13:33:00Z', html: '<p>This is the continuation Flow for the existing Factory development Run. It holds the record.</p>', replyTo: null, touched: false,
      relations: [{type: 'source', ref: 'run:01M3'}, {type: 'source', ref: 'workflow-source:01M3'}, {type: 'artifact', ref: 'observation:x'}]},
    {id: 'e2', author: 'C', authorKey: 'p-c', at: '2026-10-03T14:44:00Z', html: '<h2>The repaired image</h2><p>It has been <b>installed</b> on <i>Omarchy</i>.</p>', replyTo: null, touched: false},
    {id: 'e3', author: 'C', authorKey: 'p-c', at: '2026-10-03T17:01:40Z', html: '<blockquote>The original development Run <mark>remains incomplete</mark>.</blockquote>', replyTo: null, touched: false},
    {id: 'e4', author: 'F', authorKey: 'p-f', at: '2026-10-03T22:10:00Z', html: '<p>Which unit starts first?</p>', replyTo: null, touched: false, relations: [{type: 'reply', entryId: 'e3', revision: 5}]},
    {id: 'e5', author: 'F', authorKey: 'p-f', at: '2026-10-03T22:14:00Z', html: '<p>What if the image <s>fails</s> breaks?</p>', replyTo: null, touched: false, relations: [{type: 'branch', entryId: 'e2', revision: 6}]},
  ],
  notes: [{id: 'n1', entryId: 'e3', anchor: 'remains incomplete', author: 'F', text: '<p>Seven units, none started.</p>', at: '2026-10-15T09:12:00Z', replies: [{id: 'r1', author: 'F', at: '2026-10-15T09:13:00Z', text: 'Omarchy first.'}]},
    {id: 'n2', entryId: null, anchor: null, author: 'F', timing: 'after', text: 'Read the whole flow again.', at: '2026-10-15T11:52:00Z', replies: []}],
  packet: [{entryId: 'e4', scope: 'selection', label: 'entry 4 (F)', text: 'Which unit starts first?'}],
  media: [],
  journal: [{id: 'j1', at: '2026-10-13T09:00:00Z', html: '<p>Monday.</p>'}, {id: 'j2', at: '2026-10-15T09:00:00Z', html: '<p>Wednesday.</p>'}],
}
const island = doc => `<!doctype html><html><head><title>Flow</title></head><body><script type="application/json" id="ql-doc">${JSON.stringify(doc)}</script></body></html>`
const PAGE = readings.readFlowPage(parseInstance(island(DOC)))
const FLOW_DOOR = {key: 'flow:t', paneId: 'pane-flow', form: 'Flow', title: DOC.meta.title, revision: 'central.content-fnv1a64/v1:93261:171ffec3653140f9', state: 'as read',
  location: LOCATION, dirty: false, save: () => {}, reread: () => {}}
const reachedFlow = (door = FLOW_DOOR) => pageDevices.reachedPageOf(door, null)
const flowMaterial = {form: 'flow', page: PAGE, refusal: null}

// ─────────────────────────────────────────────────────────────────────────────────────────────────── the wiring covers every key

test('every key of every page design is wired: a reading, a write, the view\'s own, refused with its reason, or absent with its reason', () => {
  for (const wiring of bindings.PAGE_WIRINGS) {
    const design = DESIGNS[wiring.design]
    assert.ok(design, `${wiring.design}: the catalogue holds the design`)
    assert.equal(design.id, wiring.design)
    const declared = Object.keys(design.fixtures['No readings'])
    for (const key of declared) assert.ok(wiring.keys.includes(key), `${wiring.design}: the design's key "${key}" is in the wiring`)
    for (const key of wiring.keys) {
      const placed = [wiring.reads, wiring.writes, wiring.local, wiring.refused, wiring.absent].some(table => key in table)
      assert.ok(placed, `${wiring.design}: "${key}" is read, written, held, refused or absent`)
    }
    for (const [key, why] of Object.entries({...wiring.refused, ...wiring.absent})) assert.ok(why.length > 20, `${wiring.design}: "${key}" says why in words`)
  }
})

test('each page device is published under the id its design draws: designKey(family, face) === design.id', () => {
  for (const face of ['document', 'flow-document', 'text', 'highlight', 'notes', 'beings', 'things', 'workspace']) {
    const declared = central.faces.find(candidate => candidate.id === face)
    assert.ok(declared, `the family declares ${face}`)
    const device = model.centralDevice(declared, {})
    assert.equal(designKey(device.family, device.face.id), `central:${face}`)
    assert.ok(DESIGNS[`central:${face}`], `the catalogue's design central:${face}`)
  }
})

// ─────────────────────────────────────────────────────────────────────────────────────────────────── the page, read

test('a Flow page reads to the word: entries, styles, emphasis, marks, relations, notes, packet and journal, as the page keeps them', () => {
  assert.equal(PAGE.entries.length, 5)
  assert.deepEqual(PAGE.entries.map(entry => entry.style), ['body', 'head', 'quote', 'body', 'body'])
  assert.deepEqual([PAGE.entries[0].sources, PAGE.entries[0].artifacts], [2, 1], 'source and artifact relations are counted, not threaded')
  assert.deepEqual(PAGE.entries[3].relation, {type: 'reply', to: [3]})
  assert.deepEqual(PAGE.entries[4].relation, {type: 'branch', to: [2]})
  const words = readings.wordsOfHtml(PAGE.entries[1].html)
  assert.deepEqual(words.map(word => [word.word, word.flags]), [['The', ''], ['repaired', ''], ['image', ''], ['It', ''], ['has', ''], ['been', ''], ['installed', 'b'], ['on', ''], ['Omarchy.', 'i']])
  assert.deepEqual(readings.wordsOfHtml(PAGE.entries[2].html).filter(word => word.marked).map(word => word.word), ['remains', 'incomplete.'])
  assert.deepEqual(PAGE.notes.map(note => [note.entry, note.anchor, note.timing, note.text, note.replies]), [
    [3, 'remains incomplete', 'during', 'Seven units, none started.', ['Omarchy first.']],
    [null, null, 'after', 'Read the whole flow again.', []],
  ], 'a note the page keeps no timing for is drawn during (ql-flow.html:938)')
  assert.deepEqual(PAGE.packet, [{entry: 4, scope: 'selection', text: 'Which unit starts first?'}])
  assert.deepEqual(PAGE.people.map(person => [person.initial, person.kind, person.basis]), [['C', 'agent', 'declared'], ['F', 'person', 'unknown']])
  assert.equal(PAGE.current, 3, 'the open entry is meta.current, by number')
  assert.equal(PAGE.plural, true)
})

const REAL_FLOW = '/Users/admin/Central/Control/user/flows/flow-2026-10-03-1432.html'
test('the real Flow reads through the same readers — Control/user/flows/flow-2026-10-03-1432.html, read-only',
  {skip: existsSync(REAL_FLOW) ? false : 'the owner\'s Flow is not on this machine'}, async () => {
  const page = readings.readFlowPage(parseInstance(await readFile(REAL_FLOW, 'utf8')))
  assert.ok(page.entries.length >= 6, `the real Flow holds its entries (${page.entries.length})`)
  assert.equal(page.plural, true)
  assert.ok(page.people.some(person => person.kind === 'agent' && person.name === 'Factory coordinator'))
  assert.ok(page.entries.every(entry => entry.by === 'C'))
  assert.ok(page.entries.some(entry => entry.sources > 0 && entry.artifacts > 0), 'the coordinator\'s entries name their sources and artifacts')
  const values = bindings.flowValues('t:real', reachedFlow(), {form: 'flow', page, refusal: null}, [])
  assert.match(String(values.title), /Factory original development Run/)
  assert.equal(values.template, 'v0.4')
})

// ─────────────────────────────────────────────────────────────────────────────────────────────────── the Document

test('the Document draws an open Flow\'s template, title and save state from its owners, and nothing the design defaults', () => {
  bindings.resetHolds()
  const binding = bindings.documentBinding('central:document', reachedFlow(), flowMaterial)
  const v = binding.values
  assert.deepEqual([v.light, v.template, v.title, v.tabTitle, v.dirty], ['lit', 'flow', DOC.meta.title, 'Flow · flow-2026-10-03-1432', false])
  assert.equal(v.outcome, 'saved', 'no save yet, and the page holds nothing its owner does not: Saved')
  assert.equal(v.flowView, 'dialogue')
  assert.deepEqual(JSON.parse(v.entries).map(entry => [entry.by, entry.hl ?? false, entry.note ?? false]), [['C', false, false], ['C', false, false], ['C', true, true], ['F', false, false], ['F', false, false]])
  assert.equal(JSON.parse(v.entries)[0].head, 'This is the continuation Flow for the existing Factory development Run.', 'an entry\'s first sentence')
  assert.deepEqual([v.highlights, v.notes], [1, 2])
  assert.deepEqual(JSON.parse(v.packet), [{entry: 4, scope: 'selection', text: 'Which unit starts first?'}])
  assert.deepEqual(JSON.parse(v.journal), ['Tue 13 Oct', 'Thu 15 Oct'].map(day => day), 'the journal\'s pages by their civil day')
  for (const key of ['ground', 'layout', 'pinned', 'agentWrites', 'autosave', 'face', 'date']) assert.equal(v[key], undefined, `${key}: no owner reports it`)
  assert.equal(v.view, 'page', 'Page or Source is the view\'s own, at Page')
  // The edited and refused standings, from the face's own facts.
  const edited = bindings.documentBinding('central:document', reachedFlow({...FLOW_DOOR, dirty: true, state: 'edited since save'}), flowMaterial)
  assert.equal(edited.values.dirty, true)
  const stale = bindings.documentBinding('central:document', pageDevices.reachedPageOf({...FLOW_DOOR, dirty: true, outcome: 'stale', state: 'stale — the native source moved'}, null), flowMaterial)
  assert.equal(stale.values.outcome, 'stale')
  for (const key of ['title', 'template', 'flowView', 'pinned', 'agentWrites', 'autosave', 'clear']) assert.ok(binding.standing[key].disabled.length > 20, `${key} stands disabled with its reason`)
})

test('Save and Re-read are the hosted face\'s own acts; a refused key is refused in its own words, never written', async () => {
  bindings.resetHolds()
  const calls = []
  const door = {...FLOW_DOOR, save: () => calls.push('save'), reread: () => calls.push('reread')}
  const binding = bindings.documentBinding('central:document', reachedFlow(door), flowMaterial)
  await binding.write([{key: 'save', value: true}])
  await binding.write([{key: 'reread', value: true}])
  assert.deepEqual(calls, ['save', 'reread'])
  await assert.rejects(() => binding.write([{key: 'flowView', value: 'journal'}]), /meta\.view/)
  await assert.rejects(() => binding.write([{key: 'clear', value: true}]), /packet/)
  assert.equal(binding.writes('dirty'), false, 'a pure reading is the host\'s to refuse')
  // A face that has not answered: Save stands disabled with the reason, and a press is refused in it.
  const waiting = bindings.documentBinding('central:document', reachedFlow({...FLOW_DOOR, save: undefined}), flowMaterial)
  assert.match(waiting.standing.save.disabled, /not answered its first read/)
  await assert.rejects(() => waiting.write([{key: 'save', value: true}]), /not answered its first read/)
  // The view's own keys never reach an owner.
  binding.local.view('source')
  assert.equal(bindings.heldOf('central:document').view, 'source')
  assert.equal(bindings.documentBinding('central:document', reachedFlow(door), flowMaterial).values.view, 'source')
})

test('a Day page: its face and date where it is the Day device\'s document, and its own marks, notes and packet; another Day reads as its door', () => {
  bindings.resetHolds()
  const door = {key: 'day:t', paneId: 'pane-day', form: 'Day', title: 'day-document:2026-10-16', state: 'as read', save: () => {}, reread: () => {}}
  const payload = {meta: {face: 2}, fields: {p3_observations: '<p>The <mark>first</mark> line.</p>'}, notes: [{field: 'p3_observations', anchor: 'first', text: 'Why first?'}],
    packet: [{field: 'p1_must', label: 'Must', text: 'Ship it'}], capture: [], sessions: []}
  const same = {form: 'day', page: readings.readDayPage(payload), face: 2, date: 'Fri 16 Oct', refusal: null}
  const v = bindings.documentValues('central:document', pageDevices.reachedPageOf(door, '2026-10-16'), same)
  assert.deepEqual([v.template, v.title, v.face, v.date, v.tabTitle, v.highlights, v.notes, v.light], ['day', '', 2, 'Fri 16 Oct', 'Day · 2026-10-16', 1, 1, 'lit'])
  assert.deepEqual(JSON.parse(v.packet), [{entry: 1, scope: 'Must', text: 'Ship it'}])
  const other = bindings.documentValues('central:document', pageDevices.reachedPageOf(door, null), {form: 'day', page: null, face: null, date: null, refusal: null})
  assert.deepEqual([other.template, other.face, other.date, other.light, other.tabTitle], ['day', undefined, undefined, undefined, 'Day'])
})

// ─────────────────────────────────────────────────────────────────────────────────────────────────── the Flow

test('the Flow draws its entries and people from the page, its roster from Central\'s accepted agents, and its next entry\'s hand at the manual\'s defaults', () => {
  bindings.resetHolds()
  const roster = [{ref: 'agent/central-guardian', name: 'Central Guardian', accepted: true}, {ref: 'codex:01a0', name: 'Factory coordinator', accepted: true}, {ref: 'agent/x', name: 'X', accepted: false}]
  const v = bindings.flowValues('central:flow-document', reachedFlow(), flowMaterial, roster)
  assert.deepEqual([v.light, v.title, v.template, v.plural, v.media, v.view, v.revision, v.state, v.lastSave], ['lit', DOC.meta.title, 'v0.4', true, 0, 'dialogue', 8, 'saved', ''])
  assert.deepEqual(JSON.parse(v.people), [{initial: 'C', name: 'Factory coordinator', kind: 'agent', basis: 'declared'}, {initial: 'F', name: 'You', kind: 'person', basis: 'unknown'}])
  const entries = JSON.parse(v.entries)
  assert.deepEqual(entries.map(entry => [entry.by, entry.rel ?? null, entry.src ?? 0, entry.art ?? 0]), [
    ['C', null, 2, 1], ['C', null, 0, 0], ['C', null, 0, 0], ['F', {type: 'reply', to: [3]}, 0, 0], ['F', {type: 'branch', to: [2]}, 0, 0]])
  assert.match(entries[0].at, /^\d\d:\d\d$/, 'each entry at its clock time')
  assert.deepEqual(JSON.parse(v.roster), [{id: 'agent/central-guardian', name: 'Central Guardian'}], 'accepted agents not already in the Flow')
  assert.deepEqual([v.entry, v.relation, v.speaker, v.page, v.bring], [0, 'reply', 'F', 2, 'agent/central-guardian'], 'New, Reply, the person, the last page')
  for (const key of ['view', 'upgraded']) assert.ok(bindings.flowBinding('central:flow-document', reachedFlow(), flowMaterial, roster, null).standing[key].disabled)
  assert.ok(bindings.flowBinding('central:flow-document', reachedFlow(), flowMaterial, roster, null).standing['in:agent/central-guardian'].disabled, 'bringing an agent in is the page\'s own act')
  // A refused read: dark, and nothing drawn from the page.
  const refused = bindings.flowValues('central:flow-document', reachedFlow(), {form: 'flow', page: null, refusal: 'Central refused the read'}, null)
  assert.deepEqual([refused.light, refused.entries, refused.people, refused.title], ['dark', undefined, undefined, undefined])
})

/** A fake owner behind a stubbed kernel bridge: it holds one Flow file and checks the CAS the way central.files.write does
 * (file_operation write with the expected revision; a moved revision is a conflict). FIXTURE, not a capture. */
function fakeFlowOwner({conflict = false} = {}) {
  const state = {html: island(DOC), revision: 1}
  const sent = []
  const respond = outcome => ({json: async () => ({ok: true, outcome})})
  const fetch = async (_url, init) => {
    const body = JSON.parse(init.body)
    sent.push(body)
    if (body.op === 'file_read') return respond({result: 'file_read', reading: {location: LOCATION, content: state.html, revision: `rev-${state.revision}`}})
    if (body.op === 'file_operation' && body.request.action === 'write') {
      if (conflict || body.request.expected_revision !== `rev-${state.revision}`) return respond({result: 'file_operation', data: {outcome: 'conflict', current: {revision: `rev-${state.revision + 1}`}}})
      state.html = body.request.content
      state.revision++
      return respond({result: 'file_operation', data: {outcome: 'written', revision: `rev-${state.revision}`}})
    }
    return {json: async () => ({ok: false, error: `unexpected op ${body.op}`})}
  }
  return {fetch, sent, state}
}
async function withOwner(owner, run) {
  const real = globalThis.fetch
  globalThis.fetch = owner.fetch
  try { return await run() } finally { globalThis.fetch = real }
}
const bridge = {kind: 'bridge', url: 'http://owner.fixture'}

test('the Flow\'s next entry is the person\'s, appended through the Flow\'s own revision-checked write, connected to the entry it answers', async () => {
  bindings.resetHolds()
  const owner = fakeFlowOwner()
  const writers = {append: entry => writes.appendFlowEntry(bridge, LOCATION, entry)}
  const binding = bindings.flowBinding('central:flow-document', reachedFlow(), flowMaterial, [], writers)
  // The widget's compose: the line, by the person, replying to entry 3 (central__flow-document.tsx append).
  await withOwner(owner, () => binding.write([{key: 'extra', value: JSON.stringify([{by: 'F', at: '10:00', head: 'Start with the first unit.', rel: {type: 'reply', to: [3]}}])}]))
  const writesSent = owner.sent.filter(body => body.op === 'file_operation')
  assert.equal(writesSent.length, 1, 'one write')
  assert.equal(writesSent[0].request.expected_revision, 'rev-1', 'checked against the revision it read')
  const after = parseInstance(owner.state.html)
  const added = after.entries.at(-1)
  assert.equal(after.entries.length, 6)
  assert.equal(added.author, 'F')
  assert.equal(added.authorKey, 'p-f')
  assert.match(added.html, /Start with the first unit\./)
  assert.deepEqual(added.relations.map(relation => [relation.type, relation.entryId]), [['reply', 'e3']])
  assert.equal(after.meta.revision, 9, 'the page\'s own counter moves by one')
})

test('the Flow refuses in words: an agent\'s entry, a page holding a draft, a moved file — and writes nothing', async () => {
  bindings.resetHolds()
  const owner = fakeFlowOwner()
  const writers = {append: entry => writes.appendFlowEntry(bridge, LOCATION, entry)}
  const line = by => JSON.stringify([{by, at: '10:00', head: 'A line.'}])
  await withOwner(owner, async () => {
    await assert.rejects(() => bindings.flowBinding('t', reachedFlow(), flowMaterial, [], writers).write([{key: 'extra', value: line('C')}]), /agent's entry comes from the agent/)
    await assert.rejects(() => bindings.flowBinding('t', reachedFlow({...FLOW_DOOR, dirty: true}), flowMaterial, [], writers).write([{key: 'extra', value: line('F')}]), /holds edits its owner does not/)
    await assert.rejects(() => bindings.flowBinding('t', reachedFlow(), flowMaterial, [], writers).write([{key: 'view', value: 'journal'}]), /meta\.view/)
    await assert.rejects(() => bindings.flowBinding('t', reachedFlow(), flowMaterial, [], writers).write([{key: 'in:agent/central-guardian', value: true}]), /joins on the page itself/)
  })
  assert.equal(owner.sent.filter(body => body.op === 'file_operation').length, 0, 'nothing was written')
  const moved = fakeFlowOwner({conflict: true})
  await withOwner(moved, () => assert.rejects(() => bindings.flowBinding('t', reachedFlow(), flowMaterial, [], writers).write([{key: 'extra', value: line('F')}]), /moved while the entry was written/))
  assert.equal(parseInstance(moved.state.html).entries.length, 5, 'a conflict overwrites nothing')
})

// ─────────────────────────────────────────────────────────────────────────────────────────────────── the effects

test('Text reads each paragraph\'s style and each word\'s emphasis from the page\'s own tags; size and selection are absent, and every write is the page\'s', async () => {
  const binding = bindings.textBinding('central:text', reachedFlow(), flowMaterial)
  const v = binding.values
  assert.deepEqual(JSON.parse(v.styles), {2: 'head', 3: 'quote'})
  assert.deepEqual(JSON.parse(v.marks), {'2:6': 'b', '2:8': 'i', '5:4': 's'}, '"installed" bold, "Omarchy." italic, "fails" struck')
  assert.equal(JSON.parse(v.entries)[1].head, 'The repaired image It has been installed on Omarchy.')
  for (const key of ['size', 'entry', 'from', 'to']) assert.equal(v[key], undefined, `${key} is absent`)
  await assert.rejects(() => binding.write([{key: 'styles', value: '{}'}]), /set on the page/)
})

test('Highlight reads one letter for each word — y where the page\'s <mark> covers it — and the template\'s one colour', () => {
  const v = bindings.highlightBinding('central:highlight', reachedFlow(), flowMaterial).values
  assert.equal(v.colour, 'yellow')
  assert.equal(v.flow, 'flow-2026-10-03-1432')
  const rows = String(v.marks).split('|')
  assert.equal(rows.length, 5)
  assert.equal(rows[2], '....yy', 'entry 3: "remains incomplete." marked')
  const entries = JSON.parse(v.entries)
  entries.forEach((entry, e) => assert.equal(entry.text.split(/\s+/).filter(Boolean).length, rows[e].length, `entry ${e + 1}: one letter for each word`))
  for (const key of ['show', 'pen', 'tool', 'passage']) assert.equal(v[key], undefined)
})

test('Notes reads the page\'s notes in the design\'s own shape, against the whole words of each entry', () => {
  bindings.resetHolds()
  const v = bindings.notesBinding('central:notes', reachedFlow(), flowMaterial).values
  const notes = JSON.parse(v.notes)
  assert.deepEqual(notes.map(note => [note.id, note.entry, note.anchor, note.timing, typeof note.at, note.replies]), [
    ['n1', 3, 'remains incomplete', 'during', 'string', ['Omarchy first.']], ['n2', null, null, 'after', 'string', []]])
  assert.ok(JSON.parse(v.entries)[2].head.includes('remains incomplete'), 'the quoted passage stands in its entry: no "anchor not found"')
  assert.deepEqual([v.open, v.order, v.listPage, v.name], [3, 'place', 0, 'flow-2026-10-03-1432'], 'the page\'s open entry to begin with')
  for (const key of ['timing', 'anchor', 'show']) assert.equal(v[key], undefined)
})

test('Beings and Things read an oi.page/v1 page\'s ties on the shared keys; no page, a dark light', () => {
  const blank = {profile: 'oi.page/v1', meta: {documentId: null, created: null, title: '', revision: 0, family: 'things', template: 'oi.template/things', templateVersion: '0.1.0', sourceMode: 'authored'},
    bindings: {worldRef: null, subjectRef: null, categories: ['C2'], expressionRef: null, sources: [{ref: 'Work/Archetypal-Earth/public/data/field.json', revision: 'sha256:abc'}]},
    appearance: {layout: 'editorial', tone: 'paper'}, page: {subtitle: '', introduction: '', sections: [{id: 'section-1', heading: '', text: ''}], links: [], expression: null}, notes: [], extensions: {}}
  const v = bindings.pageValues(blank)
  assert.deepEqual([v.light, v.title, v.template, v.world, v.o1, v.o2, v.layout, v.ground, v.sections, v.links], ['lit', '', 'Things v0.1.0', '', false, true, 'editorial', 'paper', 1, 0])
  assert.deepEqual(JSON.parse(v.sources), [{name: 'field.json', ref: 'Work/Archetypal-Earth/public/data/field.json', rev: 'sha256:abc'}])
  for (const key of ['worlds', 'subjects', 'expressions', 'places', 'anchors', 'place', 'anchor']) assert.equal(v[key], undefined)
  assert.deepEqual(bindings.pageValues(null), {light: 'dark'})
  assert.ok(bindings.beingsBinding('central:beings', blank).standing.addSource.disabled)
})

test('the Workspace reads the book: its name, project, open mode, each mode\'s pane tree and set, the rail; the mode turns and the name changes through the book', async () => {
  bindings.resetHolds()
  const workspace = {id: 'w1', name: 'O-I', project: 'O-I', lastVisitedAt: Date.now() - 2 * 86_400_000, widgets: {open: ['device:central:day-die', 'packet']},
    sets: [{mode: 'base', name: 'Reading'}, {mode: 'base', name: 'Older'}],
    layout: {mode: 'base', focusedGroupId: 'g1', surfaces: {s1: {title: 'Day', kind: 'projection.central-document'}, s2: {title: 'Earth', kind: 'projection.atlas'}},
      root: {type: 'split', id: 'r', dir: 'h', weights: [3, 2], children: [{type: 'group', id: 'g1', tabs: ['s1'], pinned: ['s1'], active: 's1'}, {type: 'group', id: 'g2', tabs: ['s2'], pinned: [], active: 's2'}]}},
    modeLayouts: {factory: {root: {type: 'group', id: 'f', tabs: ['x'], pinned: [], active: 'x'}, surfaces: {x: {title: 'Desk'}}}}}
  const calls = []
  const binding = bindings.workspaceBinding('central:workspace', workspace, Date.now(), {switchMode: mode => calls.push(['mode', mode]), rename: name => calls.push(['name', name])})
  const v = binding.values
  assert.deepEqual([v.light, v.name, v.folder, v.mode, v.mem, v.fresh, v.widgets, v.visited], ['lit', 'O-I', 'O-I', 'base', 'base,factory', false, 2, '2 d ago'])
  assert.deepEqual(JSON.parse(v.trees), {
    base: {t: 's', dir: 'h', w: [3, 2], kids: [{t: 'g', tabs: 1, pinned: 1, title: 'Day', focus: true, instrument: false}, {t: 'g', tabs: 1, pinned: 0, title: 'Earth', focus: false, instrument: true}]},
    factory: {t: 'g', tabs: 1, pinned: 0, title: 'Desk', focus: false, instrument: false},
  })
  assert.deepEqual(JSON.parse(v.sets), {base: 'Reading'}, 'the newest set of each mode')
  for (const key of ['kind', 'place', 'keepPanes', 'rememberIn', 'onLaunch', 'openIn', 'keepWhen', 'sendToDay', 'clips', 'folders', 'dirty']) assert.equal(v[key], undefined, `${key} is absent`)
  await binding.write([{key: 'mode', value: 'techne'}])
  await binding.write([{key: 'name', value: 'O-I shell'}])
  assert.deepEqual(calls, [['mode', 'techne'], ['name', 'O-I shell']])
  await assert.rejects(() => binding.write([{key: 'launch', value: true}]), /the one open/)
  assert.deepEqual(bindings.workspaceValues('central:workspace', null, Date.now()), {}, 'no book: nothing read')
})

// ─────────────────────────────────────────────────────────────────────────────────────────────────── the place on the chain

test('placement (DLW §16.2): the Flow first on a reached Flow\'s chain, then the Document and the effects, before the agent that answers', () => {
  const ids = placement => chain.placedFaces(central.faces, placement).map(face => face.id)
  // Lane BC3: the Packet ends a reached document's chain (§18.9 "after Notes"); the agent that answers stands with its identity before
  // it (§18.15) and its Context & world after it (§18.14), then Search (§18.11).
  const agent = ['agent-identity', 'nara-conversation', 'context-world', 'search', 'ground-hygiene', 'impact']
  assert.deepEqual(ids({form: 'Flow', book: true}), ['day-die', 'workspace', 'flow-document', 'document', 'text', 'highlight', 'notes', 'packet', ...agent])
  assert.deepEqual(ids({form: 'Day', book: false}), ['day-die', 'document', 'packet', ...agent])
  assert.deepEqual(ids({form: null, book: false}), ['day-die', ...agent])
  assert.deepEqual(ids(undefined), ids({form: null, book: false}))
})

// ─────────────────────────────────────────────────────────────────────────────────────────────────── the designs draw the readings

const html = element => renderToStaticMarkup(element)
const props = binding => ({v: binding.values, owner: binding.values, set: () => {}, nav: {}, page: '', setPage: () => {}, standing: binding.standing})
const VIEWS = ['folded', 'compact', 'whole', 'widget']

test('each design draws its five views on the binding — the Document an open Flow\'s template, title and save state; the Flow its entries and people', () => {
  bindings.resetHolds()
  const roster = [{ref: 'agent/central-guardian', name: 'Central Guardian', accepted: true}]
  const all = {
    [bindings.DOCUMENT_DESIGN]: bindings.documentBinding('central:document', reachedFlow(), flowMaterial),
    [bindings.FLOW_DESIGN]: bindings.flowBinding('central:flow-document', reachedFlow(), flowMaterial, roster, null),
    [bindings.TEXT_DESIGN]: bindings.textBinding('central:text', reachedFlow(), flowMaterial),
    [bindings.HIGHLIGHT_DESIGN]: bindings.highlightBinding('central:highlight', reachedFlow(), flowMaterial),
    [bindings.NOTES_DESIGN]: bindings.notesBinding('central:notes', reachedFlow(), flowMaterial),
  }
  for (const [id, binding] of Object.entries(all)) {
    for (const view of [...VIEWS, 'full']) assert.doesNotThrow(() => html(createElement(() => DESIGNS[id][view](props(binding)))), `${id} ${view} draws`)
  }
  const whole = html(createElement(() => DESIGNS[bindings.DOCUMENT_DESIGN].whole(props(all[bindings.DOCUMENT_DESIGN]))))
  assert.match(whole, /Flow v0\.4/, 'the template')
  assert.match(whole, /Factory original development Run/, 'the title')
  assert.match(whole, />saved</, 'the save state')
  const flowWhole = html(createElement(() => DESIGNS[bindings.FLOW_DESIGN].whole(props(all[bindings.FLOW_DESIGN]))))
  assert.match(flowWhole, /Factory coordinator/, 'the people')
  assert.match(flowWhole, /You/)
  assert.match(flowWhole, />5</, 'five entries')
  const widget = html(createElement(() => DESIGNS[bindings.FLOW_DESIGN].widget(props(all[bindings.FLOW_DESIGN]))))
  assert.match(widget, /What if the image fails breaks\?/, 'the last entries')
})

// ─────────────────────────────────────────────────────────────────────────────────────────────────── the Answer

const answer = await import('../src/central/devices/answerBinding.ts')
const ANSWER = await panel('nara-conversation')

test('the Answer is wired on every key, and draws the bound session\'s exchange as the Agent and the Thread draw it (lane BF2\'s rows, one read)', async () => {
  bindings.resetHolds()
  for (const key of Object.keys(ANSWER.fixtures['No readings'])) assert.ok(answer.ANSWER_WIRING.keys.includes(key), `"${key}" is wired`)
  for (const key of answer.ANSWER_WIRING.keys) {
    const table = answer.ANSWER_WIRING
    assert.ok([table.reads, table.writes, table.local, table.refused, table.absent].some(t => key in t), `"${key}" placed`)
  }
  assert.equal(designKey('central', 'nara-conversation'), ANSWER.id)
  const roster = [{ref: 'agent/nara', name: 'Nara', accepted: true, role: 'nara', purpose: 'Answers in this Expression.'}, {ref: 'agent/x', name: 'X', accepted: false}]
  const observed = {status: {state: 'Resident'}, reading: {blocks: [{id: 1, kind: 'user', text: 'Which unit starts first?'}, {id: 2, kind: 'assistant', text: 'The first, once the image is repaired.'}], permissions: []}}
  const sent = []
  const input = {nara: {state: 'bound', session: 'session:fixture', resume: false}, observed, roster, page: {title: 'Flow · flow-2026-10-03-1432', packet: '[]'}}
  const binding = answer.answerBinding('central:nara-conversation', input, {bind: async () => {}, send: async text => { sent.push(text) }})
  const v = binding.values
  assert.deepEqual([v.light, v.agent, v.state, v.document, v.resume, v.draft], ['lit', 'agent/nara', 'idle', 'Flow · flow-2026-10-03-1432', false, ''])
  assert.deepEqual(JSON.parse(v.thread).map(row => [row.kind, row.text]), [['you', 'Which unit starts first?'], ['agent', 'The first, once the image is repaired.']])
  assert.deepEqual(JSON.parse(v.agents).map(agent => agent.id), ['agent/nara'], 'accepted agents only')
  for (const key of ['answerAs', 'writes', 'effort', 'context', 'entry', 'sources']) assert.equal(v[key], undefined, `${key}: no owner reports it`)
  await binding.write([{key: 'sent', value: 'And then?'}])
  assert.deepEqual(sent, ['And then?'], 'the question goes to the session\'s own Send')
  await assert.rejects(() => binding.write([{key: 'accept', value: true}]), /consent request/)
  // Not bound: dark, no thread, Send disabled with the reason.
  const unbound = answer.answerBinding('central:nara-conversation', {...input, nara: {state: 'unbound', session: null}, observed: undefined}, {bind: null, send: null})
  assert.deepEqual([unbound.values.light, unbound.values.thread], ['dark', undefined])
  assert.match(unbound.standing.sent.disabled, /not bound/)
  await assert.rejects(() => unbound.write([{key: 'light', value: 'lit'}]), /No conversation is selected/)
  const props = b => ({v: b.values, owner: b.values, set: () => {}, nav: {}, page: '', setPage: () => {}, standing: b.standing})
  for (const view of [...VIEWS, 'full']) assert.doesNotThrow(() => html(createElement(() => ANSWER[view](props(binding)))), `Answer ${view} draws`)
})
