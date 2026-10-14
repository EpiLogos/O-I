import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {register} from 'node:module'
import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'

// T-EXPRESSIONS-PANE-LEASE: the Expressions pane in Factory. The ticket's question is answered from code (the receipt): the kernel's
// native owner holds one active driver, so a second frame cannot hold its own lease. The pane therefore presents the one hosted
// surface: it holds no frame and no lease, reads the centre frame's reading by value, and moves the presentation to the centre.

// Production sources in memory: the mode-surface-fidelity loader (.ts/.tsx transpiled, CSS stubbed), as factory-timeline-pane.test.mjs.
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
  return {format: 'module', shortCircuit: true, source: ts.transpileModule(await readFile(new URL(u), 'utf8'), {fileName: new URL(u).pathname,
    compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX}}).outputText};
}`)}`, import.meta.url)

const door = await import('../src/projections/expressionsPaneHost.ts')
const pane = await import('../src/projections/expressionsPane.tsx')
const frame = await import('../src/projections/framePlacement.ts')
const {projectionModule} = await import('../../../../desktop/cradle/src/surface/projectionModules.ts')
const {factoryFocusedPane, deviceInstrumentFor, instrumentOfPane} = await import('../src/shell/paneInstrument.ts')
const {LENSES, FACTORY_EXPRESSIONS_LENS, factoryLensReason, factoryLensPane} = await import('../src/shell/ModeDetail.tsx')
const {NATIVE_PRESENT_EXPRESSIONS} = await import('../src/native/openStudio.ts')

const html = element => renderToStaticMarkup(element)
const source = async path => readFile(new URL(path, import.meta.url), 'utf8')
// Source reading of code only: comments carry the prose receipt and are not the module's behaviour.
const code = async path => (await source(path)).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

// A slot stands in for the pane's placeholder element: the placement registry holds it by reference and never reads it in these tests.
const slotStub = name => ({name})
const RECT = {left: 40, top: 60, width: 500, height: 300}

// A frame stands in for the centre container and its iframe: an object whose identity, parent and src must never change, and whose
// structure must never be touched. Any structural call throws, so a re-parent or a remount fails the test.
function frameModel() {
  const parent = {name: 'expressions-inhabitant'}
  const iframe = {name: 'iframe', src: 'http://127.0.0.1:8788/__application/expressions/index.html?mode=expressions&host-load=abc', parent}
  const structural = name => () => {throw Error(`the frame was structurally changed: ${name}`)}
  return {
    parent, iframe,
    frame: {name: 'expressions-application', parentNode: parent, children: [iframe], style: {position: '', left: '', top: '', width: '', height: '', zIndex: '', pointerEvents: '', display: ''},
      appendChild: structural('appendChild'), insertBefore: structural('insertBefore'), removeChild: structural('removeChild'), replaceChild: structural('replaceChild'), remove: structural('remove')},
  }
}

test('the hosted door holds the centre frame\'s reading by value and keeps the object when an equal reading is re-reported', () => {
  door.publishHostedExpressions(null)
  assert.equal(door.hostedExpressions(), null, 'nothing is published until the centre frame reports')
  const reading = {expression_ref: 'expression:one', title: 'One'}
  door.publishHostedExpressions(reading)
  assert.deepEqual(door.hostedExpressions(), reading)
  door.publishHostedExpressions({expression_ref: 'expression:one', title: 'One'})
  assert.equal(door.hostedExpressions(), reading, 'an equal reading keeps the published object: a re-report publishes nothing')
  door.publishHostedExpressions(null)
})

test('presenting the hosted surface dispatches the centre\'s existing reveal, once, and holds no frame', () => {
  const target = new EventTarget()
  const seen = []
  target.addEventListener(NATIVE_PRESENT_EXPRESSIONS, () => seen.push(NATIVE_PRESENT_EXPRESSIONS))
  const previous = globalThis.window
  globalThis.window = target
  try {
    door.presentHostedExpressions()
  } finally {
    if (previous === undefined) delete globalThis.window; else globalThis.window = previous
  }
  assert.deepEqual(seen, [NATIVE_PRESENT_EXPRESSIONS], 'the one reveal event the centre already listens for, once')
})

