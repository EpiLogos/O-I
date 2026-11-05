// A performance is kept whole (O-I #855): Live's half. DLW manual §21.2 Transport, "Record | Records what you play into Arrangement view as
// notes"; §21.1 Takes and Arrangement lanes, "Record a part and each pass lies as a take lane under its track"; §21.2 Rules, "A recorded
// performance keeps what it needs to be played on … Where the field's motion cannot be replayed exactly, the recording says from which
// state it resumes", and "A saved sound keeps every parameter … It opens with the same sound".
//
// What Record records is what the part's one playing path played (live/janko/jankoInput.ts onNote): a note's number, the key it struck on
// the owner's Jankó surface, its strength and its source; a clip's notes and the sitting's bell are not played by hand and are not recorded.
// The take is laid in the set by its owner (packages/live-set acts.rs take_record, tests/takes_855.rs) with what Live's document cannot hold
// beside it (the keys, the strengths, the Torus as it stood and its moves, where it resumes from); the part keeps the Torus with the set
// (torus_keep) and a set opened again sets the Torus as its part keeps it. A take played again sets its Torus first (clipPlayer `prepare`).
//
// Channels: the playing path is the real one (createJankoInput) over the owner's window fixture (tests/fixtures/janko-window-v1.json);
// the Torus's state is shaped as the boundary reads the frame's announcement (as tests/torus-850.test.mjs); the set's owner, the Torus's
// owner and the clocks are fakes the test drives. No device is opened, no sound is made.
import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'
import {readFileSync} from 'node:fs'

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

globalThis.document ??= {getElementById: () => null, createElement: () => ({}), head: {appendChild: () => {}}}
const take = await import('../src/live/liveTake.ts')
const keys = await import('../src/live/janko/jankoInput.ts')
const player = await import('../src/live/clipPlayer.ts')
const layout = await import('../src/live/janko/jankoLayout.ts')
const {readInstrumentEdit} = await import('../../../expressions-boundary/src/protocol.ts')
const windowState = layout.readJankoWindow(JSON.parse(readFileSync(new URL('./fixtures/janko-window-v1.json', import.meta.url), 'utf8')))
const REAL = JSON.parse(readFileSync(new URL('./fixtures/live-clip-read-2026-10-28.json', import.meta.url), 'utf8')).answer.outcome.reading.clip
const tick = () => new Promise(resolve => setImmediate(resolve))
const source = path => readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8')

// The owner's window (fixture): the octave from middle C stands seven periods on.
// D at its second touch-point is row 2, column 0 of the window (fixture), so column 42 in that octave; E at its second, row 2, column 43.
const C4 = {row: 0, column: 42}, E4 = {row: 0, column: 44}, G4 = {row: 1, column: 45}, D4_TOUCH_1 = {row: 2, column: 42}, E4_TOUCH_1 = {row: 2, column: 43}

/** The owner's M1′ session as the frame announces it, shaped as the boundary reads it (as tests/torus-850.test.mjs). */
const session = (settings = {}, over = {}) => ({
  settings: {rate: {mode: 'free', steps_per_second: 2.5}, fundamental: {source: 'map'}, carrier: 0, shape: 'auto', tuning: 'sky', polyphony: 16, tempo_bpm: 120, ...settings},
  steps_per_second: 2.5, band: 'rhythm', fundamental_hz: 130.81, map_hz: 130.81, figure: 'figure-eight', comma_cents: 23.46, notes: 2,
  resident_tunings: ['logic', 'sky'], carrier_drive: 'unbuilt', ...over,
})
const torusState = ({settings = {}, over = {}, standing = 'following', level = 0.5, effects} = {}) => ({ok: true,
  value: {schema: 'ql.instrument-reading/v1', standing, reason: null, identity: {event_ref: 'e', subject_ref: 's', registry_revision: 'r', geometry_ref: 'g', material_ref: 'm', model_ref: 'd'}},
  determinants: {lens: {lens12: 11, label: 'L5′'}, contextFrame: 7, harmonic: {selection: 'canonical-basis', index: 3}, rna: false},
  parameters: {muted: false, level, scale: {unitsPerMetre: 120, mode: 'domain-follow'}, cadence: null, refusal: null, torus: session(settings, over),
    ...(effects ? {effects} : {})}})

/** The owner taking the path's two acts (as tests/sitting-bell-keys.test.mjs). */
const owner = () => {
  const sent = []
  return {sent, send: async command => { sent.push(structuredClone(command)); return {ok: true} }}
}

// ── the Torus, kept ────────────────────────────────────────────────────────────────────────────────────────────────────────────────

test('the Torus is kept as its owner announced it: each setting through the instrument command\'s own reader, and what it read as it stood', () => {
  const effects = {chain: ['filter', 'reverb'], filter: {cutoff_hz: 900}, dynamics: {}, delay: {}, reverb: {mix: 0.25}, resonator: {}}
  const kept = take.torusKept(torusState({settings: {tuning: 'maqam', fundamental: {source: 'hz', hz: 220}}, effects}))
  assert.equal(kept.schema, 'oi.live-torus/v1')
  assert.deepEqual(kept.edits.slice(0, 6), [
    {kind: 'torus', edit: {rate: {mode: 'free', steps_per_second: 2.5}, fundamental: {source: 'hz', hz: 220}, carrier: 0, shape: 'auto', tuning: 'maqam', polyphony: 16, tempo_bpm: 120}},
    {kind: 'level', value: 0.5},
    {kind: 'lens', lens12: 11}, {kind: 'context-frame', context_frame: 7}, {kind: 'harmonic', source: {selection: 'canonical-basis', index: 3}},
    {kind: 'transcription', rna: false},
  ], 'the settings with the tuning and its sources, the level, and the determinants')
  assert.deepEqual(kept.edits.slice(6, 7), [{kind: 'effect-chain', chain: ['filter', 'reverb']}], 'the effects in their order')
  for (const edit of kept.edits) assert.deepEqual(readInstrumentEdit(edit), edit, `${edit.kind} is the instrument command's own`)
  assert.deepEqual(kept.stood, {steps_per_second: 2.5, band: 'rhythm', fundamental_hz: 130.81, map_hz: 130.81, figure: 'figure-eight', comma_cents: 23.46,
    resident_tunings: ['logic', 'sky'], carrier_drive: 'unbuilt'}, 'the Fundamental, the map\'s 1:1, the comma, band, figure and resident tunings as they stood; not the notes sounding')
  assert.deepEqual(take.torusKeptOf(JSON.parse(JSON.stringify(kept))), kept, 'read back from the set as it was kept')
  assert.equal(take.torusKept(null), null, 'no frame: nothing to keep')
  assert.equal(take.torusKept({ok: false, fault: 'gone'}), null)
  assert.equal(take.torusKeptOf({...kept, edits: [{kind: 'lens', lens12: 12}]}), null, 'a kept edit the instrument would refuse is no kept Torus')
  assert.equal(take.torusKeptOf({...kept, schema: 'other'}), null)
})

test('the Torus is set again edit by edit through the instrument command, and what its owner refuses is said in its words', async () => {
  const kept = take.torusKept(torusState())
  const sent = []
  const {refused} = await take.setTorusAgain(kept, async edit => { sent.push(edit); return edit.kind === 'lens' ? {ok: false, error: 'The lens is held by the scene'} : {ok: true} })
  assert.deepEqual(sent, kept.edits)
  assert.deepEqual(refused, ['The lens is held by the scene'])
  const thrown = await take.setTorusAgain(kept, async () => { throw new Error('No Expressions application is mounted for the live instrument') })
  assert.equal(thrown.refused.length, kept.edits.length, 'a throw is a refusal, never into the control')
})

// ── the recorder, on the one playing path ──────────────────────────────────────────────────────────────────────────────────────────

test('Record keeps what the playing path played: each note\'s number, key and touch-point, strength and source, from its strike to its end', async () => {
  let t = 1000
  const recorder = take.createTakeRecorder()
  const o = owner()
  const path = keys.createJankoInput({send: o.send, window: () => windowState, now: () => t, onNote: note => recorder.played(note)})
  path.down({kind: 'down', source: 'pointer', pitchClass: 0, velocity: 1})
  await tick()
  const context = {path: '/sets/a.als', track: 1, part: 'Keys', bpm: 120, start: 8, torus: take.torusKept(torusState()), mode: {root: 0, scale: 'major'}}
  recorder.start(context, 1000)
  t = 1500
  path.down({kind: 'down', source: 'keyboard', pitchClass: 4})
  await tick()
  t = 2000
  path.up({kind: 'up', source: 'keyboard', pitchClass: 4})
  path.down({kind: 'down', source: 'midi', pitchClass: 7, velocity: 0.75})
  await tick()
  t = 2500
  path.down({kind: 'down', source: 'pointer', pitchClass: 2, key: {row: 2, column: 0}})
  await tick()
  // A clip's notes and the bell are not played by hand: not recorded.
  path.clipStrike([{hold: 'clip:1', note: 64}], 1, '96000')
  await path.ring(2, 0.35)
  await tick()
  t = 3000
  const done = recorder.stop(3000)
  assert.equal(recorder.recording(), null)
  const typed = keys.JANKO_DEFAULT_AMPLITUDE
  assert.deepEqual(done.notes.map(n => [n.note, n.key, n.touch, n.amplitude, n.source, n.on, n.off]), [
    [64, E4, 0, typed, 'keyboard', 1500, 2000],
    [67, G4, 0, 0.75, 'midi', 2000, 3000],
    [62, D4_TOUCH_1, 1, typed, 'pointer', 2500, 3000],
  ], 'a note held when the take began is not in it; a note held at Stop ends there; a key pressed sounds at its own touch-point')
  const act = take.takeRecordAct(done, 'Take 1')
  assert.equal(act.kind, 'take_record')
  assert.deepEqual([act.track, act.start, act.length, act.name], [1, 8, 4, 'Take 1'], 'from the bar after the part\'s main lane, whole bars long')
  const vel = Math.round(typed * 127)
  assert.deepEqual(act.notes, [{p: 64, at: 1, len: 1, vel}, {p: 67, at: 2, len: 2, vel: 95}, {p: 62, at: 3, len: 1, vel}],
    'in beats of the take at 120 BPM; velocity from strength')
  assert.equal(act.keeps.schema, 'oi.live-take/v1')
  assert.deepEqual(act.keeps.notes, [
    {p: 64, at: 1, len: 1, vel, key: E4, touch: 0, strength: typed, source: 'keyboard'},
    {p: 67, at: 2, len: 2, vel: 95, key: G4, touch: 0, strength: 0.75, source: 'midi'},
    {p: 62, at: 3, len: 1, vel, key: D4_TOUCH_1, touch: 1, strength: typed, source: 'pointer'},
  ], 'how each note was played: the key and touch-point it struck on the Jankó surface, its exact strength (a velocity rounds it), its source; and as it was laid')
  assert.deepEqual(act.keeps.torus, context.torus, 'the Torus as it stood when the take began, with its tuning and its sources')
  assert.deepEqual(act.keeps.mode, {root: 0, scale: 'major'})
  assert.equal(act.keeps.resumes, take.TAKE_RESUMES, 'it says from which state it resumes')
  assert.match(act.keeps.resumes, /resumes from the body as it then rings/)
  assert.deepEqual(act.keeps.not_kept, [...take.TAKE_NOT_KEPT])
  for (const word of ['the seeds', 'the course of the body', 'the sample each note landed at']) assert.ok(act.keeps.not_kept.includes(word), word)
})

test('a move of the Torus during the take is kept with its beat; a reading that changes as it plays is no move', () => {
  const recorder = take.createTakeRecorder()
  const first = take.torusKept(torusState())
  recorder.start({path: '/s.als', track: 0, part: 'A', bpm: 60, start: 0, torus: first, mode: null}, 0)
  recorder.played({kind: 'on', id: 'p', note: 60, key: C4, touch: 0, amplitude: 1, source: 'pointer', at: 100})
  recorder.moved(take.torusKept(torusState({over: {comma_cents: 31, notes: 5}})), 500)
  const moved = take.torusKept(torusState({settings: {tuning: 'logic'}}))
  recorder.moved(moved, 2000)
  recorder.moved(moved, 2500)
  const act = take.takeRecordAct(recorder.stop(3000), 'Take 2')
  assert.deepEqual(act.keeps.moves, [{beat: 2, torus: moved}], 'one move, at beat 2 at 60 BPM')
})

test('Record keeps the hand\'s touches on each note it recorded, laid as the note\'s MPE lanes in beats from its start (O-I #853)', async () => {
  // DLW §21.1 Clip view, the MPE tab: "Pressure from the playing surface records here"; §21.2 Rules: "A recorded performance keeps
  // what it needs to be played on: the notes with their expression".
  let t = 0
  const recorder = take.createTakeRecorder()
  const o = owner()
  const path = keys.createJankoInput({send: o.send, window: () => windowState, now: () => t, onNote: note => recorder.played(note), onTouch: touch => recorder.touched(touch)})
  path.down({kind: 'down', source: 'midi', pitchClass: 0, velocity: 1}); await tick()
  path.touch('pressure', 0.3, 'midi')
  recorder.start({path: '/s.als', track: 0, part: 'A', bpm: 120, start: 0, torus: null, mode: null}, 250)
  t = 500
  path.down({kind: 'down', source: 'midi', pitchClass: 4, velocity: 1}); await tick()
  t = 750
  path.touch('pressure', 0.6, 'midi')
  t = 1000
  path.touch('bend', -0.25, 'midi')
  path.touch('pressure', 0.2, 'midi')
  t = 1500
  path.up({kind: 'up', source: 'midi', pitchClass: 4})
  t = 1750
  path.touch('pressure', 0.9, 'midi')
  const done = recorder.stop(2000)
  assert.deepEqual(done.notes.map(n => [n.note, n.touches]), [[64, {pressure: [[750, 0.6], [1000, 0.2]], bend: [[1000, -0.25]]}]],
    'a note held before the take is not in it; a touch after a note ends is not on it; a fall is kept as the hand played it')
  const act = take.takeRecordAct(done, 'Take 3')
  assert.deepEqual(act.notes, [{p: 64, at: 0.5, len: 2, vel: 127, mpe: {pressure: [[0.5, 0.6], [1, 0.2]], bend: [[1, -0.25]]}}],
    'in beats from the note\'s start at 120 BPM, each lane as played')
  recorder.start({path: '/s.als', track: 0, part: 'A', bpm: 120, start: 0, torus: null, mode: null}, 0)
  recorder.played({kind: 'on', id: 'p', note: 60, key: C4, touch: 0, amplitude: 1, source: 'pointer', at: 100})
  assert.equal(take.takeRecordAct(recorder.stop(1000), 'Take 4').notes[0].mpe, undefined, 'an untouched note lays no MPE')
  assert.match(source('live/keyboardLayout.ts'), /onTouch: touch => liveTakeRecorder\.touched\(touch\)/, 'the live path tells Record its touches')
})

test('a take with nothing played is not laid, and says so', () => {
  const recorder = take.createTakeRecorder()
  recorder.start({path: '/s.als', track: 0, part: 'A', bpm: 120, start: 0, torus: null, mode: null}, 0)
  assert.deepEqual(take.takeRecordAct(recorder.stop(5000), 'Take 1'), {refused: take.NOTHING_PLAYED})
  // A note struck as the take ends (two bars at 120 BPM: beat 8, the take's own end) has no time in it to sound.
  recorder.start({path: '/s.als', track: 0, part: 'A', bpm: 120, start: 0, torus: null, mode: null}, 0)
  recorder.played({kind: 'on', id: 'p', note: 60, key: C4, touch: 0, amplitude: 1, source: 'pointer', at: 4000})
  assert.deepEqual(take.takeRecordAct(recorder.stop(4000), 'Take 1'), {refused: take.NOTHING_PLAYED})
  assert.equal(recorder.stop(6000), null, 'no take records')
  assert.equal(take.takeStartOf([{end: 3}, {end: 9.5}]), 12)
  assert.equal(take.takeStartOf([]), 0)
})

// ── Record, in Live's transport ────────────────────────────────────────────────────────────────────────────────────────────────────

test('Record is refused in words until a set, a MIDI part of it, a tempo and a following Torus stand; it lights while a take records', () => {
  const idle = {recording: null, busy: false, said: null}
  const base = {setPath: '/sets/a.als', part: {track: 1, name: 'Keys', kind: 'midi'}, bpm: 120, torus: torusState(), state: idle, start: () => 'start', stop: () => 'stop'}
  const refused = over => take.recordBinding({...base, ...over})
  assert.match(refused({setPath: null}).refused, /^Open a set/)
  assert.match(refused({part: null}).refused, /^Select a MIDI part/)
  assert.match(refused({part: {track: 0, name: 'Drums', kind: 'audio'}}).refused, /Drums is not a MIDI part/)
  assert.match(refused({bpm: null}).refused, /no tempo/)
  assert.match(refused({torus: null}).refused, /torus is not open/)
  assert.match(refused({torus: {ok: false, fault: 'The field faulted'}}).refused, /refused: The field faulted/)
  assert.match(refused({torus: torusState({standing: 'held'})}).refused, /torus is held: resume it/)
  for (const over of [{setPath: null}, {part: null}, {bpm: null}, {torus: null}]) {
    const b = refused(over)
    assert.equal(b.press, undefined, 'a refused Record has no press')
    assert.doesNotMatch(b.refused, /take_record|torus_keep|[{}]|_/, 'refusal words are prose')
  }
  const ready = take.recordBinding(base)
  assert.equal(ready.press(), 'start')
  assert.equal(ready.lit, false)
  assert.match(ready.title, /records what you play on Keys into Arrangement view as a take/)
  const recording = take.recordBinding({...base, state: {...idle, recording: {part: 'Keys'}}})
  assert.equal(recording.lit, true)
  assert.equal(recording.press(), 'stop')
  const told = take.recordBinding({...base, state: {...idle, said: 'Recorded Take 1.'}, opened: 'The Torus was set again as Keys keeps it.'})
  assert.match(told.title, /Recorded Take 1\. The Torus was set again as Keys keeps it\.$/)
})

