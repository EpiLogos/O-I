import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {register} from 'node:module'
import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import ts from 'typescript'

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
const [arrange, models, views, boundaryEdits, panelSettings, model, catalogue] = await Promise.all([
  import('../src/components/nativeSceneFace.arrange.ts'),
  import('../src/components/nativeSceneFaceModel.ts'),
  import('../src/components/nativeSceneFaceViews.tsx'),
  import(new URL('packages/expressions-boundary/src/nativeDeviceEdits.ts', root)),
  import(new URL('packages/expressions-boundary/src/nativeFieldPanelSettings.ts', root)),
  import(new URL('model.ts', author)),
  import('../src/components/nativeDeviceCatalogue.ts'),
])
const {deviceCatalogue} = catalogue
const {ArrangePanel} = await import('../src/components/NativeSceneFace.arrange.tsx')
const {
  ARRANGE_CHANGE_BUDGET, ARRANGE_LAYOUTS, PLANES, PREVIEW_HEIGHT, PREVIEW_WIDTH, arrangeFaceModel, arrangeLabel, arrangePlan, arrangedPositions,
  blueprintMemberIds, centreStatus, entityAxisTarget, planeAxes, planeChange, previewGeometry, previewMoves, quickSelect,
} = arrange
const {SCENE_FACE_MODELS} = models
const {sceneFaceView} = views
const {applyNativeDeviceChanges} = boundaryEdits
const {FIELD_PANEL_SETTINGS} = panelSettings
const {entity, pin, sevenCentres} = model

const centre = (id, name, kind, position, over = {}) => ({id, name, kind, position: {...position}, locked: false, enabled: true, ...over})
const at = (x, y, z) => ({x, y, z})
/** A minimal NativeEditorReading for the panel: the Scene's objects, plane, blueprint, the owner's selection and standing. */
function reading(entities, {selection = [], blueprintIds = [], plane = 'XY', pending = false} = {}) {
  return {
    basis: {expression_ref: 'expression:whole', revision: 3, scene_ref: 'expression:whole:scene:main', authored_revision: 5},
    scene: {entities, composition: {layout: 'free', plane, blueprint: blueprintIds.length
      ? {members: blueprintIds.map((id, i) => ({entity_ref: id, subject_ref: `subject-${i}`, role_ref: `role-${i}`, position: i}))} : undefined}},
    selection: {entity_ids: selection, step_id: null},
    standing: {dirty: false, pending, notice: null},
  }
}
const sourceOf = async path => readFile(new URL(path, author), 'utf8')

// The app's own arrange(), taken from timeline.ts as text and executed, so the drift test runs the app's math, not a copy of it.
async function appArrange() {
  const source = await sourceOf('timeline.ts')
  const start = source.indexOf('export function arrange(')
  const end = source.indexOf('/** Reorder only formations', start)
  assert.ok(start > 0 && end > start, 'timeline.ts still exports arrange() before reorderFocus()')
  const js = ts.transpileModule(source.slice(start, end).replace('export function', 'function'),
    {compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext}}).outputText
  return new Function('TAU', `${js}\nreturn arrange`)(Math.PI * 2)
}
/** Deterministic positions with no ties and no zeros, so every mode has real work to do on each axis. */
function fixturePositions(n, seed) {
  let s = seed
  const next = () => {s = (s * 16807) % 2147483647; return (s / 2147483647) * 2 - 1}
  return Array.from({length: n}, (_, i) => ({id: `c${i}`, position: at(next() * 0.8 + 0.01, next() * 0.8 + 0.02, next() * 0.8 + 0.03)}))
}

