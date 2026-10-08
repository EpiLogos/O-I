import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {register} from 'node:module'

// Production sources through the same TypeScript loader as the sibling native tests.
// Fixtures are in-memory Journeys; the commit test reads the same owner receipt as native-device-widgets.test.mjs.
const root = new URL('../../../../', import.meta.url)
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
  if(url.endsWith('?raw'))return {format:'module',shortCircuit:true,source:'export default '+JSON.stringify(await readFile(new URL(url.split('?')[0]),'utf8'))};
  if(!url.endsWith('.ts')&&!url.endsWith('.tsx'))return next(url,context);
  return {format:'module',shortCircuit:true,source:ts.transpileModule(await readFile(new URL(url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX},fileName:new URL(url).pathname}).outputText};
}`)}`, import.meta.url)

const author = new URL('desktop/cradle/expressions-app/field-studies-journeys/src/', root)
const boundary = new URL('packages/expressions-boundary/src/', root)
const [devices, panels, settings, model, shared, targets, {kernelDocumentToJourney}, {prepareCompositionEdit}, {DocumentStore}, {createRetainedNativeEditor}] = await Promise.all([
  import(new URL('nativeDeviceEdits.ts', boundary)), import(new URL('nativeFieldPanelSettings.ts', boundary)), import(new URL('nativeEntitySettings.ts', boundary)),
  import(new URL('model.ts', author)), import(new URL('sharedSettings.ts', author)), import(new URL('nativeParameters.ts', author)),
  import(new URL('kernelDocumentBridge.ts', author)), import(new URL('kernelComposition.ts', author)), import(new URL('store.ts', author)),
  import(new URL('hostEditor.ts', author)),
])
const hostEditorSource = await readFile(new URL('hostEditor.ts', author), 'utf8')
const {FIELD_PANEL_SETTINGS} = panels
const {ENTITY_SETTING_EXEMPT_FROM_LOCK, ENTITY_SETTING_NAME_LIMIT} = settings

const [formationA, formationB, formationC] = model.chakraEntities()
const pin = model.pin({x: 0, y: 0, z: 0})
const enc = id => encodeURIComponent(id)
const targetOf = (id, suffix) => 'entity:' + enc(id) + ':' + suffix
const get = (root, path) => path.split('.').reduce((value, key) => value[key], root)
const journeyWith = (entities = [formationA, pin, formationB, formationC]) => {
  const journey = model.blankJourney()
  journey.scenes[0].entities = structuredClone(entities)
  return journey
}
const journeyWithShares = () => {
  const entities = structuredClone([formationA, pin, formationB, formationC])
  entities[0].share = 4
  entities[2].share = 2.5
  entities[3].share = 0.75
  return journeyWith(entities)
}
const apply = (journey, changes) => devices.applyNativeDeviceChanges(journey, journey.scenes[0].id, changes)
const setting = (entity_id, key, value) => ({kind: 'entity-setting', entity_id, key, value})
const panel = (key, value) => ({kind: 'panel-setting', key, value})
const entityOf = (journey, id) => journey.scenes[0].entities.find(entity => entity.id === id)
const shares = journey => journey.scenes[0].entities.map(entity => [entity.id, entity.share])

test('the four formation fields are entity targets with the inspector bounds, steps and units', () => {
  const scene = journeyWith().scenes[0], all = targets.entityTargets(scene)
  const expected = {
    'size.x': {min: 0.001, max: 100, hardMin: 0.001, hardMax: 100, step: 0.01, unit: 'stage units'},
    'size.y': {min: 0.001, max: 100, hardMin: 0.001, hardMax: 100, step: 0.01, unit: 'stage units'},
    rotation: {min: -180, max: 180, hardMin: -36000, hardMax: 36000, step: 1, unit: 'degrees'},
    share: {min: 0, max: 10, hardMin: 0, hardMax: 1000, step: 0.1, unit: 'relative weight'},
  }
  for (const formation of [formationA, formationB, formationC]) for (const [suffix, spec] of Object.entries(expected)) {
    const row = all.find(item => item.target === targetOf(formation.id, suffix))
    assert.ok(row, `${formation.name} ${suffix} is an entity target`)
    assert.equal(row.bind, 'entity.' + suffix)
    assert.equal(row.entityId, formation.id)
    assert.equal(row.factor, 1)
    for (const [key, value] of Object.entries(spec)) assert.equal(row[key], value, `${suffix} ${key}`)
    assert.equal(row.value, get(formation, suffix), `${suffix} reads the entity field`)
  }
  assert.deepEqual(all.filter(item => item.entityId === pin.id && /:(size\.[xy]|rotation|share)$/.test(item.target)), [], 'pins own no size, rotation or share')
})

