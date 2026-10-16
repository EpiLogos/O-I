import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'

// Lane BL: the Torus on its owner. The catalogue's Torus (torus.tsx, `quaternal-logic:torus`) draws on the native field's own
// announcement (torusDevice.ts torusDesignBinding): its standing is the light, its presentation gain the level in dB; every other key of
// the design is no parameter the owner exposes, so it stands absent and says why; the owner's determinants and its sound, cadence and
// scale ride the binding for the controls the design will draw. Writes go through the one stage channel, proved here against a fixture
// commander — never the owner's real state. The device's own Full is the torus at pane size with the Jankó keyboard under it, deaf to
// MIDI. Readings are fixtures shaped as the boundary validates them (scripted). Loader as live-torus-controls.test.mjs.
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
const {HostedDevice, flushDrafts, setDraft, resetHost} = await import('../src/frame/devices/deviceHost.tsx')
const {designKey} = await import('../src/frame/devices/designs.ts')

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
  for (const key of Object.keys(torus.defaults)) assert.ok(key in values || model.TORUS_ABSENT[key], `${key}: read from the owner or named absent`)
  assert.deepEqual(Object.keys(torus.defaults).filter(key => key in values), ['light', 'level'], 'the owner reports the light and the level, and nothing else of the design')
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
  for (const view of VIEWS) {
    const markup = renderToStaticMarkup(h(HostedDevice, {designed: torus, binding, view, nav: {}}))
    assert.doesNotMatch(markup, /NaN|undefined/, `${view}: nothing drawn from a missing reading`)
    assert.doesNotMatch(markup, /data-device-fault/, `${view}: the design's own view draws`)
  }
  const compact = renderToStaticMarkup(h(HostedDevice, {designed: torus, binding, view: 'compact', nav: {}}))
  assert.match(compact, /No reading of the pulses/, 'without the pulses the ring stands bare and says so')
  assert.doesNotMatch(compact, /aria-label="Pulse mix"[^>]*role="slider"|data-shape="dot"/, 'no handle on a reading the owner does not report')
  assert.match(compact, /data-light="lit"/, 'the owner\'s standing lights it')
  const whole = renderToStaticMarkup(h(HostedDevice, {designed: torus, binding, view: 'whole', nav: {}}))
  assert.match(whole, /-6\.0 dB/, 'the owner\'s level, in dB')
  assert.match(whole, /No reading of the envelope/)
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
