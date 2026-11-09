import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'
import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'

// O-I #747 round 895, OPEN 6 (DLW build ruling 2026-11-08): choose-shape, closed. The manual's glyph editor: "Its Formation sets the
// shape: Glyph or word, Ring, Disc, Triangle, Plane, Canonical yantra or Authored cymatic template" (DLW.md §20.1). Round 894 left the
// row partial: the State shape offered yantra and cymatic, but no change carried which yantra (yantraId) or the template's frequency
// (templateFrequency), so a state set to either stood on the app's default (Anahata, 396 Hz) and nothing here could choose another.
// Now step-source carries them as the app's inspector writes them (inspector.ts shapeFields: Yantra from CANONICAL_CHAKRAS, default
// anahata; "Authored template frequency · Hz", 1 to 100000, default 396), and the glyph editor offers each under the State shape.
// REAL: the owner's applyNativeGlyphChanges on a real Journey and the native entity it saves as; SSR: the glyph editor.
const root = new URL('../../../../', import.meta.url)
const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
const parameters = new URL('packages/expressions-boundary/src/parameters.ts', root).href
register(`data:text/javascript,${encodeURIComponent(`import ts from ${JSON.stringify(compiler)};import {readFile} from 'node:fs/promises';export async function resolve(s,c,n){if(s==='@epilogos/expressions-boundary/parameters')return n(${JSON.stringify(parameters)},c);try{return await n(s,c)}catch(e){if(!s.startsWith('.'))throw e;if(s.endsWith('.js')){try{return await n(s.slice(0,-3)+'.ts',c)}catch{}}for(const x of ['.ts','.tsx']){try{return await n(s+x,c)}catch{}}throw e}}export async function load(u,c,n){if(u.endsWith('.css'))return {format:'module',shortCircuit:true,source:'export {}'};if(!u.endsWith('.ts')&&!u.endsWith('.tsx'))return n(u,c);return {format:'module',shortCircuit:true,source:ts.transpileModule(await readFile(new URL(u),'utf8'),{fileName:new URL(u).pathname,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText}}`)}`, import.meta.url)
const author = new URL('desktop/cradle/expressions-app/field-studies-journeys/src/', root)
const [source, editorModule, model, hostEditor, bridge, chakras] = await Promise.all([
  import('../src/components/nativeGlyphSource.ts'),
  import('../src/components/GlyphSequenceEditor.tsx'),
  import(new URL('model.ts', author)),
  import(new URL('hostEditor.ts', author)),
  import(new URL('nativeBridge.ts', author)),
  import(new URL('desktop/cradle/expressions-app/src/engine/chakraSystem.ts', root)),
])
const {GlyphSequenceEditor} = editorModule
const {applyNativeGlyphChanges} = hostEditor
const {CANONICAL_CHAKRAS} = chakras

function fixture(shape, extra = {}) {
  const journey = model.fieldStudies(), scene = journey.scenes[0]
  const e = scene.entities.find(entity => entity.kind === 'formation')
  e.locked = false
  e.sequence.enabled = true
  e.sequence.manual = false
  e.sequence.steps = [{hold: 1, transition: 1, position: null, id: 'state-a', text: 'O', shape, ...extra}, {hold: 1, transition: 1, position: null, id: 'state-b', text: 'I', shape: 'text'}]
  return {journey, scene, e, step: e.sequence.steps[0]}
}
const apply = ({journey, scene, e}, fields) => applyNativeGlyphChanges(journey, scene.id, [{kind: 'step-source', entity_id: e.id, step_id: 'state-a', ...fields}])
const stepOf = (journey, f) => journey.scenes[0].entities.find(row => row.id === f.e.id).sequence.steps[0]

test('a yantra state takes the yantra chosen, and saves it as the native shape', () => {
  const f = fixture('text')
  const next = apply(f, {shape: 'yantra', text: 'O', yantraId: 'muladhara'})
  const step = stepOf(next, f)
  assert.equal(step.shape, 'yantra')
  assert.equal(step.yantraId, 'muladhara')
  const native = bridge.toNativeEntity(next.scenes[0].entities.find(row => row.id === f.e.id))
  assert.deepEqual({kind: native.sequence.links[0].shape.kind, yantraId: native.sequence.links[0].shape.yantraId}, {kind: 'yantra', yantraId: 'muladhara'})
  assert.equal(bridge.fromNativeEntity(native).sequence.steps[0].yantraId, 'muladhara', 'and reads back as the state\'s yantra')
  const again = apply({...f, journey: next}, {shape: 'yantra', text: 'O', yantraId: 'sahasrara'})
  assert.equal(stepOf(again, f).yantraId, 'sahasrara', 'another yantra replaces it')
})

test('a cymatic state takes its authored template frequency, and saves it as the native shape', () => {
  const f = fixture('text')
  const next = apply(f, {shape: 'cymatic', text: 'O', templateFrequency: 528})
  const step = stepOf(next, f)
  assert.equal(step.shape, 'cymatic')
  assert.equal(step.templateFrequency, 528)
  const native = bridge.toNativeEntity(next.scenes[0].entities.find(row => row.id === f.e.id))
  assert.equal(native.sequence.links[0].shape.kind, 'cymatic')
  assert.equal(native.sequence.links[0].shape.frequencyHz, 528)
})

test('the owner refuses a yantra it does not know, a sub-field on the wrong shape, and a frequency outside the inspector\'s range', () => {
  const f = fixture('text')
  assert.throws(() => apply(f, {shape: 'yantra', yantraId: 'nowhere'}), /Choose one of the seven canonical yantras/)
  assert.throws(() => apply(f, {shape: 'ring', yantraId: 'ajna'}), /Only a yantra state names a yantra/)
  assert.throws(() => apply(f, {shape: 'yantra', templateFrequency: 396}), /Only an authored cymatic template has a template frequency/)
  for (const hz of [0, 100001, Number.NaN]) assert.throws(() => apply(f, {shape: 'cymatic', templateFrequency: hz}), /Authored template frequency must be between 1 and 100000/)
})

test('the pure builders: one step-source each, keeping the state\'s source and glyph; refused on another shape', () => {
  const yantra = fixture('yantra', {yantraId: 'anahata'})
  assert.deepEqual(source.yantraBuild(yantra.e, yantra.step, 'ajna'), {ok: true, change: {kind: 'step-source', entity_id: yantra.e.id, step_id: 'state-a', shape: 'yantra', text: 'O', source: undefined, yantraId: 'ajna'}})
  assert.deepEqual(source.yantraBuild(yantra.e, yantra.step, 'nowhere'), {ok: false, message: 'Choose one of the seven canonical yantras'})
  const cymatic = fixture('cymatic')
  assert.deepEqual(source.templateFrequencyBuild(cymatic.e, cymatic.step, 432), {ok: true, change: {kind: 'step-source', entity_id: cymatic.e.id, step_id: 'state-a', shape: 'cymatic', text: 'O', source: undefined, templateFrequency: 432}})
  assert.equal(source.yantraBuild(cymatic.e, cymatic.step, 'ajna').ok, false)
  assert.equal(source.templateFrequencyBuild(yantra.e, yantra.step, 432).ok, false)
  assert.deepEqual(source.checkTemplateFrequency('528'), {ok: true, value: 528})
  assert.deepEqual(source.checkTemplateFrequency('0'), {ok: false, message: 'Authored template frequency · Hz must be 1 to 100000'})
  assert.deepEqual(source.YANTRAS.map(([id]) => id), CANONICAL_CHAKRAS.map(chakra => chakra.id), 'the inspector\'s yantras, in its order')
  assert.deepEqual(source.YANTRAS.map(([, name]) => name), CANONICAL_CHAKRAS.map(chakra => chakra.name))
})

const readingFor = ({scene, e, step}) => ({
  basis: {expression_ref: 'expr:choose-shape', revision: 1, scene_ref: scene.id, authored_revision: 1},
  scene, entityOccurrences: {[e.id]: 'occ:choose-shape'}, chosenControls: {available: false, entries: [], controls: []}, devices: [],
  selection: {entity_ids: [e.id], step_id: step.id}, history: {canUndo: false, canRedo: false}, standing: {dirty: false, pending: false, notice: null},
})
const markupFor = f => renderToStaticMarkup(createElement(GlyphSequenceEditor, {reading: readingFor(f), request: async () => ({ok: false, error: 'closed'})}))

test('the glyph editor offers the yantra under a yantra state, and the template frequency under a cymatic one', () => {
  const yantra = markupFor(fixture('yantra', {yantraId: 'svadhisthana'}))
  const select = yantra.match(/<select[^>]*aria-label="Yantra"[^>]*>(.*?)<\/select>/)
  assert.ok(select, 'a Yantra select stands under the State shape')
  assert.deepEqual([...select[1].matchAll(/<option value="([^"]+)"/g)].map(m => m[1]), CANONICAL_CHAKRAS.map(chakra => chakra.id))
  assert.match(select[1], /<option value="svadhisthana" selected="">/)
  assert.match(markupFor(fixture('yantra')), /<option value="anahata" selected="">/, 'with none recorded, the app\'s default')
  assert.doesNotMatch(yantra, /aria-label="Authored template frequency · Hz"/)
  const cymatic = markupFor(fixture('cymatic'))
  assert.match(cymatic, /<input type="text"[^>]*aria-label="Authored template frequency · Hz"[^>]*value="396"/, 'with none recorded, the app\'s 396 Hz')
  assert.doesNotMatch(cymatic, /aria-label="Yantra"/)
  assert.match(markupFor(fixture('cymatic', {templateFrequency: 528})), /aria-label="Authored template frequency · Hz"[^>]*value="528"/)
  const text = markupFor(fixture('text'))
  assert.doesNotMatch(text, /aria-label="Yantra"|aria-label="Authored template frequency · Hz"/)
})
