#!/usr/bin/env node
// The same field, Epi world OFF, on an ordinary linked corpus that is not the essay (tests/fixtures/field-corpus,
// copied in as a Work project of a disposable ground and read through Central's own file reads by the prebuilt walk
// bridge): choose the corpus, open it, select a relation (no navigation), open a tangent, keep, replace, promote, back.
//   FIELD_SITE_ROOT=<any built site root, only so the Epi edition server can start> node walk/scenarios/field-generic-encounter.mjs
import {bootField, shotPath, writeReceipt} from "../lib/field-walk.mjs";
import {fileURLToPath} from "node:url";

const checks = [];
const check = (ok, label, detail) => { checks.push({ok: !!ok, label, ...(detail !== undefined ? {detail} : {})}); console.log(`${ok ? "PASS" : "FAIL"} — ${label}${detail !== undefined ? " · " + JSON.stringify(detail).slice(0, 200) : ""}`); return !!ok; };
const fixture = fileURLToPath(new URL("../../tests/fixtures/field-corpus/", import.meta.url));
const f = await bootField({epi: false, fixture});
const {page} = f;
const enc = async () => JSON.parse(await page.locator(".field-root").getAttribute("data-encounter"));
const tabs = () => page.evaluate(() => [...document.querySelectorAll(".ftab")].map(t => ({label: t.querySelector(".ftab__t")?.textContent, preview: t.classList.contains("ftab--preview"), selected: t.getAttribute("aria-selected") === "true"})));
const title = () => page.locator(".article.fpane:not([hidden]) .ahead__title").textContent();
const settle = ms => page.waitForTimeout(ms);
const world = async request => (await (await fetch(`${f.bridgeUrl}/op`, {method: "POST", headers: {"content-type": "application/json"}, body: JSON.stringify({op: "expression_world", request})})).json()).outcome.data;
let failed = false;
try {
  check(await page.locator(".field-root").count() === 1, "Epi OFF: Base still opens on the field");
  // 1 — the corpus is chosen where the scope names none
  await page.waitForSelector(".field-root .stubnote .linkbtn", {timeout: 30000});
  check(/Choose a corpus/.test(await page.locator(".field-root h1").textContent()), "with no project in scope the field offers the linkable projects and assumes none");
  await page.locator(".field-root .stubnote .linkbtn", {hasText: "Field"}).click();
  await page.waitForSelector(".article.fpane:not([hidden]) .ahead__title", {timeout: 30000}); await settle(800);
  const e0 = await enc();
  check(await title() === "Harbour Notes", "the corpus opens on its own home page (the root README)", await title());
  check(e0.world_ref === "project:field-walk" && e0.primary.ref.startsWith("central:source:project:field-walk:") && /^central\.content-fnv1a64\/v1:\d+:[0-9a-f]+$/.test(e0.primary.revision), "native ref and pinned revision from the owner's read", e0.primary);
  const counts = await page.evaluate(() => ({rows: document.querySelectorAll(".tn__row").length, pages: document.querySelector(".field-root .left-foot")?.textContent, essay: !!document.querySelector(".mrail__t, .xchip")}));
  check(/7 pages/.test(counts.pages) && !counts.essay, "7 markdown pages, no rail and no Expression chips (no essay semantics)", counts);
  check(await page.locator(".conn__g li").count() >= 3, "connections list the home page's links (paths and wiki names)");
  await page.screenshot({path: shotPath("field-generic-01-home-1440.png")});

  // 2 — select a relation: no navigation
  const rel = await page.evaluate(() => { const li = [...document.querySelectorAll(".conn__g li[data-ref]")].find(l => /Alpha Tide/.test(l.textContent)); return li?.dataset.ref; });
  check(!!rel, "Alpha Tide is among the home page's connections", rel);
  const box = await page.locator(`.graph-svg .gn[data-ref="${rel}"] circle.hit`).first().boundingBox();
  const g0 = (await enc()).generation, t0 = (await tabs()).length;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2); await settle(500);
  const e1 = await enc();
  check(e1.selected === rel && (await tabs()).length === t0 && e1.focus === "primary" && e1.generation === g0 + 1, "click on a graph node SELECTS it: no tab, no navigation, generation +1", {selected: e1.selected === rel, gen: e1.generation});
  const ksel = await world({operation: "selection_read"});
  check(ksel.state === "selected" && ksel.selection.subject_ref === rel && ksel.selection.origin === "graph" && ksel.selection.native_owner === "Central" && /^central\.content-fnv1a64/.test(ksel.selection.revision), "the click IS the kernel's selection_set: selection_read names the ref, origin graph, native owner Central, the node's revision", ksel.selection);
  // 3 — double-click: a tangent
  const b2 = await page.locator(`.graph-svg .gn[data-ref="${rel}"] circle.hit`).first().boundingBox();
  await page.mouse.dblclick(b2.x + b2.width / 2, b2.y + b2.height / 2);
  await page.waitForFunction(() => document.querySelectorAll(".ftab").length === 2, null, {timeout: 20000}); await settle(900);
  let tb = await tabs();
  check(tb[1].preview && tb[1].selected && await title() === "Alpha Tide", "double-click opens it as an italic preview tab, in view", tb);
  check((await enc()).primary.ref === e0.primary.ref, "the main page is unchanged");
  let portals = (await world({operation: "portal_inspect"})).portals.filter(p => p.surface_kind === "field");
  check(portals.length === 1 && portals[0].placement === "preview" && portals[0].target_ref === rel, "the tangent IS a preview portal in the kernel, canonical ref preserved", portals.map(p => [p.placement, p.target_ref]));
  // 4 — a link in the text follows as the next tangent, replacing the preview
  await page.locator(".article.fpane:not([hidden]) a[data-fref]", {hasText: "Beta"}).first().click(); await settle(900);
  tb = await tabs();
  check(tb.length === 2 && tb[1].preview && await title() === "Beta Mooring", "a link in the text replaced the preview with the next tangent", tb);
  // 5 — keep, then a new tangent opens beside it
  await page.locator(".ftab").nth(1).dblclick(); await settle(300);
  check((await tabs())[1].preview === false, "double-click KEEPS it");
  await settle(500);
  portals = (await world({operation: "portal_inspect"})).portals.filter(p => p.surface_kind === "field");
  check(portals.length === 1 && portals[0].placement === "beside", "keep re-placed the same portal beside", portals.map(p => p.placement));
  await page.locator(".article.fpane:not([hidden]) a[data-fref]", {hasText: "gamma"}).first().click(); await settle(900);
  tb = await tabs();
  check(tb.length === 3 && !tb[1].preview && tb[2].preview && await title() === "Gamma Depth", "a new tangent opens beside the kept one", tb.map(t => [t.label, t.preview]));
  // 6 — return, promote, back
  await page.locator(".ftab").first().click(); await settle(500);
  check((await enc()).focus === "primary" && await title() === "Harbour Notes", "return to the main page");
  await page.locator(".ftab").nth(2).click(); await settle(400);
  const trail0 = (await enc()).trail.length;
  await page.locator(".ftab").nth(2).locator("[data-promote]").click(); await settle(1000);
  const e5 = await enc();
  check(await title() === "Gamma Depth" && e5.trail.length === trail0 + 1 && e5.tabs.length === 1, "promote makes the tangent the main page", {trail: e5.trail.length});
  await page.keyboard.press("Alt+ArrowLeft"); await settle(900);
  check(await title() === "Harbour Notes" && (await enc()).trail.length === trail0, "back returns to the previous main page");
  // 6b — out-of-band: another caller's selection_set moves the selected node with NO navigation; an agent's portal_open opens a tangent
  const tabsBefore = (await tabs()).length, main0 = (await enc()).primary.ref;
  await world({operation: "selection_set", origin: "agent", subject_ref: "central:source:project:field-walk:notes/deep/gamma.md", kind: "source", native_owner: "Central", revision: "ext"});
  await page.waitForFunction(() => JSON.parse(document.querySelector(".field-root").dataset.encounter).selected?.endsWith("notes/deep/gamma.md"), null, {timeout: 8000});
  const eExt = await enc();
  check((await tabs()).length === tabsBefore && eExt.focus === "primary" && eExt.primary.ref === main0, "an external selection_set moved the selected node: no tab, no navigation", {selected: eExt.selected});
  await world({operation: "portal_open", portal_ref: "agent-walk-1", target_ref: "central:source:project:field-walk:reference/glossary.md", surface_kind: "field", surface_id: "agent-walk-surface", placement: "preview", title: "Glossary", actor: "agent:walk"});
  await page.waitForFunction(n => document.querySelectorAll(".ftab").length === n + 1, tabsBefore, {timeout: 8000});
  tb = await tabs();
  check(tb.at(-1).preview && /Glossary/.test(tb.at(-1).label), "an agent's portal_open opened the same preview tab a double-click does", tb.at(-1));
  await world({operation: "portal_close", portal_ref: "agent-walk-1", actor: "agent:walk"});
  await page.waitForFunction(n => document.querySelectorAll(".ftab").length === n, tabsBefore, {timeout: 8000});
  check(true, "the agent closing the portal closed the tab");
  // 7 — search: titles and paths at once, then a tangent
  const search = page.getByRole("searchbox", {name: "Search"});
  await search.fill("gloss"); await settle(400);
  check(/Glossary/.test(await page.locator(".hit__t").first().textContent()), "search answers at once from titles and paths", await page.locator(".hit__t").allTextContents());
  await search.press("Enter"); await settle(900);
  check(await title() === "Glossary of Terms" && (await tabs()).at(-1).preview, "Enter opens the hit as a tangent");
  await search.fill(""); await settle(200);
  // 8 — the diagram: an image read through the owner's byte read
  await page.locator(".tn__label", {hasText: /^Projects$/}).first().click({force: true}); await settle(300);
  await page.locator(".tn__label", {hasText: "Project Plan"}).first().click({force: true}); await settle(1200);
  const img = await page.evaluate(() => { const i = document.querySelector(".article.fpane:not([hidden]) img"); return i ? {src: i.src.slice(0, 30), w: i.naturalWidth} : null; });
  check(!!img && /^data:image\/svg/.test(img.src) && img.w > 0, "an image beside the page is the owner's bytes, inlined", img);
  await page.screenshot({path: shotPath("field-generic-02-plan-1440.png")});
} catch (error) {
  failed = true; check(false, "the walk ran to its end", String(error?.stack ?? error).split("\n").slice(0, 4).join(" | "));
  await page.screenshot({path: shotPath("field-generic-failure.png")}).catch(() => {});
} finally {
  const errs = f.errors.filter(m => !/Failed to load resource|favicon/.test(m));
  check(errs.length === 0, "no page or console errors", errs.slice(0, 4));
  const passed = checks.filter(c => c.ok).length;
  writeReceipt("field-generic-encounter.json", {scenario: "field-generic-encounter", at: new Date().toISOString(), passed: passed === checks.length && !failed, counts: {passed, total: checks.length}, checks});
  console.log(`\n${passed}/${checks.length} checks passed`);
  await f.dispose();
  process.exit(passed === checks.length && !failed ? 0 : 1);
}
