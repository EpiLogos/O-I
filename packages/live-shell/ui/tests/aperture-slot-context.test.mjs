import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'

// The browser's lower panel is the focused pane's own context (world-shell-mockup.html `renderSlot`, "the aperture slot — the
// focused pane's own context"; manual §10.2 "A pane follows what you select, unless you pin it"; §10.3 "The pool under the
// browser shows the selected device in full").
// Channels: SCRIPTED — the context rows and the pin standing as pure functions of fixture readings; the Workbench's door (publish,
// dedupe, the pin action handed back); the slot drawn headless (SSR over the production component) for each pane kind the View
// table registers, with the readings published through their own doors. CODE-READING — the Workbench's publish effect, the
// frame's mode-blindness, the category words moved to the rows' Info. NOT a screen pass: the panel at the mockup's floor and the
// pin pressed on screen are owed the lead's computer-use pass.
// Loader as f6-browser.test.mjs.
const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};
import {readFile} from 'node:fs/promises';
export async function resolve(specifier,context,next){
  try{return await next(specifier,context)}catch(error){
    if(!specifier.startsWith('.'))throw error;
    if(specifier.endsWith('.js')){try{return await next(specifier.slice(0,-3)+'.ts',context)}catch{}}
    for(const suffix of ['.ts','.tsx','/index.ts','/index.tsx']){try{return await next(specifier+suffix,context)}catch{}}
    throw error;
  }
}
export async function load(url,context,next){
  if(url.endsWith('.css'))return {format:'module',shortCircuit:true,source:'export default null'};
  if(['.html','.svg','.png','.md'].some(ext=>url.split('?')[0].endsWith(ext))||url.endsWith('?raw'))return {format:'module',shortCircuit:true,source:'export default ""'};
  if(url.endsWith('.json'))return {format:'module',shortCircuit:true,source:'export default '+await readFile(new URL(url),'utf8')};
  if(url.endsWith('.ts')||url.endsWith('.tsx')){
    const source=await readFile(new URL(url).pathname,'utf8');
    const {outputText}=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX},fileName:url});
    return {format:'module',shortCircuit:true,source:outputText};
  }
  return next(url,context);
}`)}`, {parentURL: import.meta.url})

const noop = () => {}
globalThis.document = {getElementById: () => null, createElement: () => ({style: {}, setAttribute: noop, appendChild: noop}), head: {appendChild: noop}, addEventListener: noop, removeEventListener: noop, querySelector: () => null, documentElement: {style: {}}}
globalThis.window ??= globalThis; globalThis.addEventListener ??= noop; globalThis.removeEventListener ??= noop
globalThis.localStorage = {getItem: () => null, setItem: () => {}}
const React = await import('react')
const {renderToStaticMarkup} = await import('react-dom/server')
const {readFile} = await import('node:fs/promises')
const views = await import('../src/frame/browser/apertureViews.tsx')
const door = await import('../src/native/workbenchDoor.ts')
const documents = await import('../src/central/documents/documentDoor.ts')
const devices = await import('../src/frame/devices/deviceDoor.ts')
const {ShellConfigContext} = await import('../src/shell/useSet.ts')
const {Workspace} = await import('../src/shell/workspaceContext.tsx')
const {Browser} = await import('../src/frame/browser/Browser.tsx')
const {modeBrowserCategories} = await import('../src/shell/ModeBrowser.tsx')
const source = path => readFile(new URL(`../src/${path}`, import.meta.url), 'utf8')
const h = React.createElement

const CONFIG = {default_set: '', world_scope: {owner: 'central', world: 'control:root', personal_ground: '/ground', workcell_ref: 'workcell:mac'}}
const pane = (over = {}) => ({id: 'b1', kind: 'projection.timeline', title: 'Timeline', index: 1, count: 2, follows: true, pin: () => {}, ...over})
const slot = ({config = CONFIG, reading = null} = {}) => renderToStaticMarkup(h(ShellConfigContext.Provider, {value: config},
  h(Workspace.Provider, {value: {reading}}, h(views.ApertureSlot))))
const value = (rows, key) => rows.find(row => row.key === key)

// ── the context rows ─────────────────────────────────────────────────────

