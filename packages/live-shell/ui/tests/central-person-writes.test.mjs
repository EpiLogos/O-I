// W2, the person's own writes (the kernel carries the host's native token for the person's own presses through invoke_action: action.rs
// PERSON_ACTS, owner_write.rs for_person). Each binding below writes through Central's own action, on the revision its reading gave, and
// draws Central's refusal in its words:
//   the Day (central:day-die, DLW §18.2)   central.day.settings.write, move.record, rollover, close-carry
//   Scope (§19.12)                         central.world-relations.save (a read place's include or exclude)
//   NOWs' Close (§23.6)                    central.now.lifecycle (central/devices/nowsClose.ts; the rail's hookup is the lead's)
//   Approvals' Approve (§19.13)            projectcentral.source.return_accept (central/devices/sourceReturnAccept.ts; the hookup is the lead's)
//   the Flow's Thought, the Workspace's Ground and Self (pageGround.ts)   action:contemplate-flow, flow_changed_since; projectcentral.inspect,
//                                          self.inspect, adopt|migrate.preview — readings and presses; their writes wait on PERSON_ACTS.
//
// Channels:
// - REAL (tests/fixtures/person-writes-2026-10-21.json, stale-refusals-2026-10-21.json): Central's answers on workcell:mac, 21 Oct, read-only —
//   the root world's relations record, the work policy's revision, two NOW clearings, the personal anchor, O-I's (empty) source returns,
//   O-I's ProjectCentral inspection and self reading, AIKit's refusal of a Flow preflight, the Day's settings.
// - FIXTURE: a source return row (central.source-returns/v1 shape), a Contemplate cognition and a changed-since receipt (aikit.flow-cognition/v1,
//   aikit.flow-changed-since/v1), a preview plan (projectcentral-mutation-plan), the ground a close reads.
// - SCRIPTED: a kernel behind the bridge's fetch that records every op and answers it; the catalogue designs rendered through the host.
// No write reaches the owner's real ground: every write goes to the fixture kernel.
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
const day = await import('../src/central/devices/dayBinding.ts')
const writes = await import('../src/central/devices/centralDeviceWrites.ts')
const world = await import('../src/central/devices/contextWorldBinding.ts')
const nows = await import('../src/central/devices/nowsClose.ts')
const accept = await import('../src/central/devices/sourceReturnAccept.ts')
const pages = await import('../src/central/devices/pageBindings.ts')
const ground = await import('../src/central/devices/pageGround.ts')
const {day: dayDesign} = await import('../src/inhabitants/catalogue/panels/day.tsx')
const {scope: scopeDesign} = await import('../src/inhabitants/catalogue/panels/scope.tsx')
const {design: flowDesign} = await import('../src/inhabitants/catalogue/panels/central__flow-document.tsx')
const {design: workspaceDesign} = await import('../src/inhabitants/catalogue/panels/central__workspace.tsx')

const W2 = JSON.parse(readFileSync(new URL('./fixtures/person-writes-2026-10-21.json', import.meta.url), 'utf8'))
const REAL = JSON.parse(readFileSync(new URL('./fixtures/stale-refusals-2026-10-21.json', import.meta.url), 'utf8'))
const escaped = text => text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const viewsOf = design => design.views ?? ['folded', 'compact', 'whole', 'full', 'widget']
function drawsOn(design, binding, fixture, reasons = []) {
  const drawn = viewsOf(design).filter(view => view !== 'popout').map(view => [view, renderToStaticMarkup(createElement(host.HostedDevice, {designed: design, binding, view, nav: {}}))])
  for (const [view, markup] of drawn) {
    assert.match(markup, new RegExp(`data-device-view="${view}"`), `${design.id} ${view} draws`)
    assert.doesNotMatch(markup, /\bNaN\b|undefined/, `${design.id} ${view}: no absent key drawn as text`)
    assert.doesNotMatch(markup, /data-device-fault/, `${design.id} ${view}: its own view drew`)
    assert.doesNotMatch(markup, fixture, `${design.id} ${view}: its fixture never stands in`)
  }
  const all = drawn.map(([, markup]) => markup).join('\n')
  for (const why of reasons) assert.ok(all.includes(escaped(why)), `${design.id}: drawn as why (${why.slice(0, 70)}…)`)
  return all
}

