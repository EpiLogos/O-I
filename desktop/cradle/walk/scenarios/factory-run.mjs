// factory-run (11-FACTORY §3, §7 F6 F7 F8 F12 F13): the Run page over the
// disposable Factory ground (walk/lib/factory-ground.mjs), real kernel.
//
//   header — title = the commission purpose's first sentence, subtitle = the
//            purpose, facts line (state · project · started · units · Git
//            basis from the owner's telemetry), no refs; ⋯ holds Copy run
//            reference and Show raw (raw JSON only after asking).
//   F6     — a queued run with no attempts: Live says "Nothing is running.";
//            the primary action EQUALS the owner's first currently-applicable
//            native action (none on this cut — the gap is recorded).
//   F8     — a run with no work units: "This run has no work units yet.",
//            distinct from a read error.
//   F7     — the frontier unit is outlined (its ref EQUALS the owner build
//            view's frontier); selecting it opens the detail band whose
//            checks EQUAL the owner inspection's required verification with
//            states from its verification receipts; lane geometry is
//            two-sided (fork units share a column, gate bar spans the lanes
//            it holds) and stable across a viewport change.
//   Live   — one row per unit, statuses and harness · model EQUAL the owner's.
//   F12    — Handoff on the queued run: "Nothing has come back yet.", no
//            sections.
//   F13    — Handoff on run A: Recognise calls the owner's native
//            recognition; the owner's receipt shows and the owner's journey
//            reading now carries the recognition. Request changes / Request
//            evidence render only where a native operation applies (none —
//            recorded as the gap).
import {spawnSync} from "node:child_process";
import {bindDefaultCentral} from "../editor-doc.mjs";
import {enterFactory, factoryGround, near, recordOps, shotMatrix} from "../lib/factory-ground.mjs";

export async function setup(args) { return factoryGround(args); }

const firstSentence = text => text.trim().replace(/\s+/g, " ").replace(/[.]$/, "");
const tail = ref => (ref ?? "").split(/[:/]/).filter(Boolean).pop();
const ownerJson = (factory, args) => { const done = spawnSync(factory, [...args, "--json"], {encoding: "utf8"}); if (done.status !== 0) throw new Error(done.stderr); return JSON.parse(done.stdout); };

