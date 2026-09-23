/**
 * 12-SETTINGS S2 — "Couldn't load these settings." + Retry, distinct from
 * empty. The kernel reaches the suite through `oi` (OI_BIN); here OI_BIN is a
 * thin gate in front of the installed `oi` that refuses while a flag file
 * exists — a real failing process, not a fixture. The walk sees each section
 * say it couldn't load (never "none"/"no keys"), removes the flag, presses
 * Retry, and sees the owners' real answers arrive.
 */
import {chmodSync, rmSync, writeFileSync} from "node:fs";
import {join} from "node:path";
import {execFileSync} from "node:child_process";
import {settingsWorld} from "../lib/settings-world.mjs";
import {enterSettings, openSection} from "../lib/settings-walk.mjs";

export async function setup() {
  const world = settingsWorld();
  const realOi = execFileSync("sh", ["-c", "command -v oi"], {encoding: "utf8"}).trim();
  const flag = join(world.root, ".settings-walk-unreachable");
  const gate = join(world.root, "oi-gate.sh");
  writeFileSync(flag, "");
  writeFileSync(gate, `#!/bin/sh\nif [ -f ${JSON.stringify(flag)} ]; then echo "the suite is unreachable from this walk" >&2; exit 3; fi\nexec ${JSON.stringify(realOi)} "$@"\n`);
  chmodSync(gate, 0o755);
  return {...world, env: {...world.env, OI_BIN: gate}, flag};
}

export default async function run({page, baseUrl, check, shot, provision: world}) {
  await enterSettings(page, {root: world.root, baseUrl});
  await openSection(page, "credentials");
  const unreadable = page.locator("[data-settings-unreadable]");
  await unreadable.first().waitFor({timeout: 240000});
  const text = (await unreadable.first().innerText()) ?? "";
  check(text.startsWith("Couldn't load these settings.") && /unreachable/.test(text) && await unreadable.first().getByRole("button", {name: "Retry"}).count() === 1,
    "S2 a failed read says \"Couldn't load these settings.\" with the reason and Retry", {text});
  check(!/No keys yet|Not configured/.test(await page.locator("[data-settings-page]").innerText()), "S2 unreadable is never shown as empty (no \"Not configured\" cards)");
  await openSection(page, "harnesses");
  await page.locator("[data-settings-unreadable]").first().waitFor({timeout: 240000});
  check(await page.locator("[data-harness-card]").count() === 0, "S2 an unreadable harness census renders no cards, not an empty group");
  await shot("unreadable");
  rmSync(world.flag);
  await page.locator("[data-settings-unreadable]").first().getByRole("button", {name: "Retry"}).click();
  await page.locator(".settings-harness[data-harness-card]").first().waitFor({timeout: 300000});
  check(await page.locator("[data-settings-unreadable]").count() === 0 && await page.locator(".settings-harness[data-harness-card]").count() > 0,
    "S2 Retry reads the owners again and their real answers replace the unreadable state");
  await openSection(page, "credentials");
  await page.locator("[data-credential-card]").first().waitFor({timeout: 240000});
  check(await page.locator("[data-settings-unreadable]").count() === 0, "S2 after Retry the credentials read lands too");
  await shot("recovered");
}
