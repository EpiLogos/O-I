import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'

// R5: the torus's four effects (manual §21.5) on their owner, and the owner's chain: which stand after the torus, in what order. Each catalogue design (live__filter/dynamics/delay/reverb.tsx) draws on the
// native field's presentation stage as the hosted reading carries it (`parameters.effects`), through live/designBindings/torusEffects.ts:
// `light` is the effect's switch, every other key the owner's own parameter; the Dynamics' gain reduction is no reading the owner
// announces, so it stands absent with its reason. Writes go through the one stage channel as `effect` instrument edits, proved against
// a fixture commander; a value outside the owner's law is refused in its words before anything is sent. Loader as live-torus-binding.
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
const fx = await import('../src/live/designBindings/torusEffects.ts')
const onChain = await import('../src/live/designBindings/TorusEffectsOnChain.tsx')
const {HostedDevice, flushDrafts, setDraft, resetHost} = await import('../src/frame/devices/deviceHost.tsx')
const {designKey} = await import('../src/frame/devices/designs.ts')
const door = await import('../src/frame/devices/deviceDoor.ts')
const designs = {
  filter: (await import('../src/inhabitants/catalogue/panels/live__filter.tsx')).design,
  dynamics: (await import('../src/inhabitants/catalogue/panels/live__dynamics.tsx')).design,
  delay: (await import('../src/inhabitants/catalogue/panels/live__delay.tsx')).design,
  reverb: (await import('../src/inhabitants/catalogue/panels/live__reverb.tsx')).design,
}

const effects = (chain = ['filter', 'delay', 'reverb']) => ({chain, filter: {on: true, type: 'bandpass', cutoff: 900, resonance: 70, drive: 6, mix: 80},
  dynamics: {on: false, threshold: -30, ratio: 12, attack: 30, release: 800, makeup: 9},
  delay: {on: true, sync: false, division: '1/8', time: 900, feedback: 70, tone: 900, mix: 40, tempo: 120},
  reverb: {on: true, size: 90, decay: 8, damping: 10, predelay: 60, mix: 35}})
const parameters = (over = {}) => ({muted: false, level: 1, scale: {unitsPerMetre: 120, mode: 'domain-follow'}, cadence: null, refusal: null, effects: effects(), ...over})
const reading = {schema: 'ql.instrument-reading/v1', standing: 'manual', reason: null,
  identity: {event_ref: 'controlled:occasion', subject_ref: 's', registry_revision: 'r', geometry_ref: 'g', material_ref: 'm', model_ref: 'd'}}
const state = (par = parameters()) => ({ok: true, value: reading, determinants: null, parameters: par})
const VIEWS = ['folded', 'compact', 'whole', 'full', 'widget']

test('each effect is its design\'s: its family and face make the design\'s key, in the order the four sound', () => {
  assert.deepEqual(fx.TORUS_EFFECTS, ['filter', 'dynamics', 'delay', 'reverb'])
  for (const effect of fx.TORUS_EFFECTS) {
    const device = fx.torusEffectDevice(effect, state())
    assert.equal(designKey(device.family, device.face.id), designs[effect].id)
    assert.equal(device.face.liveSemantic, 'device-audio-fx')
  }
})

test('every key of each design is the owner\'s reading, or absent with its reason; the switch is the light', () => {
  for (const effect of fx.TORUS_EFFECTS) {
    const values = fx.torusEffectValues(effect, state())
    const absent = Object.keys(designs[effect].defaults).filter(key => !(key in values))
    assert.deepEqual(absent, [], `${effect}: every design key is read from the owner`)
    assert.equal(values.reason, undefined)
  }
  assert.deepEqual(fx.torusEffectValues('filter', state()), {light: 'lit', type: 'bandpass', cutoff: 900, resonance: 70, drive: 6, mix: 80})
  assert.equal(fx.torusEffectValues('dynamics', state()).light, 'dark')
  assert.equal(fx.torusEffectValues('delay', state()).tempo, 120, 'the tempo the owner\'s delay syncs to')
  const binding = fx.torusEffectBinding('dynamics', state())
  assert.equal('reduction' in binding.values, false)
  assert.match(binding.standing.reduction.disabled, /announces no gain reduction/)
  assert.equal(binding.writes('threshold'), true); assert.equal(binding.writes('light'), true); assert.equal(binding.writes('reduction'), false)
})

