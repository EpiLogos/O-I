// Lane BC3: Central's agent chain — the catalogue's Packet (§18.9), Search (§18.11), Context & world (§18.14) and Agent identity
// (§18.15) designs (inhabitants/catalogue/panels/central__*.tsx) bound by central/devices/{packetBinding, searchBinding,
// contextWorldBinding, identityBinding}.ts over the owners the shell already reads, placed on Central's chain by CentralDevices.tsx;
// the Answer's packet (answerBinding.ts); and a reached Day's face and date by the document its face names on the door
// (pageDevices.ts dayPageOf). The Answer's own keys are lane BC2's test (central-page-family-binding.test.mjs).
// Channels: SCRIPTED (pure bindings over fixtures shaped as the owners' real answers, kept in the lane's scratch: aikit.prepared-
// context/v1 from op encounter context read, KnowledgeHit from `aikit knowledge search`, central.agent-profile-roster/v1 from op
// agent_definition roster, oi.human-agent-card/v1 from op agent_card, oi.central-ground/v1 `sources` from op central inspect);
// SCRIPTED against a FAKE OWNER (a stubbed kernel bridge holding one prepared context and answering op encounter context edit as
// AIKit does) for Take out; SSR of each design's views on the binding's values. Every write goes to a fixture; nothing reaches the
// owner's real ground. Not a screen pass: the native legs are the lead's.
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

const holds = await import('../src/central/devices/pageBindings.ts')
const packet = await import('../src/central/devices/packetBinding.ts')
const search = await import('../src/central/devices/searchBinding.ts')
const world = await import('../src/central/devices/contextWorldBinding.ts')
const identity = await import('../src/central/devices/identityBinding.ts')
const answer = await import('../src/central/devices/answerBinding.ts')
const chain = await import('../src/central/devices/agentChainDevices.ts')
const pageDevices = await import('../src/central/devices/pageDevices.ts')
const model = await import('../src/central/devices/centralDeviceModel.ts')
const writes = await import('../src/central/devices/centralDeviceWrites.ts')
const {civilDayName} = await import('../src/central/devices/dayBinding.ts')
const {PREPARED_CONTEXT_CHANGED} = await import('../../../../desktop/cradle/src/context/nativeContext.ts')
const {designKey} = await import('../src/frame/devices/designs.ts')
const {inhabitantManifest, validateInhabitantManifest} = await import('../src/inhabitants/manifest.ts')
const {loadWorldShellFamilies} = await import('../src/inhabitants/worldShellFamilies.ts')
loadWorldShellFamilies()
const central = inhabitantManifest('central')
const panel = name => import(`../src/inhabitants/catalogue/panels/central__${name}.tsx`).then(module => module.design)
const DESIGNS = {
  [packet.PACKET_DESIGN]: await panel('packet'), [search.SEARCH_DESIGN]: await panel('search'),
  [world.CONTEXT_WORLD_DESIGN]: await panel('context-world'), [identity.IDENTITY_DESIGN]: await panel('agent-identity'),
}
const ANSWER = await panel('nara-conversation')
const WIRINGS = [packet.PACKET_WIRING, search.SEARCH_WIRING, world.CONTEXT_WORLD_WIRING, identity.IDENTITY_WIRING]

const html = element => renderToStaticMarkup(element)
const props = binding => ({v: binding.values, owner: binding.values, set: () => {}, nav: {}, page: '', setPage: () => {}, standing: binding.standing})
const VIEWS = ['folded', 'compact', 'whole', 'full', 'widget']
const parse = value => JSON.parse(value)

// ─────────────────────────────────────────────────────────────────────────────────────────────────── the wiring

/** A design key the wiring holds: by name, or by its pattern (`r:<id>` holds `r:doc`). */
const wired = (wiring, key) => wiring.keys.includes(key) || wiring.keys.some(pattern => pattern.includes(':<') && key.startsWith(pattern.slice(0, pattern.indexOf('<'))))

test('every key of the four designs is wired: a reading, a write, the view\'s own, refused with its reason, or absent with its reason', () => {
  for (const wiring of WIRINGS) {
    const design = DESIGNS[wiring.design]
    assert.ok(design, `${wiring.design}: the catalogue holds the design`)
    assert.equal(design.id, wiring.design)
    for (const key of [...Object.keys(design.fixtures['No readings']), ...Object.keys(design.defaults)]) assert.ok(wired(wiring, key), `${wiring.design}: the design's key "${key}" is wired`)
    for (const key of wiring.keys) {
      const placed = [wiring.reads, wiring.writes, wiring.local, wiring.refused, wiring.absent].some(table => key in table)
      assert.ok(placed, `${wiring.design}: "${key}" is read, written, held, refused or absent`)
    }
    for (const [key, why] of Object.entries({...wiring.refused, ...wiring.absent})) assert.ok(why.length > 20, `${wiring.design}: "${key}" says why in words`)
  }
  // The acts each design presses are its keys too (central__packet.tsx: capture, clear, answer, takeOut).
  for (const act of ['capture', 'clear', 'answer', 'takeOut']) assert.ok(packet.PACKET_WIRING.keys.includes(act), `the Packet's act "${act}" is wired`)
})

