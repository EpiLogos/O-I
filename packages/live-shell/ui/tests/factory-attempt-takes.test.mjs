import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'

// Factory's attempts as takes on their session's track (lock §9.1 Factory row: takes = attempts; manual §3: "Takes stack under a clip
// so you can choose the one that stands"). On the track, the takes are the kernel's Factory Set (kernel mode_set.rs, O-I #1004), drawn
// through the one projection (frame/tracks/kernelSet.ts). For the devices, AIKit says which attempts a session's task serves
// (`encounter_task_attempts_list`), Factory says what each is (`factory_attempt_read`), and choosing one is Factory's own Action
// (factory.attempt.choose, by the kernel's `act`, O-I #1006).
//
// Channels (each claim below is carried by exactly one):
// - FIXTURE: AIKit's readings in the shape of aikit.encounter-task-attempts-list/v1 and Factory's attempt records in the shape of
//   factory.attempt-reading/v1 (camelCase, as attempt_runtime.rs serialises them); the kernel's Factory Set in the shape of
//   oi.mode-set/v1 (tests/support/modeSetFixture.mjs).
// - SCRIPTED: a kernel behind the bridge's fetch that answers each op from those fixtures, and `act` with Factory's choose answer in the
//   shape Factory's `session choose` gives (factory.session-task/v1) or its refusal as the kernel carries an owner's (owner_refused); the
//   shared views rendered to static markup or pressed as stateless functions.
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
const sets = await import('../src/frame/tracks/kernelSet.ts')
const fixture = await import('./support/modeSetFixture.mjs')
const owner = await import('../src/owners/attemptTakes.ts')
const {ArrangementRulerView} = {...await import('../src/frame/tracks/ArrangementRuler.tsx'), ...await import('../src/inhabitants/catalogue/panels/dlw__arrangement-ruler.tsx')}
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

// ---------------------------------------------------------------------------------------------------------------- the Set

// The same attempts as the kernel's Factory Set holds them (kernel mode_set.rs, which builds them from the World Model's factory slice
// and is tested there): one task on the lead session's track, its five attempts the takes under it, on the clock ruler from the
// earliest instant.
const LEAD = 'space:port:ses-lead'
const CLIP = `${LEAD}#task/1`
const ORIGIN = NOW - 55 * 60_000
const UNIT = 'workflow-unit:write-the-lanes'
const span = (from, to) => ({start_unix_ms: NOW - from * 60_000, ...(to === undefined ? {} : {end_unix_ms: NOW - to * 60_000})})
const take = (n, state, at, words, extra = {}) => ({id: `factory:attempt:attempt:A${n}`, clip: CLIP, track: LEAD, name: `write-the-lanes · take ${n}`,
  state, at, words, run: RUN, unit: UNIT, ...extra})
const factorySet = (parts = {}) => fixture.modeSetOf({
  owner: 'Factory',
  ruler: {kind: 'clock', unit: 'seconds', origin_unix_ms: ORIGIN},
  rows: [1, 2, 3, 4].map(n => ({id: `batch:${n}`, name: `Batch ${n}`})),
  tracks: [
    fixture.setTrack('space:port:space:port', 'Port', {kind: 'group'}),
    fixture.setTrack(LEAD, 'build the take lanes', {kind: 'session', depth: 1, parent: 'space:port:space:port'}),
    fixture.setTrack('space:port:ses-helper', 'ses-helper', {kind: 'session', depth: 1, parent: 'space:port:space:port'}),
  ],
  clips: [fixture.setClip(CLIP, LEAD, 'batch:1', 'write-the-lanes', {subject: TASK, status: 'waiting', state: 'prepared', at: span(55)})],
  takes: [
    take(1, 'returned', span(50, 35), 'returned and chosen (receiving:R1) · Wrote the lanes.', {standing: true}),
    take(2, 'returned', span(30, 20), 'returned, not yet chosen · Wrote them again.'),
    take(3, 'running', span(10), 'running'),
    take(4, 'failed', span(55, 52), 'failed'),
    take(5, 'prepared', span(2, 2), 'prepared, not yet dispatched'),
  ],
  lanes_absent: {automation: 'The Agent\'s effort over a run: no owner keeps its moves over time, so no automation lane is read.'},
  ...parts,
})
const secs = ms => (ms - ORIGIN) / 1000

