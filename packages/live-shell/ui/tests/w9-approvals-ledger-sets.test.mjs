// Lane W9: Factory's Approvals — Changes in the thread's words through Central's return_comment, and Factory's unit decisions answered as the
// person through Central's receiving Review of the question Factory put to Central; the Ledger's Waiting, Commented, Approved and Refused
// from Central's source returns; Messages' groups with Central's join; the Agentset rack's Join and Custody's settings, each refused naming
// exactly what is missing.
//
// Channels:
// - REAL (read-only, 21 Oct): Central's agent sets (`central.agent-set.list`, tests/fixtures/central-agent-sets-2026-10-21.json: none carries a
//   join, because the installed ctrl predates Central PR 291).
// - FAKE, each in its owner's own shape (read from the owner's source, since no real instance exists on this machine): a Factory Run reading
//   with unit decisions (factory/src/build.rs HumanRequestRecord, run_lifecycle.rs UnitDecisionBasis, attempt_runtime.rs
//   OwnerOperationReceipt, attempt_native_receiving.rs QUESTION_CALL — Central's root state holds no human request); a decision reading
//   (factory.attempt-unit-decision-reading/v1); source returns with `comments` (Central PR 290 adds the count to each entry); agent-set
//   records with `join` (Central PR 291). Every write goes to a recording port or a fake kernel; nothing is written to Factory or Central.
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
const bind = await import('../src/agent/devices/designBindings.ts')
const rec = await import('../src/agent/devices/receiptBindings.ts')
const units = await import('../src/agent/devices/unitDecisions.ts')
const session = await import('../src/agent/devices/sessionChainBindings.ts')
const msg = await import('../src/agent/devices/messagesBinding.ts')
const comment = await import('../src/central/devices/sourceReturnComment.ts')
const {design: approvalsDesign} = await import('../src/inhabitants/catalogue/panels/software-factory__approvals.tsx')
const {design: ledgerDesign} = await import('../src/inhabitants/catalogue/panels/software-factory__ledger.tsx')
const {design: agentsetDesign} = await import('../src/inhabitants/catalogue/panels/software-factory__agentset-rack.tsx')
const {skills: rackDesign} = await import('../src/inhabitants/catalogue/panels/skills.tsx')
const carry = await import('../src/agent/devices/oneAgentBinding.ts')
const settings = await import('../src/agent/sessionSettings.ts')
const addresses = await import('../src/inhabitants/agentParamAddresses.ts')
const door = await import('../src/frame/devices/deviceDoor.ts')
const rail = await import('../src/widgets/railBindings.ts')

family.resetFamilyManifestsForTest()
loadAgentShellFamilies()

const json = path => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'))
const read = path => readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8')
const escaped = text => text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const hosted = (designed, binding) => host.viewsOf(designed).map(view => [view, renderToStaticMarkup(createElement(host.HostedDevice, {designed, binding, view, nav: {}}))])
const SETS = json('./fixtures/central-agent-sets-2026-10-21.json')
/** AIKit's own answers on a scratch Arriving world (REAL; the kernel's owner-route fixture, the world's folder written /w/Arriving). */
const SETUP_AIKIT = json('../../../../desktop/cradle/kernel/tests/fixtures/owner-routes/aikit-setup-harnesses-credentials-2026-10-28.json')

const PERSON = 'central:source:control:root:Control/user/identity'
const STATE = '/Users/admin/Central/Work/O-I/.factory/development-state.json'
const RUN = 'run:01K8F00000000000000000000A'
const QUESTION_REF = 'central:return:project:O-I:7f3a9c'
const BASIS = (over = {}) => ({workflowUnitRef: 'unit:type-check', attemptRef: 'attempt:1', executionRef: 'execution:1', subjectRef: 'subject:1', subjectRevision: 'r1',
  workflowSourceRef: 'workflow:w', workflowSourceRevision: 'r1', workflowSourceDigest: 'd', resolverRef: PERSON, controlled: false, ...over})
const REQUEST = (ref, over = {}) => ({runRef: RUN, humanRequestRef: ref, decisionRef: `decision:${ref}`, question: `Resume the bounded work of ${ref}?`, whyHuman: 'The unit stopped at a gate.',
  blockedExecutionRefs: [], unitDecisionBasis: BASIS(), evidenceRefs: [], ...over})
/** The Run's retained call for a question Factory put to Central (attempt_native_receiving.rs: phase observed, payload.centralResponse). */
const CALL = (ref, returnRef) => ({ownerRef: 'factory', contract: units.QUESTION_CALL, operationRef: `factory-unit-decision:${ref}`, receiptRef: 'factory-unit-decision-call:x',
  sourceRevision: 'rev:1', phase: 'observed', evidenceRefs: [returnRef], partialEffectRefs: [], payload: {requestDigest: 'x', centralResponse: {ok: true, data: {schema: 'central.receiving-reading/v1', return_ref: returnRef, revision: 'rev:1'}}}})
const RUN_READING = {contract: 'factory.run-reading/v1', runRef: RUN, lifecycle: 'running', humanRequests: [
  REQUEST('hr:asked'),
  REQUEST('hr:unasked'),
  REQUEST('hr:answered', {unitDecisionResponse: {responseRef: 'r', resolverRef: PERSON, channelReceiptRef: QUESTION_REF, sourceRevision: 'rev:2', outcome: 'resume', evidenceRefs: [], controlled: false}}),
  REQUEST('hr:retired', {unitDecisionRetirement: {reason: 'replaced', replacementBasisRefs: [], observedProviderRevision: 3}}),
  {runRef: RUN, humanRequestRef: 'hr:plain', decisionRef: 'd', question: 'A plain human request', whyHuman: 'w', blockedExecutionRefs: [], evidenceRefs: []},
  REQUEST('hr:someone', {unitDecisionBasis: BASIS({resolverRef: 'central:source:control:root:Control/user/someone-else'})}),
], nativeAttempts: {contract: 'factory.attempt-reading/v1', attempts: [{attemptRef: 'attempt:1', observations: [CALL('hr:asked', QUESTION_REF), CALL('hr:someone', 'central:return:control:root:aa11'),
  {...CALL('hr:unasked', 'central:return:project:O-I:never'), phase: 'dispatching'}]}]}}
/** Factory's decision reading of a question (factory.attempt-unit-decision-reading/v1), Central's record as it stands. */
const DECISION = (status = 'pending', answered = false) => ({contract: units.DECISION_READING, runRef: RUN, humanRequestRef: 'hr:asked', nativeRequest: {},
  centralResponse: {ok: true, data: {schema: 'central.receiving-reading/v1', return_ref: QUESTION_REF, revision: 'rev:7', record: {status, received_at_unix_seconds: 1_792_600_000}}},
  decisionResponse: answered ? {outcome: 'resume'} : null, unresolved: answered ? null : 'native question has no answer from this affected unit\'s authenticated resolver'})
const READ = (standings = {'hr:asked': {standing: units.questionStanding(DECISION())}, 'hr:someone': {standing: units.questionStanding(DECISION())}}) =>
  ({decisions: units.pendingUnitDecisions(STATE, RUN_READING), standings})
const SHOWN = {sessionRef: 'agent-session/flint', agentName: 'Flint', agentRef: 'agent/flint', purpose: 'Type-check the roots'}

function recorder(names) {
  const calls = []
  return {calls, ports: Object.fromEntries(names.map(name => [name, async (...args) => { calls.push([name, ...args]); return {} }]))}
}
function fakeKernel(answer) {
  const ops = []
  const was = globalThis.fetch
  globalThis.fetch = async (url, init) => { const op = JSON.parse(init.body); ops.push(op); return {json: async () => answer(op)} }
  return {transport: {kind: 'bridge', url: 'http://fake-kernel.test'}, ops, restore: () => { globalThis.fetch = was }}
}
const approvals = (over = {}, ports = {}) => rec.approvalsBinding({session: SHOWN, encounter: null, holds: bind.chainHolds(), returns: {entries: []},
  nowUnixMs: 1_792_600_090_000, units: READ(), person: PERSON, ...over}, ports)

// ------------------------------------------------------------------------------------------------------------- unit decisions

