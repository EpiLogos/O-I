// Lane W3-bindings, Factory: Factory's devices on the kernel's routes to the owners' own commands (desktop/cradle/kernel/src/owner_routes.rs,
// commits 1dc4b6821 and a28843087; T-COVERAGE §1.2). Messages' Send and a drop onto a track write through `aikit gateway send|delegate`;
// the Seat's Join and Release through the seat instrument on the desk's actor; the Remote carrier reads each connection's record; the
// Skillset rack's member records Trust; the Frames monitor reads AIKit's own gateway journal. Where an owner command does not carry a
// field — the Ledger's usage, the Agent's run readings, the Experiment, Custody, the Decision helper, Export — the refusal names exactly
// what is missing.
//
// Channels:
// - REAL (read-only captures): `workcell connections show omarchy --json` (desktop/cradle/kernel/tests/fixtures/owner-routes/
//   workcell-connections-2026-10-21.json), `actuation usage - --json` (…/actuation-usage-2026-10-21.json), `seat status --json`
//   (tests/fixtures/workcell-readings-2026-10-16.json), `aikit gateway who` (tests/fixtures/workcell-readings-2026-10-21.json).
// - FAKE owners: every write goes to a fake kernel transport (a `bridge` whose fetch records the op and answers in the owner's own shape),
//   or to a port that records it — never to the real machine. The seat instrument, AIKit's gateway and its store are never run. The gateway
//   journal's answers are fakes in the gateway's real GatewayReplay and GatewayEcology shapes (kernel/tests/shell_owner_routes.rs).
// - SCRIPTED: the catalogue designs rendered through the runtime's host (deviceHost.HostedDevice) to static markup.
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
const model = await import('../src/agent/devices/agentChainDevices.ts')
const bind = await import('../src/agent/devices/designBindings.ts')
const routes = await import('../src/agent/devices/ownerRoutes.ts')
const msg = await import('../src/agent/devices/messagesBinding.ts')
const conv = await import('../src/agent/devices/useConversationAnswer.ts')
const rec = await import('../src/agent/devices/receiptBindings.ts')
const main = await import('../src/agent/devices/mainTrackBindings.ts')
const session = await import('../src/agent/devices/sessionChainBindings.ts')
const helper = await import('../src/agent/devices/decisionHelperBinding.ts')
const cell = await import('../src/agent/devices/workcellBindings.ts')
const {design: messagesDesign} = await import('../src/inhabitants/catalogue/panels/ai-kit__messages.tsx')
const {design: seatDesign} = await import('../src/inhabitants/catalogue/panels/workcell__seat.tsx')
const {design: carrierDesign} = await import('../src/inhabitants/catalogue/panels/workcell__remote-carrier.tsx')
const {design: framesDesign} = await import('../src/inhabitants/catalogue/panels/actuation__frames-monitor.tsx')
const {design: experimentDesign} = await import('../src/inhabitants/catalogue/panels/actuation__experiment.tsx')
const {design: custodyDesign} = await import('../src/inhabitants/catalogue/panels/software-factory__agent-custody.tsx')
const {design: ledgerDesign} = await import('../src/inhabitants/catalogue/panels/software-factory__ledger.tsx')
const {design: helperDesign} = await import('../src/inhabitants/catalogue/panels/ai-kit__decision-helper.tsx')
const {design: memberDesign} = await import('../src/inhabitants/catalogue/panels/member.tsx')

family.resetFamilyManifestsForTest()
loadAgentShellFamilies()

const json = path => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'))
const OWNER_ROUTES = '../../../../desktop/cradle/kernel/tests/fixtures/owner-routes/'
const CONNECTIONS = json(`${OWNER_ROUTES}workcell-connections-2026-10-21.json`)
const USAGE = json(`${OWNER_ROUTES}actuation-usage-2026-10-21.json`)
const READ16 = json('./fixtures/workcell-readings-2026-10-16.json')
const READ21 = json('./fixtures/workcell-readings-2026-10-21.json')
const read = path => readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8')
const answered = value => ({status: 'answered', value, error: null})
const escaped = text => text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const hosted = (designed, binding) => host.viewsOf(designed).map(view => [view, renderToStaticMarkup(createElement(host.HostedDevice, {designed, binding, view, nav: {}}))])
const designKeys = design => [...new Set([...Object.keys(design.defaults), ...Object.values(design.fixtures ?? {}).flatMap(fixture => Object.keys(fixture))])]
const classify = (binding, key) => binding.local && key in binding.local ? 'local' : key in binding.values ? 'reading' : binding.standing?.[key]?.disabled ? 'absent' : null
const ANSWERED = {gatewayAdmitted: true, gatewayDoc: {state: 'ready'}}
const GUARDIAN = 'central:position:project:O-I:central-guardian'

