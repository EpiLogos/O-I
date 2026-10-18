import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'

// FOUNDATION F6: one browser. Four kinds (material, instruments, devices, running) plus the pool; the old browsers are
// row bodies under its control, each keeping its row sources. The frame knows no mode; the mode table names the sources.
// Loader as live-browser-chain.test.mjs.
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
  if(url.endsWith('.json'))return {format:'module',shortCircuit:true,source:'export default '+await readFile(new URL(url).pathname,'utf8')};
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
const {BROWSER_KINDS} = await import('../src/frame/browser/browserKinds.ts')
const {Browser, categoryKey} = await import('../src/frame/browser/Browser.tsx')
const keyDoors = await import('../src/frame/keys/keyDoors.ts')
const {MODE_BROWSERS, browserSourcesOf} = await import('../src/shell/modeBrowsers.tsx')
const {SURF_MODES} = await import('../src/shell/modeGrammar.ts')
const source = path => readFile(new URL(`../src/${path}`, import.meta.url), 'utf8')

test('the four kinds are the manual\'s, in its order', () => {
  assert.deepEqual(BROWSER_KINDS.map(k => k.kind), ['material', 'instruments', 'devices', 'running'])
})

test('every mode browses its own rows, the running sessions and the instruments — each category under one kind; the named sets are workspaces now', () => {
  assert.deepEqual(Object.keys(MODE_BROWSERS).sort(), [...SURF_MODES].sort())
  for (const mode of SURF_MODES) {
    const sources = browserSourcesOf(mode)
    const categories = sources.flatMap(s => s.categories)
    for (const c of categories) assert.ok(BROWSER_KINDS.some(k => k.kind === c.kind), `${mode}:${c.id} has a kind`)
    assert.ok(!categories.some(c => c.id === 'sets'), `${mode}: no Sets row (W1: a kept arrangement is a workspace in the pool)`)
    assert.ok(categories.some(c => c.id === 'instruments' && c.kind === 'instruments'), `${mode}: Instruments`)
    assert.ok(categories.some(c => c.id === 'sess' && c.kind === 'running'), `${mode}: the running sessions`)
  }
  const live = browserSourcesOf('live').flatMap(s => s.categories)
  for (const id of ['Presets', 'Instruments', 'Chain devices']) assert.equal(live.find(c => c.id === id)?.kind, 'devices', `Live ${id} go on a chain`)
  const expressions = browserSourcesOf('expressions').flatMap(s => s.categories)
  assert.equal(expressions.find(c => c.id === 'works')?.kind, 'material'); assert.equal(expressions.find(c => c.id === 'devices')?.kind, 'devices')
  const factory = browserSourcesOf('factory').flatMap(s => s.categories)
  assert.deepEqual(factory.filter(c => c.kind === 'running').map(c => c.id), ['sess', 'agents'], 'Factory: sessions and agents are running things')
  assert.equal(browserSourcesOf('base')[0].categories[0].id, 'central-worlds', 'Central opens on its worlds (T-WORLDS W2: a world is dragged onto the empty track)')
})

test('the chrome groups by kind, holds one search and one pool, and draws the chosen category\'s body under its control', () => {
  const seen = []
  const Body = ({controlled}) => { seen.push(controlled); return React.createElement('p', null, `rows of ${controlled.category}`) }
  const sources = [{id: 'a', categories: [{id: 'one', label: 'One', kind: 'devices'}, {id: 'two', label: 'Two', kind: 'material'}], Body}]
  const markup = renderToStaticMarkup(React.createElement(Browser, {sources}))
  assert.equal((markup.match(/type="search"/g) ?? []).length, 1, 'one search')
  assert.match(markup, /data-browser-kind="material".*data-browser-kind="devices"/s, 'kinds in the manual\'s order, empty kinds left out')
  assert.doesNotMatch(markup, /data-browser-kind="(instruments|running)"/)
  assert.match(markup, /rows of one/); assert.equal(seen[0].query, '')
  assert.match(markup, /aria-label="Pool"/); assert.doesNotMatch(markup, /data-device-pool|aria-label="Aperture"/, 'the pool holds no device and no aperture (W1)')
  assert.match(markup, /class="one-browser-preview" aria-label="Preview"/, 'the selected row\'s preview stands at the foot of the list')
})

