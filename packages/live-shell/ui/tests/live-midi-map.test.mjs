import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {register} from 'node:module'
import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'

// T-LIVE-MIDI leg 2: the MIDI and Key map. Control changes arrive as a sibling of the notes; the map arms a parameter, binds a source to
// it, and a bound source moves the parameter only through the owner's write (commitLiveInstrumentEdit, or the note-device setter), one
// coalesced value per frame, sent only when it changes. The mappings are session-held; the set document is never written. Loader as
// live-torus-controls.test.mjs.
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

const midi = await import('../src/native/liveMidi.ts')
const model = await import('../src/live/midiMap/midiMapModel.ts')
const hold = await import('../src/live/midiMap/midiMapHold.ts')
const router = await import('../src/live/midiMap/midiMapRouter.ts')
const targets = await import('../src/live/midiMap/midiMapTargets.ts')
const controls = await import('../src/live/midiMap/midiMapControls.tsx')
const torus = await import('../src/live/torusInstrument.ts')
const chain = await import('../src/live/noteDevices/noteDeviceHold.ts')
const noteDevices = await import('../src/live/noteDevices/noteDevices.ts')
const section = await import('../src/live/LiveInstrumentSection.tsx')
const onChain = await import('../src/live/TorusOnChain.tsx')
const noteChain = await import('../src/live/noteDevices/NoteDeviceChain.tsx')
const grammar = await import('../src/shell/modeGrammar.ts')

const tick = () => new Promise(resolve => setTimeout(resolve, 0))
/** A frame clock the test drives: scheduled runs wait until `frame()`. */
function clock() {
  const queue = []
  return {schedule: run => queue.push(run), frame: () => { for (const run of queue.splice(0)) run() }, waiting: () => queue.length}
}
const CC = (controller, value = 0, port = 'Pads', channel = 0) => ({port, channel, controller, value})
const CC_SOURCE = (controller, port = 'Pads', channel = 0) => ({kind: 'cc', port, channel, controller})

const determinants = (over = {}) => ({lens: {lens12: 3, label: 'L1′'}, contextFrame: 2, harmonic: {selection: 'canonical-basis', index: 4}, rna: true, ...over})
const parameters = (over = {}) => ({muted: true, level: 1, scale: {unitsPerMetre: 120, mode: 'domain-follow'}, cadence: {rate: 1, playing: true, source: '1 tick/s'}, refusal: null, ...over})
const reading = (standing = 'following') => ({schema: 'ql.instrument-reading/v1', standing, reason: null,
  identity: {event_ref: 'controlled:occasion', subject_ref: 's', registry_revision: 'r', geometry_ref: 'g', material_ref: 'm', model_ref: 'd'}})
const okState = (det = determinants(), par = parameters()) => ({ok: true, value: reading(), determinants: det, parameters: par})

/** A fresh session: no mapping, the map off, no owner reading, no frame, no notes in the chain. Every test starts here. */
function session({state = okState(), write = null} = {}) {
  hold.resetMidiMapHold()
  chain.resetNoteDeviceChain()
  torus.publishLiveTorusState(state)
  const sent = []
  torus.setLiveInstrumentCommander(write ?? (async command => { sent.push(command); return {ok: true} }))
  return sent
}
function teardown() {
  torus.setLiveInstrumentCommander(null)
  torus.publishLiveTorusState(null)
  chain.resetNoteDeviceChain()
  hold.resetMidiMapHold()
}

// ── 1 — the host's control changes reach the map as one batch ───────────────────

test('control changes from the host arrive as one batch, and a payload the window does not read is refused by name', async () => {
  const handlers = new Map()
  const listen = async (event, handler) => { handlers.set(event, handler); return () => {} }
  const batches = []
  const refused = []
  const off = midi.subscribeLiveMidiControls({native: true, listen, onControls: batch => batches.push(batch), onRefused: reason => refused.push(reason)})
  await tick(); await tick()
  assert.equal(midi.MIDI_CC_EVENT, 'oi://midi-cc', 'a sibling event: the note batch keeps its shape')
  const handler = handlers.get(midi.MIDI_CC_EVENT)
  handler({payload: [{port: 'Pads', channel: 0, controller: 74, value: 100}, {port: 'Pads', channel: 0, controller: 74, value: 101}]})
  assert.equal(batches.length, 1, 'one task, one batch')
  assert.equal(batches[0].length, 2, 'both controls arrived together')
  handler({payload: [{port: 'Pads', channel: 0, controller: 200, value: 100}]})
  off()
  assert.equal(batches.length, 1, 'a control after unmount reaches nothing')
  assert.match(refused[0], /does not read/)
})

test('outside the native host a control change is a named absence: no listener is attached', () => {
  const refused = []
  const batches = []
  const off = midi.subscribeLiveMidiControls({native: false, onControls: batch => batches.push(batch), onRefused: reason => refused.push(reason)})
  off()
  assert.deepEqual(refused, [midi.LIVE_MIDI_ABSENT])
  assert.deepEqual(batches, [])
})

test('unmounting releases the control listener, including one that attached after the unmount', async () => {
  const released = []
  const waiting = []
  const listen = () => new Promise(resolve => waiting.push(() => resolve(() => released.push('cc'))))
  const off = midi.subscribeLiveMidiControls({native: true, listen, onControls: () => {}})
  off()
  for (const release of waiting.splice(0)) release()
  await tick(); await tick()
  assert.deepEqual(released, ['cc'])
})

// ── 2 — the model: the owner's options, the ranges, the keys, the bindings ──────

test('a choice takes the 0–127 range in equal slices: twelve lenses and seven context frames each own one, and 127 selects the last', () => {
  const lenses = Array.from({length: 128}, (_, value) => model.choiceIndex(value, 12))
  assert.equal(lenses[0], 0)
  assert.equal(lenses[127], 11)
  assert.deepEqual([...new Set(lenses)].sort((a, b) => a - b), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], 'every lens is reachable')
  for (let index = 0; index < 11; index += 1) assert.ok(lenses.indexOf(index + 1) > lenses.indexOf(index), 'in order')
  const frames = Array.from({length: 128}, (_, value) => model.choiceIndex(value, 7))
  assert.deepEqual([...new Set(frames)].sort((a, b) => a - b), [0, 1, 2, 3, 4, 5, 6])
  assert.equal(model.choiceIndex(43, 3), 1, 'three options split at 43')
  assert.equal(model.choiceIndex(42, 3), 0)
})

