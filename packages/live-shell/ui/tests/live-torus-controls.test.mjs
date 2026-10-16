import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {register} from 'node:module'
import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'

// T-LIVE-TORUS-INSTRUMENT leg 3: the owner's determinant and presentation controls, reached through the hosted channel. The shell
// never writes the owner itself: each control sends one validated `instrument` stage command, and a refusal is named.
// Loader as live-torus-instrument.test.mjs.
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

const here = new URL('../src/', import.meta.url)
const torus = await import('../src/live/torusInstrument.ts')
const section = await import('../src/live/LiveInstrumentSection.tsx')
const torusDeviceModule = await import('../src/live/torusDevice.ts')
const panels = await import('../src/shell/panels.ts')
const qlNew = await import('../../../expressions-boundary/src/qlInstrumentReading.ts')
const qlOld = await import('../src/inhabitants/ql/qlInstrumentReading.ts')

const determinants = (over = {}) => ({lens: {lens12: 3, label: 'L1′'}, contextFrame: 2, harmonic: {selection: 'canonical-basis', index: 4}, rna: true, ...over})
const parameters = (over = {}) => ({muted: true, level: 1, scale: {unitsPerMetre: 120, mode: 'domain-follow'}, cadence: {rate: 1, playing: true, source: '1 tick/s'}, refusal: null, ...over})
const reading = (standing = 'following') => ({schema: 'ql.instrument-reading/v1', standing, reason: null,
  identity: {event_ref: 'controlled:occasion', subject_ref: 's', registry_revision: 'r', geometry_ref: 'g', material_ref: 'm', model_ref: 'd'}})
const okState = (standing = 'following', det = determinants(), par = parameters()) => ({ok: true, value: reading(standing), determinants: det, parameters: par})

// ── 1 — the owner's choices, as the Studio labels them ─────────────────────

test('the choices are the owner\'s: twelve lenses labelled as lensLabel, CF1–CF7, B1–B8 with Row, and the Studio cadence presets', () => {
  assert.equal(torus.LIVE_LENS_OPTIONS.length, 12)
  assert.deepEqual(torus.LIVE_LENS_OPTIONS.slice(0, 4).map(o => o.label), ['L0', 'L0′', 'L1', 'L1′'])
  assert.deepEqual(torus.LIVE_CONTEXT_FRAME_OPTIONS.map(o => o.label), ['CF1', 'CF2', 'CF3', 'CF4', 'CF5', 'CF6', 'CF7'])
  assert.equal(torus.LIVE_HARMONIC_OPTIONS.length, 9)
  assert.equal(torus.LIVE_HARMONIC_OPTIONS.at(-1).label, 'Row')
  assert.deepEqual(torus.LIVE_CADENCE_OPTIONS.map(o => o.value), ['hold', '1', '12'])
})

// ── 2 — the macro rows select the owner's values and send the owner's edits ──

test('each macro row selects the owner\'s current value and its edit sends that determinant', () => {
  const rows = torus.liveTorusMacroRows(okState())
  assert.deepEqual(rows.map(r => r.selected), ['3', '2', 'basis:4', 'RNA'])
  assert.deepEqual(rows[0].edit('7'), {kind: 'lens', lens12: 7})
  assert.deepEqual(rows[1].edit('5'), {kind: 'context-frame', context_frame: 5})
  assert.deepEqual(rows[2].edit('row'), {kind: 'harmonic', source: {selection: 'selected-source-row'}})
  assert.deepEqual(rows[2].edit('basis:0'), {kind: 'harmonic', source: {selection: 'canonical-basis', index: 0}})
  assert.deepEqual(rows[3].edit('DNA'), {kind: 'transcription', rna: false})
})

test('without owner determinants no macro has a selection to send', () => {
  for (const row of torus.liveTorusMacroRows(okState('following', null))) assert.equal(row.selected, null)
})

// ── 3 — writes go through the hosted channel, and a refusal is named, never thrown ──

test('with no mounted frame an instrument write settles as a named refusal, and nothing is posted', async () => {
  torus.setLiveInstrumentCommander(null)
  const result = await torus.commitLiveInstrumentEdit({kind: 'muted', muted: false})
  assert.deepEqual(result, {ok: false, error: 'No Expressions application is mounted for the live instrument'})
})

test('a mounted channel receives the one validated instrument command; the owner answer comes back as the result', async () => {
  const sent = []
  torus.setLiveInstrumentCommander(async command => { sent.push(command); return {ok: false, error: 'lens is already acting'} })
  const result = await torus.commitLiveInstrumentEdit({kind: 'lens', lens12: 3})
  torus.setLiveInstrumentCommander(null)
  assert.deepEqual(sent, [{command: 'instrument', edit: {kind: 'lens', lens12: 3}}])
  assert.deepEqual(result, {ok: false, error: 'lens is already acting'})
})

