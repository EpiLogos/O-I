import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {register} from 'node:module'
import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'

// O-I #853: the keyboard and MIDI play the Torus, every touch held and released as it should be (DLW §21.1 The input and Rules; §21.2
// The keyboard). Every way of playing reaches the Torus by one path — keys of the owner's Jankó surface, struck on the M1′ session
// (`janko` strike → QL-MEF torus-play) and let go from it (`janko` release → torus-release) — and each note lives exactly as long as it
// should. The owner below is a fake of the frame's answer that keeps QL's own count of notes (m1_prime.rs strike/release): each key is a
// new note, a key already sounding is struck again as a new note, and past Polyphony the oldest make way and are named.
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
const device = await import('../src/live/janko/JankoDevice.tsx')
const keyboard = await import('../src/live/keyboardLayout.ts')
const torus = await import('../src/live/torusInstrument.ts')
const midi = await import('../src/native/liveMidi.ts')
const partInput = await import('../src/live/KeyboardOnChain.tsx')
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
const keysOf = (sent, action) => sent.filter(c => c.action === action).map(c => c.keys)

// The owner's window (fixture): middle C is row 0, column 0 at touch-point 0; E row 0 column 2; G row 1 column 3; C at touch-point 1 is
// row 2 column 5. The window is one period of six columns, and the octave from middle C stands seven periods on (column + 42).
const C4 = {row: 0, column: 42}, E4 = {row: 0, column: 44}, G4 = {row: 1, column: 45}

// ── 1 — one path: every source strikes the same key ──────────────────────────────────────────────────────────────────────────────

test('pointer, touch, the computer keys and MIDI strike the same key of the surface for the same note, through the Torus\'s own strike', async () => {
  const o = owner()
  const p = path(o)
  p.down({kind: 'down', pitchClass: 0, source: 'pointer', key: {row: 0, column: 0}, press: 'pointer-1'}); await tick()
  p.up({kind: 'up', pitchClass: 0, source: 'pointer', press: 'pointer-1'}); await tick()
  p.down({kind: 'down', pitchClass: 0, source: 'touch', key: {row: 0, column: 0}, press: 'pointer-2'}); await tick()
  p.up({kind: 'up', pitchClass: 0, source: 'touch', press: 'pointer-2'}); await tick()
  p.down({kind: 'down', pitchClass: 0, source: 'keyboard'}); await tick()
  p.up({kind: 'up', pitchClass: 0, source: 'keyboard'}); await tick()
  p.down(midi.midiNoteEvent({port: 'Keys', channel: 0, note: 60, velocity: 127, on: true})); await tick()
  p.up(midi.midiNoteEvent({port: 'Keys', channel: 0, note: 60, velocity: 0, on: false})); await tick()
  assert.deepEqual(keysOf(o.sent, 'strike'), [[C4], [C4], [C4], [C4]], 'one key, whatever plays it')
  assert.deepEqual(keysOf(o.sent, 'release'), [[C4], [C4], [C4], [C4]], 'and each release lets that key go')
  assert.ok(o.sent.every(c => c.command === 'janko'))
  assert.equal(o.sent.filter(c => 'pitch_classes' in c).length, 0, 'no pitch-class act: the keyboard strikes keys')
  assert.deepEqual(o.notes, [], 'nothing is left sounding in the owner\'s count')
})

// ── 1b — every source, every rule (O-I #853 round 23) ─────────────────────────────────────────────────────────────────────────────
// DLW build ruling 2026-11-05 (#853 Done-when): "Pointer, touch, the computer keys and MIDI input play the same keys. Each test drives the
// same key path through each source", with §21.1/§21.2's behaviour for each: a chord, a note held under Sustain, a repeated touch on two
// keys of one pitch, a note past Polyphony; Panic and a lost focus release every note; typing in a field never plays. Each source's note
// is made by the device's own adapter (jankoInput.ts pointerNote and computerKeyNote, liveMidi.ts midiNoteEvent), as JankoDevice.tsx
// makes it from the event it hears, and every rule is the same path's for each.
const LETTER = Object.fromEntries(Object.entries(input.COMPUTER_KEY_PITCH).map(([letter, pc]) => [pc, letter]))
/** The surface key of each pitch class the rules play (the fixture's window), and C's second touch-point. */
const KEY_OF = {0: {row: 0, column: 0}, 4: {row: 0, column: 2}, 7: {row: 1, column: 3}}, C_SECOND = {row: 2, column: 5}
const ARMED = {armed: true, editable: false}
const pointerOf = pointerType => ({
  down: (pc, finger = pc, key = KEY_OF[pc]) => input.pointerNote('down', pc, {pointerType, pointerId: finger, pressure: 0.5, height: 0.5}, key),
  up: (pc, finger = pc) => input.pointerNote('up', pc, {pointerType, pointerId: finger, pressure: 0, height: null}),
})
const SOURCES = {
  pointer: pointerOf('mouse'),
  touch: pointerOf('touch'),
  keyboard: {
    down: pc => input.computerKeyNote('down', {key: LETTER[pc], repeat: false, modifier: false}, ARMED),
    up: pc => input.computerKeyNote('up', {key: LETTER[pc], repeat: false, modifier: false}, ARMED),
  },
  midi: {
    down: (pc, channel = 0) => midi.midiNoteEvent({port: 'Keys', channel, note: 60 + pc, velocity: 100, on: true}),
    up: (pc, channel = 0) => midi.midiNoteEvent({port: 'Keys', channel, note: 60 + pc, velocity: 0, on: false}),
  },
}
/** A second press of C on a key of its own, as each source has one: another finger on C's second touch-point; for the computer keys, the
 * pointer on that key beside the key A; for MIDI, the note on a second channel, as a controller sends each touch of one pitch. */
const SECOND_C = {
  pointer: {down: () => SOURCES.pointer.down(0, 9, C_SECOND), up: () => SOURCES.pointer.up(0, 9)},
  touch: {down: () => SOURCES.touch.down(0, 9, C_SECOND), up: () => SOURCES.touch.up(0, 9)},
  keyboard: {down: () => SOURCES.pointer.down(0, 9, C_SECOND), up: () => SOURCES.pointer.up(0, 9)},
  midi: {down: () => SOURCES.midi.down(0, 1), up: () => SOURCES.midi.up(0, 1)},
}

