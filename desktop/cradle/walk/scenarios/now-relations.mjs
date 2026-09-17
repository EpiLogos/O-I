// now-relations (queue cell 1): the desktop reads the NOWs its own records
// name. A return arrives carrying a now_ref; the tray and the record detail
// read that exact NOW through the owner (`central.now.read`) and render the
// owner's relations verbatim. Root register rides the explicit-null kernel
// convention; a record without a NOW renders none; a NOW that has left the
// ground renders the OWNER'S refusal verbatim.
//
// Owner provisioning mirrors the receive-include walk (policies, authority
// grants, document, producer submit) plus `central.now.allocate` — the
// operation that went live on installed ctrl 59bb901c19a5 together with
// `central.now.list`.
import {execFileSync} from "node:child_process";
import {createHash} from "node:crypto";
import {existsSync, mkdirSync, readFileSync, rmSync, writeFileSync} from "node:fs";
import {join, resolve} from "node:path";
import {setup as sourceSetup} from "./editor.mjs";

const HUMAN_TOKEN="now-walk-human-credential-not-a-real-secret";
const AGENT_TOKEN="now-walk-agent-credential-not-a-real-secret";
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

  // Owner-side seeding: the same three policy sources as receive-include,
  // two credentialed principals.
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
  const doc = human("central.document.create", {project, kind: "flow", document_id: "doc:now-walk", title: "NOW relations walk", expected_policy_revision: policy.revision, template_payload: {supplied: "value"}, fields: [{id: "walk-field", label: "Walk field", template_pointer: "/supplied"}]});

  // The project-register NOW: real participant/source relations the UI must
  // render verbatim.
  const allocated = human("central.now.allocate", {project, task_ref: "task:now-walk", purpose: "now-relations walk clearing", expected_policy_revision: policy.revision, participant_refs: ["agent:walk", "human:walk"], source_refs: [doc.source.ref]});
  const now = human("central.now.read", {project, now_ref: allocated.record.now_ref});
  if (now.record.lifecycle !== "active") throw new Error(`allocated NOW lifecycle ${now.record.lifecycle}`);
  // The NOW's source lives inside the walk's own scratch ground; resolve its
  // absolute path now so the refusal case can remove exactly that file.
  const nowSourceCandidates = [join(source.root, "Work/Editor", now.source.path), join(source.root, now.source.path)];
  const nowSourcePath = nowSourceCandidates.find(candidate => existsSync(candidate));
  if (!nowSourcePath) throw new Error(`allocated NOW source not found at ${nowSourceCandidates.join(" or ")}`);

  // A second NOW in the ROOT register: the explicit-null kernel route reads
  // it; a project-scoped read must refuse.
  const rootPolicy = as("")("central.work.policy", {});
  const rootAllocated = human("central.now.allocate", {task_ref: "task:now-root", purpose: "root register clearing", expected_policy_revision: rootPolicy.revision, participant_refs: ["human:walk"], source_refs: []});
  const rootNow = human("central.now.read", {now_ref: rootAllocated.record.now_ref});

  // The first return carries the project NOW's ref; a second return carries
  // no NOW at all.
  const first = agent("central.receiving.submit", {project, producer_key: "producer:now-walk", source_ref: doc.source.ref, document_id: doc.document_id, expected_source_revision: doc.revision.revision, occurred_at_unix_seconds: 42, now_ref: now.record.now_ref, task_ref: now.record.task_ref, proposal: {operation: "entry.add", entry_id: "entry:now-walk", contribution_id: "part:now-walk", html: "<p>Return naming its NOW clearing</p>"}});
  if (first.record.status !== "pending") throw new Error(`first return arrived ${first.record.status}`);
  agent("central.receiving.submit", {project, producer_key: "producer:now-walk-2", source_ref: doc.source.ref, document_id: doc.document_id, expected_source_revision: doc.revision.revision, occurred_at_unix_seconds: 43, proposal: {operation: "field.append", field_id: "walk-field", contribution_id: "part:now-walk-2", html: "<p>Return without any NOW</p>"}});

  return {...source, env: {...source.env, CENTRAL_NATIVE_TOKEN: HUMAN_TOKEN}, doc, now, rootNow, nowSourcePath, human, agent, cleanup: source.cleanup};
}

