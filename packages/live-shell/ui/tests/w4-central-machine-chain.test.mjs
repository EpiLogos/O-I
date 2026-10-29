// W4, Central: Machine on its design (central:machine, DLW §18.7; T-COVERAGE §2 D2), Central's chains exactly as §16.2 gives them per world
// kind, and the Workspace's ground presses the kernel now carries as the person's (action.rs PERSON_ACTS).
//
// Channels, each claim carried by one:
// - REAL (tests/fixtures/machine-2026-10-21.json): Central's machine readings on workcell:mac, 21 Oct 2026, through `ctrl --json action run`
//   (the runner the kernel's invoke_action reaches), each read-only in Central's own description: machine.account, machine.declaration,
//   machine.plan and machine.verify {role: current}, central.recovery.plan {role: current}, and machine.declaration's refusal of a role
//   with no declaration. The Workspace's inspection and self reading are tests/fixtures/person-writes-2026-10-21.json's.
// - CODE-DERIVED: what no real answer on this machine holds, built from Central's own structs — a machine plan with entries
//   (ctrl/src/machine.rs MachinePlanEntry: connector is {id, version}), and a self reading with bound tiers and unbound sources
//   (ctrl/src/development_field.rs TierReading.sources, UnboundSelfSource {ref, path, standing, provenance}); no world on this machine has
//   a ProjectCentral/docs (Central's documentation aperture, first named ProjectCentral/self), and the current role declares no requirement.
// - SCRIPTED: the catalogue designs rendered through the runtime's host (deviceHost.HostedDevice) to static markup; the chain's placement
//   as a pure function; a kernel behind the bridge's fetch recording each op. No owner state is written: every write goes to a recording
//   hand or the fake kernel.
// Not a screen pass: the on-screen legs are the lead's.
// Since the 22 Oct manual rewrite (#725): Machine is the Remote carrier's Machine page (§18.7 "What a machine holds against what you
// declared for it, and its recovery, is the Machine page of the Remote carrier (§19.18)"), whose values stand under `mc.`; Ground hygiene and
// Impact are retired (§19.16, §18.6), Voice is the Agent's Voice page (§19.21), the Workspace the track's head and Docs (§18.1); and a world's
// chain is the Packet, the Agent, Scope and Docs on every world (§16.2).
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {register} from 'node:module'

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

globalThis.document ??= {getElementById: () => null, createElement: () => ({}), head: {appendChild: () => {}}, documentElement: {}}
const {createElement} = await import('react')
const {renderToStaticMarkup} = await import('react-dom/server')
const host = await import('../src/frame/devices/deviceHost.tsx')
const machine = await import('../src/central/devices/machineBinding.ts')
const pages = await import('../src/central/devices/pageBindings.ts')
const ground = await import('../src/central/devices/pageGround.ts')
const writes = await import('../src/central/devices/centralDeviceWrites.ts')
const model = await import('../src/central/devices/centralDeviceModel.ts')
const chain = await import('../src/central/devices/CentralDevices.tsx')
const hygiene = await import('../src/inhabitants/centralHygieneModel.ts')
const {inhabitantManifest} = await import('../src/inhabitants/manifest.ts')
const {loadWorldShellFamilies} = await import('../src/inhabitants/worldShellFamilies.ts')
loadWorldShellFamilies()
// REPLACED (#725): Machine's design (central__machine.tsx) is retired; the Remote carrier draws the Machine page on the machine's own binding,
// prefixed `mc.` (workcell__remote-carrier.tsx; carryPages). The Workspace's design is retired too (§18.1).
const {design: carrierDesign} = await import('../src/inhabitants/catalogue/panels/workcell__remote-carrier.tsx')
const {carryPages} = await import('../src/agent/devices/oneAgentBinding.ts')
/** The Remote carrier hosting the Machine page: the machine's binding under `mc.`. */
const carrying = binding => carryPages({id: 'factory:remote-carrier', values: {}}, [{page: {prefix: 'mc.', shared: []}, binding}])
const carrierKeys = [...new Set([...Object.keys(carrierDesign.defaults), ...Object.values(carrierDesign.fixtures ?? {}).flatMap(fixture => Object.keys(fixture))])]
const {design: agentDesign} = await import('../src/inhabitants/catalogue/panels/actuation__harness-model.tsx')
const SLOT_DESIGNS = {
  'central:day-die': (await import('../src/inhabitants/catalogue/panels/day.tsx')).day,
  'central:main:approvals': (await import('../src/inhabitants/catalogue/panels/software-factory__approvals.tsx')).design,
  'central:packet': (await import('../src/inhabitants/catalogue/panels/central__packet.tsx')).design,
  'central:agent': agentDesign,
  'central:scope': (await import('../src/inhabitants/catalogue/panels/scope.tsx')).scope,
  'central:docs': (await import('../src/inhabitants/catalogue/panels/central__docs.tsx')).design,
}

