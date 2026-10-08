import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {register} from 'node:module'

// Production sources transpiled in memory: the blueprint boundary, the Scene
// face model and panel, and the desktop owner's blueprint law (blueprintHUD,
// nativeBlueprint, blueprintGeometry). No owner, store, server or network is
// simulated. The native edit is planned, never executed: the shell's preflight
// is the only native law exercised here.
const root = new URL('../../../../', import.meta.url)
const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
register(`data:text/javascript,${encodeURIComponent(`import ts from ${JSON.stringify(compiler)};import {readFile} from 'node:fs/promises';
export async function resolve(specifier,context,next){try{return await next(specifier,context)}catch(error){
 if(specifier.startsWith('.')&&specifier.endsWith('.js'))return next(specifier.slice(0,-3)+'.ts',context);
 if(specifier.startsWith('.')&&!/\\.[cm]?[jt]s$/.test(specifier))return next(specifier+'.ts',context);throw error;}}
export async function load(url,context,next){if(url.endsWith('.css'))return {format:'module',shortCircuit:true,source:'export {}'};if(!url.endsWith('.ts')&&!url.endsWith('.tsx'))return next(url,context);
 return {format:'module',shortCircuit:true,source:ts.transpileModule(await readFile(new URL(url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX},fileName:new URL(url).pathname}).outputText};}`)}`, import.meta.url)

const author = new URL('desktop/cradle/expressions-app/field-studies-journeys/src/', root)
const sources = new URL('desktop/cradle/', root)
const [boundary, face, panel, {prepareBlueprintEdit, blueprintReply}, {blueprintTransformIntent}, {installNativeEditorReceiver}, {WORLD_SCALE}, {BLUEPRINT_SHAPE, BLUEPRINT_READING_DIGEST, blueprintPosition}, serverRender, react] = await Promise.all([
  import(new URL('packages/expressions-boundary/src/nativeBlueprintEdits.ts', root)),
  import(new URL('../src/components/nativeSceneFace.blueprint.ts', import.meta.url)),
  import(new URL('../src/components/NativeSceneFace.blueprint.tsx', import.meta.url)),
  import(new URL('nativeBlueprint.ts', author)),
  import(new URL('blueprintHUD.ts', author)),
  import(new URL('hostEditor.ts', author)),
  import(new URL('nativeParameters.ts', author)),
  import(new URL('blueprintGeometry.ts', author)),
  import('react-dom/server'),
  import('react'),
])
const renderToStaticMarkup = serverRender.renderToStaticMarkup ?? serverRender.default.renderToStaticMarkup
const {
  BLUEPRINT_WORLD_SCALE, BLUEPRINT_BASE_SIZE, BLUEPRINT_POSITION_RANGE, BLUEPRINT_ROTATION_RANGE, BLUEPRINT_SIZE_RANGE, BLUEPRINT_SITES,
  blueprintDisplayOf, blueprintNativeOf, blueprintSitePoint, validateBlueprintIntent,
} = boundary
const F = face
const SCENE = 'scene:a', ENTITY = 'entity:m', FRAME = {ref: 'frame:sixfold', revision: 'r1', availability: 'available'}

const sitesJson = JSON.parse(await readFile(new URL('kernel/src/expression_blueprint_sixfold.json', sources), 'utf8'))
const hud = await readFile(new URL('expressions-app/field-studies-journeys/src/blueprintHUD.ts', sources), 'utf8')
const geometry = await readFile(new URL('expressions-app/field-studies-journeys/src/blueprintGeometry.ts', sources), 'utf8')
const parameters = await readFile(new URL('expressions-app/field-studies-journeys/src/nativeParameters.ts', sources), 'utf8')

// ---- Constants: each copy is pinned to the app source it names ----------------