test('the arrange device is registered as a scene family with its Arrangement studio section', () => {
  assert.equal(SCENE_FACE_MODELS.arrange, arrangeFaceModel)
  assert.equal(sceneFaceView('arrange'), ArrangePanel)
  assert.equal(arrangeFaceModel.studio, 'layout')
  assert.deepEqual(arrangeFaceModel.groups.map(group => group.title), ['Objects', 'Arrangement'])
  assert.equal(arrangeFaceModel.enabled(reading([])), undefined, 'a scene device has no enable operation, so the light is hollow')
  assert.equal(arrangeFaceModel.compactActions, undefined)
  assert.equal(arrangeFaceModel.summary(reading([centre('a', 'A', 'formation', at(0, 0, 0)), centre('b', 'B', 'pin', at(1, 0, 0))], {plane: 'XZ'})),
    '2 objects · plane XZ')
  assert.equal(arrangeFaceModel.summary(reading([centre('a', 'A', 'formation', at(0, 0, 0))])), '1 object · plane XY')
})

test('the rack catalogue carries the arrange device as a scene-scope entry with no parameters, no light and no toggle', () => {
  const device = deviceCatalogue().find(item => item.family === 'arrange')
  assert.ok(device, 'arrange is a catalogue family')
  assert.equal(device.scope, 'scene')
  assert.equal(device.name, 'Arrangement')
  assert.deepEqual(device.paths, [])
  assert.deepEqual(device.compact, [])
  assert.equal(device.toggle, null)
  assert.equal(device.studio, 'layout')
  assert.equal(device.enabled(reading([])), undefined, 'hollow light')
  assert.deepEqual(device.actions(reading([centre('a', 'A', 'formation', at(0, 0, 0))])), [], 'no rack compact action')
  assert.equal(device.summary(reading([centre('a', 'A', 'formation', at(0, 0, 0))])), '1 object · plane XY')
  assert.equal(arrangeFaceModel.summary({}), 'Objects not disclosed', 'an undisclosed Scene is named, never shown as empty')
})

test('the ten modes and the plane list are the app\'s own, in the app\'s order', async () => {
  const inspector = await sourceOf('inspector.ts')
  assert.ok(inspector.includes(ARRANGE_LAYOUTS.map(layout => `'${layout}'`).join(',')), 'inspector.ts arrangement buttons list the same ten modes')
  assert.ok(inspector.includes("[['XY','XY'],['XZ','XZ'],['YZ','YZ']]"), 'inspector.ts layout plane options are XY, XZ, YZ')
  assert.equal(ARRANGE_LAYOUTS.length, 10)
  assert.equal(arrangeLabel('align-x'), 'align x', 'the app labels each mode with l.replace("-", " ")')
  assert.equal(arrangeLabel('distribute-y'), 'distribute y')
  assert.deepEqual([...PLANES], ['XY', 'XZ', 'YZ'])
  assert.deepEqual(FIELD_PANEL_SETTINGS.plane.options, PLANES, 'the plane choice is the admitted composition plane')
})

test('arrange math equals the app arrange() for every mode, plane and count', async () => {
  const appArrangeFn = await appArrange()
  let compared = 0
  for (const n of [1, 2, 3, 4, 5, 7, 10]) for (const plane of PLANES) for (const layout of ARRANGE_LAYOUTS) {
    const centres = fixturePositions(n, 17 * n + plane.length)
    const pure = arrangedPositions(centres, layout, plane)
    const targets = centres.map(c => ({id: c.id, position: {...c.position}}))
    appArrangeFn(targets, layout, plane)
    assert.deepStrictEqual(pure.map(c => c.position), targets.map(c => c.position), `${layout} on ${plane} with ${n} centres`)
    assert.deepStrictEqual(pure.map(c => c.id), centres.map(c => c.id))
    compared++
  }
  assert.equal(compared, 7 * 3 * 10)
  // The input is not touched: the preview and the batch both derive from copies.
  const input = fixturePositions(3, 9)
  arrangedPositions(input, 'ring', 'XY')
  assert.deepEqual(input, fixturePositions(3, 9))
})

