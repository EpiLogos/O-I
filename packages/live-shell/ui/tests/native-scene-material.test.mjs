import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'

// Production boundary and desktop owner sources, transpiled in memory. The
// native document is a minimal fixture; no owner, store, server or network is
// simulated. Native execution is NOT claimed here: planners are pure, and the
// receiver is exercised with a fake owner.
const root = new URL('../../../../', import.meta.url)
const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
register(`data:text/javascript,${encodeURIComponent(`import ts from ${JSON.stringify(compiler)};import {readFile} from 'node:fs/promises';
export async function resolve(specifier,context,next){try{return await next(specifier,context)}catch(error){
 if(specifier.startsWith('.')&&specifier.endsWith('.js'))return next(specifier.slice(0,-3)+'.ts',context);
 if(specifier.startsWith('.')&&!/\\.[cm]?[jt]s$/.test(specifier))return next(specifier+'.ts',context);throw error;}}
export async function load(url,context,next){if(url.endsWith('.css'))return {format:'module',shortCircuit:true,source:'export {}'};if(!url.endsWith('.ts')&&!url.endsWith('.tsx'))return next(url,context);
 return {format:'module',shortCircuit:true,source:ts.transpileModule(await readFile(new URL(url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX},fileName:new URL(url).pathname}).outputText};}`)}`, import.meta.url)

const author = new URL('desktop/cradle/expressions-app/field-studies-journeys/src/', root)
const [sceneMaterial, {blankJourney, clone}, {kernelDocumentToJourney}, {prepareCompositionEdit}, {installNativeEditorReceiver}, {EDITOR_CHANNEL}] = await Promise.all([
  import(new URL('packages/expressions-boundary/src/sceneMaterialEdits.ts', root)),
  import(new URL('model.ts', author)),
  import(new URL('kernelDocumentBridge.ts', author)),
  import(new URL('kernelComposition.ts', author)),
  import(new URL('hostEditor.ts', author)),
  import(new URL('packages/expressions-boundary/src/editor.ts', root)),
])
const {
  applyNativeSceneTextChanges, validateTextLayerValues, prepareNativeSceneMaterialEdit,
  SCENE_BODY_CARRIERS, SCENE_BODY_PRESENTATIONS, SCENE_BODY_CAPABILITY_STATES, TRIGGER_OCCASIONS,
  TRIGGER_TARGET_KINDS, PORTAL_PLACEMENTS, TRIGGER_OPERATIONS, TEXT_LAYER_BUDGET, MAX_TRIGGERS_PER_SCENE, MAX_SPAN,
} = sceneMaterial

const EXPR = 'expression:whole'
const SCENE = 'expression:whole:scene:main'
const OTHER = 'expression:whole:scene:second'
const NOTES = 'native:file:notes'

// Kernel-shaped native body (expression_carrier.rs SceneBody), as a host would read it.
const TEXT_BODY = {
  carrier: 'text_source', subject_ref: NOTES, native_owner: 'central.files',
  reading: {ref: NOTES, revision: 'r1', availability: 'available'}, provenance: [],
  actions: [{action_ref: 'action:open', target_ref: NOTES, authority_requirement: 'central.files.read'}],
  presentation: 'inline', capability: {state: 'renderable'}, span: null, recursion: null,
}
const navigate = scene_ref => ({kind: 'navigate', scene_ref})

function seed({body = null, triggers = []} = {}) {
  const journey = blankJourney()
  journey.name = 'A working inquiry'
  journey.scenes[0].name = 'First'
  const document = {schema: 'oi.expression/v1', expression_ref: EXPR, revision: 1, title: journey.name,
    scenes: [
      {scene_ref: SCENE, revision: 1, title: 'Main', entity_refs: [], body, triggers},
      {scene_ref: OTHER, revision: 1, title: 'Second', entity_refs: [], body: null, triggers: []},
    ],
    entities: {}, relations: {}, selection: {scene_ref: SCENE, entity_ref: null}, provenance: [], representations: [], refinements: []}
  return kernelDocumentToJourney(document, {identity: {expression: journey.id, scenes: {[SCENE]: journey.scenes[0].id}}})
}
const basis = (view, scene_ref = SCENE, over = {}) => ({expression_ref: EXPR, revision: view.document.revision, scene_ref, authored_revision: 0, ...over})
const bodySet = (body) => ({family: 'body', body: {operation: 'set', ...body}})
const triggerAttach = (fields) => ({family: 'trigger', trigger: {operation: 'attach', trigger_id: 'jump-1', occasion: 'select', target: navigate(OTHER), ...fields}})

