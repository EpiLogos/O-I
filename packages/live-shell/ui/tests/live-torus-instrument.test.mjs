import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {register} from 'node:module'
import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'

// T-LIVE-TORUS-INSTRUMENT leg 1 — Live mode seats the one instrument, the M1 torus
// (DEVICE-SEMANTICS-LOCK §0.2, §2.1). The shell holds ONE reading handle; the torus
// device (live/torusDevice.ts, drawn on the Live chain by live/TorusOnChain.tsx through the frame's DeviceView) reads it. The simulation itself runs in the
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
const onChain = await import('../src/live/TorusOnChain.tsx')
const torusDeviceModule = await import('../src/live/torusDevice.ts')
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

test('the torus device carries at most four macros: the determinants the native field panel exposes first, each with its source', () => {
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

// ── 4 — the device refuses honestly and never shows a plausible state ──────
// (the old LiveTorusWidget rack card is gone: the torus is a device of the runtime — live/torusDevice.ts, drawn by live/TorusOnChain.tsx)

test('a refused reading renders the refusal on the chain; an absent state is a dark device that writes nothing', () => {
  const absent = torusDeviceModule.torusDevice(null)
  assert.equal(absent.rows.length, 4, 'the four macros stand even with no reading')
  assert.ok(absent.rows.every(row => !row.writePath), 'no reading, no writes')
  assert.deepEqual(absent.values, {}, 'and no value is invented')
  const refused = renderToStaticMarkup(createElement(onChain.TorusOnChain, {state: {ok: false, fault: 'reading.schema: expected ql.instrument-reading/v1'}}))
  assert.match(refused, /data-live-torus="refused"/)
  assert.match(refused, /Refused reading/)
  assert.match(refused, /data-device-light="unknown"/, 'a refused reading lights nothing')
})

// ── 5 — with the owner reading: standing shows, no macro is invented, the picture is the torus's outline ──

test('with the owner reading the chain shows its standing; each macro reads not published; the device draws the torus outline, not a phase', () => {
  const markup = renderToStaticMarkup(createElement(onChain.TorusOnChain, {state: validState()}))
  assert.match(markup, /data-live-torus="following"/)
  assert.match(markup, /data-device-light="on"/, 'a following instrument is lit')
  assert.match(markup, /<div class="device-picture"><div class="torus-picture" data-live-torus="following" data-torus-size="compact"/, 'the compact picture is the torus figure')
  assert.match(markup, /<svg role="img" aria-label="M1 torus, following"/, 'a drawing with a name, not a text label')
  assert.match(markup, /<path d="M[-\d. ML]+L[-\d. ML]+"[^>]*data-torus-side="far"/, 'the far side is drawn, fainter')
  assert.match(markup, /<path d="M[-\d. ML]+L[-\d. ML]+"[^>]*data-torus-side="near"/, 'the near side is drawn')
  assert.match(markup, /data-torus-tone="lit"/, 'the standing tints it')
  assert.doesNotMatch(markup, /<div class="torus-picture"[^>]*><b>/, 'no text-only card')
  assert.equal((markup.match(/data-param="/g) || []).length, 4)
  // The long lists (lens, context frame, harmonic basis) step through one value box; the two-choice transcription is a
  // segmented toggle (the mockup's .tog) — and with no determinant published, no box shows a value and no choice is lit.
  assert.equal((markup.match(/class="sdk-enum"[^>]*>—<\/button>/g) || []).length, 3, 'the owner reading publishes no determinant yet, so no stepped macro carries a value')
  assert.equal((markup.match(/class="sdk-seg"/g) || []).length, 1, 'the two-choice macro is a segmented toggle')
  assert.doesNotMatch(markup, /sdk-seg__opt--on/, 'and none of its choices is lit')
  assert.deepEqual(torusDeviceModule.torusDevice(validState()).values, {enabled: true}, 'the device holds no macro value either')
  assert.doesNotMatch(markup, /<ellipse|<circle/, 'the outline is paths: no point or phase is drawn on it — the oscillation is the simulation render only')
})

test('the picture is the same device at all three sizes: the figure grows denser, the owner\'s reading is the same', () => {
  const figures = ['compact', 'whole', 'full'].map(size => torusDeviceModule.torusFigure(size))
  const strokes = figures.map(figure => (figure.front.match(/M/g) ?? []).length + (figure.back.match(/M/g) ?? []).length)
  assert.ok(strokes[0] < strokes[1] && strokes[1] < strokes[2], `more of the outline at each size: ${strokes}`)
  for (const figure of figures) {
    assert.ok(figure.front.length > 0 && figure.back.length > 0, 'both sides of the surface are drawn')
    // every coordinate lies inside the viewBox the figure names: the whole torus is in the picture
    const {x, y, width, height} = figure.view
    const numbers = (figure.front + figure.back).match(/-?\d+(?:\.\d+)?/g).map(Number)
    for (let index = 0; index < numbers.length; index += 2) {
      assert.ok(numbers[index] >= x && numbers[index] <= x + width, `x ${numbers[index]} inside the view`)
      assert.ok(numbers[index + 1] >= y && numbers[index + 1] <= y + height, `y ${numbers[index + 1]} inside the view`)
    }
  }
  assert.deepEqual(torusDeviceModule.torusFigure('compact'), torusDeviceModule.torusFigure('compact'), 'the same size draws the same figure')
  // the geometry is the kernel's: the widest reach across is R + r, from the topology constants
  const compact = torusDeviceModule.torusFigure('compact')
  assert.ok(Math.abs((compact.view.width / 2) - (25 / 9 + 0.15)) < 0.01)
  // the pool and the pane draw the same picture at their own size: the chain publishes it by size (TorusOnChain publishDevice)
  for (const size of ['whole', 'full']) {
    const markup = renderToStaticMarkup(createElement(onChain.TorusPicture, {state: validState(), size}))
    assert.match(markup, new RegExp(`data-torus-size="${size}"`))
    assert.match(markup, /<small>following · controlled:occasion<\/small>/, `${size}: the owner's standing and event under the figure`)
  }
  assert.doesNotMatch(renderToStaticMarkup(createElement(onChain.TorusPicture, {state: validState(), size: 'compact'})), /<small>/, 'the rack\'s small picture is the figure alone')
})

test('a refused or absent reading draws the outline unlit and names the refusal', () => {
  const refused = renderToStaticMarkup(createElement(onChain.TorusPicture, {state: {ok: false, fault: 'reading.schema: expected ql.instrument-reading/v1'}, size: 'whole'}))
  assert.match(refused, /data-torus-tone="unlit"/)
  assert.match(refused, /role="alert"[^>]*>Refused reading: reading\.schema/)
  assert.equal(torusDeviceModule.torusTone(null), 'unlit')
  const standing = name => ({...validState(), value: {...validState().value, standing: name}})
  assert.equal(torusDeviceModule.torusTone(standing('following')), 'lit')
  assert.equal(torusDeviceModule.torusTone(standing('held')), 'lit')
  assert.equal(torusDeviceModule.torusTone(standing('opening')), 'rising')
  assert.equal(torusDeviceModule.torusTone(standing('manual')), 'unlit')
  assert.equal(torusDeviceModule.torusTone(standing('unavailable')), 'unlit')
})

// ── 6 — the torus face declares the full presentation, admission unchanged ──

test('the quaternal-logic torus face declares the full presentation too, and stays waiting (no admission change)', () => {
  const face = manifest.quaternalLogicFamilyManifest().faces.find(row => row.id === 'torus')
  assert.deepEqual([...face.presentations], ['compact', 'expanded', 'full'])
  assert.equal(face.admission, 'waiting')
  assert.deepEqual(face.heldBy, ['studio:body'])
})

// ── 7 — tokens only for colour ──────────────────────────────────────────────

test('the torus device and its chain card take colour from tokens only', async () => {
  for (const file of ['live/TorusOnChain.tsx', 'live/torusDevice.ts']) {
    const source = await readFile(new URL(file, here), 'utf8')
    assert.doesNotMatch(source, /#[0-9a-fA-F]{3,8}\b/, `${file}: no raw hex colour`)
    assert.doesNotMatch(source, /\b(rgb|rgba|hsl|hsla)\(/, `${file}: no raw colour function`)
  }
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
  assert.deepEqual(torusDeviceModule.torusDevice(torus.liveTorusState()).values, {lens: 'L1′', 'context-frame': 'CF2', 'harmonic-basis': 'B5', 'm3-transcription': 'RNA', enabled: true},
    'the device shows the owner\'s values under the macros\' ids')
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

// ── 10 — the publisher path: the frame's announcement → boundary → handle → device ──

test('the frame announcement reaches the torus device through the boundary reader and the one handle', async () => {
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
  const markup = renderToStaticMarkup(createElement(onChain.TorusOnChain, {state}))
  assert.match(markup, /data-live-torus="following"/)
  const values = torusDeviceModule.torusDevice(state).values
  assert.equal(values.lens, 'L1′')
  assert.equal(values['context-frame'], 'CF2')
  // The announcement withdrawn (no instrument in the next hosted state): the handle, and so the chain, is absent again.
  const bare = boundary.readHostedState({hostMode: 'live', sceneIndex: 0, sceneCount: 1, nativeScene: {expression_ref: 'expression:kept', revision: 3, scene_ref: 'scene:one'}})
  torus.publishLiveTorusState(torus.liveTorusFromHost(bare.instrument))
  assert.equal(torus.liveTorusState(), null)
})

test('the hosted panel publishes every announcement to the one handle and withdraws it on unmount; the Live cut is the audio workspace', async () => {
  const panel = await readFile(new URL('panels/expressions.tsx', here), 'utf8')
  assert.match(panel, /publishLiveTorusState\(liveTorusFromHost\(state\.instrument\)\)/)
  assert.match(panel, /live = false;[^}]*publishLiveTorusState\(null\)/)
  assert.match(panel, /mode === 'audio' \? 'live' : mode/, 'the Live workspace stands the frame in its live cut')
  assert.doesNotMatch(panel, /if \(workspace\.mode === 'audio'\) return/, 'the audio early return that kept the frame out of Live is gone')
})

// ── 11 — Live's centre: the instrument over the Timeline, the audio cut's behaviour kept ──

test('Live centre: the instrument stands in Live\'s first pane beside the set\'s tracks; the stage frame is placed, never remounted', async () => {
  const app = await readFile(new URL('App.tsx', here), 'utf8')
  // The panes are the centre in every mode (FOUNDATION F2): Live's first tree holds the stage (the torus) beside its tracks,
  // and the one stage frame is placed over whichever pane holds it.
  assert.match(await readFile(new URL('shell/modeFrames.ts', here), 'utf8'), /live: seedInstruments\(\['projection\.expressions', 'projection\.timeline'\]\)/, 'Live\'s first pane holds the instrument')
  assert.match(app, /const expressionsPlaced = framePlacement !== null/)
  assert.match(app, /live-centre-torus/)
  const css = await readFile(new URL('live/liveCentre.css', here), 'utf8')
  assert.match(css, /background: var\(--bg-2\)/)
  assert.doesNotMatch(css, /#[0-9a-fA-F]{3,8}\b/)
})
