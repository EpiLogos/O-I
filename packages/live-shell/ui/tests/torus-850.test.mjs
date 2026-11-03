import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'

// O-I #850: the Torus plays as QL designs it. Manual §21.2's parameters stand on the owner's M1′ session (QL `torus-state`, announced as
// `parameters.torus`): Rate (Free or Sync) with its band beside it, Fundamental, Carrier, Shape with the figure it shows, the Comma the
// owner gathers, Tuning (only what the scene holds resident), Polyphony and the notes the owner counts. Each change leaves through the
// one stage channel as the owner's own `torus` edit and reads back from the owner. The compact four are Rate, Fundamental, Carrier and
// Damping; the whole view carries the seven groups. Pulse mix, Helix balance, Drive, Agitation, Attack and Release are gone.
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
    return {format:'module',shortCircuit:true,source:outputText.split('import.meta.env').join('({BASE_URL: "/"})').split('import.meta.glob').join('(() => ({}))')};
  }
  return next(url,context);
}`)}`, {parentURL: import.meta.url})

const noop = () => {}
globalThis.__CRADLE_WALK__ = false
globalThis.document ??= {getElementById: () => null, createElement: () => ({style: {}, setAttribute: noop, appendChild: noop}), head: {appendChild: noop},
  addEventListener: noop, removeEventListener: noop, querySelector: () => null, querySelectorAll: () => [], documentElement: {style: {}}}
globalThis.window ??= globalThis
globalThis.addEventListener ??= noop; globalThis.removeEventListener ??= noop

const React = await import('react')
const {renderToStaticMarkup} = await import('react-dom/server')
const h = React.createElement
const src = path => new URL(`../src/${path}`, import.meta.url).href
const model = await import(src('live/torusDevice.ts'))
const holds = await import(src('techne/devices/designDevices.ts'))
const {HostedDevice, setHostPage, resetHost} = await import(src('frame/devices/deviceHost.tsx'))
const {torus} = await import(src('inhabitants/catalogue/panels/torus.tsx'))

const RETIRED = ['pulseMix', 'helixBalance', 'drive', 'agitation', 'attack', 'release']
/** The owner's session as the frame announces it (instrumentAnnouncement.mjs `parameters.torus`), shaped as the boundary reads it. */
const session = (over = {}, settings = {}) => ({
  settings: {rate: {mode: 'free', steps_per_second: 2.5}, fundamental: {source: 'map'}, carrier: 0, shape: 'auto', tuning: 'sky', polyphony: 16, tempo_bpm: 120, ...settings},
  steps_per_second: 2.5, band: 'rhythm', fundamental_hz: 130.81, map_hz: 130.81, figure: 'figure-eight', comma_cents: 23.46, notes: 2,
  resident_tunings: ['logic', 'sky'], carrier_drive: 'unbuilt', ...over,
})
const state = (torusSession = session(), standing = 'following') => ({ok: true,
  value: {schema: 'ql.instrument-reading/v1', standing, reason: null, identity: {event_ref: 'e', subject_ref: 's', registry_revision: 'r', geometry_ref: 'g', material_ref: 'm', model_ref: 'd'}},
  determinants: {lens: {lens12: 11, label: 'L5′'}, contextFrame: 7, harmonic: {selection: 'canonical-basis', index: 3}, rna: false},
  parameters: {muted: false, level: 0.5, scale: {unitsPerMetre: 120, mode: 'domain-follow'}, cadence: null, refusal: null, ...(torusSession ? {torus: torusSession} : {})}})
function bound(s = state()) {
  const sent = []
  const binding = model.torusDesignBinding(s, undefined, {}, null, undefined, null, holds.heldFor(model.TORUS_DESIGN_ID), null, null, null,
    async edit => { sent.push(edit); return {ok: true} })
  return {binding, sent}
}

