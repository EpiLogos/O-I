// leave-reenter (6F): the durable pending Return beside the OPEN document —
// the native Day document carrying the SUPPLIED ql-doc format (the crafted
// 4+2 die's exact payload and its seventeen p0_…–p5_… field keys, recovered
// from the received bytes, never invented) — through a desktop close. While
// the desktop is closed the owners work headlessly: a late Day Return
// arrives, the human's clock policy advances the today pointer and creates
// the next blank Day carrier (never closing yesterday's writing), and the
// producer's task NOW is explicitly closed. Archiving it is REFUSED while
// the late Return is outstanding — the owner's own words name the obligation
// — and the desktop's reviewed inclusion of that Return is what settles it;
// archive then succeeds and explicit re-entry retains the NOW's identity.
// On re-entry the Day document (its die face re-projected from the owner's
// payload through the supplied shell) and the Flow come back with their
// owner identities intact, and the late Return lands through the owner's
// revision-checked operation on the exact pre-close basis with its original
// occurred/received times.
//
// Installed Central frozen cut (5d1b8bf). Owner-side seeding and the headless
// phase run through the real ctrl exactly as the owner's own operations
// require (credentials through the environment, never document JSON); the
// browser drive exercises the desktop consumer.
import {execFileSync} from "node:child_process";
import {createHash} from "node:crypto";
import {copyFileSync, mkdirSync, readFileSync, writeFileSync} from "node:fs";
import {dirname, join, resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {setup as sourceSetup} from "./editor.mjs";

const here=dirname(fileURLToPath(import.meta.url));
const DOCUMENTS=resolve(here,"..","..","documents");
const HUMAN_TOKEN="leave-walk-human-credential-not-a-real-secret";
const AGENT_TOKEN="leave-walk-agent-credential-not-a-real-secret";
const sha256=value=>createHash("sha256").update(value).digest("hex");
const civilDate=(timeZone)=>new Intl.DateTimeFormat("en-CA",{timeZone}).format(new Date());
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
  // document-form resolution looks for it — the same intake the
  // document-entry walk proves. Its fingerprints are the committed ones.
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
  // The clock starts behind (UTC-12) and is advanced mid-walk by REWRITING the
  // human's own policy source to a timezone ahead (UTC+14) — exactly the
  // "authorised clock policy" advancing the today pointer, one civil day.
  const writePolicy=(timezone)=>{
    writeFileSync(join(source.root, "Control/user/time.json"), JSON.stringify({schema: "central.civil-time-policy/v1", scope_ref: "control:root", timezone, day_boundary_minutes: 0, automatic_day_rollover: true}, null, 2));
  };
  const policies = [
    ["placement.json", "work-placement-policy", {schema: "central.work-placement-policy/v1", scope_ref: "control:root", writable: [{path: "Work/Editor", class: "repository"}], enforcement: "native-actions", required_coverage: ["file-content"], lease_seconds: 300}],
    ["authority.json", "native-action-authority", {schema: "central.native-action-authority/v1", scope_ref: "control:root", grants}],
  ];
  relations.relations = relations.relations ?? [];
  for (const [name, role, value] of policies) {
    const path = `Control/user/${name}`;
    writeFileSync(join(source.root, path), JSON.stringify(value, null, 2));
    const ref = `central:source:control:root:${path}`;
    if (!relations.relations.some(entry => entry.ref === ref)) relations.relations.push({ref, path, roles: [role], provenance: "human-adopted", standing: "architecture-contract", treatment: "projectcentral-user", recognition: "controlled-walk-fixture-not-personal-adoption", recorded_at_unix_seconds: 1});
  }
  writePolicy("Etc/GMT+12");
  if (!relations.relations.some(entry => entry.ref === "central:source:control:root:Control/user/time.json")) relations.relations.push({ref: "central:source:control:root:Control/user/time.json", path: "Control/user/time.json", roles: ["civil-time-policy"], provenance: "human-adopted", standing: "architecture-contract", treatment: "projectcentral-user", recognition: "controlled-walk-fixture-not-personal-adoption", recorded_at_unix_seconds: 1});
  writeFileSync(relationsPath, JSON.stringify(relations, null, 2));

  const rootPolicyRevision = rootCall("central.work.policy", {}).revision;
  const time1 = human("central.time.policy", {});
  const day1 = human("central.day.ensure", {expected_time_policy_revision: time1.revision});
  if (!day1.created) throw new Error("the first Day ensure should have created today's blank carrier");
  const dayA = civilDate("Etc/GMT+12");
  if (!day1.day_ref.includes(dayA)) throw new Error(`day ref ${day1.day_ref} does not name the seeded civil date ${dayA}`);
  // The native Day document: the SUPPLIED ql-doc payload verbatim and the
  // seventeen field keys as its fixtures — labels are the keys themselves,
  // mappings point into the payload; the owner refuses manufactured keys.
  // Human-created, replacing the EMPTY day bytes the owner just created.
  const doc = human("central.document.create", {kind: "day", document_id: "day:leave-reenter", title: "Leave-reenter Day", day_ref: day1.day_ref, expected_revision: day1.revision.revision, expected_policy_revision: rootPolicyRevision, template_payload: diePayload, fields: dieKeys.map(key=>({id: key, label: key, template_pointer: `/fields/${key}`}))});
  const allocated = human("central.now.allocate", {task_ref: "task:leave-reenter", purpose: "leave-reenter walk task", expected_policy_revision: rootPolicyRevision, source_refs: [doc.source.ref]});
  // A first Return arrives while the desktop is open, against the die's own
  // #0 capture fixture.
  const first = agent("central.receiving.submit", {producer_key: "producer:leave-walk-1", source_ref: doc.source.ref, document_id: doc.document_id, expected_source_revision: doc.revision.revision, occurred_at_unix_seconds: 1000, now_ref: allocated.now_ref, task_ref: "task:leave-reenter", day_ref: day1.day_ref, proposal: {operation: "field.append", field_id: "p0_quick_thoughts", contribution_id: "part:leave-1", html: "<p>Early capture from the leave-reenter producer</p>"}});
  if (first.record.status !== "pending") throw new Error(`first return arrived ${first.record.status}`);

  return {...source, env: {...source.env, CENTRAL_NATIVE_TOKEN: HUMAN_TOKEN}, doc, day1, diePayload, dieKeys, nowRef: allocated.now_ref, dayA, human, agent, rootCall, writePolicy, cleanup: process.env.LEAVE_KEEP ? ()=>{} : source.cleanup};
}

