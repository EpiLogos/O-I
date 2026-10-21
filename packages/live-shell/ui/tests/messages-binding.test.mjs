// Lane W1-Factory: Messages on its owners (src/agent/devices/messagesBinding.ts, useConversationAnswer.ts; ai-kit:messages, DLW §19.24 —
// "Kind: instrument · Rail: born on the widget rail, and opens full in a pane, in every mode"): your agents from AIKit's population, the
// open agent's conversation from the Gateway journal, the Agency gateway's mark in its head (§19.10), and every write no kernel op carries
// disabled with its command — Make and Accept naming the kernel route that carries the person's authority (T-COVERAGE §1.1).
//
// Channels:
// - REAL (tests/fixtures/workcell-readings-2026-10-21.json): `aikit gateway who --project-world project:O-I --json` and one `aikit gateway
//   conversation` (central-guardian with oi-root-agency), read on workcell:mac on 21 Oct, read-only.
// - FIXTURE: the Agency gateway's answers to harness_agent_read (answered; unreachable in its owner's 16 Oct words).
// - SCRIPTED: the catalogue design rendered through the runtime's host (deviceHost.HostedDevice) to static markup.
// No owner state is written: every write here is refused by the binding before any port is reached.
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
const {designKey} = await import('../src/frame/devices/designs.ts')
const host = await import('../src/frame/devices/deviceHost.tsx')
const model = await import('../src/agent/devices/agentChainDevices.ts')
const bind = await import('../src/agent/devices/designBindings.ts')
const msg = await import('../src/agent/devices/messagesBinding.ts')
const conv = await import('../src/agent/devices/useConversationAnswer.ts')
const {design} = await import('../src/inhabitants/catalogue/panels/ai-kit__messages.tsx')

family.resetFamilyManifestsForTest()
loadAgentShellFamilies()

const REAL = JSON.parse(readFileSync(new URL('./fixtures/workcell-readings-2026-10-21.json', import.meta.url), 'utf8'))
const answered = value => ({status: 'answered', value, error: null})
const draw = (binding, view) => renderToStaticMarkup(createElement(host.HostedDevice, {designed: design, binding, view, nav: {}}))
const escaped = text => text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const designKeys = [...new Set([...Object.keys(design.defaults), ...Object.values(design.fixtures ?? {}).flatMap(fixture => Object.keys(fixture))])]
const classify = (binding, key) => binding.local && key in binding.local ? 'local' : key in binding.values ? 'reading' : binding.standing?.[key]?.disabled ? 'absent' : null

// ---- FIXTURE: the Agency gateway's answers (the 16 Oct refusal in its owner's words; mainTrackBindings.ts gatewayAnswer) -----------
const SOCKET = 'connect gateway socket /Users/admin/.aikit/state/gateway.sock: No such file or directory (os error 2); start one with `aikit gateway serve`'
const UNREACHABLE = {gatewayAdmitted: false, gatewayDoc: {refused: true, error: {code: 'cli.gateway_unreachable', message: SOCKET}, message: SOCKET}}
const ANSWERED = {gatewayAdmitted: true, gatewayDoc: {state: 'ready'}}
const GUARDIAN = 'central:position:project:O-I:central-guardian'
const conversation = answered(conv.mergeConversations(GUARDIAN, [REAL.conversation]))

test('Messages is keyed to its design: an instrument born on the rail, with its tile and its Full only', () => {
  const device = msg.messagesDevice()
  assert.equal(designKey(device.family, device.face.id), design.id)
  assert.equal(msg.MESSAGES_DESIGN, design.id)
  assert.equal(design.kind, 'instrument')
  assert.deepEqual(host.viewsOf(design), ['widget', 'full'], 'born on the rail: Widget and Full (§16.3)')
  assert.equal(host.viewIn(design, 'compact'), null, 'never a chain plate')
})

