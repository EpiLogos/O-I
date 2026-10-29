import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {register} from 'node:module'

// O-I #745 lane L, Quaternal Logic's part of O-I #684: the readings the device designs wait on, from their owner.
// - The Sky's rulers of the day and the hour, and Scale mapping's Sky source: QL's `ql nara hours` (ql.sky-hours/v1) through the kernel's
//   ql_read {kind: 'sky-hours'}, at the place the Sky holds (qlSky.ts setQlSkyPlace); with none, which owner op is missing.
// - Torus and Resonance's Body source: M2's body constants by fibre, QL's `ql kernel body-constants` (ql.m2-body-constants/v1) through
//   ql_read {kind: 'body-constants'}; under Tattva Resonance's plate takes the fibre's Q, Agitation and Edge as its own rows.
// REAL: the QL answers in tests/fixtures/ql-745 (QL-MEF dlw/745-readings, recorded 29 Oct) and the live scene's M2 condition in
// tests/fixtures/field-announcements-2026-10-21.json. The kernel's wrapping (owner_route_reading) is as owner_routes.rs answers.
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
const sky = await import(src('inhabitants/ql/devices/qlSky.ts'))
const names = await import(src('inhabitants/ql/devices/qlCoordinateName.ts'))
const fieldBinding = await import(src('components/devices/fieldDesignBinding.ts'))
const expressionsDevice = await import(src('components/devices/expressionsDevice.ts'))
const torus = await import(src('live/torusDevice.ts'))
const scale = await import(src('live/designBindings/scaleMappingBinding.ts'))
const holds = await import(src('techne/devices/designDevices.ts'))
const {HostedDevice} = await import(src('frame/devices/deviceHost.tsx'))
const {design: skyDesign} = await import(src('inhabitants/catalogue/panels/quaternal-logic__sky.tsx'))
const {design: resonanceDesign} = await import(src('inhabitants/catalogue/panels/expressions__resonance.tsx'))
const {NATIVE_BINDINGS} = await import('@epilogos/expressions-boundary/parameters')
const {conditionReadingOf} = await import('../../../../desktop/cradle/expressions-app/field-studies-journeys/src/instrumentCondition.ts')

const fixture = async name => JSON.parse(await readFile(new URL(`./fixtures/${name}`, import.meta.url), 'utf8'))
const hours = await fixture('ql-745/nara-hours-2026-10-29.json')
const body = await fixture('ql-745/body-constants-2026-10-29.json')
const announced = await fixture('field-announcements-2026-10-21.json')
const route = (route, data) => ({outcome: {result: 'owner_route_reading', route, data}})
const settle = ms => new Promise(resolve => setTimeout(resolve, ms))
/** The world's declared place the recorded hours were counted at. */
const GREENWICH = {...hours.input.place, scope: 'world-declared'}

// ── the Sky's rulers ─────────────────────────────────────────────────────────

