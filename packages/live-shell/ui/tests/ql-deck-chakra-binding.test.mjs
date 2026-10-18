import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'

// T-WORLDS W4: the Deck on the open journey (the kernel's nara_journey) and the Chakra on your elements (nara_elemental). A fixture call
// stands in for the kernel: an answer for another journey, operation, identity or revision is refused; a draw needs consent to chance
// each time and spends it; Move and Turn are refused in words; today's centres stand absent with their owner named.
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
  if(url.includes('?raw')||url.endsWith('.html'))return {format:'module',shortCircuit:true,source:'export default ""'};
  if(url.endsWith('.ts')||url.endsWith('.tsx')){
    const source=await readFile(new URL(url).pathname,'utf8');
    const {outputText}=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX},fileName:url});
    return {format:'module',shortCircuit:true,source:outputText.split('import.meta.env').join('({BASE_URL: "/"})')};
  }
  return next(url,context);
}`)}`, {parentURL: import.meta.url})

const noop = () => {}
globalThis.document ??= {getElementById: () => null, createElement: () => ({style: {}, setAttribute: noop, appendChild: noop}), head: {appendChild: noop},
  addEventListener: noop, removeEventListener: noop, querySelector: () => null, querySelectorAll: () => [], documentElement: {style: {}}}
const React = await import('react')
const {renderToStaticMarkup} = await import('react-dom/server')
const h = React.createElement
const deckMod = await import('../src/inhabitants/ql/devices/qlDeck.ts')
const chakraMod = await import('../src/inhabitants/ql/devices/qlChakra.ts')
const techne = await import('../src/inhabitants/ql/devices/TechneDevices.tsx')
const manifests = await import('../src/inhabitants/quaternalLogicFamilyManifest.ts')
const {HostedDevice} = await import('../src/frame/devices/deviceHost.tsx')
const {designKey} = await import('../src/frame/devices/designs.ts')
const deckDesign = (await import('../src/inhabitants/catalogue/panels/quaternal-logic__deck.tsx')).design
const chakraDesign = (await import('../src/inhabitants/catalogue/panels/quaternal-logic__chakra.tsx')).design
const kernelOps = await import('../src/inhabitants/sdk/kernelOps.ts')
const VIEWS = ['folded', 'compact', 'whole', 'full', 'widget']

// ── the Deck: the open journey, through the kernel's nara_journey ───────────────────────────────────────────────────────

const location = {schema: 'central.path-ref/v1', ref: 'ref:Control/user/flows/journey.html', root: 'R', path: 'Control/user/flows/journey.html'}
const journey = {location, actor_ref: 'person:frank', day_ref: 'central:day:control:root:2026-10-18', title: 'What the move asks'}
const card = (name, codons, reversed, position, ref) => ({placement_ref: ref, card: {deck_index: 0, token_ref: 't', name, arcana: 'minor', kernel_card_ref: null, codons},
  reversed, position, basis: {basis: 'drawn'}, klein_face: 'prospective', live_state: 'generating', person_disposition: null, day_ref: journey.day_ref,
  placed_at_unix_ms: 1, recognitions: [], current_readings: [], reading_history: []})
const reading = (over = {}) => ({schema: 'ql.nara-oracle-journey-reading/v1', journey_ref: 'journey:doc-1', journey_revision: 2, subject_id: 'person:frank',
  concern: {concern_ref: 'concern:move', title: 'What the move asks', basis_sources: []}, status: 'open',
  deck: {deck_ref: 'deck:thoth', register: 'thoth', card_count: 78, dealt: 2, remaining: 76, shuffle_ref: 's', shuffled_at_unix_ms: 0, protocol_ref: 'p'},
  day_refs: [journey.day_ref], spreads: [{spread_ref: 'journey:doc-1/spread/0', kind: {kind: 'sphere'}, day_ref: journey.day_ref, basis_sources: [], janus_resolved: false,
    placements: [card('Ace of Wands', [21], false, 'P0', 'p0'), card('Ace of Cups', [0], true, 'P1', 'p1')]}],
  symbolic_assignments: [], iching: [{reading_ref: 'i0', lines: [7, 8, 9, 7, 6, 8], primary: 1, changing_mask: 20, resulting: 2, nuclear: 32, day_ref: journey.day_ref}],
  live_placement_refs: ['p0', 'p1'], ...over})
const result = (operation, over = {}, page = 'r-2') => ({outcome: {result: 'nara_journey', data: {schema: 'oi.nara-journey/v1', operation, reading: reading(over),
  page: {location, revision: page}}}})