test('a synchronous refusal from the channel (a concealed frame) is a named result, never a throw into the control', async () => {
  torus.setLiveInstrumentCommander(() => { throw new Error('The requested application is concealed') })
  const result = await torus.commitLiveInstrumentEdit({kind: 'level', value: 2})
  torus.setLiveInstrumentCommander(null)
  assert.deepEqual(result, {ok: false, error: 'The requested application is concealed'})
})

test('the host registers its stage channel for the instrument writes, and nothing else writes the owner from the shell', async () => {
  const panel = await readFile(new URL('panels/expressions.tsx', here), 'utf8')
  assert.match(panel, /setLiveInstrumentCommander\(command => stageRun\(command\)\)/)
  const shellWrites = (await Promise.all(['live/LiveInstrumentSection.tsx', 'live/TorusOnChain.tsx', 'live/torusDevice.ts', 'live/torusInstrument.ts']
    .map(p => readFile(new URL(p, here), 'utf8')))).join('\n')
  assert.doesNotMatch(shellWrites, /\bcontroller\b|port\.request|host\.current|NativeFieldController/, 'the shell reaches the owner only through the hosted command')
})

// ── 4 — the device's macro controls: writable only in a writable owner state ──
// (the old LiveTorusWidget rack card's four <select>s are gone: the torus is a device of the runtime — live/torusDevice.ts, whose rows
// the frame's DeviceView draws as the owner's own enumerated choices on the chain, in the pool and in a pane)

test('the torus device offers the four owner choices while the owner is following, and disables them otherwise', () => {
  const live = torusDeviceModule.torusDevice(okState('following'))
  const macros = live.rows.filter(row => row.compact)
  assert.equal(macros.length, 4, 'the four determinants are the compact controls')
  assert.ok(macros.every(row => row.type === 'enumerated' && row.writePath === 'stage:instrument'), 'each is an enumerated row written through the stage channel')
  assert.deepEqual(macros.map(row => row.values.length), [12, 7, 9, 2], 'the choices are the owner\'s: twelve lenses, CF1–CF7, B1–B8 with Row, DNA or RNA')
  // The owner's other parameters follow, as the native field panel groups them (LiveInstrumentSection.tsx), never compact.
  assert.deepEqual(live.rows.filter(row => !row.compact).map(row => [row.key, row.group]), [['sound', 'Sound'], ['level', 'Sound'], ['cadence', 'Play'], ['scale', 'Scale']])
  const manual = torusDeviceModule.torusDevice(okState('manual'))
  assert.ok(manual.rows.every(row => !row.writePath && /only while the instrument follows or is held/.test(row.disclosure)), 'a manual instrument takes no edits, and says why')
})

// ── 5 — the expanded instrument in the browser pool: every parameter, grouped as the owner groups them ──

test('the expanded instrument shows the owner groups and every parameter, read from the same reading', () => {
  const markup = renderToStaticMarkup(createElement(section.LiveInstrumentSectionView, {state: okState('following')}))
  assert.match(markup, /data-live-instrument="following"/)
  for (const group of ['What is acting', 'Play', 'See and hear']) assert.match(markup, new RegExp(`aria-label="${group}"`))
  assert.equal((markup.match(/data-live-param="/g) || []).length, 4, 'the four determinants')
  assert.equal((markup.match(/aria-pressed=/g) || []).length, 3 + 1, 'three cadence presets and sound')
  assert.match(markup, /Level · presentation gain 1\.00×/)
  assert.match(markup, /Scale · units per metre 120 \(domain-follow\)/)
  assert.match(markup, /Live · sound off/)
})

test('the expanded instrument renders nothing without a reading, names a refused one, and names the owner\'s refusal', () => {
  assert.equal(renderToStaticMarkup(createElement(section.LiveInstrumentSectionView, {state: null})), '')
  const refused = renderToStaticMarkup(createElement(section.LiveInstrumentSectionView, {state: {ok: false, fault: 'parameters.level: expected 0..4'}}))
  assert.match(refused, /data-live-instrument="refused"/)
  const owner = renderToStaticMarkup(createElement(section.LiveInstrumentSectionView, {state: okState('following', determinants(), parameters({refusal: 'lens: L1′ is already acting'}))}))
  assert.match(owner, /The owner refused: lens: L1′ is already acting/)
})

test('the expanded instrument is registered in the Instruments section of the Live browser', () => {
  const registered = panels.getPanels('browser-section').find(p => p.id === 'Instruments')
  assert.ok(registered, 'the browser renders the section for its category')
  assert.equal(registered.navigation, false)
})

// ── 6 — the parser moved to the boundary; the old path is the same module ──

test('the QL instrument reader lives in the boundary package, and the live-shell path re-exports the same functions', () => {
  assert.equal(qlOld.parseQlInstrumentReading, qlNew.parseQlInstrumentReading)
  assert.equal(qlOld.QL_INSTRUMENT_PRESENTATION, qlNew.QL_INSTRUMENT_PRESENTATION)
})