const REAL = JSON.parse(readFileSync(new URL('./fixtures/machine-2026-10-21.json', import.meta.url), 'utf8'))
const W2 = JSON.parse(readFileSync(new URL('./fixtures/person-writes-2026-10-21.json', import.meta.url), 'utf8'))
const escaped = text => text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const viewsOf = design => design.views ?? ['folded', 'compact', 'whole', 'full', 'widget']
const hosted = (designed, binding) => viewsOf(designed).filter(view => view !== 'popout').map(view => [view, renderToStaticMarkup(createElement(host.HostedDevice, {designed, binding, view, nav: {}}))])
const designKeys = design => [...new Set([...Object.keys(design.defaults), ...Object.values(design.fixtures ?? {}).flatMap(fixture => Object.keys(fixture))])]
/** Draw a design on a binding in all its views: no NaN, no undefined, its own view, never its fixture text; each reason drawn. */
function drawsOn(design, binding, fixture, reasons = []) {
  const drawn = hosted(design, binding)
  for (const [view, markup] of drawn) {
    assert.match(markup, new RegExp(`data-device-view="${view}"`), `${design.id} ${view} draws`)
    assert.doesNotMatch(markup, /\bNaN\b|undefined/, `${design.id} ${view}: no absent key drawn as text`)
    assert.doesNotMatch(markup, /data-device-fault/, `${design.id} ${view}: its own view drew`)
    assert.doesNotMatch(markup, fixture, `${design.id} ${view}: its fixture never stands in`)
  }
  const all = drawn.map(([, markup]) => markup).join('\n')
  for (const why of reasons) assert.ok(all.includes(escaped(why)), `${design.id}: a refusal is drawn as why (${why.slice(0, 80)}…)`)
  return all
}
/** A kernel behind the bridge's fetch: every op answered as invoked with `data`, each op kept. */
function kernel(data = {}) {
  const sent = []
  const fetch = async (_url, init) => {
    const body = JSON.parse(init.body)
    sent.push(body)
    return {json: async () => ({ok: true, outcome: {result: 'action_dispatched', dispatch: {state: 'invoked', owner_operation: body.invocation?.action, data}}, receipts: []})}
  }
  return {sent, fetch}
}
async function withKernel(owner, run) {
  const real = globalThis.fetch
  globalThis.fetch = owner.fetch
  try { return await run() } finally { globalThis.fetch = real }
}
const answered = value => ({status: 'answered', value})
const REAL_ANSWERS = {account: answered(REAL.account), declaration: answered(REAL.declaration), plan: answered(REAL.plan), verify: answered(REAL.verify), recovery: answered(REAL.recovery)}
/** The design's sample text, which never stands in for a reading. */
const MACHINE_FIXTURE = /workstation|rustup|tailscaled|personal\.git-sync|redis-now|zshrc/
const recorder = () => { const asked = []; return {asked, asks: {replan: () => { asked.push('replan') }, verify: () => { asked.push('verify') }, recoveryPlan: () => { asked.push('recoveryPlan') }}} }

// ── Machine ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

test('Machine: the Remote carrier\'s Machine page; every key of it (defaults ∪ fixtures) and every control is classified — a reading, the view\'s own, absent or refused with its reason', () => {
  // REPLACED (#725): "the catalogue's design" was Machine's own (central:machine) — retired into the Remote carrier's Machine page (§18.7,
  // §19.18), whose `mc.` keys are the machine's own binding's keys under the prefix. MACHINE_DEVICE_ID stays the hold id of its view.
  assert.equal(machine.MACHINE_WIRING.design, 'central:machine')
  assert.equal(machine.MACHINE_DEVICE_ID, 'central:machine')
  const w = machine.MACHINE_WIRING
  const machineKeys = carrierKeys.filter(key => key.startsWith('mc.')).map(key => key.slice(3))
  assert.ok(machineKeys.length >= 10, 'the Machine page\'s keys')
  for (const key of machineKeys) assert.ok([w.reads, w.local, w.absent].some(table => key in table), `mc.${key}: a reading, the view's own, or absent with its reason`)
  for (const key of ['replan', 'verify', 'recoveryPlan']) assert.ok(key in w.writes, `${key}: a reading asked again`)
  for (const key of ['apply', 'adopt', 'recover']) assert.match(w.refused[key], /PERSON_ACTS/, `${key}: disabled naming the route it lacks`)
  for (const key of w.keys) assert.ok([w.reads, w.writes, w.local, w.refused, w.absent].some(table => key in table), `${key} placed`)
  for (const key of machineKeys) assert.ok(!(key in w.writes) || ['replan', 'verify', 'recoveryPlan'].includes(key), `mc.${key}: no reading travels as a write`)
})

