import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {register} from 'node:module'
import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'

// T-LIVE-TORUS-INSTRUMENT leg 3: the owner's determinant and presentation controls, reached through the hosted channel. The shell
// never writes the owner itself: each control sends one validated `instrument` stage command, and a refusal is named.
// Loader as live-torus-instrument.test.mjs.
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

// T-LIVE-JANKO-DEVICE: the Jankó keyboard, built up to the owner seam. The surface is the owner's `ql music janko window` (fixtures are the
// real output); every key goes through one input path to the owner's own strike; placement awaits the kernel derivation (packet K).
const here = new URL('../src/', import.meta.url)
// The device-panel modules inject styles at import time; a minimal document shim stands in (as devices-panels-ssr.test.mjs does).
globalThis.document = {getElementById: () => null, createElement: () => ({}), head: {appendChild: () => {}}}
await import('../src/panels/devices/index.tsx')
await import('../src/panels/devices-b2/index.tsx')
await import('../src/panels/devices-pro/index.ts')
const React = await import('react')
const janko = await import('../src/live/janko/jankoLayout.ts')
const input = await import('../src/live/janko/jankoInput.ts')
const device = await import('../src/live/janko/JankoDevice.tsx')
const torus = await import('../src/live/torusInstrument.ts')
const kernelWindow = await import('../src/native/liveJankoWindow.ts')
const chain = await import('../src/components/DeviceChainPanel.tsx')
const fixture = name => JSON.parse(readFileSync(new URL(`fixtures/${name}`, import.meta.url), 'utf8'))
import {readFileSync} from 'node:fs'

const windowV1 = () => fixture('janko-window-v1.json')
const windowFc1 = () => fixture('janko-window-first-column-1.json')
const keyAt = (window, row, column) => window.rows[row].find(key => key.column === column)

// ── 1 — the surface is the owner's window, read exactly ───────────────────

test('the owner\'s window is six rows of six keys, whole-tone families alternating, each pitch class held by three repeated touch-points', () => {
  const state = janko.readJankoWindow(windowV1())
  assert.equal(state.ok, true)
  const window = state.window
  assert.equal(window.rows.length, 6)
  assert.ok(window.rows.every(row => row.length === 6))
  assert.deepEqual(window.rows.map(row => row[0].family), [0, 1, 0, 1, 0, 1])
  const perClass = new Map()
  for (const row of window.rows) for (const key of row) perClass.set(key.pitchClass, [...(perClass.get(key.pitchClass) ?? []), key.touchPoint])
  assert.equal(perClass.size, 12)
  for (const touches of perClass.values()) assert.deepEqual([...touches].sort(), [0, 1, 2], 'three repeated touch-points per class')
})

test('a window the owner does not state exactly is refused by name; no key is laid out from it', () => {
  const base = windowV1()
  const refused = [
    {...base, schema: 'ql.janko-surface/v0'},
    {...base, surface: base.surface.slice(0, 5)},
    {...base, surface: base.surface.map((row, i) => i === 2 ? {...row, row: 9} : row)},
    {...base, surface: base.surface.map((row, i) => i === 0 ? {...row, keys: row.keys.map((k, j) => j === 0 ? {...k, sounding_pitch_class: 12} : k)} : row)},
    {...base, surface: base.surface.map((row, i) => i === 0 ? {...row, keys: row.keys.map((k, j) => j === 0 ? {...k, whole_tone_row_family: 1} : k)} : row)},
    {...base, surface: base.surface.map((row, i) => i === 1 ? {...row, keys: [...row.keys, row.keys[0]]} : row)},
    {...base, surface: base.surface.map((row, i) => i === 0 ? {...row, keys: row.keys.map((k, j) => j === 0 ? {...k, coordinate: {face: 'middle', position: 0}} : k)} : row)},
  ]
  for (const raw of refused) assert.equal(janko.readJankoWindow(raw).ok, false, JSON.stringify(raw).slice(0, 80))
  // a touch-point gap: pitch class 0 keeps touch-points 0 and 2 only
  const gap = windowV1()
  for (const row of gap.surface) for (const key of row.keys) if (key.sounding_pitch_class === 0 && key.repeated_touch_point === 1) key.repeated_touch_point = 2
  const named = janko.readJankoWindow(gap)
  assert.equal(named.ok, false)
  assert.match(named.fault, /touch-point 1 missing/)
})

