// Lane K0's second round (T-COVERAGE §1.5; EpiLogos/Actuation#143 and EpiLogos/Workcell#123, merged): the keys bound on the owners' new
// operations, and the refusal each control shows where the installed owner has none.
//   the Ledger's tokensIn, tokensOut and spend      actuation_read {usage-list} of the chosen receipt's session
//   the Agent's model                              the session's last usage record, where the gateway names none
//   Identity's Changed since                       actuation_read {realised-continuity}; absent while the shell holds no two receipts
//   the workcell rack's lease and checkpoints      workcell_read {lease, checkpoints} of the chosen world's receipt
//   the workcell rack's Checkpoint act             workcell_write {checkpoint}, Workcell's unsupported refusal for a host world
//
// Channels:
// - REAL (desktop/cradle/kernel/tests/fixtures/owner-routes/*-2026-10-22.json): the PR binaries' own answers over a scratch store and a
//   scratch world (a stub lifecycle server on loopback for the sandbox world), and the installed binaries' refusals of the new verbs.
// - FAKE, in Central's own shape: a change horizon with one agent's receipt (ctrl source_horizon.rs SourceChange).
// - SCRIPTED: a kernel behind the bridge's fetch recording each op it is sent; the catalogue designs rendered through the runtime's host.
// No owner state is written: every write goes to the scripted kernel.
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
const bind = await import('../src/agent/devices/designBindings.ts')
const receipts = await import('../src/agent/devices/receiptBindings.ts')
const rack = await import('../src/agent/devices/workcellRackBinding.ts')
const routes = await import('../src/agent/devices/ownerRoutes.ts')
const identity = await import('../src/central/devices/identityBinding.ts')
const pageHolds = await import('../src/central/devices/pageBindings.ts')
const {design: rackDesign} = await import('../src/inhabitants/catalogue/panels/workcell__workcell.tsx')

family.resetFamilyManifestsForTest()
loadAgentShellFamilies()

const json = path => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'))
const ACTUATION = json('../../../../desktop/cradle/kernel/tests/fixtures/owner-routes/actuation-usage-list-continuity-2026-10-22.json')
const WORKCELL = json('../../../../desktop/cradle/kernel/tests/fixtures/owner-routes/workcell-lease-checkpoints-2026-10-22.json')
const answered = value => ({status: 'answered', value, error: null})
const refused = error => ({status: 'refused', value: null, error})
/** The kernel's Error envelope for an owner's refusal, as the bridge carries it. */
const refusal = message => JSON.stringify({kind: 'owner-refused-or-failed', message, operation_may_have_run: false})
function kernel(answer) {
  const sent = []
  const fetch = async (_url, init) => {
    const op = JSON.parse(init.body)
    sent.push(op)
    const outcome = answer(op)
    return {json: async () => (outcome && 'error' in outcome ? {ok: false, error: outcome.error} : outcome ? {ok: true, outcome} : {ok: false, error: `the fixture kernel answers no ${op.op}`})}
  }
  return {sent, fetch}
}
async function withKernel(owner, run) {
  const real = globalThis.fetch
  globalThis.fetch = owner.fetch
  try { return await run() } finally { globalThis.fetch = real }
}

// ── the Ledger ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Central's ground with one change an agent made (FAKE, in SourceChange's shape), its session `session:a` (the REAL listing's). */
const GROUND = {sources: {state: 'ready', data: {changes: [{cursor: 41, change_ref: 'change:41', source_path: 'Work/O-I/README.md', kind: 'modified', before_revision: 'r1',
  after_revision: 'r2', observed_at_unix_seconds: 1_792_600_000, actor: 'agent/kite', actor_kind: 'agent', agent_session_ref: 'session:a'}]}}}
const ledger = usage => receipts.ledgerBinding({ground: GROUND, groundError: null, holds: bind.chainHolds(), usage}, {openSession: () => null})

