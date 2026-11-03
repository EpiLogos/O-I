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

test('the host\'s note carries when it was received, and the note event keeps it for the measurement', () => {
  const event = midi.midiNoteEvent({port: 'Keys', channel: 0, note: 60, velocity: 100, on: true, received_ms: 1700000000123.5})
  assert.equal(event.receivedAt, 1700000000123.5)
  assert.equal(event.note, 60, 'the note number travels with it, so octaves are kept')
  assert.equal(event.port, 'Keys')
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

test('the part\'s input draws its settings and Panic; Pressure stands dimmed and says in words what it waits for', () => {
  const html = renderToStaticMarkup(createElement(partInput.PartInput))
  assert.match(html, /data-part-input=/)
  for (const label of ['Jankó', 'Piano', 'Pointer and touch', 'Computer keys', 'MIDI', 'Transpose', 'Pointer height', 'Pressure', 'Fixed', 'Sustain', 'One note', 'Each key', 'Panic'])
    assert.ok(html.includes(label), label)
  const pressure = html.match(/<button[^>]*data-part-setting="pressure"[^>]*>/)?.[0] ?? ''
  assert.match(pressure, /disabled=""/, 'Pressure is not offered until its owner takes it')
  assert.match(pressure, /title="[^"]*waits/, 'and says what it waits for')
  assert.doesNotMatch(pressure, /torus-|_read|stage command/, 'in words, no op names')
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