// ——— Page text layers (apply → commit → scene_material_set) ———
test('text add appends one layer with the app default block and no native role', () => {
  const view = seed()
  const sceneId = view.journey.scenes[0].id
  const before = view.journey.scenes[0].text.length
  const next = applyNativeSceneTextChanges(view.journey, sceneId, [{kind: 'text-layer-add'}])
  const layers = next.scenes[0].text
  assert.equal(layers.length, before + 1)
  const added = layers.at(-1)
  assert.deepEqual({...added, id: 'x'}, {id: 'x', visible: true, kicker: 'A MOMENT IN THE FIELD', title: 'Your words,', italic: 'in this space.', body: '', x: 0.07, y: 0.24, width: 240, size: 38, align: 'left'})
  assert.equal('role' in added, false)
  assert.equal(view.journey.scenes[0].text.length, before, 'the presented working Journey is not mutated')
})

test('text layers are budgeted at the kernel limit of sixteen', () => {
  const view = seed()
  const sceneId = view.journey.scenes[0].id
  let journey = view.journey
  while (journey.scenes[0].text.length < TEXT_LAYER_BUDGET) journey = applyNativeSceneTextChanges(journey, sceneId, [{kind: 'text-layer-add'}])
  assert.equal(journey.scenes[0].text.length, 16)
  assert.throws(() => applyNativeSceneTextChanges(journey, sceneId, [{kind: 'text-layer-add'}]), /supports 16 text layers/)
})

test('text set accepts every inspector bound and refuses values just outside it', () => {
  const at = values => validateTextLayerValues(values)
  assert.deepEqual(at({size: 14, width: 60, x: -0.5, y: 1.5, align: 'right', visible: false}), {size: 14, width: 60, x: -0.5, y: 1.5, align: 'right', visible: false})
  assert.deepEqual(at({size: 150, width: 1000}), {size: 150, width: 1000})
  for (const bad of [{size: 13.9}, {size: 151}, {width: 59}, {width: 1001}, {x: -0.6}, {y: 1.6}, {size: NaN}, {size: Infinity}, {size: '38'}])
    assert.throws(() => at(bad), /must be between|must be text|text of/, JSON.stringify(bad))
  assert.throws(() => at({align: 'justify'}), /left, center or right/)
  assert.throws(() => at({visible: 'yes'}), /yes or no/)
})

test('text string limits follow the inspector maxlength; body allows newlines but single lines do not', () => {
  assert.throws(() => validateTextLayerValues({title: 'x'.repeat(301)}), /at most 300/)
  assert.throws(() => validateTextLayerValues({kicker: 'x'.repeat(301)}), /at most 300/)
  assert.throws(() => validateTextLayerValues({italic: 'x'.repeat(301)}), /at most 300/)
  assert.equal(validateTextLayerValues({body: 'x'.repeat(5000)}).body.length, 5000)
  assert.throws(() => validateTextLayerValues({body: 'x'.repeat(5001)}), /at most 5000/)
  assert.equal(validateTextLayerValues({body: 'line one\nline two'}).body, 'line one\nline two')
  assert.throws(() => validateTextLayerValues({title: 'line one\nline two'}), /without control characters/)
})

test('text set refuses unknown and native-only fields, empty sets and non-object values', () => {
  assert.throws(() => validateTextLayerValues({role: 'caption'}), /Unsupported text layer field: role/)
  assert.throws(() => validateTextLayerValues({id: 'other'}), /Unsupported text layer field: id/)
  assert.throws(() => validateTextLayerValues({}), /at least one/)
  assert.throws(() => validateTextLayerValues(null), /one object/)
  assert.throws(() => validateTextLayerValues(['title']), /one object/)
})

