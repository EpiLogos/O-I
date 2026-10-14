import test, {beforeEach} from 'node:test'
import assert from 'node:assert/strict'
import {readFile, readdir} from 'node:fs/promises'
import {register} from 'node:module'
import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'

// The QL instrument face reads the one owner reading (live/torusInstrument.ts) in the Technē rack, in the focused
// instrument's device chain, and in a popped-out device window. Channel: scripted (the reader's publish stands in for the
// mounted Expressions frame; no native owner is opened). Production modules in memory, the pane-instrument loader pattern.
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

// The build-time define the cradle's walk scenario reads at module evaluation (seam-7-8 does the same).
globalThis.__CRADLE_WALK__ = false
const torus = await import('../src/live/torusInstrument.ts')
const qlReading = await import('../src/inhabitants/ql/qlInstrumentReading.ts')
const {QlInstrumentBody} = await import('../src/inhabitants/qlInstrumentDevice.tsx')
const {TechneInstrumentsDetail, InstrumentDeviceDetail} = await import('../src/shell/ModeDetail.tsx')
const {DeviceWindowBody} = await import('../src/native/Detached.tsx')
const {deviceBindingId} = await import('../src/native/detachedKinds.ts')

const html = element => renderToStaticMarkup(element)
const transport = {kind: 'unavailable', reason: 'the test carrier is down'}
// HTML-escaped text as renderToStaticMarkup writes it (apostrophes become &#x27;).
const escaped = text => text.replace(/&/g, '&amp;').replace(/'/g, '&#x27;').replace(/"/g, '&quot;')

// A reading shaped exactly as the owner produces it (the live-torus-instrument.test.mjs fixture; test-only, never production).
const ownerReading = (standing = 'following') => ({
  schema: 'ql.instrument-reading/v1',
  standing,
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
const validState = (standing = 'following') => ({
  ok: true,
  value: qlReading.parseQlInstrumentReading(ownerReading(standing)),
  determinants: null,
  parameters: {muted: true, level: null, scale: {unitsPerMetre: 120, mode: 'manual'}, cadence: null, refusal: null},
})

// The focused chain: `studio:body` is the holder the QL instrument face declares (heldBy), so its body docks expanded.
const FOCUS = 'studio:body'
const instrumentIdentity = {family: 'quaternal-logic', face: 'ql-instrument', aperture: {day: null, flow: null, conversation: null, instrument: null}}
const boundInstrument = identity => ({id: deviceBindingId(identity), kind: 'device', title: 'QL field / PCM owner', ref: deviceBindingId(identity), device: identity})

beforeEach(() => torus.publishLiveTorusState(null))

// ── the reader's named feed ─────────────────────────────────────────────────

test('the reader names an absent owner and a refusal, and hands the owner reading through unchanged', () => {
  assert.deepEqual(torus.qlInstrumentFeed(null), {kind: 'absent', reason: torus.LIVE_TORUS_ABSENT_REASON})
  assert.match(torus.LIVE_TORUS_ABSENT_REASON, /^No owner reading in this host\./)
  const fault = 'instrument: expected the announced reading envelope'
  assert.deepEqual(torus.qlInstrumentFeed({ok: false, fault}), {kind: 'refused', reason: fault})
  const state = validState('held')
  assert.equal(torus.qlInstrumentFeed(state), state.value, 'the owner reading is the reader\'s own object, not a copy')
})

test('the one reader is published once and read by every presentation: the feed is the handle\'s state', () => {
  torus.publishLiveTorusState(validState('following'))
  assert.equal(torus.liveTorusState().ok, true)
  assert.equal(torus.qlInstrumentFeed(torus.liveTorusState()).standing, 'following')
  torus.publishLiveTorusState(null)
  assert.equal(torus.qlInstrumentFeed(torus.liveTorusState()).kind, 'absent')
})

// ── 1 — the Technē rack hands the reader's reading to the face ──────────────

test('the Technē rack shows the owner\'s standing and reading when the one reader publishes it', () => {
  torus.publishLiveTorusState(validState('following'))
  const out = html(createElement(TechneInstrumentsDetail, {transport, focusInstrument: FOCUS}))
  assert.match(out, /data-ql-standing="following"/, 'the header chip carries the owner standing')
  assert.match(out, /data-ql-instrument[^>]*data-state="following"[^>]*data-available="yes"/, 'the body reads the owner reading')
  assert.match(out, /controlled:occasion/, 'the identity tuple is the owner\'s')
  assert.doesNotMatch(out, /data-ql-absent|data-named-reason|Refused reading/)
})

test('the Technē device chain (InstrumentDeviceDetail) reads the same reader', () => {
  torus.publishLiveTorusState(validState('held'))
  // The owner is Body · 3:3's (sdk/semantics.ts): with no Technē instrument focused it stands after the folds; a Technē instrument that
  // does not hold it does not draw it.
  const out = html(createElement(TechneInstrumentsDetail, {transport}))
  assert.match(out, /data-ql-standing="held"/)
  assert.doesNotMatch(html(createElement(InstrumentDeviceDetail, {transport, instrument: 'techne:m0', centralDevices: true})), /data-ql-standing/)
})

// ── 2 — with no owner standing, the face shows the reader's named reason ─────

test('with no owner standing, the rack shows the reader\'s named absence verbatim, not a generic refusal', () => {
  torus.publishLiveTorusState(null)
  const out = html(createElement(TechneInstrumentsDetail, {transport, focusInstrument: FOCUS}))
  assert.match(out, /data-named-reason="absent"/)
  assert.ok(out.includes(escaped(torus.LIVE_TORUS_ABSENT_REASON)), 'the reader\'s own words, verbatim')
  assert.match(out, /data-ql-standing="refusing"/)
  assert.ok(out.includes(`title="${escaped(torus.LIVE_TORUS_ABSENT_REASON)}"`), 'the header chip carries the same named reason')
})

test('a boundary refusal reaches the face with its fault named, and never as a plausible state', () => {
  const fault = 'instrument: expected the announced reading envelope'
  torus.publishLiveTorusState({ok: false, fault})
  const out = html(createElement(TechneInstrumentsDetail, {transport, focusInstrument: FOCUS}))
  assert.match(out, /data-named-reason="refused"/)
  assert.ok(out.includes(`Refused reading: ${fault}. A plausible owner state is never rendered.`))
  assert.doesNotMatch(out, /data-available="yes"/)
})

test('a raw malformed reading still renders the face\'s own parse fault (the face parses what it is given)', () => {
  const out = html(createElement(QlInstrumentBody, {reading: {schema: 'other'}}))
  assert.match(out, /data-state="refusing"/)
  assert.ok(out.includes('Refused reading: reading: expected schema ql.instrument-reading/v1.'))
})

// ── 3 — the popped-out window reads the same reader, in its own context ──────

test('the QL instrument does not pop out: its reading is published only in the main window, so the device door refuses it by name', () => {
  torus.publishLiveTorusState(validState('following'))
  const out = html(createElement(DeviceWindowBody, {binding: boundInstrument(instrumentIdentity), transport}))
  assert.match(out, /data-device-fault/, 'the window names the refusal instead of drawing a body that can only say "no reading"')
  assert.doesNotMatch(out, /data-ql-instrument[^>]*data-state="following"/)
})

// ── 4 — one reader, and no fixture path in production ───────────────────────

test('the rack, the device chain and the popped-out window all import the one reader module', async () => {
  const root = new URL('../src/', import.meta.url)
  const app = await readFile(new URL('App.tsx', root), 'utf8')
  const modeDetail = await readFile(new URL('shell/ModeDetail.tsx', root), 'utf8')
  const detached = await readFile(new URL('native/Detached.tsx', root), 'utf8')
  for (const [name, text] of [['ModeDetail', modeDetail], ['Detached', detached]]) {
    assert.match(text, /from '\.\.\/live\/torusInstrument'/, `${name} reads the reader module`)
    assert.doesNotMatch(text, /instrumentReading\?:|instrumentReading=\{(?!instrumentReading\})/, `${name} takes no caller-supplied reading`)
  }
  assert.doesNotMatch(app, /TechneInstrumentsDetail[^>]*instrumentReading/, 'the App call site passes no reading')
  assert.match(modeDetail, /const instrumentReading = useQlInstrumentFeed\(\)/)
  assert.match(detached, /const instrumentReading = useQlInstrumentFeed\(\)/)
})

test('no fixture reading is reachable from production source: only the dev harness carries one', async () => {
  const root = new URL('../src/', import.meta.url)
  const files = (await readdir(root, {recursive: true})).filter(file => /\.(ts|tsx)$/.test(file) && !/(^|\/)(dev|dev-[^/]+)\//.test(file) && !/sdk\/dev\//.test(file))
  assert.ok(files.length > 50, 'the production tree was read')
  for (const file of files) {
    const text = await readFile(new URL(file, root), 'utf8')
    assert.doesNotMatch(text, /from ['"][^'"]*inhabitants\/dev\//, `${file} imports no dev harness`)
    assert.doesNotMatch(text, /get\('reading'\)|reading=fixture|fixtureReading/, `${file} carries no fixture reading`)
  }
})
