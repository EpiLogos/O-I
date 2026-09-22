// The "Chat & harnesses" settings face (owner commission 2026-09-21), read
// LIVE per the acceptance law (docs/experience/HARNESS-SETTINGS-RESEARCH-
// 2026-09-22.md §4, negative roster item 1: verbatim wire/demo snapshots as
// requirements are banned — live-read round trips required). Each live test
// invokes the installed `aikit`, derives its expected counts and names from
// that read, and asserts the shaping carries them. Frozen captures are not
// requirements; the typed wire shapes stay as contracts.
// The live round trips live in tests/chat-settings.live.mjs (npm run
// test:chat-settings-live); this file keeps the typed contracts CI can run.
// Run: node --test tests/chat-settings.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
const {
  shapeHarnessClients, shapeProviders, shapeCatalogue, shapeHeldDefault,
  effectiveChatDefault, createLiveHarnessSource,
} = await import('../src/configuration/harnessSource.ts');


// --- shape contracts (synthetic documents; typed, not frozen captures) ------

test('providers shape in owner order and rows without ids never answer', () => {
  const providers = shapeProviders([
    {id: 'archivist', label: 'Archivist'},
    {id: 'pi', label: 'Pi'},
    {id: 'acp-body', label: 'ACP test body'},
  ]);
  assert.deepEqual(providers.map((row) => row.id), ['archivist', 'pi', 'acp-body'], 'owner order is kept');
  assert.equal(providers[0].label, 'Archivist');
  assert.deepEqual(shapeProviders([{label: 'no id'}]), [], 'rows without ids never answer');
  assert.deepEqual(shapeProviders(undefined), []);

  assert.deepEqual(shapeHeldDefault({schema: 'oi.cradle.chat-default/v1', value: 'pi', set_at_unix_ms: 7}), {value: 'pi', set_at_unix_ms: 7});
  assert.equal(shapeHeldDefault(null), null, 'no held document is no held choice');
  assert.equal(shapeHeldDefault({value: '   '}), null, 'a blank held value is absence');
});

test('the default-provider law: owner choice, then the pi row, then first', () => {
  const rows = shapeProviders([
    {id: 'archivist', label: 'Archivist'},
    {id: 'pi', label: 'Pi'},
    {id: 'acp-body', label: 'ACP test body'},
  ]);
  // Owner choice wins when it names a configured row.
  assert.deepEqual(effectiveChatDefault(rows, 'acp-body'), {provider: 'acp-body', rule: 'owner-choice'});
  assert.deepEqual(effectiveChatDefault(rows, ' pi '), {provider: 'pi', rule: 'owner-choice'}, 'a padded choice is trimmed, not dropped');
  // Without a held choice: the pi row, else the first configured.
  assert.deepEqual(effectiveChatDefault(rows, null), {provider: 'pi', rule: 'pi-row'});
  assert.deepEqual(effectiveChatDefault([{id: 'codex', label: 'Codex'}], null), {provider: 'codex', rule: 'first-configured'});
  // A held choice that no longer names a configured row falls through honestly.
  assert.deepEqual(effectiveChatDefault(rows, 'withdrawn-provider'), {provider: 'pi', rule: 'pi-row'});
  // Nothing configured is no default at all.
  assert.equal(effectiveChatDefault([], 'pi'), null);
  assert.equal(effectiveChatDefault([], null), null);
});

// --- the live source's typed wire contracts (stub transport) -----------------

test('the live source crosses the typed ops and shapes the answers', async () => {
  const ops = [];
  const source = createLiveHarnessSource(async (op) => {
    ops.push(op);
    return {outcome: {receipts: [], ...ANSWERS[op.op]}};
  });
  const ANSWERS = {
    harness_status: {result: 'harness_status_reading', data: {clients: [{client: 'claude', harness: 'claude-code', detection: 'detected', installed: true, config_dir: '/x/.claude', dispatch: 'client'}]}},
    model_catalogue: {result: 'model_catalogue_reading', data: {catalogued: 2, entries: [{model: 'model:a', name: 'A', source: 's'}]}},
    encounter: {result: 'encounter_reading', data: [{id: 'pi', label: 'Pi'}]},
    chat_default_read: {result: 'chat_default_reading', document: {schema: 'oi.cradle.chat-default/v1', setting_ref: 'oi:cradle:chat.default-provider', value: 'pi', set_at_unix_ms: 5}},
    chat_default_hold: {result: 'chat_default_held', document: {schema: 'oi.cradle.chat-default/v1', setting_ref: 'oi:cradle:chat.default-provider', value: 'pi', set_at_unix_ms: 6}},
    chat_default_discard: {result: 'chat_default_discarded', document: {schema: 'oi.cradle.chat-default/v1', setting_ref: 'oi:cradle:chat.default-provider', removed: true}},
  };

  const reading = await source.read();
  assert.equal(reading.kind, 'live');
  assert.equal(reading.harnesses.state, 'ok');
  assert.equal(reading.harnesses.rows.length, 1);
  assert.equal(reading.catalogue.rows.count, 2);
  assert.deepEqual(reading.providers.rows.map((row) => row.id), ['pi']);
  assert.deepEqual(reading.heldDefault, {value: 'pi', set_at_unix_ms: 5});
  assert.deepEqual(ops.map((op) => op.op), ['harness_status', 'model_catalogue', 'encounter', 'chat_default_read'], 'four reads, one round');
  assert.equal(ops[2].project, 'Central', 'the providers action rides the standing Central project');
  assert.deepEqual(ops[2].request, {action: 'providers'});

  // Holding and withdrawing cross their own typed ops.
  await source.holdDefault('pi');
  await source.discardDefault();
  assert.deepEqual(ops.at(-2), {op: 'chat_default_hold', provider: 'pi'});
  assert.deepEqual(ops.at(-1), {op: 'chat_default_discard'});
});

test('one failed section fails alone; the others still render', async () => {
  const source = createLiveHarnessSource(async (op) => {
    if (op.op === 'model_catalogue') return {outcome: null, error: 'the aikit binary is unavailable'};
    if (op.op === 'encounter') return {outcome: null, error: 'the resident is not running'};
    return {outcome: {receipts: [], ...({
      harness_status: {result: 'harness_status_reading', data: {clients: [{client: 'claude', harness: 'claude-code', detection: 'detected'}]}},
      chat_default_read: {result: 'chat_default_reading', document: null},
    })[op.op]}};
  });
  const reading = await source.read();
  assert.equal(reading.harnesses.state, 'ok');
  assert.equal(reading.catalogue.state, 'failed');
  assert.match(reading.catalogue.error, /aikit binary is unavailable/);
  assert.equal(reading.providers.state, 'failed');
  assert.equal(reading.heldDefault, null, 'no held document stays no held choice');
  assert.equal(reading.defaultState.state, 'ok');
  await assert.rejects(source.holdDefault('pi'), /holding the chat default/, 'a hold without a real answer is refused honestly');
});
