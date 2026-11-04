import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {register} from 'node:module'

// The QL sitting's bell plays the Torus as every other note does (O-I #790 PROPOSE 1, folded in with #855): one key of the Jankó
// surface, struck on the part's one playing path (`janko` strike → torus-play, at the owner's cursor) and let go at once (`janko`
// release → torus-release, which moves no native state: "the body rings on", instrument-session.mjs). So the bell rings out on the
// body and keeps no place among the notes Polyphony counts. REPLACES the pitch-class `janko play` act the bell struck through the
// frame's played voices (nativeField.ts playJanko) and the tests that asserted it: live-clip-play.test.mjs "the frame runs each strike
// through the native field…" (its playJanko and planJankoStrike source checks), expressions-boundary hosted-janko-command.test.mjs (the
// chord's reading, its malformed chords and its concealed post), hosted-strike-at-command.test.mjs "a strike names the sample it lands
// at" (the chord's cursor), and expressions-app janko-keys-853.test.mjs "the chord a clip strikes still reads as before".
// Loader as live-clip-path-790.test.mjs.
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
const fixture = name => JSON.parse(readFileSync(new URL(`fixtures/${name}`, import.meta.url), 'utf8'))
const windowState = janko.readJankoWindow(fixture('janko-window-v1.json'))
const tick = () => new Promise(resolve => setTimeout(resolve, 0))

/** The frame's answer to the Torus's two acts (as live-clip-path-790.test.mjs): it counts the notes it holds. */
function owner({refuse = null} = {}) {
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
      for (const key of command.keys) { const at = notes.findIndex(n => id(n) === id(key)); if (at >= 0) notes.splice(at, 1); notes.push(key) }
      return {ok: true}
    },
  }
}

// The owner's window (fixture): the octave from middle C stands seven periods on; D row 0 column 43, G row 1 column 45.
const D4 = {row: 0, column: 43}, G4 = {row: 1, column: 45}

test('the sitting\'s bell strikes its note\'s key now and lets it go at once: the body rings on, and it holds no place among the notes', async () => {
  const o = owner(), midi = []
  const p = input.createJankoInput({send: o.send, window: () => windowState, midiOut: messages => midi.push(...messages)})
  const answer = await p.ring(2, 0.35)
  await tick()
  assert.deepEqual(answer, {ok: true})
  assert.deepEqual(o.sent, [
    {command: 'janko', action: 'strike', keys: [D4], amplitude: 0.35},
    {command: 'janko', action: 'release', keys: [D4]},
  ], 'its pitch class in the octave from middle C, struck at the owner\'s own cursor, then let go')
  assert.deepEqual(p.sounding(), [])
  assert.deepEqual(o.notes, [], 'the owner counts no note for it')
  assert.deepEqual(midi, [], 'the bell is the sitting\'s sound, not the part\'s playing: nothing leaves as MIDI')
  assert.equal(o.sent.filter(c => 'pitch_classes' in c || c.action === 'play').length, 0, 'no pitch-class act')
})

test('a key a press holds when the bell rings is struck again and sounds on while the press holds it', async () => {
  const o = owner()
  const p = input.createJankoInput({send: o.send, window: () => windowState})
  p.down({kind: 'down', source: 'pointer', pitchClass: 7, velocity: 1})
  await tick()
  await p.ring(7, 0.35)
  await tick()
  assert.deepEqual(o.sent.map(c => [c.action, c.keys]), [['strike', [G4]], ['strike', [G4]]], 'struck again, never released under the press')
  assert.deepEqual(p.sounding(), [G4])
  p.up({kind: 'up', source: 'pointer', pitchClass: 7})
  await tick()
  assert.deepEqual(o.sent.at(-1), {command: 'janko', action: 'release', keys: [G4]}, 'let go with the press')
})

test('with no surface from the owner the bell is refused in words, and nothing is sent; nor is a note off the twelve classes', async () => {
  const o = owner()
  const none = input.createJankoInput({send: o.send, window: () => null})
  assert.deepEqual(await none.ring(2, 0.35), {ok: false, error: input.NO_SURFACE})
  const p = input.createJankoInput({send: o.send, window: () => windowState})
  for (const pitchClass of [12, -1, 2.5, NaN]) {
    const answer = await p.ring(pitchClass, 0.35)
    assert.equal(answer.ok, false, String(pitchClass))
    assert.doesNotMatch(answer.error, /pitch_class|ring\(|[{}]/, 'the refusal is prose')
  }
  await tick()
  assert.deepEqual(o.sent, [])
  const refused = owner({refuse: 'The field is not running: resume it, then play'})
  const q = input.createJankoInput({send: refused.send, window: () => windowState})
  assert.deepEqual(await q.ring(2, 0.35), {ok: false, error: 'The field is not running: resume it, then play'}, 'the owner\'s refusal reaches the sitting')
})

test('the QL sitting rings its bell through the one playing path, never a pitch-class act', () => {
  const sitting = readFileSync(new URL('../src/inhabitants/ql/devices/qlSitting.ts', import.meta.url), 'utf8')
  assert.match(sitting, /ring: pitchClass => livePlayingPath\(\)\.ring\(pitchClass, BELL_AMPLITUDE\),/)
  assert.doesNotMatch(sitting, /action: 'play'|pitch_classes|janko play|commitLiveStage/)
})
