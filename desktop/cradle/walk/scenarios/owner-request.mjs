// owner-request: an Agent working in a NOW asks the person to decide, and the
// decision travels back. The Agent submits two request Returns through
// Central's native receiving — a question, and a proposal of work for Factory
// — with real credentials (host-supplied CENTRAL_NATIVE_TOKEN). The person
// meets both in the one Inbox, answers the question, and accepts the proposal
// with a note; acceptance commissions the Run through Factory's own intake and
// records that Run back on the item. The asking NOW then reads the answer,
// the note and the Run, and can archive because nothing it asked still waits.
//
// Owner provisioning (policy sources, grants, the NOW, the Factory source,
// the Agent's submissions) is done owner-side through the installed owner
// CLIs; the browser drive exercises the desktop consumer only.
import {execFileSync} from "node:child_process";
import {createHash} from "node:crypto";
import {mkdirSync, readFileSync, writeFileSync} from "node:fs";
import {join} from "node:path";
import {setup as sourceSetup} from "./editor.mjs";

const HUMAN_TOKEN="owner-request-walk-human-credential-not-a-real-secret";
const AGENT_TOKEN="owner-request-walk-agent-credential-not-a-real-secret";
const sha256=value=>createHash("sha256").update(value).digest("hex");
const PROPOSAL="Commission independent verification of the Mac shader uniform limit";
const QUESTION="Should the verifier run on Omarchy now, or wait for the Mac?";

export async function setup(args) {
  const source = await sourceSetup(args);
  try {
    const ctrl = process.env.OI_CENTRAL_CTRL_BIN ?? "ctrl";
    const factory = process.env.OI_FACTORY_BIN ?? "factory";
    const as = token => (action, input) => {
      const r = JSON.parse(execFileSync(ctrl, ["--root", source.root, "--json", "action", "run", action, JSON.stringify(input)], {encoding: "utf8", env: {...process.env, ...source.env, CENTRAL_NATIVE_TOKEN: token}}));
      if (!r.ok) throw new Error(`${action} refused: ${JSON.stringify(r.error ?? r)}`);
      return r.data;
    };
    const agent = as(AGENT_TOKEN), human = as(HUMAN_TOKEN);
    const project = "Editor", projectId = "editor-walk";
    const actions = ["central.receiving.submit", "central.receiving.review", "central.receiving.include", "central.receiving.recover", "central.now.allocate", "central.now.lifecycle"];
    const grants = [
      {principal_ref: "human:walk", actor_kind: "human", token_sha256: sha256(HUMAN_TOKEN), scope_refs: ["control:root", `project:${projectId}`], actions, expires_at_unix_seconds: 4000000000},
      {principal_ref: "agent:epii-walk", actor_kind: "agent", token_sha256: sha256(AGENT_TOKEN), scope_refs: ["control:root", `project:${projectId}`], actions, expires_at_unix_seconds: 4000000000},
    ];
    const relationsPath = join(source.root, "Control/relations/source-relations.json");
    mkdirSync(join(source.root, "Control/relations"), {recursive: true});
    let relations;
    try {relations = JSON.parse(readFileSync(relationsPath, "utf8"));}
    catch {relations = {schema: "central.control.ground-relations/v1", project_id: "control:root", relations: []};}
    relations.relations = relations.relations ?? [];
    for (const [name, role, value] of [
      ["placement.json", "work-placement-policy", {schema: "central.work-placement-policy/v1", scope_ref: "control:root", writable: [{path: "Work/Editor", class: "repository"}], enforcement: "native-actions", required_coverage: ["file-content"], lease_seconds: 300}],
      ["time.json", "civil-time-policy", {schema: "central.civil-time-policy/v1", scope_ref: "control:root", timezone: "Europe/London", day_boundary_minutes: 0, automatic_day_rollover: true}],
      ["authority.json", "native-action-authority", {schema: "central.native-action-authority/v1", scope_ref: "control:root", grants}],
    ]) {
      const path = `Control/user/${name}`;
      writeFileSync(join(source.root, path), JSON.stringify(value, null, 2));
      const ref = `central:source:control:root:${path}`;
      if (!relations.relations.some(entry => entry.ref === ref)) relations.relations.push({ref, path, roles: [role], provenance: "human-adopted", standing: "architecture-contract", treatment: "projectcentral-user", recognition: "controlled-walk-fixture-not-personal-adoption", recorded_at_unix_seconds: 1});
    }
    writeFileSync(relationsPath, JSON.stringify(relations, null, 2));

    // The project's own Factory source, set up by the owner CLI.
    const factorySource = JSON.parse(execFileSync(factory, ["project", "setup", join(source.root, "Work", project), "central-project:Editor", "--json"], {encoding: "utf8"}));

    // The Agent's working NOW, allocated through Central.
    const policy = as("")("central.work.policy", {project});
    const now = agent("central.now.allocate", {project, task_ref: "task:shader-verification", purpose: "Investigate the Mac shader crash and ask the person what needs deciding", expected_policy_revision: policy.revision});

    const question = agent("central.receiving.submit", {project, producer_key: "ask:verifier-placement", now_ref: now.now_ref,
      request: {kind: "question", subject: QUESTION, body: "Omarchy can reproduce the regression now but cannot claim Mac Metal; the Mac is busy until tomorrow.", options: ["Omarchy now", "Wait for the Mac"]}});
    const proposal = agent("central.receiving.submit", {project, producer_key: "propose:verify-shader", now_ref: now.now_ref,
      summary: "The producer's green receipt cannot verify the crash it claims to cover.",
      evidence_refs: ["central:path:walk:T/native-mac-shader-failure.json", "central:path:walk:T/metal/receipt.json"],
      request: {kind: "proposal", subject: PROPOSAL, body: "The receipt has no timestamp, no per-check results and no hash of the bundle that crashed.",
        proposed_owner_ref: "factory", proposal_ref: "factory:commission:independent-verification-native-mac-shader-uniform-limit"}});
    for (const received of [question, proposal]) if (received.record.status !== "pending" || received.record.kind !== "request") throw new Error(`request arrived ${received.record.kind}/${received.record.status}`);

    // The desktop holds the HUMAN credential through its protected process
    // environment; decisions authenticate as human:walk.
    return {...source, env: {...source.env, CENTRAL_NATIVE_TOKEN: HUMAN_TOKEN}, project, factory, factorySource, now, question, proposal, human, agent, as, cleanup: source.cleanup};
  } catch (error) { source.cleanup(); throw error; }
}

