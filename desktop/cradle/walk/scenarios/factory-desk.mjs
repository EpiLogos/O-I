// factory-desk (11-FACTORY §2, §7 F1–F5): the Desk — the run board — over a
// disposable Factory ground built by the installed owner CLI
// (walk/lib/factory-ground.mjs), through the real kernel.
//
//   F1 reading   — the discovery answer is held back at the network edge (the
//                  request itself is real and is released unchanged) so the
//                  reading state is observable: skeleton columns and
//                  "Reading runs…", no card invented.
//   F5 title     — every card title EQUALS the first sentence of the owner's
//                  commission purpose; no card carries run:/project: text; the
//                  footer names the project, never its ref.
//   F4 needs you — the run whose returned Return awaits Recognition sits in
//                  NEEDS YOU with `!` and a count; recognising it through the
//                  Handoff tab's native Recognise moves it back to QUEUED after
//                  an explicit ⟳.
//   F2 empty     — a Factory source read successfully with zero runs: "No runs
//                  yet." + New run.
//   F3 partial   — a source whose state the owner cannot read: one line naming
//                  it with the owner's own words + Retry, distinct from F2.
// Plus: search and search-empty; back from a Run page keeps the Desk's scroll
// (two-sided geometry, the triggering transition exercised); no polling.
import {bindDefaultCentral} from "../editor-doc.mjs";
import {chooseProject, enterFactory, factoryGround, near, recordOps, shotMatrix} from "../lib/factory-ground.mjs";

export async function setup(args) { return factoryGround(args); }

const firstSentence = text => text.trim().replace(/\s+/g, " ").replace(/[.]$/, "");

