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
const {liveSetTrackAdapter} = await import('../src/timeline/liveSetTrackAdapter.ts')
const {TracksPane} = await import('../src/frame/tracks/TracksPane.tsx')
const paneHost = await import('../src/projections/timelinePaneHost.ts')
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
// The designed empty states (the widget law: a framed grid, never a sparse
// float; structure, never set content). Live's own empty Session and
// Arrangement (shell/live/LiveEmptyStates.tsx) stood inside the retired
// SessionView and ArrangementView and were deleted with them on 15 Oct
// (FOUNDATION §7): the one Session grid and Arrangement ruler draw Live's
// empty set now, over Live's own adapter, in the tracks pane the App
// publishes Live's reading to.
const noSet = liveSetTrackAdapter.project({set: null, document: null})
const liveWithNoSet = {mode: 'live', set: null, document: null, selection: {track: 0, scene: null}, select() {}, colors: [], setColor() {},
  session: undefined, arrangement: undefined, selectTrackItem() {}, waiting: 'Open a Live set from the browser to see its tracks.'}
const paneOf = presentation => {
  paneHost.publishTimelineReading(liveWithNoSet)
  paneHost.setTimelinePanePresentation(presentation)
  return htmlOf(React.createElement(TracksPane))
}
/** The reason the empty frame states, as drawn (its words are the pane's; that they are there is the law). */
const dropReason = html => html.match(/<div class="sg-drop" role="status">([^<]+)<\/div>/)?.[1]

test('Live · Session with no set: the framed grid — the stops down the right and the drop area with the reason, not a floating sentence', () => {
  assert.deepEqual(noSet, {columns: [], tracks: [], clips: []}, 'Live\'s adapter reads no set as no tracks, invents none')
  const html = paneOf('session')
  assert.match(html, /data-tracks-mode="live"/)
  assert.match(html, /data-tracks-view="session" data-empty="true"/)
  assert.match(html, /role="grid" aria-label="Session"/, 'the grid frame stands')
  assert.ok(dropReason(html), 'a reason stands inside the frame, where the tracks will stand')
  assert.match(html, /aria-label="Stops"><div class="thd">Main<\/div>/, 'the Main stop column is drawn')
  assert.equal((html.match(/class="stop-launch" disabled=""/g) ?? []).length, 8, 'eight stops, as a new Live set has, none launchable')
  assert.doesNotMatch(html, /view-empty/, 'the sparse float is gone')
})