test('text remove deletes exactly the named layer and refuses an absent one', () => {
  const view = seed()
  const sceneId = view.journey.scenes[0].id
  const added = applyNativeSceneTextChanges(view.journey, sceneId, [{kind: 'text-layer-add'}, {kind: 'text-layer-add'}])
  const layers = added.scenes[0].text
  assert.equal(layers.length, 2)
  const target = layers[0].id
  const next = applyNativeSceneTextChanges(added, sceneId, [{kind: 'text-layer-remove', layer_id: target}])
  assert.equal(next.scenes[0].text.length, 1)
  assert.equal(next.scenes[0].text.some(layer => layer.id === target), false)
  assert.throws(() => applyNativeSceneTextChanges(added, sceneId, [{kind: 'text-layer-remove', layer_id: 'absent'}]), /no longer exists/)
})

test('a text set edits only its named layer, and prepareCompositionEdit commits the layers as scene_material_set', () => {
  const view = seed()
  const sceneId = view.journey.scenes[0].id
  // The blank Scene holds no text layers; the native baseline is the captured view.
  assert.equal(view.journey.scenes[0].text.length, 0)
  const staged = applyNativeSceneTextChanges(view.journey, sceneId, [{kind: 'text-layer-add'}, {kind: 'text-layer-add'}])
  const first = staged.scenes[0].text[0].id
  const working = applyNativeSceneTextChanges(staged, sceneId, [
    {kind: 'text-layer-set', layer_id: first, values: {title: 'Changed', size: 52, align: 'center', x: 0.5}},
  ])
  const edit = prepareCompositionEdit(view, working, {sceneId})
  const materials = edit.changes.filter(change => change.change === 'scene_material_set')
  assert.equal(materials.length, 1, 'one composition diff emits one scene material for the edited Scene')
  assert.equal(materials[0].scene_ref, SCENE)
  const layers = materials[0].presentation.scene.text
  assert.equal(layers.length, 2)
  assert.deepEqual(layers, working.scenes[0].text, 'the committed material carries exactly the working layers')
  assert.equal(layers[0].title, 'Changed')
  assert.equal(layers[0].size, 52)
  assert.equal(layers[1].title, 'Your words,')
  assert.equal(layers[1].size, 38)
})

// ——— Scene body (scene_body_set / scene_body_clear, one editConnections request) ———
test('body vocabulary is the kernel grammar: nine carriers, four presentations, three capability states', () => {
  assert.deepEqual([...SCENE_BODY_CARRIERS], ['engine_composition', 'text_source', 'glyph_form', 'image_media', 'file_thing', 'knowledge_whole', 'html_surface', 'agent_surface', 'expression_ref'])
  assert.deepEqual([...SCENE_BODY_PRESENTATIONS], ['live', 'inline', 'preview', 'degraded'])
  assert.deepEqual([...SCENE_BODY_CAPABILITY_STATES], ['renderable', 'degrades_to_thing', 'unavailable'])
  assert.equal(MAX_SPAN, 8_000_000)
})

test('body clear emits scene_body_clear at the captured revision, and nothing when no body is set', () => {
  const withBody = seed({body: TEXT_BODY})
  const plan = prepareNativeSceneMaterialEdit(withBody, basis(withBody), {family: 'body', body: {operation: 'clear'}})
  assert.deepEqual(plan.changes, [{change: 'scene_body_clear', scene_ref: SCENE}])
  assert.deepEqual(plan.basis, {expression_ref: EXPR, revision: 1, scene_ref: SCENE})
  const bare = seed()
  assert.deepEqual(prepareNativeSceneMaterialEdit(bare, basis(bare), {family: 'body', body: {operation: 'clear'}}).changes, [])
})

