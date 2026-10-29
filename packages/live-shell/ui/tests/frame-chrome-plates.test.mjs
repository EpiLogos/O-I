// T-FRAME-CHROME-ONTO-PLATES: the hosted frame draws only its field in a pane; every control its chrome drew there stands on a device —
// the research canvas's, timeline's and journey's on the Canvas, Timeline and Journey plates in the manual's groups (DLW.md §17.4–§17.6), the
// Expressions stage's on the Studio — read from the frame's published chrome and pressed through its one runner. The shell declares the
// presentation ('devices', in a pane of any size: manual §20.1, owner 20 Oct) from the transport, which stands in
// every mode. Rendered server-side with production modules in memory (the loader of atlas-places-plate.test.mjs).
import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'
import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'

const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};
import {readFile} from 'node:fs/promises';
export async function resolve(s, c, n) {
  let r = null
  try { r = await n(s, c) } catch (e) { if (!s.startsWith('.')) throw e }
  if (r) {
    if (r.url.endsWith('.html') || r.url.endsWith('.css')) return {...r, format: 'module'}
    return r
  }
  if (s.endsWith('.js')) { try { return await n(s.slice(0, -3) + '.ts', c) } catch {} }
  for (const x of ['.ts', '.tsx']) { try { return await n(s + x, c) } catch {} }
  for (const x of ['/index.ts', '/index.tsx']) { try { return await n(s + x, c) } catch {} }
  throw new Error('cannot resolve ' + s)
}
export async function load(u, c, n) {
  if (u.endsWith('.css')) return {format: 'module', shortCircuit: true, source: 'export {}'};
  if (u.includes('?raw') || u.includes('.html')) return {format: 'module', shortCircuit: true, source: 'export default ""'};
  if (u.endsWith('.json')) return {format: 'module', shortCircuit: true, source: 'export default ' + await readFile(new URL(u), 'utf8')};
  if (!u.endsWith('.ts') && !u.endsWith('.tsx')) return n(u, c);
  const out = ts.transpileModule(await readFile(new URL(u), 'utf8'), {fileName: new URL(u).pathname,
    compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX}}).outputText;
  return {format: 'module', shortCircuit: true, source: out.split('import.meta.env').join('({BASE_URL: "/"})')};
}`)}`, import.meta.url)

globalThis.__CRADLE_WALK__ = false
const door = await import('../src/inhabitants/familyManifest.ts')
const world = await import('../src/inhabitants/worldShellFamilies.ts')
const adoptRows = await import('../src/inhabitants/sdk/adoptVerifiedRows.ts')
const {InstrumentDeviceDetail} = await import('../src/shell/ModeDetail.tsx')
const {publishHostedChrome} = await import('../src/projections/expressionsPaneHost.ts')
const {controlsAt} = await import('../src/components/expressions/studio/frameChrome.tsx')
const {wantedPresentation} = await import('../src/components/expressions/studio/framePresentation.ts')
const {STUDIO_CARRIED} = await import('../src/components/expressions/studio/studioModel.ts')
const {STAGE_PLATES, EXPRESSION_SECTION} = await import('../src/projections/stageInstruments/stageInstrumentModel.ts')
// The frame's lazy parts (a mode's bodies, its transport and tracks, a device's face) load when first drawn (shell/loadWhenDrawn.ts;
// O-I #740); a server render cannot wait for a module, so they are fetched first and every body renders itself.
await (await import('../src/shell/loadWhenDrawn.ts')).loadEveryPart()
const {readFile} = await import('node:fs/promises')

door.resetFamilyManifestsForTest()
world.loadWorldShellFamilies()
adoptRows.adoptVerifiedRows()

const source = path => readFile(new URL(path, import.meta.url), 'utf8')
const transport = {kind: 'unavailable', reason: 'the test carrier is down'}
const plate = instrument => renderToStaticMarkup(createElement(InstrumentDeviceDetail, {transport, instrument}))
const control = (id, home, label, extra = {}) => ({id, home, kind: 'button', label, ...extra})

