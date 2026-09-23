import {bindDefaultCentral} from "../editor-doc.mjs";
import {chooseProject} from "../lib/factory-ground.mjs";
export {setup} from "./canvas-context.mjs";

/** Lane 0 repairs (10-SIDEBARS §6.1, 11-FACTORY §8), walked against the real
 *  kernel over a disposable ground with a real AIKit session space:
 *   - §3.6 rule 1: focusing a tab from another project never changes the
 *     scope (the workspace project and the kernel navigator stay put);
 *   - §3.5 / §6.1.2: a Factory TASKS row opens its conversation in the centre
 *     Tasks view, never as a tab in the side group;
 *   - D2 / §6.1.3: the Epi-Logos toggle is a lens — it opens no surface and
 *     leaves the mode and scope where they were. */

const BOOK = "oi-cradle.workspaces.v1";

export default async function run({page, baseUrl, check, shot, channel, provision: p}) {
  await page.goto(baseUrl); await channel("info");
  await bindDefaultCentral(page, p.root);
  const nav = page.getByRole("complementary", {name: "World navigator"});
  const book = () => page.evaluate(key => {const b = JSON.parse(localStorage.getItem(key) ?? "null"); return b?.workspaces?.find(w => w.id === b.active) ?? null;}, BOOK);
  const navigatorProject = async () => (await channel("read.state")).data.state?.navigator?.project?.project?.name ?? null;
  const surfaces = async () => Object.values((await channel("read.layout")).data.layout.surfaces ?? {}).map(s => `${s.kind}:${s.ref ?? s.title}`).sort();

  // --- A. scope does not follow tab focus -----------------------------------
  await nav.locator('[data-project-path="Work/Editor"]').click();
  await nav.locator('[data-project-path="Work/Editor"]').hover();
  if (await page.getByRole("button", {name: "Editor: files", exact: true}).getAttribute("aria-pressed") !== "true") await page.getByRole("button", {name: "Editor: files", exact: true}).click();
  const file = p.sources[0].binding.path;
  await nav.locator(`[data-file-path="Work/Editor/${file}"]`).click();
  await page.waitForFunction(ref => document.querySelector(".pane.focused .cm-content")?.dataset.sourceRef === ref, p.sources[0].binding.ref ?? p.sources[0].ref, {timeout: 20000}).catch(() => {});
  const fileTitle = file.split("/").pop();
  // The scope is Central, chosen in the scope menu (§3.6 — the one place it
  // is chosen); opening a project's file above did not move it.
  await page.locator('[data-left-head] .left-scope-trigger').click();
  await page.getByRole("group", {name: "Scope and workspace"}).getByRole("menuitemradio", {name: "Central"}).click();
  await page.waitForFunction(key => {const b = JSON.parse(localStorage.getItem(key) ?? "null"); return !b?.workspaces?.find(w => w.id === b.active)?.project;}, BOOK, {timeout: 10000});
  const before = {project: (await book())?.project ?? null, navigator: await navigatorProject()};
  check(before.project === null, "the Central destination sets the scope to Central (no project)", before);
  // Focus a tab that belongs to Editor.
  await page.getByRole("tab", {name: fileTitle, exact: false}).first().click();
  await page.waitForFunction(title => document.querySelector('.tab[aria-selected="true"]')?.textContent?.includes(title), fileTitle, {timeout: 10000});
  await page.waitForTimeout(800);
  const after = {project: (await book())?.project ?? null, navigator: await navigatorProject()};
  check(after.project === before.project && after.navigator === before.navigator, "focusing a tab from Editor leaves the scope on Central — workspace project and kernel navigator unchanged", {before, after});
  await shot("scope-held-on-tab-focus");

  // --- B. Factory conversations open in the centre Tasks view ----------------
  await page.keyboard.press("Meta+Alt+2");
  await page.locator('.mode-stage[data-mode="factory"]').waitFor();
  // The scope menu (lane 1, 10-SIDEBARS §3.6) is the one route that sets the
  // scope; it writes the workspace scope.
  await chooseProject(page, "Editor");
  await page.waitForFunction(key => {const b = JSON.parse(localStorage.getItem(key) ?? "null"); return b?.workspaces?.find(w => w.id === b.active)?.project === "Editor";}, BOOK, {timeout: 10000});
  const left = page.locator('[data-region="left"]');
  await left.getByRole("radio", {name: "Tasks", exact: true}).click();
  const row = left.locator('[data-section="tasks"] .left-conversation .left-row-main').first();
  await row.waitFor({timeout: 30000});
  const rowTitle = (await row.locator(".left-conversation-title").innerText()).trim();
  const beforeSurfaces = await surfaces();
  await row.click();
  await page.waitForFunction(title => [...document.querySelectorAll('[data-region="left"] [data-section="tasks"] .left-conversation[aria-current="true"] .left-conversation-title')].some(el => el.textContent?.trim() === title), rowTitle, {timeout: 20000}).catch(() => {});
  await page.waitForTimeout(800);
  const afterSurfaces = await surfaces();
  check(JSON.stringify(beforeSurfaces) === JSON.stringify(afterSurfaces), "opening a Factory task adds no tab to any group (the side tab group is untouched)", {beforeSurfaces, afterSurfaces});
  const centre = page.locator('.mode-stage[data-mode="factory"]');
  const composers = await page.locator('textarea[aria-label="Message"], [role="textbox"][aria-label="Message"]').count();
  check(await centre.locator('[aria-label="Message"]').count() === 1 && composers === 1, "the conversation stands in the centre Tasks view with exactly one composer in the window", {composers});
  const selectedRows = await left.locator('[data-section="tasks"] .left-conversation[aria-current="true"] .left-conversation-title').allInnerTexts();
  check(selectedRows.length === 1 && selectedRows[0].trim() === rowTitle, "the chosen TASKS row is the one selected row", {rowTitle, selectedRows});
  await shot("factory-task-in-centre");

  // --- C. the Epi-Logos toggle is a lens: no surface, no mode or scope change --
  const lensBefore = {surfaces: await surfaces(), mode: (await channel("read.layout")).data.layout.mode ?? "base", project: (await book())?.project ?? null};
  // The lens toggle is the last control of the hidden window footer (A5).
  await page.locator(".workspace-footer-edge").hover(); await page.waitForTimeout(300);
  const toggle = page.locator(".canvas-arrangement").getByRole("button", {name: "Epi-Logos lens", exact: true});
  check(await page.locator(".canvas-arrangement").evaluate(node => [...node.children].at(-1)?.getAttribute("aria-label")) === "Epi-Logos lens", "the lens toggle is the window footer's last control (A5)");
  await toggle.click();
  await page.waitForFunction(key => {const b = JSON.parse(localStorage.getItem(key) ?? "null"); return b?.workspaces?.find(w => w.id === b.active)?.context?.world === "epi-logos";}, BOOK, {timeout: 10000});
  await page.waitForTimeout(500);
  const lensOn = {surfaces: await surfaces(), mode: (await channel("read.layout")).data.layout.mode ?? "base", project: (await book())?.project ?? null};
  check(JSON.stringify(lensOn) === JSON.stringify(lensBefore), "turning the lens on opens no surface and keeps the mode and scope", {lensBefore, lensOn});
  check(await toggle.getAttribute("aria-pressed") === "true" && await page.locator('[data-left-head]').getByRole("status", {name: "Epi-Logos lens is on"}).isVisible(), "the footer toggle reads on and the head shows the Epi-Logos chip");
  await shot("lens-on-no-surface");
  await page.locator(".workspace-footer-edge").hover(); await page.waitForTimeout(300);
  await toggle.click();
  await page.waitForFunction(key => {const b = JSON.parse(localStorage.getItem(key) ?? "null"); return b?.workspaces?.find(w => w.id === b.active)?.context?.world !== "epi-logos";}, BOOK, {timeout: 10000});
  const lensOff = {surfaces: await surfaces(), mode: (await channel("read.layout")).data.layout.mode ?? "base", project: (await book())?.project ?? null};
  check(JSON.stringify(lensOff) === JSON.stringify(lensBefore) && await toggle.getAttribute("aria-pressed") === "false", "turning it off leaves everything exactly as it was", {lensOff});
}
