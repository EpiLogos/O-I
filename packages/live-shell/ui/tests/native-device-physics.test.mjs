import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {register} from 'node:module'
import {createElement, isValidElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'

// Production physics model and view in memory, same loader as the sibling native tests (.tsx transpiled, .css stubbed).
// The reading is a minimal fixture; it is not a native owner or a saved receipt.
const root = new URL('../../../../', import.meta.url)
const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
const parameters = new URL('packages/expressions-boundary/src/parameters.ts', root).href
register(`data:text/javascript,${encodeURIComponent(`import ts from ${JSON.stringify(compiler)};import {readFile} from 'node:fs/promises';export async function resolve(s,c,n){if(s==='@epilogos/expressions-boundary/parameters')return n(${JSON.stringify(parameters)},c);try{return await n(s,c)}catch(e){if(!s.startsWith('.'))throw e;if(s.endsWith('.js')){try{return await n(s.slice(0,-3)+'.ts',c)}catch{}}for(const x of ['.ts','.tsx']){try{return await n(s+x,c)}catch{}}throw e}}export async function load(u,c,n){if(u.endsWith('.css'))return {format:'module',shortCircuit:true,source:'export {}'};if(u.endsWith('?raw'))return {format:'module',shortCircuit:true,source:'export default '+JSON.stringify(await readFile(new URL(u.split('?')[0]),'utf8'))};if(!u.endsWith('.ts')&&!u.endsWith('.tsx'))return n(u,c);return {format:'module',shortCircuit:true,source:ts.transpileModule(await readFile(new URL(u),'utf8'),{fileName:new URL(u).pathname,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText}}`)}`, import.meta.url)
const [{FIELD_FACE_MODELS}, {physicsFaceModel}, {physicsFaceView, PHYSICS_HANDLE_PATHS}, {FIELD_FACE_VIEWS}, {NATIVE_BINDINGS, bindValue, baseValue}] = await Promise.all([
  import('../src/components/nativeFieldFaceModel.ts'),
  import('../src/components/nativeFieldFace.physics.ts'),
  import('../src/components/NativeFieldFace.physics.tsx'),
  import('../src/components/nativeFieldFaceViews.tsx'),
  import(parameters),
])
const {NativeEngineActionsView} = await import('../src/components/NativeEngineActions.tsx')
const engine = await import('../src/native/engineCommand.ts')

const binding = path => {
  const found = NATIVE_BINDINGS.find(row => row.path === path)
  assert.ok(found, `missing native binding ${path}`)
  return found
}
const ENGINE = {mediumEnabled: false, resonanceEnabled: false, collisionEnabled: false, pairwiseEnabled: false, morphEnabled: false,
  colorEnabled: false, trajectory: 'toroidalHopf', driveShape: 'sine', colorMode: 'linearGradient', mediumPlane: 'vertical', autoOscillate: true}
// Fixture values are written through the same binding document path the reading uses.
const DEFAULTS = {'fluid.viscosity': 0.25, 'fluid.vortexStrength': 3, 'fluid.curlScale': 1, 'fluid.vortexRadius': 1, 'fluid.gravityX': 0, 'fluid.gravityY': -2,
  'fluid.gravityZ': 0.5, 'fluid.quadraticDrag': 0.2, 'fluid.maxSpeed': 80, 'fluid.timeScale': 1}
function reading(values = {}, engine = {}) {
  const scene = {name: 'Fixture', entities: [], engine: {...ENGINE, ...engine}, field: {background: '#ffffff', palette: ['#111111'], material: 'ink', params: {}}}
  for (const [path, value] of Object.entries({...DEFAULTS, ...values})) bindValue(scene, binding(path).bind, value)
  return {
    basis: {expression_ref: 'expr:fixture', revision: 1, scene_ref: 'scene:fixture', authored_revision: 1},
    scene, entityOccurrences: {}, chosenControls: {available: false, entries: [], controls: []},
    selection: {entity_ids: [], step_id: null}, history: {canUndo: false, canRedo: false},
    standing: {dirty: false, pending: false, notice: null},
  }
}
const APP_PHYSICS = NATIVE_BINDINGS.filter(row => row.group === 'motion' || row.group === 'physics').map(row => row.path)

test('registry: the physics device replaces flow under its own key', () => {
  assert.equal(FIELD_FACE_MODELS.physics, physicsFaceModel)
  assert.equal(FIELD_FACE_VIEWS.physics, physicsFaceView)
  assert.equal('flow' in FIELD_FACE_MODELS, false)
  assert.equal('flow' in FIELD_FACE_VIEWS, false)
})

test('paths are the whole app Physics panel: exactly the Fluid and Physics+ registry parameters, in registry order', () => {
  assert.equal(APP_PHYSICS.length, 19, 'the app panel holds 19 numeric parameters')
  assert.deepEqual([...physicsFaceModel.paths].sort(), [...APP_PHYSICS].sort())
  assert.equal(new Set(physicsFaceModel.paths).size, physicsFaceModel.paths.length, 'no duplicate paths')
  assert.deepEqual([...physicsFaceModel.paths], APP_PHYSICS, 'the order is the app order')
})

test('groups follow the app: Fluid (motion) then Physics+ (physics), covering paths exactly', () => {
  assert.deepEqual(physicsFaceModel.groups.map(group => group.title), ['Fluid', 'Physics+'])
  const [fluid, plus] = physicsFaceModel.groups
  assert.deepEqual([...fluid.paths], NATIVE_BINDINGS.filter(row => row.group === 'motion').map(row => row.path))
  assert.deepEqual([...plus.paths], NATIVE_BINDINGS.filter(row => row.group === 'physics').map(row => row.path))
  assert.equal(fluid.paths.length, 7)
  assert.equal(plus.paths.length, 12)
  const grouped = physicsFaceModel.groups.flatMap(group => [...group.paths])
  assert.deepEqual(grouped, [...physicsFaceModel.paths], 'groups cover paths exactly, with no duplicates')
})

test('compact: at most four controls, all parameters of the device', () => {
  assert.ok(physicsFaceModel.compact.length <= 4)
  assert.equal(new Set(physicsFaceModel.compact).size, physicsFaceModel.compact.length)
  for (const path of physicsFaceModel.compact) assert.ok(physicsFaceModel.paths.includes(path), `${path} is a device parameter`)
  assert.deepEqual([...physicsFaceModel.compact], ['fluid.viscosity', 'fluid.vortexStrength', 'fluid.gravityY', 'fluid.timeScale'])
})

test('slider path is vortexStrength, never a handle path; handle paths are real device parameters', () => {
  assert.equal(physicsFaceModel.controlPath, 'fluid.vortexStrength')
  assert.ok(physicsFaceModel.paths.includes(physicsFaceModel.controlPath))
  assert.ok(!PHYSICS_HANDLE_PATHS.includes(physicsFaceModel.controlPath))
  assert.deepEqual([...PHYSICS_HANDLE_PATHS], ['fluid.vortexRadius', 'fluid.gravityX', 'fluid.gravityY', 'fluid.timeScale'])
  for (const path of PHYSICS_HANDLE_PATHS) assert.ok(physicsFaceModel.paths.includes(path), `${path} is a device parameter`)
})

test('studio section is the app shell id for Physics', () => {
  assert.equal(physicsFaceModel.studio, 'physics')
  assert.equal(physicsFaceModel.name, 'Physics')
})

test('no enable operation: the light is unknown and the card has no toggle', () => {
  for (const r of [reading(), reading({}, {mediumEnabled: true, resonanceEnabled: true, pairwiseEnabled: true})]) {
    assert.equal(physicsFaceModel.enabled(r), undefined)
  }
  assert.equal(physicsFaceModel.strip.toggle, null)
})

test('strip summary keeps the old flow text and reads its values from the reading', () => {
  assert.equal(physicsFaceModel.strip.summary(reading({'fluid.viscosity': 0.25, 'fluid.vortexStrength': 3})), 'viscosity 0.25 · vortex 3')
  assert.equal(physicsFaceModel.strip.summary(reading({'fluid.viscosity': 0.6, 'fluid.vortexStrength': -12.5})), 'viscosity 0.6 · vortex -12.5')
})

// SSR fixture for the view: the diagram context the editor supplies, with ctx.value reading the reading unless overridden.
const noop = () => {throw Error('SSR must not dispatch')}
function drawCtx(r, overrides = {}) {
  return {reading: r, graphValue: 0, position: 0, family: 'physics', disabled: false, apply: noop, captureCurrent: () => () => false, setDraft: () => {},
    value: path => path in overrides ? overrides[path] : baseValue(r.scene, binding(path).key)}
}
const svg = node => renderToStaticMarkup(createElement('svg', {viewBox: '0 0 360 160'}, node))

test('SSR draw: four handles with the binding labels, role slider and exact aria values', () => {
  const r = reading()
  const html = svg(physicsFaceView.draw(drawCtx(r)))
  for (const path of PHYSICS_HANDLE_PATHS) {
    assert.match(html, new RegExp(`role="slider"[^>]*aria-label="${binding(path).label}"|aria-label="${binding(path).label}"[^>]*role="slider"`), `${path} handle`)
  }
  assert.equal((html.match(/role="slider"/g) ?? []).length, 4, 'exactly the four diagram handles')
  assert.match(html, /class="native-field-handle is-ring"/)
  assert.equal((html.match(/is-bar/g) ?? []).length, 3)
  assert.ok(!html.includes(`aria-label="${binding('fluid.vortexStrength').label}"`), 'the slider path is not a diagram handle')
  // The vortex radius handle's value text comes from the reading.
  assert.match(html, new RegExp(`aria-valuenow="${baseValue(r.scene, binding('fluid.vortexRadius').key)}"`))
})

test('the diagram changes when ctx.value changes: gravity X draws its arrow to the handle projection', () => {
  const r = reading()
  const at = (gx) => svg(physicsFaceView.draw(drawCtx(r, {'fluid.gravityX': gx})))
  const neutral = at(0), pushed = at(10), pulled = at(-10)
  assert.notEqual(neutral, pushed)
  assert.notEqual(pushed, pulled)
  // Gravity X 10 is the soft maximum: the arrow tip sits on the box edge at x = 128 + 80 = 208 (the horizontal handle end).
  assert.match(pushed, /L208 /)
  assert.match(pulled, /L128 /)
  // Gravity X 0 puts the tip on the box centre line (x = 168); the vertical component still draws from Gravity Y.
  assert.match(neutral, /L168 /)
})

test('the vortex field and ring respond to vortex strength and curl scale from the reading', () => {
  const r = reading()
  const weak = svg(physicsFaceView.draw(drawCtx(r, {'fluid.vortexStrength': 1})))
  const strong = svg(physicsFaceView.draw(drawCtx(r, {'fluid.vortexStrength': 20})))
  assert.notEqual(weak, strong)
  const count = html => (html.match(/class="native-force-vector"/g) ?? []).length
  assert.ok(count(strong) > 0)
  const finer = svg(physicsFaceView.draw(drawCtx(r, {'fluid.curlScale': 8})))
  const coarse = svg(physicsFaceView.draw(drawCtx(r, {'fluid.curlScale': 0.05})))
  assert.notEqual(finer, coarse, 'the curl scale changes the sample density')
  assert.match(svg(physicsFaceView.draw(drawCtx(r, {'fluid.curlScale': 1}))), /curl cell 285\.7/, 'one noise cell is 1 / (0.0035 x curl scale) px')
})

test('the speed decay curve uses viscosity and drag and marks the limit', () => {
  const r = reading({'fluid.maxSpeed': 80})
  const plain = svg(physicsFaceView.draw(drawCtx(r, {'fluid.quadraticDrag': 0})))
  const dragged = svg(physicsFaceView.draw(drawCtx(r, {'fluid.quadraticDrag': 900})))
  assert.notEqual(plain, dragged)
  assert.match(plain, /limit<\/text>/)
  // Viscosity 0.5 halves the speed on the first step (simulationShaders.ts:1208), so the half-speed note reads step 1.
  const halfAfter = overrides => svg(physicsFaceView.draw(drawCtx(reading({}), overrides)))
  assert.match(halfAfter({'fluid.viscosity': 0.5, 'fluid.quadraticDrag': 0}), /half speed at 1 steps/)
  // Viscosity 1 with no drag never falls to half speed inside the 60 steps.
  assert.match(halfAfter({'fluid.viscosity': 1, 'fluid.quadraticDrag': 0}), /half speed beyond 60 steps/)
})

test('a missing reading names what is missing and draws no handles', () => {
  const html = svg(physicsFaceView.draw(drawCtx(reading(), {'fluid.gravityY': undefined})))
  assert.match(html, /No reading for fluid\.gravityY/)
  assert.ok(!html.includes('role="slider"'))
})

// Walks a React element tree for the first element whose props match.
function findElement(node, match) {
  if (!isValidElement(node)) {
    if (Array.isArray(node)) for (const child of node) {const found = findElement(child, match); if (found) return found}
    return null
  }
  if (match(node)) return node
  const children = node.props?.children
  return findElement(children, match)
}

test('switches: plane select renders the app options; pause stays text, and the runtime actions are buttons that name why they are off', () => {
  const r = reading({}, {mediumPlane: 'horizontal'})
  const element = physicsFaceView.switches({reading: r, disabled: false, apply: noop})
  const html = renderToStaticMarkup(element)
  assert.match(html, /aria-label="Physical medium plane"/)
  assert.match(html, /<option value="vertical">XY · vertical<\/option>/)
  assert.match(html, /<option value="horizontal"[^>]*>XZ · horizontal<\/option>/)
  assert.match(html, /<option value="horizontal" selected="">/, 'the select reads the reading')
  assert.match(html, /Pause physics[^<]*runtime action, not an authored setting/, 'pause has no control yet, so it stays text')
  assert.doesNotMatch(html, /Disperse: runtime action|Reset: runtime action/, 'the disclosure lines are replaced by controls')
  const names = [...html.matchAll(/<button[^>]*>([^<]*)<\/button>/g)].map(match => match[1])
  assert.deepEqual(names, ['Disperse particles', 'Reset phases', 'Recover field', 'Reset field'])
  // Server rendering reads the mount reading as unmounted: the honest state when no native Expression is open.
  assert.match(html, /No native Expression is mounted\./)
  assert.equal((html.match(/<button[^>]*disabled=""/g) ?? []).length, 4, 'every runtime button is off with its reason')
  assert.equal((html.match(/<input/g) ?? []).length, 0, 'no checkbox pretends to pause the field')
})

const findButton = (tree, label) => findElement(tree, node => node.type === 'button' && node.props?.children === label)

test('the runtime actions send one typed request each, and reset asks before it sends', () => {
  const sent = []
  let asks = 0, cancels = 0
  // The view has no hooks, so its returned tree is walked directly.
  const view = props => NativeEngineActionsView({reason: null, confirming: false, noteId: 'native-engine-note-test', onRequest: request => sent.push(request),
    onAskConfirm: () => asks++, onCancelConfirm: () => cancels++, ...props})
  const idle = view({})
  findButton(idle, 'Disperse particles').props.onClick()
  findButton(idle, 'Reset phases').props.onClick()
  findButton(idle, 'Recover field').props.onClick()
  assert.deepEqual(sent, [{action: 'disperse'}, {action: 'reset-phases'}, {action: 'recover'}])
  findButton(idle, 'Reset field').props.onClick()
  assert.equal(asks, 1)
  assert.equal(sent.length, 3, 'the first reset press sends nothing')
  const asking = view({confirming: true})
  assert.equal(findButton(asking, 'Reset field'), null, 'the confirm step replaces the first reset press')
  findButton(asking, 'Confirm reset (reseeds particles)').props.onClick()
  assert.deepEqual(sent[3], {action: 'reset', confirmed: true}, 'only the confirmed reset carries confirmed: true')
  findButton(asking, 'Cancel reset').props.onClick()
  assert.equal(cancels, 1)
  assert.equal(sent.length, 4)
  const html = renderToStaticMarkup(view({confirming: true}))
  assert.match(html, /Confirm reset \(reseeds particles\)/)
  assert.match(html, /Cancel reset/)
  assert.doesNotMatch(html, />Reset field</, 'the two-step markup replaces the first reset button')
})

test('a busy device names its reason once, and the note is what the buttons describe', () => {
  const reason = 'Wait for the native work to finish saving.'
  const busy = renderToStaticMarkup(createElement(NativeEngineActionsView, {reason, confirming: false, noteId: 'native-engine-note-busy', onRequest() {}, onAskConfirm() {}, onCancelConfirm() {}}))
  assert.equal((busy.match(/<button[^>]*disabled=""/g) ?? []).length, 4)
  const id = busy.match(/<small id="([^"]+)" class="native-engine-note">/)?.[1]
  assert.ok(id, 'the reason is a note with an id')
  assert.equal((busy.match(new RegExp(`aria-describedby="${id}"`, 'g')) ?? []).length, 4, 'every off button is described by the note')
  assert.match(busy, new RegExp(reason.replace(/\./g, '\\.')))
  const ready = renderToStaticMarkup(createElement(NativeEngineActionsView, {reason: null, confirming: false, noteId: 'native-engine-note-ready', onRequest() {}, onAskConfirm() {}, onCancelConfirm() {}}))
  assert.doesNotMatch(ready, /disabled=""|aria-describedby|native-engine-note/)
  assert.equal(engine.engineCommandReason({mounted: true, busy: false}), null)
})

test('the plane select emits exactly the admitted field-setting change, through apply', async () => {
  const sent = []
  const apply = changes => {sent.push(changes); return Promise.resolve({ok: true})}
  const element = physicsFaceView.switches({reading: reading(), disabled: false, apply})
  const select = findElement(element, node => node.props?.['aria-label'] === 'Physical medium plane')
  assert.ok(select, 'the plane select is present')
  select.props.onChange({target: {value: 'horizontal'}})
  select.props.onChange({target: {value: 'vertical'}})
  assert.deepEqual(sent, [
    [{kind: 'field-setting', key: 'mediumPlane', value: 'horizontal'}],
    [{kind: 'field-setting', key: 'mediumPlane', value: 'vertical'}],
  ])
  const disabled = findElement(physicsFaceView.switches({reading: reading(), disabled: true, apply}), node => node.props?.['aria-label'] === 'Physical medium plane')
  assert.equal(disabled.props.disabled, true)
})

test('the view keeps the shell import rule: no runtime import of the editor shell', async () => {
  const text = await readFile(new URL('../src/components/NativeFieldFace.physics.tsx', import.meta.url), 'utf8')
  assert.doesNotMatch(text, /from '\.\/NativeDeviceEditors/)
  assert.doesNotMatch(text, /from '\.\/nativeDeviceStripModel/)
})
