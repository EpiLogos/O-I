// W2's two hookups in the rail and on Factory's Main track (builder A's pure writes, central/devices; their own tests are
// tests/central-person-writes.test.mjs):
//   NOWs' Close (§23.6)          widgets/railDevices.tsx useNowsBinding → railBindings.ts nowsCloseWrites → nowsClose.ts closeNowClearing
//                                (central.now.lifecycle on the listing's revision and central.work.policy's)
//   Approvals' Approve (§19.13)  agent/devices/FactoryDeviceChain.tsx → receiptBindings.ts approvalsBinding `approve` port →
//                                sourceReturnAccept.ts acceptSourceReturn (projectcentral.source.return_accept, by the anchor's person)
// Channels:
// - REAL (tests/fixtures/person-writes-2026-10-21.json, read-only): Central's NOW listing, the work policy's revision and the personal
//   anchor on workcell:mac, 21 Oct.
// - FIXTURE: a pending source return (central.source-returns/v1 shape; O-I had none waiting on 21 Oct, the REAL reading is empty).
// - SCRIPTED: a kernel behind the bridge's fetch that records every op and answers it; the catalogue designs drawn through the host.
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
const rail = await import('../src/widgets/railBindings.ts')
const nows = await import('../src/central/devices/nowsClose.ts')
const accept = await import('../src/central/devices/sourceReturnAccept.ts')
const bind = await import('../src/agent/devices/designBindings.ts')
const rec = await import('../src/agent/devices/receiptBindings.ts')
const {design: nowsDesign} = await import('../src/inhabitants/catalogue/panels/widgets__nows.tsx')
const {design: approvalsDesign} = await import('../src/inhabitants/catalogue/panels/software-factory__approvals.tsx')

const W2 = JSON.parse(readFileSync(new URL('./fixtures/person-writes-2026-10-21.json', import.meta.url), 'utf8'))
const read = path => readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8')
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
 * every op recorded. */