test('your agents from the real population: each Position by its label, what its agent is for, at rest while vacant, where it runs, what waits for it', () => {
  bind.resetHolds()
  const agents = msg.messagesAgents(REAL.population)
  assert.equal(agents.length, REAL.population.positions.length)
  const nara = agents.find(agent => agent.id === 'central:position:control:root:nara')
  assert.equal(nara.name, 'Nara (M4 domain agent)')
  assert.deepEqual(nara.where, {workcell: 'workcell:mac'})
  assert.equal(nara.unread, 4)
  assert.equal(nara.state, undefined, 'occupied: working, waiting or stalled is not reported, so it stands absent')
  const vacant = agents.find(agent => agent.id === 'central:position:control:root:anuttara')
  assert.equal(vacant.state, 'rest', 'vacant: at rest (§19.24 "An agent with nothing running shows at rest")')
  assert.equal(vacant.where, undefined)
  const aletheia = agents.find(agent => agent.id === 'central:position:project:O-I:aletheia-5')
  assert.match(aletheia.for, /^Aletheia, the team lead/, 'the purpose of the agent that occupies it')
  assert.ok(aletheia.for.length <= 160, 'clipped for the row')
  for (const agent of agents) for (const key of ['model', 'pattern', 'last', 'at', 'thread']) assert.equal(agent[key], undefined, `${agent.id} ${key}: no reading`)
  assert.equal(msg.inboxOf(REAL.population), 38, 'the inbox: the Communiques that wait across the Positions')
  assert.equal(msg.messagesAgents({schema: 'x'}), null)
})

test('the Agency gateway\'s mark: Ready when it answered, Refused when it did not, with the inbox; nothing when neither is read', () => {
  bind.resetHolds()
  const at = gateway => JSON.parse(msg.messagesValues({population: answered(REAL.population), gateway, holds: bind.chainHolds()}).gateway)
  assert.deepEqual(at(ANSWERED), {state: 'Ready', waiting: 38})
  assert.deepEqual(at(UNREACHABLE), {state: 'Refused', waiting: 38})
  const unread = msg.messagesBinding({population: {status: 'reading', value: null, error: null}, gateway: model.INITIAL_READING, holds: bind.chainHolds()})
  assert.equal(unread.values.gateway, undefined)
  assert.match(unread.standing.gateway.disabled, /has not answered/)
  assert.equal(unread.values.agents, undefined)
  const refused = msg.messagesBinding({population: {status: 'refused', value: null, error: 'aikit gateway who: the gateway is down'}, gateway: UNREACHABLE, holds: bind.chainHolds()})
  assert.equal(refused.standing.agents.disabled, 'aikit gateway who: the gateway is down', 'the refusal in the owner\'s words')
})

test('the open agent\'s conversation from the Gateway journal: its Communiques as the Thread\'s rows, the agent\'s own under its name, the last line', () => {
  bind.resetHolds()
  assert.deepEqual(msg.positionRefs(REAL.population).length, REAL.population.positions.length)
  const merged = conv.mergeConversations(GUARDIAN, [REAL.conversation, REAL.conversation, {communiques: []}])
  assert.equal(merged.communiques.length, 2, 'a record in two journals is one record')
  assert.deepEqual(merged.communiques.map(record => record.sequence), [18, ...merged.communiques.slice(1).map(record => record.sequence)])
  const binding = msg.messagesBinding({population: answered(REAL.population), gateway: ANSWERED, conversation, holds: bind.chainHolds()})
  assert.equal(JSON.parse(binding.values.agents).find(agent => agent.id === GUARDIAN).thread, undefined, 'no agent open: no conversation laid on it')
  binding.local.open(GUARDIAN)
  const open = JSON.parse(msg.messagesValues({population: answered(REAL.population), gateway: ANSWERED, conversation, holds: bind.chainHolds()}).agents).find(agent => agent.id === GUARDIAN)
  assert.equal(open.thread.length, 2)
  assert.deepEqual(open.thread.map(row => [row.who, row.kind]), [['Central Product Guardian', 'agent'], ['Central Product Guardian', 'agent']], 'what its Position sent is the agent\'s')
  assert.match(open.thread[0].text, /^Packet V verifier finding/)
  assert.ok(open.last && open.thread[1].text.startsWith(open.last.replace(/…$/, '')), 'its last line: the newest record\'s first line')
  // A record another Position sent stands under that Position's name; no row is yours, since no Position stands for you.
  const rows = msg.conversationRows({position_ref: GUARDIAN, communiques: [{body: 'hello', from_position_ref: 'central:position:control:root:nara', to_position_ref: GUARDIAN}]},
    new Map([['central:position:control:root:nara', 'Nara (M4 domain agent)']]))
  assert.deepEqual(rows, [{who: 'Nara (M4 domain agent)', kind: 'text', text: 'hello'}])
  const refused = msg.messagesBinding({population: answered(REAL.population), gateway: ANSWERED, conversation: {status: 'refused', value: null, error: 'aikit gateway conversation: x'}, holds: bind.chainHolds()})
  assert.equal(refused.standing.thread.disabled, 'aikit gateway conversation: x')
  bind.resetHolds()
})

