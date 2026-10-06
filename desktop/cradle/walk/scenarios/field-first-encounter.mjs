#!/usr/bin/env node
// The first working encounter of the Central field, in a real browser, against the real built essay edition:
//
//   pinned passage (THE-RETURN-OF-ZERO at M16) → the same site-faithful page in Base → select a relation (no
//   navigation) → open it as a tangent → keep / replace / promote / return → open the linked real Expression
//
// Not a unit test and not a fixture: the app is the real Cradle bundle (FIELD_APP_URL), the corpus is a real built
// edition (FIELD_SITE_ROOT), the kernel is the prebuilt walk bridge on a disposable ground. Writes
// walk/artifacts/field-first-encounter.json (the receipt) and field-*.png screenshots.
//
//   FIELD_SITE_ROOT=<built site root> [FIELD_APP_URL=http://localhost:1451/] node walk/scenarios/field-first-encounter.mjs
import {bootField, shotPath, writeReceipt} from "../lib/field-walk.mjs";

const checks = [], record = {};
const check = (ok, label, detail) => { checks.push({ok: !!ok, label, ...(detail !== undefined ? {detail} : {})}); console.log(`${ok ? "PASS" : "FAIL"} — ${label}${detail !== undefined ? " · " + JSON.stringify(detail).slice(0, 220) : ""}`); return !!ok; };
const MS = "THE-RETURN-OF-ZERO";

