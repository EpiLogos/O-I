import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {register} from 'node:module'

// L9 musical family — the instrument face, its reading, the manifest
// extension and the M2 modulation sources, against the same in-memory TS
// loader the L2 manifest tests use. No native effects, no audio, no claims:
// every assertion is about types, refusals and declarations.

const root = new URL('../../../../', import.meta.url)
const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};
import {readFile} from 'node:fs/promises';
export async function resolve(s, c, n) {
  try { return await n(s, c) } catch (e) {
    if (!s.startsWith('.')) throw e;
    if (s.endsWith('.js')) { try { return await n(s.slice(0, -3) + '.ts', c) } catch {} }
    for (const x of ['.ts', '.tsx']) { try { return await n(s + x, c) } catch {} }
    throw e;
  }
}
export async function load(u, c, n) {
  if (u.endsWith('.css')) return {format: 'module', shortCircuit: true, source: 'export {}'};
  if (!u.endsWith('.ts') && !u.endsWith('.tsx')) return n(u, c);
  return {format: 'module', shortCircuit: true, source: ts.transpileModule(await readFile(new URL(u), 'utf8'), {fileName: new URL(u).pathname,
    compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX}}).outputText};
}`)}`, import.meta.url)

const door = await import('../src/inhabitants/familyManifest.ts')
const schema = await import('../src/inhabitants/manifest.ts')
const reading = await import('../src/inhabitants/ql/qlInstrumentReading.ts')
const modulation = await import('../src/inhabitants/ql/qlModulationSources.ts')
const extension = await import('../src/inhabitants/qlMusicalExtension.ts')

// A reading shaped exactly as the owner produces it (the retained shapes:
// controller.ts standing + session reading + audio receipt + policy).
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

// ── 1 — the reading binds the owner's real shapes and refuses others ────────

test('the reading parser accepts the owner-shaped reading and pins the real constants', () => {
  const value = reading.parseQlInstrumentReading(ownerReading())
  assert.equal(value.standing, 'following')
  assert.equal(value.identity.event_ref, 'controlled:occasion')
  assert.equal(value.acknowledged.samples_elapsed, '245760')
  assert.equal(value.audio?.standing, 'native PCM scheduled on a browser audio graph; not proof of physical speaker output')
  // The real constants are ports, not choices.
  assert.equal(reading.QL_SCENE_SAMPLE_RATE, 48000)
  assert.deepEqual(
    {blockFrames: reading.QL_EMBEDDED_NATIVE_PLAYBACK.blockFrames, leadSeconds: reading.QL_EMBEDDED_NATIVE_PLAYBACK.leadSeconds, lookaheadSeconds: reading.QL_EMBEDDED_NATIVE_PLAYBACK.lookaheadSeconds},
    {blockFrames: 8192, leadSeconds: 0.5, lookaheadSeconds: 0.5})
  assert.equal(reading.QL_INSTRUMENT_PRESENTATION.units_per_metre, 120)
  assert.match(reading.QL_INSTRUMENT_PRESENTATION.standing, /not a source value/)
})

test('the reading parser refuses what the owner does not produce', () => {
  assert.throws(() => reading.parseQlInstrumentReading({}), /schema/)
  assert.throws(() => reading.parseQlInstrumentReading({...ownerReading(), standing: 'guessing'}), /standing/)
  assert.throws(() => reading.parseQlInstrumentReading({...ownerReading(), acknowledged: {generation: '4.0', samples_elapsed: '0'}}), /acknowledged/)
  assert.throws(() => reading.parseQlInstrumentReading({...ownerReading(), audio: {...ownerReading().audio, device_sample_rate: 44100}}), /resampling|rate/)
  assert.throws(() => reading.parseQlInstrumentReading({...ownerReading(), identity: {...ownerReading().identity, model_ref: ''}}), /model_ref/)
  assert.throws(() => reading.parseQlInstrumentReading({...ownerReading(), audio: {...ownerReading().audio, standing: ''}}), /honesty line/)
})

test('the launch contract names the real launcher, bindings and channel — disclosed, not invented', () => {
  const launch = reading.QL_LAUNCH_CONTRACT
  assert.match(launch.owner, /ql-field-host/)
  assert.match(launch.launcher, /native-expression owner/)
  assert.ok(launch.bindings.some(row => row.includes('OI_QL_FIELD_HOST_BIN')))
  assert.ok(launch.bindings.some(row => row.includes('catalogue')))
  assert.match(launch.compose, /compose/)
  assert.match(launch.channel, /oi\.native-expression\/v1/)
  assert.ok(launch.shellStillLacks.every(gap => gap.length > 20), 'each missing seam is named, not waved at')
})

