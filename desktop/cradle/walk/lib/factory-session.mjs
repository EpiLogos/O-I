// Real conversations for the Factory Trajectory / Tasks walks, in the
// disposable ground and a disposable AIKit home (AIKIT_HOME isolates the
// resident and store; nothing ambient is touched). One session space in
// Work/<project> — the specimen attempts' own `session-space/specimen` — with:
//   - the review attempt's session, driven through the EXISTING pi/GLM
//     harness for real turns (Pi journals carry owner timestamps and usage);
//   - the survey attempt's session, whose only provider is a process that
//     fails at once — a real owner journal with no owner timestamps (the
//     "Order" trajectory);
//   - a Direct conversation no run carries.
// Pattern: walk/scenarios/canvas-context.mjs (router pinning `oi aikit` to
// the AIKit binary under test, provider configure, encounter-start).
import {execFileSync} from "node:child_process";
import {chmodSync, writeFileSync} from "node:fs";
import {join} from "node:path";
import {walkPiArgv} from "./walk-provider.mjs";

export const SESSIONS = Object.freeze({
  review: "agent-session/specimen-review",
  survey: "agent-session/specimen-survey",
  direct: "agent-session/specimen-direct",
});
export const SPACE = "session-space/specimen";

export function makeSessions({root, projectRoot, projectId, env: baseEnv}) {
  const aikit = process.env.OI_AIKIT_BIN ?? join(process.env.HOME, ".local/bin/aikit");
  const router = join(root, "oi-owner-router.mjs");
  writeFileSync(router, `#!/usr/bin/env node\nimport {spawnSync} from "node:child_process";\nconst args = process.argv.slice(2);\nif (args[0] === "aikit") {\n  const child = spawnSync(${JSON.stringify(aikit)}, args.slice(1), {stdio: "inherit"});\n  process.exit(child.status ?? 1);\n}\nconst child = spawnSync("oi", args, {stdio: "inherit"});\nprocess.exit(child.status ?? 1);\n`);
  chmodSync(router, 0o755);
  const env = {...process.env, ...baseEnv, AIKIT_HOME: join(root, ".aikit-home"), OI_AIKIT_BIN: aikit, OI_BIN: router};
  const native = (...parts) => {
    try { return JSON.parse(execFileSync(aikit, ["--json", "session-space", "-C", projectRoot, ...parts], {encoding: "utf8", env})); }
    catch (error) { throw new Error(`native ${parts[0]} failed: ${String(error.output?.filter(Boolean).join(" ") ?? error.message).slice(0, 400)}`); }
  };
  const bind = JSON.parse(execFileSync(aikit, ["--json", "-C", projectRoot, "project", "bind", projectId, "--directory", projectRoot, "--no-default-skill-sets"], {encoding: "utf8", env}));
  if (!bind.ok) throw new Error(JSON.stringify(bind));
  const apply = preview => native("apply", "--preview-json", JSON.stringify(preview));
  apply(native("create", SPACE, "--label", "Specimen run sessions"));
  const intents = [{operation: "bind-project-context", binding: native("project-context")}];
  for (const [key, ref] of Object.entries(SESSIONS)) intents.push({operation: "attach-agent-session", attachment: {agent_session: ref, purpose: {review: "Review the declared section order", survey: "Survey where section order is decided", direct: "A direct question about the release notes"}[key], provenance: ["Explicit real Factory trajectory walk"]}});
  for (const intent of intents) apply(native("stage", "--space", SPACE, "--intent-json", JSON.stringify(intent)));
  native("encounter-configure", "--provider-json", JSON.stringify({id: "factory-walk-false", label: "Factory walk failing provider", argv: ["/usr/bin/false"]}));
  native("encounter-configure", "--provider-json", JSON.stringify({protocol: "pi-rpc", id: "factory-walk-pi", label: "Factory walk Pi (existing provider)", argv: walkPiArgv()}));
  const owner = native("encounter-start");
  if (!owner.ok) throw new Error(JSON.stringify(owner));
  const request = (session, action, fields = {}) => {
    const result = native("encounter", "--request-json", JSON.stringify({action, agent_session: session, ...fields}));
    if (!result.ok) throw new Error(`${action}: ${JSON.stringify(result).slice(0, 400)}`);
    return result.data;
  };
  const read = (session, after = 0) => request(session, "read", {after, limit: 512});
  // The draft is compare-and-swap: find the current revision by trying the
  // owner's own answer (a stale basis is refused with the current one).
  const draftText = (session, text) => {
    for (let basis = 0; basis < 64; basis++) {
      const result = native("encounter", "--request-json", JSON.stringify({action: "draft", agent_session: session, basis, text}));
      if (result.ok) return result.data.revision ?? result.data.draft_revision ?? basis + 1;
      const current = JSON.stringify(result).match(/"(?:current|revision|current_revision)"\s*:\s*(\d+)/);
      if (current) basis = Number(current[1]) - 1;
    }
    throw new Error("the owner refused every draft basis");
  };
  /** One real human turn: draft → prompt, then wait for the owner's TurnEnded. */
  const turn = async (session, text, {wait = true, timeoutMs = 240000} = {}) => {
    const before = read(session).events;
    const drafted = draftText(session, text);
    request(session, "prompt", {draft_revision: drafted});
    if (!wait) return;
    const deadline = Date.now() + timeoutMs;
    const lastBefore = before.length ? before[before.length - 1].cursor : 0;
    for (;;) {
      const events = read(session, lastBefore).events;
      if (events.some(event => JSON.stringify(event.event).includes("TurnEnded"))) return events;
      if (Date.now() > deadline) throw new Error(`no TurnEnded on ${session} within ${timeoutMs} ms`);
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
  };
  return {
    env, native, request, read, turn, owner,
    openPi: session => request(session, "open", {space: SPACE, provider: "factory-walk-pi", cwd: projectRoot}),
    openFailing: session => { try { return request(session, "open", {space: SPACE, provider: "factory-walk-false", cwd: projectRoot}); } catch (error) { return {failed: String(error)}; } },
    stop: () => { try { process.kill(-owner.data.pid, "SIGTERM"); } catch {} setTimeout(() => { try { process.kill(-owner.data.pid, "SIGKILL"); } catch {} }, 600); },
  };
}
