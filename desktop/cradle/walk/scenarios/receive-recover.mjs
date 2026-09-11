// receive-recover (6E, cut 2): Returns reviewed, rejected, recovered — beside
// the OPEN document. The desktop renders the project's receiving field at the
// reading site (a strip under the open document), shows each proposal's exact
// document anchor, rejects a return through the owner's review operation,
// refuses to resurrect it, lands an inclusion that the filesystem refuses
// mid-flight (status `uncertain`, honestly recorded), and recovers it through
// the owner's central.receiving.recover — the recorded inclusion intent
// replayed, nothing re-authored.
//
// Owner provisioning and credentials are exactly the pinned PR #155 cut's
// (Central #155 head b79232b, host-supplied CENTRAL_NATIVE_TOKEN, never
// document JSON); the browser drive exercises the desktop consumer.
import {execFileSync} from "node:child_process";
import {createHash} from "node:crypto";
import {chmodSync, mkdirSync, readFileSync, writeFileSync} from "node:fs";
import {join} from "node:path";
import {setup as sourceSetup} from "./editor.mjs";

const HUMAN_TOKEN="recover-walk-human-credential-not-a-real-secret";
const AGENT_TOKEN="recover-walk-agent-credential-not-a-real-secret";
const sha256=value=>createHash("sha256").update(value).digest("hex");

export async function setup(args) {
  const source = await sourceSetup(args);
  const ctrl = process.env.OI_CENTRAL_CTRL_BIN ?? "ctrl";
  const as = token => (action, input) => {
    // A refusal exits non-zero with the structured response on stdout — the
    // owner's own refusal message must reach the walk verbatim.
    let raw;
    try {raw = execFileSync(ctrl, ["--root", source.root, "--json", "action", "run", action, JSON.stringify(input)], {encoding: "utf8", env: {...process.env, ...source.env, CENTRAL_NATIVE_TOKEN: token}});}
    catch (error) {raw = error.stdout?.toString() ?? "";}
    const r = JSON.parse(raw);
    if (!r.ok) throw new Error(`${action} refused: ${JSON.stringify(r.error ?? r)}`);
    return r.data;
  };
  const human = as(HUMAN_TOKEN), agent = as(AGENT_TOKEN);
  const project = "Editor", projectId = "editor-walk";

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
  const doc = human("central.document.create", {project, kind: "flow", document_id: "doc:receive-recover", title: "Receive recover", expected_policy_revision: policy.revision, template_payload: {supplied: "value"}, fields: [{id: "walk-field", label: "Walk field", template_pointer: "/supplied"}]});
  // The first return targets the document's exact field anchor; the human
  // will reject it beside the open document.
  const first = agent("central.receiving.submit", {project, producer_key: "producer:recover-walk", source_ref: doc.source.ref, document_id: doc.document_id, expected_source_revision: doc.revision.revision, occurred_at_unix_seconds: 42, proposal: {operation: "field.append", field_id: "walk-field", contribution_id: "part:rejected", html: "<p>Contribution the human will reject</p>"}});
  if (first.record.status !== "pending") throw new Error(`first return arrived ${first.record.status}`);

  return {...source, env: {...source.env, CENTRAL_NATIVE_TOKEN: HUMAN_TOKEN}, doc, first, human, agent, cleanup: source.cleanup};
}

const documentVia=(p,token)=>JSON.parse(execFileSync(process.env.OI_CENTRAL_CTRL_BIN ?? "ctrl", ["--root", p.root, "--json", "action", "run", "central.document.read", JSON.stringify({project: "Editor", source_ref: p.doc.source.ref, document_id: p.doc.document_id})], {encoding: "utf8", env: {...process.env, ...p.env, CENTRAL_NATIVE_TOKEN: token}})).data;

