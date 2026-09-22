// LIVE gate for the "Chat & harnesses" settings face. Split out of
// chat-settings.test.mjs so the CI wider suite (no AIKit on the runner) keeps
// its contract tests while the live law stays intact: a missing `aikit` is a
// FAILED run here, never a skip. Run on a machine with the suite installed:
//   npm run test:chat-settings-live
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

