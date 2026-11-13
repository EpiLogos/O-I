// W4, three designs that were unbound (T-COVERAGE §1.4), each on its owner, standard (a)–(g):
//   ai-kit:knowledge-route (§19.9)  inside Scope on a session's chain; AIKit's `knowledge status` through the kernel's knowledge op.
//                                   REPLACED (#725): retired as a device of its own in the 22 Oct manual rewrite — it was Scope's Knowledge
//                                   page, and is Sources' now (§19.9); Scope's pages are Reach, Asks and Grants (§19.12), checked on
//                                   Scope's binding. DELETED (#788): the route's own binding, which no device stood on.
//   actuation:voice (§19.21)        the Answer's voice (the kernel op nara_voice, central/devices/answerVoice.ts). REPLACED: Voice is a
//                                   device of its own again (§19.21); the Agent carries it under `speech.` for the answer's face alone
//   widgets:terminal (§17.9)        the Workbench's Terminal surface over the PTY host (desktop/cradle/src/terminal/terminalReadings.ts);
//                                   on the rail and in a pane, never on a chain
// Channels:
// - OWNER-SHAPED: the Answer's voice states (AnswerVoiceState, answerVoice.ts VOICE_OFF and its moves); a terminal reading in the shape
//   the surface publishes (terminalReadings.ts), its folder and command the Workbench's own.
// - SCRIPTED: the catalogue designs drawn through the host; the voice's and the terminal's hands recorded, never sent.
import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'
import {readFileSync} from 'node:fs'
const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};
import {readFile} from 'node:fs/promises';
export async function resolve(s, c, n) {
  if (s === 'react' || s.startsWith('react/')) return n(s, {...c, parentURL: ${JSON.stringify(import.meta.url)}})
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
  return {format: 'module', shortCircuit: true, source: ts.transpileModule(await readFile(new URL(u), 'utf8'), {fileName: new URL(u).pathname,
    compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX}}).outputText};
}`)}`, import.meta.url)

globalThis.document = {getElementById: () => null, createElement: () => ({}), head: {appendChild: () => {}}, documentElement: {}}
const {createElement} = await import('react')
const {renderToStaticMarkup} = await import('react-dom/server')
const family = await import('../src/inhabitants/familyManifest.ts')
const {loadAgentShellFamilies} = await import('../src/inhabitants/loadAgentShellFamilies.ts')
const {designKey} = await import('../src/frame/devices/designs.ts')
const host = await import('../src/frame/devices/deviceHost.tsx')
const door = await import('../src/frame/devices/deviceDoor.ts')
const places = await import('../src/agent/devices/factoryPlaces.ts')
const bind = await import('../src/agent/devices/designBindings.ts')
const chain = await import('../src/agent/devices/sessionChainBindings.ts')
const vb = await import('../src/agent/devices/voiceBinding.ts')
const {VOICE_OFF} = await import('../src/central/devices/answerVoice.ts')
const tb = await import('../src/widgets/terminalBinding.ts')
const terminals = await import('../../../../desktop/cradle/src/terminal/terminalReadings.ts')
const rail = await import('../src/widgets/TerminalRailWidget.tsx')
const registry = await import('../src/shell/widgets.tsx')
const {scope: scopeDesign} = await import('../src/inhabitants/catalogue/panels/scope.tsx')
const {design: voiceDesign} = await import('../src/inhabitants/catalogue/panels/actuation__voice.tsx')
const {design: agentDesign} = await import('../src/inhabitants/catalogue/panels/actuation__harness-model.tsx')
const carry = await import('../src/agent/devices/oneAgentBinding.ts')
const control = await import('../src/agent/harnessAgentControl.ts')
const {chainDeviceId} = await import('../src/agent/devices/agentChainDevices.ts')
const {design: terminalDesign} = await import('../src/inhabitants/catalogue/panels/widgets__terminal.tsx')

family.resetFamilyManifestsForTest()
loadAgentShellFamilies()

const read = path => readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8')
const escaped = text => text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const designKeys = design => [...new Set([...Object.keys(design.defaults), ...Object.values(design.fixtures ?? {}).flatMap(fixture => Object.keys(fixture))])]
const classify = (binding, key) => binding.local && key in binding.local ? 'local' : key in binding.values ? 'reading' : binding.standing?.[key]?.disabled ? 'absent' : null
const VIEWS = ['folded', 'compact', 'whole', 'full', 'widget']
function drawsOn(design, binding, fixture, reasons = []) {
  const drawn = VIEWS.map(view => [view, renderToStaticMarkup(createElement(host.HostedDevice, {designed: design, binding, view, nav: {}}))])
  for (const [view, markup] of drawn) {
    assert.match(markup, new RegExp(`data-device-view="${view}"`), `${design.id} ${view} draws`)
    assert.doesNotMatch(markup, /\bNaN\b|undefined/, `${design.id} ${view}: no absent key drawn as text`)
    assert.doesNotMatch(markup, /data-device-fault/, `${design.id} ${view}: its own view drew`)
    assert.doesNotMatch(markup, fixture, `${design.id} ${view}: its fixture never stands in`)
  }
  const all = drawn.map(([, markup]) => markup).join('\n')
  for (const why of reasons) assert.ok(all.includes(escaped(why)), `${design.id}: drawn as why (${why.slice(0, 80)}…)`)
  return all
}

