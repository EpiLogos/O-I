import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {register} from 'node:module'

// Production sources in memory, same loader as the sibling native composition suites.
// Formation add is one named edit over the retained owner; no native effect is simulated.
const root = new URL('../../../../', import.meta.url)
const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
const parameters = new URL('packages/expressions-boundary/src/parameters.ts', root).href
register(`data:text/javascript,${encodeURIComponent(`import ts from ${JSON.stringify(compiler)};import {readFile} from 'node:fs/promises';export async function resolve(s,c,n){if(s==='@epilogos/expressions-boundary/parameters')return n(${JSON.stringify(parameters)},c);try{return await n(s,c)}catch(e){if(!s.startsWith('.'))throw e;if(s.endsWith('.js')){try{return await n(s.slice(0,-3)+'.ts',c)}catch{}}for(const x of ['.ts','.tsx']){try{return await n(s+x,c)}catch{}}throw e}}export async function load(u,c,n){if(u.endsWith('.css'))return {format:'module',shortCircuit:true,source:'export {}'};if(!u.endsWith('.ts')&&!u.endsWith('.tsx'))return n(u,c);return {format:'module',shortCircuit:true,source:ts.transpileModule(await readFile(new URL(u),'utf8'),{fileName:new URL(u).pathname,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText}}`)}`, import.meta.url)

const author = new URL('desktop/cradle/expressions-app/field-studies-journeys/src/', root)
const boundary = new URL('packages/expressions-boundary/src/', root)
const [formations, model, {kernelDocumentToJourney}, {prepareCompositionEdit}, {DocumentStore}, {createRetainedNativeEditor}, sizing] = await Promise.all([
  import(new URL('nativeFormations.ts', boundary)), import(new URL('model.ts', author)), import(new URL('kernelDocumentBridge.ts', author)),
  import(new URL('kernelComposition.ts', author)), import(new URL('store.ts', author)), import(new URL('hostEditor.ts', author)), import(new URL('stateSizing.ts', author)),
])
const nativeDocument = JSON.parse(await readFile(new URL('./fixtures/native-rich-glyph-rack.json', import.meta.url), 'utf8'))
const blocked = () => {throw Error('Native effects are closed in formation verification')}

function editor() {
  const view = kernelDocumentToJourney(structuredClone(nativeDocument)), store = new DocumentStore(view.journey)
  const scene = store.document.scenes.find(s => s.id === view.startSceneId) ?? store.document.scenes[0]
  let commits = 0
  const owner = createRetainedNativeEditor({store, sceneId: () => scene.id, selection: () => ({entity_ids: [], step_id: null}), nativeView: () => view,
    nativeSelect: blocked, commit: async () => {commits++; return true}, change: mutate => store.change(mutate), afterHistory: blocked, selectLocal: blocked,
    openEditor: blocked, standing: () => ({busy: false, notice: null}), telemetry: () => undefined, fieldPaused: () => false})
  return {view, store, scene, owner, commits: () => commits}
}
const apply = (r, changes) => r.owner.apply({operation: 'apply', basis: r.owner.read().basis, changes})
const sceneOf = (journey, id) => journey.scenes.find(s => s.id === id)

test('the add picker shapes are the only admitted formation shapes, with the picker defaults', () => {
  assert.deepEqual(formations.FORMATION_ADD_SHAPES, ['text', 'ring', 'disc', 'triangle', 'square'])
  for (const shape of formations.FORMATION_ADD_SHAPES) assert.equal(formations.validateFormationAdd({kind: 'formation-add', shape}).shape, shape)
  assert.deepEqual(formations.validateFormationAdd({kind: 'formation-add'}), {title: 'New formation', shape: 'text', text: 'O', position: {x: 0, y: 0, z: 0}})
  for (const shape of ['glyph', 'plane', 'yantra', 'cymatic', 'Ring', '', null, 3])
    assert.throws(() => formations.validateFormationAdd({kind: 'formation-add', shape}), /formation shape/, String(shape))
})

test('glyph text trims to O when blank, names the formation after a word, and refuses foreign operands', () => {
  assert.equal(formations.validateFormationAdd({kind: 'formation-add', text: '   '}).text, 'O')
  assert.deepEqual(pick(formations.validateFormationAdd({kind: 'formation-add', text: '  Hello '})), {title: 'Hello', text: 'Hello'})
  assert.equal(formations.validateFormationAdd({kind: 'formation-add', shape: 'ring'}).text, 'O')
  assert.throws(() => formations.validateFormationAdd({kind: 'formation-add', shape: 'ring', text: 'x'}), /takes text/)
  assert.throws(() => formations.validateFormationAdd({kind: 'formation-add', text: 'x'.repeat(121)}), /1–120/)
  assert.throws(() => formations.validateFormationAdd({kind: 'formation-add', title: '  '}), /1–160/)
  assert.throws(() => formations.validateFormationAdd({kind: 'formation-add', title: 'x'.repeat(161)}), /1–160/)
  assert.throws(() => formations.validateFormationAdd({kind: 'formation-add', entity_id: 'x'}), /only its shape/)
  assert.throws(() => formations.validateFormationAdd({kind: 'formation-add', shape: 'ring', position: {x: 51, y: 0, z: 0}}), /±50/)
  assert.throws(() => formations.validateFormationAdd({kind: 'formation-add', position: {x: NaN, y: 0, z: 0}}), /±50/)
  assert.throws(() => formations.validateFormationAdd(null), /admitted formation/)
})
const pick = spec => ({title: spec.title, text: spec.text})

test('the reducer builds the entity the app add path builds, with ids normalised and refit only for glyphs', () => {
  const r = editor(), storeBefore = structuredClone(r.store.document), before = structuredClone(r.store.document)
  // The native fixture Scene has autoFitSizes off; the glyph refit law is exercised with it on, and once off below.
  sceneOf(before, r.scene.id).engine.autoFitSizes = true
  // The app's pointer add (app.ts ~L820): entity(name, glyph, point), shape on the entity and step 0, then the glyph refit.
  const appEntity = (name, text, shape, position, engine) => {
    const e = model.entity(name, text, position); e.shape = shape; e.sequence.steps[0].shape = shape
    if (shape === 'text' && engine.autoFitSizes !== false) {const font = {fontFamily: engine.fontFamily, fontWeight: engine.fontWeight}; sizing.refitEntityForGlyph(e, text, font); sizing.refitStepForGlyph(e, 0, text, font)}
    return e
  }
  const engine = sceneOf(before, r.scene.id).engine
  const expected = [
    appEntity('Hello', 'Hello', 'text', {x: 3, y: -4, z: 0}, engine),
    appEntity('New formation', 'O', 'ring', {x: 0, y: 0, z: 0}, engine),
  ]
  const next = formations.applyNativeFormationChanges(before, r.scene.id, [
    {kind: 'formation-add', text: 'Hello', position: {x: 3, y: -4, z: 0}}, {kind: 'formation-add', shape: 'ring'}])
  const added = sceneOf(next, r.scene.id).entities.slice(-2)
  added.forEach((entity, index) => {
    assert.equal(entity.kind, 'formation'); assert.equal(entity.sequence.steps.length, 1)
    expected[index].id = entity.id; expected[index].sequence.steps[0].id = entity.sequence.steps[0].id
    assert.deepEqual(entity, expected[index])
  })
  assert.notEqual(added[0].size.x, model.entity('x', 'x').size.x, 'a glyph state is refit to its own box')
  assert.deepEqual(added[1].size, {x: .65, y: .86}, 'a ring keeps the factory box')
  const unfitted = formations.applyNativeFormationChanges(r.store.document, r.scene.id, [{kind: 'formation-add', text: 'Hello'}])
  assert.deepEqual(sceneOf(unfitted, r.scene.id).entities.at(-1).size, {x: .65, y: .86}, 'autoFitSizes off keeps the factory box')
  assert.deepEqual(r.store.document, storeBefore, 'the caller document is never mutated')
})

test('the formation budget refuses the whole batch at the app limit of 32 formations and pins', () => {
  const r = editor(), full = structuredClone(r.store.document), scene = sceneOf(full, r.scene.id)
  while (scene.entities.length < 32) scene.entities.push(model.pin({x: 0, y: 0, z: 0}))
  assert.throws(() => formations.applyNativeFormationChanges(full, r.scene.id, [{kind: 'formation-add'}]), /up to 32 formations and pins/)
  const room = structuredClone(full); sceneOf(room, r.scene.id).entities.pop()
  const before = structuredClone(room)
  assert.throws(() => formations.applyNativeFormationChanges(room, r.scene.id, [{kind: 'formation-add'}, {kind: 'formation-add'}]), /up to 32 formations and pins/)
  assert.deepEqual(room, before)
  assert.equal(sceneOf(formations.applyNativeFormationChanges(room, r.scene.id, [{kind: 'formation-add'}]), r.scene.id).entities.length, 32)
  assert.throws(() => formations.applyNativeFormationChanges(room, 'scene:gone', [{kind: 'formation-add'}]), /no longer in this Expression/)
  assert.throws(() => formations.applyNativeFormationChanges(room, r.scene.id, []), /between 1 and 32/)
})

test('a retained-editor formation add is one owner commit that prepareCompositionEdit emits as entity_add and scene_material_set', async () => {
  const r = editor(), before = sceneOf(r.store.document, r.scene.id).entities.length
  await apply(r, [{kind: 'formation-add', shape: 'ring', title: 'Ring A', position: {x: 1, y: -2, z: 0}}])
  assert.equal(r.commits(), 1)
  const scene = sceneOf(r.store.document, r.scene.id), added = scene.entities.at(-1)
  assert.equal(scene.entities.length, before + 1); assert.equal(added.name, 'Ring A'); assert.equal(added.shape, 'ring')
  const request = prepareCompositionEdit(r.view, r.store.document, {sceneId: r.scene.id})
  const entityAdds = request.changes.filter(change => change.change === 'entity_add' && change.title === 'Ring A')
  assert.equal(entityAdds.length, 1, 'one new native identity')
  const material = request.changes.filter(change => change.change === 'scene_material_set' && change.scene_ref === r.view.bindings[r.scene.id].scene_ref)
  assert.equal(material.length, 1, 'one scene material for the edited Scene')
  // The committed Scene addresses the new object by its native entity ref (the entity_add ref), not the local id.
  const row = material[0].presentation.scene.entities.find(entity => entity.id === entityAdds[0].entity_ref)
  assert.equal(row.shape, 'ring'); assert.equal(row.name, 'Ring A'); assert.deepEqual(row.position, {x: 1, y: -2, z: 0})
})

test('a formation add and a force pin in one batch commit once, and the force pin keeps its device path', async () => {
  const r = editor(), before = sceneOf(r.store.document, r.scene.id).entities.length
  await apply(r, [{kind: 'formation-add', shape: 'disc'}, {kind: 'force-insert', position: {x: 0, y: 0, z: 0}}])
  assert.equal(r.commits(), 1)
  const kinds = sceneOf(r.store.document, r.scene.id).entities.slice(before).map(entity => [entity.kind, entity.shape])
  assert.deepEqual(kinds, [['formation', 'disc'], ['pin', 'text']])
})

test('a refused formation add leaves the document and the commit count untouched', async () => {
  const r = editor(), before = structuredClone(r.store.document)
  await assert.rejects(apply(r, [{kind: 'formation-add', shape: 'yantra'}]), /formation shape/)
  assert.deepEqual(r.store.document, before)
  assert.equal(r.commits(), 0)
})
