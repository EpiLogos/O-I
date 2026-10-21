import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'

// MR: the Resonator bank (DLW §22.7, the catalogue's quaternal-logic:resonator-bank) on its owners. The bank rings the cut the M3 clock
// draws, so the cut is the clock's (qlM3Clock.ts, the person's M3 form through m3_reception): a change of Aperture is its `set-aperture`, a
// Swap its `reciprocal-aperture`, and the owner of the sound (the hosted frame's presentation stage, native-field/presentationEffects.ts) is
// told the clock's division by the shell, never given a second cut of its own. The root is the mode in force's (native/liveModeCatalogue.ts,
// what the transport's Root and Scale mapping read). Everything else — On, Decay, Tilt, Span, Mix, Gain — is the stage's own effect
// (`parameters.effects.resonator`), written through the one stage channel as `effect` instrument edits. A key no owner reports is absent and the
// well says which; nothing is drawn from a default. Loader as torus-effects-binding.test.mjs.
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
const bank = await import('../src/inhabitants/ql/devices/qlResonatorBank.ts')
const m3 = await import('../src/inhabitants/ql/devices/qlM3Clock.ts')
const instrument = await import('../src/live/torusInstrument.ts')
const fx = await import('../src/live/designBindings/torusEffects.ts')
const onChain = await import('../src/live/designBindings/TorusEffectsOnChain.tsx')
const sky = await import('../src/live/designBindings/skyModulation.ts')
const techne = await import('../src/inhabitants/ql/devices/TechneDevices.tsx')
const manifests = await import('../src/inhabitants/quaternalLogicFamilyManifest.ts')
const {HostedDevice} = await import('../src/frame/devices/deviceHost.tsx')
const {designKey} = await import('../src/frame/devices/designs.ts')
const design = (await import('../src/inhabitants/catalogue/panels/quaternal-logic__resonator-bank.tsx')).design
const {EFFECT_LAW, effectRefusal, resonatorRootHz} = await import('@epilogos/expressions-boundary')

// ── fixtures: the stage's reading, the clock's form, the mode ───────────────

// The stage's resonator as it opens (effectsLaw.ts EFFECT_LAW.resonator) and one the person has set.
const opened = {on: true, division: 300, root: 0, decay: 1, tilt: 0, span: 2, mix: 50, gain: 0}
const set = {on: true, division: 240, root: 9, decay: 3, tilt: 0.4, span: 3, mix: 60, gain: -3}
const effects = (resonator = set, chain = ['resonator']) => ({chain, resonator, filter: {on: true, type: 'lowpass', cutoff: 8000, resonance: 20, drive: 0, mix: 100},
  dynamics: {on: true, threshold: -12, ratio: 4, attack: 1, release: 100, makeup: 2},
  delay: {on: true, sync: true, division: '1/8', time: 250, feedback: 35, tone: 6000, mix: 25, tempo: 120}, reverb: {on: true, size: 50, decay: 2.4, damping: 40, predelay: 20, mix: 22}})
const parameters = (over = {}) => ({muted: false, level: 1, scale: {unitsPerMetre: 120, mode: 'domain-follow'}, cadence: null, refusal: null, effects: effects(), ...over})
const reading = {schema: 'ql.instrument-reading/v1', standing: 'manual', reason: null,
  identity: {event_ref: 'controlled:occasion', subject_ref: 's', registry_revision: 'r', geometry_ref: 'g', material_ref: 'm', model_ref: 'd'}}
const torus = (par = parameters()) => ({ok: true, value: reading, determinants: null, parameters: par})

// The clock's form (as tests/ql-m3-clock-binding.test.mjs has it): the cut at index 8 is 24°, its reciprocal is index 7 (15°).
const identity = {selection_ref: 'nara-identity-selection:1', source: {source_ref: 'central:nara/identity/p1', revision: 'r9'},
  reading: {person_ref: 'person:p1', nara_ref: 'nara:p1', profile: {person_ref: 'person:p1', nara_ref: 'nara:p1'}}}