/** A kernel behind the bridge's fetch (FIXTURE): invoke_action answered by `actions[action]` (data, a function of the input, or {refuse});
 * `central` inspect by `ground`; every op recorded. */
function kernel({actions = {}, ground: groundAnswer = null, changed = null} = {}) {
  const sent = []
  const ok = outcome => ({json: async () => ({ok: true, outcome})})
  const fetch = async (_url, init) => {
    const body = JSON.parse(init.body)
    sent.push(body)
    if (body.op === 'central' && body.request?.kind === 'inspect' && groundAnswer) return ok({result: 'central_reading', data: groundAnswer})
    if (body.op === 'flow_changed_since' && changed) return ok({result: 'flow_changed_since', reading: changed})
    if (body.op === 'invoke_action') {
      const action = body.invocation.action
      const given = actions[action]
      if (given === undefined) return ok({result: 'action_dispatched', dispatch: {state: 'unknown_owner', action}})
      const answer = typeof given === 'function' ? given(body.invocation.input ?? {}) : given
      return ok({result: 'action_dispatched', dispatch: answer?.refuse ? {state: 'owner_refused', owner_operation: action, message: answer.refuse} : {state: 'invoked', owner_operation: action, data: answer}})
    }
    return {json: async () => ({ok: false, error: `the fixture kernel answers no ${body.op}`})}
  }
  return {sent, fetch}
}
async function withKernel(owner, run) {
  const real = globalThis.fetch
  globalThis.fetch = owner.fetch
  try { return await run() } finally { globalThis.fetch = real }
}
const bridge = url => ({kind: 'bridge', url})
const invoked = owner => owner.sent.filter(body => body.op === 'invoke_action').map(body => [body.invocation.action, body.invocation.input])

// ── the Day ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

const OWN = {settings: REAL.daySettings.data, settingsRefusal: null, moves: REAL.dayMoves.data, movesRefusal: null, timezone: 'Europe/London'}
const DAY_REF = 'central:day:control:root:2026-10-21'
const FACTS = {civilDate: '2026-10-21', standing: {state: 'ready', dayRef: DAY_REF, civilDate: '2026-10-21', sourceRef: 's', documentId: 'd', revision: 'r'},
  refusal: null, canOpenToday: false, canClose: true, aperture: null, boundary: 0, automaticRollover: false}

test('each Day setting becomes the one setting central.day.settings.write saves, in Central\'s words', () => {
  assert.deepEqual(day.daySettingsPatch('rollover', 1320), {rollover: '22:00'})
  assert.deepEqual(day.daySettingsPatch('rollover', -15), {rollover: null}, 'the step below midnight is Off')
  assert.deepEqual(day.daySettingsPatch('agentWrites', 'write'), {agent_writes: 'write'})
  assert.deepEqual(day.daySettingsPatch('closeRoutine', false), {close_routine: false})
  assert.deepEqual(day.daySettingsPatch('src_live', false), {sources: {live: false}})
  assert.deepEqual(day.daySettingsPatch('at_tasks', -45), {moves: {tasks: {runs_at: {kind: 'off'}}}})
  assert.deepEqual(day.daySettingsPatch('at_close', -30), {moves: {close: {runs_at: {kind: 'day_start'}}}})
  assert.deepEqual(day.daySettingsPatch('at_patterns', -15), {moves: {patterns: {runs_at: {kind: 'rollover'}}}})
  assert.deepEqual(day.daySettingsPatch('at_context', 435), {moves: {context: {runs_at: {kind: 'daily', time: '07:15'}}}})
  assert.deepEqual(day.daySettingsPatch('prompt_synthesis', 'Say what the day taught.'), {moves: {synthesis: {prompt: 'Say what the day taught.'}}})
  assert.deepEqual(day.daySettingsPatch('prompt_synthesis', '  '), {moves: {synthesis: {prompt: null}}}, 'empty is the move\'s own prompt')
  assert.match(day.daySettingsPatch('agentWrites', 'loud').refused, /Off, Propose or Write/)
  assert.equal(day.settingsRevisionOf(OWN), 'absent', 'REAL: nothing saved yet — the first save is on `absent`')
})

