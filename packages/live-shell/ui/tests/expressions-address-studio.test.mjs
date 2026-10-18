import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {register} from 'node:module'
import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'

// Ticket P, G3 (lane-3 E22): the frame's address — work, Scene, time, marker — is carried by the shell. The frame announces it with
// its state (app.ts hostAddress, read in the boundary with the frame's own deep-link grammar); the shell keeps it beside the open
// work in the workspace book's engine checkpoint (surface/types.ts, layout-codec.mjs), reopens the frame at it in the frame's own
// query, and the Studio's head says it in words and copies it whole. And the Studio's columns fit the detail row by the plate's fold,
// so Capture — where an export's landing is said — stands in view. Production modules in memory (the loader of
// expressions-studio-plate.test.mjs); the hosted state is a fixture published through the pane host door, not a native frame.
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
const [WS, Detail, Model, Fit, Plate, Door, Codec] = await Promise.all([
  import(src('shell/workspaceContext.tsx')),
  import(src('components/NativeWorldDetail.tsx')),
  import(src('components/expressions/studio/studioModel.ts')),
  import(src('components/expressions/studio/studioFit.ts')),
  import(src('frame/devices/InstrumentPlate.tsx')),
  import(src('projections/expressionsPaneHost.ts')),
  import(new URL('../../../../desktop/cradle/src/surface/layout-codec.mjs', import.meta.url).href),
])
const repo = path => readFile(new URL(`../../../../${path}`, import.meta.url), 'utf8')
const functionBody = (text, name) => {
  const start = text.indexOf(`function ${name}(`)
  assert.ok(start >= 0, `${name} is found`)
  return text.slice(start, text.indexOf('\n}\n', start) + 2)
}

const READY = {hostMode: 'expressions', sceneCount: 2, sceneName: 'the stone', document: {id: 'expression:kept', name: 'Kept work'},
  nativeScene: {expression_ref: 'expression:kept', revision: 3, scene_ref: 'scene:one'}}
const studio = () => renderToStaticMarkup(createElement(WS.Workspace.Provider, {value: {workspaceId: 'address-fixture', accessEpoch: 1, accessReady: true,
  nativeAccessCurrent: () => true, mode: 'expressions', editor: null, editorReading: null, transport: {kind: 'unavailable', reason: 'a fixture'}}},
  createElement(Detail.NativeWorldDetail, {mode: 'device', expand: noop, collapse: noop, presentMode: noop})))

test('the address in words: the Scene\'s name, the time, the marker\'s name — only as the frame announces it', () => {
  assert.equal(Model.studioPlace({...READY, address: {scene: 'scene:one', t: 12.346, marker: 'm1', markerName: 'Arrival'}}), '“the stone” at 0:12.3 · marker “Arrival”')
  assert.equal(Model.studioPlace({...READY, address: {scene: 'scene:one'}}), '“the stone”', 'while the transport plays, the Scene alone')
  assert.equal(Model.studioPlace({...READY, sceneName: '', address: {scene: 'scene:one', t: 75}}), 'the Scene at 1:15')
  assert.equal(Model.studioPlace({...READY, address: {scene: 'scene:one', t: 0, marker: 'm1'}}), '“the stone” at 0:00 · marker “m1”', 'a marker with no name reads by its ref')
  assert.equal(Model.studioPlace(READY), null, 'no announced address, no words')
  assert.equal(Model.studioPlace(null), null)
  assert.equal(Model.addressClock(3600.5), '60:00.5')
  assert.equal(Model.studioOwner(null, '“the stone” at 0:12.3'), 'Expressions engine · “the stone” at 0:12.3')
  assert.equal(Model.studioOwner(null), 'Expressions engine · no work is open')
})

