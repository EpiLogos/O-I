#!/usr/bin/env node
// Everything a CLEAN installation can do without a model credential, proved under a sandbox HOME with Factory and Workcell
// withheld and tripwired (walk/lib/absence-tripwire.mjs). Receipt: walk/artifacts/clean-services.json.
//
//   node scripts/clean-services.mjs [--edition DIR] [--keep]
//
//   1  AIKit's Redis NOW service on a sandbox port: provision / start / status, a raw PING, the profile conforms
//   2  AIKit's Kev service on a sandbox port from the pinned upstream and weights, then a REAL `aikit decide invoke`
//   3  a real `aikit now-context prepare` electing that sandbox Kev (selection.mode = provider), and the Redis readback of the
//      prepared view and its digest
//   4  a direct QL operation through the owner instrument with a faculty configuration GENERATED from the instrument
//   5  the tripwire log is empty
//   6  both services stopped; nothing of ours still running; the data left (or removed) as the receipt says
//
// No model credential exists in this context: every credential-shaped environment variable is removed before anything starts and the
// sandbox HOME holds no login. Kev inference is local CPU/GPU only.
//
// Network: AIKit's `decide service provision` is written to reach the network (git clone of the pinned upstream, `uv sync`, Hugging Face
// snapshot) and sets HF_HUB_OFFLINE=0 itself. Here every one of those is pointed at what is already on this machine, so nothing is fetched:
//   git clone      the sandbox HOME's gitconfig rewrites the upstream https URL to the existing local checkout (the pin is verified by AIKit)
//   uv sync        UV_OFFLINE=1 against the existing uv cache and interpreters (UV_CACHE_DIR / UV_PYTHON_INSTALL_DIR), no downloads
//   HF snapshot    HF_ENDPOINT names a refused loopback address, so huggingface_hub cannot reach a hub and falls back to the pinned snapshot in
//                  the shared cache (HF_HOME, read only: the receipt compares the cache's file listing before and after)
// What is shared with the everyday machine is data/tool caches only, never a credential, row or election.
//
// Parameters (environment): OI_AIKIT_BIN (REQUIRED, the aikit build under test), EPI_LOCAL_KEV_CHECKOUT (default ~/.workcell/decision-models/kev-0.8b/kev),
// EPI_REDIS_SERVER (default /opt/homebrew/bin/redis-server), EPI_PRIME_DIR (default ~/Central/Work/Epi-Prime), EPI_OWNER_INSTRUMENT, EPI_QL_ROOT, OI_CENTRAL_CTRL_BIN.
import {execFileSync, spawnSync} from "node:child_process";
import {createServer, connect} from "node:net";
import {existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, statSync, writeFileSync} from "node:fs";
import {homedir, tmpdir} from "node:os";
import {dirname, join, resolve} from "node:path";
import {fileURLToPath} from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const cradle = resolve(here, "..");
const repo = resolve(cradle, "../..");
const artifact = join(cradle, "walk/artifacts/clean-services.json");
const argv = process.argv.slice(2);
const flag = n => argv.includes(`--${n}`);
const arg = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : d; };
const realHome = homedir();
const env0 = {...process.env};

