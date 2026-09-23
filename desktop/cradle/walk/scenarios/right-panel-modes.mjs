import {existsSync, readFileSync} from "node:fs";
import {join} from "node:path";
import {setup as canvasSetup} from "./canvas-context.mjs";
import {bindDefaultCentral} from "../editor-doc.mjs";
import {openPanel, planeButton, recordCalls, restoreScope} from "../lane2-support.mjs";

/** Harness · connection · model, and permission modes (10-SIDEBARS §4.1,
 *  amendments A1 and A2; P5): the real Hermes harness (hermes-acp, which
 *  advertises default / accept_edits / dont_ask) connected through the real
 *  kernel and the lane's AIKit build, in a disposable ground and isolated
 *  AIKIT_HOME (OI_WALK_HERMES_BIN may name another Hermes ACP launcher). Its label is a deliberate campaign-style note — the chip must
 *  never show it. P5 uses one real Hermes turn that asks before editing. */
const HERMES_LABEL = "Hermes ACP (modes walk campaign note)";
export async function setup(options) {
  const provision = await canvasSetup(options);
  provision.native("encounter-configure", "--provider-json", JSON.stringify({protocol: "acp", id: "modes-walk-hermes", label: HERMES_LABEL, argv: [process.env.OI_WALK_HERMES_BIN ?? "/Users/admin/.local/bin/hermes-acp"]}));
  return provision;
}

const SESSION_TITLE = "Canvas editor and prepared context acceptance";
const EDIT = "Create a file named mode-walk.txt in the current directory whose whole content is the word ok. Use your file editing tool.";

