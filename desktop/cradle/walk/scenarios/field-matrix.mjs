#!/usr/bin/env node
// The field companion proof matrix: harness (pi | prime) x context (clean | rich).
//
//   node walk/scenarios/field-matrix.mjs --harness prime --context rich        one cell
//   node walk/scenarios/field-matrix.mjs --all                                 the four cells, each in its own process
//
// Each cell: Epi OFF on a generic corpus, then Epi ON on the essay; a selection / tangent / Expression walk; the field
// followed by the companion; ONE real turn through the chosen body; the owner's recorder (`aikit-session-space
// encounter-use`) for that turn; and the tripwire log.
//
//   harness prime  the Epi-Logos Prime-QL body, chosen by the Epi lens through the panel's ordinary provision path
//   harness pi     the pinned pi/GLM-flash route, opened explicitly (an override of the lens default; a lens-default
//                  provision needs a configured Prime row, which a pi-only installation does not have)
//   context clean  installTripwireEnvironment({home}): sandbox HOME + PATH, Factory/Workcell withheld and tripwired,
//                  the candidate oi, and NO credential of any kind: every credential-shaped environment variable is
//                  removed from this process before anything starts, and the sandbox HOME holds no login. A real turn
//                  therefore cannot run; the cell runs up to the send and records the gap by name.
//   context rich   the owner's everyday environment (HOME, PATH, logins) with an isolated OI_HOME and an isolated AIKit
//                  home (the owner's own AIKit rows are never touched); the real turn runs only with
//                  OI_WALK_REAL_PROVIDER=1.
//
// Real in every cell that reaches a turn: the AIKit build named by OI_AIKIT_BIN, AIKit's own Redis NOW service
// (provisioned into the cell's home), the owner's Kev at 127.0.0.1:8019 (never a stand-in), a NOW allocated in the
// cell's own Central ground by `central.now.allocate`. Walk-authored, and said so in the receipt: the ground, its
// placement policy (Work/Field only), the candidate set Kev ranks (real pages of the edition), the agency-mint template
// (an AIKit test fixture; the owner's standing template is not on this machine).
import {execFileSync, spawn, spawnSync} from "node:child_process";
import {chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync} from "node:fs";
import {homedir, tmpdir} from "node:os";
import {join} from "node:path";
import {fileURLToPath} from "node:url";

const argv = process.argv.slice(2);
const flag = n => argv.includes(`--${n}`);
const arg = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : d; };

// ---- --all: one process per cell, sequential (each cell mutates its own environment) ---------------------------------
if (flag("all")) {
  const results = [];
  for (const [harness, context] of [["prime", "rich"], ["pi", "rich"], ["prime", "clean"], ["pi", "clean"]]) {
    console.log(`\n=== cell: harness=${harness} context=${context} ===`);
    const r = spawnSync(process.execPath, [fileURLToPath(import.meta.url), "--harness", harness, "--context", context], {stdio: "inherit", env: process.env});
    results.push({harness, context, exit: r.status});
  }
  console.log("\n=== matrix ===");
  for (const r of results) console.log(`${r.harness}/${r.context}: exit ${r.exit}`);
  process.exit(results.every(r => r.exit === 0) ? 0 : 1);
}

const HARNESS = arg("harness"), CONTEXT = arg("context");
if (!["pi", "prime"].includes(HARNESS) || !["clean", "rich"].includes(CONTEXT)) { console.error("usage: field-matrix.mjs --harness pi|prime --context clean|rich | --all"); process.exit(2); }
const need = n => { const v = process.env[n]; if (!v) { console.error(`${n} is required`); process.exit(2); } return v; };
const aikit = need("OI_AIKIT_BIN");
const site = need("FIELD_SITE_ROOT");
const wantReal = process.env.OI_WALK_REAL_PROVIDER === "1";
const realHome = homedir();
process.env.OI_WALK_PI_BIN ??= join(realHome, ".local/bin/pi");   // an absolute path to the binary (a program, not a credential); kept through the clean scrub
const candidateOi = process.env.OI_CANDIDATE_BIN ?? "/Users/admin/Central/worktrees/env-2/o-i/target/debug/oi";

