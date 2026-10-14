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
const {Browser} = await import('../src/frame/browser/Browser.tsx')
const {MODE_BROWSERS, browserSourcesOf} = await import('../src/shell/modeBrowsers.tsx')
const {SURF_MODES} = await import('../src/shell/modeGrammar.ts')
const source = path => readFile(new URL(`../src/${path}`, import.meta.url), 'utf8')

test('the four kinds are the manual\'s, in its order', () => {
  assert.deepEqual(BROWSER_KINDS.map(k => k.kind), ['material', 'instruments', 'devices', 'running'])
})

test('every mode browses its own rows, the running sessions, the sets and the instruments — each category under one kind', () => {
  assert.deepEqual(Object.keys(MODE_BROWSERS).sort(), [...SURF_MODES].sort())
  for (const mode of SURF_MODES) {
    const sources = browserSourcesOf(mode)
    const categories = sources.flatMap(s => s.categories)
    for (const c of categories) assert.ok(BROWSER_KINDS.some(k => k.kind === c.kind), `${mode}:${c.id} has a kind`)
    assert.ok(categories.some(c => c.id === 'sets' && c.kind === 'material'), `${mode}: Sets`)
    assert.ok(categories.some(c => c.id === 'instruments' && c.kind === 'instruments'), `${mode}: Instruments`)
    assert.ok(categories.some(c => c.id === 'sess' && c.kind === 'running'), `${mode}: the running sessions`)
  }
  const live = browserSourcesOf('live').flatMap(s => s.categories)
  for (const id of ['Presets', 'Instruments', 'Chain devices']) assert.equal(live.find(c => c.id === id)?.kind, 'devices', `Live ${id} go on a chain`)
  const expressions = browserSourcesOf('expressions').flatMap(s => s.categories)
  assert.equal(expressions.find(c => c.id === 'works')?.kind, 'material'); assert.equal(expressions.find(c => c.id === 'devices')?.kind, 'devices')
  const factory = browserSourcesOf('factory').flatMap(s => s.categories)
  assert.deepEqual(factory.filter(c => c.kind === 'running').map(c => c.id), ['sess', 'agents'], 'Factory: sessions and agents are running things')
  assert.equal(browserSourcesOf('base')[0].categories[0].id, 'central-days', 'Central opens on its days')
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
  assert.match(markup, /aria-label="Pool"/); assert.match(markup, /data-device-pool="empty"/, 'the device pool beneath')
})

test('the frame\'s browser names no mode, and App has one browser residence with no per-mode browser body', async () => {
  for (const file of ['frame/browser/Browser.tsx', 'frame/browser/browserKinds.ts']) {
    assert.doesNotMatch(await source(file), /'(live|base|factory|expressions|techne|audio)'/, `${file} names no mode`)
  }
  const app = await source('App.tsx')
  assert.equal((app.match(/className="browser-residence"/g) ?? []).length, 1)
  for (const old of ['<BrowserPane', '<WorldBrowser', '<ModeBrowser', '<AgentShellBrowser']) assert.ok(!app.includes(old), `${old} is a row body, not an App residence`)
})
