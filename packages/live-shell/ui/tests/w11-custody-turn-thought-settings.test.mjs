// Lane W11, on builder E's round (19ade6298): the Ledger's Commented from the returns entry's `comments`; Custody's settings and held
// items through Factory's custody list, written through CustodyAssign only while the session's work is unassigned and only to the
// person's Position; the Agent's Context page on AIKit's kept turn; the Flow document's Thought page on AIKit's kept thoughts and what
// changed since the last one; the native Settings connector's Machines (Workcell's control operations) and Routine authoring.
//
// Channels:
// Custody sits on the Agent (§19.4): an assignment names the Position the session's agent holds; the press is the person's own.
// - REAL (read-only, 21 Oct): `factory development custody list` (factory-custody-list-2026-10-21.json: nothing retained, and Factory's
//   refusal of an unknown state); `aikit work continuity turn` and `aikit flow thoughts` from ai-kit#543/#544 built locally (aikit-turn-
//   thoughts-2026-10-21.json: nothing kept yet); `workcell machine list` from Workcell#118 built locally (workcell-machine-list-2026-10-21.json);
//   AIKit's population (tests/fixtures/workcell-readings-2026-10-21.json).
// - FAKE, each in its owner's own shape: an assigned custody record (factory.work-custody/v1), a kept turn with blocks, a kept thought;
//   every write goes to a recording port or a fake call. Never a real custody assignment, never a real Routine created or enabled.
// - SCRIPTED: the catalogue designs rendered through the runtime's host to static markup.
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
  if(url.includes('?raw')||url.endsWith('.html'))return {format:'module',shortCircuit:true,source:'export default ""'};
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
const model = await import('../src/agent/devices/agentChainDevices.ts')
const bind = await import('../src/agent/devices/designBindings.ts')
const rec = await import('../src/agent/devices/receiptBindings.ts')
const session = await import('../src/agent/devices/sessionChainBindings.ts')
const pages = await import('../src/agent/devices/aikitPages.ts')
const ground = await import('../src/central/devices/pageGround.ts')
const config = await import('../src/native/configuration.ts')
const {design: custodyDesign} = await import('../src/inhabitants/catalogue/panels/agent-custody.tsx')
const {design: agentDesign} = await import('../src/inhabitants/catalogue/panels/actuation__harness-model.tsx')

family.resetFamilyManifestsForTest()
loadAgentShellFamilies()

const json = path => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'))
const ROUTES = '../../../../desktop/cradle/kernel/tests/fixtures/owner-routes/'
const CUSTODY = json(`${ROUTES}factory-custody-list-2026-10-21.json`)
const KEPT = json(`${ROUTES}aikit-turn-thoughts-2026-10-21.json`)
const MACHINES = json(`${ROUTES}workcell-machine-list-2026-10-21.json`)
const REAL = json('./fixtures/workcell-readings-2026-10-21.json')
const read = path => readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8')
const answered = value => ({status: 'answered', value, error: null})
const hosted = (designed, binding) => host.viewsOf(designed).map(view => [view, renderToStaticMarkup(createElement(host.HostedDevice, {designed, binding, view, nav: {}}))])
const designKeys = design => [...new Set([...Object.keys(design.defaults), ...Object.values(design.fixtures ?? {}).flatMap(fixture => Object.keys(fixture))])]
const classify = (binding, key) => binding.local && key in binding.local ? 'local' : key in binding.values ? 'reading' : binding.standing?.[key]?.disabled ? 'absent' : binding.writes?.(key) ? 'write' : null

const PERSON = 'person:frank'
const STATE = '/Users/admin/Central/Work/O-I/.factory/development-state.json'
const WORK = 'control:task:type-check-roots'
const AGENT_POSITION = 'central:position:project:O-I:factory-guardian'
/** A custody record in Factory's own shape (factory/src/work_custody.rs FactoryWorkCustody, with the PR 288 settings). */
const RECORD = {schema: 'factory.work-custody/v1', custody_ref: 'factory:custody:0a1b2c3d-0000-4000-8000-00000000000a', position_ref: AGENT_POSITION, work_ref: WORK,
  state: 'in-progress', assigned_at_unix_ms: 1, reason: 'handed out', revision: 1, updated_at_unix_ms: 1, transitions: [], autonomy: 'suggest', review_gate: 'diffs', escalate_to: PERSON}