test('body set text_source carries the host-resolved reading and its exact span', () => {
  const view = seed()
  const resolved = {...TEXT_BODY, span: {start: 0, end: 120}}
  const plan = prepareNativeSceneMaterialEdit(view, basis(view), bodySet({carrier: 'text_source', subject_ref: NOTES, span: {start: 0, end: 120}}), resolved)
  assert.deepEqual(plan.changes, [{change: 'scene_body_set', scene_ref: SCENE, body: resolved}])
  assert.equal(plan.basis.revision, view.document.revision)
})

test('body set refuses a stale revision, a carrier or subject the resolution does not name, and a span mismatch', () => {
  const view = seed()
  const intent = bodySet({carrier: 'text_source', subject_ref: NOTES, span: null})
  assert.throws(() => prepareNativeSceneMaterialEdit(view, basis(view, SCENE, {revision: 0}), intent, TEXT_BODY), /revision changed; nothing was written/)
  assert.throws(() => prepareNativeSceneMaterialEdit(view, basis(view), intent, {...TEXT_BODY, carrier: 'image_media'}), /different subject or carrier/)
  assert.throws(() => prepareNativeSceneMaterialEdit(view, basis(view), intent, {...TEXT_BODY, subject_ref: 'native:file:other'}), /different subject or carrier/)
  assert.throws(() => prepareNativeSceneMaterialEdit(view, basis(view), intent, {...TEXT_BODY, span: {start: 0, end: 4}}), /span or recursion/)
  assert.throws(() => prepareNativeSceneMaterialEdit(view, basis(view), intent), /Resolve the exact native reading/)
})

test('body set refuses span on a non-text carrier, extra operands and reversed or oversized spans', () => {
  const view = seed()
  assert.throws(() => prepareNativeSceneMaterialEdit(view, basis(view), bodySet({carrier: 'image_media', subject_ref: NOTES, span: {start: 0, end: 4}}), {...TEXT_BODY, carrier: 'image_media'}), /Unsupported Scene body operand/)
  assert.throws(() => prepareNativeSceneMaterialEdit(view, basis(view), bodySet({carrier: 'text_source', subject_ref: NOTES}), TEXT_BODY), /span or null/)
  assert.throws(() => prepareNativeSceneMaterialEdit(view, basis(view), bodySet({carrier: 'text_source', subject_ref: NOTES, span: {start: 9, end: 3}}), TEXT_BODY), /bounded nonempty range/)
  assert.throws(() => prepareNativeSceneMaterialEdit(view, basis(view), bodySet({carrier: 'text_source', subject_ref: NOTES, span: {start: 0, end: MAX_SPAN + 1}}), TEXT_BODY), /bounded nonempty range/)
})

test('expression_ref bodies need an Expression ref and a recursion depth 1..4 on this host', () => {
  const view = seed()
  const resolved = {...TEXT_BODY, carrier: 'expression_ref', subject_ref: 'expression:other', native_owner: 'expressions', presentation: 'inline', capability: {state: 'renderable'}, span: null, actions: [],
    recursion: {host_expression_ref: EXPR, max_depth: 2}}
  const plan = prepareNativeSceneMaterialEdit(view, basis(view), bodySet({carrier: 'expression_ref', subject_ref: 'expression:other', max_depth: 2}), resolved)
  assert.equal(plan.changes[0].body.recursion.max_depth, 2)
  assert.throws(() => prepareNativeSceneMaterialEdit(view, basis(view), bodySet({carrier: 'expression_ref', subject_ref: 'expression:other', max_depth: 5}), resolved), /within 1\.\.=4/)
  assert.throws(() => prepareNativeSceneMaterialEdit(view, basis(view), bodySet({carrier: 'expression_ref', subject_ref: NOTES, max_depth: 2}), resolved), /Expression or Edition ref/)
  assert.throws(() => prepareNativeSceneMaterialEdit(view, basis(view), bodySet({carrier: 'expression_ref', subject_ref: 'expression:other', max_depth: 2}), {...resolved, recursion: {host_expression_ref: 'expression:elsewhere', max_depth: 2}}), /differs from the requested span or recursion/)
})

