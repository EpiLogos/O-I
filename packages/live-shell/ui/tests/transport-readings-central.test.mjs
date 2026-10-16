import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'

// Ticket C: Central's transport at the mockup's floor shows the owners' readings — the Day die's face and shape, the day's
// opening and close, the moment of the day, the packet and the machine serving the ground — and turns the die only through
// its write route. Every value comes from a fixture of the owner's own reading shape; nothing is typed. Channel: scripted.
const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};
import {readFile} from 'node:fs/promises';
export async function resolve(specifier,context,next){
  try{return await next(specifier,context)}catch(error){
    if(!specifier.startsWith('.'))throw error;
    if(specifier.endsWith('.js')){try{return await next(specifier.slice(0,-3)+'.ts',context)}catch{}}
    for(const suffix of ['.ts','.tsx','/index.ts','/index.tsx']){try{return await next(specifier+suffix,context)}catch{}}
    throw error;
  }
}
export async function load(url,context,next){
  if(url.endsWith('.css'))return {format:'module',shortCircuit:true,source:'export default null'};
  if(['.html','.svg','.png','.md'].some(ext=>url.split('?')[0].endsWith(ext))||url.endsWith('?raw'))return {format:'module',shortCircuit:true,source:'export default ""'};
  if(url.endsWith('.ts')||url.endsWith('.tsx')){
    const source=await readFile(new URL(url).pathname,'utf8');
    const {outputText}=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX},fileName:url});
    return {format:'module',shortCircuit:true,source:outputText};
  }
  return next(url,context);
}`)}`, {parentURL: import.meta.url})

const noop = () => {}
globalThis.document = {getElementById: () => null, createElement: () => ({style: {}, setAttribute: noop, appendChild: noop}), head: {appendChild: noop}, addEventListener: noop, removeEventListener: noop, querySelector: () => null, documentElement: {style: {}}}
globalThis.window ??= globalThis; globalThis.addEventListener ??= noop; globalThis.removeEventListener ??= noop
globalThis.localStorage = {getItem: () => null, setItem: () => {}}
const React = await import('react')
const {renderToStaticMarkup} = await import('react-dom/server')
const {readFile} = await import('node:fs/promises')
const R = await import('../src/shell/transports/transportReadings.ts')
const {Transport} = await import('../src/frame/transport/Transport.tsx')
const {slotWords} = await import('../src/shell/modeTransports.tsx')
const source = path => readFile(new URL(`../src/${path}`, import.meta.url), 'utf8')

const SOURCE_REF = 'central:source:control:root:Control/user/day/2026-10-08/day.md'
const DOCUMENT = 'day:2026-10-08'
/** The owner's ground reading (oi.central-ground/v1) as readGround returns it: the civil-time reading and today's Day. */
function ground({face = 3, ready = true, openedUtc = Date.UTC(2026, 9, 8, 7, 30) / 1000, boundary = 0} = {}) {
  const document = ready ? {schema: 'central.document-reading/v1', source: {ref: SOURCE_REF}, document_id: DOCUMENT, revision: {revision: 'r7'},
    document: {document_id: DOCUMENT, kind: 'day', day_ref: 'central:day:control:root:2026-10-08', fields: [], template_payload: {meta: {face}}},
    automatic_agent_or_model_invocation: false} : null
  return {schema: 'oi.central-ground/v1', project: null,
    time: {state: 'ready', action: 'central.time.policy', data: {schema: 'central.civil-time-reading/v1', civil_date: '2026-10-08', local_time: '2026-10-08T14:37:00+01:00',
      revision: 'p1', source_ref: 'central:source:control:root:Control/user/civil-time-policy.json',
      policy: {timezone: 'Europe/London', day_boundary_minutes: boundary, automatic_day_rollover: true}}},
    day: {state: 'ready', action: 'central.day.read', data: {schema: 'central.day-reading/v1', day_ref: 'central:day:control:root:2026-10-08',
      source: {ref: SOURCE_REF, path: 'Control/user/day/2026-10-08/day.md'}, revision: {revision: 'r7'}, content: '',
      temporal: {day_ref: 'central:day:control:root:2026-10-08', civil_date: '2026-10-08', lifecycle: 'open', created_at_unix_seconds: openedUtc, timezone: 'Europe/London'},
      document_state: ready ? 'ready' : 'uninitialised', document}},
    now: {state: 'unavailable', action: 'central.now.list'}, sources: {state: 'unavailable', action: 'x'}, placement: {state: 'unavailable', action: 'y'}}
}
const packet = {context: {schema: 'aikit.prepared-context/v1', scope: {project: 'O-I', agent_session: 'session:fizz'}, revision: 4, digest: 'blake3:x', items: [
  {id: 'a', canonical_expression: '', expression: null, selection: {text: 'x'.repeat(300), title: 'Flow', source_ref: 's:1', binding_id: 'b', anchor: {kind: 'text', start: 0, end: 300}}},
  {id: 'b', canonical_expression: '', expression: null, selection: {text: 'y'.repeat(200), title: 'Day', source_ref: 's:2', binding_id: 'b', anchor: {kind: 'text', start: 0, end: 200}}},
]}}
const NATIVE = {kind: 'tauri'}
const CONFIG = {world_scope: {owner: 'central', world: 'control:root', personal_ground: '/g', workcell_ref: 'workcell:mac'}}

