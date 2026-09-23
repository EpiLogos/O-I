import {setup as canvasSetup} from "./canvas-context.mjs";
import {bindDefaultCentral} from "../editor-doc.mjs";
import {openPanel, planeButton, restoreScope} from "../lane2-support.mjs";

/** The Context tab's launcher (10-SIDEBARS §4.6): the canvas insertion is
 *  preserved (see context-canvas-insert, the untouched baseline); only the
 *  empty state is new — File ⌘P · Terminal ⌃` · Browser page ⌘T, each opening
 *  the existing insertion route. Real kernel, disposable ground. */
export async function setup(options) { return canvasSetup(options); }

export default async function run({page, baseUrl, check, shot, channel, provision: p}) {
  await page.goto(baseUrl); await channel("info");
  await bindDefaultCentral(page, p.root);
  await restoreScope(page, "Editor");
  let panel = await openPanel(page);
  await planeButton(panel, "Context").click();
  const canvas = panel.locator('[data-plane="context"]');
  const launcher = canvas.locator(".context-launcher");
  await launcher.waitFor({timeout: 15000});
  const entries = (await launcher.locator(".context-launch").allInnerTexts()).map(text => text.replace(/\s+/g, " ").trim());
  check(JSON.stringify(entries) === JSON.stringify(["File ⌘P", "Terminal ⌃`", "Browser page ⌘T"]), "Base: the empty Context is the three-entry launcher", entries);
  const text = await canvas.innerText();
  check(!/returns?\b/i.test(text) && !/not wired|Nothing active yet|open a pane above/.test(text), "no repeated empty instructions, no \"returns\" wording", text.slice(0, 300));
  await shot("launcher");
  const closeAll = async () => {
    for (let i = 0; i < 6 && await canvas.locator(".tab-title").count(); i++) await canvas.getByRole("button", {name: /^Close /}).first().click();
    await launcher.waitFor({timeout: 10000});
  };

  // File (⌘P) → the existing open-into-the-panel route.
  await launcher.getByRole("button", {name: /^Terminal/}).focus();
  await page.keyboard.press("Meta+p");
  const picker = canvas.getByRole("group", {name: "Choose a file"});
  await picker.waitFor({timeout: 5000}).then(() => check(true, "⌘P in the Context tab opens the file chooser")).catch(() => check(false, "⌘P in the Context tab opens the file chooser"));
  if (!await picker.isVisible()) await launcher.getByRole("button", {name: /^File/}).click();
  await picker.locator(`[data-file-path="Work/Editor/${p.sourcePath}"]`).click({timeout: 15000});
  await canvas.locator(".tab-title", {hasText: p.sourcePath}).waitFor({timeout: 20000});
  const kinds = await canvas.locator(".surface-retained").evaluateAll(nodes => nodes.map(node => node.getAttribute("data-surface-kind")));
  check(kinds.length === 1 && ["file", "source"].includes(kinds[0]), "File opens the chosen file as a file surface in the canvas", kinds);
  check(await page.locator(".desktop-centre .tab-title", {hasText: p.sourcePath}).count() === 0, "the file lands in the panel canvas, not the centre");
  check(await launcher.count() === 0, "once something is inserted the launcher gives way to the canvas as it works today");
  await shot("file-inserted");
  await closeAll();

  // Terminal → the canvas's New tab and its fresh-tab choice.
  await launcher.getByRole("button", {name: /^Terminal/}).click();
  await canvas.locator(".tab-title", {hasText: "Terminal"}).waitFor({timeout: 20000});
  check((await canvas.locator(".tab-title").allInnerTexts()).join() === "Terminal", "Terminal inserts one terminal tab");
  await closeAll();

  // Browser page, by its shortcut from inside the tab.
  await launcher.getByRole("button", {name: /^Terminal/}).focus();
  await page.keyboard.press("Meta+t");
  await canvas.locator(".tab-title", {hasText: "Browser"}).waitFor({timeout: 20000}).catch(async error => {
    console.log("DIAG tabs", JSON.stringify(await canvas.locator(".tab-title").allInnerTexts()), "centre", JSON.stringify(await page.locator(".desktop-centre .tab-title").allInnerTexts()), "active", await page.evaluate(() => document.activeElement?.outerHTML?.slice(0, 120)));
    throw error;
  });
  check((await canvas.locator(".tab-title").allInnerTexts()).join() === "Browser", "⌘T in the Context tab inserts a browser page", await canvas.locator(".tab-title").allInnerTexts());
  check(await page.locator(".desktop-centre .tab-title", {hasText: "Browser"}).count() === 0, "⌘T here never opens a centre tab");
  const lanes = await canvas.locator(".ta-active-context .oi-side-row-title").allInnerTexts();
  check(lanes.includes("Browser"), "Active Context lists what the canvas holds", lanes);
  await closeAll();

  // The same launcher in a full-page mode.
  await page.getByRole("radio", {name: "Expressions", exact: true}).first().click();
  panel = await openPanel(page);
  await planeButton(panel, "Context").click();
  const ta = panel.locator('[data-plane="ta-onta-context"] .context-launcher');
  await ta.waitFor({timeout: 15000});
  check(await ta.locator(".context-launch").count() === 3, "Expressions: the same launcher in its Context tab");
  await shot("expressions-launcher");
}