// ── the Knowledge route ──────────────────────────────────────────────────────────────────────────────────────────────────────────

// DELETED (#788): "REAL — the Knowledge route reads each lens's answer from AIKit's knowledge status" and "the Knowledge route's binding:
// each lens a reading, absent with its reason, or refused by the operation it lacks". The route's own binding (knowledgeRouteBinding.ts)
// stood for no device and nothing the candidate loads named it (candidate-reachable.mjs). It became Scope's Knowledge page (#725), and
// what an agent reads from is Sources' now, before the Agent on the chain (§19.9; §19.12 "What the agent reads from is Sources'"): Scope's
// pages are Reach, Asks and Grants, held by the tests below on Scope's binding.
test('REPLACED — the Knowledge route keeps no binding of its own, and Scope no Knowledge page: its pages are Reach, Asks and Grants (§19.9, §19.12)', async () => {
  const {existsSync} = await import('node:fs')
  assert.equal(existsSync(new URL('../src/agent/devices/knowledgeRouteBinding.ts', import.meta.url)), false, 'the route\'s own binding is gone')
  assert.equal(existsSync(new URL('./fixtures/knowledge-route-2026-10-21.json', import.meta.url)), false, 'and the capture only it read')
  assert.equal(bind.SCOPE_KNOWLEDGE_ABSENT, undefined, 'Scope stands no Knowledge readings')
  const keys = designKeys(scopeDesign)
  for (const key of ['src.wiki', 'src.project', 'src.code', 'searchFirst', 'linkDepth', 'readBudget', 'route', 'readings']) assert.ok(!keys.includes(key), `${key}: no key of Scope's`)
  const pages = renderToStaticMarkup(createElement(host.HostedDevice, {designed: scopeDesign, binding: factoryScope(), view: 'whole', nav: {}}))
  for (const page of ['Reach', 'Asks', 'Grants']) assert.match(pages, new RegExp(`>${page}<`), `the page ${page} stands in the head`)
  assert.doesNotMatch(pages, />Knowledge</, 'no Knowledge page')
})

/** Scope's Asks page (§19.12 Asks; scope.tsx): Tool calls, Before it lands and Calls to other agents; Escalate to, Wait and On no answer. Scope's
 * own (Tool calls, Calls to other agents, Wait, On no answer) and Custody's (Before it lands, Escalate to: sessionChainBindings.ts
 * withCustodyAsks). */
const ASKS_OWN = ['toolCalls', 'calls', 'wait', 'noAnswer']
const ASKS_CUSTODY = ['gate', 'escalate']
const factoryScope = () => bind.scopeBinding(chainDeviceId('world'), bind.chainHolds(), undefined, async () => assert.fail('nothing is written'))
const carriedScope = () => chain.withCustodyAsks(factoryScope(), chain.custodyBinding({sessionRef: null, agent: {}}, null))