test('each device is published under the id its design draws, from a face the family declares', () => {
  const faces = {packet: 'device-audio-fx', search: 'device-instrument', 'context-world': undefined, 'agent-identity': undefined}
  for (const [face, semantic] of Object.entries(faces)) {
    const declared = central.faces.find(candidate => candidate.id === face)
    assert.ok(declared, `the family declares ${face}`)
    if (semantic) assert.equal(declared.liveSemantic, semantic, `${face}: ${semantic}`)
    const device = model.centralDevice(declared, {})
    assert.equal(designKey(device.family, device.face.id), `central:${face}`)
    assert.ok(DESIGNS[`central:${face}`], `the catalogue's design central:${face}`)
  }
  assert.deepEqual([chain.PACKET_DEVICE_ID, chain.SEARCH_DEVICE_ID, chain.IDENTITY_DEVICE_ID, chain.CONTEXT_WORLD_DEVICE_ID],
    ['central:packet', 'central:search', 'central:agent-identity', 'central:context-world'])
  assert.deepEqual([...validateInhabitantManifest(central)], [], 'the composed manifest validates with the agent chain declared')
  // REPLACED (R4): "the Packet ends a reached document's chain" — the Packet leads a workspace's chain, reached document or not (§16.2
  // "The packet, the agent that answers, and its scope"); r4-chains.test.mjs holds the order.
  assert.equal(model.CENTRAL_WORKSPACE_FACES[0], 'packet', 'the Packet leads a workspace\'s chain')
})

// ─────────────────────────────────────────────────────────────────────────────────────────────────── the Packet

const SESSION = 'agent-session/o-i-chat-1791392815-b898'
const TEXT = 'The original development Run remains incomplete.'
const PAGE = '<html lang="en"><head><meta charset="utf-8"><title>Things</title></head><body>' + '<div>A thing on the page, observed. </div>'.repeat(40) + '</body></html>'
// Shaped as the owner's answer (op encounter context read: aikit.prepared-context/v1): a text selection of a Flow and an element the
// page observed (anchor kind observation, its text the element's HTML). FIXTURE, not a capture.
const TEXT_ITEM = {id: 'blake3:da4fed18', canonical_expression: '@ central:path:/ground:Control/user/flows/flow-2026-10-03-1432.html', expression: {node: 'address'},
  selection: {anchor: {kind: 'text', start: 120, end: 120 + TEXT.length}, binding_id: 'b-1', captured_at: '2026-10-16T09:12:00Z', owner: 'Central', source_project: 'O-I',
    source_ref: 'central:path:/ground:Control/user/flows/flow-2026-10-03-1432.html', source_revision: null, text: TEXT, title: 'flow-2026-10-03-1432.html', working_copy: false}}
const OBSERVED_ITEM = {id: 'blake3:74f41891', canonical_expression: '@ central:path:/ground:Work/O-I/desktop/cradle/documents/oi-things.html', expression: {node: 'address'},
  selection: {anchor: {kind: 'observation', document_id: '95469075', key: '66ccc6b3', role: 'div', selector: 'div > div:nth-of-type(2)', node_ref: null, url: null},
    binding_id: 'b-2', captured_at: '2026-09-22T14:22:17Z', owner: 'Central', source_project: 'O-I', source_ref: 'central:path:/ground:Work/O-I/desktop/cradle/documents/oi-things.html',
    source_revision: null, text: PAGE, title: 'oi-things.html', working_copy: false}}
const prepared = (items, session = SESSION, revision = 3) => ({schema: 'aikit.prepared-context/v1', scope: {project: 'O-I', agent_session: session}, revision,
  digest: 'blake3:d53d18c23212ea7b6300594bb89bce60218f6eff2b9d628b8cc42d3e79bbd5ab', items})
const OPEN = {actions: [{ref: 'aikit.encounter.prompt', enabled: true}, {ref: 'aikit.encounter.context', enabled: true}]}
const conversation = (draft = 'Which unit starts first?', extra = {}) => ({draft, busy: false, reading: OPEN, ...extra})

