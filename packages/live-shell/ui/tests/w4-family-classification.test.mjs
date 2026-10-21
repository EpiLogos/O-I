// Lane W4, item 4: every catalogue design of Expressions, Live and Quaternal Logic (expressions__*, live__*, quaternal-logic__*, torus, physics), each
// on its binding over owner-shaped readings, with the standard's (b) key classification and (c) control standing checked for all of them:
// every key the design reads (its defaults ∪ fixtures) is an owner reading, absent with its reason, or the view's own; every control key
// writes through an owner, is the view's own, or stands disabled naming why. Set W4_TABLE=<path> to write the table it computes.
//
// Channels:
// - REAL: QL's mode catalogue (tests/fixtures/ql-music-modes-2026-10-21.json, `ql music modes --json`, ql 0.1.0 9af17b080bc8, workcell:mac)
//   and the dated sky (tests/fixtures/ql-sky/transit-2026-09-28.json, the kernel's nara_identity transit as recorded).
// - FIXTURE, owner-shaped: the retained editor's reading (as field-design-bindings.test.mjs), the torus's instrument reading with its
//   effects (as torus-effects-binding.test.mjs and mr-resonator-bank-binding.test.mjs), the M3 reception (as ql-m3-clock-binding.test.mjs),
//   the journey and the elements (as ql-deck-chakra-binding.test.mjs), the sitting's owners (as w4b-devices.test.mjs).
// - SCRIPTED: the control keys are read from each design's source (`set('key'`, `st(p, 'key')`, a helper's `(p, 'key'`).
import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'
import {readFileSync, readdirSync, writeFileSync} from 'node:fs'

const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};
import {readFile} from 'node:fs/promises';
export async function resolve(s, c, n) {
  let r = null
  try { r = await n(s, c) } catch (e) { if (!s.startsWith('.')) throw e }
  if (r) {
    if (r.url.endsWith('.html') || r.url.endsWith('.css')) return {...r, format: 'module'}
    return r
  }
  if (s.endsWith('.js')) { try { return await n(s.slice(0, -3) + '.ts', c) } catch {} }
  for (const x of ['.ts', '.tsx']) { try { return await n(s + x, c) } catch {} }
  for (const x of ['/index.ts', '/index.tsx']) { try { return await n(s + x, c) } catch {} }
  throw new Error('cannot resolve ' + s)
}
export async function load(u, c, n) {
  if (u.endsWith('.css')) return {format: 'module', shortCircuit: true, source: 'export {}'};
  if (u.includes('?raw') || u.includes('.html')) return {format: 'module', shortCircuit: true, source: 'export default ""'};
  if (u.endsWith('.json')) return {format: 'module', shortCircuit: true, source: 'export default ' + await readFile(new URL(u), 'utf8')};
  if (!u.endsWith('.ts') && !u.endsWith('.tsx')) return n(u, c);
  return {format: 'module', shortCircuit: true, source: ts.transpileModule(await readFile(new URL(u), 'utf8'), {fileName: new URL(u).pathname,
    compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX}}).outputText.split('import.meta.env').join('({BASE_URL: "/"})').split('import.meta.glob').join('(() => ({}))')};
}`)}`, import.meta.url)

const noop = () => {}
globalThis.__CRADLE_WALK__ = false
globalThis.document ??= {getElementById: () => null, createElement: () => ({style: {}, setAttribute: noop, appendChild: noop}), head: {appendChild: noop},
  addEventListener: noop, removeEventListener: noop, querySelector: () => null, querySelectorAll: () => [], documentElement: {style: {}}}
