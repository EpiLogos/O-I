#!/usr/bin/env node
// Plural Flow acceptance on a DISPOSABLE world, through the real binaries: a
// candidate AIKit resident owner, Central's real `ctrl`, the real Actuation
// owner for per-agent Agency admission, and real `pi` agent bodies on the
// owner's test model. The same owner operations the desktop performs are
// driven from here (provision a named agent, admit exactly one sender and one
// Flow, ask, read back); nothing in this script speaks for an agent.
//
//   node --experimental-strip-types tests/plural-flow-acceptance.mjs <phase…>
//
// Phases run against one persistent scratch (PF_SCRATCH) so the run can be
// resumed: setup · bring-in · ask · side · changed · report.
// Required: PF_SESSION_SPACE (candidate aikit-session-space), PF_CTRL (Central
// ctrl with central.flow.*). Optional: PF_PI, PF_TEMPLATE, PF_SCRATCH.
import {execFileSync, spawnSync} from "node:child_process";
import {createHash, randomBytes} from "node:crypto";
import {existsSync, mkdirSync, readFileSync, writeFileSync, rmSync} from "node:fs";
import {join, resolve} from "node:path";
import {homedir} from "node:os";
import {fileURLToPath} from "node:url";
import {appendContribution, addParticipant, withSession, legacyParticipantKey, sha256, canonicalJson} from "../src/flow/plural.ts";

const here = fileURLToPath(new URL("../", import.meta.url));
const need = name => { const v = process.env[name]; if (!v) throw new Error(`${name} is required`); return v; };
const SS = need("PF_SESSION_SPACE");
const CTRL = need("PF_CTRL");
const PI = process.env.PF_PI ?? join(homedir(), ".local/bin/pi");
const TEMPLATE = process.env.PF_TEMPLATE ?? join(homedir(), "Central/Work/O-I/.aikit/sf6-agency/agency-request.json");
const S = resolve(process.env.PF_SCRATCH ?? "/private/tmp/plural-flow-lab");
const dirs = {central: join(S, "central"), home: join(S, "home"), project: join(S, "project"), shim: join(S, "shim")};
const REMOTE = process.env.PF_REMOTE; // e.g. frank@100.92.62.101 — a second Workcell's owner
const REMOTE_ROOT = process.env.PF_REMOTE_ROOT ?? "/home/frank/pf-lab";
const REMOTE_BIN = process.env.PF_REMOTE_BIN ?? "/home/frank/pf-lab/bin";
const INTERRUPT = join(S, "route-interrupted");
const env = {
  ...process.env, AIKIT_HOME: dirs.home, CENTRAL_ROOT: dirs.central, AIKIT_CENTRAL_ROOT: dirs.central,
  CENTRAL_CTRL_BIN: CTRL, AIKIT_AGENCY_MINT_TEMPLATE: TEMPLATE,
};
delete env.CENTRAL_NATIVE_TOKEN;
const sh = (bin, args, options = {}) => {
  const r = spawnSync(bin, args, {encoding: "utf8", env: {...env, ...(options.env ?? {})}, cwd: options.cwd ?? dirs.project, maxBuffer: 64 * 1024 * 1024});
  if (r.status !== 0 && !options.allowFail) throw new Error(`${bin} ${args.slice(0, 4).join(" ")}: ${r.stderr || r.stdout}`);
  return r;
};
const json = r => JSON.parse(r.stdout);
const ss = (...args) => sh(SS, ["-C", dirs.project, ...args]);
const ctrl = (action, input, options = {}) => json(sh(CTRL, ["--json", "--root", dirs.central, "action", "run", action, JSON.stringify(input)], {allowFail: true, ...options}));
const tokensPath = join(S, "tokens.json");
const tokens = () => JSON.parse(readFileSync(tokensPath, "utf8"));
const encounter = request => { const r = sh(SS, ["-C", dirs.project, "encounter", "--request-json", JSON.stringify(request)], {allowFail: true}); const out = JSON.parse(r.stdout || "{}"); if (out.ok === false) throw new Error(`${request.action}: ${out.error?.code} ${out.error?.message}`); return out.data ?? out; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const say = (...a) => console.log(...a);
const statePath = join(S, "state.json");
const state = existsSync(statePath) ? JSON.parse(readFileSync(statePath, "utf8")) : {participants: {}};
const save = () => writeFileSync(statePath, JSON.stringify(state, null, 1));

const FLOW = "flow-acceptance.html";
const flowLoc = () => ({schema: "central.path-ref/v1", ref: `central:path:${dirs.central}:Control/user/flows/${FLOW}`, root: dirs.central, path: `Control/user/flows/${FLOW}`});
const island = /<script type="application\/json" id="ql-doc">([\s\S]*?)<\/script>/;
const readFlow = () => {
  const read = ctrl("central.files.read", {location: flowLoc()});
  const html = read.data.content;
  return {html, revision: read.data.revision, doc: JSON.parse(html.match(island)[1].replace(/<\\\/script/gi, "</script").replace(/<\\!--/g, "<!--"))};
};
const embed = (html, doc) => html.replace(island, () => '<script type="application/json" id="ql-doc">' + JSON.stringify(doc).replace(/<\/script/gi, "<\\/script").replace(/<!--/g, "<\\u0021--") + "</script>");
const writeFlow = (basis, doc) => { const r = ctrl("central.files.write", {location: flowLoc(), expected_revision: basis.revision, content: embed(basis.html, doc), actor: "human:ann", actor_kind: "human"}); if (!r.ok || r.data.outcome === "conflict") throw new Error("flow write: " + JSON.stringify(r)); return readFlow(); };
const plain = html => html.replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n").replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").trim();

const PASSAGE = `# On crossing a distance

1. To cross any distance, a traveller must first cross half of it.
2. After that, half of what remains, and again half of what remains, without end.
3. A task made of endlessly many steps, each requiring some time, can never be completed.
4. Therefore the traveller never arrives: motion across a distance is impossible.

The argument is old, and people still find it hard to say exactly where it fails.
`;

