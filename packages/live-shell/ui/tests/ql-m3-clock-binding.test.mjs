import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'

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
const form = (over = {}) => ({schema: 'ql.m3-state/v1', identity: {event_ref: 'event:e', profile_generation: 7},
  clock: {steps: 419, degree720: 419, degree360: 59, completed_double_covers: 0, backbone: {id: 'b', ref: '#3-5-1-3'}, tick12: 1},
  aperture: {index: 2, total_lenses: 16, division_deg10: 40, reciprocal_index: 14, fibonacci_phase60: 0},
  form: {address: 17}, transcription: {rna: false, sequence: 'TAT'}, ...over})
const reading = (over = {}) => ({schema: 'oi.m3-reception-context/v1', status: 'available', nara_ref: 'nara:p1', person_ref: 'person:p1',
  expression_ref: 'expression:kept', expression_revision: 3, identity_source_ref: 'central:nara/identity/p1', identity_revision: 'r9',
  profile_ref: 'p', profile_revision: 'pr', coordinate_ref: 'c', event_ref: 'event:e', revision: 'm3r', state: form(), receipts: [],
  private: true, public_export: false, activity_admitted: false, ...over})
const answer = data => ({outcome: {result: 'm3_reception', data}})
const VIEWS = ['folded', 'compact', 'whole', 'full', 'widget']

test('the encounter is the frame\'s: the chosen identity and the open Expression, project O-I; a foreign answer is refused', () => {
  assert.deepEqual(m3.m3Binding(basis), {operation: 'context', source_ref: 'central:nara/identity/p1', expected_revision: 'r9',
    person_ref: 'person:p1', nara_ref: 'nara:p1', expression_ref: 'expression:kept', role: 'nara'})
  assert.equal(m3.QL_M3_PROJECT, 'O-I')
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
  assert.deepEqual(calls[0], {op: 'm3_reception', project: 'O-I', request: {operation: 'read', binding: m3.m3Binding(basis)}})
  const values = m3.qlM3Values(m3.qlM3State())
  assert.deepEqual(values, {'clock.degree720': 419, 'clock.tick12': 1, 'clock.backbone': '#3-5-1-3', 'aperture.index': 2, 'form.address': 17, 'form.codon': 'TAT'})
  for (const key of Object.keys(design.defaults).filter(key => !['turn', 'open', 'readout', 'reciprocal'].includes(key))) assert.ok(key in values, `${key} from the owner`)
  const binding = m3.qlM3Binding(m3.qlM3State())
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
