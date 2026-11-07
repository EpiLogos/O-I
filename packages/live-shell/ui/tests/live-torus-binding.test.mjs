import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'

// Lanes BL and BL2: the Torus on its owner. The catalogue's Torus (torus.tsx, `quaternal-logic:torus`) draws on the native field's own
// announcement (torusDevice.ts torusDesignBinding): its standing is the light, its presentation gain the level in dB, its four
// determinants the labels of the owner's choices, its sound, cadence and scale the owner's; every other key of the design is no
// parameter the owner exposes, so it stands absent and says why. Writes go through the one stage channel, proved here against a fixture
// commander — never the owner's real state. On Live's chain the design stands where the generic plate stood, and MIDI-map mode lights
// the same targets (lane BL2: the place's wrap reaches a design's kit controls by value key). The device's own Full is the torus at pane
// size with the Jankó keyboard under it, deaf to MIDI. Readings are fixtures shaped as the boundary validates them (scripted). Loader as
// live-torus-controls.test.mjs.
const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};
import {readFile} from 'node:fs/promises';
export async function resolve(specifier,context,next){
  try{return await next(specifier,context)}catch(error){
    if(!specifier.startsWith('.'))throw error;
    if(specifier.endsWith('.js')){try{return await next(specifier.slice(0,-3)+'.ts',context)}catch{}}
    for(const suffix of ['.ts','.tsx','/index.ts','/index.tsx']){try{return await next(specifier+suffix,context)}catch{}}
    throw error;
  }
}
export async function load(url,context,next){
  if(url.endsWith('.css'))return {format:'module',shortCircuit:true,source:'export default null'};
  if(url.includes('?raw')||url.endsWith('.html'))return {format:'module',shortCircuit:true,source:'export default ""'};
  if(url.endsWith('.ts')||url.endsWith('.tsx')){
    const source=await readFile(new URL(url).pathname,'utf8');
    const {outputText}=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX},fileName:url});
    return {format:'module',shortCircuit:true,source:outputText.split('import.meta.env').join('({BASE_URL: "/"})')};
  }
  return next(url,context);
}`)}`, {parentURL: import.meta.url})

const noop = () => {}
globalThis.document ??= {getElementById: () => null, createElement: () => ({style: {}, setAttribute: noop, appendChild: noop}), head: {appendChild: noop},
  addEventListener: noop, removeEventListener: noop, querySelector: () => null, querySelectorAll: () => [], documentElement: {style: {}}}
const React = await import('react')
const {renderToStaticMarkup} = await import('react-dom/server')
const h = React.createElement
const instrument = await import('../src/live/torusInstrument.ts')
const model = await import('../src/live/torusDevice.ts')
const onChain = await import('../src/live/TorusOnChain.tsx')
const {torus} = await import('../src/inhabitants/catalogue/panels/torus.tsx')
const {HostedDevice, flushDrafts, setDraft, resetHost, hostState, hostedValues, hostedStanding, namedStanding, setHosted, setHostPage} = await import('../src/frame/devices/deviceHost.tsx')
const {designKey, registerDesignedDevice, unregisterDesignedDevice} = await import('../src/frame/devices/designs.ts')
const {DeviceView, PlacedDevice} = await import('../src/frame/devices/DeviceView.tsx')
const door = await import('../src/frame/devices/deviceDoor.ts')
const kit = await import('../src/inhabitants/sdk/panel.tsx')
const hold = await import('../src/live/midiMap/midiMapHold.ts')
const section = await import('../src/live/LiveInstrumentSection.tsx')
const {genericDevice} = await import('../src/frame/devices/genericDevice.tsx')
const {readFile} = await import('node:fs/promises')

const determinants = (over = {}) => ({lens: {lens12: 11, label: 'L5′'}, contextFrame: 7, harmonic: {selection: 'canonical-basis', index: 3}, rna: false, ...over})
const parameters = (over = {}) => ({muted: false, level: 0.5, scale: {unitsPerMetre: 120, mode: 'domain-follow'}, cadence: {rate: 12, playing: true, source: '12 ticks/s'}, refusal: null, ...over})
const reading = (standing = 'following') => ({schema: 'ql.instrument-reading/v1', standing, reason: null,
  identity: {event_ref: 'controlled:occasion', subject_ref: 's', registry_revision: 'r', geometry_ref: 'g', material_ref: 'm', model_ref: 'd'}})
const state = (standing = 'following', par = parameters()) => ({ok: true, value: reading(standing), determinants: determinants(), parameters: par})
const VIEWS = ['folded', 'compact', 'whole', 'full', 'widget']

test('the device is the design\'s: its family and face make the design\'s key', () => {
  const device = model.torusDevice(state())
  assert.equal(designKey(device.family, device.face.id), torus.id)
  assert.equal(model.TORUS_DESIGN_ID, torus.id)
  assert.equal(device.id, model.TORUS_DEVICE_ID, 'its place on the door is unchanged')
})

