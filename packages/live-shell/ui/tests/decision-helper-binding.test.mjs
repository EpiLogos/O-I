// T-AGENCY K5: the Decision helper (manual §19.20, ai-kit:decision-helper) on its owners (src/agent/devices/decisionHelperBinding.ts).
//
// Channels:
// - REAL: AIKit's `aikit decide status --json` and Quaternal Logic's `ql context-frame team-space --json` as read on 20 Oct 2026 on this
//   machine (installed ql 74e9c8e5d858), trimmed to the fields the binding reads and three of the team space's instruments.
// - SCRIPTED: the catalogue design rendered through the runtime's host (deviceHost.HostedDevice) to static markup, in all five views.
import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'
import {readFileSync} from 'node:fs'
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
  if(url.endsWith('.ts')||url.endsWith('.tsx')){
    const source=await readFile(new URL(url).pathname,'utf8');
    const {outputText}=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX},fileName:url});
    return {format:'module',shortCircuit:true,source:outputText};
  }
  return next(url,context);
}`)}`, {parentURL: import.meta.url})

globalThis.document = {getElementById: () => null, createElement: () => ({}), head: {appendChild: () => {}}, documentElement: {}}
const {createElement} = await import('react')
const {renderToStaticMarkup} = await import('react-dom/server')
const family = await import('../src/inhabitants/familyManifest.ts')
const {loadAgentShellFamilies} = await import('../src/inhabitants/loadAgentShellFamilies.ts')
const host = await import('../src/frame/devices/deviceHost.tsx')
const bind = await import('../src/agent/devices/designBindings.ts')
const helper = await import('../src/agent/devices/decisionHelperBinding.ts')
const {design} = await import('../src/inhabitants/catalogue/panels/decision-helper.tsx')
family.resetFamilyManifestsForTest()
loadAgentShellFamilies()

const views = ['folded', 'compact', 'whole', 'full', 'widget']
const hosted = (designed, binding) => views.map(view => renderToStaticMarkup(createElement(host.HostedDevice, {designed, binding, view, nav: {}})))
const escaped = text => text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// ---- REAL (20 Oct) -----------------------------------------------------------------------------------------------------------
const STATUS = {schema: 'aikit.decision-status/v1', action_ref: 'action/model/decide', mode: 'managed-local', selected_model: 'kev-latest',
  placement: '127.0.0.1:8019', independent_of_acting_models: true, install: {basis: 'endpoint answered its model card', state: 'loaded'},
  decision_model: {artifact: 'jaredpalmer/kev-0.8b', base: 'Qwen/Qwen3.5-0.8B-Base', family: 'kev', license: 'Apache-2.0'},
  limits: {max_attempts: 2, timeout_ms: 120000, tariff: 'none — a local/self-hosted endpoint has no price source; none is invented'}}
const label = (id, description = id) => ({id, description, owner_ref: 'ql:mef:test', owner_revision: 'v1'})
const TEAM = {contract: 'ql.vak-team-space/v1', instruments: [
  {id: 'vak-block', organ: 'S4′ Anima', kind: 'vak-block', answerable_by: 'model-or-person', cells: ['CF5'], seats: ['agent/anima'], heads: [
    {id: 'vak-cpf', field: 'participation', ambiguity_policy: 'abstain', cardinality: {min: 0, max: 1}, labels: [label('dialogical'), label('authorised-undertaking')]},
    {id: 'vak-direction', field: 'direction', ambiguity_policy: 'preserve-candidates', cardinality: {min: 0, max: 2}, labels: [label('ascending'), label('descending')]}]},
  {id: 'gate-5', organ: 'S5′ Aletheia', kind: 'gate-reading', answerable_by: 'model-or-person', cells: ['CF4'], seats: ['agent/aletheia'], heads: [
    {id: 'gate-5-reading', field: 'gate-reading', ambiguity_policy: 'abstain', cardinality: {min: 0, max: 1},
      labels: ['aligned', 'annotated', 'hold', 'redirect'].map(id => label(id))}]},
  {id: 'gate-6', organ: 'S5′ Aletheia', kind: 'gate-reading', answerable_by: 'person-only', cells: ['person'], seats: ['agent/aletheia'], heads: [
    {id: 'gate-6-reading', field: 'gate-reading', ambiguity_policy: 'abstain', cardinality: {min: 0, max: 1}, labels: ['aligned', 'hold', 'redirect'].map(id => label(id))}]},
]}

test('the helper reads AIKit\'s provider and QL\'s team space, and nothing else: no question, answer, log or count is invented', () => {
  bind.resetHolds()
  const values = helper.decisionHelperValues({status: STATUS, teamSpace: TEAM, holds: bind.chainHolds()})
  assert.deepEqual({light: values.light, provider: values.provider, model: values.model, base: values.base, where: values.where, state: values.state,
    independent: values.independent, price: values.price}, {light: 'lit', provider: 'local', model: 'kev-latest', base: 'Qwen/Qwen3.5-0.8B-Base',
    where: '127.0.0.1:8019', state: 'loaded', independent: true, price: 'none'})
  assert.deepEqual(JSON.parse(values.instruments), [
    {id: 'vak-block', name: 'Vāk block', organ: 'Anima', cf: 'CF5', labels: ['participation', 'direction']},
    {id: 'gate-5', name: 'Gate 5 reading', organ: 'Aletheia', cf: 'CF4', labels: ['aligned', 'annotated', 'hold', 'redirect']},
    {id: 'gate-6', name: 'Gate 6 reading', organ: 'Aletheia', cf: 'person', labels: ['aligned', 'hold', 'redirect'], person: true},
  ], 'one head: its labels; several heads: their fields; the collaboration gate is the person\'s')
  for (const key of ['ask', 'answer', 'log', 'settled', 'asked', 'abstained', 'refused', 'when', 'deadline']) assert.ok(!(key in values), `${key}: no owner reports it, so it is unknown`)
  const unloaded = helper.decisionHelperValues({status: {...STATUS, install: {state: 'stopped'}}, teamSpace: null, holds: bind.chainHolds()})
  assert.equal(unloaded.light, 'dark', 'a provider not loaded is dark')
  assert.ok(!('instruments' in unloaded), 'an unread team space is unknown, not empty')
  const unread = helper.decisionHelperValues({status: null, teamSpace: null, holds: bind.chainHolds()})
  assert.deepEqual(Object.keys(unread), [], 'nothing read: nothing drawn as known')
})

