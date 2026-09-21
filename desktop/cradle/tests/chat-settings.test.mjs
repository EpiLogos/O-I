// The "Chat & harnesses" settings face (owner commission 2026-09-21): the
// shaping of the REAL harness/provider/catalogue wire shapes, the
// default-provider precedence law (owner choice > pi row > first), and the
// live source's kernel op payloads with per-section honest failure.
// Run: node --experimental-strip-types --import ./tests/ts-register.mjs --test tests/chat-settings.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
const {
  shapeHarnessClients, shapeProviders, shapeCatalogue, shapeHeldDefault,
  effectiveChatDefault, createLiveHarnessSource,
} = await import('../src/configuration/harnessSource.ts');
const { createFixtureHarnessSource } = await import('../src/configuration/harnessFixture.ts');

// Real shapes, read live on this machine (2026-09-21): aikit --json client
// status (19 clients), aikit model-catalogue show --json (345 entries),
// `encounter --request-json {"action":"providers"}` (9 rows).
const LIVE_CLIENT_ROW_DETECTED = {
  actor_bootstrap: true, capability: "descriptor", capability_reason: null,
  client: "claude", config_dir: "/Users/admin/.claude", detection: "detected",
  detection_reason: null, dispatch: "client", effect: "restart Claude", error: null,
  gap: null, harness: "claude-code", installed: true, items: 82,
  materialization_items: 83, notes: ["the managed `aikit-context` Agent Skill …"], state: "installable",
};
const LIVE_CLIENT_ROW_ABSENT = {
  actor_bootstrap: false, capability: "unavailable", capability_reason: "not found",
  client: "aider", config_dir: null, detection: "not-installed",
  detection_reason: null, dispatch: "adapter-only", effect: null, error: null, gap: null,
  harness: "aider", installed: false, items: 0, materialization_items: 0, notes: [], state: "absent",
};
const LIVE_CLIENT_ROW_BROKER = {
  actor_bootstrap: false, capability: "descriptor", capability_reason: null,
  client: "broker", config_dir: "/Users/admin/.aikit", detection: "self",
  detection_reason: null, dispatch: "self", effect: null, error: null, gap: null,
  harness: null, installed: true, items: 0, materialization_items: 0, notes: [], state: "self",
};
const LIVE_CATALOGUE_DATA = {
  catalogued: 345,
  entries: [
    {book: null, declared_routes: [], model: "model:aion-2.0", name: "AionLabs: Aion-2.0", source: "source/aikit-provider-catalog"},
    {book: null, declared_routes: [], model: "model:auto", name: "Auto Router", source: "source/aikit-provider-catalog"},
  ],
  notes: [], shown: 345, standing: "resolved",
};
const LIVE_PROVIDER_ROWS = [
  {id: "pi-archivist-confined", label: "Pi rpc sandboxed (AG campaign confined provider)"},
  {id: "pi", label: "Pi"},
  {id: "gemini-acp", label: "Gemini CLI ACP (AG65 campaign test body)"},
];

test('harness rows render the owner census verbatim, tolerant of variety', () => {
  const rows = shapeHarnessClients({clients: [LIVE_CLIENT_ROW_DETECTED, LIVE_CLIENT_ROW_ABSENT, LIVE_CLIENT_ROW_BROKER, null]});
  assert.equal(rows.length, 4, 'a null row never crashes the face');
  assert.deepEqual(rows[0], {
    harness: "claude-code", client: "claude", detection: "detected", detected: true,
    detection_reason: null, installed: true, config_dir: "/Users/admin/.claude", dispatch: "client",
  });
  assert.equal(rows[1].detected, false, 'not-installed reads as not detected');
  assert.equal(rows[1].installed, false);
  assert.equal(rows[1].config_dir, null);
  assert.equal(rows[2].harness, "broker", 'the resident row (no harness) renders under its client name');
  assert.equal(rows[2].detected, true, 'detection "self" is the resident itself');
  assert.equal(shapeHarnessClients({}).length, 0, 'no clients reading is an honest empty');
  assert.equal(shapeHarnessClients(undefined).length, 0);
});

test('providers and catalogue shape the real wire documents', () => {
  const providers = shapeProviders(LIVE_PROVIDER_ROWS);
  assert.deepEqual(providers.map((row) => row.id), ["pi-archivist-confined", "pi", "gemini-acp"], 'owner order is kept');
  assert.equal(providers[0].label, "Pi rpc sandboxed (AG campaign confined provider)");
  assert.deepEqual(shapeProviders([{label: "no id"}]), [], 'rows without ids never answer');

  const catalogue = shapeCatalogue(LIVE_CATALOGUE_DATA);
  assert.equal(catalogue.count, 345, 'the declared count is kept, not the page size');
  assert.equal(catalogue.entries.length, 2);
  assert.deepEqual(catalogue.entries[0], {model: "model:aion-2.0", name: "AionLabs: Aion-2.0", source: "source/aikit-provider-catalog"});
  assert.equal(shapeCatalogue({}).count, 0);

  assert.deepEqual(shapeHeldDefault({schema: "oi.cradle.chat-default/v1", value: "pi", set_at_unix_ms: 7}), {value: "pi", set_at_unix_ms: 7});
  assert.equal(shapeHeldDefault(null), null, 'no held document is no held choice');
  assert.equal(shapeHeldDefault({value: "   "}), null, 'a blank held value is absence');
});

