import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'

// The live-mode-place lane's tests: Live's PLACE in the mode system (rail
// order, grammar completeness) and its SURFACE at the measured density
// (designed empty states, read-only detail faces, status identity).
// Production sources in memory, same loader pattern as the sibling tests:
// .ts/.tsx transpiled, .css stubbed.
const root = new URL('../../../../', import.meta.url)
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

const {renderToStaticMarkup} = await import('react-dom/server')
const React = await import('react')
const {MODE_GRAMMAR, SURF_MODES, TRANSPORT_SLOT_IDS, slotMeaning, slotDataI} = await import('../src/shell/modeGrammar.ts')
const {ModeModeRail} = await import('../src/shell/ModeModeRail.tsx')
const {LiveSessionEmpty, LiveArrangementEmpty} = await import('../src/shell/live/LiveEmptyStates.tsx')
const {StatusBar} = await import('../src/components/StatusBar.tsx')
const {DeviceChainPanel} = await import('../src/components/DeviceChainPanel.tsx')

const htmlOf = element => renderToStaticMarkup(element)

// ————————————————————————————————————————————————————————————————————————
// Live's place in the rail (Rev 5: Session and Arrangement icons, then the
// mode icons with Live FIRST — the shell's base mode, restored).

test('Live is the FIRST mode icon of the rail, wearing the icon-cut waveform', () => {
  assert.equal(SURF_MODES[0], 'live')
  assert.equal(MODE_GRAMMAR.live.mark, 'live')
  assert.equal(MODE_GRAMMAR.live.title, 'Live')
  const html = htmlOf(React.createElement(ModeModeRail, {mode: 'live', chooseMode: () => {}}))
  const order = [...html.matchAll(/data-mode="([a-z]+)"/g)].map(match => match[1])
  assert.deepEqual(order, [...SURF_MODES], 'the rail renders the surf modes in Rev-5 order')
  assert.ok(html.indexOf('data-mode="live"') < html.indexOf('data-mode="base"'), 'Live stands before Base · Central')
  assert.match(html, /aria-pressed="true"[^>]*data-mode="live"|data-mode="live"[^>]*aria-pressed="true"/, 'the standing mode is pressed')
})

test('every other mode keeps Live\'s transport meanings as re-meanings, never re-layouts', () => {
  // Rev 5: the SAME slots in the SAME places; Live's column is the home
  // meaning. Whole column per mode is the mode-grammar suite's hold; here:
  // Live's own column is complete and every label/function pair is a real
  // data-i string (the F2 law).
  assert.deepEqual(MODE_GRAMMAR.live.transport.map(slot => slot.id), [...TRANSPORT_SLOT_IDS])
  for (const slot of MODE_GRAMMAR.live.transport) {
    assert.ok(slot.label.length > 0 && slot.fn.length > 0, `${slot.id} names its Live meaning`)
    assert.ok(slotDataI(slot).includes('|'), `${slot.id} carries the data-i pair`)
  }
  assert.equal(MODE_GRAMMAR.live.detail.clip.label, 'Clip')
  assert.equal(MODE_GRAMMAR.live.detail.device.label, 'Device')
})

// ————————————————————————————————————————————————————————————————————————
// The designed empty states (the widget law: framed grid + browser
// affordances visible, never sparse floats; structure, never set content).

