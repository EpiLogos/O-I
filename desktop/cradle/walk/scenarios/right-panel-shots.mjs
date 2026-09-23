import {setup as canvasSetup} from "./canvas-context.mjs";
import {bindDefaultCentral} from "../editor-doc.mjs";
import {openPanel, planeButton, restoreScope} from "../lane2-support.mjs";

/** Looking pass for the right panel (10-SIDEBARS §4): every tab in light and
 *  dark at 1440, 1000 and 760 px, with one real agent in the roster and the
 *  attached conversation bound. Checks are geometric: the top row stays one
 *  row with nothing clipped, at every width and in both appearances. */
export async function setup(options) {
  const provision = await canvasSetup(options);
  provision.call("agent-profile.express", {scope: "root", project: null, world_ref: "control:root", ratified_world_refs: ["control:root"], name: "Walk reviewer", intent_expression: "Reviews the walk's drafts.", purpose: "Reviews the walk's drafts.", skill_refs: []});
  return provision;
}
const SESSION_TITLE = "Canvas editor and prepared context acceptance";

export default async function run({page, baseUrl, check, shot, channel, provision: p}) {
  await page.goto(baseUrl); await channel("info");
  await bindDefaultCentral(page, p.root);
  await restoreScope(page, "Editor");
  let panel = await openPanel(page);
  await planeButton(panel, "Chat").click();
  await panel.getByRole("button", {name: "History"}).click();
  await panel.getByRole("button", {name: SESSION_TITLE}).first().click({timeout: 20000});
  await panel.locator(".agent-chat .chat-composer").waitFor({timeout: 20000});
  for (const scheme of ["light", "dark"]) {
    await page.emulateMedia({colorScheme: scheme});
    for (const width of [1440, 1000, 760]) {
      await page.setViewportSize({width, height: 860});
      await page.waitForTimeout(400);
      panel = await openPanel(page);
      const theme = await page.evaluate(() => document.querySelector(".oi-desktop")?.getAttribute("data-theme") ?? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"));
      for (const tab of ["Chat", "Activity", "Agents", "Context"]) {
        await planeButton(panel, tab).click();
        await page.waitForTimeout(350);
        await shot(`${scheme}-${width}-${tab.toLowerCase()}`);
      }
      const fit = await page.evaluate(() => {
        const top = document.querySelector(".agent-layer .panel-top").getBoundingClientRect();
        const parts = [...document.querySelectorAll(".agent-layer .panel-top .avatar-menu-open, .agent-layer .panel-top .panel-tab, .agent-layer .panel-top .panel-full, .agent-layer .panel-top .panel-collapse")].map(el => el.getBoundingClientRect());
        const tabs = [...document.querySelectorAll(".agent-layer .panel-tab")];
        const clipped = tabs.some(tab => tab.scrollWidth > tab.clientWidth + 0.5 || tab.getBoundingClientRect().right > document.querySelector(".agent-layer .panel-full").getBoundingClientRect().left + 0.5);
        return {h: top.height, spread: Math.max(...parts.map(r => r.top + r.height / 2)) - Math.min(...parts.map(r => r.top + r.height / 2)), clipped, width: top.width};
      });
      check(fit.spread <= 1 && fit.h <= 44.5 && !fit.clipped, `${scheme} ${width}px: the top row is one row and no tab is clipped`, {...fit, theme});
      if (width === 760) { await page.keyboard.press("Escape"); await page.waitForTimeout(300); }
    }
  }
  await page.setViewportSize({width: 1280, height: 820});
}