// ── 2 — the extension: additive, admitted-with-honest-absence ───────────────

test('the L9 extension composes additively: the base manifest stays verbatim, the instrument face is admitted with a body-bearing kind', async () => {
  door.resetFamilyManifestsForTest()
  const base = (await import('../src/inhabitants/quaternalLogicFamilyManifest.ts')).quaternalLogicFamilyManifest()
  const baseJson = JSON.stringify(door.familyManifest('quaternal-logic'))
  assert.equal(base.faces.length, 6)
  extension.declareQlMusicalExtension()
  extension.declareQlMusicalExtension() // idempotent
  assert.equal(JSON.stringify(door.familyManifest('quaternal-logic')), baseJson, 'the door\'s base is never rewritten')
  const composed = schema.inhabitantManifest('quaternal-logic')
  assert.equal(composed.faces.length, 7)
  const face = composed.faces.find(face => face.id === 'ql-instrument')
  assert.ok(face)
  assert.equal(schema.faceKind(face), 'instrument')
  assert.equal(face.admission, 'admitted')
  assert.ok(face.note.length > 80)
  // The base's six faces keep their waiting standing untouched.
  for (const kept of composed.faces.filter(face => face.id !== 'ql-instrument')) {
    assert.equal(kept.admission, 'waiting', `${kept.id} stays waiting`)
  }
  // The composed manifest validates through the generalised validators.
  assert.deepEqual([...schema.validateInhabitantManifest(composed)], [])
  // The world-shell load composes it too, and the whole set stays valid.
  const world = await import('../src/inhabitants/worldShellFamilies.ts')
  door.resetFamilyManifestsForTest()
  world.loadWorldShellFamilies()
  assert.equal(schema.validateAllInhabitantManifests().size, 0)
})

// ── 3 — M2 modulation sources: D13 in the type, compiled plans ──────────────

test('the M2 observables are the shared audio_octet[8] + nodal_quartet[4], declared as sources that generate nothing', () => {
  assert.equal(modulation.QL_M2_SOURCES.length, 12)
  const octet = modulation.QL_M2_SOURCES.filter(source => source.carrier === 'm2.vimarsha.reading.audio_octet_hz')
  const quartet = modulation.QL_M2_SOURCES.filter(source => source.carrier === 'm2.vimarsha.reading.nodal_quartet')
  assert.equal(octet.length, 8)
  assert.equal(quartet.length, 4)
  for (const source of modulation.QL_M2_SOURCES) {
    assert.equal(source.generates, false, `${source.id}: D13 — an observation, never a generator`)
    assert.match(source.law, /never a generator/)
  }
})

test('reading the observables parses the retained Vimarśā shape and refuses malformed ones', () => {
  const vimarsha = {
    audio_octet_hz: [220, 247.5, 293.3, 330, 440, 495, 586.6, 660],
    nodal_quartet: [
      {m: 1, n: 2, frequency_hz: 220}, {m: 2, n: 3, frequency_hz: 330},
      {m: 3, n: 4, frequency_hz: 440}, {m: 4, n: 5, frequency_hz: 550},
    ],
  }
  const read = modulation.readQlM2Sources({reading: vimarsha}.reading)
  assert.equal(read.ok, true)
  if (read.ok) {
    assert.equal(read.observations.length, 12)
    assert.deepEqual(read.observations.map(o => o.sourceId).slice(0, 2), ['ql:m2/audio-octet/0', 'ql:m2/audio-octet/1'])
  }
  assert.equal(modulation.readQlM2Sources(null).ok, false)
  assert.equal(modulation.readQlM2Sources({audio_octet_hz: [1, 2, 3]}).ok, false, 'a short octet is not the shared eight')
  assert.throws(() => modulation.readQlM2Sources({audio_octet_hz: [220, ...Array(7).fill(NaN)]}), /finite positive/)
  assert.throws(() => modulation.readQlM2Sources({nodal_quartet: [1, 2, 3, 4]}), /voice/)
})

