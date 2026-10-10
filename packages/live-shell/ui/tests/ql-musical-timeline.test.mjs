import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {register} from 'node:module'

// L9 musical family — the Timeline side: the two role-classified track
// adapters and the sample-clock stratum, over L4's contract. Every assertion
// is about projection shapes, classification refusals and declared mappings.
// No native effects, no audio, no claims.

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

const audio = await import('../src/timeline/qlAudioTrackAdapter.ts')
const physics = await import('../src/timeline/qlPhysicsTrackAdapter.ts')
const clock = await import('../src/timeline/qlSampleClock.ts')
const roles = await import('../src/timeline/qlTrackRoles.ts')
const spine = await import('../src/timeline/timeSpine.ts')
const registry = await import('../src/timeline/registerWorldTrackAdapters.ts')

const audioReading = () => ({
  sampleRate: 48000,
  columns: [{id: 'composition-1', name: 'Composition 1'}],
  presentedColumnId: 'composition-1',
  lanes: [
    {
      id: 'torus-voice', name: 'Torus voice', role: 'resonator',
      clips: [{id: 'c1', label: 'excited body', start_sample: '0', end_sample: '48000', standing: 'fact'}],
    },
    {
      id: 'flyby', name: 'Moving source', role: 'emitter',
      clips: [{id: 'c2', label: 'flyby', start_sample: '48000', end_sample: '96000'}],
    },
  ],
  takes: [{id: 'take-1', target: 'ql-audio:torus-voice', operation: 'record'}],
})

// ── 1 — the audio adapter: spans through the declared mapping, roles in the type ─

test('the audio adapter projects role-classified lanes with sample-exact spans converted by the declared mapping', () => {
  const set = audio.projectQlAudioTracks(audioReading())
  assert.equal(set.columns.length, 1)
  assert.deepEqual(set.tracks.map(track => track.kind), ['ql-audio/resonator', 'ql-audio/emitter'])
  const clip = set.clips[0]
  // 48000 samples @ 48 kHz = exactly 1 s through the declared mapping row.
  assert.deepEqual(clip.span, {start: 0, end: 1})
  assert.match(clip.label, /resonating body · fact/)
  // The take is transport material named as the performance-recording seed.
  assert.equal(set.transport.takes.length, 1)
  assert.match(set.transport.takes[0].name, /performance-recording seed/)
})

test('the audio adapter refuses wrong rates and miscast roles, naming the law', () => {
  assert.throws(() => audio.projectQlAudioTracks({...audioReading(), sampleRate: 44100}), /no implicit resampling/)
  assert.throws(() => audio.projectQlAudioTracks({
    ...audioReading(),
    lanes: [{id: 'ghost', name: 'Ghost', role: 'visual-only', clips: []}],
  }), /visual-only glyph does not belong on an audio track/)
  assert.throws(() => audio.projectQlAudioTracks({
    ...audioReading(),
    lanes: [{id: 'scope', name: 'Scope', role: 'analyser', clips: []}],
  }), /analysers belong to the metering surfaces/)
  assert.throws(() => audio.projectQlAudioTracks({
    ...audioReading(),
    lanes: [{id: 'bad', name: 'Bad', role: 'resonator', clips: [{id: 'x', label: 'x', start_sample: '4.5', end_sample: '8'}]}],
  }), /exact u64/)
  assert.throws(() => audio.projectQlAudioTracks({...audioReading(), presentedColumnId: 'nowhere'}), /not in the reading/)
})

// ── 2 — the physics adapter: the honest visual-only glyph, no analyser ──────

test('the physics adapter admits the visible roles (including the honestly-labelled visual-only) and refuses the analyser', () => {
  const set = physics.projectQlPhysicsTracks({
    columns: [{id: 'composition-1', name: 'Composition 1'}],
    presentedColumnId: 'composition-1',
    lanes: [
      {id: 'chladni', name: 'Chladni plate', role: 'resonator', spanUnit: 'seconds',
        clips: [{id: 'p1', label: 'plate modes', start: 0, end: 2.5, standing: 'fact'}]},
      {id: 'ghost', name: 'Glyph motion', role: 'visual-only', spanUnit: 'm1-ticks',
        clips: [{id: 'p2', label: 'glyph drift', start: 0, end: 12}]},
      {id: 'contact', name: 'Contacts', role: 'collision-trigger', spanUnit: 'engine-blocks',
        clips: [{id: 'p3', label: 'strike', start: 1, end: 2}]},
    ],
  })
  assert.deepEqual(set.tracks.map(track => track.kind), ['ql-physics/resonator', 'ql-physics/visual-only', 'ql-physics/collision-trigger'])
  const ghost = set.clips.find(clip => clip.id === 'ql-physics-clip:p2')
  assert.equal(ghost.state, 'visual-only', 'the visual-only glyph keeps its honest standing')
  assert.match(ghost.label, /visual-only/)
  assert.throws(() => physics.projectQlPhysicsTracks({
    columns: [{id: 'c', name: 'C'}], presentedColumnId: 'c',
    lanes: [{id: 'scope', name: 'Scope', role: 'analyser', spanUnit: 'seconds', clips: []}],
  }), /metering surfaces/)
})

