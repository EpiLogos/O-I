#!/usr/bin/env node
// From the field, with the window's own left navigator folded, a person can reach scope, modes, Settings and the
// companion by POINTER and by KEYBOARD — real, un-forced Playwright clicks (a click that something else intercepts fails
// with "… intercepts pointer events"), never DOM dispatch.
//   FIELD_SITE_ROOT=<dir with essay/static/fieldIndex.json> node walk/scenarios/field-reachability.mjs
import {bootField, shotPath, writeReceipt} from "../lib/field-walk.mjs";
import {fileURLToPath} from "node:url";

const checks = [];
const check = (ok, label, detail) => { checks.push({ok: !!ok, label, ...(detail !== undefined ? {detail} : {})}); console.log(`${ok ? "PASS" : "FAIL"} — ${label}${detail !== undefined ? " · " + JSON.stringify(detail).slice(0, 200) : ""}`); return !!ok; };
const fixture = fileURLToPath(new URL("../../tests/fixtures/field-corpus/", import.meta.url));
const f = await bootField({epi: false, fixture});
const {page} = f;
const settle = ms => page.waitForTimeout(ms);
const region = side => page.evaluate(s => document.querySelector(`[data-region="${s}"]`)?.dataset.depth, side);
const stage = () => page.evaluate(() => [...document.querySelectorAll("[data-mode-stage]")].find(e => !e.hidden)?.dataset.modeStage ?? "base");
let failed = false;
try {
  await page.waitForSelector(".field-root .futil", {timeout: 30000});
  check((await region("left")) === "collapsed" && (await region("right")) === "collapsed", "the field default folds the window's left navigator and the companion", {left: await region("left"), right: await region("right")});
  check(await page.locator(".futil").count() === 1 && await page.locator(".futil").isVisible(), "the field carries its own utility bar (exactly one, visible)");

  // scope — pointer: choose the linked project
  await page.locator('.futil [data-util="scope"]').click();
  await page.locator('.futil__menu[aria-label="Scope"]').waitFor();
  const scopeItems = await page.locator('.futil__menu[aria-label="Scope"] .futil__item span').allTextContents();
  check(scopeItems.includes("Central") && scopeItems.includes("Field") && scopeItems.includes("Epi-Logos"), "the scope menu offers Central, the kernel's projects and the Epi world", scopeItems);
  await page.locator('.futil__menu[aria-label="Scope"] .futil__item', {hasText: "Field"}).click();
  await page.waitForSelector(".article.fpane:not([hidden]) .ahead__title", {timeout: 30000});
  check(/Harbour/.test(await page.locator(".article.fpane:not([hidden]) .ahead__title").textContent()), "choosing the project by pointer links its corpus as the field's source");
  check(await page.evaluate(() => document.querySelector(".futil__t")?.textContent === "Field"), "the scope button names the scope");

  // the Epi world — pointer, from the same menu
  await page.locator('.futil [data-util="scope"]').click();
  await page.locator('.futil__menu[aria-label="Scope"] .futil__item', {hasText: "Epi-Logos"}).click();
  await settle(1200);
  check(await page.locator(".left-lens-chip, .footer-epi[aria-pressed='true']").count() > 0 || await page.evaluate(() => !!document.querySelector('.footer-epi[aria-pressed="true"]')), "the Epi world toggles from the field");
  await page.locator('.futil [data-util="scope"]').click();
  await page.locator('.futil__menu[aria-label="Scope"] .futil__item', {hasText: "Epi-Logos"}).click();
  await settle(800);

  // companion — pointer: summon, focus, put away
  await page.locator('.futil [data-util="companion"]').click();
  await page.locator('.futil__menu[aria-label="Companion"]').waitFor();
  await page.locator('.futil__menu[aria-label="Companion"] .futil__item', {hasText: "Summoned beside"}).click();
  await settle(800);
  check((await region("right")) === "panel" && await page.locator('[data-region="right"] textarea, [data-region="right"] [contenteditable]').first().isVisible().catch(() => false), "summon: the companion opens beside the field with its composer", await region("right"));
  check(await page.locator(".field-root .article.fpane:not([hidden])").isVisible(), "…and the field stays");
  await page.screenshot({path: shotPath("field-reach-companion-1440.png")});
  await page.locator('.futil [data-util="companion"]').click();
  await page.locator('.futil__menu[aria-label="Companion"] .futil__item', {hasText: "Focused"}).click(); await settle(600);
  check((await region("right")) === "full", "focus: the companion takes the width", await region("right"));
  await page.getByRole("button", {name: "Toggle right region"}).click(); await settle(600);   // the window's own toggle also still works
  check((await region("right")) !== "full", "the window row's own toggle still works from the focused state", await region("right"));
  await page.locator('.futil [data-util="companion"]').click({trial: false}).catch(() => {});
  // put away
  const menuOpen = await page.locator('.futil__menu[aria-label="Companion"]').count();
  if (!menuOpen) await page.locator('.futil [data-util="companion"]').click();
  await page.locator('.futil__menu[aria-label="Companion"] .futil__item', {hasText: "Put away"}).click(); await settle(600);
  check(["collapsed", "strip"].includes(await region("right")), "put away: the companion folds", await region("right"));

  // the companion's context — pin and follow, from the same menu
  await page.locator('.futil [data-util="companion"]').click();
  await page.locator('.futil__menu[aria-label="Companion"] .futil__item', {hasText: "Pinned"}).click(); await settle(300);
  check(await page.evaluate(() => localStorage.getItem("oi-cradle.field.context.mode")) === "pin", "pin: the choice about the field in the companion's context is held");
  await page.locator('.futil__menu[aria-label="Companion"] .futil__item', {hasText: "present, not prepared"}).click(); await settle(300);   // the menu stays open while a choice is made
  check(await page.evaluate(() => localStorage.getItem("oi-cradle.field.context.mode")) === "off", "off again: present is not prepared");

  // keyboard — Tab to the bar, Enter opens, Tab reaches an item, Escape closes
  await page.locator('.futil [data-util="modes"]').focus();
  await page.keyboard.press("Enter");
  await page.locator('.futil__menu[aria-label="Modes"]').waitFor();
  await page.keyboard.press("Escape");
  check(await page.locator('.futil__menu[aria-label="Modes"]').count() === 0, "keyboard: Enter opens a utility menu, Escape closes it");
  await page.locator('.futil [data-util="companion"]').focus();
  await page.keyboard.press("Enter"); await page.keyboard.press("Tab"); await page.keyboard.press("Enter"); await settle(700);
  check((await region("right")) === "panel", "keyboard: Enter, Tab, Enter on the companion menu summons it", await region("right"));
  await page.keyboard.press("Tab");   // leave the menu
  await page.locator('.futil [data-util="companion"]').focus(); await page.keyboard.press("Enter");
  await page.locator('.futil__menu[aria-label="Companion"] .futil__item', {hasText: "Put away"}).focus(); await page.keyboard.press("Enter"); await settle(500);

  // modes — pointer: Expressions, and the way back
  await page.locator('.futil [data-util="modes"]').click();
  const modeItems = await page.locator('.futil__menu[aria-label="Modes"] .futil__item span').allTextContents();
  check(modeItems.includes("Expressions"), "the modes menu offers the modes the window offers", modeItems);
  await page.locator('.futil__menu[aria-label="Modes"] .futil__item', {hasText: "Expressions"}).click(); await settle(1500);
  check(await stage() === "expressions", "a mode is entered by pointer from the field", await stage());
  if ((await region("left")) !== "panel") { await page.getByRole("button", {name: "Toggle left region"}).click(); await settle(500); }
  await page.getByRole("radio", {name: "Base"}).click(); await settle(1000);
  check(await stage() === "base" && await page.locator(".field-root").isVisible(), "…and Base (the field) comes back by pointer, its place kept");

  // Settings — pointer
  await page.locator('.futil [data-util="settings"]').click(); await settle(1500);
  check(await stage() === "settings", "Settings opens by pointer from the field", await stage());
  await page.screenshot({path: shotPath("field-reach-settings-1440.png")});
} catch (error) {
  failed = true; check(false, "the walk ran to its end", String(error?.stack ?? error).split("\n").slice(0, 5).join(" | "));
  await page.screenshot({path: shotPath("field-reach-failure.png")}).catch(() => {});
} finally {
  const errs = f.errors.filter(m => !/Failed to load resource|favicon/.test(m));
  check(errs.length === 0, "no page or console errors", errs.slice(0, 4));
  const passed = checks.filter(c => c.ok).length;
  writeReceipt("field-reachability.json", {scenario: "field-reachability", at: new Date().toISOString(), passed: passed === checks.length && !failed, counts: {passed, total: checks.length}, checks});
  console.log(`\n${passed}/${checks.length} checks passed`);
  await f.dispose();
  process.exit(passed === checks.length && !failed ? 0 : 1);
}
