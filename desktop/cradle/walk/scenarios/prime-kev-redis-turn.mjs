#!/usr/bin/env node
// One REAL encounter turn on the Epi-Logos Prime-QL body with Redis-prepared NOW context that elects the live Kev, read back
// with the owner's recorder. No browser: the kernel's own provision / draft / prompt / view ops over the loopback walk bridge.
//
//   OI_WALK_REAL_PROVIDER=1 node walk/scenarios/prime-kev-redis-turn.mjs [--edition DIR] [--keep]
//
// What it proves, in one receipt (walk/artifacts/prime-kev-redis-turn.json):
//   1  the prepared view is DELIVERED to the turn (`now-context-delivered`: version, digests, participant)
//   2  the Kev decision invocation and provider identity behind that view, and the Redis readback of what it selected
//   3  the QL operations the body actually made (tool calls, Python faculty calls, the owner's faculty receipts)
// The raw `encounter-use` and `now-context inspect` outputs are embedded unedited. Nothing secret is written: the model key
// stays in the environment of the Prime child, and the receipt records only names and paths, never an environment.
//
// Spend and isolation: a real turn spends the owner's plan quota, so it is opt-in (OI_WALK_REAL_PROVIDER=1) and the model is
// the walk law's pinned one (zai / glm-5.3-flash, read from Prime's own settings; anything else is refused). The AIKit home,
// the Central ground and OI_HOME are throwaway; the Kev endpoint and the Redis NOW service are the real, running ones.
//
// Participant rule: the agency minted for a ground whose project_id is X discloses participant `agent/X-chat`; the preparation
// request must name exactly that, or AIKit records `now_context.encounter_prepare_mismatch` and delivers nothing. A fresh
// project_id per run keeps the prepared view at version 0 (no stale compare-and-swap) and the view is revoked at the end.
//
// Parameters (flags or environment; defaults are this machine's installed material):
//   --edition DIR / FIELD_SITE_ROOT/essay   a built edition (static/contentIndex.json, quartz-source.json); else the installed World
//   OI_AIKIT_BIN                  the aikit build under test (its sibling aikit-session-space is used)   REQUIRED
//   FIELD_BRIDGE_BIN              the walk-bridge binary                          default kernel/target/debug/walk-bridge
//   EPI_REDIS_CONFIG              aikit.redis-now-config/v1 of the running Redis NOW service     default ~/.aikit/services/redis-now/redis-now.json
//   EPI_DECISION_PROVIDER         aikit.decision-provider/v1 of the running Kev                  default ~/.aikit/decision-provider.json
//   EPI_TOOLS_ROOT                where the Prime distribution is installed                       default <aikit home>/tools
//   EPI_ACTUATION_ROOT, EPI_PRIME_DIR, EPI_ACTUATION_PRIME_BINARY, EPI_PRIME_AGENT_BINARY, EPI_QL_BIN, EPI_QL_ROOT, EPI_QL_REVISION,
//   EPI_QL_SKILL_PATH, EPI_ACTUATION_RESEARCH_BINARY, EPI_FACULTY_CONFIG, AIKIT_AGENCY_MINT_TEMPLATE, OI_CENTRAL_CTRL_BIN
//   OI_WALK_BRIDGE_PORT           default random
import {execFileSync, spawn, spawnSync} from "node:child_process";
import {chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync} from "node:fs";
import {homedir, tmpdir} from "node:os";
import {dirname, join, resolve} from "node:path";
import {fileURLToPath} from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const cradle = resolve(here, "../..");
const repo = resolve(cradle, "../..");
const fixtures = join(cradle, "tests/fixtures/prime-kev-redis");
const artifact = join(cradle, "walk/artifacts/prime-kev-redis-turn.json");
const argv = process.argv.slice(2);
const flag = n => argv.includes(`--${n}`);
const arg = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : d; };
const HOME = homedir();
const env0 = process.env;

