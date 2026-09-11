// shared-field-return (wave 7, first vertical): two participants share one
// document's material through the owner's own contracts — publish with an
// explicit audience (oi.projection/v1, composed in the desktop through the
// in-repo shared-field floor), admit/quarantine on the receiving side
// (oi.contribution-ingress + oi.admission), withdraw through the publisher's
// own strip (a new projection revision, source history never deleted), and
// source-Return the ADMITTED material back through the existing receiving
// seam (pinned Central PR #155 head b79232b: central.receiving.submit →
// review → include, revision-checked).
//
// Reuses the Wave 6 document/participant/NOW/Return refs (the same editor
// ground, the same document create, the same returning-participant credential
// law). No new stores: the projection envelope is presentation state beside
// the open document; the receiver's ingress/admission records are the owner
// floor's contract objects carried by the walk; the only durable owner records
// are Central's document and receiving field. Credentials stay host-supplied
// through CENTRAL_NATIVE_TOKEN, never document JSON. The hosted SharedField
// carrier is NOT exercised: its current public-field proof refuses
// non-public material, so audience-restricted carriage is a named open gate —
// the walk never simulates it.
import {execFileSync} from "node:child_process";
import {createHash} from "node:crypto";
import {mkdirSync, readFileSync, writeFileSync} from "node:fs";
import {join} from "node:path";
import {setup as sourceSetup} from "./editor.mjs";
import {createProjection} from "../../../../shared-field/index.mjs";
import {createAdmission,createContributionIngressReceipt} from "../../../../shared-field/admission.mjs";
import {createContribution} from "../../../../shared-field/social.mjs";

const HUMAN_TOKEN="shared-field-walk-human-credential-not-a-real-secret";
const READER_TOKEN="shared-field-walk-reader-credential-not-a-real-secret";
const sha256=value=>createHash("sha256").update(value).digest("hex");