export default async function run({page, baseUrl, check, shot, channel, log, provision: p}) {
  page.on("pageerror", error => log(`PAGE ERROR: ${error}`));
  const ops = recordOps(page);
  const S = p.specimen, A = S.runs.A, B = S.runs.B, C = S.runs.C;
  const inspect = S.readings.inspect;
  await page.goto(baseUrl); await channel("info");
  await enterFactory(page, {channel, bindDefaultCentral, root: p.root, project: "Specimen"});
  const centre = page.locator("main.factory-centre");
  const desk = centre.locator(".fdesk");
  await page.waitForFunction(() => document.querySelectorAll(".fdesk .fdesk-card").length >= 3, null, {timeout: 90000});
  const openRun = async runRef => {
    if (await centre.locator("[data-run-page]").count()) await centre.getByRole("button", {name: "← Desk"}).click();
    await desk.locator(`[data-run-card="${runRef}"]`).click();
    await centre.locator(`[data-run-page="${runRef}"]`).waitFor({timeout: 30000});
    return centre.locator(`[data-run-page="${runRef}"]`);
  };
  const tab = async (runPage, name) => { await runPage.getByRole("tab", {name, exact: true}).click(); };

  // ---- F6: run B, queued, no attempts
  let runPage = await openRun(B.runRef);
  const actionsB = ownerJson(p.factory, ["action", "list", S.statePath, S.projectRef, B.runRef]);
  const applicableB = (actionsB.actions ?? actionsB).filter?.(action => action.currentlyApplicable) ?? [];
  const primaryB = await runPage.locator("[data-primary-action]").count();
  check(primaryB === applicableB.length && primaryB === 0, "F6: the primary action EQUALS the owner's first currently-applicable native action — the owner offers none for a queued run on this cut, so none is invented", {ownerApplicable: applicableB.map(action => action.label), rendered: primaryB, gap: "no native Start run action is projected (factory action list); starting is the attempt lifecycle's start-serial, which needs a situated participant and body the desktop cannot supply"});
  await tab(runPage, "Live");
  const liveEmpty = (await runPage.locator("[data-live-empty] p").first().innerText()).trim();
  check(liveEmpty === "Nothing is running.", "F6: Live on a queued run says \"Nothing is running.\"", {liveEmpty});
  await shot("f6-queued-live");
  // ---- F12: Handoff empty
  await tab(runPage, "Handoff");
  const handoffEmpty = (await runPage.locator("[data-handoff-empty] p").innerText()).trim();
  check(handoffEmpty === "Nothing has come back yet." && await runPage.locator(".fhandoff-section").count() === 0, "F12: Handoff with nothing returned says \"Nothing has come back yet.\" and renders no empty sections", {handoffEmpty});
  await shot("f12-handoff-empty");

  // ---- F8: run C, no units
  runPage = await openRun(C.runRef);
  await tab(runPage, "Map");
  const noUnits = (await runPage.locator('[data-map-empty="no-units"] p').innerText()).trim();
  const ownerCUnits = Object.values(C.runReading.runMap.nodes).filter(node => node.kind === "work").length;
  check(noUnits === "This run has no work units yet." && ownerCUnits === 0 && await runPage.locator('[role="alert"]').count() === 0, "F8: a run whose owner map has no work units says so — distinct from a read error (no alert)", {noUnits, ownerCUnits});
  await shot("f8-no-units");

  // ---- header on run A
  runPage = await openRun(A.runRef);
  const title = (await runPage.locator("[data-run-title]").innerText()).trim();
  const purpose = (await runPage.locator("[data-run-purpose]").innerText()).trim();
  const facts = (await runPage.locator("[data-run-facts]").innerText()).replace(/\s+/g, " ").trim();
  check(title === firstSentence(A.purpose) && purpose === A.purpose, "Header: title = the purpose's first sentence, subtitle = the owner's purpose", {title});
  await page.waitForFunction(() => /branch /.test(document.querySelector("[data-run-facts]")?.textContent ?? ""), null, {timeout: 30000}).catch(() => {});
  const factsNow = (await runPage.locator("[data-run-facts]").innerText()).replace(/\s+/g, " ").trim();
  const git = S.readings.telemetryInspect.reading.gitBasis;
  check(factsNow.startsWith("○ Queued · Specimen · started") && factsNow.includes("4 units") && factsNow.includes(`branch ${git.branch} (${git.worktreeClean ? "clean" : "dirty"})`), "Header facts: state · project · started · units · Git basis from the owner's telemetry", {facts: factsNow, ownerGit: {branch: git.branch, clean: git.worktreeClean}});
  const headerText = await runPage.locator(".frun-head").innerText();
  check(!/(run|project|journey|workflow-unit):[0-9A-Z]/.test(headerText), "No refs in the header", {sample: headerText.slice(0, 120)});
  check(await runPage.locator(".frun-raw").count() === 0, "Raw readings are not shown until asked");
  await runPage.getByRole("button", {name: "More run actions"}).click();
  const menuItems = (await page.getByRole("menuitem").allInnerTexts()).map(text => text.trim());
  check(menuItems.includes("Copy run reference") && menuItems.includes("Show raw"), "⋯ holds Copy run reference and Show raw", {menuItems});
  await page.getByRole("menuitem", {name: "Show raw"}).click();
  const raw = await runPage.locator(".frun-raw pre").innerText();
  check(raw.includes(A.runRef), "Show raw discloses the owner's readings verbatim (only after asking)");
  await runPage.getByRole("button", {name: "More run actions"}).click();
  await page.getByRole("menuitem", {name: "Hide raw"}).click();
  check(await runPage.locator(".frun-tabs [role=tab]").allInnerTexts().then(texts => texts.join("|")) === "Map|Trajectory|Live|Handoff", "Tabs are Map · Trajectory · Live · Handoff; nothing stacked below");

  // ---- F7: the map
  await tab(runPage, "Map");
  const frontierUnit = runPage.locator('.fmap-unit[data-frontier="true"]');
  await frontierUnit.waitFor({timeout: 30000});
  const frontierRef = await frontierUnit.getAttribute("data-unit");
  const ownerFrontier = S.readings.buildSnapshot.view.frontier.subjectRef;
  const border = await frontierUnit.evaluate(node => getComputedStyle(node).borderTopWidth);
  check(frontierRef === ownerFrontier && border === "2px" && await runPage.locator('.fmap-unit[data-frontier="true"]').count() === 1, "F7: exactly one unit is outlined (2px ink) and it EQUALS the owner build view's frontier", {frontierRef, ownerFrontier, border});
  const unitCount = await runPage.locator(".fmap-unit").count();
  check(unitCount === inspect.units.length, "Map: one lane card per owner work unit", {unitCount, owner: inspect.units.length});
  // Two-sided geometry: the fork (draft, review) share a column; the gate bar spans exactly their lanes.
  const box = async ref => runPage.locator(`.fmap-unit[data-unit="${ref}"]`).evaluate(node => { const r = node.getBoundingClientRect(); return {x: r.left, y: r.top, w: r.width, h: r.height}; });
  const draft = await box(A.unitRefs["draft-section-order"]), review = await box(A.unitRefs["review-section-order"]);
  const gate = await runPage.locator(".fmap-gate").evaluate(node => { const r = node.getBoundingClientRect(); return {x: r.left, top: r.top, bottom: r.bottom}; });
  const forkShared = near(draft.x, review.x) && !near(draft.y, review.y);
  const gateSpans = near(gate.top, Math.min(draft.y, review.y)) && near(gate.bottom, Math.max(draft.y + draft.h, review.y + review.h));
  check(forkShared && gateSpans, "F7 geometry: the fork's units share a column (x equal ±0.5px) on different lanes, and the gate bar spans exactly their lanes (top/bottom equal ±0.5px)", {draft, review, gate});
  const planeBefore = await runPage.locator(".fmap-plane").evaluate(node => ({w: node.getBoundingClientRect().width, h: node.getBoundingClientRect().height}));
  await page.setViewportSize({width: 900, height: 700}); await page.waitForTimeout(250);
  const planeAfter = await runPage.locator(".fmap-plane").evaluate(node => ({w: node.getBoundingClientRect().width, h: node.getBoundingClientRect().height}));
  const draftAfter = await box(A.unitRefs["draft-section-order"]), reviewAfter = await box(A.unitRefs["review-section-order"]);
  check(near(planeBefore.w, planeAfter.w) && near(planeBefore.h, planeAfter.h) && near(draftAfter.x - reviewAfter.x, 0) && near(draftAfter.y - reviewAfter.y, draft.y - review.y), "The lane geometry is stable across a viewport change (the map scrolls; it never reflows lanes)", {planeBefore, planeAfter});
  await page.setViewportSize({width: 1280, height: 820});
  await frontierUnit.locator(".fmap-unit-open").click();
  const band = runPage.locator(`[data-unit-band="${ownerFrontier}"]`);
  await band.waitFor();
  const bandChecks = await band.locator(".fmap-checks li").evaluateAll(nodes => nodes.map(node => ({text: node.textContent.replace(/ · .*$/, "").trim(), state: node.getAttribute("data-check-state")})));
  const ownerUnit = inspect.units.find(unit => unit.workflowUnitRef === ownerFrontier);
  const receipts = inspect.attempts.filter(attempt => attempt.workflowUnitRef === ownerFrontier).flatMap(attempt => attempt.verification ?? []);
  const ownerChecks = ownerUnit.requiredVerification.map(text => ({text, state: receipts.some(r => r.outcome === "failed" && r.obligations.includes(text)) ? "failed" : receipts.some(r => r.outcome === "passed" && r.obligations.includes(text)) ? "passed" : "outstanding"}));
  check(JSON.stringify(bandChecks) === JSON.stringify(ownerChecks), "F7: the selected unit's checks EQUAL the owner inspection (text and state from its verification receipts)", {bandChecks, ownerChecks});
  const bandText = await band.innerText();
  check(bandText.includes(ownerUnit.requiredDifference) && bandText.includes(ownerUnit.requiredReturn.contract), "The detail band carries the owner's required difference and required return");
  // The returned survey: every check passed, at its revision.
  await runPage.locator(`.fmap-unit[data-unit="${A.unitRefs["survey-section-order"]}"] .fmap-unit-open`).click();
  const surveyStates = await runPage.locator(`[data-unit-band="${A.unitRefs["survey-section-order"]}"] .fmap-checks li`).evaluateAll(nodes => nodes.map(node => node.getAttribute("data-check-state")));
  check(surveyStates.length === 3 && surveyStates.every(state => state === "passed"), "A returned unit's checks read passed from the owner's complete verification receipt", {surveyStates});
  await shotMatrix(page, shot, "factory-run-map", async () => {});

  // Open page (in place) and ← back.
  await runPage.locator(`[data-unit-band="${A.unitRefs["survey-section-order"]}"]`).getByRole("button", {name: "Open page"}).click();
  const objectPage = centre.locator('[data-object-page="factory-unit"] .object-page');
  await objectPage.waitFor({timeout: 30000});
  await objectPage.locator(".object-fields").waitFor({timeout: 30000});
  const objectTitle = (await objectPage.locator(".object-title").innerText()).trim();
  check(objectTitle === inspect.units.find(unit => unit.key === "survey-section-order").developmentalConcern, "Open page: the unit's own page opens in place with its concern as title", {objectTitle});
  await shot("unit-page");
  await objectPage.getByRole("button", {name: "Back"}).click();
  await centre.locator(`[data-run-page="${A.runRef}"]`).waitFor();

  // ---- Live
  runPage = centre.locator(`[data-run-page="${A.runRef}"]`);
  await tab(runPage, "Live");
  const legs = await runPage.locator(".flive-row").evaluateAll(nodes => Object.fromEntries(nodes.map(node => [node.getAttribute("data-leg"), node.getAttribute("data-leg-status")])));
  const ownerLegs = Object.fromEntries(Object.entries(inspect.legs).map(([ref, leg]) => [ref, leg.status ?? "not-started"]));
  check(JSON.stringify(Object.entries(legs).sort()) === JSON.stringify(Object.entries(ownerLegs).sort()), "Live: one row per unit, each leg status EQUALS the owner's", {legs, ownerLegs});
  const reviewBody = inspect.attempts.find(attempt => attempt.status === "active").body;
  const reviewRow = await runPage.locator(`.flive-row[data-leg="${A.unitRefs["review-section-order"]}"] .flive-body span`).first().innerText();
  check(reviewRow.trim() === `${tail(reviewBody.harnessRef)} · ${tail(reviewBody.modelRef)}`, "Live: harness · model come from the attempt body", {reviewRow});
  await shot("live");

  // ---- F13: Recognition through the owner
  await tab(runPage, "Handoff");
  const outcome = (await runPage.locator("[data-handoff-outcome]").innerText()).trim();
  check(outcome === A.returnSummary, "Handoff: Outcome is the owner's readable Return", {outcome: outcome.slice(0, 80)});
  const verifyHead = await runPage.locator(".fhandoff-section h3").allInnerTexts();
  check(await runPage.getByRole("button", {name: "Request changes"}).count() === 0 && await runPage.getByRole("button", {name: "Request evidence"}).count() === 0,
    "F13: Request changes / Request evidence are not offered — no native operation applies (recorded gap)", {gap: S.gaps, requestEvidenceOnReturn: S.requestEvidenceOnReturn?.refusal ?? null, sections: verifyHead});
  await shot("f13-before");
  await runPage.getByRole("button", {name: "Recognise", exact: true}).click();
  const receipt = runPage.locator("[data-recognition-receipt]");
  await receipt.waitFor({timeout: 30000});
  const recogniseOp = ops.find(op => op.op === "factory_owner" && op.kind === "recognise");
  const journey = ownerJson(p.factory, ["development", "journey", S.statePath, A.journeyRef]);
  const recorded = (journey.recognitions ?? []).find(link => link.subject_ref === A.returnRef);
  check(recogniseOp?.result === "factory_development_reading" && !!recorded && (await receipt.innerText()).startsWith("Recognised — the owner recorded it"),
    "F13: Recognise called the owner's native recognition — the owner's receipt shows, and the owner's journey now carries a Recognition of the Return", {recognition: recorded ?? null});
  await page.waitForFunction(() => document.querySelector("[data-state-recognition]")?.textContent === "Recognised", null, {timeout: 30000}).catch(() => {});
  const states = await runPage.locator("[data-handoff-states] span").allInnerTexts();
  check(states.join("|") === "Agent returned|Recognised|Git integration not recorded", "Agent completion, human recognition and Git integration read as three different states", {states});
  await shot("f13-recognised");
}
