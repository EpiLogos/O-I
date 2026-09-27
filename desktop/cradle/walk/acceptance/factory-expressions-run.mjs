#!/usr/bin/env node
// factory-expressions-run: the real-agent portion of the Factory Expressions
// acceptance (docs/cradle/handovers/factory-expressions-2026-09-26/
// EXPRESSION-DEVELOPMENT-SPEC.md §9 items 3, 4, 7, 8; contract
// docs/contracts/EXPRESSION-ACT-MATERIAL-V1.md §5).
//
// It runs ACTUAL work through the installed products in a Central ground —
// Factory, AIKit, Central (ctrl), Actuation and Pi on GLM — so that one Factory
// Run carries native telemetry the desktop's Live view maps:
//
//   Factory   workflow commission (a two-voice successor of QL-MEF's
//             expression-development workflow: Anima → Aletheia melody),
//             attempt start-serial, attempt prepare (Central policy + NOW
//             allocation), attempt owner-action send/delivery into AIKit,
//             record-verification, return-artifact (readable Return).
//   AIKit     one SessionSpace in Work/<project>, two agent sessions with
//             native Agency bindings actualised by Actuation from the owner's
//             own O-I agency requests, a pi-rpc provider (pi --mode rpc, whose
//             own settings select zai/glm-5.3-flash), resident owner, open.
//   Agents    Anima reads a real O-I file, loads a Skill (pi `read` of its
//             SKILL.md = the skill gesture) and — from its own bash tool —
//             addresses Aletheia with an AIKit encounter `send` (sender
//             agent/anima → `agent-message` in Aletheia's journal). Aletheia
//             reviews under its own Factory attempt, loads its Skill, answers
//             Anima the same way, and its review becomes the Factory Return.
//
// Every mutating command is printed before it runs. --dry-run prints them and
// runs only reads (workflow check, project locate/inspect, file reads).
//
// Usage:
//   node factory-expressions-run.mjs --ground /Users/admin/Central --evidence <file> [--dry-run]
//   node factory-expressions-run.mjs --ground <new-dir> --disposable --evidence <file>
//
// Options:
//   --ground <root>      Central ground (Control/ + Work/). Required.
//   --evidence <file>    JSON evidence record path. Required. Its directory also
//                        receives the generated workflow source, commission
//                        request and derived agency sources (kept: the Agency
//                        source is re-read on every addressed send).
//   --dry-run            Print mutating commands; run only reads.
//   --disposable         Create <root> as a fresh disposable ground (central.init,
//                        adopted placement policy, copies of the needed agent,
//                        Position, agency, source and Skill records from
//                        --seed-from) with its own AIKIT_HOME, and stop the
//                        resident owner at the end.
//   --seed-from <root>   Ground the disposable copies are read from (default
//                        /Users/admin/Central). Read only.
//   --project <name>     Project (default O-I).
//   --tag <slug>         Identity suffix for sessions/attempts (default: time).
//   --workflow <file>    Commission this workflow source instead of generating
//                        the two-voice successor (it must carry the same unit
//                        keys anima-conduct and aletheia-disclose-return).
//   --provider <id>      Use an already configured AIKit provider id instead of
//                        configuring `factory-expressions-pi`.
//   --turn-timeout <s>   Per-turn wait (default 300).
import {spawnSync} from "node:child_process";
import {copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, writeFileSync} from "node:fs";
import {homedir} from "node:os";
import {basename, dirname, join, resolve} from "node:path";
import {blake3} from "hash-wasm";

// ---------------------------------------------------------------------------
// Arguments and binaries

const argv = process.argv.slice(2);
const flag = name => argv.includes(`--${name}`);
const option = name => { const at = argv.indexOf(`--${name}`); return at >= 0 ? argv[at + 1] : undefined; };
if (flag("help") || !option("ground") || !option("evidence")) {
  console.error("usage: factory-expressions-run.mjs --ground <root> --evidence <file> [--dry-run] [--disposable] [--seed-from <root>] [--project O-I] [--tag <slug>] [--workflow <file>] [--provider <id>]");
  process.exit(2);
}
const DRY = flag("dry-run");
const DISPOSABLE = flag("disposable");
const PROJECT = option("project") ?? "O-I";
const SEED = option("seed-from") ?? "/Users/admin/Central";
const TAG = (option("tag") ?? new Date().toISOString().replace(/[-:]/g, "").replace(/\..*$/, "").replace("T", "-")).toLowerCase();
const TURN_TIMEOUT_MS = Number(option("turn-timeout") ?? 300) * 1000;
const evidencePath = resolve(option("evidence"));
const workDir = join(dirname(evidencePath), `factory-expressions-${TAG}`);

const OI_BIN = join(homedir(), "Library/Application Support/OI/bin");
function binary(name, envName) {
  if (process.env[envName]) return process.env[envName];
  for (const candidate of [join(homedir(), ".local/bin", name), join(OI_BIN, name)]) if (existsSync(candidate)) return candidate;
  const found = spawnSync("/usr/bin/which", [name], {encoding: "utf8"});
  if (found.status === 0) return found.stdout.trim();
  throw new Error(`${name} is not installed (set ${envName})`);
}
const BIN = {
  factory: binary("factory", "OI_FACTORY_BIN"),
  aikit: binary("aikit", "OI_AIKIT_BIN"),
  ctrl: binary("ctrl", "OI_CTRL_BIN"),
  actuation: binary("actuation", "OI_ACTUATION_BIN"),
  pi: binary("pi", "OI_WALK_PI_BIN"),
};

// Factory's pinned owner-contract revisions (factory/src/native_owner.rs,
// attempt_receiving.rs). An owner at another cut must be re-pinned, not guessed.
const AIKIT_CAW_CONTRACT_REVISION = "3d23d1eefbb999b0a5058ed0b4ca98dd2575b632";
const CENTRAL_CONTRACT_REVISION = "e7e8479f1502732821bd3e7d3d5ceda38fd4279f";
// The original QL-MEF source this run's workflow succeeds (factory workflow
// check of ql-mef/workflows/expression-development.workflow.ts).
const ORIGINAL = {ref: "workflow-source:01M399B671QTQYNWQ02B8NM941", revision: "expression-development-v2", digest: "1bd72c1948c3accdd90ee3b8eef4e7a64f6f4f0bca4983621ed84680292a5303"};
const AGENCY_FLOW = "Control/agents/now/flows/two-machine-inhabitation-2026-09-24";