test('a compiled modulation plan routes sources to declared-scope parameters; out-of-scope targets refuse; evaluate names its source', () => {
  const target = (family, key, range = {min: 0, max: 4}) => ({family, deviceInstance: null, key, type: 'number', range, unit: 'Hz', writePath: `ql.${key}`})
  const good = modulation.compileQlModulationPlan([
    {sourceId: 'ql:m2/audio-octet/0', target: target('quaternal-logic', 'carrier.root_hz', {min: 0, max: 1000}), amount: 0.001, transfer: 'linear', scope: 'instrument'},
    {sourceId: 'ql:m2/nodal-quartet/2', target: target('quaternal-logic', 'material.damping_per_second'), amount: 0.01, transfer: 'linear', scope: 'body'},
  ])
  assert.equal(good.ok, true, 'in-scope routes compile')
  if (good.ok) {
    const read = modulation.readQlM2Sources({audio_octet_hz: [220, 247.5, 293.3, 330, 440, 495, 586.6, 660], nodal_quartet: [{m: 1, n: 2, frequency_hz: 220}, {m: 2, n: 3, frequency_hz: 330}, {m: 3, n: 4, frequency_hz: 440}, {m: 4, n: 5, frequency_hz: 550}]})
    assert.ok(read.ok)
    if (read.ok) {
      const effects = good.plan.evaluate(read.observations, new Map([['quaternal-logic/*/carrier.root_hz', 110]]))
      const first = effects.find(effect => effect.sourceId === 'ql:m2/audio-octet/0')
      // 110 + 0.001 × 220 = 110.22 — base + amount × observed, never a voice.
      assert.equal(first.effective, 110.22)
      assert.equal(first.sourceLabel, 'audio octet 0 (Hz)')
      const clampedRoute = good.plan.evaluate(read.observations, new Map([['quaternal-logic/*/material.damping_per_second', 3.9]]))
        .find(effect => effect.sourceId === 'ql:m2/nodal-quartet/2')
      assert.equal(clampedRoute.clamped, true, 'the clamp is disclosed, never silent')
      assert.equal(clampedRoute.effective, 4)
      // An unread source drives nothing and shows nothing.
      assert.equal(good.plan.evaluate([], new Map()).length, 0)
    }
  }
  const bad = modulation.compileQlModulationPlan([
    {sourceId: 'ql:m2/audio-octet/9', target: target('quaternal-logic', 'x'), amount: 1, transfer: 'linear', scope: 'instrument'},
    {sourceId: 'ql:m2/audio-octet/0', target: target('expressions', 'field.frequency'), amount: 1, transfer: 'linear', scope: 'presentation'},
    {sourceId: 'ql:m2/audio-octet/0', target: {family: 'quaternal-logic', deviceInstance: null, key: 'y', type: 'number', writePath: ''}, amount: 1, transfer: 'linear', scope: 'instrument'},
    {sourceId: 'ql:m2/audio-octet/1', target: target('quaternal-logic', 'z'), amount: NaN, transfer: 'linear', scope: 'instrument'},
  ])
  assert.equal(bad.ok, false)
  if (!bad.ok) {
    assert.equal(bad.faults.length, 4)
    assert.match(bad.faults[0], /unknown modulation source/)
    assert.match(bad.faults[1], /outside the declared scope/)
    assert.match(bad.faults[2], /write path/)
    assert.match(bad.faults[3], /finite/)
  }
  // The declared scope is honestly narrow today.
  assert.deepEqual([...modulation.QL_MODULATION_SCOPE.families], ['quaternal-logic'])
})

// ── 4 — the face module stays a view: the law lives in the pure modules ─────

test('the pure law modules import no React; the face is the only tsx', async () => {
  for (const file of ['src/inhabitants/ql/qlInstrumentReading.ts', 'src/inhabitants/ql/qlModulationSources.ts', 'src/inhabitants/qlMusicalExtension.ts']) {
    const source = await readFile(new URL(`../${file}`, import.meta.url), 'utf8')
    assert.doesNotMatch(source, /from ['"]react/, `${file} stays pure`)
  }
  const face = await readFile(new URL('../src/inhabitants/qlInstrumentDevice.tsx', import.meta.url), 'utf8')
  assert.match(face, /parseQlInstrumentReading/)
  assert.match(face, /QL_LAUNCH_CONTRACT/)
  assert.match(face, /createQlSampleClockStratum/)
  // The performance act is not offered: the change union has no strike.
  assert.doesNotMatch(face, /operation:\s*'strike'/)
})
