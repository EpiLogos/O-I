import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {readFileSync} from 'node:fs'
import {register} from 'node:module'
import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'

// T-LIVE-MODE-SCALES item 3, first leg: the note devices before the torus. Each device transforms every played act before the one
// `janko` stage command; the Scale device folds onto the owner's pitch set (the mode in force), passes through and says why under a
// maqam or no mode, and never invents a 12-TET mapping. Fixtures are the owner's catalogue rows (live-modes-catalogue.test.mjs).
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

const here = new URL('../src/', import.meta.url)
// The device-panel modules inject styles at import time; a minimal document shim stands in (as live-janko.test.mjs does).
globalThis.document = {getElementById: () => null, createElement: () => ({}), head: {appendChild: () => {}}}
await import('../src/panels/devices/index.tsx')
await import('../src/panels/devices-pro/index.ts')
const React = await import('react')
const modes = await import('../src/live/modes.ts')
const noteDevices = await import('../src/live/noteDevices/noteDevices.ts')
const store = await import('../src/live/noteDevices/noteDeviceHold.ts')
const view = await import('../src/live/noteDevices/NoteDeviceChain.tsx')
const input = await import('../src/live/janko/jankoInput.ts')
const midi = await import('../src/native/liveMidi.ts')
const torus = await import('../src/live/torusInstrument.ts')
const chain = await import('../src/components/DeviceChainPanel.tsx')

const {parseQlMusicModes, resolveModeInForce} = modes
const {runNoteChain, traceNoteChain, composeInOrder, newNoteDevice, foldPitchClass, scalePlan} = noteDevices
const {addNoteDevice, moveNoteDevice, removeNoteDevice, setNoteDevicePower, setScaleTie, resetNoteDeviceChain, noteDeviceChain} = store
const settle = () => new Promise(resolve => setTimeout(resolve, 0))

// The owner's catalogue rows, as live-modes-catalogue.test.mjs states them (aeolian on L0' over the chromatic basis; a maqam).
const provenance = symbol => ({operator: 'mode_tonic_instance', owner: 'ql-mef', revision: '1.0.0', source: {blob: 'b', path: 'docs/sources/ql-musical-derivation-v3.md', vendor_commit: 'c', version: '1.0.0'}, symbol})
const aeolian = {
  anchor_basis: 'chromatic', context_frame: 'CF6', key: "chromatic/L0'/aeolian", kind: 'lens-cf', label: "aeolian on L0', chromatic basis",
  lens: "L0'", mode: 'aeolian', pitches: [10, 0, 1, 3, 5, 6, 8], provenance: provenance('mode_tonic_landscape'),
  scale_beneath_tonic: 1, steps_semitones: [2, 1, 2, 2, 1, 2, 2], tonic: 10, tuning: null,
}
const maqam = {
  cents_from_root: [0, 200, 350, 500, 700, 850, 1000, 1200], family: 'maqam', family_ratio: {den: 22, num: 27}, key: 'maqam/09',
  kind: 'source', label: 'Maqam 9 (family 0, mode 0)', maqam_family: 0, mode_in_family: 0, pitches: null, planet_ruler: 0,
  provenance: {owner: 'ql-mef', ratio_symbol: 'M2_MAQAM_RATIOS', ratio_table: 'ratio', registry_revision: 'r1', revision: 'r1', source_symbol: 'M2_MAQAM_DESC', sources: [{path: 'vendor/epi-kernel/reference/src/m2.c', sha256: 'h'}], symbol: 'maqam_pitches', table: 'maqam'},
  quarter_tone_steps: [4, 3, 3, 4, 3, 3, 4], quarter_tones_from_root: [0, 4, 7, 10, 14, 17, 20, 24], tuning: null, tuning_unit: 'quarter-tone',
}
const catalogue = parseQlMusicModes({
  schema: 'ql.music-modes/v1',
  bases: [
    {basis: 'chromatic', conjugate_axis_semitones: 1, generator_ratio: {den: 8, num: 9}, generator_semitones: 2},
    {basis: 'fifths', conjugate_axis_semitones: 6, generator_ratio: {den: 2, num: 3}, generator_semitones: 7},
  ],
  lens_cf: [aeolian], source_scales: [maqam],
  sources_absent: [{scale: 'shem', status: 'absent', reason: 'no pitch set is retained for Shem'}],
  provenance: {m2_registry_revision: 'r1', owner: 'ql-mef'},
})
assert.equal(catalogue.ok, true, catalogue.refusal)
const aeolianMode = () => resolveModeInForce(catalogue.catalogue.scales, {key: aeolian.key, root: 10})
const maqamMode = () => resolveModeInForce(catalogue.catalogue.scales, {key: maqam.key, root: 0})
const waitingMode = () => resolveModeInForce(null, null)
const inForce = {mode: aeolianMode()}
const scale = (tie = 'up', enabled = true) => ({...newNoteDevice('scale', `scale-${tie}-${enabled}`), params: {tie}, enabled})

