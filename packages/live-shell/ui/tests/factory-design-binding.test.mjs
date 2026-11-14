// Lane BF: the agent chain's designed devices — the Agent (actuation:harness-model), the Skillset rack (ai-kit:skillset-rack), the
// member device (ai-kit:skill-device) and Scope (software-factory:context-write-mode) — bound to their owners' readings and writes
// (src/agent/devices/designBindings.ts, useRackReading.ts, FactoryDeviceChain.tsx). Owners write, faces read: a design key an owner
// reports is a reading, a key no owner reports is absent (never the design's default or fixture), a change goes through the
// owner's own write or is refused by name; what asks first (a raised reach, a composition, a review) sends nothing until confirmed.
//
// Channels:
// - REAL CAPTURE: the owner shapes below are trimmed from the installed owners' answers on this machine, 16 Oct 2026 01:2x BST
//   (`aikit --json set show suite-foundations`, `aikit session-space -C Work/O-I agent-session-skills`, `oi config resolve`) — the
//   lane's scratch `shapes/` holds them whole.
// - FIXTURE: the owners behind the bindings' ports (a row write that records its calls, a configuration plane that plans and
//   applies on a stub). No write ever reaches the owner's real state.
// - SCRIPTED: the catalogue's own designs rendered through the runtime's host (deviceHost.HostedDevice) to static markup, and the
//   runtime's release path (deviceHost.setDraft + flushDrafts). Not a screen pass.
import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'
import {existsSync, readFileSync} from 'node:fs'

