#!/usr/bin/env node
// The candidate profile's companion: an ISOLATED AIKit home in which the Epi-Logos Prime-QL body is what the panel provisions, with the
// QL binding verified by the launcher, a coherent faculty configuration, and Redis-prepared NOW context electing the owner's live Kev.
// The owner's everyday AIKit home, rows and tools are never read for writing and never changed.
//
//   import {provisionCompanion} from "./candidate-companion.mjs"      (used by candidate-launch.mjs)
//   node scripts/candidate-companion.mjs [--profile NAME] [--ground DIR] [--start]     provision (idempotent) and report; --start also starts the owner
//
// What it lays down under <profile>/aikit-home (everything idempotent: re-running keeps what is there and repairs what is not):
//   tools/prime-epi/...        the Prime distribution (explicit `-e` extension, fail-closed QL binding) + a copy of the new launcher
//   faculty/faculty.json       the faculty configuration GENERATED from the owner instrument (pinned to the revision it reports)
//   state/…                    the `epi-prime-ql` provider row (new launcher, extension, installation), now_context on it, the minted agency
//   services/redis-now         AIKit's own Redis NOW service on a candidate port (started if not running; stopped on exit iff started here)
//   decision-provider.json     the live Kev's endpoint election (copied from the owner's, read-only), Kev itself is NOT started here
//   now-prepare.json           the authored preparation request: the candidate items (real pages of the installed World), egress stated per item
//   agency-template.json       the candidate-only standing template for the Agency mint (the owner's own template is not on this machine)
//
// Credentials: none are written anywhere. The model key reaches Prime/Pi only through the environment of the process that launches the candidate
// (ZAI_API_KEY for zai/glm-5.3-flash); this module only reports whether the name is present.
import {execFileSync, spawn, spawnSync} from "node:child_process";
import {chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync} from "node:fs";
import {createHash} from "node:crypto";
import {homedir} from "node:os";
import {dirname, join, resolve} from "node:path";
import {fileURLToPath} from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const cradle = resolve(here, "..");
const repo = resolve(cradle, "../..");
const HOME = homedir();
const sha = bytes => createHash("sha256").update(bytes).digest("hex");

const PROVIDER_ID = "epi-prime-ql";
const BODY_REF = "agent-body/epi-prime-ql";

function defaults(env = process.env) {
  const central = join(HOME, "Central");
  return {
    aikit: env.OI_AIKIT_BIN ?? join(central, "worktrees/env-1/ai-kit/target/debug/aikit"),
    actuation: env.EPI_ACTUATION_ROOT ?? join(central, "worktrees/env-1/actuation"),
    // the Epi Prime distribution (EpiLogos/Epi-Prime): its own repository, not part of Actuation
    epiPrime: env.EPI_PRIME_DIR ?? join(central, "Work/Epi-Prime"),
    instrument: env.EPI_OWNER_INSTRUMENT ?? join(central, "Work/Actuation/experiments/ql-runtime/native-owner-instrument/target/debug/actuation-ql-owner-instrument"),
    qlRoot: env.EPI_QL_ROOT ?? join(central, "Work/Quaternal-Logic"),
    ql: env.EPI_QL_BIN ?? join(central, "Work/Quaternal-Logic/target/debug/ql"),
    prime: env.EPI_PRIME_AGENT_BINARY ?? join(HOME, ".npm-global/lib/node_modules/prime-agent/dist/bundle/cli.js"),
    // the skill of the Actuation checkout the launcher comes from (one source of record, not a second copy elsewhere)
    skill: env.EPI_QL_SKILL_PATH ?? join(env.EPI_ACTUATION_ROOT ?? join(central, "worktrees/env-1/actuation"), "experiments/ql-runtime/prime/skills/ql-relational"),
    research: env.EPI_ACTUATION_RESEARCH_BINARY ?? join(HOME, ".local/bin/actuation-research"),
    ctrl: env.OI_CENTRAL_CTRL_BIN ?? join(HOME, ".local/bin/ctrl"),
    template: env.AIKIT_AGENCY_MINT_TEMPLATE ?? join(central, "worktrees/env-1/ai-kit/crates/aikit-cli/tests/fixtures/mint-agency-template.json"),
    redisServer: env.EPI_REDIS_SERVER ?? "/opt/homebrew/bin/redis-server",
    liveKev: env.EPI_DECISION_PROVIDER ?? join(HOME, ".aikit/decision-provider.json"),
    redisPort: Number(env.EPI_CANDIDATE_REDIS_PORT ?? 6391),
  };
}

