// The chain as Live's Device View draws it (manual §10.1, §16.4, §19.7, §19.15): the row scrolls sideways with the picture of the
// chain as its scroller, a press in the picture centres the view there, and a rack stands in Live's order — its macros, its chain
// list, then the devices of the selected chain. The picture's reading of a drawn row, its drag and its press, and folding a rack by
// hiding its views, are driven in a browser on the rendered manual (the gallery's chain frames draw the same component).
import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'
import {readFileSync} from 'node:fs'

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
  if(url.endsWith('.json'))return {format:'module',shortCircuit:true,source:'export default '+await readFile(new URL(url),'utf8')};
  if(url.endsWith('.ts')||url.endsWith('.tsx')){
    const source=await readFile(new URL(url).pathname,'utf8');
    const {outputText}=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX},fileName:url});
    return {format:'module',shortCircuit:true,source:outputText};
  }
  return next(url,context);
}`)}`, {parentURL: import.meta.url})

globalThis.document = {getElementById: () => null, createElement: () => ({}), head: {appendChild: () => {}}, documentElement: {}}
const {renderToStaticMarkup} = await import('react-dom/server')
const {centredOn} = await import('../src/frame/detail/ChainOverview.tsx')
const {design: agentset} = await import('../src/inhabitants/catalogue/panels/software-factory__agentset-rack.tsx')
const {skills: skillset} = await import('../src/inhabitants/catalogue/panels/skills.tsx')
const source = path => readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8')

const quiet = draw => {
  const said = console.error
  console.error = (first, ...rest) => { if (!String(first).includes('useLayoutEffect does nothing on the server')) said(first, ...rest) }
  try { return draw() } finally { console.error = said }
}
const compactOf = design => {
  const name = Object.keys(design.fixtures ?? {})[0]
  const v = Object.fromEntries(Object.entries({...design.defaults, ...(name ? design.fixtures[name] : {})}).filter(([, x]) => x !== undefined))
  return quiet(() => renderToStaticMarkup(design.compact({v, set: () => {}, nav: {}, page: design.firstPage ?? '', setPage: () => {}})))
}
const partsOf = markup => [...markup.matchAll(/data-rack-part="(\w+)"/g)].map(m => m[1]).filter((part, i, all) => part !== all[i - 1])

test('a press in the picture brings that part of the chain to the middle of Device view, never past either end', () => {
  const row = {scrollWidth: 2000, clientWidth: 1000}
  assert.equal(centredOn(1200, row), 700)
  assert.equal(centredOn(100, row), 0, 'never before the start')
  assert.equal(centredOn(1990, row), 1000, 'never past the end')
  assert.equal(centredOn(500, {scrollWidth: 800, clientWidth: 1000}), 0, 'a chain that fits does not move')
})

test('the Agentset rack on the chain stands in Live\'s order: its macros, its chain list, then the selected member\'s devices', () => {
  assert.deepEqual(partsOf(compactOf(agentset)), ['macros', 'chains', 'devices'])
})

test('the Skillset rack on the chain stands in Live\'s order: its macros, then its chain list', () => {
  assert.deepEqual(partsOf(compactOf(skillset)), ['macros', 'chains'])
})

test('Device view\'s chain scrolls sideways with no scrollbar of its own: the picture beside the Device switch is its scroller', () => {
  const css = source('frame/detail/detail.css')
  const rule = css.match(/\.detail-chain \{[^}]*\}/)?.[0] ?? ''
  assert.match(rule, /overflow-x: auto/)
  assert.match(rule, /scrollbar-width: none/)
  const bar = source('components/StatusBar.tsx')
  assert.ok(bar.indexOf('<ChainOverview') > bar.indexOf('data-detail-side="device"'), 'the picture stands after the Device switch')
  assert.match(source('frame/detail/DetailHost.tsx'), /publishShownChain\(/, 'the host says which row Device view shows')
})

test('hiding a rack\'s last view folds the rack, as Live\'s does', () => {
  const kit = source('inhabitants/sdk/panel.tsx')
  assert.match(kit, /last\(part\) && onFold \? onFold\(\)/)
})
