/**
 * The left frame when reads fail, lag or come back empty (10-SIDEBARS §5.1
 * L7, §5.2 R8–R11), on the real kernel through the walk bridge.
 *
 * The triggering transitions are real: the transport to the kernel is cut
 * (every /op aborted), one owner read is held back, one refused, and the
 * owner's own ground is emptied (a real file removed from the disposable
 * ground). Rows that render are always the owner's own reading.
 *
 *   L7  Couldn't read Central. + Retry in the body; the foot still switches
 *       modes; Retry recovers once the transport answers
 *   R8  one "Reading Alpha…" line in place of that branch's rows — no
 *       whole-sidebar spinner (every other section keeps its rows)
 *   R9  an empty optional section is absent: zero height, no header text
 *   R10 "Couldn't load this project." + Retry — distinguishable from R9
 *   R11 after a failed refresh the last-known rows stay and the header says
 *       "as of …"
 */
import {rmSync} from "node:fs";
import {join} from "node:path";
import {setup as groundSetup, bindDefaultCentral} from "./left-ground.mjs";

export async function setup(args) { return groundSetup(args); }

export default async function run({page, baseUrl, check, shot, channel, provision: p}) {
  const faults = {cut: false, hold: new Set(), refuse: new Set()};
  let releaseHeld;
  let heldGate = new Promise(resolve => { releaseHeld = resolve; });
  const key = body => `${body?.op}:${body?.project ?? body?.path ?? ""}`;
  await page.route("**/op", async route => {
    const body = route.request().postDataJSON?.();
    if (faults.cut) return route.abort("connectionrefused");
    if (faults.refuse.has(key(body))) return route.fulfill({status: 200, contentType: "application/json", body: JSON.stringify({error: "walk fault: the owner refused this read"})});
    if (faults.hold.has(key(body))) await heldGate;
    return route.continue();
  });
  await page.goto(baseUrl); await channel("info");
  await bindDefaultCentral(page, p.root);
  const left = page.locator('[data-region="left"]');
  const foot = left.locator("[data-left-foot]");
  const strip = foot.getByRole("radiogroup", {name: "Workspace mode"});
  await page.locator('[data-project-path="Work/Alpha"]').waitFor({timeout: 30000});

  // ---- R8: Alpha's conversations are held; its branch shows one quiet line
  faults.hold.add("agency_read:Alpha");
  await page.locator('[data-project-path="Work/Alpha"]').click();
  const alphaBranch = left.locator('li[data-navigation-path="Work/Alpha"]');
  await alphaBranch.getByText("Reading Alpha…").waitFor({timeout: 15000});
  const reading = await left.evaluate(node => ({
    readingLines: [...node.querySelectorAll('[role="status"]')].filter(el => /^Reading /.test(el.textContent ?? "") && el.getBoundingClientRect().height > 0).map(el => el.textContent),
    controlRows: node.querySelectorAll('[data-section="control"] [data-file-path]').length,
    flowRows: node.querySelectorAll('[data-section="flows"] [data-file-path]').length,
    busy: node.querySelector('[aria-busy="true"].world-navigator') !== null,
  }));
  check(JSON.stringify(reading.readingLines) === JSON.stringify(["Reading Alpha…"]) && reading.controlRows > 0 && reading.flowRows > 0 && !reading.busy, "R8: exactly one 'Reading Alpha…' line stands in place of Alpha's rows; CONTROL and FLOWS keep their rows (no whole-sidebar spinner)", reading);
  await shot("R8-branch-reading");
  faults.hold.delete("agency_read:Alpha"); releaseHeld();
  heldGate = new Promise(resolve => { releaseHeld = resolve; });
  await alphaBranch.locator(".left-conversation").first().waitFor({timeout: 20000});
  const alphaRows = await alphaBranch.locator(".left-conversation").count();
  check(alphaRows === 4 && await alphaBranch.getByText("Reading Alpha…").count() === 0, "R8: when the reading lands the line is replaced by the owner's four conversations", {alphaRows});

  // ---- R11: a refresh that fails keeps the last-known rows and says "as of"
  faults.refuse.add("agency_read:Alpha");
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  const stale = alphaBranch.locator("[data-stale-since]");
  await stale.waitFor({timeout: 15000});
  const staleText = (await stale.innerText()).trim();
  const keptRows = await alphaBranch.locator(".left-conversation").count();
  check(keptRows === alphaRows && /^As of .+ — couldn't refresh\. Retry$/.test(staleText), "R11: after a failed refresh the four last-known rows stay and the branch says 'As of … — couldn't refresh' with Retry", {keptRows, staleText});
  // The same law in a section header (Factory's TASKS, scope Alpha).
  faults.refuse.delete("agency_read:Alpha");
  await left.locator("[data-left-head] .left-scope-trigger").click();
  await left.locator('[data-scope-project="Alpha"]').click();
  await strip.locator('[data-mode="factory"]').click();
  await page.locator('.desktop-shell[data-mode="factory"]').waitFor();
  const tasks = left.locator('[data-section="tasks"]');
  await tasks.locator(".left-conversation").first().waitFor({timeout: 20000});
  faults.refuse.add("agency_read:Alpha");
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await tasks.locator(".left-section-stale").waitFor({timeout: 15000});
  const header = (await tasks.locator(".left-section-head").innerText()).replace(/\s+/g, " ").trim();
  check(/^TASKS 4 as of .+ Retry$/i.test(header) && await tasks.locator(".left-conversation").count() === 4 && await tasks.locator("[data-stale-since]").count() === 0, "R11: Factory's TASKS header reads 'as of …' with Retry over its four kept rows (said once, in the header)", {header});
  await shot("R11-stale-header");
  faults.refuse.delete("agency_read:Alpha");
  await tasks.locator(".left-section-retry").click();
  await tasks.locator(".left-section-stale").waitFor({state: "detached", timeout: 15000});
  check(await tasks.locator(".left-conversation").count() === 4, "R11: Retry re-reads and the header's 'as of' leaves");

  // ---- R10: a refused read — distinct from empty
  faults.refuse.add("agency_read:Beta");
  await left.locator("[data-left-head] .left-scope-trigger").click();
  await left.locator('[data-scope-project="Beta"]').click();
  const error = tasks.getByRole("alert");
  await error.waitFor({timeout: 15000});
  const errorText = (await error.innerText()).replace(/\s+/g, " ").trim();
  check(errorText === "Couldn't load this project. Retry" && await tasks.locator(".left-section-head").count() === 1, "R10: a refused read shows 'Couldn't load this project.' + Retry under its header", {errorText});
  await shot("R10-couldnt-load");
  faults.refuse.delete("agency_read:Beta");
  await error.getByRole("button", {name: "Retry"}).click();
  await tasks.locator(".left-conversation").first().waitFor({timeout: 20000});
  check((await tasks.locator(".left-conversation").allInnerTexts()).some(text => text.includes("Review the Beta project's goals")), "R10: Retry reads Beta's real conversation");

  // ---- R9: an empty optional section takes zero height, no header text
  await strip.locator('[data-mode="base"]').click();
  await page.locator('.desktop-shell[data-mode="base"]').waitFor();
  const flows = left.locator('[data-section="flows"]');
  await flows.locator("div[data-file-path]").first().waitFor({timeout: 20000});
  check((await flows.locator("div[data-file-path]").count()) === 1, "R9 (before): FLOWS holds the ground's one flow");
  rmSync(join(p.root, "Control/user/flows/flow-2026-09-23-0900.html"));
  await page.reload(); await channel("info");
  await page.locator('[data-project-path="Work/Alpha"]').waitFor({timeout: 30000});
  await left.locator('[data-section="control"]').waitFor();
  await page.waitForFunction(() => !document.body.innerText.includes("Reading flows…"), null, {timeout: 20000});
  const flowsGone = await left.evaluate(node => ({section: node.querySelectorAll('[data-section="flows"]').length, header: [...node.querySelectorAll(".left-eyebrow")].map(el => el.textContent)}));
  check(flowsGone.section === 0 && !flowsGone.header.includes("Flows"), "R9: with no flows the FLOWS section is absent — no header text, zero height", flowsGone);
  check(errorText !== "" && flowsGone.section === 0, "R9 vs R10: empty is absence; a failed read is words and Retry — the two are distinguishable");

  // ---- L7: the transport is cut — Central can't be read, the foot still works
  faults.cut = true;
  await page.reload(); await channel("info");
  const unreadable = left.getByText("Couldn't read Central.");
  await unreadable.waitFor({timeout: 30000});
  const retry = left.locator('[data-section="control"]').getByRole("button", {name: "Retry"});
  check(await retry.count() === 1 && await left.locator("[data-project-path]").count() === 0 && (await left.locator('[data-section="control"] .left-error').innerText()).includes("Everything already open still works."), "L7: with the transport cut the body says 'Couldn't read Central.' (and that what is open still works) with Retry, and invents no project");
  await shot("L7-unreadable");
  const modes = [];
  for (const mode of ["factory", "base"]) {
    await strip.locator(`[data-mode="${mode}"]`).click();
    await page.locator(`.desktop-shell[data-mode="${mode}"]`).waitFor({timeout: 10000});
    modes.push(mode);
  }
  check(modes.length === 2 && await foot.getByRole("button", {name: /^Inbox/}).isEnabled(), "L7: the foot still switches modes (Factory and back) while Central is unreadable", {modes});
  faults.cut = false;
  await left.locator('[data-section="control"]').getByRole("button", {name: "Retry"}).click();
  await page.locator('[data-project-path="Work/Alpha"]').waitFor({timeout: 30000});
  check(await left.getByText("Couldn't read Central.").count() === 0, "L7: Retry reads Central once the transport answers again");
  await page.unroute("**/op");
}