for (const [source, play] of Object.entries(SOURCES)) {
  test(`${source}: a chord is one strike of its keys and its release one act; under Sustain a lifted note sounds on until Sustain ends`, async () => {
    const o = owner()
    let sustain = false
    const p = input.createJankoInput({send: o.send, window: () => windowState, settings: () => ({...input.KEYBOARD_SETTINGS_DEFAULT, sustain})})
    for (const pc of [0, 4, 7]) p.down(play.down(pc))
    await tick()
    assert.deepEqual(keysOf(o.sent, 'strike'), [[C4, E4, G4]], 'one chord, one act, on the same keys whatever plays it')
    assert.ok([0, 4, 7].every(pc => p.down !== undefined && play.down(pc).source === source), 'each note is its own source\'s')
    for (const pc of [0, 4, 7]) p.up(play.up(pc))
    await tick()
    assert.deepEqual(keysOf(o.sent, 'release'), [[C4, E4, G4]], 'one release act')
    sustain = true
    p.down(play.down(4)); await tick()
    p.up(play.up(4)); await tick()
    assert.deepEqual(keysOf(o.sent, 'release').length, 1, 'a lifted note under Sustain is not let go')
    assert.deepEqual(p.sounding(), [E4], 'it sounds on')
    sustain = false
    p.refresh(); await tick()
    assert.deepEqual(keysOf(o.sent, 'release').at(-1), [E4], 'Sustain off lets it go')
    assert.deepEqual(o.notes, [])
  })

  test(`${source}: a repeated touch on two keys of one pitch holds one note, let go with the last; past Polyphony the oldest makes way`, async () => {
    const o = owner({polyphony: 2})
    const p = path(o, {repeatTouch: 'one-note'})
    p.down(play.down(0)); p.down(SECOND_C[source].down()); await tick()
    assert.deepEqual(keysOf(o.sent, 'strike'), [[C4]], 'one note for one pitch')
    p.up(play.up(0)); await tick()
    assert.deepEqual(keysOf(o.sent, 'release'), [], 'the other key still holds it')
    p.up(SECOND_C[source].up()); await tick()
    assert.deepEqual(keysOf(o.sent, 'release'), [[C4]], 'let go with the last of them')
    for (const pc of [0, 4, 7]) { p.down(play.down(pc)); await tick() }
    assert.deepEqual(p.sounding(), [E4, G4], 'past Polyphony the first made way')
    p.up(play.up(0)); await tick()
    assert.deepEqual(keysOf(o.sent, 'release').length, 1, 'and the path owes it no release')
    p.down(play.down(0)); await tick()
    assert.deepEqual(keysOf(o.sent, 'strike').at(-1), [C4], 'pressed again, it is a new note')
  })

  test(`${source}: Panic releases every note it holds at once, and a lost focus (or, for MIDI, its lost device) releases them too`, async () => {
    const o = owner()
    const p = path(o, {sustain: true})
    p.down(play.down(0)); p.down(play.down(4)); await tick()
    p.up(play.up(0)); await tick()
    p.panic(); await tick()
    assert.deepEqual(keysOf(o.sent, 'release'), [[C4, E4]], 'held and sustained, in one act')
    assert.deepEqual(p.sounding(), [])
    p.down(play.down(0)); p.down(play.down(7)); await tick()
    p.up(play.up(7)); await tick()
    // The device's own rules (JankoDevice.tsx): its keyboard or the window losing focus lets go of what the surface holds; a controller's
    // notes are its device's, let go when the device is lost (liveMidi.ts lostMidiPorts), as a hardware key plays whatever holds focus.
    const lost = source === 'midi'
      ? input.lostDevicePress(midi.lostMidiPorts({kind: 'ports', ports: ['Keys', 'Pads'], refusal: null}, {kind: 'ports', ports: ['Pads'], refusal: null}))
      : input.surfacePress
    p.releaseWhere(lost); await tick()
    assert.deepEqual(keysOf(o.sent, 'release').at(-1), [C4, G4], 'every note it held, the held and the sustained')
    assert.deepEqual(p.sounding(), [])
    p.down(play.down(4)); await tick()
    p.releaseWhere(source === 'midi' ? input.surfacePress : input.lostDevicePress(['Keys'])); await tick()
    assert.deepEqual(p.sounding(), [E4], 'the other loss leaves its notes')
  })
}

test('midi: a lost device lets go of its own notes only, and another device\'s sound on', async () => {
  const o = owner()
  const p = path(o, {})
  p.down(midi.midiNoteEvent({port: 'Keys', channel: 0, note: 60, velocity: 100, on: true}))
  p.down(midi.midiNoteEvent({port: 'Pads', channel: 0, note: 64, velocity: 100, on: true})); await tick()
  assert.deepEqual(p.sounding(), [C4, E4])
  p.releaseWhere(input.lostDevicePress(midi.lostMidiPorts({kind: 'ports', ports: ['Keys', 'Pads'], refusal: null}, {kind: 'ports', ports: ['Pads'], refusal: null})))
  await tick()
  assert.deepEqual(p.sounding(), [E4], 'Keys was lost: its C is let go, and the Pads\' E sounds on')
})

test('the computer keys never play while typing in a field, with a modifier, as a held repeat, or unarmed; MIDI and the pointer need no focus', async () => {
  const o = owner()
  const p = path(o)
  const at = key => ({key, repeat: false, modifier: false})
  for (const tag of ['INPUT', 'TEXTAREA', 'SELECT']) assert.equal(input.typingTarget({tagName: tag}), true, `${tag} is typing`)
  assert.equal(input.typingTarget({tagName: 'DIV', isContentEditable: true}), true, 'editable content is typing')
  assert.equal(input.typingTarget({tagName: 'DIV', isContentEditable: false}), false)
  assert.equal(input.typingTarget(null), false)
  assert.equal(input.computerKeyNote('down', at('a'), {armed: true, editable: input.typingTarget({tagName: 'INPUT'})}), null, 'typing in a field plays nothing')
  assert.equal(input.computerKeyNote('down', {key: 'a', repeat: false, modifier: true}, ARMED), null, 'a shortcut keeps its meaning')
  assert.equal(input.computerKeyNote('down', {key: 'a', repeat: true, modifier: false}, ARMED), null, 'a held repeat is no new note')
  assert.equal(input.computerKeyNote('down', at('a'), {armed: false, editable: false}), null, 'unarmed, the keyboard plays nothing')
  assert.equal(input.computerKeyNote('down', at('q'), ARMED), null, 'a key off the row plays nothing')
  assert.equal(input.computerKeyNote('up', at('a'), {armed: false, editable: false}), null, 'and lets nothing go unarmed')
  assert.deepEqual(input.computerKeyNote('down', at('A'), ARMED), {kind: 'down', pitchClass: 0, source: 'keyboard'}, 'either case of the key')
  assert.deepEqual(input.pointerNote('down', 0, {pointerType: 'pen', pointerId: 3, pressure: 0.7, height: 0.25}, KEY_OF[0]),
    {kind: 'down', pitchClass: 0, source: 'pointer', pressure: 0.7, press: 'pointer-3', height: 0.25, key: KEY_OF[0]}, 'a pen carries its pressure')
  assert.equal(input.pointerNote('down', 0, {pointerType: 'mouse', pointerId: 1, pressure: 0.5, height: null}).pressure, null, 'a mouse carries none')
  assert.equal(input.pointerSource('touch'), 'touch')
  assert.equal(input.pointerSource('pen'), 'pointer')
  assert.equal(o.sent.length, 0, 'nothing reached the Torus')
})

test('a MIDI note an octave up is another key, a period on: two notes, each let go by its own key', async () => {
  const o = owner()
  const p = path(o)
  p.down(midi.midiNoteEvent({port: 'Keys', channel: 0, note: 60, velocity: 90, on: true}))
  p.down(midi.midiNoteEvent({port: 'Keys', channel: 0, note: 72, velocity: 90, on: true}))
  await tick()
  assert.deepEqual(keysOf(o.sent, 'strike'), [[C4, {row: 0, column: 48}]])
  p.up(midi.midiNoteEvent({port: 'Keys', channel: 0, note: 60, velocity: 0, on: true})); await tick()
  assert.deepEqual(keysOf(o.sent, 'release'), [[C4]])
  assert.deepEqual(p.sounding(), [{row: 0, column: 48}], 'the upper C sounds on')
})

