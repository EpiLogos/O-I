// O-I #842: every Factory session's agency stands in one Agent rack (DLW §19.15 Agent rack; §16.2 Chains on tracks, Factory's row and
// "Placement and order"; §16.1 "How far a setting reaches"; §16.4 a rack drawn as Live draws one; §19.4 "The agent's chain").
//   src/agent/devices/factoryPlaces.ts          the session's chain, the rack's own chain, and how far each device on them reaches
//   src/inhabitants/sdk/chains.ts                the rack's macros: how a turn reaches into the chains and nested racks, and comes off by hand
//   src/agent/devices/sessionChainBindings.ts    the rack on its owners: a lone session's one chain, its macros through the Agent, Group,
//                                                the chain list's Activator, Add a chain and Drag out through AIKit's session-space operations
//   src/agent/agentRunModel.ts                   a chain's bench, read from its space's own record
//   src/inhabitants/catalogue/panels/software-factory__agentset-rack.tsx   the device, named Agent rack
//   src/agent/devices/FactoryDeviceChain.tsx     which draws the rack on every session, the session's own chain inside it
//
// Channels:
// - FIXTURE: the sessions provider's tracks, shaped as agent/agentRunModel.ts builds them; an Agent binding standing in for the session's own
//   Agent (its write records the change); Central's ports record their calls. No owner state is read or written.
// - SCRIPTED: the design rendered through the runtime's host (deviceHost.HostedDevice) to static markup.
// - CODE-READING: the chain's source and the shell's words for Factory.
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
const {inhabitantManifest} = await import('../src/inhabitants/manifest.ts')
const host = await import('../src/frame/devices/deviceHost.tsx')
const bind = await import('../src/agent/devices/designBindings.ts')
const places = await import('../src/agent/devices/factoryPlaces.ts')
const chains = await import('../src/inhabitants/sdk/chains.ts')
const own = await import('../src/agent/devices/sessionChainBindings.ts')
const runModel = await import('../src/agent/agentRunModel.ts')
const drag = await import('../src/agent/agentChainDrag.ts')
const helper = await import('../src/agent/devices/decisionHelperBinding.ts')
const {design} = await import('../src/inhabitants/catalogue/panels/software-factory__agentset-rack.tsx')

family.resetFamilyManifestsForTest()
loadAgentShellFamilies()

const read = path => readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8')
const views = ['folded', 'compact', 'whole', 'full', 'widget']
const hosted = (binding, values) => views.map(view => renderToStaticMarkup(createElement(host.HostedDevice, {designed: design, binding: binding ?? {id: 'x', values}, view, nav: {}})))

const NOW = 1_800_000_000_000
const clip = (n, over = {}) => ({n, title: null, state: 'unknown', startUnixMs: null, lastActivityUnixMs: null, softStop: false, disclosure: null, ...over})
const track = over => ({sessionRef: 'agent-session/fx', purpose: null, agentRef: null, agentName: null, agentAccepted: null, spaceRef: 'session-space/fx', spaceLabel: null,
  depth: 0, parentRef: null, group: false, memberRefs: [], tasks: [], needle: null, telemetryOn: true, budget: {used: null, max: null}, disclosure: null, ...over})
// Bumble's session: one agent, alone on its track (the mockup's Bumble).
const BUMBLE = track({sessionRef: 'agent-session/bumble', agentRef: 'agent/bumble', agentName: 'Bumble', purpose: 'Review run #214',
  tasks: [clip(1, {title: 'Review run #214', state: 'running', startUnixMs: NOW - 60_000, lastActivityUnixMs: NOW - 5_000})],
  needle: {atUnixMs: NOW - 5_000, state: 'live', axisStartUnixMs: NOW - 1_800_000, axisEndUnixMs: NOW, disclosure: null}})
// A crew: a SessionSpace with two agents' sessions at depth 1.
const KITE = track({sessionRef: 'agent-session/kite', agentRef: 'agent/kite', agentName: 'kite', depth: 1, parentRef: 'session-space/crew', spaceRef: 'session-space/crew'})
const CAIRN = track({sessionRef: 'agent-session/cairn', agentRef: 'agent/cairn', agentName: 'cairn', depth: 1, parentRef: 'session-space/crew', spaceRef: 'session-space/crew'})
const CREW = track({sessionRef: 'session-space/crew', spaceRef: 'session-space/crew', spaceLabel: 'Port crew', group: true, memberRefs: [KITE.sessionRef, CAIRN.sessionRef]})
const TRACKS = [BUMBLE, CREW, KITE, CAIRN]

/** The session's own Agent, as FactoryDeviceChain hands it to the rack: its values, and its writes recorded. Effort writes through its row;
 * the Model and the Budget are readings (designBindings.ts agentBinding: AGENT_WRITES, REFUSE.budget). */
const agentOf = (sent = []) => ({
  id: 'agent-chain:agent', values: {model: 'model:sonnet-5.5', effort: 'medium', cap: 12, light: 'lit'},
  standing: {cap: {disabled: 'Budget is a reading here: Actuation exposes no budget write.'}},
  writes: key => key === 'effort' || key === 'cap',
  write: async changes => { for (const change of changes) { if (change.key === 'cap') throw Error('Budget is a reading here: Actuation exposes no budget write.'); sent.push(change) } },
})

// ---------------------------------------------------------------- placement (§16.2, §19.15)

test('every session\'s chain holds one Agent rack, a group\'s and a lone session\'s alike, in §16.2\'s order', () => {
  const lone = places.factoryPlace({sessionRef: BUMBLE.sessionRef, group: false, workcell: null})
  const group = places.factoryPlace({sessionRef: CREW.sessionRef, group: true, workcell: null})
  // §16.2 Factory: "Gateway and Remote carrier; the Sources every agent reads; the Agent rack, whose chains are the agents and agent sets the
  // session may use; the Scope that bounds them all; then Git / landing." Sources has no binding on this chain yet (OPEN), so it is not placed.
  for (const place of [lone, group]) assert.deepEqual(places.chainSlots(place), ['gateway', 'remote-carrier', 'agentset', 'world', 'git'], `${place.group ? 'a group' : 'a lone session'}: one rack`)
  assert.equal('GROUP_LEAD' in places, false, 'no chain is led by a rack only when it is a group\'s')
  // The session's own agent is one chain of the rack: what it carries before the Agent (§19.4 "Sources, the Skillset rack, the Agent, Scope").
  assert.deepEqual(places.RACK_CHAIN, ['skillset', 'agent'])
  for (const slot of places.RACK_CHAIN) assert.ok(!places.SESSION_CHAIN.includes(slot), `${slot} stands inside the rack, not on the track's chain`)
})