const basis = {identity, expression: {expression_ref: 'expression:kept', revision: 3}}
const form = (aperture = {index: 8, total_lenses: 16, division_deg10: 240, reciprocal_index: 7, fibonacci_phase60: 0}) => ({schema: 'ql.m3-state/v1',
  identity: {event_ref: 'event:e', profile_generation: 7},
  clock: {steps: 419, degree720: 419, degree360: 59, completed_double_covers: 0, backbone: {id: 'b', ref: '#3-5-1-3'}, tick12: 1},
  aperture, form: {address: 17}, transcription: {rna: false, sequence: 'TAT'}})
const m3reading = (state = form()) => ({schema: 'oi.m3-reception-context/v1', status: 'available', nara_ref: 'nara:p1', person_ref: 'person:p1',
  expression_ref: 'expression:kept', expression_revision: 3, identity_source_ref: 'central:nara/identity/p1', identity_revision: 'r9',
  profile_ref: 'p', profile_revision: 'pr', coordinate_ref: 'c', event_ref: 'event:e', revision: 'm3r', state, receipts: [],
  private: true, public_export: false, activity_admitted: false})
const answer = data => ({outcome: {result: 'm3_reception', data}})
/** The clock read for the fixture encounter, its kernel a recording call. */
async function readClock(state = form()) {
  const calls = []
  m3.resetQlM3({call: async op => { calls.push(op); return answer(m3reading(state)) }})
  await m3.syncQlM3(basis)
  return calls
}
const mode = {root: 9, reason: null}
const VIEWS = ['folded', 'compact', 'whole', 'full', 'widget']
const ID = bank.QL_RESONATOR_CHAIN_ID

// ── the readings ────────────────────────────────────────────────────────────

test('the design\'s keys are the owners\' readings: the stage\'s bank, the clock\'s cut, the mode\'s root; the root\'s frequency is the owner\'s law', async () => {
  await readClock()
  assert.equal(designKey('quaternal-logic', bank.QL_RESONATOR_FACE), design.id)
  const values = bank.qlBankValues(torus(), m3.qlM3State(), mode)
  assert.deepEqual(values, {'bank.on': true, 'aperture.index': 8, 'bank.decay': 3, 'bank.tilt': 0.4, 'bank.span': 3, 'bank.mix': 60, 'bank.gain': -3,
    'mode.root': 9, 'root.hz': resonatorRootHz(9)})
  assert.ok(Math.abs(values['root.hz'] - 220) < 1e-3, 'A is 220 Hz in the lowest octave')
  assert.deepEqual(Object.keys(design.defaults).filter(key => !(key in values)), [], 'every key of the design is read from an owner')
  assert.equal(values.reason, undefined, 'nothing is absent, so the well says nothing')
  // The values are the owner\'s, not the design\'s defaults: a bank that opened as the manual says reads as it opened.
  const first = bank.qlBankValues(torus(parameters({effects: effects(opened)})), m3.qlM3State(), mode)
  assert.equal(first['bank.mix'], 50); assert.equal(first['bank.on'], true)
  m3.resetQlM3()
})

test('with the clock not read, the cut is absent, the well says the clock is not read, and the bank rings the cut it last held', async () => {
  m3.resetQlM3()
  await m3.syncQlM3(null, m3.NO_IDENTITY)
  const given = torus(parameters({effects: effects({...opened, division: 300})}))
  const values = bank.qlBankValues(given, m3.qlM3State(), mode)
  assert.equal('aperture.index' in values, false, 'no cut is drawn from a default')
  assert.match(values.reason, /The M3 clock is not read/); assert.ok(values.reason.includes(m3.NO_IDENTITY), 'and it says why, in the clock\'s words')
  assert.match(values.reason, /rings the cut it last held: 30°×12/, 'the sound stands at its last cut (here the stage\'s opening one)')
  assert.equal(values['bank.decay'], 1, 'the stage\'s own settings are still its readings')
  const binding = bank.qlBankBinding(ID, given, m3.qlM3State(), mode)
  assert.equal(binding.writes('aperture.index'), false); assert.match(binding.standing['aperture.index'].disabled, /The M3 clock is not read/)
  assert.equal(binding.writes('bank.decay'), true, 'the rest is the stage\'s and stays in the hand')
  // The cut cannot be written without the clock: the bank holds no cut of its own.
  await assert.rejects(binding.write([{key: 'aperture.index', value: 3}]), /The M3 clock is not read/)
  // A clock read, but with no form opened for the person.
  m3.resetQlM3({call: async () => answer(m3reading(null))})
  await m3.syncQlM3(basis)
  assert.match(bank.qlBankValues(given, m3.qlM3State(), mode).reason, new RegExp(m3.NO_FORM.slice(0, 30)))
  m3.resetQlM3()
})

