import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {register} from 'node:module'
import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'

// Production handle model and component in memory, same loader as the sibling native tests (.tsx transpiled, .css stubbed).
// The reading is a minimal fixture; it is not a native owner or a saved receipt.
const root = new URL('../../../../', import.meta.url)
const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
const parameters = new URL('packages/expressions-boundary/src/parameters.ts', root).href
register(`data:text/javascript,${encodeURIComponent(`import ts from ${JSON.stringify(compiler)};import {readFile} from 'node:fs/promises';export async function resolve(s,c,n){if(s==='@epilogos/expressions-boundary/parameters')return n(${JSON.stringify(parameters)},c);try{return await n(s,c)}catch(e){if(!s.startsWith('.'))throw e;if(s.endsWith('.js')){try{return await n(s.slice(0,-3)+'.ts',c)}catch{}}for(const x of ['.ts','.tsx']){try{return await n(s+x,c)}catch{}}throw e}}export async function load(u,c,n){if(u.endsWith('.css'))return {format:'module',shortCircuit:true,source:'export {}'};if(u.endsWith('?raw'))return {format:'module',shortCircuit:true,source:'export default '+JSON.stringify(await readFile(new URL(u.split('?')[0]),'utf8'))};if(!u.endsWith('.ts')&&!u.endsWith('.tsx'))return n(u,c);return {format:'module',shortCircuit:true,source:ts.transpileModule(await readFile(new URL(u),'utf8'),{fileName:new URL(u).pathname,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText}}`)}`, import.meta.url)
const [model, {NATIVE_BINDINGS, bindValue}, handle, editors, custody, inputs] = await Promise.all([
  import('../src/components/nativeFieldHandleModel.ts'),
  import(parameters),
  import('../src/components/NativeFieldHandle.tsx'),
  import('../src/components/NativeDeviceEditors.tsx'),
  import('../src/components/nativeDeviceCustody.tsx'),
  import('../src/continuity/nativeInputs.ts'),
])
const {fraction, fromFraction, snap, settle, handlePosition, grabOffset, valueFromPoint, keyboardValue, resetValue, valueText} = model

const LINEAR = {label: 'Radius', min: 0, max: 10, hardMin: -2, hardMax: 12, step: 0.5, unit: 'u', defaultValue: 4}
const LOG = {label: 'Freq', min: 1, max: 100, hardMin: 0.5, hardMax: 200, step: 0.5, scale: 'log', unit: 'Hz', defaultValue: 10}
const WIDE = {label: 'Wide', min: -10, max: 10, hardMin: -5, hardMax: 5, step: 1}
const UNIT_STEP = {label: 'Unit', min: 0, max: 1, hardMin: 0, hardMax: 1, step: 0.1}
const HORIZONTAL = {origin: {x: 35, y: 140}, dir: {x: 1, y: 0}, length: 290}
const VERTICAL = {origin: {x: 20, y: 150}, dir: {x: 0, y: -1}, length: 120}
const DIAGONAL = {origin: {x: 0, y: 0}, dir: {x: Math.SQRT1_2, y: Math.SQRT1_2}, length: 100}
const GEOMETRIES = [HORIZONTAL, VERTICAL, DIAGONAL]
const close = (actual, expected, eps = 1e-9) => assert.ok(Math.abs(actual - expected) <= eps, `${actual} != ${expected}`)
const at = (geometry, t) => ({x: geometry.origin.x + geometry.dir.x * geometry.length * t, y: geometry.origin.y + geometry.dir.y * geometry.length * t})

test('fraction and fromFraction invert on linear and log soft ranges', () => {
  assert.equal(fraction(LINEAR, 5), 0.5)
  assert.equal(fromFraction(LINEAR, 0.25), 2.5)
  for (let v = 0; v <= 10; v += 0.5) close(fromFraction(LINEAR, fraction(LINEAR, v)), v)
  close(fraction(LOG, 10), 0.5)
  close(fromFraction(LOG, 0.5), 10)
  assert.equal(fraction(LOG, 1), 0)
  assert.equal(fraction(LOG, 100), 1)
  assert.equal(fraction(LOG, 0.1), 0, 'values below the soft minimum clamp to the start')
  assert.equal(fraction({min: 5, max: 5}), 0, 'degenerate range has no fraction')
  assert.equal(fraction({min: 0, max: 10, scale: 'log'}, 5), 0.5, 'log with a zero minimum falls back to linear')
  assert.equal(fraction(LINEAR, Number.NaN), 0, 'non-finite values do not place the handle')
})

test('handle position spans the soft range along horizontal, vertical and diagonal geometry', () => {
  assert.deepEqual(handlePosition(LINEAR, HORIZONTAL, 0), {x: 35, y: 140})
  assert.deepEqual(handlePosition(LINEAR, HORIZONTAL, 10), {x: 325, y: 140})
  assert.deepEqual(handlePosition(LINEAR, HORIZONTAL, 5), {x: 180, y: 140})
  assert.deepEqual(handlePosition(LINEAR, VERTICAL, 0), {x: 20, y: 150})
  close(handlePosition(LINEAR, VERTICAL, 10).y, 30)
  const diagonal = handlePosition(LINEAR, DIAGONAL, 5)
  close(diagonal.x, 50 * Math.SQRT1_2)
  close(diagonal.y, 50 * Math.SQRT1_2)
  assert.deepEqual(handlePosition(LINEAR, HORIZONTAL, 99), {x: 325, y: 140}, 'values beyond the soft range draw at its end')
})

test('value from point round-trips through the handle with its grab offset on every geometry and scale', () => {
  for (const geometry of GEOMETRIES) {
    for (const binding of [LINEAR, LOG]) {
      const samples = binding === LOG ? [1, 10, 50, 100] : [0, 2.5, 4, 7.5, 10]
      for (const v of samples) {
        const pos = handlePosition(binding, geometry, v)
        const offset = grabOffset(binding, geometry, v, pos)
        close(offset, 0)
        close(valueFromPoint(binding, geometry, pos, offset), v)
      }
    }
  }
  for (const geometry of GEOMETRIES) for (const t of [0, 0.25, 0.6, 1]) assert.equal(valueFromPoint(LINEAR, geometry, at(geometry, t), 0), settle(LINEAR, fromFraction(LINEAR, t)), `t=${t}`)
})

test('a real native log binding round-trips on its own step grid', () => {
  const binding = NATIVE_BINDINGS.find(row => row.path === 'material.sizeBias')
  assert.ok(binding && binding.scale === 'log', 'material.sizeBias is a log binding')
  for (const x of [binding.min, 0.5, 1, 2, binding.max]) {
    const v = snap(binding, x)
    const pos = handlePosition(binding, HORIZONTAL, v)
    close(valueFromPoint(binding, HORIZONTAL, pos, grabOffset(binding, HORIZONTAL, v, pos)), v, 1e-9)
  }
})

test('grab offset keeps the value still until the pointer moves, then moves it by axis distance', () => {
  const pos = handlePosition(LINEAR, HORIZONTAL, 4)
  close(pos.x, 151)
  const offset = grabOffset(LINEAR, HORIZONTAL, 4, {x: 160, y: 140})
  close(offset, -9)
  assert.equal(valueFromPoint(LINEAR, HORIZONTAL, {x: 160, y: 140}, offset), 4)
  assert.equal(valueFromPoint(LINEAR, HORIZONTAL, {x: 170, y: 140}, offset), 4.5, 'pointer moved 10 units: t=0.4345 snaps to 4.5')
  assert.equal(valueFromPoint(LINEAR, HORIZONTAL, {x: 9999, y: 140}, 0), 10, 'past the axis end clamps to the soft maximum')
  assert.equal(valueFromPoint(LINEAR, HORIZONTAL, {x: -9999, y: 140}, 0), 0, 'before the axis start clamps to the soft minimum')
})

test('value from point snaps to the step grid and clamps to hard bounds', () => {
  assert.equal(valueFromPoint(LINEAR, HORIZONTAL, {x: 35 + 0.33 * 290, y: 140}, 0), 3.5, 'raw 3.3 rounds to the 0.5 grid')
  assert.equal(valueFromPoint(WIDE, HORIZONTAL, at(HORIZONTAL, 0), 0), -5, 'soft minimum below hard minimum clamps')
  assert.equal(valueFromPoint(WIDE, HORIZONTAL, at(HORIZONTAL, 1), 0), 5, 'soft maximum above hard maximum clamps')
  assert.equal(valueFromPoint({min: 0, max: 1, hardMin: 0, hardMax: 1, step: 0.4}, HORIZONTAL, at(HORIZONTAL, 1), 0), 1, 'rounding that crosses a hard bound is clamped again')
  assert.equal(settle(UNIT_STEP, 0.30000000001), 0.3, 'settled values carry no float noise')
})

test('keyboard keys step one grid unit, Shift and page keys step ten, and results clamp to hard bounds', () => {
  assert.equal(keyboardValue(LINEAR, 4, 'ArrowRight', false), 4.5)
  assert.equal(keyboardValue(LINEAR, 4, 'ArrowUp', false), 4.5)
  assert.equal(keyboardValue(LINEAR, 4, 'ArrowLeft', false), 3.5)
  assert.equal(keyboardValue(LINEAR, 4, 'ArrowDown', false), 3.5)
  assert.equal(keyboardValue(LINEAR, 4, 'ArrowRight', true), 9, 'Shift x10')
  assert.equal(keyboardValue(LINEAR, 4, 'ArrowLeft', true), -1, 'Shift x10 downward')
  assert.equal(keyboardValue(LINEAR, 4, 'PageUp', false), 9, 'PageUp is always x10')
  assert.equal(keyboardValue(LINEAR, 4, 'PageUp', true), 9)
  assert.equal(keyboardValue(LINEAR, 4, 'PageDown', false), -1)
  assert.equal(keyboardValue(LINEAR, 4, 'PageDown', true), -1)
  assert.equal(keyboardValue(LINEAR, 11.8, 'ArrowRight', true), 12, 'clamped to hard maximum')
  assert.equal(keyboardValue(LINEAR, -1.8, 'ArrowLeft', true), -2, 'clamped to hard minimum')
  assert.equal(keyboardValue(LINEAR, 12, 'ArrowRight', false), 12, 'at the bound the value is unchanged, so the caller can skip the apply')
  assert.equal(keyboardValue(UNIT_STEP, 0.2, 'ArrowRight', false), 0.3, 'no float noise after a step')
  assert.equal(keyboardValue(LOG, 10, 'ArrowRight', false), 10.5, 'steps are absolute on a log binding too')
  for (const key of ['Home', 'End', 'Enter', 'Escape', 'a', 'Tab']) assert.equal(keyboardValue(LINEAR, 4, key, false), null, key)
})

test('reset uses the disclosed default only when it is finite and inside hard bounds', () => {
  assert.equal(resetValue(LINEAR), 4)
  assert.equal(resetValue(LOG), 10)
  assert.equal(resetValue({label: 'No default', min: 0, max: 1, hardMin: 0, hardMax: 1, step: 0.1}), null, 'absent default offers no reset')
  assert.equal(resetValue({...LINEAR, defaultValue: 99}), null, 'default outside hard bounds offers no reset')
  assert.equal(resetValue({...LINEAR, defaultValue: Number.NaN}), null)
  const real = NATIVE_BINDINGS.find(row => row.path === 'medium.coupling')
  assert.equal(resetValue(real), real.defaultValue >= real.hardMin && real.defaultValue <= real.hardMax ? real.defaultValue : null)
})

test('value text is Label value unit with the shell number format', () => {
  assert.equal(valueText(LINEAR, 4), 'Radius 4 u')
  assert.equal(valueText(LINEAR, 1 / 3), 'Radius 0.3333 u')
  assert.equal(valueText({label: 'Freq', min: 0, max: 1, hardMin: 0, hardMax: 1, step: 0.1}, 1.5), 'Freq 1.5')
  assert.equal(valueText(LINEAR, Number.NaN), 'Radius — u')
})

test('handle gesture material targets the same field parameter key as the Field slider', () => {
  const basis = {expression_ref: 'expr:fixture', revision: 1, scene_ref: 'scene:fixture', authored_revision: 1}
  const gesture = {pointer: 3, basis, value: 5, initial: 4, offset: 0.5}
  const material = handle.handleGestureMaterial(gesture, 'field.medium.coupling', 'medium')
  assert.deepEqual(material.target, {scope: 'field', entity_id: null, entity_ref: null, step_id: null, parameter: 'field.medium.coupling', family: 'medium', axis: null})
  assert.equal(material.input.kind, 'gesture')
  assert.deepEqual(material.input.changes, [{kind: 'parameter', target: 'field.medium.coupling', value: 5}])
  const slider = editors.nativeFieldInputMaterial({pointer: 1, basis, value: 5, initial: 4, offset_x: 0}, 'field.medium.coupling', 'medium')
  assert.equal(inputs.nativeInputTargetKey(material), inputs.nativeInputTargetKey(slider), 'handles and the slider share one custody target')
})

test('the handle module keeps the shell import rule: no runtime import of the editor shell, and the model stays pure', async () => {
  const handleText = await readFile(new URL('../src/components/NativeFieldHandle.tsx', import.meta.url), 'utf8')
  assert.doesNotMatch(handleText, /from '\.\/NativeDeviceEditors'/)
  const modelText = await readFile(new URL('../src/components/nativeFieldHandleModel.ts', import.meta.url), 'utf8')
  assert.doesNotMatch(modelText, /^import (?!type )/m, 'model has only type imports')
})

test('custody and SVG point helpers keep one identity through the editor shell re-export', () => {
  assert.equal(editors.NativeDeviceInputCustody, custody.NativeDeviceInputCustody)
  assert.equal(editors.nativeDeviceSvgPoint, custody.nativeDeviceSvgPoint)
  const matrix = {a: 2, b: 0, c: 0, d: 2, e: 10, f: 20}
  assert.deepEqual(custody.nativeDeviceSvgPoint({clientX: 30, clientY: 60}, matrix), {x: 10, y: 20})
})

// SSR fixture: the same reading shape the sibling native tests use, with one native value written through its binding.
const ENGINE = {mediumEnabled: false, resonanceEnabled: false, collisionEnabled: false, pairwiseEnabled: false, morphEnabled: false,
  colorEnabled: false, trajectory: 'toroidalHopf', driveShape: 'sine', colorMode: 'linearGradient', mediumPlane: 'vertical', autoOscillate: true}
function reading(values = {}) {
  const scene = {name: 'Fixture', entities: [], engine: {...ENGINE}, field: {background: '#ffffff', palette: ['#111111'], material: 'ink', params: {}}}
  for (const [path, value] of Object.entries(values)) bindValue(scene, NATIVE_BINDINGS.find(row => row.path === path).bind, value)
  return {
    basis: {expression_ref: 'expr:fixture', revision: 1, scene_ref: 'scene:fixture', authored_revision: 1},
    scene, entityOccurrences: {}, chosenControls: {available: false, entries: [], controls: []},
    selection: {entity_ids: [], step_id: null}, history: {canUndo: false, canRedo: false},
    standing: {dirty: false, pending: false, notice: null},
  }
}
const render = (props = {}) => renderToStaticMarkup(createElement('svg', {viewBox: '0 0 360 160'}, createElement(handle.NativeFieldHandle, {
  reading: reading({'medium.coupling': 0.4}), path: 'medium.coupling', family: 'medium', geometry: HORIZONTAL, disabled: false,
  apply: () => {throw Error('SSR must not dispatch')}, captureCurrent: () => () => false, label: 'Coupling handle', ...props,
})))

test('SSR: the handle renders as an SVG slider with exact aria and no surface slider attribute', () => {
  const html = render()
  assert.match(html, /<g class="native-field-handle is-dot"/)
  assert.match(html, /role="slider"/)
  assert.match(html, /aria-label="Coupling handle"/)
  assert.match(html, /aria-valuenow="0.4"/)
  assert.match(html, /aria-valuemin="[^"]+"/)
  assert.match(html, /aria-valuemax="[0-9.]+"/)
  assert.match(html, /aria-valuetext="[^"]*0\.4/)
  assert.match(html, /tabindex="0"/)
  assert.ok(!html.includes('data-field-handle'), 'the surface slider attribute belongs to FieldSurface only')
  assert.ok(!html.includes('is-retained') && !html.includes('is-dragging'))
})

test('SSR: shapes, disabled state and unknown paths', () => {
  assert.match(render({shape: 'bar'}), /<path class="native-field-handle-mark"/)
  assert.match(render({shape: 'ring'}), /<g class="native-field-handle is-ring"/)
  const disabled = render({disabled: true})
  assert.match(disabled, /tabindex="-1"/)
  assert.match(disabled, /aria-disabled="true"/)
  assert.doesNotMatch(render({path: 'not.a.native.path'}), /role="slider"/)
})
