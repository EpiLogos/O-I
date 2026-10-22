import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'

// W4, the Arrangement ruler drawn to its design (catalogue dlw__arrangement-ruler.tsx FullRuler): the loop brace over the marks and down
// each track, bound to the ruler's own window (rulerWindow.ts) and to the loop a set carries; with no loop, no brace (the design's absent
// state). The overview strip and its scale label, built in W6, stand as they were.
// - SCRIPTED: the pure placement called directly, and the view rendered to static markup (react-dom/server). There is no DOM, so nothing
//   here proves how it looks: the headless screen pass in the W4 return does that.
// - CODE-READING: tracks.css read as text for the brace's rules.
// Loader as tracks-views.test.mjs.
const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};
import {readFile} from 'node:fs/promises';
export async function resolve(specifier,context,next){
  try{return await next(specifier,context)}catch(error){
    if(!specifier.startsWith('.'))throw error;
    if(specifier.endsWith('.js')){try{return await next(specifier.slice(0,-3)+'.ts',context)}catch{}}
    for(const suffix of ['.ts','.tsx']){try{return await next(specifier+suffix,context)}catch{}}
    throw error;
  }
}
export async function load(url,context,next){
  if(url.endsWith('.css'))return {format:'module',shortCircuit:true,source:'export default null'};
  if(url.endsWith('.ts')||url.endsWith('.tsx')){
    const source=await readFile(new URL(url).pathname,'utf8');
    const {outputText}=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX},fileName:url});
    return {format:'module',shortCircuit:true,source:outputText};
  }
  return next(url,context);
}`)}`, {parentURL: import.meta.url})

globalThis.document = {getElementById: () => null, createElement: () => ({}), head: {appendChild: () => {}}}
const React = await import('react')
const {renderToStaticMarkup} = await import('react-dom/server')
const {readFile} = await import('node:fs/promises')
const cssText = await readFile(new URL('../src/frame/tracks/tracks.css', import.meta.url), 'utf8')
const {ArrangementRulerView, loopOf} = await import('../src/frame/tracks/ArrangementRuler.tsx')
const {bandIn, rangeBounds} = await import('../src/frame/tracks/rulerWindow.ts')

const noop = () => {}
const rule = selector => new RegExp(`(?:^|\\n)${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`).exec(cssText)?.[1] ?? ''
const view = (window = null) => ({window, onWindow: noop, snap: 'free', onSnap: noop, marker: null, onMarker: noop, width: 0})
const html = (set, window = null) => renderToStaticMarkup(React.createElement(ArrangementRulerView,
  {set, selection: {select: noop}, view: view(window), receipt: null, onPress: noop, onDismiss: noop}))
/** A run of a thousand seconds, two sessions, one clip each. */
const run = (extra = {}) => ({columns: [{id: 'r1', name: '1'}], ruler: {unit: 'seconds', end: 1000},
  tracks: [{id: 'a', name: 'Lead', kind: 'session', color: '#4cc9f0'}, {id: 'b', name: 'Test', kind: 'session'}],
  clips: [{id: 'c1', trackId: 'a', columnId: 'r1', label: 'map field', status: 'stopped', at: {start: 100, end: 300}},
    {id: 'c2', trackId: 'b', columnId: 'r1', label: 'widget tests', status: 'running', at: {start: 500, end: 900}}], ...extra})
const braces = markup => [...markup.matchAll(/<i class="tl-brace"[^>]*><\/i>/g)].map(match => match[0])

test('a stretch stands in the window where the window shows it: held to the ruler, cut to the window, an outside end marked', () => {
  const whole = {start: 0, end: 1000}, bounds = rangeBounds(1000)
  assert.deepEqual(bandIn({start: 200, end: 400}, whole, bounds), {left: 20, width: 20, cutStart: false, cutEnd: false})
  assert.deepEqual(bandIn({start: 200, end: 400}, {start: 300, end: 500}, bounds), {left: 0, width: 50, cutStart: true, cutEnd: false}, 'begun before the window')
  assert.deepEqual(bandIn({start: 200, end: 400}, {start: 100, end: 300}, bounds), {left: 50, width: 50, cutStart: false, cutEnd: true}, 'ends after the window')
  assert.deepEqual(bandIn({start: 800, end: 5000}, whole, bounds), {left: 80, width: 20, cutStart: false, cutEnd: false}, 'held to the ruler\'s end')
  assert.deepEqual(bandIn({start: -50, end: 100}, whole, bounds), {left: 0, width: 10, cutStart: false, cutEnd: false}, 'held to the ruler\'s start')
  assert.equal(bandIn({start: 200, end: 400}, {start: 500, end: 700}, bounds), null, 'wholly outside the window')
  assert.equal(bandIn({start: 200, end: 400}, {start: 400, end: 600}, bounds), null, 'touching the window\'s edge is outside it')
  assert.equal(bandIn({start: 400, end: 200}, whole, bounds), null, 'a loop that runs backwards is not guessed into one that runs forwards')
  assert.equal(bandIn({start: 300, end: 300}, whole, bounds), null, 'no length, no band')
  assert.equal(bandIn({start: Number.NaN, end: 300}, whole, bounds), null)
  assert.equal(bandIn({start: 2000, end: 3000}, whole, bounds), null, 'past the ruler\'s end')
})