const need = (name, value, what) => { if (!value) { console.error(`${name} is required: ${what}`); process.exit(2); } return value; };
const AIKIT = need("OI_AIKIT_BIN", env0.OI_AIKIT_BIN, "the aikit build under test");
const SESSION_SPACE = AIKIT.replace(/aikit$/, "aikit-session-space");
const BRIDGE_BIN = env0.FIELD_BRIDGE_BIN ?? join(cradle, "kernel/target/debug/walk-bridge");
const REDIS = env0.EPI_REDIS_CONFIG ?? join(HOME, ".aikit/services/redis-now/redis-now.json");
const KEV = env0.EPI_DECISION_PROVIDER ?? join(HOME, ".aikit/decision-provider.json");
const ACTUATION = env0.EPI_ACTUATION_ROOT ?? "/Users/admin/Central/worktrees/env-1/actuation";
const EPI_PRIME_DIR = env0.EPI_PRIME_DIR ?? join(HOME, "Central/Work/Epi-Prime");   // EpiLogos/Epi-Prime, the Prime distribution
const LAUNCHER = env0.EPI_ACTUATION_PRIME_BINARY ?? join(ACTUATION, "target/debug/actuation-epi-prime");
const PRIME = env0.EPI_PRIME_AGENT_BINARY ?? join(HOME, ".npm-global/lib/node_modules/prime-agent/dist/bundle/cli.js");
const QL_ROOT = env0.EPI_QL_ROOT ?? join(HOME, "Central/Work/Quaternal-Logic");
const QL = env0.EPI_QL_BIN ?? join(QL_ROOT, "target/debug/ql");
const SKILL = env0.EPI_QL_SKILL_PATH ?? join(HOME, "Central/Work/Actuation/experiments/ql-runtime/prime/skills/ql-relational");
const RESEARCH = env0.EPI_ACTUATION_RESEARCH_BINARY ?? join(HOME, ".local/bin/actuation-research");
const OWNER_INSTRUMENT = env0.EPI_OWNER_INSTRUMENT ?? join(HOME, "Central/Work/Actuation/experiments/ql-runtime/native-owner-instrument/target/debug/actuation-ql-owner-instrument");
const FACULTY = env0.EPI_FACULTY_CONFIG ?? null;   // generated from the instrument when not given: a stored pin goes stale when the instrument is rebuilt
const TEMPLATE = env0.AIKIT_AGENCY_MINT_TEMPLATE ?? join(HOME, "Central/worktrees/env-1/ai-kit/crates/aikit-cli/tests/fixtures/mint-agency-template.json");
const CTRL = env0.OI_CENTRAL_CTRL_BIN ?? join(HOME, ".local/bin/ctrl");
const BODY = "agent-body/epi-prime-ql";
const PROVIDER_ID = "epi-prime-ql-candidate";

const record = {schema: "oi.prime-kev-redis-turn/v1", spec_ref: "docs/cradle/CENTRAL-FIELD-NATIVE-AUDIT-A.md (actual use of Kev, Redis and the QL body; O:I #598)", grade: "A", at: new Date().toISOString(), steps: [], model: null};
const say = (step, detail) => { record.steps.push({step, ...(detail !== undefined ? {detail} : {})}); console.log(`[${step}]`, detail === undefined ? "" : JSON.stringify(detail).slice(0, 360)); };
const save = () => { mkdirSync(dirname(artifact), {recursive: true}); writeFileSync(record.ok ? artifact : artifact.replace(/\.json$/, ".failure.json"), JSON.stringify(record, null, 2) + "\n"); };