test('REAL — Machine reads this Mac: the role it is bound to, the host as last observed, its declaration, the plan, the verification and the recovery plan', () => {
  pages.resetHolds()
  const v = machine.machineValues('central:machine', REAL_ANSWERS)
  assert.deepEqual(JSON.parse(v.roles), [{role: 'current', path: 'Control/machines/current.json', requirements: 0}])
  assert.equal(v.role, 'current', 'by default the role this machine is bound to (Control/machines/current.json)')
  assert.deepEqual(JSON.parse(v.host), {hostname: 'unknown-host', machineId: 'central-18d546bb2f3b3048-135df', platform: 'macos', architecture: 'aarch64', observedAt: 1792581329,
    stale: false, connector: 'read-models.harness-capability'})
  assert.deepEqual(JSON.parse(v.declared), {bindings: [{kind: 'workcell', reference: 'workcell:mac'}], capabilities: [], packages: [], configurations: [], services: []})
  const observed = JSON.parse(v.observed)
  assert.equal(observed.capabilities.length, REAL.plan.observed.observation.capabilities.length)
  assert.ok(observed.capabilities.includes('claude-code@source:actuation-harness-capability'))
  assert.deepEqual(JSON.parse(v.plan), {entries: [], summary: {changeable: 0, missing: 0, satisfied: 0, unsupported: 0}})
  assert.deepEqual(JSON.parse(v.verified), {satisfied: true})
  assert.deepEqual(JSON.parse(v.recovery), {synchronization: 'not_configured', changes: 0})
  assert.deepEqual([v.light, v.mode, v.refresh], ['lit', 'propose', 'open'], 'Change Propose and Refresh On open by default (§18.7)')
  for (const key of ['applied', 'recovered', 'ask']) assert.equal(v[key], undefined, `${key}: nothing reports it`)
  pages.setHeld('central:machine', 'role', 'workstation')
  assert.equal(machine.machineValues('central:machine', REAL_ANSWERS).role, 'workstation', 'Role is the view\'s own once the hand chooses')
  pages.resetHolds()
})

test('CODE-DERIVED — a plan with entries keeps each verdict, its port and the connector\'s id, and why the rest cannot change', () => {
  const plan = {...REAL.plan, entries: [
    {kind: 'package', id: 'git', status: 'satisfied', desired: {}, observed: {}},
    {kind: 'package', id: 'ripgrep', status: 'changeable', desired: {}, observed: null, port: 'PackageManager', connector: {id: 'homebrew', version: '0.1.0'}},
    {kind: 'service', id: 'sshd', status: 'missing', desired: {}, observed: null, reason: 'No eligible Connector starts it.'},
  ], summary: {satisfied: 1, missing: 1, changeable: 1, unsupported: 0}}
  assert.deepEqual(JSON.parse(machine.machineValues('central:machine', {...REAL_ANSWERS, plan: answered(plan)}).plan).entries, [
    {kind: 'package', id: 'git', status: 'satisfied'},
    {kind: 'package', id: 'ripgrep', status: 'changeable', port: 'PackageManager', connector: 'homebrew'},
    {kind: 'service', id: 'sshd', status: 'missing', reason: 'No eligible Connector starts it.'}])
})

test('Machine\'s presses: Plan, Verify and the Recover page\'s Plan ask the readings again; Apply, Adopt and Recover stand disabled naming the route; no transport, none asks', async () => {
  pages.resetHolds()
  const {asked, asks} = recorder()
  const binding = machine.machineBinding('central:machine', REAL_ANSWERS, asks)
  await binding.write([{key: 'replan', value: 'current'}, {key: 'verify', value: 'current'}, {key: 'recoveryPlan', value: 'current'}])
  assert.deepEqual(asked, ['replan', 'verify', 'recoveryPlan'])
  for (const key of ['apply', 'adopt', 'recover']) {
    assert.match(binding.standing[key].disabled, /PERSON_ACTS/, `${key} disabled with its reason`)
    await assert.rejects(binding.write([{key, value: 'current'}]), /PERSON_ACTS/, `${key} sends nothing`)
  }
  await assert.rejects(binding.write([{key: 'plan', value: '{}'}]), /a reading/, 'a reading is never written')
  const none = machine.machineBinding('central:machine', REAL_ANSWERS, null)
  for (const key of ['replan', 'verify', 'recoveryPlan']) assert.match(none.standing[key].disabled, /No transport reaches Central/)
  assert.ok(binding.local.role && binding.local.mode && binding.local.refresh && binding.local.ask, 'Role, Change, Refresh and the ask are the view\'s own')
})

