import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'
import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'

// Production modules in memory: .ts/.tsx transpiled, CSS stubbed, and @epilogos/expressions-boundary/<name> resolved to the boundary source.
// No owner, store, server or browser is simulated: the receiver is mirrored over the pure planner, and the panel is rendered (SSR) only.
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

const materials = await import(new URL('packages/expressions-boundary/src/sceneMaterialEdits.ts', root))
const models = await import('../src/components/nativeSceneFaceModel.ts')
const registry = await import('../src/components/nativeSceneFaceViews.tsx')
const device = await import('../src/components/nativeSceneFace.body.ts')
const {BodyPanel} = await import('../src/components/NativeSceneFace.body.tsx')
const {
  prepareNativeSceneMaterialEdit, sceneMaterialReadRequirement, TRIGGER_OCCASIONS, TRIGGER_TARGET_KINDS, PORTAL_PLACEMENTS, SCENE_BODY_CARRIERS,
  SCENE_BODY_HOST_CARRIERS, SCENE_BODY_PRESENTATIONS, MAX_TRIGGERS_PER_SCENE,
} = materials
const {
  bodyClearIntent, bodySetIntent, bodySummary, bodyFaceModel, carrierOptions, newTriggerId, presentationProblem, triggerAttachIntent, triggerContext,
  triggerDetachIntent, triggerKindProblem, triggerTargetLabel,
} = device

const EXPR = 'expression:whole'
const SCENE = 'expression:whole:scene:main'
const OTHER = 'expression:whole:scene:second'
const NOTES = 'Project/notes.md'
const ARTWORK = 'Project/artwork.png'
const ACTION = {action_ref: 'action:open-notes', target_ref: NOTES, authority_requirement: 'central.files.read'}
const navigate = scene_ref => ({kind: 'navigate', scene_ref})
const trigger = (id, occasion, target) => ({trigger_ref: `${EXPR}:trigger:${id}`, occasion, target})

// A host-resolved body, shaped as bodyFromNativeReading (nativeSceneBody.ts) returns it: inline, renderable, the reading's own revision.
const textBody = (over = {}) => ({carrier: 'text_source', subject_ref: NOTES, native_owner: 'central', reading: {ref: NOTES, revision: 'r1', availability: 'available'},
  provenance: [{ref: NOTES, revision: 'r1', availability: 'available'}], actions: [ACTION], presentation: 'inline', capability: {state: 'renderable'},
  span: null, recursion: null, ...over})
const imageBody = () => ({carrier: 'image_media', subject_ref: ARTWORK, native_owner: 'central', reading: {ref: ARTWORK, revision: 'a1', availability: 'available'},
  provenance: [{ref: ARTWORK, revision: 'a1', availability: 'available'}], actions: [], presentation: 'inline', capability: {state: 'renderable'}, span: null, recursion: null})

// The minimal native view the planner reads: the flushed document and its bindings. Body and triggers live on the Scene.
function view({body = null, triggers = []} = {}) {
  const document = {schema: 'oi.expression/v1', expression_ref: EXPR, revision: 4, title: 'Whole', entities: {}, relations: {}, provenance: [],
    representations: [], refinements: [], selection: null,
    scenes: [{scene_ref: SCENE, revision: 1, title: 'Main', entity_refs: [], body, triggers}, {scene_ref: OTHER, revision: 1, title: 'Second', entity_refs: [], body: null, triggers: []}]}
  return {document, journey: {id: 'journey'}, notes: [], bindings: {
    'scene-main': {scene_ref: SCENE, body, triggers, occurrences: [], relations: []},
    'scene-second': {scene_ref: OTHER, body: null, triggers: []},
  }}
}
const basis = (current, scene_ref = SCENE) => ({expression_ref: EXPR, revision: current.document.revision, scene_ref, authored_revision: 0})
// The reading the shell receives: nativeScene is hostEditor's disclosure of the presented Scene's body and triggers.
function reading(current, {body = null, triggers = []} = {}) {
  return {basis: basis(current), nativeScene: {scene_ref: SCENE, body, triggers}, scenes: {scenes: [{scene_ref: SCENE, title: 'Main'}, {scene_ref: OTHER, title: 'Second'}]},
    standing: {busy: false, pending: false, notice: null}, scene: {name: 'Main', duration: 6, transition: 1, text: [], entities: []}}
}

