import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'

// R5: Sky modulation on a Live part (manual §22.2): the shell's plan run on the Sky's reading. The design's law — Position moves a target
// about its base by Amount × (λ/360 − ½) of its range (log for a frequency or a time), Interval multiplies a frequency by the planet's
// just interval to the power of Amount — written through each target's own owner (a fixture writer stands in for the stage channel),
// the base handed back when the last route on a target goes; Note is refused in words, nothing being per note.
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
const sm = await import('../src/live/designBindings/skyModulation.ts')
const fx = await import('../src/live/designBindings/torusEffects.ts')
const {HostedDevice} = await import('../src/frame/devices/deviceHost.tsx')
const {designKey} = await import('../src/frame/devices/designs.ts')
const design = (await import('../src/inhabitants/catalogue/panels/quaternal-logic__sky-modulation.tsx')).design

const effects = {chain: ['filter', 'delay'], filter: {on: true, type: 'lowpass', cutoff: 2400, resonance: 20, drive: 0, mix: 100},
  dynamics: {on: true, threshold: -12, ratio: 4, attack: 1, release: 100, makeup: 2},
  delay: {on: true, sync: true, division: '1/8', time: 250, feedback: 35, tone: 6000, mix: 25, tempo: 120},
  reverb: {on: true, size: 50, decay: 2.4, damping: 40, predelay: 20, mix: 22}}
const reading = {schema: 'ql.instrument-reading/v1', standing: 'manual', reason: null, identity: {event_ref: 'e', subject_ref: 's', registry_revision: 'r', geometry_ref: 'g', material_ref: 'm', model_ref: 'd'}}
const state = (fx_ = effects) => ({ok: true, value: reading, determinants: null,
  parameters: {muted: false, level: 0.5, scale: {unitsPerMetre: 120, mode: 'domain-follow'}, cadence: null, refusal: null, effects: fx_}})
const body = (name, lon) => ({body: name, longitude_degrees: lon, retrograde: false})
const sky = lons => ({ask: {now: true}, answered: null, view: {aspects: false, natal: false, hidden: []},
  reading: {ok: true, sky: {snapshotRef: 's', epochUtc: '2026-09-28T12:00:00Z', epochMs: Date.UTC(2026, 8, 28, 12), scope: 'shared-geocentric', standing: 'x', status: 'available',
    bodies: Object.entries(lons).map(([name, lon]) => body(name, lon))}}})
const VIEWS = ['folded', 'compact', 'whole', 'full', 'widget']

test('the targets are the part\'s reported parameters: the torus\'s level and scale, each number of each effect on the chain (not the tempo)', () => {
  const ids = sm.skyTargets(state()).map(t => t.id)
  assert.deepEqual(ids, ['quaternal-logic:torus/level', 'quaternal-logic:torus/scale', 'live:filter/cutoff', 'live:filter/resonance', 'live:filter/drive',
    'live:filter/mix', 'live:delay/time', 'live:delay/feedback', 'live:delay/tone', 'live:delay/mix'])
  const cutoff = sm.skyTargets(state()).find(t => t.id === 'live:filter/cutoff')
  assert.equal(cutoff.log, true); assert.deepEqual(cutoff.edit(900), {kind: 'effect', effect: 'filter', key: 'cutoff', value: 900})
  assert.deepEqual(sm.skyTargets(state()).find(t => t.label === 'Level').edit(-6), {kind: 'level', value: 0.501})
  assert.deepEqual(sm.skyTargets(null), [])
  assert.equal(designKey(sm.SKY_MODULATION_FAMILY, sm.SKY_MODULATION_FACE), design.id)
})

test('the law: position sweeps a bracket Amount wide about the base, in the range\'s own scale; interval multiplies a frequency', () => {
  const lin = {min: 0, max: 100, log: false}, log = {min: 20, max: 20000, log: true}
  assert.equal(sm.moved(lin, 50, {planet: 'Mars', use: 'position', amount: 100}, 180), 50, 'λ = 180°: the base')
  assert.equal(sm.moved(lin, 50, {planet: 'Mars', use: 'position', amount: 100}, 270), 75, 'a quarter turn on: a quarter of the range')
  assert.equal(sm.moved(lin, 50, {planet: 'Mars', use: 'position', amount: -100}, 270), 25, 'below zero it reverses')
  assert.equal(sm.moved(lin, 90, {planet: 'Mars', use: 'position', amount: 100}, 359), 100, 'never past the range')
  assert.ok(Math.abs(sm.moved(log, 200, {planet: 'Sun', use: 'position', amount: 100}, 270) - 200 * 1000 ** 0.25) < 1e-9, 'log: a quarter of the decades')
  assert.ok(Math.abs(sm.moved(log, 1000, {planet: 'Saturn', use: 'interval', amount: 100}, 0) - 1500) < 1e-9, 'Saturn 3:2 at 100 %')
  assert.ok(Math.abs(sm.moved(log, 1000, {planet: 'Saturn', use: 'interval', amount: -100}, 0) - 1000 / 1.5) < 1e-9)
  assert.ok(Math.abs(sm.moved(log, 1000, {planet: 'Uranus', use: 'interval', amount: 100}, 180) - 1000) < 1e-9, 'Uranus has no interval: by position')
  assert.equal(sm.moved(lin, 50, {planet: 'Venus', use: 'interval', amount: 100}, 180), 50, 'interval needs a frequency: by position')
})