test('the boundary constants are the app constants (WORLD_SCALE, BASE_SIZE, sites, native limits)', () => {
  assert.equal(BLUEPRINT_WORLD_SCALE, WORLD_SCALE)
  assert.equal(WORLD_SCALE, 400)
  assert.match(parameters, /export const WORLD_SCALE = 400;/)
  assert.match(hud, /const BASE_SIZE=110;/)
  assert.equal(BLUEPRINT_BASE_SIZE, 110)
  assert.match(hud, /controls\.size\*BASE_SIZE/)
  assert.match(hud, /value\*WORLD_SCALE/)
  assert.match(hud, /value\*Math\.PI\/180/)
  assert.match(hud, /min="0\.0001" data-blueprint-field="size"/)
  assert.match(geometry, /Math\.abs\(v\)<=1600/)
  assert.match(geometry, /Math\.abs\(v\)<=1000/)
  assert.match(geometry, /t\.scale<\.01\|\|t\.scale>1600/)
  assert.deepEqual(BLUEPRINT_SITES.map(([x, y, z]) => [x, y, z]), sitesJson.sites.slice().sort((a, b) => a.address.coordinate.position - b.address.coordinate.position).map(site => site.xyz))
})

test('the display bounds are derived from the native limits, not invented', () => {
  assert.deepEqual([...BLUEPRINT_POSITION_RANGE], [-4, 4])
  assert.equal(BLUEPRINT_ROTATION_RANGE[1], 1000 * 180 / Math.PI)
  assert.equal(BLUEPRINT_SIZE_RANGE[0], 0.0001)
  assert.equal(BLUEPRINT_SIZE_RANGE[1], 1600 / 110)
})

// ---- Intent validators --------------------------------------------------------

const transform = (over = {}) => ({operation: 'transform', translation: [0, 0, 0], rotation_degrees: [0, 0, 0], size: 1, ...over})

test('bind and release accept only their operation; any operand is refused', () => {
  assert.deepEqual(validateBlueprintIntent({operation: 'bind'}), {operation: 'bind'})
  assert.deepEqual(validateBlueprintIntent({operation: 'release'}), {operation: 'release'})
  assert.throws(() => validateBlueprintIntent({operation: 'bind', binding: {}}), /Unsupported blueprint operand/)
  assert.throws(() => validateBlueprintIntent({operation: 'release', scene_ref: SCENE}), /Unsupported blueprint operand/)
})

test('transform accepts every admitted bound and refuses values just outside it, naming the label', () => {
  assert.deepEqual(validateBlueprintIntent(transform({translation: [-4, 4, 0], rotation_degrees: [-57295, 57295, 0], size: 0.0001})),
    transform({translation: [-4, 4, 0], rotation_degrees: [-57295, 57295, 0], size: 0.0001}))
  assert.equal(validateBlueprintIntent(transform({size: 14.5})).size, 14.5)
  assert.throws(() => validateBlueprintIntent(transform({translation: [4.01, 0, 0]})), /Position X must be between -4 and 4/)
  assert.throws(() => validateBlueprintIntent(transform({translation: [0, -4.5, 0]})), /Position Y must be between -4 and 4/)
  assert.throws(() => validateBlueprintIntent(transform({translation: [0, 0, 9]})), /Position Z must be between -4 and 4/)
  assert.throws(() => validateBlueprintIntent(transform({rotation_degrees: [0, 0, 57296]})), /Rotation Z must be between/)
  assert.throws(() => validateBlueprintIntent(transform({size: 0.00009})), /Relative size must be between 0.0001/)
  assert.throws(() => validateBlueprintIntent(transform({size: 14.6})), /Relative size must be between/)
  for (const bad of [NaN, Infinity, '1', null]) assert.throws(() => validateBlueprintIntent(transform({size: bad})), /Relative size must be between/, String(bad))
  assert.throws(() => validateBlueprintIntent(transform({translation: [0, 0]})), /three values, X, Y and Z/)
  assert.throws(() => validateBlueprintIntent(transform({translation: [0, 0, 0], extra: 1})), /Unsupported blueprint operand/)
})

test('an unknown operation, a non-object, or an array is refused before any native call', () => {
  assert.throws(() => validateBlueprintIntent({operation: 'move'}), /bind, transform or release/)
  assert.throws(() => validateBlueprintIntent(null), /one named blueprint intent/)
  assert.throws(() => validateBlueprintIntent(['bind']), /one named blueprint intent/)
})

// ---- The app's transform law, by its own function ----------------------------

