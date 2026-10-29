import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'

// FOUNDATION F8: one widget rail. Every widget of the world, one open set in the book (open a terminal in Factory and it
// is still there in Central), each widget's pin, the launcher and presets. The frame knows no mode.
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
globalThis.document = {getElementById: () => null, createElement: () => ({style: {}, setAttribute: noop, appendChild: noop}), head: {appendChild: noop}, addEventListener: noop, removeEventListener: noop, querySelector: () => null, querySelectorAll: () => [], documentElement: {style: {}, dataset: {}, classList: {add: noop, remove: noop, contains: () => false}}, body: {style: {}, dataset: {}, appendChild: noop, classList: {add: noop, remove: noop}}}
globalThis.window ??= globalThis; globalThis.addEventListener ??= noop; globalThis.removeEventListener ??= noop
globalThis.__CRADLE_WALK__ = false
globalThis.matchMedia ??= () => ({matches: false, addEventListener: noop, removeEventListener: noop, addListener: noop, removeListener: noop})
globalThis.localStorage = {getItem: () => null, setItem: () => {}}
const React = await import('react')
const {renderToStaticMarkup} = await import('react-dom/server')
const {readFile} = await import('node:fs/promises')
const source = path => readFile(new URL(`../src/${path}`, import.meta.url), 'utf8')
const {WidgetRail} = await import('../src/frame/widgets/WidgetRail.tsx')
const {MODE_WIDGETS} = await import('../src/shell/widgetDefaults.ts')

const probe = id => ({id, name: id.toUpperCase(), mark: 'trav', Body: ({subject, pinned}) => React.createElement('p', null, `${id} shows ${subject ?? 'nothing'}${pinned ? ' (pinned)' : ''}`)})
const bookOf = rail => ({rail, calls: [], toggle(id) { this.calls.push(['toggle', id]) }, pin(id, ref) { this.calls.push(['pin', id, ref]) }, savePreset() {}, applyPreset() {}, widen() {}})

test('the registry holds every tile of both old docks, once each (code-reading: its import chain needs the Vite env)', async () => {
  const registry = await source('shell/widgets.tsx')
  const listed = name => JSON.parse(registry.match(new RegExp(`${name}[^=]*= (\\[[^\\]]*\\])`))[1].replace(/'/g, '"'))
  const ids = ['agent', ...listed('MODE_TILES'), ...listed('AGENT_TILES')]
  assert.equal(new Set(ids).size, ids.length, 'no widget twice')
  // REPLACED (#725): the Diff tile — retired in the 22 Oct manual rewrite: reading what changed is the Diff page of Files (§23.4, §23.2), so
  // the Files tile holds it and no Diff tile is registered.
  for (const id of ['agent', 'packet', 'trail', 'field', 'nows', 'sky', 'terminal', 'files', 'web', 'graph', 'frames', 'ledger', 'approvals']) assert.ok(ids.includes(id), id)
  assert.ok(!ids.includes('diff'), 'no Diff tile: Files carries the Diff page')
  // Sessions left the rail: it is a view now (DLW §16.1 "The views are not devices"; lock §0.3.1; R4). REPLACED (O-I #744): Agents and
  // Results stand on Factory's rail again, as the manual's §19 "On the rail" and Factory's opening name them (tests/rail-tiles-per-mode).
  assert.ok(!ids.includes('sessions'), 'sessions is a view, not a widget')
  for (const id of ['agents', 'results']) assert.ok(ids.includes(id), `${id} is Factory's tile`)
  for (const id of Object.values(MODE_WIDGETS).flat()) assert.ok(ids.includes(id) || id.startsWith('device:'), `default ${id} is registered`)
})

test('the rail draws the open set in its order; a pinned widget shows its pin, the rest follow the selection', () => {
  const book = bookOf({open: ['b', 'a'], pinned: {a: 'ref:held'}})
  const markup = renderToStaticMarkup(React.createElement(WidgetRail, {widgets: [probe('a'), probe('b'), probe('c')], book, selectionRef: 'ref:now'}))
  assert.match(markup, /data-widget="b".*data-widget="a"/s, 'in the open order')
  assert.doesNotMatch(markup, /data-widget="c"/, 'closed widgets stay in the launcher')
  assert.match(markup, /b shows ref:now</); assert.match(markup, /a shows ref:held \(pinned\)</)
  assert.equal((markup.match(/data-launch=/g) ?? []).length, 3, 'the launcher lists every widget')
})

test('the frame\'s rail names no mode, and App has one dock residence holding the rail', async () => {
  for (const file of ['frame/widgets/WidgetRail.tsx', 'frame/widgets/widgets.ts']) {
    assert.doesNotMatch(await source(file), /'(live|base|factory|expressions|techne|audio)'/, `${file} names no mode`)
  }
  const app = await source('App.tsx')
  assert.equal((app.match(/className="dock-residence"/g) ?? []).length, 1)
  assert.ok(app.includes('<WidgetRail widgets={worldWidgets()} book={widgetBook}'), 'App mounts the one rail: its own widgets and every panel in the widget slot')
  for (const old of ['<ModeContextDock', '<AgentContextDock']) assert.ok(!app.includes(old), `${old} is gone from App`)
})