test('one pane presented: it holds the frame; a second presented pane does not take it from the first until chosen', () => {
  door.registerExpressionsPane('ex-a'); door.registerExpressionsPane('ex-b')
  door.attachExpressionsSlot('ex-a', slotStub('a')); door.attachExpressionsSlot('ex-b', slotStub('b'))
  door.setExpressionsPanePresented('ex-a', true)
  assert.equal(door.framePlacement()?.paneId, 'ex-a', 'the first presented pane holds the frame')
  door.setExpressionsPanePresented('ex-b', true)
  assert.equal(door.framePlacement()?.paneId, 'ex-a', 'a second presented pane does not take the frame by itself')
  door.preferExpressionsPane('ex-b')
  assert.equal(door.framePlacement()?.paneId, 'ex-b', 'the chosen pane takes the one frame: only the focused pane gets it')
  assert.equal(door.framePlacement()?.slot.name, 'b', 'the frame is drawn over the chosen pane\'s slot')
  door.unregisterExpressionsPane('ex-a'); door.unregisterExpressionsPane('ex-b')
  assert.equal(door.framePlacement(), null)
})

test('the frame leaves a pane when it is concealed (a tab switch or Factory left) and returns to a presented pane', () => {
  door.registerExpressionsPane('ex-c'); door.registerExpressionsPane('ex-d')
  door.attachExpressionsSlot('ex-c', slotStub('c')); door.attachExpressionsSlot('ex-d', slotStub('d'))
  door.setExpressionsPanePresented('ex-c', true); door.setExpressionsPanePresented('ex-d', true); door.preferExpressionsPane('ex-d')
  assert.equal(door.framePlacement()?.paneId, 'ex-d')
  door.setExpressionsPanePresented('ex-d', false)
  assert.equal(door.framePlacement()?.paneId, 'ex-c', 'a concealed pane releases the frame; the presented one takes it')
  door.setExpressionsPanePresented('ex-c', false)
  assert.equal(door.framePlacement(), null, 'nothing presented: the frame returns to its own place')
  door.unregisterExpressionsPane('ex-c'); door.unregisterExpressionsPane('ex-d')
})

test('closing a pane releases exactly its claim: the other pane takes the frame, the others keep theirs', () => {
  door.registerExpressionsPane('ex-e'); door.registerExpressionsPane('ex-f')
  door.attachExpressionsSlot('ex-e', slotStub('e')); door.attachExpressionsSlot('ex-f', slotStub('f'))
  door.setExpressionsPanePresented('ex-e', true); door.setExpressionsPanePresented('ex-f', true); door.preferExpressionsPane('ex-f')
  door.unregisterExpressionsPane('ex-e')
  assert.equal(door.framePlacement()?.paneId, 'ex-f', 'closing the other pane does not move the frame off this one')
  door.unregisterExpressionsPane('ex-f')
  assert.equal(door.framePlacement(), null, 'closing the last holder releases the frame')
})

test('the placement hook identity is stable while nothing changes: the centre follows the claim, not every render', () => {
  door.registerExpressionsPane('ex-g')
  door.attachExpressionsSlot('ex-g', slotStub('g'))
  door.setExpressionsPanePresented('ex-g', true)
  const first = door.framePlacement()
  door.setExpressionsPanePresented('ex-g', true)
  door.attachExpressionsSlot('ex-g', first.slot)
  assert.equal(door.framePlacement(), first, 'a settle with no change keeps the same placement object')
  door.unregisterExpressionsPane('ex-g')
})