test('Live · Session with no set: the framed clips-and-scenes grid, not a floating sentence', () => {
  const html = htmlOf(React.createElement(LiveSessionEmpty))
  assert.match(html, /data-live-empty="session"/)
  assert.match(html, /class="session-view live-empty"/, 'the presentation\'s own density classes')
  assert.match(html, /live-empty-disclosure/, 'the disclosure stands INSIDE the frame')
  assert.match(html, /Open a Live set from the <b>browser<\/b>/, 'the browser affordance is the named fill')
  assert.match(html, /class="track-header"/, 'track header columns are drawn')
  assert.match(html, /Main/, 'the Main scene rail is drawn')
  assert.match(html, /track-stop-row/, 'the stop row is drawn')
  const slots = [...html.matchAll(/class="clip-slot[^"]*"/g)]
  assert.ok(slots.length >= 5, 'clip slots drawn across the ready columns')
  assert.match(html, /Track 1/, 'structural track names (never set content)')
  assert.doesNotMatch(html, /view-empty/, 'the sparse float is gone')
})

test('Live · Arrangement with no set: overview ABOVE the ruler, framed lanes, honest disabled controls', () => {
  const html = htmlOf(React.createElement(LiveArrangementEmpty))
  assert.match(html, /data-live-empty="arrangement"/)
  assert.match(html, /class="arrange-view live-empty"/)
  const overviewAt = html.indexOf('arrange-overview')
  const rulerAt = html.indexOf('arrange-ruler-row')
  assert.ok(overviewAt > -1 && rulerAt > overviewAt, 'the integrated overview stands above the ruler (the measured Live structure)')
  assert.match(html, /the whole song draws here/, 'the overview names what fills it — no fabricated content')
  assert.match(html, /<button disabled="" title="Locators set when the document owner reads a set">Set<\/button>/, 'the locator affordance is drawn honest-disabled')
  assert.match(html, /Track 1/, 'ready lane labels')
})

// ————————————————————————————————————————————————————————————————————————
// The status identity (the commission: Live's status names the live work —
// the set/context — per presented presentation).

const baseState = (overrides = {}) => ({set: null, path: null, error: null, loading: false, open: () => {}, ...overrides})

test('Live\'s status line names the presented presentation and the live work', () => {
  const none = htmlOf(React.createElement(StatusBar, {state: baseState(), documentError: null, viewport: [1920, 1200], audio: true, mode: 'live', reading: null, detailMode: 'clip', changeDetailMode: () => {}, presentedView: 'session'}))
  assert.match(none, /<b>Session<\/b> — clips and scenes · no set open/, 'no set: the line says so and keeps the affordance')
  const withSet = htmlOf(React.createElement(StatusBar, {state: baseState({set: {path: '/Users/x/Mercurius.als', tracks: [], scene_count: 0, arrangement_clips: 0, tempo_bpm: 120}, path: '/Users/x/Mercurius.als'}), documentError: null, viewport: [1920, 1200], audio: true, mode: 'live', reading: null, detailMode: 'clip', changeDetailMode: () => {}, presentedView: 'session'}))
  assert.match(withSet, /<b>Session<\/b> — clips and scenes · \/Users\/x\/Mercurius\.als/, 'the set IS the named live work')
  const arranged = htmlOf(React.createElement(StatusBar, {state: baseState(), documentError: null, viewport: [1920, 1200], audio: true, mode: 'live', reading: null, detailMode: 'clip', changeDetailMode: () => {}, presentedView: 'arrangement'}))
  assert.match(arranged, /<b>Arrangement<\/b> — the song over time · no set open/, 'the identity follows the presented presentation')
})

// ————————————————————————————————————————————————————————————————————————
// The detail pair (the native-editor standard's compact face: the
// document's own names, lossless inline values, disclosed ranges — and the
// read-only law: nothing here writes).

const fakeCtx = {
  set: {path: '/x/set.als', tempo_bpm: 120, scene_count: 1, arrangement_clips: 0,
    tracks: [{kind: 'audio', name: 'Drums', devices: ['DrumRack', 'GlueCompressor']}]},
  loading: false, error: null, openSet: () => {},
}
const fakeDocument = {path: '/x/set.als', tempo: 120, scenes: 1, tracks: [{kind: 'audio', name: 'Drums', devices: [
  {name: 'DrumRack', params: [{id: 'Device Params/Drum Decay', value: '400 ms', min: '25 ms', max: '2 s'}]},
  {name: 'GlueCompressor', params: []},
], arrangementClips: [], sessionSlots: {}}]}

test('Device face: the document\'s own names, lossless values, disclosed ranges — read-only', () => {
  const html = htmlOf(React.createElement(DeviceChainPanel, {ctx: fakeCtx, document: fakeDocument, selection: {track: 0, scene: null}, mode: 'device'}))
  assert.match(html, /data-device-tile="DrumRack"/)
  assert.match(html, /Device Params\/Drum Decay/, 'the parameter keeps the document\'s own name — never a prettified fake label')
  assert.match(html, /value="400 ms"/, 'the lossless reading is the inline value')
  assert.match(html, /disclosed range 25 ms – 2 s/, 'the range shows only because the document discloses it')
  assert.match(html, /Lossless document reading · parameter editing awaits native owner/, 'the read-only law in the face')
  const inputs = [...html.matchAll(/<input[^>]*>/g)].map(input => input[0])
  assert.ok(inputs.length > 0)
  for (const input of inputs) assert.match(input, /readonly/, 'every value input is read-only')
  assert.match(html, /Glue Compressor[\s\S]*?class="device-empty"/, 'the parameterless device says the document discloses none')
})

test('Device face with an empty chain or no track: the designed empty frame, not a bare line', () => {
  const emptyChain = htmlOf(React.createElement(DeviceChainPanel, {ctx: fakeCtx, document: fakeDocument, selection: {track: 0, scene: null}, mode: 'device'}))
  assert.match(emptyChain, /data-detail-density="device"/)
  const noDevices = htmlOf(React.createElement(DeviceChainPanel, {ctx: {...fakeCtx, set: {...fakeCtx.set, tracks: [{kind: 'audio', name: 'Drums', devices: []}]}}, document: null, selection: {track: 0, scene: null}, mode: 'device'}))
  assert.match(noDevices, /data-detail-empty="device"/)
  assert.match(noDevices, /insertion awaits the device lane.*?s owner/, 'the empty frame names the owner that fills it')
  const noTrack = htmlOf(React.createElement(DeviceChainPanel, {ctx: {...fakeCtx, set: null}, document: null, selection: {track: 0, scene: null}, mode: 'device'}))
  assert.match(noTrack, /data-detail-empty="device"/)
})

test('Clip face with no selection: the designed empty frame naming what docks', () => {
  const html = htmlOf(React.createElement(DeviceChainPanel, {ctx: fakeCtx, document: fakeDocument, selection: {track: 0, scene: null}, mode: 'clip'}))
  assert.match(html, /data-detail-empty="clip"/)
  assert.match(html, /Clip/, 'the Rev-4 pair label')
  assert.match(html, /mode-detail-chip/, 'the chips name the faces that dock here')
  assert.doesNotMatch(html, /detail-no-selection/, 'the sparse float is gone')
})