// ---- Boundary: the read gate, the planner and the trigger grammar ----

test('the body gate names every carrier the host cannot resolve, and reads only text and image', () => {
  assert.deepEqual([...SCENE_BODY_HOST_CARRIERS], ['text_source', 'image_media'])
  assert.deepEqual(sceneMaterialReadRequirement({family: 'body', body: {operation: 'clear'}}), {kind: 'none'})
  assert.deepEqual(sceneMaterialReadRequirement({family: 'trigger', trigger: {operation: 'detach', trigger_ref: 'x'}}), {kind: 'none'})
  assert.deepEqual(sceneMaterialReadRequirement({family: 'body', body: {operation: 'set', carrier: 'text_source', subject_ref: NOTES, span: {start: 1, end: 4}}}),
    {kind: 'read', carrier: 'text_source', subject_ref: NOTES, span: {start: 1, end: 4}})
  assert.deepEqual(sceneMaterialReadRequirement({family: 'body', body: {operation: 'set', carrier: 'text_source', subject_ref: NOTES, span: null}}),
    {kind: 'read', carrier: 'text_source', subject_ref: NOTES, span: null})
  assert.deepEqual(sceneMaterialReadRequirement({family: 'body', body: {operation: 'set', carrier: 'image_media', subject_ref: ARTWORK}}),
    {kind: 'read', carrier: 'image_media', subject_ref: ARTWORK, span: null})
  for (const carrier of SCENE_BODY_CARRIERS.filter(c => c !== 'engine_composition' && !SCENE_BODY_HOST_CARRIERS.includes(c))) {
    const gate = sceneMaterialReadRequirement({family: 'body', body: {operation: 'set', carrier, subject_ref: 'Project/thing'}})
    assert.deepEqual(gate, {kind: 'refuse', problem: `This carrier has no host resolver yet: ${carrier}`}, carrier)
  }
  assert.match(sceneMaterialReadRequirement({family: 'body', body: {operation: 'set', carrier: 'engine_composition'}}).problem, /Clear body/)
  assert.match(sceneMaterialReadRequirement({family: 'body', body: {operation: 'set', carrier: 'text_source', subject_ref: 'expression:other', span: null}}).problem, /remain native/)
  assert.match(sceneMaterialReadRequirement({family: 'body', body: {operation: 'set', carrier: 'image_media', subject_ref: ARTWORK, span: {start: 0, end: 2}}}).problem, /Unsupported Scene body operand/)
  assert.match(sceneMaterialReadRequirement({family: 'body', body: {operation: 'set', carrier: 'text_source', subject_ref: NOTES}}).problem, /span or null/)
  assert.match(sceneMaterialReadRequirement({family: 'body', body: {operation: 'set', carrier: 'text_source', subject_ref: NOTES, span: {start: 5, end: 2}}}).problem, /bounded nonempty range/)
  assert.match(sceneMaterialReadRequirement({family: 'body', body: {operation: 'set', carrier: 'bogus', subject_ref: NOTES}}).problem, /Unknown native Scene body carrier/)
})

