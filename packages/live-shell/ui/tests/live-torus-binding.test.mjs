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
  for (const key of Object.keys(torus.defaults)) assert.ok(key in values || model.TORUS_ABSENT[key] || (key === 'rack' && bound.standing.rack.disabled) || bound.local[key],
    `${key}: read from the owner, named absent, or the view's own`)
  assert.deepEqual(Object.keys(torus.defaults).filter(key => key in values),
    ['light', 'level', 'lens', 'context-frame', 'harmonic-basis', 'm3-transcription', 'sound', 'cadence', 'scale', 'standing'],
    'the owner reports the light, the level, its four determinants, its sound, cadence and scale, and its standing — nothing else of the design')
  for (const key of ['sounding', 'driveMod']) {
    assert.equal(key in values, false, `${key}: the owner reports none, so the binding gives none`)
    assert.match(model.TORUS_ABSENT[key], /^(The owner reports no sounding keys|Nothing moves the drive)/, `${key}: absent with its reason`)
  }
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
  for (const key of ['level', 'sound', 'cadence', 'scale', 'lens', 'context-frame', 'harmonic-basis', 'm3-transcription']) assert.equal(live.writes(key), true, `${key} is the owner's to change`)
  for (const key of ['pulseMix', 'drive', 'damping', 'release', 'notes', 'meter', 'view', 'receiver']) {
    assert.equal(live.writes(key), false, `${key} has no owner`)
    assert.equal(live.standing[key].disabled, model.TORUS_ABSENT[key])
  }
  assert.match(live.standing.drive.disabled, /No sky route moves it either/, 'no modulation arc is claimed for Drive')
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
    setDraft(binding.id, 'drive', 3)
    assert.equal(await flushDrafts(binding, 1), 'A reading: the owner reports it; nothing here changes it.', 'a key with no owner never reaches the channel')
    assert.equal(sent.length, 3)
    assert.throws(() => model.torusRowChanges([{key: 'pulseMix', value: 40}]), /No pulse mix/)
  } finally { instrument.setLiveInstrumentCommander(null); resetHost(model.TORUS_DEVICE_ID) }
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
    assert.match(compact, /No reading of the pulses/, 'without the pulses the ring stands bare and says so')
    assert.doesNotMatch(compact, /aria-label="Pulse mix"[^>]*role="slider"|data-shape="dot"/, 'no handle on a reading the owner does not report')
    assert.match(compact, /data-light="lit"/, 'the owner\'s standing lights it')
    for (const [label, chosen] of [['Lens', 'L5′'], ['Frame', 'CF7'], ['Basis', 'B4']]) {
      assert.match(compact, new RegExp(`aria-label="${label}"[^>]*>(?:(?!</select>).)*<option value="${chosen}" selected=""`), `the compact's ${label} stands on the owner's ${chosen}`)
    }
    assert.match(compact, /role="radio" aria-checked="true"[^>]*>DNA</, 'M3 stands on the owner\'s DNA')
    const whole = renderToStaticMarkup(h(HostedDevice, {designed: torus, binding, view: 'whole', nav: {}}))
    assert.match(whole, /-6\.0 dB/, 'the owner\'s level, in dB')
    assert.match(whole, /120 u\/m/, 'the owner\'s scale')
    assert.match(whole, /role="radio" aria-checked="true"[^>]*>12 ticks\/s</, 'the owner\'s cadence')
    assert.match(whole, /aria-pressed="true"[^>]*>Sound</, 'the owner\'s sound is on')
    setHostPage(binding.id, 'body')
    assert.match(renderToStaticMarkup(h(HostedDevice, {designed: torus, binding, view: 'whole', nav: {}})), /No reading of the envelope/)
  } finally { resetHost(binding.id) }
})

// ── lane BL2: the design on the chain, its controls still MIDI-mappable ──────────────────────────────────────────────────────