const CAST = {
  anima: {
    agentRef: "agent/anima", agentSet: "anima", unitKey: "anima-conduct",
    position: "anima-4", profileRef: "profile/anima",
    agencySource: `${AGENCY_FLOW}/agency-actualisation-request-anima-omarchy.json`,
    session: `agent-session/fx-anima-${TAG}`,
    skill: "Work/Quaternal-Logic/skills/anima-orchestration/SKILL.md",
  },
  aletheia: {
    agentRef: "agent/aletheia", agentSet: "aletheia", unitKey: "aletheia-disclose-return",
    position: "aletheia-5", profileRef: "profile/aletheia",
    agencySource: `${AGENCY_FLOW}/agency-actualisation-request-aletheia.json`,
    session: `agent-session/fx-aletheia-${TAG}`,
    skill: "Work/Quaternal-Logic/skills/aletheia-stack-traverse/SKILL.md",
  },
};
const SPACE = `session-space/factory-expressions-${TAG}`;
const WORK_FILE = "docs/contracts/EXPRESSION-APPLICATION-V1.md";

// ---------------------------------------------------------------------------
// Process plumbing: every mutating command is printed before it runs.

const evidence = {schema: "oi.factory-expressions-run-evidence/v1", tag: TAG, dryRun: DRY, disposable: DISPOSABLE, startedAt: new Date().toISOString(), binaries: BIN, commands: []};
const PLACEHOLDER = name => `<${name}${DRY ? " (dry-run)" : ""}>`;
let aikitEnv = {...process.env};

function show(bin, args, input) {
  const quoted = [bin, ...args].map(part => /^[\w@%+=:,./-]+$/.test(part) ? part : `'${String(part).replace(/'/g, "'\\''")}'`).join(" ");
  console.log(`\n$ ${quoted}${input === undefined ? "" : " <<< " + (input.length > 600 ? input.slice(0, 600) + ` … (${input.length} bytes)` : input)}`);
}
function exec(bin, args, {input, mutating = false, env, allowFailure = false} = {}) {
  if (mutating) show(bin, args, input);
  evidence.commands.push({bin: basename(bin), args: args.map(a => (a.length > 300 ? a.slice(0, 300) + "…" : a)), mutating, ran: !(mutating && DRY)});
  if (mutating && DRY) return {ok: true, dry: true, json: null, stdout: "", stderr: ""};
  const done = spawnSync(bin, args, {encoding: "utf8", input, env: env ?? process.env, maxBuffer: 256 * 1024 * 1024});
  if (done.error) throw done.error;
  let json = null;
  try { json = JSON.parse(done.stdout); } catch { /* not JSON */ }
  const ok = done.status === 0 && !(json && json.ok === false);
  if (!ok && !allowFailure) {
    const error = new Error(`${basename(bin)} ${args.slice(0, 3).join(" ")} refused (exit ${done.status}): ${(done.stderr || done.stdout).slice(0, 2000)}`);
    error.stdout = done.stdout; error.stderr = done.stderr;
    throw error;
  }
  return {ok, json, stdout: done.stdout, stderr: done.stderr, status: done.status};
}
const factory = (args, options) => exec(BIN.factory, args, options);
const ctrl = (action, input, options) => exec(BIN.ctrl, ["--json", "--root", GROUND, "action", "run", action, JSON.stringify(input)], options);
const step = title => console.log(`\n== ${title}`);
const sleep = ms => new Promise(done => setTimeout(done, ms));
const readJson = path => JSON.parse(readFileSync(path, "utf8"));

// ---------------------------------------------------------------------------
// Ground

let GROUND = resolve(option("ground"));
if (DISPOSABLE) {
  if (DRY) throw new Error("--disposable builds a ground; run it without --dry-run");
  if (existsSync(GROUND) && readdirSync(GROUND).length) throw new Error(`${GROUND} exists and is not empty; a disposable ground must be fresh`);
  mkdirSync(GROUND, {recursive: true});
  GROUND = realpathSync(GROUND);
  seedDisposableGround();
} else {
  GROUND = realpathSync(GROUND);
}
if (!existsSync(join(GROUND, "Control")) || !existsSync(join(GROUND, "Work"))) throw new Error(`${GROUND} is not a Central ground`);
const PROJECT_ROOT = join(GROUND, "Work", PROJECT);
const PROJECT_KEY = `central-project:${PROJECT}`;
if (!existsSync(PROJECT_ROOT)) throw new Error(`${PROJECT_ROOT} does not exist`);
mkdirSync(workDir, {recursive: true});
evidence.ground = GROUND; evidence.projectRoot = PROJECT_ROOT; evidence.workDir = workDir;
if (DISPOSABLE) aikitEnv = {...process.env, AIKIT_HOME: join(GROUND, ".aikit-home")};
evidence.aikitHome = aikitEnv.AIKIT_HOME ?? join(homedir(), ".aikit");

function seedDisposableGround() {
  step(`Disposable ground ${GROUND} (copies read from ${SEED})`);
  exec(BIN.ctrl, ["--json", "--root", GROUND, "action", "run", "central.init", "{}"], {mutating: true});
  // Placement policy and its source relation: the owner's real policy shape,
  // with this ground's only writable repository.
  mkdirSync(join(GROUND, "Control/relations"), {recursive: true});
  const policy = readJson(join(SEED, "Control/user/placement.json"));
  policy.writable = [{path: `Work/${PROJECT}`, class: "repository"}];
  writeFileSync(join(GROUND, "Control/user/placement.json"), JSON.stringify(policy, null, 2));
  writeFileSync(join(GROUND, "Control/relations/source-relations.json"), JSON.stringify({
    schema: "central.control.ground-relations/v1", project_id: "control:root",
    relations: [{ref: "central:source:control:root:Control/user/placement.json", path: "Control/user/placement.json", roles: ["work-placement-policy"], provenance: "human-adopted", standing: "architecture-contract", treatment: "projectcentral-user", recognition: "disposable-acceptance-ground-not-personal-adoption", recorded_at_unix_seconds: Math.floor(Date.now() / 1000)}],
  }, null, 2));
  const copy = relative => { mkdirSync(dirname(join(GROUND, relative)), {recursive: true}); copyFileSync(join(SEED, relative), join(GROUND, relative)); };
  for (const cast of Object.values(CAST)) {
    copy(agentSetFile(SEED, cast.agentSet));
    copy(`Work/${PROJECT}/ProjectCentral/relations/positions/${cast.position}.json`);
    copy(cast.agencySource);
    copy(cast.skill);
    const profile = profileFile(SEED, cast.agentRef);
    if (profile) copy(profile);
  }
  copy(`Work/${PROJECT}/${WORK_FILE}`);
  // The subject repository: the real file at a real Git basis.
  const project = join(GROUND, "Work", PROJECT);
  writeFileSync(join(project, ".gitignore"), ".factory/\nProjectCentral/\n.aikit/\n");
  const git = args => exec("git", ["-C", project, "-c", "commit.gpgsign=false", "-c", "core.hooksPath=/dev/null", "-c", "user.name=Disposable ground", "-c", "user.email=disposable@example.invalid", ...args], {mutating: true});
  git(["init", "-q", "-b", "main"]);
  git(["add", ".gitignore", WORK_FILE]);
  git(["commit", "-q", "-m", "Disposable O-I basis for the Factory Expressions acceptance run"]);
  const env = {...process.env, AIKIT_HOME: join(GROUND, ".aikit-home")};
  exec(BIN.aikit, ["--json", "-C", project, "project", "bind", PROJECT, "--directory", project, "--no-default-skill-sets"], {mutating: true, env});
}
function agentSetFile(root, ref) {
  const dir = "Control/agents/agent-sets";
  for (const file of readdirSync(join(root, dir))) if (file.endsWith(".json") && readJson(join(root, dir, file)).ref === ref) return `${dir}/${file}`;
  throw new Error(`no agent-set ${ref} under ${root}/${dir}`);
}
function profileFile(root, agentRef) {
  const dir = "Control/agents/profiles";
  if (!existsSync(join(root, dir))) return null;
  for (const file of readdirSync(join(root, dir))) {
    if (!file.endsWith(".json")) continue;
    try { if (readJson(join(root, dir, file)).agent_ref === agentRef) return `${dir}/${file}`; } catch { /* not a profile */ }
  }
  return null;
}

