/**
 * 12-SETTINGS §1/§3 — where Settings sits and what each section shows,
 * walked against the real kernel and the installed owners in a disposable
 * world. Every expectation is computed from the owners' own reads, made by
 * the walk itself in the same world.
 *
 *   §1  the gear enters Settings; the left stays open with the section list
 *       as its body (geometry measured across the entering transition); the
 *       right is collapsed; Back to work and Escape return; Search settings
 *       lands on the exact row.
 *   S1  first paint reads "Reading settings…" with no invented values.
 *   S3  at rest there is no pending strip.
 *   S10 Status shows every product's own drift first: both sides and the
 *       owner's remedy — nothing that rewrites it.
 *   S11 read-only settings: value + lock + the owning place + Open file, and
 *       no disabled control anywhere.
 *   S14 model availability: each model's chip is its routes JOINED with the
 *       bound credentials — Usable where only a bound key makes it so, while
 *       the route itself still says a key is required.
 *   S15 a missing native operation is one plain sentence, never a control.
 * Screenshots: every section in light and dark at 1440, 1000 and 760.
 */
import {execFileSync} from "node:child_process";
import {settingsWorld} from "../lib/settings-world.mjs";
import {disabledControls, enterSettings, openProduct, openSection, rawJsonOutsideShowRaw, settled, shotMatrix} from "../lib/settings-walk.mjs";

export async function setup() {
  const world = settingsWorld();
  // A stored secret for OpenRouter makes the model join observable: its
  // router routes still declare "credential required", yet are usable.
  const bound = world.aikit("credential", "setup", "credential:openrouter", "--ref", world.dummyRef, "--headless");
  if (!bound.ok) throw new Error(`binding the walk's stored secret failed: ${JSON.stringify(bound.error)}`);
  return world;
}

const HARNESS = {"claude-code": "Claude Code", codex: "Codex", zcode: "ZCode", pi: "Pi"};

