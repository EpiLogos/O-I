import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'

// The Live mode catalogue (T-LIVE-MODE-SCALES, leg 2): the owner's
// `ql music modes --json` reading (ql.music-modes/v1, QL-MEF PR #330) is parsed
// strictly into the shell's KernelScale rows. Exact intervals travel with each
// row; a quarter-tone maqam keeps its owner quarter-tone steps and cents and is
// never converted to 12-TET; absent sources are named. Fixtures are the real
// row shapes (ql-mef music.rs / m2.rs), trimmed to a few rows each.
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

const {parseQlMusicModes, resolveModeInForce, catalogueStatusLine, scalesOnRoot} = await import('../src/live/modes.ts')
const {readQlMusicModes} = await import('../src/native/liveModeCatalogue.ts')

const provenance = (symbol) => ({operator: 'mode_tonic_instance', owner: 'ql-mef', revision: '1.0.0', source: {blob: 'b', path: 'docs/sources/ql-musical-derivation-v3.md', vendor_commit: 'c', version: '1.0.0'}, symbol})

const aeolian = {
  anchor_basis: 'chromatic', context_frame: 'CF6', key: "chromatic/L0'/aeolian", kind: 'lens-cf', label: "aeolian on L0', chromatic basis",
  lens: "L0'", mode: 'aeolian', pitches: [10, 0, 1, 3, 5, 6, 8], provenance: provenance('mode_tonic_landscape'),
  scale_beneath_tonic: 1, steps_semitones: [2, 1, 2, 2, 1, 2, 2], tonic: 10, tuning: null,
}
const dorian = {
  anchor_basis: 'chromatic', context_frame: 'CF2', key: "chromatic/L0'/dorian", kind: 'lens-cf', label: "dorian on L0', chromatic basis",
  lens: "L0'", mode: 'dorian', pitches: [3, 5, 6, 8, 10, 0, 1], provenance: provenance('mode_tonic_landscape'),
  scale_beneath_tonic: 1, steps_semitones: [2, 1, 2, 2, 2, 1, 2], tonic: 3, tuning: null,
}
const maqam = {
  cents_from_root: [0, 200, 350, 500, 700, 850, 1000, 1200], family: 'maqam', family_ratio: {den: 22, num: 27}, key: 'maqam/09',
  kind: 'source', label: 'Maqam 9 (family 0, mode 0)', maqam_family: 0, mode_in_family: 0, pitches: null, planet_ruler: 0,
  provenance: {owner: 'ql-mef', ratio_symbol: 'M2_MAQAM_RATIOS', ratio_table: 'ratio', registry_revision: 'r1', revision: 'r1', source_symbol: 'M2_MAQAM_DESC', sources: [{path: 'vendor/epi-kernel/reference/src/m2.c', sha256: 'h'}], symbol: 'maqam_pitches', table: 'maqam'},
  quarter_tone_steps: [4, 3, 3, 4, 3, 3, 4], quarter_tones_from_root: [0, 4, 7, 10, 14, 17, 20, 24], tuning: null, tuning_unit: 'quarter-tone',
}
const absent = [
  {scale: 'shem', status: 'absent', table: 'shem', register: 'Register72::Shem', reason: 'no pitch set is retained for Shem'},
  {scale: 'ficino-planetary', status: 'needs owner authoring', reason: 'ql-mef holds no Ficino reading'},
]
const bases = [
  {basis: 'chromatic', conjugate_axis_semitones: 1, generator_ratio: {den: 8, num: 9}, generator_semitones: 2},
  {basis: 'fifths', conjugate_axis_semitones: 6, generator_ratio: {den: 2, num: 3}, generator_semitones: 7},
]
const document = () => structuredClone({
  schema: 'ql.music-modes/v1', bases, lens_cf: [aeolian, dorian], source_scales: [maqam], sources_absent: absent,
  provenance: {m2_registry_revision: 'r1', musical_derivation: {blob: 'b', path: 'docs/sources/ql-musical-derivation-v3.md', vendor_commit: 'c', version: '1.0.0'}, owner: 'ql-mef'},
})

function refusal(mutate) {
  const raw = document()
  mutate(raw)
  const parsed = parseQlMusicModes(raw)
  assert.equal(parsed.ok, false, 'the malformed reading is refused')
  return parsed.refusal
}

test('a real-shaped ql.music-modes/v1 reading parses into lens and source rows with their exact intervals', () => {
  const parsed = parseQlMusicModes(document())
  assert.equal(parsed.ok, true, parsed.refusal)
  const {catalogue} = parsed
  assert.equal(catalogue.schema, 'ql.music-modes/v1')
  assert.deepEqual(catalogue.bases.map(b => b.basis), ['chromatic', 'fifths'])
  assert.equal(catalogue.scales.length, 3)
  const lens = catalogue.scales.find(s => s.key === aeolian.key)
  assert.equal(lens.kind, 'lens-cf')
  assert.equal(lens.anchorBasis, 'chromatic')
  assert.equal(lens.contextFrame, 'CF6')
  assert.deepEqual([...lens.pitches], aeolian.pitches)
  assert.deepEqual([...lens.stepsSemitones], aeolian.steps_semitones, 'the lens row carries its semitone intervals')
  assert.equal(lens.tuning, null, 'no tuning is declared for a lens row, and none is assumed')
  assert.deepEqual(lens.provenance, {owner: 'ql-mef', symbol: 'mode_tonic_landscape', revision: '1.0.0'})
})

