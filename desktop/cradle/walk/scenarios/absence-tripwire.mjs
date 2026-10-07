#!/usr/bin/env node
// Product absence, proved in a real browser on the real kernel (O:I #598 / #595): with Factory and Workcell genuinely
// absent from discovery, Base starts, its scope menu opens, modes switch and Settings opens — and nothing dispatches
// to either product. A positive control then dispatches deliberately and the tripwire MUST record it, so a broken
// tripwire cannot pass this walk. The census must also report the honest composition: Central, Actuation, AIKit and
// QL present (0/1/2 + 5), Factory and Workcell missing.
//
//   FIELD_SITE_ROOT=<built site root> [FIELD_APP_URL=http://localhost:1451/] node walk/scenarios/absence-tripwire.mjs
import {installTripwireEnvironment} from "../lib/absence-tripwire.mjs";
import {bootField, writeReceipt} from "../lib/field-walk.mjs";

const checks = [];
const check = (ok, label, detail) => { checks.push({ok: !!ok, label, ...(detail !== undefined ? {detail} : {})}); console.log(`${ok ? "PASS" : "FAIL"} — ${label}${detail !== undefined ? " · " + JSON.stringify(detail).slice(0, 240) : ""}`); return !!ok; };

const trip = installTripwireEnvironment();
const f = await bootField({epi: false});
const {page, bridgeUrl} = f;
const failedResources = [], consoleErrors = [];
page.on("console", m => { if (m.type() === "error") consoleErrors.push(m.text().slice(0, 300)); });
page.on("pageerror", e => consoleErrors.push("pageerror: " + e.message));
page.on("response", r => { if (r.status() >= 400) failedResources.push(`${r.status()} ${r.url()}`); });
const op = async body => (await fetch(`${bridgeUrl}/op`, {method: "POST", headers: {"content-type": "application/json"}, body: JSON.stringify(body)})).json();
let failed = false;
const phases = {};
let mark = 0;
const phase = name => { const all = trip.entries(); phases[name] = all.slice(mark); mark = all.length; };
try {
  await page.reload(); await page.waitForSelector(".desktop-shell"); // the listener above now sees the boot requests
  const census = (await op({op: "composition_read"})).outcome?.reading;
  const present = Object.fromEntries((census?.positions ?? []).map(p => [p.product_id, p.current_world?.present]));
  check(census && present["software-factory"] === false && present.workcell === false, "the owner's census reports Factory and Workcell missing", present);
  check(["central", "actuation", "ai-kit", "quaternal-logic"].every(id => present[id] === true), "…and Central, Actuation, AIKit and Quaternal Logic present", present);
  check(JSON.stringify(census?.current_world?.data?.context_frame?.present_positions) === "[0,1,2,5]", "present positions are exactly 0/1/2 + 5, an explicit selection", census?.current_world?.data?.context_frame);

  await page.waitForSelector(".desktop-shell");
  await page.waitForTimeout(2500); // the one census read lands; startup effects settle
  phase("startup");
  const strip = await page.evaluate(() => [...document.querySelectorAll(".world-mode-strip [data-mode]")].map(b => b.getAttribute("data-mode")));
  check(strip.length > 0 && !strip.includes("factory"), "the mode strip offers no Factory", strip);

  await page.locator(".left-scope-trigger").dispatchEvent("click"); // the field default folds the left navigator; the click is dispatched on the element itself
  await page.waitForTimeout(1500);
  check(await page.locator(".left-scope-menu").count() === 1, "the scope menu opens");
  phase("scope-menu");
  await page.keyboard.press("Escape"); await page.waitForTimeout(300);
  for (const mode of strip.filter(m => m !== "base")) { await page.locator(`.world-mode-strip [data-mode="${mode}"]`).dispatchEvent("click"); await page.waitForTimeout(1200); }
  phase("modes");
  await page.locator(".world-system-settings").dispatchEvent("click"); await page.waitForTimeout(2000);
  phase("settings");
  check(await page.locator(".world-system-settings").getAttribute("aria-pressed") === "true", "Settings opens (its entry is pressed)");
  await page.locator(`.world-mode-strip [data-mode="base"]`).dispatchEvent("click").catch(() => {}); await page.waitForTimeout(800);

  check(trip.entries().length === 0, "ZERO dispatches to Factory or Workcell across startup, scope menu, every mode and Settings", phases);
  check(consoleErrors.length === 0, "no page or console errors after the reload (first-load errors, if any, are recorded in the receipt)", consoleErrors);
  check(failedResources.length === 0, "no failed requests (4xx/5xx) while Base starts and is walked", failedResources);

  // positive control: the tripwire really is wired, or this walk proves nothing.
  trip.clear();
  const probe = await op({op: "workcell_status_read"});
  const seen = trip.entries();
  check(seen.length > 0 && /workcell/.test(seen.join("\n")) && !probe.ok, "positive control: a deliberate Workcell dispatch is recorded and refused", {entries: seen, ok: probe.ok});
} catch (e) { failed = true; console.log("ERROR —", e.stack ?? e); }
await f.dispose();
const ok = !failed && checks.every(c => c.ok);
writeReceipt("absence-tripwire.json", {scenario: "absence-tripwire", grade: "B", firstLoadErrors: f.errors, environment: {withheld: trip.withheld, path: trip.env.PATH}, checks, ok});
console.log(`\n${checks.filter(c => c.ok).length}/${checks.length} checks passed`);
process.exit(ok ? 0 : 1);