test('Ledger · the chosen receipt\'s session\'s tokens and spend are Actuation\'s sums (REAL listing); none chosen, none read', () => {
  bind.resetHolds()
  const none = ledger(null)
  for (const key of ['tokensIn', 'tokensOut', 'spend']) assert.equal(none.standing[key].disabled, receipts.LEDGER_USAGE_WHY.noReceipt, key)
  bind.holdView(receipts.LEDGER_ID, 'task', 41)
  assert.equal(receipts.ledgerReceiptSession({ground: GROUND, holds: bind.chainHolds()}), 'session:a', 'the session whose usage is read')
  const read = ledger({session: 'session:a', ...answered(ACTUATION.usage_list_session)})
  assert.deepEqual([read.values.tokensIn, read.values.tokensOut, read.values.spend], [30, 3, 0.5])
  for (const key of ['tokensIn', 'tokensOut', 'spend']) assert.equal(read.standing[key], undefined, key)
  // Zero records: "no usage recorded", never 0 tokens as if measured.
  const zero = ledger({session: 'session:a', ...answered(ACTUATION.usage_list_empty)})
  for (const key of ['tokensIn', 'tokensOut', 'spend']) {
    assert.equal(zero.values[key], undefined, `${key}: no reading`)
    assert.equal(zero.standing[key].disabled, receipts.LEDGER_USAGE_WHY.none, key)
  }
  // The installed Actuation (0.2.1) refuses `usage list` in its own words: they stand where the tokens would.
  const words = 'actuation: no JSON input supplied for list: No such file or directory (os error 2)'
  assert.equal(ACTUATION.installed_usage_list.stderr.trim(), words)
  assert.equal(ledger({session: 'session:a', ...refused(words)}).standing.tokensIn.disabled, words)
  // A cost reported only in another currency is named, never converted.
  const euros = structuredClone(ACTUATION.usage_list_session)
  euros.totals.cost = [{currency: 'EUR', amount: 0.4, records: 1, standings: ['provider-reported']}]
  assert.match(ledger({session: 'session:a', ...answered(euros)}).standing.spend.disabled, /reported in EUR only/)
  bind.resetHolds()
})

test('Ledger · the session\'s usage is read through actuation_read {usage-list}, and the Agent\'s model is the session\'s last usage record\'s where the gateway names none', async () => {
  const owner = kernel(op => (op.op === 'actuation_read' ? {result: 'owner_route_reading', route: 'actuation usage list', data: ACTUATION.usage_list_session, warnings: []} : null))
  const call = await withKernel(owner, () => routes.ownerRouteWrite({kind: 'bridge', url: 'http://usage.fixture'}, {op: 'actuation_read', request: {kind: 'usage-list', session: 'session:a'}}, '`actuation usage list`'))
  assert.deepEqual(owner.sent, [{op: 'actuation_read', request: {kind: 'usage-list', session: 'session:a'}}])
  assert.equal(call.data.schema, 'actuation.usage-listing/v1')
  bind.resetHolds()
  const agent = (doc, usage) => bind.agentValues({sessionRef: 'session:a', track: null, nowUnixMs: 0, accepted: {}, harness: {binding: 'claude-code', resolved: false}, holds: bind.chainHolds(),
    reading: {attached: true, budget: null, autonomy: null, gatewayAdmitted: doc !== null, gatewayDoc: doc}, ...(usage ? {usage} : {})})
  assert.equal(agent(null, answered(ACTUATION.usage_list_session)).model, 'claude-fable-5', 'the model the session last reported using')
  assert.equal(agent({model: 'model:claude-opus-4.8'}, answered(ACTUATION.usage_list_session)).model, 'model:claude-opus-4.8', 'the gateway\'s model stands first')
  assert.equal(agent(null, answered(ACTUATION.usage_list_empty)).model, undefined, 'no record, no model')
  assert.equal(bind.lastUsageModelOf({schema: 'other'}), undefined)
})

// ── Identity ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