test('the pane header shows the frame\'s reading by value, Show in the centre, and the honest states', () => {
  door.publishHostedExpressions(null)
  assert.match(html(createElement(pane.ExpressionsPaneBody, {paneId: 'ex-h'})), /has not reported its state yet/)
  door.publishHostedExpressions({expression_ref: 'expression:one', title: 'Return of Zero'})
  const body = html(createElement(pane.ExpressionsPaneBody, {paneId: 'ex-h'}))
  assert.match(body, /data-hosted-expression="expression:one"/)
  assert.match(body, /Return of Zero · expression:one/, 'the header is the held expression\'s title and ref')
  assert.match(body, /Show in the centre/)
  assert.match(body, /data-frame-slot="free"/, 'the placeholder slot is present and free while no pane holds the frame')
  door.publishHostedExpressions({expression_ref: null, title: null})
  assert.match(html(createElement(pane.ExpressionsPaneBody, {paneId: 'ex-h'})), /no native Expression open/)
  door.publishHostedExpressions(null)
})

test('a pane that does not hold the frame says so and offers to move it here; the holder shows its slot as held', () => {
  door.registerExpressionsPane('ex-i'); door.registerExpressionsPane('ex-j')
  door.attachExpressionsSlot('ex-i', slotStub('i')); door.attachExpressionsSlot('ex-j', slotStub('j'))
  door.setExpressionsPanePresented('ex-i', true); door.setExpressionsPanePresented('ex-j', true)
  const holder = html(createElement(pane.ExpressionsPaneBody, {paneId: 'ex-i'}))
  const other = html(createElement(pane.ExpressionsPaneBody, {paneId: 'ex-j'}))
  assert.match(holder, /data-frame-here="true"/)
  assert.match(holder, /data-frame-slot="held"/)
  assert.doesNotMatch(holder, /Show here/, 'the holder offers no move')
  assert.match(other, /data-frame-here="false"/)
  assert.match(other, /Presented in the other Expressions pane\./)
  assert.match(other, /Show here/, 'the other pane offers the control that moves the frame there')
  door.unregisterExpressionsPane('ex-i'); door.unregisterExpressionsPane('ex-j')
})

test('the placement follows the slot rectangle and releases exactly what it set: the frame model keeps its identity, parent and src', () => {
  const model = frameModel()
  const before = {frame: model.frame, parent: model.frame.parentNode, iframe: model.frame.children[0], src: model.iframe.src}
  frame.placeFrame(model.frame, RECT)
  assert.equal(model.frame.style.position, 'fixed')
  assert.equal(model.frame.style.left, '40px'); assert.equal(model.frame.style.top, '60px')
  assert.equal(model.frame.style.width, '500px'); assert.equal(model.frame.style.height, '300px')
  assert.equal(model.frame.style.pointerEvents, 'auto', 'the placed frame is interactive')
  assert.equal(model.frame.style.zIndex, frame.PLACED_Z_INDEX)
  frame.placeFrame(model.frame, {left: 10, top: 20, width: 100, height: 80})
  assert.equal(model.frame.style.left, '10px', 'a move re-places the same container')
  frame.releaseFrame(model.frame)
  for (const key of frame.PLACED_STYLE_KEYS) assert.equal(model.frame.style[key], '', `release clears ${key}`)
  assert.equal(model.frame.parentNode, before.parent, 'the container is never re-parented')
  assert.equal(model.frame.children[0], before.iframe, 'the iframe element is the same object')
  assert.equal(model.iframe.src, before.src, 'the iframe src is unchanged throughout')
  assert.equal(model.frame, before.frame)
})

test('a slot clipped away entirely hides the container (display none, the iframe stays alive) and reappears when the slot is back', () => {
  const model = frameModel()
  frame.placeFrame(model.frame, null)
  assert.equal(model.frame.style.display, 'none', 'clipped away: the frame is concealed, not unmounted')
  assert.equal(model.frame.children[0], model.iframe)
  frame.placeFrame(model.frame, RECT)
  assert.equal(model.frame.style.display, 'block')
})

