import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {register} from 'node:module'

// O-I #790: Live plays a clip on the part's one playing path (DLW §21.2 "What strikes the Torus": "A note in a clip | Its key's point, as
// the clip plays"; MT1 ruled 1 Nov: a key's point is dynamic, and each note-on strikes at its key's point at that moment). A clip's note
// strikes the key a MIDI note of its number strikes (live/janko/jankoInput.ts keyForNote), on the Torus's M1′ session (`janko` strike →
// torus-play, at the clip's own sample), and is held until its own length ends (`janko` release → torus-release). The clip shares the
// path's count of notes with the keys and MIDI, so a key both hold sounds on until both let go, a note that made way past Polyphony is
// owed no release, and Panic reaches the clip's notes too. Also here: the MIDI output picker after a send the host refused (O-I #853
// OPEN 1). The owner below is live-playing-853.test.mjs's fake of the frame's answer, with QL's own count of notes (m1_prime.rs).
// Loader as live-janko.test.mjs.
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

globalThis.document = {getElementById: () => null, createElement: () => ({}), head: {appendChild: () => {}}}
const janko = await import('../src/live/janko/jankoLayout.ts')
const input = await import('../src/live/janko/jankoInput.ts')
const midi = await import('../src/native/liveMidi.ts')
const fixture = name => JSON.parse(readFileSync(new URL(`fixtures/${name}`, import.meta.url), 'utf8'))
const windowState = janko.readJankoWindow(fixture('janko-window-v1.json'))
const tick = () => new Promise(resolve => setTimeout(resolve, 0))

/** The frame's answer to the Torus's two acts, with QL's count of notes (m1_prime.rs): Polyphony `polyphony`. */
function owner({polyphony = 16, refuse = null} = {}) {
  const sent = [], notes = []
  const id = key => `${key.row}/${key.column}`
  return {
    sent, notes,
    send: async command => {
      sent.push(structuredClone(command))
      if (refuse) return {ok: false, error: refuse}
      if (command.action === 'release') {
        for (const key of command.keys) { const at = notes.findIndex(n => id(n) === id(key)); if (at >= 0) notes.splice(at, 1) }
        return {ok: true}
      }
      const made_way = []
      for (const key of command.keys) {
        const at = notes.findIndex(n => id(n) === id(key))
        if (at >= 0) made_way.push(...notes.splice(at, 1))
        notes.push(key)
        while (notes.length > polyphony) made_way.push(notes.shift())
      }
      return made_way.length ? {ok: true, made_way} : {ok: true}
    },
  }
}
const settingsOf = patch => () => ({...input.KEYBOARD_SETTINGS_DEFAULT, ...patch, inputs: {...input.KEYBOARD_SETTINGS_DEFAULT.inputs, ...patch?.inputs}})
const path = (o, patch = {}, extra = {}) => input.createJankoInput({send: o.send, window: () => windowState, settings: settingsOf(patch), ...extra})
const strikes = sent => sent.filter(c => c.action === 'strike')
const releases = sent => sent.filter(c => c.action === 'release').map(c => c.keys)

// The owner's window (fixture): the octave from middle C stands seven periods on (column + 42); C row 0, E row 0 column 2, G row 1
// column 3; the octave above is one period on (column + 48).
const C4 = {row: 0, column: 42}, E4 = {row: 0, column: 44}, G4 = {row: 1, column: 45}, C5 = {row: 0, column: 48}
const midiNote = (note, on = true) => ({kind: on ? 'down' : 'up', source: 'midi', pitchClass: note % 12, note, velocity: 100 / 127, press: `Keys:0:${note}`, port: 'Keys'})

// ── a clip's note is a note of the part ───────────────────────────────────────────────────────────────────────────────────────────

test('a clip\'s notes strike the keys MIDI notes of their numbers strike: one act, at the clip\'s sample and strength', async () => {
  const o = owner(), p = path(o)
  const answer = await p.clipStrike([{hold: 'a', note: 60}, {hold: 'b', note: 64}, {hold: 'c', note: 72}], 100 / 127, '504000')
  assert.deepEqual(answer, {ok: true})
  assert.deepEqual(o.sent, [{command: 'janko', action: 'strike', keys: [C4, E4, C5], amplitude: 100 / 127, at_samples_elapsed: '504000'}],
    'each note on its own key, an octave a period on; the act lands at the sample the clip names')
  const keyed = owner(), k = path(keyed)
  k.down(midiNote(60)); k.down(midiNote(64)); k.down(midiNote(72))
  await tick()
  assert.deepEqual(strikes(keyed.sent).map(c => c.keys), [[C4, E4, C5]], 'MIDI strikes the same keys for the same notes')
})