test('a device outside the rack reaches every chain; one inside a chain reaches that agent only (§16.1, §19.15 "What stands outside the rack")', () => {
  const one = [{id: BUMBLE.sessionRef, name: 'Bumble'}]
  const two = [{id: KITE.sessionRef, name: 'kite'}, {id: CAIRN.sessionRef, name: 'cairn'}]
  for (const slot of ['gateway', 'remote-carrier', 'world', 'git']) {
    const reach = places.reachOf(slot, two)
    assert.equal(reach.reaches, 'every-chain', slot)
    assert.deepEqual(reach.chains, [KITE.sessionRef, CAIRN.sessionRef], `${slot}: kite and cairn`)
    assert.match(reach.says, /every chain of the Agent rack/, slot)
    assert.match(reach.says, /kite, cairn/, slot)
  }
  assert.match(places.reachOf('gateway', two).says, /unless a chain holds one of its own/, 'a connection inside a chain takes the track\'s place')
  assert.match(places.reachOf('world', two).says, /An agent's own Scope only narrows it/)
  assert.equal(places.reachOf('agentset', two).reaches, 'rack')
  assert.match(places.reachOf('agentset', two).says, /returns are mixed by Join/)
  for (const slot of places.RACK_CHAIN) {
    const reach = places.reachOf(slot, one, BUMBLE.sessionRef)
    assert.deepEqual([reach.reaches, reach.chain], ['chain', BUMBLE.sessionRef], slot)
    assert.match(reach.says, /Bumble alone/, slot)
  }
  assert.match(places.reachOf('gateway', []).says, /no chain yet/, 'a rack with no chain says so')
})

// ---------------------------------------------------------------- the rack's macros (§19.15 Macros)

// The mockup's track (world-shell-mockup.html RACKS): the crew set, Honey and Bumble; the track's Model macro maps the crew's own macro and
// Bumble; Honey keeps her own. The crew's Model macro maps Explore and Cite; Fizz keeps his own.
const MOCK = [
  {id: 'crew', kind: 'set', chains: [{id: 'fizz', kind: 'agent'}, {id: 'explore', kind: 'agent'}, {id: 'cite', kind: 'agent'}], unmapped: {model: ['fizz']}},
  {id: 'honey', kind: 'agent'}, {id: 'bumble', kind: 'agent'},
]

test('a macro turns every mapped chain, into a nested set\'s own macro and through it the set\'s mapped agents', () => {
  const turns = chains.macroTurns(MOCK, 'model', 'model:opus-5.5', {model: ['honey']})
  assert.deepEqual(turns.map(turn => [turn.chain, turn.kind, turn.within]), [['crew', 'set', null], ['explore', 'agent', 'crew'], ['cite', 'agent', 'crew'], ['bumble', 'agent', null]])
  assert.ok(turns.every(turn => turn.macro === 'model' && turn.value === 'model:opus-5.5'))
  // Effort is unmapped nowhere: every agent, at every depth.
  assert.deepEqual(chains.macroTurns(MOCK, 'effort', 'high').map(turn => turn.chain), ['crew', 'fizz', 'explore', 'cite', 'honey', 'bumble'])
  // A Decision helper has no Model, Effort or Budget of an Agent's.
  assert.deepEqual(chains.macroTurns([{id: 'helper', kind: 'helper'}, {id: 'kite', kind: 'agent'}], 'budget', 20).map(turn => turn.chain), ['kite'])
})

test('a device turned by hand comes off its macro: the next turn leaves it where the hand put it', () => {
  const off = chains.offByHand({model: ['honey']}, 'model', 'bumble')
  assert.deepEqual(off, {model: ['honey', 'bumble']})
  assert.deepEqual(chains.macroTurns(MOCK, 'model', 'model:haiku-5.5', off).map(turn => turn.chain), ['crew', 'explore', 'cite'])
  assert.deepEqual(chains.offByHand(off, 'model', 'bumble'), off, 'once off, it stays off')
  assert.deepEqual(chains.offByHand({}, 'effort', 'honey'), {effort: ['honey']}, 'every macro lets go of what the hand takes')
})

// ---------------------------------------------------------------- the rack on its owners

test('a lone session\'s rack has one chain, the session\'s own agent, whose devices stand beside the rack, live', () => {
  bind.resetHolds()
  const values = own.agentsetValues({group: null, session: BUMBLE, tracks: TRACKS, agent: agentOf().values, holds: bind.chainHolds(), nowUnixMs: NOW})
  assert.deepEqual(JSON.parse(values.members), [{id: BUMBLE.sessionRef, name: 'Bumble', goal: 'Review run #214', state: 'working', model: 'model:sonnet-5.5', beside: true}])
  assert.equal(values.light, 'lit')
  // The macros read where the one agent stands: the rack keeps no copy of its own.
  assert.deepEqual([values.model, values.effort, values.budget], ['model:sonnet-5.5', 'medium', 12])
  assert.equal(values.crew, undefined, 'a lone session names no agent set')
  const binding = own.agentsetBinding({group: null, session: BUMBLE, tracks: TRACKS, agent: agentOf().values, holds: bind.chainHolds()})
  assert.equal(binding.standing.join.disabled, own.JOIN_UNTIED, 'a rack that is no set of agents has no Join, and names how to tie one')
})

test('the macros turn the one agent through its own Agent; what the Agent does not write stands dimmed with the Agent\'s words', async () => {
  bind.resetHolds()
  const sent = []
  const agent = agentOf(sent)
  const binding = own.agentsetBinding({group: null, session: BUMBLE, tracks: TRACKS, agent: agent.values, holds: bind.chainHolds()}, {agent})
  assert.equal(binding.standing.effort?.disabled, undefined, 'Effort turns: the Agent writes its Effort')
  assert.equal(binding.writes('effort'), true)
  await binding.write([{key: 'effort', value: 'high'}])
  assert.deepEqual(sent, [{key: 'effort', value: 'high'}], 'the Effort macro wrote the agent\'s Effort, through the Agent')
  assert.match(binding.standing.budget.disabled, /Budget is a reading here/, 'the Agent\'s own reason')
  // REPLACED (round 862): a lone session's Model stood dimmed with the Agent's word (the Agent writes no Model). It turns through the
  // session's own model select in AIKit now, the path a group's chains take; with no carrier handed to the rack it names that one.
  assert.equal(binding.standing.model.disabled, own.AGENTSET_REFUSE.model, 'the Agent writes no Model; the session\'s model select carries it')
  await assert.rejects(() => binding.write([{key: 'model', value: 'opus'}]), {message: own.AGENTSET_REFUSE.model})
  await assert.rejects(() => binding.write([{key: 'budget', value: 20}]), /Budget is a reading here/)
  // A group's macros never reach the session's own Agent: the rack holds no member's Agent, so the Agent it is handed is not theirs.
  // REPLACED (round 861): a group's Model and Effort were missing ops. Each chain's session carries its own (AIKit's encounter model-read
  // and model-select, through the kernel), so with no carrier handed to the rack they name that one; Budget is still a missing op.
  const crew = own.agentsetBinding({group: CREW, tracks: TRACKS, holds: bind.chainHolds()}, {agent})
  for (const key of ['model', 'effort']) {
    assert.equal(crew.standing[key].disabled, own.AGENTSET_REFUSE[key], key)
    assert.doesNotMatch(crew.standing[key].disabled, /missing op/, key)
    await assert.rejects(() => crew.write([{key, value: 'high'}]), error => error.message === own.AGENTSET_REFUSE[key], key)
  }
  assert.equal(own.AGENTSET_REFUSE.model, 'Model: no carrier to AIKit\'s model select of each chain\'s session (its encounter\'s model-read and model-select, through the kernel) stands on this rack.')
  assert.equal(own.AGENTSET_REFUSE.effort, 'Effort: no carrier to AIKit\'s model select of each chain\'s session (its encounter\'s model-read and model-select, through the kernel) stands on this rack.')
  // REPLACED (round 20): a group's Budget was a missing op. Each chain's task carries its own Budget in AIKit (the kernel's
  // encounter_task_read, then encounter_task_budget; DLW build ruling 2026-11-05), so with no carrier handed to the rack it names that one.
  assert.equal(crew.standing.budget.disabled, own.AGENTSET_REFUSE.budget)
  assert.doesNotMatch(crew.standing.budget.disabled, /missing op/)
  await assert.rejects(() => crew.write([{key: 'budget', value: 20}]), error => error.message === own.AGENTSET_REFUSE.budget)
  assert.equal(sent.length, 1, 'no member\'s macro reached the session\'s own Agent')
})

// Each chain's session's model as its harness reports it (AIKit's encounter model-read; desktop/cradle/src/encounter/nativeModel.ts
// NativeModelReading), and the receipt its model-select gives.
const EFFORTS3 = [{value: 'low', name: 'Low'}, {value: 'medium', name: 'Medium'}, {value: 'high', name: 'High'}]
const modelReading = (session, over = {}) => ({agent_session: session, native_session_id: `native/${session.split('/')[1]}`, standing: 'fixture',
  model_observation: {current_model_id: 'sonnet', available_models: [{modelId: 'sonnet', name: 'Sonnet'}, {modelId: 'opus', name: 'Opus'}],
    reasoning_effort: {configId: 'reasoning_effort', currentValue: 'medium', options: EFFORTS3}, standing: 'fixture'},
  model_controls: {model_selection: true, reasoning_effort_selection: true, reason: null}, pinned_model_id: null, ...over})
const selected = request => ({agent_session: request.agent_session, native_session_id: request.expected_native_session_id, selected: true, inference_observed: false,
  model_observation: {current_model_id: request.provider_model_id, available_models: [], standing: 'fixture',
    reasoning_effort: {configId: 'reasoning_effort', currentValue: request.provider_reasoning_effort ?? 'medium', options: EFFORTS3}}})

test('a group\'s Model and Effort macros turn every agent of the rack, each through its own session\'s model select in AIKit (§19.15 Macros, round 861)', async () => {
  bind.resetHolds()
  const calls = []
  let fail = null
  const sessionModel = {
    read: async ({project, agent_session}) => { calls.push(['read', project, agent_session]); return modelReading(agent_session) },
    select: async ({project, request}) => {
      calls.push(['select', project, request])
      if (fail && request.agent_session === fail) throw Error('AIKit: the native session is busy with a turn')
      return selected(request)
    },
  }
  const readings = new Map([KITE, CAIRN].map(t => [t.sessionRef, {status: 'answered', reading: modelReading(t.sessionRef)}]))
  const input = {group: CREW, tracks: TRACKS, holds: bind.chainHolds(), chainModelReadings: readings}
  const crew = own.agentsetBinding(input, {sessionModel})
  // The macros stand where every agent's session stands: the models every chain's harness offers, and the Model and Effort they share.
  assert.deepEqual(JSON.parse(crew.values.models), [{id: 'sonnet', label: 'Sonnet'}, {id: 'opus', label: 'Opus'}])
  assert.equal(crew.values.model, 'sonnet')
  assert.equal(crew.values.effort, 'medium')
  for (const key of ['model', 'effort']) assert.equal(crew.standing[key], undefined, `${key} turns on a group`)
  // REPLACED (round 20): "Budget has no owner of a session's budget yet". Each chain's task Budget is AIKit's; unhanded, it names its carrier.
  assert.equal(crew.standing.budget.disabled, own.AGENTSET_REFUSE.budget, 'Budget names the carrier of each chain\'s task Budget')
  // Model: each session is read for its native session, then selected, the effort left as the harness holds it.
  await crew.write([{key: 'model', value: 'opus'}])
  assert.deepEqual(calls.filter(c => c[0] === 'select').map(c => c[2]), [
    {action: 'model-select', agent_session: KITE.sessionRef, expected_native_session_id: 'native/kite', provider_model_id: 'opus'},
    {action: 'model-select', agent_session: CAIRN.sessionRef, expected_native_session_id: 'native/cairn', provider_model_id: 'opus'},
  ])
  assert.deepEqual(calls.filter(c => c[0] === 'read').map(c => c[2]), [KITE.sessionRef, CAIRN.sessionRef], 'each chain read fresh before its write')
  assert.ok(calls.every(c => c[1] === 'O-I' || c[1] === ''), 'each call in its session\'s register')
  // Effort: the session's own model kept, its reasoning effort set.
  calls.length = 0
  await crew.write([{key: 'effort', value: 'high'}])
  assert.deepEqual(calls.filter(c => c[0] === 'select').map(c => [c[2].provider_model_id, c[2].provider_reasoning_effort]), [['sonnet', 'high'], ['sonnet', 'high']])
  // A value a chain's harness does not offer turns no chain: every chain is checked before any is written.
  calls.length = 0
  await assert.rejects(() => crew.write([{key: 'effort', value: 'max'}]),
    error => error.message === 'Effort: kite\'s harness offers no Effort Max (it offers Low, Medium and High), so no chain was turned.')
  assert.deepEqual(calls.filter(c => c[0] === 'select'), [], 'nothing was written')
  await assert.rejects(() => crew.write([{key: 'model', value: 'haiku'}]),
    error => error.message === 'Model: kite\'s harness does not offer haiku (it offers Sonnet and Opus), so no chain was turned.')
  // A write that stops partway says what stands and what to press next.
  calls.length = 0
  fail = CAIRN.sessionRef
  await assert.rejects(() => crew.write([{key: 'model', value: 'opus'}]),
    error => error.message === 'Model stopped at cairn: kite now uses Opus, and cairn keeps the model it had; AIKit: the native session is busy with a turn. Turn Model again to set the rest.')
  fail = KITE.sessionRef
  await assert.rejects(() => crew.write([{key: 'effort', value: 'low'}]),
    error => error.message === 'Effort stopped at kite: nothing changed, and kite and cairn keep the Effort they had; AIKit: the native session is busy with a turn. Turn Effort again to set the rest.')
  // The Decision helper has no Agent, so no macro reaches it (chains.ts macroTurns).
  fail = null
  calls.length = 0
  const helped = own.agentsetBinding({...input, helper: {model: 'kev-latest'}}, {sessionModel})
  await helped.write([{key: 'model', value: 'opus'}])
  assert.deepEqual(calls.filter(c => c[0] === 'select').map(c => c[2].agent_session), [KITE.sessionRef, CAIRN.sessionRef])
  // The chain hands the rack each chain's session's model select and its readings: the encounter's own model-read and model-select, never
  // the focused harness's Effort (shell.setEffort).
  const chainSource = read('agent/devices/FactoryDeviceChain.tsx'), acts = read('agent/factoryTaskActs.ts')
  assert.match(chainSource, /sessionModel: \{read: \(\{project, agent_session\}\) => sessionModelRead\(transport, project, agent_session\), select: \(\{project, request\}\) => sessionModelSelect\(transport, project, request\)\}/)
  assert.match(chainSource, /const chainModelReadings = useChainModelReadings\(transport, macroChains\)/)
  // The rack is handed Factory's readings of its macros beside its chains' models (round 20).
  assert.match(chainSource, /chainModels, chainModelReadings, rackMacros: rackMacros\.readings\}, agentsetPorts\)/)
  assert.match(acts, /encounter<unknown>\(transport, project, \{action: 'model-read', agent_session: session\}\)/)
  assert.match(acts, /return readNativeModel\(value, session, native\)/)
  assert.doesNotMatch(read('agent/devices/sessionChainBindings.ts'), /shell\.setEffort\(/)
  bind.resetHolds()
})

