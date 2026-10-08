import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {register} from 'node:module'

// Production sources through the same TypeScript loader as the sibling native tests.
// Fixtures are in-memory Journeys; no native owner, GPU or saved receipt is involved.
const root = new URL('../../../../', import.meta.url)
const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
const parameters = new URL('packages/expressions-boundary/src/parameters.ts', root).href
register(`data:text/javascript,${encodeURIComponent(`import ts from ${JSON.stringify(compiler)};import {readFile} from 'node:fs/promises';export async function resolve(s,c,n){if(s==='@epilogos/expressions-boundary/parameters')return n(${JSON.stringify(parameters)},c);try{return await n(s,c)}catch(e){if(!s.startsWith('.'))throw e;if(s.endsWith('.js')){try{return await n(s.slice(0,-3)+'.ts',c)}catch{}}for(const x of ['.ts','.tsx']){try{return await n(s+x,c)}catch{}}throw e}}export async function load(u,c,n){if(u.endsWith('.css'))return {format:'module',shortCircuit:true,source:'export {}'};if(u.endsWith('?raw'))return {format:'module',shortCircuit:true,source:'export default '+JSON.stringify(await readFile(new URL(u.split('?')[0]),'utf8'))};if(!u.endsWith('.ts')&&!u.endsWith('.tsx'))return n(u,c);return {format:'module',shortCircuit:true,source:ts.transpileModule(await readFile(new URL(u),'utf8'),{fileName:new URL(u).pathname,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText}}`)}`, import.meta.url)

const author = new URL('../../../../desktop/cradle/expressions-app/field-studies-journeys/src/', import.meta.url)
const [devices, panels, model, shared, bridge, timeline, hostEditorSource] = await Promise.all([
  import(new URL('../../../expressions-boundary/src/nativeDeviceEdits.ts', import.meta.url)),
  import(new URL('../../../expressions-boundary/src/nativeFieldPanelSettings.ts', import.meta.url)),
  import(new URL('model.ts', author)),
  import(new URL('sharedSettings.ts', author)),
  import(new URL('nativeBridge.ts', author)),
  import(new URL('timeline.ts', author)),
  readFile(new URL('hostEditor.ts', author), 'utf8'),
])
const {FIELD_PANEL_SETTINGS} = panels
const {NATIVE_BINDINGS} = await import(parameters)
const NATIVE_PATHS = NATIVE_BINDINGS.map(row => row.path)

// Option lists copied from the source option arrays; inspector.ts does not export them.
const SOURCE_OPTIONS = {
  backgroundMode: ['solid', 'vignette', 'ambientGlow', 'adaptive'], // inspector.ts:118
  dotShape: ['circle', 'square'], // inspector.ts:122
  volumeProfile: ['slab', 'bevel', 'round', 'dome', 'taper'], // inspector.ts:123
  pointerMode: ['attract', 'repel', 'vortex'], // inspector.ts:125
  pointerClick: ['pulse', 'implode', 'vortex', 'shove', 'off'], // inspector.ts:125
  pointerScope: ['global', 'local'], // inspector.ts:125 (Scene.pointerScope)
  relationalMode: ['orbital', 'nbody', 'chaos'], // inspector.ts:134
  frequencyDriver: ['manual', 'focus', 'automation'], // inspector.ts:127
  plane: ['XY', 'XZ', 'YZ'], // inspector.ts:144 (Scene.composition.plane, 'Layout plane')
  sweepDirection: ['ascent', 'descent', 'pingpong'], // inspector.ts:131
  templateDimension: ['2D', '3D'], // inspector.ts:132
  resonatorMode: ['resonator', 'template'], // inspector.ts:133
  focus: ['parallel', 'travelling'], // inspector.ts:228
  focusOrder: ['listed', 'reverse', 'pingpong'], // inspector.ts:230
}
// Toggles: inspector.ts:122 grainProfile; :123 volumeEnabled, depthPerspective, depthOcclusion
// (select written as 'off'/'on', admitted as boolean); :134 relationalEnabled; :130 autoSweep; :231 carryTint, carryStation.
const SOURCE_BOOLEAN = ['grainProfile', 'volumeEnabled', 'depthPerspective', 'depthOcclusion', 'relationalEnabled', 'autoSweep', 'carryTint', 'carryStation', 'autoFitSizes']
// Number shares: inspector.ts:123 range('Depth in the swirl' | 'Depth in the bridge', 'engine.vortex3d' | 'engine.dispersion3d', …, 0, 1, .01).
const SOURCE_NUMBER = {vortex3d: {label: 'Depth in the swirl', min: 0, max: 1, step: 0.01}, dispersion3d: {label: 'Depth in the bridge', min: 0, max: 1, step: 0.01}}
// Already admitted by other kinds in nativeDeviceEdits.ts; the panel table must not repeat them.
const ALREADY_ADMITTED = ['mediumEnabled', 'mediumDimension', 'mediumPlane', 'resonanceEnabled', 'collisionEnabled', 'pairwiseEnabled', 'collisionMode',
  'morphEnabled', 'autoOscillate', 'trajectory', 'driveShape', 'law', 'colorEnabled', 'colorMode']

const [formationA, formationB, formationC] = model.chakraEntities()
const forcePin = model.pin({x: 0, y: 0, z: 0})
const journeyWith = (entities = [formationA, forcePin, formationB, formationC]) => {
  const journey = model.blankJourney()
  journey.scenes[0].entities = structuredClone(entities)
  return journey
}
const panel = (key, value) => ({kind: 'panel-setting', key, value})
const apply = (journey, changes) => devices.applyNativeDeviceChanges(journey, journey.scenes[0].id, changes)
const readField = (journey, key) => {
  const scene = shared.effectiveScene(journey, journey.scenes[0]), spec = FIELD_PANEL_SETTINGS[key]
  return spec.target === 'scene' ? scene.pointerScope : scene[spec.target][key]
}
// Admitted sample values per kind: both booleans, the options, or both inclusive bounds plus an interior non-step value.
const admittedValues = key => {
  const spec = FIELD_PANEL_SETTINGS[key]
  return spec.type === 'number' ? [spec.min, 0.37, spec.max] : spec.type === 'enum' ? spec.options : [true, false]
}
const ids = entities => entities.map(entity => entity.id)

test('the panel table is exactly the disclosed non-numeric keys with their source option lists', () => {
  assert.deepEqual(Object.keys(FIELD_PANEL_SETTINGS).sort(), [...SOURCE_BOOLEAN, ...Object.keys(SOURCE_OPTIONS), ...Object.keys(SOURCE_NUMBER)].sort())
  for (const key of SOURCE_BOOLEAN) assert.deepEqual(FIELD_PANEL_SETTINGS[key], {target: FIELD_PANEL_SETTINGS[key].target, type: 'boolean'}, key)
  for (const [key, source] of Object.entries(SOURCE_NUMBER)) assert.deepEqual(FIELD_PANEL_SETTINGS[key], {target: 'engine', type: 'number', min: source.min, max: source.max, step: source.step}, key)
  for (const [key, options] of Object.entries(SOURCE_OPTIONS)) {
    assert.equal(FIELD_PANEL_SETTINGS[key].type, 'enum', key)
    assert.deepEqual([...FIELD_PANEL_SETTINGS[key].options], options, key)
  }
  assert.equal(FIELD_PANEL_SETTINGS.pointerScope.target, 'scene')
  assert.deepEqual(Object.values(FIELD_PANEL_SETTINGS).map(spec => spec.target).filter((target, i, all) => all.indexOf(target) === i).sort(), ['composition', 'engine', 'scene'])
})

test('panel keys are disjoint from the field-setting, morph and colour admissions and from numeric bindings', () => {
  for (const key of Object.keys(FIELD_PANEL_SETTINGS)) assert.ok(!ALREADY_ADMITTED.includes(key), `${key} is already admitted`)
  assert.deepEqual(Object.keys(devices.NATIVE_MORPH_SETTINGS).filter(key => !ALREADY_ADMITTED.includes(key)), [])
  const paths = Object.entries(FIELD_PANEL_SETTINGS).map(([key, spec]) => spec.target + '.' + key)
  assert.equal(new Set(paths).size, paths.length)
  for (const path of ['engine.mediumPlane', 'engine.morphEnabled', 'engine.colorEnabled', 'engine.pointerClickStrength']) assert.ok(!paths.includes(path), path)
  // The two number shares are admitted here, not as registry bindings: they are engine fields, not NATIVE_BINDINGS paths.
  assert.ok(paths.includes('engine.vortex3d') && paths.includes('engine.dispersion3d'))
  assert.ok(!NATIVE_PATHS.includes('engine.vortex3d') && !NATIVE_PATHS.includes('engine.dispersion3d'))
})

test('every table key applies each admitted value at its exact Scene path and reads it back', () => {
  for (const key of Object.keys(FIELD_PANEL_SETTINGS)) {
    const journey = journeyWith(), before = structuredClone(journey), spec = FIELD_PANEL_SETTINGS[key]
    for (const value of admittedValues(key)) {
      const next = apply(journey, [panel(key, value)])
      assert.equal(readField(next, key), value, `${key}=${value}`)
      assert.deepEqual(journey, before, `${key} must not mutate the caller document`)
      if (spec.target !== 'scene') {
        const other = spec.target === 'engine' ? 'composition' : 'engine'
        assert.deepEqual(next.scenes[0][other], before.scenes[0][other], `${key} writes only ${spec.target}`)
        assert.equal(next.scenes[0][spec.target][key], value, `${key} written at its own path`)
      } else {
        assert.equal(next.scenes[0].pointerScope, value)
      }
    }
  }
})

test('mistyped, out-of-list, foreign-operand and unknown panel settings refuse without mutating the caller', () => {
  const journey = journeyWith(), before = structuredClone(journey)
  for (const [key, spec] of Object.entries(FIELD_PANEL_SETTINGS)) {
    const wrong = spec.type === 'boolean' ? ['true', 1, null, 'on', undefined]
      : spec.type === 'number' ? ['0.5', null, undefined, true, NaN, Infinity, -Infinity, -0.01, 1.01, [0.5], {}, '']
      : ['invented', '', 1, true, null, undefined, 'Solid']
    for (const value of wrong) assert.throws(() => apply(journey, [panel(key, value)]), /admitted native Field panel setting/, `${key}=${String(value)}`)
    const valid = admittedValues(key)[0]
    assert.throws(() => apply(journey, [{...panel(key, valid), entity_id: formationA.id}]), /foreign operands|belongs only/, `${key} entity operand`)
    assert.throws(() => apply(journey, [{...panel(key, valid), scope: 'entity'}]), /foreign operands|belongs only/, `${key} scope operand`)
  }
  for (const key of ['mediumPlane', 'mediumEnabled', 'morphEnabled', 'law', 'colorEnabled', 'colorMode', 'fontWeight', 'pointerClickStrength', 'depthTintColor', 'palette', 'background', 'engine', 'composition', '__proto__', 'constructor', 'toString'])
    assert.throws(() => apply(journey, [panel(key, true)]), /admitted native Field panel setting/, `${key} is outside the table`)
  for (const row of [null, 'panel-setting', [], {kind: 'panel-setting', key: 'focus'}])
    assert.throws(() => devices.validateNativeFieldPanelChange(row), /admitted native Field panel setting/, JSON.stringify(row))
  assert.throws(() => apply(journey, [{kind: 'field-setting', key: 'pointerScope', value: 'local'}]), /admitted shared-medium setting/)
  assert.throws(() => apply(journey, [{kind: 'panel-setting', key: 'focus'}]), /admitted native Field panel setting/)
  assert.throws(() => apply(journey, [panel('focus', 'travelling'), panel('focus', 'parallel')]), /same Field panel setting twice/)
  assert.throws(() => apply(journey, [panel('carryTint', false), panel('focus', 'bogus')]), /admitted native Field panel setting/)
  assert.deepEqual(journey, before)
})

test('shared-versus-local law: Expression-wide keys write the shared bucket, Scene-local keys write the Scene', () => {
  // Pointer paths under global scope write the shared pointer bucket (sharedSettings.ts POINTER_PATHS).
  const pointer = journeyWith()
  shared.initialiseShared(pointer)
  const pointerBefore = structuredClone(pointer.shared.pointer)
  const pointerNext = apply(pointer, [panel('pointerMode', 'vortex')])
  assert.equal(pointerNext.shared.pointer['engine.pointerMode'], 'vortex')
  assert.equal(pointerNext.scenes[0].engine.pointerMode, pointer.scenes[0].engine.pointerMode, 'Scene engine keeps its own value')
  assert.equal(shared.effectiveScene(pointerNext, pointerNext.scenes[0]).engine.pointerMode, 'vortex')
  assert.notDeepEqual(pointerNext.shared.pointer, pointerBefore)

  // A toggled-shared engine key writes the shared values bucket.
  const toggled = journeyWith()
  shared.toggleShared(toggled, toggled.scenes[0], 'engine.backgroundMode')
  const toggledNext = apply(toggled, [panel('backgroundMode', 'vignette')])
  assert.equal(toggledNext.shared.values['engine.backgroundMode'], 'vignette')
  assert.equal(toggledNext.scenes[0].engine.backgroundMode, toggled.scenes[0].engine.backgroundMode)
  assert.equal(readField(toggledNext, 'backgroundMode'), 'vignette')

  // Local scope: pointer writes land on the Scene and the shared pointer bucket is untouched.
  const local = journeyWith()
  shared.initialiseShared(local)
  const localShared = structuredClone(local.shared.pointer)
  const localScene = apply(local, [panel('pointerScope', 'local')])
  assert.equal(localScene.scenes[0].pointerScope, 'local')
  const localNext = apply(localScene, [panel('pointerMode', 'attract')])
  assert.equal(localNext.scenes[0].engine.pointerMode, 'attract')
  assert.deepEqual(localNext.shared.pointer, localShared)
  assert.equal(shared.effectiveScene(localNext, localNext.scenes[0]).engine.pointerMode, 'attract')
  assert.equal(apply(localNext, [panel('pointerScope', 'global')]).scenes[0].pointerScope, 'global')
})

test('admitted values reach the compiled native configuration through the existing bridge', () => {
  const compiled = (journey, key, value) => {
    const next = apply(journey, [panel(key, value)])
    return bridge.toNativeConfig(shared.effectiveScene(next, next.scenes[0]))
  }
  const base = journeyWith()
  assert.equal(compiled(base, 'volumeEnabled', true).glyphVolume.enabled, true)
  assert.equal(compiled(base, 'volumeProfile', 'dome').glyphVolume.profile, 'dome')
  assert.equal(compiled(base, 'relationalEnabled', true).relational.enabled, true)
  assert.equal(compiled(base, 'relationalMode', 'chaos').relational.mode, 'chaos')
  assert.equal(compiled(base, 'depthPerspective', true).depth.projection, 'perspective')
  assert.equal(compiled(base, 'depthOcclusion', true).depth.occlusion, true)
  assert.equal(compiled(base, 'focusOrder', 'reverse').composition.orchestration.order, 'reverse')
  assert.equal(compiled(base, 'focus', 'travelling').composition.orchestration.mode, 'focus')
  assert.equal(compiled(base, 'carryTint', false).composition.orchestration.focusTintWeight, 0)
  assert.equal(compiled(base, 'templateDimension', '3D').cymatics.dimension, '3D')
  assert.equal(compiled(base, 'resonatorMode', 'template').cymatics.engine, 'template')
  assert.equal(compiled(base, 'sweepDirection', 'descent').cymatics.sweep.direction, 'descent')
  const driven = apply(apply(base, [panel('frequencyDriver', 'automation')]), [panel('autoSweep', true)])
  assert.equal(bridge.toNativeConfig(shared.effectiveScene(driven, driven.scenes[0])).cymatics.sweep.enabled, true)
  const undriven = apply(base, [panel('autoSweep', true)])
  assert.equal(bridge.toNativeConfig(shared.effectiveScene(undriven, undriven.scenes[0])).cymatics.sweep.enabled, false)
})

test('route-order accepts a complete formation permutation and leaves pins and their slots untouched', () => {
  const journey = journeyWith(), [a, pin, b, c] = journey.scenes[0].entities
  const next = apply(journey, [{kind: 'route-order', entity_ids: [c.id, b.id, a.id]}])
  assert.deepEqual(ids(next.scenes[0].entities), [c.id, pin.id, b.id, a.id])
  assert.deepEqual(next.scenes[0].entities[1], pin, 'pin object and index are preserved')
  assert.deepEqual(journey.scenes[0].entities.map(e => e.id), [a.id, pin.id, b.id, c.id], 'caller document is not mutated')
  // Same result as the app's own one-step reorder (timeline.ts reorderFocus).
  const stepped = structuredClone(journey.scenes[0].entities)
  timeline.reorderFocus(stepped, b.id, -1)
  const route = apply(journey, [{kind: 'route-order', entity_ids: [b.id, a.id, c.id]}])
  assert.deepEqual(ids(route.scenes[0].entities), ids(stepped))
  // Disabled and locked formations keep their route slot; the app does not gate reorders on locks either.
  const disabled = journeyWith(); disabled.scenes[0].entities[2].enabled = false
  const kept = apply(disabled, [{kind: 'route-order', entity_ids: [c.id, disabled.scenes[0].entities[2].id, a.id]}])
  assert.deepEqual(ids(kept.scenes[0].entities), [c.id, pin.id, disabled.scenes[0].entities[2].id, a.id])
  const locked = journeyWith(); locked.scenes[0].entities[0].locked = true
  assert.deepEqual(ids(apply(locked, [{kind: 'route-order', entity_ids: [c.id, b.id, a.id]}]).scenes[0].entities).filter(id => id !== pin.id), [c.id, b.id, a.id])
})

test('route-order refuses missing, extra, foreign, duplicate, non-array and foreign-operand routes atomically', () => {
  const journey = journeyWith(), [a, pin, b, c] = journey.scenes[0].entities, before = structuredClone(journey)
  const bad = [
    {kind: 'route-order', entity_ids: [a.id, b.id]},
    {kind: 'route-order', entity_ids: [a.id, b.id, c.id, pin.id]},
    {kind: 'route-order', entity_ids: [a.id, b.id, 'not-in-scene']},
    {kind: 'route-order', entity_ids: [a.id, a.id, c.id]},
    {kind: 'route-order', entity_ids: [a.id, b.id, c.id].slice(0, 2).concat([pin.id])},
    {kind: 'route-order', entity_ids: new Array(3)},
    {kind: 'route-order', entity_ids: [a.id, b.id, 7]},
    {kind: 'route-order', entity_ids: 'abc'},
    {kind: 'route-order', entity_ids: [c.id, b.id, a.id], scope: 'entity'},
    {kind: 'route-order', entity_ids: [c.id, b.id, a.id], entity_id: a.id},
    {kind: 'route-order'},
    {kind: 'route-order', entity_ids: []},
  ]
  for (const change of bad) assert.throws(() => apply(journey, [change]), /formation|focus route|foreign operands/, JSON.stringify(change))
  assert.throws(() => apply(journey, [panel('carryTint', false), {kind: 'route-order', entity_ids: [a.id, b.id]}]), /every formation/)
  assert.throws(() => apply(journey, [{kind: 'route-order', entity_ids: [c.id, b.id, a.id]}, {kind: 'route-order', entity_ids: [a.id, b.id, c.id]}]), /focus route twice/)
  assert.deepEqual(journey, before)
})

test('hostEditor admits the new kinds in the same device family as morph and colour settings', () => {
  const match = hostEditorSource.match(/const deviceKinds=new Set\(\[([^\]]*)\]\)/)
  assert.ok(match, 'the device kind admission list is present')
  const kinds = [...match[1].matchAll(/'([^']+)'/g)].map(item => item[1])
  for (const kind of ['morph-setting', 'colour-setting', 'panel-setting', 'route-order']) assert.ok(kinds.includes(kind), kind)
  assert.ok(!kinds.includes('field-font'), 'glyph family stays outside the device family')
})

test('depth share bounds are the inspector range calls, checked against the source text', async () => {
  // The model type carries no bounds, so the drift check is the inspector's own range() call (inspector.ts:123).
  const inspector = await readFile(new URL('inspector.ts', author), 'utf8')
  for (const [key, source] of Object.entries(SOURCE_NUMBER)) {
    const call = new RegExp(`range\\('${source.label}','engine\\.${key}',[^,]+,${source.min},${source.max},\\.01\\)`)
    assert.match(inspector, call, `inspector.ts range for ${key}`)
  }
})

test('depth shares accept the inclusive bounds and any finite value between, and reach the Scene and the engine config', () => {
  const base = journeyWith()
  for (const value of [0, 0.37, 1]) {
    const next = apply(base, [panel('vortex3d', value)])
    assert.equal(readField(next, 'vortex3d'), value)
    assert.equal(next.scenes[0].engine.vortex3d, value, 'written at engine.vortex3d')
    assert.equal(next.scenes[0].engine.dispersion3d, undefined, 'the other share stays absent, so the engine derives it')
  }
  // Not step-rounded: the inspector clamps to its range but does not round to .01 (app.ts applyBinding).
  assert.equal(readField(apply(base, [panel('dispersion3d', 0.333)]), 'dispersion3d'), 0.333)
  const explicit = apply(base, [panel('vortex3d', 0.35), panel('dispersion3d', 0.6)])
  const native = bridge.toNativeConfig(shared.effectiveScene(explicit, explicit.scenes[0]))
  assert.equal(native.fluid.vortex3d, 0.35)
  assert.equal(native.fluid.dispersion3d, 0.6)
})

test('a toggled-shared depth share writes the Expression bucket, not the Scene', () => {
  const toggled = journeyWith()
  toggled.scenes[0].engine.vortex3d = 0.5 // toggleShared needs a scalar to share
  shared.toggleShared(toggled, toggled.scenes[0], 'engine.vortex3d')
  const next = apply(toggled, [panel('vortex3d', 0.2)])
  assert.equal(next.shared.values['engine.vortex3d'], 0.2)
  assert.equal(toggled.scenes[0].engine.vortex3d, 0.5, 'the caller document is not mutated')
  assert.equal(next.scenes[0].engine.vortex3d, 0.5, 'the Scene keeps its own value while shared')
  assert.equal(readField(next, 'vortex3d'), 0.2)
})