test('every key of the design is the owner\'s reading or is absent with its reason; the owner\'s own keys ride along', () => {
  const values = model.torusDesignValues(state())
  // The Rack page's keys are the rack's (qlRack.ts): the rack named absent until it is read, the part in the view's own hand.
  const bound = model.torusDesignBinding(state())
  // The Torus's session keys (O-I #850) wait on the owner's torus-state while the frame announces none, and say so.
  // Receiver (O-I 856) is the owner's once the frame announces where the torus is heard from; a frame that announces none says so.
  for (const key of Object.keys(torus.defaults)) assert.ok(key in values || model.TORUS_ABSENT[key] || (key === 'rack' && bound.standing.rack.disabled) || bound.local[key]
    || /torus-state|announces no receiver/.test(bound.standing[key]?.disabled ?? ''), `${key}: read from the owner, named absent, waiting on the owner's session, or the view's own`)
  // REPLACED (O-I #852): the body was drawn as the torus before any owner named it. What rings is the owner's Torus session's `body` now
  // (QL torus-body), so with no session announced the body waits on torus-state and says so (ql-745-torus-body.test.mjs).
  assert.deepEqual(Object.keys(torus.defaults).filter(key => key in values),
    ['light', 'level', 'lens', 'context-frame', 'harmonic-basis', 'm3-transcription', 'sound', 'cadence', 'scale', 'standing'],
    'the owner reports the light, the level, its four determinants, its sound, cadence and scale, and its standing; with no Torus session announced, nothing else of the design')
  assert.match(bound.standing.body.disabled, /torus-state/, 'what rings waits on the owner\'s session')
  assert.equal('sounding' in values, false, 'sounding: the lit keys are not drawn from the owner, so the binding gives none')
  // The pitch-class Jankó chord is retired (O-I 855): the words name the keyboard's one path and where the sounding notes stand.
  assert.match(model.TORUS_ABSENT.sounding, /^No key is lit from the owner here: .*torus-play.*Notes/, 'sounding: absent with its reason')
  assert.doesNotMatch(model.TORUS_ABSENT.sounding, /playJanko|played voices/, 'sounding: no word of the retired chord')
  assert.equal('driveMod' in torus.defaults, false, 'the drive\'s modulation went with the Drive (manual §21.2 retires it, O-I #850)')
  assert.equal(values.light, 'lit', 'following: the instrument is at work')
  assert.equal(values.level, -6, 'a presentation gain of 0.5 is −6 dB')
  assert.deepEqual([values.lens, values['context-frame'], values['harmonic-basis'], values['m3-transcription']], ['L5′', 'CF7', 'B4', 'DNA'], 'the determinants as the owner labels them')
  assert.deepEqual([values.sound, values.cadence, values.scale, values.standing], [true, '12 ticks/s', 120, 'following'])
  assert.equal(model.torusDesignValues(state('manual')).light, 'dark', 'not following or held: off')
  assert.deepEqual(model.torusDesignValues(null), {}, 'no reading: nothing, never a default')
  assert.deepEqual(model.torusDesignValues({ok: false, fault: 'reading.schema'}), {}, 'a refused reading: nothing')
  assert.equal(model.gainToDb(0), -60, 'silence is the design\'s floor (drawn −∞ dB)')
  assert.equal(model.gainToDb(4), 12, 'the owner\'s top gain stands as the owner reports it')
  assert.equal(model.dbToGain(-6), 0.501)
  assert.equal(model.dbToGain(-60), 0)
  assert.equal(model.dbToGain(20), 4, 'never past the owner\'s 0–4')
})

test('a key the owner does not take is disabled with its reason; while the instrument is not following, every key is', () => {
  const live = model.torusDesignBinding(state())
  // Damping is the body's Q, taken through the stage channel's damping edit (O-I #745 lane N; ql-745-torus-body.test.mjs).
  for (const key of ['level', 'sound', 'cadence', 'scale', 'lens', 'context-frame', 'harmonic-basis', 'm3-transcription', 'damping']) assert.equal(live.writes(key), true, `${key} is the owner's to change`)
  for (const key of ['pan', 'meter']) {
    assert.equal(live.writes(key), false, `${key} has no owner`)
    assert.equal(live.standing[key].disabled, model.TORUS_ABSENT[key])
  }
  // REPLACED (lead's ruling of 4 November, "#850 View kept"): View had no owner and stood absent. It is the pane's own way of drawing,
  // so the hand keeps it, Surface until you choose (manual §21.2), and it never reaches the owner (torus-850.test.mjs).
  assert.equal(live.writes('view'), false, 'view: no owner takes it')
  assert.equal(typeof live.local.view, 'function', 'view: the hand keeps it')
  assert.equal(live.values.view, 'surface')
  // O-I #852: Modes is a form's count, the owner's once it names a form (ql-745-torus-body.test.mjs); here no session names what rings.
  assert.equal(live.writes('modes'), false)
  assert.match(live.standing.modes.disabled, /torus-state/)
  // The Torus's session (O-I #850) is the owner's once the frame announces it; here it announces none, and each says what it waits on.
  // Strike is the session's share of velocity since O-I #854 (QL m1_prime.rs Settings.strike; ql-745-torus-body.test.mjs).
  for (const key of ['rate', 'fundamental', 'carrier', 'tuning', 'shape', 'polyphony', 'notes', 'strike']) {
    assert.equal(live.writes(key), false, key)
    assert.match(live.standing[key].disabled, /torus-state/, `${key}: names the owner op it waits on`)
  }
  assert.equal(live.modulatedBy, undefined, 'nothing names the sky as moving a value it does not move')
  const manual = model.torusDesignBinding(state('manual'))
  assert.equal(manual.writes('level'), false)
  assert.equal(manual.standing.level.disabled, 'The owner takes edits only while the instrument follows or is held.')
  const noScene = model.torusDesignBinding(state('following', parameters({cadence: null})))
  assert.equal(noScene.standing.cadence.disabled, 'No scene is open, so there is no cadence to set.')
})