test('with no reading, every context row says "—" and says why — never a fixed sentence', () => {
  const rows = views.contextRows({pane: null, context: null, config: null, spine: null})
  assert.deepEqual(rows.map(row => row.key), ['field', 'world', 'subject', 'occasion'], 'the mockup\'s four rows, in its order')
  for (const row of rows) {
    assert.equal(row.value, '—', `${row.key} waits`)
    assert.ok(row.info.length > 20, `${row.key} says why it waits`)
  }
  const all = JSON.stringify(rows)
  assert.doesNotMatch(all, /the day's Now"|the encounter's field|not selected"/, 'the old fixed strings are gone')
})

test('the rows read the World, THE selection and the civil Now from their owners', () => {
  const instant = Date.UTC(2026, 9, 8, 13, 37)
  const spine = {now: () => ({instantUnixMs: instant, dayRef: 'central:day:control:root:2026-10-08', source: 'kernel temporal read'}), occasion: () => null}
  const context = {world: 'central', selection: {mode: 'base', kind: 'day', ref: 'Control/agents/now/day/2026-10-08.md', title: '2026-10-08.md'}}
  const rows = views.contextRows({pane: null, context, config: CONFIG, spine})
  assert.equal(value(rows, 'world').value, 'Central'); assert.equal(value(rows, 'world').dot, 'var(--accent)', 'Central wears the accent (the mockup\'s #ffbe00)')
  assert.match(value(rows, 'world').info, /control:root/, 'the World\'s ref is named in the hover')
  assert.equal(value(rows, 'subject').value, '2026-10-08.md'); assert.equal(value(rows, 'subject').mark, 'day', 'the cut\'s day mark')
  assert.equal(value(rows, 'occasion').value, `now · ${views.clockOf(instant)}`, 'the mockup\'s "now · 14:37", from the spine\'s own instant')
  assert.match(views.clockOf(instant), /^\d\d:\d\d$/, 'a 24-hour clock, as the transport writes it')
  assert.match(value(rows, 'occasion').info, /08 Oct/, 'the civil day is named')
  assert.equal(value(rows, 'field').value, '—', 'no hosted presentation names a field')
})

test('a selected occasion stands over the Now, with its admission as its standing; a hosted pane names its field and world', () => {
  const occasion = {basis: {ref: 'event:1', instantUnixMs: null, summary: 'the stone carved', evidenceRefs: [], retainedAtUnixMs: 1, civilDayRef: 'central:day:control:root:1950-01-01'},
    admission: {admitted: false, qualifiedAtUnixMs: 2, disclosure: 'absent from the latest read'}}
  const rows = views.contextRows({pane: {fieldRef: 'field:jung-circle', worldRef: 'world:human:ariadne'}, context: {world: 'central'}, config: CONFIG,
    spine: {now: () => ({instantUnixMs: 1, dayRef: null, source: 's'}), occasion: () => occasion}})
  assert.equal(value(rows, 'occasion').value, 'the stone carved · 01 Jan')
  assert.equal(value(rows, 'occasion').standing, 'not admitted now', 'the admission is a separate qualification, shown as the standing')
  assert.equal(value(rows, 'field').value, 'field:jung-circle'); assert.equal(value(rows, 'field').dot, 'var(--sel)')
  assert.equal(value(rows, 'world').value, 'world:human:ariadne · projection', 'another World, projected')
  const book = views.contextRows({pane: null, context: {reading: {ref: 'occasion:x', position: 'p3'}}, config: null, spine: null})
  assert.equal(value(book, 'occasion').value, 'occasion:x · p3', 'with no World cut, the book\'s selected occasion')
})

// ── the pin ──────────────────────────────────────────────────────────────

test('the pin reads follows | pinned and moves only a pane whose kind follows the selection', () => {
  const selection = {ref: 'clip:1', title: 'the stone'}
  assert.deepEqual(views.pinStanding({follows: true}, selection).next, {ref: 'clip:1'}, 'a following pane pins to THE selection')
  assert.equal(views.pinStanding({follows: true}, null).next, null, 'nothing selected: nothing to pin to')
  assert.equal(views.pinStanding({follows: true}, null).words, 'follows')
  const pinned = views.pinStanding({follows: true, pinned: 'clip:1'}, selection)
  assert.equal(pinned.words, 'pinned'); assert.deepEqual(pinned.next, {ref: undefined}, 'a pinned pane follows again')
  const document = views.pinStanding({follows: false, pinned: 'document:today'}, selection)
  assert.equal(document.words, 'pinned'); assert.equal(document.next, null, 'a document holds its own subject: unpinning would swap the document')
  assert.equal(views.pinStanding({follows: false}, selection).words, 'holds', 'a pane that neither follows nor pins says so')
})

test('the Workbench publishes the focused pane once per change, and the pin goes back through its own door', () => {
  const asked = []
  door.publishFocusedPane(pane({pin: ref => asked.push(ref)}))
  const first = door.focusedPaneReading()
  door.publishFocusedPane(pane({pin: () => asked.push('other render')}))
  assert.equal(door.focusedPaneReading(), first, 'the same reading from another render is no change')
  first.pin('clip:1')
  assert.deepEqual(asked, ['clip:1'])
  door.publishFocusedPane(pane({pinned: 'clip:1'}))
  assert.equal(door.focusedPaneReading().pinned, 'clip:1', 'a pin is a change')
  door.publishFocusedPane(null)
  assert.equal(door.focusedPaneReading(), null)
})

test('the Workbench\'s one publish effect reads the presented tree and pins through surface.pin-subject (code-reading)', async () => {
  const bench = await source('native/Workbench.tsx')
  const effect = bench.slice(bench.indexOf('// The browser\'s aperture slot reads the focused pane'), bench.indexOf('// The pane tree is the centre in every mode'))
  assert.match(effect, /publishFocusedPane\(presented && id && binding && index >= 0 \?/, 'published while presented, null otherwise')
  assert.match(effect, /pinned: binding\.projection\?\.subject_ref, follows: !!binding\.projection && followsSelection\(binding\.projection\.kind\)/, 'the pin and the follow rule are the pane\'s own')
  assert.match(effect, /pin: ref => callbacks\.current\.execute\('surface\.pin-subject', \{surfaceId: id, ref\}\)/, 'the same action the pane\'s Follow/Pin button runs')
  assert.match(effect, /return \(\) => publishFocusedPane\(null\)/, 'withdrawn when the tree goes')
  assert.equal((effect.match(/useEffect\(/g) ?? []).length, 1, 'one effect')
})

// ── the slot, drawn ──────────────────────────────────────────────────────

test('the head reads the focused pane: its mark, its tab, pane i/N and its pin; with no pane it says so', () => {
  door.publishFocusedPane(null)
  const none = slot()
  assert.match(none, /No pane in focus/); assert.doesNotMatch(none, /pane \d\/\d/)
  door.publishFocusedPane(pane({kind: 'projection.earth', title: 'Earth', index: 1, count: 1}))
  const out = slot()
  assert.match(out, /aperture-head/); assert.match(out, /<b>Earth<\/b>/)
  assert.match(out, /pane 1\/1/)
  assert.match(out, /data-pin="follows"[^>]*disabled/, 'nothing selected: the pin waits')
  assert.match(out, /<span>Context<\/span><span>following the encounter<\/span>/)
  door.publishFocusedPane(null)
})

test('a Central document\'s View: the reached document\'s form, file, short revision and standing, its Save and Re-read', () => {
  documents.publishDocument({key: 'day:k', form: 'Day', title: '2026-10-08', revision: 'central.content-fnv1a64/v1:812:9f3a6c2e11d04b77', state: 'edited since save', save: noop, reread: noop, rereadLabel: 'Review the native source'}, true)
  door.publishFocusedPane(pane({kind: 'projection.central-document', title: 'Day', pinned: 'document:today', follows: false}))
  const out = slot()
  assert.match(out, /<span>View<\/span><span>aperture<\/span>/, 'the mockup\'s words')
  assert.match(out, /Form<\/span><span class="v">Day</)
  assert.match(out, /2026-10-08/)
  assert.match(out, /r9f3a6c2e · <span style="color:var\(--stall\)">edited since save<\/span>/, 'revisionShort: the digest\'s first eight, never "rcentral."')
  assert.doesNotMatch(out, /rcentral/)
  assert.match(out, /data-action="save"/); assert.match(out, /Review the native source/)
  assert.match(out, /data-pin="pinned"[^>]*disabled/, 'the document holds its own subject')
  // A Flow pane does not borrow the Day the hand reached.
  door.publishFocusedPane(pane({kind: 'projection.central-document', title: 'Flow', pinned: 'document:latest-flow', follows: false}))
  const flow = slot()
  assert.match(flow, /Form<\/span><span class="v">Flow</); assert.doesNotMatch(flow, /r9f3a6c2e/)
  documents.withdrawDocument('day:k'); door.publishFocusedPane(null)
})

test('the View rows come from the table by pane kind; a kind with nothing to read has no View', () => {
  assert.deepEqual(Object.keys(views.APERTURE_VIEWS).sort(), ['agent-shell', 'encounter', 'projection.central-document', 'projection.constellation', 'projection.earth', 'projection.expressions', 'projection.timeline'].sort())
  door.publishFocusedPane(pane())
  assert.match(slot(), /Presentation<\/span><div class="aperture-seg"[^>]*><button type="button" aria-pressed="true">Session<\/button><button type="button" aria-pressed="false">Arrangement/, 'the tracks pane\'s own presentation')
  door.publishFocusedPane(pane({kind: 'projection.earth'}))
  assert.match(slot(), />Earth<\/button><button type="button" aria-pressed="false">Graph</, 'the atlas\'s view')
  door.publishFocusedPane(pane({kind: 'encounter', title: 'Fizz · lead', ref: 'session:fizz', follows: false}))
  const thread = slot()
  assert.match(thread, /Session<\/span><span class="v">Fizz · lead</); assert.match(thread, /workcell:mac/, 'the Workcell the host discloses')
  door.publishFocusedPane(pane({kind: 'agent-shell', title: 'Agents', follows: false}))
  assert.match(slot({config: null}), /Session<\/span><span class="v">—<\/span>.*Workcell<\/span><span class="v"><span class="mono">—/s, 'no session selected, no Workcell disclosed: "—"')
  door.publishFocusedPane(pane({kind: 'projection.expressions', title: 'Expressions', follows: false}))
  const expression = slot({reading: {sceneName: 'the stone', sceneState: 'Edited since save', nativeScene: {expression_ref: 'e', revision: 4, scene_ref: 's1'}}})
  assert.match(expression, /Scene<\/span><span class="v">the stone</); assert.match(expression, /color:var\(--stall\)">Edited since save/)
  door.publishFocusedPane(pane({kind: 'file', title: 'notes.md', follows: false}))
  const file = slot()
  assert.match(file, /<span>Context<\/span>/); assert.doesNotMatch(file, /<span>View<\/span>/, 'a file pane has no View section')
  door.publishFocusedPane(null)
})

test('a device chosen on a chain takes the panel; the head stays and brings the context back', () => {
  door.publishFocusedPane(pane())
  devices.publishDevice('dev:1', {device: {id: 'dev:1'}})
  devices.selectDevice('dev:1')
  const held = slot()
  assert.doesNotMatch(held, /aperture-body/, 'the device stands in the panel, not the context')
  assert.match(held, /data-aperture-return/); assert.match(held, /pane 1\/2/)
  devices.selectDevice(null)
  assert.match(slot(), /aperture-body/)
  devices.selectDevice('gone')
  assert.match(slot(), /aperture-body/, 'a chosen device that is no longer on any chain leaves the context standing')
  devices.selectDevice(null); devices.publishDevice('dev:1', null); door.publishFocusedPane(null)
})

// ── the one browser ──────────────────────────────────────────────────────

test('the slot heads the one browser\'s pool in every mode, above the bodies\' pool content and the device pool', async () => {
  const Body = () => h('p', null, 'rows')
  const markup = renderToStaticMarkup(h(Browser, {sources: [{id: 'a', categories: [{id: 'one', label: 'One', kind: 'material', hint: 'the hint', info: 'the words'}], Body}]}))
  const pool = markup.slice(markup.indexOf('aria-label="Pool"'))
  assert.ok(pool.indexOf('aria-label="Aperture"') < pool.indexOf('one-browser-pool-host') && pool.indexOf('one-browser-pool-host') < pool.indexOf('data-device-pool'), 'slot, then the bodies\' pool, then the device')
  assert.match(markup, /data-i="One\|the words"/, 'a category\'s words are its row\'s Info')
  for (const file of ['frame/browser/apertureViews.tsx', 'frame/browser/Browser.tsx']) {
    assert.doesNotMatch(await source(file), /'(live|base|factory|expressions|techne|audio)'/, `${file} names no mode`)
  }
})

test('the category\'s prose left the panel and became its row\'s Info words, nothing lost', async () => {
  const base = modeBrowserCategories('base')
  assert.match(base.find(c => c.id === 'central-days').info, /Double-click or Enter opens the Day itself in the focused pane/)
  assert.match(base.find(c => c.id === 'central-files').info, /a Flow as its Flow, any other file as its own tab/)
  const techne = modeBrowserCategories('techne')
  assert.match(techne.find(c => c.id === 'techne-sources').info, /opens in its instrument over the current encounter/)
  assert.match(techne.find(c => c.id === 'techne-bodies').info, /The World groups wait for their owners.*Declared, waiting/)
  const browser = await source('shell/ModeBrowser.tsx')
  assert.doesNotMatch(browser, /function ApertureSlot|function CategoryContext|createPortal/, 'the rows portal nothing into the pool')
})
