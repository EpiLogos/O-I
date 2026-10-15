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
const captureBody = (state, over = {}) => createElement(Stage.StageCaptureBody, {sender: senderFor(state), chosen: 'still', options: OPTIONS, edition: false,
  editionId: 'edition', onChoose: noop, onOptions: noop, onEdition: noop, ...over})

test('Tools holds the stage\'s view: the camera, the guides and the view, read from the hosted state, beside the Pointer', () => {
  Door.publishHostedChrome({state: staged(), run: async () => ({ok: true}), faults: []})
  const tools = sectionOf(studio(), 'studio:tools')
  for (const group of ['Camera', 'Guides and snap', 'View']) assert.match(tools, new RegExp(`role="group" aria-label="${group}"`), `${group} stands in Tools`)
  const on = stageButtons(tools)
  assert.deepEqual(Object.keys(on), ['view-2d', 'view-3d', 'face-plane', 'grid', 'snap', 'guides', 'fit-view', 'keep-view', 'restore-view'])
  for (const [id, attrs] of Object.entries(on)) assert.doesNotMatch(attrs, /disabled/, `${id} is live with a native Scene open`)
  assert.match(on['view-3d'], /aria-pressed="true"/)
  assert.match(on['view-2d'], /aria-pressed="false"/)
  assert.match(on.grid, /aria-pressed="true"/)
  assert.match(on.snap, /aria-pressed="false"/)
  assert.doesNotMatch(on['fit-view'], /aria-pressed/, 'an action claims no pressed state')
  assert.match(on['fit-view'], /aria-label="Fit view"[^>]*data-i="Fit view\|Return the camera to its default framing, facing the plane\."/, 'the owner\'s label, what it does in the hover words')
  assert.match(tools, /Open a native Expression to see its Pointer\./, 'the Pointer field device keeps its place in Tools')
  Door.publishHostedChrome(null)
})

test('Capture holds still | video, ◉ Capture, Present and Edition…; no line says capture is undisclosed', () => {
  Door.publishHostedChrome({state: staged({videoTake: false}, {presenting: false}), run: async () => ({ok: true}), faults: []})
  const capture = sectionOf(studio(), 'studio:capture')
  assert.doesNotMatch(capture, /No owner discloses capture/)
  assert.match(capture, /role="group" aria-label="Capture kind"/)
  assert.match(capture, /aria-pressed="true"[^>]*>still<\/button>/, 'a still is the first choice (the mockup\'s x.cap)')
  const on = stageButtons(capture)
  assert.match(on['capture-png'], /class="studio-stage-button is-primary"/, '◉ Capture is the section\'s primary press')
  assert.match(on['capture-png'], /aria-label="Capture PNG"/)
  assert.match(capture, /aria-label="Capture PNG"[^>]*><svg[^]*?<\/svg>Capture<\/button>/, 'the cut\'s capture mark, then its word')
  assert.match(on.present, /aria-pressed="false"/)
  assert.match(capture, /aria-expanded="false"[^>]*>Edition…<\/button>/)
  Door.publishHostedChrome({state: staged(), run: async () => ({ok: true}), faults: []})
  assert.doesNotMatch(stageButtons(sectionOf(studio(), 'studio:capture')).present, /aria-pressed/, 'no presenting reading, no pressed claim')
  Door.publishHostedChrome(null)
})

