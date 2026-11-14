// #772: Approvals' new answers (manual §19.14 "What waits": a proposal's Approve, Changes or Deny; a request's Approve, Deny or Open; a review's
// Confirm or Changes, with Collect; a recognition's Recognise, Close or Continue) and its view at the manual's defaults (§19.14 Parameters:
// Show All, Order Oldest first, Follow On). Deny on a proposal is Central's projectcentral.source.return_reject {project, return_ref}
// (ctrl's source_return.rs; the kernel's flow.rs source_return_reject reads it the same way), through invoke_action as every return's answer
// is (centralWrite). A review's and a recognition's answers stand refused, each naming what Approvals is not handed or the op it lacks.
// Channel: SCRIPTED — Central's answers go to a recording port, never to the owner. Not a screen pass.
// O-I ticket 1007 (manual §18.2: what a session yields at its end lands on face 2 as a proposal, which Approvals keeps or drops): Central's
// reading of today's Day lists each yield with where its Return stands (ctrl day_turn.rs yields_of: status, revision); a pending one waits
// here as a proposal, answered Keep (Central's receiving Review accepting it on today's page as read, then its Include onto face 2) or Drop
// (the Review rejecting it): centralDeviceWrites.ts keepSessionYield and dropSessionYield, handed in as ports. SCRIPTED ports too.
import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'
import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'

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
const bind = await import('../src/agent/devices/designBindings.ts')
const rec = await import('../src/agent/devices/receiptBindings.ts')
const {design: approvalsDesign} = await import('../src/inhabitants/catalogue/panels/software-factory__approvals.tsx')
const html = element => renderToStaticMarkup(element)

const PENDING = {return_ref: 'central:return:project:o-i:1792300000000000000-4242', source_ref: 'central:source:project:O-I:README.md', basis_revision: 'r1', status: 'pending',
  agent_session_ref: 'agent-session/flint', current_revision: 'r1'}
const ACCEPTED = {...PENDING, return_ref: 'central:return:project:o-i:1792300001000000000-4243', status: 'accepted'}
const input = () => ({session: null, encounter: null, holds: bind.chainHolds(), returns: {entries: [PENDING, ACCEPTED]}, tracks: [], nowUnixMs: Date.UTC(2026, 9, 28)})

test('Approvals\' view stands at the manual\'s defaults: Show All, Order Oldest first, Follow On', () => {
  bind.resetHolds()
  const binding = rec.approvalsBinding(input(), {})
  assert.deepEqual([binding.values.show, binding.values.order, binding.values.follow], ['all', 'oldest', true])
  assert.equal(typeof binding.local.follow, 'function', 'Follow is the hand\'s')
})

test('Deny on a proposal is Central\'s return_reject, for a return that waits; with no carrier it stands disabled saying so', async () => {
  bind.resetHolds()
  const asked = []
  const binding = rec.approvalsBinding(input(), {reject: async row => { asked.push(row.return_ref) }})
  assert.equal(binding.writes('reject'), true)
  assert.equal(binding.standing.reject, undefined)
  await binding.write([{key: 'reject', value: PENDING.return_ref}])
  assert.deepEqual(asked, [PENDING.return_ref])
  await assert.rejects(binding.write([{key: 'reject', value: ACCEPTED.return_ref}]), /Deny: that proposal waits no more/)
  assert.equal(asked.length, 1)
  const bare = rec.approvalsBinding(input(), {})
  assert.equal(bare.standing.reject.disabled, rec.REJECT_UNWIRED)
  assert.match(rec.REJECT_UNWIRED, /projectcentral\.source\.return_reject/)
})

test('a review\'s and a recognition\'s answers stand refused, each naming what Approvals lacks; a press says the same', async () => {
  bind.resetHolds()
  const binding = rec.approvalsBinding(input(), {})
  for (const key of ['confirm', 'reviewChanges', 'collect', 'recognise', 'close', 'continue']) {
    assert.equal(binding.writes(key), true, `${key}: the press reaches its refusal`)
    assert.equal(binding.standing[key]?.disabled, rec.APPROVALS_ANSWERS_REFUSED[key], `${key} stands disabled with its reason`)
    await assert.rejects(binding.write([{key, value: 'x'}]), {message: rec.APPROVALS_ANSWERS_REFUSED[key]})
  }
  assert.match(rec.APPROVALS_ANSWERS_REFUSED.confirm, /factory\.attempt\.choose/)
  assert.match(rec.APPROVALS_ANSWERS_REFUSED.recognise, /Recognise/)
  assert.match(rec.APPROVALS_ANSWERS_REFUSED.continue, /missing op/)
})

const MORNING = {session: 'agent-session/morning', returnRef: 'central:return:control:root:morning', status: 'pending', revision: 'return-rev-1', receipts: 2,
  changes: 1, account: 'Drafted the second section.', filedAtUnixMs: Date.UTC(2026, 9, 27, 23), unread: null}
const KEPT = {...MORNING, session: 'agent-session/review', returnRef: 'central:return:control:root:review', status: 'accepted', revision: 'return-rev-2', account: null}
const TRACK = {sessionRef: 'agent-session/morning', spaceRef: 'session-space/root', agentName: 'Flint', agentRef: 'agent:flint', purpose: 'Morning pages', group: false}
const yielding = yields => ({...input(), tracks: [TRACK], yields})

