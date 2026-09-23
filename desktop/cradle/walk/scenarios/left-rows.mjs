/**
 * Row behaviour (10-SIDEBARS §5.2 R6, R7, R12; §3.4 file rows and A6),
 * on the real kernel with a disposable ground and AIKit home.
 *
 *   R6  exactly one selected row per list (the conversation open here; the
 *       file open in the focused pane carries aria-current)
 *   R7  hover/focus reveals "…" and the open-where icons without changing
 *       the row's height (two-sided ±0.5px, rest vs hover)
 *   R12 a file row dropped into the composer inserts it as context in the
 *       owner's shared draft and never sends
 *   A6  Open beside puts the material in the right panel's Context canvas;
 *       Pop out is offered only where the native window route exists
 */
import {setup as groundSetup, bindDefaultCentral, SESSIONS} from "./left-ground.mjs";

export async function setup(args) { return groundSetup(args); }

const height = async locator => Math.round((await locator.boundingBox()).height * 2) / 2;

export default async function run({page, baseUrl, check, shot, channel, provision: p}) {
  await page.goto(baseUrl); await channel("info");
  await bindDefaultCentral(page, p.root);
  const left = page.locator('[data-region="left"]');
  const right = page.locator('[data-region="right"]');
  const alphaRow = page.locator('[data-project-path="Work/Alpha"]');
  await alphaRow.waitFor({timeout: 30000});
  await alphaRow.click();
  const alpha = left.locator('li[data-navigation-path="Work/Alpha"]');
  const idleRow = alpha.locator(`.left-conversation[data-session-ref="${SESSIONS.idle.ref}"]`);
  await idleRow.waitFor({timeout: 30000});
  await page.mouse.move(900, 700);

  // ---- R7: hover reveals, never resizes
  const rest = {height: await height(idleRow), more: await idleRow.locator(".left-row-more").evaluate(node => getComputedStyle(node).visibility)};
  await idleRow.hover();
  await page.waitForTimeout(250);
  const hover = {height: await height(idleRow), more: await idleRow.locator(".left-row-more").evaluate(node => getComputedStyle(node).visibility), wash: await idleRow.evaluate(node => getComputedStyle(node).backgroundColor)};
  check(Math.abs(rest.height - hover.height) <= 0.5 && rest.more === "hidden" && hover.more === "visible", "R7: a conversation row's height is identical at rest and on hover (±0.5px); its '…' appears only on hover", {rest, hover});
  // Keyboard focus reveals the same trailing actions (focus-within).
  await idleRow.locator(".left-row-main").focus();
  const more = idleRow.locator(".left-row-more > button");
  await more.click();
  const moreItems = await idleRow.getByRole("menuitem").allInnerTexts();
  await more.click();
  check(JSON.stringify(moreItems) === JSON.stringify(["Open in centre"]), "R7 / §3.4: the '…' holds only real actions (Open in centre)", {moreItems});
  await page.mouse.move(900, 700);

  // ---- R6: exactly one selected row per list
  await idleRow.locator(".left-row-main").click();
  await page.waitForFunction(ref => document.querySelector(`.left-conversation[data-session-ref="${ref}"]`)?.getAttribute("aria-current") === "true", SESSIONS.idle.ref, {timeout: 15000});
  const selectedChats = await alpha.locator('.left-conversation[aria-current="true"]').count();
  const selectedRef = await alpha.locator('.left-conversation[aria-current="true"]').getAttribute("data-session-ref");
  check(selectedChats === 1 && selectedRef === SESSIONS.idle.ref, "R6: with a conversation open in the panel, exactly one of Alpha's conversation rows is selected — that one", {selectedChats, selectedRef});
  // A file row carries aria-current while it is open in the focused pane.
  await alpha.getByRole("button", {name: "Alpha: files", exact: true}).click();
  const notes = left.locator('button[data-file-path="Work/Alpha/notes.md"]');
  await notes.waitFor({timeout: 20000});
  check(await left.locator('button[data-file-path][aria-current="true"]').count() === 0, "R6 (before): no file row is current while no file is open");
  await notes.click();
  await page.waitForFunction(() => document.querySelector('button[data-file-path="Work/Alpha/notes.md"]')?.getAttribute("aria-current") === "true", null, {timeout: 20000});
  const currentFiles = await left.locator('button[data-file-path][aria-current="true"]').evaluateAll(nodes => nodes.map(node => node.getAttribute("data-file-path")));
  const openTab = await page.locator('[data-region="centre"] [role="tab"][aria-selected="true"]').first().innerText().catch(() => "");
  check(JSON.stringify(currentFiles) === JSON.stringify(["Work/Alpha/notes.md"]) && openTab.includes("notes.md"), "R6 / §3.4: the file open in the focused pane is the one current file row", {currentFiles, openTab});
  await shot("R6-selected");

  // ---- R12: drag a file row into the composer — context in the draft, never sent
  const before = p.request("view", {agent_session: SESSIONS.idle.ref});
  const composer = right.locator(".agent-chat");
  await composer.waitFor({timeout: 15000});
  const dataTransfer = await page.evaluateHandle(() => new DataTransfer());
  await notes.dispatchEvent("dragstart", {dataTransfer});
  await composer.dispatchEvent("dragenter", {dataTransfer});
  await composer.dispatchEvent("dragover", {dataTransfer});
  await composer.dispatchEvent("drop", {dataTransfer});
  const attached = right.getByLabel("Attached context");
  await attached.getByText("notes.md").waitFor({timeout: 20000});
  let after = p.request("view", {agent_session: SESSIONS.idle.ref});
  for (let i = 0; i < 20 && !after.draft.text.includes("A file row opens beside."); i++) { await page.waitForTimeout(500); after = p.request("view", {agent_session: SESSIONS.idle.ref}); }
  const chips = await attached.innerText();
  check(chips.includes("notes.md") && after.draft.text.includes("A file row opens beside.") && after.draft.text.includes("notes.md"), "R12: dropping the file row into the composer inserts it as context — a notes.md chip in the composer and its quote in the owner's shared draft", {chips, draftRevision: after.draft.revision});
  check(after.blocks.filter(block => block.kind === "user").length === before.blocks.filter(block => block.kind === "user").length && after.blocks.length === before.blocks.length, "R12: the drop never sends — the owner's transcript has no new message", {before: before.blocks.length, after: after.blocks.length});
  await shot("R12-dropped-context");

  // ---- A6: Open beside / Pop out on a material row (Factory INTENT's vision)
  await left.locator("[data-left-head] .left-scope-trigger").click();
  await left.locator('[data-scope-project="Alpha"]').click();
  await left.locator('.world-mode-strip [data-mode="factory"]').click();
  await page.locator('.desktop-shell[data-mode="factory"]').waitFor();
  const vision = left.locator('[data-section="intent"] div[data-file-path="Work/Alpha/ProjectCentral/user/alpha.html"]');
  await vision.waitFor({timeout: 30000});
  await vision.hover();
  const beside = vision.getByRole("button", {name: "Open Vision beside"});
  const popOuts = await vision.getByRole("button", {name: "Pop out Vision"}).count();
  const visible = await beside.isVisible();
  await beside.click();
  await page.waitForFunction(() => {
    const tabs = [...document.querySelectorAll('[data-region="right"] [role="tab"]')].map(tab => tab.textContent ?? "");
    return tabs.some(text => text.includes("alpha.html"));
  }, null, {timeout: 30000});
  const sideTabs = await right.locator('[role="tab"]').allInnerTexts();
  const contextSelected = await right.locator('[aria-pressed="true"], [aria-selected="true"]').filter({hasText: "Context"}).count();
  check(visible && sideTabs.some(text => text.includes("alpha.html")) && contextSelected >= 1, "A6: Open beside puts the vision page in the right panel's Context canvas, with Context selected", {sideTabs, contextSelected});
  check(popOuts === 0, "A6: Pop out is offered only where the native window route exists (this walk runs the browser transport; the native detach route is not lent here)", {popOuts});
  await shot("A6-open-beside");
}