const AIKIT = env0.OI_AIKIT_BIN;
if (!AIKIT || !existsSync(AIKIT)) { console.error("OI_AIKIT_BIN is required: the aikit build under test"); process.exit(2); }
const LOCAL_KEV = env0.EPI_LOCAL_KEV_CHECKOUT ?? join(realHome, ".workcell/decision-models/kev-0.8b/kev");
const REDIS_SERVER = env0.EPI_REDIS_SERVER ?? "/opt/homebrew/bin/redis-server";
const EPI_PRIME_DIR = env0.EPI_PRIME_DIR ?? join(realHome, "Central/Work/Epi-Prime");   // EpiLogos/Epi-Prime, the Prime distribution
const INSTRUMENT = env0.EPI_OWNER_INSTRUMENT ?? join(realHome, "Central/Work/Actuation/experiments/ql-runtime/native-owner-instrument/target/debug/actuation-ql-owner-instrument");
const QL_ROOT = env0.EPI_QL_ROOT ?? join(realHome, "Central/Work/Quaternal-Logic");
const CTRL = env0.OI_CENTRAL_CTRL_BIN ?? join(realHome, ".local/bin/ctrl");
const RESEARCH = env0.EPI_ACTUATION_RESEARCH_BINARY ?? join(realHome, ".local/bin/actuation-research");
const HF_CACHE = env0.HF_HOME ?? join(realHome, ".cache/huggingface");
const UV_CACHE = env0.UV_CACHE_DIR ?? join(realHome, ".cache/uv");
const UV_PYTHONS = env0.UV_PYTHON_INSTALL_DIR ?? join(realHome, ".local/share/uv/python");
for (const [name, path] of [["local Kev checkout", LOCAL_KEV], ["redis-server", REDIS_SERVER], ["owner instrument", INSTRUMENT], ["ctrl", CTRL], ["actuation-research", RESEARCH], ["HF cache", HF_CACHE], ["uv cache", UV_CACHE]]) {
  if (!existsSync(path)) { console.error(`missing ${name}: ${path}`); process.exit(2); }
}

const record = {schema: "oi.clean-services/v1", spec_ref: "docs/cradle/CENTRAL-FIELD-NATIVE-AUDIT-A.md (what a clean installation can do without a model credential; O:I #598)", grade: "A", at: new Date().toISOString(), steps: [], checks: []};
const say = (step, detail) => { record.steps.push({step, ...(detail !== undefined ? {detail} : {})}); console.log(`[${step}]`, detail === undefined ? "" : JSON.stringify(detail).slice(0, 300)); };
const check = (label, ok, detail) => { record.checks.push({label, ok: !!ok, ...(detail !== undefined ? {detail} : {})}); console.log(`${ok ? "PASS" : "FAIL"} — ${label}${detail !== undefined ? " · " + JSON.stringify(detail).slice(0, 220) : ""}`); };
const freePort = () => new Promise((res, rej) => { const s = createServer(); s.listen(0, "127.0.0.1", () => { const {port} = s.address(); s.close(() => res(port)); }); s.on("error", rej); });
const ping = (port) => new Promise(res => { const c = connect(port, "127.0.0.1"); let out = ""; c.setTimeout(3000, () => { c.destroy(); res(out || null); }); c.on("data", d => { out += d; c.end(); }); c.on("error", () => res(null)); c.on("connect", () => c.write("PING\r\n")); c.on("close", () => res(out || null)); });
const listing = dir => { let files = 0, bytes = 0; const walk = d => { for (const e of readdirSync(d, {withFileTypes: true})) { const p = join(d, e.name); if (e.isDirectory()) walk(p); else { files++; try { bytes += statSync(p).size; } catch { /* dangling link */ } } } }; walk(dir); return {files, bytes}; };

