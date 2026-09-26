/**
 * The disposable world the left-frame walks stand on (lane 1, 10-SIDEBARS
 * §5.1/§5.2): a fresh Central ground and a fresh AIKit home, so nothing of
 * the owner's real state is read or written.
 *
 *   Central root   Control/user/flows/flow-<walk>.html  (one flow)
 *   Work/Alpha     a project with conversations, a vision page that says it
 *                  is an agent-recovered candidate, learnings, a stamped telos
 *                  folder with no goals yet
 *   Work/Beta      a second project (its own conversation)
 *   Work/O-I       the O-I ground holding the document form templates, copied
 *                  byte-exact from this checkout's desktop/cradle/documents
 *   Work/epi       the Epi-Logos corpus (essays/, bimba/) for the lens
 *
 * AIKit (isolated AIKIT_HOME): project Alpha bound, one SessionSpace with
 * four attached agent sessions, and three providers — a process that fails at
 * once (for R5), the existing pi harness (real turns for R2/R4) and, when
 * OI_WALK_OPENCODE_BIN is present, OpenCode's ACP with every tool asking
 * first (a real native permission request for R3).
 *
 * The kernel routes owner calls through `<OI_BIN> aikit …`; a small router
 * pins that route to the AIKit binary under test (canvas-context precedent).
 */