export default async function run({page, baseUrl, check, shot, channel, log, provision: p}) {
  page.on("pageerror", error => log(`PAGE ERROR: ${error}`));
  page.on("console", message => {if (message.type() === "error") log(`console.error: ${message.text()}`);});
  await page.goto(baseUrl);await channel("info");
  const nav = page.getByRole("complementary", {name: "World navigator"});
  if (!await nav.isVisible()) await page.keyboard.press("Meta+b");
  await nav.locator('[data-project-path="Work/Editor"]').click();

  const tray = nav.locator(".project-returns").first();
  await tray.waitFor();
  await page.waitForFunction(() => document.querySelector(".project-returns header small")?.textContent?.includes("2 in the receiving field"), null, {timeout: 20000});
  const nowRow = tray.locator(".project-return.return-has-now");
  check(await nowRow.count() === 1 && (await nowRow.getAttribute("data-now-ref")) === p.now.record.now_ref, "Exactly one row marks the NOW it names, by the owner's ref");
  check(await tray.locator(".project-return:not(.return-has-now)").count() === 1, "A record without a NOW renders no NOW marker");

  // Kernel contract, driven through the walk seam before the UI assertions:
  // the explicit-null project is the root register; the project register
  // reads its own NOW; a cross-register read is refused by the owner.
  const projectRead = await channel("invoke.kernel_op", [{op: "now", project: "Editor", request: {kind: "read", now_ref: p.now.record.now_ref}}]);
  check(projectRead.data.outcome?.result === "now_reading" && projectRead.data.outcome?.data?.record?.task_ref === p.now.record.task_ref, "The kernel now route reads the project NOW through the owner");
  const rootRead = await channel("invoke.kernel_op", [{op: "now", project: null, request: {kind: "read", now_ref: p.rootNow.record.now_ref}}]);
  check(rootRead.data.outcome?.result === "now_reading" && rootRead.data.outcome?.data?.record?.task_ref === p.rootNow.record.task_ref, "The root register is read through the explicit-null convention");
  const crossRead = await channel("invoke.kernel_op", [{op: "now", project: "Editor", request: {kind: "read", now_ref: p.rootNow.record.now_ref}}], {soft: true});
  check(!crossRead.ok && !!crossRead.error, "A project-scoped read of a root-register NOW is refused — registers never blur");
  const listing = await channel("invoke.kernel_op", [{op: "now", project: "Editor", request: {kind: "list"}}]);
  const listedRefs = (listing.data.outcome?.data?.records ?? []).map(row => row.now_ref);
  check(listedRefs.includes(p.now.record.now_ref), "central.now.list through the kernel discloses the allocated NOW");

  // The record detail renders the OWNER'S relations verbatim — every value
  // asserted here is the owner's own reading, fetched in setup.
  await nowRow.click();
  const detail = tray.locator(".return-detail");
  // The panel's loading state matches .now-relations too — wait until the
  // owner's reading (or its refusal) has actually landed before asserting.
  await detail.locator(".now-relations[data-now-ref], .now-relations-refused").first().waitFor({timeout: 20000});
  const nowPanel = detail.locator(".now-relations");
  check((await nowPanel.getAttribute("data-now-ref")) === p.now.record.now_ref, "The NOW panel names the exact ref the record carried");
  const relationsText = await nowPanel.innerText();
  check(relationsText.includes(p.now.record.task_ref) && relationsText.includes(p.now.record.purpose), "Task and purpose render verbatim from the owner's reading");
  check(relationsText.includes(p.now.record.lifecycle) && relationsText.includes(p.now.revision.revision ?? p.now.revision), "Lifecycle and source revision render verbatim");
  check((await nowPanel.locator(`[data-now-participants='${JSON.stringify(p.now.record.participant_refs)}']`).count()) === 1, "Participants render exactly as the owner disclosed them");
  check((await nowPanel.locator(`[data-now-sources='${JSON.stringify(p.now.record.source_refs)}']`).count()) === 1, "Source relations render exactly as the owner disclosed them");
  check(await nowPanel.locator(`code:has-text("${p.now.record.source_refs[0]}")`).count() >= 1, "The record's own source appears among the NOW's relations");
  check((await nowPanel.locator(`[data-now-continuations='${JSON.stringify(p.now.record.continuation_refs)}']`).count()) === 1, "Continuations render exactly as the owner disclosed them — an empty relation reads as none, never invented");
  await nowPanel.evaluate(element => element.scrollIntoView({block: "center"}));
  await shot("now-relations-rendered");

  // Absence stays honest: the second record's detail carries no NOW panel.
  await tray.locator(".project-return:not(.return-has-now)").click();
  await page.waitForFunction(() => document.querySelectorAll(".project-returns .return-detail").length === 1 && document.querySelector(".project-returns .return-detail")?.textContent?.includes("Return without any NOW"), null, {timeout: 20000});
  check(await tray.locator(".return-detail .now-relations").count() === 0, "A record that names no NOW renders no NOW section at all");

  // A NOW that has left the ground: the owner's refusal renders verbatim,
  // never a desktop-fabricated absence. (The scratch ground is the walk's
  // own fixture; removing the NOW source is the honest way to make the read
  // fail through the owner rather than bypassing it.)
  rmSync(p.nowSourcePath, {force: false});
  await nowRow.click();
  await page.waitForFunction(() => document.querySelector(".project-returns .return-detail .now-relations-refused")?.hasAttribute("data-owner-refusal"), null, {timeout: 20000});
  const refusal = await tray.locator(".now-relations-refused").getAttribute("data-owner-refusal");
  check(!!refusal && refusal.length > 0, `The owner's own refusal is carried verbatim (${String(refusal).slice(0, 60)}…)`);
  await shot("now-refusal-verbatim");
}