test('with no owner reading every value is absent, the well names why, and nothing writes', () => {
  for (const [given, why] of [[null, /No owner reading in this host/], [{ok: false, fault: 'reading.schema'}, /Refused reading: reading\.schema/],
    [state(parameters({effects: undefined})), /This frame announces no effects/]]) {
    const binding = fx.torusEffectBinding('reverb', given)
    assert.deepEqual(Object.keys(binding.values), ['reason']); assert.match(binding.values.reason, why)
    assert.equal(binding.write, undefined); assert.equal(binding.writes('decay'), false); assert.match(binding.standing.decay.disabled, why)
    assert.equal(fx.torusEffectDevice('reverb', given).submit, undefined)
  }
})

test('a change leaves through the one stage channel as the owner\'s effect edit; a value outside its law is refused before anything is sent', async () => {
  const sent = []
  let refuse = null
  instrument.setLiveInstrumentCommander(async command => { sent.push(command); return refuse ? {ok: false, error: refuse} : {ok: true} })
  try {
    const binding = fx.torusEffectBinding('filter', state())
    resetHost(binding.id)
    setDraft(binding.id, 'light', 'dark')
    setDraft(binding.id, 'cutoff', 1200)
    assert.equal(await flushDrafts(binding, 1), null)
    assert.deepEqual(sent, [{command: 'instrument', edit: {kind: 'effect', effect: 'filter', key: 'on', value: false}},
      {command: 'instrument', edit: {kind: 'effect', effect: 'filter', key: 'cutoff', value: 1200}}], 'the light as the switch, the cutoff as itself')
    const dynamics = fx.torusEffectBinding('dynamics', state())
    await assert.rejects(dynamics.write([{key: 'threshold', value: -20}, {key: 'release', value: 2000}]), /Dynamics release goes from 5 to 1000 ms: the compressor the torus sounds through releases within a second/)
    assert.equal(sent.length, 2, 'a refused set sends nothing, not even its valid change')
    refuse = 'native audio unavailable'
    await assert.rejects(fx.torusEffectBinding('delay', state()).write([{key: 'feedback', value: 50}]), /native audio unavailable/, 'the owner\'s refusal in its words')
    const device = fx.torusEffectDevice('reverb', state())
    refuse = null
    await device.submit([{key: 'on', value: false}])
    assert.deepEqual(sent.at(-1), {command: 'instrument', edit: {kind: 'effect', effect: 'reverb', key: 'on', value: false}}, 'the runtime\'s row write is the same edit')
  } finally { instrument.setLiveInstrumentCommander(null); for (const effect of fx.TORUS_EFFECTS) resetHost(fx.torusEffectId(effect)) }
})

test('each design draws every view on its binding: the owner\'s values, or its well naming the absence', () => {
  for (const effect of fx.TORUS_EFFECTS) {
    const live = fx.torusEffectBinding(effect, state()), none = fx.torusEffectBinding(effect, null)
    for (const view of VIEWS) {
      const drawn = renderToStaticMarkup(h(HostedDevice, {designed: designs[effect], binding: live, view, nav: {}}))
      assert.ok(drawn.length > 0, `${effect} ${view}`)
      assert.equal(drawn.includes('No owner reading in this host'), false, `${effect} ${view}: no absence drawn over a reading`)
      renderToStaticMarkup(h(HostedDevice, {designed: designs[effect], binding: none, view, nav: {}}))
    }
    const whole = renderToStaticMarkup(h(HostedDevice, {designed: designs[effect], binding: none, view: 'whole', nav: {}}))
    assert.match(whole, /No owner reading in this host/, `${effect}: the well names the absence`)
  }
})