test('the Packet reads AIKit\'s prepared context: each item in order, with its size, its anchor in words, and the packet\'s scope', () => {
  holds.resetHolds()
  const v = packet.packetValues('central:packet', {reading: {context: prepared([TEXT_ITEM, OBSERVED_ITEM])}, companion: 'Fizz', bound: true, conversation: conversation()})
  assert.equal(v.light, 'lit')
  const items = parse(v.packet)
  assert.deepEqual(items.map(item => [item.entry, item.scope, item.chars, item.label]),
    [[1, 'selection', TEXT.length, 'flow-2026-10-03-1432.html'], [2, 'observed element', PAGE.length, 'oi-things.html']])
  assert.equal(items[0].text, TEXT)
  assert.equal(items[1].text.length, packet.PACKET_TEXT_SHOWN, 'a long item shows how it opens; chars keeps its whole size')
  assert.equal(items[1].bytes, new TextEncoder().encode(PAGE).length, 'the Answer\'s size is the item\'s UTF-8 bytes')
  assert.equal(v.flow, undefined, 'two sources: no one Flow they were gathered from')
  assert.deepEqual([v.scope, v.limit, v.keep, v.question, v.rowsPage], ['session', packet.PACKET_LIMIT_OFF, false, 'written', 0])
  for (const key of ['add', 'selection', 'hasPage', 'sent']) assert.equal(v[key], undefined, `${key}: no owner reports it`)
  // One source, the project's packet, an empty composer.
  const one = packet.packetValues('central:packet', {reading: {context: prepared([TEXT_ITEM], null)}, companion: 'Fizz', bound: false, conversation: conversation('')})
  assert.deepEqual([one.flow, one.scope, one.question], ['flow-2026-10-03-1432.html', 'project', 'none'])
  // Refused: dark, and no list drawn.
  const refused = packet.packetValues('central:packet', {reading: {error: 'AIKit is unavailable'}, companion: 'Fizz', bound: false})
  assert.deepEqual([refused.light, refused.packet, refused.question], ['dark', undefined, undefined])
  // Not yet read: no light at all (the owner has not said).
  assert.equal(packet.packetValues('central:packet', {reading: null, companion: 'Fizz', bound: false}).light, undefined)
})