// ---- the clean context ------------------------------------------------------------------------------------------------
const {installTripwireEnvironment} = await import(new URL("../walk/lib/absence-tripwire.mjs", import.meta.url));
const base = realpathSync(mkdtempSync(join(tmpdir(), "oi-clean-services-")));
const sandboxHome = join(base, "home"), run = join(base, "run");
mkdirSync(sandboxHome, {recursive: true}); mkdirSync(run, {recursive: true});
// the sandbox HOME's own gitconfig: the pinned upstream's https URL is served from the local checkout (read through git, never written)
writeFileSync(join(sandboxHome, ".gitconfig"), `[url "file://${LOCAL_KEV}"]\n\tinsteadOf = https://github.com/jaredpalmer/kev.git\n[safe]\n\tdirectory = *\n`);
const credentialShaped = k => /KEY|TOKEN|SECRET|CREDENTIAL|PASSWORD|AUTH/i.test(k);
const keep = /^(PATH|HOME|TMPDIR|LANG|LC_[A-Z]+|USER|LOGNAME|SHELL|TERM|TZ|__CF_USER_TEXT_ENCODING|OI_.*|AIKIT_.*|NODE_.*|CI)$/;
const scrubbed = [];
const process_env = process.env;
const tripwire = installTripwireEnvironment({home: sandboxHome});
for (const k of Object.keys(process_env)) if (!keep.test(k) || (credentialShaped(k) && !/^(OI_AIKIT_BIN|OI_BIN|OI_REAL_BIN|OI_WORKCELL_BIN|OI_FACTORY_BIN|OI_TRIPWIRE_LOG|OI_HOME|OI_WALK_.*|OI_CANDIDATE_BIN)$/.test(k))) { scrubbed.push(k); delete process_env[k]; }
process_env.AIKIT_HOME = join(sandboxHome, ".aikit");
const sandboxPort = {redis: await freePort(), kev: await freePort()};
Object.assign(process_env, {
  HF_HOME: HF_CACHE, HF_ENDPOINT: "http://127.0.0.1:9", UV_OFFLINE: "1", UV_CACHE_DIR: UV_CACHE, UV_PYTHON_INSTALL_DIR: UV_PYTHONS, UV_PYTHON_DOWNLOADS: "never",
});
record.context = {
  sandbox_home: sandboxHome, aikit_home: process_env.AIKIT_HOME, withheld_from_path: tripwire.withheld, path: process_env.PATH,
  credential_env_removed_names: scrubbed.sort(), credential_shaped_remaining: Object.keys(process_env).filter(credentialShaped),
  home_logins_present: [".prime/agent/auth.json", ".pi/agent/auth.json"].filter(p => existsSync(join(sandboxHome, p))),
  ports: sandboxPort,
};
check("the clean context holds no model credential (no credential-shaped variable, no login under the sandbox HOME)", record.context.credential_shaped_remaining.length === 0 && record.context.home_logins_present.length === 0, record.context.credential_shaped_remaining);
const hfBefore = listing(join(HF_CACHE, "hub"));
const sh = (cmd, args, opts = {}) => execFileSync(cmd, args, {encoding: "utf8", env: process_env, maxBuffer: 64 * 1024 * 1024, ...opts});
const aikit = (...a) => { const r = spawnSync(AIKIT, ["--json", ...a], {encoding: "utf8", env: process_env, maxBuffer: 64 * 1024 * 1024}); let j = null; try { j = JSON.parse(r.stdout); } catch { /* raw below */ } return {exit: r.status, json: j, raw: j ? undefined : (r.stdout + r.stderr).slice(0, 3000), stderr: r.stderr.slice(0, 1500)}; };
const redisDir = join(sandboxHome, ".aikit/services/redis-now"), kevDir = join(sandboxHome, ".aikit/services/decision/kev-0.8b");
const cleanup = [];
let stopped = null;

