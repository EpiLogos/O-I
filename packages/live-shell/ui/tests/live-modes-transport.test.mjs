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
    for(const suffix of ['.ts','.tsx','/index.ts','/index.tsx']){try{return await next(specifier+suffix,context)}catch{}}
    throw error;
  }
}
export async function load(url,context,next){
  if(url.endsWith('.css'))return {format:'module',shortCircuit:true,source:'export default null'};
  if(['.html','.svg','.png','.md'].some(ext=>url.split('?')[0].endsWith(ext))||url.endsWith('?raw'))return {format:'module',shortCircuit:true,source:'export default ""'};
  if(url.endsWith('.json'))return {format:'module',shortCircuit:true,source:'export default '+await readFile(new URL(url).pathname,'utf8')};
  if(url.endsWith('.ts')||url.endsWith('.tsx')){
    const source=await readFile(new URL(url).pathname,'utf8');
    const {outputText}=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX},fileName:url});
    return {format:'module',shortCircuit:true,source:outputText};
  }
  return next(url,context);
}`)}`, {parentURL: import.meta.url})

const {TransportBar} = await import('../src/components/TransportBar.tsx')
const {LIVE_MODE_SEAM} = await import('../src/live/modes.ts')
// A mode's bodies load when first drawn (shell/loadWhenDrawn.ts; O-I #740); a server render cannot wait for a module, so they are fetched first.
await (await import('../src/shell/loadWhenDrawn.ts')).loadEveryPart()

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
    assert.ok(title.includes('the kernel has not served the ql-mef mode_tonic_landscape catalogue yet'), `${label} names the seam`)
  }
  assert.match(selectTitle(markup, 'Root note'), /^Root — /, 'the root slot keeps its meaning')
  assert.match(selectTitle(markup, 'Scale mode'), /^Scale — /, 'the scale slot keeps its meaning')
})