test('a chain\'s model select is refused in its owner\'s words where its harness, its policy or its reading does not allow it (round 861)', () => {
  const S = KITE.sessionRef
  const select = own.sessionModelSelectOf
  assert.deepEqual(select(modelReading(S), S, 'model', 'opus', 'kite'),
    {action: 'model-select', agent_session: S, expected_native_session_id: 'native/kite', provider_model_id: 'opus'})
  assert.throws(() => select(modelReading(S, {pinned_model_id: 'sonnet'}), S, 'model', 'opus', 'kite'),
    {message: 'kite\'s model policy pins sonnet: change the policy through its owner.'})
  assert.throws(() => select(modelReading(S, {model_controls: {model_selection: false, reasoning_effort_selection: false, reason: 'pi selects per invocation'}}), S, 'model', 'opus', 'kite'),
    {message: 'kite\'s harness turns no Model here: pi selects per invocation'})
  assert.throws(() => select(modelReading(S, {model_observation: null}), S, 'effort', 'high', 'kite'),
    {message: 'kite\'s harness reports no model yet, so no Effort can be set on it.'})
  assert.throws(() => select(modelReading('agent-session/other'), S, 'effort', 'high', 'kite'),
    {message: 'AIKit\'s model reading of kite names another session: read it again.'})
  // A pinned model stays: Effort sets the reasoning on the model the policy pins.
  assert.deepEqual(select(modelReading(S, {pinned_model_id: 'sonnet'}), S, 'effort', 'low', 'kite'),
    {action: 'model-select', agent_session: S, expected_native_session_id: 'native/kite', provider_model_id: 'sonnet', provider_reasoning_effort: 'low'})
  // The group's macros stand on what every chain reads: a chain unread, or refused, leaves the macro's value and its models unread.
  const readings = new Map([[KITE.sessionRef, {status: 'answered', reading: modelReading(KITE.sessionRef)}],
    [CAIRN.sessionRef, {status: 'refused', error: 'AIKit: no native session is resident'}]])
  const values = own.agentsetValues({group: CREW, tracks: TRACKS, holds: bind.chainHolds(), chainModelReadings: readings})
  for (const key of ['models', 'model', 'effort']) assert.equal(values[key], undefined, key)
  const apart = new Map([[KITE.sessionRef, {status: 'answered', reading: modelReading(KITE.sessionRef)}],
    [CAIRN.sessionRef, {status: 'answered', reading: modelReading(CAIRN.sessionRef, {model_observation: {...modelReading(CAIRN.sessionRef).model_observation, current_model_id: 'opus'}})}]])
  const split = own.agentsetValues({group: CREW, tracks: TRACKS, holds: bind.chainHolds(), chainModelReadings: apart})
  assert.equal(split.model, undefined, 'the chains use different models: the macro stands at none of them')
  assert.equal(split.effort, 'medium')
  assert.deepEqual(JSON.parse(split.models).map(m => m.id), ['sonnet', 'opus'])
})

test('a lone session\'s Model macro turns its one chain through the session\'s own model select, the path a group\'s chains take; its Effort stays the Agent\'s (round 862)', async () => {
  bind.resetHolds()
  const calls = [], sent = []
  const agent = agentOf(sent)
  const sessionModel = {
    read: async ({project, agent_session}) => { calls.push(['read', project, agent_session]); return modelReading(agent_session) },
    select: async ({project, request}) => { calls.push(['select', project, request]); return selected(request) },
  }
  const readings = new Map([[BUMBLE.sessionRef, {status: 'answered', reading: modelReading(BUMBLE.sessionRef)}]])
  const input = {group: null, session: BUMBLE, tracks: TRACKS, agent: agent.values, models: ['model:sonnet-5.5'], holds: bind.chainHolds(), chainModelReadings: readings}
  const lone = own.agentsetBinding(input, {agent, sessionModel})
  // The macro stands where the session's harness stands: its model, and the models it offers (never AIKit's catalogue the Agent shows).
  assert.equal(lone.values.model, 'sonnet')
  assert.deepEqual(JSON.parse(lone.values.models), [{id: 'sonnet', label: 'Sonnet'}, {id: 'opus', label: 'Opus'}])
  assert.equal(lone.values.effort, 'medium', 'the Effort macro reads the Agent, as before')
  assert.equal(lone.standing.model, undefined, 'Model turns: the session\'s model select carries it')
  await lone.write([{key: 'model', value: 'opus'}])
  assert.deepEqual(calls.splice(0), [['read', '', BUMBLE.sessionRef],
    ['select', '', {action: 'model-select', agent_session: BUMBLE.sessionRef, expected_native_session_id: 'native/bumble', provider_model_id: 'opus'}]])
  assert.deepEqual(sent, [], 'the Model never went through the Agent')
  await assert.rejects(() => lone.write([{key: 'model', value: 'haiku'}]),
    error => error.message === 'Model: Bumble\'s harness does not offer haiku (it offers Sonnet and Opus), so no chain was turned.')
  // Effort still turns through the session's own Agent.
  await lone.write([{key: 'effort', value: 'high'}])
  assert.deepEqual(sent, [{key: 'effort', value: 'high'}])
  assert.deepEqual(calls.filter(c => c[0] === 'select'), [], 'Effort asked no model select of a lone session')
  // Unread, the macro reads the Agent and AIKit's catalogue, as it did.
  const unread = own.agentsetValues({...input, chainModelReadings: null})
  assert.equal(unread.model, 'model:sonnet-5.5')
  assert.deepEqual(JSON.parse(unread.models), [{id: 'model:sonnet-5.5'}])
  // The chain reads the lone session's model as it reads a group's chains.
  assert.deepEqual(own.agentChainSessions(null, TRACKS, BUMBLE), [{project: '', session: BUMBLE.sessionRef}])
  assert.match(read('agent/devices/FactoryDeviceChain.tsx'), /const macroChains = useMemo\(\(\) => agentChainSessions\(groupTrack, tracks, loneTrack\), \[groupTrack, tracks, loneTrack\]\)/)
  bind.resetHolds()
})

