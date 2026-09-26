// factory-tasks (11-FACTORY §4, §7 F14 F15): the Tasks join, repaired. A
// conversation belongs to a run when its session appears in the run's
// executions, attempts or journey sessions — here the running review
// attempt's own session (a real Pi conversation, isolated AIKIT_HOME).
//
//   F14 — Live's "Open conversation" binds that conversation in the centre
//         Tasks view; the header carries a Run chip whose title EQUALS the
//         run's title and whose ref EQUALS the owner attempt's run; the chip
//         opens the Run page. Choosing the same conversation through the
//         chat's own History chooser joins it the same way.
//   F15 — a conversation no run carries (attached in the same space, in no
//         attempt, execution or journey) says "Direct conversation" exactly
//         once in the header and shows no Run chip.
import {join} from "node:path";
import {bindDefaultCentral} from "../editor-doc.mjs";
import {enterFactory, factoryGround, recordOps, shotMatrix} from "../lib/factory-ground.mjs";
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
    await sessions.turn(SESSIONS.review, "Reply with one short sentence: what does a release-notes section order mean?");
    return {...ground, sessions, env: {...ground.env, AIKIT_HOME: sessions.env.AIKIT_HOME, OI_AIKIT_BIN: sessions.env.OI_AIKIT_BIN, OI_BIN: sessions.env.OI_BIN},
      cleanup: () => { sessions.stop(); setTimeout(() => ground.cleanup(), 1200); }};
  } catch (error) { sessions?.stop(); ground.cleanup(); throw error; }
}

const firstSentence = text => text.trim().replace(/\s+/g, " ").replace(/[.]$/, "");

export default async function run({page, baseUrl, check, shot, channel, log, provision: p}) {
  if (p.realProviderSkipped) {
    await page.goto(baseUrl); await channel("info");
    check(true, REAL_PROVIDER_SKIP_NOTE);
    return;
  }
  page.on("pageerror", error => log(`PAGE ERROR: ${error}`));
  const ops = recordOps(page);
  const A = p.specimen.runs.A;
  const reviewAttempt = p.specimen.readings.inspect.attempts.find(attempt => attempt.body?.agentSessionRef === SESSIONS.review);
  await page.goto(baseUrl); await channel("info");
  await enterFactory(page, {channel, bindDefaultCentral, root: p.root, project: "Specimen"});
  const centre = page.locator("main.factory-centre");
  await page.waitForFunction(() => document.querySelectorAll(".fdesk .fdesk-card").length >= 3, null, {timeout: 90000});

  // ---- F14 via the run's Live "Open conversation"
  await centre.locator(`[data-run-card="${A.runRef}"]`).click();
  const runPage = centre.locator(`[data-run-page="${A.runRef}"]`);
  await runPage.waitFor();
  await runPage.getByRole("tab", {name: "Live", exact: true}).click();
  await runPage.locator(`.flive-row[data-leg="${reviewAttempt.workflowUnitRef}"]`).getByRole("button", {name: "Open conversation"}).click();
  await page.locator('main.factory-centre[data-centre-view="tasks"]').waitFor({timeout: 30000});
  const chip = centre.locator("[data-run-chip]");
  await chip.waitFor({timeout: 60000});
  const chipTitle = (await chip.innerText()).replace(/\s+/g, " ").trim();
  check(reviewAttempt && await chip.getAttribute("data-run-chip") === A.runRef && chipTitle === `Run ${firstSentence(A.purpose)}` && await centre.locator("[data-direct-conversation]").count() === 0,
    "F14: the conversation whose session carried the review attempt shows a Run chip for exactly that run (join by attempt session)", {chipTitle, attemptSession: reviewAttempt?.body?.agentSessionRef});
  const chipHover = await chip.getAttribute("title");
  check(chipHover === `Queued · ${firstSentence(A.purpose)}`, "F14: hovering the Run chip shows the run's state", {chipHover});
  const bound = ops.filter(op => op.op === "encounter").length > 0;
  check(bound, "F14: opening the conversation used the frame's ordinary encounter start/read pair");
  await shotMatrix(page, shot, "factory-tasks-joined", async () => {});
  await chip.click();
  await centre.locator(`[data-run-page="${A.runRef}"]`).waitFor({timeout: 30000});
  check(await page.locator('main.factory-centre[data-centre-view="desk"]').count() === 1, "F14: the Run chip opens the Run page");

  // ---- F15: a Direct conversation through the chat's own History chooser
  await page.getByRole("radiogroup", {name: "Factory view", exact: true}).getByRole("radio", {name: "Tasks", exact: true}).click();
  await page.locator('main.factory-centre[data-centre-view="tasks"]').waitFor();
  const chat = page.locator(".factory-chat-full");
  let direct = "";
  for (let attempt = 0; attempt < 3 && !direct; attempt++) {
    if (await chat.locator(".chat-history-menu").count() === 0) await chat.getByRole("button", {name: "History", exact: true}).click();
    const row = chat.locator(".chat-history-menu .encounter-row", {hasText: "A direct question about the release notes"});
    await row.waitFor({timeout: 30000});
    await row.click();
    const deadline = Date.now() + 45000;
    while (Date.now() < deadline) {
      const texts = await centre.locator("[data-direct-conversation]").allInnerTexts().catch(() => []);
      if (texts.length) { direct = texts.join("|"); break; }
      await page.waitForTimeout(500);
    }
  }
  const headerText = await centre.locator(".ftasks-head").innerText();
  check(direct === "Direct conversation" && await centre.locator("[data-run-chip]").count() === 0 && (headerText.match(/Direct conversation/g) ?? []).length === 1,
    "F15: a conversation no run carries says \"Direct conversation\" exactly once and shows no Run chip (no invented ancestry)", {direct, headerText});
  await shot("f15-direct");
}