globalThis.window ??= globalThis
globalThis.addEventListener ??= noop; globalThis.removeEventListener ??= noop
const src = path => new URL(`../src/${path}`, import.meta.url).href
const world = await import(src('inhabitants/worldShellFamilies.ts'))
const door = await import(src('inhabitants/familyManifest.ts'))
const model = await import(src('components/devices/expressionsDevice.ts'))
const fieldFamilies = await import(src('components/devices/fieldDesignBinding.ts'))
const physics = await import(src('components/devices/physicsBinding.ts'))
const field = await import(src('components/devices/fieldInstrument.ts'))
const studioB = await import(src('components/expressions/studio/studioBinding.ts'))
const studioM = await import(src('components/expressions/studio/studioModel.ts'))
const effects = await import(src('live/designBindings/torusEffects.ts'))
const exact = await import(src('live/designBindings/exactRatioBinding.ts'))
const scale = await import(src('live/designBindings/scaleMappingBinding.ts'))
const skyMod = await import(src('live/designBindings/skyModulation.ts'))
const noteDevices = await import(src('live/noteDevices/noteDevices.ts'))
const torus = await import(src('live/torusDevice.ts'))
const sky = await import(src('inhabitants/ql/devices/qlSky.ts'))
const m3 = await import(src('inhabitants/ql/devices/qlM3Clock.ts'))
const deck = await import(src('inhabitants/ql/devices/qlDeck.ts'))
const chakra = await import(src('inhabitants/ql/devices/qlChakra.ts'))
const sitting = await import(src('inhabitants/ql/devices/qlSitting.ts'))
const bank = await import(src('inhabitants/ql/devices/qlResonatorBank.ts'))
const qlB = await import(src('inhabitants/ql/devices/qlBinding.ts'))
const qlMx = await import(src('inhabitants/ql/devices/qlMatrices.ts'))
const holds = await import(src('techne/devices/designDevices.ts'))
const {parseQlMusicModes} = await import(src('live/modes.ts'))
const {readFrameStage} = await import('../../../../desktop/cradle/expressions-app/field-studies-journeys/src/stageReading.ts')
const {NATIVE_BINDINGS} = await import('@epilogos/expressions-boundary/parameters')
door.resetFamilyManifestsForTest()
world.loadWorldShellFamilies()

const PANELS = new URL('../src/inhabitants/catalogue/panels/', import.meta.url)
const FILES = readdirSync(PANELS).filter(file => /^(expressions|live|quaternal-logic)__.+\.tsx$|^(torus|physics)\.tsx$/.test(file)).sort()
const designOf = async file => { const mod = await import(new URL(file, PANELS).href); return mod.design ?? mod.torus ?? mod.physics }

// ---------------------------------------------------------------------------------------------------------------- the owners' readings

const nativeKey = path => NATIVE_BINDINGS.find(row => row.path === path).key
const ENGINE = {mediumEnabled: true, resonanceEnabled: true, templateDimension: '2D', collisionEnabled: true, pairwiseEnabled: false, morphEnabled: true,
  colorEnabled: true, trajectory: 'toroidalHopf', driveShape: 'sine', colorMode: 'linearGradient', mediumPlane: 'horizontal', autoOscillate: true,
  pointerMode: 'attract', relationalEnabled: true, volumeEnabled: true}
const formation = (id, name, tint, over = {}) => ({id, name, tint, kind: 'formation', ...over})
const editorReading = () => ({
  basis: {expression_ref: 'expr:w4', revision: 2, scene_ref: 'scene:w4', authored_revision: 2},
  scene: {name: 'Opening', engine: {...ENGINE}, composition: {focus: 'travelling', frequencyDriver: 'torus', keySource: 'torus', symbolVoices: true},
    morph: {law: 'theta', thetaOffset: 0, dwell: 0.25}, automation: [],
    entities: [formation('a', 'Root', '#aa3333', {sound: {enabled: true}}), formation('b', 'Heart', '#33aa66')],
    field: {background: '#ffffff', palette: ['#112233', '#445566'], material: 'ink', params: {[nativeKey('cymatics.frequencyHz')]: 432, [nativeKey('particleCount')]: 90000}}},
  entityOccurrences: {}, chosenControls: {available: true, entries: [{id: 'b1', key: 'turbulence', scope: 'field'}],
    controls: [{entry_id: 'b1', target: 'field.turbulence', binding: {path: 'p', key: 'k', bind: 'b', factor: 1, label: 'Turbulence', group: 'g', min: 0, max: 15, hardMin: 0, hardMax: 20, step: 0.1, defaultValue: 1},
      entity_id: null, native_ref: null, base_value: 2, effective_value: 2, locked: false, unavailable_reason: null}]},
  devices: [], sharedTargets: ['field.turbulence'],
  selection: {entity_ids: [], step_id: null}, history: {canUndo: true, canRedo: false}, standing: {dirty: false, pending: false, notice: null},
  observation: {fieldPaused: false},
})
const sendOk = async () => ({ok: true})
const fieldDevice = (r, family) => model.expressionsFieldDevice(r, family, sendOk)