test('a maqam row maps its quarter-tone tuning exactly, never converted to 12-TET', () => {
  const {catalogue} = parseQlMusicModes(document())
  const source = catalogue.scales.find(s => s.key === maqam.key)
  assert.equal(source.kind, 'source')
  assert.equal(source.pitches, null, 'a maqam serves no pitch-class set')
  assert.deepEqual(source.tuning, {unit: 'quarter-tone', steps: [4, 3, 3, 4, 3, 3, 4], fromRoot: [0, 4, 7, 10, 14, 17, 20, 24], cents: [0, 200, 350, 500, 700, 850, 1000, 1200]})
  assert.deepEqual(source.familyRatio, {num: 27, den: 22})
  assert.equal(source.provenance.symbol, 'maqam_pitches')
})

test('the absent sources are carried by name', () => {
  const {catalogue} = parseQlMusicModes(document())
  assert.deepEqual(catalogue.sourcesAbsent.map(a => a.scale), ['shem', 'ficino-planetary'])
  assert.equal(catalogue.sourcesAbsent[1].status, 'needs owner authoring')
})

test('a reading that is not ql.music-modes/v1 is refused by name', () => {
  assert.match(refusal(raw => { raw.schema = 'ql.music-modes/v2' }), /not a ql\.music-modes\/v1 reading/)
  assert.match(refusal(raw => { delete raw.lens_cf }), /lens_cf/)
  assert.match(parseQlMusicModes(null).refusal, /not a ql\.music-modes\/v1 reading/)
})

test('a row the owner did not state exactly is refused, not shaped into a mode', () => {
  assert.match(refusal(raw => { raw.lens_cf[0].anchor_basis = 'pythagorean' }), /anchor_basis/)
  assert.match(refusal(raw => { raw.lens_cf[0].pitches = [10, 0, 1, 3, 5, 6, 9] }), /pitches/)
  assert.match(refusal(raw => { raw.lens_cf[0].steps_semitones = [2, 1, 2, 2, 1, 2, 0] }), /steps_semitones/)
  assert.match(refusal(raw => { raw.lens_cf[0].tuning = [{num: 9, den: 8}] }), /tuning/)
  assert.match(refusal(raw => { raw.lens_cf[1].key = raw.lens_cf[0].key }), /duplicate key/)
  assert.match(refusal(raw => { raw.lens_cf[0].provenance.owner = 'shell' }), /provenance/)
  assert.match(refusal(raw => { raw.source_scales[0].tuning_unit = 'third-tone' }), /tuning_unit/)
  assert.match(refusal(raw => { raw.source_scales[0].quarter_tones_from_root = [0, 4, 7, 10, 14, 17, 20, 23] }), /quarter_tones_from_root/)
  assert.match(refusal(raw => { raw.source_scales[0].cents_from_root = [0, 200, 350, 500, 700, 850, 1000] }), /cents_from_root/)
  assert.match(refusal(raw => { raw.source_scales[0].family_ratio = {num: 0, den: 22} }), /family_ratio/)
})

test('a catalogued quarter-tone maqam is in force with its exact tuning on the status line', () => {
  const {catalogue} = parseQlMusicModes(document())
  const reading = resolveModeInForce(catalogue.scales, {key: maqam.key, root: 2})
  assert.equal(reading.state, 'in-force')
  assert.match(reading.line, /tuning: quarter-tone steps 4 3 3 4 3 3 4 \(from root 0 4 7 10 14 17 20 24; cents 0 200 350 500 700 850 1000 1200\), exact/)
  assert.doesNotMatch(reading.line, /12-TET|equal temperament is/)
})