test('with no place the Sky reads no rulers, and says which owner op is missing', () => {
  sky.resetQlSky({call: async () => ({outcome: null, error: 'not asked'})})
  const binding = sky.qlSkyBinding(sky.qlSkyState())
  for (const key of ['dayRuler', 'hourRuler', 'hourOf', 'hourHalf', 'sunrise', 'sunset', 'place', 'havePlace']) {
    assert.equal(binding.values[key], undefined, `${key} stands absent`)
    assert.match(binding.standing[key].disabled, /missing op: the world's declared place .* or your saved place/, key)
  }
  sky.resetQlSky()
})

test('at the world\'s declared place the Sky reads QL\'s planets of the day and the hour for the instant it is asked for', async () => {
  const asked = []
  sky.resetQlSky({call: async op => {
    asked.push(op)
    return op.op === 'ql_read' ? route('ql nara hours', hours.answer) : {outcome: null, error: 'no sky in this test'}
  }})
  sky.askQlSky({now: false, epochMs: Date.UTC(2026, 8, 28, 12)})
  sky.setQlSkyPlace(GREENWICH)
  await settle(sky.SKY_SETTLE_MS + 40)
  const reads = asked.filter(op => op.op === 'ql_read')
  assert.deepEqual(reads.at(-1), {op: 'ql_read', request: {kind: 'sky-hours', request: hours.input}}, 'the place and the instant, in QL\'s request')
  const state = sky.qlSkyState()
  assert.equal(state.hours.ok, true)
  const binding = sky.qlSkyBinding(state)
  assert.deepEqual(
    Object.fromEntries(['dayRuler', 'hourRuler', 'hourOf', 'hourHalf', 'sunrise', 'sunset', 'place', 'havePlace'].map(key => [key, binding.values[key]])),
    {dayRuler: 'Moon', hourRuler: 'Mercury', hourOf: 7, hourHalf: 'day', sunrise: '05:55', sunset: '17:44', place: 'Greenwich', havePlace: true})
  assert.match(binding.standing.hourRuler.disabled, /A reading: QL's count/)
  assert.equal(binding.writes('hourRuler'), false, 'the rulers are readings')
  const whole = renderToStaticMarkup(h(HostedDevice, {designed: skyDesign, binding, view: 'whole', nav: {}}))
  assert.match(whole, /Mercury/, 'the hour\'s planet is drawn')
  assert.match(whole, /Greenwich/, 'the place is drawn')
  assert.doesNotMatch(whole, /\bNaN\b|data-device-fault/)
  sky.resetQlSky()
})

test('a place where QL counts no hours comes back in QL\'s words; another instant\'s answer is refused', () => {
  const refused = sky.readSkyHoursAnswer({outcome: null, error: hours.refusal_stderr}, GREENWICH, hours.input.epoch)
  assert.equal(refused.ok, false)
  assert.match(refused.reason, /circumpolar/)
  const other = sky.readSkyHoursAnswer(route('ql nara hours', hours.answer), GREENWICH, '2026-09-29T12:00:00Z')
  assert.deepEqual(other, {ok: false, reason: 'QL counted the hours for another place or instant.'})
})

// ── Scale mapping's Sky source ───────────────────────────────────────────────

test('Scale mapping reads the hour\'s planet and the maqāmāt the map binds to it, for the sky of now', () => {
  const hold = {key: null, root: 0}, loading = {state: 'loading'}
  const read = sky.readSkyHoursAnswer(route('ql nara hours', hours.answer), GREENWICH, hours.input.epoch)
  const now = {ask: {now: true}, place: GREENWICH, hours: read, hoursBusy: false, placeWhy: null}
  const binding = scale.scaleMappingBinding('live:scale', null, loading, hold, undefined, now)
  assert.equal(binding.values['sky.hourRuler'], 'Mercury')
  assert.deepEqual(JSON.parse(binding.values['sky.bound']), [{key: 'maqam/02', role: 'dominant'}, {key: 'maqam/05', role: 'dominant'}, {key: 'maqam/70', role: 'dominant'}])
  assert.match(binding.standing['sky.hourRuler'].disabled, /A reading/)
  assert.match(binding.standing['mode.source'].disabled, /missing op: that choice of a bound maqām/)
  const dated = scale.scaleMappingBinding('live:scale', null, loading, hold, undefined, {...now, ask: {now: false, epochMs: 0}})
  assert.equal(dated.values['sky.hourRuler'], undefined)
  assert.match(dated.standing['sky.hourRuler'].disabled, /follows the hour of now/)
  const placeless = scale.scaleMappingBinding('live:scale', null, loading, hold, undefined, {ask: {now: true}, place: null, hours: null})
  assert.match(placeless.standing['sky.bound'].disabled, /missing op: the world's declared place/)
})

// ── Body source ─────────────────────────────────────────────────────────────

test('M2\'s body constants are read once from QL, by fibre, with their standing', async () => {
  const asked = []
  names.resetCoordinateNames({call: async op => { asked.push(op); return route('ql kernel body-constants', body.answer) }})
  names.resetBodyTable()
  await names.ensureBodyTable()
  await names.ensureBodyTable()
  assert.deepEqual(asked, [{op: 'ql_read', request: {kind: 'body-constants'}}], 'one read for the session')
  const table = names.bodyTable()
  assert.equal(table.ok, true)
  assert.equal(table.standing, 'proposed')
  assert.deepEqual(table.rows.map(row => [row.fibre, row.q_factor, row.agitation, row.boundary_strength]),
    [['earth', 12, 0.1, 20], ['water', 6, 0.6, 10], ['fire', 3, 2, 4], ['air', 1.5, 3.5, 2]])
  assert.deepEqual(names.readBodyTable(route('ql nara hours', hours.answer)), {ok: false, reason: 'The kernel answered `owner_route_reading`, not M2\'s body constants.'})
  names.resetCoordinateNames(); names.resetBodyTable()
})

const ENGINE = {mediumEnabled: false, resonanceEnabled: true, collisionEnabled: false, pairwiseEnabled: false, morphEnabled: false,
  colorEnabled: false, trajectory: 'toroidalHopf', driveShape: 'sine', colorMode: 'linearGradient', mediumPlane: 'horizontal', autoOscillate: true,
  pointerMode: 'attract', relationalEnabled: false, volumeEnabled: false}
const nativeKey = path => NATIVE_BINDINGS.find(row => row.path === path).key
const plate = params => ({
  basis: {expression_ref: 'expr:fixture', revision: 1, scene_ref: 'scene:fixture', authored_revision: 1},
  scene: {name: 'Fixture', entities: [], engine: {...ENGINE}, composition: {focus: 'parallel', frequencyDriver: 'manual'}, morph: {law: 'theta', thetaOffset: 0, dwell: 0},
    automation: [], field: {background: '#ffffff', palette: ['#112233'], material: 'ink', params}},
  entityOccurrences: {}, chosenControls: {available: false, entries: [], controls: []}, devices: [],
  selection: {entity_ids: [], step_id: null}, history: {canUndo: false, canRedo: false}, standing: {dirty: false, pending: false, notice: null},
})
const declared = {[nativeKey('cymatics.dampingQFactor')]: 4.5, [nativeKey('cymatics.agitation')]: 0.3, [nativeKey('cymatics.boundaryStrength')]: 6}

test('under Tattva Resonance\'s plate takes the fibre\'s Q, Agitation and Edge from M2\'s table, and holds them', async () => {
  holds.resetHolds()
  const table = names.readBodyTable(route('ql kernel body-constants', body.answer))
  const condition = conditionReadingOf({current: {m2: {condition: {source_path: announced.source_path}}}})
  assert.equal(condition.material_fibre, 'earth', 'the live scene stands on Pṛthvī, the earth fibre')
  const r = plate(declared)
  const written = []
  const device = {...expressionsDevice.expressionsFieldDevice(r, 'resonance', null), submit: async rows => { written.push(rows) }}
  for (const key of Object.keys(fieldBinding.RESONANCE_BODY)) assert.ok(device.rows.some(row => row.key === key), `${key}: a row of the plate`)
  const before = fieldBinding.fieldDesignBinding('resonance', device, r, null, {condition, table, held: {}})
  assert.equal(before.values['body.source'], 'declared', 'Declared by default')
  assert.equal(before.values['tattva.standing'], 'proposed', 'the table\'s standing, read')
  assert.equal(before.writes('body.source'), true)
  assert.equal(before.writes('cymatics.dampingQFactor'), true, 'under Declared the plate keeps its own Q')
  await before.write([{key: 'body.source', value: 'tattva'}])
  assert.equal(holds.heldFor(device.id)['body.source'], 'tattva', 'the choice is the hand\'s')
  const factor = path => NATIVE_BINDINGS.find(row => row.path === path)?.factor ?? 1
  assert.deepEqual(written, [[
    {key: 'cymatics.dampingQFactor', value: 12 / factor('cymatics.dampingQFactor')},
    {key: 'cymatics.agitation', value: 0.1 / factor('cymatics.agitation')},
    {key: 'cymatics.boundaryStrength', value: 20 / factor('cymatics.boundaryStrength')},
  ]], 'the earth fibre\'s constants go to the plate as its own rows')
  // The plate now reads the tattva's values; the three are held, and a hand on one is refused in words.
  const tuned = plate({[nativeKey('cymatics.dampingQFactor')]: 12, [nativeKey('cymatics.agitation')]: 0.1, [nativeKey('cymatics.boundaryStrength')]: 20})
  const held = {...expressionsDevice.expressionsFieldDevice(tuned, 'resonance', null), submit: async rows => { written.push(rows) }}
  const after = fieldBinding.fieldDesignBinding('resonance', held, tuned, null, {condition, table, held: holds.heldFor(device.id)})
  assert.equal(after.values['body.source'], 'tattva')
  assert.equal(after.values['cymatics.dampingQFactor'], 12)
  assert.match(after.standing['cymatics.dampingQFactor'].disabled, /Body source is Tattva: the earth fibre sets it/)
  assert.equal(after.writes('cymatics.agitation'), false)
  await assert.rejects(after.write([{key: 'cymatics.boundaryStrength', value: 3}]), /earth fibre sets it/)
  assert.deepEqual(fieldBinding.resonanceBodyRows(held, condition, table, 'tattva'), [], 'nothing to follow: the plate is the tattva\'s')
  assert.deepEqual(fieldBinding.resonanceBodyRows(device, condition, table, 'declared'), [], 'Declared writes nothing')
  // Ākāśa carries no fibre: under Tattva the plate keeps what you set, and nothing is held.
  const space = {...condition, material_fibre: null}
  const akasha = fieldBinding.fieldDesignBinding('resonance', held, tuned, null, {condition: space, table, held: {'body.source': 'tattva'}})
  assert.equal(akasha.writes('cymatics.dampingQFactor'), true)
  assert.deepEqual(fieldBinding.resonanceBodyRows(held, space, table, 'tattva'), [])
  for (const view of ['compact', 'whole', 'full']) {
    const markup = renderToStaticMarkup(h(HostedDevice, {designed: resonanceDesign, binding: after, view, nav: {}}))
    assert.doesNotMatch(markup, /\bNaN\b|data-device-fault/, view)
  }
  holds.resetHolds()
})

test('with M2\'s table unread the body source waits, and says so', () => {
  const r = plate(declared)
  const device = {...expressionsDevice.expressionsFieldDevice(r, 'resonance', null), submit: async () => {}}
  const binding = fieldBinding.fieldDesignBinding('resonance', device, r, null, {condition: null, table: {ok: false, reason: 'Reading M2\'s body constants…', busy: true}, held: {}})
  assert.equal(binding.values['body.source'], undefined)
  assert.match(binding.standing['body.source'].disabled, /Reading M2's body constants/)
  assert.equal(binding.writes('body.source'), false)
})

test('the Torus reads the table\'s standing and what the fibre would set; its body source stays closed on the missing stage write', () => {
  const table = names.readBodyTable(route('ql kernel body-constants', body.answer))
  const condition = conditionReadingOf({current: {m2: {condition: {source_path: announced.source_path}}}})
  const binding = torus.torusDesignBinding(null, undefined, {}, null, undefined, null, {}, condition, {ok: true, name: 'Prithvi Tattva'}, table)
  assert.equal(binding.values['tattva.standing'], 'proposed')
  assert.match(binding.standing['tattva.standing'].disabled, /A reading/)
  assert.match(binding.standing['body.source'].disabled, /earth fibre Strike 45%, Damping 12 and Agitation 0\.1 \(proposed\)/)
  assert.match(binding.standing['body.source'].disabled, /missing op: a body edit on the stage channel/)
  assert.equal(binding.writes('body.source'), false)
  const unread = torus.torusDesignBinding(null, undefined, {}, null, undefined, null, {}, condition, null, {ok: false, reason: 'no table', busy: false})
  assert.equal(unread.values['tattva.standing'], undefined)
  assert.equal(unread.standing['tattva.standing'].disabled, 'no table')
})