test('Group, on chains chosen in the list, asks Central to propose them as an agent set; Accept saves Central\'s record', async () => {
  bind.resetHolds()
  const calls = []
  const ports = {
    // Central's record keeps the person's words as its proposal's reason (central.agent-set/v1 `proposal.reason`).
    propose: async input => { calls.push(['propose', input]); return {record: {schema: 'central.agent-set/v1', ref: input.ref, revision: 'r1', members: input.members, proposal: {reason: input.reason}}} },
    saveSet: async input => { calls.push(['save', input]); return {} },
    suffix: () => 'r7x',
  }
  const binding = own.agentsetBinding({group: CREW, tracks: TRACKS, holds: bind.chainHolds()}, ports)
  for (const key of ['grouping', 'new.open', 'new.for', 'new.chains']) assert.ok(binding.local[key], `${key} is the hand's`)
  await assert.rejects(() => binding.write([{key: 'new.make', value: JSON.stringify({for: 'Check the port', chains: [KITE.sessionRef]})}]), /at least two chains/)
  await binding.write([{key: 'new.make', value: JSON.stringify({for: 'Check the port', chains: [KITE.sessionRef, CAIRN.sessionRef]})}])
  assert.deepEqual(calls[0], ['propose', {scope: 'root', ref: 'agent-set:check-the-port-r7x', revision: 'r1',
    members: [{kind: 'agent', agent_ref: 'agent/kite'}, {kind: 'agent', agent_ref: 'agent/cairn'}], reason: 'Check the port'}])
  const held = own.agentsetBinding({group: CREW, tracks: TRACKS, holds: bind.chainHolds()}, ports)
  assert.deepEqual(JSON.parse(held.values['new.proposal']).members, [KITE.sessionRef, CAIRN.sessionRef], 'the proposal stands on the card, its chains by their faces')
  // REPLACED (round 20): Accept saved Central's record and the chains stayed chains of their own. Accept now saves it, then AIKit makes the
  // chosen chains one chain of this rack, in the set's own space (`aikit session-space group`, the kernel's encounter_session_group); with
  // no carrier to that handed to the rack, Central keeps the set and Accept says the chains stay their own.
  await assert.rejects(() => held.write([{key: 'new.accept', value: true}]), error => error.message === own.GROUP_REFUSE.noGroup('agent-set:check-the-port-r7x'))
  assert.deepEqual(calls[1], ['save', {scope: 'root', record: {schema: 'central.agent-set/v1', ref: 'agent-set:check-the-port-r7x', revision: 'r1',
    members: [{kind: 'agent', agent_ref: 'agent/kite'}, {kind: 'agent', agent_ref: 'agent/cairn'}], proposal: {reason: 'Check the port'}}, expected_revision: 'r1'}])
  assert.equal(JSON.parse(bind.viewHolds(bind.chainHolds(), own.AGENTSET_ID)['new.proposal']).saved, true, 'the card holds the set as saved')
  // REPLACED (round 868): Discard was a missing op and Central's propose took no type. Central carries both now (central.agent-set.remove
  // with CAS; propose's `type`): with no remover handed to the rack, Discard names the act that carries it; Type is the card's own field.
  assert.equal(held.standing['new.discard'].disabled, own.GROUP_REFUSE.noRemover)
  await assert.rejects(() => held.write([{key: 'new.discard', value: true}]), error => error.message === own.GROUP_REFUSE.noRemover)
  assert.match(own.GROUP_REFUSE.noRemover, /central\.agent-set\.remove/)
  assert.equal(held.standing['new.type'], undefined, 'Central\'s propose takes a type')
  assert.ok(held.local['new.type'], 'the Type is the hand\'s until Group')
  // Accept again, with AIKit's group handed: Central's record is not saved twice; the chosen chains go into the set's own space, named for
  // what the set is for, and the card lets go. A group AIKit refuses comes back in its words, the set kept.
  let refuseGroup = 'AIKit: agent-session/cairn is not in session-space/crew'
  const grouping = {...ports, group: async input => { calls.push(['group', input]); if (refuseGroup) throw Error(refuseGroup); return {} }}
  const again = own.agentsetBinding({group: CREW, tracks: TRACKS, holds: bind.chainHolds()}, grouping)
  await assert.rejects(() => again.write([{key: 'new.accept', value: true}]),
    error => error.message === own.GROUP_REFUSE.ungrouped('agent-set:check-the-port-r7x', refuseGroup))
  refuseGroup = null
  await again.write([{key: 'new.accept', value: true}])
  assert.deepEqual(calls.slice(2).map(c => c[0]), ['group', 'group'], 'Central\'s record was saved once')
  assert.deepEqual(calls[3], ['group', {project: '', space: 'session-space/crew', agent_sessions: [KITE.sessionRef, CAIRN.sessionRef],
    into: 'session-space/check-the-port-r7x', label: 'Check the port'}])
  assert.equal(bind.viewHolds(bind.chainHolds(), own.AGENTSET_ID)['new.proposal'], undefined, 'the card let go')
  // A chain whose session seats no agent cannot be proposed as a member.
  const unseated = own.agentsetBinding({group: CREW, tracks: TRACKS.map(item => (item === CAIRN ? {...item, agentRef: null} : item)), holds: bind.chainHolds()}, ports)
  await assert.rejects(() => unseated.write([{key: 'new.make', value: JSON.stringify({for: 'Check', chains: [KITE.sessionRef, CAIRN.sessionRef]})}]), /seats no agent/)
  bind.resetHolds()
})

// ---------------------------------------------------------------- the chain list on AIKit's own session-space operations (O-I #745 with #772)

test('each chain-list control with no carrier refuses in the words of the operation that carries it (O-I #772)', async () => {
  const R = own.AGENTSET_REFUSE
  // Solo is what you attend to, never what runs (§16.1 "Live's acts, kept as Live keeps them": Solo is never "A limit on what may run";
  // §16.6 Rules). REPLACED (round 858): the rack solos through the shell's attention, the one the Session view's mixer solos
  // (tests/solo-attention.test.mjs); it refuses only where no attention is handed, and AIKit's session Solo is never named as its route.
  assert.match(R.solo, /^Solo: no owner operation carries it yet — missing op: what you attend to, handed to this rack: .*\(the live shell\)\.$/)
  assert.doesNotMatch(R.solo, /encounter_session_settings/)
  // REPLACED (round 859): Activator, Drag out and Add a chain were missing ops (no session-space mutation held a bench, a move into a space
  // of its own, or an attach to a space that stands). AIKit carries each now (bench-agent-session; `aikit session-space drag-out`; attach-
  // agent-session on a standing space) through the kernel's encounter_session_bench, _drag_out and _attach; with no carrier handed to the
  // rack, each names the one that carries it, and none is a missing op.
  assert.equal(R.bench, 'Activator: no carrier to AIKit\'s bench of a chain\'s session in its space (the kernel\'s encounter_session_bench) stands on this chain.')
  assert.equal(R.extract, 'Drag out: no carrier to AIKit\'s drag out of a chain\'s session into a space of its own (the kernel\'s encounter_session_drag_out) stands on this chain.')
  assert.equal(R.add, 'Add a chain: no carrier to AIKit\'s attach of a standing session to this rack\'s space (the kernel\'s encounter_session_attach) stands on this chain.')
  for (const key of ['bench', 'extract', 'add']) assert.doesNotMatch(R[key], /missing op/, key)
  // REPLACED (round 860): Hot-Swap was refused in AIKit's law (a session keeps its agent for good: encounter_agency.rs configure_agency).
  // AIKit carries it now without breaking that law: `aikit session-space hot-swap` seats a separately attributed session of the other agent
  // in the chain's place, with the chain's bench, track settings and task, and detaches the old one last (the kernel's
  // encounter_session_hot_swap). With no carrier handed to the rack, it names the one that carries it.
  assert.equal(R.swap, 'Hot-Swap: no carrier to AIKit\'s hot-swap of a chain\'s agent in its space (the kernel\'s encounter_session_hot_swap) stands on this chain.')
  assert.doesNotMatch(R.swap, /missing op|must not silently become another Agent/)
  // Each write refuses in exactly those words, and reaches no owner.
  const sent = []
  const ports = {saveSet: async input => { sent.push(['save', input]) }, propose: async input => { sent.push(['propose', input]) }, agent: agentOf(sent)}
  const rack = own.agentsetBinding({group: CREW, tracks: TRACKS, holds: bind.chainHolds(), nowUnixMs: NOW}, ports)
  for (const [key, value, control] of [[`solo:${KITE.sessionRef}`, true, 'solo'], [`bench:${KITE.sessionRef}`, true, 'bench'], ['swap', KITE.sessionRef, 'swap'],
    ['extract', CAIRN.sessionRef, 'extract'], ['add', 'agent-session/wren', 'add']]) {
    assert.equal(rack.writes(key), true, `${key} is the rack's to refuse`)
    assert.equal(rack.standing[control].disabled, R[control], `${control} stands dimmed with its reason`)
    await assert.rejects(() => rack.write([{key, value}]), error => error.message === R[control], key)
  }
  assert.deepEqual(sent, [], 'no owner was asked')
  bind.resetHolds()
})

// A Project's spaces as agency_read lists them (desktop/cradle agencySources.ts rows; `raw` the space's own record): the crew, whose record
// benches kite (AIKit's `benched`), and the desk, where bo stands alone. The tracks are built as the sessions provider builds them.
const SPACES = [
  {definition: {id: 'session-space/crew'}, label: 'Port crew', benched: ['agent-session/kite'],
    agent_sessions: {'agent-session/kite': {purpose: 'Check the port', agent_ref: 'agent/kite'}, 'agent-session/cairn': {purpose: 'Cite the port', agent_ref: 'agent/cairn'}}},
  {definition: {id: 'session-space/desk'}, label: 'Desk', agent_sessions: {'agent-session/bo': {purpose: 'Draft', agent_ref: 'agent/bo'}}},
]
const agencyRows = spaces => spaces.flatMap(space => Object.entries(space.agent_sessions).map(([sessionRef, at]) =>
  ({spaceRef: space.definition.id, spaceLabel: space.label, sessionRef, purpose: at.purpose, agentRef: at.agent_ref, raw: space, project: 'O-I'})))
const ROSTER = new Map([['agent/kite', {name: 'kite', accepted: true}], ['agent/cairn', {name: 'cairn', accepted: true}], ['agent/bo', {name: 'bo', accepted: true}]])

