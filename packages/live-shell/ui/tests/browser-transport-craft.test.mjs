import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'

// The one browser and the one transport at the mockup's floor (world-shell-mockup.html .bsearch/.bcats/.bres/.bitem/.slot,
// .tp/.nc/.fld/.tbtn). The craft lives in two frame stylesheets and a little markup: the browser's back and forward cells
// walk the categories it has shown; a category draws a count only when its source discloses one; the transport's Link and
// Tap lead the tempo cells as one group, and an unread readout says so. The laws stay: no light without a reading, no
// enabled slot without a write path. Rendered headless and read from the stylesheets; the look itself is the screen pass.
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
const {Browser} = await import('../src/frame/browser/Browser.tsx')
const {EMPTY_TRAIL, visitCategory, walkTrail} = await import('../src/frame/browser/browserTrail.ts')
const {Transport} = await import('../src/frame/transport/Transport.tsx')
const source = path => readFile(new URL(`../src/${path}`, import.meta.url), 'utf8')
const words = id => ({label: id, fn: `does ${id}`, dataI: `${id}|does ${id}`, waiting: `${id} waits`})

test('the trail: showing keeps the one before; back and forward step, keeping where they came from', () => {
  let trail = visitCategory(EMPTY_TRAIL, 'a:one')
  assert.deepEqual(trail, {back: [], forward: [], at: 'a:one'}, 'the first category shown starts the trail')
  assert.equal(walkTrail(trail, 'back'), null, 'nothing to go back to')
  trail = visitCategory(visitCategory(trail, 'a:two'), 'b:three')
  assert.equal(visitCategory(trail, 'b:three'), trail, 'showing the same category again changes nothing')
  const back = walkTrail(trail, 'back')
  assert.equal(back.show, 'a:two'); assert.deepEqual(back.trail, {back: ['a:one'], forward: ['b:three'], at: 'a:two'})
  const forward = walkTrail(back.trail, 'forward')
  assert.equal(forward.show, 'b:three'); assert.deepEqual(forward.trail, {back: ['a:one', 'a:two'], forward: [], at: 'b:three'})
  assert.deepEqual(visitCategory(back.trail, 'c:four'), {back: ['a:one', 'a:two'], forward: [], at: 'c:four'}, 'a new category clears forward')
})

test('the search row holds the back and forward cells, enabled only when a step exists, and the one search', async () => {
  const Body = () => React.createElement('p', null, 'rows')
  const markup = renderToStaticMarkup(React.createElement(Browser, {sources: [{id: 's', categories: [{id: 'one', label: 'One', kind: 'material'}], Body}]}))
  const row = markup.match(/<div class="world-browser-searchrow">[\s\S]*?<\/div>/)?.[0] ?? ''
  for (const label of ['Back', 'Forward']) assert.match(row, new RegExp(`<button[^>]*aria-label="${label}"[^>]*disabled=""`), `${label} waits for a step`)
  assert.equal((row.match(/type="search"/g) ?? []).length, 1)
  const src = await source('frame/browser/Browser.tsx')
  assert.match(src, /useEffect\(\(\) => \{ setTrail\(before => visitCategory\(before, shown\)\) \}, \[shown\]\)/, 'the trail follows the category shown, whoever chose it')
  assert.match(src, /setTrail\(step\.trail\); hold\(step\.show\); onCategory\?\.\(step\.show\); setQuery\(''\)/, 'a step shows its category and reports it to the book')
})

test('a category draws a count only when its source discloses one', () => {
  const Body = () => null
  const markup = renderToStaticMarkup(React.createElement(Browser, {sources: [{id: 's', categories: [
    {id: 'counted', label: 'Counted', kind: 'material', count: 7},
    {id: 'quiet', label: 'Quiet', kind: 'material'},
  ], Body}]}))
  const button = label => markup.match(new RegExp(`<button[^>]*>(?:(?!</button>).)*<span>${label}</span>(?:(?!</button>).)*</button>`, 's'))?.[0] ?? ''
  assert.match(button('Counted'), /<span class="one-browser-category-count" aria-label="7 in Counted">7<\/span>/)
  assert.doesNotMatch(button('Quiet'), /one-browser-category-count/, 'no count is guessed')
})

