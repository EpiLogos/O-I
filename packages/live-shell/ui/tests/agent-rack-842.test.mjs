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
  assert.match(binding.standing.model.disabled, /Model/, 'the Agent writes no Model here')
  await assert.rejects(() => binding.write([{key: 'budget', value: 20}]), /Budget is a reading here/)
  // A group's macros still name the operation each chain waits for: the rack holds no member's Agent, so the Agent it is handed is not theirs.
  const crew = own.agentsetBinding({group: CREW, tracks: TRACKS, holds: bind.chainHolds()}, {agent})
  for (const key of ['model', 'effort', 'budget']) {
    assert.match(crew.standing[key].disabled, /missing op/, key)
    await assert.rejects(() => crew.write([{key, value: 'high'}]), /missing op/, key)
  }
  assert.equal(sent.length, 1, 'no member\'s macro reached the session\'s own Agent')
})

test('Group, on chains chosen in the list, asks Central to propose them as an agent set; Accept saves Central\'s record', async () => {
  bind.resetHolds()
  const calls = []
  const ports = {
    propose: async input => { calls.push(['propose', input]); return {record: {schema: 'central.agent-set/v1', ref: input.ref, revision: 'r1', members: input.members}} },
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
  await held.write([{key: 'new.accept', value: true}])
  assert.deepEqual(calls[1], ['save', {scope: 'root', record: {schema: 'central.agent-set/v1', ref: 'agent-set:check-the-port-r7x', revision: 'r1',
    members: [{kind: 'agent', agent_ref: 'agent/kite'}, {kind: 'agent', agent_ref: 'agent/cairn'}]}, expected_revision: 'r1'}])
  await assert.rejects(() => held.write([{key: 'new.discard', value: true}]), /central\.agent-set\.remove/)
  assert.match(held.standing['new.type'].disabled, /missing op/, 'Central\'s propose takes no type')
  // A chain whose session seats no agent cannot be proposed as a member.
  const unseated = own.agentsetBinding({group: CREW, tracks: TRACKS.map(item => (item === CAIRN ? {...item, agentRef: null} : item)), holds: bind.chainHolds()}, ports)
  await assert.rejects(() => unseated.write([{key: 'new.make', value: JSON.stringify({for: 'Check', chains: [KITE.sessionRef, CAIRN.sessionRef]})}]), /seats no agent/)
  bind.resetHolds()
})

// ---------------------------------------------------------------- the chain list on AIKit's own session-space operations (O-I #745 with #772)

test('each chain-list control with no carrier refuses in the words of the operation that carries it; Hot-Swap in AIKit\'s own law (O-I #772)', async () => {
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
  // Hot-Swap: AIKit's law keeps a session's agent for good (encounter_agency.rs configure_agency, encounter.agent_identity_changed), where
  // the manual swaps the agent and keeps the rest of the chain; it is refused in AIKit's words, with what a person can do instead.
  assert.match(R.swap, /^Hot-Swap: AIKit does not let a chain's session become another agent: "A canonical session must not silently become another Agent; create a separately attributed session" \(AIKit\)\./)
  assert.match(R.swap, /drop the other agent's session into the chain list, then delete this chain's track/)
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
  assert.equal(rack.standing.swap.disabled, own.AGENTSET_REFUSE.swap, 'Hot-Swap stays refused in AIKit\'s law')

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
  await assert.rejects(() => lone.write([{key: 'add', value: helper.DECISION_HELPER_ID}]), {message: own.CHAIN_LIST_REFUSE.helperAdd})
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
  for (const [port, op] of [['bench', 'encounter_session_bench'], ['attach', 'encounter_session_attach'], ['dragOut', 'encounter_session_drag_out']]) {
    assert.match(view, new RegExp(`${port}: input => chainListAct\\(transport, \\{op: '${op}', \\.\\.\\.input\\}`), port)
  }
  // Scope's Calls to other agents: AIKit's rule for agents, read from the gateway's ecology and set on each binding of the session.
  assert.match(view, /callsOf\(ecology\.value, sessionRef\)/)
  assert.match(view, /await harnessIngressRule\(transport, ruled, 'agent', decision\)/)
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