// ---- the context ---------------------------------------------------------------------------------------------------
const record = {harness: HARNESS, context: CONTEXT}, checks = [], skipped = [];
let tripwire = null, sandboxHome = null;
if (CONTEXT === "clean") {
  const {installTripwireEnvironment} = await import("../lib/absence-tripwire.mjs");
  process.env.OI_CANDIDATE_BIN = candidateOi;
  if (!existsSync(candidateOi)) { console.error(`no candidate oi at ${candidateOi}`); process.exit(2); }
  sandboxHome = mkdtempSync(join(tmpdir(), "oi-matrix-home-"));
  tripwire = installTripwireEnvironment({home: sandboxHome});
  // credentials: nothing credential-shaped survives into this process or any child. Names only are recorded.
  const keep = /^(PATH|HOME|TMPDIR|LANG|LC_[A-Z]+|USER|LOGNAME|SHELL|TERM|TZ|__CF_USER_TEXT_ENCODING|OI_.*|AIKIT_.*|FIELD_.*|EPI_.*|REDIS_SERVER|NODE_.*|PLAYWRIGHT_.*|CI)$/;
  const scrubbed = [];
  for (const k of Object.keys(process.env)) { if (!keep.test(k) || (/KEY|TOKEN|SECRET|CREDENTIAL|PASSWORD|AUTH/i.test(k) && !/^(OI_AIKIT_BIN|OI_CHROMIUM|OI_CANDIDATE_BIN|OI_BIN|OI_REAL_BIN|OI_WORKCELL_BIN|OI_FACTORY_BIN|OI_TRIPWIRE_LOG|OI_HOME|OI_WALK_.*)$/.test(k))) { scrubbed.push(k); delete process.env[k]; } }
  record.credentialScrub = {removed_env_names: scrubbed.sort(), remaining_credential_shaped: Object.keys(process.env).filter(k => /KEY|TOKEN|SECRET|CREDENTIAL|PASSWORD|AUTH/i.test(k))};
  record.tripwire = {root: tripwire.root, withheld: tripwire.withheld, sandbox_home: sandboxHome, path: process.env.PATH};
}
const {bootField, shotPath, writeReceipt} = await import("../lib/field-walk.mjs");
const {walkPiArgv} = await import("../lib/walk-provider.mjs");
const check = (ok, label, detail) => { checks.push({ok: !!ok, label, ...(detail !== undefined ? {detail} : {})}); console.log(`${ok ? "PASS" : "FAIL"} — ${label}${detail !== undefined ? " · " + JSON.stringify(detail).slice(0, 360) : ""}`); };
const skip = label => { skipped.push(label); console.log(`SKIP — ${label}`); };
const cell = `${HARNESS}-${CONTEXT}`;

// ---- the material (the owner's installed material on this machine; env overrides) ------------------------------------
const ACTUATION = process.env.EPI_ACTUATION_ROOT ?? "/Users/admin/Central/worktrees/env-1/actuation";
const LAUNCHER = process.env.EPI_ACTUATION_PRIME_BINARY ?? join(ACTUATION, "target/debug/actuation-epi-prime");
const QL_DIR = process.env.EPI_QL_DIR ?? join(realHome, ".workcell/tools/ql-agent/1a50b99ccf1884a4adbb3e3d6386854678de76d1ee899d89d629c7153977103d");
const PRIME = process.env.EPI_PRIME_AGENT_BINARY ?? join(realHome, ".npm-global/bin/prime-agent");
const RESEARCH = process.env.EPI_ACTUATION_RESEARCH_BINARY ?? join(realHome, ".local/bin/actuation-research");
const FACULTY = process.env.EPI_FACULTY_CONFIG ?? join(realHome, ".workcell/tools/actuation-ql-agent/af0b35ab1f11709a17a778fa129ebeb487715d96837788fb709d98bc3669525b/faculty.json");
const SKILL = process.env.EPI_QL_SKILL_PATH ?? "/Users/admin/Central/Work/Actuation/experiments/native-research/prime/skills/ql-relational";
const QL_ROOT = process.env.EPI_QL_SOURCE_ROOT ?? "/Users/admin/Central/Work/Quaternal-Logic";
const KEV = process.env.EPI_DECISION_PROVIDER ?? join(realHome, ".aikit/decision-provider.json");
const TEMPLATE = process.env.AIKIT_AGENCY_MINT_TEMPLATE ?? "/Users/admin/Central/worktrees/env-1/ai-kit/crates/aikit-cli/tests/fixtures/mint-agency-template.json";
const CTRL = process.env.OI_CENTRAL_CTRL_BIN ?? join(realHome, ".local/bin/ctrl");
const BODY = "agent-body/epi-prime-ql";
const BODY_REVISION = process.env.EPI_ACTUATION_REVISION ?? execFileSync("git", ["-C", ACTUATION, "rev-parse", "HEAD"], {encoding: "utf8"}).trim();
const QL_REVISION = process.env.EPI_QL_REVISION ?? JSON.parse(readFileSync(FACULTY, "utf8")).owner.revision;
const SPACE = "session-space/field-turn", SESSION = "agent-session/field-turn", PURPOSE = "Field encounter turn", PI_ID = "field-walk-pi", PI_LABEL = "Field walk Pi (GLM flash)";
const kevModels = async () => (await (await fetch("http://127.0.0.1:8019/v1/models", {signal: AbortSignal.timeout(4000)})).json()).models?.find(m => m.name === "kev-latest");
try { const m = await kevModels(); record.kev = {address: "127.0.0.1:8019", run: m.run, base: m.base, requests_before: m.batches?.requests ?? null}; }
catch (e) { console.error(`the owner's Kev is not answering at 127.0.0.1:8019: ${e}`); process.exit(2); }
const required = [["decision provider", KEV], ["ctrl", CTRL], ["redis-server", process.env.REDIS_SERVER ?? "/opt/homebrew/bin/redis-server"], ["mint template", TEMPLATE]];
if (HARNESS === "prime") required.push(["launcher", LAUNCHER], ["prime-agent", PRIME], ["ql", join(QL_DIR, "ql")], ["actuation-research", RESEARCH], ["faculty config", FACULTY], ["skill path", SKILL], ["QL root", QL_ROOT]);
for (const [n, p] of required) if (!existsSync(p)) { console.error(`missing ${n}: ${p}`); process.exit(2); }