test('Scope\'s Asks on Factory\'s Scope: every key of it classified, each setting refused by the operation it lacks, Before it lands and Escalate to Custody\'s', async () => {
  const keys = designKeys(scopeDesign)
  for (const key of [...ASKS_OWN, ...ASKS_CUSTODY]) assert.ok(keys.includes(key), `${key} is a key of Scope's design`)
  const binding = carriedScope()
  for (const key of [...ASKS_OWN, ...ASKS_CUSTODY]) assert.equal(classify(binding, key), 'absent', `${key} stands disabled with why`)
  // REPLACED (round 859): Calls to other agents was a missing op (AIKit's GatewayIngressPolicy decided by a sender's own id or its one
  // default, never by kind). AIKit keeps a rule by sender kind now, between the two (`aikit gateway ingress`, the kernel's
  // harness_ingress_rule); a Scope handed no carrier names it.
  assert.equal(binding.standing.calls.disabled, bind.CALLS_REFUSE.uncarried)
  assert.match(binding.standing.calls.disabled, /^Calls to other agents: no carrier to AIKit's ingress rule for the sender kind agent \(the kernel's harness_ingress_rule\) stands on this chain\.$/)
  // REPLACED (round 860): Wait and On no answer were missing ops (Hermes keeps its own approvals timeout and holds no request). AIKit owns
  // them now: each is the session's own setting (track wait, track no_answer, through the kernel's encounter_session_settings), and AIKit's
  // executor answers a request at its Wait as the person chose. A Scope handed no carrier names it.
  assert.equal(binding.standing.wait.disabled, bind.WAIT_REFUSE.wait)
  assert.equal(binding.standing.noAnswer.disabled, bind.WAIT_REFUSE.noAnswer)
  assert.match(binding.standing.wait.disabled, /^Wait: no carrier to AIKit's Wait on the session's own settings \(the kernel's encounter_session_settings, track wait\) stands on this chain\.$/)
  for (const key of ['wait', 'noAnswer']) assert.doesNotMatch(binding.standing[key].disabled, /missing op|Hermes/, key)
  assert.match(binding.standing.toolCalls.disabled, /^Tool calls: the Gateway's approvals row is not adopted on this chain/)
  // Before it lands and Escalate to are Factory's custody record's (CustodyAssign --review-gate, --escalate-to), in Custody's own words.
  assert.equal(binding.standing.gate.disabled, chain.CUSTODY_REFUSE.gate)
  assert.equal(binding.standing.escalate.disabled, chain.CUSTODY_REFUSE.escalate)
  for (const key of ASKS_OWN) await assert.rejects(binding.write([{key, value: 'x'}]), new RegExp(binding.standing[key].disabled.slice(0, 24).replace(/[()[\]?.*+]/g, '\\$&')), key)
  await assert.rejects(binding.write([{key: 'gate', value: 'diffs'}]), /Review gate: set when Factory assigns custody/)
  for (const key of [...ASKS_OWN, ...ASKS_CUSTODY]) assert.equal(binding.values[key], undefined, `${key}: no reading, never a default`)
})

// AIKit's gateway ecology (`aikit gateway ecology`, workcellReads.ts useGatewayEcology): each session's conversation surfaces, each on a gateway
// binding with its one default and its rules by sender kind (AIKit gateway_runtime.rs GatewayEcologySurface ingress_default, ingress_kinds).
const ECOLOGY = {type: 'ecology', ecology: {agencies: [{agency_ref: 'agency/port', sessions: [
  {agent_session_ref: 'agent-session/kite', streams: [], surfaces: [
    {binding_ref: 'gateway-binding/kite-telegram', ingress_default: 'deny', ingress_kinds: {agent: 'pair'}},
    {binding_ref: 'gateway-binding/kite-slack', ingress_default: 'pair'}]},
  {agent_session_ref: 'agent-session/bo', streams: [], surfaces: [{binding_ref: 'gateway-binding/bo', ingress_default: 'allow', ingress_kinds: {human: 'deny'}}]},
  {agent_session_ref: 'agent-session/quiet', streams: [], surfaces: []},
]}]}}

test('Calls to other agents reads AIKit\'s ingress rule for agents on each gateway binding of the session, and sets it on each through the kernel (§19.12)', async () => {
  // The rule for the sender kind agent where one is set, else the binding's one default: both of kite's bindings ask.
  assert.deepEqual(bind.callsOf(ECOLOGY, 'agent-session/kite'), {bindings: ['gateway-binding/kite-telegram', 'gateway-binding/kite-slack'], decision: 'pair'})
  assert.deepEqual(bind.callsOf(ECOLOGY, 'agent-session/bo'), {bindings: ['gateway-binding/bo'], decision: 'allow'}, 'a rule for people is not a rule for agents')
  assert.deepEqual(bind.callsOf(ECOLOGY, 'agent-session/quiet'), {bindings: []}, 'a session with no conversation on the gateway')
  assert.deepEqual(bind.callsOf(ECOLOGY, 'agent-session/elsewhere'), {bindings: []})
  assert.equal(bind.callsOf({type: 'bindings'}, 'agent-session/kite'), null, 'a reading that is not the ecology is none')
  const mixed = structuredClone(ECOLOGY)
  mixed.ecology.agencies[0].sessions[0].surfaces[1].ingress_default = 'allow'
  assert.deepEqual(bind.callsOf(mixed, 'agent-session/kite'), {bindings: ['gateway-binding/kite-telegram', 'gateway-binding/kite-slack']}, 'bindings that disagree show no one answer')

  const written = []
  const callsWrite = async (bindings, decision) => { written.push([bindings, decision]) }
  const asked = (calls, more = {}) => bind.scopeBinding(chainDeviceId('world'), bind.chainHolds(), undefined, async () => assert.fail('no row is written'), {calls, callsWrite, ...more})
  const scope = asked(bind.callsOf(ECOLOGY, 'agent-session/kite'))
  assert.equal(scope.values.calls, 'pair', 'Ask: a call from another agent waits in Approvals')
  assert.equal(scope.standing.calls, undefined, 'its carrier stands, so it is pressable')
  await scope.write([{key: 'calls', value: 'deny'}])
  assert.deepEqual(written, [[['gateway-binding/kite-telegram', 'gateway-binding/kite-slack'], 'deny']], 'one rule, set on every binding of the session')
  await assert.rejects(scope.write([{key: 'calls', value: 'always'}]), {message: bind.CALLS_REFUSE.decision('always')})
  const quiet = asked({bindings: []})
  assert.equal(quiet.standing.calls.disabled, bind.CALLS_REFUSE.unbound)
  await assert.rejects(quiet.write([{key: 'calls', value: 'allow'}]), {message: bind.CALLS_REFUSE.unbound})
  const unread = asked(null)
  assert.equal(unread.standing.calls.disabled, bind.CALLS_REFUSE.unread)
  assert.equal(unread.values.calls, undefined, 'no reading, never a default')
  await assert.rejects(unread.write([{key: 'calls', value: 'allow'}]), {message: bind.CALLS_REFUSE.unread})
  const refused = asked({refused: 'The gateway is not running.'})
  assert.equal(refused.standing.calls.disabled, bind.CALLS_REFUSE.refused('The gateway is not running.'), 'AIKit\'s refusal, in its words')
  assert.match(refused.standing.calls.disabled, /^Calls to other agents: AIKit's gateway did not answer/)
  assert.equal(written.length, 1, 'a refused press reaches no owner')

  // The carrier: the kernel's harness_ingress_rule, one binding at a time; AIKit's refusal comes back in its words.
  const sent = []
  const invoke = async (_transport, op) => { sent.push(op); return {outcome: {result: 'harness_ingress_outcome', binding: op.binding, document: {type: 'ingress-rule-set', binding_ref: op.binding, kind: op.kind, decision: op.decision}}} }
  const document = await control.harnessIngressRule({kind: 'tauri'}, 'gateway-binding/bo', 'agent', 'pair', invoke)
  assert.deepEqual(sent, [{op: 'harness_ingress_rule', binding: 'gateway-binding/bo', kind: 'agent', decision: 'pair'}])
  assert.equal(document.type, 'ingress-rule-set')
  await control.harnessIngressRule({kind: 'tauri'}, 'gateway-binding/bo', 'agent', null, invoke)
  assert.equal(sent[1].decision, null, 'no decision clears the rule: the binding\'s default decides again')
  await assert.rejects(control.harnessIngressRule({kind: 'tauri'}, 'gateway-binding/x', 'agent', 'deny', async () => ({outcome: null, error: 'gateway-binding/x is not bound on this gateway'})), /gateway-binding\/x is not bound on this gateway/)
  await assert.rejects(control.harnessIngressRule({kind: 'tauri'}, 'gateway-binding/x', 'agent', 'deny', async () => ({outcome: {result: 'action_dispatched', dispatch: {state: 'invoked', owner_operation: 'aikit.gateway.agent', data: {}}}})), /AIKit did not answer the ingress rule/)
  await assert.rejects(control.harnessIngressRule({kind: 'unavailable', reason: 'No kernel carrier here.'}, 'gateway-binding/x', 'agent', 'deny'), /No kernel carrier here/)
})

test('Wait and On no answer are the session\'s own settings in AIKit: read from them and written to them, each refusal in AIKit\'s words (§19.12, round 860)', async () => {
  const written = []
  const write = async change => { written.push(change) }
  const scoped = (waits, more = {}) => bind.scopeBinding(chainDeviceId('world'), bind.chainHolds(), undefined, async () => assert.fail('no row is written'), {waits, ...more})
  // AIKit's reading states the defaults (§19.12: Wait 4 h, On no answer Hold) as the session's own values.
  const scope = scoped({track: {wait: 14400, no_answer: 'hold'}, write})
  assert.equal(scope.values.wait, 14400)
  assert.equal(scope.values.noAnswer, 'hold')
  for (const key of ['wait', 'noAnswer']) assert.equal(scope.standing[key], undefined, `${key}: its carrier stands, so it is pressable`)
  await scope.write([{key: 'wait', value: 3600}])
  await scope.write([{key: 'noAnswer', value: 'deny'}])
  assert.deepEqual(written.splice(0), [{wait: 3600}, {no_answer: 'deny'}], 'each the session\'s own track setting')
  await assert.rejects(scope.write([{key: 'wait', value: 60}]), {message: bind.WAIT_REFUSE.range})
  await assert.rejects(scope.write([{key: 'wait', value: 'soon'}]), {message: bind.WAIT_REFUSE.range})
  await assert.rejects(scope.write([{key: 'noAnswer', value: 'allow'}]), {message: bind.WAIT_REFUSE.noAnswerValue('allow')})
  // Unread, refused, a group's Scope, an AIKit that carries neither, no carrier: each stands dimmed with why, and nothing is written.
  const unread = scoped({track: null, write})
  assert.equal(unread.standing.wait.disabled, bind.WAIT_REFUSE.unread('Wait'))
  assert.equal(unread.values.wait, undefined, 'no reading, never a default')
  const refused = scoped({track: null, why: 'AIKit did not read the session\'s settings: no such session.', write})
  assert.equal(refused.standing.noAnswer.disabled, 'On no answer: AIKit did not read the session\'s settings: no such session.')
  const older = scoped({track: {telemetry: true}, write})
  assert.equal(older.standing.wait.disabled, bind.WAIT_REFUSE.older('Wait'))
  await assert.rejects(older.write([{key: 'wait', value: 3600}]), {message: bind.WAIT_REFUSE.older('Wait')})
  const bare = scoped({track: {wait: 900, no_answer: 'deny'}})
  assert.equal(bare.standing.wait.disabled, bind.WAIT_REFUSE.wait)
  assert.equal(bare.values.wait, 900, 'read, though nothing here sets it')
  assert.deepEqual(written, [], 'a refused press reaches no owner')
})

test('Calls to other agents set on every binding says, when it stops partway, which bindings answer what and what to press next', async () => {
  const set = []
  const one = async (binding, decision) => { if (binding === 'gateway-binding/b') throw Error('gateway-binding/b is not bound on this gateway'); set.push([binding, decision]) }
  await bind.callsOnEvery(['gateway-binding/a'], 'deny', one)
  assert.deepEqual(set.splice(0), [['gateway-binding/a', 'deny']])
  await assert.rejects(bind.callsOnEvery(['gateway-binding/a', 'gateway-binding/b', 'gateway-binding/c'], 'pair', one),
    {message: 'Calls to other agents stopped at gateway-binding/b: gateway-binding/a now asks you, and gateway-binding/b and gateway-binding/c keep the rule they had; gateway-binding/b is not bound on this gateway. Choose Ask again to set the rest.'})
  await assert.rejects(bind.callsOnEvery(['gateway-binding/b'], 'allow', one),
    {message: 'Calls to other agents stopped at gateway-binding/b: nothing changed, and gateway-binding/b keeps the rule it had; gateway-binding/b is not bound on this gateway. Choose Allow again to set it.'})
  assert.deepEqual(set, [['gateway-binding/a', 'pair']])
  // The chain sets each binding through it.
  assert.match(read('agent/devices/FactoryDeviceChain.tsx'), /callsOnEvery\(bindings, decision, \(ruled, said\) => harnessIngressRule\(transport, ruled, 'agent', said\)\)/)
})

test('Scope draws its Asks and Grants pages on its binding in all five views: no NaN, no undefined, never its fixture\'s grants or people, each refusal drawn as why', () => {
  host.resetHost()
  const binding = carriedScope()
  try {
    host.setHostPage(binding.id, 'asks')
    drawsOn(scopeDesign, binding, /flint-o-i|Archetypal-Earth|owner withdrawal/, [bind.REFUSED_WRITES[bind.SCOPE_DESIGN].calls, bind.REFUSED_WRITES[bind.SCOPE_DESIGN].wait])
    host.setHostPage(binding.id, 'grants')
    drawsOn(scopeDesign, binding, /flint-o-i|Archetypal-Earth|quaternal-logic/, [chain.CUSTODY_GRANTS_REFUSE.issue])
  } finally { host.resetHost() }
})

test('the Knowledge route is no device of its own: nothing stands inside Scope or anywhere (§16.1, §19.9, §19.12)', () => {
  // REPLACED (#725): "the Knowledge route stands inside Scope on a session's chain, and nowhere else" — it is no device now: Scope stands in
  // the world slot of a session's chain (§16.2 "Agent, skills rack, scope"), and AIKit admits no knowledge-route face.
  assert.equal(places.INSIDE.world, undefined, 'nothing stands inside Scope')
  assert.equal(places.SLOT_DEVICE.knowledge, undefined, 'no Knowledge route plate')
  assert.equal(places.SLOT_DEVICE.world.design, scopeDesign.id, 'the world slot is Scope')
  assert.ok(!family.familyManifest('ai-kit')?.faces.some(face => face.id === 'knowledge-route'), 'AIKit admits no knowledge-route face')
  for (const place of [{kind: 'main'}, {kind: 'workcell', name: 'env-1'}, {kind: 'session', group: true}, {kind: 'session', group: false}]) assert.ok(!places.chainSlots(place).includes('knowledge'), 'never a slot of its own')
  const view = read('agent/devices/FactoryDeviceChain.tsx')
  assert.doesNotMatch(view, /KNOWLEDGE_ROUTE_ID|knowledgeRouteDevice/, 'the chain places and publishes no Knowledge route')
})

// ── Voice ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

const VOICE_FIXTURE = /I hear you|What stood out|en_US-norman|af_heart|0f3a|240 ms/
const ABSENT_KERNEL = 'Voice needs the desktop\'s own speech on this machine (the kernel op nara_voice: whisper.cpp hears, Kokoro speaks), and no native kernel stands here: the browser stack'

test('Voice reads the Answer\'s voice: Local while it is open, Off while closed, waiting while it opens; Local closed in the voice\'s own words where it cannot open', () => {
  const closed = vb.voiceValues({state: VOICE_OFF, why: null})
  assert.equal(closed['voice.body'], 'off')
  assert.deepEqual(JSON.parse(closed.bodies).map(body => [body.id, body.available]), [['local', true], ['face', false], ['realtime-aligned', false], ['realtime-native', false]])
  assert.equal(closed.reason, vb.NO_TURN)
  assert.equal(vb.voiceValues({state: {...VOICE_OFF, speaks: 'on'}, why: null})['voice.body'], 'local')
  assert.equal(vb.voiceValues({state: {...VOICE_OFF, hears: 'on', voice: 'listening'}, why: null})['voice.body'], 'local')
  const opening = vb.voiceBinding({state: {...VOICE_OFF, speaks: 'on', busy: 'Opening the voice'}, why: null}, async () => {})
  assert.equal(opening.values['voice.body'], undefined, 'not drawn before the owner answers')
  assert.deepEqual(opening.waiting, ['voice.body'])
  const away = vb.voiceValues({state: VOICE_OFF, why: ABSENT_KERNEL})
  assert.deepEqual(JSON.parse(away.bodies)[0], {id: 'local', available: false, why: ABSENT_KERNEL})
  assert.equal(away.reason, ABSENT_KERNEL)
  const refused = vb.voiceValues({state: {...VOICE_OFF, refused: {speaks: 'Native voice is busy'}}, why: null})
  assert.equal(refused.reason, 'Native voice is busy', 'the owner\'s refusal, in its words')
})

test('Voice: every key its design reads is classified; Body writes through the Answer\'s voice; every other control refused by the operation it lacks', async () => {
  const pressed = []
  const binding = vb.voiceBinding({state: VOICE_OFF, why: null}, async (key, value) => { pressed.push([key, value]) })
  const keys = designKeys(voiceDesign)
  const classes = Object.fromEntries(keys.map(key => [key, classify(binding, key)]))
  for (const key of keys) assert.ok(classes[key], `${key} is classified`)
  assert.deepEqual(Object.entries(classes).filter(([, c]) => c === 'reading').map(([k]) => k).sort(), ['bodies', 'reason', 'voice.body'])
  for (const key of Object.keys(vb.VOICE_ABSENT).filter(key => !(key in vb.VOICE_REFUSE))) assert.match(binding.standing[key].disabled, /missing op: /, key)
  for (const key of Object.keys(vb.VOICE_REFUSE)) {
    assert.match(binding.standing[key].disabled, /missing op: /, key)
    await assert.rejects(binding.write([{key, value: 'x'}]), /missing op: /)
  }
  await binding.write([{key: 'voice.body', value: 'local'}])
  await binding.write([{key: 'voice.body', value: 'off'}])
  assert.deepEqual(pressed, [['speaks', 'on'], ['speaks', 'off'], ['hears', 'off']], 'Local opens the voice; Off closes both keys (recorded, never sent)')
  await assert.rejects(binding.write([{key: 'voice.body', value: 'face'}]), /face rig's own body/)
  await assert.rejects(binding.write([{key: 'voice.body', value: 'realtime-aligned'}]), /no live Realtime client/)
  const away = vb.voiceBinding({state: VOICE_OFF, why: ABSENT_KERNEL}, async () => assert.fail('not pressed'))
  assert.equal(away.standing['voice.body'].disabled, ABSENT_KERNEL)
  await assert.rejects(away.write([{key: 'voice.body', value: 'local'}]), /no native kernel stands here/)
})

test('Voice draws on its binding in all five views — no NaN, no undefined, never its fixtures — each refusal drawn as why', () => {
  host.resetHost()
  drawsOn(voiceDesign, vb.voiceBinding({state: VOICE_OFF, why: null}, async () => {}), VOICE_FIXTURE, [vb.NO_TURN])
  drawsOn(voiceDesign, vb.voiceBinding({state: {...VOICE_OFF, speaks: 'on'}, why: null}, async () => {}), VOICE_FIXTURE, [vb.NO_TURN])
  drawsOn(voiceDesign, vb.voiceBinding({state: VOICE_OFF, why: ABSENT_KERNEL}, async () => {}), VOICE_FIXTURE, [ABSENT_KERNEL])
  host.resetHost()
})

// REPLACED (§19.4 "The Voice, Custody, Grants and Context pages leave the Agent"; §19.21 "Kind: effect · Chain: after the Agent"): Voice is a
// device of its own again, and the Agent keeps no Voice page. Was "REPLACED (#725) — Voice is the Agent's Voice page: Actuation admits no
// Voice face, no chain carries one, and the Agent draws the voice's binding under speech.".
test('Voice is a device of its own: the Agent keeps no Voice page, and carries the voice\'s binding under speech. for the answer\'s face alone', () => {
  assert.equal(voiceDesign.id, 'actuation:voice')
  assert.equal(voiceDesign.kind, 'effect')
  assert.match(read('central/devices/CentralDevices.tsx'), /composeAgentBinding\(own, \{custody, identity, thread, voice: voiceDesign\}\)/, 'the Agent carries it')
  // The answer's face reads the voice's Hears, Speaks, what it does now and what it heard, under `speech.` (agent-answer.tsx).
  const voice = vb.voiceBinding({state: VOICE_OFF, why: null}, async () => {})
  const agent = carry.composeAgentBinding({id: 'central:agent', values: {light: 'lit', agent: 'Nara'}}, {voice})
  for (const key of ['hears', 'speaks', 'now', 'heard']) assert.deepEqual(agent.values[`speech.${key}`], voice.values[key], `speech.${key} is the voice's reading`)
  host.resetHost()
  host.setHostPage('central:agent', 'voice')
  try {
    const page = renderToStaticMarkup(createElement(host.HostedDevice, {designed: agentDesign, binding: agent, view: 'whole', nav: {}}))
    assert.doesNotMatch(page, /\bNaN\b|undefined/, 'no absent key drawn as text')
    assert.doesNotMatch(page, VOICE_FIXTURE, 'the voice\'s fixture never stands in')
    assert.doesNotMatch(page, /data-page="voice"/, 'no Voice tab: a held Voice page opens on the face\'s Answer')
    assert.match(page, /data-page="answer"[^>]*aria-selected="true"/)
  } finally { host.resetHost() }
  assert.doesNotMatch(read('agent/devices/voiceBinding.ts'), /\.defaults\[|\.fixtures|catalogue\/panels\//, 'the binding reads no design default or fixture')
})

// ── the Terminal ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────

const TERMINAL_FIXTURE = /git status -sb|Already up to date|port\/bridge-2|rm -i src|desktop {2}docs|npx tsc --noEmit|3812|3\.8k/
function terminalEntry(reading = {}) {
  const hand = {calls: [], fontSize: px => hand.calls.push(['fontSize', px]), scrollback: lines => hand.calls.push(['scrollback', lines]), watch: on => hand.calls.push(['watch', on])}
  return {reading: {id: 'surface-1', title: 'Terminal', cwd: '/Users/admin/Central/Work/O-I', cwdStanding: 'launch-directory', command: null, exited: false, archived: false,
    fontSize: 12, scrollback: 5000, lines: 41, watch: false, attachedAt: 1, ...reading}, hand}
}

test('the surfaces publish what they hold of their PTYs, the newest attached first; a retired surface leaves', () => {
  const seen = []
  const stop = terminals.subscribeTerminals(() => seen.push(terminals.terminalsNow().map(entry => entry.reading.id)))
  const a = terminalEntry({id: 'a', attachedAt: terminals.nextAttachOrder()}), b = terminalEntry({id: 'b', attachedAt: terminals.nextAttachOrder()})
  terminals.publishTerminal(a.reading, a.hand)
  terminals.publishTerminal(b.reading, b.hand)
  assert.deepEqual(terminals.terminalsNow().map(entry => entry.reading.id), ['b', 'a'])
  const same = terminals.terminalsNow()
  assert.equal(terminals.terminalsNow(), same, 'the same array while nothing moves')
  terminals.retireTerminal('b')
  terminals.retireTerminal('a')
  terminals.retireTerminal('a')
  stop()
  assert.deepEqual(seen, [['a'], ['b', 'a'], ['a'], []], 'a retire of what is gone moves nothing')
  // The surface publishes on attach, on its process's end and as its lines move, and retires as it goes (TerminalSurface.tsx).
  const surface = readFileSync(new URL('../../../../desktop/cradle/src/terminal/TerminalSurface.tsx', import.meta.url), 'utf8')
  assert.match(surface, /attachedNow=true;attachedAt=nextAttachOrder\(\);publish\(\)/)
  assert.match(surface, /if\(out\.eof!==exitedNow\|\|/)
  assert.match(surface, /return\(\)=>\{unregister\(\);retireTerminal\(binding\.id\)/)
  assert.match(surface, /term\.options\.disableStdin=watching/, 'Watch holds through a checkpoint\'s pause')
})

// REPLACED (O-I #749): the Terminal read only the newest Workbench terminal, its Follow, the shell shown, the rooms, the provider and
// whether it answers each absent with a missing op. It now shows a room of a session space (AIKit's working-surface bindings, their
// capture through working_surface_read), and the Workbench's terminals stand as rooms of this computer's own provider: checked here on
// that room, the rest in tests/w749-terminal-rooms.test.mjs.
const NO_HANDS = {hold: () => {}, type: async () => {}, keys: async () => {}}
const ownRoom = entry => tb.terminalBinding({rooms: [], locals: [entry], followed: {session: null, words: null}, holds: {}, screen: null, hands: NO_HANDS, native: false})

test('the Terminal: every key its design reads is classified; on a Workbench terminal, Text size, Scrollback and Watch go to the surface that holds the lease; the rest refused in words', async () => {
  const entry = terminalEntry()
  const binding = ownRoom(entry)
  const keys = designKeys(terminalDesign)
  const classes = Object.fromEntries(keys.map(key => [key, classify(binding, key)]))
  for (const key of keys) assert.ok(classes[key], `${key} is classified`)
  assert.deepEqual(binding.values, {rooms: JSON.stringify([{id: 'terminal:surface-1', name: 'This terminal · O-I'}]), follow: true, wrap: true, selected: 'terminal:surface-1',
    provider: 'terminal', answers: true, light: 'lit', folder: '/Users/admin/Central/Work/O-I', command: '', exited: false, fontSize: 12, scrollback: 5000, lines: 41, watch: false})
  binding.local.fontSize(14); binding.local.scrollback(20000); binding.local.watch(true)
  assert.deepEqual(entry.hand.calls, [['fontSize', 14], ['scrollback', 20000], ['watch', true]], 'through the surface (recorded, never sent)')
  for (const key of ['folder', 'command']) await assert.rejects(binding.write([{key, value: 'x'}]), new RegExp(tb.LOCAL_REFUSE[key].slice(0, 20)))
  await assert.rejects(binding.write([{key: 'lines', value: 1}]), /lines is a reading/)
  assert.equal(tb.terminalBinding({rooms: [], locals: [], followed: {session: null, words: null}, holds: {}, screen: null, hands: NO_HANDS, native: false}), null,
    'no room and no terminal: no binding, never a default')
  const ended = ownRoom(terminalEntry({exited: true, command: 'npm test'})).values
  assert.deepEqual([ended.light, ended.exited, ended.command], ['dark', true, 'npm test'])
})

test('the Terminal draws on its binding in all five views — no NaN, no undefined, never its fixture\'s screens; with none running, the rail says where one starts', () => {
  host.resetHost()
  const all = drawsOn(terminalDesign, ownRoom(terminalEntry()), TERMINAL_FIXTURE)
  assert.match(all, /No reading: shell/, 'the screen is not reported: said, not drawn from the design\'s own shells')
  drawsOn(terminalDesign, ownRoom(terminalEntry({exited: true, command: 'npm test'})), TERMINAL_FIXTURE)
  door.publishDevice(tb.TERMINAL_ID, null)
  assert.match(renderToStaticMarkup(createElement(rail.TerminalRailWidget, {close: () => {}})), new RegExp(escaped(tb.NO_TERMINAL).replace(/[()[\]?.*+]/g, '\\$&')))
  door.publishDevice(tb.TERMINAL_ID, {device: tb.terminalDevice(), binding: ownRoom(terminalEntry())})
  try {
    const tile = renderToStaticMarkup(createElement(rail.TerminalRailWidget, {close: () => {}}))
    assert.match(tile, /data-device-size="widget"/)
    assert.match(tile, /data-device-design="widgets:terminal"|data-device-design="generic"/, 'the device\'s widget (the design registers when the rail loads it)')
  } finally { door.publishDevice(tb.TERMINAL_ID, null) }
  host.resetHost()
})

test('the Terminal stands on the rail (its own bare tile) and in a pane, never on a chain (§17.9)', () => {
  const tile = registry.WIDGETS.find(widget => widget.id === 'terminal')
  assert.equal(tile.bare, true, 'the device\'s own tile: no second head')
  assert.equal(terminalDesign.kind, 'instrument')
  assert.equal(tb.terminalDevice().id, terminalDesign.id)
  for (const place of [{kind: 'main'}, {kind: 'workcell', name: 'env-1'}, {kind: 'session', group: false}, {kind: 'session', group: true}]) {
    assert.ok(!places.chainSlots(place).some(slot => places.SLOT_DEVICE[slot].design === terminalDesign.id), 'no chain carries it')
  }
  const publisher = read('widgets/railDevices.tsx')
  assert.match(publisher, /publishDevice\(TERMINAL_ID, terminal \? \{device: terminalInstance, binding: terminal\} : null\)/, 'published by the rail\'s publisher, in every mode, while a terminal runs')
  assert.match(publisher, /useSyncExternalStore\(subscribeTerminals, terminalsNow, terminalsNow\)/)
  assert.doesNotMatch(read('widgets/terminalBinding.ts'), /\.defaults\[|\.fixtures|catalogue\/panels\//, 'the binding reads no design default or fixture')
})

test('§16.14 — none of the three bindings defaults a reading: unread owners leave every key absent', () => {
  bind.resetHolds()
  // DELETED (#788): the Knowledge route's own values — its binding is gone; Scope reports nothing it is not handed (scopeValues, above).
  assert.deepEqual(bind.scopeValues(bind.chainHolds()), {})
  // REPLACED (O-I #749): `terminalValues(null)` was {}; with no room and no terminal the Terminal has no binding at all (above), and a room's
  // screen, provider and answer stand only once read (tests/w749-terminal-rooms.test.mjs).
  assert.deepEqual(tb.terminalValues({rooms: [], locals: [], followed: {session: null, words: null}, holds: {}, screen: null, hands: NO_HANDS, native: false}).values,
    {rooms: '[]', follow: true, wrap: true}, 'only the Terminal\'s own holds')
  const voice = vb.voiceValues({state: VOICE_OFF, why: ABSENT_KERNEL})
  // REPLACED (#804): "the closed voice is a reading (Off); nothing else is filled in" — the voice also reports what it holds, for the answer's
  // face (§19.4: Hears and Speaks, attending while you speak): Hears and Speaks off, quiet, nothing heard. Each is the voice owner's own
  // state (answerVoice.ts VOICE_OFF is what it holds before anything opens: answer-voice.test.mjs "both keys start off"), never a default.
  assert.deepEqual(Object.keys(voice).sort(), ['bodies', 'heard', 'hears', 'now', 'reason', 'speaks', 'voice.body'], 'the closed voice is a reading (Off); nothing else is filled in')
  assert.deepEqual([voice.hears, voice.speaks, voice.now, voice.heard], [VOICE_OFF.hears, VOICE_OFF.speaks, VOICE_OFF.voice, VOICE_OFF.heard], 'each the voice\'s own state')
})