import {execFileSync} from "node:child_process";
import {createHash} from "node:crypto";
import {chmodSync, copyFileSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {walkPiArgv} from "../lib/walk-provider.mjs";
export const SESSIONS = {
  idle: {ref: "agent-session/left-idle", purpose: "Plan the left sidebar's scope menu and its census of projects"},
  failing: {ref: "agent-session/left-failing", purpose: "A conversation whose provider refuses every send"},
  working: {ref: "agent-session/left-working", purpose: "Write the Inbox acceptance notes for the left frame"},
  consent: {ref: "agent-session/left-consent", purpose: "Ask before writing the consent-walk file"},
};
const HUMAN_TOKEN = "left-walk-human-credential-not-a-real-secret";
const AGENT_TOKEN = "left-walk-agent-credential-not-a-real-secret";
const sha256 = value => createHash("sha256").update(value).digest("hex");
export const BETA_SESSION = {ref: "agent-session/beta-review", purpose: "Review the Beta project's goals"};

export async function setup({cradleRoot}) {
  const root = mkdtempSync(join(tmpdir(), "oi-left-ground-"));
  const home = mkdtempSync(join(tmpdir(), "oi-left-home-"));
  const cleanups = [() => rmSync(root, {recursive: true, force: true}), () => rmSync(home, {recursive: true, force: true})];
  const ctrl = process.env.OI_CENTRAL_CTRL_BIN ?? "ctrl";
  const call = (action, input = {}) => {
    const r = JSON.parse(execFileSync(ctrl, ["--root", root, "--json", "action", "run", action, JSON.stringify(input)], {encoding: "utf8"}));
    if (!r.ok) throw new Error(`${action}: ${JSON.stringify(r)}`);
    return r.data;
  };
  try {
    call("central.init");
    for (const [name, id] of [["Alpha", "alpha-walk"], ["Beta", "beta-walk"], ["O-I", "oi-walk"]]) {
      mkdirSync(join(root, "Work", name), {recursive: true});
      call("projectcentral.init", {project: name, project_id: id});
    }
    // The flow the FLOWS section lists.
    mkdirSync(join(root, "Control/user/flows"), {recursive: true});
    const flowTemplate = (await import("node:fs")).readFileSync(join(cradleRoot, "documents/ql-dialogue-flow.html"), "utf8");
    writeFileSync(join(root, "Control/user/flows/flow-2026-09-23-0900.html"), flowTemplate);
    // Alpha's intent: an agent-recovered vision page, learnings, no telos.
    const alphaUser = join(root, "Work/Alpha/ProjectCentral/user");
    mkdirSync(join(alphaUser, "learnings"), {recursive: true});
    writeFileSync(join(alphaUser, "alpha.html"), `<!doctype html><html><head><meta charset="utf-8"><title>Alpha — product ground</title></head><body><h1>Alpha</h1><p class="hero-meta"><span>Agent-recovered candidate seed · human review pending</span></p><p>What Alpha is for.</p></body></html>\n`);
    writeFileSync(join(alphaUser, "learnings/2026-09-20-first-learning.md"), "# First learning\n\nThe left frame holds still across modes.\n");
    // Alpha's telos ground as the ProjectCentral stamp lays it (README only:
    // no goals yet) — the shape Actuation and Workcell carry today.
    mkdirSync(join(alphaUser, "telos"), {recursive: true});
    writeFileSync(join(alphaUser, "telos/README.md"), "# Telos — open intent\n\n**Status:** distributed default — becomes human source on adoption\n");
    // Alpha's remembered notes and a project file to open beside.
    mkdirSync(join(root, "Work/Alpha/ProjectCentral/agents/remembered"), {recursive: true});
    writeFileSync(join(root, "Work/Alpha/ProjectCentral/agents/remembered/scope-note.md"), "Scope changes only in the scope menu.\n");
    writeFileSync(join(root, "Work/Alpha/notes.md"), "# Alpha notes\n\nA file row opens beside.\n");
    // The O-I ground's document forms, byte-exact from this checkout.
    const documents = join(root, "Work/O-I/desktop/cradle/documents");
    mkdirSync(documents, {recursive: true});
    for (const file of readdirSync(join(cradleRoot, "documents")).filter(name => name.endsWith(".html") || name === "forms.json")) copyFileSync(join(cradleRoot, "documents", file), join(documents, file));
    // The Epi-Logos corpus.
    mkdirSync(join(root, "Work/epi/essays"), {recursive: true});
    mkdirSync(join(root, "Work/epi/bimba"), {recursive: true});
    writeFileSync(join(root, "Work/epi/essays/Return of Zero.md"), "# Return of Zero\n");
    writeFileSync(join(root, "Work/epi/essays/Antykathera.md"), "# Antykathera\n");
    writeFileSync(join(root, "Work/epi/bimba/README.md"), "# Bimba\n");

    // The Inbox's material: one document in Alpha and one agent arrival
    // against it, through Central's own receiving operations (the
    // receive-include precedent: walk-scoped grants, never a real token).
    const as = token => (action, input) => {
      const r = JSON.parse(execFileSync(ctrl, ["--root", root, "--json", "action", "run", action, JSON.stringify(input)], {encoding: "utf8", env: {...process.env, OI_HOME: home, CENTRAL_NATIVE_TOKEN: token}}));
      if (!r.ok) throw new Error(`${action} refused: ${JSON.stringify(r.error ?? r)}`);
      return r.data;
    };
    const human = as(HUMAN_TOKEN), agent = as(AGENT_TOKEN);
    const relationsPath = join(root, "Control/relations/source-relations.json");
    mkdirSync(join(root, "Control/relations"), {recursive: true});
    let relations;
    try { relations = JSON.parse(readFileSync(relationsPath, "utf8")); } catch { relations = {schema: "central.control.ground-relations/v1", project_id: "control:root", relations: []}; }
    const actions = ["central.document.create", "central.document.mutate", "central.receiving.submit", "central.receiving.review", "central.receiving.include", "central.receiving.recover", "central.day.ensure"];
    const grants = [
      {principal_ref: "human:left-walk", actor_kind: "human", token_sha256: sha256(HUMAN_TOKEN), scope_refs: ["control:root", "project:alpha-walk"], actions, expires_at_unix_seconds: 4000000000},
      {principal_ref: "agent:left-walk", actor_kind: "agent", token_sha256: sha256(AGENT_TOKEN), scope_refs: ["control:root", "project:alpha-walk"], actions, expires_at_unix_seconds: 4000000000},
    ];
    const policies = [
      ["placement.json", "work-placement-policy", {schema: "central.work-placement-policy/v1", scope_ref: "control:root", writable: [{path: "Work/Alpha", class: "repository"}], enforcement: "native-actions", required_coverage: ["file-content"], lease_seconds: 300}],
      ["time.json", "civil-time-policy", {schema: "central.civil-time-policy/v1", scope_ref: "control:root", timezone: "Europe/London", day_boundary_minutes: 0, automatic_day_rollover: true}],
      ["authority.json", "native-action-authority", {schema: "central.native-action-authority/v1", scope_ref: "control:root", grants}],
    ];
    relations.relations = relations.relations ?? [];
    for (const [name, role, value] of policies) {
      const path = `Control/user/${name}`;
      writeFileSync(join(root, path), JSON.stringify(value, null, 2));
      const ref = `central:source:control:root:${path}`;
      if (!relations.relations.some(entry => entry.ref === ref)) relations.relations.push({ref, path, roles: [role], provenance: "human-adopted", standing: "architecture-contract", treatment: "projectcentral-user", recognition: "controlled-walk-fixture-not-personal-adoption", recorded_at_unix_seconds: 1});
    }
    writeFileSync(relationsPath, JSON.stringify(relations, null, 2));
    const policy = as("")("central.work.policy", {project: "Alpha"});
    const doc = human("central.document.create", {project: "Alpha", kind: "flow", document_id: "doc:left-inbox", title: "Left inbox walk", expected_policy_revision: policy.revision, template_payload: {supplied: "value"}, fields: [{id: "walk-field", label: "Walk field", template_pointer: "/supplied"}]});
    const arrival = agent("central.receiving.submit", {project: "Alpha", producer_key: "producer:left-inbox", source_ref: doc.source.ref, document_id: doc.document_id, expected_source_revision: doc.revision.revision, occurred_at_unix_seconds: Math.floor(Date.now() / 1000) - 600, task_ref: "task:left-inbox", session_ref: "session:left-inbox", proposal: {operation: "entry.add", entry_id: "entry:left", contribution_id: "part:left", html: "<p>A contribution waiting in the Inbox</p>"}});
    if (arrival.record.status !== "pending") throw new Error(`the Inbox arrival landed ${arrival.record.status}`);

    const aikit = process.env.OI_AIKIT_BIN ?? join(process.env.HOME, ".local/bin/aikit");
    const aikitHome = join(root, ".aikit-home");
    const router = join(root, "oi-owner-router.mjs");
    writeFileSync(router, `#!/usr/bin/env node\nimport {spawnSync} from "node:child_process";\nconst args = process.argv.slice(2);\nif (args[0] === "aikit") {\n  const child = spawnSync(${JSON.stringify(aikit)}, args.slice(1), {stdio: "inherit"});\n  process.exit(child.status ?? 1);\n}\nconst child = spawnSync("oi", args, {stdio: "inherit"});\nprocess.exit(child.status ?? 1);\n`);
    chmodSync(router, 0o755);
    const env = {...process.env, OI_CENTRAL_ROOT: root, OI_HOME: home, AIKIT_HOME: aikitHome, OI_AIKIT_BIN: aikit, OI_BIN: router, CENTRAL_NATIVE_TOKEN: HUMAN_TOKEN};
    const owners = [];
    const bindProject = (name, id) => {
      const directory = join(root, "Work", name);
      const bound = JSON.parse(execFileSync(aikit, ["--json", "-C", directory, "project", "bind", id, "--directory", directory, "--no-default-skill-sets"], {encoding: "utf8", env}));
      if (!bound.ok) throw new Error(JSON.stringify(bound));
      const native = (...parts) => {
        try { return JSON.parse(execFileSync(aikit, ["--json", "session-space", "-C", directory, ...parts], {encoding: "utf8", env})); }
        catch (error) { throw new Error(`native ${parts[0]} failed: ${String(error.output?.filter(Boolean).join(" ") ?? error.message).slice(0, 600)}`); }
      };
      return {directory, native};
    };
    const alpha = bindProject("Alpha", "alpha-walk");
    const beta = bindProject("Beta", "beta-walk");
    const attach = (project, space, label, sessions) => {
      const apply = preview => project.native("apply", "--preview-json", JSON.stringify(preview));
      apply(project.native("create", space, "--label", label));
      apply(project.native("stage", "--space", space, "--intent-json", JSON.stringify({operation: "bind-project-context", binding: project.native("project-context")})));
      for (const session of sessions) apply(project.native("stage", "--space", space, "--intent-json", JSON.stringify({operation: "attach-agent-session", attachment: {agent_session: session.ref, purpose: session.purpose, provenance: ["Left-frame walk ground"]}})));
    };
    const space = "session-space/left-walk";
    attach(alpha, space, "Left frame walk", Object.values(SESSIONS));
    attach(beta, "session-space/beta-walk", "Beta walk", [BETA_SESSION]);
    // Providers: an immediately failing process, and the existing pi harness.
    alpha.native("encounter-configure", "--provider-json", JSON.stringify({id: "left-walk-false", label: "Walk failing provider", argv: ["/usr/bin/false"]}));
    alpha.native("encounter-configure", "--provider-json", JSON.stringify({protocol: "pi-rpc", id: "left-walk-pi", label: "Pi", argv: walkPiArgv()}));
    const opencode = process.env.OI_WALK_OPENCODE_BIN;
    let consentProvider;
    if (opencode) {
      // OpenCode's ACP with every tool asking first: a REAL native permission
      // request, answered through the desktop. Its config is isolated in the
      // walk ground (OPENCODE_CONFIG); the model is the owner's configured
      // default, read from the environment it already runs with.
      const config = join(root, "opencode-walk.json");
      writeFileSync(config, JSON.stringify({$schema: "https://opencode.ai/config.json", permission: {edit: "ask", bash: "ask", webfetch: "ask"}, mcp: {gitnexus: {type: "local", command: ["true"], enabled: false}, pencil: {type: "local", command: ["true"], enabled: false}}}));
      alpha.native("encounter-configure", "--provider-json", JSON.stringify({id: "left-walk-opencode", label: "OpenCode", argv: ["/usr/bin/env", `OPENCODE_CONFIG=${config}`, opencode, "acp"]}));
      consentProvider = "left-walk-opencode";
    }
    const owner = alpha.native("encounter-start");
    if (!owner.ok) throw new Error(JSON.stringify(owner));
    owners.push(owner.data.pid);
    const request = (action, fields = {}, project = alpha) => {
      // The kernel stamps cwd on open/reconnect; a direct owner call does too.
      const body = action === "open" || action === "reconnect" ? {action, cwd: project.directory, ...fields} : {action, ...fields};
      const result = project.native("encounter", "--request-json", JSON.stringify(body));
      if (!result.ok) throw new Error(JSON.stringify(result));
      return result.data;
    };
    cleanups.unshift(() => { for (const pid of owners) { try { process.kill(-pid, "SIGTERM"); } catch {} try { process.kill(pid, "SIGTERM"); } catch {} } });
    return {
      root, home, env, call, alpha, beta, request, space, consentProvider, projectRoot: alpha.directory, doc, arrival, human, agent,
      cleanup: () => { for (const clean of cleanups) { try { clean(); } catch {} } },
    };
  } catch (error) {
    for (const clean of cleanups) { try { clean(); } catch {} }
    throw error;
  }
}

/** Bind the ground through the real UI (the boot law is explicit binding). */
export {bindDefaultCentral} from "../editor-doc.mjs";