/** A fake kernel transport: a bridge whose fetch records each op and answers what `answer(op)` gives ({outcome} or {error}). */
function fakeKernel(answer) {
  const ops = []
  const was = globalThis.fetch
  globalThis.fetch = async (url, init) => {
    const op = JSON.parse(init.body)
    ops.push(op)
    const said = answer(op)
    return {json: async () => ('error' in said ? {ok: false, error: said.error} : {ok: true, outcome: said.outcome})}
  }
  return {transport: {kind: 'bridge', url: 'http://fake-kernel.test'}, ops, restore: () => { globalThis.fetch = was }}
}
const routeReading = (route, data) => ({outcome: {result: 'owner_route_reading', route, data, warnings: [], receipts: [{seq: 1, event: 'owner_changed'}]}})
const envelope = message => JSON.stringify({kind: 'owner-refused-or-failed', message, operation_may_have_run: false})

test('the owner routes: a write through kernelOp carries the owner\'s request verbatim and answers its reading; a refusal is the owner\'s words, never the envelope', async () => {
  const kernel = fakeKernel(op => (op.request.to === 'nobody' ? {error: envelope('aikit gateway send: no Position named nobody')}
    : routeReading('aikit gateway send', {communique: {schema: 'aikit.communique/v1', communique_ref: 'communique:1'}})))
  try {
    const answer = await routes.ownerRouteWrite(kernel.transport, routes.gatewayWriteOp({kind: 'send', project: 'O-I', to: GUARDIAN, body: 'hello'}), routes.ROUTE_WORDS.send)
    assert.deepEqual(kernel.ops[0], {op: 'gateway_write', request: {kind: 'send', project: 'O-I', to: GUARDIAN, body: 'hello'}})
    assert.equal(answer.route, 'aikit gateway send')
    assert.equal(answer.data.communique.communique_ref, 'communique:1')
    await assert.rejects(() => routes.ownerRouteWrite(kernel.transport, routes.gatewayWriteOp({kind: 'send', to: 'nobody', body: 'x'}), routes.ROUTE_WORDS.send),
      error => error.message === 'aikit gateway send: no Position named nobody', 'the message, not the wire envelope')
  } finally { kernel.restore() }
  await assert.rejects(() => routes.ownerRouteWrite({kind: 'unavailable', reason: 'no kernel here'}, routes.seatWriteOp({kind: 'release', workcell: 'env-1', product: 'o-i', actor: 'a'}), routes.ROUTE_WORDS.release),
    /kernel carrier is unavailable, so `seat release` cannot be asked: no kernel here/)
  assert.throws(() => routes.routeAnswerOf({outcome: {result: 'seat_status_reading'}}, '`seat join`'), /did not answer with its owner's reading/)
  assert.equal(routes.deskActorOf('person:frank'), 'person:frank')
  assert.equal(routes.deskActorOf(null), 'oi-desktop-user', 'the desktop\'s own actor, as files.rs attributes the person\'s writes')
})

test('1 · Messages: Send writes `aikit gateway send` to the open agent\'s Position; a drop onto a track writes `aikit gateway delegate` with the three AIKit takes', async () => {
  bind.resetHolds()
  const sent = []
  const gateway = async request => { sent.push(request); if (request.body === 'refuse me') throw Error('aikit gateway send: the gateway is down'); return {} }
  const conversation = answered(conv.mergeConversations(GUARDIAN, [READ21.conversation]))
  const input = {population: answered(READ21.population), gateway: ANSWERED, conversation, project: 'O-I', holds: bind.chainHolds()}
  const closed = msg.messagesBinding(input, {gateway})
  assert.equal(closed.standing['conv.sent'].disabled, msg.MESSAGES_REFUSE.send, 'no agent open: Send says to open one')
  await assert.rejects(() => closed.write([{key: 'conv.sent', value: 'hello'}]), /open an agent in the list first/)
  closed.local.open(GUARDIAN)
  const open = msg.messagesBinding({...input, holds: bind.chainHolds()}, {gateway})
  assert.equal(open.standing['conv.sent'], undefined, 'an agent of the population is open: Send stands')
  await open.write([{key: 'conv.sent', value: 'Please check the build.'}])
  assert.deepEqual(sent[0], {kind: 'send', project: 'O-I', to: GUARDIAN, body: 'Please check the build.'}, 'AIKit\'s own request: the Position and your words')
  await assert.rejects(() => open.write([{key: 'conv.sent', value: 'refuse me'}]), /the gateway is down/, 'AIKit\'s refusal, in its words')
  await assert.rejects(() => open.write([{key: 'conv.sent', value: '  '}]), /write the message first/)
  // A drop onto a track: the Communique, the work and why; the run where the track names one.
  await open.write([{key: 'delegate', value: JSON.stringify({communique: 'communique:7', work: 'work:dlw/w3', reason: 'Take this on.', run: 'run:4'})}])
  assert.deepEqual(sent.at(-1), {kind: 'delegate', project: 'O-I', communique: 'communique:7', work: 'work:dlw/w3', reason: 'Take this on.', run: 'run:4'})
  const before = sent.length
  await assert.rejects(() => open.write([{key: 'delegate', value: JSON.stringify({communique: 'communique:7', work: 'work:dlw/w3'})}]), /takes the Communique, the work it becomes and why/)
  assert.equal(sent.length, before, 'a drop that names less than AIKit takes is never sent')
  assert.equal(msg.delegationOf('not json'), null)
  // Team: no control of the design writes one; the groups say why they are not read.
  // REPLACED (lane W7): the groups are Central's agent sets; unread, they name the listing they wait for (w7-factory-designs.test.mjs).
  assert.match(open.standing.groups.disabled, /central\.agent-set\.list/)
  assert.match(open.standing['conv.input'].disabled, /steer or queue/)
  assert.ok(!('team' in open.values) && !open.writes('team'), 'no team key: nothing in the design writes a team operation')
  bind.resetHolds()
})

test('2 · the Ledger: Actuation\'s usage reads one model-usage record it is handed, and nothing here holds one, so the tokens and spend name exactly that; turns are never in it', () => {
  // The REAL answer: a model-usage record carries tokens per model message and a cost standing — no turns, no turn budget.
  assert.equal(USAGE.answer.schema, 'actuation.model-usage/v1')
  assert.deepEqual([USAGE.answer.tokens.input, USAGE.answer.tokens.output, USAGE.answer.cost.standing], [11, 8, 'not-reported'])
  assert.doesNotMatch(JSON.stringify(USAGE.answer), /"turns?"|"cap"|turn_budget/, 'a usage record counts no turns')
  const binding = rec.ledgerBinding({ground: null, groundError: null, holds: bind.chainHolds()}, {openSession: () => null})
  for (const key of ['tokensIn', 'tokensOut', 'spend']) {
    assert.equal(binding.values[key], undefined, `${key}: absent`)
    assert.match(binding.standing[key].disabled, /a model-usage record for the receipt's session to hand Actuation's `usage` \(the kernel's actuation_read takes one actuation\.model-usage\/v1 record and reads no store/, key)
  }
  assert.match(binding.standing.used.disabled, /counts a model message's tokens, never turns/)
  assert.match(binding.standing.cap.disabled, /no model-usage record carries one/)
  // No reading the shell holds names a model-usage record (code-reading, over the shell and the cradle client it imports).
  for (const file of ['agent/devices/receiptBindings.ts', 'agent/useAgentMetrics.ts', 'agent/devices/useAgentChainReading.ts']) {
    assert.doesNotMatch(read(file).replace(/\/\/.*|\/\*[\s\S]*?\*\//g, ''), /usage_ref|op: 'actuation_read'/, `${file}: holds no usage record and asks no usage reading`)
  }
})

test('4 · the Experiment: its comparison readings read the records a run made, which nothing here holds; its declaration names comparison.run, which the kernel does not route', async () => {
  bind.resetHolds()
  const binding = main.experimentBinding(bind.chainHolds())
  for (const key of main.EXPERIMENT_WRITES) assert.equal(binding.standing[key].disabled, main.EXPERIMENT_REFUSE, key)
  assert.match(main.EXPERIMENT_REFUSE, /`actuation-research comparison\.run`.*does not route because it runs models/)
  for (const key of ['light', 'state', 'runs', 'earlier']) assert.match(binding.standing[key].disabled, /the run records or the manifest of a comparison run to hand Actuation's comparison readings/, key)
  assert.match(binding.standing.earlier.disabled, /comparison\.held answers the differing constants of the records it is handed/)
  await assert.rejects(() => binding.write([{key: 'question', value: 'x'}]), /comparison\.run/)
})

test('5 · Custody and the Decision helper: Factory\'s custody and unit-decision commands carry none of their settings, and each refusal says what they do carry', () => {
  const custody = session.custodyBinding({sessionRef: 's', autonomy: 'review', agent: {light: 'lit'}}, null)
  assert.match(custody.standing.handBack.disabled, /no owner operation carries it yet — missing op:/)
  for (const key of ['autonomy', 'gate', 'escalate']) assert.match(custody.standing[key].disabled, /missing op:/, key)
  // REPLACED (lane W9): Factory's custody record carries Autonomy, Review gate and Escalate to since Factory PR 288; each names the kernel's
  // CustodyAssign that carries none yet, and the owner's ruling on changing them after assignment (w9-approvals-ledger-sets.test.mjs).
  assert.match(custody.standing.handBack.disabled, /Factory's custody assign and update \(factory_owner\) carry a Position, its work, a reason, the custody state — in-progress, blocked, released, completed or handed-off — and a Position to hand off to/)
  for (const key of ['autonomy', 'gate', 'escalate']) assert.match(custody.standing[key].disabled, /`factory development custody assign --/, key)
  assert.match(custody.standing.handBack.disabled, /`factory development custody list` has no kernel route/)
  for (const key of ['held', 'people', 'handBackLit']) assert.match(custody.standing[key].disabled, /no reading reaches it yet — missing op:/, key)
  const decision = helper.decisionHelperBinding({status: null, teamSpace: null, holds: bind.chainHolds()})
  for (const key of ['when', 'deadline']) assert.match(decision.standing[key].disabled, /Factory's attempt decision \(factory_owner attempt-decision-submit and -read\) puts a unit's question to you through Central's receiving field/, key)
})

test('6 · the Seat: Join and Release write the seat instrument through the kernel on the desk\'s actor, from the values set; the Floor names what seat_write lacks', async () => {
  bind.resetHolds()
  const asked = []
  const seat = async request => { asked.push(request); return {schema: 'central.workcell-seat-result/v1', register_written: true} }
  const input = {status: READ16.seatStatus, project: 'O-I', branch: 'dlw/build', workcell: 'env-1', machineRef: 'workcell:mac', actor: 'person:frank', holds: bind.chainHolds()}
  const binding = cell.seatBinding(input, {seat})
  assert.equal(binding.standing.join, undefined, 'a carrier, a reading, a product and a seat: Join stands (the design adds the instrument\'s own refusals)')
  assert.equal(binding.values.machineRef, 'workcell:mac')
  assert.equal(binding.standing.floor.disabled, cell.SEAT_REFUSE.floor)
  assert.match(cell.SEAT_REFUSE.floor, /seat_write carries no `--min-free-gb`/)
  await assert.rejects(() => binding.write([{key: 'floor', value: 10}]), /--min-free-gb/)
  // A held seat, Attach: the standing lane, no branch of yours, no new lane.
  await binding.write([{key: 'join', value: true}])
  assert.deepEqual(asked.at(-1), {kind: 'join', workcell: 'env-1', product: 'o-i', actor: 'person:frank'})
  // New lane, with your lane, your zone (every path on one --region) and the dirt kept on a branch.
  binding.local.joinAs('new-lane'); binding.local.lane('agent/o-i-w3'); binding.local.zone('packages/a, packages/b'); binding.local.keepDirt('recovered/o-i-dirt')
  await cell.seatBinding({...input, holds: bind.chainHolds()}, {seat}).write([{key: 'join', value: true}])
  assert.deepEqual(asked.at(-1), {kind: 'join', workcell: 'env-1', product: 'o-i', actor: 'person:frank', branch: 'agent/o-i-w3', new_lane: true,
    regions: ['packages/a', 'packages/b'], recover_dirt_branch: 'recovered/o-i-dirt'})
  // A free seat: your lane names the branch; --new-lane is for an occupied seat only.
  bind.resetHolds()
  const free = {...input, project: 'ql-mef', holds: bind.chainHolds()}
  cell.seatBinding(free, {seat}).local.lane('agent/ql-w3')
  await cell.seatBinding({...free, holds: bind.chainHolds()}, {seat}).write([{key: 'join', value: true}])
  assert.deepEqual(asked.at(-1), {kind: 'join', workcell: 'env-1', product: 'ql-mef', actor: 'person:frank', branch: 'agent/ql-w3'})
  await cell.seatBinding({...free, holds: bind.chainHolds()}, {seat}).write([{key: 'release', value: true}])
  assert.deepEqual(asked.at(-1), {kind: 'release', workcell: 'env-1', product: 'ql-mef', actor: 'person:frank'})
  // No carrier, or no reading: why, never a write.
  const before = asked.length
  const unread = cell.seatBinding({...input, status: null, holds: bind.chainHolds()}, {seat})
  assert.equal(unread.standing.join.disabled, cell.SEAT_UNREAD)
  await assert.rejects(() => unread.write([{key: 'join', value: true}]), /has not answered/)
  assert.equal(cell.seatBinding({...input, actor: undefined, holds: bind.chainHolds()}, {seat}).standing.release.disabled, cell.SEAT_REFUSE.release)
  assert.equal(asked.length, before)
  // Through the kernel: the op is seat_write, the request the instrument's own.
  const kernel = fakeKernel(() => routeReading('seat release', {schema: 'central.workcell-seat-result/v1', register_written: true}))
  try {
    await routes.ownerRouteWrite(kernel.transport, routes.seatWriteOp(asked.at(-1)), routes.ROUTE_WORDS.release)
    assert.deepEqual(kernel.ops, [{op: 'seat_write', request: {kind: 'release', workcell: 'env-1', product: 'ql-mef', actor: 'person:frank'}}])
  } finally { kernel.restore() }
  bind.resetHolds()
})

test('6 · the Remote carrier: each connection\'s record from `workcell connections show` (REAL) — its grant, credential reference, remote software and since; its detail is no why', () => {
  bind.resetHolds()
  const shows = new Map([['omarchy', {value: CONNECTIONS.show}], ['omarchy-improvement-lanes', {error: 'not found: no connection record named `omarchy-improvement-lanes`'}]])
  assert.deepEqual(cell.connectionLabels(answered(READ16.workcellStatus)), ['omarchy', 'omarchy-improvement-lanes'])
  const binding = cell.carrierBinding(answered(READ16.workcellStatus), bind.chainHolds(), shows)
  const machines = JSON.parse(binding.values.machines)
  assert.deepEqual(machines[0], {id: 'omarchy', name: 'workcell:omarchy', endpoint: '100.92.62.101:7777', protocol: 'workcell.control/v1', state: 'composed', expiresAt: null,
    grant: ['status', 'discover', 'observe', 'inspect'], credRef: 'keychain://workcell-connection/omarchy', software: 'workcell 0.1.0 (174fa1c3133a)', since: 1790237685095})
  assert.equal(machines[1].grant, undefined, 'a record Workcell refused to show adds nothing')
  assert.equal(machines[0].why, undefined, 'the record\'s detail reports software revisions, not why it stands so')
  // REPLACED (lane W10): discover has its route; not handed in here, it says it is not read (w10-workcell-material.test.mjs reads it).
  assert.match(binding.standing.offers.disabled, /`workcell discover` is not read here/)
  // REPLACED (lane W10): the plan has its route; what it lacks is the run's demand, which no reading names.
  assert.match(binding.standing.plan.disabled, /the run's demand for `workcell plan`/)
  assert.match(binding.standing.replan.disabled, /the run's demand for `workcell plan`/)
  assert.deepEqual(cell.connectionFields({connection: {version: 'something else'}}), {})
  bind.resetHolds()
})

test('7 · the member\'s Trust records the review with AIKit (`aikit trust record`) on the chosen capability; Export names the directory the rack cannot name', async () => {
  bind.resetHolds()
  const trusted = []
  const rack = {members: JSON.stringify([{id: 'skill/aikit/wiki-inhabitation', name: 'wiki-inhabitation', form: 'method', rev: 'r6', says: '', rungs: [true, true, false, null, null, null, null, null, null, null]}])}
  const member = bind.memberBinding(bind.MEMBER_DEVICE_ID, rack, 'skill/aikit/wiki-inhabitation', bind.chainHolds(), {trust: async capability => { trusted.push(capability) }})
  assert.equal(member.standing.reviewed, undefined, 'with a carrier, Trust stands')
  await member.write([{key: 'reviewed', value: true}])
  assert.deepEqual(trusted, ['skill/aikit/wiki-inhabitation'])
  const kernel = fakeKernel(() => routeReading('aikit trust record', {capability: 'skill/aikit/wiki-inhabitation', state: 'trusted'}))
  try {
    await routes.ownerRouteWrite(kernel.transport, routes.aikitWriteOp({kind: 'trust-record', project: 'O-I', capability: 'skill/aikit/wiki-inhabitation'}), routes.ROUTE_WORDS.trust)
    assert.deepEqual(kernel.ops, [{op: 'aikit_write', request: {kind: 'trust-record', project: 'O-I', capability: 'skill/aikit/wiki-inhabitation'}}])
  } finally { kernel.restore() }
  assert.equal(bind.memberBinding(bind.MEMBER_DEVICE_ID, rack, 'skill/aikit/wiki-inhabitation', bind.chainHolds()).standing.reviewed.disabled, bind.REFUSED_WRITES[bind.MEMBER_DESIGN].reviewed)
  assert.match(bind.REFUSED_WRITES[bind.RACK_DESIGN].exported, /takes an absolute --out, and the rack has no field naming one/)
  // AIKit's capture and promote: the only design with those controls is ai-kit:capture-skill, which no agent device binds or places yet.
  assert.doesNotMatch(read('agent/devices/FactoryDeviceChain.tsx') + read('agent/devices/AgentRailDevices.tsx'), /capture-skill/)
  bind.resetHolds()
})

// ---- FAKE: the gateway journal's answers in the gateway's real shapes (kernel/tests/shell_owner_routes.rs, GatewayEcology and Replay) ----
const ECOLOGY = {type: 'ecology', ecology: {version: 'aikit.agency-gateway-ecology/v1', gateway_ref: 'agency-gateway/local', authority: 'presence-does-not-imply-authority',
  agencies: [{agency_ref: 'agency/replay', sessions: [{agent_session_ref: 'agent-session/replay', agency_ref: 'agency/replay', actuation_refs: [], harness_ref: 'harness/hermes',
    streams: [{stream_ref: 'actuation-stream/replay', last_sequence: 3, event_count: 3}], surfaces: [], invocation_modes: []}]}]}}
const REPLAY = {type: 'replay', replay: {stream_ref: 'actuation-stream/replay', after_sequence: 0, returned_through: 3, stream_last_sequence: 3, has_more: false,
  events: [{sequence: 1, event: {kind: 'human-message', content: 'Type-check the roots.', surface_ref: 'surface:desk', metadata: {}}},
    {sequence: 2, event: {kind: 'tool-request', content: {tool: 'Bash'}, surface_ref: null, metadata: {}}},
    {sequence: 3, event: {kind: 'model-message', content: 'Two roots pass.', surface_ref: null, metadata: {}}}]}}
/** The installed AIKit does not carry `gateway replay` yet (EpiLogos/ai-kit#540 merged, not installed): its refusal, as the kernel wraps it. */
const NO_REPLAY = envelope('error: unrecognized subcommand \'replay\'')

test('8 · the Frames monitor reads AIKit\'s own gateway journal: each frame\'s sequence, the direction its kind names, the session, its words; the refusal drawn as the reason', () => {
  bind.resetHolds()
  const gateway = {reading: model.INITIAL_READING, harness: {binding: 'hermes', resolved: true}}
  const sessions = main.journalSessions(ECOLOGY)
  assert.deepEqual(sessions, [{session: 'agent-session/replay', harness: 'harness/hermes', streams: [{stream: 'actuation-stream/replay', last: 3, count: 3}]}])
  assert.deepEqual(main.journalAsks(sessions, 'all', 1000), [{session: 'agent-session/replay', stream: 'actuation-stream/replay', after: 0, limit: 1000}])
  assert.deepEqual(main.journalAsks([{session: 's', streams: [{stream: 'x', last: 9000}]}], 's', 5000), [{session: 's', stream: 'x', after: 4904, limit: 4096}], 'the last Keep frames, within AIKit\'s bound')
  assert.deepEqual(main.journalAsks(sessions, 'lead', 1000), [], 'no reading names a lead')
  const journal = {ecology: answered(ECOLOGY), replays: new Map([['actuation-stream/replay', {value: REPLAY}]])}
  const binding = main.framesBinding(gateway, bind.chainHolds(), journal)
  assert.deepEqual(JSON.parse(binding.values.frames), [
    {seq: 1, dir: 'out', kind: 'human-message', session: 'agent-session/replay', note: 'Type-check the roots.'},
    {seq: 2, kind: 'tool-request', session: 'agent-session/replay'},
    {seq: 3, dir: 'in', kind: 'model-message', session: 'agent-session/replay', note: 'Two roots pass.'},
  ], 'a kind that names no direction is given none; content that is not words is no note')
  assert.deepEqual([binding.values.seq, binding.values.ring], [3, 3], 'one Stream: its last sequence and the events its journal holds')
  assert.equal(binding.values.ringCap, undefined)
  assert.match(binding.standing.ringCap.disabled, /declares none/)
  for (const key of ['epoch', 'peers', 'fanOut', 'beatAge', 'running', 'inflight', 'viaLead']) assert.match(binding.standing[key].disabled, /Hermes TUI gateway's own counter/, key)
  assert.match(binding.standing.lead.disabled, /names each session and its harness, not a lead/)
  // Live today: the installed AIKit refuses the replay — its words are the reason; nothing else is drawn as frames.
  const refused = main.framesBinding(gateway, bind.chainHolds(), {ecology: answered(ECOLOGY), replays: new Map([['actuation-stream/replay', {error: NO_REPLAY}]])})
  assert.equal(refused.values.frames, undefined)
  assert.equal(refused.standing.frames.disabled, 'error: unrecognized subcommand \'replay\'')
  const noEcology = main.framesBinding(gateway, bind.chainHolds(), {ecology: {status: 'refused', value: null, error: envelope('connect gateway socket: No such file')}})
  assert.equal(noEcology.standing.frames.disabled, 'connect gateway socket: No such file')
  assert.equal(main.framesBinding(gateway, bind.chainHolds(), {ecology: answered({type: 'ecology', ecology: {agencies: []}})}).values.frames, '[]', 'no Stream in the journal: truly none')
  bind.resetHolds()
})

test('every bound design draws on its binding in all its views — no NaN, no undefined, never its fixture text — each refusal drawn as its reason', () => {
  bind.resetHolds()
  host.resetHost()
  const gateway = {reading: model.INITIAL_READING, harness: {binding: 'hermes', resolved: true}}
  const messages = msg.messagesBinding({population: answered(READ21.population), gateway: ANSWERED, project: 'O-I', holds: bind.chainHolds()}, {gateway: async () => ({})})
  const cases = [
    [messagesDesign, messages, /position:flint|claude-opus|Composing the third scene/, []],
    [seatDesign, cell.seatBinding({status: READ16.seatStatus, project: 'O-I', branch: 'dlw/build', workcell: 'env-1', actor: 'person:frank', holds: bind.chainHolds()}, {seat: async () => ({})}),
      /claude-code:dlw-manual|59f94a3|point-cloud-demo/, [cell.SEAT_REFUSE.floor]],
    [carrierDesign, cell.carrierBinding(answered(READ16.workcellStatus), bind.chainHolds(), new Map([['omarchy', {value: CONNECTIONS.show}]])), /ready-to-carry|private-tailnet|1791417468786/, []],
    [framesDesign, main.framesBinding(gateway, bind.chainHolds(), {ecology: answered(ECOLOGY), replays: new Map([['actuation-stream/replay', {value: REPLAY}]])}), /build-lane|3f9a21c4|Type-check the three/, []],
    [framesDesign, main.framesBinding(gateway, bind.chainHolds(), {ecology: answered(ECOLOGY), replays: new Map([['actuation-stream/replay', {error: NO_REPLAY}]])}), /build-lane|3f9a21c4/, []],
    [experimentDesign, main.experimentBinding(bind.chainHolds()), /deeper loop|S1-CODE-001|build-lane|exp-1014/, [main.EXPERIMENT_REFUSE]],
    [custodyDesign, session.custodyBinding({sessionRef: 's', autonomy: 'review', agent: {light: 'lit'}}, null), /Flint|kite|agent\/anima/, [session.CUSTODY_REFUSE.gate]],
    [ledgerDesign, rec.ledgerBinding({ground: null, groundError: null, holds: bind.chainHolds()}, {openSession: () => null}), /generate fixtures|run:2|128400/, []],
    [helperDesign, helper.decisionHelperBinding({status: null, teamSpace: null, holds: bind.chainHolds()}), /kev-latest|Qwen3\.5|127\.0\.0\.1:8019/, [helper.DECISION_HELPER_REFUSE.when]],
  ]
  for (const [design, binding, fixture, reasons] of cases) {
    const drawn = hosted(design, binding)
    for (const [view, markup] of drawn) {
      assert.match(markup, new RegExp(`data-device-view="${view}"`), `${design.id} ${view} draws`)
      assert.doesNotMatch(markup, /\bNaN\b|undefined/, `${design.id} ${view}: no absent key drawn as text`)
      assert.doesNotMatch(markup, /data-device-fault/, `${design.id} ${view}: its own view drew`)
      assert.doesNotMatch(markup, fixture, `${design.id} ${view}: its fixture never stands in`)
    }
    const all = drawn.map(([, markup]) => markup).join('\n')
    for (const why of reasons) assert.ok(all.includes(escaped(why)), `${design.id}: a refused control says why (${why.slice(0, 60)}…)`)
  }
  const frames = hosted(framesDesign, cases[3][1]).map(([, markup]) => markup).join('\n')
  assert.ok(frames.includes('Two roots pass.') && frames.includes('human-message'), 'the Frames monitor draws the journal\'s frames')
  const carrier = hosted(carrierDesign, cases[2][1]).map(([, markup]) => markup).join('\n')
  assert.ok(carrier.includes('workcell 0.1.0 (174fa1c3133a)') || carrier.includes('omarchy'), 'the carrier draws the real connection')
  bind.resetHolds()
  host.resetHost()
})

test('(b) every key the bound designs read is an owner reading, absent with why (naming the missing operation), or the hand\'s', () => {
  bind.resetHolds()
  // The Gateway answered (its light and terms are the Gateway's own reading, designBindings.ts gatewayValues).
  const gateway = {reading: {...model.INITIAL_READING, gatewayAdmitted: true, gatewayDoc: {state: 'ready', transport: 'ws', connect: true, stall_after_seconds: 90}},
    harness: {binding: 'hermes', resolved: true}}
  const cases = [
    [seatDesign, cell.seatBinding({status: READ16.seatStatus, project: 'O-I', branch: 'dlw/build', workcell: 'env-1', machineRef: 'workcell:mac', actor: 'person:frank', holds: bind.chainHolds()}, {seat: async () => ({})})],
    [carrierDesign, cell.carrierBinding(answered(READ16.workcellStatus), bind.chainHolds(), new Map([['omarchy', {value: CONNECTIONS.show}]]))],
    [framesDesign, main.framesBinding(gateway, bind.chainHolds(), {ecology: answered(ECOLOGY), replays: new Map([['actuation-stream/replay', {value: REPLAY}]])})],
    [framesDesign, main.framesBinding(gateway, bind.chainHolds(), {ecology: answered(ECOLOGY), replays: new Map([['actuation-stream/replay', {error: NO_REPLAY}]])})],
    [experimentDesign, main.experimentBinding(bind.chainHolds())],
  ]
  for (const [design, binding] of cases) {
    for (const key of designKeys(design)) {
      const kind = classify(binding, key)
      assert.ok(kind, `${design.id} ${key}: a reading, absent with why, or the hand's`)
    }
  }
  // The Seat: the instrument's rows and disk and this machine are readings; the choosers and the join's settings the hand's; the session's
  // actor and the Floor absent with what they lack.
  const seat = cases[0][1]
  assert.deepEqual(['seats', 'disk', 'machineRef', 'floor'].map(key => classify(seat, key)), ['reading', 'reading', 'reading', 'reading'], 'the floor is the register\'s, read')
  assert.equal(classify(seat, 'actor'), 'absent')
  for (const key of ['product', 'seat', 'lane', 'joinAs', 'zone', 'keepDirt']) assert.equal(classify(seat, key), 'local', key)
  // The Frames monitor with the journal answered: the frames read; the Hermes counters, the lead and the cap absent; with the replay refused,
  // the frames absent with AIKit's words.
  assert.equal(classify(cases[2][1], 'frames'), 'reading')
  assert.equal(classify(cases[3][1], 'frames'), 'absent')
  for (const key of ['session', 'direction', 'kinds', 'follow', 'pause', 'keep']) assert.equal(classify(cases[2][1], key), 'local', key)
  bind.resetHolds()
})

test('(d) the chain and the rail carry the owner routes where the manual puts the devices: the Seat inside Git / landing and the carrier on a workcell\'s chain with their ports; Messages and Frames on the rail', () => {
  const chain = read('agent/devices/FactoryDeviceChain.tsx')
  assert.match(chain, /seatBinding\(\{status: seats\.status === 'answered' \? seats\.value : null[\s\S]*?actor: deskActor, holds\}, seatPorts\)/, 'Join and Release on the desk\'s actor')
  assert.match(chain, /seat: request => ownerRouteWrite\(transport, seatWriteOp\(request\)/)
  // REPLACED (lane W10): the carrier takes discover's offers and the probe too.
  assert.match(chain, /carrierBinding\(workcellAnswer, holds, shows, \{discover/, 'the carrier with each connection\'s record')
  assert.match(chain, /trust: capability => ownerRouteWrite\(transport, aikitWriteOp\(\{kind: 'trust-record', project: RACK_PROJECT, capability\}\)/)
  assert.match(chain, /slot\.id === 'git' && placed\(SEAT_ID, cells\.seat, seatDesignBinding/, 'the Seat stands inside Git / landing (§19.17)')
  const rail = read('agent/devices/AgentRailDevices.tsx')
  assert.match(rail, /gateway: \(request: GatewayWriteRequest\) => ownerRouteWrite\(transport, gatewayWriteOp\(request\), ROUTE_WORDS\[request\.kind\]\)/, 'Messages\' gateway writes')
  assert.match(rail, /framesBinding\(\{reading, harness: \{binding, resolved\}\}, holds, \{ecology/, 'the Frames monitor on AIKit\'s journal')
  assert.match(rail, /RAIL_AGENT_DEVICE_IDS: readonly string\[\] = \[MESSAGES_ID, GATEWAYS_RACK_ID, AGENCY_GATEWAY_ID, FRAMES_ID, LEDGER_ID, WORKCELL_RACK_ID\]/, 'Messages and the monitors stay on the rail')
  for (const file of ['agent/devices/ownerRoutes.ts', 'agent/devices/workcellReads.ts', 'agent/devices/workcellBindings.ts', 'agent/devices/mainTrackBindings.ts', 'agent/devices/messagesBinding.ts']) {
    assert.doesNotMatch(read(file), /\.defaults\[|\.fixtures|catalogue\/panels\//, `${file}: no design default or fixture`)
    assert.deepEqual(read(file).match(/#[0-9a-fA-F]{3,8}\b/g) ?? [], [], `${file}: shell tokens only`)
  }
})