test('blueprintSitePoint is the app blueprintPosition for every QL position and a rotated, scaled, translated transform', () => {
  const cases = [
    {translation: [0, 0, 0], rotation: [0, 0, 0], scale: 110},
    {translation: [400, -80, 12], rotation: [0.3, -1.1, 0.7], scale: 260},
    {translation: [-1600, 1600, 0], rotation: [1.5, 0, -2.2], scale: 0.01},
  ]
  for (const transform of cases) {
    const binding = {transform}
    for (let position = 0; position < 6; position++) {
      const app = blueprintPosition(binding, position), mine = blueprintSitePoint(position, transform)
      for (let i = 0; i < 3; i++) assert.ok(Math.abs(app[i] - mine[i]) < 1e-9, `position ${position} axis ${i}`)
    }
  }
  assert.throws(() => blueprintSitePoint(6, cases[0]), /no supplied QL position/)
})

test('display and native units convert by the app law, and round-trip exactly', () => {
  const transformValue = {translation: [800, -400, 0], rotation: [Math.PI / 2, 0, -Math.PI / 4], scale: 220}
  const display = blueprintDisplayOf(transformValue)
  assert.deepEqual([...display.translation], [2, -1, 0])
  assert.ok(Math.abs(display.rotationDegrees[0] - 90) < 1e-9)
  assert.equal(display.size, 2)
  const back = blueprintNativeOf(display)
  for (let i = 0; i < 3; i++) {
    assert.ok(Math.abs(back.translation[i] - transformValue.translation[i]) < 1e-9)
    assert.ok(Math.abs(back.rotation[i] - transformValue.rotation[i]) < 1e-12)
  }
  assert.ok(Math.abs(back.scale - 220) < 1e-9)
  // The HUD's own intent builder is the same law: its native transform equals blueprintNativeOf for the same controls.
  assert.match(hud, /translation:controls\.translation\.map\(value=>value\*WORLD_SCALE\)/)
})

// ---- Panel model: summary, request shapes, plan geometry, handles ------------

const binding = (over = {}) => ({schema: 'oi.scene-blueprint/v1', shape_ref: BLUEPRINT_SHAPE, reading_digest: BLUEPRINT_READING_DIGEST, frame: FRAME,
  members: [{entity_ref: ENTITY, subject_ref: 'subject:m', role_ref: 'role:one', position: 0}, {entity_ref: 'entity:n', subject_ref: 'subject:n', role_ref: 'role:four', position: 3}],
  transform: {translation: [400, 0, 0], rotation: [0, 0, 0], scale: 110}, ...over})
const reading = ({blueprint, scene = true} = {}) => ({
  basis: {expression_ref: 'expression:x', revision: 7, scene_ref: SCENE, authored_revision: 3},
  scene: {id: 'scene:local', name: 'Main', entities: [{id: 'entity:local-m', name: 'Ring'}, {id: 'entity:local-n', name: 'Drone'}]},
  entityOccurrences: {'entity:local-m': ENTITY, 'entity:local-n': 'entity:n'},
  standing: {dirty: false, pending: false, notice: null},
  ...(scene ? {nativeScene: {scene_ref: SCENE, body: null, triggers: [], ...(blueprint === undefined ? {} : {blueprint})}} : {}),
})

test('the summary names a bound count, not bound, or not in the reading; the activator is hollow', () => {
  assert.equal(F.blueprintSummary(reading({blueprint: binding()})), 'bound 2 members')
  assert.equal(F.blueprintSummary(reading({blueprint: binding({members: [binding().members[0]]})})), 'bound 1 member')
  assert.equal(F.blueprintSummary(reading({blueprint: null})), 'not bound')
  assert.equal(F.blueprintSummary(reading({blueprint: undefined})), 'Blueprint not in the reading')
  assert.equal(F.blueprintSummary(reading({scene: false})), 'Blueprint not in the reading')
  assert.equal(F.blueprintFaceModel.enabled(reading({blueprint: null})), undefined)
  assert.equal(F.blueprintFaceModel.compactActions, undefined)
  assert.equal(F.blueprintFaceModel.studio, 'blueprint')
  assert.deepEqual(F.blueprintFaceModel.groups.map(group => group.title), ['Sixfold roles', 'Whole transform'])
})