test('1 · unit decisions: Factory\'s waiting ones (a basis, no response, no retirement) with the Central return its submission made, where the Run retains the call', () => {
  const pending = units.pendingUnitDecisions(STATE, RUN_READING)
  assert.deepEqual(pending.map(item => item.humanRequestRef), ['hr:asked', 'hr:unasked', 'hr:someone'], 'answered, retired and plain requests do not wait')
  assert.deepEqual(pending[0], {statePath: STATE, runRef: RUN, humanRequestRef: 'hr:asked', question: 'Resume the bounded work of hr:asked?', unit: 'unit:type-check', resolverRef: PERSON, receivingRef: QUESTION_REF})
  assert.equal(pending[1].receivingRef, undefined, 'a call still dispatching names no Central return')
  assert.deepEqual(units.questionStanding(DECISION()), {revision: 'rev:7', status: 'pending', receivedAt: 1_792_600_000, answered: false})
  assert.equal(units.questionStanding(DECISION('answered', true)).answered, true)
  assert.equal(units.questionStanding({contract: 'other'}), null)
  assert.equal(units.returnProject(QUESTION_REF), 'O-I')
  assert.equal(units.returnProject('central:return:control:root:aa11'), null)
  assert.equal(units.returnProject('nonsense'), undefined)
  // The queue: each waiting decision a request, its question, its unit, the shown session's agent, how long it has stood in Central.
  const rows = units.unitRows(READ(), SHOWN, 1_792_600_090_000)
  assert.deepEqual(rows[0], {id: 'hr:asked', kind: 'request', text: 'Resume the bounded work of hr:asked?', where: 'unit:type-check', options: {allowOnce: 'Resume bounded work', deny: 'Cancel bounded work'},
    who: 'Flint', session: 'Type-check the roots', age: 90}, 'with its two answers in Factory\'s words (#757)')
  assert.equal(rows[1].age, undefined, 'a question not put to Central has stood nowhere: no age')
  const answered = READ({'hr:asked': {standing: units.questionStanding(DECISION('answered', true))}})
  assert.deepEqual(units.unitRows(answered, SHOWN, 1).map(row => row.id), ['hr:unasked', 'hr:someone'], 'an answered question leaves the lake')
  const binding = approvals()
  assert.deepEqual(JSON.parse(binding.values.queue).map(row => [row.id, row.kind]), [['hr:asked', 'request'], ['hr:unasked', 'request'], ['hr:someone', 'request']])
})

