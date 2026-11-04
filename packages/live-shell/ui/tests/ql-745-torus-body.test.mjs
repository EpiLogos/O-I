import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {register} from 'node:module'

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
const names = await import(src('inhabitants/ql/devices/qlCoordinateName.ts'))
const torus = await import(src('live/torusDevice.ts'))
const holds = await import(src('techne/devices/designDevices.ts'))
const {HostedDevice} = await import(src('frame/devices/deviceHost.tsx'))
const {torus: torusDesign} = await import(src('inhabitants/catalogue/panels/torus.tsx'))
const {conditionReadingOf} = await import('../../../../desktop/cradle/expressions-app/field-studies-journeys/src/instrumentCondition.ts')

const fixture = async name => JSON.parse(await readFile(new URL(`./fixtures/${name}`, import.meta.url), 'utf8'))
const body = await fixture('ql-745/body-constants-2026-10-29.json')
const announced = await fixture('field-announcements-2026-10-21.json')
const route = (route, data) => ({outcome: {result: 'owner_route_reading', route, data}})
const table = names.readBodyTable(route('ql kernel body-constants', body.answer))
// The live scene's M2 condition as the frame announced it (21 Oct): Pṛthvī, the earth fibre.
const earth = conditionReadingOf({current: {m2: {condition: {source_path: announced.source_path}}}})
const space = conditionReadingOf({current: {m2: {condition: {source_path: {...announced.source_path, material_fibre: null, tattva_ref: '#2-2-2-5-0/1'}}}}})
const following = {ok: true, value: {schema: 'ql.instrument-reading/v1', standing: 'following', reason: null,
  identity: {event_ref: 'controlled:occasion', subject_ref: 's', registry_revision: 'r', geometry_ref: 'g', material_ref: 'm', model_ref: 'd'}},
  determinants: {lens: {lens12: 11, label: 'L5′'}, contextFrame: 7, harmonic: {selection: 'canonical-basis', index: 3}, rna: false},
  parameters: {muted: false, level: 0.5, scale: {unitsPerMetre: 120, mode: 'domain-follow'}, cadence: {rate: 12, playing: true, source: '12 ticks/s'}, refusal: null}}
/** The Torus's binding on the following owner, the earth condition and M2's table, with the hand's holds and a recording commit. */
function bound(condition = earth, state = following) {
  const sent = []
  const binding = torus.torusDesignBinding(state, undefined, {}, null, undefined, null, holds.heldFor(torus.TORUS_DESIGN_ID), condition,
    {ok: true, name: 'Prithvi Tattva'}, table, async edit => { sent.push(edit); return {ok: true} })
  return {binding, sent}
}

// O-I #745 lane N: the Torus's body write. Manual §21.2: "Body source | Declared · Tattva | Declared | Where Strike and Damping come
// from. Declared keeps the values you set. Tattva takes them from the tattva of the M2 condition, through its element"; "Damping | Q
// factor 0.1 to 40". The write is the stage channel's `damping` edit (stageCommands.ts InstrumentEdit), which the frame lowers to the
// scene's decay rate. REAL: M2's table (ql kernel body-constants, recorded 29 Oct) and the scene's announced condition (21 Oct).

test('under Tattva the earth fibre damps the body at its Q through the stage channel, and holds Damping', async () => {
  holds.resetHolds()
  let {binding, sent} = bound()
  assert.equal(binding.values['body.source'], 'declared', 'Declared until Tattva is chosen')
  assert.equal(binding.writes('body.source'), true)
  assert.equal(binding.standing['body.source'], undefined)
  await binding.write([{key: 'body.source', value: 'tattva'}])
  assert.deepEqual(sent, [{kind: 'damping', q_factor: 12}], 'the earth fibre\'s Q, M2\'s table')
  assert.equal(holds.heldFor(torus.TORUS_DESIGN_ID)['body.source'], 'tattva', 'the choice is the hand\'s')
  ;({binding, sent} = bound())
  assert.equal(binding.values['body.source'], 'tattva')
  assert.equal(binding.values.damping, 12)
  assert.match(binding.standing.damping.disabled, /Body source is Tattva: the earth fibre sets it/)
  assert.equal(binding.writes('damping'), false)
  await assert.rejects(binding.write([{key: 'damping', value: 3}]), /Body source is Tattva/)
  assert.deepEqual(torus.torusBodyEdits(earth, table, 'tattva', null), [{kind: 'damping', q_factor: 12}], 'with no session, Damping alone')
  const whole = renderToStaticMarkup(h(HostedDevice, {designed: torusDesign, binding, view: 'whole', nav: {}}))
  assert.doesNotMatch(whole, /\bNaN\b|data-device-fault/)
  holds.resetHolds()
})

