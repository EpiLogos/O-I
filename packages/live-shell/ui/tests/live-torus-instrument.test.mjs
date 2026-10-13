import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {register} from 'node:module'
import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'

// T-LIVE-TORUS-INSTRUMENT leg 1 — Live mode seats the one instrument, the M1 torus
// (DEVICE-SEMANTICS-LOCK §0.2, §2.1). The shell holds ONE reading handle; the rack
// widget and the Live device chain read it. The simulation itself runs in the
// hosted Expressions frame (field-studies-journeys native-field), so the shell
// never draws a second torus: it shows only what the owner reading carries.
// Same in-memory TS loader as devices-panels-ssr.test.mjs.

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
const widget = await import('../src/panels/devices/LiveTorusWidget.tsx')
const manifest = await import('../src/inhabitants/quaternalLogicFamilyManifest.ts')
const qlReading = await import('../src/inhabitants/ql/qlInstrumentReading.ts')
const chain = await import('../src/components/DeviceChainPanel.tsx')

// A reading shaped exactly as the owner produces it (ql-musical-family.test.mjs fixture).
const ownerReading = () => ({
  schema: 'ql.instrument-reading/v1',
  standing: 'following',
  reason: null,
  identity: {
    event_ref: 'controlled:occasion', subject_ref: 'controlled:subject',
    registry_revision: 'controlled:registry', geometry_ref: 'controlled:geometry',
    material_ref: 'controlled:material', model_ref: 'controlled:model',
  },
  acknowledged: {generation: '4', samples_elapsed: '245760'},
  presented: {generation: '4', samples_elapsed: '245760'},
  audio: {
    schema: 'ql.native-audio-receipt/v1', device_epoch: 0, device_sample_rate: 48000,
    native_origin: '0', context_origin_seconds: 0.5, observed_context_seconds: 0.61,
    target_context_seconds: 5.62, status: 'scheduled', muted: true, presentation_gain: 0.1,
    scheduled_blocks: 30, discarded_blocks: 0, reason: null, interval: null,
    standing: 'native PCM scheduled on a browser audio graph; not proof of physical speaker output',
  },
  available: true, held: false, in_flight: false, queued_blocks: 3, queued_bytes: 4096,
  coalesced_presentation_frames: 0, views: 1, disposed: false,
  playback_policy: {blockFrames: 8192, leadSeconds: 0.5, lookaheadSeconds: 0.5, owner: 'test'},
})
const validState = (determinants = null) => ({ok: true, value: qlReading.parseQlInstrumentReading(ownerReading()), determinants})

// ── 1 — one instrument, its presentations and its topology ──────────────────

test('one instrument: the M1 torus, held by the Body, with compact, expanded and full presentations', () => {
  assert.equal(torus.LIVE_TORUS_ID, 'ql-m1-torus')
  assert.equal(torus.LIVE_TORUS_HOLDER, 'studio:body')
  assert.deepEqual([...torus.LIVE_TORUS_PRESENTATIONS], ['compact', 'expanded', 'full'])
})

test('the topology is QL-MEF ql_m1_torus: coordinate #1-5-1, R=16/9, r=1, and no 720 embedding parameter', () => {
  assert.equal(torus.LIVE_TORUS_TOPOLOGY.ref, '#1-5-1')
  assert.equal(torus.LIVE_TORUS_TOPOLOGY.major_radius, 16 / 9)
  assert.equal(torus.LIVE_TORUS_TOPOLOGY.minor_radius, 1)
  assert.match(torus.LIVE_TORUS_TOPOLOGY.source, /c\/src\/m1\.c ql_m1_torus/)
  assert.equal('return_degrees' in torus.LIVE_TORUS_TOPOLOGY, false)
})

// ── 2 — at most four macros, the engine's own first determinants ────────────

