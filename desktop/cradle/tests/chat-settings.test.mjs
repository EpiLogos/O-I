// The "Chat & harnesses" settings face (owner commission 2026-09-21), read
// LIVE per the acceptance law (docs/experience/CASES.md AFN1; formerly HARNESS-SETTINGS-RESEARCH-
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
  shapeHarnessClients, shapeProviders, shapeCatalogue, createLiveHarnessSource,
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
});

// Which agent a new chat talks to is the census's (the World Model's agents, O-I #1003): no desktop-held default is read or written.

// --- the live source's typed wire contracts (stub transport) -----------------

test('the live source crosses the typed ops and shapes the answers', async () => {
  const ops = [];
  const source = createLiveHarnessSource(async (op) => {
    ops.push(op);
    return {outcome: {receipts: [], ...ANSWERS[op.op]}};
  });
  const ANSWERS = {
    harness_status: {result: 'harness_status_reading', data: {clients: [{client: 'claude', harness: 'claude-code', detection: 'detected', config_dir_present: true, config_dir: '/x/.claude', dispatch: 'client'}]}},
    model_catalogue: {result: 'model_catalogue_reading', data: {catalogued: 2, entries: [{model: 'model:a', name: 'A', source: 's'}]}},
    encounter: {result: 'encounter_reading', data: [{id: 'pi', label: 'Pi'}]},
  };

  const reading = await source.read();
  assert.equal(reading.kind, 'live');
  assert.equal(reading.harnesses.state, 'ok');
  assert.equal(reading.harnesses.rows.length, 1);
  assert.equal(reading.catalogue.rows.count, 2);
  assert.deepEqual(reading.providers.rows.map((row) => row.id), ['pi']);
  assert.deepEqual(ops.map((op) => op.op), ['harness_status', 'model_catalogue', 'encounter'], 'three reads, one round, and no held default');
  assert.equal(ops[2].project, 'Central', 'the providers action rides the standing Central project');
  assert.deepEqual(ops[2].request, {action: 'providers'});
  assert.equal('holdDefault' in source, false, 'the source holds no chat default');
});

test('one failed section fails alone; the others still render', async () => {
  const source = createLiveHarnessSource(async (op) => {
    if (op.op === 'model_catalogue') return {outcome: null, error: 'the aikit binary is unavailable'};
    if (op.op === 'encounter') return {outcome: null, error: 'the resident is not running'};
    return {outcome: {receipts: [], ...({
      harness_status: {result: 'harness_status_reading', data: {clients: [{client: 'claude', harness: 'claude-code', detection: 'detected'}]}},
    })[op.op]}};
  });
  const reading = await source.read();
  assert.equal(reading.harnesses.state, 'ok');
  assert.equal(reading.catalogue.state, 'failed');
  assert.match(reading.catalogue.error, /aikit binary is unavailable/);
  assert.equal(reading.providers.state, 'failed');
});