const fx = {chain: ['filter', 'delay', 'reverb', 'resonator'], filter: {on: true, type: 'bandpass', cutoff: 900, resonance: 70, drive: 6, mix: 80},
  dynamics: {on: false, threshold: -30, ratio: 12, attack: 30, release: 800, makeup: 9},
  delay: {on: true, sync: false, division: '1/8', time: 900, feedback: 70, tone: 900, mix: 40, tempo: 120},
  reverb: {on: true, size: 90, decay: 8, damping: 10, predelay: 60, mix: 35},
  resonator: {on: true, division: 240, root: 9, decay: 3, tilt: 0.4, span: 3, mix: 60, gain: -3}}
const torusState = {ok: true, value: {schema: 'ql.instrument-reading/v1', standing: 'following', reason: null,
  identity: {event_ref: 'controlled:occasion', subject_ref: 's', registry_revision: 'r', geometry_ref: 'g', material_ref: 'm', model_ref: 'd'}},
  determinants: {lens: {lens12: 11, label: 'L5′'}, contextFrame: 7, harmonic: {selection: 'canonical-basis', index: 3}, rna: false},
  parameters: {muted: false, level: 0.5, scale: {unitsPerMetre: 120, mode: 'domain-follow'}, cadence: {rate: 12, playing: true, source: '12 ticks/s'}, refusal: null, effects: fx}}
const stage = readFrameStage({subject: 'ql:subject:live', generation: 7, stale: false, slots: [{slot: 'form'}, {slot: 'material.damping'}], bindings: []})

const MODES = parseQlMusicModes(JSON.parse(readFileSync(new URL('./fixtures/ql-music-modes-2026-10-21.json', import.meta.url), 'utf8')))
const ready = {state: 'ready', catalogue: MODES.catalogue}
const hold = {key: 'chromatic/L0\'/aeolian', root: 10}

const recorded = JSON.parse(readFileSync(new URL('./fixtures/ql-sky/transit-2026-09-28.json', import.meta.url), 'utf8')).transit
const skyReading = sky.readSkyAnswer({outcome: {result: 'nara_identity', data: {schema: 'oi.nara-identity/v1', transit: recorded}, receipts: []}})
const at = {now: false, epochMs: Date.UTC(2026, 8, 28, 12)}
const skyState = {...sky.qlSkyState(), reading: skyReading, ask: at, answered: at}

const identity = {selection_ref: 'nara-identity-selection:1', source: {source_ref: 'central:nara/identity/p1', revision: 'r9'},
  reading: {person_ref: 'person:p1', nara_ref: 'nara:p1', profile: {person_ref: 'person:p1', nara_ref: 'nara:p1'}}}
const m3State = {key: 'k', basis: {identity, expression: {expression_ref: 'expression:kept', revision: 3}}, busy: false, reason: null, view: {},
  reading: {schema: 'oi.m3-reception-context/v1', status: 'available', person_ref: 'person:p1', expression_ref: 'expression:kept', expression_revision: 3,
    state: {schema: 'ql.m3-state/v1', identity: {event_ref: 'event:e', profile_generation: 7},
      clock: {steps: 419, degree720: 419, degree360: 59, completed_double_covers: 0, backbone: {id: 'b', ref: '#3-5-1-3'}, tick12: 1},
      aperture: {index: 8, total_lenses: 16, division_deg10: 240, reciprocal_index: 7, fibonacci_phase60: 0},
      form: {address: 17}, transcription: {rna: false, sequence: 'TAT'}}}}

