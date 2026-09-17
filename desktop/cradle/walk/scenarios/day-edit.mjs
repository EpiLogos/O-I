// day-edit (6F residue): the die face is no longer only a projection. The
// die's in-frame authored-field edits — the same [data-field] inputs the
// shell's own scripts track — write through the OWNER's own
// `central.document.mutate` `field.set` (human-only by owner law, CAS on the
// exact revision, deduplicated by request id). The face never writes whole
// bytes: the owner's document operations are the only Day write route. Edits
// to fields the owner has NOT mapped are disclosed and persist nowhere.
// After every landed field operation the surface re-reads the Day through the
// owner's own route (`central.day.read` — the root register's only reader),
// so external Day changes reach the open surface through the same
// "Re-read canonical" affordance, and an external byte-level edit is exactly
// what the owner's protection law refuses native mutation over — surfaced
// verbatim, reconciled by the same affordance.
//
// Installed Central frozen cut (5d1b8bf). Owner-side seeding runs through the
// real ctrl exactly as the owner's own operations require (credentials through
// the environment, never document JSON); the browser drive exercises the
// desktop consumer.
import {execFileSync} from "node:child_process";
import {createHash} from "node:crypto";
import {copyFileSync, mkdirSync, readFileSync, writeFileSync} from "node:fs";
import {dirname, join, resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {setup as sourceSetup} from "./editor.mjs";

const here=dirname(fileURLToPath(import.meta.url));
const DOCUMENTS=resolve(here,"..","..","documents");
const HUMAN_TOKEN="day-edit-walk-human-credential-not-a-real-secret";
const AGENT_TOKEN="day-edit-walk-agent-credential-not-a-real-secret";
const sha256=value=>createHash("sha256").update(value).digest("hex");
const QL_DOC_SCRIPT=/<script type="application\/json" id="ql-doc">([\s\S]*?)<\/script>/;

export async function setup(args) {
  const source = await sourceSetup(args);
  const ctrl = process.env.OI_CENTRAL_CTRL_BIN ?? "ctrl";
  const as = token => (action, input) => {
    let r;
    try {
      r = JSON.parse(execFileSync(ctrl, ["--root", source.root, "--json", "action", "run", action, JSON.stringify(input)], {encoding: "utf8", env: {...process.env, ...source.env, CENTRAL_NATIVE_TOKEN: token}}));
    } catch (error) {
      // A refused Action exits non-zero with the structured refusal on stdout.
      const body = error.stdout?.toString() ?? "";
      throw new Error(`${action} refused: ${body || String(error)}`);
    }
    if (!r.ok) throw new Error(`${action} refused: ${JSON.stringify(r.error ?? r)}`);
    return r.data;
  };
  const human = as(HUMAN_TOKEN), agent = as(AGENT_TOKEN), rootCall = as("");
  const project = "Editor", projectId = "editor-walk";

  // The supplied die, byte-exact, in the ground where the desktop's own
  // document-form resolution looks for it; its fingerprint is the committed one.
  const documentsDir = join(source.root, "Work", "O-I", "desktop", "cradle", "documents");
  mkdirSync(documentsDir, {recursive: true});
  copyFileSync(join(DOCUMENTS, "ql-daily-die.html"), join(documentsDir, "ql-daily-die.html"));
  copyFileSync(join(DOCUMENTS, "ql-dialogue-flow.html"), join(documentsDir, "ql-dialogue-flow.html"));
  const dieBytes = readFileSync(join(DOCUMENTS, "ql-daily-die.html"));
  if (sha256(dieBytes) !== "c8e81e8a03ce526ab1421908d5e45054fb1d76ea9a19572989061c7c8822bd64") throw new Error("the supplied die bytes drifted from the committed fingerprint");
  const diePayload = JSON.parse(dieBytes.toString("utf8").match(QL_DOC_SCRIPT)[1]);
  const dieKeys = Object.keys(diePayload.fields);
  if (dieKeys.length !== 17 || !dieKeys.includes("p3_patterns_noticed") || !dieKeys.includes("p0_quick_thoughts")) throw new Error(`the supplied die payload does not carry the seventeen fields (${dieKeys.length} found)`);

  const relationsPath = join(source.root, "Control/relations/source-relations.json");
  mkdirSync(join(source.root, "Control/relations"), {recursive: true});
  let relations;
  try {relations = JSON.parse(readFileSync(relationsPath, "utf8"));}
  catch {relations = {schema: "central.control.ground-relations/v1", project_id: "control:root", relations: []};}
  const grants = [
    {principal_ref: "human:walk", actor_kind: "human", token_sha256: sha256(HUMAN_TOKEN), scope_refs: ["control:root", `project:${projectId}`], actions: ["central.document.create", "central.document.mutate", "central.receiving.submit", "central.receiving.review", "central.receiving.include", "central.receiving.recover", "central.day.ensure", "central.day.lifecycle", "central.now.allocate", "central.now.lifecycle", "central.now.obligations"], expires_at_unix_seconds: 4000000000},
    {principal_ref: "agent:walk", actor_kind: "agent", token_sha256: sha256(AGENT_TOKEN), scope_refs: ["control:root", `project:${projectId}`], actions: ["central.document.create", "central.document.mutate", "central.receiving.submit", "central.receiving.review", "central.receiving.include", "central.receiving.recover", "central.day.ensure", "central.now.allocate", "central.now.lifecycle", "central.now.obligations"], expires_at_unix_seconds: 4000000000},
  ];
  const policies = [
    ["placement.json", "work-placement-policy", {schema: "central.work-placement-policy/v1", scope_ref: "control:root", writable: [{path: "Work/Editor", class: "repository"}], enforcement: "native-actions", required_coverage: ["file-content"], lease_seconds: 300}],
    ["authority.json", "native-action-authority", {schema: "central.native-action-authority/v1", scope_ref: "control:root", grants}],
    ["time.json", "civil-time-policy", {schema: "central.civil-time-policy/v1", scope_ref: "control:root", timezone: "Etc/GMT+12", day_boundary_minutes: 0, automatic_day_rollover: true}],
  ];
  relations.relations = relations.relations ?? [];
  for (const [name, role, value] of policies) {
    const path = `Control/user/${name}`;
    writeFileSync(join(source.root, path), JSON.stringify(value, null, 2));
    const ref = `central:source:control:root:${path}`;
    if (!relations.relations.some(entry => entry.ref === ref)) relations.relations.push({ref, path, roles: [role], provenance: "human-adopted", standing: "architecture-contract", treatment: "projectcentral-user", recognition: "controlled-walk-fixture-not-personal-adoption", recorded_at_unix_seconds: 1});
  }
  writeFileSync(relationsPath, JSON.stringify(relations, null, 2));

  const rootPolicyRevision = rootCall("central.work.policy", {}).revision;
  const time1 = human("central.time.policy", {});
  const day1 = human("central.day.ensure", {expected_time_policy_revision: time1.revision});
  if (!day1.created) throw new Error("the first Day ensure should have created today's blank carrier");
  // The native Day document: the SUPPLIED ql-doc payload verbatim and the
  // seventeen field keys as its fixtures — labels are the keys themselves,
  // mappings point into the payload; the owner refuses manufactured keys.
  const doc = human("central.document.create", {kind: "day", document_id: "day:day-edit", title: "Day-edit walk", day_ref: day1.day_ref, expected_revision: day1.revision.revision, expected_policy_revision: rootPolicyRevision, template_payload: diePayload, fields: dieKeys.map(key=>({id: key, label: key, template_pointer: `/fields/${key}`}))});

  return {...source, env: {...source.env, CENTRAL_NATIVE_TOKEN: HUMAN_TOKEN}, doc, day1, diePayload, dieKeys, human, agent, rootCall, cleanup: process.env.LEAVE_KEEP ? ()=>{} : source.cleanup};
}

const documentVia=(p,token)=>p.human("central.document.read",{source_ref: p.doc.source.ref, document_id: p.doc.document_id});
/** External byte-level edit: the Day source rewritten on disk, behind the
 * owners' back — exactly the external change the owner's protection law
 * answers. Returns the revision the owner discloses after re-reading it. */
const externalBytesEdit=(p,mutate)=>{
  const raw=readFileSync(join(p.root, p.doc.source.path), "utf8");
  const parsed=JSON.parse(raw);
  mutate(parsed);
  writeFileSync(join(p.root, p.doc.source.path), JSON.stringify(parsed, null, 2) + "\n");
  return p.human("central.document.read",{source_ref: p.doc.source.ref, document_id: p.doc.document_id});
};
/** The walk channel of this scenario's page. */
const chan=(p,path,...args)=>p.evaluate(async([path,args])=>{
  let channel=globalThis.__cradle?.walk;
  for(let i=0;i<100&&!channel;i++){await new Promise(resolve=>setTimeout(resolve,100));channel=globalThis.__cradle?.walk;}
  const fn=path.split(".").reduce((obj,key)=>obj?.[key],channel);
  if(typeof fn!=="function")throw new Error(`__cradle.walk.${path} is not mounted on this page`);
  return fn(...args);
},[path,args]);
const islandOf=async page=>JSON.parse(((await page.evaluate(() => document.querySelector(".die-face")?.getAttribute("srcdoc") ?? "")).match(QL_DOC_SCRIPT) ?? [])[1] ?? "null");

export default async function run({page, baseUrl, check, shot, channel, provision: p}) {
  await page.goto(baseUrl);await channel("info");
  const nav = page.getByRole("complementary", {name: "World navigator"});
  if (!await nav.isVisible()) await page.keyboard.press("Meta+b");

  // The Day opens through its OWNER route (the Today affordance) and its face
  // is the supplied die, projected from the owner's payload.
  await page.getByRole("button", {name: "Open today"}).click();
  await page.locator(".die-face").waitFor({timeout: 20000});
  await page.waitForFunction(() => (document.querySelector(".die-face")?.getAttribute("srcdoc") ?? "").includes("p0_quick_thoughts"), null, {timeout: 30000});
  check(true, "The native Day document opens at the root register and its face is the supplied die");
  const initial = await islandOf(page);
  check(JSON.stringify(initial.fields.p0_quick_thoughts ?? "") === JSON.stringify(p.diePayload.fields.p0_quick_thoughts ?? ""), "The projected island still opens exactly at the owner's payload");

  const die = page.frameLocator(".die-face");
  // The shell's own interaction law: a dot turns the cube, clicking the front
  // face OPENS it, and only the opened (.live) face takes editing input.
  const openFace = async (n, label) => {
    await die.locator(`button[role="tab"][aria-label="${label}"]`).click();
    await page.waitForTimeout(1400); // the turn animation (busy) settles
    // The shell opens the front face on a stage click whose coordinates its
    // own faceAt() raycast resolves — the stage centre is always the front
    // face's quad. Click there with the real mouse, retrying past any tail.
    for (let attempt = 0; attempt < 5; attempt++) {
      const stageBox = await die.locator("#stage").boundingBox();
      if (!stageBox) throw new Error("the die stage has no box");
      await page.mouse.click(stageBox.x + stageBox.width / 2, stageBox.y + stageBox.height / 2);
      try {
        await die.locator(`section.face[data-face="${n}"].live`).waitFor({timeout: 2500});
        return;
      } catch { await page.waitForTimeout(800); }
    }
    throw new Error(`face ${n} never opened (.live) after repeated open clicks`);
  };
  // The face's fields sit on a 3D-transformed cube: a synthesised pointer
  // click cannot reliably hit the projected quad, so the walk gives the field
  // its caret directly and types through the page's real keyboard. Every
  // input event, the shell's own handler, and the bridge are the real thing;
  // only the caret placement skips the pointer hit-test.
  const typeInto = async (selector, text) => {
    const target = die.locator(selector);
    await target.waitFor({timeout: 20000});
    await target.evaluate(el => { el.focus(); });
    const focused = await die.locator(selector).evaluate(el => document.activeElement === el);
    if (!focused) throw new Error(`could not focus ${selector} in the opened face`);
    await page.keyboard.type(text);
  };

  // --- Mapped edit 1: the human types into #0 Ground's quick thoughts ------
  await openFace(0, "#0 Ground");
  const groundText = "Ground captured through the die face.";
  await typeInto('[data-field="p0_quick_thoughts"]', groundText);
  await page.waitForFunction(() => !!document.querySelector(".die-face-sync-saving"), null, {timeout: 15000});
  check(true, "A mapped in-frame edit is composed for the owner's field operation (saving state disclosed)");
  await page.waitForFunction(() => !!document.querySelector(".die-face-sync-saved"), null, {timeout: 30000});
  const afterEdit1 = documentVia(p, HUMAN_TOKEN);
  const revOpen = p.doc.revision.revision;
  check(String(afterEdit1.document.template_payload.fields.p0_quick_thoughts).includes(groundText), "The typed text landed in the owner's payload through `central.document.mutate` field.set — the face never wrote bytes",
    {field: String(afterEdit1.document.template_payload.fields.p0_quick_thoughts).slice(0, 120)});
  check(afterEdit1.revision.revision !== revOpen, "The owner advanced the document revision for the field operation", {open: revOpen, now: afterEdit1.revision.revision});
  check(afterEdit1.document.operations.length === 1 && afterEdit1.document.operations[0].actor_ref === "human:walk", "The owner recorded exactly one field operation with its human actor");
  // The owner's authoritative readback reached the open surface: the buffer
  // re-read through the Day route, clean, at the owner's revision, and the
  // face re-projected from the owner's bytes.
  const state1 = (await chan(page, "read.state")).data;
  const buffer1 = Object.values(state1.buffers ?? {}).find(b => b.root_register);
  check(!!buffer1 && buffer1.base_revision === afterEdit1.revision.revision && buffer1.dirty === false && buffer1.content.includes(groundText), "The open surface re-read the Day through the owner's route — buffer clean at the owner's new revision",
    {bufferRevision: buffer1?.base_revision, owner: afterEdit1.revision.revision, dirty: buffer1?.dirty});
  await page.waitForFunction(text => (document.querySelector(".die-face")?.getAttribute("srcdoc") ?? "").includes(text), groundText, {timeout: 30000});
  await shot("day-edit-field-saved");

  // --- Mapped edit 2: a second field, serialised after the first -----------
  await openFace(0, "#0 Ground");
  const adjText = "An adjacency noted beside the ground.";
  await typeInto('[data-field="p0_adjacencies"]', adjText);
  await page.waitForFunction(() => !!document.querySelector(".die-face-sync-saving"), null, {timeout: 15000});
  await page.waitForFunction(() => (document.querySelector(".die-face-sync")?.textContent ?? "").includes("2 edited fields saved"), null, {timeout: 30000});
  const afterEdit2 = documentVia(p, HUMAN_TOKEN);
  check(String(afterEdit2.document.template_payload.fields.p0_adjacencies).includes(adjText) && afterEdit2.document.operations.length === 2, "A second mapped edit lands serialised on the owner's advanced revision — no stale crossfire between the face's own edits",
    {ops: afterEdit2.document.operations.length});

  // --- Unmapped edit: #5 Synthesis' blockers fold is the die's own field ----
  // (a real [data-field] the shell renders, but NOT one of the seventeen
  // fields the owner's document maps). It is disclosed; it persists nowhere.
  await openFace(5, "#5 Synthesis");
  // The blockers field lives inside the face's own closed fold; open the
  // fold by its own toggle state (fold toggling is the shell's concern —
  // the field's editing is this cell's subject).
  await die.locator('details.fold:has([data-field="p5_blockers"])').evaluate(el => { el.open = true; });
  await typeInto('[data-field="p5_blockers"]', "A blocker typed in the frame only.");
  await page.waitForFunction(() => !!document.querySelector(".die-face-sync-unmapped"), null, {timeout: 15000});
  const unmappedLine = await page.locator(".die-face-sync-unmapped").innerText();
  check(unmappedLine.includes("no owner field mapping") && unmappedLine.includes("do not persist"), "An edited region with no owner field mapping is disclosed as frame-only — never persisted silently",
    {line: unmappedLine.slice(0, 160)});
  const afterUnmapped = documentVia(p, HUMAN_TOKEN);
  check(Object.keys(afterUnmapped.document.template_payload.fields).length === 17 && !("p5_blockers" in afterUnmapped.document.template_payload.fields) && afterUnmapped.document.operations.length === 2, "The owner's payload still carries exactly the seventeen fields — the unmapped edit changed nothing",
    {keys: Object.keys(afterUnmapped.document.template_payload.fields).length, ops: afterUnmapped.document.operations.length});
  await shot("day-edit-unmapped-disclosed");

  // --- External change while the face is open; the Re-read affordance ------
  // A native field operation from OUTSIDE the desktop (the same human, the
  // same owner, no desktop involvement).
  const external = p.human("central.document.mutate", {source_ref: p.doc.source.ref, document_id: p.doc.document_id, expected_revision: afterUnmapped.revision.revision, request_id: "req/walk-external-aim", operation: "field.set", field_id: "p5_teleological_aim", value: "<p>The aim, set while the face was open.</p>"});
  check(external.operation_receipt.revision !== afterUnmapped.revision.revision, "An external owner field operation advances the document behind the open face");
  const staleFace = await islandOf(page);
  check(!String(staleFace.fields.p5_teleological_aim ?? "").includes("while the face was open"), "The open face still shows its arrival-time payload — the desktop never fabricates the external change");
  await page.locator(".source-reread-day").click();
  await page.waitForFunction(() => (document.querySelector(".die-face")?.getAttribute("srcdoc") ?? "").includes("while the face was open"), null, {timeout: 30000});
  const afterReread = (await chan(page, "read.state")).data;
  const buffer2 = Object.values(afterReread.buffers ?? {}).find(b => b.root_register);
  check(!!buffer2 && buffer2.base_revision === external.operation_receipt.revision && buffer2.dirty === false, "The Re-read canonical affordance pulls the external Day change through the owner's Day route — buffer clean at the owner's revision",
    {bufferRevision: buffer2?.base_revision, owner: external.operation_receipt.revision});
  // The re-projected face SHOWS the external value: open #5 and read the
  // rendered field the shell's own scripts materialised from the payload.
  await openFace(5, "#5 Synthesis");
  await die.locator('[data-field="p5_teleological_aim"]').filter({hasText: "while the face was open"}).waitFor({timeout: 20000});
  await shot("day-edit-external-reread");

  // --- External byte-level edit: the owner's protection law, verbatim ------
  // The relation's retained native revision only advances on native writes,
  // so after byte-level external change the owner refuses native field
  // operations until the human reconciles by its own review/migration routes.
  // The face surfaces that refusal verbatim and applies nothing; recovery is
  // the human's, through owner operations this cell does not invent.
  const afterExternalBytes = externalBytesEdit(p, parsed => {parsed.template_payload.fields.p0_quick_thoughts = "<p>External bytes over the ground.</p>";});
  check(afterExternalBytes.revision.revision !== external.operation_receipt.revision, "A byte-level external edit advances the source behind both the owner and the face");
  await page.locator(".source-reread-day").click();
  await page.waitForFunction(() => (document.querySelector(".die-face")?.getAttribute("srcdoc") ?? "").includes("External bytes over the ground"), null, {timeout: 30000});
  const afterByteReread = (await chan(page, "read.state")).data;
  const buffer3 = Object.values(afterByteReread.buffers ?? {}).find(b => b.root_register);
  check(!!buffer3 && buffer3.base_revision === afterExternalBytes.revision.revision && buffer3.dirty === false, "The Re-read affordance pulls the byte-level external change too — the face re-projects it, the buffer is clean at the owner's revision",
    {bufferRevision: buffer3?.base_revision, owner: afterExternalBytes.revision.revision});
  await openFace(0, "#0 Ground");
  const refusedText = "Typing into a protected Day.";
  await typeInto('[data-field="p0_quick_thoughts"]', refusedText);
  await page.waitForFunction(() => !!document.querySelector(".die-face-sync-refused"), null, {timeout: 20000});
  const refusedLine = await page.locator(".die-face-sync-refused").innerText();
  check(refusedLine.includes("external human/source edit is protected"), "With the basis current but the native relation behind, the owner refuses the field operation and the refusal surfaces verbatim",
    {refusal: refusedLine.slice(0, 220)});
  const afterRefused = documentVia(p, HUMAN_TOKEN);
  check(afterRefused.document.operations.length === 3 && !String(afterRefused.document.template_payload.fields.p0_quick_thoughts).includes(refusedText), "The refused operation is absent from the owner's record — nothing was applied behind the refusal",
    {ops: afterRefused.document.operations.length});
  await shot("day-edit-refusal-verbatim");
  const finalState = (await chan(page, "read.state")).data;
  const buffer4 = Object.values(finalState.buffers ?? {}).find(b => b.root_register);
  check(!!buffer4 && buffer4.base_revision === afterExternalBytes.revision.revision && buffer4.dirty === false, "The surface ends clean at the owner's own revision — the refusal changed nothing it should not");
}
