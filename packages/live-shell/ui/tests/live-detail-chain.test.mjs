import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'

// Live's Device side at the mockup's floor (ticket D; DEVICE-SEMANTICS-LOCK §0.2; manual §3, §10.4): a row of plates through the
// one device runtime — the keyboard, the note devices, the M1 torus, then the selected track's own devices — under the host's
// one head and ending in its drop zone; while something is not there yet, one line in the host's waiting idiom. Rendered
// headless from fixture readings (scripted). Loader as detail-host.test.mjs.
const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};
import {readFile} from 'node:fs/promises';
export async function resolve(s, c, n) {
  let r = null
  try { r = await n(s, c) } catch (e) { if (!s.startsWith('.')) throw e }
  if (r) {
    if (r.url.endsWith('.html') || r.url.endsWith('.css')) return {...r, format: 'module'}
    return r
  }
  if (s.endsWith('.js')) { try { return await n(s.slice(0, -3) + '.ts', c) } catch {} }
  for (const x of ['.ts', '.tsx']) { try { return await n(s + x, c) } catch {} }
  for (const x of ['/index.ts', '/index.tsx']) { try { return await n(s + x, c) } catch {} }
  throw new Error('cannot resolve ' + s)
}
export async function load(u, c, n) {
  if (u.endsWith('.css')) return {format: 'module', shortCircuit: true, source: 'export {}'};
  if (u.includes('?raw') || u.includes('.html')) return {format: 'module', shortCircuit: true, source: 'export default ""'};
  if (u.endsWith('.json')) return {format: 'module', shortCircuit: true, source: 'export default ' + await readFile(new URL(u), 'utf8')};
  if (!u.endsWith('.ts') && !u.endsWith('.tsx')) return n(u, c);
  return {format: 'module', shortCircuit: true, source: ts.transpileModule(await readFile(new URL(u), 'utf8'), {fileName: new URL(u).pathname,
    compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX}}).outputText};
}`)}`, import.meta.url)

globalThis.document = {getElementById: () => null, createElement: () => ({}), head: {appendChild: () => {}}}
const {createElement} = await import('react')
const {renderToStaticMarkup} = await import('react-dom/server')
const {readFile} = await import('node:fs/promises')
const chain = await import('../src/components/DeviceChainPanel.tsx')
const devices = await import('../src/live/liveChainDevices.ts')
const torus = await import('../src/live/torusInstrument.ts')
const hold = await import('../src/live/noteDevices/noteDeviceHold.ts')
const {MODE_DETAILS} = await import('../src/shell/modeDetails.tsx')
const {DetailHost} = await import('../src/frame/detail/DetailHost.tsx')
const {DetailContext} = await import('../src/frame/detail/detailReading.ts')

// Fixture readings: a set as the owner's summary and deep document give it.
export const SET = {path: '/sets/mercurius.als', tempo_bpm: 120, scene_count: 2, arrangement_clips: 1, tracks: [
  {kind: 'midi', name: 'Torus', devices: ['GlueCompressor', 'PluginDevice', 'Reverb']},
  {kind: 'audio', name: 'Voice', devices: []},
]}
export const DOC = {path: '/sets/mercurius.als', tempo: 120, scenes: 2, tracks: [
  {kind: 'midi', name: 'Torus', arrangementClips: [{name: 'Swell', kind: 'midi', start: 8, end: 24}], sessionSlots: {0: 'Kit 1', 1: null}, devices: [
    {name: 'GlueCompressor', params: [{id: 'Threshold', value: '-12.5', min: '-40', max: '0'}, {id: 'Ratio', value: '1'}, {id: 'Attack', value: '2'}, {id: 'Makeup', value: '2.25'}, {id: 'DryWet', value: '1'}]},
    {name: 'PluginDevice', params: [{id: 'Gain', value: '0.7943282127', min: '0', max: '1'}]},
    {name: 'Reverb', params: [{id: 'DecayTime', value: '2400'}, {id: 'DryWet', value: '0.22'}]},
  ]},
  {kind: 'audio', name: 'Voice', arrangementClips: [], sessionSlots: {0: 'Take 3'}, devices: []},
]}
const OWNER = {ok: true, determinants: null, value: {schema: 'ql.instrument-reading/v1', standing: 'following', identity: {event_ref: 'event:chain'}},
  parameters: {muted: true, level: 1, scale: {unitsPerMetre: 120, mode: 'domain-follow'}, cadence: null, refusal: null}}