/** The set's owner and the Torus's for Record, as fakes. */
const recordOwners = ({document, torus = torusState(), act} = {}) => {
  let t = 0, current = torus
  const acts = [], listeners = new Set(), kept = []
  return {
    acts, kept, at: value => { t = value }, set: next => { current = next; for (const listener of [...listeners]) listener() },
    owners: {
      readSet: async () => ({document}),
      act: act ?? (async (path, a) => { acts.push({path, act: structuredClone(a)}); return {act: a.kind, done: 'Recorded Take 1 on Keys at beat 8: 1 note, in take lane 1.', at: {track: 1, take: 7}, revision: 'r2'} }),
      torus: () => current,
      subscribeTorus: listener => { listeners.add(listener); return () => listeners.delete(listener) },
      keepTorus: async (path, track) => { kept.push([path, track]); return null },
      now: () => t,
    },
  }
}
const SET = {tracks: [{kind: 'audio', name: 'Drums', arrangement_clips: []}, {kind: 'midi', name: 'Keys', arrangement_clips: [{name: 'a', kind: 'midi', start: 0, end: 6.5}]}]}

test('Record lays the take in the set through its owner, and the part keeps the Torus as it then stands', async () => {
  const recorder = take.createTakeRecorder()
  const f = recordOwners({document: SET})
  const record = take.createLiveRecord(recorder, f.owners)
  await record.start('/sets/a.als', 1, 120, {root: 2, scale: null})
  assert.equal(record.state().recording.part, 'Keys')
  assert.equal(record.state().recording.start, 8, 'from the bar after the main lane\'s last clip')
  f.at(500)
  recorder.played({kind: 'on', id: 'p', note: 60, key: C4, touch: 0, amplitude: 1, source: 'pointer', at: 500})
  f.set(torusState({settings: {carrier: 0.5}}))
  f.at(1000)
  await record.stop()
  assert.equal(f.acts.length, 1)
  const laid = f.acts[0].act
  assert.deepEqual([laid.kind, laid.track, laid.start, laid.length, laid.name, laid.notes], ['take_record', 1, 8, 4, 'Take 1', [{p: 60, at: 1, len: 1, vel: 127}]])
  assert.equal(laid.keeps.moves.length, 1, 'the Carrier\'s move is kept')
  assert.deepEqual(f.kept, [['/sets/a.als', 1]], 'the part keeps the Torus')
  assert.match(record.state().said, /^Recorded Take 1 on Keys at beat 8: 1 note, in take lane 1\. /)
  assert.match(record.state().said, /keeps no course of the Torus, so Export Audio cannot render it/, 'what Export Audio cannot render is said')
  assert.equal(record.state().busy, false)
})

test('a take that is not laid, or a part that is not MIDI, is said in words, and nothing records', async () => {
  const f = recordOwners({document: SET, act: async () => { throw new Error('The set changed since it was read; read it again') }})
  const recorder = take.createTakeRecorder()
  const record = take.createLiveRecord(recorder, f.owners)
  await record.start('/sets/a.als', 0, 120, null)
  assert.equal(record.state().recording, null)
  assert.match(record.state().said, /^No take was begun: the part chosen is not a MIDI part of the set\.$/)
  await record.start('/sets/a.als', 1, 120, null)
  recorder.played({kind: 'on', id: 'p', note: 60, key: C4, touch: 0, amplitude: 1, source: 'pointer', at: 0})
  await record.stop()
  assert.equal(record.state().said, 'The take was not laid: The set changed since it was read; read it again.')
  await record.start('/sets/a.als', 1, 120, null)
  await record.stop()
  assert.equal(record.state().said, take.NOTHING_PLAYED)
})

// ── a take played again ────────────────────────────────────────────────────────────────────────────────────────────────────────────

test('a take played again sets the Torus as it stood when the take began, voices each note as it was played, and says where it resumes', async () => {
  const torus = take.torusKept(torusState({settings: {tuning: 'logic'}}))
  const sent = []
  const commit = async edit => { sent.push(edit); return {ok: true} }
  const keeps = {schema: 'oi.live-take/v1', torus, resumes: take.TAKE_RESUMES,
    notes: [{p: 64, at: 1, key: E4_TOUCH_1, touch: 1, strength: 0.42, source: 'pointer'}, {p: 67, at: 2.0000004, key: G4, touch: 0, strength: 0.75, source: 'midi'}]}
  const prepared = await take.prepareTake({...REAL, take: {id: 3, keeps}}, commit)
  assert.equal(prepared.resumes, take.TAKE_RESUMES)
  assert.match(prepared.resumes, /each note again at the touch-point it struck and at its strength/)
  assert.deepEqual(sent, torus.edits, 'the Torus is set again as it stood')
  assert.deepEqual(prepared.voice(64, 1), {touch: 1, strength: 0.42}, 'by its number and beat')
  assert.deepEqual(prepared.voice(67, 2), {touch: 0, strength: 0.75}, 'a beat as the set wrote it back')
  assert.equal(prepared.voice(64, 3), null, 'a note written since plays as any clip\'s')
  assert.equal(await take.prepareTake({...REAL, take: null}, commit), null, 'a clip no take gave plays as it is')
  assert.equal(await take.prepareTake(REAL, commit), null)
  const nothing = await take.prepareTake({...REAL, take: {id: 3, keeps: null}}, commit)
  assert.match(nothing.resumes, /keeps nothing beside its notes, so it plays as its notes are written, on the Torus as it now stands/)
  assert.equal(nothing.voice, undefined)
  assert.match((await take.prepareTake({...REAL, take: {id: 3, keeps: null, keepsRefused: 'it is kept as one object of at most 256 KiB'}}, commit)).resumes, /could not be read/)
  const noTorus = await take.prepareTake({...REAL, take: {id: 3, keeps: {...keeps, torus: null}}}, commit)
  assert.match(noTorus.resumes, /^The Torus was not kept with this take/)
  assert.deepEqual(noTorus.voice(64, 1), {touch: 1, strength: 0.42}, 'its notes are still voiced as played')
  assert.match((await take.prepareTake({...REAL, take: {id: 3, keeps}}, async () => ({ok: false, error: 'The scene holds the lens'}))).resumes,
    /did not take all of it again: The scene holds the lens/)
})

/** A controlled clock (as tests/live-clip-play.test.mjs): time moves only when the test runs it. */
const controlledClock = () => {
  let t = 100, id = 0
  const timers = []
  return {
    now: () => t,
    later: (run, ms) => { const handle = {at: t + ms / 1000, run, id: ++id}; timers.push(handle); return handle },
    cancel: handle => { const i = timers.indexOf(handle); if (i >= 0) timers.splice(i, 1) },
    async run(to) {
      for (;;) {
        timers.sort((a, b) => a.at - b.at || a.id - b.id)
        const next = timers[0]
        if (!next || next.at > to) break
        timers.shift(); t = Math.max(t, next.at); next.run(); await tick()
      }
      t = Math.max(t, to)
    },
  }
}

test('the clip player prepares a take before it reads the owner\'s clock, strikes each note as it was played, and Play says where it resumes', async () => {
  const order = [], strikes = []
  let resolvePrepare
  const clock = controlledClock()
  const clip = {...REAL, name: 'Take 1', loop: false, start: 0, end: 4, take: {id: 1, keeps: {}}, notes: [
    {id: 1, p: 64, at: 0, len: 1, vel: 44, chance: 1, on: true}, {id: 2, p: 67, at: 0, len: 1, vel: 44, chance: 1, on: true},
    {id: 3, p: 60, at: 1, len: 1, vel: 100, chance: 1, on: true}]}
  const p = player.createClipPlayer({
    read: async () => { order.push('read'); return clip },
    prepare: c => { order.push(`prepare ${c.take.id}`); return new Promise(resolve => { resolvePrepare = resolve }) },
    clock: async () => { order.push('clock'); return {samples_elapsed: '480000', sample_rate: 48000, lookahead_seconds: 0.5, block_frames: 8192} },
    strike: async (notes, amplitude, at) => { strikes.push({notes: notes.map(({hold: _hold, ...note}) => note), amplitude, at}); return {ok: true} },
    release: () => {}, watch: () => () => {}, now: clock.now, later: clock.later, cancel: clock.cancel, random: () => 0,
  })
  p.play({path: '/s.als', track: 1, at: {arrangement: 0}}, 60)
  await tick()
  assert.deepEqual(order, ['read', 'prepare 1'], 'the Torus is set again before the clip\'s anchor is read')
  const voices = new Map([['64|0', {touch: 1, strength: 0.35}], ['60|1', {touch: 2, strength: 0.9}]])
  resolvePrepare({resumes: 'The take resumes from the body as it then rings.', voice: (note, beat) => voices.get(`${note}|${beat}`) ?? null})
  await tick(); await tick()
  assert.deepEqual(order, ['read', 'prepare 1', 'clock'])
  assert.equal(p.state().resumes, 'The take resumes from the body as it then rings.')
  await clock.run(clock.now() + 2)
  assert.deepEqual(strikes.map(s => [s.notes, s.amplitude]), [
    [[{note: 64, touch: 1}, {note: 67}], 0.35],
    [[{note: 60, touch: 2}], 0.9],
  ], 'a played note at its touch-point and strength; a note written since as any clip\'s, its act at the strongest of its notes')
  const {play} = player.clipPlayBindings({address: {path: '/s.als', track: 1, at: {arrangement: 0}}, title: 'Keys · Take 1', bpm: 60, torus: torusState(),
    state: p.state(), play: () => {}, stop: () => {}})
  assert.match(play.title, /The take resumes from the body as it then rings\.$/)
  p.stop()
  assert.equal(player.createClipPlayer({read: async () => REAL, clock: async () => ({}), strike: async () => ({ok: true}), release: () => {}, watch: () => () => {},
    now: () => 0, later: () => 0, cancel: () => {}, random: () => 0}).state().resumes, null, 'a player with no prepare says nothing of it')
})

test('a take\'s moves are made again at their beats: only what each move changed, from the Torus as it stood when the take began', async () => {
  const start = take.torusKept(torusState())
  const tuned = take.torusKept(torusState({settings: {tuning: 'logic'}}))
  const louder = take.torusKept(torusState({settings: {tuning: 'logic'}, level: 0.8}))
  assert.deepEqual(take.torusMoveEdits(start, tuned), [tuned.edits[0]], 'the settings, with the tuning moved')
  assert.deepEqual(take.torusMoveEdits(tuned, louder), [{kind: 'level', value: 0.8}])
  const moves = take.takeMoves(start, [{beat: 1, torus: tuned}, {beat: 2, torus: {schema: 'no'}}, {beat: 3, torus: louder}, {beat: 4, torus: louder}])
  assert.deepEqual(moves, [{beat: 1, edits: [tuned.edits[0]]}, {beat: 3, edits: [{kind: 'level', value: 0.8}]}], 'a move that is no kept Torus, or that changed nothing, is left out')
  const prepared = await take.prepareTake({...REAL, take: {id: 4, keeps: {schema: 'oi.live-take/v1', torus: start, moves: [{beat: 1, torus: tuned}]}}}, async () => ({ok: true}))
  assert.deepEqual(prepared.moves, [{beat: 1, edits: [tuned.edits[0]]}])
  assert.match(prepared.resumes, /makes each move of the Torus again at its beat, within a block of the sound/)
})

test('the clip player makes a take\'s move as its beat is rendered, one owner lookahead after that beat\'s note-ons, and says a refused move', async () => {
  const clock = controlledClock()
  const edits = []
  const clip = {...REAL, name: 'Take 2', loop: false, start: 0, end: 4, take: {id: 2, keeps: {}}, notes: [{id: 1, p: 60, at: 0, len: 1, vel: 100, chance: 1, on: true}]}
  const A = {kind: 'level', value: 0.8}, B = {kind: 'lens', lens12: 3}
  const p = player.createClipPlayer({
    read: async () => clip,
    prepare: async () => ({resumes: 'Resumes.', moves: [{beat: 3.8, edits: [B]}, {beat: 1, edits: [A]}]}),
    clock: async () => ({samples_elapsed: '480000', sample_rate: 48000, lookahead_seconds: 0.5, block_frames: 8192}),
    edit: async edit => { edits.push([clock.now(), edit]); return edit.kind === 'lens' ? {ok: false, error: 'The scene holds the lens'} : {ok: true} },
    strike: async () => ({ok: true}), release: () => {}, watch: () => () => {}, now: clock.now, later: clock.later, cancel: clock.cancel, random: () => 0,
  })
  p.play({path: '/s.als', track: 1, at: {arrangement: 0}}, 60)
  await tick(); await tick(); await tick()
  const origin = clock.now()
  await clock.run(origin + 1.4)
  assert.deepEqual(edits, [], 'not before its beat is rendered')
  await clock.run(origin + 1.6)
  assert.deepEqual(edits, [[origin + 1.5, A]], 'beat 1 at 60 BPM, sent one lookahead on, as the owner renders it')
  await clock.run(origin + 5)
  assert.deepEqual(edits.map(([at, edit]) => [at - origin, edit]), [[1.5, A], [4, B]], 'a move in the pass\'s last lookahead is made at its end')
  await tick()
  assert.equal(p.state().resumes, 'Resumes. The Torus refused a move of the take: The scene holds the lens')
  assert.equal(p.state().playing, null, 'the take played to its end')
})

// ── Arm: a mapped control's moves as the take's automation lanes (O-I 853, round 18) ─────────────────────────────────────────────
// DLW §21.2 Transport, "Arm | Records your parameter moves as automation lanes"; §16.8, "Arm, then move any parameter of any device, and
// the move is recorded as an automation lane on that track".

const move = (parameter, value, before, at, writer = 'owner', label = parameter) => ({parameter, label, writer, value, before, at})

test('under Arm a take records each mapped move as a point of its parameter\'s lane, from where it stood; disarmed, or no take, none', () => {
  const recorder = take.createTakeRecorder()
  const heard = []
  const off = recorder.subscribeArm(() => heard.push(recorder.armed()))
  recorder.automated(move('level', 0.7, 0.5, 100))
  recorder.start({path: '/s.als', track: 0, part: 'A', bpm: 60, start: 0, torus: null, mode: null}, 1000)
  recorder.automated(move('level', 0.7, 0.5, 1500))
  assert.equal(recorder.armed(), false)
  recorder.arm(true)
  recorder.arm(true)
  assert.deepEqual(heard, [true], 'Arm is told once, when it changes')
  recorder.automated(move('level', 0.6, 0.5, 900))
  recorder.automated(move('level', 0.75, 0.5, 2000))
  recorder.automated(move('level', 1, 0.75, 2500))
  recorder.automated(move('note-device:s1:tie', 'up', 'nearest', 1000, 'session', 'Scale tie'))
  recorder.played({kind: 'on', id: 'p', note: 60, key: C4, touch: 0, amplitude: 1, source: 'pointer', at: 1200})
  const done = recorder.stop(4000)
  assert.deepEqual(done.automation, [
    {parameter: 'level', label: 'level', writer: 'owner', points: [[1000, 0.5], [2000, 0.75], [2500, 1]], cut: false},
    {parameter: 'note-device:s1:tie', label: 'Scale tie', writer: 'session', points: [[1000, 'up']], cut: false},
  ], 'a lane begins where its parameter stood as the take began; a move at the take\'s first moment is its first point; one before the take is no point')
  const act = take.takeRecordAct(done, 'Take 1')
  assert.deepEqual(act.keeps.automation, [
    {parameter: 'level', label: 'level', writer: 'owner', points: [[0, 0.5], [1, 0.75], [1.5, 1]]},
    {parameter: 'note-device:s1:tie', label: 'Scale tie', writer: 'session', points: [[0, 'up']]},
  ], 'kept with the take in beats from its start (60 BPM)')
  recorder.arm(false)
  off()
  recorder.start({path: '/s.als', track: 0, part: 'A', bpm: 60, start: 0, torus: null, mode: null}, 0)
  recorder.automated(move('level', 0.7, 0.5, 500))
  recorder.played({kind: 'on', id: 'p', note: 60, key: C4, touch: 0, amplitude: 1, source: 'pointer', at: 100})
  const unarmed = recorder.stop(1000)
  assert.deepEqual(unarmed.automation, [], 'disarmed, a take records no lane')
  assert.equal(take.takeRecordAct(unarmed, 'Take 2').keeps.automation, undefined, 'and keeps none')
  recorder.arm(true)
  assert.deepEqual(heard, [true, false], 'told as it changed; nothing once unsubscribed')
})