test('the rack widget carries at most four macros: the determinants the native field panel exposes first, each with its source', () => {
  assert.ok(torus.LIVE_TORUS_MACROS.length <= torus.LIVE_TORUS_MAX_MACROS)
  assert.equal(torus.LIVE_TORUS_MAX_MACROS, 4)
  assert.deepEqual(torus.LIVE_TORUS_MACROS.map(macro => macro.id), ['lens', 'context-frame', 'harmonic-basis', 'm3-transcription'])
  for (const macro of torus.LIVE_TORUS_MACROS) {
    assert.match(macro.source, /field-studies-journeys\/src\/nativeField\.ts/, `${macro.id} names the engine source it is read from`)
  }
})

// ── 3 — one handle: every reader sees the same published state ──────────────

test('the handle is one store: readers see the same state object, a change notifies once, an identical publish does not, withdrawal reads absent', () => {
  assert.equal(torus.liveTorusState(), null)
  let calls = 0
  const unsubscribe = torus.subscribeLiveTorus(() => { calls += 1 })
  torus.publishLiveTorusState(validState())
  const first = torus.liveTorusState()
  assert.ok(first && first.ok === true, 'the validated reading is held')
  assert.equal(first.value.standing, 'following')
  assert.equal(torus.liveTorusState(), first, 'every reader reads the identical state object')
  assert.equal(calls, 1)
  torus.publishLiveTorusState(validState())
  assert.equal(torus.liveTorusState(), first, 'an identical publish keeps the same object')
  assert.equal(calls, 1, 'an identical publish notifies nobody')
  torus.publishLiveTorusState({ok: false, fault: 'reading.schema: expected ql.instrument-reading/v1'})
  assert.equal(torus.liveTorusState().ok, false)
  assert.equal(calls, 2)
  torus.publishLiveTorusState(null)
  assert.equal(torus.liveTorusState(), null, 'withdrawn: honest absence')
  assert.equal(calls, 3)
  unsubscribe()
  torus.publishLiveTorusState(validState())
  assert.equal(calls, 3, 'an unsubscribed reader is not called')
  torus.publishLiveTorusState(null)
})

// ── 4 — the widget refuses honestly and never shows a plausible state ───────

test('a refused reading renders the refusal; an absent state renders the absence', () => {
  const absent = renderToStaticMarkup(createElement(widget.LiveTorusWidgetView, {state: null}))
  assert.match(absent, /data-live-torus="absent"/)
  assert.doesNotMatch(absent, /data-standing=/)
  const refused = renderToStaticMarkup(createElement(widget.LiveTorusWidgetView, {state: {ok: false, fault: 'reading.schema: expected ql.instrument-reading/v1'}}))
  assert.match(refused, /data-live-torus="refused"/)
  assert.match(refused, /Refused reading/)
})

// ── 5 — with the owner reading: standing shows, no macro is invented, no drawn torus ──

