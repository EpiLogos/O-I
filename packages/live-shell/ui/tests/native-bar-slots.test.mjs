import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'
import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'

// Production sources in memory, same loader as the sibling native tests: .ts/.tsx
// is transpiled, .css is a non-executing stub. The bar model and its controls are
// rendered through react-dom/server; no frame, store or engine is simulated.
const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};
import {readFile} from 'node:fs/promises';
export async function resolve(specifier,context,next){
  try{return await next(specifier,context)}catch(error){
    if(!specifier.startsWith('.'))throw error;
    if(specifier.endsWith('.js')){try{return await next(specifier.slice(0,-3)+'.ts',context)}catch{}}
    for(const suffix of ['.ts','.tsx']){try{return await next(specifier+suffix,context)}catch{}}
    throw error;
  }
}
export async function load(url,context,next){
  if(url.endsWith('.css'))return {format:'module',shortCircuit:true,source:'export {}'};
  if(!url.endsWith('.ts')&&!url.endsWith('.tsx'))return next(url,context);
  return {format:'module',shortCircuit:true,source:ts.transpileModule(await readFile(new URL(url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX},fileName:new URL(url).pathname}).outputText};
}`)}`, import.meta.url)

const [bar, controls, parameters, stage] = await Promise.all([
  import('../src/components/nativeBarModel.ts'),
  import('../src/components/NativeBarControls.tsx'),
  import('@epilogos/expressions-boundary/parameters'),
  import('../src/native/stageCommands.ts'),
])
const {BarValue, BarTools, BarPointerGroup, BarEngineLight} = controls
const {NATIVE_BINDINGS, baseValue} = parameters

// The bar's slot catalogue, its toggles, the shape-hold macro rack, the particle-size range handles and the per-viewer hidden slots.
const bars = await import('../src/components/nativeBarSlots.ts')
const rackSchema = await import('../../../expressions-boundary/src/nativeRackSchema.ts')
const rackReducer = await import('../../../expressions-boundary/src/nativeRacks.ts')
const panelSettings = await import('../../../expressions-boundary/src/nativeFieldPanelSettings.ts')
const deviceEdits = await import('../../../expressions-boundary/src/nativeDeviceEdits.ts')
const model = await import('../../../../desktop/cradle/expressions-app/field-studies-journeys/src/model.ts')
const {SEED_SLOTS, barSlots, readHiddenSlots, writeHiddenSlots, barMacroRack, barMacroCreate, barMacroPoints, barRangeState, clampRangeHandle, rangeFraction, rangeValue} = bars
const {validateNativeRackState} = rackSchema
const {applyNativeRackChanges} = rackReducer
const {FIELD_PANEL_SETTINGS} = panelSettings
const {validateNativeFieldPanelChange, applyNativeDeviceChanges} = deviceEdits
const {blankJourney} = model

const HIDDEN_KEY = 'oi.live-shell.bar-hidden'
const bind = path => {
  const found = NATIVE_BINDINGS.find(item => item.path === path)
  assert.ok(found, `registry defines ${path}`)
  return found
}
const seed = id => {
  const slot = SEED_SLOTS.find(item => item.id === id)
  assert.ok(slot, `seed slot ${id}`)
  return slot
}
const pathsOf = slot => slot.kind === 'value' || slot.kind === 'pair' ? [slot.path]
  : slot.kind === 'range' ? [slot.minPath, slot.maxPath]
  : slot.kind === 'macro' ? slot.macro.mappings.map(mapping => mapping.path) : []