test('locked and Blueprint members are never moved, and the panel says why', () => {
  const entities = [
    centre('locked', 'Locked one', 'formation', at(0.2, 0.2, 0), {locked: true}),
    centre('member', 'Member', 'formation', at(0.3, 0.3, 0)),
    centre('free', 'Free', 'formation', at(0.4, 0.4, 0)),
    centre('pin', 'Pin', 'pin', at(0.5, 0.5, 0)),
  ]
  const blueprint = new Set(['member'])
  const all = new Set(entities.map(e => e.id))
  assert.match(centreStatus(entities[0], blueprint).reason, /^Locked\./)
  assert.match(centreStatus(entities[1], blueprint).reason, /^Blueprint member\./)
  assert.equal(centreStatus(entities[2], blueprint).reason, null)
  const plan = arrangePlan(entities, all, blueprint, 'line', 'XY')
  assert.deepEqual([...plan.movable], ['free', 'pin'])
  assert.ok(plan.changes.length > 0)
  for (const change of plan.changes) assert.ok(!/entity:(locked|member):/.test(change.target), `${change.target} must not move`)
  assert.deepEqual(quickSelect(entities, 'all', blueprint), new Set(['free', 'pin']))
  assert.deepEqual(quickSelect(entities, 'formations', blueprint), new Set(['free']))
  assert.deepEqual(quickSelect(entities, 'pins', blueprint), new Set(['pin']))
  assert.equal(quickSelect(entities, 'none', blueprint).size, 0)
})

test('one apply is one batch of parameter changes, one per coordinate that moves', () => {
  const entities = [
    centre('a b', 'Spaced', 'formation', at(0.3, 0.4, 0.5)),
    centre('c/d', 'Slash', 'formation', at(0.3, 0.4, 0.5)),
    centre('e', 'Plain', 'pin', at(0.3, 0.4, 0.5)),
  ]
  const plan = arrangePlan(entities, new Set(['a b', 'c/d', 'e']), new Set(), 'line', 'XY')
  assert.equal(plan.problem, null)
  assert.ok(plan.changes.every(change => change.kind === 'parameter'), 'only entity position parameters')
  // line on three centres: x = -0.9, 0, 0.9; y = 0 for each. The z axis never moves on the XY plane.
  assert.deepEqual(plan.changes, [
    {kind: 'parameter', target: 'entity:a%20b:x', value: -0.9},
    {kind: 'parameter', target: 'entity:a%20b:y', value: 0},
    {kind: 'parameter', target: 'entity:c%2Fd:x', value: 0},
    {kind: 'parameter', target: 'entity:c%2Fd:y', value: 0},
    {kind: 'parameter', target: 'entity:e:x', value: 0.9},
    {kind: 'parameter', target: 'entity:e:y', value: 0},
  ])
  assert.equal(new Set(plan.changes.map(change => change.target)).size, plan.changes.length, 'no target is written twice')
  assert.equal(entityAxisTarget('a b', 'x'), 'entity:a%20b:x')
  // Unchanged coordinates are not sent: a lone centre already at the line's origin (x = 0, y = 0) contributes nothing.
  const placed = arrangePlan([centre('p', 'Placed', 'formation', at(0, 0, 0))], new Set(['p']), new Set(), 'line', 'XY')
  assert.deepEqual(placed.changes, [], 'already where line puts a lone centre, so there is nothing to apply')
  assert.equal(placed.problem, null)
})

test('plane choice is one admitted panel-setting change', () => {
  assert.deepEqual(planeChange('XZ'), {kind: 'panel-setting', key: 'plane', value: 'XZ'})
  assert.deepEqual(planeAxes('XY'), ['x', 'y'])
  assert.deepEqual(planeAxes('XZ'), ['x', 'z'])
  assert.deepEqual(planeAxes('YZ'), ['y', 'z'])
})

