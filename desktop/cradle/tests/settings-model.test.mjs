// The Settings page's pure model (docs/cradle/12-SETTINGS.md): the agents
// as the census says them, the model availability JOIN (S14), credential
// cards, the staged change law (S4/S9) and search landing — against
// owner-shaped documents (typed shapes, not frozen captures; the walks hold
// the live round trips). The Status card is rendered on the server, its
// census read from a stubbed World Model store.
// Run: node --experimental-strip-types --import ./tests/ts-register.mjs --test tests/settings-model.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import {build} from "esbuild";
import {mkdtemp, rm} from "node:fs/promises";
import {dirname, join, sep} from "node:path";
import {fileURLToPath, pathToFileURL} from "node:url";
import {createElement} from "react";
import {renderToStaticMarkup} from "react-dom/server";

const model = await import("../src/workspace/settings/sectionModel.ts");
const change = await import("../src/workspace/settings/changeModel.ts");
const search = await import("../src/workspace/settings/settingsSearch.ts");
const {shapeHarnessClients, shapeCatalogue} = await import("../src/configuration/harnessSource.ts");
const {shapePosture, shapeCapabilityDetails} = await import("../src/configuration/systemDisclosure.ts");
const {censusOf} = await import("../src/agency/census.ts");

/** The agents on this machine: the census (kernel census.rs, the World Model's agents slice; O-I #1003), as the Harnesses section
 * reads and draws it, one card per agent. Claude Code and Codex start and a person can talk to them; OpenClaw starts but AIKit opens no
 * conversation with it; OpenCode does not start. */
const agentsSlice = (agents) => ({state: "held", answer: {schema: "oi.world-model-slice/v1", slice: "agents", owner: "kernel", scopes: ["machine"], version: 1,
  state: "read", error: null, read_at_unix_ms: 1, value: {agents}}});
const CENSUS = censusOf(agentsSlice([
  {slug: "claude-code", harness_ref: "harness/claude-code", executable: "/x/claude", starts: true, talks: true, version: "2.1.323", aikit: {client: "claude", harness: "claude-code"}},
  {slug: "codex", harness_ref: "harness/codex", executable: "/x/codex", starts: true, talks: true, version: "codex-cli 0.155.1", aikit: {client: "codex", harness: "codex"}},
  {slug: "openclaw", harness_ref: "harness/openclaw", executable: "/x/openclaw", starts: true, talks: false, version: "1.0", why: "AIKit opens no conversation with openclaw: no face", aikit: null},
  {slug: "opencode", harness_ref: "harness/opencode", executable: "/x/opencode", starts: false, talks: false, why: "/x/opencode --version exited 1", aikit: null},
]));
const UNREAD = [censusOf({state: "reading"}), censusOf({state: "unavailable", reason: "The World Model has not answered yet."})];

const clients = shapeHarnessClients({clients: [
  {client: "claude", harness: "claude-code", detection: "detected", capability: "descriptor", config_dir_present: true, items: 81, effect: "restart Claude", dispatch: "client"},
  {client: "pi", harness: "pi", detection: "detected", capability: "descriptor", config_dir_present: false, items: 81, effect: "next session only — pi discovers .pi/skills", dispatch: "adapter-only"},
  {client: "zcode", harness: "zcode", detection: "detected", capability: "descriptor", config_dir_present: true, items: 0, effect: "brokered — zcode loads skills natively", dispatch: "client"},
  {client: "hermes", harness: "hermes", detection: "detected", capability: "unavailable", dispatch: "adapter-only", gap: {authoring_skill_ref: "skill/aikit/harness-adapter-authoring", missing_contract: "aikit.harness-adapter/v1"}},
  {client: "aider", harness: "aider", detection: "not-installed", capability: "unavailable", dispatch: "adapter-only"},
  {client: "broker", harness: null, detection: "self", capability: "self", dispatch: "self", config_dir_present: true},
]});
const reading = {harness: {harnesses: {state: "ok", rows: clients}, catalogue: {state: "ok", rows: {count: 0, entries: []}}, providers: {state: "ok", rows: []}}, disclosure: {state: "absent", reason: "x"}};