const KEV_START = "sh ~/.workcell/decision-models/kev-0.8b/serve-kev.sh ~/.workcell/decision-models/kev-0.8b 8019";

/** Provision the candidate companion. Returns what to add to the launched processes' environment, a summary, and `stop()` for what it started. */
export async function provisionCompanion({profileDir, ground, worldsRoot, oi, project = "O-I", start = true, log = console.log, env: baseEnv = process.env, overrides = {}}) {
  const d = {...defaults(baseEnv), ...overrides};
  const home = join(profileDir, "aikit-home");
  const required = [["aikit (the candidate build)", d.aikit], ["actuation checkout", d.actuation], ["Epi Prime distribution (EPI_PRIME_DIR)", join(d.epiPrime, "tools/epi-distribution.mjs")], ["owner instrument", d.instrument], ["ql", d.ql], ["prime-agent", d.prime], ["QL skill", d.skill],
    ["actuation-research", d.research], ["ctrl", d.ctrl], ["agency template", d.template], ["redis-server", d.redisServer], [`launcher (${join(d.actuation, "target/debug/actuation-epi-prime")})`, join(d.actuation, "target/debug/actuation-epi-prime")]];
  for (const [name, path] of required) if (!existsSync(path)) throw new Error(`the companion needs ${name}: ${path} is missing`);
  const projectDir = join(ground, "Work", project);
  if (!existsSync(projectDir)) throw new Error(`the companion's project ${project} has no directory at ${projectDir} (--companion-project)`);
  for (const sub of ["tools", "faculty", "faculty-evidence", "services"]) mkdirSync(join(home, sub), {recursive: true});

  // The environment every AIKit call and every launched process shares: the candidate home, the candidate build, an `oi` that routes `aikit` there.
  const template = join(home, "agency-template.json");
  copyFileSync(d.template, template);
  const launchedEnv = {AIKIT_HOME: home, OI_AIKIT_BIN: d.aikit, OI_BIN: oi ?? "oi", OI_REAL_BIN: oi ?? "oi", AIKIT_AGENCY_MINT_TEMPLATE: template, OI_CENTRAL_ROOT: ground,
    // the kernel's co-reference fallback: the project a chat conversation belongs to when the panel names none (without it the panel has no project to provision for)
    OI_CENTRAL_PROJECT_QUERY: project};
  const env = {...baseEnv, ...launchedEnv};
  delete env.CENTRAL_NATIVE_TOKEN;
  const aikit = (...args) => { const r = spawnSync(d.aikit, ["--json", ...args], {encoding: "utf8", env, maxBuffer: 64 * 1024 * 1024}); let json = null; try { json = JSON.parse(r.stdout); } catch { /* raw below */ } return {status: r.status, json, raw: (r.stdout + r.stderr).slice(0, 2000)}; };
  const native = (...args) => aikit("session-space", "-C", projectDir, ...args);
  const sh = (cmd, args) => execFileSync(cmd, args, {encoding: "utf8", env, maxBuffer: 64 * 1024 * 1024});
  // The candidate AIKit build is FROZEN into the profile (<profile>/aikit-bin/aikit). The ai-kit checkouts share one cargo target, so `target/debug/aikit` is whatever
  // lane built last (observed 7 Oct: a link without the services, then one without `encounter-use`). The copy is verified for every verb this uses, and a later
  // clobber of the shared target cannot change what the candidate runs.
  const needs = bin => {
    const run = (...args) => spawnSync(bin, args, {encoding: "utf8", env});
    const sessionHelp = run("session-space", "--help").stdout;
    return run("now-context", "service", "--help").status === 0 && run("decide", "service", "--help").status === 0
      && ["encounter-now-context-configure", "encounter-epi-prime-configure", "encounter-use"].every(verb => sessionHelp.includes(verb));
  };
  const frozenAikit = join(profileDir, "aikit-bin/aikit");
  if (existsSync(d.aikit) && needs(d.aikit)) {
    mkdirSync(dirname(frozenAikit), {recursive: true});
    if (!existsSync(frozenAikit) || sha(readFileSync(frozenAikit)) !== sha(readFileSync(d.aikit))) { copyFileSync(d.aikit, frozenAikit); chmodSync(frozenAikit, 0o755); }
  } else if (!(existsSync(frozenAikit) && needs(frozenAikit))) {
    throw new Error(`${d.aikit} lacks \`now-context service\`, \`encounter-now-context-configure\` or \`encounter-use\` (the ai-kit checkouts share one cargo target, so another lane's build may have replaced it) and the profile holds no good frozen copy. Rebuild: touch the crate sources, \`cargo build -j2 --bin aikit\`, and re-run.`);
  }
  d.aikit = frozenAikit;
  launchedEnv.OI_AIKIT_BIN = frozenAikit;
  env.OI_AIKIT_BIN = frozenAikit;
  const routerPath = join(profileDir, "oi-owner-router.mjs");
  writeFileSync(routerPath, `#!/usr/bin/env node\nimport {spawnSync} from "node:child_process";\nconst a = process.argv.slice(2);\nif (a[0] === "aikit") { const c = spawnSync(${JSON.stringify(d.aikit)}, a.slice(1), {stdio: "inherit"}); process.exit(c.status ?? 1); }\nconst c = spawnSync(process.env.OI_REAL_BIN || ${JSON.stringify(oi ?? "oi")}, a, {stdio: "inherit"}); process.exit(c.status ?? 1);\n`);
  chmodSync(routerPath, 0o755);
  launchedEnv.OI_BIN = routerPath; env.OI_BIN = routerPath;
  const summary = {home, project, steps: []};
  const step = (name, detail) => { summary.steps.push({step: name, ...(detail !== undefined ? {detail} : {})}); log(`candidate: companion  ${name}${detail !== undefined ? "  " + (typeof detail === "string" ? detail : JSON.stringify(detail)).slice(0, 200) : ""}`); };
  const cleanups = [];

  // 1 — the Prime distribution, the coherent faculty configuration, the new launcher
  const distribution = join(d.epiPrime, "tools/epi-distribution.mjs");
  const facultyConfig = join(home, "faculty/faculty.json");
  const generated = JSON.parse(sh(process.execPath, [distribution, "faculty-config", "--instrument", d.instrument, "--source-root", d.qlRoot, "--evidence-root", join(home, "faculty-evidence"), "--out", facultyConfig]));
  const installed = JSON.parse(sh(process.execPath, [distribution, "install", "--research-bin", d.research, "--faculty-config", facultyConfig, "--root", join(home, "tools")]));
  const launcher = join(home, "tools/prime-epi/bin/actuation-epi-prime");
  mkdirSync(dirname(launcher), {recursive: true});
  const source = join(d.actuation, "target/debug/actuation-epi-prime");
  if (!existsSync(launcher) || sha(readFileSync(launcher)) !== sha(readFileSync(source))) { copyFileSync(source, launcher); chmodSync(launcher, 0o755); }
  const bodyRevision = execFileSync("git", ["-C", d.actuation, "rev-parse", "HEAD"], {encoding: "utf8"}).trim();
  // The QL engines are copied beside each other into the candidate home so a rebuild of the live QL checkout cannot change them under a turn. They are
  // builds of that checkout, not release material (the named G4 gap): their digests and the checkout's HEAD are recorded, not claimed as the pinned revision.
  const qlBin = join(home, "ql-bin");
  mkdirSync(qlBin, {recursive: true});
  const frozen = {};
  for (const name of ["ql", "ql-wiki-refraction"]) {
    const from = join(dirname(d.ql), name), to = join(qlBin, name);
    if (!existsSync(from)) throw new Error(`the companion needs ${from} (build it: cargo build -p ql-cli -p ql-wiki in ${d.qlRoot})`);
    if (!existsSync(to) || sha(readFileSync(to)) !== sha(readFileSync(from))) { copyFileSync(from, to); chmodSync(to, 0o755); }
    frozen[name] = sha(readFileSync(to)).slice(0, 16);
  }
  const qlHead = spawnSync("git", ["-C", d.qlRoot, "rev-parse", "--short", "HEAD"], {encoding: "utf8"}).stdout.trim();
  step("ql-engines", {...frozen, built_from_checkout_head: qlHead, release_material: "not yet (G4)"});
  step("distribution", {installed: installed.id, faculty_owner_revision: generated.revision, coherent: generated.coherence?.probed === true, launcher: launcher.replace(HOME, "~")});

  // 2 — the provider row the panel provisions by name: the Prime-QL body, new launcher, explicit extension, verified binding
  const configured = native("encounter-epi-prime-configure", "--provider-id", PROVIDER_ID, "--launcher", launcher, "--prime-bin", d.prime, "--ql-bin", join(qlBin, "ql"),
    "--ql-revision", generated.revision, "--body-revision", bodyRevision, "--skill-path", d.skill, "--extension", installed.extension, "--installation", installed.binding,
    "--research-bin", d.research, "--faculty-config", facultyConfig, "--ql-root", d.qlRoot, "--central-ctrl-bin", d.ctrl, "--central-root", ground, "--central-project", project);
  if (configured.json?.ok === false || configured.status !== 0) throw new Error(`could not configure the ${PROVIDER_ID} row: ${configured.raw}`);
  step("row", {provider: PROVIDER_ID, body: BODY_REF, standing: configured.json?.data?.standing ?? configured.json?.standing});

  // 3 — Redis: AIKit's own service in the candidate home, on a candidate port
  const redisDir = join(home, "services/redis-now");
  if (!existsSync(join(redisDir, "redis-service.json"))) {
    const p = aikit("now-context", "service", "provision", "--service-dir", redisDir, "--port", String(d.redisPort), "--maxmemory-mb", "128", "--redis-server", d.redisServer);
    if (p.json?.ok !== true) throw new Error(`could not provision the candidate Redis: ${p.raw}`);
  }
  let redisStarted = false;
  const status = aikit("now-context", "service", "status", "--service-dir", redisDir);
  if (status.json?.data?.state !== "running") {
    const s = aikit("now-context", "service", "start", "--service-dir", redisDir);
    if (s.json?.ok !== true || s.json?.data?.health?.profile_conforms !== true) throw new Error(`the candidate Redis did not start conforming: ${s.raw}`);
    redisStarted = true;
    cleanups.push(() => aikit("now-context", "service", "stop", "--service-dir", redisDir));
  }
  const redisConfig = join(redisDir, "redis-now.json");
  step("redis", {config: redisConfig.replace(HOME, "~"), port: JSON.parse(readFileSync(redisConfig, "utf8")).address, started_here: redisStarted});

  // 4 — Kev: the owner's running endpoint; this module does not start it
  const kevFile = join(home, "decision-provider.json");
  let kevAddress = "127.0.0.1:8019";
  if (existsSync(d.liveKev)) { copyFileSync(d.liveKev, kevFile); kevAddress = JSON.parse(readFileSync(kevFile, "utf8")).address ?? kevAddress; }
  else writeFileSync(kevFile, JSON.stringify({schema: "aikit.decision-provider/v1", mode: "endpoint", address: kevAddress, limits: {timeout_ms: 120000, max_attempts: 2, max_input_tokens_per_attempt: 16384, max_output_tokens_per_attempt: 8000, model: "kev-latest"}}, null, 2));
  let kev = "answering";
  try { const r = await fetch(`http://${kevAddress}/v1/models`, {signal: AbortSignal.timeout(3000)}); if (!r.ok) kev = `HTTP ${r.status}`; } catch (error) { kev = `not answering (${String(error).slice(0, 60)})`; }
  step("kev", {address: kevAddress, state: kev, ...(kev === "answering" ? {} : {start: KEV_START})});
  summary.kev = {address: kevAddress, state: kev, start: kev === "answering" ? undefined : KEV_START};

  // 5 — the authored preparation request: the pages the companion's reader stands on (the fixture), real pages of the installed World
  const resolved = JSON.parse(execFileSync(process.execPath, [join(repo, "site/essay-world.mjs"), "resolve", "--root", worldsRoot], {encoding: "utf8"}));
  if (resolved.state !== "available") throw new Error(`no installed World under ${worldsRoot} (${resolved.reason ?? resolved.state}); the companion's candidate items are its pages`);
  const edition = resolved.edition_dir;
  const spec = JSON.parse(readFileSync(join(cradle, "tests/fixtures/prime-kev-redis/candidates.json"), "utf8"));
  const receipt = JSON.parse(readFileSync(join(edition, "quartz-source.json"), "utf8"));
  const content = JSON.parse(readFileSync(join(edition, "static/contentIndex.json"), "utf8"));
  const shaOf = new Map(receipt.files.map(f => [f.path, f.sha256]));
  const items = spec.items.map(({role, path}) => {
    const page = content[path.replace(/\.md$/, "")];
    if (!page || !shaOf.get(path)) throw new Error(`${path} is not in the installed World`);
    return {source_ref: `central:source:project:Antykathera-Essay-Work:${spec.edition_path_prefix}${path}`, source_revision: shaOf.get(path), title: `${page.title} (${role})`, excerpt: String(page.content ?? "").replace(/\s+/g, " ").slice(0, spec.excerpt_chars), route: path.replace(/\.md$/, ""), agent_visibility: "payload", external_egress: "allowed"};
  });
  const projectContext = JSON.parse(execFileSync(d.aikit, ["--json", "session-space", "-C", projectDir, "project-context"], {encoding: "utf8", env}));
  // The preparation needs a NOW to anchor to, and Central must be able to read it as a source of the project. The real O-I project's own NOW clearing is not in
  // its participating maps (`central.file_map_not_found` degraded every turn that tried it), and allocating one would write into the owner's repository. So the
  // candidate keeps its OWN small anchor ground under the profile: the same project name, one NOW allocated by `central.now.allocate`, all of it inside the profile.
  // The reader's pages are inline candidate items (they do not come from this ground); the participant is still the one the real ground's mint discloses.
  const anchor = join(profileDir, "anchor-ground");
  const anchorCtrl = (action, input = {}) => { const r = JSON.parse(sh(d.ctrl, ["--root", anchor, "--json", "action", "run", action, JSON.stringify(input)])); if (!r.ok) throw new Error(`${action}: ${JSON.stringify(r.error ?? r)}`); return r.data; };
  const anchorFile = join(anchor, "candidate-anchor.json");
  let nowRef;
  if (existsSync(anchorFile)) nowRef = JSON.parse(readFileSync(anchorFile, "utf8")).now_ref;
  if (!nowRef || !(JSON.parse(sh(d.ctrl, ["--root", anchor, "--json", "action", "run", "central.now.list", JSON.stringify({project})])).data?.records ?? []).some(r => r.now_ref === nowRef && r.lifecycle === "active")) {
    mkdirSync(join(anchor, "Work", project), {recursive: true});
    if (!existsSync(join(anchor, "Control"))) anchorCtrl("central.init");
    if (!existsSync(join(anchor, "Work", project, "ProjectCentral"))) anchorCtrl("projectcentral.init", {project, project_id: project});
    const relations = JSON.parse(readFileSync(join(ground, "Control/relations/source-relations.json"), "utf8"));
    mkdirSync(join(anchor, "Control/relations"), {recursive: true}); mkdirSync(join(anchor, "Control/user"), {recursive: true});
    writeFileSync(join(anchor, "Control/relations/source-relations.json"), JSON.stringify({schema: "central.control.ground-relations/v1", project_id: "control:root", relations: relations.relations.filter(r => ["Control/user/placement.json", "Control/user/civil-time-policy.json"].includes(r.path))}, null, 1));
    const placement = JSON.parse(readFileSync(join(ground, "Control/user/placement.json"), "utf8")); placement.writable = [{path: `Work/${project}`, class: "repository"}];
    writeFileSync(join(anchor, "Control/user/placement.json"), JSON.stringify(placement, null, 1));
    writeFileSync(join(anchor, "Control/user/civil-time-policy.json"), readFileSync(join(ground, "Control/user/civil-time-policy.json")));
    const policy = anchorCtrl("central.work.policy", {project});
    const allocated = anchorCtrl("central.now.allocate", {project, task_ref: "candidate-companion", purpose: "anchor for the candidate companion's prepared context (candidate profile only)", expected_policy_revision: policy.revision});
    nowRef = allocated.now_ref;
    writeFileSync(anchorFile, JSON.stringify({now_ref: nowRef, note: "the candidate profile's own NOW anchor; not part of the owner's ground"}, null, 2));
  }
  const nowRecord = {now_ref: nowRef};
  // The participant is the one the agency mint discloses for this project (`agent/<project>-chat`); a mismatch would degrade every turn.
  const participant = `agent/${String(projectContext.project ?? project).toLowerCase().replace(/[^a-z0-9._-]+/g, "-")}-chat`;
  const request = {
    schema: "aikit.now-preparation-request/v1", redis: JSON.parse(readFileSync(redisConfig, "utf8")),
    project_ref: projectContext.project ?? project, now_ref: nowRecord.now_ref, participant_ref: participant, agent_session: "agent-session/rewritten-at-entry",
    concern: spec.concern, disclosure_revision: `world:${resolved.revision}`, practice_refs: [],
    central: {root: anchor, ctrl_bin: d.ctrl, project},
    candidate_items: items, expected_version: 0, external_provider: true,
    selection: {mode: "provider", provider_file: kevFile, state: {undertaking: spec.selection.state_undertaking, primary: items[0].source_ref, tangent: items[1].source_ref, selected: items[2].source_ref}, relevance_threshold: spec.selection.relevance_threshold},
  };
  const requestFile = join(home, "now-prepare.json");
  writeFileSync(requestFile, JSON.stringify(request, null, 2));
  writeFileSync(join(home, "now-prepare.egress-allowance.json"), JSON.stringify({schema: "oi.egress-allowance-record/v1", authored_for: "the candidate companion's NOW preparation request", what: "external_egress allowed and agent_visibility payload on the listed items only", why: "pages of the published Return-of-Zero edition (installed World revision " + resolved.revision + "); the default law is untouched and the request names no Central-read source", items: items.map(i => ({source_ref: i.source_ref, source_revision: i.source_revision})), not_covered: "any private, working, quilt, reference-note or unpublished note"}, null, 2));
  const nowCfg = native("encounter-now-context-configure", "--provider-id", PROVIDER_ID, "--redis-config", redisConfig, "--prepare-request", requestFile);
  if (nowCfg.json?.ok === false || nowCfg.status !== 0) throw new Error(`could not elect the NOW context on the ${PROVIDER_ID} row: ${nowCfg.raw}`);
  step("now-context", {participant, now_ref: nowRecord.now_ref.slice(-16), items: items.length, selection: "provider (the live Kev)", world: resolved.revision});
  summary.participant = participant;

  // 6 — the resident owner for this home (the kernel's provision opens its conversations through it)
  let owner = null;
  if (start) {
    const o = native("encounter-start");
    if (o.json?.ok === false || o.status !== 0) throw new Error(`could not start the candidate encounter owner: ${o.raw}`);
    owner = o.json?.data ?? o.json;
    cleanups.push(() => { try { if (owner?.pid) process.kill(-owner.pid, "SIGTERM"); } catch { /* gone */ } });
    step("owner", {pid: owner?.pid});
  }

  const credentials = {ZAI_API_KEY: baseEnv.ZAI_API_KEY ? "present in the launching environment" : "ABSENT: a real turn through glm-5.3-flash will not authenticate"};
  summary.credentials = credentials;
  step("credentials", credentials);
  summary.request = requestFile; summary.facultyConfig = facultyConfig; summary.redisConfig = redisConfig;
  return {env: launchedEnv, summary, owner, stop: () => { for (const c of cleanups.reverse()) { try { c(); } catch { /* best effort */ } } }};
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2);
  const arg = (n, f) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : f; };
  const profile = arg("profile", "central-field");
  const ground = resolve(arg("ground", process.env.OI_CENTRAL_ROOT ?? join(HOME, "Central")));
  const worldsRoot = resolve(arg("worlds-root", process.env.OI_WORLDS_ROOT ?? join(HOME, ".oi-candidates/worlds")));
  try {
    const run = await provisionCompanion({profileDir: join(HOME, ".oi-candidates", profile), ground, worldsRoot, oi: arg("oi"), project: arg("companion-project", "O-I"), start: argv.includes("--start")});
    console.log(JSON.stringify(run.summary, null, 2));
    if (!argv.includes("--start")) run.stop();
  } catch (error) { console.error(`candidate-companion: ${error.message}`); process.exit(1); }
}