test('Live · Arrangement with no set: the ruler stands above the lane area, with the reason in it', () => {
  const html = paneOf('arrangement')
  assert.match(html, /aria-label="Arrangement" data-tracks-view="arrangement" data-empty="true"/)
  const rulerAt = html.indexOf('class="tl-ruler"')
  const dropAt = html.indexOf('class="sg-drop"')
  assert.ok(rulerAt > -1 && dropAt > rulerAt, 'the ruler stands above the lane area')
  assert.equal((html.match(/<span (class="end" )?style="left:/g) ?? []).length, 9, 'the ruler carries its marks')
  assert.ok(dropReason(html), 'the reason stands in the lane area')
  paneHost.setTimelinePanePresentation('session')
})

// ————————————————————————————————————————————————————————————————————————
// The status identity (the commission: Live's status names the live work —
// the set/context — per presented presentation).

const baseState = (overrides = {}) => ({set: null, path: null, error: null, loading: false, open: () => {}, ...overrides})

test('Live\'s identity is the title line\'s: the open set by name, and the status bar reads the Info view and the set\'s counts', async () => {
  // Ticket C: the mockup draws the work's identity in the title line ("Mercurius sketch — Live set"), and the status bar's left
  // is the Info view. The identity line that stood in the status bar moved to the title line (components/TransportBar.tsx).
  // (The line's markup is pinned in transport-readings-modes.test.mjs; its words are these.)
  const {titleLine} = await import('../src/shell/transports/transportReadings.ts')
  assert.deepEqual(titleLine({line: 'set', setName: 'Mercurius'}), {lead: 'Mercurius', absent: null, context: 'Live set'})
  assert.deepEqual(titleLine({line: 'set', setName: ''}), {lead: null, absent: 'No set open', context: 'Live set'}, 'no set: the line says so')
  const none = htmlOf(React.createElement(StatusBar, {state: baseState(), documentError: null, viewport: [1920, 1200], audio: true, mode: 'live', reading: null, detailMode: 'clip', changeDetailMode: () => {}, presentedView: 'session'}))
  assert.match(none, /data-region="info-view"[^>]*><b>Info<\/b>Hover anything to read what it does\.</)
  const withSet = htmlOf(React.createElement(StatusBar, {state: baseState({set: {path: '/Users/x/Mercurius.als', tracks: [], scene_count: 0, arrangement_clips: 0, tempo_bpm: 120}, path: '/Users/x/Mercurius.als'}), documentError: null, viewport: [1920, 1200], audio: true, mode: 'live', reading: null, detailMode: 'clip', changeDetailMode: () => {}, presentedView: 'session'}))
  assert.match(withSet, /title="\/Users\/x\/Mercurius\.als">0 tracks · 0 scenes · 0 clips</, 'the set\'s counts carry its path')
  const failed = htmlOf(React.createElement(StatusBar, {state: baseState({error: 'no such set'}), documentError: null, viewport: [1920, 1200], audio: true, mode: 'live', reading: null, detailMode: 'clip', changeDetailMode: () => {}, presentedView: 'arrangement'}))
  assert.match(failed, /class="statusbar-error"[^>]*>Open failed: no such set</, 'an open failure is still read in the bar')
})

// ————————————————————————————————————————————————————————————————————————
// The detail pair (the native-editor standard's compact face: the
// document's own names, lossless inline values, disclosed ranges — and the
// read-only law: nothing here writes).

const fakeCtx = {
  set: {path: '/x/set.als', tempo_bpm: 120, scene_count: 1, arrangement_clips: 0,
    tracks: [{kind: 'audio', name: 'Drums', devices: ['DrumRack', 'Saturator']}]},
  loading: false, error: null, openSet: () => {},
}
const fakeDocument = {path: '/x/set.als', tempo: 120, scenes: 1, tracks: [{kind: 'audio', name: 'Drums', devices: [
  {name: 'DrumRack', params: [{id: 'Device Params/Drum Decay', value: '400 ms', min: '25 ms', max: '2 s'}]},
  {name: 'Saturator', params: []},
], arrangementClips: [], sessionSlots: {}}]}

test('Device face: the document\'s own names, lossless values, disclosed ranges — read-only, each device a plate of the runtime', () => {
  const html = htmlOf(React.createElement(DeviceChainPanel, {ctx: fakeCtx, document: fakeDocument, selection: {track: 0, scene: null}, mode: 'device'}))
  // live/SetDeviceOnChain.tsx: a device with no stored-parameter table reads the deep document (was the read-only tile).
  assert.match(html, /data-chain-device="DrumRack" data-set-device="reading"/)
  assert.match(html, /data-param="Device Params\/Drum Decay"/, 'the parameter keeps the document\'s own name — never a prettified fake label')
  assert.match(html, /<span class="sdk-chip">400 ms<\/span>/, 'the lossless reading is the value shown')
  assert.match(html, /disclosed range 25 ms – 2 s/, 'the range shows only because the document discloses it')
  assert.match(html, /lossless document reading[^"]*editing awaits the native device owner/, 'the read-only law in the face')
  assert.doesNotMatch(html, /<input/, 'a reading is a reading row, never a text field')
  assert.match(html, /data-chain-device="Saturator"[\s\S]*?No parameters disclosed by the native document/, 'the parameterless device says the document discloses none')
})

test('Device face with an empty chain or no track: one line in the host\'s waiting idiom, never a card', () => {
  const noDevices = htmlOf(React.createElement(DeviceChainPanel, {ctx: {...fakeCtx, set: {...fakeCtx.set, tracks: [{kind: 'audio', name: 'Drums', devices: []}]}}, document: null, selection: {track: 0, scene: null}, mode: 'device'}))
  assert.match(noDevices, /data-detail-density="device"/)
  assert.doesNotMatch(noDevices, /data-chain-device=|data-detail-empty|mode-detail-chip/, 'a track with no devices: the host\'s drop zone speaks')
  assert.match(noDevices, /The torus joins the chain when its owner publishes a reading\./, 'what the chain still waits for, once')
  const noTrack = htmlOf(React.createElement(DeviceChainPanel, {ctx: {...fakeCtx, set: null}, document: null, selection: {track: 0, scene: null}, mode: 'device'}))
  assert.match(noTrack, /open a set to bring a track&#x27;s devices here\./)
  assert.doesNotMatch(noTrack, /data-detail-empty/)
})

test('Clip face with no selection: one line in the host\'s waiting idiom, nothing under it', () => {
  const html = htmlOf(React.createElement(DeviceChainPanel, {ctx: fakeCtx, document: fakeDocument, selection: {track: 0, scene: null}, mode: 'clip'}))
  assert.equal(html, '<p class="clip-empty" role="status">Select a clip in the Session or the Arrangement to see it here.</p>')
  assert.doesNotMatch(html, /mode-detail-chip|data-detail-empty|detail-no-selection/, 'no card, no chips, no float')
})