const listingWith = (...records) => ({...CUSTODY.list, count: records.length, custody: records})
const custodyRead = over => ({statePath: STATE, listing: answered(CUSTODY.list), agentPosition: AGENT_POSITION, work: WORK, ...over})
const custody = (read, ports = {}, person = PERSON) => session.custodyBinding({sessionRef: 's', autonomy: 'review', agent: {light: 'lit'}, holds: bind.chainHolds(), person, custody: read}, null, ports)
function recorder(name) {
  const calls = []
  return {calls, port: {[name]: async request => { calls.push(request); return {} }}}
}

// ------------------------------------------------------------------------------------------------------------------ 1. the Ledger

test('1 · the Ledger\'s Commented from the returns entry\'s `comments`, Waiting when Central gives none', () => {
  const entry = (n, over) => ({return_ref: `central:return:project:o-i:${1_792_157_400_000 + n}000000-1`, source_ref: `central:source:project:O-I:docs/${n}.md`, basis_revision: 'r', status: 'pending',
    agent_session_ref: 's', current_revision: 'r', ...over})
  const rows = rec.returnReceiptRows([entry(1, {comments: 3}), entry(2, {comments: 0}), entry(3, {}), entry(4, {comments: null})], [], 'Europe/London')
  assert.deepEqual(rows.map(row => row.outcome), ['commented', 'waiting', 'waiting', 'waiting'])
})

// ------------------------------------------------------------------------------------------------------------------ 2. Custody

test('2 · Custody reads Factory\'s custody list (REAL: nothing retained): no held item, the settings unassigned; an assigned record\'s settings are Factory\'s own', () => {
  assert.deepEqual(session.openCustody(CUSTODY.list), [])
  assert.equal(session.openCustody({schema: 'other'}), null)
  bind.resetHolds()
  const none = custody(custodyRead())
  assert.equal(none.values.held, '[]', 'the agent holds nothing in Factory\'s state')
  assert.equal(none.values.autonomy, 'review', 'the task record\'s own word stands while no record names the setting')
  const assigned = custody(custodyRead({listing: answered(listingWith(RECORD, {...RECORD, custody_ref: 'factory:custody:x', state: 'completed'}))}))
  assert.deepEqual(JSON.parse(assigned.values.held), [{id: RECORD.custody_ref, name: WORK, kind: 'work', state: 'in-progress'}], 'a closed record is no held item')
  assert.deepEqual([assigned.values.autonomy, assigned.values.gate, assigned.values.escalate], ['suggest', 'diffs', PERSON])
  const factorySays = `${CUSTODY.refused.fact} ${CUSTODY.refused.consequence}`
  const refusedRead = custody(custodyRead({listing: {status: 'refused', value: null, error: factorySays}}))
  assert.equal(refusedRead.standing.held.disabled, factorySays, 'Factory\'s refusal in its words')
  assert.match(refusedRead.standing.autonomy.disabled, /is not a custody state/)
})