test('a range runs linearly across 0–127, snapped to its own step and never past its ends', () => {
  const level = {min: 0, max: 4, step: 0.05}
  assert.equal(model.rangeValue(0, level), 0)
  assert.equal(model.rangeValue(127, level), 4)
  assert.equal(model.rangeValue(64, level), 2, 'the middle, snapped to 0.05')
  const units = {min: 40, max: 400, step: 5}
  assert.equal(model.rangeValue(0, units), 40)
  assert.equal(model.rangeValue(127, units), 400)
  assert.equal(model.rangeValue(200, units), 400, 'a value past the range clamps to its end')
})

test('a log range takes equal ratios for equal turns across 0–127, from its least to its most, four figures each', () => {
  // The Torus's Rate spans one step a year to 40,000 a second (manual §21.2): twelve decades, which a linear knob could not reach.
  const rate = {min: 1 / (365.25 * 86_400), max: 40_000, step: 0, curve: 'log'}
  assert.equal(model.rangeValue(0, rate), rate.min)
  assert.equal(model.rangeValue(127, rate), 40_000)
  assert.equal(model.rangeValue(200, rate), 40_000, 'past the end clamps')
  const values = Array.from({length: 128}, (_, cc) => model.rangeValue(cc, rate))
  for (let cc = 1; cc < 128; cc += 1) assert.ok(values[cc] > values[cc - 1], `rising at ${cc}`)
  const turn = (rate.max / rate.min) ** (1 / 127)
  for (const cc of [1, 30, 64, 100, 126]) assert.ok(Math.abs(values[cc] / values[cc - 1] / turn - 1) < 2e-3, `one ratio a turn at ${cc}`)
  assert.equal(String(values[64]).replace(/^0\.0*|\.|e.*$/g, '').length <= 4, true, 'four significant figures')
  // Linear stays linear: a range that names no curve is the one it was.
  assert.equal(model.rangeValue(64, {min: 0, max: 4, step: 0.05}), 2)
  assert.equal(model.rangeValue(64, {min: 0, max: 4, step: 0.05, curve: 'linear'}), 2)
})

test('a toggle is on from 64, and a key flips it', () => {
  assert.equal(model.toggleValue(63), false)
  assert.equal(model.toggleValue(64), true)
  const sound = {kind: 'toggle', id: 'sound', label: 'Sound', group: 'g', current: false, apply: async () => ({ok: true})}
  assert.equal(model.keyStepValue(sound, false), true)
  assert.equal(model.keyStepValue(sound, true), false)
  assert.equal(model.keyStepValue(sound, null), true, 'an unstated toggle turns on')
})

test('a key steps a choice to the next option and wraps; a range takes no key', () => {
  const cadence = {kind: 'choice', id: 'cadence', label: 'Tick cadence', group: 'g', options: [{value: 'hold', label: 'Hold'}, {value: '1', label: '1'}, {value: '12', label: '12'}], current: '12', apply: async () => ({ok: true})}
  assert.equal(model.keyStepValue(cadence, '12'), 'hold', 'the last option wraps to the first')
  assert.equal(model.keyStepValue(cadence, 'hold'), '1')
  assert.equal(model.keyStepValue(cadence, null), 'hold', 'an unstated choice starts at the first')
  const level = {kind: 'range', id: 'level', label: 'Level', group: 'g', range: {min: 0, max: 4, step: 0.05}, current: 1, apply: async () => ({ok: true})}
  assert.equal(model.keyStepValue(level, 1), null)
  assert.equal(model.keyable(level), false)
  assert.equal(model.keyable(cadence), true)
})

test('a key may be mapped only if it is a letter, digit or symbol: the A–J row and the named keys are refused by name', () => {
  assert.deepEqual(model.mappableKey('X'), {ok: true, key: 'x'})
  assert.deepEqual(model.mappableKey('7'), {ok: true, key: '7'})
  const played = model.mappableKey('a')
  assert.equal(played.ok, false)
  assert.match(played.reason, /plays the keyboard/)
  assert.equal(model.mappableKey('k').ok, true, 'K is past the A–J row')
  assert.equal(model.mappableKey('Escape').ok, false)
  assert.equal(model.mappableKey('ArrowUp').ok, false)
  assert.equal(model.mappableKey(' ').ok, false)
})

test('a parameter has one binding (a second source replaces it), and a source drives one parameter (it moves off the old one)', () => {
  const first = model.planBinding([], 'lens', CC_SOURCE(74))
  assert.deepEqual(first.bindings, [{target: 'lens', source: CC_SOURCE(74)}])
  const replaced = model.planBinding(first.bindings, 'lens', CC_SOURCE(75))
  assert.deepEqual(replaced.bindings, [{target: 'lens', source: CC_SOURCE(75)}], 'the second CC replaces the first')
  assert.equal(replaced.moved, null)
  const moved = model.planBinding(replaced.bindings, 'context-frame', CC_SOURCE(75))
  assert.deepEqual(moved.bindings, [{target: 'context-frame', source: CC_SOURCE(75)}], 'CC 75 left lens for the context frame')
  assert.equal(moved.moved, 'lens')
  assert.deepEqual(model.removeBinding(moved.bindings, 'context-frame'), [])
})

test('a control reaches only the bindings on its own port, channel and controller', () => {
  const bindings = [{target: 'lens', source: CC_SOURCE(74, 'Pads', 0)}, {target: 'level', source: CC_SOURCE(74, 'Keys', 0)}, {target: 'sound', source: CC_SOURCE(74, 'Pads', 1)}]
  assert.deepEqual(model.routeCc(bindings, CC(74, 0, 'Pads', 0)).map(b => b.target), ['lens'])
  assert.deepEqual(model.routeCc(bindings, CC(75, 0, 'Pads', 0)), [])
  assert.equal(model.shortSourceLabel(CC_SOURCE(74)), 'CC 74')
  assert.equal(model.shortSourceLabel({kind: 'key', key: 'j'}), 'key J')
})

// ── 3 — the parameters a map offers: the owner's own, written through the owner ──

test('the map offers the owner\'s parameters: the determinants, cadence, sound, level, units per metre and the Scale tie; an unstated determinant is not offered', () => {
  session()
  chain.addNoteDevice('scale')
  const tie = `note-device:${chain.noteDeviceChain()[0].id}:tie`
  const offered = targets.mapTargets(torus.liveTorusState(), chain.noteDeviceChain()).map(t => t.id)
  assert.deepEqual(offered, ['lens', 'context-frame', 'harmonic-basis', 'm3-transcription', 'cadence', 'sound', 'level', 'scale-units', tie])
  const withoutOwner = targets.mapTargets(null, chain.noteDeviceChain())
  assert.deepEqual(withoutOwner.map(t => t.id), [tie], 'with no owner reading only the note devices are offered')
  teardown()
})