test('every §21.2 setting stands on the owner\'s session: the rate with its band, the Fundamental, Carrier, Shape and figure, Comma, Tuning, Polyphony and notes', () => {
  const {binding} = bound()
  const v = binding.values
  assert.deepEqual([v['rate.mode'], v.rate, v.band, v.tempo], ['free', 2.5, 'Rhythm', 120])
  assert.deepEqual([v['fundamental.source'], v.fundamental], ['map', 130.81], 'Map: the Sun\'s 1:1, as the owner gives it')
  assert.deepEqual([v.carrier, v['carrier.drive']], [0, 'unbuilt'], 'Carrier as a percentage, and the owner\'s word for its drive')
  assert.deepEqual([v.shape, v.figure, v.comma], ['auto', 'figure-eight', 23.46])
  assert.deepEqual([v.tuning, JSON.parse(v['tuning.resident'])], ['sky', ['logic', 'sky']])
  assert.deepEqual([v.polyphony, v.notes], [16, 2], 'the owner counts the notes now')
  const sync = bound(state(session({steps_per_second: 2, figure: null}, {rate: {mode: 'sync', note: {numerator: 1, denominator: 4}}, shape: 'sequence'}))).binding
  assert.deepEqual([sync.values['rate.mode'], sync.values['rate.note'], sync.values.rate], ['sync', '1/4', 2])
  assert.equal(sync.values.figure, undefined, 'Sequence: QL names no figure')
  assert.match(sync.standing.figure.disabled, /Sequence/)
  for (const key of ['band', 'comma', 'figure', 'notes', 'carrier.drive', 'tuning.resident']) assert.equal(binding.writes(key), false, `${key}: a reading`)
})

test('each change reaches the owner\'s torus edit through the one stage channel, in QL\'s own form', async () => {
  holds.resetHolds()
  const moves = [
    [{key: 'rate', value: 440}, {rate: {mode: 'free', steps_per_second: 440}}],
    [{key: 'rate.mode', value: 'sync'}, {rate: {mode: 'sync', note: {numerator: 1, denominator: 4}}}],
    [{key: 'rate.note', value: '3/8'}, {rate: {mode: 'sync', note: {numerator: 3, denominator: 8}}}],
    [{key: 'rate.mode', value: 'free'}, {rate: {mode: 'free', steps_per_second: 2.5}}],
    [{key: 'tempo', value: 90}, {tempo_bpm: 90}],
    [{key: 'fundamental', value: 261.6}, {fundamental: {source: 'hz', hz: 261.6}}],
    [{key: 'fundamental.source', value: 'map'}, {fundamental: {source: 'map'}}],
    [{key: 'fundamental.source', value: 'hz'}, {fundamental: {source: 'hz', hz: 130.81}}],
    [{key: 'carrier', value: 25}, {carrier: 0.25}],
    [{key: 'shape', value: 'klein-bottle'}, {shape: 'klein-bottle'}],
    [{key: 'tuning', value: 'logic'}, {tuning: 'logic'}],
    [{key: 'polyphony', value: 4}, {polyphony: 4}],
  ]
  for (const [change, edit] of moves) {
    const {binding, sent} = bound()
    assert.equal(binding.writes(change.key), true, change.key)
    await binding.write([change])
    assert.deepEqual(sent, [{kind: 'torus', edit}], change.key)
  }
  const {binding} = bound()
  await assert.rejects(binding.write([{key: 'tuning', value: 'maqam'}]), /holds no Maqām voices/, 'a tuning the scene holds no voices for is refused by name')
  await assert.rejects(binding.write([{key: 'fundamental', value: 2500}]), /20 to 2,000 Hz/)
  await assert.rejects(binding.write([{key: 'polyphony', value: 40}]), /1 to 32/)
  holds.resetHolds()
})

