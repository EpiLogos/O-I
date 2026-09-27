// The verso account's "Saving & Return" reading (owner Wayfinder §10
// commission): the native composition's saved state, its file destination
// and its local recovery checkpoint are read through the SAME owners the
// editor itself uses — never a guessed storage key, never a fabricated
// status. Language-neutral (node --test, no browser); rendering of the
// account into the page family is proven by the current-app browser walk.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const vite = await createServer({ root, appType: 'custom', server: { middlewareMode: true }, logLevel: 'error' });
const { readVersoAccount } = await vite.ssrLoadModule('/src/expression/versoAccount.ts');
test.after(() => vite.close());

const bridge = { kind: 'bridge', url: 'http://kernel-test' };
const expressionRef = 'expression:saving-account';

const document = (overrides = {}) => ({
  schema: 'oi.expression/v1', expression_ref: expressionRef, revision: 4, title: 'Saving account fixture',
  scenes: [{ scene_ref: `${expressionRef}:scene:1`, revision: 1, title: 'Scene one', entity_refs: [] }],
  entities: {}, relations: {}, selection: { scene_ref: `${expressionRef}:scene:1`, entity_ref: null },
  provenance: [], representations: [], ...overrides,
});

/** Stub the kernel bridge for exactly the ops the account read makes,
 * dispatching on the request shape the same way the real kernel does. */
function withStub(handler, fn) {
  const previous = globalThis.fetch;
  globalThis.fetch = async (_url, init) => {
    const op = JSON.parse(init.body);
    return { ok: true, json: async () => handler(op) };
  };
  return fn().finally(() => { globalThis.fetch = previous; });
}

const stateOp = { ok: true, outcome: { result: 'state', snapshot: { navigator: {} } } };

test('a found checkpoint and a clean Scene are named as their own distinct rows', async () => {
  const account = await withStub(op => {
    if (op.op === 'state') return stateOp;
    if (op.op === 'expression') return { ok: true, outcome: { result: 'expression', data: { state: 'ready', document: document(), dirty: false, file: { location: { schema: 'central.path-ref/v1', ref: 'central:path:x', root: 'x', path: 'a.json' }, revision: 'r4' } } } };
    if (op.op === 'expression_recovery') return { ok: true, outcome: { result: 'expression_recovery', data: { state: 'ready', record: { id: 'c1', scope: 'techne', kind: 'checkpoint', revision: 9, value: {} } } } };
    throw new Error(`unexpected op ${op.op}`);
  }, () => readVersoAccount(bridge, { ref: expressionRef }));
  assert.deepEqual(account.draftBackup, { found: true, revision: 9 }, 'the checkpoint the recovery owner returned is carried, not re-derived');
  assert.equal(account.sceneDirty, false, 'the owner\'s own dirty disclosure is carried verbatim');
  assert.deepEqual(account.savedFile, { ref: 'central:path:x', revision: 'r4' });
  assert.deepEqual(account.notices, [], 'a fully-resolved account carries no notices');
});

test('no checkpoint and unsaved changes are named honestly, never collapsed to one status', async () => {
  const account = await withStub(op => {
    if (op.op === 'state') return stateOp;
    if (op.op === 'expression') return { ok: true, outcome: { result: 'expression', data: { state: 'ready', document: document({ revision: 5 }), dirty: true } } };
    if (op.op === 'expression_recovery') return { ok: true, outcome: { result: 'expression_recovery', data: { state: 'ready', record: null } } };
    throw new Error(`unexpected op ${op.op}`);
  }, () => readVersoAccount(bridge, { ref: expressionRef }));
  assert.deepEqual(account.draftBackup, { found: false }, 'an absent checkpoint is its own named state, not an error');
  assert.equal(account.sceneDirty, true);
  assert.equal(account.savedFile, undefined, 'no file destination is disclosed when the owner names none');
});

test('a recovery read failure is named in notices, never silently read as "no backup"', async () => {
  const account = await withStub(op => {
    if (op.op === 'state') return stateOp;
    if (op.op === 'expression') return { ok: true, outcome: { result: 'expression', data: { state: 'ready', document: document() } } };
    if (op.op === 'expression_recovery') return { ok: false, error: 'the recovery owner is unavailable' };
    throw new Error(`unexpected op ${op.op}`);
  }, () => readVersoAccount(bridge, { ref: expressionRef }));
  assert.equal(account.draftBackup, undefined, 'a failed read leaves the field undisclosed rather than guessing');
  assert.ok(account.notices.some(notice => notice.includes('draft backup') && notice.includes('unavailable')), 'the failure is named in notices');
});

test('a non-Expression subject carries no draft-backup or Scene-dirty rows — nothing to check', async () => {
  const ops = [];
  const account = await withStub(op => {
    ops.push(op.op);
    if (op.op === 'state') return stateOp;
    if (op.op === 'knowledge') return { ok: true, outcome: { result: 'knowledge', data: { resource: 'wiki:some-page', provider: 'semantic-wiki', authority: 'owner', evidence: [] } } };
    throw new Error(`unexpected op ${op.op}`);
  }, () => readVersoAccount(bridge, { ref: 'wiki:some-page' }));
  assert.equal(account.draftBackup, undefined);
  assert.equal(account.sceneDirty, undefined);
  assert.ok(!ops.includes('expression_recovery'), 'a wiki subject never triggers the Expression recovery read');
});