test('a clip\'s note is held until the clip lets it go, and its key is then released at the owner', async () => {
  const o = owner(), p = path(o)
  await p.clipStrike([{hold: 'a', note: 60}, {hold: 'b', note: 67}], 1, '1000')
  assert.deepEqual(p.sounding(), [C4, G4])
  p.clipRelease(['a'])
  await tick()
  assert.deepEqual(releases(o.sent), [[C4]])
  assert.deepEqual(p.sounding(), [G4])
  p.clipRelease(['b', 'a', 'nobody'])
  await tick()
  assert.deepEqual(releases(o.sent), [[C4], [G4]], 'a hold let go twice, or never held, owes nothing')
  assert.deepEqual(p.sounding(), [])
})

test('a key a press and the clip both hold is struck by each and sounds on until both let go', async () => {
  const o = owner(), p = path(o)
  await p.clipStrike([{hold: 'a', note: 60}], 1, '1000')
  p.down(midiNote(60))
  await tick()
  assert.deepEqual(strikes(o.sent).map(c => c.keys), [[C4], [C4]], 'the press strikes the key the clip sounds: one note, struck again')
  p.clipRelease(['a'])
  await tick()
  assert.deepEqual(releases(o.sent), [], 'the press still holds it')
  p.up(midiNote(60, false))
  await tick()
  assert.deepEqual(releases(o.sent), [[C4]], 'released once, with the last of them')
  // The other way round: the clip strikes a key a press holds, and the press's lift leaves it to the clip.
  p.down(midiNote(64))
  await p.clipStrike([{hold: 'b', note: 64}], 0.5, '2000')
  assert.deepEqual(strikes(o.sent).at(-1), {command: 'janko', action: 'strike', keys: [E4], amplitude: 0.5, at_samples_elapsed: '2000'})
  p.up(midiNote(64, false))
  await tick()
  assert.deepEqual(releases(o.sent), [[C4]], 'the clip still holds it')
  p.clipRelease(['b'])
  await tick()
  assert.deepEqual(releases(o.sent), [[C4], [E4]])
  assert.deepEqual(o.notes, [], 'the owner counts no note the path does not hold')
})

test('a clip\'s notes are written, not played in: Transpose, Sustain, the inputs and the note devices leave them as they are', async () => {
  const o = owner()
  const p = path(o, {transpose: 7, sustain: true, inputs: {pointer: false, keys: false, midi: false}}, {transform: () => [5]})
  await p.clipStrike([{hold: 'a', note: 60}], 1, '1000')
  assert.deepEqual(strikes(o.sent).map(c => c.keys), [[C4]], 'middle C strikes middle C')
  p.clipRelease(['a'])
  await tick()
  assert.deepEqual(releases(o.sent), [[C4]], 'a note\'s length ends it, Sustain or not')
})

test('past Polyphony a clip\'s oldest note makes way as a key\'s does: the owner names it, the path lets it go, its release is owed no more', async () => {
  const o = owner({polyphony: 2}), p = path(o)
  await p.clipStrike([{hold: 'a', note: 60}], 1, '1000')
  await p.clipStrike([{hold: 'b', note: 64}], 1, '2000')
  const answer = await p.clipStrike([{hold: 'c', note: 67}], 1, '3000')
  assert.deepEqual(answer, {ok: true, made_way: [C4]}, 'the clip hears which of its notes made way')
  assert.deepEqual(p.sounding(), [E4, G4])
  p.clipRelease(['a', 'b', 'c'])
  await tick()
  assert.deepEqual(releases(o.sent), [[E4, G4]], 'the note that made way is not released again')
  assert.deepEqual(o.notes, [])
})

test('Panic releases the clip\'s notes with the keys\', and a hold let go after it owes nothing', async () => {
  const o = owner(), p = path(o)
  await p.clipStrike([{hold: 'a', note: 60}, {hold: 'b', note: 64}], 1, '1000')
  p.down(midiNote(67))
  await tick()
  p.panic()
  await tick()
  assert.deepEqual(releases(o.sent).flat().sort((x, y) => x.column - y.column), [C4, E4, G4])
  assert.deepEqual(p.sounding(), [])
  const before = o.sent.length
  p.clipRelease(['a', 'b'])
  await tick()
  assert.equal(o.sent.length, before)
})