/** The owner's M1′ session as the frame announces it (instrumentAnnouncement.mjs `parameters.torus`). */
const torusSession = (settings = {}) => ({
  settings: {rate: {mode: 'free', steps_per_second: 2.5}, fundamental: {source: 'map'}, carrier: 0.25, shape: 'auto', tuning: 'logic', polyphony: 16, tempo_bpm: 120, ...settings},
  steps_per_second: 2.5, band: 'rhythm', fundamental_hz: 130.81, map_hz: 130.81, figure: 'figure-eight', comma_cents: 0, notes: 0,
  resident_tunings: ['logic', 'sky'], carrier_drive: 'pulse',
})

test('the Torus\'s Carrier and Fundamental are linear map targets and its Rate a log one, each the owner\'s value and its own torus edit', async () => {
  // O-I 850: the compact's macros (manual §21.2) take a control; Damping does not (the owner reads no Q).
  const sent = session({state: okState(determinants(), parameters({torus: torusSession()}))})
  const offered = targets.mapTargets(torus.liveTorusState(), [])
  const byId = id => offered.find(t => t.id === id)
  assert.deepEqual(offered.filter(t => ['rate', 'fundamental', 'carrier', 'damping'].includes(t.id)).map(t => t.id), ['rate', 'fundamental', 'carrier'])
  const rate = byId('rate'), fundamental = byId('fundamental'), carrier = byId('carrier')
  assert.deepEqual([rate.kind, rate.range.curve, rate.range.min, rate.range.max, rate.current], ['range', 'log', 1 / (365.25 * 86_400), 40_000, 2.5])
  assert.deepEqual([fundamental.range.curve ?? 'linear', fundamental.range.min, fundamental.range.max, fundamental.current], ['linear', 20, 2000, 130.81])
  assert.deepEqual([carrier.range.curve ?? 'linear', carrier.range.min, carrier.range.max, carrier.current], ['linear', 0, 100, 25], 'Carrier in percent, as its face reads it')
  assert.ok([rate, fundamental, carrier].every(t => t.writer === 'owner'))
  await model.applyMapValue(rate, model.controlValue(rate, 127))
  await model.applyMapValue(fundamental, model.controlValue(fundamental, 127))
  await model.applyMapValue(carrier, model.controlValue(carrier, 64))
  assert.deepEqual(sent, [
    {command: 'instrument', edit: {kind: 'torus', edit: {rate: {mode: 'free', steps_per_second: 40_000}}}},
    {command: 'instrument', edit: {kind: 'torus', edit: {fundamental: {source: 'hz', hz: 2000}}}},
    {command: 'instrument', edit: {kind: 'torus', edit: {carrier: 0.504}}},
  ])
  // A value the owner refuses by its own law comes back named, never thrown.
  assert.deepEqual(await rate.apply(0), {ok: false, error: 'Rate runs from one step a year to 40,000 steps a second.'})
  // An accepted torus edit clears the refusals of the targets it moved.
  assert.deepEqual(targets.mapTargetIdsOfEdit({kind: 'torus', edit: {rate: {mode: 'free', steps_per_second: 4}, carrier: 0.5}}), ['rate', 'carrier'])
  assert.deepEqual(targets.mapTargetIdsOfEdit({kind: 'torus', edit: {fundamental: {source: 'map'}, tuning: 'sky'}}), ['fundamental'])
  assert.deepEqual(targets.mapTargetIdsOfEdit({kind: 'damping', q_factor: 40}), [])
  // O-I #852: the body chosen on the Body page is no map target.
  assert.deepEqual(targets.mapTargetIdsOfEdit({kind: 'body', body: {modes: 8, q_factor: 12, material: 'declared'}}), [])
  // No session, or an owner that takes no edit now: nothing of the Torus is offered.
  session({state: okState()})
  assert.equal(targets.mapTargets(torus.liveTorusState(), []).some(t => ['rate', 'fundamental', 'carrier'].includes(t.id)), false)
  session({state: {...okState(determinants(), parameters({torus: torusSession()})), value: reading('manual')}})
  assert.equal(targets.mapTargets(torus.liveTorusState(), []).some(t => ['rate', 'fundamental', 'carrier'].includes(t.id)), false)
  teardown()
})

test('on the chain in map mode the Torus\'s Rate, Fundamental and Carrier open for a mapping; Damping stands dimmed, naming why it is not one', () => {
  session({state: okState(determinants(), parameters({torus: torusSession()}))})
  hold.setMapMode('midi')
  const rack = renderToStaticMarkup(createElement(onChain.TorusOnChain, {state: torus.liveTorusState()}))
  for (const id of ['rate', 'fundamental', 'carrier']) {
    assert.match(rack, new RegExp(`data-midi-target="${id}"[^>]*data-midi-open="yes"[^>]*data-midi-unmapped="no"`), `${id}: open for a mapping`)
  }
  assert.match(rack, /data-midi-target="damping"[^>]*data-midi-open="yes"[^>]*data-midi-unmapped="yes"/, 'Damping: dimmed')
  assert.match(rack, /data-midi-unmapped-why="damping"[^>]*>Damping is not mappable yet: the owner keeps the decay rate, not the Q you set/)
  hold.setMapMode('off')
  const off = renderToStaticMarkup(createElement(onChain.TorusOnChain, {state: torus.liveTorusState()}))
  assert.doesNotMatch(off, /data-midi-unmapped-why/, 'with the map off it says nothing')
  teardown()
})

test('when the owner states no determinants, no instrument determinant is offered, and the sound and level still are', () => {
  session({state: {...okState(), determinants: null}})
  const offered = targets.mapTargets(torus.liveTorusState(), []).map(t => t.id)
  assert.equal(offered.some(id => ['lens', 'context-frame', 'harmonic-basis', 'm3-transcription'].includes(id)), false)
  assert.ok(offered.includes('sound') && offered.includes('level'))
  teardown()
})

test('applying a value to an instrument parameter goes to the owner\'s writer, and the owner\'s refusal comes back named', async () => {
  session({write: async command => command.edit.kind === 'lens' ? {ok: false, error: 'The owner keeps lens L0 while a scene is held'} : {ok: true}})
  const lens = targets.mapTargets(torus.liveTorusState(), []).find(t => t.id === 'lens')
  assert.deepEqual(await model.applyMapValue(lens, '7'), {ok: false, error: 'The owner keeps lens L0 while a scene is held'})
  const level = targets.mapTargets(torus.liveTorusState(), []).find(t => t.id === 'level')
  assert.deepEqual(await model.applyMapValue(level, 2.5), {ok: true})
  teardown()
})

