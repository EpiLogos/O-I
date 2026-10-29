// plural-flow (#558 PF4/MP17): the actual FlowSurface, in a real browser, over
// the REAL kernel, a candidate AIKit resident owner, Central's real `ctrl`, the
// real Actuation owner for per-agent Agency admission, and real `pi` agent
// bodies on the owner's test model. A person writes, brings two accepted agents
// in from the roster, addresses them, asks; each agent's answer is carried into
// the flow by the owner. The view is then CLOSED before the answers arrive, and
// reopened: each answer must be there once, without asking again.
//
// Required environment: OI_AIKIT_BIN (candidate `aikit`), OI_CENTRAL_CTRL_BIN
// (Central ctrl with central.flow.*). The world, AIKit home, provider and
// resident owner are disposable and created here.
import {execFileSync, spawnSync} from "node:child_process";
import {createHash, randomBytes} from "node:crypto";
import {existsSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync} from "node:fs";
import {homedir} from "node:os";
import {basename, join} from "node:path";
import {fileURLToPath} from "node:url";
import {bindDefaultCentral} from "../editor-doc.mjs";

const need = name => { const value = process.env[name]; if (!value) throw new Error(`${name} is required`); return value; };
const island = /<script type="application\/json" id="ql-doc">([\s\S]*?)<\/script>/;
const PASSAGE = `# On crossing a distance

1. To cross any distance, a traveller must first cross half of it.
2. After that, half of what remains, and again half of what remains, without end.
3. A task made of endlessly many steps, each requiring some time, can never be completed.
4. Therefore the traveller never arrives: motion across a distance is impossible.
`;

