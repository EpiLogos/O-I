import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'

// Factory's attempts as takes on their session's track (lock §9.1 Factory row: takes = attempts; manual §3: "Takes stack under a clip
// so you can choose the one that stands"). AIKit says which attempts a session's task serves (`encounter_task_attempts_list`), Factory
// says what each is (`factory_attempt_read`), and choosing one is Factory's own op (`factory_owner` attempt-receiving).
//
// Channels (each claim below is carried by exactly one):
// - FIXTURE: AIKit's readings in the shape of aikit.encounter-task-attempts-list/v1 and Factory's attempt records in the shape of
//   factory.attempt-reading/v1 (camelCase, as attempt_runtime.rs serialises them), the agency tracks through the run model's own
//   builders, as tests/factory-tracks.test.mjs builds them.
// - SCRIPTED: a kernel behind the bridge's fetch that answers each op from those fixtures and the receiving envelope the kernel's
//   own tests pin (kernel/src/factory_receiving.rs); the shared views rendered to static markup or pressed as stateless functions.
// No computer-use pass here; the native candidate's screen pass is recorded with the wave's evidence.
const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};
import {readFile} from 'node:fs/promises';
export async function resolve(specifier,context,next){
  try{return await next(specifier,context)}catch(error){
    if(!specifier.startsWith('.'))throw error;
    if(specifier.endsWith('.js')){try{return await next(specifier.slice(0,-3)+'.ts',context)}catch{}}
    for(const suffix of ['.ts','.tsx']){try{return await next(specifier+suffix,context)}catch{}}
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

globalThis.document = {getElementById: () => null, createElement: () => ({}), head: {appendChild: () => {}}}
const React = await import('react')
const {renderToStaticMarkup} = await import('react-dom/server')
const takes = await import('../src/agent/factoryTakes.ts')
const model = await import('../src/agent/agentRunModel.ts')
const factory = await import('../src/timeline/factoryTrackAdapter.ts')
const owner = await import('../src/owners/attemptTakes.ts')
const {ArrangementRulerView} = await import('../src/frame/tracks/ArrangementRuler.tsx')
const {answerOf} = await import('../src/frame/tracks/SessionGrid.tsx')
const lanes = await import('../src/frame/tracks/trackLanes.ts')

const noop = () => {}
const SELECT = {select() {}}
const RULER_VIEW = {window: null, onWindow: noop, snap: 'free', onSnap: noop, marker: null, onMarker: noop, width: 0}
const NOW = Date.UTC(2026, 9, 19, 12, 0, 0)
const at = minutesAgo => new Date(NOW - minutesAgo * 60_000).toISOString()

// ---------------------------------------------------------------------------------------------------------------- fixtures

const TASK = 'task:build-the-take-lanes'
const STATE = '/Users/test/Work/Factory/.factory/attempts.json'
const RUN = 'run:01ARZ3NDEKTSV4RRFFQ69G5FBD'
const unit = {workflow: 'workflow:build', unit: 'write-the-lanes'}
const served = attemptRef => ({task_ref: TASK, attempt_ref: attemptRef, run_ref: RUN, state_path: STATE, workflow_unit: unit,
  execution_ref: `execution:${attemptRef}`, delivery_ref: `delivery:${attemptRef}`, recorded_by: 'factory', recorded_at_unix_ms: NOW})
const listing = (...readings) => ({schema: 'aikit.encounter-task-attempts-list/v1', readings})
const reading = (session, attempts, extra = {}) => ({schema: 'aikit.encounter-task-attempts/v1', agent_session: session,
  revision: attempts.length ? 'task-attempts/ONE' : null, task_ref: TASK, attempts, earlier: [], ...extra})

// Factory's attempt records: one returned and chosen, one returned not yet chosen, one running, one failed, one prepared.
const record = (attemptRef, extra) => ({attemptRef, taskRef: TASK, workflowUnitRef: unit, reservedExecutionRef: `reserved:${attemptRef}`,
  failureEvidenceRefs: [], observations: [], verifications: [], ...extra})
const records = [
  record('attempt:A1', {attemptRecordedAt: at(50), executionRef: 'execution:attempt:A1', returnRecordedAt: at(35),
    readableReturn: {returnRef: 'return:A1', summary: 'Wrote the lanes.', receivingRef: 'receiving:R1', artifactRefs: [], evidenceRefs: []}}),
  record('attempt:A2', {attemptRecordedAt: at(30), executionRef: 'execution:attempt:A2', returnRecordedAt: at(20),
    readableReturn: {returnRef: 'return:A2', summary: 'Wrote them again.', artifactRefs: [], evidenceRefs: []}}),
  record('attempt:A3', {attemptRecordedAt: at(10), executionRef: 'execution:attempt:A3'}),
  record('attempt:A4', {attemptRecordedAt: at(55), executionRef: 'execution:attempt:A4', failureRecordedAt: at(52), failureEvidenceRefs: ['evidence:crash']}),
  record('attempt:A5', {attemptRecordedAt: at(2)}),
]
const attemptReading = {contract: 'factory.attempt-reading/v1', revision: 40, runRef: RUN, attempts: records}

// The agency tracks: a lone session `ses-lead` whose task serves the five attempts, and a helper that serves none.
const rows = [
  {spaceRef: 'space:port', spaceLabel: 'Port', sessionRef: 'ses-lead', purpose: 'build the take lanes', agentRef: 'agent:fizz'},
  {spaceRef: 'space:port', spaceLabel: 'Port', sessionRef: 'ses-helper', purpose: null, agentRef: null},
]
const axis = model.sharedAxis([], NOW)
const agencyTracks = () => model.buildTracks(rows, new Map([['agent:fizz', {name: 'Fizz', accepted: true}]])).map(track => track.group ? track : {
  ...track, tasks: [], needle: model.needleFor([], track.sessionRef, axis)})

const servedList = listing(
  reading('ses-lead', ['attempt:A1', 'attempt:A2', 'attempt:A3', 'attempt:A4', 'attempt:A5'].map(served)),
  reading('ses-helper', []),
  {agent_session: 'ses-elsewhere', refused: 'Canonical AgentSession is not attached to any retained SessionSpace'})

// ---------------------------------------------------------------------------------------------------------------- the model

test('AIKit\'s list and Factory\'s Run readings join into takes: each attempt\'s state, times and Return as its owner states them', () => {
  const servedMap = takes.servedBySession(servedList)
  assert.deepEqual([...servedMap.keys()], ['ses-lead', 'ses-helper'], 'a session the owner refused has nothing read, which is not "no takes"')
  assert.deepEqual(takes.runsOf(servedMap), [{statePath: STATE, runRef: RUN}], 'one Run read serves every attempt in it')
  const bySession = takes.takesBySession(servedMap, new Map([[takes.runKey(STATE, RUN), attemptReading]]))
  const lead = bySession.get('ses-lead')
  assert.deepEqual(lead.map(take => [take.attemptRef, take.state, take.receivingRef]), [
    ['attempt:A1', 'returned', 'receiving:R1'], ['attempt:A2', 'returned', null], ['attempt:A3', 'running', null],
    ['attempt:A4', 'failed', null], ['attempt:A5', 'prepared', null]])
  assert.equal(lead[0].summary, 'Wrote the lanes.')
  assert.equal(lead[0].startUnixMs, NOW - 50 * 60_000)
  assert.equal(lead[0].endUnixMs, NOW - 35 * 60_000, 'a returned take ends at its Return')
  assert.equal(lead[2].endUnixMs, null, 'a running take has no end')
  assert.equal(lead[3].endUnixMs, NOW - 52 * 60_000, 'a failed take ends at its failure')
  assert.equal(lead[0].unit, 'write-the-lanes', 'the unit in short words')
  assert.deepEqual(bySession.get('ses-helper'), [], 'a session whose task serves none has an empty set')
  assert.deepEqual([...takes.takeNames(lead).values()], ['write-the-lanes · take 1', 'write-the-lanes · take 2', 'write-the-lanes · take 3', 'write-the-lanes · take 4', 'write-the-lanes · take 5'])
  // Factory mints an opaque ref for a unit: the takes are then simply numbered, in the order served.
  const opaque = lead.map(take => ({...take, unit: takes.unitWords('workflow-unit:3C73CMWMP7956ZN0XFWD5FMFYW')}))
  assert.deepEqual([...takes.takeNames(opaque).values()], ['take 1', 'take 2', 'take 3', 'take 4', 'take 5'])
  assert.equal(takes.takeWords(lead[0]), 'returned and chosen (receiving:R1)')
  assert.equal(takes.takeWords(lead[1]), 'returned, not yet chosen')
})

test('an attempt Factory\'s reading does not hold, or a Run it did not read, is left out: a take is only drawn from what its owner says', () => {
  const servedMap = takes.servedBySession(listing(reading('ses-lead', [served('attempt:A1'), served('attempt:GONE')])))
  const bySession = takes.takesBySession(servedMap, new Map([[takes.runKey(STATE, RUN), attemptReading]]))
  assert.deepEqual(bySession.get('ses-lead').map(take => take.attemptRef), ['attempt:A1'])
  assert.deepEqual(takes.takesBySession(servedMap, new Map()).get('ses-lead'), [], 'a Run not read draws no take')
  // The tasks the session served before are disclosed by AIKit but are not this task's takes.
  const earlier = takes.servedBySession(listing(reading('ses-lead', [served('attempt:A1')], {earlier: [served('attempt:OLD')], task_ref: 'task:another'})))
  assert.deepEqual(earlier.get('ses-lead'), [], 'attempts of a task the session is no longer bound to are not on its track')
  assert.equal(takes.unitWords('workflow:build/unit:write'), 'write')
  assert.equal(takes.unitWords({reference: 'workflow:x:inspect'}), 'inspect')
  assert.equal(takes.unitWords(7), null, 'no ref, no words')
  assert.equal(takes.unitWords('workflow-unit:3C73CMWMP7956ZN0XFWD5FMFYW'), null, 'the identity Factory mints for a unit says nothing readable')
})

// ---------------------------------------------------------------------------------------------------------------- the adapter

const portOf = (bySession, chosen = []) => ({of: session => bySession.get(session) ?? null, choose: async take => { chosen.push(take.attemptRef); return {ok: true, note: `${take.attemptRef} chosen`} }})
const leadTakes = () => takes.takesBySession(takes.servedBySession(servedList), new Map([[takes.runKey(STATE, RUN), attemptReading]]))

test('each attempt is a take lane under its session\'s track, laid from admission to Return, the chosen one standing and shown on the main lane', () => {
  const set = factory.factoryTrackAdapter.project({tracks: agencyTracks(), nowUnixMs: NOW, takes: portOf(leadTakes())})
  const lead = set.tracks.find(track => track.kind === 'session' && track.name.startsWith('build the take lanes'))
  assert.equal(set.lanes.takes.length, 5, 'one lane per attempt; the helper serves none')
  assert.ok(set.lanes.takes.every(lane => lane.trackId === lead.id))
  const [first, second, running, failed, prepared] = set.lanes.takes
  assert.equal(first.id, `${lead.id}#take/attempt:A1`)
  assert.equal(first.name, 'write-the-lanes · take 1')
  assert.equal(first.standing, true, 'the take whose Return Central received stands')
  assert.equal(second.standing, undefined)
  const secs = ms => (ms - axis.startUnixMs) / 1000
  assert.deepEqual(first.spans, [{start: secs(NOW - 50 * 60_000), end: secs(NOW - 35 * 60_000), label: 'returned and chosen (receiving:R1)'}])
  assert.equal(running.spans[0].end, secs(axis.endUnixMs), 'a running take reaches the live edge')
  assert.equal(failed.spans[0].end, secs(NOW - 52 * 60_000))
  assert.deepEqual([prepared.spans[0].start, prepared.spans[0].end], [secs(NOW - 2 * 60_000), secs(NOW - 2 * 60_000)], 'a prepared take is a point')
  assert.deepEqual(set.lanes.comp, [{trackId: lead.id, takeId: first.id, start: first.spans[0].start, end: first.spans[0].end}], 'the main lane shows the take that stands')
  assert.equal(set.lanes.absent.takes, undefined, 'takes are read: nothing is said to be absent')
  assert.match(set.lanes.absent.automation, /missing op/, 'the other lanes keep their reasons')
})

test('an attempt whose owner disclosed no admission time has a lane with no stretch, never a guessed place on the ruler', () => {
  const noTime = {...records[0], attemptRecordedAt: undefined}
  const bySession = takes.takesBySession(takes.servedBySession(listing(reading('ses-lead', [served('attempt:A1')]))),
    new Map([[takes.runKey(STATE, RUN), {...attemptReading, attempts: [noTime]}]]))
  const set = factory.factoryTrackAdapter.project({tracks: agencyTracks(), nowUnixMs: NOW, takes: portOf(bySession)})
  assert.equal(set.lanes.takes.length, 1)
  assert.deepEqual(set.lanes.takes[0].spans, [])
  assert.deepEqual(set.lanes.comp, [], 'a take with no place has no stretch on the main lane either')
})

test('the lanes say why they are absent: unread with no port, nothing served with one', () => {
  const unread = factory.factoryTrackAdapter.project({tracks: agencyTracks(), nowUnixMs: NOW})
  assert.equal(unread.lanes.takes, undefined)
  assert.match(unread.lanes.absent.takes, /attempts are unread here.*encounter_task_attempts_list.*factory_attempt_read/)
  assert.equal(unread.actions?.comp, undefined, 'no port, no way to choose')
  const none = factory.factoryTrackAdapter.project({tracks: agencyTracks(), nowUnixMs: NOW, takes: portOf(new Map([['ses-lead', []]]))})
  assert.deepEqual(none.lanes.takes, [])
  assert.equal(none.lanes.absent.takes, factory.FACTORY_NO_ATTEMPTS)
  assert.match(none.lanes.absent.takes, /records each attempt it dispatches on the session's AIKit task/)
  // A session not yet read draws nothing; the port answers null.
  const unreadSession = factory.factoryTrackAdapter.project({tracks: agencyTracks(), nowUnixMs: NOW, takes: portOf(new Map())})
  assert.deepEqual(unreadSession.lanes.takes, [])
})

test('choosing a take is Factory\'s own op: the comp runs the choice with the attempt, whatever the stretch, and refuses an id the set does not hold', async () => {
  const chosen = []
  const set = factory.factoryTrackAdapter.project({tracks: agencyTracks(), nowUnixMs: NOW, takes: portOf(leadTakes(), chosen)})
  const comp = set.actions.comp
  assert.equal(comp.op, factory.FACTORY_CHOOSE_OP)
  assert.match(comp.op, /factory_owner attempt-receiving/)
  assert.match(comp.op, /receives a whole attempt/)
  const second = set.lanes.takes[1]
  assert.deepEqual(await answerOf(() => comp.run(second.trackId, second.id, {start: 1, end: 2})), {ok: true, text: 'attempt:A2 chosen'})
  assert.deepEqual(chosen, ['attempt:A2'])
  const refused = await answerOf(() => comp.run('x', 'x#take/attempt:NOPE', {start: 0, end: 1}))
  assert.deepEqual(refused, {ok: false, text: '"x#take/attempt:NOPE" is not an attempt of this work.'})
  assert.deepEqual(chosen, ['attempt:A2'], 'nothing reached the owner')
})

test('the Arrangement draws the take lanes with the one that stands marked, and Return on a take presses the choice', async () => {
  const chosen = []
  const set = factory.factoryTrackAdapter.project({tracks: agencyTracks(), nowUnixMs: NOW, takes: portOf(leadTakes(), chosen)})
  const markup = renderToStaticMarkup(React.createElement(ArrangementRulerView, {set, selection: SELECT, view: RULER_VIEW, receipt: null, onPress: noop, onDismiss: noop,
    lanes: {shown: lanes.DEFAULT_LANES, onShown: noop, take: null, onTake: noop, opened: null, onOpened: noop}}))
  assert.equal((markup.match(/class="tl-lane tl-take"/g) ?? []).length, 5)
  assert.match(markup, /data-take="[^"]*#take\/attempt:A1" data-standing="true"/, 'the chosen take is marked')
  assert.match(markup, /write-the-lanes · take 1/)
  assert.match(markup, /data-lanes="takes" aria-pressed="true" data-count="5"/)
  assert.match(markup, /class="tl-comp" data-comp-take="[^"]*#take\/attempt:A1"/, 'the main lane names the take each stretch came from')
  // A stretch dragged across a take and Return: the pane's press runs the choice.
  const presses = []
  const second = set.lanes.takes[1]
  const tree = ArrangementRulerView({set, selection: SELECT, view: RULER_VIEW, receipt: null, onPress: (key, what, run) => presses.push({key, what, run}), onDismiss: noop,
    lanes: {shown: lanes.DEFAULT_LANES, onShown: noop, take: {trackId: second.trackId, takeId: second.id, from: second.spans[0].start, to: second.spans[0].end}, onTake: noop, opened: null, onOpened: noop}})
  const find = (node, pred, out = []) => {
    if (Array.isArray(node)) { node.forEach(child => find(child, pred, out)); return out }
    if (!node || typeof node !== 'object' || !node.props) return out
    if (pred(node)) out.push(node)
    return find(node.props.children, pred, out)
  }
  const [body] = find(tree, node => node.props?.['aria-label'] === 'Take write-the-lanes · take 2')
  body.props.onKeyDown({key: 'Enter', preventDefault() {}})
  assert.equal(presses.length, 1)
  assert.deepEqual(await answerOf(presses[0].run), {ok: true, text: 'attempt:A2 chosen'})
  assert.deepEqual(chosen, ['attempt:A2'])
})

// ---------------------------------------------------------------------------------------------------------------- the owners

/** A scripted kernel behind the bridge: it answers AIKit's list and Factory's Run reading from the fixtures, and a receiving
 * from the envelope the kernel's own tests pin. It keeps every op it was sent. */
function scriptedKernel({list = servedList, attempts = attemptReading, receiving} = {}) {
  const kernel = {sent: []}
  globalThis.fetch = async (_url, init) => {
    const op = JSON.parse(init.body)
    kernel.sent.push(op)
    const answered = (result, data) => ({json: async () => ({ok: true, outcome: {result, data, receipts: []}})})
    const refused = error => ({json: async () => ({ok: false, error})})
    if (op.op === 'encounter_task_attempts_list') return list instanceof Error ? refused(list.message) : answered('encounter_task_attempts_list_reading', list)
    if (op.op === 'factory_attempt_read') return attempts instanceof Error ? refused(attempts.message) : answered('factory_attempt_reading', attempts)
    if (op.op === 'factory_owner' && op.request.kind === 'attempt-receiving') return receiving instanceof Error ? refused(receiving.message) : answered('factory_development_reading', receiving)
    return refused(`unexpected ${op.op}`)
  }
  return kernel
}
const transport = {kind: 'bridge', url: 'http://owner.test'}
const sessions = ['ses-lead', 'ses-helper', 'ses-elsewhere']

test('the hook\'s read asks AIKit once for every session, Factory once for each Run, and joins them', async () => {
  const kernel = scriptedKernel()
  const read = await owner.readAttemptTakes(op => globalThis.fetch(transport.url, {body: JSON.stringify(op)}).then(r => r.json()).then(r => r.ok ? {outcome: r.outcome} : {error: r.error}), 'O-I', sessions)
  assert.deepEqual(kernel.sent.map(op => op.op), ['encounter_task_attempts_list', 'factory_attempt_read'], 'one list read, one Run read for five attempts')
  assert.deepEqual(kernel.sent[0].agent_sessions, sessions)
  assert.deepEqual({state_path: kernel.sent[1].state_path, run_ref: kernel.sent[1].run_ref}, {state_path: STATE, run_ref: RUN})
  assert.equal(read.get('ses-lead').length, 5)
  assert.deepEqual(read.get('ses-helper'), [])
  assert.equal(read.has('ses-elsewhere'), false, 'a refused session has nothing read')
  // AIKit that does not answer is nothing read, not an empty set; a Run Factory does not read draws no take.
  scriptedKernel({list: new Error('AIKit SessionSpace is unavailable')})
  const call = op => globalThis.fetch(transport.url, {body: JSON.stringify(op)}).then(r => r.json()).then(r => r.ok ? {outcome: r.outcome} : {error: r.error})
  assert.equal(await owner.readAttemptTakes(call, 'O-I', sessions), null)
  scriptedKernel({attempts: new Error('Factory is unavailable')})
  assert.deepEqual((await owner.readAttemptTakes(call, 'O-I', sessions)).get('ses-lead'), [])
  assert.deepEqual([...(await owner.readAttemptTakes(call, 'O-I', [])).keys()], [], 'no sessions, no read')
})

const receiving = (status, extra = {}) => ({contract: 'oi.factory-attempt-receiving/v1', runRef: RUN, attemptRef: 'attempt:A2', status, changed: status !== 'refused',
  target: {sourceRef: 'central:source:flow-a', documentId: 'doc:flow-a', sourceRevision: 'rev:9', root: '/Users/test/Central'}, authorityRef: 'central:native-action-authority#human',
  receipt: {receivingRef: 'receiving:R2'}, refusal: null, ...extra})
const second = () => leadTakes().get('ses-lead')[1]

test('choosing sends the attempt alone: the kernel assembles the rest, and the owner\'s answer comes back in its words', async () => {
  const kernel = scriptedKernel({receiving: receiving('received')})
  const answer = await owner.chooseAttempt(transport, second())
  assert.equal(answer.ok, true)
  assert.match(answer.note, /^Chosen: this attempt's Return was proposed to Central's receiving field in the Flow doc:flow-a \(receiving:R2\)\.$/)
  assert.deepEqual(kernel.sent, [{op: 'factory_owner', request: {kind: 'attempt-receiving', state_path: STATE, run_ref: RUN, attempt_ref: 'attempt:A2'}}],
    'no grant, token, caller or target travels from the desk')
  scriptedKernel({receiving: receiving('already-received', {changed: false})})
  assert.match((await owner.chooseAttempt(transport, second())).note, /^Already chosen: Central holds this attempt's Return as receiving:R2/)
})

test('a refusal, an unconfirmed call and an unreachable owner each come back as a refusal in the owner\'s own words', async () => {
  scriptedKernel({receiving: receiving('refused', {changed: false, receipt: null, refusal: {source: 'driver', step: null,
    message: 'action not granted: the grant does not list central.receiving.submit.'}})})
  assert.deepEqual(await owner.chooseAttempt(transport, second()), {ok: false, error: 'action not granted: the grant does not list central.receiving.submit.'},
    'the driver\'s own refusal is shown in its words alone')
  scriptedKernel({receiving: receiving('refused', {changed: false, receipt: null, refusal: {source: 'owner', step: 'receiving', message: 'stale Factory state revision'}})})
  assert.deepEqual(await owner.chooseAttempt(transport, second()), {ok: false, error: 'The owner refused the choice: stale Factory state revision'})
  scriptedKernel({receiving: receiving('needs-reconciliation', {receipt: {replayed: false}})})
  assert.match((await owner.chooseAttempt(transport, second())).error, /Central's answer is not confirmed/)
  scriptedKernel({receiving: receiving('uncertain', {refusal: {source: 'owner', step: 'receiving', message: 'the owner did not answer in time', operationMayHaveRun: true}})})
  assert.match((await owner.chooseAttempt(transport, second())).error, /did not answer and may have run: the owner did not answer in time/)
  scriptedKernel({receiving: new Error('Factory owner request failed')})
  assert.deepEqual(await owner.chooseAttempt(transport, second()), {ok: false, error: 'Factory owner request failed'})
  // An answer about another attempt is not an answer to this press.
  scriptedKernel({receiving: receiving('received', {attemptRef: 'attempt:OTHER'})})
  assert.match((await owner.chooseAttempt(transport, second())).error, /did not answer this attempt's receiving/)
})