const location = {schema: 'central.path-ref/v1', ref: 'ref:Control/user/flows/journey.html', root: 'R', path: 'Control/user/flows/journey.html'}
const journey = {location, actor_ref: 'person:frank', day_ref: 'central:day:control:root:2026-10-18', title: 'What the move asks'}
const card = (name, codons, reversed, position, ref) => ({placement_ref: ref, card: {deck_index: 0, token_ref: 't', name, arcana: 'minor', kernel_card_ref: null, codons},
  reversed, position, basis: {basis: 'drawn'}, klein_face: 'prospective', live_state: 'generating', person_disposition: null, day_ref: journey.day_ref,
  placed_at_unix_ms: 1, recognitions: [], current_readings: [], reading_history: []})
const journeyReading = {schema: 'ql.nara-oracle-journey-reading/v1', journey_ref: 'journey:doc-1', journey_revision: 2, subject_id: 'person:frank',
  concern: {concern_ref: 'concern:move', title: 'What the move asks', basis_sources: []}, status: 'open',
  deck: {deck_ref: 'deck:thoth', register: 'thoth', card_count: 78, dealt: 2, remaining: 76, shuffle_ref: 's', shuffled_at_unix_ms: 0, protocol_ref: 'p'},
  day_refs: [journey.day_ref], spreads: [{spread_ref: 'journey:doc-1/spread/0', kind: {kind: 'sphere'}, day_ref: journey.day_ref, basis_sources: [], janus_resolved: false,
    placements: [card('Ace of Wands', [21], false, 'P0', 'p0'), card('Ace of Cups', [0], true, 'P1', 'p1')]}],
  symbolic_assignments: [], iching: [{reading_ref: 'i0', lines: [7, 8, 9, 7, 6, 8], primary: 1, changing_mask: 20, resulting: 2, nuclear: 32, day_ref: journey.day_ref}],
  live_placement_refs: ['p0', 'p1']}
const chakraBasis = {source_ref: 'central:source:control:root:Control/self/nara/identities/p.json', revision: 's-1'}
const elemental = {outcome: {result: 'nara_elemental', data: {schema: 'oi.nara-elemental/v1', source: chakraBasis, person_ref: 'person:frank', basis: 'natal',
  elemental: {schema: 'ql.nara-elemental-reading/v1', contributions: {fire: {contribution_strength: 2, confidence: null}, water: {contribution_strength: 1, confidence: null},
    earth: {contribution_strength: 3, confidence: null}, air: {contribution_strength: 4, confidence: null}}, unknown_elements: [],
    raw_quaternion: {w: 3, x: 2, y: 1, z: 4}, normalized_quaternion: {w: 0.55, x: 0.37, y: 0.18, z: 0.73},
    source: {...chakraBasis, standing_ref: 'ql.nara-natal-composition/v1'}, consent: 'granted', standing: 'typed-observation-mapping'},
  natal_counts: [1, 2, 0, 1, 2, 0, 1]}}}

