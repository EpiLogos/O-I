// Lane W8, the rebinds on builder E's round (a4c97faa9): Custody's Grants page on Actuation's authority list and revoke; the Prompt pads on
// Factory's bank (factory_owner locate, pads-read, pads-write); the Agent's Context page, the Skillset rack's upkeep pages and its member's
// Why and History on AIKit's reads and writes. What stays unrouted keeps its refusal: Issue (the desk composes no authority record), Run now
// (no route launches a pad), the attempt Retry, a procedure run, a bypass issue, an adoption with no digest.
//
// Actuation authenticates no issuer: its authority record is local material protected by file access, and it accepts whatever issuer the
// record names. The binding is the only guard, so these tests prove that no issuer other than the person's own press reaches a write.
//
// Channels:
// - REAL (read-only captures, 21 Oct): `actuation authority list --json` on a scratch store (desktop/cradle/kernel/tests/fixtures/
//   owner-routes/actuation-authority-2026-10-21.json); `factory development pads <state> project:point-cloud-demo --json` (an empty bank,
//   factory-pads-2026-10-21.json); `aikit work continuity pressure|commands`, `aikit unused`, `aikit collate`, `aikit bypass list`, `aikit
//   procedure list` (aikit-continuity-history-2026-10-21.json); `aikit explain|history skill/aikit/wiki-inhabitation`
//   (tests/fixtures/aikit-explain-history-2026-10-21.json).
// - FAKE: every write goes to a recording port or a fake kernel transport; a pad in Factory's own shape (the real bank is empty); a
//   procedure list naming one procedure. Nothing is written to Actuation, Factory or AIKit.
// - SCRIPTED: the catalogue designs rendered through the runtime's host to static markup.
import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'
import {readFileSync, readdirSync, statSync} from 'node:fs'

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
const pads = await import('../src/agent/devices/promptPadsBinding.ts')
const session = await import('../src/agent/devices/sessionChainBindings.ts')
const pages = await import('../src/agent/devices/aikitPages.ts')
const runMap = await import('../src/agent/devices/runMapBinding.ts')
const {design: padsDesign} = await import('../src/inhabitants/catalogue/panels/software-factory__prompt-pads.tsx')
const {design: custodyDesign} = await import('../src/inhabitants/catalogue/panels/agent-custody.tsx')
const {skills: rackDesign} = await import('../src/inhabitants/catalogue/panels/skills.tsx')
const {memberDevice: memberDesign} = await import('../src/inhabitants/catalogue/panels/member.tsx')
const {design: agentDesign} = await import('../src/inhabitants/catalogue/panels/actuation__harness-model.tsx')

family.resetFamilyManifestsForTest()
loadAgentShellFamilies()

const json = path => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'))
const ROUTES = '../../../../desktop/cradle/kernel/tests/fixtures/owner-routes/'
const AUTHORITY = json(`${ROUTES}actuation-authority-2026-10-21.json`)
const PADS = json(`${ROUTES}factory-pads-2026-10-21.json`)
const AIKIT = json(`${ROUTES}aikit-continuity-history-2026-10-21.json`)
const EXPLAIN = json('./fixtures/aikit-explain-history-2026-10-21.json')
const LISTING = AUTHORITY.list.stdout
const REVOKED = LISTING.authorities[0].authority_source_ref, STANDING = LISTING.authorities[1].authority_source_ref
const PERSON = 'person:frank'
const read = path => readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8')
const escaped = text => text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const hosted = (designed, binding) => host.viewsOf(designed).map(view => [view, renderToStaticMarkup(createElement(host.HostedDevice, {designed, binding, view, nav: {}}))])
const designKeys = design => [...new Set([...Object.keys(design.defaults), ...Object.values(design.fixtures ?? {}).flatMap(fixture => Object.keys(fixture))])]
const classify = (binding, key) => binding.local && key in binding.local ? 'local' : key in binding.values ? 'reading' : binding.standing?.[key]?.disabled ? 'absent' : null
/** A setting the owner holds none of for this thing (a daily pad's interval) whose control writes through the owner (standard (c)). */
const written = (binding, key) => !!binding.writes?.(key) && !binding.standing?.[key]?.disabled
const answered = value => ({status: 'answered', value, error: null})
const refused = error => ({status: 'refused', value: null, error})
const grantsAnswered = (listing = LISTING) => ({status: 'answered', value: listing, error: null, readAtUnixMs: 1_792_600_300_000})

/** A recording port set: every call is kept, in order, with its arguments. */
function recorder(names) {
  const calls = []
  const ports = Object.fromEntries(names.map(name => [name, async (...args) => { calls.push([name, ...args]); return {} }]))
  return {ports, calls}
}

