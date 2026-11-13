import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'

// The browser's aperture slot and the pane chrome at the mockup's floor (parity G5, G6, G7; world-shell-mockup.html .slot/.sloth/.sec/
// .ctx renderSlot, .bsearch, .split, .pmenu renderPmenu). Channels: SSR of the slot over its readings (the focused pane, the book's
// context, the host's World, the spine) and of the browser; the slot's Pin through the pane's own door; CODE-READING of the ⊞ menu's
// Close pane and the pane CSS. The pane tree's Close pane as an operation is desktop/cradle/tests/pane-grammar.test.mjs. NOT a screen
// pass: the look on screen is the lead's walk.
// Loader as browser-transport-craft.test.mjs.
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
const {ApertureSlotView, paneKindWord} = await import('../src/frame/encounter/ApertureSlot.tsx')
const {contextRows} = await import('../src/frame/encounter/encounterRows.ts')
const {Browser} = await import('../src/frame/browser/Browser.tsx')
const read = path => readFile(new URL(path, import.meta.url), 'utf8')

const CONFIG = {default_set: '', world_scope: {owner: 'central', world: 'control:root', personal_ground: '/ground', workcell_ref: 'workcell:mac'}}
const pane = (over = {}) => ({id: 't1', kind: 'projection.timeline', title: 'The day', index: 2, count: 3, follows: true, pin: noop, ...over})
const context = {world: 'central', selection: {mode: 'base', kind: 'day', ref: 'Control/agents/now/day/2026-10-08.md', title: '2026-10-08.md'}}
const spine = {now: () => ({instantUnixMs: Date.UTC(2026, 9, 8, 13, 37), dayRef: 'central:day:control:root:2026-10-08', source: 'kernel temporal read'}), occasion: () => null}
const slot = (props) => renderToStaticMarkup(React.createElement(ApertureSlotView, props))

test('the slot\'s head names the pane in front as the mockup\'s .sloth: its kind in the accent, its tab, pane i/N and follows', () => {
  const html = slot({pane: pane(), rows: contextRows({pane: pane(), context, config: CONFIG, spine}), selectionRef: context.selection.ref})
  assert.match(html, /^<section class="aperture-slot" aria-label="Aperture"><div class="aperture-slot-head"><span class="aperture-slot-kind">timeline<\/span><b>The day<\/b><span class="aperture-slot-r">pane 2\/3<button type="button" class="aperture-pin" aria-pressed="false"/)
  assert.match(html, />follows<\/button>/)
  assert.equal(paneKindWord('projection.central-document'), 'central document')
})