// The commands one act produces through the one input path, from a list of events.
async function commandsFor(options, events) {
  const commands = []
  const path = input.createJankoInput({...options, send: async command => { commands.push(command); return {ok: true} }})
  for (const event of events) event.kind === 'down' ? path.down(event) : path.up(event)
  await settle()
  return commands
}

// ── 1 — the identity chain changes nothing ──────────────────────────────────

test('an empty chain and an all-bypassed chain are the identity: the act comes back as it went in, and the stage command is unchanged', async () => {
  const act = [0, 4, 7]
  assert.equal(runNoteChain([], act, inForce), act, 'an empty chain returns the input itself')
  assert.equal(runNoteChain([scale('up', false)], act, inForce), act, 'a bypassed device returns the input itself')
  assert.equal(runNoteChain([scale('up', false)], act, {mode: waitingMode()}), act)
  const events = [{kind: 'down', pitchClass: 7, source: 'keyboard'}, {kind: 'down', pitchClass: 0, source: 'pointer'}, {kind: 'down', pitchClass: 4, source: 'touch'}]
  const plain = await commandsFor({}, events)
  const identity = await commandsFor({transform: classes => runNoteChain([], classes, inForce)}, events)
  const bypassed = await commandsFor({transform: classes => runNoteChain([scale('up', false)], classes, inForce)}, events)
  assert.deepEqual(identity, plain, 'an empty chain sends the same stage command as no chain')
  assert.deepEqual(bypassed, plain, 'an all-bypassed chain sends the same stage command as no chain')
  assert.deepEqual(plain, [{command: 'janko', action: 'play', pitch_classes: [0, 4, 7], amplitude: 0.35}])
})

// ── 2 — Scale folds onto the owner's pitch set ──────────────────────────────

test('the Scale device folds each played class onto the owner\'s aeolian pitch set: nearest in-mode class, the owner\'s set and no other', () => {
  const mask = modes.pitchMask(aeolianMode().selection.scale)
  assert.deepEqual(mask.map((on, pc) => (on ? pc : -1)).filter(pc => pc >= 0), [0, 1, 3, 5, 6, 8, 10], 'the owner\'s seven classes')
  // every out-of-mode class: 2 4 7 9 11 each sits one semitone from an in-mode class above and below (a tie), so the tie rule decides
  assert.deepEqual(runNoteChain([scale('up')], [2, 4, 7, 9, 11], inForce), [0, 3, 5, 8, 10], 'tie up')
  assert.deepEqual(runNoteChain([scale('down')], [2, 4, 7, 9, 11], inForce), [1, 3, 6, 8, 10], 'tie down')
  // in-mode classes stay exactly as played
  assert.deepEqual(runNoteChain([scale('up')], [0, 1, 3, 5, 6, 8, 10], inForce), [0, 1, 3, 5, 6, 8, 10])
})

test('duplicates within one act collapse: D and D sharp in one chord fold to one class, and the output is ascending', () => {
  assert.deepEqual(runNoteChain([scale('up')], [2, 3], inForce), [3], 'D folds up onto D sharp, which the act already holds')
  assert.deepEqual(runNoteChain([scale('down')], [2, 3], inForce), [1, 3], 'D folds down to C sharp instead: no collapse')
  assert.deepEqual(runNoteChain([scale('up')], [9, 2, 11, 4], inForce), [0, 3, 5, 10], 'four out-of-mode classes fold up, ascending')
})

