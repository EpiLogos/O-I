// R4 (T-REALIGN §3; DLW §16.1, §19.4, §19.12; lock §0.3.5): one Agent and one Scope in every mode. The Agent's design
// (actuation:harness-model) carries Custody, Identity and the Thread as pages of its own values under `custody.*`, `id.*`, `thread.*`
// (design.ts scoped/prefixed, 3679a9ceb); src/agent/devices/oneAgentBinding.ts composes those pages' own bindings onto the Agent's.
// On Central the Agent stands on the Answer's owners (answerBinding.ts centralAgentBinding) and Scope on Context & world's
// (contextWorldBinding.ts centralScopeBinding).
// Channels: FIXTURE owners (the readings below are shaped as the owners report them — the encounter view, the roster, Central's change
// horizon — not captures); SCRIPTED renders of the catalogue's designs on the composed bindings. Not a screen pass.
import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'

const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
const boundary = new URL('packages/expressions-boundary/src/', new URL('../../../../', import.meta.url)).href
// The loader of central-devices-chain.test.mjs (the document forms' `?raw`/.html/.json imports, one React), with the boundary's alias.
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};
import {readFile} from 'node:fs/promises';
const BOUNDARY = ${JSON.stringify(boundary)};
export async function resolve(s, c, n) {
  if (s.startsWith('@epilogos/expressions-boundary/')) return n(BOUNDARY + s.slice('@epilogos/expressions-boundary/'.length) + '.ts', c)
  if (s === 'react' || s.startsWith('react/') || s === 'react-dom/server') return n(s, {...c, parentURL: ${JSON.stringify(import.meta.url)}})
  let r = null
  try { r = await n(s, c) } catch (e) { if (!s.startsWith('.')) throw e }
  if (r) {
    if (r.url.endsWith('.html') || r.url.endsWith('.css')) return {...r, format: 'module'}
    return r
  }
  if (s.endsWith('.js')) { try { return await n(s.slice(0, -3) + '.ts', c) } catch {} }
  for (const x of ['.ts', '.tsx']) { try { return await n(s + x, c) } catch {} }
  for (const x of ['/index.ts', '/index.tsx']) { try { return await n(s + x, c) } catch {} }
  throw new Error('cannot resolve ' + s)
}
export async function load(u, c, n) {
  if (u.endsWith('.css')) return {format: 'module', shortCircuit: true, source: 'export {}'};
  if (u.includes('?raw') || u.includes('.html')) return {format: 'module', shortCircuit: true, source: 'export default ""'};
  if (u.endsWith('.json')) return {format: 'module', shortCircuit: true, source: 'export default ' + await readFile(new URL(u), 'utf8')};
  if (!u.endsWith('.ts') && !u.endsWith('.tsx')) return n(u, c);
  const out = ts.transpileModule(await readFile(new URL(u), 'utf8'), {fileName: new URL(u).pathname,
    compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX}}).outputText;
  return {format: 'module', shortCircuit: true, source: out.split('import.meta.env').join('({BASE_URL: "/"})')};
}`)}`, import.meta.url)

globalThis.document = {getElementById: () => null, createElement: () => ({}), head: {appendChild: () => {}}, documentElement: {}}
const {createElement} = await import('react')
const {renderToStaticMarkup} = await import('react-dom/server')
const one = await import('../src/agent/devices/oneAgentBinding.ts')
const bind = await import('../src/agent/devices/designBindings.ts')
const session = await import('../src/agent/devices/sessionChainBindings.ts')
const thread = await import('../src/agent/devices/threadBinding.ts')
const identity = await import('../src/central/devices/identityBinding.ts')
const answer = await import('../src/central/devices/answerBinding.ts')
const world = await import('../src/central/devices/contextWorldBinding.ts')
const pages = await import('../src/central/devices/pageBindings.ts')
const {design: agentDesign} = await import('../src/inhabitants/catalogue/panels/actuation__harness-model.tsx')
const {design: custodyDesign} = await import('../src/inhabitants/catalogue/panels/software-factory__agent-custody.tsx')
const {design: identityDesign} = await import('../src/inhabitants/catalogue/panels/central__agent-identity.tsx')
const {design: threadDesign} = await import('../src/inhabitants/catalogue/panels/software-factory__thread.tsx')
const {scope: scopeDesign} = await import('../src/inhabitants/catalogue/panels/scope.tsx')