test('REAL — the Remote carrier\'s Machine page draws the readings; a refused declaration is said where Role stands, an unread device waits', () => {
  // REPLACED (#725): Machine's own views and its Reconcile and Recover pages — the Remote carrier's Machine page holds all three parts as
  // bands (Declared, Reconcile, Recover; workcell__remote-carrier.tsx), drawn on the machine's binding prefixed `mc.`.
  pages.resetHolds()
  const binding = machine.machineBinding('central:machine', REAL_ANSWERS, recorder().asks)
  const carrier = carrying(binding)
  host.setHostPage(carrier.id, 'machine')
  const all = drawsOn(carrierDesign, carrier, MACHINE_FIXTURE, [machine.MACHINE_WIRING.refused.adopt, machine.MACHINE_WIRING.refused.recover])
  assert.match(all, /current/)
  // A role with no declaration: Central's own words, on Role.
  pages.setHeld('central:machine', 'role', 'nope')
  const refused = machine.machineBinding('central:machine', {...REAL_ANSWERS, declaration: {status: 'refused', error: REAL.declarationRefusal}, plan: {status: 'refused', error: REAL.declarationRefusal}}, recorder().asks)
  assert.equal(refused.values.light, 'dark')
  assert.equal(refused.values.declared, undefined)
  drawsOn(carrierDesign, carrying(refused), MACHINE_FIXTURE, [`machine.declaration: ${REAL.declarationRefusal}`])
  pages.resetHolds()
  // Nothing answered yet: the readings wait, never a sample.
  const unread = machine.machineBinding('central:machine', machine.MACHINE_UNREAD, recorder().asks)
  assert.ok(unread.waiting.includes('plan') && unread.waiting.includes('host'))
  drawsOn(carrierDesign, carrying(unread), MACHINE_FIXTURE)
  host.resetHost(carrier.id)
})

test('Machine reads through the kernel\'s invoke_action: each of its five readings is a Central action with the role it reads', async () => {
  const owner = kernel(REAL.plan)
  const {centralActionOp, actionAnswerOf} = await import('../src/central/devices/centralActions.ts')
  const {kernelRead} = await import('../../../../desktop/cradle/src/kernel/bridge.ts')
  const bridge = {kind: 'bridge', url: 'http://owner.machine'}
  const answer = await withKernel(owner, async () => {
    const call = await kernelRead(bridge, centralActionOp(machine.MACHINE_PLAN_ACTION, {role: 'current'}), {fresh: true})
    return actionAnswerOf({status: 'answered', value: call.outcome, error: null}, machine.MACHINE_PLAN_ACTION)
  })
  assert.deepEqual(owner.sent, [{op: 'invoke_action', invocation: {action: 'machine.plan', target_ref: 'central:action:machine.plan', input: {role: 'current'}}}])
  assert.equal(JSON.parse(machine.machineValues('central:machine', {...machine.MACHINE_UNREAD, plan: answer}).plan).summary.satisfied, 0)
  assert.deepEqual([machine.MACHINE_ACCOUNT_ACTION, machine.MACHINE_DECLARATION_ACTION, machine.MACHINE_VERIFY_ACTION, machine.RECOVERY_PLAN_ACTION],
    ['machine.account', 'machine.declaration', 'machine.verify', 'central.recovery.plan'])
})

// ── the chains (§16.2) ─────────────────────────────────────────────────────────────────────────────────────────────────────────────

const WORLDS = {state: 'read', worlds: [
  {ref: 'central:wiki:root', name: 'Your world', kind: 'yours', folder: 'Control/user/flows', project: null},
  {ref: 'central:wiki:project:O-I', name: 'O-I', kind: 'project', folder: 'Work/O-I/ProjectCentral/user', project: 'O-I'},
]}
// REPLACED (#725): W4's world chain — the Packet, the Agent with Voice after it and Scope, then Ground hygiene, Machine and Impact on a world
// whose folder holds code — is §16.2's: "The packet, the agent of the world, and its scope; then Docs", the same on every world. Voice is
// the Agent's Voice page (§19.21); Ground hygiene, Machine and Impact are retired (§19.16, §18.7, §18.6).
const WORLD_CHAIN = ['central:packet', 'central:agent', 'central:scope', 'central:docs']

