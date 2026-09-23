// background-completion (factory289:arrangement branch 0, negative
// exercised) on the 11-FACTORY Desk: a run the person left moves in the
// owner's world while they rest on the board; the Desk shows it only on the
// person's own explicit read (no polling), in the run's own place — and the
// scope, the open page and the kernel event log do not move (a Factory read
// emits no kernel events). The adverse face: the owner can no longer serve
// the source — the Desk names it in one line with the owner's own words,
// never an empty healthy board; restoring it and Retry brings the runs back.
import {renameSync} from "node:fs";
import {bindDefaultCentral} from "../editor-doc.mjs";
import {enterFactory, factoryGround, recordOps} from "../lib/factory-ground.mjs";
import {recognise} from "../lib/factory-specimen.mjs";

export async function setup(args) { return factoryGround(args); }

export default async function run({page, baseUrl, check, shot, channel, log, provision: p}) {
  page.on("pageerror", error => log(`PAGE ERROR: ${error}`));
  const ops = recordOps(page);
  const S = p.specimen, A = S.runs.A;
  const lastSeq = async () => (await channel("read.events")).data.last_seq ?? 0;
  await page.goto(baseUrl); await channel("info");
  await enterFactory(page, {channel, bindDefaultCentral, root: p.root, project: "Specimen"});
  const desk = page.locator("main.factory-centre .fdesk");
  await page.waitForFunction(() => document.querySelectorAll(".fdesk .fdesk-card").length >= 3, null, {timeout: 90000});
  const placement = () => desk.locator(".fdesk-card").evaluateAll(nodes => Object.fromEntries(nodes.map(node => [node.getAttribute("data-run-card"), node.closest("section[data-column]")?.getAttribute("data-column")])));
  const settled = await placement();
  check(settled[A.runRef] === "needs-you", "At rest: the run whose Return awaits Recognition sits in NEEDS YOU", {settled});
  await desk.getByRole("textbox", {name: "Search runs"}).click();
  const seqSettled = await lastSeq();
  const readsBefore = ops.filter(op => op.op?.startsWith("factory")).length;

  // The owner's world moves behind the desktop's back: the Recognition is
  // recorded through the owner's own mutation (another hand, another window).
  const receipt = recognise({statePath: S.statePath, journeyRef: A.journeyRef, returnRef: A.returnRef});
  check(receipt?.contract === "factory.developmental-mutation-receipt/v1", "The owner recorded the Recognition (its own receipt)", {status: receipt?.status});
  await page.waitForTimeout(4000);
  check(JSON.stringify(await placement()) === JSON.stringify(settled) && ops.filter(op => op.op?.startsWith("factory")).length === readsBefore,
    "No polling: the board does not move and sends no read until the person reads");

  // The person's own read: the run moves in its own place; nothing else moves.
  await desk.getByRole("button", {name: "Refresh the Desk"}).click();
  await page.getByRole("menuitem", {name: "Read the Desk again"}).click();
  await page.waitForFunction(ref => !!document.querySelector(`.fdesk section[data-column="queued"] [data-run-card="${ref}"]`) && document.querySelector(".fdesk")?.getAttribute("data-desk-state") === "read", A.runRef, {timeout: 90000});
  const after = await placement();
  const moved = Object.keys(after).filter(ref => after[ref] !== settled[ref]);
  check(JSON.stringify(moved) === JSON.stringify([A.runRef]) && after[A.runRef] === "queued", "On the person's read exactly the run that moved changes place (NEEDS YOU → QUEUED)", {moved});
  check(await page.locator('nav.factory-navigator select[aria-label="Project"]').inputValue() === "Specimen" && await page.locator("main.factory-centre [data-run-page]").count() === 0,
    "The scope and the open page did not move");
  await page.waitForTimeout(800);
  const events = (await channel("read.events", [seqSettled])).data.receipts ?? [];
  check(events.length === 0, "The read cost the kernel log nothing — a Factory read emits no event", {emitted: events.map(event => event.event)});
  await shot("after-background-recognition");

  // Adverse: the owner can no longer serve the source.
  const aside = `${S.statePath}.walk-aside`;
  renameSync(S.statePath, aside);
  try {
    await desk.getByRole("button", {name: "Refresh the Desk"}).click();
    await page.getByRole("menuitem", {name: "Read the Desk again"}).click();
    await desk.locator("[data-desk-partial]").waitFor({timeout: 90000});
    const partial = (await desk.locator("[data-desk-partial]").innerText()).trim();
    check(partial.startsWith("1 source couldn't be read — Specimen") && await desk.locator('[data-desk-empty="empty"]').count() === 0,
      "Adverse: the unreadable source is named in one line with the owner's words — never an empty healthy board", {partial});
    await shot("source-unreadable");
  } finally { renameSync(aside, S.statePath); }
  await desk.locator("[data-desk-partial]").getByRole("button", {name: "Retry"}).click();
  await page.waitForFunction(() => document.querySelectorAll(".fdesk .fdesk-card").length >= 3 && !document.querySelector("[data-desk-partial]"), null, {timeout: 90000});
  check(await desk.locator(".fdesk-card").count() === 3, "Retry after the owner can serve again brings the runs back");
}