test('every write stands disabled with the operation it lacks; nothing is written', async () => {
  bind.resetHolds()
  const binding = helper.decisionHelperBinding({status: STATUS, teamSpace: TEAM, holds: bind.chainHolds()})
  for (const key of ['provider', 'when', 'deadline', 'probe', 'allow:gate-5']) {
    assert.match(binding.standing[key].disabled, /missing op/, `${key} says what it lacks`)
    await assert.rejects(binding.write([{key, value: 'x'}]), /missing op/)
  }
  binding.local.chosen('gate-5')
  assert.equal(helper.decisionHelperBinding({status: STATUS, teamSpace: TEAM, holds: bind.chainHolds()}).values.chosen, 'gate-5', 'the chosen instrument is the view\'s own hold')
  bind.resetHolds()
})

test('the design draws on the binding in all five views — no NaN, no undefined, never its fixtures — each refusal drawn as why', () => {
  bind.resetHolds()
  host.resetHost()
  const binding = helper.decisionHelperBinding({status: STATUS, teamSpace: TEAM, holds: bind.chainHolds()})
  const drawn = hosted(design, binding)
  drawn.forEach((markup, index) => {
    assert.match(markup, new RegExp(`data-device-view="${views[index]}"`), `${views[index]} draws`)
    assert.doesNotMatch(markup, /\bNaN\b|undefined/, `${views[index]}: no absent key drawn as text`)
    assert.doesNotMatch(markup, /data-device-fault/, `${views[index]}: its own view drew`)
    assert.doesNotMatch(markup, /Mercurius|Moirai as Klotho|Zeithoven/, `${views[index]}: its fixture's log never stands in`)
  })
  const all = drawn.join('\n')
  assert.ok(all.includes('This machine'), 'the provider AIKit reports is the one chosen')
  host.setHostPage(helper.DECISION_HELPER_ID, 'provider')
  const provider = renderToStaticMarkup(createElement(host.HostedDevice, {designed: design, binding, view: 'whole', nav: {}}))
  for (const said of ['kev-latest', '127.0.0.1:8019']) assert.ok(provider.includes(said), `the Provider page draws ${said}`)
  host.setHostPage(helper.DECISION_HELPER_ID, 'instruments')
  const instruments = renderToStaticMarkup(createElement(host.HostedDevice, {designed: design, binding, view: 'whole', nav: {}}))
  for (const said of ['Vāk block', 'Gate 5 reading', 'Gate 6 reading']) assert.ok(instruments.includes(said), `the Instruments page lists ${said}`)
  assert.ok(all.includes(escaped(helper.DECISION_HELPER_REFUSE.provider)), 'a refused control says why')
  host.resetHost()
})

test('AIKit admits the helper as a device of its family, so it can stand on a team\'s chain', () => {
  const device = helper.decisionHelperDevice()
  assert.ok(device, 'the ai-kit family admits the decision-helper face')
  assert.equal(device.face.id, 'decision-helper')
  assert.equal(device.id, helper.DECISION_HELPER_ID)
})

test('code-reading: the helper stands on a group\'s chain right after its members, and is read only while it stands there', () => {
  const view = readFileSync(new URL('../src/agent/devices/FactoryDeviceChain.tsx', import.meta.url), 'utf8')
  // REPLACED (lane W1-Factory): the chain draws its place's plan (agent/devices/factoryPlaces.ts chainSlots), where the helper follows the
  // Agentset rack and precedes the session's own devices; the plate stands only where the helper does.
  const rack = view.indexOf("case 'agentset': return placed(AGENTSET_ID"), stands = view.indexOf("case 'decision-helper': return helperStands ? placed(DECISION_HELPER_ID, helperDevice, helperDesignBinding")
  assert.ok(rack > 0 && stands > rack, 'the helper\'s plate after the Agentset rack\'s (§19.20)')
  const places = readFileSync(new URL('../src/agent/devices/factoryPlaces.ts', import.meta.url), 'utf8')
  assert.match(places, /export const GROUP_LEAD: readonly FactorySlot\[\] = \['agentset', 'decision-helper'\]/, 'a group\'s chain leads with its members, then the helper')
  assert.match(view, /const slots = chainSlots\(place, \{helper: helperStands, capture: captureOn, runMap: !!runMapDev, pads: !!padsDev\}\)/)
  assert.match(view, /useDecisionHelperReadings\(transport, helperStands\)/, 'nothing is read unless the helper stands on a chain')
})