test('§16.2 placement: the Main track\'s chain is the Day, then Approvals; a world\'s the packet, its agent and its scope, then Docs, whatever its folder holds', () => {
  const kinds = {
    none: {kind: 'none'},
    yours: chain.chainWorldOf(WORLDS.worlds[0], null),
    'project, code reading': chain.chainWorldOf(WORLDS.worlds[1], {status: 'reading'}),
    'project, no repository': chain.chainWorldOf(WORLDS.worlds[1], {status: 'refused', error: 'This project has no Git repository'}),
    'project, git refused': chain.chainWorldOf(WORLDS.worlds[1], {status: 'refused', error: 'No eligible Connector implements GitState.'}),
    'project holding code': chain.chainWorldOf(WORLDS.worlds[1], {status: 'answered', error: null}),
  }
  assert.deepEqual(kinds.yours, {kind: 'yours', name: 'Your world'})
  assert.deepEqual(kinds['project, no repository'].code, 'none')
  assert.deepEqual(kinds['project, git refused'].code, {refused: 'No eligible Connector implements GitState.'})
  assert.equal(chain.worldHoldsCode(kinds['project holding code']), true, 'whether the folder holds code is still read, and said on the chain')
  for (const [name, world] of Object.entries(kinds)) {
    assert.equal(chain.worldHoldsCode(world), name === 'project holding code', `${name}: holds code or not`)
    assert.deepEqual(chain.centralChainSlots('main'), ['central:day-die', 'central:main:approvals'], `${name}: the Main track's chain`)
    assert.deepEqual(chain.centralChainSlots('world'), WORLD_CHAIN, `${name}: the world's chain`)
  }
  // No monitor and no connection on a Central chain (§16.1: a monitor stands on the rail and in a pane, a connection on a workcell's chain).
  for (const id of [...chain.centralChainSlots('main'), ...chain.centralChainSlots('world')]) {
    const design = SLOT_DESIGNS[id]
    assert.ok(design, `${id}: a design of the catalogue`)
    assert.ok(['instrument', 'effect', 'rack', 'modulator'].includes(design.kind), `${id}: ${design.kind} — no monitor or connection`)
  }
  assert.equal(SLOT_DESIGNS['central:docs'].kind, 'effect', 'Docs: Kind effect (§18.5)')
  // REPLACED (#725): "Machine: Kind effect (§18.7)" — Machine is the Remote carrier's page now, a connection on a workcell's chain (§19.18),
  // never on a Central chain.
  assert.equal(carrierDesign.kind, 'connection', 'the Remote carrier: Kind connection')
})

test('the world a chain stands for is THE selection\'s: a world\'s track, or a page on it; any other selection names none', () => {
  const track = {kind: 'track', ref: 'central:world:central:wiki:project:O-I'}
  assert.equal(chain.centralWorldOf(track, WORLDS)?.name, 'O-I')
  assert.equal(chain.centralWorldOf({kind: 'clip', ref: 'Work/O-I/ProjectCentral/user/a.html', track: track.ref}, WORLDS)?.name, 'O-I')
  assert.equal(chain.centralWorldOf({kind: 'track', ref: 'central:world:central:wiki:root'}, WORLDS)?.kind, 'yours')
  assert.equal(chain.centralWorldOf({kind: 'track', ref: 'main'}, WORLDS), null)
  assert.equal(chain.centralWorldOf(track, {state: 'reading'}), null, 'the worlds not read yet: no world')
  assert.equal(chain.centralWorldOf(null, WORLDS), null)
})

test('the family declares Docs: an effect on a world\'s chain after Scope; Machine is declared no more', () => {
  // REPLACED (#725): "the family declares Machine: an effect on a world's chain after Ground hygiene" — the manual folds Machine into the
  // Remote carrier's Machine page (§18.7), so Central declares no Machine face; Docs is the family's effect on a world's chain (§16.2, §18.5).
  const central = inhabitantManifest('central')
  assert.ok(!central.faces.some(candidate => candidate.id === 'machine'), 'machine: retired')
  const face = central.faces.find(candidate => candidate.id === 'docs')
  assert.ok(face, 'docs: declared')
  assert.equal(face.liveSemantic, 'device-audio-fx')
  assert.deepEqual([...model.CENTRAL_WORKSPACE_FACES], ['packet', 'docs'])
  assert.deepEqual(chain.placedFaces(central.faces).map(f => f.id), ['day-die', 'packet', 'docs'])
})

// ── the Workspace's ground presses, and the self as Central gives it ─────────────────────────────────────────────────────────────────

const SELF = {schema: 'central.development-field-reading/v1', scope_ref: 'project:Archetypal-Earth',
  self_aperture: {path: 'ProjectCentral/docs', status: 'present', exists: true, issues: [], linked_sources: [],
    unbound_sources: [{ref: 'central:source:project:Archetypal-Earth:ProjectCentral/docs/walks.md', path: 'ProjectCentral/docs/walks.md', revision: 'r1', standing: 'unresolved', provenance: 'unresolved', authority_from_location: false}]},
  tier_bindings: [{tier: 0, semantic_office: 'ground', canonical_label: 'Earth', canonical_path: null,
    sources: [{ref: 'central:source:project:Archetypal-Earth:docs/VISION.md', path: 'docs/VISION.md', roles: [], provenance: 'human-authored', standing: 'design-commitment', treatment: 'retain-native-in-place', revision: 'r2', agent_retrieval_allowed: true, retained_native: true}, null]}],
  ux: [{ux_ref: 'ux:walks', source: {ref: 'central:source:project:Archetypal-Earth:docs/UX.md', path: 'docs/UX.md'}, intended_experience: true, implementation_fact: false, test_result: false, agent_inference: false, ex_human_return: false}],
  ex: [{ex_ref: 'ex:1', ux_refs: ['ux:walks'], source: {ref: 'central:source:project:Archetypal-Earth:returns/1.md', path: 'returns/1.md'}, artifact_refs: [], recorded_at_unix_seconds: 1, human_experience_return: true}],
  automatic_agent_or_model_invocation: false, canonical_tier_labels_invented: false, source_payloads_exposed: false, relation_source: 'ProjectCentral/relations/development-field.json'}