test('what a session yielded waits as a proposal: Keep is Central\'s Review then Include on today\'s page as read, Drop its Review; each refuses in words', async () => {
  bind.resetHolds()
  const kept = [], dropped = []
  const ports = {keepYield: async (row, revision) => { kept.push([row.returnRef, revision]) }, dropYield: async row => { dropped.push(row.returnRef) }}
  const binding = rec.approvalsBinding(yielding({rows: [MORNING, KEPT], pageRevision: 'page-rev-7'}), ports)
  const queue = JSON.parse(binding.values.queue)
  const row = queue.find(item => item.id === `${rec.YIELD_ROW}${MORNING.returnRef}`)
  assert.deepEqual(row, {id: 'yield:central:return:control:root:morning', kind: 'proposal', who: 'Flint', text: 'What it yielded at its end: 2 receipts, 1 change',
    where: 'Today\'s Day · face 2', session: 'Morning pages', age: 3600,
    yielded: {session: 'agent-session/morning', receipts: 2, changes: 1, account: 'Drafted the second section.'}})
  assert.equal(queue.some(item => item.id === `${rec.YIELD_ROW}${KEPT.returnRef}`), false, 'one kept waits no more')
  assert.equal(binding.values.light, 'lit')
  for (const key of ['keep', 'drop']) {
    assert.equal(binding.writes(key), true, key)
    assert.equal(binding.standing[key], undefined, `${key} stands live`)
  }
  await binding.write([{key: 'keep', value: row.id}])
  await binding.write([{key: 'drop', value: row.id}])
  assert.deepEqual(kept, [[MORNING.returnRef, 'page-rev-7']], 'kept on today\'s page as it was read')
  assert.deepEqual(dropped, [MORNING.returnRef])
  await assert.rejects(binding.write([{key: 'keep', value: `${rec.YIELD_ROW}${KEPT.returnRef}`}]), /Keep: that yield waits no more/)
  await assert.rejects(binding.write([{key: 'drop', value: 'yield:central:return:control:root:gone'}]), /Drop: that yield waits no more/)
  // Today's page is not read: what was yielded has no face 2 to land on, and nothing is asked.
  const pageless = rec.approvalsBinding(yielding({rows: [MORNING], pageRevision: null}), ports)
  await assert.rejects(pageless.write([{key: 'keep', value: row.id}]), {message: 'Keep: today\'s page is not read, so what was yielded cannot land on its face 2; nothing was kept.'})
  // What today's sessions yielded is not read: none waits, and a press says Central's words for why.
  const unread = rec.approvalsBinding(yielding({unread: 'Central did not read what today\'s sessions yielded: receiving is locked'}), ports)
  assert.equal(JSON.parse(unread.values.queue).some(item => item.yielded), false)
  await assert.rejects(unread.write([{key: 'drop', value: row.id}]),
    {message: 'Drop: Central did not read what today\'s sessions yielded: receiving is locked, so no yield stands to answer.'})
  assert.deepEqual([kept.length, dropped.length], [1, 1], 'nothing else was asked')
  // Where the chain hands no hand that answers a yield, Keep and Drop stand disabled saying so, and a press says the same.
  const bare = rec.approvalsBinding(yielding({rows: [MORNING], pageRevision: 'page-rev-7'}), {})
  assert.equal(bare.standing.keep.disabled, rec.KEEP_UNWIRED)
  assert.equal(bare.standing.drop.disabled, rec.DROP_UNWIRED)
  await assert.rejects(bare.write([{key: 'keep', value: row.id}]), {message: rec.KEEP_UNWIRED})
  await assert.rejects(bare.write([{key: 'drop', value: row.id}]), {message: rec.DROP_UNWIRED})
  // Drawn: the pane answers it with Keep and Drop and shows what it yielded, never a diff; the Queue page and the tile's card answer it
  // the same (the Review page is a run's review's and a recognition's).
  const props = page => ({v: {...binding.values, pick: row.id}, owner: binding.values, set: () => {}, nav: {}, page, setPage: () => {}, standing: binding.standing})
  const pane = html(createElement(() => approvalsDesign.full(props(''))))
  for (const words of ['>Keep<', '>Drop<', 'aria-label="What it yielded"', 'Receipts', 'Changes', 'Drafted the second section.']) assert.ok(pane.includes(words), words)
  assert.equal(pane.includes('aria-label="Diff"'), false, 'a yield carries no diff')
  const page = html(createElement(() => approvalsDesign.whole(props('queue'))))
  const tile = html(createElement(() => approvalsDesign.widget(props(''))))
  for (const [name, markup] of [['the Queue page', page], ['the tile', tile]]) {
    assert.match(markup, />Keep</, `${name} answers it with Keep`)
    assert.match(markup, />Drop</, `${name} answers it with Drop`)
  }
  assert.doesNotMatch(pane + page + tile, /\bNaN\b|undefined/)
  // The gallery (the manual's Part Three) shows one waiting.
  const shown = approvalsDesign.fixtures?.['A session yielded']
  assert.ok(JSON.parse(shown.queue).find(item => item.id === shown.pick)?.yielded, 'the gallery carries a yield waiting')
})