test('native carriers keep native subjects; Expression, Edition and asset refs are refused for them', () => {
  const view = seed()
  for (const subject of ['expression:whole', 'edition:x', 'asset:y'])
    assert.throws(() => prepareNativeSceneMaterialEdit(view, basis(view), bodySet({carrier: 'file_thing', subject_ref: subject}), {...TEXT_BODY, carrier: 'file_thing', subject_ref: subject}), /remain native/)
})

test('engine_composition is this Expression live and renderable; the honest presentation matrix is enforced', () => {
  const view = seed()
  const live = {...TEXT_BODY, carrier: 'engine_composition', subject_ref: EXPR, presentation: 'live', capability: {state: 'renderable'}, span: null, recursion: null, actions: []}
  const plan = prepareNativeSceneMaterialEdit(view, basis(view), {family: 'body', body: {operation: 'set', carrier: 'engine_composition'}}, live)
  assert.equal(plan.changes[0].change, 'scene_body_set')
  assert.throws(() => prepareNativeSceneMaterialEdit(view, basis(view), {family: 'body', body: {operation: 'set', carrier: 'engine_composition'}}, {...live, presentation: 'preview'}), /live rendered composition/)
  // A live presentation may not claim a degraded capability.
  assert.throws(() => prepareNativeSceneMaterialEdit(view, basis(view), bodySet({carrier: 'text_source', subject_ref: NOTES, span: null}), {...TEXT_BODY, capability: {state: 'degrades_to_thing', reason: 'no renderer'}}), /presentation must match disclosed capability/)
  // Degraded bodies carry the honest reason; a blank reason is refused.
  assert.throws(() => prepareNativeSceneMaterialEdit(view, basis(view), bodySet({carrier: 'text_source', subject_ref: NOTES, span: null}), {...TEXT_BODY, presentation: 'degraded', capability: {state: 'degrades_to_thing', reason: '  '}}), /capability reason/)
})

// ——— Jump triggers (scene_trigger_attach / scene_trigger_detach) ———
test('trigger vocabulary is the kernel grammar: five occasions, four target kinds, six placements, three operations', () => {
  assert.deepEqual([...TRIGGER_OCCASIONS], ['scene_enter', 'scene_leave', 'activate', 'select', 'sequence_transition'])
  assert.deepEqual([...TRIGGER_TARGET_KINDS], ['expression_operation', 'portal', 'native_action', 'navigate'])
  assert.deepEqual([...PORTAL_PLACEMENTS], ['preview', 'overlay', 'beside', 'full', 'detached', 're_dock'])
  assert.deepEqual([...TRIGGER_OPERATIONS], ['inspect', 'list', 'export'])
  assert.equal(MAX_TRIGGERS_PER_SCENE, 8)
})

test('attach navigate emits the exact scene_trigger_attach at the captured revision', () => {
  const view = seed()
  const plan = prepareNativeSceneMaterialEdit(view, basis(view), triggerAttach({}))
  assert.deepEqual(plan.changes, [{change: 'scene_trigger_attach', scene_ref: SCENE,
    trigger: {trigger_ref: `${EXPR}:trigger:jump-1`, occasion: 'select', target: {kind: 'navigate', scene_ref: OTHER}}}])
  assert.equal(plan.basis.revision, 1)
})

test('every trigger occasion is accepted and an unknown occasion is refused', () => {
  const view = seed()
  for (const occasion of TRIGGER_OCCASIONS)
    assert.equal(prepareNativeSceneMaterialEdit(view, basis(view), triggerAttach({occasion})).changes[0].trigger.occasion, occasion)
  assert.throws(() => prepareNativeSceneMaterialEdit(view, basis(view), triggerAttach({occasion: 'open'})), /Unknown trigger occasion/)
})

