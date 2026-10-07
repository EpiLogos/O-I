#!/usr/bin/env node
// The field companion is the real QL/Epi agent. Epi lens ON in Base selects the Prime-QL body for a NEW conversation
// through the ordinary provision path (modeDefaultAgentBody → AgentLayer.preferredBodyRef → encounter_provision
// preferred_body_ref → the configured provider that discloses agent-body/epi-prime-ql). From the field (M16, a relation
// selected, a tangent open) ONE real turn asks for the quaternary/MEF position structure of the passage in view, and
// the walk then reads the owner's own recorder (`aikit-session-space encounter-use`) for that turn: the prepared context
// delivered, the Kev decision invocation behind it, and the ql_* calls the body made.
//
// Real: the Prime Agent binary through the Actuation launcher, the installed QL binary + faculty config, AIKit's
// Redis NOW service (provisioned into this walk's own home), the owner's Kev at 127.0.0.1:8019 (never a stand-in),
// the owner's model route (Prime's configured default). Walk-authored: the disposable Central ground, the candidate
// set Kev ranks (real pages of the edition), the mint template (an AIKit test fixture; the owner's standing template
// is not on this machine).
//
// A real turn spends the owner's plan quota, so it is opt-in (OI_WALK_REAL_PROVIDER=1). Everything else is env:
//   OI_AIKIT_BIN                  the AIKit build that has encounter-epi-prime-configure and encounter-use
//   FIELD_SITE_ROOT               a built site root
//   EPI_ACTUATION_PRIME_BINARY    actuation-epi-prime launcher with --extension (the new one)
//   EPI_ACTUATION_ROOT            the Actuation checkout (launcher binary and body revision)
//   EPI_PRIME_DIR                 the Epi-Prime checkout (default ~/Central/Work/Epi-Prime), for install
//   defaults below are the owner's installed material on this machine
import {execFileSync, spawnSync} from "node:child_process";
import {chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync} from "node:fs";
import {homedir} from "node:os";
import {join} from "node:path";
import {fileURLToPath} from "node:url";
import {bootField, shotPath, writeReceipt} from "../lib/field-walk.mjs";
import {realProviderAuthorised, REAL_PROVIDER_SKIP_NOTE} from "../lib/walk-provider.mjs";

