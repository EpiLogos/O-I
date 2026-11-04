import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'
import {readFileSync} from 'node:fs'

// R5: the M3 clock on its owner — the person's M3 form (ql.m3-state/v1) through the kernel's m3_reception, on the encounter the frame's
// Nara instrument uses (naraChannel.ts operation 'm3'). A fixture call stands in for the kernel: the encounter is the chosen identity
// and the open Expression; an answer for another person or Expression is refused; a new degree advances the clock forward on the
// double cover, a new cut is set-aperture; no identity, no Expression or no opened form leaves every value absent and says which.
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
const m3 = await import('../src/inhabitants/ql/devices/qlM3Clock.ts')
const techne = await import('../src/inhabitants/ql/devices/TechneDevices.tsx')
const manifests = await import('../src/inhabitants/quaternalLogicFamilyManifest.ts')
const {HostedDevice} = await import('../src/frame/devices/deviceHost.tsx')
const {designKey} = await import('../src/frame/devices/designs.ts')
const design = (await import('../src/inhabitants/catalogue/panels/quaternal-logic__m3-clock.tsx')).design
const kernelOps = await import('../src/inhabitants/sdk/kernelOps.ts')

const identity = {selection_ref: 'nara-identity-selection:1', source: {source_ref: 'central:nara/identity/p1', revision: 'r9'},
  reading: {person_ref: 'person:p1', nara_ref: 'nara:p1', profile: {person_ref: 'person:p1', nara_ref: 'nara:p1'}}}
const basis = {identity, expression: {expression_ref: 'expression:kept', revision: 3}}
// The generation law and its cell as the installed QL answers them for form 17 under moving and resting (REAL, tests/fixtures/ql-m3-state-2026-10-21.json).
const REAL = JSON.parse(readFileSync(new URL('./fixtures/ql-m3-state-2026-10-21.json', import.meta.url), 'utf8')).answer.state
const form = (over = {}) => ({schema: 'ql.m3-state/v1', identity: {event_ref: 'event:e', profile_generation: 7}, law: REAL.law, generation: REAL.generation,
  clock: {steps: 419, degree720: 419, degree360: 59, completed_double_covers: 0, backbone: {id: 'b', ref: '#3-5-1-3'}, tick12: 1},
  aperture: {index: 2, total_lenses: 16, division_deg10: 40, reciprocal_index: 14, fibonacci_phase60: 0},
  form: {address: 17}, transcription: {rna: false, sequence: 'TAT'}, ...over})
const reading = (over = {}) => ({schema: 'oi.m3-reception-context/v1', status: 'available', nara_ref: 'nara:p1', person_ref: 'person:p1',
  expression_ref: 'expression:kept', expression_revision: 3, identity_source_ref: 'central:nara/identity/p1', identity_revision: 'r9',
  profile_ref: 'p', profile_revision: 'pr', coordinate_ref: 'c', event_ref: 'event:e', revision: 'm3r', state: form(), receipts: [],
  private: true, public_export: false, activity_admitted: false, ...over})
const answer = data => ({outcome: {result: 'm3_reception', data}})
const VIEWS = ['folded', 'compact', 'whole', 'full', 'widget']

test('the encounter is the frame\'s: the chosen identity and the open Expression, in the world\'s root register; a foreign answer is refused', () => {
  assert.deepEqual(m3.m3Binding(basis), {operation: 'context', source_ref: 'central:nara/identity/p1', expected_revision: 'r9',
    person_ref: 'person:p1', nara_ref: 'nara:p1', expression_ref: 'expression:kept', role: 'nara'})
  // REPLACED (O-I #740 lane B): project 'O-I'; the frame's Nara channel and the clock ask in the world's root register ('', agent/worldScope.ts).
  assert.equal(m3.QL_M3_PROJECT, '')
  assert.equal(m3.readM3Answer(answer(reading()), basis).ok, true)
  assert.match(m3.readM3Answer(answer(reading({expression_revision: 4})), basis).reason, /another person, Expression or revision/)
  assert.match(m3.readM3Answer({error: 'kernel down'}, basis).reason, /kernel down/)
  assert.ok(kernelOps.KERNEL_OPS.includes('m3_reception'), 'the op list carries ops whose names hold a digit')
})