test('a blueprint request is the captured basis and one validated intent; the bind carries no binding', () => {
  const r = reading({blueprint: null})
  assert.deepEqual(F.blueprintRequest(r, {operation: 'bind'}), {operation: 'blueprint', basis: r.basis, intent: {operation: 'bind'}})
  assert.deepEqual(F.blueprintRequest(r, {operation: 'release'}), {operation: 'blueprint', basis: r.basis, intent: {operation: 'release'}})
  const intent = F.transformIntent({translation: [1, -0.5, 0], rotationDegrees: [0, 0, 90], size: 1.5})
  assert.deepEqual(F.blueprintRequest(r, intent).intent, {operation: 'transform', translation: [1, -0.5, 0], rotation_degrees: [0, 0, 90], size: 1.5})
  assert.notEqual(F.blueprintRequest(r, intent).basis, r.basis, 'the request holds its own copy of the basis')
  assert.throws(() => F.blueprintRequest(r, {operation: 'transform', translation: [5, 0, 0], rotation_degrees: [0, 0, 0], size: 1}), /between -4 and 4/)
})

test('the committed display transform is the binding in stage units, degrees and relative size', () => {
  const display = F.committedDisplay(binding({transform: {translation: [800, -400, 0], rotation: [0, 0, Math.PI], scale: 330}}))
  assert.deepEqual([...display.translation], [2, -1, 0])
  assert.ok(Math.abs(display.rotationDegrees[2] - 180) < 1e-9)
  assert.equal(display.size, 3)
  assert.equal(F.committedDisplay(null), null)
  assert.equal(F.committedDisplay(undefined), null)
})

test('the plan maps the admitted range onto the drawing and clamps every handle to it', () => {
  assert.deepEqual(F.planPoint(0, 0), {x: 200, y: 200})
  assert.deepEqual(F.planPoint(4, 4), {x: 400, y: 0})
  assert.deepEqual(F.stageFromBox({left: 10, top: 20, width: 400, height: 400}, 210, 220), {x: 0, y: 0})
  assert.deepEqual(F.stageFromBox({left: 0, top: 0, width: 0, height: 400}, 5, 5), {x: 0, y: 0}, 'an unmeasured plan is not guessed')
  assert.deepEqual(F.centreFromPoint({x: 5.123, y: -9}), [4, -4])
  assert.deepEqual(F.centreFromPoint({x: 0.126, y: -0.004}), [0.13, 0])
  // The outer handle: the distance from the centre over BASE_SIZE / WORLD_SCALE (0.275 stage units at relative size 1).
  assert.equal(F.sizeFromPoint([0, 0, 0], {x: 0.275, y: 0}), 1)
  assert.equal(F.sizeFromPoint([1, 1, 0], {x: 1.275, y: 1}), 1)
  assert.equal(F.sizeFromPoint([0, 0, 0], {x: 0, y: 0}), 0.0001)
  assert.equal(F.sizeFromPoint([0, 0, 0], {x: 100, y: 0}), BLUEPRINT_SIZE_RANGE[1])
  const outer = F.sizeHandlePoint([1, 2, 0], 2)
  assert.ok(Math.abs(outer.x - 1.55) < 1e-12 && outer.y === 2)
})

test('member points are the QL sites moved by the app transform, in stage units', () => {
  const b = binding({transform: {translation: [0, 0, 0], rotation: [0, 0, 0], scale: 110}})
  const points = F.memberPoints(b)
  assert.equal(points.length, 2)
  assert.ok(Math.abs(points[0].x) < 1e-12 && Math.abs(points[0].y + 0.275) < 1e-12, 'position 0 is the bottom site at -110 native')
  assert.ok(Math.abs(points[1].x) < 1e-12 && Math.abs(points[1].y - 0.275) < 1e-12, 'position 3 is the top site')
  // The drawn draft uses the same law with the draft's native transform.
  const moved = F.memberPoints(b, blueprintNativeOf({translation: [1, 0, 0], rotationDegrees: [0, 0, 0], size: 2}))
  assert.ok(Math.abs(moved[0].x - 1) < 1e-12 && Math.abs(moved[0].y + 0.55) < 1e-12)
})

