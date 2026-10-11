import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {register} from 'node:module'
import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'

// Production sources in memory, same loader as the sibling native tests: .ts/.tsx is transpiled, .css is a non-executing stub.
// The formation glyph is one named edit over the retained owner. The app body (app.ts case 'native-glyph', base) is replayed on a
// clone from the same frame helpers, in the same order, and the reducer must produce that same document. No DOM or engine is simulated.
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

const root = new URL('../../../../', import.meta.url)
const author = new URL('desktop/cradle/expressions-app/field-studies-journeys/src/', root)
const boundary = new URL('packages/expressions-boundary/src/', root)
const [formations, hostEditor, kernelBridge, store, sourceState, nativeFeatures, sizing, recovery, glyphEditor] = await Promise.all([
  import(new URL('nativeFormations.ts', boundary)), import(new URL('hostEditor.ts', author)), import(new URL('kernelDocumentBridge.ts', author)),
  import(new URL('store.ts', author)), import(new URL('sourceState.ts', author)), import(new URL('nativeFeatures.ts', author)),
  import(new URL('stateSizing.ts', author)), import('../src/continuity/nativeInputRecovery.ts'), import('../src/components/GlyphSequenceEditor.tsx'),
])
const {GlyphSequenceEditor} = glyphEditor
const {validateFormationGlyph} = formations
const {applyNativeGlyphChanges, createRetainedNativeEditor} = hostEditor
const {kernelDocumentToJourney} = kernelBridge
const {DocumentStore} = store
const {useStateShape, setStateSource} = sourceState
const {applyGlyph} = nativeFeatures
const {refitEntityForGlyph, refitStepForGlyph} = sizing
const {privateNativeInputChanges} = recovery
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
const entityOf = (journey, sceneId, entityId) => sceneOf(journey, sceneId).entities.find(e => e.id === entityId)

/** The fixture's first formation, unlocked, with exactly the states asked for and no spatial layers, so only the glyph law is measured.
 * The Scene's auto-fit switch is set by the caller. Returns the edited copy; the caller's document is not touched. */
function arrange(journey, sceneId, {states = 1, autoFit = true, locked = false} = {}) {
  const next = structuredClone(journey), scene = sceneOf(next, sceneId), e = scene.entities.find(entity => entity.kind === 'formation')
  e.locked = locked; e.layers = []
  if (states < e.sequence.steps.length) e.sequence.steps = e.sequence.steps.slice(0, states)
  while (e.sequence.steps.length < states) {const copy = structuredClone(e.sequence.steps[0]); copy.id = `step-extra-${e.sequence.steps.length}`; e.sequence.steps.push(copy)}
  scene.engine.autoFitSizes = autoFit
  return next
}
const formationId = (journey, sceneId) => sceneOf(journey, sceneId).entities.find(e => e.kind === 'formation').id
/** The app body (app.ts case 'native-glyph', base) replayed on a clone: the same helpers in the same order. */
function appBody(journey, sceneId, entityId, glyph) {
  const next = structuredClone(journey), scene = sceneOf(next, sceneId), e = scene.entities.find(entity => entity.id === entityId)
  const font = {fontFamily: scene.engine.fontFamily, fontWeight: scene.engine.fontWeight}
  useStateShape(e, 0); e.layers = []; setStateSource(e, 0, undefined); applyGlyph(e, null, glyph)
  if (scene.engine.autoFitSizes !== false) {refitEntityForGlyph(e, glyph, font); if (e.sequence.steps.length === 1) refitStepForGlyph(e, 0, glyph, font)}
  return next
}
const row = (id, extra = {}) => ({kind: 'formation-glyph', entity_id: id, text: 'Hi', ...extra})

test('the validator admits one formation glyph, trims it to 1–120 characters, and returns the formation it names', () => {
  const r = editor(), journey = arrange(r.store.document, r.scene.id), scene = sceneOf(journey, r.scene.id), id = formationId(journey, r.scene.id)
  const admitted = validateFormationGlyph(scene, row(id, {text: '  Ω  '}))
  assert.equal(admitted.text, 'Ω'); assert.equal(admitted.entity, scene.entities.find(e => e.id === id))
  assert.equal(validateFormationGlyph(scene, row(id, {text: 'x'.repeat(120)})).text.length, 120)
  assert.equal(validateFormationGlyph(scene, row(id, {text: 'Hello world'})).text, 'Hello world')
})

