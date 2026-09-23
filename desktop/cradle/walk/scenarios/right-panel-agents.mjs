import {setup as canvasSetup} from "./canvas-context.mjs";
import {bindDefaultCentral} from "../editor-doc.mjs";
import {openPanel, planeButton, recordCalls, restoreScope} from "../lane2-support.mjs";

/** Agents and object pages (10-SIDEBARS §4.5, §4.7; P15 P17 P18): the roster
 *  is Central's real agent-profile roster in a disposable ground — profiles
 *  are expressed through the owner's own action (agent-profile.express), never
 *  fixtures. Real kernel, isolated AIKIT_HOME. */
export async function setup(options) { return canvasSetup(options); }

const REVIEWER = {name: "Walk reviewer", purpose: "Reviews the walk's drafts before they are shared."};
const GUARDIAN = {name: "Walk Guardian", purpose: "Keeps the walk ground coherent.", role: "product-guardian"};
const express = (p, agent) => p.call("agent-profile.express", {scope: "root", project: null, world_ref: "control:root", ratified_world_refs: ["control:root"], name: agent.name, intent_expression: agent.purpose, purpose: agent.purpose, skill_refs: [], ...(agent.role ? {role: agent.role} : {})});
const noJsonOutsideRaw = (page, selector) => page.evaluate(sel => {
  const root = document.querySelector(sel); if (!root) return false;
  const pres = [...root.querySelectorAll("pre")].every(pre => pre.closest("details"));
  const text = [...root.querySelectorAll("*")].filter(el => !el.closest("details") && el.children.length === 0).map(el => el.textContent.trim()).filter(Boolean);
  return pres && !text.some(line => /^[[{].*[}\]]$/.test(line) && line.includes('"'));
}, selector);