test('(b) every key the design reads is an owner reading, absent with its missing operation named, or a hold of the hand', () => {
  bind.resetHolds()
  const binding = msg.messagesBinding({population: answered(REAL.population), gateway: ANSWERED, conversation, holds: bind.chainHolds()}, {act: async () => ({})})
  const classes = Object.fromEntries(designKeys.map(key => [key, classify(binding, key)]))
  for (const [key, kind] of Object.entries(classes)) assert.ok(kind, `${key}: classified`)
  assert.deepEqual(Object.entries(classes).filter(([, kind]) => kind === 'reading').map(([key]) => key).sort(), ['agents', 'gateway', 'worlds'])
  for (const [key, kind] of Object.entries(classes)) if (kind === 'absent') assert.match(binding.standing[key].disabled, /missing op:/, `${key}: names what it waits for`)
  // Absent: the readings no owner reports, and the conversation's Input and Voice — controls with no value, disabled with the send route.
  assert.deepEqual(Object.entries(classes).filter(([, kind]) => kind === 'absent').map(([key]) => key).sort(),
    ['conv.age', 'conv.input', 'conv.light', 'conv.voice', 'conv.writes', 'groups', 'skillsets', 'types'])
  // The proposal is Central's reading once Make wrote one; Change is the hand's (it takes the card back to its fields).
  for (const key of ['open', 'show', 'order', 'search', 'conv.draft', 'conv.toolRows', 'conv.subagents', 'conv.messages', 'new.for', 'new.type', 'new.world', 'proposal']) assert.equal(classes[key], 'local', key)
  assert.deepEqual(JSON.parse(binding.values.worlds), ['project:O-I', 'control:root'], 'the World refs AIKit\'s population names')
  assert.equal(binding.values['new.world'], 'project:O-I', 'Works in starts on the project\'s world')
  assert.match(binding.standing.groups.disabled, /aikit gateway team/)
})