test('Identity · Changed since stands absent naming that no second receipt exists; given two receipts it is Actuation\'s continuity of them (REAL)', () => {
  pageHolds.resetHolds()
  const input = {roster: null, extras: new Map(), talkingTo: null, card: null}
  const bare = identity.identityBinding(identity.IDENTITY_DESIGN, input)
  assert.equal(bare.values.continuity, undefined)
  assert.equal(bare.standing.continuity.disabled, identity.NO_SECOND_RECEIPT)
  const pair = ACTUATION.realised_continuity
  const both = identity.identityBinding(identity.IDENTITY_DESIGN, {...input, realised: {previous: pair.input.previous, next: pair.input.next, ...answered(pair.answer)}})
  assert.deepEqual(JSON.parse(both.values.continuity), {since: 'realised:direct', body: [{field: 'harness', from: 'harness:claude-code', to: 'harness:codex'}], identity: []})
  assert.equal(both.standing.continuity, undefined)
  const words = ACTUATION.realised_continuity_refusal.stderr.trim()
  assert.equal(identity.identityBinding(identity.IDENTITY_DESIGN, {...input, realised: {previous: pair.input.previous, next: null, ...refused(words)}}).standing.continuity.disabled, words)
})

// ── the workcell rack's lease, checkpoints and Checkpoint ───────────────────────────────────────────────────────────────────────────

const WORLD_REF = WORKCELL.sandbox.lease.world_ref
const RECEIPT = '/tmp/k0-capture/sandbox-world.json'
const CELL = 'workcell:mac'
/** `workcell worlds` listing the one world of this cell (FAKE, in workcell.world-receipts/v1's shape; the capture's world_ref). */
const WORLDS = {schema: 'workcell.world-receipts/v1', worlds: [{receipt: RECEIPT, world_ref: WORLD_REF, workcell_ref: CELL, demand_ref: 'demand:k0-capture', state: 'healthy',
  retention: 'release', persistence: null, subjects: {}, runs: []}], unreadable: []}
const rackInput = over => ({name: 'env-1', project: 'O-I', seats: null, chain: {gateway: null, carrier: {here: CELL}, git: null}, holds: bind.chainHolds(), worlds: answered(WORLDS), ...over})

test('Workcell rack · the world\'s lease is its earliest-ending leased binding\'s, until released where none expires, absent with the provider\'s error where unobserved (REAL)', () => {
  bind.resetHolds()
  const leased = rack.workcellRackBinding(rackInput({lease: answered(WORKCELL.sandbox.lease)}), {gateway: null})
  assert.deepEqual(JSON.parse(leased.values.lease), {expiresAt: Date.parse('2026-10-22T12:00:00Z'), renewable: true})
  assert.equal(leased.standing.lease, undefined)
  const host = rack.workcellRackBinding(rackInput({lease: answered(WORKCELL.host.lease)}), {gateway: null})
  assert.deepEqual(JSON.parse(host.values.lease), {expiresAt: null}, 'a host process holds no lease: it lives until released')
  const unobserved = rack.workcellRackBinding(rackInput({lease: answered(WORKCELL.unreachable.lease)}), {gateway: null})
  assert.equal(unobserved.values.lease, undefined)
  assert.match(unobserved.standing.lease.disabled, /The lease of affordance:shell is not observed: unavailable: connect OpenSandbox HTTP endpoint 127\.0\.0\.1:9/)
  // The installed workcell has no `lease`: its refusal, in its words, where the lease would be.
  const words = routes.refusalWords(JSON.stringify({kind: 'owner-refused-or-failed', message: WORKCELL.installed.lease.stderr.error.message, operation_may_have_run: false}))
  assert.equal(words, 'invalid demand: unknown command `lease`; run `workcell help`')
  assert.equal(rack.workcellRackBinding(rackInput({lease: refused(words)}), {gateway: null}).standing.lease.disabled, words)
  // No world listed for the cell: the lease and the checkpoints say why, and Checkpoint has nothing to act on.
  const none = rack.workcellRackBinding(rackInput({worlds: answered({...WORLDS, worlds: []})}), {gateway: null})
  assert.match(none.standing.checkpoint.disabled, /^Checkpoint: /)
})