test('on the chain stand the effects the owner\'s chain names, in its order, then the place to put the others on', () => {
  const drawn = renderToStaticMarkup(h(onChain.TorusEffectsOnChain, {state: state(parameters({effects: effects(['reverb', 'filter'])}))}))
  assert.deepEqual([...drawn.matchAll(/data-chain-effect="([^"]+)"/g)].map(m => m[1]), ['live:torus-reverb', 'live:torus-filter'])
  const pressed = [...drawn.matchAll(/aria-pressed="(true|false)"[^>]*>([A-Za-z ]+)</g)].map(m => [m[2], m[1]])
  assert.deepEqual(pressed, [['Filter', 'true'], ['Dynamics', 'false'], ['Delay', 'false'], ['Reverb', 'true'], ['Resonator bank', 'false'], ['Sky', 'false']],
    'the four and the Resonator bank, pressed while on the chain, and the Sky modulator, off it until put there')
  assert.equal(renderToStaticMarkup(h(onChain.TorusEffectsOnChain, {state: null})), '', 'no owner reading: nothing stands')
})

test('placing, taking off and moving are the owner\'s chain edit; the Delay keeps to the set\'s tempo', async () => {
  const sent = []
  instrument.setLiveInstrumentCommander(async command => { sent.push(command); return {ok: true} })
  try {
    const s = state()
    assert.deepEqual(fx.torusEffectsChain(s), ['filter', 'delay', 'reverb'])
    await fx.placeTorusEffect(s, 'dynamics'); await fx.placeTorusEffect(s, 'dynamics', 0); await fx.placeTorusEffect(s, 'reverb', 0)
    await fx.removeTorusEffect(s, 'delay'); await fx.moveTorusEffect(s, 'reverb', -1); await fx.moveTorusEffect(s, 'filter', 1)
    assert.deepEqual(sent.map(c => c.edit.chain), [['filter', 'delay', 'reverb', 'dynamics'], ['dynamics', 'filter', 'delay', 'reverb'], ['reverb', 'filter', 'delay'],
      ['filter', 'reverb'], ['filter', 'reverb', 'delay'], ['delay', 'filter', 'reverb']], 'each as the whole new order; a placed effect already on the chain moves')
    await assert.rejects(fx.moveTorusEffect(s, 'dynamics', 1), /Dynamics is not on the chain/)
    await assert.rejects(fx.placeTorusEffect(null, 'filter'), /No owner reading in this host/)
    sent.length = 0
    assert.equal(fx.setTempoEdit(s, 120), null, 'already at the set\'s tempo')
    assert.equal(fx.setTempoEdit(s, null), null, 'the set states no tempo')
    assert.equal(fx.setTempoEdit(s, 900), null, 'outside the owner\'s law: left as it is')
    await fx.followSetTempo(s, 98.456)
    assert.deepEqual(sent, [{command: 'instrument', edit: {kind: 'effect', effect: 'delay', key: 'tempo', value: 98.46}}])
  } finally { instrument.setLiveInstrumentCommander(null) }
})

test('a state that changes only its parameters is published: the last effect taken off reaches the chain (native screen pass r4)', () => {
  instrument.publishLiveTorusState(null)
  const placed = state(parameters({effects: effects(['filter'])}))
  instrument.publishLiveTorusState(placed)
  assert.deepEqual(fx.torusEffectsChain(instrument.liveTorusState()), ['filter'])
  // The owner took the Filter off: the QL reading is unchanged (a held instrument does not move), only its parameters are.
  instrument.publishLiveTorusState(state(parameters({effects: effects([])})))
  assert.deepEqual(fx.torusEffectsChain(instrument.liveTorusState()), [], 'the empty chain is published')
  instrument.publishLiveTorusState(state(parameters({effects: effects([]), level: 2})))
  assert.equal(instrument.liveTorusState().parameters.level, 2, 'so is a level the owner took while held')
  const kept = instrument.liveTorusState()
  instrument.publishLiveTorusState(state(parameters({effects: effects([]), level: 2})))
  assert.equal(instrument.liveTorusState(), kept, 'an identical publish keeps the same state object')
  instrument.publishLiveTorusState(null)
})