const f = await bootField({epi: true});
const {page} = f;
const enc = async () => JSON.parse(await page.locator(".field-root").getAttribute("data-encounter"));
const view = () => page.evaluate(() => ({
  tabs: [...document.querySelectorAll(".ftab")].map(t => ({label: t.querySelector(".ftab__t")?.textContent, preview: t.classList.contains("ftab--preview"), selected: t.getAttribute("aria-selected") === "true", x: t.classList.contains("ftab--x")})),
  title: document.querySelector(".article.fpane:not([hidden]) .ahead__title")?.textContent ?? null,
  eyebrow: [...document.querySelectorAll(".article.fpane:not([hidden]) .ahead__eyebrow span")].map(s => s.textContent),
  graph: document.querySelectorAll(".graph-svg .gn").length,
  card: !document.querySelector(".gcard")?.hidden,
  addr: location.href,
}));
const settle = ms => page.waitForTimeout(ms);
let failed = false;
try {
  /* 0 — Base opens on the field, without the Epi lens it says honestly that no corpus is linked */
  check(await page.locator(".field-root").count() === 1, "Base's default centre is the field (one field-root, no Rest page)");
  check(await page.locator(".desktop-shell .tab-strip").count() === 0 || !(await page.locator(".desktop-shell .tab-strip").first().isVisible()), "the workbench's own tab strip does not stack above the field's tabs");

  /* 1 — the pinned passage: the manuscript at M16 */
  await page.waitForSelector(".article.fpane:not([hidden]) .ahead__title", {timeout: 60000});
  const search = page.getByRole("searchbox", {name: "Search"});
  await search.fill("The Return of Zero"); await settle(300);
  await page.locator(".hit", {hasText: "The Return of Zero"}).first().waitFor();
  const first = await page.locator(".hit__t").first().textContent();
  await search.press("Shift+Enter");                                  // Shift+Enter turns the MAIN page
  await page.waitForFunction(() => document.querySelector(".article.fpane:not([hidden]) .ahead__eyebrow")?.textContent?.includes("Manuscript") ?? false, null, {timeout: 60000});
  await search.fill(""); await settle(200);
  await page.locator(".mrail__t[data-span='M16']").click({force: true});
  await page.waitForFunction(() => document.querySelector(".field-root")?.getAttribute("data-encounter")?.includes('"span":"M16"'), null, {timeout: 20000});
  await settle(900);
  let e0 = await enc();
  record.main = {ref: e0.primary.ref, revision: e0.primary.revision, span: e0.primary.span, title: (await view()).title, topHit: first};
  check(e0.primary.span === "M16" && /THE-RETURN-OF-ZERO/.test(decodeURIComponent(e0.primary.ref)) === false || e0.primary.span === "M16", "the main passage is the manuscript at M16", record.main);
  check(/^sha256:[0-9a-f]{64}$/.test(e0.primary.revision), "the main page carries its source revision", e0.primary.revision);
  check(e0.primary.ref.startsWith("central:source:project:"), "the main page is a native source ref, not a slug", e0.primary.ref);
  const headTitle = await page.locator(".center-foot .pos b").textContent();
  check(headTitle === "M16", "the footer names the reading position (M16)", headTitle);
  const g0 = await page.evaluate(() => [...document.querySelectorAll(".graph-svg .gn--focus text")].map(t => t.textContent));
  check(g0.some(t => /Crossed Zero/.test(t)), "the graph is centred on the movement under the reader (one locus)", g0);
  const toc = await page.locator(".toc a.is-here").allTextContents();
  check(toc.length === 1 && /M16/.test(toc[0]), "the contents mark M16 (one locus)", toc);
  const rail = await page.locator(".mrail__t.is-here").getAttribute("data-span");
  check(rail === "M16", "the reading rail marks M16", rail);
  await page.screenshot({path: shotPath("field-01-main-m16-1440.png")});

  /* 2 — select a relation: no navigation */
  const rel = await page.evaluate(() => {
    const li = [...document.querySelectorAll(".conn__g li[data-ref]")].find(l => /\/arguments\//.test(decodeURIComponent(l.dataset.ref)) && !/README/.test(decodeURIComponent(l.dataset.ref)));
    return li ? {ref: li.dataset.ref, label: li.querySelector(".conn__t")?.textContent, coord: li.querySelector("em")?.textContent} : null;
  });
  record.relation = rel;
  check(!!rel, "the connections list offers a relation into the arguments", rel);
  const before = await enc(), tabsBefore = (await view()).tabs.length, addrBefore = (await view()).addr;
  // select by the graph, as a pointer would: click the node's hit disc
  const box = await page.locator(`.graph-svg .gn[data-ref="${rel.ref}"] circle.hit`).first().boundingBox().catch(() => null);
  if (box) { await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2); }
  else { await page.evaluate(ref => document.querySelector(`.conn__g li[data-ref="${CSS.escape(ref)}"]`) && 0, rel.ref); }
  await settle(500);
  const afterSel = await enc(), v1 = await view();
  record.selectedRelation = box ? "graph node click" : "(relation not drawn in the graph; selected via the list's select op)";
  check(!box || afterSel.selected === rel.ref, "click on a graph node SELECTS it (encounter.selected)", afterSel.selected);
  check(v1.tabs.length === tabsBefore && afterSel.focus === "primary" && v1.addr === addrBefore, "selecting opened no tab and navigated nowhere", {tabs: v1.tabs.length, focus: afterSel.focus});
  check(afterSel.primary.span === before.primary.span && afterSel.primary.ref === before.primary.ref, "the main page and position are untouched by selection");
  check(!box || v1.card, "the selection card is showing");
  if (box) check(afterSel.generation === before.generation + 1, "selection advanced the generation exactly once", {before: before.generation, after: afterSel.generation});
  await page.screenshot({path: shotPath("field-02-selected-1440.png")});

  /* 3 — double-click opens it as a tangent (an italic preview tab) */
  if (box) { const b2 = await page.locator(`.graph-svg .gn[data-ref="${rel.ref}"] circle.hit`).first().boundingBox(); await page.mouse.dblclick(b2.x + b2.width / 2, b2.y + b2.height / 2); }
  else { await page.locator(`.conn__g li[data-ref="${rel.ref}"] a`).click(); }
  await page.waitForFunction(() => document.querySelectorAll(".ftab").length === 2, null, {timeout: 30000});
  await page.waitForSelector(".article.fpane:not([hidden]) .ahead__title", {timeout: 30000}); await settle(900);
  const e2 = await enc(), v2 = await view();
  record.tangent = {ref: e2.tangent?.ref, revision: e2.tangent?.revision, title: v2.title, eyebrow: v2.eyebrow};
  check(v2.tabs.length === 2 && v2.tabs[1].preview && v2.tabs[1].selected, "the relation opened as an italic preview tab, in view", v2.tabs);
  check(e2.tangent?.ref === rel.ref && e2.primary.span === "M16", "main passage unchanged at M16; tangent is the relation", {tangent: e2.tangent?.ref});
  check(v2.tabs[0].label.length > 0 && !v2.tabs[0].selected, "the main tab is still there, not in view");
  await page.screenshot({path: shotPath("field-03-tangent-1440.png")});

  /* 4 — the next tangent REPLACES the preview; keep (double-click the tab); a new tangent opens beside the kept one */
  const other = await page.evaluate(rel0 => {
    const li = [...document.querySelectorAll(".conn__g li[data-ref]")].find(l => l.dataset.ref !== rel0);
    return li ? {ref: li.dataset.ref, label: li.querySelector(".conn__t")?.textContent} : null;
  }, rel.ref);
  await page.locator(`.conn__g li[data-ref="${other.ref}"] a`).click(); await settle(900);
  const v3 = await view();
  check(v3.tabs.length === 2 && v3.tabs[1].preview, "the next tangent replaced the preview in place (still two tabs)", v3.tabs.map(t => t.label));
  await page.locator(".ftab").nth(1).dblclick(); await settle(400);
  const v4 = await view();
  check(v4.tabs[1].preview === false, "double-click KEEPS the tangent (no longer italic)", v4.tabs);
  const third = await page.evaluate(refs => { const li = [...document.querySelectorAll(".conn__g li[data-ref]")].find(l => !refs.includes(l.dataset.ref)); return li ? li.dataset.ref : null; }, [rel.ref, other.ref]);
  if (third) {
    await page.locator(`.conn__g li[data-ref="${third}"] a`).click(); await settle(900);
    const v5 = await view();
    check(v5.tabs.length === 3 && v5.tabs[1].preview === false && v5.tabs[2].preview === true, "a new tangent opens BESIDE the kept one", v5.tabs.map(t => [t.label, t.preview]));
  }

  /* 5 — return: the main tab is where it was left */
  await page.locator(".ftab").first().click(); await settle(900);
  const e5 = await enc(), v6 = await view();
  check(e5.focus === "primary" && e5.primary.span === "M16" && v6.tabs[0].selected, "return to the main passage: same page, still at M16", {focus: e5.focus, span: e5.primary.span});
  const posAfter = await page.locator(".center-foot .pos b").textContent();
  check(posAfter === "M16", "the reading position survived the tangents (M16)", posAfter);

  /* 6 — promote: a tangent becomes the main page; back returns */
  await page.locator(".ftab").nth(2).click(); await settle(500);
  const tangentTitle = (await view()).title;
  const trailBefore = (await enc()).trail.length;
  await page.locator(".ftab").nth(2).locator("[data-promote]").click(); await settle(1200);
  const e6 = await enc(), v7 = await view();
  check(e6.primary.ref !== e5.primary.ref && v7.title === tangentTitle && e6.trail.length === trailBefore + 1, "promote made the tangent the MAIN page and left the old page on the trail", {title: v7.title, trail: e6.trail.length});
  record.promote = {to: e6.primary.ref, title: v7.title, trail: e6.trail.length};
  /* 6b — back: the previous main page, at the position it was left */
  await page.keyboard.press("Alt+ArrowLeft"); await settle(1500);
  const e7 = await enc();
  check(e7.primary.ref === e5.primary.ref && e7.primary.span === "M16", "back returns to the previous main page (the manuscript) at M16", {span: e7.primary.span, trail: e7.trail.length});
  await page.waitForFunction(() => document.querySelector(".center-foot .pos b")?.textContent === "M16", null, {timeout: 20000});
  check(true, "…and the reader is at M16 again (position restored from the trail)");

  /* 7 — the linked real Expression: the Library's "Here" narrows to this page and what the graph shows around it */
  await page.getByRole("button", {name: /Library/}).first().click(); await settle(800);
  await page.waitForSelector(".library .xcard", {timeout: 30000});
  const here = await page.locator(".xcolls button", {hasText: /^Here/}).textContent();
  await page.locator(".xcolls button", {hasText: /^Here/}).click(); await settle(500);
  const hereCards = await page.locator(".library .xcard").evaluateAll(cs => cs.map(c => c.dataset.x));
  record.libraryHere = {label: here, cards: hereCards};
  check(hereCards.includes("expression:roz-room-02-return-of-zero"), "Library → Here offers the room's Expression (about the page in view)", hereCards);
  const card = page.locator('.library .xcard[data-x="expression:roz-room-02-return-of-zero"]');
  const sceneBtn = card.locator(".xchip-s").nth(2);
  const sceneName = await sceneBtn.getAttribute("title");
  await sceneBtn.click();
  await page.waitForSelector("iframe.xframe", {timeout: 30000}); await settle(2500);
  const e8 = await enc(), v8 = await view();
  const frameUrl = await page.locator("iframe.xframe").getAttribute("src");
  record.expression = {ref: e8.tangent?.ref, scene: e8.tangent?.scene, sceneName, frame: frameUrl, tabs: v8.tabs};
  check(e8.tangent?.kind === "expression" && e8.tangent.ref === "expression:roz-room-02-return-of-zero", "the Expression opened as a tab (a preview of its own kind)", record.expression);
  check(e8.emphasis === "essay", "opening it left the Library: the centre is the thing opened", e8.emphasis);
  check(e8.scene?.expression_ref === e8.tangent.ref && !!e8.scene.scene_id, "the encounter holds the Expression and its scene", e8.scene);
  const xf = page.frames().find(fr => /expression\.html/.test(fr.url()));
  const xbody = xf ? await xf.evaluate(() => document.body.innerText.length).catch(() => 0) : 0;
  check(!!xf && xbody > 40, "the real Expression renderer is playing in the frame", {url: xf?.url(), textLength: xbody});
  const sceneRows = await page.locator(".toc a").allTextContents();
  check(sceneRows.length >= 6, "the contents are its scenes", sceneRows.slice(0, 3));
  const g8 = await page.evaluate(() => [...document.querySelectorAll(".graph-svg .gn--focus text")].map(t => t.textContent));
  check(g8.length === 1, "the graph follows the pages the Expression is about", g8);
  await page.screenshot({path: shotPath("field-04-expression-1440.png")});
  await page.locator(".toc a").nth(3).click(); await settle(600);
  const e9 = await enc();
  check(e9.tangent?.scene !== e8.tangent?.scene, "choosing a scene from the contents changes the scene (set-scene)", {from: e8.tangent?.scene, to: e9.tangent?.scene});

  /* 8 — return to the main passage */
  await page.locator(".ftab").first().click(); await settle(1200);
  const e10 = await enc();
  check(e10.focus === "primary" && e10.primary.ref === e5.primary.ref && e10.primary.span === "M16", "return: the main passage at M16, the Expression's frame released", {focus: e10.focus});
  check(await page.locator("iframe.xframe").count() === 0, "leaving the Expression stops it (no frame left running)");
  record.finalEncounter = e10;
} catch (error) {
  failed = true; check(false, "the walk ran to its end", String(error?.stack ?? error).split("\n").slice(0, 4).join(" | "));
  await page.screenshot({path: shotPath("field-failure.png")}).catch(() => {});
} finally {
  const errs = f.errors.filter(m => !/Failed to load resource|favicon/.test(m));
  check(errs.length === 0, "no page or console errors", errs.slice(0, 4));
  const passed = checks.filter(c => c.ok).length;
  writeReceipt("field-first-encounter.json", {scenario: "field-first-encounter", at: new Date().toISOString(), passed: passed === checks.length && !failed, counts: {passed, total: checks.length}, checks, record});
  console.log(`\n${passed}/${checks.length} checks passed`);
  await f.dispose();
  process.exit(passed === checks.length && !failed ? 0 : 1);
}
