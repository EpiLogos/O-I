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

// O-I #745 lane N: the Torus's body write. Manual §21.2: "Body source | Declared · Tattva | Declared | Where Strike, Damping and Agitation
// come from. Declared keeps the values you set. Tattva takes them from the tattva of the M2 condition, through its element"; "Damping | Q
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
  assert.deepEqual(torus.torusBodyEdit(earth, table, 'tattva'), {kind: 'damping', q_factor: 12}, 'what the follow writes as the fibre moves')
  assert.equal(torus.torusBodyEdit(earth, table, 'declared'), null)
  assert.equal(torus.torusBodyEdit(space, table, 'tattva'), null, 'Space carries no element: the body keeps the values you set')
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

test('Strike and Agitation stay dimmed: QL\'s scene has no term for either, and the binding names it with what the fibre would set', () => {
  holds.resetHolds()
  holds.hold(torus.TORUS_DESIGN_ID, 'body.source', 'tattva')
  const {binding} = bound()
  for (const key of ['strike', 'agitation']) {
    assert.equal(binding.writes(key), false, key)
    assert.equal(binding.values[key], undefined, key)
  }
  assert.match(binding.standing.strike.disabled, /earth fibre Strike 45%.*QL's scene has no strike share/)
  assert.match(binding.standing.agitation.disabled, /earth fibre Agitation 0\.1.*QL's scene has no agitation/)
  holds.resetHolds()
})

test('with no owner the body source stays closed and says why, naming what the fibre would set', () => {
  holds.resetHolds()
  const {binding} = bound(earth, null)
  assert.equal(binding.writes('body.source'), false)
  assert.equal(binding.writes('damping'), false)
  assert.match(binding.standing['body.source'].disabled, /No owner reading stands in this host/)
  assert.match(binding.standing['body.source'].disabled, /earth fibre Strike 45%, Damping 12 and Agitation 0\.1 \(proposed\)/)
})