test('with no frame, every stage control is off and keeps its owner\'s reason in its hover words', () => {
  Door.publishHostedChrome(null)
  const html = studio()
  const off = {...stageButtons(sectionOf(html, 'studio:tools')), ...stageButtons(sectionOf(html, 'studio:capture'))}
  assert.equal(Object.keys(off).length, 11)
  for (const [id, attrs] of Object.entries(off)) {
    assert.match(attrs, /disabled=""/, id)
    assert.match(attrs, /title="No Expressions application is mounted\."/, id)
    assert.match(attrs, /data-i="[^|"]+\|No Expressions application is mounted\."/, `${id}: the Info view reads the reason`)
  }
  assert.match(sectionOf(html, 'studio:capture'), /class="inst-section-line studio-stage-reason">No Expressions application is mounted\./, 'the reason stands once, in Capture')
  Door.publishHostedChrome({state: {hostMode: 'expressions', sceneCount: 0}, run: async () => ({ok: true}), faults: []})
  const closed = stageButtons(sectionOf(studio(), 'studio:tools'))
  assert.match(closed['view-2d'], /title="Open a native Expression to use its stage\."/, 'no native Scene: the owner\'s own reason')
  Door.publishHostedChrome(null)
})

test('every control the pane carried still stands and writes through the stage command it used — none is lost', () => {
  const state = staged({videoTake: true})
  const view = pressAll(createElement(Stage.StageViewTools, {sender: senderFor(state)}))
  assert.deepEqual(view, ['view-2d', 'view-3d', 'face-plane', 'grid', 'snap', 'guides', 'fit-view', 'keep-view', 'restore-view'].map(action => [action, Commands.stageView(action)]))
  const still = pressAll(captureBody(state, {edition: true}))
  assert.deepEqual(still, [
    ['capture-png', Commands.stageCapturePng(OPTIONS)],
    ['present', Commands.stagePresent(true)],
    ['export-json', Commands.stageExport('json')], ['export-native', Commands.stageExport('native')], ['export-html', Commands.stageExport('html')],
    ['import', Commands.STAGE_IMPORT],
  ], 'the still capture carries the chosen options; Edition… holds Export and Import')
  const video = pressAll(captureBody(state, {chosen: 'video'}))
  assert.deepEqual(video, [['record', Commands.stageRecord('start', OPTIONS)], ['present', Commands.stagePresent(true)], ['save-video', Commands.STAGE_SAVE_VIDEO]])
  const recording = pressAll(captureBody(staged({}, {recording: true, presenting: true})))
  assert.deepEqual(recording, [['record', Commands.stageRecord('stop')], ['present', Commands.stagePresent(false)]], 'a take records: Stop, and Save video waits')
  const pressed = new Set([...view, ...still, ...video, ...recording].map(([key]) => key))
  // The old toolbar's seventeen commands (NativeStageTools before 14 Oct): nine view actions, capture, record, save, present, three exports, import.
  assert.equal(pressed.size, 17)
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
  // T-FRAME-CHROME-ONTO-PLATES: Tools stands the frame's tools no other device carries before the stage's view; the work's own acts
  // (Save, Undo, Redo) stand in the Studio's head, where the mockup draws Save (lane E, InstrumentPlate `head`).
  assert.match(studioSource, /if \(section\.id === 'studio:tools'\) parts\.push\(<FrameControls key="frame-tools"[^\n]*\n\s*<StageViewTools key="stage" sender=\{stage\} \/>\)/)
  assert.match(studioSource, /const work = frameAt\('work'\)[\s\S]*<FrameControls label="Work" controls=\{work\} view=\{frame\} \/>[\s\S]*head=\{head\}/, 'Save, Undo and Redo in the head')
  assert.match(studioSource, /if \(section\.id === 'studio:capture'\) parts\.push\(<StageCaptureTools key="stage" sender=\{stage\} \/>\)/)
  // The centre residence's strip (components/NativeStageTools.tsx) drew the same two bodies; it was drawn by nothing and was deleted on
  // 15 Oct (FOUNDATION §7), so the Studio is the one place the stage's controls stand.
  const {existsSync} = await import('node:fs')
  assert.ok(!existsSync(new URL('../src/components/NativeStageTools.tsx', import.meta.url)), 'the strip is deleted')
  const pane = (await source('projections/expressionsPane.tsx')).replace(/^\s*\/\/.*$/gm, '')
  assert.doesNotMatch(pane, /NativeStageTools|StudioStage|presentHostedExpressions|<button/, 'the pane carries no control')
})