// ---------------------------------------------------------------------------
// AIKit

const aikit = (args, options = {}) => exec(BIN.aikit, ["--json", "session-space", "-C", PROJECT_ROOT, ...args], {env: aikitEnv, ...options});
const encounter = (request, options = {}) => {
  const done = aikit(["encounter", "--request-json", JSON.stringify(request)], options);
  return done.dry ? {dry: true} : done.json?.data;
};
const readJournal = (session, after = 0) => DRY ? {events: []} : encounter({action: "read", agent_session: session, after, limit: 512});
/** Every event after a cursor, paged by the owner's own `more`/`next_cursor`. */
function journalAll(session, after = 0) {
  const events = [];
  for (;;) {
    const page = readJournal(session, after);
    events.push(...(page.events ?? []));
    if (!page.more || page.next_cursor == null) return events;
    after = page.next_cursor;
  }
}
const lastCursor = session => { const events = journalAll(session); return events.length ? events[events.length - 1].cursor : 0; };
async function waitTurnEnded(session, after, label) {
  if (DRY) return [];
  const deadline = Date.now() + TURN_TIMEOUT_MS;
  for (;;) {
    const events = journalAll(session, after);
    const ended = events.find(event => JSON.stringify(event.event).includes("TurnEnded"));
    if (ended) { console.log(`   ${label}: turn ended at cursor ${ended.cursor} (${events.length} events)`); return events; }
    if (Date.now() > deadline) throw new Error(`${label}: no TurnEnded on ${session} within ${TURN_TIMEOUT_MS / 1000}s`);
    await sleep(2000);
  }
}
async function waitAgentMessage(session, sender, label) {
  if (DRY) return null;
  const deadline = Date.now() + TURN_TIMEOUT_MS;
  for (;;) {
    const hit = journalAll(session).find(event => event.event?.kind === "agent-message" && event.event?.sender === sender);
    if (hit) { console.log(`   ${label}: agent-message from ${sender} at cursor ${hit.cursor}`); return hit; }
    if (Date.now() > deadline) throw new Error(`${label}: no agent-message from ${sender} in ${session}`);
    await sleep(2000);
  }
}
/** The reply text of one turn: the provider's agent-message-chunk Signals. */
const signalOf = event => event?.kind === "provider" ? event.event?.Signal?.kind : null;
function replyText(events) {
  return events.map(({event}) => signalOf(event)).filter(kind => kind?.kind === "agent-message-chunk" && typeof kind.text === "string").map(kind => kind.text).join("").trim();
}
/** Journal kinds seen: owner records by kind, provider Signals by signal kind. */
function kindsSeen(events) {
  const kinds = {};
  for (const {event} of events) {
    if (!event) continue;
    let key = event.kind;
    if (key === "provider") { const signal = signalOf(event); key = signal ? `signal:${signal.kind}` : `provider:${Object.keys(event.event ?? {})[0] ?? "?"}`; }
    kinds[key] = (kinds[key] ?? 0) + 1;
  }
  return kinds;
}
const toolCalls = events => {
  const calls = [];
  const visit = value => {
    if (!value || typeof value !== "object") return;
    const name = value.toolName ?? value.tool_name;
    if (typeof name === "string" && (value.args || value.input || value.rawInput)) calls.push({tool: name, args: value.args ?? value.input ?? value.rawInput, id: value.toolCallId ?? value.tool_call_id});
    for (const child of Object.values(value)) visit(child);
  };
  for (const event of events) visit(event.event);
  const seen = new Set();
  return calls.filter(call => { const key = `${call.id}:${call.tool}`; if (seen.has(key)) return false; seen.add(key); return true; });
};

// ---------------------------------------------------------------------------
// Factory attempt plumbing

const CALLER = runRef => ({callerRef: runRef, projectionKind: "headless", lineage: ["human:owner", runRef]});
const AUTHORITY = {authorityRef: "authority:owner", nativeOwner: "factory", capabilityRef: "capability/factory/operate-attempt", capabilityGranted: true, actionAuthorised: true};
let RUN = null;
function attemptReading() {
  if (DRY || !RUN) return {revision: PLACEHOLDER("revision"), attempts: [], legs: {}};
  return factory(["attempt", "read", STATE, RUN.runRef, "--json"]).json;
}
function attemptAction(operation) {
  const reading = attemptReading();
  const request = {contract: "factory.attempt-action/v1", projectionRef: `projection:factory-expressions:${TAG}:${operation.operation}:${reading.revision}`, caller: CALLER(RUN?.runRef ?? PLACEHOLDER("run-ref")), runRef: RUN?.runRef ?? PLACEHOLDER("run-ref"), expectedRevision: reading.revision, authority: AUTHORITY, operation};
  return factory(["attempt", "action", STATE, "-", "--json"], {input: JSON.stringify(request), mutating: true}).json;
}
function ownerAction(requestRef, attemptRef, executionRef, packet) {
  const reading = attemptReading();
  const request = {contract: "factory.attempt-owner-action/v1", requestRef, projectionRef: `projection:factory-expressions:${TAG}`, caller: CALLER(RUN?.runRef ?? PLACEHOLDER("run-ref")), runRef: RUN?.runRef ?? PLACEHOLDER("run-ref"), expectedRevision: reading.revision, authority: AUTHORITY, attemptRef, executionRef,
    invocation: {operation: "aikit-encounter", binary: BIN.aikit, cwd: PROJECT_ROOT, contract_revision: AIKIT_CAW_CONTRACT_REVISION, request: packet}};
  const done = factory(["attempt", "owner-action", STATE, "-", "--json"], {input: JSON.stringify(request), mutating: true, env: aikitEnv});
  return done.json;
}
function prepare(attemptRef) {
  const reading = attemptReading();
  const request = {contract: "factory.attempt-central-action/v1", requestRef: `prepare:${attemptRef}`, projectionRef: `projection:factory-expressions:${TAG}`, caller: CALLER(RUN?.runRef ?? PLACEHOLDER("run-ref")), runRef: RUN?.runRef ?? PLACEHOLDER("run-ref"), expectedRevision: reading.revision, authority: AUTHORITY, attemptRef,
    central: {binary: BIN.ctrl, root: GROUND, contractRevision: CENTRAL_CONTRACT_REVISION, project: null},
    workingDirectory: PROJECT_ROOT, destinations: [], timeoutMs: 30000};
  return factory(["attempt", "prepare", STATE, "-", "--json"], {input: JSON.stringify(request), mutating: true}).json;
}