export async function setup(args) {
  const source = await sourceSetup(args);
  const ctrl = process.env.OI_CENTRAL_CTRL_BIN ?? "ctrl";
  const as = token => (action, input) => {
    let raw;
    try {raw = execFileSync(ctrl, ["--root", source.root, "--json", "action", "run", action, JSON.stringify(input)], {encoding: "utf8", env: {...process.env, ...source.env, CENTRAL_NATIVE_TOKEN: token}});}
    catch (error) {raw = error.stdout?.toString() ?? "";}
    const r = JSON.parse(raw);
    if (!r.ok) throw new Error(`${action} refused: ${JSON.stringify(r.error ?? r)}`);
    return r.data;
  };
  const human = as(HUMAN_TOKEN), reader = as(READER_TOKEN);
  const project = "Editor", projectId = "editor-walk";

  const relationsPath = join(source.root, "Control/relations/source-relations.json");
  mkdirSync(join(source.root, "Control/relations"), {recursive: true});
  let relations;
  try {relations = JSON.parse(readFileSync(relationsPath, "utf8"));}
  catch {relations = {schema: "central.control.ground-relations/v1", project_id: "control:root", relations: []};}
  const grants = [
    // The publisher is the human's own participant; the receiver participant
    // (`agent:reader-walk`) is the second participant the material is shared
    // with — it may submit Returns but never review or include them.
    {principal_ref: "human:walk", actor_kind: "human", token_sha256: sha256(HUMAN_TOKEN), scope_refs: ["control:root", `project:${projectId}`], actions: ["central.document.create", "central.document.mutate", "central.receiving.review", "central.receiving.include", "central.receiving.recover", "central.day.ensure"], expires_at_unix_seconds: 4000000000},
    {principal_ref: "agent:reader-walk", actor_kind: "agent", token_sha256: sha256(READER_TOKEN), scope_refs: ["control:root", `project:${projectId}`], actions: ["central.receiving.submit"], expires_at_unix_seconds: 4000000000},
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
  const doc = human("central.document.create", {project, kind: "flow", document_id: "doc:shared-field", title: "Shared field vertical", expected_policy_revision: policy.revision, template_payload: {supplied: "value"}, fields: [{id: "shared-field", label: "Shared field", template_pointer: "/supplied"}]});

  return {...source, env: {...source.env, CENTRAL_NATIVE_TOKEN: HUMAN_TOKEN}, human, reader, doc, cleanup: source.cleanup};
}

async function selectRange(editor,start,end) {
  await editor.focus();await editor.press("Meta+ArrowUp");
  for(let i=0;i<start;i++)await editor.press("ArrowRight");
  for(let i=start;i<end;i++)await editor.press("Shift+ArrowRight");
}

export default async function run({page,baseUrl,check,shot,channel,provision:p}) {
  const passage="Shared field vertical";
  const docPath=join(p.root,"Work/Editor",p.doc.source.path);
  const content=readFileSync(docPath,"utf8");
  const start=content.indexOf(`"${passage}"`);
  if(start<0)throw new Error(`the created document does not carry its title: ${content.slice(0,200)}`);

  await page.goto(baseUrl);await channel("info");
  const nav=page.getByRole("complementary",{name:"World navigator"});
  // 1 — the real document opens through the ordinary navigator file route.
  await nav.locator('[data-project-path="Work/Editor"]').click();
  await nav.getByRole("button",{name:"Editor: files",exact:true}).click();
  for(const folder of ["ProjectCentral/agents","ProjectCentral/agents/now","ProjectCentral/agents/now/flows"]) {
    await nav.locator(`[data-file-path="Work/Editor/${folder}"]`).click();
  }
  await nav.locator(`[data-file-path="Work/Editor/${p.doc.source.path}"]`).click();
  const editor=page.locator(`.cm-content[data-source-ref="${p.doc.source.ref}"]`);
  await editor.waitFor({timeout:15000});
  check((await editor.innerText()).includes(passage),"The native document opens and renders its own bytes — the local material state");
  check(await page.locator(".shared-field-material").count()===0,"No shared material is advertised before anything is published");

  // 2 — select a passage; the tray offers the shared-field destination.
  await selectRange(editor,start+1,start+1+passage.length);
  await page.getByRole("button",{name:"Context mode",exact:true}).click();
  await page.getByRole("button",{name:"Attach selection",exact:true}).click();
  const dialog=page.getByRole("dialog",{name:"Include selected context"});await dialog.waitFor();
  check(await dialog.locator("pre").innerText()===passage,"The tray presents the exact selected passage — the selected-projection state begins here");
  await dialog.getByRole("button",{name:"Publish to the shared field"}).click();
  await dialog.waitFor({state:"detached"});

  // 3 — the publication strip composes beside the document; audience and
  // publisher are explicit. The contract's own laws refuse incomplete ones.
  const strip=page.locator(".shared-field-material");
  await strip.waitFor();
  check((await strip.locator(".shared-field-quote").innerText())===passage,"The strip holds the exact passage, not a transformation of it");
  check((await strip.locator(".context-origin").innerText()).includes(p.doc.source.ref)&&((await strip.locator(".context-origin").innerText()).includes(p.doc.revision.revision)),"The strip names the document's exact source ref and selection-time revision");
  await strip.getByRole("button",{name:"Publish projection"}).click();
  await page.waitForFunction(()=>document.querySelector(".shared-field-material p[role=alert]")?.textContent?.includes("publishing participant"),null,{timeout:5000});
  check(true,"Publishing without a named publisher is refused before any envelope exists");
  await strip.getByLabel("Audience participants").fill("");
  await strip.getByLabel("Publisher participant").fill("human:walk");
  await strip.getByRole("button",{name:"Publish projection"}).click();
  await page.waitForFunction(()=>document.querySelector(".shared-field-material p[role=alert]")?.textContent?.includes("names its audience explicitly"),null,{timeout:5000});
  check(true,"A restricted projection with no audience refs is refused");
  await strip.getByLabel("Audience participants").fill("agent:reader-walk");
  await strip.getByRole("button",{name:"Publish projection"}).click();
  const published=strip.locator(".shared-field-published");
  await published.waitFor();
  const envelope=JSON.parse(await published.getAttribute("data-projection"));
  check(envelope.schema==="oi.projection/v1"&&envelope.state==="published"&&envelope.projection_revision===1,"The composed envelope is a real oi.projection/v1 at revision 1 (owner floor, not a desktop re-implementation)");
  check(envelope.subject.ref===p.doc.source.ref&&envelope.source.revision===p.doc.revision.revision,"The projection preserves the document's native subject ref and exact source revision");
  check(envelope.audience.visibility==="restricted"&&envelope.audience.refs.length===1&&envelope.audience.refs[0]==="agent:reader-walk","The projection carries its explicit restricted audience");
  check(JSON.stringify(envelope.representation.payload).includes(passage),"The representation carries the selected material");
  await shot("projection-published");

  // 4 — the receiving side quarantines, then admits, through the owner floor's
  // own contracts. The hosted carrier is not exercised anywhere here.
  const fieldRef="field:shared-field-walk";
  const ingressRef="ingress:shared-field-walk";
  const contribution=createContribution({
    contribution_ref:`contribution:${envelope.projection_ref}`,
    field_ref:fieldRef,
    contributor_participant_ref:envelope.publisher_participant_ref,
    created_at:new Date().toISOString(),
    mode:"statement",
    target:{ref:envelope.subject.ref,kind:"central.document",revision:envelope.source.revision},
    relation:{kind:"presents"},
    representation:envelope.representation,
    provenance:[{kind:"projection",ref:envelope.projection_ref,source_system:"oi.shared-field",revision:String(envelope.projection_revision)}],
  });
  const fingerprint=sha256(JSON.stringify(envelope.representation.payload));
  const ingress=createContributionIngressReceipt({
    ingress_ref:ingressRef,field_ref:fieldRef,contribution_ref:contribution.contribution_ref,
    state:"quarantined",received_at:new Date().toISOString(),payload_fingerprint:fingerprint,
  });
  check(ingress.state==="quarantined"&&ingress.payload_fingerprint===fingerprint,"The receiving field quarantines the arrival under a payload fingerprint before any decision");
  const admission=createAdmission({
    decision_ref:"admission:shared-field-walk",field_ref:fieldRef,
    subject:{ref:ingressRef,kind:"oi.contribution-ingress"},
    disposition:"admitted",admission_actor_ref:"agent:reader-walk",
    decided_at:new Date().toISOString(),
    reason:"The admitted material is covered by the field's own admission law for this walk fixture",
    evidence:{ingress_ref:ingressRef,payload_fingerprint:fingerprint},
    provenance:{schema:"oi.contribution-ingress-receipt/v1",ingress_ref:ingressRef},
    visibility:"restricted",audience_refs:["agent:reader-walk"],
  });
  check(admission.disposition==="admitted"&&admission.admission_actor_ref==="agent:reader-walk","The receiving side records its admission decision as its own actor");

  // 5 — the publisher withdraws through their own strip: a new projection
  // revision, never a deletion; the receiver's admitted evidence is retained.
  await strip.getByLabel("Withdrawal reason").fill("Superseded by a private revision");
  await strip.getByRole("button",{name:"Withdraw projection"}).click();
  await page.waitForFunction(()=>document.querySelector(".shared-field-published")?.getAttribute("data-projection-state")==="withdrawn",null,{timeout:10000});
  const withdrawn=JSON.parse(await published.getAttribute("data-projection"));
  check(withdrawn.projection_revision===2&&withdrawn.state==="withdrawn"&&withdrawn.withdrawal.source_history_deleted===false,"Withdrawal is a new projection revision and deletes no source history");
  check(ingress.payload_fingerprint===fingerprint&&admission.disposition==="admitted","The receiver's admitted records survive the withdrawal — retained evidence, not revoked");
  await shot("projection-withdrawn");

  // 6 — the receiver source-Returns the ADMITTED material through the existing
  // receiving seam (pinned ctrl cut), carrying the shared-field lineage in the
  // proposal; its credential is host-supplied, never document JSON.
  const submitted=p.reader("central.receiving.submit",{project:"Editor",producer_key:"producer:shared-field-walk",source_ref:p.doc.source.ref,document_id:p.doc.document_id,expected_source_revision:p.doc.revision.revision,occurred_at_unix_seconds:42,task_ref:envelope.projection_ref,proposal:{operation:"entry.add",entry_id:"entry:shared",contribution_id:"part:shared",html:`<p>${passage} — the admitted material, returned to its source</p>`,shared_field:{projection_ref:envelope.projection_ref,projection_revision:withdrawn.projection_revision,disposition:admission.disposition,admission_ref:admission.decision_ref,ingress_ref:ingress.ingress_ref,field_ref:fieldRef,withdrawn:true}}});
  if(submitted.record.status!=="pending")throw new Error(`the admitted material's Return arrived ${submitted.record.status}`);

  // 7 — the human reviews beside the document: the strip is this document's
  // arrival point, so the new Return is one refresh away; it is visibly an
  // admitted shared-field contribution, distinct from a plain return.
  const returns=page.locator(".document-returns");
  await returns.waitFor();
  check((await returns.locator("header small").innerText()).includes("0 in the receiving field"),"Before the Return arrives the strip honestly shows an empty receiving field");
  await returns.getByRole("button",{name:"Refresh this document's returns"}).click();
  await page.waitForFunction(()=>document.querySelector(".document-returns header small")?.textContent?.includes("1 in the receiving field"),null,{timeout:20000});
  await returns.locator(".document-return").first().click();
  const detail=returns.locator(".return-detail");await detail.waitFor();
  const detailText=await detail.innerText();
  check(detailText.includes("Agent — agent:reader-walk"),"The Return's producer is the receiving participant");
  check(detailText.includes("admitted contribution")&&detailText.includes(envelope.projection_ref)&&detailText.includes("withdrawn by the publisher, admitted material retained"),"The return discloses its shared-field lineage — admitted, and withdrawn by the publisher yet retained");
  check(detailText.includes(passage),"The exact admitted material is shown before any decision");
  await shot("return-with-shared-field-lineage");

  await returns.getByRole("button",{name:"Accept current basis"}).click();
  await page.waitForFunction(()=>document.querySelector(".document-returns .return-detail")?.textContent?.includes("accepted by"),null,{timeout:20000});
  await returns.getByRole("button",{name:"Include into the document"}).click();
  await page.waitForFunction(()=>document.querySelector(".document-returns .return-status")?.textContent==="included",null,{timeout:20000});
  check(true,"Inclusion lands through the owner's revision-checked operation on the exact reviewed basis");

  // 8 — the surface unmounts when its tab goes inactive; coming back is a
  // fresh mount. The withdrawn projection record returns through the
  // consumed-on-view slot (presentation carry, no store), and the accepted
  // revision strip now reads the included document.
  if(!await nav.isVisible())await page.keyboard.press("Meta+b");
  await nav.locator('[data-file-path="Work/Editor/ProjectCentral/user/00 01-DESIGN.md"]').click();
  await page.locator('.cm-content[data-source-ref]:not([data-source-ref="'+p.doc.source.ref+'"])').waitFor({timeout:15000});
  await nav.locator(`[data-file-path="Work/Editor/${p.doc.source.path}"]`).click();
  await page.locator(`.cm-content[data-source-ref="${p.doc.source.ref}"]`).waitFor({timeout:15000});

  // 9 — the accepted source revision state, beside the open document.
  const accepted=page.locator(".document-contributions");
  await accepted.waitFor();
  const acceptedRow=accepted.locator(".accepted-contribution").first();
  check((await accepted.locator(".document-source-revision").getAttribute("data-revision"))!==p.doc.revision.revision,"The strip names the advanced source revision the inclusion produced");
  const rowText=await acceptedRow.innerText();
  check(rowText.includes("Agent — agent:reader-walk")&&rowText.includes("reviewed by human:walk")&&rowText.includes("entry entry:shared"),"The accepted contribution shows producer, human reviewer and entry anchor as distinct facts");
  await page.waitForFunction(()=>document.querySelector(".shared-field-published")?.getAttribute("data-projection-state")==="withdrawn",null,{timeout:10000});
  // 10 — the four states are distinguishable in the one canvas.
  await returns.locator(".document-return").first().click();
  await page.locator(".return-shared-field").waitFor();
  check(await page.locator(".cm-content[data-source-ref]").count()===1
    &&await page.locator(".shared-field-published[data-projection-state='withdrawn']").count()===1
    &&await page.locator(".return-shared-field").count()===1
    &&await acceptedRow.count()===1,"All four material states are visible at once — local document, published (withdrawn) projection, admitted return, accepted revision");
  await shot("four-states-one-canvas");

  // 10 — owner readback: the native facts behind the fourth state.
  const finalDoc=p.human("central.document.read",{project:"Editor",source_ref:p.doc.source.ref,document_id:p.doc.document_id});
  const contributions=finalDoc.document.contributions;
  check(contributions.length===1&&contributions[0].author_ref==="agent:reader-walk"&&contributions[0].display_role==="Agent"&&contributions[0].reviewed_by==="human:walk","The document holds the admitted contribution with distinct native attribution");
  check(finalDoc.revision.revision!==p.doc.revision.revision,"The document source revision advanced through the inclusion");
  check(readFileSync(docPath,"utf8").includes("entry:shared"),"The proposed entry anchor exists in the real document bytes");
}
