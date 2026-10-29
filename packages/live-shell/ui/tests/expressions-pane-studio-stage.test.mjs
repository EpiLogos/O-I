import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {register} from 'node:module'
import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'

// The Expressions centre at the mockup's floor (14 Oct, owner: "immediately seeing the violations of having options inside the pane";
// PATH §1: controls live in device UI, never as chrome inside a pane; the mockup's Studio TOOLS and CAPTURE, world-shell-mockup.html
// :1434 and :1440). The pane's stage tool rows moved into the Studio's Tools and Capture sections (components/expressions/studio/
// StudioStage.tsx): every control the pane carried still stands, sends the same typed command (native/stageCommands.ts) through the
// frame's one runner, and keeps its owner's disabled reason in its hover words. Production modules in memory (the loader of
// expressions-studio-plate.test.mjs); the hosted chrome is a fixture published through the pane host door, not a native frame.
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

const noop = () => {}
globalThis.__CRADLE_WALK__ = false
globalThis.document ??= {getElementById: () => null, createElement: () => ({style: {}, setAttribute: noop, appendChild: noop}), head: {appendChild: noop},
  addEventListener: noop, removeEventListener: noop, querySelector: () => null, documentElement: {style: {}}}
globalThis.window ??= globalThis
globalThis.addEventListener ??= noop; globalThis.removeEventListener ??= noop

const src = path => new URL(`../src/${path}`, import.meta.url).href
const world = await import(src('inhabitants/worldShellFamilies.ts'))
world.loadWorldShellFamilies()
const [WS, Detail, Stage, Commands, Door] = await Promise.all([
  import(src('shell/workspaceContext.tsx')),
  import(src('components/NativeWorldDetail.tsx')),
  import(src('components/expressions/studio/StudioStage.tsx')),
  import(src('native/stageCommands.ts')),
  import(src('projections/expressionsPaneHost.ts')),
])
const source = path => readFile(new URL(`../src/${path}`, import.meta.url), 'utf8')

const READY = {hostMode: 'expressions', sceneCount: 1, document: {id: 'expression:kept', name: 'Kept work'},
  nativeScene: {expression_ref: 'expression:kept', revision: 3, scene_ref: 'scene:one'}}
const staged = (stage = {}, extra = {}) => ({...READY, stage: {mode: '3d', grid: true, snap: false, guides: true, ...stage}, ...extra})

// The Device side as the candidate draws it: the detail's Studio, no editor reading (no work open), the frame's chrome as published.
const studio = () => renderToStaticMarkup(createElement(WS.Workspace.Provider, {value: {workspaceId: 'stage-fixture', accessEpoch: 1, accessReady: true,
  nativeAccessCurrent: () => true, mode: 'expressions', editor: null, editorReading: null, transport: {kind: 'unavailable', reason: 'a fixture'}}},
  createElement(Detail.NativeWorldDetail, {mode: 'device', expand: noop, collapse: noop, presentMode: noop})))
