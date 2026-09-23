import {setup as canvasSetup} from "./canvas-context.mjs";
import {bindDefaultCentral} from "../editor-doc.mjs";
import {openPanel, planeButton, planeLabels, recordCalls, restoreScope, textareaCount, sameCentre} from "../lane2-support.mjs";

/** The right panel's frame (10-SIDEBARS §4.1–§4.2, amendment A3) and the
 *  frame states P1 P2 P3 P13 P14 P18 — walked against the real kernel with a
 *  disposable ground and an isolated AIKIT_HOME (canvas-context setup: one
 *  attached conversation, the existing pi provider configured). No model
 *  turn is needed here; turns are walked in right-panel-turn. */
export async function setup(options) { return canvasSetup(options); }

const SESSION_TITLE = "Canvas editor and prepared context acceptance";
const DRAFT = "P3 draft — kept across tab, mode and restart ✓";
const BOUND_DRAFT = "P13 draft held by the owner";

export default async function run({page, baseUrl, check, shot, channel, provision: p}) {
  const calls = recordCalls(page);
  await page.goto(baseUrl); await channel("info");
  await bindDefaultCentral(page, p.root);
  await restoreScope(page, "Editor");
  let panel = await openPanel(page);

  // --- A3: one top row — avatar, tabs, ⤢, ✕; no title band --------------
  const labels = await planeLabels(panel);
  check(JSON.stringify(labels) === JSON.stringify(["Chat", "Activity", "Agents", "Context"]), "Base: the tabs are Chat · Activity · Agents · Context", labels);
  const row = await page.evaluate(() => {
    const top = document.querySelector(".agent-layer .panel-top");
    const box = el => { const r = el.getBoundingClientRect(); return {x: r.x, y: r.y, w: r.width, h: r.height, cy: r.y + r.height / 2}; };
    const parts = [".avatar-menu-open", ".panel-tab", ".panel-full", ".panel-collapse"].map(sel => [...top.querySelectorAll(sel)].map(box));
    return {top: box(top), avatar: parts[0][0], tabs: parts[1], full: parts[2][0], collapse: parts[3][0], firstChild: top.firstElementChild?.className};
  });
  const centres = [row.avatar, ...row.tabs, row.full, row.collapse].map(b => b.cy);
  check(Math.max(...centres) - Math.min(...centres) <= 1, "avatar, tabs, ⤢ and ✕ share one row (centres within 1px)", centres);
  check(row.avatar.x < row.tabs[0].x && row.tabs[row.tabs.length - 1].x + row.tabs[row.tabs.length - 1].w <= row.full.x + 0.5 && row.full.x < row.collapse.x, "left to right: avatar, then tabs, then ⤢ and ✕ (no overlap)", row);
  check(row.top.h <= 44.5, "the top is one row: no title band above the tabs", row.top);
  const text = await panel.innerText();
  check(!/Situated in|The conversation is in the centre/.test(text), "no observer sentences (no \"Situated in …\", no \"conversation is in the centre\")");
  check(await panel.getByRole("button", {name: /^More/}).count() === 0, "no More overflow among the tabs");
  await shot("a3-top-row");

  // --- P2: open, no conversation — suggestions fill the draft, never send --
  const message = panel.getByRole("textbox", {name: "Message", exact: true});
  const suggestions = panel.locator(".chat-suggestion");
  const suggestionTexts = await suggestions.allInnerTexts();
  check(suggestionTexts.length >= 1 && suggestionTexts.length <= 3, "P2: at most three starting suggestions", suggestionTexts);
  const before = calls.length;
  await suggestions.first().click();
  check(await message.inputValue() === suggestionTexts[0], "P2: a suggestion fills the draft with its exact words", await message.inputValue());
  await page.waitForTimeout(800);
  const dispatched = calls.slice(before).filter(call => call.op === "encounter_provision" || (call.op === "encounter" && /prompt/.test(call.action ?? "")));
  check(dispatched.length === 0, "P2: nothing is dispatched by a suggestion", dispatched);

  // --- P3: the draft is kept across tab, mode and restart ------------------
  await message.fill(DRAFT);
  await planeButton(panel, "Activity").click();
  await planeButton(panel, "Chat").click();
  check(await message.inputValue() === DRAFT, "P3: switching tab keeps the draft byte-identical");
  await page.getByRole("radio", {name: "Expressions", exact: true}).first().click();
  panel = await openPanel(page);
  await planeButton(panel, "Chat").click();
  check(await panel.getByRole("textbox", {name: "Message", exact: true}).inputValue() === DRAFT, "P3: switching mode keeps the draft byte-identical");
  await page.getByRole("radio", {name: "Central", exact: true}).first().click();
  await page.reload();
  panel = await openPanel(page);
  await planeButton(panel, "Chat").click();
  check(await panel.getByRole("textbox", {name: "Message", exact: true}).inputValue() === DRAFT, "P3: a restart keeps the draft byte-identical");

  // --- bind the attached conversation (the plane's own chooser) -----------
  await panel.getByRole("button", {name: "History"}).click();
  await panel.getByRole("button", {name: SESSION_TITLE}).first().click({timeout: 20000});
  await panel.locator(".chat-composer").first().waitFor();
  await page.waitForFunction(() => document.querySelector(".agent-chat textarea") && !document.querySelector(".agent-chat textarea").disabled, null, {timeout: 20000});
  await panel.getByRole("textbox", {name: "Message", exact: true}).fill(BOUND_DRAFT);
  for (let reads = 0; reads < 10 && p.request("view").draft.text !== BOUND_DRAFT; reads++) await page.waitForTimeout(500);
  check(p.request("view").draft.text === BOUND_DRAFT, "the bound conversation's draft is the owner's (AIKit shared draft)");

  // --- P13: full takeover and back, no remount ----------------------------
  await page.evaluate(() => { document.querySelector(".agent-chat textarea").__lane2Probe = "p13"; });
  await panel.getByRole("button", {name: "Full screen conversation"}).click();
  await page.waitForSelector('.agent-layer[data-full="true"]');
  const fullBox = await panel.boundingBox();
  check(fullBox.width > 700, "P13: ⤢ gives the conversation the width of the window", fullBox);
  check(await page.evaluate(() => document.querySelector(".agent-chat textarea")?.__lane2Probe === "p13"), "P13: the composer is the same element in full (no remount)");
  await shot("p13-full");
  await page.keyboard.press("Meta+Alt+KeyJ");
  await page.waitForSelector('.agent-layer[data-full="false"]');
  check(await page.evaluate(() => document.querySelector(".agent-chat textarea")?.__lane2Probe === "p13"), "P13: ⌘⌥J returns to the panel with the same composer element");
  check(await panel.getByRole("textbox", {name: "Message", exact: true}).inputValue() === BOUND_DRAFT, "P13: the draft is kept across the takeover round trip");

  // --- P14: promoted to the centre, exactly one composer -------------------
  await panel.getByRole("button", {name: "Open the conversation in the centre"}).click();
  await panel.locator('[data-line="promoted"]').waitFor({timeout: 20000});
  check((await panel.locator('[data-line="promoted"]').innerText()).replace(/\s+/g, " ").trim() === "Open in the centre — Bring back", "P14: the panel's Chat reads one line: Open in the centre — Bring back");
  await page.locator(".encounter").first().waitFor({timeout: 20000});
  check(await textareaCount(page) === 1, "P14: exactly one composer in the DOM while promoted", await textareaCount(page));
  await shot("p14-promoted");
  await panel.getByRole("button", {name: "Bring back"}).click();
  await panel.locator(".agent-chat .chat-composer").waitFor({timeout: 20000});
  check(await page.locator(".encounter").count() === 0 && await textareaCount(page) === 1, "P14: Bring back closes the centre copy; one composer, back in the panel");

  // --- P1: closed — the corner companion mark mirrors the agent ------------
  await panel.getByRole("button", {name: "Collapse the panel"}).click();
  await page.waitForSelector('[data-region="right"][data-depth="collapsed"]');
  const mark = page.locator(".shell-agent-presence");
  await mark.waitFor();
  let owner; try { owner = p.request("status"); } catch { owner = {state: "Disconnected"}; }
  const markState = await mark.getAttribute("data-presence-state");
  check(owner.state === "Disconnected" ? markState === "disconnected" : markState === "idle", "P1: with the panel closed the corner mark carries the agent's observed state", {owner: owner.state, markState});
  check((await mark.locator(".shell-agent-presence-dot").innerText()).trim() === "" && await mark.getAttribute("data-presence-state") !== "working", "P1: not working, not needing you: the mark carries neither ● nor !");
  await shot("p1-closed");
  await page.keyboard.press("Meta+Shift+KeyB");
  panel = await openPanel(page);

  // --- tabs by mode (§4.2) ---------------------------------------------------
  const expect = {Expressions: ["Chat", "Activity", "Agents", "Context"], "Technè": ["Chat", "Activity", "Agents", "Context"], Factory: ["Run", "Agents", "Context"]};
  for (const [label, tabs] of Object.entries(expect)) {
    await page.getByRole("radio", {name: label, exact: true}).first().click();
    panel = await openPanel(page);
    await page.waitForTimeout(400);
    const seen = await planeLabels(panel);
    check(JSON.stringify(seen) === JSON.stringify(tabs), `${label}: the tabs are ${tabs.join(" · ")}`, seen);
    check(!(await panel.innerText()).includes("Nara · Anima") && !seen.includes("Epii"), `${label}: Nara·Anima and Epii are not tabs`);
  }
  await page.getByRole("radio", {name: "Central", exact: true}).first().click();
  // Settings: the panel rests collapsed; opened, it is a Chat-only help panel.
  await page.locator(".world-system-settings").first().click();
  await page.waitForSelector('[data-region="right"][data-depth="collapsed"]', {timeout: 10000});
  check(true, "Settings: the right panel rests collapsed");
  panel = await openPanel(page);
  check(JSON.stringify(await planeLabels(panel)) === JSON.stringify(["Chat"]), "Settings: opened, the panel offers Chat only", await planeLabels(panel));
  await page.getByRole("button", {name: "Collapse the panel"}).click();
  await page.keyboard.press("Escape");
  await page.locator(".world-system-settings").first().click().catch(() => {});
  await page.getByRole("radio", {name: "Central", exact: true}).first().click().catch(() => {});

  // --- P18: narrow — the panel is an overlay drawer -------------------------
  await page.setViewportSize({width: 760, height: 820});
  await page.waitForTimeout(500);
  panel = await openPanel(page);
  await page.waitForSelector('[data-region="right"][data-overlay="true"]', {timeout: 5000});
  check(await page.evaluate(() => document.querySelector(".desktop-centre")?.inert === true), "P18: at 760px the panel is an overlay drawer over an inert centre");
  await shot("p18-overlay");
  await page.keyboard.press("Escape");
  await page.waitForSelector('[data-region="right"][data-depth="collapsed"]', {timeout: 5000});
  check(true, "P18: Escape closes the drawer (one layer)");
  await page.setViewportSize({width: 1280, height: 820});
  check(await sameCentre(page), "the centre is interactive again at full width");
}
