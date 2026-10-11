import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {register} from 'node:module'
import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'

// Production rack model and component in memory, same loader as the sibling native tests (.tsx transpiled, .css stubbed).
// The reading is a minimal fixture; it is not a native owner or a saved receipt.
const root = new URL('../../../../', import.meta.url)
const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
const parameters = new URL('packages/expressions-boundary/src/parameters.ts', root).href
register(`data:text/javascript,${encodeURIComponent(`import ts from ${JSON.stringify(compiler)};import {readFile} from 'node:fs/promises';export async function resolve(s,c,n){if(s==='@epilogos/expressions-boundary/parameters')return n(${JSON.stringify(parameters)},c);try{return await n(s,c)}catch(e){if(!s.startsWith('.'))throw e;if(s.endsWith('.js')){try{return await n(s.slice(0,-3)+'.ts',c)}catch{}}for(const x of ['.ts','.tsx']){try{return await n(s+x,c)}catch{}}throw e}}export async function load(u,c,n){if(u.endsWith('.css'))return {format:'module',shortCircuit:true,source:'export {}'};if(u.endsWith('?raw'))return {format:'module',shortCircuit:true,source:'export default '+JSON.stringify(await readFile(new URL(u.split('?')[0]),'utf8'))};if(!u.endsWith('.ts')&&!u.endsWith('.tsx'))return n(u,c);return {format:'module',shortCircuit:true,source:ts.transpileModule(await readFile(new URL(u),'utf8'),{fileName:new URL(u).pathname,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText}}`)}`, import.meta.url)
const [model, strip, {NATIVE_BINDINGS, bindValue}, rack, boundary] = await Promise.all([
  import('../src/components/nativeDeviceRackModel.ts'),
  import('../src/components/nativeDeviceStripModel.ts'),
  import(parameters),
  import('../src/components/NativeDeviceRack.tsx'),
  import('../../../expressions-boundary/src/nativeDeviceWidgets.ts'),
])
const {DEVICE_FAMILIES} = boundary

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
function reading({selection = [], entities = [force()], engine = {}, palette = ['#111111', '#222222', '#333333'], values = {}, devices = [], pending = false} = {}) {
  const scene = {name: 'Fixture', entities, engine: {...ENGINE, ...engine}, field: {background: '#ffffff', palette, material: 'ink', params: {}}}
  for (const [path, value] of Object.entries(values)) bindValue(scene, binding(path).bind, value)
  return {
    basis: {expression_ref: 'expr:fixture', revision: 1, scene_ref: 'scene:fixture', authored_revision: 1},
    scene, entityOccurrences: {}, chosenControls: {available: false, entries: [], controls: []}, devices,
    selection: {entity_ids: selection, step_id: null}, history: {canUndo: false, canRedo: false},
    standing: {dirty: false, pending, notice: null},
  }
}
const EXPECTED = ['physics', 'medium', 'resonance', 'contacts', 'ink', 'depth', 'relational', 'pointer', 'focus', 'morph', 'colour']
const placed = (...families) => families.map(family => ({id: `${family}-1`, family}))

test('catalogue: each Field device this shell has appears exactly once, Force is the one entity device, and every one is a DEVICE_FAMILIES entry', () => {
  const families = model.deviceCatalogue().map(device => device.family)
  assert.equal(new Set(families).size, families.length, 'no duplicate families')
  assert.deepEqual(model.deviceCatalogue().filter(device => device.scope === 'field').map(device => device.family).sort(), [...EXPECTED].sort())
  assert.ok(model.deviceCatalogue().filter(device => device.scope === 'entity').map(device => device.family).includes('force'), 'Force is an entity device')
  for (const family of families) assert.ok(DEVICE_FAMILIES.includes(family), `${family} is a DEVICE_FAMILIES entry`)
  // The glyph editor lives in its own clip surface and is never a catalogue entry.
  assert.ok(!families.includes('glyph'))
  // What the shell does not yet build a device for is exactly this list; it shrinks as devices land.
  assert.deepEqual(DEVICE_FAMILIES.filter(family => !families.includes(family)).sort(), ['glyph'])
})

test('descriptors: Field paths are real bindings, groups cover paths exactly, compact is a subset of at most four', () => {
  for (const device of model.deviceCatalogue()) {
    if (device.scope === 'field') for (const path of device.paths) binding(path)
    assert.equal(new Set(device.paths).size, device.paths.length, `${device.family} paths are unique`)
    if (device.groups.length) assert.deepEqual(device.groups.flatMap(group => group.paths).sort(), [...device.paths].sort(), `${device.family} groups`)
    assert.ok(device.compact.length <= 4, `${device.family} compact is at most four`)
    for (const path of device.compact) assert.ok(device.paths.includes(path), `${device.family} compact ${path} is a parameter of the panel`)
  }
})

test('rack widgets follow reading.devices order and join the catalogue', () => {
  const widgets = model.rackWidgets(reading({engine: {morphEnabled: true}, devices: placed('morph', 'contacts', 'physics')}))
  assert.deepEqual(widgets.map(widget => widget.id), ['morph-1', 'contacts-1', 'physics-1'])
  assert.deepEqual(widgets.map(widget => widget.unavailable), [false, false, false])
  assert.equal(widgets[0].name, 'Morph')
  assert.equal(widgets[0].on, true)
  assert.equal(widgets[1].name, 'Contacts')
  assert.equal(widgets[2].toggle, null)
  assert.equal(widgets[2].on, undefined)
})

test('an unknown family stays in place as an unavailable widget, never dropped', () => {
  const widgets = model.rackWidgets(reading({devices: [{id: 'pointer-1', family: 'pointer'}, {id: 'glyph-1', family: 'glyph'}, {id: 'medium-1', family: 'medium'}]}))
  assert.deepEqual(widgets.map(widget => [widget.id, widget.unavailable]), [['pointer-1', false], ['glyph-1', true], ['medium-1', false]])
  assert.deepEqual(Object.keys(widgets[1]).sort(), ['family', 'id', 'unavailable'])
  assert.equal(widgets[1].family, 'glyph')
})

test('an empty rack yields zero widgets and every catalogue device is addable', () => {
  assert.deepEqual(model.rackWidgets(reading()), [])
  assert.deepEqual(model.addableDevices(reading()).map(device => device.family), model.deviceCatalogue().map(device => device.family))
})

test('addable devices are the catalogue minus the families already on the rack', () => {
  const families = model.addableDevices(reading({devices: placed('medium', 'morph')})).map(device => device.family)
  assert.equal(families.includes('medium'), false)
  assert.equal(families.includes('morph'), false)
  // Force is an entity device: it stays addable and is not counted among the placed Field families.
  assert.equal(families.length, model.deviceCatalogue().length - 2)
  assert.ok(families.includes('force'))
})

test('reorder moves one id by splice semantics and keeps every id exactly once', () => {
  assert.deepEqual(model.reorderWidgetIds(['a', 'b', 'c'], 0, 2), ['b', 'c', 'a'])
  assert.deepEqual(model.reorderWidgetIds(['a', 'b', 'c'], 2, 0), ['c', 'a', 'b'])
  assert.deepEqual(model.reorderWidgetIds(['a', 'b', 'c'], 1, 1), ['a', 'b', 'c'])
  assert.deepEqual(model.reorderWidgetIds(['a', 'b', 'c'], 1, 5), ['a', 'b', 'c'])
  assert.deepEqual(model.reorderWidgetIds(['a', 'b', 'c'], -1, 0), ['a', 'b', 'c'])
})

test('change builders are exactly the three device-widget kinds', () => {
  assert.deepEqual(model.deviceAddChange('morph'), {kind: 'device-add', family: 'morph'})
  assert.deepEqual(model.deviceRemoveChange('morph-1'), {kind: 'device-remove', device_id: 'morph-1'})
  assert.deepEqual(model.deviceOrderChange(['b', 'a']), {kind: 'device-order', device_ids: ['b', 'a']})
})

test('compact values come from the reading and change when the reading changes', () => {
  const paths = ['toroidalMorph.oscillationSpeed', 'toroidalMorph.driveDepth']
  const first = model.rackWidgets(reading({devices: placed('morph'), values: {'toroidalMorph.oscillationSpeed': 1.5, 'toroidalMorph.driveDepth': 0.25}}))[0]
  assert.equal(first.compact.length, 4)
  const value = (widgetRow, path) => widgetRow.compact.find(row => row.path === path)
  assert.equal(value(first, paths[0]).value, 1.5)
  assert.equal(value(first, paths[1]).value, 0.25)
  assert.equal(value(first, paths[1]).label, binding(paths[1]).label)
  assert.equal(value(first, paths[1]).hardMax, binding(paths[1]).hardMax)
  const later = model.rackWidgets(reading({devices: placed('morph'), values: {'toroidalMorph.oscillationSpeed': 2.5}}))[0]
  assert.equal(value(later, paths[0]).value, 2.5)
  // The earlier projection is a pure value.
  assert.equal(value(first, paths[0]).value, 1.5)
})

test('activator changes are the exact admitted shapes; contacts off clears its pairwise flag too', () => {
  const engine = {pairwiseEnabled: true, collisionEnabled: true, relationalEnabled: false, colorEnabled: true, mediumEnabled: false, morphEnabled: false}
  const widgets = model.rackWidgets(reading({engine, devices: placed('contacts', 'relational', 'colour', 'medium', 'physics')}))
  const row = family => widgets.find(widgetRow => widgetRow.family === family)
  assert.deepEqual(model.activatorChanges(row('contacts')), [{kind: 'field-setting', key: 'collisionEnabled', value: false}, {kind: 'field-setting', key: 'pairwiseEnabled', value: false}])
  assert.deepEqual(model.activatorChanges(row('relational')), [{kind: 'panel-setting', key: 'relationalEnabled', value: true}])
  assert.deepEqual(model.activatorChanges(row('colour')), [{kind: 'colour-setting', key: 'colorEnabled', value: false}])
  assert.deepEqual(model.activatorChanges(row('medium')), [{kind: 'field-setting', key: 'mediumEnabled', value: true}])
  assert.deepEqual(model.activatorChanges(row('physics')), [])
})

test('SSR: an empty rack shows one quiet line, no widget card, and an add control', () => {
  const html = renderToStaticMarkup(createElement(rack.NativeDeviceRack, {reading: reading(), request: async () => ({ok: false, error: 'x'}), onOpen() {}}))
  assert.match(html, /No devices on the rack\. \+ Device adds one; parameters stay active at their defaults\./)
  assert.doesNotMatch(html, /native-rack-card/)
  assert.match(html, /aria-haspopup="menu"/)
  assert.match(html, />\+ Device</)
  assert.doesNotMatch(html, /role="menu"/, 'the add menu is closed by default')
})

test('SSR: no reading shows the loading line and no add menu is enabled', () => {
  const html = renderToStaticMarkup(createElement(rack.NativeDeviceRack, {reading: null, request: async () => ({ok: false, error: 'x'}), onOpen() {}}))
  assert.match(html, /Open a native Expression to see its devices\./)
  assert.match(html, /native-rack-add"[^>]*disabled=""/)
})

test('SSR: widgets render in reading.devices order with accessible names, activators and compact controls', () => {
  const html = renderToStaticMarkup(createElement(rack.NativeDeviceRack, {
    reading: reading({devices: placed('pointer', 'medium', 'morph')}), request: async () => ({ok: false, error: 'x'}), onOpen() {}}))
  const at = name => html.indexOf(`aria-label="${name}"`)
  assert.ok(at('Pointer') > 0, 'Pointer group is labelled')
  assert.ok(at('Pointer') < at('Shared Medium') && at('Shared Medium') < at('Morph'), 'widgets keep reading.devices order')
  assert.match(html, /aria-pressed="false"[^>]*aria-label="Shared Medium off"/)
  assert.match(html, /aria-label="Remove Shared Medium from the rack"/)
  assert.match(html, /title="Open settings"/)
  // Medium declares no compact controls, so it has no handle; Morph has four real handles.
  for (const control of model.rackWidgets(reading({devices: placed('morph')}))[0].compact) assert.match(html, new RegExp(`aria-label="${control.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`))
  assert.match(html, /role="slider"/)
})

test('SSR: no widget card is rendered for a device absent from reading.devices, and no Force card without one selected object', () => {
  const html = renderToStaticMarkup(createElement(rack.NativeDeviceRack, {
    reading: reading({devices: placed('pointer')}), request: async () => ({ok: false, error: 'x'}), onOpen() {}}))
  for (const name of ['Physics', 'Shared Medium', 'Morph', 'Colour Field', 'Contacts', 'Continuous resonance']) {
    assert.doesNotMatch(html, new RegExp(`aria-label="${name}`))
    assert.doesNotMatch(html, new RegExp(`Remove ${name} from the rack`))
  }
  assert.doesNotMatch(html, /Force · /)
  assert.match(html, /aria-label="Pointer"/)
})

test('SSR: one selected object shows its Force card above the widgets; the empty line still states the rack is empty', () => {
  const html = renderToStaticMarkup(createElement(rack.NativeDeviceRack, {
    reading: reading({selection: ['force-1'], devices: []}), request: async () => ({ok: false, error: 'x'}), onOpen() {}}))
  assert.match(html, /Force · Pin A/)
  assert.match(html, /aria-label="Force mode"/)
  assert.match(html, /No devices on the rack\./)
})

test('SSR: an unavailable family is shown with its id and a Remove action only', () => {
  const html = renderToStaticMarkup(createElement(rack.NativeDeviceRack, {
    reading: reading({devices: placed('glyph')}), request: async () => ({ok: false, error: 'x'}), onOpen() {}}))
  assert.match(html, /native-rack-family">glyph</)
  assert.match(html, /aria-label="Remove glyph from the rack"/)
  assert.match(html, /not available in this shell/)
  assert.doesNotMatch(html, /role="slider"/)
})

test('SSR: a pending reading disables the add control and every widget control', () => {
  const html = renderToStaticMarkup(createElement(rack.NativeDeviceRack, {
    reading: reading({devices: placed('medium'), pending: true}), request: async () => ({ok: false, error: 'x'}), onOpen() {}}))
  assert.match(html, /native-rack-add"[^>]*disabled=""/)
  assert.match(html, /aria-label="Remove Shared Medium from the rack"[^>]*disabled=""/)
})
