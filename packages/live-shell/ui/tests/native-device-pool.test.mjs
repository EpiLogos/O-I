import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {register} from 'node:module'
import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'

// Production modules in memory, same loader family as the sibling native tests:
// .ts/.tsx are transpiled, CSS is stubbed, and the boundary parameters module resolves by its package path.
const root = new URL('../../../../', import.meta.url)
const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
const parameters = new URL('packages/expressions-boundary/src/parameters.ts', root).href
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};
import {readFile} from 'node:fs/promises';
export async function resolve(s, c, n) {
  if (s === '@epilogos/expressions-boundary/parameters') return n(${JSON.stringify(parameters)}, c);
  try { return await n(s, c) } catch (e) {
    if (!s.startsWith('.')) throw e;
    if (s.endsWith('.js')) { try { return await n(s.slice(0, -3) + '.ts', c) } catch {} }
    for (const x of ['.ts', '.tsx']) { try { return await n(s + x, c) } catch {} }
    throw e;
  }
}
export async function load(u, c, n) {
  if (u.endsWith('.css')) return {format: 'module', shortCircuit: true, source: 'export {}'};
  if (!u.endsWith('.ts') && !u.endsWith('.tsx')) return n(u, c);
  return {format: 'module', shortCircuit: true, source: ts.transpileModule(await readFile(new URL(u), 'utf8'), {fileName: new URL(u).pathname,
    compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX}}).outputText};
}`)}`, import.meta.url)

const [drag, browser, catalogue, pool, editors] = await Promise.all([
  import('../src/components/nativeDrag.ts'),
  import('../src/components/nativeBrowserModel.ts'),
  import('../src/components/nativeDeviceCatalogue.ts'),
  import('../src/components/NativeDevicePoolView.tsx'),
  import('../src/components/NativeDeviceEditors.tsx'),
])
const {FIELD_FACE_MODELS} = await import('../src/components/nativeFieldFaceModel.ts')
const {NATIVE_BINDINGS, bindValue} = await import(parameters)
const esc = value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const ENGINE = {mediumEnabled: false, resonanceEnabled: false, collisionEnabled: false, pairwiseEnabled: false, morphEnabled: false,
  colorEnabled: false, trajectory: 'toroidalHopf', driveShape: 'sine', colorMode: 'linearGradient', mediumPlane: 'vertical', autoOscillate: true}
// A minimal reading in the owner's shape. Parameter values are written through the same binding document path the reading uses.
function reading({devices = [], values = {}} = {}) {
  const scene = {name: 'Fixture', entities: [], automation: [], engine: {...ENGINE}, field: {background: '#ffffff', palette: ['#111111', '#222222'], material: 'ink', params: {}}}
  for (const [path, value] of Object.entries(values)) bindValue(scene, NATIVE_BINDINGS.find(row => row.path === path).bind, value)
  return {
    basis: {expression_ref: 'expr:fixture', revision: 1, scene_ref: 'scene:fixture', authored_revision: 1},
    scene, entityOccurrences: {}, chosenControls: {available: false, entries: [], controls: []}, devices,
    selection: {entity_ids: [], step_id: null}, history: {canUndo: false, canRedo: false},
    standing: {dirty: false, pending: false, notice: null},
  }
}
const physics = catalogue.deviceCatalogue().find(row => row.family === 'physics')
const pointer = catalogue.deviceCatalogue().find(row => row.family === 'pointer')

test('the Devices rows cover the whole catalogue, mark what is on the rack and search by name and group titles', () => {
  const devices = catalogue.deviceCatalogue()
  const onRack = reading({devices: [{id: 'device-1', family: 'physics'}]})
  const rows = browser.deviceRows(devices, onRack, '')
  assert.equal(rows.length, devices.length)
  assert.deepEqual(rows.map(row => row.family), devices.map(row => row.family))
  assert.equal(rows.find(row => row.family === 'physics').onRack, true)
  assert.equal(rows.find(row => row.family === 'pointer').onRack, false)
  // Summary is the panel's group titles joined, in the app's order.
  assert.equal(rows.find(row => row.family === 'physics').summary, physics.groups.map(group => group.title).join(' · ') || 'Parameters')
  // Search matches the name and a group title, case-insensitively; an unknown term matches nothing.
  const firstTitle = physics.groups[0].title
  assert.ok(browser.deviceRows(devices, onRack, firstTitle.toUpperCase()).some(row => row.family === 'physics'))
  assert.equal(browser.deviceRows(devices, onRack, physics.name.toLowerCase()).find(row => row.family === 'physics')?.name, physics.name)
  assert.equal(browser.deviceRows(devices, onRack, 'no-such-device-zzz').length, 0)
  // Without a reading nothing is on the rack and no activator state is known.
  const blank = browser.deviceRows(devices, null, '')
  assert.ok(blank.every(row => !row.onRack && row.enabled === undefined))
})