test('the member name comes from the reading occurrence map, and is absent when the reading does not show it', () => {
  const r = reading({blueprint: binding()})
  assert.equal(F.memberName(r, ENTITY), 'Ring')
  assert.equal(F.memberName(r, 'entity:unknown'), null)
})

test('keyboard steps and moves follow the HUD steps and the admitted bounds', () => {
  assert.deepEqual(F.keyDelta('ArrowLeft', false), {dx: -0.05, dy: 0, dsize: 0})
  assert.deepEqual(F.keyDelta('ArrowUp', true), {dx: 0, dy: 0.5, dsize: 0})
  assert.equal(F.keyDelta('a', false), null)
  const value = {translation: [3.9, -3.99, 0], rotationDegrees: [0, 0, 0], size: 14.54}
  assert.deepEqual([...F.movedCentre(value, 0.5, -0.5).translation], [4, -4, 0])
  assert.equal(F.resized(value, 0.05).size, BLUEPRINT_SIZE_RANGE[1], 'growing clamps at the admitted maximum, even after rounding')
  assert.equal(F.resized({...value, size: 1}, -2).size, BLUEPRINT_SIZE_RANGE[0], 'shrinking clamps at the admitted minimum')
  assert.equal(F.resized({...value, size: 1}, 0.05).size, 1.05)
})

test('field values read and write one component each, in degrees for rotation', () => {
  const value = {translation: [1, 2, 3], rotationDegrees: [10, 20, 30], size: 4}
  assert.equal(F.fieldValue(value, 'y'), 2)
  assert.equal(F.fieldValue(value, 'rz'), 30)
  assert.equal(F.fieldValue(value, 'size'), 4)
  const next = F.withField(value, 'rx', -45)
  assert.deepEqual([...next.rotationDegrees], [-45, 20, 30])
  assert.deepEqual([...value.rotationDegrees], [10, 20, 30], 'the source value is not mutated')
  assert.equal(F.withField(value, 'size', 0.5).size, 0.5)
})

test('a typed field value is parsed against its own bound, and a bad one is named, not sent', () => {
  assert.deepEqual(boundary.blueprintFieldValue(' 1.25 ', BLUEPRINT_POSITION_RANGE, 'Position X'), {value: 1.25, problem: null})
  assert.equal(boundary.blueprintFieldValue('', BLUEPRINT_POSITION_RANGE, 'Position X').problem, 'Position X must be between -4 and 4')
  assert.equal(boundary.blueprintFieldValue('9', BLUEPRINT_POSITION_RANGE, 'Position X').problem, 'Position X must be between -4 and 4')
})

// ---- Routing: the owner's preflight and the expected revision ----------------

// A minimal native document: one bound Scene whose two members carry the frame their native readings name.
function view(over = {}) {
  const frame = FRAME
  const entity = (ref, subject, position) => ({subject: {subject_ref: subject, readings: [{...frame}]}, parameters: {x: {value: 0, automation: null}, y: {value: 0, automation: null}, z: {value: 0, automation: null}}, name: ref, position})
  const document = {
    schema: 'oi.expression/v1', expression_ref: 'expression:x', revision: 7, title: 'x',
    scenes: [{scene_ref: SCENE, revision: 7, title: 'Main', entity_refs: [ENTITY, 'entity:n'], body: null, triggers: [],
      presentation: {schema: 'oi.journey-scene/v1', scene: {composition: {blueprint: binding()}, entities: [
        {id: ENTITY, position: {x: 0, y: 0, z: 0}}, {id: 'entity:n', position: {x: 0, y: 0, z: 0}}]}}}],
    entities: {[ENTITY]: entity(ENTITY, 'subject:m', 0), 'entity:n': entity('entity:n', 'subject:n', 3)},
    relations: {}, selection: {scene_ref: SCENE, entity_ref: null}, provenance: [], representations: [], refinements: [],
    ...over,
  }
  return {document, bindings: {'scene:local': {scene_ref: SCENE}}, journey: null, entity_ids: {}}
}

