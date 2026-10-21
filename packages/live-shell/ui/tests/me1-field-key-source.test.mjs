import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'
import {createElement, isValidElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'

// ME1 (DLW §20.2 Field, §20.14 Resonance): the Key source and the Frequency driver offer the manual's values, in the manual's order,
// and write the Scene field they belong to. Production sources through the same TypeScript loader as native-device-resonance.test.mjs;
// the reading is a fixture, not a native owner.
//   Frequency driver: Torus · Manual · Focus · Automation  (default Torus)   — §20.14
//   Key source:       Torus · Sky · Manual                 (default Torus)   — §20.2
const root = new URL('../../../../', import.meta.url)
const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
const parameters = new URL('packages/expressions-boundary/src/parameters.ts', root).href
register(`data:text/javascript,${encodeURIComponent(`import ts from ${JSON.stringify(compiler)};import {readFile} from 'node:fs/promises';export async function resolve(s,c,n){if(s==='@epilogos/expressions-boundary/parameters')return n(${JSON.stringify(parameters)},c);try{return await n(s,c)}catch(e){if(!s.startsWith('.'))throw e;if(s.endsWith('.js')){try{return await n(s.slice(0,-3)+'.ts',c)}catch{}}for(const x of ['.ts','.tsx']){try{return await n(s+x,c)}catch{}}throw e}}export async function load(u,c,n){if(u.endsWith('.css'))return {format:'module',shortCircuit:true,source:'export {}'};if(u.endsWith('?raw'))return {format:'module',shortCircuit:true,source:'export default '+JSON.stringify(await readFile(new URL(u.split('?')[0]),'utf8'))};if(!u.endsWith('.ts')&&!u.endsWith('.tsx'))return n(u,c);return {format:'module',shortCircuit:true,source:ts.transpileModule(await readFile(new URL(u),'utf8'),{fileName:new URL(u).pathname,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText}}`)}`, import.meta.url)
globalThis.document = {getElementById: () => null, createElement: () => ({}), head: {appendChild: () => {}}}

const [{FIELD_PANEL_SETTINGS}, edits, author, model, resonanceModel, resonanceView, focusView, {FIELD_FACE_MODELS}, {NATIVE_BINDINGS}] = await Promise.all([
  import('../../../expressions-boundary/src/nativeFieldPanelSettings.ts'),
  import('../../../expressions-boundary/src/nativeDeviceEdits.ts'),
  import('../../../../desktop/cradle/expressions-app/field-studies-journeys/src/model.ts'),
  import('../src/components/devices/expressionsDevice.ts'),
  import('../src/components/nativeFieldFace.resonance.ts'),
  import('../src/components/NativeFieldFace.resonance.tsx'),
  import('../src/components/NativeFieldFace.focus.tsx'),
  import('../src/components/nativeFieldFaceModel.ts'),
  import(parameters),
])
void FIELD_FACE_MODELS; void NATIVE_BINDINGS

const MANUAL_DRIVERS = ['torus', 'manual', 'focus', 'automation']
const MANUAL_KEYS = ['torus', 'sky', 'manual']
const panel = (key, value) => ({kind: 'panel-setting', key, value})

const ENGINE = {mediumEnabled: false, resonanceEnabled: true, collisionEnabled: false, pairwiseEnabled: false, morphEnabled: false,
  colorEnabled: false, trajectory: 'toroidalHopf', driveShape: 'sine', colorMode: 'linearGradient', mediumPlane: 'vertical', autoOscillate: true,
  resonatorMode: 'resonator'}
function reading(composition = {}) {
  return {
    basis: {expression_ref: 'expr:fixture', revision: 1, scene_ref: 'scene:fixture', authored_revision: 1},
    scene: {name: 'Fixture', entities: [], engine: {...ENGINE}, composition: {layout: 'free', plane: 'XY', focus: 'parallel', focusDuration: 4, carryTint: true, carryStation: false, ...composition},
      morph: {law: 'theta'}, automation: [], field: {background: '#ffffff', palette: ['#111111'], material: 'ink', params: {}}},
    entityOccurrences: {}, chosenControls: {available: false, entries: [], controls: []}, devices: [],
    selection: {entity_ids: [], step_id: null}, history: {canUndo: false, canRedo: false}, standing: {dirty: false, pending: false, notice: null},
  }
}
function collect(node, out = []) {
  if (Array.isArray(node)) node.forEach(child => collect(child, out))
  else if (isValidElement(node)) { out.push(node); collect(node.props.children, out) }
  return out
}

test('the editor admits the Frequency driver\'s four values in the manual\'s order, and the Key source\'s three on the composition', () => {
  assert.deepEqual([...FIELD_PANEL_SETTINGS.frequencyDriver.options], MANUAL_DRIVERS)
  assert.deepEqual(FIELD_PANEL_SETTINGS.keySource, {target: 'composition', type: 'enum', options: MANUAL_KEYS})
})

test('the editor refuses a driver or key the manual does not name, and writes the ones it does at their Scene path', () => {
  assert.doesNotThrow(() => edits.validateNativeFieldPanelChange(panel('frequencyDriver', 'torus')))
  assert.doesNotThrow(() => edits.validateNativeFieldPanelChange(panel('keySource', 'sky')))
  assert.throws(() => edits.validateNativeFieldPanelChange(panel('frequencyDriver', 'bogus')), /admitted native Field panel setting/)
  assert.throws(() => edits.validateNativeFieldPanelChange(panel('keySource', 'bogus')), /admitted native Field panel setting/)
  assert.throws(() => edits.validateNativeFieldPanelChange(panel('keySource', true)), /admitted native Field panel setting/)
  const journey = author.blankJourney()
  const written = edits.applyNativeDeviceChanges(journey, journey.scenes[0].id, [panel('keySource', 'sky'), panel('frequencyDriver', 'manual')])
  assert.equal(written.scenes[0].composition.keySource, 'sky')
  assert.equal(written.scenes[0].composition.frequencyDriver, 'manual')
  assert.equal(journey.scenes[0].composition.keySource, 'torus', 'the caller\'s document is not mutated')
})

test('the Resonance device offers the Frequency driver in the manual\'s order, Torus first', () => {
  const choices = model.expressionsSettingChoices('resonance', 'frequencyDriver')
  assert.deepEqual(choices.map(choice => choice.value), MANUAL_DRIVERS)
  assert.equal(choices[0].label, 'Torus')
  const focus = model.expressionsSettingChoices('focus', 'frequencyDriver')
  assert.deepEqual(focus.map(choice => choice.value), MANUAL_DRIVERS, 'the same setting, so the same values wherever it is set')
})

test('the Resonance device reads the driver the Scene carries, and writes a chosen Torus as the editor\'s own panel setting', () => {
  const device = model.expressionsFieldDevice(reading({frequencyDriver: 'torus'}), 'resonance', null)
  assert.equal(device.values['set:frequencyDriver'], 'Torus')
  const manual = model.expressionsFieldDevice(reading({frequencyDriver: 'manual'}), 'resonance', null)
  assert.equal(manual.values['set:frequencyDriver'], 'Manual tuning', 'a scene saved with manual still reads manual')
  const row = device.rows.find(candidate => candidate.key === 'set:frequencyDriver')
  assert.deepEqual(row.values, ['Torus', 'Manual tuning', 'Travelling focus', 'Automation / station sweep'])
})

test('the Field\'s Key source is the owner\'s reading of the Scene, in the manual\'s order, and absent where the Scene carries none', () => {
  const choices = model.expressionsSettingChoices('field', 'keySource')
  assert.deepEqual(choices.map(choice => choice.value), MANUAL_KEYS)
  assert.deepEqual(choices.map(choice => choice.label), ['Torus', 'Sky', 'Manual'])
  assert.deepEqual(model.expressionsSettingKeys('field'), ['keySource', 'symbolVoices'], 'the Key source, then ME2\'s Symbol voices')
  assert.equal(model.expressionsSettingRead('field', 'keySource', reading({keySource: 'sky'}).scene), 'Sky')
  assert.equal(model.expressionsSettingRead('field', 'keySource', reading({}).scene), undefined, 'a scene saved before the key existed has none: no default is drawn as a reading')
})

test('the Resonance face lists the driver in the manual\'s order and emits the editor\'s change for Torus', () => {
  const sent = []
  const apply = changes => { sent.push(...changes); return Promise.resolve({ok: true}) }
  const els = collect(resonanceView.resonanceFaceView.switches({reading: reading({frequencyDriver: 'torus'}), disabled: false, apply}))
  const select = els.find(el => el.type === 'select' && el.props['aria-label'] === 'Shared frequency is driven by')
  assert.deepEqual(select.props.children.map(option => option.props.value), MANUAL_DRIVERS)
  assert.equal(select.props.value, 'torus')
  select.props.onChange({target: {value: 'torus'}})
  assert.deepEqual(sent.at(-1), panel('frequencyDriver', 'torus'))
})

test('the Focus face lists the same driver in the same order', () => {
  const html = renderToStaticMarkup(createElement('div', null, focusView.focusFaceView.switches({reading: reading({frequencyDriver: 'torus'}), disabled: false, apply: () => Promise.resolve({ok: true})})))
  const selected = html.match(/<select[^>]*>(?:(?!<\/select>).)*<option value="torus"(?:(?!<\/select>).)*<\/select>/s)
  assert.ok(selected, 'a select offers Torus')
  assert.deepEqual([...selected[0].matchAll(/<option value="([^"]+)"/g)].map(match => match[1]), MANUAL_DRIVERS)
})

test('the plate\'s gate names the torus as the source that drives it, while the medium is on', () => {
  assert.deepEqual(resonanceModel.resonanceGate({resonanceEnabled: true, frequencyDriver: 'torus', autoSweep: false}), {modal: true, drive: 'torus'})
  assert.deepEqual(resonanceModel.resonanceGate({resonanceEnabled: true, frequencyDriver: 'torus', autoSweep: true}), {modal: true, drive: 'torus'}, 'a sweep needs Automation to own the frequency')
  assert.deepEqual(resonanceModel.resonanceGate({resonanceEnabled: true, frequencyDriver: 'torus', keySource: 'sky', autoSweep: false}), {modal: true, drive: 'torus'}, 'the sky key is still the torus driver')
  assert.deepEqual(resonanceModel.resonanceGate({resonanceEnabled: true, frequencyDriver: 'torus', keySource: 'manual', autoSweep: false}), {modal: true, drive: 'frequency'}, 'Key source Manual takes the resonance that was set')
  assert.deepEqual(resonanceModel.resonanceGate({resonanceEnabled: false, frequencyDriver: 'torus', autoSweep: false}), {modal: false, drive: 'off'})
})