function kernel(actions = {}) {
  const sent = []
  const ok = outcome => ({json: async () => ({ok: true, outcome})})
  const fetch = async (_url, init) => {
    const body = JSON.parse(init.body)
    sent.push(body)
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

// ── NOWs' Close ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

// The ground as Central's `inspect` gives it (oi.central-ground/v1), its NOW leg and its placement leg (central.work.policy) REAL.
const failed = action => ({state: 'failed', action, error: {message: `${action} did not answer`}})
const GROUND = {schema: 'oi.central-ground/v1', project: null, time: failed('central.time.policy'), day: failed('central.day.read'),
  now: {state: 'ready', action: 'central.now.list', data: W2.nowList.data}, sources: failed('projectcentral.change.horizon'),
  placement: {state: 'ready', action: 'central.work.policy', data: {revision: W2.workPolicy.revision}}}
const ROW = W2.nowList.data.records[0]

test('REAL — the NOWs\' Close press writes central.now.lifecycle on the clearing\'s listed revision and the work policy\'s, through the kernel', async () => {
  const owner = kernel({'central.now.lifecycle': input => (input.expected_policy_revision === W2.workPolicy.revision ? {lifecycle: 'closed'} : {refuse: 'policy moved'})})
  const binding = {id: 'rail:nows', values: rail.nowsValues(GROUND), ...rail.nowsCloseWrites(bridge('http://nows.fixture'), GROUND, nows.closeNowClearing)}
  assert.equal(binding.writes('close'), true)
  assert.equal(binding.writes('machine'), false, 'the machine shown is the hand\'s')
  assert.equal(binding.standing, undefined, 'with a carrier, Close stands enabled')
  await withKernel(owner, () => binding.write([{key: 'close', value: ROW.now_ref}]))
  assert.deepEqual(invoked(owner), [['central.now.lifecycle',
    {now_ref: ROW.now_ref, expected_revision: ROW.revision.revision, expected_policy_revision: W2.workPolicy.revision, lifecycle: 'closed'}]])
  // Central's own refusal, in its words: the policy moved under the ground the tile read.
  const moved = {...GROUND, placement: {state: 'ready', action: 'central.work.policy', data: {revision: 'central.content-fnv1a64/v1:1:old'}}}
  await assert.rejects(withKernel(owner, () => rail.nowsCloseWrites(bridge('http://nows.fixture'), moved, nows.closeNowClearing).write([{key: 'close', value: ROW.now_ref}])), /policy moved/)
})

test('the NOWs\' Close refused before Central is asked: no carrier (drawn on the design), the policy unread, the listing unread, nothing open', async () => {
  const owner = kernel({'central.now.lifecycle': () => assert.fail('not asked')})
  const noPolicy = {...GROUND, placement: failed('central.work.policy')}
  await assert.rejects(withKernel(owner, () => rail.nowsCloseWrites(bridge('http://nows.fixture'), noPolicy, nows.closeNowClearing).write([{key: 'close', value: ROW.now_ref}])), /central\.work\.policy/)
  await assert.rejects(withKernel(owner, () => rail.nowsCloseWrites(bridge('http://nows.fixture'), null, nows.closeNowClearing).write([{key: 'close', value: ROW.now_ref}])), /listing has not answered/)
  await assert.rejects(withKernel(owner, () => rail.nowsCloseWrites(bridge('http://nows.fixture'), GROUND, nows.closeNowClearing).write([{key: 'close', value: undefined}])), /open a moment first/)
  await assert.rejects(rail.nowsCloseWrites(bridge('http://nows.fixture'), GROUND, nows.closeNowClearing).write([{key: 'day', value: 'x'}]), /day is a reading/)
  const away = rail.nowsCloseWrites({kind: 'unavailable', reason: 'the browser stack has no kernel'}, GROUND, nows.closeNowClearing)
  assert.match(away.standing.close.disabled, /no kernel carrier stands, so Central's central\.now\.lifecycle cannot be asked — the browser stack has no kernel/)
  await assert.rejects(away.write([{key: 'close', value: ROW.now_ref}]), /no kernel carrier stands/)
  assert.deepEqual(owner.sent, [], 'no refusal dispatched anything')
  // The design draws on the binding — Close's reason in Full (its control bar), no NaN, no undefined, never its fixtures' moments.
  const binding = {id: 'rail:nows', values: {...rail.nowsValues(GROUND), open: ROW.now_ref}, local: {machine: () => {}, open: () => {}}, ...away}
  drawsOn(nowsDesign, binding, /Reconcile the capability matrix|Back up the bimba graph|Device run: Live, Quaternal/, [away.standing.close.disabled])
})

test('the rail\'s NOWs binding hands railBindings.nowsCloseWrites the ground it read and closeNowClearing (loaded at the press) — the Close is no longer refused as absent', () => {
  const source = read('widgets/railDevices.tsx')
  assert.match(source, /\.\.\.nowsCloseWrites\(transport, reading\.status === 'read' \? reading\.ground : null, closeNow\)/)
  assert.match(source, /const closeNow: typeof closeNowClearing = \(\.\.\.args\) => import\('\.\.\/central\/devices\/nowsClose'\)\.then\(module => module\.closeNowClearing\(\.\.\.args\)\)/,
    'closeNowClearing itself, loaded at the press')
  assert.doesNotMatch(source + read('widgets/railBindings.ts'), /NOW_CLOSE_ABSENT/, 'REPLACED: the missing-op refusal is gone')
})

// ── Approvals' Approve ───────────────────────────────────────────────────────────────────────────────────────────────────────────

const minted = 1_792_300_000_000
const PENDING = {return_ref: `central:return:project:o-i:${minted}000000-4242`, source_ref: 'central:source:project:O-I:docs/dlw/DLW.md', basis_revision: 'r1',
  status: 'pending', agent_session_ref: 'agent-session/flint', current_revision: 'r1'}
const MOVED = {...PENDING, return_ref: 'central:return:project:o-i:1792300001000000000-4243', current_revision: 'r2'}
const PERSON = accept.personRefOf(W2.personalAnchor.data)
const input = returns => ({gateway: {}, session: null, encounter: null, holds: bind.chainHolds(), returns, nowUnixMs: minted + 60_000})
const approveVia = (url, person = PERSON) => ({approve: row => accept.acceptSourceReturn(bridge(url), 'O-I', row, person)})

test('Approve accepts the chosen proposal through projectcentral.source.return_accept on its basis, by the person Central\'s anchor names', async () => {
  bind.resetHolds()
  assert.equal(PERSON, 'central:source:control:root:Control/user/identity', 'REAL: the human grant\'s principal')
  const owner = kernel({'projectcentral.source.return_accept': {status: 'accepted'}})
  const binding = rec.approvalsBinding(input({entries: [PENDING]}), null, approveVia('http://approve.fixture'))
  assert.equal(binding.writes('approve'), true)
  assert.equal(binding.standing.approve, undefined, 'with the port, Approve stands enabled')
  await withKernel(owner, () => binding.write([{key: 'approve', value: PENDING.return_ref}]))
  assert.deepEqual(invoked(owner), [['projectcentral.source.return_accept',
    {project: 'O-I', return_ref: PENDING.return_ref, expected_revision: 'r1', acceptance: 'human-accepted', accepted_by_ref: PERSON}]])
  assert.equal(owner.sent[0].project, 'O-I', 'in the project\'s register')
  // Central's own refusal, in its words.
  const refusing = kernel({'projectcentral.source.return_accept': {refuse: 'the proposal is no longer pending'}})
  await assert.rejects(withKernel(refusing, () => binding.write([{key: 'approve', value: PENDING.return_ref}])), /no longer pending/)
})

test('Approve refused in words before Central is asked: a moved source, no person named, a proposal not listed, no returns read, no port (drawn)', async () => {
  bind.resetHolds()
  const owner = kernel({'projectcentral.source.return_accept': () => assert.fail('not asked')})
  const binding = rec.approvalsBinding(input({entries: [PENDING, MOVED]}), null, approveVia('http://approve.fixture'))
  await assert.rejects(withKernel(owner, () => binding.write([{key: 'approve', value: MOVED.return_ref}])), /the source moved since the agent proposed this \(its basis r1, now r2\)/)
  await assert.rejects(withKernel(owner, () => binding.write([{key: 'approve', value: 'central:return:project:o-i:gone'}])), /not among the returns Central lists now/)
  const nobody = rec.approvalsBinding(input({entries: [PENDING]}), null, approveVia('http://approve.fixture', null))
  await assert.rejects(withKernel(owner, () => nobody.write([{key: 'approve', value: PENDING.return_ref}])), /personal anchor has not named the person/)
  const unread = rec.approvalsBinding(input(null), null, approveVia('http://approve.fixture'))
  await assert.rejects(withKernel(owner, () => unread.write([{key: 'approve', value: PENDING.return_ref}])), /source returns have not answered/)
  const unwired = rec.approvalsBinding(input({entries: [PENDING]}), null, {})
  assert.equal(unwired.standing.approve.disabled, rec.APPROVE_UNWIRED)
  await assert.rejects(unwired.write([{key: 'approve', value: PENDING.return_ref}]), /no acceptance port is passed here/)
  // REPLACED (lane W9): Changes has its owner now; unwrapped by a chain's comment hand it says so (sourceReturnComment.ts withReturnComments).
  await assert.rejects(binding.write([{key: 'changes', value: PENDING.return_ref}]), /passes no comment hand/)
  assert.deepEqual(owner.sent, [], 'no refusal dispatched anything')
  drawsOn(approvalsDesign, unwired, /setModel|Kite|recursive delete/, [rec.APPROVE_UNWIRED, rec.APPROVALS_REFUSE.changes])
  drawsOn(approvalsDesign, binding, /setModel|Kite|recursive delete/, [rec.APPROVALS_REFUSE.changes])
  bind.resetHolds()
})

test('Factory\'s Main track hands Approvals the acceptance: the anchor asked only while a proposal waits, the row accepted in the project', () => {
  const view = read('agent/devices/FactoryDeviceChain.tsx')
  assert.match(view, /useCentralAction\(transport, PERSONAL_ANCHOR_ACTION, waiting \? NO_INPUT : null\)/)
  assert.match(view, /approve: row => acceptSourceReturn\(transport, RACK_PROJECT, row, person\)/)
  assert.match(view, /const person = anchor\.status === 'answered' \? personRefOf\(anchor\.value\) : null/)
})