test('the key slot and the set transport keep their established controls', () => {
  const markup = liveTransport()
  // F7: the one transport draws every slot in its place; the key slot is still a control, disabled until its owner writes.
  const key = markup.match(/<button[^>]*data-slot="key"[^>]*>/)
  assert.ok(key && /disabled=""/.test(key[0]), 'the key control is still drawn, disabled')
  assert.match(markup, /data-slot="quantize"/, 'the quantize slot stands in its place')
  assert.match(markup, /data-i="Key\|/, 'the key slot keeps its data-i meaning')
})

// O-I #849 round 21: the transport's Quantize and its signature are the set's (model.rs global_quantize and signature_of), read from it;
// a set that keeps none Live names stands at Live's own (1 bar, 4/4), as its launches and its ruler do; with no set open, Live's empty faces.
test('the Live transport\'s Quantize and signature are the open set\'s', () => {
  const render = extra => renderToStaticMarkup(TransportBar({
    tempoBpm: 120, name: 'Set', mode: 'live', setView: () => {}, chooseMode: () => {}, presentedView: 'session',
    centerPanels: [], activeCenter: null, openCenter: () => {}, browser: true, detail: true, dock: true,
    toggleBrowser: () => {}, toggleDetail: () => {}, toggleDock: () => {}, ...extra,
  }))
  const face = (markup, slot) => markup.match(new RegExp(`<output[^>]*data-slot="${slot}"[^>]*>([^<]*)</output>`))?.[1]
  // REPLACES (O-I #849 round 22, DLW build ruling 2026-11-05 "Quantize is written, not only shown"): face(read, 'quantize') === '1/4', the
  // set's Quantize as a readout. It is the transport's own choice now, showing the set's value.
  const quantizeOf = markup => {
    const select = markup.match(/<span class="transport-slot" data-slot="quantize"[^>]*><select aria-label="Quantize"([^>]*)>(.*?)<\/select>/s)
    return select && {disabled: /disabled=""/.test(select[1]), chosen: select[2].match(/<option value="([^"]*)" selected="">/)?.[1],
      words: [...select[2].matchAll(/<option value="([^"]*)"/g)].map(m => m[1])}
  }
  const read = render({setPath: '/sets/a.als', quantize: '1/4', signature: {numerator: 3, denominator: 4}})
  assert.deepEqual(quantizeOf(read), {disabled: false, chosen: '1/4', words: ['none', '8 bars', '4 bars', '2 bars', '1 bar', '1/2', '1/2t', '1/4',
    '1/4t', '1/8', '1/8t', '1/16', '1/16t', '1/32']})
  assert.equal(face(read, 'signature'), '3 / 4')
  assert.match(read, /data-slot="quantize"[^>]*title="Quantize — the set&#x27;s launch quantize[^"]*Choose another to write it in the set\."/)
  const kept = render({setPath: '/sets/a.als', quantize: null, signature: null})
  assert.deepEqual(quantizeOf(kept)?.chosen, '1 bar', 'a set that keeps none: Live\'s bar')
  assert.equal(quantizeOf(kept)?.disabled, true, 'and none to write')
  assert.equal(face(kept, 'signature'), '4 / 4')
  const none = liveTransport()
  assert.equal(face(none, 'signature'), '— / —', 'no set open: Live\'s empty face')
  assert.doesNotMatch(none, /<output[^>]*data-slot="quantize"/)
  assert.equal(quantizeOf(none), null, 'no set open: nothing to write')
})

// O-I #849 round 22 (DLW build ruling 2026-11-05: "the transport sets the set's global quantization through live-set's own act"): a choice
// is written by the set's owner as `global_quantize` (live-set acts.rs), and a refusal comes back in its words.
test('the transport writes the set\'s Quantize through the set\'s own act, and says a refusal in its words', async () => {
  const {writeSetQuantize, QUANTIZE_NOT_WRITTEN} = await import('../src/shell/transports/useLiveTransport.tsx')
  const {refusalWords} = await import('../../../../desktop/cradle/src/shared/Refusal.tsx')
  const {SET_QUANTIZE_WORDS} = await import('../src/live/clipPlayer.ts')
  const asked = []
  assert.deepEqual(await writeSetQuantize('/sets/a.als', '1/16', async (path, act) => { asked.push([path, act]); return {act: 'global_quantize'} }), {written: true})
  assert.deepEqual(asked, [['/sets/a.als', {kind: 'global_quantize', quantize: '1/16'}]])
  const refused = await writeSetQuantize('/sets/a.als', '1/16', async () => { throw new Error('The set keeps no transport Quantize to set') })
  assert.equal(refused.cause.message, 'The set keeps no transport Quantize to set', 'the owner\'s answer, as it came')
  assert.equal(refusalWords(QUANTIZE_NOT_WRITTEN, refused.cause), 'The set\'s Quantize was not written. The set keeps no transport Quantize to set.')
  const {readFile} = await import('node:fs/promises')
  const source = await readFile(new URL('../src/shell/transports/useLiveTransport.tsx', import.meta.url), 'utf8')
  assert.match(source, /onChange=\{event => write\(event\.target\.value\)\}/)
  assert.match(source, /void writeSetQuantize\(path, word\)/)
  // The line says it through shared/Refusal.tsx: the place's words, then the owner's plain words; the raw answer never stands open.
  assert.match(source, /title=\{refusalWords\(QUANTIZE_NOT_WRITTEN, writing\.cause\)\}>\{refusalWords\(QUANTIZE_NOT_WRITTEN, writing\.cause\)\}<\/output>/)
  // The words are the set's own, Live's GlobalQuantisation order: live-set edit.rs QUANTIZE after its Global.
  const rust = await readFile(new URL('../../../live-set/src/edit.rs', import.meta.url), 'utf8')
  const live = rust.match(/pub const QUANTIZE: &\[&str\] = &\[([^\]]*)\]/)[1].match(/"([^"]*)"/g).map(w => w.slice(1, -1))
  assert.deepEqual([...SET_QUANTIZE_WORDS], live.slice(1))
})
