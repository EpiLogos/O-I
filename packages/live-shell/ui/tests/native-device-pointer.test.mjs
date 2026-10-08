import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {register} from 'node:module'
import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'

// Production handle model and component in memory, same loader as the sibling native tests (.tsx transpiled, .css stubbed).
// The reading is a minimal fixture; it is not a native owner or a saved receipt.
const root = new URL('../../../../', import.meta.url)
const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
const parameters = new URL('packages/expressions-boundary/src/parameters.ts', root).href
register(`data:text/javascript,${encodeURIComponent(`import ts from ${JSON.stringify(compiler)};import {readFile} from 'node:fs/promises';export async function resolve(s,c,n){if(s==='@epilogos/expressions-boundary/parameters')return n(${JSON.stringify(parameters)},c);try{return await n(s,c)}catch(e){if(!s.startsWith('.'))throw e;if(s.endsWith('.js')){try{return await n(s.slice(0,-3)+'.ts',c)}catch{}}for(const x of ['.ts','.tsx']){try{return await n(s+x,c)}catch{}}throw e}}export async function load(u,c,n){if(u.endsWith('.css'))return {format:'module',shortCircuit:true,source:'export {}'};if(u.endsWith('?raw'))return {format:'module',shortCircuit:true,source:'export default '+JSON.stringify(await readFile(new URL(u.split('?')[0]),'utf8'))};if(!u.endsWith('.ts')&&!u.endsWith('.tsx'))return n(u,c);return {format:'module',shortCircuit:true,source:ts.transpileModule(await readFile(new URL(u),'utf8'),{fileName:new URL(u).pathname,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText}}`)}`, import.meta.url)

const [model, {NATIVE_BINDINGS, baseValue, bindValue}, face, handleModel, registry, views, panel] = await Promise.all([
  import('../src/components/nativeFieldFace.pointer.ts'),
  import(parameters),
  import('../src/components/NativeFieldFace.pointer.tsx'),
  import('../src/components/nativeFieldHandleModel.ts'),
  import('../src/components/nativeFieldFaceModel.ts'),
  import('../src/components/nativeFieldFaceViews.tsx'),
  import('../../../expressions-boundary/src/nativeFieldPanelSettings.ts'),
])
const pointerModel = model.pointerFaceModel, pointerView = face.pointerFaceView

// Fixture reading in the shape the sibling native tests use. Values are written through their binding documents, as the editor reads them.
const ENGINE = {mediumEnabled: false, resonanceEnabled: false, collisionEnabled: false, pairwiseEnabled: false, morphEnabled: false,
  colorEnabled: false, trajectory: 'toroidalHopf', driveShape: 'sine', colorMode: 'linearGradient', mediumPlane: 'vertical', autoOscillate: true,
  pointerMode: 'attract', pointerClick: 'pulse'}
function reading(values = {}, {engine = {}, pointerScope} = {}) {
  const scene = {name: 'Fixture', entities: [], engine: {...ENGINE, ...engine}, field: {background: '#ffffff', palette: ['#111111'], material: 'ink', params: {}}}
  if (pointerScope) scene.pointerScope = pointerScope
  for (const [path, value] of Object.entries(values)) bindValue(scene, NATIVE_BINDINGS.find(row => row.path === path).bind, value)
  return {
    basis: {expression_ref: 'expr:fixture', revision: 1, scene_ref: 'scene:fixture', authored_revision: 1},
    scene, entityOccurrences: {}, chosenControls: {available: false, entries: [], controls: []},
    selection: {entity_ids: [], step_id: null}, history: {canUndo: false, canRedo: false},
    standing: {dirty: false, pending: false, notice: null},
  }
}
// The shell's own value reader: the binding's base value, as NativeDeviceEditors computes it.
const nativeValue = (scene, path) => baseValue(scene, NATIVE_BINDINGS.find(row => row.path === path).key)
const ctxFor = (r, over = {}) => ({reading: r, graphValue: 0, position: 0, value: path => nativeValue(r.scene, path), family: 'pointer', disabled: false,
  apply: () => Promise.resolve({ok: true}), captureCurrent: () => () => false, setDraft: () => {}, ...over})
const svg = nodes => renderToStaticMarkup(createElement('svg', {viewBox: '0 0 360 160'}, nodes))
const bindingOf = path => NATIVE_BINDINGS.find(row => row.path === path)
const expectedRadius = (path, value) => 52 * handleModel.fraction(bindingOf(path), value)
const close = (actual, expected, eps = 1e-6) => assert.ok(Math.abs(actual - expected) <= eps, `${actual} != ${expected}`)
// Walks a React element tree without rendering it, so switch handlers can be invoked directly.
function walk(node, visit) {
  if (node === null || node === undefined || typeof node !== 'object') return
  if (Array.isArray(node)) {for (const child of node) walk(child, visit); return}
  visit(node)
  walk(node.props?.children, visit)
}
const nodesWhere = (tree, predicate) => {const hits = []; walk(tree, node => {if (predicate(node)) hits.push(node)}); return hits}

test('registry: the device is the pointer key in both registries', () => {
  assert.equal(registry.FIELD_FACE_MODELS.pointer, pointerModel)
  assert.equal(views.FIELD_FACE_VIEWS.pointer, pointerView)
  assert.ok(!('interaction' in registry.FIELD_FACE_MODELS), 'the planned interaction key is gone')
})

test('paths are exactly the numeric parameters of the app Pointer panel, in app order', () => {
  const appPanel = NATIVE_BINDINGS.filter(row => row.group === 'pointer').map(row => row.path)
  assert.equal(appPanel.length, 6)
  assert.deepEqual(pointerModel.paths, appPanel)
  assert.deepEqual([...pointerModel.paths].sort(), ['interaction.clickRadius', 'interaction.clickStrength', 'interaction.falloffPower', 'interaction.radius', 'interaction.strength', 'interaction.velocityInfluence'])
})

test('groups cover paths exactly once and carry the app title for the Pointer group', () => {
  const grouped = pointerModel.groups.flatMap(group => group.paths)
  assert.deepEqual([...grouped].sort(), [...pointerModel.paths].sort())
  assert.equal(new Set(grouped).size, grouped.length, 'no path is grouped twice')
  assert.deepEqual(pointerModel.groups.map(group => group.title), ['Click effect', 'Pointer'])
})

test('compact is at most four distinct paths of this device', () => {
  assert.ok(pointerModel.compact.length <= 4)
  assert.equal(new Set(pointerModel.compact).size, pointerModel.compact.length)
  for (const path of pointerModel.compact) assert.ok(pointerModel.paths.includes(path), path)
})

test('the bottom slider path is a device path that no in-diagram handle drives', () => {
  assert.ok(pointerModel.paths.includes(pointerModel.controlPath))
  assert.equal(new Set(face.POINTER_HANDLE_PATHS).size, 4)
  for (const path of face.POINTER_HANDLE_PATHS) assert.ok(pointerModel.paths.includes(path), path)
  assert.ok(!face.POINTER_HANDLE_PATHS.includes(pointerModel.controlPath), 'controlPath must differ from every handle')
})

test('no enable operation: the light is unknown on every reading, the card has no toggle, and the studio section is pointer', () => {
  for (const r of [reading(), reading({}, {engine: {pointerMode: 'repel', pointerClick: 'off'}})]) assert.equal(pointerModel.enabled(r), undefined)
  assert.equal(pointerModel.strip.toggle, null)
  assert.equal(pointerModel.studio, 'pointer')
  assert.equal(pointerModel.name, 'Pointer')
})

test('strip summary shows the mode and the bound values from the reading', () => {
  const first = reading({'interaction.radius': 0.5, 'interaction.strength': -2}, {engine: {pointerMode: 'repel'}})
  assert.equal(pointerModel.strip.summary(first), 'repel · r 0.5 · strength -2')
  const second = reading({'interaction.radius': 1.25, 'interaction.strength': 4}, {engine: {pointerMode: 'vortex'}})
  assert.equal(pointerModel.strip.summary(second), 'vortex · r 1.25 · strength 4')
})

test('the drawing renders exactly four slider handles, each with the app label of its parameter', () => {
  const markup = svg(pointerView.draw(ctxFor(reading())))
  assert.equal(markup.match(/role="slider"/g).length, 4)
  for (const label of ['Cursor Radius', 'Click Radius', 'Falloff Power', 'Cursor Force']) assert.ok(markup.includes(`aria-label="${label}"`), label)
})

test('the disc and click ring are computed from the context values, so a live draft moves the diagram', () => {
  const base = reading({'interaction.radius': 1, 'interaction.clickRadius': 0.5})
  const drawn = overrides => svg(pointerView.draw(ctxFor(base, {value: path => path in overrides ? overrides[path] : nativeValue(base.scene, path)})))
  const disc = markup => Number(markup.match(/<circle cx="80" cy="80" r="([0-9.e-]+)" class="native-medium-boundary"/)[1])
  const ring = markup => Number(markup.match(/<circle cx="80" cy="80" r="([0-9.e-]+)" class="native-pointer-click-ring/)[1])
  close(disc(drawn({})), expectedRadius('interaction.radius', 1))
  close(ring(drawn({})), expectedRadius('interaction.clickRadius', 0.5))
  // A handle draft for radius (4) must redraw the disc, not the stored value (1).
  close(disc(drawn({'interaction.radius': 4})), expectedRadius('interaction.radius', 4))
  assert.notEqual(disc(drawn({'interaction.radius': 4})), disc(drawn({})))
  // Strength draws a signed bar from the zero line at y=80 to the strength position (written to two decimals).
  const bar = markup => Number(markup.match(/d="M300 80V([0-9.e-]+)"/)[1])
  close(bar(drawn({'interaction.strength': 30})), 124 - 88 * handleModel.fraction(bindingOf('interaction.strength'), 30), 0.01)
  close(bar(drawn({'interaction.strength': -30})), 124 - 88 * handleModel.fraction(bindingOf('interaction.strength'), -30), 0.01)
})

test('force arrows follow the engine sign convention and vanish at zero strength', () => {
  const first = (markup, cls) => markup.match(new RegExp(`d="M([-0-9.]+) ([-0-9.]+)L([-0-9.]+) ([-0-9.]+)M[^"]*" class="native-pointer-arrow ${cls}"`))
  // Falloff exponent 1 keeps the inner arrows above the draw threshold; strength +-10 is a third of its soft maximum.
  const draw = (mode, strength) => svg(pointerView.draw(ctxFor(reading({'interaction.radius': 3, 'interaction.strength': strength, 'interaction.falloffPower': 1}, {engine: {pointerMode: mode}}))))
  // Repel, positive: the first arrow (angle 0) points outward, so its tip lies to the right of its tail.
  const repel = first(draw('repel', 10), 'is-positive')
  assert.ok(repel && Number(repel[3]) > Number(repel[1]), 'repel pushes outward')
  // Attract, positive: the same arrow points inward; negative strength reverses it.
  const attract = first(draw('attract', 10), 'is-positive')
  assert.ok(attract && Number(attract[3]) < Number(attract[1]), 'attract pulls inward')
  const reversed = first(draw('attract', -10), 'is-negative')
  assert.ok(reversed && Number(reversed[3]) > Number(reversed[1]), 'negative attract points outward')
  assert.equal(draw('attract', -10).includes('is-positive'), false)
  assert.equal(draw('attract', 0).includes('native-pointer-arrow'), false, 'zero strength draws no arrows')
})

test('switches: the three non-numeric controls use the admitted option lists and the exact panel-setting shapes', () => {
  const applied = []
  const tree = pointerView.switches({reading: reading(), disabled: false, apply: changes => {applied.push(changes); return Promise.resolve({ok: true})}})
  const control = label => nodesWhere(tree, node => node.props?.['aria-label'] === label && (node.type === 'select'))[0]
  const options = label => nodesWhere(control(label), node => node.type === 'option').map(node => node.props.value)
  assert.deepEqual(options('Pointer scope'), panel.FIELD_PANEL_SETTINGS.pointerScope.options)
  assert.deepEqual(options('Temporary pointer force'), panel.FIELD_PANEL_SETTINGS.pointerMode.options)
  assert.deepEqual(options('Click effect'), panel.FIELD_PANEL_SETTINGS.pointerClick.options)
  control('Pointer scope').props.onChange({target: {value: 'local'}})
  control('Temporary pointer force').props.onChange({target: {value: 'repel'}})
  control('Click effect').props.onChange({target: {value: 'implode'}})
  assert.deepEqual(applied, [
    [{kind: 'panel-setting', key: 'pointerScope', value: 'local'}],
    [{kind: 'panel-setting', key: 'pointerMode', value: 'repel'}],
    [{kind: 'panel-setting', key: 'pointerClick', value: 'implode'}],
  ])
  const markup = renderToStaticMarkup(tree)
  assert.ok(!markup.includes('type="checkbox"'), 'no enable checkbox: the device has no enable operation')
  assert.equal(markup.match(/<select/g).length, 3)
})

test('switches show the current values and disable every control when the device is disabled', () => {
  const r = reading({}, {engine: {pointerMode: 'vortex', pointerClick: 'off'}, pointerScope: 'local'})
  const markup = renderToStaticMarkup(pointerView.switches({reading: r, disabled: true, apply: () => Promise.resolve({ok: true})}))
  assert.equal(markup.match(/disabled=""/g).length, 3)
  assert.match(markup, /<option value="vortex" selected=""/)
  assert.match(markup, /<option value="off" selected=""/)
  assert.match(markup, /<option value="local" selected=""/)
  assert.ok(markup.includes('Local: this scene keeps its own pointer values.'))
})