export default async function run({page, baseUrl, check, shot, channel, provision: p}) {
  const calls = recordCalls(page);
  await page.goto(baseUrl); await channel("info");
  await bindDefaultCentral(page, p.root);
  await restoreScope(page, "Editor");
  let panel = await openPanel(page);
  await planeButton(panel, "Chat").click();
  await panel.getByRole("button", {name: "History"}).click();
  await panel.getByRole("button", {name: SESSION_TITLE}).first().click({timeout: 20000});
  const connect = panel.locator(".chat-connect");
  await connect.waitFor({timeout: 30000});
  await connect.locator('.chat-provider[data-provider="modes-walk-hermes"]').waitFor({timeout: 30000});
  const offered = await connect.locator(".chat-provider[data-provider]").allInnerTexts();
  check(offered.includes("Hermes") && offered.includes("Pi") && !offered.some(text => text.includes("campaign")), "A1: connections are offered by harness name, never by their free-text label", offered);
  await connect.locator('.chat-provider[data-provider="modes-walk-hermes"]').click();
  await panel.locator('.chat-composer[data-connection="connected"]').waitFor({timeout: 120000});

  // --- A1: the harness chip names the harness; the label is second-line only --
  const harness = panel.locator('[data-chip="harness"]');
  await harness.waitFor({timeout: 20000});
  check((await harness.innerText()).trim() === "Hermes", "A1: the harness chip shows the harness name (Hermes), derived from protocol and command", await harness.innerText());
  await harness.click();
  const picker = panel.getByRole("group", {name: "Harness"});
  const groups = await picker.locator(".harness-group-name").allTextContents();
  const secondLines = await picker.locator(".harness-row-label").allInnerTexts();
  check(groups.includes("Hermes") && groups.includes("Pi"), "A1: the picker groups connections by harness name", groups);
  check(secondLines.includes(HERMES_LABEL), "A1: the connection's own label is a second line inside the picker", secondLines);
  await page.keyboard.press("Escape");

  // --- A1: the model chip is the session's real model; its menu lists models only
  const reading = p.request("model-read");
  const observation = reading.model_observation;
  const model = panel.locator('[data-chip="model"]');
  if (observation) {
    await model.waitFor({timeout: 20000});
    const current = observation.available_models.find(option => option.modelId === observation.current_model_id);
    check((await model.textContent()).trim() === (current?.name ?? observation.current_model_id), "A1: the model chip shows the session's current model (model-read current_model_id)", {chip: await model.textContent(), current: observation.current_model_id});
    await model.click();
    const items = await panel.locator(".chat-model-item span").allInnerTexts();
    check(JSON.stringify(items) === JSON.stringify(observation.available_models.map(option => option.name)), "A1: the model menu lists exactly the harness's available_models", {items: items.length, models: observation.available_models.length});
    await page.keyboard.press("Escape");
  } else {
    check(await model.count() === 0, "A1: with no model observation the model chip is absent, not invented");
  }

  // --- A2: the permission mode chip — only the modes Hermes advertises ------
  const modeChip = panel.locator('[data-chip="mode"]');
  await modeChip.waitFor({timeout: 20000});
  const ownerModes = p.request("mode-read");
  check(ownerModes.mode_observation.current_mode_id === "default" && (await modeChip.innerText()).trim() === "Ask", "A2: the chip shows the session's mode at a glance (default → Ask)", {chip: await modeChip.innerText(), owner: ownerModes.mode_observation.current_mode_id});
  await modeChip.click();
  const modeItems = await panel.locator(".chat-mode-item .chat-mode-name").allInnerTexts();
  check(JSON.stringify(modeItems.map(text => text.trim())) === JSON.stringify(["Ask before acting", "Accept edits", "Don't Ask"]), "A2: the menu offers exactly the harness's modes, named in the design's words where they match", modeItems);
  check(!modeItems.some(text => /Bypass|Plan only/.test(text)), "A2: modes the harness does not support are not offered");
  await panel.locator(".chat-mode-item", {hasText: "Accept edits"}).click();
  await page.waitForFunction(() => document.querySelector('[data-chip="mode"]')?.textContent?.includes("Accept edits"), null, {timeout: 20000});
  const afterSelect = p.request("mode-read");
  check(afterSelect.mode_observation.current_mode_id === "accept_edits", "A2: choosing Accept edits sets the native session's mode (owner mode-read)", afterSelect.mode_observation.current_mode_id);
  const journal = p.request("read", {after: 0, limit: 256}).events.map(entry => entry.event);
  check(journal.some(event => event.kind === "native-mode-configuration-confirmed" && event.receipt?.current?.current_mode_id === "accept_edits" && typeof event.observed_at_ms === "number"), "A2: the change is the owner's confirmed, time-stamped record");
  await planeButton(panel, "Activity").click();
  await panel.locator(".tape-row[data-verb=note]", {hasText: "permission mode · accept_edits"}).waitFor({timeout: 20000});
  check(true, "A2: the tape shows the mode change where it happened");
  await shot("a2-accept-edits");
  await planeButton(panel, "Chat").click();
  await modeChip.click();
  await panel.locator(".chat-mode-item", {hasText: "Ask before acting"}).click();
  await page.waitForFunction(() => document.querySelector('[data-chip="mode"]')?.textContent?.trim().startsWith("Ask"), null, {timeout: 20000});
  check(p.request("mode-read").mode_observation.current_mode_id === "default", "A2: back to Ask before acting");

  // --- P5: needs you — a real permission request as an inline card ---------
  await panel.getByRole("textbox", {name: "Message", exact: true}).fill(EDIT);
  await page.waitForFunction(() => !document.querySelector(".agent-chat .chat-send")?.disabled, undefined, {timeout: 30000});
  await panel.getByRole("button", {name: "Send", exact: true}).click();
  const card = panel.locator(".chat-permission");
  await card.waitFor({timeout: 180000});
  const pending = p.request("view").permissions ?? [];
  check(pending.length === 1, "P5: the harness is waiting on exactly one native permission request", pending.length);
  const choices = pending[0]?.choices?.map(choice => choice.option_id) ?? [];
  const cardText = await card.innerText();
  check(/wants to/.test(cardText) && await card.getByRole("button", {name: "Allow", exact: true}).count() === 1 && await card.getByRole("button", {name: "Refuse", exact: true}).count() === 1, "P5: an inline card says what the agent wants, with Allow and Refuse", cardText.slice(0, 200));
  const scopes = await card.locator(".chat-permission-scope").count();
  check(scopes === 0 || scopes === pending[0].choices.filter(choice => (choice.kind ?? "").startsWith("allow")).length, "P5: the scope choices are the harness's own allow options, none invented", {scopes, choices});
  check(await card.evaluate(el => [...el.querySelectorAll("pre")].every(pre => pre.closest("details"))), "P5: the request's verbatim form is only behind Show raw");
  check(await panel.locator('[data-plane-tab="Chat"][data-mark="attention"]').count() === 1, "P5: ! on the Chat tab");
  check(await panel.locator('.avatar-menu-open[data-presence="attention"]').count() === 1, "P5: ! on the avatar");
  await shot("p5-needs-you");
  await panel.getByRole("button", {name: "Collapse the panel"}).click();
  const mark = page.locator(".shell-agent-presence");
  await mark.waitFor();
  check(await mark.getAttribute("data-presence-state") === "attention" && (await mark.locator(".shell-agent-presence-dot").innerText()).trim() === "!", "P1: the closed panel's mark carries ! while the agent needs you");
  await page.keyboard.press("Meta+Shift+KeyB");
  panel = await openPanel(page);
  await planeButton(panel, "Chat").click();
  const before = calls.length;
  await panel.locator(".chat-permission").getByRole("button", {name: "Allow", exact: true}).click();
  await panel.locator(".chat-permission-answered").first().waitFor({timeout: 20000});
  check((await panel.locator(".chat-permission-answered").first().innerText()).startsWith("Allowed"), "P5: the card collapses to one line once answered");
  await page.waitForTimeout(1500);
  check(calls.slice(before).filter(call => call.op === "encounter" && call.action === "permission").length === 1, "P5: one activation answers one native request");
  await panel.getByRole("button", {name: "Send", exact: true}).waitFor({timeout: 240000});
  const written = join(p.projectRoot, "mode-walk.txt");
  check(existsSync(written) && readFileSync(written, "utf8").trim() === "ok", "P5: allowed, the harness really made the edit", existsSync(written) ? readFileSync(written, "utf8") : null);
  check(await panel.locator('[data-plane-tab="Chat"][data-mark="attention"]').count() === 0 && (p.request("view").permissions ?? []).length === 0, "P5: answering clears the ! and the owner's pending request");
  await shot("p5-answered");
}
