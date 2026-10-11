import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {register} from 'node:module'

// Production model source in memory, same loader as the sibling native tests.
// The reading is a minimal fixture; it is not a native owner or a saved receipt.
const root = new URL('../../../../', import.meta.url)
const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
const parameters = new URL('packages/expressions-boundary/src/parameters.ts', root).href
register(`data:text/javascript,${encodeURIComponent(`import ts from ${JSON.stringify(compiler)};import {readFile} from 'node:fs/promises';export async function resolve(s,c,n){if(s==='@epilogos/expressions-boundary/parameters')return n(${JSON.stringify(parameters)},c);try{return await n(s,c)}catch(e){if(!s.startsWith('.'))throw e;if(s.endsWith('.js')){try{return await n(s.slice(0,-3)+'.ts',c)}catch{}}for(const x of ['.ts','.tsx']){try{return await n(s+x,c)}catch{}}throw e}}export async function load(u,c,n){if(u.endsWith('.css'))return {format:'module',shortCircuit:true,source:'export {}'};if(u.endsWith('?raw'))return {format:'module',shortCircuit:true,source:'export default '+JSON.stringify(await readFile(new URL(u.split('?')[0]),'utf8'))};if(!u.endsWith('.ts')&&!u.endsWith('.tsx'))return n(u,c);return {format:'module',shortCircuit:true,source:ts.transpileModule(await readFile(new URL(u),'utf8'),{fileName:new URL(u).pathname,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText}}`)}`, import.meta.url)
import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'

const [model, {NATIVE_BINDINGS, bindValue, baseValue}, {FIELD_FACE_MODELS}, {FIELD_FACE_VIEWS}, {FIELD_PANEL_SETTINGS}] = await Promise.all([
  import('../src/components/nativeFieldFace.depth.ts'),
  import(parameters),
  import('../src/components/nativeFieldFaceModel.ts'),
  import('../src/components/nativeFieldFaceViews.tsx'),
  import(new URL('packages/expressions-boundary/src/nativeFieldPanelSettings.ts', root).href),
])
const {depthFaceModel, depthProfileShape, aerialDepth, inkAlpha, sizeMultiplier, tintShare, depthGeometryOn, DEPTH_HANDLE_PATHS, GLYPH_VOLUME_PATHS, DEPTH_PATHS} = model
const view = FIELD_FACE_VIEWS.depth
const depthView = await import('../src/components/NativeFieldFace.depth.tsx')
const binding = path => {
  const found = NATIVE_BINDINGS.find(row => row.path === path)
  assert.ok(found, `missing native binding ${path}`)
  return found
}
const ENGINE = {mediumEnabled: false, resonanceEnabled: false, collisionEnabled: false, pairwiseEnabled: false, morphEnabled: false,
  colorEnabled: false, trajectory: 'toroidalHopf', driveShape: 'sine', colorMode: 'linearGradient', mediumPlane: 'vertical', autoOscillate: true}
// Values are written through the same binding document path the reading uses; anything unset reads its disclosed default.
function reading({engine = {}, values = {}} = {}) {
  const scene = {name: 'Fixture', entities: [], engine: {...ENGINE, ...engine}, field: {background: '#ffffff', palette: ['#111111'], material: 'ink', params: {}}}
  for (const [path, value] of Object.entries(values)) bindValue(scene, binding(path).bind, value)
  return {
    basis: {expression_ref: 'expr:fixture', revision: 1, scene_ref: 'scene:fixture', authored_revision: 1},
    scene, entityOccurrences: {}, chosenControls: {available: false, entries: [], controls: []},
    selection: {entity_ids: [], step_id: null}, history: {canUndo: false, canRedo: false},
    standing: {dirty: false, pending: false, notice: null},
  }
}
const ON = reading({engine: {volumeEnabled: true, volumeProfile: 'taper', depthPerspective: true, depthOcclusion: true}, values: {'glyphVolume.depth': 240, 'depth.fov': 50, 'depth.distance': 800}})
const OFF = reading()
const close = (actual, expected, eps = 1e-9) => assert.ok(Math.abs(actual - expected) <= eps, `${actual} != ${expected}`)

// Fake context in the shape FieldSurface passes to draw(); ctx.value reads the reading unless a draft overrides it.
function drawContext(reading, drafts = {}) {
  const apply = async () => ({ok: true})
  return {reading, graphValue: 0, position: 0, family: 'depth', disabled: false, apply, captureCurrent: () => () => true, setDraft: () => {},
    value: path => drafts[path] ?? (binding(path) ? baseValue(reading.scene, binding(path).key) : undefined)}
}
const markup = (r, drafts) => renderToStaticMarkup(createElement('svg', {viewBox: '0 0 360 160'}, view.draw(drawContext(r, drafts))))
// Walk the React element tree and collect input and select elements with their handlers.
function controls(node, found = []) {
  if (Array.isArray(node)) {node.forEach(child => controls(child, found)); return found}
  if (!node || typeof node !== 'object' || !node.props) return found
  if (node.type === 'input' || node.type === 'select') found.push(node)
  controls(node.props.children, found)
  return found
}
const switchElements = r => view.switches({reading: r, disabled: false, apply: async () => ({ok: true})})
test('paths are exactly the registry numeric parameters of the 3D body and Projection panels', () => {
  const registry = NATIVE_BINDINGS.filter(row => row.group === 'volume' || row.group === 'depth').map(row => row.path)
  assert.equal(registry.length, 18)
  assert.deepEqual([...depthFaceModel.paths], [...GLYPH_VOLUME_PATHS, ...DEPTH_PATHS], 'app order: glyphVolume then depth')
  assert.deepEqual([...depthFaceModel.paths].sort(), [...registry].sort())
  assert.equal(new Set(depthFaceModel.paths).size, depthFaceModel.paths.length)
})

test('groups follow the app panels and cover paths exactly', () => {
  assert.deepEqual(depthFaceModel.groups.map(group => group.title), ['3D body (glyphVolume)', 'Projection & aerial depth'])
  assert.deepEqual(depthFaceModel.groups.flatMap(group => group.paths), [...depthFaceModel.paths])
  for (const group of depthFaceModel.groups) assert.ok(group.note && group.note.length > 0, `${group.title} states its gate`)
})

test('compact is at most four controls drawn from paths, and the slider path is a control not a handle', () => {
  assert.ok(depthFaceModel.compact.length <= 4)
  assert.equal(new Set(depthFaceModel.compact).size, depthFaceModel.compact.length)
  for (const path of depthFaceModel.compact) assert.ok(depthFaceModel.paths.includes(path), path)
  assert.ok(depthFaceModel.paths.includes(depthFaceModel.controlPath))
  assert.equal(depthFaceModel.controlPath, 'glyphVolume.wallShare')
  assert.ok(!DEPTH_HANDLE_PATHS.includes(depthFaceModel.controlPath))
  assert.equal(new Set(DEPTH_HANDLE_PATHS).size, DEPTH_HANDLE_PATHS.length)
  for (const path of DEPTH_HANDLE_PATHS) assert.ok(depthFaceModel.paths.includes(path), path)
})

test('enable light is a boolean from the owner enable, and the strip toggle is the admitted panel setting', () => {
  assert.equal(depthFaceModel.enabled(OFF), false)
  assert.equal(depthFaceModel.enabled(ON), true)
  assert.deepEqual(depthFaceModel.strip.toggle, {kind: 'panel-setting', key: 'volumeEnabled'})
  assert.equal(depthFaceModel.studio, 'volume')
  assert.equal(depthFaceModel.name, '3D body & depth')
  assert.equal(FIELD_FACE_MODELS.depth, depthFaceModel)
})

test('strip summary is read from the reading, not from a default', () => {
  assert.equal(depthFaceModel.strip.summary(ON), 'taper · depth 240 · perspective')
  assert.equal(depthFaceModel.strip.summary(OFF), 'round · depth 90 · orthographic')
})

test('profile shape follows glyphVolume.ts depthProfile at the sample points', () => {
  for (const t of [0, 0.3, 1]) close(depthProfileShape('slab', t), 1)
  close(depthProfileShape('round', 0), 0); close(depthProfileShape('round', 1), 1)
  close(depthProfileShape('bevel', 0.3), 0.3)
  close(depthProfileShape('dome', 0.25), 0.5)
  close(depthProfileShape('taper', 0.5), 0.25)
})

test('aerial depth, ink alpha and size law reproduce the shader formulas', () => {
  close(aerialDepth(0.6, 0.4), 0, 1e-12)
  close(aerialDepth(1.4, 0.4), 1)
  close(aerialDepth(1, 0.5), 0.5)
  close(inkAlpha(0, 1), 1)
  close(inkAlpha(0.25, 1), 0.875)
  close(inkAlpha(1, 0.55), 0.45)
  close(sizeMultiplier(1, 2, 0, 2.2), 1)
  close(sizeMultiplier(0.5, 1, 0, 2.2), 2)
  close(sizeMultiplier(1, 1, 1, 2.2), 1, 1e-12)
  close(sizeMultiplier(2, 1, 1, 0.5), 0.25, 1e-12)
  close(tintShare(1, 0.4), 0.4); close(tintShare(0.5, 1), 0.5); close(tintShare(2, 2), 1)
  assert.equal(depthGeometryOn(true, 90), true)
  assert.equal(depthGeometryOn(true, 0), false, 'zero body depth turns the depth geometry off (GPGPUSimulator.ts:925-928)')
  assert.equal(depthGeometryOn(false, 90), false)
})

test('the diagram is computed from ctx.value: changing a handled parameter changes the drawing', () => {
  const base = markup(ON)
  assert.notEqual(markup(ON, {'depth.fov': 90}), base, 'fov draws a different frustum')
  assert.notEqual(markup(ON, {'depth.distance': 4000}), base, 'distance moves the target plane')
  assert.notEqual(markup(ON, {'depth.aerialRange': 5}), base, 'aerial reach changes the alpha curve')
  assert.notEqual(markup(ON, {'glyphVolume.depth': 600}), base, 'body thickness changes the section')
  assert.notEqual(markup(ON, {'depth.sizeAttenuationCurve': 3}), base, 'attenuation curve changes the size curve')
  assert.notEqual(markup(reading({engine: {volumeEnabled: true, volumeProfile: 'slab', depthPerspective: true}, values: {'glyphVolume.depth': 240}})), markup(ON), 'the profile shapes the section')
})

test('handles are five real parameters with accessible names, and the shell slider path is not drawn here', () => {
  const html = markup(ON)
  const sliders = [...html.matchAll(/role="slider"[^>]*aria-label="([^"]+)"/g)].map(match => match[1])
  assert.equal(sliders.length, DEPTH_HANDLE_PATHS.length)
  for (const path of DEPTH_HANDLE_PATHS) assert.ok(sliders.includes(binding(path).label), `${path} handle labelled ${binding(path).label}`)
  assert.ok(!sliders.includes(binding('glyphVolume.wallShare').label), 'wallShare is driven by the shell slider')
})

test('gated groups say why they are inactive', () => {
  const off = markup(reading({engine: {volumeEnabled: false, depthPerspective: false}}))
  assert.ok(off.includes('3D body off'))
  assert.ok(off.includes('Ortho · FOV off'))
  assert.ok(markup(ON).includes('taper profile'))
})

test('switches emit exactly the admitted panel-setting shapes', () => {
  const calls = []
  const element = view.switches({reading: OFF, disabled: false, apply: async changes => { calls.push(changes); return {ok: true} }})
  const [volume, profile, perspective, occlusion] = controls(element)
  assert.equal(volume.props.type, 'checkbox'); assert.equal(profile.type, 'select'); assert.equal(perspective.props.type, 'checkbox'); assert.equal(occlusion.props.type, 'checkbox')
  assert.equal(profile.props['aria-label'], 'Depth profile')
  volume.props.onChange({target: {checked: true}})
  profile.props.onChange({target: {value: 'dome'}})
  perspective.props.onChange({target: {checked: true}})
  occlusion.props.onChange({target: {checked: true}})
  assert.deepEqual(calls, [
    [{kind: 'panel-setting', key: 'volumeEnabled', value: true}],
    [{kind: 'panel-setting', key: 'volumeProfile', value: 'dome'}],
    [{kind: 'panel-setting', key: 'depthPerspective', value: true}],
    [{kind: 'panel-setting', key: 'depthOcclusion', value: true}],
  ])
  for (const [change] of calls) assert.ok(Object.hasOwn(FIELD_PANEL_SETTINGS, change.key), `${change.key} is admitted`)
  assert.ok(FIELD_PANEL_SETTINGS.volumeProfile.options.includes('dome'))
  assert.equal(typeof calls[3][0].value, 'boolean', 'occlusion writes the boolean, not the legacy on/off string')
})

test('vortex3d and dispersion3d are exact range controls with the inspector labels, range and derived state', () => {
  const html = renderToStaticMarkup(createElement('div', null, switchElements(ON)))
  assert.ok(!html.includes('not writable from the shell yet'), 'the admitted shares are no longer disclosed as unavailable')
  assert.deepEqual(FIELD_PANEL_SETTINGS.vortex3d, {target: 'engine', type: 'number', min: 0, max: 1, step: 0.01})
  assert.deepEqual(FIELD_PANEL_SETTINGS.dispersion3d, {target: 'engine', type: 'number', min: 0, max: 1, step: 0.01})
  for (const [key, label] of [['vortex3d', 'Depth in the swirl'], ['dispersion3d', 'Depth in the bridge']]) {
    assert.match(html, new RegExp(`<input type="range" aria-label="${label}" min="0" max="1" step="0.01"`), `${label} is an inspector-range slider`)
    assert.ok(html.includes(`aria-label="${label} value"`), `${label} value text is named`)
    assert.ok(html.includes(`${key} derived from body law (engaged)`), `${key} unset reads as derived, not as 0 or 1`)
  }
  const planar = renderToStaticMarkup(createElement('div', null, switchElements(OFF)))
  assert.ok(planar.includes('vortex3d derived from body law (planar)'), 'with the body off the derived share is planar')
  const authored = renderToStaticMarkup(createElement('div', null, switchElements(reading({engine: {volumeEnabled: true, vortex3d: 0.35, dispersion3d: 0}}))))
  assert.ok(authored.includes('vortex3d authored at 0.35') && authored.includes('dispersion3d authored at 0'), 'an authored share shows its engine value')
  assert.ok(authored.includes('aria-label="Depth in the swirl value"') && authored.includes('>0.35</output>'), 'the value text carries the engine value')
  assert.ok(!authored.includes('derived from body law'), 'no derived text once both shares are authored')
})

test('a depth share commits exactly one admitted panel-setting change and reports a refusal in place', async () => {
  const calls = []
  const accept = async changes => { calls.push(changes); return {ok: true, reading: OFF} }
  assert.equal(await depthView.commitDepthShare(accept, 'vortex3d', 0.35), null)
  assert.equal(await depthView.commitDepthShare(accept, 'dispersion3d', 0), null)
  assert.deepEqual(calls, [
    [{kind: 'panel-setting', key: 'vortex3d', value: 0.35}],
    [{kind: 'panel-setting', key: 'dispersion3d', value: 0}],
  ])
  for (const [change] of calls) assert.ok(Object.hasOwn(FIELD_PANEL_SETTINGS, change.key), `${change.key} is admitted`)
  const refused = async () => ({ok: false, error: 'Choose an admitted native Field panel setting and value.', reading: OFF})
  assert.equal(await depthView.commitDepthShare(refused, 'vortex3d', 1.5), 'Choose an admitted native Field panel setting and value.')
  assert.equal(await depthView.commitDepthShare(async () => ({ok: false}), 'dispersion3d', 0.5), 'The Field did not accept this depth share.')
})

test('depth geometry coupling is shown as derived', () => {
  assert.ok(renderToStaticMarkup(createElement('div', null, switchElements(ON))).includes('Depth geometry (derived): on'))
  assert.ok(renderToStaticMarkup(createElement('div', null, switchElements(OFF))).includes('Depth geometry (derived): off'))
})

test('geometry stays finite at the extremes of every drawn parameter', () => {
  const extremes = [
    {'depth.fov': 4, 'depth.distance': 100, 'depth.aerialRange': 0.1, 'depth.sizeAttenuationCurve': 0.01, 'depth.aerialFade': 1, 'glyphVolume.depth': 0},
    {'depth.fov': 120, 'depth.distance': 5000, 'depth.aerialRange': 6, 'depth.sizeAttenuationCurve': 20, 'depth.aerialFade': 0, 'glyphVolume.depth': 600, 'glyphVolume.surfaceThickness': 80, 'glyphVolume.wallBand': 80, 'glyphVolume.outsideTaper': 3, 'glyphVolume.interiorFill': 1, 'glyphVolume.wallShare': 1},
  ]
  for (const values of extremes) {
    for (const profile of ['slab', 'bevel', 'round', 'dome', 'taper']) {
      const html = markup(reading({engine: {volumeEnabled: true, volumeProfile: profile, depthPerspective: true}, values}))
      assert.ok(!/NaN|Infinity/.test(html), `${profile} ${JSON.stringify(values)} produced a non-finite coordinate`)
    }
  }
})

test('every switch and handle path survives the minimum and maximum of its own range without throwing', () => {
  for (const path of DEPTH_HANDLE_PATHS) {
    const found = binding(path)
    for (const value of [found.hardMin, found.hardMax]) {
      assert.doesNotThrow(() => markup(reading({values: {[path]: value}})), `${path} at ${value}`)
    }
  }
})