test('a chord in one task is one strike; its release in one task is one act; a strike and a release keep their order', async () => {
  const o = owner()
  const p = path(o)
  for (const [pc, column] of [[0, 0], [4, 2]]) p.down({kind: 'down', pitchClass: pc, source: 'pointer', key: {row: 0, column}, press: `p${pc}`})
  p.down({kind: 'down', pitchClass: 7, source: 'pointer', key: {row: 1, column: 3}, press: 'p7'})
  await tick()
  assert.deepEqual(keysOf(o.sent, 'strike'), [[C4, E4, G4]], 'one chord, one act')
  for (const pc of [0, 4, 7]) p.up({kind: 'up', pitchClass: pc, source: 'pointer', press: `p${pc}`})
  await tick()
  assert.deepEqual(keysOf(o.sent, 'release'), [[C4, E4, G4]], 'one release act')
  // A quick tap inside one task: the strike goes first, its release after it.
  p.down({kind: 'down', pitchClass: 2, source: 'keyboard'})
  p.up({kind: 'up', pitchClass: 2, source: 'keyboard'})
  await tick()
  assert.deepEqual(o.sent.slice(-2).map(c => [c.action, c.keys]), [['strike', [{row: 0, column: 43}]], ['release', [{row: 0, column: 43}]]])
})

test('Transpose moves every note and keeps the fingering: a chord a whole tone up is the same shape one column on', async () => {
  const o = owner()
  const p = path(o, {transpose: 2})
  p.down({kind: 'down', pitchClass: 0, source: 'pointer', key: {row: 0, column: 0}, press: 'a'})
  p.down({kind: 'down', pitchClass: 4, source: 'pointer', key: {row: 0, column: 2}, press: 'b'})
  p.down({kind: 'down', pitchClass: 7, source: 'pointer', key: {row: 1, column: 3}, press: 'c'})
  await tick()
  assert.deepEqual(keysOf(o.sent, 'strike'), [[C4, E4, G4].map(key => ({row: key.row, column: key.column + 1}))])
  const semitone = owner()
  path(semitone, {transpose: 1}).down({kind: 'down', pitchClass: 0, source: 'keyboard'})
  await tick()
  assert.deepEqual(keysOf(semitone.sent, 'strike'), [[{row: 1, column: 42}]], 'a semitone is the step across the rows')
})

// ── 2 — each note lives as long as it should ─────────────────────────────────────────────────────────────────────────────────────

test('under Sustain a lifted note sounds on; Sustain off releases every note no key holds, and a held key stays', async () => {
  let sustain = true
  const o = owner()
  const p = input.createJankoInput({send: o.send, window: () => windowState, settings: () => ({...input.KEYBOARD_SETTINGS_DEFAULT, sustain})})
  p.down({kind: 'down', pitchClass: 0, source: 'keyboard'})
  p.down({kind: 'down', pitchClass: 4, source: 'keyboard'})
  await tick()
  p.up({kind: 'up', pitchClass: 0, source: 'keyboard'}); await tick()
  assert.deepEqual(keysOf(o.sent, 'release'), [], 'a lifted key under Sustain is not let go')
  assert.deepEqual(p.sounding(), [C4, E4])
  sustain = false
  p.refresh(); await tick()
  assert.deepEqual(keysOf(o.sent, 'release'), [[C4]], 'Sustain off lets go of the lifted note only')
  assert.deepEqual(p.sounding(), [E4], 'the key still held sounds on')
})

test('a sustain pedal holds notes as the setting does, and a sustained key pressed again is struck again on its own key', async () => {
  const o = owner()
  const p = path(o)
  p.down(midi.midiNoteEvent({port: 'Keys', channel: 0, note: 64, velocity: 100, on: true})); await tick()
  p.pedal(true)
  p.up(midi.midiNoteEvent({port: 'Keys', channel: 0, note: 64, velocity: 0, on: false})); await tick()
  assert.deepEqual(keysOf(o.sent, 'release'), [])
  p.down(midi.midiNoteEvent({port: 'Keys', channel: 0, note: 64, velocity: 100, on: true})); await tick()
  assert.deepEqual(keysOf(o.sent, 'strike'), [[E4], [E4]], 'struck again, as a sustained piano key is')
  assert.deepEqual(o.notes, [E4], 'one note in the owner\'s count: the old one made way for it')
  p.up(midi.midiNoteEvent({port: 'Keys', channel: 0, note: 64, velocity: 0, on: false}))
  p.pedal(false); await tick()
  assert.deepEqual(keysOf(o.sent, 'release'), [[E4]], 'the pedal lifted lets it go')
  assert.deepEqual(p.sounding(), [])
})

test('Repeat touch One note: two keys of one pitch hold one note, released only with the last of them', async () => {
  const o = owner()
  const p = path(o, {repeatTouch: 'one-note'})
  p.down({kind: 'down', pitchClass: 0, source: 'touch', key: {row: 0, column: 0}, press: 'f1'})
  p.down({kind: 'down', pitchClass: 0, source: 'touch', key: {row: 2, column: 5}, press: 'f2'})
  await tick()
  assert.deepEqual(keysOf(o.sent, 'strike'), [[C4]], 'one note for one pitch')
  p.up({kind: 'up', pitchClass: 0, source: 'touch', press: 'f1'}); await tick()
  assert.deepEqual(keysOf(o.sent, 'release'), [], 'the other finger still holds it')
  p.up({kind: 'up', pitchClass: 0, source: 'touch', press: 'f2'}); await tick()
  assert.deepEqual(keysOf(o.sent, 'release'), [[C4]])
})

test('Repeat touch Each key: every key is its own touch point, its own note, let go by its own finger', async () => {
  const o = owner()
  const p = path(o, {repeatTouch: 'each-key'})
  p.down({kind: 'down', pitchClass: 0, source: 'touch', key: {row: 0, column: 0}, press: 'f1'})
  p.down({kind: 'down', pitchClass: 0, source: 'touch', key: {row: 2, column: 5}, press: 'f2'})
  await tick()
  const second = {row: 2, column: 47}
  assert.deepEqual(keysOf(o.sent, 'strike'), [[C4, second]], 'two notes, at the two touch-points')
  p.up({kind: 'up', pitchClass: 0, source: 'touch', press: 'f1'}); await tick()
  assert.deepEqual(keysOf(o.sent, 'release'), [[C4]])
  assert.deepEqual(p.sounding(), [second])
})