test('preview positions for a fixture are the mode positions, drawn over the current ones', () => {
  const entities = [
    centre('a', 'Alpha', 'formation', at(0.3, 0.4, 0)),
    centre('b', 'Beta', 'formation', at(-0.2, 0.1, 0)),
    centre('c', 'Gamma', 'pin', at(0.5, -0.6, 0)),
  ]
  const plan = arrangePlan(entities, new Set(['a', 'b', 'c']), new Set(), 'line', 'XY')
  assert.deepEqual(plan.ghost.map(g => g.position), [at(-0.9, 0, 0), at(0, 0, 0), at(0.9, 0, 0)])
  const geometry = previewGeometry(entities, plan.ghost, 'XY')
  assert.deepEqual(geometry.axes, ['x', 'y'])
  assert.equal(geometry.current.length, 3)
  assert.equal(geometry.ghost.length, 3)
  // Ghost marks run left to right along the centre line, and sit on the horizontal midline (y = 0 for every ghost).
  assert.ok(geometry.ghost[0].x < geometry.ghost[1].x && geometry.ghost[1].x < geometry.ghost[2].x)
  for (const mark of geometry.ghost) assert.equal(mark.y, PREVIEW_HEIGHT / 2)
  assert.equal(geometry.ghost[1].x, PREVIEW_WIDTH / 2, 'the centred ghost sits at the page centre')
  // The readout names every axis that moves, including depth outside the drawn plane.
  const moves = previewMoves(entities, plan)
  assert.deepEqual(moves.map(m => m.name), ['Alpha', 'Beta', 'Gamma'])
  assert.equal(moves[0].text, 'X 0.3 to -0.9 · Y 0.4 to 0')
  const laminate = arrangePlan(entities, new Set(['a', 'b', 'c']), new Set(), 'laminate', 'XY')
  assert.match(previewMoves(entities, laminate)[0].text, /Z 0 to -0\.3/, 'laminate moves depth, which the XY plane does not draw')
})

test('an empty selection gives nothing to apply, and a mode without centres says so', () => {
  const entities = [centre('a', 'Alpha', 'formation', at(0, 0, 0)), centre('l', 'Locked', 'formation', at(0, 0, 0), {locked: true})]
  const none = arrangePlan(entities, new Set(), new Set(), null, 'XY')
  assert.deepEqual([none.changes, none.problem], [[], null], 'no mode and no checks: nothing to apply and nothing to warn about')
  const noChecks = arrangePlan(entities, new Set(), new Set(), 'ring', 'XY')
  assert.deepEqual(noChecks.changes, [])
  assert.equal(noChecks.problem, 'Check at least one unlocked centre to arrange.')
  const onlyLocked = arrangePlan(entities, new Set(['l']), new Set(), 'ring', 'XY')
  assert.equal(onlyLocked.problem, 'Check at least one unlocked centre to arrange.', 'a locked centre cannot be checked into the arrangement')
})

test('the change budget refuses a batch over the boundary limit before any send', () => {
  assert.equal(ARRANGE_CHANGE_BUDGET, 256)
  const many = Array.from({length: 130}, (_, i) => centre(`m${i}`, `M${i}`, 'formation', at(0.1, 1, 0)))
  const plan = arrangePlan(many, new Set(many.map(e => e.id)), new Set(), 'line', 'XY')
  assert.deepEqual(plan.changes, [])
  assert.match(plan.problem, /260 coordinates; one change holds 256/)
})

test('the batch the panel builds is admitted by the boundary and moves the centres it names', () => {
  const journey = sevenCentres()
  const scene = journey.scenes[0]
  const ids = new Set(scene.entities.map(e => e.id))
  const plan = arrangePlan(scene.entities, ids, new Set(), 'ring', 'XZ')
  assert.ok(plan.changes.length > 0)
  const next = applyNativeDeviceChanges(journey, scene.id, [...plan.changes], {})
  const after = next.scenes[0].entities
  for (const ghost of plan.ghost) {
    const moved = after.find(e => e.id === ghost.id), before = scene.entities.find(e => e.id === ghost.id)
    assert.equal(moved.position.x, ghost.position.x)
    assert.equal(moved.position.y, before.position.y, 'XZ never writes y')
    assert.equal(moved.position.z, ghost.position.z)
  }
  // The plane choice is admitted through the same boundary as its own change.
  const planed = applyNativeDeviceChanges(next, scene.id, [planeChange('YZ')], {})
  assert.equal(planed.scenes[0].composition.plane, 'YZ')
})