const panel = (ctx, selection = {track: 0, scene: null}, document = null) => renderToStaticMarkup(createElement(chain.DeviceChainPanel, {ctx, document, selection, mode: 'device'}))
const at = (markup, needle) => { const index = markup.indexOf(needle); assert.ok(index >= 0, `${needle} is on the chain`); return index }
const withInstrument = run => { torus.publishLiveTorusState(OWNER); try { return run() } finally { torus.publishLiveTorusState(null); hold.resetNoteDeviceChain() } }

test('empty: the chain is one line saying what it waits for — no card, no chips, no head of its own', () => {
  const markup = panel({set: null, loading: false, error: null})
  assert.match(markup, /<p class="live-chain-waits" role="status" data-live-chain-waits="true">The torus joins the chain when its owner publishes a reading; open a set to bring a track&#x27;s devices here\.<\/p>/)
  for (const gone of [/data-detail-empty/, /mode-detail-chip/, /mode-detail-frame/, /Device tiles/, /Parameter faces/, /Enable state/, /<header/]) assert.doesNotMatch(markup, gone)
  assert.doesNotMatch(markup, /class="device /, 'no plate stands while nothing is there')
})

test('the instrument published, no set: keyboard, note devices, torus, in the order the notes pass — each a plate of the runtime — then the line', () => withInstrument(() => {
  hold.addNoteDevice('scale')
  const markup = panel({set: null, loading: false, error: null})
  const keys = at(markup, 'data-chain-instrument="live:keyboard"'), note = at(markup, 'data-note-device="scale"'), ring = at(markup, 'data-live-torus=')
  const line = at(markup, 'data-live-chain-waits')
  assert.ok(keys < note && note < ring && ring < line, 'keyboard → note devices → torus, the line where the track would stand')
  assert.equal((markup.match(/data-device-size="compact"/g) ?? []).length, 3, 'three plates, every one the runtime\'s compact size')
  assert.match(markup, /Open a set to bring a track&#x27;s devices here\./)
  assert.match(markup, /data-janko-layout="janko"/, 'the keyboard\'s picture is the playing surface')
  assert.doesNotMatch(markup, /class="janko-head"|class="janko-hint"/, 'the plate holds its name and its layout; the surface stands bare')
}))

test('a set open: the selected track\'s own devices stand after the torus, one plate each, read losslessly and read-only', () => withInstrument(() => {
  const markup = panel({set: SET, loading: false, error: null}, {track: 0, scene: null}, DOC)
  const ring = at(markup, 'data-live-torus=')
  const order = ['GlueCompressor', 'PluginDevice', 'Reverb'].map(name => at(markup, `data-chain-device="${name}"`))
  assert.ok(ring < order[0] && order[0] < order[1] && order[1] < order[2], 'effects after the torus, in track order')
  assert.match(markup, /0\.7943282127/, 'the document\'s value, as stored')
  assert.match(markup, /data-device="live:set\/0\/1"[^>]*data-device-light="unknown"/, 'its enable state is not disclosed: the light stays dark')
  assert.doesNotMatch(markup, /data-live-chain-waits/, 'nothing waits once a track is under the selection')
  assert.doesNotMatch(markup, /<input[^>]*readonly/i, 'no text field poses as a parameter')
  const voice = panel({set: SET, loading: false, error: null}, {track: 1, scene: null}, DOC)
  assert.doesNotMatch(voice, /data-chain-device=/, 'a track with no devices: the torus, then the host\'s drop zone')
}))

test('the torus not yet published, a track selected: the line first, then the track\'s devices', () => {
  const markup = panel({set: SET, loading: false, error: null}, {track: 0, scene: null}, DOC)
  assert.ok(at(markup, 'data-live-chain-waits') < at(markup, 'data-chain-device="GlueCompressor"'))
  assert.match(markup, /The torus joins the chain when its owner publishes a reading\./)
  assert.doesNotMatch(markup, /data-chain-instrument|data-note-device=/, 'the keyboard and the note devices stand with the torus they feed')
})

test('a set being read, or refused: the line says so in the owner\'s words', () => withInstrument(() => {
  assert.match(panel({set: null, loading: true, error: null}), /The set is being read\./)
  assert.match(panel({set: null, loading: false, error: 'no such file'}), /The set did not open: no such file\./)
}))

test('a device with the owner\'s stored-parameter table: its rows are the table\'s, its values the stored ones, and every change is the owner\'s write', async () => {
  const table = [
    {id: 'Threshold', ui_name: 'Threshold', stored_min: -40, stored_max: 0, unit: 'dB', kind: 'continuous', notes: ''},
    {id: 'Ratio', ui_name: 'Ratio', stored_min: 0, stored_max: 2, unit: '', kind: 'discrete', labels: ['2', '4', '10'], notes: ''},
    {id: 'Attack', ui_name: 'Attack', stored_min: 0, stored_max: 6, unit: 'ms', kind: 'discrete', labels: ['0.01', '0.1', '0.3', '1', '3', '10', '30'], notes: ''},
    {id: 'Makeup', ui_name: 'Makeup', stored_min: 0, stored_max: 20, unit: 'dB', kind: 'continuous', notes: ''},
    {id: 'Range', ui_name: 'Range', stored_min: 0, stored_max: 70, unit: 'dB', kind: 'continuous', notes: ''},
    {id: 'DryWet', ui_name: 'Dry/Wet', stored_min: 0, stored_max: 1, unit: '', kind: 'continuous', notes: ''},
    {id: 'PeakClipIn', ui_name: 'Soft clip', stored_min: 0, stored_max: 1, unit: '', kind: 'toggle', notes: ''},
    {id: 'On', ui_name: 'On', stored_min: 0, stored_max: 1, unit: '', kind: 'toggle', notes: ''},
  ]
  const writes = []
  const device = devices.setDeviceFaced({id: 'live:set/0/0', elementName: 'GlueCompressor', title: 'Glue Compressor', descriptors: table,
    stored: {Threshold: '-12.5', Ratio: '1', Attack: '2', Makeup: '2.25', DryWet: '1', PeakClipIn: 'false', On: 'true'},
    write: async (id, value) => { writes.push([id, value]) }})
  assert.deepEqual(device.rows.map(row => row.type), ['number', 'enumerated', 'enumerated', 'number', 'number', 'number', 'boolean', 'boolean'])
  assert.ok(device.rows.every(row => row.writePath === 'kernel:live_device_param_write'), 'each row is the owner\'s own write')
  assert.deepEqual(device.rows.filter(row => row.compact).map(row => row.key), ['Threshold', 'Makeup', 'Range', 'DryWet'], 'the plate shows the first four knobs; the pool shows every row')
  assert.deepEqual(device.values, {Threshold: -12.5, Ratio: '4', Attack: '0.3 ms', Makeup: 2.25, DryWet: 1, PeakClipIn: false, On: true})
  assert.equal(device.enabledKey, 'On', 'the light reads the device\'s own On parameter')
  assert.equal(device.rows.find(row => row.key === 'Range').disclosure, 'Not stored in this document: the set carries no “Range” element to edit.', 'a value the document does not carry stays dark and says why')
  await device.submit([{key: 'Ratio', value: '10'}, {key: 'Threshold', value: -20}, {key: 'On', value: false}])
  assert.deepEqual(writes, [['Ratio', 2], ['Threshold', -20], ['On', false]], 'a choice is written as its stored index, as the panel wrote it')
  await assert.rejects(device.submit([{key: 'Ratio', value: '7'}]), /not one of Ratio's stored choices/)
})

test('a note device: its tie and power write the session hold, what it does to the notes is read from the mode in force', async () => {
  const calls = []
  const scale = {id: 'note-device-9', kind: 'scale', enabled: true, params: {tie: 'up'}}
  const waiting = {state: 'waiting', selection: null, line: 'No mode is in force.'}
  const device = devices.noteDevice(scale, waiting, {setTie: (id, tie) => calls.push(['tie', id, tie]), setPower: (id, on) => calls.push(['power', id, on])})
  assert.equal(device.id, 'live:note/note-device-9')
  assert.equal(device.values.notes, 'pass through')
  assert.match(device.rows.find(row => row.key === 'notes').disclosure, /^Passes notes through\./, 'the whole line stands behind the word')
  assert.equal(device.rows.find(row => row.key === 'kept').disclosure, devices.NOTE_DEVICE_KEPT)
  assert.deepEqual(device.rows.filter(row => row.compact).map(row => row.key), ['tie', 'notes'])
  await device.submit([{key: 'tie', value: 'Down'}, {key: 'enabled', value: false}])
  assert.deepEqual(calls, [['tie', 'note-device-9', 'down'], ['power', 'note-device-9', false]])
  assert.equal(devices.noteDeviceReading({...scale, enabled: false}, waiting).word, 'bypassed')
})

test('the keyboard\'s one control is its layout, held by its plate', async () => {
  let chosen = null
  const keys = devices.keyboardDevice('janko', layout => { chosen = layout })
  assert.deepEqual(keys.values, {layout: 'Jankó'})
  await keys.submit([{key: 'layout', value: 'Piano'}])
  assert.equal(chosen, 'piano')
})

test('the head names the track and its devices in order (the mockup\'s "Drums — Drum Rack → Glue Compressor → Reverb"), read from the open set alone', () => withInstrument(() => {
  hold.addNoteDevice('scale')
  const reading = (set, track = 0) => ({mode: 'live', live: {ctx: {set, loading: false, error: null}, document: DOC, selection: {track, scene: null}}})
  const none = {ref: null, clip: null, track: null, set: null}
  assert.deepEqual(MODE_DETAILS.live.head.device({detail: reading(SET), selected: none, instrument: null}),
    {name: 'Torus', line: 'Glue Compressor → Plug-in → Reverb'}, 'the plate titles; the instrument\'s own plates stand in the row, never named from a stale read')
  assert.deepEqual(MODE_DETAILS.live.head.device({detail: reading(SET, 1), selected: none, instrument: null}), {name: 'Voice'}, 'a track with no devices: its name alone')
  assert.deepEqual(MODE_DETAILS.live.head.device({detail: reading(null), selected: none, instrument: null}), {name: 'No track selected'})
}))

test('in the host: one head over the row, the plates, and the drop zone the registration names', () => withInstrument(() => {
  const detail = {mode: 'live', transport: {kind: 'unavailable'}, world: null, worldCut: false, centralSubject: null, native: {}, factory: {tracks: [], task: {taskLabel: null}},
    focusedInstrument: null, live: {ctx: {set: SET, loading: false, error: null, openSet() {}}, document: DOC, selection: {track: 0, scene: null}}}
  const markup = renderToStaticMarkup(createElement(DetailContext.Provider, {value: detail}, createElement(DetailHost, {side: 'device'})))
  assert.equal((markup.match(/class="detail-head"/g) ?? []).length, 1, 'one head')
  assert.match(markup, /<header class="detail-head"[^>]*><b>Torus<\/b><span class="detail-head-line"> — Glue Compressor → Plug-in → Reverb<\/span><\/header>/)
  assert.ok(at(markup, 'data-chain-device="Reverb"') < at(markup, '<div class="dropz">Drop an instrument or effect here</div>'), 'the chain ends in the drop zone')
}))

test('code-reading: the chain draws through the runtime, holds no mode branch, and the panel is the registration\'s thin pair', async () => {
  const sources = await Promise.all(['live/LiveDeviceChain.tsx', 'live/SetDeviceOnChain.tsx', 'live/KeyboardOnChain.tsx', 'live/noteDevices/NoteDeviceChain.tsx', 'live/liveChainDevices.ts', 'live/LiveClip.tsx', 'components/DeviceChainPanel.tsx']
    .map(file => readFile(new URL(`../src/${file}`, import.meta.url), 'utf8')))
  for (const source of sources) {
    assert.doesNotMatch(source, /[!=]==\s*'(live|base|central|factory|expressions|techne|audio)'/, 'no mode branch')
    assert.doesNotMatch(source, /#[0-9a-fA-F]{3,8}\b(?![^\n]*\/\/)/, 'shell tokens only')
  }
  for (const plate of sources.slice(1, 4)) assert.match(plate, /<DeviceView /, 'every plate is the runtime\'s DeviceView')
  assert.doesNotMatch(sources[6], /DetailEmptyFrame|mode-detail-chip|clip-inspector|note-editor/)
})