test('a tie is decided by the rule, and an out-of-mode class with a nearer in-mode neighbour is not decided by the rule', () => {
  const mask = modes.pitchMask(aeolianMode().selection.scale)
  assert.equal(foldPitchClass(2, mask, 'up'), 3, 'equal distance, up')
  assert.equal(foldPitchClass(2, mask, 'down'), 1, 'equal distance, down')
  // a gapped set: the only in-mode class is one step down, so the rule never comes into it
  const gapped = [true, false, false, false, false, false, false, false, false, false, false, false]
  assert.equal(foldPitchClass(2, gapped, 'up'), 0, 'the only in-mode class is down')
  assert.equal(foldPitchClass(2, gapped, 'down'), 0, 'the rule never overrides the nearer side')
  const nearer = [false, false, false, false, false, true, false, false, false, false, false, true] // 5 and 11
  assert.equal(foldPitchClass(7, nearer, 'down'), 5, 'distance 2 down beats distance 4 up')
})

test('the Scale device through the input path: a pointer press, touch, a keyboard press and a MIDI note all fold before the stage command', async () => {
  const transform = classes => runNoteChain([scale('up')], classes, inForce)
  const pitchClass2 = {kind: 'down', pitchClass: 2}
  for (const source of ['pointer', 'touch', 'keyboard']) {
    const commands = await commandsFor({transform}, [{...pitchClass2, source}])
    assert.deepEqual(commands.map(c => c.pitch_classes), [[3]], `${source} folds D onto D sharp`)
  }
  const note = midi.midiNoteEvent({port: 'port', channel: 0, note: 62, velocity: 100, on: true}) // 62 mod 12 = 2
  const commands = await commandsFor({transform}, [note])
  assert.deepEqual(commands.map(c => c.pitch_classes), [[3]], 'a MIDI D folds onto D sharp through the same chain')
  assert.equal(commands[0].amplitude, 100 / 127, 'MIDI still strikes at its own velocity')
})

// ── 3 — a maqam or no mode passes through, and says why ──────────────────────

test('with no mode in force the Scale device passes the act through unchanged and names the waiting mode', () => {
  const trace = traceNoteChain([scale('up')], [2, 4], {mode: waitingMode()})
  assert.deepEqual(trace.pitchClasses, [2, 4], 'no invented mapping')
  assert.equal(trace.stages.length, 1)
  assert.match(trace.stages[0].passed, /Passes notes through/)
  assert.match(trace.stages[0].passed, /waiting/, 'the reason is the mode in force\'s own line')
})

test('a maqam, which serves no pitch set, passes notes through unchanged and says why: no 12-TET mapping is invented', () => {
  const mode = maqamMode()
  assert.equal(mode.state, 'in-force', 'the maqam is a catalogued scale on the root')
  const trace = traceNoteChain([scale('up')], [1, 2, 6], {mode})
  assert.deepEqual(trace.pitchClasses, [1, 2, 6], 'a quarter-tone scale is never folded onto the twelve classes')
  assert.match(trace.stages[0].passed, /serves no pitch set/)
  assert.match(trace.stages[0].passed, /no 12-TET mapping is invented/)
  assert.equal(scalePlan(mode).state, 'pass')
  assert.equal(scalePlan(aeolianMode()).state, 'fold')
})

// ── 4 — bypass and reorder ──────────────────────────────────────────────────

test('a bypassed device is skipped: the same act folds with the device on and passes through with it off', () => {
  assert.deepEqual(runNoteChain([scale('up', true)], [2], inForce), [3])
  assert.deepEqual(runNoteChain([scale('up', false)], [2], inForce), [2])
  const trace = traceNoteChain([scale('up', false)], [2], inForce)
  assert.deepEqual(trace.stages, [], 'a bypassed device does not run')
})

test('the chain is composed in order: the first stage\'s output feeds the second, so reordering changes the composition', () => {
  const double = xs => xs.map(p => (p * 2) % 12)
  const plusOne = xs => xs.map(p => (p + 1) % 12)
  assert.deepEqual(composeInOrder([double, plusOne], [3]), [7], 'double, then plus one')
  assert.deepEqual(composeInOrder([plusOne, double], [3]), [8], 'plus one, then double')
})

