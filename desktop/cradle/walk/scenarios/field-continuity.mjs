#!/usr/bin/env node
// Continuity. What the field holds must come back — by reload, and by closing the page and opening a new one on the same storage:
// main/tangent/kept tabs, the selected page, the reading position (M16), the Expression's scene, the emphasis and the explicit pin
// of the field in the companion's context. Each world keeps its own encounter (Epi lens off/on), and the field is intact across
// Base → Expressions → Base. Dirty editable work in a preview is guarded by the reducer (the field has no writable surface yet:
// see tests/field-model.test.mjs "a dirty standing preview is kept, never replaced").
//   FIELD_SITE_ROOT=<site root with the essay edition + expression.html> node walk/scenarios/field-continuity.mjs
import {fileURLToPath} from "node:url";
import {bootField, shotPath, writeReceipt} from "../lib/field-walk.mjs";

const checks = [], record = {};
const check = (ok, label, detail) => { checks.push({ok: !!ok, label, ...(detail !== undefined ? {detail} : {})}); console.log(`${ok ? "PASS" : "FAIL"} — ${label}${detail !== undefined ? " · " + JSON.stringify(detail).slice(0, 240) : ""}`); return !!ok; };
const fixture = fileURLToPath(new URL("../../tests/fixtures/field-corpus/", import.meta.url));
const f = await bootField({epi: true, fixture});
let page = f.page;
const settle = ms => page.waitForTimeout(ms);
const enc = async () => JSON.parse(await page.locator(".field-root").getAttribute("data-encounter"));
const view = () => page.evaluate(() => ({
  tabs: [...document.querySelectorAll(".ftab")].map(t => ({label: t.querySelector(".ftab__t")?.textContent, preview: t.classList.contains("ftab--preview"), selected: t.getAttribute("aria-selected") === "true"})),
  pos: document.querySelector(".center-foot .pos b")?.textContent ?? null,
  view: document.querySelector(".field-root")?.dataset.view,
  frame: document.querySelector("iframe.xframe")?.getAttribute("src") ?? null,
}));
const keep = e => ({world: e.world_ref, primary: e.primary, tabs: e.tabs.map(t => ({ref: t.ref, kind: t.kind, preview: t.preview, scene: t.scene, span: t.span})), focus: e.tabs.findIndex(t => t.id === e.focus), selected: e.selected, scene: e.scene, emphasis: e.emphasis, trail: e.trail.length, generation: e.generation});
const ready = async () => { await page.waitForSelector(".field-root .ftab", {timeout: 90000}); await page.waitForFunction(() => document.querySelector(".field-root")?.getAttribute("data-encounter"), null, {timeout: 30000}); await settle(1800); };
const pinState = () => page.evaluate(() => ({mode: localStorage.getItem("oi-cradle.field.context.mode"), pinned: !!localStorage.getItem("oi-cradle.field.context.pin")}));
const openMenu = async () => { await page.locator('.futil [data-util="companion"]').click(); await page.locator('.futil__menu[aria-label="Companion"]').waitFor(); };
let failed = false;
try {
  await ready();
  await page.waitForSelector(".article.fpane:not([hidden]) .ahead__title", {timeout: 60000});
  // ── build an encounter worth restoring ──
  const search = page.getByRole("searchbox", {name: "Search"});
  await search.fill("The Return of Zero"); await settle(300); await search.press("Shift+Enter"); await search.fill("");
  await page.waitForFunction(() => document.querySelector(".article.fpane:not([hidden]) .ahead__eyebrow")?.textContent?.includes("Manuscript"), null, {timeout: 60000});
  await page.locator(".mrail__t[data-span='M16']").click({force: true});
  await page.waitForFunction(() => document.querySelector(".field-root")?.getAttribute("data-encounter")?.includes('"span":"M16"'), null, {timeout: 30000}); await settle(900);
  const rels = await page.evaluate(() => [...document.querySelectorAll(".conn__g li[data-ref]")].map(l => l.dataset.ref).filter(r => /\/arguments\//.test(decodeURIComponent(r)) && !/README/.test(decodeURIComponent(r))).slice(0, 3));
  const box = ref => page.locator(`.graph-svg .gn[data-ref="${ref}"] circle.hit`).first().boundingBox();
  let b = await box(rels[0]); await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2); await settle(300);          // select
  b = await box(rels[0]); await page.mouse.dblclick(b.x + b.width / 2, b.y + b.height / 2);                              // tangent
  await page.waitForFunction(() => document.querySelectorAll(".ftab").length === 2, null, {timeout: 30000}); await settle(500);
  await page.locator(".ftab").nth(1).dblclick(); await settle(300);                                                      // keep
  await page.locator(".ftab").first().click(); await settle(600);
  await page.locator(".conn__g li[data-ref]", {hasText: /./}).first().waitFor();
  const second = await page.evaluate(refs => [...document.querySelectorAll(".conn__g li[data-ref]")].map(l => l.dataset.ref).find(r => !refs.includes(r)), [rels[0]]);
  await page.locator(`.conn__g li[data-ref="${second}"] a`).click(); await settle(700);                                    // a second tangent (preview)
  await page.keyboard.press("l"); await settle(600);                                                                       // Library → Here → a scene
  await page.locator(".xcolls button", {hasText: /^Here/}).click(); await settle(300);
  await page.locator('.library .xcard[data-x="expression:roz-room-02-return-of-zero"] .xchip-s').nth(2).click();
  await page.waitForSelector("iframe.xframe", {timeout: 30000}); await settle(1500);
  await page.locator(".ftab").first().click(); await settle(1000);
  // a selection (a double-click open clears it): click a node of the neighbourhood
  const pick = await page.evaluate(refs => [...document.querySelectorAll(".graph-svg .gn[data-ref]")].map(g => g.dataset.ref).find(r => !refs.includes(r) && !document.querySelector(`.gn--focus[data-ref="${r}"]`)), [rels[0], second]);
  b = await box(pick); await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2); await settle(400);
  await page.locator(".field-root").focus(); await page.keyboard.press("2"); await settle(500);                         // emphasis: split
  // the explicit pin
  await openMenu(); await page.locator('.futil__menu[aria-label="Companion"] .futil__item', {hasText: "Pinned"}).click(); await settle(300); await page.keyboard.press("Escape");
  const e1 = await enc(), v1 = await view(), pin1 = await pinState();
  record.before = {encounter: keep(e1), view: v1, pin: pin1};
  check(e1.tabs.length === 3 && e1.tabs.some(t => !t.preview && t.kind === "page") && e1.tabs.some(t => t.preview && t.kind === "page") && e1.tabs.some(t => t.kind === "expression") && !!e1.selected && e1.emphasis === "split" && e1.primary.span === "M16" && !!e1.scene?.scene_id, "the encounter to restore: main at M16, a kept tab, a preview, an Expression at a scene, a selection, split emphasis", keep(e1));
  check(pin1.mode === "pin" && pin1.pinned, "the pin is held", pin1);
  await page.waitForTimeout(900);                                                                                          // the debounced write to the binding

  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  let baseline = e1;
  const compare = async (label) => {
    await ready();
    const e2 = await enc(), v2 = await view(), pin2 = await pinState();
    check(same(keep(e2), keep(baseline)), `${label}: main, tabs (kept/preview/Expression), focus, selected, scene, emphasis, trail and generation all restored`, keep(e2));
    check(v2.tabs.length === v1.tabs.length && same(v2.tabs.map(t => [t.label, t.preview]), v1.tabs.map(t => [t.label, t.preview])), `${label}: the tab strip reads the same`, v2.tabs);
    check(v2.view === "split", `${label}: the emphasis is applied (data-view split)`);
    await page.locator(".ftab").first().click(); await settle(1500);
    const pos = await page.locator(".center-foot .pos b").textContent();
    check(pos === "M16", `${label}: the reading position is M16`, pos);
    const anchorTop = await page.evaluate(() => { const sc = document.querySelector(".center-scroll"); const a = document.querySelector(".article.fpane:not([hidden]) #M16"); return a ? Math.round(a.getBoundingClientRect().top - sc.getBoundingClientRect().top) : null; });
    check(anchorTop !== null && Math.abs(anchorTop) < 140, `${label}: M16 is where the reader is looking (anchor within ${anchorTop}px of the top)`, anchorTop);
    await page.locator(".ftab--x, .ftab").nth(e1.tabs.findIndex(t => t.kind === "expression") + 1).click(); await settle(1500);
    const v3 = await view();
    check(!!v3.frame && v3.frame.includes("roz-room-02-return-of-zero") && v3.frame.includes(`scene=${e1.scene.scene_id}`), `${label}: the Expression returns at its scene`, v3.frame);
    await openMenu();
    const pinned = await page.locator('.futil__menu[aria-label="Companion"] .futil__item.is-on', {hasText: /Pinned at generation/}).count();
    check(pin2.mode === "pin" && pinned === 1, `${label}: the explicit pin is still pinned, at its generation`, {pin2, pinned});
    await page.keyboard.press("Escape");
    await page.locator(".ftab").first().click(); await settle(1200);
    baseline = await enc();      // what the next restore must reproduce (driving the tabs above is itself an encounter change)
  };
  await page.reload(); await compare("reload");
  await page.screenshot({path: shotPath("field-continuity-reload-1440.png")});
  // close the page; open a new one on the same storage
  await f.context.pages()[0].close();
  page = await f.context.newPage();
  page.on("pageerror", e => f.errors.push("pageerror: " + e.message));
  await page.goto(process.env.FIELD_APP_URL ?? "http://localhost:1451/"); await page.waitForSelector(".desktop-shell", {timeout: 60000});
  await compare("close and reopen");

  // ── each world keeps its own encounter ──
  const essay = keep(await enc());
  await page.locator('.futil [data-util="scope"]').click();
  await page.locator('.futil__menu[aria-label="Scope"] .futil__item', {hasText: "Epi-Logos"}).click(); await settle(1500);   // Epi off
  await page.waitForSelector(".field-root .stubnote .linkbtn", {timeout: 30000});
  await page.locator(".field-root .stubnote .linkbtn", {hasText: "Field"}).click();
  await ready();
  const g0 = await enc();
  check(g0.world_ref === "project:field-walk" && g0.tabs.length === 0, "Epi off: the generic corpus starts its own encounter, none of the essay's", {world: g0.world_ref, tabs: g0.tabs.length});
  await page.locator(".conn__g li[data-ref] a").first().click(); await settle(800);
  const gen1 = keep(await enc());
  check(gen1.tabs.length === 1, "…and a tangent opened there");
  await page.locator('.futil [data-util="scope"]').click();
  await page.locator('.futil__menu[aria-label="Scope"] .futil__item', {hasText: "Epi-Logos"}).click(); await settle(1500);   // Epi on
  await ready();
  check(same(keep(await enc()), essay), "Epi on again: the essay's encounter is exactly as it was left", keep(await enc()));
  await page.locator('.futil [data-util="scope"]').click();
  await page.locator('.futil__menu[aria-label="Scope"] .futil__item', {hasText: "Epi-Logos"}).click(); await settle(1500);   // off again
  await ready();
  check(same(keep(await enc()), gen1), "Epi off again: the corpus's own encounter is exactly as it was left", keep(await enc()));
  await page.locator('.futil [data-util="scope"]').click();
  await page.locator('.futil__menu[aria-label="Scope"] .futil__item', {hasText: "Epi-Logos"}).click(); await settle(1500);
  await ready();

  // ── Base → Expressions → Base ──
  const before = keep(await enc());
  await page.locator('.futil [data-util="modes"]').click();
  await page.locator('.futil__menu[aria-label="Modes"] .futil__item', {hasText: "Expressions"}).click(); await settle(2000);
  if ((await page.evaluate(() => document.querySelector('[data-region="left"]')?.dataset.depth)) !== "panel") { await page.getByRole("button", {name: "Toggle left region"}).click(); await settle(500); }
  await page.getByRole("radio", {name: "Base"}).click(); await settle(1500);
  await ready();
  check(same(keep(await enc()), before), "Base → Expressions → Base: the encounter is untouched", keep(await enc()));
  check((await view()).tabs.length === before.tabs.length + 1, "…with its tabs");
  await page.screenshot({path: shotPath("field-continuity-modes-1440.png")});
} catch (error) {
  failed = true; check(false, "the walk ran to its end", String(error?.stack ?? error).split("\n").slice(0, 5).join(" | "));
  await page.screenshot({path: shotPath("field-continuity-failure.png")}).catch(() => {});
} finally {
  const errs = f.errors.filter(m => !/Failed to load resource|favicon/.test(m));
  check(errs.length === 0, "no page or console errors", errs.slice(0, 4));
  const passed = checks.filter(c => c.ok).length;
  writeReceipt("field-continuity.json", {scenario: "field-continuity", at: new Date().toISOString(), passed: passed === checks.length && !failed, counts: {passed, total: checks.length}, record, checks});
  console.log(`\n${passed}/${checks.length} checks passed`);
  await f.dispose();
  process.exit(passed === checks.length && !failed ? 0 : 1);
}