test('the frame\'s browser names no mode, and App has one browser residence with no per-mode browser body', async () => {
  for (const file of ['frame/browser/Browser.tsx', 'frame/browser/browserKinds.ts']) {
    assert.doesNotMatch(await source(file), /'(live|base|factory|expressions|techne|audio)'/, `${file} names no mode`)
  }
  const app = await source('App.tsx')
  assert.equal((app.match(/className="browser-residence"/g) ?? []).length, 1)
  for (const old of ['<BrowserPane', '<WorldBrowser', '<ModeBrowser', '<AgentShellBrowser']) assert.ok(!app.includes(old), `${old} is a row body, not an App residence`)
})

// FOUNDATION F1: a mode returns to the browser category it was left on. The category is the book's (App holds one per mode in the
// application view); the browser is controlled by it and reports a choice. Rendered headless; the click is read in the source.
const makeSources = () => {
  const Body = ({controlled}) => React.createElement('p', {'data-body': controlled.category}, `rows of ${controlled.category}`)
  return [
    {id: 'a', categories: [{id: 'one', label: 'One', kind: 'material'}, {id: 'two', label: 'Two', kind: 'material'}], Body},
    {id: 'b', categories: [{id: 'two', label: 'Two again', kind: 'devices'}], Body},
  ]
}
const shown = markup => markup.match(/data-body="([^"]+)"/)?.[1]
const pressed = markup => [...markup.matchAll(/<button[^>]*aria-pressed="true"[^>]*>.*?<\/button>/gs)].map(m => m[0].match(/<span>([^<]+)<\/span>/)?.[1])

test('a category is named by its source and its id, so two sources may each have a "two"', () => {
  const [a, b] = makeSources()
  assert.equal(categoryKey(a, a.categories[1]), 'a:two')
  assert.equal(categoryKey(b, b.categories[0]), 'b:two')
})

test('a controlled browser shows the category the book holds, and falls back to the first when the key names none', () => {
  const sources = makeSources()
  const render = props => renderToStaticMarkup(React.createElement(Browser, {sources, ...props}))
  assert.equal(shown(render({category: 'a:two', onCategory() {}})), 'two')
  assert.deepEqual(pressed(render({category: 'a:two', onCategory() {}})), ['Two'])
  assert.deepEqual(pressed(render({category: 'b:two', onCategory() {}})), ['Two again'], 'the second source\'s "two" is the one pressed')
  assert.deepEqual(pressed(render({category: 'gone:away', onCategory() {}})), ['One'], 'a stale key falls back to the first category')
  assert.deepEqual(pressed(render({category: null, onCategory() {}})), ['One'], 'a mode never left holds none: the first')
  // two modes remount the one browser with their own held category: each returns to its own
  assert.deepEqual(pressed(render({category: 'a:two', onCategory() {}})), ['Two'])
  assert.deepEqual(pressed(render({category: 'a:one', onCategory() {}})), ['One'])
  // without a book (the uncontrolled form) the browser holds its own choice and starts on the first
  assert.deepEqual(pressed(render({})), ['One'])
})

test('choosing a category reports it to the book, and the browser registers its search for ⌘F (code-reading)', async () => {
  const src = await source('frame/browser/Browser.tsx')
  assert.match(src, /onClick=\{\(\) => \{ hold\(key\(item\)\); onCategory\?\.\(key\(item\)\); setQuery\(''\) \}\}/, 'a press holds the choice and reports it')
  assert.match(src, /const active = onCategory \? category \?\? null : held/, 'the book\'s category governs once the browser is controlled')
  assert.match(src, /useBrowserSearchRequest\(searchRef\)/); assert.match(src, /<input ref=\{searchRef\} type="search"/)
})

test('⌘F reaches the browser\'s search: the box is registered while the browser is mounted (the keys layer\'s door)', () => {
  assert.equal(typeof keyDoors.useBrowserSearchRequest, 'function')
  let focused = 0
  const release = keyDoors.registerBrowserSearch({focus() { focused++ }})
  assert.equal(keyDoors.requestBrowserSearch(), true)
  assert.equal(focused, 1)
  release()
  assert.equal(keyDoors.requestBrowserSearch(), false, 'no browser, the key is left to others')
})