test('a change leaves through the one stage channel, in the owner\'s own form; a refusal comes back in the owner\'s words', async () => {
  const sent = []
  let refuse = null
  instrument.setLiveInstrumentCommander(async command => { sent.push(command); return refuse ? {ok: false, error: refuse} : {ok: true} })
  try {
    const binding = model.torusDesignBinding(state())
    resetHost(binding.id)
    setDraft(binding.id, 'level', -12)
    setDraft(binding.id, 'lens', 'L2')
    assert.equal(await flushDrafts(binding, 1), null)
    assert.deepEqual(sent, [{command: 'instrument', edit: {kind: 'level', value: 0.251}}, {command: 'instrument', edit: {kind: 'lens', lens12: 4}}],
      'the level as the owner\'s gain, the lens as the owner\'s index')
    refuse = 'the instrument is held'
    setDraft(binding.id, 'sound', false)
    assert.equal(await flushDrafts(binding, 1), 'the instrument is held')
    assert.deepEqual(sent.at(-1), {command: 'instrument', edit: {kind: 'muted', muted: true}})
    setDraft(binding.id, 'strike', 30)
    assert.equal(await flushDrafts(binding, 1), 'A reading: the owner reports it; nothing here changes it.', 'a key with no owner never reaches the channel')
    assert.equal(sent.length, 3)
    assert.throws(() => model.torusRowChanges([{key: 'pulseMix', value: 40}]), /pulseMix: no parameter of the owner's instrument/, 'a retired control has no owner (O-I #850)')
  } finally { instrument.setLiveInstrumentCommander(null); resetHost(model.TORUS_DEVICE_ID) }
})

// O-I 856 (manual §21.2 View: "Receiver On makes your camera the place where the torus is heard"; Rules: "A camera move does not change the
// sound, unless Receiver is On"): Receiver is the owner's receiving context, announced as parameters.receiver and written as the stage
// channel's receiver edit. The binding shows the owner's On or Off, its refusal in its words, and never a place.
test('Receiver is the owner\'s: On or Off as the frame announces it, written through the one stage channel, a refusal in the owner\'s words', async () => {
  assert.equal('receiver' in model.TORUS_ABSENT, false, 'the camera is now a place the torus is heard from')
  const announced = receiver => state('following', parameters({receiver}))
  const off = model.torusDesignBinding(announced({on: false, context: 'world', refusal: null}))
  assert.equal(off.values.receiver, false)
  assert.equal(off.writes('receiver'), true)
  assert.equal(off.standing.receiver, undefined, 'nothing stands in its way')
  const on = model.torusDesignBinding(announced({on: true, context: 'personal', refusal: null}))
  assert.equal(on.values.receiver, true)
  const refused = model.torusDesignBinding(announced({on: false, context: 'world', refusal: 'no torus here'}))
  assert.deepEqual(refused.standing.receiver, {refused: 'no torus here'}, 'the owner\'s refusal, in its words')
  const none = model.torusDesignBinding(state())
  assert.equal(none.writes('receiver'), false)
  assert.match(none.standing.receiver.disabled, /announces no receiver/, 'a frame that announces none says so')
  assert.equal('receiver' in none.values, false, 'and gives no value')
  const manual = model.torusDesignBinding(state('manual', parameters({receiver: {on: false, context: 'world', refusal: null}})))
  assert.equal(manual.standing.receiver.disabled, 'The owner takes edits only while the instrument follows or is held.')
  const sent = []
  let refuse = null
  instrument.setLiveInstrumentCommander(async command => { sent.push(command); return refuse ? {ok: false, error: refuse} : {ok: true} })
  try {
    resetHost(off.id)
    setDraft(off.id, 'receiver', true)
    assert.equal(await flushDrafts(off, 1), null)
    assert.deepEqual(sent, [{command: 'instrument', edit: {kind: 'receiver', on: true}}], 'On is the owner\'s receiver edit: no place leaves the shell')
    refuse = 'native owner busy: where the Torus is heard from was not set'
    resetHost(on.id)
    setDraft(on.id, 'receiver', false)
    assert.equal(await flushDrafts(on, 1), refuse, 'Off refused: the owner\'s words')
    assert.deepEqual(sent.at(-1), {command: 'instrument', edit: {kind: 'receiver', on: false}})
    await assert.rejects(model.torusReceiver(announced({on: false, context: 'world', refusal: null}), async () => ({ok: true})).write({key: 'receiver', value: 'on'}), /On or Off/)
  } finally { instrument.setLiveInstrumentCommander(null); resetHost(model.TORUS_DEVICE_ID) }
})

// O-I #856 (QL-MEF #383; manual §21.2 Receiver): Shared shares where you stand under a reference, and Return goes back to a context where it
// last stood. Both are the owner's, through the one stage channel; the reference reads back while the place is shared, and a reference the
// owner does not admit is refused in its words.
test('Receiver Shared and Return are the owner\'s: a reference or a context through the one stage channel, the reference read back, a refusal in QL\'s words', async () => {
  const announced = receiver => state('following', parameters({receiver}))
  const shared = model.torusDesignBinding(announced({on: true, context: 'shared', shared: 'room-7', refusal: null}))
  assert.deepEqual([shared.values.receiver, shared.values['receiver.shared']], [true, 'room-7'], 'the place is shared under its reference')
  for (const key of ['receiver.shared', 'receiver.return']) assert.equal(shared.writes(key), true, key)
  const personal = model.torusDesignBinding(announced({on: true, context: 'personal', refusal: null}))
  assert.equal(personal.values['receiver.shared'], '', 'where you stand is shared under no reference')
  const none = model.torusDesignBinding(state())
  for (const key of ['receiver.shared', 'receiver.return']) {
    assert.equal(none.writes(key), false, key)
    assert.match(none.standing[key].disabled, /announces no receiver/, key)
  }
  const refused = model.torusDesignBinding(announced({on: false, context: 'world', refusal: 'no shared receiving context has been entered: share a place first'}))
  assert.deepEqual(refused.standing['receiver.return'], {refused: 'no shared receiving context has been entered: share a place first'}, 'the owner\'s refusal stands on the act it refused too')
  const sent = []
  const r = model.torusReceiver(announced({on: false, context: 'world', refusal: null}), async edit => { sent.push(edit); return {ok: true} })
  await r.write({key: 'receiver.shared', value: 'room-7'})
  await r.write({key: 'receiver.return', value: 'personal'})
  assert.deepEqual(sent, [{kind: 'receiver', on: true, shared: 'room-7'}, {kind: 'receiver', context: 'personal'}])
  await assert.rejects(r.write({key: 'receiver.return', value: 'mine'}), /^Error: Return goes back to the world's, to where you stood, or to the shared place\.$/)
  await assert.rejects(r.write({key: 'receiver.shared', value: 7}), /^Error: A shared place is named by its reference, as text\.$/)
  const words = 'a shared receiving context is named by a reference of 1 to 128 characters with no space'
  await assert.rejects(model.torusReceiver(announced({on: true, context: 'personal', refusal: null}), async () => ({ok: false, error: words})).write({key: 'receiver.shared', value: 'room 7'}),
    new RegExp(`^Error: ${words}$`), 'the owner judges the reference, in its words')
})

test('the design draws its five views on the owner\'s reading: the bare ring naming what is missing, the level, nothing invented', () => {
  const binding = model.torusDesignBinding(state())
  resetHost(binding.id)
  try {
    for (const page of ['field', 'body']) {
      setHostPage(binding.id, page)
      for (const view of VIEWS) {
        const markup = renderToStaticMarkup(h(HostedDevice, {designed: torus, binding, view, nav: {}}))
        assert.doesNotMatch(markup, /NaN|undefined/, `${view} (${page}): nothing drawn from a missing reading`)
        assert.doesNotMatch(markup, /data-device-fault/, `${view} (${page}): the design's own view draws`)
      }
    }
    // No reading at all: every control stands with no value, and still nothing reads NaN or undefined.
    for (const view of VIEWS) assert.doesNotMatch(renderToStaticMarkup(h(HostedDevice, {designed: torus, binding: model.torusDesignBinding(null), view, nav: {}})), /NaN|undefined/, `${view}: no reading`)
    setHostPage(binding.id, 'field')
    const compact = renderToStaticMarkup(h(HostedDevice, {designed: torus, binding, view: 'compact', nav: {}}))
    // O-I #850: the torus is drawn from the owner's figure; without a session there is none, and the ring says so.
    assert.match(compact, /No reading of the figure/, 'without the figure the ring stands bare and says so')
    assert.doesNotMatch(compact, /data-shape="dot"/, 'no handle on a reading the owner does not report')
    assert.match(compact, /data-light="lit"/, 'the owner\'s standing lights it')
    // The determinants stand in the whole's Mode and tuning (manual §21.2), on the owner's choices.
    const whole = renderToStaticMarkup(h(HostedDevice, {designed: torus, binding, view: 'whole', nav: {}}))
    for (const [label, chosen] of [['Lens', 'L5′'], ['Frame', 'CF7'], ['Basis', 'B4']]) {
      assert.match(whole, new RegExp(`aria-label="${label}"[^>]*>(?:(?!</select>).)*<option value="${chosen}" selected=""`), `the whole's ${label} stands on the owner's ${chosen}`)
    }
    assert.match(whole, /role="radio" aria-checked="true"[^>]*>DNA</, 'M3 stands on the owner\'s DNA')
    // Level, Sound, Cadence and Scale stand in Notes and output, on the body page (manual §21.2: "Notes and output | Polyphony, Level and pan, View").
    setHostPage(binding.id, 'body')
    const body = renderToStaticMarkup(h(HostedDevice, {designed: torus, binding, view: 'whole', nav: {}}))
    assert.match(body, /-6\.0 dB/, 'the owner\'s level, in dB')
    assert.match(body, /120 u\/m/, 'the owner\'s scale')
    assert.match(body, /role="radio" aria-checked="true"[^>]*>12 ticks\/s</, 'the owner\'s cadence')
    assert.match(body, /aria-pressed="true"[^>]*>Sound</, 'the owner\'s sound is on')
    assert.match(body, /aria-label="Polyphony"[^>]*aria-valuetext="no reading"/, 'Polyphony waits on the owner\'s session')
    assert.doesNotMatch(body, /aria-label="(Attack|Release)"/, 'the envelope is retired')
  } finally { resetHost(binding.id) }
})

// ── lane BL2: the design on the chain, its controls still MIDI-mappable ──────────────────────────────────────────────────────

/** The MIDI-map targets a markup draws open, in order. */
const openTargets = markup => [...markup.matchAll(/data-midi-target="([^"]+)"[^>]*data-midi-open="yes"/g)].map(match => match[1])
/** The text of each target's frame, from its open tag to the next target. */
const frames = markup => Object.fromEntries(markup.split('data-midi-target="').slice(1).map(part => [part.slice(0, part.indexOf('"')), part]))
/** The four the chain frames on the generic plate (scripted): the device's compact rows. Until O-I #850 these were the four
 * determinants (measured at adbe6978e); the manual's compact four are now Rate, Fundamental, Carrier and Damping (§21.2), and the
 * determinants are framed by the same ids in the whole's Mode and tuning and in the instrument section. */
const CHAIN_TARGETS_BEFORE = ['rate', 'fundamental', 'carrier', 'damping']

/** A Live session with the owner following, the map in MIDI map mode, and — standing in for Vite's loader, which does not run under
 * Node (designs.ts requestDesign) — the catalogue's own Torus registered unchanged, as central-day-binding.test.mjs registers the Day. */
function mapSession(fn) {
  hold.resetMidiMapHold()
  instrument.publishLiveTorusState(state())
  hold.setMapMode('midi')
  try { return fn(instrument.liveTorusState()) } finally {
    hold.resetMidiMapHold()
    instrument.publishLiveTorusState(null)
    door.publishDevice(model.TORUS_DEVICE_ID, null)
    unregisterDesignedDevice(torus.id)
    resetHost(model.TORUS_DEVICE_ID)
  }
}

test('on the chain the design stands where the generic plate stood, and MIDI-map mode lights the same targets with the same ids', () => mapSession(live => {
  const device = model.torusDevice(live)
  // Before: the chain as it stood with the binding held back — the generic plate, its rows wrapped by the chain's wrap.
  const before = renderToStaticMarkup(h(DeviceView, {device, size: 'compact', wrapRow: onChain.torusMapWrap}))
  assert.match(before, /data-device-design="generic"/)
  assert.deepEqual(openTargets(before), CHAIN_TARGETS_BEFORE, 'the generic plate frames the four macros')
  // After: the chain's own place, the device published with its binding, the catalogue's design drawn.
  registerDesignedDevice(torus)
  door.publishDevice(model.TORUS_DEVICE_ID, {device, binding: model.torusDesignBinding(live, device)})
  const after = renderToStaticMarkup(h(onChain.TorusOnChain, {state: live}))
  assert.match(after, /data-device-design="quaternal-logic:torus"/, 'the chain draws the catalogue\'s Torus')
  assert.deepEqual(openTargets(after), openTargets(before), 'MIDI-map mode lights the same targets, by the same ids, in the same order')
  assert.equal((after.match(/class="midi-map-target/g) ?? []).length, CHAIN_TARGETS_BEFORE.length, 'each control framed once, never twice')
  const framed = frames(after)
  for (const [id, label] of [['rate', 'Rate'], ['fundamental', 'Fundamental'], ['carrier', 'Carrier'], ['damping', 'Damping']]) {
    assert.match(framed[id], new RegExp(`^[^<]*<div class="dp-cell dp-cell--(box|dial)[^>]*><span class="dp-label">${label}</span>`), `${id} frames the design's ${label}`)
  }
  assert.match(after, /<div class="dp-sec-body"[^>]*><div class="midi-map-target/, 'the target stands in the section\'s grid where the control stood (midiMap.css)')
  // With the map off the frames stay, closed; the design draws nothing from a missing reading.
  hold.setMapMode('off')
  const shut = renderToStaticMarkup(h(onChain.TorusOnChain, {state: live}))
  assert.deepEqual([...shut.matchAll(/data-midi-target="([^"]+)"[^>]*data-midi-open="no"/g)].map(match => match[1]), CHAIN_TARGETS_BEFORE)
  assert.doesNotMatch(shut, /NaN|undefined/)
}))

test('the design\'s See and hear carry the ids the instrument section maps them by, wherever a place wraps them; the pool wraps nothing, as before', () => mapSession(live => {
  const device = model.torusDevice(live), binding = model.torusDesignBinding(live, device)
  registerDesignedDevice(torus)
  door.publishDevice(model.TORUS_DEVICE_ID, {device, binding})
  // O-I #850: the whole is paged as the manual groups it (§21.2): the field page carries Pulse, Mode and tuning and Shape; the body page
  // Body and Notes and output, where Level, Sound, Cadence and Scale stand.
  const wrapped = renderToStaticMarkup(h(PlacedDevice, {device, view: 'whole', binding, wrapRow: onChain.torusMapWrap}))
  assert.match(wrapped, /data-device-design="quaternal-logic:torus"/)
  assert.deepEqual(openTargets(wrapped), ['rate', 'fundamental', 'carrier', 'lens', 'context-frame', 'harmonic-basis', 'm3-transcription', 'tuning', 'shape'],
    'Pulse, then the determinants and Tuning, then Shape')
  setHostPage(binding.id, 'body')
  const body = renderToStaticMarkup(h(PlacedDevice, {device, view: 'whole', binding, wrapRow: onChain.torusMapWrap}))
  assert.deepEqual(openTargets(body), ['damping', 'polyphony', 'sound', 'cadence', 'scale-units', 'level'], 'Damping, then Polyphony, Sound, Cadence, Scale and Level')
  const ids = [...openTargets(wrapped), ...openTargets(body)]
  const sectionIds = openTargets(renderToStaticMarkup(h(section.LiveInstrumentSectionView, {state: live})))
  assert.ok(sectionIds.every(id => ids.includes(id)), 'every id the instrument section frames, the design frames by the same id (midiMapTargets.ts)')
  const framed = frames(body)
  assert.match(framed['scale-units'], /<span class="dp-label">Scale<\/span>/, 'the scale is mapped as its units per metre')
  assert.match(framed.level, /<span class="dp-label">Level<\/span>/)
  assert.doesNotMatch(wrapped, /NaN|undefined/)
  // The pool draws the published device with no wrap, as it did the generic plate: no target there.
  assert.deepEqual(openTargets(renderToStaticMarkup(h(PlacedDevice, {device, view: 'whole', binding}))), [])
  setHostPage(binding.id, 'field')
}))

test('the seam: a kit control is wrapped only where the host names its key, and the generic plate standing in is never wrapped twice', () => {
  const wrap = (key, control) => h('div', {'data-wrapped': key}, control)
  const named = namedStanding({lens: {disabled: 'held'}}, ['lens', 'level'])
  assert.deepEqual(named, {lens: {disabled: 'held', valueKey: 'lens'}, level: {valueKey: 'level'}}, 'each wrapped key names itself; its standing stays')
  const draw = standing => renderToStaticMarkup(h(kit.ControlWrapContext.Provider, {value: wrap},
    h(kit.Dial, {label: 'Level', value: 1, scale: {min: 0, max: 4}, format: String, ...standing})))
  assert.match(draw({valueKey: 'level'}), /^<div data-wrapped="level"><div class="dp-cell dp-cell--dial"/, 'named: inside the place\'s wrap')
  assert.match(draw({}), /^<div class="dp-cell dp-cell--dial"/, 'unnamed: the control as it is')
  assert.match(renderToStaticMarkup(h(kit.Dial, {label: 'Level', value: 1, scale: {min: 0, max: 4}, format: String, valueKey: 'level'})), /^<div class="dp-cell/, 'no wrap in place: as it is')
  // A view drawn without the place's wrap is never reached by one around it: the generic plate standing in for a design that did not
  // draw (deviceHost.tsx ViewBoundary fallback, drawn with no wrap) wraps its own rows, once. Server rendering runs no error boundary, so
  // the stand-in is drawn here as the boundary draws it — the generic plate with named standing, inside a design's wrap.
  const live = state()
  const device = model.torusDevice(live)
  const plain = genericDevice({id: torus.id, title: 'M1 torus', rows: device.rows, wrapRow: (row, control) => h('div', {'data-row-wrap': row.key}, control)})
  const binding = {...model.torusDesignBinding(live, device), standing: {damping: {valueKey: 'damping'}}}
  const standIn = renderToStaticMarkup(h(kit.ControlWrapContext.Provider, {value: (key, control) => h('div', {'data-design-wrap': key}, control)},
    h(HostedDevice, {designed: plain, binding, view: 'compact', nav: {}, keys: device.rows.map(row => row.key)})))
  assert.match(standIn, /data-row-wrap="damping"/, 'the plate wraps its row')
  assert.doesNotMatch(standIn, /data-design-wrap/, 'and nothing wraps it again')
})

test('code reading: the stand-in is drawn without the design\'s wrap; the chain passes the binding and keeps its wrap', async () => {
  const read = path => readFile(new URL(`../src/${path}`, import.meta.url), 'utf8')
  const host = await read('frame/devices/deviceHost.tsx')
  assert.match(host, /<DrawnView device=\{plain\} view=\{view\} props=\{\{\.\.\.props, fault: faultWords\(view, cause, true\)\}\} \/>/, 'the generic plate standing in gets no wrap')
  assert.match(host, /<DrawnView device=\{designed\} view=\{view\} props=\{props\} wrap=\{wrap\} \/>/, 'the design gets the place\'s wrap')
  assert.match(await read('frame/devices/DeviceView.tsx'), /\.\.\.\(designed !== plain && wrap \? \{wrap\} : \{\}\)/, 'only a design is wrapped by key; the generic plate wraps its rows')
  assert.match(await read('live/TorusOnChain.tsx'), /<DeviceView device=\{device\} binding=\{binding\} size="compact"[\s\S]*wrapRow=\{torusMapWrap\} \/>/)
})

test('a value moved in the design reaches the owner\'s write: each determinant, Sound, Cadence, Scale and Level, in the owner\'s own form', async () => {
  const sent = []
  instrument.setLiveInstrumentCommander(async command => { sent.push(command); return {ok: true} })
  const live = state()
  const device = model.torusDevice(live), binding = model.torusDesignBinding(live, device)
  resetHost(binding.id)
  try {
    // The view's props as the host hands them (deviceHost.tsx HostedDevice), its set the host's own: a draft, sent on release.
    const props = page => ({v: hostedValues(hostState(binding.id), binding.values), set: (key, value) => setHosted(binding, key, value), nav: {}, page, setPage: () => {},
      standing: hostedStanding(hostState(binding.id), binding, device.rows.map(row => row.key)), owner: binding.values})
    /** The kit control a view draws under `label`, found in the element tree the design returns. */
    const control = (node, type, label) => {
      if (Array.isArray(node)) { for (const child of node) { const found = control(child, type, label); if (found) return found } return null }
      if (!node || typeof node !== 'object' || !node.props) return null
      if (node.type === type && node.props.label === label) return node
      return control(node.props.children, type, label)
    }
    // O-I #850: the determinants stand in the whole's Mode and tuning (field page); Sound, Cadence, Scale and Level in Notes and output (body page).
    const field = torus.whole(props('field')), body = torus.whole(props('body'))
    const moves = [
      [field, kit.Chooser, 'Lens', 'L2'], [field, kit.Chooser, 'Frame', 'CF3'], [field, kit.Chooser, 'Basis', 'Row'], [field, kit.Radio, 'M3', 'RNA'],
      [body, kit.Toggle, 'Sound', false], [body, kit.Radio, 'Cadence', '1 tick/s'], [body, kit.ValueBox, 'Scale', 200], [body, kit.ValueBox, 'Level', -12],
    ]
    for (const [view, type, label, value] of moves) {
      const found = control(view, type, label)
      assert.ok(found, `${label} is drawn`)
      assert.equal(found.props.disabled, undefined, `${label}: the owner takes it while following`)
      found.props.onChange(value)
    }
    assert.equal(await flushDrafts(binding, 1), null, 'the owner took the change')
    assert.deepEqual(sent.map(command => command.edit), [
      {kind: 'lens', lens12: 4}, {kind: 'context-frame', context_frame: 3}, {kind: 'harmonic', source: {selection: 'selected-source-row'}}, {kind: 'transcription', rna: true},
      {kind: 'muted', muted: true}, {kind: 'cadence', rate: 1}, {kind: 'scale', units_per_metre: 200}, {kind: 'level', value: 0.251},
    ], 'each through the one stage channel, as the owner takes it')
  } finally { instrument.setLiveInstrumentCommander(null); resetHost(binding.id) }
})

test('the device\'s own Full: the torus at the pane\'s size and the Jankó keyboard under it, deaf to MIDI (the chain\'s plate hears it)', () => {
  instrument.publishLiveTorusState(state())
  try {
    const full = renderToStaticMarkup(h(onChain.TorusFull))
    assert.match(full, /data-torus-full="following"/)
    assert.match(full, /data-torus-size="full"/, 'the outline at its fullest')
    assert.match(full, /data-janko-layout="janko"/, 'the keyboard under it')
    assert.ok(full.indexOf('data-torus-size') < full.indexOf('data-janko-layout'), 'the keyboard is under the torus')
    assert.doesNotMatch(full, /data-janko-midi/, 'this keyboard does not hear MIDI: a hardware note is struck once')
  } finally { instrument.publishLiveTorusState(null) }
  assert.match(renderToStaticMarkup(h(onChain.TorusFull)), /No owner reading in this host/, 'no owner: the reason, never a likely torus')
})

test('⤢ on the chain\'s design opens the pane, and the pane draws the torus with the keyboard under it over the design\'s own Full', () => mapSession(live => {
  hold.setMapMode('off')
  const device = model.torusDevice(live), binding = model.torusDesignBinding(live, device)
  registerDesignedDevice(torus)
  door.publishDevice(model.TORUS_DEVICE_ID, {device, binding, full: {draw: () => h(onChain.TorusFull)}})
  const chain = renderToStaticMarkup(h(onChain.TorusOnChain, {state: live}))
  assert.match(chain, /data-device-design="quaternal-logic:torus"/)
  assert.match(chain, /class="dp-full" aria-label="Open Torus full in a pane"/, 'the design\'s head carries ⤢ (its act is the chain\'s pane action, TorusOnChain.tsx actions)')
  // The pane (devicePane.tsx) draws the published device full, on its binding.
  const held = door.publishedDevice(model.TORUS_DEVICE_ID)
  const pane = renderToStaticMarkup(h(PlacedDevice, {device: held.device, view: 'full', binding: held.binding}))
  assert.match(pane, /data-device-design="quaternal-logic:torus"/)
  assert.match(pane, /data-torus-full="following"/, 'the torus at the pane\'s size')
  assert.ok(pane.indexOf('data-torus-size="full"') < pane.indexOf('data-janko-layout'), 'with the keyboard under it')
  assert.doesNotMatch(pane, /NaN|undefined/)
}))

// W6: the Body group's tattva is the live scene's M2 condition the frame announces (REAL: tests/fixtures/field-announcements-2026-10-21.json),
// named as the map names its coordinate, read once through ql_read kernel-ledger.
test('the Torus\'s tattva is the live scene\'s M2 condition, by the map\'s name for its coordinate; the body source keeps its reason', async () => {
  const {readFileSync} = await import('node:fs')
  const fixture = JSON.parse(readFileSync(new URL('./fixtures/field-announcements-2026-10-21.json', import.meta.url), 'utf8'))
  const names = await import('../src/inhabitants/ql/devices/qlCoordinateName.ts')
  const {conditionReadingOf} = await import('../../../../desktop/cradle/expressions-app/field-studies-journeys/src/instrumentCondition.ts')
  const condition = conditionReadingOf({current: {m2: {condition: {source_path: fixture.source_path}}}})
  const asked = []
  names.resetCoordinateNames({call: async op => { asked.push(op); return {outcome: {result: 'owner_route_reading', data: fixture.tattva_view}} }})
  await names.ensureCoordinateName(condition.tattva_ref)
  await names.ensureCoordinateName(condition.tattva_ref)
  assert.deepEqual(asked, [{op: 'ql_read', request: {kind: 'kernel-ledger', coordinate: '#2-2-2-5-5'}}], 'one read of the map for one coordinate')
  const binding = model.torusDesignBinding(state(), undefined, {}, null, undefined, null, {}, condition, names.coordinateNames().get('#2-2-2-5-5'))
  assert.deepEqual([binding.values['tattva.name'], binding.values['tattva.fibre']], ['Prithvi Tattva', 'earth'])
  assert.equal(binding.writes('tattva.name'), false, 'a reading')
  assert.equal(binding.standing['tattva.fibre'].disabled, names.FIBRE_READ)
  assert.match(binding.standing['body.source'].disabled, /M2's body constants/, 'the body source waits on M2\'s table, here unread')
  const none = model.torusDesignBinding(state(), undefined, {}, null, undefined, null, {}, null, null)
  assert.equal(none.values['tattva.name'], undefined)
  assert.equal(none.standing['tattva.name'].disabled, names.NO_CONDITION)
  const refused = names.readCoordinateName({outcome: null, error: 'ql: unknown exact M coordinate: #9'}, '#9')
  assert.deepEqual(refused, {ok: false, reason: 'ql: unknown exact M coordinate: #9'})
  names.resetCoordinateNames()
})

// O-I #852 (manual §21.2 "Save the instrument as you tuned it"): the Body page names the sound and saves it through its owners
// (live/LivePresets.tsx saveTorusSound); what they said stands on the Info line.
test('the Body page saves the Torus as a sound by its name, through its owners', async () => {
  mapSession(live => {
    const device = model.torusDevice(live), binding = model.torusDesignBinding(live, device)
    setHostPage(binding.id, 'body')
    const body = renderToStaticMarkup(h(HostedDevice, {designed: torus, binding, view: 'whole', nav: {}}))
    setHostPage(binding.id, 'field')
    assert.match(body, /class="dp-sec-label">Save and keep</)
    assert.match(body, /aria-label="Name"/)
    assert.match(body, /<button type="button" class="dp-action"[^>]*>Save sound<\/button>/)
    // O-I #852 (manual §21.2, Tips: "make a form the body, make sounds on it, and keep it"): Keep instrument keeps the body a saved sound
    // rings on, under the same name field; until a sound on a form is saved here it stands disabled, saying what it waits on.
    assert.match(body, /<button type="button" class="dp-action"[^>]*disabled=""[^>]*>Keep instrument<\/button>/)
    assert.match(body, /data-i="Keep instrument\|[^"]*Save a sound on a form&#x27;s body first/)
    // The Body page stands as tall as the Pulse and Stage pages (two bands, as Live's devices keep one height): the Save stands in the
    // Body band beside the body's own section, and the name field spans the section, so the name reads whole.
    const bands = body.split('class="dp-band"').slice(1)
    assert.equal(bands.length, 2, 'the Body page keeps two bands')
    assert.match(bands[0], /class="dp-sec-label">Body<[^]*class="dp-sec-label">Save and keep<[^]*aria-label="Name"[^]*>Save sound<[^]*>Keep instrument</, 'beside the body, in its band')
    assert.match(bands[0], /<div style="grid-column:span 2;width:100%"><div class="dp-cell dp-cell--text dp-cell--wide" data-i="Name\|/, 'the name spans the section')
    assert.match(bands[0], /<div class="dp-sec" data-grow="true" style="width:224px"><div class="dp-sec-label">Body<\/div><div class="dp-sec-body" style="grid-template-columns:repeat\(4, minmax\(0, 1fr\)\)">/,
      'the body\'s section keeps the width the Notes band gave it, its seven cells in two rows of four, the Notes band\'s column (O-I #852)')
    const sec = bands[0].slice(bands[0].indexOf('class="dp-sec-body"'), bands[0].indexOf('class="dp-sec-label">Save and keep'))
    assert.deepEqual([...sec.matchAll(/class="dp-cell [^"]*"[^>]*?data-i="([^|"]+)\|/g)].map(match => match[1]), ['Body', 'Strike', 'Damping', 'Modes', 'form', 'Source', 'tattva'],
      'what rings, how it is struck and damped, its modes and the form that rings, then where they come from')
    // REPLACED (lane BA, round 865, O-I #856): Receiver takes Shared and Return beside it, so it stands in its own section after Notes and
    // output, in two rows of two, and Notes and output lays its nine controls in two rows of five: the band is no taller than the Pulse page's.
    // 300, not the five columns' 280 (O-I #858 r42): where nothing draws, as here, the kit measures with its table, which never reads a name
    // narrower than the system face draws it, and "Polyphony" reads 52.4 px there; in a browser the drawn face's own width decides.
    assert.match(bands[1], /^><div class="dp-sec" data-grow="true" style="width:300px"><div class="dp-sec-label">Notes and output<\/div><div class="dp-sec-body" style="grid-template-columns:repeat\(5, minmax\(0, 1fr\)\)">/)
    const notes = bands[1].slice(bands[1].indexOf('class="dp-sec-body"'), bands[1].indexOf('class="dp-sec-label">Receiver<'))
    assert.deepEqual([...notes.matchAll(/data-i="([^|"]+)\|/g)].map(match => match[1]),
      ['Polyphony', 'notes', 'Pan', 'View', 'Sound', 'Cadence', 'Scale', 'Level', 'standing'], 'two rows of five')
    const receiver = bands[1].slice(bands[1].indexOf('class="dp-sec-label">Receiver<'))
    assert.match(receiver, /^class="dp-sec-label">Receiver<\/div><div class="dp-sec-body" style="grid-template-columns:repeat\(2, minmax\(0, 1fr\)\)">/)
    assert.deepEqual([...receiver.matchAll(/data-i="([^|"]+)\|/g)].map(match => match[1]), ['Receiver', 'Return', 'Shared'], 'On or Off and Return, then the reference across both')
  })
  const source = await readFile(new URL('../src/inhabitants/catalogue/panels/torus.tsx', import.meta.url), 'utf8')
  assert.match(source, /import\('\.\.\/\.\.\/\.\.\/live\/LivePresets'\)\.then\(presets => presets\.saveTorusSound\(name\)\)/, 'the save goes through the presets\' owner route, loaded when pressed')
  // The refusal on the Save control speaks plainly (shared/Refusal.tsx refusalWords; desktop/cradle/tests/plain-refusals.test.mjs): the
  // owners' words when they are words, a thrown cause never raw.
  assert.match(source, /if \(!answer\.ok\) return setSaid\(\{refused: refusalWords\(UNSAVED, answer\.error\)\}\)[^]*\(cause: unknown\) => setSaid\(\{refused: refusalWords\(UNSAVED, cause\)\}\)/)
  // Keep instrument: the same owner route, loaded when pressed, for the sound saved here; its refusal as plain (O-I #852).
  assert.match(source, /import\('\.\.\/\.\.\/\.\.\/live\/LivePresets'\)\.then\(presets => presets\.keepTorusInstrument\(name, saved\.sound_ref\)\)/)
  assert.match(source, /setKept\(answer\.ok \? \{done: answer\.words\} : \{refused: refusalWords\(UNKEPT, answer\.error\)\}\), \(cause: unknown\) => setKept\(\{refused: refusalWords\(UNKEPT, cause\)\}\)/)
  assert.doesNotMatch(source, /String\(cause\)/, 'no caught value is printed as it came')
})

// O-I ticket 853 on the device's face (DLW build ruling 2026-11-05, BB round 19): what a playing take's moves and lanes write stands
// Automated on the Torus's own controls (live/clipPlayer.ts `state().lanes`, by map parameter), what the hand moved off its lane stands
// Overridden, and Re-enable on that control gives that one parameter back to the take's lanes.
test('a take\'s lanes stand on the face: Automated, Overridden with Re-enable, by the design\'s key', () => {
  const asked = []
  const lanes = {automated: ['rate', 'scale-units', 'lens', 'note-device:d1:tie'], overridden: ['rate']}
  const face = model.torusLaneStanding(lanes, id => asked.push(id))
  assert.deepEqual(Object.keys(face).sort(), ['lens', 'rate', 'scale'], 'the map\'s scale-units is the design\'s Scale; a note device is not on the Torus')
  assert.equal(face.lens.automated, true)
  assert.equal(face.scale.automated, true)
  assert.equal(face.lens.onReenable, undefined, 'only a control the hand took off its lane offers Re-enable')
  assert.equal(face.rate.automated, 'overridden')
  face.rate.onReenable()
  assert.deepEqual(asked, ['rate'], 'Re-enable gives the map parameter back, by its map id')
  const scaleBack = model.torusLaneStanding({automated: [], overridden: ['scale-units']}, id => asked.push(id))
  scaleBack.scale.onReenable()
  assert.equal(asked.at(-1), 'scale-units', 'the design\'s Scale goes back as the map\'s scale-units')
  assert.deepEqual(model.torusLaneStanding({automated: [], overridden: []}, () => {}), {}, 'no take: nothing stands')
  assert.deepEqual(model.torusLaneStanding(null, null), {})
  assert.equal(model.torusLaneStanding({automated: [], overridden: ['level']}, null).level.onReenable, undefined, 'no player: nothing to press')
  // A Re-enable the owner refused stands on that control in its words until the lanes next change.
  const refused = model.torusLaneStanding(lanes, () => {}, {rate: 'rate went back to the take\'s lanes, and the owner refused the value its lane reached.'})
  assert.match(refused.rate.refused, /owner refused the value its lane reached/)
  // On the binding: over what it says of each key, so a key the owner does not take now keeps its reason and still says it is automated.
  const live = model.torusDesignBinding(state(), undefined, {}, null, undefined, null, {}, null, null, undefined, undefined, undefined, null, face)
  assert.equal(live.standing.lens.automated, true)
  assert.equal(live.standing.lens.disabled, undefined)
  assert.equal(live.standing.rate.automated, 'overridden')
  assert.match(live.standing.rate.disabled, /torus-state/, 'the session is not announced here: Rate keeps its reason')
  assert.equal(kit.standingOf(live.standing.lens), 'automated')
  assert.equal(model.torusDesignBinding(state()).standing.lens, undefined, 'no take: the binding says nothing of the lens')
})

test('Re-enable is the overridden control\'s own: pressed, it gives the value back; an automated one offers none', () => {
  const pressed = []
  const draw = standing => renderToStaticMarkup(h(kit.Dial, {label: 'Rate', value: 1, scale: {min: 0, max: 4}, format: String, ...standing}))
  const over = draw({automated: 'overridden', onReenable: () => pressed.push('rate')})
  assert.match(over, /data-standing="overridden"/)
  assert.match(over, /<button type="button" class="dp-reenable" aria-label="Give Rate back to its automation lane"[^>]*>Re-enable<\/button>/)
  assert.doesNotMatch(draw({automated: true, onReenable: () => {}}), /dp-reenable/, 'on its lane: nothing to give back')
  assert.doesNotMatch(draw({automated: 'overridden'}), /dp-reenable/, 'no act named: no button')
  assert.match(kit.standingWords({automated: 'overridden'}), /Re-enable gives it back to the lane/)
})

test('code reading: the chain reads the clip player\'s lanes into the binding, and a refused Re-enable is said plainly', async () => {
  const source = await readFile(new URL('../src/live/TorusOnChain.tsx', import.meta.url), 'utf8')
  // REPLACES (O-I #849 round 21): the lanes were the set's one player's (liveClipPlayer); they are every player's now, a row's among them
  assert.match(source, /useSyncExternalStore\(liveClipActs\.subscribe, laneReading, laneReading\)/, 'the lanes as the players publish them')
  assert.match(source, /liveClipActs\.reenable\(id\)\.then\(answer =>[^]*refusalWords\(NOT_REENABLED, answer\.error\)[^]*\(cause: unknown\) =>[^]*refusalWords\(NOT_REENABLED, cause\)/)
  assert.match(source, /torusLaneStanding\(lanes, reenable, laneRefused\?\.lanes === lanes \? laneRefused\.words : undefined\)/, 'a refusal stands until the lanes next change')
  assert.doesNotMatch(source, /String\(cause\)/)
})