test('a transform prepares one native blueprint edit on the captured revision, with the app unit law', () => {
  const v = view()
  const r = reading({blueprint: binding()})
  const intent = blueprintTransformIntent(v, 'scene:local', {translation: [1, -0.5, 0], rotationDegrees: [0, 0, 90], size: 2})
  const {request, expected} = prepareBlueprintEdit(v, intent)
  assert.equal(request.operation, 'edit')
  assert.equal(request.expected_revision, r.basis.revision, 'the expected revision is the captured revision')
  assert.equal(request.expression_ref, 'expression:x')
  assert.equal(request.changes.length, 1)
  assert.equal(request.changes[0].change, 'scene_blueprint_transform')
  assert.equal(request.changes[0].scene_ref, SCENE)
  const native = request.changes[0].transform
  assert.deepEqual(native.translation, [400, -200, 0])
  assert.ok(Math.abs(native.rotation[2] - Math.PI / 2) < 1e-12)
  assert.equal(native.scale, 220)
  assert.equal(expected.revision, 8, 'an applied transform advances the revision by one')
})

test('the shell preflight refuses a stale basis and a transform with no binding, before any owner call', () => {
  const v = view({revision: 9})
  assert.throws(() => prepareBlueprintEdit(v, {expression_ref: 'expression:x', revision: 7, scene_ref: SCENE, operation: 'release'}), /basis changed/)
  const unbound = view()
  unbound.document.scenes[0].presentation.scene.composition.blueprint = undefined
  assert.throws(() => blueprintTransformIntent(unbound, 'scene:local', {translation: [0, 0, 0], rotationDegrees: [0, 0, 0], size: 1}), /no blueprint/)
})

test('the owner reply is the captured expected document, so a refused readback is a revision conflict', () => {
  const v = view()
  const intent = blueprintTransformIntent(v, 'scene:local', {translation: [0.5, 0, 0], rotationDegrees: [0, 0, 0], size: 1})
  const {expected} = prepareBlueprintEdit(v, intent)
  assert.throws(() => blueprintReply(v, intent, v.document), /revision_conflict/)
  assert.ok(expected)
})

// ---- Receiver dispatch (hostEditor) ------------------------------------------

test('the editor receiver hands a blueprint request to the owner, and refuses honestly when no owner is wired', async () => {
  const posted = []
  let listener
  // The receiver answers after its handler settles; wait for the named reply rather than a fixed tick count.
  const settle = async (done) => {for (let i = 0; i < 100 && !done(); i++) await new Promise(resolve => setTimeout(resolve, 0))}
  const target = {
    location: {origin: 'https://shell.test'}, parent: {postMessage: (message) => posted.push(message)},
    addEventListener: (type, fn) => {if (type === 'message') listener = fn},
    removeEventListener() {},
  }
  const readings = reading({blueprint: null})
  const calls = []
  const owner = {
    read: () => readings, transactionOpen: () => false,
    apply: async () => {}, select: async () => {}, selectField: async () => {}, scene: async () => {}, editScenes: async () => {},
    open: async () => {}, history: async () => {}, save: async () => {},
    blueprint: async (request, isCurrent) => {calls.push({request, current: isCurrent()})},
  }
  const endpoint = installNativeEditorReceiver(owner, target)
  const send = (req, request) => listener({source: target.parent, origin: 'https://shell.test', data: {schema: 'oi.native-editor/v1', kind: 'request', token: 't', req, bindingId: 'b', epoch: 1, request}})
  await send('read1', {operation: 'read'})
  await send('bp1', {operation: 'blueprint', basis: readings.basis, intent: {operation: 'bind'}})
  await settle(() => posted.some(message => message.req === 'bp1'))
  assert.equal(calls.length, 1)
  assert.deepEqual(calls[0].request, {operation: 'blueprint', basis: readings.basis, intent: {operation: 'bind'}})
  assert.equal(calls[0].current, true)
  const reply = posted.find(message => message.req === 'bp1')
  assert.equal(reply.reply.ok, true)

  const bare = installNativeEditorReceiver({...owner, blueprint: undefined}, {...target, addEventListener: (type, fn) => {listener = fn}})
  await listener({source: target.parent, origin: 'https://shell.test', data: {schema: 'oi.native-editor/v1', kind: 'request', token: 't2', req: 'read2', bindingId: 'b2', epoch: 1, request: {operation: 'read'}}})
  await listener({source: target.parent, origin: 'https://shell.test', data: {schema: 'oi.native-editor/v1', kind: 'request', token: 't2', req: 'bp2', bindingId: 'b2', epoch: 1, request: {operation: 'blueprint', basis: readings.basis, intent: {operation: 'release'}}}})
  await settle(() => posted.some(message => message.req === 'bp2'))
  const refused = posted.find(message => message.req === 'bp2')
  assert.equal(refused.reply.ok, false)
  assert.match(refused.reply.error, /no Blueprint receiver/)
  bare.dispose(); endpoint.dispose()
})

