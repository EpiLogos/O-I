import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'

// Ticket C: the title line reads THE selection — the world · the day (the set's name in Live); every mode wears the mockup's
// words on its word-faced controls; Factory's key reads tokens in · out; Expressions' signature reads the field's hold share;
// Technē's clock carries the civil day; and the bar is the mockup's size. Channel: scripted (fixtures of the owners' shapes).
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
const h = React.createElement
const R = await import('../src/shell/transports/transportReadings.ts')
const {ModeTransport, MODE_TITLE} = await import('../src/shell/modeTransports.tsx')
const {SURF_MODES} = await import('../src/shell/modeGrammar.ts')
const {TransportTitle} = await import('../src/components/TransportBar.tsx')
const {ShellConfigContext} = await import('../src/shell/useSet.ts')
const {createTimeSpine} = await import('../src/timeline/timeSpine.ts')
const source = path => readFile(new URL(`../src/${path}`, import.meta.url), 'utf8')
const DAY = 'central:day:control:root:2026-10-08'
const spineAt = () => { const spine = createTimeSpine(); spine.readNow({instantUnixMs: Date.UTC(2026, 9, 8, 13, 37), dayRef: DAY, source: 'the kernel temporal read'}); return spine }
const text = markup => markup.replace(/<[^>]+>/g, '').replaceAll('&amp;', '&')

test('the title line reads THE selection — the world · the day, and the open set in Live', () => {
  assert.deepEqual(R.titleLine({line: 'selection', selection: {title: 'Bollingen · the stone carved'}, world: 'Central', civilDayRef: DAY}),
    {lead: 'Bollingen · the stone carved', absent: null, context: 'Central · 08 Oct'}, 'the mockup\'s own line')
  assert.deepEqual(R.titleLine({line: 'selection', selection: null, world: null, civilDayRef: null}), {lead: null, absent: 'Nothing selected', context: null})
  assert.equal(R.worldName('epi-logos', null), 'Epi-Logos')
  assert.equal(R.worldName(undefined, {world_scope: {owner: 'central', world: 'control:root', personal_ground: '/g'}}), 'Central', 'the host\'s World when the book names none')
  assert.equal(R.worldName(undefined, null), null)
  assert.deepEqual(MODE_TITLE, {live: 'set', base: 'selection', factory: 'selection', expressions: 'selection', techne: 'selection'})
  // The drawn line: with nothing selected it says so, then the World the host discloses and the day the spine's civil reading stands in.
  const config = {world_scope: {owner: 'central', world: 'control:root', personal_ground: '/g', workcell_ref: 'workcell:mac'}}
  const drawn = renderToStaticMarkup(h(ShellConfigContext.Provider, {value: config}, h(TransportTitle, {line: 'selection', timeSpine: spineAt()})))
  assert.match(drawn, /data-region="title-line"/)
  // Back and Forward stand at the line's head (manual §10.7): ‹ ›, then the line.
  assert.equal(text(drawn), '‹›Nothing selected — Central · 08 Oct')
  assert.match(drawn, /<span class="title-trail"><button type="button" aria-label="Back" disabled=""/, 'Back waits while the trail is empty')
  assert.match(drawn, /<span class="set-title-absent">Nothing selected<\/span>/)
  assert.equal(text(renderToStaticMarkup(h(TransportTitle, {line: 'selection', workName: 'A working inquiry'}))), '‹›A working inquiry', 'with no selection, the open work in front of you')
  assert.equal(text(renderToStaticMarkup(h(TransportTitle, {line: 'set', setName: 'Mercurius sketch'}))), '‹›Mercurius sketch — Live set')
})

test('the bar names no mode in its title: the line is the registration\'s', async () => {
  const bar = await source('components/TransportBar.tsx')
  assert.match(bar, /<TransportTitle line=\{MODE_TITLE\[surf\]\}/)
  assert.doesNotMatch(bar, /mode === 'live'/)
})