let native, ownerEnv, redisDir, ground;
const provision = async ({root, home: oiHome, projectRoot}) => {
  const router = join(root, "oi-owner-router.mjs");
  // OI_BIN: withheld products are refused and logged (the tripwire's own contract); `aikit` is the AIKit build under test;
  // everything else is the oi in use.
  writeFileSync(router, `#!/usr/bin/env node\nimport {appendFileSync} from "node:fs";\nimport {spawnSync} from "node:child_process";\nconst a = process.argv.slice(2);\nif (/^(workcell|factory|software-factory)/.test(a[0] ?? "")) { if (process.env.OI_TRIPWIRE_LOG) appendFileSync(process.env.OI_TRIPWIRE_LOG, "oi " + a.join(" ") + "\\n"); console.error("tripwire: oi " + a[0] + " dispatched"); process.exit(97); }\nif (a[0] === "aikit") { const c = spawnSync(${JSON.stringify(aikit)}, a.slice(1), {stdio: "inherit"}); process.exit(c.status ?? 1); }\nconst c = spawnSync(process.env.OI_REAL_BIN || "oi", a, {stdio: "inherit"}); process.exit(c.status ?? 1);\n`); chmodSync(router, 0o755);
  const aikitHome = join(root, ".aikit-home");
  ownerEnv = {...process.env, OI_CENTRAL_ROOT: root, OI_HOME: oiHome, OI_CENTRAL_PROJECT_QUERY: "Field", AIKIT_HOME: aikitHome, OI_AIKIT_BIN: aikit, OI_BIN: router, AIKIT_AGENCY_MINT_TEMPLATE: TEMPLATE};
  delete ownerEnv.CENTRAL_NATIVE_TOKEN;
  const run = (cmd, args) => execFileSync(cmd, args, {encoding: "utf8", env: ownerEnv});
  const nativeRaw = (...p) => run(aikit, ["--json", "session-space", "-C", projectRoot, ...p]);
  native = (...p) => JSON.parse(nativeRaw(...p));
  const top = (...p) => JSON.parse(run(aikit, ["--json", ...p]));
  const ctrl = (action, input) => { const r = JSON.parse(run(CTRL, ["--root", root, "--json", "action", "run", action, JSON.stringify(input)])); if (!r.ok) throw new Error(`${action}: ${JSON.stringify(r.error ?? r)}`); return r.data; };
  const bind = top("-C", projectRoot, "project", "bind", "field-walk", "--directory", projectRoot, "--no-default-skill-sets");
  if (!bind.ok) throw new Error(JSON.stringify(bind));

  // a NOW in this ground: the ground's placement policy names Work/Field alone (walk-authored), recognised through the
  // ground's own source relations, then `central.now.allocate` against the policy revision `central.work.policy` reads
  const realRelations = JSON.parse(readFileSync("/Users/admin/Central/Control/relations/source-relations.json", "utf8"));
  const relationsFile = join(root, "Control/relations/source-relations.json");
  mkdirSync(join(root, "Control/relations"), {recursive: true}); mkdirSync(join(root, "Control/user"), {recursive: true});
  writeFileSync(relationsFile, JSON.stringify({schema: "central.control.ground-relations/v1", project_id: "control:root", relations: realRelations.relations.filter(r => ["Control/user/placement.json", "Control/user/civil-time-policy.json"].includes(r.path))}, null, 1));
  const placement = JSON.parse(readFileSync("/Users/admin/Central/Control/user/placement.json", "utf8"));
  placement.writable = [{path: "Work/Field", class: "repository"}];
  writeFileSync(join(root, "Control/user/placement.json"), JSON.stringify(placement, null, 1));
  writeFileSync(join(root, "Control/user/civil-time-policy.json"), readFileSync("/Users/admin/Central/Control/user/civil-time-policy.json"));
  const policy = ctrl("central.work.policy", {project: "Field"});
  const allocated = ctrl("central.now.allocate", {project: "Field", task_ref: `field-matrix-${cell}`, purpose: "the field companion proof matrix cell", expected_policy_revision: policy.revision});
  record.now = {now_ref: allocated.now_ref, allocated_by: "central.now.allocate", policy_revision: policy.revision, created: allocated.created};

  // the acting body
  let participant;
  if (HARNESS === "prime") {
    const facultyEvidence = join(root, "faculty-evidence"); mkdirSync(facultyEvidence, {recursive: true});
    const facultyConfig = join(root, "faculty.walk.json");
    writeFileSync(facultyConfig, JSON.stringify({...JSON.parse(readFileSync(FACULTY, "utf8")), evidence_root: facultyEvidence}, null, 2));
    record.facultyConfig = facultyConfig; record.facultyEvidence = facultyEvidence;
    const toolsRoot = join(aikitHome, "tools"); mkdirSync(toolsRoot, {recursive: true});
    const installed = JSON.parse(run("node", [join(ACTUATION, "distribution/prime-epi/tools/epi-distribution.mjs"), "install", "--research-bin", RESEARCH, "--faculty-config", facultyConfig, "--root", toolsRoot]));
    record.installation = installed;
    const configured = native("encounter-epi-prime-configure", "--provider-id", "epi-prime-ql", "--launcher", LAUNCHER, "--prime-bin", PRIME, "--ql-bin", join(QL_DIR, "ql"), "--ql-revision", QL_REVISION, "--body-revision", BODY_REVISION, "--skill-path", SKILL, "--extension", installed.extension, "--installation", installed.binding, "--research-bin", RESEARCH, "--faculty-config", facultyConfig, "--ql-root", QL_ROOT);
    if (configured.ok === false) throw new Error(JSON.stringify(configured));
    record.configured = configured.data ?? configured;
    participant = "agent/field-walk-chat";                 // what the per-project agency mint discloses for this project (probed)
  } else {
    const apply = preview => native("apply", "--preview-json", JSON.stringify(preview));
    apply(native("create", SPACE, "--label", "Field turn"));
    for (const intent of [{operation: "bind-project-context", binding: native("project-context")}, {operation: "attach-agent-session", attachment: {agent_session: SESSION, purpose: PURPOSE, provenance: ["field-matrix walk"]}}]) {
      const f = join(root, "intent.json"); writeFileSync(f, JSON.stringify(intent));
      apply(native("stage", "--space", SPACE, "--intent-json", "@" + f));
    }
    const configured = native("encounter-configure", "--provider-json", JSON.stringify({protocol: "pi-rpc", id: PI_ID, label: PI_LABEL, argv: walkPiArgv()}));
    record.configured = configured.data ?? configured;
    participant = SESSION;                                 // no agency is minted for a pre-created session: the participant is the session
  }

  // AIKit's own Redis NOW service in this cell's home
  redisDir = join(root, "redis-now");
  const port = String(4800 + Math.floor(Math.random() * 400));
  const provisioned = top("now-context", "service", "provision", "--service-dir", redisDir, "--port", port, "--redis-server", process.env.REDIS_SERVER ?? "/opt/homebrew/bin/redis-server", "--maxmemory-mb", "64");
  if (!provisioned.ok) throw new Error(JSON.stringify(provisioned));
  const started = top("now-context", "service", "start", "--service-dir", redisDir);
  if (!started.ok || started.data?.health?.profile_conforms !== true) throw new Error(JSON.stringify(started));
  const redisConfig = join(redisDir, "redis-now.json");
  record.redisConfig = redisConfig;
  const election = JSON.parse(readFileSync(redisConfig, "utf8"));

  // the candidate set Kev ranks: real pages of the edition (two that speak to position structure, one adjacent, two unrelated)
  const content = JSON.parse(readFileSync(join(site, "essay/static/contentIndex.json"), "utf8"));
  const pick = [["section-rooms/04-mathematical-substrate/movements/25-s3-p0-eight-determinations", "relevant"], ["symbolon/matheme/process/harmonics-symmetries", "relevant"], ["symbolon/matheme/process/spanda", "relevant"],
    ["section-rooms/arguments/concepts/diaphaneity", "adjacent"], ["symbolon/episteme/sources/psychology/jung/jung-1978-aion-cw9-2/jung-1978-aion-cw9-2", "unrelated"], ["symbolon/episteme/sources/physics/pauli/pauli-1955-kepler-archetypal-ideas/pauli-1955-kepler-archetypal-ideas", "unrelated"]];
  const picked = pick.filter(([slug]) => content[slug]);
  const candidates = picked.map(([slug], i) => ({source_ref: `context-source/field-walk-${i + 1}`, source_revision: "edition", title: content[slug].title, excerpt: String(content[slug].content ?? "").replace(/\s+/g, " ").slice(0, 1400), route: null, agent_visibility: "payload", external_egress: "allowed"}));
  record.candidates = picked.map(([slug, kind], i) => ({ref: `context-source/field-walk-${i + 1}`, title: content[slug].title, walk_kind: kind, slug}));
  const projectContext = JSON.parse(nativeRaw("project-context"));
  const request = {
    schema: "aikit.now-preparation-request/v1", redis: election, project_ref: projectContext.project ?? projectContext.data?.project, now_ref: allocated.now_ref,
    participant_ref: participant, agent_session: HARNESS === "pi" ? SESSION : "agent-session/rewritten-at-entry",
    concern: "Answer a reader's question about the passage they are reading in the field",
    disclosure_revision: "field-matrix-1", central: {root, ctrl_bin: CTRL, project: "Field"}, candidate_items: candidates, expected_version: 0, external_provider: true,
    selection: {mode: "provider", provider_file: KEV, state: {undertaking: "ground the reader's question about the position structure of the passage in view"}, relevance_threshold: 0.2},
  };
  const requestFile = join(root, "now-prepare.json");
  writeFileSync(requestFile, JSON.stringify(request));
  // preflight: one real preparation now, so Kev's invocation is proven before any model turn is spent
  const pre = top("now-context", "prepare", "--request-file", requestFile);
  const sel = pre.data?.selection ?? {};
  record.preflight = {ok: pre.ok, mode: sel.mode, decisionInvocation: sel.decisionInvocation, decisionProvider: sel.decisionProvider, selected: sel.selectedCandidateRefs};
  const rowId = HARNESS === "prime" ? "epi-prime-ql" : PI_ID;
  const now = native("encounter-now-context-configure", "--provider-id", rowId, "--redis-config", redisConfig, "--prepare-request", requestFile);
  if (now.ok === false) throw new Error(JSON.stringify(now));
  record.nowContext = now.data ?? now;
  const owner = native("encounter-start");
  if (!owner.ok) throw new Error(JSON.stringify(owner));
  return {env: ownerEnv, cleanup: () => {
    try { process.kill(-owner.data.pid, "SIGTERM"); } catch { /* gone */ }
    try { spawnSync(aikit, ["--json", "now-context", "service", "stop", "--service-dir", redisDir], {env: ownerEnv}); } catch { /* gone */ }
  }};
};