test('a clip\'s act is its own: a press in the same task strikes at the owner\'s cursor, apart from the clip\'s sample', async () => {
  const o = owner(), p = path(o)
  p.down(midiNote(67))
  const struck = p.clipStrike([{hold: 'a', note: 60}], 1, '1000')
  p.down(midiNote(64))
  await struck
  await tick()
  assert.deepEqual(strikes(o.sent), [
    {command: 'janko', action: 'strike', keys: [G4], amplitude: 100 / 127},
    {command: 'janko', action: 'strike', keys: [C4], amplitude: 1, at_samples_elapsed: '1000'},
    {command: 'janko', action: 'strike', keys: [E4], amplitude: 100 / 127},
  ], 'in the order they were played, the clip\'s at its sample and strength')
})

test('more than 32 notes at once are struck as acts of 32 at the one sample; a refusal or no surface answers the clip in words', async () => {
  const o = owner({polyphony: 64}), p = path(o)
  const many = Array.from({length: 40}, (_, i) => ({hold: `h${i}`, note: 24 + i}))
  await p.clipStrike(many, 1, '9000')
  assert.deepEqual(strikes(o.sent).map(c => [c.keys.length, c.at_samples_elapsed]), [[32, '9000'], [8, '9000']])
  const refused = owner({refuse: 'No voice of this sky sounds at E'})
  assert.deepEqual(await path(refused).clipStrike([{hold: 'a', note: 64}], 1, '1000'), {ok: false, error: 'No voice of this sky sounds at E'})
  const bare = owner()
  const none = input.createJankoInput({send: bare.send, window: () => null})
  const answer = await none.clipStrike([{hold: 'a', note: 60}], 1, '1000')
  assert.equal(answer.ok, false)
  assert.match(answer.error, /no surface/)
  assert.deepEqual(bare.sent, [], 'nothing reaches the owner without a key to strike')
})

// ── a clip's notes leave as MIDI when they sound (O-I #853 round 22; DLW build ruling 2026-11-05: "MIDI out for clip notes (#853),
// through the host. Tests use a double and never open a MIDI or audio device") ─────────────────────────────────────────────────────

test('a clip\'s notes leave as MIDI when they sound: each note-on and each end held by the host for the time to its sample', async () => {
  const o = owner(), out = []
  const p = path(o, {transpose: 7}, {midiOut: (messages, after) => out.push([messages, after])})
  await p.clipStrike([{hold: 'a', note: 60}, {hold: 'b', note: 64}], 100 / 127, '504000', 80)
  assert.deepEqual(out, [[[{kind: 'on', channel: 0, note: 60, velocity: 100}, {kind: 'on', channel: 0, note: 64, velocity: 100}], 80]],
    'one act, its notes as written (Transpose leaves a clip\'s notes as they are), held until they sound')
  p.clipRelease(['a'], 120)
  await tick()
  assert.deepEqual(out.at(-1), [[{kind: 'off', channel: 0, note: 60, velocity: 0}], 120], 'its end leaves when it sounds')
  // Stop lets go at once: the host holds the off behind its note-on, so it never leaves ahead of it (midi.rs).
  p.clipRelease(['b'])
  await tick()
  assert.deepEqual(out.at(-1), [[{kind: 'off', channel: 0, note: 64, velocity: 0}], undefined])
  // A key a press holds is struck again by the clip, and leaves again; its end waits for the last that holds it.
  p.down(midiNote(67)); await tick()
  assert.deepEqual(out.at(-1), [[{kind: 'on', channel: 0, note: 74, velocity: 100}], undefined], 'the press plays as it always has: at once')
  await p.clipStrike([{hold: 'c', note: 74}], 0.5, '600000', 40)
  assert.deepEqual(out.at(-1), [[{kind: 'on', channel: 0, note: 74, velocity: 64}], 40])
  p.clipRelease(['c'], 60); await tick()
  assert.equal(out.length, 5, 'the press still holds it: no off')
  // Panic lets every note go at once.
  await p.clipStrike([{hold: 'd', note: 48}], 1, '700000', 30)
  p.panic(); await tick()
  assert.deepEqual(out.at(-1), [[{kind: 'all-off', channel: 0}], undefined])
})

test('what is not a clip\'s note sounding at its sample does not leave as MIDI: a strike that names no time, a bell, a take\'s key with no number', async () => {
  const o = owner(), out = []
  const p = path(o, {}, {midiOut: (messages, after) => out.push([messages, after])})
  await p.clipStrike([{hold: 'a', note: 60}], 1, '1000')
  p.clipRelease(['a']); await tick()
  await p.ring(4, 0.5); await tick()
  await p.clipStrike([{hold: 'b', note: -1, key: G4}], 1, '2000', 50)
  p.clipRelease(['b'], 70); await tick()
  assert.deepEqual(out, [], 'nothing names when it sounds, or what note it is')
  assert.equal(strikes(o.sent).length, 3, 'each still strikes the Torus')
})