export default async function run({page, baseUrl, check, shot, channel, log, provision: p}) {
  page.on("pageerror", error => log(`PAGE ERROR: ${error}`));
  const ops = recordOps(page);
  const A = p.specimen.runs.A, B = p.specimen.runs.B, C = p.specimen.runs.C;
  const expectedTitles = [A.purpose, B.purpose, C.purpose].map(firstSentence).sort();

  // Hold the first discovery answer back so the reading state is observable.
  let release;
  const held = new Promise(resolve => { release = resolve; });
  let holding = true;
  await page.route("**/op", async route => {
    const body = route.request().postDataJSON?.();
    if (holding && body?.op === "factory_owner" && body.request?.kind === "locate" && body.request?.project === "Specimen") await held;
    await route.continue();
  });

  await page.goto(baseUrl); await channel("info");
  // Factory, then the scope through the Factory navigator's project picker
  // (the scope's one writer is the workspace; the Desk reads the scope).
  await enterFactory(page, {channel, bindDefaultCentral, root: p.root, project: "Specimen"});
  const centre = page.locator("main.factory-centre");
  const desk = centre.locator(".fdesk");
  await desk.waitFor({timeout: 30000});

  // ---- F1 reading
  await desk.locator(".fdesk-reading").waitFor({timeout: 30000});
  const readingText = (await desk.locator(".fdesk-reading").innerText()).trim();
  const skeletonHeads = (await desk.locator(".fdesk-column-head").allInnerTexts()).map(text => text.trim().toUpperCase());
  const cardsWhileReading = await desk.locator(".fdesk-card").count();
  check(readingText === "Reading runs…" && skeletonHeads.join("|") === "NEEDS YOU|ACTIVE|QUEUED|RECENT" && await desk.getAttribute("data-desk-state") === "reading",
    "F1: while the discovery read is in flight the Desk shows skeleton columns and \"Reading runs…\"", {readingText, skeletonHeads});
  check(cardsWhileReading === 0 && await desk.locator(".fdesk-skeleton").count() === 8, "F1: no card is invented while reading (0 cards, 2 skeletons per column)", {cardsWhileReading});
  await shot("f1-reading");
  holding = false; release();

  // ---- F5 card titles
  const cards = desk.locator(".fdesk-card");
  await page.waitForFunction(() => document.querySelectorAll(".fdesk .fdesk-card").length >= 3, null, {timeout: 60000});
  const titles = (await desk.locator("[data-card-title]").allInnerTexts()).map(text => text.trim()).sort();
  check(titles.join("|") === expectedTitles.join("|"), "F5: every card title EQUALS the owner's commission purpose (first sentence) — no card invented, none missing", {titles, expectedTitles});
  const cardTexts = await cards.allInnerTexts();
  check(cardTexts.every(text => !/(^|\s)(run|project|journey|workflow-unit):/.test(text)), "F5: no card carries run:/project: ref text", {sample: cardTexts[0]});
  const footers = (await desk.locator("[data-card-footer]").allInnerTexts()).map(text => text.trim());
  check(footers.length === 3 && footers.every(text => text.startsWith("Specimen")), "F5: each footer names the project (Specimen) from its key, never a ref", {footers});
  const unitCounts = await cards.evaluateAll(nodes => Object.fromEntries(nodes.map(node => [node.getAttribute("data-run-card"), node.querySelectorAll(".fdesk-unit").length])));
  const ownerUnits = ref => Object.values(ref === A.runRef ? p.specimen.readings.runReading.runMap.nodes : ref === C.runRef ? C.runReading.runMap.nodes : {}).filter(node => node.kind === "work").length;
  check(unitCounts[A.runRef] === ownerUnits(A.runRef) && unitCounts[C.runRef] === 0 && unitCounts[B.runRef] === Object.keys(B.unitRefs).length,
    "Units: one segment per owner work unit (A 4, B 2, C 0) — never a percentage", {unitCounts});
  check(!cardTexts.some(text => /\d+\s*%/.test(text)), "No card shows a percentage");
  const runAStanding = await desk.locator(`[data-run-card="${A.runRef}"] .fdesk-unit`).evaluateAll(nodes => nodes.map(node => node.getAttribute("data-standing")));
  check(runAStanding.includes("returned") && runAStanding.includes("active"), "Run A's segments shade by leg standing (a returned survey, an active review)", {runAStanding});

  // ---- F4 needs you
  const needsColumn = desk.locator('section[data-column="needs-you"]');
  const needsCard = needsColumn.locator(`[data-run-card="${A.runRef}"]`);
  const needsCount = await needsCard.locator("[data-needs-you]").getAttribute("data-needs-you").catch(() => null);
  const glyph = (await needsCard.locator(".fdesk-glyph").innerText().catch(() => "")).trim();
  check(await needsCard.count() === 1 && needsCount === "1" && glyph === "!", "F4: the run whose Return awaits Recognition sits in NEEDS YOU with ! and a count of 1", {needsCount, glyph});
  check(await needsColumn.locator(".fdesk-column-head").innerText() === "NEEDS YOU · 1" || (await needsColumn.locator(".fdesk-column-head").innerText()).toUpperCase() === "NEEDS YOU · 1", "F4: the NEEDS YOU column counts exactly one run");
  await shot("f4-needs-you");

  // Search and search-empty.
  const search = desk.getByRole("textbox", {name: "Search runs"});
  await search.fill("Lint");
  const found = (await desk.locator("[data-card-title]").allInnerTexts()).map(text => text.trim());
  check(found.length === 1 && found[0] === firstSentence(B.purpose), "Search keeps only runs whose words match", {found});
  await search.fill("zzqq");
  const searchEmpty = (await desk.locator('[data-desk-empty="search"] p').first().innerText()).trim();
  check(searchEmpty === "No runs match “zzqq”.", "Search-empty says so, with Clear", {searchEmpty});
  await desk.getByRole("button", {name: "Clear", exact: true}).click();
  check(await cards.count() === 3, "Clear restores the board");

  // Back keeps the Desk's scroll — two-sided geometry over the transition.
  await page.setViewportSize({width: 900, height: 420});
  await page.waitForTimeout(200);
  const scrollable = await desk.evaluate(node => node.scrollHeight - node.clientHeight);
  await desk.evaluate(node => { node.scrollTop = Math.min(90, node.scrollHeight - node.clientHeight); });
  const before = await desk.evaluate(node => node.scrollTop);
  const beforeTop = await needsCard.evaluate(node => node.getBoundingClientRect().top);
  await needsCard.click();
  await centre.locator("[data-run-page]").waitFor({timeout: 30000});
  check(await centre.locator(".fdesk").count() === 0, "Opening a run replaces the Desk with the Run page (no stacking)");
  await centre.getByRole("button", {name: "← Desk"}).click();
  await desk.waitFor();
  const after = await centre.locator(".fdesk").evaluate(node => node.scrollTop);
  const afterTop = await centre.locator(`.fdesk [data-run-card="${A.runRef}"]`).evaluate(node => node.getBoundingClientRect().top);
  check(scrollable > 0 && before > 0 && near(before, after) && near(beforeTop, afterTop), "← Desk returns to the same scroll: scrollTop and the card's top equal before/after (±0.5px)", {scrollable, before, after, beforeTop, afterTop});
  // Regression (owner report 2026-09-17, first guarded in mode-workspaces): a
  // Factory jump called scrollIntoView, which scrolled the SHELL — the app slid
  // up, the footer row jammed into view and the head was covered. With the
  // board below the fold the wheel and an in-surface jump really have to
  // scroll, and must land in a scroll owner inside the Factory stage only.
  await desk.hover(); await page.mouse.wheel(0, 600); await page.waitForTimeout(150);
  await desk.evaluate(node => node.lastElementChild?.scrollIntoView({block: "end"})); await page.waitForTimeout(150);
  const scrolls = await page.evaluate(() => {
    const stage = document.querySelector('.mode-stage[data-mode="factory"]');
    const structural = [document.scrollingElement, document.body, document.getElementById("root"), ...document.querySelectorAll(".desktop-shell,.desktop-regions,.desktop-centre")];
    return {scrolled: structural.filter(node => node && (node.scrollTop !== 0 || node.scrollLeft !== 0)).map(node => node.className || node.tagName), shell: document.querySelector(".desktop-shell").getBoundingClientRect().top, owners: [stage, ...(stage ? stage.querySelectorAll("*") : [])].filter(node => node.scrollTop > 0).map(node => node.className)};
  });
  check(scrolls.scrolled.length === 0 && scrolls.shell === 0 && scrolls.owners.length > 0, "Scrolling the Desk — wheel or an in-surface jump — moves a scroll owner inside the Factory stage alone; the shell and structural boxes never move", scrolls);
  await desk.evaluate(node => { node.scrollTop = 0; }); await page.waitForTimeout(150);
  check(await page.evaluate(() => { const head = document.querySelector('.mode-stage[data-mode="factory"] .fdesk-head'); const box = head.getBoundingClientRect(); const hit = document.elementFromPoint(box.left + 40, box.top + 2); return box.height >= 20 && !!hit && head.contains(hit); }), "The Desk head stands visible and hittable from its top edge after the scrolls — nothing clips it");
  await page.setViewportSize({width: 1280, height: 820});

  // No polling: an idle minute of the board sends no owner read.
  // Requests SENT during an idle window (the Run page's own reads, sent when
  // it opened, may still be answering — they are not polling).
  const sent = [];
  const onRequest = request => { if (request.url().endsWith("/op")) { const body = request.postDataJSON?.(); if (body?.op?.startsWith("factory")) sent.push({op: body.op, kind: body.request?.kind, read: body.read}); } };
  await page.waitForTimeout(2500);
  page.on("request", onRequest);
  await page.waitForTimeout(5000);
  page.off("request", onRequest);
  const idleFactory = sent;
  check(idleFactory.length === 0, "No polling: an idle board sends no Factory read", {idleFactory});

  // F4 answered: Recognise in Handoff (the owner's own mutation), ⟳, back in QUEUED.
  await needsCard.click();
  const runPage = centre.locator("[data-run-page]");
  await runPage.waitFor();
  await runPage.getByRole("tab", {name: "Handoff"}).click();
  await runPage.getByRole("button", {name: "Recognise", exact: true}).click();
  await runPage.locator("[data-recognition-receipt]").waitFor({timeout: 30000});
  check(ops.some(op => op.op === "factory_owner" && op.kind === "recognise" && op.result === "factory_development_reading"), "F4: Recognise ran the owner's native recognition and returned its receipt");
  await centre.getByRole("button", {name: "← Desk"}).click();
  await desk.getByRole("button", {name: "Refresh the Desk"}).click();
  await desk.getByRole("menuitem", {name: "Read the Desk again"}).click();
  await page.waitForFunction(() => document.querySelector(".fdesk")?.getAttribute("data-desk-state") === "read" && /^read /.test(document.querySelector("[data-desk-read-label]")?.textContent ?? ""), null, {timeout: 60000});
  check(await desk.locator(`section[data-column="needs-you"] [data-run-card="${A.runRef}"]`).count() === 0 && await desk.locator(`section[data-column="queued"] [data-run-card="${A.runRef}"]`).count() === 1,
    "F4: after Recognition and an explicit ⟳ the run has left NEEDS YOU for QUEUED (the owner's lifecycle word)");
  const readLabel = (await desk.locator("[data-desk-read-label]").innerText()).trim();
  check(/^read (just now|\d+s ago)$/.test(readLabel), "The ⟳ label says when the Desk was last read", {readLabel});

  await shotMatrix(page, shot, "factory-desk", async () => { await desk.waitFor(); });

  // ---- F2 empty: a source read with zero runs.
  await chooseProject(page, "Other");
  await desk.locator('[data-desk-empty="empty"]').waitFor({timeout: 60000});
  const emptyText = (await desk.locator('[data-desk-empty="empty"] p').innerText()).trim();
  const otherLocate = ops.filter(op => op.op === "factory_owner" && op.kind === "locate").pop();
  check(emptyText === "No runs yet." && await desk.getByRole("button", {name: "New run", exact: true}).count() === 1 && otherLocate?.result === "factory_development_reading" && await desk.locator("[data-desk-partial]").count() === 0,
    "F2: a successful read with zero runs shows \"No runs yet.\" + New run, and no partial line", {emptyText, otherLocate});
  await shot("f2-empty");

  // ---- F3 partial: a source the owner cannot read.
  await chooseProject(page, "Broken");
  await desk.locator("[data-desk-partial]").waitFor({timeout: 60000});
  const partial = (await desk.locator("[data-desk-partial]").innerText()).trim();
  const ownerWords = p.broken.refusal.split(/\s+/).slice(0, 5).join(" ");
  check(partial.startsWith("1 source couldn't be read — Broken") && partial.includes(ownerWords) && partial.endsWith("Retry"), "F3: one line names the unreadable source with the owner's own words + Retry", {partial, ownerWords});
  check(await desk.locator('[data-desk-empty="empty"]').count() === 0 && await desk.locator('[data-desk-empty="partial"]').count() === 1, "F3 is distinct from F2: never an empty healthy board");
  await shot("f3-partial");
}
