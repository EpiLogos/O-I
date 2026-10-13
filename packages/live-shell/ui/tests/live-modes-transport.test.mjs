import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'
import {renderToStaticMarkup} from 'react-dom/server'

// The Live transport's key / root / scale (T-LIVE-MODE-SCALES, leg 1): the
// slots read the mode in force from the kernel seam, and say so, rather than
// the older "not disclosed" line. Rendered from the real component.
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

const {TransportBar} = await import('../src/components/TransportBar.tsx')
const {LIVE_MODE_SEAM} = await import('../src/live/modes.ts')

function liveTransport() {
  return renderToStaticMarkup(TransportBar({
    tempoBpm: 120, name: 'Set', mode: 'live', setView: () => {}, chooseMode: () => {}, presentedView: 'session',
    centerPanels: [], activeCenter: null, openCenter: () => {}, browser: true, detail: true, dock: true,
    toggleBrowser: () => {}, toggleDetail: () => {}, toggleDock: () => {},
  }))
}

function selectTitle(markup, label) {
  const match = markup.match(new RegExp(`<select[^>]*aria-label="${label}"[^>]*title="([^"]*)"`))
  assert.ok(match, `the ${label} slot is drawn`)
  return match[1].replaceAll('&#x27;', "'").replaceAll('&amp;', '&')
}

test('the Live root and scale slots name the mode in force and its kernel seam, not "not disclosed"', () => {
  const markup = liveTransport()
  for (const label of ['Root note', 'Scale mode']) {
    const title = selectTitle(markup, label)
    assert.doesNotMatch(title, /not disclosed/, `${label} no longer reads as an undisclosed field`)
    assert.match(title, /Mode in force — waiting:/, `${label} says the mode in force is waiting`)
    assert.ok(title.includes('the kernel serves no mode catalogue to the shell'), `${label} names the seam`)
  }
  assert.match(selectTitle(markup, 'Root note'), /^Root — /, 'the root slot keeps its meaning')
  assert.match(selectTitle(markup, 'Scale mode'), /^Scale — /, 'the scale slot keeps its meaning')
})

test('the key slot and the set transport keep their established controls', () => {
  const markup = liveTransport()
  const key = markup.match(/<button[^>]*aria-label="Scale"[^>]*>/)
  assert.ok(key && /disabled=""/.test(key[0]), 'the key control is still drawn, disabled')
  assert.match(markup, /aria-label="Global quantization"/, 'the rest of the Live transport is unchanged')
  assert.match(markup, /data-i="Key\|/, 'the key slot keeps its data-i meaning')
})