test('each attempt is a take lane under its session\'s track, laid from admission to Return, the one that stands marked and shown on the main lane', () => {
  const set = sets.kernelSetTracks(factorySet(), {nowMs: NOW})
  assert.equal(set.lanes.takes.length, 5, 'one lane per attempt; the helper serves none')
  assert.ok(set.lanes.takes.every(lane => lane.trackId === LEAD))
  const [first, second, running, failed, prepared] = set.lanes.takes
  assert.equal(first.id, 'factory:attempt:attempt:A1')
  assert.equal(first.name, 'write-the-lanes · take 1')
  assert.equal(first.standing, true, 'the take whose Return Central received stands')
  assert.equal(second.standing, undefined)
  assert.deepEqual(first.of, {runRef: RUN, unitRef: UNIT}, 'a lane names the run and the unit it works')
  assert.deepEqual(first.spans, [{start: secs(NOW - 50 * 60_000), end: secs(NOW - 35 * 60_000), label: 'returned and chosen (receiving:R1) · Wrote the lanes.'}])
  assert.equal(running.spans[0].end, secs(NOW), 'a running take reaches the live edge')
  assert.equal(failed.spans[0].end, secs(NOW - 52 * 60_000))
  assert.deepEqual([prepared.spans[0].start, prepared.spans[0].end], [secs(NOW - 2 * 60_000), secs(NOW - 2 * 60_000)], 'a prepared take is a point')
  assert.deepEqual(set.lanes.comp, [{trackId: LEAD, takeId: first.id, start: first.spans[0].start, end: first.spans[0].end}], 'the main lane shows the take that stands')
  assert.deepEqual(set.clips.find(clip => clip.id === CLIP).takes.map(item => [item.name, item.standing ?? false]),
    [1, 2, 3, 4, 5].map(n => [`write-the-lanes · take ${n}`, n === 1]), 'the takes stack under their clip, the one that stands marked')
  assert.equal(set.lanes.absent.takes, undefined, 'takes are read: nothing is said to be absent')
  assert.match(set.lanes.absent.automation, /no automation lane is read/, 'the other lanes keep their reasons')
})

test('an attempt whose owner disclosed no admission time has a lane with no stretch, never a guessed place on the ruler', () => {
  const set = sets.kernelSetTracks(factorySet({takes: [take(1, 'returned', undefined, 'returned and chosen (receiving:R1)', {standing: true})]}), {nowMs: NOW})
  assert.equal(set.lanes.takes.length, 1)
  assert.deepEqual(set.lanes.takes[0].spans, [])
  assert.deepEqual(set.lanes.comp ?? [], [], 'a take with no place has no stretch on the main lane either')
})