test('the owner\'s instrument edits carry the value the map chose: lens, sound, level and cadence', async () => {
  const sent = session()
  const byId = id => targets.mapTargets(torus.liveTorusState(), []).find(t => t.id === id)
  await model.applyMapValue(byId('lens'), '7')
  await model.applyMapValue(byId('sound'), true)
  await model.applyMapValue(byId('level'), 2.5)
  await model.applyMapValue(byId('cadence'), '12')
  assert.deepEqual(sent, [
    {command: 'instrument', edit: {kind: 'lens', lens12: 7}},
    {command: 'instrument', edit: {kind: 'muted', muted: false}},
    {command: 'instrument', edit: {kind: 'level', value: 2.5}},
    {command: 'instrument', edit: {kind: 'cadence', rate: 12}},
  ])
  teardown()
})

test('the Scale tie writes through the note-device setter, not the owner', async () => {
  session()
  const device = chain.addNoteDevice('scale')
  const tie = targets.mapTargets(torus.liveTorusState(), chain.noteDeviceChain()).find(t => t.id === `note-device:${device.id}:tie`)
  assert.deepEqual(await model.applyMapValue(tie, 'down'), {ok: true})
  assert.equal(chain.noteDeviceChain()[0].params.tie, 'down')
  teardown()
})

// ── 4 — the hold: arming, binding, removing, and the modes ──────────────────────

test('the map starts off; each mode is entered by its toggle, leaves on the second press, and leaving disarms', () => {
  session()
  assert.equal(hold.midiMapState().mode, 'off')
  hold.setMapMode('midi')
  assert.equal(hold.midiMapState().mode, 'midi')
  assert.match(hold.midiMapState().notice, /Click a parameter, then move a hardware control/)
  hold.clickMapTarget('lens', targets.readMapTargets())
  assert.equal(hold.midiMapState().armed, 'lens')
  hold.leaveMapMode()
  assert.equal(hold.midiMapState().mode, 'off')
  assert.equal(hold.midiMapState().armed, null, 'leaving disarms')
  assert.equal(hold.midiMapState().notice, null)
  teardown()
})

test('a click arms an unmapped parameter; in key map mode a range is not armed and is named', () => {
  session()
  hold.setMapMode('key')
  hold.clickMapTarget('level', targets.readMapTargets())
  assert.equal(hold.midiMapState().armed, null)
  assert.match(hold.midiMapState().notice, /a key cannot step it/)
  hold.clickMapTarget('sound', targets.readMapTargets())
  assert.equal(hold.midiMapState().armed, 'sound', 'a toggle takes a key')
  teardown()
})

test('a control binds the armed parameter and it stays armed; a second control replaces the binding', () => {
  session()
  hold.setMapMode('midi')
  hold.clickMapTarget('lens', targets.readMapTargets())
  hold.bindArmed(CC_SOURCE(74), targets.readMapTargets())
  assert.deepEqual(hold.midiMapState().bindings, [{target: 'lens', source: CC_SOURCE(74)}])
  assert.equal(hold.midiMapState().armed, 'lens', 'still armed, so the next control replaces')
  hold.bindArmed(CC_SOURCE(75), targets.readMapTargets())
  assert.deepEqual(hold.midiMapState().bindings, [{target: 'lens', source: CC_SOURCE(75)}], 'a second CC replaces the first')
  assert.match(hold.midiMapState().notice, /CC 75 · channel 1 · Pads replaced to Lens/)
  teardown()
})

test('the same control again on the same parameter changes nothing: the map state is not re-committed, so a busy knob does not re-render it', () => {
  session()
  hold.setMapMode('midi')
  hold.clickMapTarget('lens', targets.readMapTargets())
  hold.bindArmed(CC_SOURCE(74), targets.readMapTargets())
  const before = hold.midiMapState()
  hold.bindArmed(CC_SOURCE(74), targets.readMapTargets())
  hold.bindArmed(CC_SOURCE(74), targets.readMapTargets())
  assert.equal(hold.midiMapState(), before, 'the same state object: nothing was committed')
  teardown()
})

test('a control with nothing armed binds nothing and says so; a key in midi mode and a control in key mode bind nothing', () => {
  session()
  hold.setMapMode('midi')
  hold.bindArmed(CC_SOURCE(74), targets.readMapTargets())
  assert.deepEqual(hold.midiMapState().bindings, [])
  assert.match(hold.midiMapState().notice, /Click a parameter first/)
  hold.clickMapTarget('lens', targets.readMapTargets())
  hold.bindArmed({kind: 'key', key: 'x'}, targets.readMapTargets())
  assert.deepEqual(hold.midiMapState().bindings, [], 'a key does not bind in midi mode')
  hold.setMapMode('key')
  hold.clickMapTarget('lens', targets.readMapTargets())
  hold.bindArmed(CC_SOURCE(74), targets.readMapTargets())
  assert.deepEqual(hold.midiMapState().bindings, [], 'a control does not bind in key mode')
  teardown()
})

test('a click on a mapped parameter removes its mapping, and Delete removes the armed one', () => {
  session()
  hold.setMapMode('midi')
  hold.clickMapTarget('lens', targets.readMapTargets())
  hold.bindArmed(CC_SOURCE(74), targets.readMapTargets())
  hold.clickMapTarget('lens', targets.readMapTargets())
  assert.deepEqual(hold.midiMapState().bindings, [], 'the same click on a mapped parameter removes it')
  hold.clickMapTarget('sound', targets.readMapTargets())
  hold.bindArmed(CC_SOURCE(76), targets.readMapTargets())
  hold.removeArmedMapping(targets.readMapTargets())
  assert.deepEqual(hold.midiMapState().bindings, [], 'Delete removes the armed mapping')
  hold.clickMapTarget('sound', targets.readMapTargets())
  hold.removeArmedMapping(targets.readMapTargets())
  assert.match(hold.midiMapState().notice, /has no mapping to remove/)
  teardown()
})

test('a source moved from one parameter to another is named in the notice', () => {
  session()
  hold.setMapMode('midi')
  hold.clickMapTarget('lens', targets.readMapTargets())
  hold.bindArmed(CC_SOURCE(74), targets.readMapTargets())
  hold.clickMapTarget('level', targets.readMapTargets())
  hold.bindArmed(CC_SOURCE(74), targets.readMapTargets())
  assert.deepEqual(hold.midiMapState().bindings, [{target: 'level', source: CC_SOURCE(74)}])
  assert.match(hold.midiMapState().notice, /moved from Lens/)
  teardown()
})

test('a key pressed in key map mode maps the key; a named or A–J key is refused by name', () => {
  session()
  hold.setMapMode('key')
  hold.clickMapTarget('sound', targets.readMapTargets())
  hold.pressMapKey('a', targets.readMapTargets())
  assert.deepEqual(hold.midiMapState().bindings, [], 'the A–J row is not mapped')
  assert.match(hold.midiMapState().notice, /plays the keyboard/)
  hold.pressMapKey('p', targets.readMapTargets())
  assert.deepEqual(hold.midiMapState().bindings, [{target: 'sound', source: {kind: 'key', key: 'p'}}])
  teardown()
})

