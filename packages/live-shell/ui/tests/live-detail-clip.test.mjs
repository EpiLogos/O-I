import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'

// Live's Clip side (manual §21.1; lock §0.2.5): since R2 the clip is clip:live — Live's Clip view panel for panel — on Live's clip
// binding (live/clipBinding.ts): the clip's name on its track's colour, the set's mode in force for the roll to follow, and what the
// set's owner does not disclose left absent (the design draws "—"). An arrangement clip is placed, with no Launch tab; an audio clip
// lacks the notes' tabs. Fixture readings (scripted); loader as detail-host.test.mjs.
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
const live = await import('../src/live/clipBinding.ts')
const modes = await import('../src/live/modes.ts')
const {publishTimelineReading} = await import('../src/projections/timelinePaneHost.ts')
const {publishShownTracks} = await import('../src/frame/tracks/tracksDoor.ts')
const {MODE_TRACKS} = await import('../src/frame/tracks/modeTracks.ts')
const {MODE_DETAILS} = await import('../src/shell/modeDetails.tsx')
const {DetailHost} = await import('../src/frame/detail/DetailHost.tsx')
const {DetailContext} = await import('../src/frame/detail/detailReading.ts')

const SET = {path: '/sets/mercurius.als', tempo_bpm: 120, scene_count: 2, arrangement_clips: 1, tracks: [{kind: 'midi', name: 'Torus', devices: []}, {kind: 'audio', name: 'Voice', devices: []}]}
const DOC = {path: '/sets/mercurius.als', tempo: 120, scenes: 2, tracks: [
  {kind: 'midi', name: 'Torus', devices: [], arrangementClips: [{name: 'Swell', kind: 'midi', start: 8, end: 24}], sessionSlots: {0: 'Kit 1', 1: null}},
  {kind: 'audio', name: 'Voice', devices: [], arrangementClips: [], sessionSlots: {0: 'Take 3'}},
]}
const clipOf = (selection, mode = inForce) => live.liveClipBinding({set: SET, document: DOC, selection, mode, colour: '#e2a35e'})
/** THE selection on the shared grid, and the tracks the pane draws (Live's set adapter), as the frame publishes them. */
const select = ref => {
  const reading = {mode: 'live', set: SET, document: DOC, colors: ['#e2a35e', '#c9a0dc'], selection: {track: 0, scene: null}, select() {}, setColor() {}, selectedRef: ref, selectTrackItem() {}}
  publishTimelineReading(reading); publishShownTracks(MODE_TRACKS.live(reading))
}
const clear = () => { publishTimelineReading(null); publishShownTracks(null) }

// The owner's catalogue row for one mode (as live-modes-catalogue.test.mjs states it): aeolian on L0' over the chromatic basis.
const aeolian = {anchor_basis: 'chromatic', context_frame: 'CF6', key: "chromatic/L0'/aeolian", kind: 'lens-cf', label: "aeolian on L0', chromatic basis",
  lens: "L0'", mode: 'aeolian', pitches: [10, 0, 1, 3, 5, 6, 8], scale_beneath_tonic: 1, steps_semitones: [2, 1, 2, 2, 1, 2, 2], tonic: 10, tuning: null,
  provenance: {operator: 'mode_tonic_instance', owner: 'ql-mef', revision: '1.0.0', source: {blob: 'b', path: 'docs/sources/ql-musical-derivation-v3.md', vendor_commit: 'c', version: '1.0.0'}, symbol: 'mode_tonic_landscape'}}
const catalogue = modes.parseQlMusicModes({schema: 'ql.music-modes/v1', lens_cf: [aeolian], source_scales: [], sources_absent: [], provenance: {m2_registry_revision: 'r1', owner: 'ql-mef'},
  bases: [{basis: 'chromatic', conjugate_axis_semitones: 1, generator_ratio: {den: 8, num: 9}, generator_semitones: 2}]})
assert.equal(catalogue.ok, true, catalogue.refusal)
const inForce = modes.resolveModeInForce(catalogue.catalogue.scales, {key: aeolian.key, root: 10})

test('nothing of the set selected: no clip, so the Clip side is the host\'s one waiting line', () => {
  assert.equal(clipOf({track: 0, scene: null}), null)
  assert.match(MODE_DETAILS.live.clipWaits, /Select a clip in the Session or the Arrangement/)
})

test('an arrangement clip: its name on its track\'s colour; placed on the ruler, so no Launch; its own markers not disclosed', () => {
  const binding = clipOf({track: 0, scene: null, clip: 0})
  assert.equal(binding.values.name, 'Swell'); assert.equal(binding.values.colour, '#e2a35e')
  assert.equal(binding.placed, true, 'a clip laid on Arrangement view\'s ruler is not launched (Live cap 47)')
  for (const key of ['start', 'end', 'loop', 'length', 'sig.num', 'groove', 'launch', 'follow', 'notes']) assert.equal(key in binding.values, false, `${key}: not disclosed, drawn "—"`)
})

test('a session clip on an audio track: it launches, and lacks Notes, MPE and the MIDI tools', () => {
  const binding = clipOf({track: 1, scene: 0})
  assert.equal(binding.values.name, 'Take 3'); assert.equal(binding.placed, undefined)
  assert.deepEqual(binding.lacks, ['notes', 'mpe', 'pitch', 'transform', 'generate'])
})

test('the mode the clip plays in: the set\'s mode in force, which the roll follows while the clip carries none of its own', () => {
  const binding = clipOf({track: 0, scene: 0}, inForce)
  assert.equal(binding.values['set.root'], 10); assert.equal(binding.values['set.mode'], 'aeolian')
  assert.equal('scale' in binding.values, false, 'the clip\'s own scale is not disclosed')
  assert.equal('set.root' in clipOf({track: 0, scene: 0}, {state: 'waiting', selection: null, line: modes.LIVE_MODE_SEAM}).values, false, 'no mode is invented while it is read')
})

test('the head: the clip and its track (the mockup\'s "Kit 1 — Drums · clip")', () => {
  const detail = {live: {ctx: {set: SET}, document: DOC, selection: {track: 0, scene: 0}}}
  assert.deepEqual(MODE_DETAILS.live.head.clip({detail, selected: {ref: null, clip: null, track: null, set: null}, instrument: null}), {name: 'Kit 1', line: 'Torus · clip'})
  assert.deepEqual(MODE_DETAILS.live.head.clip({detail: {live: {ctx: {set: SET}, document: DOC, selection: {track: 0, scene: 1}}}, selected: {ref: null, clip: null, track: null, set: null}, instrument: null}), {name: 'Clip'})
})

test('code-reading: Live\'s Clip side hosts clip:live on its binding; the old props rows and empty roll are retired', async () => {
  const details = await readFile(new URL('../src/shell/modeDetails.tsx', import.meta.url), 'utf8')
  assert.match(details, /function LiveClip\(\{place\}: \{place: ClipPlace\}\) \{ return <Hosted binding=\{useLiveClip\(\)\}/)
  const clip = await readFile(new URL('../src/live/LiveClip.tsx', import.meta.url), 'utf8')
  assert.doesNotMatch(clip, /ClipView|LiveNoteRoll|liveClipRows/)
  assert.match(clip, /export function liveClipOf\(/, 'the clip reader stays: the head and the binding read it')
})