test('each formation field round-trips through the parameter reducer and refuses values outside its hard bounds', () => {
  const admitted = {'size.x': [0.001, 0.37, 100], 'size.y': [0.001, 2.5, 100], rotation: [-36000, -180, 45, 36000], share: [0, 0.37, 1000]}
  const refused = {'size.x': [0, -1, 100.5, NaN, Infinity], 'size.y': [0, 100.001], rotation: [-36000.5, 36001], share: [-0.01, 1000.5]}
  for (const [suffix, values] of Object.entries(admitted)) {
    const journey = journeyWith(), before = structuredClone(journey), target = targetOf(formationA.id, suffix)
    for (const value of values) {
      const next = apply(journey, [{kind: 'parameter', target, value}])
      assert.equal(get(entityOf(next, formationA.id), suffix), value, `${suffix}=${value}`)
      assert.equal(targets.entityTargets(next.scenes[0]).find(item => item.target === target).value, value, `${suffix}=${value} reads back`)
      assert.equal(entityOf(next, formationB.id).size.x, formationB.size.x, 'other formations are untouched')
      assert.deepEqual(journey, before, `${suffix} must not mutate the caller document`)
    }
    for (const value of refused[suffix]) assert.throws(() => apply(journey, [{kind: 'parameter', target, value}]), /must be between|finite/, `${suffix}=${value}`)
  }
})

test('a locked formation refuses its size, rotation and share, and a pin has no such binding', () => {
  const journey = journeyWith()
  entityOf(journey, formationA.id).locked = true
  for (const suffix of ['size.x', 'size.y', 'rotation', 'share'])
    assert.throws(() => apply(journey, [{kind: 'parameter', target: targetOf(formationA.id, suffix), value: get(formationA, suffix)}]), /Unlock this entity/, suffix)
  assert.throws(() => apply(journey, [{kind: 'parameter', target: targetOf(pin.id, 'share'), value: 1}]), /no admitted native device binding/)
})

test('name, locked and enabled admit only their exact key and value type', () => {
  const journey = journeyWith(), id = formationB.id, original = structuredClone(journey)
  assert.equal(entityOf(apply(journey, [setting(id, 'name', '  Crown  ')]), id).name, 'Crown', 'name is stored trimmed')
  assert.equal(entityOf(apply(journey, [setting(id, 'name', 'x'.repeat(ENTITY_SETTING_NAME_LIMIT))]), id).name.length, ENTITY_SETTING_NAME_LIMIT)
  assert.equal(entityOf(apply(journey, [setting(id, 'locked', true)]), id).locked, true)
  assert.equal(entityOf(apply(journey, [setting(id, 'enabled', false)]), id).enabled, false)
  assert.equal(entityOf(apply(apply(journey, [setting(id, 'locked', true)]), [setting(id, 'locked', false)]), id).locked, false)
  assert.deepEqual(journey, original, 'the caller document is never mutated')
  for (const value of ['', '   ', 'x'.repeat(ENTITY_SETTING_NAME_LIMIT + 1), 1, null, undefined, true, ['Crown']])
    assert.throws(() => apply(journey, [setting(id, 'name', value)]), /admitted native object setting/, `name=${String(value)}`)
  for (const key of ['locked', 'enabled']) for (const value of ['true', 1, 0, null, undefined, 'off'])
    assert.throws(() => apply(journey, [setting(id, key, value)]), /admitted native object setting/, `${key}=${String(value)}`)
  for (const key of ['share', 'position', 'shape', 'text', 'tint', 'force', 'size', 'rotation', '', 'Name', '__proto__', 'constructor'])
    assert.throws(() => apply(journey, [setting(id, key, 'x')]), /admitted native object setting/, key)
  assert.deepEqual(ENTITY_SETTING_EXEMPT_FROM_LOCK, ['locked'])
})

test('entity-setting refuses foreign operands, a missing or unknown entity, and a repeated key without mutating the caller', () => {
  const journey = journeyWith(), before = structuredClone(journey), id = formationB.id
  for (const extra of [{scope: 'entity'}, {share: 2}, {position: {x: 1, y: 0, z: 0}}, {entity_ids: [id]}])
    assert.throws(() => apply(journey, [{...setting(id, 'name', 'X'), ...extra}]), /belongs only to its own object|foreign operands/, JSON.stringify(extra))
  assert.throws(() => apply(journey, [setting('nope', 'name', 'X')]), /no longer belongs to this Scene/)
  assert.throws(() => apply(journey, [{kind: 'entity-setting', key: 'name', value: 'X'}]), /admitted native object setting/)
  assert.throws(() => apply(journey, [setting(id, 'name', 'A'), setting(id, 'name', 'B')]), /same object setting twice/)
  assert.throws(() => apply(journey, [setting(id, 'name', 'A'), setting(formationC.id, 'name', 'B'), setting(id, 'enabled', 'nope')]), /admitted native object setting/)
  assert.deepEqual(journey, before, 'a refused batch leaves the caller document untouched')
})

test('a locked object accepts only its own lock change; name and enabled refuse like the app inspector', () => {
  const locked = apply(journeyWith(), [setting(formationB.id, 'locked', true)])
  assert.throws(() => apply(locked, [setting(formationB.id, 'name', 'Renamed')]), /Unlock this entity/)
  assert.throws(() => apply(locked, [setting(formationB.id, 'enabled', false)]), /Unlock this entity/)
  assert.equal(entityOf(apply(locked, [setting(formationB.id, 'locked', false)]), formationB.id).locked, false)
  // One ordered gesture: unlock, then rename, is admitted because the second edit reads the unlocked entity.
  const renamed = apply(locked, [setting(formationB.id, 'locked', false), setting(formationB.id, 'name', 'Renamed')])
  assert.equal(entityOf(renamed, formationB.id).name, 'Renamed')
  assert.equal(entityOf(renamed, formationB.id).locked, false)
})