test('with no loop carried, no brace stands: the design\'s absent state', () => {
  const markup = html(run())
  assert.equal(loopOf(run()), undefined)
  assert.deepEqual(braces(markup), [])
  assert.doesNotMatch(markup, /tl-brace|data-loop/)
})

test('a loop the set carries stands over the marks with its words and down each track, at the window\'s own place', () => {
  const set = run({loop: {start: 200, end: 400}})
  const markup = html(set)
  const all = braces(markup)
  assert.equal(all.length, 3, 'one over the marks, one in each of the two tracks')
  assert.equal(all[0], '<i class="tl-brace" data-loop="ruler" style="left:20%;width:20%" role="img" aria-label="Loop · 200 – 400 · its owner&#x27;s; set it where its owner sets it"></i>')
  assert.deepEqual(all.slice(1), Array(2).fill('<i class="tl-brace" data-loop="lane" style="left:20%;width:20%" aria-hidden="true"></i>'))
  assert.match(markup, /class="tl-marks tl-window"[^>]*><i class="tl-brace" data-loop="ruler"/, 'the brace stands in the marks row, under its marks')
  assert.ok(markup.indexOf('data-loop="lane"') > markup.indexOf('data-track="a"'), 'and in the track\'s lane')
  // The ruler's own label words the loop's ends.
  const labelled = html({...set, ruler: {...set.ruler, label: at => `t${at}`}})
  assert.match(labelled, /aria-label="Loop · t200 – t400 · /)
})

test('zoomed, the brace follows the window: an end outside it draws no edge; a loop outside it draws none', () => {
  const set = run({loop: {start: 200, end: 400}})
  assert.match(html(set, {start: 300, end: 500}), /<i class="tl-brace" data-loop="ruler" data-cut-start="true" style="left:0%;width:50%"/)
  assert.match(html(set, {start: 100, end: 300}), /<i class="tl-brace" data-loop="ruler" data-cut-end="true" style="left:50%;width:50%"/)
  assert.deepEqual(braces(html(set, {start: 600, end: 800})), [], 'outside the window: none')
})

test('a set with no ruler lays its rows end to end, and the loop it carries stands in those units', () => {
  const set = {columns: [{id: 'p0', name: 'Scene 1'}, {id: 'p1', name: 'Scene 2'}], tracks: [{id: 'v', name: 'Field: visual', kind: 'expression-visual'}],
    clips: [{id: 's1', trackId: 'v', columnId: 'p0', label: 'one', span: {start: 0, end: 4}}, {id: 's2', trackId: 'v', columnId: 'p1', label: 'two', span: {start: 0, end: 4}}],
    loop: {start: 0, end: 8}}
  assert.match(html(set), /<i class="tl-brace" data-loop="ruler" style="left:0%;width:100%"/, 'the whole saved sequence')
})

test('the brace is drawn in shell tokens, quieter in the lanes, and takes no pointer: nothing sets a loop from here', () => {
  const brace = rule('.tl-brace')
  assert.match(brace, /background: color-mix\(in srgb, var\(--accent\) 16%, transparent\)/, 'dlw__arrangement-ruler.css .arp-brace')
  assert.match(brace, /border-left: 2px solid var\(--accent\); border-right: 2px solid var\(--accent\)/)
  assert.match(brace, /pointer-events: none/)
  assert.match(rule('.tl-brace[data-cut-start]'), /border-left-width: 0/)
  assert.match(rule('.tl-brace[data-cut-end]'), /border-right-width: 0/)
  assert.match(rule('.tl-body > .tl-brace'), /opacity: \.6/)
})

test('kept: the overview strip and its scale label, the window tools and the legend', () => {
  const markup = html(run({loop: {start: 200, end: 400}}), {start: 200, end: 400})
  assert.match(markup, /<div class="tl-lane tl-over" role="group" aria-label="The whole ruler, in seconds">/)
  assert.match(markup, /<span class="tl-scale">seconds<\/span><small>whole ruler<\/small>/)
  assert.match(markup, /class="tl-over-win" style="left:20%;width:20%"/)
  for (const tool of ['Zoom out', 'Zoom in', 'Fit the whole ruler']) assert.match(markup, new RegExp(`aria-label="${tool}"`))
  assert.match(markup, /<footer class="sg-legend tl-legend" aria-label="Legend">/)
})