if (env0.OI_WALK_REAL_PROVIDER !== "1") { console.log("SKIP: a real turn spends plan quota; set OI_WALK_REAL_PROVIDER=1 to authorise it. No model was prompted."); process.exit(0); }
for (const [name, path] of [["aikit", AIKIT], ["aikit-session-space", SESSION_SPACE], ["walk-bridge", BRIDGE_BIN], ["redis election", REDIS], ["decision provider", KEV], ["launcher", LAUNCHER], ["prime-agent", PRIME], ["ql", QL], ["skill path", SKILL], ["actuation-research", RESEARCH], ["owner instrument", OWNER_INSTRUMENT], ["mint template", TEMPLATE], ["ctrl", CTRL]]) {
  if (!existsSync(path)) { console.error(`missing ${name}: ${path}`); process.exit(2); }
}
// the walk law: the model is pinned, never inherited
const primeSettings = JSON.parse(readFileSync(join(HOME, ".prime/agent/settings.json"), "utf8"));
record.model = {provider: primeSettings.defaultProvider, model: primeSettings.defaultModel, thinking: primeSettings.defaultThinkingLevel, source: "~/.prime/agent/settings.json (Prime's own default; the row adds no override)"};
if (record.model.provider !== (env0.OI_WALK_MODEL_PROVIDER ?? "zai") || record.model.model !== (env0.OI_WALK_MODEL_ID ?? "glm-5.3-flash")) {
  console.error(`refusing: Prime's configured model is ${record.model.provider}/${record.model.model}, not the walk law's zai/glm-5.3-flash`); process.exit(2);
}

// ---- the edition the candidates are read from --------------------------------------------------------------------------
let editionDir = arg("edition") ?? (env0.FIELD_SITE_ROOT ? join(env0.FIELD_SITE_ROOT, "essay") : null), worldRevision = null;
if (!editionDir) {
  const resolved = JSON.parse(execFileSync(process.execPath, [join(repo, "site/essay-world.mjs"), "resolve"], {encoding: "utf8"}));
  if (resolved.state !== "available") { console.error(`no edition: the installed World is ${resolved.state} (${resolved.reason ?? ""}); pass --edition DIR`); process.exit(2); }
  editionDir = resolved.edition_dir; worldRevision = resolved.revision;
}
const receipt = JSON.parse(readFileSync(join(editionDir, "quartz-source.json"), "utf8"));
const contentIndex = JSON.parse(readFileSync(join(editionDir, "static/contentIndex.json"), "utf8"));
worldRevision ??= receipt.vault_commit?.slice(0, 12) ?? "edition";
const slugOf = p => { const base = p.replace(/\.md$/, ""); return base === "README" ? "index" : base; };
const sourceRef = path => `central:source:project:Antykathera-Essay-Work:${path}`;
const spec = JSON.parse(readFileSync(join(fixtures, "candidates.json"), "utf8"));
const shaOf = new Map(receipt.files.map(f => [f.path, f.sha256]));
const items = spec.items.map(({role, path}) => {
  const revision = shaOf.get(path);
  const page = contentIndex[slugOf(path)];
  if (!revision || !page) throw new Error(`${path}: not in the edition (receipt ${!!revision}, content index ${!!page})`);
  return {role, ref: sourceRef(spec.edition_path_prefix + path), revision, title: `${page.title} (${role})`, excerpt: String(page.content ?? "").replace(/\s+/g, " ").slice(0, spec.excerpt_chars), route: path.replace(/\.md$/, "")};
});
record.edition = {dir: editionDir, world_revision: worldRevision, vault_commit: receipt.vault_commit, candidates: items.map(({role, ref, revision}) => ({role, ref, revision}))};