test('3 · a setting is written (CustodyAssign with it alone) to the Position the session\'s agent holds, on the person\'s press, while the work is unassigned; after assignment the ruling, verbatim', async () => {
  bind.resetHolds()
  const {calls, port} = recorder('assign')
  const open = custody(custodyRead(), {...port, personNow: () => PERSON})
  for (const key of ['autonomy', 'gate', 'escalate']) assert.equal(open.standing[key], undefined, `${key} stands`)
  await open.write([{key: 'autonomy', value: 'auto'}])
  await open.write([{key: 'gate', value: 'both'}])
  await open.write([{key: 'escalate', value: PERSON}])
  // 1. The agent's Position is assigned.
  assert.deepEqual(calls, [
    {kind: 'custody-assign', state_path: STATE, position_ref: AGENT_POSITION, work_ref: WORK, reason: `${PERSON} set Autonomy to auto from the desk.`, autonomy: 'auto'},
    {kind: 'custody-assign', state_path: STATE, position_ref: AGENT_POSITION, work_ref: WORK, reason: `${PERSON} set Review gate to both from the desk.`, review_gate: 'both'},
    {kind: 'custody-assign', state_path: STATE, position_ref: AGENT_POSITION, work_ref: WORK, reason: `${PERSON} set Escalate to to ${PERSON} from the desk.`, escalate_to: PERSON}])
  calls.length = 0
  await assert.rejects(open.write([{key: 'autonomy', value: 'always'}]), /one of suggest, review, auto/)
  // The 3a ruling once the work is assigned, verbatim.
  const assigned = custody(custodyRead({listing: answered(listingWith(RECORD))}), port)
  for (const key of ['autonomy', 'gate', 'escalate']) {
    assert.ok(assigned.standing[key].disabled.endsWith(session.CUSTODY_SETTINGS_RULING), `${key}: the ruling, verbatim`)
    assert.match(assigned.standing[key].disabled, /the session's work is assigned already \(factory:custody:0a1b2c3d/)
  }
  await assert.rejects(assigned.write([{key: 'autonomy', value: 'auto'}]), /Changing it after assignment waits for the owner's ruling/)
  // 2. A session whose agent holds no Position refuses, naming that.
  const unplaced = custody(custodyRead({agentPosition: null}), port)
  for (const key of ['autonomy', 'gate', 'escalate']) assert.match(unplaced.standing[key].disabled, /the session's agent holds no Position/, key)
  await assert.rejects(unplaced.write([{key: 'gate', value: 'both'}]), /the session's agent holds no Position \(AIKit's population names none whose occupant is this agent\)/)
  // 3. A non-person press never reaches the port: no person current, or the person changed since the drawing.
  await assert.rejects(custody(custodyRead(), port, null).write([{key: 'autonomy', value: 'auto'}]), /only the person sets it from here, and no person is current/)
  await assert.rejects(custody(custodyRead(), port, '  ').write([{key: 'autonomy', value: 'auto'}]), /no person is current/)
  await assert.rejects(custody(custodyRead(), {...port, personNow: () => 'agent/factory-guardian'}).write([{key: 'autonomy', value: 'auto'}]), /no longer the one this page was drawn for/)
  await assert.rejects(custody(custodyRead(), {...port, personNow: () => null}).write([{key: 'escalate', value: PERSON}]), /no longer the one this page was drawn for/)
  // And the rest: the work must be named, a carrier must stand.
  await assert.rejects(custody(custodyRead({work: null}), port).write([{key: 'gate', value: 'both'}]), /no reading names the session's work/)
  await assert.rejects(custody(custodyRead(), {}).write([{key: 'gate', value: 'both'}]), /carrier is unavailable/)
  assert.deepEqual(calls, [], 'nothing refused reached Factory')
})

test('4 · the chain names the Position the session\'s agent holds from AIKit\'s population (REAL: occupied Positions hold agents), and assigns through factory_owner', () => {
  const occupied = REAL.population.positions.filter(row => row.occupancy?.state === 'occupied')
  assert.ok(occupied.some(row => row.occupancy.agent_ref === 'agent/factory-guardian' && row.position_ref === AGENT_POSITION), 'the agent\'s Position, as AIKit places it')
  const chain = read('agent/devices/FactoryDeviceChain.tsx')
  assert.match(chain, /\{op: 'factory_owner', request: \{kind: 'custody-list', state_path: custodyState\}\}/)
  assert.match(chain, /assign: request => factoryOwnerWrite\(transport, request, '`factory development custody assign`'\)/)
  assert.match(chain, /agentPosition: heldBy\(track\?\.agentRef\), work:/)
  assert.doesNotMatch(chain, /personPosition/, 'no Position is the person\'s: custody sits on the Agent')
  assert.doesNotMatch(read('agent/devices/sessionChainBindings.ts'), /personPosition/)
})

// ------------------------------------------------------------------------------------------------------------------ 3. Context turn

test('5 · the Agent\'s Context page on AIKit\'s kept turn: nothing kept says so (REAL turn: null); a kept turn\'s blocks as AIKit kept them', () => {
  assert.deepEqual(pages.contextTurnOf(KEPT.turn.data), {kept: false, scope: '/Users/admin/Central/Work/O-I'})
  const TURN = {...KEPT.turn.data, turn: {schema: 'aikit.turn-bound/v1'}, blocks: [{event: 'UserPromptSubmit', title: 'Standing guidance', standing: 4, kept: 2, withheld: 1, suppressed: false}],
    withheld_lines: 12, withheld_blocks: 1, notices: ['Depleted: 1 block withheld']}
  assert.deepEqual(pages.contextTurnOf(TURN), {kept: true, turn: {blocks: [{event: 'UserPromptSubmit', title: 'Standing guidance', standing: 4, kept: 2, withheld: 1, suppressed: false}],
    withheldLines: 12, withheldBlocks: 1, notice: 'Depleted: 1 block withheld'}})
  assert.equal(pages.contextTurnOf({}), null)
  const input = turn => ({sessionRef: 's', track: null, nowUnixMs: 1, reading: model.INITIAL_READING, accepted: {}, harness: {binding: 'cursor', resolved: false}, holds: bind.chainHolds(),
    context: {pressure: answered(null), commands: answered(null), turn}})
  const nothing = bind.agentBinding(bind.AGENT_DESIGN, input(answered(KEPT.turn.data)), {}, async () => ({kind: 'refused', reason: 'x'}), () => false)
  assert.match(nothing.standing['ctx.turn'].disabled, /AIKit kept no turn for \/Users\/admin\/Central\/Work\/O-I \(`aikit work continuity turn` answered turn: null/)
  const kept = bind.agentValues(input(answered(TURN)))
  assert.deepEqual(JSON.parse(kept['ctx.turn']), pages.contextTurnOf(TURN).turn)
  const refusedTurn = bind.agentBinding(bind.AGENT_DESIGN, input({status: 'refused', value: null, error: KEPT.turn_installed_refusal.trim()}), {}, async () => ({kind: 'refused', reason: 'x'}), () => false)
  assert.match(refusedTurn.standing['ctx.turn'].disabled, /unrecognized subcommand 'turn'/, 'the installed AIKit\'s own refusal')
  // REPLACED (O-I #740 lane B): RACK_PROJECT ('O-I'); the chain's register — the session's own, the root's null (agent/worldScope.ts).
  assert.match(read('agent/devices/FactoryDeviceChain.tsx'), /useAikitRead\(transport, contextOn \? \{kind: 'continuity-turn', project: register, session: sessionRef\} : null\)/)
})

// ------------------------------------------------------------------------------------------------------------------ 4. the Flow's Thought

test('6 · the Flow\'s Thought page: AIKit\'s last kept thought (REAL: none kept — said as JSON null), then what changed since it; a run here stands over it', () => {
  assert.equal(ground.lastKeptThought(KEPT.thoughts.data), null)
  assert.equal(ground.lastKeptThought({version: 'other'}), undefined)
  const noneKept = ground.thoughtValues({flowRef: 'wiki:node:staged/test-flow', kept: {status: 'answered', value: KEPT.thoughts.data}})
  assert.equal(noneKept.thought, 'null', 'the Flow has not been contemplated where AIKit keeps thoughts')
  const RECORD_T = {flow_ref: 'wiki:node:staged/test-flow', invocation_ref: 'inv:1', tensions: [{}, {}], candidates: [{}], human_source_proposals: [], flow_mutations: [{}]}
  const keptData = {...KEPT.thoughts.data, thoughts: [{recorded_at_unix_ms: 1_792_600_000_000, thought: RECORD_T}]}
  assert.deepEqual(ground.lastKeptThought(keptData), {at: 1_792_600_000_000, thought: RECORD_T})
  const since = {status: 'answered', value: {aikit: {state: 'invoked', receipt: {changed_sources: ['a'], affected_knowledge: [], unresolved: []}}}}
  const values = ground.thoughtValues({flowRef: 'f', kept: {status: 'answered', value: keptData}, keptSince: since}, 'Europe/London')
  const thought = JSON.parse(values.thought)
  assert.deepEqual([thought.state, thought.tensions, thought.candidates, thought.intents, thought.at], ['cognition', 2, 1, 1, '21 Oct 17:26'])
  assert.equal(JSON.parse(values.since).changed, 1)
  const ran = ground.thoughtValues({flowRef: 'f', kept: {status: 'answered', value: keptData}, keptSince: since, thought: {status: 'refused', error: 'AIKit: the Flow moved'}})
  assert.deepEqual(JSON.parse(ran.thought), {state: 'refused', reason: 'AIKit: the Flow moved'}, 'the run here stands over the kept thought')
  assert.equal(ran.since, undefined)
  const devices = read('central/devices/pageDevices.ts')
  assert.match(devices, /request: \{kind: 'flow-thoughts' as const, flow_ref: flowRef, limit: 1\}/)
  assert.match(devices, /\{op: 'flow_changed_since' as const, thought: last\.thought\}/)
})

// ------------------------------------------------------------------------------------------------------------------ 5. Settings

test('7 · Machines offer Workcell\'s own control operations once its list answers (REAL, Workcell#118)', async () => {
  const call = async op => (op.op === 'workcell_read' && op.request.kind === 'machine-list' ? {outcome: {result: 'owner_route_reading', route: 'workcell machine list', data: MACHINES.list}} : {error: 'unexpected'})
  const machines = config.nativeRemoteMachines(call, 'workcell:mac')
  assert.deepEqual(machines.allowedOperations, [], 'none before the list answers')
  const declared = await machines.readMachines()
  assert.equal(declared.length, 2)
  assert.deepEqual(machines.allowedOperations, MACHINES.list.control_operations)
  assert.equal(machines.allowedOperations.length, 14)
})

test('8 · Routine authoring on the kernel\'s routine verbs (fake owner only): create, enable and reprove carry AIKit\'s documents verbatim; options and schedule preparation name the AIKit commands that do not exist', async () => {
  const sent = []
  const call = async op => { sent.push(op); return op.request.action === 'enable' ? {error: 'aikit routine enable: a schedule trigger needs unattended authority'}
    : {outcome: {result: 'routine', data: {routine: 'routine/morning', state: op.request.action === 'create' ? 'draft' : 'disabled', note: op.request.action === 'create' ? 'Stored as a Draft; nothing fires.' : ''}}} }
  const authoring = config.nativeRoutineAuthoring(call)
  const proof = {proof_ref: 'proof:1', method: 'method:read-day', method_revision: 'r1'}
  const authority = {authority_ref: 'authority:1', granted: true, unattended: false, action_refs: []}
  const created = await authoring.create({name: 'Morning', description: '', method: 'method:read-day', proof, trigger: {kind: 'manual'}, authority, agent_profile: null, context_scope: []}, 'O-I')
  assert.deepEqual(created, {status: 'acknowledged', message: 'Stored as a Draft; nothing fires.', routine_ref: 'routine/morning'})
  assert.deepEqual(await authoring.enable('routine/morning', authority, 'O-I'), {status: 'refused', message: 'aikit routine enable: a schedule trigger needs unattended authority'}, 'AIKit\'s words')
  assert.deepEqual(await authoring.reprove('routine/morning', proof), {status: 'acknowledged', message: 'routine/morning is disabled.', routine_ref: 'routine/morning'})
  assert.deepEqual(sent, [
    {op: 'routine', project: 'O-I', request: {action: 'create', name: 'Morning', method: 'method:read-day', proof, trigger: {kind: 'manual'}, authority}},
    {op: 'routine', project: 'O-I', request: {action: 'enable', routine_ref: 'routine/morning', authority}},
    {op: 'routine', request: {action: 'reprove', routine_ref: 'routine/morning', proof}}])
  await assert.rejects(authoring.options('method:read-day', 'O-I'), {message: config.ROUTINE_ABSENT.options})
  await assert.rejects(authoring.prepareSchedule({kind: 'daily', time: '07:30'}), {message: config.ROUTINE_ABSENT.prepareSchedule})
  assert.match(config.ROUTINE_ABSENT.options, /missing op: an AIKit command listing a method's verified runs/)
  assert.match(read('native/configuration.ts'), /routineAuthoring: nativeRoutineAuthoring\(call\)/)
})

// ------------------------------------------------------------------------------------------------------------------ drawn, classified

test('9 · Custody and the Agent draw on these bindings in all their views — no NaN, no undefined, never their fixture text — and (b) classifies each key they read', () => {
  bind.resetHolds()
  host.resetHost()
  const custodyBinding = custody(custodyRead({listing: answered(listingWith(RECORD))}), recorder('assign').port)
  const TURN = {...KEPT.turn.data, turn: {schema: 'aikit.turn-bound/v1'}, blocks: [{event: 'UserPromptSubmit', title: 'Standing guidance', standing: 4, kept: 2, withheld: 1, suppressed: false}],
    withheld_lines: 12, withheld_blocks: 1, notices: []}
  const agentBinding = bind.agentBinding(bind.AGENT_DESIGN, {sessionRef: 's', track: null, nowUnixMs: 1, reading: model.INITIAL_READING, accepted: {}, harness: {binding: 'cursor', resolved: false},
    holds: bind.chainHolds(), context: {pressure: answered(null), commands: answered(null), turn: answered(TURN)}}, {}, async () => ({kind: 'refused', reason: 'x'}), () => false)
  for (const [design, binding, fixture] of [[custodyDesign, custodyBinding, /flint-ql-20261014|Archetypal-Earth|Type-check the three/], [agentDesign, agentBinding, /Flint|47 \/ 60|Critical: standing guidance/]]) {
    for (const [view, markup] of hosted(design, binding)) {
      assert.match(markup, new RegExp(`data-device-view="${view}"`), `${design.id} ${view} draws`)
      assert.doesNotMatch(markup, /\bNaN\b|undefined/, `${design.id} ${view}: no absent key drawn as text`)
      assert.doesNotMatch(markup, /data-device-fault/, `${design.id} ${view}: its own view drew`)
      assert.doesNotMatch(markup, fixture, `${design.id} ${view}: its fixture never stands in`)
    }
  }
  for (const key of ['held', 'autonomy', 'gate', 'escalate']) assert.ok(classify(custodyBinding, key), `custody ${key}`)
  for (const key of designKeys(custodyDesign)) if (key !== 'writeMode') assert.ok(classify(custodyBinding, key), `custody ${key}`)
  assert.equal(classify(agentBinding, 'ctx.turn'), 'reading')
  bind.resetHolds()
  host.resetHost()
})

test('10 · Changed since on the Flow\'s kept thought, with no run here: the press asks flow_changed_since on the kept record (fake hand); with none kept, it says so', async () => {
  const pageDevices = await import('../src/central/devices/pageDevices.ts')
  const bindings = await import('../src/central/devices/pageBindings.ts')
  const reached = pageDevices.reachedPageOf({key: 'flow:t', paneId: 'pane-flow', form: 'Flow', title: 'T', revision: 'r', state: 'as read', location: null, dirty: false, save: () => {}, reread: () => {}}, null)
  const RECORD_T = {flow_ref: 'f', invocation_ref: 'inv:1', tensions: [], candidates: [], human_source_proposals: [], flow_mutations: []}
  const asked = []
  const hand = {preflight: async () => {}, contemplate: async () => {}, since: async thought => { asked.push(thought) }}
  const keptData = {version: 'aikit.flow-thoughts/v1', flow: 'f', thoughts: [{recorded_at_unix_ms: 1, thought: RECORD_T}], unreadable: []}
  const binding = bindings.flowBinding('central:flow-document', reached, null, [], null, {state: {flowRef: 'f', kept: {status: 'answered', value: keptData}}, hand})
  await binding.write([{key: 'sinceRead', value: true}])
  assert.deepEqual(asked, [RECORD_T], 'the kept FlowThoughtRecord, as AIKit kept it')
  const none = bindings.flowBinding('central:flow-document', reached, null, [], null, {state: {flowRef: 'f', kept: {status: 'answered', value: KEPT.thoughts.data}}, hand})
  assert.equal(none.values.thought, 'null')
  await assert.rejects(none.write([{key: 'sinceRead', value: true}]), /AIKit keeps no thought for this Flow \(it keeps one only when a host executor runs a contemplation\)/)
  const refusedKept = bindings.flowBinding('central:flow-document', reached, null, [], null, {state: {flowRef: 'f', kept: {status: 'refused', error: KEPT.thoughts_installed_refusal.trim()}}, hand})
  assert.match(refusedKept.standing.thought.disabled, /unrecognized subcommand 'thoughts'/, 'the installed AIKit\'s own refusal')
})
