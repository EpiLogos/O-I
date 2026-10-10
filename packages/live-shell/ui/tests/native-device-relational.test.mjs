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
const [{FIELD_FACE_MODELS}, {FIELD_FACE_VIEWS}, {FIELD_PANEL_SETTINGS}, parameters2] = await Promise.all([
  import('../src/components/nativeFieldFaceModel.ts'),
  import('../src/components/nativeFieldFaceViews.tsx'),
  import('../../../expressions-boundary/src/nativeFieldPanelSettings.ts'),
  import(parameters),
])
const {NATIVE_BINDINGS: BINDINGS, bindValue, baseValue} = parameters2
const model = FIELD_FACE_MODELS.relational
const view = FIELD_FACE_VIEWS.relational
// The app's Relational group: every registry parameter whose binding group is 'relational' (paramRegistry.ts:56,108-116).
const REGISTRY = BINDINGS.filter(row => row.group === 'relational').map(row => row.path)
const HANDLES = {'relational.orbitRadius': 'Orbit Radius', 'relational.swirlRadius': 'Swirl Radius', 'relational.gravitySoftening': 'Gravity Softening', 'relational.attractorGravity': 'Gravity Pull'}

const ENGINE = {mediumEnabled: false, resonanceEnabled: false, collisionEnabled: false, pairwiseEnabled: false, morphEnabled: false,
  colorEnabled: false, trajectory: 'toroidalHopf', driveShape: 'sine', colorMode: 'linearGradient', mediumPlane: 'vertical', autoOscillate: true}
// Fixture reading: engine flags and native values written through their bindings; not an owner or a saved receipt.
function reading(engine = {}, values = {}) {
  const scene = {name: 'Fixture', entities: [], engine: {...ENGINE, ...engine}, field: {background: '#ffffff', palette: ['#111111'], material: 'ink', params: {}}}
  for (const [path, value] of Object.entries(values)) bindValue(scene, BINDINGS.find(row => row.path === path).bind, value)
  return {
    basis: {expression_ref: 'expr:fixture', revision: 1, scene_ref: 'scene:fixture', authored_revision: 1},
    scene, entityOccurrences: {}, chosenControls: {available: false, entries: [], controls: []},
    selection: {entity_ids: [], step_id: null}, history: {canUndo: false, canRedo: false},
    standing: {dirty: false, pending: false, notice: null},
  }
}
// Draw context as the editor shell builds it; value() reads the reading, with optional live drafts overriding it (as during a drag).
function drawCtx(r, drafts = {}) {
  const value = path => path in drafts ? drafts[path] : baseValue(r.scene, BINDINGS.find(row => row.path === path).key)
  return {reading: r, graphValue: 0, position: 0, value, family: 'relational', disabled: false,
    apply: async () => ({ok: true}), captureCurrent: () => () => false, setDraft: () => {}}
}
const svgOf = (r, drafts) => renderToStaticMarkup(createElement('svg', {viewBox: '0 0 360 160'}, view.draw(drawCtx(r, drafts))))
const attr = (html, cls) => (html.match(new RegExp(`<path d="([^"]*)" class="${cls}"`)) ?? html.match(new RegExp(`<text[^>]*class="${cls}"[^>]*>([^<]*)<`)) ?? [])[1]
const count = (html, cls) => (html.match(new RegExp(`class="${cls}"`, 'g')) ?? []).length
const circleR = (html, cls) => (html.match(new RegExp(`<circle cx="[^"]*" cy="[^"]*" r="([^"]*)" class="${cls}"`)) ?? [])[1]
function elements(node, out = []) {
  if (Array.isArray(node)) {for (const child of node) elements(child, out); return out}
  if (!node || typeof node !== 'object' || !('props' in node)) return out
  out.push(node)
  elements(node.props.children, out)
  return out
}

test('paths are exactly the app Relational group, in registry order, with no duplicates', () => {
  assert.equal(REGISTRY.length, 10)
  assert.deepEqual(model.paths, REGISTRY)
  assert.equal(new Set(model.paths).size, model.paths.length)
  assert.ok('relational' in FIELD_FACE_MODELS, 'the device is registered as the relational family')
  assert.equal(model.name, 'Relational forces')
  assert.equal(model.studio, 'relational')
})

test('groups cover paths exactly, each parameter in one coupled group', () => {
  const flat = model.groups.flatMap(group => group.paths)
  assert.equal(flat.length, new Set(flat).size, 'no parameter sits in two groups')
  assert.deepEqual([...flat].sort(), [...model.paths].sort())
  for (const group of model.groups) assert.ok(group.title.length > 0 && group.note?.length > 0, `${group.title} has a title and a coupling note`)
})

test('compact is at most four parameters from paths; controlPath is a non-handle parameter', () => {
  assert.ok(model.compact.length <= 4 && model.compact.length > 0)
  for (const path of model.compact) assert.ok(model.paths.includes(path), `${path} is a device parameter`)
  assert.ok(model.paths.includes(model.controlPath))
  assert.ok(!(model.controlPath in HANDLES), 'the bottom slider does not share a handle path')
  for (const path of Object.keys(HANDLES)) assert.ok(model.paths.includes(path), `handle ${path} is a device parameter`)
})

test('non-numeric controls are admitted panel settings with the exact option lists', () => {
  assert.equal(FIELD_PANEL_SETTINGS.relationalEnabled.type, 'boolean')
  assert.deepEqual(FIELD_PANEL_SETTINGS.relationalMode.options, ['orbital', 'nbody', 'chaos'])
})