test('the boundary refuses a locked centre with the same words the panel would show', () => {
  const journey = sevenCentres()
  const scene = journey.scenes[0]
  scene.entities[0].locked = true
  const hand = [{kind: 'parameter', target: `entity:${encodeURIComponent(scene.entities[0].id)}:x`, value: 0.1}]
  assert.throws(() => applyNativeDeviceChanges(journey, scene.id, hand, {}), /Unlock this entity before editing its device\./)
  // The panel never offers that centre, so its plan leaves it out rather than sending the refusal.
  const plan = arrangePlan(scene.entities, new Set(scene.entities.map(e => e.id)), new Set(), 'line', 'XY')
  assert.ok(!plan.movable.includes(scene.entities[0].id))
})

test('the panel renders names, kind badges, disabled reasons and a disabled Apply when nothing is checked', () => {
  const entities = [
    centre('f1', 'Ring form', 'formation', at(0.1, 0.2, 0)),
    centre('p1', 'Pull pin', 'pin', at(0.3, 0.4, 0), {locked: true}),
    centre('m1', 'Member form', 'formation', at(0, 0, 0)),
  ]
  const html = renderToStaticMarkup(createElement(ArrangePanel, {
    reading: reading(entities, {blueprintIds: ['m1']}), request: async () => ({ok: true, reading: reading(entities)}), disabled: false,
    apply: async () => ({ok: true, reading: reading(entities)}),
  }))
  assert.ok(html.includes('Ring form') && html.includes('Pull pin') && html.includes('Member form'))
  assert.ok(html.includes('>Formation<') && html.includes('>Pin<'), 'kind badges name the object kind')
  assert.match(html, /Locked\. Unlock this centre/)
  assert.match(html, /Blueprint member\. Release the Blueprint/)
  for (const label of ['line', 'align x', 'distribute y', 'laminate']) assert.ok(html.includes(`>${label}</button>`), `mode ${label}`)
  assert.match(html, /<option value="XY"[^>]*>XY<\/option>/)
  assert.match(html, /<button[^>]*disabled=""[^>]*>Apply arrangement<\/button>/, 'empty selection: Apply is disabled')
  assert.match(html, /<button[^>]*disabled=""[^>]*>Reset preview<\/button>/)
  assert.match(html, /aria-label="Arrange Ring form"[^>]*>/)
  assert.doesNotMatch(html, /aria-label="Arrange Ring form"[^>]*checked=""/, 'nothing is checked by default')
  assert.match(html, /aria-label="Arrange Pull pin"[^>]*disabled=""/, 'a locked centre cannot be checked')
  assert.match(html, /aria-pressed="false"/)
  assert.ok(!html.includes('role="alert"'), 'no refusal is shown before anything is chosen or sent')
})

test('the checklist starts from the owner selection and the Apply is still disabled until a mode is chosen', () => {
  const entities = [centre('f1', 'Ring form', 'formation', at(0.1, 0.2, 0)), centre('f2', 'Other', 'formation', at(0.4, 0, 0))]
  const html = renderToStaticMarkup(createElement(ArrangePanel, {
    reading: reading(entities, {selection: ['f1']}), request: async () => ({ok: false, error: 'x'}), disabled: false,
    apply: async () => ({ok: true, reading: reading(entities)}),
  }))
  assert.match(html, /aria-label="Arrange Ring form"[^>]*checked=""/, 'the owner selection seeds the local checklist')
  assert.doesNotMatch(html, /aria-label="Arrange Other"[^>]*checked=""/)
  assert.match(html, /<button[^>]*disabled=""[^>]*>Apply arrangement<\/button>/)
  assert.match(html, /1 object|2 objects · 1 checked/)
})

test('a panel that is disabled by its host disables every control', () => {
  const entities = [centre('f1', 'Ring form', 'formation', at(0.1, 0.2, 0))]
  const html = renderToStaticMarkup(createElement(ArrangePanel, {
    reading: reading(entities), request: async () => ({ok: true, reading: reading(entities)}), disabled: true,
    apply: async () => ({ok: true, reading: reading(entities)}),
  }))
  assert.match(html, /<select aria-label="Layout plane"[^>]*disabled=""/)
  assert.match(html, /aria-label="Arrange Ring form"[^>]*disabled=""/)
  assert.match(html, /<button[^>]*disabled=""[^>]*>line<\/button>/)
})