test('past Polyphony the oldest note makes way: the owner names it, the path lets it go and owes it no release', async () => {
  const o = owner({polyphony: 2})
  const out = []
  const p = path(o, {}, {midiOut: messages => out.push(...messages)})
  for (const note of [60, 64, 67]) { p.down(midi.midiNoteEvent({port: 'Keys', channel: 0, note, velocity: 100, on: true})); await tick() }
  assert.deepEqual(p.sounding(), [E4, G4], 'the first note made way')
  assert.ok(out.some(m => m.kind === 'off' && m.note === 60), 'and it leaves MIDI out too')
  p.up(midi.midiNoteEvent({port: 'Keys', channel: 0, note: 60, velocity: 0, on: false})); await tick()
  assert.deepEqual(keysOf(o.sent, 'release'), [], 'no release for a note the owner no longer counts')
  p.down(midi.midiNoteEvent({port: 'Keys', channel: 0, note: 60, velocity: 100, on: true})); await tick()
  assert.deepEqual(keysOf(o.sent, 'strike').at(-1), [C4], 'pressed again, it is a new note')
})

test('Panic releases every note at once, held and sustained, and MIDI out lets every note go', async () => {
  const o = owner()
  const out = []
  const p = path(o, {sustain: true}, {midiOut: messages => out.push(...messages)})
  p.down({kind: 'down', pitchClass: 0, source: 'keyboard'})
  p.down({kind: 'down', pitchClass: 4, source: 'keyboard'})
  await tick()
  p.up({kind: 'up', pitchClass: 0, source: 'keyboard'})
  p.panic(); await tick()
  assert.deepEqual(keysOf(o.sent, 'release'), [[C4, E4]], 'one act')
  assert.deepEqual(p.sounding(), [])
  assert.deepEqual(p.held(), [], 'a key held through Panic holds nothing')
  assert.deepEqual(out.slice(-3), [{kind: 'off', channel: 0, note: 60, velocity: 0}, {kind: 'off', channel: 0, note: 64, velocity: 0}, {kind: 'all-off', channel: 0}])
  p.up({kind: 'up', pitchClass: 4, source: 'keyboard'}); await tick()
  assert.equal(keysOf(o.sent, 'release').length, 1, 'lifting a key after Panic sends nothing more')
})

test('losing focus releases the notes the surface held, Sustain or not; losing a device releases its notes and no other', async () => {
  const o = owner()
  const p = path(o, {sustain: true})
  p.down({kind: 'down', pitchClass: 0, source: 'pointer', key: {row: 0, column: 0}, press: 'pointer-1'})
  p.down({kind: 'down', pitchClass: 4, source: 'keyboard'})
  p.down(midi.midiNoteEvent({port: 'Keys', channel: 0, note: 67, velocity: 100, on: true}))
  p.down(midi.midiNoteEvent({port: 'Pads', channel: 9, note: 74, velocity: 100, on: true}))
  await tick()
  p.up({kind: 'up', pitchClass: 4, source: 'keyboard'})
  p.releaseWhere(press => press.source !== 'midi'); await tick()
  assert.deepEqual(keysOf(o.sent, 'release'), [[C4, E4]], 'the pointer\'s held note and the computer key\'s sustained note')
  p.releaseWhere(press => press.port === 'Pads'); await tick()
  assert.deepEqual(keysOf(o.sent, 'release').at(-1), [{row: 0, column: 49}], 'the lost device\'s note')
  assert.deepEqual(p.sounding(), [G4], 'the device still there sounds on')
})

test('an input switched off plays nothing; a key already down is still let go when it lifts', async () => {
  const o = owner()
  let inputs = {pointer: true, keys: false, midi: false}
  const p = input.createJankoInput({send: o.send, window: () => windowState, settings: () => ({...input.KEYBOARD_SETTINGS_DEFAULT, inputs})})
  p.down({kind: 'down', pitchClass: 0, source: 'keyboard'})
  p.down(midi.midiNoteEvent({port: 'Keys', channel: 0, note: 64, velocity: 100, on: true}))
  p.down({kind: 'down', pitchClass: 7, source: 'pointer', key: {row: 1, column: 3}, press: 'x'})
  await tick()
  assert.deepEqual(keysOf(o.sent, 'strike'), [[G4]])
  inputs = {pointer: false, keys: false, midi: false}
  p.up({kind: 'up', pitchClass: 7, source: 'pointer', press: 'x'}); await tick()
  assert.deepEqual(keysOf(o.sent, 'release'), [[G4]])
})

test('without the owner\'s surface a note has no key: it is refused in words and nothing is sent', async () => {
  const o = owner(), results = []
  const p = input.createJankoInput({send: o.send, window: () => null, onResult: r => results.push(r)})
  p.down({kind: 'down', pitchClass: 0, source: 'keyboard'}); await tick()
  assert.deepEqual(o.sent, [])
  assert.equal(results.length, 1)
  assert.match(results[0].error, /no surface from the owner yet/)
  assert.doesNotMatch(results[0].error, /janko_window|torus-play|stage command/, 'prose, no op names')
})

// ── 3 — the strength of a note, MIDI out and the measurement hook ────────────────────────────────────────────────────────────────

test('Velocity: Pointer height strikes harder nearer the key\'s near edge; Pressure takes the pen; Fixed strikes every note alike', () => {
  assert.equal(input.strikeAmplitude({source: 'pointer', height: 0}, 'pointer-height'), 0.15)
  assert.equal(input.strikeAmplitude({source: 'touch', height: 1}, 'pointer-height'), 0.9)
  assert.ok(Math.abs(input.strikeAmplitude({source: 'pointer', height: 0.5}, 'pointer-height') - 0.525) < 1e-9)
  assert.equal(input.strikeAmplitude({source: 'pointer', height: 0.5, pressure: 1}, 'pressure'), 0.9, 'Pressure reads the pen, not the height')
  assert.equal(input.strikeAmplitude({source: 'pointer', height: 1, pressure: 1}, 'fixed'), input.JANKO_DEFAULT_AMPLITUDE)
  assert.equal(input.strikeAmplitude({source: 'midi', velocity: 0.5}, 'pointer-height'), 0.5, 'a controller strikes at its own velocity')
  assert.equal(input.strikeAmplitude({source: 'midi', velocity: 0.5}, 'fixed'), input.JANKO_DEFAULT_AMPLITUDE)
  assert.equal(input.strikeAmplitude({source: 'keyboard'}, 'pointer-height'), input.JANKO_DEFAULT_AMPLITUDE)
})

test('MIDI out sends what the part plays: the note it sounds, at its strength, and its release', async () => {
  const o = owner(), out = []
  const p = path(o, {transpose: 12}, {midiOut: messages => out.push(...messages)})
  p.down(midi.midiNoteEvent({port: 'Keys', channel: 3, note: 60, velocity: 64, on: true}))
  p.up(midi.midiNoteEvent({port: 'Keys', channel: 3, note: 60, velocity: 0, on: false}))
  await tick()
  assert.deepEqual(out, [{kind: 'on', channel: 0, note: 72, velocity: 64}, {kind: 'off', channel: 0, note: 72, velocity: 0}], 'the transposed note, as played')
})

test('each strike\'s timing is kept for the key-to-sound measurement: queued, the owner\'s answer and the host\'s leg', async () => {
  let clock = 1000
  const o = owner()
  const slow = {send: async command => { clock += 7; return o.send(command) }}
  const p = input.createJankoInput({send: slow.send, window: () => windowState, now: () => clock, wallNow: () => 50_012})
  p.down({...midi.midiNoteEvent({port: 'Keys', channel: 0, note: 60, velocity: 100, on: true}), receivedAt: 50_000})
  await tick()
  const [first] = p.latency()
  assert.equal(first.ok, true)
  assert.equal(first.hostMs, 12, 'the host received it 12 ms before the page did')
  assert.equal(first.queuedMs, 0)
  assert.equal(first.ownerMs, 7, 'the owner answered 7 ms after the act was sent')
  assert.deepEqual(first.sources, ['midi'])
})