test('every mode wears the mockup\'s words on Link, Tap and the maps, and keeps the 28 slots', () => {
  const words = Object.fromEntries(SURF_MODES.map(mode => {
    const markup = renderToStaticMarkup(h(ModeTransport, {mode, reading: {tempoBpm: null}}))
    const face = id => markup.match(new RegExp(`<button[^>]*data-slot="${id}"[^>]*>([^<]*)<`))?.[1] ?? null
    return [mode, ['link', 'tap', 'key-map', 'midi-map'].map(face)]
  }))
  // Live's two map toggles read Key and MIDI (manual §10.1): one place each, never two that read the same.
  assert.deepEqual(words.base, ['Ground', 'Stamp', 'Key', 'MIDI'])
  assert.deepEqual(words.factory, ['Link', 'Tap', 'Key', 'MIDI'])
  assert.deepEqual(words.expressions, ['Link', 'Tap', 'Key', 'MIDI'])
  assert.deepEqual(words.techne.slice(0, 1), ['Link'], 'Technē\'s Tap is Back to Now, drawn as its own control over the spine')
  assert.deepEqual(words.live.slice(0, 2), ['Link', 'Tap'], 'Live\'s map slot holds its own KEY and MIDI toggles')
})

test('Factory\'s key reads tokens in · out, as the mockup\'s Σ 142k · 38k', () => {
  const read = R.tokenReadout('142000', '38000', 'session')
  assert.equal(read.value, 'Σ 142k · 38k'); assert.match(read.title, /142000 read and 38000 written in the session scope/)
  assert.equal(R.tokenReadout('—', '—', 'all').value, 'Σ — · —', 'unread stays unread')
})

test('Expressions\' signature is the field\'s hold share as the simplest ratio', () => {
  assert.equal(R.holdRatio(0.625), '5 : 3'); assert.equal(R.holdRatio(0.5), '1 : 1'); assert.equal(R.holdRatio(0.75), '3 : 1')
  assert.equal(R.holdRatio(0.5235), '52 : 48', 'no small ratio within half a percent: the shares')
  assert.equal(R.holdRatio(0), null); assert.equal(R.holdRatio(1), null); assert.equal(R.holdRatio(null), null)
})

test('Technē\'s clock carries the civil day the spine stands in, as the mockup\'s 14:37 · 08 Oct', () => {
  const now = {value: '14:37', title: 'Now — derived from the kernel\'s own temporal read'}
  const markup = renderToStaticMarkup(h(ModeTransport, {mode: 'techne', reading: {tempoBpm: null, timeSpine: spineAt(), readouts: {position: now}}}))
  assert.match(markup, /<output[^>]*data-slot="position"[^>]*>14:37 · 08 Oct<\/output>/)
  const unread = renderToStaticMarkup(h(ModeTransport, {mode: 'techne', reading: {tempoBpm: null, timeSpine: spineAt(), readouts: {position: {value: '—', title: 'no reading'}}}}))
  assert.match(unread, /<output[^>]*data-slot="position"[^>]*>—<\/output>/, 'no Now, no clock: the day alone is not the clock')
})

test('the bar is the mockup\'s size: a 14px title line over one row of 19–22px controls, 46px in all', async () => {
  const css = await source('styles.css')
  assert.match(css, /--transport-h:46px/)
  assert.match(css, /\.transport \{ margin:0 -6px; padding:2px 10px 5px;/)
  assert.match(css, /\.set-title \{ height:14px; line-height:14px;[^}]*font-size:11px/)
  assert.match(css, /\.transport \.surface-icons button \{ width:24px; height:22px \}/)
  assert.doesNotMatch(css, /native-transport-pins/, 'the retired pins strip no longer grows the bar')
  // 2 + 14 + 22 + 5 + 3 = 46: the controls row holds the 22px play row and surface icons.
  const transport = await source('frame/transport/transport.css')
  assert.match(transport, /\.native-control \{ height: 19px;/); assert.match(transport, /\.transport-btn \{ width: 20px; height: 22px/)
})
