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
    {p: 64, at: 1, key: E4, touch: 0, strength: typed, source: 'keyboard'},
    {p: 67, at: 2, key: G4, touch: 0, strength: 0.75, source: 'midi'},
    {p: 62, at: 3, key: D4_TOUCH_1, touch: 1, strength: typed, source: 'pointer'},
  ], 'how each note was played: the key and touch-point it struck on the Jankó surface, its exact strength (a velocity rounds it), its source')
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
  assert.match(record.state().said, /Export Audio renders what the engine played, and the Torus does not sound in it yet/, 'what Export Audio does not yet hold is said')
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

// ── the candidate's wiring ─────────────────────────────────────────────────────────────────────────────────────────────────────────

test('the candidate records on the part\'s one playing path, prepares a take before it plays, and binds Record in Live\'s transport', () => {
  const layoutSource = source('live/keyboardLayout.ts')
  const path = layoutSource.slice(layoutSource.indexOf('export function livePlayingPath'), layoutSource.indexOf('export function setLivePlayingTransform'))
  assert.match(path, /onNote: played => liveTakeRecorder\.played\(played\),/, 'every note the path plays is told to the recorder')
  const clip = source('live/clipPlayer.ts')
  const owners = clip.slice(clip.indexOf('function candidateOwners('), clip.indexOf('export const liveClipPlayer'))
  assert.match(owners, /prepare: clip => prepareTake\(clip, commitLiveInstrumentEdit\),/)
  const transport = source('shell/transports/useLiveTransport.tsx')
  assert.match(transport, /const record = useLiveRecord\(\{setPath, track: setSelectionOf\(selection, setPath \?\? undefined\)\?\.track \?\? null, bpm: tempoBpm, torus,/)
  assert.match(transport, /\.\.\.playStop,\n\s+record,/, 'Record stands in Live\'s place beside Play and Stop')
})