/** A fake kernel transport (a bridge whose fetch records each op and answers as `answer` says). */
function fakeKernel(answer) {
  const ops = []
  const was = globalThis.fetch
  globalThis.fetch = async (url, init) => { const op = JSON.parse(init.body); ops.push(op); return {json: async () => ({ok: true, outcome: answer(op)})} }
  return {transport: {kind: 'bridge', url: 'http://fake-kernel.test'}, ops, restore: () => { globalThis.fetch = was }}
}

const custody = (over = {}, ports = {}) => session.custodyBinding({sessionRef: 's', autonomy: 'review', agent: {light: 'lit'}, holds: bind.chainHolds(),
  grants: grantsAnswered(), person: PERSON, ...over}, null, ports)

// ------------------------------------------------------------------------------------------------------------------ Custody's Grants

test('1 · Grants: each grant of Actuation\'s list as the design\'s row, the revoked one with its revocation, no expiry invented', () => {
  const rows = session.grantRows(LISTING)
  assert.equal(rows.length, LISTING.authorities.length)
  assert.deepEqual(rows[0], {ref: REVOKED, holder: 'human:owner', issuedBy: 'human:owner', operations: ['determine-agency'], worlds: ['central:project:Example'],
    issuedAt: LISTING.authorities[0].issued_at_unix_seconds, revoked: {at: LISTING.authorities[0].revoked.at_unix_seconds, reason: 'probe withdrawn'}})
  assert.equal(rows[1].ref, STANDING)
  assert.equal(rows[1].revoked, null, 'in force')
  for (const row of rows) assert.ok(!('expiresAt' in row), 'an Actuation authority record carries no expiry')
  assert.equal(session.grantRows({schema: 'something-else', authorities: []}), null, 'not the listing: no rows')
  bind.resetHolds()
  const binding = custody()
  assert.deepEqual(JSON.parse(binding.values.grants), rows)
  assert.equal(binding.values.readAt, 1_792_600_300, 'read at, in seconds, as the window read it')
  assert.match(binding.standing.holder.disabled, /missing op: the Actuation holder ref of the session's agent/)
  const unread = custody({grants: undefined})
  assert.equal(unread.standing.grants.disabled, session.CUSTODY_GRANTS_ABSENT.grants)
  const actuationSays = 'actuation refused: the authority store is unreadable'
  assert.equal(custody({grants: {status: 'refused', value: null, error: actuationSays}}).standing.grants.disabled, actuationSays, 'Actuation\'s refusal in its words')
})

test('2 · Grants: no issuer other than the person\'s own press reaches a write — Issue never goes, whatever issuer its value names', async () => {
  bind.resetHolds()
  // A port set that offers an issue port too: the binding must never reach it (nor revoke) for an Issue press.
  const {ports, calls} = recorder(['revoke', 'issue'])
  const binding = custody({}, {...ports, personNow: () => PERSON})
  assert.equal(binding.standing.issue.disabled, session.CUSTODY_GRANTS_REFUSE.issue, 'Issue stands disabled, naming the record the desk does not compose')
  const issuers = [PERSON, 'human:owner', 'agent:kite', 'desktop-human', '', undefined]
  for (const issuer of issuers) {
    const value = JSON.stringify({holder: 'human:owner', operations: ['determine-agency'], worlds: ['central:project:Example'], expiresIn: 'never',
      ...(issuer === undefined ? {} : {issued_by: issuer, issuer, authority_source_ref: 'authority-source:forged'})})
    await assert.rejects(binding.write([{key: 'issue', value}]), {message: session.CUSTODY_GRANTS_REFUSE.issue}, `issuer ${JSON.stringify(issuer)}`)
  }
  // A whole forged record, as Actuation would accept it from the file, pressed as Issue: refused all the same.
  await assert.rejects(binding.write([{key: 'issue', value: JSON.stringify(AUTHORITY.record)}]), {message: session.CUSTODY_GRANTS_REFUSE.issue})
  assert.deepEqual(calls, [], 'no Issue press reached any port')
  // The agent's own Run map retry and Agentset retry stay refused too (they need a named grant action the desk never asserts).
  assert.match(runMap.RUN_MAP_REFUSE.retry, /needs a named grant action, and the desk never asserts one/)
  // And nowhere in the agent zone does the desk compose an authority-issue request.
  const agentZone = new URL('../src/agent/', import.meta.url).pathname
  const files = []
  const walk = dir => { for (const name of readdirSync(dir)) { const path = `${dir}${name}`; statSync(path).isDirectory() ? walk(`${path}/`) : /\.tsx?$/.test(name) && files.push(path) } }
  walk(agentZone)
  for (const file of files) assert.doesNotMatch(readFileSync(file, 'utf8'), /['"]authority-issue['"]/, `${file.slice(agentZone.length)} composes no authority-issue`)
})

test('3 · Grants: Revoke goes only as the current person, only for a grant the list holds in force, and only while that person is still current', async () => {
  bind.resetHolds()
  // No person current: Revoke stands disabled and refuses at press.
  const nobody = recorder(['revoke'])
  const alone = custody({person: null}, nobody.ports)
  assert.equal(alone.standing.revoke.disabled, session.CUSTODY_GRANTS_REFUSE.revoke)
  await assert.rejects(alone.write([{key: 'revoke', value: STANDING}]), {message: session.CUSTODY_GRANTS_REFUSE.revoke})
  assert.equal(custody({person: '   '}, nobody.ports).standing.revoke.disabled, session.CUSTODY_GRANTS_REFUSE.revoke, 'a blank person is no person')
  assert.deepEqual(nobody.calls, [])
  // No carrier: disabled, naming the kernel's route.
  assert.match(custody({}, {}).standing.revoke.disabled, /actuation authority revoke/)
  // The list not read: Revoke waits for it.
  assert.equal(custody({grants: undefined}, nobody.ports).standing.revoke.disabled, session.CUSTODY_GRANTS_ABSENT.grants)
  // The person changed between the drawing and the press: nothing is sent.
  const switched = recorder(['revoke'])
  let now = PERSON
  const drawn = custody({}, {...switched.ports, personNow: () => now})
  assert.equal(drawn.standing.revoke, undefined, 'Revoke stands for the current person')
  now = 'person:someone-else'
  await assert.rejects(drawn.write([{key: 'revoke', value: STANDING}]), {message: session.CUSTODY_GRANTS_REFUSE.revokePerson})
  now = null
  await assert.rejects(drawn.write([{key: 'revoke', value: STANDING}]), {message: session.CUSTODY_GRANTS_REFUSE.revokePerson})
  assert.deepEqual(switched.calls, [])
  // The person's own press: a revoked grant, an unknown ref and no choice are refused; the grant in force goes, with the hand's reason.
  now = PERSON
  for (const value of [REVOKED, 'authority-source:not-listed', undefined, '']) {
    await assert.rejects(drawn.write([{key: 'revoke', value}]), {message: session.CUSTODY_GRANTS_REFUSE.revokeChoose}, String(value))
  }
  assert.deepEqual(switched.calls, [])
  bind.holdView(session.CUSTODY_ID, 'revoke:reason', '  ended by hand  ')
  const reasoned = custody({}, {...switched.ports, personNow: () => now})
  await reasoned.write([{key: 'revoke', value: STANDING}])
  assert.deepEqual(switched.calls, [['revoke', STANDING, 'ended by hand']], 'exactly the grant chosen and the hand\'s reason, trimmed')
  bind.resetHolds()
})

test('4 · Grants: the chain reads the list through authority-list and revokes through actuation_write with no issuer field; the person is currentIdentity()', async () => {
  const view = read('agent/devices/FactoryDeviceChain.tsx')
  assert.match(view, /const AUTHORITY_LIST: KernelOp = Object\.freeze\(\{op: 'actuation_read' as const, request: \{kind: 'authority-list' as const\}\}\)/)
  assert.match(view, /\{revoke: \(authority_source_ref, reason\) => ownerRouteWrite\(transport, \{op: 'actuation_write', request: \{kind: 'authority-revoke', authority_source_ref, \.\.\.\(reason \? \{reason\} : \{\}\)\}\}/,
    'the request carries the grant and the reason only: no issuer the desk composes')
  assert.match(view, /personNow: \(\) => currentIdentity\(\)\?\.reading\.person_ref \?\? null/, 'the person is read again at the press')
  assert.match(view, /const currentPerson = currentIdentity\(\)\?\.reading\.person_ref \?\? null/)
  // The same request through a fake kernel: one actuation_write, in the kernel's own request shape, answered with Actuation's real receipt.
  const kernel = fakeKernel(() => ({result: 'owner_route_reading', route: 'actuation authority revoke', data: AUTHORITY.revoke.stdout, warnings: []}))
  try {
    await routes.ownerRouteWrite(kernel.transport, {op: 'actuation_write', request: {kind: 'authority-revoke', authority_source_ref: STANDING, reason: 'ended by hand'}}, '`actuation authority revoke`')
  } finally { kernel.restore() }
  assert.deepEqual(kernel.ops.map(op => op.op), ['actuation_write'])
  assert.deepEqual(Object.keys(kernel.ops[0].request).sort(), ['authority_source_ref', 'kind', 'reason'])
})

// --------------------------------------------------------------------------------------------------------------------- Prompt pads

const LOCATED = {locations: [{project: 'O-I', root: '/Users/admin/Central/Work/O-I', state: 'located', location: {statePath: '/Users/admin/Central/Work/O-I/.factory/development-state.json', projectRef: PADS.pads.project_ref}}]}
/** A pad in Factory's own shape (factory/src/prompt_pads.rs; the real bank is empty). */
const PAD = {name: 'Read the day', prompt: 'Read today\'s field and say what moved.', session: {kind: 'new'}, agent_ref: null, scope_ref: null, seat: null,
  runs_at: {kind: 'daily', time: '07:30', days: ['mon', 'tue', 'wed', 'thu', 'fri']}, choke: 2}
const bankWith = (index, pad) => ({...PADS.pads, revision: 'rev:7', slots: PADS.pads.slots.map(slot => (slot.index === index ? {...slot, pad} : slot))})
const padsInput = (over = {}) => ({located: answered(LOCATED), bank: answered(PADS.pads), timezone: 'Europe/London', holds: bind.chainHolds(), ...over})

test('5 · Prompt pads: where Factory keeps the bank, and the real empty bank as sixteen empty pads, its revision as Factory names it', () => {
  assert.deepEqual(pads.padsLocation(LOCATED), {statePath: LOCATED.locations[0].location.statePath, projectRef: PADS.pads.project_ref, project: 'O-I'})
  assert.match(pads.padsLocation({locations: [{project: 'O-I', state: 'absent'}]}).why, /no project placement \(`\.factory`\)/)
  assert.match(pads.padsLocation({locations: []}).why, /located no project/)
  assert.equal(pads.padsLocation({nothing: true}), null)
  const rows = pads.padRows(PADS.pads)
  assert.equal(rows.length, 16)
  for (const row of rows) assert.deepEqual(row, {index: row.index, pad: null, running: false}, 'an empty slot: no pad, nothing running, no next')
  bind.resetHolds()
  const binding = pads.promptPadsBinding(padsInput())
  assert.equal(binding.values.light, 'lit')
  assert.equal(binding.values.revision, 'absent', 'Factory\'s own word before the first write')
  assert.deepEqual(JSON.parse(binding.values.projects), [{id: PADS.pads.project_ref, name: 'O-I'}])
  for (const key of ['sessions', 'agents', 'scopes', 'seats']) assert.match(binding.standing[key].disabled, /missing op: a listing of the/)
  assert.equal(pads.promptPadsBinding(padsInput({located: answered({locations: [{project: 'O-I', state: 'absent'}]}), bank: undefined})).values.light, 'dark')
  assert.match(pads.promptPadsBinding(padsInput({bank: refused('factory refused: the state is locked')})).standing.pads.disabled, /the state is locked/)
})

test('6 · Prompt pads: a pad read from Factory\'s shape, each setting written alone as Factory\'s pad with that one field changed', () => {
  assert.deepEqual(pads.padOf(PAD), {name: 'Read the day', prompt: PAD.prompt, session: 'new', agent: 'project', scope: 'session', seat: 'session', runsAt: 'daily', at: 450, days: 'weekdays', choke: 2})
  assert.deepEqual(pads.padWith(PAD, 'at', 615).runs_at, {kind: 'daily', time: '10:15', days: PAD.runs_at.days})
  assert.deepEqual(pads.padWith(PAD, 'days', 'all').runs_at, {kind: 'daily', time: '07:30'})
  assert.deepEqual(pads.padWith(PAD, 'days', 'weekends').runs_at, {kind: 'daily', time: '07:30', days: ['sat', 'sun']})
  assert.deepEqual(pads.padWith(PAD, 'runsAt', 'off').runs_at, {kind: 'off'})
  assert.deepEqual(pads.padWith(PAD, 'every', 6).runs_at, {kind: 'every', hours: 6})
  assert.equal(pads.padWith(PAD, 'choke', 0).choke, null, 'Off is no choke group')
  assert.deepEqual(pads.padWith(PAD, 'session', 'session:abc').session, {kind: 'session', session_ref: 'session:abc'})
  assert.equal(pads.padWith(PAD, 'agent', 'project').agent_ref, null)
  assert.deepEqual(pads.padWith(null, 'prompt', 'Write the brief.'), {prompt: 'Write the brief.'}, 'a prompt on an empty pad makes the pad (§19.22)')
  assert.throws(() => pads.padWith(null, 'name', 'x'), {message: pads.PADS_REFUSE.emptyPad})
  assert.throws(() => pads.padWith(PAD, 'next', 'x'), /is a reading/)
})

test('7 · Prompt pads: pads-write carries the slot, the bank revision read and the pad — never a caller or a grant; Run now stays refused', async () => {
  bind.resetHolds()
  const {ports, calls} = recorder(['write'])
  const none = pads.promptPadsBinding(padsInput(), ports)
  assert.equal(none.standing.prompt.disabled, pads.PADS_REFUSE.noPad)
  await assert.rejects(none.write([{key: 'prompt', value: 'x'}]), {message: pads.PADS_REFUSE.noPad})
  bind.holdView(pads.PROMPT_PADS_ID, 'pad', 3)
  const empty = pads.promptPadsBinding(padsInput(), ports)
  await assert.rejects(empty.write([{key: 'name', value: 'x'}]), {message: pads.PADS_REFUSE.emptyPad})
  await empty.write([{key: 'prompt', value: 'Write the brief.'}])
  const where = LOCATED.locations[0].location
  assert.deepEqual(calls, [['write', {state_path: where.statePath, project_ref: where.projectRef, index: 3, expected_revision: 'absent', pad: {prompt: 'Write the brief.'}}]])
  calls.length = 0
  const held = pads.promptPadsBinding(padsInput({bank: answered(bankWith(3, PAD))}), ports)
  assert.equal(held.values.name, 'Read the day', 'the pad you read stands in the settings')
  assert.equal(held.values.at, 450)
  await held.write([{key: 'choke', value: 0}])
  await held.write([{key: 'clear', value: true}])
  assert.deepEqual(calls.map(([, request]) => [request.expected_revision, request.pad]), [['rev:7', {...PAD, choke: null}], ['rev:7', null]])
  for (const [, request] of calls) assert.deepEqual(Object.keys(request).sort(), ['expected_revision', 'index', 'pad', 'project_ref', 'state_path'], 'no caller, no authority')
  calls.length = 0
  await assert.rejects(held.write([{key: 'press', value: true}]), {message: pads.PADS_REFUSE.press})
  assert.equal(held.standing.press.disabled, pads.PADS_REFUSE.press)
  assert.equal(pads.promptPadsBinding(padsInput(), {}).standing.prompt.disabled, pads.PADS_REFUSE.noCarrier)
  assert.deepEqual(calls, [])
  // Through a fake kernel, the shell's own request: factory_owner pads-write, the kernel adds the person's grant (factory.rs PadsWrite).
  const kernel = fakeKernel(() => ({result: 'factory_development_reading', data: {schema: 'factory.prompt-pads-write/v1'}}))
  try { await routes.factoryOwnerWrite(kernel.transport, {kind: 'pads-write', state_path: where.statePath, project_ref: where.projectRef, index: 3, expected_revision: 'absent', pad: null}, '`factory development pads-write`') }
  finally { kernel.restore() }
  assert.deepEqual(kernel.ops, [{op: 'factory_owner', request: {kind: 'pads-write', state_path: where.statePath, project_ref: where.projectRef, index: 3, expected_revision: 'absent', pad: null}}])
  const view = read('agent/devices/FactoryDeviceChain.tsx')
  assert.match(view, /\{write: request => factoryOwnerWrite\(transport, \{kind: 'pads-write', \.\.\.request\}, '`factory development pads-write`'\)\}/)
  assert.match(view, /const PADS_LOCATE: KernelOp = Object\.freeze\(\{op: 'factory_owner' as const, request: \{kind: 'locate', project: RACK_PROJECT\}\}\)/)
  assert.doesNotMatch(view, /pads-run|pads-record/, 'no begin or end is recorded for a run that never started')
  bind.resetHolds()
})

// ------------------------------------------------------------------------------------------------------------- AIKit's pages

test('8 · AIKit: the Context page\'s pressure and armed commands, the rack\'s unused, roots, bypasses and procedures, the member\'s Why and History', () => {
  const pressure = pages.contextPressureOf(AIKIT.pressure.data)
  assert.deepEqual(pressure, {budget: 60, brackets: {fresh_max: 0.2, moderate_max: 0.45, depleted_max: 0.7}}, 'no session read: no consumed, no pressure named')
  assert.deepEqual(pages.armedOf(AIKIT.commands.data), [], 'nothing armed: an empty list, a reading')
  assert.deepEqual(pages.unusedOf(AIKIT.unused_trimmed.data), AIKIT.unused_trimmed.data.unused.map(row => row.capability))
  assert.deepEqual(pages.rootsOf(AIKIT.collate_trimmed.data), [
    {root: '@agents', path: '/Users/admin/.agents/skills', skills: 2, decide: 0},
    {root: '@claude', path: '/Users/admin/.claude/skills', skills: 2, decide: 0},
    {root: '@codex', path: '/Users/admin/.codex/skills', skills: 1, decide: 0}])
  assert.deepEqual(pages.bypassesOf(AIKIT.bypass_list.data), [])
  assert.equal(pages.proceduresOf(AIKIT.procedure_list.data).length, AIKIT.procedure_list.data.count)
  assert.deepEqual(pages.whyOf(EXPLAIN.explain), {state: 'unavailable', trust: 'unseen', maturity: 'stable', selectedBy: EXPLAIN.explain.selected_by, requiredBy: [], dependencies: [],
    unavailable: 'this revision has not been reviewed'}, 'no Projection lines in the render: none invented')
  const history = pages.historyOf(EXPLAIN.history, 'Europe/London')
  assert.equal(history.length, EXPLAIN.history.entries.length)
  const ms = [...EXPLAIN.history.entries].map(row => row.occurred_at_unix_ms).sort((a, b) => a - b)
  assert.equal(history[0].kind, EXPLAIN.history.entries.find(row => row.occurred_at_unix_ms === ms[0]).kind, 'oldest first')
  for (const row of history) { assert.match(row.at, /^\d{1,2} [A-Z][a-z]{2,3} \d{2}:\d{2}$/); assert.ok(!('ms' in row)) }
  for (const map of [pages.unusedOf, pages.rootsOf, pages.bypassesOf, pages.proceduresOf, pages.whyOf, pages.historyOf, pages.contextPressureOf]) assert.equal(map({}), null)
})

const agentInput = (over = {}) => ({sessionRef: 's', track: null, nowUnixMs: 1_000_000, reading: model.INITIAL_READING, accepted: {}, harness: {binding: 'cursor', resolved: false},
  holds: bind.chainHolds(), ...over})

test('9 · the Agent\'s Context page: AIKit\'s pressure and armed list when handed in, AIKit\'s refusal in its words, the last turn always absent', () => {
  bind.resetHolds()
  const values = bind.agentValues(agentInput({context: {pressure: answered(AIKIT.pressure.data), commands: answered(AIKIT.commands.data)}}))
  assert.deepEqual(JSON.parse(values['ctx.pressure']), pages.contextPressureOf(AIKIT.pressure.data))
  assert.equal(values['ctx.armed'], '[]')
  assert.equal(values['ctx.turn'], undefined)
  const binding = bind.agentBinding(bind.AGENT_DESIGN, agentInput({context: {pressure: refused('aikit: no world here'), commands: {status: 'reading', value: null, error: null}}}), {}, async () => ({kind: 'refused', reason: 'x'}), () => false)
  assert.equal(binding.standing['ctx.pressure'].disabled, 'aikit: no world here')
  assert.match(binding.standing['ctx.armed'].disabled, /has not answered its continuity yet/)
  assert.equal(binding.standing['ctx.turn'].disabled, bind.AGENT_CONTEXT_ABSENT['ctx.turn'])
  const unread = bind.agentBinding(bind.AGENT_DESIGN, agentInput(), {}, async () => ({kind: 'refused', reason: 'x'}), () => false)
  assert.equal(unread.standing['ctx.pressure'].disabled, bind.AGENT_CONTEXT_ABSENT['ctx.pressure'])
})

const RACK_INPUT = () => ({profile: null, sets: {}, setList: null, skills: null, capabilities: null, profiles: null, holds: bind.chainHolds()})
const PLACE = {project: 'O-I', sessionRef: null}
const PROCEDURE = AIKIT.procedure_list.data.procedures[0]
const upkeep = (write) => ({unused: answered(AIKIT.unused_trimmed.data), collate: answered(AIKIT.collate_trimmed.data), bypasses: answered(AIKIT.bypass_list.data),
  procedures: answered(AIKIT.procedure_list.data), ...(write ? {write} : {})})

// REPLACED (lane W9): Sync, Promote and Rollback read AIKit's source list, Apply adopts at the reviewed digest and Run applies the chosen
// procedure at its diff's digest since the kernel's round of cdbde6fe7 (w9-approvals-ledger-sets.test.mjs 11). What stays here: Undo and
// Revoke only on what AIKit listed, Issue refused, AIKit's refusal in its words, Preview a reading.
test('10 · the rack\'s upkeep: Undo and Revoke only on what AIKit listed; Issue stays refused; Preview reads a plan and writes nothing', async () => {
  bind.resetHolds()
  const {ports, calls} = recorder(['write'])
  const binding = bind.rackBinding('factory:skillset', RACK_INPUT(), null, PLACE, upkeep(ports.write))
  assert.deepEqual(JSON.parse(binding.values.unused), pages.unusedOf(AIKIT.unused_trimmed.data))
  assert.deepEqual(JSON.parse(binding.values.roots), pages.rootsOf(AIKIT.collate_trimmed.data))
  assert.equal(binding.values.bypasses, '[]')
  assert.equal(JSON.parse(binding.values.procedures).length, AIKIT.procedure_list.data.count)
  assert.equal(binding.standing.adoption.disabled, bind.RACK_UPKEEP_ABSENT.adoption, 'no root chosen: no plan read')
  await binding.write([{key: 'procUndo', value: PROCEDURE}])
  assert.deepEqual(calls, [['write', {kind: 'procedure-undo', procedure: PROCEDURE}]])
  calls.length = 0
  await assert.rejects(binding.write([{key: 'procUndo', value: 'prc_not_listed'}]), /not in AIKit's list/)
  await assert.rejects(binding.write([{key: 'revoke', value: 'byp_1'}]), /not in AIKit's list/)
  await assert.rejects(binding.write([{key: 'issue', value: 'x'}]), {message: bind.RACK_UPKEEP_REFUSE.issue})
  assert.deepEqual(calls, [], 'nothing unlisted or unrouted reached AIKit')
  const listed = bind.rackBinding('factory:skillset', RACK_INPUT(), null, PLACE, {...upkeep(ports.write), bypasses: answered({bypasses: [{id: 'byp_1', scope: 'session', reason: 'probe', state: 'active'}]})})
  await listed.write([{key: 'revoke', value: 'byp_1'}])
  assert.deepEqual(calls, [['write', {kind: 'bypass-revoke', id: 'byp_1'}]])
  const carrierless = bind.rackBinding('factory:skillset', RACK_INPUT(), null, PLACE, upkeep())
  for (const key of ['procUndo', 'revoke', 'sync', 'adoptApply', 'procRun']) assert.match(carrierless.standing[key].disabled, /carrier is unavailable/)
  const aikitSays = 'aikit: the procedure journal is locked'
  assert.equal(bind.rackBinding('factory:skillset', RACK_INPUT(), null, PLACE, {...upkeep(ports.write), procedures: refused(aikitSays)}).standing.procedures.disabled, aikitSays)
  await binding.write([{key: 'adoptPreview', value: '@claude'}])
  assert.equal(bind.rackBinding('factory:skillset', RACK_INPUT(), null, PLACE).values.adoptRoot, '@claude')
  assert.deepEqual(calls.slice(1), [], 'Preview wrote nothing')
  bind.resetHolds()
})

test('11 · the member: Why and History of the chosen member on AIKit\'s explain and history; nothing chosen, nothing read; Retire and Restore refused', () => {
  bind.resetHolds()
  const chosen = EXPLAIN.explain.id
  const binding = bind.memberBinding(bind.MEMBER_DEVICE_ID, {}, chosen, bind.chainHolds(), {why: answered(EXPLAIN.explain), history: answered(EXPLAIN.history), timezone: 'Europe/London'})
  assert.deepEqual(JSON.parse(binding.values.why), pages.whyOf(EXPLAIN.explain))
  assert.deepEqual(JSON.parse(binding.values.history), pages.historyOf(EXPLAIN.history, 'Europe/London'))
  assert.equal(binding.standing.why, undefined)
  assert.equal(binding.standing.history, undefined)
  const nothing = bind.memberBinding(bind.MEMBER_DEVICE_ID, {}, null, bind.chainHolds(), {why: answered(EXPLAIN.explain), history: answered(EXPLAIN.history)})
  assert.equal(nothing.values.why, undefined, 'no member chosen: no Why')
  assert.equal(nothing.standing.why.disabled, bind.MEMBER_UPKEEP_ABSENT.why)
  const aikitSays = 'aikit: no capability skill/x'
  assert.equal(bind.memberBinding(bind.MEMBER_DEVICE_ID, {}, chosen, bind.chainHolds(), {why: refused(aikitSays)}).standing.why.disabled, aikitSays)
  for (const key of ['retire', 'restore']) assert.match(binding.standing[key].disabled, /PERSON_ACTS names it not/)
  assert.match(binding.standing.ground.disabled, /missing op: a tie from an AIKit capability ref to its ground path/)
})

// ------------------------------------------------------------------------------------------------------------- drawn, and classified

function bound() {
  bind.resetHolds()
  bind.holdView(pads.PROMPT_PADS_ID, 'pad', 3)
  const {ports} = recorder(['write', 'revoke'])
  return [
    [padsDesign, pads.promptPadsBinding(padsInput({bank: answered(bankWith(3, PAD))}), {write: ports.write}), /Sweep the manual|Morning NOWs|blake3:9f2c41d07a/, [pads.PADS_REFUSE.press]],
    [padsDesign, pads.promptPadsBinding(padsInput(), {write: ports.write}), /Sweep the manual|Morning NOWs|blake3:9f2c41d07a/, [pads.PADS_REFUSE.press]],
    [custodyDesign, custody({}, {revoke: ports.revoke, personNow: () => PERSON}), /flint-ql-20261014|Archetypal-Earth/, []],
    [custodyDesign, custody({person: null, grants: undefined}), /flint-ql-20261014|Archetypal-Earth/, []],
    [rackDesign, bind.rackBinding('factory:skillset', RACK_INPUT(), null, PLACE, upkeep(ports.write)), /prc_01M29MA279X5V519PSFXT0K3WV|b3:91d04c2e7a/, []],
    [memberDesign, bind.memberBinding(bind.MEMBER_DEVICE_ID, {}, EXPLAIN.explain.id, bind.chainHolds(), {why: answered(EXPLAIN.explain), history: answered(EXPLAIN.history), timezone: 'Europe/London'}),
      /2 Oct 09:14|r6 reviewed and trusted/, []],
    [agentDesign, bind.agentBinding(bind.AGENT_DESIGN, agentInput({context: {pressure: answered(AIKIT.pressure.data), commands: answered(AIKIT.commands.data)}}), {}, async () => ({kind: 'refused', reason: 'x'}), () => false),
      /Flint|47 \/ 60|Critical: standing guidance/, []],
  ]
}

test('12 · the rebound designs draw in all their views — no NaN, no undefined, never their fixture text — each refusal drawn as why', () => {
  host.resetHost()
  for (const [design, binding, fixture, reasons] of bound()) {
    const drawn = hosted(design, binding)
    for (const [view, markup] of drawn) {
      assert.match(markup, new RegExp(`data-device-view="${view}"`), `${design.id} ${view} draws`)
      assert.doesNotMatch(markup, /\bNaN\b|undefined/, `${design.id} ${view}: no absent key drawn as text`)
      assert.doesNotMatch(markup, /data-device-fault/, `${design.id} ${view}: its own view drew`)
      assert.doesNotMatch(markup, fixture, `${design.id} ${view}: its fixture never stands in`)
    }
    const all = drawn.map(([, markup]) => markup).join('\n')
    for (const why of reasons) assert.ok(all.includes(escaped(why)), `${design.id}: a refused control says why (${why.slice(0, 50)}…)`)
  }
  bind.resetHolds()
  host.resetHost()
})

test('13 · (b) every key the rebound designs read is an owner reading, absent with why, or the hand\'s', () => {
  for (const [design, binding] of bound()) for (const key of designKeys(design)) {
    if (design.id === custodyDesign.id && key === 'writeMode') continue // Scope's own key (custodyBinding stands it on Scope's standing)
    if (design.id === agentDesign.id && !key.startsWith('ctx.')) continue // the Agent's other keys: factory-design-binding.test.mjs
    if (design.id === rackDesign.id && !['unused', 'sources', 'roots', 'adoption', 'procedures', 'bypasses', ...bind.RACK_UPKEEP_SETTINGS].includes(key)) continue // the rack's own: factory-design-binding
    if (design.id === memberDesign.id && !['why', 'history', 'ground', 'retireReason', 'retireAsk', 'restoreAsk', 'event'].includes(key)) continue // the member's own: factory-design-binding
    assert.ok(classify(binding, key) || written(binding, key), `${design.id} ${key}: a reading, absent with why, the hand's, or written through its owner`)
  }
  // The manual (§19.22): no pad keeps a time. A pad that runs by itself is a routine in Settings, Automations, so the design draws no
  // Runs at, At, Days or Every, and no key of it stands only as an owner write.
  const [[, chosen]] = bound()
  assert.deepEqual(designKeys(padsDesign).filter(key => !classify(chosen, key) && written(chosen, key)), [], 'the pads keep no time of their own')
  bind.resetHolds()
})