test('Workcell rack · the checkpoints are Workcell\'s ledger (REAL); Checkpoint writes workcell_write {checkpoint} on the world\'s receipt, and a host world\'s refusal is Workcell\'s words', async () => {
  bind.resetHolds()
  const kept = rack.workcellRackBinding(rackInput({checkpoints: answered(WORKCELL.sandbox.checkpoints)}), {gateway: null})
  assert.deepEqual(JSON.parse(kept.values.checkpoints), [{ref: 'snap-1', state: 'ready', reusable: true, at: WORKCELL.sandbox.checkpoint.taken_at_unix_ms}])
  assert.deepEqual(JSON.parse(rack.workcellRackBinding(rackInput({checkpoints: answered(WORKCELL.host.checkpoints)}), {gateway: null}).values.checkpoints), [])
  const words = 'invalid demand: unknown command `checkpoints`; run `workcell help`'
  assert.equal(WORKCELL.installed.checkpoints.stderr.error.message, words)
  assert.equal(rack.workcellRackBinding(rackInput({checkpoints: refused(words)}), {gateway: null}).standing.checkpoints.disabled, words)
  // The act through the kernel's route: the world's receipt, and nothing the desk invents.
  const transport = {kind: 'bridge', url: 'http://checkpoint.fixture'}
  const owner = kernel(op => (op.op === 'workcell_write' ? {result: 'owner_route_reading', route: 'workcell checkpoint', data: WORKCELL.sandbox.checkpoint, warnings: []} : null))
  const port = request => routes.ownerRouteWrite(transport, routes.workcellWriteOp(request), '`workcell checkpoint`')
  const binding = rack.workcellRackBinding(rackInput({}), {gateway: null, workcell: port})
  assert.equal(binding.standing.checkpoint, undefined, 'a world and a carrier: Checkpoint stands')
  await withKernel(owner, () => binding.write([{key: 'checkpoint', value: WORLD_REF}]))
  assert.deepEqual(owner.sent, [{op: 'workcell_write', request: {kind: 'checkpoint', receipt: RECEIPT}}])
  await assert.rejects(binding.write([{key: 'checkpoint', value: 'world:other'}]), /that is not the world read here/)
  // A host world's binding takes no checkpoint: Workcell's refusal (REAL), shown at the act.
  const unsupported = WORKCELL.host.checkpoint_refused.stderr.error.message
  const refusing = kernel(op => (op.op === 'workcell_write' ? {error: refusal(unsupported)} : null))
  await assert.rejects(withKernel(refusing, () => binding.write([{key: 'checkpoint', value: WORLD_REF}])), {message: unsupported})
  assert.match(unsupported, /is held by a provider that takes checkpoints/)
  // Without a carrier, Checkpoint stands disabled naming it.
  assert.match(rack.workcellRackBinding(rackInput({}), {gateway: null}).standing.checkpoint.disabled, /kernel carrier is unavailable/)
  // (a) the catalogue design draws the World page on the readings.
  const drawn = rack.workcellRackBinding(rackInput({lease: answered(WORKCELL.sandbox.lease), checkpoints: answered(WORKCELL.sandbox.checkpoints)}), {gateway: null, workcell: port})
  host.setHostPage(drawn.id, 'world')
  for (const view of ['whole', 'full']) {
    const markup = renderToStaticMarkup(createElement(host.HostedDevice, {designed: rackDesign, binding: drawn, view, nav: {}}))
    assert.match(markup, new RegExp(`data-device-view="${view}"`))
    assert.doesNotMatch(markup, /\bNaN\b|undefined|data-device-fault/)
  }
  host.resetHost(drawn.id)
  bind.resetHolds()
})