test('the plan takes the design\'s changes and refuses in words; Note is refused, nothing being per note', () => {
  sm.resetSkyModulation()
  const targets = sm.skyTargets(state())
  let plan = sm.skyModulationChanges(sm.skyModulationPlan(), targets, [{key: 'routes', value: JSON.stringify([{id: 'r1', planet: 'Venus', target: 'live:filter/cutoff'}])},
    {key: 'amount:r1', value: 40}, {key: 'use:r1', value: 'interval'}, {key: 'smoothing:r1', value: 0}, {key: 'scope:r1', value: 'global'}])
  assert.deepEqual(plan.routes, [{id: 'r1', planet: 'Venus', target: 'live:filter/cutoff', use: 'interval', amount: 40, smoothing: 0}])
  assert.throws(() => sm.skyModulationChanges(plan, targets, [{key: 'scope:r1', value: 'note'}]), /nothing moves per note/)
  assert.throws(() => sm.skyModulationChanges(plan, targets, [{key: 'amount:r1', value: 140}]), /−100 to 100/)
  assert.throws(() => sm.skyModulationChanges(plan, targets, [{key: 'routes', value: JSON.stringify([{id: 'r2', planet: 'Mars', target: 'live:reverb/mix'}])}]), /no parameter on the part's chain/)
  assert.throws(() => sm.skyModulationChanges(plan, targets, [{key: 'havePlace', value: true}]), /No place has reached the Sky yet: it reads your world's declared place/)
  assert.equal(sm.skyModulationChanges(plan, targets, [{key: 'light', value: 'dark'}]).on, false)
})

test('run: a planet takes a target at its owner\'s value, writes the move through its owner, and hands the base back when its route goes', async () => {
  const writes = []
  sm.resetSkyModulation({writer: async edit => { writes.push(edit); return {ok: true} }})
  sm.placeSkyModulation(true)
  const binding = sm.skyModulationBinding(state(), sky({Venus: 270, Moon: 180}))
  await binding.write([{key: 'routes', value: JSON.stringify([{id: 'r1', planet: 'Venus', target: 'live:delay/feedback'}])}, {key: 'amount:r1', value: 100}, {key: 'smoothing:r1', value: 0}])
  await sm.runSkyModulation(state(), sky({Venus: 270, Moon: 180}), false)
  assert.equal(sm.skyModulationPlan().bases['live:delay/feedback'], 35, 'the base is the owner\'s value when the planet took it')
  assert.deepEqual(writes, [{kind: 'effect', effect: 'delay', key: 'feedback', value: 35 + 0.25 * 95}], 'a quarter turn past the middle: a quarter of 0–95 %')
  const moved = {...effects, delay: {...effects.delay, feedback: 58.75}}
  await sm.runSkyModulation(state(moved), sky({Venus: 270, Moon: 180}), false)
  assert.equal(writes.length, 1, 'nothing new under the same sky')
  assert.deepEqual(fx.torusEffectBinding('delay', state(moved), sm.skyHeldKeys('delay')).modulatedBy, {feedback: 'Venus'}, 'the effect names the planet')
  await sm.skyModulationBinding(state(moved), sky({Venus: 270})).write([{key: 'routes', value: '[]'}])
  await sm.runSkyModulation(state(moved), sky({Venus: 270}), false)
  assert.deepEqual(writes.at(-1), {kind: 'effect', effect: 'delay', key: 'feedback', value: 35}, 'the base goes back')
  assert.deepEqual(sm.skyModulationPlan().bases, {})
  sm.resetSkyModulation()
})

test('a refusal from an owner is kept in its words; off or taken off the chain, every base goes back', async () => {
  const writes = []
  let refuse = 'native audio unavailable'
  sm.resetSkyModulation({writer: async edit => { writes.push(edit); return refuse ? {ok: false, error: refuse} : {ok: true} }})
  sm.placeSkyModulation(true)
  await sm.skyModulationBinding(state(), sky({Mars: 0})).write([{key: 'routes', value: JSON.stringify([{id: 'r1', planet: 'Mars', target: 'live:filter/mix'}])},
    {key: 'amount:r1', value: 50}, {key: 'smoothing:r1', value: 0}])
  await sm.runSkyModulation(state(), sky({Mars: 0}), false)
  assert.match(sm.skyModulationPlan().refusal, /Filter Mix: native audio unavailable/)
  refuse = null
  sm.placeSkyModulation(false)
  await sm.runSkyModulation(state(), sky({Mars: 0}), false)
  assert.deepEqual(writes.at(-1), {kind: 'effect', effect: 'filter', key: 'mix', value: 100}, 'taken off: the base goes back')
  sm.resetSkyModulation()
})

test('the design draws every view on the binding: the Sky\'s bodies, the part\'s targets with their bases, the plan', () => {
  sm.resetSkyModulation()
  const binding = sm.skyModulationBinding(state(), sky({Sun: 185, Venus: 218}))
  const targets = JSON.parse(binding.values.targets)
  assert.equal(targets.find(t => t.id === 'live:filter/cutoff').base, 2400)
  assert.equal(JSON.parse(binding.values.bodies).length, 2); assert.equal(binding.values.light, 'lit'); assert.equal(binding.values.observer, 'shared')
  assert.equal(binding.writes('routes'), true); assert.equal(binding.writes('havePlace'), false)
  binding.local.selected('r1'); assert.equal(sm.skyModulationPlan().selected, 'r1', 'the selection is the view\'s own')
  for (const view of VIEWS) assert.ok(renderToStaticMarkup(h(HostedDevice, {designed: design, binding, view, nav: {}})).length > 0, view)
  assert.match(sm.skyModulationBinding(null, sky({})).values.reason, /No owner reading in this host/)
  sm.resetSkyModulation()
})
