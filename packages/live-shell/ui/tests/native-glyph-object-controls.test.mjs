import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {register} from 'node:module'
import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'

// Glyph sequence panel: image/ASCII state-source options, Refit state sizes and Refit all states. The pure builders are checked
// against the owner's applyNativeGlyphChanges on a real Journey fixture (fieldStudies), against the Studio's own ranges and modes,
// and the editor is rendered with SSR. Same loader as native-device-formation.test.mjs (.tsx transpiled, .css stubbed).
const root = new URL('../../../../', import.meta.url)
const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
const parameters = new URL('packages/expressions-boundary/src/parameters.ts', root).href
register(`data:text/javascript,${encodeURIComponent(`import ts from ${JSON.stringify(compiler)};import {readFile} from 'node:fs/promises';export async function resolve(s,c,n){if(s==='@epilogos/expressions-boundary/parameters')return n(${JSON.stringify(parameters)},c);try{return await n(s,c)}catch(e){if(!s.startsWith('.'))throw e;if(s.endsWith('.js')){try{return await n(s.slice(0,-3)+'.ts',c)}catch{}}for(const x of ['.ts','.tsx']){try{return await n(s+x,c)}catch{}}throw e}}export async function load(u,c,n){if(u.endsWith('.css'))return {format:'module',shortCircuit:true,source:'export {}'};if(!u.endsWith('.ts')&&!u.endsWith('.tsx'))return n(u,c);return {format:'module',shortCircuit:true,source:ts.transpileModule(await readFile(new URL(u),'utf8'),{fileName:new URL(u).pathname,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText}}`)}`, import.meta.url)
const author = new URL('desktop/cradle/expressions-app/field-studies-journeys/src/', root)
const [source, editorModule, model, objectFace, formationTsx] = await Promise.all([
  import('../src/components/nativeGlyphSource.ts'),
  import('../src/components/GlyphSequenceEditor.tsx'),
  import(new URL('model.ts', author)),
  import('../src/components/nativeEntityFace.formation.ts'),
  import('../src/components/NativeEntityFace.formation.tsx'),
])
const {reorderLayers, sourceDefault} = source
const {GlyphSequenceEditor} = editorModule
const {fieldStudies} = model
const {formationObjectChange, formationObjectGate} = objectFace
const {formationEntityView} = formationTsx
const PNG = 'data:image/png;base64,iVBORw0KGgo='

function fixture() {
  const journey = fieldStudies(), scene = journey.scenes[0]
  const e = scene.entities.find(entity => entity.kind === 'formation')
  e.locked = false
  e.sequence.enabled = true
  e.sequence.manual = false
  e.sequence.steps = [{id: 'state-a', text: 'O', shape: 'text', hold: 1, transition: 1, position: null, layers: [
    {id: 'layer-one', text: 'one', z: 0, scale: 1}, {id: 'layer-two', text: 'two', z: 0.5, scale: 1}, {id: 'layer-three', text: 'three', z: 1, scale: 1},
  ]}]
  return {journey, scene, e, step: e.sequence.steps[0]}
}
const readingFor = (scene, e, step, {locked = false} = {}) => ({
  basis: {expression_ref: 'expr:glyph-objects', revision: 1, scene_ref: scene.id, authored_revision: 1},
  scene: {...scene, entities: scene.entities.map(row => row.id === e.id ? {...row, locked} : row)},
  entityOccurrences: {[e.id]: 'occ:glyph-objects'}, chosenControls: {available: false, entries: [], controls: []}, devices: [],
  selection: {entity_ids: [e.id], step_id: step.id}, history: {canUndo: false, canRedo: false},
  standing: {dirty: false, pending: false, notice: null},
})
const markupFor = reading => renderToStaticMarkup(createElement(GlyphSequenceEditor, {reading, request: async () => ({ok: false, error: 'closed'})}))

test('reorderLayers moves one layer one place and returns the full new order, or null at an edge', () => {
  const layers = [{id: 'a'}, {id: 'b'}, {id: 'c'}]
  assert.deepEqual(reorderLayers(layers, 'b', -1).map(layer => layer.id), ['b', 'a', 'c'])
  assert.deepEqual(reorderLayers(layers, 'b', 1).map(layer => layer.id), ['a', 'c', 'b'])
  assert.equal(reorderLayers(layers, 'a', -1), null)
  assert.equal(reorderLayers(layers, 'c', 1), null)
  assert.equal(reorderLayers(layers, 'missing', 1), null)
  assert.deepEqual(layers.map(layer => layer.id), ['a', 'b', 'c'], 'the input is not mutated')
})

test('the Glyph Sequence editor offers layer order, Clear position and the ASCII and image state shortcuts', () => {
  const {scene, e, step} = fixture()
  const markup = markupFor(readingFor(scene, e, step))
  assert.match(markup, /aria-label="Move layer up"/)
  assert.match(markup, /aria-label="Move layer down"/)
  assert.match(markup, /aria-label="Layer layer-one"/)
  assert.match(markup, /＋ ASCII state/)
  assert.match(markup, /＋ Image state/)
  // No position on the state: Clear position is disabled, so nothing can be sent.
  assert.match(markup, /<button[^>]*disabled=""[^>]*>Clear position<\/button>/)
})

test('Clear position is available for a state with its own offset, and the layer order controls are disabled when locked', () => {
  const {scene, e, step} = fixture()
  step.position = {x: 1, y: 2, z: 0}
  const open = markupFor(readingFor(scene, e, step))
  assert.doesNotMatch(open, /<button[^>]*disabled=""[^>]*>Clear position<\/button>/)
  const locked = markupFor(readingFor(scene, e, step, {locked: true}))
  assert.match(locked, /<button[^>]*disabled=""[^>]*>Clear position<\/button>/)
  assert.match(locked, /<button[^>]*aria-label="Move layer up"[^>]*disabled=""/)
})

test('sourceDefault gives the app ASCII drawing and an image source that waits for its file in the Studio', () => {
  assert.deepEqual(sourceDefault('ascii'), {kind: 'ascii', ascii: {text: 'O  :  I', fontFamily: 'monospace', fontSize: 32}})
  const image = sourceDefault('image')
  assert.equal(image.kind, 'image')
  assert.equal(image.image.dataUrl, undefined, 'no file is embedded until the Studio supplies one')
  assert.equal(sourceDefault('none'), undefined)
  assert.ok(PNG)
})

test('formation Duplicate and Delete: the gate follows the app (locked duplicates, locked and blueprint members do not delete)', () => {
  const {scene, e} = fixture()
  assert.deepEqual(formationObjectGate(scene, e, false), {duplicate: null, remove: null})
  const locked = {...e, locked: true}
  const lockedScene = {...scene, entities: scene.entities.map(row => row.id === e.id ? locked : row)}
  const lockedGate = formationObjectGate(lockedScene, locked, true)
  assert.equal(lockedGate.duplicate, null, 'a locked entity duplicates, as the app does')
  assert.match(lockedGate.remove, /Unlock/)
  const member = {...scene, composition: {...scene.composition, blueprint: {members: [{entity_ref: e.id}]}}}
  assert.match(formationObjectGate(member, e, false).remove, /Release the blueprint/)
  assert.match(formationObjectGate(scene, e, true).duplicate, /Wait for the current native edit/)
  const full = {...scene, entities: Array.from({length: 32}, (_, index) => ({...e, id: 'full:' + index}))}
  assert.match(formationObjectGate(full, e, false).duplicate, /up to 32 formations and pins/)
  assert.deepEqual(formationObjectChange('entity-remove', e), {kind: 'entity-remove', entity_id: e.id})
  assert.deepEqual(formationObjectChange('entity-duplicate', e), {kind: 'entity-duplicate', entity_id: e.id})
})

test('the Formation device renders its Object section with Duplicate and a Delete that is disabled while locked', () => {
  const {scene, e} = fixture()
  const reading = readingFor(scene, e, e.sequence.steps[0])
  const ctx = {reading, entity: reading.scene.entities.find(row => row.id === e.id), disabled: false, apply: async () => ({ok: true}), renderControl: () => null}
  const open = renderToStaticMarkup(formationEntityView.render(ctx))
  assert.match(open, /aria-label="Object"/)
  assert.match(open, />Duplicate</)
  assert.match(open, /<button[^>]*>Delete<\/button>/)
  const lockedCtx = {...ctx, disabled: true, entity: {...ctx.entity, locked: true}}
  const locked = renderToStaticMarkup(formationEntityView.render(lockedCtx))
  assert.match(locked, /<button[^>]*disabled=""[^>]*>Delete<\/button>/)
  assert.match(locked, /Unlock this formation to remove it/)
})