test('the lanes say why they are absent in the Set\'s own words, and a take is chosen only where the Set lays its choose', async () => {
  const words = 'No task Factory holds has an attempt yet: Factory records each attempt it dispatches on its task.'
  const none = sets.kernelSetTracks(factorySet({takes: [], lanes_absent: {takes: words}}), {nowMs: NOW})
  assert.equal(none.lanes.takes, undefined)
  assert.equal(none.lanes.absent.takes, words)
  // REPLACED (O-I #1006): was "Choosing a take is Factory's attempt-receiving, which the Set carries no Action for yet: no comp is offered".
  // Choosing a take is Factory's factory.attempt.choose, which the kernel lays on a returned take its Run's Flow has not received (kernel
  // mode_set.rs): where none is laid, no comp is offered.
  assert.equal(sets.kernelSetTracks(factorySet(), {nowMs: NOW}).actions.comp, undefined)
  const choose = {action: 'factory.attempt.choose', input: {state: STATE, run_ref: RUN, attempt_ref: 'attempt:A2'},
    words: 'Factory\'s factory.attempt.choose: the take chosen to stand, its Return proposed to Central\'s receiving field, where Approvals lists it',
    done: 'The take is chosen to stand: its Return waits for you in Approvals.'}
  const sent = []
  const runner = {act: async (action, input, project) => { sent.push({action, input, project}); return {contract: 'factory.session-task/v1', state: 'received'} },
    shell: async () => ({ok: false, error: 'no shell act here'})}
  const offered = sets.kernelSetTracks(factorySet({takes: [take(1, 'returned', span(50, 35), 'returned and chosen (receiving:R1)', {standing: true}),
    take(2, 'returned', span(30, 20), 'returned, not yet chosen', {acts: {choose}})]}), {nowMs: NOW, runner})
  assert.equal(offered.actions.comp.op, choose.words)
  // Factory receives a whole attempt: the stretch chosen across the take chooses the take.
  assert.deepEqual(await offered.actions.comp.run(LEAD, 'factory:attempt:attempt:A2', {start: 0, end: 1}), {ok: true, note: choose.done})
  assert.deepEqual(sent, [{action: 'factory.attempt.choose', input: choose.input, project: undefined}], 'the take\'s own Action, by act')
  assert.match((await offered.actions.comp.run(LEAD, 'factory:attempt:attempt:A1', {start: 0, end: 1})).error,
    /carries no factory\.attempt\.choose here: only a returned take whose Return its Run's Flow has not received is chosen/)
  assert.equal(sent.length, 1)
})

test('the Arrangement draws the take lanes with the one that stands marked, and Return on a take presses nothing the owner does not carry', () => {
  const set = sets.kernelSetTracks(factorySet(), {nowMs: NOW})
  const markup = renderToStaticMarkup(React.createElement(ArrangementRulerView, {set, selection: SELECT, view: RULER_VIEW, receipt: null, onPress: noop, onDismiss: noop,
    lanes: {shown: lanes.DEFAULT_LANES, onShown: noop, take: null, onTake: noop, opened: null, onOpened: noop}}))
  assert.equal((markup.match(/class="tl-lane tl-take"/g) ?? []).length, 5)
  assert.match(markup, /data-take="factory:attempt:attempt:A1" data-standing="true"/, 'the chosen take is marked')
  assert.match(markup, /write-the-lanes · take 1/)
  assert.match(markup, /data-lanes="takes" aria-pressed="true" data-count="5"/)
  assert.match(markup, /class="tl-comp" data-comp-take="factory:attempt:attempt:A1"/, 'the main lane names the take each stretch came from')
  assert.match(markup, /Comp: the owner gives no op that copies a stretch of a take into the main lane/)
  // A stretch dragged across a take and Return: no owner op carries it, so nothing is pressed.
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
  assert.equal(presses.length, 0)
})

const leadTakes = () => takes.takesBySession(takes.servedBySession(servedList), new Map([[takes.runKey(STATE, RUN), attemptReading]]))

// ---------------------------------------------------------------------------------------------------------------- the owners

/** A scripted kernel behind the bridge: it answers AIKit's list and Factory's Run reading from the fixtures, and Factory's choose
 * (`act factory.attempt.choose`) with its answer, or its refusal as the kernel carries an owner's. It keeps every op it was sent. */
function scriptedKernel({list = servedList, attempts = attemptReading, receiving} = {}) {
  const kernel = {sent: []}
  globalThis.fetch = async (_url, init) => {
    const op = JSON.parse(init.body)
    kernel.sent.push(op)
    const answered = (result, data) => ({json: async () => ({ok: true, outcome: {result, data, receipts: []}})})
    const refused = error => ({json: async () => ({ok: false, error})})
    if (op.op === 'encounter_task_attempts_list') return list instanceof Error ? refused(list.message) : answered('encounter_task_attempts_list_reading', list)
    if (op.op === 'factory_attempt_read') return attempts instanceof Error ? refused(attempts.message) : answered('factory_attempt_reading', attempts)
    if (op.op === 'act' && op.action === 'factory.attempt.choose') return {json: async () => ({ok: true, outcome: {result: 'action_dispatched', receipts: [],
      dispatch: receiving instanceof Error ? {state: 'owner_refused', message: receiving.message} : {state: 'invoked', data: receiving}}})}
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

const receiving = (state, extra = {}) => ({contract: 'factory.session-task/v1', state, run_ref: RUN, attempt_ref: 'attempt:A2', ...extra})
const second = () => leadTakes().get('ses-lead')[1]

test('choosing sends the attempt alone, by Factory\'s own Action, and the owner\'s answer comes back in its words', async () => {
  const kernel = scriptedKernel({receiving: receiving('received', {receipt: {contract: 'factory.attempt-receiving-receipt/v1', needsReconciliation: false}})})
  const answer = await owner.chooseAttempt(transport, second())
  assert.equal(answer.ok, true)
  assert.equal(answer.note, 'Chosen: this attempt\'s Return was proposed to Central\'s receiving field, into the Flow its Run belongs to.')
  assert.deepEqual(kernel.sent, [{op: 'act', action: 'factory.attempt.choose', input: {state: STATE, run_ref: RUN, attempt_ref: 'attempt:A2'}}],
    'no grant, token, caller or target travels from the desk: Factory reads the person\'s grant and the Run\'s Flow')
  scriptedKernel({receiving: receiving('already-received', {receiving_ref: 'receiving:R2'})})
  assert.match((await owner.chooseAttempt(transport, second())).note, /^Already chosen: Central holds this attempt's Return as receiving:R2/)
})

test('a refusal, an unconfirmed call and an answer about another attempt each come back as a refusal in the owner\'s own words', async () => {
  // Factory's own refusals, as `act` carries them: no grant, and a Run that belongs to no Flow (a task written on a session's track).
  scriptedKernel({receiving: new Error('action not granted: the grant does not list central.receiving.submit.')})
  assert.deepEqual(await owner.chooseAttempt(transport, second()), {ok: false, error: 'action not granted: the grant does not list central.receiving.submit.'})
  const NO_FLOW = `${RUN} belongs to no Central Flow, so its Return has nowhere to be received: a task written on a session's track is commissioned from your words, with no Flow, and its difference stays in the session's checkout, where Git / landing lands it`
  scriptedKernel({receiving: new Error(NO_FLOW)})
  assert.deepEqual(await owner.chooseAttempt(transport, second()), {ok: false, error: NO_FLOW})
  scriptedKernel({receiving: receiving('needs-reconciliation', {receipt: {needsReconciliation: true}})})
  assert.match((await owner.chooseAttempt(transport, second())).error, /Central's answer is not confirmed/)
  // An answer about another attempt is not an answer to this press.
  scriptedKernel({receiving: receiving('received', {attempt_ref: 'attempt:OTHER'})})
  assert.match((await owner.chooseAttempt(transport, second())).error, /did not answer this attempt's choice/)
})