const checks = [], skipped = [], record = {};
const check = (ok, label, detail) => { checks.push({ok: !!ok, label, ...(detail !== undefined ? {detail} : {})}); console.log(`${ok ? "PASS" : "FAIL"} — ${label}${detail !== undefined ? " · " + JSON.stringify(detail).slice(0, 360) : ""}`); };
const skip = label => { skipped.push(label); console.log(`SKIP — ${label}`); };
const need = n => { const v = process.env[n]; if (!v) { console.error(`${n} is required`); process.exit(2); } return v; };
const aikit = need("OI_AIKIT_BIN");
const real = realProviderAuthorised();
const home = homedir();
const ACTUATION = process.env.EPI_ACTUATION_ROOT ?? "/Users/admin/Central/worktrees/env-1/actuation";
const EPI_PRIME_DIR = process.env.EPI_PRIME_DIR ?? join(home, "Central/Work/Epi-Prime");   // EpiLogos/Epi-Prime, the Prime distribution
const LAUNCHER = process.env.EPI_ACTUATION_PRIME_BINARY ?? join(ACTUATION, "target/debug/actuation-epi-prime");
const QL_DIR = process.env.EPI_QL_DIR ?? join(home, ".workcell/tools/ql-agent/1a50b99ccf1884a4adbb3e3d6386854678de76d1ee899d89d629c7153977103d");
const PRIME = process.env.EPI_PRIME_AGENT_BINARY ?? join(home, ".npm-global/bin/prime-agent");
const RESEARCH = process.env.EPI_ACTUATION_RESEARCH_BINARY ?? join(home, ".local/bin/actuation-research");
const FACULTY = process.env.EPI_FACULTY_CONFIG ?? join(home, ".workcell/tools/actuation-ql-agent/af0b35ab1f11709a17a778fa129ebeb487715d96837788fb709d98bc3669525b/faculty.json");
const SKILL = process.env.EPI_QL_SKILL_PATH ?? "/Users/admin/Central/Work/Actuation/experiments/native-research/prime/skills/ql-relational";
const QL_ROOT = process.env.EPI_QL_SOURCE_ROOT ?? "/Users/admin/Central/Work/Quaternal-Logic";
const KEV = process.env.EPI_DECISION_PROVIDER ?? join(home, ".aikit/decision-provider.json");
const TEMPLATE = process.env.AIKIT_AGENCY_MINT_TEMPLATE ?? "/Users/admin/Central/worktrees/env-1/ai-kit/crates/aikit-cli/tests/fixtures/mint-agency-template.json";
const git = (dir, ...a) => execFileSync("git", ["-C", dir, ...a], {encoding: "utf8"}).trim();
const QL_REVISION = process.env.EPI_QL_REVISION ?? JSON.parse(readFileSync(FACULTY, "utf8")).owner.revision;   // the revision the installed QL binary was cut at (faculty config owner)
const BODY_REVISION = process.env.EPI_ACTUATION_REVISION ?? git(ACTUATION, "rev-parse", "HEAD");
const BODY = "agent-body/epi-prime-ql";
// the preparation reads Central's NOW (read-only): the owner's real root and this commission's active NOW, so the prepared view is scoped to real work
const CENTRAL_ROOT = process.env.EPI_CENTRAL_ROOT ?? "/Users/admin/Central";
const NOW_REF = process.env.EPI_NOW_REF ?? "central:now:control:root:5af25803c963e6accc9b18696592c163f514730967490f9ab8d5a22ccce77e77";
const site = need("FIELD_SITE_ROOT");