test('the layout is never laid out by eye: the device names the excitation point as awaiting the kernel derivation (packet K)', () => {
  assert.equal(janko.JANKO_PLACEMENT_NOTE, 'Excitation point: placement awaits the kernel derivation (packet K).')
  const markup = renderToStaticMarkup(React.createElement(device.JankoDeviceView, {windowState: janko.readJankoWindow(windowV1())}))
  assert.match(markup, /Excitation point: placement awaits the kernel derivation \(packet K\)\./)
})

// ── 2 — fingering: the owner's own transposition, and the row step ───────

test('fingering is invariant under transposition: shifting the first column leaves every key on the same pitch class', () => {
  const base = janko.parseJankoWindow(windowV1())
  const shifted = janko.parseJankoWindow(windowFc1())
  for (const key of shifted.rows.flat()) {
    const original = keyAt(base, key.row, key.column)
    if (original) assert.equal(key.pitchClass, original.pitchClass, `row ${key.row} column ${key.column}`)
  }
  // the seventh column repeats the first: the period of the fingering is six columns
  assert.equal(keyAt(base, 0, 0).pitchClass, keyAt(shifted, 0, 6).pitchClass)
  assert.equal(keyAt(shifted, 1, 6).pitchClass, keyAt(base, 1, 0).pitchClass)
})

test('a semitone is the cross-row step: the next row sounds one semitone above the row before, in the same column', () => {
  const base = janko.parseJankoWindow(windowV1())
  for (let column = 0; column < 6; column += 1) {
    for (let row = 0; row < 5; row += 1) {
      assert.equal((keyAt(base, row + 1, column).pitchClass - keyAt(base, row, column).pitchClass + 12) % 12, 1, `row ${row} → ${row + 1}, column ${column}`)
    }
  }
})

// ── 3 — the piano alternative ─────────────────────────────────────────────

test('the piano alternative is the twelve pitch classes, one key each, with the black keys marked', () => {
  const keys = janko.pianoKeys()
  assert.deepEqual(keys.map(k => k.pitchClass), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])
  assert.deepEqual(keys.filter(k => k.black).map(k => k.pitchClass), [1, 3, 6, 8, 10])
})

// ── 4 — one input path for every source; chords and polyphony; velocity ────

test('pointer, touch and computer keyboard produce the same janko command for the same pitch class', async () => {
  const sent = []
  const path = input.createJankoInput({send: async command => { sent.push(command); return {ok: true} }})
  path.down({kind: 'down', pitchClass: 4, source: 'pointer'}); await Promise.resolve(); await Promise.resolve()
  path.down({kind: 'down', pitchClass: 4, source: 'touch'}); await Promise.resolve(); await Promise.resolve()
  path.down({kind: 'down', pitchClass: 4, source: 'keyboard'}); await Promise.resolve(); await Promise.resolve()
  assert.equal(sent.length, 3)
  for (const command of sent) assert.deepEqual(command, {command: 'janko', action: 'play', pitch_classes: [4], amplitude: input.JANKO_DEFAULT_AMPLITUDE})
})

test('notes struck in one task are one chord, one owner act; a later task is its own act; a release sends nothing', async () => {
  const sent = []
  const path = input.createJankoInput({send: async command => { sent.push(command); return {ok: true} }})
  path.down({kind: 'down', pitchClass: 7, source: 'keyboard'})
  path.down({kind: 'down', pitchClass: 0, source: 'pointer'})
  path.down({kind: 'down', pitchClass: 4, source: 'touch'})
  await new Promise(resolve => setTimeout(resolve, 0))
  assert.deepEqual(sent.map(c => c.pitch_classes), [[0, 4, 7]], 'one chord')
  path.up({kind: 'up', pitchClass: 4, source: 'touch'})
  assert.equal(sent.length, 1, 'a release is not a second act')
  path.down({kind: 'down', pitchClass: 9, source: 'keyboard'})
  await new Promise(resolve => setTimeout(resolve, 0))
  assert.deepEqual(sent.map(c => c.pitch_classes), [[0, 4, 7], [9]], 'a later task is its own act')
  assert.deepEqual(path.held(), [0, 7, 9], 'the held keys are the notes still down')
})

test('velocity: pen pressure maps to the Studio\'s pressure law inside the owner bound; every other input strikes at the owner default', () => {
  assert.equal(input.strikeAmplitude({source: 'pointer', pressure: 1}), 0.9)
  assert.equal(input.strikeAmplitude({source: 'pointer', pressure: 0.01}), 0.15)
  assert.equal(input.strikeAmplitude({source: 'pointer', pressure: 0.5}), 0.45)
  assert.equal(input.strikeAmplitude({source: 'pointer', pressure: null}), input.JANKO_DEFAULT_AMPLITUDE, 'a mouse carries no pressure')
  assert.equal(input.strikeAmplitude({source: 'touch', pressure: 0.8}), input.JANKO_DEFAULT_AMPLITUDE, 'touch does not claim pressure')
  assert.equal(input.strikeAmplitude({source: 'keyboard', pressure: 0.8}), input.JANKO_DEFAULT_AMPLITUDE)
  for (const pressure of [0, -1, 2, NaN, Infinity]) {
    const amplitude = input.strikeAmplitude({source: 'pointer', pressure})
    assert.ok(amplitude > 0 && amplitude <= 1, String(pressure))
  }
})