const near = (actual, expected, tolerance = 1e-12) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} is near ${expected}`)
/** A reading carrying only the fields the bar slots read. */
const readingOf = (scene, {entries = [], occurrences = {}, selected = []} = {}) => ({
  scene, entityOccurrences: occurrences, chosenControls: {available: true, entries, controls: []}, selection: {entity_ids: selected, step_id: null},
})
const freshScene = () => structuredClone(blankJourney().scenes[0])
/** Runs a body with globalThis.localStorage replaced by the given store (undefined makes it absent), then restores it. */
function withLocalStorage(store, run) {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  Object.defineProperty(globalThis, 'localStorage', {configurable: true, enumerable: true, get: () => store})
  try {return run()}
  finally {if (original) Object.defineProperty(globalThis, 'localStorage', original); else delete globalThis.localStorage}
}
function mapStorage(initial = {}) {
  const map = new Map(Object.entries(initial))
  return {map, getItem: key => map.has(key) ? map.get(key) : null, setItem: (key, value) => map.set(key, String(value))}
}

test('seed slots keep the owner order, their catalogue paths and the bounded particle band', () => {
  assert.deepEqual(SEED_SLOTS.map(slot => slot.id), ['time-scale', 'viscosity', 'shape-hold', '3d', 'particle-size', 'cymatic', 'relational', 'turbulence', 'ink-opacity'])
  const paths = SEED_SLOTS.flatMap(pathsOf)
  assert.deepEqual(paths, ['fluid.timeScale', 'fluid.viscosity', 'fluid.snapRigidity', 'fluid.densityTether', 'particleSize.min', 'particleSize.max', 'cymatics.plateSize', 'fluid.turbulence', 'material.opacity'])
  for (const path of paths) bind(path)
  assert.equal(seed('time-scale').placement, 'transport')
  assert.equal(seed('cymatic').kind, 'pair')
  assert.equal(seed('cymatic').path, 'cymatics.plateSize')
  assert.notEqual(seed('cymatic').path, 'medium.gridRes')
  assert.deepEqual(seed('particle-size').band, {from: 0.2, to: 1.4})
  assert.equal(seed('shape-hold').macro.rackId, 'bar.shape-hold')
  assert.deepEqual(seed('shape-hold').macro.mappings, [{path: 'fluid.snapRigidity', min: 0, max: 5}, {path: 'fluid.densityTether', min: 0, max: 3}])
})

test('barSlots: no reading shows the seed, and hidden seed ids are removed', () => {
  assert.deepEqual(barSlots(null, new Set()), [...SEED_SLOTS])
  assert.deepEqual(barSlots(null, new Set(['viscosity', '3d'])).map(slot => slot.id),
    ['time-scale', 'shape-hold', 'particle-size', 'cymatic', 'relational', 'turbulence', 'ink-opacity'])
  assert.deepEqual(barSlots(readingOf(freshScene()), new Set(['time-scale'])).map(slot => slot.id),
    ['viscosity', 'shape-hold', '3d', 'particle-size', 'cymatic', 'relational', 'turbulence', 'ink-opacity'])
})

test('barSlots: Field-scoped chosen controls append once after the seed, and never duplicate a shown path', () => {
  const gravityY = bind('fluid.gravityY').key
  const reading = readingOf(freshScene(), {entries: [
    {id: 'belt-1', key: gravityY, scope: 'field'},
    {id: 'belt-2', key: bind('fluid.turbulence').key, scope: 'field'},
    {id: 'belt-3', key: gravityY, scope: 'selected'},
    {id: 'belt-4', key: gravityY, scope: 'named', entityId: 'e1'},
    {id: 'belt-5', key: 'no_such_key', scope: 'field'},
    {id: 'belt-6', key: gravityY, scope: 'field'},
    {id: 'belt-7', key: bind('fluid.snapRigidity').key, scope: 'field'},
    {id: 'belt-8', key: bind('cymatics.plateSize').key, scope: 'field'},
  ]})
  const slots = barSlots(reading, new Set())
  assert.equal(slots.length, SEED_SLOTS.length + 1)
  assert.deepEqual(slots.slice(0, SEED_SLOTS.length), [...SEED_SLOTS])
  assert.deepEqual(slots.at(-1), {kind: 'value', id: 'pin:belt-1', path: 'fluid.gravityY', placement: 'bar', entryId: 'belt-1'})
})

test('barSlots: a pin on a second Field path appends after the first pin, in entry order', () => {
  const reading = readingOf(freshScene(), {entries: [
    {id: 'p-a', key: bind('fluid.gravityY').key, scope: 'field'},
    {id: 'p-b', key: bind('interaction.strength').key, scope: 'field'},
  ]})
  const tail = barSlots(reading, new Set()).slice(SEED_SLOTS.length)
  assert.deepEqual(tail.map(slot => [slot.entryId, slot.path]), [['p-a', 'fluid.gravityY'], ['p-b', 'interaction.strength']])
})

test('toggle specs read the engine flag as undefined, true or false', () => {
  for (const [slotId, flag] of [['3d', 'volumeEnabled'], ['cymatic', 'resonanceEnabled'], ['relational', 'relationalEnabled']]) {
    const toggle = seed(slotId).toggle
    const scene = freshScene()
    scene.engine = {}
    assert.equal(toggle.read(readingOf(scene)), undefined, `${slotId} with no flag`)
    scene.engine[flag] = true
    assert.equal(toggle.read(readingOf(scene)), true, `${slotId} on`)
    scene.engine[flag] = false
    assert.equal(toggle.read(readingOf(scene)), false, `${slotId} off`)
  }
})

test('toggle changes have exactly the admitted shapes, and each panel setting is admitted as a boolean', () => {
  assert.deepEqual(seed('3d').toggle.changes(true), [{kind: 'panel-setting', key: 'volumeEnabled', value: true}, {kind: 'panel-setting', key: 'depthPerspective', value: true}])
  assert.deepEqual(seed('3d').toggle.changes(false), [{kind: 'panel-setting', key: 'volumeEnabled', value: false}, {kind: 'panel-setting', key: 'depthPerspective', value: false}])
  assert.deepEqual(seed('cymatic').toggle.changes(true), [{kind: 'field-setting', key: 'resonanceEnabled', value: true}])
  assert.deepEqual(seed('cymatic').toggle.changes(false), [{kind: 'field-setting', key: 'resonanceEnabled', value: false}])
  assert.deepEqual(seed('relational').toggle.changes(true), [{kind: 'panel-setting', key: 'relationalEnabled', value: true}])
  for (const change of [...seed('3d').toggle.changes(true), ...seed('relational').toggle.changes(false)]) {
    assert.equal(FIELD_PANEL_SETTINGS[change.key]?.type, 'boolean', `${change.key} is a boolean panel setting`)
    assert.deepEqual(validateNativeFieldPanelChange(change), change)
  }
})

test('toggle changes apply through the real device reducer and set the engine flags', () => {
  const journey = blankJourney()
  const sceneId = journey.scenes[0].id
  const changes = [...seed('3d').toggle.changes(true), ...seed('cymatic').toggle.changes(true), ...seed('relational').toggle.changes(true)]
  const engine = applyNativeDeviceChanges(journey, sceneId, changes, {}).scenes[0].engine
  assert.equal(engine.volumeEnabled, true)
  assert.equal(engine.depthPerspective, true)
  assert.equal(engine.resonanceEnabled, true)
  assert.equal(engine.relationalEnabled, true)
})

test('the shape-hold macro: the rack-set validates, and its position is the clamped snap rigidity fraction', () => {
  const macro = seed('shape-hold').macro
  const snap = bind('fluid.snapRigidity').key
  for (const [current, expected] of [[1, 0.2], [5, 1], [9, 1], [0, 0]]) {
    const scene = freshScene()
    scene.field.params[snap] = current
    const change = barMacroCreate(readingOf(scene), macro)
    assert.equal(change.kind, 'rack-set')
    assert.equal(change.rack.id, 'bar.shape-hold')
    assert.doesNotThrow(() => validateNativeRackState({schema: 'oi.parameter-racks/v1', racks: [change.rack]}, scene, {}))
    near(change.rack.macros[0].value, expected)
  }
})

test('the shape-hold rack is added by a change that writes no parameter, then drives both parameters', () => {
  const macro = seed('shape-hold').macro
  const journey = blankJourney()
  const sceneId = journey.scenes[0].id
  const snap = bind('fluid.snapRigidity').key, tether = bind('fluid.densityTether').key
  journey.scenes[0].field.params[snap] = 1
  const before = structuredClone(journey.scenes[0].field.params)
  assert.equal(barMacroRack(readingOf(journey.scenes[0]), macro), null)

  const change = barMacroCreate(readingOf(journey.scenes[0]), macro)
  const added = applyNativeRackChanges(journey, sceneId, [change], {})
  assert.deepEqual(added.scenes[0].field.params, before, 'adding the macro moves no parameter')
  const rack = barMacroRack({scene: added.scenes[0], entityOccurrences: {}}, macro)
  assert.ok(rack, 'the rack is present after the add')
  assert.equal(rack.id, 'bar.shape-hold')
  near(rack.macros[0].value, 0.2)

  const driven = applyNativeRackChanges(added, sceneId, [{kind: 'rack-macro-value', rack_id: 'bar.shape-hold', macro_id: 'hold', value: 0.5}], {})
  assert.equal(driven.scenes[0].field.params[snap], 2.5)
  assert.equal(driven.scenes[0].field.params[tether], 1.5)
})

test('barMacroPoints names the same targets and values that the rack write commits at each position', () => {
  const macro = seed('shape-hold').macro
  const snap = bind('fluid.snapRigidity').key, tether = bind('fluid.densityTether').key
  for (const [position, snapValue, tetherValue] of [[0, 0, 0], [0.5, 2.5, 1.5], [1, 5, 3]]) {
    const points = barMacroPoints(macro, position)
    assert.deepEqual(points, [{target: 'field.' + snap, value: snapValue}, {target: 'field.' + tether, value: tetherValue}])
    const journey = blankJourney()
    const sceneId = journey.scenes[0].id
    const withRack = applyNativeRackChanges(journey, sceneId, [barMacroCreate(readingOf(journey.scenes[0]), macro)], {})
    const written = applyNativeRackChanges(withRack, sceneId, [{kind: 'rack-macro-value', rack_id: macro.rackId, macro_id: macro.macroId, value: position}], {})
    for (const point of points) assert.equal(written.scenes[0].field.params[point.target.slice('field.'.length)], point.value, `${point.target} at ${position}`)
  }
})

test('the particle-size range: state from the scene, registry hard bounds, and handles that never cross', () => {
  const low = bind('particleSize.min'), high = bind('particleSize.max')
  const scene = freshScene()
  scene.field.params[low.key] = 0.2
  scene.field.params[high.key] = 1.4
  const state = barRangeState(readingOf(scene), 'particleSize.min', 'particleSize.max')
  assert.equal(state.min, 0.2)
  assert.equal(state.max, 1.4)
  assert.equal(state.lowest, low.hardMin)
  assert.equal(state.highest, high.hardMax)
  assert.equal(state.track.scale, 'log')
  assert.equal(state.track.min, low.min)
  assert.equal(state.track.max, high.max)
  assert.equal(barRangeState(readingOf(scene), 'no.such.path', 'particleSize.max'), null)

  const unset = freshScene()
  delete unset.field.params[low.key]
  assert.equal(barRangeState(readingOf(unset), 'particleSize.min', 'particleSize.max').min, low.defaultValue)

  assert.equal(clampRangeHandle('min', 5, state), 1.4)
  assert.equal(clampRangeHandle('min', -1, state), state.lowest)
  assert.equal(clampRangeHandle('min', 0.5, state), 0.5)
  assert.equal(clampRangeHandle('max', 0.01, state), 0.2)
  assert.equal(clampRangeHandle('max', 1000, state), state.highest)
  assert.equal(clampRangeHandle('max', 0.9, state), 0.9)
})

test('the range track: fraction and value are inverse, and the 0.2 to 1.4 band sits strictly inside the track', () => {
  const scene = freshScene()
  scene.field.params[bind('particleSize.min').key] = 0.2
  scene.field.params[bind('particleSize.max').key] = 1.4
  const state = barRangeState(readingOf(scene), 'particleSize.min', 'particleSize.max')
  for (const value of [0.2, 1.4]) near(rangeValue(rangeFraction(value, state), state), value, 1e-9)
  const band = seed('particle-size').band
  const from = rangeFraction(band.from, state), to = rangeFraction(band.to, state)
  assert.ok(0 < from && from < to && to < 1, `${from} < ${to} inside (0,1)`)
  near(rangeValue(-5, state), state.track.min, 1e-9)
  near(rangeValue(7, state), state.track.max, 1e-9)
})

test('hidden-slot storage: absent or throwing localStorage means nothing hidden and no error', () => {
  assert.deepEqual([...withLocalStorage(undefined, () => readHiddenSlots())], [])
  assert.doesNotThrow(() => withLocalStorage(undefined, () => writeHiddenSlots(new Set(['viscosity']))))
  const throwing = {getItem() {throw new Error('storage denied')}, setItem() {throw new Error('storage denied')}}
  assert.deepEqual([...withLocalStorage(throwing, () => readHiddenSlots())], [])
  assert.doesNotThrow(() => withLocalStorage(throwing, () => writeHiddenSlots(new Set(['viscosity']))))
})

test('hidden-slot storage: write then read round-trips through a stub store', () => {
  const store = mapStorage()
  withLocalStorage(store, () => {
    writeHiddenSlots(new Set(['viscosity', '3d']))
    assert.equal(store.map.get(HIDDEN_KEY), JSON.stringify(['viscosity', '3d']))
    assert.deepEqual([...readHiddenSlots()].sort(), ['3d', 'viscosity'])
  })
})

test('hidden-slot storage: unknown ids and non-strings are dropped; corrupt or non-array JSON gives an empty set', () => {
  const dirty = mapStorage({[HIDDEN_KEY]: JSON.stringify(['viscosity', 'nope', 3, null, {id: '3d'}, '3d', 'viscosity'])})
  withLocalStorage(dirty, () => assert.deepEqual([...readHiddenSlots()].sort(), ['3d', 'viscosity']))
  withLocalStorage(mapStorage({[HIDDEN_KEY]: '{"broken"'}), () => assert.equal(readHiddenSlots().size, 0))
  withLocalStorage(mapStorage({[HIDDEN_KEY]: '{"id":"viscosity"}'}), () => assert.equal(readHiddenSlots().size, 0))
  withLocalStorage(mapStorage(), () => assert.equal(readHiddenSlots().size, 0))
})