test('under Declared, Damping is the Q you set, written through the stage channel; out of range is refused in words', async () => {
  holds.resetHolds()
  const {binding, sent} = bound()
  assert.equal(binding.writes('damping'), true)
  await binding.write([{key: 'damping', value: 4.5}])
  assert.deepEqual(sent, [{kind: 'damping', q_factor: 4.5}])
  assert.equal(holds.heldFor(torus.TORUS_DESIGN_ID).damping, 4.5, 'the Q you set is the hand\'s: the owner keeps a rate per second')
  await assert.rejects(binding.write([{key: 'damping', value: 50}]), /Q factor 0\.1 to 40/)
  assert.equal(bound().binding.values.damping, 4.5)
  holds.resetHolds()
})

/** The owner's Torus session (QL torus-state), stating Strike as QL's M1′ session does since O-I #854; null states none (an older owner). */
const session = (strike = 0.7) => ({settings: {rate: {mode: 'free', steps_per_second: 2.5}, fundamental: {source: 'map'}, carrier: 0, shape: 'auto',
  tuning: 'logic', polyphony: 16, tempo_bpm: 120, ...(strike === null ? {} : {strike})}, steps_per_second: 2.5, band: 'rhythm', fundamental_hz: 130.81,
  map_hz: 130.81, figure: 'torus', comma_cents: 0, notes: 0, resident_tunings: ['logic', 'sky'], carrier_drive: 'pulse'})
const withSession = (strike) => ({...following, parameters: {...following.parameters, torus: session(strike)}})