test('CODE-DERIVED — the self reads as Central gives it: a tier\'s resolved sources, a UX\'s and an EX\'s source, each unbound source by its ref', () => {
  assert.deepEqual(JSON.parse(ground.selfValue(SELF)), {
    aperture: {exists: true, status: 'present'},
    tiers: [{tier: 0, label: 'Earth', source: 'central:source:project:Archetypal-Earth:docs/VISION.md'}],
    ux: [{ref: 'ux:walks', source: 'central:source:project:Archetypal-Earth:docs/UX.md'}],
    ex: [{ref: 'ex:1', source: 'central:source:project:Archetypal-Earth:returns/1.md', ux: ['ux:walks']}],
    unbound: [{source: 'central:source:project:Archetypal-Earth:ProjectCentral/docs/walks.md', hints: ['ProjectCentral/docs/walks.md', 'standing unresolved', 'provenance unresolved']}],
  })
  assert.deepEqual(JSON.parse(ground.selfValue(W2.selfInspectOI.data)).unbound, [], 'REAL: O-I has no self, nothing unbound')
})

test('the Workspace\'s Accept, Ensure and a tier\'s Relate write the world\'s ground as the person\'s presses; UX and EX stay disabled naming the route', async () => {
  pages.resetHolds()
  const presses = []
  const state = {project: 'O-I', pc: {status: 'answered', value: W2.pcInspectOI.data}, self: answered(SELF), preview: async () => {},
    accept: async (treatment, source) => { presses.push(['accept', treatment, source]) }, ensure: async () => { presses.push(['ensure']) },
    relate: async (tier, source) => { presses.push(['relate', tier, source]) }}
  const workspace = {id: 'w1', name: 'O-I', project: 'O-I', layout: {root: null, mode: 'base'}}
  const binding = pages.workspaceBinding('central:workspace', workspace, Date.now(), null, state)
  for (const key of ['pcAccept', 'selfEnsure', 'selfRelate']) assert.equal(binding.standing[key], undefined, `${key}: stands`)
  await binding.write([{key: 'pcAccept', value: JSON.stringify({treatment: 'adopt', source: 'ProjectCentral/agents/wiki/wiki.json'})}])
  await binding.write([{key: 'selfEnsure', value: true}])
  await binding.write([{key: 'selfRelate', value: JSON.stringify({as: '0', source: SELF.self_aperture.unbound_sources[0].ref})}])
  assert.deepEqual(presses, [['accept', 'adopt', 'ProjectCentral/agents/wiki/wiki.json'], ['ensure'], ['relate', 0, SELF.self_aperture.unbound_sources[0].ref]])
  await assert.rejects(binding.write([{key: 'selfRelate', value: JSON.stringify({as: 'ux', source: 'x'})}]), /PERSON_ACTS/)
  await assert.rejects(binding.write([{key: 'pcAccept', value: JSON.stringify({treatment: 'migrate'})}]), /choose the wiki/)
  assert.ok(binding.local.selfSource, 'the source chosen to bind is the view\'s own')
  pages.setHeld('central:workspace', 'bindAs', 'ex')
  assert.equal(pages.workspaceBinding('central:workspace', workspace, Date.now(), null, state).standing.selfRelate.disabled, pages.RELATE_UX_EX_REFUSED)
  pages.resetHolds()
  const root = pages.workspaceBinding('central:workspace', {...workspace, project: undefined}, Date.now(), null, {project: null})
  for (const key of ['pcAccept', 'selfEnsure', 'selfRelate']) assert.match(root.standing[key].disabled, /no world's ground is read here/)
  // REPLACED (#725): the Workspace's Self page drawn on the binding — the Workspace is retired (§18.1: a world's account of itself is Docs);
  // until Docs is bound to the six tiers, the self stands as the binding's own reading, as Central gives it.
  assert.equal(binding.values.self, ground.selfValue(SELF), 'the self, read')
})

test('the presses carry exactly Central\'s inputs through invoke_action: init/adopt/migrate with the project\'s id, self.ensure, tier.relate human-accepted', async () => {
  assert.deepEqual(ground.acceptInput('O-I', 'create', null), {project: 'O-I', project_id: 'O-I'})
  assert.deepEqual(ground.acceptInput('O-I', 'migrate', 'wiki.json'), {project: 'O-I', project_id: 'O-I', source: 'wiki.json'})
  assert.deepEqual(ground.relateInput('O-I', 3, 'central:source:project:O-I:x.md'), {project: 'O-I', source_ref: 'central:source:project:O-I:x.md', tier: 3, acceptance: 'human-accepted'})
  const owner = kernel({ok: true})
  const bridge = {kind: 'bridge', url: 'http://owner.ground'}
  await withKernel(owner, () => writes.centralWrite(bridge, ground.PC_ACCEPT_ACTION.adopt, ground.acceptInput('O-I', 'adopt', 'wiki.json')))
  await withKernel(owner, () => writes.centralWrite(bridge, ground.PC_DOCS_ENSURE_ACTION, {project: 'O-I'}))
  assert.deepEqual(owner.sent.map(op => [op.op, op.invocation.action, op.invocation.input]), [
    ['invoke_action', 'projectcentral.adopt', {project: 'O-I', project_id: 'O-I', source: 'wiki.json'}],
    ['invoke_action', 'projectcentral.docs.ensure', {project: 'O-I'}]])
})

test('Ground hygiene\'s person tenders name the route as the kernel stands: invoke_action carries the person only for PERSON_ACTS', () => {
  // REPLACED (lane K0): Reconcile is the person's press too, through Workcell's route; the tenders through invoke_action name PERSON_ACTS.
  const tenders = hygiene.HYGIENE_TENDERS.filter(tender => /invoke_action/.test(tender.waitsFor))
  assert.ok(tenders.length >= 3)
  for (const tender of tenders) {
    assert.match(tender.waitsFor, /PERSON_ACTS/, tender.id)
    assert.doesNotMatch(tender.waitsFor, /carries no one/, `${tender.id}: not the stale words`)
  }
})

// ── Voice after Central's Agent, and Central's Approve (lead's follow-ups to builder B's ed21cfc09) ─────────────────────────────────────

const {AnswerVoice, VOICE_OFF, voiceBodyReadings} = await import('../src/central/devices/answerVoice.ts')
const voiceBind = await import('../src/agent/devices/voiceBinding.ts')
const one = await import('../src/agent/devices/oneAgentBinding.ts')
/** CODE-DERIVED: nara_voice open's constitution as kernel/src/nara_voice_constitution.rs composes it (actuation.speech-constitution/v1:
 * `interaction` from the composed modality — the local cascade may claim no full duplex or barge-in —, `interruption` unsupported, and
 * provenance.stage_relations in the order stt, text, tts, the speech stages carrying configuration.declared_voice); speak's receipt as the
 * speech actor answers it (nara_voice_actor.rs: actuation.nara-session-response/v1 with its request_ref). No voice opened on this machine
 * for this lane. */
const CONSTITUTION = {schema: 'actuation.speech-constitution/v1', constitution_ref: 'nara-speech-constitution:sha256:ab',
  interaction: {'request-response': {state: 'supported'}, 'full-duplex-realtime': {state: 'unsupported'}, 'barge-in': {state: 'unsupported'}},
  interruption: {state: 'unsupported', reason: 'This native reading declares no evidenced manual cancellation contract'},
  provenance: {stage_relations: [{configuration: {declared_voice: null}}, {model_relation: 'text'}, {configuration: {declared_voice: 'af_heart'}}]}}
const RECEIPT = {schema: 'actuation.nara-session-response/v1', request_ref: 'nara-session-request:7', ok: true}

function speakingOwner() {
  const schema = 'oi.nara-voice/v1', calls = []
  let n = 0
  const ports = {
    voice: async request => {
      calls.push(request.operation)
      if (request.operation === 'open') return {schema, voice_ref: `nara-voice:${++n}`, constitution: CONSTITUTION, receipt: {schema: RECEIPT.schema, request_ref: 'open', ok: true}}
      if (request.operation === 'speak') return {schema, voice_ref: request.voice_ref, response_ref: `nara-voice-answer:${++n}`, audio: {audio_base64: 'UklGRg==', content_type: 'audio/wav'}, receipt: RECEIPT}
      return {schema, voice_ref: request.voice_ref, closed: request.operation === 'close'}
    },
    opening: async () => ({binding: {operation: 'lookup', role: 'nara'}, context: {agent_session_ref: 'session:fixture'}}),
    send: async () => {}, capture: async () => ({finish: async () => new ArrayBuffer(4), discard: async () => {}}),
    play: async () => { let end; const ended = new Promise(resolve => { end = resolve }); return {ended, stop() { end() }} },
    encode: bytes => Buffer.from(bytes).toString('base64'), decode: base64 => new Uint8Array(Buffer.from(base64, 'base64')).buffer,
  }
  return {calls, ports}
}
const settle = () => new Promise(resolve => setTimeout(resolve, 0))

test('CODE-DERIVED — the Answer\'s voice keeps the open voice\'s constitution and the last speak\'s receipt; Voice reads its declared voice, duplex, barge-in, stop and receipt from them', async () => {
  assert.deepEqual(voiceBodyReadings(VOICE_OFF), {}, 'closed, nothing is read')
  const voice = new AnswerVoice(), owner = speakingOwner()
  voice.attach('session:fixture', owner.ports)
  voice.observe({answer: 1, ended: 1})
  await voice.write('speaks', 'on')
  assert.equal(voice.snapshot().constitution, CONSTITUTION, 'open: the owner\'s constitution, kept')
  voice.observe({answer: 2, ended: 2})
  for (let i = 0; i < 5; i++) await settle()
  assert.deepEqual(owner.calls, ['open', 'speak'])
  assert.deepEqual(voiceBodyReadings(voice.snapshot()), {'voice.voice': 'af_heart', 'body.duplex': 'unsupported', 'body.bargeIn': 'unsupported',
    'body.interrupt': 'unsupported', 'body.receipt': 'nara-session-request:7'})
  await voice.close()
  assert.equal(voice.snapshot().constitution, undefined, 'closed: the constitution goes with the voice')
  assert.deepEqual(voiceBodyReadings(voice.snapshot()), {'body.receipt': 'nara-session-request:7'}, 'the last receipt stays')
})

test('Voice on Central is the Agent\'s Voice page: B\'s binding, with the open voice\'s readings over its absences; Voice\'s chooser stays disabled naming its op; drawn on the Agent', () => {
  const state = {...VOICE_OFF, speaks: 'on', constitution: CONSTITUTION, receipt: RECEIPT}
  const binding = chain.centralVoiceBinding(state, null, async () => {})
  assert.equal(binding.id, voiceBind.VOICE_ID)
  assert.deepEqual([binding.values['voice.voice'], binding.values['body.duplex'], binding.values['body.bargeIn'], binding.values['body.interrupt'], binding.values['body.receipt']],
    ['af_heart', 'unsupported', 'unsupported', 'unsupported', 'nara-session-request:7'])
  for (const key of ['body.duplex', 'body.bargeIn', 'body.interrupt', 'body.receipt']) assert.equal(binding.standing[key], undefined, `${key}: a reading now`)
  assert.equal(binding.standing['voice.voice'].disabled, voiceBind.VOICE_REFUSE['voice.voice'], 'choosing a voice has no owner operation')
  for (const key of ['voice.voices', 'body.latencyMs', 'turn']) assert.equal(binding.standing[key].disabled, voiceBind.VOICE_ABSENT[key], `${key}: still absent with its reason`)
  // REPLACED (#725): Voice's own views — Voice is the Agent's Voice page (§19.21 "How an agent speaks … is the Agent's Voice page"), carried
  // under `speech.` (oneAgentBinding.ts VOICE_PAGE): the Agent's design draws it on the same binding.
  const agent = one.composeAgentBinding({id: 'central:agent', values: {}}, {voice: binding})
  assert.equal(agent.values['speech.voice.voice'], 'af_heart', 'the open voice\'s declared voice, on the Agent')
  assert.equal(agent.standing['speech.voice.voice'].disabled, voiceBind.VOICE_REFUSE['voice.voice'])
  host.setHostPage(agent.id, 'voice')
  const page = drawsOn(agentDesign, agent, /en_US-norman-medium|en_GB-alba-medium|0f3a…c21/)
  assert.match(page, /af_heart/, 'the Voice page draws the declared voice')
  host.resetHost(agent.id)
  const closed = chain.centralVoiceBinding(VOICE_OFF, 'The conversation is not bound.', async () => {})
  assert.equal(closed.values['body.duplex'], undefined)
  assert.equal(closed.standing['body.duplex'].disabled, voiceBind.VOICE_ABSENT['body.duplex'])
})

test('code-reading — Central\'s Approvals carries Approve to Central (projectcentral.source.return_accept by the anchor\'s principal), asked only while a proposal waits', async () => {
  const {readFile} = await import('node:fs/promises')
  const text = await readFile(new URL('../src/central/devices/CentralDevices.tsx', import.meta.url), 'utf8')
  // REPLACED (O-I #740 lane B): APPROVALS_PROJECT ('O-I'); the selected world's register (agent/worldScope.ts worldRegisterOf).
  assert.match(text, /approve: row => acceptSourceReturn\(transport, approvalsRegister, row, person\)/)
  assert.match(text, /useCentralAction\(transport, PERSONAL_ANCHOR_ACTION, waiting \? NO_INPUT : null\)/)
  // REPLACED (#725): "Voice is published on the door under its id" — Voice is the Agent's Voice page (§19.21): Central's Agent carries it.
  assert.match(text, /composeAgentBinding\(own, \{custody, identity, thread, voice: voiceDesign\}\)/, 'the Agent carries Voice')
  assert.doesNotMatch(text, /publishDevice\(VOICE_ID/, 'no Voice device on the door')
})