const ctrlRun=(p,token,action,input)=>{
  let r;
  const runOnce=()=>{
    try {
      return JSON.parse(execFileSync(process.env.OI_CENTRAL_CTRL_BIN ?? "ctrl", ["--root", p.root, "--json", "action", "run", action, JSON.stringify(input)], {encoding: "utf8", env: {...process.env, ...p.env, CENTRAL_NATIVE_TOKEN: token}}));
    } catch (error) {
      const body = error.stdout?.toString() ?? "";
      throw new Error(`${action} refused: ${body || String(error)}`);
    }
  };
  try {
    r = runOnce();
  } catch (first) {
    // Deterministic-vs-transient probe: one immediate retry of the exact
    // argv, with both outcomes recorded either way.
    let second;
    try { r = runOnce(); second = "retry ok"; }
    catch (again) { second = String(again).slice(0, 160); }
    throw new Error(`${first} | retry: ${second} | root=${p.root}`);
  }
  if (!r.ok) throw new Error(`${action} refused: ${JSON.stringify(r.error ?? r)}`);
  return r.data;
};
const dayReadVia=(p,token,dayRef)=>ctrlRun(p,token,"central.day.read",dayRef?{day_ref:dayRef}:{});
const documentVia=(p,token)=>ctrlRun(p,token,"central.document.read",{source_ref: p.doc.source.ref, document_id: p.doc.document_id});
/** The walk channel of a page this scenario opened itself (the runner's
 * `channel` helper is bound to the page it was given). Same receipt shapes. */
