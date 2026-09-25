/**
 * 12-SETTINGS §2 — the one change path, walked against the real kernel and
 * the installed owners in a disposable world (walk/lib/settings-world.mjs):
 *
 *   S3  at rest the pending strip is absent from the DOM;
 *   S4  a skill switch and the new-chat connection STAGE: the rows mark
 *       "changed" with Undo, the strip counts them, and nothing is written
 *       to any owner before Apply (read independently from AIKit and the
 *       desktop's own state file);
 *   S5  one review sheet: setting, scope, from → to, and the effect in plain
 *       words matching the owner's own effect kind (read from `oi config
 *       list`);
 *   S6  Apply → readback: "Applied ✓" per row only when the owner reads back
 *       the requested value (checked again from AIKit and the state file),
 *       with the one-line receipt;
 *   S7  a change the owner refuses (an unknown capability, held from the
 *       CLI) shows the owner's reason and "This change wasn't applied."; a
 *       change another scope overrides reads back as "Partly applied" with
 *       the reason — neither is reported as success;
 *   S8  a staged value that moves after review refuses Apply with "These
 *       settings changed. Review the plan again." and nothing is applied;
 *   S9  when the plan read is empty the sheet says "No capability changes."
 *       and Status says the same.
 */
import {settingsWorld} from "../lib/settings-world.mjs";
import {enterSettings, openSection, settled, shotMatrix} from "../lib/settings-walk.mjs";
import {readFileSync, existsSync} from "node:fs";

/** An apply plans, executes and reads back through the owners' real CLIs;
 * on a loaded machine riding slower (debug-build) owner binaries this
 * legitimately takes minutes — the wait is generous, the assertions after
 * it are not. */
const APPLY_TIMEOUT = 600000;

export async function setup() {
  return settingsWorld();
}

const WORDS = {"value-change": "Takes effect now", "session-restart-required": "Next session only", "provider-reconnect-required": "Reconnects the provider", "material-effect": "Changes files on this machine"};