test("AIKit's client rows shape as the owner reports them, sign-in is offered for the census's agents AIKit has a client for, and the broker is never a harness", () => {
  assert.deepEqual(clients.map((row) => row.client), ["claude", "pi", "zcode", "hermes", "aider"], "the broker (AIKit itself) is dropped");
  assert.deepEqual(model.signInClients(CENSUS), ["claude", "codex"], "AuthLogin offers a sign-in for the census's agents, by AIKit's client name, as the shell's Sign in does");
  for (const census of UNREAD) assert.deepEqual(model.signInClients(census), [], `a census ${census.state} offers no sign-in`);
  for (const gone of ["adapterNeeded", "adapterNeededReason", "notFound", "readyHarnesses"]) assert.equal(model[gone], undefined, `${gone}: AIKit's own list of the agents is gone; the census lists them (O-I #1003)`);
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
    suite: {state: "ok", value: {...reading, disclosure: {state: "ok", rows: {skills: [{id: "skill/a/x", name: "X"}, {id: "skill/a/y", name: "Y"}]}}}},
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
  const index = search.searchIndex(data, CENSUS);
  assert.equal(search.searchSettings(index, "catalogue")[0].row, "model:catalogue");
  assert.equal(search.searchSettings(index, "walk-gamma")[0].row, "skill:machine:skill/walkskills/walk-gamma");
  assert.equal(search.searchSettings(index, "claude")[0].row, "agent:claude-code", "an agent lands on its census card");
  assert.equal(search.searchSettings(index, "claude sign in")[0].row, "agent:claude-code", "AIKit's client detail on that card answers to its words, on the agent's one entry");
  assert.deepEqual(search.searchSettings(index, "catalogue")[0].place, {kind: "section", id: "harnesses"});
  assert.equal(index.some(entry => entry.place.id === "models"), false, "search never lands on the retired page");
  assert.deepEqual(search.searchSettings(index, "   "), []);
});

test("posture and capability details shape from the owner's disclosure", () => {
  assert.deepEqual(shapePosture({environment_import_gate: {state: "closed"}, trust: {keys: 225, states: {trusted: 157, reviewed: 3, superseded: 65}}}),
    {environmentImport: "closed", trust: {keys: 225, states: {trusted: 157, reviewed: 3, superseded: 65}}});
  assert.deepEqual(shapePosture(null), {environmentImport: null, trust: null});
  const details = shapeCapabilityDetails([{resource: "skill/a/x", description: "Does X", annotations: {"capsule-kind": "skill"}, intent: {sources: [{source: "source/a"}]}}]);
  assert.deepEqual(details["skill/a/x"], {description: "Does X", source: "source/a", kind: "skill"});
});