test('the open request is one typed event: valid shapes round-trip and malformed ones dispatch nothing', () => {
  const target = new EventTarget()
  const seen = []
  target.addEventListener(drag.OPEN_DEVICE_EVENT, event => seen.push(event.detail))
  const previous = globalThis.window
  globalThis.window = target
  try {
    drag.dispatchOpenDevice({scope: 'field', family: 'physics'})
    drag.dispatchOpenDevice({scope: 'entity', family: 'force'})
    drag.dispatchOpenDevice({scope: 'scene', family: 'text'})
    for (const bad of [{scope: 'studio', family: 'physics'}, {scope: 'field', family: 'Phys ics'}, {scope: 'field', family: 5},
      {scope: 'field'}, {scope: 'field', family: ''}, {scope: 'field', family: '../x'}, {scope: 'Scene', family: 'scene'}, null, ['field', 'physics']]) drag.dispatchOpenDevice(bad)
  } finally {globalThis.window = previous}
  assert.deepEqual(seen, [{scope: 'field', family: 'physics'}, {scope: 'entity', family: 'force'}, {scope: 'scene', family: 'text'}])
  assert.equal(drag.parseOpenDevice({scope: 'field', family: 'morph'}).family, 'morph')
  // The property browser's existing payload is exactly this shape.
  assert.deepEqual(drag.parseOpenDevice({scope: 'entity', family: 'force'}), {scope: 'entity', family: 'force'})
  // A scene family may arrive as 'scene' (new senders) or 'field' (older ones); both parse, and the pool routes by the family.
  assert.deepEqual(drag.parseOpenDevice({scope: 'scene', family: 'scene'}), {scope: 'scene', family: 'scene'})
  assert.deepEqual(drag.parseOpenDevice({scope: 'field', family: 'scene'}), {scope: 'field', family: 'scene'})
})

test('the Devices rows carry each family registry scope, so a scene row opens with scope scene', () => {
  const rows = browser.deviceRows(catalogue.deviceCatalogue(), null, '')
  const scopeOf = family => rows.find(row => row.family === family)?.scope
  assert.equal(scopeOf('scene'), 'scene')
  assert.equal(scopeOf('text'), 'scene')
  assert.equal(scopeOf('physics'), 'field')
  assert.equal(scopeOf('force'), 'entity')
})

test('a device drag payload round-trips and anything else is refused', () => {
  assert.equal(drag.parseDeviceDrag(JSON.stringify({family: 'pointer'})), 'pointer')
  assert.equal(drag.parseDeviceDrag(drag.encodeDeviceDrag('colour')), 'colour')
  for (const bad of ['not json', '{}', '[]', 'null', JSON.stringify({family: 'a b'}), JSON.stringify({family: 3}), '']) {
    assert.equal(drag.parseDeviceDrag(bad), null, bad)
  }
  assert.equal(drag.DEVICE_MIME, 'application/x-oi-native-device')
})

test('the insertion index follows the pointer between rack cards and the after_id names the widget before the gap', () => {
  const cards = [{left: 0, right: 100}, {left: 100, right: 200}, {left: 200, right: 300}]
  assert.equal(drag.deviceInsertIndex(10, cards), 0)
  assert.equal(drag.deviceInsertIndex(49, cards), 0)
  assert.equal(drag.deviceInsertIndex(60, cards), 1)
  assert.equal(drag.deviceInsertIndex(160, cards), 2)
  assert.equal(drag.deviceInsertIndex(999, cards), 3)
  assert.equal(drag.deviceInsertIndex(5, []), 0)
  const ids = ['a', 'b', 'c']
  assert.equal(drag.afterIdFor(0, ids), null, 'first gap inserts at the start')
  assert.equal(drag.afterIdFor(1, ids), 'a')
  assert.equal(drag.afterIdFor(2, ids), 'b')
  assert.equal(drag.afterIdFor(3, ids), 'c', 'the end gap follows the last widget')
  assert.equal(drag.afterIdFor(0, []), null)
  assert.equal(drag.afterIdFor(7, ids), 'c', 'an out-of-range index clamps to the last widget')
})