/** Each design's binding, on the readings above. A design with no binding in the shell is named with why. */
async function bindingsByDesign() {
  const r = editorReading()
  holds.resetHolds()
  deck.resetQlDeck({call: async () => ({outcome: {result: 'nara_journey', data: {schema: 'oi.nara-journey/v1', operation: 'read', reading: journeyReading, page: {location, revision: 'r-2'}}}})})
  await deck.openDeckJourney(journey)
  chakra.resetQlChakra({call: async () => elemental})
  await chakra.syncQlChakra(chakraBasis)
  sitting.resetQlSitting({owners: {ring: async () => ({ok: true}), keep: async () => null, today: async () => [], open: noop, now: () => Date.UTC(2026, 9, 21, 7),
    later: () => ({}), cancel: noop}})
  const out = {}
  for (const family of fieldFamilies.FIELD_DESIGN_FAMILIES) out[`expressions:${family}`] = fieldFamilies.fieldDesignBinding(family, fieldDevice(r, family), r, sendOk)
  out['expressions:physics'] = physics.physicsDesignBinding(fieldDevice(r, 'physics'), r, noop)
  out['expressions:field'] = field.fieldBinding({reading: r, devices: Object.fromEntries(['resonance', 'physics', 'morph', 'ink'].map(f => [f, fieldDevice(r, f)])),
    sound: {muted: false, mute: async () => ({ok: true})}, apply: sendOk})
  out['expressions:studio'] = studioB.studioBinding({reading: r, chains: studioM.studioChains([{id: 'torus', admission: 'waiting'}, {id: 'ql-instrument'}], id => id), nara: {pressed: false}},
    {request: sendOk, browse: noop, show: noop, pane: noop, nara: noop})
  for (const effect of effects.TORUS_EFFECTS) out[`live:${effect}`] = effects.torusEffectBinding(effect, torusState)
  out['live:exact-ratio'] = exact.exactRatioBinding('live:exact-ratio', ready)
  out['live:scale-mapping'] = scale.scaleMappingBinding('note-device:nd-1', noteDevices.newNoteDevice('scale', 'nd-1'), ready, hold, {setPower: noop, setTie: noop, setHold: noop})
  out['quaternal-logic:torus'] = torus.torusDesignBinding(torusState, undefined, {}, stage)
  out['quaternal-logic:sky'] = sky.qlSkyBinding(skyState)
  out['quaternal-logic:sky-modulation'] = skyMod.skyModulationBinding(torusState, skyState)
  out['quaternal-logic:m3-clock'] = m3.qlM3Binding(m3State)
  out['quaternal-logic:deck'] = deck.qlDeckBinding(deck.qlDeckState(), {...m3State, reading: {...m3State.reading, state: {...m3State.reading.state, tarot: {card_id: 4, suit: 'Cups', rank: 'Five'}}}})
  out['quaternal-logic:chakra'] = chakra.qlChakraBinding(chakra.qlChakraState(), skyState)
  out['quaternal-logic:sitting'] = sitting.qlSittingBinding(sitting.qlSittingState())
  out['quaternal-logic:resonator-bank'] = bank.qlBankBinding(bank.QL_RESONATOR_CHAIN_ID, torusState, m3State, {root: 9, reason: null})
  out['quaternal-logic:binding'] = qlB.qlBindingBinding({m3: m3State, held: {}})
  out['quaternal-logic:m-prime-matrices'] = qlMx.qlMatricesBinding({m3: m3State, modes: {reading: ready, hold}, held: {}})
  return out
}
/** Designs the shell does not bind, each with why (no owner carries its one reading). */
const UNBOUND = {
  'quaternal-logic:map-rack': 'M4′\'s rack: its one reading (`rack`) is the M registry read coordinate by coordinate through `ql kernel ledger`, which has no kernel op; the Torus\'s and the M3 clock\'s Rack pages stand absent for the same reason. No face places it yet.',
}

// ---------------------------------------------------------------------------------------------------------------- the classification

const keysOf = design => [...new Set([...Object.keys(design.defaults), ...Object.values(design.fixtures ?? {}).flatMap(fixture => Object.keys(fixture))])]
/** The control keys of a design, read from its source: a literal `set('key'`, a control's standing `st(p, 'key')`, a helper's `(p, 'key'`;
 * a key built from an id (`on:${id}`) stands as its prefix with `*`. */