/** The frame's chrome as the frame publishes it on the canvas lens (presentedChrome.ts ids `region/key`, the frame's own words). */
const CANVAS = {lens: 'canvas', controls: [
  control('save/a:native-save', 'work', 'Save (⌘S)', {short: undefined}),
  control('save/a:undo', 'work', 'Undo edit'),
  control('save/l:Nara', 'nara', 'Nara', {kind: 'toggle', pressed: false}),
  // The frame's Lens studio names each instrument by its work (#801; field-studies-journeys/src/lensStudio.ts LENSES), never by M′.
  control('lens/a:lens:canvas', 'lens', 'Canvas · Constellation', {kind: 'toggle', pressed: true}),
  control('scene/a:previous', 'scene', 'Previous scene (←)'),
  control('scene/l:Acts', 'scene', 'Acts', {title: 'Roles, reusable material and act playback', kind: 'toggle', pressed: false}),
  control('tools/l:Note', 'canvas:tools', 'Note'),
  control('tools/l:Snap', 'canvas:tools', 'Snap', {kind: 'toggle', pressed: true}),
  control('tools/l:Lasso', 'canvas:tools', 'Lasso', {kind: 'toggle', pressed: false}),
  control('zoom/l:Fit all cards', 'canvas:look', 'Fit all cards', {title: 'Fit all (Shift+1)'}),
  control('overview/l:Hide overview', 'canvas:look', 'Hide overview', {kind: 'toggle', pressed: true}),
  control('views/l:Saved views', 'canvas:views', 'Saved views', {kind: 'select', value: '', options: [{value: '', label: 'Views…'}, {value: 'apply\u0000one', label: 'Apply', group: 'one'}]}),
  control('tools/.research-save-glyph', 'canvas:tools', 'Saved', {kind: 'reading', value: 'Saved'}),
]}
const state = (chrome, extra = {}) => ({hostMode: 'techne', lens: 'canvas', sceneIndex: 0, sceneCount: 1, presentation: 'devices', chrome, ...extra})
const run = async () => ({ok: true})