const quiet = run => {
  const said = console.error
  console.error = (first, ...rest) => { if (!String(first).includes('useLayoutEffect does nothing on the server')) said(first, ...rest) }
  try { return run() } finally { console.error = said }
}
const draw = (design, view, binding, page = '') => quiet(() => renderToStaticMarkup(createElement(() => design[view]({
  v: binding.values, owner: binding.values, set: () => {}, nav: {}, page, setPage: () => {}, standing: binding.standing}))))

// ---- the owners, as they report (FIXTURE) ------------------------------------------------------------------------------------
const SESSION = 'agent-session/o-i-chat-1791392815-b898'
const NOW = 1_792_300_000_000
const TRACK = {sessionRef: SESSION, purpose: 'Type-check the three roots', agentRef: 'agent/flint', agentName: 'Flint', agentAccepted: true, spaceRef: 'space:x',
  spaceLabel: null, depth: 0, parentRef: null, group: false, memberRefs: [], tasks: [], needle: {atUnixMs: NOW - 6000, axisStartUnixMs: NOW - 3_600_000, axisEndUnixMs: NOW},
  telemetryOn: false, budget: {used: 3, max: 12}, disclosure: null}
const ENCOUNTER = {reading: {agent_session: SESSION, more: false, draft: {revision: 1, text: ''}, permissions: [], actions: [],
  blocks: [{id: 1, kind: 'user', text: 'Type-check the roots.'}, {id: 2, kind: 'assistant', text: 'Reading the agent context first.'}]}, status: {state: 'Resident'}}
const ROSTER = [{ref: 'agent/flint', name: 'Flint', role: 'builder', revision: 'r3', accepted: true}, {ref: 'agent/nara', name: 'Nara', role: 'nara', accepted: true}]

function factoryAgent() {
  bind.resetHolds(); pages.resetHolds()
  const written = []
  const own = bind.agentBinding('factory:agent', {
    sessionRef: SESSION, track: TRACK, nowUnixMs: NOW,
    reading: {attached: true, budget: {used: 3, cap: 12}, autonomy: 'review', gatewayAdmitted: false, gatewayDoc: null},
    accepted: {effort: 'high'}, harness: {binding: 'claude-code', resolved: true}, holds: bind.chainHolds(),
    thread: thread.threadJson(ENCOUNTER, 'Flint'), models: ['model:claude-sonnet-4.6'], harnesses: ['claude-code'],
  }, {effort: {family: 'actuation', deviceInstance: 'agent', key: 'effort', title: 'Effort', type: 'enumerated', writePath: 'shell.setEffort'}},
  async (row, value) => { written.push([row.key, value]); return {kind: 'fired', note: 'set'} }, () => true)
  const custody = session.custodyBinding({sessionRef: SESSION, autonomy: 'review', agent: own.values}, null)
  const id = identity.identityBinding('factory:agent/identity', {roster: {agents: ROSTER}, extras: new Map(), talkingTo: 'agent/flint', card: null})
  const conversation = thread.threadBinding({selected: SESSION, chainSession: SESSION, tracks: [TRACK], nowUnixMs: NOW, encounter: ENCOUNTER, agent: own.values,
    holds: bind.chainHolds()}, own, {select: () => {}})
  return {own, custody, id, conversation, written, agent: one.composeAgentBinding(own, {custody, identity: id, thread: conversation})}
}

test('the shared keys restate the design\'s: a carried page\'s default absent under its prefix is a key it shares with the Agent', () => {
  const sharedOf = (prefix, design) => Object.keys(design.defaults).filter(key => !(`${prefix}${key}` in agentDesign.defaults)).sort()
  // A shared act key (the Thread's `sent`, the composer's send) has no default to derive it from: the declared list holds it beside them.
  const declared = (page, design) => page.shared.filter(key => key in design.defaults).sort()
  assert.deepEqual(sharedOf('custody.', custodyDesign), declared(one.CUSTODY_PAGE, custodyDesign))
  assert.deepEqual(sharedOf('id.', identityDesign), declared(one.IDENTITY_PAGE, identityDesign))
  assert.deepEqual(sharedOf('thread.', threadDesign), declared(one.THREAD_PAGE, threadDesign))
  assert.deepEqual(one.THREAD_PAGE.shared.filter(key => !(key in threadDesign.defaults)), ['sent'], 'the composer\'s send, the Agent\'s own act')
})