test('the Day writes its settings on the revision read, presses its pads on the Day shown, opens tomorrow and closes with the carry', async () => {
  const calls = []
  const writers = {turn: async () => {}, openToday: async () => {}, closeNow: async () => { calls.push(['close']) },
    settings: async (patch, revision) => { calls.push(['settings', patch, revision]) }, begin: async (move, ref) => { calls.push(['begin', move, ref]) },
    openTomorrow: async () => { calls.push(['tomorrow']) }}
  const binding = day.dayDesignBinding('central:day-die', FACTS, day.dayValuesOf(FACTS, null, OWN), writers, OWN)
  for (const key of ['rollover', 'agentWrites', 'closeRoutine', 'src_live', 'at_tasks', 'prompt_tasks', 'run_tasks', 'openTomorrow', 'closeNow']) {
    assert.equal(binding.standing[key], undefined, `${key} acts`)
    assert.equal(binding.writes(key), true, key)
  }
  await binding.write([{key: 'rollover', value: 1320}, {key: 'src_live', value: false}, {key: 'run_patterns', value: true}, {key: 'openTomorrow', value: true}, {key: 'closeNow', value: true}])
  assert.deepEqual(calls, [['settings', {rollover: '22:00'}, 'absent'], ['settings', {sources: {live: false}}, 'absent'], ['begin', 'patterns', DAY_REF], ['tomorrow'], ['close']])
  assert.match(binding.standing.verifyCloseout.disabled, /T-COVERAGE §1\.2/)
  // Central's settings unread: every setting closed, saying why; no Day document: the pads closed.
  const unread = day.dayDesignBinding('central:day-die', {...FACTS, standing: null}, {}, writers, {...OWN, settings: null, settingsRefusal: 'the Day\'s settings source is not JSON'})
  assert.match(unread.standing.rollover.disabled, /refused — the Day's settings source is not JSON.*checked against the revision/)
  assert.match(unread.standing.run_tasks.disabled, /no Day document stands/)
  await assert.rejects(unread.write([{key: 'agentWrites', value: 'write'}]), /settings source is not JSON/)
})

const CLOSE_GROUND = {schema: 'oi.central-ground/v1', project: null,
  time: {state: 'ready', action: 'central.time.policy', data: {civil_date: '2026-10-21', local_time: '2026-10-21T09:00:00+01:00', revision: 'time-rev', schema: 'central.civil-time-reading/v1',
    policy: {automatic_day_rollover: false, day_boundary_minutes: 0, schema: 'central.civil-time-policy/v1', scope_ref: 'control:root', timezone: 'Europe/London'}}},
  day: {state: 'ready', action: 'central.day.read', data: {day_ref: DAY_REF, revision: {revision: 'day-rev'}, relations_revision: 'rel-rev', schema: 'central.day-reading/v1', document_state: 'uninitialised', document: null,
    source: {ref: 'central:source:control:root:Control/user/day/2026-10-21/day.md', path: 'Control/user/day/2026-10-21/day.md'},
    temporal: {civil_date: '2026-10-21', day_ref: DAY_REF, lifecycle: 'open'}, today: {civil_date: '2026-10-21', day_ref: DAY_REF}}},
  now: {state: 'unavailable', action: 'central.now.list'}, sources: {state: 'unavailable', action: 'projectcentral.change.horizon'}, placement: {state: 'unavailable', action: 'central.work.policy'}}

test('the Day\'s writes reach Central\'s actions through invoke_action, each on its revision; a refusal comes back in Central\'s words', async () => {
  const owner = kernel({ground: CLOSE_GROUND, actions: {
    'central.day.settings.write': input => (input.expected_revision === 'absent' ? {schema: 'central.day-settings-reading/v1', revision: 'r1'} : {refuse: 'the Day\'s settings changed; read them again'}),
    'central.day.move.record': {schema: 'central.day-move-run-record/v1', created: true}, 'central.day.rollover': {created: true},
    'central.day.close-carry': {schema: 'central.day-close-carry/v1', carry: {state: 'carried'}}}})
  const t = bridge('http://day-writes.fixture')
  await withKernel(owner, async () => {
    await writes.writeDaySettings(t, {rollover: '22:00'}, 'absent')
    await assert.rejects(writes.writeDaySettings(t, {rollover: '22:00'}, 'r0'), /the Day's settings changed; read them again/)
    await writes.beginDayMove(t, 'tasks', DAY_REF, 1792569600000)
    await writes.openTomorrow(t)
    const closed = await writes.closeCarry(t)
    assert.deepEqual(closed, {closed: DAY_REF, civilDate: '2026-10-21', carry: {state: 'carried'}})
  })
  assert.deepEqual(invoked(owner), [
    ['central.day.settings.write', {expected_revision: 'absent', rollover: '22:00'}],
    ['central.day.settings.write', {expected_revision: 'r0', rollover: '22:00'}],
    ['central.day.move.record', {event: 'begin', move: 'tasks', at_unix_ms: 1792569600000, trigger: 'press', day_ref: DAY_REF}],
    ['central.day.rollover', {expected_time_policy_revision: 'time-rev'}],
    ['central.day.close-carry', {day_ref: DAY_REF, expected_revision: 'day-rev', expected_relations_revision: 'rel-rev'}],
  ])
  assert.ok(owner.sent.every(body => body.op !== 'invoke_action' || body.invocation.target_ref === `central:action:${body.invocation.action}`))
})

test('(e) the Day draws its design with every setting live on Central\'s readings, never the design\'s sample', () => {
  const values = day.dayValuesOf(FACTS, null, OWN)
  const binding = day.dayDesignBinding('central:day-die', FACTS, values, {turn: async () => {}, openToday: async () => {}, closeNow: async () => {}, settings: async () => {}, begin: async () => {}}, OWN)
  const all = drawsOn(dayDesign, binding, /Wed 15 Oct|Read face 0 and propose tasks in three tiers|63 handoff returns/)
  assert.doesNotMatch(all, /central\.day\.settings\.write, which waits on/, 'no setting stands closed on the person\'s route any more')
})

// ── Scope: the world's relations ─────────────────────────────────────────────────────────────────────────────────────────────────

test('REAL — a read place\'s exclude and include are saved on the world\'s relations record at its revision, the record advanced', async () => {
  const record = world.relationsRecordOf(W2.worldRelationsRoot.data)
  assert.equal(record.revision, 'w1')
  assert.equal(world.nextRelationsRevision('w1'), 'w2')
  assert.equal(world.nextRelationsRevision('r'), 'r.1')
  const ref = 'central:source:control:root:Control/agents'
  const excluded = world.relationsWith(record, ref, false)
  assert.deepEqual([excluded.revision, excluded.excluded_sources, excluded.sources], ['w2', [ref], record.sources], 'every other field as read')
  assert.deepEqual(world.relationsWith({...record, excluded_sources: [ref]}, ref, true).excluded_sources, [])
  const saved = []
  const input = {answer: {bound: true, session: 's'}, horizon: {state: 'ready', data: {sources: [], changes: [], world_ref: 'control:root'}}, groundError: null, document: null, packet: null,
    effective: {status: 'answered', value: REAL.effectiveSources.data}, relations: {status: 'answered', value: W2.worldRelationsRoot.data},
    saveRelations: async (rec, expected) => { saved.push([rec.revision, rec.excluded_sources, expected]) }}
  const binding = world.centralScopeBinding(world.CENTRAL_SCOPE_ID, input)
  assert.equal(binding.values[`r:${ref}`], true, 'Central resolves the source as available: included')
  assert.equal(binding.standing[`r:${ref}`], undefined)
  await binding.write([{key: `r:${ref}`, value: false}])
  assert.deepEqual(saved, [['w2', [ref], 'w1']])
  assert.match(binding.standing[`w:${ref}`].disabled, /missing op: the session's writable places/)
  await assert.rejects(binding.write([{key: 'r:packet', value: false}]), /no source of the world/)
  const unread = world.centralScopeBinding(world.CENTRAL_SCOPE_ID, {...input, relations: {status: 'reading'}})
  assert.match(unread.standing[`r:${ref}`].disabled, /have not answered yet \(central\.world-relations\.read\)/)
  // Through the kernel: the save is Central's own action on the expected revision.
  const owner = kernel({actions: {'central.world-relations.save': {kind: 'world', ref: 'control:root', revision: 'w2'}}})
  await withKernel(owner, () => writes.centralWrite(bridge('http://relations.fixture'), 'central.world-relations.save', {scope: 'root', record: excluded, expected_revision: 'w1'}))
  assert.equal(invoked(owner)[0][0], 'central.world-relations.save')
  assert.equal(invoked(owner)[0][1].expected_revision, 'w1')
  drawsOn(scopeDesign, binding, /Lantern \(object\)|Tidal \(Expression\)|r15 → r17/)
})

// ── NOWs' Close ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

test('REAL — NOWs\' Close asks central.now.lifecycle on the clearing\'s revision and the work policy\'s; each gap refused in words', async () => {
  const rows = W2.nowList.data.records
  const row = rows[0]
  const policy = {revision: W2.workPolicy.revision}
  assert.deepEqual(nows.nowCloseInput(row.now_ref, rows, policy).input,
    {now_ref: row.now_ref, expected_revision: row.revision.revision, expected_policy_revision: W2.workPolicy.revision, lifecycle: 'closed'})
  assert.match(nows.nowCloseInput(undefined, rows, policy).refused, /open a moment first/)
  assert.match(nows.nowCloseInput(row.now_ref, null, policy).refused, /listing has not answered/)
  assert.match(nows.nowCloseInput(row.now_ref, rows, null).refused, /central\.work\.policy/)
  assert.match(nows.nowCloseInput('central:now:x', rows, policy).refused, /not among the clearings/)
  const owner = kernel({actions: {'central.now.lifecycle': input => (input.expected_policy_revision === W2.workPolicy.revision ? {lifecycle: 'closed'} : {refuse: 'policy moved'})}})
  await withKernel(owner, () => nows.closeNowClearing(bridge('http://nows.fixture'), row.now_ref, rows, policy))
  assert.deepEqual(invoked(owner), [['central.now.lifecycle', {now_ref: row.now_ref, expected_revision: row.revision.revision, expected_policy_revision: W2.workPolicy.revision, lifecycle: 'closed'}]])
  await assert.rejects(withKernel(owner, () => nows.closeNowClearing(bridge('http://nows.fixture'), row.now_ref, rows, {revision: 'old'})), /policy moved/)
})

// ── Approvals' Approve ───────────────────────────────────────────────────────────────────────────────────────────────────────────

test('Approve accepts a pending return through projectcentral.source.return_accept on its basis, by the person the anchor names', async () => {
  assert.equal(accept.personRefOf(W2.personalAnchor.data), 'central:source:control:root:Control/user/identity', 'REAL: the human grant\'s principal')
  assert.deepEqual(W2.sourceReturnsOI.envelope.data.entries, [], 'REAL: O-I has no return waiting today')
  const row = {return_ref: 'central:source-return:O-I:1', source_ref: 'central:source:project:O-I:ProjectCentral/user/x.md', basis_revision: 'b1', status: 'pending', current_revision: 'b1'}
  const person = accept.personRefOf(W2.personalAnchor.data)
  assert.deepEqual(accept.returnAcceptInput('O-I', row, person).input,
    {project: 'O-I', return_ref: row.return_ref, expected_revision: 'b1', acceptance: 'human-accepted', accepted_by_ref: person})
  assert.match(accept.returnAcceptInput('O-I', {...row, current_revision: 'b2'}, person).refused, /the source moved since the agent proposed this/)
  assert.match(accept.returnAcceptInput('O-I', {...row, status: 'accepted'}, person).refused, /is accepted/)
  assert.match(accept.returnAcceptInput('O-I', row, null).refused, /personal anchor/)
  assert.match(accept.returnAcceptInput(null, row, person).refused, /belongs to a project/)
  const owner = kernel({actions: {'projectcentral.source.return_accept': {status: 'accepted'}}})
  await withKernel(owner, () => accept.acceptSourceReturn(bridge('http://approve.fixture'), 'O-I', row, person))
  assert.deepEqual(invoked(owner)[0], ['projectcentral.source.return_accept', {project: 'O-I', return_ref: row.return_ref, expected_revision: 'b1', acceptance: 'human-accepted', accepted_by_ref: person}])
  assert.equal(owner.sent[0].project, 'O-I')
})

// ── the Flow's Thought ───────────────────────────────────────────────────────────────────────────────────────────────────────────

const PREFLIGHT_REFUSED = {status: 'refused', error: W2.flowPreflight.envelope.error.message}
test('the Flow\'s Thought: the preflight asked by a press — REAL refusal drawn in AIKit\'s words —, Contemplate only on its record, Changed since only on a thought', async () => {
  assert.deepEqual(JSON.parse(ground.preflightValue(PREFLIGHT_REFUSED)), {state: 'unavailable', reason: 'no Flow node resolves 769005e3-9bf0-491b-afcd-db10706ab8da'})
  const preflight = {status: 'answered', value: {invocation_ref: 'aikit:invocation:1', runtime_model: 'model:x', harness: 'harness:y', focus: ['flow:1'],
    impact: {changed_sources: ['central:source:a'], affected: [{resource: 'wiki:node:b', freshness: 'stale'}]}}}
  assert.deepEqual(JSON.parse(ground.preflightValue(preflight)), {state: 'ready', invocation: 'aikit:invocation:1', model: 'model:x', harness: 'harness:y', focus: ['flow:1'],
    changed: [{title: 'central:source:a'}], affected: [{title: 'wiki:node:b', freshness: 'stale'}]})
  const cognition = {status: 'answered', value: {state: 'cognition', thought: {invocation_ref: 'aikit:invocation:1', tensions: ['t'], candidates: [], human_source_proposals: ['p', 'q'], flow_mutations: []}}}
  assert.deepEqual(JSON.parse(ground.thoughtValue(cognition)), {state: 'cognition', cursor: 'aikit:invocation:1', tensions: 1, candidates: 0, proposals: 2, intents: 0})
  assert.deepEqual(JSON.parse(ground.thoughtValue({status: 'answered', value: {state: 'unavailable', reason: 'no host executor'}})), {state: 'unavailable', reason: 'no host executor'})
  assert.deepEqual(JSON.parse(ground.sinceValue({status: 'answered', value: {aikit: {state: 'invoked', receipt: {changed_sources: [1], affected_knowledge: [], unresolved: [{kind: 'tension', reference: 'r'}]}}}})),
    {state: 'available', changed: 1, affected: 0, open: [{kind: 'tension', reference: 'r'}]})
  const presses = []
  const hand = {preflight: async () => { presses.push('preflight') }, contemplate: async record => { presses.push(['contemplate', record.invocation_ref]) }, since: async t => { presses.push(['since', t.state]) }}
  const reached = {form: 'Flow', tabTitle: 'Flow', dirty: false, outcome: null, name: 'flow-x'}
  const before = pages.flowBinding('central:flow-document', reached, null, null, null, {state: {flowRef: 'doc-1'}, hand})
  assert.equal(before.values.preflight, undefined)
  await before.write([{key: 'preflightRead', value: true}])
  await assert.rejects(before.write([{key: 'contemplate', value: 'x'}]), /Read the preflight first/)
  await assert.rejects(before.write([{key: 'sinceRead', value: true}]), /no thought to read from/)
  const refusedRun = pages.flowBinding('central:flow-document', reached, null, null, null, {state: {flowRef: 'doc-1', preflight: PREFLIGHT_REFUSED}, hand})
  await assert.rejects(refusedRun.write([{key: 'contemplate', value: 'x'}]), /no Flow node resolves/)
  const ready = pages.flowBinding('central:flow-document', reached, null, null, null, {state: {flowRef: 'doc-1', preflight, thought: cognition}, hand})
  await ready.write([{key: 'contemplate', value: 'aikit:invocation:1'}, {key: 'sinceRead', value: true}])
  assert.deepEqual(presses, ['preflight', ['contemplate', 'aikit:invocation:1'], ['since', 'cognition']])
  const none = pages.flowBinding('central:flow-document', reached, null, null, null, null)
  assert.match(none.standing.preflightRead.disabled, /no Flow is reached with its AIKit Flow ref/)
  // (e) the Thought page draws AIKit's refusal in its words.
  host.setHostPage('central:flow-document', 'thought')
  drawsOn(flowDesign, refusedRun, /flow-2026-10-03-1432|Cairn/, ['no Flow node resolves 769005e3-9bf0-491b-afcd-db10706ab8da'])
  host.resetHost('central:flow-document')
})

// ── the Workspace's Ground and Self ──────────────────────────────────────────────────────────────────────────────────────────────

test('REAL — the Workspace\'s Ground and Self read Central\'s inspection and self reading; Preview asks Central\'s plan; Accept and the self writes need a write hand', async () => {
  const pc = JSON.parse(ground.pcValue(W2.pcInspectOI.data))
  assert.deepEqual([pc.outcome, pc.candidates, pc.signals.map(s => s.kind)], ['already_conformant', [{source: 'ProjectCentral/agents/wiki/wiki.json', space: 'central:wiki:project:O-I'}], ['readme', 'docs']])
  const self = JSON.parse(ground.selfValue(W2.selfInspectOI.data))
  assert.deepEqual(self, {aperture: {exists: false, status: 'legacy-migratable-absence'}, tiers: [], ux: [], ex: [], unbound: []})
  assert.deepEqual(JSON.parse(ground.planValue('adopt', {operations: ['keep wiki in place'], source: 'wiki', preserves_source: true})), {treatment: 'adopt', operations: ['keep wiki in place'], source: 'wiki', preserves: true})
  const previews = []
  const state = {project: 'O-I', pc: {status: 'answered', value: W2.pcInspectOI.data}, self: {status: 'answered', value: W2.selfInspectOI.data},
    preview: async (treatment, source) => { previews.push([treatment, source]) }}
  pages.resetHolds()
  const workspace = {id: 'w1', name: 'O-I', project: 'O-I', layout: {root: null, mode: 'base'}}
  const binding = pages.workspaceBinding('central:workspace', workspace, Date.now(), null, state)
  assert.equal(JSON.parse(binding.values.pc).outcome, 'already_conformant')
  assert.equal(JSON.parse(binding.values.self).aperture.status, 'legacy-migratable-absence')
  await binding.write([{key: 'pcPreview', value: true}])
  assert.deepEqual(previews, [['adopt', 'ProjectCentral/agents/wiki/wiki.json']], 'the one wiki the inspection names, kept in place')
  pages.setHeld('central:workspace', 'treatment', 'create')
  await assert.rejects(pages.workspaceBinding('central:workspace', workspace, Date.now(), null, state).write([{key: 'pcPreview', value: true}]), /no preview of projectcentral\.init/)
  // W4: Accept, Ensure and Relate are the person's presses the kernel carries (action.rs PERSON_ACTS); with no write hand here they say so.
  for (const key of ['pcAccept', 'selfEnsure', 'selfRelate']) assert.match(binding.standing[key].disabled, /no transport reaches Central here/, key)
  const root = pages.workspaceBinding('central:workspace', {...workspace, project: undefined}, Date.now(), null, {project: null})
  assert.match(root.standing.pcPreview.disabled, /no world's ground is read here/)
  pages.resetHolds()
  host.setHostPage('central:workspace', 'ground')
  drawsOn(workspaceDesign, binding, /Archetypal-Earth\/wiki|sf1-walk/)
  host.resetHost('central:workspace')
})
