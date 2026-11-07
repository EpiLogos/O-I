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
// The frame's lazy parts (a mode's bodies, its transport and tracks, a device's face) load when first drawn (shell/loadWhenDrawn.ts;
// O-I #740); a server render cannot wait for a module, so they are fetched first and every body renders itself.
await (await import('../src/shell/loadWhenDrawn.ts')).loadEveryPart()

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

// Walk #857 (Arriving, 7 Nov): a clip whose document carries no scale of its own (the owner discloses no `scale`) is drawn by the roll in
// no mode at all: Highlight Scale marked nothing and Fold to Scale kept no row, though the set had a mode in force and the binding hands
// it over (set.root, set.mode) for exactly this.
test('the roll follows the set\'s mode in force while the clip carries none of its own: Highlight Scale marks it, Fold to Scale keeps it', async () => {
  const {clip: design} = await import('../src/inhabitants/catalogue/clips/live.tsx')
  const roll = v => renderToStaticMarkup(createElement(() => design.editor.find(item => item.id === 'notes').draw({v, set: () => {}, size: 'whole', room: {w: 800, h: 320}})))
  // A♯ aeolian (inForce): pitch classes 10, 0, 1, 3, 5, 6, 8; one note on C2 (36) draws rows 33–39, of which 34, 36, 37 and 39 are in the mode.
  const values = {...clipOf({track: 0, scene: 0}).values, notes: JSON.stringify([{id: '1', p: 36, at: 0, len: 1, vel: 100}])}
  assert.equal('scale' in values, false, 'the clip discloses no scale of its own')
  // Each row is drawn twice, its key and its lane (clipKit.tsx): the lanes are counted.
  const marked = html => (html.match(/class="clv-lane"[^>]*data-marked="true"/g) ?? []).length
  assert.equal(marked(roll({...values, highlight: true})), 4, 'Highlight Scale marks the set\'s mode in force')
  const folded = roll({...values, foldScale: true})
  assert.equal((folded.match(/class="clv-lane"/g) ?? []).length, 4, 'Fold to Scale keeps the mode\'s rows')
  const waitingValues = {...clipOf({track: 0, scene: 0}, {state: 'waiting', selection: null, line: modes.LIVE_MODE_SEAM}).values, notes: values.notes}
  assert.equal(marked(roll({...waitingValues, highlight: true})), 0, 'no mode in force: nothing is marked, no mode is invented')
})

// Walk #857 (Arriving, 7 Nov): the grid's clip menu (Rename, Switch off, a colour) writes through the binding Clip view holds, found by the
// grid's clip id (frame/menu/objectDoor.ts bindsClip). Live's binding answered to neither the grid's id (als:<set>#track/<i>/slot/<s>)
// nor named it as its clip, so every such act waited out "Clip view did not come to hold the clip" with the clip open in Clip view.
test('the grid\'s clip menu finds the Live clip Clip view holds, by the grid\'s own id for it', async () => {
  const door = await import('../src/frame/menu/objectDoor.ts')
  const slot = clipOf({track: 0, scene: 0})
  assert.equal(door.bindsClip(slot, `als:${SET.path}#track/0/slot/0`), true, 'a session clip')
  assert.equal(door.bindsClip(slot, `als:${SET.path}#track/0/slot/1`), false, 'not another slot\'s')
  assert.equal(door.bindsClip(slot, `als:${SET.path}#track/1/slot/0`), false, 'not another track\'s')
  const placed = clipOf({track: 0, scene: null, clip: 0})
  if (placed) assert.equal(door.bindsClip(placed, `als:${SET.path}#track/0/clip/0`), true, 'an arrangement clip')
})

// Walk #857 (Arriving, 7 Nov): Insert clip writes Live's default, an unnamed MidiClip (Name Value=""), and the set's owner reads its slot as
// "". The grid drew it, but Clip view said "Select a clip" and the clip could not be opened: an empty name is still a clip; only null is
// an empty slot.
test('an unnamed session clip is a clip: Clip view opens it, as Live opens a clip it has not named', () => {
  const named = DOC.tracks[0].sessionSlots
  DOC.tracks[0].sessionSlots = {0: '', 1: null}
  try {
    const binding = clipOf({track: 0, scene: 0})
    assert.notEqual(binding, null, 'the unnamed clip is read')
    assert.equal(binding.values.name, '')
    assert.equal(clipOf({track: 0, scene: 1}), null, 'an empty slot (null) is still no clip')
  } finally { DOC.tracks[0].sessionSlots = named }
})

test('the head: the clip and its track (the mockup\'s "Kit 1 — Drums · clip")', () => {
  const detail = {live: {ctx: {set: SET}, document: DOC, selection: {track: 0, scene: 0}}}
  assert.deepEqual(MODE_DETAILS.live.head.clip({detail, selected: {ref: null, clip: null, track: null, set: null}, instrument: null}), {name: 'Kit 1', line: 'Torus · clip'})
  assert.deepEqual(MODE_DETAILS.live.head.clip({detail: {live: {ctx: {set: SET}, document: DOC, selection: {track: 0, scene: 1}}}, selected: {ref: null, clip: null, track: null, set: null}, instrument: null}), {name: 'Clip'})
})

test('code-reading: Live\'s Clip side hosts clip:live on its binding; the old props rows and empty roll are retired', async () => {
  // Live's clip body is its own module, loaded with Live (shell/details/live.tsx; O-I #740), registered by the detail table.
  const details = await readFile(new URL('../src/shell/details/live.tsx', import.meta.url), 'utf8')
  assert.match(details, /function LiveClip\(\{place\}: \{place: ClipPlace\}\) \{ return <Hosted binding=\{useLiveClip\(\)\}/)
  assert.match(await readFile(new URL('../src/shell/modeDetails.tsx', import.meta.url), 'utf8'), /const LiveClip: ClipBody = loadWhenDrawn\('Live\\'s clip', \(\) => import\('\.\/details\/live'\)/)
  const clip = await readFile(new URL('../src/live/LiveClip.tsx', import.meta.url), 'utf8')
  assert.doesNotMatch(clip, /ClipView|LiveNoteRoll|liveClipRows/)
  assert.match(clip, /export function liveClipOf\(/, 'the clip reader stays: the head and the binding read it')
})