const chan=(p,path,...args)=>p.evaluate(async([path,args])=>{
  let channel=globalThis.__cradle?.walk;
  for(let i=0;i<100&&!channel;i++){await new Promise(resolve=>setTimeout(resolve,100));channel=globalThis.__cradle?.walk;}
  const fn=path.split(".").reduce((obj,key)=>obj?.[key],channel);
  if(typeof fn!=="function")throw new Error(`__cradle.walk.${path} is not mounted on this page`);
  return fn(...args);
},[path,args]);

export default async function run({page, baseUrl, check, shot, channel, bridgeUrl, provision: p}) {
  await page.goto(baseUrl);await channel("info");
  const nav = page.getByRole("complementary", {name: "World navigator"});
  if (!await nav.isVisible()) await page.keyboard.press("Meta+b");

  // --- Phase 1: a Flow the human leaves open ------------------------------
  await nav.locator('[data-project-path="Work/Editor"]').click();
  await page.waitForFunction(() => document.querySelector('[data-project-path="Work/Editor"]')?.getAttribute("aria-current") === "true", null, {timeout: 20000});
  await page.getByRole("button", {name: "Start writing", exact: true}).click();
  const writing = page.locator(".flow-surface .cm-content");
  await writing.waitFor({timeout: 20000});
  await writing.click();
  const flowText = "Re-entry must find this writing exactly here.";
  await page.keyboard.type(flowText);
  const flowRef = (await channel("read.focus")).data.subject?.ref;
  check(typeof flowRef === "string" && flowRef.startsWith("central:source:project:"), "The open Flow is a real project-register subject beside the Day document");
  await page.waitForFunction(t => [...document.querySelectorAll(".flow-surface .cm-content .cm-line")].map(l => l.textContent.replace(/\u00a0/g, " ")).join("\n") === t, flowText);

  // --- Phase 2: the open Day document, its die face, and its pending Return
  // The Day opens through its OWNER route — `central.day.read` discloses the
  // Day source's canonical ref, and the Today affordance opens exactly that.
  // (central.files.read discloses sources for project files only; a
  // root-register Day was never reachable as a source through the file tree.)
  await page.getByRole("button", {name: "Open today"}).click();
  const dieFrame = page.locator(".die-face");
  await dieFrame.waitFor({timeout: 20000});
  check(true, "The native Day document opens at the root register and its face is the supplied die, projected from the owner's payload");
  // The projection is verified against the srcdoc attribute — the canonical
  // embedded island — not the live DOM, where the die's own scripts may
  // initialise their working copy (uuid/date) as designed.
  const srcdoc = await page.evaluate(() => document.querySelector(".die-face")?.getAttribute("srcdoc") ?? "");
  // The owner's serde orders map keys its own way — compare content with
  // keys sorted, never key order.
  const canonical = value => {
    const sort = v => Array.isArray(v) ? v.map(sort)
      : (v && typeof v === "object" ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a < b ? -1 : 1).map(([k, inner]) => [k, sort(inner)])) : v);
    return JSON.stringify(sort(value));
  };
  const projectedIsland = JSON.parse((srcdoc.match(QL_DOC_SCRIPT) ?? [])[1] ?? "null");
  const projectedOk = projectedIsland !== null
    && canonical(projectedIsland) === canonical(p.diePayload);
  check(projectedOk, "The projected face carries the supplied ql-doc payload verbatim — the same seventeen fields the received bytes hold",
    projectedOk ? undefined : {srcdocLength: srcdoc.length, keys: projectedIsland ? Object.keys(projectedIsland.fields ?? {}).length : null, expectedKeys: Object.keys(p.diePayload.fields).length});
  const toggle = page.locator(".source-view-toggle");
  check(await toggle.getByRole("tab", {name: "Source"}).count() === 1, "The die face and the owner's source bytes are one surface with an explicit toggle, not two documents");
  await toggle.getByRole("tab", {name: "Source"}).click();
  // The owner's own bytes, as the kernel holds them (CodeMirror renders only
  // the scrolled viewport, so the DOM would virtualise the deeper keys away).
  const sourceState = (await channel("read.state")).data;
  const dayBuffer = Object.values(sourceState.buffers ?? {}).find(b => b.root_register);
  check(!!dayBuffer && dayBuffer.content.includes("p3_patterns_noticed") && dayBuffer.content.includes("central.contribution-document/v1"), "Source view holds the owner's own bytes — the payload keys are the real fixtures");
  await toggle.getByRole("tab", {name: "Rendered"}).click();
  await page.locator(".die-face").waitFor({timeout: 10000});

  const strip = page.locator(".document-returns");
  await page.waitForFunction(() => document.querySelector(".document-returns header small")?.textContent?.includes("1 in the receiving field"), null, {timeout: 20000});
  check(true, "The pending Return is beside the open Day document before any human act — the ROOT register's field");
  await strip.locator(".document-return").first().click();
  const detail = strip.locator(".return-detail");
  await detail.waitFor();
  const detailText = await detail.innerText();
  check(detailText.includes("Agent — agent:walk") && detailText.includes("field.append") && detailText.includes("field p0_quick_thoughts"), "The exact proposed operation and the die's own fixture key are shown on the Day document");
  check(detailText.includes("Occurred") && detailText.includes("Received"), "The Return carries its own occurred and received times");
  await shot("day-die-with-pending-return");

  await strip.getByRole("button", {name: "Accept current basis"}).click();
  await page.waitForFunction(() => document.querySelector(".document-returns .return-detail")?.textContent?.includes("accepted by"), null, {timeout: 20000});
  await strip.getByRole("button", {name: "Include into the document"}).click();
  await page.waitForFunction(() => document.querySelector(".document-returns .return-detail")?.textContent?.includes("Included into the document."), null, {timeout: 20000});
  const afterFirst = documentVia(p, HUMAN_TOKEN);
  check(afterFirst.document.contributions.length === 1 && afterFirst.document.contributions[0].field_id === "p0_quick_thoughts" && afterFirst.document.contributions[0].reviewed_by === "human:walk", "Reviewed inclusion lands the contribution at the die's exact fixture with native attribution");
  const revisionBeforeClose = afterFirst.revision.revision;
  await shot("day-die-first-inclusion");

  // --- Phase 3: the desktop closes; the owners work headlessly ------------
  // The re-entry page is created while the browser context is still alive
  // (a closed page takes its implicit context with it), with the same walk
  // bridge injected; it is not driven until after the close.
  const restoredUrl = page.url();
  const page2 = await page.context().newPage();
  await page2.setViewportSize?.({width: 1280, height: 820});
  const page2Errors = [];
  page2.on("pageerror", error => page2Errors.push(String(error).slice(0, 300)));
  if (bridgeUrl) await page2.addInitScript(url => { window.__OI_KERNEL_BRIDGE__ = url; }, bridgeUrl);
  await shot("before-leave");
  await page.close();

  // A late Return arrives for the die's #3 pattern fixture.
  const late = p.agent("central.receiving.submit", {producer_key: "producer:leave-walk-2", source_ref: p.doc.source.ref, document_id: p.doc.document_id, expected_source_revision: revisionBeforeClose, occurred_at_unix_seconds: 2000, now_ref: p.nowRef, task_ref: "task:leave-reenter", day_ref: p.day1.day_ref, proposal: {operation: "field.append", field_id: "p3_patterns_noticed", contribution_id: "part:leave-2", html: "<p>Late pattern noticed while the desktop was closed</p>"}});
  if (late.record.status !== "pending") throw new Error(`late return arrived ${late.record.status}`);

  // The human's clock policy advances one civil day; the today pointer moves
  // and the next blank carrier is created. Yesterday's writing stays open.
  p.writePolicy("Pacific/Kiritimati");
  const time2 = p.human("central.time.policy", {});
  const day2 = p.human("central.day.ensure", {expected_time_policy_revision: time2.revision});
  check(day2.today_advanced === true && day2.created === true && day2.prior_writing_closed === false, "The advanced clock policy advances today and creates the next blank Day without closing yesterday's writing");
  check(day2.day_ref !== p.day1.day_ref, "The new carrier is a distinct DayRef, not a rewrite of yesterday");

  // The producer's task NOW is explicitly closed; archiving it is REFUSED
  // while the late Return is outstanding — the owner names the obligation.
  const nowActive = p.human("central.now.read", {now_ref: p.nowRef});
  const closed = p.human("central.now.lifecycle", {now_ref: p.nowRef, expected_revision: nowActive.revision.revision, expected_policy_revision: p.rootCall("central.work.policy", {}).revision, lifecycle: "closed"});
  let archiveRefusal = "";
  try { p.human("central.now.lifecycle", {now_ref: p.nowRef, expected_revision: closed.revision.revision, expected_policy_revision: p.rootCall("central.work.policy", {}).revision, lifecycle: "archived"}); }
  catch (error) { archiveRefusal = String(error); }
  check(archiveRefusal.includes("outstanding receiving obligations") && archiveRefusal.includes(late.return_ref), "Archiving a NOW with an outstanding Return is refused and the refusal names that Return",
    {refusal: archiveRefusal.slice(0, 300) || "(no refusal — archive succeeded)"});

  // --- Phase 4: the desktop re-enters --------------------------------------
  await page2.goto(restoredUrl);
  await chan(page2, "info");
  const nav2 = page2.getByRole("complementary", {name: "World navigator"});
  if (!await nav2.isVisible()) await page2.keyboard.press("Meta+b");
  try {
    await page2.locator(".die-face").waitFor({timeout: 30000});
  } catch (timeout) {
    await page2.screenshot({path: join("walk", "artifacts", "leave-reenter-reentry-miss.png")}).catch(()=>{});
    const surfaceState = await page2.evaluate(errors => ({
      tabs: [...document.querySelectorAll('[role="tab"], .tab')].map(t => t.textContent?.slice(0, 30)),
      dieLoading: !!document.querySelector(".die-face-loading"),
      dieUnavailable: document.querySelector(".die-face-unavailable")?.textContent?.slice(0, 200) ?? null,
      surfaces: [...document.querySelectorAll("main .source-editor, main .material-frame")].length,
      storage: localStorage.getItem("oi-cradle.workspaces.v1")?.length ?? 0,
      recovery: !!document.querySelector(".workspace-recovery"),
      bodySummary: document.querySelector("main")?.textContent?.slice(0, 120) ?? "",
      pageErrors: errors.slice(0, 4),
    }), page2Errors);
    throw new Error(`${timeout} | re-entry state: ${JSON.stringify(surfaceState)}`);
  }
  // The projection commits with its srcdoc; wait for the island rather than
  // racing the commit. The owner's serde orders map keys its own way, so the
  // comparison is canonical (content, never key order).
  await page2.waitForFunction(() => (document.querySelector(".die-face")?.getAttribute("srcdoc") ?? "").includes("p0_quick_thoughts"), null, {timeout: 30000});
  check(true, "Re-entry restores the Day document and re-projects the die face from the owner's current payload");
  // The tab system unmounts inactive surfaces: activate the Flow's tab, then
  // assert the writing is exactly what was left.
  const flowTab = page2.locator('[role="tab"], .tab').filter({hasText: /2026-09-\d+-\d+\.md/}).first();
  await flowTab.waitFor({timeout: 20000});
  await flowTab.click();
  await page2.locator(".flow-surface .cm-content").waitFor({timeout: 30000});
  check((await page2.locator(".flow-surface .cm-content").innerText()).includes(flowText), "Re-entry restores the Flow's writing byte-for-byte — Day and Flow identity survive the leave");
  // Back to the Day's tab: the tab system unmounts inactive surfaces, so
  // the returns strip only exists while the Day document is the active tab.
  await page2.locator('[role="tab"], .tab').filter({hasText: "day.md"}).first().click();
  await page2.locator(".die-face").waitFor({timeout: 20000});
  const strip2 = page2.locator(".document-returns");
  try {
    await page2.waitForFunction(() => document.querySelector(".document-returns header small")?.textContent?.includes("2 in the receiving field"), null, {timeout: 20000});
  } catch (timeout) {
    const stripText = await page2.evaluate(() => document.querySelector(".document-returns")?.innerText?.slice(0, 300) ?? "(no strip)");
    const refNow = (await chan(page2, "read.state")).data;
    const dayBuf = Object.values(refNow.buffers ?? {}).find(b => b.root_register);
    throw new Error(`${timeout} | strip: ${JSON.stringify(stripText)} | dayRef=${dayBuf?.source_ref}`);
  }
  await strip2.locator(".document-return").filter({hasText: "pending"}).first().click();
  const detail2 = strip2.locator(".return-detail");
  await detail2.waitFor();
  const detail2Text = await detail2.innerText();
  check(detail2Text.includes("Late pattern noticed while the desktop was closed"), "The Return that arrived while the desktop was closed is beside the document on re-entry");
  check(detail2Text.includes(revisionBeforeClose), "The late Return still proposes against the exact pre-close basis");
  check(detail2Text.includes("field p3_patterns_noticed"), "The late Return names its exact die fixture");
  check(detail2Text.includes("Occurred") && detail2Text.includes("Received"), "The late Return keeps its original occurrence and receipt times");
  await page2.screenshot({path: join("walk", "artifacts", "leave-reenter-reentry-late-return.png")});

  // The reviewed inclusion of the late Return is also what settles the
  // outstanding obligation the archive named.
  await strip2.getByRole("button", {name: "Accept current basis"}).click();
  await page2.waitForFunction(() => document.querySelector(".document-returns .return-detail")?.textContent?.includes("accepted by"), null, {timeout: 20000});
  await strip2.getByRole("button", {name: "Include into the document"}).click();
  await page2.waitForFunction(() => document.querySelector(".document-returns .return-detail")?.textContent?.includes("Included into the document."), null, {timeout: 20000});
  const afterLate = documentVia(p, HUMAN_TOKEN);
  check(afterLate.document.contributions.length === 2 && afterLate.document.contributions[1].field_id === "p3_patterns_noticed" && afterLate.document.contributions[1].author_ref === "agent:walk" && afterLate.document.contributions[1].reviewed_by === "human:walk", "The late Return includes through the owner's revision-checked operation with full attribution");
  check(afterLate.document.lifecycle === "open", "Yesterday's Day document remains open through the boundary and the closure");

  // With the obligation settled, archive succeeds and re-entry retains identity.
  const nowClosed = p.human("central.now.read", {now_ref: p.nowRef});
  const archived = p.human("central.now.lifecycle", {now_ref: p.nowRef, expected_revision: nowClosed.revision.revision, expected_policy_revision: p.rootCall("central.work.policy", {}).revision, lifecycle: "archived"});
  const reentered = p.human("central.now.lifecycle", {now_ref: p.nowRef, expected_revision: archived.revision.revision, expected_policy_revision: p.rootCall("central.work.policy", {}).revision, lifecycle: "active"});
  check(reentered.record.now_ref === p.nowRef, "Explicit re-entry retains the task NOW's identity after archive");
  const day1Now = dayReadVia(p, HUMAN_TOKEN, p.day1.day_ref);
  check(day1Now.temporal.lifecycle === "open", "Yesterday's Day lifecycle is still open — the boundary never closed it");
  const todayNow = dayReadVia(p, HUMAN_TOKEN, null);
  check(todayNow.day_ref === day2.day_ref, "The today pointer names the new carrier while yesterday's document stays intact beside the human");
  await page2.screenshot({path: join("walk", "artifacts", "leave-reenter-reentry-included.png")});
}