// ---------------------------------------------------------------------------
// The run

let STATE = null;
let FACTORY_PROJECT = null;
const refs = {};
let residentPid = null;
async function main() {
  // 1. Read the ground (read-only).
  step("Read the ground");
  const participants = [];
  for (const cast of Object.values(CAST)) {
    const setFile = agentSetFile(GROUND, cast.agentSet);
    const set = readJson(join(GROUND, setFile));
    participants.push({ref: `agent-set/${cast.agentSet}`, description: `The ${cast.agentSet} agent set (orchestrator ${set.orchestrator_agent_ref})`, sourceOwner: "central", sourceRef: `central:source:control:root:${setFile}`, sourceRevision: set.revision});
    const positionFile = `Work/${PROJECT}/ProjectCentral/relations/positions/${cast.position}.json`;
    const position = readJson(join(GROUND, positionFile));
    cast.positionRef = position.ref;
    participants.push({ref: cast.agentRef, description: `${position.label} (${position.handle})`, sourceOwner: "central", sourceRef: `central:source:project:${PROJECT}:ProjectCentral/relations/positions/${cast.position}.json`, sourceRevision: position.revision});
    if (!existsSync(join(GROUND, cast.skill))) throw new Error(`Skill ${cast.skill} is missing from the ground`);
    if (!existsSync(join(GROUND, cast.agencySource))) throw new Error(`agency source ${cast.agencySource} is missing from the ground`);
  }
  if (!existsSync(join(PROJECT_ROOT, WORK_FILE))) throw new Error(`${WORK_FILE} is missing from ${PROJECT_ROOT}`);
  const basis = exec("git", ["-C", PROJECT_ROOT, "rev-parse", "HEAD"]).stdout.trim();
  evidence.projectBasis = basis;
  const located = factory(["project", "locate", PROJECT_ROOT, "--json"], {allowFailure: true});
  if (located.ok) { STATE = located.json.statePath; FACTORY_PROJECT = located.json.projectRef; }
  else {
    step("Factory project setup");
    const setup = factory(["project", "setup", PROJECT_ROOT, PROJECT_KEY, "--json"], {mutating: true});
    STATE = setup.json?.statePath ?? join(PROJECT_ROOT, ".factory", PLACEHOLDER("state"));
    FACTORY_PROJECT = setup.json?.projectRef ?? PLACEHOLDER("factory project ref");
  }
  evidence.factoryState = STATE; evidence.factoryProjectRef = FACTORY_PROJECT;
  console.log(`   Factory state: ${STATE}`);

  // 2. Workflow source (generated successor unless one is supplied) + check.
  step("Workflow source");
  let workflowPath = option("workflow") ? resolve(option("workflow")) : join(workDir, "workflow", "expression-development-two-voice.workflow.ts");
  if (!option("workflow")) { mkdirSync(dirname(workflowPath), {recursive: true}); writeFileSync(workflowPath, twoVoiceWorkflow(basis.slice(0, 8))); console.log(`   generated ${workflowPath}`); }
  const check = factory(["workflow", "check", workflowPath, "--json"], {allowFailure: true});
  if (!check.json?.valid) throw new Error(`factory workflow check refused ${workflowPath}: ${check.stdout || check.stderr}`);
  evidence.workflow = {path: workflowPath, sourceRef: check.json.source.ref, revision: check.json.source.revision, semanticDigest: check.json.source.semanticDigest, successorOf: ORIGINAL, units: check.json.units.map(unit => ({key: unit.key, ref: unit.ref, threadForm: unit.composition?.threadForm, actor: unit.composition?.actorRef}))};

  // 3. Commission.
  step("Commission the Factory Run");
  const requestPath = join(workDir, "commission-request.json");
  const commissionRequest = {
    contract: "factory.commission-request/v1",
    requestRef: `commission-request:factory-expressions-${TAG}`,
    projectKey: PROJECT_KEY,
    purpose: "Factory Expressions acceptance: Anima conducts one Expression act over a real O-I contract and addresses Aletheia; Aletheia reviews and returns it",
    frontier: "Commissioned: Anima (anima-4) conducts, then Aletheia (aletheia-5) discloses and returns",
    runDestination: `factory-expressions/acceptance-${TAG}`,
    writeOwner: "factory",
    commissionedAt: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
    participantRequirements: participants,
    rootAct: {actRef: `act:factory-expressions-${TAG}`, agentRef: "agent/anima", purpose: "Commission one Anima → Aletheia Expression act for the Factory Live view", scopeRefs: [`project:${PROJECT}`], standing: "commissioned-not-executed"},
  };
  writeFileSync(requestPath, JSON.stringify(commissionRequest, null, 2));
  const commissioned = factory(["workflow", "commission", STATE, requestPath, workflowPath, "--root", dirname(workflowPath), "--json"], {mutating: true});
  const commission = commissioned.json?.commission?.commission;
  RUN = {runRef: commission?.runRef ?? PLACEHOLDER("run-ref"), journeyRef: commission?.journeyRef ?? PLACEHOLDER("journey-ref")};
  if (DRY) RUN = null;
  refs.runRef = RUN?.runRef ?? PLACEHOLDER("run-ref");
  refs.journeyRef = RUN?.journeyRef ?? PLACEHOLDER("journey-ref");
  const inspect = RUN ? factory(["workflow", "inspect", STATE, RUN.runRef, "--json"]).json : null;
  const units = inspect ? Object.fromEntries(inspect.units.map(unit => [unit.key, unit])) : {};
  const source = inspect?.source ?? {ref: evidence.workflow.sourceRef, revision: evidence.workflow.revision, semanticDigest: evidence.workflow.semanticDigest};
  console.log(`   run ${refs.runRef}`);

  // 4. AIKit: space, sessions, Agency bindings, provider, resident, open.
  step("AIKit SessionSpace, Agency bindings and Pi/GLM provider");
  const apply = preview => aikit(["apply", "--preview-json", JSON.stringify(preview)], {mutating: true});
  const created = aikit(["create", SPACE, "--label", `Factory Expressions acceptance ${TAG}`], {mutating: true});
  if (!created.dry) apply(created.json);
  const context = aikit(["project-context"]).json;
  const intents = [{operation: "bind-project-context", binding: context}];
  for (const cast of Object.values(CAST)) intents.push({operation: "attach-agent-session", attachment: {agent_session: cast.session, purpose: `${cast.agentRef} for Factory run ${refs.runRef}`, provenance: [`factory:${refs.runRef}`, `central:source:project:${PROJECT}:ProjectCentral/relations/positions/${cast.position}.json`]}});
  for (const intent of intents) { const staged = aikit(["stage", "--space", SPACE, "--intent-json", JSON.stringify(intent)], {mutating: true}); if (!staged.dry) apply(staged.json); }
  for (const [key, cast] of Object.entries(CAST)) {
    // Carried verbatim from the owner's own O-I agency request: governing
    // binding, metagency grant, differentiated binding, identity. Derived: a
    // fresh request/determination identity and the two Actions an encounter
    // session cannot work without (as AIKit's own agency mint derives them).
    const template = readJson(join(GROUND, cast.agencySource));
    const derived = structuredClone(template);
    derived.request_ref = `${template.request_ref}:factory-expressions-${TAG}`;
    derived.determination.determination_ref = `${template.determination.determination_ref}:factory-expressions-${TAG}`;
    derived.determination.delegated_autonomy = {...template.determination.delegated_autonomy, allowed_action_refs: ["action/aikit/encounter-send", "action/aikit/model-realise"]};
    derived.provenance = {...(template.provenance ?? {}), source_refs: [...(template.provenance?.source_refs ?? []), `central:source:control:root:${cast.agencySource}`]};
    const agencyPath = join(workDir, "agency", `${key}-agency-actualisation-request.json`);
    mkdirSync(dirname(agencyPath), {recursive: true});
    const bytes = Buffer.from(JSON.stringify(derived, null, 2));
    writeFileSync(agencyPath, bytes);
    const actualised = exec(BIN.actuation, ["agency", "actualise", agencyPath, "--json"]).json;
    if (actualised.status !== "actualised") throw new Error(`Actuation did not actualise ${key}: ${JSON.stringify(actualised).slice(0, 600)}`);
    cast.agencyRef = derived.differentiated_binding.agency_ref;
    cast.worldBindingRef = derived.differentiated_binding.binding_ref;
    cast.worldRef = derived.differentiated_binding.world_ref;
    cast.bindingRevision = `rev/factory-expressions-${TAG}-1`;
    const senders = [RUN?.runRef ?? PLACEHOLDER("run-ref")];
    if (key === "aletheia") senders.push(CAST.anima.agentRef);
    if (key === "anima") senders.push(CAST.aletheia.agentRef);
    const binding = {
      revision: cast.bindingRevision, active: true,
      agent_ref: cast.agentRef, agency_ref: cast.agencyRef, world_ref: cast.worldRef, world_binding_ref: cast.worldBindingRef,
      agency_source: {source_ref: `source/factory-expressions/${key}-${TAG}`, revision: `rev/${(await blake3(bytes)).slice(0, 16)}`, path: realpathSync(agencyPath), content_digest: `blake3:${await blake3(bytes)}`},
      actuation_bin: BIN.actuation, allowed_senders: senders, allowed_packet_sources: [], context: null,
    };
    aikit(["encounter-agency-configure", "--agent-session", cast.session, "--binding-json", JSON.stringify(binding)], {mutating: true});
    refs[`${key}Agency`] = {agencyRef: cast.agencyRef, worldBindingRef: cast.worldBindingRef, bindingRevision: cast.bindingRevision, source: agencyPath, receiptRef: actualised.receipt_ref, allowedSenders: senders};
  }
  const providerId = option("provider") ?? "factory-expressions-pi";
  if (!option("provider")) aikit(["encounter-configure", "--provider-json", JSON.stringify({protocol: "pi-rpc", id: providerId, label: "Factory Expressions Pi (settings default zai/glm-5.3-flash)", argv: [BIN.pi, "--mode", "rpc"]})], {mutating: true});
  const started = aikit(["encounter-start"], {mutating: true});
  residentPid = started.json?.data?.pid ?? null;
  for (const cast of Object.values(CAST)) encounter({action: "open", space: SPACE, agent_session: cast.session, provider: providerId, cwd: PROJECT_ROOT}, {mutating: true});
  const piSettings = (() => { try { return readJson(join(homedir(), ".pi/agent/settings.json")); } catch { return {}; } })();
  const model = {provider: piSettings.defaultProvider ?? "zai", model: piSettings.defaultModel ?? "glm-5.3-flash"};
  evidence.model = {...model, standing: "Pi's own configured default (~/.pi/agent/settings.json); the resident reports the provider's actual selector in its journal"};
  refs.space = SPACE; refs.provider = providerId; refs.residentPid = residentPid;

  // 5. Anima: start → prepare → dispatch → turn → observe → verify → return.
  const anima = CAST.anima, aletheia = CAST.aletheia;
  const a2aToAletheia = `a2a:factory-expressions-${TAG}:anima-to-aletheia`;
  const animaToAletheiaDelivery = `delivery/factory-expressions-${TAG}/anima-to-aletheia`;
  const sendCommand = (from, to, delivery, messageId, placeholder) => `python3 -c 'import json,subprocess,sys; t=${JSON.stringify(`[${from.agentRef} → ${to.agentRef}, addressed encounter send; answer in at most two sentences] `)}+" ".join(sys.argv[1:]); r={"action":"send","agent_session":${JSON.stringify(to.session)},"turn":{"delivery_ref":${JSON.stringify(delivery)},"sender":${JSON.stringify(from.agentRef)},"expected_binding_revision":${JSON.stringify(to.bindingRevision)},"packet":{"text":t,"source_refs":[],"audience":[${JSON.stringify(to.agentRef)}]},"a2a":{"message_id":${JSON.stringify(messageId)},"text":t,"purpose":"factory-expressions acceptance"}}}; print(subprocess.run([${JSON.stringify(BIN.aikit)},"--json","session-space","-C",${JSON.stringify(PROJECT_ROOT)},"encounter","--request-json",json.dumps(r)],capture_output=True,text=True).stdout)' "${placeholder}"`;
  const animaTask = [
    `You are Anima (agent/anima, Position ${anima.positionRef}), conducting one Expression act. Do exactly these three steps with your tools, then reply.`,
    `1. Read the first 60 lines of ${join(PROJECT_ROOT, WORK_FILE)} (read tool, limit 60).`,
    `2. Load your orchestration Skill: read ${join(GROUND, anima.skill)} (read tool).`,
    `3. Send Aletheia one message by running this exact bash command, replacing MESSAGE with two sentences (no quote characters) naming the file you read and the one thing in it Aletheia should check:`,
    sendCommand(anima, aletheia, animaToAletheiaDelivery, a2aToAletheia, "MESSAGE"),
    `Then reply in at most four sentences: what you read, which Skill you loaded, and the delivery_ref the send printed.`,
  ].join("\n");
  const animaAttempt = `attempt:factory-expressions-${TAG}-anima-1`;
  const animaExecution = `execution:factory-expressions-${TAG}-anima-1`;
  const animaResult = await runVoice({key: "anima", cast: anima, unit: units[anima.unitKey], attemptRef: animaAttempt, executionRef: animaExecution, task: animaTask, source, model, selectedInputs: [], contextRefs: [`context:factory-expressions/${TAG}/anima`],
    afterTurn: async () => {
      // The inter-agent message: an agent-message from agent/anima in Aletheia's journal.
      const message = await waitAgentMessage(aletheia.session, anima.agentRef, "Aletheia's journal");
      const aletheiaAfter = message ? message.cursor : 0;
      const aletheiaTurn = await waitTurnEnded(aletheia.session, aletheiaAfter, "Aletheia (answering Anima's message)");
      const text = message?.event?.request?.submission?.turn?.packet?.text ?? "";
      if (!DRY && text.replace(/^\[[^\]]*\]\s*/, "").length < 40) throw new Error(`Anima's message to Aletheia carries no real body: ${JSON.stringify(text)}`);
      refs.animaToAletheia = {deliveryRef: animaToAletheiaDelivery, text, a2aMessageId: a2aToAletheia, recipientSession: aletheia.session, cursor: message?.cursor ?? null, delivery: DRY ? null : encounter({action: "delivery", agent_session: aletheia.session, delivery_ref: animaToAletheiaDelivery}), aletheiaReplyText: replyText(aletheiaTurn)};
      return message ? [`aikit-encounter-cursor:${aletheia.session}:${message.cursor}`, `aikit-delivery:${aletheia.session}:${animaToAletheiaDelivery}`] : [];
    },
    verify: (events, extra) => {
      const calls = toolCalls(events);
      const readFile = calls.some(call => JSON.stringify(call.args).includes(WORK_FILE));
      const readSkill = calls.some(call => JSON.stringify(call.args).includes("anima-orchestration/SKILL.md"));
      const sent = extra.length > 0;
      return {checks: {readFile, readSkill, sent}, calls};
    }});

  // 6. Aletheia: start (with Anima's Return as its selected input) → … → return.
  const animaLeg = attemptReading().legs?.[units[anima.unitKey]?.workflowUnitRef];
  const receiving = "context:expression-development/aletheia-from-anima";
  const selectedInputs = DRY ? [{predecessor: PLACEHOLDER("anima unit"), executionRef: animaExecution, receivingContextRef: receiving, artifacts: [PLACEHOLDER("anima artifact")]}]
    : [{predecessor: units[anima.unitKey].workflowUnitRef, executionRef: animaExecution, receivingContextRef: receiving, artifacts: animaLeg?.artifacts ?? []}];
  const a2aToAnima = `a2a:factory-expressions-${TAG}:aletheia-to-anima`;
  const aletheiaToAnimaDelivery = `delivery/factory-expressions-${TAG}/aletheia-to-anima`;
  const aletheiaTask = [
    `You are Aletheia (agent/aletheia, Position ${aletheia.positionRef}). Anima's addressed message (delivery ${animaToAletheiaDelivery}) is earlier in this conversation. Review it with your tools, then reply.`,
    `1. Load your review Skill: read ${join(GROUND, aletheia.skill)} (read tool).`,
    `2. Check Anima's claim against the first 60 lines of ${join(PROJECT_ROOT, WORK_FILE)} (read tool, limit 60).`,
    `3. Answer Anima by running this exact bash command, replacing MESSAGE with one sentence (no quote characters) giving your verdict:`,
    sendCommand(aletheia, anima, aletheiaToAnimaDelivery, a2aToAnima, "MESSAGE"),
    `Then reply in at most four sentences: your verdict on Anima's act (does its message match the file?), the evidence you checked, and what remains open.`,
  ].join("\n");
  const aletheiaAttempt = `attempt:factory-expressions-${TAG}-aletheia-1`;
  const aletheiaExecution = `execution:factory-expressions-${TAG}-aletheia-1`;
  await runVoice({key: "aletheia", cast: aletheia, unit: units[aletheia.unitKey], attemptRef: aletheiaAttempt, executionRef: aletheiaExecution, task: aletheiaTask, source, model, selectedInputs, contextRefs: [`context:factory-expressions/${TAG}/aletheia`, receiving],
    afterTurn: async () => {
      const message = await waitAgentMessage(anima.session, aletheia.agentRef, "Anima's journal");
      const animaTurn = message ? await waitTurnEnded(anima.session, message.cursor, "Anima (receiving Aletheia's answer)") : [];
      const text = message?.event?.request?.submission?.turn?.packet?.text ?? "";
      if (!DRY && text.replace(/^\[[^\]]*\]\s*/, "").length < 20) throw new Error(`Aletheia's answer to Anima carries no real body: ${JSON.stringify(text)}`);
      refs.aletheiaToAnima = {deliveryRef: aletheiaToAnimaDelivery, text, a2aMessageId: a2aToAnima, recipientSession: anima.session, cursor: message?.cursor ?? null, delivery: DRY ? null : encounter({action: "delivery", agent_session: anima.session, delivery_ref: aletheiaToAnimaDelivery}), animaReplyText: replyText(animaTurn)};
      return message ? [`aikit-encounter-cursor:${anima.session}:${message.cursor}`, `aikit-delivery:${anima.session}:${aletheiaToAnimaDelivery}`] : [];
    },
    verify: (events, extra) => {
      const calls = toolCalls(events);
      const readSkill = calls.some(call => JSON.stringify(call.args).includes("aletheia-stack-traverse/SKILL.md"));
      const readFile = calls.some(call => JSON.stringify(call.args).includes(WORK_FILE));
      return {checks: {readSkill, readFile, answeredAnima: extra.length > 0}, calls};
    }});
  void animaResult;

  // 7. Final readings for the evidence record.
  step("Final owner readings");
  if (!DRY) {
    const final = attemptReading();
    evidence.factory = {stateRevision: final.revision, legs: Object.fromEntries(Object.entries(final.legs ?? {}).map(([unit, leg]) => [unit, {status: leg.status, executionRef: leg.execution_ref ?? leg.executionRef}])),
      attempts: final.attempts.map(attempt => ({attemptRef: attempt.attemptRef, executionRef: attempt.executionRef, dispatchPhases: [].concat(attempt.dispatch ?? []).map(r => r.phase), observations: (attempt.observations ?? []).map(r => ({contract: r.contract, phase: r.phase, operationRef: r.operationRef})), verifications: (attempt.verifications ?? []).map(v => ({ref: v.verificationRef, outcome: v.outcome})), readableReturn: attempt.readableReturn ? {returnRef: attempt.readableReturn.returnRef, summary: attempt.readableReturn.summary} : null, tracking: (attempt.tracking ?? []).map(f => ({kind: f.kind, subjectRef: f.subjectRef}))}))};
    evidence.encounterJournals = {};
    for (const [key, cast] of Object.entries(CAST)) {
      const events = journalAll(cast.session);
      evidence.encounterJournals[key] = {session: cast.session, lastCursor: events.length ? events[events.length - 1].cursor : 0, kinds: kindsSeen(events), agentMessages: events.filter(e => e.event?.kind === "agent-message").map(e => ({cursor: e.cursor, sender: e.event.sender, deliveryRef: e.event.delivery_ref})), toolCalls: toolCalls(events).map(c => ({tool: c.tool, id: c.id, path: c.args?.path ?? c.args?.file_path ?? null}))};
    }
    const watch = factory(["telemetry", "status", STATE, "--json"], {allowFailure: true});
    evidence.telemetryStatus = watch.json ?? watch.stderr;
  }
}