test('the planner applies an admitted presentation and refuses one the disclosed capability does not carry', () => {
  const current = view()
  const set = (presentation, carrier = 'text_source') => ({family: 'body', body: {operation: 'set', carrier, subject_ref: NOTES, span: null, presentation}})
  const live = prepareNativeSceneMaterialEdit(current, basis(current), set('live'), textBody())
  assert.equal(live.changes[0].change, 'scene_body_set')
  assert.equal(live.changes[0].body.presentation, 'live')
  assert.equal(prepareNativeSceneMaterialEdit(current, basis(current), set('preview'), textBody()).changes[0].body.presentation, 'preview')
  assert.throws(() => prepareNativeSceneMaterialEdit(current, basis(current), set('degraded'), textBody()), /presentation must match disclosed capability/)
  assert.throws(() => prepareNativeSceneMaterialEdit(current, basis(current), set('sideways'), textBody()), /Unknown Scene body presentation/)
  assert.equal(SCENE_BODY_PRESENTATIONS.length, 4)
})

test('each trigger occasion and target kind plans exactly one scene_trigger_attach with the admitted target', () => {
  assert.deepEqual([...TRIGGER_OCCASIONS], ['scene_enter', 'scene_leave', 'activate', 'select', 'sequence_transition'])
  assert.deepEqual([...TRIGGER_TARGET_KINDS], ['expression_operation', 'portal', 'native_action', 'navigate'])
  assert.deepEqual([...PORTAL_PLACEMENTS], ['preview', 'overlay', 'beside', 'full', 'detached', 're_dock'])
  const current = view({body: textBody()})
  const targets = [
    {kind: 'expression_operation', operation: 'inspect', expression_ref: EXPR},
    {kind: 'portal', placement: 're_dock', subject_ref: NOTES},
    {kind: 'native_action', action_ref: ACTION.action_ref, target_ref: NOTES, authority_requirement: ACTION.authority_requirement},
    navigate(OTHER),
  ]
  let n = 0
  for (const occasion of TRIGGER_OCCASIONS) for (const target of targets) {
    const id = `t-${n++}`
    const plan = prepareNativeSceneMaterialEdit(current, basis(current), {family: 'trigger', trigger: {operation: 'attach', trigger_id: id, occasion, target}})
    assert.equal(plan.changes.length, 1)
    assert.equal(plan.changes[0].change, 'scene_trigger_attach')
    assert.equal(plan.changes[0].scene_ref, SCENE)
    assert.deepEqual(plan.changes[0].trigger, {trigger_ref: `${EXPR}:trigger:${id}`, occasion, target})
  }
  for (const placement of PORTAL_PLACEMENTS) {
    const plan = prepareNativeSceneMaterialEdit(current, basis(current), {family: 'trigger', trigger: {operation: 'attach', trigger_id: `p-${placement}`, occasion: 'activate',
      target: {kind: 'portal', placement, subject_ref: NOTES}}})
    assert.equal(plan.changes[0].trigger.target.placement, placement)
  }
})

test('the planner refuses an undisclosed Action, an undisclosed portal subject, a missing jump target and a full budget', () => {
  const current = view({body: textBody()})
  const attach = (id, target) => ({family: 'trigger', trigger: {operation: 'attach', trigger_id: id, occasion: 'select', target}})
  assert.throws(() => prepareNativeSceneMaterialEdit(current, basis(current), attach('a', {kind: 'native_action', action_ref: 'action:other', target_ref: NOTES, authority_requirement: 'x'})),
    /must be disclosed on a bound subject or scene body/)
  assert.throws(() => prepareNativeSceneMaterialEdit(current, basis(current), attach('b', {kind: 'portal', placement: 'full', subject_ref: 'Project/other.md'})),
    /Portal trigger subject must be disclosed/)
  assert.throws(() => prepareNativeSceneMaterialEdit(current, basis(current), attach('c', {kind: 'navigate', scene_ref: 'expression:whole:scene:absent'})),
    /Navigate trigger names an absent scene/)
  assert.throws(() => prepareNativeSceneMaterialEdit(current, basis(current), attach('d', {kind: 'expression_operation', operation: 'write', expression_ref: EXPR})),
    /never mutate documents/)
  const full = view({body: textBody(), triggers: Array.from({length: MAX_TRIGGERS_PER_SCENE}, (_, i) => trigger(`full-${i}`, 'select', navigate(OTHER)))})
  assert.throws(() => prepareNativeSceneMaterialEdit(full, basis(full), attach('e', navigate(OTHER))), /Scene trigger budget exceeded/)
  const withOne = view({body: textBody(), triggers: [trigger('kept', 'select', navigate(OTHER))]})
  const detach = prepareNativeSceneMaterialEdit(withOne, basis(withOne), triggerDetachIntent(`${EXPR}:trigger:kept`))
  assert.deepEqual(detach.changes, [{change: 'scene_trigger_detach', trigger_ref: `${EXPR}:trigger:kept`}])
  assert.throws(() => prepareNativeSceneMaterialEdit(withOne, basis(withOne), triggerDetachIntent(`${EXPR}:trigger:absent`)), /not on this Scene/)
})