// ── 3 — the role table IS the classification law ────────────────────────────

test('the role table classifies every role with its law; the two adapters admit complementary sets', () => {
  assert.deepEqual([...roles.QL_AUDIO_ROLES].sort(), ['collision-trigger', 'emitter', 'resonator'])
  assert.deepEqual([...roles.QL_PHYSICS_ROLES].sort(), ['collision-trigger', 'emitter', 'resonator', 'visual-only'])
  assert.equal(roles.QL_ROLE_LAWS.analyser.sounds, false)
  assert.equal(roles.QL_ROLE_LAWS['visual-only'].visualOnly, true)
  assert.match(roles.QL_ROLE_LAWS.resonator.law, /common-cause|one state/)
})

// ── 4 — the sample clock: one declared table, no silent conversion ──────────

test('every conversion is a row of the one declared table; rows carry their law', () => {
  const stratum = clock.createQlSampleClockStratum()
  assert.equal(stratum.policy.sampleRate, 48000)
  assert.equal(stratum.policy.blockFrames, 8192)
  assert.equal(stratum.policy.leadSeconds, 0.5)
  // The cross-strata rows the commission names all exist.
  const pairs = stratum.mappings.map(row => `${row.from}->${row.to}`)
  for (const expected of [
    'samples->seconds', 'samples->m1-phase', 'samples->transport', 'samples->civil-day',
    'civil-day->sky-occurrence', 'm3-inscription->m1-phase',
  ]) assert.ok(pairs.includes(expected), `the table declares ${expected}`)
  for (const row of stratum.mappings) assert.ok(row.law.length > 20, `${row.from}->${row.to} carries its law`)
})

test('samples↔seconds are exact at the declared rate; M1 phase demands a declared cadence; transport demands a declared rate', () => {
  const stratum = clock.createQlSampleClockStratum()
  const seconds = stratum.samplesToSeconds('245760')
  assert.ok(seconds.ok && seconds.value === 5.12, '245760/48000 = 5.12 s exactly')
  const back = stratum.secondsToSamples(5.12)
  assert.ok(back.ok && back.value === 245760)
  const refused = stratum.samplesToM1Phase(48000, {id: 'invented', ticksPerSecond: 7, source: 'made up'})
  assert.equal(refused.ok, false, 'an undeclared cadence is refused, never approximated')
  assert.match(!refused.ok ? refused.reason : '', /not one of the declared CADENCES/)
  const phase = stratum.samplesToM1Phase(24000, clock.QL_TICK_CADENCES[1]) // user cadence 12/s
  assert.ok(phase.ok && phase.value.tick12 === 6, '0.5 s × 12 ticks/s = 6 → tick12 6')
  assert.match(phase.carrier, /PPS user-facing tick/)
  assert.equal(stratum.samplesToTransport(48000, {name: 'x', secondsPerUnit: 0}).ok, false)
  const transport = stratum.samplesToTransport(96000, {name: 'scene-holds', secondsPerUnit: 2})
  assert.ok(transport.ok && transport.value === 1, '2 s of samples = 1 declared transport unit')
})

