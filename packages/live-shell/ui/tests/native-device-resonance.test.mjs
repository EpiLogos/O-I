import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {register} from 'node:module'
import {createElement, isValidElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'

// Production resonance device in memory, same loader as the sibling native tests (.tsx transpiled, .css stubbed).
// The reading is a minimal fixture; it is not a native owner or a saved receipt.
const root = new URL('../../../../', import.meta.url)
const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
const parameters = new URL('packages/expressions-boundary/src/parameters.ts', root).href
register(`data:text/javascript,${encodeURIComponent(`import ts from ${JSON.stringify(compiler)};import {readFile} from 'node:fs/promises';export async function resolve(s,c,n){if(s==='@epilogos/expressions-boundary/parameters')return n(${JSON.stringify(parameters)},c);try{return await n(s,c)}catch(e){if(!s.startsWith('.'))throw e;if(s.endsWith('.js')){try{return await n(s.slice(0,-3)+'.ts',c)}catch{}}for(const x of ['.ts','.tsx']){try{return await n(s+x,c)}catch{}}throw e}}export async function load(u,c,n){if(u.endsWith('.css'))return {format:'module',shortCircuit:true,source:'export {}'};if(u.endsWith('?raw'))return {format:'module',shortCircuit:true,source:'export default '+JSON.stringify(await readFile(new URL(u.split('?')[0]),'utf8'))};if(!u.endsWith('.ts')&&!u.endsWith('.tsx'))return n(u,c);return {format:'module',shortCircuit:true,source:ts.transpileModule(await readFile(new URL(u),'utf8'),{fileName:new URL(u).pathname,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText}}`)}`, import.meta.url)
const [{FIELD_FACE_MODELS}, device, view, {NATIVE_BINDINGS, bindValue, baseValue}, {FIELD_PANEL_SETTINGS}] = await Promise.all([
  import('../src/components/nativeFieldFaceModel.ts'),
  import('../src/components/nativeFieldFace.resonance.ts'),
  import('../src/components/NativeFieldFace.resonance.tsx'),
  import(parameters),
  import('../../../expressions-boundary/src/nativeFieldPanelSettings.ts'),
])
const {resonanceFaceView} = view
const {RESONANCE_HANDLE_PATHS, latticeModes, nearestMode, plateModeShape, plateSketch, resonanceGate, sweepSchedule, PLATE_CELLS, RESONATOR_STATION_COUNT} = device
const model = FIELD_FACE_MODELS.resonance
const binding = path => {
  const found = NATIVE_BINDINGS.find(row => row.path === path)
  assert.ok(found, `missing native binding ${path}`)
  return found
}

const ENGINE = {mediumEnabled: false, resonanceEnabled: false, collisionEnabled: false, pairwiseEnabled: false, morphEnabled: false,
  colorEnabled: false, trajectory: 'toroidalHopf', driveShape: 'sine', colorMode: 'linearGradient', mediumPlane: 'vertical', autoOscillate: true}
// Values are written through the same binding document path the reading uses. composition is always present in a real reading.
function reading({engine = {}, composition = {}, values = {}} = {}) {
  const scene = {name: 'Fixture', entities: [], engine: {...ENGINE, ...engine},
    composition: {layout: 'free', plane: 'XY', focus: 'parallel', focusDuration: 4, carryTint: true, carryStation: false, frequencyDriver: 'manual', ...composition},
    field: {background: '#ffffff', palette: ['#111111'], material: 'ink', params: {}}}
  for (const [path, value] of Object.entries(values)) bindValue(scene, binding(path).bind, value)
  return {
    basis: {expression_ref: 'expr:fixture', revision: 1, scene_ref: 'scene:fixture', authored_revision: 1},
    scene, entityOccurrences: {}, chosenControls: {available: false, entries: [], controls: []},
    selection: {entity_ids: [], step_id: null}, history: {canUndo: false, canRedo: false},
    standing: {dirty: false, pending: false, notice: null},
  }
}
const LIVE = {resonanceEnabled: true, resonatorMode: 'resonator'}
const drawCtx = (r, drafts = {}, overrides = {}) => ({
  reading: r, graphValue: baseValue(r.scene, 'frequency'), position: 0.5,
  value: path => drafts[path] ?? baseValue(r.scene, binding(path).key), family: 'resonance', disabled: false,
  apply: () => {throw Error('SSR must not dispatch')}, captureCurrent: () => () => false, setDraft: () => {}, ...overrides,
})
const svg = node => renderToStaticMarkup(createElement('svg', {viewBox: '0 0 360 160'}, node))
// Walk a React element tree and return every element, so a switch's handler can be invoked with a stub event.
function collect(node, out = []) {
  if (Array.isArray(node)) node.forEach(child => collect(child, out))
  else if (isValidElement(node)) {out.push(node); collect(node.props.children, out)}
  return out
}
const stub = () => {const sent = []; return {sent, apply: changes => {sent.push(...changes); return Promise.resolve({ok: true})}}}

test('registry entry is the resonance device, and paths are exactly the fourteen Cymatics parameters of the app panel', () => {
  assert.equal(model.name, 'Continuous resonance')
  const registry = NATIVE_BINDINGS.filter(row => row.group === 'resonance').map(row => row.path).sort()
  assert.equal(registry.length, 14)
  assert.deepEqual([...model.paths].sort(), registry)
  assert.equal(new Set(model.paths).size, model.paths.length, 'no duplicate paths')
})

test('groups cover paths exactly once, in order, under distinct titles', () => {
  assert.deepEqual(model.groups.flatMap(group => group.paths), model.paths)
  assert.equal(new Set(model.groups.map(group => group.title)).size, model.groups.length)
  assert.ok(model.groups.every(group => group.title.length > 0 && group.paths.length > 0))
})

test('compact is at most four parameters drawn from paths, and studio opens the Resonance section', () => {
  assert.ok(model.compact.length <= 4 && model.compact.length > 0)
  assert.ok(model.compact.every(path => model.paths.includes(path)))
  assert.equal(new Set(model.compact).size, model.compact.length)
  assert.equal(model.studio, 'resonance')
})

test('handles are distinct paths of the device, and the bottom slider path is not a handle', () => {
  assert.equal(new Set(RESONANCE_HANDLE_PATHS).size, RESONANCE_HANDLE_PATHS.length)
  assert.ok(RESONANCE_HANDLE_PATHS.length >= 2)
  assert.ok(RESONANCE_HANDLE_PATHS.every(path => model.paths.includes(path)))
  assert.ok(model.paths.includes(model.controlPath))
  assert.ok(!RESONANCE_HANDLE_PATHS.includes(model.controlPath), 'controlPath must not be a handle path')
})

test('enable light is a real boolean from the resonance flag, and the strip keeps its summary and toggle', () => {
  assert.equal(model.enabled(reading({engine: {resonanceEnabled: true}})), true)
  assert.equal(model.enabled(reading({engine: {resonanceEnabled: false}})), false)
  const r = reading({engine: {resonanceEnabled: true}, values: {'cymatics.frequencyHz': 440, 'cymatics.dampingQFactor': 12}})
  assert.equal(model.strip.summary(r), '440 Hz · Q 12')
  assert.deepEqual(model.strip.toggle, {kind: 'field-setting', key: 'resonanceEnabled'})
})

test('gate: the modal body follows the resonant medium and Compatibility; the drive follows the frequency driver and sweep', () => {
  assert.deepEqual(resonanceGate({resonanceEnabled: false, frequencyDriver: 'manual', autoSweep: false}), {modal: false, drive: 'off'})
  assert.deepEqual(resonanceGate({resonanceEnabled: true, resonatorMode: 'template', frequencyDriver: 'manual', autoSweep: false}), {modal: false, drive: 'off'})
  assert.deepEqual(resonanceGate({resonanceEnabled: true, frequencyDriver: 'manual', autoSweep: false}), {modal: true, drive: 'frequency'}, 'undefined mode is the resonator')
  assert.deepEqual(resonanceGate({...LIVE, frequencyDriver: 'focus', autoSweep: false}), {modal: true, drive: 'focus'})
  assert.deepEqual(resonanceGate({...LIVE, frequencyDriver: 'automation', autoSweep: false}), {modal: true, drive: 'frequency'}, 'automation without a sweep keeps the tuning band')
  assert.deepEqual(resonanceGate({...LIVE, frequencyDriver: 'automation', autoSweep: true}), {modal: true, drive: 'sweep'})
  assert.deepEqual(resonanceGate({...LIVE, frequencyDriver: 'manual', autoSweep: true}), {modal: true, drive: 'frequency'}, 'a sweep needs Automation to own the frequency')
})

test('engine lattice: 2D f = f0(m^2+n^2) over 8x8, 3D f = f0 sqrt(m^2+n^2+p^2) over 4x4x4, nearest mode on a log scale', () => {
  assert.equal(RESONATOR_STATION_COUNT, 7)
  const plate = latticeModes('2D', 40)
  assert.equal(plate.length, 64)
  assert.equal(Math.min(...plate.map(mode => mode.hz)), 80, 'f11 = 2 f0')
  assert.equal(Math.max(...plate.map(mode => mode.hz)), 5120, 'f88 = 128 f0')
  assert.deepEqual(nearestMode(plate, 440), {m: 1, n: 3, hz: 400}, '440 Hz is nearer 400 (m^2+n^2=10) than 520 (13)')
  const cavity = latticeModes('3D', 40)
  assert.equal(cavity.length, 64)
  assert.equal(cavity.every(mode => mode.p !== undefined), true)
  assert.ok(Math.abs(cavity.find(mode => mode.m === 1 && mode.n === 1 && mode.p === 1).hz - 40 * Math.sqrt(3)) < 1e-9)
  assert.equal(nearestMode(plate, 0), undefined, 'no drive, no nearest mode')
})

test('plate sketch: the engine mode shape, normalised, with nodal sign changes where the shape has them', () => {
  const uniform = plateSketch(1, 1, PLATE_CELLS)
  assert.equal(uniform.length, PLATE_CELLS)
  assert.ok(uniform.every(row => row.length === PLATE_CELLS))
  assert.ok(uniform.flat().every(value => value >= 0), '(1,1) is positive over the plate')
  assert.ok(Math.abs(Math.max(...uniform.flat()) - 1) < 1e-9, 'peak magnitude is 1')
  const signed = plateSketch(2, 1, PLATE_CELLS).flat()
  assert.ok(signed.some(value => value > 0) && signed.some(value => value < 0), '(2,1) has nodal lines')
  // Same shape as the engine formula at a sampled cell, before normalisation (cymaticResonator.ts:152-157).
  const peak = Math.max(...plateSketch(1, 2, PLATE_CELLS).flat().map(Math.abs))
  const raw = plateModeShape(1, 2, -0.5 + 0.5 / PLATE_CELLS, -0.5 + 0.5 / PLATE_CELLS)
  assert.ok(Math.abs(plateSketch(1, 2, PLATE_CELLS)[0][0] - raw / peak) < 1e-9)
})

test('sweep schedule: waypoints are the stations ascending, descending or there-and-back, each dwell then glide', () => {
  const ascent = sweepSchedule('ascent', 8, 2)
  assert.equal(ascent.waypoints, 7)
  assert.equal(ascent.cycleS, 70)
  assert.equal(ascent.dwellFraction, 0.2)
  assert.equal(sweepSchedule('descent', 8, 2).waypoints, 7)
  const back = sweepSchedule('pingpong', 8, 2)
  assert.equal(back.waypoints, 12, 'seven forward and five back')
  assert.equal(back.cycleS, 120)
})

test('SSR: six real handles with their binding labels, and the drive and sweep standby states are drawn', () => {
  const live = reading({engine: {...LIVE, autoSweep: true}, composition: {frequencyDriver: 'automation'}})
  const html = svg(resonanceFaceView.draw(drawCtx(live)))
  assert.equal((html.match(/role="slider"/g) ?? []).length, RESONANCE_HANDLE_PATHS.length)
  for (const path of RESONANCE_HANDLE_PATHS) assert.match(html, new RegExp(`aria-label="${binding(path).label}"`), path)
  assert.doesNotMatch(html, new RegExp(`aria-label="${binding(model.controlPath).label}"`), 'the bottom slider path is not a handle')
  assert.match(html, /native-resonance-schedule"/, 'the sweep bar is live under Automation with sweep on')
  const idle = svg(resonanceFaceView.draw(drawCtx(reading({engine: {autoSweep: false}}))))
  assert.doesNotMatch(idle, /native-resonance-schedule/, 'no sweep bar when sweep is off')
  assert.match(idle, /native-resonance-standby/, 'the modal body is standby while the medium is off')
  assert.match(svg(resonanceFaceView.draw(drawCtx(reading({engine: {...LIVE, templateDimension: '3D'}})))), /3D cavity/)
})

test('SSR: the diagram follows the reading and the live handle draft', () => {
  const base = svg(resonanceFaceView.draw(drawCtx(reading({engine: LIVE, values: {'cymatics.baseFrequency': 40, 'cymatics.frequencyHz': 440}}))))
  const moved = svg(resonanceFaceView.draw(drawCtx(reading({engine: LIVE, values: {'cymatics.baseFrequency': 80, 'cymatics.frequencyHz': 440}}))))
  assert.notEqual(base, moved, 'changing f0 moves the ladder and the nearest mode')
  // React SSR splits adjacent text nodes with comment markers, so the text is compared without them.
  const words = markup => markup.replace(/<!-- -->/g, '')
  assert.match(words(moved), /f0 80 Hz/)
  // A draft from a dragged handle reaches the diagram through ctx.value, before the native reply.
  const dragged = svg(resonanceFaceView.draw(drawCtx(reading({engine: LIVE, values: {'cymatics.frequencyHz': 440}}), {'cymatics.frequencyHz': 1000})))
  assert.match(words(dragged), /1000 Hz/)
  assert.notEqual(base, dragged)
})

test('switches: every control emits its exact admitted change shape', () => {
  const r = reading({engine: LIVE})
  const {sent, apply} = stub()
  const els = collect(resonanceFaceView.switches({reading: r, disabled: false, apply}))
  const checkboxes = els.filter(el => el.type === 'input' && el.props.type === 'checkbox')
  const select = label => els.find(el => el.type === 'select' && el.props['aria-label'] === label)
  assert.equal(checkboxes.length, 2)
  checkboxes[0].props.onChange({target: {checked: false}})
  assert.deepEqual(sent.at(-1), {kind: 'field-setting', key: 'resonanceEnabled', value: false})
  checkboxes[1].props.onChange({target: {checked: true}})
  assert.deepEqual(sent.at(-1), {kind: 'panel-setting', key: 'autoSweep', value: true})
  select('Shared frequency is driven by').props.onChange({target: {value: 'focus'}})
  assert.deepEqual(sent.at(-1), {kind: 'panel-setting', key: 'frequencyDriver', value: 'focus'})
  select('Sweep direction').props.onChange({target: {value: 'pingpong'}})
  assert.deepEqual(sent.at(-1), {kind: 'panel-setting', key: 'sweepDirection', value: 'pingpong'})
  select('Resonator dimension').props.onChange({target: {value: '3D'}})
  assert.deepEqual(sent.at(-1), {kind: 'panel-setting', key: 'templateDimension', value: '3D'})
  select('Medium implementation').props.onChange({target: {value: 'template'}})
  assert.deepEqual(sent.at(-1), {kind: 'panel-setting', key: 'resonatorMode', value: 'template'})
})

test('switch options are the admitted option lists of the boundary, never invented', () => {
  const els = collect(resonanceFaceView.switches({reading: reading({engine: LIVE}), disabled: false, apply: stub().apply}))
  const optionsOf = label => els.find(el => el.type === 'select' && el.props['aria-label'] === label).props.children
    .map(option => option.props.value)
  assert.deepEqual(optionsOf('Shared frequency is driven by'), FIELD_PANEL_SETTINGS.frequencyDriver.options)
  assert.deepEqual(optionsOf('Sweep direction'), FIELD_PANEL_SETTINGS.sweepDirection.options)
  assert.deepEqual(optionsOf('Resonator dimension'), FIELD_PANEL_SETTINGS.templateDimension.options)
  assert.deepEqual(optionsOf('Medium implementation'), FIELD_PANEL_SETTINGS.resonatorMode.options)
})

test('unavailable controls are disclosed with the reason, never rendered as dead controls', () => {
  const html = renderToStaticMarkup(createElement('div', null, resonanceFaceView.switches({reading: reading({engine: LIVE}), disabled: false, apply: stub().apply})))
  const disclosures = html.match(/not writable from the shell yet/g) ?? []
  assert.equal(disclosures.length, 5)
  assert.match(html, /Station ticks \(inspector\.ts:128/)
  assert.match(html, /field\.params\.frequency/)
})

test('the standby reasons name the source that owns the drive', () => {
  const focus = renderToStaticMarkup(createElement('div', null, resonanceFaceView.switches({reading: reading({engine: LIVE, composition: {frequencyDriver: 'focus'}}), disabled: false, apply: stub().apply})))
  assert.match(focus, /Travelling focus drives the medium/)
  const sweep = renderToStaticMarkup(createElement('div', null, resonanceFaceView.switches({reading: reading({engine: {...LIVE, autoSweep: true}, composition: {frequencyDriver: 'automation'}}), disabled: false, apply: stub().apply})))
  assert.match(sweep, /station sweep drives the medium/)
  const off = renderToStaticMarkup(createElement('div', null, resonanceFaceView.switches({reading: reading(), disabled: false, apply: stub().apply})))
  assert.match(off, /resonant medium is off/)
})

test('the model stays pure and the view imports no editor shell', async () => {
  const modelText = await readFile(new URL('../src/components/nativeFieldFace.resonance.ts', import.meta.url), 'utf8')
  assert.doesNotMatch(modelText, /from 'react'/, 'model has no React')
  assert.doesNotMatch(modelText, /NativeDeviceEditors|nativeDeviceCustody/, 'model has no editor or commit path')
  const viewText = await readFile(new URL('../src/components/NativeFieldFace.resonance.tsx', import.meta.url), 'utf8')
  assert.doesNotMatch(viewText, /from '\.\/NativeDeviceEditors'/)
})
