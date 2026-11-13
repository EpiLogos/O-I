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

// PARITY bind-5: the M3 clock's Reading band draws "pose · bin|slot" from pose.bin / pose.slot (quaternal-logic__m3-clock.tsx), which
// qlM3Values never filled: the readout stood empty on every real form. QL names both (form.pose; law.pose_map.slots[].current).
test('PARITY bind-5: the active pose is read from the state, the raw bin and the lawful slot apart', async () => {
  const slots = REAL.law.pose_map.slots.map((slot, index) => ({...slot, current: index === 5, slot: index, lawful_slot: index === 5 ? 7 : slot.lawful_slot}))
  const state = form({form: {address: 17, pose: 5}, law: {...REAL.law, pose_map: {...REAL.law.pose_map, in_force: 'lawful-slot', slots}}})
  m3.resetQlM3({call: async () => answer(reading({state}))})
  await m3.syncQlM3(basis)
  const values = m3.qlM3Values(m3.qlM3State())
  assert.equal(values['pose.bin'], 5, 'the raw bin is the form\'s pose')
  assert.equal(values['pose.slot'], 7, 'the lawful slot is the one the pose map marks current')
  // A state with no form.pose still names its bin through the current slot; one with no current slot fills neither (never a guess).
  const noPose = form({form: {address: 17}, law: {...REAL.law, pose_map: {...REAL.law.pose_map, slots}}})
  m3.resetQlM3({call: async () => answer(reading({state: noPose}))})
  await m3.syncQlM3(basis)
  assert.equal(m3.qlM3Values(m3.qlM3State())['pose.bin'], 5)
  const none = form({law: {...REAL.law, pose_map: {...REAL.law.pose_map, slots: slots.map(slot => ({...slot, current: false}))}}})
  m3.resetQlM3({call: async () => answer(reading({state: none}))})
  await m3.syncQlM3(basis)
  const bare = m3.qlM3Values(m3.qlM3State())
  assert.equal('pose.bin' in bare || 'pose.slot' in bare, false)
})