test('a lane keeps at most its 4,096 points and says it was cut; a take keeps at most 64 lanes; a point past the take\'s end is not laid', () => {
  const recorder = take.createTakeRecorder()
  recorder.arm(true)
  recorder.start({path: '/s.als', track: 0, part: 'A', bpm: 60, start: 0, torus: null, mode: null}, 0)
  for (let i = 0; i <= take.LANE_POINTS_MAX; i += 1) recorder.automated(move('rate', i, null, i))
  for (let i = 0; i < take.TAKE_LANES_MAX + 2; i += 1) recorder.automated(move(`p${i}`, 1, null, 10))
  recorder.played({kind: 'on', id: 'p', note: 60, key: C4, touch: 0, amplitude: 1, source: 'pointer', at: 0})
  const done = recorder.stop(100)
  assert.equal(done.automation.length, take.TAKE_LANES_MAX)
  assert.equal(done.automation[0].points.length, take.LANE_POINTS_MAX, 'the most a lane keeps, from the take\'s first moment (no point before)')
  assert.equal(done.automation[0].cut, true)
  const laid = take.takeRecordAct({...done, automation: [{parameter: 'rate', label: 'Rate', writer: 'owner', points: [[0, 1], [3999, 2], [4001, 3]], cut: false}],
    stoppedAt: 3000}, 'Take 1')
  assert.equal(laid.length, 4, 'one bar at 60 BPM')
  assert.deepEqual(laid.keeps.automation[0].points, [[0, 1], [3.999, 2]], 'a point past the take\'s end is not laid')
  assert.deepEqual(take.takeRecordAct({...done, automation: [done.automation[0]]}, 'Take 2').keeps.automation[0].cut, true, 'a cut lane says so')
})

test('a take\'s lanes are read exact: a lane any part of which is not one is left out', () => {
  const good = {parameter: 'cadence', label: 'Tick cadence', writer: 'owner', points: [[0, 'hold'], [1, '12'], [1, '1']]}
  assert.deepEqual(take.takeAutomationOf([good]), [good])
  assert.deepEqual(take.takeAutomationOf([{...good, cut: true}])[0].cut, true)
  for (const bad of [{...good, parameter: ''}, {...good, writer: 'agent'}, {...good, label: 3}, {...good, points: []}, {...good, points: [[1, 'a'], [0, 'b']]},
    {...good, points: [[0, null]]}, {...good, points: [[Number.NaN, 1]]}, {...good, points: [[0, 1, 2]]}, {...good, points: [[0, Infinity]]}, null, 'lane'])
    assert.deepEqual(take.takeAutomationOf([bad]), [], JSON.stringify(bad))
  assert.deepEqual(take.takeAutomationOf(null), [])
  assert.deepEqual(take.takeAutomationOf({lanes: [good]}), [])
})

test('a take\'s lane plays again at its beats through its parameter\'s own write, unless the take makes it again itself', async () => {
  const start = take.torusKept(torusState())
  const lanes = [
    {parameter: 'level', label: 'Level', writer: 'owner', points: [[0, 0.5], [1, 0.8]]},
    {parameter: 'cadence', label: 'Tick cadence', writer: 'owner', points: [[0.5, '12']]},
    {parameter: 'note-device:s1:tie', label: 'Scale tie', writer: 'session', points: [[2, 'up']]},
  ]
  const tuned = take.torusKept(torusState({settings: {tuning: 'logic'}}))
  const prepared = await take.prepareTake({...REAL, take: {id: 4, keeps: {schema: 'oi.live-take/v1', torus: start, moves: [{beat: 1, torus: tuned}], automation: lanes}}},
    async () => ({ok: true}))
  assert.deepEqual(prepared.moves, [
    {beat: 0.5, edits: [], sets: [{parameter: 'cadence', value: '12'}]},
    {beat: 1, edits: [tuned.edits[0]]},
    {beat: 2, edits: [], sets: [{parameter: 'note-device:s1:tie', value: 'up'}]},
  ], 'the Level is the Torus\'s moves\' (the Torus as it stood after each); the Cadence, which no move sets, and the session\'s tie play from their lanes')
  assert.deepEqual(take.takeLaneMoves(lanes, lane => lane.writer === 'owner'), [{beat: 2, edits: [], sets: [{parameter: 'note-device:s1:tie', value: 'up'}]}],
    'under a course every owner write is one of the course\'s acts: only a session lane is written again')
  assert.deepEqual(take.takeLaneMoves([{...lanes[1], writer: 'nobody'}], () => false), [], 'a lane not read exact plays nothing')
})

test('the clip player writes a lane\'s point at its beat through the parameter\'s write, and says a refused one', async () => {
  const clock = controlledClock()
  const sets = []
  const clip = {...REAL, name: 'Take 2', loop: false, start: 0, end: 4, take: {id: 2, keeps: {}}, notes: [{id: 1, p: 60, at: 0, len: 1, vel: 100, chance: 1, on: true}]}
  const p = player.createClipPlayer({
    read: async () => clip,
    prepare: async () => ({resumes: 'Resumes.', moves: [{beat: 2, edits: [], sets: [{parameter: 'gone', value: 1}]}, {beat: 1, edits: [], sets: [{parameter: 'cadence', value: '12'}]}]}),
    clock: async () => ({samples_elapsed: '480000', sample_rate: 48000, lookahead_seconds: 0.5, block_frames: 8192}),
    set: async (parameter, value) => { sets.push([clock.now(), parameter, value]); return parameter === 'gone' ? {ok: false, error: 'gone is not on the surface now, so its lane moves nothing.'} : {ok: true} },
    strike: async () => ({ok: true}), release: () => {}, watch: () => () => {}, now: clock.now, later: clock.later, cancel: clock.cancel, random: () => 0,
  })
  p.play({path: '/s.als', track: 1, at: {arrangement: 0}}, 60)
  await tick(); await tick(); await tick()
  const origin = clock.now()
  await clock.run(origin + 1.4)
  assert.deepEqual(sets, [], 'not before its beat is rendered')
  await clock.run(origin + 5)
  assert.deepEqual(sets.map(([at, parameter, value]) => [at - origin, parameter, value]), [[1.5, 'cadence', '12'], [2.5, 'gone', 1]], 'a move with only a lane\'s point is a move')
  await tick()
  assert.equal(p.state().resumes, 'Resumes. A lane of the take was not written again: gone is not on the surface now, so its lane moves nothing.')
})

test('Arm is Live\'s transport toggle over the candidate\'s recorder, and the map tells Record each mapped move', () => {
  const armed = [], off = take.armBinding(false, () => armed.push('flip'))
  assert.equal(off.lit, false)
  assert.equal(off.title, `${take.ARM_DOES} Press to arm, then Record and move a mapped control.`)
  off.press()
  assert.deepEqual(armed, ['flip'])
  const on = take.armBinding(true, () => {})
  assert.equal(on.lit, true)
  assert.match(on.title, /Armed: press to disarm\.$/)
  assert.match(take.ARM_DOES, /^Arm — records your parameter moves as automation lanes/)
  assert.match(source('shell/transports/useLiveTransport.tsx'), /const arm = useLiveArm\(\)[\s\S]*record,\n    arm,/, 'the slot is bound in Live\'s transport')
  assert.match(source('live/liveTake.ts'), /return armBinding\(armed, \(\) => liveTakeRecorder\.arm\(!liveTakeRecorder\.armed\(\)\)\)/)
  assert.match(source('live/liveTake.ts'), /onMapMove\(move => liveTakeRecorder\.automated\(move\)\)/, 'Record hears the map\'s moves')
  assert.match(source('live/midiMap/midiMapControls.tsx'),
    /moved: \(target, value, before\) => hearMove\?\.\(\{parameter: target\.id, label: target\.label, writer: target\.writer, value, before, at: performance\.now\(\)\}\)/)
  assert.match(source('live/clipPlayer.ts'), /set: writeMapTarget,/, 'a lane is written again through the parameter\'s own write')
})

test('a clip\'s note strikes the touch-point its hold names on the one playing path, else its first', async () => {
  const o = owner()
  const path = keys.createJankoInput({send: o.send, window: () => windowState})
  path.clipStrike([{hold: 'a', note: 64, touch: 1}, {hold: 'b', note: 67}], 0.5, '96000')
  path.clipStrike([{hold: 'c', note: 60, touch: 7}], 0.5, '96000')
  await tick()
  assert.deepEqual(o.sent.map(c => c.keys), [[E4_TOUCH_1, G4], [C4]], 'a touch-point the pitch has none of is its first')
})

// ── the Torus kept with the set ────────────────────────────────────────────────────────────────────────────────────────────────────

/** The owners the keeper reaches, as fakes: a set, the Torus, and timers the test fires. */
const keeperOwners = ({document, torus = torusState()} = {}) => {
  let current = torus
  const commits = [], acts = [], listeners = new Set(), timers = [], told = []
  return {
    commits, acts, timers, told, tell: words => told.push(words),
    set: next => { current = next; for (const listener of [...listeners]) listener() },
    fire: () => { const due = timers.splice(0); for (const timer of due) timer.run() },
    owners: {
      readSet: async () => ({document}),
      act: async (path, a) => { acts.push({path, act: structuredClone(a)}); return {act: a.kind, done: 'kept', at: {track: a.track}, revision: 'r'} },
      torus: () => current,
      subscribeTorus: listener => { listeners.add(listener); return () => listeners.delete(listener) },
      commit: async edit => { commits.push(edit); return {ok: true} },
      later: (run, ms) => { const timer = {run, ms}; timers.push(timer); return timer },
      cancel: handle => { const i = timers.indexOf(handle); if (i >= 0) timers.splice(i, 1) },
    },
  }
}

test('a set opened again sets the Torus as its part keeps it, once the Torus can take it; only then is the Torus kept', async () => {
  const keptTorus = take.torusKept(torusState({settings: {tuning: 'maqam'}}))
  const document = {tracks: [{kind: 'audio', name: 'Drums'}, {kind: 'midi', name: 'Keys', torus: JSON.parse(JSON.stringify(keptTorus))}]}
  const f = keeperOwners({document, torus: null})
  const keeper = take.createTorusKeeper(f.owners, f.tell)
  keeper.open('/sets/a.als', null)
  await tick()
  assert.deepEqual(f.commits, [], 'the Torus is not open yet: nothing is set')
  f.set(torusState({standing: 'paused'}))
  assert.deepEqual(f.commits, [], 'nor while it cannot take edits')
  f.set(torusState())
  await tick()
  assert.deepEqual(f.commits, keptTorus.edits, 'set again as Keys keeps it')
  assert.equal(f.told.at(-1), 'The Torus was set again as Keys keeps it.')
  assert.deepEqual(f.acts, [], 'the sound before it is never kept over it')
  // From now on, a change to what sets the Torus is kept once it rests.
  f.set(torusState({settings: {tuning: 'maqam'}, over: {comma_cents: 40}}))
  f.fire()
  await tick()
  assert.deepEqual(f.acts, [], 'the Torus stands as the set keeps it: a reading that moved is not a change')
  f.set(torusState({settings: {tuning: 'maqam', carrier: 0.25}}))
  f.set(torusState({settings: {tuning: 'maqam', carrier: 0.5}}))
  assert.equal(f.timers.length, 1, 'a turn of a knob is kept once, when it rests')
  assert.equal(f.timers[0].ms, take.TORUS_KEEP_REST_MS)
  f.fire()
  await tick(); await tick()
  assert.equal(f.acts.length, 1)
  assert.deepEqual([f.acts[0].act.kind, f.acts[0].act.track], ['torus_keep', 1], 'kept with the part that kept it')
  assert.deepEqual(take.torusKeptOf(f.acts[0].act.torus).edits[0].edit.carrier, 0.5)
  keeper.close()
  f.set(torusState({settings: {carrier: 1}}))
  assert.equal(f.timers.length, 0, 'a closed set keeps nothing more')
})

test('a set that keeps no Torus keeps it from when it opens, on the part chosen or its first MIDI part; a take\'s part keeps it at once', async () => {
  const document = {tracks: [{kind: 'audio', name: 'Drums'}, {kind: 'midi', name: 'Keys'}, {kind: 'midi', name: 'Bass'}]}
  const f = keeperOwners({document})
  const keeper = take.createTorusKeeper(f.owners, f.tell)
  keeper.open('/sets/b.als', 0)
  await tick()
  assert.deepEqual(f.commits, [], 'nothing to set again')
  f.set(torusState({settings: {polyphony: 8}}))
  f.fire()
  await tick(); await tick()
  assert.deepEqual(f.acts.map(a => [a.act.kind, a.act.track]), [['torus_keep', 1]], 'the part chosen is audio: the first MIDI part keeps it')
  keeper.open('/sets/b.als', 2)
  assert.equal(await keeper.keepOn('/sets/b.als', 2), null)
  assert.deepEqual(f.acts.at(-1).act.track, 2, 'the part a take was laid on keeps it')
  assert.match(await keeper.keepOn('/sets/other.als', 0), /not open/)
  assert.equal(take.torusHomeOf({tracks: [{kind: 'audio'}]}, null, 0), null)
  assert.equal(take.chosenPartOf(document, 2).name, 'Bass')
  assert.equal(take.chosenPartOf(document, 9), null)
})

// DLW build ruling 2026-11-05: "View and Follow are kept with the device in the set, where the set keeps a device's state, so they survive
// a restart." No owner keeps either (the hand holds them, techne/devices/designDevices.ts); the set's DLW record keeps the part's Torus
// (packages/live-set sources.rs `parts`), so the keeper keeps them there, beside the Torus as its owner announced it.
test('the set keeps the Torus device\'s View and Follow with its part, once they rest; a set opened again holds them before the Torus is set again', async () => {
  const f = keeperOwners({document: {tracks: [{kind: 'midi', name: 'Keys'}]}})
  let pane = {view: 'surface', follow: true}
  const paneListeners = new Set()
  const choose = next => { pane = next; for (const listener of [...paneListeners]) listener() }
  f.owners.device = {read: () => pane, hold: () => assert.fail('a set that kept no device holds nothing'), subscribe: listener => { paneListeners.add(listener); return () => paneListeners.delete(listener) }}
  const keeper = take.createTorusKeeper(f.owners, f.tell)
  keeper.open('/sets/c.als', 0)
  await tick()
  choose({view: 'wire', follow: true})
  choose({view: 'wire', follow: false})
  assert.equal(f.timers.length, 1, 'a View or Follow chosen is kept once it rests, as a knob is')
  f.fire()
  await tick(); await tick()
  assert.equal(f.acts.length, 1)
  const kept = take.torusKeptOf(f.acts[0].act.torus)
  assert.deepEqual(kept.device, {view: 'wire', follow: false}, 'kept with the device in the set')
  assert.deepEqual(kept.edits, take.torusKept(torusState()).edits, 'beside the Torus as it stands')
  choose({view: 'wire', follow: false})
  f.fire()
  await tick(); await tick()
  assert.equal(f.acts.length, 1, 'the View and Follow the set keeps are no change')
  keeper.close()

  const g = keeperOwners({document: {tracks: [{kind: 'midi', name: 'Keys', torus: structuredClone(f.acts[0].act.torus)}]}, torus: null})
  const held = []
  g.owners.device = {read: () => held.at(-1) ?? {view: 'surface', follow: true}, hold: next => held.push(next), subscribe: () => () => {}}
  const again = take.createTorusKeeper(g.owners, g.tell)
  again.open('/sets/c.als', null)
  await tick()
  assert.deepEqual(held, [{view: 'wire', follow: false}], 'the device opens with the View and Follow its set keeps, before the Torus can take edits')
  g.set(torusState())
  await tick()
  assert.deepEqual(g.commits, kept.edits, 'and the Torus is set again as its part keeps it')
  assert.deepEqual(g.acts, [], 'nothing is kept over it')
  again.close()

  assert.equal(take.torusKeptOf({...kept, device: {view: 'mesh', follow: true}}).device, undefined, 'a View no device draws is not read back')
  assert.equal(take.torusDeviceKeptOf({view: 'both', follow: 'yes'}), null)
  assert.deepEqual(take.torusDeviceKeptOf({view: 'both', follow: true}), {view: 'both', follow: true})
  assert.equal(take.sameTorusEdits(kept, {...kept, device: {view: 'surface', follow: true}}), true, 'a take\'s moves are the sound\'s: a View is none')
  assert.match(source('live/torusDevice.ts'), /export const TORUS_VIEWS = \['surface', 'wire', 'both'\] as const/, 'the Views the set reads back are the device\'s')
  assert.deepEqual(take.TORUS_KEPT_VIEWS, ['surface', 'wire', 'both'])
})

// ── the candidate's wiring ─────────────────────────────────────────────────────────────────────────────────────────────────────────