test('a body set or clear is one planned change on the captured basis; a stale or foreign basis writes nothing', () => {
  const current = view()
  const clear = prepareNativeSceneMaterialEdit(view({body: textBody()}), basis(view({body: textBody()})), bodyClearIntent())
  assert.deepEqual(clear.changes, [{change: 'scene_body_clear', scene_ref: SCENE}])
  assert.deepEqual(prepareNativeSceneMaterialEdit(current, basis(current), bodyClearIntent()).changes, [])
  assert.throws(() => prepareNativeSceneMaterialEdit(current, {...basis(current), revision: 3}, bodyClearIntent()), /captured native Expression revision changed/)
  assert.throws(() => prepareNativeSceneMaterialEdit(current, basis(current, 'expression:whole:scene:none'), bodyClearIntent()), /exact captured native Scene ref/)
})

// The receiver, mirrored from app.ts editSceneMaterial: refuse before any read, read the exact body, then plan against the flushed view.
// The stub owner records what nativeWorkspace.edit would write.
async function receive(request, current, read) {
  const requirement = sceneMaterialReadRequirement(request.intent)
  if (requirement.kind === 'refuse') throw Error(requirement.problem)
  const resolved = requirement.kind === 'read' ? await read(requirement) : undefined
  return prepareNativeSceneMaterialEdit(current, request.basis, request.intent, resolved).changes
}

test('the receiver reads a text or image body once, then writes one scene_body_set', async () => {
  const current = view()
  const reads = []
  const read = async requirement => {reads.push(requirement); return requirement.carrier === 'image_media' ? imageBody() : textBody({span: requirement.span})}
  const textChanges = await receive({operation: 'scene-material', basis: basis(current),
    intent: {family: 'body', body: {operation: 'set', carrier: 'text_source', subject_ref: NOTES, span: null, presentation: 'inline'}}}, current, read)
  assert.equal(reads.length, 1)
  assert.deepEqual(reads[0], {kind: 'read', carrier: 'text_source', subject_ref: NOTES, span: null})
  assert.equal(textChanges.length, 1)
  assert.equal(textChanges[0].change, 'scene_body_set')
  const imageChanges = await receive({operation: 'scene-material', basis: basis(current),
    intent: {family: 'body', body: {operation: 'set', carrier: 'image_media', subject_ref: ARTWORK}}}, current, read)
  assert.equal(imageChanges[0].body.carrier, 'image_media')
  assert.equal(reads.length, 2)
})

test('the receiver refuses an unresolved carrier by name before any host read', async () => {
  const current = view()
  let reads = 0
  const read = async () => {reads++; return textBody()}
  await assert.rejects(receive({operation: 'scene-material', basis: basis(current),
    intent: {family: 'body', body: {operation: 'set', carrier: 'glyph_form', subject_ref: 'Project/glyph.svg'}}}, current, read),
  {message: 'This carrier has no host resolver yet: glyph_form'})
  await assert.rejects(receive({operation: 'scene-material', basis: basis(current),
    intent: {family: 'body', body: {operation: 'set', carrier: 'expression_ref', subject_ref: 'expression:other', max_depth: 1}}}, current, read),
  {message: 'This carrier has no host resolver yet: expression_ref'})
  assert.equal(reads, 0)
})