test('without the owner\'s session every Torus setting stands dimmed, naming the owner op it waits on', () => {
  const {binding} = bound(state(null))
  for (const key of ['rate', 'rate.mode', 'fundamental', 'carrier', 'shape', 'tuning', 'polyphony', 'tempo']) {
    assert.equal(binding.writes(key), false, key)
    assert.match(binding.standing[key].disabled, /torus-state/, `${key}: names QL's torus-state`)
  }
  const manual = bound(state(session(), 'manual')).binding
  assert.equal(manual.writes('rate'), false)
  assert.equal(manual.standing.rate.disabled, 'The owner takes edits only while the instrument follows or is held.')
})

test('the retired controls are gone: Pulse mix, Helix balance, Drive, Agitation, Attack and Release', async () => {
  const {binding} = bound()
  for (const key of RETIRED) {
    assert.equal(key in torus.defaults, false, `${key}: no default`)
    assert.equal(key in model.TORUS_ABSENT, false, `${key}: no absence to name`)
    assert.equal(key in binding.standing, false, `${key}: no standing`)
    assert.equal(key in binding.values, false, `${key}: no value`)
  }
  for (const page of ['field', 'body']) {
    setHostPage(binding.id, page)
    const whole = renderToStaticMarkup(h(HostedDevice, {designed: torus, binding, view: 'whole', nav: {}}))
    for (const label of ['Pulse mix', 'Helices', 'Drive', 'Agitation', 'Attack', 'Release', 'Envelope']) assert.doesNotMatch(whole, new RegExp(`aria-label="${label}"`), `${page}: no ${label}`)
  }
  resetHost(binding.id)
})

test('the compact four are Rate, Fundamental, Carrier and Damping, on the device\'s rows and on the design', () => {
  const s = state()
  const device = model.torusDevice(s)
  assert.deepEqual(device.rows.filter(row => row.compact).map(row => row.key), ['rate', 'fundamental', 'carrier', 'damping'])
  assert.ok(device.rows.filter(row => row.compact).every(row => row.writePath), 'a following instrument takes each')
  const {binding} = bound(s)
  const compact = renderToStaticMarkup(h(HostedDevice, {designed: torus, binding, view: 'compact', nav: {}}))
  for (const label of ['Rate', 'Fundamental', 'Carrier', 'Damping']) assert.match(compact, new RegExp(`<span class="dp-label">${label}</span>`), label)
  assert.doesNotMatch(compact, /\bNaN\b|undefined|data-device-fault/)
})

test('the whole Torus carries the seven groups; the folded one its level, band and notes; the full one the comma at its edge', () => {
  const {binding} = bound()
  const sections = page => { setHostPage(binding.id, page); return [...renderToStaticMarkup(h(HostedDevice, {designed: torus, binding, view: 'whole', nav: {}})).matchAll(/class="dp-sec-label">([^<]+)</g)].map(m => m[1]) }
  const field = sections('field'), body = sections('body')
  for (const group of ['Pulse', 'Mode and tuning', 'Shape']) assert.ok(field.includes(group), `field page: ${group} (${field})`)
  for (const group of ['Body', 'Notes and output']) assert.ok(body.includes(group), `body page: ${group} (${body})`)
  setHostPage(binding.id, 'field')
  const folded = renderToStaticMarkup(h(HostedDevice, {designed: torus, binding, view: 'folded', nav: {}}))
  assert.match(folded, /Rhythm/); assert.match(folded, /2 notes/); assert.match(folded, /-6\.0 dB/)
  const full = renderToStaticMarkup(h(HostedDevice, {designed: torus, binding, view: 'full', nav: {}}))
  assert.match(full, /Comma 23\.46 ¢/)
  for (const view of ['folded', 'compact', 'whole', 'full', 'widget']) {
    for (const b of [binding, model.torusDesignBinding(null)]) assert.doesNotMatch(renderToStaticMarkup(h(HostedDevice, {designed: b === binding ? torus : torus, binding: b, view, nav: {}})), /\bNaN\b|undefined|data-device-fault/, view)
  }
  resetHost(binding.id)
})
