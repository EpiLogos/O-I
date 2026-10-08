import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {register} from 'node:module'
import {createElement, isValidElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'

// Production Contacts model and view in memory, same loader as the sibling native tests (.tsx transpiled, .css stubbed).
// The reading is a minimal fixture; it is not a native owner or a saved receipt.
const root = new URL('../../../../', import.meta.url)
const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
const parameters = new URL('packages/expressions-boundary/src/parameters.ts', root).href
register(`data:text/javascript,${encodeURIComponent(`import ts from ${JSON.stringify(compiler)};import {readFile} from 'node:fs/promises';export async function resolve(s,c,n){if(s==='@epilogos/expressions-boundary/parameters')return n(${JSON.stringify(parameters)},c);try{return await n(s,c)}catch(e){if(!s.startsWith('.'))throw e;if(s.endsWith('.js')){try{return await n(s.slice(0,-3)+'.ts',c)}catch{}}for(const x of ['.ts','.tsx']){try{return await n(s+x,c)}catch{}}throw e}}export async function load(u,c,n){if(u.endsWith('.css'))return {format:'module',shortCircuit:true,source:'export {}'};if(u.endsWith('?raw'))return {format:'module',shortCircuit:true,source:'export default '+JSON.stringify(await readFile(new URL(u.split('?')[0]),'utf8'))};if(!u.endsWith('.ts')&&!u.endsWith('.tsx'))return n(u,c);return {format:'module',shortCircuit:true,source:ts.transpileModule(await readFile(new URL(u),'utf8'),{fileName:new URL(u).pathname,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText}}`)}`, import.meta.url)
const [{FIELD_FACE_MODELS}, {FIELD_FACE_VIEWS}, {nativeDeviceStrip, stripToggleChanges}, {NATIVE_BINDINGS, bindValue, baseValue}] = await Promise.all([
  import('../src/components/nativeFieldFaceModel.ts'),
  import('../src/components/nativeFieldFaceViews.tsx'),
  import('../src/components/nativeDeviceStripModel.ts'),
  import(parameters),
])
const model = FIELD_FACE_MODELS.contacts
const view = FIELD_FACE_VIEWS.contacts
const sourceView = await readFile(new URL('../src/components/NativeFieldFace.contacts.tsx', import.meta.url), 'utf8')

const ENGINE = {mediumEnabled: false, resonanceEnabled: false, collisionEnabled: false, pairwiseEnabled: false, morphEnabled: false,
  colorEnabled: false, trajectory: 'toroidalHopf', driveShape: 'sine', colorMode: 'linearGradient', mediumPlane: 'vertical', autoOscillate: true}
const binding = path => {
  const found = NATIVE_BINDINGS.find(row => row.path === path)
  assert.ok(found, `missing native binding ${path}`)
  return found
}
// Values are written through the same binding document path the reading uses.
function reading({engine = {}, values = {}} = {}) {
  const scene = {name: 'Fixture', entities: [], engine: {...ENGINE, ...engine}, field: {background: '#ffffff', palette: ['#111111'], material: 'ink', params: {}}}
  for (const [path, value] of Object.entries(values)) bindValue(scene, binding(path).bind, value)
  return {
    basis: {expression_ref: 'expr:fixture', revision: 1, scene_ref: 'scene:fixture', authored_revision: 1},
    scene, entityOccurrences: {}, chosenControls: {available: false, entries: [], controls: []},
    selection: {entity_ids: [], step_id: null}, history: {canUndo: false, canRedo: false},
    standing: {dirty: false, pending: false, notice: null},
  }
}
const DEFAULT_VALUES = {'collision.band': 40, 'collision.restitution': 0.4, 'collision.integrity': 1.5, 'pairwise.radius': 8,
  'pairwise.stiffness': 3, 'pairwise.restitution': 0.6, 'pairwise.viscosity': 0.2, 'pairwise.extent': 1000, 'glyphVolume.depth': 0}
const OFF = reading({values: DEFAULT_VALUES})
const LIT = reading({engine: {collisionEnabled: true, pairwiseEnabled: true}, values: DEFAULT_VALUES})

// ---- Model -------------------------------------------------------------------------------------------------------------

test('paths are the app panels\' numeric parameters, exactly: Glyph colliders and Pairwise contacts (inspector.ts:136-137)', () => {
  const expected = NATIVE_BINDINGS.filter(row => row.group === 'collision' || row.group === 'pairwise').map(row => row.path).sort()
  assert.equal(expected.length, 10, 'the two panels carry ten numeric parameters')
  assert.deepEqual([...model.paths].sort(), expected)
  assert.equal(new Set(model.paths).size, model.paths.length, 'no duplicates')
  assert.ok(model.paths.includes('pairwise.extent'), 'Grid Extent is part of the device')
})

test('groups are the two app sections with their titles, covering paths exactly', () => {
  assert.deepEqual(model.groups.map(group => group.title), ['Glyph colliders', 'Pairwise contacts'])
  const groupBinding = {'Glyph colliders': 'collision', 'Pairwise contacts': 'pairwise'}
  for (const group of model.groups) {
    const expected = NATIVE_BINDINGS.filter(row => row.group === groupBinding[group.title]).map(row => row.path).sort()
    assert.deepEqual([...group.paths].sort(), expected, group.title)
  }
  assert.deepEqual(model.groups.flatMap(group => group.paths), model.paths, 'groups concatenate to paths in order')
})

test('compact is at most four controls, all numeric, no duplicates, and spans both sections', () => {
  assert.ok(model.compact.length <= 4)
  assert.equal(new Set(model.compact).size, model.compact.length)
  for (const path of model.compact) assert.ok(model.paths.includes(path), path)
  assert.ok(model.compact.some(path => path.startsWith('collision.')) && model.compact.some(path => path.startsWith('pairwise.')))
})

test('controlPath is a numeric path that no in-diagram handle uses', () => {
  assert.ok(model.paths.includes(model.controlPath))
  const handlePaths = [...sourceView.matchAll(/<NativeFieldHandle[^>]*?path="([^"]+)"/g)].map(match => match[1])
  assert.equal(handlePaths.length, 4, 'four in-diagram handles')
  assert.equal(new Set(handlePaths).size, handlePaths.length, 'each handle binds a distinct parameter')
  assert.ok(!handlePaths.includes(model.controlPath))
  assert.deepEqual([...handlePaths].sort(), ['collision.band', 'collision.restitution', 'pairwise.radius', 'pairwise.restitution'])
})

test('enable light is the OR of the two section enables, derived from the reading', () => {
  assert.equal(model.enabled(OFF), false)
  assert.equal(model.enabled(reading({engine: {collisionEnabled: true}})), true)
  assert.equal(model.enabled(reading({engine: {pairwiseEnabled: true}})), true)
  assert.equal(model.enabled(LIT), true)
})

test('strip summary keeps the mode, glyph restitution and pair restitution from the reading', () => {
  assert.equal(model.strip.summary(OFF), 'obstacle · restitution 0.4 · pairs 0.6')
  const vessel = reading({engine: {collisionMode: 'vessel'}, values: {'collision.restitution': 0.37, 'pairwise.restitution': 0.9}})
  assert.equal(model.strip.summary(vessel), 'vessel · restitution 0.37 · pairs 0.9')
})

test('activator toggle shape: glyph enable, clearing the pair enable', () => {
  assert.deepEqual(model.strip.toggle, {kind: 'field-setting', key: 'collisionEnabled', clears: 'pairwiseEnabled'})
  assert.equal(model.studio, 'collision')
})

test('collision activator semantics survive the rename: off clears both sections, on enables only the glyph wall', () => {
  const devices = nativeDeviceStrip(LIT)
  const contacts = devices.find(device => device.family === 'contacts')
  assert.equal(contacts.on, true)
  assert.deepEqual(stripToggleChanges(contacts, false), [{kind: 'field-setting', key: 'collisionEnabled', value: false}, {kind: 'field-setting', key: 'pairwiseEnabled', value: false}])
  const dark = nativeDeviceStrip(OFF).find(device => device.family === 'contacts')
  assert.equal(dark.on, false)
  assert.deepEqual(stripToggleChanges(dark, true), [{kind: 'field-setting', key: 'collisionEnabled', value: true}])
  const pairOnly = nativeDeviceStrip(reading({engine: {pairwiseEnabled: true}})).find(device => device.family === 'contacts')
  assert.equal(pairOnly.on, true, 'pairwise alone lights the device')
})

// ---- View ---------------------------------------------------------------------------------------------------------------

// Draw context for SSR: `values` overrides what ctx.value returns (the same path a live handle draft takes).
const drawCtx = (r, values = {}) => ({
  reading: r, graphValue: 0, position: 0, family: 'contacts', disabled: false,
  value: path => path in values ? values[path] : readValue(r, path),
  apply: () => Promise.resolve({ok: true}), captureCurrent: () => () => false, setDraft: () => {},
})
const readValue = (r, path) => baseValue(r.scene, binding(path).key)
const drawMarkup = (r, values) => renderToStaticMarkup(createElement('svg', {viewBox: '0 0 360 160'}, view.draw(drawCtx(r, values))))

test('SSR: the diagram renders four labelled slider handles over the live reading', () => {
  const html = drawMarkup(LIT)
  for (const label of ['Contact Band', 'Glyph restitution', 'Collision Radius', 'Particle restitution']) assert.match(html, new RegExp(`aria-label="${label}"`), label)
  assert.equal([...html.matchAll(/role="slider"/g)].length, 4)
})

test('SSR: the diagram changes when a value changes, including a live handle draft', () => {
  const base = drawMarkup(LIT, {'collision.band': 5})
  assert.notEqual(base, drawMarkup(LIT, {'collision.band': 150}), 'contact band changes the boundary annulus')
  assert.notEqual(drawMarkup(LIT, {'pairwise.radius': 2}), drawMarkup(LIT, {'pairwise.radius': 70}), 'contact radius changes the circle')
  assert.notEqual(drawMarkup(LIT, {'pairwise.stiffness': 0}), drawMarkup(LIT, {'pairwise.stiffness': 10}), 'stiffness changes the spring density')
  assert.notEqual(drawMarkup(LIT, {'collision.integrity': 0}), drawMarkup(LIT, {'collision.integrity': 4}), 'integrity opens the boundary gaps')
})

test('SSR: obstacle and vessel draw the wall on opposite sides of the rim', () => {
  const obstacle = drawMarkup(LIT)
  const vessel = drawMarkup(reading({engine: {collisionEnabled: true, pairwiseEnabled: true, collisionMode: 'vessel'}, values: DEFAULT_VALUES}))
  assert.notEqual(obstacle, vessel)
  assert.match(obstacle, /Glyph walls · obstacle/)
  assert.match(vessel, /Glyph walls · vessel/)
})

test('SSR: each section dims with its own enable, and says why when it is off', () => {
  const glyphOff = drawMarkup(reading({engine: {pairwiseEnabled: true}, values: DEFAULT_VALUES}))
  assert.match(glyphOff, /Glyph walls off · boundary not solved/)
  assert.match(glyphOff, /Particle pairs · contact radius/)
  const pairOff = drawMarkup(reading({engine: {collisionEnabled: true}, values: DEFAULT_VALUES}))
  assert.match(pairOff, /Particle pairs off · not solved/)
  assert.match(pairOff, /Glyph walls · obstacle/)
  const bothOff = drawMarkup(OFF)
  assert.equal([...bothOff.matchAll(/opacity="0\.32"/g)].length, 2, 'both halves dimmed')
  assert.equal([...drawMarkup(LIT).matchAll(/opacity="0\.32"/g)].length, 0, 'nothing dimmed when both are on')
})

// Walk a React element tree and collect host elements by tag, so the switch handlers can be invoked without a DOM.
function hostElements(node, tag, found = []) {
  if (Array.isArray(node)) {for (const child of node) hostElements(child, tag, found); return found}
  if (!isValidElement(node)) return found
  if (node.type === tag) found.push(node)
  hostElements(node.props.children, tag, found)
  return found
}
const switchesTree = (r, apply, disabled = false) => view.switches({reading: r, disabled, apply})
const ADMITTED_FIELD_KEYS = ['mediumEnabled', 'resonanceEnabled', 'collisionEnabled', 'pairwiseEnabled', 'collisionMode']

test('switches: each control emits exactly the admitted field-setting change shape', () => {
  const calls = []
  const tree = switchesTree(OFF, changes => {calls.push(changes); return Promise.resolve({ok: true})})
  const [glyph, pair] = hostElements(tree, 'input')
  const [law] = hostElements(tree, 'select')
  assert.equal(hostElements(tree, 'input').length, 2, 'two enable switches')
  glyph.props.onChange({target: {checked: true}})
  pair.props.onChange({target: {checked: false}})
  law.props.onChange({target: {value: 'vessel'}})
  assert.deepEqual(calls, [
    [{kind: 'field-setting', key: 'collisionEnabled', value: true}],
    [{kind: 'field-setting', key: 'pairwiseEnabled', value: false}],
    [{kind: 'field-setting', key: 'collisionMode', value: 'vessel'}],
  ])
  for (const changes of calls) for (const change of changes) {
    assert.equal(change.kind, 'field-setting')
    assert.ok(ADMITTED_FIELD_KEYS.includes(change.key), change.key)
  }
  assert.equal(law.props['aria-label'], 'Wall law')
  assert.equal(law.props.value, 'obstacle', 'the select shows the reading mode, with obstacle as the default')
  assert.equal(glyph.props.checked, false)
  assert.equal(pair.props.checked, false)
})

test('switches: the mode is controlled by the reading and the controls disable with the editor', () => {
  const tree = switchesTree(reading({engine: {collisionEnabled: true, pairwiseEnabled: true, collisionMode: 'vessel'}}), () => Promise.resolve({ok: true}), true)
  const inputs = hostElements(tree, 'input'), [law] = hostElements(tree, 'select')
  assert.equal(law.props.value, 'vessel')
  assert.ok(inputs.every(input => input.props.checked === true && input.props.disabled === true))
  assert.equal(law.props.disabled, true)
})

test('switches: the pairwise 3D note shows only when Depth enables the volume body and pairwise contacts are on', () => {
  const on = reading({engine: {collisionEnabled: true, pairwiseEnabled: true, volumeEnabled: true}, values: {'glyphVolume.depth': 120}})
  const text = r => renderToStaticMarkup(createElement('div', null, switchesTree(r, () => Promise.resolve({ok: true}))))
  assert.match(text(on), /Pairwise contacts run in 3D because Depth enables the volume body\./)
  assert.doesNotMatch(text(reading({engine: {pairwiseEnabled: true, volumeEnabled: false}, values: {'glyphVolume.depth': 120}})), /run in 3D/)
  assert.doesNotMatch(text(reading({engine: {pairwiseEnabled: true, volumeEnabled: true}, values: {'glyphVolume.depth': 0}})), /run in 3D/, 'zero body depth is a flat card')
  assert.doesNotMatch(text(reading({engine: {collisionEnabled: true, volumeEnabled: true}, values: {'glyphVolume.depth': 120}})), /run in 3D/, 'pairwise off: no pairwise solve')
})