test('the expanded pool shows the whole requested Field panel with its rack state and the studio hand-off', () => {
  const render = (props = {}) => renderToStaticMarkup(createElement(pool.NativeDevicePoolView, {
    reading: reading(), request: async () => ({ok: false, error: 'stub'}), requested: {scope: 'field', family: 'physics', nonce: 1},
    isPresented: () => true, busy: false, error: null, onAdd() {}, onClose() {}, ...props}))
  const off = render()
  assert.ok(off.includes(esc(physics.name)), 'device name')
  assert.ok(off.includes('Add to rack'), 'addable while off the rack')
  assert.ok(!off.includes('On rack'))
  assert.ok(off.includes('Open in studio'), 'studio hand-off label')
  assert.ok(off.includes(esc(physics.studio)), 'studio id is named in the control title')
  assert.ok(off.includes('aria-label="Native visual device editors"'), 'NativeDeviceEditors renders the requested family')
  for (const group of physics.groups) assert.ok(off.includes(esc(group.title)), `group title ${group.title}`)
  const on = render({reading: reading({devices: [{id: 'device-1', family: 'physics'}]})})
  assert.ok(on.includes('On rack'), 'on-rack state')
  assert.ok(!on.includes('Add to rack'))
  // Refusals from the owner appear as an alert, not as a thrown error.
  assert.ok(render({error: 'The owner refused this device.'}).includes('role="alert"'))
  // A device not in the catalogue has no add or studio control, and an entity request names the Force.
  const force = renderToStaticMarkup(createElement(pool.NativeDevicePoolView, {reading: reading(), request: async () => ({ok: false, error: 'x'}),
    requested: {scope: 'entity', family: 'force', nonce: 1}, isPresented: () => true, busy: false, error: null, onAdd() {}, onClose() {}}))
  assert.ok(force.includes('Force'))
  assert.ok(!force.includes('Add to rack') && !force.includes('Open in studio'))
})

test('the family registry scope decides the panel: a field family asked as entity still shows its Field editors and device controls', () => {
  const html = renderToStaticMarkup(createElement(pool.NativeDevicePoolView, {reading: reading(), request: async () => ({ok: false, error: 'x'}),
    requested: {scope: 'entity', family: 'physics', nonce: 1}, isPresented: () => true, busy: false, error: null, onAdd() {}, onClose() {}}))
  assert.ok(html.includes('aria-label="Native visual device editors"'), 'Field editors for a Field family')
  assert.ok(html.includes('Add to rack') && html.includes('Open in studio'), 'the Field device controls follow the family')
  assert.ok(html.includes(esc(physics.name)))
})

test('without a native Expression the pool says so and its add control is disabled', () => {
  const markup = renderToStaticMarkup(createElement(pool.NativeDevicePoolView, {reading: null, request: async () => ({ok: false, error: 'x'}),
    requested: {scope: 'field', family: 'pointer', nonce: 1}, isPresented: () => false, busy: false, error: null, onAdd() {}, onClose() {}}))
  assert.ok(markup.includes(esc(pointer.name)))
  assert.ok(markup.includes('Open a native Expression to edit its devices.'))
  assert.match(markup, /class="native-device-pool-add"[^>]*disabled/)
  // The studio hand-off needs native work open: its event is only heard when the Expressions host is mounted.
  assert.match(markup, /class="native-device-pool-studio"[^>]*disabled=""[^>]*title="Open a native Expression to show this panel in the Expressions Studio"/)
  const open = renderToStaticMarkup(createElement(pool.NativeDevicePoolView, {reading: reading(), request: async () => ({ok: false, error: 'x'}),
    requested: {scope: 'field', family: 'pointer', nonce: 1}, isPresented: () => true, busy: false, error: null, onAdd() {}, onClose() {}}))
  assert.match(open, /class="native-device-pool-studio"(?![^>]*disabled)/, 'enabled while native work is open')
})

test('the pool applies device changes only through the retained owner and refuses when no owner or reading is present', async () => {
  const calls = []
  const owner = {request: async op => {calls.push(op); return {ok: true, reading: reading()}}}
  const applied = await pool.applyDeviceChanges({editor: owner, editorReading: reading()}, [{kind: 'device-add', family: 'physics'}])
  assert.equal(applied.ok, true)
  assert.deepEqual(calls, [{operation: 'apply', basis: reading().basis, changes: [{kind: 'device-add', family: 'physics'}]}])
  const none = await pool.applyDeviceChanges({editor: null, editorReading: reading()}, [])
  assert.equal(none.ok, false)
  const pending = reading()
  pending.standing.pending = true
  assert.equal((await pool.applyDeviceChanges({editor: owner, editorReading: pending}, [])).ok, false)
  // A thrown owner error is returned as a refusal, not raised into the UI.
  const broken = {request: async () => {throw new Error('owner offline')}}
  assert.deepEqual(await pool.applyDeviceChanges({editor: broken, editorReading: reading()}, [{kind: 'device-add', family: 'physics'}]),
    {ok: false, error: 'owner offline'})
  assert.equal(typeof editors.NativeDeviceEditors, 'function')
})