// ---- Shell model: the device, its summary and the builders the panel calls ----

test('the device is the Scene body and Jump model at the body anchors, with the scene studio section', () => {
  assert.equal(models.SCENE_FACE_MODELS.body, bodyFaceModel)
  assert.equal(bodyFaceModel.name, 'Scene body & Jump')
  assert.deepEqual(bodyFaceModel.groups.map(group => group.title), ['Scene body', 'Jump triggers'])
  assert.equal(bodyFaceModel.studio, 'scene')
  assert.equal(bodyFaceModel.enabled(reading(view())), undefined)
  assert.equal(registry.sceneFaceView('body'), BodyPanel)
  assert.equal(registry.SCENE_FACE_VIEWS.body, BodyPanel)
})

test('the summary names the body carrier or none, and the trigger count; an absent reading is named as not disclosed', () => {
  const current = view()
  assert.equal(bodySummary(reading(current, {body: textBody()})), 'body: text_source · 0 triggers')
  assert.equal(bodySummary(reading(current, {body: null, triggers: [trigger('a', 'select', navigate(OTHER))]})), 'body: none · 1 trigger')
  assert.equal(bodySummary(reading(current, {body: imageBody(), triggers: [trigger('a', 'select', navigate(OTHER)), trigger('b', 'activate', navigate(OTHER))]})), 'body: image_media · 2 triggers')
  assert.equal(bodySummary({...reading(current), nativeScene: undefined}), 'Scene body not disclosed')
})

test('carrier options: nine admitted carriers, only text and image settable, each other named as having no host resolver', () => {
  const options = carrierOptions()
  assert.deepEqual(options.map(row => row.carrier), [...SCENE_BODY_CARRIERS])
  assert.deepEqual(options.filter(row => row.resolvable).map(row => row.carrier), ['text_source', 'image_media'])
  assert.equal(options.find(row => row.carrier === 'glyph_form').reason, 'no host resolver yet')
  assert.match(options.find(row => row.carrier === 'engine_composition').reason, /Clear body/)
})

test('presentation honesty: a renderable body is never Degraded, and an unavailable body is not Preview', () => {
  assert.equal(presentationProblem('inline', 'renderable'), null)
  assert.equal(presentationProblem('live', 'renderable'), null)
  assert.equal(presentationProblem('preview', 'renderable'), null)
  assert.match(presentationProblem('degraded', 'renderable'), /Degraded needs a body that cannot render/)
  assert.match(presentationProblem('preview', 'unavailable'), /needs a capability/)
  assert.equal(presentationProblem('degraded', 'degrades_to_thing'), null)
})

test('the body form builds only the admitted set shapes; a problem keeps the request out', () => {
  const form = (over) => ({carrier: 'text_source', presentation: 'inline', subject: NOTES, spanStart: '0', spanEnd: '0', ...over})
  assert.equal(bodySetIntent(form({subject: '   '})).problem, 'Name the native file ref or path first')
  assert.match(bodySetIntent(form({presentation: 'degraded'})).problem, /Degraded needs/)
  assert.equal(bodySetIntent(form({carrier: 'glyph_form'})).problem, 'This carrier has no host resolver yet: glyph_form')
  assert.match(bodySetIntent(form({carrier: 'engine_composition'})).problem, /Use Clear body/)
  assert.match(bodySetIntent(form({spanStart: '5', spanEnd: '2'})).problem, /end after start/)
  assert.match(bodySetIntent(form({spanStart: '1.5', spanEnd: '3'})).problem, /whole numbers/)
  const whole = bodySetIntent(form({}))
  assert.deepEqual(whole.intent, {family: 'body', body: {operation: 'set', carrier: 'text_source', subject_ref: NOTES, span: null, presentation: 'inline'}})
  const span = bodySetIntent(form({spanStart: '2', spanEnd: '9', presentation: 'live'}))
  assert.deepEqual(span.intent.body.span, {start: 2, end: 9})
  const image = bodySetIntent({carrier: 'image_media', presentation: 'inline', subject: ARTWORK, spanStart: '0', spanEnd: '0'})
  assert.ok(!('span' in image.intent.body))
  // Each set the form builds is read by the gate exactly as the planner expects.
  assert.deepEqual(sceneMaterialReadRequirement(span.intent), {kind: 'read', carrier: 'text_source', subject_ref: NOTES, span: {start: 2, end: 9}})
  assert.deepEqual(sceneMaterialReadRequirement(image.intent), {kind: 'read', carrier: 'image_media', subject_ref: ARTWORK, span: null})
})

