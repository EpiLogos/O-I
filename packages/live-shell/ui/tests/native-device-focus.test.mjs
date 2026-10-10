import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {register} from 'node:module'
import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'

// Production focus device in memory, same loader as the sibling native tests (.tsx transpiled, .css stubbed).
// The reading is a minimal fixture; it is not a native owner or a saved receipt.
const root = new URL('../../../../', import.meta.url)
const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
const parameters = new URL('packages/expressions-boundary/src/parameters.ts', root).href
register(`data:text/javascript,${encodeURIComponent(`import ts from ${JSON.stringify(compiler)};import {readFile} from 'node:fs/promises';export async function resolve(s,c,n){if(s==='@epilogos/expressions-boundary/parameters')return n(${JSON.stringify(parameters)},c);try{return await n(s,c)}catch(e){if(!s.startsWith('.'))throw e;if(s.endsWith('.js')){try{return await n(s.slice(0,-3)+'.ts',c)}catch{}}for(const x of ['.ts','.tsx']){try{return await n(s+x,c)}catch{}}throw e}}export async function load(u,c,n){if(u.endsWith('.css'))return {format:'module',shortCircuit:true,source:'export {}'};if(u.endsWith('?raw'))return {format:'module',shortCircuit:true,source:'export default '+JSON.stringify(await readFile(new URL(u.split('?')[0]),'utf8'))};if(!u.endsWith('.ts')&&!u.endsWith('.tsx'))return n(u,c);return {format:'module',shortCircuit:true,source:ts.transpileModule(await readFile(new URL(u),'utf8'),{fileName:new URL(u).pathname,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText}}`)}`, import.meta.url)
const [{PARAM_REGISTRY, NATIVE_BINDINGS, bindValue}, focus, view, faces, handleModel, boundary] = await Promise.all([
  import(parameters),
  import('../src/components/nativeFieldFace.focus.ts'),
  import('../src/components/NativeFieldFace.focus.tsx'),
  import('../src/components/nativeFieldFaceModel.ts'),
  import('../src/components/nativeFieldHandleModel.ts'),
  import('../../../expressions-boundary/src/nativeDeviceEdits.ts'),
])
const {FOCUS_PATHS, reorder, dropTarget, visitOrder, focusPeriod, focusRoute, focusLoop, rulerGeometry, routeOrderChange, focusFaceModel, RULER_SECONDS} = focus
const {focusFaceView, FocusSwitches, FocusRoute} = view
const {FIELD_FACE_MODELS} = faces
const {handlePosition} = handleModel
const {validateNativeFieldPanelChange, validateNativeRouteOrderChange} = boundary

const binding = path => {
  const found = NATIVE_BINDINGS.find(row => row.path === path)
  assert.ok(found, `missing native binding ${path}`)
  return found
}
const ENGINE = {mediumEnabled: false, resonanceEnabled: false, collisionEnabled: false, pairwiseEnabled: false, morphEnabled: false,
  colorEnabled: false, trajectory: 'toroidalHopf', driveShape: 'sine', colorMode: 'linearGradient', mediumPlane: 'vertical', autoOscillate: true}
const formation = (id, over = {}) => ({id, name: id.toUpperCase(), kind: 'formation', tint: '#8899aa', enabled: true, position: {x: 0, y: 0, z: 0}, ...over})
const PIN = {id: 'pin-1', name: 'Force 1', kind: 'pin', tint: '#000000', enabled: true, position: {x: 0, y: 0, z: 0}}

/** A minimal reading. Numeric focus values are written through the same bindings the editors read. */
function reading({focus = 'travelling', order, entities = [formation('a'), formation('b'), formation('c')], dwell = 1.4, glide = 2.4, focusTint = 0.35, entityTint = 0.6, semanticBindings = 0, carryStation = false, carryTint = true} = {}) {
  const scene = {name: 'Fixture', entities, engine: {...ENGINE, focusOrder: order}, field: {background: '#ffffff', palette: ['#111111'], material: 'ink', params: {}},
    composition: {layout: 'free', plane: 'XY', focus, focusDuration: 4, carryTint, carryStation, frequencyDriver: 'manual'}, automation: [],
    morph: {thetaRate: 0, phiRate: 0, thetaOffset: 0, phiOffset: 0, law: 'theta', depth: 1, dwell: 0.3}}
  if (semanticBindings) scene.semanticField = {enabled: true, bindings: Array.from({length: semanticBindings}, (_, index) => ({id: 'binding-' + index}))}
  bindValue(scene, binding(FOCUS_PATHS.dwell).bind, dwell)
  bindValue(scene, binding(FOCUS_PATHS.glide).bind, glide)
  bindValue(scene, binding(FOCUS_PATHS.focusTint).bind, focusTint)
  bindValue(scene, binding(FOCUS_PATHS.entityTint).bind, entityTint)
  return {
    basis: {expression_ref: 'expr:fixture', revision: 1, scene_ref: 'scene:fixture', authored_revision: 1},
    scene, entityOccurrences: {}, chosenControls: {available: false, entries: [], controls: []},
    selection: {entity_ids: [], step_id: null}, history: {canUndo: false, canRedo: false},
    standing: {dirty: false, pending: false, notice: null},
  }
}
const travelling = reading()
const parallel = reading({focus: 'parallel'})

/** Element walker over the React element tree returned by a view function (no rendering, so handlers stay callable). */
function* elements(node) {
  if (Array.isArray(node)) {for (const child of node) yield* elements(child); return}
  if (!node || typeof node !== 'object' || !('props' in node)) return
  yield node
  yield* elements(node.props.children)
}
const textOf = node => Array.isArray(node) ? node.map(textOf).join('') : typeof node === 'string' ? node : typeof node === 'number' ? String(node)
  : node && node.props ? textOf(node.props.children) : ''
/** The host control inside the <label> whose text starts with the given caption. */
function control(tree, caption) {
  for (const el of elements(tree)) {
    if (el.type !== 'label' || !textOf(el).startsWith(caption)) continue
    for (const inner of elements(el)) if (inner.type === 'select' || inner.type === 'input') return inner
  }
  assert.fail(`no control labelled "${caption}"`)
}
const ctxFor = (r, over = {}) => ({
  reading: r, graphValue: 0, position: 0, value: () => undefined, family: 'focus', disabled: false,
  apply: async () => ({ok: true}), captureCurrent: () => () => true, setDraft: () => {}, ...over,
})
const drawMarkup = (ctx) => renderToStaticMarkup(createElement('svg', {viewBox: '0 0 360 160'}, focusFaceView.draw(ctx)))
const widthsOf = (markup, className) => [...markup.matchAll(new RegExp(`<rect[^>]*class="${className}"[^>]*>`, 'g'))]
  .map(match => Number(/width="([^"]+)"/.exec(match[0])[1]))

// ---- Model: paths, groups, compact, controlPath, activator, summary ----

test('paths are exactly the app panel numeric parameters (inspector.ts:230-232, registry group Composition)', () => {
  const registry = PARAM_REGISTRY.filter(row => row.group === 'Composition').map(row => row.path).sort()
  assert.deepEqual([...focusFaceModel.paths].sort(), registry)
  assert.deepEqual(focusFaceModel.paths.map(path => binding(path).key).sort(),
    ['focusDwell', 'focusGlide', 'native_composition__entityTintWeight', 'native_composition__orchestration__focusTintWeight'].sort())
  assert.equal(new Set(focusFaceModel.paths).size, focusFaceModel.paths.length)
})

test('groups cover paths exactly, once each, in the app titles', () => {
  const grouped = focusFaceModel.groups.flatMap(group => group.paths)
  assert.deepEqual(grouped.slice().sort(), [...focusFaceModel.paths].sort())
  assert.deepEqual(focusFaceModel.groups.map(group => group.title), ['Timing and direction', 'Visible contributions'])
})

test('compact is at most four paths, all numeric, and the three performer controls', () => {
  assert.ok(focusFaceModel.compact.length <= 4)
  assert.ok(focusFaceModel.compact.every(path => focusFaceModel.paths.includes(path)))
  assert.deepEqual(focusFaceModel.compact, [FOCUS_PATHS.dwell, FOCUS_PATHS.glide, FOCUS_PATHS.focusTint])
})

test('controlPath is a numeric path and no in-diagram handle drives it', () => {
  assert.ok(focusFaceModel.paths.includes(focusFaceModel.controlPath))
  const handlePaths = [FOCUS_PATHS.dwell, FOCUS_PATHS.glide, FOCUS_PATHS.focusTint]
  assert.equal(handlePaths.includes(focusFaceModel.controlPath), false)
  assert.equal(focusFaceModel.controlPath, FOCUS_PATHS.entityTint)
})

test('the device is registered under its key with the studio section focus', () => {
  assert.equal(FIELD_FACE_MODELS.focus, focusFaceModel)
  assert.equal(focusFaceModel.studio, 'focus')
  assert.equal(focusFaceModel.name, 'Travelling focus')
})

test('the activator is the travelling mode, a boolean from the reading; the strip has no toggle', () => {
  assert.equal(focusFaceModel.enabled(travelling), true)
  assert.equal(focusFaceModel.enabled(parallel), false)
  assert.equal(focusFaceModel.strip.toggle, null)
})

test('the strip summary is built from the reading values and the route', () => {
  const r = reading({dwell: 2.5, glide: 4})
  const summary = focusFaceModel.strip.summary(r)
  assert.equal(summary, 'travelling · 3 on route · dwell 2.5 s · glide 4 s')
  assert.equal(focusFaceModel.strip.summary(parallel).startsWith('parallel · 3 on route'), true)
})

// ---- Pure helpers: reorder, drop target, visit order, route rule, loop, ruler ----

test('reorder moves one item, never mutates, and returns a copy for invalid or equal indices', () => {
  const ids = ['a', 'b', 'c', 'd']
  assert.deepEqual(reorder(ids, 0, 2), ['b', 'c', 'a', 'd'])
  assert.deepEqual(reorder(ids, 3, 0), ['d', 'a', 'b', 'c'])
  assert.deepEqual(reorder(ids, 1, 1), ids)
  assert.deepEqual(reorder(ids, -1, 2), ids)
  assert.deepEqual(reorder(ids, 0, 4), ids)
  assert.deepEqual(reorder(ids, 1.5, 0), ids)
  assert.deepEqual(ids, ['a', 'b', 'c', 'd'])
})

test('a drop before an insertion index lands on the index after the row is removed', () => {
  assert.equal(dropTarget(0, 0, 3), 0)
  assert.equal(dropTarget(0, 1, 3), 0)
  assert.equal(dropTarget(0, 3, 3), 2)
  assert.equal(dropTarget(2, 0, 3), 0)
  assert.equal(dropTarget(1, 3, 3), 2)
  assert.equal(dropTarget(2, 2, 3), 2)
  assert.equal(reorder(['a', 'b', 'c'], 0, dropTarget(0, 3, 3)).join(''), 'bca')
})

test('visit order applies listed, reverse and pingpong as the engine does', () => {
  assert.deepEqual(visitOrder(['a', 'b', 'c'], 'listed'), ['a', 'b', 'c'])
  assert.deepEqual(visitOrder(['a', 'b', 'c'], 'reverse'), ['c', 'b', 'a'])
  assert.deepEqual(visitOrder(['a', 'b', 'c'], 'pingpong'), ['a', 'b', 'c', 'b'])
  assert.deepEqual(visitOrder(['a', 'b'], 'pingpong'), ['a', 'b'])
  assert.deepEqual(visitOrder(['a'], 'pingpong'), ['a'])
  assert.deepEqual(visitOrder([], 'pingpong'), [])
})

test('the step period is dwell + glide with the engine floor of 0.05 s', () => {
  assert.equal(focusPeriod(1.4, 2.4), 1.4 + 2.4)
  assert.equal(focusPeriod(0, 0), 0.05)
})

test('the engine route counts a formation as on unless its flag is false; pins never route', () => {
  const r = reading({entities: [formation('a', {enabled: undefined}), formation('b', {enabled: false}), PIN, formation('c')]})
  assert.deepEqual(focusRoute(r.scene).map(row => [row.id, row.number, row.enabled]), [['a', 1, true], ['b', 2, false], ['c', 3, true]])
  const loop = focusLoop(r.scene)
  assert.deepEqual(loop.steps.map(step => step.id), ['a', 'c'])
  assert.equal(loop.parallel, false)
})

test('the loop follows the focus order over enabled formations and reports the cycle in seconds', () => {
  const r = reading({order: 'reverse', dwell: 1, glide: 2})
  const loop = focusLoop(r.scene)
  assert.deepEqual(loop.steps.map(step => step.id), ['c', 'b', 'a'])
  assert.equal(loop.period, 3)
  assert.equal(loop.cycleSeconds, 9)
  assert.equal(focusLoop(parallel.scene).parallel, true)
})

test('a ruler handle sits at its real value on the fixed seconds scale', () => {
  const origin = 20, scale = 10
  for (const path of [FOCUS_PATHS.dwell, FOCUS_PATHS.glide]) {
    const geometry = rulerGeometry(binding(path), origin, 62, scale)
    for (const value of [0.02, 1.4, 12]) assert.ok(Math.abs(handlePosition(binding(path), geometry, value).x - (origin + value * scale)) < 1e-9, `${path} at ${value}`)
  }
  assert.equal(RULER_SECONDS, 30)
})

test('route-order changes are exactly the admitted shape, over every formation including disabled ones', () => {
  const r = reading({entities: [formation('a'), formation('b', {enabled: false}), PIN, formation('c')]})
  const ids = focusRoute(r.scene).map(row => row.id)
  const change = routeOrderChange(reorder(ids, 2, 0))
  assert.deepEqual(validateNativeRouteOrderChange(change), {kind: 'route-order', entity_ids: ['c', 'a', 'b']})
  // The boundary validator checks shape; the complete-permutation rule is enforced when the route is applied (nativeDeviceEdits.ts:72-76).
  assert.throws(() => validateNativeRouteOrderChange({kind: 'route-order', entity_ids: ['a', 3]}), /complete list of formation ids/)
})

// ---- View: diagram ----

test('the diagram exposes three handles with their real labels and never the entity tint', () => {
  const markup = drawMarkup(ctxFor(travelling))
  const labels = [...markup.matchAll(/role="slider"[^>]*aria-label="([^"]+)"/g)].map(match => match[1])
  assert.deepEqual(labels.sort(), ['Focus Dwell', 'Focus Glide', 'Focus Tint Weight'].sort())
  assert.equal(labels.includes('Entity Tint Weight'), false)
  assert.match(markup, /aria-label="Focus Dwell"[^>]*aria-valuenow="1\.4"/)
})

test('the dwell segments change width when the drawing value changes, from the value function', () => {
  const at1 = widthsOf(drawMarkup(ctxFor(travelling, {value: path => path === FOCUS_PATHS.dwell ? 1 : undefined})), 'native-focus-dwell')
  const at3 = widthsOf(drawMarkup(ctxFor(travelling, {value: path => path === FOCUS_PATHS.dwell ? 3 : undefined})), 'native-focus-dwell')
  const scale = 320 / RULER_SECONDS
  assert.ok(at1.length === 3 && at3.length === 3, 'one dwell segment per enabled formation')
  at1.forEach(width => assert.ok(Math.abs(width - 1 * scale) < 1e-6))
  at3.forEach(width => assert.ok(Math.abs(width - 3 * scale) < 1e-6))
})

test('the glide segments are proportional to the real glide value, and the period is labelled', () => {
  const markup = drawMarkup(ctxFor(travelling))
  const glides = widthsOf(markup, 'native-focus-glide')
  const scale = 320 / RULER_SECONDS
  glides.forEach(width => assert.ok(Math.abs(width - 2.4 * scale) < 1e-6))
  assert.match(markup, />Step 3\.8 s · cycle 3 = 11\.4 s</)
})

test('the diagram names the parallel state, the empty route and the missing live position without drawing a playhead', () => {
  assert.match(drawMarkup(ctxFor(parallel)), /Parallel · route not played/)
  const empty = reading({entities: [PIN]})
  assert.match(drawMarkup(ctxFor(empty)), /No enabled formation on the route/)
  const markup = drawMarkup(ctxFor(travelling))
  assert.match(markup, /no live focus position in the reading/)
  assert.equal(/playhead/i.test(markup), false)
})

test('the tint bars are drawn from the reading; the focus tint bar carries its handle on its centreline', () => {
  const markup = drawMarkup(ctxFor(travelling))
  assert.match(markup, /Entity tint 0\.6/)
  assert.match(markup, /Focus tint 0\.35/)
  const widths = widthsOf(markup, 'native-focus-track')
  assert.equal(widths.length, 3)
  assert.match(markup, /aria-label="Focus Tint Weight"[^>]*aria-valuenow="0\.35"/)
})

// ---- View: switches (host controls invoked with a stub apply) ----

test('the orchestration select writes the admitted focus panel setting and passes boundary validation', () => {
  const calls = []
  const tree = FocusSwitches({reading: parallel, disabled: false, apply: async changes => (calls.push(changes), {ok: true})})
  control(tree, 'Orchestration').props.onChange({target: {value: 'travelling'}})
  assert.deepEqual(calls, [[{kind: 'panel-setting', key: 'focus', value: 'travelling'}]])
  assert.deepEqual(validateNativeFieldPanelChange(calls[0][0]), {kind: 'panel-setting', key: 'focus', value: 'travelling'})
})

test('traversal, carry tint, tuning driver emit their exact admitted changes', () => {
  const calls = []
  const tree = FocusSwitches({reading: travelling, disabled: false, apply: async changes => (calls.push(changes), {ok: true})})
  control(tree, 'Traversal').props.onChange({target: {value: 'pingpong'}})
  control(tree, 'Carry local tint').props.onChange({target: {checked: false}})
  control(tree, 'Shared tuning driver').props.onChange({target: {value: 'automation'}})
  assert.deepEqual(calls.map(call => call[0]), [
    {kind: 'panel-setting', key: 'focusOrder', value: 'pingpong'},
    {kind: 'panel-setting', key: 'carryTint', value: false},
    {kind: 'panel-setting', key: 'frequencyDriver', value: 'automation'},
  ])
  calls.forEach(call => validateNativeFieldPanelChange(call[0]))
})

test('the legacy station switch is labelled legacy and writes carryStation, unless semantic bindings replace it', () => {
  const calls = []
  const legacy = FocusSwitches({reading: travelling, disabled: false, apply: async changes => (calls.push(changes), {ok: true})})
  control(legacy, 'Follow linked stations · legacy').props.onChange({target: {checked: true}})
  assert.deepEqual(calls[0], [{kind: 'panel-setting', key: 'carryStation', value: true}])
  validateNativeFieldPanelChange(calls[0][0])
  const semantic = FocusSwitches({reading: reading({semanticBindings: 1}), disabled: false, apply: async () => ({ok: true})})
  assert.equal([...elements(semantic)].some(el => el.type === 'label' && textOf(el).startsWith('Follow linked stations')), false)
  assert.match(renderToStaticMarkup(semantic), /Semantic resonance follows stable bindings/)
})

test('every host control is disabled while the native editor is busy or pending', () => {
  const tree = FocusSwitches({reading: travelling, disabled: true, apply: async () => ({ok: true})})
  for (const caption of ['Orchestration', 'Traversal', 'Carry local tint', 'Follow linked stations', 'Shared tuning driver']) {
    assert.equal(control(tree, caption).props.disabled, true, caption)
  }
})

test('the frequency driver note says it is the same setting as the Resonance panel', () => {
  assert.match(renderToStaticMarkup(FocusSwitches({reading: travelling, disabled: false, apply: async () => ({ok: true})})), /Also in Resonance/)
})

// ---- View: route list ----

test('the route list shows every formation in route order, dims disabled ones with the reason, and has move controls', () => {
  const r = reading({entities: [formation('a'), formation('b', {enabled: false}), formation('c')]})
  const markup = renderToStaticMarkup(createElement(FocusRoute, {reading: r, disabled: false, apply: async () => ({ok: true})}))
  assert.equal([...markup.matchAll(/data-route-id="([^"]+)"/g)].map(match => match[1]).join(','), 'a,b,c')
  assert.equal((markup.match(/not in the engine route/g) ?? []).length, 1)
  assert.match(markup, /class="native-focus-route-name"[^>]*>B<small> · not in the engine route<\/small>/)
  assert.match(markup, /<button[^>]*disabled=""[^>]*aria-label="Move A earlier"/)
  assert.match(markup, /<button[^>]*disabled=""[^>]*aria-label="Move C later"/)
})

test('the route list is an empty state rather than a blank list when the Scene has no formation', () => {
  const markup = renderToStaticMarkup(createElement(FocusRoute, {reading: reading({entities: [PIN]}), disabled: false, apply: async () => ({ok: true})}))
  assert.match(markup, /This Scene has no formation/)
  assert.equal(markup.includes('data-route-id'), false)
})