test('the Agent\'s composed binding carries custody.*, id.* and thread.* from their own owners — absent where an owner reports none', () => {
  const {agent} = factoryAgent()
  const v = agent.values
  // The Agent's own readings stand.
  assert.equal(v.light, 'lit', 'the task record says the agent is on the session')
  assert.equal(v.agent, 'Flint')
  assert.equal(v.effort, 'high')
  // Custody: the session's custody word is Custody's (it owns the autonomy both pages show); its gate, contact, held items and hand-back
  // have no owner reading, so nothing stands under custody.* — and each control stands disabled with the op it lacks.
  assert.equal(v.autonomy, 'review')
  assert.deepEqual(Object.keys(v).filter(key => key.startsWith('custody.')), [], 'no custody reading is invented')
  // REPLACED (lane W9): Review gate and Escalate to name what an assignment from here lacks (Factory's record and the kernel carry them).
  // REPLACED (lane W11): Review gate and Escalate to say Factory's custody list is not read here (no custody handed in).
  for (const key of ['custody.gate', 'custody.escalate']) assert.match(agent.standing[key].disabled, /custody list is not read here/, key)
  assert.match(agent.standing['custody.handBack'].disabled, /missing op:/)
  // REPLACED (lane W9): Custody's Autonomy names what an assignment from here lacks (sessionChainBindings.ts custodySetting).
  assert.match(agent.standing.autonomy.disabled, /^Autonomy: set when Factory assigns custody/, 'the shared autonomy carries Custody\'s standing')
  // Identity: the roster and whose card, under id.*; the light is the Agent's.
  assert.equal(v['id.agent'], 'agent/flint')
  assert.match(String(v['id.roster']), /"name":"Flint"/)
  assert.equal(v['id.read'], 'read')
  assert.equal(v['id.light'], undefined, 'a shared key stays the Agent\'s own')
  // Thread: the session's own conversation, its sessions and view, under thread.*.
  assert.equal(v['thread.session'], SESSION)
  assert.match(String(v['thread.thread']), /Reading the agent context first\./)
  assert.equal(v['thread.pin'], false)
  assert.equal(v['thread.light'], undefined)
})

test('a page whose owner the chain does not hand stands absent: no prefix key, no standing of it', () => {
  const {own, custody, conversation} = factoryAgent()
  const agent = one.composeAgentBinding(own, {custody, identity: null, thread: conversation})
  assert.deepEqual(Object.keys(agent.values).filter(key => key.startsWith('id.')), [])
  assert.deepEqual(Object.keys(agent.standing ?? {}).filter(key => key.startsWith('id.')), [])
  assert.ok(!Object.keys(agent.local ?? {}).some(key => key.startsWith('id.')))
})

test('a change goes to the owner of its key: the Agent\'s own row, a carried page\'s refusal in its words, a carried page\'s view hold', async () => {
  const {agent, written} = factoryAgent()
  await agent.write([{key: 'effort', value: 'max'}])
  assert.deepEqual(written, [['effort', 'max']], 'Effort through the Agent\'s own row')
  assert.equal(agent.writes('custody.gate'), true)
  await assert.rejects(() => agent.write([{key: 'custody.gate', value: 'diffs'}]), /^Error: Review gate: set when Factory assigns custody/)
  await assert.rejects(() => agent.write([{key: 'autonomy', value: 'auto'}]), /^Error: Autonomy: set when Factory assigns custody/, 'the shared autonomy is Custody\'s to refuse')
  assert.equal(typeof agent.local['thread.pin'], 'function', 'the Thread page\'s pin is a view hold')
  assert.equal(typeof agent.local['id.agent'], 'function', 'the Identity page\'s choice is a view hold')
  agent.local['id.agent']('agent/nara')
  assert.equal(pages.heldOf('factory:agent/identity').agent, 'agent/nara', 'held under the Identity page\'s own hold')
  assert.equal(agent.writes('thread.retry'), true)
  await assert.rejects(() => agent.write([{key: 'thread.retry', value: true}]), /Retry: no owner operation carries it yet/)
})

test('the Agent\'s design draws its pages on the composed binding: Run, Custody, Identity, and the Thread as its Full', () => {
  const {agent} = factoryAgent()
  const run = draw(agentDesign, 'whole', agent, 'agent')
  assert.match(run, /Flint/)
  const custody = draw(agentDesign, 'whole', agent, 'custody')
  assert.match(custody, /Review gate/)
  assert.doesNotMatch(custody, /NaN|undefined/)
  const card = draw(agentDesign, 'whole', agent, 'identity')
  assert.match(card, /Flint/, 'the roster card is the owner\'s')
  const full = draw(agentDesign, 'full', agent)
  assert.match(full, /Reading the agent context first\./, 'the Full is the session\'s own thread')
  for (const view of ['folded', 'compact', 'widget']) assert.doesNotMatch(draw(agentDesign, view, agent), /NaN|undefined/, view)
})