test('trigger forms build the four admitted targets, and each one is accepted by the planner', () => {
  const current = view({body: textBody()})
  const r = reading(current, {body: textBody()})
  const context = triggerContext(r)
  assert.deepEqual(context.subjects, [NOTES])
  assert.deepEqual(context.scenes, [{scene_ref: OTHER, title: 'Second'}])
  const base = {occasion: 'scene_enter', kind: 'navigate', operation: 'inspect', placement: 'overlay', subject: '', action: '', scene: ''}
  const forms = [
    {...base, kind: 'expression_operation', operation: 'export'},
    {...base, kind: 'portal', placement: 'beside'},
    {...base, kind: 'native_action'},
    {...base, kind: 'navigate'},
  ]
  for (const [index, form] of forms.entries()) {
    const result = triggerAttachIntent(form, context, `form-${index}`)
    assert.equal(result.problem, null, form.kind)
    const plan = prepareNativeSceneMaterialEdit(current, basis(current), result.intent)
    assert.equal(plan.changes[0].change, 'scene_trigger_attach', form.kind)
  }
  assert.deepEqual(triggerAttachIntent(forms[2], context, 'native').intent.trigger.target,
    {kind: 'native_action', action_ref: ACTION.action_ref, target_ref: NOTES, authority_requirement: ACTION.authority_requirement})
  assert.deepEqual(triggerAttachIntent(forms[3], context, 'jump').intent.trigger.target, {kind: 'navigate', scene_ref: OTHER})
})

test('trigger form validation: budget, occasion, id grammar and undisclosed targets are refused before any request', () => {
  const current = view({body: textBody()})
  const context = triggerContext(reading(current, {body: textBody()}))
  const form = {occasion: 'select', kind: 'navigate', operation: 'inspect', placement: 'full', subject: '', action: '', scene: OTHER}
  assert.equal(triggerAttachIntent(form, {...context, count: MAX_TRIGGERS_PER_SCENE}, 'ok').problem, `This Scene already has ${MAX_TRIGGERS_PER_SCENE} triggers, the maximum. Remove one first.`)
  assert.match(triggerAttachIntent({...form, occasion: 'hover'}, context, 'ok').problem, /Choose when the trigger fires/)
  assert.match(triggerAttachIntent(form, context, 'bad id!').problem, /1–128 letters/)
  assert.match(triggerAttachIntent({...form, kind: 'portal'}, {...context, subjects: []}, 'ok').problem, /No subject is disclosed/)
  assert.match(triggerKindProblem('portal', {...context, subjects: []}), /No subject is disclosed/)
  assert.match(triggerKindProblem('native_action', {...context, actions: []}), /No native Action is disclosed/)
  assert.match(triggerKindProblem('navigate', {...context, scenes: []}), /No other native Scene/)
  assert.equal(triggerKindProblem('expression_operation', context), null)
  assert.match(triggerAttachIntent({...form, kind: 'expression_operation', operation: 'write'}, context, 'ok').problem, /never mutate documents/)
})

