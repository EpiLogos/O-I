/** Exercise the shipped startup function against the real retained owner.
 * No private body fixture or synthetic kernel acknowledgement is used. */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {reopenConfiguredWorks} from '../src/continuation.ts';
import {kernelOp} from '../../../desktop/cradle/src/kernel/bridge.ts';

const argument = name => {
  const i = process.argv.indexOf(name);
  if (i < 0 || !process.argv[i + 1]) throw Error(`Pass ${name}`);
  return process.argv[i + 1];
};
const url = argument('--kernel-url'), configPath = argument('--config');
const bytes = await readFile(configPath), config = JSON.parse(bytes);
assert.equal(config.schema, 'techne.shell.saved-work-config/v1');
const transport = {kind: 'bridge', url};
const controller = new AbortController();
const context = {mode: 'expressions', bindingId: 'native-startup-acceptance', epoch: 1,
  signal: controller.signal, state: null, current: () => !controller.signal.aborted};
const receipts = [], calls = [];
const call = async (op, request, ctx = context) => {
  const reply = await kernelOp(transport, {op, request}, ctx.signal);
  if (reply.error || !reply.outcome) throw Error(reply.error ?? 'Native owner did not answer');
  assert.equal(reply.outcome.result, op);
  calls.push({op, operation: request.operation});
  receipts.push(...reply.outcome.receipts);
  return reply.outcome.data;
};
const owners = {channels: {
  'expression-recovery': (request, ctx) => call('expression_recovery', request, ctx),
  'kernel-expression': (request, ctx) => call('expression', request, ctx),
}};
const initial = await call('expression', {operation: 'list'});
if (process.argv.includes('--require-empty')) assert.equal(initial.expressions.length, 0);
// Bind exact acceptance to each current real retained source revision. The
// normal launch config keeps identities, so subsequent acknowledged edits
// can continue without a stale hard-coded revision being silently bypassed.
const sources = [], works = [];
for (const work of config.works) {
  const read = await call('expression_recovery', {operation: 'read', scope: work.scope, kind: 'checkpoint', id: work.checkpoint_id});
  const record = read.record;
  assert.ok(record && record.value?.view?.document, 'Actual configured checkpoint must exist');
  sources.push(record.value.view.document);
  works.push({...work, expected_basis: {storage_revision: record.revision, document_revision: record.value.view.document.revision}});
}
const start = receipts.length;
const continued = await reopenConfiguredWorks(owners, context, works);
assert.equal(continued.state, 'ready');
assert.equal(continued.works.length, works.length);
const openedReceipts = receipts.slice(start);
for (let i = 0; i < works.length; i++) {
  const inspected = await call('expression', {operation: 'inspect', expression_ref: works[i].expression_ref});
  // Keep private material out of assertion output on a failure.
  assert.ok(JSON.stringify(inspected.document) === JSON.stringify(sources[i]), 'Native inspection must equal its actual retained basis');
}
const beforeRepeat = receipts.length;
const repeated = await reopenConfiguredWorks(owners, context, works);
assert.deepEqual(repeated, continued);
assert.equal(receipts.length, beforeRepeat, 'Idempotent startup must emit no new native change');
// A real owner refusal for an absent canonical id must remain a refusal.
const absent = `expression:startup-absent-${crypto.randomUUID()}`;
await assert.rejects(reopenConfiguredWorks(owners, context, [{scope: 'expressions', checkpoint_id: absent, expression_ref: absent}]), /no configured checkpoint/);
assert.ok(calls.every(c => c.operation === 'read' || c.operation === 'open' || c.operation === 'list' || c.operation === 'inspect'),
  'Startup must not restore, write recovery, replay pending, or weaken native revision guards');
console.log(JSON.stringify({schema: 'techne.new-shell.startup-acceptance/v1', result: 'passed',
  kernel_url: url, config_path: configPath, config_sha256: createHash('sha256').update(bytes).digest('hex'),
  initial_expression_count: initial.expressions.length, works: continued.works,
  native_open_receipts: openedReceipts, exact_retained_inspections: works.length,
  repeated_open_receipts: receipts.length - beforeRepeat, absent_native_checkpoint_refusal: true,
  pending_not_replayed: true, recovery_writes: 0}, null, 2));
