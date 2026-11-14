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
    // The World's reading of the worlds alone (O-I #858): it brings no field's rows into view.
    {op: 'shared_field', request: {kind: 'worlds'}},
    // The `receiving` op reads alone (Receiving's List, Read and Document); its writes are Central's Actions (O-I #1002).
    {op: 'receiving', project: null, request: {List: {limit: 5}}},
    {op: 'receiving', project: null, request: {Read: {return_ref: 'r'}}},
    {op: 'receiving', project: null, request: {Document: {source_ref: 's', document_id: 'd'}}},
    // A file's history and a recovery's preview: `file_operation` reads alone, a save and a restore being Actions.
    {op: 'file_operation', location: {}, request: {action: 'history'}},
    {op: 'file_operation', location: {}, request: {action: 'recovery_preview', expected_revision: 'a', revision: 'b'}},
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
    // Receiving's writes, a file's save and the Day's close: Central's Actions through `act` (O-I #1002).
    {op: 'act', action: 'central.receiving.submit', input: {project: null, producer_key: 'p', occurred_at_unix_seconds: 1}},
    {op: 'act', action: 'central.files.write', input: {location: {}, expected_revision: 'a', content: 'x'}},
    {op: 'act', action: 'central.day.lifecycle', input: {project: null, day_ref: 'd', expected_revision: 'a', expected_relations_revision: 'b', lifecycle: 'closed'}},
    {op: 'routine', request: {action: 'run_now', routine_ref: 'r'}},
    {op: 'setup', request: {action: 'apply'}},
    // An act on a Live set's objects (O-I #743) writes the set as the clip, mixer and comp writes do.
    {op: 'live_set_act', path: '/s.als', expected_revision: 'sha256:1', act: {kind: 'scene_insert', after: 0}},
    {op: 'live_clip_create', path: '/s.als', expected_revision: 'sha256:1', track: 0, length: 4, notes: []},
    // Showing a work at a star writes the field, though its verb ends in a reading word (O-I #858 SF12); taking an offer, likewise
    {op: 'shared_field', request: {kind: 'work-show', star_ref: 'star:s', world_ref: 'world:w', shown: {}}},
    {op: 'shared_field', request: {kind: 'offer-take', offer_ref: 'offer:o', world_ref: 'world:w'}},
    {op: 'factory_owner', request: {kind: 'task-offer-act', state_path: '/s', verb: 'offer-make', request: {}}},
  ]
  for (const op of writes) assert.equal(writesOwner(op, {result: 'x', receipts: []}), true, JSON.stringify(op))
  // Any op whose outcome carries a ground receipt told the window something moved; a presentation receipt did not.
  assert.equal(writesOwner({op: 'state'}, {result: 'x', receipts: [{event: 'now_changed'}]}), true)
  assert.equal(writesOwner({op: 'surface_focus'}, {result: 'x', receipts: [{event: 'focus_changed'}]}), false)
})

test('an owner Action reads only where the kernel says it took it as a reading (kernel action.rs reads_only)', () => {
  // The kernel classes an Action by Central's catalogue first and by its own name rule only where the catalogue is silent, and its
  // outcome says when it took the Action as a reading (`reads_only`). The bridge keeps no rule of its own: the Collections read at
  // idle (frame/browser/collections.ts) must not retire every held answer, and writes whose names end in a reading word must.
  const invoke = action => ({op: 'invoke_action', project: null, invocation: {action, target_ref: `central:action:${action}`, input: {}}})
  const dispatched = {result: 'action_dispatched', receipts: [], dispatch: {state: 'invoked', owner_operation: 'ctrl', data: {}}}
  assert.equal(writesOwner(invoke('central.collections.read'), {...dispatched, reads_only: true}), false, 'a read-only Action, as the kernel says')
  assert.equal(writesOwner(invoke('projectcentral.source.read'), {...dispatched, reads_only: true}), false, 'a reconcile of derived state')
  // Writes by Central's class, though their last word reads: showing a collection, resolving a source transfer.
  assert.equal(writesOwner(invoke('central.collections.show'), dispatched), true, 'central.collections.show writes')
  assert.equal(writesOwner(invoke('projectcentral.source.transfer.resolve'), dispatched), true, 'source.transfer.resolve writes')
  // Where the outcome does not say (an older kernel, a refusal, no outcome), an Action stays a write.
  assert.equal(writesOwner(invoke('central.collections.read'), dispatched), true, 'an outcome that does not say')
  assert.equal(writesOwner(invoke('central.collections.read'), null), true, 'no outcome')
  assert.equal(writesOwner(invoke('central.collections.read')), true, 'no outcome given')
  assert.equal(writesOwner(invoke('central.collections.read'), {result: 'x', reads_only: true, receipts: []}), true, 'the word belongs to an Action dispatch')
  assert.equal(writesOwner(invoke('central.collections.read'), {...dispatched, reads_only: 'yes'}), true, 'only true says it')
  // A ground receipt still tells, whatever the Action was taken as.
  assert.equal(writesOwner(invoke('central.collections.read'), {...dispatched, reads_only: true, receipts: [{event: 'now_changed'}]}), true)
})