// Loader as agent-native-p0.test.mjs (the setter bridge's graph reaches the atlas panel and the expressions boundary).
const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
const boundary = new URL('packages/expressions-boundary/src/', new URL('../../../../', import.meta.url)).href
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};
import {readFile} from 'node:fs/promises';
const BOUNDARY = ${JSON.stringify(boundary)};
export async function resolve(specifier,context,next){
  if(specifier.startsWith('@epilogos/expressions-boundary/'))return next(BOUNDARY+specifier.slice('@epilogos/expressions-boundary/'.length)+'.ts',context);
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
const adoptRows = await import('../src/inhabitants/sdk/adoptVerifiedRows.ts')
const p0 = await import('../src/inhabitants/agentNativeP0.ts')
const define = await import('../src/inhabitants/sdk/define.ts')
const {agentAddress} = await import('../src/inhabitants/agentParamAddresses.ts')
const {designKey} = await import('../src/frame/devices/designs.ts')
const host = await import('../src/frame/devices/deviceHost.tsx')
const model = await import('../src/agent/devices/agentChainDevices.ts')
const bind = await import('../src/agent/devices/designBindings.ts')
const {design: agentDesign} = await import('../src/inhabitants/catalogue/panels/actuation__harness-model.tsx')
const {skills: rackDesign} = await import('../src/inhabitants/catalogue/panels/skills.tsx')
const {memberDevice: memberDesign} = await import('../src/inhabitants/catalogue/panels/member.tsx')
const {scope: scopeDesign} = await import('../src/inhabitants/catalogue/panels/scope.tsx')

family.resetFamilyManifestsForTest()
loadAgentShellFamilies()
adoptRows.adoptVerifiedRows()

const html = element => renderToStaticMarkup(element)
const read = path => readFileSync(new URL(`../src/agent/${path}`, import.meta.url), 'utf8')
const fired = row => ({kind: 'fired', channel: row.writePath.split(/[.:]/)[0], writePath: row.writePath, note: 'acknowledged'})
const chain = (designed = bind.SLOT_DESIGN_FACE) => model.agentChainDevices({sessionRef: 's', reading: model.INITIAL_READING, accepted: {}}, async row => fired(row), designed)
const views = ['folded', 'compact', 'whole', 'full', 'widget']
/** One design drawn through the runtime's host on a binding: each of its five views. (The Agent's face measures its tokens in a
 * layout effect, which a static render cannot run; React's note about it is the only console line silenced here.) */
const hosted = (designed, binding) => {
  const said = console.error
  console.error = (first, ...rest) => { if (!String(first).includes('useLayoutEffect does nothing on the server')) said(first, ...rest) }
  try { return views.map(view => html(createElement(host.HostedDevice, {designed, binding, view, nav: {}}))) } finally { console.error = said }
}
/** The five views on one page of the design, as the host turns to it (deviceHost.setHostPage), then back. */
const onPage = (designed, binding, page) => {
  host.setHostPage(binding.id, page)
  try { return hosted(designed, binding) } finally { host.setHostPage(binding.id, undefined) }
}

// ---- the owners' real shapes (16 Oct, trimmed) ---------------------------------------------------------------------------
const SET_SHOW = {child_refs: [], children: [], complete: false, description: '', members: 5, name: 'suite-foundations', patterns: [],
  projected: ['skill/central/documentation-standing', 'skill/central/projectcentral-ontology', 'skill/ql/ql-foundations'],
  provenance: 'composed', revision: null, semantic_ref: null, summary: 'sets/suite-foundations — 5 members, 3 projected, 2 withheld (unreviewed)',
  withheld: [{capability: 'skill/aikit/knowledge-navigation', reason: 'this revision has not been reviewed'}, {capability: 'skill/aikit/wiki-inhabitation', reason: 'this revision has not been reviewed'}]}
const SET_LIST = {count: 2, sets: [{members: 5, name: 'suite-foundations', projected: 3, provenance: 'composed', withheld: 2}, {members: 2, name: 'docs-methodology', projected: 2, provenance: 'composed', withheld: 0}]}
const SKILLS = {schema: 'aikit.direct-agent-skills/v1', activation_performed: false, rows: [
  {description: 'The first route for any question about what this project knows, decided, or maintains.', eligible: false, name: 'AIKit Context and Knowledge Navigation', reason_code: 'capabilities.not_active', ref: 'skill/aikit/knowledge-navigation', revision: '5b163317484807deee7b36a5e3ecfc650def92d3', source: null},
  {description: "METHOD: Inhabit a project wiki — generate the agent's living cognition around a project.", eligible: false, name: 'Wiki inhabitation Method', reason_code: 'capabilities.not_active', ref: 'skill/aikit/wiki-inhabitation', revision: '0431f3c93b48624a91dbcec740472b499035724d', source: null},
  {description: "METHODOLOGY: Orient in a project's documentation field.", eligible: true, name: 'docs-methodology', reason_code: null, ref: 'skill/central/docs-methodology', revision: '91151e40a8d6057eb162ce22af5e4a158de0f0a3', source: 'central'},
  {description: 'Recover, compare, audit and manage Project documentation through the canonical authored positions.', eligible: true, name: 'documentation-standing', reason_code: null, ref: 'skill/central/documentation-standing', revision: '3e01ea38be65bcfdbc3aef0c0223a926c06ee91e', source: 'central'},
  {description: 'The ProjectCentral fractal — the one shape Central repeats.', eligible: true, name: 'projectcentral-ontology', reason_code: null, ref: 'skill/central/projectcentral-ontology', revision: '6ee3f1fa32c41cfe94f3dfe33ba464b62226cc30', source: 'central'},
  {description: 'The minimal QL shape and its foundational meanings.', eligible: true, name: 'ql-foundations', reason_code: null, ref: 'skill/ql/ql-foundations', revision: '1bde16304761881383866018407ad7a86bca7408', source: 'ql'},
]}
const RESOLUTION = (desired, active) => ({schema: 'oi.config-resolution/v1', setting_ref: 'ai-kit:skills:skills.capabilities', scope: {scope_kind: 'project', scope_ref: 'O-I'},
  ...(desired ? {desired: {value: desired}} : {}), native: {active: {value: active}}, reconciliation: {status: 'satisfied', reason: null}})
const PROFILE = {agent_ref: 'agent:ada', skill_set_refs: ['suite-foundations'], skill_refs: ['skill/central/docs-methodology']}
const ROSTER = {schema: 'central.agent-profile-roster/v1', profiles: [
  {accepted: false, profile: {agent_ref: 'agent:ada', skill_set_refs: ['not-this-one']}},
  {accepted: true, profile: PROFILE},
  {accepted: true, profile: {agent_ref: 'agent:ash', skill_set_refs: ['other']}},
]}

/** None of the design's defaults may arrive as an owner's value (the shell's own keys excepted, each named by the caller). */
const noDefaultPassed = (design, values, shellOwn = []) => {
  for (const [key, value] of Object.entries(design.defaults)) {
    if (shellOwn.includes(key)) continue
    assert.notDeepEqual([key, values[key]], [key, value], `${design.id}: ${key} carries the design's default ${JSON.stringify(value)} as if an owner reported it`)
  }
}

test('each published device is keyed to its design exactly: designKey(family, face.id) is the design\'s id', () => {
  const set = chain()
  const keyOf = slot => {
    const {device} = set.find(entry => entry.slot.id === slot)
    return designKey(device.family, device.face.id)
  }
  assert.equal(keyOf('agent'), agentDesign.id)
  assert.equal(keyOf('skillset'), rackDesign.id)
  assert.equal(keyOf('world'), scopeDesign.id, 'the world slot draws by Software Factory\'s Scope (§19.14) when its design is bound')
  const member = model.rackMemberDevice(bind.MEMBER_DEVICE_ID)
  assert.equal(designKey(member.family, member.face.id), memberDesign.id, 'the member device is AIKit\'s admitted skill-device face')
  assert.deepEqual([bind.AGENT_DESIGN, bind.RACK_DESIGN, bind.MEMBER_DESIGN, bind.SCOPE_DESIGN], [agentDesign.id, rackDesign.id, memberDesign.id, scopeDesign.id])
  // A slot whose design waits keeps its primary face (the generic plate draws the owner's rows), and a face the slot does not
  // carry is never borrowed.
  // REPLACED (#725): the world slot's primary face was Central's Context & world — retired in the 22 Oct manual rewrite ("Context & world is
  // Scope", PROGRAMME R25 item 5; §19.12 "Scope is the world device"), so the slot's one face, and its primary, is Software Factory's Scope.
  const plain = chain({})
  assert.equal(designKey(plain.find(entry => entry.slot.id === 'world').device.family, plain.find(entry => entry.slot.id === 'world').device.face.id), 'software-factory:context-write-mode')
  const borrowed = chain({world: {family: 'ai-kit', faceId: 'skillset-rack'}})
  assert.equal(borrowed.find(entry => entry.slot.id === 'world').device.face.id, 'context-write-mode')
  assert.deepEqual(set.map(entry => entry.device.face.liveSemantic), ['return', 'device-instrument', 'rack', 'return', 'return'], 'each designed face keeps its own Live semantic')
})

test('every chain design reads its owner lists from its values now, so it is hosted on its owner; one that drew its own list again would wait', () => {
  // The documentation lane's retrofits (3a97afb10, 4a6c051b9): the Agent's thread, models and harnesses, the rack's and the member's
  // members, Scope's reads and writes are value keys.
  for (const design of [agentDesign, rackDesign, memberDesign, scopeDesign]) assert.equal(bind.designWaits(design.id, design), null, `${design.id} is hosted`)
  const without = (design, keys) => ({...design, defaults: Object.fromEntries(Object.entries(design.defaults).filter(([key]) => !keys.includes(key)))})
  assert.match(bind.designWaits(bind.AGENT_DESIGN, without(agentDesign, ['thread', 'models', 'harnesses'])), /thread and models and harnesses/)
  assert.match(bind.designWaits(bind.RACK_DESIGN, without(rackDesign, ['members'])), /members/)
  assert.match(bind.designWaits(bind.MEMBER_DESIGN, without(memberDesign, ['members'])), /members/)
  assert.match(bind.designWaits(bind.SCOPE_DESIGN, without(scopeDesign, ['reads', 'writes'])), /reads and writes/)
  assert.match(bind.designWaits(bind.RACK_DESIGN, undefined), /has not loaded/)
})

// ---- the Gateway -------------------------------------------------------------------------------------------------------------

test('the Gateway reads the harness\'s own answer and writes through the address rows\' kernel path; what no carrier takes is refused by name', async () => {
  const set = chain()
  const gateway = set.find(entry => entry.slot.id === 'gateway').device
  assert.equal(designKey(gateway.family, gateway.face.id), bind.GATEWAY_DESIGN)
  assert.equal(bind.designWaits(bind.GATEWAY_DESIGN, {id: bind.GATEWAY_DESIGN, defaults: {frames: '[]'}}), null, 'a Gateway that reads its frames from its values is hosted')
  assert.match(bind.designWaits(bind.GATEWAY_DESIGN, {id: bind.GATEWAY_DESIGN, defaults: {}}), /frames/)
  const harness = {binding: 'cursor', resolved: false}
  assert.deepEqual(bind.gatewayValues({reading: model.INITIAL_READING, harness}), {}, 'not read: every key absent, the light too')
  const refused = {...model.INITIAL_READING, gatewayAdmitted: false, gateway: {kind: 'refused', title: 'Gateway · hermes', line: 'waiting on AIKit — the gateway is not running', receipt: null}}
  assert.deepEqual(bind.gatewayValues({reading: refused, harness}), {light: 'dark', refused: 'waiting on AIKit — the gateway is not running'}, 'a refused read: dark, in the owner\'s words')
  const answered = {...model.INITIAL_READING, gatewayAdmitted: true, gatewayDoc: {state: 'ready', transport: 'ws', approvals: 'session', connect: true, stall_after_seconds: 300}}
  // The harness's approvals is Scope's Tool calls (§19.12 Asks), not the Gateway's: the Gateway neither reads nor writes it.
  assert.deepEqual(bind.gatewayValues({reading: answered, harness: {binding: 'harness:hermes', resolved: true}}),
    {light: 'lit', harness: 'harness:hermes', readiness: 'ready', transport: 'ws', connect: true, stallAfter: 300},
    'the carrier\'s own fields, inside the declared choices, and never its approvals')
  const calls = []
  const rows = model.slotRows('gateway')
  const binding = bind.gatewayBinding('factory:gateway', {reading: answered, harness}, {
    transport: rows.find(row => row.key === 'transport'), connect: rows.find(row => row.key === 'connect'),
    stallAfter: {...agentAddress('gateway', 'stall-after'), title: 'Stall after'},
  }, async (row, value) => { calls.push([row.key, row.writePath, value]); return fired(row) })
  await assert.rejects(() => binding.write([{key: 'approvals', value: 'ask'}]), /approvals is a reading/, 'Tool calls are set on Scope')
  // REPLACED (lane A wiring): Connect is AIKit's pause/resume of the binding's connector and goes through its row; Transport, Stall after,
  // Fan-out and Auto-continue have no operation in AIKit's gateway (`aikit gateway agent`), so they stand disabled and send nothing.
  await binding.write([{key: 'connect', value: false}])
  assert.deepEqual(calls, [['connect', 'act:aikit.gateway.agent', false]])
  for (const key of ['transport', 'stallAfter', 'fanOut', 'autoContinue']) {
    assert.match(binding.standing[key].disabled, /AIKit's gateway has no operation/, `${key} stands disabled`)
    await assert.rejects(() => binding.write([{key, value: 1}]), /`aikit gateway agent` takes status, stop, new/, key)
  }
  assert.equal(binding.standing.connect, undefined, 'Connect stands')
  await assert.rejects(() => binding.write([{key: 'epoch', value: 'x'}]), /epoch is a reading/)
  assert.equal(calls.length, 1)
})

test('the catalogue\'s Gateway draws on the binding in all five views: the owner\'s refusal across the well, "—" for what is unread, never its fixture', async t => {
  const path = new URL('../src/inhabitants/catalogue/panels/actuation__gateway.tsx', import.meta.url)
  if (!existsSync(path)) { t.skip('actuation__gateway.tsx is not in the catalogue on this tree'); return }
  const {design} = await import(path.href)
  assert.equal(bind.designWaits(bind.GATEWAY_DESIGN, design), null)
  host.resetHost()
  const refused = {...model.INITIAL_READING, gatewayAdmitted: false, gateway: {kind: 'refused', title: 'Gateway · hermes', line: 'waiting on AIKit — the gateway is not running', receipt: null}}
  const binding = bind.gatewayBinding('factory:gateway', {reading: refused, harness: {binding: 'cursor', resolved: false}}, {}, async row => fired(row))
  const drawn = hosted(design, binding)
  drawn.forEach((markup, index) => {
    assert.doesNotMatch(markup, /undefined|NaN/, `${views[index]}: no absent key drawn as text`)
    assert.doesNotMatch(markup, /3f9a21c4|389\b/, `${views[index]}: the fixture\'s epoch and sequence never stand in`)
  })
  assert.ok(drawn.some(markup => markup.includes('the gateway is not running')), 'the owner\'s refusal is drawn')
  host.resetHost()
})

// ---- the chain's reading, from the World Model (O-I ticket 1006) -------------------------------------------------------------

// REAL CAPTURE: `seat status --json` on this machine, 21 Oct 2026 (fixtures/workcell-readings-2026-10-21.json): three workcells, each with a
// seat of every product; o-i claimed in all three, actuation in env-1 alone, factory in none.
const SEATS = JSON.parse(readFileSync(new URL('./fixtures/workcell-readings-2026-10-21.json', import.meta.url), 'utf8')).seatStatus
const held = (slice, value) => ({state: 'held', answer: {schema: 'oi.world-model-slice/v1', slice, owner: 'kernel', scopes: ['machine'], version: 1, state: 'read', error: null, read_at_unix_ms: 1, value}})
const workcellsSlice = (seats = SEATS) => held('workcells', {seats: {state: 'read', reading: seats}, workcells: {state: 'read', reading: {workcell_ref: 'workcell:mac'}}})

test('Git / landing reads the workcell\'s seat of the session\'s project: the one seat, or the one held; several held or none name no checkout, and say why', () => {
  const one = bind.projectSeatOf(SEATS, 'actuation')
  assert.equal(one.seat?.workcell, 'env-1', 'of three seats of actuation, the one held')
  assert.equal(one.seat.branch, 'fold/day-close-20261012')
  const several = bind.projectSeatOf(SEATS, 'O-I')
  assert.match(several.why, /^3 seats of O-I stand in the workcells \(env-1, env-2, env-3\), 3 of them held: Git \/ landing names no checkout it cannot tell is the session's/)
  assert.match(bind.projectSeatOf(SEATS, 'factory').why, /3 seats of factory .*none held/)
  assert.match(bind.projectSeatOf(SEATS, 'Nowhere').why, /^No workcell holds a seat of Nowhere/)
  assert.match(bind.projectSeatOf({schema: 'other'}, 'O-I').why, /not a seat reading/)
  // A fresh world: one workcell, one seat of the project, free — that seat is the session's checkout.
  const fresh = {schema: 'central.workcell-status/v1', workcells: [{name: 'cell-1', path: '/w/cell-1', seats: [{product: 'first-project', state: 'free', live_branch: 'main', tracked_changes: 2, untracked: 1}]}]}
  assert.equal(bind.projectSeatOf(fresh, 'first-project').seat?.workcell, 'cell-1')
  // The chain's Git line and the Agent's Context row read the same seat.
  const chain = bind.chainFromModel({slices: {workcells: workcellsSlice(fresh)}, sessionRef: 's', project: 'first-project', absent: null})
  assert.equal(chain.reading.git.kind, 'reading')
  assert.equal(chain.reading.git.line, 'workcell workcell:mac · seat cell-1/first-project on main')
  assert.deepEqual(chain.reading.gitRepo, {branch: 'main', uncommitted: 3}, 'its files with no commit: changed and untracked')
  assert.equal(chain.reading.gitAdmitted, true)
  assert.deepEqual(chain.git, {sessionRef: 's', project: 'first-project', repo: {branch: 'main', uncommitted: 3}, error: null})
  assert.deepEqual(bind.sessionGitOf(workcellsSlice(fresh), 's', 'first-project', null), chain.git, 'Central\'s Context reads the one function')
  const ambiguous = bind.chainFromModel({slices: {workcells: workcellsSlice()}, sessionRef: 's', project: 'O-I', absent: null})
  assert.equal(ambiguous.reading.git.kind, 'refused', 'the workcells answered, but no seat is the session\'s')
  assert.equal(ambiguous.reading.gitAdmitted, true, 'Workcell answered: its lamp is not the seat\'s')
  assert.equal(ambiguous.git.repo, null)
  assert.match(ambiguous.git.error, /3 seats of O-I/)
  // No session, or your world's root register, names no checkout, in the world scope's words.
  const absent = bind.chainFromModel({slices: {workcells: workcellsSlice()}, sessionRef: null, project: '', absent: 'No session is selected.'})
  assert.deepEqual([absent.git.repo, absent.git.error], [null, 'No session is selected.'])
  assert.match(absent.reading.git.line, /No session is selected\.$/)
  // The seat instrument refused, Workcell answered: the line says both.
  const seatsRefused = held('workcells', {seats: {state: 'refused', why: 'seat status timed out'}, workcells: {state: 'read', reading: {workcell_ref: 'workcell:mac'}}})
  const noSeats = bind.chainFromModel({slices: {workcells: seatsRefused}, sessionRef: 's', project: 'O-I', absent: null})
  assert.equal(noSeats.reading.git.line, 'workcell workcell:mac · seat status timed out.', 'the owner\'s words, as one line')
  // Not held yet: the lamp dark, nothing said.
  const reading = bind.chainFromModel({slices: {}, sessionRef: 's', project: 'O-I', absent: null})
  assert.deepEqual([reading.reading.gitAdmitted, reading.reading.waitingOn.git, reading.git.error], [null, null, null])
})

test('the Gateway, the Harness and the Model choosers read the World Model\'s slices: the binding the gateway names, its refusal in AIKit\'s words, the kernel not reached', () => {
  const sessions = gateway => held('sessions', {project_ref: 'project:root', spaces: [], gateway})
  const named = bind.chainFromModel({slices: {sessions: sessions({state: 'read', reading: {ecology: {type: 'ecology', ecology: {agencies: []}}, binding: 'gateway-binding/one',
    agent: {state: 'read', reading: {state: 'ready', transport: 'ws'}}}}), models: held('models', {entries: [{model: 'model:aion-2.0'}, {model: 'model:glm-5.1'}, {name: 'no id'}]})},
  sessionRef: 's', project: 'O-I', absent: null})
  assert.deepEqual([named.binding, named.resolved], ['gateway-binding/one', true])
  assert.equal(named.reading.gateway.kind, 'reading')
  assert.match(named.reading.gateway.line, /^binding gateway-binding\/one · /)
  assert.deepEqual(named.reading.gatewayDoc, {state: 'ready', transport: 'ws'})
  assert.deepEqual(named.models, ['model:aion-2.0', 'model:glm-5.1'], 'the catalogue\'s models, by id')
  assert.equal(named.harnesses, null, 'the census not read: nothing to choose yet')
  assert.equal(named.ecology.status, 'answered')
  const refused = bind.chainFromModel({slices: {sessions: sessions({state: 'refused', why: 'aikit: no gateway is configured'})}, sessionRef: 's', project: 'O-I', absent: null})
  assert.deepEqual([refused.binding, refused.resolved], ['cursor', false], 'no binding named: the shell\'s default, which nothing writes to')
  assert.equal(refused.reading.gateway.kind, 'refused')
  assert.equal(refused.reading.gateway.line, 'waiting on AIKit — harness_agent_read refused: aikit: no gateway is configured.')
  assert.equal(refused.reading.waitingOn.gateway, 'AIKit')
  assert.deepEqual(refused.ecology, {status: 'refused', value: null, error: 'aikit: no gateway is configured.'})
  const unbound = bind.chainFromModel({slices: {sessions: sessions({state: 'read', reading: {ecology: {}, binding: null, agent: {state: 'refused', why: 'AIKit\'s gateway names no conversation binding'}}})},
    sessionRef: 's', project: 'O-I', absent: null})
  assert.equal(unbound.resolved, false)
  assert.match(unbound.reading.gateway.line, /names no conversation binding/)
  const unreached = bind.chainFromModel({slices: {sessions: sessions({state: 'read', reading: {}})}, sessionRef: 's', project: 'O-I', absent: null, unreachable: 'Transport unavailable'})
  assert.match(unreached.reading.gateway.line, /not reached: Transport unavailable$/)
  assert.deepEqual(unreached.reading.waitingOn, {gateway: 'AIKit', skillset: unreached.reading.waitingOn.skillset, git: 'Workcell'})
  assert.equal(unreached.git.error, 'Transport unavailable')
})

// ---- the Agent ---------------------------------------------------------------------------------------------------------------

const agentInput = (over = {}) => ({
  sessionRef: 's', track: null, nowUnixMs: 1_000_000, reading: model.INITIAL_READING, accepted: {}, harness: {binding: 'cursor', resolved: false},
  holds: bind.chainHolds(), ...over,
})

test('the Agent reads only what an owner reported: nothing read is absent, never the design\'s Flint, 7 turns or 6 s', () => {
  bind.resetHolds()
  const none = bind.agentValues(agentInput({sessionRef: null}))
  assert.deepEqual(none, {light: 'unknown'}, 'the light says "not read"; every other key is absent (design.ts:8-10)')
  noDefaultPassed(agentDesign, none)
  const shell = bind.agentValues(agentInput({harness: {binding: 'cursor', resolved: false}}))
  assert.equal(shell.harness, undefined, 'the binding the shell starts with (cursor) is not the owner naming one')

  const read = bind.agentValues(agentInput({
    track: {agentRef: 'agent:kite', agentName: 'Kite', needle: {atUnixMs: 1_000_000 - 12_000}, budget: {used: 2, max: 9}},
    reading: {...model.INITIAL_READING, attached: true, budget: {used: 3, cap: 12}, gatewayAdmitted: true, gatewayDoc: {model: 'claude-opus-5.5', state: 'ready'}},
    accepted: {effort: 'max', input: 'queue', quantize: 'now'},
    harness: {binding: 'claude-code', resolved: true},
  }))
  assert.deepEqual(read, {
    light: 'lit', agent: 'Kite', age: 12, harness: 'claude-code', model: 'claude-opus-5.5', effort: 'max', input: 'queue', quantize: 'now',
    used: 3, cap: 12,
  }, 'each key from the owner that reports it: the task record, the agency track, the gateway, what the harness accepted; no Autonomy (retired, §19.4)')
  assert.equal('autonomy' in model.INITIAL_READING, false, 'the chain reads no task record word as the Agent\'s Autonomy')
  assert.equal(bind.agentValues(agentInput({track: {agentRef: 'a', agentName: null, needle: {atUnixMs: null}, budget: {used: null, max: null}}})).age, -1,
    'a temporal reading with no check-in is "no check-in" (-1), not a zero')
  assert.equal(bind.agentValues(agentInput({track: {agentRef: 'a', agentName: null, needle: null, budget: {used: null, max: null}}})).age, undefined, 'no temporal reading: absent')
  assert.equal(bind.agentValues(agentInput({sessionRef: null, reading: {...model.INITIAL_READING, attached: true}})).light, 'unknown',
    'a task record with no session selected is no record of this agent')
})

test('the Agent\'s five views draw on the binding together (scripted, ahead of its retrofit); the fixture\'s agent never stands in', () => {
  bind.resetHolds()
  host.resetHost()
  const binding = bind.agentBinding('factory:agent', agentInput({
    track: {agentRef: 'agent:kite', agentName: 'Kite', needle: {atUnixMs: 1_000_000 - 140_000}, budget: {used: null, max: null}},
    reading: {...model.INITIAL_READING, attached: true, budget: {used: 3, cap: 12}},
  }), {}, async row => fired(row), () => true)
  const drawn = hosted(agentDesign, binding)
  drawn.forEach((markup, index) => {
    assert.match(markup, new RegExp(`data-device-view="${views[index]}"`))
    assert.doesNotMatch(markup, /Flint/, `${views[index]}: the fixture\'s agent never stands in`)
  })
  for (const index of [0, 1, 2, 4]) assert.match(drawn[index], /Kite/, `${views[index]}: the seated agent, read from the agency track`)
  assert.match(drawn[2], /data-tone="stall">stalled<\/output><span class="dp-label">needle/, 'the needle reads the session\'s own last check-in (140 s, past the 90 s horizon)')
  assert.match(drawn[2], /<output class="dp-readout-value"[^>]*>3<\/output><span class="dp-label">used/, 'turns used from the task record')
  assert.match(drawn[2], /data-unread="true"/, 'effort, input and interrupt with no reading draw the kit\'s no-reading standing')
})

test('the Agent writes through its rows\' own write paths; a reading is refused by name; the composer sends nothing until Enter', async () => {
  bind.resetHolds()
  const calls = []
  const rows = model.slotRows('agent')
  const agentRows = {model: rows.find(row => row.key === 'model'), effort: rows.find(row => row.key === 'effort'), input: rows.find(row => row.key === 'input'), heartbeat: rows.find(row => row.key === 'heartbeat'), ...bind.AGENT_P0_ROWS}
  const write = async (row, value) => {
    calls.push([row.key, row.writePath, value])
    return row.key === 'heartbeat'
      ? {kind: 'refused', channel: 'kernel', writePath: row.writePath, reason: 'Heartbeat is presentation-state: its owner op is the cron-stratum cadence (WO-A3)'}
      : fired(row)
  }
  const make = (accepted = {}) => bind.agentBinding('factory:agent', agentInput({accepted}), agentRows, write, () => true)
  const binding = make()
  // REPLACED (lane A wiring): Model is AIKit's `gateway agent model --model ID`, through the address table's model row.
  await binding.write([{key: 'model', value: 'gpt-5'}])
  await assert.rejects(() => binding.write([{key: 'heartbeat', value: false}]), /cron-stratum cadence/, 'the dispatcher\'s own refusal, verbatim')
  assert.deepEqual(calls, [['model', 'act:aikit.gateway.agent', 'gpt-5'], ['heartbeat', 'shell.setHeartbeat', false]])
  calls.length = 0
  // Effort, Input and Interrupt timing have no operation in AIKit's gateway: disabled, and refused with nothing sent.
  for (const key of ['effort', 'input', 'quantize']) {
    assert.match(binding.standing[key].disabled, /AIKit's gateway has no operation/, key)
    await assert.rejects(() => binding.write([{key, value: 'max'}]), /`aikit gateway agent` takes/, key)
  }
  // Typing is held by the shell; nothing reaches an owner.
  await binding.write([{key: 'draft', value: 'Skip the cradle root'}])
  assert.deepEqual(calls, [])
  assert.equal(bind.chainHolds().composer.draft, 'Skip the cradle root')
  // Enter: AIKit's gateway carries no words into a binding's conversation (no steer line, and `new` takes none): the composer stands
  // disabled saying so, a press is refused, and the words stay in the draft.
  assert.equal(make({input: 'steer'}).standing.sent.disabled, bind.AGENT_SEND_UNCARRIED)
  await assert.rejects(() => make({input: 'steer'}).write([{key: 'sent', value: 'Skip the cradle root'}]), {message: bind.AGENT_SEND_UNCARRIED})
  await assert.rejects(() => make({input: 'queue'}).write([{key: 'sent', value: 'Then land it'}]), {message: bind.AGENT_SEND_UNCARRIED})
  assert.deepEqual(calls, [], 'no words were sent')
  assert.equal(bind.chainHolds().composer.draft, 'Skip the cradle root', 'the words stay in the draft')
  // Readings refuse in words that say whose they are.
  await assert.rejects(() => binding.write([{key: 'light', value: 'dark'}]), /Power is a reading/)
  await assert.rejects(() => binding.write([{key: 'cap', value: 20}]), /used and cap come from the session's task record/)
  assert.equal(calls.length, 0, 'no reading dispatched anything')
  assert.deepEqual(['model', 'effort', 'input', 'quantize', 'heartbeat', 'draft', 'sent'].map(binding.writes), [true, true, true, true, true, true, true])
  assert.deepEqual(['agent', 'harness', 'used', 'age', 'effortHeld'].map(binding.writes), [false, false, false, false, false])
  // The retired Autonomy (§19.4, §19.12): the Agent takes a press that still names it only to refuse it, naming what took its place.
  assert.equal(binding.standing.autonomy.disabled, bind.AGENT_AUTONOMY_RETIRED)
  await assert.rejects(() => binding.write([{key: 'autonomy', value: 'auto'}]), {message: bind.AGENT_AUTONOMY_RETIRED})
  assert.equal(calls.length, 0, 'nothing sent for it')
  bind.resetHolds()
})

test('a change goes to the owner on release through the runtime\'s own path, and a refusal comes back as the owner\'s words', async () => {
  bind.resetHolds()
  host.resetHost()
  const calls = []
  // REPLACED (lane A wiring): the Model goes to AIKit's gateway through its row; Effort, which AIKit's gateway has no operation for, is not
  // the example any more.
  const binding = bind.agentBinding('factory:agent', agentInput(), {model: model.slotRows('agent').find(row => row.key === 'model')},
    async (row, value) => { calls.push([row.writePath, value]); return {kind: 'refused', channel: 'kernel', writePath: row.writePath, reason: 'AIKit\'s gateway: this conversation has no agent backing'} }, () => true)
  host.setDraft('factory:agent', 'model', 'gpt-5')
  assert.equal(await host.flushDrafts(binding, 0), 'AIKit\'s gateway: this conversation has no agent backing')
  assert.deepEqual(calls, [['act:aikit.gateway.agent', 'gpt-5']])
  assert.equal(host.hostState('factory:agent').refused.model.reason, 'AIKit\'s gateway: this conversation has no agent backing')
  host.setDraft('factory:agent', 'cap', 30)
  assert.match(await host.flushDrafts(binding, 0), /used and cap come from the session's task record/, 'Budget has no owner write: refused in words that say whose it is, nothing sent')
  host.setDraft('factory:agent', 'harness', 'x')
  assert.match(await host.flushDrafts(binding, 0), /A reading/, 'a pure reading is refused by the host before anything is sent')
  host.setDraft('factory:agent', 'autonomy', 'auto')
  assert.equal(await host.flushDrafts(binding, 0), bind.AGENT_AUTONOMY_RETIRED, 'the retired Autonomy is refused in the words that name Scope\'s Tool calls')
  assert.equal(calls.length, 1)
  host.resetHost()
})

test('the P0 rows the shell restates are the declared batch\'s own — key, family, choices and write path', () => {
  p0.loadAgentNativeP0()
  const declared = (familyId, key) => define.sdkParamRows(familyId).find(row => row.deviceInstance === 'agent' && row.key === key)
  for (const row of Object.values(bind.AGENT_P0_ROWS)) {
    const source = declared(row.family, row.key)
    assert.ok(source, `${row.family}/${row.key} is declared in agentNativeP0.ts`)
    for (const field of ['family', 'deviceInstance', 'key', 'type', 'writePath']) assert.equal(row[field], source[field], `${row.key}.${field}`)
    assert.deepEqual(row.values, source.values, `${row.key}.values`)
  }
})

test('as the shell boots (families admitted, no kit rows adopted), the Agent\'s setters dispatch on the declared grammar — and an accepted interrupt timing is the Agent\'s reading', async () => {
  const sdkSetters = await import('../src/inhabitants/sdk/shellSetters.ts')
  const accepted = await import('../src/agent/devices/ownerAccepted.ts')
  const {registerAgentShellSetters} = await import('../src/agent/shellSetterBridge.ts')
  family.resetFamilyManifestsForTest()
  loadAgentShellFamilies()
  accepted.resetOwnerAccepted()
  try {
    assert.equal(define.sdkParamRows('actuation').length, 0, 'the boot the app runs: no §14 rows in the kit registry (ModeDetail.tsx loads the families only)')
    // Each setter's key is a declared row whose write path is that setter: the address table's, or the P0 batch's (Interrupt).
    const {AGENT_SHELL_SETTERS} = await import('../src/agent/shellSetterBridge.ts')
    const declared = [...(await import('../src/inhabitants/agentParamAddresses.ts')).AGENT_SHELL_ADDRESS_TABLE, ...Object.values(bind.AGENT_P0_ROWS)]
    for (const [path, {family: familyId, key}] of Object.entries(AGENT_SHELL_SETTERS)) {
      assert.ok(declared.some(row => row.family === familyId && row.key === key && row.writePath === path), `${path} is ${familyId}/${key}'s declared write path`)
    }
    assert.match(readFileSync(new URL('../src/agent/shellSetterBridge.ts', import.meta.url), 'utf8'), /^(?![\s\S]*No §14 row)/, 'no second look-up of the row before the dispatcher')
    const captured = []
    registerAgentShellSetters({
      transport: () => ({kind: 'bridge', url: 'http://fixture.invalid'}), binding: () => 'harness:fixture',
      shell: {setEffort() {}, setSteer() {}, setHeartbeat() {}, setWriteArm() {}, setQuantize() {}, quantize: 'next tool'},
      invoke: async (_t, op) => { captured.push(op); return {outcome: {result: 'action_dispatched', dispatch: {state: 'invoked', owner_operation: 'aikit.gateway.agent', data: {ok: true, schema: 1, data: {}}}}, error: undefined} },
    })
    // REPLACED (lane A wiring): AIKit's gateway has no operation for Effort or Interrupt timing, so the setters refuse naming it and
    // nothing reaches the kernel; an accepted value is still what the Agent draws (the record the owner's acceptance writes).
    for (const [path, value] of [['shell.setEffort', 'max'], ['shell.setQuantize', 'next turn']]) {
      const receipt = await sdkSetters.shellSetter(path)(value)
      assert.equal(receipt.kind, 'refused', path)
      assert.match(receipt.missingOp ?? '', /aikit gateway agent/, path)
    }
    assert.deepEqual(captured, [], 'nothing reached the kernel')
    const heartbeat = await sdkSetters.shellSetter('shell.setHeartbeat')(false)
    assert.equal(heartbeat.kind, 'refused')
    assert.match(heartbeat.reason, /cron-stratum/, 'a declared row the dispatcher refuses is still refused in its own words')
    assert.deepEqual(accepted.ownerAccepted('harness:fixture'), {}, 'nothing refused is recorded as accepted')
    accepted.recordOwnerAccepted('harness:fixture', 'interrupt-quantize', 'next turn')
    const values = bind.agentValues(agentInput({accepted: accepted.ownerAccepted('harness:fixture')}))
    assert.equal(values.quantize, 'next turn', 'what the owner accepted is what the Agent draws')
  } finally {
    accepted.resetOwnerAccepted()
    family.resetFamilyManifestsForTest()
    loadAgentShellFamilies()
    adoptRows.adoptVerifiedRows()
  }
})

// ---- the Skillset rack and its member ------------------------------------------------------------------------------------

const rackInput = (over = {}) => ({profile: PROFILE, sets: {'suite-foundations': SET_SHOW}, setList: SET_LIST, skills: SKILLS, capabilities: null, profiles: null, holds: bind.chainHolds(), ...over})

test('the rack holds what the seated agent carries, each member in its kind with only the evidence observed — carried is not loaded', () => {
  bind.resetHolds()
  assert.equal(bind.seatedProfile(ROSTER, 'agent:ada'), PROFILE, 'the seated agent\'s accepted profile — not an unaccepted one, not another agent\'s')
  assert.equal(bind.seatedProfile(ROSTER, null), null)
  assert.equal(bind.seatedProfile(ROSTER, 'agent:zed'), null)
  const members = bind.rackMembers(rackInput())
  const by = Object.fromEntries(members.map(m => [m.id, m]))
  assert.deepEqual(members.map(m => [m.id, m.form]), [
    ['skill/central/documentation-standing', 'skill'], ['skill/central/projectcentral-ontology', 'skill'], ['skill/ql/ql-foundations', 'skill'],
    ['skill/aikit/knowledge-navigation', 'skill'], ['skill/aikit/wiki-inhabitation', 'method'], ['skill/central/docs-methodology', 'methodology'],
  ], 'the set as AIKit replies (projected, then withheld), then the profile\'s own; the form by AIKit\'s METHOD:/METHODOLOGY: rule')
  assert.deepEqual(by['skill/central/documentation-standing'].rungs, [true, true, true, null, null, null, null, null, null, null],
    'carried, catalogued, available — and every operative step hollow: no kernel op reports selection, projection, loading or use')
  assert.deepEqual(by['skill/aikit/knowledge-navigation'].rungs.slice(0, 3), [true, true, false])
  assert.deepEqual(by['skill/aikit/knowledge-navigation'].withheld, {why: 'this revision has not been reviewed', fix: 'review'}, 'held back for a review you can give: orange, with its reason')
  assert.equal(by['skill/aikit/wiki-inhabitation'].says, "Inhabit a project wiki — generate the agent's living cognition around a project.", 'the form\'s prefix is the mark, not the text')
  assert.equal(by['skill/central/docs-methodology'].rev, '91151e4', 'the revision in use, as AIKit names it')
  assert.ok(members.every(m => m.rungs.slice(5).every(rung => rung === null)), 'carried is not loaded, and loaded is not used: nothing infers upward')
  // The seated session's record (`aikit praxis activity --session`, aikit.praxis-session/v1; O-I 745): loaded and invoked, yes or no,
  // while it works; relied on once its ticket's close named it.
  const practice = (standing, activity) => ({schema: 'aikit.praxis-session/v1', session: 'agent-session/s1', record: 'claude:s1', standing,
    ticket: 'EpiLogos/O-I#745', activity, reason: null})
  const rungsOf = activity => Object.fromEntries(bind.rackMembers(rackInput({activity})).map(m => [m.id, m.rungs]))
  const working = rungsOf(practice('open', {schema: 'aikit.praxis-activity/v1', loaded: ['skill/central/documentation-standing',
    'skill/central/docs-methodology'], invoked: ['skill/central/docs-methodology'], relied_upon: []}))
  assert.deepEqual(working['skill/central/docs-methodology'].slice(3, 8), [null, null, true, true, null],
    'loaded and invoked from the session\'s own tool events; relied on not observed before the close; selected and projected stay hollow')
  assert.deepEqual(working['skill/central/documentation-standing'].slice(5, 8), [true, false, null])
  assert.deepEqual(working['skill/ql/ql-foundations'].slice(5, 8), [false, false, null], 'recorded and not loaded: no, not hollow')
  const closed = rungsOf(practice('closed', {schema: 'aikit.praxis-activity/v1', loaded: ['skill/central/docs-methodology'], invoked: [],
    relied_upon: ['skill/central/docs-methodology']}))
  assert.deepEqual(closed['skill/central/docs-methodology'].slice(5, 8), [true, false, true], 'the close named what it relied on')
  assert.deepEqual(closed['skill/central/documentation-standing'].slice(5, 8), [false, false, false])
  const unrecorded = rungsOf({schema: 'aikit.praxis-session/v1', session: 'agent-session/s1', record: null, standing: 'unrecorded', activity: null})
  assert.ok(Object.values(unrecorded).every(rungs => rungs.slice(5).every(rung => rung === null)), 'no record of the session: hollow, not no')
  const uncatalogued = bind.rackMembers(rackInput({skills: {rows: []}}))
  assert.deepEqual(uncatalogued[0].rungs.slice(0, 3), [true, false, true], 'a member the catalogue does not list is carried but not catalogued')
  assert.equal(bind.rackMembers(rackInput({profile: null})), null, 'no seated agent: no members, not the design\'s documentation set')
})

test('the rack\'s values are the owners\' — none of skills.tsx\'s defaults (central:documentation, Baseline, b3:9f2c41, Epi-Logos, Claude) arrive as readings', () => {
  bind.resetHolds()
  const none = bind.rackValues(rackInput({profile: null}))
  assert.deepEqual(none, {marks: 'blade', compose: 'applied'}, 'only the shell\'s mark set and its compose state when nothing is read')
  noDefaultPassed(rackDesign, none, ['marks', 'compose'])
  const values = bind.rackValues(rackInput({capabilities: RESOLUTION({'skill/ql/ql-foundations': false}, ['skill/central/documentation-standing'])}))
  noDefaultPassed(rackDesign, values, ['marks', 'compose', 'light'])
  assert.equal(values.set, 'suite-foundations')
  assert.equal(values.light, 'lit', 'a member AIKit makes available lights the rack')
  assert.equal(values['req:skill/ql/ql-foundations'], false, 'your held intent at the scope')
  assert.equal(values['req:skill/central/documentation-standing'], true, 'else whether AIKit has it active')
  assert.equal(values['req:skill/aikit/knowledge-navigation'], false)
  assert.equal(JSON.parse(values.members).length, 6)
  assert.equal(values.revision, undefined, 'AIKit reports no set revision (null): absent')
  assert.equal(values.author, undefined, 'and no author')
  assert.equal(bind.rackValues(rackInput())['req:skill/ql/ql-foundations'], undefined, 'the plane not read: your request is unknown, not on')
})

// Round 869 (DLW build ruling 2026-11-05): the rack draws every SkillSet the agent carries, in the order Central keeps on its profile, not only
// the first, and each member stands under the set that holds it. The order is Central's (agent-profile.chain-order, Central PR 318).
const DOCS_SET = {child_refs: [], children: [], complete: true, description: '', members: 2, name: 'docs-methodology', patterns: [],
  projected: ['skill/central/docs-methodology', 'skill/central/diagram-authoring'], provenance: 'composed', revision: 'b3:5d0c', semantic_ref: null,
  summary: 'sets/docs-methodology — 2 members, 2 projected', withheld: []}
const twoSets = (over = {}) => rackInput({profile: {...PROFILE, skill_set_refs: ['docs-methodology', 'sets/suite-foundations']},
  sets: {'suite-foundations': SET_SHOW, 'docs-methodology': DOCS_SET}, ...over})

test('(r869) the rack draws every SkillSet the agent carries, in the profile\'s order, each member under the set that holds it', () => {
  bind.resetHolds()
  const values = bind.rackValues(twoSets())
  assert.deepEqual(JSON.parse(values.carried), [{name: 'docs-methodology', members: 2, revision: 'b3:5d0c'}, {name: 'suite-foundations', members: 5}],
    'every set, in the order Central keeps on the profile, with what AIKit says of each (suite-foundations names no revision)')
  assert.equal(values.set, 'docs-methodology', 'the set on the chain is the first the profile carries: Hot-swap and Export act on it')
  assert.equal(values.revision, 'b3:5d0c', 'and its revision')
  assert.deepEqual(JSON.parse(values.members).map(m => [m.id, m.set ?? null]), [
    ['skill/central/docs-methodology', 'docs-methodology'], ['skill/central/diagram-authoring', 'docs-methodology'],
    ['skill/central/documentation-standing', 'suite-foundations'], ['skill/central/projectcentral-ontology', 'suite-foundations'], ['skill/ql/ql-foundations', 'suite-foundations'],
    ['skill/aikit/knowledge-navigation', 'suite-foundations'], ['skill/aikit/wiki-inhabitation', 'suite-foundations'],
  ], 'each set\'s members as AIKit replies, set by set in the profile\'s order; one the profile also names directly stands under its set')
  const stray = JSON.parse(bind.rackValues(rackInput({profile: {...PROFILE, skill_refs: ['skill/central/stray']}})).members).at(-1)
  assert.deepEqual([stray.id, stray.set], ['skill/central/stray', undefined], 'a member the profile names directly stands under no set')
  // A set AIKit refused, or has not answered: it stands in its place, with AIKit's words or with nothing read.
  const refused = bind.rackValues(twoSets({sets: {'suite-foundations': SET_SHOW}, refused: {'set:docs-methodology': 'AIKit knows no set docs-methodology.'}}))
  assert.deepEqual(JSON.parse(refused.carried), [{name: 'docs-methodology', why: 'AIKit knows no set docs-methodology.'}, {name: 'suite-foundations', members: 5}])
  assert.deepEqual(JSON.parse(bind.rackValues(twoSets({sets: {}})).carried), [{name: 'docs-methodology'}, {name: 'suite-foundations'}], 'unread: the names alone')
  assert.equal(bind.rackValues(rackInput({profile: {...PROFILE, skill_set_refs: []}})).carried, undefined, 'no set carried: none drawn')
  noDefaultPassed(rackDesign, values, ['marks', 'compose', 'light'])
})

test('(r869) Order: the sets move through Central\'s agent-profile.chain-order with every ref the profile carries; without it the rack names that act', async () => {
  bind.resetHolds()
  host.resetHost()
  const place = {project: 'O-I', sessionRef: 's'}
  const asked = []
  const rack = (upkeep = {reorder: async refs => { asked.push(refs) }}, input = twoSets()) => bind.rackBinding('factory:skillset', input, null, place, upkeep)
  assert.equal(rack().writes('order'), true)
  assert.equal(rack().standing.order, undefined, 'two sets and Central\'s act to hand: the order stands to be changed')
  await rack().write([{key: 'order', value: JSON.stringify(['suite-foundations', 'docs-methodology'])}])
  assert.deepEqual(asked, [['sets/suite-foundations', 'docs-methodology']], 'the refs exactly as the profile carries them, in the new order')
  for (const value of [JSON.stringify(['suite-foundations']), JSON.stringify(['suite-foundations', 'night']), JSON.stringify(['suite-foundations', 'suite-foundations']), 'not json']) {
    await assert.rejects(() => rack().write([{key: 'order', value}]), {message: bind.RACK_ORDER_REFUSE.each}, value)
  }
  assert.equal(asked.length, 1, 'nothing reaches Central that is not every set once')
  assert.equal(rack({}).standing.order.disabled, bind.RACK_ORDER_REFUSE.noCarrier, 'no carrier: the act named, the order left as Central returns it')
  assert.match(bind.RACK_ORDER_REFUSE.noCarrier, /agent-profile\.chain-order/)
  await assert.rejects(() => rack({}).write([{key: 'order', value: JSON.stringify(['suite-foundations', 'docs-methodology'])}]), {message: bind.RACK_ORDER_REFUSE.noCarrier})
  assert.equal(rack(undefined, rackInput()).standing.order.disabled, bind.RACK_ORDER_REFUSE.one, 'one set: no order to change')
  assert.equal(rack(undefined, rackInput({profile: null})).standing.order.disabled, bind.RACK_ORDER_REFUSE.unread)
  // The face draws every set in order: the Sets list on the Set page with the selected set's moves, the title naming the others, the
  // members set by set, and the full page one section a set.
  const at = (markup, ...words) => words.map(word => markup.indexOf(word))
  const [folded, compact, whole, full] = hosted(rackDesign, rack())
  assert.match(whole, /Sets · 2/)
  const [first, second] = at(whole, 'data-id="docs-methodology"', 'data-id="suite-foundations"')
  assert.ok(first > 0 && second > first, 'the sets in the profile\'s order')
  assert.match(whole, /aria-label="Move docs-methodology later"/, 'the selected set moves')
  assert.match(folded, /docs-methodology \+1/)
  assert.match(compact, /docs-methodology \+1/)
  const [one, two, three] = at(compact, 'skill/central/diagram-authoring', 'skill/aikit/wiki-inhabitation', 'skill/ql/ql-foundations')
  assert.ok(one > 0 && two > one && three > two, 'the members set by set in the profile\'s order, and by kind within each (§19.7: methodologies first)')
  const [head1, head2] = at(full, '<h3>docs-methodology', '<h3>suite-foundations')
  assert.ok(head1 > 0 && head2 > head1, 'the full page: one section a set, in order')
  const held = hosted(rackDesign, rack({}))[2]
  assert.doesNotMatch(held, /aria-label="Move docs-methodology later"/, 'no carrier: no move is offered')
  assert.ok(held.includes(escaped(bind.RACK_ORDER_REFUSE.noCarrier)), 'and the list says which act would set the order')
  host.resetHost()
})

test('(r870) the manual writes down several sets and their order: §19.7\'s Sets row, as the rack draws and moves them', () => {
  const manual = readFileSync(new URL('../../../../ProjectCentral/docs/1-vision/dlw/DLW.md', import.meta.url), 'utf8')
  const rack = manual.slice(manual.indexOf('### 19.7'), manual.indexOf('### 19.8'))
  assert.ok(rack.length > 0, '§19.7 stands')
  assert.match(rack, /^\| Sets \| The sets the agent carries, in order \| The order Central keeps \| An agent can carry several sets\. The rack draws every one, each with its members, in the order Central keeps for the agent; select a set in the list and move it to change the order\. One set has no order to change\. \|$/m,
    'the row stands in the rack\'s Parameters, beside Set')
})

test('Preview, then Apply: the composition is held until previewed, the plane plans it, and only Apply carries exactly that plan', async () => {
  bind.resetHolds()
  const plans = [], applied = []
  const ports = {
    plan: async requests => { plans.push(requests); return {changeset: {changeset_id: 'cs-1'}, plans: [{plan: 'p'}]} },
    apply: async plan => { applied.push(plan) },
  }
  const place = {project: 'O-I', sessionRef: 'session:7'}
  const binding = () => bind.rackBinding('factory:skillset', rackInput(), ports, place)
  await binding().write([{key: 'req:skill/ql/ql-foundations', value: false}, {key: 'compose', value: 'changed'}])
  assert.equal(binding().values.compose, 'changed')
  assert.equal(binding().values['req:skill/ql/ql-foundations'], false, 'your request shows at once, held')
  await assert.rejects(() => binding().write([{key: 'compose', value: 'previewed'}]), /Choose where the composition applies/, 'no scope, no plan — never a default scope')
  await binding().write([{key: 'scope', value: 'project'}, {key: 'compose', value: 'changed'}])
  await binding().write([{key: 'compose', value: 'previewed'}])
  assert.deepEqual(plans, [[{setting_ref: 'ai-kit:skills:skills.capabilities', scope: {scope_kind: 'project', scope_ref: 'O-I'}, value: {'skill/ql/ql-foundations': false}}]],
    'AIKit\'s own toggle pipeline, through the plane, at the scope you chose')
  assert.equal(binding().values.compose, 'previewed')
  assert.deepEqual(applied, [], 'nothing is applied by a preview')
  // Cancel drops the plan without applying it; a new change does too.
  await binding().write([{key: 'compose', value: 'changed'}])
  assert.equal(binding().values.compose, 'changed')
  await assert.rejects(() => binding().write([{key: 'compose', value: 'applied'}]), /Nothing is previewed/)
  await binding().write([{key: 'compose', value: 'previewed'}])
  await binding().write([{key: 'compose', value: 'applied'}])
  assert.deepEqual(applied, [{changeset: {changeset_id: 'cs-1'}, plans: [{plan: 'p'}]}], 'Apply carries the previewed plan, verbatim')
  assert.equal(binding().values.compose, 'applied')
  assert.equal(binding().values['req:skill/ql/ql-foundations'], undefined, 'the hold ends: the owner\'s reading stands again')
  assert.equal(binding().values.scope, 'project', 'the scope you chose stays your choice')
  // Session scope addresses the session; the profile rides the same batch.
  await binding().write([{key: 'scope', value: 'session'}, {key: 'profile', value: 'review'}, {key: 'compose', value: 'previewed'}])
  assert.deepEqual(plans.at(-1), [{setting_ref: 'ai-kit:resolution:resolution.profiles', scope: {scope_kind: 'agent-session', scope_ref: 'session:7'}, value: ['review']}])
  await assert.rejects(() => bind.rackBinding('factory:skillset', rackInput(), null, place).write([{key: 'compose', value: 'previewed'}]), /not reachable/)
  // REPLACED (O-I #743): the rack's Set refused with the missing op "agent-chain skillset admit"; a drop chooses it, through Central.
  await assert.rejects(() => binding().write([{key: 'set', value: 'central:core-development'}]), /chosen by a drop: drag a SkillSet from the browser onto the chain and Central's agent-profile\.chain-admit adds it/)
  // #757: Export is AIKit's own set-package-export, into the directory you name (Into, `outDir`); without a carrier it says so.
  await assert.rejects(() => binding().write([{key: 'exported', value: 'pi'}]), /kernel carrier is unavailable here/)
  const exports = []
  const carried = () => bind.rackBinding('factory:skillset', rackInput(), ports, place, {write: async request => { exports.push(request) }})
  assert.match(carried().standing.exported.disabled, /name the directory the package is written into, as an absolute path/)
  await assert.rejects(() => carried().write([{key: 'exported', value: 'pi'}]), /absolute path/)
  carried().local.outDir('packages/relative')
  assert.match(carried().standing.exported.disabled, /absolute path/, 'a relative directory is not one the kernel can write into')
  carried().local.outDir('/srv/packages')
  assert.equal(carried().values.outDir, '/srv/packages', 'the directory is your hold')
  assert.equal(carried().standing.exported, undefined, 'a set, a target and an absolute directory: Export stands')
  await carried().write([{key: 'exported', value: 'pi'}])
  assert.deepEqual(exports, [{kind: 'set-package-export', project: 'O-I', set: carried().values.set, target: 'pi', out: '/srv/packages'}])
  carried().local.outDir(undefined)
  await binding().write([{key: 'target', value: 'pi'}])
  assert.equal(binding().values.target, 'pi', 'the package target is your choice, held')
  bind.resetHolds()
})

test('the member is the rack\'s chosen chain: Enabled is your request in the rack\'s composition; Review asks first; Trust and Run are refused by name', async () => {
  bind.resetHolds()
  const rack = bind.rackValues(rackInput())
  assert.deepEqual(bind.memberChains(rack).map(chain => chain.ref).slice(0, 2), ['skill/central/documentation-standing', 'skill/central/projectcentral-ontology'])
  const member = () => bind.memberBinding(bind.MEMBER_DEVICE_ID, bind.rackValues(rackInput()), 'skill/aikit/knowledge-navigation', bind.chainHolds())
  assert.deepEqual(Object.keys(member().values).sort(), ['marks', 'member', 'members'], 'no request read (the plane is not read), no review, no run')
  noDefaultPassed(memberDesign, member().values, ['marks'])
  await member().write([{key: 'requested', value: false}])
  assert.equal(bind.rackValues(rackInput())['req:skill/aikit/knowledge-navigation'], false, 'the member\'s Enabled is the rack\'s request: one composition')
  assert.equal(bind.rackValues(rackInput()).compose, 'changed')
  // The ask is the view's own key (DesignBinding.local): the runtime hands each set of it to the hold at once — no draft, no owner.
  assert.equal(host.setHosted(member(), 'reviewAsk', true), false, 'no draft: the hold takes it')
  assert.equal(member().values.reviewAsk, true, 'Review asks first: Trust and Cancel stand')
  host.setHosted(member(), 'reviewAsk', undefined)
  assert.equal(member().values.reviewAsk, undefined, 'Cancel drops the ask: it reaches the binding, not just the view')
  assert.deepEqual(host.hostState(bind.MEMBER_DEVICE_ID).drafts, {}, 'nothing was drafted for an owner')
  host.setHosted(member(), 'reviewAsk', true)
  // REPLACED (lane W3): Trust records the review through the kernel's aikit_write (w3-factory-bindings.test.mjs); with no carrier it says so.
  await assert.rejects(() => member().write([{key: 'reviewed', value: true}]), /kernel carrier is unavailable here, so AIKit cannot be asked \(`aikit trust record/)
  assert.equal(member().values.reviewAsk, undefined, 'the ask ends with the answer')
  assert.equal(member().writes('reviewAsk'), false, 'the ask is never a write to an owner')
  await member().write([{key: 'run', value: 'asked'}])
  assert.equal(member().values.run, 'asked')
  await member().write([{key: 'run', value: 'idle'}])
  assert.equal(member().values.run, undefined, 'Cancel: nothing was run')
  await assert.rejects(() => member().write([{key: 'run', value: 'ran'}]), /missing op: the exact JSON input `aikit praxis method run/)
  await assert.rejects(() => member().write([{key: 'proved', value: true}]), /Prove/)
  bind.resetHolds()
})

// ---- Scope -----------------------------------------------------------------------------------------------------------------

test('Scope: no owner reports a reach, a write mode, places or receipts, so none is drawn; a raised reach waits, and nothing is sent until Confirm', async () => {
  bind.resetHolds()
  host.resetHost()
  const calls = []
  const writeMode = model.slotRows('world').find(row => row.key === 'write-mode')
  const write = async (row, value) => { calls.push([row.writePath, value]); return {kind: 'refused', channel: 'kernel', writePath: row.writePath, reason: 'Write arm is presentation-state (WO-SF2)'} }
  const scope = () => bind.scopeBinding('factory:world', bind.chainHolds(), writeMode, write)
  assert.deepEqual(scope().values, {}, 'every Scope value is absent — never Scene, Propose, r15 → r17 or the fixture\'s places')
  // Raise the reach through the runtime's own set: the view's own key (DesignBinding.local), held at once, nothing sent to any owner.
  assert.equal(host.setHosted(scope(), 'reachPending', 2), false)
  assert.deepEqual(calls, [], 'nothing is sent before Confirm')
  assert.equal(scope().values.reachPending, 2, 'the raised reach waits, for the rings to draw dashed with Confirm and Cancel')
  assert.equal(scope().writes('reachPending'), false, 'the raised reach is never a write to an owner')
  // Cancel: the view drops the key, and the drop reaches the binding — the hold ends; nothing is sent.
  host.setHosted(scope(), 'reachPending', undefined)
  assert.equal(scope().values.reachPending, undefined, 'Cancel clears the raised reach')
  assert.deepEqual(calls, [])
  assert.deepEqual(host.hostState('factory:world').drafts, {}, 'nothing drafted for an owner')
  host.setHosted(scope(), 'reachPending', 2)
  // Confirm: the reach goes to its owner, which has no operation for it yet — refused by name, and the wait ends.
  await assert.rejects(() => scope().write([{key: 'reach', value: 2}]), /Reach: no owner operation carries it yet — missing op: the scope reach write/)
  assert.equal(scope().values.reachPending, undefined)
  // The write mode goes through the world row's own write path; draft has no writer.
  await assert.rejects(() => scope().write([{key: 'writeMode', value: 'direct'}]), /WO-SF2/)
  assert.deepEqual(calls, [['shell.setWriteArm', true]])
  await assert.rejects(() => scope().write([{key: 'writeMode', value: 'draft'}]), /draft awaits its writer/)
  // REPLACED: Scope's Knowledge page (#725) — what the agent reads from is Sources' now (§19.9, §19.12), and Scope's settings beyond its reach
  // are its Asks (§19.12 Asks): Calls to other agents, Wait and On no answer refused by the operations they lack (designBindings.ts
  // REFUSED_WRITES); Tool calls through the Gateway slot's approvals row, or refused where the chain hands in none.
  // REPLACED (round 859): Calls to other agents writes AIKit's ingress rule for agents through the kernel's harness_ingress_rule; a Scope
  // handed no carrier names it (w4-unbound-designs-binding.test.mjs reads and writes it).
  await assert.rejects(() => scope().write([{key: 'calls', value: 'allow'}]), /Calls to other agents: no carrier to AIKit's ingress rule for the sender kind agent \(the kernel's harness_ingress_rule\)/)
  // REPLACED (round 860): Wait and On no answer are the session's own settings in AIKit (track wait, track no_answer); a Scope handed no
  // carrier names it (w4-unbound-designs-binding.test.mjs reads and writes them).
  await assert.rejects(() => scope().write([{key: 'wait', value: 3600}]), {message: bind.WAIT_REFUSE.wait})
  await assert.rejects(() => scope().write([{key: 'noAnswer', value: 'deny'}]), {message: bind.WAIT_REFUSE.noAnswer})
  await assert.rejects(() => scope().write([{key: 'toolCalls', value: 'session'}]), /Tool calls: the Gateway's approvals row is not adopted on this chain/)
  for (const key of ['src.wiki', 'linkDepth', 'readBudget']) assert.equal(scope().writes(key), false, `${key}: no Knowledge page stands on Scope (§19.9 Sources holds it)`)
  await assert.rejects(() => scope().write([{key: 'w:lantern', value: false}]), /scope places write/)
  assert.equal(calls.length, 1)
  // Tool calls: the harness's approvals, as the gateway reads it, through the Gateway slot's own row (act:aikit.gateway.agent).
  const approvals = model.slotRows('gateway').find(row => row.key === 'approvals')
  const asked = bind.scopeBinding('factory:world', bind.chainHolds(), writeMode, write, {toolCalls: 'ask', toolCallsRow: approvals})
  assert.equal(asked.values.toolCalls, 'ask', 'the harness\'s own answer to a tool request')
  // REPLACED (lane A wiring): AIKit's gateway has no operation that sets the approvals mode, so Tool calls stands disabled and sends nothing.
  assert.match(asked.standing.toolCalls.disabled, /Tool calls \(approvals\): AIKit's gateway has no operation/)
  await assert.rejects(() => asked.write([{key: 'toolCalls', value: 'session'}]), /AIKit's gateway has no operation/)
  assert.equal(calls.length, 1, 'nothing sent for Tool calls')
  host.resetHost()
  bind.resetHolds()
})

// ---- the four on their owners: drawn, and what no owner carries stands disabled with its reason --------------------------------

/** Text as the static render escapes it inside an attribute. */
const escaped = text => text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

test('the Agent, the rack, the member and Scope draw their designs on their bindings in all five views — no NaN, no undefined — and each refused write is a disabled control that says why', () => {
  bind.resetHolds()
  host.resetHost()
  const write = async row => fired(row)
  const agent = bind.agentBinding('factory:agent', agentInput({
    track: {agentRef: 'agent:kite', agentName: 'Kite', needle: {atUnixMs: 1_000_000 - 12_000}, budget: {used: null, max: null}},
    reading: {...model.INITIAL_READING, attached: true, budget: {used: 3, cap: 12}},
  }), {}, write, () => true)
  const rack = bind.rackBinding('factory:skillset', rackInput(), null, {project: 'O-I', sessionRef: 's'})
  // A Method withheld for an unseen revision: its Review, Run and Prove stand.
  const member = bind.memberBinding(bind.MEMBER_DEVICE_ID, rack.values, 'skill/aikit/wiki-inhabitation', bind.chainHolds())
  bind.updateHolds(was => ({...was, reachPending: 2}))
  const scope = bind.scopeBinding('factory:world', bind.chainHolds(), model.slotRows('world').find(row => row.key === 'write-mode'), write)
  const cases = [[agentDesign, agent], [rackDesign, rack], [memberDesign, member], [scopeDesign, scope]]
  for (const [design, binding] of cases) {
    assert.equal(bind.designWaits(design.id, design), null)
    // Scope's Asks and Grants pages (§19.12) are drawn too: the Asks' refused settings say why there.
    const drawn = design.id === bind.SCOPE_DESIGN ? [...hosted(design, binding), ...onPage(design, binding, 'asks'), ...onPage(design, binding, 'grants')] : hosted(design, binding)
    drawn.forEach((markup, index) => {
      assert.match(markup, new RegExp(`data-device-view="${views[index % views.length]}"`), `${design.id} ${views[index % views.length]} draws`)
      assert.doesNotMatch(markup, /\bNaN\b|undefined/, `${design.id} ${views[index]}: no absent key drawn as text`)
      assert.doesNotMatch(markup, /data-device-fault/, `${design.id} ${views[index]}: its own view drew`)
    })
    const all = drawn.join('\n')
    for (const [key, why] of Object.entries(bind.REFUSED_WRITES[design.id])) {
      assert.equal(binding.standing[key].disabled, why, `${design.id}: ${key} stands disabled with the owner's missing operation`)
      // The Agent's power light only reads (lane BF2): its standing stands the design's activator disabled (actuation__harness-model.tsx
      // head: `st(p, 'light').disabled`). The kit's `lightWhy` would say why on the activator; the design's head does not pass it yet
      // (proposed to the documentation lane), so the reason is the light's standing, and the activator is drawn disabled.
      if (design.id === bind.AGENT_DESIGN && key === 'light') {
        assert.match(all, /<button type="button" class="dp-activator"[^>]*disabled=""/, 'the power light only reads: its activator stands disabled')
        continue
      }
      assert.ok(all.includes(escaped(why)), `${design.id}: the control of ${key} says why it cannot act (${why})`)
    }
    assert.match(all, /data-disabled="true"/, `${design.id}: a refused control is drawn disabled`)
  }
  // The rack's request squares stand: a member's request is its own req:<id> key, not the members reading.
  assert.equal(rack.writes('members'), true)
  assert.equal(host.hostedStanding(host.hostState('factory:skillset'), rack, []).members?.disabled, undefined)
  bind.resetHolds()
  host.resetHost()
})

// ---- the chain ---------------------------------------------------------------------------------------------------------------

test('the chain publishes each designed device with its binding, draws the member inside the rack, and names why a design waits', () => {
  const view = read('devices/FactoryDeviceChain.tsx')
  // REPLACED (R4): the Agent's publication no longer overrides its Full with the Thread device's pane — the one Agent's own Full is its
  // thread (actuation__harness-model.tsx `full`, on the Thread page it carries).
  assert.match(view, /publishDevice\(device\.id, \{device, picture: size => chainPicture\(slot\.id, pictures, size\), \.\.\.\(bindings\[slot\.id\] \? \{binding: bindings\[slot\.id\]!\} : \{\}\),/,
    'the pool, a pane and the rail draw the same design on the same binding')
  assert.doesNotMatch(view, /threadOpener/, 'no Full override for the Agent')
  assert.match(view, /\.\.\.\(slot\.id === 'gateway' && main\.frames \? \{full: \{open: \(\) => openDevice\(FRAMES_ID, 'Frames'\)\}\} : \{\}\)\}\)/,
    'the Gateway\'s own Full is the Frames monitor (§19.1, lane BF2)')
  assert.match(view, /<DeviceView device=\{device\} size="compact" picture=\{chainPicture\(slot\.id, pictures, 'compact'\)\} binding=\{bindings\[slot\.id\] \?\? undefined\}/)
  assert.match(view, /publishDevice\(memberDevice\.id, \{device: memberDevice, binding: memberDesignBinding\}\)/)
  assert.match(view, /slot\.id === 'skillset' && memberDevice && memberDesignBinding/, 'one chain inside the rack')
  assert.match(view, /data-design-waits=/)
  // REPLACED (O-I #740 lane B): the rack read RACK_PROJECT ('O-I'); it reads in the chain's register (the session's own, agent/worldScope.ts).
  assert.match(view, /useRackReading\(transport, profile, holds\.compose\.scope, sessionRef, rackOn, planeEpoch, rackProject\)/, 'the rack reads its owners only while its design draws them')
  assert.doesNotMatch(view, /defaults|fixtures/, 'no design default or fixture is read by the chain')
  const bindings = read('devices/designBindings.ts')
  assert.doesNotMatch(bindings, /\.defaults\[|\.fixtures|import[^\n]*\b(DOCUMENTATION|skills|scope|memberDevice|design)\b[^\n]*catalogue\/panels\/(?!practice)/, 'nor by the bindings: they read the owners')
  assert.match(bindings, /import type \{Form, Member, Rung\} from '\.\.\/\.\.\/inhabitants\/catalogue\/panels\/practice'/, 'the member shape is the catalogue\'s own, imported as a type only')
  for (const file of ['devices/designBindings.ts', 'devices/useRackReading.ts', 'devices/FactoryDeviceChain.tsx']) {
    assert.deepEqual(read(file).match(/#[0-9a-fA-F]{3,8}\b/g) ?? [], [], `${file}: shell tokens only`)
  }
})