test('the root is the mode in force\'s: absent with the catalogue\'s reason while the mode is unread, the held root once it is', () => {
  const ready = {state: 'ready', catalogue: {scales: [], sourcesAbsent: [], bases: []}}
  assert.deepEqual(bank.bankMode(ready, {key: null, root: 5}), {root: 5, reason: null}, 'the transport\'s root, as Scale mapping reads it')
  const loading = bank.bankMode({state: 'loading'}, {key: null, root: 5})
  assert.equal(loading.root, null); assert.match(loading.reason, /still being read/)
  const refused = bank.bankMode({state: 'refused', reason: 'the kernel could not be asked'}, {key: null, root: 5})
  assert.equal(refused.root, null); assert.match(refused.reason, /The mode catalogue is refused: the kernel could not be asked/)
  const values = bank.qlBankValues(torus(), m3.qlM3State(), loading)
  assert.equal('mode.root' in values, false); assert.equal('root.hz' in values, false, 'no frequency without a root')
  assert.match(values.reason, /still being read/)
  const binding = bank.qlBankBinding(ID, torus(), m3.qlM3State(), mode)
  assert.match(binding.standing['mode.root'].disabled, /transport/); assert.equal(binding.writes('mode.root'), false, 'a reading here: the transport sets the root')
  assert.equal(binding.writes('root.hz'), false)
})

test('with no owner reading every stage value is absent, the well names why, and nothing writes', () => {
  for (const [given, why] of [[null, /No owner reading in this host/], [{ok: false, fault: 'reading.schema'}, /Refused reading: reading\.schema/],
    [torus(parameters({effects: undefined})), /This frame announces no effects/]]) {
    const binding = bank.qlBankBinding(ID, given, m3.qlM3State(), mode)
    for (const key of ['bank.on', 'bank.decay', 'bank.tilt', 'bank.span', 'bank.mix', 'bank.gain']) {
      assert.equal(key in binding.values, false, `${key}: absent`); assert.match(binding.standing[key].disabled, why); assert.equal(binding.writes(key), false)
    }
    assert.match(binding.values.reason, why); assert.equal(binding.write, undefined)
    assert.equal(bank.qlBankDevice(ID, given, m3.qlM3State(), mode).submit, undefined)
  }
})

// ── the writes ──────────────────────────────────────────────────────────────

