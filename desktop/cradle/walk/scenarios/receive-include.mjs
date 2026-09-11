// receive-include (6E, cut 1): the desktop receives a pending Return, reviews it
// against the document's exact current basis, and includes it — through Central's
// native receiving operations on the pinned ctrl candidate (PR #155 head b79232b),
// with real authenticated principals (host-supplied CENTRAL_NATIVE_TOKEN, never
// document JSON) and the owner's own revision checks refusing staleness verbatim.
//
// Owner provisioning (policy sources, authority grants, document, producer
// submit) is done owner-side exactly as the pinned PR's own integration test
// seeds it; the browser drive exercises the desktop consumer: the Returns tray,
// exact-basis acceptance, inclusion, and the stale-basis refusal.
import {execFileSync} from "node:child_process";
import {createHash} from "node:crypto";
import {mkdirSync, readFileSync, writeFileSync} from "node:fs";
import {join} from "node:path";
import {setup as sourceSetup} from "./editor.mjs";

const HUMAN_TOKEN="receive-walk-human-credential-not-a-real-secret";
const AGENT_TOKEN="receive-walk-agent-credential-not-a-real-secret";
const sha256=value=>createHash("sha256").update(value).digest("hex");

export async function setup(args) {
  const source = await sourceSetup(args);
  const ctrl = process.env.OI_CENTRAL_CTRL_BIN ?? "ctrl";
  const as = token => (action, input) => {
    const r = JSON.parse(execFileSync(ctrl, ["--root", source.root, "--json", "action", "run", action, JSON.stringify(input)], {encoding: "utf8", env: {...process.env, ...source.env, CENTRAL_NATIVE_TOKEN: token}}));
    if (!r.ok) throw new Error(`${action} refused: ${JSON.stringify(r.error ?? r)}`);
    return r.data;
  };
  const human = as(HUMAN_TOKEN), agent = as(AGENT_TOKEN);
  const project = "Editor", projectId = "editor-walk";

  // Owner-side seeding, mirroring the pinned PR's native integration test:
  // three root policy sources with their relations, two credentialed principals.
  const relationsPath = join(source.root, "Control/relations/source-relations.json");
  mkdirSync(join(source.root, "Control/relations"), {recursive: true});
  let relations;
  try {relations = JSON.parse(readFileSync(relationsPath, "utf8"));}
  catch {relations = {schema: "central.control.ground-relations/v1", project_id: "control:root", relations: []};}
  const grants = [
    {principal_ref: "human:walk", actor_kind: "human", token_sha256: sha256(HUMAN_TOKEN), scope_refs: ["control:root", `project:${projectId}`], actions: ["central.document.create", "central.document.mutate", "central.receiving.submit", "central.receiving.review", "central.receiving.include", "central.receiving.recover", "central.day.ensure"], expires_at_unix_seconds: 4000000000},
    {principal_ref: "agent:walk", actor_kind: "agent", token_sha256: sha256(AGENT_TOKEN), scope_refs: ["control:root", `project:${projectId}`], actions: ["central.document.create", "central.document.mutate", "central.receiving.submit", "central.receiving.review", "central.receiving.include", "central.receiving.recover", "central.day.ensure"], expires_at_unix_seconds: 4000000000},
  ];
  const policies = [
    ["placement.json", "work-placement-policy", {schema: "central.work-placement-policy/v1", scope_ref: "control:root", writable: [{path: "Work/Editor", class: "repository"}], enforcement: "native-actions", required_coverage: ["file-content"], lease_seconds: 300}],
    ["time.json", "civil-time-policy", {schema: "central.civil-time-policy/v1", scope_ref: "control:root", timezone: "Europe/London", day_boundary_minutes: 0, automatic_day_rollover: true}],
    ["authority.json", "native-action-authority", {schema: "central.native-action-authority/v1", scope_ref: "control:root", grants}],
  ];
  relations.relations = relations.relations ?? [];
  for (const [name, role, value] of policies) {
    const path = `Control/user/${name}`;
    writeFileSync(join(source.root, path), JSON.stringify(value, null, 2));
    const ref = `central:source:control:root:${path}`;
    if (!relations.relations.some(entry => entry.ref === ref)) relations.relations.push({ref, path, roles: [role], provenance: "human-adopted", standing: "architecture-contract", treatment: "projectcentral-user", recognition: "controlled-walk-fixture-not-personal-adoption", recorded_at_unix_seconds: 1});
  }
  writeFileSync(relationsPath, JSON.stringify(relations, null, 2));

  const policy = as("")("central.work.policy", {project});
  const doc = human("central.document.create", {project, kind: "flow", document_id: "doc:receive-walk", title: "Receive walk", expected_policy_revision: policy.revision, template_payload: {supplied: "value"}, fields: [{id: "walk-field", label: "Walk field", template_pointer: "/supplied"}]});
  const first = agent("central.receiving.submit", {project, producer_key: "producer:receive-walk", source_ref: doc.source.ref, document_id: doc.document_id, expected_source_revision: doc.revision.revision, occurred_at_unix_seconds: 42, task_ref: "task:receive-walk", session_ref: "session:receive-walk", proposal: {operation: "entry.add", entry_id: "entry:walk", contribution_id: "part:walk", html: "<p>Reviewed contribution from the receive-include walk</p>"}});
  if (first.record.status !== "pending") throw new Error(`first return arrived ${first.record.status}`);

  // The desktop (bridge) holds the HUMAN credential through the protected
  // process environment; review/include authenticate as human:walk.
  return {...source, env: {...source.env, CENTRAL_NATIVE_TOKEN: HUMAN_TOKEN}, doc, first, human, agent, cleanup: source.cleanup};
}