// O-I #1003 review, finding 13: Harnesses draws the census, so search indexes the census's agents at the rows that section draws — an
// agent's card (`agent:<slug>`) and, where AIKit keeps model defaults, a Default model row (`model:<slug>`) for each agent a person can
// talk to. AIKit adds detail, never an entry: a provider row the census does not list (kimi, a prime connection, a test campaign's
// row) and AIKit's client rows (here Claude Code read as not installed, hermes without an adapter, aider not found) are no result,
// and no entry lands on a `harness:` row nothing draws.
test("search indexes one entry per census agent at its card, and a Default model entry only for the agents New chats draws a row for", () => {
  const aikitClients = shapeHarnessClients({clients: [
    {client: "claude", harness: "claude-code", detection: "not-installed", capability: "descriptor", dispatch: "client"},
    {client: "hermes", harness: "hermes", detection: "detected", capability: "unavailable", dispatch: "adapter-only"},
    {client: "aider", harness: "aider", detection: "not-installed", capability: "unavailable", dispatch: "adapter-only"},
  ]});
  const data = {
    suite: {state: "ok", value: {...reading, harness: {...reading.harness, harnesses: {state: "ok", rows: aikitClients}, providers: {state: "ok", rows: [
      {id: "claude-code", label: "Claude Code", protocol: "acp", command: "claude-code-acp"},
      {id: "kimi", label: "kimi", protocol: "acp", command: "kimi"},
      {id: "native-connection-a", label: "Epi Prime", protocol: "prime-rpc"},
      {id: "openclaw", label: "openclaw", protocol: "acp", command: "openclaw"},
    ]}}}}, credentials: {state: "reading"},
    registry: {state: "ok", value: {index: {"ai-kit:models:models.default": {}}, entries: []}},
  };
  const agentRows = (index) => index.map((entry) => entry.row ?? "").filter((row) => /^(agent|harness|harness-install):/.test(row) || (/^model:/.test(row) && !["model:ranking-policy", "model:catalogue"].includes(row)));
  const index = search.searchIndex(data, CENSUS);
  assert.deepEqual(agentRows(index), ["agent:claude-code", "agent:codex", "agent:openclaw", "agent:opencode", "model:claude-code", "model:codex"]);
  for (const word of ["kimi", "prime", "native-connection", "hermes", "aider"]) assert.deepEqual(search.searchSettings(index, word), [], `${word}: no agent of the census, so no result`);
  const named = search.searchSettings(index, "default model claude")[0];
  assert.deepEqual([named.row, named.label, named.place], ["model:claude-code", "Default model for Claude Code", {kind: "section", id: "harnesses"}]);
  assert.deepEqual(search.searchSettings(index, "default model openclaw"), [], "an agent a person cannot talk to has no Default model row");
  assert.deepEqual(search.searchSettings(index, "opencode").map((hit) => hit.row), ["agent:opencode"], "an agent that does not start keeps its card");
  for (const census of UNREAD) assert.deepEqual(agentRows(search.searchIndex(data, census)), [], `a census ${census.state}: no agent is named`);
  data.registry.value.index = {};
  assert.equal(search.searchSettings(search.searchIndex(data, CENSUS), "default model").length, 0, "an unavailable owner setting must not produce a dead search target");
});

// The same finding: the count beside Harnesses and its Status card are the census's agents that start (the cards the section draws as
// starting), never AIKit's client rows; Permissions names the agents a person can talk to, from the census.
test("the navigator's Harnesses count, the Status card and Permissions read the census, whatever AIKit's client rows say", async () => {
  const {register} = await import("node:module");
  register("./ts-transpile-hook.mjs", import.meta.url); globalThis.__CRADLE_WALK__ = false;
  const {sectionCount} = await import("../src/workspace/settings/SettingsNavigator.tsx");
  // AIKit reads Claude Code as not installed in an isolated home, and one other client as ready: the census starts Claude Code.
  const aikitClients = shapeHarnessClients({clients: [
    {client: "claude", harness: "claude-code", detection: "not-installed", capability: "descriptor", dispatch: "client"},
    {client: "pi", harness: "pi", detection: "detected", capability: "descriptor", dispatch: "adapter-only"},
  ]});
  const data = {suite: {state: "ok", value: {...reading, harness: {...reading.harness, harnesses: {state: "ok", rows: aikitClients}}}}, credentials: {state: "reading"}};
  assert.equal(sectionCount("harnesses", data, CENSUS), 3, "Claude Code, Codex and OpenClaw start: the census's count, not AIKit's one ready row");
  for (const census of UNREAD) assert.equal(sectionCount("harnesses", data, census), null, `a census ${census.state} is no count`);
  assert.deepEqual(model.agentCounts(CENSUS), {agents: 4, starting: 3, talking: 2});
  assert.equal(model.agentsLine(CENSUS), "3 of 4 start on this machine · 2 you can talk to");
  assert.equal(model.agentsLine(censusOf(agentsSlice([]))), "Actuation detects no agent harness on this machine.");
  for (const census of UNREAD) assert.equal(model.agentsLine(census), null);
  assert.equal(model.permissionModeAgents(CENSUS), "Claude Code, Codex");
  for (const census of UNREAD) assert.equal(model.permissionModeAgents(census), "each agent");
  // The default-mode table's rows are the census's talking agents, each with the modes its sessions were seen offering; a connection seen
  // in a session that is no agent here is no row, and a name AIKit's table holds that is no agent stays a row, so it can be cleared.
  const seen = [{provider: "codex", label: "Codex (seen)", modes: [{id: "plan", name: "Plan"}], seenAt: 5}, {provider: "prime-rpc", label: "Prime", modes: [{id: "ask", name: "Ask"}], seenAt: 6}];
  const rows = model.permissionModeRows(CENSUS, seen, {codex: "plan", "old-agent": "ask"});
  assert.deepEqual(rows.map((row) => [row.provider, row.label, row.modes.map((mode) => mode.id), row.seenAt, row.stray]),
    [["claude-code", "Claude Code", [], 0, false], ["codex", "Codex", ["plan"], 5, false], ["old-agent", "Old Agent", [], 0, true]]);
  for (const census of UNREAD) assert.deepEqual(model.permissionModeRows(census, seen, {codex: "plan"}).map((row) => [row.provider, row.stray]), [["codex", false]],
    `a census ${census.state} names no agent, and the table's own entry is not called a stray`);
});