test('refusals are kept per parameter and cleared by the next accepted write', () => {
  session()
  hold.setMapRefusal('lens', 'The owner refuses lens 9 in this state')
  assert.equal(hold.midiMapState().refusals.lens, 'The owner refuses lens 9 in this state')
  hold.setMapRefusal('lens', null)
  assert.equal(hold.midiMapState().refusals.lens, undefined)
  teardown()
})

test('the mappings are held in this module for the session: no browser storage, and no write to the set document', async () => {
  const source = await readFile(new URL('../src/live/midiMap/midiMapHold.ts', import.meta.url), 'utf8')
  const router_source = await readFile(new URL('../src/live/midiMap/midiMapRouter.ts', import.meta.url), 'utf8')
  for (const text of [source, router_source]) {
    assert.doesNotMatch(text, /localStorage|sessionStorage|indexedDB/, 'never browser storage')
    assert.doesNotMatch(text, /commitSet|setDocument|document write/i, 'the set document has no owner write here')
  }
})

// ── 5 — the router: one owner edit per frame, sent only when it changes ─────────

test('control changes coalesce per frame: a knob moved three times in one frame is one owner edit, with its latest value', async () => {
  const sent = []
  const frame = clock()
  const refusals = []
  const map = router.createMapRouter({
    read: () => ({mode: 'off', bindings: [{target: 'lens', source: CC_SOURCE(74)}]}),
    targets: () => targets.mapTargets(okState(), []),
    apply: async (target, value) => { sent.push([target.id, value]); return {ok: true} },
    refusal: (id, error) => refusals.push([id, error]),
    schedule: frame.schedule,
  })
  map.control([CC(74, 10)])
  map.control([CC(74, 60)])
  map.control([CC(74, 100)])
  assert.equal(sent.length, 0, 'nothing is sent before the frame')
  assert.equal(frame.waiting(), 1, 'one frame is scheduled for the three')
  frame.frame()
  await tick()
  const lensOptions = targets.mapTargets(okState(), []).find(t => t.id === 'lens').options
  assert.deepEqual(sent, [['lens', lensOptions[model.choiceIndex(100, 12)].value]], 'one send, the latest value')
})

test('a mapped value that has not changed sends nothing: a knob that holds still is quiet', async () => {
  const sent = []
  const frame = clock()
  const map = router.createMapRouter({
    read: () => ({mode: 'off', bindings: [{target: 'level', source: CC_SOURCE(7)}]}),
    targets: () => targets.mapTargets(okState(), []),
    apply: async (target, value) => { sent.push(value); return {ok: true} },
    refusal: () => {},
    schedule: frame.schedule,
  })
  map.control([CC(7, 64)])
  frame.frame()
  await tick()
  map.control([CC(7, 64)])
  frame.frame()
  await tick()
  assert.equal(sent.length, 1, 'the same control value again sends nothing')
  map.control([CC(7, 127)])
  frame.frame()
  await tick()
  assert.deepEqual(sent, [2, 4])
})

test('an accepted mapped write is told as a move of its parameter, with the value it stood at; a refused one is not (O-I 853)', async () => {
  const frame = clock()
  const moved = []
  let refuse = false
  const map = router.createMapRouter({
    read: () => ({mode: 'off', bindings: [{target: 'level', source: CC_SOURCE(7)}]}),
    targets: () => targets.mapTargets(okState(), []),
    apply: async () => refuse ? {ok: false, error: 'The owner holds the level'} : {ok: true},
    refusal: () => {},
    moved: (target, value, before) => moved.push([target.id, target.writer, value, before]),
    schedule: frame.schedule,
  })
  const before = targets.mapTargets(okState(), []).find(t => t.id === 'level').current
  map.control([CC(7, 64)])
  frame.frame()
  await tick()
  assert.deepEqual(moved, [['level', 'owner', 2, before]], 'the move, from where the owner read it as the write was sent')
  refuse = true
  map.control([CC(7, 127)])
  frame.frame()
  await tick()
  assert.equal(moved.length, 1, 'a refused write moved nothing')
})

test('a lane\'s value goes through its parameter\'s own write, refused in words when it is not one of the parameter\'s values', async () => {
  const sent = session()
  const hows = []
  const off = torus.subscribeAcceptedLiveWrites((_command, how) => hows.push(how.hand === true))
  const list = targets.readMapTargets()
  assert.deepEqual(await targets.writeMapTarget('level', 2, list), {ok: true})
  assert.deepEqual(sent.at(-1), {command: 'instrument', edit: {kind: 'level', value: 2}}, 'the Level\'s own owner edit')
  const lens = list.find(t => t.id === 'lens')
  assert.deepEqual(await targets.writeMapTarget('lens', lens.options[0].value, list), {ok: true})
  assert.deepEqual(await model.applyMapValue(list.find(t => t.id === 'level'), 3), {ok: true})
  off()
  assert.deepEqual(hows, [false, false, true], 'a lane played again is no hand\'s write (a Lens it moves leaves Follow on); a mapped control\'s is the hand\'s')
  sent.splice(-2)
  assert.deepEqual(await targets.writeMapTarget('level', 9, list), {ok: false, error: 'Level takes a value from 0 to 4.'})
  assert.deepEqual(await targets.writeMapTarget('sound', 1, list), {ok: false, error: 'Sound is on or off.'})
  assert.deepEqual(await targets.writeMapTarget('cadence', 'often', list), {ok: false, error: 'Tick cadence has no choice "often".'})
  assert.deepEqual(await targets.writeMapTarget('gone', 1, list), {ok: false, error: 'gone is not on the surface now, so its lane moves nothing.'})
  assert.equal(sent.length, 1, 'nothing refused reached the owner')
  teardown()
})

test('in a map mode, control changes move nothing: the input arms and binds, and the value is left as it was', async () => {
  const sent = []
  const frame = clock()
  const map = router.createMapRouter({
    read: () => ({mode: 'midi', bindings: [{target: 'lens', source: CC_SOURCE(74)}]}),
    targets: () => targets.mapTargets(okState(), []),
    apply: async () => { sent.push(1); return {ok: true} },
    refusal: () => {},
    schedule: frame.schedule,
  })
  map.control([CC(74, 90)])
  frame.frame()
  await tick()
  assert.equal(sent.length, 0)
})