test('enable light is the engine flag and the strip toggle is its admitted panel setting', () => {
  assert.equal(model.enabled(reading()), false)
  assert.equal(model.enabled(reading({relationalEnabled: true})), true)
  assert.deepEqual(model.strip.toggle, {kind: 'panel-setting', key: 'relationalEnabled'})
})

test('strip summary shows the mode and the bound values it reads', () => {
  const r = reading({relationalEnabled: true, relationalMode: 'nbody'}, {'relational.attractorCount': 4, 'relational.attractorGravity': 2.5})
  assert.equal(model.strip.summary(r), 'N-body · 4 centres · gravity 2.5')
  assert.equal(model.strip.summary(reading()).startsWith('Orbital · '), true, 'an unset law reads as Orbital')
})

test('the diagram moves with its parameters: radius, swirl ring, knee and pull each redraw', () => {
  const on = reading({relationalEnabled: true}, {'relational.attractorCount': 3})
  const base = svgOf(on)
  assert.notEqual(attr(base, 'native-relational-path'), attr(svgOf(on, {'relational.orbitRadius': 2000}), 'native-relational-path'), 'orbit radius redraws the path')
  assert.notEqual(circleR(base, 'native-relational-swirl'), circleR(svgOf(on, {'relational.swirlRadius': 3000}), 'native-relational-swirl'), 'swirl radius redraws the ring')
  assert.notEqual(attr(base, 'native-relational-knee'), attr(svgOf(on, {'relational.gravitySoftening': 400}), 'native-relational-knee'), 'softening moves the knee')
  assert.notEqual(attr(base, 'native-relational-curve'), attr(svgOf(on, {'relational.attractorGravity': 40}), 'native-relational-curve'), 'gravity changes the signed curve')
  assert.notEqual(attr(svgOf(on, {'relational.attractorGravity': 40}), 'native-relational-curve'), attr(svgOf(on, {'relational.attractorGravity': -40}), 'native-relational-curve'), 'the sign of gravity flips the curve')
  assert.notEqual(attr(base, 'native-relational-curve'), attr(svgOf(on, {'relational.gravityFalloff': 2.5}), 'native-relational-curve'), 'falloff exponent reshapes the curve')
})

test('each law draws its own configuration; orbit arrow follows orbitSpeed', () => {
  const values = {'relational.attractorCount': 3, 'relational.orbitSpeed': 4}
  const orbital = svgOf(reading({relationalEnabled: true, relationalMode: 'orbital'}, values))
  const nbody = svgOf(reading({relationalEnabled: true, relationalMode: 'nbody'}, values))
  const chaos = svgOf(reading({relationalEnabled: true, relationalMode: 'chaos'}, values))
  assert.equal(count(orbital, 'native-relational-pair'), 0, 'orbital draws no pairs')
  assert.equal(count(nbody, 'native-relational-pair'), 3, 'nbody draws one line per pair of three centres')
  assert.equal(count(chaos, 'native-relational-path is-chaos'), 1, 'chaotic draws the perturbed path')
  assert.equal(count(nbody, 'native-relational-centre'), 3)
  assert.equal(count(orbital, 'native-relational-arrow'), 1, 'a moving orbit has a direction arrow')
  assert.equal(count(svgOf(reading({relationalEnabled: true}, {...values, 'relational.orbitSpeed': 0})), 'native-relational-arrow'), 0, 'a still orbit has none')
  assert.notEqual(attr(orbital, 'native-relational-path'), attr(nbody, 'native-relational-path'))
})

test('gated: with the engine flag off the drawing is marked inert with its reason', () => {
  const off = svgOf(reading({relationalEnabled: false}))
  assert.equal(count(off, 'native-relational-gated'), 1)
  assert.match(off, /Off · values stored, not applied/)
  assert.equal(count(svgOf(reading({relationalEnabled: true})), 'native-relational-gated'), 0)
})

test('four in-diagram handles are sliders labelled from the native bindings', () => {
  const html = svgOf(reading({relationalEnabled: true}))
  assert.equal((html.match(/class="native-field-handle is-/g) ?? []).length, 4)
  assert.equal((html.match(/role="slider"/g) ?? []).length, 4)
  for (const label of Object.values(HANDLES)) assert.ok(html.includes(`aria-label="${label}"`), `${label} handle is labelled`)
})

test('switches emit only admitted panel-setting changes, and show the current state', () => {
  const calls = []
  const apply = async changes => {calls.push(changes); return {ok: true}}
  const off = elements(view.switches({reading: reading({relationalEnabled: false}), disabled: false, apply}))
  const checkbox = off.find(node => node.type === 'input' && node.props.type === 'checkbox')
  const select = off.find(node => node.type === 'select')
  assert.equal(checkbox.props.checked, false)
  assert.equal(select.props.value, 'orbital')
  checkbox.props.onChange({target: {checked: true}})
  select.props.onChange({target: {value: 'chaos'}})
  assert.deepEqual(calls, [
    [{kind: 'panel-setting', key: 'relationalEnabled', value: true}],
    [{kind: 'panel-setting', key: 'relationalMode', value: 'chaos'}],
  ])
  for (const [change] of calls) assert.ok(Object.hasOwn(FIELD_PANEL_SETTINGS, change.key), `${change.key} is admitted`)
  const on = elements(view.switches({reading: reading({relationalEnabled: true, relationalMode: 'nbody'}), disabled: true, apply}))
  assert.equal(on.find(node => node.type === 'input' && node.props.type === 'checkbox').props.checked, true)
  assert.equal(on.find(node => node.type === 'select').props.disabled, true)
})