let native, nativeRaw, ownerEnv, redisDir, ownerPid;
const provision = async ({root, home: oiHome, projectRoot}) => {
  const router = join(root, "oi-owner-router.mjs");
  writeFileSync(router, `#!/usr/bin/env node\nimport {spawnSync} from "node:child_process";\nconst args = process.argv.slice(2);\nif (args[0] === "aikit") { const c = spawnSync(${JSON.stringify(aikit)}, args.slice(1), {stdio: "inherit"}); process.exit(c.status ?? 1); }\nconst c = spawnSync("oi", args, {stdio: "inherit"}); process.exit(c.status ?? 1);\n`); chmodSync(router, 0o755);
  const aikitHome = join(root, ".aikit-home");
  ownerEnv = {...process.env, OI_CENTRAL_ROOT: root, OI_HOME: oiHome, OI_CENTRAL_PROJECT_QUERY: "Field", AIKIT_HOME: aikitHome, OI_AIKIT_BIN: aikit, OI_BIN: router, AIKIT_AGENCY_MINT_TEMPLATE: TEMPLATE};
  delete ownerEnv.CENTRAL_NATIVE_TOKEN;
  nativeRaw = (...p) => execFileSync(aikit, ["--json", "session-space", "-C", projectRoot, ...p], {encoding: "utf8", env: ownerEnv});
  native = (...p) => JSON.parse(nativeRaw(...p));
  const top = (...p) => JSON.parse(execFileSync(aikit, ["--json", ...p], {encoding: "utf8", env: ownerEnv}));
  const bind = top("-C", projectRoot, "project", "bind", "field-walk", "--directory", projectRoot, "--no-default-skill-sets");
  if (!bind.ok) throw new Error(JSON.stringify(bind));

  // the installed faculty config has no evidence_root, so the QL owner would write no receipts; this walk's copy adds one (same programs, same decision head)
  const facultyEvidence = join(root, "faculty-evidence");
  mkdirSync(facultyEvidence, {recursive: true});
  const facultyConfig = join(root, "faculty.walk.json");
  writeFileSync(facultyConfig, JSON.stringify({...JSON.parse(readFileSync(FACULTY, "utf8")), evidence_root: facultyEvidence}, null, 2));
  record.facultyConfig = facultyConfig; record.facultyEvidence = facultyEvidence;
  // the body: the distribution's own installer writes the binding this launcher verifies before Prime starts
  const toolsRoot = join(aikitHome, "tools");
  mkdirSync(toolsRoot, {recursive: true});
  const installed = JSON.parse(execFileSync("node", [join(EPI_PRIME_DIR, "tools/epi-distribution.mjs"), "install", "--research-bin", RESEARCH, "--faculty-config", facultyConfig, "--root", toolsRoot], {encoding: "utf8"}));
  record.installation = installed;
  const configured = native("encounter-epi-prime-configure", "--provider-id", "epi-prime-ql", "--launcher", LAUNCHER, "--prime-bin", PRIME, "--ql-bin", join(QL_DIR, "ql"),
    "--ql-revision", QL_REVISION, "--body-revision", BODY_REVISION, "--skill-path", SKILL, "--extension", installed.extension, "--installation", installed.binding,
    "--research-bin", RESEARCH, "--faculty-config", facultyConfig, "--ql-root", QL_ROOT);
  if (configured.ok === false || configured.configured !== true && !configured.data) throw new Error(JSON.stringify(configured));
  record.configured = configured.data ?? configured;

  // AIKit's own Redis NOW service in this home, and the Kev election over a real candidate set
  redisDir = join(root, "redis-now");
  const port = String(4800 + Math.floor(Math.random() * 400));
  const provisioned = top("now-context", "service", "provision", "--service-dir", redisDir, "--port", port, "--redis-server", process.env.REDIS_SERVER ?? "/opt/homebrew/bin/redis-server", "--maxmemory-mb", "64");
  if (!provisioned.ok) throw new Error(JSON.stringify(provisioned));
  const started = top("now-context", "service", "start", "--service-dir", redisDir);
  if (!started.ok || started.data?.health?.profile_conforms !== true) throw new Error(JSON.stringify(started));
  const redisConfig = join(redisDir, "redis-now.json");
  const election = JSON.parse(readFileSync(redisConfig, "utf8"));
  // one candidate per page of the real edition: two that speak to position structure, two that do not
  const content = JSON.parse(readFileSync(join(site, "essay/static/contentIndex.json"), "utf8"));
  const pick = [["section-rooms/04-mathematical-substrate/movements/25-s3-p0-eight-determinations", "relevant"], ["symbolon/matheme/process/harmonics-symmetries", "relevant"], ["symbolon/matheme/process/spanda", "relevant"],
    ["section-rooms/arguments/concepts/diaphaneity", "adjacent"], ["symbolon/episteme/sources/psychology/jung/jung-1978-aion-cw9-2/jung-1978-aion-cw9-2", "unrelated"], ["symbolon/episteme/sources/physics/pauli/pauli-1955-kepler-archetypal-ideas/pauli-1955-kepler-archetypal-ideas", "unrelated"]];
  const candidates = pick.filter(([slug]) => content[slug]).map(([slug, kind], i) => ({source_ref: `context-source/field-walk-${i + 1}`, source_revision: "edition", title: content[slug].title, excerpt: String(content[slug].content ?? "").replace(/\s+/g, " ").slice(0, 1400), route: null, agent_visibility: "payload", external_egress: "allowed", _walk_kind: kind, _slug: slug}));
  record.candidates = candidates.map(c => ({ref: c.source_ref, title: c.title, walk_kind: c._walk_kind, slug: c._slug}));
  for (const c of candidates) { delete c._walk_kind; delete c._slug; }
  const projectContext = JSON.parse(nativeRaw("project-context"));
  const projectRef = projectContext.project ?? projectContext.data?.project;
  const requestFile = join(root, "now-prepare.json");
  writeFileSync(requestFile, JSON.stringify({
    schema: "aikit.now-preparation-request/v1", redis: election, project_ref: projectRef, now_ref: NOW_REF,
    participant_ref: "agent/field-walk-chat", agent_session: "agent-session/placeholder-rewritten-at-entry",
    concern: "Answer a reader's question about the passage they are reading in the field, from the QL position structure",
    disclosure_revision: "field-walk-1", central: {root: CENTRAL_ROOT, ctrl_bin: process.env.OI_CENTRAL_CTRL_BIN ?? join(homedir(), ".local/bin/ctrl")}, candidate_items: candidates, expected_version: 0, external_provider: true,
    selection: {mode: "provider", provider_file: KEV, state: {undertaking: "ground the reader's question about the position structure of the passage in view"}, relevance_threshold: 0.2},
  }));
  const now = native("encounter-now-context-configure", "--provider-id", "epi-prime-ql", "--redis-config", redisConfig, "--prepare-request", requestFile);
  if (now.ok === false) throw new Error(JSON.stringify(now));
  record.nowContext = now.data ?? now;
  record.redisConfig = redisConfig;
  const owner = native("encounter-start");
  if (!owner.ok) throw new Error(JSON.stringify(owner));
  ownerPid = owner.data.pid;
  return {env: ownerEnv, cleanup: () => {
    try { process.kill(-owner.data.pid, "SIGTERM"); } catch { /* gone */ }
    try { spawnSync(aikit, ["--json", "now-context", "service", "stop", "--service-dir", redisDir], {env: ownerEnv}); } catch { /* gone */ }
  }};
};

