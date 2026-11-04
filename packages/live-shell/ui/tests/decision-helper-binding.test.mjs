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
const {design} = await import('../src/inhabitants/catalogue/panels/ai-kit__decision-helper.tsx')
const {design: agentsetDesign} = await import('../src/inhabitants/catalogue/panels/software-factory__agentset-rack.tsx')
const session = await import('../src/agent/devices/sessionChainBindings.ts')
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
  // REPLACED (DLW agency designs): "the chosen instrument is the view's own hold" — the Instruments page chose one to show its labels and
  // admission; §19.20's Whole lists the team's questions with your request and the team's admission, and chooses none, so nothing is held.
  assert.equal(binding.local, undefined, 'the helper holds no view key')
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
  // REPLACED (DLW agency designs): the Provider and Instruments pages — §19.20's Whole is two bands, the second holding the team's
  // questions and the Provider with its model, its hosting, When, Deadline and Probe.
  const whole = drawn[views.indexOf('whole')]
  for (const said of ['kev-latest', '127.0.0.1:8019']) assert.ok(whole.includes(said), `Whole's Provider draws ${said}`)
  for (const said of ['Vāk block', 'Gate 5 reading', 'Gate 6 reading']) assert.ok(whole.includes(said), `Whole's Instruments list ${said}`)
  assert.ok(all.includes(escaped(helper.DECISION_HELPER_REFUSE.provider)), 'a refused control says why')
  host.resetHost()
})

test('REPLACED (DLW agency designs) — the helper is its own device, AIKit\'s, standing as a chain of the Agentset rack in place of an Agent', () => {
  // Was "AIKit admits no Decision helper of its own: the Agentset rack draws the helper's readings on its Helper page" (#725, #772). The
  // manual makes the helper an instrument again (§19.20 "Kind: instrument · Chain: a chain of an Agentset rack, in place of an Agent"; §19.15
  // "A decision helper is a member like any other: a chain of the rack whose instrument is a Decision helper"), and the rack has no Helper
  // page: the rack lists the helper among its members, its chain the Decision helper alone, and the helper draws on its own binding.
  const device = helper.decisionHelperDevice()
  assert.deepEqual([device?.id, device?.family, device?.face.id, device?.face.liveSemantic], [helper.DECISION_HELPER_ID, 'ai-kit', 'decision-helper', 'device-instrument'],
    'AIKit admits the helper as an instrument of its family')
  const own = helper.decisionHelperBinding({status: STATUS, teamSpace: TEAM})
  const group = {sessionRef: 'space-port', group: true, spaceLabel: 'Port crew'}
  const rack = session.agentsetBinding({group, tracks: [], helper: own.values, holds: bind.chainHolds()})
  // REPLACED (§19.15 revised): the chain's plate carried the helper's one-line reading (`says`). The plates are gone: the rack's Devices view
  // shows the chosen member's chain, "Each is the device itself ... The rack keeps no copy: each device answers to its own owner", so the
  // helper's device stands on the helper's own readings, on its member's key.
  assert.deepEqual(JSON.parse(rack.values.members), [{id: helper.DECISION_HELPER_ID, name: 'Decision helper', model: 'kev-latest',
    chain: [{device: helper.DECISION_HELPER_DESIGN, name: 'Decision helper'}]}], 'the helper is a chain of the rack')
  assert.deepEqual(JSON.parse(rack.values[session.memberDeviceKey(helper.DECISION_HELPER_ID, helper.DECISION_HELPER_DESIGN)]), own.values,
    'the helper\'s device, on the helper\'s own readings')
  assert.equal(JSON.parse(session.agentsetBinding({group, tracks: [], holds: bind.chainHolds()}).values.members).length, 0, 'no helper stands where none is given')
  rack.local.member(helper.DECISION_HELPER_ID)
  try {
    const held = session.agentsetBinding({group, tracks: [], helper: own.values, holds: bind.chainHolds()})
    assert.equal(held.values.member, helper.DECISION_HELPER_ID, 'the chosen chain is the view\'s')
    const page = renderToStaticMarkup(createElement(host.HostedDevice, {designed: agentsetDesign, binding: held, view: 'whole', nav: {}}))
    assert.doesNotMatch(page, /\bNaN\b|undefined/, 'no absent key drawn as text')
    assert.doesNotMatch(page, /Mercurius|Moirai as Klotho|Zeithoven|oi-field-guardian/, 'no fixture stands in')
    // REPLACED (§19.15 revised, Whole: "Members | Members, Selected member, Member state"): the Members group no longer holds the chosen
    // member's chain, so no plate draws; the Selected member names the helper.
    assert.doesNotMatch(page, /as-plate/, 'no plate of the chain')
    assert.match(page, /class="as-who"[^>]*>.*?<b>Decision helper<\/b>/s, 'the helper, selected')
    assert.doesNotMatch(page, /Vāk block|Gate 5 reading/, 'Whole draws none of the helper\'s own parts')
  } finally { bind.resetHolds(); host.resetHost() }
})

test('code-reading: the helper is published as its own device beside a group\'s rack, listed among its chains, and read only while that rack stands there', () => {
  const view = readFileSync(new URL('../src/agent/devices/FactoryDeviceChain.tsx', import.meta.url), 'utf8')
  // REPLACED (DLW agency designs): "the helper is the Agentset rack's Helper page" (#725) — the rack carried the helper under `helper.`; it is
  // a device of its own now, a chain inside the rack, so no helper slot stands on the track's chain.
  // REPLACED (O-I #842): "a group's chain leads with its members' rack" (GROUP_LEAD ['agentset']) — every session's chain holds the rack,
  // and the helper still stands only where the rack's chains are a group's sessions.
  const places = readFileSync(new URL('../src/agent/devices/factoryPlaces.ts', import.meta.url), 'utf8')
  assert.match(places, /export const SESSION_CHAIN: readonly FactorySlot\[\] = \['gateway', 'remote-carrier', 'agentset', 'world', 'git'\]/, 'every session\'s chain holds the rack')
  assert.doesNotMatch(places, /'decision-helper'/, 'no helper slot')
  assert.doesNotMatch(view, /placed\(DECISION_HELPER_ID/, 'no helper slot on the track\'s chain: it is a chain of the rack')
  assert.doesNotMatch(view, /HELPER_PAGE/, 'the rack carries no Helper page')
  // REPLACED (round 860): "it stands where a group's rack does" — AIKit's space names its Decision helper now (`decision_helper`,
  // bind-decision-helper), so it stands on a group's rack only where the space's record names one (agent-rack-842.test.mjs drops one in).
  assert.match(view, /const helperStands = sessionRef != null && !!groupTrack\?\.decisionHelper\n/, 'it stands where the group\'s space names its helper')
  assert.match(view, /\.\.\.\(helperStands && helperDevice \? \{helper: helperDesignBinding\.values\} : \{\}\)/, 'the rack lists the helper among its members')
  assert.match(view, /\[DECISION_HELPER_ID, helperStands \? helperDevice : null, helperDesignBinding\]/, 'the helper is published on its own binding')
  // REPLACED (O-I #842): `case 'agentset': return placed(AGENTSET_ID, …)` — the rack plate, its head the same placed plate.
  assert.match(view, /case 'agentset': return rackPlate\(\)/)
  assert.match(view, /const head = placed\(AGENTSET_ID, ownDevices\.agentset, agentsetDesignBinding/)
  assert.match(view, /const slots = chainSlots\(place, \{runMap: !!runMapDev, pads: !!padsDev\}\)/)
  assert.match(view, /useDecisionHelperReadings\(transport, helperStands\)/, 'nothing is read unless the helper stands on a chain')
})
