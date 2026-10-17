import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'

// Lane F, F3: the transport never overlaps and never truncates a chooser. Seen natively at 1372 px (the lead, 16 Oct): in
// Expressions the draw slot carried the owner's stage tool rail and the pointer's three choosers, the bar ran 53 px past its box,
// "Running" lay over the Map slot and the mode icons, and the choosers read "Repe", "Pulse", "Glob" (the shell's 54px select cap).
// The bar now measures its room: short of it, a slot carrying an owner's control and a specimen mark folds to the mark (the
// mockup's one ✎ cell) and the mark opens the control, whole, beneath it; a chooser is as wide as its choice. Headless (lane F,
// Chromium, 1280/1372/1440 × every mode): the bar fits with nothing outside its box and no chooser cut. Channel here: scripted.
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
const React = await import('react')
const {renderToStaticMarkup} = await import('react-dom/server')
const {readFile} = await import('node:fs/promises')
const {nextFold, FOLD_SLACK} = await import('../src/frame/transport/fold.ts')
const {Transport} = await import('../src/frame/transport/Transport.tsx')

const words = id => ({label: id, fn: `does ${id}`, dataI: `${id}|does ${id}`, waiting: `${id} waits`})
const open = {folded: false, need: 0}

test('short of room the bar folds, remembering what it needed; it opens again only once its box is that wide', () => {
  // Expressions at 1372 px, measured headless: the row laid out 1079 px in a 1026 px box
  const folded = nextFold(open, {scroll: 1079, client: 1026})
  assert.deepEqual(folded, {folded: true, need: 1079 + FOLD_SLACK})
  assert.equal(nextFold(folded, {scroll: 1026, client: 1026}), folded, 'folded and still narrow: unchanged (the same state, no render)')
  assert.deepEqual(nextFold(folded, {scroll: 1554, client: 1554}), {folded: false, need: 0}, 'the window widened past the need: open')
  assert.equal(nextFold(open, {scroll: 1000, client: 1026}), open, 'room to spare: nothing folds')
})

test('a scale group squeezed below its readings is a bar short of room too (its readings give way first, never to nothing)', () => {
  // 1440 px: the row fits only because the scale group's readings were squeezed 15 px
  const folded = nextFold(open, {scroll: 1094, client: 1094, scaleScroll: 45, scaleClient: 30})
  assert.deepEqual(folded, {folded: true, need: 1094 + 15 + FOLD_SLACK})
  assert.equal(nextFold(open, {scroll: 1094, client: 1094, scaleScroll: 30, scaleClient: 30}), open)
})

test('an owner\'s control in a marked slot carries its mark and its body in one structure; folding never remounts the control', () => {
  const html = bindings => renderToStaticMarkup(React.createElement(Transport, {bindings, words}))
  const markup = html({draw: {control: React.createElement('span', {className: 'owner-tools'}, 'tools')}, cpu: {control: React.createElement('output', null, 'Running')}})
  const draw = markup.match(/<span class="transport-slot"[^>]*data-slot="draw"[^>]*>[\s\S]*?<\/span><\/span>/)?.[0] ?? ''
  assert.match(draw, /class="native-control transport-fold-mark"[^>]*aria-haspopup="true"[^>]*aria-expanded="false"/, 'the mark, drawn only while folded')
  assert.match(draw, /<span class="transport-fold-body"><span class="owner-tools">tools<\/span><\/span>/, 'the owner\'s control, in its body')
  assert.doesNotMatch(draw, /data-fold=/, 'measured with room, nothing is folded')
  assert.doesNotMatch(markup.match(/data-slot="cpu"[^>]*>[\s\S]*?<\/span>/)[0], /transport-fold/, 'a readout slot (no mark) has no fold: the engine light stays a reading')
  assert.doesNotMatch(markup, /data-fold="marks"/, 'the bar starts open')
})

test('the stylesheet: no chooser is cut, the fold draws the mark in the body\'s place, and nothing of the bar lies past its box', async () => {
  const css = (await readFile(new URL('../src/frame/transport/transport.css', import.meta.url), 'utf8')).replace(/\/\*[\s\S]*?\*\//g, '')
  assert.match(css, /\.mode-transport\.one-transport \{ min-width: 0; overflow-x: clip \}/, 'the last guard: the bar clips on x, never draws over the mode icons')
  assert.match(css, /\.mode-transport\.one-transport \.transport-slot select \{ field-sizing: content; max-width: 160px \}/,
    'a chooser is as wide as its choice — never the old 54px cut ("Repe"), never its longest option')
  assert.match(css, /\.one-transport \.transport-fold-body \{ display: contents \}/, 'open, the owner\'s controls lie in the row as before')
  assert.match(css, /\.one-transport \.transport-slot\[data-fold\] > \.transport-fold-body \{ display: none \}/)
  assert.match(css, /\.one-transport \.transport-slot\[data-fold=open\] > \.transport-fold-body \{ display: flex; position: absolute; top: calc\(100% \+ 5px\); right: -4px/,
    'opened, the control stands whole beneath its mark, leftward inside the bar\'s width')
  assert.match(css, /\.position-field\[data-slot=loop-length\]\[data-unread\] \{ min-width: 0 \}/, 'an unread loop length is the width of its dash')
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b|rgba?\(/i, 'shell tokens only')
})
