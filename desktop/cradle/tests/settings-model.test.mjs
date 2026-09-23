// The Settings page's pure model (docs/cradle/12-SETTINGS.md): the harness
// groups, the model availability JOIN (S14), credential cards, the staged
// change law (S4/S9) and search landing — against owner-shaped documents
// (typed shapes, not frozen captures; the walks hold the live round trips).
// Run: node --experimental-strip-types --import ./tests/ts-register.mjs --test tests/settings-model.test.mjs
import test from "node:test";
import assert from "node:assert/strict";

const model = await import("../src/workspace/settings/sectionModel.ts");
const change = await import("../src/workspace/settings/changeModel.ts");
const search = await import("../src/workspace/settings/settingsSearch.ts");
const {shapeHarnessClients, shapeCatalogue} = await import("../src/configuration/harnessSource.ts");
const {shapePosture, shapeCapabilityDetails} = await import("../src/configuration/systemDisclosure.ts");

const clients = shapeHarnessClients({clients: [
  {client: "claude", harness: "claude-code", detection: "detected", capability: "descriptor", installed: true, items: 81, effect: "restart Claude", dispatch: "client"},
  {client: "pi", harness: "pi", detection: "detected", capability: "descriptor", installed: false, items: 81, effect: "next session only — pi discovers .pi/skills", dispatch: "adapter-only"},
  {client: "zcode", harness: "zcode", detection: "detected", capability: "descriptor", installed: true, items: 0, effect: "brokered — zcode loads skills natively", dispatch: "client"},
  {client: "hermes", harness: "hermes", detection: "detected", capability: "unavailable", dispatch: "adapter-only", gap: {authoring_skill_ref: "skill/aikit/harness-adapter-authoring", missing_contract: "aikit.harness-adapter/v1"}},
  {client: "aider", harness: "aider", detection: "not-installed", capability: "unavailable", dispatch: "adapter-only"},
  {client: "broker", harness: null, detection: "self", capability: "self", dispatch: "self", installed: true},
]});
const reading = {harness: {harnesses: {state: "ok", rows: clients}, catalogue: {state: "ok", rows: {count: 0, entries: []}}, providers: {state: "ok", rows: []}, heldDefault: null}, disclosure: {state: "absent", reason: "x"}};

test("harnesses group as the owner reports them, and the broker is never a harness", () => {
  assert.deepEqual(clients.map((row) => row.client), ["claude", "pi", "zcode", "hermes", "aider"], "the broker (AIKit itself) is dropped");
  assert.deepEqual(model.readyHarnesses(reading).map((row) => row.client), ["claude", "pi", "zcode"]);
  assert.deepEqual(model.adapterNeeded(reading).map((row) => row.client), ["hermes"]);
  assert.deepEqual(model.notFound(reading).map((row) => row.client), ["aider"]);
  assert.equal(model.harnessEffect(clients[0]), "Restart Claude to apply");
  assert.equal(model.harnessEffect(clients[1]), "Next session only");
  assert.equal(model.harnessEffect(clients[2]), "Skills brokered through AIKit");
  assert.equal(model.harnessItems(clients[0]), "81 skills projected");
  assert.equal(model.harnessItems(clients[1]), "81 skills ready to project");
  assert.equal(clients[3].adapter_gap.missing_contract, "aikit.harness-adapter/v1");
});

test("S14: availability is the routes JOINED with the bound keys — the route's own condition never flips", () => {
  const {entries} = shapeCatalogue({catalogued: 4, entries: [
    {model: "model:claude-x", name: "Claude X", source: "s", declared_routes: [
      {kind: "router-route", provider: "provider:openrouter", credential_required: true},
      {kind: "provider-native", provider: "provider:anthropic", credential_required: true}]},
    {model: "model:qwen-local", name: "Qwen local", source: "s", declared_routes: [{kind: "provider-native", provider: "provider:ollama", credential_required: false}]},
    {model: "model:gpt-y", name: "GPT Y", source: "s", declared_routes: [{kind: "provider-native", provider: "provider:openai", credential_required: true}]},
    {model: "model:bare", name: "Bare", source: "s"},
  ]});
  assert.equal(entries[0].routes[0].credential_required, true);
  const unbound = new Set();
  const openrouter = model.boundProviders([{credential: "credential:openrouter", revoked: false}, {credential: "anthropic", revoked: true}]);
  assert.deepEqual([...openrouter], ["openrouter"], "revoked bindings do not count");
  assert.deepEqual(model.modelAvailability(entries[0], unbound), {state: "needs-key", provider: "anthropic"}, "names the maker's own key first");
  assert.deepEqual(model.modelAvailability(entries[0], openrouter), {state: "usable", via: "openrouter"}, "usable through the bound router key while its route still requires a key");
  assert.deepEqual(model.modelAvailability(entries[0], new Set(["anthropic", "openrouter"])), {state: "usable", via: "anthropic"}, "the native route wins when its key is bound");
  assert.deepEqual(model.modelAvailability(entries[1], unbound), {state: "local", via: "ollama"});
  assert.deepEqual(model.modelAvailability(entries[3], unbound), {state: "unrouted"});
  assert.equal(model.availabilityWords(model.modelAvailability(entries[2], unbound)).chip, "Needs an OpenAI key");
  assert.equal(model.availabilityWords(model.modelAvailability(entries[0], unbound)).chip, "Needs an Anthropic key");
  assert.equal(model.modelGroup(entries[0]), "Anthropic");
});