test('the candidate records on the part\'s one playing path, prepares a take before it plays, and binds Record in Live\'s transport', () => {
  const layoutSource = source('live/keyboardLayout.ts')
  const path = layoutSource.slice(layoutSource.indexOf('export function livePlayingPath'), layoutSource.indexOf('export function setLivePlayingTransform'))
  assert.match(path, /onNote: played => liveTakeRecorder\.played\(played\),/, 'every note the path plays is told to the recorder')
  const clip = source('live/clipPlayer.ts')
  const owners = clip.slice(clip.indexOf('function candidateOwners('), clip.indexOf('export const liveClipPlayer'))
  // REPLACES (O-I #849 round 21): the candidate's prepare took no turn; a row's takes ask the press's one Torus now
  // REPLACES (O-I #849 round 22): the prepare without its place; where the engine plays the set, a held take is frozen on the clip's part
  assert.match(owners, /prepare: \(clip, bpm, turn, address\) => prepareTake\(clip, commitLiveInstrumentEdit,\n\s+\{stage: commitLiveStage, bpm, \.\.\.\(address && engineFreezes\(address\.path\) \? \{frozen: partFreeze\(address\)\} : \{\}\)\}, turn\),/)
  assert.match(owners, /edit: \(edit, at\) => commitLiveStage\(\{command: 'instrument', edit, \.\.\.\(at === undefined \? \{\} : \{at_samples_elapsed: at\}\)\}\),/,
    'a setting of a take\'s course lands at its sample')
  const record = source('live/liveTake.ts')
  assert.match(record.slice(record.indexOf('export async function liveRecord(')), /stage: torus\.commitLiveStage,/, 'Record keeps the course through the stage channel')
  assert.match(record.slice(record.indexOf('export async function liveRecord(')), /device: \{read: \(\) => device\.torusDeviceHeld\(\), hold: device\.holdTorusDevice, subscribe: holds\.subscribeHolds\},/,
    'the keeper keeps the View and Follow the hand holds, and holds them again when a set opens with them')
  const tracks = source('frame/tracks/modeTracks.ts')
  assert.match(tracks, /const exportTake = \(track: number, at: LiveClipAt\) => import\('\.\.\/\.\.\/live\/liveTake'\)\.then\(module => module\.exportLiveTake\(\{path: set\.path, track, at\}\)\)/,
    'a take\'s clip exports its audio from Live\'s set')
  assert.match(tracks, /liveSetTrackAdapter\.project\(\{set, document, colors, \.\.\.liveSetWrites\(set\.path\), play, exportTake, engine, record, lanes\}\)/)
  const transport = source('shell/transports/useLiveTransport.tsx')
  assert.match(transport, /const record = useLiveRecord\(\{setPath, track: setSelectionOf\(selection, setPath \?\? undefined\)\?\.track \?\? null, bpm: tempoBpm, torus,/)
  assert.match(transport, /\.\.\.playStop,\n\s+record,/, 'Record stands in Live\'s place beside Play and Stop')
})

// ── the Torus's course: Record, replay and Export Audio (round 6d) ───────────────────────────────────────────────────────────────────
// The owner keeps the Torus as it rings (`torus` checkpoint) and journals each act with the sample it landed at (`performance-journal`);
// Record keeps both with the take, a take played again rings again from that state and each act lands at its sample after it, and Export
// Audio renders the course offline (`render-take`), part after part. The frame's channel is a fake that answers as the frame does.

const T0 = '480000'
const CHECKPOINT = {schema: 'ql.torus-checkpoint/v1', taken_at_samples: T0, sample_rate: 48000, event: {ref: 'e'}, seeds: [7, 11], session: {steps: 12}}
const journalAct = (request_id, operation, command, samples) => ({request_id, operation, command: {operation, ...command},
  acknowledged: {generation: '5', samples_elapsed: samples}, kind: 'act'})
const JOURNAL = acts => ({schema: 'ql.instrument-performance-journal/v1', instance_ref: 'ql:i', acts,
  advances: {blocks: 0, frames: 0, first_samples_elapsed: null, last_samples_elapsed: null}})
/** The frame's stage channel as a fake: the checkpoint, the audio clock, the journal and a restore, as the frame answers them. */
const stageOwner = ({journal = [], clock = '528000', checkpoint = CHECKPOINT, refuse = {}, named} = {}) => {
  const sent = []
  return {sent, stage: async command => {
    sent.push(structuredClone(command))
    const key = command.command === 'torus' ? `torus:${command.action}` : command.command
    if (refuse[key]) return {ok: false, error: refuse[key]}
    // `named`: the name the kernel relayed the checkpoint under, as the stage's `torus` checkpoint answers it (app.ts, C27)
    if (key === 'torus:checkpoint') return {ok: true, checkpoint: structuredClone(checkpoint), ...(named === undefined ? {} : {checkpoint_sha256: named})}
    if (key === 'audio-clock') return {ok: true, clock: {samples_elapsed: clock, sample_rate: 48000, lookahead_seconds: 0.05, block_frames: 512}}
    if (key === 'performance-journal') return {ok: true, journal: JOURNAL(journal)}
    if (key === 'torus:restore') return {ok: true, landed_at_samples_elapsed: '900000'}
    return {ok: false, error: `unexpected ${key}`}
  }}
}
const COURSE = {schema: 'oi.live-take-course/v1', checkpoint: CHECKPOINT, from_samples_elapsed: T0, frames: 96000, sample_rate: 48000, acts: [
  {action: 'strike', at_samples_elapsed: '504000', keys: [C4], amplitude: 1},
  {action: 'set', at_samples_elapsed: '510000', edit: {carrier: 0.5}},
  {action: 'release', at_samples_elapsed: '526000', keys: [C4]},
  {action: 'strike', at_samples_elapsed: '540000', keys: [E4], amplitude: 0.5},
]}

test('Record keeps the Torus\'s course: the state it rang in when the take began, and each act its owner took at the sample it landed at', async () => {
  const recorder = take.createTakeRecorder()
  const s = stageOwner({journal: [
    journalAct('1', 'torus-play', {keys: [C4], amplitude: [1, 0]}, '504000'),
    journalAct('2', 'stage-bind', {procedure: 'p'}, '506000'),
    journalAct('3', 'torus-set', {edit: {carrier: 0.5}, at_samples_elapsed: '510000'}, '507000'),
    // A clip's note sent ahead before Stop: it lands inside the take.
    journalAct('4', 'torus-play', {keys: [E4], amplitude: [0.5, 0], at_samples_elapsed: '540000'}, '508000'),
    journalAct('5', 'torus-release', {keys: [C4]}, '526000'),
    // Played after Stop: not the take's.
    journalAct('6', 'torus-play', {keys: [G4], amplitude: [1, 0]}, '530000'),
  ]})
  const f = recordOwners({document: SET})
  const record = take.createLiveRecord(recorder, {...f.owners, stage: s.stage})
  await record.start('/sets/a.als', 1, 120, null)
  assert.deepEqual(s.sent, [{command: 'torus', action: 'checkpoint'}], 'the Torus is kept as it rings when the take begins')
  f.at(520)
  recorder.played({kind: 'on', id: 'p', note: 60, key: C4, touch: 0, amplitude: 1, source: 'pointer', at: 520})
  f.at(980)
  recorder.played({kind: 'off', id: 'p', note: 60, key: C4, touch: 0, amplitude: 0, source: null, at: 980})
  f.at(1000)
  await record.stop()
  assert.deepEqual(s.sent.slice(1), [{command: 'audio-clock'}, {command: 'performance-journal', from_samples_elapsed: T0}],
    'at Stop, the owner\'s cursor, then its journal from the take\'s first sample')
  const laid = f.acts[0].act
  assert.deepEqual(laid.keeps.course, COURSE,
    'in the order of their samples, the take whole bars long; a stage act moves no sound; an act after Stop is not the take\'s')
  assert.deepEqual(laid.notes, [{p: 60, at: 1, len: 0.916667, vel: 127}], 'the note lies at the sample it landed at, not at the page\'s time')
  assert.equal(laid.keeps.resumes, take.TAKE_REPLAYS)
  assert.match(take.TAKE_REPLAYS, /plays again as it was played/)
  assert.deepEqual(laid.keeps.not_kept, [...take.TAKE_COURSE_NOT_KEPT])
  for (const word of ['the seeds', 'the course of the body', 'the sample each note landed at']) assert.ok(!laid.keeps.not_kept.includes(word), word)
  assert.match(record.state().said, /Export Audio on its clip renders it as it was played, sample for sample\./)
  assert.doesNotMatch(record.state().said, /does not sound in it yet/)
})

// PORT (BA round 868, C27): the stage's `torus` checkpoint answers the name the kernel relayed it under; a take is sealed by that name.
const NAMED = 'sha256:' + 'b'.repeat(64)
test('the course keeps the name the kernel relayed the take\'s checkpoint under, as the stage answers it, and reads it back; an ill name is no course', async () => {
  const run = async named => {
    const recorder = take.createTakeRecorder()
    const s = stageOwner({named, journal: [journalAct('1', 'torus-play', {keys: [C4], amplitude: [1, 0]}, '504000')]})
    const f = recordOwners({document: SET})
    const record = take.createLiveRecord(recorder, {...f.owners, stage: s.stage})
    await record.start('/sets/a.als', 1, 120, null)
    f.at(520)
    recorder.played({kind: 'on', id: 'p', note: 60, key: C4, touch: 0, amplitude: 1, source: 'pointer', at: 520})
    f.at(1000)
    await record.stop()
    return f.acts[0].act.keeps.course
  }
  const course = await run(NAMED)
  assert.equal(course.checkpoint_sha256, NAMED, 'the take keeps the name of the checkpoint it began at')
  assert.deepEqual(course.checkpoint, CHECKPOINT, 'beside the checkpoint itself')
  assert.deepEqual(take.takeCourseOf(structuredClone(course)), course, 'kept beside the set, it reads back with its name')
  const unnamed = await run(undefined)
  assert.equal('checkpoint_sha256' in unnamed, false, 'a checkpoint relayed under no name keeps none')
  assert.deepEqual(take.takeCourseOf(structuredClone(unnamed)), unnamed)
  for (const ill of ['sha256:', 'sha256:b b', 'md5:' + 'b'.repeat(32), 'sha256:' + 'b'.repeat(122), 42, null]) {
    assert.equal(take.takeCourseOf({...course, checkpoint_sha256: ill}), null, `a kept course named ${JSON.stringify(ill)} is no course`)
    assert.equal('checkpoint_sha256' in (await run(ill)), false, `a stage answering ${JSON.stringify(ill)} names nothing the take is sealed by`)
  }
  assert.equal(take.takeCourse(CHECKPOINT, JOURNAL([]), '528000', 96000, NAMED).course.checkpoint_sha256, NAMED)
})

test('a take whose window moved the scene, or whose owner kept no state of it, keeps no course and says why, as Export Audio does', async () => {
  for (const [over, why] of [
    [{journal: [journalAct('1', 'replace-event', {event: {}}, '505000')]}, /replace-event moved the scene at sample 505000/],
    [{journal: [journalAct('1', 'torus-play', {keys: [C4], amplitude: [1, 0.25]}, '505000')]}, /second amplitude/],
    [{refuse: {'torus:checkpoint': 'The torus is not following'}}, /The torus is not following/],
    [{refuse: {'performance-journal': 'The journal holds 5000 acts from that sample: read it from a later sample'}}, /5000 acts/],
    // REPLACED (DLW build ruling 2026-11-05, "its 256 KiB inline cap retires for the course"): a course past 256 KiB is kept now, in the
    // project's media (the test below); one past the media's own bound is not
    [{checkpoint: {...CHECKPOINT, event: {pad: 'x'.repeat(17 * 1024 * 1024)}}}, /past the 16 MiB the project's media keeps of one/],
  ]) {
    const recorder = take.createTakeRecorder()
    const s = stageOwner(over)
    const f = recordOwners({document: SET})
    const record = take.createLiveRecord(recorder, {...f.owners, stage: s.stage})
    await record.start('/sets/a.als', 1, 120, null)
    f.at(500)
    recorder.played({kind: 'on', id: 'p', note: 60, key: C4, touch: 0, amplitude: 1, source: 'pointer', at: 500})
    f.at(1000)
    await record.stop()
    const keeps = f.acts[0].act.keeps
    assert.equal(keeps.course, null, String(why))
    assert.match(keeps.course_refused, why)
    assert.equal(keeps.resumes, take.TAKE_RESUMES, 'it resumes from the body as it then rings')
    assert.deepEqual(keeps.not_kept, [...take.TAKE_NOT_KEPT])
    assert.deepEqual(f.acts[0].act.notes, [{p: 60, at: 1, len: 1, vel: 127}], 'its notes lie at the page\'s time')
    assert.match(record.state().said, /keeps no course of the Torus, so Export Audio cannot render it/)
    assert.match(record.state().said, why)
  }
})

test('a course past the 256 KiB a take kept inline is kept whole: the set\'s owner keeps it in the project\'s media (DLW build ruling 2026-11-05)', async () => {
  const recorder = take.createTakeRecorder()
  const s = stageOwner({checkpoint: {...CHECKPOINT, event: {pad: 'x'.repeat(300 * 1024)}}})
  const f = recordOwners({document: SET})
  const record = take.createLiveRecord(recorder, {...f.owners, stage: s.stage})
  await record.start('/sets/a.als', 1, 120, null)
  f.at(500)
  recorder.played({kind: 'on', id: 'p', note: 60, key: C4, touch: 0, amplitude: 1, source: 'pointer', at: 500})
  f.at(1000)
  await record.stop()
  const keeps = f.acts[0].act.keeps
  assert.ok(keeps.course, 'the course is kept')
  assert.equal(keeps.course.checkpoint.event.pad.length, 300 * 1024)
  assert.equal(keeps.course_refused, undefined)
  assert.equal(keeps.resumes, take.TAKE_REPLAYS)
})

test('the course keeps a touch and a singlet at the samples they landed at, as render-take makes them, and reads them back exactly', () => {
  // O-I #855, kept whole: a touch of the surface (`strike-at`, controller.ts playAt) and a singlet (`torus-singlet`, O-I #771) are acts a take
  // plays again and its render makes, as a key is (QL scene_field.rs TorusRenderAct; the kernel's take witness keeps them too).
  const touch = [{theta: 0.75, phi: 2.5, amplitude: [0.3, 0]}, {theta: 4, phi: 5.5, amplitude: [0.3, 0]}]
  const landed = take.takeCourse(CHECKPOINT, JOURNAL([
    journalAct('1', 'strike-at', {points: touch, at_samples_elapsed: '500000'}, '490000'),
    journalAct('2', 'torus-singlet', {codon: 8, amplitude: [0.35, 0]}, '512000'),
    journalAct('3', 'torus-play', {keys: [C4], amplitude: [1, 0]}, '520000'),
  ]), '528000', 96000)
  assert.deepEqual(landed.course.acts, [
    {action: 'strike-at', at_samples_elapsed: '500000', points: [{theta: 0.75, phi: 2.5}, {theta: 4, phi: 5.5}], amplitude: 0.3},
    {action: 'singlet', at_samples_elapsed: '512000', codon: 8, amplitude: 0.35},
    {action: 'strike', at_samples_elapsed: '520000', keys: [C4], amplitude: 1}])
  assert.deepEqual(take.takeCourseOf(structuredClone(landed.course)), landed.course, 'kept beside the set, it reads back whole')
  assert.deepEqual([...landed.struck.keys()], ['0/42'], 'only a key is a note struck')
  // What a take's render does not strike so is said, and the take keeps no course.
  for (const [act, why] of [
    [journalAct('1', 'strike-at', {points: [touch[0], {...touch[1], amplitude: [0.5, 0]}]}, '500000'), /strike-at at sample 500000 struck its points at more than one strength/],
    [journalAct('1', 'strike-at', {points: [{...touch[0], amplitude: [0.3, 0.1]}]}, '500000'), /strike-at struck at sample 500000 with a second amplitude/],
    [journalAct('1', 'strike-at', {points: [{theta: 7, phi: 1, amplitude: [0.3, 0]}]}, '500000'), /strike-at at sample 500000 names no points on the sheet/],
    [journalAct('1', 'torus-singlet', {codon: 64, amplitude: [0.35, 0]}, '500000'), /torus-singlet at sample 500000 names no codon of the 64 at a strength in \(0, 1\]/],
    [journalAct('1', 'torus-singlet', {codon: 8, amplitude: [0.35, 0.2]}, '500000'), /torus-singlet struck at sample 500000 with a second amplitude/],
  ]) assert.match(take.takeCourse(CHECKPOINT, JOURNAL([act]), '528000', 96000).refused, why)
  const course = landed.course
  for (const act of [{...course.acts[0], points: []}, {...course.acts[0], amplitude: 0}, {...course.acts[0], keys: [C4]}, {...course.acts[1], codon: 64},
    {...course.acts[1], codon: 2.5}, {...course.acts[1], amplitude: 1.5}])
    assert.equal(take.takeCourseOf({...course, acts: [act]}), null, JSON.stringify(act))
})

test('the clip player strikes a take\'s touch and singlet again at their samples through the frame\'s own commands; one behind the render is missed', async () => {
  const clock = controlledClock()
  const touches = [], singlets = []
  const exact = {landed: '900000', from: T0, frames: 96000, sample_rate: 48000, noteOf: () => null, acts: [
    {action: 'singlet', at_samples_elapsed: '480100', codon: 5, amplitude: 0.35},
    {action: 'strike-at', at_samples_elapsed: '504000', points: [{theta: 0.75, phi: 2.5}], amplitude: 0.3},
    {action: 'singlet', at_samples_elapsed: '510000', codon: 8, amplitude: 0.35},
  ]}
  const owners = {
    read: async () => ({...REAL, name: 'Take 1', loop: false, start: 0, end: 4, take: {id: 7, keeps: {}}, notes: [{id: 1, p: 60, at: 1, len: 1, vel: 127, chance: 1, on: true}]}),
    prepare: async () => ({resumes: take.TAKE_REPLAYS, exact}),
    clock: async () => ({samples_elapsed: '902400', sample_rate: 48000, lookahead_seconds: 0.05, block_frames: 512}),
    strike: async () => ({ok: true}), release: () => {},
    touch: async (points, amplitude, at) => { touches.push([points, amplitude, at]); return {ok: true} },
    singlet: async (codon, amplitude, at) => { singlets.push([codon, amplitude, at]); return {ok: false, error: 'No live instrument plays: open the instrument'} },
    watch: () => () => {}, now: clock.now, later: clock.later, cancel: clock.cancel, random: () => 0,
  }
  const p = player.createClipPlayer(owners)
  p.play({path: '/sets/a.als', track: 1, at: {arrangement: 0}}, 120)
  for (let i = 0; i < 6; i++) await tick()
  await clock.run(100.41)
  assert.deepEqual(touches, [[[{theta: 0.75, phi: 2.5}], 0.3, '924000']], 'the touch at R + (its sample − the take\'s first), at its strength')
  assert.equal(p.state().missed, 1, 'the singlet behind the owner\'s render is missed, and counted')
  await clock.run(100.53)
  assert.deepEqual(singlets, [[8, 0.35, '930000']], 'the singlet at its sample, at its strength')
  for (let i = 0; i < 4; i++) await tick()
  assert.match(p.state().refused ?? '', /No live instrument plays/, 'the Torus\'s refusal is said')
  const wired = source('live/clipPlayer.ts')
  assert.match(wired, /touch: \(points, amplitude, at\) => commitLiveStage\(\{command: 'strike-at', points: \[\.\.\.points\], amplitude, at_samples_elapsed: at\}\)/)
  assert.match(wired, /singlet: \(codon, amplitude, at\) => commitLiveStage\(\{command: 'singlet', codon, amplitude, at_samples_elapsed: at\}\)/)
})

test('a take with its course plays again as it was played: the Torus set as it stood, rung again from its state, each act at its sample', async () => {
  const torus = take.torusKept(torusState({level: 0.5}))
  const carrier = take.torusKept(torusState({level: 0.5, settings: {carrier: 0.5}}))
  const carrierLevel = take.torusKept(torusState({level: 0.25, settings: {carrier: 0.5}}))
  const keeps = {schema: 'oi.live-take/v1', torus, moves: [{beat: 1.0625, torus: carrier}, {beat: 2, torus: carrierLevel}], bpm: 120, resumes: take.TAKE_REPLAYS,
    notes: [{p: 60, at: 1, len: 0.916667, vel: 127, key: C4, touch: 0, strength: 1, source: 'pointer'}], course: COURSE, not_kept: [...take.TAKE_COURSE_NOT_KEPT]}
  const clip = {...REAL, name: 'Take 1', loop: false, start: 0, end: 4, take: {id: 7, keeps}, notes: [{id: 1, p: 60, at: 1, len: 0.916667, vel: 127, chance: 1, on: true}]}
  const s = stageOwner(), order = []
  const commit = async edit => { order.push('edit'); return {ok: true} }
  const stage = async command => { order.push(`${command.command} ${command.action}`); return s.stage(command) }
  const prepared = await take.prepareTake(clip, commit, {stage, bpm: 120})
  assert.deepEqual(order, [...torus.edits.map(() => 'edit'), 'torus restore'], 'the Torus is set as it stood, then rung again from its state')
  assert.deepEqual(s.sent, [{command: 'torus', action: 'restore', checkpoint: CHECKPOINT}])
  assert.equal(prepared.resumes, take.TAKE_REPLAYS)
  const {noteOf, ...exact} = prepared.exact
  assert.deepEqual(exact, {landed: '900000', from: T0, frames: 96000, sample_rate: 48000, acts: COURSE.acts})
  assert.equal(noteOf(C4), 60, 'a key names the note it was played as')
  assert.equal(noteOf(G4), null)
  assert.deepEqual(prepared.moves, [{beat: 2, edits: [{kind: 'level', value: 0.25}]}], 'only the frame\'s own sound moves by beat: the Torus\'s moves are its course\'s')
  // What leaves the exact path, each in words, and resumes from the body as it then rings.
  const plays = (over, bpm = 120, through = stage) => take.prepareTake({...clip, ...over}, commit, {stage: through, bpm})
  for (const [over, words] of [
    [{notes: [{...clip.notes[0], at: 2}]}, /changed since it was laid/],
    [{loop: true, position: 0, length: 4}, /loop/],
    [{start: 1}, /start marker/],
  ]) {
    const p = await plays(over)
    assert.equal(p.exact, undefined, String(words))
    assert.match(p.resumes, words)
    assert.match(p.resumes, /resumes from the body as it then rings/)
  }
  const slower = await plays({}, 100)
  assert.equal(slower.exact, undefined)
  assert.match(slower.resumes, /120 BPM/)
  const refused = await plays({}, 120, stageOwner({refuse: {'torus:restore': 'That checkpoint is not of this body'}}).stage)
  assert.equal(refused.exact, undefined)
  assert.match(refused.resumes, /did not ring again from the take's state: That checkpoint is not of this body/)
  const none = await take.prepareTake({...clip, take: {id: 7, keeps: {...keeps, course: null, course_refused: 'replace-event moved the scene at sample 505000',
    resumes: take.TAKE_RESUMES}}}, commit, {stage, bpm: 120})
  assert.equal(none.exact, undefined)
  assert.match(none.resumes, /keeps no course of the Torus: replace-event moved the scene at sample 505000\./)
  assert.equal((await take.prepareTake(clip, commit)).exact, undefined, 'with no stage owner it plays as its notes are written')
})

// O-I #849 round 21, item 2: a row of several takes plays each on its own track's player, and one Torus rings at a time. Round 22 (DLW build
// ruling 2026-11-05): the turn is the first take's until it ends, held in the same words for any launch; a held take whose course can play
// is frozen on its part where the engine plays its set, and says so where it is not.
test('a take whose Torus another take holds sets nothing of it: it plays its notes as they were played, on the Torus as that one set it', async () => {
  const torus = take.torusKept(torusState({level: 0.5}))
  const carrier = take.torusKept(torusState({level: 0.5, settings: {carrier: 0.5}}))
  const keeps = {schema: 'oi.live-take/v1', torus, moves: [{beat: 1.0625, torus: carrier}], bpm: 120, resumes: take.TAKE_REPLAYS,
    notes: [{p: 60, at: 1, len: 0.916667, vel: 127, key: C4, touch: 2, strength: 0.7, source: 'pointer'}], course: COURSE, not_kept: [...take.TAKE_COURSE_NOT_KEPT]}
  const clip = {...REAL, name: 'Take 2', loop: false, start: 0, end: 4, take: {id: 8, keeps}, notes: [{id: 1, p: 60, at: 1, len: 0.916667, vel: 127, chance: 1, on: true}]}
  const s = stageOwner(), edits = []
  const commit = async edit => { edits.push(edit); return {ok: true} }
  const turn = player.torusTurn()
  assert.equal(turn.take('Take 1'), null)
  const held = await take.prepareTake(clip, commit, {stage: s.stage, bpm: 120}, turn)
  assert.deepEqual([edits, s.sent], [[], []], 'nothing of the Torus is set, and it is not rung again')
  // REPLACES "Take 1 sets the Torus again in this row": the turn is Take 1's until it ends, whichever launch played Take 2 (round 22).
  assert.equal(held.resumes, `${take.takeTorusHeld('Take 1', 'Take 2')} ${take.TAKE_FREEZES_IN_ENGINE}`, 'no engine plays its set: it is not frozen, and says so')
  assert.match(held.resumes, /^Take 1 holds the Torus until it ends, and one Torus rings at a time: Take 2 plays each note at the touch-point it struck/)
  assert.equal(held.frozen, undefined)
  assert.deepEqual(held.voice(60, 1), {touch: 2, strength: 0.7}, 'each note as it was played')
  assert.equal(held.exact, undefined, 'its course is not played on another take\'s Torus')
  assert.equal(held.moves, undefined, 'and it makes none of its moves on it')
  // the take that asks first holds the Torus for its press, as a launch alone does
  const first = player.torusTurn()
  const own = await take.prepareTake(clip, commit, {stage: s.stage, bpm: 120}, first)
  assert.ok(own.exact, 'the first to ask plays as it was played')
  assert.equal(first.take('Take 3'), 'Take 2', 'and the Torus is its for the press')
  // a take that sets nothing of the Torus asks no turn of it
  const bare = player.torusTurn()
  await take.prepareTake({...clip, take: {id: 9, keeps: {schema: 'oi.live-take/v1', notes: keeps.notes}}}, commit, {stage: s.stage, bpm: 120}, bare)
  assert.equal(bare.take('Take 3'), null, 'a take whose Torus was not kept leaves the Torus to the next')
  const wired = source('live/clipPlayer.ts')
  // REPLACES the prepare without its place (round 22): where the engine plays the set, a held take is frozen on the clip's part.
  assert.match(wired, /prepare: \(clip, bpm, turn, address\) => prepareTake\(clip, commitLiveInstrumentEdit,\n\s+\{stage: commitLiveStage, bpm, \.\.\.\(address && engineFreezes\(address\.path\) \? \{frozen: partFreeze\(address\)\} : \{\}\)\}, turn\)/)
  assert.match(wired, /return detectTransport\(\)\.kind === 'tauri' && reading\?\.path === path && reading\.playing/)
})


test('under its course a take\'s owner lanes are its course\'s acts, and only a session-held lane is written again at its beats (O-I 853)', async () => {
  const torus = take.torusKept(torusState({level: 0.5}))
  const carrierLevel = take.torusKept(torusState({level: 0.25}))
  const automation = [{parameter: 'cadence', label: 'Tick cadence', writer: 'owner', points: [[0.5, '12']]},
    {parameter: 'note-device:s1:tie', label: 'Scale tie', writer: 'session', points: [[1, 'up'], [3, 'down']]}]
  const keeps = {schema: 'oi.live-take/v1', torus, moves: [{beat: 2, torus: carrierLevel}], bpm: 120, resumes: take.TAKE_REPLAYS, automation,
    notes: [{p: 60, at: 1, len: 0.916667, vel: 127, key: C4, touch: 0, strength: 1, source: 'pointer'}], course: COURSE, not_kept: [...take.TAKE_COURSE_NOT_KEPT]}
  const clip = {...REAL, name: 'Take 1', loop: false, start: 0, end: 4, take: {id: 7, keeps}, notes: [{id: 1, p: 60, at: 1, len: 0.916667, vel: 127, chance: 1, on: true}]}
  const prepared = await take.prepareTake(clip, async () => ({ok: true}), {stage: stageOwner().stage, bpm: 120})
  assert.ok(prepared.exact, 'it plays as it was played')
  assert.deepEqual(prepared.moves, [{beat: 1, edits: [], sets: [{parameter: 'note-device:s1:tie', value: 'up'}]}, {beat: 2, edits: [{kind: 'level', value: 0.25}]},
    {beat: 3, edits: [], sets: [{parameter: 'note-device:s1:tie', value: 'down'}]}], 'the frame\'s own sound and the session\'s tie by beat; the Cadence is the course\'s')
})

test('the clip player plays a take\'s course at its samples from where the Torus rang again; an act behind the render is missed; Stop lets its keys go', async () => {
  const clock = controlledClock()
  const strikes = [], releases = [], edits = []
  const exact = {landed: '900000', from: T0, frames: 96000, sample_rate: 48000, noteOf: key => key.row === 0 && key.column === 42 ? 60 : null, acts: [
    // R + (480100 − T0) = 900100: behind the owner's render when the clock is read.
    {action: 'strike', at_samples_elapsed: '480100', keys: [G4], amplitude: 1},
    {action: 'strike', at_samples_elapsed: '504000', keys: [C4, E4], amplitude: 0.75},
    {action: 'set', at_samples_elapsed: '510000', edit: {carrier: 0.5}},
    {action: 'release', at_samples_elapsed: '526000', keys: [C4]},
  ]}
  const owners = {
    read: async () => ({...REAL, name: 'Take 1', loop: false, start: 0, end: 4, take: {id: 7, keeps: {}}, notes: [{id: 1, p: 60, at: 1, len: 1, vel: 127, chance: 1, on: true}]}),
    prepare: async (_clip, bpm) => ({resumes: take.TAKE_REPLAYS, exact, moves: [{beat: 3, edits: [{kind: 'level', value: 0.25}]}], bpm}),
    // The owner's render stands at 902400; one lookahead is 2400 samples: the clip's anchor is 904800.
    clock: async () => ({samples_elapsed: '902400', sample_rate: 48000, lookahead_seconds: 0.05, block_frames: 512}),
    edit: async (edit, at) => { edits.push([edit, at, clock.now()]); return {ok: true} },
    strike: async (notes, amplitude, at, sounds) => { strikes.push([notes, amplitude, at, clock.now(), sounds]); return {ok: true} },
    release: (holds, sounds) => releases.push([holds, clock.now(), sounds]),
    watch: () => () => {}, now: clock.now, later: clock.later, cancel: clock.cancel, random: () => 0,
  }
  const p = player.createClipPlayer(owners)
  p.play({path: '/sets/a.als', track: 1, at: {arrangement: 0}}, 120)
  for (let i = 0; i < 6; i++) await tick()
  assert.equal(p.state().resumes, take.TAKE_REPLAYS)
  await clock.run(100.39)
  assert.equal(strikes.length, 0, 'nothing is sent before its sample comes within one lookahead of the render')
  await clock.run(100.41)
  assert.deepEqual(strikes.map(([notes, amplitude, at]) => [notes.map(n => [n.key, n.note]), amplitude, at]), [[[[C4, 60], [E4, -1]], 0.75, '924000']],
    'its own keys, struck at R + (its sample − the take\'s first)')
  assert.equal(p.state().missed, 1, 'the act behind the owner\'s render is missed, and said')
  await clock.run(100.53)
  assert.deepEqual(edits.map(([edit, at]) => [edit, at]), [[{kind: 'torus', edit: {carrier: 0.5}}, '930000']], 'a setting lands at its sample')
  await clock.run(100.88)
  assert.deepEqual(releases.map(([holds]) => holds), [[strikes[0][0][0].hold]], 'a release in its sample\'s turn')
  // O-I #853 round 22: each is sent one owner lookahead (50 ms) before it sounds, and names the time to its sample for MIDI out.
  assert.ok(Math.abs(strikes[0][4] - 50) < 1e-6 && Math.abs(releases[0][2] - 50) < 1e-6, `${strikes[0][4]} ${releases[0][2]}`)
  await clock.run(101.46)
  assert.deepEqual(edits.at(-1).slice(0, 2), [{kind: 'level', value: 0.25}, undefined], 'the frame\'s own level moves at its beat, within a block')
  assert.notEqual(p.state().playing, null)
  await clock.run(101.91)
  assert.equal(p.state().playing, null, 'the take ends where its course ends')
  assert.deepEqual(releases.at(-1)[0], [strikes[0][0][1].hold], 'what it still holds is let go there')
  // Stop lets go of what the course holds.
  strikes.length = 0; releases.length = 0
  p.play({path: '/sets/a.als', track: 1, at: {arrangement: 0}}, 120)
  for (let i = 0; i < 6; i++) await tick()
  await clock.run(clock.now() + 0.41)
  assert.equal(strikes.length, 1)
  p.stop()
  assert.deepEqual(releases.at(-1)[0].sort(), strikes[0][0].map(n => n.hold).sort(), 'Stop lets every key of the take go')
  assert.equal(releases.at(-1)[2], undefined, 'at once')
})

test('a take\'s keys strike those very keys at their sample on the one playing path, with no surface needed; Panic lets them go', async () => {
  const o = owner()
  const path = keys.createJankoInput({send: o.send, window: () => null})
  const far = {row: 5, column: 900}
  const answer = await Promise.race([path.clipStrike([{hold: 'take:1', note: 60, key: C4}, {hold: 'take:2', note: -1, key: far}], 0.75, '924000'),
    tick().then(tick).then(() => 'unanswered')])
  assert.notEqual(answer, 'unanswered')
  assert.deepEqual(o.sent, [{command: 'janko', action: 'strike', keys: [C4, far], amplitude: 0.75, at_samples_elapsed: '924000'}])
  assert.deepEqual(path.sounding(), [C4, far])
  path.clipRelease(['take:2'])
  await tick()
  assert.deepEqual(o.sent.at(-1), {command: 'janko', action: 'release', keys: [far]})
  path.panic()
  await tick()
  assert.deepEqual(o.sent.at(-1), {command: 'janko', action: 'release', keys: [C4]})
  assert.equal((await path.clipStrike([{hold: 'c', note: 60}], 0.5, '1')).ok, false, 'a note with no key of its own still needs the surface')
  await path.clipStrike([{hold: 'd', note: 60, key: {row: 6, column: 1}}], 0.5, '1')
  assert.equal(o.sent.filter(c => c.action === 'strike').length, 1, 'a key off the surface is struck by no one')
})

/** The frame's `render-take`, as a fake: each part rendered from the checkpoint it was sent, its PCM the part's count, ending at its end. */
const renderOwner = ({skew = 0n, refuse = null} = {}) => {
  const sent = []
  return {sent, stage: async command => {
    sent.push(structuredClone(command))
    if (refuse) return {ok: false, error: refuse}
    const from = BigInt(command.checkpoint.taken_at_samples)
    return {ok: true, render: {from_samples_elapsed: String(from), frames: command.frames, sample_rate: 48000,
      pcm: new Float32Array(command.frames).fill(sent.length / 8), made_way: command.acts.map(() => []),
      ended: {...CHECKPOINT, taken_at_samples: String(from + BigInt(command.frames) + skew), part: sent.length}}}
  }}
}

test('Export Audio renders a take\'s course in parts, each from the checkpoint the last one ended at, and refuses a part that does not continue', async () => {
  const course = {...COURSE, frames: 2500, acts: [{action: 'strike', at_samples_elapsed: '480010', keys: [C4], amplitude: 1},
    {action: 'release', at_samples_elapsed: '481200', keys: [C4]}, {action: 'set', at_samples_elapsed: '482400', edit: {carrier: 0.5}}]}
  const r = renderOwner()
  const rendered = await take.renderTake(course, r.stage, 1000)
  assert.deepEqual(r.sent.map(c => [c.command, c.checkpoint.taken_at_samples, c.frames, c.acts.map(a => a.at_samples_elapsed)]), [
    ['render-take', T0, 1000, ['480010']], ['render-take', '481000', 1000, ['481200']], ['render-take', '482000', 500, ['482400']]],
    'each part carries the acts that land in it')
  assert.equal(r.sent[1].checkpoint.part, 1, 'each part renders on from the checkpoint the last one ended at')
  assert.equal(rendered.sample_rate, 48000)
  assert.deepEqual([rendered.pcm.length, rendered.pcm[999], rendered.pcm[1000], rendered.pcm[2499]], [2500, 0.125, 0.25, 0.375])
  assert.match((await take.renderTake(course, renderOwner({skew: 1n}).stage, 1000)).refused, /did not end where the next part begins/)
  assert.match((await take.renderTake(course, renderOwner({refuse: 'The scene holds no Torus'}).stage, 1000)).refused, /The scene holds no Torus/)
  assert.equal((await take.renderTake(COURSE, renderOwner().stage)).pcm.length, 96000, 'a take within 2^24 frames is one part')
})

// O-I #849 round 22 (DLW build ruling 2026-11-05: "Build it: a true Torus per row player, through the engine, as Live's Freeze Track does.
// A rendered take is a frozen take"): a held take's course rendered offline by the Torus's owner, at the level it played at, its effects as
// they moved, sent to its part in the engine as its clip lands; its lanes as its course set the Torus, baked in.
test('a held take whose course can play is frozen on its part: rendered offline at its level, its effects and settings in its sound, sent as its clip lands', async () => {
  const torus = take.torusKept(torusState({level: 0.5, effects: {chain: ['filter'], filter: {cutoff: 1000}}}))
  const keeps = {schema: 'oi.live-take/v1', torus, moves: [], bpm: 120, resumes: take.TAKE_REPLAYS,
    notes: [{p: 60, at: 1, len: 0.916667, vel: 127, key: C4, touch: 2, strength: 0.7, source: 'pointer'}], course: COURSE, not_kept: [...take.TAKE_COURSE_NOT_KEPT]}
  const clip = {...REAL, name: 'Take 2', loop: false, start: 0, end: 4, take: {id: 8, keeps}, notes: [{id: 1, p: 60, at: 1, len: 0.916667, vel: 127, chance: 1, on: true}]}
  const edits = [], commit = async edit => { edits.push(edit); return {ok: true} }
  const sent = []
  const part = {freeze: async sound => { sent.push(sound); return null }, unfreeze: async () => { sent.push('unfreeze'); return null }}
  const heldBy = () => { const turn = player.torusTurn(); turn.take('Take 1'); return turn }
  const r = renderOwner()
  const held = await take.prepareTake(clip, commit, {stage: r.stage, bpm: 120, frozen: part}, heldBy())
  assert.deepEqual(edits, [], 'nothing of the live Torus is set')
  assert.deepEqual(r.sent.map(c => [c.command, c.checkpoint.taken_at_samples, c.frames, c.acts.length]), [['render-take', T0, 96000, 4]],
    'its course is rendered offline, every act at its sample: the live Torus neither moves nor sounds')
  assert.equal(held.resumes, take.takeTorusFrozen('Take 1', 'Take 2'))
  assert.match(held.resumes, /^Take 1 holds the Torus until it ends, and one Torus rings at a time: Take 2 is frozen on its part, its own Torus rendered with its moves and effects/)
  assert.deepEqual([held.exact, held.moves], [undefined, undefined], 'it plays no course and makes no move on the live Torus')
  assert.deepEqual(held.voice(60, 1), {touch: 2, strength: 0.7}, 'unfrozen, each note as it was played')
  const frozen = held.frozen
  assert.equal(frozen.words, take.takeFrozen('Take 2'))
  assert.equal(frozen.seconds, 2, 'its sound is its course: 96000 frames at 48 kHz')
  assert.deepEqual(frozen.settings, [{beat: 1.25, edit: {kind: 'torus', edit: {carrier: 0.5}}}], 'its Torus\'s settings, at the beats its course made them')
  assert.equal(frozen.unfrozen, take.takeUnfrozen('Take 1', 'Take 2'))
  assert.equal(sent.length, 0, 'nothing is sent before its clip lands')
  assert.equal(await frozen.land(900123n), null, 'the engine took it')
  const [sound] = sent
  assert.deepEqual([sound.name, sound.rate, sound.landed, sound.pcm.length], ['Take 2', 48000, 900123n, 96000])
  assert.deepEqual([sound.pcm[0], sound.pcm[95999]], [0.0625, 0.0625], 'the render (1/8 throughout) at the level the take played at (0.5)')
  assert.deepEqual(sound.effects, take.takeEffects(keeps, COURSE))
  assert.deepEqual(sound.effects[0], {frame: 0, effects: {chain: ['filter'], filter: {cutoff: 1000}}}, 'the Torus\'s effects as it began')
  assert.equal(await frozen.unfreeze(), null)
  assert.equal(sent[1], 'unfreeze', 'Unfreeze reaches the part')
  // The engine refuses it: the held words, and why, in its words; thrown, the same.
  const refusing = {freeze: async () => 'The engine follows no Torus it has taken yet', unfreeze: async () => { throw new Error('No set is open in the engine') }}
  const refused = await take.prepareTake(clip, commit, {stage: renderOwner().stage, bpm: 120, frozen: refusing}, heldBy())
  assert.equal(await refused.frozen.land(1n), `${take.takeTorusHeld('Take 1', 'Take 2')} It was not frozen on its part: The engine follows no Torus it has taken yet.`)
  assert.equal(await refused.frozen.unfreeze(), 'No set is open in the engine')
  const thrown = await take.prepareTake(clip, commit, {stage: renderOwner().stage, bpm: 120, frozen: {freeze: async () => { throw new Error('The take lands before the Torus') }, unfreeze: part.unfreeze}}, heldBy())
  assert.match(await thrown.frozen.land(1n), /It was not frozen on its part: The take lands before the Torus\.$/)
  // Its course not rendered: held, and why; nothing to freeze.
  const unrendered = await take.prepareTake(clip, commit, {stage: renderOwner({refuse: 'The scene holds no Torus'}).stage, bpm: 120, frozen: part}, heldBy())
  assert.equal(unrendered.frozen, undefined)
  assert.equal(unrendered.resumes, `${take.takeTorusHeld('Take 1', 'Take 2')} It was not frozen on its part: The Torus's owner did not render the take: The scene holds no Torus.`)
  // A course that cannot play (its clip loops) is held, as before, and not rendered.
  const looping = renderOwner()
  const loops = await take.prepareTake({...clip, loop: true, position: 0, length: 4}, commit, {stage: looping.stage, bpm: 120, frozen: part}, heldBy())
  assert.deepEqual([loops.resumes, loops.frozen, looping.sent.length], [take.takeTorusHeld('Take 1', 'Take 2'), undefined, 0])
  // The sound sent: the head names the sample it lands at, as a decimal, and its name (live_engine_host.rs take_render_of).
  const body = take.takeRenderBody({path: '/sets/a.als', track: 2, rate: 48000, effects: [], landed: '900123', name: 'Take 2'}, new Float32Array([0.5]))
  const length = new DataView(body.buffer).getUint32(0, true)
  assert.deepEqual(JSON.parse(new TextDecoder().decode(body.slice(4, 4 + length))),
    {schema: take.TAKE_RENDER_SCHEMA, path: '/sets/a.als', track: 2, rate: 48000, effects: [], landed: '900123', name: 'Take 2'})
  const plainBody = take.takeRenderBody({path: '/sets/a.als', track: 2, rate: 48000, effects: []}, new Float32Array(0))
  assert.equal('landed' in JSON.parse(new TextDecoder().decode(plainBody.slice(4))), false, 'Export Audio\'s body names no landing')
  const wired = source('live/liveTake.ts')
  assert.match(wired, /freeze: take => invoke\('live_engine_freeze', takeRenderBody\(\{path: address\.path, track: address\.track, rate: take\.rate, effects: take\.effects,\n\s+landed: String\(take\.landed\), name: take\.name\}, take\.pcm\)\)/)
  assert.match(wired, /unfreeze: \(\) => invoke\('live_engine_unfreeze', \{track: address\.track\}\)/)
})

test('the take\'s file is 32-bit float WAV at the owner\'s rate, at the level it played at with each move of the level at its beat', async () => {
  const torus = take.torusKept(torusState({level: 0.5, effects: {chain: ['filter'], filter: {cutoff: 1000}}}))
  const louder = take.torusKept(torusState({level: 1, effects: {chain: ['filter'], filter: {cutoff: 1000}}}))
  const keeps = {schema: 'oi.live-take/v1', torus, moves: [{beat: 0.0625, torus: louder}], bpm: 120, course: {...COURSE, frames: 2000, acts: []}}
  const clip = {...REAL, name: 'Take 1', loop: false, start: 0, end: 4, take: {id: 7, keeps}}
  const saved = []
  const answer = await take.exportTake(clip, {stage: renderOwner().stage, save: (name, bytes) => { saved.push([name, bytes]); return Promise.resolve() }})
  assert.equal(answer.ok, true, answer.error)
  assert.match(answer.note, /^Exported Take 1 as “Take 1\.wav”: 0\.04 s of the Torus at 48000 Hz, as the take played it\./)
  assert.match(answer.note, /The frame's effects \(filter\) are not in the file/)
  const [[name, wav]] = saved
  assert.equal(name, 'Take 1.wav')
  const text = (at, n) => String.fromCharCode(...wav.slice(at, at + n))
  const view = new DataView(wav.buffer, wav.byteOffset, wav.byteLength)
  assert.deepEqual([text(0, 4), view.getUint32(4, true), text(8, 4), text(12, 4), view.getUint32(16, true)], ['RIFF', 36 + 8000, 'WAVE', 'fmt ', 16])
  assert.deepEqual([view.getUint16(20, true), view.getUint16(22, true), view.getUint32(24, true), view.getUint32(28, true), view.getUint16(32, true),
    view.getUint16(34, true)], [3, 1, 48000, 192000, 4, 32], 'IEEE float, mono, the owner\'s rate')
  assert.deepEqual([text(36, 4), view.getUint32(40, true), wav.length], ['data', 8000, 44 + 8000])
  // The render is 0.125 throughout; the level is 0.5 until beat 1/16 (sample 1500 at 120 BPM), then 1.
  assert.deepEqual([view.getFloat32(44, true), view.getFloat32(44 + 4 * 1499, true), view.getFloat32(44 + 4 * 1500, true)], [0.0625, 0.0625, 0.125])
  assert.match((await take.exportTake({...clip, take: {id: 7, keeps: {...keeps, course: null, course_refused: 'replace-event moved the scene at sample 505000'}}},
    {stage: renderOwner().stage, save: async () => {}})).error, /keeps no course of the Torus, so Export Audio cannot render it: replace-event moved the scene/)
  assert.match((await take.exportTake({...clip, take: null}, {stage: renderOwner().stage, save: async () => {}})).error, /not a take/)
})

// PORT (BA round 868, C27): "exportTake should call layTorusTake after renderTake, so an exported take carries its seal."
test('Export Audio lays the take under the scene once its course rendered, by the name it began under or else its checkpoint; refused, it is saved and says why', async () => {
  const keeps = {schema: 'oi.live-take/v1', torus: null, bpm: 120, course: {...COURSE, frames: 2000, acts: [], checkpoint_sha256: NAMED}}
  const clip = {...REAL, name: 'Take 1', loop: false, start: 0, end: 4, take: {id: 7, keeps}}
  const run = async (over = {}) => {
    const order = [], r = renderOwner(over.refuse ? {refuse: over.refuse} : {})
    const owners = {stage: command => { order.push(command.command); return r.stage(command) },
      save: over.save ?? (async name => { order.push(['save', name]) }),
      lay: over.lay ?? (async t => { order.push(['lay', t]); return {ok: true, words: 'Take 1 lies under the scene on its take lane, from sample 192000.'} })}
    return {order, answer: await take.exportTake(over.clip ?? clip, owners)}
  }
  const {order, answer} = await run()
  assert.equal(answer.ok, true, answer.error)
  assert.deepEqual(order, ['render-take', ['lay', {checkpoint_sha256: NAMED, checkpoint: CHECKPOINT, id: 7, name: 'Take 1', bpm: 120}], ['save', 'Take 1.wav']],
    'laid once its course rendered through the relay, by the name of the checkpoint it began at and the checkpoint itself (BB round 20), at its tempo; then saved')
  assert.match(answer.note, /as the take played it\. The Torus was not kept with this take, so the file is at the owner's own level\. Take 1 lies under the scene on its take lane, from sample 192000\.$/)
  const refused = await run({lay: async () => ({ok: false, error: 'This take is already kept in the performance'})})
  assert.match(refused.answer.note, /own level\. It was not laid under the scene: This take is already kept in the performance\.$/, 'the owner\'s refusal, in its words')
  assert.deepEqual(refused.order.at(-1), ['save', 'Take 1.wav'], 'a take not laid is saved still')
  const thrown = await run({lay: async () => { throw new Error('No Scene is presented') }})
  assert.match(thrown.answer.note, /It was not laid under the scene: No Scene is presented\.$/)
  // BB round 21: a course the kernel relayed under no name is laid by the checkpoint it keeps, not noted
  const nameless = await run({clip: {...clip, take: {id: 7, keeps: JSON.parse(JSON.stringify({...keeps, course: {...keeps.course, checkpoint_sha256: undefined}}))}}})
  assert.equal(nameless.answer.ok, true, nameless.answer.error)
  assert.deepEqual(nameless.order, ['render-take', ['lay', {checkpoint: CHECKPOINT, id: 7, name: 'Take 1', bpm: 120}], ['save', 'Take 1.wav']],
    'laid by the checkpoint its course began at, under no name')
  assert.match(nameless.answer.note, /Take 1 lies under the scene on its take lane, from sample 192000\.$/)
  for (const [over, why] of [
    [{...keeps, bpm: undefined}, /It was not laid under the scene: it keeps no tempo to lie on\.$/],
  ]) {
    const {order: o, answer: a} = await run({clip: {...clip, take: {id: 7, keeps: JSON.parse(JSON.stringify(over))}}})
    assert.equal(a.ok, true, a.error)
    assert.match(a.note, why)
    assert.deepEqual(o, ['render-take', ['save', 'Take 1.wav']], 'nothing is laid, and the file is saved')
  }
  const unrendered = await run({refuse: 'The scene holds no Torus'})
  assert.match(unrendered.answer.error, /The scene holds no Torus/)
  assert.deepEqual(unrendered.order, ['render-take'], 'a take not rendered through the relay is not laid: the kernel holds nothing to seal')
  const unsaved = await run({save: async () => { throw new Error('the disk is full') }})
  assert.equal(unsaved.answer.error, 'Take 1.wav was not saved: the disk is full. Take 1 lies under the scene on its take lane, from sample 192000.', 'what was laid is said when the file is not')
  // through LivePresets layTorusTake (BA's, C27): the seal by the course's name, then the Scene's record-take
  const presets = await import('../src/live/LivePresets.tsx')
  const SEALED = {schema: 'oi.torus-take/v1', take_ref: 'sha256:' + 'c'.repeat(64), sample_rate: 48000, seal: 'hmac-sha256:seal'}
  const asked = []
  const sound = {stage: async command => { asked.push(command); return {ok: true, take: SEALED} },
    perform: async action => { asked.push(action); return {state: 'take-recorded', take_ref: SEALED.take_ref, lane_ref: 'take-lane:torus/7', at_sample: '384000', unsaved: false} }}
  const composed = await take.exportTake(clip, {stage: renderOwner().stage, save: async () => {},
    lay: ({checkpoint_sha256, checkpoint, ...t}) => presets.layTorusTake({checkpoint_sha256, checkpoint, take: {...t, beat: 16}}, sound)})
  assert.deepEqual(asked, [{command: 'torus-take', action: 'seal', checkpoint_sha256: NAMED},
    {action: 'record-take', record: take.torusTakeRecord(SEALED, {id: 7, name: 'Take 1', beat: 16, bpm: 120})}])
  assert.match(composed.note, /Take 1 lies under the scene on its take lane, from sample 384000\.$/)
  // BB round 20: a kernel that no longer knows the name (after a restart) refuses the seal in its words; the course's checkpoint is sent once more
  asked.length = 0
  const forgot = {...sound, stage: async command => command.checkpoint ? sound.stage(command)
    : (asked.push(command), {ok: false, error: `No Torus checkpoint ${command.checkpoint_sha256} was given under this lease`})}
  const again = await take.exportTake(clip, {stage: renderOwner().stage, save: async () => {},
    lay: ({checkpoint_sha256, checkpoint, ...t}) => presets.layTorusTake({checkpoint_sha256, checkpoint, take: {...t, beat: 16}}, forgot)})
  assert.deepEqual(asked.slice(0, 2), [{command: 'torus-take', action: 'seal', checkpoint_sha256: NAMED}, {command: 'torus-take', action: 'seal', checkpoint: CHECKPOINT}])
  assert.match(again.note, /Take 1 lies under the scene on its take lane, from sample 384000\.$/, 'sealed from the checkpoint its course keeps, and laid')
  // BB round 21: a course under no name is sealed from its checkpoint at once, nothing asked by a name it never had
  asked.length = 0
  const unnamed = {...clip, take: {id: 7, keeps: JSON.parse(JSON.stringify({...keeps, course: {...keeps.course, checkpoint_sha256: undefined}}))}}
  const sealedBare = await take.exportTake(unnamed, {stage: renderOwner().stage, save: async () => {},
    lay: ({checkpoint_sha256, checkpoint, ...t}) => presets.layTorusTake({checkpoint_sha256, checkpoint, take: {...t, beat: 16}}, sound)})
  assert.deepEqual(asked, [{command: 'torus-take', action: 'seal', checkpoint: CHECKPOINT},
    {action: 'record-take', record: take.torusTakeRecord(SEALED, {id: 7, name: 'Take 1', beat: 16, bpm: 120})}])
  assert.match(sealedBare.note, /Take 1 lies under the scene on its take lane, from sample 384000\.$/)
  assert.deepEqual(await presets.layTorusTake({take: {id: 7, name: 'Take 1', beat: 0, bpm: 120}}, sound),
    {ok: false, error: 'The take keeps no checkpoint it began at, under a name or itself, so nothing seals it'}, 'with neither, nothing is asked')
  // the candidate lays it from its arrangement clip's start, or from its own beat 0 in a slot
  const live = source('live/liveTake.ts').slice(source('live/liveTake.ts').indexOf('export async function exportLiveTake('), source('live/liveTake.ts').indexOf('/** A file saved as the page\'s download'))
  assert.match(live, /const beat = 'arrangement' in address\.at \? await arrangementStart\(address\.path, address\.track, address\.at\.arrangement\) : 0/)
  assert.match(live, /async \(\{checkpoint_sha256, checkpoint, \.\.\.take\}\) => \{/)
  assert.match(live, /return presets\.layTorusTake\(\{checkpoint_sha256, checkpoint, take: \{\.\.\.take, beat\}\}\)/)
  assert.match(live, /exportTake\(answer\.outcome\.reading\.clip, \{stage: torus\.commitLiveStage, save: download, lay,/)
  assert.match(live, /\.arrangement_clips[\s\S]*typeof clip\.start === 'number'/)
})

test('the Torus\'s effects as the take played through them: as they stood when it began, then each move of them at the frame its beat lands at', () => {
  const at = (cutoff, chain = ['filter']) => take.torusKept(torusState({level: 0.5, effects: {chain, filter: {on: true, cutoff}, delay: {on: false, mix: 20}}}))
  const louder = take.torusKept(torusState({level: 1, effects: {chain: ['filter'], filter: {on: true, cutoff: 1000}, delay: {on: false, mix: 20}}}))
  const keeps = {schema: 'oi.live-take/v1', torus: at(1000), bpm: 120, moves: [
    {beat: 0.0625, torus: louder}, // the level alone moved: no move of the effects
    {beat: 0.125, torus: at(2000)}, {beat: 0.125, torus: at(2000, ['delay', 'filter'])}, // two at one frame: the last stands there
    {beat: 0.5, torus: at(500)}, // past the take's end
  ]}
  const course = {...COURSE, frames: 6000, acts: []}
  assert.deepEqual(take.takeEffects(keeps, course), [
    {frame: 0, effects: {chain: ['filter'], filter: {on: true, cutoff: 1000}, delay: {on: false, mix: 20}}},
    {frame: 3000, effects: {chain: ['delay', 'filter'], filter: {on: true, cutoff: 2000}, delay: {on: false, mix: 20}}},
  ], 'at 120 BPM and 48 kHz a 1/8 beat is frame 3000; a level move is no move of the effects; a move past the end is not in it')
  assert.deepEqual(take.takeEffects({...keeps, torus: null}, course), [], 'a take that kept no Torus kept no effects of it')
  assert.deepEqual(take.takeEffects({...keeps, torus: take.torusKept(torusState({}))}, course), [], 'a Torus kept with no effects')
})

test('a take\'s sound goes to its part in the engine as the host reads it: a head naming its set, track, rate and effects, then its samples', () => {
  const pcm = new Float32Array([0.25, -0.5, 1])
  const effects = [{frame: 0, effects: {chain: ['filter'], filter: {on: true}}}]
  const body = take.takeRenderBody({path: '/sets/Song.als', track: 2, rate: 48000, effects}, pcm)
  const view = new DataView(body.buffer)
  const n = view.getUint32(0, true)
  assert.deepEqual(JSON.parse(new TextDecoder().decode(body.slice(4, 4 + n))), {schema: 'oi.take-render/v1', path: '/sets/Song.als', track: 2, rate: 48000, effects})
  assert.deepEqual([body.length, view.getFloat32(4 + n, true), view.getFloat32(4 + n + 4, true), view.getFloat32(4 + n + 8, true)], [4 + n + 12, 0.25, -0.5, 1])
  // the host reads this very head (live_engine_host.rs take_render_of)
  const host = readFileSync(new URL('../../../../desktop/cradle/src-tauri/src/live_engine_host.rs', import.meta.url), 'utf8')
  assert.match(host, /pub const TAKE_RENDER_SCHEMA: &str = "oi\.take-render\/v1";/)
  const reader = host.slice(host.indexOf('pub fn take_render_of('), host.indexOf('impl Opened {', host.indexOf('pub fn take_render_of(')))
  for (const key of ['schema', 'path', 'track', 'rate', 'effects']) assert.match(reader, new RegExp(`head\\["${key}"\\]`), `the host reads the head's ${key}`)
  assert.match(reader, /u32::from_le_bytes/)
  assert.match(reader, /f32::from_le_bytes/)
})

test('a Live take lies under an Expression\'s scene as the kernel sealed it: on its take lane, from the sample its beat lands at, at the set\'s tempo', () => {
  const sealed = {schema: 'oi.torus-take/v1', take_ref: 'sha256:x', sample_rate: 48000, seal: 'hmac-sha256:y'}
  const op = take.torusTakeRecord(sealed, {id: 3, name: 'Take 3', beat: 8, bpm: 120})
  assert.deepEqual(op, {operation: 'record_torus_take', take: sealed, lane: {layer_ref: 'take-lane:torus/3', title: 'Take 3', enabled: true, solo: false},
    at_sample: '192000', micros_per_quarter: 500000}, 'beat 8 at 120 BPM is 4 s: sample 192000 at 48 kHz')
  assert.match(take.torusTakeRecord({...sealed, seal: undefined}, {id: 3, name: 'Take 3', beat: 8, bpm: 120}).refused, /only as the kernel sealed it/)
  assert.match(take.torusTakeRecord(sealed, {id: 3, name: '', beat: 8, bpm: 0}).refused, /^Take 3 lies at no beat of a tempo/)
  // the kernel's own operation (expression_performance.rs RecordTorusTake), field by field
  const kernel = readFileSync(new URL('../../../../desktop/cradle/kernel/src/expression_performance.rs', import.meta.url), 'utf8')
  const variant = kernel.slice(kernel.indexOf('    RecordTorusTake {'), kernel.indexOf('},', kernel.indexOf('    RecordTorusTake {')))
  for (const field of ['take: Box<torus::TorusTake>', 'lane: Layer', 'at_sample: Counter', 'micros_per_quarter: u32']) assert.ok(variant.includes(field), field)
  assert.match(kernel, /pub struct Layer \{\n\s+pub layer_ref: String,\n\s+pub title: String,\n\s+pub enabled: bool,\n\s+pub solo: bool,\n\}/)
})

test('Export Audio of a take renders it through its part where the engine reaches it, and says why it is the Torus alone where not (O-I #855)', async () => {
  const torus = take.torusKept(torusState({level: 0.5, effects: {chain: ['filter'], filter: {on: true, cutoff: 1000}}}))
  const moved = take.torusKept(torusState({level: 0.5, effects: {chain: ['filter'], filter: {on: true, cutoff: 3000}}}))
  const keeps = {schema: 'oi.live-take/v1', torus, moves: [{beat: 0.0625, torus: moved}], bpm: 120, course: {...COURSE, frames: 2000, acts: []}}
  const clip = {...REAL, name: 'Take 1', loop: false, start: 0, end: 4, take: {id: 7, keeps}}
  const sent = [], saved = []
  const engineWav = new Uint8Array(new ArrayBuffer(8)).fill(9)
  const answer = await take.exportTake(clip, {stage: renderOwner().stage, save: (name, bytes) => { saved.push([name, bytes]); return Promise.resolve() },
    through: async t => { sent.push(t); return engineWav }})
  assert.equal(answer.ok, true, answer.error)
  assert.equal(sent.length, 1)
  assert.equal(sent[0].rate, 48000)
  assert.deepEqual([sent[0].pcm.length, sent[0].pcm[0], sent[0].pcm[1999]], [2000, 0.0625, 0.0625], 'the owner\'s render at the level it played at, before the effects')
  assert.deepEqual(sent[0].effects.map(e => [e.frame, e.effects.filter.cutoff]), [[0, 1000], [1500, 3000]], 'the Torus\'s effects as they moved, at their frames')
  assert.equal(saved[0][1], engineWav, 'the file is the engine\'s render of the part')
  assert.match(answer.note, /^Exported Take 1 as “Take 1\.wav”: 0\.04 s of the Torus through its part, as the engine plays it: the Torus's effects \(filter\) as they moved, the part's own chain, its volume and pan\.$/)
  // the engine does not reach it: the Torus alone, and why
  saved.length = 0
  const alone = await take.exportTake(clip, {stage: renderOwner().stage, save: (name, bytes) => { saved.push([name, bytes]); return Promise.resolve() },
    through: async () => { throw 'The engine has another set open (/sets/Other.als): a take renders through its part in the set it is a take of' }})
  assert.equal(alone.ok, true, alone.error)
  assert.match(alone.note, /0\.04 s of the Torus at 48000 Hz, as the take played it\. It did not render through its part: The engine has another set open \(\/sets\/Other\.als\)/)
  assert.match(alone.note, /The frame's effects \(filter\) are not in the file/)
  assert.equal(saved[0][1].length, 44 + 8000, 'the Torus alone, as the owner rendered it')
  // the candidate reaches the part through the native host only
  const record = source('live/liveTake.ts')
  const live = record.slice(record.indexOf('export async function exportLiveTake('), record.indexOf('/** A file saved as the page\'s download'))
  assert.match(live, /\.\.\.\(transport\.kind === 'tauri' \? \{through: take => renderThroughPart\(address, take\)\} : \{\}\)/)
  assert.match(live, /if \(!holds\) await invoke\('live_engine_open', \{path: address\.path\}\)/, 'a set the engine does not hold is bridged in, with no sound')
  assert.match(live, /invoke<ArrayBuffer>\('live_engine_render_take', takeRenderBody\(\{path: address\.path, track: address\.track, rate: take\.rate, effects: take\.effects\}, take\.pcm\)\)/)
  const host = readFileSync(new URL('../../../../desktop/cradle/src-tauri/src/live_engine_host.rs', import.meta.url), 'utf8')
  assert.match(host, /pub fn live_engine_render_take\(/, 'the host serves it')
})

// ── Record into a slot (O-I #743) ──────────────────────────────────────────────────────────────────────────────────────────────────

test('Record into a slot begins a take on the armed part, and pressed again there lays it in that row\'s empty slot (O-I #743)', async () => {
  const recorder = take.createTakeRecorder()
  const f = recordOwners({document: SET})
  const record = take.createLiveRecord(recorder, f.owners)
  const keys = {track: 1, name: 'Keys', kind: 'midi'}
  const at = {path: '/sets/a.als', track: 1, scene: 2, bpm: 120, part: keys}
  const begun = await take.slotRecordPress(record, at, torusState(), {root: 2, scale: null})
  assert.deepEqual(begun, {ok: true, note: 'Recording what you play on Keys into the slot in row 3: press its button again to lay the take.'})
  assert.equal(record.state().recording.scene, 2)
  assert.equal(record.state().recording.start, 0, 'a slot\'s take begins at its clip\'s own beat 0, not after the Arrangement')
  const other = await take.slotRecordPress(record, {...at, scene: 0}, torusState(), null)
  assert.deepEqual(other, {ok: false, error: 'A take records on Keys into the slot in row 3: lay it first, with the button it records from.'})
  f.at(500)
  recorder.played({kind: 'on', id: 'p', note: 60, key: C4, touch: 0, amplitude: 1, source: 'pointer', at: 500})
  f.at(1000)
  const laid = await take.slotRecordPress(record, at, torusState(), null)
  assert.equal(laid.ok, true, JSON.stringify(laid))
  assert.match(laid.note, /^Recorded Take 1 on Keys/, 'the owner\'s words')
  assert.equal(f.acts.length, 1)
  const act = f.acts[0].act
  assert.deepEqual([act.kind, act.track, act.scene, act.start, act.length, act.notes], ['take_record', 1, 2, 0, 4, [{p: 60, at: 1, len: 1, vel: 127}]],
    'the take_record act carries the row: the owner lays it in the slot (acts.rs TakeRecord `scene`)')
  assert.deepEqual(act.keeps.mode, {root: 2, scale: null}, 'in the mode held when it began')
  assert.equal(record.state().recording, null)
  // Nothing played: no take is laid, and that is said, as Record says it.
  await take.slotRecordPress(record, at, torusState(), null)
  const none = await take.slotRecordPress(record, at, torusState(), null)
  assert.deepEqual(none, {ok: false, error: take.NOTHING_PLAYED})
})

test('Record into a slot is refused in Record\'s own words while a take cannot begin', async () => {
  const record = take.createLiveRecord(take.createTakeRecorder(), recordOwners({document: SET}).owners)
  const at = {path: '/sets/a.als', track: 1, scene: 0, bpm: 120, part: {track: 1, name: 'Keys', kind: 'midi'}}
  assert.deepEqual(await take.slotRecordPress(record, at, torusState({standing: 'stale'}), null),
    {ok: false, error: 'The torus is stale: resume it, then record.'})
  assert.deepEqual(await take.slotRecordPress(record, at, null, null), {ok: false, error: 'The torus is not open, so there is nothing to record. Open it in Live.'})
  assert.deepEqual(await take.slotRecordPress(record, {...at, bpm: null}, torusState(), null), {ok: false, error: 'The set discloses no tempo, so a take has no beats to lie on.'})
  assert.equal(record.state().recording, null)
  assert.equal(take.recordRefusal({setPath: '/sets/a.als', part: at.part, bpm: 120, torus: torusState()}), null)
})

test('the Live set hands its armed MIDI parts\' empty slots Record into a slot, and modeTracks hands it the candidate\'s (O-I #743)', async () => {
  const {liveSetTrackAdapter, LIVE_RECORD_SLOT_OP} = await import('../src/timeline/liveSetTrackAdapter.ts')
  const summary = {path: '/sets/a.als', scene_count: 3, tempo_bpm: 120, tracks: [{kind: 'audio', name: 'Drums', devices: []}, {kind: 'midi', name: 'Keys', devices: []}, {kind: 'master', name: 'Main', devices: []}]}
  const calls = []
  const set = liveSetTrackAdapter.project({set: summary, document: null, record: async (track, scene) => { calls.push([track, scene]); return {ok: true, note: 'Recording'} }})
  const slot = set.actions.recordSlot
  assert.ok(slot, 'carried where the set hands in its Record')
  assert.equal(slot.op, LIVE_RECORD_SLOT_OP)
  assert.match(slot.op, /take_record/)
  const ref = index => `als:/sets/a.als#track/${index}`
  assert.deepEqual(await slot.run(ref(1), 'scene:2'), {ok: true, note: 'Recording'})
  assert.deepEqual(calls, [[1, 2]])
  assert.deepEqual(await slot.run(ref(0), 'scene:0'), {ok: false, error: 'Drums is not a MIDI part: Live records notes into a MIDI part\'s slot.'})
  assert.deepEqual(await slot.run(ref(1), 'scene:9'), {ok: false, error: '"scene:9" is not a row of this set.'})
  assert.deepEqual(await slot.run(ref(2), 'scene:0'), {ok: false, error: 'The Main track records into no slot.'})
  assert.equal(calls.length, 1, 'nothing refused reaches Record')
  assert.equal(liveSetTrackAdapter.project({set: summary, document: null}).actions?.recordSlot, undefined, 'no Record handed in: it waits')
  const tracks = source('frame/tracks/modeTracks.ts')
  assert.match(tracks, /module\.recordIntoSlot\(\{path: set\.path, track, scene,\s+bpm: set\.tempo_bpm, part:/, 'the candidate\'s Record, loaded when pressed')
  assert.match(tracks, /liveSetTrackAdapter\.project\(\{[^}]*\brecord, lanes\}\)/)
  const live = source('live/liveTake.ts')
  assert.match(live, /useEffect\(\(\) => \{ transportMode = mode \}\)/, 'it records in the mode the transport holds')
})

// ── a take's lanes: Automated, Overridden, Re-enable (O-I #853) ────────────────────────────────────────────────────────────────────

test('a take\'s lanes stand Automated while it plays; a hand move overrides one, which the take writes no more until Re-enable gives it back', async () => {
  const clock = controlledClock()
  const edits = [], sets = []
  let hand = null
  const clip = {...REAL, name: 'Take 3', loop: false, start: 0, end: 8, take: {id: 3, keeps: {}}, notes: [{id: 1, p: 60, at: 0, len: 1, vel: 100, chance: 1, on: true}]}
  const p = player.createClipPlayer({
    read: async () => clip,
    prepare: async () => ({resumes: 'Resumes.', moves: [
      {beat: 1, edits: [{kind: 'torus', edit: {carrier: 0.2, rate: {mode: 'free', steps_per_second: 3}}}]},
      {beat: 1, edits: [], sets: [{parameter: 'lens', value: 4}]},
      {beat: 3, edits: [{kind: 'torus', edit: {carrier: 0.6, rate: {mode: 'free', steps_per_second: 5}}}]},
      {beat: 3, edits: [], sets: [{parameter: 'lens', value: 6}]},
      {beat: 5, edits: [], sets: [{parameter: 'lens', value: 8}]}]}),
    clock: async () => ({samples_elapsed: '480000', sample_rate: 48000, lookahead_seconds: 0.5, block_frames: 8192}),
    edit: async edit => { edits.push(edit); return {ok: true} },
    set: async (parameter, value) => { sets.push([parameter, value]); return {ok: true} },
    hand: moved => { hand = moved; return () => { hand = null } },
    strike: async () => ({ok: true}), release: () => {}, watch: () => () => {}, now: clock.now, later: clock.later, cancel: clock.cancel, random: () => 0,
  })
  assert.deepEqual(p.state().lanes, {automated: [], overridden: []}, 'nothing plays: nothing is automated')
  p.play({path: '/s.als', track: 1, at: {arrangement: 0}}, 60)
  await tick(); await tick(); await tick()
  const origin = clock.now()
  assert.deepEqual([...p.state().lanes.automated].sort(), ['carrier', 'lens', 'rate'], 'what the take\'s moves and lanes write stands Automated')
  await clock.run(origin + 2)
  assert.deepEqual(sets, [['lens', 4]])
  hand(['carrier', 'level'])
  assert.deepEqual(p.state().lanes.overridden, ['carrier'], 'the hand moved the Carrier off its lane; Level is no lane of the take')
  hand(['lens'])
  assert.deepEqual(p.state().lanes.overridden, ['carrier', 'lens'])
  await clock.run(origin + 4)
  assert.deepEqual(edits.at(-1), {kind: 'torus', edit: {rate: {mode: 'free', steps_per_second: 5}}}, 'the take writes the Rate still, the Carrier no more')
  assert.deepEqual(sets, [['lens', 4]], 'an overridden lane is written no more')
  const back = await p.reenable('lens')
  assert.deepEqual(back, {ok: true, note: 'lens plays from the take\'s lanes again.'})
  assert.deepEqual(sets.at(-1), ['lens', 6], 'Re-enable while it plays: the value its lane reached, sent by no hand')
  assert.deepEqual(p.state().lanes.overridden, ['carrier'])
  await clock.run(origin + 6)
  assert.deepEqual(sets.at(-1), ['lens', 8], 'and it plays its lane from the next point')
  assert.deepEqual(await p.reenable('lens'), {ok: false, error: 'lens is not held off a take\'s lane.'})
  await clock.run(origin + 10)
  assert.equal(p.state().playing, null)
  assert.deepEqual(p.state().lanes, {automated: [], overridden: ['carrier']}, 'the take has ended: nothing is Automated, the Carrier stays Overridden')
  assert.equal(hand, null, 'no hand is heard while no take plays')
  const written = edits.length
  assert.deepEqual(await p.reenable(), {ok: true, note: 'carrier plays from the take\'s lanes again when the take plays.'})
  assert.equal(edits.length, written, 'no take plays: nothing is written')
  assert.deepEqual(await p.reenable(), {ok: true, note: 'Nothing is held off a take\'s lane.'})
  assert.deepEqual(player.unheldEdit({kind: 'lens', lens12: 2}, new Set(['lens'])), null)
  assert.deepEqual(player.unheldEdit({kind: 'effect', effect: 'filter', key: 'cutoff_hz', value: 900}, new Set(['lens'])), {kind: 'effect', effect: 'filter', key: 'cutoff_hz', value: 900})
})

test('Live\'s set counts what the hand holds off a take\'s lanes and gives it back through Re-enable; the pane redraws as the lanes stand (O-I #853)', async () => {
  const {liveSetTrackAdapter, LIVE_REENABLE_OP} = await import('../src/timeline/liveSetTrackAdapter.ts')
  const summary = {path: '/sets/a.als', scene_count: 1, tempo_bpm: 120, tracks: [{kind: 'midi', name: 'Keys', devices: []}, {kind: 'master', name: 'Main', devices: []}]}
  const asked = []
  const play = {launch: async () => ({ok: true, note: ''}), stop: () => ({ok: true, note: ''}), stopAll: () => ({ok: true, note: ''}),
    reenable: async parameter => { asked.push(parameter); return {ok: true, note: 'carrier plays from the take\'s lanes again.'} }}
  const set = liveSetTrackAdapter.project({set: summary, document: null, play, lanes: {automated: ['carrier'], overridden: ['carrier']}})
  assert.equal(set.lanes.held, 1, 'Re-enable lights while the hand holds one')
  assert.equal(set.actions.reenable.op, LIVE_REENABLE_OP)
  assert.deepEqual(await set.actions.reenable.run(), {ok: true, note: 'carrier plays from the take\'s lanes again.'})
  assert.deepEqual(asked, [undefined])
  assert.equal((await set.actions.reenable.run('als:/sets/a.als#track/0#automation/0')).ok, false, 'a lane of the set\'s own automation is not a take\'s')
  assert.equal(liveSetTrackAdapter.project({set: summary, document: null, play}).lanes.held, undefined, 'no standing read: no count')
  const tracks = source('frame/tracks/modeTracks.ts')
  assert.match(tracks, /live: \{subscribe: listener => \{ const engine = subscribeLiveEngine\(listener\), lanes = subscribeLaneStanding\(listener\);/)
  // REPLACES (O-I #849 round 21): the pane followed the set's one player (liveClipPlayer); it follows every player now, a row's among them
  assert.match(tracks, /void import\('\.\.\/\.\.\/live\/clipPlayer'\)\.then\(\(\{liveClipActs\}\) => \{/, 'the players are followed from the pane, never at first load')
  assert.match(tracks, /liveTracks\(reading\.set, reading\.document, reading\.colors, undefined, liveEngineState\(\)\.reading, laneStanding\)/)
  assert.match(tracks, /reenable: \(parameter\?: string\) => player\(\)\.then\(acts => acts\.reenable\(parameter\)\)/)
  const clipPlayer = source('live/clipPlayer.ts')
  // REPLACES (O-I #743 round 20): the candidate's hand was the accepted instrument edits alone, written inline; it is liveHandMoves now,
  // which hears those and a session-held value the hand moved (DLW build ruling 2026-11-05)
  assert.match(clipPlayer, /const owner = subscribeAcceptedLiveWrites\(\(command, how\) => \{ if \(how\.hand && command\.command === 'instrument'\) moved\(mapTargetIdsOfEdit\(command\.edit\)\) \}\)/,
    'the candidate hears the hand\'s accepted instrument edits')
})

// O-I #743 round 20, item 4: per-lane Overridden marks. A playing take's lanes stand as its own lanes, scoped to its clip.
test('a playing take\'s lanes stand as its own: each parameter it writes, its points at their beats in the clip, under its clip; ended, none', async () => {
  const clock = controlledClock()
  let hand = null
  const clip = {...REAL, name: 'Take 3', loop: false, start: 0, end: 8, take: {id: 3, keeps: {}}, notes: [{id: 1, p: 60, at: 0, len: 1, vel: 100, chance: 1, on: true}]}
  const p = player.createClipPlayer({
    read: async () => clip,
    prepare: async () => ({resumes: 'Resumes.', moves: [
      {beat: 1, edits: [{kind: 'torus', edit: {carrier: 0.2, rate: {mode: 'free', steps_per_second: 3}}}]},
      {beat: 1, edits: [], sets: [{parameter: 'lens', value: 4}]},
      {beat: 3, edits: [{kind: 'torus', edit: {carrier: 0.6, rate: {mode: 'free', steps_per_second: 5}}}]},
      {beat: 3, edits: [], sets: [{parameter: 'lens', value: 6}]},
      {beat: 5, edits: [], sets: [{parameter: 'lens', value: 8}]}]}),
    clock: async () => ({samples_elapsed: '480000', sample_rate: 48000, lookahead_seconds: 0.5, block_frames: 8192}),
    edit: async () => ({ok: true}), set: async () => ({ok: true}),
    hand: moved => { hand = moved; return () => { hand = null } },
    label: parameter => ({carrier: 'Carrier', rate: 'Rate'})[parameter],
    strike: async () => ({ok: true}), release: () => {}, watch: () => () => {}, now: clock.now, later: clock.later, cancel: clock.cancel, random: () => 0,
  })
  const address = {path: '/s.als', track: 1, at: {arrangement: 0}}
  assert.deepEqual(p.state().lanes, {automated: [], overridden: []}, 'nothing plays: no lanes')
  p.play(address, 60)
  await tick(); await tick(); await tick()
  const lanes = p.state().lanes
  assert.deepEqual(lanes.take, {address, name: 'Take 3'}, 'the lanes are its clip\'s')
  assert.deepEqual(lanes.lanes, [
    {parameter: 'rate', label: 'Rate', points: [{beat: 1, value: 0}, {beat: 3, value: 1}]},
    {parameter: 'carrier', label: 'Carrier', points: [{beat: 1, value: 0}, {beat: 3, value: 1}]},
    {parameter: 'lens', label: 'lens', points: [{beat: 1, value: 0}, {beat: 3, value: 0.5}, {beat: 5, value: 1}]},
  ], 'each lane its parameter\'s points at their beats, each value within the lane\'s own span (a parameter named by its id where no label is given)')
  hand(['carrier'])
  assert.deepEqual(p.state().lanes.overridden, ['carrier'])
  assert.equal(p.state().lanes.lanes.length, 3, 'an overridden lane still stands, marked by its own standing')
  await clock.run(clock.now() + 10)
  assert.equal(p.state().playing, null)
  assert.deepEqual(p.state().lanes, {automated: [], overridden: ['carrier']}, 'the take has ended: its lanes are gone, what the hand holds stays')
  assert.deepEqual(player.laneValues([3, 5, 4]), [0, 1, 0.5], 'numbers within their own span')
  assert.deepEqual(player.laneValues([true, false]), [1, 0], 'on and off')
  assert.deepEqual(player.laneValues(['up', 'down', 'up']), [0, 1, 0], 'choices stepped in the order they come')
  assert.deepEqual(player.laneValues([2, 2]), [0, 0], 'a level lane')
})

test('Live\'s set lays a playing take\'s lanes under its clip, each with its own Overridden mark and Re-enable (O-I #743 round 20)', async () => {
  const {liveSetTrackAdapter} = await import('../src/timeline/liveSetTrackAdapter.ts')
  const summary = {path: '/sets/a.als', scene_count: 1, tempo_bpm: 120, tracks: [{kind: 'midi', name: 'Keys', devices: []}, {kind: 'master', name: 'Main', devices: []}]}
  const asked = []
  const play = {launch: async () => ({ok: true, note: ''}), stop: () => ({ok: true, note: ''}), stopAll: () => ({ok: true, note: ''}),
    reenable: async parameter => { asked.push(parameter); return {ok: true, note: `${parameter} plays from the take's lanes again.`} }}
  const lanes = {automated: ['carrier', 'lens'], overridden: ['carrier'], take: {address: {path: '/sets/a.als', track: 0, at: {arrangement: 1}}, name: 'Take 3'},
    lanes: [{parameter: 'carrier', label: 'Carrier', points: [{beat: 1, value: 0}, {beat: 3, value: 1}]}, {parameter: 'lens', label: 'lens', points: [{beat: 2, value: 0.5}]}]}
  const set = liveSetTrackAdapter.project({set: summary, document: null, play, lanes})
  const clipId = 'als:/sets/a.als#track/0/clip/1'
  assert.deepEqual(set.lanes.automation, [
    {id: `${clipId}#lane/carrier`, trackId: 'als:/sets/a.als#track/0', device: 'Take 3', parameter: 'Carrier', clipId, points: [{at: 1, value: 0}, {at: 3, value: 1}], overridden: true},
    {id: `${clipId}#lane/lens`, trackId: 'als:/sets/a.als#track/0', device: 'Take 3', parameter: 'lens', clipId, points: [{at: 2, value: 0.5}], overridden: false},
  ], 'each lane under the take\'s clip, in the clip\'s own time, marked Overridden where the hand holds it')
  assert.deepEqual(await set.actions.reenable.run(`${clipId}#lane/carrier`), {ok: true, note: 'carrier plays from the take\'s lanes again.'})
  assert.deepEqual(asked, ['carrier'], 'a lane\'s own Re-enable gives back its own parameter')
  assert.equal((await set.actions.reenable.run('als:/sets/a.als#track/0#automation/0')).ok, false, 'a lane of the set\'s own automation is still not a take\'s')
  const slot = liveSetTrackAdapter.project({set: summary, document: null, play, lanes: {...lanes, take: {...lanes.take, address: {path: '/sets/a.als', track: 0, at: {slot: 0}}}}})
  assert.equal(slot.lanes.automation[0].clipId, 'als:/sets/a.als#track/0/slot/0', 'a slot take\'s lanes stand under its slot')
  const other = liveSetTrackAdapter.project({set: summary, document: null, play, lanes: {...lanes, take: {...lanes.take, address: {...lanes.take.address, path: '/sets/b.als'}}}})
  assert.equal(other.lanes.automation, undefined, 'a take of another set lays no lanes here')
})

// DLW build ruling 2026-11-05: "Hand moves of session-held values (the Scale tie and the rest) are heard as overrides, like any other."
test('a hand move of a session-held value (the Scale tie) is heard as the hand\'s, as an instrument edit is; a take\'s lane writing it is not', async () => {
  const hold = await import('../src/live/noteDevices/noteDeviceHold.ts')
  const targets = await import('../src/live/midiMap/midiMapTargets.ts')
  hold.resetNoteDeviceChain()
  const scale = hold.addNoteDevice('scale')
  const tie = `note-device:${scale.id}:tie`
  const heard = []
  const off = player.liveHandMoves(ids => heard.push([...ids]))
  try {
    hold.setScaleTie(scale.id, 'down')
    assert.deepEqual(heard, [[tie]], 'the face\'s own move of the tie is the hand\'s')
    const target = targets.mapTargets(null, hold.noteDeviceChain()).find(t => t.id === tie)
    await target.apply('up')
    assert.deepEqual(heard, [[tie], [tie]], 'a mapped control moving it is the hand\'s')
    assert.deepEqual(await targets.writeMapTarget(tie, 'down', targets.mapTargets(null, hold.noteDeviceChain())), {ok: true})
    assert.equal(heard.length, 2, 'a take\'s lane writing it is sent by no hand')
    hold.setScaleTie(scale.id, 'down')
    assert.equal(heard.length, 2, 'a move that changes nothing is no move')
  } finally { off(); hold.resetNoteDeviceChain() }
  hold.addNoteDevice('scale')
  hold.setScaleTie(hold.noteDeviceChain()[0].id, 'down')
  assert.equal(heard.length, 2, 'unsubscribed, nothing is heard')
  hold.resetNoteDeviceChain()
  const clipPlayer = source('live/clipPlayer.ts')
  assert.match(clipPlayer, /hand: liveHandMoves,/, 'the candidate hears both')
})

test('the MPE tab\'s reading: each note\'s pressure and bend as the set keeps them by its NoteId, on the tab\'s own scale (O-I #853)', async () => {
  const writes = await import('../src/live/liveWrites.ts')
  const read = writes.liveClipMpe([
    {id: 1, p: 60, at: 0, len: 1, mpe: {pressure: [[0, 0], [0.5, 0.5], [1, 1.2]], bend: [[0.25, -0.5]]}},
    {id: 2, p: 64, at: 1, len: 1},
    {p: 67, at: 2, len: 1, mpe: {pressure: [[0, 1]]}},
    {id: 4, p: 72, at: 3, len: 1, mpe: {pressure: [[0, Number.NaN]]}},
  ])
  assert.deepEqual(read.mpe, {1: {pressure: [[0, 0], [0.5, 64], [1, 127]], bend: [[0.25, -0.5]]}},
    'pressure 0–1 onto the tab\'s 0–127; bend as its force; a note with no NoteId, or none kept, has none')
  assert.equal(read.absent, null)
  assert.match(writes.liveClipMpe([{id: 1, p: 60, at: 0, len: 1}]).absent, /^No note of this clip carries expression/)
  assert.match(writes.liveClipMpe(undefined).absent, /^No note/)
  assert.match(writes.LIVE_MPE_NO_SLIDE, /not slide/)
  assert.match(writes.LIVE_MPE_BEND_FORCE, /no clean-room source gives it a range in semitones/)
})