export default async function run({page,baseUrl,check,shot,channel,provision:p}) {
  const docPath=join(p.root,"Work/Editor",p.doc.source.path);
  await page.goto(baseUrl);await channel("info");
  const nav=page.getByRole("complementary",{name:"World navigator"});
  await nav.locator('[data-project-path="Work/Editor"]').click();
  await nav.getByRole("button",{name:"Editor: files",exact:true}).click();
  for(const folder of ["ProjectCentral/agents","ProjectCentral/agents/now","ProjectCentral/agents/now/flows"]) {
    await nav.locator(`[data-file-path="Work/Editor/${folder}"]`).click();
  }
  await nav.locator(`[data-file-path="Work/Editor/${p.doc.source.path}"]`).click();
  await page.locator(`.cm-content[data-source-ref="${p.doc.source.ref}"]`).waitFor({timeout:15000});

  // Returns render beside the OPEN document, with the exact document anchor.
  const strip=page.locator(".document-returns");
  await strip.waitFor();
  await page.waitForFunction(()=>document.querySelector(".document-returns header small")?.textContent?.includes("1 in the receiving field"),null,{timeout:20000});
  check(true,"Returns for the open document render beside it, at the reading site");
  await strip.locator(".document-return").first().click();
  const detail=strip.locator(".return-detail");await detail.waitFor();
  const detailText=await detail.innerText();
  check(detailText.includes("field.append")&&detailText.includes("field walk-field"),"The proposal shows its exact document anchor — the field it targets");
  check(detailText.includes("Agent — agent:walk")&&detailText.includes("Contribution the human will reject"),"The return presents its real producer attribution and exact content");
  await shot("return-beside-open-document");

  // Rejection beside the document: the owner records the human reviewer; the
  // document holds nothing; the rejected return cannot be included.
  await strip.getByRole("button",{name:"Reject"}).click();
  await page.waitForFunction(()=>document.querySelector(".document-returns .return-status")?.textContent==="rejected",null,{timeout:20000});
  check((await strip.locator(".return-detail").innerText()).includes("rejected by human:walk"),"The rejection records the human reviewer beside the document");
  const afterReject=documentVia(p,HUMAN_TOKEN);
  check(afterReject.document.contributions.length===0,"A rejected return contributes nothing to the document");
  let resurrectRefused="";
  const rejectedReading=p.human("central.receiving.read",{project:"Editor",return_ref:p.first.return_ref});
  try {p.human("central.receiving.include",{project:"Editor",return_ref:p.first.return_ref,expected_return_revision:rejectedReading.revision,expected_source_revision:afterReject.revision.revision});}
  catch(error){resurrectRefused=String(error);}
  check(resurrectRefused.includes("inclusion requires the authenticated accepting reviewer")||resurrectRefused.includes("unreviewed Return cannot be included"),"The owner refuses to include a rejected return — the desktop's own attempt is not the guard, the owner is",{error:resurrectRefused});
  await shot("rejected-beside-document");

  // A second return, accepted on the exact current basis; its inclusion is
  // refused by the filesystem mid-flight and lands `uncertain` — recorded,
  // never silently retried — then the owner's recover replays the recorded
  // intent once the environment allows it.
  const second=p.agent("central.receiving.submit",{project:"Editor",producer_key:"producer:recover-walk-2",source_ref:p.doc.source.ref,document_id:p.doc.document_id,expected_source_revision:afterReject.revision.revision,occurred_at_unix_seconds:43,proposal:{operation:"entry.add",entry_id:"entry:recover",contribution_id:"part:recovered",html:"<p>Contribution that recovers</p>"}});
  if(second.record.status!=="pending")throw new Error(`second return arrived ${second.record.status}`);
  await strip.getByRole("button",{name:"Refresh this document's returns"}).click();
  await page.waitForFunction(()=>document.querySelector(".document-returns header small")?.textContent?.includes("2 in the receiving field"),null,{timeout:20000});
  await strip.locator(".document-return").filter({hasText:"pending"}).first().click();
  await page.waitForFunction(()=>document.querySelector(".document-returns .return-detail")?.textContent?.includes("entry:recover"),null,{timeout:20000});
  check((await strip.locator(".return-detail").innerText()).includes("entry.add — entry entry:recover"),"The second return shows its exact entry anchor");
  await strip.getByRole("button",{name:"Accept current basis"}).click();
  await page.waitForFunction(()=>document.querySelector(".document-returns .return-detail")?.textContent?.includes("accepted by"),null,{timeout:20000});

  chmodSync(docPath,0o444);
  const bytesBeforeInclude=readFileSync(docPath,"utf8");
  await strip.getByRole("button",{name:"Include into the document"}).click();
  await page.waitForFunction(()=>document.querySelector(".document-returns .return-status.return-uncertain")!==null,null,{timeout:20000});
  check((await strip.locator(".return-detail").innerText()).includes("The owner recorded:"),"An inclusion the filesystem refuses lands `uncertain` with the owner's own record shown");
  await shot("inclusion-uncertain");
  check(readFileSync(docPath,"utf8")===bytesBeforeInclude,"The uncertain inclusion changed no document bytes");

  chmodSync(docPath,0o644);
  await strip.getByRole("button",{name:"Recover inclusion"}).click();
  await page.waitForFunction(()=>document.querySelector(".document-returns .return-status.return-included")!==null,null,{timeout:20000});
  check(true,"Recovery replays the owner's recorded inclusion intent once the environment allows it");
  await shot("inclusion-recovered");

  const finalDoc=documentVia(p,HUMAN_TOKEN);
  const contributions=finalDoc.document.contributions;
  check(contributions.length===1&&contributions[0].html.includes("Contribution that recovers"),"The document holds exactly the recovered contribution");
  check(contributions[0].author_ref==="agent:walk"&&contributions[0].display_role==="Agent"&&contributions[0].reviewed_by==="human:walk","Producer attribution and human review remain distinct native facts through recovery");
  check(finalDoc.revision.revision!==p.doc.revision.revision,"The document revision advanced through the recovered inclusion");

  // The project tray agrees — one receiving field, two registers, same facts.
  if(!await nav.isVisible())await page.keyboard.press("Meta+b");
  const tray=nav.locator(".project-returns").first();
  await tray.getByRole("button",{name:"Refresh returns"}).click();
  await page.waitForFunction(()=>document.querySelector(".project-returns header small")?.textContent?.includes("2 in the receiving field"),null,{timeout:20000});
  check(await tray.locator(".project-return").count()===2,"The project tray shows the same receiving field beside the navigator branch");
}