test('a key steps its bound choice once per press from the owner\'s value, and a key bound to a toggle flips it', async () => {
  const sent = []
  const bindings = [{target: 'cadence', source: {kind: 'key', key: 'c'}}, {target: 'sound', source: {kind: 'key', key: 'm'}}]
  const map = router.createMapRouter({
    read: () => ({mode: 'off', bindings}),
    targets: () => targets.mapTargets(okState(), []),
    apply: async (target, value) => { sent.push([target.id, value]); return {ok: true} },
    refusal: () => {},
    schedule: () => {},
  })
  assert.equal(map.key('c'), true)
  await tick()
  assert.deepEqual(sent, [['cadence', '12']], 'the owner states 1 tick/s, so the next option is 12 ticks/s')
  assert.equal(map.key('m'), true)
  await tick()
  assert.deepEqual(sent.at(-1), ['sound', true], 'the sound is muted in the owner reading, so the key turns it on')
  assert.equal(map.key('z'), false, 'an unbound key is not taken')
})

test('a refused write is named on its parameter, and the same control at the same value is sent again after the refusal', async () => {
  const frame = clock()
  const sent = []
  const refused = []
  const map = router.createMapRouter({
    read: () => ({mode: 'off', bindings: [{target: 'sound', source: CC_SOURCE(9)}]}),
    targets: () => targets.mapTargets(okState(), []),
    apply: async (target, value) => { sent.push(value); return sent.length === 1 ? {ok: false, error: 'The owner refuses sound in this state'} : {ok: true} },
    refusal: (id, error) => refused.push([id, error]),
    schedule: frame.schedule,
  })
  map.control([CC(9, 127)])
  frame.frame()
  await tick(); await tick()
  assert.deepEqual(refused, [['sound', 'The owner refuses sound in this state']], 'the refusal is named, not swallowed')
  map.control([CC(9, 127)])
  frame.frame()
  await tick()
  assert.equal(sent.length, 2, 'after a refusal the same value is sent again')
  assert.deepEqual(refused.at(-1), ['sound', null], 'and the accepted write clears the refusal')
})

test('a rebound parameter is sent afresh: forgetting it clears its last value', async () => {
  const frame = clock()
  const sent = []
  const map = router.createMapRouter({
    read: () => ({mode: 'off', bindings: [{target: 'sound', source: CC_SOURCE(9)}]}),
    targets: () => targets.mapTargets(okState(), []),
    apply: async (target, value) => { sent.push(value); return {ok: true} },
    refusal: () => {},
    schedule: frame.schedule,
  })
  map.control([CC(9, 127)])
  frame.frame()
  await tick()
  map.forget('sound')
  map.control([CC(9, 127)])
  frame.frame()
  await tick()
  assert.equal(sent.length, 2)
})

// ── 6 — the key route and the faces ───────────────────────────────────────────────

test('the computer keyboard routes by the map mode: Escape leaves, Delete removes, keys bind in key mode, bound keys step outside it, and the A–J row is never a map', () => {
  assert.equal(controls.mapKeyRoute({key: 'Escape', editable: false, modifier: false, repeat: false, live: true}, 'midi'), 'leave')
  assert.equal(controls.mapKeyRoute({key: 'Escape', editable: false, modifier: false, repeat: false, live: true}, 'off'), 'step', 'Escape outside a map mode goes to the router, which has no binding for it (named keys are never mapped)')
  assert.equal(controls.mapKeyRoute({key: 'Delete', editable: false, modifier: false, repeat: false, live: true}, 'key'), 'remove')
  assert.equal(controls.mapKeyRoute({key: 'p', editable: false, modifier: false, repeat: false, live: true}, 'key'), 'press')
  assert.equal(controls.mapKeyRoute({key: 'p', editable: false, modifier: false, repeat: false, live: true}, 'off'), 'step')
  assert.equal(controls.mapKeyRoute({key: 'p', editable: false, modifier: false, repeat: false, live: true}, 'midi'), 'ignore', 'a MIDI map takes no key')
  assert.equal(controls.mapKeyRoute({key: 'p', editable: true, modifier: false, repeat: false, live: true}, 'key'), 'ignore', 'typing in a field never maps')
  assert.equal(controls.mapKeyRoute({key: 'p', editable: false, modifier: true, repeat: false, live: true}, 'off'), 'ignore', 'a modifier keeps its own meaning')
  assert.equal(controls.mapKeyRoute({key: 'p', editable: false, modifier: false, repeat: true, live: true}, 'off'), 'ignore', 'a held key is one press')
})