try {
  // ---- 1 Redis ------------------------------------------------------------------------------------------------------
  const rp = aikit("now-context", "service", "provision", "--service-dir", redisDir, "--port", String(sandboxPort.redis), "--maxmemory-mb", "64", "--redis-server", REDIS_SERVER);
  check("Redis provisioned by AIKit on a sandbox port", rp.json?.ok === true, {port: sandboxPort.redis, error: rp.json?.error ?? rp.raw});
  const rs = aikit("now-context", "service", "start", "--service-dir", redisDir);
  const health = rs.json?.data?.health;
  const pong = await ping(sandboxPort.redis);
  check("Redis started: PING answers +PONG and the live profile conforms", rs.json?.ok === true && /^\+PONG/.test(pong ?? "") && health?.profile_conforms === true, {ping: pong?.trim(), profile_conforms: health?.profile_conforms, version: health?.redis_version ?? health?.version});
  const rst = aikit("now-context", "service", "status", "--service-dir", redisDir);
  record.redis = {provision: rp.json?.data, start: rs.json?.data, status: rst.json?.data};
  const redisConfig = join(redisDir, "redis-now.json");

  // ---- 2 Kev --------------------------------------------------------------------------------------------------------
  const kp = aikit("decide", "service", "provision", "--service-dir", kevDir, "--port", String(sandboxPort.kev), "--step-timeout-secs", "900");
  check("Kev provisioned by AIKit from the pinned upstream and pinned weights, with nothing fetched", kp.json?.ok === true, {port: sandboxPort.kev, error: kp.json?.error ?? kp.raw, stderr: kp.stderr.slice(0, 300)});
  record.kev = {provision: kp.json?.data};
  if (kp.json?.ok !== true) throw new Error(`Kev provision failed: ${JSON.stringify(kp.json?.error ?? kp.raw)}`);
  const ks = aikit("decide", "service", "start", "--service-dir", kevDir, "--ready-timeout-secs", "600");
  record.kev.start = ks.json?.data ?? ks.json?.error ?? ks.raw;
  check("Kev started: the pinned model card answers and one warm decision completed", ks.json?.ok === true, {error: ks.json?.error ?? ks.raw});
  if (ks.json?.ok !== true) throw new Error(`Kev start failed: ${JSON.stringify(ks.json?.error ?? ks.raw)}`);
  const kst = aikit("decide", "service", "status", "--service-dir", kevDir);
  record.kev.status = kst.json?.data;
  const providerFile = join(kevDir, "decision-provider.json");
  const provider = JSON.parse(readFileSync(providerFile, "utf8"));
  const invokeRequest = join(run, "decide-request.json");
  writeFileSync(invokeRequest, JSON.stringify({
    model: provider.limits?.model ?? "kev-latest", state: {undertaking: "decide which passage helps a reader who is at the crossed zero"},
    questions: {
      "candidate/000": {type: "noul", instructions: {question: "Does this candidate materially contribute to the undertaking?", title: "The Crossed Zero", excerpt: "The stroke is present and fused into the zero it crosses: the mediating relation is occluded, not absent."}},
      "candidate/001": {type: "noul", instructions: {question: "Does this candidate materially contribute to the undertaking?", title: "Pasta recipes", excerpt: "Salt the water, boil for nine minutes and drain."}},
    },
  }));
  const inv = aikit("decide", "invoke", "--provider-file", providerFile, "--request-file", invokeRequest);
  const body = inv.json?.data;
  record.decide_invoke = {exit: inv.exit, receipt: body ?? inv.json?.error ?? inv.raw};
  check("a real `aikit decide invoke` against the sandbox Kev completed with a decision body", inv.json?.ok === true && body?.outcome === "completed" && !!body?.answer?.answers, {outcome: body?.outcome, standing: body?.standing, endpoint: body?.endpoint, answers: body?.answer?.answers, invocation_ref: body?.invocation_ref});

  // ---- 3 a real preparation electing the sandbox Kev ------------------------------------------------------------------
  // a Central ground, as the scenario does (the preparation names a NOW)
  const ground = join(base, "ground"); mkdirSync(join(ground, "Work", "Field"), {recursive: true});
  const ctrl = (action, input = {}) => { const r = JSON.parse(sh(CTRL, ["--root", ground, "--json", "action", "run", action, JSON.stringify(input)])); if (!r.ok) throw new Error(`${action}: ${JSON.stringify(r.error ?? r)}`); return r.data; };
  const projectId = `clean-field-${Math.random().toString(36).slice(2, 7)}`;
  ctrl("central.init"); ctrl("projectcentral.init", {project: "Field", project_id: projectId});
  Object.assign(process_env, {OI_CENTRAL_ROOT: ground, OI_CENTRAL_PROJECT_QUERY: "Field"});
  const rel = JSON.parse(readFileSync(join(realHome, "Central/Control/relations/source-relations.json"), "utf8"));
  mkdirSync(join(ground, "Control/relations"), {recursive: true}); mkdirSync(join(ground, "Control/user"), {recursive: true});
  writeFileSync(join(ground, "Control/relations/source-relations.json"), JSON.stringify({schema: "central.control.ground-relations/v1", project_id: "control:root", relations: rel.relations.filter(r => ["Control/user/placement.json", "Control/user/civil-time-policy.json"].includes(r.path))}, null, 1));
  const placement = JSON.parse(readFileSync(join(realHome, "Central/Control/user/placement.json"), "utf8")); placement.writable = [{path: "Work/Field", class: "repository"}];
  writeFileSync(join(ground, "Control/user/placement.json"), JSON.stringify(placement, null, 1));
  writeFileSync(join(ground, "Control/user/civil-time-policy.json"), readFileSync(join(realHome, "Central/Control/user/civil-time-policy.json")));
  const policy = ctrl("central.work.policy", {project: "Field"});
  const now = ctrl("central.now.allocate", {project: "Field", task_ref: "clean-services", purpose: "the clean-context services proof", expected_policy_revision: policy.revision});
  const projectBind = aikit("-C", join(ground, "Work", "Field"), "project", "bind", "clean-services", "--directory", join(ground, "Work", "Field"), "--no-default-skill-sets");
  const projectContext = JSON.parse(execFileSync(AIKIT, ["--json", "session-space", "-C", join(ground, "Work", "Field"), "project-context"], {encoding: "utf8", env: process_env}));
  // candidates: the fixture's pages, read from a built edition
  let editionDir = arg("edition");
  if (!editionDir) { const r = JSON.parse(execFileSync(process.execPath, [join(repo, "site/essay-world.mjs"), "resolve"], {encoding: "utf8", env: {...process_env, OI_WORLDS_ROOT: env0.OI_WORLDS_ROOT ?? join(realHome, "Library/Application Support/OI/worlds")}})); if (r.state !== "available") throw new Error(`no edition: the installed World is ${r.state}; pass --edition DIR`); editionDir = r.edition_dir; }
  const spec = JSON.parse(readFileSync(join(cradle, "tests/fixtures/prime-kev-redis/candidates.json"), "utf8"));
  const receipt = JSON.parse(readFileSync(join(editionDir, "quartz-source.json"), "utf8"));
  const content = JSON.parse(readFileSync(join(editionDir, "static/contentIndex.json"), "utf8"));
  const shaOf = new Map(receipt.files.map(f => [f.path, f.sha256]));
  const items = spec.items.map(({role, path}) => { const page = content[path.replace(/\.md$/, "")]; if (!page || !shaOf.get(path)) throw new Error(`${path} is not in the edition`); return {role, path, ref: `central:source:project:Antykathera-Essay-Work:${spec.edition_path_prefix}${path}`, revision: shaOf.get(path), title: `${page.title} (${role})`, excerpt: String(page.content ?? "").replace(/\s+/g, " ").slice(0, spec.excerpt_chars)}; });
  const participant = `agent/${projectId}-chat`;
  const request = {
    schema: "aikit.now-preparation-request/v1", redis: JSON.parse(readFileSync(redisConfig, "utf8")),
    project_ref: projectContext.project ?? projectContext.data?.project, now_ref: now.now_ref, participant_ref: participant, agent_session: "agent-session/clean-services",
    concern: spec.concern, disclosure_revision: `clean-services:${receipt.vault_commit?.slice(0, 12) ?? "edition"}`, practice_refs: [],
    central: {root: ground, ctrl_bin: CTRL, project: "Field"},
    candidate_items: items.map(i => ({source_ref: i.ref, source_revision: i.revision, title: i.title, excerpt: i.excerpt, route: i.path.replace(/\.md$/, ""), agent_visibility: "payload", external_egress: "allowed"})),
    expected_version: 0, external_provider: false,
    selection: {mode: "provider", provider_file: providerFile, state: {undertaking: spec.selection.state_undertaking}, relevance_threshold: spec.selection.relevance_threshold},
  };
  const requestFile = join(run, "now-prepare.json"); writeFileSync(requestFile, JSON.stringify(request, null, 2));
  const prep = aikit("now-context", "prepare", "--request-file", requestFile);
  const sel = prep.json?.data?.selection ?? {};
  record.prepare = {exit: prep.exit, published_version: prep.json?.data?.publishedVersion, prepared_digest: prep.json?.data?.preparedDigest, basis_digest: prep.json?.data?.basisDigest, selection: {mode: sel.mode, selected: sel.selectedCandidateRefs, decision_provider: sel.decisionProvider, invocation: sel.decisionInvocation && {ref: sel.decisionInvocation.invocation_ref, outcome: sel.decisionInvocation.outcome, standing: sel.decisionInvocation.standing, endpoint: sel.decisionInvocation.endpoint, answers: sel.decisionInvocation.answer?.answers}}, error: prep.json?.error ?? (prep.json ? undefined : prep.raw)};
  check("a real `aikit now-context prepare` elected the sandbox Kev (mode provider) and the decision completed with local-protocol standing", prep.json?.ok === true && sel.mode === "provider" && sel.decisionInvocation?.outcome === "completed" && sel.decisionInvocation?.standing === "local-protocol", {selected: sel.selectedCandidateRefs?.length, error: record.prepare.error});
  const insp = aikit("now-context", "inspect", "--config-file", redisConfig, "--participant-ref", participant);
  const view = insp.json?.data;
  record.redis_inspect = {exit: insp.exit, raw: insp.json ?? insp.raw};
  check("the Redis readback holds the prepared view at the prepared digest, naming the decision invocation and provider identity", insp.json?.ok === true && view?.prepared?.basis_digest === prep.json?.data?.basisDigest && view?.currentVersion === prep.json?.data?.publishedVersion && view?.prepared?.jev_invocation_ref === sel.decisionInvocation?.invocation_ref && view?.prepared?.basis?.decision_provider === sel.decisionProvider, {version: view?.currentVersion, items: view?.prepared?.items?.length});

  // ---- 4 a direct QL operation through the instrument, with a configuration generated from it --------------------------------
  const facultyConfig = join(run, "faculty.generated.json"), evidence = join(run, "faculty-evidence"); mkdirSync(evidence, {recursive: true});
  const generated = JSON.parse(sh(process.execPath, [join(EPI_PRIME_DIR, "tools/epi-distribution.mjs"), "faculty-config", "--instrument", INSTRUMENT, "--source-root", QL_ROOT, "--evidence-root", evidence, "--out", facultyConfig]));
  const invoked = spawnSync(RESEARCH, [], {input: JSON.stringify({operation: "faculty.invoke", configuration: facultyConfig, request: {operation: "mef-lenses"}, trace_ref: "clean-services/qlop-1", declared_locus_ref: "clean-services"}), encoding: "utf8", env: process_env, maxBuffer: 64 * 1024 * 1024});
  let result = null; try { result = JSON.parse(invoked.stdout); } catch { /* raw below */ }
  const receiptFiles = existsSync(evidence) ? readdirSync(evidence).filter(f => f.endsWith(".json")) : [];
  const stored = receiptFiles.length ? JSON.parse(readFileSync(join(evidence, receiptFiles[0]), "utf8")) : null;
  record.ql_operation = {faculty_config: {revision: generated.revision, coherence: generated.coherence}, exit: invoked.status, schema: result?.schema, success: result?.success, lenses: result?.result?.lenses?.length, lens_codes: result?.result?.lenses?.map(l => l.code), receipt: result?.receipt, stored_receipt_files: receiptFiles.length, stored_receipt: stored, raw_error: result ? undefined : (invoked.stdout + invoked.stderr).slice(0, 800)};
  check("a direct QL operation (mef-lenses) through the owner instrument succeeded with a faculty configuration generated from that instrument", invoked.status === 0 && result?.success === true && (result?.result?.lenses?.length ?? 0) > 0 && generated.coherence?.probed === true, {revision: generated.revision, lenses: result?.result?.lenses?.length});
  check("its native faculty receipt was filed in the evidence World and names the instrument's revision", receiptFiles.length === 1 && (stored?.ql_mef_revision ?? result?.receipt?.ql_mef_revision) === generated.revision && (stored?.success ?? result?.receipt?.success) === true, {receipt_files: receiptFiles.length, revision: stored?.ql_mef_revision});

  // revoke this run's prepared view (the participant is ours)
  record.redis_view_revoked = aikit("now-context", "revoke", "--config-file", redisConfig, "--participant-ref", participant, "--disclosure-revision", request.disclosure_revision).json?.ok === true;
} catch (error) {
  record.error = String(error?.stack ?? error).split("\n").slice(0, 8).join(" | ");
  check("the proof ran to its end", false, record.error.slice(0, 300));
} finally {
  // ---- 5 / 6 ------------------------------------------------------------------------------------------------------------
  const kstop = existsSync(join(kevDir, "service.json")) ? aikit("decide", "service", "stop", "--service-dir", kevDir) : null;
  const rstop = existsSync(join(redisDir, "redis-service.json")) ? aikit("now-context", "service", "stop", "--service-dir", redisDir) : null;
  await new Promise(r => setTimeout(r, 1500));
  const remaining = spawnSync("ps", ["-axo", "pid,command"], {encoding: "utf8"}).stdout.split("\n").filter(l => l.includes(base) || l.includes(`127.0.0.1:${sandboxPort.redis}`) || l.includes(`--port ${sandboxPort.kev}`) || l.includes(`${sandboxPort.kev}`) && /kev\.serve/.test(l)).map(l => l.trim().slice(0, 140));
  const pongAfter = await ping(sandboxPort.redis);
  const kevAfter = await fetch(`http://127.0.0.1:${sandboxPort.kev}/v1/models`, {signal: AbortSignal.timeout(1500)}).then(() => "answers").catch(() => "closed");
  stopped = {kev_stop: kstop?.json?.data ?? kstop?.raw, redis_stop: rstop?.json?.data ?? rstop?.raw, processes_of_ours_remaining: remaining, redis_ping_after: pongAfter, kev_port_after: kevAfter};
  record.stopped = stopped;
  check("both services stopped and nothing of ours is still running", remaining.length === 0 && pongAfter === null && kevAfter === "closed", {remaining, redis_ping_after: pongAfter, kev_port_after: kevAfter});
  const trip = tripwire.entries();
  record.tripwire = {log: tripwire.log, entries: trip, count: trip.length, withheld: tripwire.withheld};
  check("the tripwire log is empty: no Factory or Workcell dispatch was attempted", trip.length === 0, trip.slice(0, 4));
  const hfAfter = listing(join(HF_CACHE, "hub"));
  check("the shared Hugging Face cache was read, not written (file count and bytes unchanged)", hfAfter.files === hfBefore.files && hfAfter.bytes === hfBefore.bytes, {before: hfBefore, after: hfAfter});
  const sizeOf = d => { try { return spawnSync("du", ["-sk", d], {encoding: "utf8"}).stdout.split("\t")[0] * 1024; } catch { return null; } };
  record.data = {policy: "service data is the sandbox's: removed with the sandbox unless --keep; `stop` itself keeps data (Redis AOF, Kev checkout and environment, manifests, logs)", sandbox: base, bytes_before_removal: sizeOf(base), kept: flag("keep")};
  record.ok = record.checks.every(c => c.ok);
  mkdirSync(dirname(artifact), {recursive: true});
  writeFileSync(record.ok ? artifact : artifact.replace(/\.json$/, ".failure.json"), JSON.stringify(record, null, 2) + "\n");
  if (!flag("keep")) rmSync(base, {recursive: true, force: true});
  console.log(`\n${record.checks.filter(c => c.ok).length}/${record.checks.length} checks passed; receipt: ${record.ok ? artifact : artifact.replace(/\.json$/, ".failure.json")}`);
  process.exit(record.ok ? 0 : 1);
}