test('(c) the conversation\'s Input, Voice and session acts refused with what they lack; with no carrier Send, a drop, Make, Accept and Discard say so', async () => {
  bind.resetHolds()
  const binding = msg.messagesBinding({population: answered(REAL.population), gateway: ANSWERED, conversation, holds: bind.chainHolds()})
  // REPLACED (lane W3): Send and a drop onto a track write through AIKit's gateway (w3-factory-bindings.test.mjs); with no carrier they say so.
  for (const [key, op] of [['conv.input', /steer or queue/], ['conv.voice', /dictation into Messages' composer/],
    ['conv.approve', /a session for the Position's conversation/], ['conv.retry', /a session for the Position's conversation/], ['conv.hardStop', /a session/]]) {
    assert.match(binding.standing[key].disabled, op, key)
    assert.equal(binding.writes(key), true)
    await assert.rejects(() => binding.write([{key, value: true}]), op)
  }
  for (const key of ['conv.sent', 'delegate']) {
    assert.equal(binding.standing[key].disabled, msg.MESSAGES_REFUSE.noCarrier, key)
    assert.equal(binding.writes(key), true)
    await assert.rejects(() => binding.write([{key, value: 'hello'}]), /kernel carrier is unavailable/)
  }
  for (const key of ['make', 'accept', 'discard']) {
    assert.equal(binding.standing[key].disabled, msg.MESSAGES_REFUSE.noCarrier, key)
    await assert.rejects(() => binding.write([{key, value: 'Watches the build'}]), /kernel carrier is unavailable/)
  }
  binding.local['new.for']('Watches the build')
  binding.local.order('name')
  const held = msg.messagesValues({population: answered(REAL.population), gateway: ANSWERED, holds: bind.chainHolds()})
  assert.deepEqual([held['new.for'], held.order, held.show], ['Watches the build', 'name', 'both'], 'the card\'s fields and the list\'s settings are the hand\'s, never sent')
  bind.resetHolds()
})

// ---- the person's acts: a stand-in for the kernel's invoke_action that records each act and answers in Central's own shapes ---------
// (agent-profile.express → {allocation, profile, receipt}, ctrl/src/agent_profile_actions.rs express_action; agent-profile.review →
// central.agent-profile-review/v1 {profile, content_digest, accepted}, agent_profile_acceptance.rs review; central.agent-set.propose →
// {record, receipt}, agent_set_actions.rs agent_set_propose). Never the real ground.
function centralStandIn(refuse = {}) {
  const acts = []
  const act = async (action, input) => {
    acts.push([action, input])
    if (refuse[action]) throw Error(refuse[action])
    if (action === 'agent-profile.express') return {allocation: {profile_ref: 'agent-profile:expressed-0e60f096', agent_ref: 'agent:expressed-0e60f096', revision: 'r1', recognition: 'unrecognised'},
      authorship: 'generated-proposal', recognition: 'unrecognised'}
    if (action === 'agent-profile.save') return {receipt: {revision: 'r2'}}
    if (action === 'central.agent-set.propose') return {record: {schema: 'central.agent-set/v1', agent_set_ref: input.ref, revision: 'r1', members: input.members,
      proposal: {origin_action: 'central.agent-set.propose', reason: input.reason}}, recognition: 'unrecognised'}
    return {ok: true}
  }
  return {acts, act}
}
const REVIEW = {status: 'answered', value: {schema: 'central.agent-profile-review/v1', content_digest: 'sha256:9f2c', accepted: false,
  profile: {profile_ref: 'agent-profile:expressed-0e60f096', agent_ref: 'agent:expressed-0e60f096', revision: 'r1', world_ref: 'project:O-I', role: 'build-watcher',
    purpose: 'Watches the O-I build and tells you when a check breaks.', knowledge_source_refs: ['source:project:O-I:.github/workflows'],
    intent_provenance: {intent_expression: 'Watches the build and tells me when it breaks', authorship: 'generated-proposal', recognition: 'unrecognised'}}}}

test('Make, Change, Accept and Discard: Central\'s own acts carried with the person\'s authority, every answer and refusal Central\'s (§19.24, W2)', async () => {
  bind.resetHolds()
  const central = centralStandIn()
  const input = {population: answered(REAL.population), gateway: ANSWERED, project: 'O-I', holds: bind.chainHolds()}
  let binding = msg.messagesBinding(input, {act: central.act, page: () => 'new-agent'})
  assert.equal(binding.standing.make, undefined, 'Make stands while a carrier does')
  assert.equal(binding.standing.accept.disabled, msg.MESSAGES_REFUSE.noProposal)
  // Make: your words verbatim, the world AIKit names, ratified as that world.
  binding.local['new.carries']('central:documentation')
  await binding.write([{key: 'make', value: 'Watches the build and tells me when it breaks'}])
  assert.deepEqual(central.acts[0], ['agent-profile.express', {scope: 'root', world_ref: 'project:O-I', intent_expression: 'Watches the build and tells me when it breaks',
    ratified_world_refs: ['project:O-I'], skill_set_refs: ['central:documentation']}])
  // The card turns to Central's proposal, read back through its review.
  binding = msg.messagesBinding({...input, holds: bind.chainHolds(), review: REVIEW}, {act: central.act, page: () => 'new-agent'})
  assert.deepEqual(JSON.parse(binding.values.proposal), {role: 'build-watcher', purpose: 'Watches the O-I build and tells you when a check breaks.', world: 'project:O-I',
    sources: ['source:project:O-I:.github/workflows'], revision: 'r1'})
  assert.equal(msg.messagesBinding({...input, holds: bind.chainHolds(), review: {status: 'reading'}}, {act: central.act}).standing.accept.disabled,
    'Central has not answered the review of the proposal yet (agent-profile.review).', 'Accept waits for the exact revision and digest')
  // Change: back to the fields; Make saves at the reviewed revision; a changed For is refused in words, never rewritten.
  binding.local.proposal(undefined)
  binding = msg.messagesBinding({...input, holds: bind.chainHolds(), review: REVIEW}, {act: central.act, page: () => 'new-agent'})
  assert.equal(binding.values.proposal, undefined, 'the card stands on its fields again')
  await assert.rejects(() => binding.write([{key: 'make', value: 'Watches the deploys instead'}]), /Change keeps your words as Central received them/)
  binding.local['new.world']('control:root')
  binding = msg.messagesBinding({...input, holds: bind.chainHolds(), review: REVIEW}, {act: central.act, page: () => 'new-agent'})
  await binding.write([{key: 'make', value: 'Watches the build and tells me when it breaks'}])
  const [saved, body] = central.acts.at(-1)
  assert.equal(saved, 'agent-profile.save')
  assert.equal(body.expected_revision, 'r1')
  assert.deepEqual([body.profile.world_ref, body.profile.ratified_world_refs, body.profile.skill_set_refs], ['control:root', ['control:root'], ['central:documentation']])
  // Accept: the exact revision and digest Central reviewed.
  const after = msg.messagesBinding({...input, holds: bind.chainHolds(), review: {...REVIEW, value: {...REVIEW.value, profile: {...REVIEW.value.profile, revision: 'r2'}, content_digest: 'sha256:aa01'}}},
    {act: central.act})
  await after.write([{key: 'accept', value: 'r2'}])
  assert.deepEqual(central.acts.at(-1), ['agent-profile.accept', {scope: 'root', profile_ref: 'agent-profile:expressed-0e60f096', expected_revision: 'r2', expected_content_digest: 'sha256:aa01'}])
  assert.equal(msg.messagesValues({...input, holds: bind.chainHolds(), review: REVIEW}).proposal, undefined, 'accepted: the card lets the proposal go')
  // Discard: remove at its revision; a refusal is Central's own words, and nothing is let go.
  const refusing = centralStandIn({'agent-profile.remove': 'AgentProfile source differs from the reviewed revision'})
  await msg.messagesBinding({...input, holds: bind.chainHolds()}, {act: refusing.act, page: () => 'new-agent'}).write([{key: 'make', value: 'Keeps the ledger'}])
  const held = msg.messagesBinding({...input, holds: bind.chainHolds(), review: REVIEW}, {act: refusing.act})
  await assert.rejects(() => held.write([{key: 'discard', value: 'r1'}]), /AgentProfile source differs from the reviewed revision/)
  assert.deepEqual(refusing.acts.at(-1), ['agent-profile.remove', {scope: 'root', profile_ref: 'agent-profile:expressed-0e60f096', expected_revision: 'r1'}])
  assert.ok(msg.madeOf(bind.viewHolds(bind.chainHolds(), msg.MESSAGES_ID).made), 'refused: the proposal is still held')
  // Kept for the project: scope project, with the shell's project.
  bind.resetHolds()
  const scoped = centralStandIn()
  const card = msg.messagesBinding({...input, holds: bind.chainHolds()}, {act: scoped.act, page: () => 'new-agent'})
  card.local['new.scope']('project')
  await msg.messagesBinding({...input, holds: bind.chainHolds()}, {act: scoped.act, page: () => 'new-agent'}).write([{key: 'make', value: 'Reads the corpus'}])
  assert.deepEqual([scoped.acts[0][1].scope, scoped.acts[0][1].project], ['project', 'O-I'])
  bind.resetHolds()
})

test('a group: central.agent-set.propose with its members\' agents, accepted by saving Central\'s record; its Discard has no person\'s route', async () => {
  bind.resetHolds()
  const central = centralStandIn()
  const input = {population: answered(REAL.population), gateway: ANSWERED, project: 'O-I', holds: bind.chainHolds()}
  const card = msg.messagesBinding(input, {act: central.act, page: () => 'new-group', suffix: () => 'a1b2c3d4'})
  await assert.rejects(() => card.write([{key: 'make', value: 'Guards the product'}]), /a group needs at least one agent/)
  // Members: Positions of the real population, as the agents their Positions name (occupants: slash-form agent refs).
  card.local['new.members']('central:position:project:O-I:central-guardian central:position:project:O-I:factory-guardian')
  await msg.messagesBinding({...input, holds: bind.chainHolds()}, {act: central.act, page: () => 'new-group', suffix: () => 'a1b2c3d4'}).write([{key: 'make', value: 'Guards the product'}])
  assert.deepEqual(central.acts.at(-1), ['central.agent-set.propose', {scope: 'root', ref: 'agent-set:guards-the-product-a1b2c3d4', revision: 'r1',
    members: [{kind: 'agent', agent_ref: 'agent/central-guardian'}, {kind: 'agent', agent_ref: 'agent/factory-guardian'}], reason: 'Guards the product'}])
  const held = msg.messagesBinding({...input, holds: bind.chainHolds()}, {act: central.act})
  assert.deepEqual(JSON.parse(held.values.proposal), {purpose: 'Guards the product', revision: 'r1'}, 'the card turns to Central\'s record')
  assert.equal(held.standing.discard.disabled, msg.MESSAGES_REFUSE.groupDiscard)
  await assert.rejects(() => held.write([{key: 'discard', value: true}]), /central\.agent-set\.remove/)
  await held.write([{key: 'accept', value: 'r1'}])
  const [saved, body] = central.acts.at(-1)
  assert.equal(saved, 'central.agent-set.save')
  assert.deepEqual([body.expected_revision, body.record.agent_set_ref, body.record.members.length], ['r1', 'agent-set:guards-the-product-a1b2c3d4', 2])
  bind.resetHolds()
})

test('the design draws on its binding in its tile and its Full — no NaN, no undefined, never its fixtures — each refusal drawn as why', () => {
  bind.resetHolds()
  host.resetHost()
  const FIXTURE = /Flint|Kite|Cairn|Lilt|Documentation|Builds and checks the shell|Keeps your practice|claude-opus|Sense · Watch/
  const cases = [
    msg.messagesBinding({population: answered(REAL.population), gateway: ANSWERED, conversation, holds: bind.chainHolds()}, {act: async () => ({})}),
    msg.messagesBinding({population: {status: 'refused', value: null, error: 'x'}, gateway: model.INITIAL_READING, holds: bind.chainHolds()}),
  ]
  for (const [index, binding] of cases.entries()) {
    for (const page of ['', 'new-agent', 'new-group']) {
      host.setHostPage(msg.MESSAGES_ID, page)
      for (const view of ['widget', 'full']) {
        const markup = draw(binding, view)
        assert.match(markup, new RegExp(`data-device-view="${view}"`), `${index} ${view}/${page || 'list'} draws`)
        assert.doesNotMatch(markup, /\bNaN\b|undefined/, `${index} ${view}/${page || 'list'}: no absent key drawn as text`)
        assert.doesNotMatch(markup, /data-device-fault/, `${index} ${view}/${page || 'list'}: its own view drew`)
        assert.doesNotMatch(markup, FIXTURE, `${index} ${view}/${page || 'list'}: its fixture never stands in`)
      }
    }
    host.resetHost()
  }
  host.setHostPage(msg.MESSAGES_ID, 'new-agent')
  assert.ok(draw(cases[1], 'full').includes(escaped(msg.MESSAGES_REFUSE.noCarrier)), 'with no carrier, Make says why')
  const card = draw(cases[0], 'full')
  assert.ok(card.includes('project:O-I') && card.includes('control:root'), 'Works in offers the worlds AIKit names')
  host.resetHost()
  const full = draw(cases[0], 'full')
  assert.ok(full.includes('Nara (M4 domain agent)') && full.includes('Agency gateway · Ready') && full.includes('38 waiting'), 'the real agents, and the mark in the head')
  cases[0].local.open(GUARDIAN)
  const opened = msg.messagesBinding({population: answered(REAL.population), gateway: ANSWERED, conversation, holds: bind.chainHolds()})
  const pane = draw(opened, 'full'), tile = draw(opened, 'widget')
  assert.ok(pane.includes('Packet V verifier finding'), 'the open agent\'s conversation fills the pane')
  assert.ok(tile.includes('Packet V'), 'the tile\'s last lines of the conversation you chose')
  assert.match(tile, /aria-label="Message"[^>]*disabled=""/, 'the tile\'s composer stands disabled: no send route')
  // An occupied agent's face in the posture of its session (lane W5): its run, mapped to Messages' words.
  const stalled = msg.messagesBinding({population: answered(REAL.population), gateway: ANSWERED, runs: new Map([['agent/central-guardian', 'stalled']]), holds: bind.chainHolds()})
  assert.match(draw(stalled, 'full'), /class="ms-face" data-state="stalled"/, 'the stalled agent\'s face')
  host.resetHost()
  bind.resetHolds()
})

test('the bindings read no design default or fixture, and write no raw colour', () => {
  for (const file of ['messagesBinding.ts', 'useConversationAnswer.ts']) {
    const source = readFileSync(new URL(`../src/agent/devices/${file}`, import.meta.url), 'utf8')
    assert.doesNotMatch(source, /\.defaults\[|\.fixtures|catalogue\/panels\//, file)
    assert.deepEqual(source.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [], [], file)
  }
})