// ---- throwaway ground, AIKit home, OI home -----------------------------------------------------------------------------
const stamp = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15);
const projectId = `epi-field-${stamp.toLowerCase()}-${Math.random().toString(36).slice(2, 6)}`;
const participant = `agent/${projectId}-chat`;
const base = realpathSync(mkdtempSync(join(tmpdir(), "oi-prime-kev-redis-")));
const root = join(base, "ground"), projectRoot = join(root, "Work", "Field"), ociHome = join(base, "oi-home"), aikitHome = join(base, "aikit-home"), run = join(base, "run");
for (const d of [root, projectRoot, ociHome, aikitHome, run]) mkdirSync(d, {recursive: true});
const router = join(run, "oi-owner-router.mjs");
writeFileSync(router, `#!/usr/bin/env node\nimport {spawnSync} from "node:child_process";\nconst a = process.argv.slice(2);\nif (a[0] === "aikit") { const c = spawnSync(${JSON.stringify(AIKIT)}, a.slice(1), {stdio: "inherit"}); process.exit(c.status ?? 1); }\nconst c = spawnSync(process.env.OI_REAL_BIN || "oi", a, {stdio: "inherit"}); process.exit(c.status ?? 1);\n`);
chmodSync(router, 0o755);
const env = {...env0, OI_CENTRAL_ROOT: root, OI_HOME: ociHome, OI_CENTRAL_PROJECT_QUERY: "Field", AIKIT_HOME: aikitHome, OI_AIKIT_BIN: AIKIT, OI_BIN: router, AIKIT_AGENCY_MINT_TEMPLATE: TEMPLATE};
delete env.CENTRAL_NATIVE_TOKEN;
const sh = (cmd, args, extra = {}) => execFileSync(cmd, args, {encoding: "utf8", env, maxBuffer: 64 * 1024 * 1024, ...extra});
const native = (...p) => JSON.parse(sh(AIKIT, ["--json", "session-space", "-C", projectRoot, ...p]));
const top = (...p) => JSON.parse(sh(AIKIT, ["--json", ...p]));
const ctrl = (action, input = {}) => { const r = JSON.parse(sh(CTRL, ["--root", root, "--json", "action", "run", action, JSON.stringify(input)])); if (!r.ok) throw new Error(`${action}: ${JSON.stringify(r.error ?? r)}`); return r.data; };
const kevAddress = JSON.parse(readFileSync(KEV, "utf8")).address;
const kevRequests = async () => (await (await fetch(`http://${kevAddress}/v1/models`, {signal: AbortSignal.timeout(4000)})).json()).models?.find(m => m.name === "kev-latest")?.batches?.requests ?? null;
let bridge = null, owner = null, redisDisclosure = null;
const cleanup = () => { try { bridge?.kill(); } catch { /* gone */ } try { if (owner?.data?.pid) process.kill(-owner.data.pid, "SIGTERM"); } catch { /* gone */ } };
process.on("exit", cleanup);