const fixture = fileURLToPath(new URL("../../tests/fixtures/field-corpus/", import.meta.url));
let f;
try { f = await bootField({epi: false, provision, fixture}); }
catch (e) { console.error(String(e?.stack ?? e)); process.exit(1); }
ground = f.ground;
const {page} = f;
const settle = ms => page.waitForTimeout(ms);
const enc = async () => JSON.parse(await page.locator(".field-root").getAttribute("data-encounter"));
const ops = [];
page.on("request", r => { if (!r.url().endsWith("/op")) return; try { const b = r.postDataJSON(); ops.push({op: b?.op, action: b?.request?.action, preferred_body_ref: b?.preferred_body_ref}); } catch { /* not json */ } });
const clickNode = async ref => { const b = await page.locator(`.graph-svg .gn[data-ref="${ref}"] circle.hit`).first().boundingBox(); await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2); };
let failed = false;
try {
  // 0 — Epi OFF: the generic corpus (an ordinary project), read by the generic adapter
  await page.locator('.futil [data-util="scope"]').click();
  await page.locator('.futil__menu[aria-label="Scope"] .futil__item', {hasText: "Field"}).click();
  await page.waitForSelector(".article.fpane:not([hidden]) .ahead__title", {timeout: 60000});
  const generic = await page.evaluate(() => ({title: document.querySelector(".article.fpane:not([hidden]) .ahead__title")?.textContent, essayEyebrow: !!document.querySelector(".article.fpane:not([hidden]) .ahead__eyebrow")}));
  const eOff = await enc();
  check(!!generic.title && !!eOff.primary?.ref && !/\/essay\//.test(eOff.primary.ref), "Epi OFF: the field reads the project's own corpus (generic adapter), not the essay", {title: generic.title, ref: eOff.primary?.ref});
  record.epiOff = {title: generic.title, primary: eOff.primary?.ref, default_body_for_a_new_conversation: "none (modeDefaultAgentBody returns undefined without the epi-logos world; tests/epi-prime-agent-mode.test.mjs)"};

  // 1 — Epi ON: the essay
  await page.locator('.futil [data-util="scope"]').click();
  await page.locator('.futil__menu[aria-label="Scope"] .futil__item', {hasText: "Epi-Logos"}).click();
  await page.waitForSelector(".article.fpane:not([hidden]) .ahead__eyebrow", {timeout: 60000}); await settle(1000);
  const search = page.getByRole("searchbox", {name: "Search"});
  await search.fill("The Return of Zero"); await settle(300); await search.press("Shift+Enter");
  await page.waitForFunction(() => document.querySelector(".article.fpane:not([hidden]) .ahead__eyebrow")?.textContent?.includes("Manuscript"), null, {timeout: 60000});
  await search.fill("");
  await page.locator(".mrail__t[data-span='M16']").click({force: true});
  await page.waitForFunction(() => document.querySelector(".field-root")?.getAttribute("data-encounter")?.includes('"span":"M16"'), null, {timeout: 30000});
  await settle(800);
  const e0 = await enc();
  check(/\/essay\/|THE-RETURN-OF-ZERO/i.test(e0.primary.ref) || e0.primary.span === "M16", "Epi ON: the field reads the essay at M16", {ref: e0.primary.ref, span: e0.primary.span});

  // 2 — the Expression: Library → Here → the room's Expression, a scene chosen, then return to the passage
  await page.getByRole("button", {name: /Library/}).first().click(); await settle(800);
  await page.waitForSelector(".library .xcard", {timeout: 30000});
  await page.locator(".xcolls button", {hasText: /^Here/}).click(); await settle(500);
  const card = page.locator('.library .xcard[data-x="expression:roz-room-02-return-of-zero"]');
  await card.locator(".xchip-s").nth(2).click();
  await page.waitForSelector("iframe.xframe", {timeout: 30000}); await settle(2500);
  const eX = await enc();
  check(eX.tangent?.kind === "expression" && eX.tangent.ref === "expression:roz-room-02-return-of-zero" && !!eX.scene?.scene_id, "an Expression opened as the tangent with its scene", {ref: eX.tangent?.ref, scene: eX.scene?.scene_id});
  const xf = page.frames().find(fr => /expression\.html/.test(fr.url()));
  check(!!xf && await xf.evaluate(() => document.body.innerText.length).catch(() => 0) > 40, "the real Expression renderer is playing in its frame");
  await page.locator(".ftab").first().click(); await settle(1200);
  const eR = await enc();
  check(eR.focus === "primary" && eR.primary.span === "M16" && await page.locator("iframe.xframe").count() === 0, "return: the passage at M16, the Expression's frame released", {focus: eR.focus, span: eR.primary.span});

  // 3 — a relation selected, a tangent page opened, another page selected
  const rel = await page.evaluate(() => { const li = [...document.querySelectorAll(".conn__g li[data-ref]")].find(l => /\/arguments\//.test(decodeURIComponent(l.dataset.ref)) && !/README/.test(decodeURIComponent(l.dataset.ref))); return li?.dataset.ref; });
  await clickNode(rel); await settle(400); await page.mouse.dblclick(...(await (async () => { const b = await page.locator(`.graph-svg .gn[data-ref="${rel}"] circle.hit`).first().boundingBox(); return [b.x + b.width / 2, b.y + b.height / 2]; })()));
  await page.waitForFunction(r => { try { return JSON.parse(document.querySelector(".field-root").getAttribute("data-encounter")).tangent?.ref === r; } catch { return false; } }, rel, {timeout: 30000}); await settle(600);
  const sel1 = await page.evaluate(rel0 => [...document.querySelectorAll(".graph-svg .gn[data-ref]")].map(g => g.dataset.ref).find(r => r !== rel0 && !document.querySelector(`.gn--focus[data-ref="${r}"]`)), rel);
  await clickNode(sel1); await settle(500);
  const e1 = await enc();
  check(e1.primary.span === "M16" && e1.tangent?.ref === rel && e1.selected === sel1, "the field stands at M16 with a tangent open and a different page selected", {gen: e1.generation});
  await page.locator('.futil [data-util="companion"]').click();
  await page.locator('.futil__menu[aria-label="Companion"] .futil__item', {hasText: "Follows the active locus"}).click(); await settle(300);
  await page.keyboard.press("Escape"); await settle(1500);
  await page.screenshot({path: shotPath(`field-matrix-${cell}-01-encounter.png`)});

  // 4 — the companion
  const credential = {
    home_logins_present: [".prime/agent/auth.json", ".pi/agent/auth.json"].filter(p => existsSync(join(process.env.HOME ?? realHome, p))),
    credential_env_names: Object.keys(process.env).filter(k => /API_KEY|TOKEN|SECRET|PASSWORD/i.test(k) && !/^OI_/.test(k)),
  };
  record.credentialProbe = {home: process.env.HOME, ...credential};
  if (CONTEXT === "clean") {
    check(credential.home_logins_present.length === 0 && credential.credential_env_names.length === 0, "the clean context holds no provider login (sandbox HOME) and no credential environment variable", record.credentialProbe);
    skip("real turn: not run — no credential in the clean context (evidence gap, named: this cell proves the field, the context seam and provisioning up to the send, not a model turn)");
    // what can still be shown without a credential: the field item is held by AIKit for the session this walk pre-created (pi)
  } else if (!wantReal) {
    skip("real turn: not run — OI_WALK_REAL_PROVIDER not set (plan-quota spend is opt-in)");
  } else {
    let ref, panel;
    const message = () => panel.getByRole("textbox", {name: "Message", exact: true});
    if (HARNESS === "prime") {
      await page.getByRole("button", {name: "Toggle right region"}).click(); await settle(800);
      panel = page.locator('[data-region="right"]');
    } else {
      await page.getByRole("button", {name: "Toggle left region"}).click(); await settle(600);
      const nav = page.getByRole("complementary", {name: "World navigator"});
      await nav.locator('[data-project-path="Work/Field"]').click({timeout: 20000}).catch(() => {});
      await page.getByRole("button", {name: PURPOSE, exact: true}).click({timeout: 20000}); await settle(800);
      await page.getByRole("button", {name: "Toggle left region"}).click(); await settle(500);
      panel = page.locator('[data-region="right"]');
      const opened = await (await fetch(`${f.bridgeUrl}/op`, {method: "POST", headers: {"content-type": "application/json"}, body: JSON.stringify({op: "encounter", project: "Field", request: {action: "open", space: SPACE, agent_session: SESSION, provider: PI_ID}})})).json();
      check(opened.ok, "the owner opened the pinned pi route (the kernel's encounter op)", opened.error ?? opened.outcome?.result);
      await panel.locator('.chat-composer[data-connection="connected"]').waitFor({timeout: 90000});
    }
    await message().waitFor({timeout: 30000});
    await message().fill(HARNESS === "prime"
      ? "Use your QL tools, at most three calls. For the passage I am reading (the manuscript span in view, with the page I have open beside it), what is its quaternary / MEF position structure? State only the positions the QL tools returned. End with DONE_FIELD_QL."
      : "In two short sentences: which manuscript span is the reader on and what page is open beside it? End with DONE_FIELD_QL.");
    await page.waitForFunction(() => !document.querySelector(".agent-chat .chat-send")?.disabled, undefined, {timeout: 30000});
    await panel.getByRole("button", {name: "Send", exact: true}).click();
    if (HARNESS === "prime") {
      await page.waitForFunction(() => !!document.querySelector(".agent-layer")?.dataset.agentSessionRef, null, {timeout: 120000});
      ref = await page.evaluate(() => document.querySelector(".agent-layer")?.dataset.agentSessionRef);
      const provisioning = ops.find(o => o.op === "encounter_provision");
      check(provisioning?.preferred_body_ref === BODY, "Epi lens ON: the panel's provision asked for the Epi body (existing selection mechanism)", provisioning);
    } else ref = SESSION;
    record.agentSession = ref;
    const request = (action, fields = {}) => { const r = native("encounter", "--request-json", JSON.stringify({action, agent_session: ref, ...fields})); if (!r.ok) throw new Error(JSON.stringify(r)); return r.data; };
    const status = request("status");
    record.status = {provider: status.provider, native_session_id: status.native_session_id, model_observation: status.model_observation};
    if (HARNESS === "prime") check(status.provider?.body_ref === BODY && status.provider?.id === "epi-prime-ql" && status.provider?.body_revision === BODY_REVISION, "the conversation is the Prime-QL body at the delivered revision", status.provider);
    else check(status.provider?.id === PI_ID, "the conversation is the pinned pi route", status.provider);
    await page.waitForFunction(() => Array.from(document.querySelectorAll(".encounter-assistant, .chat-assistant, [data-role='assistant']")).some(n => n.textContent.includes("DONE_FIELD_QL")), null, {timeout: 900000}).catch(() => {});
    await settle(2000);
    await page.screenshot({path: shotPath(`field-matrix-${cell}-02-turn.png`)});
    record.chatTail = (await panel.innerText()).slice(-2200);
    const events = request("read", {after: 0, limit: 4000}).events.map(r => r.event);
    const user = events.filter(e => e?.kind === "user-message");
    const userText = JSON.stringify(user[0] ?? {});
    check(user.length >= 1 && /field-encounter|field generation/.test(userText), "the delivered turn carried the field item (reviewed context)", {len: userText.length});
    const delivered = events.filter(e => e?.kind === "now-context-delivered"), degraded = events.filter(e => e?.kind === "now-context-degraded");
    check(delivered.length >= 1 && degraded.length === 0, "AIKit delivered Redis-prepared NOW context to the turn", {delivered: delivered.length, degraded: degraded.map(d => d.detail)});
    const use = spawnSync(aikit.replace(/aikit$/, "aikit-session-space"), ["-C", join(ground.root, "Work", "Field"), "encounter-use", "--agent-session", ref, ...(record.facultyConfig ? ["--faculty-config", record.facultyConfig] : []), "--redis-config", record.redisConfig], {encoding: "utf8", env: ownerEnv});
    record.encounterUse = {status: use.status, stdout: use.stdout, stderr: use.stderr};
    writeFileSync(shotPath(`field-matrix-${cell}.encounter-use.raw.json`), use.stdout || use.stderr);
    console.log("---- encounter-use (raw) ----\n" + (use.stdout || use.stderr) + "\n---- end ----");
    let reading = null; try { reading = JSON.parse(use.stdout); } catch { /* raw kept */ }
    check(use.status === 0 && !!reading, "the recorder read the turn", {status: use.status, outcome: reading?.turn?.outcome});
    const fromReceipt = reading?.decision?.from_delivery_receipt;
    check(!!fromReceipt?.jev_invocation_ref && !!fromReceipt?.decision_provider, "the recorder shows the decision invocation behind the delivered view (Kev)", fromReceipt);
    const kevAfter = await kevModels();
    record.kev.requests_after = kevAfter.batches?.requests ?? null;
    check(record.kev.requests_after > (record.kev.requests_before ?? -1), "Kev's own counters moved (it answered requests during this cell)", {before: record.kev.requests_before, after: record.kev.requests_after});
    if (HARNESS === "prime") {
      const calls = reading?.ql_operations?.python_faculty_calls ?? [];
      check(calls.length > 0, "the body made QL faculty calls", calls.map(c => c.function));
    } else record.piNote = "pi has no QL faculty: ql_operations is expected to be empty for this harness";
  }
} catch (error) {
  failed = true; check(false, "the cell ran to its end", String(error?.stack ?? error).split("\n").slice(0, 6).join(" | "));
  await page.screenshot({path: shotPath(`field-matrix-${cell}-failure.png`)}).catch(() => {});
} finally {
  const errs = f.errors.filter(m => !/Failed to load resource|favicon/.test(m));
  check(errs.length === 0, "no page or console errors", errs.slice(0, 4));
  if (tripwire) {
    const entries = tripwire.entries();
    record.tripwire = {...record.tripwire, entries, count: entries.length};
    check(entries.length === 0, "the tripwire log is empty: no Factory/Workcell dispatch was attempted", entries.slice(0, 5));
  } else record.tripwire = "n/a — the rich context withholds nothing";
  const passed = checks.filter(c => c.ok).length;
  writeReceipt(`field-matrix.${cell}.json`, {scenario: "field-matrix", harness: HARNESS, context: CONTEXT, at: new Date().toISOString(), real_turn: !!record.encounterUse, record, passed: passed === checks.length && !failed, counts: {passed, total: checks.length, skipped: skipped.length}, checks, skipped});
  console.log(`\n${passed}/${checks.length} checks passed${skipped.length ? `, ${skipped.length} skipped` : ""}`);
  await f.dispose();
  process.exit(passed === checks.length && !failed ? 0 : 1);
}