test('a fresh trigger id is in the boundary grammar and differs with the random draw', () => {
  const first = newTriggerId(1_700_000_000_000, () => 0.25)
  const second = newTriggerId(1_700_000_000_000, () => 0.75)
  assert.match(first, /^[A-Za-z0-9._-]{1,128}$/)
  assert.notEqual(first, second)
  assert.equal(triggerTargetLabel({kind: 'navigate', scene_ref: OTHER}), `Jump to ${OTHER}`)
  assert.equal(triggerTargetLabel({kind: 'expression_operation', operation: 'list', expression_ref: EXPR}), 'Expression list')
})

// ---- Shell render: the panel, SSR only (no DOM is available to drive clicks) ----

const render = (r, disabled = false) => renderToStaticMarkup(createElement(BodyPanel, {reading: r, request: async () => ({ok: true, reading: r}), disabled,
  apply: async () => ({ok: true, reading: r})}))

test('the panel shows the disclosed body and its budgets, with the unresolved carriers disabled and named', () => {
  const current = view()
  const markup = render(reading(current, {body: textBody(), triggers: [trigger('a', 'select', navigate(OTHER))]}))
  assert.match(markup, /Text source · Project\/notes\.md · Inline · renderable/)
  assert.match(markup, /Actions on this body: 1 \/ 16/)
  assert.match(markup, /1 \/ 8<\/span>/)
  assert.match(markup, /<option value="glyph_form" disabled="">Glyph form \(no host resolver yet\)<\/option>/)
  assert.match(markup, /<option value="engine_composition" disabled="">Engine composition \(default: use Clear body\)<\/option>/)
  assert.match(markup, /<option value="text_source" selected="">Text source<\/option>/)
  assert.match(markup, /<option value="degraded" disabled="">Degraded \(not for this body\)<\/option>/)
  assert.match(markup, /aria-label="Remove trigger Selected: Jump to expression:whole:scene:second"/)
  assert.match(markup, /Clear body/)
  assert.doesNotMatch(markup, /role="alert"/)
})

test('the panel with no body says the live composition shows, and disables a portal with no disclosed subject', () => {
  const current = view()
  const markup = render(reading(current, {body: null, triggers: []}))
  assert.match(markup, /No native body: this Scene shows its live engine composition\./)
  assert.match(markup, /No triggers on this Scene\./)
  assert.match(markup, /<option value="portal" disabled="">Open a portal \(unavailable\)<\/option>/)
  assert.match(markup, /<option value="native_action" disabled="">Run a disclosed native Action \(unavailable\)<\/option>/)
  assert.doesNotMatch(markup, /aria-label="Remove trigger/)
})

test('a full trigger budget disables Add trigger; a disabled panel disables its carrier select', () => {
  const current = view({body: textBody()})
  const full = Array.from({length: MAX_TRIGGERS_PER_SCENE}, (_, i) => trigger(`full-${i}`, 'select', navigate(OTHER)))
  const markup = render(reading(current, {body: textBody(), triggers: full}))
  assert.match(markup, /<button type="submit" disabled="">Add trigger<\/button>/)
  assert.match(markup, /8 \/ 8<\/span>/)
  const locked = render(reading(current, {body: textBody()}), true)
  assert.match(locked, /<select aria-label="Body carrier"[^>]*disabled=""/)
})

test('a reading without nativeScene says the body is not in the reading, and offers no controls', () => {
  const current = view()
  const markup = renderToStaticMarkup(createElement(BodyPanel, {reading: {...reading(current), nativeScene: undefined}, request: async () => ({ok: true, reading: {}}),
    disabled: false, apply: async () => ({ok: true, reading: {}})}))
  assert.match(markup, /Scene body and triggers are not in this reading/)
  assert.doesNotMatch(markup, /<select/)
})