// ── MIDI out: the picker never shows an output the host let go (O-I #853 OPEN 1) ─────────────────────────────────────────────────

/** The host's `midi_out` as midi.rs answers it: `held` is the output it holds now; `send` answers a send (a throw is its refusal). */
function host({ports = ['Synth'], send}) {
  const calls = []
  let held = null
  const invoke = async (command, {request}) => {
    assert.equal(command, 'midi_out')
    calls.push(request.kind)
    if (request.kind === 'choose') held = request.port
    if (request.kind === 'send') { const gone = send(); if (gone === 'gone') { held = null; throw 'The MIDI output Synth went away (the device went away), so it is no longer connected' } if (gone) throw gone }
    return {ports, port: held}
  }
  return {invoke, calls}
}
const ON = [{kind: 'on', channel: 0, note: 60, velocity: 100}]

test('a send the host refuses because its output went away leaves the picker on no output, and no note is sent to it after', async () => {
  const h = host({send: () => 'gone'})
  assert.equal(await midi.chooseLiveMidiOut('Synth', h.invoke), true)
  assert.deepEqual(midi.liveMidiOut(), {kind: 'ports', ports: ['Synth'], port: 'Synth'})
  midi.sendLiveMidiOut(ON, h.invoke)
  for (let i = 0; i < 5; i++) await tick()
  const state = midi.liveMidiOut()
  assert.equal(state.kind, 'refused')
  assert.match(state.reason, /went away/)
  assert.equal(state.port, null, 'the picker shows the output the host holds, which is none')
  assert.match(midi.liveMidiOutLine(state), /went away/, 'the refusal is said')
  const before = h.calls.length
  midi.sendLiveMidiOut(ON, h.invoke)
  await tick()
  assert.equal(h.calls.length, before, 'nothing is sent to an output the host let go')
})

// REPLACES the round-22 form, which named only `after_ms`: a held send also names when the page sent it on the machine's wall clock, so
// the host counts the hold from then (O-I #849 round 23; midi.rs `sent_at_ms`, the host stamping its own receipt beside it).
test('a send held until its notes sound names how long the host holds it and when the page sent it; one at once names neither', async () => {
  const requests = []
  const invoke = async (_command, {request}) => { requests.push(request); return {ports: ['Synth'], port: 'Synth'} }
  await midi.chooseLiveMidiOut('Synth', invoke)
  let wall = 1_700_000_000_000
  const clock = () => wall
  midi.sendLiveMidiOut(ON, invoke, 42.5, clock)
  wall += 7
  midi.sendLiveMidiOut(ON, invoke, 10, clock)
  midi.sendLiveMidiOut(ON, invoke, undefined, clock)
  midi.sendLiveMidiOut(ON, invoke, 0, clock)
  for (let i = 0; i < 5; i++) await tick()
  assert.deepEqual(requests.slice(1), [{kind: 'send', messages: ON, after_ms: 42.5, sent_at_ms: 1_700_000_000_000},
    {kind: 'send', messages: ON, after_ms: 10, sent_at_ms: 1_700_000_000_007}, {kind: 'send', messages: ON}, {kind: 'send', messages: ON}])
  const layout = readFileSync(new URL('../src/live/keyboardLayout.ts', import.meta.url), 'utf8')
  assert.match(layout, /midiOut: \(messages, afterMs\) => sendLiveMidiOut\(messages, undefined, afterMs\)/, 'the part\'s one path sends through the host')
})

test('a batch the host refuses with its output still connected keeps the output chosen, and the next notes still leave', async () => {
  const answers = ['MIDI notes run from 0 to 127, so 200 cannot be sent', null]
  const h = host({send: () => answers.shift()})
  await midi.chooseLiveMidiOut('Synth', h.invoke)
  midi.sendLiveMidiOut(ON, h.invoke)
  for (let i = 0; i < 5; i++) await tick()
  assert.deepEqual(midi.liveMidiOut(), {kind: 'refused', reason: 'MIDI notes run from 0 to 127, so 200 cannot be sent', ports: ['Synth'], port: 'Synth'})
  midi.sendLiveMidiOut(ON, h.invoke)
  for (let i = 0; i < 5; i++) await tick()
  assert.equal(h.calls.filter(kind => kind === 'send').length, 2, 'the output is still there, so the next notes leave for it')
  assert.deepEqual(midi.liveMidiOut(), {kind: 'ports', ports: ['Synth'], port: 'Synth'}, 'and its answer clears the refusal')
})