test('the Studio\'s head says where the work stands and its link mark copies the whole address in the frame\'s own form', () => {
  Door.publishHostedChrome({state: {...READY, address: {scene: 'scene:one', t: 12.5, marker: 'm1', markerName: 'Arrival'}}, run: async () => ({ok: true}), faults: []})
  const html = studio()
  // R4: the plate beside the Studio is the Stage; its head carries where the work stands (the Studio is its design, whose own corner says
  // the save state).
  assert.match(html, /<header class="dp-head dp-head--plate" data-i="Stage\|Expressions engine · “the stone” at 0:12\.5 · marker “Arrival”">/, 'where the work stands: the head\'s status-bar words (lane BT: the kit\'s head)')
  // R4: the link mark stands in the Studio's head (its place's own marks, ExpressionsStudio.tsx Mark).
  assert.match(html, /data-studio-mark="link" aria-label="Copy address: \?expression=expression%3Akept&amp;scene=scene%3Aone&amp;t=12\.5&amp;marker=m1"/)
  Door.publishHostedChrome({state: READY, run: async () => ({ok: true}), faults: []})
  const quiet = studio()
  assert.doesNotMatch(quiet, /data-studio-mark="link"/, 'no announced address, nothing to copy')
  assert.match(quiet, /Expressions engine · no work is open/)
  Door.publishHostedChrome(null)
})

test('the chains fold from the last back toward Material; the person\'s choice holds (REPLACED: the eight columns, Capture never folding — R4)', () => {
  const columns = ['studio:material', 'studio:motion', 'studio:body', 'studio:nara']
  const widths = new Map([[columns[0], 176], [columns[1], 176], [columns[2], 296], [columns[3], 176]])
  const none = new Set()
  const fit = (over = {}) => [...Fit.foldsToFit({columns, widths, strip: 26, available: 600, folded: none, opened: none, ...over})]
  assert.deepEqual(fit(), ['studio:nara', 'studio:body'])
  assert.deepEqual(fit({available: 2000}), [], 'a row wide enough folds nothing')
  assert.deepEqual(fit({opened: new Set(['studio:body'])}), ['studio:nara', 'studio:motion'], 'a column the person opened stays open; the next ones fold')
  assert.deepEqual(fit({folded: new Set(['studio:material'])}), ['studio:material', 'studio:nara'])
  assert.deepEqual(fit({available: 0}), ['studio:nara', 'studio:body', 'studio:motion', 'studio:material'], 'every chain can fold')
  const pressed = Fit.pressFold('studio:body', true, {folded: new Set(), opened: new Set()})
  assert.deepEqual([[...pressed.folded], [...pressed.opened]], [[], ['studio:body']])
  const back = Fit.pressFold('studio:body', false, pressed)
  assert.deepEqual([[...back.folded], [...back.opened]], [['studio:body'], []])
})

test('a plate column folds to its title as the runtime\'s strip; an open column that can fold carries its title as the press', () => {
  const html = renderToStaticMarkup(createElement(Plate.InstrumentPlate, {presentation: {family: 'expressions', faceId: 'studio', title: 'Studio', icon: 'expr', owner: 'x'},
    sections: [{id: 'a', title: 'Motion', children: 'open body', onFold: noop}, {id: 'b', title: 'Body · 3:3', children: 'hidden body', folded: true, onFold: noop},
      {id: 'c', title: 'Capture', children: 'capture body'}]}))
  // Each press also says what it does on the status line (data-i, docs/dlw/DEVICE-UI.md §5.1 "Point at it").
  assert.match(html, /<h5 class="inst-section-head"><button type="button" class="inst-section-fold" aria-expanded="true" title="Fold to its title" aria-label="Fold Motion to its title" data-i="Motion\|Click the title to fold the section\.">Motion<\/button><\/h5>/)
  assert.match(html, /<section class="inst-section inst-section--folded" data-section="b" data-folded="true" aria-label="Body · 3:3"><button type="button" class="sdk-face__unfold" aria-expanded="false" aria-label="Open Body · 3:3" title="Body · 3:3 — open" data-i="Body · 3:3\|Folded to its title\. Click to open it\."><span class="sdk-face__fold-title">Body · 3:3<\/span><\/button><\/section>/)
  assert.doesNotMatch(html, /hidden body/, 'a folded column draws only its strip')
  assert.match(html, /<h5 class="inst-section-head"><span>Capture<\/span><\/h5>/, 'a column without a fold is drawn as before')
})

