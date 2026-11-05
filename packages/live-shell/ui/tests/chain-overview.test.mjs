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
const {centredOn, wheelAlong, ChainPicture} = await import('../src/frame/detail/ChainOverview.tsx')
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

// O-I ticket 748's remainder (DLW build ruling 2026-11-05, round 866): the row itself turns under the wheel, and the picture is the
// chain's own, scaled, not a block for each device (the shell mockup's #cmini: the chain's own drawing at Live's scale).
test('the wheel over the chain moves it sideways, as Live\'s Device View does, unless the chain fits, the wheel is already sideways, or it is over a list that scrolls by itself', () => {
  const chain = {scrollWidth: 3213, clientWidth: 1582}
  assert.equal(wheelAlong(chain, {deltaX: 0, deltaY: 60}, false), 60, 'an upright wheel moves the chain along')
  assert.equal(wheelAlong(chain, {deltaX: 0, deltaY: -3, deltaMode: 1}, false), -48, 'a wheel counted in lines moves sixteen pixels a line')
  assert.equal(wheelAlong(chain, {deltaX: 0, deltaY: 1, deltaMode: 2}, false), 1582, 'a wheel counted in pages moves a view')
  assert.equal(wheelAlong(chain, {deltaX: 40, deltaY: 5}, false), null, 'a sideways wheel is the row\'s own scroll')
  assert.equal(wheelAlong(chain, {deltaX: 0, deltaY: 60}, true), null, 'a list that scrolls by itself keeps its wheel')
  assert.equal(wheelAlong({scrollWidth: 900, clientWidth: 1000}, {deltaX: 0, deltaY: 60}, false), null, 'a chain that fits leaves the wheel alone')
  const code = source('frame/detail/ChainOverview.tsx')
  assert.match(code, /addEventListener\('wheel', onRowWheel, \{passive: false\}\)/, 'the row Device view shows takes the wheel, and can keep it from the page')
  assert.match(code, /removeEventListener\('wheel', onRowWheel\)/, 'a row no longer shown gives the wheel back')
})

test('the picture is the chain\'s own drawing, scaled: each device\'s title bar, display, sections and controls where they stand, in both directions', () => {
  const reading = {scrollWidth: 1600, clientWidth: 800, clientHeight: 320, scrollLeft: 0, plates: [
    {x: 8, y: 8, w: 400, h: 304, depth: 0, name: 'Torus', folded: false, end: false, light: 'lit', parts: [
      {kind: 'head', x: 8, y: 8, w: 400, h: 20}, {kind: 'display', x: 16, y: 32, w: 200, h: 140}, {kind: 'control', x: 230, y: 40, w: 40, h: 40}]},
    {x: 414, y: 8, w: 24, h: 304, depth: 0, name: 'Delay', folded: true, end: false, light: 'dark', parts: []}]}
  const html = renderToStaticMarkup(ChainPicture({reading, room: 160, tall: 32}))
  const at = kind => [...html.matchAll(new RegExp(`data-part="${kind}"[^>]*style="([^"]*)"`, 'g'))].map(m => m[1])
  assert.equal(at('head').length, 1)
  assert.equal(at('display').length, 1)
  assert.equal(at('control').length, 1)
  // One scale for both directions, the smaller of the room's along and the overview's height over the row's.
  const s = Math.min(160 / 1600, 32 / 320)
  assert.match(at('display')[0], new RegExp(`left:${16 * s}px;top:${32 * s}px;width:${200 * s}px;height:${140 * s}px`))
  assert.match(html, /data-folded="true"/, 'a folded device stands as its strip')
  assert.match(html, /aria-label="Torus"|data-name="Torus"/, 'each plate keeps its name for the picture')
})