// O-I #854: "Under Tattva, Strike and Damping take the element's values and hold them. Space keeps the declared values." Strike is the
// owner's M1′ session setting (QL torus-set `strike`, the share of a key's velocity that excites the body).
test('under Tattva the element sets Strike as it sets Damping, and holds both; Agitation is retired (O-I #850)', async () => {
  holds.resetHolds()
  let {binding, sent} = bound(earth, withSession())
  assert.equal(binding.values.strike, 70, 'Declared: the owner\'s Strike, in per cent')
  await binding.write([{key: 'body.source', value: 'tattva'}])
  assert.deepEqual(sent, [{kind: 'damping', q_factor: 12}, {kind: 'torus', edit: {strike: 0.45}}], 'the earth fibre\'s Q and Strike, M2\'s table')
  ;({binding, sent} = bound(earth, withSession(0.45)))
  assert.equal(binding.values.strike, 45)
  assert.equal(binding.writes('strike'), false)
  assert.match(binding.standing.strike.disabled, /Body source is Tattva: the earth fibre sets it \(Strike 45%/)
  await assert.rejects(binding.write([{key: 'strike', value: 90}]), /Body source is Tattva/)
  assert.deepEqual(torus.torusBodyEdits(earth, table, 'tattva', session()), [{kind: 'damping', q_factor: 12}, {kind: 'torus', edit: {strike: 0.45}}],
    'what the follow writes as the fibre moves')
  assert.deepEqual(torus.torusBodyEdits(earth, table, 'declared', session()), [])
  assert.deepEqual(torus.torusBodyEdits(space, table, 'tattva', session()), [], 'Space carries no element: the body keeps the values you set')
  // Manual §21.2 retires Agitation: the design carries no such key, so neither value, standing nor write names it.
  assert.equal(binding.writes('agitation'), false)
  assert.equal(binding.values.agitation, undefined)
  assert.equal(binding.standing.agitation, undefined)
  holds.resetHolds()
})

test('under Declared, and under Space, Strike is the share you set, written as the owner\'s torus edit; back to Declared it is given back', async () => {
  holds.resetHolds()
  let {binding, sent} = bound(space, withSession())
  assert.equal(binding.writes('strike'), true)
  await binding.write([{key: 'strike', value: 60}])
  assert.deepEqual(sent, [{kind: 'torus', edit: {strike: 0.6}}])
  assert.equal(holds.heldFor(torus.TORUS_DESIGN_ID).strike, 0.6, 'the Strike you set is the hand\'s too')
  await assert.rejects(binding.write([{key: 'strike', value: 140}]), /0 to 100 %/)
  holds.hold(torus.TORUS_DESIGN_ID, 'body.source', 'tattva')
  ;({binding, sent} = bound(space, withSession(0.6)))
  assert.equal(binding.writes('strike'), true, 'Space, Ākāśa, carries no element: under Tattva it keeps the declared Strike')
  assert.equal(binding.values.strike, 60)
  holds.hold(torus.TORUS_DESIGN_ID, 'body.source', 'tattva')
  ;({binding, sent} = bound(earth, withSession(0.45)))
  await binding.write([{key: 'body.source', value: 'declared'}])
  assert.deepEqual(sent, [{kind: 'torus', edit: {strike: 0.6}}], 'Declared gives back the Strike you set')
  holds.resetHolds()
})

test('an owner whose session states no Strike leaves it dimmed and says so', () => {
  holds.resetHolds()
  const {binding} = bound(earth, withSession(null))
  assert.equal(binding.writes('strike'), false)
  assert.match(binding.standing.strike.disabled, /states no Strike/)
  holds.resetHolds()
})

test('with no owner the body source stays closed and says why, naming what the fibre would set', () => {
  holds.resetHolds()
  const {binding} = bound(earth, null)
  assert.equal(binding.writes('body.source'), false)
  assert.equal(binding.writes('damping'), false)
  assert.match(binding.standing['body.source'].disabled, /No owner reading stands in this host/)
  assert.match(binding.standing['body.source'].disabled, /earth fibre Strike 45% and Damping 12 \(proposed\)/)
})

// O-I #852 (manual §21.2 Body: "The body is what rings. It is the torus unless you choose a form"): the Body radio chooses what rings
// through the one stage channel, as the instrument's `body` edit (stageCommands.ts InstrumentEdit), and the page reads what rings from the
// owner's Torus session (its `body`: the torus, or a form with its form, material, modes and voices; QL scene_field.rs), never its own idea
// of it. Under a form, Modes, Damping and Body source choose the body again (the owner damps a form at the Q it was made at, and refuses
// set-damping under one); under the torus, Modes is a form's and says so.
const form = (over = {}) => ({kind: 'form', form: {kind: 'fold', form_ref: '#3-controlled', source_ref: 'ql.m3-state/v1@1'}, preparation_ref: 'sha256:prepared',
  material: {fibre: 'earth', q_factor: 12, strike_share: 0.7, source_ref: 'declared'}, modes: 8, voices: 9, ...over})
const ringing = (body, strike = 0.7) => ({...following, parameters: {...following.parameters, torus: {...session(strike), ...(body === undefined ? {} : {body})}}})
function chosen(state, condition = earth, answer = {ok: true}) {
  const sent = []
  const binding = torus.torusDesignBinding(state, undefined, {}, null, undefined, null, holds.heldFor(torus.TORUS_DESIGN_ID), condition,
    {ok: true, name: 'Prithvi Tattva'}, table, async edit => { sent.push(edit); return answer })
  return {binding, sent}
}

test('the Body page reads what rings from the owner: the torus, or a form with its form, modes and Q; nothing while none is named', () => {
  holds.resetHolds()
  const none = chosen(following).binding
  assert.equal(none.values.body, undefined, 'no session announced: no body is drawn as ringing')
  assert.match(none.standing.body.disabled, /torus-state/)
  assert.equal(none.writes('body'), false)
  const older = chosen(ringing(undefined)).binding
  assert.equal(older.values.body, undefined)
  assert.match(older.standing.body.disabled, /names no body/, 'an owner from before torus-body says nothing of what rings')
  const torusRings = chosen(ringing({kind: 'torus'})).binding
  assert.equal(torusRings.values.body, 'torus')
  assert.equal(torusRings.writes('body'), true)
  assert.equal(torusRings.values.modes, undefined)
  assert.match(torusRings.standing.modes.disabled, /a count of modes is a form's/, 'under the torus, Modes is a form\'s and says so')
  assert.match(torusRings.standing['body.form'].disabled, /The torus rings/)
  const formRings = chosen(ringing(form())).binding
  assert.deepEqual([formRings.values.body, formRings.values.modes, formRings.values['body.form'], formRings.values.damping], ['form', 8, '#3-controlled', 12],
    'the owner\'s form, its modes a voice and the Q it was made at')
  assert.equal(formRings.writes('modes'), true)
  assert.equal(formRings.writes('damping'), true)
  assert.match(formRings.standing['body.form'].disabled, /A reading/)
  holds.resetHolds()
})

test('choosing A form sends the body edit: the modes you hold, or 8, at the Q you set or the fibre\'s; the torus sends none; a refusal in words', async () => {
  holds.resetHolds()
  let {binding, sent} = chosen(ringing({kind: 'torus'}))
  await assert.rejects(binding.write([{key: 'body', value: 'form'}]), /A form rings at the Damping you set: set Damping, then choose A form\./)
  assert.deepEqual(sent, [], 'nothing reached the channel')
  holds.hold(torus.TORUS_DESIGN_ID, 'damping', 4.5)
  ;({binding, sent} = chosen(ringing({kind: 'torus'})))
  await binding.write([{key: 'body', value: 'form'}])
  assert.deepEqual(sent, [{kind: 'body', body: {modes: 8, q_factor: 4.5, material: 'declared'}}])
  holds.hold(torus.TORUS_DESIGN_ID, 'modes', 16)
  holds.hold(torus.TORUS_DESIGN_ID, 'body.source', 'tattva')
  ;({binding, sent} = chosen(ringing({kind: 'torus'}, 0.45)))
  await binding.write([{key: 'body', value: 'form'}])
  assert.deepEqual(sent, [{kind: 'body', body: {modes: 16, q_factor: 12, material: 'tattva'}}], 'under Tattva the earth fibre\'s Q, M2\'s table')
  ;({binding, sent} = chosen(ringing(form())))
  await binding.write([{key: 'body', value: 'torus'}])
  assert.deepEqual(sent, [{kind: 'body', body: null}], 'the torus: the body given back')
  await assert.rejects(binding.write([{key: 'body', value: 'plate'}]), /The torus or A form/)
  ;({binding, sent} = chosen(ringing({kind: 'torus'}), earth, {ok: false, error: 'Error: a body\'s Q factor must be within 0.1 to 40: it is the Torus\'s Damping'}))
  await assert.rejects(binding.write([{key: 'body', value: 'form'}]), /^Error: The body was not chosen\. A body's Q factor must be within 0\.1 to 40/)
  holds.resetHolds()
})

test('under a form, Modes, Damping and Body source choose the body again; set-damping is never sent to a form', async () => {
  holds.resetHolds()
  let {binding, sent} = chosen(ringing(form()))
  await binding.write([{key: 'modes', value: 16}])
  assert.deepEqual(sent, [{kind: 'body', body: {modes: 16, q_factor: 12, material: 'declared'}}], 'the owner\'s Q, the modes you chose')
  assert.equal(holds.heldFor(torus.TORUS_DESIGN_ID).modes, 16, 'the count is the hand\'s')
  await assert.rejects(binding.write([{key: 'modes', value: 65}]), /Modes takes 1 to 64 a voice/)
  await assert.rejects(binding.write([{key: 'modes', value: 2.5}]), /Modes takes 1 to 64 a voice/)
  await binding.write([{key: 'damping', value: 6}])
  assert.deepEqual(sent.at(-1), {kind: 'body', body: {modes: 8, q_factor: 6, material: 'declared'}}, 'a form is damped at the Q it is made at')
  assert.equal(sent.some(edit => edit.kind === 'damping'), false)
  ;({binding, sent} = chosen(ringing(form())))
  await binding.write([{key: 'body.source', value: 'tattva'}])
  assert.deepEqual(sent, [{kind: 'torus', edit: {strike: 0.45}}, {kind: 'body', body: {modes: 8, q_factor: 12, material: 'tattva'}}],
    'the fibre\'s Strike to the session, then the form again of the tattva\'s material')
  holds.resetHolds()
})
