import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {register} from 'node:module'

// Production model source in memory, same loader as the sibling native tests.
// The reading is a minimal fixture; it is not a native owner or a saved receipt.
const root = new URL('../../../../', import.meta.url)
const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
const parameters = new URL('packages/expressions-boundary/src/parameters.ts', root).href
register(`data:text/javascript,${encodeURIComponent(`import ts from ${JSON.stringify(compiler)};import {readFile} from 'node:fs/promises';export async function resolve(s,c,n){if(s==='@epilogos/expressions-boundary/parameters')return n(${JSON.stringify(parameters)},c);try{return await n(s,c)}catch(e){if(!s.startsWith('.'))throw e;if(s.endsWith('.js')){try{return await n(s.slice(0,-3)+'.ts',c)}catch{}}for(const x of ['.ts','.tsx']){try{return await n(s+x,c)}catch{}}throw e}}export async function load(u,c,n){if(u.endsWith('.css'))return {format:'module',shortCircuit:true,source:'export {}'};if(u.endsWith('?raw'))return {format:'module',shortCircuit:true,source:'export default '+JSON.stringify(await readFile(new URL(u.split('?')[0]),'utf8'))};if(!u.endsWith('.ts')&&!u.endsWith('.tsx'))return n(u,c);return {format:'module',shortCircuit:true,source:ts.transpileModule(await readFile(new URL(u),'utf8'),{fileName:new URL(u).pathname,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText}}`)}`, import.meta.url)
const [{forceStripDevice, nativeDeviceStrip, stripToggleChange, stripToggleChanges}, {rackWidgets}, {NATIVE_BINDINGS, bindValue}] = await Promise.all([
  import('../src/components/nativeDeviceStripModel.ts'),
  import('../src/components/nativeDeviceRackModel.ts'),
  import(parameters),
])

const binding = path => {
  const found = NATIVE_BINDINGS.find(row => row.path === path)
  assert.ok(found, `missing native binding ${path}`)
  return found
}
const ENGINE = {mediumEnabled: false, resonanceEnabled: false, collisionEnabled: false, pairwiseEnabled: false, morphEnabled: false,
  colorEnabled: false, trajectory: 'toroidalHopf', driveShape: 'sine', colorMode: 'linearGradient', mediumPlane: 'vertical', autoOscillate: true}
const force = (over = {}) => ({id: 'force-1', name: 'Pin A', kind: 'pin', enabled: true, position: {x: 0, y: 0, z: 0}, size: {x: 1, y: 1},
  rotation: 0, shape: 'circle', text: '', share: 1, tint: '#000', tintWeight: 1, locked: false, station: null,
  force: {kind: 'attract', strength: 2.5, radius: 1.25, spin: 0}, sequence: {enabled: false, clock: 'seconds', steps: []}, ...over})

// Values are written through the same binding document path the reading uses.
function reading({selection = [], entities = [force()], engine = {}, palette = ['#111111', '#222222', '#333333'], values = {}, devices = []} = {}) {
  const scene = {name: 'Fixture', entities, engine: {...ENGINE, ...engine}, field: {background: '#ffffff', palette, material: 'ink', params: {}}}
  for (const [path, value] of Object.entries(values)) bindValue(scene, binding(path).bind, value)
  return {
    basis: {expression_ref: 'expr:fixture', revision: 1, scene_ref: 'scene:fixture', authored_revision: 1},
    scene, entityOccurrences: {}, chosenControls: {available: false, entries: [], controls: []}, devices,
    selection: {entity_ids: selection, step_id: null}, history: {canUndo: false, canRedo: false},
    standing: {dirty: false, pending: false, notice: null},
  }
}
// Every Field and bespoke device placed on the rack, in one fixed order, so each test can read any family's widget.
const PLACED = ['physics', 'medium', 'resonance', 'contacts', 'ink', 'depth', 'relational', 'pointer', 'focus', 'morph', 'colour']
const placed = families => families.map(family => ({id: `${family}-1`, family}))
const widgetsOf = (over = {}) => rackWidgets(reading({devices: placed(PLACED), ...over}))
const widget = (widgets, family) => widgets.find(row => row.family === family)

test('force card is contextual: only one resolved selected object yields a Force device', () => {
  assert.equal(forceStripDevice(reading()), null)
  assert.equal(forceStripDevice(reading({selection: ['force-1']})).family, 'force')
  // A selection that resolves to no entity contributes no Force device.
  assert.equal(forceStripDevice(reading({selection: ['missing'], entities: [force()]})), null)
  // More than one selected object never shows a single Force card.
  assert.equal(forceStripDevice(reading({selection: ['force-1', 'force-2'], entities: [force(), force({id: 'force-2', name: 'Pin B'})]})), null)
})

test('device shape is exactly the strip contract', () => {
  const device = forceStripDevice(reading({selection: ['force-1']}))
  assert.deepEqual(Object.keys(device).sort(), ['family', 'id', 'name', 'on', 'scope', 'summary', 'toggle'])
  assert.equal(device.scope, 'entity')
  assert.equal(typeof device.summary, 'string')
})

test('force on and off follow the editor rule and carry no activator toggle', () => {
  const attract = forceStripDevice(reading({selection: ['force-1']}))
  assert.equal(attract.on, true)
  assert.equal(attract.toggle, null)
  assert.equal(attract.summary, 'attract · strength 2.5 · radius 1.25')
  const idle = forceStripDevice(reading({selection: ['force-1'], entities: [force({force: {kind: 'none', strength: 0, radius: 1.25, spin: 0}})]}))
  assert.equal(idle.on, false)
  const spinning = forceStripDevice(reading({selection: ['force-1'], entities: [force({force: {kind: 'none', strength: 0, radius: 1.25, spin: 0.5}})]}))
  assert.equal(spinning.on, true)
  const disabled = forceStripDevice(reading({selection: ['force-1'], entities: [force({enabled: false})]}))
  assert.equal(disabled.on, false)
})

test('activator state follows the engine values and toggles use the exact change shapes', () => {
  const engine = {mediumEnabled: true, resonanceEnabled: false, collisionEnabled: false, pairwiseEnabled: true, morphEnabled: true, colorEnabled: false,
    relationalEnabled: true, volumeEnabled: false}
  const widgets = widgetsOf({engine})
  assert.equal(widget(widgets, 'medium').on, true)
  assert.deepEqual(widget(widgets, 'medium').toggle, {kind: 'field-setting', key: 'mediumEnabled'})
  assert.equal(widget(widgets, 'resonance').on, false)
  assert.deepEqual(widget(widgets, 'resonance').toggle, {kind: 'field-setting', key: 'resonanceEnabled'})
  // Contacts is lit by pairwise alone, so turning the light off must clear both flags.
  assert.equal(widget(widgets, 'contacts').on, true)
  assert.deepEqual(widget(widgets, 'contacts').toggle, {kind: 'field-setting', key: 'collisionEnabled', clears: 'pairwiseEnabled'})
  assert.equal(widget(widgets, 'morph').on, true)
  assert.deepEqual(widget(widgets, 'morph').toggle, {kind: 'morph-setting', key: 'morphEnabled'})
  assert.equal(widget(widgets, 'colour').on, false)
  assert.deepEqual(widget(widgets, 'colour').toggle, {kind: 'colour-setting', key: 'colorEnabled'})
  assert.equal(widget(widgets, 'relational').on, true)
  assert.deepEqual(widget(widgets, 'relational').toggle, {kind: 'panel-setting', key: 'relationalEnabled'})
  assert.equal(widget(widgets, 'depth').on, false)
  assert.deepEqual(widget(widgets, 'depth').toggle, {kind: 'panel-setting', key: 'volumeEnabled'})
})

test('devices with no enable operation: no toggle, no change; Physics, Ink and Pointer report an unknown state', () => {
  for (const family of ['physics', 'ink', 'pointer', 'focus']) {
    const row = widget(widgetsOf(), family)
    if (family !== 'focus') assert.equal(row.on, undefined, family)
    // Focus derives a state from its route rows but has no owner enable, so it shows no light.
    assert.equal(row.toggle, null, family)
    assert.equal(stripToggleChange(row, true), null, family)
    assert.equal(stripToggleChange(row, false), null, family)
    assert.deepEqual(stripToggleChanges(row, true), [], family)
  }
})

test('stripToggleChange emits the exact NativeDeviceChange variants', () => {
  const widgets = widgetsOf()
  assert.deepEqual(stripToggleChange(widget(widgets, 'medium'), true), {kind: 'field-setting', key: 'mediumEnabled', value: true})
  assert.deepEqual(stripToggleChange(widget(widgets, 'resonance'), false), {kind: 'field-setting', key: 'resonanceEnabled', value: false})
  assert.deepEqual(stripToggleChange(widget(widgets, 'morph'), true), {kind: 'morph-setting', key: 'morphEnabled', value: true})
  assert.deepEqual(stripToggleChange(widget(widgets, 'colour'), false), {kind: 'colour-setting', key: 'colorEnabled', value: false})
  assert.deepEqual(stripToggleChange(widget(widgets, 'relational'), true), {kind: 'panel-setting', key: 'relationalEnabled', value: true})
  assert.equal(stripToggleChange(forceStripDevice(reading({selection: ['force-1']})), true), null)
})

test('summaries show the reading values and change when the reading changes', () => {
  const first = widgetsOf({values: {'medium.pressure': 0.37, 'medium.coupling': 1.5, 'fluid.viscosity': 0.25, 'fluid.vortexStrength': 3,
    'cymatics.frequencyHz': 440, 'cymatics.dampingQFactor': 12, 'toroidalMorph.oscillationSpeed': 1.5, 'toroidalMorph.poloidalRate': 0.75,
    'toroidalMorph.driveDepth': 0.5}})
  assert.equal(widget(first, 'medium').summary, 'pressure 0.37 · coupling 1.5')
  assert.equal(widget(first, 'physics').summary, 'viscosity 0.25 · vortex 3')
  assert.equal(widget(first, 'resonance').summary, '440 Hz · Q 12')
  assert.equal(widget(first, 'morph').summary, 'θ 1.5 · φ 0.75 · depth 0.5')
  assert.match(widget(first, 'colour').summary, /^Monochrome ink · 3 stops · .* · cycle /)

  const second = widgetsOf({values: {'medium.pressure': 0.91, 'medium.coupling': 1.5, 'fluid.viscosity': 0.25, 'fluid.vortexStrength': 3,
    'cymatics.frequencyHz': 440, 'cymatics.dampingQFactor': 12, 'toroidalMorph.oscillationSpeed': 2, 'toroidalMorph.poloidalRate': 0.75,
    'toroidalMorph.driveDepth': 0.5}, engine: {colorEnabled: true}, palette: ['#111111', '#222222']})
  assert.equal(widget(second, 'medium').summary, 'pressure 0.91 · coupling 1.5')
  assert.equal(widget(second, 'morph').summary, 'θ 2 · φ 0.75 · depth 0.5')
  assert.match(widget(second, 'colour').summary, /^Palette on · 2 stops · /)
  // The first projection is a pure value; the second reading does not disturb it.
  assert.equal(widget(first, 'medium').summary, 'pressure 0.37 · coupling 1.5')
})

test('force summary follows the entity values in the reading', () => {
  const device = forceStripDevice(reading({selection: ['force-1'], entities: [force({force: {kind: 'repel', strength: -4, radius: 0.5, spin: 0}})]}))
  assert.equal(device.summary, 'repel · strength -4 · radius 0.5')
})

test('contacts activator: off clears glyph boundary and particle pairs together, on sets only the boundary', () => {
  const lit = widget(widgetsOf({engine: {...ENGINE, pairwiseEnabled: true}}), 'contacts')
  assert.equal(lit.on, true)
  assert.deepEqual(stripToggleChanges(lit, false), [{kind: 'field-setting', key: 'collisionEnabled', value: false}, {kind: 'field-setting', key: 'pairwiseEnabled', value: false}])
  const dark = widget(widgetsOf({engine: ENGINE}), 'contacts')
  assert.equal(dark.on, false)
  assert.deepEqual(stripToggleChanges(dark, true), [{kind: 'field-setting', key: 'collisionEnabled', value: true}])
  assert.deepEqual(stripToggleChanges(widget(widgetsOf(), 'physics'), true), [])
  assert.deepEqual(stripToggleChanges(widget(widgetsOf(), 'medium'), false), [{kind: 'field-setting', key: 'mediumEnabled', value: false}])
})

test('strip scope: each card carries its catalogue scope (field, entity or scene); Force is the one contextual card', () => {
  const cards = nativeDeviceStrip(reading({selection: ['force-1']}))
  const scopeOf = family => cards.find(card => card.family === family)?.scope
  assert.equal(scopeOf('physics'), 'field')
  assert.equal(scopeOf('formation'), 'entity')
  assert.equal(scopeOf('sound'), 'entity')
  assert.equal(scopeOf('text'), 'scene')
  assert.equal(cards.filter(card => card.family === 'force').length, 1)
  assert.equal(cards.find(card => card.family === 'force').id, 'force:force-1')
  assert.equal(cards.find(card => card.family === 'physics').id, 'field:physics')
  assert.ok(cards.every(card => ['field', 'entity', 'scene'].includes(card.scope)))
  assert.equal(nativeDeviceStrip(reading()).some(card => card.family === 'force'), false)
})
