import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {register} from 'node:module'
import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'

// Production Mark profile device in memory, same loader as the sibling native tests (.tsx transpiled, .css stubbed).
// The readings are minimal fixtures; they are not a native owner or a saved receipt.
const root = new URL('../../../../', import.meta.url)
const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
const parameters = new URL('packages/expressions-boundary/src/parameters.ts', root).href
register(`data:text/javascript,${encodeURIComponent(`import ts from ${JSON.stringify(compiler)};import {readFile} from 'node:fs/promises';export async function resolve(s,c,n){if(s==='@epilogos/expressions-boundary/parameters')return n(${JSON.stringify(parameters)},c);try{return await n(s,c)}catch(e){if(!s.startsWith('.'))throw e;if(s.endsWith('.js')){try{return await n(s.slice(0,-3)+'.ts',c)}catch{}}for(const x of ['.ts','.tsx']){try{return await n(s+x,c)}catch{}}throw e}}export async function load(u,c,n){if(u.endsWith('.css'))return {format:'module',shortCircuit:true,source:'export {}'};if(u.endsWith('?raw'))return {format:'module',shortCircuit:true,source:'export default '+JSON.stringify(await readFile(new URL(u.split('?')[0]),'utf8'))};if(!u.endsWith('.ts')&&!u.endsWith('.tsx'))return n(u,c);return {format:'module',shortCircuit:true,source:ts.transpileModule(await readFile(new URL(u),'utf8'),{fileName:new URL(u).pathname,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText}}`)}`, import.meta.url)
const [{FIELD_FACE_MODELS}, {FIELD_FACE_VIEWS}, {NATIVE_BINDINGS, bindValue, baseValue}, device, law] = await Promise.all([
  import('../src/components/nativeFieldFaceModel.ts'),
  import('../src/components/nativeFieldFaceViews.tsx'),
  import(parameters),
  import('../src/components/NativeFieldFace.ink.tsx'),
  import('../src/components/nativeFieldFace.ink.ts'),
])
const {inkFaceView, inkMarkLaw, inkContour, inkSwatch, INK_HANDLE_PATHS, glyphControls, chooseGlyph, refusalOf} = device
const {inkFaceModel: model, FIELD_FONT_WEIGHTS, fontChange, weightChange} = law
const {FONT_OPTIONS} = await import(new URL('desktop/cradle/expressions-app/field-studies-journeys/src/fontCatalog.ts', root).href)

const ENGINE = {mediumEnabled: false, resonanceEnabled: false, collisionEnabled: false, pairwiseEnabled: false, morphEnabled: false,
  colorEnabled: false, trajectory: 'toroidalHopf', driveShape: 'sine', colorMode: 'linearGradient', mediumPlane: 'vertical', autoOscillate: true}
function reading(values = {}, engine = {}) {
  const scene = {name: 'Fixture', entities: [], engine: {...ENGINE, ...engine}, field: {background: '#ffffff', palette: ['#111111'], material: 'ink', params: {}}}
  for (const [path, value] of Object.entries(values)) bindValue(scene, NATIVE_BINDINGS.find(row => row.path === path).bind, value)
  return {
    basis: {expression_ref: 'expr:fixture', revision: 1, scene_ref: 'scene:fixture', authored_revision: 1},
    scene, entityOccurrences: {}, chosenControls: {available: false, entries: [], controls: []},
    selection: {entity_ids: [], step_id: null}, history: {canUndo: false, canRedo: false},
    standing: {dirty: false, pending: false, notice: null},
  }
}
const bindingOf = path => NATIVE_BINDINGS.find(row => row.path === path)
const close = (actual, expected, eps = 1e-9) => assert.ok(Math.abs(actual - expected) <= eps, `${actual} != ${expected}`)
const SAMPLE = {grain: true, square: false, style: 'ink', min: 0.16, max: 1.6, sizeBias: 1, opacity: 1, roundness: 1, softness: 0, irregularity: 0, elongation: 0,
  orientation: 0, contrast: 0, densityScale: 1, densityPhase: 0, edgeWeight: 0, halo: 0.6}

test('the device is registered under ink in the model and view registries', () => {
  assert.ok('ink' in FIELD_FACE_MODELS && 'ink' in FIELD_FACE_VIEWS)
  assert.equal(FIELD_FACE_MODELS.ink, model)
  assert.equal(FIELD_FACE_VIEWS.ink, inkFaceView)
})

test('paths are exactly the numeric parameters of the app Mark profile and its shared-field neighbours', () => {
  // inspector.ts:115 (size, opacity) and inspector.ts:122 (count, min size, the material group). paperGrain is the Colour panel's.
  const expected = NATIVE_BINDINGS.filter(row => row.group === 'material').map(row => row.path).sort()
  assert.equal(expected.length, 15)
  assert.deepEqual([...model.paths].sort(), expected)
  assert.equal(new Set(model.paths).size, model.paths.length, 'no duplicate paths')
  assert.ok(!model.paths.includes('paperGrain'))
})

test('groups cover paths exactly, in app order, and compact is a justified subset of at most four', () => {
  const covered = model.groups.flatMap(group => group.paths)
  assert.deepEqual(covered, model.paths, 'groups concatenate to the app order with no gaps or repeats')
  assert.equal(model.groups.length, 2)
  assert.equal(model.groups[1].title, 'Mark profile')
  assert.ok(model.compact.length <= 4)
  assert.ok(model.compact.every(path => model.paths.includes(path)))
})

test('control path is a real path that no handle drives, and the device has no owner activator', () => {
  assert.ok(model.paths.includes(model.controlPath))
  assert.ok(!INK_HANDLE_PATHS.includes(model.controlPath))
  assert.ok(INK_HANDLE_PATHS.every(path => model.paths.includes(path)))
  assert.equal(model.enabled(reading()), undefined)
  assert.equal(model.strip.toggle, null)
  assert.equal(model.studio, 'appearance')
  assert.match(model.strip.summary(reading({particleCount: 5000})), /^5000 particles · /)
})

test('contour is the unit circle for a round, unstretched, unjittered mark', () => {
  const circle = inkMarkLaw({...SAMPLE, irregularity: 0}, 3, 50, 50)
  for (const [x, y] of inkContour(circle, 0.5)) close(Math.hypot(x, y), 0.5)
})

test('stretch and rotation invert: the mapped contour lies on the engine outline', () => {
  const law = {size: 1, angle: Math.PI / 6, stretch: 1.5, alpha: 1, round: 1, irregular: 0, feather: 0, hash: 0.3}
  for (const [x, y] of inkContour(law, 0.5, 24)) {
    // Forward map: rotate by the angle, then stretch y. The result must sit on radius 0.5.
    const rx = x * Math.cos(law.angle) - y * Math.sin(law.angle), ry = (x * Math.sin(law.angle) + y * Math.cos(law.angle)) * (1 + law.stretch)
    close(Math.hypot(rx, ry), 0.5, 1e-9)
  }
})

test('a square mark is the max-norm box at 0.5, which is what dot shape square draws in the classic profile', () => {
  const square = inkMarkLaw({...SAMPLE, grain: false, square: true}, 2, 50, 50)
  for (const [x, y] of inkContour(square, 0.5)) close(Math.max(Math.abs(x), Math.abs(y)), 0.5)
  assert.equal(square.alpha, 1, 'classic profile draws without opacity or halo')
  assert.equal(square.feather, 0)
})

test('size distribution: a larger exponent pushes the marks smaller, as the vertex law does', () => {
  const mean = sizeBias => {
    const sizes = Array.from({length: 18}, (_, i) => inkMarkLaw({...SAMPLE, sizeBias}, i, 60, 40).size)
    return sizes.reduce((sum, size) => sum + size, 0) / sizes.length
  }
  assert.ok(mean(4) < mean(0.2), `sizeBias 4 gives ${mean(4)}, sizeBias 0.2 gives ${mean(0.2)}`)
})

test('halo fades only the sparse marks, and does nothing at its upper soft bound', () => {
  const alphas = halo => Array.from({length: 18}, (_, i) => inkMarkLaw({...SAMPLE, opacity: 1, halo}, i, 60, 40).alpha)
  assert.ok(alphas(0).some(alpha => alpha < 1), 'halo 0 fades at least one sparse mark')
  assert.ok(alphas(0.6).every(alpha => alpha === 1), 'halo at 0.6 keeps every mark')
  assert.ok(inkMarkLaw({...SAMPLE, opacity: 0.4, halo: 0.6}, 1, 60, 40).alpha <= 0.4 + 1e-12, 'opacity multiplies the mark')
})

test('edge emphasis enlarges sparse marks, and grain off ignores every grain-only parameter', () => {
  const plain = inkMarkLaw({...SAMPLE, edgeWeight: 0}, 1, 60, 40).size
  const emphasised = inkMarkLaw({...SAMPLE, edgeWeight: 2}, 1, 60, 40).size
  assert.ok(emphasised > plain, 'edge emphasis grows a sparse mark')
  const classic = inkMarkLaw({...SAMPLE, grain: false, opacity: 0.2, halo: 0, edgeWeight: 4, elongation: 3, irregularity: 1, softness: 1}, 1, 60, 40)
  assert.equal(classic.alpha, 1)
  assert.equal(classic.stretch, 0)
  assert.equal(classic.angle, 0)
  assert.equal(classic.irregular, 0)
  assert.equal(classic.feather, 0)
})

test('swatch: eighteen marks, the largest filling its cell, each with an outer contour and a feather when softness is set', () => {
  const marks = inkSwatch({...SAMPLE, softness: 0.5})
  assert.equal(marks.length, 18)
  assert.ok(marks.every(mark => mark.inner !== null && mark.outerAlpha < mark.innerAlpha + 1e-12))
  assert.ok(Math.max(...marks.map(mark => mark.side)) <= 24 + 1e-9)
  assert.ok(marks.every(mark => mark.side > 0))
  assert.equal(inkSwatch({...SAMPLE, softness: 0}).every(mark => mark.inner === null), true)
})

// SSR fixture: the device's own reading with the fixture values written through their bindings.
const render = (values = {}, engine = {}, material = 'ink') => {
  const fixture = reading({'material.roundness': 0.6, 'particleSize.min': 0.16, 'particleSize.max': 1.6, 'particleCount': 5000, ...values}, engine)
  fixture.scene.field.material = material
  const override = Object.fromEntries(Object.entries(values))
  const ctx = {reading: fixture, graphValue: 0, position: 0, value: path => override[path] ?? baseValue(fixture.scene, bindingOf(path).key),
    family: 'ink', disabled: false, apply: () => {throw Error('SSR must not dispatch')}, captureCurrent: () => () => false, setDraft: () => {}}
  return renderToStaticMarkup(createElement('svg', {viewBox: '0 0 360 160'}, inkFaceView.draw(ctx)))
}

test('SSR: the diagram carries six handles with exact slider aria, two of them on the log size bar', () => {
  const html = render()
  const labels = [...html.matchAll(/role="slider"[^>]*aria-label="([^"]+)"/g)].map(match => match[1])
  for (const label of ['Size Distribution', 'Mark Roundness', 'Elongation', 'Peripheral Ink', 'Min Size', 'Max Size']) assert.ok(labels.includes(label), label)
  assert.equal(labels.length, 6)
  assert.equal((html.match(/is-bar/g) ?? []).length, 2, 'the size range is one log bar with two handles')
  assert.doesNotMatch(html, /NaN|Infinity/, 'every drawn coordinate is finite')
  assert.equal((html.match(/clipPath/g) ?? []).length, 2 * 18, 'each mark is clipped to its point box')
  assert.doesNotMatch(html, /data-field-handle/, 'the bottom slider belongs to the surface, not the device')
})

test('SSR: the swatch changes when a sampled parameter changes, and it is not a fixed picture', () => {
  const plain = render({'material.roundness': 0})
  const round = render({'material.roundness': 1})
  assert.notEqual(plain, round)
  assert.notEqual(render({'material.sizeBias': 0.2}), render({'material.sizeBias': 4}))
  assert.notEqual(render({'material.elongation': 0}), render({'material.elongation': 2}))
})

test('SSR: grain off gates the material rows with a reason and draws the classic profile', () => {
  const html = render({}, {grainProfile: false})
  assert.match(html, /classic profile/)
  assert.match(html, /Elongation [^<]*· off/)
  assert.match(html, /Peripheral Ink [^<]*· off/)
  assert.doesNotMatch(render(), /· off/, 'with grain on no row is gated')
  assert.match(render(), /Ink stipple/)
  assert.notEqual(render({}, {}, 'ink'), render({}, {}, 'print'), 'Print uses the halftone size law')
  assert.notEqual(render({}, {}, 'ink'), render({}, {}, 'round'), 'Rounded draws the coarser round dot')
})

test('SSR: a missing reading value states what is missing and draws no marks', () => {
  const broken = {...reading(), scene: {...reading().scene, engine: {...ENGINE}}}
  const ctx = {reading: broken, graphValue: 0, position: 0, value: path => path === 'material.halo' ? undefined : 0.5,
    family: 'ink', disabled: false, apply: () => {}, captureCurrent: () => () => false, setDraft: () => {}}
  const html = renderToStaticMarkup(createElement('svg', {viewBox: '0 0 360 160'}, inkFaceView.draw(ctx)))
  assert.match(html, /Reading lacks material\.halo/)
  assert.doesNotMatch(html, /ink-mark/)
})

// Walk a returned React element tree and yield each element that has props.
function* elements(node) {
  if (node === null || typeof node !== 'object') return
  if (Array.isArray(node)) {for (const item of node) yield* elements(item); return}
  if (node.props) {yield node; yield* elements(node.props.children)}
}

test('switches: the grain toggle and dot shape emit exactly the admitted panel-setting shapes', () => {
  const calls = []
  const apply = changes => {calls.push(changes); return Promise.resolve({ok: true})}
  const tree = inkFaceView.switches({reading: reading(), disabled: false, apply})
  const all = [...elements(tree)]
  const toggle = all.find(item => item.type === 'input' && item.props.type === 'checkbox')
  assert.equal(toggle.props.checked, true, 'an unset grain profile reads as on, as the app does')
  toggle.props.onChange({target: {checked: false}})
  const dot = all.find(item => item.type === 'select' && item.props['aria-label'] === 'Native dot shape')
  assert.equal(dot.props.value, 'circle')
  dot.props.onChange({target: {value: 'square'}})
  assert.deepEqual(calls, [
    [{kind: 'panel-setting', key: 'grainProfile', value: false}],
    [{kind: 'panel-setting', key: 'dotShape', value: 'square'}],
  ])
})

// The host admission rules for field-font (hostEditor.ts applyNativeGlyphChanges), restated so every emitted change is checked against them.
const admittedFieldFont = change => {
  if (change.kind !== 'field-font' || !change.values || !Object.keys(change.values).length) return false
  if (Object.keys(change.values).some(key => !['fontFamily', 'fontWeight'].includes(key))) return false
  const {fontFamily, fontWeight} = change.values
  if (fontFamily !== undefined && (typeof fontFamily !== 'string' || !fontFamily.trim() || fontFamily.length > 200 || /[\u0000-\u001f;{}]/.test(fontFamily))) return false
  if (fontWeight !== undefined && (!Number.isInteger(fontWeight) || fontWeight < 1 || fontWeight > 1000)) return false
  return true
}

test('glyph builders emit the field-font shape the host admits, and the weight grid is 100 to 900 in steps of 100', () => {
  assert.deepEqual(FIELD_FONT_WEIGHTS, [100, 200, 300, 400, 500, 600, 700, 800, 900])
  assert.deepEqual(fontChange('Georgia, serif'), {kind: 'field-font', values: {fontFamily: 'Georgia, serif'}})
  assert.deepEqual(weightChange(300), {kind: 'field-font', values: {fontWeight: 300}})
  assert.ok(FIELD_FONT_WEIGHTS.every(w => admittedFieldFont(weightChange(w))))
  assert.ok(FONT_OPTIONS.every(option => admittedFieldFont(fontChange(option.stack))))
  assert.equal(admittedFieldFont(fontChange('a;b')), false, 'the validator refuses a stack with a semicolon, so the builder never offers one')
})

const glyphRender = engine => renderToStaticMarkup(createElement('div', null, inkFaceView.switches({reading: reading({}, engine), disabled: false, apply: () => Promise.resolve({ok: true})})))

test('switches: typeface and weight are real selects with accessible names, the catalog options and the current values', () => {
  const html = glyphRender({fontFamily: 'Georgia, "Times New Roman", serif', fontWeight: 700})
  assert.match(html, /<select aria-label="Typeface"/)
  assert.match(html, /<select aria-label="Weight"/)
  for (const option of FONT_OPTIONS) assert.match(html, new RegExp(`<option value="${option.id}"`), option.id)
  assert.match(html, /<option value="classic-serif"[^>]*selected/, 'the reading typeface is the selected option')
  assert.match(html, /<option value="700"[^>]*selected/, 'the reading weight is the selected option')
  const weights = html.split('<select aria-label="Weight"')[1].split('</select>')[0]
  assert.deepEqual([...weights.matchAll(/<option value="(\d+)"/g)].map(match => Number(match[1])), [100, 200, 300, 400, 500, 600, 700, 800, 900])
  assert.doesNotMatch(html, /not in the reading/i, 'a reading that carries the font states nothing missing')
  assert.doesNotMatch(html, /not writable from the shell yet/)
})

test('switches: a reading without the Field font says so and still offers every choice', () => {
  const html = glyphRender({})
  assert.match(html, /current font not in the reading/)
  assert.match(html, /current weight not in the reading/)
  assert.equal((html.match(/<option value="" disabled=""[^>]*>Not in the reading<\/option>/g) ?? []).length, 2, 'typeface and weight each show the missing value')
  for (const option of FONT_OPTIONS) assert.match(html, new RegExp(`<option value="${option.id}"`))
})

test('switches: a custom stack in the reading is shown as the custom choice, and the catalog stays selectable', () => {
  const html = glyphRender({fontFamily: 'Iosevka, monospace', fontWeight: 900})
  assert.match(html, /Custom stack in the reading/)
  assert.match(html, /<option value="modern-mono"/)
})

test('switches: each typeface or weight choice is one apply of one admitted change, and disabled disables both selects', () => {
  const emitted = []
  const reading0 = reading({}, {fontFamily: 'Georgia, "Times New Roman", serif', fontWeight: 700})
  const controls = (disabled, choose = change => emitted.push(change)) => [...elements(glyphControls({reading: reading0, disabled, error: null, choose}))]
  const typeface = controls(false).find(item => item.type === 'select' && item.props['aria-label'] === 'Typeface')
  const weight = controls(false).find(item => item.type === 'select' && item.props['aria-label'] === 'Weight')
  const didone = FONT_OPTIONS.find(option => option.id === 'didone')
  typeface.props.onChange({target: {value: 'didone'}})
  typeface.props.onChange({target: {value: '__custom__'}})
  weight.props.onChange({target: {value: '300'}})
  weight.props.onChange({target: {value: '450'}})
  assert.deepEqual(emitted, [
    {kind: 'field-font', values: {fontFamily: didone.stack}},
    {kind: 'field-font', values: {fontWeight: 300}},
  ], 'the custom sentinel and off-grid weight are never offered, so they emit nothing')
  assert.ok(emitted.every(admittedFieldFont))
  assert.ok(controls(true).filter(item => item.type === 'select').every(item => item.props.disabled === true))
})

test('chooseGlyph: one apply with the change, a refusal is shown as its reason, and a throw is shown as its message', async () => {
  const change = weightChange(500)
  const calls = []
  const reports = []
  const ok = async changes => {calls.push(changes); return {ok: true, reading: null}}
  await chooseGlyph(ok, change, error => reports.push(error))
  assert.deepEqual(calls, [[change]], 'exactly one apply, carrying exactly the change')
  assert.deepEqual(reports, [null])
  await chooseGlyph(async () => ({ok: false, error: 'Field font weight must be an integer between 1 and 1000'}), change, error => reports.push(error))
  await chooseGlyph(async () => {throw Error('The captured scene no longer exists')}, change, error => reports.push(error))
  assert.deepEqual(reports, [null, 'Field font weight must be an integer between 1 and 1000', 'The captured scene no longer exists'])
  assert.equal(refusalOf({ok: true}), null)
  assert.equal(refusalOf(undefined), null)
  assert.equal(refusalOf({ok: false, error: 'nope'}), 'nope')
})

test('the device module keeps the shell import rule: it imports the editor shell nowhere', async () => {
  const text = await readFile(new URL('../src/components/NativeFieldFace.ink.tsx', import.meta.url), 'utf8')
  assert.doesNotMatch(text, /from '\.\/NativeDeviceEditors'/)
  const modelText = await readFile(new URL('../src/components/nativeFieldFace.ink.ts', import.meta.url), 'utf8')
  assert.doesNotMatch(modelText, /^import (?!type )(?!\{fieldValue\})/m, 'the model imports only its value helper and types')
})