test('the Packet\'s acts go through their owners: Take out and Clear now edit the prepared context, Answer this is the conversation\'s Send', async () => {
  holds.resetHolds()
  const edits = [], sends = []
  const ports = {edit: async mutation => { edits.push(mutation) }, send: async () => { sends.push(true) }}
  const input = {reading: {context: prepared([TEXT_ITEM, OBSERVED_ITEM])}, companion: 'Fizz', bound: true, conversation: conversation()}
  const binding = packet.packetBinding('central:packet', input, ports)
  // The design names an item by its place and entry (central__packet.tsx itemOf `${at}:${entry}`); the owner by its id.
  await binding.write([{key: 'takeOut', value: '1:2'}])
  await binding.write([{key: 'clear', value: true}])
  await binding.write([{key: 'answer', value: true}])
  assert.deepEqual(edits, [{operation: 'remove', id: OBSERVED_ITEM.id}, {operation: 'clear'}])
  assert.equal(sends.length, 1, 'one Send, with exactly this packet')
  await assert.rejects(() => binding.write([{key: 'takeOut', value: '7:8'}]), /no longer in the packet/)
  assert.equal(binding.standing.answer, undefined, 'Answer this can press')
  // The unowned acts stand disabled with their reasons, and refuse in the same words.
  for (const [key, words] of [['capture', /does not cross the host bridge/], ['add', /What Capture takes has no owner/], ['limit', /holds no limit/], ['keep', /empties what a send submitted/]]) {
    assert.match(binding.standing[key].disabled, words, `${key}: disabled with its reason`)
    await assert.rejects(() => binding.write([{key, value: key === 'limit' ? 1000 : true}]), words)
  }
  await assert.rejects(() => binding.write([{key: 'flow', value: 'x'}]), /a reading/)
  assert.equal(edits.length, 2, 'a refused act writes nothing')
  // Answer this waits on the conversation, in its words (widgets/PacketWidget.tsx answerRefusal, ported).
  const why = extra => packet.packetBinding('central:packet', {...input, ...extra}, ports).standing.answer?.disabled
  assert.match(why({conversation: conversation('')}), /Write the question in Fizz's composer/)
  assert.match(why({bound: false}), /No Fizz conversation stands/)
  assert.match(why({conversation: conversation('Q', {busy: true})}), /busy/)
  assert.match(why({conversation: conversation('Q', {reading: {actions: [{ref: 'aikit.encounter.prompt', enabled: false, reason: 'the session is closed'}]}})}), /takes no prompt now: the session is closed/)
  assert.match(why({reading: {context: prepared([])}}), /The packet is empty/)
  assert.match(why({conversation: undefined}), /not answered its first read|not observed/)
  await assert.rejects(() => packet.packetBinding('central:packet', {...input, conversation: conversation('')}, ports).write([{key: 'answer', value: true}]), /Write the question/)
  assert.equal(sends.length, 1, 'a refused Answer this sends nothing')
  // No packet read: Take out and Clear now wait for it.
  const unread = packet.packetBinding('central:packet', {reading: null, companion: 'Fizz', bound: true}, {edit: null, send: null})
  assert.match(unread.standing.takeOut.disabled, /has not answered yet/)
  assert.match(unread.standing.clear.disabled, /has not answered yet/)
  const empty = packet.packetBinding('central:packet', {...input, reading: {context: prepared([])}}, ports)
  assert.equal(empty.standing.clear.disabled, 'The packet is empty.')
})

/** A fake owner behind a stubbed kernel bridge: it holds one prepared context and answers op encounter context edit as AIKit does
 * (the basis must be its revision; a remove takes the item out and moves the revision). FIXTURE, not a capture. */
function fakeContextOwner(context) {
  const state = {context}
  const sent = []
  const fetch = async (_url, init) => {
    const body = JSON.parse(init.body)
    sent.push(body)
    const request = body.request?.request
    if (body.op !== 'encounter' || body.request?.action !== 'context' || request?.operation !== 'edit') return {json: async () => ({ok: false, error: `unexpected op ${body.op}`})}
    if (request.basis !== state.context.revision) return {json: async () => ({ok: false, error: 'stale prepared-context basis'})}
    const items = request.mutation.operation === 'clear' ? [] : state.context.items.filter(item => item.id !== request.mutation.id)
    state.context = {...state.context, items, revision: state.context.revision + 1}
    return {json: async () => ({ok: true, outcome: {result: 'encounter_reading', data: state.context}})}
  }
  return {fetch, sent, state}
}

test('Take out reaches AIKit as op encounter context edit at the revision read, and the owner\'s answer is announced to every reader', async () => {
  const owner = fakeContextOwner(prepared([TEXT_ITEM, OBSERVED_ITEM]))
  const announced = []
  const realFetch = globalThis.fetch, realWindow = globalThis.window
  globalThis.fetch = owner.fetch
  globalThis.window = new EventTarget()
  globalThis.window.addEventListener(PREPARED_CONTEXT_CHANGED, event => announced.push(event.detail))
  try {
    const bridge = {kind: 'bridge', url: 'http://owner.fixture'}
    const context = owner.state.context
    const binding = packet.packetBinding('central:packet', {reading: {context}, companion: 'Fizz', bound: true, conversation: conversation()},
      {edit: mutation => writes.editPacket(bridge, context, mutation).then(() => {}), send: null})
    await binding.write([{key: 'takeOut', value: '0:1'}])
    assert.deepEqual(owner.sent, [{op: 'encounter', project: 'O-I', request: {action: 'context', agent_session: SESSION, request: {operation: 'edit', basis: 3, mutation: {operation: 'remove', id: TEXT_ITEM.id}}}}])
    assert.deepEqual(owner.state.context.items.map(item => item.id), [OBSERVED_ITEM.id], 'the owner took the item out')
    assert.equal(announced.length, 1)
    assert.deepEqual([announced[0].project, announced[0].value.revision, announced[0].value.items.length], ['O-I', 4, 1], 'every reader of the packet holds the owner\'s answer')
    // A second edit on the stale basis is the owner's refusal, in its words.
    await assert.rejects(() => binding.write([{key: 'clear', value: true}]), /stale prepared-context basis/)
    assert.equal(owner.state.context.items.length, 1, 'a refusal changes nothing')
  } finally {
    globalThis.fetch = realFetch
    if (realWindow === undefined) delete globalThis.window; else globalThis.window = realWindow
  }
})

test('the Answer shows the packet its Send carries — the Packet\'s, only when prepared for the Answer\'s own session', () => {
  holds.resetHolds()
  const items = packet.packetValues('central:packet', {reading: {context: prepared([TEXT_ITEM, OBSERVED_ITEM])}, companion: 'Fizz', bound: true}).packet
  const base = {nara: {state: 'bound', session: SESSION, resume: false}, roster: [], page: {title: 'Flow · flow-2026-10-03-1432'}}
  assert.equal(answer.answerValues('central:nara-conversation', {...base, packet: {items, session: SESSION}}).packet, items)
  assert.equal(answer.answerValues('central:nara-conversation', {...base, packet: {items, session: 'agent-session/another'}}).packet, undefined, 'another conversation\'s packet is not this answer\'s')
  assert.equal(answer.answerValues('central:nara-conversation', {...base, nara: {state: 'unbound', session: null}, packet: {items, session: null}}).packet, undefined)
  // The Answer draws each item by its label and its UTF-8 bytes as its size (central__nara-conversation.tsx Packet, sizeOf), though the
  // item's words show only how it opens.
  const full = html(createElement(() => ANSWER.full(props(answer.answerBinding('central:nara-conversation', {...base, packet: {items, session: SESSION}}, {bind: null, send: null})))))
  const kb = bytes => `${bytes < 10240 ? (bytes / 1024).toFixed(1) : Math.round(bytes / 1024)} KB`
  assert.match(full, /aria-label="Packet"/)
  assert.match(full, /oi-things\.html/, 'the item by its label')
  assert.match(full, new RegExp(`<small>${kb(new TextEncoder().encode(PAGE).length)}</small>`), 'the whole item\'s bytes, not the words shown')
})

// ─────────────────────────────────────────────────────────────────────────────────────────────────── Search

// Shaped as AIKit's answer (`aikit knowledge search -- ground`: KnowledgeHit; the resolution's rows). FIXTURE, not a capture.
const HITS = [
  {address: {kind: 'wiki', value: 'wiki:node:governance:consult-authored-ground'}, authority: 'authored', kind: 'knowledge-node', label: 'Consult authored ground',
    provider: 'provider/semantic-wiki/sqlite', resource: 'wiki:node:governance:consult-authored-ground', snippet: 'Read the authored ground before the code.'},
  {address: {kind: 'capability', value: 'capability:central-orient'}, authority: 'authored', kind: 'capability', label: 'central-orient',
    provider: 'provider/aikit/capabilities', resource: 'capability:central-orient', snippet: ''},
]
const ROWS = [
  {reference: 'capability:central-orient', kind: 'capability', label: 'central-orient', owner: 'AIKit', provenance: [], actions: []},
  {reference: 'project:O-I', kind: 'project', label: 'O-I', owner: 'Central', provenance: [], actions: []},
]

test('Search asks AIKit the line as typed, in your world or one project, and draws its answer in the owner\'s order', () => {
  holds.resetHolds()
  const id = 'central:search'
  assert.equal(search.searchQueryOf(id), null, 'nothing typed: nothing asked')
  holds.setHeld(id, 'query', '@stone = ( + @4 world:bollingen + doc:thing )')
  assert.equal(search.searchQueryOf(id), null, 'an alias being kept is no search')
  holds.setHeld(id, 'query', 'ground')
  assert.equal(search.searchQueryOf(id), 'ground')
  assert.equal(search.searchProjectOf(id), undefined, 'your world: no project')
  holds.setHeld(id, 'reach', 'project:O-I')
  assert.equal(search.searchProjectOf(id), 'O-I', 'a project reach asks op knowledge in that project')
  holds.setHeld(id, 'reach', undefined)
  // Before the owner answers: the line and the view's own choices; no light, no results.
  const before = search.searchValues(id, null, ['O-I', 'Archetypal-Earth'])
  assert.deepEqual([before.query, before.reach, before['k:agent'], before.limit, before.light, before.results], ['ground', 'control:root', true, search.SEARCH_LIMIT, undefined, undefined])
  assert.deepEqual(parse(before.projects), ['O-I', 'Archetypal-Earth'])
  // The search answers first (the resolution still pending): its hits stand.
  const searching = search.searchValues(id, {query: 'ground', hits: HITS, rows: [], pending: ['resolve']}, null)
  assert.equal(searching.light, 'lit')
  assert.deepEqual(parse(searching.results).map(hit => hit.ref), ['wiki:node:governance:consult-authored-ground', 'capability:central-orient'])
  // Both answered: the resolution's rows follow, each resource once, in the owner's order.
  const done = parse(search.searchValues(id, {query: 'ground', hits: HITS, rows: ROWS, pending: []}, null).results)
  assert.deepEqual(done, [
    {ref: 'wiki:node:governance:consult-authored-ground', title: 'Consult authored ground', kind: 'knowledge-node', says: 'Read the authored ground before the code.'},
    {ref: 'capability:central-orient', title: 'central-orient', kind: 'capability'},
    {ref: 'project:O-I', title: 'O-I', kind: 'project', owner: 'Central'},
  ])
  // An answer for an older line is not this line's.
  assert.equal(search.searchValues(id, {query: 'grou', hits: HITS, rows: [], pending: []}, null).results, undefined)
  // The owner's refusal: dark, said on the search line.
  const refusal = 'AIKit is unavailable: AIKit knowledge read did not return within 20 seconds'
  const refused = search.searchBinding(id, {query: 'ground', hits: [], rows: [], error: refusal, pending: []}, null)
  assert.equal(refused.values.light, 'dark')
  assert.equal(refused.values.results, undefined)
  assert.equal(refused.standing.query.refused, refusal)
})

test('Search writes nothing: its line, reach, kinds and pick are the view\'s own; a tag, the aliases, the fields and the limit refuse in words', async () => {
  holds.resetHolds()
  const binding = search.searchBinding('central:search', null, null)
  for (const key of ['query', 'reach', 'pick', 'k:person', 'k:power']) assert.equal(typeof binding.local[key], 'function', `${key} is the view's own`)
  binding.local.query('@1 founding positions')
  assert.equal(holds.heldOf('central:search').query, '@1 founding positions')
  for (const [key, words] of [['enter', /A tag sends nothing yet/], ['aliases', /No owner keeps an alias/], ['fields', /shared or joined fields/], ['limit', /50 results/]]) {
    assert.match(binding.standing[key].disabled, words, `${key}: disabled with its reason`)
    await assert.rejects(() => binding.write([{key, value: 'x'}]), words)
  }
  assert.equal(search.searchValues('central:search', null, null).projects, undefined, 'no project list handed: absent, never invented')
})

// ─────────────────────────────────────────────────────────────────────────────────────────────────── Agent identity

const FLINT = 'agent:expressed-ba635b5ae01b4ca98c591fe342079449'
const REVIEWER = 'agent:expressed-0e60f096b906445fa9d013cda3391e39'
// The roster as roster.ts reports it, and the raw central.agent-profile-roster/v1 entries the list drops (ratified Worlds, the self).
const ROSTER = [{ref: FLINT, name: 'Flint', revision: 'r1', accepted: true}, {ref: REVIEWER, name: 'Unnamed agent 2', role: 'independent-reviewer', revision: 'r2', accepted: false}]
const RAW_ROSTER = {schema: 'central.agent-profile-roster/v1', profiles: [{
  accepted: true,
  profile: {agent_ref: FLINT, ratified_world_refs: ['control:root'],
    self_definition: {source: {reference: 'central:source:control:root:Control/self/agents/flint/self.md', content_digest: 'sha256:6de8f15e4c97fefd4d5ae9a0f1101'}}},
  self_definition: {source: {reference: 'central:source:control:root:Control/self/agents/flint/self.md', resolved: true, text: '# Flint\n\nI am Flint, a grounded investigator.\nI ask what makes an idea hold.\n\n## More'}},
}]}
// Shaped as op agent_card's answer (oi.human-agent-card/v1). FIXTURE, not a capture.
const CARD = {schema: 'oi.human-agent-card/v1', identity: {agent_ref: FLINT, name: 'Flint', profile_ref: 'agent-profile:expressed-ba63', refs: [], revision: 'r1'},
  why_im_here: {text: 'Become acquainted with the other participants through an open conversation.', refs: [], role: null},
  what_i_can_do: {items: ['central-orient'], refs: [], text: '1 Skill'}, how_i_work: {items: [], refs: [], text: 'No Methods are carried.'}, how_i_orient: null,
  what_i_carry: {refs: [], skill_sets: [{ref: 'skillset:docs'}], text: '1 SkillSet'},
  where_i_participate: {home_world_ref: 'control:root', other_worlds: ['project:O-I'], positions: {eligible: [], occupied: []}, refs: [], text: '', world_ref: 'control:root'},
  character: null}

test('Agent identity reads your roster and the chosen agent\'s card; it writes nothing, and the agent you talk to is chosen first', async () => {
  holds.resetHolds()
  const id = 'central:agent-identity'
  const extras = identity.profileExtrasOf(RAW_ROSTER)
  assert.deepEqual(extras.get(FLINT), {ratified: ['control:root'], self: {path: 'Control/self/agents/flint/self.md', digest: '6de8f15e4c97', opening: 'I am Flint, a grounded investigator. I ask what makes an idea hold.'}})
  const input = {roster: {agents: ROSTER}, extras, talkingTo: FLINT, card: {agent: FLINT, world: null, card: CARD}}
  const v = identity.identityValues(id, input)
  assert.deepEqual([v.light, v.read, v.agent, v.proposed, v.world], ['lit', 'read', FLINT, false, 'home'])
  assert.deepEqual(parse(v.roster), [{ref: FLINT, name: 'Flint', revision: 'r1', accepted: true}, {ref: REVIEWER, name: 'Unnamed agent 2', role: 'independent-reviewer', revision: 'r2', accepted: false}])
  assert.deepEqual(parse(v.card), {agent: FLINT, home: 'control:root', purpose: 'Become acquainted with the other participants through an open conversation.',
    carries: {skill: ['central-orient'], method: [], skillset: ['skillset:docs']}, ratified: ['control:root'],
    self: {path: 'Control/self/agents/flint/self.md', digest: '6de8f15e4c97', opening: 'I am Flint, a grounded investigator. I ask what makes an idea hold.'}, character: false})
  assert.equal(parse(v.card).runs_on, undefined, 'the card reports no program: runs_on is absent, never invented')
  assert.deepEqual(parse(v.worlds), ['control:root', 'project:O-I'])
  // No one talked to: the roster's first accepted agent. Chosen: that one, until the hand chooses again.
  assert.equal(identity.identityAgentOf(id, {roster: {agents: ROSTER}, talkingTo: null}), FLINT)
  holds.setHeld(id, 'agent', REVIEWER)
  assert.equal(identity.identityAgentOf(id, input), REVIEWER)
  const other = identity.identityValues(id, input)
  assert.equal(other.card, undefined, 'a card read for another agent is not this agent\'s')
  holds.setHeld(id, 'agent', undefined)
  // The roster refused: dark, its words, no agents listed (§18.15 Rules).
  const refused = identity.identityValues(id, {...input, roster: {error: 'The agent roster did not answer'}})
  assert.deepEqual([refused.light, refused.read, refused.fault, refused.roster, refused.card], ['dark', 'refused', 'The agent roster did not answer', undefined, undefined])
  // The card refused: said on the Agent chooser in its words.
  const cardRefused = identity.identityBinding(id, {...input, card: {agent: FLINT, world: null, error: 'O:I returned no Agent card'}})
  assert.match(cardRefused.standing.agent.refused, /The card did not answer: O:I returned no Agent card/)
  // Nothing is written: the choices are the view's own.
  const binding = identity.identityBinding(id, input)
  for (const key of ['agent', 'proposed', 'world']) assert.equal(typeof binding.local[key], 'function', `${key} is the view's own`)
  await assert.rejects(() => binding.write([{key: 'roster', value: '[]'}]), /a reading/)
})

// ─────────────────────────────────────────────────────────────────────────────────────────────────── Context & world

// Shaped as the ground's change horizon (op central inspect: `sources`, central.source-change/v1 changes). FIXTURE, not a capture.
const change = (cursor, kind, session, extra = {}) => ({change_ref: `central:change:control:root:${cursor}`, cursor, kind, source_path: `Control/agents/now/flows/${cursor}.md`,
  observed_at_unix_seconds: 1788972035 + cursor, actor: 'agent/nara', actor_kind: 'agent', agent_session_ref: session, provider: 'central.filesystem-reconcile/v1', ...extra})
const HORIZON = {state: 'ready', data: {world_ref: 'control:root',
  sources: [{binding: {agent_retrieval_allowed: true}}, {binding: {agent_retrieval_allowed: true}}, {binding: {agent_retrieval_allowed: false}}],
  changes: [
    change(7, 'modified', SESSION, {before_revision: 'central.content-fnv1a64/v1:1775:30d290481999891e', after_revision: 'central.content-fnv1a64/v1:1590:b4a2c96a190f9481'}),
    change(8, 'modified', 'agent-session/another'),
    change(9, 'added', SESSION, {before_revision: null, after_revision: 'central.content-fnv1a64/v1:0:cbf29ce484222325'}),
    change(10, 'modified', null),
  ]}}

test('Context & world stands after the Answer and reads its session\'s world: the packet its turn carries, the sources it may retrieve, the receipts of its writes', async () => {
  holds.resetHolds()
  const id = 'central:context-world'
  const input = {answer: {bound: true, session: SESSION}, horizon: HORIZON, document: 'Flow · flow-2026-10-03-1432', packet: {items: 2, session: SESSION}}
  const v = world.contextWorldValues(id, input)
  assert.equal(v.light, 'lit')
  assert.equal(v.document, 'Flow · flow-2026-10-03-1432')
  assert.deepEqual(parse(v.reads).map(place => [place.id, place.name, place.ring]), [['packet', 'Packet', 0], ['world', 'Your world', 3]])
  assert.match(parse(v.reads)[1].path, /^2 sources an agent may retrieve/)
  assert.deepEqual(parse(v.receipts), [
    {id: 'central:change:control:root:9', actor: 'agent/nara', at: 1788972044, place: 'Control/agents/now/flows/9.md', kind: 'Added', after: 'cbf29ce4'},
    {id: 'central:change:control:root:7', actor: 'agent/nara', at: 1788972042, place: 'Control/agents/now/flows/7.md', kind: 'Modified', before: '30d29048', after: 'b4a2c96a'},
  ], 'this session\'s writes only, newest first, each with its revisions either side')
  for (const key of ['reach', 'writeMode', 'writes', 'knowledge', 'waiting', 'tree']) assert.equal(v[key], undefined, `${key}: no owner reports it`)
  // The packet prepared for another conversation is not what this session's turn carries.
  assert.deepEqual(parse(world.contextWorldValues(id, {...input, packet: {items: 2, session: null}}).reads).map(place => place.id), ['world'])
  // No session holds the track: dark, nothing read.
  const unbound = world.contextWorldValues(id, {...input, answer: {bound: false, session: null}})
  assert.deepEqual([unbound.light, unbound.reads, unbound.receipts], ['dark', undefined, undefined])
  // The ground not yet answered: no light, the packet alone.
  const unread = world.contextWorldValues(id, {...input, horizon: null})
  assert.deepEqual([unread.light, parse(unread.reads).map(place => place.id), unread.receipts], [undefined, ['packet'], undefined])
  // Every write refuses in words, and every place's request stands disabled before it is pressed.
  const binding = world.contextWorldBinding(id, input)
  for (const key of ['reach', 'writeMode', 'knowledge']) {
    assert.ok(binding.standing[key].disabled.length > 20, `${key}: disabled with its reason`)
    await assert.rejects(() => binding.write([{key, value: 1}]), /No owner/)
  }
  for (const key of ['r:packet', 'w:packet', 'r:world', 'w:world']) assert.match(binding.standing[key].disabled, /central\.world-relations\.save/, `${key}: disabled with its reason`)
  // REPLACED (T-COVERAGE §1.3): central.world-relations.save exists; it waits on the route that carries the person's authority (§1.1).
  // REPLACED (W2): Context & world stands on no chain since R4; Scope saves the include or exclude (central-person-writes.test.mjs).
  await assert.rejects(() => binding.write([{key: 'r:world', value: true}]), /Scope saves through central\.world-relations\.save/)
  assert.equal(typeof binding.local.reachPending, 'function', 'a raised Reach waits in the view for Confirm')
})

// ─────────────────────────────────────────────────────────────────────────────────────────────────── the designs draw the readings

test('each design draws its five views on its binding — the packet\'s items, the search\'s results, the agent\'s card, the world\'s places', () => {
  holds.resetHolds()
  holds.setHeld('central:search', 'query', 'ground')
  const all = {
    [packet.PACKET_DESIGN]: packet.packetBinding('central:packet', {reading: {context: prepared([TEXT_ITEM, OBSERVED_ITEM])}, companion: 'Fizz', bound: true, conversation: conversation()},
      {edit: async () => {}, send: async () => {}}),
    [search.SEARCH_DESIGN]: search.searchBinding('central:search', {query: 'ground', hits: HITS, rows: ROWS, pending: []}, ['O-I']),
    [identity.IDENTITY_DESIGN]: identity.identityBinding('central:agent-identity', {roster: {agents: ROSTER}, extras: identity.profileExtrasOf(RAW_ROSTER), talkingTo: FLINT,
      card: {agent: FLINT, world: null, card: CARD}}),
    [world.CONTEXT_WORLD_DESIGN]: world.contextWorldBinding('central:context-world', {answer: {bound: true, session: SESSION}, horizon: HORIZON, document: 'Flow · x', packet: {items: 2, session: SESSION}}),
  }
  for (const [id, binding] of Object.entries(all)) {
    for (const view of VIEWS) assert.doesNotThrow(() => html(createElement(() => DESIGNS[id][view](props(binding)))), `${id} ${view} draws`)
  }
  const draw = (id, view) => html(createElement(() => DESIGNS[id][view](props(all[id]))))
  const packetFull = draw(packet.PACKET_DESIGN, 'full')
  assert.match(packetFull, /The original development Run remains incomplete\./, 'the packet\'s words')
  assert.match(packetFull, /observed element/, 'each item\'s anchor')
  assert.match(packetFull, new RegExp(`${TEXT.length + PAGE.length}`), 'the total size at the foot')
  assert.match(draw(search.SEARCH_DESIGN, 'full'), /Consult authored ground/, 'the owner\'s result')
  assert.match(draw(identity.IDENTITY_DESIGN, 'whole'), /Flint/, 'the agent\'s name')
  const worldFull = draw(world.CONTEXT_WORLD_DESIGN, 'full')
  assert.match(worldFull, /2 sources an agent may retrieve/, 'the place the agent may read, by what it is (the pane names a place by its path)')
  assert.match(worldFull, /30d29048 → b4a2c96a/, 'a receipt with its revisions either side')
  // No reading at all: each design draws the absence in words, never the design's own sample.
  for (const [id, design] of Object.entries(DESIGNS)) {
    const bare = {values: {}, standing: {}}
    for (const view of VIEWS) assert.doesNotThrow(() => html(createElement(() => design[view](props(bare)))), `${id} ${view} draws with no reading`)
  }
})

// ─────────────────────────────────────────────────────────────────────────────────────────────────── a reached Day

const TODAY = {project: null, sourceRef: 'central:source:control:root:Control/user/day/2026-10-16/day.md', documentId: 'day-document:2026-10-16'}
const OTHER = {project: null, sourceRef: 'central:source:control:root:Control/user/day/2026-10-05/day.md', documentId: 'day-document:2026-10-05'}
const dayReading = {aperture: TODAY, face: 2, payload: {fields: {p2_body: '<p>The <mark>first</mark> unit.</p>'}, notes: [], packet: []}, civilDate: '2026-10-16'}
const door = (day, extra = {}) => ({key: 'day:fixture', form: 'Day', title: day?.documentId ?? 'day-document:unknown', state: 'as read', ...(day ? {day} : {}), ...extra})

test('a reached Day draws its face and date: the Day device\'s own document, or another Day by the document its face names on the door', () => {
  holds.resetHolds()
  // The Day device's own document.
  const own = pageDevices.dayPageOf(door(TODAY), dayReading, null)
  assert.equal(own.date, '2026-10-16')
  assert.deepEqual([own.material.face, own.material.date, own.material.page?.highlights], [2, civilDayName('2026-10-16'), 1])
  assert.equal(pageDevices.namedDayOf(door(TODAY), dayReading), null, 'the Day device\'s own: read once, by that device')
  // Another Day the face named: read by that name; its date the one its source path names, its face once its owner answers.
  assert.deepEqual(pageDevices.namedDayOf(door(OTHER), dayReading), OTHER)
  const waiting = pageDevices.dayPageOf(door(OTHER), dayReading, {face: null, payload: null})
  assert.deepEqual([waiting.date, waiting.material.date, waiting.material.face, waiting.material.page], ['2026-10-05', civilDayName('2026-10-05'), null, null])
  const read = pageDevices.dayPageOf(door(OTHER), dayReading, {face: 4, payload: {fields: {}, notes: [{id: 'n1', text: 'Omarchy first.'}], packet: []}})
  assert.deepEqual([read.material.face, read.material.page?.notes.length], [4, 1])
  // The Document draws it: the face and the date, and the face's draft fact and save outcome off the door.
  const reached = pageDevices.reachedPageOf(door(OTHER, {dirty: true, outcome: 'stale'}), read.date)
  const values = holds.documentValues('central:document', reached, read.material)
  assert.deepEqual([values.face, values.date, values.dirty, values.outcome, values.notes], [4, civilDayName('2026-10-05'), true, 'stale', 1])
  // A face that names no document (an older face): its door words alone, unless its title is the Day device's document.
  assert.deepEqual(pageDevices.dayPageOf(door(null, {title: 'day-document:2026-10-05'}), dayReading, null), {date: null, material: {form: 'day', page: null, face: null, date: null, refusal: null}})
  assert.equal(pageDevices.dayPageOf(door(null, {title: TODAY.documentId}), dayReading, null).material.face, 2)
})