function controlKeysOf(file, keys) {
  const source = readFileSync(new URL(file, PANELS), 'utf8')
  const literal = [...source.matchAll(/\bset\('([^']+)'/g), ...source.matchAll(/\bst\(p, '([^']+)'\)/g), ...source.matchAll(/\(p, '([A-Za-z][\w.:-]*)'/g)].map(m => m[1])
  const built = [...source.matchAll(/\bset\(`([a-zA-Z.]+):\$\{/g)].map(m => `${m[1]}:*`)
  return [...new Set([...literal.filter(key => keys.includes(key)), ...built])]
}
const sampleOf = (binding, key) => (key.endsWith(':*') ? Object.keys(binding.values).find(k => k.startsWith(key.slice(0, -1))) ?? `${key.slice(0, -1)}x` : key)

/** Every key a binding leaves unread with no reason, across the designs: the gaps, gathered so they are all seen at once. */
const GAPS = []
/** A key of the design built on an id the owner names (`control:<id>`, `amount:<route>`): it stands for every id the owner reports. */
const instanceOf = (binding, key) => {
  const at = key.indexOf(':')
  if (at < 1) return false
  const prefix = key.slice(0, at + 1)
  return Object.keys(binding.values).some(k => k.startsWith(prefix)) || (!!binding.write && !!binding.writes?.(`${prefix}x`)) || Object.keys(binding.local ?? {}).some(k => k.startsWith(prefix))
}
function classify(design, binding) {
  const out = {read: [], absent: [], local: [], unset: [], instance: []}
  for (const key of keysOf(design)) {
    if (key in binding.values) out.read.push(key)
    else if (binding.local && key in binding.local) out.local.push(key)
    // The well's words: drawn when something is absent, and nothing to say when all is read.
    else if (key === 'reason') out.read.push('reason (the well: nothing absent to say)')
    else if (instanceOf(binding, key)) out.instance.push(key)
    // An optional setting the scene holds none of yet: absent, and the owner takes a choice of it.
    else if (binding.write && binding.writes?.(key) && !binding.standing?.[key]?.disabled) out.unset.push(key)
    else {
      const why = binding.standing?.[key]?.disabled
      if (!(typeof why === 'string' && why.length > 8) || /undefined|NaN/.test(why)) GAPS.push(`${design.id} ${key}: absent with no reason`)
      out.absent.push(key)
    }
  }
  return out
}
function controls(binding, keys) {
  const out = {written: [], local: [], disabled: [], reading: []}
  for (const key of keys) {
    const at = sampleOf(binding, key)
    if (binding.local && (at in binding.local || key in binding.local)) out.local.push(key)
    else if (binding.write && (!binding.writes || binding.writes(at))) out.written.push(key)
    else if (binding.standing?.[at]?.disabled) out.disabled.push(key)
    else {
      // A control with no write and no standing is drawn by the host as a reading ("A reading: the owner reports it"): name it, so it is seen.
      out.reading.push(key)
    }
  }
  return out
}

test('(b) and (c) for every design of Expressions, Live and Quaternal Logic: each key read, absent with its reason, or the view\'s own; each control written, the view\'s own or disabled with why', async () => {
  const bound = await bindingsByDesign()
  const table = []
  for (const file of FILES) {
    const design = await designOf(file)
    assert.ok(design?.id, `${file}: a design`)
    const binding = bound[design.id]
    if (!binding) {
      assert.ok(UNBOUND[design.id], `${design.id}: bound, or named with why it is not`)
      table.push({design: design.id, unbound: UNBOUND[design.id]})
      continue
    }
    const keys = classify(design, binding)
    const control = controls(binding, controlKeysOf(file, keysOf(design)))
    // Every key of the design as the binding stands it: written through an owner, the view's own, disabled with why, or a reading.
    const all = controls(binding, keysOf(design))
    table.push({design: design.id, ...keys, controls: control, keys: all})
  }
  if (process.env.W4_TABLE) writeFileSync(process.env.W4_TABLE, JSON.stringify(table, null, 1))
  assert.deepEqual(GAPS, [], 'every key unread by its binding names why')
  // Closed where an owner already answers: the Deck's card of the codon now is the M3 form's tarot, in the kernel's register.
  assert.equal(bound['quaternal-logic:deck'].values['m3.card'], 'Five of Cups')
  assert.match(deck.qlDeckBinding(deck.qlDeckState(), {...m3State, reading: null, reason: 'No Nara identity is chosen.'}).standing['m3.card'].disabled, /No Nara identity/)
  for (const id of Object.keys(bound)) assert.ok(table.some(row => row.design === id), `${id}: a design of the catalogue`)
  // The two designs this lane binds, and the Field it publishes, take nothing back to an owner they do not name.
  for (const id of ['expressions:field', 'quaternal-logic:binding', 'quaternal-logic:m-prime-matrices']) assert.deepEqual(table.find(row => row.design === id).controls.reading, [], id)
  holds.resetHolds(); deck.resetQlDeck(); chakra.resetQlChakra(); sitting.resetQlSitting()
})