const documentVia=(p,token)=>JSON.parse(execFileSync(process.env.OI_CENTRAL_CTRL_BIN ?? "ctrl", ["--root", p.root, "--json", "action", "run", "central.document.read", JSON.stringify({project: "Editor", source_ref: p.doc.source.ref, document_id: p.doc.document_id})], {encoding: "utf8", env: {...process.env, ...p.env, CENTRAL_NATIVE_TOKEN: token}})).data;

export default async function run({page, baseUrl, check, shot, channel, provision: p}) {
  await page.goto(baseUrl);await channel("info");
  const nav = page.getByRole("complementary", {name: "World navigator"});
  if (!await nav.isVisible()) await page.keyboard.press("Meta+b");
  await nav.locator('[data-project-path="Work/Editor"]').click();

  const tray = nav.locator(".project-returns").first();
  await tray.waitFor();
  await page.waitForFunction(() => document.querySelector(".project-returns header small")?.textContent?.includes("1 in the receiving field"), null, {timeout: 20000});
  check((await tray.locator(".project-return .return-status").first().innerText()) === "pending", "A pending Return is visible in the project's receiving field before any human act");

  await tray.locator(".project-return").first().click();
  await tray.locator(".return-detail").waitFor();
  const detail = tray.locator(".return-detail");
  check((await detail.innerText()).includes("Agent — agent:walk"), "The return presents its real producer attribution");
  check((await detail.innerText()).includes("entry.add") && (await detail.innerText()).includes("Reviewed contribution from the receive-include walk"), "The exact proposed operation and content are shown before any decision");
  check((await detail.innerText()).includes(p.doc.revision.revision), "The return shows the exact basis revision it was proposed against");
  await shot("return-expanded-before-review");

  // Happy path first: review on the exact current basis and include.
  await tray.getByRole("button", {name: "Accept current basis"}).click();
  await page.waitForFunction(() => document.querySelector(".project-returns .return-detail")?.textContent?.includes("accepted by"), null, {timeout: 20000});
  await page.waitForFunction(() => document.querySelector(".project-return .return-status")?.textContent === "accepted", null, {timeout: 20000});
  check(true, "Explicit acceptance records the human reviewer and the exact reviewed basis");
  await shot("accepted-on-current-basis");

  await tray.getByRole("button", {name: "Include into the document"}).click();
  try {
    await page.waitForFunction(() => document.querySelector(".project-returns .return-detail")?.textContent?.includes("Included into the document."), null, {timeout: 20000});
  } catch {
    const alertText = await tray.getByRole("alert").innerText().catch(() => "no alert rendered");
    throw new Error(`include did not complete; the tray shows: ${alertText}`);
  }
  await page.waitForFunction(() => document.querySelector(".project-return .return-status")?.textContent === "included", null, {timeout: 20000});
  check(true, "Inclusion completes through the owner's revision-checked operation");

  const finalDoc = documentVia(p, HUMAN_TOKEN);
  const contributions = finalDoc.document.contributions;
  check(contributions.length === 1, "The document holds exactly the reviewed contribution");
  check(contributions[0].author_ref === "agent:walk" && contributions[0].display_role === "Agent" && contributions[0].reviewed_by === "human:walk", "Producer attribution and human review are carried as distinct native facts");
  check(finalDoc.revision.revision !== p.doc.revision.revision, "The document source revision advanced through inclusion");
  await shot("included-with-attribution");

  // Stale-basis refusal on a second return: the human accepts a basis that has
  // just been externally edited — the owner refuses with its own words, nothing
  // moves, and the refused basis is exactly what the tray showed.
  const second = p.agent("central.receiving.submit", {project: "Editor", producer_key: "producer:receive-walk-2", source_ref: p.doc.source.ref, document_id: p.doc.document_id, expected_source_revision: finalDoc.revision.revision, occurred_at_unix_seconds: 43, proposal: {operation: "field.append", field_id: "walk-field", contribution_id: "part:walk-2", html: "<p>Second reviewed contribution</p>"}});
  await tray.getByRole("button", {name: "Refresh returns"}).click();
  await page.waitForFunction(() => document.querySelector(".project-returns header small")?.textContent?.includes("2 in the receiving field"), null, {timeout: 20000});
  await tray.locator(".project-return").filter({hasText: "pending"}).first().click();
  await page.waitForFunction(() => document.querySelectorAll(".project-returns .return-detail").length === 1 && document.querySelector(".project-returns .return-detail")?.textContent?.includes("Second reviewed contribution"), null, {timeout: 20000});
  // The detail can render before its basis read lands; accepting a stale
  // basis only means something once the tray shows the basis it would accept.
  await page.waitForFunction(() => document.querySelector(".project-returns .return-detail")?.textContent?.includes("Current document basis"), null, {timeout: 20000});
  const sourcePath = join(p.root, "Work/Editor", p.doc.source.path);
  writeFileSync(sourcePath, readFileSync(sourcePath, "utf8") + "\n");
  await tray.getByRole("button", {name: "Accept current basis"}).click();
  const alert = tray.getByRole("alert");
  await alert.waitFor();
  check((await alert.innerText()).includes("reviewed target source changed"), "Accepting a stale basis is refused by the owner's exact revision check");
  const afterRefusal = documentVia(p, HUMAN_TOKEN);
  check(afterRefusal.document.contributions.length === 1, "A refused acceptance changes no document bytes");
  await shot("stale-basis-refusal");
}