test('the Activator reads AIKit\'s bench and benches a chain in its space; a standing session dropped in joins; Drag out seats a chain in a space of its own', async () => {
  bind.resetHolds()
  const tracks = runModel.buildTracks(agencyRows(SPACES), ROSTER)
  const crew = tracks.find(item => item.sessionRef === 'session-space/crew')
  const kite = tracks.find(item => item.sessionRef === 'agent-session/kite')
  assert.equal(kite.benched, true, 'the space\'s own record benches kite: the track reads it')
  assert.equal(tracks.find(item => item.sessionRef === 'agent-session/cairn').benched, undefined, 'a session the record does not bench carries no bench')
  const values = own.agentsetValues({group: crew, tracks, holds: bind.chainHolds(), nowUnixMs: NOW})
  assert.equal(values['bench:agent-session/kite'], true, 'kite\'s activator reads AIKit\'s bench')
  assert.equal(values['bench:agent-session/cairn'], false, 'cairn is not benched')

  const calls = []
  const ports = {
    bench: async input => { calls.push(['bench', input]); return {outcome: 'applied'} },
    attach: async input => { calls.push(['attach', input]); return {outcome: 'attached'} },
    dragOut: async input => { calls.push(['dragOut', input]); return {receipts: []} },
    suffix: () => '1a2b3c4d',
  }
  const rack = own.agentsetBinding({group: crew, tracks, holds: bind.chainHolds(), nowUnixMs: NOW, helper: {model: 'glm-5.3-flash'}}, ports)
  for (const control of ['bench', 'extract', 'add']) assert.equal(rack.standing[control], undefined, `${control}: its carrier stands, so it is pressable`)
  // REPLACED (round 860): Hot-Swap stayed refused in AIKit's law; handed no hot-swap carrier here, it names the one that carries it.
  assert.equal(rack.standing.swap.disabled, own.AGENTSET_REFUSE.swap, 'no Hot-Swap carrier is handed to this rack')

  // The Activator: off benches the chain in its space; on lifts the bench. The session stays in the rack.
  await rack.write([{key: 'bench:agent-session/cairn', value: true}])
  await rack.write([{key: 'bench:agent-session/kite', value: false}])
  assert.deepEqual(calls.splice(0), [
    ['bench', {project: 'O-I', space: 'session-space/crew', agent_session: 'agent-session/cairn', benched: true}],
    ['bench', {project: 'O-I', space: 'session-space/crew', agent_session: 'agent-session/kite', benched: false}]])
  await assert.rejects(() => rack.write([{key: 'bench:agent-session/bo', value: true}]), {message: own.CHAIN_LIST_REFUSE.notChain('Activator', 'agent-session/bo')})
  await assert.rejects(() => rack.write([{key: `bench:${helper.DECISION_HELPER_ID}`, value: true}]), {message: own.CHAIN_LIST_REFUSE.helperBench})

  // Add a chain: a session row dragged from the browser (AgentShellBrowser.tsx: `${spaceRef}:${sessionRef}`), or a session's own ref.
  await rack.write([{key: 'add', value: drag.encodeChainDrag({family: 'session', ref: 'session-space/desk:agent-session/bo', label: 'Draft'})}])
  await rack.write([{key: 'add', value: 'agent-session/wren'}])
  assert.deepEqual(calls.splice(0), [
    ['attach', {project: 'O-I', space: 'session-space/crew', agent_session: 'agent-session/bo'}],
    ['attach', {project: 'O-I', space: 'session-space/crew', agent_session: 'agent-session/wren'}]])
  await assert.rejects(() => rack.write([{key: 'add', value: drag.encodeChainDrag({family: 'agent', ref: 'agent/wren', label: 'Wren'})}]), {message: own.CHAIN_LIST_REFUSE.agent})
  await assert.rejects(() => rack.write([{key: 'add', value: drag.encodeChainDrag({family: 'skillset', ref: 'set/port', label: 'Port'})}]), {message: own.CHAIN_LIST_REFUSE.family('skillset')})
  await assert.rejects(() => rack.write([{key: 'add', value: 'agent-session/kite'}]), {message: own.CHAIN_LIST_REFUSE.already('kite')})
  await assert.rejects(() => rack.write([{key: 'add', value: helper.DECISION_HELPER_ID}]), {message: own.CHAIN_LIST_REFUSE.helperStands})
  await assert.rejects(() => rack.write([{key: 'add', value: 'a note'}]), {message: own.CHAIN_LIST_REFUSE.unnamed})

  // Drag out: the chosen chain leaves its space for a space of its own, named for it, on a track of its own, chain and all.
  await rack.write([{key: 'extract', value: 'agent-session/kite'}])
  assert.deepEqual(calls.splice(0), [['dragOut', {project: 'O-I', space: 'session-space/crew', agent_session: 'agent-session/kite', into: 'session-space/kite-1a2b3c4d', label: 'kite'}]])
  await assert.rejects(() => rack.write([{key: 'extract', value: helper.DECISION_HELPER_ID}]), {message: own.CHAIN_LIST_REFUSE.helperOut})
  await assert.rejects(() => rack.write([{key: 'extract', value: 'agent-session/bo'}]), {message: own.CHAIN_LIST_REFUSE.notChain('Drag out', 'agent-session/bo')})
  await assert.rejects(() => rack.write([{key: 'swap', value: 'agent-session/kite'}]), {message: own.AGENTSET_REFUSE.swap})
  assert.deepEqual(calls, [], 'a refused press reaches no owner')

  // A lone session's rack has one chain, its own: its Activator benches it in the space it stands in; a session dropped in joins that space.
  const bo = tracks.find(item => item.sessionRef === 'agent-session/bo')
  const lone = own.agentsetBinding({group: null, session: bo, tracks, holds: bind.chainHolds(), nowUnixMs: NOW}, ports)
  assert.equal(own.agentsetValues({group: null, session: bo, tracks, holds: bind.chainHolds(), nowUnixMs: NOW})['bench:agent-session/bo'], false)
  await lone.write([{key: 'bench:agent-session/bo', value: true}])
  await lone.write([{key: 'add', value: 'agent-session/cairn'}])
  assert.deepEqual(calls.splice(0), [
    ['bench', {project: 'O-I', space: 'session-space/desk', agent_session: 'agent-session/bo', benched: true}],
    ['attach', {project: 'O-I', space: 'session-space/desk', agent_session: 'agent-session/cairn'}]])
  // REPLACED (round 860): a Decision helper dropped on a lone session's rack was refused because AIKit's space named no helper. AIKit names
  // one now (bind-decision-helper); a lone session's rack has one chain and no agents for a helper to answer.
  await assert.rejects(() => lone.write([{key: 'add', value: helper.DECISION_HELPER_ID}]), {message: own.CHAIN_LIST_REFUSE.helperLone})
  bind.resetHolds()
})

// A Project's crew whose record names its Decision helper (AIKit's `decision_helper` on aikit.session-space-application/v1, round 860).
const HELPED = [{...SPACES[0], decision_helper: {agent_session: 'agent-session/settle', provenance: ['dropped on the Agent rack as its Decision helper']},
  agent_sessions: {...SPACES[0].agent_sessions, 'agent-session/settle': {purpose: 'Decision helper'}}}]