test('the default-provider law: owner choice, then the pi row, then first', () => {
  const rows = shapeProviders(LIVE_PROVIDER_ROWS);
  // Owner choice wins when it names a configured row.
  assert.deepEqual(effectiveChatDefault(rows, "gemini-acp"), {provider: "gemini-acp", rule: "owner-choice"});
  assert.deepEqual(effectiveChatDefault(rows, " pi "), {provider: "pi", rule: "owner-choice"}, 'a padded choice is trimmed, not dropped');
  // Without a held choice: the pi row, else the first configured.
  assert.deepEqual(effectiveChatDefault(rows, null), {provider: "pi", rule: "pi-row"});
  assert.deepEqual(effectiveChatDefault([{id: "codex", label: "Codex"}], null), {provider: "codex", rule: "first-configured"});
  // A held choice that no longer names a configured row falls through honestly.
  assert.deepEqual(effectiveChatDefault(rows, "withdrawn-provider"), {provider: "pi", rule: "pi-row"});
  // Nothing configured is no default at all.
  assert.equal(effectiveChatDefault([], "pi"), null);
  assert.equal(effectiveChatDefault([], null), null);
});

test('the live source crosses the typed ops and shapes the answers', async () => {
  const ops = [];
  const source = createLiveHarnessSource(async (op) => {
    ops.push(op);
    return {outcome: {receipts: [], ...ANSWERS[op.op]}};
  });
  const ANSWERS = {
    harness_status: {result: "harness_status_reading", data: {clients: [LIVE_CLIENT_ROW_DETECTED, LIVE_CLIENT_ROW_ABSENT]}},
    model_catalogue: {result: "model_catalogue_reading", data: LIVE_CATALOGUE_DATA},
    encounter: {result: "encounter_reading", data: LIVE_PROVIDER_ROWS},
    chat_default_read: {result: "chat_default_reading", document: {schema: "oi.cradle.chat-default/v1", setting_ref: "oi:cradle:chat.default-provider", value: "gemini-acp", set_at_unix_ms: 5}},
    chat_default_hold: {result: "chat_default_held", document: {schema: "oi.cradle.chat-default/v1", setting_ref: "oi:cradle:chat.default-provider", value: "pi", set_at_unix_ms: 6}},
    chat_default_discard: {result: "chat_default_discarded", document: {schema: "oi.cradle.chat-default/v1", setting_ref: "oi:cradle:chat.default-provider", removed: true}},
  };

  const reading = await source.read();
  assert.equal(reading.kind, "live");
  assert.equal(reading.harnesses.state, "ok");
  assert.equal(reading.harnesses.rows.length, 2);
  assert.equal(reading.catalogue.rows.count, 345);
  assert.deepEqual(reading.providers.rows.map((row) => row.id), ["pi-archivist-confined", "pi", "gemini-acp"]);
  assert.deepEqual(reading.heldDefault, {value: "gemini-acp", set_at_unix_ms: 5});
  assert.deepEqual(ops.map((op) => op.op), ["harness_status", "model_catalogue", "encounter", "chat_default_read"], 'four reads, one round');
  assert.equal(ops[2].project, "Central", 'the providers action rides the standing Central project');
  assert.deepEqual(ops[2].request, {action: "providers"});

  // Holding and withdrawing cross their own ops, verbatim.
  await source.holdDefault("pi");
  await source.discardDefault();
  assert.deepEqual(ops.at(-2), {op: "chat_default_hold", provider: "pi"});
  assert.deepEqual(ops.at(-1), {op: "chat_default_discard"});
});

test('one failed section fails alone; the others still render', async () => {
  const source = createLiveHarnessSource(async (op) => {
    if (op.op === "model_catalogue") return {outcome: null, error: "the aikit binary is unavailable"};
    if (op.op === "encounter") return {outcome: null, error: "the resident is not running"};
    return {outcome: {receipts: [], ...({
      harness_status: {result: "harness_status_reading", data: {clients: [LIVE_CLIENT_ROW_DETECTED]}},
      chat_default_read: {result: "chat_default_reading", document: null},
    })[op.op]}};
  });
  const reading = await source.read();
  assert.equal(reading.harnesses.state, "ok");
  assert.equal(reading.catalogue.state, "failed");
  assert.match(reading.catalogue.error, /aikit binary is unavailable/);
  assert.equal(reading.providers.state, "failed");
  assert.equal(reading.heldDefault, null, 'no held document stays no held choice');
  assert.equal(reading.defaultState.state, "ok");
  await assert.rejects(source.holdDefault("pi"), /holding the chat default/, 'a hold without a real answer is refused honestly');
});

test('the fixture world renders labelled and holds its own choice', async () => {
  const source = createFixtureHarnessSource();
  assert.equal(source.kind, "fixture");
  assert.match(source.label, /fixture/i, 'the fixture provenance is on the label');
  const reading = await source.read();
  assert.equal(reading.harnesses.rows.some((row) => !row.detected), true, 'the fixture shows an absent harness too');
  assert.equal(reading.heldDefault, null);
  await source.holdDefault("pi");
  assert.equal((await source.read()).heldDefault.value, "pi");
  await source.discardDefault();
  assert.equal((await source.read()).heldDefault, null);
});