test('reorder and remove on the session hold: the stages run in chain order, the ends do not move, and removal drops the device', () => {
  resetNoteDeviceChain()
  const a = addNoteDevice('scale')
  const b = addNoteDevice('scale')
  assert.deepEqual(noteDeviceChain().map(d => d.id), [a.id, b.id])
  moveNoteDevice(b.id, -1)
  assert.deepEqual(noteDeviceChain().map(d => d.id), [b.id, a.id], 'b moved before a')
  moveNoteDevice(b.id, -1)
  assert.deepEqual(noteDeviceChain().map(d => d.id), [b.id, a.id], 'the first device cannot move earlier')
  moveNoteDevice(a.id, 1)
  assert.deepEqual(noteDeviceChain().map(d => d.id), [b.id, a.id], 'the last device cannot move later')
  assert.deepEqual(traceNoteChain(noteDeviceChain(), [2], inForce).stages.map(s => s.id), [b.id, a.id], 'the trace runs in chain order')
  setNoteDevicePower(a.id, false)
  assert.deepEqual(traceNoteChain(noteDeviceChain(), [2], inForce).stages.map(s => s.id), [b.id], 'the bypassed device is skipped')
  setScaleTie(b.id, 'down')
  assert.equal(noteDeviceChain().find(d => d.id === b.id).params.tie, 'down')
  assert.deepEqual(runNoteChain(noteDeviceChain(), [2], inForce), [1], 'b now folds down')
  removeNoteDevice(a.id)
  assert.deepEqual(noteDeviceChain().map(d => d.id), [b.id])
  removeNoteDevice('no-such-device')
  assert.equal(noteDeviceChain().length, 1, 'an unknown id changes nothing')
  resetNoteDeviceChain()
})

// ── 5 — one path: a pointer press and a MIDI note pass the same chain before the owner's stage command ──

test('a pointer press and a MIDI note both reach the owner through the same chain, as one janko stage command each, via the mounted channel', async () => {
  resetNoteDeviceChain()
  addNoteDevice('scale')
  const captured = []
  torus.setLiveInstrumentCommander(async command => { captured.push(command); return {ok: true} })
  try {
    const path = input.createJankoInput({
      send: torus.commitLiveStage,
      transform: classes => runNoteChain(noteDeviceChain(), classes, {mode: aeolianMode()}),
    })
    path.down({kind: 'down', pitchClass: 2, source: 'pointer', pressure: null})
    await settle()
    path.down(midi.midiNoteEvent({port: 'port', channel: 0, note: 62, velocity: 64, on: true}))
    await settle()
    assert.deepEqual(captured.map(c => c.command), ['janko', 'janko'], 'one owner act per source')
    assert.deepEqual(captured.map(c => c.pitch_classes), [[3], [3]], 'both folded before the stage command')
    assert.deepEqual(captured.map(c => c.action), ['play', 'play'])
  } finally {
    torus.setLiveInstrumentCommander(null)
    resetNoteDeviceChain()
  }
})

// ── 6 — the chain shows in Live's device chain, before the torus ──────────────

test('the note devices render in the Live device chain before the torus, and the Jankó keyboard after it', () => {
  resetNoteDeviceChain()
  addNoteDevice('scale')
  torus.publishLiveTorusState({ok: false, fault: 'test reading'})
  try {
    const ctx = {set: null, loading: false, error: null}
    const selection = {track: 0, clip: undefined, scene: null}
    const html = renderToStaticMarkup(createElement(chain.DeviceChainPanel, {ctx, document: null, selection, mode: 'device'}))
    const at = html.indexOf('data-note-device-chain="note-devices"')
    const torusAt = html.indexOf('data-live-torus=')
    const jankoAt = html.indexOf('data-janko-layout=')
    assert.ok(at >= 0, 'the note-device chain is in the Live device chain')
    assert.ok(torusAt > at, 'before the torus')
    assert.ok(jankoAt > torusAt, 'the keyboard follows the torus, as before')
    assert.match(html.slice(at), /data-note-device="scale"/, 'the Scale tile is in the chain')
    assert.match(html.slice(at), /aria-label="Scale tie rule"/, 'the tie parameter shows on the device it moves')
    assert.match(html.slice(at), /Passes notes through/, 'the face says why it passes notes through, with no mode in force')
    assert.match(html.slice(at), /Held for this session only: the set document has no owner write for a note-device chain yet\./)
    torus.publishLiveTorusState(null)
    const unread = renderToStaticMarkup(createElement(chain.DeviceChainPanel, {ctx, document: null, selection, mode: 'device'}))
    assert.doesNotMatch(unread, /data-note-device-chain=/, 'no note chain without a reading, like the keyboard it feeds')
    const clip = renderToStaticMarkup(createElement(chain.DeviceChainPanel, {ctx, document: null, selection, mode: 'clip'}))
    assert.doesNotMatch(clip, /data-note-device-chain="note-devices"/, 'the clip detail has no note-device chain')
  } finally {
    torus.publishLiveTorusState(null)
    resetNoteDeviceChain()
  }
})