test('Hot-Swap seats the agent dropped on it from the browser in the chain\'s place; a Decision helper dropped on the chain list becomes the rack\'s helper (§19.15, round 860)', async () => {
  bind.resetHolds()
  const tracks = runModel.buildTracks(agencyRows(SPACES), ROSTER)
  const crew = tracks.find(item => item.sessionRef === 'session-space/crew')
  const calls = []
  const ports = {
    hotSwap: async input => { calls.push(['hotSwap', input]); return {steps: []} },
    decisionHelper: async input => { calls.push(['decisionHelper', input]); return {bound: input.bound} },
    attach: async input => { calls.push(['attach', input]) },
  }
  const rack = own.agentsetBinding({group: crew, tracks, holds: bind.chainHolds(), nowUnixMs: NOW}, ports)
  assert.equal(rack.standing.swap, undefined, 'Hot-Swap: its carrier stands, so it is pressable')
  // Hot-Swap (Live's: the browser swaps what the chain holds): the agent dragged from the browser onto the chosen chain's Hot-Swap.
  const wren = drag.encodeChainDrag({family: 'agent', ref: 'agent/wren', label: 'Wren'})
  const swap = (chain, dropped) => rack.write([{key: 'swap', value: own.hotSwapDrop(chain, dropped)}])
  await swap('agent-session/kite', wren)
  assert.deepEqual(calls.splice(0), [['hotSwap', {project: 'O-I', space: 'session-space/crew', agent_session: 'agent-session/kite', agent_ref: 'agent/wren'}]])
  const S = own.CHAIN_LIST_REFUSE
  await assert.rejects(() => rack.write([{key: 'swap', value: 'agent-session/kite'}]), {message: S.swapPress}, 'a press with no agent dropped on it')
  await assert.rejects(() => swap('agent-session/kite', drag.encodeChainDrag({family: 'agent', ref: 'agent/kite', label: 'kite'})), {message: S.swapSame('kite')})
  await assert.rejects(() => swap('agent-session/kite', drag.encodeChainDrag({family: 'session', ref: 'session-space/desk:agent-session/bo', label: 'Draft'})), {message: S.swapSession})
  await assert.rejects(() => swap('agent-session/kite', drag.encodeChainDrag({family: 'skillset', ref: 'set/port', label: 'Port'})), {message: S.swapFamily('skillset')})
  await assert.rejects(() => swap('agent-session/kite', 'a note'), {message: S.swapUnnamed})
  await assert.rejects(() => swap(helper.DECISION_HELPER_ID, wren), {message: S.swapHelper})
  await assert.rejects(() => swap('agent-session/bo', wren), {message: S.notChain('Hot-Swap', 'agent-session/bo')})
  assert.deepEqual(calls, [], 'a refused swap reaches no owner')
  assert.match(S.swapPress, /^Hot-Swap: drag the other agent from the browser onto Hot-Swap/)
  assert.match(S.swapSession, /drop it under the chain list/)
  // A lone session's one chain swaps its agent in the space it stands in.
  const bo = tracks.find(item => item.sessionRef === 'agent-session/bo')
  const lone = own.agentsetBinding({group: null, session: bo, tracks, holds: bind.chainHolds(), nowUnixMs: NOW}, ports)
  await lone.write([{key: 'swap', value: own.hotSwapDrop('agent-session/bo', wren)}])
  assert.deepEqual(calls.splice(0), [['hotSwap', {project: 'O-I', space: 'session-space/desk', agent_session: 'agent-session/bo', agent_ref: 'agent/wren'}]])

  // The Decision helper: dropped under the chain list of a group's rack, AIKit seats one session of the space as its helper.
  for (const dropped of [helper.DECISION_HELPER_ID, helper.DECISION_HELPER_DESIGN]) await rack.write([{key: 'add', value: dropped}])
  assert.deepEqual(calls.splice(0), [['decisionHelper', {project: 'O-I', space: 'session-space/crew', bound: true}], ['decisionHelper', {project: 'O-I', space: 'session-space/crew', bound: true}]])
  await assert.rejects(() => lone.write([{key: 'add', value: helper.DECISION_HELPER_ID}]), {message: S.helperLone})
  const bare = own.agentsetBinding({group: crew, tracks, holds: bind.chainHolds(), nowUnixMs: NOW}, {attach: ports.attach})
  await assert.rejects(() => bare.write([{key: 'add', value: helper.DECISION_HELPER_ID}]), {message: S.helperUncarried})
  assert.equal('helperAdd' in S, false, 'retired: AIKit\'s space names its Decision helper now')
  assert.deepEqual(calls, [])

  // The space's record names its helper: the group reads it, the helper's session is no agent's chain, and the rack lists the helper once.
  const helped = runModel.buildTracks(agencyRows(HELPED), ROSTER)
  const crewHelped = helped.find(item => item.sessionRef === 'session-space/crew')
  assert.equal(crewHelped.decisionHelper, 'agent-session/settle', 'the group reads its Decision helper from AIKit\'s record')
  assert.equal(helped.find(item => item.sessionRef === 'agent-session/settle').decisionHelper, true, 'the helper\'s own track says it is the helper')
  assert.deepEqual(own.agentsetMembers(crewHelped, helped).map(chain => chain.id), ['agent-session/kite', 'agent-session/cairn'], 'the helper is no agent\'s chain')
  assert.equal(tracks.find(item => item.sessionRef === 'session-space/crew').decisionHelper, undefined, 'a space that names none has none')
  const helpedRack = own.agentsetBinding({group: crewHelped, tracks: helped, holds: bind.chainHolds(), nowUnixMs: NOW, helper: {model: 'kev'}}, ports)
  await assert.rejects(() => helpedRack.write([{key: 'add', value: helper.DECISION_HELPER_ID}]), {message: S.helperStands})
  await assert.rejects(() => helpedRack.write([{key: 'swap', value: own.hotSwapDrop('agent-session/settle', wren)}]), {message: S.notChain('Hot-Swap', 'agent-session/settle')})
  // The chain wires both through the kernel, and the helper stands on the rack only where AIKit's record names one.
  const chainSource = read('agent/devices/FactoryDeviceChain.tsx')
  assert.match(chainSource, /hotSwap: input => chainListAct\(transport, \{op: 'encounter_session_hot_swap', \.\.\.input\}/)
  assert.match(chainSource, /decisionHelper: input => chainListAct\(transport, \{op: 'encounter_session_decision_helper', \.\.\.input\}/)
  assert.match(chainSource, /const helperStands = sessionRef != null && !!groupTrack\?\.decisionHelper/)
  // The rack's Hot-Swap takes the drop: the browser's agent onto the chosen chain's Hot-Swap.
  const rackSource = read('inhabitants/catalogue/panels/software-factory__agentset-rack.tsx')
  assert.match(rackSource, /p\.set\('swap', JSON\.stringify\(\{chain: chosen\.id, agent: dropped\}\)\)/)
  assert.equal(own.hotSwapDrop('agent-session/kite', wren), JSON.stringify({chain: 'agent-session/kite', agent: wren}), 'the binding reads the design\'s own drop')
  bind.resetHolds()
})

test('⌫ on the chosen chain deletes it as its own session track\'s Delete does: AIKit detaches its session; on the Decision helper its session leaves, and the helper with it (§10.9 Track: Delete, §19.15, round 862)', async () => {
  bind.resetHolds()
  const tracks = runModel.buildTracks(agencyRows(SPACES), ROSTER)
  const crew = tracks.find(item => item.sessionRef === 'session-space/crew')
  // With no carrier handed to the rack, Delete names the operation that carries it, and reaches no owner.
  const bare = own.agentsetBinding({group: crew, tracks, holds: bind.chainHolds(), nowUnixMs: NOW})
  assert.equal(own.AGENTSET_REFUSE.delete, 'Delete: no carrier to AIKit\'s detach of a chain\'s session from its space (the kernel\'s encounter_session_detach, as the session track\'s own Delete) stands on this chain.')
  assert.equal(bare.standing.delete?.disabled, own.AGENTSET_REFUSE.delete)
  assert.equal(bare.writes('delete'), true, 'the rack refuses Delete itself')
  await assert.rejects(() => bare.write([{key: 'delete', value: 'agent-session/kite'}]), {message: own.AGENTSET_REFUSE.delete})
  // The carrier is the track's own Delete: AIKit detaches the chain's session from the space that holds it; its task and settings stay AIKit's.
  const calls = []
  let refuse = null
  const ports = {detach: async input => { calls.push(input); if (refuse) throw Error(refuse); return {spaces: ['session-space/crew']} }}
  const rack = own.agentsetBinding({group: crew, tracks, holds: bind.chainHolds(), nowUnixMs: NOW}, ports)
  assert.equal(rack.standing.delete, undefined, 'Delete: its carrier stands')
  await rack.write([{key: 'delete', value: 'agent-session/kite'}])
  assert.deepEqual(calls.splice(0), [{project: 'O-I', agent_session: 'agent-session/kite'}])
  const S = own.CHAIN_LIST_REFUSE
  await assert.rejects(() => rack.write([{key: 'delete', value: 'agent-session/bo'}]), {message: S.notChain('Delete', 'agent-session/bo')}, 'bo is the desk\'s, not this rack\'s')
  await assert.rejects(() => rack.write([{key: 'delete', value: helper.DECISION_HELPER_ID}]), {message: S.helperUnnamed}, 'no helper stands on this rack')
  // AIKit's refusal reaches the rack in AIKit's words.
  refuse = 'AIKit: the session space is held by a running step'
  await assert.rejects(() => rack.write([{key: 'delete', value: 'agent-session/cairn'}]), {message: refuse})
  refuse = null
  calls.length = 0
  // The Decision helper: its session leaves the space, and AIKit takes the helper off with it (the space's helper is cleared when its session
  // is detached), so ⌫ on the helper takes it off the rack.
  const helped = runModel.buildTracks(agencyRows(HELPED), ROSTER)
  const crewHelped = helped.find(item => item.sessionRef === 'session-space/crew')
  const helpedRack = own.agentsetBinding({group: crewHelped, tracks: helped, holds: bind.chainHolds(), nowUnixMs: NOW, helper: {model: 'kev'}}, ports)
  await helpedRack.write([{key: 'delete', value: helper.DECISION_HELPER_ID}])
  assert.deepEqual(calls.splice(0), [{project: 'O-I', agent_session: 'agent-session/settle'}])
  // A lone session's rack: its one chain is the session itself, deleted as its track's Delete deletes it.
  const lone = own.agentsetBinding({group: null, session: BUMBLE, tracks: TRACKS, agent: agentOf().values, holds: bind.chainHolds()}, ports)
  await lone.write([{key: 'delete', value: BUMBLE.sessionRef}])
  assert.deepEqual(calls.splice(0), [{project: '', agent_session: BUMBLE.sessionRef}])
  // The chain hands the rack the track's own Delete (encounter_session_detach) through the chain list's act.
  const chainSource = read('agent/devices/FactoryDeviceChain.tsx'), acts = read('agent/factoryTaskActs.ts')
  assert.match(chainSource, /detach: input => chainListAct\(transport, \{op: 'encounter_session_detach', \.\.\.input\}, 'a chain was deleted from the rack'\)/)
  assert.match(acts, /'encounter_session_hot_swap'\s*\|\s*'encounter_session_decision_helper' \| 'encounter_session_detach'/)
  // The design: ⌫ (Delete or Backspace, no modifier) on the chain list deletes the chosen chain, and goes no further, so the frame does not
  // delete the track the rack stands on.
  const rackSource = read('inhabitants/catalogue/panels/software-factory__agentset-rack.tsx')
  assert.match(rackSource, /const deletesChain = \(e: \{key: string; metaKey: boolean; ctrlKey: boolean; altKey: boolean; shiftKey: boolean\}\): boolean =>\s*\(e\.key === 'Delete' \|\| e\.key === 'Backspace'\) && !e\.metaKey && !e\.ctrlKey && !e\.altKey && !e\.shiftKey/)
  assert.match(rackSource, /if \(grouped \|\| !chosen \|\| !deletesChain\(e\)\) return\s*e\.preventDefault\(\)\s*e\.stopPropagation\(\)\s*p\.set\('delete', chosen\.id\)/)
  assert.match(rackSource, /delete \(⌫ on the chosen[\s/]*chain in the chain list/)
  bind.resetHolds()
})

test('each chain of a group\'s rack shows as its chip the model its session last reported (Actuation\'s usage records; §19.15 the chain list)', () => {
  bind.resetHolds()
  // `actuation usage list --json` over every session (actuation.usage-listing/v1): its records in the order kept, each its session's.
  const listing = {schema: 'actuation.usage-listing/v1', records: [
    {agent_session_ref: 'agent-session/kite', usage: {model: {name: 'glm-5.3'}}},
    {agent_session_ref: 'agent-session/cairn', usage: {model: {name: 'sonnet-5.5'}}},
    {agent_session_ref: 'agent-session/kite', usage: {model: {name: 'glm-5.3-flash'}}},
    {agent_session_ref: 'agent-session/kite', usage: {tokens: {input: 3}}},
    {agent_session_ref: 'agent-session/elsewhere', usage: {model: {name: 'other'}}}]}
  const models = bind.lastUsageModels(listing)
  assert.equal(models.get('agent-session/kite'), 'glm-5.3-flash', 'the last record that names a model')
  assert.equal(models.get('agent-session/cairn'), 'sonnet-5.5')
  assert.equal(bind.lastUsageModels({schema: 'actuation.stream-listing/v1', records: []}).size, 0, 'another listing names no model')
  const chains = holds => JSON.parse(own.agentsetValues({group: CREW, tracks: TRACKS, holds, nowUnixMs: NOW, chainModels: models}).members)
  assert.deepEqual(chains(bind.chainHolds()).map(chain => [chain.id, chain.model]), [['agent-session/kite', 'glm-5.3-flash'], ['agent-session/cairn', 'sonnet-5.5']])
  const unread = JSON.parse(own.agentsetValues({group: CREW, tracks: TRACKS, holds: bind.chainHolds(), nowUnixMs: NOW}).members)
  assert.ok(unread.every(chain => !('model' in chain)), 'unread, no chain names a model: never a default')
  // The chain reads every session's usage once while the rack stands on a group.
  assert.match(read('agent/devices/FactoryDeviceChain.tsx'), /useActuationRead\(transport, groupTrack \? \{kind: 'usage-list'\} : null\)/)
  bind.resetHolds()
})

// ---------------------------------------------------------------- the name (owner: "never Agentset in anything a person reads")

test('the device is named Agent rack: its title, its runtime device, its manifest note, every view and refusal; its id stays', () => {
  assert.equal(design.id, 'software-factory:agentset-rack', 'the id presets and manifests are keyed by stays')
  assert.equal(design.title, 'Agent rack')
  assert.equal(own.sessionDevices().agentset?.face.title, 'Agent rack')
  const face = inhabitantManifest('software-factory')?.faces.find(item => item.id === 'agentset-rack')
  assert.match(face?.note ?? '', /Agent rack/)
  assert.doesNotMatch(face?.note ?? '', /Agentset|agentset/)
  const fixtures = [design.defaults, ...Object.values(design.fixtures).map(fixture => ({...design.defaults, ...fixture}))]
  for (const values of fixtures) for (const markup of hosted(null, values)) {
    assert.doesNotMatch(markup, /Agentset/, 'no view says Agentset')
    assert.doesNotMatch(markup, />Members\b|Members · /, 'its rows are chains, never members')
  }
  for (const why of Object.values(own.AGENTSET_REFUSE)) assert.doesNotMatch(why, /Agentset/, why)
  const aikit = inhabitantManifest('ai-kit')?.faces.find(item => item.id === 'decision-helper')
  assert.doesNotMatch(aikit?.note ?? '', /Agentset/, 'the Decision helper is a chain of the Agent rack')
})

test('the shell\'s words for Factory name the Agent rack on every session\'s chain', () => {
  const details = read('shell/modeDetails.tsx')
  assert.doesNotMatch(details, /Agentset/)
  assert.match(details, /'the session\\'s chain: Gateway → Remote carrier → the Agent rack → Scope → Git \/ landing'/)
  const agency = read('inhabitants/catalogue/faces/agency.ts')
  assert.match(agency, /RACK = 'Agent rack'/, 'the Type page lands its settings on the Agent rack')
  assert.doesNotMatch(read('agent/agentFidelity.ts'), /Agentset/)
  assert.doesNotMatch(read('inhabitants/capabilityHomes.ts'), /Agentset rack/)
})

// ---------------------------------------------------------------- the chain draws it (code-reading)

test('the chain draws the rack on every session, the session\'s own chain inside it under the rack\'s Devices mark, closed by its end bracket', () => {
  const view = read('agent/devices/FactoryDeviceChain.tsx')
  assert.match(view, /case 'agentset': return rackPlate\(\)/, 'the rack is a plate of every session\'s chain')
  assert.match(view, /const rackDevicesShown = useRackShown\(AGENTSET_ID, 'devices'\)/, 'the rack\'s head shows or hides its chain\'s devices (§16.4)')
  assert.match(view, /RACK_CHAIN\.map\(slot => slotPlate\(slot\)\)/, 'the session\'s own chain: its devices themselves, every setting live')
  assert.match(view, /className="factory-rack__end"/, 'a narrow end bracket closes the rack')
  assert.match(view, /agentsetBinding\(\{group: groupTrack, session: loneTrack,/, 'the rack on a lone session reads that session')
  assert.match(view, /agent: oneAgent/, 'its macros turn the one agent through the Agent itself')
  // The chain list's carriers (#745 with #772): AIKit's bench, attach and drag out of a chain's session, each through the kernel.
  for (const [port, op] of [['bench', 'encounter_session_bench'], ['attach', 'encounter_session_attach'], ['dragOut', 'encounter_session_drag_out'],
    ['hotSwap', 'encounter_session_hot_swap'], ['decisionHelper', 'encounter_session_decision_helper']]) {
    assert.match(view, new RegExp(`${port}: input => chainListAct\\(transport, \\{op: '${op}', \\.\\.\\.input\\}`), port)
  }
  // Scope's Calls to other agents: AIKit's rule for agents, read from the gateway's ecology and set on each binding of the session.
  assert.match(view, /callsOf\(ecology\.value, sessionRef\)/)
  // REPLACED (round 860): set one binding at a time inline; now through callsOnEvery, which says which bindings stand changed when one refuses.
  assert.match(view, /callsOnEvery\(bindings, decision, \(ruled, said\) => harnessIngressRule\(transport, ruled, 'agent', said\)\)/)
  assert.match(view, /data-reaches=\{reach\.reaches\}/, 'each plate says how far it reaches')
  assert.match(view, /case 'remote-carrier': return placed\(CARRIER_ID, cells\.carrier, carrierDesignBinding/)
  assert.doesNotMatch(view, /Agentset/)
})

// ---------------------------------------------------------------- the rack's face (software-factory__agentset-rack.tsx)

const fixture = name => ({...design.defaults, ...design.fixtures[name]})
const words = markup => markup.replaceAll('&#x27;', '\'').replaceAll('&quot;', '"').replaceAll('&amp;', '&')
const partsOf = markup => [...markup.matchAll(/data-rack-part="(\w+)"/g)].map(m => m[1]).filter((part, i, all) => part !== all[i - 1])

test('a set in a chain: the list names it by how many agents its rack holds; a macro reaches the set\'s own macro and through it its mapped agents', () => {
  const [, compact, whole] = hosted(null, fixture('An agent set in a chain')).map(words)
  assert.match(compact, /set · 3/, 'the set\'s chip: its rack\'s three agents (the mockup\'s chip)')
  // The mockup's map: the track's Model macro reaches the set's own macro and Bumble; Honey keeps her own, and so does Fizz inside the set.
  assert.match(whole, /The Model macro turns the Agent's Model on 3 of 5 agents, through the Mercurius correlation set's own macro\. Unmapped, Fizz, Honey keep their own\./)
  assert.match(whole, /The Effort macro turns the Agent's Effort on 5 of 5 agents, through the Mercurius correlation set's own macro\./)
  // A setting turned by hand in the Devices view comes off its macro (chains.ts offByHand), on the rack's own `unmapped`.
  assert.match(read('inhabitants/catalogue/panels/software-factory__agentset-rack.tsx'), /p\.set\('unmapped', JSON\.stringify\(offByHand\(all, macro, at\.chain\)\)\)/)
})

test('a session of one agent: the rack\'s compact draws no Devices view of its own — the agent\'s devices stand beside it on the chain, live', () => {
  assert.deepEqual(partsOf(hosted(null, fixture('A session of one agent'))[1]), ['macros', 'chains'])
  assert.deepEqual(partsOf(hosted(null, design.defaults)[1]), ['macros', 'chains', 'devices'], 'a group\'s chain still shows its devices in the rack')
})

test('Group: the chains taken in with + make the set; with fewer than two Group stands dimmed and says why', () => {
  const chosen = words(hosted(null, fixture('Chains chosen for Group'))[2])
  assert.equal([...chosen.matchAll(/aria-label="Take [^"]+ into a set" aria-pressed="true"|aria-pressed="true" aria-label="Take [^"]+ into a set"/g)].length, 2, 'two chains taken in')
  assert.doesNotMatch(chosen, /Take at least two chains in/)
  assert.match(words(hosted(null, design.defaults)[2]), /Take at least two chains in with \+ in the list first\./)
  const card = words(hosted(null, fixture('Making a set'))[2])
  assert.match(card, /What the set is for/)
  assert.doesNotMatch(card, /What the team is for|Keeps the team/)
})

// ---------------------------------------------------------------- nested sets, Budget and Factory's rack macros (O-I #842 round 20)

// The desk's record holds the crew as a chain (AIKit's `set_chains`, made by `aikit session-space group`), beside bo's own session.
const NESTED_SPACES = [SPACES[0], {...SPACES[1], set_chains: {'session-space/crew': {space: 'session-space/crew', purpose: 'Check the port', provenance: {action: 'group'}}}}]
// Factory's reading of one rack's macros (factory.rack-macros-reading/v1), and the receipt of a write on it.
const macrosReading = (revision, over = {}) => ({schema: 'factory.rack-macros-reading/v1', revision, macros: {model: null, effort: null, budget: null},
  unmapped: {model: [], effort: [], budget: []}, variations: [], ...over})
const answered = reading => ({status: 'answered', reading: chains.rackMacrosReadingOf(reading)})

test('a set held as a chain holds its own nested rack, read from AIKit\'s set_chains on the space\'s record; a cycle is not entered again', () => {
  bind.resetHolds()
  const tracks = runModel.buildTracks(agencyRows(NESTED_SPACES), ROSTER)
  const desk = tracks.find(item => item.sessionRef === 'session-space/desk')
  assert.deepEqual(desk.setChains, [{space: 'session-space/crew', purpose: 'Check the port'}], 'the track reads the sets its space holds')
  assert.equal(tracks.find(item => item.sessionRef === 'session-space/crew').setChains, undefined, 'a space that holds no set names none')
  assert.deepEqual(own.rackSpaces(desk, tracks), ['session-space/desk', 'session-space/crew'], 'Factory keeps each rack\'s macros by its space')
  assert.deepEqual(own.agentChainSessions(desk, tracks).map(at => at.session), ['agent-session/bo', 'agent-session/kite', 'agent-session/cairn'],
    'every agent the rack reaches, the set\'s with its own')
  const values = own.agentsetValues({group: desk, tracks, holds: bind.chainHolds(), nowUnixMs: NOW})
  const members = JSON.parse(values.members)
  assert.deepEqual(members.map(member => member.id), ['agent-session/bo', 'session-space/crew'])
  assert.deepEqual([members[1].name, members[1].chain], ['Check the port', [{device: own.AGENTSET_DESIGN, name: 'Agent rack'}]], 'the set is a chain holding a rack')
  const nested = JSON.parse(values[own.memberDeviceKey('session-space/crew', own.AGENTSET_DESIGN)])
  assert.deepEqual(JSON.parse(nested.members).map(member => member.id), ['agent-session/kite', 'agent-session/cairn'])
  assert.equal(nested.crew, 'Port crew')
  assert.equal(nested['bench:agent-session/kite'], true, 'the nested rack reads its own space\'s bench')
  // A record that holds the desk inside the crew again is not walked twice.
  const looped = tracks.map(item => (item.sessionRef === 'session-space/crew' ? {...item, setChains: [{space: 'session-space/desk', purpose: null}]} : item))
  assert.deepEqual(own.agentChainSessions(desk, looped).map(at => at.session), ['agent-session/bo', 'agent-session/kite', 'agent-session/cairn'])
  assert.deepEqual(own.rackSpaces(desk, looped), ['session-space/desk', 'session-space/crew'])
})

test('Budget turns each chain\'s task in AIKit, past the chains Factory says each rack leaves alone; Unmap, Store and a variation are Factory\'s rack macros', async () => {
  bind.resetHolds()
  const tracks = runModel.buildTracks(agencyRows(NESTED_SPACES), ROSTER)
  const desk = tracks.find(item => item.sessionRef === 'session-space/desk')
  const calls = []
  let untasked = null
  const taskBudget = {
    read: async ({project, agent_session}) => {
      calls.push(['task', project, agent_session])
      const name = agent_session.split('/')[1]
      return agent_session === untasked ? {revision: 't0', request: {central: {}}} : {revision: `t-${name}`, request: {central: {task_ref: `task:${name}`}}, turns: {cap: 12, used: 3, revision: 'b1'}}
    },
    write: async request => { calls.push(['budget', request]); return {} },
  }
  let revision = 3
  const rackMacros = async input => {
    calls.push(['macros', input])
    revision += 1
    return {...macrosReading(String(revision), input.act === 'recall' ? {macros: {model: null, effort: null, budget: 30}} : {}), schema: 'factory.rack-macros-write/v1'}
  }
  // The desk's macros stand at Budget 12 with one variation kept; the crew's rack leaves cairn's Budget alone.
  const kept = new Map([['session-space/desk', answered(macrosReading('3', {macros: {model: null, effort: null, budget: 12}, variations: [{name: 'Long', values: {budget: 30}}]}))],
    ['session-space/crew', answered(macrosReading('5', {unmapped: {model: [], effort: [], budget: ['agent-session/cairn']}}))]])
  const input = {group: desk, tracks, holds: bind.chainHolds(), rackMacros: kept}
  // With no carriers handed, each names its own.
  const bare = own.agentsetBinding(input, {})
  for (const key of ['budget', 'unmapped', 'store', 'variation']) assert.equal(bare.standing[key].disabled, own.AGENTSET_REFUSE[key], key)
  assert.match(own.AGENTSET_REFUSE.unmapped, /factory_owner rack-macros-write/)
  const rack = own.agentsetBinding(input, {taskBudget, rackMacros})
  for (const key of ['budget', 'unmapped', 'store', 'variation']) assert.equal(rack.standing[key], undefined, `${key} turns`)
  assert.equal(rack.values.budget, 12, 'a group\'s Budget stands where Factory keeps it')
  assert.deepEqual(JSON.parse(rack.values.variations), [{name: 'Long', budget: 30}])
  // Budget: every chain's task read before any is written, each at its task's revision and its Budget's; cairn is left alone by the crew's rack.
  await rack.write([{key: 'budget', value: 20}])
  assert.deepEqual(calls.filter(c => c[0] === 'task').map(c => c[2]), ['agent-session/bo', 'agent-session/kite'])
  assert.deepEqual(calls.filter(c => c[0] === 'budget').map(c => c[1]), [
    {project: 'O-I', agent_session: 'agent-session/bo', task_ref: 'task:bo', turns: 20, expected_revision: 't-bo', expected_budget_revision: 'b1'},
    {project: 'O-I', agent_session: 'agent-session/kite', task_ref: 'task:kite', turns: 20, expected_revision: 't-kite', expected_budget_revision: 'b1'}])
  assert.deepEqual(calls.at(-1), ['macros', {space_ref: 'session-space/desk', expected_revision: '3', act: 'turn', macro: 'budget', value: 20}],
    'then Factory keeps where the macro stands, on the rack\'s revision')
  // Unmap takes a chain off a macro, on the revision the last act gave.
  calls.length = 0
  await rack.write([{key: 'unmapped', value: JSON.stringify({budget: ['agent-session/bo']})}])
  assert.deepEqual(calls, [['macros', {space_ref: 'session-space/desk', expected_revision: '4', act: 'unmap', macro: 'budget', chain: 'agent-session/bo'}]])
  // Store keeps where every macro stands as the rack's next variation.
  calls.length = 0
  await rack.write([{key: 'store', value: true}])
  assert.deepEqual(calls, [['macros', {space_ref: 'session-space/desk', expected_revision: '5', act: 'store', variation: 'Variation 2', values: {model: null, effort: null, budget: 12}}]])
  assert.equal(bind.viewHolds(bind.chainHolds(), own.AGENTSET_ID).variation, 'Variation 2')
  // A variation: Factory moves every macro there, and each turns every chain it reaches through its own owner; nothing is kept twice.
  calls.length = 0
  await rack.write([{key: 'variation', value: 'Long'}])
  assert.deepEqual(calls[0], ['macros', {space_ref: 'session-space/desk', expected_revision: '6', act: 'recall', variation: 'Long'}])
  assert.deepEqual(calls.filter(c => c[0] === 'budget').map(c => [c[1].agent_session, c[1].turns]), [['agent-session/bo', 30], ['agent-session/kite', 30]])
  assert.equal(calls.filter(c => c[0] === 'macros').length, 1)
  // A chain with no task turns none; a nested rack Factory has not answered leaves the turn unknown, so none is turned.
  calls.length = 0
  untasked = 'agent-session/kite'
  await assert.rejects(() => rack.write([{key: 'budget', value: 8}]), error => error.message === 'Budget: kite has no task bound, so no Budget can be set on it, and no chain was turned.')
  assert.deepEqual(calls.filter(c => c[0] !== 'task'), [], 'nothing was written')
  const unread = own.agentsetBinding({...input, rackMacros: new Map([['session-space/desk', kept.get('session-space/desk')]])}, {taskBudget, rackMacros})
  await assert.rejects(() => unread.write([{key: 'budget', value: 8}]),
    error => error.message === 'Budget: Software Factory has not said which chains session-space/crew\'s macros leave alone (its reading has not come yet), so no chain was turned.')
  // The chain hands the rack each carrier: AIKit's task read and Budget, Factory's rack macros, AIKit's group.
  const chainSource = read('agent/devices/FactoryDeviceChain.tsx'), acts = read('agent/factoryTaskActs.ts')
  assert.match(chainSource, /taskBudget: \{read: \(\{project, agent_session\}\) => chainTaskRead\(transport, project, agent_session\)/)
  assert.match(chainSource, /kind: 'rack-macros-write'/)
  assert.match(chainSource, /chainListAct\(transport, \{op: 'encounter_session_group', \.\.\.input\}/)
  assert.match(acts, /act\(transport, \{op: 'encounter_task_budget', \.\.\.input\}\)/)
  assert.match(acts, /kind: 'rack-macros-read'/)
  bind.resetHolds()
})
