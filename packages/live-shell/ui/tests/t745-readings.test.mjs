// O-I #745, lane AA: three readings the devices waited on.
//  1. The Gateway's four link readings — `beatAge`, `running`, `inflight`, `frames` — from AIKit's gateway document (`aikit --json gateway
//     agent --binding B sessions`, the kernel's harness_agent_read: its `data`, the engine's result under `result`, now carrying `link`), so
//     the River on the Gateway's Full flows on what the gateway knows.
//  2. (Walk 739 gap 5, the Workcells widget: the seat page draws only the seats Workcell reads — tests/t740-world-scope.test.mjs; the kernel
//     hands the seat instrument the world's own Central root — desktop/cradle/kernel/tests/shell_owner_reads.rs.)
//  3. Walk 739 gap 14: the packet is the document's. To packet inside the Flow adds to the page's own packet (ql-flow.html D.packet); the
//     Packet device and the transport's count read that packet from the island the Flow's face reads (documentDoor.ts DocumentInPane.packet).
// Channels: REAL (tests/fixtures/gateway-link-2026-10-29.json: `aikit --json gateway agent --binding gateway-binding/lane-aa sessions` against
// a gateway this lane served in an isolated AIKit home from ai-kit dlw/745-gateway-readings, three frames ingested and one send prepared, read
// only); BINDING (the Gateway's, the Packet's and the transport's own value functions); SCRIPTED (the Gateway's Full rendered to static
// markup); CODE-READING (the Flow's face publishes the island's packet).
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {register} from 'node:module'

const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
const boundary = new URL('packages/expressions-boundary/src/', new URL('../../../../', import.meta.url)).href
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};
import {readFile} from 'node:fs/promises';
const BOUNDARY = ${JSON.stringify(boundary)};
export async function resolve(specifier,context,next){
  if(specifier.startsWith('@epilogos/expressions-boundary/'))return next(BOUNDARY+specifier.slice('@epilogos/expressions-boundary/'.length)+'.ts',context);
  try{return await next(specifier,context)}catch(error){
    if(!specifier.startsWith('.'))throw error;
    if(specifier.endsWith('.js')){try{return await next(specifier.slice(0,-3)+'.ts',context)}catch{}}
    for(const suffix of ['.ts','.tsx','/index.ts','/index.tsx']){try{return await next(specifier+suffix,context)}catch{}}
    throw error;
  }
}
export async function load(url,context,next){
  if(url.endsWith('.css'))return {format:'module',shortCircuit:true,source:'export default null'};
  if(url.endsWith('.html')||url.includes('?raw'))return {format:'module',shortCircuit:true,source:'export default ""'};
  if(url.endsWith('.ts')||url.endsWith('.tsx')){
    const source=await readFile(new URL(url).pathname,'utf8');
    const {outputText}=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX},fileName:url});
    return {format:'module',shortCircuit:true,source:outputText};
  }
  return next(url,context);
}`)}`, {parentURL: import.meta.url})

globalThis.document = {getElementById: () => null, createElement: () => ({}), head: {appendChild: () => {}}, documentElement: {}}
const {renderToStaticMarkup} = await import('react-dom/server')
const F = await import('../src/inhabitants/catalogue/faces/environReadings.ts')
const model = await import('../src/agent/devices/agentChainDevices.ts')
const bind = await import('../src/agent/devices/designBindings.ts')
const {design: gateway} = await import('../src/inhabitants/catalogue/panels/actuation__gateway.tsx')
const packet = await import('../src/central/devices/packetBinding.ts')
const pages = await import('../src/central/devices/pageReadings.ts')
const R = await import('../src/shell/transports/transportReadings.ts')
const REAL = JSON.parse(readFileSync(new URL('./fixtures/gateway-link-2026-10-29.json', import.meta.url), 'utf8'))
const read = path => readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8')

const nav = {select() {}, expand() {}, full() {}, popout() {}, fold() {}, unfold() {}, rail() {}, close() {}}
const props = (v, extra = {}) => ({v, set() {}, nav, page: '', setPage() {}, standing: {}, owner: v, frame: 'pane', room: {w: 900, h: 520}, ...extra})
const river = markup => {
  const found = [...markup.matchAll(/<div class="fx-env" data-environ="river" data-environ-state="([a-z]+)">([\s\S]*?)<\/svg>/g)]
  assert.equal(found.length, 1, 'one river well')
  return {state: found[0][1], body: found[0][2]}
}
/** The Gateway's reading as the kernel hands it on (agency.rs gateway_agent: the envelope's `data`, verbatim). */
const answered = data => ({...model.INITIAL_READING, gatewayAdmitted: true, gateway: {kind: 'reading', title: 'Gateway', line: 'answered', receipt: null}, gatewayDoc: data})
const bound = (data, harness = {binding: 'gateway-binding/lane-aa', resolved: true}) =>
  bind.gatewayBinding('factory:gateway', {reading: answered(data), harness}, {}, async () => ({kind: 'fired'}))