async function runVoice({key, cast, unit, attemptRef, executionRef, task, source, model, selectedInputs, contextRefs, afterTurn, verify}) {
  step(`${key}: start-serial ${attemptRef}`);
  const unitRef = unit?.workflowUnitRef ?? PLACEHOLDER(`${cast.unitKey} unit ref`);
  const decidedAt = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  const disposition = {
    selectedInputs,
    selection: {
      schema_version: "factory.execution-intelligence/v1",
      demand: {project_ref: FACTORY_PROJECT, run_ref: RUN?.runRef ?? PLACEHOLDER("run-ref"), workflow_unit_ref: unitRef, agency_ref: cast.agencyRef, profile_ref: cast.profileRef, use_type: key === "anima" ? "conduct" : "review", required_capabilities: unit?.capabilityRefs ?? [], required_modalities: ["text"], required_actions: [], required_tools: [], context_characteristics: [], independence_from: [], cost_ceiling_usd: null, latency_preference_ms: null, requires_local_materialisation: false},
      selection: {roster_version: "aikit.model-roster/v1", model_ref: `model:${model.provider}/${model.model}`, provider_ref: `provider:pi/${model.provider}`, ranking_policy: "owner-configured-default", ranking_explanation: {standing: "not ranked", note: "Pi's own configured default model (~/.pi/agent/settings.json); no AIKit roster ranking was consulted"}, provenance: ["source:pi/agent/settings.json"]},
      decided_at: decidedAt,
    },
    participant: {agentRef: cast.agentRef, agencyRef: cast.agencyRef, worldBindingRef: cast.worldBindingRef, profileRef: cast.profileRef, positionRef: cast.positionRef, sourceRef: source.ref, sourceRevision: source.revision, sourceDigest: `blake3:${source.semanticDigest}`},
    contextRefs,
    praxisRefs: unit?.praxisRefs ?? [],
    capabilityRefs: unit?.capabilityRefs ?? [],
    body: {modelRef: `model:${model.provider}/${model.model}`, providerRef: `provider:pi/${model.provider}`, routeRef: "route:aikit/session-space/encounter", harnessRef: "harness:pi", harnessCompositionRef: "composition:aikit/pi-rpc", agentSessionRef: cast.session, sessionSpaceRef: SPACE},
    permittedEffects: unit?.permittedEffects ?? [],
    verificationObligations: unit?.requiredVerification ?? [],
    returnAddress: unit?.requiredReturn?.address ?? `central:source:project:${PROJECT}:ProjectCentral/now`,
    stopConditions: unit?.stopConditions ?? "",
    escalationConditions: unit?.escalationConditions ?? "",
    budget: {wallClockTimeoutMs: 120000, retryGrantRef: `grant:factory-expressions/${TAG}/${key}`, maximumAttempts: 1},
  };
  attemptAction({operation: "start-serial", attempt_ref: attemptRef, task_ref: `task:factory-expressions/${TAG}/${key}`, parent_journey_ref: RUN?.journeyRef ?? PLACEHOLDER("journey-ref"), workflow_unit_ref: unitRef, disposition,
    retry_grant: {grantRef: `grant:factory-expressions/${TAG}/${key}`, attemptsAllowed: 1, attemptsSpent: 0, revoked: false},
    tracking: [{factRef: `fact:factory-expressions/${TAG}/${key}/session`, kind: "session", ownerRef: "aikit", subjectRef: cast.session, sourceRevision: cast.bindingRevision, evidenceRefs: [`aikit-binding:${cast.session}:${cast.bindingRevision}`]}]});

  step(`${key}: prepare (Central policy, NOW allocation)`);
  const prepared = prepare(attemptRef);
  const nowRef = prepared ? JSON.stringify(prepared).match(/central:now:[\w:.-]+/)?.[0] ?? null : null;

  step(`${key}: dispatch through factory attempt owner-action → AIKit encounter send`);
  const before = DRY ? 0 : lastCursor(cast.session);
  const delivery = `delivery/factory-expressions-${TAG}/${key}-task`;
  const sent = ownerAction(`owner-send:${attemptRef}`, attemptRef, executionRef, {action: "send", agent_session: cast.session, turn: {delivery_ref: delivery, sender: RUN?.runRef ?? PLACEHOLDER("run-ref"), expected_binding_revision: cast.bindingRevision, packet: {text: task, source_refs: [], audience: [cast.agentRef]}}});
  if (sent && sent.needsReconciliation) console.log(`   owner-action reports needsReconciliation (phase ${sent.transportObservation?.phase})`);
  const events = await waitTurnEnded(cast.session, before, `${key} (Factory task)`);
  const extraEvidence = await afterTurn();

  step(`${key}: observe the delivery through factory attempt owner-action (delivery read)`);
  const observed = ownerAction(`owner-delivery:${attemptRef}`, attemptRef, executionRef, {action: "delivery", agent_session: cast.session, delivery_ref: delivery});
  const reply = replyText(events);
  const {checks, calls} = verify(events, extraEvidence);
  const lastEvent = events.length ? events[events.length - 1].cursor : before;
  const evidenceRefs = [`aikit-delivery:${cast.session}:${delivery}`, `aikit-encounter-cursor:${cast.session}:${lastEvent}`, ...extraEvidence];
  const passed = DRY || Object.values(checks).every(Boolean);
  console.log(`   checks ${JSON.stringify(checks)} → ${passed ? "passed" : "failed"}`);

  step(`${key}: record-verification`);
  attemptAction({operation: "record-verification", attempt_ref: attemptRef, verification: {verificationRef: `verification:factory-expressions/${TAG}/${key}`, ownerRef: "factory", sourceRevision: `aikit-journal:${cast.session}:${lastEvent}`, outcome: passed ? "passed" : "failed", obligations: unit?.requiredVerification ?? [], evidenceRefs}});
  if (!passed) throw new Error(`${key}: the journal does not carry the required evidence ${JSON.stringify(checks)}; verification recorded as failed, no Return`);

  step(`${key}: return-artifact (readable Return)`);
  const artifactRef = `artifact:factory-expressions/${TAG}/${key}`;
  const returnRef = `return:factory-expressions/${TAG}/${key}-1`;
  const summary = (reply || `${key} turn ended without reply text`).slice(0, 4000);
  attemptAction({operation: "return-artifact", attempt_ref: attemptRef,
    artifact: {artifactRef, subjectRef: unit?.subjectRef ?? `project:${PROJECT}`, subjectRevision: unit?.basisRevision ?? PLACEHOLDER("basis"), producingExecutionRef: executionRef, evidenceRefs, semanticDifference: key === "anima" ? "Anima read the act contract, loaded its orchestration Skill and addressed Aletheia" : "Aletheia reviewed Anima's act against the source and answered it"},
    readable_return: {returnRef, summary, artifactRefs: [artifactRef], evidenceRefs}});
  refs[key] = {attemptRef, executionRef, session: cast.session, positionRef: cast.positionRef, taskDeliveryRef: delivery, nowRef, sendReceipt: sent ? {phase: sent.ownerReceipt?.phase, receiptRef: sent.ownerReceipt?.receiptRef, needsReconciliation: sent.needsReconciliation} : null, deliveryReceipt: observed ? {phase: observed.ownerReceipt?.phase, receiptRef: observed.ownerReceipt?.receiptRef} : null, cursorBefore: before, cursorAfter: lastEvent, checks, toolCalls: calls.map(c => ({tool: c.tool, id: c.id})), returnRef, artifactRef, replyText: reply};
  return refs[key];
}