test('2 · Approve answers Resume and Deny answers Cancel, as the person, through Central\'s receiving Review of the question at the revision read', async () => {
  bind.resetHolds()
  const {ports, calls} = recorder(['answerUnit'])
  const binding = approvals({}, ports)
  for (const key of ['allowOnce', 'allowAlways', 'deny']) assert.equal(binding.standing[key], undefined, `${key}: judged at the press while a unit decision waits, though no conversation is observed`)
  await binding.write([{key: 'allowOnce', value: 'hr:asked'}])
  await binding.write([{key: 'deny', value: 'hr:asked'}])
  assert.deepEqual(calls, [
    ['answerUnit', 'O-I', {kind: 'review', return_ref: QUESTION_REF, expected_return_revision: 'rev:7', disposition: 'answered', answer: 'Resume bounded work'}],
    ['answerUnit', 'O-I', {kind: 'review', return_ref: QUESTION_REF, expected_return_revision: 'rev:7', disposition: 'answered', answer: 'Cancel bounded work'}]])
  calls.length = 0
  await assert.rejects(binding.write([{key: 'allowAlways', value: 'hr:asked'}]), /takes one answer, Resume or Cancel/)
  await assert.rejects(binding.write([{key: 'allowOnce', value: 'hr:unasked'}]), /has not put this question to Central yet.*retained RequestUnitDecision Action/)
  await assert.rejects(binding.write([{key: 'allowOnce', value: 'hr:someone'}]), /Only the unit's resolver answers it \(central:source:control:root:Control\/user\/someone-else\)/)
  await assert.rejects(approvals({person: null}, ports).write([{key: 'allowOnce', value: 'hr:asked'}]), /personal anchor has not named the person/)
  await assert.rejects(approvals({units: READ({'hr:asked': {standing: units.questionStanding(DECISION('answered'))}})}, ports).write([{key: 'deny', value: 'hr:asked'}]),
    /stands answered in Central, so it takes no answer/)
  await assert.rejects(approvals({units: READ({'hr:asked': {error: 'factory refused: the source is historical'}})}, ports).write([{key: 'allowOnce', value: 'hr:asked'}]),
    /the source is historical/)
  await assert.rejects(approvals({}, {}).write([{key: 'allowOnce', value: 'hr:asked'}]), /kernel carrier is unavailable/)
  assert.deepEqual(calls, [], 'nothing refused reached Central')
  // A consent request still goes through the session's conversation, and says so when none is observed.
  await assert.rejects(binding.write([{key: 'allowOnce', value: 'req-7'}]), /conversation is not read yet/)
  // With nothing waiting, the conversation's standing disables the answers as before.
  assert.match(approvals({units: null}).standing.allowOnce.disabled, /conversation is not read yet/)
})

test('3 · the chain reads the Runs the shown session\'s takes name, Factory\'s decision reading of each asked question, and answers through the kernel\'s receiving op', async () => {
  const kernel = fakeKernel(op => ({ok: true, outcome: op.op === 'factory_development_read' ? {result: 'factory_development_reading', data: RUN_READING}
    : {result: 'factory_development_reading', data: DECISION()}}))
  let got
  try { got = await units.readUnitDecisions(kernel.transport, [{statePath: STATE, runRef: RUN}]) } finally { kernel.restore() }
  assert.deepEqual(kernel.ops.map(op => op.op), ['factory_development_read', 'factory_owner', 'factory_owner'])
  assert.deepEqual(kernel.ops[0], {op: 'factory_development_read', state_path: STATE, read: 'run', subject: RUN})
  assert.deepEqual(kernel.ops[1], {op: 'factory_owner', request: {kind: 'attempt-decision-read', state_path: STATE, run_ref: RUN, human_request_ref: 'hr:asked', receiving_ref: QUESTION_REF}})
  assert.equal(got.standings['hr:asked'].standing.revision, 'rev:7')
  assert.equal(got.standings['hr:unasked'], undefined, 'no question in Central: nothing to read')
  // REPLACED (parity D-09): Approvals was composed by Factory's chain, published only while it stood; the rail claims its tile in every mode, so
  // the rail's publisher (AgentRailDevices.tsx) composes and publishes it in every mode, and the Main track draws that door entry.
  const view = read('agent/devices/AgentRailDevices.tsx')
  assert.match(view, /answerUnit: \(project, review\) => receiving\(transport, project, review\)/)
  assert.match(view, /const unitsRead = useUnitDecisions\(transport, unitRuns\)/)
  // REPLACED (O-I #740 lane B): SETTINGS_PROJECT ('O-I'); the shown session's own register (agent/worldScope.ts).
  assert.match(view, /useAttemptTakes\(transport, shownTrack \? \[shownTrack\.sessionRef\] : \[\], shownTrack\?\.project \?\? ROOT_REGISTER\)/)
  assert.doesNotMatch(read('agent/devices/unitDecisions.ts'), /attempt-decision-submit/, 'the desk never submits a question: the retained Action is the agent\'s')
})

// ------------------------------------------------------------------------------------------------------------------ Changes

test('4 · Changes: a comment on the waiting return in the words written in the thread, read at the press; the composer is cleared once Central keeps it', async () => {
  const minted = 1_792_300_000_000
  const PENDING = {return_ref: `central:return:project:o-i:${minted}000000-4242`, source_ref: 'central:source:project:O-I:ProjectCentral/docs/1-vision/dlw/DLW.md', basis_revision: 'r1',
    status: 'pending', agent_session_ref: 'agent-session/flint', current_revision: 'r1'}
  const sent = [], cleared = []
  const base = approvals({returns: {entries: [PENDING]}, units: null})
  assert.equal(base.standing.changes.disabled, rec.APPROVALS_REFUSE.changes, 'unwrapped: no comment hand')
  const wrap = words => comment.withReturnComments(base, {returns: {entries: [PENDING]}, comment: words}, {send: async (row, text) => { sent.push([row.return_ref, text]) }, after: () => cleared.push(true)})
  assert.match(wrap('  ').standing.changes.disabled, /say what to change in the thread first/)
  const written = wrap('Name the second source too.')
  assert.equal(written.standing.changes, undefined)
  await written.write([{key: 'changes', value: PENDING.return_ref}])
  assert.deepEqual(sent, [[PENDING.return_ref, 'Name the second source too.']])
  assert.deepEqual(cleared, [true])
  // REPLACED (parity D-09): Approvals was composed by Factory's chain, published only while it stood; the rail claims its tile in every mode, so
  // the rail's publisher (AgentRailDevices.tsx) composes and publishes it in every mode, and the Main track draws that door entry.
  const view = read('agent/devices/AgentRailDevices.tsx')
  // REPLACED (#725): the comment hand was the binding returned — it is laid under Notifications' readings now (§23.9: what an owner raises
  // waits in Approvals, under Requests; railBindings.ts withOwnerRequests), so the comment-wrapped binding is what that carry receives.
  // REPLACED (O-I #740 lane B, round four): `{returns, comment}` and the chain's register; the comment hand carries why none stand, and acts
  // in the row's own project.
  assert.match(view, /const commented = withReturnComments\(binding, \{returns: worldReturns\.returns, comment: agentDraft, absent: worldReturns\.absent\}, \{\n\s*send: \(row, words\) => commentSourceReturn\(transport, returnProjectOf\(row, null\), row, words, person\),\n\s*after: \(\) => \{ void agentWrite\?\.\(\[\{key: 'draft', value: ''\}\]\) \},/)
  assert.match(view, /withOwnerRequests\(commented, /)
  // The composer is the Agent's as the door holds it, where a session's chain stands its Agent.
  assert.match(view, /publishedDevice\(chainDeviceId\('agent'\)\)\?\.binding/)
  assert.match(view, /const agentDraft = typeof agentEntry\?\.values\.draft === 'string' \? agentEntry\.values\.draft : null/)
})

// ------------------------------------------------------------------------------------------------------------------ the Ledger

test('5 · the Ledger: Central\'s source returns as receipts — Waiting, Commented once a comment is kept, Approved, Refused — keyed by their ref', () => {
  const minted = 1_792_157_400_000
  const entry = (n, status, over = {}) => ({return_ref: `central:return:project:o-i:${minted + n}000000-1`, source_ref: `central:source:project:O-I:docs/${n}.md`, basis_revision: 'r1',
    status, agent_session_ref: 'agent-session/fx-aletheia', current_revision: 'r1', ...over})
  const entries = [entry(1, 'pending', {comments: 2}), entry(2, 'pending', {comments: 0}), entry(3, 'applying'), entry(4, 'accepted'), entry(5, 'rejected'), entry(6, 'withdrawn'),
    {...entry(7, 'pending'), return_ref: 'central:return:project:o-i:no-instant'}]
  const tracks = [{sessionRef: 'agent-session/fx-aletheia', agentName: 'aletheia'}]
  const rows = rec.returnReceiptRows(entries, tracks, 'Europe/London')
  // REPLACED (#757 part two): a return is keyed by its return_ref and carries no number; one whose ref names no instant stands with no
  // day or time, where it was left out for want of a number (w757-designs-what-the-build-found.test.mjs, the Ledger keyed by ref).
  assert.deepEqual(rows.map(row => [row.name, row.outcome]), [['docs/1.md', 'commented'], ['docs/2.md', 'waiting'], ['docs/3.md', 'waiting'], ['docs/4.md', 'approved'],
    ['docs/5.md', 'refused'], ['docs/6.md', undefined], ['docs/7.md', 'waiting']], 'every return stands; a status Central may add later says no outcome')
  assert.deepEqual(rows[0], {ref: entries[0].return_ref, name: 'docs/1.md', agent: 'aletheia', outcome: 'commented', day: '2026-10-16', time: '14:30', session: 'agent-session/fx-aletheia'})
  assert.deepEqual([rows[6].ref, rows[6].day, rows[6].time], ['central:return:project:o-i:no-instant', undefined, undefined], 'no instant: no day, no time, and still its ref')
  for (const row of rows) assert.ok(!('n' in row), 'a return carries no number')
  for (const row of rows) assert.ok(!('by' in row), 'who accepted is not in the list')
  // Through the Ledger's binding, beside the change horizon's receipts; Open log opens the return's session.
  const opened = []
  const ledger = rec.ledgerBinding({ground: GROUND, groundError: null, holds: bind.chainHolds(), returns: {entries}, tracks}, {openSession: ref => { opened.push(ref); return null }})
  const receipts = JSON.parse(ledger.values.receipts)
  assert.equal(receipts.filter(row => row.outcome === 'commented').length, 1)
  assert.equal(receipts.filter(row => row.outcome === 'landed').length, 1)
  // REPLACED (#757 part two): Open log goes by the receipt's ref, never the minted instant.
  return ledger.write([{key: 'openLog', value: entries[0].return_ref}]).then(() => assert.deepEqual(opened, ['agent-session/fx-aletheia']))
})
// The change carries its change_ref, as every SourceChange does (source_horizon.rs:118; read on 28 Oct: `central:change:project:O-I:481`).
const GROUND = {sources: {state: 'ready', data: {schema: 'central.source-change-horizon/v1', changes: [{change_ref: 'central:change:control:root:831', cursor: 831, source_path: 'Control/agents/now/day/2026-10-16.md', kind: 'modified',
  observed_at_unix_seconds: 1792157400, actor: 'agent:aletheia', actor_kind: 'agent', agent_session_ref: 'agent-session/fx-aletheia'}]}},
  time: {state: 'ready', data: {civil_date: '2026-10-16', policy: {timezone: 'Europe/London'}}}}

test('6 · the rail reads the project\'s returns for the Ledger, and the kernel\'s returns entry is the one place `comments` can be lost', () => {
  const rail = read('agent/devices/AgentRailDevices.tsx')
  // REPLACED (lane K0): the chosen receipt's session's usage rides along (actuation_read {usage-list}).
  assert.match(rail, /ledgerBinding\(\{ground: ground\.reading, groundError: ground\.error, holds, returns: returned, tracks, usage\}, \{openSession\}\)/)
  // The kernel's returns entry (desktop/cradle/kernel/src/flow.rs SourceReturnEntry) passes on only the fields it names: where it does not
  // carry `comments`, a commented return reads as Waiting — true (it waits), only less exact.
  assert.equal(rec.returnReceiptRows([{return_ref: 'central:return:project:o-i:1792157400000000000-1', source_ref: 'central:source:project:O-I:a.md', basis_revision: 'r',
    status: 'pending', agent_session_ref: 's', current_revision: 'r'}], [], 'Europe/London')[0].outcome, 'waiting')
})

// ------------------------------------------------------------------------------------------------------- groups, sets and custody

test('7 · Messages\' groups carry the join Central\'s set names, and none where it names none or an unknown one', () => {
  const record = (ref, join) => ({record: {schema: 'central.agent-set/v1', ref, revision: 'r1', members: [{kind: 'agent', agent_ref: 'agent/kite'}], ...(join === undefined ? {} : {join})}})
  const groups = msg.groupsOf([{scope: 'root', value: {records: [record('docs-crew', 'quorum'), record('plain-set'), record('odd-crew', 'sometimes')]}}], null)
  assert.deepEqual(groups.map(group => [group.name, group.join]), [['docs-crew', 'quorum'], ['plain-set', undefined], ['odd-crew', undefined]])
  assert.deepEqual(msg.SET_JOINS, ['none', 'all', 'first', 'quorum', 'weighted'])
  const real = msg.groupsOf([{scope: 'root', value: SETS.root}], null)
  assert.ok(real.length > 0)
  for (const group of real) assert.ok(!('join' in group), `${group.name}: the installed ctrl predates join; none is invented`)
})

// REPLACED (O-I ticket 684): "its group is an AIKit session space with no join, and no reading ties it to a Central set" — AIKit's space now
// names the set it runs (`agent_set`), and the rack reads and saves that set's join (tests/agentset-join.test.mjs). A group whose space names
// no set still says so, and names the act that ties one.
test('8 · the Agentset rack\'s Join: a group whose space names no Central set says so and names the act that ties one; Custody\'s settings name what an assignment from here lacks and the owner\'s ruling', async () => {
  bind.resetHolds()
  const rack = session.agentsetBinding({group: null, tracks: null, holds: bind.chainHolds()})
  assert.equal(rack.standing.join.disabled, session.JOIN_UNTIED)
  assert.match(rack.standing.join.disabled, /bind-agent-set/)
  await assert.rejects(rack.write([{key: 'join', value: 'quorum'}]), /no carrier|names no Central agent set/)
  const custody = session.custodyBinding({sessionRef: 's', agent: {light: 'lit'}, holds: bind.chainHolds()}, null)
  // REPLACED (O-I 787): Factory's `--autonomy` is no setting the desk assigns: the Agent's Autonomy is retired (§19.4, §19.12).
  await assert.rejects(custody.write([{key: 'autonomy', value: 'auto'}]), {message: session.AGENT_AUTONOMY_RETIRED})
  for (const [key, flag] of [['gate', '--review-gate diffs|approvals|both'], ['escalate', '--escalate-to']]) {
    // REPLACED (lane W11): with no custody read handed in, the setting says so; the ruling stands on an assigned work
    // (w11-custody-turn-thought-settings.test.mjs).
    assert.ok(custody.standing[key].disabled.includes(`\`factory development custody assign ${flag}\``), key)
    assert.match(custody.standing[key].disabled, /custody list is not read here for this session/, key)
    await assert.rejects(custody.write([{key, value: 'auto'}]), {message: session.CUSTODY_REFUSE[key]})
  }
  assert.equal(session.CUSTODY_SETTINGS_RULING, 'Changing it after assignment waits for the owner\'s ruling on who may: `custody update` admits only the holding occupant, and Factory names no person authority for custody.')
})

// ------------------------------------------------------------------------------------------------------------------ drawn

test('9 · the designs draw on these bindings in all their views — no NaN, no undefined, never their fixture text — each refusal drawn as why', () => {
  bind.resetHolds()
  host.resetHost()
  const minted = 1_792_157_400_000
  const entries = [{return_ref: `central:return:project:o-i:${minted}000000-1`, source_ref: 'central:source:project:O-I:docs/a.md', basis_revision: 'r1', status: 'pending',
    agent_session_ref: 'agent-session/fx-aletheia', current_revision: 'r1', comments: 1}]
  const cases = [
    [approvalsDesign, approvals(), /setModel|Kite|recursive delete/, []],
    [ledgerDesign, rec.ledgerBinding({ground: GROUND, groundError: null, holds: bind.chainHolds(), returns: {entries}, tracks: []}, {openSession: () => null}),
      /re-plan port|Cairn|review #482|fixtures\/handoff|drop old captures/, []],
    [agentsetDesign, session.agentsetBinding({group: null, tracks: null, holds: bind.chainHolds()}), /oi-guardians/, [session.JOIN_UNTIED]], // REPLACED (O-I ticket 684): the untied group's words
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
    for (const why of reasons) assert.ok(all.includes(escaped(why)), `${design.id}: a refused control says why (${why.slice(0, 50)}…)`)
  }
  const ledgerAll = hosted(ledgerDesign, cases[1][1]).map(([, markup]) => markup).join('\n')
  assert.match(ledgerAll, /Commented/, 'the commented receipt is drawn in its word')
  bind.resetHolds()
  host.resetHost()
})

test('10 · the rack\'s procedure chosen carries its kind and digest from AIKit\'s own diff of it (REAL `aikit procedure diff`); the others stand by their ids', async () => {
  const pages = await import('../src/agent/devices/aikitPages.ts')
  const DIFF = json('./fixtures/aikit-procedure-diff-2026-10-21.json').data
  assert.deepEqual(pages.procedureDiffOf(DIFF), {id: DIFF.procedure, kind: 'tools-projection', digest: DIFF.digest})
  assert.equal(pages.procedureDiffOf({procedure: 'x'}), null, 'no digest: not a diff')
  bind.resetHolds()
  const answered = value => ({status: 'answered', value, error: null})
  const input = {profile: null, sets: {}, setList: null, skills: null, capabilities: null, profiles: null, holds: bind.chainHolds()}
  const binding = bind.rackBinding('factory:skillset', input, null, {project: 'O-I', sessionRef: null},
    {procedures: answered({count: 2, procedures: [DIFF.procedure, 'prc_other']}), procedure: answered(DIFF)})
  assert.deepEqual(JSON.parse(binding.values.procedures), [{id: DIFF.procedure, kind: 'tools-projection', digest: DIFF.digest}, {id: 'prc_other'}])
  const view = read('agent/devices/FactoryDeviceChain.tsx')
  assert.match(view, /useAikitRead\(transport, rackOn && chosenProcedure \? \{kind: 'procedure-diff', procedure: chosenProcedure\} : null\)/)
})

test('11 · the rack rebound on the kernel\'s round (cdbde6fe7): Sources from AIKit\'s source list (REAL, ai-kit#542 built); Sync, Promote, Rollback on a listed source; Apply at the reviewed plan\'s digest; Run at the chosen procedure\'s digest (REAL diff)', async () => {
  const pages = await import('../src/agent/devices/aikitPages.ts')
  const LIST = JSON.parse(readFileSync(new URL('../../../../desktop/cradle/kernel/tests/fixtures/owner-routes/aikit-source-list-2026-10-21.json', import.meta.url), 'utf8')).list.data
  const SHOW = json('./fixtures/aikit-source-show-2026-10-21.json').data
  const DIFF = json('./fixtures/aikit-procedure-diff-2026-10-21.json').data
  const first = LIST.sources[0]
  assert.deepEqual(pages.sourcesOf(LIST)[0], {id: first.id, kind: first.kind, skills: first.active_skills, retired: first.active_retired_skills, active: first.active_snapshot,
    candidate: first.candidate_snapshot, ground: false, rejected: 0}, 'no rollback point: none named')
  assert.equal(pages.sourcesOf({sources: [SHOW]})[0].rollback, SHOW.rollback_points[0], 'the latest promoted snapshot to return to')
  assert.equal(pages.sourcesOf({nothing: true}), null)
  bind.resetHolds()
  const answered = value => ({status: 'answered', value, error: null})
  const input = {profile: null, sets: {}, setList: null, skills: null, capabilities: null, profiles: null, holds: bind.chainHolds()}
  const place = {project: 'O-I', sessionRef: null}
  const calls = []
  const write = async request => { calls.push(request) }
  // REPLACED (#738): the plan is AIKit's own (REAL `aikit adopt ROOT --namespace claude`, test 12), never the design's shape handed in.
  const PLAN = SETUP_AIKIT.adopt_plan.data
  const binding = bind.rackBinding('factory:skillset', input, null, place, {sources: answered({sources: [...LIST.sources, SHOW], unreadable: []}),
    procedures: answered({count: 1, procedures: [DIFF.procedure]}), procedure: answered(DIFF), adoption: answered(PLAN), write})
  assert.equal(JSON.parse(binding.values.sources).length, LIST.sources.length + 1)
  for (const key of ['sync', 'promote', 'rollback', 'adoptApply', 'procRun']) assert.equal(binding.standing[key], undefined, `${key} stands`)
  await binding.write([{key: 'sync', value: first.id}])
  await binding.write([{key: 'promote', value: first.id}])
  await binding.write([{key: 'rollback', value: SHOW.id}])
  await binding.write([{key: 'adoptApply', value: PLAN.review_digest}])
  await binding.write([{key: 'procRun', value: `${DIFF.procedure}@${DIFF.digest}`}])
  assert.deepEqual(calls, [{kind: 'source-sync', id: first.id}, {kind: 'source-promote', id: first.id}, {kind: 'source-rollback', id: SHOW.id},
    {kind: 'adopt', root: PLAN.source, namespace: 'claude', expect_digest: PLAN.review_digest}, {kind: 'procedure-run', procedure: DIFF.procedure, expect_digest: DIFF.digest}])
  calls.length = 0
  await assert.rejects(binding.write([{key: 'rollback', value: first.id}]), /names no earlier promoted snapshot/)
  await assert.rejects(binding.write([{key: 'sync', value: 'source:not-listed'}]), /not in AIKit's list/)
  await assert.rejects(binding.write([{key: 'adoptApply', value: PLAN.digest}]), /plan changed since you reviewed it/)
  await assert.rejects(binding.write([{key: 'procRun', value: `${DIFF.procedure}@0000`}]), /not the one AIKit's diff names now/)
  await assert.rejects(binding.write([{key: 'procRun', value: `prc_other@${DIFF.digest}`}]), /not the one AIKit's diff names now/)
  assert.deepEqual(calls, [], 'nothing unlisted or unreviewed reached AIKit')
  const bare = bind.rackBinding('factory:skillset', input, null, place, {sources: {status: 'refused', value: null, error: 'error: unrecognized subcommand \'list\''}, write})
  for (const key of ['sync', 'promote', 'rollback']) assert.equal(bare.standing[key].disabled, 'error: unrecognized subcommand \'list\'', `${key}: the installed AIKit\'s own refusal`)
  assert.match(bare.standing.procRun.disabled, /choose a procedure first/)
  assert.equal(bare.standing.adoptApply.disabled, bind.RACK_UPKEEP_ABSENT.adoption)
  const view = read('agent/devices/FactoryDeviceChain.tsx')
  assert.match(view, /useAikitRead\(transport, rackOn \? \{kind: 'source-list'\} : null\)/)
  bind.resetHolds()
})

test('12 · the rack\'s Adopt page reads AIKit\'s own plan (REAL `aikit adopt ROOT --namespace claude`), the one reading Setup adopts by: the design\'s digest is the review digest `--expect-digest` takes, never the Procedure\'s; its items are the capsules; a root chosen by AIKit\'s label is asked by its path', async () => {
  const adoption = await import('../src/settings/aikitAdoption.ts')
  const PLAN = SETUP_AIKIT.adopt_plan.data, COLLATE = SETUP_AIKIT.collate_all.data
  assert.notEqual(PLAN.review_digest, PLAN.digest, 'AIKit names two digests: the review a confirmation binds, and the saved Procedure\'s own')
  assert.deepEqual(adoption.aikitAdoptionPlan(PLAN), {source: '/w/Arriving/.claude/skills', namespace: 'claude', capsules: ['skill/claude/field-recording-log', 'skill/claude/weekly-review'],
    reviewDigest: PLAN.review_digest})
  assert.equal(adoption.aikitAdoptionPlan(SETUP_AIKIT.adopt_applied.data), null, 'an applied adoption is no plan to confirm')
  assert.equal(adoption.aikitAdoptionPlan({root: '@claude', namespace: 'claude', digest: 'b3:plan-1', items: [{name: 'x', act: 'adopt'}]}), null, 'the design\'s shape is not AIKit\'s plan')
  assert.deepEqual(adoption.aikitAdoptRequest(adoption.aikitAdoptionPlan(PLAN)), {kind: 'adopt', root: PLAN.source, namespace: 'claude', expect_digest: PLAN.review_digest})
  for (const path of ['agent/devices/designBindings.ts', 'settings/windowPages.ts']) {
    assert.match(read(path), /import \{[^}]*\baikitAdoptionPlan\b[^}]*\} from '(\.\.\/\.\.\/settings|\.)\/aikitAdoption'/, `${path} reads the plan through the one reading`)
    assert.doesNotMatch(read(path), /review_digest/, `${path} interprets no plan field of its own`)
  }
  bind.resetHolds()
  const id = 'factory:skillset', place = {project: 'O-I', sessionRef: null}
  const answered = value => ({status: 'answered', value, error: null})
  const input = () => ({profile: null, sets: {}, setList: null, skills: null, capabilities: null, profiles: null, holds: bind.chainHolds()})
  const calls = []
  const write = async request => { calls.push(request) }
  // The design's Root chooser offers AIKit's labels (collate's where[].root); Preview holds the path `aikit adopt` takes, shown by its label.
  const chooser = bind.rackBinding(id, input(), null, place, {collate: answered(COLLATE), write})
  assert.deepEqual(JSON.parse(chooser.values.roots).map(row => [row.root, row.path]), [['@claude', '/w/Arriving/.claude/skills']])
  await chooser.write([{key: 'adoptPreview', value: '@claude'}])
  assert.equal(bind.viewHolds(bind.chainHolds(), id).adoptRoot, '/w/Arriving/.claude/skills', 'the chain asks AIKit\'s plan for the path')
  chooser.local.adoptRoot('@claude')
  assert.equal(bind.viewHolds(bind.chainHolds(), id).adoptRoot, '/w/Arriving/.claude/skills', 'the chooser holds the path too')
  const binding = bind.rackBinding(id, input(), null, place, {collate: answered(COLLATE), adoption: answered(PLAN), write})
  assert.equal(binding.values.adoptRoot, '@claude', 'shown by its label, as the chooser offers it')
  const shown = JSON.parse(binding.values.adoption)
  assert.deepEqual(shown, {root: '@claude', namespace: 'claude', digest: PLAN.review_digest,
    items: [{name: 'field-recording-log', act: 'adopt'}, {name: 'weekly-review', act: 'adopt'}]})
  assert.equal(shown.root, binding.values.adoptRoot, 'the design\'s plan is for the root chosen (skills.tsx planFor)')
  assert.equal(binding.standing.adoptApply, undefined, 'Apply stands on the plan read')
  await assert.rejects(binding.write([{key: 'adoptApply', value: PLAN.digest}]), /plan changed since you reviewed it/, 'the Procedure\'s digest is not the review AIKit binds')
  assert.deepEqual(calls, [])
  await binding.write([{key: 'adoptApply', value: shown.digest}])
  assert.deepEqual(calls, [{kind: 'adopt', root: '/w/Arriving/.claude/skills', namespace: 'claude', expect_digest: PLAN.review_digest}], 'the press the design makes is the confirmation AIKit takes')
  // A refusal of the plan stands as AIKit said it; Apply waits on a plan.
  const refused = bind.rackBinding(id, input(), null, place, {collate: answered(COLLATE), adoption: {status: 'refused', value: null, error: SETUP_AIKIT.adopt_plan_again.error.message}, write})
  assert.equal(refused.standing.adoptApply.disabled, SETUP_AIKIT.adopt_plan_again.error.message)
  bind.resetHolds()
})

// ------------------------------------------------------------------------------------------------------------- Refining a skill (O-I 795, 772)
// REAL (4 Nov, read-only on a scratch home: HOME and AIKIT_HOME under the lane's scratch, a directory source `practice` of two skills, one
// proposed revision of alpha): the AIKit of ai-kit dlw/787-tool-calls with round 12's `aikit source refine list|accept|discard --json`, each
// envelope's data verbatim; `refused` is AIKit's error for an Accept with no proposal standing.
const REFINE = {"list":{"proposals":[{"in_use":{"revision":"17b13b207706e82b242cce82bb471583e936c27bcbda2ba185735d7083456d39","snapshot":"075dd30e948941b09837f1312d99b3156f8ff3060c25c94388766800f9c19f1e"},"member":"skill/practice/alpha","owner":"aikit","proposed":{"revision":"a6083a4ed48c7932393db08c811e94f673dd176a176e62c4a6e6c0ec47387ec9","snapshot":"c9b0543ad046c9dd83799292b336c314accc0ecb22b733ef43c8ead2c9f49c5f"},"proposed_at_unix_seconds":1793802303,"source":"practice","stale":false,"tests":[],"why":[{"reason":"Not met: the plan names each gate by its command","task_ref":"task:plan-release"}]}]},"accept":{"active_snapshot":"c9b0543ad046c9dd83799292b336c314accc0ecb22b733ef43c8ead2c9f49c5f","member":"skill/practice/alpha","revision":"a6083a4ed48c7932393db08c811e94f673dd176a176e62c4a6e6c0ec47387ec9","rollback_to":"075dd30e948941b09837f1312d99b3156f8ff3060c25c94388766800f9c19f1e","source":"practice","user_scope":{"audited":[],"generation":"gen_7dec11c8996ec52e","replaced":"gen_387ae565d46cca0d","skill_roots":[]}},"discard":{"discarded":"skill/practice/beta","in_use":"c9b0543ad046c9dd83799292b336c314accc0ecb22b733ef43c8ead2c9f49c5f","snapshot":"622477d34f332f2f0c5aab3c423e57c11c2b20341adac0b083cbbc92df362338","source":"practice"},"refused":{"code":"refinement.none","details":{},"message":"no proposed revision of `skill/practice/beta` stands"}}
const RACK = 'factory:skillset'
const ALPHA = 'skill/practice/alpha'
/** A proposal of the REAL listing, changed only where a case needs it (FAKE beyond the listing: a take kept as its test, a Central owner, a
 * stale draft). */
const proposal = (over = {}) => ({...REFINE.list.proposals[0], ...over})
const refining = (proposals, ports = {}, over = {}) => bind.refiningBinding(RACK, {refinements: {status: 'answered', value: {proposals}, error: null}, set: 'docs',
  holds: bind.chainHolds(), ...over}, ports)

test('13 · Refining reads AIKit\'s proposals (REAL): the member beside the revision in use, why, its takes, and Result Open for each level, with why', () => {
  bind.resetHolds()
  const read = bind.refinementsOf(REFINE.list)
  assert.equal(read.length, 1)
  assert.deepEqual([read[0].member, read[0].owner, read[0].stale], [ALPHA, 'aikit', false])
  assert.equal(read[0].proposed.revision, REFINE.list.proposals[0].proposed.revision)
  assert.equal(read[0].inUse.revision, REFINE.list.proposals[0].in_use.revision)
  assert.equal(bind.refinementsOf({nope: true}), null, 'what is not AIKit\'s listing is no reading')
  const binding = refining(REFINE.list.proposals)
  assert.equal(binding.values.member, ALPHA, 'the first proposal stands chosen')
  assert.deepEqual(JSON.parse(binding.values.proposals).map(row => row.id), [ALPHA])
  assert.deepEqual(JSON.parse(binding.values.why), [{task: 'task:plan-release', reason: 'Not met: the plan names each gate by its command'}])
  assert.equal(binding.values.revision, REFINE.list.proposals[0].proposed.revision)
  assert.equal(binding.values.inUse, REFINE.list.proposals[0].in_use.revision)
  assert.equal(binding.values.levels, `docs+${ALPHA} · docs`, 'the Repeat\'s two levels: the set with the proposed revision, beside the set as it stands')
  // No take ran under it yet: every level reads Open, saying why.
  assert.deepEqual(JSON.parse(binding.values.test), [])
  const untested = JSON.parse(binding.values.result)
  assert.ok(untested.length >= 1 && untested.every(row => row.proposed === 'open' && row.inUse === 'open'), binding.values.result)
  assert.equal(binding.values.resultWhy, bind.RESULT_WHY.untested)
  // REPLACED (O-I 795, round 13): "AIKit keeps no Success conditions, so Result stays Open". A take kept as its test, beside its family,
  // with what each take answered to the task's Success conditions (FAKE beyond the listing: shaped as ai-kit skill_sources.rs
  // RefinementTest serializes, `answers` by trace, each answer as Actuation held it to its evidence): Result reads each condition at each
  // level, Return's rule across a level's takes (§19.1: not met if one is not met, open if one is open, met when all are met).
  const GATES = 'The plan names each gate by its command', ORDER = 'The plan keeps the release order'
  const answers = {
    'takes:own:5:trial:0': [{condition: GATES, answer: 'met', evidence: ['file plan.md (d-plan)'], why: 'plan.md names them'},
      {condition: ORDER, answer: 'open', evidence: [], why: 'Open: the take answered met but named no evidence it kept'}],
    'takes:own:5:trial:1': [{condition: GATES, answer: 'not met', evidence: ['the task\'s own test: not met (exit 1)'], why: 'Held to the task\'s own test, which answered not met'},
      {condition: ORDER, answer: 'met', evidence: ['file plan.md (d-plan)']}]}
  const tested = refining([proposal({tests: [{trace: 'takes:own:5:trial:0', beside: ['takes:own:5:trial:1'], answers}]})])
  assert.deepEqual(JSON.parse(tested.values.test), [{trace: 'takes:own:5:trial:0', level: 'proposed'}, {trace: 'takes:own:5:trial:1', level: 'in use'}])
  const rows = JSON.parse(tested.values.result)
  assert.deepEqual(rows.map(row => [row.condition, row.proposed, row.inUse]), [[GATES, 'met', 'not met'], [ORDER, 'open', 'met']])
  assert.match(rows[0].evidence, /proposed: file plan\.md \(d-plan\).*in use: the task's own test: not met/)
  assert.equal(rows[1].why, 'Open: the take answered met but named no evidence it kept', 'an Open row says why, in the reading\'s words')
  assert.equal(tested.values.resultWhy, bind.RESULT_WHY.answered(2))
  // Takes that ran while the task had no Success conditions: Result is Open, and says where they are added.
  const bare = refining([proposal({tests: [{trace: 'takes:own:5:trial:0', beside: ['takes:own:5:trial:1']}]})])
  assert.equal(bare.values.resultWhy, bind.RESULT_WHY.noConditions)
  assert.match(bind.RESULT_WHY.noConditions, /Intent panel/)
  // AIKit's refusal is drawn in its words; nothing stands chosen.
  const refused = bind.refiningBinding(RACK, {refinements: {status: 'refused', value: null, error: REFINE.refused.message}, set: 'docs', holds: bind.chainHolds()}, {})
  assert.equal(refused.standing.proposals.disabled, REFINE.refused.message)
  assert.equal(refused.values.member, undefined)
  bind.resetHolds()
})

test('13 · Accept and Discard are AIKit\'s own verbs on the member; Test runs the task\'s own Repeat over Skillset; each refuses in words', async () => {
  bind.resetHolds()
  const calls = []
  const ports = {write: async request => { calls.push(['write', request]) }, test: async (set, member) => { calls.push(['test', set, member]); return {ok: true, note: 'made'} }}
  const binding = refining(REFINE.list.proposals, ports)
  for (const key of ['accept', 'discard', 'run']) assert.equal(binding.standing?.[key], undefined, `${key} stands`)
  await binding.write([{key: 'accept', value: ALPHA}])
  await binding.write([{key: 'discard', value: ALPHA}])
  await binding.write([{key: 'run', value: true}])
  assert.deepEqual(calls, [['write', {kind: 'refinement-accept', member: ALPHA}], ['write', {kind: 'refinement-discard', member: ALPHA}], ['test', 'docs', ALPHA]])
  await assert.rejects(binding.write([{key: 'accept', value: 'skill/practice/beta'}]), /no proposed revision of skill\/practice\/beta/)
  // The member chosen is the hand's own hold.
  binding.local.member(ALPHA)
  assert.equal(bind.viewHolds(bind.chainHolds(), RACK).refineMember, ALPHA)
  // REPLACED (O-I 795 round 13): "Central keeps a Control skill's source: Accept is Central's, and says so" — Accept hands it to Central
  // now (AIKit's own verb, ai-kit skill_sources.rs accept_revision), which keeps it for the person's Accept there (test 17).
  // REPLACED (O-I 795 round 14): with AIKit's verbs alone, Accept handed a Control skill's revision and stopped there. The person's one
  // Accept hands it, writes it in Central and has AIKit follow (test 17), so it stands where a hand to Central does, and says so where none.
  const central = refining([proposal({owner: 'central'})], {...ports, central: async () => {}})
  assert.equal(central.standing.accept, undefined, 'Accept hands a Control skill\'s revision to Central and writes it there')
  assert.match(refining([proposal({owner: 'central'})], ports).standing.accept.disabled, /no hand carries it to Central here/)
  // A stale draft is not accepted.
  const stale = refining([proposal({stale: true})], ports)
  assert.match(stale.standing.accept.disabled, /no longer in use/)
  // No carrier, no set on the chain, no session: each says what it lacks.
  const none = refining(REFINE.list.proposals, {})
  assert.match(none.standing.accept.disabled, /aikit_write/)
  assert.match(none.standing.run.disabled, /session/)
  const noSet = refining(REFINE.list.proposals, ports, {set: null})
  assert.match(noSet.standing.run.disabled, /set/)
  // A Test AIKit or Actuation refuses comes back in its words.
  const refusedTest = refining(REFINE.list.proposals, {...ports, test: async () => ({ok: false, error: settings.TAKES_WHY.notRepeat})})
  await assert.rejects(refusedTest.write([{key: 'run', value: true}]), new RegExp(settings.TAKES_WHY.notRepeat.slice(0, 40)))
  bind.resetHolds()
})

test('13 · the Test is the session\'s own Repeat: its Variable Skillset, its Levels the set with the proposed revision beside the set; makeTakes runs it', () => {
  const task = {task_ref: 'task:plan-release', name: 'Plan the release', launch: 'repeat', repeat_variable: 'condition', repeat_levels: []}
  assert.deepEqual(settings.refinementRepeat(task, 'docs', ALPHA),
    {change: {task: {task_ref: 'task:plan-release', set: {repeat_variable: 'skillset', repeat_levels: [`docs+${ALPHA}`, 'docs']}}}})
  assert.deepEqual(settings.refinementRepeat(null, 'docs', ALPHA), {refused: settings.SETTINGS_WHY.noTask})
  const source = read('agent/sessionSettings.ts')
  assert.match(source, /export async function testRefinement\([^)]*\)[^{]*\{[\s\S]*?await writeSessionSettings\([\s\S]*?return makeTakes\(transport, project, agentSession, takeRunOf\(/, 'the same runner')
  const chain = read('agent/devices/FactoryDeviceChain.tsx')
  assert.match(chain, /const rackRefinements = useAikitRead\(transport, \{kind: 'refinement-list'\}\)/)
  assert.match(chain, /testRefinement\(transport, rackProject, sessionRef, set, member\)/)
  // O-I 795 round 13: offered on every session's chain the rack stands on, a group's (its head session's own Repeat) and a lone one's
  // alike — never gated on the lone session's Capture page.
  assert.match(chain, /\.\.\.\(sessionChain && sessionRef && transport\.kind !== 'unavailable' \? \{test: \(set: string, member: string\) => testRefinement/)
})

test('14 · the Skillset rack\'s Refining page stands beside Capture with §19.7\'s Member, Why, Revision, Test, Result, Accept and Discard, on its binding in every view', () => {
  bind.resetHolds()
  host.resetHost()
  for (const key of ['member', 'proposals', 'why', 'revision', 'inUse', 'test', 'result', 'resultWhy', 'levels']) assert.ok(`refine.${key}` in rackDesign.defaults, `the rack carries refine.${key}`)
  const rack = bind.rackBinding(RACK, {profile: null, sets: {}, setList: null, skills: null, capabilities: null, profiles: null, holds: bind.chainHolds()}, null, {project: 'O-I', sessionRef: null})
  const binding = carry.carryPages(rack, [{page: carry.REFINE_PAGE, binding: refining(REFINE.list.proposals)}])
  host.setHostPage(binding.id, 'refine')
  const drawn = hosted(rackDesign, binding)
  host.resetHost()
  for (const [view, markup] of drawn) {
    assert.doesNotMatch(markup, /\bNaN\b|undefined/, `${view}: no absent key drawn as text`)
    assert.doesNotMatch(markup, /data-device-fault/, `${view}: its own view drew`)
  }
  const whole = drawn.find(([view]) => view === 'whole')[1]
  for (const label of ['Set', 'Capture', 'Refining']) assert.match(whole, new RegExp(`>${label}<`), `the ${label} page`)
  for (const label of ['Member', 'Why', 'Revision', 'Test', 'Result', 'Accept', 'Discard']) assert.ok(whole.includes(label), `Refining draws ${label}`)
  assert.ok(whole.includes(escaped('Not met: the plan names each gate by its command')), 'the reason, in the close\'s words')
  assert.ok(whole.includes(escaped(bind.RESULT_WHY.untested)), 'Result says why it is Open')
  // Declared to the device law: one owning address for each of the page's parameters (§14).
  for (const key of ['refine.member', 'refine.why', 'refine.revision', 'refine.test', 'refine.result', 'refine.discard']) {
    const row = addresses.agentAddress('skillset', key)
    assert.equal(row?.family, 'ai-kit', key)
  }
  // REPLACED (O-I 795 round 14): refine.accept was ai-kit's at kernel:aikit_write. The person's Accept of a Control skill's revision is
  // Central's own act (control.skills.revision.accept, through invoke_action); AIKit's verbs hand it there and follow it.
  assert.equal(addresses.agentAddress('skillset', 'refine.accept').family, 'central')
  assert.equal(addresses.agentAddress('skillset', 'refine.accept').writePath, 'kernel:invoke_action')
  assert.equal(addresses.agentAddress('skillset', 'refine.why').writePath, undefined, 'a reading')
  bind.resetHolds()
})

test('15 · Approvals: a proposed revision waits as a proposal with its Result for each condition; Accept and Discard are the Refining page\'s own AIKit verbs', async () => {
  bind.resetHolds()
  const refinements = {status: 'answered', value: REFINE.list, error: null}
  const calls = []
  const binding = approvals({refinements, nowUnixMs: (REFINE.list.proposals[0].proposed_at_unix_seconds + 600) * 1000}, {refine: async request => { calls.push(request) }})
  const queue = JSON.parse(binding.values.queue)
  const row = queue.find(item => item.refinement)
  assert.ok(row, 'the refinement waits in the queue')
  assert.equal(row.kind, 'proposal')
  assert.equal(row.where, ALPHA)
  assert.equal(row.age, 600)
  assert.equal(row.refinement.revision, REFINE.list.proposals[0].proposed.revision)
  assert.ok(row.refinement.result.every(level => level.proposed === 'open' && level.inUse === 'open'))
  assert.equal(row.refinement.resultWhy, bind.RESULT_WHY.untested)
  await binding.write([{key: 'refineAccept', value: row.id}])
  await binding.write([{key: 'refineDiscard', value: row.id}])
  assert.deepEqual(calls, [{kind: 'refinement-accept', member: ALPHA}, {kind: 'refinement-discard', member: ALPHA}])
  await assert.rejects(binding.write([{key: 'refineAccept', value: 'refine:skill/practice/gone'}]), /no proposed revision/)
  const unwired = approvals({refinements})
  assert.match(unwired.standing.refineAccept.disabled, /aikit_write/)
  // REPLACED (O-I 795 round 13): "Central keeps … missing op: AIKit handing its proposed revision to Central's
  // control.skills.revision.propose (AIKit)": AIKit's Accept hands it to Central now, and the person's Accept there writes it (test 17).
  // REPLACED (O-I 795 round 14): an Accept with no hand to Central handed it and stopped there. The person's one Accept hands it, writes it
  // in Central and has AIKit follow, so where no hand carries it to Central, Accept says so and nothing is asked.
  const handedTo = []
  const central = approvals({refinements: {status: 'answered', value: {proposals: [proposal({owner: 'central'})]}, error: null}}, {refine: async request => { handedTo.push(request) }})
  await assert.rejects(central.write([{key: 'refineAccept', value: `refine:${ALPHA}`}]), /no hand carries it to Central here/)
  assert.deepEqual(handedTo, [])
  // The design answers it with Accept and Discard, and draws its Result.
  host.setHostPage(binding.id, 'review')
  const drawn = hosted(approvalsDesign, {...binding, values: {...binding.values, pick: row.id}})
  host.resetHost()
  const all = drawn.map(([, markup]) => markup).join('\n')
  assert.match(all, />Accept</)
  assert.match(all, />Discard</)
  assert.doesNotMatch(all, /\bNaN\b|undefined/)
  // The gallery (the manual's Part Three) shows it too: a fixture with a refinement waiting, drawn with its Result and its answers.
  const shown = approvalsDesign.fixtures?.['A skill refinement']
  assert.ok(shown, 'the gallery carries a refinement waiting')
  const fixtureRow = JSON.parse(shown.queue).find(item => item.id === shown.pick)
  assert.ok(fixtureRow?.refinement?.result?.length, 'with its Result for each condition')
  host.setHostPage('gallery:approvals', 'review')
  const galleryDrawn = hosted(approvalsDesign, {id: 'gallery:approvals', values: {...approvalsDesign.defaults, ...shown}, standing: {}, write: async () => {}})
  host.resetHost()
  const galleryAll = galleryDrawn.map(([, markup]) => markup).join('\n')
  assert.match(galleryAll, />Accept</)
  assert.match(galleryAll, /aria-label="Result"/)
  // REPLACED (parity D-09): Approvals was composed by Factory's chain, published only while it stood; the rail claims its tile in every mode, so
  // the rail's publisher (AgentRailDevices.tsx) composes and publishes it in every mode, and the Main track draws that door entry.
  const chain = read('agent/devices/AgentRailDevices.tsx')
  assert.match(chain, /useAikitRead\(transport, REFINEMENT_LIST\)/)
  assert.match(chain, /\n\s+refinements, settings: shownSettings\}/)
  // Approvals is one device (§19.14): Central's Main track answers a refinement too, with the same AIKit read and the one write
  // (ownerRoutes.ts refinementWrite) the Refining page presses.
  const centralChain = read('central/devices/CentralDevices.tsx')
  assert.match(centralChain, /useAikitRead\(transport, \{kind: 'refinement-list'\}\)/)
  assert.match(centralChain, /refinements: (\w+)Refinements/)
  for (const source of [chain, centralChain]) assert.match(source, /refinementWrite\(transport\)/, 'one write for both chains')
  assert.match(centralChain, /\{refine: refineWrite\}/)
  bind.resetHolds()
})

// O-I 795 round 13: a Control skill's proposed revision is the person's to accept in Central. AIKit's Accept hands it there (ai-kit
// skill_sources.rs accept_revision → Central's control.skills.revision.propose), and its listing names where it waits (`handed`, FAKE in
// the REAL listing's shape); the person's Accept then writes it through Central's own act, at the digest reviewed, and Discard drops it
// from Central and from AIKit (ctrl control_skills.rs control.skills.revision.accept · discard, person's presses: action.rs PERSON_ACTS).
// O-I 795 round 14: the person's one Accept is enough. It hands the revision to Central where it is not yet handed, writes it there, and
// AIKit's source follows (`aikit source refine follow`: sync from Central and promote, with a receipt; ai-kit skill_sources.rs
// follow_revision), so nothing is left for the person to sync or promote. A revision Central already wrote is followed.
const HANDED = {revision_ref: 'central:skill-revision:k1', proposed_digest: 'sha256:d1', scope: 'control-user', name: 'alpha', accept_action: 'control.skills.revision.accept'}
const HANDED_READ = {revisionRef: HANDED.revision_ref, proposedDigest: HANDED.proposed_digest, scope: 'control-user', name: 'alpha', acceptAction: HANDED.accept_action}
test('17 · a Control skill\'s revision: Accept hands it to Central, where the person\'s Accept writes it and Discard drops it, from the Refining page and from Approvals', async () => {
  bind.resetHolds()
  const calls = []
  const ports = {write: async request => { calls.push(['aikit', request]) }, central: async (verb, handed) => { calls.push(['central', verb, handed]) }}
  // REPLACED (O-I 795 round 14): "Not yet handed: Accept is AIKit's own verb, which hands it to Central" and "Accept is the person's there,
  // then AIKit's copy goes" (refinement-discard). One Accept: AIKit hands it (its answer names where it waits), Central writes it, AIKit
  // follows.
  const handing = {...ports, write: async request => { calls.push(['aikit', request]); return {route: 'aikit source refine accept', data: request.kind === 'refinement-accept' ? {member: ALPHA, handed: HANDED} : {followed: ALPHA}} }}
  const fresh = refining([proposal({owner: 'central'})], handing)
  assert.equal(fresh.standing.accept, undefined)
  await fresh.write([{key: 'accept', value: ALPHA}])
  assert.deepEqual(calls.splice(0), [['aikit', {kind: 'refinement-accept', member: ALPHA}], ['central', 'accept', HANDED_READ], ['aikit', {kind: 'refinement-follow', member: ALPHA}]])
  // AIKit answering no hand: Central is not asked, in words.
  await assert.rejects(refining([proposal({owner: 'central'})], {...ports, write: async request => { calls.push(['aikit', request]); return {route: 'r', data: {member: ALPHA}} }})
    .write([{key: 'accept', value: ALPHA}]), /did not say where the revision of skill\/practice\/alpha waits in Central/)
  assert.deepEqual(calls.splice(0), [['aikit', {kind: 'refinement-accept', member: ALPHA}]])
  // Handed: it waits in Central, and the page says so; Accept writes it there, and AIKit follows.
  const waiting = refining([proposal({owner: 'central', handed: HANDED})], ports)
  assert.equal(waiting.standing.accept, undefined)
  assert.equal(waiting.values.handed, HANDED.revision_ref)
  await waiting.write([{key: 'accept', value: ALPHA}])
  assert.deepEqual(calls.splice(0), [['central', 'accept', HANDED_READ], ['aikit', {kind: 'refinement-follow', member: ALPHA}]])
  // Central wrote it already (an Accept whose follow was refused, pressed again): nothing waits there, and AIKit follows; AIKit judges
  // whether Central accepted it (refinement.central_not_accepted) and the follow's refusal comes back in its words.
  const written = refining([proposal({owner: 'central', handed: HANDED})], {...ports, central: async () => { throw Error('no proposed revision of alpha waits') }})
  await written.write([{key: 'accept', value: ALPHA}])
  assert.deepEqual(calls.splice(0), [['aikit', {kind: 'refinement-follow', member: ALPHA}]])
  const unfollowed = refining([proposal({owner: 'central', handed: HANDED})], {...ports, write: async request => { calls.push(['aikit', request]); throw Error('Central keeps sha256:d0 in use, not the revision handed') }})
  await assert.rejects(unfollowed.write([{key: 'accept', value: ALPHA}]), /not the revision handed/)
  assert.deepEqual(calls.splice(0), [['central', 'accept', HANDED_READ], ['aikit', {kind: 'refinement-follow', member: ALPHA}]])
  // Discard drops it in Central and in AIKit; a revision Central no longer keeps is dropped from AIKit alone.
  await waiting.write([{key: 'discard', value: ALPHA}])
  assert.deepEqual(calls.splice(0), [['central', 'discard', HANDED_READ], ['aikit', {kind: 'refinement-discard', member: ALPHA}]])
  const gone = refining([proposal({owner: 'central', handed: HANDED})], {...ports, central: async () => { throw Error('no proposed revision of alpha waits') }})
  await gone.write([{key: 'discard', value: ALPHA}])
  assert.deepEqual(calls.splice(0), [['aikit', {kind: 'refinement-discard', member: ALPHA}]])
  // Central's refusal of the Accept comes back in its words, and AIKit's copy stays.
  const stale = refining([proposal({owner: 'central', handed: HANDED})], {...ports, central: async () => { throw Error('alpha changed since the revision was proposed') }})
  await assert.rejects(stale.write([{key: 'accept', value: ALPHA}]), /changed since the revision was proposed/)
  assert.deepEqual(calls.splice(0), [])
  // No hand to Central: Accept and Discard say where the revision waits and what carries the person's act there; before it is handed,
  // Accept says Central keeps it, and Discard drops AIKit's proposal alone (nothing waits in Central).
  const unhanded = refining([proposal({owner: 'central', handed: HANDED})], {write: ports.write})
  for (const key of ['accept', 'discard']) {
    assert.match(unhanded.standing[key].disabled, /waits in Central \(central:skill-revision:k1\)[\s\S]*control\.skills\.revision\./)
  }
  const unhandedFresh = refining([proposal({owner: 'central'})], {write: ports.write})
  assert.match(unhandedFresh.standing.accept.disabled, /Central keeps[\s\S]*control\.skills\.revision\.accept[\s\S]*no hand carries it to Central here/)
  assert.equal(unhandedFresh.standing.discard, undefined)
  // Approvals answers it the same way.
  const app = approvals({refinements: {status: 'answered', value: {proposals: [proposal({owner: 'central', handed: HANDED})]}, error: null}},
    {refine: ports.write, refineCentral: ports.central})
  await app.write([{key: 'refineAccept', value: `refine:${ALPHA}`}])
  assert.deepEqual(calls.splice(0), [['central', 'accept', HANDED_READ], ['aikit', {kind: 'refinement-follow', member: ALPHA}]])
  // Central's own acts, through the kernel's invoke_action with the person's own authority, at the digest the person reviewed.
  const routes = read('agent/devices/ownerRoutes.ts')
  assert.match(routes, /accept: 'control\.skills\.revision\.accept', discard: 'control\.skills\.revision\.discard'/)
  assert.match(routes, /centralAct\(transport, CENTRAL_REVISION_ACTS\[verb\], \{scope: handed\.scope, name: handed\.name, expected_proposed_digest: handed\.proposedDigest\}\)/)
  // REPLACED (parity D-09): Approvals was composed by Factory's chain, published only while it stood; the rail claims its tile in every mode, so
  // the rail's publisher (AgentRailDevices.tsx) composes and publishes it in every mode, and the Main track draws that door entry.
  const chain = read('agent/devices/FactoryDeviceChain.tsx')
  const centralChain = read('central/devices/CentralDevices.tsx')
  assert.match(chain, /central: centralRevision/)
  for (const source of [read('agent/devices/AgentRailDevices.tsx'), centralChain]) assert.match(source, /refineCentral: centralRevision/)
  // The Refining page says where it waits.
  host.resetHost()
  const rack = bind.rackBinding(RACK, {profile: null, sets: {}, setList: null, skills: null, capabilities: null, profiles: null, holds: bind.chainHolds()}, null, {project: 'O-I', sessionRef: null})
  const page = carry.carryPages(rack, [{page: carry.REFINE_PAGE, binding: waiting}])
  host.setHostPage(page.id, 'refine')
  const whole = hosted(rackDesign, page).find(([view]) => view === 'whole')[1]
  host.resetHost()
  assert.ok(whole.includes(escaped('Central · waits for your Accept')), 'the source readout says it waits in Central')
  assert.ok(whole.includes(escaped(`It waits there as ${HANDED.revision_ref}.`)))
  bind.resetHolds()
})

// O-I 795 round 13: a refinement opens where it belongs (§19.14 "Open, which opens it where it belongs"; §18.2 "A pattern whose items point
// at one skill or method can open a refinement of it (§19.7)"): the Skillset rack's Refining page, the member chosen, from either chain.
test('16 · Open on a refinement goes to the Skillset rack\'s Refining page with its member chosen; where no chain stands the rack, Factory is turned to, or the press says where it stands', async () => {
  bind.resetHolds(); host.resetHost(); door.flipDevice(null); door.selectDevice(null)
  const RACK = bind.SKILLSET_RACK_ID
  assert.equal(RACK, 'factory:skillset')
  // No chain stands the rack here and no hand turns to Factory: the press says where the rack stands, and the page and member wait for it.
  assert.throws(() => bind.openRefinement(ALPHA), /stands on a session's chain in Factory/)
  assert.equal(bind.viewHolds(bind.chainHolds(), RACK).refineMember, ALPHA, 'the member is held for the rack')
  assert.equal(host.hostState(RACK).page, bind.REFINING_PAGE, 'the rack stands on its Refining page wherever it is drawn')
  // A hand that turns to Factory: the shell turns, and the rack's band opens once its chain puts it on the door.
  const turned = []
  bind.openRefinement(ALPHA, {toFactory: () => { turned.push('factory') }})
  assert.deepEqual(turned, ['factory'])
  assert.equal(door.flippedDeviceId(), null, 'no band stands for a rack no chain draws yet')
  door.publishDevice(RACK, {device: {id: RACK, family: 'ai-kit', face: {id: 'skillset-rack', title: 'Skillset rack'}}})
  assert.equal(door.flippedDeviceId(), RACK, 'its band opens when its chain stands it')
  assert.equal(door.selectedDeviceId(), RACK)
  // On the door already (a session's chain in Factory): its band opens now, and nothing turns.
  door.flipDevice(null)
  bind.openRefinement('skill/practice/beta', {toFactory: () => { turned.push('again') }})
  assert.deepEqual(turned, ['factory'], 'the shell stands where the rack is')
  assert.equal(door.flippedDeviceId(), RACK)
  assert.equal(bind.viewHolds(bind.chainHolds(), RACK).refineMember, 'skill/practice/beta')
  door.publishDevice(RACK, null); door.flipDevice(null); door.selectDevice(null)
  // Approvals' Open on a refinement row opens it there, through the chain's hand; then the queue holds it as opened.
  const refinements = {status: 'answered', value: REFINE.list, error: null}
  const opened = []
  const binding = approvals({refinements}, {refine: async () => {}, openRefinement: member => { opened.push(member) }})
  const row = JSON.parse(binding.values.queue).find(item => item.refinement)
  const held = {}
  const queued = rail.withOwnerRequests(binding, {ledger: {status: 'answered', value: {schema: 'central.notification-ledger/v1', requests: []}}}, async () => {},
    {opened: [], hold: ids => { held.opened = ids }})
  await queued.write([{key: 'open', value: row.id}])
  assert.deepEqual(opened, [ALPHA], 'Open opens the Refining page on its member')
  assert.deepEqual(held.opened, [row.id], 'and then it is held as opened')
  await assert.rejects(binding.write([{key: 'open', value: 'refine:skill/practice/gone'}]), /no proposed revision/)
  await assert.rejects(approvals({refinements}, {refine: async () => {}}).write([{key: 'open', value: row.id}]), /no hand opens the Skillset rack/)
  // Open on any other item marks it opened alone, as before.
  const plain = approvals({refinements, returns: {entries: [{return_ref: 'central:return:project:O-I:1', source_ref: 'central:source:project:O-I:docs/a.md', status: 'pending', agent_session_ref: 'agent-session/flint'}]}},
    {openRefinement: member => { opened.push(member) }})
  const other = rail.withOwnerRequests(plain, {ledger: {status: 'answered', value: {schema: 'central.notification-ledger/v1', requests: []}}}, async () => {},
    {opened: [], hold: ids => { held.opened = ids }})
  await other.write([{key: 'open', value: 'central:return:project:O-I:1'}])
  assert.deepEqual(held.opened, ['central:return:project:O-I:1'])
  assert.deepEqual(opened, [ALPHA], 'nothing else opens the Refining page')
  // Both chains hand it: Factory's opens it in place, Central's turns to Factory; the Day's Patterns pad takes the same hand.
  // REPLACED (parity D-09): Approvals was composed by Factory's chain, published only while it stood; the rail claims its tile in every mode, so
  // the rail's publisher (AgentRailDevices.tsx) composes and publishes it in every mode, and the Main track draws that door entry.
  const chain = read('agent/devices/AgentRailDevices.tsx')
  const centralChain = read('central/devices/CentralDevices.tsx')
  assert.match(chain, /openRefinement: member => openRefinement\(member\)/)
  assert.match(centralChain, /openRefinement: member => openRefinement\(member, \{toFactory\}\)/)
  assert.match(centralChain, /refine: member => openRefinement\(member, \{toFactory\}\)/)
  bind.resetHolds(); host.resetHost()
})
