#!/usr/bin/env node
// The UX transfer gaps, closed with checks (docs/cradle/CENTRAL-FIELD-UX-TRANSFER.md). Each section is one UX item; each check
// names what the site does (site/tests/essay-reader-controls.py) and asserts the native field does it, by pointer AND by keyboard
// where the site has both.
//   UX4  the graph and the connections list share the filter and the same neighbourhood
//   UX5  breadcrumbs (structural labels, every crumb a way back, sibling and folder menus) and the pager
//   UX7  Expression marks on the page head, the explorer, the graph and the connections list; the Library "Here" and its filters
//   UX2  keep and promote by keyboard (the product bindings added with this walk)
//   UX3  dragging a node moves it and neither selects nor navigates
//   FIELD_SITE_ROOT=<site root> node walk/scenarios/field-ux-transfer.mjs
import {bootField, shotPath, writeReceipt} from "../lib/field-walk.mjs";

const checks = [], record = {};
const check = (ok, label, detail) => { checks.push({ok: !!ok, label, ...(detail !== undefined ? {detail} : {})}); console.log(`${ok ? "PASS" : "FAIL"} — ${label}${detail !== undefined ? " · " + JSON.stringify(detail).slice(0, 300) : ""}`); };
const f = await bootField({epi: true});
const {page} = f;
const settle = ms => page.waitForTimeout(ms);
const enc = async () => JSON.parse(await page.locator(".field-root").getAttribute("data-encounter"));
const title = () => page.evaluate(() => document.querySelector(".article.fpane:not([hidden]) .ahead__title")?.textContent ?? null);
const search = page.getByRole("searchbox", {name: "Search"});
// The hit order changes while the full text arrives, so the walk does not trust "the first hit": it walks the hit list (ArrowDown) to
// the one whose ref or title matches, then opens that as the MAIN page (Shift+Enter).
const openMainBySearch = async (q, want = null) => {
  await search.fill(q); await settle(900);
  for (let k = 0; k < 12; k++) {
    const hit = await page.evaluate(() => { const li = document.querySelector(".hit.is-active"); return li ? {ref: li.dataset.hov ?? "", title: li.querySelector(".hit__t")?.textContent ?? ""} : null; });
    if (!want || (hit && (want.test(hit.ref) || want.test(hit.title)))) break;
    await page.keyboard.press("ArrowDown"); await settle(120);
  }
  await search.press("Shift+Enter"); await settle(1500); await search.fill(""); await page.keyboard.press("Escape");
};
const MANUSCRIPT = /THE-RETURN-OF-ZERO\.md$/;
const sameSet = (a, b) => a.length === b.length && a.every(x => b.includes(x));
const graphRefs = () => page.evaluate(() => [...document.querySelectorAll(".graph-svg .gn[data-ref]")].filter(g => !g.classList.contains("gn--focus")).map(g => g.dataset.ref).sort());
const connRefs = () => page.evaluate(() => [...document.querySelectorAll(".conn__g li[data-ref]")].map(l => l.dataset.ref).sort());
const settleGraph = async () => { await settle(300); await graphReady(1); };
// the graph is drawn by a live simulation: before anything is read off it or dragged, wait until it has nodes AND has stopped moving
const posNow = () => page.evaluate(() => Object.fromEntries([...document.querySelectorAll(".graph-svg .gn[data-ref]")].map(g => { const m = /translate\(([-\d.]+)[ ,]([-\d.]+)\)/.exec(g.getAttribute("transform") ?? ""); return [g.dataset.ref, m ? [Number(m[1]), Number(m[2])] : [0, 0]]; })));
const graphReady = async (min = 6, ms = 30000) => {
  const end = Date.now() + ms; let prev = null;
  while (Date.now() < end) {
    const cur = await posNow(), refs = Object.keys(cur);
    if (refs.length >= min && refs.every(r => r && r !== "undefined")) {
      if (prev && refs.length === Object.keys(prev).length && refs.every(r => prev[r] && Math.hypot(cur[r][0] - prev[r][0], cur[r][1] - prev[r][1]) < 0.5)) return refs.length;
      prev = cur;
    } else prev = null;
    await settle(350);
  }
  throw new Error(`the graph did not settle with at least ${min} nodes within ${ms} ms`);
};
const relsNow = async n => { const end = Date.now() + 30000; for (;;) { const r = await page.evaluate(() => [...document.querySelectorAll(".conn__g li[data-ref]")].map(l => l.dataset.ref).filter(x => x && /\/arguments\//.test(decodeURIComponent(x)) && !/README/.test(decodeURIComponent(x)))); if (r.length >= n) return r.slice(0, n); if (Date.now() > end) throw new Error(`only ${r.length} argument relations were offered (wanted ${n})`); await settle(300); } };
const closeTabs = async () => { for (let k = 0; k < 8 && await page.locator(".ftab").count() > 1; k++) { await page.locator(".ftab").last().locator("[data-close]").click({force: true}).catch(() => {}); await settle(200); } };
let failed = false;
try {
  await page.waitForSelector(".article.fpane:not([hidden]) .ahead__title", {timeout: 60000});
  await openMainBySearch("The Return of Zero", MANUSCRIPT);
  await page.locator(".mrail__t[data-span='M16']").click({force: true});
  await page.waitForFunction(() => document.querySelector(".field-root")?.getAttribute("data-encounter")?.includes('"span":"M16"'), null, {timeout: 30000}); await settle(1500);

  /* ───── UX4 — one filter, one neighbourhood ───── */
  await graphReady();
  const g0 = await graphRefs(), c0 = await connRefs();
  check(g0.length >= 6 && sameSet(g0, c0), "UX4 graph and connections list show the same neighbourhood (same refs)", {graph: g0.length, connections: c0.length});
  const btn = page.locator("[data-filter-btn]");
  check(await btn.evaluate(b => !b.classList.contains("is-on")), "UX4 no filter is active at first (no dot on the filter button)");
  await btn.click(); await settle(300);
  check(await page.locator(".gmenu").count() === 1, "UX4 the filter is one icon that opens one menu");
  const groups = await page.evaluate(() => [...document.querySelectorAll(".gmenu input[data-reg]")].map(i => ({id: i.dataset.reg, n: Number(i.closest("label").querySelector("b").textContent)})));
  const target = groups.find(g => g.n > 0 && g.n < g0.length) ?? groups.find(g => g.n > 0);
  await page.locator(`.gmenu label.gm__row:has(input[data-reg="${target.id}"])`).click(); await settleGraph();
  const g1 = await graphRefs(), c1 = await connRefs();
  record.hide = {group: target.id, n: target.n, before: g0.length, after: g1.length};
  check(g1.length === g0.length - target.n && sameSet(g1, c1), "UX4 hiding a register removes its nodes from the graph AND the connections list, and they still agree", {hidden: target.id, removed: g0.length - g1.length, menuCount: target.n});
  check(await btn.evaluate(b => b.classList.contains("is-on")), "UX4 a dot says a filter is active");
  await page.locator(".gmenu [data-all]").click(); await settleGraph();
  check(sameSet(await graphRefs(), g0) && sameSet(await connRefs(), c0), "UX4 'Show everything' restores both lists to the first neighbourhood");
  await page.locator(".gmenu .seg button", {hasText: "2 hops"}).click(); await settleGraph();
  const g2 = await graphRefs(), c2 = await connRefs();
  check(g2.length > g0.length && g0.every(r => g2.includes(r)), "UX4 two hops reaches further in the graph (a superset of the direct neighbourhood)", {one: g0.length, two: g2.length});
  check(sameSet(c2, c0) && await page.locator(".graph-count").textContent() === String(c0.length), "UX4 reach changes what the graph draws, never the direct connections: the list and the header count stay the direct neighbourhood (as on the site)", {list: c2.length, count: await page.locator(".graph-count").textContent()});
  await page.locator(".gmenu .seg button", {hasText: "1 hop"}).click(); await settleGraph();
  // keyboard: Enter on the filter button opens the menu, Space toggles a register's checkbox, Escape closes and returns to the button
  await page.keyboard.press("Escape"); await settle(300);
  check(await page.locator(".gmenu").count() === 0 && await page.evaluate(() => document.activeElement?.hasAttribute("data-filter-btn")), "UX4 keyboard: Escape closes the filter menu and returns to the filter button");
  await btn.focus(); await page.keyboard.press("Enter"); await settle(300);
  check(await page.locator(".gmenu").count() === 1, "UX4 keyboard: Enter on the filter button opens the menu");
  await page.locator(`.gmenu input[data-reg="${target.id}"]`).focus(); await page.keyboard.press("Space"); await settleGraph();
  const g3 = await graphRefs(), c3 = await connRefs();
  check(g3.length === g0.length - target.n && sameSet(g3, c3), "UX4 keyboard: Space on a register's checkbox hides it everywhere, and the two lists agree", {graph: g3.length, connections: c3.length});
  await page.locator(".gmenu [data-all]").focus(); await page.keyboard.press("Enter"); await settleGraph();
  check(sameSet(await graphRefs(), g0) && sameSet(await connRefs(), c0), "UX4 keyboard: Enter on 'Show everything' restores both");
  await page.keyboard.press("Escape"); await settle(200);

  /* ───── UX5 — breadcrumbs and the pager ───── */
  await openMainBySearch("Dimensional Reframing", /^Dimensional Reframing|dimensional-reframing-at-zero-and-infinity\.md$/);
  const crumbs = await page.evaluate(() => [...document.querySelectorAll(".breadcrumb-container .cr")].map(c => ({label: c.querySelector(".cr__l")?.textContent ?? "", tag: c.querySelector(".cr__l")?.tagName, sib: !!c.querySelector(".cr__s"), cur: c.classList.contains("cr--cur")})));
  record.crumbs = crumbs;
  check(crumbs.length >= 4 && crumbs.every(c => !/[\/]|\.md$/.test(c.label)), "UX5 breadcrumbs are structural labels, not slugs or paths", crumbs.map(c => c.label));
  check(crumbs.filter(c => !c.cur).every(c => c.tag === "A" || c.tag === "BUTTON") && crumbs.at(-1).cur, "UX5 every crumb but the last is a way back (a link, or a button that opens what is in the folder)");
  const here0 = (await enc()).primary.ref;
  const sibBtn = page.locator('.breadcrumb-container .cr__s[aria-label="Siblings of Concepts"]');
  await sibBtn.click(); await settle(300);
  const pop = await page.evaluate(() => ({n: document.querySelectorAll(".cpop li").length, head: document.querySelector(".cpop__h")?.textContent, items: [...document.querySelectorAll(".cpop li a")].slice(0, 5).map(a => a.textContent)}));
  check(pop.n >= 2, "UX5 a separator opens that level's siblings (the sibling menu lists the folders beside it)", pop);
  await page.keyboard.press("Escape"); await settle(200);
  check(await page.locator(".cpop").count() === 0, "UX5 keyboard: Escape puts the sibling menu away");
  await sibBtn.focus(); await page.keyboard.press("Enter"); await settle(300);
  check(await page.locator(".cpop").count() === 1, "UX5 keyboard: Enter on a separator opens the sibling menu");
  const sibTarget = page.locator(".cpop li a:not(.is-here)").first();
  const sibLabel = await sibTarget.textContent();
  await sibTarget.focus(); await page.keyboard.press("Enter"); await settle(1800);
  const eS = await enc();
  check(eS.primary.ref !== here0 && await page.locator(".cpop").count() === 0, "UX5 keyboard: Enter on a sibling turns the main page to it and puts the menu away", {to: sibLabel});
  await page.keyboard.press("Alt+ArrowLeft"); await settle(1500);
  check((await enc()).primary.ref === here0, "UX5 clicking back (Alt+Left) returns through the pages the crumbs took");
  // pointer: a crumb link goes up a level; its menu item from the pointer
  await page.locator(".breadcrumb-container .cr__l[data-ni]").nth(1).click(); await settle(1800);
  const eU = await enc();
  check(eU.primary.ref !== here0 && (await title()) != null, "UX5 clicking a crumb goes back up the structure (the main page turns to that level)", {title: await title()});
  await page.keyboard.press("Alt+ArrowLeft"); await settle(1200);
  await sibBtn.click(); await settle(300);
  await page.locator(".cpop li a:not(.is-here)").first().click(); await settle(1800);
  check((await enc()).primary.ref !== here0 && await page.locator(".cpop").count() === 0, "UX5 pointer: a sibling in the menu turns the main page to it");
  await page.keyboard.press("Alt+ArrowLeft"); await settle(1200);
  // a folder crumb opens what is in it
  await openMainBySearch("Awareness becomes articulate", MANUSCRIPT);
  const folder = page.locator(".breadcrumb-container button.cr__f").first();
  if (await folder.count()) {
    await folder.click(); await settle(300);
    check(await page.locator(".cpop li").count() >= 1, "UX5 a folder crumb opens its contents (the movements/pages inside it)", {items: await page.locator(".cpop li").count()});
    await page.keyboard.press("Escape");
  } else check(false, "UX5 a folder crumb exists on the manuscript page");
  // the pager
  await openMainBySearch("The Integral Threshold", /^The Integral Threshold/);
  const room0 = (await enc()).primary.ref, t0 = await title();
  check(await page.locator(".pager__next").count() === 1, "UX5 a room page has a pager with a next link", {title: t0});
  await page.locator(".pager__next").click(); await settle(1800);
  const eN = await enc(), t1 = await title();
  check(eN.primary.ref !== room0 && t1 !== t0 && eN.trail.length >= 1, "UX5 pointer: the pager turns the main page to the next room (and the old page goes on the trail)", {from: t0, to: t1});
  check(await page.locator(".pager__prev").count() === 1, "UX5 after the turn the pager offers the way back (prev)");
  await page.locator(".pager__prev").click(); await settle(1800);
  check((await enc()).primary.ref === room0, "UX5 pointer: prev returns to the first room");
  await page.locator(".pager__next").focus(); await page.keyboard.press("Enter"); await settle(1800);
  check((await enc()).primary.ref !== room0 && (await title()) === t1, "UX5 keyboard: Enter on the pager's next link turns the page the same way", {to: await title()});
  await page.locator(".pager__prev").focus(); await page.keyboard.press("Enter"); await settle(1800);
  check((await enc()).primary.ref === room0, "UX5 keyboard: Enter on prev returns");

  /* ───── UX7 — Expression marks, chips, the Library 'Here' ───── */
  await openMainBySearch("The Return of Zero", MANUSCRIPT);
  await page.locator(".mrail__t[data-span='M16']").click({force: true}); await settle(1500);
  await graphReady();
  const marks = await page.evaluate(() => ({
    chips: [...document.querySelectorAll(".article.fpane:not([hidden]) .ahead__x .xchip")].map(c => c.dataset.x),
    tree: document.querySelectorAll(".tree-host .tn__x").length,
    rings: [...document.querySelectorAll(".graph-svg .gn.has-x")].filter(g => !g.classList.contains("gn--focus")).map(g => g.dataset.ref).sort(),
    connX: [...document.querySelectorAll(".conn__g li[data-ref]")].filter(l => l.querySelector(".conn__x")).map(l => l.dataset.ref).sort(),
  }));
  record.marks = {chips: marks.chips, tree: marks.tree, rings: marks.rings.length, conn: marks.connX.length};
  check(marks.chips.length >= 1 && marks.chips.every(x => x.startsWith("expression:")), "UX7 a page with an Expression says so under its title (a chip per Expression)", marks.chips);
  check(marks.tree >= 3, "UX7 explorer rows mark the pages that have an Expression", {rows: marks.tree});
  check(marks.rings.length >= 1, "UX7 the graph rings the nodes that have an Expression", {rings: marks.rings.length});
  check(marks.connX.length >= 1 && sameSet(marks.rings, marks.connX), "UX7 the connections list marks exactly the nodes the graph rings", {graph: marks.rings.length, list: marks.connX.length});
  // the chip opens the Expression: pointer, then keyboard
  await page.locator(".article.fpane:not([hidden]) .ahead__x .xchip").first().click(); await page.waitForSelector("iframe.xframe", {timeout: 30000}); await settle(1200);
  let eX = await enc();
  check(eX.tangent?.kind === "expression" && eX.tangent.ref === marks.chips[0], "UX7 pointer: the chip opens its Expression as a tab", {ref: eX.tangent?.ref});
  await page.locator(".ftab").first().click(); await settle(900);
  await page.locator(".article.fpane:not([hidden]) .ahead__x .xchip").first().focus(); await page.keyboard.press("Enter"); await page.waitForSelector("iframe.xframe", {timeout: 30000}); await settle(1200);
  eX = await enc();
  check(eX.tangent?.kind === "expression" && eX.tangent.ref === marks.chips[0], "UX7 keyboard: Enter on the chip opens the Expression the same way");
  await page.locator(".ftab").first().click(); await settle(900);
  // the Library and 'Here'
  await page.locator(".field-root").focus(); await page.keyboard.press("l"); await page.locator(".library .xcard").first().waitFor({timeout: 30000}); await settle(600);
  const count = () => page.evaluate(() => ({cards: document.querySelectorAll(".library .xcard").length, said: document.querySelector(".xcount")?.textContent ?? ""}));
  const all0 = await count();
  const hereLabel = await page.locator(".xcolls button", {hasText: /^Here/}).textContent(); const hereN = Number(/(\d+)/.exec(hereLabel)[1]);
  await page.locator(".xcolls button", {hasText: /^Here/}).click(); await settle(500);
  const here1 = await count(), allHere = await page.evaluate(() => [...document.querySelectorAll(".library .xcard")].every(c => c.classList.contains("is-here")));
  check(hereN >= 1 && here1.cards === hereN && allHere, "UX7 'Here' counts the Expressions about this page and its neighbourhood, narrows the gallery to exactly them, and marks them", {label: hereLabel, cards: here1.cards, said: here1.said});
  check(here1.cards < all0.cards && /here/.test(here1.said), "UX7 the count line says the gallery is narrowed (\"here\")", {all: all0.cards, here: here1.cards});
  const coll = page.locator(".xcolls button").nth(2), collLabel = await coll.textContent(), collN = Number(/·\s*(\d+)/.exec(collLabel)[1]);
  await coll.click(); await settle(500);
  const c1x = await count();
  check(c1x.cards === collN, "UX7 a collection filters the gallery to its members", {label: collLabel, cards: c1x.cards});
  await page.locator(".xcolls button").first().click(); await settle(400);
  const probe = await page.evaluate(() => document.querySelector(".library .xcard .xcard__copy strong")?.textContent ?? "");
  const word = probe.split(/\s+/).filter(w => w.length > 4)[0] ?? probe;
  await page.locator(".xsearch input").fill(word); await settle(500);
  const s1 = await count();
  check(s1.cards >= 1 && s1.cards < all0.cards && /matching/.test(s1.said), "UX7 search finds an Expression by what it says", {query: word, cards: s1.cards});
  await page.locator(".xsearch input").fill(""); await settle(300);
  // opening a card: the keyboard route (the gap the record named)
  await page.locator(".library .xcard__open").first().focus(); await page.keyboard.press("Enter"); await page.waitForSelector("iframe.xframe", {timeout: 30000}); await settle(1200);
  eX = await enc();
  check(eX.tangent?.kind === "expression", "UX7 keyboard: Enter on a Library card opens the Expression as a tab, leaving the Library", {ref: eX.tangent?.ref});
  await page.locator(".ftab").first().click(); await settle(900);

  /* ───── UX2 — keep and promote by keyboard (product bindings) ───── */
  await closeTabs();
  await openMainBySearch("The Return of Zero", MANUSCRIPT);
  await page.locator(".mrail__t[data-span='M16']").click({force: true}); await settle(1200);
  const mainRef = (await enc()).primary.ref;
  await graphReady();
  const rels = await relsNow(2);      // M16 offers two argument relations (the first-encounter walk finds the same two)
  check(rels.length === 2 && rels.every(r => !!r), "UX2/UX3 setup: two argument relations are offered and the graph has settled", rels.map(r => r.split("/").at(-1)));
  const node = r => page.locator(`.graph-svg .gn[data-ref="${r}"] circle.hit`).first();
  const dbl = async r => { const b = await node(r).boundingBox(); await page.mouse.dblclick(b.x + b.width / 2, b.y + b.height / 2); await settle(1300); };
  await dbl(rels[0]);
  check((await enc()).tangent?.ref === rels[0] && await page.locator(".ftab--preview").count() === 1, "UX2 a tangent is open as a preview (italic)");
  await page.locator(".field-root").focus(); await page.keyboard.press("k"); await settle(500);
  check(await page.locator(".ftab--preview").count() === 0 && (await enc()).tabs.some(t => t.ref === rels[0] && !t.preview), "UX2 keyboard: K keeps the tangent in view (no longer a preview)");
  await dbl(rels[1]);
  const previewTab = page.locator(".ftab--preview").first();
  check(await previewTab.count() === 1 && (await enc()).tabs.length === 2, "UX2 a new tangent opens beside the kept one", {tabs: (await enc()).tabs.length});
  await previewTab.focus(); await page.keyboard.press("k"); await settle(400);
  check(await page.locator(".ftab--preview").count() === 0, "UX2 keyboard: K on a focused preview tab keeps it");
  // promote: Shift+Enter on a focused tab, and P with a tangent in view
  const kept = page.locator(".ftab").nth(2);
  await kept.focus(); await page.keyboard.press("Shift+Enter"); await settle(1500);
  const eP = await enc();
  check(eP.primary.ref !== mainRef && eP.trail.length >= 1, "UX2 keyboard: Shift+Enter on a tab opens it as the main page (the old page goes on the trail)", {primary: eP.primary.ref.split("/").at(-1)});
  await page.keyboard.press("Alt+ArrowLeft"); await settle(1500);
  check((await enc()).primary.ref === mainRef, "UX2 Alt+Left returns to the previous main page after a keyboard promote");
  await page.locator(".ftab").nth(1).click(); await settle(700);
  await page.locator(".field-root").focus(); await page.keyboard.press("p"); await settle(1500);
  check((await enc()).primary.ref !== mainRef, "UX2 keyboard: P with a tangent in view opens it as the main page");
  await page.keyboard.press("Alt+ArrowLeft"); await settle(1200);
  await closeTabs(); await dbl(rels[0]);
  const closing = page.locator(".ftab").last(); const nTabs = await page.locator(".ftab").count();
  await closing.focus(); await page.keyboard.press("Delete"); await settle(500);
  check(await page.locator(".ftab").count() === nTabs - 1, "UX2 keyboard: Delete on a focused tab closes it (middle-click, by keyboard)", {before: nTabs, after: await page.locator(".ftab").count()});

  /* ───── UX3 — dragging a node ───── */
  for (let k = 0; k < 6 && await page.locator(".ftab").count() > 1; k++) { await page.locator(".ftab").last().locator("[data-close]").click({force: true}).catch(() => {}); await settle(150); }
  await page.locator(".graph-svg").focus(); await page.keyboard.press("Escape"); await settle(800);
  const pos = posNow;
  const dist = (a, b, r) => Math.hypot(a[r][0] - b[r][0], a[r][1] - b[r][1]);
  await graphReady();
  const live = await posNow(), mainNow = (await enc()).primary.ref;
  const dragRef = Object.keys(live).find(r => r !== mainNow && !!r && r !== "undefined" && rels.includes(r)) ?? Object.keys(live).find(r => !!r && r !== "undefined");
  check(!!dragRef && dragRef !== "undefined", "UX3 setup: a real node ref is chosen to drag from the settled graph", dragRef?.split("/").at(-1));
  const before = await pos(), e0 = await enc(), tabs0 = (await enc()).tabs.length;
  const bb = await node(dragRef).boundingBox(); const cx = bb.x + bb.width / 2, cy = bb.y + bb.height / 2;
  await page.mouse.move(cx, cy); await page.mouse.down(); await page.mouse.move(cx + 20, cy + 15, {steps: 4}); await page.mouse.move(cx + 70, cy + 50, {steps: 8}); await settle(250);
  const mid = await pos(); await page.mouse.up(); await settle(1000);
  const after = await pos(), e1 = await enc();
  const others = Object.keys(before).filter(r => r !== dragRef && dist(mid, before, r) > 0.5);
  check(dist(mid, before, dragRef) > 40, "UX3 dragging a node moves it under the pointer", {px: Math.round(dist(mid, before, dragRef))});
  check(others.length >= 2, "UX3 dragging a node moves what it is linked to (live re-simulation)", {others: others.length});
  check(dist(after, mid, dragRef) < 8, "UX3 a dropped node stays where it was dropped", {px: Math.round(dist(after, mid, dragRef))});
  check(e1.selected === e0.selected && e1.tabs.length === tabs0 && e1.primary.ref === e0.primary.ref && e1.generation === e0.generation, "UX3 a drag neither selects nor navigates nor changes the encounter (generation unchanged)", {generation: [e0.generation, e1.generation]});
  await page.screenshot({path: shotPath("field-ux-transfer-1440.png")});
} catch (error) {
  failed = true; check(false, "the walk ran to its end", String(error?.stack ?? error).split("\n").slice(0, 5).join(" | "));
  await page.screenshot({path: shotPath("field-ux-transfer-failure.png")}).catch(() => {});
} finally {
  const errs = f.errors.filter(m => !/Failed to load resource|favicon/.test(m));
  check(errs.length === 0, "no page or console errors", errs.slice(0, 4));
  const passed = checks.filter(c => c.ok).length;
  writeReceipt("field-ux-transfer.json", {scenario: "field-ux-transfer", at: new Date().toISOString(), record, passed: passed === checks.length && !failed, counts: {passed, total: checks.length}, checks});
  console.log(`\n${passed}/${checks.length} checks passed`);
  await f.dispose();
  process.exit(passed === checks.length && !failed ? 0 : 1);
}