test('the Deck reads the open journey through the kernel and draws its last spread by position, a reversed card turned', async () => {
  assert.ok(['nara_journey', 'nara_lived_context', 'nara_elemental'].every(op => kernelOps.KERNEL_OPS.includes(op)), 'the three ops stand in the kernel union')
  const calls = []
  deckMod.resetQlDeck({call: async op => { calls.push(op); return result('read') }})
  assert.equal(deckMod.qlDeckValues(deckMod.qlDeckState()).reason, deckMod.NO_JOURNEY, 'no journey: the Deck says so')
  await deckMod.openDeckJourney(journey)
  assert.deepEqual(calls[0], {op: 'nara_journey', request: {operation: 'read', location}})
  const values = deckMod.qlDeckValues(deckMod.qlDeckState())
  assert.equal(values.theme, 'What the move asks')
  assert.deepEqual(JSON.parse(values.placements), [{position: 'P0', name: 'Ace of Wands', codons: [21], reversed: false}, {position: 'P1', name: 'Ace of Cups', codons: [0], reversed: true}])
  assert.equal(values.spread, 'sphere', 'the spread the journey last drew')
  assert.deepEqual(JSON.parse(values.iching), {lines: [7, 8, 9, 7, 6, 8], nuclear: 32})
  assert.equal(deckMod.readDeckAnswer(result('read', {}, 'r-2'), {operation: 'apply', location}).ok, false, 'an answer for another operation is refused')
  assert.match(deckMod.readDeckAnswer({error: 'QL refused: ql: unknown variant'}, {operation: 'read', location}).reason, /unknown variant/)
})

test('a draw needs consent to chance each time; it is written on the revision read and spends the consent', async () => {
  const calls = []
  deckMod.resetQlDeck({call: async op => { calls.push(op); return op.request.operation === 'read' ? result('read') : result('apply', {journey_revision: 3}, 'r-3') }})
  await deckMod.openDeckJourney(journey)
  let binding = deckMod.qlDeckBinding(deckMod.qlDeckState())
  assert.equal(binding.standing['act.draw'].disabled, deckMod.NO_CONSENT)
  await assert.rejects(binding.write([{key: 'act.draw', value: true}]), /consent/)
  assert.equal(calls.length, 1, 'nothing was asked without consent')
  binding.local.consent(true)
  binding.local.spread('torus-day')
  binding = deckMod.qlDeckBinding(deckMod.qlDeckState())
  assert.equal(binding.standing['act.draw'], undefined, 'consent given: Draw stands')
  await binding.write([{key: 'act.draw', value: true}])
  const apply = calls[1].request
  assert.equal(apply.operation, 'apply')
  assert.equal(apply.expected_revision, 'r-2', 'on the revision the page was read at')
  assert.equal(apply.consent_to_chance, true)
  assert.deepEqual(apply.act.request, {op: 'draw', spread: {kind: 'torus-day'}, day_ref: journey.day_ref, basis_sources: []})
  assert.equal(apply.act.actor_ref, 'person:frank', 'the act shows who made it')
  assert.equal(apply.act.request.entropy, undefined, 'the shell supplies no chance')
  assert.equal(deckMod.qlDeckState().view.consent, false, 'consent is spent by the act it allowed')
  assert.equal(deckMod.qlDeckState().result.page.revision, 'r-3', 'the answer is the journey after it')
  await assert.rejects(deckMod.qlDeckBinding(deckMod.qlDeckState()).write([{key: 'act.draw', value: true}]), /consent/)
})

test('Assign, Link and Comment are the journey\'s own acts; Move and Turn are refused in words: QL has no such act yet', async () => {
  const calls = []
  deckMod.resetQlDeck({call: async op => { calls.push(op); return op.request.operation === 'read' ? result('read') : result('apply') }})
  await deckMod.openDeckJourney(journey)
  const binding = deckMod.qlDeckBinding(deckMod.qlDeckState())
  await binding.write([{key: 'act.assign', value: JSON.stringify({card: 56, reversed: false, position: "P4'", reason: 'The Fool came to mind'})}])
  assert.deepEqual(calls.at(-1).request.act.request, {op: 'assign-symbol', card: 56, reversed: false, position: {arc: 'night', index: 4}, reason: 'The Fool came to mind', day_ref: journey.day_ref})
  assert.equal(calls.at(-1).request.consent_to_chance, false, 'an assignment is no chance')
  await binding.write([{key: 'act.comment', value: JSON.stringify({placement_ref: 'p0', text: 'A beginning.'})}])
  assert.equal(calls.at(-1).request.act.request.reading.kind, 'original')
  assert.equal(calls.at(-1).request.act.request.reading.author_ref, 'person:frank')
  await binding.write([{key: 'act.link', value: JSON.stringify({placement_ref: 'p1', source: {source_ref: 'ref:j', revision: 'r-9'}, entry: 'e1', relation: 'answers'})}])
  assert.deepEqual(calls.at(-1).request.act.request.source, {source_ref: 'ref:j', revision: 'r-9', standing_ref: 'human-flow'})
  await assert.rejects(binding.write([{key: 'act.move', value: true}]), /no act that moves/)
  await assert.rejects(binding.write([{key: 'act.turn', value: true}]), /no act that turns/)
  assert.equal(binding.standing['act.move'].disabled, deckMod.NO_MOVE)
  assert.equal(binding.writes('theme'), false, 'a concern is set when the journey opens')
  assert.throws(() => deckMod.spreadPosition('P9'), /P0 to P5/)
})