test("the Status card, as mounted, says the census's agents, not AIKit's ready and adapterless client rows", async (t) => {
  const here = dirname(fileURLToPath(import.meta.url));
  const temp = await mkdtemp(join(here, ".settings-status-"));
  t.after(() => rm(temp, {recursive: true, force: true}));
  // The card's one store, stubbed where it is read: the World Model's agents slice comes from the test.
  const stores = {name: "status-stores", setup(built) {
    const from = (args, file) => args.importer.endsWith(file);
    built.onResolve({filter: /kernel\/KernelProvider$/}, (args) => from(args, `${sep}sections${sep}StatusSection.tsx`) ? {path: "kernel", namespace: "stub"} : undefined);
    built.onResolve({filter: /owners\/model$/}, (args) => from(args, `${sep}agency${sep}census.ts`) ? {path: "model", namespace: "stub"} : undefined);
    built.onLoad({filter: /.*/, namespace: "stub"}, (args) => ({contents: args.path === "kernel" ? "export function useKernel(){return {transport:{kind:'tauri'}};}" : "export function useModelSlice(){return globalThis.__agentsSlice;}", loader: "js"}));
  }};
  await build({entryPoints: {status: join(here, "../src/workspace/settings/sections/StatusSection.tsx")}, bundle: true, platform: "node", format: "esm", jsx: "automatic",
    define: {__CRADLE_WALK__: "false"}, loader: {".css": "empty"}, external: ["react", "react-dom", "react/jsx-runtime"], plugins: [stores],
    outdir: temp, outExtension: {".js": ".mjs"}, logLevel: "error"});
  const {StatusSection} = await import(pathToFileURL(join(temp, "status.mjs")));
  // AIKit's client rows: Claude Code not installed (an isolated home), pi ready, hermes detected without an adapter.
  const aikitClients = shapeHarnessClients({clients: [
    {client: "claude", harness: "claude-code", detection: "not-installed", capability: "descriptor", dispatch: "client"},
    {client: "pi", harness: "pi", detection: "detected", capability: "descriptor", dispatch: "adapter-only"},
    {client: "hermes", harness: "hermes", detection: "detected", capability: "unavailable", dispatch: "adapter-only"},
  ]});
  const data = {suite: {state: "ok", value: {...reading, harness: {...reading.harness, harnesses: {state: "ok", rows: aikitClients}}}}, census: {state: "reading"},
    owners: {state: "ok", value: {}}, registry: {state: "reading"}, resolutions: {}, resolutionsState: {state: "ok", value: 0}, credentials: {state: "reading"}};
  const card = () => renderToStaticMarkup(createElement(StatusSection, {data})).match(/data-settings-card="harnesses".*?<\/section>/s)?.[0] ?? "";
  globalThis.__agentsSlice = agentsSlice(CENSUS.agents.map((agent) => ({slug: agent.slug, harness_ref: agent.harnessRef, executable: agent.executable, starts: agent.starts, talks: agent.talks, why: agent.why, aikit: agent.aikit})));
  assert.match(card(), /<p data-status-harnesses="true">3 of 4 start on this machine · 2 you can talk to<\/p>/);
  assert.doesNotMatch(card(), /ready|without an adapter/, "AIKit's client rows count no agent");
  globalThis.__agentsSlice = {state: "unavailable", reason: "The World Model has not answered yet."};
  assert.match(card(), /The agents on this machine couldn(&#x27;|')t be read\./);
  assert.match(card(), /The World Model has not answered yet\./, "the census's why, in its words");
  globalThis.__agentsSlice = {state: "reading"};
  assert.match(card(), /<p>Reading…<\/p>/);
});


test("model-default review names the actual harness and model while retaining the native request", () => {
  const setting = "ai-kit:models:models.default";
  const before = {"transport-pi-42": {model_id: "old-native-model", model_name: "Previous model", native_provider: "native-provider"}};
  const after = {"transport-pi-42": {model_id: "glm-5.3-flash", model_name: "GLM-5.3-Flash", native_provider: "zai"}};
  const data = {
    suite: {state: "ok", value: {...reading, harness: {...reading.harness, providers: {state: "ok", rows: [{id: "transport-pi-42", label: "Native proof", protocol: "pi-rpc", command: "pi"}]}}}},
    registry: {state: "ok", value: {index: {[setting]: {owner: {owner_ref: "ai-kit"}, setting: {title: "Default model per harness", effect: {kind: "session-restart-required"}, value_schema: {type: "table"}}}}}},
    resolutions: {k: {...resolution({value: after}, "drifted"), setting_ref: setting, native: {effective: {value: before}}}},
  };
  let line = change.stagedChanges(data)[0];
  assert.equal(line.from, "Pi · Previous model");
  assert.equal(line.to, "Pi · GLM-5.3-Flash");
  assert.equal(line.effect, "Next session only");
  assert.deepEqual(line.request.value, after, "the readable review must preserve exact native selection data");
  assert.deepEqual(line.place, {kind: "section", id: "harnesses"});
  assert.equal(line.rowId, `setting:${setting}`);
  data.resolutions.k.native.effective.value = {};
  assert.equal(change.stagedChanges(data)[0].from, "Harness default");
  data.resolutions.k.desired.value = {};
  assert.equal(change.stagedChanges(data)[0].to, "Harness default", "clearing a saved model says what new chats will use");
});

test("model-default review distinguishes matching harnesses and never substitutes transport IDs for absent names", () => {
  const setting = "ai-kit:models:models.default";
  const value = {"native-first": {model_id: "opaque-first", model_name: "Alpha"}, "native-second": {model_id: "opaque-second", model_name: "Beta"}, "provider/absent": {model_id: "opaque-absent", model_name: "model://internal"}};
  const data = {
    suite: {state: "ok", value: {...reading, harness: {...reading.harness, providers: {state: "ok", rows: [{id: "native-first", label: "Epi Prime", protocol: "prime-rpc"}, {id: "native-second", label: "Epi Prime", protocol: "prime-rpc"}]}}}},
    registry: {state: "reading"},
    resolutions: {k: {...resolution({value}, "drifted"), setting_ref: setting, native: {}}},
  };
  let line = change.stagedChanges(data)[0];
  assert.equal(line.to, "Configured harness · Saved model; Epi Prime · connection 1 · Alpha; Epi Prime · connection 2 · Beta");
  assert.doesNotMatch(line.to, /provider\/|model:\/\/|opaque|native-first|native-second/);
  data.suite = {state: "reading"};
  line = change.stagedChanges(data)[0];
  assert.match(line.to, /Configured harness · Alpha/);
  assert.match(line.to, /Configured harness · Beta/);
  assert.match(line.to, /Configured harness · Saved model/);
});