/** Bring a named roster agent in exactly as the desktop does: a session minted for
 * exactly that agent, its resident opened, this one sender and this one Flow
 * admitted to it — then the participant recorded in the Flow. */
function bringIn(name, initial, agentRef) {
  if (state.participants[name]) return;
  const slug = name.toLowerCase();
  const space = `session-space/pf-${slug}`, session = `agent-session/pf-${slug}`;
  const apply = preview => ss("apply", "--preview-json", JSON.stringify(preview));
  const native = (...a) => JSON.parse(ss(...a).stdout);
  apply(native("create", space, "--label", `Plural Flow · ${name}`));
  apply(native("stage", "--space", space, "--intent-json", JSON.stringify({operation: "bind-project-context", binding: native("project-context")})));
  apply(native("stage", "--space", space, "--intent-json", JSON.stringify({operation: "attach-agent-session", attachment: {agent_session: session, purpose: `Plural Flow participant ${name}`, provenance: ["acceptance"]}})));
  const mint = json(ss("encounter-agency-mint", "--agent-session", session, "--project-cwd", dirs.project, "--agent-ref", agentRef));
  const opened = encounter({action: "open", space, agent_session: session, provider: "pi", cwd: dirs.project});
  const admitted = json(ss("encounter-agency-admit", "--agent-session", session, "--sender", `human:${state.annKey}`, "--source-ref", flowLoc().ref));
  const basis = readFlow();
  let doc = addParticipant(basis.doc, {initial, name, kind: "agent", binding: {owner: "central", ref: agentRef, basis: "declared"}}, new Date().toISOString());
  const key = doc.meta.participants.at(-1).key;
  doc = withSession(doc, key, session);
  writeFlow(basis, doc);
  state.participants[name] = {key, session, space, agentRef};
  save();
  say(`${name}: minted=${mint.data?.standing ?? mint.standing} admitted=${JSON.stringify(admitted.data ?? admitted)} provider=${opened?.provider ?? "pi"} key=${key}`);
}