test('the validator refuses unknown or missing keys, a foreign kind, an empty or 121-character text, and an unknown entity', () => {
  const r = editor(), journey = arrange(r.store.document, r.scene.id), scene = sceneOf(journey, r.scene.id), id = formationId(journey, r.scene.id)
  assert.throws(() => validateFormationGlyph(scene, row(id, {title: 'x'})), /only its entity and text/)
  assert.throws(() => validateFormationGlyph(scene, {kind: 'formation-glyph', entity_id: id}), /only its entity and text/)
  assert.throws(() => validateFormationGlyph(scene, {kind: 'formation-glyph', text: 'Hi'}), /only its entity and text/)
  assert.throws(() => validateFormationGlyph(scene, {kind: 'formation-glyph', entity_id: 7, text: 'Hi'}), /only its entity and text/)
  assert.throws(() => validateFormationGlyph(scene, {kind: 'formation-add', entity_id: id, text: 'Hi'}), /only its entity and text/)
  assert.throws(() => validateFormationGlyph(scene, row(id, {text: '   '})), /1–120 characters/)
  assert.throws(() => validateFormationGlyph(scene, row(id, {text: 'x'.repeat(121)})), /1–120 characters/)
  assert.throws(() => validateFormationGlyph(scene, row(id, {text: 7})), /1–120 characters/)
  assert.throws(() => validateFormationGlyph(scene, row('entity:gone')), /no longer belongs to this Scene/)
  assert.throws(() => validateFormationGlyph(scene, null), /admitted formation glyph/)
})

test('the validator refuses a locked formation, a blueprint member and a non-formation with the legible reasons', () => {
  const r = editor(), journey = arrange(r.store.document, r.scene.id), id = formationId(journey, r.scene.id)
  const locked = arrange(r.store.document, r.scene.id, {locked: true})
  assert.throws(() => validateFormationGlyph(sceneOf(locked, r.scene.id), row(id)), /Unlock this formation before changing its shape\./)
  const member = structuredClone(journey); sceneOf(member, r.scene.id).composition.blueprint = {members: [{entity_ref: id}]}
  assert.throws(() => validateFormationGlyph(sceneOf(member, r.scene.id), row(id)), /Release the blueprint before changing one of its members/)
  const pin = structuredClone(journey); entityOf(pin, r.scene.id, id).kind = 'pin'
  assert.throws(() => validateFormationGlyph(sceneOf(pin, r.scene.id), row(id)), /Only a formation takes a formation glyph/)
})

test('the reducer reproduces the app native-glyph base body on a clone with one state, auto-fit on and off', () => {
  for (const autoFit of [true, false]) {
    const r = editor(), start = arrange(r.store.document, r.scene.id, {states: 1, autoFit}), id = formationId(start, r.scene.id), pristine = structuredClone(start)
    const next = applyNativeGlyphChanges(start, r.scene.id, [row(id, {text: 'Hello'})])
    assert.deepEqual(next, appBody(start, r.scene.id, id, 'Hello'), `auto-fit ${autoFit}`)
    assert.deepEqual(start, pristine, 'the caller document is never mutated')
    const before = entityOf(start, r.scene.id, id), after = entityOf(next, r.scene.id, id), step = after.sequence.steps[0]
    assert.equal(after.shape, 'text'); assert.equal(after.text, 'Hello'); assert.deepEqual(after.layers, [])
    assert.equal(step.shape, 'text'); assert.equal(step.text, 'Hello'); assert.equal(step.source, undefined); assert.equal(after.source, undefined)
    assert.deepEqual(step.layers, [], 'the one state drops its own layers as the app does')
    if (autoFit) assert.notDeepEqual(after.size, before.size, 'the base box refits to the new glyph')
    else {assert.deepEqual(after.size, before.size, 'auto-fit off keeps the authored box'); assert.deepEqual(step.objectState, before.sequence.steps[0].objectState)}
  }
})

test('the reducer trims the admitted text before the app body runs, so the stored glyph is the trimmed text', () => {
  const r = editor(), start = arrange(r.store.document, r.scene.id, {states: 1}), id = formationId(start, r.scene.id)
  const next = applyNativeGlyphChanges(start, r.scene.id, [row(id, {text: '  Hello  '})])
  assert.deepEqual(next, appBody(start, r.scene.id, id, 'Hello'))
  assert.equal(entityOf(next, r.scene.id, id).text, 'Hello')
})

test('with several states the base glyph is not mirrored onto them, and the reducer leaves states 1 and later alone', () => {
  const r = editor(), start = arrange(r.store.document, r.scene.id, {states: 3, autoFit: true}), id = formationId(start, r.scene.id)
  const next = applyNativeGlyphChanges(start, r.scene.id, [row(id, {text: 'Hello'})])
  assert.deepEqual(next, appBody(start, r.scene.id, id, 'Hello'))
  const before = entityOf(start, r.scene.id, id), after = entityOf(next, r.scene.id, id)
  assert.equal(after.text, 'Hello'); assert.equal(after.shape, 'text')
  assert.equal(after.sequence.steps[0].text, before.sequence.steps[0].text, 'state 1 is not mirrored with several states')
  assert.deepEqual(after.sequence.steps.slice(1), before.sequence.steps.slice(1), 'states 2 and later are untouched')
  assert.equal(after.sequence.steps.length, 3)
})

test('a locked formation or a blueprint member changes nothing in the reducer, and the refusal is the validator reason', () => {
  const r = editor(), locked = arrange(r.store.document, r.scene.id, {locked: true}), id = formationId(locked, r.scene.id), before = structuredClone(locked)
  assert.throws(() => applyNativeGlyphChanges(locked, r.scene.id, [row(id)]), /Unlock this formation before changing its shape/)
  assert.deepEqual(locked, before)
  const member = arrange(r.store.document, r.scene.id); sceneOf(member, r.scene.id).composition.blueprint = {members: [{entity_ref: id}]}
  const memberBefore = structuredClone(member)
  assert.throws(() => applyNativeGlyphChanges(member, r.scene.id, [row(id)]), /Release the blueprint before changing one of its members/)
  assert.deepEqual(member, memberBefore)
})