test('the status line names the mode in force, its provenance and the absent sources by name', () => {
  const {catalogue} = parseQlMusicModes(document())
  const mode = resolveModeInForce(catalogue.scales, {key: aeolian.key, root: 10})
  const line = catalogueStatusLine(catalogue, mode)
  assert.match(line, /^Mode in force — aeolian on L0', chromatic basis on pitch class 10 · ql-mef mode_tonic_landscape@1\.0\.0/)
  assert.match(line, /absent: shem \(absent\), ficino-planetary \(needs owner authoring\)$/)
})

test('a root offers the lens/CF instances whose tonic it is, grouped by basis, and every maqam from the root; nothing is transposed', () => {
  const {catalogue} = parseQlMusicModes(document())
  const on = root => scalesOnRoot(catalogue, root).map(g => [g.label, g.scales.map(s => s.key)])
  assert.deepEqual(on(10), [['chromatic basis', [aeolian.key]], ['source scales, from the root', [maqam.key]]])
  assert.deepEqual(on(3), [['chromatic basis', [dorian.key]], ['source scales, from the root', [maqam.key]]])
  assert.deepEqual(on(0), [['source scales, from the root', [maqam.key]]], 'no lens instance stands on C in this reading, so none is offered')
})

test('the native read answers the catalogue once, and names each refusal it is given', async () => {
  const served = await readQlMusicModes(async op => {
    assert.deepEqual(op, {op: 'music_modes_read'})
    return {outcome: {result: 'music_modes_reading', document: document()} }
  })
  assert.equal(served.state, 'ready')
  assert.equal(served.catalogue.scales.length, 3)

  const absentQl = await readQlMusicModes(async () => ({outcome: null, error: 'quaternal-logic is not installed at /x/ql'}))
  assert.equal(absentQl.state, 'refused')
  assert.match(absentQl.reason, /quaternal-logic is not installed/)

  const olderQl = await readQlMusicModes(async () => ({outcome: null, error: 'ql-music.unsupported: the installed quaternal-logic has no `music modes --json` reading (exit 2)'}))
  assert.match(olderQl.reason, /has no `music modes --json` reading/)

  const wrongAnswer = await readQlMusicModes(async () => ({outcome: {result: 'system_composition_reading'}}))
  assert.equal(wrongAnswer.state, 'refused')
  assert.match(wrongAnswer.reason, /music_modes_reading/)

  const badDocument = await readQlMusicModes(async () => ({outcome: {result: 'music_modes_reading', document: {schema: 'ql.music-modes/v1'}}}))
  assert.equal(badDocument.state, 'refused', 'a document the shell cannot validate is refused, not shown')
})

// ── the one mode in force: transport, clip and Jankó surface read the same answer ──

const {setModeInForce} = await import('../src/native/liveModeCatalogue.ts')
const {JankoDeviceView} = await import('../src/live/janko/JankoDevice.tsx')
const React = await import('react')
const {renderToStaticMarkup} = await import('react-dom/server')
const {pitchMask} = await import('../src/live/modes.ts')
const {readFileSync} = await import('node:fs')
const {readJankoWindow} = await import('../src/live/janko/jankoLayout.ts')

test('the set\'s mode in force is one reading of the catalogue and the hold; a held scale off its root is not in force', () => {
  const {catalogue} = parseQlMusicModes(document())
  const ready = {state: 'ready', catalogue}
  const inForce = setModeInForce(ready, {key: aeolian.key, root: 10})
  assert.equal(inForce.mode.state, 'in-force')
  assert.equal(inForce.mode.selection.scale.key, aeolian.key)
  assert.equal(setModeInForce(ready, {key: aeolian.key, root: 3}).mode.state, 'waiting', 'aeolian on L0\' is a tonic instance on A♯ only')
  const maqamOn = setModeInForce(ready, {key: maqam.key, root: 7})
  assert.equal(maqamOn.mode.state, 'in-force', 'a maqam is stated from the root, on any root')
  assert.equal(pitchMask(maqamOn.mode.selection.scale), null, 'and it serves no pitch set: nothing is marked in 12-TET')
  const waiting = setModeInForce({state: 'refused', reason: 'ql-music.unsupported: old ql'}, {key: null, root: 0})
  assert.match(waiting.line, /ql-music.unsupported: old ql/)
})

test('the Jankó surface recolours to the mode in force, and marks nothing without a pitch set', () => {
  const window = JSON.parse(readFileSync(new URL('./fixtures/janko-window-v1.json', import.meta.url), 'utf8'))
  const mask = pitchMask(parseQlMusicModes(document()).catalogue.scales.find(s => s.key === aeolian.key))
  const marked = renderToStaticMarkup(React.createElement(JankoDeviceView, {windowState: readJankoWindow(window), modeMask: mask, modeLine: 'Mode in force — aeolian'}))
  assert.match(marked, /data-janko-mode="in-force"/)
  const inMode = (marked.match(/data-janko-in-mode="yes"/g) || []).length, outside = (marked.match(/data-janko-in-mode="no"/g) || []).length
  assert.equal(inMode + outside, 36, 'every key says whether it is in the mode')
  assert.equal(inMode, 21, 'seven classes, each on three touch-points of a six-column window')
  assert.match(marked, /, in the mode"/)
  const plain = renderToStaticMarkup(React.createElement(JankoDeviceView, {windowState: readJankoWindow(window), modeMask: null}))
  assert.doesNotMatch(plain, /data-janko-in-mode/)
  assert.match(plain, /data-janko-mode="none"/)
})

test('the Clip view\'s mode row reads the set\'s mode in force, not an empty document value', () => {
  // live/LiveClip.tsx (was the clip inspector's Scale pair in components/DeviceChainPanel.tsx; rendered in live-detail-clip.test.mjs)
  const clip = readFileSync(new URL('../src/live/LiveClip.tsx', import.meta.url), 'utf8')
  assert.match(clip, /useLiveModeInForce\(\)/)
  assert.match(clip, /\{key: 'mode', value: held \? `\$\{PITCH_CLASS_NAMES\[held\.root\]\} \$\{held\.scale\.label\}` : null,/)
  assert.match(clip, /this clip carries no mode of its own yet/)
})
