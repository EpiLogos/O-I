import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {register} from 'node:module'
import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'

// Production modules in memory: .ts/.tsx transpiled, CSS stubbed, and @epilogos/expressions-boundary/<name> resolved to the boundary source.
// The desktop owner sources are imported by absolute URL, as the sibling boundary tests do. No owner, store, server or browser is simulated.
const root = new URL('../../../../', import.meta.url)
const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
const boundary = new URL('packages/expressions-boundary/src/', root).href
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};
import {readFile} from 'node:fs/promises';
const BOUNDARY = ${JSON.stringify(boundary)};
export async function resolve(s, c, n) {
  if (s.startsWith('@epilogos/expressions-boundary/')) return n(BOUNDARY + s.slice('@epilogos/expressions-boundary/'.length) + '.ts', c);
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

const author = new URL('desktop/cradle/expressions-app/field-studies-journeys/src/', root)
const [catalogue, rack, models, text, scene, registry, pool, sceneEdits, materialEdits, widgets, journeyModel, bridge] = await Promise.all([
  import('../src/components/nativeDeviceCatalogue.ts'),
  import('../src/components/nativeDeviceRackModel.ts'),
  import('../src/components/nativeSceneFaceModel.ts'),
  import('../src/components/nativeSceneFace.text.ts'),
  import('../src/components/nativeSceneFace.scene.ts'),
  import('../src/components/nativeSceneFaceViews.tsx'),
  import('../src/components/NativeDevicePoolView.tsx'),
  import(new URL('packages/expressions-boundary/src/sceneEdits.ts', root)),
  import(new URL('packages/expressions-boundary/src/sceneMaterialEdits.ts', root)),
  import(new URL('packages/expressions-boundary/src/expressionsFamilies.ts', root)),
  import(new URL('model.ts', author)),
  import(new URL('kernelDocumentBridge.ts', author)),
])
const {deviceCatalogue, selectedEntityOf} = catalogue
const {rackWidgets, addableDevices, deviceNote} = rack
const {SCENE_FACE_MODELS} = models
const {TextPanel} = await import('../src/components/NativeSceneFace.text.tsx')
const {ScenePanel} = await import('../src/components/NativeSceneFace.scene.tsx')
const {sceneFaceView, SCENE_FACE_VIEWS} = registry
const {NativeDevicePoolView} = pool
const {prepareNativeSceneEdit} = sceneEdits
const {applyNativeSceneTextChanges, TEXT_LAYER_BUDGET} = materialEdits
const FAMILY_IDS = widgets.EXPRESSIONS_FAMILIES.map(family => family.id)
const {blankJourney, clone} = journeyModel
const {kernelDocumentToJourney} = bridge
const {
  addLayerChange, alignChange, addLayerProblem, clampPosition, dragPosition, fieldChange, keyStep, pagePreview, positionChange,
  removeLayerChange, setLayerChange, textSummary, visibleChange, PAGE_REFERENCE_WIDTH,
} = text
const {expressionEditRequest, expressionTitleProblem, expressionDescriptionProblem, sceneSummary, EXPRESSION_TITLE_MAX, EXPRESSION_DESCRIPTION_MAX} = scene

const SCENE_REF = 'expression:whole:scene:main'
const layer = (over = {}) => ({id: 'text-1', visible: true, kicker: 'A MOMENT IN THE FIELD', title: 'Your words,', italic: 'in this space.',
  body: 'Supporting words', x: 0.07, y: 0.24, width: 240, size: 38, align: 'left', ...over})
const row = {scene_ref: SCENE_REF, local_scene_id: 'scene-main', native_title: 'Main', title: 'First', working: {duration: 6, transition: 1},
  snapshot: {availability: 'absent', duration: null, standing: null}, material: {available: true, reason: null}, member_refs: [], members: [],
  membership: {complete: true, page: null, page_count: null, unloaded_refs: [], unbound_local_entity_ids: [], reason: null}}
/** A minimal NativeEditorReading: the presented Scene carries the given text layers; the owner's selection and playback are disclosed. */
function reading(layers = [layer()], over = {}) {
  return {
    basis: {expression_ref: 'expression:whole', revision: 3, scene_ref: SCENE_REF, authored_revision: 5},
    scenes: {schema: 'oi.native-scenes/v1', basis: {expression_ref: 'expression:whole', revision: 3}, title: 'Ink study', description: 'A study of ink.', loop: true,
      native_selected_scene_ref: SCENE_REF, native_order: [SCENE_REF], object_titles: {}, working_order: [SCENE_REF], unbound_local_scene_ids: [],
      scenes: [row], completeness: {order: true, material: true, occurrences: true},
      timing: {working: {available: true, total_seconds: 6, extents: [{scene_ref: SCENE_REF, start_seconds: 0, duration_seconds: 6, transition_seconds: 1}]},
        saved: {available: false, reason: 'No saved sequence', missing_scene_refs: [], unbound_local_scene_ids: []}}},
    playback: {scene_ref: SCENE_REF, scene_elapsed_seconds: 0, expression_time_seconds: 0, scene_playing: false, saved_sequence_playing: false,
      field_paused: false, track_preview: false, intent_epoch: 4},
    nativeSelection: {scene_ref: SCENE_REF, entity_ref: null, relation_ref: null},
    scene: {id: 'scene-main', name: 'First', duration: 6, transition: 1, text: layers, entities: []},
    entityOccurrences: {}, chosenControls: {available: false, entries: [], controls: []}, devices: [], selection: {entity_ids: [], step_id: null},
    history: {canUndo: false, canRedo: false}, standing: {dirty: false, pending: false, notice: null}, ...over,
  }
}
const withDevices = (families) => families.map((family, index) => ({id: `${family}-${index + 1}`, family}))
const stub = () => {
  const sent = []
  return {sent, apply: async changes => {sent.push(...changes); return {ok: true, reading: null}}}
}
const journeyWith = (layers) => {
  const journey = blankJourney()
  journey.scenes[0].text = layers.map(item => clone(item))
  return journey
}
const SEED_SCENE = 'expression:whole:scene:main'
function seed() {
  const journey = blankJourney()
  journey.name = 'A working inquiry'
  journey.scenes[0].name = 'First'
  const document = {schema: 'oi.expression/v1', expression_ref: 'expression:whole', revision: 1, title: journey.name,
    scenes: [{scene_ref: SEED_SCENE, revision: 1, title: 'Main', entity_refs: []}], entities: {}, relations: {},
    selection: {scene_ref: SEED_SCENE, entity_ref: null}, provenance: [], representations: [], refinements: []}
  return kernelDocumentToJourney(document, {identity: {expression: journey.id, scenes: {[SEED_SCENE]: journey.scenes[0].id}}})
}

// ---- Registry and catalogue ----------------------------------------------------

test('the scene registry declares scene and text, each with a name, title-only groups and a summary', () => {
  // The registry keys are the scene families that have a model; each one has a panel view, and body is one of them.
  assert.deepEqual(Object.keys(SCENE_FACE_MODELS).sort(), Object.keys(SCENE_FACE_VIEWS).sort())
  assert.ok(Object.keys(SCENE_FACE_MODELS).includes('body'))
  assert.equal(SCENE_FACE_MODELS.scene.name, 'Scene')
  assert.equal(SCENE_FACE_MODELS.text.name, 'Page text')
  assert.deepEqual(SCENE_FACE_MODELS.scene.groups.map(group => group.title), ['Scene settings', 'Expression settings'])
  assert.deepEqual(SCENE_FACE_MODELS.text.groups.map(group => group.title), ['Text layers', 'Selected layer'])
  assert.equal(SCENE_FACE_MODELS.scene.studio, 'scene')
  assert.equal(SCENE_FACE_MODELS.text.studio, 'text')
})

test('scene families are declared Expressions families of the boundary, and the planned ones are too', () => {
  for (const family of ['scene', 'text', 'body', 'blueprint', 'arrange']) assert.ok(FAMILY_IDS.includes(family), `${family} is a declared Expressions family`)
  for (const family of Object.keys(SCENE_FACE_MODELS)) assert.ok(FAMILY_IDS.includes(family))
})

test('the catalogue carries scene-scope entries with no parameters, no light and no toggle', () => {
  const devices = deviceCatalogue()
  const scenes = devices.filter(device => device.scope === 'scene')
  assert.deepEqual(scenes.map(device => device.family).sort(), Object.keys(SCENE_FACE_MODELS).sort())
  for (const device of scenes) {
    assert.deepEqual(device.paths, [])
    assert.deepEqual(device.compact, [])
    assert.equal(device.toggle, null)
    assert.equal(device.enabled(reading()), undefined, 'scene devices show a hollow light')
    assert.equal(typeof device.actions, 'function')
  }
  assert.equal(deviceNote(scenes[0]), 'Scene settings · Expression settings')
  const families = devices.map(device => device.family)
  assert.equal(new Set(families).size, families.length, 'every catalogue family is unique')
})

test('scene summaries come from the presented Scene: name, duration and transition in seconds', () => {
  const [sceneDevice] = deviceCatalogue().filter(device => device.family === 'scene')
  assert.equal(sceneDevice.summary(reading()), 'First · 6s · 1s')
  assert.equal(sceneSummary(reading()), 'First · 6s · 1s')
})

// ---- Rack integration ----------------------------------------------------------

test('a reading without scene material never throws in any scene summary: it says what is not disclosed', () => {
  const bare = reading()
  delete bare.scene.text
  const devices = deviceCatalogue().filter(device => device.scope === 'scene')
  const summaryOf = family => devices.find(device => device.family === family).summary(bare)
  assert.equal(summaryOf('scene'), 'First · 6s · 1s')
  assert.equal(summaryOf('text'), 'Page text not disclosed')
  assert.equal(summaryOf('body'), 'Scene body not disclosed')
  for (const device of devices) assert.equal(typeof device.summary(bare), 'string', device.family)
  const [text] = rackWidgets({...bare, devices: withDevices(['text'])})
  assert.equal(text.summary, 'Page text not disclosed')
  assert.equal(text.actions[0].disabled, 'Page text is not disclosed by this reading')
  assert.equal(sceneSummary({...bare, scene: undefined}), 'Scene · —s · —s')
})

test('a placed scene device resolves in the rack with the presented Scene name as its target', () => {
  const [scene, text] = rackWidgets(reading([layer()], {devices: withDevices(['scene', 'text'])}))
  assert.equal(scene.scope, 'scene')
  assert.equal(scene.target, 'First')
  assert.equal(scene.summary, 'First · 6s · 1s')
  assert.equal(scene.on, undefined)
  assert.equal(scene.toggle, null)
  assert.deepEqual(scene.compact, [])
  assert.deepEqual(scene.actions, [], 'the Scene widget has no compact action')
  assert.equal(text.scope, 'scene')
  assert.equal(text.target, 'First')
  assert.equal(text.summary, '1 layer · Your words,')
  assert.deepEqual(text.actions.map(action => [action.label, action.disabled]), [['Add layer', null]])
  assert.deepEqual(text.actions[0].changes, [{kind: 'text-layer-add'}])
})

test('the Add layer compact action is disabled with the boundary budget reason when the Scene is full', () => {
  const full = Array.from({length: TEXT_LAYER_BUDGET}, (_, index) => layer({id: `text-${index}`}))
  const [text] = rackWidgets(reading(full, {devices: withDevices(['text'])}))
  assert.equal(text.actions[0].disabled, `A Scene supports ${TEXT_LAYER_BUDGET} text layers`)
  assert.equal(addLayerProblem(full), `A Scene supports 16 text layers`)
  assert.equal(addLayerProblem(full.slice(1)), null)
})

test('field and entity widgets keep their shape: no actions key and no scene target', () => {
  const [physics] = rackWidgets(reading([layer()], {devices: withDevices(['physics'])}))
  assert.equal('actions' in physics, false)
  assert.equal(physics.target, null)
  assert.equal(physics.scope, 'field')
})

test('a family the shell does not know stays in place as unavailable, never mapped to a scene device', () => {
  const widgets = rackWidgets(reading([layer()], {devices: [{id: 'scene-x', family: 'scenery'}, {id: 'scene-1', family: 'scene'}]}))
  assert.deepEqual(widgets[0], {unavailable: true, id: 'scene-x', family: 'scenery'})
  assert.equal(widgets[1].scope, 'scene')
})

test('a placed scene device leaves the add list; an unplaced one stays addable', () => {
  const placed = addableDevices(reading([layer()], {devices: withDevices(['scene'])})).map(device => device.family)
  assert.equal(placed.includes('scene'), false)
  assert.equal(placed.includes('text'), true)
  const empty = addableDevices(reading()).map(device => device.family)
  assert.equal(empty.includes('scene'), true)
})

test('unknown or non-scene families never resolve to a scene panel', () => {
  assert.equal(sceneFaceView('nope'), null)
  assert.equal(sceneFaceView('constructor'), null)
  assert.equal(sceneFaceView('__proto__'), null)
  assert.equal(sceneFaceView('physics'), null)
  assert.equal(typeof sceneFaceView('scene'), 'function')
  assert.equal(typeof sceneFaceView('text'), 'function')
  assert.equal(sceneFaceView('text'), SCENE_FACE_VIEWS.text)
})

// ---- Pure text helpers ---------------------------------------------------------

test('the text summary is the layer count and the first layer title, or the empty state', () => {
  assert.equal(textSummary([]), 'No text layers')
  assert.equal(textSummary([layer()]), '1 layer · Your words,')
  assert.equal(textSummary([layer({title: ''}), layer({id: 'b'})]), '2 layers · Text block')
})

test('the page preview draws visible layers only, from the layer fields, with the 45% block cap and honest past-the-edge flags', () => {
  const boxes = pagePreview([layer(), layer({id: 'hidden', visible: false}), layer({id: 'wide', width: 1000, x: 0.1, y: 0.5}),
    layer({id: 'edge', x: 0.9, width: 240}), layer({id: 'above', y: -0.1}), layer({id: 'below', y: 1.2})])
  assert.deepEqual(boxes.map(box => box.id), ['text-1', 'wide', 'edge', 'above', 'below'])
  const first = boxes[0]
  assert.equal(first.leftPct, 0.07 * 100)
  assert.equal(first.topPct, 0.24 * 100)
  assert.equal(first.widthPct, 240 / PAGE_REFERENCE_WIDTH * 100)
  assert.equal(first.fontCqw, 38 / PAGE_REFERENCE_WIDTH * 100)
  assert.equal(first.past, false)
  assert.equal(boxes[1].widthPct, 0.45 * 100, 'a block is capped at 45% of the reference width')
  assert.equal(boxes[2].past, true, 'x + width past the right edge is clipped and flagged')
  assert.equal(boxes[3].past, true, 'an anchor above the page is flagged')
  assert.equal(boxes[4].past, true, 'an anchor below the page is flagged')
})

test('positions clamp to the admitted range with two-decimal steps', () => {
  assert.equal(clampPosition(2), 1.5)
  assert.equal(clampPosition(-3), -0.5)
  assert.equal(clampPosition(0.1234), 0.12)
  assert.equal(clampPosition(1.006), 1.01)
})

test('a drag maps pointer travel to a fraction of the page, clamped to the admitted range', () => {
  const page = {width: 320, height: 180}
  const start = {clientX: 100, clientY: 100}
  assert.deepEqual(dragPosition({x: 0.5, y: 0.5}, start, {clientX: 260, clientY: 190}, page), {x: 1, y: 1})
  assert.deepEqual(dragPosition({x: 0.5, y: 0.5}, start, {clientX: 9000, clientY: -9000}, page), {x: 1.5, y: -0.5})
  assert.deepEqual(dragPosition({x: 0.3, y: 0.4}, start, {clientX: 900, clientY: 900}, {width: 0, height: 0}), {x: 0.3, y: 0.4})
})

test('arrow keys step 0.01, Shift steps 0.1, and other keys are not handled', () => {
  assert.deepEqual(keyStep('ArrowLeft', false), {x: -0.01, y: 0})
  assert.deepEqual(keyStep('ArrowDown', true), {x: 0, y: 0.1})
  assert.equal(keyStep('a', false), null)
})

test('a position change is one text-layer-set of both coordinates, and nothing when neither moved', () => {
  const target = layer()
  assert.deepEqual(positionChange(target, 0.5, 2), {kind: 'text-layer-set', layer_id: 'text-1', values: {x: 0.5, y: 1.5}})
  assert.equal(positionChange(target, 0.07, 0.24), null)
})

test('the layer builders have exactly the admitted shapes', () => {
  assert.deepEqual(addLayerChange(), {kind: 'text-layer-add'})
  assert.deepEqual(removeLayerChange('text-1'), {kind: 'text-layer-remove', layer_id: 'text-1'})
  assert.deepEqual(setLayerChange('text-1', {size: 40}), {kind: 'text-layer-set', layer_id: 'text-1', values: {size: 40}})
  assert.equal(visibleChange(layer(), true), null)
  assert.deepEqual(visibleChange(layer(), false), {kind: 'text-layer-set', layer_id: 'text-1', values: {visible: false}})
  assert.deepEqual(alignChange(layer(), 'right').change, {kind: 'text-layer-set', layer_id: 'text-1', values: {align: 'right'}})
  assert.equal(alignChange(layer(), 'left').change, null)
  assert.match(alignChange(layer(), 'justify').problem, /left, centre or right/)
})

// ---- Every control through a stub apply ----------------------------------------

const CONTROLS = [
  ['kicker', 'A NEW HEADING', {kicker: 'A NEW HEADING'}],
  ['title', 'A new title', {title: 'A new title'}],
  ['italic', 'a new line', {italic: 'a new line'}],
  ['body', 'Line one\nLine two', {body: 'Line one\nLine two'}],
  ['size', '40', {size: 40}],
  ['width', '480', {width: 480}],
  ['x', '0.5', {x: 0.5}],
  ['y', '1.5', {y: 1.5}],
]
for (const [control, raw, values] of CONTROLS) {
  test(`the ${control} control sends one exact text-layer-set that the boundary admits`, async () => {
    const target = layer()
    const {change, problem} = fieldChange(target, control, raw)
    assert.equal(problem, null)
    const {sent, apply} = stub()
    await apply([change])
    assert.deepEqual(sent, [{kind: 'text-layer-set', layer_id: 'text-1', values}])
    const journey = journeyWith([target])
    const next = applyNativeSceneTextChanges(journey, journey.scenes[0].id, sent)
    assert.equal(next.scenes[0].text[0][control], values[control])
  })
}

test('the visibility and alignment controls each send their one change through the stub', async () => {
  const {sent, apply} = stub()
  await apply([visibleChange(layer(), false), alignChange(layer(), 'center').change].filter(Boolean))
  assert.deepEqual(sent, [
    {kind: 'text-layer-set', layer_id: 'text-1', values: {visible: false}},
    {kind: 'text-layer-set', layer_id: 'text-1', values: {align: 'center'}},
  ])
})

test('the page handle sends one text-layer-set for both coordinates on release', async () => {
  const {sent, apply} = stub()
  await apply([positionChange(layer(), 0.6, 0.7)].filter(Boolean))
  assert.deepEqual(sent, [{kind: 'text-layer-set', layer_id: 'text-1', values: {x: 0.6, y: 0.7}}])
})

test('add and remove each send one change and the boundary applies it to the Scene', async () => {
  const {sent, apply} = stub()
  await apply([addLayerChange()])
  await apply([removeLayerChange('text-1')])
  assert.deepEqual(sent, [{kind: 'text-layer-add'}, {kind: 'text-layer-remove', layer_id: 'text-1'}])
  const journey = journeyWith([layer()])
  const added = applyNativeSceneTextChanges(journey, journey.scenes[0].id, [addLayerChange()])
  assert.equal(added.scenes[0].text.length, 2)
  const removed = applyNativeSceneTextChanges(added, journey.scenes[0].id, [removeLayerChange(added.scenes[0].text[1].id)])
  assert.equal(removed.scenes[0].text.length, 1)
})

// ---- Exact-value bounds: nothing is sent for an invalid value ----------------------

test('numeric exact values refuse out-of-range, empty and non-numeric input with the bound named and no change', () => {
  const target = layer()
  for (const [control, raw, pattern] of [
    ['size', '13', /Type size must be from 14 to 150/], ['size', '151', /150/], ['size', '', /must be a number from 14 to 150/], ['size', 'big', /number/],
    ['width', '59', /Block width must be from 60 to 1000/], ['width', '1001', /1000/],
    ['x', '1.51', /Page X must be from -0.5 to 1.5/], ['y', '-0.51', /Page Y must be from -0.5 to 1.5/],
  ]) {
    const result = fieldChange(target, control, raw)
    assert.equal(result.change, null, `${control}=${raw} sends nothing`)
    assert.match(result.problem, pattern)
  }
})

test('text exact values refuse overlong and control-character input, and an unchanged value sends nothing', () => {
  const target = layer()
  assert.match(fieldChange(target, 'title', 'x'.repeat(301)).problem, /Title is at most 300 characters/)
  assert.match(fieldChange(target, 'body', 'x'.repeat(5001)).problem, /at most 5000 characters/)
  assert.match(fieldChange(target, 'kicker', 'bad\u0007kicker').problem, /control characters/)
  assert.deepEqual(fieldChange(target, 'title', 'Your words,'), {change: null, problem: null})
})

// ---- Scene-level intents, against the real kernel seed -------------------------

test('expression-title prepares the Journey name, which the composition owner emits as one rename change, and no Scene changes', () => {
  const view = seed()
  const plan = prepareNativeSceneEdit(view, clone(view.journey), {operation: 'expression-title', title: '  New name  '})
  assert.equal(plan.label, 'Rename Expression')
  assert.equal(plan.snapshot.journey.name, 'New name')
  assert.deepEqual(plan.affected_scene_refs, [])
  assert.equal(plan.selected_scene_ref, SEED_SCENE)
  const rename = plan.request.changes.filter(change => change.change === 'rename')
  assert.deepEqual(rename, [{change: 'rename', title: 'New name'}])
  assert.equal(plan.request.changes.some(change => change.change === 'scene_rename'), false, 'the Scene name is untouched')
})

test('expression-title refuses an empty or overlong name with the boundary bound', () => {
  const view = seed()
  assert.throws(() => prepareNativeSceneEdit(view, clone(view.journey), {operation: 'expression-title', title: '   '}), /1–160 characters/)
  assert.throws(() => prepareNativeSceneEdit(view, clone(view.journey), {operation: 'expression-title', title: 'x'.repeat(161)}), /1–160 characters/)
})

test('expression-description prepares the Journey description as the composition_set change, empty included, and refuses overlong text', () => {
  const view = seed()
  const plan = prepareNativeSceneEdit(view, clone(view.journey), {operation: 'expression-description', description: 'A study of ink.'})
  assert.equal(plan.label, 'Set Expression description')
  assert.equal(plan.snapshot.journey.description, 'A study of ink.')
  const properties = plan.request.changes.find(change => change.change === 'composition_set')
  assert.equal(properties.presentation.description, 'A study of ink.')
  assert.deepEqual(plan.affected_scene_refs, [])
  const cleared = prepareNativeSceneEdit(view, clone(view.journey), {operation: 'expression-description', description: ''})
  assert.equal(cleared.snapshot.journey.description, '')
  assert.throws(() => prepareNativeSceneEdit(view, clone(view.journey), {operation: 'expression-description', description: 'x'.repeat(5001)}), /5000 characters/)
})

test('the Expression title request carries the presented Scene basis, intent epoch and selection, and is refused without them', () => {
  const current = reading()
  const request = expressionEditRequest(current, {operation: 'expression-title', title: 'Ink study'})
  assert.equal(request.operation, 'scene-edit')
  assert.deepEqual(request.basis, current.basis)
  assert.equal(request.intent_epoch, 4)
  assert.deepEqual(request.native_selection, {scene_ref: SCENE_REF, entity_ref: null, relation_ref: null})
  assert.deepEqual(request.intent, {operation: 'expression-title', title: 'Ink study'})
  request.basis.revision = 99
  assert.equal(current.basis.revision, 3, 'the request owns a copy of the basis')
  assert.equal(expressionEditRequest(reading([], {playback: undefined}), {operation: 'expression-title', title: 'x'}), null)
  assert.equal(expressionEditRequest(reading([], {nativeSelection: undefined}), {operation: 'expression-title', title: 'x'}), null)
})

test('the Expression title is trimmed, 1 to 160 characters, and the bound is the boundary bound', () => {
  assert.equal(EXPRESSION_TITLE_MAX, 160)
  assert.equal(expressionTitleProblem('   '), 'Give the Expression a name of 1–160 characters')
  assert.equal(expressionTitleProblem('x'.repeat(161)), 'Give the Expression a name of 1–160 characters')
  assert.equal(expressionTitleProblem(' Ink '), null)
})

test('the Expression description request carries the same basis, epoch and selection, stored as written, and is bounded at 5000', () => {
  const current = reading()
  const request = expressionEditRequest(current, {operation: 'expression-description', description: '  Ink,\n\nmoving.  '})
  assert.equal(request.operation, 'scene-edit')
  assert.deepEqual(request.basis, current.basis)
  assert.equal(request.intent_epoch, 4)
  assert.deepEqual(request.intent, {operation: 'expression-description', description: '  Ink,\n\nmoving.  '}, 'not trimmed')
  assert.equal(expressionEditRequest(reading([], {playback: undefined}), {operation: 'expression-description', description: ''}), null)
  assert.equal(expressionDescriptionProblem(''), null, 'empty is a real value')
  assert.equal(expressionDescriptionProblem('x'.repeat(EXPRESSION_DESCRIPTION_MAX)), null)
  assert.equal(expressionDescriptionProblem('x'.repeat(EXPRESSION_DESCRIPTION_MAX + 1)), 'The description must be at most 5000 characters')
})

// ---- SSR: accessible names and the pool host -----------------------------------

test('the Page text panel renders its layer list, exact-value controls and the page handle with accessible names', () => {
  const html = renderToStaticMarkup(createElement(TextPanel, {reading: reading([layer(), layer({id: 'text-2', title: 'Second'})]),
    request: async () => ({ok: true, reading: null}), disabled: false, apply: async () => ({ok: true, reading: null})}))
  for (const name of ['Page text', 'Text layers in stacking order', 'Show Your words,', 'Small heading', 'Title', 'Italic line',
    'Supporting text', 'Type size', 'Block width', 'Alignment', 'Page X', 'Page Y', 'Move Your words, on the page']) {
    assert.ok(html.includes(`aria-label="${name}"`) || html.includes(`>${name}<`), `${name} is named`)
  }
  assert.match(html, /\+ Add layer/)
  assert.equal(html.includes('role="alert"'), false, 'no fault is shown before an action')
})

test('the Page text panel explains an empty Scene and disables Add when the layer budget is full', () => {
  const empty = renderToStaticMarkup(createElement(TextPanel, {reading: reading([]), request: async () => ({ok: true}), disabled: false,
    apply: async () => ({ok: true})}))
  assert.match(empty, /no text layers/)
  const full = renderToStaticMarkup(createElement(TextPanel, {reading: reading(Array.from({length: TEXT_LAYER_BUDGET},
    (_, index) => layer({id: `t${index}`}))), request: async () => ({ok: true}), disabled: false, apply: async () => ({ok: true})}))
  assert.match(full, /disabled=""[^>]*>\+ Add layer/)
})

test('the Scene panel hosts the Scene editor and the Expression title with its accessible name and disclosure', () => {
  const html = renderToStaticMarkup(createElement(ScenePanel, {reading: reading(), request: async () => ({ok: true}), disabled: false,
    apply: async () => ({ok: true})}))
  assert.match(html, /aria-label="Scene settings"/)
  assert.match(html, /aria-label="Scene clip details"/, 'the existing Scene editor is hosted')
  assert.match(html, /aria-label="Expression title"[^>]*value="Ink study"/)
  assert.match(html, /Expression settings/)
  assert.match(html, /aria-label="Expression description"[^>]*>A study of ink\.<\/textarea>/, 'the description is an editable field, read from the reading')
  assert.match(html, /aria-label="Expression description"[^>]*maxLength="5000"/)
  assert.equal(html.includes('role="alert"'), false, 'no fault is shown before an action')
})

test('the Scene panel discloses an undisclosed description as empty and editable, not as a hidden value', () => {
  const older = reading()
  delete older.scenes.description
  const html = renderToStaticMarkup(createElement(ScenePanel, {reading: older, request: async () => ({ok: true}), disabled: false,
    apply: async () => ({ok: true})}))
  assert.match(html, /aria-label="Expression description"[^>]*><\/textarea>/)
})

test('the Scene panel discloses an undisclosed Scene material rather than a control', () => {
  const html = renderToStaticMarkup(createElement(ScenePanel, {reading: reading([], {scenes: undefined}), request: async () => ({ok: true}),
    disabled: false, apply: async () => ({ok: true})}))
  assert.match(html, /has not disclosed its material/)
  assert.match(html, /aria-label="Expression title"[^>]*disabled=""/)
  assert.match(html, /aria-label="Expression description"[^>]*disabled=""/)
})

test('the expanded pool hosts the scene panel for a scene family and the Field editors for everything else', () => {
  const pick = family => renderToStaticMarkup(createElement(NativeDevicePoolView, {reading: reading([layer()], {devices: withDevices([family])}),
    request: async () => ({ok: true}), requested: {scope: 'field', family, nonce: 1}, isPresented: () => true, busy: false, error: null,
    onAdd: () => {}, onClose: () => {}}))
  const scenePool = pick('scene')
  assert.match(scenePool, /aria-label="Scene panel"/)
  assert.match(scenePool, /aria-label="Expression title"/)
  assert.match(scenePool, /On rack ✓/, 'the add button reports that the device is already on the rack')
  const textPool = pick('text')
  assert.match(textPool, /aria-label="Page text panel"/)
  assert.match(textPool, /aria-label="Page preview"/)
  assert.match(textPool, /\+ Add layer/)
  // A scene request is routed by the family too: scope 'scene' and the older scope 'field' open the same panel.
  const bySceneScope = renderToStaticMarkup(createElement(NativeDevicePoolView, {reading: reading([layer()], {devices: withDevices(['text'])}), request: async () => ({ok: true}),
    requested: {scope: 'scene', family: 'text', nonce: 2}, isPresented: () => true, busy: false, error: null, onAdd: () => {}, onClose: () => {}}))
  assert.equal(bySceneScope, textPool, 'the same panel for scope scene as for scope field')
  assert.match(bySceneScope, /aria-label="Page text panel"/)
  // Field families keep NativeDeviceEditors: sceneFaceView('physics') is null (tested above), and native-device-pool.test.mjs
  // renders the Field editors with a full engine fixture, which this minimal reading does not carry.
})

test('the pool shows the presented-Expression message when a scene device opens with no reading', () => {
  const html = renderToStaticMarkup(createElement(NativeDevicePoolView, {reading: null, request: async () => ({ok: true}),
    requested: {scope: 'field', family: 'text', nonce: 1}, isPresented: () => true, busy: false, error: null, onAdd: () => {}, onClose: () => {}}))
  assert.match(html, /Open a native Expression to see this device/)
})