test("the owner's refusal of a chord is passed to the device by name", async () => {
  const results = []
  const path = input.createJankoInput({send: async () => ({ok: false, error: 'No voice of this sky sounds at G'}), onResult: r => results.push(r)})
  path.down({kind: 'down', pitchClass: 7, source: 'pointer'})
  await new Promise(resolve => setTimeout(resolve, 0))
  assert.deepEqual(results, [{ok: false, error: 'No voice of this sky sounds at G'}])
})

test('the computer keyboard plays only while armed, never from editable text, never with a modifier, never as a held repeat', () => {
  const plain = {armed: true, editable: false, modifier: false, repeat: false}
  assert.equal(input.keyboardGate(plain), true)
  assert.equal(input.keyboardGate({...plain, armed: false}), false, 'not focused')
  assert.equal(input.keyboardGate({...plain, editable: true}), false, 'typing in a text field')
  assert.equal(input.keyboardGate({...plain, modifier: true}), false, 'undo and shortcuts keep their meaning')
  assert.equal(input.keyboardGate({...plain, repeat: true}), false)
  assert.deepEqual([...new Set(Object.values(input.COMPUTER_KEY_PITCH))].sort((a, b) => a - b), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])
})

// ── 5 — the device: states, accessibility, and no synthesis ───────────────