test('Central\'s Agent stands on the Answer\'s owners: the dialogue binding its light, the roster\'s agent of its role its name, its exchange its thread', async () => {
  pages.resetHolds()
  const sent = []
  const input = {nara: {state: 'bound', session: SESSION}, observed: ENCOUNTER, roster: ROSTER, page: null}
  const own = answer.centralAgentBinding(answer.CENTRAL_AGENT_ID, input, {bind: null, send: async text => { sent.push(text) }})
  assert.equal(own.values.light, 'lit')
  assert.equal(own.values.agent, 'Nara')
  assert.match(String(own.values.thread), /Type-check the roots\./)
  for (const key of ['model', 'harness', 'effort', 'cap', 'used', 'age', 'input', 'heartbeat']) assert.equal(own.values[key], undefined, `${key}: no reading for the dialogue`)
  assert.match(own.standing.effort.disabled, /missing op: kernel:nara_dialogue \{action: configure, session_ref, effort/)
  await own.write([{key: 'sent', value: 'What does the barrier rest on?'}])
  assert.deepEqual(sent, ['What does the barrier rest on?'])
  assert.equal(answer.centralAgentRef(input), 'agent/nara', 'its Identity page reads the agent of the binding\'s role')
  const unbound = answer.centralAgentBinding(answer.CENTRAL_AGENT_ID, {...input, nara: {state: 'unbound', session: null}}, {bind: null, send: null})
  assert.equal(unbound.values.light, 'dark')
  assert.match(unbound.standing.sent.disabled, /not bound/)
  // Composed with its pages, the same design draws on it.
  const agent = one.composeAgentBinding(own, {identity: identity.identityBinding('central:agent-identity', {roster: {agents: ROSTER}, extras: new Map(), talkingTo: 'agent/nara', card: null})})
  assert.equal(agent.values['id.agent'], 'agent/nara')
  assert.match(draw(agentDesign, 'widget', agent), /Nara/)
})

test('Scope on Central carries Context & world\'s readings in Scope\'s keys; the Reach, the write mode and Knowledge refused with the ops they lack', async () => {
  pages.resetHolds()
  const input = {answer: {bound: true, session: SESSION}, document: 'Flow · mercurius', packet: {items: 2, session: SESSION},
    horizon: {state: 'ready', data: {world_ref: 'control:root', sources: [{binding: {agent_retrieval_allowed: true}}, {binding: {agent_retrieval_allowed: false}}],
      changes: [{change_ref: 'change-7', cursor: 7, kind: 'modified', source_path: 'Control/user/flows/mercurius.html', agent_session_ref: SESSION, actor: 'agent/nara',
        observed_at_unix_seconds: 1_792_299_000, before_revision: 'fnv:aaaaaaaa11', after_revision: 'fnv:bbbbbbbb22'}]}}}
  const scope = world.centralScopeBinding(world.CENTRAL_SCOPE_ID, input)
  const context = world.contextWorldValues('central:context-world', input)
  assert.equal(scope.values.light, 'lit')
  assert.equal(scope.values.reads, context.reads, 'the same places Context & world read')
  assert.equal(scope.values.receipts, context.receipts, 'the session\'s receipts')
  const places = JSON.parse(String(scope.values.reads))
  assert.deepEqual(places.map(place => [place.id, place.ring]), [['packet', 0], ['world', 3]])
  for (const key of ['reach', 'writeMode', 'knowledge', 'writes', 'basis']) assert.equal(scope.values[key], undefined, `${key}: no owner reports it`)
  for (const key of ['reach', 'writeMode', 'knowledge']) assert.match(scope.standing[key].disabled, /no owner operation carries it yet — missing op:/, key)
  await assert.rejects(() => scope.write([{key: 'writeMode', value: 'draft'}]), /Write mode: no owner operation/)
  scope.local.reachPending(2)
  assert.equal(world.centralScopeBinding(world.CENTRAL_SCOPE_ID, input).values.reachPending, 2, 'a raised reach waits for Confirm, held')
  const compact = draw(scopeDesign, 'compact', scope)
  assert.doesNotMatch(compact, /NaN|undefined/)
  const unbound = world.centralScopeBinding(world.CENTRAL_SCOPE_ID, {...input, answer: {bound: false, session: null}})
  assert.equal(unbound.values.light, 'dark')
  assert.equal(unbound.values.reads, undefined)
})
