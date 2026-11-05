import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'
import {readFile} from 'node:fs/promises'

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
  for (const key of ['band', 'comma', 'figure', 'notes', 'carrier.drive', 'tuning.resident', 'tempo']) assert.equal(binding.writes(key), false, `${key}: a reading`)
})

test('each change reaches the owner\'s torus edit through the one stage channel, in QL\'s own form', async () => {
  holds.resetHolds()
  const moves = [
    [{key: 'rate', value: 440}, {rate: {mode: 'free', steps_per_second: 440}}],
    [{key: 'rate.mode', value: 'sync'}, {rate: {mode: 'sync', note: {numerator: 1, denominator: 4}}}],
    [{key: 'rate.note', value: '3/8'}, {rate: {mode: 'sync', note: {numerator: 3, denominator: 8}}}],
    [{key: 'rate.mode', value: 'free'}, {rate: {mode: 'free', steps_per_second: 2.5}}],
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
  await assert.rejects(binding.write([{key: 'fundamental', value: 2500}]), /20 to 2,000 Hz/)
  await assert.rejects(binding.write([{key: 'polyphony', value: 40}]), /1 to 32/)
  holds.resetHolds()
})

test('Maqām reaches the owner, which sounds the condition\'s maqām or refuses in its words, naming the source it lacks (O-I 854)', async () => {
  holds.resetHolds()
  // QL scene_field.rs maqam_absence: the scene holds no maqām voices, and the owner says why, the frame never guesses it.
  const words = 'maqām Kirdan (#2-4.3-0-4), the condition\'s tonic, has no Bimba spelling in the map, so its eight pitches have no source, and no other tuning stands in'
  const sent = []
  const binding = model.torusDesignBinding(state(), undefined, {}, null, undefined, null, holds.heldFor(model.TORUS_DESIGN_ID), null, null, null,
    async edit => { sent.push(edit); return {ok: false, error: words} })
  assert.equal(binding.writes('tuning'), true, 'Maqām is offered whether or not the scene holds its voices: the owner answers')
  await assert.rejects(binding.write([{key: 'tuning', value: 'maqam'}]), error => error.message.includes('no Bimba spelling') && error.message.includes('Kirdan'))
  assert.deepEqual(sent, [{kind: 'torus', edit: {tuning: 'maqam'}}], 'the choice left in QL\'s form; the refusal is the owner\'s')
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

test('no retired control stands where the Torus is named elsewhere: the Rack\'s map says the manual\'s rows, a clip automates what the Torus takes, the Sky moves what it reports (O-I #850)', async () => {
  const {RACK_CARRIED} = await import('../src/inhabitants/ql/devices/qlRack.ts')
  // Manual §21.2 "Where you work it", positions 3 to 5, in its own words.
  assert.deepEqual(RACK_CARRIED[1].slice(3).map(row => row.where), [
    'Rate, Carrier, and the context frame.',
    'Lens and mode, Tuning, Scale mapping (§21.3), Exact-ratio tuning (§21.4) and the keyboard.',
    'The surface, the View, Shape and Comma, and the Body group: Body, Strike, Damping, Modes and Body source. The material comes from the lens in force and M2′\'s tattvas.'])
  const words = ['Pulse mix', 'Helix balance', 'Drive', 'Agitation', 'Attack', 'Release']
  const clip = await readFile(new URL('../src/inhabitants/catalogue/clips/live.tsx', import.meta.url), 'utf8')
  const torusTargets = /^\s*torus: \[(.*)\],$/m.exec(clip)?.[1] ?? ''
  assert.deepEqual([...torusTargets.matchAll(/label: '([^']+)'/g)].map(m => m[1]), ['Fundamental', 'Carrier', 'Damping', 'Strike'], 'a clip automates the Torus\'s own settings')
  for (const word of words) assert.doesNotMatch(torusTargets, new RegExp(`'${word}'`), `clip envelope: no ${word}`)
  const sky = (await import('../src/inhabitants/catalogue/panels/quaternal-logic__sky.tsx')).design
  const targets = JSON.parse(sky.defaults.moves).map(move => move.target)
  for (const target of targets) assert.ok(['Level', 'Scale', 'Carrier', 'Rate', 'Fundamental'].includes(target), `the Sky's moves name a target it reports (skyModulation.ts skyTargets): ${target}`)
})

test('the lens in force gives the surface its material, as the owner reports it: a lens and its partner show opposite surfaces, and changing the lens leaves the notes alone (O-I #854)', () => {
  // QL m2_material.rs LensMaterial, as the boundary reads it (protocol.ts readTorusMaterial).
  const material = (lens, partner, face, valence, colour_rgb, roughness, elasticity) => ({lens, partner, face, position: 2, valence, colour_rgb, roughness, elasticity,
    particle_affinity: 0.4, tension: 0.5, standing: 'derived', law: 'M2-1′: a lens and its position give the surface; its partner the opposite.'})
  const day = bound(state(session({material: material('L2', 'L2′', 'day', 1, [0.8, 0.6, 0.2], 0.3, 0.7)}))).binding
  const night = bound(state(session({material: material('L2′', 'L2', 'night', -1, [0.2, 0.4, 0.8], 0.7, 0.3)}))).binding
  assert.deepEqual(JSON.parse(day.values.material), {lens: 'L2', partner: 'L2′', face: 'day', valence: 1, colour: [0.8, 0.6, 0.2], grain: 0.3, give: 0.7, affinity: 0.4, tension: 0.5})
  assert.equal(day.writes('material'), false, 'a reading: the lens in force sets it')
  const dayM = JSON.parse(day.values.material), nightM = JSON.parse(night.values.material)
  assert.deepEqual([dayM.valence, nightM.valence], [1, -1], 'a lens and its partner: opposite surfaces')
  for (const key of Object.keys(day.values)) if (key !== 'material') assert.deepEqual(night.values[key], day.values[key], `${key}: the lens leaves it alone`)
  const none = bound(state(session({material: {absent: 'No lens is in force: the scene names none.'}}))).binding
  assert.equal(none.values.material, undefined)
  assert.equal(none.standing.material.disabled, 'No lens is in force: the scene names none.', 'its absence in the owner\'s words')
  assert.match(bound().binding.standing.material.disabled, /lens/, 'an owner from before it: absent with its reason')
  // Drawn beside the lens it comes from, on the Pulse page.
  setHostPage(day.id, 'field')
  const whole = renderToStaticMarkup(h(HostedDevice, {designed: torus, binding: day, view: 'whole', nav: {}}))
  assert.match(whole, /L2 · day/, 'the surface: the lens and its face')
  assert.match(whole, /grain 30 %, give 70 %/, '… and how it takes the sound')
  resetHost(day.id)
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

test('the Torus steps to the set\'s tempo: the transport\'s Tempo reaches the owner\'s torus edit, so Sync follows it, and the Tempo here is a reading', async () => {
  // DLW §21.2 Rate: Sync is one step per note length "at the set's tempo". The set's tempo is the transport's reading (TransportBar's
  // Tempo), handed to the chain as the Delay's is (designBindings/torusEffects.ts followSetTempo).
  const synced = state(session({steps_per_second: 2}, {rate: {mode: 'sync', note: {numerator: 1, denominator: 4}}}))
  assert.deepEqual(model.torusTempoEdit(synced, 96), {kind: 'torus', edit: {tempo_bpm: 96}}, 'the set\'s tempo, as the owner\'s own edit')
  assert.deepEqual(model.torusTempoEdit(synced, 96.256), {kind: 'torus', edit: {tempo_bpm: 96.26}}, 'to the hundredth, as the transport shows it')
  assert.equal(model.torusTempoEdit(synced, 120), null, 'the owner already steps to it: nothing is sent')
  assert.equal(model.torusTempoEdit(synced, null), null, 'a set that states no tempo moves nothing')
  assert.equal(model.torusTempoEdit(state(null), 96), null, 'no session, nothing to follow')
  assert.equal(model.torusTempoEdit(state(session(), 'manual'), 96), null, 'the owner takes no edit now')
  assert.equal(model.torusTempoEdit(synced, 1200), null, 'outside the owner\'s 20 to 999 BPM nothing is sent')
  const sent = []
  const commit = async edit => { sent.push(edit); return {ok: true} }
  await model.followSetTempoOnTorus(synced, 96, commit)
  await model.followSetTempoOnTorus(synced, 120, commit)
  assert.deepEqual(sent, [{kind: 'torus', edit: {tempo_bpm: 96}}], 'one edit, and none for a tempo the owner already has')
  await assert.rejects(model.followSetTempoOnTorus(synced, 90, async () => ({ok: false, error: 'controlled refusal'})), /controlled refusal/)
  // Here the Tempo reads the owner's, which follows the set's; the transport is where the tempo changes.
  const {binding} = bound(synced)
  assert.equal(binding.writes('tempo'), false)
  assert.match(binding.standing.tempo.disabled, /set's tempo, from the transport/)
  setHostPage(binding.id, 'field')
  const whole = renderToStaticMarkup(h(HostedDevice, {designed: torus, binding, view: 'whole', nav: {}}))
  assert.match(whole, /<output class="dp-readout-value"[^>]*>120 BPM<\/output><span class="dp-label">Tempo<\/span>/, 'a reading, not a box to type in')
  resetHost(binding.id)
  // The chain hands the Torus the set's tempo, as it hands the Delay its own.
  const chain = await readFile(new URL('../src/live/LiveDeviceChain.tsx', import.meta.url), 'utf8')
  assert.match(chain, /<TorusOnChain state=\{torus\} tempoBpm=\{ctx\.set\?\.tempo_bpm \?\? null\}[^>]*\/>/)
})

test('the Carrier\'s words follow the owner\'s drive: under the pulse, 0 % is silence until struck, a beat at rhythm rates, a note at pitch rates', () => {
  // QL's carrier (m1_prime.rs carrier_step; continuous_field.hpp set_carrier): the owner's word for its drive is "pulse".
  const {binding} = bound(state(session({carrier_drive: 'pulse'}, {carrier: 0.5})))
  assert.equal(binding.values['carrier.drive'], 'pulse')
  assert.doesNotMatch(binding.standing['carrier.drive'].disabled, /287|only when struck/, 'no word of a drive that is not built')
  assert.match(binding.standing['carrier.drive'].disabled, /each step of the pulse drives the body/)
  setHostPage(binding.id, 'field')
  const whole = renderToStaticMarkup(h(HostedDevice, {designed: torus, binding, view: 'whole', nav: {}}))
  assert.match(whole, /At 0 % the body sounds only when something strikes it; at rhythm rates the carrier beats; at pitch rates it sounds\./)
  assert.doesNotMatch(whole, /its drive is not built yet/)
  resetHost(binding.id)
})

// O-I #855 round 6d (854's PROPOSE): the owner's session names the M2 condition's maqām beside the tunings it holds (QL scene_field.rs
// maqam_reading: its pitches while the scene holds its voices, else `absent` in the owner's words naming the source it lacks), so the
// Tuning control says why Maqām is absent before it is chosen, in the owner's words; a maqām the scene holds is named on its choice.
test('the Tuning says why the maqām is absent before it is chosen, in the owner\'s words, and names the maqām the scene holds', () => {
  const absent = 'maqām Kirdan (#2-4.3-0-4), the condition\'s tonic, has no Bimba spelling in the map, so its eight pitches have no source, and no other tuning stands in'
  const maqam = {name: 'Kirdan', coordinate: '#2-4.3-0-4', role: 'tonic', tonic_hz: 196, tuning: 'bimba-spelled24-tet', standing: 'source-held', pitches_hz: null, absent}
  const {binding} = bound(state(session({maqam})))
  assert.deepEqual(JSON.parse(binding.values['tuning.maqam']), {name: 'Kirdan', absent}, 'the owner\'s maqām and its words for its absence')
  assert.equal(binding.writes('tuning.maqam'), false, 'a reading')
  setHostPage(binding.id, 'field')
  const whole = renderToStaticMarkup(h(HostedDevice, {designed: torus, binding, view: 'whole', nav: {}}))
  assert.ok(whole.includes('This scene holds no Maqām voices: maqām Kirdan (#2-4.3-0-4), the condition&#x27;s tonic, has no Bimba spelling in the map'),
    'the Tuning says why, before Maqām is chosen')
  resetHost(binding.id)
  const held = bound(state(session({resident_tunings: ['logic', 'maqam', 'sky'], maqam: {...maqam, absent: null, pitches_hz: [196, 220, 233, 262, 294, 311, 349, 392]}}))).binding
  assert.deepEqual(JSON.parse(held.values['tuning.maqam']), {name: 'Kirdan', absent: null})
  setHostPage(held.id, 'field')
  assert.match(renderToStaticMarkup(h(HostedDevice, {designed: torus, binding: held, view: 'whole', nav: {}})), /The voices sound the M2 condition&#x27;s maqām, Kirdan\./)
  resetHost(held.id)
  assert.equal(bound().binding.values['tuning.maqam'], undefined, 'an owner that names no maqām: nothing to say')
})

test('the manual names the Torus by its own controls wherever it shows it: the device reference and the two scales say §21.2\'s macros, its one handle and what the Sky moves (DLW build ruling, 4 November)', async () => {
  const manual = await readFile(new URL('../../../../ProjectCentral/docs/1-vision/dlw/DLW.md', import.meta.url), 'utf8')
  // The device reference (§16) shows the Torus under "#### Torus", up to the next heading of any depth; the two scales under "#### Two scales".
  const passage = heading => { const at = manual.indexOf(`\n#### ${heading}\n`); assert.ok(at >= 0, heading); const rest = manual.slice(at + 1); return rest.slice(0, rest.search(/\n#{2,4} /)) }
  const reference = passage('Torus'), scales = passage('Two scales')
  for (const word of ['Pulse mix', 'Helix balance', 'Drive', 'Agitation', 'Attack', 'Release', 'handle 2', 'Envelope']) {
    assert.doesNotMatch(reference, new RegExp(word), `the device reference: no ${word}`)
    assert.doesNotMatch(scales, new RegExp(word), `the two scales: no ${word}`)
  }
  // §21.2 Compact: Rate, Fundamental, Carrier and Damping; the one handle on the picture is the Rate's (torus.tsx TorusPicture).
  const compact = /^\| Compact \| (.*) \|$/m.exec(reference)?.[1] ?? ''
  assert.match(compact, /Macros: Rate, Fundamental, Carrier, Damping\./)
  assert.match(compact, /Handle 1 on the pulse line/)
  const whole = /^\| Whole \| (.*) \|$/m.exec(reference)?.[1] ?? ''
  for (const group of ['Pulse', 'Mode and tuning', 'Shape', 'Body', 'Notes and output', 'Stage', 'Rack']) assert.match(whole, new RegExp(group), `the whole view: ${group}`)
  // What the Sky moves is what it reports (skyModulation.ts skyTargets, asserted above): the arc stands on one of those.
  assert.match(reference, /Carrier carries a modulation arc: the sky moves it\./)
  // §16.15's six reference devices say what the Torus shows: its one handle, no envelope display.
  const shows = /^\| Torus \| Instrument \| (.*) \| Wavetable \|$/m.exec(manual)?.[1] ?? ''
  assert.match(shows, /A handle on the picture\./)
  assert.doesNotMatch(shows, /[Ee]nvelope/)
})

// ── the rack face (DLW build ruling, 4 November: "Keep rack: build it. Give the Torus a rack face with macros (each with its range) and
// variations, and a keep-rack action through the kernel's rack keep"; manual §21.2 Sounds and instruments: "A rack | The Torus with its
// note devices and effects, its macros and their variations"). The macros start as the compact four, each turning its parameter over a
// range you set; a variation keeps where every macro stands; Keep rack keeps the Torus, its chain, its macros and its variations.

const EFFECTS = {chain: ['delay'], filter: {on: false, cutoff: 1200}, dynamics: {on: false}, delay: {on: true, time: 375, feedback: 40, mix: 25}, reverb: {on: false}}
const withEffects = (effects = EFFECTS) => { const s = state(); return {...s, parameters: {...s.parameters, effects}} }

test('the rack face reads the Torus\'s chain from the owner, and holds its macros, the macro you choose and its variations in your hand', () => {
  holds.resetHolds()
  const {binding} = bound(withEffects())
  assert.deepEqual(JSON.parse(binding.values.chain), [{device_ref: 'delay', role: 'effect', state: {on: true, time: 375, feedback: 40, mix: 25}}],
    'the effects on the chain, in the order they sound, each with the settings the owner keeps')
  assert.equal(binding.writes('chain'), false)
  assert.match(binding.standing.chain.disabled, /owner/)
  assert.deepEqual(JSON.parse(bound(withEffects({...EFFECTS, chain: []})).binding.values.chain), [], 'nothing on the chain: the Torus alone')
  assert.equal(bound().binding.values.chain, undefined, 'an owner that reports no effects: no chain is invented')
  for (const key of ['macros', 'macro', 'variations']) assert.equal(typeof binding.local[key], 'function', `${key}: held in the shell`)
  binding.local.variations(JSON.stringify([{name: 'Variation 1', values: [0, 0, 0, 0]}]))
  assert.deepEqual(JSON.parse(bound(withEffects()).binding.values.variations), [{name: 'Variation 1', values: [0, 0, 0, 0]}])
  holds.resetHolds()
})

test('a macro turns its parameter over its range: at 0 the range\'s start, at 1 its end; where it stands is read from the parameter', async () => {
  const face = await import(src('inhabitants/catalogue/panels/torus.tsx'))
  const four = face.torusMacros({})
  assert.deepEqual(four.map(m => [m.name, m.parameter, m.min, m.max]), [['Rate', 'rate', 0.5, 20], ['Fundamental', 'fundamental', 20, 2000], ['Carrier', 'carrier', 0, 100],
    ['Damping', 'damping', 0.1, 40]], 'the compact four, each over its range')
  const carrier = four[2]
  assert.equal(face.macroAt({carrier: 25}, carrier), 0.25)
  assert.equal(face.macroAt({carrier: 250}, carrier), 1, 'past the range: the macro stands at its end')
  assert.equal(face.macroAt({}, carrier), undefined, 'no reading: the macro does not say where it stands')
  assert.equal(face.macroTurn(carrier, 0.5), 50)
  assert.equal(face.macroTurn({...carrier, min: 80, max: 20}, 0.25), 65, 'a range may run downward')
  const v = {rate: 2.5, fundamental: 130.81, carrier: 25, damping: 4.5, chain: JSON.stringify([{device_ref: 'delay', role: 'effect', state: {on: true}}]),
    variations: JSON.stringify([{name: 'Variation 1', values: [1, 0, 0.5, 0]}])}
  const draft = face.torusRackDraft(v)
  assert.deepEqual(draft.chain, [{device_ref: 'delay', role: 'effect', state: {on: true}}])
  assert.deepEqual(draft.macros.map(m => [m.name, Number(m.value.toFixed(4)), m.targets]), [
    ['Rate', 0.1026, [{device_ref: 'torus', parameter: 'rate', min: 0.5, max: 20}]], ['Fundamental', 0.056, [{device_ref: 'torus', parameter: 'fundamental', min: 20, max: 2000}]],
    ['Carrier', 0.25, [{device_ref: 'torus', parameter: 'carrier', min: 0, max: 100}]], ['Damping', 0.1103, [{device_ref: 'torus', parameter: 'damping', min: 0.1, max: 40}]]])
  assert.deepEqual(draft.variations, [{name: 'Variation 1', values: [1, 0, 0.5, 0]}])
  assert.match(face.torusRackDraft({...v, carrier: undefined}).reason, /^Carrier has no reading/, 'a macro that cannot say where it stands keeps no rack')
  assert.match(face.torusRackDraft({...v, chain: undefined}).reason, /chain/, 'no reading of the chain keeps no rack')
  assert.match(face.torusRackDraft({...v, variations: JSON.stringify([{name: 'Short', values: [1]}])}).reason, /Short/, 'a variation short of a value for every macro')
})

test('the Macros page draws each macro with its range, the macro you choose to set, the variations and Keep rack, on the owner\'s readings', () => {
  holds.resetHolds()
  const {binding} = bound(withEffects())
  setHostPage(binding.id, 'macros')
  const whole = renderToStaticMarkup(h(HostedDevice, {designed: torus, binding, view: 'whole', nav: {}}))
  const sections = [...whole.matchAll(/class="dp-sec-label">([^<]+)</g)].map(m => m[1])
  for (const group of ['Macros', 'Range', 'Variations', 'Keep rack']) assert.ok(sections.includes(group), `${group} (${sections})`)
  for (const name of ['Rate', 'Fundamental', 'Carrier', 'Damping']) assert.match(whole, new RegExp(`aria-label="${name}"`), `${name}: a macro`)
  assert.match(whole, /Turns the Torus&#x27;s carrier from 0 to 100\./, 'a macro says the range it turns its parameter over')
  assert.match(whole, /Delay/, 'the chain it keeps, by its effects')
  assert.match(whole, /data-i="Keep rack\|/, 'Keep rack, saying what it keeps or why it waits')
  assert.doesNotMatch(whole, /\bNaN\b|undefined|data-device-fault/)
  resetHost(binding.id)
  holds.resetHolds()
})

// ── View, kept (lead's ruling of 4 November: "#850 View kept"; manual §21.2 "View | Surface · Wire · Both, and Receiver On · Off |
// Surface · Off | What the pane draws"). View is the pane's own way of drawing, so the hand keeps it, as it keeps Body source; it reads
// back, and the pane draws the torus as a surface, as its wire, or both. Receiver stays the owner's.

const onChain = await import(src('live/TorusOnChain.tsx'))

test('View is kept in your hand: Surface until you choose, read back as you set it, and never sent to the owner (O-I #850)', () => {
  holds.resetHolds()
  assert.equal(model.TORUS_ABSENT.view, undefined, 'View is no longer a reading nobody keeps')
  const {binding, sent} = bound()
  assert.equal(binding.values.view, 'surface', 'Surface is the default (§21.2)')
  assert.equal(binding.standing.view, undefined, 'and it takes a change')
  assert.equal(typeof binding.local.view, 'function', 'the hand keeps it')
  binding.local.view('wire')
  assert.equal(bound().binding.values.view, 'wire', 'it reads back as you set it')
  binding.local.view('sideways')
  assert.equal(bound().binding.values.view, 'surface', 'a value View does not take draws the default')
  assert.deepEqual(sent, [], 'nothing reaches the owner')
  holds.resetHolds()
})

test('the pane draws the View: the surface hides the far side under the body, the wire is the lines alone, both draws the lines over the body', () => {
  const figure = model.torusFigure('full')
  assert.match(figure.outline, /^M[-\d. L]+Z$/, 'the silhouette is one closed path')
  const numbers = figure.outline.match(/-?\d+(?:\.\d+)?/g).map(Number), {x, y, width, height} = figure.view
  for (let i = 0; i < numbers.length; i += 2) assert.ok(numbers[i] >= x && numbers[i] <= x + width && numbers[i + 1] >= y && numbers[i + 1] <= y + height, 'inside the picture')
  const live = {ok: true, value: state().value, determinants: state().determinants, parameters: state().parameters}
  const order = view => [...renderToStaticMarkup(h(onChain.TorusPicture, {state: live, size: 'full', view})).matchAll(/data-torus-(side="far"|side="near"|body)/g)].map(m => m[1])
  assert.deepEqual(order('surface'), ['side="far"', 'body', 'side="near"'], 'Surface: the far side shows faintly through the body')
  assert.deepEqual(order('wire'), ['side="far"', 'side="near"'], 'Wire: the lines alone')
  assert.deepEqual(order('both'), ['body', 'side="far"', 'side="near"'], 'Both: the lines over the body')
  assert.match(renderToStaticMarkup(h(onChain.TorusPicture, {state: live, size: 'compact'})), /data-torus-view="surface"/, 'unchosen, the picture is the surface')
  // The design's own picture draws it the same way, from the View the binding reads back.
  holds.resetHolds()
  const draws = view => { holds.hold(model.TORUS_DESIGN_ID, 'view', view); const {binding} = bound(); setHostPage(binding.id, 'field')
    const markup = renderToStaticMarkup(h(HostedDevice, {designed: torus, binding, view: 'whole', nav: {}})); resetHost(binding.id); return markup }
  assert.match(draws('surface'), /data-torus-view="surface"[^]*data-torus-body/)
  assert.doesNotMatch(draws('wire'), /data-torus-body/)
  assert.match(draws('both'), /data-torus-view="both"[^]*data-torus-body/)
  holds.resetHolds()
})

// ── Lens and mode, Follow (lead's ruling of 4 November: "read the clip's mode for the Torus part"; manual §21.2 "Lens and mode | Follow
// · a lens and a mode | Follow | The lens and mode the Torus reads. Follow takes the clip's mode, or the set's when the clip has none").
// QL's own spellings: a mode is a context frame (QL-MEF music.rs ModeKind::context_frame, Ionian CF1 … Locrian CF7); the catalogue
// names a lens by its code and a frame by "CF1"…"CF7" (ql-cli music_command.rs `lens`, `context_frame`); the owner's edits take
// `lens12` 0…11 (LensId::ALL) and `context_frame` 1…7 (m1_engine.rs). A clip carries its own mode when Live's scale is on for it
// (live-set edit.rs "scale" = IsInKey, "mode").

const modes = await import(src('live/modes.ts'))
const lensRow = (lens, mode, cf) => ({kind: 'lens-cf', key: `chromatic/${lens}/${mode}`, label: `${mode} on ${lens}, chromatic basis`, lens, anchorBasis: 'chromatic',
  contextFrame: cf, mode, pitches: [0, 2, 3, 5, 7, 8, 10], tuning: null, provenance: {owner: 'ql-mef', symbol: 'mode_tonic_landscape', revision: 't'}})
const AEOLIAN_L3P = lensRow("L3'", 'aeolian', 'CF6')
const RAST = {kind: 'source', key: 'maqam/rast', label: 'Rast', family: 'maqam', pitches: null,
  tuning: {unit: 'quarter-tone', steps: [4, 3, 3, 4, 4, 3, 3], fromRoot: [0, 4, 7, 10, 14, 18, 21, 24], cents: [0, 200, 350, 500, 700, 900, 1050, 1200]},
  provenance: {owner: 'ql-mef', symbol: 'maqam_pitches', revision: 't'}}
const setMode = scale => modes.resolveModeInForce([scale], {key: scale.key, root: 0})
const NONE_CHOSEN = modes.resolveModeInForce([AEOLIAN_L3P], null)

test('Follow takes the clip\'s mode, or the set\'s when the clip has none, in QL\'s own lens and frame', () => {
  const clip = model.torusFollowed({scale: true, mode: 'dorian'}, setMode(AEOLIAN_L3P))
  assert.equal(clip.from, 'clip')
  assert.equal(clip.context_frame, 2, 'Dorian is CF2 (music.rs ModeKind::context_frame)')
  assert.equal(clip.lens12, 7, 'on the set\'s lens, L3′ (LensId::ALL index 7)')
  assert.match(clip.words, /the clip's mode, Dorian \(CF2\), on the set's lens L3′/)
  const set = model.torusFollowed({scale: false, mode: 'dorian'}, setMode(AEOLIAN_L3P))
  assert.deepEqual([set.from, set.lens12, set.context_frame], ['set', 7, 6], 'a clip whose scale is off carries no mode: the set\'s Aeolian on L3′ (CF6)')
  assert.match(set.words, /the set's mode, Aeolian on L3′ \(CF6\)/)
  assert.deepEqual([model.torusFollowed(null, setMode(AEOLIAN_L3P)).from, model.torusFollowed({scale: true, mode: null}, setMode(AEOLIAN_L3P)).from], ['set', 'set'],
    'no clip, or a clip whose scale Live names outside the seven: the set\'s')
  const alone = model.torusFollowed({scale: true, mode: 'locrian'}, NONE_CHOSEN)
  assert.deepEqual([alone.from, alone.lens12, alone.context_frame], ['clip', null, 7], 'the clip\'s Locrian with no lens in force: the lens stands as it is')
  assert.match(alone.words, /the set names no lens, so the lens stands as it is/)
  assert.match(model.torusFollowed(null, NONE_CHOSEN).reason, /^The clip carries no mode of its own, and the set has none in force/)
  assert.match(model.torusFollowed(null, setMode(RAST)).reason, /Rast.*names no lens or frame/, 'a maqām in force names no lens or frame')
  assert.equal(model.torusFollowed(null, setMode(lensRow('L0', 'ionian', 'CF1'))).lens12, 0)
  assert.equal(model.torusFollowed(null, setMode(lensRow("L5'", 'locrian', 'CF7'))).lens12, 11)
})

test('Follow moves the owner only where it differs, through its own lens and context-frame edits, and only while it takes edits', () => {
  const followed = model.torusFollowed({scale: true, mode: 'dorian'}, setMode(AEOLIAN_L3P))
  assert.deepEqual(model.torusFollowEdits(state(), followed), [{kind: 'lens', lens12: 7}, {kind: 'context-frame', context_frame: 2}])
  const there = {...state(), determinants: {...state().determinants, lens: {lens12: 7, label: 'L3′'}, contextFrame: 2}}
  assert.deepEqual(model.torusFollowEdits(there, followed), [], 'the owner already reads it: nothing is sent')
  assert.deepEqual(model.torusFollowEdits(state(), model.torusFollowed({scale: true, mode: 'locrian'}, NONE_CHOSEN)), [], 'L5′ CF7 already: the lens stands, the frame is there')
  assert.deepEqual(model.torusFollowEdits(state(session(), 'manual'), followed), [], 'an owner that takes no edits now is sent none')
  assert.deepEqual(model.torusFollowEdits(state(), model.torusFollowed(null, NONE_CHOSEN)), [], 'nothing to follow sends nothing')
})

function followBound(follow, s = state()) {
  return model.torusDesignBinding(s, undefined, {}, null, undefined, null, holds.heldFor(model.TORUS_DESIGN_ID), null, null, null, async () => ({ok: true}), undefined, follow)
}

// REPLACED (lane BA, round 865, DLW build ruling 2026-11-05): under Follow the Lens and Frame are no longer closed. A hand-moved or
// MIDI-mapped Lens or Frame turns Follow off, as a hand move takes a Live control out of its automation (below).
test('the binding: Follow is on until you turn it off, the Lens and Frame stay in your hand, and off they are yours to choose', () => {
  holds.resetHolds()
  const followed = model.torusFollowed({scale: true, mode: 'dorian'}, setMode(AEOLIAN_L3P))
  const on = followBound(followed)
  assert.equal(on.values['mode.follow'], true, 'Follow is the default (§21.2)')
  assert.equal(on.values['mode.followed'], 'Clip: Dorian, L3′')
  assert.equal(typeof on.local['mode.follow'], 'function', 'the hand keeps Follow')
  for (const key of ['lens', 'context-frame']) {
    assert.equal(on.writes(key), true, `${key}: a move of yours is sent, and turns Follow off`)
    assert.equal(on.standing[key]?.disabled, undefined, `${key}: not closed under Follow`)
  }
  const nothing = followBound(model.torusFollowed(null, NONE_CHOSEN))
  assert.equal(nothing.values['mode.followed'], undefined)
  assert.match(nothing.standing['mode.followed'].disabled, /^The clip carries no mode of its own/)
  on.local['mode.follow'](false)
  const off = followBound(followed)
  assert.equal(off.values['mode.follow'], false)
  for (const key of ['lens', 'context-frame']) assert.equal(off.writes(key), true, `${key}: yours to choose`)
  assert.match(off.standing['mode.followed'].disabled, /Follow is off/)
  holds.resetHolds()
  const host = model.torusDesignBinding(state())
  assert.match(host.standing['mode.follow'].disabled, /no clip or set/i, 'a host that reads no clip and no set says Follow has nothing to read')
  assert.equal(host.writes('lens'), true, 'and the lens stays yours, as before')
})

// DLW build ruling 2026-11-05: a hand-moved or MIDI-mapped Lens or Frame turns Follow off, as a hand move takes a Live control out of
// its automation; the readout says so in words, and turning Follow on follows again. Every write reaches the owner through the one stage
// channel (torusInstrument.ts commitLiveStage), which tells its listeners whether the hand sent it: the device's own rows, the Live
// instrument section and a mapped control send theirs as the hand's; Follow's own edits, a take played again, a sound or rack recalled
// and the set opening with its Torus do not, so none of them turns Follow off.
test('a Lens or Frame moved by hand or by a mapped control turns Follow off and says so; an edit the hand did not send does not; Follow on follows again', () => {
  holds.resetHolds()
  const followed = model.torusFollowed({scale: true, mode: 'dorian'}, setMode(AEOLIAN_L3P))
  model.torusFollowMoved({command: 'instrument', edit: {kind: 'lens', lens12: 7}}, {})
  model.torusFollowMoved({command: 'instrument', edit: {kind: 'context-frame', context_frame: 5}})
  assert.equal(holds.heldFor(model.TORUS_DESIGN_ID)['mode.follow'], undefined, 'a Lens or Frame the hand did not send is not a move')
  model.torusFollowMoved({command: 'instrument', edit: {kind: 'level', value: 0.5}}, {hand: true})
  model.torusFollowMoved({command: 'strike-at', points: []}, {hand: true})
  assert.equal(holds.heldFor(model.TORUS_DESIGN_ID)['mode.follow'], undefined, 'a move of anything else leaves Follow on')
  model.torusFollowMoved({command: 'instrument', edit: {kind: 'context-frame', context_frame: 5}}, {hand: true})
  assert.equal(holds.heldFor(model.TORUS_DESIGN_ID)['mode.follow'], false, 'a Frame moved by hand or a mapped control turns Follow off')
  const off = followBound(followed)
  assert.equal(off.values['mode.follow'], false)
  assert.match(off.standing['mode.followed'].disabled, /^Follow is off: you moved the Frame yourself\. Turn Follow on to follow the clip's or the set's mode again\.$/)
  model.torusFollowMoved({command: 'instrument', edit: {kind: 'lens', lens12: 3}}, {hand: true})
  assert.match(followBound(followed).standing['mode.followed'].disabled, /you moved the Frame yourself/, 'Follow already off: the first move stays the reason')
  off.local['mode.follow'](true)
  const again = followBound(followed)
  assert.equal(again.values['mode.follow'], true, 'Follow on follows again')
  assert.equal(again.values['mode.followed'], 'Clip: Dorian, L3′')
  assert.equal(holds.heldFor(model.TORUS_DESIGN_ID)['mode.followOff'], undefined, 'and the reason is gone with it')
  off.local['mode.follow'](false)
  assert.match(followBound(followed).standing['mode.followed'].disabled, /^Follow is off: the lens and mode are the ones you choose\.$/, 'turned off by its own toggle')
  holds.resetHolds()
})

test('the stage channel tells its listeners whether the hand sent a write: the device\'s own Lens row is the hand\'s, an edit sent without it is not', async () => {
  holds.resetHolds()
  const instrument = await import(src('live/torusInstrument.ts'))
  const heard = []
  instrument.setLiveInstrumentCommander(async () => ({ok: true}))
  const stop = instrument.subscribeAcceptedLiveWrites((command, how) => heard.push([command.edit?.kind, how?.hand === true]))
  const stopFollow = instrument.subscribeAcceptedLiveWrites(model.torusFollowMoved)
  try {
    await instrument.commitLiveInstrumentEdit({kind: 'lens', lens12: 2})
    assert.deepEqual(heard, [['lens', false]], 'an edit sent without the hand is told as not the hand\'s')
    assert.equal(holds.heldFor(model.TORUS_DESIGN_ID)['mode.follow'], undefined, 'and leaves Follow on')
    await model.torusDevice(state()).submit([{key: 'lens', value: 'L3′'}])
    assert.deepEqual(heard[1], ['lens', true], 'the device\'s own Lens row sends its edit as the hand\'s')
    assert.equal(holds.heldFor(model.TORUS_DESIGN_ID)['mode.follow'], false, 'so the Lens moved by hand turns Follow off')
    assert.equal(holds.heldFor(model.TORUS_DESIGN_ID)['mode.followOff'], 'lens')
    instrument.setLiveInstrumentCommander(async () => ({ok: false, error: 'held elsewhere'}))
    holds.resetHolds()
    await model.torusDevice(state()).submit([{key: 'lens', value: 'L3′'}]).catch(() => {})
    assert.equal(holds.heldFor(model.TORUS_DESIGN_ID)['mode.follow'], undefined, 'a hand move the owner refused moved nothing, and Follow stays on')
  } finally {
    stop(); stopFollow(); instrument.setLiveInstrumentCommander(null); holds.resetHolds()
  }
})

test('the chain hears every accepted move and sends Follow\'s edits without the hand, once per mode it follows; the Live instrument section and a mapped control send theirs as the hand\'s', async () => {
  const chain = await readFile(new URL('../src/live/TorusOnChain.tsx', import.meta.url), 'utf8')
  assert.match(chain, /subscribeAcceptedLiveWrites\(torusFollowMoved\)/, 'every move the owner accepts, through the one stage channel')
  assert.match(chain, /for \(const edit of edits\) if \(!\(await commitLiveInstrumentEdit\(edit\)\)\.ok\) return/, 'Follow\'s own edits go without the hand')
  assert.match(chain, /const target = on && follow\?\.from \? JSON\.stringify\(\[follow\.lens12, follow\.context_frame\]\) : ''/,
    'once per mode followed: an owner that moves under a hand is not moved back')
  const section = await readFile(new URL('../src/live/LiveInstrumentSection.tsx', import.meta.url), 'utf8')
  assert.match(section, /commitLiveInstrumentEdit\(edit, BY_HAND\)/, 'the Live instrument section\'s controls are the hand')
  const targets = await readFile(new URL('../src/live/midiMap/midiMapTargets.ts', import.meta.url), 'utf8')
  assert.match(targets, /apply: value => commitLiveInstrumentEdit\(row\.edit\(value\), BY_HAND\)/, 'a mapped Lens or Frame is the hand')
  assert.doesNotMatch(targets, /commitLiveInstrumentEdit\(\{[^)]*\}\)\s*[,}]/, 'every mapped write is the hand\'s')
})

// DLW build ruling 2026-11-05: View and Follow are kept with the device in the set (live/liveTake.ts createTorusKeeper, beside the part's
// Torus in the set's DLW record), so a set opened again holds them as they were.
test('the device\'s View and Follow are read as the hand holds them, and a set\'s are held again, with no move left as Follow\'s reason', () => {
  holds.resetHolds()
  assert.deepEqual(model.torusDeviceHeld(), {view: 'surface', follow: true}, 'Surface and Follow on until you choose')
  model.torusFollowMoved({command: 'instrument', edit: {kind: 'lens', lens12: 3}}, {hand: true})
  holds.hold(model.TORUS_DESIGN_ID, 'view', 'both')
  assert.deepEqual(model.torusDeviceHeld(), {view: 'both', follow: false})
  model.holdTorusDevice({view: 'wire', follow: false})
  assert.deepEqual(model.torusDeviceHeld(), {view: 'wire', follow: false}, 'a set opened again holds its View and Follow')
  assert.equal(holds.heldFor(model.TORUS_DESIGN_ID)['mode.followOff'], undefined, 'and no move of this session is its reason')
  const followed = model.torusFollowed({scale: true, mode: 'dorian'}, setMode(AEOLIAN_L3P))
  assert.match(followBound(followed).standing['mode.followed'].disabled, /^Follow is off: the lens and mode are the ones you choose\.$/)
  model.holdTorusDevice({view: 'surface', follow: true})
  assert.equal(followBound(followed).values['mode.follow'], true)
  holds.resetHolds()
})

test('the Mode and tuning group draws Follow beside the Lens and Frame, and the chain reads the selected clip and the set\'s mode for it', async () => {
  holds.resetHolds()
  const binding = followBound(model.torusFollowed({scale: true, mode: 'dorian'}, setMode(AEOLIAN_L3P)))
  setHostPage(binding.id, 'field')
  const whole = renderToStaticMarkup(h(HostedDevice, {designed: torus, binding, view: 'whole', nav: {}}))
  // REPLACED (lane BA, round 865, DLW build ruling 2026-11-05): Follow says that a Lens or Frame you move turns it off.
  assert.match(whole, /data-i="Follow\|On — Follow takes the clip&#x27;s mode, or the set&#x27;s when the clip has none\. A Lens or Frame you move turns it off\."/)
  assert.match(whole, /Clip: Dorian, L3′/)
  assert.doesNotMatch(whole, /\bNaN\b|undefined|data-device-fault/)
  resetHost(binding.id)
  const chain = await readFile(new URL('../src/live/TorusOnChain.tsx', import.meta.url), 'utf8')
  assert.match(chain, /useLiveClipWhole\(/, 'the selected clip, from the set\'s owner')
  assert.match(chain, /useLiveModeInForce\(\)/, 'the set\'s mode in force')
  assert.match(chain, /torusFollowEdits\(/, 'and the edits Follow names')
  const host = await readFile(new URL('../src/live/LiveDeviceChain.tsx', import.meta.url), 'utf8')
  assert.match(host, /<TorusOnChain [^>]*selection=\{selection\}/, 'the chain hands the Torus the clip you select')
})

test('(O-I 743) the Torus head\'s Map enters the MIDI map, where its parameters take a control: the head act the shell carries itself; the rest wait for their owners', async () => {
  const map = await import(src('live/midiMap/midiMapHold.ts'))
  const {headMenu} = await import(src('frame/devices/DeviceMenu.tsx'))
  map.resetMidiMapHold()
  const items = headMenu({onChain: true, folded: false, acts: model.TORUS_HEAD_ACTS})
  assert.deepEqual(items.filter(item => item.enabled).map(item => item.id), ['fold', 'map'])
  assert.match(items.find(item => item.id === 'save-preset').why, /missing op: device\.preset\.save/)
  model.TORUS_HEAD_ACTS.map()
  assert.equal(map.midiMapState().mode, 'midi')
  assert.match(map.midiMapState().notice, /^Click a parameter, then move a hardware control/)
  map.resetMidiMapHold()
  const chain = await readFile(new URL('../src/live/TorusOnChain.tsx', import.meta.url), 'utf8')
  assert.match(chain, /publishDevice\(TORUS_DEVICE_ID, \{device, binding, picture: .*, acts: TORUS_HEAD_ACTS, full: /)
})