// ---------------------------------------------------------------- phases
const phases = {
  async setup() {
    rmSync(S, {recursive: true, force: true});
    for (const d of Object.values(dirs)) mkdirSync(d, {recursive: true});
    mkdirSync(join(dirs.project, "docs"), {recursive: true});
    writeFileSync(join(dirs.project, "docs/passage.md"), PASSAGE);
    if (!ctrl("central.init", {}).ok) throw new Error("central init");
    mkdirSync(join(dirs.central, "Control/user/flows"), {recursive: true});
    sh(SS.replace(/aikit-session-space$/, "aikit"), ["--json", "-C", dirs.project, "project", "bind", "flowlab", "--directory", dirs.project, "--no-default-skill-sets"]);
    // A real authority source and civil-time policy in this scratch Central: the
    // owner's resident gets a credential granted for exactly one action, and the
    // Day boundary falls a few minutes into the run so a Day really rolls.
    const minted = {service: randomBytes(32).toString("hex"), ann: randomBytes(32).toString("hex")};
    writeFileSync(tokensPath, JSON.stringify(minted), {mode: 0o600});
    const digest = t => createHash("sha256").update(t).digest("hex");
    const grant = (token, principal, kind, actions) => ({principal_ref: principal, actor_kind: kind, token_sha256: digest(token), scope_refs: ["control:root"], actions, expires_at_unix_seconds: Math.floor(Date.now() / 1000) + 86400});
    writeFileSync(join(dirs.central, "Control/user/native-action-authority.json"), JSON.stringify({schema: "central.native-action-authority/v1", scope_ref: "control:root", grants: [
      grant(minted.service, "native-service:aikit-owner", "native-service", ["central.flow.append"]),
      grant(minted.ann, "human:ann", "human", ["central.flow.append", "central.day.ensure", "central.day.lifecycle"]),
    ]}, null, 1));
    const now = new Date();
    const boundary = (now.getUTCHours() * 60 + now.getUTCMinutes() + (Number(process.env.PF_DAY_IN_MINUTES) || 14)) % 1440;
    state.dayBoundaryAtUtc = new Date(now.getTime() + (Number(process.env.PF_DAY_IN_MINUTES) || 14) * 60000).toISOString();
    writeFileSync(join(dirs.central, "Control/user/civil-time-policy.json"), JSON.stringify({schema: "central.civil-time-policy/v1", scope_ref: "control:root", timezone: "UTC", day_boundary_minutes: boundary, automatic_day_rollover: true}, null, 1));
    const relation = (path, role) => ({ref: `central:source:control:root:${path}`, path, roles: [role], provenance: "human-adopted", standing: "architecture-contract", treatment: "projectcentral-user", recognition: "controlled-acceptance-world-not-personal-adoption", recorded_at_unix_seconds: 1});
    mkdirSync(join(dirs.central, "Control/relations"), {recursive: true});
    writeFileSync(join(dirs.central, "Control/relations/source-relations.json"), JSON.stringify({schema: "central.control.ground-relations/v1", project_id: "control:root", relations: [relation("Control/user/native-action-authority.json", "native-action-authority"), relation("Control/user/civil-time-policy.json", "civil-time-policy")]}, null, 1));
    const policy = ctrl("central.time.policy", {});
    if (!policy.ok) throw new Error("civil-time policy not recognised: " + JSON.stringify(policy));
    state.timePolicyRevision = policy.data.revision;
    say("day boundary falls at", state.dayBoundaryAtUtc);
    ss("encounter-configure", "--provider-json", JSON.stringify({protocol: "pi-rpc", id: "pi", label: "Pi (acceptance)", argv: [PI, "--mode", "rpc"]}));
    // The transport to the other Workcell can be broken on demand by a flag file,
    // so a route interruption is real: the owner's own ssh fails and recovers.
    mkdirSync(dirs.shim, {recursive: true});
    writeFileSync(join(dirs.shim, "ssh"), `#!/bin/sh\nif [ -f "${INTERRUPT}" ]; then echo "ssh: connect to host: Connection timed out (route interrupted for the acceptance)" >&2; exit 255; fi\nexec /usr/bin/ssh "$@"\n`, {mode: 0o755});
    // The owner carries its granted credential; nothing else here does.
    sh(SS, ["-C", dirs.project, "encounter-start"], {env: {CENTRAL_NATIVE_TOKEN: minted.service, PATH: `${dirs.shim}:${process.env.PATH}`}});
    await sleep(1500);
    say("owner health:", JSON.stringify(encounter({action: "health"})));
    // The Flow, from the real v0.4 template, with the person declared.
    const html = readFileSync(join(here, "documents/ql-flow.html"), "utf8");
    const doc = JSON.parse(html.match(island)[1]);
    doc.meta.documentId = "flow-acceptance-" + sha256(S).slice(0, 12);
    doc.meta.created = new Date().toISOString();
    doc.meta.title = "On crossing a distance";
    doc.meta.participants = [{key: legacyParticipantKey(doc.meta.documentId, "A", 0), initial: "A", kind: "person", name: "Ann", role: "contributor", binding: {owner: "document", basis: "unknown"}}];
    state.annKey = doc.meta.participants[0].key;
    const made = ctrl("central.files.write", {location: flowLoc(), expected_revision: "", content: embed(html, doc), actor: "human:ann", actor_kind: "human"});
    if (!made.ok) throw new Error("create flow: " + JSON.stringify(made));
    save();
    say("scratch:", S, "\nflow:", flowLoc().ref);
  },

  /** Bring a named roster agent in exactly as the desktop does: a session
   * minted for exactly that agent, its resident opened, and this one sender
   * and this one Flow admitted to it — then the participant recorded. */
  async "bring-in"() {
    for (const [name, initial, agentRef] of [["Ada", "D", "agent/ada-lin"], ["Ash", "S", "agent/ash-kay"]]) bringIn(name, initial, agentRef);
  },

  async ask() {
    const {Ada, Ash} = state.participants;
    const basis = readFlow();
    const request = {
      request_ref: `conversation/pf-ask-${Date.now()}`, flow_location: flowLoc(), sender: `human:${state.annKey}`, actor: `human:${state.annKey}`,
      entry: {
        author_key: state.annKey, at: new Date().toISOString(), basis_revision: basis.doc.meta.revision, relations: [],
        html: "<p>Please read <code>docs/passage.md</code> in your working directory. Ada: recover the argument — state its premises and its conclusion exactly as the passage gives them. Ash: test the passage's claim on one concrete example of your own choosing, with numbers, and say whether the example supports step 3. Keep your answer under 150 words.</p>",
      },
      recipients: [{participant_key: Ada.key, agent_session: Ada.session}, {participant_key: Ash.key, agent_session: Ash.session}],
    };
    const sent = encounter({action: "conversation-send", request});
    state.ask = request.request_ref; save();
    say("sent:", JSON.stringify(sent.request.recipients.map(r => [r.participant_key, r.state])));
    await waitIncluded(request.request_ref, [Ada.key, Ash.key], 240000);
  },

  /** A side inquiry on one agent's answer, then a joined result that draws the
   * two answers and the side answer together — asked of the other agent. */
  async side() {
    const {Ada, Ash} = state.participants;
    const first = readFlow().doc;
    const find = (key, ref) => first.entries.find(e => e.authorKey === key && e.request?.ref?.startsWith(`conv-reply:${ref}`));
    const adaFirst = find(Ada.key, state.ask), ashFirst = find(Ash.key, state.ask);
    if (!adaFirst || !ashFirst) throw new Error("the first round's answers are not both in the flow");
    const branchRef = `conversation/pf-side-${Date.now()}`;
    const branchBasis = readFlow().doc.meta.revision;
    encounter({action: "conversation-send", request: {
      request_ref: branchRef, flow_location: flowLoc(), sender: `human:${state.annKey}`, actor: `human:${state.annKey}`,
      entry: {author_key: state.annKey, at: new Date().toISOString(), basis_revision: branchBasis,
        relations: [{type: "branch", entryId: adaFirst.id, revision: branchBasis, anchor: null}],
        html: "<p>Ada — a side question on your answer: what exactly would have to be true of the steps for step 3 to hold? Under 80 words.</p>"},
      recipients: [{participant_key: Ada.key, agent_session: Ada.session}]}});
    await waitIncluded(branchRef, [Ada.key], 240000);
    const afterBranch = readFlow().doc;
    const adaSide = afterBranch.entries.find(e => e.authorKey === Ada.key && e.request?.ref?.startsWith(`conv-reply:${branchRef}`));
    const joinRef = `conversation/pf-join-${Date.now()}`;
    const joinBasis = afterBranch.meta.revision;
    encounter({action: "conversation-send", request: {
      request_ref: joinRef, flow_location: flowLoc(), sender: `human:${state.annKey}`, actor: `human:${state.annKey}`,
      entry: {author_key: state.annKey, at: new Date().toISOString(), basis_revision: joinBasis,
        relations: [adaFirst, ashFirst, adaSide].map(e => ({type: "converge", entryId: e.id, revision: joinBasis})),
        html: "<p>Ash — using Ada's recovered argument, your own test and Ada's side answer together, say in under 100 words exactly where the passage's argument fails.</p>"},
      recipients: [{participant_key: Ash.key, agent_session: Ash.session}]}});
    await waitIncluded(joinRef, [Ash.key], 240000);
    state.side = branchRef; state.join = joinRef; save();
  },

  /** The question changes while an answer is still being produced. The late
   * answer must keep the question it actually answered. */
  async changed() {
    const {Ash} = state.participants;
    const basis = readFlow().doc;
    const ref = `conversation/pf-changed-${Date.now()}`;
    const sent = encounter({action: "conversation-send", request: {
      request_ref: ref, flow_location: flowLoc(), sender: `human:${state.annKey}`, actor: `human:${state.annKey}`,
      entry: {author_key: state.annKey, at: new Date().toISOString(), basis_revision: basis.meta.revision, relations: [],
        html: "<p>Ash — assume a traveller crosses 2 metres at 1 metre per second. Work through the halving steps for the first six steps, showing each step's distance and time, then say what the six steps add up to. Show all arithmetic.</p>"},
      recipients: [{participant_key: Ash.key, agent_session: Ash.session}]}});
    const askedId = sent.request.entry.entry_id, askedRev = sent.request.entry.document_revision;
    // While Ash is working, the person changes a material assumption.
    const live = readFlow();
    const corrected = ctrl("central.flow.append", {
      location: flowLoc(), operation_ref: `pf-correct-${Date.now()}`, author_key: state.annKey, at: new Date().toISOString(),
      html: "<p>Correction: the traveller moves at 2 metres per second, not 1.</p>", intent: "contribution",
      relations: [{type: "correct", entryId: askedId, revision: live.doc.meta.revision}], basis_revision: live.doc.meta.revision,
      actor: `human:${state.annKey}`, actor_kind: "human"});
    if (!corrected.ok) throw new Error("correction: " + JSON.stringify(corrected));
    say("  correction landed at document revision", corrected.data.document_revision, "while the ask was at", askedRev);
    const reading = await waitIncluded(ref, [Ash.key], 300000);
    const doc = readFlow().doc;
    const late = doc.entries.find(e => e.request?.ref === `conv-reply:${ref}:${Ash.key}`);
    say("  late answer replies to the asked entry:", late?.replyTo?.entryId === askedId, "at basis revision", late?.basisRevision, "— flow is now at", doc.meta.revision);
    state.changed = {ref, askedId, askedRev, lateId: late?.id}; save();
    return reading;
  },

  /** A fresh body for the same enduring agent, continuing from the retained flow. */
  async fresh() {
    const Ada = state.participants.Ada;
    const slug = "ada-fresh", space = `session-space/pf-${slug}`, session = `agent-session/pf-${slug}`;
    const apply = preview => ss("apply", "--preview-json", JSON.stringify(preview));
    const native = (...a) => JSON.parse(ss(...a).stdout);
    apply(native("create", space, "--label", "Plural Flow · Ada (fresh body)"));
    apply(native("stage", "--space", space, "--intent-json", JSON.stringify({operation: "bind-project-context", binding: native("project-context")})));
    apply(native("stage", "--space", space, "--intent-json", JSON.stringify({operation: "attach-agent-session", attachment: {agent_session: session, purpose: "Plural Flow participant Ada (fresh body)", provenance: ["acceptance"]}})));
    json(ss("encounter-agency-mint", "--agent-session", session, "--project-cwd", dirs.project, "--agent-ref", Ada.agentRef));
    encounter({action: "open", space, agent_session: session, provider: "pi", cwd: dirs.project});
    ss("encounter-agency-admit", "--agent-session", session, "--sender", `human:${state.annKey}`, "--source-ref", flowLoc().ref);
    const basis = readFlow();
    writeFlow(basis, withSession(basis.doc, Ada.key, session));
    state.participants.Ada = {...Ada, session, space}; save();
    const doc = readFlow().doc;
    const ref = `conversation/pf-fresh-${Date.now()}`;
    encounter({action: "conversation-send", request: {
      request_ref: ref, flow_location: flowLoc(), sender: `human:${state.annKey}`, actor: `human:${state.annKey}`,
      entry: {author_key: state.annKey, at: new Date().toISOString(), basis_revision: doc.meta.revision, relations: [],
        html: "<p>Ada — you have just joined this conversation afresh. Using what the earlier entries established about where the argument fails, apply the same analysis to a different case: a runner who covers half the remaining distance each step but doubles speed at every step. Does the argument fail in the same place? Under 100 words.</p>"},
      recipients: [{participant_key: Ada.key, agent_session: session}]}});
    await waitIncluded(ref, [Ada.key], 240000);
    state.fresh = ref; save();
  },

  /** A participant who was never in the conversation is brought in afterwards and
   * asked to use what the flow already holds on a different case. The participant
   * is told the task, not what a good answer contains: the expectations below are
   * the verifier's, kept apart from the prompt. */
  async "fresh-participant"() {
    bringIn("Cy", "Y", "agent/cy-wren");
    const Cy = state.participants.Cy;
    const doc = readFlow().doc;
    const ref = `conversation/pf-fresh-participant-${Date.now()}`;
    encounter({action: "conversation-send", request: {
      request_ref: ref, flow_location: flowLoc(), sender: `human:${state.annKey}`, actor: `human:${state.annKey}`,
      entry: {author_key: state.annKey, at: new Date().toISOString(), basis_revision: doc.meta.revision, relations: [],
        html: "<p>Cy — you are new to this conversation. Earlier entries already settled something about step 3 of the passage in <code>docs/passage.md</code>. Use that, not a fresh start, on this different case: each step covers half of what remains but takes one and a half times as long as the step before. Does step 3 fail here as it did before? Say why, with the numbers, in under 120 words.</p>"},
      recipients: [{participant_key: Cy.key, agent_session: Cy.session}]}});
    await waitIncluded(ref, [Cy.key], 240000);
    state.freshParticipant = ref; save();
    const reply = readFlow().doc.entries.find(e => (e.request?.ref ?? "") === ref || e.relations?.some(r => r.type === "reply" && r.entryId === doc.entries.at(-1)?.id && e.authorKey === Cy.key)) ?? readFlow().doc.entries.filter(e => e.authorKey === Cy.key).at(-1);
    const text = plain(reply?.html ?? "");
    // The verifier's held expectations (not given to the participant): the earlier
    // result is used — convergence depends on the step-time ratio being below one;
    // here the ratio is 1.5, so the times grow and the total does not converge.
    const marks = {
      "uses the earlier result (convergence / geometric series)": /converge|geometric|finite sum|sums? to/i.test(text),
      "names the ratio 1.5 and the growing times": /1\.5|three.halves|3\/2/.test(text) && /grow|increas|diverge|unbounded|infinite/i.test(text),
      "concludes step 3 does not fail in the same way here": /not (fail|refute)|does not fail|holds|doesn't fail|cannot finish|never (finish|complete|arrive)|infinite (total )?time/i.test(text),
    };
    say("\nCy's answer:\n" + text);
    say("verifier marks:", JSON.stringify(marks, null, 1));
    state.freshParticipantMarks = marks; save();
  },

  /** The Day the work began in, read through Central's own Day machinery. */
  async "day-before"() {
    const r = ctrl("central.day.ensure", {expected_time_policy_revision: state.timePolicyRevision}, {env: {CENTRAL_NATIVE_TOKEN: tokens().ann}});
    if (!r.ok) throw new Error("day ensure: " + JSON.stringify(r));
    state.dayBefore = r.data.day_ref ?? r.data; save();
    say("day before the boundary:", JSON.stringify(state.dayBefore).slice(0, 160));
  },
  /** Wait for the civil Day to roll, then read the new Day: a distinct Day, with the
   * flow, its pending conversations and the agents' enduring identity unaffected. */
  async "day-after"() {
    const at = new Date(state.dayBoundaryAtUtc).getTime() + 15000;
    while (Date.now() < at) { say("  waiting for the Day boundary…", Math.ceil((at - Date.now()) / 1000), "s"); await sleep(Math.min(20000, at - Date.now() + 500)); }
    const r = ctrl("central.day.ensure", {expected_time_policy_revision: state.timePolicyRevision}, {env: {CENTRAL_NATIVE_TOKEN: tokens().ann}});
    if (!r.ok) throw new Error("day ensure: " + JSON.stringify(r));
    state.dayAfter = r.data.day_ref ?? r.data; save();
    say("day after the boundary:", JSON.stringify(state.dayAfter).slice(0, 160));
    say("distinct Days:", JSON.stringify(state.dayBefore) !== JSON.stringify(state.dayAfter));
  },

  /** The other Workcell: its own owner, its own session and admission, its own
   * provider body. Nothing of the agent lives on this machine. Needs the
   * candidate binaries already built there (PF_REMOTE_BIN). */
  async "remote-setup-and-bring-in"() {
    if (!REMOTE) throw new Error("PF_REMOTE is required for the cross-Workcell phases");
    const rsh = (cmd, input) => { const r = spawnSync("ssh", ["-o", "BatchMode=yes", REMOTE, cmd], {encoding: "utf8", input, maxBuffer: 16 * 1024 * 1024}); if (r.status !== 0) throw new Error(`ssh: ${(r.stderr || r.stdout).slice(-600)}`); return r.stdout; };
    // The cleanup goes over stdin: a pkill pattern in an ssh command line would match the shell running it.
    rsh("bash -s", `pkill -f '${REMOTE_ROOT}/home' 2>/dev/null; rm -rf ${REMOTE_ROOT}/home ${REMOTE_ROOT}/project ${REMOTE_ROOT}/central; mkdir -p ${REMOTE_ROOT}/home ${REMOTE_ROOT}/project/docs ${REMOTE_ROOT}/central\n`);
    rsh(`cat > ${REMOTE_ROOT}/template.json`, readFileSync(TEMPLATE, "utf8"));
    rsh(`cat > ${REMOTE_ROOT}/project/docs/passage.md`, PASSAGE);
    const session = "agent-session/pf-ash-o", space = "session-space/pf-ash-o", agentRef = "agent/ash-omarchy";
    const flowRef = flowLoc().ref;
    const script = `
set -euo pipefail
R=${REMOTE_ROOT}
export PATH=${REMOTE_BIN}:/home/frank/.cargo/bin:/home/frank/.local/bin:/home/frank/.local/share/mise/shims:/usr/bin:/bin
export AIKIT_HOME=$R/home CENTRAL_ROOT=$R/central AIKIT_CENTRAL_ROOT=$R/central AIKIT_AGENCY_MINT_TEMPLATE=$R/template.json
SS="aikit-session-space -C $R/project"
ctrl --json --root $R/central action run central.init '{}' >/dev/null
aikit --json -C $R/project project bind flowlab-remote --directory $R/project --no-default-skill-sets >/dev/null
$SS encounter-configure --provider-json '{"protocol":"pi-rpc","id":"pi","label":"Pi (remote acceptance)","argv":["/home/frank/.local/share/mise/shims/pi","--mode","rpc"]}' >/dev/null
$SS encounter-start >/dev/null
sleep 3
apply() { $SS apply --preview-json "$1" >/dev/null; }
apply "$($SS create ${space} --label 'Plural Flow · Ash (Omarchy)')"
apply "$($SS stage --space ${space} --intent-json "{\\"operation\\":\\"bind-project-context\\",\\"binding\\":$($SS project-context)}")"
apply "$($SS stage --space ${space} --intent-json '{"operation":"attach-agent-session","attachment":{"agent_session":"${session}","purpose":"Plural Flow participant Ash (Omarchy)","provenance":["acceptance"]}}')"
$SS encounter-agency-mint --agent-session ${session} --project-cwd $R/project --agent-ref ${agentRef} >/dev/null
$SS encounter --request-json '{"action":"open","space":"${space}","agent_session":"${session}","provider":"pi","cwd":"'$R'/project"}' >/dev/null
$SS encounter-agency-admit --agent-session ${session} --sender human:${state.annKey} --source-ref '${flowRef}'
`;
    console.log(rsh("bash -s", script).trim().slice(0, 600));
    const basis = readFlow();
    let doc = addParticipant(basis.doc, {initial: "O", name: "Ash (Omarchy)", kind: "agent", binding: {owner: "central", ref: agentRef, basis: "declared"}}, new Date().toISOString());
    const key = doc.meta.participants.at(-1).key;
    doc = withSession(doc, key, session);
    writeFlow(basis, doc);
    state.participants.AshO = {key, session, space, agentRef, workcell: "workcell:omarchy", route: {
      kind: "ssh", target: REMOTE, cwd: `${REMOTE_ROOT}/project`, aikit: `${REMOTE_BIN}/aikit`, workcell: "workcell:omarchy",
      env: {AIKIT_HOME: `${REMOTE_ROOT}/home`, CENTRAL_ROOT: `${REMOTE_ROOT}/central`, AIKIT_CENTRAL_ROOT: `${REMOTE_ROOT}/central`, PATH: `${REMOTE_BIN}:/home/frank/.cargo/bin:/home/frank/.local/bin:/home/frank/.local/share/mise/shims:/usr/bin:/bin`}}};
    save();
    say("Ash (Omarchy) key", key, "session", session);
  },
  /** One entry to a person's agent here and another agent on the other Workcell,
   * with the route between them broken while the remote agent is answering. */
  async "remote-ask"() {
    const {Ada, AshO} = state.participants;
    const basis = readFlow();
    const request = {
      request_ref: `conversation/pf-remote-${Date.now()}`, flow_location: flowLoc(), sender: `human:${state.annKey}`, actor: `human:${state.annKey}`,
      entry: {author_key: state.annKey, at: new Date().toISOString(), basis_revision: basis.doc.meta.revision, relations: [],
        html: "<p>Please read <code>docs/passage.md</code> in your working directory. Ada: say in under 80 words which single premise the argument depends on. Ash: give one concrete numeric example that bears on that premise, in under 80 words. You are on different machines; answer from your own reading.</p>"},
      recipients: [{participant_key: Ada.key, agent_session: Ada.session}, {participant_key: AshO.key, agent_session: AshO.session, route: AshO.route, agent_ref: AshO.agentRef}],
    };
    const sent = encounter({action: "conversation-send", request});
    say("sent:", JSON.stringify(sent.request.recipients.map(r => [r.participant_key.slice(-6), r.workcell ?? "local", r.state])));
    // Break the route while the remote agent works, then restore it.
    writeFileSync(INTERRUPT, "1");
    say("  route interrupted for 30 s");
    await sleep(30000);
    rmSync(INTERRUPT, {force: true});
    say("  route restored");
    await waitIncluded(request.request_ref, [Ada.key, AshO.key], 300000);
    state.remoteAsk = request.request_ref; save();
  },

  /** A second, independently authorised world: its own Central root, AIKit home,
   * owner, credentials, person, agent and Day. It shares one flow with the first
   * through authorised native routes; nothing about it is inferred from sharing a
   * machine, a label or an initial. */
  async "world-b-setup"() {
    const B = {root: join(S, "worldB/central"), home: join(S, "worldB/home"), project: join(S, "worldB/project")};
    for (const d of Object.values(B)) mkdirSync(d, {recursive: true});
    mkdirSync(join(B.project, "docs"), {recursive: true});
    writeFileSync(join(B.project, "docs/passage.md"), PASSAGE);
    const benv = {...env, AIKIT_HOME: B.home, CENTRAL_ROOT: B.root, AIKIT_CENTRAL_ROOT: B.root};
    delete benv.CENTRAL_NATIVE_TOKEN;
    const run = (bin, args, extra = {}) => { const r = spawnSync(bin, args, {encoding: "utf8", env: {...benv, ...extra}, cwd: B.project, maxBuffer: 64 * 1024 * 1024}); if (r.status !== 0) throw new Error(`${bin} ${args.slice(0, 3).join(" ")}: ${r.stderr || r.stdout}`); return r.stdout; };
    const cb = (action, input, extra = {}) => JSON.parse(run(CTRL, ["--json", "--root", B.root, "action", "run", action, JSON.stringify(input)], extra));
    if (!cb("central.init", {}).ok) throw new Error("world B init");
    // World B's own civil-time policy and Day: a personal Day is B's, not a copy of A's.
    const bea = randomBytes(32).toString("hex");
    mkdirSync(join(B.root, "Control/user"), {recursive: true});
    const digest = t => createHash("sha256").update(t).digest("hex");
    writeFileSync(join(B.root, "Control/user/native-action-authority.json"), JSON.stringify({schema: "central.native-action-authority/v1", scope_ref: "control:root", grants: [{principal_ref: "human:bea", actor_kind: "human", token_sha256: digest(bea), scope_refs: ["control:root"], actions: ["central.day.ensure"], expires_at_unix_seconds: Math.floor(Date.now() / 1000) + 86400}]}));
    writeFileSync(join(B.root, "Control/user/civil-time-policy.json"), JSON.stringify({schema: "central.civil-time-policy/v1", scope_ref: "control:root", timezone: "Pacific/Auckland", day_boundary_minutes: 0, automatic_day_rollover: true}));
    const relation = (path, role) => ({ref: `central:source:control:root:${path}`, path, roles: [role], provenance: "human-adopted", standing: "architecture-contract", treatment: "projectcentral-user", recognition: "controlled-acceptance-world-not-personal-adoption", recorded_at_unix_seconds: 1});
    mkdirSync(join(B.root, "Control/relations"), {recursive: true});
    writeFileSync(join(B.root, "Control/relations/source-relations.json"), JSON.stringify({schema: "central.control.ground-relations/v1", project_id: "control:root", relations: [relation("Control/user/native-action-authority.json", "native-action-authority"), relation("Control/user/civil-time-policy.json", "civil-time-policy")]}));
    const policy = cb("central.time.policy", {});
    if (!policy.ok) throw new Error("world B time policy: " + JSON.stringify(policy));
    const day = cb("central.day.ensure", {expected_time_policy_revision: policy.data.revision}, {CENTRAL_NATIVE_TOKEN: bea});
    if (!day.ok) throw new Error("world B day: " + JSON.stringify(day));
    const aikit = SS.replace(/aikit-session-space$/, "aikit");
    run(aikit, ["--json", "-C", B.project, "project", "bind", "flowlab-b", "--directory", B.project, "--no-default-skill-sets"]);
    run(SS, ["-C", B.project, "encounter-configure", "--provider-json", JSON.stringify({protocol: "pi-rpc", id: "pi", label: "Pi (world B)", argv: [PI, "--mode", "rpc"]})]);
    run(SS, ["-C", B.project, "encounter-start"], {CENTRAL_NATIVE_TOKEN: ""});
    await sleep(1500);
    // Ann's world grants Bea exactly one right: to append to this flow. Nothing else.
    const fresh = tokens();
    const beaFlow = randomBytes(32).toString("hex");
    const authPath = join(dirs.central, "Control/user/native-action-authority.json");
    const auth = JSON.parse(readFileSync(authPath, "utf8"));
    auth.grants.push({principal_ref: "human:bea", actor_kind: "human", token_sha256: digest(beaFlow), scope_refs: ["control:root"], actions: ["central.flow.append"], expires_at_unix_seconds: Math.floor(Date.now() / 1000) + 86400});
    writeFileSync(authPath, JSON.stringify(auth, null, 1));
    writeFileSync(tokensPath, JSON.stringify({...fresh, beaFlow}), {mode: 0o600});
    // B's person, in B's world, and B's agent: a session minted in B's owner for exactly that agent.
    const slug = "bo", space = "session-space/pf-bo", session = "agent-session/pf-bo", agentRef = "agent/bo-ray";
    const apply = preview => run(SS, ["-C", B.project, "apply", "--preview-json", JSON.stringify(preview)]);
    const native = (...a) => JSON.parse(run(SS, ["-C", B.project, ...a]));
    apply(native("create", space, "--label", "Plural Flow · Bo (world B)"));
    apply(native("stage", "--space", space, "--intent-json", JSON.stringify({operation: "bind-project-context", binding: native("project-context")})));
    apply(native("stage", "--space", space, "--intent-json", JSON.stringify({operation: "attach-agent-session", attachment: {agent_session: session, purpose: "Plural Flow participant Bo (world B)", provenance: ["acceptance"]}})));
    run(SS, ["-C", B.project, "encounter-agency-mint", "--agent-session", session, "--project-cwd", B.project, "--agent-ref", agentRef]);
    run(SS, ["-C", B.project, "encounter", "--request-json", JSON.stringify({action: "open", space, agent_session: session, provider: "pi", cwd: B.project})]);
    run(SS, ["-C", B.project, "encounter-agency-admit", "--agent-session", session, "--sender", `human:${state.annKey}`, "--source-ref", flowLoc().ref]);
    state.worldB = {root: B.root, home: B.home, project: B.project, dayB: day.data.day_ref ?? day.data, session, space, agentRef};
    save();
    say("world B day:", JSON.stringify(state.worldB.dayB), "· world A day:", JSON.stringify(state.dayAfter ?? state.dayBefore ?? "—"));
  },
  async "world-b-join"() {
    const W = state.worldB;
    // Private material in A's flow that must not reach B's agent or B's person's rights.
    const basis = readFlow();
    const doc = JSON.parse(JSON.stringify(basis.doc));
    doc.journal = [{id: "j-private", at: new Date().toISOString(), html: "<p>PRIVATE-JOURNAL-OF-ANN: not for the other world.</p>"}];
    doc.notes = [{id: "n-private", entryId: doc.entries[0]?.id ?? "x", text: "<p>PRIVATE-NOTE-OF-ANN</p>", at: new Date().toISOString(), replies: []}];
    let next = addParticipant(doc, {initial: "B", name: "Bea", kind: "person", binding: {owner: "world-b", ref: "human:bea", basis: "declared"}}, new Date().toISOString());
    next = addParticipant(next, {initial: "O", name: "Bo", kind: "agent", binding: {owner: "central", ref: W.agentRef, basis: "declared"}}, new Date().toISOString());
    const bea = next.meta.participants.find(p => p.name === "Bea").key, bo = next.meta.participants.find(p => p.name === "Bo").key;
    next = withSession(next, bo, W.session);
    writeFlow(basis, next);
    state.beaKey = bea; state.boKey = bo; save();
    // Bea writes into A's flow from her own world with the credential A's world granted her.
    const live = readFlow();
    const wrote = ctrl("central.flow.append", {location: flowLoc(), operation_ref: `bea-${Date.now()}`, author_key: bea, at: new Date().toISOString(), html: "<p>Bea here, from my own world. I have read the question and I would like Bo to look at it too.</p>", intent: "contribution", relations: [], basis_revision: live.doc.meta.revision, actor: "human:bea", actor_kind: "human"}, {env: {CENTRAL_NATIVE_TOKEN: tokens().beaFlow}});
    say("Bea's entry:", wrote.ok ? `${wrote.data.outcome} attribution=${wrote.data.entry.attribution.basis}` : JSON.stringify(wrote.error));
    // Her grant is one right, on one flow, as herself: writing as Ann is refused, and any other action is refused.
    const asAnn = ctrl("central.flow.append", {location: flowLoc(), operation_ref: `bea-as-ann-${Date.now()}`, author_key: state.annKey, at: new Date().toISOString(), html: "<p>impersonation</p>", actor: "human:bea", actor_kind: "human"}, {env: {CENTRAL_NATIVE_TOKEN: tokens().beaFlow}});
    say("Bea writing as Ann:", asAnn.ok ? "ALLOWED (defect)" : `refused: ${asAnn.error?.code}`);
    const other = ctrl("central.day.ensure", {expected_time_policy_revision: state.timePolicyRevision}, {env: {CENTRAL_NATIVE_TOKEN: tokens().beaFlow}});
    say("Bea using another action in Ann's world:", other.ok ? "ALLOWED (defect)" : `refused: ${other.error?.message?.slice(0, 80)}`);
    state.beaChecks = {firstEntryVerified: wrote.ok && wrote.data.entry.attribution.basis === "verified", asAnnRefused: !asAnn.ok, otherActionRefused: !other.ok}; save();
  },
  async "world-b-ask"() {
    const W = state.worldB;
    const route = {kind: "exec", aikit: SS.replace(/aikit-session-space$/, "aikit"), cwd: W.project, workcell: "workcell:mac", env: {AIKIT_HOME: W.home, CENTRAL_ROOT: W.root, AIKIT_CENTRAL_ROOT: W.root}};
    const basis = readFlow();
    const request = {
      request_ref: `conversation/pf-worldb-${Date.now()}`, flow_location: flowLoc(), sender: `human:${state.annKey}`, actor: `human:${state.annKey}`,
      entry: {author_key: state.annKey, at: new Date().toISOString(), basis_revision: basis.doc.meta.revision, relations: [],
        html: "<p>Bo — Bea asked you to look at this too. Read <code>docs/passage.md</code> in your working directory and say in under 80 words what the passage is arguing. Tell me only what the conversation and your own working directory give you.</p>"},
      recipients: [{participant_key: state.boKey, agent_session: W.session, route, agent_ref: W.agentRef}],
    };
    encounter({action: "conversation-send", request});
    await waitIncluded(request.request_ref, [state.boKey], 300000);
    state.worldBAsk = request.request_ref; save();
    // What Bo was actually sent: read it from B's own owner journal.
    const r = spawnSync("sqlite3", [join(W.home, "state/encounters.sqlite3"), `select event from encounter_events where session='${W.session}'`], {encoding: "utf8", maxBuffer: 64 * 1024 * 1024});
    const journal = r.stdout ?? "";
    const leaked = ["PRIVATE-JOURNAL-OF-ANN", "PRIVATE-NOTE-OF-ANN"].filter(t => journal.includes(t));
    state.worldBLeak = leaked; save();
    say("private material in what World B's agent received:", leaked.length ? "LEAKED " + leaked.join(",") : "none");
  },
  async "world-b-days"() {
    const W = state.worldB;
    const dayB = JSON.parse(spawnSync(CTRL, ["--json", "--root", W.root, "action", "run", "central.day.read", "{}"], {encoding: "utf8", env: {...env, CENTRAL_ROOT: W.root}}).stdout);
    const dayA = ctrl("central.day.read", {});
    say("World A Day:", JSON.stringify(dayA.data?.day_ref ?? dayA.data ?? dayA.error).slice(0, 140));
    say("World B Day:", JSON.stringify(dayB.data?.day_ref ?? dayB.data ?? dayB.error).slice(0, 140));
  },

  async report() { report(); },
};

