// factory-objects (11-FACTORY §6, §7 F16): what Inspect opens in Factory —
// each object's own page, in place in the full-page centre with ← back,
// fields first, Show raw last — over the disposable ground and a real Pi
// conversation (isolated AIKIT_HOME), real kernel.
//
//   Work unit  — from the Map band's Open page: fields EQUAL the owner
//                inspection (concern, must change, checks passed / total).
//   Check      — from the unit page's relation: assertion, result.
//   Attempt    — from Live's Open attempt: agent, harness, model, status.
//   Tool call  — from a Trajectory tape row's Open: the shared tape-event page
//                re-read from the owner journal.
//   Agent      — from the attempt page's participant relation (the Agents
//                tab is the Position aperture).
//   F16        — Pop out asks the frame for the page's own window with the
//                SAME identity: the open event carries popOut and the page's
//                kind/ref/project; the encoded surface identity round-trips
//                (encode → decode) to that same object, and opening the
//                decoded identity in place ("docking back") shows the same
//                page, field for field. The native window itself is the
//                frame's route (Tauri window_detach, binding kind "object");
//                a browser walk cannot open one — named, not faked.
import {join} from "node:path";
import {bindDefaultCentral} from "../editor-doc.mjs";
import {enterFactory, factoryGround, recordOps} from "../lib/factory-ground.mjs";
import {makeSessions, SESSIONS} from "../lib/factory-session.mjs";
import {realProviderAuthorised, REAL_PROVIDER_SKIP_NOTE} from "../lib/walk-provider.mjs";

export async function setup(args) {
  const ground = await factoryGround(args);
  if (!realProviderAuthorised()) {
    return {...ground, realProviderSkipped: true,
      cleanup: () => ground.cleanup()};
  }
  let sessions;
  try {
    const projectRoot = join(ground.root, "Work", "Specimen");
    sessions = makeSessions({root: ground.root, projectRoot, projectId: "specimen-walk", env: ground.env});
    sessions.openPi(SESSIONS.review);
    await sessions.turn(SESSIONS.review, "Use your bash tool to run `ls`, then reply with one short sentence.");
    return {...ground, sessions, env: {...ground.env, AIKIT_HOME: sessions.env.AIKIT_HOME, OI_AIKIT_BIN: sessions.env.OI_AIKIT_BIN, OI_BIN: sessions.env.OI_BIN},
      cleanup: () => { sessions.stop(); setTimeout(() => ground.cleanup(), 1200); }};
  } catch (error) { sessions?.stop(); ground.cleanup(); throw error; }
}

const tail = ref => (ref ?? "").split(/[:/]/).filter(Boolean).pop();
async function fields(page) {
  const object = page.locator('main.factory-centre .object-page');
  await object.locator(".object-fields").waitFor({timeout: 30000});
  return object.evaluate(node => {
    const out = {title: node.querySelector(".object-title")?.textContent?.trim(), kind: node.getAttribute("data-object-kind"), ref: node.getAttribute("data-object-ref"), fields: {}};
    const dts = [...node.querySelectorAll(".object-fields > dt")];
    for (const dt of dts) out.fields[dt.textContent.trim()] = dt.nextElementSibling?.textContent?.trim();
    return out;
  });
}