test('visible slot geometry clips the slot by every scrolling ancestor and by the viewport', () => {
  const view = {innerWidth: 1000, innerHeight: 800}
  const boxes = new Map()
  const el = (name, rect, overflow, parentElement) => {
    const node = {name, parentElement, getBoundingClientRect: () => rect}
    boxes.set(node, overflow)
    return node
  }
  const scroller = el('scroller', {left: 0, top: 100, width: 600, height: 200}, 'hidden', null)
  const slot = el('slot', {left: 100, top: 150, width: 500, height: 300}, 'visible', scroller)
  view.getComputedStyle = node => ({overflowX: boxes.get(node) ?? 'visible', overflowY: boxes.get(node) ?? 'visible'})
  assert.deepEqual(frame.visibleSlotRect(slot, view), {left: 100, top: 150, width: 500, height: 150}, 'clipped by the scroller bottom at 300')
  const offscreen = el('off', {left: 0, top: 900, width: 50, height: 50}, 'visible', null)
  assert.equal(frame.visibleSlotRect(offscreen, view), null, 'a slot below the viewport is not visible')
})

test('the rectangle helpers intersect and compare exactly', () => {
  assert.deepEqual(frame.intersectRect({left: 0, top: 0, width: 10, height: 10}, {left: 5, top: 5, width: 10, height: 10}), {left: 5, top: 5, width: 5, height: 5})
  assert.equal(frame.intersectRect({left: 0, top: 0, width: 10, height: 10}, {left: 10, top: 0, width: 5, height: 5}), null, 'touching edges do not overlap')
  assert.equal(frame.sameRect(RECT, {...RECT}), true)
  assert.equal(frame.sameRect(RECT, {...RECT, width: 501}), false)
})

test('the Expressions pane kind is admitted through the projection door, once, under its own module id', () => {
  pane.registerExpressionsPaneHost()
  pane.registerExpressionsPaneHost()
  const admitted = projectionModule('projection.expressions')
  assert.equal(admitted?.id, pane.EXPRESSIONS_MODULE_ID)
  assert.equal(admitted?.kind, 'projection.expressions')
})