test("credential cards: the providers that matter, then any other bound one; stored-in words", () => {
  const data = {credentials: {state: "ok", value: {bindings: [
    {credential: "openrouter", provider_ref: "provider:os-secure-store/macos-keychain", tier: "os-secure-store", provenance: "macos-keychain:service=dev.aikit.credentials;account=openrouter", revoked: false, declared_secret_ref: null},
    {credential: "credential:moonshot", tier: "brokered-secure-provider", provenance: "varlock:///x/.env/K", revoked: false, declared_secret_ref: "varlock:///x/.env/K"},
  ], materialEntry: {available: false, missing: "m"}}}, suite: {state: "reading"}};
  const cards = model.credentialCards(data);
  assert.deepEqual(cards.map((card) => card.provider), ["openrouter", "anthropic", "openai", "deepseek", "zai", "moonshot"]);
  assert.equal(cards[0].credential, "openrouter", "an existing binding keeps its own ref");
  assert.equal(cards[1].credential, "credential:anthropic", "a new one binds as credential:<provider>");
  assert.equal(model.storedIn(cards[0].binding), "Keychain");
  assert.equal(model.storedIn(cards[5].binding), "varlock");
});

test("the effect kinds in plain words (12 §2 table)", () => {
  assert.equal(model.effectInWords("value-change"), "Takes effect now");
  assert.equal(model.effectInWords("restart-required", "Claude"), "Restart Claude to apply");
  assert.equal(model.effectInWords("session-restart-required"), "Next session only");
  assert.equal(model.effectInWords("provider-reconnect-required"), "Reconnects the provider");
  assert.equal(model.effectInWords("material-effect"), "Changes files on this machine");
  assert.equal(model.briefValue({a: 1}), "1 entry");
  assert.equal(model.briefValue(["a", "b"]), "a, b");
  assert.equal(model.briefValue(true), "on");
});

const resolution = (desired, status, active = []) => ({
  schema: "oi.config-resolution/v1", setting_ref: "ai-kit:skills:skills.capabilities", scope: {scope_kind: "machine", scope_ref: null},
  desired, native: {active: {value: active}}, native_reading: {reading_digest: null, observed_at_unix_ms: 1}, reconciliation: {status, reason: null},
});

test("S4/S9: staged is held intent not yet applied — an applied ChangeSet's request is history", () => {
  assert.equal(change.isStaged(resolution({value: {"skill/a/x": true}}, "drifted")), true);
  assert.equal(change.isStaged(resolution({value: {"skill/a/x": true}, source_ref: "cs-cradle-1"}, "drifted")), false, "the engine keeps an applied ChangeSet as desired; not a pending change");
  assert.equal(change.isStaged(resolution({value: {"skill/a/x": true}, source_ref: "profile:dev"}, "drifted")), true, "a profile's staged intent is pending");
  assert.equal(change.isStaged(resolution({value: 1}, "satisfied")), false);
  assert.equal(change.isStaged(resolution(null, "drifted")), false);
  const data = {
    stagedDefault: null, suite: {state: "ok", value: {...reading, disclosure: {state: "ok", rows: {skills: [{id: "skill/a/x", name: "X"}, {id: "skill/a/y", name: "Y"}]}}}},
    registry: {state: "ok", value: {index: {"ai-kit:skills:skills.capabilities": {owner: {owner_ref: "ai-kit"}, setting: {title: "Capability toggles", effect: {kind: "session-restart-required"}, value_schema: {type: "table"}}}}}},
    resolutions: {k: resolution({value: {"skill/a/x": true, "skill/a/y": false}}, "drifted", ["skill/a/y"])},
  };
  const lines = change.stagedChanges(data);
  assert.deepEqual(lines.map((line) => [line.title, line.from, line.to, line.effect, line.scopeLabel]), [
    ["Skill · X", "off", "on", "Next session only", "This machine"],
    ["Skill · Y", "on", "off", "Next session only", "This machine"],
  ]);
  assert.equal(new Set(lines.map((line) => line.requestKey)).size, 1, "both toggles ride one owner request");
  assert.equal(change.scopeLabel({scope_kind: "project", scope_ref: "o-i"}), "This project (o-i)");
});

test("search lands on the exact row", () => {
  const data = {suite: {state: "ok", value: {...reading, disclosure: {state: "ok", rows: {skills: [{id: "skill/walkskills/walk-gamma", name: "walk-gamma"}]}}}}, credentials: {state: "reading"}, registry: {state: "reading"}};
  const index = search.searchIndex(data);
  assert.equal(search.searchSettings(index, "catalogue")[0].row, "model:catalogue");
  assert.equal(search.searchSettings(index, "walk-gamma")[0].row, "skill:machine:skill/walkskills/walk-gamma");
  assert.equal(search.searchSettings(index, "claude")[0].row, "harness:claude");
  assert.deepEqual(search.searchSettings(index, "   "), []);
});

test("posture and capability details shape from the owner's disclosure", () => {
  assert.deepEqual(shapePosture({environment_import_gate: {state: "closed"}, trust: {keys: 225, states: {trusted: 157, reviewed: 3, superseded: 65}}}),
    {environmentImport: "closed", trust: {keys: 225, states: {trusted: 157, reviewed: 3, superseded: 65}}});
  assert.deepEqual(shapePosture(null), {environmentImport: null, trust: null});
  const details = shapeCapabilityDetails([{resource: "skill/a/x", description: "Does X", annotations: {"capsule-kind": "skill"}, intent: {sources: [{source: "source/a"}]}}]);
  assert.deepEqual(details["skill/a/x"], {description: "Does X", source: "source/a", kind: "skill"});
});