export default async function run({page, baseUrl, check, shot, channel, log, provision: p}) {
  if (p.realProviderSkipped) {
    await page.goto(baseUrl); await channel("info");
    check(true, REAL_PROVIDER_SKIP_NOTE);
    return;
  }
  page.on("pageerror", error => log(`PAGE ERROR: ${error}`));
  recordOps(page);
  const S = p.specimen, A = S.runs.A, inspect = S.readings.inspect;
  await page.goto(baseUrl); await channel("info");
  await enterFactory(page, {channel, bindDefaultCentral, root: p.root, project: "Specimen"});
  const centre = page.locator("main.factory-centre");
  await page.waitForFunction(() => document.querySelectorAll(".fdesk .fdesk-card").length >= 3, null, {timeout: 90000});
  await centre.locator(`[data-run-card="${A.runRef}"]`).click();
  const runPage = centre.locator(`[data-run-page="${A.runRef}"]`);
  await runPage.waitFor();

  // Work unit
  const surveyRef = A.unitRefs["survey-section-order"];
  const survey = inspect.units.find(unit => unit.workflowUnitRef === surveyRef);
  await runPage.locator(`.fmap-unit[data-unit="${surveyRef}"] .fmap-unit-open`).click();
  await runPage.locator(`[data-unit-band="${surveyRef}"]`).getByRole("button", {name: "Open page"}).click();
  const unit = await fields(page);
  check(unit.kind === "factory-unit" && unit.title === survey.developmentalConcern && unit.fields["Must change"] === survey.requiredDifference && unit.fields["Required checks"] === `3 of ${survey.requiredVerification.length} passed` && unit.fields.Attempts === "1",
    "Work unit page: fields EQUAL the owner inspection (concern, must change, checks, attempts)", unit);
  check(await centre.locator(".object-raw").count() === 1 && !(await centre.locator(".object-raw").evaluate(node => node.open)), "Verbatim material sits only behind Show raw (closed)");
  await shot("unit-page");

  // F16: Pop out — the same identity, docked back field for field
  const popped = await page.evaluate(() => new Promise(resolve => {
    const on = event => { window.removeEventListener("oi:open-object", on); resolve(event.detail); };
    window.addEventListener("oi:open-object", on);
    document.querySelector("main.factory-centre .object-popout")?.click();
    setTimeout(() => resolve(null), 3000);
  }));
  check(popped?.popOut === true && popped.object.kind === unit.kind && popped.object.ref === unit.ref, "F16: Pop out asks the frame for the page's own window carrying the SAME identity (kind and ref)", {popped});
  // Dock back: leave the page, then open ONLY the popped identity (no copy
  // of the page travels) — the page re-reads the owner and is the same.
  await centre.getByRole("button", {name: "Back"}).click();
  await runPage.waitFor();
  await page.evaluate(object => window.dispatchEvent(new CustomEvent("oi:open-object", {detail: {object: {kind: object.kind, ref: object.ref, title: object.title, ...(object.project ? {project: object.project} : {})}, popOut: false}})), popped?.object);
  const docked = await fields(page);
  check(JSON.stringify(docked) === JSON.stringify(unit), "F16: docking the same identity back shows the same page, field for field (re-read from the owner)", {docked});
  check(await centre.locator(".object-page").count() === 1 && await page.locator("main.factory-centre .tab-strip").count() === 0, "In place: one object page, no pane tab bar (A4)");

  // Check (a relation on the unit page)
  await centre.locator(".object-relations .object-link").first().click();
  const checkPage = await fields(page);
  check(checkPage.kind === "factory-check" && survey.requiredVerification.includes(checkPage.title) && checkPage.fields.Result === "passed", "Check page: the assertion and its result from the owner's verification receipt", checkPage);
  await centre.getByRole("button", {name: "Back"}).click(); // → unit
  await centre.getByRole("button", {name: "Back"}).click(); // → run page
  await runPage.waitFor();

  // Attempt (Live → Open attempt)
  await runPage.getByRole("tab", {name: "Live", exact: true}).click();
  const reviewAttempt = inspect.attempts.find(attempt => attempt.status === "active");
  await runPage.locator(`.flive-row[data-leg="${reviewAttempt.workflowUnitRef}"]`).getByRole("button", {name: "Open attempt"}).click();
  const attempt = await fields(page);
  check(attempt.kind === "factory-attempt" && attempt.fields.Agent === tail(reviewAttempt.participant.agentRef) && attempt.fields.Harness === tail(reviewAttempt.body.harnessRef) && attempt.fields.Model === tail(reviewAttempt.body.modelRef) && attempt.fields.Status === "active",
    "Attempt page: agent, harness, model and status EQUAL the owner's attempt", attempt);
  await centre.getByRole("button", {name: "Back"}).click();

  // Tool call (Trajectory → a tape row's Open)
  await runPage.getByRole("tab", {name: "Trajectory", exact: true}).click();
  const reviewer = (await runPage.getByRole("combobox", {name: "Session"}).locator("option").allInnerTexts()).find(text => /^Reviewer/.test(text));
  await runPage.getByRole("combobox", {name: "Session"}).selectOption({label: reviewer});
  const runRow = runPage.locator('.ftraj .tape-row[data-verb="run"]').first();
  await runRow.waitFor({timeout: 60000});
  await runRow.locator(".tape-row-line").click();
  await runRow.getByRole("button", {name: "Open"}).click();
  const tool = await fields(page);
  check(tool.kind === "tape-event" && tool.title.startsWith("run ") && (tool.fields.Session ?? "") === SESSIONS.review, "Tool call page: the shared tape-event page, re-read from the owner journal", tool);
  await centre.getByRole("button", {name: "Back"}).click();

  // Agent (the attempt's participant → the agent's page in the centre). The
  // right panel's Agents tab is the Position aperture (WORLD-INHABITATION-V1
  // §4); an agent's profile page is reached from where the owner names the
  // agent — the attempt — or from a Position's page, never from a name list.
  await runPage.getByRole("tab", {name: "Live", exact: true}).click();
  await runPage.locator(`.flive-row[data-leg="${reviewAttempt.workflowUnitRef}"]`).getByRole("button", {name: "Open attempt"}).click();
  await fields(page);
  const agentLink = centre.locator(".object-relations li", {hasText: "agent"}).locator(".object-link").first();
  await agentLink.click();
  const agent = await fields(page);
  check(agent.kind === "factory-agent" && agent.fields.Identity === reviewAttempt.participant.agentRef, "Agent page: opened in the centre from the attempt's participant, identity EQUALS the owner's attempt", agent);
  await shot("agent-page");
}