export default async function run({page, baseUrl, check, shot, provision: world, log}) {
  const env = {...process.env, ...world.env};
  const aikitJson = (...args) => JSON.parse(execFileSync(process.env.OI_AIKIT_BIN ?? "aikit", ["--json", "-C", world.root, ...args], {encoding: "utf8", env, maxBuffer: 64 << 20}));

  // --- §1 · entering, and S1 · reading ------------------------------------
  await page.goto(baseUrl);
  const chooser = page.getByRole("region", {name: "Central location"});
  if (await chooser.isVisible({timeout: 8000}).catch(() => false)) {
    const {bindDefaultCentral} = await import("../editor-doc.mjs");
    await bindDefaultCentral(page, world.root);
  }
  await page.waitForSelector(".desktop-shell");
  const modeBefore = await page.locator(".desktop-shell").getAttribute("data-mode");
  const leftBefore = await page.locator('aside[data-region="left"]').boundingBox();
  await page.locator(".world-system-settings").first().click();
  await page.locator("[data-settings-page]").waitFor({timeout: 60000});
  const reading = await page.locator("[data-settings-reading]").count() + await page.getByText("Reading…").count();
  const earlyCounts = await page.locator("[data-settings-count]").count();
  check(reading > 0 && earlyCounts === 0, "S1 first paint reads \"Reading settings…\" and the navigator shows no invented counts", {reading, earlyCounts});
  const left = page.locator('aside[data-region="left"]');
  const right = page.locator('aside[data-region="right"]');
  await page.locator("[data-settings-navigator]").waitFor();
  const leftAfter = await left.boundingBox();
  const rightAfter = await right.boundingBox();
  check((await left.getAttribute("data-depth")) === "panel" && await left.locator("[data-settings-navigator]").count() === 1,
    "§1 the left stays open and its body is the section list");
  check(!!leftBefore && !!leftAfter && Math.abs(leftAfter.width - leftBefore.width) <= 0.5 && leftAfter.width > 150,
    "§1 entering Settings keeps the left frame's width (two-sided, ±0.5px)", {before: leftBefore?.width, after: leftAfter?.width});
  check((await right.getAttribute("data-depth")) === "collapsed" && (!rightAfter || rightAfter.width <= 0.5 || (await right.getAttribute("aria-hidden")) === "true"),
    "§1 the right panel is collapsed in Settings", {width: rightAfter?.width});
  const sections = await page.locator("[data-settings-section]").evaluateAll((nodes) => nodes.map((node) => node.textContent?.trim()));
  check(JSON.stringify(sections.map((text) => text.replace(/\d+$/, ""))) === JSON.stringify(["Status", "Harnesses", "Models", "Credentials", "Skills", "Profiles", "Permissions", "Appearance"]),
    "§1 the sections are the tasks, in order", {sections});
  const products = await page.locator("[data-settings-product]").evaluateAll((nodes) => nodes.map((node) => node.textContent?.trim()));
  check(JSON.stringify(products) === JSON.stringify(["Central", "AIKit", "Actuation", "Factory", "Workcell", "Quaternal Logic", "O:I"]), "§1 PRODUCTS below the tasks, one per product", {products});
  await settled(page);

  // --- S3 / S10 · Status ------------------------------------------------------------
  await page.locator("[data-status-section]").waitFor({timeout: 240000});
  await page.waitForFunction(() => !document.body.innerText.includes("Reading each product's settings…"), null, {timeout: 300000});
  check(await page.locator("[data-settings-pending]").count() === 0, "S3 at rest there is no pending strip in the DOM");
  const drifted = [];
  for (const [product, ns] of [["central", "central"], ["ai-kit", "aikit"], ["actuation", "actuation"], ["software-factory", "factory"], ["workcell", "workcell"], ["quaternal-logic", "ql"]]) {
    let descriptor;
    try { descriptor = JSON.parse(execFileSync(process.env.OI_BIN ?? "oi", [ns, "system", "--json"], {encoding: "utf8", env, cwd: world.root, maxBuffer: 64 << 20})); } catch { continue; }
    for (const section of descriptor.sections ?? []) for (const setting of section.settings ?? []) if (setting.drift?.state === "diverged") drifted.push(`${product}:${setting.key}`);
  }
  const shownDrift = await page.locator("[data-drift-product]").evaluateAll((nodes) => nodes.map((node) => `${node.getAttribute("data-drift-product")}:${node.getAttribute("data-drift-setting")}`));
  check(JSON.stringify([...shownDrift].sort()) === JSON.stringify([...drifted].sort()), "S10 Status lists exactly the settings the owners report as drifted", {shownDrift, drifted});
  if (drifted.length) {
    const first = page.locator("[data-drift-product]").first();
    const sides = await first.locator("[data-drift-side]").allTextContents();
    check(sides.length === 2 && sides.every((side) => side.trim().length > 0) && ((await first.locator("[data-drift-remedy]").textContent()) ?? "").length > 10,
      "S10 each drift shows both sides and the owner's remedy in words", {sides});
    check(await first.locator("button").filter({hasText: /apply|fix|rewrite|sync/i}).count() === 0, "S10 nothing on the drift rewrites it — only a way to the product's page");
  } else {
    check(((await page.locator("[data-status-drift-none]").textContent()) ?? "").startsWith("Nothing has drifted"), "S10 with no owner drift, Status says so");
  }
  await shotMatrix({page, shot}, "status");

  // --- Harnesses ---------------------------------------------------------------
  await openSection(page, "harnesses");
  await page.locator("[data-harness-panel]").waitFor({timeout: 240000});
  const clients = aikitJson("client", "status").data.clients;
  const ready = clients.filter((row) => row.detection === "detected" && row.capability === "descriptor").map((row) => row.client);
  const needing = clients.filter((row) => row.detection === "detected" && row.capability !== "descriptor").length;
  const shownReady = await page.locator(".settings-harness[data-harness-card]").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-harness-card")));
  check(JSON.stringify(shownReady) === JSON.stringify(ready), "Harnesses: the Ready cards are the owner's harnesses with an adapter, in its order", {shownReady, ready});
  const collapsedNames = await page.locator('[data-harness-names="adapter-needed"]').textContent();
  check((collapsedNames ?? "").split(", ").length === clients.filter((row) => row.detection === "detected" && row.capability !== "descriptor").length,
    "Harnesses: the collapsed group still names every harness that needs an adapter, on one line");
  for (const group of ["adapter-needed", "not-found"]) await page.locator(`[data-settings-group="${group}"] .settings-eyebrow-toggle`).click();
  const brokerClients = clients.filter((row) => row.detection === "self" || row.dispatch === "self").map((row) => row.client);
  const listedClients = await page.locator("[data-harness-panel] [data-harness-card]").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-harness-card")));
  check(brokerClients.length > 0 && brokerClients.every((client) => !listedClients.includes(client)) && listedClients.length === clients.length - brokerClients.length,
    "Harnesses: the broker (AIKit itself) is not listed — every other client is", {brokerClients, listed: listedClients.length});
  check(((await page.locator('[data-settings-group="adapter-needed"] .settings-eyebrow').textContent()) ?? "").endsWith(`· ${needing}`), `Harnesses: "Detected, adapter needed" counts the owner's ${needing}`);
  // Install runs the owner's `aikit client install`. Codex installs into the
  // project it is working in — here the disposable ground — so the walk
  // exercises it for real without touching any real harness config.
  const codex = clients.find((row) => row.client === "codex");
  if (codex && !codex.installed && String(codex.config_dir ?? "").includes(world.root.split("/").pop())) {
    await page.locator('[data-harness-card="codex"] [data-harness-install]').click();
    await page.waitForFunction(() => document.querySelector('.settings-harness[data-harness-card="codex"]')?.getAttribute("data-installed") === "true", null, {timeout: 300000});
    const after = aikitJson("client", "status").data.clients.find((row) => row.client === "codex");
    const {existsSync} = await import("node:fs");
    check(after?.installed === true && existsSync(`${world.root}/.codex/hooks.json`), "Harnesses: Install runs the owner's client install — the card and the owner both read Installed (into the walk's own project)");
  } else {
    log(`Install not walked: codex is ${codex?.installed ? "already installed" : `configured outside the disposable ground (${codex?.config_dir})`}`);
  }
  await shotMatrix({page, shot}, "harnesses");

  // --- Models · S14 ---------------------------------------------------------------
  await openSection(page, "models");
  await page.locator("[data-models-panel]").waitFor({timeout: 240000});
  const modelsText = await page.locator("[data-models-panel]").innerText();
  check(modelsText.includes("Default connection for new chats") && modelsText.includes("A connection, not a model") && !/Model for new chats|Default provider/.test(modelsText),
    "Models: the new-chat default is labelled a connection, never a model (A1)");
  const catalogue = aikitJson("model-catalogue", "show").data.entries;
  const bindings = aikitJson("credential", "list").data.bindings.filter((binding) => !binding.revoked).map((binding) => binding.credential_ref.replace(/^credential:/, ""));
  const expectFor = (entry) => {
    const routes = entry.declared_routes ?? [];
    const id = (provider) => provider.replace(/^provider:/, "");
    const local = routes.find((route) => /^(ollama|lmstudio|llama-?cpp|local.*)$/.test(id(route.provider)) && route.credential_required === false);
    if (local) return "local";
    const ordered = [...routes.filter((route) => route.kind === "provider-native"), ...routes.filter((route) => route.kind !== "provider-native")];
    if (ordered.some((route) => route.credential_required === false || bindings.includes(id(route.provider)))) return "usable";
    return routes.length ? "needs-key" : "unrouted";
  };
  await page.locator("[data-model-picker]").first().click();
  await page.locator("[data-model-popover]").waitFor();
  const shownModels = await page.locator("[data-model-popover] [data-model][data-availability]").evaluateAll((nodes) => nodes.map((node) => ({model: node.getAttribute("data-model"), state: node.getAttribute("data-availability"), chip: node.querySelector("[data-availability-chip]")?.textContent})));
  const mismatches = shownModels.filter((row) => expectFor(catalogue.find((entry) => entry.model === row.model) ?? {}) !== row.state);
  check(shownModels.length === catalogue.length && mismatches.length === 0, `S14 every catalogued model's chip is its routes joined with the bound keys (${shownModels.length} models)`, {mismatches: mismatches.slice(0, 5)});
  const joined = catalogue.filter((entry) => (entry.declared_routes ?? []).every((route) => route.credential_required) && expectFor(entry) === "usable");
  check(joined.length === 0 || shownModels.some((row) => row.model === joined[0].model && row.chip === "Usable"),
    "S14 a model whose routes all still say a key is required reads Usable because the OpenRouter key is bound", {example: joined[0]?.model});
  check(shownModels.filter((row) => row.state === "needs-key").every((row) => /^Needs an? .+ key$/.test(row.chip ?? "")), "S14 unreachable models name the key they need");
  check(((await page.locator('[data-model="auto"]').textContent()) ?? "").startsWith("Auto · Balanced"), "S14 Auto keeps its identity and names its policy");
  await shot("model-picker");
  await page.keyboard.press("Escape");
  await shotMatrix({page, shot}, "models");

  // --- Permissions · S11 / S15 --------------------------------------------------
  await openSection(page, "permissions");
  await page.locator("[data-permissions-panel]").waitFor({timeout: 240000});
  await page.waitForFunction(() => ![...document.querySelectorAll("[data-settings-readonly]")].some((node) => node.textContent?.includes("Reading…")), null, {timeout: 300000});
  const listing = JSON.parse(execFileSync(process.env.OI_BIN ?? "oi", ["config", "list", "--json"], {encoding: "utf8", env, cwd: world.root}));
  const modes = listing.settings.filter((setting) => /permission/i.test(setting.setting_ref) && /mode/i.test(setting.setting_ref));
  if (modes.length === 0) {
    const sentence = (await page.locator("[data-permissions-panel] [data-settings-missing]").first().textContent()) ?? "";
    check(/permission mode/.test(sentence) && /doesn't have yet/.test(sentence) && await page.locator("[data-permission-mode]").count() === 0,
      "S15 with no permission-mode setting in AIKit, one plain sentence names it — no control", {sentence});
  } else {
    check(await page.locator("[data-permission-mode]").count() === modes.length, "the permission modes render from AIKit's own settings");
  }
  const guardrail = page.locator('[data-settings-row="setting:ai-kit:claude-code:hooks.fs-guardrail"]');
  const guardrailSpec = listing.settings.find((setting) => setting.setting_ref === "ai-kit:claude-code:hooks.fs-guardrail");
  const file = guardrailSpec?.native_ref.split(/\s+/)[0];
  check(await guardrail.locator(".settings-lock").count() === 1 && ((await guardrail.locator(".settings-readonly-place").textContent()) ?? "") === "Set in Claude Code's config"
    && (await guardrail.locator("[data-settings-open-file]").getAttribute("data-settings-open-file")) === file,
    `S11 a read-only setting shows its value, a lock, the owning place and Open file (${file})`);
  const resolution = JSON.parse(execFileSync(process.env.OI_BIN ?? "oi", ["config", "show", "ai-kit:codex:home.trust_level", "machine", "--json"], {encoding: "utf8", env, cwd: world.root}));
  const homeTrust = resolution.native?.effective?.value ?? resolution.native?.declared?.value;
  const shownTrust = ((await page.locator('[data-settings-row="setting:ai-kit:codex:home.trust_level"] .settings-readonly-value').textContent()) ?? "").trim();
  check(shownTrust === (homeTrust === undefined ? "not set" : homeTrust === true ? "Yes" : homeTrust === false ? "No" : String(homeTrust)), "S11 the read-only value is the owner's own", {shownTrust, homeTrust});
  check((await disabledControls(page, "[data-permissions-panel]")).length === 0, "S11 no disabled control stands in for a read-only setting");
  await shotMatrix({page, shot}, "permissions");

  // --- Skills · S15 (This session) ------------------------------------------------
  await openSection(page, "skills");
  await page.locator("[data-skills-panel]").waitFor({timeout: 240000});
  await page.locator('[data-skill-scope="session"]').click();
  const sessionSentence = (await page.locator("[data-skills-panel] [data-settings-missing]").first().textContent()) ?? "";
  check(/This session can't be changed from the app yet/.test(sessionSentence) && await page.locator("[data-skills-panel] [role=switch]").count() === 0,
    "S15 This session is one sentence naming what is missing, and no switch pretends otherwise");
  await page.locator('[data-skill-scope="machine"]').click();
  await page.locator("[data-skills-panel] [role=switch]").first().waitFor({timeout: 240000});
  await shotMatrix({page, shot}, "skills");

  // --- the other sections: clean, no raw JSON, screenshots -------------------------
  for (const id of ["credentials", "profiles", "appearance"]) {
    await openSection(page, id);
    await settled(page);
    await page.waitForTimeout(500);
    check((await rawJsonOutsideShowRaw(page)).length === 0, `${id}: no raw JSON outside Show raw`);
    await shotMatrix({page, shot}, id);
  }
  for (const id of ["status", "harnesses", "models", "permissions", "skills"]) {
    await openSection(page, id);
    await settled(page);
    check((await rawJsonOutsideShowRaw(page)).length === 0, `${id}: no raw JSON outside Show raw`);
  }
  check((await disabledControls(page, "[data-settings-page]")).length === 0, "S15 at rest no disabled control appears anywhere on the page");

  // --- a product page -------------------------------------------------------------
  await openProduct(page, "ai-kit");
  await page.locator('[data-product-page="ai-kit"] [data-product-health]').waitFor({timeout: 240000});
  const system = aikitJson("system");
  const buttons = await page.locator("[data-product-action]").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-product-action")));
  const runnable = system.actions.filter((action) => action.availability === "disclosed" && action.exposure?.ui !== false && action.native_path && !/[<[]/.test(action.native_path)).map((action) => action.action_ref);
  check(JSON.stringify(buttons) === JSON.stringify(runnable), "Products: the disclosed actions are buttons", {buttons, runnable});
  const missing = system.actions.filter((action) => action.availability !== "disclosed");
  check(missing.length === 0 || /have no native operation here yet\.$|has no native operation here yet\.$/.test((await page.locator('[data-product-page="ai-kit"] [data-settings-missing]').textContent()) ?? ""),
    "Products: missing actions are one sentence");
  const raw = page.locator("[data-show-raw]");
  check(await raw.count() === 1 && (await raw.getAttribute("open")) === null && (await rawJsonOutsideShowRaw(page)).length === 0,
    "Products: Show raw is last, collapsed, and the only place JSON appears");
  const lastChild = await page.locator('[data-product-page="ai-kit"] > :last-child').getAttribute("data-show-raw");
  check(lastChild !== null, "Products: Show raw is the last thing on the page");
  await page.locator('[data-product-action="aikit.status"]').click();
  await page.locator('[data-product-action-result="aikit.status"]').waitFor({timeout: 240000});
  check(/ran|problem/.test((await page.locator('[data-product-action-result="aikit.status"] p').textContent()) ?? ""), "Products: an action runs the owner's own command and reports it");
  await shotMatrix({page, shot}, "product-aikit");

  // --- Search lands on the exact row -------------------------------------------------
  await page.locator("[data-settings-search-open]").click();
  await page.getByRole("searchbox", {name: "Search settings"}).fill("catalogue");
  await page.locator("[data-settings-search-results] [data-search-hit]").first().waitFor();
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => document.querySelector('[data-settings-row="model:catalogue"]')?.getAttribute("data-landed") === "true", null, {timeout: 60000});
  check((await page.locator("[data-settings-page]").getAttribute("data-settings-place")) === "section:models", "Search: \"catalogue\" lands on the Models page, on the Catalogue row");
  await page.locator("[data-settings-search-open]").click();
  await page.getByRole("searchbox", {name: "Search settings"}).fill("walk-gamma");
  await page.locator("[data-settings-search-results] [data-search-hit]").first().click();
  await page.waitForFunction(() => document.querySelector('[data-settings-row="skill:machine:skill/walkskills/walk-gamma"]')?.getAttribute("data-landed") === "true", null, {timeout: 120000});
  check(true, "Search: a skill lands on its exact row");

  // --- Back to work and Escape -------------------------------------------------------
  await page.locator("[data-settings-back]").click();
  await page.waitForFunction((mode) => document.querySelector(".desktop-shell")?.getAttribute("data-mode") === mode, modeBefore, {timeout: 30000});
  check(await page.locator("[data-settings-page]:visible").count() === 0, "§1 Back to work returns to the previous mode");
  await page.locator(".world-system-settings").first().click();
  await page.locator("[data-settings-page]").waitFor();
  await page.locator("[data-settings-page] h1").click();
  await page.keyboard.press("Escape");
  await page.waitForFunction((mode) => document.querySelector(".desktop-shell")?.getAttribute("data-mode") === mode, modeBefore, {timeout: 30000});
  check(true, "§1 Escape with nothing pending returns to the previous mode");
  log(`world ${world.root}`);
}