export default async function run({page, baseUrl, check, shot, channel, provision: p}) {
  await page.goto(baseUrl);await channel("info");
  const nav = page.getByRole("complementary", {name: "World navigator"});
  if (!await nav.isVisible()) await page.keyboard.press("Meta+b");
  const foot = page.locator("[data-left-foot]");
  await page.waitForFunction(() => document.querySelector("[data-inbox-badge]")?.textContent === "2", null, {timeout: 30000});
  check(true, "The Inbox badge counts the two requests waiting for the person");
  await foot.getByRole("button", {name: /^Inbox/}).click();
  const tray = page.getByRole("region", {name: "Inbox"});
  await tray.waitFor();
  await page.waitForFunction(() => document.querySelector(".left-inbox header small")?.textContent === "2 waiting", null, {timeout: 20000});
  const subjects = await tray.locator(".receiving-row .receiving-request-subject").allInnerTexts();
  check(subjects.some(text => text.startsWith("Question · ") && text.includes(QUESTION)) && subjects.some(text => text.startsWith("Proposal · ") && text.includes(PROPOSAL)),
    "Each request is named by what it asks, not by a document it would edit");
  await shot("two-requests-waiting");

  // The question: the offered answers are one click; the answer goes back.
  await tray.locator(".receiving-row", {hasText: QUESTION}).click();
  const detail = tray.locator(".receiving-request");
  await detail.waitFor();
  check((await detail.innerText()).includes("A question from agent:epii-walk"), "The question names the Agent asking it");
  check((await detail.innerText()).includes("the Mac is busy until tomorrow"), "The question carries its context");
  await detail.getByRole("button", {name: "Omarchy now"}).click();
  await detail.getByRole("textbox", {name: "Your answer"}).fill("Omarchy now; state plainly that it cannot claim Mac Metal.");
  await detail.getByRole("button", {name: "Answer"}).click();
  await page.waitForFunction(() => document.querySelector(".left-inbox .receiving-request .receiving-review")?.textContent === "Answered", null, {timeout: 20000});
  check((await detail.innerText()).includes("Your answer: Omarchy now; state plainly that it cannot claim Mac Metal."), "The recorded answer is shown where it was given");
  await page.waitForFunction(() => document.querySelector(".left-inbox header small")?.textContent === "1 waiting", null, {timeout: 20000});
  await shot("question-answered");

  // The proposal: evidence is reachable; acceptance commissions the Run.
  await tray.locator(".receiving-row", {hasText: PROPOSAL}).click();
  await page.waitForFunction(subject => document.querySelector(".left-inbox .receiving-request .receiving-request-subject")?.textContent === subject, PROPOSAL, {timeout: 20000});
  const proposalText = await detail.innerText();
  check(proposalText.includes("Accepting it commissions the work in Factory") && proposalText.includes("Evidence (2)"), "The proposal says what acceptance does and on what evidence");
  await detail.getByRole("textbox", {name: "A note back (optional)"}).fill("Verification only — no patch.");
  await shot("proposal-before-decision");
  await detail.getByRole("button", {name: "Accept and commission"}).click();
  try {
    await page.waitForFunction(() => document.querySelector(".left-inbox .receiving-request .receiving-review")?.textContent === "Commissioned in Factory", null, {timeout: 30000});
  } catch {
    throw new Error(`commissioning did not complete; the tray shows: ${await tray.getByRole("alert").innerText().catch(() => "no alert")}`);
  }
  const commissioned = await detail.innerText();
  const run = /Factory made (run:[0-9A-Z]+)/.exec(commissioned)?.[1];
  check(!!run, "The item shows the Run Factory made for it");
  await page.waitForFunction(() => document.querySelector(".left-inbox header small")?.textContent === "Nothing waiting", null, {timeout: 20000});
  check(!await page.locator("[data-inbox-badge]").count(), "Nothing waits once both are decided; the badge is gone");
  await shot("proposal-commissioned");

  // Owner-side truth, read back through the owners themselves.
  const read = p.as("");
  const proposal = read("central.receiving.read", {project: p.project, return_ref: p.proposal.return_ref});
  check(proposal.record.status === "included" && proposal.record.realisation?.ref === run && proposal.record.realisation.owner_ref === "factory" && proposal.record.review.note === "Verification only — no patch.",
    "Central records the acceptance, the person's note and Factory's Run as distinct facts");
  const commission = JSON.parse(execFileSync(p.factory, ["development", "commission-read", p.factorySource.statePath, `commission:inbox-${p.proposal.return_ref.split(":").pop()}`, "--json"], {encoding: "utf8"}));
  check(commission.commission?.runRef === run && commission.commission.request.participantRequirements[0].sourceRef === p.proposal.return_ref,
    "Factory's own reading holds the Run, commissioned from exactly the accepted item");
  const nowReading = read("central.now.read", {project: p.project, now_ref: p.now.now_ref});
  const back = Object.fromEntries(nowReading.returns.map(row => [row.return_ref, row]));
  check(back[p.question.return_ref]?.decision?.answer === "Omarchy now; state plainly that it cannot claim Mac Metal." && back[p.question.return_ref].settled === true,
    "The asking NOW reads the person's answer");
  check(back[p.proposal.return_ref]?.decision?.note === "Verification only — no patch." && back[p.proposal.return_ref].realisation?.ref === run && back[p.proposal.return_ref].settled === true,
    "The asking NOW reads the acceptance, the note and the Run");
  const closed = p.agent("central.now.lifecycle", {project: p.project, now_ref: p.now.now_ref, expected_revision: nowReading.revision.revision, expected_policy_revision: read("central.work.policy", {project: p.project}).revision, lifecycle: "closed"});
  const archived = p.agent("central.now.lifecycle", {project: p.project, now_ref: p.now.now_ref, expected_revision: closed.revision.revision, expected_policy_revision: read("central.work.policy", {project: p.project}).revision, lifecycle: "archived"});
  check(archived.record.lifecycle === "archived", "With nothing it asked still waiting, the NOW can archive");
}
