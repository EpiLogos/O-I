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
const dirs = {central: join(S, "central"), home: join(S, "home"), project: join(S, "project")};
const env = {
  ...process.env, AIKIT_HOME: dirs.home, CENTRAL_ROOT: dirs.central, AIKIT_CENTRAL_ROOT: dirs.central,
  CENTRAL_CTRL_BIN: CTRL, AIKIT_AGENCY_MINT_TEMPLATE: TEMPLATE,
};
delete env.CENTRAL_NATIVE_TOKEN;
const sh = (bin, args, options = {}) => {
  const r = spawnSync(bin, args, {encoding: "utf8", env, cwd: options.cwd ?? dirs.project, maxBuffer: 64 * 1024 * 1024});
  if (r.status !== 0 && !options.allowFail) throw new Error(`${bin} ${args.slice(0, 4).join(" ")}: ${r.stderr || r.stdout}`);
  return r;
};
const json = r => JSON.parse(r.stdout);
const ss = (...args) => sh(SS, ["-C", dirs.project, ...args]);
const ctrl = (action, input) => json(sh(CTRL, ["--json", "--root", dirs.central, "action", "run", action, JSON.stringify(input)], {allowFail: true}));
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
    ss("encounter-configure", "--provider-json", JSON.stringify({protocol: "pi-rpc", id: "pi", label: "Pi (acceptance)", argv: [PI, "--mode", "rpc"]}));
    sh(SS, ["-C", dirs.project, "encounter-start"]);
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
    for (const [name, initial, agentRef] of [["Ada", "D", "agent/ada-lin"], ["Ash", "S", "agent/ash-kay"]]) {
      if (state.participants[name]) continue;
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
