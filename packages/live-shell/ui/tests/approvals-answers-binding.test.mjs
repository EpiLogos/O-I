// #772: Approvals' new answers (manual §19.14 "What waits": a proposal's Approve, Changes or Deny; a request's Approve, Deny or Open; a review's
// Confirm or Changes, with Collect; a recognition's Recognise, Close or Continue) and its view at the manual's defaults (§19.14 Parameters:
// Show All, Order Oldest first, Follow On). Deny on a proposal is Central's projectcentral.source.return_reject {project, return_ref}
// (ctrl's source_return.rs; the kernel's flow.rs source_return_reject reads it the same way), through invoke_action as every return's answer
// is (centralWrite). A review's and a recognition's answers stand refused, each naming what Approvals is not handed or the op it lacks.
// Channel: SCRIPTED — Central's answers go to a recording port, never to the owner. Not a screen pass.
import test from 'node:test'
import assert from 'node:assert/strict'
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
const bind = await import('../src/agent/devices/designBindings.ts')
const rec = await import('../src/agent/devices/receiptBindings.ts')

const PENDING = {return_ref: 'central:return:project:o-i:1792300000000000000-4242', source_ref: 'central:source:project:O-I:README.md', basis_revision: 'r1', status: 'pending',
  agent_session_ref: 'agent-session/flint', current_revision: 'r1'}
const ACCEPTED = {...PENDING, return_ref: 'central:return:project:o-i:1792300001000000000-4243', status: 'accepted'}
const input = () => ({gateway: {}, session: null, encounter: null, holds: bind.chainHolds(), returns: {entries: [PENDING, ACCEPTED]}, tracks: [], nowUnixMs: Date.UTC(2026, 9, 28)})

test('Approvals\' view stands at the manual\'s defaults: Show All, Order Oldest first, Follow On', () => {
  bind.resetHolds()
  const binding = rec.approvalsBinding(input(), null, {})
  assert.deepEqual([binding.values.show, binding.values.order, binding.values.follow], ['all', 'oldest', true])
  assert.equal(typeof binding.local.follow, 'function', 'Follow is the hand\'s')
})

test('Deny on a proposal is Central\'s return_reject, for a return that waits; with no carrier it stands disabled saying so', async () => {
  bind.resetHolds()
  const asked = []
  const binding = rec.approvalsBinding(input(), null, {reject: async row => { asked.push(row.return_ref) }})
  assert.equal(binding.writes('reject'), true)
  assert.equal(binding.standing.reject, undefined)
  await binding.write([{key: 'reject', value: PENDING.return_ref}])
  assert.deepEqual(asked, [PENDING.return_ref])
  await assert.rejects(binding.write([{key: 'reject', value: ACCEPTED.return_ref}]), /Deny: that proposal waits no more/)
  assert.equal(asked.length, 1)
  const bare = rec.approvalsBinding(input(), null, {})
  assert.equal(bare.standing.reject.disabled, rec.REJECT_UNWIRED)
  assert.match(rec.REJECT_UNWIRED, /projectcentral\.source\.return_reject/)
})

test('a review\'s and a recognition\'s answers stand refused, each naming what Approvals lacks; a press says the same', async () => {
  bind.resetHolds()
  const binding = rec.approvalsBinding(input(), null, {})
  for (const key of ['confirm', 'reviewChanges', 'collect', 'recognise', 'close', 'continue']) {
    assert.equal(binding.writes(key), true, `${key}: the press reaches its refusal`)
    assert.equal(binding.standing[key]?.disabled, rec.APPROVALS_ANSWERS_REFUSED[key], `${key} stands disabled with its reason`)
    await assert.rejects(binding.write([{key, value: 'x'}]), {message: rec.APPROVALS_ANSWERS_REFUSED[key]})
  }
  assert.match(rec.APPROVALS_ANSWERS_REFUSED.confirm, /attempt-receiving/)
  assert.match(rec.APPROVALS_ANSWERS_REFUSED.recognise, /Recognise/)
  assert.match(rec.APPROVALS_ANSWERS_REFUSED.continue, /missing op/)
})