test('the transport\'s Key and MIDI slots are real toggles with the grammar\'s meanings, and the map line says the mappings are held for the session', () => {
  session()
  const off = renderToStaticMarkup(createElement(controls.MidiMapToggles))
  assert.match(off, /aria-label="MIDI mapping"[^>]*aria-pressed="false"/)
  assert.match(off, /data-i="MIDI map\|bind MIDI controls"/)
  assert.match(off, /data-i="Key map\|bind computer keys to controls"/)
  assert.doesNotMatch(off, /midi-map-line/, 'no line outside a map mode')
  hold.setMapMode('midi')
  const on = renderToStaticMarkup(createElement(controls.MidiMapToggles))
  assert.match(on, /aria-label="MIDI mapping"[^>]*aria-pressed="true"/)
  assert.match(on, /Held for this session only: the set document has no owner write for mappings/)
  // REPLACED (DLW build ruling 2026-11-05, O-I 853 round 18): was /automation owner/, the line saying recording a mapping as automation
  // waited on an owner. Under Arm a take now records a mapped move on its parameter's lane (live/liveTake.ts), and the line says how.
  assert.match(on, /Arm, then Record: each move of a mapped control lies on its parameter(?:'|&#x27;)s lane in the take\./)
  teardown()
})

test('a mapped parameter shows its marker with the map off; in map mode its frame is open, and the armed one is marked', () => {
  session()
  hold.setMapMode('midi')
  hold.clickMapTarget('lens', targets.readMapTargets())
  hold.bindArmed(CC_SOURCE(74), targets.readMapTargets())
  const armed = renderToStaticMarkup(createElement(controls.MidiMapTarget, {id: 'lens'}, createElement('span', null, 'Lens')))
  assert.match(armed, /data-midi-target="lens"[^>]*data-midi-open="yes"[^>]*data-midi-armed="yes"[^>]*data-midi-mapped="yes"/)
  assert.match(armed, /data-midi-mark="lens"[^>]*>CC 74</)
  hold.leaveMapMode()
  const shut = renderToStaticMarkup(createElement(controls.MidiMapTarget, {id: 'lens'}, createElement('span', null, 'Lens')))
  assert.match(shut, /data-midi-open="no"[^>]*data-midi-armed="no"[^>]*data-midi-mapped="yes"/)
  assert.match(shut, /CC 74/, 'the marker shows with the map off')
  teardown()
})

test('the owner\'s refusal shows on the parameter, not only in the section that wrote it', () => {
  session()
  hold.setMapRefusal('sound', 'The owner refuses the sound in this state')
  const markup = renderToStaticMarkup(createElement(controls.MidiMapTarget, {id: 'sound'}, createElement('span', null, 'Sound')))
  assert.match(markup, /data-midi-refusal="sound"[^>]*role="alert"|role="alert"[^>]*data-midi-refusal="sound"/)
  assert.match(markup, /Refused by the owner: The owner refuses the sound in this state/)
  teardown()
})

test('the instrument section, the torus device on the chain and the Scale tie frame their parameters, and map mode opens each frame', () => {
  session()
  chain.addNoteDevice('scale')
  hold.setMapMode('midi')
  const state = torus.liveTorusState()
  const expanded = renderToStaticMarkup(createElement(section.LiveInstrumentSectionView, {state}))
  for (const id of ['lens', 'context-frame', 'harmonic-basis', 'm3-transcription', 'cadence', 'sound', 'level', 'scale-units']) {
    assert.match(expanded, new RegExp(`data-midi-target="${id}"[^>]*data-midi-open="yes"`), `expanded: ${id} is framed`)
  }
  const rack = renderToStaticMarkup(createElement(onChain.TorusOnChain, {state}))
  // O-I #850: the chain's compact draws the manual's four macros (Rate, Fundamental, Carrier, Damping, DLW §21.2), so the chain frames
  // those; the determinants keep their frames, by the same ids, in the instrument section above and the design's whole.
  assert.match(rack, /data-midi-target="rate"[^>]*data-midi-open="yes"/, 'chain: a macro of the torus device is framed')
  const devices = chain.noteDeviceChain()
  const tieChain = renderToStaticMarkup(createElement(noteChain.NoteDeviceChainView, {devices, mode: {state: 'waiting', selection: null, line: 'waiting'}}))
  assert.match(tieChain, new RegExp(`data-midi-target="note-device:${devices[0].id}:tie"`), 'the Scale tie is framed')
  teardown()
})

test('with the map off a faced parameter is unframed in its open state, and the owner\'s reading and writes are unchanged', () => {
  session()
  const markup = renderToStaticMarkup(createElement(section.LiveInstrumentSectionView, {state: torus.liveTorusState()}))
  assert.doesNotMatch(markup, /data-midi-open="yes"/)
  assert.match(markup, /data-live-param="lens"/, 'the owner\'s row is still drawn')
  assert.match(markup, /aria-label="Lens"/)
  teardown()
})

test('the grammar still names the two slots the toggles take', () => {
  assert.equal(grammar.slotMeaning('live', 'key-map').label, 'Key map')
  assert.equal(grammar.slotMeaning('live', 'midi-map').label, 'MIDI map')
})

// ── 7 — the review's third wave: refusals, the session tie, the owner's reading, the focus gate, the idle host ──────

const reachRouter = (read, frame, deps = {}) => router.createMapRouter({
  read, targets: targets.readMapTargets, apply: model.applyMapValue, refusal: hold.setMapRefusal, schedule: frame.schedule, ...deps,
})
const liveRead = () => ({mode: hold.midiMapState().mode, bindings: hold.midiMapState().bindings})

test('a refusal clears when its mapping is removed, replaced or moved away, and it is named only while its parameter is mapped', async () => {
  session({write: async command => command.edit.kind === 'lens' ? {ok: false, error: 'The owner refuses lens 9 in this state'} : {ok: true}})
  const frame = clock()
  const live = reachRouter(liveRead, frame)
  hold.setMapMode('midi')
  hold.clickMapTarget('lens', targets.readMapTargets())
  hold.bindArmed(CC_SOURCE(74), targets.readMapTargets())
  hold.leaveMapMode()
  live.control([CC(74, 100)]); frame.frame(); await tick(); await tick()
  assert.equal(hold.midiMapState().refusals.lens, 'The owner refuses lens 9 in this state', 'the refused mapped write is named')
  hold.setMapMode('midi')
  hold.clickMapTarget('lens', targets.readMapTargets())
  assert.equal(hold.midiMapState().refusals.lens, undefined, 'removing the mapping clears its refusal')
  hold.leaveMapMode()
  hold.setMapMode('midi')
  hold.clickMapTarget('lens', targets.readMapTargets())
  hold.bindArmed(CC_SOURCE(74), targets.readMapTargets())
  hold.leaveMapMode()
  live.control([CC(74, 100)]); frame.frame(); await tick(); await tick()
  assert.equal(hold.midiMapState().refusals.lens !== undefined, true)
  hold.setMapMode('midi')
  hold.clickMapTarget('lens', targets.readMapTargets())
  hold.bindArmed(CC_SOURCE(75), targets.readMapTargets())
  assert.equal(hold.midiMapState().refusals.lens, undefined, 'replacing the mapping clears its refusal')
  hold.leaveMapMode()
  teardown()
})

test('a refusal clears when a source moves away from its parameter, and an unmapped parameter names no refusal', async () => {
  session()
  hold.setMapMode('midi')
  hold.clickMapTarget('lens', targets.readMapTargets())
  hold.bindArmed(CC_SOURCE(74), targets.readMapTargets())
  hold.setMapRefusal('lens', 'The owner refuses lens 9 in this state')
  hold.clickMapTarget('level', targets.readMapTargets())
  hold.bindArmed(CC_SOURCE(74), targets.readMapTargets())
  assert.equal(hold.midiMapState().refusals.lens, undefined, 'the source left lens, so lens is unmapped and its refusal is gone')
  teardown()
})

test('a refused write to a parameter unmapped while in flight names no refusal when it settles', async () => {
  let settle
  session({write: () => new Promise(resolve => { settle = resolve })})
  const frame = clock()
  const live = reachRouter(liveRead, frame)
  hold.setMapMode('midi')
  hold.clickMapTarget('lens', targets.readMapTargets())
  hold.bindArmed(CC_SOURCE(74), targets.readMapTargets())
  hold.leaveMapMode()
  live.control([CC(74, 100)]); frame.frame(); await tick()
  hold.setMapMode('midi')
  hold.clickMapTarget('lens', targets.readMapTargets())
  hold.leaveMapMode()
  settle({ok: false, error: 'late refusal'}); await tick(); await tick()
  assert.equal(hold.midiMapState().refusals.lens, undefined, 'the refusal is named only while the parameter is mapped')
  teardown()
})

test('an accepted write to the parameter by its own face clears its refusal', async () => {
  session({write: async command => command.edit.kind === 'lens' ? {ok: false, error: 'The owner refuses lens 9 in this state'} : {ok: true}})
  const frame = clock()
  const live = reachRouter(liveRead, frame)
  hold.setMapRefusal('lens', 'The owner refuses lens 9 in this state')
  assert.ok(hold.midiMapState().refusals.lens)
  const sentAfter = session()
  assert.deepEqual(await torus.commitLiveInstrumentEdit({kind: 'lens', lens12: 4}), {ok: true}, 'the owner accepts the face\'s own edit')
  assert.equal(hold.midiMapState().refusals.lens, undefined, 'the accepted face write is the newest word on the parameter')
  assert.deepEqual(sentAfter, [{command: 'instrument', edit: {kind: 'lens', lens12: 4}}])
  teardown()
})

test('the Scale tie is a session-held value: its target says so, its map line names it, and its write is never an owner write', async () => {
  const sent = session()
  const device = chain.addNoteDevice('scale')
  const tieId = `note-device:${device.id}:tie`
  const tie = targets.mapTargets(torus.liveTorusState(), chain.noteDeviceChain()).find(t => t.id === tieId)
  assert.equal(tie.writer, 'session')
  assert.equal(targets.mapTargets(torus.liveTorusState(), []).find(t => t.id === 'lens').writer, 'owner')
  hold.setMapMode('midi')
  hold.clickMapTarget(tieId, targets.readMapTargets())
  assert.match(hold.midiMapState().notice, /Held for this session: not an owner write/)
  assert.deepEqual(await model.applyMapValue(tie, 'down'), {ok: true}, 'the session took the value, and says only that')
  assert.equal(chain.noteDeviceChain()[0].params.tie, 'down')
  assert.deepEqual(sent, [], 'the owner received nothing for the tie')
  chain.removeNoteDevice(device.id)
  const gone = await model.applyMapValue(tie, 'up')
  assert.equal(gone.ok, false)
  assert.match(gone.error, /no longer in the note-device chain/, 'a tie whose device is gone is refused by name, never reported as taken')
  teardown()
})

test('a control already at the owner\'s value sends nothing, even after a restart: unchanged is judged against the owner\'s reading', async () => {
  const frame = clock()
  const sent = []
  const map = router.createMapRouter({
    read: () => ({mode: 'off', bindings: [{target: 'lens', source: CC_SOURCE(74)}]}),
    targets: () => targets.mapTargets(okState(), []),
    apply: async (target, value) => { sent.push(value); return {ok: true} },
    refusal: () => {}, schedule: frame.schedule,
  })
  // The owner's lens is 3 (L1′). Control value 40 selects option 3 (40·12/128 = 3.75), so the owner already states it.
  map.control([CC(74, 40)]); frame.frame(); await tick()
  assert.deepEqual(sent, [], 'the first control after a forget, at the owner\'s value, writes nothing')
  map.control([CC(74, 100)]); frame.frame(); await tick()
  assert.deepEqual(sent, ['9'])
  map.control([CC(74, 40)]); frame.frame(); await tick()
  assert.deepEqual(sent, ['9'], 'a return to the owner\'s value is not sent as stale: the last value is the owner\'s own')
  map.control([CC(74, 100)]); frame.frame(); await tick()
  assert.deepEqual(sent, ['9', '9'], 'a change back to a value the owner no longer states is sent again')
})

test('a key step right after an accepted write steps from the newest value the owner accepted, and from the reading once the reading moves', async () => {
  let state = okState()
  const sent = []
  const map = router.createMapRouter({
    read: () => ({mode: 'off', bindings: [{target: 'cadence', source: {kind: 'key', key: 'c'}}]}),
    targets: () => targets.mapTargets(state, []),
    apply: async (target, value) => { sent.push(value); return {ok: true} },
    refusal: () => {}, schedule: () => {},
  })
  // The owner's cadence reads 1 tick/s. The accepted 12 is not yet in the reading: the next press steps from 12, not from the stale 1.
  map.key('c'); await tick(); await tick()
  assert.deepEqual(sent, ['12'])
  map.key('c'); await tick(); await tick()
  assert.deepEqual(sent, ['12', 'hold'], 'from the accepted 12, which wraps to hold')
  // The owner's reading moves to 12 (a recall, or its publish): the reading is the newer word, and the next press steps from it.
  state = okState(determinants(), parameters({cadence: {rate: 12, playing: true, source: '12 ticks/s'}}))
  map.reading()
  map.key('c'); await tick(); await tick()
  assert.deepEqual(sent, ['12', 'hold', 'hold'], 'from the reading 12, which wraps to hold')
})

test('a mapped key fires only while the Live surface has focus, the same gate the Jankó keyboard uses', () => {
  const at = (closest) => ({closest: selector => (closest(selector) ? {} : null)})
  const janko = at(selector => selector.includes('.janko'))
  const body = at(() => false)
  assert.equal(controls.liveSurfaceFocused(janko), true, 'the Jankó keyboard region is the Live surface')
  assert.equal(controls.liveSurfaceFocused(at(selector => selector.includes('.transport-system'))), true, 'the transport is the Live surface')
  assert.equal(controls.liveSurfaceFocused(body), false, 'the page itself takes no mapping')
  assert.equal(controls.liveSurfaceFocused(null), false)
  assert.equal(controls.mapKeyRoute({key: 'p', editable: false, modifier: false, repeat: false, live: false}, 'key'), 'ignore', 'a key map press outside the Live surface is not a mapping')
  assert.equal(controls.mapKeyRoute({key: 'p', editable: false, modifier: false, repeat: false, live: false}, 'off'), 'ignore', 'a bound key outside the Live surface does not step')
  assert.equal(controls.mapKeyRoute({key: 'Delete', editable: false, modifier: false, repeat: false, live: false}, 'key'), 'ignore', 'Delete outside the Live surface removes nothing')
  assert.equal(controls.mapKeyRoute({key: 'Escape', editable: false, modifier: false, repeat: false, live: false}, 'key'), 'leave', 'leaving a map mode is always allowed')
})

test('control changes with the map off and no control binding are dropped before any per-frame work', () => {
  let reads = 0, scheduled = 0, targetReads = 0
  const map = router.createMapRouter({
    read: () => { reads += 1; return {mode: 'off', bindings: [{target: 'sound', source: {kind: 'key', key: 'm'}}]} },
    targets: () => { targetReads += 1; return [] },
    apply: async () => ({ok: true}), refusal: () => {}, schedule: () => { scheduled += 1 },
  })
  map.control([CC(74, 10), CC(75, 20)])
  assert.equal(targetReads, 0, 'no parameter is read')
  assert.equal(scheduled, 0, 'no frame is scheduled')
  assert.equal(model.controlsReach('off', []), false)
  assert.equal(model.controlsReach('off', [{target: 'lens', source: CC_SOURCE(74)}]), true, 'a control binding reaches')
  assert.equal(model.controlsReach('midi', []), true, 'MIDI map mode arms and binds from any control')
  assert.equal(model.controlsReach('key', [{target: 'lens', source: CC_SOURCE(74)}]), false, 'key map mode takes no control')
})