test('trigger ids are bounded refs; duplicates and absent detaches are refused', () => {
  const view = seed({triggers: [{trigger_ref: `${EXPR}:trigger:taken`, occasion: 'select', target: navigate(OTHER)}]})
  assert.throws(() => prepareNativeSceneMaterialEdit(view, basis(view), triggerAttach({trigger_id: 'bad id'})), /Trigger ids are/)
  assert.throws(() => prepareNativeSceneMaterialEdit(view, basis(view), triggerAttach({trigger_id: 'x'.repeat(129)})), /Trigger ids are/)
  assert.throws(() => prepareNativeSceneMaterialEdit(view, basis(view), triggerAttach({trigger_id: 'taken'})), /already exists/)
  assert.deepEqual(prepareNativeSceneMaterialEdit(view, basis(view), {family: 'trigger', trigger: {operation: 'detach', trigger_ref: `${EXPR}:trigger:taken`}}).changes,
    [{change: 'scene_trigger_detach', trigger_ref: `${EXPR}:trigger:taken`}])
  assert.throws(() => prepareNativeSceneMaterialEdit(view, basis(view), {family: 'trigger', trigger: {operation: 'detach', trigger_ref: `${EXPR}:trigger:none`}}), /not on this Scene/)
})

test('the trigger budget refuses a ninth trigger on one Scene', () => {
  const full = Array.from({length: 8}, (_, i) => ({trigger_ref: `${EXPR}:trigger:t${i}`, occasion: 'select', target: navigate(OTHER)}))
  const view = seed({triggers: full})
  assert.throws(() => prepareNativeSceneMaterialEdit(view, basis(view), triggerAttach({})), /budget exceeded/)
})

test('navigate needs a scene or entity that exists; an entity must lie in its named scene', () => {
  const view = seed()
  assert.throws(() => prepareNativeSceneMaterialEdit(view, basis(view), triggerAttach({target: {kind: 'navigate'}})), /must name a scene or entity/)
  assert.throws(() => prepareNativeSceneMaterialEdit(view, basis(view), triggerAttach({target: navigate('expression:whole:scene:none')})), /absent scene/)
  assert.throws(() => prepareNativeSceneMaterialEdit(view, basis(view), triggerAttach({target: {kind: 'navigate', entity_ref: 'expression:whole:entity:e'}})), /absent entity/)
})

test('expression_operation accepts only inspect, list or export over an Expression ref', () => {
  const view = seed()
  const ok = prepareNativeSceneMaterialEdit(view, basis(view), triggerAttach({target: {kind: 'expression_operation', operation: 'inspect', expression_ref: 'expression:other'}}))
  assert.deepEqual(ok.changes[0].trigger.target, {kind: 'expression_operation', operation: 'inspect', expression_ref: 'expression:other'})
  assert.throws(() => prepareNativeSceneMaterialEdit(view, basis(view), triggerAttach({target: {kind: 'expression_operation', operation: 'delete', expression_ref: 'expression:other'}})), /inspect, list or export/)
  assert.throws(() => prepareNativeSceneMaterialEdit(view, basis(view), triggerAttach({target: {kind: 'expression_operation', operation: 'list', expression_ref: 'native:x'}})), /valid Expression ref/)
})

test('portal placements are the kernel serde names and the subject must be disclosed on this Scene', () => {
  const view = seed({body: TEXT_BODY})
  const portal = (placement, subject_ref = NOTES) => triggerAttach({target: {kind: 'portal', placement, subject_ref}})
  assert.equal(prepareNativeSceneMaterialEdit(view, basis(view), portal('re_dock')).changes[0].trigger.target.placement, 're_dock')
  assert.throws(() => prepareNativeSceneMaterialEdit(view, basis(view), portal('re-dock')), /Unknown portal placement/)
  assert.throws(() => prepareNativeSceneMaterialEdit(view, basis(view), portal('full', 'native:file:undisclosed')), /must be disclosed/)
})

test('native_action is accepted only when the Action is disclosed on a bound subject or body', () => {
  const view = seed({body: TEXT_BODY})
  const action = (action_ref, target_ref = NOTES) => triggerAttach({target: {kind: 'native_action', action_ref, target_ref, authority_requirement: 'central.files.read'}})
  assert.deepEqual(prepareNativeSceneMaterialEdit(view, basis(view), action('action:open')).changes[0].trigger.target,
    {kind: 'native_action', action_ref: 'action:open', target_ref: NOTES, authority_requirement: 'central.files.read'})
  assert.throws(() => prepareNativeSceneMaterialEdit(view, basis(view), action('action:delete')), /must be disclosed/)
})