const sectionOf = (html, id) => {
  const start = html.indexOf(`data-section="${id}"`)
  assert.ok(start >= 0, `the ${id} section stands`)
  const next = html.indexOf('<section class="inst-section"', start)
  return html.slice(start, next < 0 ? undefined : next)
}
const stageButtons = html => Object.fromEntries([...html.matchAll(/<button([^>]*)>/g)].map(([, attrs]) => attrs).filter(attrs => attrs.includes('data-stage="'))
  .map(attrs => [attrs.match(/data-stage="([^"]+)"/)[1], attrs]))

// Press every stage control a section body draws: walk its element tree, draw each control (a function component without hooks) and
// call its press. The sender records what each press sends, so the test reads the command each control writes through.
function pressAll(element) {
  const sent = []
  const walk = node => {
    if (Array.isArray(node)) return node.forEach(walk)
    if (!node || typeof node !== 'object' || !node.props) return
    if (typeof node.type === 'function' && 'command' in node.props) {
      const drawn = node.type(node.props)
      if (!drawn.props.disabled) drawn.props.onClick()
      return
    }
    walk(node.props.children)
  }
  const sender = {...element.props.sender, send: (key, command) => sent.push([key, command])}
  walk(element.type({...element.props, sender}))
  return sent
}
const senderFor = state => ({reason: Commands.stageDisabledReason({mounted: true, state, busy: false}), readings: Commands.stageReadings(state), refusal: null, send: noop})
const OPTIONS = {width: 1920, aspect: '16:9', includeText: false, transparent: true}

// O-I #747 round two (lead's rulings of 29 Oct): the Stage keeps only what has no home yet — the camera. Grid, Snap and Guides are the View
// menu's; Fit, Keep and Restore the Clip panel's View; ◉ Capture with its choices File › Export › Picture…; the video take File › Export ›
// Film; Import the browser's. REPLACED: the Stage's View (camera, guides and Fit) and Capture sections.
test('the Stage\'s Camera holds the camera alone, read from the hosted state; the view and Capture sections are gone to their homes', () => {
  Door.publishHostedChrome({state: staged(), run: async () => ({ok: true}), faults: []})
  const html = studio()
  const camera = sectionOf(html, 'stage:camera')
  assert.match(camera, /role="group" aria-label="Camera"/)
  const on = stageButtons(camera)
  assert.deepEqual(Object.keys(on), ['view-2d', 'view-3d', 'face-plane'])
  for (const [id, attrs] of Object.entries(on)) assert.doesNotMatch(attrs, /disabled/, `${id} is live with a native Scene open`)
  assert.match(on['view-3d'], /aria-pressed="true"/); assert.match(on['view-2d'], /aria-pressed="false"/)
  assert.doesNotMatch(on['face-plane'], /aria-pressed/, 'an action claims no pressed state')
  for (const gone of ['stage:view', 'stage:capture']) assert.equal(html.indexOf(`data-section="${gone}"`), -1, `${gone}: moved to its home`)
  assert.doesNotMatch(html, /data-stage="(grid|snap|guides|fit-view|keep-view|restore-view|capture-png|record|present|save-video|import|export-[a-z]+)"/)
  Door.publishHostedChrome(null)
})

test('with no frame, the camera is off and keeps its owner\'s reason in its hover words', () => {
  Door.publishHostedChrome(null)
  const off = stageButtons(sectionOf(studio(), 'stage:camera'))
  assert.equal(Object.keys(off).length, 3)
  for (const [id, attrs] of Object.entries(off)) {
    assert.match(attrs, /disabled=""/, id)
    assert.match(attrs, /data-i="[^|"]+\|No Expressions application is mounted\."/, `${id}: the Info view reads the reason`)
  }
  Door.publishHostedChrome({state: {hostMode: 'expressions', sceneCount: 0}, run: async () => ({ok: true}), faults: []})
  assert.match(stageButtons(sectionOf(studio(), 'stage:camera'))['view-2d'], /title="Open a native Expression to use its stage\."/, 'no native Scene: the owner\'s own reason')
  Door.publishHostedChrome(null)
})

test('File › Export › Picture… asks the manual\'s choices at their defaults, then exports one capture with them; the last export stands under them', () => {
  const state = staged()
  const element = createElement(Stage.PictureChoicesBody, {sender: senderFor(state), options: Commands.STAGE_CAPTURE_DEFAULTS, onOptions: noop, onDone: noop})
  const html = renderToStaticMarkup(element)
  assert.match(html, /role="group" aria-label="Export picture"/)
  assert.match(html, /<option value="1440" selected="">1440 px<\/option>/, 'Width: 1440 by default')
  assert.match(html, /<option value="stage" selected="">Stage frame<\/option>/, 'Frame: Stage frame by default')
  assert.match(html, /<input type="checkbox" checked=""\/> Include page text/, 'page text on by default')
  assert.match(html, /<input type="checkbox"\/> Transparent background/, 'transparent off by default')
  assert.deepEqual(pressAll(element), [['capture-png', Commands.stageCapturePng(Commands.STAGE_CAPTURE_DEFAULTS)]])
  assert.deepEqual(pressAll(createElement(Stage.PictureChoicesBody, {sender: senderFor(state), options: OPTIONS, onOptions: noop, onDone: noop})),
    [['capture-png', Commands.stageCapturePng(OPTIONS)]], 'the choices made are the ones sent')
  const saved = renderToStaticMarkup(createElement(Stage.PictureChoices, {sender: senderFor(state), onDone: noop,
    exported: {state: 'saved', file: 'field.png', folder: '/Users/person/Downloads', place: '~/Downloads', fault: null, reason: null}}))
  assert.match(saved, /class="studio-export-line" role="status" data-export="saved"[^>]*>Saved “field\.png” in ~\/Downloads\.<\/p>/)
})

test('every control the pane carried still writes through the command it used, here or at its home — none is lost', async () => {
  const state = staged({videoTake: true})
  const camera = pressAll(createElement(Stage.StageViewTools, {sender: senderFor(state)}))
  assert.deepEqual(camera, ['view-2d', 'view-3d', 'face-plane'].map(action => [action, Commands.stageView(action)]))
  // MOVED (O-I #747), each to its home through the same command:
  const menu = id => Stage.menuStageCommands(id, state)
  const moved = [
    ['grid', menu('view.grid'), [Commands.stageView('grid')]], ['snap', menu('view.snap'), [Commands.stageView('snap')]],
    ['guides', menu('view.guides'), [Commands.stageView('guides')]], ['present', menu('view.present'), [Commands.stagePresent(true)]],
    ['record', menu('file.export.film'), [Commands.stageRecord('start', Commands.STAGE_CAPTURE_DEFAULTS)]],
    ['save-video', Stage.menuStageCommands('file.export.film', {...state, recording: true}).slice(1), [Commands.STAGE_SAVE_VIDEO]],
    ['export-json', menu('file.export.json'), [Commands.stageExport('json')]], ['export-native', menu('file.export.native'), [Commands.stageExport('native')]],
    ['export-html', menu('file.export.html'), [Commands.stageExport('html')]],
    ['capture-png', pressAll(createElement(Stage.PictureChoicesBody, {sender: senderFor(state), options: Commands.STAGE_CAPTURE_DEFAULTS, onOptions: noop, onDone: noop})).map(([, command]) => command), [Commands.stageCapturePng(Commands.STAGE_CAPTURE_DEFAULTS)]],
  ]
  for (const [key, sent, expected] of moved) assert.deepEqual(sent, expected, `${key} stands at its home`)
  const clip = await source('components/expressions/clip/clipBinding.ts')
  for (const action of ['keep-view', 'restore-view', 'fit-view']) assert.match(clip, new RegExp(`staged\\(stage, stageView\\('${action}'\\)\\)`), `${action}: the Clip panel's View`)
  assert.match(await source('components/NativeExpressionCollections.tsx'), /runner\(STAGE_IMPORT\)/, 'import: the browser')
  const pressed = new Set([...camera.map(([key]) => key), ...moved.map(([key]) => key), 'keep-view', 'restore-view', 'fit-view', 'import'])
  // The old toolbar's seventeen commands (NativeStageTools before 14 Oct): nine view actions, capture, record, save, present, three exports, import.
  assert.equal(pressed.size, 17, 'none is lost: each stands here or at its home')
})

test('the Studio\'s one alert line carries the stage\'s refusal, and the frame\'s faults while no pane holds the frame', async () => {
  const studioSource = await source('components/expressions/studio/ExpressionsStudio.tsx')
  // T-FRAME-CHROME-ONTO-PLATES: the frame's refusal of a chrome press joins the one line.
  assert.match(studioSource, /const said = \[fault \?\? paneFault \?\? editor\.error, stage\.refusal, frame\.refusal, \.\.\.\(placement === null \? chrome\?\.faults \?\? \[\] : \[\]\)\]/)
  Door.publishHostedChrome({state: null, run: null, faults: ['The host failed.']})
  assert.match(studio(), /class="studio-fault" role="alert">The host failed\.<\/p>/, 'no pane holds the frame: the Studio says it')
  Door.registerExpressionsPane('stage-a'); Door.attachExpressionsSlot('stage-a', {name: 'a'}); Door.setExpressionsPanePresented('stage-a', true)
  assert.equal(Door.framePlacement()?.paneId, 'stage-a')
  assert.doesNotMatch(studio(), /The host failed\./, 'a pane holds the frame: its fault line stands at that pane\'s foot instead (one line, never two)')
  Door.unregisterExpressionsPane('stage-a')
  Door.publishHostedChrome(null)
})

test('ported, not recreated: one sender, the same builders, the Studio draws the two bodies (source reading)', async () => {
  const stage = await source('components/expressions/studio/StudioStage.tsx')
  assert.match(stage, /stageDisabledReason\(\{mounted: !!run, state, busy: busy !== null\}\)/, 'the shared reason, as the toolbar computed it')
  assert.match(stage, /try \{answer = run\(command\)\} catch \(cause\) \{setBusy\(null\); setRefusal\(reasonOf\(cause\)\); return\}/, 'the toolbar\'s send, moved whole')
  assert.match(stage, /const why = sender\.reason \?\? blocked \?\? null/, 'the shared reason wins over a control\'s own, as before')
  const studioSource = await source('components/expressions/studio/ExpressionsStudio.tsx')
  assert.match(studioSource, /const chrome = useHostedChrome\(\)\s*const stage = useStageSender\(chrome\?\.state \?\? null, chrome\?\.run \?\? null\)/)
  // R4: the Stage stands the frame's tools no other device carries, then the stage's view, then capture; the work's own acts (Save, Undo,
  // Redo) are the Studio design's head acts on the editor's own requests (studioBinding.ts) — REPLACED: the frame's Work controls in the
  // old plate's head.
  assert.match(studioSource, /\{id: 'stage:frame', title: 'Frame tools', children: <FrameControls label="Frame tools" controls=\{frameTools\} view=\{frame\} \/>\}/)
  assert.match(studioSource, /\{id: 'stage:camera', title: 'Camera', children: <StageViewTools sender=\{stage\} \/>\}/)
  assert.doesNotMatch(studioSource, /StageCaptureTools|stage:capture/, 'Capture is File › Export\'s (O-I #747)')
  assert.match(await source('components/expressions/studio/studioBinding.ts'), /ports\.request\(\{operation: key, basis: reading\.basis\}\)/, 'Save, Undo and Redo: the editor\'s own requests')
  // The centre residence's strip (components/NativeStageTools.tsx) drew the same two bodies; it was drawn by nothing and was deleted on
  // 15 Oct (FOUNDATION §7), so the Studio is the one place the stage's controls stand.
  const {existsSync} = await import('node:fs')
  assert.ok(!existsSync(new URL('../src/components/NativeStageTools.tsx', import.meta.url)), 'the strip is deleted')
  const pane = (await source('projections/expressionsPane.tsx')).replace(/^\s*\/\/.*$/gm, '')
  assert.doesNotMatch(pane, /NativeStageTools|StudioStage|presentHostedExpressions|<button/, 'the pane carries no control')
})