test('with the owner reading the widget shows its standing; each macro reads not published; the widget draws no torus', () => {
  const markup = renderToStaticMarkup(createElement(widget.LiveTorusWidgetView, {state: validState()}))
  assert.match(markup, /data-live-torus="following"/)
  assert.match(markup, /data-standing="following"/)
  assert.equal((markup.match(/data-macro="/g) || []).length, 4)
  assert.equal((markup.match(/data-value="none"/g) || []).length, 4, 'the owner reading publishes no determinant yet, so no macro carries a value')
  assert.doesNotMatch(markup, /data-value="(?!none")/)
  assert.doesNotMatch(markup, /<svg|<ellipse/, 'the shell draws no torus: the visible torus is the simulation render only')
})

// ── 6 — the torus face declares the full presentation, admission unchanged ──

test('the quaternal-logic torus face declares the full presentation too, and stays waiting (no admission change)', () => {
  const face = manifest.quaternalLogicFamilyManifest().faces.find(row => row.id === 'torus')
  assert.deepEqual([...face.presentations], ['compact', 'expanded', 'full'])
  assert.equal(face.admission, 'waiting')
  assert.deepEqual(face.heldBy, ['studio:body'])
})

// ── 7 — tokens only for colour ──────────────────────────────────────────────

test('the widget and its stylesheet take colour from tokens only', async () => {
  const css = await readFile(new URL('panels/devices/liveTorusWidget.css', here), 'utf8')
  const tsx = await readFile(new URL('panels/devices/LiveTorusWidget.tsx', here), 'utf8')
  assert.doesNotMatch(css, /#[0-9a-fA-F]{3,8}\b/)
  assert.doesNotMatch(css, /\b(rgb|rgba|hsl|hsla)\(/)
  assert.doesNotMatch(tsx, /#[0-9a-fA-F]{3,8}\b/)
})

// ── 8 — the Live device chain mounts the one instrument only once a reading is published ──

test('the Live device chain is unchanged until a reading is published; then the instrument heads the device chain only', () => {
  const ctx = {set: null, loading: false, error: null}
  const selection = {track: 0, clip: undefined, scene: null}
  torus.publishLiveTorusState(null)
  const before = renderToStaticMarkup(createElement(chain.DeviceChainPanel, {ctx, document: null, selection, mode: 'device'}))
  assert.doesNotMatch(before, /data-live-torus=/, 'no reading: no card in the Live chain')
  torus.publishLiveTorusState(validState())
  const device = renderToStaticMarkup(createElement(chain.DeviceChainPanel, {ctx, document: null, selection, mode: 'device'}))
  assert.match(device, /data-live-torus="following"/, 'reading published: the instrument mounts')
  const clip = renderToStaticMarkup(createElement(chain.DeviceChainPanel, {ctx, document: null, selection, mode: 'clip'}))
  assert.doesNotMatch(clip, /data-live-torus=/, 'clip mode keeps its own detail, not the instrument')
  torus.publishLiveTorusState(null)
})

// ── 9 — the owner's determinants are the macro values; none is invented ─────

const determinantsOwned = () => ({lens: {lens12: 3, label: 'L1′'}, contextFrame: 2, harmonic: {selection: 'canonical-basis', index: 4}, rna: true})

test('with the owner determinants the four macros show the owner values: lens, CF n, harmonic basis, DNA or RNA', () => {
  torus.publishLiveTorusState(validState(determinantsOwned()))
  const rows = torus.liveTorusMacroRows(torus.liveTorusState())
  assert.deepEqual(rows.map(row => row.value), ['L1′', 'CF2', 'B5', 'RNA'])
  const markup = renderToStaticMarkup(createElement(widget.LiveTorusWidgetView, {state: torus.liveTorusState()}))
  assert.equal((markup.match(/data-value="none"/g) || []).length, 0)
  assert.match(markup, /data-macro="harmonic-basis" data-value="B5"/)
  torus.publishLiveTorusState(null)
})

test('a selected source row reads Row, and DNA reads DNA: the owner states them, the shell does not choose', () => {
  const selected = {...determinantsOwned(), harmonic: {selection: 'selected-source-row'}, rna: false}
  const rows = torus.liveTorusMacroRows(validState(selected))
  assert.equal(rows[2].value, 'Row')
  assert.equal(rows[3].value, 'DNA')
})

test('a reading without owner determinants leaves every macro absent, and a refused state leaves none', () => {
  assert.deepEqual(torus.liveTorusMacroRows(validState(null)).map(row => row.value), [null, null, null, null])
  assert.deepEqual(torus.liveTorusMacroRows({ok: false, fault: 'x'}).map(row => row.value), [null, null, null, null])
  assert.deepEqual(torus.liveTorusMacroRows(null).map(row => row.value), [null, null, null, null])
})

// ── 10 — the publisher path: the frame's announcement → boundary → handle → widget ──

test('the frame announcement reaches the widget through the boundary reader and the one handle', async () => {
  const boundary = await import('../../../expressions-boundary/src/protocol.ts')
  const composer = await import('../../../../desktop/cradle/expressions-app/field-studies-journeys/src/native-field/ql/instrumentAnnouncement.mjs')
  const basis = {event_ref: 'event:owner', subject_ref: 'subject:owner', registry_revision: 'registry:owner', geometry_ref: 'geometry:owner', material_ref: 'material:owner', model_ref: 'model:owner', generation: '4', samples_elapsed: '245760'}
  const controller = {status: 'following', reason: null, muted: true, presentation_level: {value: 1}, presentation_units_per_metre: 120, presentation_mode: 'domain-follow', playback_policy: ownerReading().playback_policy,
    native: {event_ref: 'event:owner', subject_ref: 'subject:owner', reason: null, acknowledged: {generation: '4', samples_elapsed: '245760'},
      presented: {generation: '4', samples_elapsed: '245760'}, audio: {...ownerReading().audio, native: basis}, available: true, held: false,
      in_flight: false, queued_blocks: 3, queued_bytes: 4096, coalesced_presentation_frames: 0, views: 1, disposed: false},
    instrument: {acting: {m1: {lens12: 3, lens: 'L1′', context_frame: 2}, harmonic: {source: {selection: 'canonical-basis', index: 4}}, m3: {rna: true}}, cadence: {playing: true, rate: 1, source: '1 tick/s'}, refusal: null}}
  // A hosted state as the frame announces it: the boundary admits it and carries the instrument.
  const hosted = boundary.readHostedState({hostMode: 'live', sceneIndex: 0, sceneCount: 1, nativeScene: {expression_ref: 'expression:kept', revision: 3, scene_ref: 'scene:one'}, instrument: composer.announceInstrument(controller)})
  assert.ok(hosted, 'the boundary admits the live announcement')
  torus.publishLiveTorusState(torus.liveTorusFromHost(hosted.instrument))
  const state = torus.liveTorusState()
  assert.equal(state.ok, true)
  assert.equal(state.value.identity.model_ref, 'model:owner')
  const markup = renderToStaticMarkup(createElement(widget.LiveTorusWidgetView, {state}))
  assert.match(markup, /data-live-torus="following"/)
  assert.match(markup, /data-macro="lens" data-value="L1′"/)
  assert.match(markup, /data-macro="context-frame" data-value="CF2"/)
  // The announcement withdrawn (no instrument in the next hosted state): the handle, and so the chain, is absent again.
  const bare = boundary.readHostedState({hostMode: 'live', sceneIndex: 0, sceneCount: 1, nativeScene: {expression_ref: 'expression:kept', revision: 3, scene_ref: 'scene:one'}})
  torus.publishLiveTorusState(torus.liveTorusFromHost(bare.instrument))
  assert.equal(torus.liveTorusState(), null)
})

test('the hosted panel publishes every announcement to the one handle and withdraws it on unmount; the Live cut is the audio workspace', async () => {
  const panel = await readFile(new URL('panels/expressions.tsx', here), 'utf8')
  assert.match(panel, /publishLiveTorusState\(liveTorusFromHost\(state\.instrument\)\)/)
  assert.match(panel, /live = false; publishLiveTorusState\(null\)/)
  assert.match(panel, /mode === 'audio' \? 'live' : mode/, 'the Live workspace stands the frame in its live cut')
  assert.doesNotMatch(panel, /if \(workspace\.mode === 'audio'\) return/, 'the audio early return that kept the frame out of Live is gone')
})

// ── 11 — Live's centre: the instrument over the Timeline, the audio cut's behaviour kept ──

test('Live centre: the instrument is the centre identity world.expressions; a Timeline view shows the Timeline; other audio panels stay hidden', async () => {
  const app = await readFile(new URL('App.tsx', here), 'utf8')
  // the audio hide rule still hides every panel except knowledge, and now the hosted instrument when the centre is not on it
  assert.match(app, /workspace\.mode === 'audio' && panel\.id !== 'world\.knowledge' && panel\.id !== 'world\.expressions' \|\|/)
  // a Timeline view in Live moves the centre identity off the instrument; the Live mode press returns to it (chooseMode)
  assert.match(app, /if \(frameMode === 'live'\) \{ setCenterPanel\(`native\.\$\{view\}`\); return \}/)
  assert.match(app, /if \(next === 'live' \|\| next === 'expressions'\) \{ setCenterPanel\('world\.expressions'\)/, 'the Live mode press returns the centre to the instrument')
  assert.match(app, /live-centre-torus/)
  const css = await readFile(new URL('live/liveCentre.css', here), 'utf8')
  assert.match(css, /background: var\(--bg-2\)/)
  assert.doesNotMatch(css, /#[0-9a-fA-F]{3,8}\b/)
})