test('Context reads field, world, subject and occasion in the mockup\'s order, each row 62px key | value | standing', async () => {
  const html = slot({pane: pane(), rows: contextRows({pane: pane(), context, config: CONFIG, spine}), selectionRef: context.selection.ref})
  assert.match(html, /<div class="aperture-slot-sec"><span>Context<\/span><span>following the encounter<\/span><\/div>/)
  const keys = [...html.matchAll(/data-context="(\w+)"/g)].map(match => match[1])
  assert.deepEqual(keys, ['field', 'world', 'subject', 'occasion'])
  assert.match(html, /data-context="world"[^>]*><span class="k">world<\/span><span class="v"><span class="dot" style="background:var\(--accent\)"><\/span>Central<\/span>/)
  assert.match(html, /data-context="subject"[^>]*><span class="k">subject<\/span><span class="v"><svg[^]*?<b>2026-10-08\.md<\/b><\/span>/, 'the subject bold, after its kind mark')
  assert.match(html, /data-context="occasion"[^>]*><span class="k">occasion<\/span><span class="v">now · \d\d:\d\d<\/span>/)
  const css = await read('../src/frame/browser/browser.css')
  assert.match(css, /\.one-browser \.aperture-slot \{ flex: none; display: flex; flex-direction: column; border-top: 5px solid var\(--line\); background: var\(--bg-2\)/, 'the mockup\'s .slot rule and ground')
  assert.match(css, /\.one-browser \.aperture-slot-head \{ height: 22px;/, 'the .sloth head')
  assert.match(css, /\.one-browser \.aperture-ctx \{ display: grid; grid-template-columns: 62px minmax\(0, 1fr\) auto;/, 'the .ctx row')
})

test('Pin: a following pane pins to what is selected; a pinned one follows again; with nothing selected, Pin waits', () => {
  const pins = []
  const following = pane({pin: ref => pins.push(ref)})
  const tree = ApertureSlotView({pane: following, rows: [], selectionRef: 'note:a'})
  const find = (node) => { if (!node || typeof node !== 'object') return null; if (node.props?.className?.startsWith?.('aperture-pin')) return node
    for (const child of [].concat(node.props?.children ?? [])) { const hit = find(child); if (hit) return hit } return null }
  find(tree).props.onClick(); assert.deepEqual(pins, ['note:a'], 'pinned to the selection')
  const pinned = pane({pinned: 'note:a', pin: ref => pins.push(ref)})
  find(ApertureSlotView({pane: pinned, rows: [], selectionRef: 'note:b'})).props.onClick(); assert.deepEqual(pins, ['note:a', undefined], 'let follow again')
  assert.match(slot({pane: pinned, rows: [], selectionRef: null}), /class="aperture-pin on" aria-pressed="true"[^>]*>pinned</)
  assert.match(slot({pane: pane(), rows: [], selectionRef: null}), /class="aperture-pin" aria-pressed="false" disabled=""/, 'nothing selected: nothing to pin to')
  const own = slot({pane: pane({follows: false, pinned: 'day:1'}), rows: [], selectionRef: 'x'})
  assert.match(own, /class="aperture-pin own"[^>]*>own</, 'a pane holding its own subject has no Pin')
  assert.match(own, /<span>Context<\/span><span>its own subject<\/span>/, 'and its Context says so, not "pinned"')
})

test('with no pane in front the slot says so, and its rows still read the World and the Now', () => {
  const html = slot({pane: null, rows: contextRows({pane: null, context: null, config: CONFIG, spine}), selectionRef: null})
  assert.match(html, /<span class="aperture-slot-none">No pane in front<\/span>/)
  assert.match(html, /data-context="occasion"[^>]*><span class="k">occasion<\/span><span class="v">now · /)
})

test('the browser draws the slot under its list; its search is the field\'s, and the whole field opens on the search line with the same words', async () => {
  const markup = renderToStaticMarkup(React.createElement(Browser, {sources: [{id: 's', categories: [{id: 'one', label: 'One', kind: 'material'}], Body: () => null}]}))
  assert.match(markup, /class="one-browser-preview" aria-label="Preview"><\/div><\/div><\/div><div class="one-browser-lower"><section class="aperture-slot" aria-label="Aperture">/, 'after the list and its preview, heading the lower 46%')
  assert.match(markup, /placeholder="Search the field \(⌘F\)"/)
  const browser = await read('../src/frame/browser/Browser.tsx')
  assert.match(browser, /openSearchLine\(\{door: 'frame', query: query\.trim\(\), restore: captureFocus\(\)\}\)/)
  assert.match(await read('../src/central/searchLine.tsx'), /useState\(request\.query \?\? ''\)/, 'the line opens on the words it was asked with')
})

test('the pane chrome: the panes stand 4px apart, the ⊞ menu is the mockup\'s .pmenu and closes a pane', async () => {
  const css = await read('../src/frame/paneGrammar.css')
  assert.match(css, /\.candidate-workbench \{ --oi-shell-gutter: 4px;/, 'the mockup\'s .split gap')
  assert.match(css, /\.candidate-workbench \.pane\.split > \.split-resizer \{ flex: 0 0 var\(--oi-shell-gutter\) \}/, 'the resizer is the gap (it stood at 0px, the panes flush)')
  assert.match(css, /\.pane-split-menu \{[^}]*min-width: 170px;/)
  assert.match(css, /\.pane-split-menu button \{ height: 24px; display: flex; align-items: center; gap: 8px; padding: 0 9px;/)
  assert.match(css, /\.candidate-workbench \.pane\.group\.focused \{ border-color: var\(--accent\) \}/)
  const workbench = await read('../../../../desktop/cradle/src/surface/Workbench.tsx')
  const menu = workbench.slice(workbench.indexOf('className="oi-menu pane-split-menu"'), workbench.indexOf('{group.emptySlot &&'))
  assert.deepEqual([...menu.matchAll(/<i aria-hidden="true">(.)<\/i>([^<{]+|\{)/g)].map(match => match[1]), ['⇥', '⤓', '⊞', '⤢', '✕'])
  assert.match(menu, /execute\("surface\.close-pane", \{ groupId: group\.id \}\); \}\}><i aria-hidden="true">✕<\/i>Close pane<\/button>/)
  assert.match(menu, /disabled=\{last \|\| pinnedHere\}/, 'never the last pane, nor one holding a pinned tab')
  assert.match(await read('../src/native/Workbench.tsx'), /const mayRelease = \['surface\.close', 'surface\.close-pane',/, 'a pane\'s documents are checkpointed before it closes, as a tab\'s are')
})