test('the chain face: an empty chain says the notes reach the torus unchanged; a bypassed device says so; the add control names the waiting devices', () => {
  const empty = renderToStaticMarkup(createElement(view.NoteDeviceChainView, {devices: [], mode: aeolianMode()}))
  assert.match(empty, /No note devices\. Played notes reach the torus unchanged\./)
  assert.match(empty, /Add note device/)
  assert.match(empty, />Scale</)
  assert.match(empty, /Exact-ratio tuning — waiting on its owner/, 'tuning is named, not offered')
  assert.match(empty, /Sky — waiting on its owner/, 'sky is named, not offered')
  assert.match(empty, /disabled=""/)
  const bypassed = renderToStaticMarkup(createElement(view.NoteDeviceChainView, {devices: [scale('up', false)], mode: aeolianMode()}))
  assert.match(bypassed, /data-note-device-power="off"/)
  assert.match(bypassed, /Bypassed: notes pass through unchanged\./)
  const folding = renderToStaticMarkup(createElement(view.NoteDeviceChainView, {devices: [scale('down')], mode: aeolianMode()}))
  assert.match(folding, /data-note-device-reading="fold"/)
  assert.match(folding, /Folds onto aeolian on L0&#x27;, chromatic basis/)
  assert.match(folding, /<option(?=[^>]*value="down")(?=[^>]*selected="")[^>]*>Down<\/option>/, 'the tie rule shows its value on the device')
})

// ── 7 — sources and wiring: read from the code, labelled as source reading ─────

test('source reading: the one hook point is the input path\'s transform, applied to each act before the stage command; the chain is empty by default', async () => {
  const jankoInput = await readFile(new URL('../src/live/janko/jankoInput.ts', import.meta.url), 'utf8')
  assert.match(jankoInput, /readonly transform\?: \(pitchClasses: readonly number\[\]\) => readonly number\[\]/)
  assert.match(jankoInput, /const played = options\.transform \? /)
  assert.match(jankoInput, /pitch_classes: played/)
  const device = await readFile(new URL('../src/live/janko/JankoDevice.tsx', import.meta.url), 'utf8')
  assert.match(device, /runNoteChain\(chain, pitchClasses, \{mode\}\)/)
  assert.match(device, /transform: classes => transformRef\.current\(classes\)/)
  assert.match(device, /noteTransform/, 'the keyboard view takes the chain through its prop')
  assert.equal(noteDeviceChain().length, 0, 'no device is present until one is added: the chain is empty by default')
})

test('source reading: Live\'s chain mounts the note devices before the torus, and the clip detail carries none', async () => {
  const panel = readFileSync(new URL('../src/components/DeviceChainPanel.tsx', import.meta.url), 'utf8')
  const note = panel.indexOf('<NoteDeviceChain />')
  const torusAt = panel.indexOf('<LiveTorusWidget />')
  const jankoAt = panel.indexOf('<JankoDevice />')
  assert.ok(note > 0 && torusAt > note && jankoAt > torusAt, 'note devices, then the torus, then the keyboard')
  assert.match(panel, /import \{ NoteDeviceChain \} from '\.\.\/live\/noteDevices\/NoteDeviceChain'/)
})

// ── 8 — tokens only; nothing persisted in browser storage; no 12-TET ───────────

test('the note-device faces take colour from tokens only, and the chain is never written to browser storage', async () => {
  const files = ['noteDevices.css', 'NoteDeviceChain.tsx', 'noteDevices.ts', 'noteDeviceHold.ts']
  for (const file of files) {
    const source = await readFile(new URL(`live/noteDevices/${file}`, here), 'utf8')
    assert.doesNotMatch(source, /#[0-9a-fA-F]{3,8}\b/, `${file}: no hex colour`)
    assert.doesNotMatch(source, /\b(rgb|rgba|hsl|hsla)\(/, `${file}: no functional colour`)
    assert.doesNotMatch(source, /localStorage|sessionStorage|indexedDB/, `${file}: no browser storage`)
  }
  const scaleSource = await readFile(new URL('live/noteDevices/noteDevices.ts', here), 'utf8')
  assert.doesNotMatch(scaleSource, /2 \*\* |Math\.pow|\b440\b/, 'no equal-temperament mapping in the transforms')
})