test('a planner rejects an unknown family, unknown operands and an absent Scene ref', () => {
  const view = seed()
  assert.throws(() => prepareNativeSceneMaterialEdit(view, basis(view), {family: 'script', body: {operation: 'clear'}}), /Unsupported native Scene material family/)
  assert.throws(() => prepareNativeSceneMaterialEdit(view, basis(view), {family: 'body', body: {operation: 'clear', extra: 1}}), /Unsupported Scene body operand/)
  assert.throws(() => prepareNativeSceneMaterialEdit(view, basis(view, 'expression:whole:scene:none')), /exact captured native Scene ref/)
})

// ——— Routing: scene-material reaches the owner once, behind the captured basis ———
const ORIGIN = 'https://shell.test'
function harness(owner) {
  const replies = []
  let listener = null
  const target = {location: {origin: ORIGIN}, addEventListener(type, fn) {if (type === 'message') listener = fn}, removeEventListener() {listener = null},
    parent: {postMessage(data) {replies.push(data)}}}
  const receiver = installNativeEditorReceiver(owner, target)
  const send = async (req, request) => {
    listener({source: target.parent, origin: ORIGIN, data: {schema: EDITOR_CHANNEL, kind: 'request', token: 't', bindingId: 'b', epoch: 0, req, request}})
    await new Promise(resolve => setTimeout(resolve, 0))
    return replies.at(-1).reply
  }
  return {send, receiver}
}
function fakeOwner(withMaterial = true) {
  const reading = {basis: {expression_ref: EXPR, revision: 1, scene_ref: SCENE, authored_revision: 0}, scene: {}, entityOccurrences: {},
    chosenControls: {available: false, entries: [], controls: []}, devices: [], selection: {entity_ids: [], step_id: null},
    history: {canUndo: false, canRedo: false}, standing: {dirty: false, pending: false, notice: null}}
  const calls = []
  const owner = {read: () => reading, transactionOpen: () => false, apply: async () => {}, select: async () => {}, selectField: async () => {},
    scene: async () => {}, editScenes: async () => {}, open: async () => {}, history: async () => {}, save: async () => {}}
  if (withMaterial) owner.sceneMaterial = async (request, isCurrent) => {calls.push({request, current: isCurrent()})}
  return {owner, reading, calls}
}

test('scene-material reaches the owner once with the captured basis and the exact intent', async () => {
  const {owner, reading, calls} = fakeOwner()
  const {send, receiver} = harness(owner)
  try {
    await send('read', {operation: 'read'})
    const reply = await send('material-1', {operation: 'scene-material', basis: reading.basis, intent: triggerAttach({})})
    assert.equal(reply.ok, true)
    assert.equal(calls.length, 1)
    assert.equal(calls[0].current, true)
    assert.deepEqual(calls[0].request.intent, triggerAttach({}))
  } finally {receiver.dispose()}
})

test('scene-material with a stale captured revision is refused before the owner is entered', async () => {
  const {owner, reading, calls} = fakeOwner()
  const {send, receiver} = harness(owner)
  try {
    await send('read', {operation: 'read'})
    const reply = await send('material-2', {operation: 'scene-material', basis: {...reading.basis, revision: 2}, intent: triggerAttach({})})
    assert.equal(reply.ok, false)
    assert.match(reply.error, /captured scene|authoring revision/)
    assert.equal(calls.length, 0)
  } finally {receiver.dispose()}
})

test('scene-material is refused, not dropped, when the retained editor has no Scene material receiver', async () => {
  const {owner, reading} = fakeOwner(false)
  const {send, receiver} = harness(owner)
  try {
    await send('read', {operation: 'read'})
    const reply = await send('material-3', {operation: 'scene-material', basis: reading.basis, intent: triggerAttach({})})
    assert.equal(reply.ok, false)
    assert.match(reply.error, /no Scene material receiver/)
  } finally {receiver.dispose()}
})
