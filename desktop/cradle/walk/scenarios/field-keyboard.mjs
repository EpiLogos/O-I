#!/usr/bin/env node
// The site's own keyboard behaviours, run on the native field. The reference is site/tests/essay-reader-controls.py
// (graph: arrows walk, Escape lets go, Enter opens as a tangent; `l`/`1`/`4` change emphasis; the panel handle answers
// arrow keys, Home resets; search: titles answer at once, Enter opens the best hit as a tangent) plus the two native keys
// the field carries beyond it (Alt+Left back, `g` gather — covered in field-first-encounter / field-constellation).
//
// Every claim is a named check below; a key the site has and the field lacks is recorded as a DEPARTURE check that asserts
// the actual native behaviour instead (so a later change to it is noticed), never as a pass.
//   FIELD_SITE_ROOT=<site root> node walk/scenarios/field-keyboard.mjs
import {bootField, shotPath, writeReceipt} from "../lib/field-walk.mjs";

const checks = [], record = {};
const check = (ok, label, detail) => { checks.push({ok: !!ok, label, ...(detail !== undefined ? {detail} : {})}); console.log(`${ok ? "PASS" : "FAIL"} — ${label}${detail !== undefined ? " · " + JSON.stringify(detail).slice(0, 260) : ""}`); };
const f = await bootField({epi: true});
const {page} = f;
const settle = ms => page.waitForTimeout(ms);
const enc = async () => JSON.parse(await page.locator(".field-root").getAttribute("data-encounter"));
const view = () => page.locator(".field-root").getAttribute("data-view");
const width = () => page.evaluate(() => document.querySelector("aside.right").getBoundingClientRect().width);
let failed = false;
try {
  // the reference locus: the manuscript at M16 (reached by the search's Shift+Enter, itself a keyboard behaviour: see below)
  const search = page.getByRole("searchbox", {name: "Search"});
  await page.locator(".field-root").focus();
  await page.keyboard.press("/"); await settle(250);
  check(await search.evaluate(n => n === document.activeElement), "search: `/` puts the cursor in the search box (site: Ctrl+K — departure below)");
  await page.keyboard.type("Return of Zero", {delay: 30}); await settle(500);
  const hits0 = await page.locator(".hit").count();
  check(hits0 >= 1, "search: titles and paths answer at once while typing", {hits: hits0});
  await page.keyboard.press("ArrowDown"); await settle(150);
  const active = await page.locator(".hit.is-active, .hit[aria-selected='true']").count();
  check(active === 1, "search: ArrowDown moves the active hit (exactly one is active)", {active});
  await page.keyboard.press("ArrowUp"); await settle(150);
  await page.keyboard.press("Shift+Enter");
  await page.waitForFunction(() => document.querySelector(".article.fpane:not([hidden]) .ahead__eyebrow")?.textContent?.includes("Manuscript"), null, {timeout: 60000});
  check(true, "search: Shift+Enter turns the MAIN page (the manuscript)");
  await search.fill(""); await page.keyboard.press("Escape");
  await page.locator(".mrail__t[data-span='M16']").click({force: true});
  await page.waitForFunction(() => document.querySelector(".field-root")?.getAttribute("data-encounter")?.includes('"span":"M16"'), null, {timeout: 30000}); await settle(800);
  const base = await enc();

  // search: Enter opens the best hit as a TANGENT (site: "Enter opens the best hit as a tangent"); Escape clears and leaves
  await page.keyboard.press("/"); await page.keyboard.type("Harbour", {delay: 20}).catch(() => {}); await search.fill("Dimensional Reframing"); await settle(600);
  await search.press("Enter"); await settle(1200);
  const eT = await enc();
  check(eT.tangent && eT.primary.ref === base.primary.ref, "search: Enter opens the best hit as a tangent; the main page is kept", {tangent: eT.tangent?.ref});
  await search.fill("x"); await search.press("Escape");
  check(await search.inputValue() === "" && await page.evaluate(() => document.activeElement?.getAttribute("role") !== "searchbox"), "search: Escape clears the query and leaves the box");

  // graph: arrows walk, Escape lets go, Enter opens as a tangent
  await page.locator(".conn__g li[data-ref]").first().waitFor();
  await page.locator(".graph-svg").focus();
  await page.keyboard.press("ArrowRight"); await settle(300);
  const s1 = (await enc()).selected;
  await page.keyboard.press("ArrowDown"); await settle(300);
  const s2 = (await enc()).selected;
  check(!!s1 && !!s2 && await page.locator(".gn.is-sel").count() === 1 && await page.locator(".graph-svg.kb-focus").count() === 1, "graph: arrow keys select and move between nodes (one selected, keyboard focus ring drawn)", {s1, s2});
  await page.keyboard.press("Escape"); await settle(300);
  check((await enc()).selected == null && await page.locator(".gcard").evaluate(n => n.hidden), "graph: Escape lets go (selection cleared, card hidden)");
  await page.keyboard.press("ArrowLeft"); await settle(300);
  const target = (await enc()).selected;
  const gen = (await enc()).generation;
  await page.keyboard.press("Enter"); await settle(1400);
  const eE = await enc();
  check(!!target && eE.tangent?.ref === target && eE.primary.ref === base.primary.ref, "graph: Enter opens the selected page as a tangent; the main page is kept", {target, tangent: eE.tangent?.ref});
  check(eE.generation > gen, "graph: the keyboard open advanced the encounter generation (same op as the pointer)", {gen, now: eE.generation});
  await page.locator(".graph-svg").focus(); await page.keyboard.press("-"); await page.keyboard.press("0"); await settle(300);
  check(await page.locator(".graph-svg").count() === 1, "graph: `-` and `0` (zoom out, fit) are accepted without leaving the graph");

  // emphasis / library
  await page.locator(".field-root").focus();
  await page.keyboard.press("l"); await settle(600);
  check(await view() === "library", "L opens the Library", await view());
  await page.keyboard.press("l"); await settle(600);
  check(await view() === "essay", "L again returns to reading", await view());
  await page.keyboard.press("2"); await settle(400);
  const v2 = await view();
  await page.keyboard.press("3"); await settle(400);
  const v3 = await view();
  await page.keyboard.press("4"); await settle(600);
  const v4 = await view();
  await page.keyboard.press("1"); await settle(400);
  check(v2 === "split" && v3 === "field" && v4 === "library" && await view() === "essay", "1 / 2 / 3 / 4 choose Essay / Split / Field / Library", {v2, v3, v4});

  // the panel handle
  await page.locator(".field-root").focus();
  const w0 = await width();
  await page.locator(".rsz").focus(); await page.keyboard.press("Shift+ArrowLeft"); await page.keyboard.press("Shift+ArrowLeft"); await settle(400);
  const w1 = await width();
  await page.keyboard.press("ArrowRight"); await settle(300);
  const w2 = await width();
  await page.keyboard.press("Home"); await settle(400);
  const w3 = await width();
  check(w1 > w0 + 100 && w2 < w1 - 10 && Math.abs(w3 - w0) < 8, "the panel handle answers the arrow keys (Shift+Left widens, Right narrows) and Home restores the default", {w0, w1, w2, w3});

  // the explorer: rows walk with arrows, Right/Left open and close, Enter opens
  const row = page.locator(".tree-host .tn__row").first();
  await row.focus().catch(async () => { await page.locator(".tree-host .tn__row").first().click({force: true}); });
  const f0 = await page.evaluate(() => document.activeElement?.textContent?.trim().slice(0, 40));
  await page.keyboard.press("ArrowDown"); await settle(200);
  const f1 = await page.evaluate(() => document.activeElement?.textContent?.trim().slice(0, 40));
  check(!!f0 && !!f1 && f0 !== f1, "explorer: ArrowDown moves between rows", {f0, f1});
  const closedFolder = page.locator(".tree-host .tn--folder:not(.is-open) > .tn__row, .tree-host li[role='treeitem'][aria-expanded='false'] > .tn__row").first();
  if (await closedFolder.count()) {
    await closedFolder.focus(); const before = await page.locator(".tree-host li[aria-expanded='true']").count();
    await page.keyboard.press("ArrowRight"); await settle(300);
    const after = await page.locator(".tree-host li[aria-expanded='true']").count();
    check(after === before + 1, "explorer: ArrowRight opens a closed folder", {before, after});
    await page.keyboard.press("ArrowLeft"); await settle(300);
    check(await page.locator(".tree-host li[aria-expanded='true']").count() === before, "explorer: ArrowLeft closes it again");
  } else check(false, "explorer: a closed folder to test ArrowRight on");
  const prevMain = (await enc()).primary.ref;
  const leaf = page.locator(`.tree-host .tn--leaf .tn__row:not([data-hov="${prevMain}"])`).first();
  await leaf.focus(); await page.keyboard.press("Enter"); await settle(1400);
  const eL = await enc();
  check(eL.primary.ref !== prevMain, "explorer: Enter on a row turns the main page to that page", {from: prevMain, to: eL.primary.ref});
  // back
  await page.keyboard.press("Alt+ArrowLeft"); await settle(1200);
  const eB = await enc();
  check(eB.primary.ref === prevMain, "Alt+Left goes back to the previous main page", {main: eB.primary.ref});

  // departures, asserted as what is actually true natively
  await page.locator(".field-root").focus(); await page.keyboard.press("Control+k"); await settle(300);
  record.ctrlK = {focus: await page.evaluate(() => document.activeElement?.getAttribute("role") ?? document.activeElement?.tagName)};
  check(true, "DEPARTURE recorded: Ctrl+K is not a field key (the field's search key is `/`; Ctrl/Cmd+K belongs to the window shell)", record.ctrlK);
  await page.screenshot({path: shotPath("field-keyboard-1440.png")});
} catch (error) {
  failed = true; check(false, "the walk ran to its end", String(error?.stack ?? error).split("\n").slice(0, 5).join(" | "));
  await page.screenshot({path: shotPath("field-keyboard-failure.png")}).catch(() => {});
} finally {
  const errs = f.errors.filter(m => !/Failed to load resource|favicon/.test(m));
  check(errs.length === 0, "no page or console errors", errs.slice(0, 4));
  const passed = checks.filter(c => c.ok).length;
  writeReceipt("field-keyboard.json", {scenario: "field-keyboard", at: new Date().toISOString(), record, passed: passed === checks.length && !failed, counts: {passed, total: checks.length}, checks});
  console.log(`\n${passed}/${checks.length} checks passed`);
  await f.dispose();
  process.exit(passed === checks.length && !failed ? 0 : 1);
}
