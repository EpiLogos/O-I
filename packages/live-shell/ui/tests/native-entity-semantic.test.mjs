/** Entity Meaning (semantic binding): the boundary validators, the app's own validator (drift), the reducer, the host route and the composition request that carries the meaning to scene_material_set. */
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {register} from 'node:module'

// The fixture is the archived native Expression the sound tests read; the app validator (model.ts) and the kernel scene keys are read, not copied.
const root = new URL('../../../../', import.meta.url)
const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
const parameters = new URL('packages/expressions-boundary/src/parameters.ts', root).href
register(`data:text/javascript,${encodeURIComponent(`import ts from ${JSON.stringify(compiler)};import {readFile} from 'node:fs/promises';export async function resolve(s,c,n){if(s==='@epilogos/expressions-boundary/parameters')return n(${JSON.stringify(parameters)},c);try{return await n(s,c)}catch(e){if(!s.startsWith('.'))throw e;if(s.endsWith('.js')){try{return await n(s.slice(0,-3)+'.ts',c)}catch{}}for(const x of ['.ts','.tsx']){try{return await n(s+x,c)}catch{}}throw e}}export async function load(u,c,n){if(u.endsWith('.css'))return {format:'module',shortCircuit:true,source:'export {}'};if(!u.endsWith('.ts')&&!u.endsWith('.tsx'))return n(u,c);return {format:'module',shortCircuit:true,source:ts.transpileModule(await readFile(new URL(u),'utf8'),{fileName:new URL(u).pathname,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText}}`)}`, import.meta.url)
const author = new URL('desktop/cradle/expressions-app/field-studies-journeys/src/', root)
const receiptPath = '/Users/admin/Central/Work/reverse-engineering/2026-10-07-techne-instrument-re/new-shell/evidence/native/material-verification-c79dab7c-8de3-4b69-87cb-ee11cce28c9f/rich-artifact-inspection-3a33a7f6-94e9-445d-b2ec-7e7f25950935.json'
const [devices, meaning, {kernelDocumentToJourney}, {DocumentStore}, {createRetainedNativeEditor}, {prepareCompositionEdit}, model, kernelSource, appSource, archivedText] = await Promise.all([
  import(new URL('packages/expressions-boundary/src/nativeDeviceEdits.ts', root)),
  import(new URL('packages/expressions-boundary/src/nativeEntitySemantic.ts', root)),
  import(new URL('kernelDocumentBridge.ts', author)),
  import(new URL('store.ts', author)),
  import(new URL('hostEditor.ts', author)),
  import(new URL('kernelComposition.ts', author)),
  import(new URL('model.ts', author)),
  readFile(new URL('desktop/cradle/kernel/src/expression_scene.rs', root), 'utf8'),
  readFile(new URL('desktop/cradle/expressions-app/field-studies-journeys/src/app.ts', root), 'utf8'),
  readFile(receiptPath, 'utf8'),
])
const {validateJourney, blankJourney, entity: makeEntity, clone} = model
const archived = JSON.parse(archivedText)
const closed = () => { throw Error('Native effects are closed in Meaning verification') }
const SCENE_FIELD = {enabled: true, profile: {kind: 'chakra', profileId: 'chakra-seven-v1'}, affinity: {method: 'modalProjection', bandwidth: 0.14}, globalColorGain: 1, bindings: []}
const COLOUR = {enabled: true, colorSource: 'canonical', gain: 1, radius: {source: 'force'}, falloff: 'gaussian', metric: 'compositionPlane', blend: 'weighted', activation: 'constant'}
/** A whole meaning for one object: the Heart centre, canonical colour following the force radius, no mappings. */
const meaningOf = (entityId, over = {}) => ({id: 'semantic-a', semanticNodeId: 'anahata', enabled: true, resonance: {gain: 1}, carriers: [{kind: 'entity', id: entityId}], color: {...COLOUR}, modulations: [], ...over})
const withColourOf = (binding, over) => ({...binding, color: {...binding.color, ...over}})
const boundaryAccepts = (semantic, entityId = 'entity-a') => { try { meaning.validateNativeEntitySemanticChange({kind: 'entity-semantic', entity_id: entityId, semantic}); return true } catch { return false } }
/** The app's own validator over a Journey whose one object carries this binding. */
function appAccepts(binding) {
  const j = blankJourney(), e = makeEntity('Centre', 'A', {x: 0, y: 0, z: 0})
  e.id = 'entity-a'; j.scenes[0].entities = [e]
  j.scenes[0].semanticField = {...clone(SCENE_FIELD), bindings: [binding]}
  try { validateJourney(j); return true } catch { return false }
}
/** A private working copy of the archived native Expression; the baseline view is untouched. */
function source() {
  const view = kernelDocumentToJourney(archived.after.document), store = new DocumentStore(structuredClone(view.journey))
  const scene = store.document.scenes.find(s => s.id === view.startSceneId), entity = scene.entities[0]
  return {view, store, scene, entity}
}
function host(r, {commit = async () => true, change = fn => fn()} = {}) {
  return createRetainedNativeEditor({store: r.store, sceneId: () => r.view.startSceneId, selection: () => ({entity_ids: [r.entity.id], step_id: null}), nativeView: () => r.view,
    nativeSelect: closed, commit, change, afterHistory: closed, selectLocal: closed, openEditor: closed, standing: () => ({busy: false, notice: null}), telemetry: () => undefined, fieldPaused: () => false})
}
const entityIn = (journey, id) => journey.scenes.flatMap(s => s.entities).find(e => e.id === id)
const sceneIn = (journey, id) => journey.scenes.find(s => s.id === id)
const applyOne = (r, change, doc = r.store.document) => devices.applyNativeDeviceChanges(doc, r.view.startSceneId, [change])
const setMeaning = (r, semantic, id = r.entity.id, doc = r.store.document) => applyOne(r, {kind: 'entity-semantic', entity_id: id, semantic}, doc)

test('every select admits exactly the disclosed option values and refuses any other value', () => {
  for (const node of ['muladhara', 'svadhisthana', 'manipura', 'anahata', 'vishuddha', 'ajna', 'sahasrara'])
    assert.equal(boundaryAccepts(meaningOf('entity-a', {semanticNodeId: node})), true, node)
  for (const node of ['none', 'chakra-x', 'Anahata', '', null]) assert.equal(boundaryAccepts(meaningOf('entity-a', {semanticNodeId: node})), false, String(node))
  for (const colorSource of ['canonical', 'entityTint', 'override']) assert.equal(boundaryAccepts(meaningOf('entity-a', {color: {...COLOUR, colorSource}})), true)
  assert.equal(boundaryAccepts(meaningOf('entity-a', {color: {...COLOUR, colorSource: 'tint'}})), false)
  for (const activation of ['constant', 'resonanceAffinity', 'focus']) assert.equal(boundaryAccepts(meaningOf('entity-a', {color: {...COLOUR, activation}})), true)
  assert.equal(boundaryAccepts(meaningOf('entity-a', {color: {...COLOUR, activation: 'carrierSpeed'}})), false)
  for (const source of ['force', 'independent']) assert.equal(boundaryAccepts(meaningOf('entity-a', {color: {...COLOUR, radius: {source}}})), true)
  assert.equal(boundaryAccepts(meaningOf('entity-a', {color: {...COLOUR, radius: {source: 'fixed'}}})), false)
  for (const falloff of ['gaussian', 'compact']) assert.equal(boundaryAccepts(meaningOf('entity-a', {color: {...COLOUR, falloff}})), true)
  assert.equal(boundaryAccepts(meaningOf('entity-a', {color: {...COLOUR, falloff: 'linear'}})), false)
  for (const metric of ['compositionPlane', 'world3d']) assert.equal(boundaryAccepts(meaningOf('entity-a', {color: {...COLOUR, metric}})), true)
  assert.equal(boundaryAccepts(meaningOf('entity-a', {color: {...COLOUR, metric: 'XZ'}})), false)
  for (const blend of ['weighted', 'additive']) assert.equal(boundaryAccepts(meaningOf('entity-a', {color: {...COLOUR, blend}})), true)
  assert.equal(boundaryAccepts(meaningOf('entity-a', {color: {...COLOUR, blend: 'max'}})), false)
  for (const signal of ['resonanceAffinity', 'focus', 'carrierSpeed', 'forceStrength', 'forceSpin'])
    for (const target of ['color.gain', 'color.radius', 'color.hueShift'])
      assert.equal(boundaryAccepts(meaningOf('entity-a', {modulations: [{source: {kind: signal}, target, amount: 1, offset: 0}]})), true, signal + ' ' + target)
  assert.equal(boundaryAccepts(meaningOf('entity-a', {modulations: [{source: {kind: 'color'}, target: 'color.gain', amount: 1}]})), false)
  assert.equal(boundaryAccepts(meaningOf('entity-a', {modulations: [{source: {kind: 'focus'}, target: 'opacity', amount: 1}]})), false)
})

test('ranges are inclusive at the validator edges and refuse one step outside, through the boundary change', () => {
  const edges = [
    [v => withColourOf(meaningOf('entity-a'), {gain: v}), 0, 100],
    [v => meaningOf('entity-a', {resonance: {gain: v}}), -100, 100],
    [v => withColourOf(meaningOf('entity-a'), {radius: {source: 'independent', value: v}}), 0.001, 100000],
    [v => meaningOf('entity-a', {modulations: [{source: {kind: 'focus'}, target: 'color.gain', amount: v}]}), -10000, 10000],
    [v => meaningOf('entity-a', {modulations: [{source: {kind: 'focus'}, target: 'color.gain', amount: 1, offset: v}]}), -10000, 10000],
  ]
  for (const [build, low, high] of edges) {
    assert.equal(boundaryAccepts(build(low)), true, `low ${low}`)
    assert.equal(boundaryAccepts(build(high)), true, `high ${high}`)
    for (const bad of [low - 0.001, high + 0.001, Number.NaN, Number.POSITIVE_INFINITY, '5', null]) assert.equal(boundaryAccepts(build(bad)), false, `${bad}`)
  }
  assert.equal(boundaryAccepts(withColourOf(meaningOf('entity-a'), {radius: {source: 'independent', value: 0}})), false)
  assert.equal(boundaryAccepts(meaningOf('entity-a', {modulations: Array.from({length: 17}, () => ({source: {kind: 'focus'}, target: 'color.gain', amount: 1}))})), false)
  assert.equal(boundaryAccepts(meaningOf('entity-a', {modulations: Array.from({length: 16}, () => ({source: {kind: 'focus'}, target: 'color.gain', amount: 1}))})), true)
  assert.equal(boundaryAccepts(withColourOf(meaningOf('entity-a'), {overrideColor: '#abc'})), false)
  assert.equal(boundaryAccepts(withColourOf(meaningOf('entity-a'), {overrideColor: '#aabbcc'})), true)
  assert.equal(boundaryAccepts(meaningOf('entity-a', {resonance: {gain: 1, anchorId: 'x'.repeat(161)}})), false)
  assert.equal(boundaryAccepts(meaningOf('entity-a', {id: 'bad id'})), false)
  assert.equal(boundaryAccepts(meaningOf('entity-a', {modulations: [{source: {kind: 'focus'}, target: 'color.gain', amount: 1, clamp: [0]}]})), false)
  assert.equal(boundaryAccepts(meaningOf('entity-a', {modulations: [{source: {kind: 'focus'}, target: 'color.gain', amount: 1, clamp: [0, 2]}]})), true)
})

test('the boundary admits exactly what the app validator admits, for every edge above (drift against model.ts validateJourney)', () => {
  const cases = [
    b => withColourOf(b, {gain: 0}), b => withColourOf(b, {gain: 100}), b => withColourOf(b, {gain: 100.001}),
    b => ({...b, resonance: {gain: -100}}), b => ({...b, resonance: {gain: 100}}), b => ({...b, resonance: {gain: 100.5}}),
    b => withColourOf(b, {radius: {source: 'independent', value: 0.001}}), b => withColourOf(b, {radius: {source: 'independent', value: 100000}}),
    b => withColourOf(b, {radius: {source: 'independent', value: 0}}), b => withColourOf(b, {radius: {source: 'independent', value: 100001}}),
    b => ({...b, modulations: [{source: {kind: 'forceSpin'}, target: 'color.hueShift', amount: -10000, offset: 10000, clamp: [-1e9, 1e9]}]}),
    b => ({...b, modulations: [{source: {kind: 'forceSpin'}, target: 'color.hueShift', amount: 10001}]}),
    b => withColourOf(b, {overrideColor: '#abcdef'}), b => withColourOf(b, {overrideColor: 'red'}),
    b => ({...b, color: undefined}), b => ({...b, resonance: undefined, modulations: undefined}),
  ]
  for (const [index, build] of cases.entries()) {
    const binding = build(meaningOf('entity-a'))
    assert.equal(boundaryAccepts(binding), appAccepts(binding), `case ${index}: boundary and app validator must agree`)
  }
  // Intentional narrowing: the app validator takes any safe node id; this boundary takes only the seven centres the Meaning select offers.
  assert.equal(appAccepts(meaningOf('entity-a', {semanticNodeId: 'chakra-x'})), true)
  assert.equal(boundaryAccepts(meaningOf('entity-a', {semanticNodeId: 'chakra-x'})), false)
  for (const node of meaning.MEANING_NODE_IDS) assert.equal(appAccepts(meaningOf('entity-a', {semanticNodeId: node})), true, node)
  assert.deepEqual(meaning.MEANING_NODE_IDS, ['muladhara', 'svadhisthana', 'manipura', 'anahata', 'vishuddha', 'ajna', 'sahasrara'])
})

test('the app defaults the reducer mirrors are the app source text (ensureSemanticField, defaultSemanticColor)', () => {
  const compact = appSource.replace(/\s+/g, '')
  assert.ok(compact.includes(`{enabled:true,profile:{kind:'chakra',profileId:CHAKRA_PROFILE_ID},affinity:{method:'modalProjection',bandwidth:.14},globalColorGain:1,bindings:[]}`), 'ensureSemanticField')
  assert.ok(compact.includes(`{enabled:true,colorSource:'canonical',gain:1,radius:{source:'force'},falloff:'gaussian',metric:'compositionPlane',blend:'weighted',activation:'constant'}`), 'defaultSemanticColor')
  assert.deepEqual(meaning.defaultSemanticField(), SCENE_FIELD)
  assert.deepEqual(meaning.defaultSemanticColor(), COLOUR)
})

test('foreign operands are refused: another object carrier, a force-emitter carrier, extra keys, a missing whole meaning, and an empty entity', () => {
  const ok = meaningOf('entity-a')
  assert.throws(() => meaning.validateNativeEntitySemanticChange({kind: 'entity-semantic', entity_id: 'entity-a', semantic: meaningOf('entity-b')}), /belongs to its own object only/)
  assert.throws(() => meaning.validateNativeEntitySemanticChange({kind: 'entity-semantic', entity_id: 'entity-a', semantic: {...ok, carriers: [{kind: 'forceEmitter', id: 'entity:entity-a'}]}}), /own object only/)
  assert.throws(() => meaning.validateNativeEntitySemanticChange({kind: 'entity-semantic', entity_id: 'entity-a', semantic: {...ok, carriers: [...ok.carriers, {kind: 'entity', id: 'entity-b'}]}}), /own object only/)
  assert.throws(() => meaning.validateNativeEntitySemanticChange({kind: 'entity-semantic', entity_id: 'entity-a', semantic: {...ok, scope: 'entity'}}), /foreign operands/)
  assert.throws(() => meaning.validateNativeEntitySemanticChange({kind: 'entity-semantic', entity_id: 'entity-a', semantic: {...ok, color: {...COLOUR, muted: true}}}), /foreign operands/)
  assert.throws(() => meaning.validateNativeEntitySemanticChange({kind: 'entity-semantic', entity_id: 'entity-a', semantic: {...ok, color: {...COLOUR, radius: {source: 'force', extra: 1}}}}), /own fields|Choose a colour radius/)
  assert.throws(() => meaning.validateNativeEntitySemanticChange({kind: 'entity-semantic', entity_id: 'entity-a'}), /whole meaning, or null/)
  assert.throws(() => meaning.validateNativeEntitySemanticChange({kind: 'entity-semantic', entity_id: 'entity-a', semantic: undefined}), /whole meaning, or null/)
  assert.throws(() => meaning.validateNativeEntitySemanticChange({kind: 'entity-semantic', entity_id: '', semantic: null}), /Choose the object/)
  assert.throws(() => meaning.validateNativeEntitySemanticChange({kind: 'entity-semantic', entity_id: 7, semantic: null}), /Choose the object/)
  assert.throws(() => meaning.validateNativeEntitySemanticChange({kind: 'entity-semantic', entity_id: 'entity-a', semantic: ok, muted: true}), /foreign operands/)
  assert.throws(() => meaning.validateNativeEntitySemanticChange({kind: 'entity-semantic-mute', entity_id: 'entity-a', semantic: null}), /admitted object meaning/)
  const admitted = meaning.validateNativeEntitySemanticChange({kind: 'entity-semantic', entity_id: 'entity-a', semantic: ok})
  assert.deepEqual(admitted.semantic, ok); assert.notEqual(admitted.semantic, ok, 'the admitted change is a fresh copy')
  assert.deepEqual(meaning.validateNativeEntitySemanticChange({kind: 'entity-semantic', entity_id: 'entity-a', semantic: null}), {kind: 'entity-semantic', entity_id: 'entity-a', semantic: null})
})

test('the Scene field changes: enable is a boolean, the global gain is 0 to 100, and any other key or foreign operand is refused', () => {
  assert.deepEqual(meaning.validateNativeSemanticFieldChange({kind: 'semantic-field-setting', key: 'enabled', value: false}), {kind: 'semantic-field-setting', key: 'enabled', value: false})
  assert.deepEqual(meaning.validateNativeSemanticFieldChange({kind: 'semantic-field-setting', key: 'globalColorGain', value: 100}), {kind: 'semantic-field-setting', key: 'globalColorGain', value: 100})
  for (const value of [-0.001, 100.001, Number.NaN, '1', null]) assert.throws(() => meaning.validateNativeSemanticFieldChange({kind: 'semantic-field-setting', key: 'globalColorGain', value}), /from 0 to 100/)
  assert.throws(() => meaning.validateNativeSemanticFieldChange({kind: 'semantic-field-setting', key: 'enabled', value: 'yes'}), /true or false/)
  assert.throws(() => meaning.validateNativeSemanticFieldChange({kind: 'semantic-field-setting', key: 'profileId', value: 'x'}), /admitted semantic field setting/)
  assert.throws(() => meaning.validateNativeSemanticFieldChange({kind: 'semantic-field-setting', key: 'enabled', value: true, entity_id: 'entity-a'}), /foreign operands/)
})

test('the reducer writes the whole meaning and carries the Scene field: a new meaning switches the layer on, a removed last meaning switches it off', () => {
  const r = source(), id = r.entity.id, before = structuredClone(r.store.document)
  const changed = setMeaning(r, meaningOf(id))
  assert.deepEqual(r.store.document, before, 'the caller document is untouched')
  const field = sceneIn(changed, r.view.startSceneId).semanticField
  assert.equal(field.enabled, true); assert.equal(field.bindings.length, 1)
  assert.deepEqual(field.bindings[0], meaningOf(id), 'the readback is the whole binding')
  assert.deepEqual(entityIn(changed, id), entityIn(before, id), 'the object itself is not rewritten')
  // The Scene field can be switched off; a colour edit to the same centre keeps it off (the enable flag is the Scene's, not the object's).
  const off = applyOne(r, {kind: 'semantic-field-setting', key: 'enabled', value: false}, changed)
  assert.equal(sceneIn(off, r.view.startSceneId).semanticField.enabled, false)
  const coloured = setMeaning(r, withColourOf(meaningOf(id), {gain: 2}), id, off)
  assert.equal(sceneIn(coloured, r.view.startSceneId).semanticField.enabled, false, 'a colour edit does not switch the layer on')
  // Changing the centre switches it on, as the inspector's Meaning select does (assignSemanticNode).
  const moved = setMeaning(r, meaningOf(id, {semanticNodeId: 'ajna'}), id, off)
  assert.equal(sceneIn(moved, r.view.startSceneId).semanticField.enabled, true)
  // Removing the last meaning writes null: the binding goes, and the empty field switches off.
  const removed = setMeaning(r, null, id, changed)
  assert.equal(sceneIn(removed, r.view.startSceneId).semanticField.bindings.length, 0)
  assert.equal(sceneIn(removed, r.view.startSceneId).semanticField.enabled, false)
  // A removal with no field present is a no-op, not a created field.
  const none = setMeaning(r, null, id)
  assert.equal(sceneIn(none, r.view.startSceneId).semanticField, undefined)
})

test('a second meaning for the same object replaces the first and keeps other objects bindings', () => {
  const r = source(), id = r.entity.id
  const scene = r.store.document.scenes.find(s => s.id === r.view.startSceneId)
  const extra = makeEntity('Second', 'B', {x: 1, y: 0, z: 0}); scene.entities.push(extra)
  const other = extra
  const first = setMeaning(r, meaningOf(id))
  const second = devices.applyNativeDeviceChanges(first, r.view.startSceneId, [
    {kind: 'entity-semantic', entity_id: id, semantic: meaningOf(id, {id: 'semantic-b', semanticNodeId: 'ajna'})},
  ])
  const bindings = sceneIn(second, r.view.startSceneId).semanticField.bindings
  assert.equal(bindings.length, 1); assert.equal(bindings[0].id, 'semantic-b')
  // A second object with its own identity keeps the first object's binding.
  const withOther = devices.applyNativeDeviceChanges(second, r.view.startSceneId, [{kind: 'entity-semantic', entity_id: other.id, semantic: meaningOf(other.id, {id: 'semantic-c'})}])
  assert.deepEqual(sceneIn(withOther, r.view.startSceneId).semanticField.bindings.map(b => b.id).sort(), ['semantic-b', 'semantic-c'])
  assert.throws(() => devices.applyNativeDeviceChanges(second, r.view.startSceneId, [{kind: 'entity-semantic', entity_id: other.id, semantic: meaningOf(other.id, {id: 'semantic-b'})}]), /belongs to another object/)
})

test('lock and batch law: a locked object refuses its meaning, a field setting needs a field, a second write in one gesture is refused, and a bad second change keeps the first out', () => {
  const r = source(), id = r.entity.id, before = structuredClone(r.store.document)
  const locked = structuredClone(r.store.document); entityIn(locked, id).locked = true
  assert.throws(() => setMeaning(r, meaningOf(id), id, locked), /Unlock this entity before editing its device/)
  assert.throws(() => applyOne(r, {kind: 'semantic-field-setting', key: 'enabled', value: true}, before), /no semantic field yet/)
  assert.throws(() => devices.applyNativeDeviceChanges(before, r.view.startSceneId, [{kind: 'entity-semantic', entity_id: id, semantic: meaningOf(id)}, {kind: 'entity-semantic', entity_id: id, semantic: null}]), /same object meaning twice/)
  assert.throws(() => devices.applyNativeDeviceChanges(before, r.view.startSceneId, [{kind: 'entity-semantic', entity_id: id, semantic: meaningOf(id)}, {kind: 'entity-semantic', entity_id: id, semantic: meaningOf(id, {enabled: 'yes'})}]), /enabled flag must be true or false/)
  assert.throws(() => setMeaning(r, meaningOf('entity:missing'), 'entity:missing'), /no longer belongs to this Scene/)
  assert.deepEqual(r.store.document, before)
})

test('the retained host admits the meaning kind through the device batch and commits one transaction, with the readback from the reading', async () => {
  const r = source(), id = r.entity.id
  let commits = 0, changes = 0
  const owner = host(r, {commit: async () => { commits++; return true }, change: fn => { changes++; fn() }})
  await owner.apply({operation: 'apply', basis: owner.read().basis, changes: [{kind: 'entity-semantic', entity_id: id, semantic: meaningOf(id)}]})
  assert.equal(commits, 1); assert.equal(changes, 1)
  assert.deepEqual(owner.read().scene.semanticField.bindings, [meaningOf(id)], 'the reading shows the stored meaning')
  await owner.apply({operation: 'apply', basis: owner.read().basis, changes: [{kind: 'semantic-field-setting', key: 'globalColorGain', value: 42}]})
  assert.equal(owner.read().scene.semanticField.globalColorGain, 42)
  assert.equal(commits, 2)
  await owner.apply({operation: 'apply', basis: owner.read().basis, changes: [{kind: 'entity-semantic', entity_id: id, semantic: null}]})
  assert.equal(owner.read().scene.semanticField.bindings.length, 0)
  assert.equal(commits, 3)
})

test('the host refuses a locked object and a foreign operand with the document and the commit untouched', async () => {
  const r = source(), id = r.entity.id
  let commits = 0
  const owner = host(r, {commit: async () => { commits++; return true }})
  const before = structuredClone(r.store.document)
  entityIn(r.store.document, id).locked = true
  const locked = structuredClone(r.store.document)
  entityIn(r.store.document, id).locked = false
  r.store.document = locked
  await assert.rejects(owner.apply({operation: 'apply', basis: owner.read().basis, changes: [{kind: 'entity-semantic', entity_id: id, semantic: meaningOf(id)}]}), /Unlock this entity/)
  r.store.document = structuredClone(before)
  await assert.rejects(owner.apply({operation: 'apply', basis: owner.read().basis, changes: [{kind: 'entity-semantic', entity_id: id, semantic: meaningOf(id), scope: 'entity'}]}), /foreign operands/)
  assert.equal(commits, 0); assert.deepEqual(r.store.document, before)
})

test('prepareCompositionEdit carries the whole meaning to scene_material_set, addressed by the native occurrence ref, and writes nothing for a clean baseline', () => {
  const r = source(), id = r.entity.id, sceneRef = r.view.bindings[r.scene.id].scene_ref
  const entityRef = r.view.bindings[r.scene.id].occurrences.find(o => o.view_entity_id === id).entity_ref
  const changed = setMeaning(r, meaningOf(id, {modulations: [{source: {kind: 'focus'}, target: 'color.gain', amount: 2, offset: 0.5, clamp: [0, 3]}]}))
  const material = prepareCompositionEdit(r.view, changed).changes.find(c => c.change === 'scene_material_set' && c.scene_ref === sceneRef)
  assert.ok(material, 'the edited Scene produces one scene_material_set request')
  const [carried] = material.presentation.scene.semanticField.bindings
  assert.equal(carried.carriers[0].id, entityRef, 'the carrier is the native occurrence ref, not the view id')
  assert.deepEqual(carried.color, COLOUR); assert.equal(carried.semanticNodeId, 'anahata')
  assert.deepEqual(carried.modulations, [{source: {kind: 'focus'}, target: 'color.gain', amount: 2, offset: 0.5, clamp: [0, 3]}], 'mapping clamps are carried intact')
  assert.equal(material.presentation.scene.semanticField.enabled, true)
  const layer = applyOne(r, {kind: 'semantic-field-setting', key: 'enabled', value: false}, changed)
  const offMaterial = prepareCompositionEdit(r.view, layer).changes.find(c => c.change === 'scene_material_set' && c.scene_ref === sceneRef)
  assert.equal(offMaterial.presentation.scene.semanticField.enabled, false)
  // Removing the meaning against the baseline that carried it writes the Scene without the binding.
  const carriedBase = {...r.view, journey: structuredClone(r.view.journey)}
  sceneIn(carriedBase.journey, r.view.startSceneId).semanticField = {...clone(SCENE_FIELD), bindings: [meaningOf(id)]}
  const cleared = setMeaning(r, null, id, changed)
  const removal = prepareCompositionEdit(carriedBase, cleared).changes.find(c => c.change === 'scene_material_set' && c.scene_ref === sceneRef)
  assert.ok(removal, 'the removal produces a scene_material_set request')
  assert.equal(removal.presentation.scene.semanticField?.bindings.length ?? 0, 0, 'a removed meaning is absent from the request')
  assert.equal(prepareCompositionEdit(r.view, r.store.document).changes.some(c => c.change === 'scene_material_set' && c.scene_ref === sceneRef), false, 'the untouched baseline writes nothing')
})

test('the kernel admits the Scene semanticField key in scene material (expression_scene.rs KEYS)', () => {
  const keys = kernelSource.match(/const KEYS: &\[&str\] = &\[([\s\S]*?)\];/)[1]
  assert.match(keys, /"semanticField"/)
})