test('disabling an entity leaves every share value unchanged; the engine normalises over enabled formations', () => {
  const journey = journeyWithShares(), before = shares(journey)
  const disabled = apply(journey, [setting(formationB.id, 'enabled', false)])
  assert.equal(entityOf(disabled, formationB.id).enabled, false)
  assert.deepEqual(shares(disabled), before, 'share values are not rewritten by the enabled toggle')
  const reenabled = apply(disabled, [setting(formationB.id, 'enabled', true)])
  assert.deepEqual(shares(reenabled), before, 're-enabling leaves share values unchanged too')
})

test('composition.plane and engine.autoFitSizes are admitted rows that validate and read back at their Scene paths', () => {
  assert.equal(FIELD_PANEL_SETTINGS.plane.target, 'composition')
  assert.deepEqual([...FIELD_PANEL_SETTINGS.plane.options], ['XY', 'XZ', 'YZ'])
  assert.equal(FIELD_PANEL_SETTINGS.autoFitSizes.target, 'engine')
  assert.equal(FIELD_PANEL_SETTINGS.autoFitSizes.type, 'boolean')
  const journey = journeyWith()
  for (const plane of ['XY', 'XZ', 'YZ']) assert.equal(apply(journey, [panel('plane', plane)]).scenes[0].composition.plane, plane)
  for (const value of ['xy', 'XZ ', 'ZX', '', 'Plane', null, 1]) assert.throws(() => apply(journey, [panel('plane', value)]), /admitted native Field panel setting/, `plane=${String(value)}`)
  for (const value of [true, false]) assert.equal(apply(journey, [panel('autoFitSizes', value)]).scenes[0].engine.autoFitSizes, value)
  for (const value of ['on', 1, null, undefined]) assert.throws(() => apply(journey, [panel('autoFitSizes', value)]), /admitted native Field panel setting/, `autoFitSizes=${String(value)}`)
})

test('the host admits entity-setting into the device family', () => {
  assert.match(hostEditorSource, /deviceKinds=new Set\(\[[^\]]*'entity-setting'/)
})

test('a retained-editor gesture commits through prepareCompositionEdit with the new object and panel values', async () => {
  const receiptPath = process.env.OI_NATIVE_COMPOSITION_RECEIPT ?? '/Users/admin/Central/Work/reverse-engineering/2026-10-07-techne-instrument-re/new-shell/evidence/native/material-verification-c79dab7c-8de3-4b69-87cb-ee11cce28c9f/rich-artifact-inspection-3a33a7f6-94e9-445d-b2ec-7e7f25950935.json'
  const nativeDocument = JSON.parse(await readFile(receiptPath, 'utf8')).after.document
  const view = kernelDocumentToJourney(nativeDocument)
  const store = new DocumentStore(view.journey)
  const scene = store.document.scenes.find(item => item.id === view.startSceneId) ?? store.document.scenes[0]
  const formation = scene.entities.find(entity => entity.kind === 'formation' && !entity.locked)
  assert.ok(formation, 'the receipt has an unlocked formation')
  const originalShare = formation.share
  const owner = createRetainedNativeEditor({store, sceneId: () => scene.id, selection: () => ({entity_ids: [], step_id: null}), nativeView: () => view,
    nativeSelect: () => {throw Error('closed')}, commit: async () => true, change: mutate => store.change(mutate), afterHistory: () => {throw Error('closed')},
    selectLocal: () => {throw Error('closed')}, openEditor: () => {throw Error('closed')}, standing: () => ({busy: false, notice: null}), telemetry: () => undefined, fieldPaused: () => false})
  await owner.apply({operation: 'apply', basis: owner.read().basis, changes: [
    setting(formation.id, 'name', 'Renamed centre'),
    {kind: 'parameter', target: targetOf(formation.id, 'size.x'), value: 0.5},
    {kind: 'parameter', target: targetOf(formation.id, 'rotation'), value: 30},
    setting(formation.id, 'enabled', false),
    panel('plane', 'XZ'),
    panel('autoFitSizes', false),
  ]})
  const request = prepareCompositionEdit(view, store.document, {sceneId: scene.id})
  const material = request.changes.find(change => change.change === 'scene_material_set' && change.scene_ref === view.bindings[scene.id]?.scene_ref)
  assert.ok(material, 'the edited Scene is one scene_material_set')
  const committed = material.presentation.scene
  const row = committed.entities.find(entity => entity.id === formation.id)
  assert.equal(row.name, 'Renamed centre')
  assert.equal(row.size.x, 0.5)
  assert.equal(row.rotation, 30)
  assert.equal(row.enabled, false)
  assert.equal(row.share, originalShare, 'share is committed unchanged')
  assert.equal(committed.composition.plane, 'XZ')
  assert.equal(committed.engine.autoFitSizes, false)
})
