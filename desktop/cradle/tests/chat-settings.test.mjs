// The "Chat & harnesses" settings face (owner commission 2026-09-21), read
// LIVE per the acceptance law (docs/experience/HARNESS-SETTINGS-RESEARCH-
// 2026-09-22.md §4, negative roster item 1: verbatim wire/demo snapshots as
// requirements are banned — live-read round trips required). Each live test
// invokes the installed `aikit`, derives its expected counts and names from
// that read, and asserts the shaping carries them. Frozen captures are not
// requirements; the typed wire shapes stay as contracts.
// Run: node --test tests/chat-settings.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
const {
  shapeHarnessClients, shapeProviders, shapeCatalogue, shapeHeldDefault,
  effectiveChatDefault, createLiveHarnessSource,
} = await import('../src/configuration/harnessSource.ts');

/** One live read of the installed suite. A missing `aikit` is a FAILED test,
 * not a skip: a live test without its subject proves nothing. */
function readAikit(args) {
  const run = spawnSync('aikit', args, {encoding: 'utf8', maxBuffer: 64 * 1024 * 1024});
  if (run.error?.code === 'ENOENT') {
    throw new Error(
      "the live subject `aikit` is missing: this test reads the installed suite live and cannot run without the aikit binary on PATH (install the AIKit suite, or run this test on a machine that has it)",
    );
  }
  if (run.error) throw new Error(`\`aikit ${args.join(" ")}\` could not be spawned: ${run.error.message}`);
  if (run.status !== 0) {
    throw new Error(`\`aikit ${args.join(" ")}\` exited ${run.status}: ${(run.stderr || run.stdout || "").slice(0, 400)}`);
  }
  return JSON.parse(run.stdout);
}

// --- live round trips -------------------------------------------------------

test('the harness face reads `aikit --json client status` live and carries every row', () => {
  const live = readAikit(['--json', 'client', 'status']);
  assert.equal(live.ok, true, 'the installed aikit answers ok');
  const clients = live.data?.clients;
  assert.ok(Array.isArray(clients), 'the live document carries data.clients');
  assert.ok(clients.length > 0, 'the live census is not empty');

  // Distinguishable named rows: every client has its own non-empty name.
  const names = clients.map((row) => row?.client);
  for (const name of names) assert.equal(typeof name, 'string', 'every live client row is named');
  for (const name of names) assert.ok(name.length > 0, 'no live client row has an empty name');
  assert.equal(new Set(names).size, names.length, 'live client names are distinct');

  // Round trip: the shaped face carries exactly the live rows, in live order.
  const rows = shapeHarnessClients(live.data);
  assert.equal(rows.length, clients.length, 'shaping keeps every live row');
  assert.deepEqual(rows.map((row) => row.client), names, 'shaped names are the live names, in live order');

  // Typed wire contract: every row carries the face's fields, well typed.
  for (const row of rows) {
    assert.deepEqual(
      Object.keys(row).sort(),
      ['client', 'config_dir', 'detected', 'detection', 'detection_reason', 'dispatch', 'harness', 'installed'],
      'a harness row carries exactly the face contract fields',
    );
    assert.equal(typeof row.detected, 'boolean');
    assert.equal(typeof row.installed, 'boolean');
    assert.ok(row.harness.length > 0, 'every rendered row names a harness (its client when the live row has none)');
  }

  // `detected` is derived from the live detection, not asserted in the abstract.
  for (let i = 0; i < clients.length; i++) {
    const expected = clients[i].detection === 'detected' || clients[i].detection === 'self';
    assert.equal(rows[i].detected, expected, `\`${names[i]}\` detection "${clients[i].detection}" renders as detected=${expected}`);
  }
  // A live row without a harness (the resident's own client) renders under
  // its client name — checked against whatever the live read carries.
  for (let i = 0; i < clients.length; i++) {
    if (clients[i].harness == null) {
      assert.equal(rows[i].harness, clients[i].client, 'the resident row (no harness) renders under its client name');
    }
  }

  // Tolerance contracts (synthetic): absent readings are honest empties.
  assert.equal(shapeHarnessClients({}).length, 0, 'no clients reading is an honest empty');
  assert.equal(shapeHarnessClients(undefined).length, 0);
  const tolerated = shapeHarnessClients({clients: [null, {}]});
  assert.equal(tolerated.length, 2, 'a null row never crashes the face');
  assert.equal(tolerated[0].detected, false, 'an unreadable row is not claimed as detected');
});

test('the catalogue face reads `aikit model-catalogue show --json` live and derives its count', () => {
  const live = readAikit(['model-catalogue', 'show', '--json']);
  assert.equal(live.ok, true, 'the installed aikit answers ok');
  const data = live.data;
  assert.ok(Array.isArray(data?.entries), 'the live document carries data.entries');
  assert.equal(typeof data.catalogued, 'number', 'the live document declares its catalogue size');

  // Distinguishable named entries: no empty or duplicate names or models.
  const names = data.entries.map((entry) => entry?.name);
  const models = data.entries.map((entry) => entry?.model);
  for (const name of names) assert.ok(typeof name === 'string' && name.length > 0, 'every live catalogue entry is named');
  for (const model of models) assert.ok(typeof model === 'string' && model.length > 0, 'every live catalogue entry names a model');
  assert.equal(new Set(names).size, names.length, 'live catalogue names are distinct');
  assert.equal(new Set(models).size, models.length, 'live catalogue models are distinct');

  // Round trip: the count comes from the live read, not from a constant.
  const catalogue = shapeCatalogue(data);
  assert.equal(catalogue.count, data.catalogued, 'the declared live count is kept, not a page size');
  assert.equal(catalogue.entries.length, data.entries.length, 'shaping keeps every live entry');
  if (data.entries.length > 0) {
    const first = data.entries[0];
    assert.deepEqual(catalogue.entries[0], {model: first.model, name: first.name, source: first.source},
      'the first shaped entry is the live first entry');
  }

  // Typed wire contract: every entry carries exactly the three display fields.
  for (const entry of catalogue.entries) {
    assert.deepEqual(Object.keys(entry).sort(), ['model', 'name', 'source'], 'a catalogue entry carries exactly the face contract fields');
    assert.equal(typeof entry.source, 'string');
  }

  // Count law (synthetic): the declared count wins over the page size; an
  // unreadable document is an honest empty.
  assert.equal(shapeCatalogue({catalogued: 5, entries: [{model: 'm', name: 'n', source: 's'}]}).count, 5);
  assert.equal(shapeCatalogue({}).count, 0);
  assert.equal(shapeCatalogue(undefined).count, 0);
});

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