test('key-to-sound is joined from the parts that exist, each named, and the part not measured is said in words (round 18)', () => {
  const strike = {sources: ['midi'], keys: 1, pressedAt: 1000, queuedMs: 0.5, ownerMs: 7, hostMs: 12, ok: true}
  const engine = {block_frames: 480, block_ms: 10, longest_wait_ms: 3, output_latency_ms: 25}
  const joined = input.keyToSound(strike, engine)
  assert.deepEqual(joined.parts, [['the host to the page', 12], ['the page\'s queue', 0.5], ['the owner\'s strike', 7],
    ['the engine\'s block, at worst', 10], ['the device\'s output', 25]])
  assert.equal(joined.ms, 54.5, 'the sum of the parts that exist')
  assert.deepEqual(joined.unmeasured, ['the controller to the host', 'the owner\'s lead over the engine, which renders behind it'])
  assert.match(input.keyToSoundLine(joined), /^Key to sound: 54\.5 ms \(the host to the page 12 · the page's queue 0\.5 · the owner's strike 7 · the engine's block, at worst 10 · the device's output 25\); not measured: the controller to the host, the owner's lead over the engine, which renders behind it\.$/)
  // While the engine does not play, the owner sounds the Torus itself: its own output is not measured here.
  const alone = input.keyToSound({...strike, sources: ['pointer'], hostMs: null}, null)
  assert.deepEqual(alone.parts, [['the page\'s queue', 0.5], ['the owner\'s strike', 7]])
  assert.deepEqual(alone.unmeasured, ['the owner\'s own sound after its strike'])
  assert.equal(input.keyToSound({...strike, ok: false, ownerMs: null}, engine), null, 'a strike the owner refused sounded nothing')
  const layout = readFileSync(new URL('../src/live/keyboardLayout.ts', import.meta.url), 'utf8')
  assert.match(layout, /__oiKeyToSound = \(\) => input\.latency\(\)\.map\(strike => keyToSound\(strike, engineLatency\(\)\)\)/, 'the inspector reads the joined measurement')
  const part = readFileSync(new URL('../src/live/KeyboardOnChain.tsx', import.meta.url), 'utf8')
  assert.match(part, /keyToSoundLine\(/, 'and the part\'s input reports the last strike\'s')
})

test('with the engine\'s pair for the strike the host sent it, key-to-sound is measured to the engine\'s sound, no longer bounded (O-I #849 round 22)', async () => {
  // DLW build ruling 2026-11-05: "Key-to-sound latency on the candidate: build the measurement the walk will read, a host-side timestamp
  // pair per strike reported through the engine's own readout" (live_engine_host.rs latency `strikes`).
  const strike = {sources: ['midi'], keys: 1, pressedAt: 1000, queuedMs: 0.5, ownerMs: 7, hostMs: 12, ok: true, sentAt: 50_000}
  const pair = {track: 1, frame: 4800, sent_at_ms: 50_003, sounds_at_ms: 50_014.5, ms: 11.5}
  const engine = {block_frames: 480, block_ms: 10, longest_wait_ms: 3, output_latency_ms: 25,
    strikes: [{...pair, sent_at_ms: 49_990, sounds_at_ms: 50_001, ms: 11}, pair, {...pair, sent_at_ms: 50_020, sounds_at_ms: 50_030, ms: 10}]}
  const joined = input.keyToSound(strike, engine)
  assert.deepEqual(joined.parts, [['the host to the page', 12], ['the page\'s queue', 0.5], ['the page to the engine', 3],
    ['the engine, to its sound', 11.5], ['the device\'s output', 25]], 'the host sent it to the engine while the owner struck it')
  assert.equal(joined.ms, 52)
  assert.deepEqual(joined.unmeasured, ['the controller to the host'])
  assert.deepEqual(joined.engine, pair, 'with the host\'s pair it was joined with')
  assert.match(input.keyToSoundLine(joined), /^Key to sound: 52 ms \(the host to the page 12 · the page's queue 0\.5 · the page to the engine 3 · the engine, to its sound 11\.5 · the device's output 25\); not measured: the controller to the host\.$/)
  // A pair the host sent outside the owner's strike is another strike's: none is joined, and the bound stands.
  const bounded = input.keyToSound(strike, {...engine, strikes: [{...pair, sent_at_ms: 50_009}]})
  assert.deepEqual(bounded, input.keyToSound(strike, {block_frames: 480, block_ms: 10, longest_wait_ms: 3, output_latency_ms: 25}))
  assert.equal(bounded.engine, undefined)
  // The path keeps when each act was sent, on the wall clock the host's pairs are on.
  let clock = 1000
  const o = owner()
  const p = input.createJankoInput({send: async command => { clock += 7; return o.send(command) }, window: () => windowState, now: () => clock, wallNow: () => 50_000})
  p.down({kind: 'down', pitchClass: 0, source: 'keyboard'})
  await tick()
  assert.equal(p.latency()[0].sentAt, 50_000)
})

// O-I #853 round 23 (DLW build ruling 2026-11-05: "The hardware-key latency path is reported the same way `latency.strikes` is, with MIDI-in
// receive time as its first leg"): a hardware key's strike keeps when the host received its note (the act's earliest), and joined with
// the engine's pair it is read on the host's own wall clock from that receipt: to the engine, then the engine to its sound, then the device.
test('a hardware key\'s key-to-sound runs on the host\'s clock from its MIDI-in receipt, as the strikes\' pairs do: receipt, engine, sound', async () => {
  const pair = {track: 1, frame: 4800, sent_at_ms: 50_003, sounds_at_ms: 50_014.5, ms: 11.5}
  const engine = {block_frames: 480, block_ms: 10, longest_wait_ms: 3, output_latency_ms: 25, strikes: [pair]}
  const strike = {sources: ['midi'], keys: 1, pressedAt: 1000, queuedMs: 0.5, ownerMs: 7, hostMs: 12, ok: true, sentAt: 50_000, receivedAt: 49_988}
  const joined = input.keyToSound(strike, engine)
  assert.deepEqual(joined.parts, [['MIDI in, from the host\'s receipt to the engine', 15], ['the engine, to its sound', 11.5], ['the device\'s output', 25]],
    'its first leg the host\'s receipt of the note to its strike reaching the engine, both on the host\'s clock')
  assert.equal(joined.ms, 51.5)
  assert.deepEqual(joined.unmeasured, ['the controller to the host'])
  assert.deepEqual(joined.engine, pair)
  assert.equal(input.keyToSoundLine(joined), 'Key to sound: 51.5 ms (MIDI in, from the host\'s receipt to the engine 15 · the engine, to its sound 11.5 · the device\'s output 25); not measured: the controller to the host.')
  assert.deepEqual(input.keyToSound({...strike, receivedAt: undefined}, engine).parts.map(([part]) => part)[0], 'the host to the page', 'no receipt: the page\'s legs, as before')
  assert.deepEqual(input.keyToSound(strike, {...engine, strikes: []}).parts[0], ['the host to the page', 12], 'no pair: bounded, as before')
  // The path keeps the receipt of the act's earliest note: a chord of two notes the host received 3 ms apart.
  const o = owner()
  const p = input.createJankoInput({send: o.send, window: () => windowState, wallNow: () => 50_000})
  p.down(midi.midiNoteEvent({port: 'Keys', channel: 0, note: 64, velocity: 100, on: true, received_ms: 49_991}))
  p.down(midi.midiNoteEvent({port: 'Keys', channel: 0, note: 60, velocity: 100, on: true, received_ms: 49_988}))
  await tick()
  assert.equal(p.latency()[0].receivedAt, 49_988)
  assert.equal(p.latency()[0].hostMs, 12)
  p.down({kind: 'down', pitchClass: 7, source: 'pointer', key: {row: 1, column: 3}, press: 'pointer-1'}); await tick()
  assert.equal(p.latency()[1].receivedAt, undefined, 'a key of the surface was received by no host')
})

// DLW build ruling 2026-11-06 (#849 key-to-sound, #853 hardware-key-to-sound): "Record the frame a key's event reaches the engine and the
// frame its first non-silent sample leaves the block. The candidate's readback carries the latest of each, per input kind (pointer, keys,
// MIDI), in ms and in blocks … The engine measures it itself, so a walk reads a number and nobody measures by ear." The engine's pair for
// each strike carries both frames (live-engine StrikeTime, live_engine_host.rs `to_sound`); the page knows each strike's input and joins
// it with its pair as keyToSound does, so the readback is the engine's number for the latest strike of each input. A touch is a pointer's.
test('the readback carries the engine\'s key-to-sound for the latest strike of each input, pointer, keys and MIDI, in frames, ms and blocks', () => {
  const pair = (frame, sent, reached, sounded) => ({track: 1, frame, sent_at_ms: sent, sounds_at_ms: sent + 10, ms: 10, reached_frame: reached, sounded_frame: sounded,
    to_sound: sounded === null ? null : {frames: sounded - reached, ms: (sounded - reached) * 1000 / 48000, blocks: (sounded - reached) / 480}})
  const engine = {block_frames: 480, block_ms: 10, longest_wait_ms: 3, output_latency_ms: 25,
    strikes: [pair(4800, 50_003, 4500, 4801), pair(9600, 60_002, 9400, 9601), pair(12000, 65_002, 11900, 12000), pair(14400, 70_002, 14300, null)]}
  const strike = (source, sentAt, over = {}) => ({sources: [source], keys: 1, pressedAt: sentAt, queuedMs: 0.5, ownerMs: 7, hostMs: null, ok: true, sentAt, ...over})
  const strikes = [strike('touch', 50_000), strike('pointer', 40_000), strike('keyboard', 60_000), strike('keyboard', 65_000),
    strike('keyboard', 66_000, {ok: false}), strike('midi', 70_000, {hostMs: 12})]
  const by = input.keyToSoundByInput(strikes, engine)
  assert.deepEqual(by, {
    pointer: {reached_frame: 4500, sounded_frame: 4801, frames: 301, ms: 301 * 1000 / 48000, blocks: 301 / 480},
    keys: {reached_frame: 11900, sounded_frame: 12000, frames: 100, ms: 100 * 1000 / 48000, blocks: 100 / 480},
    midi: {reached_frame: 14300, sounded_frame: null, frames: null, ms: null, blocks: null},
  }, 'a touch is a pointer\'s, the latest joined strike of each input stands, a refused one sounded nothing, and a pair that sounded nothing says so')
  assert.equal(input.keyToSoundByInputLine(by), 'In the engine, key to sound: pointer 6.27 ms (0.63 blocks) · keys 2.08 ms (0.21 blocks) · MIDI sounded nothing.')
  assert.deepEqual(input.keyToSoundByInput(strikes, null), {pointer: null, keys: null, midi: null}, 'the owner sounds it itself: the engine measured none')
  assert.deepEqual(input.keyToSoundByInput(strikes, {...engine, strikes: engine.strikes.map(({reached_frame: _r, sounded_frame: _s, to_sound: _t, ...older}) => older)}),
    {pointer: null, keys: null, midi: null}, 'an engine that measures no frames: none')
  assert.equal(input.keyToSoundByInputLine({pointer: null, keys: null, midi: null}), null, 'nothing measured: no line')
  assert.equal(input.keyToSoundByInputLine({...by, pointer: null}), 'In the engine, key to sound: keys 2.08 ms (0.21 blocks) · MIDI sounded nothing.')
  // the candidate's readback, read from the inspector, and the part's line
  const layout = readFileSync(new URL('../src/live/keyboardLayout.ts', import.meta.url), 'utf8')
  assert.match(layout, /__oiKeyToSoundByInput = \(\) => keyToSoundByInput\(input\.latency\(\), engineLatency\(\)\)/)
  const part = readFileSync(new URL('../src/live/KeyboardOnChain.tsx', import.meta.url), 'utf8')
  assert.match(part, /data-part-engine-key-to-sound=""/)
  assert.match(part, /keyToSoundByInputLine\(keyToSoundByInput\(input\.latency\(\), engineLatency\(\)\)\)/)
})

test('the host\'s note carries when it was received, and the note event keeps it for the measurement', () => {
  const event = midi.midiNoteEvent({port: 'Keys', channel: 0, note: 60, velocity: 100, on: true, received_ms: 1700000000123.5})
  assert.equal(event.receivedAt, 1700000000123.5)
  assert.equal(event.note, 60, 'the note number travels with it, so octaves are kept')
  assert.equal(event.port, 'Keys')
})

// ── 3b — pitch bend and channel pressure: the part's instrument's input (O-I #853 round 16) ───────────────────────────────────────
// The host decodes each pitch bend and channel pressure (midi.rs decode_expression) and sends them as `oi://midi-expression`, a sibling
// of the notes; the part's input forwards each to the part's instrument in the engine (liveEngine.ts touchInEngine).

test('a pitch bend and a channel pressure arrive from the host as one batch, each read as its amount; a row the window does not read is refused by name', async () => {
  const handlers = new Map()
  const listen = async (event, handler) => { handlers.set(event, handler); return () => {} }
  const batches = [], refused = []
  const off = midi.subscribeLiveMidiExpression({native: true, listen, onExpressions: batch => batches.push(batch), onRefused: reason => refused.push(reason)})
  await tick(); await tick()
  assert.equal(midi.MIDI_EXPRESSION_EVENT, 'oi://midi-expression', 'the host\'s event (midi.rs EXPRESSION_EVENT)')
  const handler = handlers.get(midi.MIDI_EXPRESSION_EVENT)
  handler({payload: [{port: 'Keys', channel: 0, kind: 'bend', value: -8192}, {port: 'Keys', channel: 0, kind: 'pressure', value: 127}]})
  assert.equal(batches.length, 1, 'one task, one batch')
  assert.deepEqual(batches[0].map(midi.midiExpressionAmount), [-1, 1], 'a bend all the way down is −1; a full pressure is 1')
  assert.equal(midi.midiExpressionAmount({port: 'Keys', channel: 0, kind: 'bend', value: 0}), 0, 'the wheel at rest bends nothing')
  assert.equal(midi.midiExpressionAmount({port: 'Keys', channel: 0, kind: 'bend', value: 8191}), 8191 / 8192, 'all the way up is one step short of 1')
  assert.equal(midi.midiExpressionAmount({port: 'Keys', channel: 0, kind: 'bend', value: 4096}), 0.5)
  assert.equal(midi.midiExpressionAmount({port: 'Keys', channel: 0, kind: 'pressure', value: 0}), 0)
  for (const row of [{port: 'Keys', channel: 0, kind: 'bend', value: 8192}, {port: 'Keys', channel: 0, kind: 'pressure', value: 128},
    {port: 'Keys', channel: 0, kind: 'aftertouch', value: 3}, {port: 'Keys', channel: 16, kind: 'bend', value: 0}]) {
    handler({payload: [row]})
  }
  assert.equal(batches.length, 1, 'nothing the window does not read is passed on')
  assert.equal(refused.length, 4)
  assert.match(refused[0], /pitch bend or channel pressure this device does not read/)
  off()
  handler({payload: [{port: 'Keys', channel: 0, kind: 'bend', value: 10}]})
  assert.equal(batches.length, 1, 'after unmount it reaches nothing')
  const absent = []
  midi.subscribeLiveMidiExpression({native: false, onExpressions: () => assert.fail('no listener outside the host'), onRefused: reason => absent.push(reason)})()
  assert.deepEqual(absent, [midi.LIVE_MIDI_ABSENT], 'outside the native host it is the named absence')
})

test('the part\'s input forwards each pitch bend and channel pressure to the part\'s instrument, and says in words what did not move', () => {
  const part = readFileSync(new URL('../src/live/KeyboardOnChain.tsx', import.meta.url), 'utf8')
  assert.match(part, /subscribeLiveMidiExpression\(/, 'the part hears the host\'s bends and pressures')
  assert.match(part, /touchInEngine\(/, 'and hands each to the part\'s instrument through the engine')
  assert.match(part, /midiExpressionAmount\(/, 'as its amount')
  assert.match(part, /settings\.inputs\.midi|inputs\.midi/, 'MIDI switched off moves nothing')
  assert.match(part, /refusalWords\(/, 'a refusal is a plain line')
})

// ── 4 — the shell's one path, its settings and the part's input ──────────────────────────────────────────────────────────────────

test('one keyboard, one path: the surface and the part\'s MIDI share the live path, so Panic reaches every note', async () => {
  const sent = []
  torus.setLiveInstrumentCommander(async command => { sent.push(command); return {ok: true} })
  janko.publishLiveJankoWindow(fixture('janko-window-v1.json'))
  try {
    const live = keyboard.livePlayingPath()
    assert.equal(keyboard.livePlayingPath(), live, 'one path for every surface and the part\'s MIDI')
    live.down({kind: 'down', pitchClass: 0, source: 'keyboard'})
    live.down(midi.midiNoteEvent({port: 'Keys', channel: 0, note: 64, velocity: 100, on: true}))
    await tick()
    keyboard.panicLivePlaying(); await tick()
    assert.deepEqual(sent.filter(c => c.action === 'release').map(c => c.keys), [[C4, E4]])
  } finally { torus.setLiveInstrumentCommander(null); janko.publishLiveJankoWindow(null) }
})

test('the settings are the shell\'s, at the manual\'s defaults; Transpose holds −24 to 24; Sustain switched off lets go of lifted notes', async () => {
  assert.deepEqual(keyboard.keyboardSettings(), input.KEYBOARD_SETTINGS_DEFAULT)
  keyboard.setKeyboardSettings({transpose: 40})
  assert.equal(keyboard.keyboardSettings().transpose, 24)
  keyboard.setKeyboardSettings({transpose: -40})
  assert.equal(keyboard.keyboardSettings().transpose, -24)
  keyboard.setKeyboardSettings({transpose: 0})
  const sent = []
  torus.setLiveInstrumentCommander(async command => { sent.push(command); return {ok: true} })
  janko.publishLiveJankoWindow(fixture('janko-window-v1.json'))
  try {
    keyboard.setKeyboardSettings({sustain: true})
    const live = keyboard.livePlayingPath()
    live.down({kind: 'down', pitchClass: 7, source: 'keyboard'}); await tick()
    live.up({kind: 'up', pitchClass: 7, source: 'keyboard'}); await tick()
    assert.equal(sent.filter(c => c.action === 'release').length, 0)
    keyboard.setKeyboardSettings({sustain: false}); await tick()
    assert.deepEqual(sent.filter(c => c.action === 'release').map(c => c.keys), [[G4]])
  } finally { keyboard.setKeyboardSettings(input.KEYBOARD_SETTINGS_DEFAULT); torus.setLiveInstrumentCommander(null); janko.publishLiveJankoWindow(null) }
})

// REPLACED (DLW build ruling 2026-11-05, #853 MPE): round 16 asserted here that Pressure stood dimmed, waiting for the Torus to take
// a held note's pressure and for the clip to keep it. The playing path now takes it (a rise strikes the held keys again by the rise)
// and Record keeps it on each note, so Pressure is a setting of the path like Sustain.
test('the part\'s input draws its settings and Panic; Pressure is a setting of the path, On by default, in the manual\'s words', () => {
  const html = renderToStaticMarkup(createElement(partInput.PartInput))
  assert.match(html, /data-part-input=/)
  for (const label of ['Jankó', 'Piano', 'Pointer and touch', 'Computer keys', 'MIDI', 'Transpose', 'Pointer height', 'Pressure', 'Fixed', 'Sustain', 'One note', 'Each key', 'Panic'])
    assert.ok(html.includes(label), label)
  const pressure = html.match(/<button[^>]*data-part-setting="pressure"[^>]*>/)?.[0] ?? ''
  assert.doesNotMatch(pressure, /disabled/, 'Pressure is offered')
  assert.match(pressure, /aria-pressed="true"/, 'On by default (DLW §21.1 The input)')
  assert.match(html, /title="Lets pressure on a held key move the sound\. Pressure records into the clip&#x27;s MPE tab\."/)
  assert.equal(input.KEYBOARD_SETTINGS_DEFAULT.pressure, true)
  assert.doesNotMatch(html, /data-device-size=|data-janko-layout=/, 'no plate, and no keyboard surface on the chain')
})

test('the surface plays through the live path: a key carries its row and column and its press, and losing focus lets its notes go', () => {
  const source = readFileSync(new URL('../src/live/janko/JankoDevice.tsx', import.meta.url), 'utf8')
  assert.match(source, /livePlayingPath\(\)/, 'the one live path, not a path of its own')
  assert.doesNotMatch(source, /createJankoInput\(/)
  assert.match(source, /key: \{row: key\.row, column: key\.column\}/, 'the pressed key goes with the note')
  assert.match(source, /onBlur=\{[^}]*releaseWhere/, 'blur releases the surface\'s notes')
  assert.match(source, /addEventListener\('blur'/, 'and so does the window losing focus')
  const html = renderToStaticMarkup(createElement(device.JankoDeviceView, {windowState}))
  assert.equal((html.match(/data-janko-row=/g) ?? []).length, 36)
  const part = readFileSync(new URL('../src/live/KeyboardOnChain.tsx', import.meta.url), 'utf8')
  assert.match(part, /livePlayingPath\(\)/)
  assert.match(part, /subscribeLiveMidiControls\(/, 'the part hears the sustain pedal')
  assert.match(part, /releaseWhere\(press => press\.source === 'midi' && /, 'a lost device lets its notes go')
})

// ── 5 — the hand's touch on the notes it holds (round 18) ────────────────────────────────────────────────────────────────────────

test('a rise of the hand\'s pressure or bend on the keys it holds strikes them again by the rise; a fall lets go; no note begins or ends', async () => {
  const o = owner(), touches = []
  const p = path(o, {}, {onTouch: touch => touches.push(touch)})
  p.down(midi.midiNoteEvent({port: 'Keys', channel: 0, note: 60, velocity: 127, on: true}))
  p.down(midi.midiNoteEvent({port: 'Keys', channel: 0, note: 64, velocity: 127, on: true})); await tick()
  o.sent.length = 0
  const strike = amplitude => ({command: 'janko', action: 'strike', keys: [C4, E4], amplitude})
  assert.equal(p.touch('pressure', 0.5, 'midi'), true, 'pressure 0 → 0.5 strikes')
  await tick()
  assert.deepEqual(o.sent, [strike(input.TOUCH_LAW * 0.5)], 'the held keys, as one act, by the pressure law\'s 0.9 × the rise')
  assert.equal(p.touch('pressure', 0.25, 'midi'), false, 'a fall strikes nothing: the body rings on')
  assert.equal(p.touch('pressure', 0.75, 'midi'), true); await tick()
  assert.deepEqual(o.sent.at(-1), strike(input.TOUCH_LAW * 0.5), 'the next rise is measured from where the hand let go to')
  assert.equal(p.touch('bend', -0.5, 'midi'), true, 'a bend from rest is a force along the key, either way'); await tick()
  assert.deepEqual(o.sent.at(-1), strike(input.TOUCH_LAW * 0.5))
  assert.equal(p.touch('bend', 0, 'midi'), false, 'back to rest lets go')
  assert.equal(p.touch('pressure', 1, 'pointer'), false, 'another source\'s touch moves no note MIDI holds')
  for (const bad of [Number.NaN, 2, -0.1]) assert.equal(p.touch('pressure', bad, 'midi'), false, String(bad))
  assert.equal(p.touch('bend', 1.5, 'midi'), false)
  await tick()
  assert.equal(o.sent.length, 3, 'three rises, three acts')
  assert.ok(o.sent.every(c => c.action === 'strike' && c.keys.length === 2), 'no release, and no key moved: the tuning stays')
  assert.deepEqual(p.sounding(), [C4, E4], 'the notes are still the hand\'s, held')
  assert.equal(p.latency().length, 1, 'the chord\'s one act is timed; a touch is not a key\'s strike for the key-to-sound measurement')
  assert.deepEqual(touches.map(t => [t.kind, t.amount, t.source, t.ids]),
    [['pressure', 0.5, 'midi', ['note:60', 'note:64']], ['pressure', 0.25, 'midi', ['note:60', 'note:64']], ['pressure', 0.75, 'midi', ['note:60', 'note:64']],
      ['bend', -0.5, 'midi', ['note:60', 'note:64']], ['bend', 0, 'midi', ['note:60', 'note:64']]], 'each touch of a held note is told, struck or not')
  p.up(midi.midiNoteEvent({port: 'Keys', channel: 0, note: 60, velocity: 0, on: false}))
  p.up(midi.midiNoteEvent({port: 'Keys', channel: 0, note: 64, velocity: 0, on: false})); await tick()
  assert.deepEqual(o.sent.at(-1), {command: 'janko', action: 'release', keys: [C4, E4]}, 'and they are let go as they were held')
  assert.equal(p.touch('pressure', 1, 'midi'), false, 'with nothing held a touch touches nothing')
})

test('a key struck in the moment of a touch is its own strike: never folded into the touch, and timed as a key\'s', async () => {
  const o = owner()
  const p = path(o)
  p.down(midi.midiNoteEvent({port: 'Keys', channel: 0, note: 60, velocity: 127, on: true})); await tick()
  o.sent.length = 0
  assert.equal(p.latency().length, 1)
  assert.equal(p.touch('pressure', 0.5, 'midi'), true)
  p.down(midi.midiNoteEvent({port: 'Keys', channel: 0, note: 64, velocity: 127, on: true})); await tick()
  assert.deepEqual(o.sent, [{command: 'janko', action: 'strike', keys: [C4], amplitude: input.TOUCH_LAW * 0.5},
    {command: 'janko', action: 'strike', keys: [E4], amplitude: 1}], 'the touch strikes the held key by the rise; the new key at its velocity')
  assert.equal(p.latency().length, 2, 'the new key\'s strike is timed; the touch is not')
})

test('a pen\'s pressure is its own press\'s; Pressure Off moves nothing by pressure, and bend still moves', async () => {
  const o = owner()
  const p = path(o)
  p.down({kind: 'down', pitchClass: 0, source: 'pointer', key: {row: 0, column: 0}, press: 'pointer-1', pressure: 0.2})
  p.down({kind: 'down', pitchClass: 4, source: 'pointer', key: {row: 0, column: 2}, press: 'pointer-2', pressure: 0.2}); await tick()
  o.sent.length = 0
  assert.equal(p.touch('pressure', 0.6, 'pointer', 'pointer-2'), true); await tick()
  assert.deepEqual(o.sent, [{command: 'janko', action: 'strike', keys: [E4], amplitude: input.TOUCH_LAW * 0.6}], 'only the key the pen presses')
  const off = owner()
  const q = path(off, {pressure: false})
  q.down(midi.midiNoteEvent({port: 'Keys', channel: 0, note: 60, velocity: 127, on: true})); await tick()
  off.sent.length = 0
  assert.equal(q.touch('pressure', 1, 'midi'), false, 'Pressure Off')
  assert.equal(q.touch('bend', 1, 'midi'), true, 'bend is not Pressure'); await tick()
  assert.deepEqual(off.sent.map(c => c.amplitude), [input.TOUCH_LAW])
  const surface = readFileSync(new URL('../src/live/janko/JankoDevice.tsx', import.meta.url), 'utf8')
  assert.match(surface, /onPointerMove=\{event => \{ if \(event\.buttons !== 0 && pen\(event\) !== null\) input\.touch\('pressure', event\.pressure, pointerSource\(event\), `pointer-\$\{event\.pointerId\}`\) \}\}/,
    'a pen pressed on a key touches that press')
  const part = readFileSync(new URL('../src/live/KeyboardOnChain.tsx', import.meta.url), 'utf8')
  assert.match(part, /for \(const expression of expressions\) input\.touch\(expression\.kind, midiExpressionAmount\(expression\), 'midi'\)/,
    'MIDI\'s bends and pressures touch the notes MIDI holds, each as it came')
  assert.match(part, /toggle\('pressure', 'Pressure', settings\.pressure, \(\) => setKeyboardSettings\(\{pressure: !settings\.pressure\}\)\)/)
})