// ---- Panel render (SSR) -------------------------------------------------------

const render = (r, disabled = false) => renderToStaticMarkup(react.createElement(panel.BlueprintPanel, {
  reading: r, request: async () => ({ok: true, reading: r}), disabled, apply: async () => ({ok: true, reading: r}),
}))

test('a bound Scene renders its roles, enabled release, disabled bind, plan handles and the exact transform fields', () => {
  const html = render(reading({blueprint: binding()}))
  assert.match(html, /Sixfold roles/)
  assert.match(html, /bound 2 members/)
  assert.match(html, /Ring/)
  assert.match(html, /position 1 of 6/)
  assert.match(html, /<button[^>]*disabled=""[^>]*>Bind sixfold roles<\/button>/)
  assert.doesNotMatch(html, /<button[^>]*disabled=""[^>]*>Release blueprint<\/button>/)
  assert.match(html, /role="slider" tabindex="0" aria-label="Position X and Y"/)
  assert.match(html, /role="slider" tabindex="0" aria-label="Relative size"/)
  assert.match(html, /aria-valuetext="X 1, Y 0 stage units"/)
  for (const label of ['Position X', 'Position Y', 'Position Z', 'Rotation X (°)', 'Rotation Y (°)', 'Rotation Z (°)', 'Relative size'])
    assert.match(html, new RegExp(`<span>${label.replace(/[()]/g, '\\$&')}</span>`), label)
  assert.match(html, /<input[^>]*min="-4" max="4"[^>]*value="1"/)
  assert.match(html, /Member positions follow the blueprint/)
  assert.match(html, /class="native-blueprint-committed"/)
  assert.match(html, /Apply whole transform/)
})

test('an unbound Scene offers bind only, names the state, and draws no handles', () => {
  const html = render(reading({blueprint: null}))
  assert.match(html, /not bound/)
  assert.doesNotMatch(html, /role="slider"/)
  assert.match(html, /<button[^>]*>Bind sixfold roles<\/button>/)
  assert.match(html, /<button[^>]*disabled=""[^>]*>Release blueprint<\/button>/)
  assert.match(html, /<input[^>]*disabled=""[^>]*\/>/)
})

test('an undisclosed binding is named as not in the reading; bind and release stay available', () => {
  const html = render(reading({blueprint: undefined}))
  assert.match(html, /The current blueprint is not in the reading/)
  assert.doesNotMatch(html, /disabled=""[^>]*>Bind sixfold roles/)
  assert.doesNotMatch(html, /disabled=""[^>]*>Release blueprint/)
})

test('a pending or disabled reading locks every control', () => {
  const html = render(reading({blueprint: binding()}), true)
  assert.match(html, /<button[^>]*disabled=""[^>]*>Release blueprint<\/button>/)
  assert.match(html, /<button[^>]*disabled=""[^>]*>Apply whole transform<\/button>/)
  assert.match(html, /tabindex="-1" aria-label="Position X and Y"/)
})

test('the panel source keeps the dirty draft off the request until release or Apply, and sends one intent', async () => {
  const source = await readFile(new URL('../src/components/NativeSceneFace.blueprint.tsx', import.meta.url), 'utf8')
  assert.equal((source.match(/void send\(/g) ?? []).length, 6, 'bind, release, apply, pointer release, key release and retry: one send each')
  assert.match(source, /Escape/)
  assert.match(source, /setPointerCapture/)
  assert.match(source, /role="slider"/)
})