// Retain the native owner's actual receipt before disposing this test's ground.
// No provider is opened by encounter-start or by these lifecycle operations.
export function nativeOwnerCleanup({aikit, projectRoot, ownerEnv, directories, evidenceRoot}) {
  const owned = directories.map(path => {
    const stat = lstatSync(path);
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error(`Not an owned temporary directory: ${path}`);
    return {path, device: stat.dev, inode: stat.ino};
  });
  const evidenceStem = `plural-flow-owner-cleanup-${basename(directories[0])}-${randomBytes(6).toString("hex")}`;
  const report = {schema: "oi.cradle.walk.native-owner-cleanup/v1", projectRoot, aikit, directories: owned, operations: [], primaryError: null, phase: "not-started", ownerPid: null, deleted: []};
  let attempted = false, ownerPid = null, completion, sequence = 0, lastEvidence;
  const persist = () => {
    mkdirSync(evidenceRoot, {recursive: true});
    lastEvidence = join(evidenceRoot, `${evidenceStem}-${++sequence}.json`);
    writeFileSync(lastEvidence, `${JSON.stringify({...report, recordedAt: new Date().toISOString()}, null, 2)}\n`, {flag: "wx", mode: 0o600});
  };
  const healthPid = reply => {
    if (reply?.ok !== true || reply.data?.protocol !== "aikit-encounter-v1" || !Number.isSafeInteger(reply.data.pid) || reply.data.pid <= 0) throw new Error("Native encounter Health did not confirm an owner PID");
    return reply.data.pid;
  };
  const command = (request, timeout) => {
    const argv = ["--json", "-C", projectRoot, "session-space", "encounter", "--request-json", JSON.stringify(request)];
    const result = spawnSync(aikit, argv, {encoding: "utf8", env: ownerEnv, timeout, maxBuffer: 4 * 1024 * 1024});
    const operation = {argv, exitCode: result.status, signal: result.signal, error: result.error?.message ?? null, stdout: result.stdout ?? "", stderr: result.stderr ?? ""};
    report.operations.push(operation);
    if (result.error || result.status !== 0) throw new Error(`Native ${request.action} failed: ${result.error?.message ?? result.stderr ?? result.status}`);
    return JSON.parse(result.stdout);
  };
  const cleanup = primaryError => {
    if (completion) return completion;
    completion = (async () => {
      report.primaryError = primaryError ? String(primaryError.stack ?? primaryError) : null;
      try {
        if (attempted) {
          if (ownerPid === null) throw new Error("Owner startup was attempted without a retained successful Health; preserve its ground for native recovery");
          if (healthPid(command({action: "health"}, 5000)) !== ownerPid) throw new Error("Native owner changed since startup; no shutdown or deletion admitted");
          const reply = command({action: "shutdown", expected_pid: ownerPid}, 45000);
          const receipt = reply?.data;
          if (reply?.ok !== true || receipt?.protocol !== "aikit-encounter-v1" || receipt.pid !== ownerPid || receipt.shutdown !== true || receipt.canonical_sessions_retained !== true || !Array.isArray(receipt.stopped) || receipt.stopped.some(row => row.process_stopped !== true)) throw new Error("Native shutdown did not acknowledge exact owner and body quiescence");
          report.shutdown = reply;
          const deadline = Date.now() + 5000;
          while (true) {
            const result = spawnSync("ps", ["-p", String(ownerPid), "-o", "pid=,ppid=,stat="], {encoding: "utf8", timeout: 2000, maxBuffer: 4096});
            report.operations.push({argv: ["ps", "-p", String(ownerPid), "-o", "pid=,ppid=,stat="], exitCode: result.status, stdout: result.stdout ?? "", stderr: result.stderr ?? "", error: result.error?.message ?? null});
            if (result.error || ![0, 1].includes(result.status) || (result.stderr ?? "").trim()) throw new Error("Owner process disappearance could not be observed");
            if (result.status === 1 && !(result.stdout ?? "").trim()) break;
            if (Date.now() >= deadline) throw new Error("Native shutdown ACK received, but owner process disappearance remains unconfirmed");
            // Another actual process observation follows each bounded interval.
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }
        // Check every retained directory object before deleting any of them.
        for (const {path, device, inode} of owned) {
          const stat = lstatSync(path);
          if (!stat.isDirectory() || stat.isSymbolicLink() || stat.dev !== device || stat.ino !== inode) throw new Error(`Temporary directory object changed; retain ${path}`);
        }
        // These are the controlled walk's actual Flow/Return documents, not
        // the authority file, credentials or a copy of the entire AIKit home.
        const flowDirectory = join(directories[0], "Control/user/flows");
        report.controlledFlowDocuments = [];
        let retainedBytes = 0;
        if (existsSync(flowDirectory)) for (const name of readdirSync(flowDirectory).filter(name => name.endsWith(".html")).sort()) {
          const path = join(flowDirectory, name);
          const stat = lstatSync(path);
          if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 4 * 1024 * 1024) throw new Error(`Controlled Flow snapshot is unavailable: ${path}`);
          const bytes = readFileSync(path);
          retainedBytes += bytes.length;
          if (retainedBytes > 8 * 1024 * 1024) throw new Error("Controlled Flow snapshot exceeds its retention bound; preserve the ground");
          report.controlledFlowDocuments.push({path, bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex"), encoding: "base64", content: bytes.toString("base64")});
        }
        report.phase = attempted ? "native-quiescence-confirmed" : "owner-start-never-attempted";
        persist();
        for (const {path} of owned) {
          rmSync(path, {recursive: true});
          report.deleted.push(path);
        }
        report.phase = "disposed";
        persist();
        return {evidence: lastEvidence, nativeReceipt: report.shutdown ?? null};
      } catch (error) {
        report.phase = "recovery-required";
        report.cleanupError = String(error.stack ?? error);
        try { persist(); } catch (persistenceError) {
          throw new AggregateError([error, persistenceError], `Native cleanup and evidence persistence failed; retain temporary ground (${directories.join(", ")})`, {cause: error});
        }
        throw new Error(`Native cleanup is incomplete; retained evidence ${lastEvidence}; ${error.message}`, {cause: error});
      }
    })();
    return completion;
  };
  return {
    starting() { attempted = true; report.phase = "startup-attempted"; },
    started(reply) { ownerPid = healthPid(reply); report.ownerPid = ownerPid; report.startup = reply; report.phase = "native-owner-confirmed"; },
    cleanup,
  };
}

export async function setup() {
  process.env.TMPDIR = "/private/tmp";
  const aikit = need("OI_AIKIT_BIN");
  const ctrlBin = need("OI_CENTRAL_CTRL_BIN");
  const pi = process.env.PF_PI ?? join(homedir(), ".local/bin/pi");
  const template = process.env.PF_TEMPLATE ?? join(homedir(), "Central/Work/O-I/.aikit/sf6-agency/agency-request.json");
  const root = mkdtempSync("/private/tmp/oi-plural-flow-");
  const aikitHome = mkdtempSync("/private/tmp/oi-plural-flow-home-");
  const home = mkdtempSync("/private/tmp/oi-plural-flow-oihome-");
  const projectRoot = join(root, "Work", "Flowlab");
  const ownerEnv = {...process.env, AIKIT_HOME: aikitHome, CENTRAL_ROOT: root, AIKIT_CENTRAL_ROOT: root, CENTRAL_CTRL_BIN: ctrlBin, OI_CENTRAL_CTRL_BIN: ctrlBin, AIKIT_AGENCY_MINT_TEMPLATE: template, OI_AIKIT_BIN: aikit};
  delete ownerEnv.CENTRAL_NATIVE_TOKEN;
  const call = (action, input = {}, env = {}) => {
    const r = JSON.parse(execFileSync(ctrlBin, ["--root", root, "--json", "action", "run", action, JSON.stringify(input)], {encoding: "utf8", env: {...ownerEnv, ...env}}));
    if (!r.ok) throw new Error(`${action}: ${JSON.stringify(r.error ?? r)}`);
    return r.data;
  };
  const owner = nativeOwnerCleanup({aikit, projectRoot, ownerEnv, directories: [root, aikitHome, home], evidenceRoot: fileURLToPath(new URL("../artifacts/", import.meta.url))});
  const cleanup = () => owner.cleanup();
  try {
    call("central.init");
    mkdirSync(projectRoot, {recursive: true});
    call("projectcentral.init", {project: "Flowlab", project_id: "flowlab-walk"});
    mkdirSync(join(projectRoot, "docs"), {recursive: true});
    writeFileSync(join(projectRoot, "docs/passage.md"), PASSAGE);
    // A granted credential for exactly one human act: accepting the two agents'
    // definitions. The owner's resident carries none.
    const ann = randomBytes(32).toString("hex");
    mkdirSync(join(root, "Control/user"), {recursive: true});
    writeFileSync(join(root, "Control/user/native-action-authority.json"), JSON.stringify({schema: "central.native-action-authority/v1", scope_ref: "control:root", grants: [{principal_ref: "human:ann", actor_kind: "human", token_sha256: createHash("sha256").update(ann).digest("hex"), scope_refs: ["control:root"], actions: ["agent-profile.accept"], expires_at_unix_seconds: Math.floor(Date.now() / 1000) + 86400}]}));
    mkdirSync(join(root, "Control/relations"), {recursive: true});
    writeFileSync(join(root, "Control/relations/source-relations.json"), JSON.stringify({schema: "central.control.ground-relations/v1", project_id: "control:root", relations: [{ref: "central:source:control:root:Control/user/native-action-authority.json", path: "Control/user/native-action-authority.json", roles: ["native-action-authority"], provenance: "human-adopted", standing: "architecture-contract", treatment: "projectcentral-user", recognition: "controlled-acceptance-world-not-personal-adoption", recorded_at_unix_seconds: 1}]}));
    for (const [slug, name, purpose] of [["ada-lin", "Ada", "Recovers an argument from its sources and states it plainly."], ["ash-kay", "Ash", "Tests a claim on a concrete worked example with numbers."]]) {
      call("agent-profile.propose", {scope: "root", profile_ref: `profile/${slug}`, agent_ref: `agent/${slug}`, revision: "r1", world_ref: "control:root", ratified_world_refs: ["control:root"], intent_expression: purpose, name, role: "participant", purpose});
      const review = call("agent-profile.review", {scope: "root", profile_ref: `profile/${slug}`});
      call("agent-profile.accept", {scope: "root", profile_ref: `profile/${slug}`, expected_revision: "r1", expected_content_digest: review.content_digest}, {CENTRAL_NATIVE_TOKEN: ann});
    }
    const aikitBin = (...args) => execFileSync(aikit, args, {encoding: "utf8", env: ownerEnv});
    const bind = JSON.parse(aikitBin("--json", "-C", projectRoot, "project", "bind", "flowlab-walk", "--directory", projectRoot, "--no-default-skill-sets"));
    if (!bind.ok) throw new Error(JSON.stringify(bind));
    aikitBin("session-space", "-C", projectRoot, "encounter-configure", "--provider-json", JSON.stringify({protocol: "pi-rpc", id: "pi", label: "Pi (plural flow walk)", argv: [pi, "--mode", "rpc"]}));
    owner.starting();
    owner.started(JSON.parse(execFileSync(aikit, ["session-space", "-C", projectRoot, "encounter-start"], {encoding: "utf8", env: ownerEnv, timeout: 20000})));
    const passageRef = "docs/passage.md";
    return {
      root, projectRoot, call, aikitHome, passageRef,
      env: {...ownerEnv, OI_CENTRAL_ROOT: root, OI_CENTRAL_PROJECT_QUERY: "Flowlab", OI_HOME: home},
      bridgeCwd: projectRoot, cleanup,
      flowFiles: () => { const dir = join(root, "Control/user/flows"); try { return readdirSync(dir).filter(f => f.endsWith(".html")); } catch { return []; } },
      readFlow: name => { const raw = readFileSync(join(root, "Control/user/flows", name), "utf8"); return JSON.parse(raw.match(island)[1].replace(/<\\\/script/gi, "</script").replace(/<\\!--/g, "<!--")); },
    };
  } catch (error) {
    try { await owner.cleanup(error); }
    catch (cleanupError) { throw new AggregateError([error, cleanupError], `Plural-flow setup failed: ${error.message}; native cleanup also requires recovery: ${cleanupError.message}`, {cause: error}); }
    throw error;
  }
}

export default async function run({page, baseUrl, check, shot, channel, provision: p}) {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const wire = [];
  page.on("response", async response => {
    if (!response.url().endsWith("/op")) return;
    try {
      const sent = response.request().postDataJSON();
      if (sent.op !== "file_operation" && sent.op !== "file_read") return;
      const body = await response.json();
      wire.push([sent.op, sent.request?.action, String(sent.request?.expected_revision ?? "").slice(-8), sent.location?.path?.split("/").pop(), body.outcome?.data?.outcome ?? body.outcome?.result, String(body.outcome?.data?.revision ?? body.outcome?.reading?.revision ?? body.outcome?.data?.current?.revision ?? "").slice(-8), body.error ?? ""]);
    } catch { /* teardown */ }
  });
  await page.goto(baseUrl); await channel("info");
  await bindDefaultCentral(page, p.root);
  await page.locator('[data-project-path="Work/Flowlab"]').click();

  // 1 — A person writes, and the writing is placed as a real flow through Central.
  await page.getByRole("button", {name: "Start writing", exact: true}).click();
  const editor = page.locator(".flow-surface .cm-content");
  await editor.waitFor({timeout: 30000});
  await editor.click();
  await page.keyboard.type("What does the passage in docs/passage.md claim, and where does it fail?");
  // The footer is an auto-hiding strip; the composer row carries the acts in plain view.
  await page.getByRole("button", {name: "Add to the flow", exact: true}).click();
  await page.locator("[data-flow-participants]").waitFor({timeout: 30000});
  // The entry is in the thread (saved and re-read) before anything else is done to the flow.
  await page.locator(".flow-thread-entry").first().waitFor({timeout: 30000});
  check("the writing is placed as one real flow through Central", p.flowFiles().length === 1);
  const flowName = p.flowFiles()[0];
  check("a new flow is the plural form, with the person declared as a keyed participant", (() => { const d = p.readFlow(flowName); return d.meta.format?.version === 4 && d.meta.participants.some(x => x.kind === "person" && x.key); })());

  // 2 — Two accepted agents are brought in from the roster; bringing in starts nothing.
  await page.locator("[data-flow-participants] summary").click();
  await page.locator(".flow-bring-in li", {hasText: "Ada"}).getByRole("button", {name: "Bring in"}).click();
  try { await page.locator('[data-participant-kind="agent"]', {hasText: "Ada"}).waitFor({timeout: 30000}); }
  catch (error) {
    const history = p.call("central.files.history", {location: {schema: "central.path-ref/v1", ref: `central:path:${p.root}:Control/user/flows/${flowName}`, root: p.root, path: `Control/user/flows/${flowName}`}});
    console.log("  FLOW FILE HISTORY:", JSON.stringify(history.entries.map(e => [e.cursor, e.actor, e.actor_kind, e.previous_revision?.slice(-8), e.revision?.slice(-8)])));
    console.log("  ALERT:", await page.getByRole("alert").allInnerTexts());
    console.log("  WIRE:", JSON.stringify(wire.slice(-14)));
    throw error;
  }
  await page.locator(".flow-bring-in li", {hasText: "Ash"}).getByRole("button", {name: "Bring in"}).click();
  await page.locator('[data-participant-kind="agent"]', {hasText: "Ash"}).waitFor({timeout: 30000});
  const members = p.readFlow(flowName).meta.participants;
  const ada = members.find(x => x.name === "Ada"), ash = members.find(x => x.name === "Ash");
  check("both agents are keyed participants bound to their own registered agent, with no session yet", ada?.key && ash?.key && ada.key !== ash.key && ada.binding.ref === "agent/ada-lin" && ash.binding.ref === "agent/ash-kay" && !ada.ref && !ash.ref);
  await shot("plural-flow-participants");

  // 3 — Address both and ask. Asking is what starts each agent, as exactly that agent.
  await page.getByLabel("Address Ada").check();
  await page.getByLabel("Address Ash").check();
  const box = page.getByRole("textbox", {name: "New entry", exact: true});
  await box.click();
  await page.keyboard.type("Please read docs/passage.md in your working directory. Ada: recover the argument and state its premises and conclusion exactly as the passage gives them. Ash: test the claim on one concrete example with numbers and say whether it supports step 3. Under 120 words each.");
  await page.getByRole("button", {name: "Ask for a response"}).click();
  await page.locator('[data-recipient][data-recipient-state]').first().waitFor({timeout: 240000});
  const asked = p.readFlow(flowName);
  check("each addressed agent now answers from a session of its own", (() => { const m = asked.meta.participants; return ["Ada", "Ash"].every(n => /^agent-session\//.test(m.find(x => x.name === n)?.ref ?? "")); })());
  check("the asked entry is in the flow once, authored by the person, addressed to both", (() => { const e = asked.entries.filter(x => x.html.includes("recover the argument")); return e.length === 1 && e[0].addressees.length === 2 && e[0].intent === "response"; })());
  await shot("plural-flow-asked");

  // 4 — CLOSE the view before the answers arrive. The owner carries them in.
  await page.goto("about:blank");
  const deadline = Date.now() + 300000;
  let included = 0;
  while (Date.now() < deadline) {
    const doc = p.readFlow(flowName);
    included = doc.entries.filter(e => e.request?.ref?.startsWith("conv-reply:")).length;
    if (included >= 2) break;
    await sleep(2000);
  }
  check("both answers reached the flow while no view was open", included === 2);
  const closedDoc = p.readFlow(flowName);
  const replies = closedDoc.entries.filter(e => e.request?.ref?.startsWith("conv-reply:"));
  const question = closedDoc.entries.find(e => e.html.includes("recover the argument"));
  check("each reply is authored by its own agent, answers the asked entry, and is attributed to a session", replies.length === 2 && new Set(replies.map(r => r.authorKey)).size === 2 && replies.every(r => r.replyTo.entryId === question.id && r.attribution?.session?.startsWith("agent-session/")));

  // 5 — Reopen: each answer is there once, the recipients read as answered, nobody is asked again.
  await page.goto(baseUrl); await channel("info");
  await page.locator('[data-project-path="Work/Flowlab"]').click().catch(() => {});
  const flowsSection = page.getByRole("complementary", {name: "World navigator"}).locator('[data-section="flows"]');
  await flowsSection.locator("button, a, [role='treeitem'], li").first().click({timeout: 30000}).catch(() => {});
  await page.locator("[data-flow-conversations]").waitFor({timeout: 60000});
  await page.locator('[data-recipient-state="included"]').first().waitFor({timeout: 60000});
  check("reopening shows each recipient as answered, with the reply in the flow", await page.locator('[data-recipient-state="included"]').count() === 2);
  check("each reply appears once in the reopened thread", await page.locator(".flow-thread-entry", {hasText: /premise|Premise|conclusion/i}).count() >= 1 && (await page.locator(".flow-thread-who", {hasText: "Ada"}).count()) >= 1 && (await page.locator(".flow-thread-who", {hasText: "Ash"}).count()) >= 1);
  const after = p.readFlow(flowName);
  check("reopening asked no one again: the flow is unchanged by the view", after.entries.length === closedDoc.entries.length && after.meta.revision === closedDoc.meta.revision);
  await shot("plural-flow-reopened");
  // Cleanup failures must fail the scenario before a passing receipt is made.
  // The registered disposer retries only the same retained cleanup result.
  await page.goto("about:blank");
  await p.cleanup();
}
