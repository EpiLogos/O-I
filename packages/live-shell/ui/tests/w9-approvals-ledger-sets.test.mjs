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
  const view = read('agent/devices/FactoryDeviceChain.tsx')
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
  const view = read('agent/devices/FactoryDeviceChain.tsx')
  // REPLACED (#725): the comment hand was the binding returned — it is laid under Notifications' readings now (§23.9: what an owner raises
  // waits in Approvals, under Requests; railBindings.ts withOwnerRequests), so the comment-wrapped binding is what that carry receives.
  assert.match(view, /const commented = withReturnComments\(binding, \{returns: returned, comment: agentDraft\}, \{\n\s*send: \(row, words\) => commentSourceReturn\(transport, register, row, words, person\),\n\s*after: \(\) => \{ void agentWrite\?\.\(\[\{key: 'draft', value: ''\}\]\) \},/)
  assert.match(view, /return withOwnerRequests\(commented, /)
  assert.match(view, /const agentDraft = typeof oneAgent\?\.values\.draft === 'string' \? oneAgent\.values\.draft : null/)
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

test('8 · the Agentset rack\'s Join: its group is an AIKit session space with no join, and no reading ties it to a Central set; Custody\'s settings name what an assignment from here lacks and the owner\'s ruling', async () => {
  bind.resetHolds()
  const rack = session.agentsetBinding({group: null, tracks: null, holds: bind.chainHolds()})
  assert.match(rack.standing.join.disabled, /AIKit's team carries no join/)
  assert.match(rack.standing.join.disabled, /central\.agent-set\.save/)
  assert.match(rack.standing.join.disabled, /no reading says which set this group runs/)
  await assert.rejects(rack.write([{key: 'join', value: 'quorum'}]), {message: session.AGENTSET_REFUSE.join})
  const custody = session.custodyBinding({sessionRef: 's', autonomy: 'review', agent: {light: 'lit'}, holds: bind.chainHolds()}, null)
  for (const [key, flag] of [['autonomy', '--autonomy suggest|review|auto'], ['gate', '--review-gate diffs|approvals|both'], ['escalate', '--escalate-to']]) {
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
    [agentsetDesign, session.agentsetBinding({group: null, tracks: null, holds: bind.chainHolds()}), /oi-guardians/, [session.AGENTSET_REFUSE.join]],
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