function twoVoiceWorkflow(basis) {
  return `// Generated by desktop/cradle/walk/acceptance/factory-expressions-run.mjs.
// A two-voice successor of QL-MEF workflows/expression-development.workflow.ts
// (${ORIGINAL.revision}): its Anima (CF5) and Aletheia (CF7) voices only, as one
// melody. The full eight-unit melody needs six further Central agents with
// Agency bindings and sessions, a chord barrier, and three units whose
// permitted effects write (logos, sophia, aletheia) — Factory refuses those on
// the plain AIKit encounter path and requires the task-dispatch contract with
// a Workcell boundary. This source keeps the two voices the acceptance names.
import { defineWorkflow, unit } from "@epilogos/factory-workflow";
import type { CPrime } from "@epilogos/ql-vak";

const subject = "project:${PROJECT}";
const basis = ${JSON.stringify(basis)};
const whole = "central:source:project:${PROJECT}:ProjectCentral/now";
const returns = "central:source:project:${PROJECT}:ProjectCentral/now";
const cprime = { ref: "ql/interpretation/c-prime", revision: "09f7d29ad6262f85bc2858f7c468f22d0bd398f3" };
const oikonomia = "central:source:project:quaternal-logic:docs/kernel-rebuild/VAK-OIKONOMIA-KNOWLEDGE-RETURN.md";
const application = "central:source:project:${PROJECT}:${WORK_FILE}";
const placement = "central:source:control:root:Control/user/placement.json";
const returnDoor = "central:source:control:root:Control/agents/governance/field-and-now/session-work-placement.md";

export default defineWorkflow({
  source: {
    ref: "workflow-source:01M3FMCBKQAPGJ8XQDHPPW9T4D",
    revision: "expression-development-two-voice-v1",
    successorOf: { ref: "${ORIGINAL.ref}", revision: "${ORIGINAL.revision}", digest: "${ORIGINAL.digest}" },
  },
  workflowKey: "expression-development-two-voice",
  units: [
    unit({
      key: "anima-conduct",
      developmentalConcern: "Conduct one Expression act: read its governing contract, load the orchestration Skill and address Aletheia",
      requiredDifference: "A conducted reading of the Expression contract, handed to Aletheia as an addressed message",
      returnContract: "Return what was read, which Skill was loaded and the delivery ref of the message to Aletheia",
      subjectRef: subject,
      basisRevision: basis,
      agentRequirements: { agentRefs: ["agent/anima"], agentSetRefs: ["agent-set/anima"] },
      praxisRefs: ["skill/ql/anima-orchestration", "skill/ql/anima-expressive-composition"],
      capabilityRefs: ["capability/source-read", "capability/expression-compose"],
      permittedEffects: ["read O-I source and Skill material", "address Aletheia through one AIKit encounter send"],
      verificationObligations: ["cite the O-I file read and the Skill loaded"],
      returnAddress: returns,
      stopConditions: "Stop when the Expression contract cannot be read",
      escalationConditions: "Escalate any request to change source",
      composition: {
        CPF: "authorised-undertaking", authority: placement,
        CT: "CT4", CP: "4.4", CF: "CF5", CFP: "CFP2", CS: "CS4", direction: "forward",
        actor: "agent/anima", interpretation: cprime, whole: whole,
        resolvePath: "resolve-scoped-path:expression-development/anima",
        contextResolution: "context-resolution:expression-development/anima",
        sources: [oikonomia, application],
      } satisfies CPrime,
    }),
    unit({
      key: "aletheia-disclose-return",
      developmentalConcern: "Review what Anima performed and sent, compare it with the intent, and return it",
      requiredDifference: "An attributed review of Anima's act and message, returned to Factory",
      returnContract: "Return the review: intent against performance and the evidence refs",
      subjectRef: subject,
      basisRevision: basis,
      agentRequirements: { agentRefs: ["agent/aletheia"], agentSetRefs: ["agent-set/aletheia"] },
      praxisRefs: ["skill/ql/aletheia-stack-traverse", "skill/ql/aletheia-expressive-return"],
      capabilityRefs: ["capability/source-read", "capability/expression-observe"],
      dependencies: ["anima-conduct"],
      inputs: [{ predecessor: "anima-conduct", receivingContextRef: "context:expression-development/aletheia-from-anima" }],
      permittedEffects: ["read Anima's addressed message and O-I source", "answer Anima through one AIKit encounter send", "return one review through Factory"],
      verificationObligations: ["the review names the message it answers and the file it checked"],
      returnAddress: returns,
      stopConditions: "Stop when there is no performed evidence to disclose",
      escalationConditions: "Escalate Recognition decisions to the owner; never promote on its own",
      composition: {
        CPF: "authorised-undertaking", authority: returnDoor,
        CT: "CT5", CP: "4.5", CF: "CF7", CFP: "CFP2", CS: "CS5", direction: "returning",
        actor: "agent/aletheia", interpretation: cprime, whole: whole,
        resolvePath: "resolve-scoped-path:expression-development/aletheia",
        contextResolution: "context-resolution:expression-development/aletheia",
        sources: [oikonomia, returnDoor, application],
      } satisfies CPrime,
    }),
  ],
});
`;
}

try {
  await main();
  evidence.outcome = DRY ? "dry-run" : "completed";
} catch (error) {
  evidence.outcome = "refused";
  evidence.refusal = String(error.message ?? error);
  console.error(`\nREFUSED: ${evidence.refusal}`);
  process.exitCode = 1;
} finally {
  evidence.refs = refs;
  evidence.finishedAt = new Date().toISOString();
  if (DISPOSABLE && residentPid) { try { process.kill(-residentPid, "SIGTERM"); } catch { try { process.kill(residentPid, "SIGTERM"); } catch { /* gone */ } } }
  mkdirSync(dirname(evidencePath), {recursive: true});
  writeFileSync(evidencePath, JSON.stringify(evidence, null, 2));
  console.log(`\nevidence → ${evidencePath}`);
}