test('Technē\'s chain draws the Deck\'s design on its binding; the manifest admits it on its owner', async () => {
  deckMod.resetQlDeck({call: async () => result('read')})
  await deckMod.openDeckJourney(journey)
  const face = manifests.quaternalLogicFamilyManifest().faces.find(f => f.id === 'deck')
  assert.equal(face.admission, undefined, 'cut, not waiting'); assert.equal(face.invariant.generates, 'kernel:nara_journey')
  const entry = techne.qlFaceEntry(face, null, null, undefined, undefined, deckMod.qlDeckState())
  assert.equal(entry.binding.id, deckMod.QL_DECK_DEVICE_ID)
  assert.equal(designKey('quaternal-logic', 'deck'), deckDesign.id)
  for (const view of VIEWS) {
    const out = renderToStaticMarkup(h(HostedDevice, {designed: deckDesign, binding: entry.binding, view, nav: {}}))
    assert.ok(out.includes({folded: 'Sphere', widget: 'What the move'}[view] ?? 'Wands'), `${view}: the journey's own reading`)
  }
  deckMod.resetQlDeck()
  const empty = techne.qlFaceEntry(face, null, null, undefined, undefined, deckMod.qlDeckState())
  assert.equal(empty.binding.write, undefined, 'no journey: nothing writes')
  assert.match(renderToStaticMarkup(h(HostedDevice, {designed: deckDesign, binding: empty.binding, view: 'whole', nav: {}})), /No journey is open/)
})

// ── the Chakra: your elements, through the kernel's nara_elemental ───────────────────────────────────────────────────────

const basis = {source_ref: 'central:source:control:root:Control/self/nara/identities/p.json', revision: 's-1'}
const elemental = (over = {}) => ({outcome: {result: 'nara_elemental', data: {schema: 'oi.nara-elemental/v1', source: basis, person_ref: 'person:frank', basis: 'natal',
  elemental: {schema: 'ql.nara-elemental-reading/v1', contributions: {fire: {contribution_strength: 2, confidence: null}, water: {contribution_strength: 1, confidence: null},
    earth: {contribution_strength: 3, confidence: null}, air: {contribution_strength: 4, confidence: null}}, unknown_elements: [],
    raw_quaternion: {w: 3, x: 2, y: 1, z: 4}, normalized_quaternion: {w: 0.55, x: 0.37, y: 0.18, z: 0.73},
    source: {...basis, standing_ref: 'ql.nara-natal-composition/v1'}, consent: 'granted', standing: 'typed-observation-mapping'},
  natal_counts: [1, 2, 0, 1, 2, 0, 1], ...over}}})

test('the Chakra reads your elements and natal distribution once per identity; today\'s centres stand absent with their owner named', async () => {
  const calls = []
  chakraMod.resetQlChakra({call: async op => { calls.push(op); return elemental() }})
  await chakraMod.syncQlChakra(null, chakraMod.NO_IDENTITY)
  assert.equal(chakraMod.qlChakraValues(chakraMod.qlChakraState(), {reading: null}).reason, chakraMod.NO_IDENTITY)
  await chakraMod.syncQlChakra(basis)
  await chakraMod.syncQlChakra(basis)
  assert.equal(calls.length, 1, 'one read for one identity at one revision')
  assert.deepEqual(calls[0], {op: 'nara_elemental', request: {operation: 'map', source_ref: basis.source_ref, expected_revision: 's-1'}})
  const values = chakraMod.qlChakraValues(chakraMod.qlChakraState(), {reading: {ok: true, sky: {epochUtc: '2026-10-18T12:00:00Z'}}})
  assert.equal(values['natal.counts'], JSON.stringify([1, 2, 0, 1, 2, 0, 1]))
  assert.equal(JSON.parse(values.elements).contributions.earth.contribution_strength, 3)
  assert.equal(values.epoch, '2026-10-18T12:00:00Z', 'the date follows the Sky')
  assert.equal(values.centres, undefined, 'no owner carries today\'s centres to the shell')
  assert.equal(values.reason, chakraMod.NO_CENTRES)
  const binding = chakraMod.qlChakraBinding(chakraMod.qlChakraState())
  assert.equal(binding.write, undefined, 'a reading of your identity changes nothing')
  assert.equal(binding.standing.centres.disabled, chakraMod.NO_CENTRES)
  assert.equal(chakraMod.readChakraAnswer(elemental({source: {source_ref: basis.source_ref, revision: 's-0'}}), basis).ok, false, 'another revision is refused')
  const face = manifests.quaternalLogicFamilyManifest().faces.find(f => f.id === 'chakra')
  assert.equal(face.admission, undefined, 'cut, not waiting'); assert.ok(face.invariant.generatesAbsent)
  const entry = techne.qlFaceEntry(face, null, null, undefined, undefined, undefined, chakraMod.qlChakraState())
  for (const view of VIEWS) assert.ok(renderToStaticMarkup(h(HostedDevice, {designed: chakraDesign, binding: entry.binding, view, nav: {}})).length > 0, view)
  chakraMod.resetQlChakra()
})