test('one formation glyph is one owner commit and one history entry, and undo restores the captured document', async () => {
  const r = editor(); r.store.replace(arrange(r.store.document, r.scene.id, {states: 2}))
  const id = formationId(r.store.document, r.scene.id), before = structuredClone(r.store.document), history = r.store.undoStack.length
  await apply(r, [row(id, {text: '  Hi  '})])
  assert.equal(r.commits(), 1); assert.equal(r.store.undoStack.length, history + 1, 'one history entry for the one apply')
  assert.equal(entityOf(r.store.document, r.scene.id, id).text, 'Hi')
  assert.equal(r.store.undo(), true); assert.deepEqual(r.store.document, before)
  assert.equal(r.store.redo(), true); assert.equal(entityOf(r.store.document, r.scene.id, id).text, 'Hi')
})

test('a refused formation glyph leaves the document, the history and the commit count untouched', async () => {
  const r = editor(); r.store.replace(arrange(r.store.document, r.scene.id, {locked: true}))
  const id = formationId(r.store.document, r.scene.id), before = structuredClone(r.store.document), history = r.store.undoStack.length
  await assert.rejects(apply(r, [row(id)]), /Unlock this formation before changing its shape/)
  assert.deepEqual(r.store.document, before); assert.equal(r.store.undoStack.length, history); assert.equal(r.commits(), 0)
})

test('a formation add and a formation glyph in one batch are one commit, each routed to its own reducer', async () => {
  const r = editor(); r.store.replace(arrange(r.store.document, r.scene.id, {states: 1}))
  const id = formationId(r.store.document, r.scene.id), count = sceneOf(r.store.document, r.scene.id).entities.length
  await apply(r, [{kind: 'formation-add', shape: 'ring'}, row(id, {text: 'Hi'})])
  assert.equal(r.commits(), 1)
  assert.equal(sceneOf(r.store.document, r.scene.id).entities.length, count + 1)
  assert.equal(entityOf(r.store.document, r.scene.id, id).text, 'Hi')
})

test('a retained formation glyph input decodes to one formation-glyph change for its own formation, and only that', () => {
  const r = editor(), journey = arrange(r.store.document, r.scene.id, {states: 1}), id = formationId(journey, r.scene.id)
  const reading = {...r.owner.read(), scene: sceneOf(journey, r.scene.id), selection: {entity_ids: [id], step_id: null}, entityOccurrences: {[id]: 'entity-ref:1'}}
  const copy = {basis: {...reading.basis}, target: {scope: 'entity', entity_id: id, entity_ref: 'entity-ref:1', step_id: null, parameter: 'formation-glyph', family: 'glyph:formation', axis: null}, input: {kind: 'text', text: 'Hi', initial: 'O'}}
  assert.deepEqual(privateNativeInputChanges(copy, reading), [{kind: 'formation-glyph', entity_id: id, text: 'Hi'}])
  assert.throws(() => privateNativeInputChanges({...copy, target: {...copy.target, entity_id: 'entity:other'}}, reading), /retained input target/)
  assert.throws(() => privateNativeInputChanges({...copy, target: {...copy.target, entity_ref: 'entity-ref:2'}}, reading), /retained input target/)
})

test('the formation glyph control is named, and disabled with its reason when the formation is locked or a blueprint member', () => {
  const r = editor(), open = arrange(r.store.document, r.scene.id, {states: 1}), id = formationId(open, r.scene.id)
  const render = doc => {
    const e = entityOf(doc, r.scene.id, id)
    const reading = {...r.owner.read(), scene: sceneOf(doc, r.scene.id), selection: {entity_ids: [id], step_id: e.sequence.steps[0].id}, entityOccurrences: {[id]: 'entity-ref:1'}}
    return renderToStaticMarkup(createElement(GlyphSequenceEditor, {reading, request: async () => ({ok: false, error: 'closed'})}))
  }
  const control = markup => markup.match(/<input[^>]*aria-label="Formation glyph"[^>]*>/)?.[0] ?? ''
  const editable = render(open)
  assert.ok(control(editable), 'the control is named Formation glyph')
  assert.doesNotMatch(control(editable), /disabled/)
  assert.match(editable, />Set formation glyph</)
  const locked = arrange(r.store.document, r.scene.id, {locked: true}), lockedMarkup = render(locked)
  assert.match(control(lockedMarkup), /disabled/); assert.match(lockedMarkup, /Unlock this formation before changing its shape\./)
  const member = arrange(r.store.document, r.scene.id, {states: 1}); sceneOf(member, r.scene.id).composition.blueprint = {members: [{entity_ref: id}]}
  const memberMarkup = render(member)
  assert.match(control(memberMarkup), /disabled/); assert.match(memberMarkup, /Release the blueprint before changing one of its members\./)
})