try {
  record.kev = {address: kevAddress, requests_before: await kevRequests()};
  record.redis = top("now-context", "status", "--config-file", REDIS).data;
  say("services", {kev: record.kev, redis: {address: record.redis.address, version: record.redis.redis_version}});

  ctrl("central.init");
  ctrl("projectcentral.init", {project: "Field", project_id: projectId});
  const bind = top("-C", projectRoot, "project", "bind", "field-walk", "--directory", projectRoot, "--no-default-skill-sets");
  if (!bind.ok) throw new Error(JSON.stringify(bind));
  const realRelations = JSON.parse(readFileSync(join(HOME, "Central/Control/relations/source-relations.json"), "utf8"));
  mkdirSync(join(root, "Control/relations"), {recursive: true}); mkdirSync(join(root, "Control/user"), {recursive: true});
  writeFileSync(join(root, "Control/relations/source-relations.json"), JSON.stringify({schema: "central.control.ground-relations/v1", project_id: "control:root", relations: realRelations.relations.filter(r => ["Control/user/placement.json", "Control/user/civil-time-policy.json"].includes(r.path))}, null, 1));
  const placement = JSON.parse(readFileSync(join(HOME, "Central/Control/user/placement.json"), "utf8"));
  placement.writable = [{path: "Work/Field", class: "repository"}];
  writeFileSync(join(root, "Control/user/placement.json"), JSON.stringify(placement, null, 1));
  writeFileSync(join(root, "Control/user/civil-time-policy.json"), readFileSync(join(HOME, "Central/Control/user/civil-time-policy.json")));
  const policy = ctrl("central.work.policy", {project: "Field"});
  const now = ctrl("central.now.allocate", {project: "Field", task_ref: `prime-kev-redis-${stamp}`, purpose: "the Epi field companion real-turn proof", expected_policy_revision: policy.revision});
  say("ground", {root, project_id: projectId, now_ref: now.now_ref});

  // the body: the distribution installed in the tools root, the row configured with its launcher
  const toolsRoot = env0.EPI_TOOLS_ROOT ?? join(aikitHome, "tools");
  const evidence = join(run, "faculty-evidence"); mkdirSync(evidence, {recursive: true});
  const facultyConfig = join(run, "faculty.walk.json");
  const distribution = join(EPI_PRIME_DIR, "tools/epi-distribution.mjs");
  if (FACULTY) writeFileSync(facultyConfig, JSON.stringify({...JSON.parse(readFileSync(FACULTY, "utf8")), evidence_root: evidence}, null, 2));
  else say("faculty-config", JSON.parse(sh(process.execPath, [distribution, "faculty-config", "--instrument", OWNER_INSTRUMENT, "--source-root", QL_ROOT, "--evidence-root", evidence, "--out", facultyConfig])));
  const QL_REVISION = env0.EPI_QL_REVISION ?? JSON.parse(readFileSync(facultyConfig, "utf8")).owner.revision;
  const installed = JSON.parse(sh(process.execPath, [distribution, "install", "--research-bin", RESEARCH, "--faculty-config", facultyConfig, "--root", toolsRoot]));
  const configured = native("encounter-epi-prime-configure", "--provider-id", PROVIDER_ID, "--launcher", LAUNCHER, "--prime-bin", PRIME, "--ql-bin", QL, "--ql-revision", QL_REVISION, "--body-revision", execFileSync("git", ["-C", ACTUATION, "rev-parse", "HEAD"], {encoding: "utf8"}).trim(), "--skill-path", SKILL, "--extension", installed.extension, "--installation", installed.binding, "--research-bin", RESEARCH, "--faculty-config", facultyConfig, "--ql-root", QL_ROOT);
  if (configured.ok === false) throw new Error(JSON.stringify(configured));
  say("body", {tools_root: toolsRoot, installed: installed.id, launcher: LAUNCHER, row: configured.data?.provider ?? configured.provider, standing: configured.data?.standing ?? configured.standing});

  // the authored request, bound to this ground's participant and NOW (items and selection are the fixture's, unchanged)
  const projectContext = JSON.parse(sh(AIKIT, ["--json", "session-space", "-C", projectRoot, "project-context"]));
  const redis = JSON.parse(readFileSync(REDIS, "utf8"));
  const request = {
    schema: "aikit.now-preparation-request/v1", redis,
    project_ref: projectContext.project ?? projectContext.data?.project, now_ref: now.now_ref, participant_ref: participant, agent_session: "agent-session/rewritten-at-entry",
    concern: spec.concern, disclosure_revision: `world:${worldRevision}`, practice_refs: [],
    central: {root, ctrl_bin: CTRL, project: "Field"},
    candidate_items: items.map(i => ({source_ref: i.ref, source_revision: i.revision, title: i.title, excerpt: i.excerpt, route: i.route, agent_visibility: "payload", external_egress: "allowed"})),
    expected_version: 0, external_provider: true,
    selection: {mode: spec.selection.mode, provider_file: KEV, state: {undertaking: spec.selection.state_undertaking, primary: items[0].ref, tangent: items[1].ref, selected: items[2].ref}, relevance_threshold: spec.selection.relevance_threshold},
  };
  const requestFile = join(run, "now-prepare.json");
  writeFileSync(requestFile, JSON.stringify(request, null, 2));
  const allowance = {...JSON.parse(readFileSync(join(fixtures, "egress-allowance.json"), "utf8")), disclosure_revision: request.disclosure_revision, items: items.map(({role, ref, revision}) => ({role, source_ref: ref, source_revision: revision}))};
  record.egress_allowance = allowance;
  redisDisclosure = request.disclosure_revision;
  const pre = top("now-context", "prepare", "--request-file", requestFile);
  const sel = pre.data?.selection ?? {};
  record.preflight = {ok: pre.ok, mode: sel.mode, outcome: sel.decisionInvocation?.outcome, standing: sel.decisionInvocation?.standing, invocation_ref: sel.decisionInvocation?.invocation_ref, provider_identity: sel.decisionProvider, selected: sel.selectedCandidateRefs?.length, published_version: pre.data?.publishedVersion};
  say("preflight", record.preflight);
  const nowCfg = native("encounter-now-context-configure", "--provider-id", PROVIDER_ID, "--redis-config", REDIS, "--prepare-request", requestFile);
  if (nowCfg.ok === false) throw new Error(JSON.stringify(nowCfg));
  say("now-context", {configured: nowCfg.data?.configured ?? nowCfg.configured, selection: nowCfg.data?.selection ?? nowCfg.selection});
  owner = native("encounter-start");
  if (!owner.ok) throw new Error(JSON.stringify(owner));

  // the kernel's own ops over the loopback bridge
  const port = Number(env0.OI_WALK_BRIDGE_PORT ?? 4300 + Math.floor(Math.random() * 500));
  bridge = spawn(BRIDGE_BIN, [`127.0.0.1:${port}`], {cwd: root, env, stdio: "ignore"});
  for (let i = 0; i < 80; i++) { try { if ((await fetch(`http://127.0.0.1:${port}/state`)).ok) break; } catch { /* not yet */ } await new Promise(r => setTimeout(r, 250)); }
  const op = async body => { const r = await (await fetch(`http://127.0.0.1:${port}/op`, {method: "POST", headers: {"content-type": "application/json"}, body: JSON.stringify(body)})).json(); if (!r.ok) throw new Error(JSON.stringify(r).slice(0, 600)); return r.outcome ?? r; };
  // `encounter-start` returns before the resident owner answers; the first provision may arrive in that gap ("EOF while parsing"). Retry only that.
  let provisioned;
  for (let attempt = 1; ; attempt++) {
    try { provisioned = await op({op: "encounter_provision", project: "Field", preferred_body_ref: BODY}); break; }
    catch (error) { if (attempt >= 6 || !/EOF while parsing|connection refused|No such file/i.test(String(error))) throw error; say("owner-not-ready", {attempt}); await new Promise(r => setTimeout(r, 2000)); }
  }
  const agentSession = (provisioned.data ?? provisioned).agent_session;
  record.agent_session = agentSession;
  say("provision", {agent_session: agentSession, provider: (provisioned.data ?? provisioned).provider});
  const draft = await op({op: "encounter", project: "Field", request: {action: "draft", agent_session: agentSession, basis: 0, text: spec.message}});
  await op({op: "encounter", project: "Field", request: {action: "prompt", agent_session: agentSession, draft_revision: (draft.data ?? draft).revision}});
  say("prompt", {message: spec.message});
  const deadline = Date.now() + 15 * 60 * 1000;
  let blocks = [], consecutiveViewErrors = 0;
  for (;;) {
    if (Date.now() > deadline) throw new Error("the turn did not end within 15 minutes");
    await new Promise(r => setTimeout(r, 4000));
    // The machine is shared and loaded: a read of the Central owner may come back empty once. Only that is retried, and every one is recorded.
    try { blocks = ((await op({op: "encounter", project: "Field", request: {action: "view", agent_session: agentSession}})).data ?? {}).blocks ?? []; consecutiveViewErrors = 0; }
    catch (error) { (record.transient_view_errors ??= []).push(String(error).slice(0, 240)); if (++consecutiveViewErrors > 5) throw error; continue; }
    if (blocks.some(b => b.kind === "assistant" && String(b.text ?? "").includes(spec.done_marker))) break;
  }
  record.assistant_blocks = blocks.filter(b => b.kind === "assistant").map(b => String(b.text ?? "").slice(0, 4000));
  say("turn-landed", {assistant_blocks: record.assistant_blocks.length});

  // the readback
  const use = spawnSync(SESSION_SPACE, ["-C", projectRoot, "encounter-use", "--agent-session", agentSession, "--faculty-config", facultyConfig, "--redis-config", REDIS], {encoding: "utf8", env});
  const inspected = spawnSync(AIKIT, ["--json", "now-context", "inspect", "--config-file", REDIS, "--participant-ref", participant], {encoding: "utf8", env});
  record.encounter_use = {exit: use.status, raw: use.stdout || use.stderr};
  record.redis_inspect = {exit: inspected.status, raw: inspected.stdout || inspected.stderr};
  console.log("---- encounter-use (raw) ----\n" + record.encounter_use.raw + "\n---- end ----");
  let reading = null, view = null;
  try { reading = JSON.parse(use.stdout); } catch { /* raw kept */ }
  try { view = JSON.parse(inspected.stdout); } catch { /* raw kept */ }
  record.kev.requests_after = await kevRequests();

  const delivered = reading?.prepared_context?.delivered ?? [], receiptOf = delivered[0]?.receipt;
  const faculty = reading?.ql_operations ?? {};
  const checks = [
    ["the prepared view was delivered to the turn, with no degradation", reading?.prepared_context?.state === "delivered" && (reading?.prepared_context?.degraded ?? []).length === 0, reading?.prepared_context?.state],
    ["the delivery names the participant the ground minted (agent/<project_id>-chat)", receiptOf?.participant_ref === participant, receiptOf?.participant_ref],
    ["the delivery names the Kev decision invocation and provider identity", !!receiptOf?.jev_invocation_ref && !!receiptOf?.decision_provider, {invocation: receiptOf?.jev_invocation_ref}],
    ["the Redis readback is the delivered view and lists the selected sources", reading?.decision?.selection_readback?.read === true && reading.decision.selection_readback.view_is_the_delivered_one === true && (reading.decision.selection_readback.selected_source_refs ?? []).length > 0, reading?.decision?.selection_readback?.selected_source_refs?.length],
    ["Redis holds the prepared view at the delivered digest", view?.data?.prepared?.basis_digest === receiptOf?.basis_digest && view?.data?.lastDelivery?.prepared_digest === receiptOf?.prepared_digest, view?.data?.currentVersion],
    ["Kev's own counters moved", (record.kev.requests_after ?? -1) > (record.kev.requests_before ?? 1e9), {before: record.kev.requests_before, after: record.kev.requests_after}],
    ["the body made QL calls", (faculty.tool_calls ?? []).length + (faculty.python_faculty_calls ?? []).length > 0, {tool_calls: (faculty.tool_calls ?? []).map(c => `${c.tool}${c.result?.is_error ? " (error)" : ""}`), python: (faculty.python_faculty_calls ?? []).map(c => c.function)}],
  ].map(([label, ok, detail]) => ({label, ok: !!ok, detail}));
  record.checks = checks;
  for (const c of checks) console.log(`${c.ok ? "PASS" : "FAIL"} — ${c.label} · ${JSON.stringify(c.detail).slice(0, 200)}`);
  record.ok = checks.every(c => c.ok);
} catch (error) {
  record.ok = false; record.error = String(error?.stack ?? error).split("\n").slice(0, 8).join(" | ");
  console.error("FAILED:", record.error);
} finally {
  // leave nothing behind in the shared Redis: revoke this run's participant view
  if (redisDisclosure) {
    const revoked = spawnSync(AIKIT, ["--json", "now-context", "revoke", "--config-file", REDIS, "--participant-ref", participant, "--disclosure-revision", redisDisclosure], {encoding: "utf8", env});
    record.redis_view_revoked = revoked.status === 0;
  }
  cleanup();
  record.ground = {root, aikit_home: aikitHome, kept: flag("keep")};
  save();
  if (!flag("keep")) rmSync(base, {recursive: true, force: true});
  console.log(`receipt: ${record.ok ? artifact : artifact.replace(/\.json$/, ".failure.json")}`);
  process.exit(record.ok ? 0 : 1);
}