test('the device reads the surface from the owner until it is served, and the piano stays available', () => {
  const absent = renderToStaticMarkup(React.createElement(device.JankoDeviceView, {windowState: null}))
  assert.match(absent, /data-janko-window="absent"/)
  assert.match(absent, /ql music janko window/)
  assert.doesNotMatch(absent, /data-janko-pitch-class/, 'no key is laid out without the owner\'s window')
  const piano = renderToStaticMarkup(React.createElement(device.JankoDeviceView, {windowState: null, initialLayout: 'piano'}))
  assert.equal((piano.match(/data-janko-pitch-class="/g) || []).length, 12)
})

test('the Jankó surface is 36 accessible keys in six rows; the play region is focusable and holds no text field', () => {
  const markup = renderToStaticMarkup(React.createElement(device.JankoDeviceView, {windowState: janko.readJankoWindow(windowV1())}))
  assert.equal((markup.match(/data-janko-pitch-class="/g) || []).length, 36)
  assert.equal((markup.match(/aria-label="[^"]*row \d, column \d, touch-point \d"/g) || []).length, 36, 'each key names its place')
  assert.match(markup, /role="application"[^>]*tabindex="0"|tabindex="0"[^>]*role="application"/)
  assert.doesNotMatch(markup, /<input|<textarea|contenteditable/)
  assert.match(markup, /Typing in a text field never plays a note/)
})

test('a refused surface is named and renders no key', () => {
  const markup = renderToStaticMarkup(React.createElement(device.JankoDeviceView, {windowState: {ok: false, fault: 'janko: expected the ql.janko-surface/v1 window'}}))
  assert.match(markup, /data-janko-window="refused"/)
  assert.doesNotMatch(markup, /data-janko-pitch-class/)
})

test('the window store holds the owner\'s validated window, withdraws it, and tells readers only of a change', () => {
  let calls = 0
  const off = janko.subscribeLiveJanko(() => { calls += 1 })
  janko.publishLiveJankoWindow(windowV1())
  assert.equal(janko.liveJankoWindow().ok, true)
  janko.publishLiveJankoWindow(windowV1())
  assert.equal(calls, 1, 'an identical publish is no change')
  janko.publishLiveJankoWindow({schema: 'ql.janko-surface/v0'})
  assert.equal(janko.liveJankoWindow().ok, false)
  janko.publishLiveJankoWindow(null)
  assert.equal(janko.liveJankoWindow(), null)
  off()
})

// ── 6 — the kernel route: janko_window_read ─────────────────────────────────

test('the window is read through the kernel for the acting lens, and each refusal is named', async () => {
  const asked = []
  const served = await kernelWindow.readJankoWindowThroughKernel(async op => { asked.push(op); return {outcome: {result: 'janko_window_reading', document: windowV1()}} }, 3)
  assert.deepEqual(asked, [{op: 'janko_window_read', lens: 3}])
  assert.equal(served.ok, true)
  await kernelWindow.readJankoWindowThroughKernel(async op => { asked.push(op); return {outcome: {result: 'janko_window_reading', document: windowV1()}} }, null)
  assert.deepEqual(asked[1], {op: 'janko_window_read'}, 'no lens is the owner\'s default, never an invented one')
  const older = await kernelWindow.readJankoWindowThroughKernel(async () => ({outcome: null, error: 'ql-music.unsupported: no `music janko window --json` reading (exit 2)'}), null)
  assert.deepEqual(older, {ok: false, reason: 'ql-music.unsupported: no `music janko window --json` reading (exit 2)'})
  const wrong = await kernelWindow.readJankoWindowThroughKernel(async () => ({outcome: {result: 'music_modes_reading'}}), null)
  assert.match(wrong.reason, /not `janko_window_reading`/)
  const thrown = await kernelWindow.readJankoWindowThroughKernel(async () => { throw new Error('no bridge') }, null)
  assert.match(thrown.reason, /could not be asked/)
})

test('a request publishes the owner\'s window or its refusal, and a stale reply never overwrites a newer lens', async () => {
  janko.publishLiveJankoWindow(null)
  await kernelWindow.requestLiveJankoWindow(0, async () => ({outcome: null, error: 'ql-music.unavailable: quaternal-logic is not installed'}))
  assert.deepEqual(janko.liveJankoWindow(), {ok: false, fault: 'ql-music.unavailable: quaternal-logic is not installed'})
  let release
  const slow = kernelWindow.requestLiveJankoWindow(1, () => new Promise(resolve => { release = () => resolve({outcome: null, error: 'stale'}) }))
  await kernelWindow.requestLiveJankoWindow(2, async () => ({outcome: {result: 'janko_window_reading', document: windowV1()}}))
  release(); await slow
  assert.equal(janko.liveJankoWindow().ok, true, 'the newer lens\'s window stands')
  janko.publishLiveJankoWindow(null)
})

test('the device mounts beside the torus, only once the owner has published a reading', () => {
  const ctx = {set: null, loading: false, error: null}
  const selection = {track: 0, clip: undefined, scene: null}
  torus.publishLiveTorusState(null)
  const before = renderToStaticMarkup(React.createElement(chain.DeviceChainPanel, {ctx, document: null, selection, mode: 'device'}))
  assert.doesNotMatch(before, /data-janko-layout=/, 'no keyboard without a reading')
  torus.publishLiveTorusState({ok: true, determinants: null, parameters: null,
    value: {schema: 'ql.instrument-reading/v1', standing: 'following', identity: {event_ref: 'event:janko'}}})
  let after
  try { after = renderToStaticMarkup(React.createElement(chain.DeviceChainPanel, {ctx, document: null, selection, mode: 'device'})) }
  finally { torus.publishLiveTorusState(null) }
  assert.ok(after.indexOf('data-live-torus=') < after.indexOf('data-janko-layout='), 'the keyboard row sits beside the torus')
  assert.ok(after.indexOf('data-chain-device=') > 0, 'the effect faces are on the chain')
  assert.ok(after.indexOf('data-janko-layout=') < after.indexOf('data-chain-device='), 'and before the effect faces')
})

test('the Jankó module synthesises no sound and no angle; it draws nothing by eye and stores nothing', async () => {
  const files = ['jankoLayout.ts', 'jankoInput.ts', 'JankoDevice.tsx'].map(f => readFileSync(new URL(`live/janko/${f}`, here), 'utf8')).join('\n')
  assert.doesNotMatch(files, /AudioContext|createOscillator|OscillatorNode|Math\.(sin|cos|atan2?)\b|localStorage|sessionStorage|indexedDB/)
  assert.doesNotMatch(files, /theta|angle_?deg|degree/i, 'no torus angle is computed in the shell')
})

test('the frame\'s chord reaches the owner through the one host-command channel the instrument uses', async () => {
  const sent = []
  torus.setLiveInstrumentCommander(async command => { sent.push(command); return {ok: true} })
  try {
    const path = input.createJankoInput({send: command => torus.commitLiveStage(command)})
    path.down({kind: 'down', pitchClass: 2, source: 'keyboard'})
    await new Promise(resolve => setTimeout(resolve, 0))
  } finally { torus.setLiveInstrumentCommander(null) }
  assert.deepEqual(sent, [{command: 'janko', action: 'play', pitch_classes: [2], amplitude: input.JANKO_DEFAULT_AMPLITUDE}])
})