test('a change of Aperture is the clock\'s set-aperture with the clock\'s index; Swap is its reciprocal-aperture; the answer is the form after them', async () => {
  const calls = await readClock()
  const binding = bank.qlBankBinding(ID, torus(), m3.qlM3State(), mode)
  assert.equal(binding.writes('aperture.index'), true)
  assert.deepEqual(bank.qlBankCutOperations(m3.qlM3State(), 3), [{operation: 'set-aperture', aperture: 3}])
  await binding.write([{key: 'aperture.index', value: 3}])
  assert.deepEqual(calls[1], {op: 'm3_reception', project: 'O-I', request: {operation: 'apply', expected_generation: 7, binding: m3.m3Binding(basis),
    operations: [{operation: 'set-aperture', aperture: 3}]}}, 'the same operation, on the same encounter, the clock\'s binding sends')
  // Swap: the design asks for the matching cut, the cut the owner names as the reciprocal; the owner is asked for its own op.
  await readClock()
  assert.deepEqual(bank.qlBankCutOperations(m3.qlM3State(), 7), [{operation: 'reciprocal-aperture'}], '24°×15 swaps to 15°×24 (index 7)')
  const swapCalls = await readClock()
  await bank.qlBankBinding(ID, torus(), m3.qlM3State(), mode).write([{key: 'aperture.index', value: 7}])
  assert.deepEqual(swapCalls[1].request.operations, [{operation: 'reciprocal-aperture'}], 'Swap sends reciprocal-aperture')
  // The cut it holds is no change; a cut the owner does not have is refused in words, before anything is sent.
  await readClock()
  assert.deepEqual(bank.qlBankCutOperations(m3.qlM3State(), 8), [])
  assert.throws(() => bank.qlBankCutOperations(m3.qlM3State(), 16), /one of the owner's 16 apertures/)
  assert.throws(() => bank.qlBankCutOperations(m3.qlM3State(), 2.5), /one of the owner's 16 apertures/)
  m3.resetQlM3()
})

test('every other change leaves through the one stage channel as the owner\'s effect edit; a value outside its law is refused before anything is sent', async () => {
  const sent = []
  let refuse = null
  instrument.setLiveInstrumentCommander(async command => { sent.push(command); return refuse ? {ok: false, error: refuse} : {ok: true} })
  try {
    await readClock()
    const binding = bank.qlBankBinding(ID, torus(), m3.qlM3State(), mode)
    await binding.write([{key: 'bank.on', value: false}, {key: 'bank.decay', value: 4}, {key: 'bank.tilt', value: -0.5}, {key: 'bank.span', value: 1},
      {key: 'bank.mix', value: 100}, {key: 'bank.gain', value: 6}])
    assert.deepEqual(sent.map(command => command.edit), [
      {kind: 'effect', effect: 'resonator', key: 'on', value: false}, {kind: 'effect', effect: 'resonator', key: 'decay', value: 4},
      {kind: 'effect', effect: 'resonator', key: 'tilt', value: -0.5}, {kind: 'effect', effect: 'resonator', key: 'span', value: 1},
      {kind: 'effect', effect: 'resonator', key: 'mix', value: 100}, {kind: 'effect', effect: 'resonator', key: 'gain', value: 6}], 'each is the stage\'s own parameter')
    sent.length = 0
    await assert.rejects(binding.write([{key: 'bank.decay', value: 2}, {key: 'bank.gain', value: 30}]), /Resonator bank gain goes from -24 to 12 dB/)
    assert.equal(sent.length, 0, 'a refused set sends nothing, not even its valid change')
    await assert.rejects(binding.write([{key: 'bank.span', value: 2.5}]), /whole number/)
    await assert.rejects(binding.write([{key: 'mode.root', value: 3}]), /transport/, 'the root is the mode\'s: no write here')
    await assert.rejects(binding.write([{key: 'root.hz', value: 100}]), /transport/)
    refuse = 'native audio unavailable'
    await assert.rejects(binding.write([{key: 'bank.mix', value: 20}]), /native audio unavailable/, 'the owner\'s refusal in its words')
    refuse = null
    const device = bank.qlBankDevice(ID, torus(), m3.qlM3State(), mode)
    await device.submit([{key: 'bank.on', value: true}])
    assert.deepEqual(sent.at(-1), {command: 'instrument', edit: {kind: 'effect', effect: 'resonator', key: 'on', value: true}}, 'the runtime\'s row write is the same edit')
  } finally { instrument.setLiveInstrumentCommander(null); m3.resetQlM3() }
})

// ── the follower: the owner of the sound is told the clock's cut and the mode's root ─────────────────

test('the stage is told the clock\'s division and the mode\'s root, and only when they differ; the bank keeps no cut of its own', async () => {
  await readClock()
  const clock = m3.qlM3State()
  const edits = bank.qlBankFollow(torus(parameters({effects: effects({...set, division: 300, root: 0})})), clock, mode)
  assert.deepEqual(edits, [{kind: 'effect', effect: 'resonator', key: 'division', value: 240}, {kind: 'effect', effect: 'resonator', key: 'root', value: 9}],
    'the clock\'s division_deg10 as the reading carries it, and the mode\'s root')
  assert.deepEqual(bank.qlBankFollow(torus(), clock, mode), [], 'the stage already rings the clock\'s cut on the mode\'s root: nothing to say')
  assert.deepEqual(bank.qlBankFollow(torus(parameters({effects: effects({...set, root: 0})})), clock, mode), [{kind: 'effect', effect: 'resonator', key: 'root', value: 9}])
  // The clock not read: the cut stands where it was; the root still follows the mode.
  m3.resetQlM3()
  const unread = bank.qlBankFollow(torus(parameters({effects: effects({...set, division: 300, root: 0})})), m3.qlM3State(), mode)
  assert.deepEqual(unread, [{kind: 'effect', effect: 'resonator', key: 'root', value: 9}], 'no clock, no new cut')
  // The mode unread: the root stands where it was.
  assert.deepEqual(bank.qlBankFollow(torus(parameters({effects: effects({...set, root: 0})})), clock, {root: null, reason: 'unread'}), [])
  // No owner, or one that announces no effects: nothing to tell.
  assert.deepEqual(bank.qlBankFollow(null, clock, mode), []); assert.deepEqual(bank.qlBankFollow(torus(parameters({effects: undefined})), clock, mode), [])
  m3.resetQlM3()
})

test('each of the owner\'s sixteen cuts is a division the stage rings, with the parts the cut names', async () => {
  // ql-core pole/aperture.rs STATIC_DIVISION_DEG10, as the clock\'s reading carries one at a time (qlM3Clock.ts); a fixture here only.
  const sixteen = [10, 20, 40, 80, 90, 100, 120, 150, 240, 300, 360, 400, 450, 900, 1800, 3600]
  for (const [index, division] of sixteen.entries()) {
    assert.equal(effectRefusal('resonator', 'division', division), null, `${division / 10}°×${360 / (division / 10)}: the stage admits the clock's cut`)
    await readClock(form({index, total_lenses: 16, division_deg10: division, reciprocal_index: 15 - index, fibonacci_phase60: 0}))
    const edits = bank.qlBankFollow(torus(parameters({effects: effects({...set, division: division === 300 ? 240 : 300})})), m3.qlM3State(), mode)
    assert.deepEqual(edits.filter(edit => edit.key === 'division'), [{kind: 'effect', effect: 'resonator', key: 'division', value: division}])
  }
  assert.ok(EFFECT_LAW.resonator.division.divides === 3600, 'the law needs no list of cuts: any whole division of the circle')
  m3.resetQlM3()
})

// ── the chain and the manifest ──────────────────────────────────────────────

test('the bank takes its place on Live\'s chain as the owner\'s chain edit, after the torus, and draws the catalogue\'s design', async () => {
  const sent = []
  instrument.setLiveInstrumentCommander(async command => { sent.push(command); return {ok: true} })
  try {
    const s = torus(parameters({effects: effects(set, ['filter'])}))
    await fx.placeTorusEffect(s, 'resonator')
    await fx.placeTorusEffect(s, 'resonator', 0)
    await fx.removeTorusEffect(torus(), 'resonator')
    await fx.moveTorusEffect(torus(parameters({effects: effects(set, ['filter', 'resonator'])})), 'resonator', -1)
    assert.deepEqual(sent.map(command => command.edit.chain), [['filter', 'resonator'], ['resonator', 'filter'], [], ['resonator', 'filter']])
    assert.deepEqual(fx.torusEffectsChain(torus()), ['resonator'])
  } finally { instrument.setLiveInstrumentCommander(null) }
  await readClock()
  const drawn = renderToStaticMarkup(h(onChain.TorusEffectsOnChain, {state: torus(parameters({effects: effects(set, ['filter', 'resonator'])}))}))
  assert.deepEqual([...drawn.matchAll(/data-chain-effect="([^"]+)"/g)].map(m => m[1]), ['live:torus-filter', ID], 'the filter, then the bank, in the owner\'s order')
  const pressed = [...drawn.matchAll(/aria-pressed="(true|false)"[^>]*>([A-Za-z ]+)</g)].map(m => [m[2], m[1]])
  assert.deepEqual(pressed, [['Filter', 'true'], ['Dynamics', 'false'], ['Delay', 'false'], ['Reverb', 'false'], ['Resonator bank', 'true'], ['Sky', 'false']],
    'the bank is put on the chain, or taken off it, with the others')
  m3.resetQlM3()
})

test('the design draws every view on the binding, and the well names an absence', async () => {
  await readClock()
  const live = bank.qlBankBinding(ID, torus(), m3.qlM3State(), mode)
  for (const view of VIEWS) {
    const drawn = renderToStaticMarkup(h(HostedDevice, {designed: design, binding: live, view, nav: {}}))
    assert.ok(drawn.length > 0, view)
    assert.equal(drawn.includes('No reading of the cut'), false, `${view}: the clock is read, so the cut is drawn`)
  }
  m3.resetQlM3()
  await m3.syncQlM3(null, m3.NO_IDENTITY)
  const unread = bank.qlBankBinding(ID, torus(), m3.qlM3State(), mode)
  for (const view of VIEWS) assert.ok(renderToStaticMarkup(h(HostedDevice, {designed: design, binding: unread, view, nav: {}})).length > 0, `${view} unread`)
  const unreadDrawn = renderToStaticMarkup(h(HostedDevice, {designed: design, binding: unread, view: 'whole', nav: {}}))
  assert.match(unreadDrawn, /No reading of the bank/, 'the design\'s own well: no body is drawn from a default cut')
  assert.match(unreadDrawn, /data-i="Aperture\|[^"]*The M3 clock is not read: No Nara identity is chosen/, 'and the Aperture dial says, on the status bar, that the clock is not read and why')
  assert.match(unreadDrawn, /data-i="Swap\|[^"]*The M3 clock is not read/, 'so does Swap')
  assert.equal(unreadDrawn.includes('aria-valuenow="3"'), true, 'the stage\'s own settings are still drawn (Decay 3 s)')
  m3.resetQlM3()
})

test('the manifest declares the face on Live\'s chain with an honest note, and Technē\'s rack, whose devices are instruments, does not stand it', () => {
  const face = manifests.quaternalLogicFamilyManifest().faces.find(f => f.id === 'resonator-bank')
  assert.ok(face, 'the manifest declares the face')
  assert.equal(face.liveSemantic, 'device-audio-fx'); assert.deepEqual(face.modes, ['live'], 'an effect lives in Live; a Technē chain device is an instrument (lock §5.2)')
  assert.match(face.invariant.transforms, /torus/)
  assert.match(face.note, /M3 clock/); assert.match(face.note, /set-aperture/); assert.match(face.note, /reciprocal-aperture/)
  assert.match(face.note, /TorusEffectsOnChain/, 'the note names where it stands today')
  const entries = techne.techneEntries([manifests.quaternalLogicFamilyManifest()], {atlas: {}, surface: null, torus: null, instrumentReading: null})
  assert.equal(entries.some(entry => entry.face.id === 'resonator-bank'), false, 'no effect stands in Technē\'s rack')
  const declared = bank.qlBankFace()
  assert.equal(declared.id, 'resonator-bank'); assert.equal(declared.liveSemantic, 'device-audio-fx'); assert.equal(declared.title, 'Resonator bank')
})

test('a planet can move what the bank is the owner of, and not what it is told: Decay, Tilt, Span, Mix and Gain, not the clock\'s cut or the mode\'s root', () => {
  const targets = sky.skyTargets(torus()).filter(target => target.id.startsWith('live:resonator/')).map(target => target.id.slice('live:resonator/'.length))
  assert.deepEqual(targets, ['decay', 'tilt', 'span', 'mix', 'gain'], 'the division and the root are the shell\'s to set from the clock and the mode, so no route may hold them')
})