test('the civil readings are the owner\'s fields, formatted: the date, the clock in the policy\'s zone, the boundary', () => {
  assert.equal(R.civilDayLabel('2026-10-08'), '08 Oct')
  assert.equal(R.civilDayLabel('not a date'), null)
  assert.equal(R.civilClock(Date.UTC(2026, 9, 8, 7, 30) / 1000, 'Europe/London'), '08:30', 'British Summer Time is the owner\'s zone, not the machine\'s')
  assert.equal(R.civilClock(Date.UTC(2026, 11, 8, 7, 30) / 1000, 'Europe/London'), '07:30')
  assert.equal(R.civilClock(undefined, 'Europe/London'), null)
  assert.equal(R.boundaryClock(0), '00:00'); assert.equal(R.boundaryClock(270), '04:30'); assert.equal(R.boundaryClock(1440), null)
  assert.equal(R.compactCount(500), '500'); assert.equal(R.compactCount('1200'), '1.2k'); assert.equal(R.compactCount(142000), '142k'); assert.equal(R.compactCount('—'), '—')
})

test('the Day die stands only on a native Day document: its face and shape, and the aperture its write route turns', () => {
  const die = R.dayDieOf(ground(), null)
  assert.equal(die.state, 'ready'); assert.equal(die.face, 3)
  assert.deepEqual(die.aperture, {project: null, sourceRef: SOURCE_REF, documentId: DOCUMENT})
  const {tempo, signature} = R.dieReadouts(die)
  assert.equal(tempo.value, 'face 3'); assert.match(tempo.title, /#3 Pattern — Observations/)
  assert.equal(signature.value, '4 + 2'); assert.match(signature.title, /Ground and Synthesis/)
  const waiting = R.dayDieOf(ground({ready: false}), null)
  assert.equal(waiting.state, 'waiting'); assert.match(waiting.reason, /no native document yet/)
  assert.deepEqual(R.dieReadouts(waiting), {}, 'no document, no face and no shape')
  assert.match(R.dayDieOf(null, 'no kernel transport').reason, /refused: no kernel transport/)
})

test('the day opens and closes by itself: the record\'s opening and the policy\'s boundary, never a typed hour', async () => {
  const {opened, closes} = R.dayBounds(ground())
  assert.equal(opened.value, '08:30'); assert.match(opened.title, /opened by itself at 08:30 Europe\/London/)
  assert.equal(closes.value, '00:00'); assert.match(closes.title, /day_boundary_minutes 0/)
  assert.equal(R.dayBounds(ground({boundary: 300})).closes.value, '05:00', 'the boundary moves with the policy')
  assert.deepEqual(R.dayBounds(null), {})
  const code = (await source('shell/transports/transportReadings.ts')).replace(/\/\/.*|\/\*[\s\S]*?\*\//g, '')
  assert.doesNotMatch(code, /'\d{1,2}:\d{2}'/, 'no hour is typed in the readings')
})

test('the moment of the day is the civil day and the die\'s face; with no die, the civil Now', () => {
  assert.equal(R.centralPosition(ground(), R.dayDieOf(ground(), null), undefined).value, '08 Oct · p3')
  const noDie = R.dayDieOf(ground({ready: false}), null)
  assert.equal(R.centralPosition(ground({ready: false}), noDie, {value: '14:37', title: 'Now'}).value, '08 Oct · 14:37')
  assert.equal(R.centralPosition(ground({ready: false}), noDie, {value: '—', title: 'unread'}).value, '08 Oct')
  assert.equal(R.centralPosition(null, noDie, undefined), null)
})

test('the packet\'s size is its characters (the owner discloses no tokens) and its scope is the owner\'s', () => {
  const {key, scale} = R.packetReadouts(packet)
  assert.equal(key.value, 'Σ 500'); assert.match(key.title, /2 selections, 500 characters/); assert.match(key.title, /no token count/)
  assert.equal(scale.value, 'session'); assert.match(scale.title, /session:fizz/)
  assert.match(R.packetReadouts({error: 'AIKit is down'}).refused, /refused: AIKit is down/)
  assert.deepEqual(R.packetReadouts(null), {})
})

test('the machine serving the ground is the World\'s workcell and the carrier the host discloses', () => {
  assert.equal(R.groundCarrier(CONFIG, NATIVE).value, 'mac · local')
  assert.equal(R.groundCarrier(CONFIG, {kind: 'bridge', url: 'http://127.0.0.1:4179'}).value, 'mac · bridge')
  assert.equal(R.groundCarrier(null, NATIVE).value, 'ground · local')
  assert.equal(R.groundCarrier(CONFIG, {kind: 'unavailable', reason: 'none'}), null, 'no carrier, no reading')
})

test('Central\'s bar draws the mockup\'s readings from the owners, steps the die only through its write route, and waits otherwise', () => {
  const turned = []
  const bindings = R.centralBindings({ground: ground(), groundError: null, packet, config: CONFIG, transport: NATIVE, turn: direction => turned.push(direction)})
  const markup = renderToStaticMarkup(React.createElement(Transport, {bindings, words: id => slotWords('base', id)}))
  const face = id => markup.match(new RegExp(`<(?:button|output)[^>]*data-slot="${id}"[^>]*>([^<]*)<`))?.[1]
  assert.deepEqual(['link', 'tap', 'tempo', 'signature', 'key', 'scale', 'position', 'punch-in', 'punch-out', 'rate', 'key-map'].map(face),
    ['Ground', 'Stamp', 'face 3', '4 + 2', 'Σ 500', 'session', '08 Oct · p3', '08:30', '00:00', 'mac · local', 'Map'])
  // The die's nudges are enabled by its write route and press it; nothing else here is pressable.
  const steppers = [...markup.matchAll(/<button[^>]*data-slot="tempo"[^>]*>/g)].map(m => m[0])
  assert.equal(steppers.length, 2); assert.ok(steppers.every(tag => !/disabled=""/.test(tag)))
  bindings.tempo.step(1); bindings.tempo.step(-1); assert.deepEqual(turned, [1, -1])
  for (const id of ['link', 'tap', 'metro', 'quantize', 'play', 'record', 'arm', 'capture', 'loop', 'draw']) {
    assert.match(markup.match(new RegExp(`<button[^>]*data-slot="${id}"[^>]*>`))[0], /disabled=""/, `${id} waits: no write path`)
  }
  assert.doesNotMatch(markup, /data-light=/, 'no light without a reading')
  // With no native Day document, the die waits with the owner's reason and its nudges stay disabled.
  const waiting = R.centralBindings({ground: ground({ready: false}), groundError: null, packet: null, config: CONFIG, transport: NATIVE, turn: () => {}})
  assert.equal(waiting.tempo.step, undefined); assert.match(waiting.tempo.title, /no native document yet/)
  assert.equal(waiting.signature.readout, undefined)
  // A refused ground read is named on the slots that wait for it.
  const refused = R.centralBindings({ground: null, groundError: 'no kernel transport', packet: null, config: null, transport: {kind: 'unavailable', reason: 'x'}})
  assert.match(refused['punch-in'].title, /refused: no kernel transport/); assert.equal(refused.rate, undefined)
})

test('the Central hook reads through the owners\' own readers and writes only through the die\'s route', async () => {
  const code = await source('shell/transports/useCentralTransport.tsx')
  for (const call of ['useCentralGroundAnswer(transport)', 'nativeContext(transport, CONVERSATION_PROJECT, session, {operation: \'read\'})', 'turnDieFace(transport, die.aperture, face)', 'conversationOf(agency.tracks, COMPANIONS.base.name, selectionRef)']) {
    assert.ok(code.includes(call), `the hook makes ${call}`)
  }
  // The ground is read once for the window: the transport and the Day device share Central's one answer (useCentralReadings.ts).
  assert.doesNotMatch(code, /readGround\(/, 'no second ground read of its own')
  assert.ok((await source('central/devices/useCentralReadings.ts')).includes('readGround(transport, null)'), 'the one answer reads the root ground')
  assert.doesNotMatch(code, /setInterval|kernelOp\(|fetch\(/, 'no poll and no owner call of its own')
  assert.match(await source('shell/modeTransports.tsx'), /base: useCentralTransport/)
})

test('the Load slot is the reached document\'s save standing (the mockup\'s `edited`), from the document door — never a guess', async () => {
  const {centralBindings, documentLoad} = await import('../src/shell/transports/transportReadings.ts')
  const base = {ground: null, groundError: null, packet: null, config: null, transport: {kind: 'unavailable', reason: 'test'}}
  assert.equal(centralBindings(base).cpu, undefined, 'no document reached, no reading')
  const edited = centralBindings({...base, document: {form: 'Day', title: '2026-10-08', state: 'edited since save', revision: 'abc123'}}).cpu
  assert.equal(edited.readout.value, 'edited')
  assert.match(edited.readout.title, /the Day 2026-10-08 at rabc123: edited since save/)
  assert.equal(documentLoad({form: 'Flow', title: 'f', state: 'waiting for the owner'}).value, 'saving…')
  assert.equal(documentLoad({form: 'Flow', title: 'f', state: 'saved — native save acknowledged'}).value, 'saved')
  assert.equal(documentLoad({form: 'Flow', title: 'f', state: 'refused — the owner declined'}).value, 'refused')
})