test('the form is read once per encounter; a new degree advances forward on the double cover, a new cut is set-aperture', async () => {
  const calls = []
  let next = reading()
  m3.resetQlM3({call: async op => { calls.push(op); return answer(next) }})
  await m3.syncQlM3(basis)
  await m3.syncQlM3(basis)
  assert.equal(calls.length, 1, 'one read for one encounter')
  assert.deepEqual(calls[0], {op: 'm3_reception', project: '', request: {operation: 'read', binding: m3.m3Binding(basis)}})
  const values = m3.qlM3Values(m3.qlM3State())
  assert.deepEqual(values, {'clock.degree720': 419, 'clock.tick12': 1, 'clock.backbone': '#3-5-1-3', 'aperture.index': 2, 'form.address': 17, 'form.codon': 'TAT',
    'law.matrix': 'moving-resting', 'law.seed': 'sum-difference-mod', 'law.poseMap': 'raw-bin',
    'generation.lower': 'CT', 'generation.upper': 'CC', 'generation.positive': 'CCC', 'generation.negative': 'CTC', 'generation.nonDual': false})
  // The Rack page's keys are the rack's (qlRack.ts): the rack absent with its reason until it is read, the part in the view's own hand.
  const binding = m3.qlM3Binding(m3.qlM3State())
  // Skin (Wheel or Binding) is the view's own choice; the Binding skin's keys stand under `binding.` and are hosted by prefixing Binding's
  // own binding (DLW §22.3, "The Binding skin"). Both wait for qlM3Binding to carry them.
  for (const key of Object.keys(design.defaults).filter(key => !['turn', 'open', 'readout', 'reciprocal', 'skin'].includes(key) && !key.startsWith('binding.')))
    assert.ok(key in values || binding.standing[key]?.disabled || binding.local[key], `${key} from the owner, named absent, or the view's own`)
  assert.deepEqual(Object.keys(m3.QL_M3_ABSENT), [], 'no key of the M3 clock lacks its owner now')
  assert.equal('rack' in binding.values, false, 'the rack is not read in this test')
  assert.ok(binding.standing.rack.disabled.length > 8, 'the rack names why it is not drawn')
  assert.equal(typeof binding.local['rack.part'], 'function', 'the part you choose is the view\'s own')
  assert.equal(designKey('quaternal-logic', m3.QL_M3_FACE), design.id)
  next = reading({state: form({clock: {...form().clock, steps: 424, degree720: 4}, aperture: {...form().aperture, index: 5}})})
  await binding.write([{key: 'clock.degree720', value: 4}, {key: 'aperture.index', value: 5}])
  assert.deepEqual(calls[1].request, {operation: 'apply', expected_generation: 7, binding: m3.m3Binding(basis),
    operations: [{operation: 'advance-clock', steps: 305}, {operation: 'set-aperture', aperture: 5}]}, 'from 419 to 4 is 305 steps forward')
  assert.equal(m3.qlM3Values(m3.qlM3State())['clock.degree720'], 4, 'the answer is the form after them')
  assert.throws(() => m3.qlM3Operations(m3.qlM3State(), [{key: 'form.address', value: 3}]), /chosen in the Nara instrument/)
  assert.throws(() => m3.qlM3Operations(m3.qlM3State(), [{key: 'aperture.index', value: 16}]), /one of the owner's 16 apertures/)
  m3.qlM3Binding(m3.qlM3State()).local.readout('degree')
  assert.equal(m3.qlM3Values(m3.qlM3State()).readout, 'degree', 'the view\'s own choice, in its own hand')
})

test('no identity, no Expression or no opened form: every value absent, the well says which, nothing writes', async () => {
  m3.resetQlM3({call: async () => answer(reading({status: 'absent', state: null}))})
  await m3.syncQlM3(null, m3.NO_IDENTITY)
  assert.deepEqual(m3.qlM3Values(m3.qlM3State()), {reason: m3.NO_IDENTITY})
  await m3.syncQlM3(null, m3.NO_EXPRESSION)
  assert.equal(m3.qlM3Values(m3.qlM3State()).reason, m3.NO_EXPRESSION)
  await m3.syncQlM3(basis)
  const binding = m3.qlM3Binding(m3.qlM3State())
  assert.equal(binding.values.reason, m3.NO_FORM); assert.equal(binding.write, undefined); assert.equal(binding.writes('clock.degree720'), false)
  assert.equal(binding.standing['aperture.index'].disabled, m3.NO_FORM)
  await assert.rejects(m3.applyQlM3([{operation: 'reciprocal-aperture'}]), /No M3 form is open/)
})

test('Technē\'s chain draws the design on the binding; the manifest admits the face on its owner', async () => {
  m3.resetQlM3({call: async () => answer(reading())})
  await m3.syncQlM3(basis)
  const face = manifests.quaternalLogicFamilyManifest().faces.find(f => f.id === 'm3-clock')
  assert.ok(face, 'the manifest declares the face')
  assert.equal(face.admission, undefined, 'admitted, not waiting'); assert.equal(face.invariant.generates, 'kernel:m3_reception')
  const entry = techne.qlFaceEntry(face, null, null, undefined, m3.qlM3State())
  assert.equal(entry.binding.id, m3.QL_M3_DEVICE_ID)
  for (const view of VIEWS) assert.ok(renderToStaticMarkup(h(HostedDevice, {designed: design, binding: entry.binding, view, nav: {}})).length > 0, view)
  m3.resetQlM3()
})

// O-I #771 (the owner's ruling of 4 Nov 2026): a singlet strikes the Torus at its codon's place on the ring. The trigger is an applied M3
// event at m3_reception that leaves the cell non-dual: the event Binding reads (QL-MEF m3_binding.rs binding_event: a form inscribed, a
// line changed, a matrix changed), never the per-tick form advance. The cell, its non-duality and its singlet are QL's; the clock sends
// the codon through the one stage channel and the Torus places it.
const nativeM3 = await import('../../../../desktop/cradle/src/nara/nativeM3.ts')
const torusInstrument = await import('../src/live/torusInstrument.ts')
// Hexagram 17 under complementary and under same-quality, as the installed QL answered it (REAL.generation.cells): non-dual, singlets 58 and 10.
const underMatrix = index => ({...REAL.generation, matrix: REAL.generation.cells[index].matrix, cell: REAL.generation.cells[index]})
const applied = (operations, after, over = {}) => ({schema: 'ql.m3-receipt/v1', event_ref: 'event:e', subject_ref: 's', status: 'applied',
  before_generation: after - 1, after_generation: after, command: {operations}, ...over})
const appliedReading = (generation, operations, after, over = {}) => reading({state: form({identity: {event_ref: 'event:e', profile_generation: after}, generation}),
  receipts: [applied(operations, after, over)]})

test('the singlet an applied M3 event leaves is QL\'s own: a motion that leaves the cell non-dual names its codon, nothing else does', () => {
  const {singletOfApplied} = nativeM3
  assert.equal(singletOfApplied(appliedReading(underMatrix(0), [{operation: 'set-matrix', family: 0}], 8)), 58, 'complementary: GCC')
  assert.equal(singletOfApplied(appliedReading(underMatrix(2), [{operation: 'apply-matrix', family: 2}], 8)), 10, 'same-quality')
  for (const operation of [{operation: 'select-form', address: 17}, {operation: 'change-line', line: 2},
    {operation: 'cast-creases', angles_deg10: [0, 0, 0], velocities_deg10: [0, 0, 0]}])
    assert.equal(singletOfApplied(appliedReading(underMatrix(0), [{operation: 'set-aperture', aperture: 3}, operation], 8)), 58, operation.operation)
  assert.equal(singletOfApplied(appliedReading(underMatrix(1), [{operation: 'set-matrix', family: 1}], 8)), null, 'a dual cell is a meson, no singlet')
  for (const operation of [{operation: 'advance-clock', steps: 5}, {operation: 'set-aperture', aperture: 3}, {operation: 'set-pose', pose: 1},
    {operation: 'reciprocal-aperture'}, {operation: 'transcribe', rna: true}, {operation: 'spanda-advance', tick12: 3, cycle: 0}])
    assert.equal(singletOfApplied(appliedReading(underMatrix(0), [operation], 8)), null, `${operation.operation} leaves the cell where it was: no event`)
  assert.equal(singletOfApplied(appliedReading(underMatrix(0), [{operation: 'set-matrix', family: 0}], 8, {status: 'refused'})), null, 'only an applied receipt')
  assert.equal(singletOfApplied(appliedReading(underMatrix(0), [{operation: 'set-matrix', family: 0}], 8, {after_generation: 6})), null,
    'a receipt that did not leave this state is another event')
  assert.equal(singletOfApplied(reading({state: form({generation: underMatrix(0)}), receipts: []})), null, 'a form read, not an event')
  assert.equal(singletOfApplied(reading({status: 'absent', state: null, receipts: null})), null)
  assert.equal(singletOfApplied(null), null)
})

test('an applied M3 event that leaves the cell non-dual strikes its singlet on the Torus through the one stage channel; any other, nothing', async () => {
  const sent = []
  let answerOf = () => ({ok: true})
  torusInstrument.setLiveInstrumentCommander(command => { sent.push(command); return Promise.resolve(answerOf(command)) })
  try {
    let next = reading(), respond = () => answer(next)
    m3.resetQlM3({call: async () => respond()})
    await m3.syncQlM3(basis)
    assert.deepEqual(sent, [], 'reading the form strikes nothing')
    next = appliedReading(underMatrix(0), [{operation: 'set-matrix', family: 0}], 8)
    await m3.qlM3Binding(m3.qlM3State()).write([{key: 'law.matrix', value: 'complementary'}])
    assert.deepEqual(sent, [{command: 'singlet', codon: 58}], 'the codon QL names, and nothing the shell works out')
    next = appliedReading(underMatrix(1), [{operation: 'set-matrix', family: 1}], 9)
    await m3.applyQlM3([{operation: 'set-matrix', family: 1}])
    assert.equal(sent.length, 1, 'a dual cell strikes nothing')
    next = appliedReading(underMatrix(0), [{operation: 'advance-clock', steps: 5}], 10)
    await m3.applyQlM3([{operation: 'advance-clock', steps: 5}])
    assert.equal(sent.length, 1, 'a clock step names no event')
    // The Torus refusing the singlet (no live instrument, a held one) leaves the M3 event applied: the form is the owner's answer.
    answerOf = () => ({ok: false, error: 'Open the live instrument first'})
    next = appliedReading(underMatrix(2), [{operation: 'set-matrix', family: 2}], 11)
    await m3.applyQlM3([{operation: 'set-matrix', family: 2}])
    assert.deepEqual(sent.at(-1), {command: 'singlet', codon: 10})
    assert.equal(m3.qlM3State().reading.state.identity.profile_generation, 11)
    assert.equal(m3.qlM3State().reason, null)
    // A refused M3 event strikes nothing.
    const before = sent.length
    respond = () => ({error: 'stale generation'})
    await assert.rejects(m3.applyQlM3([{operation: 'set-matrix', family: 0}]), /stale generation/)
    assert.equal(sent.length, before)
  } finally { torusInstrument.setLiveInstrumentCommander(null); m3.resetQlM3() }
})

test('a singlet the Torus refuses is said in words on the clock, the M3 event standing; one that plays clears it', async () => {
  // DLW §16.14, the frame's own M3 page (nativeField.ts onM3Applied): the refusal is said plainly through shared/Refusal.tsx refusalWords.
  let answerOf = () => ({ok: false, error: 'No live instrument plays: open the instrument'})
  torusInstrument.setLiveInstrumentCommander(command => Promise.resolve(answerOf(command)))
  const settle = async () => { for (let i = 0; i < 4; i++) await new Promise(resolve => setImmediate(resolve)) }
  const whole = () => renderToStaticMarkup(h(HostedDevice, {designed: design, binding: m3.qlM3Binding(m3.qlM3State()), view: 'whole', nav: {}}))
  try {
    let next = reading()
    m3.resetQlM3({call: async () => answer(next)})
    await m3.syncQlM3(basis)
    assert.equal(m3.qlM3Values(m3.qlM3State())['singlet.why'], undefined, 'nothing is refused before a singlet is struck')
    assert.doesNotMatch(whole(), /was not played on the Torus/)
    next = appliedReading(underMatrix(2), [{operation: 'set-matrix', family: 2}], 11)
    await m3.applyQlM3([{operation: 'set-matrix', family: 2}])
    await settle()
    assert.equal(m3.qlM3Values(m3.qlM3State())['singlet.why'], 'Singlet 10 was not played on the Torus. No live instrument plays: open the instrument.')
    assert.equal(m3.qlM3State().reading.state.identity.profile_generation, 11, 'the M3 event stands')
    assert.equal(m3.qlM3Binding(m3.qlM3State()).writes('singlet.why'), false, 'a reading, not a write')
    assert.match(whole(), /Singlet 10 was not played on the Torus\. No live instrument plays: open the instrument\./, 'the clock says it where its reading is')
    // The owner's words in code stay behind: only what happened is said.
    answerOf = () => ({ok: false, error: 'stage_command {"command":"singlet"} at host.ts:212'})
    next = appliedReading(underMatrix(0), [{operation: 'set-matrix', family: 0}], 12)
    await m3.applyQlM3([{operation: 'set-matrix', family: 0}])
    await settle()
    assert.equal(m3.qlM3Values(m3.qlM3State())['singlet.why'], 'Singlet 58 was not played on the Torus.')
    // An event that strikes no singlet leaves the last refusal said; a singlet that plays clears it.
    next = appliedReading(underMatrix(0), [{operation: 'advance-clock', steps: 5}], 13)
    await m3.applyQlM3([{operation: 'advance-clock', steps: 5}])
    await settle()
    assert.equal(m3.qlM3Values(m3.qlM3State())['singlet.why'], 'Singlet 58 was not played on the Torus.')
    answerOf = () => ({ok: true})
    next = appliedReading(underMatrix(2), [{operation: 'set-matrix', family: 2}], 14)
    await m3.applyQlM3([{operation: 'set-matrix', family: 2}])
    await settle()
    assert.equal(m3.qlM3Values(m3.qlM3State())['singlet.why'], undefined)
    assert.doesNotMatch(whole(), /was not played on the Torus/)
  } finally { torusInstrument.setLiveInstrumentCommander(null); m3.resetQlM3() }
})