// refuse early and plainly if the owner's real Kev is not answering (no stand-in, ever)
try {
  const models = await (await fetch("http://127.0.0.1:8019/v1/models", {signal: AbortSignal.timeout(4000)})).json();
  record.kev = {address: "127.0.0.1:8019", models: models.models?.map(m => ({name: m.name, run: m.run, base: m.base}))};
} catch (e) { console.error(`the owner's Kev is not answering at 127.0.0.1:8019: ${e}`); process.exit(2); }
for (const [n, p] of [["Central root", CENTRAL_ROOT], ["launcher", LAUNCHER], ["prime-agent", PRIME], ["ql", join(QL_DIR, "ql")], ["actuation-research", RESEARCH], ["faculty config", FACULTY], ["skill path", SKILL], ["QL root", QL_ROOT], ["decision provider", KEV]]) if (!existsSync(p)) { console.error(`missing ${n}: ${p}`); process.exit(2); }

const fixture = fileURLToPath(new URL("../../tests/fixtures/field-corpus/", import.meta.url));
const f = await bootField({epi: false, provision, fixture});
const {page} = f;
const settle = ms => page.waitForTimeout(ms);
const enc = async () => JSON.parse(await page.locator(".field-root").getAttribute("data-encounter"));
const sends = [];
page.on("request", r => { if (!r.url().endsWith("/op")) return; try { const b = r.postDataJSON(); const q = b?.request; if (q?.action === "prompt-context" || q?.action === "send" || q?.action === "prompt") sends.push({t: Date.now(), action: q.action, context: q.context, draft_revision: q.draft_revision}); if (b?.op === "encounter_provision") record.provisionRequest = {op: b.op, project: b.project, preferred_body_ref: b.preferred_body_ref}; } catch { /* not json */ } });
const ops = [];
page.on("request", r => { if (!r.url().endsWith("/op")) return; try { const b = r.postDataJSON(); ops.push({op: b?.op, action: b?.request?.action, preferred_body_ref: b?.preferred_body_ref}); } catch { /* */ } });
let failed = false;
try {
  // 0 — Epi lens OFF: the ordinary agent. The field reads the project; a new conversation would NOT ask for the Epi body.
  await page.locator('.futil [data-util="scope"]').click();
  await page.locator('.futil__menu[aria-label="Scope"] .futil__item', {hasText: "Field"}).click();
  await page.waitForSelector(".article.fpane:not([hidden]) .ahead__title", {timeout: 60000});
  // 1 — lens ON: the field reads the essay, and the panel's agent selection follows the lens
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
  const rel = await page.evaluate(() => { const li = [...document.querySelectorAll(".conn__g li[data-ref]")].find(l => /\/arguments\//.test(decodeURIComponent(l.dataset.ref)) && !/README/.test(decodeURIComponent(l.dataset.ref))); return li?.dataset.ref; });
  const box = await page.locator(`.graph-svg .gn[data-ref="${rel}"] circle.hit`).first().boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2); await settle(400);
  const b2 = await page.locator(`.graph-svg .gn[data-ref="${rel}"] circle.hit`).first().boundingBox();
  await page.mouse.dblclick(b2.x + b2.width / 2, b2.y + b2.height / 2);
  await page.waitForFunction(() => document.querySelectorAll(".ftab").length === 2, null, {timeout: 30000}); await settle(600);
  const sel1 = await page.evaluate(rel0 => [...document.querySelectorAll(".graph-svg .gn[data-ref]")].map(g => g.dataset.ref).find(r => r !== rel0 && !document.querySelector(`.gn--focus[data-ref="${r}"]`)), rel);
  const b3 = await page.locator(`.graph-svg .gn[data-ref="${sel1}"] circle.hit`).first().boundingBox();
  await page.mouse.click(b3.x + b3.width / 2, b3.y + b3.height / 2); await settle(500);
  const e1 = await enc();
  check(e1.primary.span === "M16" && e1.tangent?.ref === rel && e1.selected === sel1, "the field stands at M16 with a tangent open and a different page selected", {gen: e1.generation});
  await page.locator('.futil [data-util="companion"]').click();
  await page.locator('.futil__menu[aria-label="Companion"] .futil__item', {hasText: "Follows the active locus"}).click(); await settle(300);
  await page.keyboard.press("Escape"); await settle(1500);
  await page.screenshot({path: shotPath("field-ql-01-encounter-1440.png")});

  if (!real) { skip(`the provision through the Epi lens and the real QL turn — ${REAL_PROVIDER_SKIP_NOTE}`); }
  else {
    // 2 — the unbound composer: the first Send provisions through the ordinary path with the lens-selected body
    await page.getByRole("button", {name: "Toggle right region"}).click(); await settle(800);
    const panel = page.locator('[data-region="right"]');
    await page.screenshot({path: shotPath("field-ql-01b-panel-open.png")});
    const message = panel.getByRole("textbox", {name: "Message", exact: true});
    await message.waitFor({timeout: 30000});
    await message.fill("Use your QL tools, at most three calls. For the passage I am reading (the manuscript span in view, with the page I have open beside it), what is its quaternary / MEF position structure? State only the positions the QL tools returned. End with DONE_FIELD_QL.");
    await page.waitForFunction(() => !document.querySelector(".agent-chat .chat-send")?.disabled, undefined, {timeout: 30000});
    await panel.getByRole("button", {name: "Send", exact: true}).click();
    await page.waitForFunction(() => !!document.querySelector(".agent-layer")?.dataset.agentSessionRef, null, {timeout: 120000});
    const ref = await page.evaluate(() => document.querySelector(".agent-layer")?.dataset.agentSessionRef);
    record.agentSession = ref;
    const provisioning = ops.find(o => o.op === "encounter_provision");
    check(provisioning?.preferred_body_ref === BODY, "the panel's provision asked for the Epi body because the lens is on (existing selection mechanism)", provisioning);
    const request = (action, fields = {}) => { const r = native("encounter", "--request-json", JSON.stringify({action, agent_session: ref, ...fields})); if (!r.ok) throw new Error(JSON.stringify(r)); return r.data; };
    const status = request("status");
    record.status = {provider: status.provider, native_session_id: status.native_session_id, model_observation: status.model_observation};
    check(status.provider?.body_ref === BODY && status.provider?.id === "epi-prime-ql", "the provisioned conversation is the Prime-QL body, not a generic agent", status.provider);
    check(status.provider?.body_revision === BODY_REVISION, "the body revision is the delivered Actuation revision", status.provider?.body_revision);
    // wait for the turn to end
    await page.waitForFunction(() => Array.from(document.querySelectorAll(".encounter-assistant, .chat-assistant, [data-role='assistant']")).some(n => n.textContent.includes("DONE_FIELD_QL")), null, {timeout: 900000}).catch(() => {});
    await settle(2000);
    await page.screenshot({path: shotPath("field-ql-02-turn-1440.png")});
    const chatText = await panel.innerText();
    record.chatTail = chatText.slice(-2500);
    const journal = request("read", {after: 0, limit: 2000});
    const events = journal.events.map(r => r.event);
    record.journalKinds = events.map(e => e?.kind ?? Object.keys(e ?? {})[0]);
    const user = events.filter(e => e?.kind === "user-message");
    check(user.length >= 1, "the owner's journal recorded the user turn", record.journalKinds.slice(0, 30));
    const userText = JSON.stringify(user[0] ?? {});
    check(userText.includes("field-encounter") || userText.includes("field generation"), "the turn carried the field item (reviewed context)", {len: userText.length});
    check(events.some(e => e?.kind === "now-context-delivered"), "AIKit delivered Redis-prepared NOW context to the turn", events.filter(e => /now-context/.test(e?.kind ?? "")).map(e => e.kind));
    // the owner's own recorder
    const use = spawnSync(aikit.replace(/aikit$/, "aikit-session-space"), ["-C", join(f.ground.root, "Work", "Field"), "encounter-use", "--agent-session", ref, "--faculty-config", record.facultyConfig, "--redis-config", record.redisConfig], {encoding: "utf8", env: ownerEnv});
    record.encounterUse = {status: use.status, stdout: use.stdout, stderr: use.stderr};
    writeFileSync(shotPath("field-ql-encounter-use.raw.json"), use.stdout || use.stderr);
    console.log("---- encounter-use (raw) ----\n" + (use.stdout || use.stderr) + "\n---- end ----");
    let reading = null; try { reading = JSON.parse(use.stdout); } catch { /* raw kept */ }
    const data = reading?.data ?? reading;
    check(use.status === 0 && !!data, "the recorder read the turn", {status: use.status});
    const qlOps = JSON.stringify(data ?? {});
    check(/ql_[a-z_]+/.test(qlOps) || /ql_relational/.test(qlOps), "the body made QL operations (ql_* / ql_relational.*)", (qlOps.match(/ql_[a-z_.]+/g) ?? []).slice(0, 12));
  }
} catch (error) {
  failed = true; check(false, "the walk ran to its end", String(error?.stack ?? error).split("\n").slice(0, 6).join(" | "));
  await page.screenshot({path: shotPath("field-ql-failure.png")}).catch(() => {});
} finally {
  const errs = f.errors.filter(m => !/Failed to load resource|favicon/.test(m));
  check(errs.length === 0, "no page or console errors", errs.slice(0, 4));
  const passed = checks.filter(c => c.ok).length;
  writeReceipt(real ? "field-companion-ql.json" : "field-companion-ql.no-send.json", {scenario: "field-companion-ql", at: new Date().toISOString(), real_turn: real, record, passed: passed === checks.length && !failed, counts: {passed, total: checks.length, skipped: skipped.length}, checks, skipped});
  console.log(`\n${passed}/${checks.length} checks passed${skipped.length ? `, ${skipped.length} skipped` : ""}`);
  await f.dispose();
  process.exit(passed === checks.length && !failed ? 0 : 1);
}