test('the shell keeps the address beside the open work, and the workspace book restores it well-typed or not at all', () => {
  const kept = Codec.validBinding({id: 'ws:expr', kind: 'expressions', title: 'Expressions',
    engine: {expressionRef: 'expression:kept', revision: '3', address: {scene: 'scene:one', t: 12.5, marker: 'm1', markerName: 'Arrival'}}})
  assert.deepEqual(kept.engine, {expressionRef: 'expression:kept', revision: '3', address: {scene: 'scene:one', t: 12.5, marker: 'm1'}}, 'refs only: the words are the frame\'s')
  const partial = Codec.validBinding({id: 'ws:expr', kind: 'expressions', title: 'E', engine: {expressionRef: 'e', address: {scene: 4, t: -1, marker: 'm1'}}})
  assert.deepEqual(partial.engine.address, {marker: 'm1'}, 'a malformed part drops, never guessed')
  const empty = Codec.validBinding({id: 'ws:expr', kind: 'expressions', title: 'E', engine: {expressionRef: 'e', address: {scene: ''}}})
  assert.equal('address' in empty.engine, false)
})

test('the panel writes one checkpoint shape from both writers and reopens the frame at the kept address', async () => {
  const panel = await repo('packages/live-shell/ui/src/panels/expressions.tsx')
  assert.match(functionBody(panel, 'engineCheckpoint'), /addressRefs\(state\.address\) \?\? \(held\?\.engine\?\.expressionRef === scene\.expression_ref \? held\.engine\.address : undefined\)/,
    'the frame\'s announced address, or — while it announces none — the one kept with this same work')
  assert.equal(panel.match(/engineCheckpoint\((?:state|reading), scene, (?:binding|held)\)/g)?.length, 2, 'both checkpoint writers write the one shape')
  assert.doesNotMatch(panel, /const engine = \{expressionRef:/, 'no writer builds the checkpoint by hand (and strips the address)')
  assert.match(panel, /const keptAddress = initialRef && keptEngine\?\.expressionRef === initialRef \? keptEngine\.address : undefined/)
  assert.match(panel, /mountExpressionsApplication\(target, entryAtAddress\(`\$\{config\.expressions_entry/, 'the frame opens at the kept address, in its own query')
  assert.doesNotMatch(panel, /localStorage/, 'no store of its own: the address rides the workspace book with the work')
})

test('the frame announces its address with its state, from the one place its link is written from', async () => {
  const app = await repo('desktop/cradle/expressions-app/field-studies-journeys/src/app.ts')
  const host = functionBody(app, 'hostAddress')
  // Only a native work has an address: nothing before the opening link has settled, and nothing while no native work stands (seen on
  // screen 15 Oct: with no work open the Studio's head named the frame's own scene, "1 · Origin" at 0:00).
  assert.match(host, /if\(deepLinkPending\|\|!nativeWorkspace\?\.nativeView\(\)\)return undefined;/, 'nothing before the opening link has settled, nor without a native work')
  assert.match(host, /const now=deepLinkAddressNow\(\);/)
  assert.match(host, /markerNamed\(store\.document\.markers\?\?\[\],now\.marker\)\?\.name/, 'the marker\'s name rides beside its ref')
  const sync = functionBody(app, 'syncDeepLinkAddress')
  assert.match(sync, /const address=deepLinkAddressNow\(\);/, 'the URL is written from the same address')
  assert.match(sync, /if\(announced!==announcedAddress\)\{announcedAddress=announced;announceHostState\(\);\}/, 'a changed address is announced, at the same throttled pace')
  assert.match(functionBody(app, 'announceHostState'), /const address=hostAddress\(\);announcedAddress=JSON\.stringify\(address\?\?null\);/)
})
