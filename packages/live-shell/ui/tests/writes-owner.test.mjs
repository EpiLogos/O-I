import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {register} from 'node:module'

const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};
import {readFile} from 'node:fs/promises';
export async function resolve(s, c, n) {
  try { return await n(s, c) } catch (e) {
    if (!s.startsWith('.')) throw e;
    if (s.endsWith('.js')) { try { return await n(s.slice(0, -3) + '.ts', c) } catch {} }
    for (const x of ['.ts', '.tsx']) { try { return await n(s + x, c) } catch {} }
    throw e;
  }
}
export async function load(u, c, n) {
  if (u.endsWith('.css')) return {format: 'module', shortCircuit: true, source: 'export {}'};
  if (/[.]html([?].*)?$/.test(u)) return {format: 'module', shortCircuit: true, source: 'export default ""'};
  if (!u.endsWith('.ts') && !u.endsWith('.tsx')) return n(u, c);
  return {format: 'module', shortCircuit: true, source: ts.transpileModule(await readFile(new URL(u), 'utf8'), {fileName: new URL(u).pathname,
    compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX}}).outputText};
}`)}`, import.meta.url)

// Which completed kernel ops tell the window's held readings that an owner's ground may have moved (kernel/bridge.ts
// `writesOwner`). A read that told would retire every held answer and have every view ask again behind it, so the reads the
// shell makes at start-up and on a session page (ground status, encounter context, Factory telemetry, Receiving's list) must not.
const {writesOwner} = await import('../../../../desktop/cradle/src/kernel/bridge.ts')

test('the reads the shell makes at start-up and on its pages never retire held answers', () => {
  const reads = [
    {op: 'ground', request: {action: 'status'}},
    {op: 'ground', request: {action: 'recognize', path: '/x'}},
    {op: 'encounter', project: 'Central', request: {action: 'context', agent_session: 's', request: {}}},
    {op: 'encounter', project: 'Central', request: {action: 'providers'}},
    {op: 'factory_owner', request: {kind: 'telemetry-digest'}},
    {op: 'factory_owner', request: {kind: 'action-list'}},
    {op: 'factory_owner', request: {kind: 'current-work'}},
    {op: 'factory_owner', request: {kind: 'locate'}},
    // A Return's reading and the files it names (O-I #759: the Factory clip reads them on each selection).
    {op: 'factory_owner', request: {kind: 'attempt-return'}},
    {op: 'factory_owner', request: {kind: 'attempt-artifacts'}},
    {op: 'shared_field', request: {kind: 'snapshot'}},
    {op: 'receiving', project: null, request: {List: {limit: 5}}},
    {op: 'routine', request: {action: 'history'}},
    {op: 'setup', request: {action: 'discover'}},
    {op: 'central', project: null, request: {kind: 'inspect'}},
    {op: 'files_list', path: 'x'},
  ]
  for (const op of reads) assert.equal(writesOwner(op, {result: 'x', receipts: []}), false, JSON.stringify(op))
})

test('writes, write verbs of mixed ops and ground receipts retire held answers', () => {
  const writes = [
    {op: 'invoke_action', request: {}},
    {op: 'ground', request: {action: 'bind', request: {}}},
    {op: 'factory_owner', request: {kind: 'run-close'}},
    {op: 'factory_owner', request: {kind: 'action-invoke'}},
    {op: 'receiving', project: null, request: {Submit: {producer_key: 'p'}}},
    {op: 'routine', request: {action: 'run_now', routine_ref: 'r'}},
    {op: 'setup', request: {action: 'apply'}},
    // An act on a Live set's objects (O-I #743) writes the set as the clip, mixer and comp writes do.
    {op: 'live_set_act', path: '/s.als', expected_revision: 'sha256:1', act: {kind: 'scene_insert', after: 0}},
    {op: 'live_clip_create', path: '/s.als', expected_revision: 'sha256:1', track: 0, length: 4, notes: []},
  ]
  for (const op of writes) assert.equal(writesOwner(op, {result: 'x', receipts: []}), true, JSON.stringify(op))
  // Any op whose outcome carries a ground receipt told the window something moved; a presentation receipt did not.
  assert.equal(writesOwner({op: 'state'}, {result: 'x', receipts: [{event: 'now_changed'}]}), true)
  assert.equal(writesOwner({op: 'surface_focus'}, {result: 'x', receipts: [{event: 'focus_changed'}]}), false)
})