test('the pane module and the frame placement hold no frame, owner, lease or re-parenting call (source reading)', async () => {
  const sources = [await code('../src/projections/expressionsPane.tsx'), await code('../src/projections/expressionsPaneHost.ts'), await code('../src/projections/framePlacement.ts')]
  for (const text of sources) {
    assert.doesNotMatch(text, /expressions-boundary\/src|mountExpressionsApplication|ExpressionsHost|createCradleOwners|createNativeTechneNavigator/)
    assert.doesNotMatch(text, /openExpression|stageCommand|kernel-expression|lease\s*:/)
    assert.doesNotMatch(text, /createElement\('iframe'\)|appendChild|insertBefore|removeChild|replaceChild|\.remove\(\)|\.src\s*=/, 'no structural change, no iframe creation, no src write')
    assert.doesNotMatch(text, /from '\.\.\/panels\//, 'the pane never imports the centre panel that owns the frame')
  }
  assert.match(sources[0], /unmount: \(\) => \{\s*unregisterExpressionsPane\(paneId\)\s*root\.unmount\(\)/, 'closing the pane releases its claim and unmounts only its own root')
})

test('the centre frame keeps its mount and its container element; the placement moves only the container\'s style (source reading)', async () => {
  const panel = await code('../src/panels/expressions.tsx')
  assert.match(panel, /\}, \[qualified, attempt\]\)/, 'the frame\'s mount effect keeps its dependencies: presenting the frame in a pane never re-mounts it')
  assert.match(panel, /<div ref=\{container\} className="expressions-application" \/>/, 'the container element is the one the frame lives in')
  assert.match(panel, /useEffect\(\(\) => \{\s*const frame = container\.current\s*if \(!frame \|\| !placement\) return\s*return followFrame\(frame, placement\.slot\)\s*\}, \[placement\]\)/)
  assert.match(panel, /\{!placement && <>/, 'the centre chrome (toolbar, faults, reopen) moves to the pane while a pane holds the frame')
  assert.match(panel, /publishHostedChrome\(\{state: stage, run: host\.current \? stageRun : null/)
  assert.match(panel, /publishHostedExpressions\(\{expression_ref: state\.nativeScene\?\.expression_ref \?\? null, title: state\.document\?\.name \?\? null\}\)/)
  assert.match(panel, /registerExpressionsPaneHost\(\)\n/)
  assert.doesNotMatch(panel.slice(panel.indexOf('onStatus: (value, reason)'), panel.indexOf('onHostRequest:')), /publishHostedExpressions|publishHostedChrome/, 'the status callback stays exactly as the lifetime test reads it')
})

test('centre residence: the Expressions panel stays mounted (hidden, never unmounted), and the centre is the Workbench in every mode (F2; source reading)', async () => {
  const app = await source('../src/App.tsx')
  assert.match(app, /\{panels\.map\(panel => \{ const Panel = panel\.component; const placed = expressionsPlaced && panel\.id === 'world\.expressions'; return <div/, 'every centre panel is rendered; only its wrapper\'s hidden attribute changes')
  assert.match(app, /<Panel \{\.\.\.ctx\} \/>/)
  assert.match(app, /const workbenchCentre = \(_panel: string \| undefined\): string => 'native\.workbench'/, 'the panes are the centre in every mode (F2): the Expressions panel is concealed, not unmounted')
})

test('the Expressions residence is placed while a pane holds the frame, and is otherwise exactly as it was', async () => {
  const app = await source('../src/App.tsx')
  assert.match(app, /const framePlacement = useFramePlacement\(\)\n[\s\S]{0,400}const expressionsPlaced = framePlacement !== null && centerPanel !== 'world\.expressions'/, 'a pane holds the frame in any mode (F2)')
  assert.match(app, /style=\{placed \? PLACED_RESIDENCE_STYLE : undefined\} hidden=\{placed \? false : panel\.id === 'world\.settings'/)
  const style = await source('../src/projections/expressionsPaneHost.ts')
  assert.match(style, /export const PLACED_RESIDENCE_STYLE: CSSProperties = \{position: 'fixed', left: 0, top: 0, width: 0, height: 0, overflow: 'visible', pointerEvents: 'none'\}/, 'the residence is zero-size and out of flow: the container, not the residence, is the one placed')
})

test('the Factory Expressions entry is enabled with its real behaviour, and the bar of every other mode keeps its six lenses', () => {
  assert.equal(factoryLensReason(FACTORY_EXPRESSIONS_LENS), null, 'the entry carries no disabled reason: its pane is admitted')
  assert.equal(factoryLensPane(FACTORY_EXPRESSIONS_LENS), 'projection.expressions')
  assert.equal(LENSES.length, 6, 'the World cut lens bar is unchanged')
  assert.equal(LENSES.some(lens => lens.id === 'expressions'), false, 'the Expressions entry is a Factory-bar entry only')
})

test('a focused Expressions pane brings the hosted lens\'s instrument into the chain (manual §3); the focus names it', () => {
  const focus = factoryFocusedPane('projection.expressions')
  assert.deepEqual(focus, {pane: 'projection.expressions', presentation: null})
  const instrument = instrumentOfPane('projection.expressions', null, 'graph', 'timeline')
  assert.ok(instrument, 'the instrument in the focused pane brings its own controls into the chain')
  assert.deepEqual(deviceInstrumentFor('factory', 'projection.expressions', null, 'graph', 'timeline'), instrument, 'in every mode the same')
})

test('the Factory centre helper admits the Expressions pane kind on the one engine door, and App keeps the established call', async () => {
  const centre = await source('../src/agent/factoryCentre.ts')
  assert.match(centre, /kind: 'projection\.earth' \| 'projection\.constellation' \| 'projection\.timeline' \| 'projection\.expressions'\)/)
  const app = await source('../src/App.tsx')
  assert.match(app, /openInstrument\('projection\.expressions'\)/, 'App opens the pane through the one instrument door (F2)')
  assert.doesNotMatch(app, /openProjectionPane/, 'App no longer branches around the widened helper')
  assert.match(app, /registerTimelineHost\(\)/, 'the Timeline door is untouched')
})