test('the Canvas stands as one plate of the groups its design does not carry and the Expression, each frame control in its home', () => {
  publishHostedChrome({state: state(CANVAS), run, faults: []})
  try {
    const out = plate('techne:m1')
    assert.match(out, /data-instrument="techne:m1"[^>]*data-stage-plate="canvas"/, 'the stage plate stands open for the Canvas')
    // W4-Technē: the Canvas design (techne:canvas) heads the Canvas's chain and carries Look whole — zoom, Fit, the overview — with Mode, Grid and
    // the save state, on the frame's research reading and acts (stageInstrumentModel.ts CARRIED_BY_DESIGN): the plate draws none of them.
    const order = ['tools', 'lines', 'relation', 'views', 'expression'].map(id => out.indexOf(`data-section="${id}"`))
    assert.ok(order.every(at => at > 0), 'every group the design does not carry stands')
    assert.equal(out.indexOf('data-section="look"'), -1, 'Look is the design\'s')
    assert.equal(out.indexOf('data-section="display"'), -1, 'the picture is the design\'s display')
    assert.deepEqual([...order].sort((a, b) => a - b), order, 'in the manual\'s order, the Expression last')
    const section = id => out.slice(out.indexOf(`data-section="${id}"`), out.indexOf('</section>', out.indexOf(`data-section="${id}"`)))
    assert.match(section('tools'), /data-chrome="tools\/l:Note"/)
    assert.doesNotMatch(section('tools'), />Snap</, 'Grid is the design\'s')
    assert.doesNotMatch(section('tools'), /data-chrome="tools\/\.research-save-glyph"/, 'the save state is the design\'s')
    assert.doesNotMatch(out, /data-chrome="zoom\/l:Fit all cards"/, 'Fit all is the design\'s camera')
    assert.match(section('views'), /<optgroup label="one"><option value="apply\u0000one">Apply<\/option><\/optgroup>/, 'the frame\'s own choices')
    // With no line selected the frame places nothing in Lines, and its waiting rows are the design's now: an empty group folds to its title.
    assert.match(out, /data-section="lines" data-folded="true"/, 'Lines, empty, folds to its title')
    assert.doesNotMatch(section('relation'), /data-waiting="true"/, 'a parameter no owner carried is the design\'s now, drawn there with its reason')
    // The Expression stands as the runtime's fold strip until pressed (no scroller: a column that cannot fit is a fold); what it opens to
    // is the stage-wide chrome — Save, Acts — never the lens chooser.
    assert.match(out, /data-section="expression" data-folded="true"/, 'the Expression folds to its title')
    const stageWide = controlsAt(CANVAS, EXPRESSION_SECTION.homes).map(item => item.id)
    assert.ok(stageWide.includes('save/a:native-save') && stageWide.includes('scene/l:Acts'), 'Save and Acts stand in the Expression')
    assert.doesNotMatch(out, /data-chrome="lens\//, 'the lens chooser is the rack\'s instrument folds, never drawn twice')
  } finally {
    publishHostedChrome(null)
  }
})

test('the Timeline and the Journey stand in their manual groups; a lens the stage does not stand in says so rather than drawing another lens\'s tools', () => {
  assert.deepEqual(STAGE_PLATES['techne:m2'].map(section => section.title), ['Lens', 'Readings', 'Standing', 'Window'])
  assert.deepEqual(STAGE_PLATES['techne:m3'].map(section => section.title), ['Stops', 'Pace', 'Transitions', 'Takes'])
  assert.deepEqual(STAGE_PLATES['techne:m1'].map(section => section.title), ['Tools', 'Lines', 'Relation', 'Look', 'Views'])
  assert.deepEqual([...EXPRESSION_SECTION.homes], ['work', 'scene', 'tools', 'nara', 'capture', 'side'])
  publishHostedChrome({state: state(CANVAS), run, faults: []})
  try {
    const out = plate('techne:m2')
    assert.match(out, /data-stage-plate="timeline"/)
    assert.match(out, /The stage stands in its canvas lens: open Timeline on the focused pane/)
    assert.doesNotMatch(out.slice(out.indexOf('data-section="lens"'), out.indexOf('data-section="expression"')), /data-chrome="tools\//)
  } finally {
    publishHostedChrome(null)
  }
})

test('with no frame mounted the plate says why, and draws no control', () => {
  publishHostedChrome(null)
  const out = plate('techne:m3')
  assert.match(out, /data-stage-plate="journey"/)
  assert.match(out, /No Expressions application is mounted\./)
  assert.doesNotMatch(out, /data-chrome=/)
})

test('the Studio stands only what no Expressions device carries; each carried control names its carrier', async () => {
  const chrome = {lens: 'expressions', controls: [
    control('save/a:native-save', 'work', 'Save (⌘S)'), control('save/a:capture-image', 'capture', 'Capture image'),
    control('rail/a:tool-select', 'tools', 'Select', {kind: 'toggle'}), control('rail/a:pointer-options', 'tools', 'Pointer effects', {kind: 'toggle'}),
    control('scene/a:previous', 'scene', 'Previous scene (←)'), control('scene/a:open-timeline', 'scene', 'Save scene'),
    control('side/a:toolbelt', 'side', 'Toolbelt', {kind: 'toggle'}),
  ]}
  const kept = controlsAt(chrome, ['work', 'tools', 'scene', 'side', 'capture'], STUDIO_CARRIED).map(item => item.id)
  // R4: R2 retired the Clip side's SceneControls, so its scene ‹ › is carried by no device: the Stage stands it.
  assert.deepEqual(kept, ['save/a:native-save', 'rail/a:tool-select', 'scene/a:previous', 'scene/a:open-timeline'])
  const model = await source('../src/components/expressions/studio/studioModel.ts')
  for (const id of STUDIO_CARRIED) assert.ok(model.includes(id), `${id} is named with its carrier`)
  const studio2 = await source('../src/components/expressions/studio/ExpressionsStudio.tsx')
  // REPLACED (R4): "Your controls always stand" as a NativeChosenControls section — your chosen controls are the Studio's macros, the
  // toolbelt's curation and + Parameter on its design (studioBinding.ts `controls`, `add`); the frame's Nara control is its `on:nara`.
  assert.match(studio2, /studioBinding\(\{reading, chains, nara\}/, 'the Studio\'s macros are your chosen controls')
  assert.match(studio2, /controlsAt\(frame\.reading, 'nara'\)/, 'the frame\'s own Nara control')
})

// REPLACED (UI/UX lane phase 3, owner 20 Oct; manual §20.1): the frame's own controls no longer return in a pane at full size — that UI
// is the Studio device's, its Full holding every device of the field (tests/p3-expressions-in-full.test.mjs).
test('the presentation: the frame stands on the devices at every size; declared from the transport in every mode', async () => {
  assert.equal(wantedPresentation(), 'devices')
  // The bar with its bindings (shell/transports/boundTransport.tsx) is every mode's ModeTransport once its bindings arrive (O-I #740).
  const transports = await source('../src/shell/transports/boundTransport.tsx')
  const body = transports.slice(transports.indexOf('export const boundTransport'))
  assert.match(body, /useFramePresentation\(\)/, 'the transport declares it')
  assert.doesNotMatch(body.slice(0, body.indexOf('return <Transport')), /mode ===|mode===/, 'no mode branch')
  assert.match(await source('../src/shell/modeTransports.tsx'), /bound\.boundTransport\(use\)/, 'every mode\'s bar is the bound one')
  const hook = await source('../src/components/expressions/studio/framePresentation.ts')
  assert.match(hook, /command: 'presentation', chrome: want/, 'one command over the one runner')
})

test('a press is one chrome command over the one runner, never a copy of the control\'s state', async () => {
  const chromeSource = await source('../src/components/expressions/studio/frameChrome.tsx')
  assert.match(chromeSource, /run\(\{command: 'chrome', id: control\.id, \.\.\.\(value !== undefined \? \{value\} : \{\}\)\}\)/)
  assert.match(chromeSource, /aria-pressed=\{control\.kind === 'toggle' \? !!control\.pressed : undefined\}/, 'pressed is the frame\'s reading')
  assert.doesNotMatch(chromeSource, /useState<boolean>\(|setPressed/, 'no pressed copy')
})