test('the browser stylesheet holds the floor: 25px search, a 112px column that widens only to fit, 23px rows, the 46% pool', async () => {
  const css = await source('frame/browser/browser.css')
  const rule = selector => css.match(new RegExp(`${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`))?.[1] ?? ''
  assert.match(rule('.one-browser .world-browser-searchrow'), /height: 25px/)
  assert.match(rule('.one-browser .world-browser-search input'), /background: var\(--bg-0\)/)
  assert.match(rule('.one-browser .world-browser-main'), /grid-template-columns: fit-content\(156px\) minmax\(0, 1fr\)/, 'the column fits its longest label')
  assert.match(rule('.one-browser .world-category-list'), /min-width: 112px/, 'and is never narrower than the mockup\'s 112px')
  assert.match(rule('.one-browser .world-category-list h3'), /font-size: 10\.5px;[^}]*color: var\(--text-faint\)/)
  assert.match(rule('.one-browser .world-category-list button[aria-pressed=true]'), /background: var\(--bg-3\)/, 'the chosen category is bg-3, as .bcat.on')
  assert.match(css, /min-height: 23px; padding: 2px 5px[^}]*font-size: 11px/, 'rows are the 23px .bitem at 11px')
  assert.match(css, /box-shadow: inset 2px 0 0 var\(--accent\)/, 'a selected row carries the inset accent bar')
  assert.match(css, /height: 20px; flex: none;\s*margin: 0; padding: 2px 5px; border: 0; background: var\(--bg-0\)/, 'every body\'s head is the 20px .bhead on bg-0')
  assert.match(rule('.one-browser .one-browser-pool'), /flex: 0 0 46%; min-height: 120px[^}]*border-top: 5px solid var\(--line\)/)
  assert.doesNotMatch(css.replace(/\/\*[\s\S]*?\*\//g, ''), /#[0-9a-f]{3,8}\b/i, 'shell tokens only')
})

test('the transport groups Link and Tap with the tempo cells, marks unread readouts, and keeps the slot laws', () => {
  const html = bindings => renderToStaticMarkup(React.createElement(Transport, {bindings, words}))
  const bare = html({})
  const lead = bare.match(/<div class="transport-group transport-lead">([\s\S]*?)<div class="transport-scale">/)?.[1] ?? ''
  assert.deepEqual([...lead.matchAll(/data-slot="([^"]+)"/g)].map(m => m[1]).filter((id, i, all) => all.indexOf(id) === i),
    ['link', 'tap', 'tempo', 'signature', 'metro', 'quantize'], 'one group, as the mockup\'s first')
  assert.match(lead, /<div class="transport-group transport-tempo">/, 'the tempo cells keep their own group (the narrow rules fold them by it)')
  assert.match(bare.match(/<output[^>]*data-slot="position"[^>]*>/)[0], /data-unread=""/, 'an unread readout says so')
  const read = html({position: {readout: {value: '3 . 1 . 1', title: 'pos'}}, play: {press() {}, lit: true}})
  assert.doesNotMatch(read.match(/<output[^>]*data-slot="position"[^>]*>/)[0], /data-unread/, 'a read one does not')
  assert.match(read.match(/<button[^>]*data-slot="play"[^>]*>/)[0], /data-light="on"/)
  assert.doesNotMatch(bare, /data-light=/, 'still no light without a reading')
})

test('the transport stylesheet holds the floor and leaves the shell\'s narrow-width folding alone', async () => {
  const css = await source('frame/transport/transport.css')
  const src = await source('frame/transport/Transport.tsx')
  assert.match(src, /import '\.\/transport\.css'/, 'the bar brings its own stylesheet')
  assert.match(css, /\.native-control \{ height: 19px; min-width: 17px;\s*padding: 1px 4px; border: 1px solid var\(--bg-1\); background: var\(--bg-0\)/, 'a cell is the 19px .nc on bg-0')
  assert.match(css, /\.native-control\[data-light=on\]:not\(\.transport-btn\) \{ background: var\(--accent\)/, 'a lit cell is the accent — lit only by data-light, the reading')
  assert.match(css, /font-family: var\(--mono/, 'readouts are mono')
  assert.match(css, /\.position-field\[data-slot=position\] \{ box-shadow: inset 0 -2px 0 var\(--accent\) \}/, 'only the position carries the .act underline')
  assert.match(css, /\.transport-btn \{ width: 20px; height: 22px/, 'the play row is 20×22')
  assert.match(css, /\.transport-play\[data-light=on\] \{ background: var\(--accent\)/, 'play lit is filled')
  assert.match(css, /\.transport-record\[data-light=on\] \{ color: var\(--rec\)/, 'record lights in --rec')
  // The shell's narrow-width rules (styles.css) fold the scale, loop and system groups and the later tempo and play cells by
  // `display: none`; a display set here would outrank them. Only an owner's slot, and a cell's icon, set one.
  const displayed = [...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^}]*)\}/g)].filter(([, , body]) => /(^|[\s;])display:/.test(body)).map(([, selector]) => selector.trim())
  assert.deepEqual(displayed, ['.one-transport .transport-slot', '.mode-transport.one-transport .native-control svg'])
  assert.doesNotMatch(css.replace(/\/\*[\s\S]*?\*\//g, ''), /#[0-9a-f]{3,8}\b/i, 'shell tokens only (the comments may name the mockup\'s colours)')
})

test('the new frame files name no mode', async () => {
  for (const file of ['frame/browser/browserTrail.ts', 'frame/browser/Browser.tsx', 'frame/transport/Transport.tsx']) {
    assert.doesNotMatch(await source(file), /'(live|base|factory|expressions|techne|audio)'/, `${file} names no mode`)
  }
})