const LINK_KEYS = ['beatAge', 'running', 'inflight', 'frames']

// ---------------------------------------------------------------- 1 · the Gateway's link readings

test('REAL — the Gateway binds the four link readings from AIKit\'s gateway document: the check-in\'s age, the turns running, the frames in flight, the frames', () => {
  const data = REAL.envelope.data
  const link = data.result.link
  const binding = bound(data)
  const v = binding.values
  assert.equal(v.beatAge, link.check_in_age_seconds, 'the check-in\'s age, by the gateway\'s own clock')
  assert.equal(v.running, link.turns_running)
  assert.equal(v.inflight, link.frames_in_flight, 'the send prepared and not yet receipted is a frame in flight')
  assert.equal(v.seq, link.last_sequence, 'the last sequence number of the session')
  const frames = JSON.parse(v.frames)
  assert.equal(frames.length, link.frame_count)
  assert.deepEqual(frames.map(f => [f.seq, f.dir, f.kind, f.session, f.note]),
    link.frames.map(f => [f.sequence, 'out', 'human-message', data.result.agent_session_ref, f.note]), 'a frame the surface sent toward the agent is one the shell sent')
  const clock = ms => { const d = new Date(ms); return [d.getHours(), d.getMinutes(), d.getSeconds()].map(n => String(n).padStart(2, '0')).join(':') }
  assert.deepEqual(frames.map(f => f.at), link.frames.map(f => clock(f.recorded_at_unix_ms)), 'each frame at the instant the gateway journaled it, on this clock')
  for (const key of LINK_KEYS) assert.equal(binding.standing[key], undefined, `${key} is a reading, not a standing`)
  assert.equal(bind.GATEWAY_ABSENT, undefined, 'the four missing ops are retired')
  const flowing = F.riverOf(v)
  assert.deepEqual([flowing.flow, flowing.waits, flowing.inflight], ['flowing', [], 1], 'the river flows on the real reading')
})

test('SCRIPTED — the River on the Gateway\'s Full flows on the real binding, one leaf on the current for the frame in flight', () => {
  const binding = bound(REAL.envelope.data)
  const values = {...gateway.defaults, ...Object.fromEntries([...LINK_KEYS, 'seq', 'stallAfter', 'connect', 'readiness', 'transport'].map(key => [key, undefined])), ...binding.values}
  const well = river(renderToStaticMarkup(gateway.full(props(values, {standing: binding.standing}))))
  assert.equal(well.state, 'live')
  assert.equal((well.body.match(/<ellipse /g) ?? []).length, REAL.envelope.data.result.link.frames_in_flight)
})

test('BINDING — a gateway that names no check-in yet, one that predates the link, frames journaled before the stamps, and a refusal', () => {
  const empty = {binding_ref: 'gateway-binding/x', operation: {op: 'sessions'}, type: 'conversation', result: {agent_session_ref: 'agent-session/x', harness: null, sessions: [],
    link: {observed_at_unix_ms: 1, last_check_in_unix_ms: null, check_in_age_seconds: null, turns_running: 0, frames_in_flight: 0, queued_prompts: 0, pending_deliveries: 0,
      frame_count: 0, last_sequence: null, frames_limit: 100, frames: []}}}
  const none = bound(empty)
  assert.equal(none.values.beatAge, -1, 'no frame yet: no check-in has come (the design\'s -1)')
  assert.equal(none.values.frames, '[]')
  assert.deepEqual([F.riverOf(none.values).flow, F.riverOf(none.values).why], ['still', 'No check-in has come yet.'])

  const older = bound({...empty, result: {agent_session_ref: 'agent-session/x', harness: null, sessions: []}})
  for (const key of LINK_KEYS) {
    assert.equal(older.values[key], undefined, key)
    assert.match(older.standing[key].disabled, /carries no link/, `${key}: says the gateway's answer carries no link`)
  }

  const unstamped = bound({...empty, result: {...empty.result, link: {...empty.result.link, frame_count: 2, last_sequence: 2,
    frames: [{sequence: 1, kind: 'human-message', direction: 'to-agent', note: 'a'}, {sequence: 2, kind: 'agent-message', direction: 'from-agent', note: 'b'}]}}})
  assert.equal(unstamped.values.beatAge, undefined, 'frames journaled before the gateway stamped them name no check-in')
  assert.match(unstamped.standing.beatAge.disabled, /before it stamped them/)
  assert.deepEqual(JSON.parse(unstamped.values.frames).map(f => [f.dir, f.at]), [['out', undefined], ['in', undefined]], 'no instant is made up')

  const refused = bind.gatewayBinding('factory:gateway', {reading: {...model.INITIAL_READING, gatewayAdmitted: false,
    gateway: {kind: 'refused', title: 'Gateway', line: 'gateway binding cursor does not exist', receipt: null},
    gatewayDoc: {refused: true, message: 'gateway binding cursor does not exist'}}, harness: {binding: 'cursor', resolved: false}}, {}, async () => ({kind: 'fired'}))
  for (const key of LINK_KEYS) assert.match(refused.standing[key].disabled, /gateway binding cursor does not exist/, `${key}: the refusal in the owner's words`)
  assert.equal(F.riverOf(refused.values).flow, 'dry')
})

