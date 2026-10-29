import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'
import {readFileSync} from 'node:fs'

// Binding's engine (DLW §22.3 "The Binding skin", O-I #684): the M3 clock's Binding skin reads QL's engine over the cell it draws —
// `ql kernel m3-binding -` (QL-MEF crates/ql-mef/src/m3_binding.rs, LightBox's QCD law) through the kernel's ql_read {kind: 'm3-binding'}:
// the coupling at its scale, the string's stretch and energy, each codon's coin values, and the kernel event behind the last motion (the
// form's last applied receipt). The engine's settings are Binding's own (Charge, Tension, Coupling), held by the view and read at the
// manual's starting values until held. Nothing is drawn by chance and nothing in the shell computes the physics.
// Channels:
// - REAL (tests/fixtures/ql-m3-binding-2026-10-29.json): the engine's answer for hexagram 17 under moving and resting after a set-matrix
//   replayed by `ql kernel m3` (QL-MEF dlw/684-binding-engine); the M3 form (tests/fixtures/ql-m3-state-2026-10-21.json).
// - SCRIPTED: the kernel call, a stand-in that answers as the kernel's owner_routes.rs ql_read does, and records what it was asked.
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

const binding = await import('../src/inhabitants/ql/devices/qlBinding.ts')
const engine = await import('../src/inhabitants/ql/devices/qlBindingEngine.ts')

const REAL = JSON.parse(readFileSync(new URL('./fixtures/ql-m3-binding-2026-10-29.json', import.meta.url), 'utf8'))
const STATE = JSON.parse(readFileSync(new URL('./fixtures/ql-m3-state-2026-10-21.json', import.meta.url), 'utf8')).answer.state
const identity = {selection_ref: 'nara-identity-selection:1', source: {source_ref: 'central:nara/identity/p1', revision: 'r9'}, reading: {person_ref: 'person:p1', nara_ref: 'nara:p1'}}
const m3Of = (receipts = [REAL.receipt]) => ({key: 'k', basis: {identity, expression: {expression_ref: 'expression:kept', revision: 3}}, busy: false, reason: null, view: {},
  reading: {schema: 'oi.m3-reception-context/v1', status: 'available', person_ref: 'person:p1', expression_ref: 'expression:kept', expression_revision: 3, state: STATE, receipts}})
const answering = (data, asked) => async op => { asked.push(op); return {outcome: {result: 'owner_route_reading', route: 'ql kernel m3-binding', data}} }

test('the engine is asked of the cell the skin draws, at the manual\'s starting physics until you hold your own, with the form\'s last receipt', () => {
  const request = engine.bindingRequestOf(m3Of(), {})
  assert.deepEqual(request, {...REAL.input, receipt: REAL.receipt}, 'hexagram 17 under the law\'s matrix, pp, 0.9 GeV/fm, 1 GeV, and the last receipt')
  const held = engine.bindingRequestOf(m3Of([]), {'pairing.matrix': 'complementary', 'charge.register': 'mm', 'string.tension': 0.4, 'coupling.scale': 3})
  assert.deepEqual(held, {hexagram: 17, matrix: 'complementary', register: 'mm', tension_gev_per_fm: 0.4, coupling_scale_gev: 3}, 'no receipt: none is sent')
  assert.equal(engine.bindingRequestOf({...m3Of(), reading: null, reason: 'No Nara identity is chosen.'}, {}), null, 'no form, no request')
})

test('the skin draws the engine\'s coupling, stretch, energy, coin values and event, and names each where the engine has not answered', async () => {
  const asked = []
  engine.resetBindingEngine({call: answering(REAL.answer, asked)})
  await engine.syncBindingEngine(m3Of(), {})
  assert.deepEqual(asked, [{op: 'ql_read', request: {kind: 'm3-binding', request: {...REAL.input, receipt: REAL.receipt}}}])
  const read = binding.qlBindingBinding({m3: m3Of(), held: {}, engine: engine.bindingEngineState()})
  assert.equal(read.values['coupling.alpha'], REAL.answer.coupling.alpha_s)
  assert.equal(read.values['string.stretch'], 0.8)
  assert.equal(read.values['string.energy'], REAL.answer.string.energy_gev)
  assert.equal(read.values['values.positive'], '[8,8,8]')
  assert.equal(read.values['values.negative'], '[8,9,8]')
  assert.equal(read.values['event.kind'], 'matrix')
  assert.equal(read.values['event.what'], 'Complementary to moving and resting')
  assert.deepEqual([read.values['charge.register'], read.values['string.tension'], read.values['coupling.scale']], ['pp', 0.9, 1], 'the physics the engine read with')
  for (const key of ['coupling.alpha', 'string.stretch', 'string.energy', 'values.positive', 'event.kind']) assert.match(read.standing[key].disabled, /A reading of Binding's engine/, `${key} is read`)
  // Asked again with nothing changed, the engine is not asked again.
  await engine.syncBindingEngine(m3Of(), {})
  assert.equal(asked.length, 1)
  // A held Tension the engine has not answered: its readings wait, and none is drawn from the old answer.
  const waiting = binding.qlBindingBinding({m3: m3Of(), held: {'string.tension': 0.3}, engine: engine.bindingEngineState()})
  assert.equal(waiting.values['string.energy'], undefined)
  assert.ok(waiting.waiting.includes('string.energy'))
  // QL refuses: its words stand on every engine reading.
  engine.resetBindingEngine({call: async () => ({error: 'ql: Tension is 0.1 to 2 GeV/fm, got 9'})})
  await engine.syncBindingEngine(m3Of(), {})
  const refused = binding.qlBindingBinding({m3: m3Of(), held: {}, engine: engine.bindingEngineState()})
  assert.match(refused.standing['string.energy'].disabled, /Tension is 0\.1 to 2/)
  assert.equal(refused.values['coupling.alpha'], undefined)
  engine.resetBindingEngine()
})

test('a singlet has no string and no energy; a form no event has moved names none; the nonet and Stretch → Q keep their routes', async () => {
  const singlet = structuredClone(REAL.answer)
  singlet.cell.non_dual = true; singlet.string.charge_between = 0; singlet.string.stretch_fm = 0; singlet.string.energy_gev = null; singlet.event = null
  engine.resetBindingEngine({call: answering(singlet, [])})
  await engine.syncBindingEngine(m3Of([]), {})
  const read = binding.qlBindingBinding({m3: m3Of([]), held: {}, engine: engine.bindingEngineState()})
  assert.equal(read.values['string.stretch'], 0)
  assert.equal(read.values['string.energy'], undefined)
  assert.match(read.standing['string.energy'].disabled, /singlet/)
  assert.match(read.standing['event.kind'].disabled, /No M3 event has moved/)
  assert.match(read.standing.nonet.disabled, /ql_m3_epogdoon/)
  assert.match(read.standing['sound.stretchQ'].disabled, /Resonance's Q/)
  engine.resetBindingEngine()
})
