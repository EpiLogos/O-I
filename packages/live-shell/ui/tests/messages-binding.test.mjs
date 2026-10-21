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
  const binding = msg.messagesBinding({population: answered(REAL.population), gateway: ANSWERED, conversation, holds: bind.chainHolds()})
  const classes = Object.fromEntries(designKeys.map(key => [key, classify(binding, key)]))
  for (const [key, kind] of Object.entries(classes)) assert.ok(kind, `${key}: classified`)
  assert.deepEqual(Object.entries(classes).filter(([, kind]) => kind === 'reading').map(([key]) => key).sort(), ['agents', 'gateway'])
  for (const [key, kind] of Object.entries(classes)) if (kind === 'absent') assert.match(binding.standing[key].disabled, /missing op:/, `${key}: names what it waits for`)
  // Absent: the readings no owner reports, and the conversation's Input and Voice — controls with no value, disabled with the send route.
  assert.deepEqual(Object.entries(classes).filter(([, kind]) => kind === 'absent').map(([key]) => key).sort(),
    ['conv.age', 'conv.input', 'conv.light', 'conv.voice', 'conv.writes', 'groups', 'proposal', 'skillsets', 'types', 'worlds'])
  for (const key of ['open', 'show', 'order', 'search', 'conv.draft', 'conv.toolRows', 'conv.subagents', 'conv.messages', 'new.for', 'new.type', 'new.world']) assert.equal(classes[key], 'local', key)
  assert.match(binding.standing.groups.disabled, /aikit gateway team/)
})

test('(c) send, delegate and the conversation\'s session acts refused with the AIKit command; Make, Accept and Discard with the authority route', async () => {
  bind.resetHolds()
  const binding = msg.messagesBinding({population: answered(REAL.population), gateway: ANSWERED, conversation, holds: bind.chainHolds()})
  for (const [key, op] of [['conv.sent', /aikit gateway send/], ['delegate', /aikit gateway delegate/], ['conv.input', /aikit gateway send/], ['conv.voice', /aikit gateway send/],
    ['conv.approve', /a session for the Position's conversation/], ['conv.retry', /a session for the Position's conversation/], ['conv.hardStop', /a session/]]) {
    assert.match(binding.standing[key].disabled, op, key)
    assert.equal(binding.writes(key), true)
    await assert.rejects(() => binding.write([{key, value: true}]), op)
  }
  for (const key of ['make', 'accept', 'discard']) {
    assert.match(binding.standing[key].disabled, /the kernel route that carries the person's authority \(T-COVERAGE §1\.1\)/, key)
    await assert.rejects(() => binding.write([{key, value: 'r1'}]), /person's authority/)
  }
  assert.match(binding.standing.make.disabled, /agent-profile\.express/)
  assert.match(binding.standing.accept.disabled, /agent-profile\.accept/)
  binding.local['new.for']('Watches the build')
  binding.local.order('name')
  const held = msg.messagesValues({population: answered(REAL.population), gateway: ANSWERED, holds: bind.chainHolds()})
  assert.deepEqual([held['new.for'], held.order, held.show], ['Watches the build', 'name', 'both'], 'the card\'s fields and the list\'s settings are the hand\'s, never sent')
  bind.resetHolds()
})

test('the design draws on its binding in its tile and its Full — no NaN, no undefined, never its fixtures — each refusal drawn as why', () => {
  bind.resetHolds()
  host.resetHost()
  const FIXTURE = /Flint|Kite|Cairn|Lilt|Documentation|Builds and checks the shell|Keeps your practice|claude-opus|Sense · Watch/
  const cases = [
    msg.messagesBinding({population: answered(REAL.population), gateway: ANSWERED, conversation, holds: bind.chainHolds()}),
    msg.messagesBinding({population: {status: 'refused', value: null, error: 'x'}, gateway: model.INITIAL_READING, holds: bind.chainHolds()}),
  ]
  for (const [index, binding] of cases.entries()) {
    for (const page of ['', 'new-agent']) {
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
  assert.ok(draw(cases[0], 'full').includes(escaped(msg.MESSAGES_REFUSE.make)), 'Make says why it is refused')
  host.resetHost()
  const full = draw(cases[0], 'full')
  assert.ok(full.includes('Nara (M4 domain agent)') && full.includes('Agency gateway · Ready') && full.includes('38 waiting'), 'the real agents, and the mark in the head')
  cases[0].local.open(GUARDIAN)
  const opened = msg.messagesBinding({population: answered(REAL.population), gateway: ANSWERED, conversation, holds: bind.chainHolds()})
  const pane = draw(opened, 'full'), tile = draw(opened, 'widget')
  assert.ok(pane.includes('Packet V verifier finding'), 'the open agent\'s conversation fills the pane')
  assert.ok(tile.includes('Packet V'), 'the tile\'s last lines of the conversation you chose')
  assert.match(tile, /aria-label="Message"[^>]*disabled=""/, 'the tile\'s composer stands disabled: no send route')
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