async function waitIncluded(ref, keys, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let last = "";
  for (;;) {
    const reading = encounter({action: "conversation-read", request_ref: ref});
    const line = reading.recipients.map(r => `${r.participant_key.slice(-6)}:${r.state}`).join(" ");
    if (line !== last) { say("  ·", line); last = line; }
    if (keys.every(k => reading.recipients.find(r => r.participant_key === k)?.state === "included")) return reading;
    if (reading.recipients.some(r => ["refused", "failed", "returned-not-included"].includes(r.state))) { say("  ! terminal non-inclusion:", JSON.stringify(reading.recipients.map(r => [r.state, r.dispatch.detail, r.inclusion.detail]))); return reading; }
    if (Date.now() > deadline) throw new Error("timed out waiting for " + ref + ": " + line);
    await sleep(2000);
  }
}
function report() {
  const {doc} = readFlow();
  const name = k => doc.meta.participants.find(p => p.key === k)?.name ?? k;
  say(`\n=== Flow "${doc.meta.title}" — ${doc.entries.length} entries, revision ${doc.meta.revision}`);
  doc.entries.forEach((e, i) => {
    const rel = (e.relations ?? []).map(r => `${r.type}→${doc.entries.findIndex(x => x.id === r.entryId) + 1}${r.revision !== undefined ? `@r${r.revision}` : ""}`).join(", ");
    say(`\n[${i + 1}] ${name(e.authorKey)} (${e.attribution?.basis ?? "?"}${e.attribution?.session ? " from " + e.attribution.session : ""})${rel ? " · " + rel : ""}${e.addressees?.length ? " · to " + e.addressees.map(name).join(", ") : ""}`);
    say("    " + plain(e.html).split("\n").join("\n    "));
  });
  const receipt = {recorded_at: new Date().toISOString(), flow: flowLoc().ref, document_id: doc.meta.documentId, revision: doc.meta.revision, digest: sha256(canonicalJson(doc)), entries: doc.entries.map(e => ({id: e.id, author: name(e.authorKey), attribution: e.attribution, relations: e.relations, addressees: e.addressees, request: e.request, words: plain(e.html).length}))};
  writeFileSync(join(S, "receipt.json"), JSON.stringify(receipt, null, 1));
  say("\nreceipt:", join(S, "receipt.json"));
}

const wanted = process.argv.slice(2);
if (!wanted.length) throw new Error("name at least one phase: " + Object.keys(phases).join(" "));
for (const phase of wanted) { say(`\n--- ${phase}`); await phases[phase](); }