export default async function run({page, baseUrl, check, shot, provision: world, log}) {
  const active = () => {
    const status = world.aikit("status");
    return new Set((status.data?.active ?? []).map((row) => typeof row === "string" ? row : row.id ?? row.capability ?? row.resource));
  };
  const heldConnection = () => existsSync(world.env.OI_CRADLE_STATE) ? JSON.parse(readFileSync(world.env.OI_CRADLE_STATE, "utf8")).value : null;
  const listing = JSON.parse(world.oi("config", "list", "--json"));
  const capabilities = listing.settings.find((setting) => setting.setting_ref === "ai-kit:skills:skills.capabilities");
  const strip = page.locator("[data-settings-pending]");
  const sheet = page.locator("[data-settings-review-sheet]");
  const skill = (name) => page.locator(`[data-skill-row][data-skill="skill/walkskills/${name}"]`);

  await enterSettings(page, {root: world.root, baseUrl});
  await openSection(page, "skills");
  await settled(page);
  await skill("walk-beta").locator("[role=switch]").waitFor({timeout: 240000});

  // --- S3 · at rest --------------------------------------------------------
  check(await strip.count() === 0 && await page.locator("[data-settings-pending-count]").count() === 0,
    "S3 at rest the pending strip is absent from the DOM (not hidden — absent)");
  const alphaBefore = active().has("skill/walkskills/walk-alpha");
  check(alphaBefore && !active().has("skill/walkskills/walk-beta"), "the world starts with walk-alpha on and walk-beta off (read from AIKit)");

  // --- S4 · staged ------------------------------------------------------------
  await skill("walk-beta").locator("[role=switch]").click();
  await page.waitForFunction(() => document.querySelector('[data-skill="skill/walkskills/walk-beta"]')?.getAttribute("data-changed") === "true", null, {timeout: 240000});
  await strip.waitFor({timeout: 60000});
  check((await skill("walk-beta").locator("[role=switch]").getAttribute("aria-checked")) === "true"
    && await skill("walk-beta").getByRole("button", {name: "Undo"}).count() === 1,
    "S4 the switched skill shows its staged value, marked changed, with Undo on the row");
  check(!active().has("skill/walkskills/walk-beta"), "S4 nothing is written before Apply — AIKit still reports walk-beta off");
  await openSection(page, "harnesses");
  const connectionCards = page.locator("[data-harness-connection]");
  await connectionCards.first().waitFor({timeout: 240000});
  const before = await page.locator("[data-harness-connection]:has([data-harness-default])").getAttribute("data-harness-connection");
  const target = before === "walk-pi" ? "walk-hermes" : "walk-pi";
  await page.locator(`[data-harness-connection="${target}"] [data-harness-set-default]`).click();
  await page.waitForFunction(() => document.querySelector("[data-settings-pending-count]")?.textContent?.startsWith("2 changes pending"), null, {timeout: 60000});
  check((await strip.innerText()).includes("2 changes pending") && (await strip.innerText()).includes("Review changes") && (await strip.innerText()).includes("Discard"),
    "S4 the strip reads \"2 changes pending · Review changes · Discard\"");
  check(heldConnection() === null, "S4 the connection is staged only — the desktop's state file is untouched before Apply");
  check((await page.locator('[data-settings-row="setting:default-connection"]').getAttribute("data-changed")) === "true", "S4 the connection row is marked changed");
  await shotMatrix({page, shot}, "staged");

  // --- S5 · review -------------------------------------------------------------
  await strip.getByRole("button", {name: "Review changes"}).click();
  await sheet.waitFor();
  await page.waitForFunction(() => document.querySelector("[data-settings-review-sheet]")?.getAttribute("data-phase") === "ready", null, {timeout: 240000});
  const rows = await sheet.locator("[data-review-row]").evaluateAll((nodes) => nodes.map((node) => ({key: node.getAttribute("data-review-row"), text: node.innerText, effect: node.querySelector("[data-review-effect]")?.getAttribute("data-review-effect"), words: node.querySelector("[data-review-effect]")?.textContent})));
  const skillRow = rows.find((row) => row.key.includes("walk-beta"));
  const connectionRow = rows.find((row) => row.key === "chat-default");
  check(rows.length === 2 && skillRow && connectionRow, "S5 one sheet lists both staged changes", {rows});
  check(skillRow?.text.includes("This machine") && skillRow.text.includes("off → on") && connectionRow?.text.includes("→"),
    "S5 each change shows its scope and from → to", {skillRow, connectionRow});
  check(skillRow?.effect === capabilities.effect.kind && skillRow.words === WORDS[capabilities.effect.kind],
    `S5 the skill's effect is the owner's effect kind (${capabilities.effect.kind}) in plain words ("${WORDS[capabilities.effect.kind]}")`, {skillRow});
  check(connectionRow?.words === "New chats only", "S5 the connection's effect reads \"New chats only\"");
  check(!active().has("skill/walkskills/walk-beta") && heldConnection() === null, "S5 reviewing writes nothing");
  await shotMatrix({page, shot}, "review");

  // --- S6 · apply and read back ----------------------------------------------------
  await sheet.getByRole("button", {name: "Apply changes"}).click();
  await page.waitForFunction(() => document.querySelector("[data-settings-review-sheet]")?.getAttribute("data-phase") === "done", null, APPLY_TIMEOUT);
  const results = await sheet.locator("[data-review-row]").evaluateAll((nodes) => nodes.map((node) => ({key: node.getAttribute("data-review-row"), result: node.querySelector("[data-review-result]")?.getAttribute("data-review-result"), text: node.querySelector("[data-review-result]")?.textContent})));
  const receipt = (await sheet.locator("[data-review-receipt]").textContent()) ?? "";
  check(results.every((row) => row.result === "applied" && row.text === "Applied ✓"), "S6 every row reads \"Applied ✓\"", {results});
  check(active().has("skill/walkskills/walk-beta"), "S6 the readback is true: AIKit now reports walk-beta active");
  check(heldConnection() === target, `S6 the readback is true: the desktop holds ${target} for new chats`);
  check(/^Applied 2 changes · read back \d{1,2}:\d{2}/.test(receipt.trim()), "S6 the receipt line reads \"Applied 2 changes · read back HH:MM\"", {receipt});
  await shot("applied");
  await sheet.getByRole("button", {name: "Done"}).click();
  await strip.waitFor({state: "detached", timeout: 60000});
  check(await strip.count() === 0, "S3 after a verified apply the strip leaves the DOM again");

  // --- S7 · refused, then partly applied -------------------------------------
  // Refused: a capability the owner does not know, held from the CLI (its own
  // request, so the owner's refusal is about exactly this change).
  world.oi("config", "hold", "ai-kit:skills:skills.capabilities", JSON.stringify({"skill/walkskills/not-in-catalogue": true}), "machine", "--json");
  await page.reload();
  await page.locator("[data-settings-page]").waitFor({timeout: 60000});
  await openSection(page, "skills");
  await settled(page);
  await strip.waitFor({timeout: 240000});
  await strip.getByRole("button", {name: "Review changes"}).click();
  await page.waitForFunction(() => document.querySelector("[data-settings-review-sheet]")?.getAttribute("data-phase") === "ready", null, {timeout: 240000});
  const refusalBefore = (await sheet.locator('[data-review-row*="not-in-catalogue"] [data-review-refusal]').textContent().catch(() => "")) ?? "";
  check(/not in the catalogue/.test(refusalBefore), "S7 the review shows the owner's refusal in its own words before anything moves", {refusalBefore});
  await sheet.getByRole("button", {name: "Apply changes"}).click();
  await page.waitForFunction(() => document.querySelector("[data-settings-review-sheet]")?.getAttribute("data-phase") === "done", null, APPLY_TIMEOUT);
  const refused = await sheet.locator('[data-review-row*="not-in-catalogue"] [data-review-result]').evaluate((node) => ({result: node.getAttribute("data-review-result"), text: node.textContent ?? ""}));
  check(refused.result === "refused" && refused.text.startsWith("This change wasn't applied.") && /not in the catalogue/.test(refused.text),
    "S7 the refused change reads \"This change wasn't applied.\" with the owner's reason", {refused});
  const refusedReceipt = ((await sheet.locator("[data-review-receipt]").textContent()) ?? "").trim();
  check(/^Applied 0 of 1 changes ·/.test(refusedReceipt), "S7 a refusal is not reported as success", {refusedReceipt});
  await shot("refused");
  await sheet.getByRole("button", {name: "Done"}).click();
  await strip.getByRole("button", {name: "Discard"}).click();
  await strip.waitFor({state: "detached", timeout: 240000});

  // Partly applied: walk-alpha is also enabled at the project scope, so
  // turning it off for the machine cannot take it off.
  world.aikit("enable", "skill/walkskills/walk-alpha", "--scope", "project", "--apply");
  await skill("walk-alpha").locator("[role=switch]").click();
  await page.waitForFunction(() => document.querySelector('[data-skill="skill/walkskills/walk-alpha"]')?.getAttribute("data-changed") === "true", null, {timeout: 240000});
  await strip.getByRole("button", {name: "Review changes"}).click();
  await page.waitForFunction(() => document.querySelector("[data-settings-review-sheet]")?.getAttribute("data-phase") === "ready", null, {timeout: 240000});
  await sheet.getByRole("button", {name: "Apply changes"}).click();
  await page.waitForFunction(() => document.querySelector("[data-settings-review-sheet]")?.getAttribute("data-phase") === "done", null, APPLY_TIMEOUT);
  const alpha = await sheet.locator('[data-review-row*="walk-alpha"] [data-review-result]').evaluate((node) => ({result: node.getAttribute("data-review-result"), text: node.textContent ?? ""}));
  check(alpha.result === "partial" && alpha.text.startsWith("Partly applied") && /another scope/.test(alpha.text),
    "S7 the overridden change reads \"Partly applied\" with the reason", {alpha});
  check(active().has("skill/walkskills/walk-alpha"), "S7 the owner still reports walk-alpha on — the page did not claim otherwise");
  const partialReceipt = ((await sheet.locator("[data-review-receipt]").textContent()) ?? "").trim();
  check(/^Applied 0 of 1 changes ·/.test(partialReceipt), "S7 a partial readback is not reported as success", {partialReceipt});
  await shot("partial");
  await sheet.getByRole("button", {name: "Done"}).click();
  if (await strip.count()) {
    await strip.getByRole("button", {name: "Discard"}).click();
    await strip.waitFor({state: "detached", timeout: 240000});
  }

  // --- S8 · stale plan ------------------------------------------------------------
  await skill("walk-gamma").locator("[role=switch]").click();
  await strip.waitFor({timeout: 240000});
  await strip.getByRole("button", {name: "Review changes"}).click();
  await page.waitForFunction(() => document.querySelector("[data-settings-review-sheet]")?.getAttribute("data-phase") === "ready", null, {timeout: 240000});
  // The staged value moves underneath the open review (another window or
  // the CLI holds a different value for the same setting).
  world.oi("config", "hold", "ai-kit:skills:skills.capabilities", JSON.stringify({"skill/walkskills/walk-gamma": true, "skill/walkskills/walk-beta": false}), "machine", "--json");
  await sheet.getByRole("button", {name: "Apply changes"}).click();
  await sheet.locator("[data-review-stale]").waitFor(APPLY_TIMEOUT);
  check(((await sheet.locator("[data-review-stale]").textContent()) ?? "") === "These settings changed. Review the plan again.",
    "S8 the stale plan reads \"These settings changed. Review the plan again.\"");
  check(!active().has("skill/walkskills/walk-gamma") && active().has("skill/walkskills/walk-beta"), "S8 Apply was refused: nothing moved in AIKit");
  check(await sheet.getByRole("button", {name: "Apply changes"}).count() === 0 && await sheet.getByRole("button", {name: "Review again"}).count() === 1,
    "S8 Apply is withdrawn until the plan is reviewed again");
  await shot("stale");
  await sheet.getByRole("button", {name: "Review again"}).click();
  await page.waitForFunction(() => document.querySelector("[data-settings-review-sheet]")?.getAttribute("data-phase") === "ready", null, {timeout: 240000});
  check(await sheet.locator("[data-review-row]").count() === 2, "S8 the fresh review shows what is staged now (two toggles)");
  await sheet.getByRole("button", {name: "Keep editing"}).click();

  // --- S9 · no capability changes ------------------------------------------------
  // Everything staged is withdrawn from the CLI while the strip still shows it;
  // the review reads the plan again and finds it empty.
  world.oi("config", "discard", "ai-kit:skills:skills.capabilities", "machine", "--json");
  await strip.getByRole("button", {name: "Review changes"}).click();
  await sheet.locator("[data-review-empty]").waitFor({timeout: 240000});
  check(((await sheet.locator("[data-review-empty]").textContent()) ?? "") === "No capability changes." && await sheet.locator("[data-review-row]").count() === 0,
    "S9 an empty plan reads \"No capability changes.\" — and only after the plan was read");
  await shot("no-changes");
  await sheet.getByRole("button", {name: "Done"}).click();
  await openSection(page, "status");
  await page.locator("[data-status-changes]").waitFor({timeout: 240000});
  check(((await page.locator("[data-status-changes]").textContent()) ?? "") === "No capability changes.", "S9 Status says \"No capability changes.\" once the owners' diff read is empty");
  check(await strip.count() === 0, "S3 with nothing staged the strip is absent again");
}