export default async function run({page, baseUrl, check, shot, channel, provision: p}) {
  recordCalls(page);
  await page.goto(baseUrl); await channel("info");
  await bindDefaultCentral(page, p.root);
  await restoreScope(page, "Editor");
  let panel = await openPanel(page);

  // --- P17 empty: a real roster with no agents in it ----------------------
  await planeButton(panel, "Agents").click();
  const agents = panel.locator('[data-plane="Agents"]');
  await agents.locator('[data-empty="none"]').waitFor({timeout: 20000});
  check((await agents.locator('[data-empty="none"]').innerText()).startsWith("Create an agent to work with."), "P17: an empty roster reads Create an agent to work with.");
  check(await agents.locator(".agents-row").count() === 0, "P17: no invented rows (no hardcoded Guardians or offices)");
  await shot("p17-empty");

  // --- real identities: two profiles expressed through Central -------------
  const reviewer = express(p, REVIEWER).profile.agent_ref;
  const guardian = express(p, GUARDIAN).profile.agent_ref;
  await planeButton(panel, "Chat").click();
  await planeButton(panel, "Agents").click();
  await agents.locator(".agents-row").first().waitFor({timeout: 20000});
  const working = await agents.getByRole("region", {name: "Working with you"}).locator(".agents-row-name").allInnerTexts();
  const guardians = await agents.getByRole("region", {name: "Guardians"}).locator(".agents-row-name").allInnerTexts();
  check(JSON.stringify(working) === JSON.stringify([REVIEWER.name]) && JSON.stringify(guardians) === JSON.stringify([GUARDIAN.name]), "WORKING WITH YOU and GUARDIANS come from Central's roster, by role", {working, guardians});
  const purpose = await agents.locator(`[data-agent-ref="${reviewer}"] .agents-row-purpose`).innerText();
  check(purpose === REVIEWER.purpose, "a row shows the agent's own purpose line", purpose);
  const markTitle = await agents.locator(`[data-agent-ref="${reviewer}"] .agents-row-mark`).getAttribute("title");
  check(/Not accepted yet/.test(markTitle ?? ""), "a not-yet-accepted agent carries the unavailable mark with its reason", markTitle);
  await shot("roster");

  // --- P17 search-empty and back --------------------------------------------
  await agents.getByRole("button", {name: "Search agents"}).click();
  await agents.getByRole("searchbox", {name: "Search agents"}).fill("zzz");
  const none = agents.locator('[data-empty="search"]');
  check((await none.innerText()).startsWith("No agents match “zzz”."), "P17: a search with no match reads No agents match “zzz”.", await none.innerText());
  await none.getByRole("button", {name: "Clear"}).click();
  check(await agents.locator(".agents-row").count() === 2, "P17: Clear brings the roster back");
  await agents.getByRole("button", {name: "Search agents"}).click();
  await agents.getByRole("searchbox", {name: "Search agents"}).fill("guard");
  check(JSON.stringify(await agents.locator(".agents-row-name").allInnerTexts()) === JSON.stringify([GUARDIAN.name]), "search narrows by name and purpose");
  await agents.getByRole("searchbox", {name: "Search agents"}).press("Escape");

  // --- avatar menu: the same roster ------------------------------------------
  await panel.locator(".avatar-menu-open").click();
  const menu = panel.getByRole("menu", {name: "Agents in this scope"});
  const menuNames = await menu.locator(".avatar-menu-name").allInnerTexts();
  check(menuNames.includes(REVIEWER.name) && menuNames.includes(GUARDIAN.name), "the avatar menu lists the agents available in this scope", menuNames);
  await menu.getByRole("menuitemradio", {name: REVIEWER.name}).click();
  check((await panel.locator(".avatar-menu-open").getAttribute("aria-label")).startsWith(REVIEWER.name), "choosing an agent puts it on the avatar", await panel.locator(".avatar-menu-open").getAttribute("aria-label"));
  await shot("avatar-menu-chosen");

  // --- P15: Inspect opens the object — a tab in Base, one identity ----------
  await planeButton(panel, "Agents").click();
  await agents.locator(`[data-agent-ref="${reviewer}"] .agents-row-open`).click();
  const pageSel = `.object-page[data-object-kind="agent"][data-object-ref="${reviewer}"]`;
  await page.locator(pageSel).locator(".object-fields dt").first().waitFor({timeout: 20000});
  const fields = await page.locator(pageSel).locator(".object-fields dt").allInnerTexts();
  check(["Purpose", "Role", "Identity", "Profile", "Scope"].every(label => fields.includes(label)), "P15: the agent's page leads with labelled fields", fields);
  check(await page.locator(".tab-title", {hasText: REVIEWER.name}).count() === 1, "P15: it opens as a canvas tab in the focused pane");
  check(await noJsonOutsideRaw(page, pageSel), "P15: no JSON text outside Show raw on the page");
  await agents.locator(`[data-agent-ref="${reviewer}"] .agents-row-open`).click();
  await page.waitForTimeout(400);
  check(await page.locator(".tab-title", {hasText: REVIEWER.name}).count() === 1, "P15: opening it again focuses the same page (one identity, one tab)");
  await agents.locator(`[data-agent-ref="${reviewer}"] .agents-row-open`).click({modifiers: ["Alt"]});
  await page.getByText("Pop out opens the page in its own window in the desktop app.").first().waitFor({state: "attached", timeout: 5000}).then(() => check(true, "P15: ⌥-click asks for its own window; the browser build says honestly that only the desktop app pops out")).catch(() => check(false, "P15: ⌥-click asks for its own window"));
  check(await page.locator(".tab-title", {hasText: REVIEWER.name}).count() === 1, "P15: a pop-out request never duplicates the page");
  await shot("p15-agent-page");

  // --- full-page mode: the page replaces the centre in place, ← Back --------
  await page.getByRole("radio", {name: "Expressions", exact: true}).first().click();
  panel = await openPanel(page);
  await planeButton(panel, "Agents").click();
  await panel.locator(`[data-agent-ref="${guardian}"] .agents-row-open`).click();
  const layer = page.locator('.object-centre-layer .object-page[data-object-kind="agent"]');
  await layer.waitFor({timeout: 20000});
  await layer.locator(".object-fields dt").first().waitFor({timeout: 20000});
  check((await layer.locator(".object-title").textContent()) === GUARDIAN.name && (await layer.locator(".object-kind").textContent()) === "Guardian", "A4: in a full-page mode the page opens in place (no tab bar), as a Guardian");
  await shot("a4-in-place");
  await layer.getByRole("button", {name: "Back"}).click();
  check(await page.locator(".object-centre-layer").count() === 0, "A4: ← Back returns to where you were");
  await page.getByRole("radio", {name: "Central", exact: true}).first().click();

  // --- P18: narrow — a detail drawer replaces the body with Back ------------
  await page.setViewportSize({width: 760, height: 820});
  panel = await openPanel(page);
  await planeButton(panel, "Agents").click();
  await panel.locator(`[data-agent-ref="${reviewer}"] .agents-row-open`).click();
  const detail = panel.locator(".panel-detail .object-page");
  await detail.waitFor({timeout: 20000});
  check(await panel.locator('[data-plane="Agents"]').isHidden(), "P18: the page replaces the panel body as a detail layer", {});
  check(await detail.getByRole("button", {name: "Back"}).count() === 1, "P18: the detail layer has Back");
  await shot("p18-detail");
  await page.keyboard.press("Escape");
  await panel.locator('[data-plane="Agents"]').waitFor({state: "visible", timeout: 5000});
  check(await panel.locator(".panel-detail").count() === 0 && await page.locator('[data-region="right"][data-overlay="true"]').count() === 1, "P18: Escape steps one layer — the detail closes, the drawer stays");
  await page.keyboard.press("Escape");
  await page.waitForSelector('[data-region="right"][data-depth="collapsed"]', {timeout: 5000});
  check(true, "P18: a second Escape closes the drawer");
  await page.setViewportSize({width: 1280, height: 820});

  // --- P17 error: an unreadable roster says so, with Retry -----------------
  await restoreScope(page, "Other");
  panel = await openPanel(page);
  await planeButton(panel, "Agents").click();
  const error = panel.locator('[data-empty="error"]');
  await error.waitFor({timeout: 20000});
  check((await error.innerText()).startsWith("Couldn't load agents.") && await error.getByRole("button", {name: "Retry"}).count() === 1, "P17: a failed roster read says Couldn't load agents. with Retry — never an empty roster");
  check(await panel.locator('[data-empty="none"]').count() === 0, "P17: the error is distinct from the empty state");
  await shot("p17-error");
}