test('samples reach civil time only through a measured anchor; the sky occasion retains its basis; inscription maps by event', () => {
  const stratum = clock.createQlSampleClockStratum()
  const anchor = {
    samples_elapsed: '240000', atUnixMs: Date.UTC(2026, 9, 9, 12, 0, 0),
    m1: {tick12: 0, cycle: 3}, m3: {inscription_ref: '#3-controlled'},
    sky: {epoch: '1913-01-01T00:00:00Z'}, source: 'fixture owner read',
  }
  const instant = stratum.instantAtSamples('288000', anchor) // +48000 samples = +1 s
  assert.ok(instant.ok && instant.value === anchor.atUnixMs + 1000)
  assert.match(instant.carrier, /measured anchor/)
  const day = stratum.civilDayAt(instant.value)
  assert.match(day, /^\d{4}-\d{2}-\d{2}$/)
  const occasion = stratum.skyOccasionAt(anchor)
  assert.ok(occasion)
  assert.match(occasion.subject_ref, /ql:sky-occasion:1913/)
  assert.match(occasion.summary, /retained occasion/)
  // No anchor, no conversion — the refusing shape, never a guess.
  const unanchored = stratum.instantAtSamples('1', {...anchor, samples_elapsed: '12.5'})
  assert.equal(unanchored.ok, false)
  assert.equal(stratum.skyOccasionAt({...anchor, sky: null}), null, 'a sky-less anchor keeps no sky occasion')
  const inscription = stratum.inscriptionAt(anchor)
  assert.ok(inscription.ok && inscription.value === '#3-controlled')
  assert.equal(stratum.inscriptionAt({...anchor, m3: null}).ok, false, 'inscription maps by owner EVENT, never by rate')
})

test('the stratum binds read-only into the spine: an absent owner reads "no functions", a standing owner reads its cursor', () => {
  const stratum = clock.createQlSampleClockStratum()
  const timeSpine = spine.createTimeSpine()
  const bound = stratum.bindToSpine(timeSpine, () => null)
  assert.match(bound.read(), /no functions/)
  const bound2 = stratum.bindToSpine(timeSpine, () => ({
    schema: 'ql.instrument-reading/v1', standing: 'following', reason: null,
    identity: {event_ref: 'e', subject_ref: 's', registry_revision: 'r', geometry_ref: 'g', material_ref: 'm', model_ref: 'd'},
    acknowledged: {generation: '9', samples_elapsed: '96000'}, presented: {generation: '9', samples_elapsed: '96000'},
    audio: null, available: true, held: false, in_flight: false, queued_blocks: 0, queued_bytes: 0,
    coalesced_presentation_frames: 0, views: 0, disposed: false,
    playback_policy: {blockFrames: 8192, leadSeconds: 0.5, lookaheadSeconds: 0.5, owner: 'test'},
  }))
  assert.match(bound2.read(), /samples_elapsed 96000 @ 48000 Hz/)
  assert.equal(timeSpine.chronos().length, 1, 'the spine holds the binding read-only')
})

// ── 5 — the lane door: registered beside the others, family door still strict ─

test('both adapters register through the lane door; the family door refuses undeclared projection ids', async () => {
  assert.ok(registry.registeredWorldTrackAdapterIds().includes('ql-audio-track-adapter'))
  assert.ok(registry.registeredWorldTrackAdapterIds().includes('ql-physics-track-adapter'))
  assert.equal(registry.isManifestDeclared('ql-audio-track-adapter'), false,
    'the manifest projection declaration is the QL family owner\'s move — named in L9\'s honesty list')
  await assert.rejects(() => registry.projectWorldTracks('ql-audio-track-adapter', audioReading()), /not declared by any admitted family manifest/)
  const set = await registry.projectLaneWorldTracks('ql-audio-track-adapter', audioReading())
  assert.equal(set.clips.length, 2, 'the lane door projects the same adapters')
  const physicsSet = await registry.projectLaneWorldTracks('ql-physics-track-adapter', {
    columns: [{id: 'c', name: 'C'}], presentedColumnId: 'c',
    lanes: [{id: 'plate', name: 'Plate', role: 'resonator', spanUnit: 'seconds', clips: [{id: 'p', label: 'p', start: 0, end: 1}]}],
  })
  assert.equal(physicsSet.clips.length, 1)
})

// ── 6 — the adapters and the clock stay pure ────────────────────────────────

test('the timeline-side law modules import no React and no view', async () => {
  for (const file of [
    'src/timeline/qlAudioTrackAdapter.ts',
    'src/timeline/qlPhysicsTrackAdapter.ts',
    'src/timeline/qlSampleClock.ts',
    'src/timeline/qlTrackRoles.ts',
  ]) {
    const source = await readFile(new URL(`../${file}`, import.meta.url), 'utf8')
    assert.doesNotMatch(source, /from ['"]react/, `${file} stays pure`)
    assert.doesNotMatch(source, /from ['"].*\.tsx['"]/, `${file} imports no view`)
  }
})