/** The MIDI-map targets a markup draws open, in order. */
const openTargets = markup => [...markup.matchAll(/data-midi-target="([^"]+)"[^>]*data-midi-open="yes"/g)].map(match => match[1])
/** The text of each target's frame, from its open tag to the next target. */
const frames = markup => Object.fromEntries(markup.split('data-midi-target="').slice(1).map(part => [part.slice(0, part.indexOf('"')), part]))
/** The four the chain framed before the design (measured on the generic plate at adbe6978e, scripted): the device's compact rows. */
const CHAIN_TARGETS_BEFORE = ['lens', 'context-frame', 'harmonic-basis', 'm3-transcription']

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
  assert.deepEqual(openTargets(before), CHAIN_TARGETS_BEFORE, 'the generic plate framed the four determinants')
  // After: the chain's own place, the device published with its binding, the catalogue's design drawn.
  registerDesignedDevice(torus)
  door.publishDevice(model.TORUS_DEVICE_ID, {device, binding: model.torusDesignBinding(live, device)})
  const after = renderToStaticMarkup(h(onChain.TorusOnChain, {state: live}))
  assert.match(after, /data-device-design="quaternal-logic:torus"/, 'the chain draws the catalogue\'s Torus')
  assert.deepEqual(openTargets(after), openTargets(before), 'MIDI-map mode lights the same targets, by the same ids, in the same order')
  assert.equal((after.match(/class="midi-map-target/g) ?? []).length, CHAIN_TARGETS_BEFORE.length, 'each control framed once, never twice')
  const framed = frames(after)
  for (const [id, label] of [['lens', 'Lens'], ['context-frame', 'Frame'], ['harmonic-basis', 'Basis'], ['m3-transcription', 'M3']]) {
    assert.match(framed[id], new RegExp(`^[^<]*<div class="dp-cell dp-cell--(chooser|radio)[^>]*><span class="dp-label">${label}</span>`), `${id} frames the design's ${label}`)
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
  const wrapped = renderToStaticMarkup(h(PlacedDevice, {device, view: 'whole', binding, wrapRow: onChain.torusMapWrap}))
  assert.match(wrapped, /data-device-design="quaternal-logic:torus"/)
  const ids = openTargets(wrapped)
  assert.deepEqual(ids, [...CHAIN_TARGETS_BEFORE, 'sound', 'cadence', 'scale-units', 'level'], 'the determinants, then Sound, Cadence, Scale and Level')
  const sectionIds = openTargets(renderToStaticMarkup(h(section.LiveInstrumentSectionView, {state: live})))
  assert.deepEqual([...ids].sort(), [...sectionIds].sort(), 'the same ids the instrument section frames them by (midiMapTargets.ts)')
  const framed = frames(wrapped)
  assert.match(framed['scale-units'], /<span class="dp-label">Scale<\/span>/, 'the scale is mapped as its units per metre')
  assert.match(framed.level, /<span class="dp-label">Level<\/span>/)
  assert.doesNotMatch(wrapped, /NaN|undefined/)
  // The pool draws the published device with no wrap, as it did the generic plate: no target there.
  assert.deepEqual(openTargets(renderToStaticMarkup(h(PlacedDevice, {device, view: 'whole', binding}))), [])
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
  const binding = {...model.torusDesignBinding(live, device), standing: {lens: {valueKey: 'lens'}}}
  const standIn = renderToStaticMarkup(h(kit.ControlWrapContext.Provider, {value: (key, control) => h('div', {'data-design-wrap': key}, control)},
    h(HostedDevice, {designed: plain, binding, view: 'compact', nav: {}, keys: device.rows.map(row => row.key)})))
  assert.match(standIn, /data-row-wrap="lens"/, 'the plate wraps its row')
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
    const compact = torus.compact(props('field')), whole = torus.whole(props('field'))
    const moves = [
      [compact, kit.Chooser, 'Lens', 'L2'], [compact, kit.Chooser, 'Frame', 'CF3'], [compact, kit.Chooser, 'Basis', 'Row'], [compact, kit.Radio, 'M3', 'RNA'],
      [whole, kit.Toggle, 'Sound', false], [whole, kit.Radio, 'Cadence', '1 tick/s'], [whole, kit.ValueBox, 'Scale', 200], [whole, kit.ValueBox, 'Level', -12],
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
  assert.match(binding.standing['body.source'].disabled, /declared policy/)
  const none = model.torusDesignBinding(state(), undefined, {}, null, undefined, null, {}, null, null)
  assert.equal(none.values['tattva.name'], undefined)
  assert.equal(none.standing['tattva.name'].disabled, names.NO_CONDITION)
  const refused = names.readCoordinateName({outcome: null, error: 'ql: unknown exact M coordinate: #9'}, '#9')
  assert.deepEqual(refused, {ok: false, reason: 'ql: unknown exact M coordinate: #9'})
  names.resetCoordinateNames()
})