// ---------------------------------------------------------------- 3 · the packet is the document's

/** A Flow's island as ql-flow.html keeps it: two entries, a selection and a whole entry To packet. */
const ISLAND = {meta: {documentId: 'doc-1', title: 'Walk notes', template: 'ql-dialogue-flow v0.4', revision: 3, view: 'flow', current: 'e2'},
  entries: [{id: 'e1', author: 'F', html: '<p>The packet should be the document’s.</p>'}, {id: 'e2', author: 'C', html: '<p>Then the Packet device reads it.</p>'}],
  notes: [], media: [], journal: [],
  packet: [
    {id: 'p1', entryId: 'e2', scope: 'selection', label: '2 (C)', text: 'the Packet device reads it', at: '2026-10-29T10:00:00.000Z'},
    {id: 'p2', entryId: 'e1', scope: 'whole entry', label: '1 (F)', text: 'The packet should be the document’s.', at: '2026-10-29T10:01:00.000Z'},
  ]}

test('PURE — the document\'s packet, read from the island: each item\'s entry, author, scope, label, words and size', () => {
  const items = pages.flowPacketOf(ISLAND)
  assert.deepEqual(items.map(i => [i.entry, i.by, i.scope, i.label, i.text, i.chars]),
    [[2, 'C', 'selection', '2 (C)', 'the Packet device reads it', 26], [1, 'F', 'whole entry', '1 (F)', 'The packet should be the document’s.', 36]])
  assert.deepEqual(pages.readFlowPage(ISLAND).packet.map(i => [i.entry, i.scope, i.text]), items.map(i => [i.entry, i.scope, i.text]), 'the Document device reads the same items')
})

test('BINDING — the Packet reads the reached document\'s packet: its items and size, the Flow it is gathered from; its acts say where they are done', async () => {
  const documentPacket = {form: 'Flow', title: 'Walk notes', packet: pages.flowPacketOf(ISLAND)}
  // AIKit's prepared context says nothing here: the packet is the document's.
  const input = {reading: null, companion: 'Fizz', bound: true, document: documentPacket}
  const v = packet.packetValues('central:packet', input)
  assert.equal(v.light, 'lit')
  assert.equal(v.flow, 'Walk notes')
  assert.deepEqual(JSON.parse(v.packet).map(i => [i.entry, i.by, i.scope, i.text, i.chars, i.label]),
    [[2, 'C', 'selection', 'the Packet device reads it', 26, '2 (C)'], [1, 'F', 'whole entry', 'The packet should be the document’s.', 36, '1 (F)']])
  const binding = packet.packetBinding('central:packet', input, {edit: null, send: null})
  for (const key of ['takeOut', 'clear']) assert.match(binding.standing[key].disabled, /in the Flow/, `${key}: done in the Flow, where the packet is`)
  assert.match(binding.standing.answer.disabled, /prepared context/, 'Answer this says why it cannot send the document\'s packet')
  await assert.rejects(() => binding.write([{key: 'takeOut', value: '0:2'}]), /in the Flow/)
  // With no document reached, the Packet reads AIKit's prepared context as before.
  assert.equal(packet.packetValues('central:packet', {reading: null, companion: 'Fizz', bound: true, document: null}).packet, undefined)
})

test('BINDING — the transport\'s count reads the document\'s packet: its size in characters and where it is gathered', () => {
  const doc = {form: 'Flow', title: 'Walk notes', state: 'edited since save', packet: pages.flowPacketOf(ISLAND)}
  const {key, scale} = R.packetReadouts(null, doc)
  assert.equal(key.value, 'Σ 62')
  assert.match(key.title, /2 items/)
  assert.match(key.title, /Walk notes/)
  assert.match(scale.title, /Walk notes/)
  const bindings = R.centralBindings({ground: null, groundError: null, packet: null, config: null, transport: {kind: 'unavailable', reason: 'test'}, document: doc})
  assert.equal(bindings.key.readout.value, 'Σ 62', 'the Key slot shows the document\'s packet')
  // A reached document with an empty packet: the count is 0, not unread.
  assert.equal(R.packetReadouts(null, {...doc, packet: []}).key.value, 'Σ 0')
})

test('CODE-READING — the Flow\'s face publishes the island\'s packet on the door, from the bounded read it already makes', () => {
  const face = read('inhabitants/DocumentFlowFace.tsx')
  assert.match(face, /flowPacketOf\(/, 'the face reads the packet from the island')
  assert.match(face, /packet[,}]/, 'the standing carries it')
  assert.match(read('central/documents/documentDoor.ts'), /readonly packet\?: readonly PagePacketItem\[\]|packet\?: readonly PagePacketItem\[\]/)
  assert.match(read('central/devices/CentralDevices.tsx'), /useReachedDocument\(\)/, 'the Packet device reads the reached document')
})
