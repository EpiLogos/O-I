import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'

// Live's Clip side in the shared Clip view anatomy (ticket D; manual §3; lock §0.2.5; frame/detail/ClipView.tsx; the mockup's
// liveDetail() clip, world-shell-mockup.html:1761): the clip's name on its track's colour, its props as the set's owner discloses
// them and "—" where it does not, the mode it plays in, and beside them the Notes column — the roll's frame marked by the mode in
// force and one line for the notes the owner does not disclose yet. Rendered headless from fixture readings (scripted).
// Loader as detail-host.test.mjs.
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
const clipView = await import('../src/live/LiveClip.tsx')
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
const clipSide = selection => renderToStaticMarkup(createElement(chain.DeviceChainPanel, {ctx: {set: SET, loading: false, error: null}, document: DOC, selection, mode: 'clip'}))
const rows = markup => Object.fromEntries([...markup.matchAll(/data-row="([^"]+)"[^>]*><span>[^<]*<\/span><span[^>]*>([^<]*)<\/span>/g)].map(match => [match[1], match[2]]))
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

test('nothing of the set selected: the Clip side is one line in the host\'s waiting idiom', () => {
  const markup = clipSide({track: 0, scene: 1})
  assert.equal(markup, '<p class="clip-empty" role="status">Select a clip in the Session or the Arrangement to see it here.</p>')
})

test('an arrangement clip: its name on its track\'s colour, its place on the set\'s ruler, and "—" for what the owner does not disclose', () => {
  select('als:/sets/mercurius.als#track/0/clip/0')
  try {
    const markup = clipSide({track: 0, scene: null, clip: 0})
    assert.match(markup, /<div class="clipv" data-clip-view="live">/, 'the shared Clip view')
    assert.match(markup, /<div class="cph" style="--cph:#e2a35e;--cph-ink:var\(--bg-0\)" title="Swell">Swell<\/div>/, 'the name on its track\'s colour')
    assert.deepEqual(rows(markup), {track: 'Torus', start: '3.1', end: '7.1', length: '16 beats', loop: '—', launch: '—', then: '—', signature: '—', groove: '—', mode: '—', transpose: '—'})
    assert.match(markup, /title="8 beats from the set&#x27;s start \(the document&#x27;s own value\)"/, 'the lossless value stands behind the ruler\'s label')
    assert.match(markup, /<section class="ccol" aria-label="Notes" data-column="Notes"><h5>Notes<\/h5>/)
    assert.equal((markup.match(/class="live-roll-row"/g) ?? []).length, 12, 'the roll\'s twelve pitch classes')
    assert.match(markup, /The set&#x27;s owner does not disclose a clip&#x27;s notes yet; the roll fills when it does\./)
    for (const gone of [/<button/, /<input/, /clip-inspector/, /note-editor/, /Fit to Scale/, /Duplicate/]) assert.doesNotMatch(markup, gone, 'no control without an owner write')
  } finally { clear() }
})

test('a session clip on an audio track: its start and end are not disclosed, and its column is the sample', () => {
  select('als:/sets/mercurius.als#track/1/slot/0')
  try {
    const markup = clipSide({track: 1, scene: 0})
    assert.match(markup, />Take 3<\/div>/)
    assert.equal(rows(markup).start, '—'); assert.equal(rows(markup).length, '—')
    assert.match(markup, /data-column="Sample"/)
    assert.match(markup, /The set&#x27;s owner does not disclose an audio clip&#x27;s sample yet\./)
  } finally { clear() }
})

test('the mode the clip plays in: the set\'s mode in force (no clip carries its own yet), and the roll marks its pitch classes', () => {
  const clip = {name: 'Swell', track: 'Torus', kind: 'midi', at: {start: 8, end: 24}}
  const mode = clipView.liveClipRows(clip, [], inForce, beats => String(beats)).find(row => row.key === 'mode')
  assert.equal(mode.value, "A♯ aeolian on L0', chromatic basis")
  assert.match(mode.title, /^The set's mode in force; this clip carries no mode of its own yet\./)
  const roll = renderToStaticMarkup(createElement(clipView.LiveNoteRoll, {clip, mode: inForce, label: beats => String(beats)}))
  const marks = [...roll.matchAll(/data-in-mode="(yes|no)"><span class="live-roll-key">([^<]+)</g)].map(match => `${match[2]}:${match[1]}`)
  assert.deepEqual(marks.filter(mark => mark.endsWith(':yes')).map(mark => mark.split(':')[0]).sort(), ['A♯', 'C', 'C♯', 'D♯', 'F', 'F♯', 'G♯'].sort(), 'the owner\'s pitch set, lifted')
  assert.match(roll, /class="live-roll-ruler"/, 'the clip\'s bars along the top')
  assert.equal((roll.match(/<span>(8|12|16|20)<\/span>/g) ?? []).length, 4, 'four bars of four beats')
})

test('the head: the clip and its track (the mockup\'s "Kit 1 — Drums · clip")', () => {
  const detail = {live: {ctx: {set: SET}, document: DOC, selection: {track: 0, scene: 0}}}
  assert.deepEqual(MODE_DETAILS.live.head.clip({detail, selected: {ref: null, clip: null, track: null, set: null}, instrument: null}), {name: 'Kit 1', line: 'Torus · clip'})
  assert.deepEqual(MODE_DETAILS.live.head.clip({detail: {live: {ctx: {set: SET}, document: DOC, selection: {track: 0, scene: 1}}}, selected: {ref: null, clip: null, track: null, set: null}, instrument: null}), {name: 'Clip'})
})

test('in the host: the clip box stands down over the Clip view, whose props carry its facts', () => {
  select('als:/sets/mercurius.als#track/0/clip/0')
  try {
    const detail = {mode: 'live', transport: {kind: 'unavailable'}, world: null, worldCut: false, centralSubject: null, native: {}, factory: {tracks: [], task: {taskLabel: null}},
      focusedInstrument: null, live: {ctx: {set: SET, loading: false, error: null, openSet() {}}, document: DOC, selection: {track: 0, scene: null, clip: 0}}}
    const markup = renderToStaticMarkup(createElement(DetailContext.Provider, {value: detail}, createElement(DetailHost, {side: 'clip'})))
    assert.match(markup, /<header class="detail-head"[^>]*><b>Swell<\/b><span class="detail-head-line"> — Torus · clip<\/span><\/header>/)
    assert.match(markup, /data-detail-body="live:clip"/)
    assert.match(markup, /data-clip-view="live"/)
  } finally { clear() }
})

test('code-reading: the Clip side names the reader it replaces and draws through the shared anatomy', async () => {
  const source = await readFile(new URL('../src/live/LiveClip.tsx', import.meta.url), 'utf8')
  assert.match(source, /Replaces components\/DeviceChainPanel\.tsx:62-63's clip side/)
  assert.match(source, /<ClipView kind="live"/)
})
